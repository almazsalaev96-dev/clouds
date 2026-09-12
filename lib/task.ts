/**
 * What kind of work this is.
 *
 * The router already reads a request's *shape* — is there an image, how much
 * has to be read, is it code, does it need thinking about — and that is enough
 * to choose a model. It is not enough to choose a *behaviour*. "Check this" is
 * a different instruction for a proof than for a pull request than for a claim
 * about the world; so is "explain it", so is "what should I do next". The shape
 * of a request tells you what can answer it. The kind tells you what answering
 * it well would mean.
 *
 * Deliberately a small, closed set. A taxonomy with thirty branches is one
 * nobody can hold in their head and one where every new request lands in the
 * wrong branch; these six are the ones where *doing the job properly* differs,
 * and where getting it wrong is visible.
 *
 * ## It says "general" rather than guessing
 *
 * This is the whole discipline of the file, and it is the same one as
 * `lib/arith.ts` and `lib/cite.ts`. A classifier that is right 70% of the time
 * and confident every time is worse than no classifier, because the 30% is
 * invisible: an answer shaped for the wrong job reads exactly like an answer
 * shaped for the right one. So a request has to *earn* its kind with more than
 * one signal, conflicting evidence collapses to `general`, and `general` is a
 * real answer meaning "behave the way you behave by default" rather than a
 * failure. Most requests are general. That is correct and not a bug.
 */

export type TaskKind =
  /** Somebody is trying to understand something, not to obtain it. */
  | "learning"
  /** Code: writing it, fixing it, reviewing it, explaining it. */
  | "coding"
  /** A claim about the world that stands or falls on evidence. */
  | "research"
  /** Prose that will be read by someone other than the person asking. */
  | "writing"
  /** Numbers: a table, a dataset, a calculation, a trend. */
  | "data"
  /** How something looks and behaves — layout, type, colour, interaction. */
  | "design"
  /** Everything else, which is most things. */
  | "general";

export interface Task {
  kind: TaskKind;
  /** What in the text decided it. Shown where the decision is shown. */
  why: string;
  /** How many independent signals agreed. One is never enough. */
  signals: number;
}

/**
 * The evidence for each kind.
 *
 * Two lists per kind, and both matter. `strong` is a phrase that means this
 * kind and almost nothing else — "unit test", "prove that", "cite". `weak` is a
 * word that leans without settling: "explain" appears in every kind of request
 * ever typed. A kind needs one strong signal, or two weak ones, which is the
 * cheapest rule that stops a single ambiguous word deciding anything.
 */
