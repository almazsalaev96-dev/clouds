import type { ModelParams } from "./types";

/**
 * Two ways to ask.
 *
 * Chat is the default and adds nothing at all. Creative changes two things
 * that actually change an answer — how the model samples, and what it is
 * asked for — rather than being a label on a toggle.
 *
 * Sampling first, because that is the half a prompt cannot do. Temperature is
 * the width of the distribution the next token is drawn from; asking for
 * "creative" writing at temperature 0.7 gets you the most probable phrasing
 * of an unusual instruction, which is exactly the flat, competent prose people
 * mean when they say an answer sounds like AI. The prompt half then asks for
 * range and for the option that was not obvious — and, deliberately, keeps the
 * requirement to be accurate, because the failure mode of a creative setting
 * is a model that decides facts are also negotiable.
 */
export type Mode = "chat" | "creative";

export interface ModeSpec {
  id: Mode;
  label: string;
  blurb: string;
  /** Layered after the style, closest to the answer. */
  instructions: string;
  /** Applied over the model's own parameters. */
  params?: Partial<ModelParams>;
}

export const MODES: ModeSpec[] = [
  {
    id: "chat",
    label: "Chat",
    blurb: "Straight answers.",
    instructions: "",
  },
  {
    id: "creative",
    label: "Creative",
    blurb: "Range, options, the unobvious one.",
    instructions: [
      "Work in a creative register.",
      "Where there is more than one good answer, give more than one, and say what each is good for — do not silently pick the safe one.",
      "Reach for the specific over the general: a concrete image, a real example, an unexpected but apt comparison.",
      "Avoid the phrasings that show up in every answer to this kind of question. If a sentence could open any essay on the subject, it is the wrong sentence.",
      "None of this loosens accuracy. Invent freely in what you write; never in what you claim is true.",
    ].join("\n"),
    /* 1.0 is the top of the range every provider here accepts, and the point
       where the distribution is the model's own rather than a sharpened copy.

       This half does not always land, and that is the provider's rule rather
       than a bug: Anthropic rejects `temperature` alongside extended thinking,
       so on a reasoning model with a thinking budget the request goes out
       without it and the instructions above do the work alone. Creative does
       not turn thinking off to win the argument — trading reasoning for
       sampling width would be a silent downgrade, and nobody asked for it. */
    params: { temperature: 1, topP: 0.98 },
  },
];

export const DEFAULT_MODE: Mode = "chat";

export function findMode(id: string | undefined): ModeSpec {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}
