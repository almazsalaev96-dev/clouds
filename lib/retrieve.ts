/**
 * Finding the parts of a lot of text that bear on a question.
 *
 * A project with three hundred pages of material, a notebook with a term's
 * notes in it, a PDF of a textbook: none of them fits in a request, and the
 * app's answer until now was to send the front of each and cut the rest —
 * so the paragraph that answered the question was the one that did not
 * arrive. Retrieval picks by relevance instead of by position.
 *
 * BM25, the ranking that search engines ran on for twenty years before the
 * neural ones, and still the one they fall back to. Chosen over embeddings
 * on purpose: it needs no model, no vector store and no network, it runs in
 * a few milliseconds on a phone, and for the question "which paragraphs
 * mention the thing I asked about" it is very hard to beat. This app is
 * local-first, and a retrieval that phoned home would make it not.
 *
 * Pure. Text in, ranked pieces out.
 */

export interface Chunk {
  /** Which source it came from. */
  source: string;
  /** Where in that source, for a citation. */
  index: number;
  text: string;
}

/**
 * A source cut into pieces a paragraph or two long.
 *
 * On blank lines first, because a paragraph is the unit a person wrote in;
 * short paragraphs are joined up to about the target so a heading is not
 * a chunk on its own, and a paragraph much longer than it is split on
 * sentences. Sizes are in characters, which is what is cheap to count.
 */
export function chunk(source: string, text: string, target = 1_200): Chunk[] {
  const out: Chunk[] = [];
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  let buf = "";
  const flush = () => {
    if (buf.trim()) out.push({ source, index: out.length, text: buf.trim() });
    buf = "";
  };
  for (const p of paras) {
    if (p.length > target * 1.5) {
      flush();
      let piece = "";
      /* Sentences; and a run with no sentence in it — a table, a log, a
         file of numbers — cut on its lines, or at the target as a last
         resort. A piece longer than the budget is a piece never sent, and
         a source that was one such piece vanished whole. */
      const sentences = p
        .split(/(?<=[.!?])\s+/)
        .flatMap((s) => (s.length <= target * 2 ? [s] : s.split(/\n+/)))
        .flatMap((s) => {
          if (s.length <= target * 2) return [s];
          const bits: string[] = [];
          for (let i = 0; i < s.length; i += target) bits.push(s.slice(i, i + target));
          return bits;
        });
      for (const sentence of sentences) {
        if (piece.length + sentence.length > target && piece) {
          out.push({ source, index: out.length, text: piece.trim() });
          piece = "";
        }
        piece += (piece ? " " : "") + sentence;
      }
      if (piece.trim()) out.push({ source, index: out.length, text: piece.trim() });
      continue;
    }
    if (buf.length + p.length > target && buf) flush();
    buf += (buf ? "\n\n" : "") + p;
  }
  flush();
  return out;
}

/** Words, lowercased, with the ones that carry nothing taken out. */
const STOP = new Set(("a an the and or but if then of in on at to for from by with about as into like through after over between out against during without before under around among is are was were be been being have has had do does did not no nor so than too very can will just should would could may might must shall this that these those it its they them their there here what which who whom whose why how when where all any both each few more most other some such only own same").split(" "));

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2 && !STOP.has(w))
    /* A light stem: plurals and -ing/-ed, so "cycles" finds "cycle". Crude,
       and crude is right here — a stemmer that knew every language would be
       most of a library for a per cent of recall. */
    .map((w) => w.replace(/(ies)$/, "y").replace(/(sses|xes|ches|shes)$/, (m) => m.slice(0, -2)).replace(/(ing|ed|s)$/, "").replace(/^$/, w) || w);
}

/**
 * The pieces that best answer a question, most relevant first.
 *
 * BM25 with the usual constants (k1 = 1.2, b = 0.75). A term that appears
 * in every chunk says nothing and is weighed accordingly; a chunk that is
 * merely long is not favoured for it.
 */
export function rank(query: string, chunks: Chunk[], limit = 8): (Chunk & { score: number })[] {
  const q = [...new Set(tokens(query))];
  if (!q.length || !chunks.length) return [];
  const docs = chunks.map((c) => tokens(c.text));
  const avg = docs.reduce((n, d) => n + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length;
  const k1 = 1.2, b = 0.75;
  const scored = chunks.map((c, i) => {
    const d = docs[i];
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const t of q) {
      const f = tf.get(t) ?? 0;
      if (!f) continue;
      const n = df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avg)));
    }
    return { ...c, score };
  });
  return scored.filter((c) => c.score > 0).sort((a, b2) => b2.score - a.score || a.index - b2.index).slice(0, limit);
}

/**
 * What to send: the relevant pieces of every source, within a budget.
 *
 * The whole of a source goes when it fits — retrieval is for when it does
 * not, and cutting a short document into ranked fragments would lose the
 * thread for nothing. Over budget, the best pieces from across all sources
 * are taken in rank order until the budget is spent, then put back in
 * document order so the model reads them as they were written.
 */
export function select(
  query: string,
  sources: { name: string; text: string }[],
  budgetChars: number,
): { name: string; text: string; partial: boolean }[] {
  const total = sources.reduce((n, s) => n + s.text.length, 0);
  if (total <= budgetChars) return sources.map((s) => ({ ...s, partial: false }));
  /* Pieces sized to the budget, so that several can fit in it. A piece
     larger than what is left is a piece that never gets sent, and a source
     whose opening was one of those vanished entirely. */
  const target = Math.max(300, Math.min(1_200, Math.floor(budgetChars / 6)));
  const chunks = sources.flatMap((s) => chunk(s.name, s.text, target));
  const ranked = rank(query, chunks, chunks.length);
  const keep = new Set<string>();
  let spent = 0;
  const take = (c: Chunk | undefined) => {
    if (!c) return;
    const key = `${c.source}#${c.index}`;
    if (keep.has(key) || spent + c.text.length > budgetChars) return;
    keep.add(key);
    spent += c.text.length;
  };
  /* The piece that best answers the question goes first, before anything
     else can spend the budget it needs. Then every source's opening, so a
     question that names none of the words in a document still shows the
     model what the document is. Then the rest, best first. */
  take(ranked[0]);
  for (const s of sources) take(chunks.find((c) => c.source === s.name));
  for (const c of ranked) take(c);
  /* Then what sits either side of the best hits. An answer is written across
     a paragraph break as often as not — the question's words in one piece,
     the sentence that settles it in the next — and a piece on its own reads
     as a fragment. Cheap, and bounded by the budget like everything else. */
  for (const c of ranked.slice(0, 8)) {
    take(chunks.find((n) => n.source === c.source && n.index === c.index - 1));
    take(chunks.find((n) => n.source === c.source && n.index === c.index + 1));
  }
  return sources.map((s) => {
    const mine = chunks.filter((c) => c.source === s.name);
    const kept = mine.filter((c) => keep.has(`${c.source}#${c.index}`));
    if (!kept.length) return null;
    /* Put back in the order it was written, with a mark wherever something
       was left out, so nothing reads as continuous that was not. */
    const parts: string[] = [];
    let gap = false;
    for (const c of mine) {
      if (keep.has(`${c.source}#${c.index}`)) {
        if (gap) parts.push("[…]");
        parts.push(c.text);
        gap = false;
      } else gap = true;
    }
    if (gap) parts.push("[…]");
    return { name: s.name, text: parts.join("\n\n"), partial: kept.length < mine.length };
  }).filter((s): s is { name: string; text: string; partial: boolean } => Boolean(s));
}
