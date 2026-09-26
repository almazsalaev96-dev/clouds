/**
 * Files people hand in: Word, PowerPoint and Excel, made here, from what
 * the app already has — a page in Markdown, a deck as HTML, a table in an
 * answer. The libraries load only when a button is pressed, so the first
 * load carries none of it.
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
export const isDeck = (html: string): boolean =>
  [...html.matchAll(/class=["']([^"']*)["']/g)].some((m) => m[1].split(/\s+/).includes("slide"));

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
    const bullets = [...s.querySelectorAll("li")].filter((li) => !li.closest("aside")).map((li) => text(li)).filter(Boolean);
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

const xml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Column letters the way a spreadsheet counts them: A … Z, AA … */
const col = (i: number): string => {
  let n = i + 1;
  let out = "";
  while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); }
  return out;
};

/**
 * A table, as an Excel workbook. Written by hand from the six files a
 * .xlsx is, rather than from a spreadsheet library: the one thing a table
 * in an answer needs is to open in Excel, Numbers or Sheets with its
 * figures as figures, and that is a zip of small XML. The zip library is
 * already here for Word and PowerPoint. Cells that read as numbers —
 * "1,200", "£4.50", "12%" — are written as numbers, so a column sums;
 * everything else is text, inline, so no shared-strings table is needed.
 */
export async function tableToXlsx(title: string, header: string[], rows: string[][]): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const { asNumber } = await import("./table");
  const cell = (v: string, r: number, c: number): string => {
    const ref = `${col(c)}${r + 1}`;
    const n = asNumber(v);
    if (n !== null && !/^[A-Za-z]/.test(v.trim())) return `<c r="${ref}"${r === 0 ? ' s="1"' : ""}><v>${n}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${r === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  };
  const all = [header, ...rows];
  const sheetRows = all.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => cell(v ?? "", ri, ci)).join("")}</row>`).join("");
  const widths = header.map((_, ci) => Math.min(60, Math.max(8, ...all.map((r) => (r[ci] ?? "").length + 2))));
  const cols = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`;
  const last = `${col(Math.max(0, header.length - 1))}${all.length}`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const name = xml((title || "Table").slice(0, 31).replace(/[\\/?*[\]:]/g, " ")) || "Table";
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("xl/worksheets/sheet1.xml", sheet);
  zip.file("xl/styles.xml", styles);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression: "DEFLATE" });
  save(blob, `${slug(title)}.xlsx`);
}
