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
  /** Research, taken further: several searches, then a report with sources. */
  deep?: boolean;
  /** How the command was written, for the hint and the byline. */
  command: string;
}

/** The commands that are not a model's name. */
const VERBS: Record<string, Partial<Slash>> = {
  study: { presetId: "tutor" },
  tutor: { presetId: "tutor" },
  build: { presetId: "forge" },
  code: { presetId: "forge" },
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
export function parseSlash(input: string): Slash | null {
  const m = /^\/([a-z][a-z0-9-]*)(?:\s+([\s\S]*))?$/i.exec(input.trim());
  if (!m) return null;
  const command = m[1].toLowerCase();
  const text = (m[2] ?? "").trim();
  const verb = VERBS[command];
  if (verb) return { ...verb, text, command };
  const preset = PRESETS.find((p) => nameOf(p.short) === command || nameOf(p.id) === command);
  if (preset) return { presetId: preset.id, text, command };
  return null;
}

/** The commands there are, for the hint under the composer. */
export function slashCommands(): { command: string; does: string }[] {
  return [
    { command: "study", does: "teach it rather than tell it — the Orrery" },
    { command: "build", does: "make the thing and run it beside the chat — Forge" },
    { command: "image", does: "make a picture from what you describe; with one attached, change it" },
    { command: "research", does: "let the model search the web in this chat" },
    { command: "deep", does: "search from several angles, then write a report with sources" },
    { command: "max", does: "the most that can be done: planned, reasoned independently, checked — Astro 5" },
    { command: "fast", does: "the quickest answer, checked while you read — Nova 4" },
    { command: "compare", does: "two companies answer, side by side" },
    { command: "check", does: "a second model reads the answer back" },
    { command: "temp", does: "do not keep this chat" },
    ...PRESETS.map((p) => ({ command: nameOf(p.short), does: p.tagline.toLowerCase() })),
  ];
}

/** Whether a half-typed line is on its way to being a command. */
export function typingSlash(input: string): string | null {
  const m = /^\/([a-z0-9-]*)$/i.exec(input);
  return m ? m[1].toLowerCase() : null;
}
