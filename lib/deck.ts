/**
 * Presentations: a deck as data, drawn as a PowerPoint and as a page.
 *
 * A model asked for "slides" writes HTML, and HTML turned into a .pptx
 * loses everything that made it look like a deck — what came out was black
 * text on white, one text box a slide. So the deck is made the way a person
 * makes one: first what each slide is (a title, a section break, points, two
 * columns, a quotation, one big number, a table, a chart, steps on a
 * timeline), then drawn by this file in a theme — shapes, colours, native
 * PowerPoint charts and tables that stay editable, slide numbers, speaker
 * notes. The same data draws the preview page, so what is seen is what is
 * downloaded.
 *
 * Pure except `downloadPptx`, which loads the PowerPoint library only when
 * pressed.
 */

export type Layout = "title" | "section" | "bullets" | "two" | "quote" | "stat" | "table" | "chart" | "timeline" | "closing";

export interface Slide {
  layout: Layout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  left?: { heading?: string; bullets: string[] };
  right?: { heading?: string; bullets: string[] };
  quote?: string;
  by?: string;
  stat?: string;
  label?: string;
  table?: { header: string[]; rows: string[][] };
  chart?: { type: "bar" | "line" | "pie"; labels: string[]; series: { name: string; values: number[] }[] };
  steps?: { title: string; text?: string }[];
  notes?: string;
}

export interface Deck {
  title: string;
  subtitle?: string;
  theme: ThemeId;
  slides: Slide[];
}

export type ThemeId = "clean" | "midnight" | "chalk" | "sunrise" | "forest" | "ocean" | "mono" | "paper";

export interface Theme {
  id: ThemeId;
  name: string;
  bg: string;
  panel: string;
  title: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  font: string;
  head: string;
}

/* Hex without the #, as the PowerPoint library takes them. */
export const THEMES: Theme[] = [
  { id: "clean", name: "Clean", bg: "FFFFFF", panel: "F2F5FA", title: "0D1B2A", text: "243447", muted: "6B7A8C", accent: "0A7CFF", accent2: "00B3A4", font: "Calibri", head: "Calibri" },
  { id: "midnight", name: "Midnight", bg: "0B1020", panel: "151C33", title: "FFFFFF", text: "DCE3F2", muted: "8C97B3", accent: "7C9CFF", accent2: "4FE3C1", font: "Calibri", head: "Calibri" },
  { id: "chalk", name: "Chalkboard", bg: "1F3A2E", panel: "274A3A", title: "F5F1E6", text: "E6E1D3", muted: "A9B8A8", accent: "F2C94C", accent2: "F28B82", font: "Calibri", head: "Georgia" },
  { id: "sunrise", name: "Sunrise", bg: "FFF8F1", panel: "FFE9D6", title: "3A1F14", text: "4A3328", muted: "8A6F62", accent: "F2703A", accent2: "E0457B", font: "Calibri", head: "Georgia" },
  { id: "forest", name: "Forest", bg: "F4F7F2", panel: "E3ECDE", title: "1E3325", text: "2D4535", muted: "6C8272", accent: "2E8B57", accent2: "C28F2C", font: "Calibri", head: "Calibri" },
  { id: "ocean", name: "Ocean", bg: "F2F8FB", panel: "DCEEF6", title: "0B3044", text: "1D4357", muted: "5F7E8F", accent: "0077B6", accent2: "00A6A6", font: "Calibri", head: "Calibri" },
  { id: "mono", name: "Mono", bg: "FFFFFF", panel: "F1F1F1", title: "111111", text: "2A2A2A", muted: "777777", accent: "111111", accent2: "888888", font: "Arial", head: "Arial" },
  { id: "paper", name: "Paper", bg: "FBF8F1", panel: "F1EBDD", title: "2B2620", text: "3B342C", muted: "857B6E", accent: "B5523B", accent2: "3E6E8E", font: "Georgia", head: "Georgia" },
];

export const themeOf = (id?: string): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0];

const LAYOUTS: Layout[] = ["title", "section", "bullets", "two", "quote", "stat", "table", "chart", "timeline", "closing"];

