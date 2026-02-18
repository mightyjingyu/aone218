import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // 보호된 라우트 목록
  const protectedRoutes = ['/dashboard', '/document'];
  const isProtectedRoute = protectedRoutes.some(route => 
    req.nextUrl.pathname.startsWith(route)
  );

  // 보호된 라우트는 클라이언트 사이드에서 인증 확인
  // 미들웨어에서는 쿠키 확인을 하지 않고, AuthGuard에서 처리
  // (Supabase 쿠키 이름이 프로젝트마다 다를 수 있음)
  
  // 이미 로그인한 상태에서 로그인/회원가입 페이지 접근 시 대시보드로 리다이렉트
  if ((req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup')) {
    // 쿠키에 Supabase 세션이 있는지 확인 (모든 sb- 쿠키 확인)
    const hasSupabaseCookie = Array.from(req.cookies.getAll()).some(
      cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
    );
    
    if (hasSupabaseCookie) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

