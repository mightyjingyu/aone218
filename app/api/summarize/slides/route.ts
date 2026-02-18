import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { openai, MODELS, chatCompletion } from '@/lib/openai';
import { SLIDE_SUMMARY_PROMPT } from '@/lib/prompts';
import { getPagesFromBuffer } from '@/lib/pdfPages';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { documentId, storagePath } = await request.json();

    if (!process.env.OPENAI_API_KEY || !openai) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 설정되어 있지 않습니다. (.env 확인)' },
        { status: 500 }
      );
    }

    if (!documentId || !storagePath) {
      return NextResponse.json(
        { error: 'documentId와 storagePath가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    console.log('PDF 다운로드 시작:', storagePath);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('files')
      .download(storagePath);

    if (downloadError) {
      console.error('PDF 다운로드 실패:', downloadError);
      return NextResponse.json(
        { error: 'PDF 파일 다운로드 실패', details: downloadError.message },
        { status: 404 }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('PDF 크기:', Math.round(buffer.length / 1024), 'KB');

    const pages = await getPagesFromBuffer(buffer);
    const pagesBlock = pages
      .map((p) => `[페이지 ${p.slide_number}]\n${p.text}`)
      .join('\n\n');

    console.log('OpenAI API 호출 시작 (슬라이드 요약, JSON 모드)...');
    const text = await chatCompletion({
      model: MODELS.slides,
      messages: [
        { role: 'user', content: SLIDE_SUMMARY_PROMPT + '\n\n' + pagesBlock },
      ],
      responseFormat: 'json_object',
      maxTokens: 8192,
    });

    console.log('OpenAI 응답 길이:', text.length);

    let parsed: { summaries?: { slide_number: number; title?: string; bullets?: string[] }[] };
    try {
      parsed = JSON.parse(text);
    } catch (parseError: unknown) {
      const errMsg = parseError instanceof Error ? parseError.message : String(parseError);
      console.error('JSON 파싱 실패:', errMsg);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          return NextResponse.json(
            {
              error: 'OpenAI 응답을 JSON으로 파싱할 수 없습니다.',
              details: errMsg,
              sample: text.substring(0, 500),
            },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'OpenAI 응답에서 JSON을 찾을 수 없습니다.', details: text.substring(0, 500) },
          { status: 500 }
        );
      }
    }

    if (!parsed?.summaries || !Array.isArray(parsed.summaries)) {
      console.error('OpenAI 응답 구조 오류:', Object.keys(parsed || {}));
      return NextResponse.json(
        {
          error: '유효한 summaries 배열을 반환하지 않았습니다.',
          details: JSON.stringify(parsed).substring(0, 500),
        },
        { status: 500 }
      );
    }

    console.log('슬라이드 요약 개수:', parsed.summaries.length);

    const convertToTipTapJson = (title: string, bullets: string[]) => ({
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
    });

    const summariesToInsert = parsed.summaries.map((s: { slide_number: number; title?: string; bullets?: string[] }) => ({
      document_id: documentId,
      slide_number: s.slide_number,
      summary_content: convertToTipTapJson(s.title || `슬라이드 ${s.slide_number}`, s.bullets || []),
      user_notes_content: null,
    }));

    const { error: insertError } = await supabase
      .from('slide_summaries')
      .upsert(summariesToInsert, { onConflict: 'document_id,slide_number' });

    if (insertError) {
      console.error('DB 저장 실패:', insertError);
      return NextResponse.json(
        { error: 'DB 저장 실패', details: insertError.message },
        { status: 500 }
      );
    }

    console.log('슬라이드 요약 저장 완료');
    return NextResponse.json({
      success: true,
      summaries: parsed.summaries,
      count: parsed.summaries.length,
    });
  } catch (error: unknown) {
    console.error('슬라이드 일괄 요약 오류:', error);
    return NextResponse.json(
      {
        error: '슬라이드 일괄 요약에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
