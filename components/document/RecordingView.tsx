"use client";

import { useState, useRef } from "react";
import { Mic, Square, Play, Pause, Trash2, Download, Clock } from "lucide-react";

interface RecordingViewProps {
  documentId: string;
  storagePath?: string;
}

interface Recording {
  id: string;
  name: string;
  duration: number;
  size: number;
  createdAt: Date;
}

export default function RecordingView({ documentId, storagePath }: RecordingViewProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  const formatFileSize = (bytes: number) => {
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    return `${mb} MB`;
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 5400) { // 90분
          stopRecording();
          return prev;
        }
        if (prev >= 5100) { // 85분 경고
          // 경고 표시
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // 녹음 파일 저장
    const newRecording: Recording = {
      id: Date.now().toString(),
      name: `녹음파일 ${recordings.length + 1}`,
      duration: recordingTime,
      size: recordingTime * 32000, // 임시 계산
      createdAt: new Date(),
    };
    setRecordings(prev => [...prev, newRecording]);
    setRecordingTime(0);
  };

  const togglePlay = (id: string) => {
    setPlayingId(prev => prev === id ? null : id);
  };

  const deleteRecording = (id: string) => {
    setRecordings(prev => prev.filter(r => r.id !== id));
    if (playingId === id) {
      setPlayingId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background text-white">
      {/* 녹음 컨트롤 */}
      <div className="border-b border-border bg-surface p-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-lg font-bold text-white mb-4">강의 녹음</h2>
          
          <div className="bg-surface rounded-xl p-8 text-center border border-border">
            {!isRecording ? (
              <>
                <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4 hover:bg-red-600 transition-colors cursor-pointer" onClick={startRecording}>
                  <Mic className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  녹음 시작하기
                </h3>
                <p className="text-sm text-gray-400">
                  최대 90분까지 녹음 가능합니다
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Mic className="w-10 h-10 text-white" />
                </div>
                <div className="text-4xl font-bold text-red-400 mb-4">
                  {formatTime(recordingTime)}
                </div>
                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-surface text-white rounded-lg hover:bg-white/10 border border-border transition-colors inline-flex items-center gap-2"
                >
                  <Square className="w-5 h-5" />
                  녹음 완료
                </button>
                <p className="text-xs text-gray-500 mt-4">
                  {recordingTime >= 5100 && "⚠️ 85분이 지났습니다. 곧 자동으로 중지됩니다."}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 녹음 목록 */}
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold text-white mb-4">
            녹음 파일 ({recordings.length})
          </h3>

          {recordings.length === 0 ? (
            <div className="bg-surface rounded-xl border border-border p-12 text-center">
              <Clock className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">아직 녹음된 파일이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="bg-surface rounded-xl border border-border p-4 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => togglePlay(recording.id)}
                      className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors flex-shrink-0"
                    >
                      {playingId === recording.id ? (
                        <Pause className="w-5 h-5 text-primary" />
                      ) : (
                        <Play className="w-5 h-5 text-primary" />
                      )}
                    </button>

                    <div className="flex-1">
                      <input
                        type="text"
                        value={recording.name}
                        onChange={(e) => {
                          setRecordings(prev =>
                            prev.map(r =>
                              r.id === recording.id
                                ? { ...r, name: e.target.value }
                                : r
                            )
                          );
                        }}
                        className="font-medium text-white bg-transparent border-none focus:outline-none focus:ring-0 w-full placeholder:text-gray-500"
                      />
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-gray-400">
                          {formatDuration(recording.duration)}
                        </span>
                        <span className="text-sm text-gray-500">•</span>
                        <span className="text-sm text-gray-400">
                          {formatFileSize(recording.size)}
                        </span>
                        <span className="text-sm text-gray-500">•</span>
                        <span className="text-sm text-gray-400">
                          {recording.createdAt.toLocaleTimeString('ko-KR')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <Download className="w-5 h-5 text-gray-400" />
                      </button>
                      <button
                        onClick={() => deleteRecording(recording.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5 text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* 재생 진행 바 */}
                  {playingId === recording.id && (
                    <div className="mt-4">
                      <div className="h-1 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-1/3 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {recordings.length > 0 && (
            <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/30">
              <p className="text-sm text-white">
                💡 <strong>팁:</strong> 전체 요약을 생성할 때 사용할 녹음 파일을 선택할 수 있습니다.
                선택되지 않은 파일은 30일 후 자동으로 삭제됩니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

