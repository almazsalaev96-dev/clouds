/**
 * How study material is written here, from what the learning sciences
 * have shown works — in one place, so every tool that writes for a student
 * (the Studio, the courses, the cards, the notebook, the chat) is held to
 * the same account of what makes something stick and score.
 *
 * The evidence, with sources, is RESEARCH.md §13. In short: testing beats
 * rereading (Roediger & Karpicke 2006); spacing and interleaving beat
 * massing (Cepeda et al. 2006/2008; Rohrer & Taylor 2007); small steps with
 * practice after each (Rosenshine); worked examples, then faded ones, for
 * novices (Sweller; Renkl & Atkinson); words and a meaningful picture
 * together (Paivio; Mayer); concrete examples and asking why (Chi); one
 * fact to a card and no lists (Wozniak); marks go to the command word, the
 * mark scheme's words, the working and the units (the exam boards' own
 * guidance and examiner reports).
 *
 * Plain strings, no model calls — tested in test-pedagogy.ts.
 */

/* --------------------------------------------------- for everything -- */

/** What every piece of study material is held to. */
export const LEARNING_RULES = [
  "1. Correct first. Only what is true at this level; where the source is wrong, unclear or out of date, say so plainly instead of repeating it.",
  "2. Aimed at the marks. Use the subject's own terms and the exam board's wording; bold the words a mark scheme looks for; say how the marks are earned (the command word, the working, the units).",
  "3. From the source. When a source is given, everything comes from it or is marked as added; never invent quotations, page numbers, statistics or specification codes.",
  "4. Built to be recalled, not reread. Start a topic with two or three questions on what came before; after every small chunk, a quick check; end with retrieval questions and their answers. Never advise highlighting or rereading as a way to revise — advise self-testing and spaced review.",
  "5. Small steps, one idea at a time. Short numbered chunks under headings that mirror the specification, a one-line big idea at the top of each, nothing decorative that does not serve the objective.",
  "6. Concrete, and asked why. Every abstract idea gets at least one concrete example (two contrasting ones where the idea is slippery, and a non-example); after a key claim, a 'Why?' or 'How does this connect to…?' prompt.",
  "7. Show, then fade. Every method or calculation: a full worked example with the reason for each step, then a similar one with the last steps left for the student, then one to do alone — with the answer.",
  "8. Words and a picture together. Where a process, structure, comparison or sequence is easier seen than read, draw it (a labelled diagram as a mermaid block, a table, a timeline), with labels on the thing they name — never a key to look up.",
  "9. What students get wrong. Name the common mistakes and the look-alikes that get confused, and say how to tell them apart.",
  "10. Pitched honestly. At the level given; if none is given, at school exam level, and say what you assumed in one line at the top. The student's language, keeping names, symbols and quoted terms exact.",
  "11. Complete and clean. No preamble, no filler, no placeholders, no 'as an AI'. Headings, tables and lists in Markdown.",
].join("\n");

/* ------------------------------------------------------- flashcards -- */

/**
 * The card rules: Wozniak's twenty rules of formulating knowledge and
 * Matuschak's five properties of a good prompt, as instructions.
 */
export const CARD_RULES = [
  "- One card, one fact: the answer is a word, a number, a short phrase or one sentence. If the back needs 'and', split it.",
  "- Focused, precise and consistent: exactly one right answer, the same every time, and the front never gives it away.",
  "- Recall, not recognition: the front is a question to answer from memory — never 'Tell me about X', never a yes/no or true/false.",
  "- No lists. Never ask for 'the seven features of…'; give each member its own card with a cue that singles it out ('Which characteristic of living things is removing waste?').",
  "- Look-alikes get their own card: when two things are easily confused, one card asks how they differ.",
  "- Understanding as well as facts: include cards on causes and effects, why something is so, what would change if…, and where it applies — not only definitions.",
  "- A definition, formula or fixed sequence may be a cloze: the sentence with one key term hidden as {{term}}. Hide one thing only.",
  "- Short and vivid: the fewest words that are still exact; a real example from the material where it makes the card easier to answer.",
  "- The important and the easy-to-get-wrong first — the distinction, the exception, the number, the unit, the order — not the trivia around them.",
].join("\n");

/* ------------------------------------------------------ exam marking -- */

