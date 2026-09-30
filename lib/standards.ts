/**
 * The written standard for each kind of study material, and which kind a
 * chat ask is for.
 *
 * Split from lib/studio.ts because Craft loads with the first screen and
 * needs only this: the bar for revision notes, a mind map, an essay plan,
 * so a chat answer that is one of those is held to the same standard the
 * Studio holds it to. The recipes that write them stay out of that bundle.
 */

export type ToolId =
  | "notes" | "guide" | "organiser" | "cornell" | "flashcards" | "quiz" | "paper" | "questions"
  | "mindmap" | "glossary" | "timeline" | "summary" | "worked" | "essay" | "model"
  | "lesson" | "plan" | "listen" | "checker" | "faq" | "annotate" | "slides";

/**
 * The rules study material is written under, in brief, for a chat answer
 * that is study material. The Studio's own copy (lib/studio.ts HOUSE_RULES)
 * is the long form of the same eight.
 */
export const EDU_RULES = "This is study material, so: correct at the level asked; the subject's own terms and the exam board's wording, with the words a mark scheme looks for in bold and how the marks are earned; built to be recalled rather than reread — questions before, quick checks during, retrieval questions with answers after; small steps, one idea at a time; every idea with a concrete example, every method with a worked example and then one to try; a labelled diagram or table where a structure is easier seen than read; common mistakes and look-alikes named; nothing invented, and anything beyond the source marked as added.";

export const STANDARDS: Record<ToolId, { name: string; standard: string[] }> = {
  slides: {
    name: "Presentation",
    standard: [
      "One idea a slide, with a title that states the point rather than the topic",
      "Few words on a slide; what the speaker says is in the notes",
      "A mix of layouts — points, comparison, a big number, a table, a chart, a timeline — where the content has that shape",
      "Opens with a title slide and closes with the three things to remember",
      "Every figure, date and quotation is real",
    ],
  },
  notes: {
    name: "Revision notes",
    standard: [
    "Follows the order of the specification or source, one heading per topic, each opening with its big idea",
    "Opens with questions on what it builds on, and has a quick check after every topic",
    "Key points are short, numbered and exact enough to be marked right or wrong, with mark-scheme words in bold",
    "Every key term is defined in the subject's own wording",
    "Each method or calculation has a worked example with the reason for every step, then one for the student to try",
    "A diagram, table or timeline wherever a structure or process is easier seen than read",
    "Common mistakes and confusable look-alikes are named with the fix for each",
    "Says how each topic is examined: the command words and how the marks are awarded",
    "Ends with mixed retrieval questions and every answer",
    "Nothing is invented; anything added beyond the source is marked as added",
  ],
  },
  guide: {
    name: "Study guide",
    standard: [
    "An outline of the whole source in its own order",
    "A short-answer quiz of about ten questions with an answer key",
    "Three to five essay or extended questions that need the whole source",
    "A glossary of the key terms",
  ],
  },
  organiser: {
    name: "Knowledge organiser",
    standard: [
    "Fits on one page and every line could be asked and marked",
    "Must-knows are ranked most-examined first",
    "Key terms table is short and load-bearing",
    "Every formula has each symbol named",
    "Processes are numbered steps",
    "Says how the topic is asked, by command word",
  ],
  },
  cornell: {
    name: "Cornell notes",
    standard: [
    "Sections follow the ideas, not the chapter headings",
    "Every cue is a question that can be got wrong, answered by the note beside it",
    "Each section ends with a three-sentence summary",
    "Ends with the whole thing in ten lines",
  ],
  },
  flashcards: {
    name: "Flashcards",
    standard: [
    "One fact a card, one right answer, the same every time",
    "The question is answered from memory and never gives the answer away",
    "No lists: each member of a set on its own card with a cue that singles it out",
    "Look-alikes that get confused have a card asking how they differ",
    "Cards on causes, reasons and applications as well as definitions",
    "Covers what is examined and easy to get wrong, not trivia",
  ],
  },
  quiz: {
    name: "Quiz",
    standard: [
    "Every question has one correct option and plausible wrong ones built from real misconceptions",
    "Every option has a one-line explanation of why it is right or wrong",
    "Covers the whole source, easier questions first",
  ],
  },
  paper: {
    name: "Exam paper",
    standard: [
    "Questions are worded like the real paper, command word first, marks in square brackets",
    "Rises from short recall to at least one extended question",
    "The mark scheme gives one line per mark with accepted alternatives, and bands for extended answers",
    "Marks add up to the paper's total",
  ],
  },
  questions: {
    name: "Exam questions",
    standard: [
    "Recall, apply and evaluate tiers with the right command words",
    "A mark scheme line per mark, in the examiner's words",
    "A full-mark model answer for each",
    "Where marks are lost, for each",
  ],
  },
  mindmap: {
    name: "Mind map",
    standard: [
    "One central idea, four to eight main branches, each branch two to five leaves",
    "Leaves are short phrases, not sentences",
    "Branches follow how the ideas connect, not the order of the source",
  ],
  },
  glossary: {
    name: "Glossary",
    standard: [
    "Every load-bearing term in the source, alphabetical",
    "Definitions are exact and in the subject's wording",
    "Each term has a short example or use",
  ],
  },
  timeline: {
    name: "Timeline",
    standard: [
    "Every dated event or stage in the source, in order",
    "Each with its significance, not only its description",
    "Only dates the source gives or that are certain",
  ],
  },
  annotate: {
    name: "Annotated text",
    standard: [
    "Every annotation says what the passage shows, how (the technique or evidence, with a short quotation) and why it matters — never a technique named and left",
    "Sparse and purposeful: no passage marked without a comment",
    "Sources get provenance (nature, origin, purpose) and usefulness; papers get claim, evidence, method and limitation",
    "Ends with the points and quotations most worth learning, and questions with answers",
  ],
  },
  faq: {
    name: "FAQ",
    standard: [
    "Eight to fifteen questions a student would really ask, in the source's order",
    "Each answered in two to five sentences from the source, with its evidence",
    "Includes the questions about what is confusing or easily mixed up",
    "Says when the source does not answer a question rather than guessing",
  ],
  },
  summary: {
    name: "Summary",
    standard: [
    "Opens with the whole thing in one paragraph",
    "The main points in order, each with its evidence",
    "Says what the source does not cover",
  ],
  },
  worked: {
    name: "Worked examples",
    standard: [
    "Examples rise in difficulty and cover each method in the source",
    "Every step is shown with the reason for it, units and significant figures kept",
    "Each is followed by a similar problem to try, with its answer",
  ],
  },
  essay: {
    name: "Essay plan",
    standard: [
    "A clear, arguable thesis that answers the question",
    "Paragraphs each make one point with evidence and analysis",
    "A counter-argument that is answered, and a conclusion that judges",
  ],
  },
  model: {
    name: "Model answers",
    standard: [
    "A real exam-style question with its marks",
    "Three answers: a weak, a middle and a top-band one, each realistic",
    "Examiner comments that say exactly what moved each answer up a band",
  ],
  },
  lesson: {
    name: "Lesson",
    standard: [
    "Objectives a person can be tested on",
    "The explanation in the order the ideas depend on each other",
    "A worked example, practice rising in difficulty, and answers",
  ],
  },
  plan: {
    name: "Revision plan",
    standard: [
    "Every topic is covered at least twice, spaced, before the exam",
    "Every session mixes recall with practice questions, not rereading",
    "Weak topics come earlier and more often",
    "Leaves the last days for mixed past-paper practice",
  ],
  },
  listen: {
    name: "Listen",
    standard: [
    "Written for the ear: short sentences, signposting, no tables or symbols that cannot be said",
    "Covers the main ideas in order, with one example each",
    "Ends with three questions to answer out loud",
  ],
  },
  checker: {
    name: "Answer checker",
    standard: [
    "One judgement per mark point, with where it was earned or what was missing",
    "Never more marks than the question carries",
    "The student's own answer rewritten to full marks",
  ],
  },
};