/* --------------------------------------------------------------- asking -- */

/**
 * What the model is asked for: the deck as JSON and nothing else, with the
 * rules a good deck keeps — one idea a slide, few words, a mix of layouts,
 * the speaker's words in the notes rather than on the slide.
 */
export function deckPrompt(opts: { topic: string; source?: string; count?: number; level?: string; audience?: string; theme?: ThemeId }): string {
  const n = Math.min(20, Math.max(5, opts.count ?? 10));
  return `Make a presentation as JSON. Nothing but the JSON.

TOPIC: ${opts.topic}${opts.level ? `\nLEVEL: ${opts.level}` : ""}${opts.audience ? `\nAUDIENCE: ${opts.audience}` : ""}
SLIDES: about ${n}

THE SHAPE
{"title": "...", "subtitle": "...", "slides": [ SLIDE, ... ]}
Each SLIDE has "layout", "title", "notes" and the fields its layout uses:
- "title": the first slide — "subtitle".
- "section": a divider between parts — "subtitle" optional.
- "bullets": 3 to 5 "bullets", each under 12 words.
- "two": "left" and "right", each {"heading": "...", "bullets": [...]} — a comparison, before/after, pros/cons.
- "quote": "quote" and "by" — only a real, attributable quotation, never an invented one.
- "stat": one big "stat" (e.g. "71%", "1945", "3×10⁸ m/s") and a "label" saying what it is.
- "table": {"header": [...], "rows": [[...], ...]} — at most 5 rows and 4 columns.
- "chart": {"type": "bar"|"line"|"pie", "labels": [...], "series": [{"name": "...", "values": [numbers]}]} — only with real figures from the material or well-established facts.
- "timeline": "steps": [{"title": "...", "text": "..."}] — 3 to 6 steps of a process or a history.
- "closing": the last slide — "bullets" with the 3 things to remember.

HOW A GOOD DECK READS
- One idea a slide. Few words on the slide; what the speaker says goes in "notes" (2–4 sentences a slide).
- Mix the layouts: never three "bullets" slides in a row. Use "stat", "two", "table", "chart" or "timeline" wherever the content has that shape.
- Titles say the point ("Enzymes speed reactions by lowering activation energy"), not just the topic ("Enzymes").
- Start with "title", end with "closing". Add "section" slides only for decks of 12 or more.
- Correct and specific. Never invent numbers, dates or quotations.${opts.source ? `

Write it from this material, and only from it where it covers the topic:
<material>
${opts.source.replace(/<\/material>/gi, "</ material>")}
</material>` : ""}`;
}

const str = (v: unknown, max = 300) => (typeof v === "string" || typeof v === "number" ? String(v).replace(/\s+/g, " ").trim().slice(0, max) : "");
const strs = (v: unknown, max = 8, len = 200) => (Array.isArray(v) ? v.map((x) => str(x, len)).filter(Boolean).slice(0, max) : []);

