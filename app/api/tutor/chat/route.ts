import { NextRequest, NextResponse } from 'next/server';
import { openai, MODELS, chatCompletion } from '@/lib/openai';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY || !openai) {
      return NextResponse.json({ error: 'OPENAI_API_KEY가 설정되어 있지 않습니다.' }, { status: 500 });
    }

    const body = await req.json();
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = body?.messages || [];
    const contextText: string = body?.contextText || '';
    const documentId: string = body?.documentId || '';

    if (!messages.length) {
      return NextResponse.json({ error: 'messages가 비어 있습니다.' }, { status: 400 });
    }

    const systemContent = `너는 대학 강의 보조 AI 튜터다. 학생이 이해하기 쉽게 한국어로 짧고 명확하게 답해라. 모르면 솔직히 모른다고 말하고, 근거가 부족하면 추측하지 말아라.`;
    const contextPrefix = contextText
      ? `\n\n[문서 요약 컨텍스트]\n${contextText}\n\n컨텍스트를 우선 사용하되, 질문이 무관하면 일반 지식으로 간단히 답변.`
      : '';

    const openaiMessages = [
      { role: 'system' as const, content: systemContent },
      ...messages.map((m) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: `문서 ID: ${documentId || '(unknown)'}${contextPrefix}` },
    ];

    const text = await chatCompletion({
      model: MODELS.qa,
      messages: openaiMessages,
      responseFormat: 'text',
      maxTokens: 2048,
    });

    return NextResponse.json({ reply: text || '답변을 생성하지 못했어요.' });
  } catch (e: unknown) {
    console.error('AI tutor error:', e);
    return NextResponse.json(
      { error: 'AI 튜터 응답 생성에 실패했습니다.', details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
