"use client";

import { useState, use, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, FileText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import SummaryTabs from "@/components/document/SummaryTabs";
import { fetchFiles, getFileUrl, deleteFile, FileMetadata } from "@/lib/files";
import { getCurrentUser } from "@/lib/auth";
import AuthGuard from "@/components/auth/AuthGuard";
import { 
  generateSlideSummariesProgressive,
  requestSingleSlideSummary,
  fetchPageTexts,
  deleteSlideSummariesForDocument,
} from "@/lib/slideSummaries";

/** 슬라이드별 요약 슬롯 상태 (점진적 생성용) */
export type SlideSummarySlotStatus = 'idle' | 'loading' | 'done' | 'error';
export interface SlideSummarySlot {
  slideNumber: number;
  status: SlideSummarySlotStatus;
  summaryContent?: any;
  userNotesContent?: any;
  errorMessage?: string;
  audioSegments?: any[];
}

// PDFViewer를 Dynamic Import로 로드 (브라우저에서만 실행)
const PDFViewer = dynamic(
  () => import("@/components/document/PDFViewer"),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">PDF 뷰어 로딩 중...</p>
        </div>
      </div>
    )
  }
);

function DocumentContent({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(1);
  const resolvedParams = use(params);
  const [fileData, setFileData] = useState<FileMetadata | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  
  // 슬라이드 요약 슬롯별 상태 (idle | loading | done | error)
  const [slideSummaryState, setSlideSummaryState] = useState<SlideSummarySlot[]>([]);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pageTextsRef = useRef<{ slide_number: number; text: string }[]>([]);
  const progressiveStartMsRef = useRef<number | null>(null);
  const ttfrLoggedRef = useRef(false);
  const doneCountRef = useRef(0);
  const errorCountRef = useRef(0);

  useEffect(() => {
    loadDocument();
  }, [resolvedParams.id]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // 슬라이드 요약 자동 생성 (PDF 페이지 수가 정해진 뒤 실행되도록 pdfPageCount 의존)
  useEffect(() => {
    if (!fileData || fileData.type !== 'pdf') return;
    const total = pdfPageCount ?? fileData.page_count ?? 0;
    if (total < 1) return;
    loadOrGenerateSummaries();
  }, [fileData, pdfPageCount]);

  // 방향키로 슬라이드 이동 (← 이전, → 다음)
  useEffect(() => {
    if (fileData?.type !== 'pdf') return;
    const total = pdfPageCount ?? fileData?.page_count ?? 1;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlide((prev) => Math.max(1, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentSlide((prev) => Math.min(total, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fileData?.type, fileData?.page_count, pdfPageCount]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await getCurrentUser();
      if (!user) {
        setError("로그인이 필요합니다.");
        return;
      }

      // 파일 메타데이터 조회
      const files = await fetchFiles(user.id);
      const file = files.find(f => f.id === resolvedParams.id);

      if (!file) {
        setError("문서를 찾을 수 없습니다.");
        return;
      }

      setFileData(file);

      // PDF 파일인 경우 Storage URL 가져오기
      if (file.type === 'pdf') {
        const url = await getFileUrl(file.storage_path);
        setPdfUrl(url);
      }
    } catch (err: any) {
      console.error("문서 로드 실패:", err);
      setError(err.message || "문서를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const pageCountRef = pdfPageCount ?? fileData?.page_count ?? 1;

  const loadOrGenerateSummaries = async () => {
    if (!fileData) return;
    const total = pdfPageCount ?? fileData.page_count ?? 1;
    if (total < 1) return;

    try {
      setSummaryError(null);
      // 항상 현재 페이지 순서(pdfjs)로 점진 생성. DB 캐시는 API 단에서만 사용(슬라이드별 요청 시 캐시 hit 시 빠르게 반환).
      setSlideSummaryState(
        Array.from({ length: total }, (_, i) => ({
          slideNumber: i + 1,
          status: 'loading' as const,
          audioSegments: [],
        }))
      );

      progressiveStartMsRef.current = Date.now();
      ttfrLoggedRef.current = false;
      doneCountRef.current = 0;
      errorCountRef.current = 0;
      const controller = new AbortController();
      abortControllerRef.current = controller;
      generateSlideSummariesProgressive({
        docId: fileData.id,
        storagePath: fileData.storage_path,
        pageCount: total,
        abortSignal: controller.signal,
        onPageTextsReady: (pages) => {
          pageTextsRef.current = pages;
        },
        onSlideDone: (slideIndex, summary) => {
          doneCountRef.current += 1;
          if (!ttfrLoggedRef.current) {
            ttfrLoggedRef.current = true;
            const ttfrMs = progressiveStartMsRef.current != null ? Date.now() - progressiveStartMsRef.current : 0;
            console.log('[slide-summary] TTFR (ms):', ttfrMs);
          }
          setSlideSummaryState((prev) =>
            prev.map((s) =>
              s.slideNumber === slideIndex
                ? { ...s, status: 'done' as const, summaryContent: summary }
                : s
            )
          );
        },
        onSlideError: (slideIndex, errorMessage) => {
          errorCountRef.current += 1;
          setSlideSummaryState((prev) =>
            prev.map((s) =>
              s.slideNumber === slideIndex
                ? { ...s, status: 'error' as const, errorMessage }
                : s
            )
          );
        },
      })
        .then(() => {
          const totalMs = progressiveStartMsRef.current != null ? Date.now() - progressiveStartMsRef.current : 0;
          console.log('[slide-summary] complete', {
            totalMs,
            doneCount: doneCountRef.current,
            errorCount: errorCountRef.current,
            total: total,
          });
        })
        .finally(() => {
          abortControllerRef.current = null;
        });
    } catch (err: unknown) {
      console.error('슬라이드 요약 로드/생성 실패:', err);
      setSummaryError(err instanceof Error ? err.message : '슬라이드 요약 생성에 실패했습니다.');
      setSlideSummaryState((prev) =>
        prev.length ? prev.map((s) => ({ ...s, status: 'error' as const, errorMessage: (err as Error)?.message })) : []
      );
    }
  };

  const handleDelete = async () => {
    if (!fileData) return;
    
    if (!confirm(`"${fileData.name}" 파일을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteFile(fileData.id);
      router.push("/dashboard");
    } catch (err: any) {
      alert("파일 삭제에 실패했습니다: " + err.message);
    }
  };

  const handleRegenerateSummaries = useCallback(async () => {
    if (!fileData) return;
    try {
      setSummaryError(null);
      await deleteSlideSummariesForDocument(fileData.id);
      await loadOrGenerateSummaries();
    } catch (err: unknown) {
      console.error('요약 다시 생성 실패:', err);
      setSummaryError(err instanceof Error ? err.message : '요약 다시 생성에 실패했습니다.');
    }
  }, [fileData]);

  const handleRetrySlide = useCallback((slideNumber: number) => {
    if (!fileData) return;
    setSlideSummaryState((prev) =>
      prev.map((s) =>
        s.slideNumber === slideNumber ? { ...s, status: 'loading' as const } : s
      )
    );
    const ensurePageTexts = async (): Promise<string> => {
      if (pageTextsRef.current.length > 0) {
        const p = pageTextsRef.current.find((x) => x.slide_number === slideNumber);
        if (p) return p.text;
      }
      const pages = await fetchPageTexts(fileData.storage_path);
      pageTextsRef.current = pages;
      const p = pages.find((x) => x.slide_number === slideNumber);
      if (!p) throw new Error('해당 슬라이드 텍스트를 찾을 수 없습니다.');
      return p.text;
    };
    ensurePageTexts()
      .then((slideText) => {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        return requestSingleSlideSummary({
          docId: fileData.id,
          slideIndex: slideNumber,
          slideText,
          abortSignal: controller.signal,
          onDone: (summary) => {
            setSlideSummaryState((prev) =>
              prev.map((s) =>
                s.slideNumber === slideNumber
                  ? { ...s, status: 'done' as const, summaryContent: summary }
                  : s
              )
            );
            abortControllerRef.current = null;
          },
          onError: (errorMessage) => {
            setSlideSummaryState((prev) =>
              prev.map((s) =>
                s.slideNumber === slideNumber
                  ? { ...s, status: 'error' as const, errorMessage }
                  : s
              )
            );
            abortControllerRef.current = null;
          },
        });
      })
      .catch((err) => {
        setSlideSummaryState((prev) =>
          prev.map((s) =>
            s.slideNumber === slideNumber
              ? { ...s, status: 'error' as const, errorMessage: err instanceof Error ? err.message : String(err) }
              : s
          )
        );
      });
  }, [fileData]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-500">문서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !fileData) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-red-400 mb-6 font-semibold">{error || "문서를 찾을 수 없습니다."}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20"
          >
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const pageCount = pdfPageCount || fileData.page_count || 1;
  const doneCount = slideSummaryState.filter((s) => s.status === 'done').length;
  const isGenerating = slideSummaryState.some((s) => s.status === 'loading' || s.status === 'idle');

  const documentData = {
    id: fileData.id,
    name: fileData.name,
    pdfUrl: pdfUrl,
    totalSlides: pageCount,
    slideSummarySlots: slideSummaryState,
    fullSummary: null,
    doneCount,
    isGenerating,
    summaryError,
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 헤더 */}
      <header className="h-14 bg-background border-b border-border flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500 group-hover:text-white" />
          </button>
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold text-white tracking-tight">{documentData.name}</h1>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-gray-500 bg-surface px-3 py-1 rounded-full border border-border">
            {fileData.type === 'pdf' ? `SLIDE ${currentSlide} / ${documentData.totalSlides}` : 'AUDIO'}
          </span>
          <button
            onClick={handleDelete}
            className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-red-500"
            title="파일 삭제"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex overflow-hidden">
        {fileData.type === 'pdf' ? (
          <>
            {/* 좌측: PDF 뷰어 */}
            <div className="w-1/2 bg-surface/30 border-r border-border backdrop-blur-sm">
              {pdfUrl ? (
                <PDFViewer
                  pdfUrl={pdfUrl}
                  currentSlide={currentSlide}
                  totalSlides={documentData.totalSlides}
                  onSlideChange={setCurrentSlide}
                  onPdfLoad={setPdfPageCount}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-500 text-sm font-medium">유효한 URL 생성 중...</p>
                  </div>
                </div>
              )}
            </div>

            {/* 우측: 요약 탭 */}
            <div className="w-1/2 bg-background">
              {slideSummaryState.length === 0 && !summaryError ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
                    <p className="text-gray-500 text-sm">요약 불러오는 중...</p>
                  </div>
                </div>
              ) : summaryError && !isGenerating && doneCount === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-md px-4">
                    <p className="text-red-600 mb-4">{summaryError}</p>
                    <button
                      onClick={loadOrGenerateSummaries}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                    >
                      다시 시도
                    </button>
                  </div>
                </div>
              ) : (
                <SummaryTabs
                  documentId={documentData.id}
                  slideSummarySlots={documentData.slideSummarySlots}
                  fullSummary={documentData.fullSummary}
                  currentSlide={currentSlide}
                  onSlideChange={setCurrentSlide}
                  storagePath={fileData.storage_path}
                  progress={{ doneCount, total: pageCount }}
                  onRetrySlide={handleRetrySlide}
                  onRegenerateSummaries={handleRegenerateSummaries}
                  isGenerating={isGenerating}
                />
              )}
            </div>
          </>
        ) : (
          /* 오디오 파일인 경우 */
          <div className="w-full bg-surface flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 mb-4">오디오 파일 재생 기능은 준비 중입니다.</p>
              <p className="text-sm text-gray-500">파일명: {fileData.name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AuthGuard>
      <DocumentContent params={params} />
    </AuthGuard>
  );
}

