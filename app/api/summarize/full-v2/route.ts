import { NextRequest, NextResponse } from 'next/server';
import { openai, MODELS, chatCompletion } from '@/lib/openai';
import type { FullSummaryV2 } from '@/types/fullSummaryV2';

export const runtime = 'nodejs';

const FULL_SUMMARY_V2_PROMPT = `
너는 대학 강의를 시험 대비 요약으로 정리하는 조교다.
입력은 PDF 슬라이드에서 추출한 텍스트(PDF_TEXT)다.
결과는 시험 대비용 "전체 요약"이며, 반드시 지정된 JSON 구조로만 출력하라. Markdown, 설명, 코드블록 출력 금지.

[1] overview: course_topic(2~4문장), summary(3~5문장) 서술형
[2] topics: topic_title, slide_notes(서술형 문장, "**키워드:** 설명" 형식), professor_emphasis(기본 빈 배열 [])
[3] final_exam_takeaways: 3~5줄 서술형

JSON 구조:
{
  "document_title": "",
  "overview": { "course_topic": "", "summary": "" },
  "summary_type": "exam_notes",
  "topics": [ { "topic_title": "", "slide_notes": [""], "professor_emphasis": [{ "point": "", "context": "" }] } ],
  "final_exam_takeaways": [""],
  "meta": { "source": { "pdf_used": true, "professor_speech_used": false }, "generated_at": "" }
}

PDF_TEXT:
{{PDF_TEXT}}
`;

export async function POST(request: NextRequest) {
  try {
    const { pdfText, professorSpeechText, mockProfessorEmphasis } = await request.json();

    if (!process.env.OPENAI_API_KEY || !openai) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 설정되어 있지 않습니다.' },
        { status: 500 }
      );
    }

    if (!pdfText || typeof pdfText !== 'string' || pdfText.trim().length === 0) {
      return NextResponse.json({ error: 'pdfText가 비어있습니다.' }, { status: 400 });
    }

    let fullPrompt = FULL_SUMMARY_V2_PROMPT.replace('{{PDF_TEXT}}', pdfText);
    const professorText = mockProfessorEmphasis || professorSpeechText || '';
    if (professorText.trim().length > 0) {
      fullPrompt += '\n\n교수님 강조 포인트:\n' + professorText;
    }

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < 2) {
      try {
        const text = await chatCompletion({
          model: MODELS.full,
          messages: [{ role: 'user', content: fullPrompt }],
          responseFormat: 'text',
        });

        const cleaned = text.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '');
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('JSON 형식을 찾을 수 없습니다.');

        const summaryJson: FullSummaryV2 = JSON.parse(jsonMatch[0]);
        if (!summaryJson.document_title || !summaryJson.overview || !summaryJson.topics) {
          throw new Error('필수 필드가 누락되었습니다.');
        }

        summaryJson.meta = {
          source: {
            pdf_used: true,
            professor_speech_used: !!(professorSpeechText && professorSpeechText.trim().length > 0 && !mockProfessorEmphasis),
          },
          generated_at: new Date().toISOString(),
        };

        return NextResponse.json({ success: true, summary: summaryJson });
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts++;
        if (attempts < 2) fullPrompt += '\n\n[재시도] 반드시 JSON만 반환하세요.';
      }
    }

    throw lastError || new Error('JSON 파싱에 실패했습니다.');
  } catch (error: unknown) {
    console.error('전체 요약 v2 오류:', error);
    return NextResponse.json(
      {
        error: '전체 요약에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
