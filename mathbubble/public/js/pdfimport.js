/**
 * Turns an uploaded PDF (an exam paper, a worksheet, a textbook chapter)
 * into one page image per PDF page, ready to hand to Board.setBackground.
 *
 * Rendering happens entirely client-side via pdf.js — nothing is uploaded
 * anywhere just to open it. Pages render at a size generous enough that text
 * stays legible after a student later shades and crops a small part of one.
 */

let pdfjsPromise = null;

async function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('../vendor/pdfjs/pdf.min.mjs').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
      return mod;
    });
  }
  return pdfjsPromise;
}

const MAX_EDGE = 2000; // long edge, in CSS px — keeps small print readable
const MAX_PAGES = 60; // a generous cap so a huge file can't freeze the tab

/**
 * @param {File} file
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<string[]>} one PNG data URL per rendered page
 */
export async function pdfToPageImages(file, onProgress) {
  const { getDocument } = await pdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await getDocument({ data: buffer }).promise;

  const total = Math.min(doc.numPages, MAX_PAGES);
  const images = [];

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(MAX_EDGE / Math.max(base.width, base.height), 3);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    images.push({ dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
    page.cleanup();
    onProgress?.(i, total);
    // Yields a frame between pages so the UI (and the progress toast) stays responsive.
    await new Promise((r) => requestAnimationFrame(r));
  }

  await doc.destroy();
  return { images, truncated: doc.numPages > MAX_PAGES, totalPages: doc.numPages };
}