/** The model's JSON, checked and mended: a slide it got wrong is repaired or left out, never drawn broken. */
export function parseDeck(raw: unknown, fallbackTitle = "Presentation", theme: ThemeId = "clean"): Deck | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const slides: Slide[] = [];
  for (const s of Array.isArray(r.slides) ? r.slides : []) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    let layout = (LAYOUTS as string[]).includes(String(o.layout)) ? (o.layout as Layout) : "bullets";
    const slide: Slide = { layout, title: str(o.title, 140), notes: str(o.notes, 1_500) || undefined, subtitle: str(o.subtitle, 200) || undefined };
    const side = (v: unknown) => (v && typeof v === "object" ? { heading: str((v as Record<string, unknown>).heading, 80) || undefined, bullets: strs((v as Record<string, unknown>).bullets, 6) } : undefined);
    if (layout === "bullets" || layout === "closing") slide.bullets = strs(o.bullets, 6);
    if (layout === "two") { slide.left = side(o.left); slide.right = side(o.right); if (!slide.left?.bullets.length || !slide.right?.bullets.length) { layout = slide.layout = "bullets"; slide.bullets = [...(slide.left?.bullets ?? []), ...(slide.right?.bullets ?? [])].slice(0, 6); } }
    if (layout === "quote") { slide.quote = str(o.quote, 400); slide.by = str(o.by, 100) || undefined; if (!slide.quote) continue; }
    if (layout === "stat") { slide.stat = str(o.stat, 24); slide.label = str(o.label, 160) || undefined; if (!slide.stat) continue; }
    if (layout === "table") {
      const t = o.table as Record<string, unknown> | undefined;
      const header = strs(t?.header, 5, 40);
      const rows = (Array.isArray(t?.rows) ? t!.rows : []).map((row) => strs(row, header.length || 5, 80)).filter((row) => row.length).slice(0, 7);
      if (!header.length || !rows.length) continue;
      slide.table = { header, rows: rows.map((row) => header.map((_, i) => row[i] ?? "")) };
    }
    if (layout === "chart") {
      const c = o.chart as Record<string, unknown> | undefined;
      const labels = strs(c?.labels, 12, 40);
      const series = (Array.isArray(c?.series) ? c!.series : [])
        .map((x) => ({ name: str((x as Record<string, unknown>)?.name, 40) || "Series", values: (Array.isArray((x as Record<string, unknown>)?.values) ? ((x as Record<string, unknown>).values as unknown[]) : []).map(Number).slice(0, labels.length) }))
        .filter((x) => x.values.length === labels.length && x.values.every(Number.isFinite))
        .slice(0, 4);
      if (!labels.length || !series.length) continue;
      const type = c?.type === "line" || c?.type === "pie" ? c.type : "bar";
      slide.chart = { type, labels, series: type === "pie" ? series.slice(0, 1) : series };
    }
    if (layout === "timeline") {
      slide.steps = (Array.isArray(o.steps) ? o.steps : []).map((x) => ({ title: str((x as Record<string, unknown>)?.title, 60), text: str((x as Record<string, unknown>)?.text, 140) || undefined })).filter((x) => x.title).slice(0, 6);
      if (slide.steps.length < 2) continue;
    }
    if (!slide.title && layout !== "quote" && layout !== "stat") continue;
    slides.push(slide);
  }
  if (!slides.length) return null;
  const title = str(r.title, 140) || slides[0].title || fallbackTitle;
  if (slides[0].layout !== "title") slides.unshift({ layout: "title", title, subtitle: str(r.subtitle, 200) || undefined });
  return { title, subtitle: str(r.subtitle, 200) || undefined, theme, slides: slides.slice(0, 30) };
}

/**
 * A deck made as a page (the chat's slides), read into slides: its headings,
 * bullets, paragraphs, big numbers, tables and notes. What it drew in CSS is
 * not carried; the theme draws instead.
 */
export function deckFromHtml(html: string, title: string, theme: ThemeId = "clean"): Deck | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  let els = [...doc.querySelectorAll(".slide")];
  if (!els.length) els = [...doc.querySelectorAll("section")];
  const t = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const slides: Slide[] = els.map((s, i): Slide => {
    const heading = t(s.querySelector("h1, h2, h3"));
    const notes = t(s.querySelector("aside.notes, .notes, aside")) || undefined;
    const bullets = [...s.querySelectorAll("li")].filter((li) => !li.closest("aside")).map((li) => t(li)).filter(Boolean);
    const paras = [...s.querySelectorAll("p")].filter((p) => !p.closest("aside")).map((p) => t(p)).filter((x) => x && x !== heading);
    const big = t(s.querySelector(".big, .number, .stat, strong.big"));
    const table = s.querySelector("table");
    if (i === 0) return { layout: "title", title: heading || title, subtitle: paras[0], notes };
    if (table) {
      const rows = [...table.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("th, td")].map((c) => t(c)));
      if (rows.length > 1) return { layout: "table", title: heading, table: { header: rows[0], rows: rows.slice(1, 8) }, notes };
    }
    if (big && !bullets.length) return { layout: "stat", title: heading, stat: big.slice(0, 24), label: paras.find((p) => p !== big), notes };
    if (i === els.length - 1 && bullets.length) return { layout: "closing", title: heading, bullets: bullets.slice(0, 6), notes };
    return { layout: "bullets", title: heading, bullets: (bullets.length ? bullets : paras).slice(0, 6), notes };
  }).filter((s) => s.title || s.bullets?.length);
  return slides.length ? { title, theme, slides } : null;
}

