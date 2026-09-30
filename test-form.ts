/**
 * The form of an answer, read from the question: a sentence for a small
 * fact, steps for a how-to, a verdict and a table for a comparison, the fix
 * first for something broken, whole files for a build — and how the person
 * is: stressed, frustrated, new to it.
 */
import { formOf, moodOf, formNote } from "./lib/form";

let failed = 0;
const check = (c: boolean, l: string, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nThe form the content has");
{
  const cases: [string, string | null][] = [
    ["hi!", "chat"],
    ["thanks, that helped", "chat"],
    ["what is the capital of Peru?", "fact"],
    ["how do I install Node on Windows", "steps"],
    ["React vs Vue for a small school project?", "compare"],
    ["what's the difference between TCP and UDP", "compare"],
    ["should I learn Python or JavaScript first", "decide"],
    ["my React app shows a blank page and the console says Cannot read properties of undefined", "fix"],
    ["build me a website for my bakery with a menu and contact form", "build"],
    ["make a to-do app", "build"],
    ["give me 10 ideas for a science fair project", "list"],
    ["explain how photosynthesis works", "explain"],
    ["write an email to my teacher asking for an extension", "message"],
    ["tell me everything about the French Revolution in detail", "deep"],
    ["the weather is nice here today", null],
    ["ok, write the essay about Hamlet", "message"],
    ["Great, now make it a table", null],
    ["Thanks! Now build me a todo app", "build"],
    ["recommend 5 books about space", "list"],
  ];
  for (const [q, want] of cases) check(formOf(q) === want, `${JSON.stringify(q.slice(0, 50))} → ${want}`, String(formOf(q)));
}

console.log("\nIn Russian and Kazakh too");
{
  const cases: [string, string | null][] = [
    ["привет!", "chat"],
    ["рахмет", "chat"],
    ["что такое фотосинтез?", "fact"],
    ["как установить Python на Windows", "steps"],
    ["чем отличается TCP от UDP", "compare"],
    ["что мне выбрать: Python или JavaScript?", "decide"],
    ["мой сайт не работает, в консоли ошибка", "fix"],
    ["сделай мне сайт для пекарни", "build"],
    ["маған дүкен сайтын жаса", "build"],
    ["объясни как работает фотосинтез", "explain"],
    ["напиши письмо учителю", "message"],
    ["расскажи подробно про Французскую революцию", "deep"],
  ];
  for (const [q, want] of cases) check(formOf(q) === want, `${JSON.stringify(q)} → ${want}`, String(formOf(q)));
  check(moodOf("я очень устал и боюсь завалить экзамен").includes("stressed"), "stressed, in Russian");
  check(moodOf("я новичок, объясни циклы").includes("beginner"), "a beginner, in Russian");
}

console.log("\nHow the person is");
{
  check(moodOf("I'm so stressed, my exam is tomorrow and I can't cope").includes("stressed"), "stressed, from their words");
  check(moodOf("it STILL doesn't work!!").includes("frustrated"), "frustrated, from how they wrote it");
  check(moodOf("I'm a beginner, how do loops work").includes("beginner"), "new to it");
  check(moodOf("how do loops work").length === 0, "and nothing read into an ordinary question");
  check(!moodOf("Why is my unit test failing the CI build?").includes("stressed"), "a failing test is not a person failing");
  check(moodOf("I'm failing my exams and I don't know what to do").includes("stressed"), "a person failing their exams is");
}

console.log("\nThe note for the writer");
{
  const n = formNote("I'm so stressed about my chemistry exam, what should I revise first?");
  check(/## The shape of this answer/.test(n) && /recommendation in the first sentence/.test(n) && /one small next step/.test(n), "a decision, and a stressed person: both said", n.replace(/\s+/g, " ").slice(0, 120));
  check(/own words about length or format win/i.test(n), "and the person's own words still win");
  check(formNote("the weather is nice here today") === "", "nothing recognised, nothing added");
  check(/every file whole/.test(formNote("build me a website for my bakery")), "a build is asked for whole, runnable files");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
