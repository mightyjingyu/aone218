import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { openai, MODELS } from '@/lib/openai';
import { toFile } from 'openai/uploads';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min for long recordings

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY || !openai) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 설정되어 있지 않습니다.' },
        { status: 500 }
      );
    }

    let buffer: Buffer;
    let filename = 'audio.mp3';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const storagePath = body?.storagePath;
      if (!storagePath || typeof storagePath !== 'string') {
        return NextResponse.json(
          { error: 'storagePath가 필요합니다.' },
          { status: 400 }
        );
      }
      const supabase = createServerClient();
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('files')
        .download(storagePath);
      if (downloadError || !fileData) {
        return NextResponse.json(
          { error: '오디오 파일을 불러올 수 없습니다.', details: downloadError?.message },
          { status: 404 }
        );
      }
      const arrayBuffer = await fileData.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      const ext = storagePath.split('.').pop();
      if (ext) filename = `audio.${ext}`;
    } else {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: 'formData에 file이 필요합니다.' },
          { status: 400 }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      filename = file.name || 'audio.webm';
    }

    const timeoutMs = Number(process.env.OPENAI_TRANSCRIBE_TIMEOUT_MS) || 240000;
    const language = process.env.OPENAI_TRANSCRIBE_LANGUAGE || 'ko';
    const model = MODELS.transcribe;

    const upload = await toFile(buffer, filename, { type: (filename.endsWith('.m4a') ? 'audio/mp4' : filename.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg') });

    const transcription = await openai.audio.transcriptions.create({
      file: upload,
      model,
      language: language || undefined,
      response_format: 'text',
    }, { timeout: timeoutMs });

    const text = typeof transcription === 'string' ? transcription : String((transcription as { text?: string }).text ?? '');
    return NextResponse.json({ success: true, text: text.trim() });
  } catch (e: unknown) {
    console.error('Transcribe error:', e);
    return NextResponse.json(
      { error: '음성 전사에 실패했습니다.', details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
