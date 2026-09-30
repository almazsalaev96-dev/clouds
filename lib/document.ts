/**
 * The document engine: a designed PDF from a title and some Markdown.
 *
 * "Save as PDF" used to be the words on white in the system font — correct,
 * and indistinguishable from a printout of a web page. A document someone
 * hands in, sends or pins to a wall is judged on sight before a line of it
 * is read, so this sets it the way a designer would for its kind: a report
 * gets a cover and running page numbers, a worksheet a name line and space
 * to write, a letter a letterhead, a CV a two-tone header, a certificate a
 * frame. Six looks, each a palette and a pair of faces.
 *
 * It is HTML and CSS printed by the browser — the same route as before, on
 * purpose: the browser sets every language and every script the page can
 * show (Kazakh, Russian, Arabic, maths symbols) where a PDF library with
 * three Latin fonts cannot, and "Save as PDF" is in every print dialog on
 * every device. Pure: a string in, a string out, no DOM.
 */
import { markdownToPrintHtml } from "./print";
import { contentsOf, isDocKind, kindFor, type DocKind, type DocThemeId } from "./docmeta";

export { DOC_KINDS, DOC_STYLES, contentsOf, isDocKind, kindFor, type DocKind, type DocThemeId } from "./docmeta";

interface DocTheme {
  id: DocThemeId;
  name: string;
  /** Headings and rules. */
  accent: string;
  /** A second colour, for the band and the callouts. */
  soft: string;
  ink: string;
  muted: string;
  body: string;
  head: string;
}

const SANS = `"Inter", -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`;
const SERIF = `"Source Serif 4", "Iowan Old Style", Charter, Georgia, Cambria, "Noto Serif", "Times New Roman", serif`;

export const DOC_THEMES: DocTheme[] = [
  { id: "clean", name: "Clean", accent: "#0A63D8", soft: "#EEF4FD", ink: "#111827", muted: "#6B7280", body: SANS, head: SANS },
  { id: "academic", name: "Academic", accent: "#7A1F2B", soft: "#F7F1EC", ink: "#1B1B1B", muted: "#6D6259", body: SERIF, head: SERIF },
  { id: "modern", name: "Modern", accent: "#5B3CF5", soft: "#F1EEFF", ink: "#0F0F1A", muted: "#686880", body: SANS, head: SANS },
  { id: "minimal", name: "Minimal", accent: "#111111", soft: "#F4F4F4", ink: "#111111", muted: "#707070", body: SANS, head: SANS },
  { id: "warm", name: "Warm", accent: "#C2410C", soft: "#FFF4EC", ink: "#1F1712", muted: "#7A6A5E", body: SERIF, head: SANS },
  { id: "bold", name: "Bold", accent: "#0F766E", soft: "#E8F6F4", ink: "#0B1413", muted: "#5B6B69", body: SANS, head: SANS },
];

export const docThemeOf = (id: string | undefined): DocTheme => DOC_THEMES.find((t) => t.id === id) ?? DOC_THEMES[0];

