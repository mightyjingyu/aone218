"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, ExternalLink } from "lucide-react";

interface FullSummaryViewProps {
  fullSummary: any;
  documentId: string;
}

export default function FullSummaryView({ fullSummary, documentId }: FullSummaryViewProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    // API 호출 시뮬레이션
    setTimeout(() => {
      setIsGenerating(false);
    }, 3000);
  };

  if (!fullSummary && !isGenerating) {
    return (
      <div className="h-full flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-white mb-3">
            전체 요약을 생성해보세요
          </h3>
          <p className="text-gray-400 mb-6 leading-relaxed">
            슬라이드별 요약과 교수님의 음성 녹음을 바탕으로
            <br />
            문서 전체의 핵심 내용을 요약해드립니다.
          </p>
          <button
            onClick={handleGenerateSummary}
            className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium inline-flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            전체요약하기
          </button>
          <p className="text-xs text-gray-500 mt-4">
            녹음 파일이 있다면 교수님 설명을 70% 반영합니다
          </p>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">전체 요약을 생성하고 있습니다...</p>
          <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  // 전체 요약이 있는 경우
  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* 헤더 */}
      <div className="bg-surface border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">전체 요약</h2>
              <p className="text-sm text-gray-500">AI가 생성한 문서 전체 요약</p>
            </div>
          </div>
          <button
            onClick={handleGenerateSummary}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl hover:bg-white/5 transition-colors text-sm font-medium text-white"
          >
            <RefreshCw className="w-4 h-4" />
            다시 생성
          </button>
        </div>
      </div>

      {/* 요약 내용 */}
      <div className="p-6">
        <div className="bg-surface rounded-xl border border-border p-8">
          <div className="prose prose-invert max-w-none">
            <h3 className="text-xl font-bold text-white mb-4">
              Design Patterns 개요
            </h3>
            
            <p className="text-white/90 leading-relaxed mb-4">
              본 강의에서는 소프트웨어 설계에서 <span className="highlight">자주 발생하는 문제에 대한 전형적인 해결책</span>인 
              디자인 패턴(Design Pattern)의 개념과 해결책을 다룹니다.
            </p>

            <div className="flex items-center gap-2 my-4">
              <button className="px-3 py-1 bg-primary/20 text-primary rounded-lg text-sm font-medium hover:bg-primary/30 transition-colors inline-flex items-center gap-1">
                Slide 3
                <ExternalLink className="w-3 h-3" />
              </button>
              <button className="px-3 py-1 bg-primary/20 text-primary rounded-lg text-sm font-medium hover:bg-primary/30 transition-colors inline-flex items-center gap-1">
                Slide 4
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <h4 className="text-lg font-semibold text-white mt-6 mb-3">
              디자인 패턴의 세 가지 분류
            </h4>

            <p className="text-white/90 leading-relaxed mb-4">
              <span className="highlight">디자인 패턴은 크게 세 가지로 분류됩니다: 생성(Creational), 구조(Structural), 행위(Behavioral)</span>
            </p>

            <ul className="list-disc list-inside space-y-2 text-white/90 mb-4">
              <li><strong>생성 패턴 (Creational):</strong> 객체 생성 메커니즘을 다루며, Factory Method, Abstract Factory, Builder, Prototype, Singleton 등이 포함됩니다.</li>
              <li><strong>구조 패턴 (Structural):</strong> 클래스와 객체를 조합하여 더 큰 구조를 만드는 방법을 다룹니다.</li>
              <li><strong>행위 패턴 (Behavioral):</strong> 객체들 간의 책임 분배와 알고리즘을 캡슐화하는 방법을 다룹니다.</li>
            </ul>

            <div className="bg-primary/10 border-l-4 border-primary p-4 my-6 rounded-r-lg">
              <p className="text-sm text-white/90">
                <strong>💡 교수님 강조:</strong> 디자인 패턴은 특정 프로그램 구조, 비헤이비어럴은 특정 동작 수행 시 효율적인 구조에 대한 것입니다.
              </p>
            </div>

            <p className="text-xs text-gray-500 mt-8">
              마지막 업데이트: 2025년 12월 27일
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



