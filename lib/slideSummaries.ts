import { supabase } from './supabase';
import { getCurrentUser } from './auth';

export interface SlideSummary {
  id: string;
  document_id: string;
  slide_number: number;
  summary_content: any; // TipTap JSON 형식
  user_notes_content: any; // TipTap JSON 형식
  created_at: string;
  updated_at: string;
}

const CONCURRENCY = 5;
const PROMPT_VERSION = 'v1';
const RETRY_MAX = 2;
const RETRY_BACKOFF_MS = 500;

export interface SlideSummarySingleResponse {
  docId: string;
  slideIndex: number;
  summary: any;
  cached: boolean;
  model: string;
  latencyMs: number;
}

/**
 * 페이지별 텍스트를 가져옵니다 (parse/pages API).
 */
export async function fetchPageTexts(storagePath: string): Promise<{ slide_number: number; text: string }[]> {
  const res = await fetch('/api/parse/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storagePath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.details ? `${err.error || '페이지 텍스트 조회 실패'}: ${err.details}` : (err.error || '페이지 텍스트 조회 실패');
    throw new Error(msg);
  }
  const data = await res.json();
  if (!data.pages || !Array.isArray(data.pages)) {
    throw new Error('페이지 데이터 형식 오류');
  }
  return data.pages;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch /api/slide-summary with retry on 429/5xx. Backoff: 500 * 2^attempt ms. */
async function fetchSlideSummaryWithRetry(
  docId: string,
  slideIndex: number,
  slideText: string,
  abortSignal?: AbortSignal | null
): Promise<Response> {
  const body = JSON.stringify({
    docId,
    slideIndex,
    slideText,
    promptVersion: PROMPT_VERSION,
  });
  let lastRes: Response | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
    if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await fetch('/api/slide-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: abortSignal ?? undefined,
      });
      lastRes = res;
      const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
      if (res.ok || !retryable || attempt === RETRY_MAX) return res;
      const backoffMs = RETRY_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(backoffMs);
    } catch (e) {
      lastError = e;
      if (abortSignal?.aborted || attempt === RETRY_MAX) throw e;
      const backoffMs = RETRY_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(backoffMs);
    }
  }
  if (lastRes && !lastRes.ok) return lastRes;
  throw lastError ?? new Error('요약 요청 실패');
}

/**
 * 단일 슬라이드 요약 요청 (재시도용). 재시도/백오프 적용.
 */
export async function requestSingleSlideSummary(params: {
  docId: string;
  slideIndex: number;
  slideText: string;
  abortSignal?: AbortSignal | null;
  onDone: (summary: any) => void;
  onError: (errorMessage: string) => void;
}): Promise<void> {
  const { docId, slideIndex, slideText, abortSignal, onDone, onError } = params;
  try {
    const res = await fetchSlideSummaryWithRetry(docId, slideIndex, slideText, abortSignal);
    if (abortSignal?.aborted) return;
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      onError(errData.error || `HTTP ${res.status}`);
      return;
    }
    const data: SlideSummarySingleResponse = await res.json();
    onDone(data.summary);
  } catch (e) {
    if (abortSignal?.aborted) return;
    const msg = e instanceof Error ? e.message : String(e);
    onError(msg);
  }
}

/**
 * 점진적 슬라이드 요약: 슬라이딩 윈도우로 동시에 최대 CONCURRENCY개 요청,
 * 완료되는 즉시 onSlideDone 호출. abortSignal 시 전부 취소.
 */
