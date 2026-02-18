import { NextRequest, NextResponse } from 'next/server';
import { openai, MODELS, chatCompletion } from '@/lib/openai';

export const runtime = 'nodejs';

function isValidTipTapDoc(doc: unknown): doc is { type: 'doc'; content: unknown[] } {
  return !!doc && typeof doc === 'object' && (doc as { type?: string }).type === 'doc' && Array.isArray((doc as { content?: unknown[] }).content) && (doc as { content: unknown[] }).content.length > 0;
}

function stripCodeFences(s: string): string {
  const trimmed = (s || '').trim();
  if (trimmed.startsWith('```')) {
    const firstNewline = trimmed.indexOf('\n');
    const lastFence = trimmed.lastIndexOf('```');
    if (firstNewline >= 0 && lastFence > firstNewline) {
      return trimmed.slice(firstNewline + 1, lastFence).trim();
    }
  }
  return trimmed;
}

function extractFirstJsonObject(s: string): string | null {
  const text = s || '';
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function parsePossiblyWrappedJson(text: string): unknown {
  const t1 = stripCodeFences(text);
  try { return JSON.parse(t1); } catch {
    const candidate = extractFirstJsonObject(t1);
    if (!candidate) throw new Error('응답에서 JSON 객체를 찾지 못했습니다.');
    return JSON.parse(candidate);
  }
}

function stripHtmlTags(s: string): string {
  return (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function textToTipTapDoc(raw: string, folderName: string): { type: 'doc'; content: unknown[] } | null {
  const cleaned = stripHtmlTags(stripCodeFences(raw || '')).trim();
  if (!cleaned) return null;
  const blocks = cleaned.split(/\n\s*\n/g).map((b) => b.trim()).filter(Boolean);
  const content: unknown[] = [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: `폴더 전체 요약: ${folderName || '폴더'}` }] },
  ];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const isBullet = lines.length > 1 && lines.every((l) => /^[-•]\s+/.test(l));
    if (isBullet) {
      content.push({
        type: 'bulletList',
        content: lines.map((l) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: l.replace(/^[-•]\s+/, '') }] }],
        })),
      });
    } else {
      content.push({ type: 'paragraph', content: [{ type: 'text', text: lines.join(' ') }] });
    }
  }
  const doc = { type: 'doc', content };
  return isValidTipTapDoc(doc) ? doc : null;
}

async function repairToTipTapJson(raw: string, folderName: string): Promise<unknown> {
  const repairPrompt = `
당신의 이전 응답은 TipTap JSON이어야 했지만, 유효한 JSON이 아니었습니다.
아래 "RAW"를 참고해, 반드시 유효한 TipTap JSON(doc)으로 고쳐서 반환하세요.
규칙: 출력은 오직 JSON 하나만. 최상위는 { "type":"doc", "content":[ ... ] }
폴더명: ${folderName || '(unknown)'}
RAW:
` + (raw || '');
  const repairText = await chatCompletion({
    model: MODELS.folder,
    messages: [{ role: 'user', content: repairPrompt }],
    responseFormat: 'json_object',
  });
  return parsePossiblyWrappedJson(repairText);
}

const FOLDER_SUMMARY_PROMPT = `
당신은 최고의 강의 보조 AI입니다.
아래에는 한 폴더(및 하위 폴더)에 포함된 문서들의 "전체 요약 텍스트"만 모아둔 입력이 주어집니다.
이 입력만을 근거로 폴더 전체를 한 번에 이해할 수 있도록 종합 정리해 주세요.
요구사항: 한국어. 구조: (1) 폴더 전체 핵심 주제/범위 (2) 공통 개념/정의 (3) 문서 간 연결/흐름 (4) 시험/과제 대비 포인트 (5) 한눈에 보는 체크리스트.
반드시 TipTap JSON만 반환. node: heading, paragraph, bulletList, orderedList, listItem, text, hardBreak.
출력 예시: { "type": "doc", "content": [ { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "폴더 전체 요약" }] } ] }
입력:
`;

export async function POST(request: NextRequest) {
  try {
    const { folderName, summariesText } = await request.json();

    if (!process.env.OPENAI_API_KEY || !openai) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 설정되어 있지 않습니다. (.env 확인)' },
        { status: 500 }
      );
    }

    if (!summariesText || typeof summariesText !== 'string' || summariesText.trim().length === 0) {
      return NextResponse.json({ error: 'summariesText가 비어있습니다.' }, { status: 400 });
    }

    const prompt = `${FOLDER_SUMMARY_PROMPT}\n폴더명: ${folderName || '(unknown)'}\n\n${summariesText}`;

    const text = await chatCompletion({
      model: MODELS.folder,
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json_object',
    });

    let parsed: unknown = null;
    try {
      parsed = parsePossiblyWrappedJson(text);
    } catch (e1: unknown) {
      try {
        parsed = await repairToTipTapJson(text, folderName);
      } catch (e2: unknown) {
        const fallback = textToTipTapDoc(text, folderName);
        if (fallback) parsed = fallback;
        else throw (e2 as Error) || (e1 as Error);
      }
    }

    if (!isValidTipTapDoc(parsed)) {
      return NextResponse.json(
        { error: '유효한 TipTap JSON을 반환하지 않았습니다.', details: typeof text === 'string' ? text.slice(0, 2000) : String(text) },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, summary: parsed });
  } catch (e: unknown) {
    console.error('Folder summarize error:', e);
    return NextResponse.json(
      { error: '폴더 전체 요약에 실패했습니다.', details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
