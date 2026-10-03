/**
 * The Studio registry, its parsers, and Craft's use of the house standards.
 *
 *   npx jiti test-studio.ts
 */
import {
  TOOLS, checkedLine, defaultsFor, pagePrompt, paperMarkdown, parseCheck, parsePaper, parseReading,
  parseScheme, schemeFromText, toolById,
} from "./lib/studio";
import { STANDARDS, mergeStandard, toolForAsk } from "./lib/standards";
import { routeStudioAsk } from "./lib/studioBus";
import { houseStudy, standardNote, studyPrompt, worthCrafting } from "./lib/craft";

let failed = 0;
const check = (c: boolean, l: string, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nEvery tool has a standard, and every page tool has an instruction");
{
  check(TOOLS.length >= 19, "the registry holds every tool", String(TOOLS.length));
  check(TOOLS.every((t) => t.standard.length >= 3), "each is held to at least three written points");
  check(TOOLS.filter((t) => t.kind === "page").every((t) => (t.instruction ?? "").length > 80), "each page tool says how to write it");
  check(TOOLS.every((t) => STANDARDS[t.id]?.standard === t.standard), "one standard per tool, shared with Craft");
  check(new Set(TOOLS.map((t) => t.id)).size === TOOLS.length, "no tool twice");
}

console.log("\nReading a source");
{
  const r = parseReading({ title: "Osmosis", subject: "Biology", level: "GCSE", kind: "textbook", topics: ["A", "", "B"], recommend: ["notes", "made-up", "checker", "paper"] }, "file.pdf");
  check(r.recommend.join(",") === "notes,paper", "unknown tools and the checker are dropped from the suggestions", r.recommend.join(","));
  check(r.topics.join(",") === "A,B", "empty topics are dropped");
  const empty = parseReading(null, "Hamlet.pdf");
  check(empty.title === "Hamlet" && empty.recommend.join(",") === defaultsFor("other").join(","), "a reading that failed still offers a sensible choice", empty.recommend.join(","));
  check(defaultsFor("novel").includes("essay") && defaultsFor("novel").includes("timeline"), "a novel is offered essays and a timeline, not flashcards first");
}

console.log("\nPapers and quizzes");
{
  const qs = parsePaper({ questions: [
    { question: "Define osmosis. [2]", marks: 2, scheme: ["a", "b"], topic: "Osmosis" },
    { question: "Pick one", options: ["A", "B", "C"], answer: 1, why: ["no", "yes", "no"] },
    { question: "Pick one", options: ["A", "B"], answer: 5 },
    { question: "No scheme", marks: 3, scheme: [] },
  ] });
  check(qs?.length === 2, "a choice with no valid answer, and a question with no scheme, are dropped", String(qs?.length));
  check(qs?.[1].marks === 1 && qs?.[1].model === "B", "a multiple-choice question is worth one mark and its answer is the model");
  const md = paperMarkdown("Osmosis — Exam paper", qs ?? [], 15);
  check(md.indexOf("## Questions") < md.indexOf("## Mark scheme") && /Total:\*\* 3 marks/.test(md), "the printable paper puts the questions first and the scheme after, with the total");
}

console.log("\nThe checker's scheme");
{
  check(schemeFromText("1. more energy\n- move faster\n(c) more collide\n\n").join("|") === "more energy|move faster|more collide", "a pasted scheme is read one point a line, numbering stripped");
  check(parseScheme({ scheme: [] }) === null && parseScheme({ scheme: ["x"], model: "m" })?.scheme.length === 1, "a scheme with no points is refused");
}

console.log("\nThe check, and what the page says about it");
{
  check(parseCheck({ verdict: "short", missing: ["no example", ""], fix: "add one" })?.missing.length === 1, "a short verdict carries what is missing");
  check(parseCheck({ verdict: "maybe" }) === null, "a verdict that is neither is not a verdict");
  const notes = toolById("notes");
  check(/rewritten where it fell short/.test(checkedLine(notes, { verdict: "short", missing: [], fix: "" }, true)), "a rewritten page says so");
  check(checkedLine(notes, null, false) === "", "an unchecked page claims nothing");
  const prompt = pagePrompt(notes, { title: "Osmosis", level: "GCSE", board: "AQA", purpose: "exam", focus: ["Water potential"] }, "SOURCE TEXT", "osmosis.txt");
  check(/Correct first/.test(prompt) && /THE STANDARD/.test(prompt) && /Exam board: AQA/.test(prompt) && /Focus on: Water potential/.test(prompt) && /SOURCE TEXT/.test(prompt), "a page is written under the rules, to the standard, for the student, from the source");
}

console.log("\nCraft holds a chat ask for study material to the same standard");
{
  check(toolForAsk("make me a mind map of the Krebs cycle")?.id === "mindmap", "a mind map is recognised");
  check(toolForAsk("write revision notes on osmosis")?.id === "notes", "and revision notes");
  check(toolForAsk("what is a debounce") === null, "and a question is not study material");
  check(worthCrafting("mind map of the Krebs cycle", undefined), "five words for a mind map earn Craft");
  check(!worthCrafting("summarise this", undefined), "a two-word summary does not");
  check(!worthCrafting("what is a mind map", undefined), "nor does a question about one");
  const merged = mergeStandard(["One central idea", "Short leaves"], ["one central idea!", "Colour by branch"]);
  check(merged.length === 3 && merged[0] === "One central idea", "the house lines come first, none twice", merged.join(" | "));
  check(/already has a written house standard/.test(studyPrompt("a mind map", "", false, ["One central idea"])), "the study is told to build on the house standard");
  const s = houseStudy({ id: "mindmap", ...STANDARDS.mindmap }, "m");
  check(s.edu === true && s.standard.length === STANDARDS.mindmap.standard.length, "with no study, the house standard is the standard");
  check(/This is study material, so:/.test(standardNote(s)), "and the writer is given the education rules");
}


console.log("\nWhat a sentence typed into the Studio's bar does");
{
  check(routeStudioAsk("Osmosis") === "study", "a bare topic makes study material", routeStudioAsk("Osmosis"));
  check(routeStudioAsk("revision notes on the Cold War for GCSE") === "study", "and so does an ask for notes", routeStudioAsk("revision notes on the Cold War for GCSE"));
  check(routeStudioAsk("make me a pomodoro timer app") === "build", "a thing that runs is built", routeStudioAsk("make me a pomodoro timer app"));
  check(routeStudioAsk("build a quiz app on the periodic table") === "build", "a quiz *app* is built, a quiz is written", routeStudioAsk("build a quiz app on the periodic table"));
  check(routeStudioAsk("a quiz on the periodic table") === "study", "", routeStudioAsk("a quiz on the periodic table"));
  check(routeStudioAsk("Make me a landing page for my tutoring business") === "build", "'make me a …' with no study word is a build", routeStudioAsk("Make me a landing page for my tutoring business"));
  check(routeStudioAsk("x".repeat(700)) === "source", "a long paste is the source", routeStudioAsk("x".repeat(700)));
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