/* ------------------------------------------------------------ PowerPoint -- */

/* 16:9 at 10 × 5.625 inches, PowerPoint's own widescreen. */
const W = 10;
const H = 5.625;

type Pptx = InstanceType<typeof import("pptxgenjs").default>;
type PSlide = ReturnType<Pptx["addSlide"]>;

function frame(pptx: Pptx, slide: PSlide, th: Theme, n: number, total: number) {
  slide.background = { color: th.bg };
  /* A thin accent bar at the top and the number at the foot: the two marks
     that make a set of slides read as one deck. */
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.08, fill: { color: th.accent }, line: { color: th.accent } });
  slide.addText(`${n} / ${total}`, { x: W - 1.3, y: H - 0.42, w: 1, h: 0.3, fontSize: 10, color: th.muted, align: "right", fontFace: th.font });
}

function heading(slide: PSlide, th: Theme, text: string) {
  slide.addText(text, { x: 0.6, y: 0.35, w: W - 1.2, h: 0.95, fontSize: 28, bold: true, color: th.title, fontFace: th.head, valign: "middle", fit: "shrink" });
}

function bulletsBox(slide: PSlide, th: Theme, items: string[], box: { x: number; y: number; w: number; h: number }, size = 20) {
  slide.addText(
    items.map((b) => ({ text: b, options: { bullet: { code: "25CF" }, breakLine: true, paraSpaceAfter: 10 } })),
    { ...box, fontSize: size, color: th.text, fontFace: th.font, valign: "top", fit: "shrink" },
  );
}

