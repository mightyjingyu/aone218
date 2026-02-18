import { FullSummaryV2 } from '@/types/fullSummaryV2';

const FULL_SUMMARY_V2_KEY = 'aone_full_summaries_v2';

const getStoredItems = (key: string): any[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

const saveItems = (key: string, items: any[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(items));
};

export function saveFullSummaryV2(documentId: string, summary: FullSummaryV2): void {
  const summaries = getStoredItems(FULL_SUMMARY_V2_KEY);
  const index = summaries.findIndex((s: any) => s.document_id === documentId);
  const now = new Date().toISOString();

  if (index >= 0) {
    summaries[index] = {
      ...summaries[index],
      content: summary,
      updated_at: now,
    };
  } else {
    summaries.push({
      document_id: documentId,
      content: summary,
      created_at: now,
      updated_at: now,
    });
  }

  saveItems(FULL_SUMMARY_V2_KEY, summaries);
}

export function fetchFullSummaryV2(documentId: string): FullSummaryV2 | null {
  const summaries = getStoredItems(FULL_SUMMARY_V2_KEY);
  const found = summaries.find((s: any) => s.document_id === documentId);
  return found?.content || null;
}

export async function extractPdfText(storagePath: string): Promise<string> {
  try {
    const response = await fetch('/api/parse/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      let detail = '';
      try {
        const errBody = JSON.parse(bodyText);
        detail = errBody?.details || errBody?.error || '';
      } catch {
        detail = bodyText || '';
      }
      if (detail && (detail.trimStart().startsWith('<') || detail.includes('<!DOCTYPE'))) {
        detail = '서버 오류(HTML 반환). 터미널 로그를 확인하거나 개발 서버를 재시작해 보세요.';
      } else if (detail && detail.length > 200) {
        detail = detail.slice(0, 200) + '…';
      }
      const msg = detail ? `PDF 텍스트 추출 실패: ${detail}` : `PDF 텍스트 추출 실패: ${response.status}`;
      throw new Error(msg);
    }

    const data = await response.json();
    if (!data.pages || !Array.isArray(data.pages)) {
      throw new Error('페이지 데이터가 유효하지 않습니다.');
    }

    const allText = data.pages
      .map((page: any, index: number) => `[페이지 ${index + 1}]\n${page.text || ''}`)
      .join('\n\n');

    return allText;
  } catch (error: any) {
    console.error('PDF 텍스트 추출 오류:', error);
    throw error;
  }
}

export async function generateFullSummaryV2(
  documentId: string,
  options: {
    pdfText?: string;
    storagePath?: string;
    professorSpeechText?: string;
    mockProfessorEmphasis?: string;
  }
): Promise<FullSummaryV2> {
  let pdfText = options.pdfText;

  if (!pdfText && options.storagePath) {
    pdfText = await extractPdfText(options.storagePath);
  }

  if (!pdfText || pdfText.trim().length === 0) {
    throw new Error('PDF 텍스트가 비어있습니다.');
  }

  const response = await fetch('/api/summarize/full-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfText,
      professorSpeechText: options.professorSpeechText || '',
      mockProfessorEmphasis: options.mockProfessorEmphasis,
    }),
  });

  if (!response.ok) {
    let message = `전체 요약 생성 실패 (HTTP ${response.status})`;
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorData = await response.json();
        const err = errorData?.error;
        const details = errorData?.details;
        if (err && details) message = `${err} (${details})`;
        else message = err || details || message;
      } else {
        const text = await response.text();
        message = text || message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();
  const summary: FullSummaryV2 = data.summary;

  saveFullSummaryV2(documentId, summary);

  return summary;
}

export function generateMockProfessorEmphasis(): string {
  const mockPoints = [
    '시험에 자주 나오는 비교 포인트: A와 B의 차이점을 명확히 구분해야 함',
    '헷갈리기 쉬운 정의: 이 개념은 다른 개념과 혼동하지 않도록 주의',
    '중요한 계산식: 이 공식은 반드시 암기해야 하며, 시험에 자주 출제됨',
    '실무 적용 시 주의사항: 이론과 실제 적용 시 차이점이 있음',
  ];

  const count = Math.floor(Math.random() * 2) + 1;
  const selected = mockPoints
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .join('\n');

  return selected;
}
