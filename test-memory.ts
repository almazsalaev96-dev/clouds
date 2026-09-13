/* What the app keeps about you, what it refuses to keep, and what it sends.
 *
 * Three things are tested here and all three fail quietly if they are wrong.
 *
 * That it keeps what you asked for — and, far more importantly, that it keeps
 * *nothing else*. A memory saved by accident is the failure mode of the whole
 * feature: it is indistinguishable, from the outside, from an app writing down
 * everything you say. So every "must not" case below is a sentence somebody
 * would really type, and the trigger words appear in most of them.
 *
 * That a credential never reaches the table. A memory goes out with your
 * questions, so an API key in one is an API key in a provider's logs, in a
 * field with no masking and no rotation.
 *
 * And that retrieval is selective in the two different ways it has to be: a
 * standing preference rides along with a question that shares no word with it,
 * and a fact about a dissertation does not.
 *
 *   npx jiti test-memory.ts */
import {
  MAX_STANDING, memoryBlock, readRememberRequest, refuseToRemember, retrieve, similarity,
  findDuplicate, MAX_MEMORY_CHARS,
} from "./lib/memory";
import type { Memory, MemoryKind } from "./lib/types";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const mem = (text: string, over: Partial<Memory> = {}): Memory => ({
  id: text.slice(0, 12),
  text,
  kind: "fact",
  createdAt: 0,
  updatedAt: Date.now(),
  useCount: 0,
  ...over,
});

console.log("\nAsking for something to be remembered");
{
  for (const [said, kept] of [
    ["remember that I write in British English", "I write in British English"],
    ["Remember: I am vegetarian", "I am vegetarian"],
    ["remember this: my dissertation is on tidal locking", "My dissertation is on tidal locking"],
    ["please remember that I prefer metric units", "I prefer metric units"],
    ["keep in mind that I am colour-blind", "I am colour-blind"],
    ["don't forget that my team uses Python 3.11", "My team uses Python 3.11"],
    ["For future reference, call me Al", "Call me Al"],
    ["From now on, answer in Russian", "Answer in Russian"],
  ] as const) {
    const got = readRememberRequest(said);
    check(got?.text === kept, `"${said}"`, got ? `kept "${got.text}"` : "kept nothing");
  }

  const two = readRememberRequest("Remember that I use metric. Now convert this recipe.");
  check(two?.text === "I use metric", "it keeps the rule and not the errand after it", two?.text ?? "nothing");

  const mid = readRememberRequest("Thanks, that helps. Remember that I work in UTC.");
  check(mid?.text === "I work in UTC", "and a request that arrives mid-message", mid?.text ?? "nothing");
}

console.log("\nAnd the sentences that only sound like one");
{
  for (const said of [
    "do you remember what I said about the tides?",
    "can you remember that for me?",
    "I remember that you said the opposite last time",
    "you remember that function we wrote?",
    "remember to buy milk",
    "please remember to send the invoice on Friday",
    "the thing to remember about tides is the moon",
    "write a poem about remembering",
    "what should I keep in mind when writing a CV?",
  ]) {
    const got = readRememberRequest(said);
    check(got === null, `"${said}"`, got ? `WOULD HAVE KEPT "${got.text}"` : "kept nothing");
  }
}

console.log("\nAnd what it refuses even when you do ask");
{
  for (const secret of [
    "my OpenAI key is sk-proj-A1b2C3d4E5f6G7h8I9j0K1l2M3n4",
    "the anthropic key is sk-ant-api03-ZZZZZZZZZZZZZZZZ",
    "use AIzaSyD-1234567890abcdefghijklmnopqrstu for maps",
    "AWS is AKIAIOSFODNN7EXAMPLE",
    "my token is ghp_16CharactersAtLeastHere00",
    "the slack token xoxb-1234567890-abcdefghij",
    "my password is hunter2",
    "the wifi passphrase is: correcthorsebatterystaple",
    "my card is 4242 4242 4242 4242",
    "-----BEGIN RSA PRIVATE KEY-----",
  ]) {
    const why = refuseToRemember(secret);
    check(Boolean(why), `"${secret.slice(0, 44)}"`, why ? why.split(",")[0] : "WOULD HAVE KEPT IT");
    check(!(why ?? "").includes(secret.slice(-8)), "  and the refusal does not repeat it back");
  }

  check(refuseToRemember("x".repeat(MAX_MEMORY_CHARS + 1)) !== null,
    "a memory longer than a sentence is refused rather than truncated",
    "half a rule reads as a complete one");
}

