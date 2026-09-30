/**
 * Files people hand in: Word, PowerPoint and Excel, made here, from what
 * the app already has — a page in Markdown, a deck as HTML, a table in an
 * answer. The libraries load only when a button is pressed, so the first
 * load carries none of it.
 */

/* A Russian or Kazakh title names its file too, in Latin letters: some
   browsers and file systems turn a Cyrillic file name into "download",
   and "byudzhet-poezdki.xlsx" is a name wherever it lands. */
const LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ә: "a", ғ: "gh", қ: "q", ң: "ng", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
};
export const slug = (s: string) =>
  [...(s || "untitled").toLowerCase()].map((c) => LATIN[c] ?? c).join("")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "untitled";

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
 * The deck, as PowerPoint — drawn in a theme by `lib/deck.ts`: a deck made
 * here carries its own slides as data and is drawn exactly; a deck the chat
 * wrote as a page is read into slides (headings, points, tables, big
 * numbers, notes) and drawn the same way, rather than dumped as text boxes.
 */
export async function deckToPptx(html: string, title: string, theme?: import("./deck").ThemeId): Promise<number> {
  const { deckInHtml, deckFromHtml, deckHtml, downloadPptx } = await import("./deck");
  const own = deckInHtml(html);
  /* The deck's own data is exact (charts, notes, layouts) — but only while
     the slides still say what it says. Edited by hand or by a refine, the
     page is the truth and the data is stale, so the page is read instead. */
  const said = (h: string) => (typeof DOMParser === "undefined" ? "" : [...new DOMParser().parseFromString(h, "text/html").querySelectorAll(".slide")].map((el) => text(el)).join("\u0000"));
  const fresh = own && said(deckHtml(own)) === said(html);
  const deck = own && fresh ? { ...own, theme: theme ?? own.theme } : deckFromHtml(html, title, theme ?? own?.theme ?? "clean");
  if (!deck) return 0;
  return downloadPptx(deck);
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
  const table: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (table.length && !/^\s*\|/.test(line)) children.push(await wordTable(table.splice(0)) as unknown as InstanceType<typeof Paragraph>);
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
    if (/^\s*\|/.test(line)) {
      /* A real Word table, header row bold and shaded, not the cells run
         together as a line of text. The rows are gathered until the table ends. */
      table.push(line);
      continue;
    }
    if (table.length) children.push(await wordTable(table.splice(0)) as unknown as InstanceType<typeof Paragraph>);
    children.push(new Paragraph({ children: await runsOf(line.replace(/^\s*---+\s*$/, "")) , spacing: { after: 120 } }));
  }
  if (table.length) children.push(await wordTable(table.splice(0)) as unknown as InstanceType<typeof Paragraph>);
  const doc = new Document({ creator: "Armi", title: title || "Untitled", sections: [{ children }] });
  save(await Packer.toBlob(doc), `${slug(title)}.docx`);
}

/** Markdown table lines as a Word table: header bold on a light fill, full width. */
async function wordTable(lines: string[]) {
  const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, ShadingType } = await import("docx");
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const rows = lines.filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)).map(cells);
  const width = Math.max(1, ...rows.map((r) => r.length));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((r, ri) => new TableRow({
      tableHeader: ri === 0,
      children: Array.from({ length: width }, (_, ci) => new TableCell({
        shading: ri === 0 ? { type: ShadingType.CLEAR, color: "auto", fill: "E8EEF8" } : undefined,
        children: [new Paragraph({ children: [new TextRun({ text: (r[ci] ?? "").replace(/\*\*/g, ""), bold: ri === 0 })] })],
      })),
    })),
  });
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
  await sheetsToXlsx(title, [{ name: title || "Table", header, rows }]);
}

export interface Sheet { name: string; header: string[]; rows: string[][] }

/**
 * Several tables, as one workbook with a sheet each. A cell that starts
 * with "=" is written as a formula, so a total stays a total when a figure
 * above it changes; Excel works the value out when the file opens. The
 * header row is bold on the accent colour, frozen, and filterable.
 */
export async function sheetsToXlsx(title: string, sheets: Sheet[]): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const { asNumber } = await import("./table");
  const list = sheets.filter((sh) => sh.header.length || sh.rows.length).slice(0, 20);
  if (!list.length) throw new Error("No table to save.");
  const cell = (v: string, r: number, c: number): string => {
    const ref = `${col(c)}${r + 1}`;
    const style = r === 0 ? ' s="1"' : "";
    const t = v.trim();
    if (r > 0 && /^=[A-Za-z(]/.test(t)) return `<c r="${ref}"><f>${xml(t.slice(1))}</f></c>`;
    const n = asNumber(v);
    if (n !== null && !/^[A-Za-z]/.test(t)) return `<c r="${ref}"${style}><v>${n}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  };
  const sheetXml = (sh: Sheet): string => {
    const all = [sh.header, ...sh.rows];
    const width = Math.max(1, ...all.map((r) => r.length));
    const rowsXml = all.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => cell(v ?? "", ri, ci)).join("")}</row>`).join("");
    const widths = Array.from({ length: width }, (_, ci) => Math.min(60, Math.max(8, ...all.map((r) => (r[ci] ?? "").length + 2))));
    const cols = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`;
    const last = `${col(width - 1)}${all.length}`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${rowsXml}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
  };
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0A63D8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  /* Sheet names: 31 characters, none of \ / ? * [ ] :, and no two alike. */
  const used = new Set<string>();
  const names = list.map((sh, i) => {
    let n = (sh.name || `Sheet ${i + 1}`).replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || `Sheet ${i + 1}`;
    while (used.has(n.toLowerCase())) n = `${n.slice(0, 27)} ${i + 1}`;
    used.add(n.toLowerCase());
    return n;
  });
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><definedNames>${list.map((sh, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(names[i]).replace(/'/g, "''")}'!$A$1:$${col(Math.max(1, sh.header.length, ...sh.rows.map((r) => r.length)) - 1)}$${sh.rows.length + 1}</definedName>`).join("")}</definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  list.forEach((sh, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh)));
  zip.file("xl/styles.xml", styles);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression: "DEFLATE" });
  save(blob, `${slug(title)}.xlsx`);
}

/**
 * The tables in a Markdown document, each named by the heading above it:
 * what a document becomes when it is saved as a workbook.
 */
export function tablesOf(markdown: string): Sheet[] {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const out: Sheet[] = [];
  let heading = "";
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|").replace(/\*\*/g, ""));
  for (let i = 0; i < lines.length; i++) {
    const h = /^#{1,4}\s+(.+?)\s*#*$/.exec(lines[i]);
    if (h) { heading = h[1].replace(/[*_`]/g, ""); continue; }
    if (/^\s*\|/.test(lines[i]) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const header = cells(lines[i]);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cells(lines[i])); i += 1; }
      i -= 1;
      out.push({ name: heading || `Table ${out.length + 1}`, header, rows });
    }
  }
  return out;
}
