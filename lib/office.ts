/**
 * Files people hand in: Word and PowerPoint, made here, from what the app
 * already has — a page in Markdown, a deck as HTML. Both libraries load
 * only when a button is pressed, so the first load carries none of it.
 */

const slug = (s: string) => (s || "untitled").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "untitled";

const save = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
};

/** A built page that is a deck: one `.slide` section a slide. */
export const isDeck = (html: string): boolean => /class=["'][^"']*\bslide\b/.test(html);

const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

/**
 * The deck, as PowerPoint. Each slide keeps its heading, its bullets and
 * its paragraphs as text, and its speaker notes as notes; what the CSS
 * drew is not carried, since a picture drawn in CSS has no equivalent in a
 * .pptx and a wrong one is worse than none.
 */
export async function deckToPptx(html: string, title: string): Promise<number> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const doc = new DOMParser().parseFromString(html, "text/html");
  let slides = [...doc.querySelectorAll(".slide")];
  if (!slides.length) slides = [...doc.querySelectorAll("section")];
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = title;
  for (const s of slides) {
    const slide = pptx.addSlide();
    const heading = text(s.querySelector("h1, h2, h3"));
    const notes = text(s.querySelector("aside.notes, .notes, aside"));
    const bullets = [...s.querySelectorAll("li")].map((li) => text(li)).filter(Boolean);
    const paras = [...s.querySelectorAll("p")].filter((p) => !p.closest("aside")).map((p) => text(p)).filter(Boolean);
    const big = text(s.querySelector(".big, .number, strong.big"));
    if (heading) slide.addText(heading, { x: 0.5, y: 0.35, w: 9, h: 1.1, fontSize: 30, bold: true, fontFace: "Calibri" });
    const body = [
      ...bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })),
      ...paras.filter((t) => t !== heading && t !== big).map((t) => ({ text: t, options: { breakLine: true } })),
    ];
    if (big && !bullets.length && !paras.length) slide.addText(big, { x: 0.5, y: 1.8, w: 9, h: 2.5, fontSize: 60, bold: true, align: "center" });
    else if (body.length) slide.addText(body, { x: 0.7, y: 1.55, w: 8.6, h: 3.7, fontSize: 18, valign: "top", fontFace: "Calibri" });
    if (notes) slide.addNotes(notes);
  }
  await pptx.writeFile({ fileName: `${slug(title)}.pptx` });
  return slides.length;
}

/* Inline **bold**, *italic* and `code` into runs; everything else plain. */
async function runsOf(line: string) {
  const { TextRun } = await import("docx");
  const out: InstanceType<typeof TextRun>[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    if (m.index! > last) out.push(new TextRun(line.slice(last, m.index)));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true }));
    else if (t.startsWith("`")) out.push(new TextRun({ text: t.slice(1, -1), font: "Consolas" }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true }));
    last = m.index! + t.length;
  }
  if (last < line.length) out.push(new TextRun(line.slice(last)));
  return out;
}

/**
 * A page, as Word. Headings, paragraphs, bullets, numbered lists, quotes
 * and code blocks; tables become their rows as text. Enough for a set of
 * notes or a lesson to be handed in and edited by somebody else.
 */
export async function markdownToDocx(title: string, markdown: string): Promise<void> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");
  const children: InstanceType<typeof Paragraph>[] = [new Paragraph({ text: title || "Untitled", heading: HeadingLevel.TITLE })];
  const lines = markdown.replace(/\r/g, "").split("\n");
  let inCode = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (/^```/.test(line)) { inCode = !inCode; continue; }
    if (inCode) { children.push(new Paragraph({ children: [new TextRun({ text: line || " ", font: "Consolas", size: 18 })] })); continue; }
    if (!line.trim()) continue;
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length === 1 ? HeadingLevel.HEADING_1 : h[1].length === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      children.push(new Paragraph({ children: await runsOf(h[2]), heading: level }));
      continue;
    }
    const b = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (b) { children.push(new Paragraph({ children: await runsOf(b[1]), bullet: { level: Math.min(2, Math.floor((line.match(/^\s*/)?.[0].length ?? 0) / 2)) } })); continue; }
    const n = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (n) { children.push(new Paragraph({ children: [new TextRun(`${n[1]}. `), ...(await runsOf(n[2]))] })); continue; }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) { children.push(new Paragraph({ children: [new TextRun({ text: quote[1], italics: true })], indent: { left: 720 } })); continue; }
    if (/^\|/.test(line)) {
      if (/^\|\s*:?-+/.test(line)) continue;
      children.push(new Paragraph({ children: [new TextRun(line.split("|").map((c) => c.trim()).filter(Boolean).join("   "))] }));
      continue;
    }
    children.push(new Paragraph({ children: await runsOf(line.replace(/^\s*---+\s*$/, "")) , spacing: { after: 120 } }));
  }
  const doc = new Document({ creator: "Armi", title: title || "Untitled", sections: [{ children }] });
  save(await Packer.toBlob(doc), `${slug(title)}.docx`);
}
