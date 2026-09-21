import type { ContentBlock } from "./types";

/**
 * Reading a PDF, in the browser.
 *
 * A PDF is the most common thing anyone drags at an assistant — a paper, a
 * spec, a statement, a syllabus — and this app used to refuse them all with
 * "isn't a text or image file". Every tool it is measured against reads them.
 *
 * The work happens here rather than on a server because nothing else in this
 * app leaves the browser and a PDF should not be the exception; and it is
 * behind a dynamic import because pdf.js is about a megabyte, which is a lot
 * to make everyone download for a file most sessions never attach.
 */

let pdfjs: typeof import("pdfjs-dist") | null = null;

async function load() {
  if (pdfjs) return pdfjs;
  const mod = await import("pdfjs-dist");
  // The worker keeps parsing off the main thread. Without it pdf.js still
  // works and a 300-page document freezes the tab while it reads.
  mod.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  pdfjs = mod;
  return mod;
}

export interface PdfText {
  text: string;
  pages: number;
  /** True when the file is pages of pictures — a scan — with no text layer. */
  imageOnly: boolean;
}

/** Roughly a novel's worth. Past this the context fitter would drop it anyway. */
const MAX_CHARS = 400_000;

export async function extractPdf(file: File | ArrayBuffer): Promise<PdfText> {
  const mod = await load();
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const doc = await mod.getDocument({ data: new Uint8Array(data) }).promise;

  const out: string[] = [];
  let chars = 0;
  for (let n = 1; n <= doc.numPages && chars < MAX_CHARS; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();

    /* pdf.js hands back positioned runs, not lines. `hasEOL` is the only
       signal it gives about where the original broke — joining on it is the
       difference between a paragraph and a column of single words. */
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line.trimEnd());
        line = "";
      }
    }
    if (line.trim()) lines.push(line.trimEnd());

    const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text) {
      out.push(`--- page ${n} ---\n${text}`);
      chars += text.length;
    }
    page.cleanup();
  }
  const pages = doc.numPages;
  await doc.destroy();

  return {
    text: out.join("\n\n"),
    pages,
    // A page or two of a long document being pictures is normal. A document
    // that is *all* pictures is a scan, and saying "read this" about it would
    // be a lie — there is nothing in it to read without OCR.
    imageOnly: out.length === 0,
  };
}

/** The attachment a PDF becomes, or the reason it cannot become one. */
export async function pdfBlock(
  file: File,
): Promise<{ block: ContentBlock } | { error: string }> {
  try {
    const { text, pages, imageOnly } = await extractPdf(file);
    if (imageOnly) {
      return {
        error: `${file.name} is a scan — ${pages} page${pages === 1 ? "" : "s"} of pictures with no text in them. Reading it would need OCR, which this doesn't do.`,
      };
    }
    return {
      block: {
        type: "file",
        mimeType: "application/pdf",
        name: file.name,
        text: `${file.name} — ${pages} page${pages === 1 ? "" : "s"}\n\n${text}`,
      },
    };
  } catch {
    return { error: `${file.name} could not be opened. It may be encrypted or damaged.` };
  }
}

/**
 * One page, drawn.
 *
 * The text of a document is what a model reads; the *picture* of a page is
 * what a person points at. A tutor needs both — you cannot ask "why is this
 * step wrong" about a paragraph you cannot see, and a diagram, a handwritten
 * working or a scan has no text to quote at all.
 *
 * Rendered at a scale rather than a fixed width so the crop a person drags
 * out of it is worth sending: a region cut from a page drawn at 200px wide
 * is four grey squares.
 */
