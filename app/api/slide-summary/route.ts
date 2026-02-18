import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { openai, MODELS, chatCompletion } from '@/lib/openai';
import { SLIDE_SUMMARY_SINGLE_PROMPT } from '@/lib/prompts';

export const runtime = 'nodejs';
export const maxDuration = 30;

function convertToTipTapJson(title: string, bullets: string[]) {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: title }],
      },
      {
        type: 'bulletList',
        content: bullets.map((bullet) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: bullet }],
            },
          ],
        })),
      },
    ],
  };
}

export async function POST(request: NextRequest) {
  const startMs = Date.now();
  try {
    const body = await request.json();
    const { docId, slideIndex, slideText, promptVersion } = body as {
      docId?: string;
      slideIndex?: number;
      slideText?: string;
      promptVersion?: string;
    };

    if (!process.env.OPENAI_API_KEY || !openai) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 설정되어 있지 않습니다.' },
        { status: 500 }
      );
    }

    if (!docId || slideIndex == null || slideIndex < 1 || typeof slideText !== 'string') {
      return NextResponse.json(
        { error: 'docId(문자열), slideIndex(1 이상), slideText(문자열)가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    const { data: cachedRow } = await supabase
      .from('slide_summaries')
      .select('summary_content')
      .eq('document_id', docId)
      .eq('slide_number', slideIndex)
      .single();

    if (cachedRow?.summary_content != null) {
      const latencyMs = Date.now() - startMs;
      console.log('[slide-summary] hit', { docId, slideIndex, cached: true, latencyMs });
      return NextResponse.json({
        docId,
        slideIndex,
        summary: cachedRow.summary_content,
        cached: true,
        model: '',
        latencyMs,
      });
    }

    const pageBlock = `[페이지 ${slideIndex}]\n${slideText}`;
    const model = MODELS.slides;

    const text = await chatCompletion({
      model,
      messages: [
        { role: 'user', content: SLIDE_SUMMARY_SINGLE_PROMPT + '\n\n' + pageBlock },
      ],
      responseFormat: 'json_object',
      maxTokens: 1024,
    });

    let parsed: { summaries?: { slide_number: number; title?: string; bullets?: string[] }[] };
    try {
      parsed = JSON.parse(text);
    } catch (parseError: unknown) {
      const errMsg = parseError instanceof Error ? parseError.message : String(parseError);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          return NextResponse.json(
            {
              error: 'OpenAI 응답을 JSON으로 파싱할 수 없습니다.',
              details: errMsg,
            },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'OpenAI 응답에서 JSON을 찾을 수 없습니다.', details: text.substring(0, 300) },
          { status: 500 }
        );
      }
    }

    if (!parsed?.summaries || !Array.isArray(parsed.summaries) || parsed.summaries.length === 0) {
      return NextResponse.json(
        {
          error: '유효한 summaries 배열을 반환하지 않았습니다.',
          details: JSON.stringify(parsed).substring(0, 300),
        },
        { status: 500 }
      );
    }

    const one = parsed.summaries[0];
    const summary = convertToTipTapJson(
      one.title ?? `슬라이드 ${slideIndex}`,
      one.bullets ?? []
    );

    const { error: upsertError } = await supabase
      .from('slide_summaries')
      .upsert(
        {
          document_id: docId,
          slide_number: slideIndex,
          summary_content: summary,
          user_notes_content: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'document_id,slide_number' }
      );

    if (upsertError) {
      console.error('slide_summaries upsert 실패:', upsertError);
    }

    const latencyMs = Date.now() - startMs;
    console.log('[slide-summary] miss', { docId, slideIndex, cached: false, model, latencyMs });
    return NextResponse.json({
      docId,
      slideIndex,
      summary,
      cached: false,
      model,
      latencyMs,
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startMs;
    console.error('slide-summary 오류:', error);
    return NextResponse.json(
      {
        error: '슬라이드 요약에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
        latencyMs,
      },
      { status: 500 }
    );
  }
}