console.log("\nWhile the ordinary things a person would say are kept");
{
  for (const fine of [
    "I write in British English",
    "I am a paediatric nurse in Tashkent",
    "My daughter is called Aisha and she is seven",
    "I prefer answers without bullet points",
    "The key thing about my job is the night shifts",
    "I keep my notes in Obsidian",
    "My pin code for the office door lock is the building's postcode",
  ]) {
    check(refuseToRemember(fine) === null, `"${fine}"`, refuseToRemember(fine) ?? "kept");
  }
}

console.log("\nWhat kind of thing it is");
{
  const kind = (s: string): MemoryKind | undefined => readRememberRequest(`remember that ${s}`)?.kind;
  check(kind("I prefer metric units") === "preference", "a preference");
  check(kind("call me Al") === "preference", "and what to call you");
  check(kind("I am working on a dissertation about tides") === "project", "a project");
  check(kind("whenever I ask for code, include tests") === "workflow", "a workflow");
  check(kind("my daughter is called Aisha") === "fact", "and everything else is a fact");
}

console.log("\nSaying the same thing twice keeps it once");
{
  const existing = [mem("I write in British English", { kind: "preference" })];
  const again = findDuplicate("I write in british english", existing);
  check(again?.id === existing[0].id, "a restatement finds the one already there");
  check(findDuplicate("I am vegetarian", existing) === null, "and an unrelated sentence does not");
  check(similarity("I use metric units", "I use imperial units") < 1, "near is not the same as identical");
}

console.log("\nWhat goes out with a question");
{
  const all = [
    mem("Answer in metric units", { id: "pref", kind: "preference" }),
    mem("My dissertation is on tidal locking", { id: "tides", kind: "project" }),
    mem("My cat is called Mishka", { id: "cat", kind: "fact" }),
  ];

  const moon = retrieve(all, "how far away is the moon");
  check(moon.some((m) => m.id === "pref"),
    "a standing preference goes even with no word in common",
    "'answer in metric' is exactly as relevant to everything");
  check(!moon.some((m) => m.id === "cat"),
    "and an unrelated fact stays behind",
    `sent ${moon.map((m) => m.id).join(", ") || "nothing"}`);

  const diss = retrieve(all, "help me structure the dissertation chapter on tides");
  check(diss.some((m) => m.id === "tides"), "a fact the question touches is fetched");

  const none = retrieve([], "anything at all");
  check(none.length === 0 && memoryBlock(none) === "",
    "and with nothing remembered, nothing is added to the prompt");
}

console.log("\nRetrieval is capped, in both of the ways it can run away");
{
  const many: Memory[] = [];
  for (let i = 0; i < 40; i++) many.push(mem(`Preference number ${i} about formatting`, { id: `p${i}`, kind: "preference" }));
  const got = retrieve(many, "what is the capital of Peru");
  check(got.length <= MAX_STANDING,
    "forty standing preferences do not all ride along on one question",
    `${got.length} sent`);

  const huge = [mem("x ".repeat(4000), { id: "huge", kind: "preference" })];
  check(retrieve(huge, "hello").length === 0,
    "and one memory bigger than the whole budget is dropped rather than blowing it");
}

console.log("\nA memory written in a project stays in it");
{
  const all = [
    mem("This repo uses tabs, not spaces", { id: "scoped", kind: "preference", projectId: "proj-a" }),
    mem("Answer in metric units", { id: "global", kind: "preference" }),
  ];
  const inside = retrieve(all, "format this file", { projectId: "proj-a" });
  const outside = retrieve(all, "format this file", { projectId: "proj-b" });
  const nowhere = retrieve(all, "format this file");
  check(inside.some((m) => m.id === "scoped"), "inside the project it applies");
  check(!outside.some((m) => m.id === "scoped"), "in another project it does not");
  check(!nowhere.some((m) => m.id === "scoped"), "and outside every project it does not");
  check(nowhere.some((m) => m.id === "global"), "while an unscoped one applies everywhere");
}

console.log("\nAnd what the model is actually told");
{
  const block = memoryBlock([
    mem("Answer in metric units", { kind: "preference" }),
    mem("My dissertation is on tidal locking", { kind: "project" }),
  ]);
  check(block.includes("Answer in metric units") && block.includes("tidal locking"), "both are in it");
  check(block.indexOf("How they want answers") < block.indexOf("What they are working on"),
    "grouped, with the instructions before the background",
    "undifferentiated, a model reads a fact as a request to mention it");
  check(/do not recite it back/i.test(block),
    "and told not to announce it",
    "an assistant that says 'as I remember, you use metric' every turn is unusable");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
