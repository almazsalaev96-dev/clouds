/**
 * How it talks to you: the Personalization page the reference products
 * share — a base style and tone, a few characteristics turned up or down,
 * and what it should know about you — turned into a short block of the
 * system prompt.
 *
 * It sits with the person's own rules, after the house rules, so it wins a
 * disagreement with them (someone who asks for emoji gets emoji) and loses
 * one with a rule they wrote themselves. Nothing is said when nothing was
 * set: the default is no block at all, not a paragraph saying "default".
 */

export type Base = "default" | "professional" | "friendly" | "candid" | "quirky" | "efficient" | "nerdy" | "cynical";
export type Level = "more" | "default" | "less";

export interface Persona {
  base: Base;
  warm: Level;
  enthusiastic: Level;
  headers: Level;
  emoji: Level;
  nickname: string;
  occupation: string;
  about: string;
}

export const DEFAULT_PERSONA: Persona = {
  base: "default",
  warm: "default",
  enthusiastic: "default",
  headers: "default",
  emoji: "default",
  nickname: "",
  occupation: "",
  about: "",
};

export const BASES: { id: Base; label: string; blurb: string; says: string }[] = [
  { id: "default", label: "Default", blurb: "Balanced and clear", says: "" },
  { id: "professional", label: "Professional", blurb: "Polished and precise", says: "Polished and precise: complete sentences, exact terms, no slang or jokes." },
  { id: "friendly", label: "Friendly", blurb: "Warm and chatty", says: "Warm and chatty, like a kind older friend who happens to know the subject." },
  { id: "candid", label: "Candid", blurb: "Direct and encouraging", says: "Direct and honest: say plainly when something is wrong or weak, then how to make it right, and be encouraging about it." },
  { id: "quirky", label: "Quirky", blurb: "Playful and imaginative", says: "Playful and imaginative: a light joke or an unexpected comparison where it helps something stick, never at the cost of being right." },
  { id: "efficient", label: "Efficient", blurb: "Concise and plain", says: "Concise and plain: the answer and what is needed to use it, nothing else." },
  { id: "nerdy", label: "Nerdy", blurb: "Exploratory and enthusiastic", says: "Curious and enthusiastic about ideas: add the one fascinating connection or the why behind the why when there is one." },
  { id: "cynical", label: "Cynical", blurb: "Critical and sarcastic", says: "Dry and sceptical, with a little sarcasm — but always helpful underneath, and never unkind to the person." },
];

export const TRAITS: { id: "warm" | "enthusiastic" | "headers" | "emoji"; label: string; more: string; less: string }[] = [
  { id: "warm", label: "Warm", more: "Be noticeably warm and caring in how you word things.", less: "Keep the tone neutral and matter-of-fact; no reassurance or warmth added." },
  { id: "enthusiastic", label: "Enthusiastic", more: "Show real enthusiasm and energy.", less: "Keep it calm and understated; no exclamation marks or excitement." },
  { id: "headers", label: "Headers & lists", more: "Use headers and lists freely to organise longer answers.", less: "Avoid headers and lists; write in paragraphs unless a list is unavoidable." },
  { id: "emoji", label: "Emoji", more: "Use emoji now and then where they add warmth or make a point clearer.", less: "Never use emoji." },
];

/** The block for the system prompt, or "" when nothing was set. */
export function personaText(p: Partial<Persona> | undefined): string {
  const persona = { ...DEFAULT_PERSONA, ...(p ?? {}) };
  const lines: string[] = [];
  const base = BASES.find((b) => b.id === persona.base);
  if (base?.says) lines.push(`Style and tone: ${base.says}`);
  for (const t of TRAITS) {
    const level = persona[t.id];
    if (level === "more") lines.push(t.more);
    if (level === "less") lines.push(t.less);
  }
  const about: string[] = [];
  /* Its own field, not the greeting's name: that one is promised never to
     leave the browser, and this one is typed here to be sent. */
  if (persona.nickname.trim()) about.push(`Call them ${persona.nickname.trim().slice(0, 60)}.`);
  if (persona.occupation.trim()) about.push(`What they do: ${persona.occupation.trim().slice(0, 200)}.`);
  if (persona.about.trim()) about.push(`In their words: ${persona.about.trim().slice(0, 1500)}`);
  if (!lines.length && !about.length) return "";
  const out = ["## How to talk to this person"];
  if (lines.length) out.push(lines.join("\n"));
  if (about.length) out.push(`About them (use it where it helps the answer — examples from their world, their level — and never recite it back):\n${about.join("\n")}`);
  return out.join("\n\n");
}
