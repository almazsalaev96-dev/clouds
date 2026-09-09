/**
 * A line diff, so a revision can be read before it is accepted.
 *
 * Handing a document to a model and getting it back changed is only safe if
 * you can see what moved. Without that you are choosing between reading the
 * whole file again and trusting it — and people trust it, which is how a
 * quiet deletion in the middle of a working file ships.
 *
 * Longest common subsequence over lines. Character-level would be prettier and
 * is not worth it: what you need to answer is "what did it touch", and a line
 * is the unit people already think in.
 */

export type DiffOp = { type: "same" | "add" | "remove"; text: string };

export function lineDiff(before: string, after: string): DiffOp[] {
  const a = before.split("\n");
  const b = after.split("\n");

  /* Common prefix and suffix first. A revision usually changes a few lines in
     the middle of a long file, and trimming the untouched ends turns an
     O(n·m) table over the whole document into one over the part that moved. */
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) tail++;

  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);

  const ops: DiffOp[] = [];
  for (let i = 0; i < head; i++) ops.push({ type: "same", text: a[i] });

  // LCS table over the changed middle only.
  const n = midA.length;
  const m = midB.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      ops.push({ type: "same", text: midA[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: "remove", text: midA[i++] });
    } else {
      ops.push({ type: "add", text: midB[j++] });
    }
  }
  while (i < n) ops.push({ type: "remove", text: midA[i++] });
  while (j < m) ops.push({ type: "add", text: midB[j++] });

  for (let k = a.length - tail; k < a.length; k++) ops.push({ type: "same", text: a[k] });
  return ops;
}

export function diffStat(ops: DiffOp[]): { added: number; removed: number } {
  return {
    added: ops.filter((o) => o.type === "add").length,
    removed: ops.filter((o) => o.type === "remove").length,
  };
}

/**
 * Unchanged runs longer than this are folded away. A diff you have to scroll
 * past a hundred identical lines to read is one nobody reads.
 */
export const CONTEXT_LINES = 3;

export function collapse(ops: DiffOp[]): (DiffOp | { type: "gap"; count: number })[] {
  const out: (DiffOp | { type: "gap"; count: number })[] = [];
  let run = 0;
  const flush = (upcoming: boolean) => {
    if (run === 0) return;
    const keepTop = out.length === 0 ? 0 : CONTEXT_LINES;
    const keepBottom = upcoming ? CONTEXT_LINES : 0;
    if (run <= keepTop + keepBottom + 1) return;
    const start = out.length - run;
    const hidden = run - keepTop - keepBottom;
    out.splice(start + keepTop, hidden, { type: "gap", count: hidden });
  };
  for (const op of ops) {
    out.push(op);
    if (op.type === "same") run++;
    else {
      flush(true);
      run = 0;
    }
  }
  flush(false);
  return out;
}
