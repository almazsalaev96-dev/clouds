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
/**
 * The cheapest model that can actually answer, or nothing.
 *
 * It used to end `?? settings.modelId` — fall back to whatever chat is set to
 * — which reads as a sensible default and is a lie when no provider has a key
 * at all: it hands back a model that cannot be called, so every caller's
 * `if (!modelId) tell them` branch was unreachable and asking a canvas for a
 * change with no key configured did nothing at all. Silence is the worst
 * possible answer; the honest one is null.
 */
export function cheapestAvailable(configured: Record<string, boolean>): string | null {
  const settings = useSettings.getState();
  const preference = ["claude-haiku-4-5", "gemini-2.5-flash", "gpt-5.1-mini", "deepseek-chat"];
  const usable = (id: string) => {
    const p = getModel(id).provider as ProviderId;
    return Boolean(configured[p] || settings.keys[p]);
  };
  // The chosen chat model is the fallback only when it is one that can answer.
  return preference.find(usable) ?? (usable(settings.modelId) ? settings.modelId : null);
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
 * Standing rules for one file, folded into a prompt.
 *
 * The idea is Claude Code's `CLAUDE.md` and Codex's skills: the things that are
 * true of this project every single time — the language, the framework, the
 * conventions, the thing nobody is allowed to touch — said once rather than
 * retyped at the top of every request. An instruction is what you want now; a
 * rule is what has been true since before you asked.
 *
 * Placed *before* the instruction and marked as standing, because the order
 * matters when the two disagree: a rule that arrives after the request reads as
 * an afterthought to it, and a model resolves the conflict in favour of
 * whichever it saw as the actual ask.
 */
function houseRules(rules?: string): string {
  const body = rules?.trim();
  if (!body) return "";
  return `\n\nSTANDING RULES
These are always in force, whether or not the instruction mentions them. Where an
instruction and a rule disagree, follow the rule and say nothing about it.

${body.slice(0, 8000)}`;
}

/**
 * The project a file belongs to, folded into the rules that always apply.
 *
 * A project already held instructions and material that every chat inside it
 * could see. The code in that same project could not — so the conventions you
 * wrote once, for the thing you were building, were the one context missing
 * from every edit to the thing you were building. This closes that.
 *
 * Two layers, widest first, because the narrower one has to be able to win: the
 * project says "TypeScript everywhere", the file is allowed to say "except this
 * one, which is a build script".
 */
export function standingRules(parts: {
  projectName?: string;
  projectInstructions?: string;
  fileRules?: string;
}): string | undefined {
  const out: string[] = [];
  const project = parts.projectInstructions?.trim();
  if (project) out.push(`From the project “${parts.projectName ?? "this project"}”:\n${project}`);
  const file = parts.fileRules?.trim();
  if (file) out.push(`For this file in particular:\n${file}`);
  return out.length ? out.join("\n\n") : undefined;
}

export async function reviseCanvas(
  current: string,
  instruction: string,
  kind: "code" | "doc" | "web",
  lang: string | undefined,
  modelId?: string,
  /**
   * The rest of the folder, on a web canvas. Without it a model asked to wire
   * up a button in app.js cannot see that the button has no id in index.html,
   * and confidently writes a selector for something that does not exist.
   */
  siblings?: { name: string; content: string }[],
  /**
   * How much of each reference to send.
   *
   * Twelve thousand characters is right for a sibling file in a folder — it is
   * there so a model wiring up a button can see the markup the button lives
   * in. It is far too little for a book: the notebook sends a whole source and
   * asks for lessons from it, and cutting that to three pages would produce
   * lessons about three pages while looking like lessons about the book.
   */
  perSibling = 12_000,
  /** Standing rules for this file. See `houseRules`. */
  rules?: string,
): Promise<string | null> {
  const what = kind === "doc" ? "document" : `${lang ?? "code"} file`;
  const context = siblings?.length
    ? `\n\nReference material, to read and not to return. Do NOT include any of it in your answer.\n\n` +
      siblings
        .map((f) => `--- ${f.name} ---\n${f.content.slice(0, perSibling)}`)
        .join("\n\n")
    : "";
  const prompt = `Revise the ${what} below according to the instruction.

Rules:
- Return the COMPLETE revised ${what} and nothing else. No preamble, no explanation, no "here is".
- Change only what the instruction asks for. Leave everything else byte for byte as it is — formatting, comments, blank lines, ordering.
- If the instruction cannot be carried out, return the ${what} unchanged rather than guessing at what was meant.
${kind === "code" ? "- Do not wrap the answer in a markdown fence unless the file itself is markdown." : ""}

INSTRUCTION
${instruction}${houseRules(rules)}${context}

CURRENT
${current.slice(0, 60_000)}`;

  const out = await complete(prompt, { modelId, maxTokens: 16_000, temperature: 0.15 });
  if (!out) return null;

  /* Models fence code even when told not to. Strip one wrapping fence — but
     only if it wraps the *whole* answer, because a markdown document that
     happens to open and close with a code block is not a fenced answer. */
  const fenced = out.match(/^\s*```[\w.-]*\n([\s\S]*?)\n?```\s*$/);

  /* Match the file's own trailing-newline convention rather than imposing one.
     A revision that silently adds a final newline shows up in the diff as a
     change nobody asked for, on every single revision, and a diff with a line
     of noise in it is a diff people stop reading. */
  const trailing = /\n$/.test(current) ? "\n" : "";
  return (fenced ? fenced[1] : out).replace(/\s+$/, "") + trailing;
}

/**
 * What this code does, in prose.
 *
 * Deliberately not a revision: "explain" is the one shortcut of the five that
 * must not touch the file, and a feature that sometimes edits and sometimes
 * does not is one people stop trusting with either.
 */
/**
 * Rewrite one selected span, and nothing else.
 *
 * The whole-file revision is the right tool for "add retry with backoff" and
 * the wrong one for "make this a loop": it asks a model to reproduce four
 * hundred lines it was not asked to touch, which is slow, expensive, and the
 * one way a change you did want arrives alongside three you did not. Sending
 * the file for context and asking only for the replacement of the marked span
 * makes the blast radius the thing you selected.
 *
 * The rest of the file is still sent — a model asked to rewrite six lines
 * without seeing what they are called from will invent a signature.
 */
export async function reviseSelection(
  whole: string,
  selection: { start: number; end: number },
  instruction: string,
  lang: string | undefined,
  modelId?: string,
  rules?: string,
): Promise<string | null> {
  const before = whole.slice(0, selection.start);
  const chosen = whole.slice(selection.start, selection.end);
  const after = whole.slice(selection.end);

  const out = await complete(
    `Rewrite ONLY the selected part of this ${lang ?? "code"} according to the instruction.

Rules:
- Return the replacement for the selected part alone. No prose, no fences, no explanation.
- Do not return the surrounding code. Do not return the whole file.
- Match the surrounding indentation and style exactly.
- Keep it a drop-in replacement: whatever is spliced back in must leave the file valid.
- If the instruction cannot be satisfied within the selection alone, return the selection unchanged.

INSTRUCTION
${instruction}${houseRules(rules)}

BEFORE THE SELECTION (context only — do not return this)
${before.slice(-4000)}

THE SELECTION (rewrite this)
${chosen}

AFTER THE SELECTION (context only — do not return this)
${after.slice(0, 4000)}`,
    { modelId, maxTokens: 4096, temperature: 0.2 },
  );
  if (!out) return null;

  /* Models fence code even when told not to, and a fence spliced into a file
     is a syntax error. Stripped rather than refused: the answer is right and
     the wrapper is habit. */
  const body = out.replace(/^\s*```[\w-]*\n?/, "").replace(/\n?```\s*$/, "");
  return before + body.replace(/\s+$/, "") + after;
}

/**
 * A review, not a rewrite.
 *
 * The fifth of the one-press edits, and the only one that does not touch the
 * file. "Fix bugs" answers "what is broken"; this answers "what would someone
 * who has to maintain this say about it" — which is a different question and
 * the one you want before you have a bug rather than after.
 *
 * It comes back as findings you read and decide about, because a review that
 * silently rewrote the file would be "fix bugs" with a longer name.
 */
export async function reviewCode(
  current: string,
  lang: string | undefined,
  modelId?: string,
  siblings?: { name: string; content: string }[],
  rules?: string,
): Promise<string | null> {
  const context = siblings?.length
    ? `\n\nThe other files in the same folder, for reference:\n\n` +
      siblings.map((f) => `--- ${f.name} ---\n${f.content.slice(0, 8_000)}`).join("\n\n")
    : "";
  return complete(
    `Review this ${lang ?? "code"} the way a careful colleague would, and report what you find.

For each finding: what is wrong, what it would cost, and the smallest change that fixes it. Show the fix as a short code snippet where a snippet is clearer than a sentence.

Order by what would actually hurt: correctness first, then things that will break under load or on bad input, then clarity. Say where each one is — the function or the line.

Rules:
- Do not rewrite the file. This is a review.
- If something is fine, do not invent a criticism of it. A short review of good code is the correct output, and "nothing here worries me" is an allowed answer.
- Skip style opinions the language's own formatter would settle.
- Markdown, headings and short paragraphs. No preamble.
${houseRules(rules)}
${current}${context}`,
    { modelId, maxTokens: 2048, temperature: 0.2 },
  );
}

export async function explainCode(
  current: string,
  lang: string | undefined,
  modelId?: string,
  siblings?: { name: string; content: string }[],
  /**
   * How much of each reference to send.
   *
   * Twelve thousand characters is right for a sibling file in a folder — it is
   * there so a model wiring up a button can see the markup the button lives
   * in. It is far too little for a book: the notebook sends a whole source and
   * asks for lessons from it, and cutting that to three pages would produce
   * lessons about three pages while looking like lessons about the book.
   */
  perSibling = 12_000,
): Promise<string | null> {
  const context = siblings?.length
    ? `\n\nThe other files in the same folder:\n\n` +
      siblings.map((f) => `--- ${f.name} ---\n${f.content.slice(0, 8_000)}`).join("\n\n")
    : "";
  return complete(
    `Explain the ${lang ?? "code"} below to the person who wrote it.

Rules:
- Start with one sentence saying what it does overall. No preamble before that.
- Then walk the parts that carry the logic, in the order they run, not top to bottom.
- Name anything that looks wrong, fragile, or surprising, and say why. If nothing does, say so in one line rather than inventing something.
- Markdown. Short paragraphs. Do not paste the code back.

CODE
${current.slice(0, 40_000)}${context}`,
    { modelId, maxTokens: 2_000, temperature: 0.3 },
  );
}

/* ------------------------------------------------------------------ plan -- */

/**
 * What it *would* change, before it changes anything.
 *
 * The step in an agent workflow everybody skips and then wishes they had not:
 * "analyse this, do not modify anything, tell me what you would do." Both of
 * the terminal agents this was measured against treat it as a first-class mode
 * rather than a phrasing, and the reason is that the expensive mistake is not a
 * bad edit — it is a *plausible* edit to the wrong thing, which you only catch
 * after it has landed on four hundred lines.
 *
 * The difference between this and a review is that a plan is executable. A
 * review hands you prose and leaves you to translate it back into a request; a
 * plan hands back the request already written, one per step, so approving a
 * step is a press rather than a paraphrase. That is the whole point: the
 * translation step is where the intent gets lost.
 *
 * Steps come back as JSON because they have to be pressable. Prose that
 * describes three changes cannot be approved one at a time, and "do all of it
 * or none of it" is the thing plan mode exists to avoid.
 */
export interface PlanStep {
  /** A few words, for the row. */
  title: string;
  /** Why it is worth doing — the sentence you decide on. */
  why: string;
  /** Written to be sent back as an instruction, unedited. */
  instruction: string;
}

export async function planChanges(
  current: string,
  goal: string,
  kind: "code" | "doc" | "web",
  lang: string | undefined,
  modelId?: string,
  siblings?: { name: string; content: string }[],
  rules?: string,
): Promise<{ summary: string; steps: PlanStep[] } | null> {
  const what = kind === "doc" ? "document" : `${lang ?? "code"} file`;
  const context = siblings?.length
    ? `\n\nThe other files in the same folder, for reference:\n\n` +
      siblings.map((f) => `--- ${f.name} ---\n${f.content.slice(0, 8_000)}`).join("\n\n")
    : "";

  const out = await complete(
    `Plan how you would change this ${what}. Do NOT write the change.

${goal.trim() ? `WHAT IS WANTED\n${goal.trim()}` : "No goal was given. Plan what you would do to make this file better, and be specific to this file rather than generic."}${houseRules(rules)}

Answer with JSON and nothing else:

{"summary": "one or two sentences on the shape of the work",
 "steps": [{"title": "a few words",
            "why": "one sentence on why this is worth doing",
            "instruction": "the request, written so it can be sent back verbatim as an edit to this file"}]}

Rules:
- Between one and five steps. Fewer, larger steps beat a long list of trivia.
- Each step must stand alone: it will be carried out on its own, in order, and a step that only makes sense after another has silently happened will be carried out wrongly.
- "instruction" is addressed to whoever makes the edit, not to the reader. Imperative, concrete, and about this file: "replace the concat in the loop with push" rather than "improve performance".
- If the file genuinely needs nothing, return an empty steps array. An invented step costs more than an honest nothing.
- No prose outside the JSON.

CURRENT
${current.slice(0, 60_000)}${context}`,
    { modelId, maxTokens: 2048, temperature: 0.2 },
  );
  if (!out) return null;

  const raw = extractJson(out) as { summary?: unknown; steps?: unknown } | null;
  if (!raw || typeof raw !== "object") return null;
  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  /* Filtered rather than trusted. A step with no instruction is a row with a
     button that would send an empty request, which is worse than not offering
     the row: the press appears to work and nothing happens. */
  const clean: PlanStep[] = steps
    .map((s) => s as Record<string, unknown>)
    .filter((s) => s && typeof s.instruction === "string" && s.instruction.trim())
    .map((s) => ({
      title: String(s.title ?? "").trim() || "Change",
      why: String(s.why ?? "").trim(),
      instruction: String(s.instruction).trim(),
    }))
    .slice(0, 5);

  return { summary: String(raw.summary ?? "").trim(), steps: clean };
}

/* ----------------------------------------------------------------- check -- */

/**
 * A second look at a change, before you keep it.
 *
 * "Before you finish, review your own work" is the cheapest quality step there
 * is, and the reason it works is that reviewing is a different task from
 * writing: the same model that confidently produced a diff will, asked to
 * check one, notice the call site it did not update.
 *
 * It is asked about the *diff* and not the file. A reviewer handed the whole
 * result reviews the whole result and reports on code that was already there
 * and was not up for discussion, which buries the one sentence that matters —
 * did this do what was asked, and what else did it touch.
 */
export async function checkChange(
  before: string,
  after: string,
  asked: string,
  lang: string | undefined,
  modelId?: string,
): Promise<string | null> {
  return complete(
    `A change was just made to this ${lang ?? "code"} and has not been accepted yet. Check it.

Answer three things, briefly, in this order:
1. Does it do what was asked? Yes, no, or partly — and if not fully, what is missing.
2. What else did it change that was not asked for?
3. What could it break — call sites, edge cases, behaviour that quietly differs?

Rules:
- Be short. Three or four sentences per point at most, and fewer where there is nothing to say.
- "It does what was asked and I cannot see anything it breaks" is a correct and welcome answer. Do not manufacture a concern to fill the space.
- Do not rewrite anything. This is a check.
- No preamble.

WHAT WAS ASKED FOR
${asked}

BEFORE
${before.slice(0, 30_000)}

AFTER
${after.slice(0, 30_000)}`,
    { modelId, maxTokens: 1024, temperature: 0.2 },
  );
}

/* ------------------------------------------------------------------- fix -- */

/**
 * The request that turns something that actually went wrong into an edit.
 *
 * This is as close as a browser gets to the loop the terminal agents are built
 * around — write, run, read the failure, fix, run again. There is no shell here
 * and there are no tests, but a web canvas genuinely *runs*, and its console
 * genuinely comes back with the file and line already translated out of the
 * assembled page. That is a real failure from a real execution, which is worth
 * more than any amount of reading the code and imagining what it would do.
 *
 * A string rather than its own call, so the fix goes down the same revision
 * path as everything else: it arrives as a diff you keep or discard, it is
 * recorded in history with a name, and it obeys the file's standing rules.
 * A "fix" that bypassed the diff would be the one edit in the app that lands
 * unseen, and it would be the one made in the most hurried moment.
 */
export function fixInstruction(error: string, where?: string): string {
  return `This file was just run and it produced the error below${where ? ` in ${where}` : ""}.

Fix the cause of it. Not the symptom — do not wrap it in a try/catch or guard the
line the error names unless that genuinely is the fix. Work out why the value is
wrong or the call fails, and correct that.

Change as little as possible: the error and what it is caused by, nothing else.
If the cause is in another file and not this one, say so by leaving this file
unchanged rather than inventing a change here that hides it.

THE ERROR
${error.slice(0, 2000)}`;
}

/* --------------------------------------------------------------- pointing -- */

/** What was pointed at in the running page. */
export interface Picked {
  tag: string;
  id: string;
  cls: string;
  text: string;
  /** The element's own markup — the anchor that finds it in the file. */
  html: string;
  /** `body > main > div.card > button.primary`, for saying what is selected. */
  path: string;
}

/** What to call it in one short phrase: “the Start Lesson button”. */
export function nameOf(p: Picked): string {
  const kind =
    p.tag === "a" ? "link" :
    p.tag === "img" ? "image" :
    p.tag === "button" ? "button" :
    p.tag === "input" || p.tag === "textarea" || p.tag === "select" ? "field" :
    ["h1", "h2", "h3", "h4", "h5", "h6"].includes(p.tag) ? "heading" :
    ["p", "li", "span", "label"].includes(p.tag) ? "text" :
    p.tag;
  const label = p.text.trim().split(/\s+/).slice(0, 4).join(" ");
  return label ? `the “${label}” ${kind}` : `this ${kind}`;
}

/**
 * A change aimed at one element of a running page.
 *
 * The point of the whole thing: you can see it, so you should be able to
 * select it and say what to do with it, rather than describing where it is.
 * "Make the blue button roughly in the middle of the dashboard smaller" is a
 * translation, and the translation is where the intent goes missing.
 *
 * The hard part is not knowing *which* element — the picker sends its markup,
 * which is a perfectly good anchor. It is knowing which **file** the change
 * belongs in. "Make this smaller" is the stylesheet, "call it Begin instead"
 * is the markup, and "make it do nothing until the form is valid" is the
 * behaviour. Guessing wrongly means a rewrite of the wrong file and a diff
 * nobody can accept, so the model is asked to name the file it wants and the
 * answer is applied there. Anything it names that is not in the folder is
 * refused rather than created: a change that invents a file is a change that
 * silently does nothing.
 */
export async function reviseElement(
  files: { name: string; content: string }[],
  picked: Picked,
  instruction: string,
  modelId?: string,
  rules?: string,
): Promise<{ file: string; content: string } | null> {
  const folder = files
    .map((f) => `--- ${f.name} ---\n${f.content.slice(0, 20_000)}`)
    .join("\n\n");

  const out = await complete(
    `Someone is looking at this page running, and pointed at one element on it. Change that element as instructed.

THE ELEMENT THEY POINTED AT
Where it sits: ${picked.path}
Its markup:
${picked.html}

WHAT THEY WANT
${instruction}${houseRules(rules)}

Answer with JSON and nothing else:

{"file": "the one file to change", "content": "that file's complete new contents"}

Rules:
- Pick the file the change actually belongs in. Appearance is usually the stylesheet; wording and structure are the markup; behaviour is the script. Choose one — the change will be shown as a diff of that file alone.
- "file" must be one of the names below exactly. Do not invent a file.
- "content" is the COMPLETE file, not a fragment and not a patch.
- Change only what is needed for the element they pointed at. Everything else in that file stays byte for byte as it is.
- If the element has no id or class of its own to target, giving it one in the markup is a reasonable change — but then the file you return is the markup, and the styling is a separate step.
- No prose outside the JSON.

THE FOLDER
${folder}`,
    { modelId, maxTokens: 16_000, temperature: 0.15 },
  );
  if (!out) return null;

  const raw = extractJson(out) as { file?: unknown; content?: unknown } | null;
  if (!raw || typeof raw.file !== "string" || typeof raw.content !== "string") return null;

  const target = files.find((f) => f.name === raw.file);
  if (!target) return null;

  const trailing = /\n$/.test(target.content) ? "\n" : "";
  return { file: target.name, content: raw.content.replace(/\s+$/, "") + trailing };
}

/* --------------------------------------------------------------- project -- */

/** One readable thing in a project: a file of a canvas, or a piece of knowledge. */
export interface Source {
  /** "counter / app.js" or "syllabus.md" — what the answer should call it. */
  name: string;
  text: string;
  /** So an answer can be turned back into somewhere to go. */
  canvasId?: string;
}

/**
 * A question about the whole project rather than about the file you are in.
 *
 * "Where is the subscription system?" is the question you actually have, and
 * until now this app could only be asked about the file already open — which
 * means you had to know the answer to ask the question. A project holds
 * several canvases, each of which may be a folder, plus whatever knowledge was
 * added to it, and the useful thing is to read across all of it at once.
 *
 * It never edits. This is the "explain my project" half of a project, and a
 * feature that sometimes answers and sometimes rewrites four files is one
 * nobody asks anything.
 *
 * Fitted whole files at a time, widest budget first, and what did not fit is
 * *reported* rather than dropped in silence — an answer that says "not in this
 * project" because the file was quietly cut is worse than no answer, because
 * you believe it.
 */
export async function askProject(
  question: string,
  sources: Source[],
  modelId?: string,
  budget = 120_000,
): Promise<{ text: string; dropped: string[] } | null> {
  const kept: Source[] = [];
  const dropped: string[] = [];
  let spent = 0;
  for (const s of sources) {
    const cost = s.text.length + s.name.length + 16;
    if (spent + cost > budget) {
      dropped.push(s.name);
      continue;
    }
    spent += cost;
    kept.push(s);
  }

  const body = kept.map((s) => `--- ${s.name} ---\n${s.text}`).join("\n\n");
  const out = await complete(
    `Answer a question about this project. Everything in it is below.

THE QUESTION
${question}

Rules:
- Name the files. "The subscription check is in billing/checkout.js, and the UI that calls it is in app.js" is the answer; "it is handled in the billing logic" is not.
- Trace it where tracing helps: what calls what, in the order it happens.
- If the answer is not in these files, say so plainly. Do not fill the gap with what such a project usually looks like — a confident guess about somebody's own code is worse than nothing, because it is checkable and they will not check it.${dropped.length ? `\n- Some files were too large to include: ${dropped.join(", ")}. If the answer likely lives in one of those, say which.` : ""}
- Do not rewrite anything. This is a question.
- Markdown, short paragraphs, no preamble.

THE PROJECT
${body}`,
    { modelId, maxTokens: 2048, temperature: 0.2 },
  );
  return out ? { text: out, dropped } : null;
}

/* --------------------------------------------------------------- sources -- */

/**
 * Make something out of what you brought, and say where each claim came from.
 *
 * The instruction is whatever the person asked for — a summary, a plan, a set
 * of lessons, a comparison, a page they can hand to somebody else. The shape
 * is theirs to choose; what is fixed is that the result has to be traceable.
 *
 * It is asked to **quote** rather than to reference, and that is the whole
 * design. A page number is as easy to invent as a sentence and much harder to
 * notice; a quotation can be looked for, and `lib/cite.ts` looks for it. So
 * the guarantee does not rest on the model being honest, only on it being
 * quotable — and where it is not, the reader is told rather than reassured.
 */
export async function makeFromSources(
  instruction: string,
  sources: { name: string; text: string }[],
  modelId?: string,
  perSource = 90_000,
): Promise<string | null> {
  const material = sources
    .map((s) => `--- ${s.name} ---\n${s.text.slice(0, perSource)}`)
    .join("\n\n");

  return complete(
    `Make what is asked for below, out of the material at the end. Nothing else.

WHAT IS WANTED
${instruction}

SAYING WHERE IT CAME FROM
Every claim that comes from the material must carry a citation, written exactly like this:

[[cite: the file's name | a short exact quotation from it]]

- Quote, do not paraphrase. The words between the bar and the closing brackets are checked against the file character by character, and a citation whose words are not in it is shown to the reader as a failure. An approximation is worse than no citation.
- Keep quotations short — one sentence, or the clause that carries the point.
- Cite the thing that supports the claim, not the paragraph it sits near.
- Put the citation immediately after the sentence it supports.
- Do not cite your own connecting sentences, your headings, or anything you worked out yourself rather than read.
- If something worth saying is not in the material, say it and say plainly that it is not from the material. Do not attach a citation to it.

Also:
- Markdown. No preamble about what you are about to do.
- Where the material is unclear or contradicts itself, say so rather than resolving it silently.

THE MATERIAL
${material}`,
    { modelId, maxTokens: 16_000, temperature: 0.3 },
  );
}
