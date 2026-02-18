"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, ChevronUp, Play, RefreshCw } from "lucide-react";
import TipTapEditor from "./TipTapEditor";
import { updateSlideSummary } from "@/lib/slideSummaries";
import type { SlideSummarySlot } from "@/app/document/[id]/page";

interface SlideSummaryViewProps {
  documentId: string;
  slideSummarySlots: SlideSummarySlot[];
  currentSlide: number;
  onSlideChange: (slide: number) => void;
  progress?: { doneCount: number; total: number };
  onRetrySlide?: (slideNumber: number) => void;
}

export default function SlideSummaryView({
  documentId,
  slideSummarySlots,
  currentSlide,
  onSlideChange,
  progress,
  onRetrySlide,
}: SlideSummaryViewProps) {
  const [expandedAudio, setExpandedAudio] = useState<number | null>(null);
  const [saving, setSaving] = useState<{ [key: number]: boolean }>({});
  const saveTimeouts = useRef<{ [key: number]: NodeJS.Timeout }>({});
  const slideRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // 현재 슬라이드 변경 시 해당 요약으로 스크롤
  useEffect(() => {
    const slideRef = slideRefs.current[currentSlide];
    if (slideRef) {
      slideRef.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [currentSlide]);

  const [localSlots, setLocalSlots] = useState<SlideSummarySlot[]>(slideSummarySlots);
  useEffect(() => {
    setLocalSlots(slideSummarySlots);
  }, [slideSummarySlots]);

  const handleSummaryChange = useCallback((slideNumber: number, content: any) => {
    setLocalSlots(prev =>
      prev.map(s =>
        s.slideNumber === slideNumber
          ? { ...s, summaryContent: content }
          : s
      )
    );

    if (saveTimeouts.current[slideNumber]) clearTimeout(saveTimeouts.current[slideNumber]);
    saveTimeouts.current[slideNumber] = setTimeout(async () => {
      setSaving(prev => ({ ...prev, [slideNumber]: true }));
      try {
        await updateSlideSummary(documentId, slideNumber, content);
      } catch (err) {
        console.error("요약 저장 실패:", err);
        alert("요약 저장에 실패했습니다.");
      } finally {
        setSaving(prev => ({ ...prev, [slideNumber]: false }));
        delete saveTimeouts.current[slideNumber];
      }
    }, 1000);
  }, [documentId]);

  const toggleAudio = (slideNumber: number) => {
    setExpandedAudio(prev => prev === slideNumber ? null : slideNumber);
  };

  const isGenerating = progress && progress.doneCount < progress.total;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 진행률 (생성 중일 때만) */}
      {isGenerating && progress && (
        <div className="shrink-0 px-4 py-2 border-b border-border bg-sidebar">
          <p className="text-xs text-gray-400 mb-1">
            슬라이드 요약 생성 중 ({progress.doneCount}/{progress.total})
          </p>
          <div className="h-1.5 bg-background rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(progress.doneCount / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-background">
        <div className="p-4 space-y-3">
          {localSlots.map((slot) => (
            <div
              key={slot.slideNumber}
              ref={(el) => { slideRefs.current[slot.slideNumber] = el; }}
              className={`
                bg-surface rounded-xl border-2 transition-all border-border
                ${currentSlide === slot.slideNumber 
                  ? "border-primary bg-primary/10 shadow-md cursor-pointer" 
                  : "hover:border-primary/50 cursor-pointer"
                }
              `}
              onClick={() => onSlideChange(slot.slideNumber)}
            >
              <div className="p-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      currentSlide === slot.slideNumber ? "bg-primary text-white" : "bg-background text-gray-400"
                    }`}>
                      <span className="text-xs font-bold">{slot.slideNumber}</span>
                    </div>
                    <h3 className="font-medium text-sm text-white">Slide {slot.slideNumber}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {saving[slot.slideNumber] && <span className="text-xs text-gray-500">저장 중...</span>}
                    {currentSlide === slot.slideNumber && <div className="w-2 h-2 bg-primary rounded-full" />}
                  </div>
                </div>
              </div>

              <div className="p-3" onClick={(e) => e.stopPropagation()}>
                {slot.status === 'loading' || slot.status === 'idle' ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/10 rounded w-full" />
                    <div className="h-3 bg-white/10 rounded w-5/6" />
                    <div className="h-3 bg-white/10 rounded w-4/5" />
                  </div>
                ) : slot.status === 'error' ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-red-400">{slot.errorMessage || '요약 생성 실패'}</p>
                    {onRetrySlide && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRetrySlide(slot.slideNumber); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/20 text-primary rounded-lg hover:bg-primary/30"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> 재시도
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <TipTapEditor
                      content={slot.summaryContent}
                      onChange={(content) => handleSummaryChange(slot.slideNumber, content)}
                      placeholder="AI 요약 내용을 수정하거나 추가할 수 있습니다..."
                      editable={true}
                      dark={true}
                    />
                    {slot.audioSegments && slot.audioSegments.length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleAudio(slot.slideNumber); }}
                          className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                        >
                          {expandedAudio === slot.slideNumber ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          교수님 설명
                        </button>
                        {expandedAudio === slot.slideNumber && (
                          <div className="mt-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                            <div className="flex items-start gap-2">
                              <button className="p-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-full transition-colors">
                                <Play className="w-3 h-3" />
                              </button>
                              <div className="flex-1">
                                <p className="text-xs text-white leading-relaxed">교수님 음성 구간의 정제된 텍스트가 여기에 표시됩니다.</p>
                                <div className="mt-1 text-xs text-gray-500"><span>00:12:34 - 00:15:22</span></div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
