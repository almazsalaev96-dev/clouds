/**
 * Pages that point at each other.
 *
 * A notebook whose pages cannot refer to one another is a pile, however
 * good the pages are. `[[Krebs cycle]]` in the middle of a sentence is the
 * cheapest link there is to write — no picker, no URL, the title you would
 * have typed anyway — and it is what turns three hundred pages into
 * something with a shape: the page it names is one press away, and at the
 * bottom of that page is every page that named it.
 *
 * Resolved by title, case-insensitively, against the pages that exist. A
 * link to a page that does not exist yet is drawn as one, and pressing it
 * makes the page: that is how the tools that got this right work, and the
 * alternative — a broken link — teaches people not to write them.
 *
 * Pure. The renderer is handed markdown with the links rewritten into
 * ordinary anchors carrying the page id, and one click handler on the
 * container reads the id back. No plugin, no new syntax in the renderer.
 */

export const LINK = /\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]/g;

export interface Link {
  /** The title as written, trimmed. */
  title: string;
  /** What the link shows, where `[[title|shown]]` gave one. */
  shown: string;
}

/** Every link on a page, in order, once each by title. */
export function linksIn(content: string): Link[] {
  const seen = new Set<string>();
  const out: Link[] = [];
  for (const m of content.matchAll(LINK)) {
    const title = m[1].trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    out.push({ title, shown: (m[2] ?? title).trim() });
  }
  return out;
}

export interface Page {
  id: string;
  title: string;
}

/** The page a title names, if there is one. */
export function resolveTitle(title: string, pages: Page[]): Page | null {
  const key = title.trim().toLowerCase();
  return pages.find((p) => p.title.trim().toLowerCase() === key) ?? null;
}

/**
 * The markdown with every `[[link]]` turned into an anchor the renderer
 * already knows how to draw.
 *
 * `#armi-note-<id>` for a page that exists and `#armi-new-<title>` for one
 * that does not, so the click handler can tell the two apart without a
 * second lookup. Inside a code span or fence the brackets are left alone:
 * `[[` is a real thing to write in code.
 */
export function withLinks(content: string, pages: Page[]): string {
  const parts = content.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part.replace(LINK, (_, t: string, s?: string) => {
        const title = t.trim();
        const shown = (s ?? title).trim();
        const page = resolveTitle(title, pages);
        return page
          ? `[${shown}](#armi-note-${page.id})`
          : `[${shown}](#armi-new-${encodeURIComponent(title)})`;
      });
    })
    .join("");
}

/** What a link's href says it points at. */
export function readLink(href: string): { kind: "note"; id: string } | { kind: "new"; title: string } | null {
  const note = href.match(/^#armi-note-(.+)$/);
  if (note) return { kind: "note", id: note[1] };
  const fresh = href.match(/^#armi-new-(.+)$/);
  if (fresh) return { kind: "new", title: decodeURIComponent(fresh[1]) };
  return null;
}

/**
 * Every page that names this one.
 *
 * The half of linking that no editor gives you for free and every serious
 * notebook is built on. Computed rather than stored: the pages are already
 * in memory for the index, and a stored backlink is one more thing to keep
 * true when a title changes.
 */
export function backlinksTo(page: Page, pages: (Page & { content: string })[]): Page[] {
  const key = page.title.trim().toLowerCase();
  return pages
    .filter((p) => p.id !== page.id)
    .filter((p) => linksIn(p.content).some((l) => l.title.toLowerCase() === key))
    .map(({ id, title }) => ({ id, title }));
}

/* -------------------------------------------------------------- outline -- */

export interface Heading {
  level: number;
  text: string;
  /** Which heading this is, counting from the top, for scrolling to it. */
  index: number;
}

/**
 * The headings, for a page long enough to need somewhere to stand.
 *
 * Read from the text rather than the rendered page, so it is available
 * while editing too. Fenced code is skipped: a `# comment` in a shell
 * block is not a section.
 */
export function outlineOf(content: string): Heading[] {
  const out: Heading[] = [];
  let inFence = false;
  let index = 0;
  for (const line of content.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (m) out.push({ level: m[1].length, text: m[2].replace(/[*_`]/g, ""), index: index++ });
  }
  return out;
}

/* ---------------------------------------------------------- reading time -- */

/** Words, the way a person would count them. */
export function wordCount(content: string): number {
  const t = content.trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * How long it takes to read, said the way people say it.
 *
 * Two hundred words a minute, which is the ordinary figure for prose read
 * with attention. Under a minute is "a minute" rather than "0 min": a page
 * is never nothing to read.
 */
export function readingTime(content: string): string {
  const words = wordCount(content);
  if (words === 0) return "";
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}
