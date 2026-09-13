/* One decision per turn, and a decision that changes when the last one went badly.
 *
 * The app has always read the request several times over — what kind of job
 * it is, whether it wants words or a working thing, how hard to think — and
 * thrown every reading away the moment the answer went out. This is the same
 * reading, made once, and the part that is new: it consults what became of
 * the last few answers of the same shape, so the thousandth request is not
 * answered by the same reasoning as the first.
 *
 *   npx jiti test-decide.ts */
import { planTurn, withPast, worthRecording, ENOUGH, TOO_MANY } from "./lib/decide";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nThe reading, made once");
{
  const build = planTurn("make me a flashcard deck for spanish verbs");
  check(build.strategy === "build" && build.mode === "creative", "asking for a thing is a build", build.strategy);
  const ask = planTurn("what is a debounce");
  check(ask.strategy === "answer" && ask.mode === "chat", "asking about a thing is an answer", ask.strategy);
  const sum = planTurn("948392 * 73", { computed: true });
  check(sum.strategy === "compute" && sum.check === "none", "a sum answered here needs no model and no checking");
  check(!worthRecording(sum), "and there is nothing to learn from it");
  check(worthRecording(ask), "an answer from a model is worth recording");
}

console.log("\nA thread that was given a mode keeps it");
{
  const stamped = planTurn("what is a debounce", { mode: "creative" });
  check(stamped.strategy === "build", "the canvas sets one on purpose and the sentence does not overrule it");
  const plain = planTurn("build me a timer", { mode: "chat" });
  check(plain.strategy === "answer", "and the same the other way round");
}

console.log("\nHow hard to think comes from the kind of work");
{
  const code = planTurn("debug this python function, it throws a KeyError");
  check(code.kind === "coding", "code is read as code", code.kind);
  check(code.effort === "high", "and thinks harder", String(code.effort));
  const chat = planTurn("what should I have for lunch");
  check(chat.effort === undefined, "an easy question does not", String(chat.effort));
}

console.log("\nAnd the loop: what happened last time changes what happens now");
{
  const plan = planTurn("write a function that debounces calls");
  check(plan.check === "lint", "by default the app reads its own answer and nothing more", plan.check);

  const unlucky = withPast(plan, { n: ENOUGH - 1, bad: ENOUGH - 1 });
  check(unlucky.check === "lint", "a short run of bad answers is a short run of bad answers", `${ENOUGH - 1} of ${ENOUGH - 1}`);

  const bad = withPast(plan, { n: 6, bad: 4 });
  check(bad.check === "second", "four of the last six needing another go earns a second model", `${Math.round((4 / 6) * 100)}% over ${Math.round(TOO_MANY * 100)}%`);
  check(/4 of the last 6/.test(bad.why), "and the reason says so in the words a person would use", bad.why);

  const fine = withPast(plan, { n: 12, bad: 1 });
  check(fine.check === "lint", "a model that has been right is left alone");

  /* Forgiveness matters as much as suspicion: a pairing that goes wrong for
     a while and then comes good must stop being checked, or the app pays
     for a second opinion forever over something it fixed weeks ago. */
  const forgiven = withPast(plan, { n: 12, bad: 5 });
  check(forgiven.check === "lint", "and one that has come good again is forgiven", "5 of 12");
}

console.log("\nWhat a second model cannot settle, it is not asked");
{
  const design = withPast(planTurn("design a landing page layout for a bakery"), { n: 10, bad: 8 });
  check(design.check !== "second", "a disagreement about a layout is two opinions, not a check", design.kind);
  const built = withPast(planTurn("make me a timer"), { n: 10, bad: 8 });
  check(built.check !== "second", "a built thing is checked by running it, not by asking twice");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
