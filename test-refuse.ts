/* What a room is told when a company will not answer.
 *
 * Reported from the live app, in the Notebook, with a book attached and a
 * revision pack asked for: "Nothing usable came back. Try saying it
 * differently." Nothing was wrong with what was said. The key was out of
 * credit, and the app's answer was to blame the question — in every room
 * except chat, because chat is the only one that goes through the stream
 * hook, and everything else goes through `complete`, and `complete` met the
 * provider's classified error and did this with it:
 *
 *     if (ev.type === "error") return null;
 *
 * Fifteen catch blocks downstream then said "That request failed. Check the
 * key and the connection", which is the same failure of nerve with better
 * manners. This pins both halves of the repair: the reason survives, and
 * the work moves to whoever else has a key rather than stopping.
 *
 *   npx jiti test-refuse.ts */
import { Refused, whyItFailed } from "./lib/complete";
import { worthMoving, whyAvoided, forgetHealth, noteFailure, isAiling } from "./lib/health";
import { elsewhere } from "./lib/route";
import { classifyError } from "./lib/providers/shared";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nThe reason survives the trip to the screen");
{
  const spent = classifyError("anthropic", 400, '{"error":{"message":"Your credit balance is too low to access the Anthropic API."}}');
  const shown = whyItFailed(new Refused(spent), "That request failed. Check the key and the connection.");
  check(shown === "Your Anthropic account is out of credit.", "a room prints what actually happened", shown);
  check(!/differently|Check the key/.test(shown), "and not advice about a question that was never the problem");
  /* The fallback is for the failures that have no better account of
     themselves, and must never paint over one that does. */
  check(whyItFailed(new Error(""), "That request failed.") === "That request failed.", "a failure with nothing to say falls back");
  check(whyItFailed(new Error("The connection ended before the answer did."), "That request failed.")
    === "The connection ended before the answer did.", "and one with something to say keeps it");
  const stopped = new DOMException("aborted", "AbortError");
  check(whyItFailed(stopped, "That request failed.") === "Stopped.", "pressing stop is not a failure", whyItFailed(stopped, "x"));
}

console.log("\nAnd the work moves rather than stopping");
{
  forgetHealth();
  const ctx = { configured: { anthropic: true, openai: true, moonshot: true, deepseek: true }, keys: {} as Record<string, string> };
  const spent = classifyError("anthropic", 400, '{"error":{"message":"Your credit balance is too low."}}');
  check(worthMoving(spent.kind), "an empty balance is worth carrying elsewhere", spent.kind);
  const other = elsewhere(["anthropic"], ctx);
  check(Boolean(other) && other!.provider !== "anthropic", "and there is somewhere to carry it", other?.id ?? "nowhere");
  check(whyAvoided(spent.kind, "Anthropic") === "Anthropic is out of credit",
    "with a line the room can pass on", whyAvoided(spent.kind, "Anthropic"));

  /* The ones that would fail the same way anywhere stay put: carrying a
     conversation that is too long to a second company spends a second key
     to be told the same thing. */
  for (const [status, body, kind] of [
    [400, '{"error":{"message":"prompt is too long: 250000 tokens > 200000"}}', "context_length"],
    [400, '{"error":{"message":"blocked by the safety filter"}}', "content_filter"],
  ] as const) {
    const e = classifyError("anthropic", status, body);
    check(e.kind === kind, `${kind} is read as itself`, e.kind);
    check(!worthMoving(e.kind), "and is not carried anywhere, because it would fail there too");
  }

  /* And the company that refused is stepped around for the next one. */
  noteFailure("anthropic", spent.kind);
  check(isAiling("anthropic"), "the company that refused is remembered");
  forgetHealth();
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
