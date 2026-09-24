/**
 * Save as PDF, the way every browser already can.
 *
 * A page, a pack, a lesson or an answer opens in a window of its own —
 * typeset for paper, nothing else on it — and the print dialog comes up,
 * where every browser and every phone offers "Save as PDF" or the share
 * sheet. No PDF library: the browser's own engine sets every language and
 * every font the page can show, which a two-hundred-kilobyte generator
 * with three Latin fonts cannot, and the file name is the title.
 *
 * The markdown is set here with a small converter rather than the app's
 * renderer, which is React and cannot run in a page that is not the app.
 * It covers what pages are made of: headings, paragraphs, emphasis, code,
 * lists, quotes, tables, links and rules. Anything else prints as text.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string): string {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
  return t;
}

export function markdownToPrintHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  const para: string[] = [];
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para.length = 0; }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flush();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i += 1; }
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      i += 1;
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); out.push(`<h${h[1].length}>${inline(h[2].replace(/\s+#+$/, ""))}</h${h[1].length}>`); i += 1; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push("<hr>"); i += 1; continue; }
    if (/^\s*>\s?/.test(line)) {
      flush();
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, "").replace(/^\[!\w+\]\s*/, "")); i += 1; }
      out.push(`<blockquote>${inline(q.join(" "))}</blockquote>`);
      continue;
    }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush();
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cells(lines[i])); i += 1; }
      out.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const ordered = /\d/.test(li[2]);
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(`<li>${inline(m[3].replace(/^\[([ xX])\]\s*/, (_, c) => (c === " " ? "☐ " : "☑ ")))}</li>`);
        i += 1;
      }
      out.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }
    if (!line.trim()) { flush(); i += 1; continue; }
    para.push(line.trim());
    i += 1;
  }
  flush();
  return out.join("\n");
}

const STYLE = `
  @page { margin: 18mm 16mm; }
  html { font: 11pt/1.5 -apple-system, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif; color: #111; }
  body { margin: 0; max-width: 42em; }
  h1 { font-size: 20pt; line-height: 1.2; margin: 0 0 0.6em; letter-spacing: -0.01em; }
  h2 { font-size: 14pt; margin: 1.4em 0 0.4em; }
  h3 { font-size: 12pt; margin: 1.2em 0 0.3em; }
  p, li { orphans: 3; widows: 3; }
  ul, ol { padding-left: 1.4em; }
  blockquote { margin: 0.8em 0; padding: 0.2em 0 0.2em 0.9em; border-left: 2px solid #bbb; color: #333; }
  code { font: 9.5pt/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #f2f2f2; padding: 0 0.25em; border-radius: 3px; }
  pre { background: #f5f5f5; padding: 0.7em 0.9em; border-radius: 6px; overflow: hidden; white-space: pre-wrap; page-break-inside: avoid; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 10pt; page-break-inside: avoid; }
  th, td { border: 1px solid #ccc; padding: 0.3em 0.5em; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; }
  hr { border: 0; border-top: 1px solid #ccc; margin: 1.2em 0; }
  a { color: #1a4fa0; text-decoration: none; }
  .foot { margin-top: 2em; padding-top: 0.6em; border-top: 1px solid #ddd; font-size: 8.5pt; color: #666; }
`;

/**
 * Open the print dialog on a typeset copy. Returns false when the browser
 * blocked the window, so the caller can say so.
 */
export function printMarkdown(title: string, markdown: string, foot = "Made with Armi"): boolean {
  const w = window.open("", "_blank", "noopener=no");
  if (!w) return false;
  const safe = esc(title || "Untitled");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${safe}</title><style>${STYLE}</style></head><body>` +
    `<h1>${safe}</h1>${markdownToPrintHtml(markdown)}<p class="foot">${esc(foot)} · ${esc(new Date().toLocaleDateString())}</p>` +
    `<script>window.addEventListener("load", () => { setTimeout(() => window.print(), 150); });</script></body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
