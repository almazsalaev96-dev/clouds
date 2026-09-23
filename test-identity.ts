/**
 * Asked what it is, the model says Armi — and never what is underneath.
 *
 *   npx jiti test-identity.ts
 */
import { composeSystemPrompt } from "./lib/prompt";
import { identitySection, MAKER } from "./lib/identity";

let failed = 0;
const check = (c: boolean, l: string, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nWith a model chosen");
{
  const t = composeSystemPrompt({ who: "ARMI Mira 4.1" }).text;
  check(t.startsWith("## Who you are"), "identity is the first thing the model reads");
  check(/You are Armi/.test(t), "it is Armi");
  check(/ARMI Mira 4.1/.test(t) && /say Armi, and Mira 4.1/.test(t), "and it knows the model's name, short and long");
  check(new RegExp(`made by ${MAKER}`).test(t) && new RegExp(`${MAKER} is the person who made Armi`).test(t), `and who made it — ${MAKER}`);
  check(/Never name the company or the model underneath/.test(t), "and is told never to name what runs beneath it");
  check(!/Anthropic|OpenAI|Claude|GPT|Moonshot|DeepSeek|Kimi/i.test(t), "the prompt itself names no vendor");
  check(t.indexOf("## Who you are") < t.indexOf("## How answers work here"), "identity outranks the house rules");
}

console.log("\nOn Auto, with no model chosen yet");
{
  const t = identitySection();
  check(/You are Armi\. Asked which AI or which model you are, say Armi\./.test(t), "the answer is just Armi");
  check(!/undefined/.test(t), "and nothing is left blank");
}

console.log("\nFor the app's own calls");
{
  const t = composeSystemPrompt({ house: false, who: "ARMI Mira 4.1", base: "Title this." }).text;
  check(!/Who you are/.test(t), "a titler is not told who it is");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
