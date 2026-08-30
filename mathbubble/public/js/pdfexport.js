/**
 * Assembles a real, multi-page PDF from a set of page images — client-side,
 * no library. This is the "send the whole solved worksheet to a teacher"
 * artifact: one file, in page order, instead of a pile of loose PNGs.
 *
 * Each page is embedded as a JPEG XObject (DCTDecode — a JPEG's own encoded
 * bytes drop straight into a PDF stream with no re-encoding) drawn to fill a
 * standard page at the image's own aspect ratio. Byte offsets are tracked as
 * the file is assembled so the xref table is exact, not guessed.
 */

import { paintStroke, paintTexts } from './board.js';

const PAGE_W = 595.28; // A4 at 72pt/in
const PAGE_H = 841.89;
const MARGIN = 24;
const MAX_EDGE = 1800; // export resolution — sharp when printed, not bloated

function jpegBytesFromDataUrl(dataUrl) {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const enc = (s) => new TextEncoder().encode(s);

/**
 * @param {{dataUrl: string, width: number, height: number}[]} pages  JPEG data URLs
 * @returns {Blob} application/pdf
 */
export function buildPdf(pages) {
  if (!pages.length) throw new Error('No pages to export');

  const chunks = [];
  let offset = 0;
  const objectOffsets = [0]; // index 0 unused, object numbers are 1-based
  const push = (bytes) => {
    chunks.push(bytes);
    offset += bytes.length;
  };
  const beginObject = (num) => {
    objectOffsets[num] = offset;
    push(enc(`${num} 0 obj\n`));
  };
  const endObject = () => push(enc('endobj\n'));

  push(enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));

  // Object numbering: 1 = Catalog, 2 = Pages, then per page i (0-based):
  // 3+3i = Page, 4+3i = content stream, 5+3i = image XObject — three objects
  // per page, every number from 3 up assigned with no gaps (a gap leaves
  // objectOffsets with a hole, and the xref loop below would print
  // "0undefined" for it, corrupting the fixed 20-byte-per-line format every
  // entry after it depends on).
  //
  // The content stream MUST be its own indirect object, referenced from
  // /Contents — a stream is only valid as an object's own body ("N 0 obj
  // << dict >> stream ... endstream endobj"); nesting one inside another
  // object's dictionary value, as an earlier version of this function did,
  // produces a file that looks fine on a byte-offset check (every "N 0 obj"
  // marker sits exactly where the xref table says) but breaks a reader's
  // object-boundary detection regardless, which surfaced as pdf.js reporting
  // 1 page instead of 4 and "kid reference points to wrong type of object".
  const n = pages.length;
  const pageObjNum = (i) => 3 + i * 3;
  const contentObjNum = (i) => 4 + i * 3;
  const imageObjNum = (i) => 5 + i * 3;

  beginObject(1);
  push(enc('<< /Type /Catalog /Pages 2 0 R >>\n'));
  endObject();

  beginObject(2);
  const kids = Array.from({ length: n }, (_, i) => `${pageObjNum(i)} 0 R`).join(' ');
  push(enc(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>\n`));
  endObject();

  pages.forEach((page, i) => {
    const scale = Math.min((PAGE_W - MARGIN * 2) / page.width, (PAGE_H - MARGIN * 2) / page.height);
    const w = page.width * scale;
    const h = page.height * scale;
    const x = (PAGE_W - w) / 2;
    const y = (PAGE_H - h) / 2;

    beginObject(pageObjNum(i));
    push(
      enc(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
          `/Resources << /XObject << /Im${i} ${imageObjNum(i)} 0 R >> >> ` +
          `/Contents ${contentObjNum(i)} 0 R >>\n`
      )
    );
    endObject();

    const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${i} Do Q`;
    const contentBytes = enc(content);
    beginObject(contentObjNum(i));
    push(enc(`<< /Length ${contentBytes.length} >>\nstream\n`));
    push(contentBytes);
    push(enc('\nendstream\n'));
    endObject();

    const jpeg = jpegBytesFromDataUrl(page.dataUrl);
    beginObject(imageObjNum(i));
    push(
      enc(
        `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
      )
    );
    push(jpeg);
    push(enc('\nendstream\n'));
    endObject();
  });

  const xrefOffset = offset;
  const maxObj = objectOffsets.length - 1;
  const xrefLines = [`xref\n0 ${maxObj + 1}\n`, '0000000000 65535 f \n'];
  for (let num = 1; num <= maxObj; num++) {
    // A gap here means an object number was reserved by the numbering
    // scheme above but never actually written — exactly the bug this guard
    // exists to catch instead of silently emitting a corrupt xref line.
    if (typeof objectOffsets[num] !== 'number') throw new Error(`PDF object ${num} was never written`);
    xrefLines.push(`${String(objectOffsets[num]).padStart(10, '0')} 00000 n \n`);
  }
  push(enc(xrefLines.join('')));
  push(enc(`trailer\n<< /Root 1 0 R /Size ${maxObj + 1} >>\nstartxref\n${xrefOffset}\n%%EOF`));

  return new Blob(chunks, { type: 'application/pdf' });
}

function boundsOf(page) {
  let min = { x: Infinity, y: Infinity };
  let max = { x: -Infinity, y: -Infinity };
  const eat = (x, y) => {
    min.x = Math.min(min.x, x); min.y = Math.min(min.y, y);
    max.x = Math.max(max.x, x); max.y = Math.max(max.y, y);
  };
  for (const s of page.strokes || []) for (const p of s.points) eat(p.x, p.y);
  for (const t of page.texts || []) {
    // A rough box is enough here — export framing doesn't need pixel-exact
    // text metrics the way the live board's selection outline does.
    eat(t.x, t.y - t.size);
    eat(t.x + t.size * Math.max(...(t.text || '').split('\n').map((l) => l.length), 1) * 0.55, t.y + t.size);
  }
  // rect can still be missing here if the image failed to load above (a
  // dead data URL, say) — the page just contributes no bounds from it.
  if (page.bg?.rect) {
    eat(page.bg.rect.x, page.bg.rect.y);
    eat(page.bg.rect.x + page.bg.rect.w, page.bg.rect.y + page.bg.rect.h);
  }
  if (!Number.isFinite(min.x)) return null;
  return { x: min.x, y: min.y, w: max.x - min.x, h: max.y - min.y };
}

/**
 * Renders one page (background + strokes + text) to a JPEG, independent of
 * whatever page happens to be loaded live in the app — export covers every
 * page in the notebook, not just the one on screen. Draws with the same
 * paintStroke/paintTexts functions the live board itself uses, so the export
 * is pixel-faithful to what the student actually sees, not a re-derivation
 * of it.
 *
 * @returns {Promise<{dataUrl: string, width: number, height: number}|null>}
 */
export async function pageToJpeg(page, { pad = 24, quality = 0.86 } = {}) {
  const bg = page.bg
    ? await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = page.bg.src;
      })
    : null;

  // A page whose background has never been on screen (imported, then
  // exported before ever being flipped to) still has rect: null — nothing
  // has auto-fitted it to a viewport yet. Its own pixel size is a perfectly
  // good stand-in, and has to be filled in before boundsOf runs below, which
  // otherwise has nothing to read the background's extent from at all.
  if (page.bg && !page.bg.rect && bg) {
    page.bg.rect = { x: 0, y: 0, w: bg.naturalWidth, h: bg.naturalHeight };
  }

  const bounds = boundsOf(page);
  if (!bounds) return null;

  const w = bounds.w + pad * 2;
  const h = bounds.h + pad * 2;
  const scale = Math.min(MAX_EDGE / Math.max(w, h), 3);

  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w * scale));
  cv.height = Math.max(1, Math.round(h * scale));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.scale(scale, scale);
  ctx.translate(-(bounds.x - pad), -(bounds.y - pad));

  if (bg) ctx.drawImage(bg, page.bg.rect.x, page.bg.rect.y, page.bg.rect.w, page.bg.rect.h);
  for (const s of page.strokes || []) paintStroke(ctx, s, 1, true);
  paintTexts(ctx, page.texts || [], true);

  return { dataUrl: cv.toDataURL('image/jpeg', quality), width: cv.width, height: cv.height };
}
