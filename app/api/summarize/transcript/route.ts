import { NextRequest, NextResponse } from 'next/server';
import { openai, MODELS, chatCompletion } from '@/lib/openai';

export const runtime = 'nodejs';

const TRANSCRIPT_SUMMARY_PROMPT = `
당신은 최고의 강의 보조 AI입니다.
아래는 교수님 강의 녹음 전사 텍스트입니다. 이를 학생이 보기 좋게 정리해 주세요.
요구사항: 한국어, 군더더기/반복 제거, 핵심 개념 위주. 결과는 "notesText" 하나만 포함한 JSON만 반환.
출력 예시: { "notesText": "..." }
전사 텍스트:
`;

function coerceToString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(coerceToString).filter(Boolean).join('\n');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export async function POST(request: NextRequest) {
  try {
    const { transcriptText } = await request.json();

    if (!process.env.OPENAI_API_KEY || !openai) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 설정되어 있지 않습니다.' },
        { status: 500 }
      );
    }

    if (!transcriptText || typeof transcriptText !== 'string' || transcriptText.trim().length === 0) {
      return NextResponse.json({ error: 'transcriptText가 비어있습니다.' }, { status: 400 });
    }

    const text = await chatCompletion({
      model: MODELS.transcript,
      messages: [
        { role: 'user', content: TRANSCRIPT_SUMMARY_PROMPT + '\n' + transcriptText },
      ],
      responseFormat: 'json_object',
    });

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
        } catch {
          // fallback below
        }
      }
    }

    let notesText: string =
      parsed?.notesText != null ? String(parsed.notesText) :
      parsed?.notes_text != null ? String(parsed.notes_text) :
      parsed?.notes != null ? String(parsed.notes) :
      parsed?.text != null ? String(parsed.text) :
      parsed?.summary != null ? String(parsed.summary) :
      typeof parsed === 'string' ? parsed : '';
    if (!notesText || typeof notesText !== 'string') notesText = typeof text === 'string' ? text : coerceToString(text);
    notesText = String(notesText).trim();

    if (!notesText) {
      return NextResponse.json(
        { error: '전사 텍스트 정리 결과가 비어있습니다.', details: typeof text === 'string' ? text.slice(0, 2000) : String(text) },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, notesText });
  } catch (e: unknown) {
    console.error('Summarize transcript error:', e);
    return NextResponse.json(
      { error: '전사 텍스트 정리에 실패했습니다.', details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
