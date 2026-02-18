import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getPagesFromBuffer } from '@/lib/pdfPages';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const storagePath = body?.storagePath;

    if (!storagePath || typeof storagePath !== 'string') {
      return NextResponse.json({ error: 'storagePath가 필요합니다.' }, { status: 400 });
    }

    let supabase;
    try {
      supabase = createServerClient();
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error('Supabase 클라이언트 생성 실패:', msg);
      return NextResponse.json(
        { error: '서버 설정 오류', details: msg },
        { status: 500 }
      );
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('files')
      .download(storagePath);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: 'PDF 파일을 불러올 수 없습니다.', details: downloadError?.message || 'download failed' },
        { status: 404 }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const pages = await getPagesFromBuffer(buffer);
    return NextResponse.json({
      success: true,
      numPages: pages.length,
      pages,
    });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    console.error('페이지 텍스트 추출 오류:', message);
    return NextResponse.json(
      { error: '페이지 텍스트 추출에 실패했습니다.', details: message },
      { status: 500 }
    );
  }
}