export async function generateSlideSummariesProgressive(params: {
  docId: string;
  storagePath: string;
  pageCount: number;
  abortSignal?: AbortSignal | null;
  onPageTextsReady?: (pages: { slide_number: number; text: string }[]) => void;
  onSlideDone: (slideIndex: number, summary: any) => void;
  onSlideError?: (slideIndex: number, errorMessage: string) => void;
}): Promise<void> {
  const { docId, storagePath, pageCount, abortSignal, onPageTextsReady, onSlideDone, onSlideError } = params;

  const pages = await fetchPageTexts(storagePath);
  onPageTextsReady?.(pages);
  if (pages.length === 0) {
    return;
  }

  let nextIndex = 0;
  const maxIndex = Math.min(pageCount, pages.length);

  const runWorker = async (): Promise<void> => {
    while (!abortSignal?.aborted && nextIndex < maxIndex) {
      const i = nextIndex++;
      const page = pages[i];
      if (!page) break;

      try {
        const res = await fetchSlideSummaryWithRetry(
          docId,
          page.slide_number,
          page.text,
          abortSignal
        );

        if (abortSignal?.aborted) return;

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const msg = errData.error || `HTTP ${res.status}`;
          onSlideError?.(page.slide_number, msg);
          continue;
        }

        const data: SlideSummarySingleResponse = await res.json();
        onSlideDone(data.slideIndex, data.summary);
      } catch (e) {
        if (abortSignal?.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        onSlideError?.(page.slide_number, msg);
      }
    }
  };

  const workerCount = Math.min(CONCURRENCY, maxIndex);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
}

/**
 * 슬라이드 요약을 생성합니다 (API 호출)
 */
export async function generateSlideSummaries(
  documentId: string,
  storagePath: string
): Promise<SlideSummary[]> {
  const response = await fetch('/api/summarize/slides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, storagePath }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || '슬라이드 요약 생성 실패');
  }

  const data = await response.json();
  console.log('슬라이드 요약 생성 완료:', data.count, '개');
  
  // 생성된 요약 조회
  return await fetchSlideSummaries(documentId);
}

/**
 * 해당 문서의 슬라이드 요약 캐시를 전부 삭제합니다. (다시 생성 전 호출)
 */
export async function deleteSlideSummariesForDocument(documentId: string): Promise<void> {
  const { error } = await supabase
    .from('slide_summaries')
    .delete()
    .eq('document_id', documentId);

  if (error) {
    console.error('Error deleting slide summaries:', error);
    throw new Error(`슬라이드 요약 삭제 실패: ${error.message}`);
  }
}

/**
 * 슬라이드 요약을 조회합니다.
 */
export async function fetchSlideSummaries(documentId: string): Promise<SlideSummary[]> {
  const { data, error } = await supabase
    .from('slide_summaries')
    .select('*')
    .eq('document_id', documentId)
    .order('slide_number', { ascending: true });

  if (error) {
    console.error('Error fetching slide summaries:', error);
    throw new Error(`슬라이드 요약 조회 실패: ${error.message}`);
  }

  return data || [];
}

/**
 * 슬라이드 요약 내용을 업데이트합니다 (사용자 편집)
 */
export async function updateSlideSummary(
  documentId: string,
  slideNumber: number,
  summaryContent: any, // TipTap JSON
): Promise<SlideSummary> {
  const { data, error } = await supabase
    .from('slide_summaries')
    .update({
      summary_content: summaryContent,
      updated_at: new Date().toISOString(),
    })
    .eq('document_id', documentId)
    .eq('slide_number', slideNumber)
    .select()
    .single();

  if (error) {
    console.error('Error updating slide summary:', error);
    throw new Error(`슬라이드 요약 업데이트 실패: ${error.message}`);
  }

  return data;
}

/**
 * 사용자 노트만 업데이트합니다.
 */
export async function updateUserNotes(
  documentId: string,
  slideNumber: number,
  userNotesContent: any // TipTap JSON
): Promise<SlideSummary> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  // 기존 요약이 있는지 확인
  const { data: existing } = await supabase
    .from('slide_summaries')
    .select('id, summary_content')
    .eq('document_id', documentId)
    .eq('slide_number', slideNumber)
    .single();

  if (existing) {
    // 업데이트
    const { data, error } = await supabase
      .from('slide_summaries')
      .update({
        user_notes_content: userNotesContent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user notes:', error);
      throw new Error(`사용자 노트 업데이트 실패: ${error.message}`);
    }

    return data;
  } else {
    // 새로 생성 (summary_content는 빈 상태)
    const { data, error } = await supabase
      .from('slide_summaries')
      .insert({
        document_id: documentId,
        slide_number: slideNumber,
        summary_content: null,
        user_notes_content: userNotesContent,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user notes:', error);
      throw new Error(`사용자 노트 생성 실패: ${error.message}`);
    }

    return data;
  }
}

