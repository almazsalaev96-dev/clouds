/**
 * Marking a typed answer.
 *
 * Write mode — type what you remember, then see — is the mode people use
 * most in the tools that offer it, and for a reason: recalling a word is a
 * different act from recognising it, and the difference is most of what an
 * exam tests. The marking has to be forgiving in the right places or the
 * mode is unusable: "the mitochondria" against "mitochondria" is right, and
 * "mitocondria" is a slip, not a lapse. So: punctuation, case, articles and
 * whitespace are ignored; a small edit distance is a near miss; and the
 * person always gets the last word, because the marker is a guess about
 * what they meant and they are not.
 *
 * Pure, and every rule has a test.
 */

/** What is left of an answer once the parts nobody marks are taken out. */
export function normalise(text: string): string {
  const bare = text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  /* An article comes off when it is in front of something — "the
     mitochondria" — and stays when it is the answer, or the end of one: "A" is
     a blood group, a grade and a note, and the A in "Vitamin A" is not an
     article at all. */
  const without = bare.replace(/\b(the|a|an)\s+(?=\S)/g, "").replace(/\s+/g, " ").trim();
  return without || bare;
}

/**
 * Edit distance, for the near misses — with a swap of two neighbours counted
 * as one edit rather than two. "1798" for "1789" and "teh" for "the" are the
 * commonest slips fingers make, and a marker that scored them as two
 * mistakes would call a typo a lapse. Small strings, so the plain table.
 */
export function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

export type Mark = "right" | "close" | "wrong";

/**
 * The verdict, and how it was reached.
 *
 * Right: the same once normalised, or the expected answer is one of several
 * the card lists ("Paris / Lutetia"), or the typed answer contains the whole
 * expected one. Close: within a couple of edits for a short answer, or a
 * tenth of its length for a long one — a typo, not a different answer.
 * Anything else is wrong, and the person is shown both and asked.
 */
export function mark(typed: string, expected: string): { mark: Mark; why: string } {
  const t = normalise(typed);
  if (!t) return { mark: "wrong", why: "nothing typed" };
  /* Several answers, or one answer with an "or" in it? "Paris / Lutetia" is
     a list; "it waits until input stops or a timeout fires" is a sentence,
     and marking "timeout fires" right against it would pass a clause off as
     the answer. A list is pieces that are all short. */
  /* A separator has room around it — "Paris / Lutetia", "x or y" — and a
     unit does not: "km/h" is one answer with a slash in it. */
  const pieces = expected.split(/\s*;\s*|\s+\/\s+|\s+or\s+/).map(normalise).filter(Boolean);
  const list = pieces.length > 1 && pieces.every((x) => x.split(" ").length <= 3);
  const options = list ? pieces : [normalise(expected)].filter(Boolean);
  if (!options.length) options.push(normalise(expected));
  for (const e of options) {
    if (t === e) return { mark: "right", why: "the same" };
    if (e.length >= 4 && t.includes(e)) return { mark: "right", why: "contains the answer" };
  }
  let best = Infinity;
  for (const e of options) best = Math.min(best, distance(t, e));
  const shortest = Math.min(...options.map((e) => e.length));
  const allowed = Math.max(1, Math.floor(shortest / 10), shortest <= 8 ? 1 : 2);
  if (best <= allowed) return { mark: "close", why: `${best} letter${best === 1 ? "" : "s"} off` };
  return { mark: "wrong", why: "different" };
}
