/**
 * The names in the document engine, without the engine.
 *
 * What a document can be and which styles there are is needed where a menu
 * is drawn and where the model is told its options — both in the first
 * download. The engine itself (the stylesheets and the typesetting) is only
 * needed when somebody presses Save as PDF, so it lives in `document.ts`
 * and is loaded then.
 */
export type DocKind = "report" | "handout" | "worksheet" | "letter" | "cv" | "certificate" | "notes";
export type DocThemeId = "clean" | "academic" | "modern" | "minimal" | "warm" | "bold";

/** The styles, by name, in the order the menu shows them. */
export const DOC_STYLES: { id: DocThemeId; name: string }[] = [
  { id: "clean", name: "Clean" },
  { id: "academic", name: "Academic" },
  { id: "modern", name: "Modern" },
  { id: "minimal", name: "Minimal" },
  { id: "warm", name: "Warm" },
  { id: "bold", name: "Bold" },
];

export const DOC_KINDS: { id: DocKind; name: string; blurb: string }[] = [
  { id: "report", name: "Report", blurb: "A cover page, contents, numbered pages" },
  { id: "handout", name: "Handout", blurb: "A title band and a clear, scannable page" },
  { id: "worksheet", name: "Worksheet", blurb: "Name and date lines, space to write answers" },
  { id: "letter", name: "Letter", blurb: "A letterhead, the date, and the letter" },
  { id: "cv", name: "CV / résumé", blurb: "A strong header, tidy sections" },
  { id: "certificate", name: "Certificate", blurb: "One framed page, landscape" },
  { id: "notes", name: "Notes", blurb: "The plain page, well set" },
];


export const isDocKind = (v: unknown): v is DocKind => DOC_KINDS.some((k) => k.id === v);

/** The headings of a report, for its contents page. */
export function contentsOf(md: string): string[] {
  return [...md.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].replace(/\s+#+$/, "").replace(/[*_`]/g, "").trim()).filter(Boolean).slice(0, 30);
}

/** A kind worth guessing from the words, where none was chosen. */
export function kindFor(title: string, md: string): DocKind {
  const t = `${title}\n${md.slice(0, 400)}`.toLowerCase();
  if (/\bcertificate\b/.test(t)) return "certificate";
  if (/\b(cv|résumé|resume|curriculum vitae)\b/.test(t)) return "cv";
  if (/\bworksheet\b|\[lines?:\s*\d|_{5,}/.test(t)) return "worksheet";
  if (/^\s*dear\b/m.test(md) || /\b(yours sincerely|yours faithfully|kind regards)\b/.test(t)) return "letter";
  if (/\breport\b/.test(t) || contentsOf(md).length >= 5) return "report";
  return "notes";
}

