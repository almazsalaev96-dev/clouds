/**
 * The rooms, as tools the model can use from any conversation.
 *
 * "Make me cards on this" used to mean: get the answer, press the deck
 * button, wait for a second call, find the deck. Now the model can save the
 * cards itself, in the same breath as the answer — and write a page, keep a
 * memory, put a file in the project, look something up in the notebook or an
 * old conversation, check what is due, do a sum exactly, or ask the time.
 * One list, every room, every company: the tools are described once here and
 * each provider adapter wraps them in its own envelope.
 *
 * Everything runs in the browser, against the same database the rooms use.
 * The model never touches the data; it asks, this file does it, and what it
 * did is written on the answer so the reader can see it, open it and take it
 * back. The provider sees the ask and the reply, which is the same thing it
 * sees of a question — nothing leaves that the person did not put in the
 * conversation, except what a search tool returns, and that goes only to the
 * company already answering.
 *
 * Read-only tools are harmless to offer always; the ones that write are
 * offered only where writing makes sense — no memory in a temporary chat, no
 * project file outside a project.
 */

import type { ToolCall, ToolSpec } from "./types";
import {
  addCards,
  addMemory,
  addProjectFile,
  allCards,
  attemptsSince,
  createDeck,
  createNote,
  db,
  deleteMemory,
  deleteNote,
  deriveTitle,
  removeProjectFile,
  studyDays,
  uid,
} from "./db";
import { dueNow, streakOf, topicStats, weakestTopic } from "./study";
import { chunk, rank } from "./retrieve";
import { matchLine } from "./find";
import { solve } from "./arith";

export interface ActionContext {
  conversationId: string;
  projectId?: string;
  /** No memory is written in a temporary chat, and none read. */
  temporary: boolean;
  memoryOn: boolean;
}

/** What a tool did, for the model (text) and for the reader (the rest). */
export interface ActionDone {
  ok: boolean;
  /** What the model is told. Short, factual, with the ids it may need. */
  text: string;
  /** What the reader is shown on the chip. */
  summary: string;
  open?: { section: string; id?: string };
  undo?: () => Promise<void>;
}

interface Tool {
  spec: ToolSpec;
  /** Whether to offer it here at all. */
  offered?: (ctx: ActionContext) => boolean;
  /** The line shown while it runs: "Saving cards". */
  doing: string;
  run: (input: Record<string, unknown>, ctx: ActionContext) => Promise<ActionDone>;
}

const str = (v: unknown, max = 4_000): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
const fail = (text: string): ActionDone => ({ ok: false, text, summary: text });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const q = (s: string) => `“${s}”`;

/* ------------------------------------------------------------ the tools -- */

