/**
 * A typed prefix that sets the room before the question.
 *
 * "/study explain osmosis" is the same request as choosing the Orrery in the
 * picker and then typing "explain osmosis" — and for the person who knows
 * what they want, it is one gesture instead of three. ChatGPT proved the
 * reflex with `@study`; every command palette since VS Code has proved that
 * a prefix people can type beats a menu people have to find.
 *
 * Pure: a string in, a decision out. Nothing here knows about the composer,
 * so the composer can show a hint the moment a slash is typed, and the send
 * path can apply the decision, and neither has to agree with the other about
 * how a command is spelled.
 */

import { PRESETS } from "./presets";
import type { TaskKind } from "./task";

export interface Slash {
  /** What was typed after the command, trimmed. May be empty. */
  text: string;
  /** An Armi model to answer as, by id, where the command named one. */
  presetId?: string;
  /** Let the model search the web, for this conversation. */
  research?: boolean;
  /** Do not keep this chat. */
  temporary?: boolean;
  /** Two answers, side by side. */
  compare?: boolean;
  /** A second model reads the answer back. */
  check?: boolean;
  /** A picture from the words, not words about one. */
  picture?: boolean;
  /** A slide deck, built and run beside the chat. */
  slides?: boolean;
  /** Research, taken further: several searches, then a report with sources. */
  deep?: boolean;
  /** The kind of work named by the verb, which shapes the tier's cast. */
  kind?: TaskKind;
  /** An assistant of the person's own, summoned by its command. */
  assistantId?: string;
  /** How the command was written, for the hint and the byline. */
  command: string;
}

/** The commands that are not built in: one per assistant the person made. */
export interface SlashExtra {
  command: string;
  assistantId: string;
  does: string;
}

/** The commands that are not a model's name. */
const VERBS: Record<string, Partial<Slash>> = {
  study: { presetId: "one", kind: "learning" },
  tutor: { presetId: "one", kind: "learning" },
  teach: { presetId: "one", kind: "learning" },
  build: { presetId: "one", kind: "coding" },
  code: { presetId: "one", kind: "coding" },
  translate: { presetId: "one", kind: "translate" },
  write: { presetId: "one", kind: "writing" },
  maths: { presetId: "one", kind: "data" },
  math: { presetId: "one", kind: "data" },
  compare: { compare: true },
  check: { check: true },
  verify: { check: true },
  research: { research: true },
  search: { research: true },
  temp: { temporary: true },
  temporary: { temporary: true },
  deep: { research: true, deep: true },
  max: { presetId: "astro" },
  maximum: { presetId: "astro" },
  fast: { presetId: "flash" },
  image: { picture: true },
  slides: { slides: true },
  deck: { slides: true },
  draw: { picture: true },
  picture: { picture: true },
};

/** A command's spelling, as the person would type it. */
function nameOf(s: string): string {
  return s.trim().toLowerCase().replace(/^armi\s+/, "");
}

/**
 * Read a slash command off the front of a message, or nothing.
 *
 * Only at the very start, only a word, and only one this app knows: a line
 * that begins "/usr/bin" or "/ 2" is not a command and is sent as written.
 * An unknown command is also sent as written — a typo should not silently
 * become a different room — and the composer's hint is where the person
 * finds out the command does not exist.
 */
export function parseSlash(input: string, extra: SlashExtra[] = []): Slash | null {
  const m = /^\/([\p{L}\p{N}][\p{L}\p{N}-]*)(?:\s+([\s\S]*))?$/iu.exec(input.trim());
  if (!m) return null;
  const command = m[1].toLowerCase();
  const text = (m[2] ?? "").trim();
  /* An assistant's name first: it is the person's own word, and a person
     who named one "study" meant theirs. */
  const own = extra.find((e) => e.command === command);
  if (own) return { assistantId: own.assistantId, text, command };
  const verb = VERBS[command];
  if (verb) return { ...verb, text, command };
  const preset = PRESETS.find((p) => p.group === "everyday" && (nameOf(p.short) === command || nameOf(p.id) === command));
  if (preset) return { presetId: preset.id, text, command };
  return null;
}

/** The commands there are, for the hint under the composer. */
export function slashCommands(extra: SlashExtra[] = []): { command: string; does: string }[] {
  return [
    ...extra.map((e) => ({ command: e.command, does: e.does })),
    { command: "study", does: "teach it rather than tell it — Mira's teaching cast" },
    { command: "build", does: "make the thing and run it beside the chat — Mira as a builder" },
    { command: "translate", does: "translate it, read back against the original" },
    { command: "write", does: "write it for its reader, worked out first" },
    { command: "maths", does: "show the working, risks first, checked twice" },
    { command: "image", does: "make a picture from what you describe; with one attached, change it" },
    { command: "slides", does: "make a slide deck on it — arrow keys to move, print to PDF" },
    { command: "research", does: "let the model search the web in this chat" },
    { command: "deep", does: "search from several angles, then write a report with sources" },
    { command: "max", does: "the most that can be done: planned, reasoned independently, checked — Astro 5" },
    { command: "fast", does: "the quickest answer, checked while you read — Nova 4" },
    { command: "compare", does: "two companies answer, side by side" },
    { command: "check", does: "a second model reads the answer back" },
    { command: "temp", does: "do not keep this chat" },
    ...PRESETS.filter((p) => p.group === "everyday").map((p) => ({ command: nameOf(p.short), does: p.tagline.toLowerCase() })),
  ];
}

/** Whether a half-typed line is on its way to being a command. */
export function typingSlash(input: string): string | null {
  const m = /^\/([\p{L}\p{N}-]*)$/iu.exec(input);
  return m ? m[1].toLowerCase() : null;
}
