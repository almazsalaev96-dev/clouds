/* A typed prefix sets the room before the question.
 *
 *   npx jiti test-slash.ts */
import { parseSlash, slashCommands, typingSlash } from "./lib/slash";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nA command is read off the front, and the question is what is left");
{
  const s = parseSlash("/study explain osmosis to me")!;
  check(s?.presetId === "one" && s.kind === "learning" && s.text === "explain osmosis to me", "“/study” picks Mira, teaching, and hands on the rest", JSON.stringify(s));
  check(parseSlash("/build a stopwatch")?.kind === "coding", "“/build” picks Mira as a builder");
  check(parseSlash("/research what changed in the budget")?.research === true, "“/research” turns the web on");
  check(parseSlash("/compare which is better")?.compare === true, "“/compare” asks for two answers");
  check(parseSlash("/check is this right")?.check === true, "“/check” asks for a second reading");
  check(parseSlash("/temp something private")?.temporary === true, "“/temp” does not keep the chat");
  check(parseSlash("/STUDY shouting")?.kind === "learning", "case does not matter");
  check(parseSlash("   /study with space before")?.kind === "learning", "nor does whitespace before it");
}

console.log("\nA tier's own name is a command too — and only a tier's");
{
  check(parseSlash("/mira compound interest over seven years")?.presetId === "one", "“/mira” is the everyday tier", parseSlash("/mira x")?.presetId);
  check(parseSlash("/astro plan my startup")?.presetId === "astro", "“/astro” is the top of the ladder");
  check(parseSlash("/parallax x") === null && parseSlash("/orrery teach me") === null, "the old specialists' names are not commands: they are what the tiers become");
  check(parseSlash("/maths compound interest")?.kind === "data" && parseSlash("/translate this")?.kind === "translate", "and the jobs are verbs: /maths, /translate");
}

console.log("\nWhat is not a command is sent as written");
{
  check(parseSlash("/usr/bin/env node") === null, "a path is not a command");
  check(parseSlash("/ 2 is a half") === null, "nor is a slash with a space after it");
  check(parseSlash("/nonsense do this") === null, "nor is a word this app does not know — a typo must not silently become a different room");
  check(parseSlash("study without the slash") === null, "and without the slash it is just a message");
  check(parseSlash("/study") !== null && parseSlash("/study")!.text === "", "a bare command is a command with nothing after it yet");
}

console.log("\nThe hint knows what is being typed");
{
  check(typingSlash("/") === "", "a lone slash opens the hint");
  check(typingSlash("/stu") === "stu", "and a partial command narrows it");
  check(typingSlash("/study now") === null, "once there is a space the command is complete and the hint goes");
  check(typingSlash("not /a command") === null, "a slash mid-line is not one");
  const cmds = slashCommands();
  check(cmds.some((c) => c.command === "study") && cmds.some((c) => c.command === "mira"), "the list carries the verbs and the models", `${cmds.length} commands`);
  check(new Set(cmds.map((c) => c.command)).size === cmds.length, "with no two the same");
}

console.log("\nThe newer verbs");
{
  const deep = parseSlash("/deep what changed in the FSRS benchmark this year");
  check(Boolean(deep?.research && deep?.deep && deep?.text.startsWith("what changed")), "“/deep” is research, taken further", JSON.stringify(deep));
  const pic = parseSlash("/image a labelled plant cell");
  check(Boolean(pic?.picture) && pic?.text === "a labelled plant cell", "“/image” asks for a picture", JSON.stringify(pic));
  check(Boolean(parseSlash("/draw a cat")?.picture), "so does “/draw”");
  const names = slashCommands().map((c) => c.command);
  check(names.includes("deep") && names.includes("image"), "and both are in the list a slash shows", names.join(" "));
}

console.log("\nAn assistant's name is a command of the person's own");
{
  const extra = [{ command: "chem-coach", assistantId: "a1", does: "⚗️ Chem coach — one of your assistants" }, { command: "study", assistantId: "a2", does: "mine" }];
  const own = parseSlash("/chem-coach what is a mole", extra);
  check(own?.assistantId === "a1" && own?.text === "what is a mole", "“/chem-coach …” names it and keeps the question", JSON.stringify(own));
  check(parseSlash("/study x", extra)?.assistantId === "a2", "and the person's own word wins over a built-in verb");
  check(parseSlash("/study x")?.kind === "learning", "which is still a verb when no assistant took the name");
  const cyr = parseSlash("/химия что такое моль", [{ command: "химия", assistantId: "a3", does: "" }]);
  check(cyr?.assistantId === "a3" && cyr?.text === "что такое моль", "a name in another script is a command too", JSON.stringify(cyr));
  check(parseSlash("/3d-artist draw a cube", [{ command: "3d-artist", assistantId: "a4", does: "" }])?.assistantId === "a4", "and one that starts with a digit");
  check(typingSlash("/хи") === "хи", "the hint follows it while it is typed");
  const names = slashCommands(extra).map((c) => c.command);
  check(names[0] === "chem-coach" && names.includes("build"), "the list shows theirs first, then the built-in", names.slice(0, 3).join(" "));
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