const EVIDENCE: Record<Exclude<TaskKind, "general">, { strong: RegExp[]; weak: RegExp[] }> = {
  learning: {
    strong: [
      /\b(teach me|help me understand|i don'?t understand|explain like i'?m|eli5)\b/i,
      /* Confusion, however it is worded. This used to be the single phrase
         "I'm confused", which missed every other way a person says the most
         valuable thing they can say to a tutor: "I keep getting confused",
         "I don't get it", "this makes no sense to me", "I'm lost". A stated
         confusion is a diagnosis handed over for free, and diagnosis is the
         thing every piece of tutoring research puts first — questioning
         somebody without it produces more engagement and no more learning. */
      /\b(?:i'?m|i am|im|i keep getting|i get|i'?ve been|still)\s+(?:really |so |completely |totally |a bit |very )?(?:confused|lost|stuck)\b/i,
      /\b(?:i don'?t get (?:it|this|why|how)|i'?m not following|doesn'?t make (?:any )?sense to me|makes no sense to me|lost me)\b/i,
      /\b(?:walk me through|break (?:this|it|that) down|where am i going wrong|what am i missing)\b/i,
      /\b(revise|revision|syllabus|past paper|exam question|mark scheme|for my (exam|test|course))\b/i,
      /\b(quiz me|test me|practice (questions?|problems?)|worked example)\b/i,
      /\b(why (is|does|do|are) .{0,40}\?|what does .{0,30} mean)\b/i,
    ],
    weak: [/\bintuition\b/i, /\bbeginner\b/i, /\bstep[- ]by[- ]step\b/i, /\bfrom scratch\b/i,
           /\bconcept\b/i, /\banalogy\b/i, /\bstudy(ing)?\b/i, /\blearn(ing)?\b/i],
  },
  coding: {
    strong: [
      /```/,
      /\b(unit test|stack ?trace|compile(r|s)? error|runtime error|null pointer|segfault)\b/i,
      /\b(refactor|debug|pull request|merge conflict|type ?error|linter?)\b/i,
      /\b(function|const |let |class |import |def |SELECT |=>|async |await )\b/,
    ],
    weak: [/\b(bug|api|regex|typescript|javascript|python|rust|golang|css|html|sql)\b/i,
           /\bcode\b/i, /\brepo(sitory)?\b/i, /\bdeploy\b/i, /[{};]\s*$/m],
  },
  research: {
    strong: [
      /\b(cite|citation|source[sd]?\b.{0,20}\bfor\b|according to|peer[- ]reviewed)\b/i,
      /\b(is it true that|what does the evidence|what do studies|find out whether)\b/i,
      /\b(literature|meta[- ]analysis|primary source)\b/i,
    ],
    weak: [/\bevidence\b/i, /\bstudy|studies\b/i, /\bresearch\b/i, /\bfact[- ]check\b/i,
           /\bwho (said|claimed|found)\b/i, /\bwhen did\b/i],
  },
  writing: {
    strong: [
      /\b(write|draft) (me )?(an?|the|this) (email|essay|letter|report|post|memo|summary|article|cover letter)\b/i,
      /\b(proofread|copy[- ]?edit|tighten this|rewrite this|make this sound)\b/i,
      /\b(tone|audience)\b.{0,30}\b(for|of)\b/i,
    ],
    weak: [/\bessay\b/i, /\bparagraph\b/i, /\bwording\b/i, /\bphras(e|ing)\b/i,
           /\bgrammar\b/i, /\bconcise|wordy\b/i, /\bdraft\b/i],
  },
  data: {
    strong: [
      /\b(csv|spreadsheet|dataset|pivot|regression|correlat(e|ion)|standard deviation)\b/i,
      /\b(mean|median|percentile)\b.{0,20}\b(of|for)\b/i,
      /\b(chart|graph|plot)\b.{0,20}\b(this|the data|these)\b/i,
    ],
    weak: [/\bdata\b/i, /\btable\b/i, /\bcolumn\b/i, /\brows?\b/i, /\btrend\b/i,
           /\boutliers?\b/i, /\bper cent|percent|%\b/i],
  },
  design: {
    strong: [
      /\b(make (it|this) (feel|look) )\b/i,
      /\b(typography|whitespace|visual hierarchy|colour palette|color palette|design system)\b/i,
      /\b(mock ?up|wireframe|layout)\b.{0,20}\b(for|of|this)\b/i,
    ],
    weak: [/\bspacing\b/i, /\bcontrast\b/i, /\bpalette\b/i, /\bfont\b/i, /\bui\b/i,
           /\bresponsive\b/i, /\baesthetic\b/i, /\bpremium\b/i, /\bpolish(ed)?\b/i],
  },
};

/** The order kinds are reported in when two tie, so the answer is stable. */
const ORDER: Exclude<TaskKind, "general">[] = ["coding", "data", "research", "learning", "design", "writing"];

const LABEL: Record<TaskKind, string> = {
  learning: "someone trying to understand this, not to be handed it",
  coding: "code",
  research: "a claim that stands or falls on evidence",
  writing: "prose someone else will read",
  data: "numbers",
  design: "how something looks and behaves",
  general: "no particular kind of work",
};

/**
 * Read a request for what kind of work it is.
 *
 * `text` is what was asked. `extra` is anything that came with it — an
 * attachment, the answer being checked — which is often the stronger evidence:
 * "is this right?" says nothing, and "is this right?" over four hundred lines
 * of TypeScript says everything.
 */
export function taskOf(text: string, extra = ""): Task {
  const whole = `${text}\n${extra}`.slice(0, 40_000);
  const scored: { kind: Exclude<TaskKind, "general">; strong: number; weak: number; hit: string }[] = [];

  for (const kind of ORDER) {
    const { strong, weak } = EVIDENCE[kind];
    let hit = "";
    let s = 0;
    for (const re of strong) {
      const m = re.exec(whole);
      if (m) { s++; hit ||= m[0].trim().slice(0, 40); }
    }
    let w = 0;
    for (const re of weak) {
      const m = re.exec(whole);
      if (m) { w++; hit ||= m[0].trim().slice(0, 40); }
    }
    // One strong signal, or two weak ones. A single leaning word decides nothing.
    if (s >= 1 || w >= 2) scored.push({ kind, strong: s, weak: w, hit });
  }

  if (scored.length === 0) return { kind: "general", why: LABEL.general, signals: 0 };

  const weight = (x: (typeof scored)[number]) => x.strong * 2 + x.weak;
  scored.sort((a, b) => weight(b) - weight(a) || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  /* Two kinds with the same weight is a request that is genuinely both, and
     picking one by tie-break would be picking one by alphabet. A request that
     is both a coding question and a teaching question should be answered as
     both, which is what the default behaviour already does. */
  const top = scored[0];
  if (scored.length > 1 && weight(scored[1]) === weight(top)) {
    return {
      kind: "general",
      why: `${LABEL[top.kind]} and ${LABEL[scored[1].kind]} in equal measure, so neither`,
      signals: weight(top),
    };
  }

  return {
    kind: top.kind,
    why: `${LABEL[top.kind]} — "${top.hit}"`,
    signals: weight(top),
  };
}

/**
 * What checking this kind of work actually means.
 *
 * §15 of the specification this came from, and the reason the kind is worth
 * detecting at all. A second opinion that asks the same four questions about a
 * proof, a pull request and a claim about the world is a second opinion that
 * misses what matters in all three. These are what a person who knew the
 * domain would look at first.
 *
 * `general` is deliberately empty rather than a list of platitudes: the
 * checker's standing instructions already cover "is it right", and adding
 * "check that it is accurate" on top only tells the model that somebody was
 * worried, which makes it find fault to justify the worry.
 */
export const CHECKS: Record<TaskKind, string[]> = {
  learning: [
    "Work any arithmetic or algebra through yourself rather than accepting it.",
    "Say if an explanation is *technically* right but builds the wrong intuition — that is the failure mode that matters here and it does not look like an error.",
    "Say if it answers a harder or easier question than the one asked.",
  ],
  coding: [
    "Read it for what it does, not for what it says it does.",
    "Name the input that breaks it: an empty list, a null, a duplicate, a boundary, a second call.",
    "Say if it would not compile, or would throw at runtime on an ordinary path.",
    "Say if it quietly changes behaviour the instruction did not ask to change.",
  ],
  research: [
    "Separate what is asserted from what is actually evidenced.",
    "Name any claim stated with more confidence than its support carries.",
    "Say if a source is named that does not say what it is cited for, or does not exist.",
    "Say if the strongest counter-evidence has been left out.",
  ],
  writing: [
    "Judge it against its purpose and its reader, not against your own taste.",
    "Say if the meaning has drifted from what was asked for.",
    "Leave voice alone unless it defeats the purpose; rewriting to your own preference is not checking.",
  ],
  data: [
    "Recompute the numbers. Arithmetic is the failure here and it is invisible.",
    "Say if a correlation is described as a cause.",
    "Say if a statistic assumes something the data does not establish — a distribution, independence, a representative sample.",
    "Say if a total, a percentage or a base does not reconcile.",
  ],
  design: [
    "Check it against contrast, hit size, and behaviour at a small screen and at a large text setting.",
    "Say if it breaks an existing convention in the same interface for no stated reason.",
    "Say if the visual weight of something does not match its importance.",
  ],
  general: [],
};
