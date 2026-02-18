import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker 설정 - CDN 사용
if (typeof window !== 'undefined') {
  const pdfjsVersion = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`;
}

/**
 * PDF 파일의 첫 페이지를 썸네일 이미지(Blob)로 변환합니다.
 * @param file PDF 파일
 * @param maxWidth 썸네일 최대 너비 (기본: 400px)
 * @returns PNG 이미지 Blob
 */
export async function generatePdfThumbnail(
  file: File,
  maxWidth: number = 400
): Promise<Blob> {
  try {
    // PDF 파일을 ArrayBuffer로 읽기
    const arrayBuffer = await file.arrayBuffer();

    // PDF 문서 로드
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // 첫 페이지 가져오기
    const page = await pdf.getPage(1);

    // 뷰포트 설정 (크기 조정)
    const viewport = page.getViewport({ scale: 1.0 });
    const scale = maxWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    // Canvas 생성
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Canvas context를 생성할 수 없습니다.');
    }

    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    // PDF 페이지를 Canvas에 렌더링
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
    }).promise;

    // Canvas를 Blob으로 변환
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas를 Blob으로 변환하는데 실패했습니다.'));
          }
        },
        'image/png',
        0.9 // 품질
      );
    });
  } catch (error) {
    console.error('PDF 썸네일 생성 실패:', error);
    throw new Error('PDF 썸네일을 생성할 수 없습니다.');
  }
}

/**
 * 썸네일 Blob을 File 객체로 변환합니다.
 * @param blob 이미지 Blob
 * @param fileName 파일명 (확장자 제외)
 * @returns File 객체
 */
export function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], `${fileName}_thumbnail.png`, {
    type: 'image/png',
    lastModified: Date.now(),
  });
}
