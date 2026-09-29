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
  addRoutine,
  allCards,
  attemptsSince,
  createAssistant,
  createDeck,
  createNote,
  createProject,
  db,
  deleteAssistant,
  deleteMemory,
  deleteNote,
  deleteProject,
  deleteRoutine,
  deriveTitle,
  removeProjectFile,
  studyDays,
  uid,
} from "./db";
import { dueNow, streakOf, topicStats, weakestTopic } from "./study";
import { chunk, rank } from "./retrieve";
import { matchLine } from "./find";
import { solve } from "./arith";
import { runCode } from "./sandbox";
import { convert } from "./units";
import { useSettings } from "./store";

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
      name: "list_memories",
      description: "List what has been remembered about the person, with ids. Use when they ask what you know about them, or before forgetting something.",
      schema: { type: "object", properties: {} },
    },
    offered: (ctx) => ctx.memoryOn && !ctx.temporary,
    doing: "Checking what is remembered",
    run: async () => {
      const all = await db.memories.orderBy("createdAt").toArray();
      if (!all.length) return { ok: true, text: "Nothing is remembered about them yet.", summary: "Nothing remembered yet" };
      return { ok: true, text: all.map((m) => `- ${m.text} (id ${m.id})`).join("\n"), summary: `Checked ${plural(all.length, "memory", "memories")}` };
    },
  },
  {
    spec: {
      name: "forget",
      description: "Forget one remembered fact about the person, by its id from list_memories or by words from it. Only when they ask you to forget something or say it is no longer true.",
      schema: { type: "object", properties: { id: { type: "string" }, words: { type: "string", description: "Words from the fact, when there is no id." } } },
    },
    offered: (ctx) => ctx.memoryOn && !ctx.temporary,
    doing: "Forgetting",
    run: async (input) => {
      const id = str(input.id, 80);
      const words = str(input.words, 200).toLowerCase();
      const all = await db.memories.toArray();
      const m = (id && all.find((x) => x.id === id)) || (words ? all.find((x) => x.text.toLowerCase().includes(words)) : undefined);
      if (!m) return fail(id || words ? "No remembered fact matches that. list_memories shows them with ids." : "Say which fact: an id or words from it.");
      await deleteMemory(m.id);
      const summary = `Forgot ${q(m.text)}`;
      return { ok: true, text: summary, summary, undo: async () => { await db.memories.put(m); } };
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
        "List the things built in this app — pages, code and web things made in Studio — newest first, optionally matching a word. " +
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
      return { ok: true, text, summary: `Listed ${plural(top.length, "thing")} made here`, open: { section: "creative", id: top[0].id } };
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
        open: { section: "creative", id: canvas.id },
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
      name: "convert_units",
      description:
        "Convert a quantity between units exactly: length, mass, time, area, volume, speed, energy, power, pressure, data, amount (mol), charge, force, angle, frequency and temperature (°C, °F, K). " +
        "Use for every unit conversion rather than working it out. Write units as they are usually written: km, mph, kPa, °C, cm³, kWh, GiB, eV.",
      schema: {
        type: "object",
        properties: {
          value: { type: "number" },
          from: { type: "string" },
          to: { type: "string" },
          sig: { type: "number", description: "Significant figures in the answer, 4 if not given." },
        },
        required: ["value", "from", "to"],
      },
    },
    doing: "Converting",
    run: async (input) => {
      const value = typeof input.value === "number" ? input.value : Number(str(input.value, 40));
      const sig = typeof input.sig === "number" ? Math.min(12, Math.max(1, Math.round(input.sig))) : 4;
      const r = convert(value, str(input.from, 20), str(input.to, 20), sig);
      if (!r.ok) return fail(r.why);
      return { ok: true, text: `${r.text} (exact value ${r.value})`, summary: r.text };
    },
  },
  {
    spec: {
      name: "run_code",
      description:
        "Run JavaScript in a sandbox and get its console output and returned value back. " +
        "Use it for data work and anything where guessing would be wrong: parse a CSV or JSON the person gave you (pass it as `input`), " +
        "sum and group columns, statistics, dates and durations, unit conversions, checking a formula on real numbers, transforming lists. " +
        "Modern JavaScript, async allowed, no DOM, no network, eight seconds. Print with console.log or `return` the value you want.",
      schema: {
        type: "object",
        properties: {
          code: { type: "string", description: "The JavaScript to run. `input` is in scope as a string." },
          input: { type: "string", description: "Data for the code to read, such as the CSV text the person attached." },
        },
        required: ["code"],
      },
    },
    doing: "Running code",
    run: async (input) => {
      const code = str(input.code, 20_000);
      if (!code) return fail("No code was given.");
      const ran = await runCode(code, str(input.input, 400_000));
      const took = `${ran.ms} ms`;
      if (!ran.ok) return { ok: false, text: `The code failed after ${took}: ${ran.error}${ran.output ? `\n\nOutput before it failed:\n${ran.output}` : ""}`, summary: "The code failed" };
      return { ok: true, text: ran.output ? `Ran in ${took}. Output:\n${ran.output}` : `Ran in ${took} with no output — print with console.log or return a value.`, summary: `Ran code (${took})` };
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
  {
    spec: {
      name: "search_sources",
      description:
        "Search the files and web pages the person added as sources in their notebooks (PDFs, documents, pages) and get the passages that match, with the source each came from. " +
        "Use when they ask about their book, their notes from class, a handout or a paper they uploaded.",
      schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
    doing: "Reading your sources",
    run: async (input) => {
      const query = str(input.query, 200);
      if (!query) return fail("A query is needed.");
      const sources = await db.sources.toArray();
      if (!sources.length) return { ok: true, text: "No sources have been added to any notebook yet.", summary: "No sources yet" };
      /* A book is millions of characters; the first 600,000 of each keeps a search quick and still covers most of a textbook. */
      const chunks = sources.flatMap((src) => chunk(src.name, src.text.slice(0, 600_000)));
      const hits = rank(query, chunks, 6);
      if (!hits.length) return { ok: true, text: `Nothing in the sources matches ${q(query)}.`, summary: `Searched your sources for ${q(query)}: nothing` };
      const text = hits.map((h) => `— From ${q(h.source)}:\n${h.text.trim().slice(0, 900)}`).join("\n\n");
      return { ok: true, text, summary: `Read ${plural(hits.length, "passage")} from your sources for ${q(query)}`, open: { section: "notebook" } };
    },
  },
  {
    spec: {
      name: "read_web_page",
      description:
        "Read a public web page by its address and get its text. Use when the person gives a link, or when a specific page would answer the question. " +
        "It cannot search; it reads one address.",
      schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    },
    doing: "Reading the page",
    run: async (input) => {
      const url = str(input.url, 2_000);
      if (!url) return fail("An address is needed.");
      const res = await fetch("/api/read-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const got = (await res.json().catch(() => null)) as { ok?: boolean; title?: string; text?: string; url?: string; message?: string } | null;
      if (!got?.ok || !got.text) return fail(got?.message ?? "That page could not be read.");
      const cut = got.text.length > 30_000;
      return {
        ok: true,
        text: `# ${got.title}\n${got.url}\n\n${cut ? got.text.slice(0, 30_000) + "\n\n[… the page goes on; this is the first 30,000 characters]" : got.text}`,
        summary: `Read ${q(got.title || url)}`,
      };
    },
  },
  {
    spec: {
      name: "set_exam_date",
      description: "Set the person's next exam, which Study counts down to and plans around. Only when they tell you the date of an exam.",
      schema: {
        type: "object",
        properties: { name: { type: "string", description: "e.g. A-level Biology Paper 1" }, date: { type: "string", description: "YYYY-MM-DD" } },
        required: ["name", "date"],
      },
    },
    offered: (ctx) => !ctx.temporary,
    doing: "Setting the exam date",
    run: async (input) => {
      const name = str(input.name, 80);
      const date = str(input.date, 20);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T09:00`).getTime())) return fail("The date must be YYYY-MM-DD.");
      const before = useSettings.getState().exam;
      useSettings.getState().setExam({ name: name || "Exam", date });
      const summary = `Exam set: ${name || "Exam"} on ${new Date(`${date}T09:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}`;
      return { ok: true, text: `${summary}. Study now counts down to it.`, summary, open: { section: "study" }, undo: async () => { useSettings.getState().setExam(before); } };
    },
  },
  /* ---- the app's own machinery: a schedule, a project, an assistant.
     ChatGPT's scheduled tasks, projects and GPTs are each a form; here they
     are also a sentence in the chat, which is where the wish is spoken. */
  {
    spec: {
      name: "schedule_routine",
      description:
        "Set up a routine: a prompt that runs as a new conversation at a time of day, on the days chosen, whenever the app is open then. " +
        "Use when they ask to be quizzed, reminded or briefed every morning, on weekdays, at a set time. Give the prompt in their words, as an instruction.",
      schema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "What to send when it runs, e.g. 'Quiz me on what is due today'." },
          hour: { type: "integer", minimum: 0, maximum: 23, description: "24-hour clock, local time." },
          minute: { type: "integer", minimum: 0, maximum: 59 },
          days: { type: "string", enum: ["daily", "weekdays", "weekends"], description: "Which days. Default daily." },
        },
        required: ["prompt", "hour"],
      },
    },
    offered: (ctx) => !ctx.temporary,
    doing: "Setting up the routine",
    run: async (input) => {
      const prompt = str(input.prompt, 2_000);
      if (!prompt) return fail("A routine needs the prompt it will send.");
      const hour = Math.round(Number(input.hour));
      const minute = input.minute === undefined ? 0 : Math.round(Number(input.minute));
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) return fail("The hour has to be 0 to 23.");
      if (!Number.isFinite(minute) || minute < 0 || minute > 59) return fail("The minute has to be 0 to 59.");
      const when = str(input.days, 20).toLowerCase();
      const days = when === "weekdays" ? [1, 2, 3, 4, 5] : when === "weekends" ? [0, 6] : [];
      const row = await addRoutine({ prompt, hour, minute, days });
      const clock = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      const onDays = when === "weekdays" ? "on weekdays" : when === "weekends" ? "at weekends" : "every day";
      const summary = `Set a routine for ${clock} ${onDays}`;
      return {
        ok: true,
        text: `${summary}: ${q(prompt)}. It runs the next time the app is open after that time; they can change or stop it under Settings → Routines.`,
        summary,
        open: { section: "settings", id: "routines" },
        undo: async () => { await deleteRoutine(row.id); },
      };
    },
  },
  {
    spec: {
      name: "create_project",
      description:
        "Make a project — a folder of conversations and files that share standing instructions — and put this conversation in it. " +
        "Use when they ask for a project, a folder or a workspace for a piece of work. Instructions are optional and apply to every chat in it.",
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          instructions: { type: "string", description: "Standing instructions for every chat in the project, if they gave any." },
        },
        required: ["name"],
      },
    },
    offered: (ctx) => !ctx.temporary && !ctx.projectId,
    doing: "Making the project",
    run: async (input, ctx) => {
      const name = str(input.name, 80);
      if (!name) return fail("The project needs a name.");
      const project = await createProject({ name, instructions: str(input.instructions, 4_000) });
      await db.conversations.update(ctx.conversationId, { projectId: project.id });
      const summary = `Made the project ${q(name)}`;
      return {
        ok: true,
        text: `${summary} and put this conversation in it. Its instructions apply from the next message.`,
        summary,
        open: { section: "projects", id: project.id },
        undo: async () => { await deleteProject(project.id); },
      };
    },
  },
  {
    spec: {
      name: "create_assistant",
      description:
        "Make an assistant: a named way of answering with its own instructions, reachable afterwards as /its-name in any chat. " +
        "Use when they ask for a tutor, coach, persona or specialist they can come back to. Write the instructions as directions to the assistant.",
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          instructions: { type: "string", description: "How it answers: tone, method, what it always does first." },
        },
        required: ["name", "instructions"],
      },
    },
    offered: (ctx) => !ctx.temporary,
    doing: "Making the assistant",
    run: async (input) => {
      const name = str(input.name, 60);
      const instructions = str(input.instructions, 6_000);
      if (!name) return fail("The assistant needs a name.");
      if (!instructions) return fail("The assistant needs instructions: how it should answer.");
      const row = await createAssistant({ name, instructions });
      const summary = `Made the assistant ${q(name)}`;
      return {
        ok: true,
        text: `${summary}. They can call it with /${row.short} at the start of a message, or choose it from the box's menu.`,
        summary,
        open: { section: "settings", id: "assistants" },
        undo: async () => { await deleteAssistant(row.id); },
      };
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
export const ACTION_AREAS = ["Study", "Notebook", "Sources", "Memory", "Projects", "Studio", "Conversations", "Routines", "Assistants", "Calculator", "Units", "Code", "Clock", "Web pages"] as const;

/**
 * Run one call. Never throws: a tool that fails answers the model with why,
 * which is an answer it can act on, where an exception would end the turn.
 */
export async function runAction(call: ToolCall, ctx: ActionContext): Promise<ActionDone> {
  const tool = TOOLS.find((t) => t.spec.name === call.name);
  if (!tool) return fail(`No tool called ${q(call.name)}.`);
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
