/**
 * One line of a page, as words.
 *
 * A list row shows the first line of a thing so the list is scannable
 * without opening anything — and the first line of a markdown page is a
 * heading, and the line after that is a bullet, so the notebook's rows read
 * "## The three words - Hypotonic - Isotonic" and the artifact rows read
 * "# Essay plan". Markup is for the renderer; a preview is prose.
 */
export function plainLine(markdown: string, max = 120): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]{1,3}([^*_~`]+)[*_~`]{1,3}/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}
