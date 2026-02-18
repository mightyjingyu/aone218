"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 페이지 로드 시 비밀번호 필드 초기화 (자동완성 방지)
  useEffect(() => {
    // 비밀번호 필드가 자동으로 채워지는 것을 방지
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.setAttribute('autocomplete', 'new-password');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn(email, password);
      
      if (result?.session) {
        // 세션이 쿠키에 저장될 시간을 충분히 주기
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 세션 재확인 (여러 번 시도)
        let session = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!session && attempts < maxAttempts) {
          const { data, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('세션 확인 에러:', sessionError);
            setError(`세션 확인 실패: ${sessionError.message}`);
            return;
          }
          
          if (data?.session) {
            session = data.session;
            break;
          }
          
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        if (session) {
          // 로그인 성공 시 대시보드로 이동
          // window.location.href를 사용하여 완전한 페이지 리로드
          window.location.href = "/dashboard";
        } else {
          setError("세션이 저장되지 않았습니다. 브라우저 쿠키 설정을 확인해주세요.");
        }
      } else {
        setError("로그인에 실패했습니다. 세션이 생성되지 않았습니다.");
      }
    } catch (err: any) {
      const msg = err?.message || err?.error_description || "";
      if (msg.includes("Invalid login credentials") || msg.includes("Invalid credentials")) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else if (msg.includes("Email not confirmed")) {
        setError("이메일 인증이 필요합니다. 가입 시 발송된 메일의 링크를 눌러 인증해주세요.");
      } else if (msg.includes("rate limit") || msg.includes("rate_limit")) {
        setError("요청이 너무 많습니다. 1분 정도 있다가 다시 시도해주세요.");
      } else if (msg.includes("환경 변수") || msg.includes("서버에 연결")) {
        setError("환경 변수가 설정되지 않았습니다. .env 파일을 확인해주세요.");
      } else {
        setError(msg || "로그인에 실패했습니다. 다시 시도해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* 로고 및 제목 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Aone</h1>
            <p className="text-gray-600">AI 학습 파트너에 오신 것을 환영합니다</p>
          </div>

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            {/* 이메일 입력 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-gray-900 placeholder:text-gray-400"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            {/* 비밀번호 입력 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-gray-900 placeholder:text-gray-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}


            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  로그인 중...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  로그인
                </>
              )}
            </button>
          </form>

          {/* 회원가입 링크 */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              계정이 없으신가요?{" "}
              <Link href="/signup" className="text-primary font-medium hover:underline">
                회원가입
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

