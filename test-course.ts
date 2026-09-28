/**
 * Courses: the parsers and the arithmetic behind the result a student sees.
 *
 *   npx jiti test-course.ts
 */
import {
  courseMoves, courseName, courseScore, parseMarking, parseMock, parseQuestion, parseSyllabus,
  questionPrompt, markPrompt, topicResult, weakestFirst, type Course, type MarkRow,
} from "./lib/course";

let failed = 0;
const check = (c: boolean, l: string, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nThe specification is read into units and topics with ids");
{
  const units = parseSyllabus({ units: [
    { title: "Cells", topics: [{ code: "4.1.1", title: "Structure", points: ["a", "b"] }, { title: "Division" }, { title: "" }] },
    { title: "Empty", topics: [] },
    { title: "Organisation", topics: [{ title: "Enzymes", points: ["x"] }] },
  ] });
  check(units?.length === 2, "a unit with no topics is dropped", String(units?.length));
  check(units?.[0].topics.length === 2, "a topic with no title is dropped");
  check(units?.[0].topics[0].id === "u1t1" && units?.[0].topics[0].code === "4.1.1", "ids are stable and the board's code is kept");
  check(!("code" in (units?.[0].topics[1] ?? {})), "no code is invented when none was given");
  check(parseSyllabus({ nothing: true }) === null && parseSyllabus(null) === null, "nothing usable is null");
}

console.log("\nA question is held to its marks");
{
  const q = parseQuestion({ question: "Explain X [3]", marks: 3, scheme: ["a", "b", "c"], model: "m", tip: "t" }, "u1t1", "medium");
  check(q?.marks === 3 && q.scheme.length === 3 && q.topicId === "u1t1", "a well-formed question is read whole");
  const q2 = parseQuestion({ question: "Q", marks: "lots", scheme: ["a", "b"] }, "t", "easy");
  check(q2?.marks === 2, "unreadable marks fall back to the scheme's length", String(q2?.marks));
  check(parseQuestion({ question: "Q", scheme: [] }, "t", "easy") === null, "a question with no mark scheme is refused");
  const prompt = questionPrompt({ subject: "Biology", level: "GCSE", board: "AQA" }, { id: "t", title: "Osmosis", points: ["explain osmosis"] }, "hard", ["Old question one"]);
  check(/AQA/.test(prompt) && /Osmosis/.test(prompt) && /Old question one/.test(prompt) && /5 to 6 marks/.test(prompt), "the prompt names the board, the topic, the difficulty and what not to repeat");
}

console.log("\nMarking never gives more than the marks, and counts the points when the total is missing");
{
  const q = { marks: 3, scheme: ["a", "b", "c"] };
  const over = parseMarking({ points: [{ point: "a", got: true }, { point: "b", got: true }, { point: "c", got: true }], got: 9 }, q);
  check(over?.got === 3, "a total over the marks is held to the marks", String(over?.got));
  const counted = parseMarking({ points: [{ point: "a", got: true }, { point: "b", got: false }, { point: "c", got: "yes" }] }, q);
  check(counted?.got === 1, "no total: the points earned are counted, and only a real true counts", String(counted?.got));
  check(parseMarking({ got: -2, points: [] }, q)?.got === 0, "never below zero");
  check(parseMarking("nonsense", q) === null, "nothing usable is null");
  check(/THE STUDENT'S ANSWER\n\(blank\)/.test(markPrompt({ subject: "S", level: "GCSE", board: "AQA" }, { question: "Q", marks: 2, scheme: ["a", "b"], model: "" }, "   ")), "a blank answer is marked as blank, not as nothing sent");
}

console.log("\nA mock paper keeps only questions on the topics it was given");
{
  const qs = parseMock({ questions: [
    { topicId: "u1t1", question: "A [2]", marks: 2, scheme: ["x", "y"] },
    { topicId: "made-up", question: "B [1]", marks: 1, scheme: ["z"] },
    { topicId: "u1t2", question: "", scheme: ["z"] },
  ] }, ["u1t1", "u1t2"]);
  check(qs?.length === 2, "an empty question is dropped", String(qs?.length));
  check(qs?.[1].topicId === "u1t1", "an unknown topic id falls back to the first topic rather than a dead link");
}

console.log("\nThe result: every topic weighs the same, and untried counts as nothing");
{
  const course: Pick<Course, "units" | "confidence"> = {
    units: [{ id: "u1", title: "U", topics: [
      { id: "a", title: "A", points: [] }, { id: "b", title: "B", points: [] },
      { id: "c", title: "C", points: [] }, { id: "d", title: "D", points: [] },
    ] }],
    confidence: { c: "red", d: "green" },
  };
  const row = (topicId: string, got: number, marks: number, at: number): MarkRow => ({
    id: `${topicId}${at}`, at, courseId: "k", topicId, topic: topicId, question: "q", marks, got,
    difficulty: "medium", answer: "", points: [], feedback: "", better: "", model: "", tip: "",
  });
  const rows = [row("a", 3, 4, 1), row("a", 4, 4, 2), row("b", 1, 5, 3)];
  const r = topicResult(rows, "a");
  check(r.got === 7 && r.out === 8 && r.tried === 2, "a topic's marks add up over its answers", `${r.got}/${r.out}`);
  const s = courseScore(course, rows, (t) => (t === "C" ? 0.5 : null));
  check(Math.abs(s.likely - (7 / 8 + 1 / 5 + 0.5 + 0) / 4) < 1e-9, "likely marks: marks where tried, cards where not, nothing where neither", s.likely.toFixed(3));
  check(s.covered === 3 && s.total === 4, "coverage counts a topic with cards", `${s.covered}/${s.total}`);
  check(s.got === 8 && s.out === 13 && s.red === 1 && s.green === 1, "and the marks and colours are totalled");
  const moves = courseMoves(course, rows);
  check(moves[0]?.topicId === "b" && moves[0].kind === "questions", "the first move is the weakest topic already tried", moves.map((m) => m.key).join(" "));
  check(moves[1]?.topicId === "c", "then the topic the student marked red", moves.map((m) => m.key).join(" "));
  check(moves.length === 3 && moves[2].topicId === "d", "then one not tried, and never more than three");
  const order = weakestFirst(course, rows).map((t) => t.id).join("");
  check(order.startsWith("bc"), "a mock aims at the weakest first", order);
  const old = [...Array(10)].map((_, i) => row("e", 0, 2, i)).concat([...Array(8)].map((_, i) => row("e", 2, 2, 100 + i)));
  check(topicResult(old, "e").pct === 1, "only the recent answers count, so getting better shows", String(topicResult(old, "e").pct));
}

console.log("\nThe name is the subject, level and board");
{
  check(courseName("Biology ", "GCSE", "AQA") === "Biology · GCSE · AQA", "all three", courseName("Biology ", "GCSE", "AQA"));
  check(courseName("Law", "University", "My course") === "Law · University", "and no board where there is none");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
