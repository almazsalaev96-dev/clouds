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
  /** A shorter account of something longer, that has to stay true to it. */
  | "summarize"
  /** The same thing in another language. */
  | "translate"
  /** Getting from here to somewhere: steps, an order, what depends on what. */
  | "plan"
  /* Six more, from reading what people actually ask an assistant for
     (RESEARCH §15): the kinds where the general voice fails in a specific
     way. A choice answered with a balanced survey and no recommendation; a
     thing that will not work answered with a lecture instead of the first
     check; a symptom answered with either a diagnosis or a refusal; a law
     answered as if one jurisdiction were the world; a brainstorm answered
     with four safe ideas; a sum answered with a number and no working. */
  /** Which one: options, a purchase, a trade-off, a recommendation. */
  | "decide"
  /** Something that should work and does not — a device, a setting, a process; code has its own kind. */
  | "fix"
  /** A body: a symptom, a measurement, a medicine, a diet, training, sleep. */
  | "health"
  /** The law: a right, a contract, a rule, what is allowed. */
  | "legal"
  /** Ideas, names, options, angles — quantity and range, to pick from. */
  | "brainstorm"
  /** A problem with a worked answer: arithmetic, algebra, a proof, a physics or chemistry calculation. */
  | "math"
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
  /* Three kinds the classifier could not see. Each was landing in `general`
     and getting the general voice, which for these three is the wrong one in
     a specific way: a summary answered in the model's own words rather than
     the source's, a translation delivered with a paragraph of commentary, a
     plan given as a list of considerations with nothing to do first. */
  summarize: {
    strong: [
      /\bsummari[sz]e\b/i,
      /\btl;?dr\b/i,
      /\b(?:the gist|key points|main points|boil (?:this|it|that) down|sum (?:this|it|that) up)\b/i,
      /\bin (?:one|two|three|a few|five) (?:sentences?|lines?|words|bullets?)\b/i,
    ],
    weak: [/\bsummary\b/i, /\bshorter\b/i, /\boverview\b/i, /\bcondense\b/i, /\bdigest\b/i],
  },
  translate: {
    strong: [
      /\btranslate\b/i,
      /* "into" and "to" only. "in English" is how people ask for plain
         language, and a request to explain something in English is not a
         request to translate it. */
      /\b(?:into|to) (?:english|russian|uzbek|spanish|french|german|arabic|chinese|mandarin|japanese|korean|italian|portuguese|turkish|hindi|urdu|persian|farsi|kazakh|ukrainian|polish)\b/i,
      /\bhow do (?:you|i) say\b/i,
    ],
    weak: [/\btranslation\b/i, /\bmeaning of\b/i, /\bin (?:the )?original\b/i],
  },
  plan: {
    strong: [
      /\b(?:make|write|draft|create|build|give me|design|put together)\s+(?:me\s+)?an?\s+(?:\w+[- ]){0,2}?plan\b/i,
      /\b(?:roadmap|timeline for|schedule for|game plan|action plan)\b/i,
      /\bhow (?:should|do|can|would) i (?:plan|prepare|approach|get started|start|structure|organi[sz]e|tackle)\b/i,
    ],
    weak: [/\bplan(?:ning)?\b/i, /\bmilestones?\b/i, /\bdeadlines?\b/i, /\bpriorit(?:y|ies|i[sz]e)\b/i,
           /\bweek by week\b/i, /\bby (?:monday|friday|next week|next month|the end of)\b/i],
  },
  decide: {
    strong: [
      /\b(?:which|what) (?:one |of these |of them )?(?:should|would|do) (?:i|we|you) (?:buy|choose|pick|get|go (?:for|with)|use|take)\b/i,
      /\b(?:pros and cons|trade-?offs?|is it worth (?:it|buying|the money)|worth it\b)/i,
      /\b(?:recommend(?:ation)?s? (?:for|a|an|me)|what(?:'s| is) the best (?:option|choice|one|\w+ for))\b/i,
      /\b(?:x or y|a or b|this or that)\b/i,
      /\b(?:should i (?:buy|get|switch|upgrade|choose|go with|pick|take|accept|quit|move))\b/i,
    ],
    weak: [/\boptions?\b/i, /\bbudget\b/i, /\bcompare\b/i, /\bversus|\bvs\.?\b/i, /\balternatives?\b/i,
           /\bdecid(?:e|ing|sion)\b/i, /\bbetter\b/i, /\bcheaper\b/i, /\bfor my (?:needs|use case|situation)\b/i],
  },
  fix: {
    strong: [
      /\b(?:why (?:isn'?t|is(?:n'?t| not)|won'?t|doesn'?t|does not|can'?t) (?:this|it|my \w+|the \w+) (?:work(?:ing)?|turn(?:ing)? on|connect(?:ing)?|charg(?:e|ing)|start(?:ing)?|open(?:ing)?|load(?:ing)?|print(?:ing)?|sync(?:ing)?|boot(?:ing)?|respond(?:ing)?))\b/i,
      /\b(?:how do i fix|how to fix|what should i check first|troubleshoot(?:ing)?|not working|stopped working|keeps (?:crashing|freezing|disconnecting|restarting|turning off))\b/i,
      /\b(?:what caused|what'?s causing|what is causing) (?:this|the|it|my)\b/i,
    ],
    weak: [/\berror\b/i, /\bbroken?\b/i, /\bissue\b/i, /\bproblem\b/i, /\bwon'?t\b/i, /\bdoesn'?t\b/i,
           /\b(?:wifi|wi-fi|router|printer|battery|screen|bluetooth|iphone|ipad|android|laptop|windows|macos|update)\b/i],
  },
  health: {
    strong: [
      /\b(?:symptoms?|diagnos(?:is|ed|e)|side effects?|dosage|dose of|prescri(?:bed|ption)|is it (?:safe|normal|dangerous) (?:to|that|if)|should i (?:see|go to) (?:a|the) doctor|what (?:does|do) (?:my|this|these) (?:blood|test|lab|results?|readings?|levels?))\b/i,
      /\b(?:blood pressure|heart rate|resting hr|cholesterol|hba1c|glucose|bmi|vo2|iron|vitamin [a-z0-9]+|thyroid|ferritin|creatinine)\b/i,
      /\b(?:i (?:have|'ve had|feel|get|keep getting|woke up with) (?:a |an )?(?:headache|fever|rash|pain|chest pain|cough|dizz(?:y|iness)|nausea|cramps?|numbness|palpitations|insomnia|anxiety attack))\b/i,
      /\b(?:this (?:medication|medicine|pill|tablet|drug)|ibuprofen|paracetamol|acetaminophen|antibiotics?|antidepressants?|insulin|metformin|statins?)\b/i,
    ],
    weak: [/\bdoctor\b/i, /\bhealth\b/i, /\bmedical\b/i, /\bpain\b/i, /\bsleep\b/i, /\bdiet\b/i, /\bworkout|exercise|training plan\b/i,
           /\bcalories?|protein|macros\b/i, /\binjur(?:y|ed)\b/i, /\bcondition\b/i, /\bpregnan(?:t|cy)\b/i],
  },
  legal: {
    strong: [
      /\b(?:is (?:it|this|that) (?:legal|illegal|allowed|against the law)|can (?:they|my (?:landlord|employer|boss|school|university|bank)|the (?:police|council|company)) (?:legally )?(?:do|charge|fire|evict|withhold|refuse|keep|record|share|sue)\b)/i,
      /\b(?:my rights?|legal rights|statutory|what does (?:this|the) (?:law|clause|contract|section|article|regulation|act) (?:mean|say))\b/i,
      /\b(?:tenancy|lease agreement|notice period|deposit (?:back|return)|unfair dismissal|redundancy|small claims|gdpr|consumer rights|warranty claim|refund (?:rights|law)|visa (?:rules|requirements)|power of attorney|will and testament|custody|divorce)\b/i,
      /\b(?:should i (?:ask|get|see|talk to) a (?:lawyer|solicitor|attorney))\b/i,
    ],
    weak: [/\bcontract\b/i, /\blaw\b/i, /\blegal\b/i, /\blawyer|solicitor|attorney\b/i, /\bclause\b/i, /\bsue|lawsuit|court\b/i,
           /\blandlord|tenant|employer|employee\b/i, /\bfine|penalty\b/i, /\bjurisdiction\b/i, /\bliab(?:le|ility)\b/i],
  },
  brainstorm: {
    strong: [
      /\b(?:brainstorm|give me (?:some |a few |\d+ |ten |twenty )?(?:ideas|names|options|angles|titles|hooks|slogans|taglines|themes|prompts|topics|questions to ask))\b/i,
      /\b(?:ideas for (?:a|an|my|the)|name ideas|what (?:could|should) i (?:call|name)|(?:startup|business|app|product|content|video|gift|project|essay|story) ideas)\b/i,
      /\b(?:come up with|think of) (?:some |a few |\d+ )?(?:ideas|names|options|ways|alternatives|features)\b/i,
    ],
    weak: [/\bideas?\b/i, /\bcreative\b/i, /\bsuggestions?\b/i, /\binspiration\b/i, /\bpossibilit(?:y|ies)\b/i, /\bconcepts?\b/i],
  },
  math: {
    strong: [
      /\b(?:solve (?:for|this|the following|the equation|this (?:problem|question|equation|integral|sum))|find the (?:value|roots?|derivative|integral|area|volume|limit|probability|gradient|slope|mean|median|mode|range) of|simplify|factori[sz]e|differentiate|integrate|evaluate the (?:expression|integral|limit)|prove that|show that)\b/i,
      /(?:\d+\s*[+\-×x*/÷^]\s*\d+\s*=|=\s*\?|\^2|√|∫|∑|\bsin\(|\bcos\(|\blog\(|\bln\()/,
      /\b(?:how many (?:ways|moles|grams|joules|newtons|metres|meters|seconds)|what is \d[\d.,]*\s*(?:%|percent) of|convert \d|calculate the)\b/i,
      /\b(?:quadratic|simultaneous equations|pythagoras|trigonometry|binomial|matrix|vector|moles? of|molar mass|kinetic energy|momentum|ohm'?s law|stoichiometry)\b/i,
    ],
    weak: [/\bequation\b/i, /\bformula\b/i, /\bcalculate\b/i, /\bworking\b/i, /\bproof\b/i, /\bmaths?\b/i, /\bphysics\b/i, /\bchemistry\b/i,
           /\bunits?\b/i, /\bsignificant figures|s\.f\.|d\.p\.|decimal places\b/i, /\bmarks?\]/],
  },
};

/** The order kinds are reported in when two tie, so the answer is stable. */
const ORDER: Exclude<TaskKind, "general">[] = [
  "coding", "math", "fix", "health", "legal", "data", "research", "decide", "learning",
  "translate", "summarize", "plan", "brainstorm", "design", "writing",
];

const LABEL: Record<TaskKind, string> = {
  learning: "someone trying to understand this, not to be handed it",
  coding: "code",
  research: "a claim that stands or falls on evidence",
  writing: "prose someone else will read",
  data: "numbers",
  design: "how something looks and behaves",
  summarize: "a shorter account of something longer",
  translate: "the same thing in another language",
  plan: "a way to get from here to somewhere",
  decide: "a choice to make",
  fix: "something that should work and does not",
  health: "a question about a body",
  legal: "a question about the law",
  brainstorm: "ideas to pick from",
  math: "a problem with a worked answer",
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
  summarize: [
    "Say if it asserts anything the source does not — a summary that adds is a different document.",
    "Say if the proportions are off: a point the source makes in passing given a paragraph, or its main argument given a clause.",
  ],
  translate: [
    "Say where the meaning drifted, quoting both sides.",
    "Say if the register changed — formal made casual, or a plain sentence made ornate.",
  ],
  plan: [
    "Say if a step depends on something no earlier step establishes.",
    "Say if the first step is not something a person could do today.",
  ],
  decide: [
    "Say if it surveys the options and never says which. That is the failure here, and it reads as balance.",
    "Say if the recommendation rests on a fact about the person it was never told — their budget, their use, their constraint.",
    "Say if a price, a specification or an availability is stated as current without saying as of when.",
  ],
  fix: [
    "Say if the first thing it tells them to check is not the cheapest one to check.",
    "Say if it jumps to a cause without a step that would confirm or rule it out.",
    "Say if a step could lose data or make things worse and it did not say so first.",
  ],
  health: [
    "Check every number — a dose, a range, a threshold — against what the guidance actually says; a wrong dose is the worst thing on this list.",
    "Say if it names a diagnosis where it should name possibilities, or refuses where it should inform.",
    "Say if a sign that needs urgent care is missing or buried: chest pain, trouble breathing, a sudden severe headache, signs of stroke, an allergic reaction, thoughts of self-harm.",
  ],
  legal: [
    "Say if it states a rule as universal when the law differs by country or state, or if it never said which it was describing.",
    "Say if a deadline, a notice period or a limit is given as fact without its source.",
    "Say if it should have said where getting this wrong is costly and a lawyer is worth it, and did not.",
  ],
  brainstorm: [
    "Say if the ideas are variations on one idea. Range is the point.",
    "Say if any is unusable as stated — a name already famous for something else, an idea that breaks a constraint they gave.",
  ],
  math: [
    "Redo the working yourself. Check every line follows from the last, and that the final answer has units and sensible precision.",
    "Say if a sign, a unit conversion or a rearrangement is wrong, even when the final number happens to be right.",
    "Say if it solved a different problem — misread a figure, dropped a condition, assumed a value it was not given.",
  ],
  general: [],
};

/**
 * How hard to think, read off the kind of work rather than set on a switch.
 *
 * "Think longer" was a checkbox in the composer's Tools popover, which asked
 * the reader to predict whether the question they were about to type would
 * turn out to have steps in it. They cannot know that, and the ones who most
 * need the longer pass are the least likely to go looking for a toggle — the
 * same objection that took the mode switch out.
 *
 * Three kinds earn it, and they are the three where a wrong answer is wrong in
 * a way the reader cannot see: code that looks right and is not, arithmetic
 * that is off in the third step, and a claim about the world that sounds
 * settled. Explaining, writing and design are not on the list — a longer
 * thinking pass makes prose slower and no better, and the failure there is
 * being boring rather than being wrong.
 *
 * `undefined` rather than "medium" for the rest: absent means the model's own
 * setting stands, which is what the person chose if they ever chose one.
 */
const THINKS_HARDER = new Set<TaskKind>(["coding", "data", "research", "math"]);

export function effortFor(kind: TaskKind | undefined): "high" | undefined {
  return kind && THINKS_HARDER.has(kind) ? "high" : undefined;
}
