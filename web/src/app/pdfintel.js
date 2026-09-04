/**
 * Reading an imported document.
 *
 * "18 questions found" has to be true, so this counts them rather than asserting
 * them. Everything here is measured from the file: question numbering comes from
 * the text layer, figures from the page's own image operators, tables from columns
 * that actually line up. Where the evidence is thin the analysis says nothing
 * rather than guessing, because a confident wrong reading of a student's worksheet
 * is worse than no reading at all.
 *
 * None of this needs a model, which is why it works with no server and no
 * credentials. What it cannot do — read handwriting, explain an unseen question —
 * is left to the tutor, and the interface says so.
 */

const QUESTION_START = /^\s*(?:(?:Q|Question)\s*)?(\d{1,2})\s*[).:]\s*(?=\S)|^\s*(\d{1,2})\s+(?=[A-Z(√-]|\d+\s*[+\-×÷=])/;
const SUBPART = /^\s*\(?([a-h])\)\s*(?=\S)/;

const VOCABULARY = {
  Mathematics: ["equation", "solve", "factorise", "factorize", "simplify", "quadratic", "gradient",
    "integral", "differentiate", "trigonom", "sin", "cos", "tan", "hypotenuse", "algebra", "vector"],
  Physics: ["velocity", "acceleration", "newton", "joule", "circuit", "resistance", "momentum", "wavelength"],
  Chemistry: ["mole", "reaction", "compound", "titration", "electron", "isotope", "reagent"],
  Economics: ["demand", "supply", "elasticity", "market", "inflation", "gdp", "subsidy", "monopoly"],
  Biology: ["cell", "enzyme", "photosynth", "chromosome", "organism", "membrane"],
};

/** Text items grouped into lines by their baseline, left to right. */
function toLines(items) {
  const rows = new Map();
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    const key = Math.round(y / 4) * 4;      // tolerate sub-pixel baseline drift
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ x: item.transform[4], y, text: item.str });
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, parts]) => {
      parts.sort((a, b) => a.x - b.x);
      return { y, xs: parts.map((p) => Math.round(p.x)), text: parts.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim() };
    })
    .filter((line) => line.text.length > 0);
}

/**
 * Columns that line up across several rows. Three rows sharing three or more
 * left edges is a table; two rows that happen to share an indent is not.
 */
function countTables(lines) {
  const candidates = lines.filter((l) => l.xs.length >= 3);
  let tables = 0;
  let run = [];
  const signature = (l) => l.xs.slice(0, 6).map((x) => Math.round(x / 12)).join(",");
  for (const line of candidates) {
    if (run.length && signature(run[run.length - 1]) === signature(line)) run.push(line);
    else { if (run.length >= 3) tables += 1; run = [line]; }
  }
  if (run.length >= 3) tables += 1;
  return tables;
}

export async function analyse(pdf, onProgress = () => {}) {
  const questions = [];
  const pages = [];
  let figures = 0;
  let tables = 0;
  let words = 0;
  const corpus = [];

  const OPS = (window.pdfjsLib && window.pdfjsLib.OPS) || {};
  const imageOps = new Set([OPS.paintImageXObject, OPS.paintJpegXObject, OPS.paintInlineImageXObject]
    .filter((x) => x !== undefined));

  for (let i = 1; i <= pdf.numPages; i += 1) {
    onProgress(i, pdf.numPages);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = toLines(content.items);
    const text = lines.map((l) => l.text).join("\n");
    corpus.push(text.toLowerCase());
    words += text.split(/\s+/).filter(Boolean).length;

    for (const line of lines) {
      const m = QUESTION_START.exec(line.text);
      if (m) {
        const number = Number(m[1] ?? m[2]);
        // Numbering restarts on a new page in most worksheets, and a stray "2019"
        // in a header is not question 2019.
        if (number >= 1 && number <= 60) {
          questions.push({ number, page: i, text: line.text.slice(0, 220), parts: [] });
        }
      } else if (questions.length) {
        const sub = SUBPART.exec(line.text);
        if (sub) questions[questions.length - 1].parts.push(sub[1]);
      }
    }

    try {
      const ops = await page.getOperatorList();
      for (const fn of ops.fnArray) if (imageOps.has(fn)) figures += 1;
    } catch { /* an unreadable operator list is not worth failing an import for */ }

    tables += countTables(lines);
    pages.push({ index: i - 1, lines: lines.length, chars: text.length });
  }

  const joined = corpus.join(" ");
  let subject = null;
  let best = 0;
  for (const [name, terms] of Object.entries(VOCABULARY)) {
    const score = terms.reduce((n, t) => n + (joined.includes(t) ? 1 : 0), 0);
    if (score > best) { best = score; subject = name; }
  }

  return {
    pageCount: pdf.numPages,
    questions,
    figures,
    tables,
    words,
    // Two independent term matches before naming a subject; one is a coincidence.
    subject: best >= 2 ? subject : null,
    scanned: words < pdf.numPages * 12,
  };
}

/** The findings, in the order they are worth reading. */
export function findings(analysis) {
  const out = [];
  if (analysis.scanned) {
    out.push(["scan", "No text layer — this looks like a scan or photo. You can write on it, but the questions cannot be read without the tutor server."]);
    return out;
  }
  if (analysis.questions.length) {
    const parts = analysis.questions.reduce((n, q) => n + q.parts.length, 0);
    out.push(["questions", `${analysis.questions.length} numbered ${analysis.questions.length === 1 ? "question" : "questions"}` +
      (parts ? `, with ${parts} lettered parts` : "")]);
  } else {
    out.push(["questions", "No numbered questions — this reads as notes or a text rather than a worksheet."]);
  }
  if (analysis.figures) out.push(["figures", `${analysis.figures} ${analysis.figures === 1 ? "figure" : "figures"}`]);
  if (analysis.tables) out.push(["tables", `${analysis.tables} ${analysis.tables === 1 ? "table" : "tables"}`]);
  out.push(["pages", `${analysis.pageCount} ${analysis.pageCount === 1 ? "page" : "pages"}, about ${analysis.words.toLocaleString()} words`]);
  if (analysis.subject) out.push(["subject", `Reads as ${analysis.subject}`]);
  return out;
}
