/**
 * Craft: the rule for when a task is more than a normal one, the study and
 * the judgement read off a model's words, and what the writer is told.
 *
 *   npx tsx test-craft.ts
 */
import { worthCrafting, parseStudy, parseJudgement, standardNote, improveNote, askFirst, judgePrompt, studyPrompt, craftLine, CRAFT_WORDS } from "./lib/craft";

let failed = 0;
const check = (c: boolean, l: string, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nWhen a task is more than a normal one");
{
  const yes = [
    "make me a website about business revision notes",
    "Build an app that tracks my reading",
    "write a cover letter for a junior analyst role at a bank",
    "design a landing page for a tutoring service",
    "put together a revision timetable for my A-levels",
    "Create flashcards for every enzyme in the Krebs cycle, with the substrate, the product and one exam-style question each",
    "draft a business plan for a small bakery in Leeds",
    "plan a 6-week course on Python for beginners",
    "Can you write me an essay on the causes of the First World War?",
    "I need a proposal for a school garden project that the head will read on Monday and it has to cover cost, safety, who runs it and what the children get from it",
  ];
  for (const a of yes) check(worthCrafting(a, "writing"), `yes: “${a.slice(0, 50)}”`);
  const no = [
    "thanks",
    "shorter",
    "what is a debounce",
    "what is 2+2",
    "17 * 23",
    "translate this into French: good morning",
    "who wrote Hamlet",
    "make it shorter",
    "and in France?",
    "is that right?",
    "how many days until Friday",
    "tell me a joke",
    "hi",
    "make me flashcards about debounce",
    "write me an email to my tutor asking for an extension",
    "create a function that debounces a callback",
    "save that as a note",
    "make me an assistant called Chem coach that always gives a safety note first",
    "make me a project called Timetable review with the rule Money in pounds",
    "set up a routine that quizzes me every weekday at 7:30 on what is due",
  ];
  for (const a of no) check(!worthCrafting(a, "general"), `no: “${a}”`);
  check(worthCrafting("summarise this", "summarize", 3_000), "a short ask over a lot of material is a task");
  check(!worthCrafting("summarise this", "summarize", 100), "and over a little, it is not");
  const long = Array.from({ length: CRAFT_WORDS }, (_, i) => `word${i}`).join(" ") + " please";
  check(worthCrafting(long, "general"), "a long ask is a task whatever its verb");
  check(!worthCrafting("", "general"), "nothing is nothing");
}

console.log("\nThe study, read off a reply");
{
  const raw = `Here you go:\n\`\`\`json\n${JSON.stringify({
    field: "A revision-notes website for business studies",
    makers: ["Save My Exams — notes by exam board, with questions and mark schemes", "Seneca — short notes with recall built in", "BBC Bitesize — plain words, one idea a screen"],
    standard: ["Organised by the exam board's own topic list", "Each note under 300 words with the key terms bold", "Practice questions with mark schemes", "Flashcards or recall on every topic", "A clear home page with the topics one press away", "Readable on a phone", "Free or a clear price with a free tier"],
    imagined: "A site they can actually revise from tonight: the topics laid out, notes they can read on a phone, and something to test themselves with.",
    unsure: null,
  })}\n\`\`\``;
  const s = parseStudy(raw, "m1");
  check(Boolean(s) && s!.standard.length === 7 && s!.makers.length === 3, "a fenced JSON study is read, with its standard and makers", `${s?.standard.length} · ${s?.makers.length}`);
  check(s!.unsure === null, "and no question when none was needed");
  const note = standardNote(s!);
  check(/The standard:/.test(note) && /Practice questions with mark schemes/.test(note) && /Deliver the whole thing/.test(note) && /No placeholders/.test(note), "the writer is handed the standard and told to deliver the whole thing");
  check(/do not mention it/.test(note), "and not to mention it");
  check(parseStudy('{"standard": ["one", "two"]}', "m") === null, "two lines of standard is not a study");
  check(parseStudy("I cannot help with that.", "m") === null, "prose is not a study");
  const unsure = parseStudy(JSON.stringify({ field: "x", makers: [], standard: ["a", "b", "c"], imagined: "", unsure: { question: "Which exam board?", options: ["AQA", "Edexcel", "OCR"] } }), "m");
  check(unsure?.unsure?.options.length === 3, "a question with options is kept");
  const asked = askFirst(unsure!);
  check(/Which exam board\?\*\*/.test(asked) && /1\. AQA/.test(asked) && /3\. OCR/.test(asked) && /Reply with a number/.test(asked), "and asked as a numbered list the person can answer with a digit", asked.split("\n")[0]);
  const noOpts = parseStudy(JSON.stringify({ standard: ["a", "b", "c"], unsure: { question: "Hm?", options: ["one"] } }), "m");
  check(noOpts?.unsure === null, "a question with one option is no question");
  check(/Search the web where it helps/.test(studyPrompt("x", "", true)) && !/Search the web/.test(studyPrompt("x", "", false)), "the study searches only when it can");
  check(/what the person most likely pictured beyond their few words/.test(studyPrompt("x")), "and is told to read the picture, not the sentence");
}

console.log("\nThe judgement, and the second pass");
{
  const s = parseStudy(JSON.stringify({ field: "f", makers: [], standard: ["Flashcards on every topic", "Questions with mark schemes", "Readable on a phone"], imagined: "" }), "m")!;
  const prompt = judgePrompt("make me a website about business revision notes", s, "# Notes site\n\nHere are the notes.");
  check(/^Judge the answer below/.test(prompt) && /- Flashcards on every topic/.test(prompt) && /The answer:/.test(prompt), "the judge sees the ask, the standard and the answer");
  check(/only when something the person would notice/.test(prompt), "and is told not to fail it for taste");
  const short = parseJudgement(JSON.stringify({ verdict: "short", missing: ["Flashcards"], weak: ["The notes are three lines each"], fix: "Add a flashcard set per topic and write the notes out." }), "m2");
  check(short?.verdict === "short" && short.missing.length === 1 && short.weak.length === 1, "a short verdict is read with what is missing and weak");
  const note = improveNote(short!);
  check(/found it short/.test(note) && /> - Missing: Flashcards/.test(note) && /Answer again, whole/.test(note) && /Do not describe the changes/.test(note), "the writer is handed the findings and told to answer again, whole");
  const meets = parseJudgement('{"verdict":"meets","missing":[],"weak":[],"fix":""}', "m2");
  check(meets?.verdict === "meets", "a meets verdict is read");
  check(parseJudgement('{"verdict":"maybe"}', "m2") === null, "and an unknown verdict is no verdict");
  check(craftLine(s) === "studied the field first, held to a standard of 3", "the row says what happened", craftLine(s));
  check(/judged short, answered again/.test(craftLine(s, short)) && /judged to meet it/.test(craftLine(s, meets)), "and how the judgement went");
  check(craftLine(null) === "", "nothing when nothing ran");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
