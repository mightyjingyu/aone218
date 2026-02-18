"use client";

import { useEffect, useMemo, useState } from "react";
import TipTapEditor from "@/components/document/TipTapEditor";
import { fetchFolderSummary, tiptapToText } from "@/lib/folderSummaries";
import { fetchFolderQuestions, appendFolderQuestions, FolderQuestionsHistoryEntry } from "@/lib/folderQuestions";
import { Loader2, Upload, Sparkles, XCircle, Clock3 } from "lucide-react";

interface FolderQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  folderName: string;
}

interface GeneratedQuestion {
  question: string;
  answer?: string;
  difficulty?: string;
}

export default function FolderQuestionsModal({
  isOpen,
  onClose,
  folderId,
  folderName,
}: FolderQuestionsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestion[] | null>(null);
  const [jokboText, setJokboText] = useState("");
  const [jokboFileName, setJokboFileName] = useState<string | null>(null);
  const [summaryContent, setSummaryContent] = useState<any>(null);
  const [hasSummary, setHasSummary] = useState(false);
  const [history, setHistory] = useState<FolderQuestionsHistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const summary = await fetchFolderSummary(folderId);
        if (cancelled) return;
        if (summary?.content) {
          setSummaryContent(summary.content);
          setHasSummary(true);
        } else {
          setHasSummary(false);
        }
      } catch {
        if (!cancelled) setHasSummary(false);
      }
      try {
        const prev = await fetchFolderQuestions(folderId);
        if (cancelled) return;
        if (prev?.history?.length) {
          setHistory(prev.history);
          const last = prev.history[prev.history.length - 1];
          setSelectedHistoryId(last.id);
          setQuestions(last.questions);
          setJokboText(last.jokbo_text || "");
        } else {
          setHistory([]);
          setSelectedHistoryId(null);
          setQuestions(null);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, folderId]);

  useEffect(() => {
    if (!isOpen) {
      setQuestions(null);
      setError(null);
      setJokboText("");
      setJokboFileName(null);
      setHistory([]);
      setSelectedHistoryId(null);
    }
  }, [isOpen]);

  const summaryText = useMemo(() => tiptapToText(summaryContent || "").trim(), [summaryContent]);

  const handleFileChange = (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("파일 용량이 2MB를 초과했습니다. 텍스트 파일만 사용해 주세요.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setJokboText(String(reader.result || "").trim());
      setJokboFileName(file.name);
      setError(null);
    };
    reader.onerror = () => setError("파일을 읽지 못했습니다.");
    reader.readAsText(file);
  };

  const handleGenerate = async () => {
    setError(null);
    setQuestions(null);
    if (!hasSummary || !summaryText) {
      setError("폴더 전체 요약이 없습니다. 먼저 폴더 전체 요약하기를 실행해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderName,
          folderSummaryText: summaryText,
          jokboText: jokboText.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.details || `문제 생성 실패 (HTTP ${res.status})`);
      }
      const data = await res.json();
      const qs = Array.isArray(data?.questions) ? data.questions : null;
      if (!qs || qs.length === 0) throw new Error("생성된 문제가 없습니다.");
      setQuestions(qs);

      const entry: FolderQuestionsHistoryEntry = {
        id: `${folderId}-${Date.now()}`,
        created_at: new Date().toISOString(),
        questions: qs,
        jokbo_text: jokboText.trim(),
      };
      const saved = await appendFolderQuestions(folderId, entry);
      setHistory(saved.history);
      setSelectedHistoryId(entry.id);
    } catch (err: any) {
      setError(err?.message || "문제 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-[min(950px,95vw)] max-h-[90vh] overflow-hidden rounded-2xl border border-glass-border bg-glass-surface backdrop-blur-xl shadow-2xl">
        <div className="p-5 border-b border-glass-border flex items-center justify-between">
          <div>
            <div className="text-white font-bold text-lg">{folderName} · 폴더 족보</div>
            <div className="text-xs text-text-secondary mt-1">
              폴더 전체 요약 {hasSummary ? "확인됨" : "없음"} · 족보는 선택 입력(없으면 건너뜀)
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-background border border-border text-white hover:bg-secondary transition-colors text-sm font-semibold"
          >
            닫기
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5 overflow-y-auto max-h-[calc(90vh-72px)]">
          <div className="space-y-3">
            <div className="text-sm text-white font-semibold">폴더 전체 요약 (읽기전용)</div>
            <div className="rounded-xl border border-glass-border bg-glass-100 p-3">
              {hasSummary ? (
                <div className="tiptap-readonly-dark">
                  <TipTapEditor content={summaryContent} onChange={() => { }} editable={false} dark />
                </div>
              ) : (
                <div className="text-text-secondary text-sm">
                  폴더 전체 요약이 없습니다. <b>폴더 전체 요약하기</b>를 먼저 실행해 주세요.
                </div>
              )}
            </div>

            <div className="text-sm text-white font-semibold">족보 텍스트 (선택)</div>
            <textarea
              className="w-full min-h-[140px] rounded-xl border border-glass-border bg-glass-100 text-white p-3 text-sm placeholder:text-gray-500 focus:bg-glass-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="족보 텍스트를 붙여넣거나, 텍스트 파일(.txt/.md)을 업로드하세요."
              value={jokboText}
              onChange={(e) => setJokboText(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-glass-surface border border-glass-border rounded-lg text-white hover:bg-white/10 transition-colors text-sm">
                <Upload className="w-4 h-4" />
                텍스트 파일 업로드
                <input
                  type="file"
                  accept=".txt,.md,.csv,.tsv,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(file);
                  }}
                />
              </label>
              {jokboFileName && <span className="text-text-secondary text-xs truncate">업로드: {jokboFileName}</span>}
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/40 rounded-lg p-3">
                <XCircle className="w-4 h-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading || !hasSummary}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "문제 생성 중..." : "문제 만들기"}
            </button>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-white font-semibold">생성된 문제</div>
            <div className="rounded-xl border border-glass-border bg-glass-100 p-3 min-h-[320px]">
              {history.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 text-xs">
                  {history.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => {
                        setSelectedHistoryId(h.id);
                        setQuestions(h.questions);
                        setJokboText(h.jokbo_text || "");
                      }}
                      className={`px-3 py-1 rounded-lg border ${selectedHistoryId === h.id ? "border-primary text-primary bg-primary/10" : "border-border text-text-secondary hover:bg-white/5"
                        }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="w-3 h-3" />
                        {new Date(h.created_at).toLocaleString("ko-KR")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {!questions && !loading && (
                <div className="text-text-secondary text-sm">
                  왼쪽에서 <b>문제 만들기</b>를 실행하면 여기에 5개 문항이 표시됩니다.
                </div>
              )}
              {loading && (
                <div className="flex items-center gap-2 text-text-secondary text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  문제를 생성하고 있습니다...
                </div>
              )}
              {questions && !loading && (
                <div className="space-y-4 text-sm text-white">
                  {questions.map((q, idx) => (
                    <div key={idx} className="border border-glass-border rounded-lg p-3 bg-glass-card/30">
                      <div className="text-primary font-semibold mb-1">
                        Q{idx + 1} {q.difficulty ? `· ${q.difficulty}` : ""}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">{q.question}</div>
                      {q.answer && (
                        <div className="mt-2 text-text-secondary">
                          <span className="font-semibold text-white">정답:</span> {q.answer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
