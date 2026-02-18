import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// 개발 환경에서 환경 변수 확인
if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
  if (!supabaseUrl || !supabasePublishableKey) {
    console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
    console.error('다음 환경 변수를 .env 파일에 추가해주세요:');
    console.error('NEXT_PUBLIC_SUPABASE_URL=your-supabase-url');
    console.error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key');
  } else {
    console.log('✅ Supabase 환경 변수 로드됨:', {
      url: supabaseUrl,
      hasKey: !!supabasePublishableKey,
    });
  }
}

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file and restart the dev server.'
  );
}

// 클라이언트 사이드용 Supabase 클라이언트 (Publishable Key 사용)
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// 서버 사이드용 Supabase 클라이언트 (Secret Key 사용)
export const createServerClient = () => {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error('Missing SUPABASE_SECRET_KEY environment variable');
  }
  
  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