function draw(pptx: Pptx, s: Slide, th: Theme, n: number, total: number) {
  const slide = pptx.addSlide();
  const shape = pptx.ShapeType;
  if (s.layout === "title" || s.layout === "section") {
    slide.background = { color: s.layout === "title" ? th.bg : th.panel };
    slide.addShape(shape.rect, { x: 0, y: 0, w: 0.35, h: H, fill: { color: th.accent }, line: { color: th.accent } });
    slide.addShape(shape.ellipse, { x: W - 2.6, y: -1.2, w: 3.6, h: 3.6, fill: { color: th.accent2, transparency: 80 }, line: { color: th.accent2, transparency: 100 } });
    slide.addText(s.title, { x: 0.9, y: s.layout === "title" ? 1.5 : 1.9, w: W - 1.8, h: 1.5, fontSize: s.layout === "title" ? 40 : 34, bold: true, color: th.title, fontFace: th.head, valign: "bottom", fit: "shrink" });
    if (s.subtitle) slide.addText(s.subtitle, { x: 0.9, y: s.layout === "title" ? 3.1 : 3.45, w: W - 1.8, h: 0.9, fontSize: 18, color: th.muted, fontFace: th.font, valign: "top" });
    if (s.notes) slide.addNotes(s.notes);
    return;
  }
  frame(pptx, slide, th, n, total);
  heading(slide, th, s.title);
  const body = { x: 0.7, y: 1.45, w: W - 1.4, h: H - 2.1 };
  switch (s.layout) {
    case "bullets":
      bulletsBox(slide, th, s.bullets ?? [], body);
      break;
    case "closing":
      (s.bullets ?? []).slice(0, 4).forEach((b, i) => {
        const y = 1.5 + i * 0.85;
        slide.addShape(shape.ellipse, { x: 0.8, y, w: 0.55, h: 0.55, fill: { color: th.accent }, line: { color: th.accent } });
        slide.addText(String(i + 1), { x: 0.8, y, w: 0.55, h: 0.55, fontSize: 16, bold: true, color: "FFFFFF", align: "center", valign: "middle", fontFace: th.font });
        slide.addText(b, { x: 1.6, y: y - 0.05, w: W - 2.4, h: 0.65, fontSize: 19, color: th.text, fontFace: th.font, valign: "middle", fit: "shrink" });
      });
      break;
    case "two": {
      const col = (side: Slide["left"], x: number, color: string) => {
        slide.addShape(shape.roundRect, { x, y: 1.45, w: 4.1, h: H - 2.15, fill: { color: th.panel }, line: { color: th.panel }, rectRadius: 0.12 });
        slide.addShape(shape.rect, { x, y: 1.45, w: 4.1, h: 0.07, fill: { color }, line: { color } });
        if (side?.heading) slide.addText(side.heading, { x: x + 0.25, y: 1.6, w: 3.6, h: 0.5, fontSize: 18, bold: true, color, fontFace: th.head });
        bulletsBox(slide, th, side?.bullets ?? [], { x: x + 0.25, y: side?.heading ? 2.15 : 1.7, w: 3.6, h: H - (side?.heading ? 2.95 : 2.5) }, 16);
      };
      col(s.left, 0.6, th.accent);
      col(s.right, 5.3, th.accent2);
      break;
    }
    case "quote":
      slide.addText("“", { x: 0.6, y: 1.1, w: 1.2, h: 1.2, fontSize: 96, color: th.accent, fontFace: "Georgia" });
      slide.addText(s.quote ?? "", { x: 1.4, y: 1.5, w: W - 2.6, h: 2.3, fontSize: 24, italic: true, color: th.title, fontFace: "Georgia", valign: "middle", fit: "shrink" });
      if (s.by) slide.addText(`— ${s.by}`, { x: 1.4, y: 3.9, w: W - 2.6, h: 0.5, fontSize: 16, color: th.muted, fontFace: th.font });
      break;
    case "stat":
      slide.addText(s.stat ?? "", { x: 0.6, y: 1.5, w: W - 1.2, h: 1.9, fontSize: 88, bold: true, color: th.accent, align: "center", valign: "middle", fontFace: th.head, fit: "shrink" });
      if (s.label) slide.addText(s.label, { x: 1, y: 3.45, w: W - 2, h: 0.9, fontSize: 20, color: th.text, align: "center", fontFace: th.font, fit: "shrink" });
      break;
    case "table": {
      const t = s.table!;
      const head = t.header.map((h) => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: th.accent } } }));
      const rows = t.rows.map((r, i) => r.map((c) => ({ text: c, options: { color: th.text, fill: { color: i % 2 ? th.bg : th.panel } } })));
      slide.addTable([head, ...rows], { x: 0.6, y: 1.5, w: W - 1.2, fontSize: 14, fontFace: th.font, border: { type: "solid", pt: 0.5, color: th.panel }, autoPage: false });
      break;
    }
    case "chart": {
      const c = s.chart!;
      const type = c.type === "line" ? pptx.ChartType.line : c.type === "pie" ? pptx.ChartType.pie : pptx.ChartType.bar;
      const colors = [th.accent, th.accent2, th.muted, th.title];
      slide.addChart(type, c.series.map((x) => ({ name: x.name, labels: c.labels, values: x.values })), {
        x: 0.7, y: 1.4, w: W - 1.4, h: H - 2.0,
        chartColors: c.type === "pie" ? [th.accent, th.accent2, th.muted, th.title, "F2C94C", "9B8CFF"] : colors,
        showLegend: c.series.length > 1 || c.type === "pie", legendPos: "b", legendColor: th.text,
        catAxisLabelColor: th.text, valAxisLabelColor: th.muted, dataLabelColor: th.text,
        showValue: c.type === "pie", valGridLine: { color: th.panel, size: 0.5 },
      });
      break;
    }
    case "timeline": {
      const steps = s.steps ?? [];
      const gap = (W - 1.4) / steps.length;
      slide.addShape(shape.line, { x: 0.9, y: 2.35, w: W - 1.8, h: 0, line: { color: th.muted, width: 2 } });
      steps.forEach((st, i) => {
        const x = 0.7 + i * gap;
        slide.addShape(shape.ellipse, { x: x + gap / 2 - 0.25, y: 2.1, w: 0.5, h: 0.5, fill: { color: i % 2 ? th.accent2 : th.accent }, line: { color: th.bg, width: 2 } });
        slide.addText(st.title, { x, y: 2.75, w: gap - 0.1, h: 0.6, fontSize: 14, bold: true, color: th.title, align: "center", fontFace: th.font, fit: "shrink" });
        if (st.text) slide.addText(st.text, { x, y: 3.35, w: gap - 0.1, h: 1.3, fontSize: 11, color: th.text, align: "center", valign: "top", fontFace: th.font, fit: "shrink" });
      });
      break;
    }
  }
  if (s.notes) slide.addNotes(s.notes);
}

