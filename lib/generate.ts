"use client";

import { getModel } from "./models";
import { useSettings } from "./store";
import type { ProviderId } from "./types";

/**
 * One-shot generation for the things the app asks for on the user's behalf —
 * a conversation title, a set of flashcards, a first draft of a paper.
 *
 * Deliberately not the streaming path: none of these are read as they arrive,
 * so the extra machinery would buy nothing. Failure is a returned null, never
 * a thrown error, because every caller here is doing something optional.
 */
export async function complete(
  prompt: string,
  opts: { modelId?: string; maxTokens?: number; temperature?: number; system?: string } = {},
): Promise<string | null> {
  const settings = useSettings.getState();
  const modelId = opts.modelId ?? settings.modelId;
  const provider = getModel(modelId).provider;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        modelId,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        systemPrompt: opts.system,
        // Explicit and self-contained. These calls want a complete, parseable
        // answer, not the sampling settings someone left on the chat surface.
        params: {
          maxTokens: opts.maxTokens ?? 8192,
          temperature: opts.temperature ?? 0.4,
          topP: 1,
          reasoningEffort: undefined,
        },
        clientKey: settings.keys[provider] || undefined,
      }),
    });
    if (!res.body) return null;

    let out = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n\n")) !== -1) {
        const chunk = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        if (!chunk.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(chunk.slice(6));
          if (ev.type === "text") out += ev.text;
          if (ev.type === "error") return null;
        } catch {
          /* partial frame */
        }
      }
    }
    return out.trim() || null;
  } catch {
    return null;
  }
}

/** The cheapest model the user actually has a key for. */
export function cheapestAvailable(configured: Record<string, boolean>): string {
  const settings = useSettings.getState();
  const preference = ["claude-haiku-4-5", "gemini-2.5-flash", "gpt-5.1-mini", "deepseek-chat"];
  const usable = (id: string) => {
    const p = getModel(id).provider as ProviderId;
    return Boolean(configured[p] || settings.keys[p]);
  };
  return preference.find(usable) ?? settings.modelId;
}

