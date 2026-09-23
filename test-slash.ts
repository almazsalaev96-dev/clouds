/* A typed prefix sets the room before the question.
 *
 *   npx jiti test-slash.ts */
import { parseSlash, slashCommands, typingSlash } from "./lib/slash";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nA command is read off the front, and the question is what is left");
{
  const s = parseSlash("/study explain osmosis to me")!;
  check(s?.presetId === "tutor" && s.text === "explain osmosis to me", "“/study” picks the tutor and hands on the rest", JSON.stringify(s));
  check(parseSlash("/build a stopwatch")?.presetId === "forge", "“/build” picks the builder");
  check(parseSlash("/research what changed in the budget")?.research === true, "“/research” turns the web on");
  check(parseSlash("/compare which is better")?.compare === true, "“/compare” asks for two answers");
  check(parseSlash("/check is this right")?.check === true, "“/check” asks for a second reading");
  check(parseSlash("/temp something private")?.temporary === true, "“/temp” does not keep the chat");
  check(parseSlash("/STUDY shouting")?.presetId === "tutor", "case does not matter");
  check(parseSlash("   /study with space before")?.presetId === "tutor", "nor does whitespace before it");
}

console.log("\nA model's own name is a command too");
{
  check(parseSlash("/parallax compound interest over seven years")?.presetId === "quant", "“/parallax” is the reasoning model", parseSlash("/parallax x")?.presetId);
  check(parseSlash("/constellation plan my startup")?.presetId === "council", "“/constellation” is the council");
  check(parseSlash("/orrery teach me")?.presetId === "tutor", "and “/orrery” is the tutor by its own name");
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
  check(cmds.some((c) => c.command === "study") && cmds.some((c) => c.command === "parallax"), "the list carries the verbs and the models", `${cmds.length} commands`);
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

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
