import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';

/**
 * 현재 로그인한 사용자 정보를 가져옵니다.
 * 세션이 없을 때 예외를 던지지 않도록 getSession() 사용.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return session?.user ?? null;
}

/**
 * 현재 세션 정보를 가져옵니다.
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return session;
}

/**
 * 이메일과 비밀번호로 로그인합니다.
 */
export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('SignIn error:', error);
      throw error;
    }
    
    return data;
  } catch (err: any) {
    // 네트워크 에러나 환경 변수 문제인 경우
    if (err.message?.includes('fetch') || err.message?.includes('Failed to fetch')) {
      console.error('❌ Supabase 연결 실패. 환경 변수를 확인해주세요.');
      throw new Error('서버에 연결할 수 없습니다. 환경 변수 설정을 확인해주세요.');
    }
    throw err;
  }
}

/**
 * 이메일과 비밀번호로 회원가입합니다.
 */
export async function signUp(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) {
      console.error('SignUp error:', error);
      throw error;
    }
    
    return data;
  } catch (err: any) {
    // 네트워크 에러나 환경 변수 문제인 경우
    if (err.message?.includes('fetch') || err.message?.includes('Failed to fetch')) {
      console.error('❌ Supabase 연결 실패. 환경 변수를 확인해주세요.');
      throw new Error('서버에 연결할 수 없습니다. 환경 변수 설정을 확인해주세요.');
    }
    throw err;
  }
}

/**
 * 로그아웃합니다.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

/**
 * 인증 상태 변경을 구독합니다.
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

