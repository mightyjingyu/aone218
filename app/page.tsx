"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { getCurrentUser } from "@/lib/auth";
import {
  Unlink,
  FolderX,
  CloudUpload,
  Brain,
  BadgeCheck,
  BookOpen,
  Mic,
  HelpCircle,
  FolderTree,
  MessageCircle,
  Eraser,
  ArrowRight,
  Globe,
  Mail,
  ChevronDown,
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const checkAuthAndRedirect = async () => {
    setCheckingAuth(true);
    try {
      const user = await Promise.race([
        getCurrentUser(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (user) router.push("/dashboard");
      else router.push("/login");
    } catch {
      router.push("/login");
    } finally {
      setCheckingAuth(false);
    }
  };

  return (
    <div className="min-h-screen h-screen overflow-y-auto overflow-x-hidden bg-white text-neutral-900 antialiased selection:bg-neutral-900 selection:text-white">
      {/* Navigation — Liquid glass, 스크롤 시 더 불투명 */}
      <header className={`sticky top-0 z-50 w-full landing-glass-nav ${navScrolled ? "scrolled" : ""}`}>
        <div className="max-w-6xl mx-auto px-6 lg:px-8 h-14 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-neutral-900 flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
              <span className="text-white font-bold text-lg italic">A</span>
            </div>
            <span className="text-[17px] font-semibold tracking-tight text-neutral-900">에이원</span>
          </a>
          <nav className="hidden md:flex items-center gap-8">
            <a className="text-[13px] font-medium text-neutral-600 hover:text-neutral-900 transition-colors" href="#problem">문제 제기</a>
            <a className="text-[13px] font-medium text-neutral-600 hover:text-neutral-900 transition-colors" href="#solution">학습 프로세스</a>
            <a className="text-[13px] font-medium text-neutral-600 hover:text-neutral-900 transition-colors" href="#features">핵심 기능</a>
            <button
              onClick={checkAuthAndRedirect}
              disabled={checkingAuth}
              className="landing-cta-black px-5 py-2.5 text-[13px] font-semibold disabled:opacity-50"
            >
              무료로 시작하기
            </button>
          </nav>
          <button
            onClick={checkAuthAndRedirect}
            disabled={checkingAuth}
            className="md:hidden landing-cta-black px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
          >
            시작하기
          </button>
        </div>
      </header>

      <main>
        {/* Hero — 중앙 정렬, 오른쪽 목업 제거 */}
        <section className="relative pt-16 pb-28 md:pt-24 md:pb-36 overflow-hidden bg-white landing-hero-glow">
          <div className="max-w-3xl mx-auto px-6 lg:px-8 flex flex-col items-center text-center relative z-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500 mb-6">
              University AI Learning Partner
            </p>
            <h1 className="text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-bold leading-[1.08] tracking-tight text-neutral-900 mb-6">
              에이원
              <br />
              <span className="text-neutral-900">A+를 위한 단 한가지 선택</span>
            </h1>
            <p className="text-lg md:text-xl text-neutral-500 leading-relaxed mb-10">
              강의 녹음과 학습자료를 통합해 시험 맞춤형 학습 시스템을 구축하는 AI 플랫폼
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={checkAuthAndRedirect}
                disabled={checkingAuth}
                className="landing-cta-black px-8 py-4 text-base font-semibold disabled:opacity-50"
              >
                무료 체험해보기
              </button>
            </div>
          </div>
          <a href="#problem" className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-neutral-400 hover:text-neutral-600 transition-colors">
            <span className="text-[10px] font-medium uppercase tracking-widest">Scroll</span>
            <ChevronDown className="size-5 animate-bounce" strokeWidth={2} />
          </a>
        </section>

        {/* Problem — 섹션 구분감 + glass 카드 */}
        <section className="py-20 md:py-28 landing-section-subtle" id="problem">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14 md:mb-20">
              <h2 className="text-[1.75rem] md:text-[2.25rem] font-bold tracking-tight text-neutral-900 mb-3">
                왜 시험 준비는 여전히 비효율적인가?
              </h2>
              <p className="text-neutral-500 text-base md:text-lg">
                통합되지 않은 자료와 파편화된 공부 방식이 여러분의 성적 향상을 방해하고 있습니다.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 md:gap-8">
              <div className="landing-glass-card p-8 md:p-10 group">
                <div className="size-12 rounded-2xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300 border border-neutral-200/60">
                  <Unlink className="size-6" strokeWidth={1.8} />
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-3 text-neutral-900">통합 요약의 부재</h3>
                <p className="text-neutral-500 text-[15px] leading-relaxed">
                  교수님의 강의 녹음본과 PDF 강의안이 따로 놀아 맥락 파악이 어렵습니다. 시험 전, 녹음 파일 어디에서 해당 내용을 말했는지 찾는 데에만 수시간을 낭비하고 계시진 않나요?
                </p>
              </div>
              <div className="landing-glass-card p-8 md:p-10 group">
                <div className="size-12 rounded-2xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300 border border-neutral-200/60">
                  <FolderX className="size-6" strokeWidth={1.8} />
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-3 text-neutral-900">파편화된 학습 자료</h3>
                <p className="text-neutral-500 text-[15px] leading-relaxed">
                  시험 직전, 정리되지 않은 수많은 자료들이 폴더마다 흩어져 있습니다. 단순히 &apos;자료를 모으는 것&apos;과 &apos;학습 가능한 시스템&apos;으로 만드는 것은 완전히 다른 영역입니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Solution — 3단계, glass 카드 + 검정 스텝 */}
        <section className="py-20 md:py-28 bg-white" id="solution">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14 md:mb-20">
              <h2 className="text-[1.75rem] md:text-[2.25rem] font-bold tracking-tight text-neutral-900 mb-3">
                강의를 하나의 시험 대비 시스템으로
              </h2>
              <p className="text-neutral-500 text-base md:text-lg">
                에이원의 지능형 프로세스는 단순 정리를 넘어 승리하는 학습 환경을 구축합니다.
              </p>
            </div>
            <div className="relative">
              <div className="hidden lg:block absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-neutral-200 to-transparent -translate-y-1/2 z-0" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 relative z-10">
                {[
                  { icon: CloudUpload, step: "01", label: "강의 자료 통합", title: "업로드", desc: "강의 녹음과 PDF를 한 번에 업로드합니다." },
                  { icon: Brain, step: "02", label: "시험 맞춤 구조화", title: "자동 정리", desc: "슬라이드·강조 내용·필기를 통합해 시험 대비 요약을 생성합니다." },
                  { icon: BadgeCheck, step: "03", label: "시험 대비 시스템 완성", title: "완성", desc: "족보와 질문 기능까지 포함된 학습 시스템이 완성됩니다." },
                ].map(({ icon: Icon, step, label, title, desc }) => (
                  <div key={step} className="landing-glass-card flex flex-col items-center text-center py-8 px-6">
                    <div className="size-16 md:size-20 rounded-full bg-neutral-900 text-white flex items-center justify-center mb-5 shadow-[0_4px_20px_rgba(0,0,0,0.15)] ring-4 ring-white">
                      <Icon className="size-8 md:size-9" strokeWidth={1.6} />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500 mb-1">{step}</span>
                    <span className="text-xs font-bold text-neutral-700 mb-3">{label}</span>
                    <h4 className="text-lg font-bold mb-2 text-neutral-900">{title}</h4>
                    <p className="text-neutral-500 text-[13px] leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features — 그리드 + glass 카드 */}
        <section className="py-20 md:py-28 landing-section-subtle" id="features">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 md:mb-16">
              <div className="max-w-xl">
                <h2 className="text-[1.75rem] md:text-[2.25rem] font-bold tracking-tight text-neutral-900 mb-3">
                  학습의 질을 바꾸는 핵심 기능
                </h2>
                <p className="text-neutral-500 text-base">
                  불필요한 반복을 제거하고 오직 성과에만 집중할 수 있도록 설계되었습니다.
                </p>
              </div>
              <button
                onClick={checkAuthAndRedirect}
                className="landing-glass-btn inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-neutral-700 shrink-0"
              >
                전체 기능 보기 <ArrowRight className="size-4" strokeWidth={2} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {[
                { icon: BookOpen, title: "슬라이드 흐름 기반 요약 생성", desc: "강의 슬라이드 순서에 맞춰 핵심 내용을 재구성해 논리 흐름이 유지된 요약본을 생성합니다." },
                { icon: Mic, title: "교수 강조 내용 자동 반영", desc: "녹음 데이터를 분석해 교수의 반복·강조 표현을 식별하고 중요 개념에 가중치를 부여합니다." },
                { icon: HelpCircle, title: "시험 대비 족보 자동 생성", desc: "학습 데이터를 기반으로 예상 문제, 핵심 서술 포인트, 모범 답안 구조를 자동 생성합니다." },
                { icon: FolderTree, title: "강의 자료 통합 관리 시스템", desc: "녹음·PDF·필기를 하나의 폴더 트리 구조로 통합 관리해 과목별 학습 흐름을 체계화합니다." },
                { icon: MessageCircle, title: "생성 자료 기반 질의응답", desc: "생성된 학습자료를 바탕으로 개념 질문을 하면 강의 맥락에 맞는 답변을 제공합니다." },
                { icon: Eraser, title: "중복 정리 자동 제거", desc: "슬라이드, 녹음, 필기에서 중복되는 내용을 통합 정리해 불필요한 반복 학습을 줄입니다." },
              ].map((item, i) => (
                <div key={i} className="landing-glass-card p-6 md:p-8">
                  <item.icon className="size-7 md:size-8 mb-5 text-neutral-800" strokeWidth={1.5} />
                  <h4 className="text-base md:text-lg font-bold mb-2 text-neutral-900">{item.title}</h4>
                  <p className="text-neutral-500 text-[13px] md:text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA — 마무리 메시지 */}
        <section className="py-24 md:py-32 bg-white relative overflow-hidden landing-hero-glow">
          <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center relative z-10">
            <h2 className="text-[2rem] md:text-[2.75rem] lg:text-[3.25rem] font-bold leading-[1.15] tracking-tight text-neutral-900 mb-5">
              요약이 아니라,<br />
              학습 시스템입니다.
            </h2>
            <p className="text-lg md:text-xl text-neutral-500 mb-10 leading-relaxed">
              에이원은 강의를 시험 성과로 연결하는 통합 AI 학습 플랫폼입니다.<br className="hidden md:block" />
              지금 바로 에이원과 함께 최고의 학기를 준비하세요.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={checkAuthAndRedirect}
                disabled={checkingAuth}
                className="w-full sm:w-auto landing-cta-black px-10 py-5 text-lg font-semibold disabled:opacity-50"
              >
                무료로 시작하기
              </button>
              <button className="w-full sm:w-auto landing-glass-btn px-10 py-5 text-lg font-semibold text-neutral-800">
                엔터프라이즈 문의
              </button>
            </div>
            <p className="mt-8 text-neutral-400 text-[13px]">별도의 카드 정보 없이 14일간 모든 기능을 체험해보세요.</p>
          </div>
        </section>
      </main>

      {/* Footer — 컴팩트, 구분선 */}
      <footer className="bg-white border-t border-neutral-200/80 py-12 md:py-14">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-neutral-900 flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
                  <span className="text-white font-bold text-lg italic">A</span>
                </div>
                <span className="text-[17px] font-semibold tracking-tight text-neutral-900">에이원</span>
              </div>
              <p className="text-neutral-500 text-[13px] max-w-xs leading-relaxed">
                AI를 통해 학습의 표준을 바꿉니다. 대학생을 위한 성적 향상 도구.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <div className="flex flex-col gap-2">
                <h4 className="font-semibold text-[13px] text-neutral-900">Product</h4>
                <a className="text-neutral-500 text-[13px] hover:text-neutral-900 transition-colors" href="#features">Features</a>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="font-semibold text-[13px] text-neutral-900">Company</h4>
                <a className="text-neutral-500 text-[13px] hover:text-neutral-900 transition-colors" href="#">Terms</a>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="font-semibold text-[13px] text-neutral-900">Support</h4>
                <a className="text-neutral-500 text-[13px] hover:text-neutral-900 transition-colors" href="#">Contact</a>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-neutral-200/60 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-neutral-400 text-[12px]">© 2024 Aone. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <a className="text-neutral-400 hover:text-neutral-600 transition-colors" href="#" aria-label="Language"><Globe className="size-4" /></a>
              <a className="text-neutral-400 hover:text-neutral-600 transition-colors" href="#" aria-label="Contact"><Mail className="size-4" /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