export async function renderPage(
  data: ArrayBuffer,
  pageNo: number,
  opts: { width?: number } = {},
): Promise<{ url: string; width: number; height: number; pages: number }> {
  const mod = await load();
  /* pdf.js takes ownership of the buffer it is given and leaves it detached,
     which makes the second call on the same document fail with "detached
     ArrayBuffer". The copy is per render and costs a few milliseconds. */
  const doc = await mod.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
  const page = await doc.getPage(Math.min(Math.max(1, pageNo), doc.numPages));
  const base = page.getViewport({ scale: 1 });
  /* Capped: past about 2000px the canvas costs more memory than the detail
     is worth, and phones start refusing to allocate it. */
  const want = Math.min(opts.width ?? 1400, 2000);
  const viewport = page.getViewport({ scale: want / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser would not give us a canvas to draw the page on.");
  await page.render({ canvasContext: ctx, viewport }).promise;
  const url = canvas.toDataURL("image/jpeg", 0.82);
  const pages = doc.numPages;
  page.cleanup();
  await doc.destroy();
  return { url, width: canvas.width, height: canvas.height, pages };
}

/**
 * Where the words are on a page.
 *
 * The text a model reads has no position; the page a person looks at is
 * nothing but positions. This joins them: every run of text on the page
 * with its box in page coordinates (0..1), so a line the model quotes can
 * be found and lit up on the page itself — which is the difference between
 * "in the second paragraph" and a finger on the line.
 */
export interface TextRun { str: string; x: number; y: number; w: number; h: number }

export async function pageLayout(data: ArrayBuffer, pageNo: number): Promise<TextRun[]> {
  const mod = await load();
  const doc = await mod.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
  const page = await doc.getPage(Math.min(Math.max(1, pageNo), doc.numPages));
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const runs: TextRun[] = [];
  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    /* transform = [a b c d e f]; e,f is the baseline origin in PDF space,
       and the run's height is the font size, which is the vertical scale. */
    const [a, b, , d, e, f] = item.transform as number[];
    const h = Math.abs(d) || Math.hypot(a, b) || 10;
    const w = item.width || 0;
    const [x1, yTop] = vp.convertToViewportPoint(e, f + h);
    const [x2] = vp.convertToViewportPoint(e + w, f);
    runs.push({
      str: item.str,
      x: Math.min(x1, x2) / vp.width,
      y: yTop / vp.height,
      w: Math.abs(x2 - x1) / vp.width,
      h: h / vp.height,
    });
  }
  page.cleanup();
  await doc.destroy();
  return runs;
}

const squash = (t: string) => t.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

/**
 * The boxes on the page that a quoted line covers — one per line of the
 * page the quote runs across — or none when the page does not say that.
 * Matched on squashed text: case, quotes and runs of space do not count,
 * because the model's transcription of a line is not byte-exact.
 */
export function findQuote(runs: TextRun[], quote: string): { x: number; y: number; w: number; h: number }[] {
  const q = squash(quote);
  if (q.length < 6 || !runs.length) return [];
  /* One string, with each character remembering which run it came from. */
  let joined = "";
  const owner: number[] = [];
  runs.forEach((r, i) => {
    const piece = squash(r.str) + " ";
    for (let k = 0; k < piece.length; k++) owner.push(i);
    joined += piece;
  });
  let at = joined.indexOf(q);
  /* The model may quote a fragment across a line break the page shows as a
     hyphen, or drop a word; fall back to the first eight words. */
  if (at === -1) {
    const head = q.split(" ").slice(0, 8).join(" ");
    if (head.length >= 12) at = joined.indexOf(head);
  }
  if (at === -1) return [];
  const end = Math.min(joined.length - 1, at + q.length - 1);
  const hit = new Set<number>();
  for (let k = at; k <= end; k++) hit.add(owner[k]);
  /* Runs on the same line join into one box, so a highlight is a bar across
     the words rather than a comb of them. */
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  for (const i of [...hit].sort((a, b) => a - b)) {
    const r = runs[i];
    const last = boxes[boxes.length - 1];
    if (last && Math.abs(last.y - r.y) < r.h * 0.6) {
      const x1 = Math.min(last.x, r.x);
      const x2 = Math.max(last.x + last.w, r.x + r.w);
      last.x = x1; last.w = x2 - x1;
      last.h = Math.max(last.h, r.h);
    } else boxes.push({ ...r });
  }
  return boxes;
}

/** What page `n` of an extracted document says, for the turn that asks about it. */
export function pageText(text: string, pageNo: number): string {
  const re = new RegExp(`^--- page ${pageNo} ---$`, "m");
  const at = text.search(re);
  if (at === -1) return "";
  const rest = text.slice(at);
  const next = rest.slice(1).search(/^--- page \d+ ---$/m);
  return (next === -1 ? rest : rest.slice(0, next + 1)).replace(re, "").trim();
}

export const isPdf = (f: { name: string; type: string }) =>
  f.type === "application/pdf" || /\.pdf$/i.test(f.name);