/** The deck as a .pptx file, in its theme. Returns the number of slides. */
export async function downloadPptx(deck: Deck): Promise<number> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = deck.title;
  const th = themeOf(deck.theme);
  deck.slides.forEach((s, i) => draw(pptx, s, th, i + 1, deck.slides.length));
  const name = (deck.title || "presentation").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "presentation";
  await pptx.writeFile({ fileName: `${name}.pptx` });
  return deck.slides.length;
}

/* ---------------------------------------------------------------- page -- */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The same deck as a page that runs: arrow keys, a counter, notes under
 * each slide in print. The deck's own data rides in the page, so the page
 * can be downloaded as the PowerPoint it was drawn from.
 */
export function deckHtml(deck: Deck): string {
  const th = themeOf(deck.theme);
  const c = (h: string) => `#${h}`;
  const list = (xs: string[]) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const body = deck.slides.map((s, i) => {
    let inner = "";
    switch (s.layout) {
      case "title":
      case "section":
        inner = `<div class="cover"><h1>${esc(s.title)}</h1>${s.subtitle ? `<p class="sub">${esc(s.subtitle)}</p>` : ""}</div>`;
        break;
      case "bullets":
        inner = `<h2>${esc(s.title)}</h2>${list(s.bullets ?? [])}`;
        break;
      case "closing":
        inner = `<h2>${esc(s.title)}</h2><ol class="remember">${(s.bullets ?? []).map((b) => `<li>${esc(b)}</li>`).join("")}</ol>`;
        break;
      case "two":
        inner = `<h2>${esc(s.title)}</h2><div class="cols">${[s.left, s.right].map((x, k) => `<div class="col c${k}">${x?.heading ? `<h3>${esc(x.heading)}</h3>` : ""}${list(x?.bullets ?? [])}</div>`).join("")}</div>`;
        break;
      case "quote":
        inner = `<h2>${esc(s.title)}</h2><blockquote>“${esc(s.quote ?? "")}”${s.by ? `<cite>— ${esc(s.by)}</cite>` : ""}</blockquote>`;
        break;
      case "stat":
        inner = `<h2>${esc(s.title)}</h2><div class="stat">${esc(s.stat ?? "")}</div>${s.label ? `<p class="label">${esc(s.label)}</p>` : ""}`;
        break;
      case "table":
        inner = `<h2>${esc(s.title)}</h2><table><thead><tr>${s.table!.header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${s.table!.rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        break;
      case "chart": {
        const ch = s.chart!;
        const max = Math.max(...ch.series.flatMap((x) => x.values), 1);
        inner = `<h2>${esc(s.title)}</h2><div class="bars">${ch.labels.map((l, k) => `<div class="bar"><span style="height:${Math.round((ch.series[0].values[k] / max) * 100)}%"></span><em>${esc(l)}</em><b>${ch.series[0].values[k]}</b></div>`).join("")}</div>`;
        break;
      }
      case "timeline":
        inner = `<h2>${esc(s.title)}</h2><ol class="steps">${(s.steps ?? []).map((st) => `<li><b>${esc(st.title)}</b>${st.text ? `<span>${esc(st.text)}</span>` : ""}</li>`).join("")}</ol>`;
        break;
    }
    return `<section class="slide ${s.layout}" data-n="${i + 1}">${inner}${s.notes ? `<aside class="notes">${esc(s.notes)}</aside>` : ""}</section>`;
  }).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(deck.title)}</title>
<script type="application/json" id="armi-deck">${JSON.stringify(deck).replace(/</g, "\\u003c")}</script>
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;background:${c(th.bg)};color:${c(th.text)};font-family:${th.font},system-ui,sans-serif}
.slide{position:absolute;inset:0;display:none;flex-direction:column;justify-content:center;padding:6vh 8vw;border-top:.8vh solid ${c(th.accent)}}
.slide.on{display:flex}h1,h2,h3{font-family:${th.head},system-ui,sans-serif;color:${c(th.title)};margin:0 0 3vh}h1{font-size:6vw;line-height:1.1}h2{font-size:3.6vw;line-height:1.15}h3{font-size:2vw}
.cover{border-left:1.2vw solid ${c(th.accent)};padding-left:3vw}.sub{font-size:2.2vw;color:${c(th.muted)}}.section{background:${c(th.panel)}}
ul,ol{font-size:2.3vw;line-height:1.5;margin:0;padding-left:1.2em}li{margin:.4em 0}li::marker{color:${c(th.accent)}}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:3vw}.col{background:${c(th.panel)};border-radius:1vw;padding:3vh 2vw;border-top:.6vh solid ${c(th.accent)}}.col.c1{border-top-color:${c(th.accent2)}}.col ul{font-size:1.8vw}
blockquote{font-family:Georgia,serif;font-style:italic;font-size:3vw;color:${c(th.title)};margin:0;border-left:.6vw solid ${c(th.accent)};padding-left:3vw}cite{display:block;font-size:1.8vw;color:${c(th.muted)};margin-top:2vh;font-style:normal}
.stat{font-size:12vw;font-weight:700;color:${c(th.accent)};text-align:center;line-height:1}.label{text-align:center;font-size:2.2vw}
table{border-collapse:collapse;font-size:1.8vw;width:100%}th{background:${c(th.accent)};color:#fff;text-align:left}th,td{padding:1.2vh 1.2vw}tr:nth-child(even) td{background:${c(th.panel)}}
.bars{display:flex;align-items:flex-end;gap:2vw;height:45vh}.bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%}.bar span{width:100%;background:${c(th.accent)};border-radius:.6vw .6vw 0 0}.bar em{font-style:normal;font-size:1.4vw;margin-top:1vh}.bar b{font-size:1.4vw;color:${c(th.muted)}}
.steps{list-style:none;padding:0;display:flex;gap:2vw;counter-reset:s}.steps li{flex:1;border-top:.5vh solid ${c(th.accent)};padding-top:2vh;font-size:1.7vw}.steps b{display:block;color:${c(th.title)}}.steps span{color:${c(th.muted)}}
.remember li{font-size:2.6vw}.notes{display:none}
#bar{position:fixed;left:0;bottom:0;height:.6vh;background:${c(th.accent)};transition:width .2s}#count{position:fixed;right:2vw;bottom:2vh;font-size:1.4vw;color:${c(th.muted)}}
@media print{.slide{display:flex!important;position:relative;height:100vh;page-break-after:always}.notes{display:block;font-size:12px;color:#555;margin-top:2vh}#bar,#count{display:none}@page{size:landscape}}
</style></head><body>
${body}
<div id="bar"></div><div id="count"></div>
<script>
const s=[...document.querySelectorAll('.slide')];let i=0;
function show(n){i=Math.max(0,Math.min(s.length-1,n));s.forEach((x,k)=>x.classList.toggle('on',k===i));document.getElementById('bar').style.width=((i+1)/s.length*100)+'%';document.getElementById('count').textContent=(i+1)+' / '+s.length}
addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' '].includes(e.key))show(i+1);if(['ArrowLeft','PageUp'].includes(e.key))show(i-1)});
addEventListener('click',e=>show(i+(e.clientX>innerWidth/3?1:-1)));show(0);
</script></body></html>`;
}

/** The deck a page was drawn from, when it was drawn here. */
export function deckInHtml(html: string): Deck | null {
  const m = /<script type="application\/json" id="armi-deck">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  try {
    const d = JSON.parse(m[1]) as Deck;
    return Array.isArray(d.slides) ? d : null;
  } catch {
    return null;
  }
}
