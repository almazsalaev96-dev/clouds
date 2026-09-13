/* Voice mode's loop, with no microphone in the room.
 *
 * Listen, send what was said, speak the answer, listen again — and the
 * three ways that goes wrong: an answer read twice, a mic that opens under
 * the voice, a stop that leaves the voice talking.
 *
 *   npx jiti test-voice.ts */
import { VOICE_OFF, voiceStep, speakable, type VoiceState, type VoiceEvent } from "./lib/voice";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const play = (events: VoiceEvent[], from: VoiceState = VOICE_OFF) => {
  let s = from; const fx: string[] = [];
  for (const e of events) { const r = voiceStep(s, e); s = r.state; fx.push(...r.effects.map((x) => x.type)); }
  return { s, fx };
};

console.log("\nThe loop");
{
  const { s, fx } = play([
    { type: "start" }, { type: "heard", text: "what is a monad" },
    { type: "answered", id: "a1", text: "A monad is a box." }, { type: "spoken" },
  ]);
  check(fx.join(",") === "listen,send,speak,listen", "listen, send, speak, listen again", fx.join(","));
  check(s.phase === "listening" && s.spokenId === "a1", "and it is listening again with the answer marked as read");
}

console.log("\nWhat must not happen");
{
  const thinking: VoiceState = { phase: "thinking", spokenId: null, silences: 0 };
  const r = voiceStep({ phase: "speaking", spokenId: "a1", silences: 0 }, { type: "answered", id: "a1", text: "again" });
  check(r.effects.length === 0, "an answer is not read twice because it re-rendered");
  const r2 = voiceStep({ phase: "listening", spokenId: "a1", silences: 0 }, { type: "answered", id: "a1", text: "again" });
  check(r2.effects.length === 0, "nor once it has been read and the mic is open");
  const r3 = voiceStep({ phase: "speaking", spokenId: "a1", silences: 0 }, { type: "silence" });
  check(r3.effects.length === 0 && r3.state.phase === "speaking", "the mic does not reopen under the voice");
  const r4 = voiceStep(thinking, { type: "heard", text: "more" });
  check(r4.effects.length === 0, "and nothing heard while the model is thinking is sent");
  const r5 = voiceStep({ phase: "speaking", spokenId: "a1", silences: 0 }, { type: "stop" });
  check(r5.state.phase === "off" && r5.effects.map((e) => e.type).join() === "hush", "stop hushes everything at once");
  const r6 = voiceStep({ phase: "listening", spokenId: null, silences: 0 }, { type: "heard", text: "   " });
  check(r6.state.phase === "listening" && r6.effects[0]?.type === "listen" && r6.state.silences === 1, "an empty phrase is silence, and it listens again");
  const quiet = play([{ type: "start" }, { type: "silence" }, { type: "silence" }, { type: "silence" }]);
  check(quiet.s.phase === "off" && quiet.fx.join(",") === "listen,listen,listen,hush", "three empty listens in a row and the mode switches itself off", quiet.fx.join(","));
  const spoke = play([{ type: "start" }, { type: "silence" }, { type: "silence" }, { type: "heard", text: "hi" }]);
  check(spoke.s.silences === 0, "and a phrase resets the count");
  const broke = play([{ type: "start" }, { type: "failed" }]);
  check(broke.s.phase === "off" && broke.fx.join(",") === "listen,hush", "a recogniser that cannot start is not retried");
  const r7 = voiceStep(thinking, { type: "answered", id: "a2", text: "```js\nx\n```" });
  check(r7.state.phase === "listening" && r7.effects[0]?.type === "listen", "an answer that is only code is not read aloud; it listens again");
}

console.log("\nWhat is said aloud");
{
  const t = speakable("## Title\n\nSome **bold** and `code` and a [link](http://x).\n\n```js\nconst a = 1;\n```\n\n- one\n- two");
  check(!t.includes("#") && !t.includes("**") && !t.includes("`") && !t.includes("http"), "markdown furniture is gone", t);
  check(t.includes("(code)") && !t.includes("const a"), "and a code block is named, not read");
  check(t.includes("link") && t.includes("one") && t.includes("two"), "the words stay");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
