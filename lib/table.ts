/**
 * Reading a rendered table back as data.
 *
 * Markdown gives the renderer a tree of cells, not a grid — which is enough
 * to draw and not enough to sort, because sorting needs to know that "1,200"
 * and "£1,200" and "1200" are the same number while "Q3" is not one at all.
 *
 * Pure, and separate from the component, because this is the part with the
 * edge cases in it.
 */

/**
 * A cell as a number, where it honestly is one.
 *
 * Deliberately narrow. A cell is a number when what is left after stripping
 * grouping commas, one leading currency symbol and one trailing unit is a
 * number and nothing else. "3 of 4" is not a number; "1,200" is; "£1.2m" is
 * not, because expanding suffixes is a guess about what somebody meant and a
 * sort that guesses wrong is worse than a sort that declines.
 */
export function asNumber(cell: string): number | null {
  const t = cell.trim();
  if (!t) return null;
  const cleaned = t
    .replace(/^[£$€¥]\s?/, "")
    .replace(/,(?=\d{3}\b)/g, "")
    .replace(/\s?%$/, "")
    .trim();
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * How a column should be compared.
 *
 * A column is numeric when every cell that has anything in it reads as a
 * number. One "n/a" among forty figures must not turn the column into text —
 * that is the case that makes a sort look broken — so blanks and a small set
 * of explicit non-answers are skipped rather than counted against it.
 */
const BLANK = new Set(["", "-", "–", "—", "n/a", "na", "null", "tbc", "tbd", "?"]);

export function columnIsNumeric(cells: string[]): boolean {
  let seen = 0;
  for (const c of cells) {
    const t = c.trim().toLowerCase();
    if (BLANK.has(t)) continue;
    if (asNumber(c) === null) return false;
    seen += 1;
  }
  return seen > 0;
}

/**
 * The row order for a column, as indices.
 *
 * Indices rather than rows so the caller keeps whatever else it has attached
 * to them, and a stable sort so pressing the same header twice is a reversal
 * rather than a reshuffle of the ties.
 */
export function sortRows(
  rows: string[][],
  column: number,
  direction: "asc" | "desc",
): number[] {
  const cells = rows.map((r) => r[column] ?? "");
  const numeric = columnIsNumeric(cells);
  const order = rows.map((_, i) => i);
  const sign = direction === "asc" ? 1 : -1;
  return order.sort((a, b) => {
    const x = cells[a] ?? "", y = cells[b] ?? "";
    const xb = BLANK.has(x.trim().toLowerCase());
    const yb = BLANK.has(y.trim().toLowerCase());
    /* Blanks go last whichever way the column is pointing. A column sorted
       descending that opens with six empty cells has buried its own answer. */
    if (xb !== yb) return xb ? 1 : -1;
    if (xb && yb) return a - b;
    if (numeric) {
      const nx = asNumber(x) ?? 0, ny = asNumber(y) ?? 0;
      return (nx - ny) * sign || a - b;
    }
    return x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" }) * sign || a - b;
  });
}

/**
 * The grid as CSV, to the rule everybody's spreadsheet agrees on.
 *
 * A field is quoted when it holds a comma, a quote or a newline, and a quote
 * inside a quoted field is doubled. Anything less and a table with one
 * "Smith, J." in it pastes into a spreadsheet one column wider than it
 * should be, silently, from that row down.
 */
export function toCsv(header: string[], rows: string[][]): string {
  const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [header, ...rows].map((r) => r.map((c) => cell(c ?? "")).join(",")).join("\n");
}
