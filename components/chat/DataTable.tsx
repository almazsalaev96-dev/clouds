"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Check, Copy, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { columnIsNumeric, sortRows, toCsv } from "@/lib/table";

/**
 * A table you can do something with.
 *
 * A model asked for a comparison answers with one, and until now it was a
 * picture of a table: you could read it and that was all. The two things
 * anybody wants next are to order it by the column they care about and to get
 * it into a spreadsheet, and both were a manual retype.
 *
 * ## Why the grid is read out of the tree
 *
 * The rendered cells are React elements, not data — enough to draw and not
 * enough to sort, because sorting has to know that "1,200" is a number and
 * "Q3" is not. So the hast node is walked once for a grid of strings, and the
 * sorted order is applied back to the rendered rows. The cells stay exactly
 * what the markdown renderer made of them — links, code, emphasis and all —
 * and only their order changes. Re-rendering the text would lose every one of
 * those.
 *
 * ## What it will not do
 *
 * It will not sort a column it cannot read: a header with no cells under it,
 * or a table whose body it could not parse, keeps its press and does nothing,
 * so the control is simply absent rather than present and lying.
 */
export function DataTable({ node, children }: { node?: unknown; children?: React.ReactNode }) {
  const [sort, setSort] = React.useState<{ column: number; direction: "asc" | "desc" } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  /* Walked once per table, not per press: the tree does not change and the
     press only reorders indices into it. */
  const grid = React.useMemo(() => readGrid(node), [node]);

  /* The rendered body, kept exactly as the markdown renderer made it.
     ---------------------------------------------------------------------
     The first version of this drew the cells from their own text, which
     typechecks, looks right on a table of figures, and silently flattens
     every link, every piece of inline code and every bit of emphasis a cell
     happens to hold. So the real rows are kept and only their *order*
     changes — the cells are never rebuilt at all. */
  const kids = React.Children.toArray(children);
  const body = kids.find(
    (k): k is React.ReactElement<{ children?: React.ReactNode }> =>
      React.isValidElement(k) && k.type === "tbody",
  );
  const bodyRows = body ? React.Children.toArray(body.props.children) : [];

  const order = React.useMemo(
    () => (sort && grid ? sortRows(grid.rows, sort.column, sort.direction) : null),
    [sort, grid],
  );

  const press = (i: number) => {
    setSort((s) =>
      s && s.column === i
        ? { column: i, direction: s.direction === "asc" ? "desc" : "asc" }
        /* Text opens A–Z and figures open largest-first, because that is what
           somebody pressing a column of numbers is nearly always looking for:
           the top of it. */
        : { column: i, direction: grid && columnIsNumeric(grid.rows.map((r) => r[i] ?? "")) ? "desc" : "asc" },
    );
  };

  const copy = async () => {
    if (!grid) return;
    try {
      await navigator.clipboard.writeText(toCsv(grid.header, order ? order.map((i) => grid.rows[i]) : grid.rows));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* A clipboard a browser refuses is not an error worth a red box in the
         middle of an answer. The button simply does not confirm. */
    }
  };

  /* The same rows, as a workbook: figures as figures, the header bold and
     frozen, a filter on it. What most people were about to do with the
     CSV anyway, without the paste. */
  const excel = async () => {
    if (!grid || saving) return;
    setSaving(true);
    try {
      const { tableToXlsx } = await import("@/lib/office");
      await tableToXlsx(grid.header.filter(Boolean).slice(0, 3).join(", ") || "Table", grid.header, order ? order.map((i) => grid.rows[i]) : grid.rows);
    } catch {
      /* A download the browser refuses is not worth a red box in an answer. */
    } finally {
      setSaving(false);
    }
  };

  /* Nothing parsed: draw exactly what was there before, with no controls. A
     header that looks pressable and is not is worse than a plain one. The
     row counts must agree too — if the tree and the rendered children have
     drifted, reordering one by the other would scramble the table. */
  if (!grid || !grid.rows.length || bodyRows.length !== grid.rows.length) {
    return (
      <div className="table-scroll">
        <table>{children}</table>
      </div>
    );
  }

  return (
    <div className="my-4">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {grid.header.map((h, i) => (
                <th key={i} aria-sort={sort?.column === i ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    onClick={() => press(i)}
                    aria-label={`Sort by ${h || `column ${i + 1}`}`}
                    className="focus-inset -mx-1 flex w-full items-center gap-1 rounded-sm px-1 text-left transition-colors duration-[var(--dur-fast)] hover:text-primary"
                  >
                    <span className="min-w-0 flex-1">{h}</span>
                    {sort?.column === i
                      ? (sort.direction === "asc" ? <ArrowUp size={11} className="shrink-0 text-accent" /> : <ArrowDown size={11} className="shrink-0 text-accent" />)
                      : <ArrowDown size={11} className="shrink-0 opacity-0 transition-opacity group-hover/table:opacity-40" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(order ?? grid.rows.map((_, i) => i)).map((rowIndex, at) => {
              const row = bodyRows[rowIndex];
              /* Re-keyed by where the row *came from* rather than where it
                 now sits, so React moves the existing row instead of
                 rewriting the one in that position. */
              return React.isValidElement(row)
                ? React.cloneElement(row, { key: `r${rowIndex}` })
                : <React.Fragment key={at}>{row}</React.Fragment>;
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-1 flex items-center justify-end gap-1">
        <button
          onClick={() => void excel()}
          aria-label="Save as Excel"
          className="focus-inset flex items-center gap-1 rounded-full px-2 py-0.5 text-tiny text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
        >
          <FileSpreadsheet size={11} />
          {saving ? "Saving…" : "Save as Excel"}
        </button>
        <button
          onClick={() => void copy()}
          className="focus-inset flex items-center gap-1 rounded-full px-2 py-0.5 text-tiny text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
        >
          {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy as CSV"}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- reading -- */

type Hast = { tagName?: string; value?: string; children?: Hast[] };

function text(node: Hast | undefined): string {
  if (!node) return "";
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(text).join("");
}

function rowsOf(node: Hast | undefined): Hast[] {
  if (!node) return [];
  if (node.tagName === "tr") return [node];
  return (node.children ?? []).flatMap(rowsOf);
}

/**
 * The table as strings — what sorting needs, and nothing that gets drawn.
 *
 * The rendered cells are never taken from here. They stay the elements the
 * markdown renderer produced, and this only decides what order they go in.
 */
function readGrid(node: unknown): { header: string[]; rows: string[][] } | null {
  const root = node as Hast | undefined;
  if (!root) return null;
  const trs = rowsOf(root);
  if (trs.length < 2) return null;

  const cellsOf = (tr: Hast) => (tr.children ?? []).filter((c) => c.tagName === "th" || c.tagName === "td");
  const header = cellsOf(trs[0]).map(text);
  if (!header.length) return null;

  const rows = trs.slice(1).map((tr) => cellsOf(tr).map(text));
  return { header, rows };
}
