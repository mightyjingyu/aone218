"use client";

import { useState } from "react";
import SlideSummaryView from "./SlideSummaryView";
import FullSummaryViewV2 from "./FullSummaryViewV2";
import RecordingView from "./RecordingView";
import AITutorView from "./AITutorView";
import type { SlideSummarySlot } from "@/app/document/[id]/page";

interface SummaryTabsProps {
  documentId: string;
  slideSummarySlots: SlideSummarySlot[];
  fullSummary: any;
  currentSlide: number;
  onSlideChange: (slide: number) => void;
  storagePath?: string;
  progress?: { doneCount: number; total: number };
  onRetrySlide?: (slideNumber: number) => void;
  onRegenerateSummaries?: () => void;
  isGenerating?: boolean;
}

type TabType = "slide" | "full" | "recording" | "tutor";

export default function SummaryTabs({
  documentId,
  slideSummarySlots,
  fullSummary,
  currentSlide,
  onSlideChange,
  storagePath,
  progress,
  onRetrySlide,
  onRegenerateSummaries,
  isGenerating,
}: SummaryTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("slide");

  const tabs = [
    { id: "slide" as TabType, label: "슬라이드별 요약" },
    { id: "full" as TabType, label: "전체 요약" },
    { id: "recording" as TabType, label: "녹음" },
    { id: "tutor" as TabType, label: "AI 튜터" },
  ];

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* 탭 헤더 */}
      <div className="border-b border-border bg-sidebar">
        <div className="flex items-center justify-between">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-6 py-3 font-medium text-sm transition-colors relative
                  ${activeTab === tab.id
                    ? "text-primary border-b-2 border-primary bg-background/50"
                    : "text-[var(--text-secondary)] hover:text-foreground"
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {onRegenerateSummaries && activeTab === "slide" && (
            <button
              type="button"
              onClick={onRegenerateSummaries}
              disabled={isGenerating}
              className="mr-3 px-3 py-1.5 text-xs font-medium text-primary border border-primary/50 rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              슬라이드 요약 다시 생성
            </button>
          )}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-hidden bg-background">
        {activeTab === "slide" && (
          <SlideSummaryView
            documentId={documentId}
            slideSummarySlots={slideSummarySlots}
            currentSlide={currentSlide}
            onSlideChange={onSlideChange}
            progress={progress}
            onRetrySlide={onRetrySlide}
          />
        )}
        {activeTab === "full" && (
          <FullSummaryViewV2 documentId={documentId} storagePath={storagePath} />
        )}
        {activeTab === "recording" && (
          <RecordingView documentId={documentId} storagePath={storagePath} />
        )}
        {activeTab === "tutor" && (
          <AITutorView documentId={documentId} fullSummary={fullSummary} />
        )}
      </div>
    </div>
  );
}

