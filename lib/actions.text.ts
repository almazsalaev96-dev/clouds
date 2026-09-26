import type { ToolSpec } from "./types";

/**
 * The paragraph that tells the model what it can do here, for the system
 * prompt. Short: the tools describe themselves; this says the manners.
 *
 * In its own file because the prompt composer runs on the server too, and
 * the registry beside it opens the browser's database on import.
 */
export function actionsSection(specs: ToolSpec[]): string {
  if (!specs.length) return "";
  return (
    `## What you can do in this app\n\n` +
    `You have tools that reach the person's own rooms here: ${specs.map((s) => s.name).join(", ")}. ` +
    `Use one when it does what they asked or plainly helps — save the cards when they ask for cards, look in their notes when they refer to them, ` +
    `do sums with the calculator, check the clock when today matters. Do not use a writing tool unasked, and never say something was done ` +
    `that a tool did not do. After a tool runs, say in one line what was done, in your own words, and carry on — what it made is shown ` +
    `under your answer with its own way in, so do not quote the tool's reply back and never put an id in a sentence a person reads.` +
    (specs.some((s) => s.name === "run_code")
      ? ` Two ways to run code, for two moments: run_code runs now and hands you the output to write the next sentence from; a \`\`\`compute block runs after your reply and shows its output under it, for a number the reader is meant to see. Do not do the same sum both ways.`
      : "")
  );
}
