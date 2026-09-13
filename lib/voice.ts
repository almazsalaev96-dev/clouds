/**
 * Voice mode, as a state machine with no browser in it.
 *
 * The mic in the composer is dictation: it fills the box, and you press send.
 * Voice mode is the loop the big assistants have — listen, send what was
 * said, speak the answer, listen again — and the loop is the part that goes
 * wrong: a reply spoken twice because the answer re-rendered, a mic that
 * opens while the answer is still being read, a stop that leaves the voice
 * talking. So the sequence lives here, pure, where it can be tested without
 * a microphone, and the hook that owns the browser objects only does what
 * the machine says.
 */

export type VoicePhase = "off" | "listening" | "thinking" | "speaking";

export type VoiceEvent =
  | { type: "start" }
  | { type: "stop" }
  /** The recogniser settled on a phrase. */
  | { type: "heard"; text: string }
  /** The recogniser ended with nothing usable. */
  | { type: "silence" }
  /** The recogniser cannot run at all: no permission, no network, no mic. */
  | { type: "failed" }
  /** The model has finished answering; this is what it said, and its id. */
  | { type: "answered"; id: string; text: string }
  /** The synthesiser finished, or was cut off. */
  | { type: "spoken" };

export interface VoiceState {
  phase: VoicePhase;
  /** The last answer read out, so a re-render of the same one is not read twice. */
  spokenId: string | null;
  /** Consecutive empty listens. A mic left open in an empty room closes itself. */
  silences: number;
}

/** After this many empty listens in a row, the mode switches itself off. */
export const SILENCE_LIMIT = 3;

export type VoiceEffect =
  | { type: "listen" }
  | { type: "send"; text: string }
  | { type: "speak"; text: string }
  | { type: "hush" };

export const VOICE_OFF: VoiceState = { phase: "off", spokenId: null, silences: 0 };

/** The next state, and what the world has to do to get there. */
export function voiceStep(state: VoiceState, event: VoiceEvent): { state: VoiceState; effects: VoiceEffect[] } {
  const { phase } = state;
  switch (event.type) {
    case "start":
      if (phase !== "off") return { state, effects: [] };
      return { state: { ...state, phase: "listening", silences: 0 }, effects: [{ type: "listen" }] };

    case "stop":
      if (phase === "off") return { state, effects: [] };
      /* Everything off at once: the mic, the voice, and the loop. A stop that
         only closed the mic left the answer talking to an empty room. */
      return { state: { ...state, phase: "off" }, effects: [{ type: "hush" }] };

    case "heard": {
      if (phase !== "listening") return { state, effects: [] };
      const text = event.text.trim();
      if (!text) return voiceStep(state, { type: "silence" });
      return { state: { ...state, phase: "thinking", silences: 0 }, effects: [{ type: "send", text }] };
    }

    case "silence":
      /* Nothing said: keep listening. Only while listening — a recogniser
         that ends while the answer is being spoken must not reopen the mic
         under the voice, or the assistant hears itself. */
      if (phase !== "listening") return { state, effects: [] };
      if (state.silences + 1 >= SILENCE_LIMIT) return { state: { ...state, phase: "off", silences: 0 }, effects: [{ type: "hush" }] };
      return { state: { ...state, silences: state.silences + 1 }, effects: [{ type: "listen" }] };

    case "failed":
      /* Not a retry. A recogniser that cannot start will not start next
         time either, and a loop that tries anyway pins the tab. */
      if (phase === "off") return { state, effects: [] };
      return { state: { ...state, phase: "off", silences: 0 }, effects: [{ type: "hush" }] };

    case "answered": {
      if (phase !== "thinking") return { state, effects: [] };
      if (event.id === state.spokenId) return { state, effects: [] };
      const text = speakable(event.text);
      /* An answer that is nothing but code has nothing to say. */
      if (!text.replace(/\(code\)/g, "").trim()) return { state: { ...state, phase: "listening", spokenId: event.id }, effects: [{ type: "listen" }] };
      return { state: { ...state, phase: "speaking", spokenId: event.id }, effects: [{ type: "speak", text }] };
    }

    case "spoken":
      if (phase !== "speaking") return { state, effects: [] };
      return { state: { ...state, phase: "listening" }, effects: [{ type: "listen" }] };
  }
}

/**
 * What of an answer is worth saying aloud. Code is not — "backtick backtick
 * backtick const x equals" is nobody's idea of an answer — and markdown's
 * furniture reads as noise, so headings, emphasis and links are stripped to
 * their words.
 */
export function speakable(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " (code) ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\|/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
