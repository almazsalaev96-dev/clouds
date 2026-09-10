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

export const isPdf = (f: { name: string; type: string }) =>
  f.type === "application/pdf" || /\.pdf$/i.test(f.name);
