/**
 * One line of a page, as words.
 *
 * A list row shows the first line of a thing so the list is scannable
 * without opening anything — and the first line of a markdown page is a
 * heading, and the line after that is a bullet, so the notebook's rows read
 * "## The three words - Hypotonic - Isotonic" and the artifact rows read
 * "# Essay plan". Markup is for the renderer; a preview is prose.
 *
 * It was doing that for headings, bullets, quotes, links and emphasis, and
 * not for the two things that most often start a page somebody made here.
 * A revision timetable is a table, and its row read
 *
 *     | Day | Subject | |---|---| | Mon | Biology | | Tue | Maths |
 *
 * which is not a preview of a timetable, it is a preview of the file format.
 * And a notebook page that links another page kept the brackets: "See
 * [[Transport in plants]]". Both are now read the way a person reads them —
 * a table across, a link as its words.
 *
 * The other half is the joining. Every line was glued to the next with a
 * space, so three bullets became one run-on sentence with no punctuation
 * anywhere in it and the reader had to guess where each ended. Lines that
 * were *separate things* — a heading, a bullet, a row — are joined with a
 * dot now; lines that were one wrapped paragraph still join with a space,
 * because inserting punctuation into somebody's sentence is the opposite
 * fault.
 */

/** A table's separator row: pipes, dashes and colons, and no words at all. */
const RULE = /^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?$/;
const TABLE_ROW = /^\|.*\|$/;
const HEADING = /^\s{0,3}#{1,6}\s+/;
const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;
const QUOTE = /^\s*>\s?/;

export function plainLine(markdown: string, max = 120): string {
  /* Fenced code is left out entirely rather than flattened: a preview of a
     function body tells a reader nothing they can use to pick one page from
     five, and it is the one kind of content whose whitespace is its shape. */
  const lines = markdown.replace(/```[\s\S]*?```/g, "\n").split(/\r?\n/);

  const parts: { text: string; apart: boolean }[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (RULE.test(line)) continue;

    /* Is this line a thing of its own, or the middle of a sentence that
       happened to wrap? Decided before the marks come off, because that is
       the only moment the answer is visible. */
    let apart = false;
    let text = line;

    if (TABLE_ROW.test(text)) {
      apart = true;
      text = text
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(" · ");
      if (!text) continue;
    } else if (HEADING.test(text)) {
      apart = true;
      text = text.replace(HEADING, "");
    } else if (BULLET.test(text)) {
      apart = true;
      text = text.replace(BULLET, "");
    } else if (QUOTE.test(text)) {
      text = text.replace(QUOTE, "");
    }

    text = clean(text);
    if (text) parts.push({ text, apart });
  }

  let out = "";
  for (let i = 0; i < parts.length; i++) {
    if (i) {
      /* A dot marks a break the text does not already mark. After a full
         stop it is a second full stop, which is what "potential. · Ψ" looked
         like on the Library's first row. */
      const marked = /[.!?:;]$/.test(parts[i - 1].text);
      out += !marked && (parts[i].apart || parts[i - 1].apart) ? " · " : " ";
    }
    out += parts[i].text;
  }
  out = out.replace(/\s+/g, " ").trim();
  return out.length > max ? out.slice(0, max - 1).trimEnd() + "…" : out;
}

/** The marks that can sit anywhere in a line rather than starting one. */
function clean(s: string): string {
  return s
    /* A page that links another page says its name, not its address. Both
       spellings: `[[page]]`, and `[[page|what to call it here]]`, where the
       second half is the half a person wrote for a reader. */
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]{1,3}([^*_~`]+)[*_~`]{1,3}/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