/** Merge a study's standard onto the house one: the house lines first, none twice, at most fourteen. */
export function mergeStandard(house: string[], studied: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of [...house, ...studied]) {
    const k = line.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(line);
  }
  return out.slice(0, 14);
}

/* ------------------------------------------------- chat, universal -- */

/**
 * The tool a chat ask is for, when it names one: "make me revision notes
 * on…", "a mind map of…", "quiz me on…". Lets Craft hold a chat answer to
 * the same written standard as the Studio would, without spending a call
 * to study what the standard should be.
 */
export function toolForAsk(ask: string): { id: ToolId; name: string; standard: string[] } | null {
  const t = ask.toLowerCase();
  const pairs: [RegExp, ToolId][] = [
    [/\brevision notes?\b|\bstudy notes?\b|\bnotes on\b/, "notes"],
    [/\bknowledge organi[sz]er\b/, "organiser"],
    [/\bstudy guide\b/, "guide"],
    [/\bcornell\b/, "cornell"],
    [/\bmind ?map\b/, "mindmap"],
    [/\bglossary\b|\bkey terms\b/, "glossary"],
    [/\btimeline\b/, "timeline"],
    [/\bworked examples?\b/, "worked"],
    [/\bessay plan\b|\bplan (?:an|my) essay\b/, "essay"],
    [/\bmodel answers?\b|\bexemplar\b/, "model"],
    [/\brevision (?:plan|timetable|schedule)\b|\bstudy (?:plan|timetable|schedule)\b/, "plan"],
    [/\bexam questions?\b|\bpractice questions?\b|\bpast[- ]paper style\b/, "questions"],
    [/\blesson\b/, "lesson"],
    [/\bsummar(?:y|ise|ize)\b|\bbriefing\b/, "summary"],
    [/\bfaqs?\b|\bfrequently asked\b/, "faq"],
    [/\bannotat(?:e|ed|ion|ions)\b/, "annotate"],
  ];
  for (const [re, id] of pairs) if (re.test(t)) return { id, ...STANDARDS[id] };
  return null;
}
