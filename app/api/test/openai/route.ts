import { NextResponse } from 'next/server';
import { openai, MODELS, chatCompletion } from '@/lib/openai';

export const runtime = 'nodejs';

export async function GET() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'OPENAI_API_KEY가 설정되어 있지 않습니다.',
          env_check: {
            OPENAI_API_KEY: 'NOT SET',
            NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
            SUPABASE_SECRET_KEY: !!process.env.SUPABASE_SECRET_KEY ? 'SET' : 'NOT SET',
          },
        },
        { status: 500 }
      );
    }

    if (!openai) {
      return NextResponse.json(
        { success: false, error: 'OpenAI client could not be initialized.' },
        { status: 500 }
      );
    }

    const text = await chatCompletion({
      model: MODELS.qa,
      messages: [{ role: 'user', content: '안녕하세요! 간단히 인사해주세요.' }],
      responseFormat: 'text',
    });

    return NextResponse.json({
      success: true,
      message: 'OpenAI API 연결 성공!',
      response: text,
      env_check: {
        OPENAI_API_KEY: 'SET',
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
        SUPABASE_SECRET_KEY: !!process.env.SUPABASE_SECRET_KEY ? 'SET' : 'NOT SET',
        models: {
          slides: MODELS.slides,
          full: MODELS.full,
          folder: MODELS.folder,
          transcript: MODELS.transcript,
          qa: MODELS.qa,
          transcribe: MODELS.transcribe,
        },
      },
    });
  } catch (error: unknown) {
    console.error('OpenAI API 테스트 실패:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