/** How marks are really given, for writing mark schemes, model answers and marking. */
export const EXAM_RULES = [
  "- The command word sets the task: state/give/name = a bare fact; describe = what happens, no reasons; explain = reasons, each linked with because/so/therefore; evaluate/assess/discuss/to what extent = both sides then a supported judgement; justify = evidence for a choice; calculate = working and a final answer with units; show that = the method is the marks.",
  "- About one creditable point, or one developed link, a mark on points-based questions; the answer's length follows the marks.",
  "- The list rule: give exactly the number of points asked for; on a points question a wrong or contradictory point cancels a right one.",
  "- The mark scheme's own key words earn the mark; a near-miss paraphrase often does not. Precise technical terms, spelled right.",
  "- Working shown always: an early slip then loses one mark, not all of them (error carried forward).",
  "- Every numerical answer ends with its unit and a sensible number of significant figures.",
  "- Long answers (six marks and up) are marked to level descriptors by best fit: a sustained, developed line of reasoning that answers the question asked, and a judgement where it is asked for — not a checklist of facts.",
  "- Develop, do not list: point, evidence, explain, link back to the question.",
  "- Read the question's limits: 'not', 'only', 'using the source', dates, 'in this extract'.",
].join("\n");

/* ---------------------------------------------------- annotating texts -- */

export const ANNOTATE_RULES = [
  "- Sparse and purposeful: every mark carries a comment, a question or a connection — no highlighting for its own sake.",
  "- Literature: every annotation answers What (the idea or character trait shown), How (the named technique, with a one-to-five-word quotation) and Why (the effect on the reader and the writer's purpose, with context where it matters). Never stop at naming a technique. Zoom in on single words and offer a second reading ('could also suggest…'). Annotate structure as well as language: openings, shifts, endings, sentence and stanza form.",
  "- Historical sources: provenance first — Nature, Origin (who, when, insider or outsider), Purpose — then what it says and what it leaves out; end with one line on its usefulness for the enquiry.",
  "- Science and academic papers: Claim, Evidence, Method, Limitation, Question as margin tags; figures and their axes and error bars, not only the text.",
  "- Non-fiction and textbooks: turn each heading into a question, and after each section a one-line summary in plain words.",
  "- End with three to five questions that can be answered from the annotations, and their answers.",
].join("\n");

/* ---------------------------------------------------------- the level -- */

export type Stage = "school" | "university" | "other";

/** School, university or neither, from the words a student used for their level. */
export function stageOf(level: string): Stage {
  const l = level.toLowerCase();
  /* Cyrillic letters are not "word" characters to \b, so those words are
     bounded by hand. */
  const cy = (w: string) => new RegExp(`(^|[^а-яёәғқңөұүһі])${w}($|[^а-яёәғқңөұүһі])`).test(l);
  if (/univers|degree|\bb\.?sc\b|\bb\.?a\b|\bm\.?sc\b|\bmba\b|\bphd\b|bachelor|master|foundation year|undergrad|postgrad|\bmodule\b|college|freshman|sophomore|semester/.test(l) || cy("вуз") || cy("университет")) return "university";
  if (/gcse|a.?level|as.?level|\bib\b|\bap\b|highers|\bsat\b|\bact\b|year \d+|grade \d+|\bks\d|school|sixth form|\bbac\b|baccalaur|abitur|matric|\bege\b|\boge\b|\bjee\b|\bneet\b|gaokao/.test(l) || cy("ент") || cy("егэ") || cy("огэ")) return "school";
  return "other";
}

/** What changes with the level. */
export function stageRules(stage: Stage): string {
  if (stage === "university") {
    return [
      "UNIVERSITY LEVEL",
      "- Aim at a deep approach: the principle underneath, how it connects to what they know, and a question that asks them to apply it somewhere new.",
      "- Relational and beyond: include tasks that ask how two ideas together explain a third, and ones that generalise or hypothesise.",
      "- Proofs and derivations as Pólya's four steps — what is given and what must be shown, the strategy named, the steps with why each is legal, a look back — and faded across a set.",
      "- Problem sets interleaved: consecutive problems need different methods, so the method has to be chosen, not repeated.",
      "- The field's own terms and where the evidence or the debate stands; cite the source's claims, not general knowledge, where a source is given.",
    ].join("\n");
  }
  if (stage === "school") {
    return [
      "SCHOOL EXAM LEVEL",
      "- This specification's content and no further unless asked; mark each point with its specification reference where the source or course gives one.",
      "- Model answers written the way the board's mark scheme rewards, at the length the marks call for.",
      "- Worked examples before practice; the higher-tier or harder demand marked as such.",
    ].join("\n");
  }
  return "";
}

/* --------------------------------------------------- memory, honestly -- */

/** What to tell a student about studying, and what never to. */
export const STUDY_ADVICE = [
  "- Test yourself rather than reread; getting it wrong first and then checking still helps.",
  "- Spread it out: come back to each topic after a day, then a few days, then a week or two; mix topics rather than doing one at a time.",
  "- A mnemonic is for an arbitrary list or vocabulary, not a substitute for understanding.",
  "- Sleep after studying keeps it; an all-nighter costs more than it buys.",
  "- Never sort a student into visual, auditory or kinaesthetic 'learning styles' — words and a meaningful picture together help everyone.",
  "- Feeling fluent is not the same as knowing: rereading feels good and tests badly.",
].join("\n");
