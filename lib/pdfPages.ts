import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Extract per-page text from a PDF buffer. Uses pdfjs-dist only (뷰어와 동일 엔진) so page order matches the UI.
 * pdf-parse 폴백 제거: 순서 어긋남 방지를 위해 pdfjs 실패 시 에러를 던짐.
 */
export async function getPagesFromBuffer(
  buffer: Buffer
): Promise<{ slide_number: number; text: string }[]> {
  const pages = await getPagesFromBufferPdfJs(buffer);
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
    console.log('[pdfPages] pdfjs-dist 페이지별 추출 완료:', pages.length, '페이지');
  }
  return pages;
}

/**
 * Node에서 pdfjs worker 경로를 node_modules 기준 절대 경로로 설정.
 * Next 번들 내부에서는 ./pdf.worker.mjs 가 .next/server/chunks 로 해석되어 파일을 찾지 못함.
 */
function setPdfWorkerSrcForNode(pdfjs: any): void {
  if (typeof process === 'undefined' || process.env?.NODE_ENV === 'test') return;
  try {
    const workerPath = path.join(
      process.cwd(),
      'node_modules',
      'pdfjs-dist',
      'legacy',
      'build',
      'pdf.worker.mjs'
    );
    if (typeof pdfjs.GlobalWorkerOptions !== 'undefined') {
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    }
  } catch {
    // ignore
  }
}

/**
 * 페이지별 텍스트 추출 (pdfjs-dist). 뷰어와 동일한 페이지 순서 보장.
 */
async function getPagesFromBufferPdfJs(
  buffer: Buffer
): Promise<{ slide_number: number; text: string }[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  setPdfWorkerSrcForNode(pdfjs);
  if (typeof (pdfjs as any).disableWorker !== 'undefined') {
    (pdfjs as any).disableWorker = true;
  }
  const data = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pages: { slide_number: number; text: string }[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text =
      textContent.items
        .map((item: { str?: string }) => item.str ?? '')
        .join(' ')
        .trim() || '(빈 페이지)';
    pages.push({ slide_number: i, text });
  }

  return pages;
}