/** Models like to wrap JSON in prose or a fence. Both are stripped here. */
export function extractJson(raw: string): unknown | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? raw).trim();
  const start = body.search(/[[{]/);
  if (start === -1) return null;
  const end = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
  if (end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

export interface DraftCard {
  front: string;
  back: string;
}

/**
 * The prompt does most of the work here. Asking for "flashcards" gets you
 * definitions; asking for one idea per card, in the source's own terms, with
 * answers short enough to grade honestly, gets you something worth reviewing.
 */
export async function generateCards(
  source: string,
  opts: { count?: number; modelId?: string },
): Promise<DraftCard[] | null> {
  const count = opts.count ?? 12;
  const prompt = `Turn the material below into ${count} flashcards for spaced repetition.

Rules:
- One idea per card. Never two questions in one.
- Write the question so it can only be answered by understanding, not by recognising the wording.
- Answers must be short — a phrase or a sentence, never a paragraph. If an answer needs three sentences, it is really three cards.
- Prefer "why" and "when" over "what" wherever the material supports it.
- Use only what the material actually says. Invent nothing.
- Keep the source's own vocabulary and notation.

Reply with a JSON array and nothing else, each item {"front": "...", "back": "..."}.

MATERIAL
${source.slice(0, 24_000)}`;

  const raw = await complete(prompt, { modelId: opts.modelId, maxTokens: 8192, temperature: 0.3 });
  if (!raw) return null;

  const parsed = extractJson(raw);
  if (!Array.isArray(parsed)) return null;

  return parsed
    .filter(
      (c): c is DraftCard =>
        Boolean(c) &&
        typeof (c as DraftCard).front === "string" &&
        typeof (c as DraftCard).back === "string" &&
        (c as DraftCard).front.trim().length > 0 &&
        (c as DraftCard).back.trim().length > 0,
    )
    .map((c) => ({ front: c.front.trim(), back: c.back.trim() }))
    .slice(0, count * 2);
}

const PAPER_SHAPES = {
  report: `a structured report: a one-paragraph summary, then sections with headings, then a short conclusion`,
  essay: `a continuous essay: an argument stated early, developed in paragraphs with no headings, and closed`,
  notes: `structured notes: short headed sections and tight bullet points, built for revision rather than reading aloud`,
} as const;

export async function generatePaper(
  source: string,
  format: keyof typeof PAPER_SHAPES,
  title: string,
  modelId?: string,
): Promise<string | null> {
  const prompt = `Write ${PAPER_SHAPES[format]} from the material below.

Rules:
- Markdown only. Start at "## " for sections — the title is set separately, so do not repeat it.
- Use only what the material contains. Do not introduce facts, figures or citations that are not there.
- Where the material is thin on something, say so plainly in one clause rather than padding.
- No filler openings ("In today's world..."), no restating the brief back.
- Keep tables and code from the material intact if they carry meaning.

TITLE: ${title || "Untitled"}

MATERIAL
${source.slice(0, 40_000)}`;

  return complete(prompt, { modelId, maxTokens: 16_000, temperature: 0.4 });
}

/* -------------------------------------------------------------- practice -- */

export interface DraftTrap {
  slug: string;
  label: string;
  diagnosis: string;
  quote?: string;
}

export interface SkillSketch {
  name: string;
  goal: string;
  primer: string;
  traps: DraftTrap[];
  /** Set instead of traps when the seed was too vague to work from. */
  needs?: string;
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

/**
 * Turn a seed into a skill and its traps.
 *
 * The whole design rests on this prompt producing *mistakes* rather than
 * topics. "Integration by parts" is not a trap; "differentiates the wrong
 * factor, so the integral gets harder instead of easier" is — it can be
 * caught by a specific problem, named the moment it happens, and scheduled on
 * its own curve. A model asked for "subtopics" returns a table of contents
 * every time, so the prompt asks for the wrong move, in the second person, and
 * refuses nouns.
 */
export async function sketchSkill(
  seed: string,
  modelId?: string,
): Promise<SkillSketch | { error: string }> {
  const hasSource = seed.trim().length > 400;
  const prompt = `A learner gave you this to practise. Find the specific mistakes they are likely to make.

Return JSON only:
{
  "name": "short name for the skill, 2-5 words",
  "goal": "one sentence, second person, what they will be able to do",
  "primer": "markdown, at most 150 words — the minimum needed to attempt one problem. No preamble, no motivation, no history.",
  "traps": [
    {
      "label": "the wrong MOVE, phrased as a move in the third person: 'swaps the limits when the substitution is decreasing'. Never a topic name, never a noun phrase like 'the chain rule'.",
      "diagnosis": "one sentence, second person, present tense, shown the instant they make it: 'You substituted but kept the original limits.'"${hasSource ? ',\n      "quote": "the verbatim sentence from the material this trap came from — copied exactly, not paraphrased"' : ""}
    }
  ]
}

Rules:
- Four to six traps. Each must be a distinct wrong move, not a rephrasing.
- A trap must be catchable by a single problem. If you cannot imagine the problem, it is a topic, not a trap.
- Order them by how often a learner actually makes them, most common first.
- Invent nothing that is not implied by the material.${hasSource ? "\n- Every quote must appear verbatim in the material. A trap you cannot quote for, omit." : ""}
- If the material is too vague to find real mistakes, return {"needs": "one sentence saying exactly what you would need"} and nothing else.

MATERIAL
${seed.slice(0, 24_000)}`;

  const raw = await complete(prompt, { modelId, maxTokens: 4096, temperature: 0.3 });
  if (!raw) return { error: "The model didn't answer. Check the API key for it, or try another." };

  const parsed = extractJson(raw) as Partial<SkillSketch> | null;
  if (!parsed) return { error: "The model's answer wasn't usable. Try again, or give it more to work from." };
  if (typeof parsed.needs === "string" && !parsed.traps?.length) {
    return { name: "", goal: "", primer: "", traps: [], needs: parsed.needs };
  }

  const seen = new Set<string>();
  const traps = (parsed.traps ?? [])
    .filter((t): t is DraftTrap => Boolean(t?.label && t?.diagnosis))
    // A quote that is not literally in the source is a fabrication, and the
    // one thing this section promises is that it does not invent evidence.
    .filter((t) => !t.quote || seed.includes(t.quote.trim()))
    .map((t) => ({ ...t, slug: slugify(t.label) }))
    .filter((t) => t.slug && !seen.has(t.slug) && seen.add(t.slug))
    .slice(0, 6);

  if (!traps.length) return { error: "No usable traps came back. Try pasting a worked example." };

  return {
    name: (parsed.name ?? "").trim().slice(0, 60) || "Untitled skill",
    goal: (parsed.goal ?? "").trim(),
    primer: (parsed.primer ?? "").trim(),
    traps,
  };
}

export interface DraftProblem {
  trapSlug: string;
  kind: "cloze" | "numeric";
  prompt: string;
  accept?: string[];
  value?: number;
  tolerance?: number;
  explanation: string;
  hint: string;
  stepOne: string;
}

/**
 * Write problems that catch specific traps.
 *
 * Two problems per trap, generated together, because the second one exists to
 * be served much later in the session — asking for it at that moment would put
 * a model call on the path of someone mid-drill.
 */
export async function generateProblems(
  skill: { name: string; primer: string },
  traps: { slug: string; label: string }[],
  band: 1 | 2 | 3,
  modelId?: string,
): Promise<DraftProblem[] | null> {
  const difficulty = {
    1: "straightforward — one step, clean numbers, the trap is the only difficulty",
    2: "ordinary — two or three steps, the trap is not signposted",
    3: "demanding — the trap is buried inside a longer problem",
  }[band];

  const prompt = `Write practice problems for "${skill.name}". Two problems per trap listed below, each catching only its own trap.

Difficulty: ${difficulty}.

Return a JSON array only, each item:
{
  "trapSlug": "exactly one of the slugs below",
  "kind": "cloze" or "numeric",
  "prompt": "the problem. Markdown and $LaTeX$ are fine. For cloze, write the blank as ___ (three underscores), exactly one per problem.",
  "accept": ["every form of the correct answer a careful learner might type"],   // cloze only
  "value": 0, "tolerance": 0,                                                     // numeric only
  "explanation": "one sentence naming the rule that decides it — not a restatement of the steps",
  "hint": "a nudge that does NOT contain the answer",
  "stepOne": "the first step, performed, so a learner who missed can retry from there"
}

Rules:
- No multiple choice, ever. The answer must not be on screen before they produce one.
- A problem must be wrong-answerable in exactly the way its trap describes. If someone avoids the trap they should get it right.
- Cloze answers must be short and unambiguous. If the correct answer could be written five ways, make it numeric instead.
- accept must include the plain form and the obvious equivalents (spacing, case, 1/2 vs 0.5).
- Never mention the trap in the prompt. Naming it is the answer.

TRAPS
${traps.map((t) => `- ${t.slug}: ${t.label}`).join("\n")}

PRIMER
${skill.primer.slice(0, 2000)}`;

  const raw = await complete(prompt, { modelId, maxTokens: 8192, temperature: 0.6 });
  if (!raw) return null;
  const parsed = extractJson(raw);
  if (!Array.isArray(parsed)) return null;

  const slugs = new Set(traps.map((t) => t.slug));
  return (parsed as DraftProblem[])
    .filter((p) => p && slugs.has(p.trapSlug) && typeof p.prompt === "string")
    .filter((p) =>
      p.kind === "numeric"
        ? typeof p.value === "number"
        : Array.isArray(p.accept) && p.accept.length > 0 && p.prompt.includes("___"),
    )
    .map((p) => ({
      ...p,
      explanation: p.explanation ?? "",
      hint: p.hint ?? "",
      stepOne: p.stepOne ?? "",
    }));
}
