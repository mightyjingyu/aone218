"use client";

import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { generateFullSummaryV2, fetchFullSummaryV2, generateMockProfessorEmphasis } from "@/lib/fullSummaryV2";
import type { FullSummaryV2, Topic } from "@/types/fullSummaryV2";
import { fetchFiles, FileMetadata } from "@/lib/files";
import { getCurrentUser } from "@/lib/auth";

interface FullSummaryViewV2Props {
  documentId: string;
  storagePath?: string;
}

export default function FullSummaryViewV2({ documentId, storagePath }: FullSummaryViewV2Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [fullSummary, setFullSummary] = useState<FullSummaryV2 | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set());
  const [useMockEmphasis, setUseMockEmphasis] = useState(false);
  const [fileData, setFileData] = useState<FileMetadata | null>(null);

  useEffect(() => {
    const stored = fetchFullSummaryV2(documentId);
    if (stored) setFullSummary(stored);
  }, [documentId]);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;
        const files = await fetchFiles(user.id);
        const file = files.find((f) => f.id === documentId);
        if (file) setFileData(file);
      } catch {
        // ignore
      }
    };
    load();
  }, [documentId]);

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      const mockEmphasis = useMockEmphasis ? generateMockProfessorEmphasis() : undefined;
      const result = await generateFullSummaryV2(documentId, {
        storagePath: storagePath || fileData?.storage_path,
        mockProfessorEmphasis: mockEmphasis,
      });
      setFullSummary(result);
    } catch (err: any) {
      console.error("전체 요약 실패:", err);
      alert(err.message || "전체 요약에 실패했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleTopicEmphasis = (topicIndex: number) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicIndex)) next.delete(topicIndex);
      else next.add(topicIndex);
      return next;
    });
  };

  if (!fullSummary && !isGenerating) {
    return (
      <div className="h-full flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-3">전체 요약을 생성해보세요</h3>
          <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
            PDF 텍스트를 분석하여 시험 대비에 최적화된 전체 요약을 생성합니다.
          </p>
          <div className="mb-4 flex items-center justify-center gap-2">
            <input
              type="checkbox"
              id="mock-emphasis"
              checked={useMockEmphasis}
              onChange={(e) => setUseMockEmphasis(e.target.checked)}
              className="w-4 h-4 text-primary border-border rounded focus:ring-primary bg-background"
            />
            <label htmlFor="mock-emphasis" className="text-sm text-[var(--text-secondary)]">
              Mock 교수님 강조 포인트 포함 (테스트용)
            </label>
          </div>
          <button
            onClick={handleGenerateSummary}
            className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium inline-flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            전체요약하기
          </button>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-foreground">전체 요약을 생성하고 있습니다...</p>
          <p className="text-sm text-[var(--text-secondary)] mt-2">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  if (!fullSummary) return null;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="bg-surface border-b border-border p-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">전체 요약</h2>
          <button
            onClick={handleGenerateSummary}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl hover:bg-black/5 transition-colors text-sm font-medium text-gray-900"
          >
            <RefreshCw className="w-4 h-4" />
            다시 생성
          </button>
        </div>
      </div>

      <div className="p-8 max-w-4xl mx-auto space-y-6 text-gray-900">
        <h1 className="text-4xl font-bold mb-6">요약</h1>

        <div className="space-y-4 mb-8">
          <p className="text-gray-800 leading-relaxed text-base whitespace-pre-line">
            {fullSummary.overview.summary}
          </p>
        </div>

        <div className="space-y-8">
          {fullSummary.topics.map((topic: Topic, topicIndex: number) => (
            <div key={topicIndex} className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">{topic.topic_title}</h2>

              <div className="space-y-3">
                {topic.slide_notes.map((note, noteIndex) => {
                  const boldMatch = note.match(/^\*\*(.+?):\*\*(.+)$/);
                  if (boldMatch) {
                    const [, keyword, content] = boldMatch;
                    return (
                      <div key={noteIndex} className="text-gray-800 text-base leading-relaxed">
                        <span className="font-semibold text-primary">{keyword}:</span>
                        <span className="text-gray-800">{content}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={noteIndex} className="text-gray-800 text-base leading-relaxed">
                      {note}
                    </div>
                  );
                })}
              </div>

              {topic.professor_emphasis.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <button
                    onClick={() => toggleTopicEmphasis(topicIndex)}
                    className="w-full flex items-center justify-start text-left hover:bg-black/5 rounded-lg p-2 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-secondary)]">쉬운 설명</span>
                      <ChevronDown
                        className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${expandedTopics.has(topicIndex) ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>
                  {expandedTopics.has(topicIndex) && (
                    <div className="mt-3 space-y-3 pl-7">
                      {topic.professor_emphasis.map((emphasis, empIndex) => (
                        <div key={empIndex} className="text-[var(--text-secondary)] text-sm leading-relaxed">
                          {emphasis.point && <p className="mb-1 text-gray-800">{emphasis.point}</p>}
                          {emphasis.context && <p className="text-gray-600">{emphasis.context}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {fullSummary.final_exam_takeaways.length > 0 && (
          <div className="mt-8 pt-8 border-t border-border">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">시험 대비 핵심 포인트</h2>
            <div className="space-y-3">
              {fullSummary.final_exam_takeaways.map((takeaway, index) => (
                <div key={index} className="text-gray-800 text-base leading-relaxed">
                  {takeaway}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-600 text-center pt-4 border-t border-border mt-8">
          <p>
            생성 시간: {new Date(fullSummary.meta.generated_at).toLocaleString("ko-KR")} | PDF 사용:{" "}
            {fullSummary.meta.source.pdf_used ? "예" : "아니오"} | 교수님 음성 사용:{" "}
            {fullSummary.meta.source.professor_speech_used ? "예" : "아니오"}
          </p>
        </div>
      </div>
    </div>
  );
}