const TOOLS: Tool[] = [
  {
    spec: {
      name: "save_cards",
      description:
        "Save flashcards into the person's Study room, into a named deck (made if it does not exist). " +
        "Use when they ask for cards, a deck, or to quiz them later on something. Each card is one question and one answer; " +
        "front is the question, back the answer, topic a short label for grouping. Cards already in the deck are skipped.",
      schema: {
        type: "object",
        properties: {
          deck: { type: "string", description: "Deck name, short — the subject." },
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                front: { type: "string" },
                back: { type: "string" },
                topic: { type: "string" },
              },
              required: ["front", "back"],
            },
          },
        },
        required: ["deck", "cards"],
      },
    },
    doing: "Saving cards",
    run: async (input, ctx) => {
      const name = str(input.deck, 80) || "Cards";
      const drafts = list(input.cards)
        .map((c) => ({ front: str(c.front, 1_000), back: str(c.back, 2_000), topic: str(c.topic, 60) || undefined }))
        .filter((c) => c.front && c.back);
      if (!drafts.length) return fail("No cards were given: each needs a front and a back.");
      const all = await db.decks.toArray();
      const found = all.find((d) => d.name.trim().toLowerCase() === name.toLowerCase());
      const deck = found ?? (await createDeck(name, ctx.conversationId));
      const before = found ? (await db.cards.where("deckId").equals(deck.id).primaryKeys()) : [];
      const added = await addCards(deck.id, drafts, ctx.conversationId);
      const skipped = drafts.length - added;
      const summary = `Saved ${plural(added, "card")} to ${q(deck.name)}${skipped ? ` (${skipped} already there)` : ""}`;
      /* No id in the reply. A tool's answer is read by a model that is about
         to write a sentence with it, and every id handed over came back out
         in the sentence: "Saved 3 cards to “Debounce”. Deck id
         muawfbw8wtrdjnla." An id the model cannot use is an id it should not
         be shown; the two tools that take one (`read_made`) are given them
         by the tool that lists them, and nowhere else. */
      return {
        ok: true,
        text: summary,
        summary,
        open: { section: "study", id: deck.id },
        undo: async () => {
          const keep = new Set(before as string[]);
          const mine = (await db.cards.where("deckId").equals(deck.id).toArray()).filter((c) => !keep.has(c.id));
          await db.cards.bulkDelete(mine.map((c) => c.id));
          if (!found) await db.decks.delete(deck.id);
        },
      };
    },
  },
  {
    spec: {
      name: "study_status",
      description:
        "What the person's Study room looks like right now: decks, cards due, streak, and the topic they get wrong most. " +
        "Use when they ask what to study, what is due, or how they are doing.",
      schema: { type: "object", properties: {} },
    },
    doing: "Checking the study room",
    run: async () => {
      const now = Date.now();
      const [cards, decks, days, attempts] = await Promise.all([allCards(), db.decks.toArray(), studyDays(), attemptsSince(60)]);
      if (!cards.length) return { ok: true, text: "The Study room is empty: no decks, no cards.", summary: "Looked at the study room" };
      const due = dueNow(cards, now).length;
      const streak = streakOf(days, now);
      const weak = weakestTopic(cards, attempts, now);
      const byDeck = decks
        .map((d) => {
          const own = cards.filter((c) => c.deckId === d.id);
          return `- ${d.name}: ${plural(own.length, "card")}, ${dueNow(own, now).length} due`;
        })
        .join("\n");
      const held = (t: { mean: number; tried: number; wrong: number }) =>
        `${Math.round(t.mean * 100)}% likely recalled${t.tried ? `, ${t.wrong} of ${t.tried} answers wrong` : ""}`;
      const topics = topicStats(cards, attempts, now).slice(0, 5).map((t) => `${t.topic} (${held(t)})`);
      const text =
        `${plural(cards.length, "card")} in ${plural(decks.length, "deck")}; ${due} due now; streak ${plural(streak, "day")}.` +
        (weak ? ` Weakest topic: ${weak.topic} (${held(weak)}).` : "") +
        (topics.length ? `\nTopics: ${topics.join(", ")}.` : "") +
        `\n${byDeck}`;
      return { ok: true, text, summary: `Checked the study room: ${due} due`, open: { section: "study" } };
    },
  },
  {
    spec: {
      name: "save_note",
      description:
        "Write a page in the person's Notebook, in Markdown. Use when they ask to save, keep, or write something up as a note or page. " +
        "Give it a clear title and the full content; do not summarise what they asked to keep whole.",
      schema: {
        type: "object",
        properties: { title: { type: "string" }, content: { type: "string", description: "Markdown." } },
        required: ["content"],
      },
    },
    doing: "Writing a page",
    run: async (input, ctx) => {
      const content = str(input.content, 200_000);
      if (!content) return fail("The page needs content.");
      const title = str(input.title, 80) || deriveTitle(content, "Saved from chat");
      const note = await createNote({ title, content, sourceConversationId: ctx.conversationId });
      const summary = `Wrote the page ${q(title)}`;
      return {
        ok: true,
        text: `${summary} in the Notebook.`,
        summary,
        open: { section: "notebook", id: note.id },
        undo: async () => { await deleteNote(note.id); },
      };
    },
  },
  {
    spec: {
      name: "search_notes",
      description:
        "Search the person's Notebook pages for a subject and get the passages that match, with the page each came from. " +
        "Use when they refer to something they wrote or kept, or when their own notes would make the answer theirs.",
      schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
    doing: "Reading the notebook",
    run: async (input) => {
      const query = str(input.query, 200);
      if (!query) return fail("A query is needed.");
      const notes = await db.notes.toArray();
      const chunks = notes.flatMap((n) => chunk(n.title || "Untitled", n.content));
      const hits = rank(query, chunks, 5);
      if (!hits.length) return { ok: true, text: `Nothing in the Notebook matches ${q(query)}.`, summary: `Searched the notebook for ${q(query)}: nothing` };
      const text = hits.map((h) => `— From ${q(h.source)}:\n${h.text.trim().slice(0, 700)}`).join("\n\n");
      return { ok: true, text, summary: `Read ${plural(hits.length, "passage")} from the notebook for ${q(query)}`, open: { section: "notebook" } };
    },
  },
  {
    spec: {
      name: "read_note",
      description:
        "Read one Notebook page in full, by its title (closest match). Use after search_notes when a passage is not enough, or when they name a page.",
      schema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
    },
    doing: "Reading a page",
    run: async (input) => {
      const title = str(input.title, 120).toLowerCase();
      if (!title) return fail("A title is needed.");
      const notes = await db.notes.toArray();
      const note =
        notes.find((n) => n.title.trim().toLowerCase() === title) ??
        notes.find((n) => n.title.toLowerCase().includes(title)) ??
        notes.find((n) => title.includes(n.title.trim().toLowerCase()) && n.title.trim());
      if (!note) return fail(`No page called ${q(str(input.title, 120))}. search_notes finds pages by what is in them.`);
      const body = note.content.trim();
      const cut = body.length > 12_000;
      return {
        ok: true,
        text: `# ${note.title || "Untitled"}\n\n${cut ? body.slice(0, 12_000) + "\n\n[… the page goes on; this is the first 12,000 characters]" : body}`,
        summary: `Read the page ${q(note.title || "Untitled")}`,
        open: { section: "notebook", id: note.id },
      };
    },
  },
  {
    spec: {
      name: "append_note",
      description:
        "Add to the end of an existing Notebook page, by its title (closest match), in Markdown. Use when they ask to add something to a page they have. To start a new page use save_note.",
      schema: { type: "object", properties: { title: { type: "string" }, content: { type: "string", description: "Markdown to add." } }, required: ["title", "content"] },
    },
    doing: "Adding to a page",
    run: async (input) => {
      const title = str(input.title, 120).toLowerCase();
      const content = str(input.content, 100_000);
      if (!title || !content) return fail("A title and something to add are needed.");
      const notes = await db.notes.toArray();
      const note = notes.find((n) => n.title.trim().toLowerCase() === title) ?? notes.find((n) => n.title.toLowerCase().includes(title));
      if (!note) return fail(`No page called ${q(str(input.title, 120))}. Use save_note to make one.`);
      const before = note.content;
      const next = before.replace(/\s+$/, "") + (before.trim() ? "\n\n" : "") + content;
      await db.notes.update(note.id, { content: next, updatedAt: Date.now() });
      const summary = `Added to the page ${q(note.title || "Untitled")}`;
      return {
        ok: true,
        text: `${summary} (${content.length} characters).`,
        summary,
        open: { section: "notebook", id: note.id },
        undo: async () => { await db.notes.update(note.id, { content: before, updatedAt: Date.now() }); },
      };
    },
  },
  {
    spec: {
      name: "search_conversations",
      description:
        "Search the person's earlier conversations in this app for something they discussed before, and get the matching lines with the conversation each was in. " +
        "Use when they say 'we talked about', 'last time', or ask what they decided earlier.",
      schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
    doing: "Looking through past conversations",
    run: async (input, ctx) => {
      const query = str(input.query, 200);
      if (!query) return fail("A query is needed.");
      const convs = new Map((await db.conversations.toArray()).filter((c) => !c.temporary).map((c) => [c.id, c]));
      const recent = await db.messages.orderBy("createdAt").reverse().limit(2_000).toArray();
      const hits: { title: string; when: number; line: string; score: number; id: string }[] = [];
      for (const m of recent) {
        if (m.conversationId === ctx.conversationId) continue;
        const conv = convs.get(m.conversationId);
        if (!conv) continue;
        const text = m.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
        const hit = matchLine(text, query);
        if (hit) hits.push({ title: conv.title, when: m.createdAt, line: hit.line, score: hit.score, id: conv.id });
      }
      hits.sort((a, b) => b.score - a.score || b.when - a.when);
      const top = hits.slice(0, 6);
      if (!top.length) return { ok: true, text: `No earlier conversation mentions ${q(query)}.`, summary: `Searched past conversations for ${q(query)}: nothing` };
      const text = top
        .map((h) => `— In ${q(h.title)} (${new Date(h.when).toISOString().slice(0, 10)}): ${h.line.trim().slice(0, 400)}`)
        .join("\n");
      return { ok: true, text, summary: `Found ${plural(top.length, "line")} in past conversations about ${q(query)}`, open: { section: "chat", id: top[0].id } };
    },
  },
  {
    spec: {
      name: "remember",
      description:
        "Keep one fact about the person for every future conversation — a preference, a situation, a name. " +
        "Only when they ask you to remember something, or state something about themselves that they would clearly want kept. One short sentence, in their words.",
      schema: { type: "object", properties: { fact: { type: "string" } }, required: ["fact"] },
    },
    offered: (ctx) => ctx.memoryOn && !ctx.temporary,
    doing: "Remembering",
    run: async (input, ctx) => {
      const fact = str(input.fact, 300);
      if (!fact) return fail("Nothing to remember.");
      const m = await addMemory(fact, ctx.conversationId);
      const summary = `Remembered ${q(fact)}`;
      return { ok: true, text: `${summary}. It will be in every conversation that is not temporary.`, summary, undo: async () => { await deleteMemory(m.id); } };
    },
  },
  {
    spec: {
      name: "save_to_project",
      description:
        "Add a piece of knowledge to this conversation's project, so every chat in the project has it: a summary, a decision, a reference, a snippet. " +
        "Use when they ask to keep something with the project.",
      schema: {
        type: "object",
        properties: { name: { type: "string", description: "A file name, e.g. decisions.md" }, text: { type: "string" } },
        required: ["name", "text"],
      },
    },
    offered: (ctx) => Boolean(ctx.projectId),
    doing: "Adding to the project",
    run: async (input, ctx) => {
      if (!ctx.projectId) return fail("This conversation is not in a project.");
      const text = str(input.text, 200_000);
      const name = (str(input.name, 80) || "note.md").replace(/[\\/]/g, "-");
      if (!text) return fail("The file needs text.");
      const row = await addProjectFile(ctx.projectId, { name, mimeType: "text/markdown", text, size: text.length });
      const summary = `Added ${q(name)} to the project`;
      return { ok: true, text: `${summary}.`, summary, open: { section: "projects", id: ctx.projectId }, undo: async () => { await removeProjectFile(row.id); } };
    },
  },
  {
    spec: {
      name: "list_made",
      description:
        "List the things built in this app — pages, code and web canvases in the Artifacts room — newest first, optionally matching a word. " +
        "Use when they refer to something they made or built earlier.",
      schema: { type: "object", properties: { query: { type: "string" } } },
    },
    doing: "Looking at what was made",
    run: async (input) => {
      const query = str(input.query, 100).toLowerCase();
      const all = (await db.canvases.orderBy("updatedAt").reverse().limit(200).toArray()).filter(
        (c) => !query || c.title.toLowerCase().includes(query) || (c.content ?? "").toLowerCase().includes(query),
      );
      const top = all.slice(0, 8);
      if (!top.length) return { ok: true, text: query ? `Nothing made here matches ${q(query)}.` : "Nothing has been made here yet.", summary: "Looked at what was made: nothing" };
      const text = top
        .map((c) => `- ${q(c.title || "Untitled")} — ${c.kind}${c.lang ? ` (${c.lang})` : ""}, ${new Date(c.updatedAt).toISOString().slice(0, 10)}, id ${c.id}`)
        .join("\n");
      return { ok: true, text, summary: `Listed ${plural(top.length, "thing")} made here`, open: { section: "code", id: top[0].id } };
    },
  },
  {
    spec: {
      name: "read_made",
      description:
        "Read one thing made in this app in full — a document, a code file or a web canvas's files — by its id from list_made or by its title (closest match). " +
        "Use when they ask about, or want changes to, something they built earlier.",
      schema: { type: "object", properties: { id: { type: "string" }, title: { type: "string" } } },
    },
    doing: "Reading what was made",
    run: async (input) => {
      const id = str(input.id, 40);
      const title = str(input.title, 120).toLowerCase();
      const all = await db.canvases.orderBy("updatedAt").reverse().limit(500).toArray();
      const canvas =
        (id && all.find((c) => c.id === id)) ||
        (title && (all.find((c) => c.title.trim().toLowerCase() === title) ?? all.find((c) => c.title.toLowerCase().includes(title)))) ||
        null;
      if (!canvas) return fail(`Nothing made here matches ${q(id || str(input.title, 120))}. list_made shows what there is.`);
      let body: string;
      if (canvas.kind === "web") {
        const files = await db.canvasFiles.where("canvasId").equals(canvas.id).toArray();
        body = files.map((f) => `--- ${f.name} ---\n${f.content}`).join("\n\n");
      } else {
        body = canvas.content;
      }
      const cut = body.length > 24_000;
      return {
        ok: true,
        text: `${q(canvas.title || "Untitled")} — ${canvas.kind}${canvas.lang ? ` (${canvas.lang})` : ""}\n\n${cut ? body.slice(0, 24_000) + "\n\n[… it goes on; this is the first 24,000 characters]" : body}`,
        summary: `Read ${q(canvas.title || "Untitled")}`,
        open: { section: "code", id: canvas.id },
      };
    },
  },
  {
    spec: {
      name: "calculate",
      description:
        "Do arithmetic exactly, with big integers where needed: + - * / ^ % and parentheses over numbers. " +
        "Use for any sum whose digits matter; never work one out in your head when this is here.",
      schema: { type: "object", properties: { expression: { type: "string", description: "e.g. 948392 * 73" } }, required: ["expression"] },
    },
    doing: "Working it out",
    run: async (input) => {
      const expr = str(input.expression, 200);
      const sum = solve(`= ${expr}`);
      if (!sum) return fail(`Not a sum this calculator does: ${q(expr)}. It takes + - * / ^ % and parentheses over numbers.`);
      const summary = `${expr} = ${sum.text}`;
      return { ok: true, text: `${expr} = ${sum.text}${sum.exact ? " (exact)" : " (rounded)"}`, summary };
    },
  },
  {
    spec: {
      name: "now",
      description: "The person's current date, time, weekday and time zone. Use whenever the answer depends on today or the time.",
      schema: { type: "object", properties: {} },
    },
    doing: "Checking the clock",
    run: async () => {
      const d = new Date();
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const text = `${d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} (${zone}).`;
      return { ok: true, text, summary: "Checked the clock" };
    },
  },
];

/* ------------------------------------------------------------ the api -- */

/** The tools to offer in this conversation. */
export function actionSpecs(ctx: ActionContext): ToolSpec[] {
  return TOOLS.filter((t) => !t.offered || t.offered(ctx)).map((t) => t.spec);
}

/** The line to show while a named tool runs. */
export function doingOf(name: string): string {
  return TOOLS.find((t) => t.spec.name === name)?.doing ?? "Working";
}

/** The rooms this can reach, for the settings line and the docs. */
export const ACTION_AREAS = ["Study", "Notebook", "Memory", "Projects", "Library", "Conversations", "Calculator", "Clock"] as const;

/**
 * Run one call. Never throws: a tool that fails answers the model with why,
 * which is an answer it can act on, where an exception would end the turn.
 */
export async function runAction(call: ToolCall, ctx: ActionContext): Promise<ActionDone> {
  const tool = TOOLS.find((t) => t.spec.name === call.name);
  if (!tool) return fail(`No tool called ${q(call.name)}.`);
  if (tool.offered && !tool.offered(ctx)) return fail(`${q(call.name)} is not available in this conversation.`);
  if (tool.offered && !tool.offered(ctx)) return fail(`${q(call.name)} is not available in this conversation.`);
  try {
    return await tool.run(call.input ?? {}, ctx);
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    return fail(`${q(call.name)} failed: ${why.slice(0, 200)}`);
  }
}

/* Undo lives in memory: the closures are this session's, and a chip on a
   message from last week has nothing to take back that a person could
   still want taken back the same way. */
const UNDO = new Map<string, () => Promise<void>>();

export function keepUndo(actionId: string, undo: (() => Promise<void>) | undefined): void {
  if (undo) UNDO.set(actionId, undo);
}
export function canUndo(actionId: string): boolean {
  return UNDO.has(actionId);
}
export async function undoAction(actionId: string): Promise<boolean> {
  const f = UNDO.get(actionId);
  if (!f) return false;
  UNDO.delete(actionId);
  await f();
  return true;
}

/** A fresh id for an action record. */
export const actionId = () => uid();

export { actionsSection } from "./actions.text";
