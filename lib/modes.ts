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
  /** What the composer asks, so the box itself says which mode you are in. */
  placeholder: string;
  /**
   * What a blank page offers. Chat's openers are diagnostic — bring me a
   * thing that is broken. Creative's are generative, because "Explain this
   * error" under a mode that widens the sampling distribution is the app
   * offering you the one job the mode is worst at.
   */
  openers: string[];
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
    placeholder: "How can I help you today?",
    openers: [
      "Explain this error and how to fix it",
      "What's wrong with my SQL query?",
      "Rewrite this so a beginner understands it",
      "Compare two approaches and pick one",
      "Turn these notes into a short summary",
      "Write a regex for this, and explain each part",
      "Find the bug in this function",
      "Draft a reply to this message",
    ],
    instructions: "",
  },
  {
    id: "creative",
    label: "Creative",
    blurb: "Range, options, the unobvious one.",
    placeholder: "What should we make?",
    openers: [
      "Give me ten names, and say what each one promises",
      "Write the opening line six different ways",
      "What would this look like if it were wrong on purpose?",
      "Pitch three directions, then argue against your favourite",
      "Describe this without using any of the obvious words",
      "Turn this into something someone would forward",
      "What is the version of this nobody has tried?",
      "Same idea, half the length, twice the nerve",
    ],
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