export interface DocInput {
  title: string;
  subtitle?: string;
  /** Who it is from: a name, a class, a company. */
  author?: string;
  /** Shown as given; today's date when absent. */
  date?: string;
  kind?: DocKind;
  theme?: DocThemeId;
  markdown: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Space to write, where a worksheet asks for it: `[lines:4]` on a line of
 * its own becomes four ruled lines, and a run of underscores becomes a
 * blank to fill in. Done on the Markdown so the printer's converter never
 * sees the markers.
 */
function writeSpace(md: string): string {
  return md
    .replace(/^\s*\[lines?:\s*(\d{1,2})\]\s*$/gim, (_, n) => `<div class="lines" style="--n:${Math.min(20, Number(n))}"></div>`)
    .replace(/_{5,}/g, '<span class="blank"></span>');
}

/** The body as HTML, with the few things plain Markdown lacks put back. */
function bodyHtml(md: string, kind: DocKind): string {
  const html = markdownToPrintHtml(kind === "worksheet" ? writeSpace(md) : md)
    /* The converter escapes what it is given; the two markers above are the
       only HTML let back through, by exact shape. */
    .replace(/&lt;div class=&quot;lines&quot; style=&quot;--n:(\d+)&quot;&gt;&lt;\/div&gt;/g, '<div class="lines" style="--n:$1"></div>')
    .replace(/&lt;span class=&quot;blank&quot;&gt;&lt;\/span&gt;/g, '<span class="blank"></span>');
  return html;
}

function style(th: DocTheme, kind: DocKind, foot = ""): string {
  const landscape = kind === "certificate";
  return `
  @page { size: ${landscape ? "A4 landscape" : "A4"}; margin: ${landscape ? "12mm" : "20mm 18mm 22mm"};
    ${landscape ? "" : `@bottom-right { content: counter(page) " / " counter(pages); font: 8.5pt ${th.body}; color: ${th.muted}; }
    @bottom-left { content: ${JSON.stringify(foot)}; font: 8.5pt ${th.body}; color: ${th.muted}; }`} }
  ${kind === "report" ? "@page :first { @bottom-right { content: none; } @bottom-left { content: none; } }" : ""}
  * { box-sizing: border-box; }
  html { font: 10.5pt/1.55 ${th.body}; color: ${th.ink}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; }
  h1, h2, h3, h4 { font-family: ${th.head}; color: ${th.ink}; line-height: 1.2; break-after: avoid; }
  h1 { font-size: 22pt; margin: 0 0 0.3em; letter-spacing: -0.015em; }
  h2 { font-size: 14pt; margin: 1.5em 0 0.5em; padding-bottom: 0.25em; border-bottom: 1.5pt solid ${th.accent}; }
  h3 { font-size: 11.5pt; margin: 1.2em 0 0.35em; color: ${th.accent}; }
  p { margin: 0 0 0.7em; orphans: 3; widows: 3; }
  ul, ol { padding-left: 1.3em; margin: 0 0 0.8em; }
  li { margin: 0.15em 0; }
  li::marker { color: ${th.accent}; }
  strong { color: ${th.ink}; }
  a { color: ${th.accent}; text-decoration: none; }
  blockquote { margin: 1em 0; padding: 0.7em 1em; background: ${th.soft}; border-left: 3pt solid ${th.accent}; border-radius: 0 4pt 4pt 0; break-inside: avoid; }
  .callout-title { display: block; font: 600 9.5pt ${th.head}; color: ${th.accent}; margin-bottom: 0.25em; }
  .callout.warning, .callout.caution { border-left-color: #B45309; background: #FFF7E8; }
  .callout.warning .callout-title, .callout.caution .callout-title { color: #B45309; }
  code { font: 9pt/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: ${th.soft}; padding: 0 0.25em; border-radius: 3px; }
  pre { background: #F6F7F9; border: 0.75pt solid #E3E6EA; padding: 0.7em 0.9em; border-radius: 5pt; white-space: pre-wrap; break-inside: avoid; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 0.9em 0 1.1em; font-size: 9.5pt; break-inside: avoid; }
  th { background: ${th.accent}; color: #fff; font-weight: 600; text-align: left; padding: 0.45em 0.6em; }
  td { padding: 0.4em 0.6em; border-bottom: 0.75pt solid #E3E6EA; vertical-align: top; }
  tr:nth-child(even) td { background: #FAFBFC; }
  hr { border: 0; border-top: 0.75pt solid #D9DDE3; margin: 1.4em 0; }
  .meta { color: ${th.muted}; font-size: 9.5pt; }
  .sub { font-size: 12pt; color: ${th.muted}; margin: 0 0 1.2em; }
  /* The head of the first page, per kind. */
  .band { margin: 0 0 1.4em; padding: 0 0 0.9em; border-bottom: 3pt solid ${th.accent}; }
  .band .kicker { font: 600 8.5pt ${th.head}; letter-spacing: 0.12em; text-transform: uppercase; color: ${th.accent}; margin-bottom: 0.4em; }
  .cover { height: 247mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; }
  .cover .top { border-top: 8pt solid ${th.accent}; padding-top: 38mm; }
  .cover h1 { font-size: 32pt; max-width: 15em; }
  .cover .sub { font-size: 14pt; max-width: 28em; }
  .cover .bottom { border-top: 0.75pt solid #D9DDE3; padding-top: 0.8em; display: flex; justify-content: space-between; }
  .contents { break-after: page; }
  .contents ol { list-style: none; padding: 0; counter-reset: c; }
  .contents li { counter-increment: c; display: flex; gap: 0.8em; padding: 0.45em 0; border-bottom: 0.75pt dotted #CBD1D8; }
  .contents li::before { content: counter(c, decimal-leading-zero); color: ${th.accent}; font-weight: 600; }
  .fields { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1.2em; margin: 0 0 1.4em; }
  .fields div { border-bottom: 0.75pt solid ${th.ink}; padding-bottom: 0.2em; font-size: 9pt; color: ${th.muted}; }
  .lines { height: calc(var(--n) * 9mm); background: repeating-linear-gradient(to bottom, transparent 0, transparent calc(9mm - 0.75pt), #C9CFD6 calc(9mm - 0.75pt), #C9CFD6 9mm); margin: 0.4em 0 1em; }
  .blank { display: inline-block; min-width: 30mm; border-bottom: 0.75pt solid ${th.ink}; transform: translateY(-0.2em); }
  .letterhead { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2pt solid ${th.accent}; padding-bottom: 0.7em; margin-bottom: 2.2em; }
  .letterhead .from { font: 600 13pt ${th.head}; color: ${th.accent}; }
  .cvhead { background: ${th.accent}; color: #fff; margin: 0 0 1.4em; padding: 1.2em 1.4em; border-radius: 4pt; }
  .cvhead h1 { color: #fff; margin: 0; }
  .cvhead .sub { color: rgba(255,255,255,0.85); margin: 0.2em 0 0; }
  .cert { height: 184mm; border: 3pt solid ${th.accent}; outline: 0.75pt solid ${th.accent}; outline-offset: -3.5mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 16mm; }
  .cert .kicker { font: 600 10pt ${th.head}; letter-spacing: 0.3em; text-transform: uppercase; color: ${th.accent}; }
  .cert h1 { font-size: 34pt; margin: 0.3em 0; font-family: ${SERIF}; }
  .cert .body { max-width: 34em; font-size: 12pt; }
  .cert .sign { margin-top: 14mm; display: flex; gap: 30mm; }
  .cert .sign div { border-top: 0.75pt solid ${th.ink}; padding-top: 0.3em; min-width: 55mm; font-size: 9pt; color: ${th.muted}; }
  .foot { margin-top: 2em; font-size: 8.5pt; color: ${th.muted}; }
`;
}

/** The whole document, as a page ready for the print dialog. */
export function docHtml(input: DocInput): string {
  const kind: DocKind = input.kind && isDocKind(input.kind) ? input.kind : kindFor(input.title, input.markdown);
  const th = docThemeOf(input.theme);
  const title = esc(input.title.trim() || "Untitled");
  const sub = input.subtitle?.trim() ? esc(input.subtitle.trim()) : "";
  const author = input.author?.trim() ? esc(input.author.trim()) : "";
  const date = esc(input.date?.trim() || new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }));
  /* The title is on the page already; a leading "# Title" in the body would print it twice. */
  const md = input.markdown.replace(/^\s*#\s+.+\n+/, (m) => (m.replace(/^\s*#\s+/, "").trim().toLowerCase() === input.title.trim().toLowerCase() ? "" : m));
  const body = bodyHtml(md, kind);
  let head = "";
  switch (kind) {
    case "report": {
      const parts = contentsOf(md);
      head = `<section class="cover"><div class="top"><div class="band"><div class="kicker">Report</div></div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</div>` +
        `<div class="bottom meta"><span>${author}</span><span>${date}</span></div></section>` +
        (parts.length >= 3 ? `<section class="contents"><h2>Contents</h2><ol>${parts.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></section>` : "");
      break;
    }
    case "worksheet":
      head = `<div class="band"><div class="kicker">Worksheet</div><h1>${title}</h1>${sub ? `<p class="sub" style="margin:0">${sub}</p>` : ""}</div>` +
        `<div class="fields"><div>Name</div><div>Class</div><div>Date</div></div>`;
      break;
    case "letter":
      head = `<div class="letterhead"><span class="from">${author || title}</span><span class="meta">${date}</span></div>`;
      break;
    case "cv":
      head = `<div class="cvhead"><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</div>`;
      break;
    case "certificate":
      return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${style(th, kind)}</style></head><body>` +
        `<div class="cert">${/certificate/i.test(input.title) ? "" : '<div class="kicker">Certificate</div>'}<h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}<div class="body">${body}</div>` +
        `<div class="sign"><div>${author || "Signed"}</div><div>${date}</div></div></div></body></html>`;
    case "handout":
      head = `<div class="band"><div class="kicker">${author || "Handout"}</div><h1>${title}</h1>${sub ? `<p class="sub" style="margin:0">${sub}</p>` : ""}</div>`;
      break;
    default:
      head = `<h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : `<p class="meta" style="margin:0 0 1.4em">${date}</p>`}`;
  }
  /* The title in the margin, as a string CSS can hold: no quote or backslash to break it. */
  const foot = input.title.trim().slice(0, 60).replace(/["\\\n]/g, " ");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${style(th, kind, foot)}</style></head><body>${head}${body}</body></html>`;
}

/** Straight to the print dialog, where "Save as PDF" is. False when there is no document to print from. */
export async function printDocument(input: DocInput): Promise<boolean> {
  const { printHtml } = await import("./print");
  return printHtml(docHtml(input));
}
