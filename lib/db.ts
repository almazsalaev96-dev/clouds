import Dexie, { type Table } from "dexie";
import type {
  Canvas, CanvasFile, CanvasVersion, ContentBlock, Conversation, Message, Note,
  Deck, Lesson, LessonTurn, Memory, Project, ProjectFile, RatingReason, Source, Style, Turn, TurnOutcome,
} from "./types";
import { DEFAULT_MODEL_ID } from "./models";
import {
  newCard, schedule, dayKey, parseCards, makeReverse,
  type Attempt, type Card, type Rating, type StudyDay,
} from "./study";

/**
 * Local-first. IndexedDB is the source of truth, which makes the app instant,
 * usable offline, and private by default. A sync backend can sit behind this
 * interface later; nothing above this file assumes one exists.
 */
class ChatDB extends Dexie {
  conversations!: Table<Conversation, string>;
  messages!: Table<Message, string>;
  notes!: Table<Note, string>;
  canvases!: Table<Canvas, string>;
  canvasFiles!: Table<CanvasFile, string>;
  canvasVersions!: Table<CanvasVersion, string>;
  projects!: Table<Project, string>;
  projectFiles!: Table<ProjectFile, string>;
  styles!: Table<Style, string>;
  sources!: Table<Source, string>;
  memories!: Table<Memory, string>;
  turns!: Table<Turn, string>;
  decks!: Table<Deck, string>;
  cards!: Table<Card, string>;
  studyDays!: Table<StudyDay, string>;
  lessons!: Table<Lesson, string>;
  lessonTurns!: Table<LessonTurn, string>;
  attempts!: Table<Attempt, string>;

  constructor() {
    super("clouds");
    this.version(1).stores({
      conversations: "id, updatedAt, pinned, archived",
      messages: "id, conversationId, parentId, createdAt",
    });
    // Additive: Dexie migrates in place, so existing conversations survive.
    this.version(2).stores({
      notes: "id, updatedAt, pinned",
      decks: "id, createdAt",
      cards: "id, deckId, due",
      papers: "id, updatedAt",
    });
    /**
     * Version 3 adds practice, and restates the indexes it extends.
     *
     * Dexie reads each version's stores() as a delta: an index you still want
     * but do not restate is a dropped index, and the primary key must match
     * the previous declaration byte for byte. Rows survive either way; the
     * index is rebuilt.
     *
     * Booleans are deliberately not indexed anywhere here. They are not valid
     * IndexedDB keys, so a boolean index silently omits every row — which is
     * why `pinned` and `archived` in version(1) do not do what they look like
     * they do. Those are filtered in JS, and so is `Problem.retired`.
     */
    this.version(3).stores({
      skills: "id, updatedAt, state",
      traps: "id, skillId, due, [skillId+due]",
      problems: "id, skillId, trapId, band, [trapId+band]",
      attempts: "id, skillId, trapId, problemId, createdAt, [trapId+createdAt]",
      decks: "id, createdAt, sourceNoteId",
      cards: "id, deckId, due, [deckId+due]",
    });

    /* Version 4 adds the canvas: a document you and the model both write to,
       and the history that makes handing the pen over safe. */
    this.version(4).stores({
      canvases: "id, updatedAt, kind",
      canvasVersions: "id, canvasId, createdAt, [canvasId+createdAt]",
    });

    /* Version 5 adds projects — a place with instructions and material that
       every chat inside it can see — and custom response styles.

       `conversations` is restated because Dexie reads each version's stores()
       as a delta: the existing indexes have to be named again alongside the
       new `projectId`, or they are dropped. */
    this.version(5).stores({
      conversations: "id, updatedAt, pinned, archived, projectId",
      projects: "id, updatedAt",
      projectFiles: "id, projectId, createdAt, [projectId+createdAt]",
      styles: "id, updatedAt",
    });

    /* Version 6 makes a canvas able to be a folder rather than only a file, so
       the Code section can hold a web page — markup, styling and behaviour are
       three files and a preview that pretends otherwise is a toy. */
    this.version(6).stores({
      canvasFiles: "id, canvasId, [canvasId+order], [canvasId+name]",
    });

    /* Version 7 removes flashcards, papers and practice.
       ---------------------------------------------------------------------
       Three study features in an app whose centre of gravity turned out to be
       chat, projects, code and notes. Five destinations for one activity was
       more sidebar than the activity was getting used.

       `null` is how Dexie drops a store, and dropping it takes its rows with
       it. That is deliberate and it is not reversible from inside the app —
       the code is in git, the rows are not. */
    this.version(7).stores({
      decks: null,
      cards: null,
      papers: null,
      skills: null,
      traps: null,
      problems: null,
      attempts: null,
    });

    /* Version 8 lets a canvas belong to a project.
       ---------------------------------------------------------------------
       The Code section had no idea it was part of anything: a project held
       instructions, knowledge and chats, and a canvas sat outside all of it,
       so the rules you wrote once for the project were the one thing every
       edit to the project's own code could not see.

       Indexed because the project page asks for its canvases by id, and an
       unindexed `where` is a full scan of every canvas in the database on
       every render of that page. */
    this.version(8).stores({
      canvases: "id, updatedAt, kind, projectId",
    });

    /* Version 9 keeps what a page was made from.
       ---------------------------------------------------------------------
       A notebook page could be built from a book and then had no idea the book
       existed — the source lived in memory for as long as you stayed on the
       page. Which makes the notebook a converter rather than a place: it could
       never answer "where did that come from", which is the only question
       worth asking about a page somebody else wrote. */
    this.version(9).stores({
      sources: "id, noteId, addedAt, [noteId+addedAt]",
    });

    /* Version 10 remembers.
       ---------------------------------------------------------------------
       What the person asked to have remembered, one row each, in the order
       they said it. A table rather than a setting because each one is a
       thing to show and delete on its own, and a blob in localStorage was
       how the styles used to be lost. */
    this.version(10).stores({
      memories: "id, createdAt",
    });

    /* Version 11 remembers what it decided, and what came of it.
       ---------------------------------------------------------------------
       Indexed by messageId because an outcome arrives later and out of
       order — a thumbs-down comes minutes after the answer — and by
       [kind+modelId] because that is the question the next decision asks:
       how have answers of this shape from this model been going. */
    this.version(11).stores({
      turns: "id, messageId, at, [kind+modelId]",
    });

    /* Version 12 brings cards back, as one room rather than five.
       ---------------------------------------------------------------------
       Version 7 dropped decks, cards and practice because three study
       features in an app about chat was more sidebar than the activity was
       getting used. The lesson was about the number of doors, not about the
       idea: being asked again, later, at the point you are about to forget
       is the whole of how anybody learns anything, and it is the one thing
       a conversation cannot do — the cards scroll away and that is the end
       of them.

       `due` is indexed because the only question ever asked of this table
       is "what is waiting", and `[deckId+due]` because it is also asked one
       deck at a time. */
    this.version(12).stores({
      decks: "id, updatedAt",
      cards: "id, deckId, due, [deckId+due]",
    });
    /* One row per day studied, for the streak. The cards cannot say this
       on their own — a card keeps only its last answer — so it is written
       down as it happens or it cannot be counted afterwards. */
    this.version(13).stores({
      studyDays: "day",
    });

    /* Documents you work through, and the conversation beside each one. The
       bytes live here rather than in `projectFiles` because a lesson is not
       knowledge attached to a project — it is the thing on screen, and the
       page a person points at cannot be drawn again from an extraction of
       its words. */
    this.version(14).stores({
      lessons: "id, updatedAt",
      lessonTurns: "id, lessonId, at, [lessonId+at]",
    });

    /* What was actually answered, and what was answered *with*.
       ---------------------------------------------------------------------
       A card carries its schedule and nothing else: ask it what went wrong
       and it can only say "twice". The wrong answers themselves are the
       thing — "you wrote meiosis" is a sentence somebody can act on and
       "lapses: 2" is not — so they are written down as they happen, because
       this is the one kind of data that cannot be reconstructed afterwards.

       `topic` is indexed on cards for the same reason it exists: every
       reading worth having is per topic, and a scan of the whole table to
       group by one is the query that gets slow first. The rest of the card
       indexes are restated because Dexie reads each version as a delta and
       an index left out of one is an index dropped. */
    this.version(15).stores({
      cards: "id, deckId, due, topic, [deckId+due]",
      attempts: "id, at, cardId, topic, [topic+at]",
    });
  }
}

export const db = new ChatDB();

/**
 * Ask the browser to keep this.
 *
 * IndexedDB is "best effort" storage by default: under pressure a browser
 * may evict a site's data without asking, and for an app that keeps a
 * year of somebody's notes and every card they have learned that is the
 * one failure that cannot be undone. Persistent storage is the browser's
 * promise not to — granted silently in Chrome for a site that is used,
 * with a prompt in Firefox, and refused nowhere it matters. Asked once,
 * the first time there is something worth keeping, and the answer is
 * remembered so it is never asked twice.
 */
let persistence: Promise<boolean> | null = null;
export function keepForever(): Promise<boolean> {
  if (persistence) return persistence;
  persistence = (async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  })();
  return persistence;
}

/**
 * Without these, the first schema change hard-fails for anyone with a second
 * tab open: the new tab's open() rejects, every live query renders its empty
 * fallback forever, and the app looks like it lost all of the user's work.
 */
/**
 * Whether the database is in trouble, and what kind.
 *
 * `blocked` used to write a line to the console, which is a place nobody is
 * looking when their work has just stopped appearing. `unavailable` was not
 * handled at all: a browser that refuses IndexedDB — a private window, site
 * data switched off — rejects every query, so every live list renders its
 * empty fallback and the app presents itself as brand new and working. A
 * person types into it for an hour and loses the lot on close.
 *
 * Neither is fixable from in here. Both are sayable, which is the whole
 * difference between a bug and a fault the person can route around.
 */
export type StorageTrouble = "blocked" | "unavailable";
let trouble: StorageTrouble | null = null;
const watchers = new Set<() => void>();
const setTrouble = (t: StorageTrouble) => {
  if (trouble === t) return;
  trouble = t;
  watchers.forEach((f) => f());
};
export const storageTrouble = () => trouble;
export const watchStorage = (f: () => void) => {
  watchers.add(f);
  return () => void watchers.delete(f);
};

if (typeof window !== "undefined") {
  db.on("versionchange", () => {
    db.close();
    location.reload();
  });
  db.on("blocked", () => setTrouble("blocked"));
  // Opened eagerly rather than on the first query, so the answer is known
  // before somebody has typed anything they are about to lose.
  db.open().catch(() => setTrouble("unavailable"));
}

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export async function createConversation(
  init: string | Partial<Conversation> = DEFAULT_MODEL_ID,
): Promise<Conversation> {
  void keepForever();
  const now = Date.now();
  const patch = typeof init === "string" ? { modelId: init } : init;
  const c: Conversation = {
    id: uid(),
    title: "",
    createdAt: now,
    updatedAt: now,
    pinned: false,
    archived: false,
    modelId: DEFAULT_MODEL_ID,
    leafId: null,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    ...patch,
  };
  await db.conversations.add(c);
  return c;
}

export async function addMessage(
  m: Omit<Message, "id" | "createdAt"> & Partial<Pick<Message, "id" | "createdAt">>,
  /**
   * Whether this message becomes the conversation's current answer.
   *
   * Comparison runs three columns against one parent, and if each claims the
   * leaf on completion then whichever model happened to finish last silently
   * becomes the answer — including when the user pressed Cancel. Choosing is
   * the point of comparing, so a compared answer is written without claiming
   * anything, and "Keep this one" moves the pointer.
   */
  advanceLeaf = true,
) {
  // Spread first so a caller passing an explicit undefined id cannot overwrite
  // the generated one.
  const msg: Message = { ...m, id: m.id ?? uid(), createdAt: m.createdAt ?? Date.now() } as Message;
  await db.transaction("rw", [db.messages, db.conversations], async () => {
    await db.messages.add(msg);
    await db.conversations.update(msg.conversationId, {
      ...(advanceLeaf ? { leafId: msg.id } : {}),
      updatedAt: Date.now(),
    });
  });
  return msg;
}

/**
 * The tree, walked backwards from the leaf. This is what the UI renders: a
 * single path, with siblings reachable but not shown.
 */
export function pathTo(all: Message[], leafId: string | null): Message[] {
  if (!leafId) return [];
  const byId = new Map(all.map((m) => [m.id, m]));
  const out: Message[] = [];
  let cur = byId.get(leafId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return out;
}

/**
 * Siblings share a parent. Editing or regenerating adds one; nothing is lost.
 *
 * Built as an index rather than answered per message: scanning the thread once
 * for each message on screen is quadratic, and the transcript re-renders on
 * every frame of a stream, which is exactly where that cost would land.
 */
export function siblingIndex(all: Message[]): Map<string, Message[]> {
  const index = new Map<string, Message[]>();
  for (const m of all) {
    const key = `${m.parentId ?? ""}|${m.role}`;
    const list = index.get(key);
    if (list) list.push(m);
    else index.set(key, [m]);
  }
  for (const list of index.values()) list.sort((a, b) => a.createdAt - b.createdAt);
  return index;
}

export function siblingsFrom(index: Map<string, Message[]>, m: Message): Message[] {
  return index.get(`${m.parentId ?? ""}|${m.role}`) ?? [m];
}

/** Following a branch means walking to its newest tip, not just switching one node. */
export function deepestLeaf(all: Message[], fromId: string): string {
  let current = fromId;
  for (;;) {
    const kids = all
      .filter((m) => m.parentId === current)
      .sort((a, b) => b.createdAt - a.createdAt);
    if (!kids.length) return current;
    current = kids[0].id;
  }
}

/**
 * Every delete in this app goes through one of these, and every one of them
 * reads the rows before it removes them and hands back a function that puts
 * them all back — the conversation *and* its messages, the deck *and* its
 * cards, the skill *and* everything it ever recorded about your practice.
 *
 * Returning a restorer rather than taking a confirmation is the whole design:
 * the caller decides how to offer the way back, and cannot accidentally build
 * a delete that has none, because there is no other delete to call.
 */
export async function deleteConversation(id: string): Promise<() => Promise<void>> {
  return db.transaction("rw", db.conversations, db.messages, async () => {
    const conversation = await db.conversations.get(id);
    const messages = await db.messages.where("conversationId").equals(id).toArray();
    await db.messages.where("conversationId").equals(id).delete();
    await db.conversations.delete(id);
    return async () => {
      await db.transaction("rw", db.conversations, db.messages, async () => {
        if (conversation) await db.conversations.put(conversation);
        if (messages.length) await db.messages.bulkPut(messages);
      });
    };
  });
}

/* ----------------------------------------------------------------- study -- */

/**
 * The deck a source already made, if it made one.
 *
 * Not an index: decks are counted in tens, and a scan over tens is cheaper
 * than the schema bump and the migration it would cost to avoid it.
 */
export async function deckForSource(source: string): Promise<Deck | undefined> {
  return (await db.decks.toArray()).find((d) => d.source === source);
}

export async function createDeck(name: string, source?: string): Promise<Deck> {
  void keepForever();
  const now = Date.now();
  const deck: Deck = { id: uid(), name: name.trim().slice(0, 80) || "Untitled", createdAt: now, updatedAt: now, source };
  await db.decks.add(deck);
  return deck;
}

/**
 * Cards into a deck, skipping the ones already in it.
 *
 * Asking a model for twenty cards on a subject twice produces two decks
 * that overlap on the easy half, and a deck that asks you the same thing
 * twice in one session is a deck people stop trusting.
 */
export async function addCards(
  deckId: string,
  drafts: { front: string; back: string; topic?: string; tags?: string[] }[],
  source?: string,
  topic?: string,
): Promise<number> {
  const now = Date.now();
  const existing = new Set(
    (await db.cards.where("deckId").equals(deckId).toArray()).map((c) => c.front.trim().toLowerCase()),
  );
  const fresh = drafts
    .filter((d) => d.front.trim() && d.back.trim())
    .filter((d) => !existing.has(d.front.trim().toLowerCase()))
    .map((d) => newCard({
      id: uid(), deckId, front: d.front.trim(), back: d.back.trim(), now, source,
      /* A topic the draft names beats one passed for the batch: a model
         asked for cards from a chapter can label them finer than the
         chapter can. */
      topic: d.topic?.trim() || topic?.trim() || undefined,
      tags: d.tags?.length ? d.tags : undefined,
    }));
  if (!fresh.length) return 0;
  await db.cards.bulkAdd(fresh);
  await db.decks.update(deckId, { updatedAt: now });
  return fresh.length;
}

export function cardsOf(deckId: string): Promise<Card[]> {
  return db.cards.where("deckId").equals(deckId).toArray();
}

/** An answer, scheduled. The arithmetic is in `lib/study.ts` and is pure. */
export async function answerCard(card: Card, rating: Rating): Promise<Card> {
  const now = Date.now();
  const next = schedule(card, rating, now);
  await db.cards.put(next);
  await db.decks.update(card.deckId, { updatedAt: now });
  await noteStudied(rating, now);
  return next;
}

/**
 * Put a card back the way it was before the last answer.
 *
 * The scheduler is pure, so undo is not a recomputation — it is the previous
 * row, which the session still has in hand. Pressing 2 when you meant 3 buys
 * a card back in ten minutes instead of four days, and without this the only
 * way out is to wait for it and lie the other way.
 *
 * The day's tally is left alone. You did answer it; the streak is not a
 * scoreboard to be corrected, and an undo that silently rewrote history
 * would make the one honest number in the room dishonest.
 */
export async function unanswerCard(previous: Card): Promise<void> {
  await db.cards.put(previous);
  await db.decks.update(previous.deckId, { updatedAt: Date.now() });
}

/* ------------------------------------------------------------- attempts -- */

/** One marked answer, written down. Returns the row so a caller can amend it. */
export async function noteAttempt(a: Omit<Attempt, "id" | "at">): Promise<Attempt> {
  const row: Attempt = { id: uid(), at: Date.now(), ...a };
  await db.attempts.add(row);
  return row;
}

/**
 * The log, newest first, and bounded.
 *
 * Bounded because nothing above this reads more than a month of it and an
 * unbounded read of a year of answering is a stall on opening the room.
 */
export async function attemptsSince(days = 60): Promise<Attempt[]> {
  const since = Date.now() - days * 86_400_000;
  return db.attempts.where("at").above(since).toArray();
}

export async function forgetAttempts(): Promise<() => Promise<void>> {
  const all = await db.attempts.toArray();
  await db.attempts.clear();
  return async () => { if (all.length) await db.attempts.bulkPut(all); };
}

/* -------------------------------------------------------- cards, edited -- */

/** Every card in the store, for the readings that run across decks. */
export function allCards(): Promise<Card[]> {
  return db.cards.toArray();
}

/** Label a card, or a whole deck, with what it is about. */
export async function setTopic(cardIds: string[], topic: string): Promise<void> {
  const t = topic.trim().slice(0, 60);
  await db.transaction("rw", db.cards, async () => {
    for (const id of cardIds) await db.cards.update(id, { topic: t || undefined });
  });
}

/**
 * The other direction of a card, as a real second card.
 *
 * Refused where one already exists, so pressing twice does not make two —
 * and refused for a cloze, which has no other direction.
 */
export async function addReverse(card: Card): Promise<Card | null> {
  const twin = await db.cards.where("deckId").equals(card.deckId).toArray();
  if (twin.some((c) => c.reverseOf === card.id)) return null;
  const made = makeReverse(card, uid(), Date.now());
  if (!made) return null;
  await db.cards.add(made);
  await db.decks.update(card.deckId, { updatedAt: Date.now() });
  return made;
}

/**
 * Take a card out of the queue without destroying it.
 *
 * A leech that is deleted takes its history with it, and the history is the
 * evidence that it was a bad card rather than a hard fact. Parked far enough
 * out that it stops costing a slot, and findable in the deck.
 */
export async function parkCard(card: Card): Promise<() => Promise<void>> {
  const before = { ...card };
  await db.cards.update(card.id, { due: Date.now() + 365 * 86_400_000 });
  return async () => { await db.cards.put(before); };
}

/* ---------------------------------------------------------------- tutor -- */

/**
 * Take a document in to work through.
 *
 * The bytes are kept so a page can be drawn again; the text is extracted
 * once, here, because every turn of the conversation beside it wants to
 * quote the page and re-parsing a book per question would be absurd.
 */
export async function createLesson(init: {
  name: string;
  mimeType: string;
  bytes: Blob;
  text: string;
  pages: number;
}): Promise<Lesson> {
  void keepForever();
  const now = Date.now();
  const lesson: Lesson = { id: uid(), atPage: 1, createdAt: now, updatedAt: now, ...init };
  await db.lessons.put(lesson);
  return lesson;
}

export async function addLessonTurn(turn: Omit<LessonTurn, "id" | "at">): Promise<LessonTurn> {
  const row: LessonTurn = { id: uid(), at: Date.now(), ...turn };
  await db.lessonTurns.put(row);
  await db.lessons.update(turn.lessonId, { updatedAt: row.at });
  return row;
}

/**
 * Returns the way back, like every other delete here.
 *
 * A lesson is the most expensive row in the database to lose by accident: it
 * holds the document itself, not a reference to one, plus every turn of the
 * session spent working through it. Re-uploading the PDF does not bring back
 * what was said about it.
 */
export async function deleteLesson(id: string): Promise<() => Promise<void>> {
  const lesson = await db.lessons.get(id);
  const turns = await db.lessonTurns.where("lessonId").equals(id).toArray();
  await db.transaction("rw", db.lessons, db.lessonTurns, async () => {
    await db.lessonTurns.where("lessonId").equals(id).delete();
    await db.lessons.delete(id);
  });
  return async () => {
    await db.transaction("rw", db.lessons, db.lessonTurns, async () => {
      if (lesson) await db.lessons.put(lesson);
      if (turns.length) await db.lessonTurns.bulkPut(turns);
    });
  };
}

/**
 * The day's row, for the streak.
 *
 * Written by every answer, including one given in practice the night
 * before an exam: practice does not move the schedule, but it is studying,
 * and a streak that ignored the evening somebody worked hardest would be
 * measuring the wrong thing.
 */
export async function noteStudied(rating: Rating, now = Date.now()): Promise<void> {
  const day = dayKey(now);
  const right = rating === "good" || rating === "easy" ? 1 : 0;
  await db.transaction("rw", db.studyDays, async () => {
    const row = await db.studyDays.get(day);
    await db.studyDays.put(
      row ? { ...row, answered: row.answered + 1, right: row.right + right } : { day, answered: 1, right },
    );
  });
}

/** Every day studied, oldest first. */
export function studyDays(): Promise<StudyDay[]> {
  return db.studyDays.orderBy("day").toArray();
}

/**
 * Cards pasted in, in the shapes people already have them in.
 *
 * The other way into a deck, and the one that asks nothing of a model: a
 * list from a textbook's glossary, an export from the tool somebody used
 * before this one, a cloze sentence typed by hand. Returns what was kept
 * and what was skipped, so the room can say both.
 */
export async function importCards(deckId: string, text: string): Promise<{ added: number; skipped: number }> {
  const { cards, skipped } = parseCards(text);
  const added = cards.length ? await addCards(deckId, cards, "pasted") : 0;
  return { added, skipped };
}

/** A card, corrected. The model writes them and some of them are wrong. */
export async function updateCard(id: string, patch: Partial<Card>): Promise<void> {
  await db.cards.update(id, patch);
}

export async function deleteCard(id: string): Promise<() => Promise<void>> {
  const card = await db.cards.get(id);
  await db.cards.delete(id);
  return async () => {
    if (card) await db.cards.put(card);
  };
}

export async function deleteDeck(id: string): Promise<() => Promise<void>> {
  const deck = await db.decks.get(id);
  const cards = await cardsOf(id);
  await db.transaction("rw", db.decks, db.cards, async () => {
    await db.cards.where("deckId").equals(id).delete();
    await db.decks.delete(id);
  });
  return async () => {
    await db.transaction("rw", db.decks, db.cards, async () => {
      if (deck) await db.decks.put(deck);
      if (cards.length) await db.cards.bulkPut(cards);
    });
  };
}

/* ----------------------------------------------------------------- turns -- */

/** Write down what was decided. Returns the row, so the caller can amend it. */
export async function recordTurn(t: Omit<Turn, "id">): Promise<Turn> {
  const row: Turn = { id: uid(), ...t };
  await db.turns.add(row);
  return row;
}

/**
 * What the person did about an answer.
 *
 * Keyed by the answer rather than by the row, because every place that
 * learns something — a thumbs-down, a Tighten, a regenerate, an edit —
 * knows which message it is acting on and has no reason to know anything
 * about the bookkeeping underneath.
 *
 * First word wins. Somebody who rates an answer down and then regenerates it
 * has told us one thing, not two, and counting it twice would make the app
 * think it is twice as bad at this as it is.
 */
export async function markOutcome(
  messageId: string,
  outcome: TurnOutcome,
  reason?: RatingReason,
): Promise<void> {
  const row = await db.turns.where("messageId").equals(messageId).first();
  if (!row || row.outcome) return;
  await db.turns.update(row.id, { outcome, ...(reason ? { reason } : {}) });
}

/**
 * How often lately they have said an answer was wrong in one particular
 * way. Two "too long" in the last couple of dozen answers is somebody
 * telling this app how to write, in the only vocabulary it offers them.
 */
export async function complaints(reason: RatingReason, window = 24): Promise<number> {
  const rows = await db.turns.orderBy("at").reverse().limit(window).toArray();
  return rows.filter((r) => r.reason === reason).length;
}

/** How the last few answers of this shape from this model actually went. */
export async function pastFor(
  kind: string,
  modelId: string,
  window = 12,
): Promise<{ n: number; bad: number }> {
  const rows = await db.turns.where("[kind+modelId]").equals([kind, modelId]).toArray();
  /* The last few, not all of them. A model that was wrong twenty answers ago
     and has been right since is not the model this is about, and an average
     over all time takes months to forgive anything. */
  const recent = rows.sort((a, b) => b.at - a.at).slice(0, window);
  const bad = recent.filter((r) => r.outcome && r.outcome !== "good").length;
  return { n: recent.length, bad };
}

export async function forgetTurns(): Promise<() => Promise<void>> {
  const all = await db.turns.toArray();
  await db.turns.clear();
  return async () => {
    if (all.length) await db.turns.bulkPut(all);
  };
}

/* ---------------------------------------------------------------- memory -- */

/** Everything remembered, oldest first — the order it was said in. */
export function allMemories(): Promise<Memory[]> {
  return db.memories.orderBy("createdAt").toArray();
}

/**
 * Remember one thing. The same sentence twice is one memory, not two: people
 * repeat themselves, and a list that grows with every repetition reads as
 * the app not having listened the first time.
 */
export async function addMemory(text: string, source?: string): Promise<Memory> {
  const clean = text.trim();
  const existing = await db.memories.filter((m) => m.text.toLowerCase() === clean.toLowerCase()).first();
  if (existing) return existing;
  const m: Memory = { id: uid(), text: clean, createdAt: Date.now(), source };
  await db.memories.add(m);
  return m;
}

export async function deleteMemory(id: string): Promise<() => Promise<void>> {
  const m = await db.memories.get(id);
  await db.memories.delete(id);
  return async () => {
    if (m) await db.memories.put(m);
  };
}

export async function forgetAll(): Promise<() => Promise<void>> {
  const all = await db.memories.toArray();
  await db.memories.clear();
  return async () => {
    if (all.length) await db.memories.bulkPut(all);
  };
}

/**
 * Everything, and this time everything.
 *
 * It used to clear three tables and say it had cleared them all — canvases,
 * their files and their whole version history, projects, the knowledge
 * attached to them, and every style you had written all survived a button
 * whose own description read "it genuinely deletes — nothing is kept anywhere
 * else". Someone wiping this before handing over a laptop was leaving their
 * work on it.
 *
 * Enumerated from the live database rather than a list kept by hand, because a
 * hand-kept list is exactly what went wrong: a table added later is a table
 * this forgets, and the failure is silent and the stakes are somebody's
 * privacy.
 */
export async function deleteAllData() {
  const tables = db.tables;
  await db.transaction("rw", tables, async () => {
    for (const t of tables) await t.clear();
  });
}

export function blockText(content: ContentBlock[]): string {
  return content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

export function exportMarkdown(c: Conversation, messages: Message[]): string {
  const head = `# ${c.title || "Conversation"}\n\n_${new Date(c.createdAt).toLocaleString()}_\n`;
  const body = messages
    .map((m) => {
      const who = m.role === "user" ? "You" : m.modelId ?? "Assistant";
      const attachments = m.content
        .filter((b) => b.type !== "text")
        .map((b) => (b.type === "image" ? `> [image: ${b.name ?? "pasted"}]` : `> [file: ${b.name}]`))
        .join("\n");
      return `## ${who}\n\n${attachments ? attachments + "\n\n" : ""}${blockText(m.content)}`;
    })
    .join("\n\n---\n\n");
  return `${head}\n${body}\n`;
}

/** Sidebar grouping. Relative for the recent past, month names beyond that. */
export function groupConversations(list: Conversation[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  const groups = new Map<string, Conversation[]>();

  const push = (k: string, c: Conversation) => {
    const arr = groups.get(k);
    if (arr) arr.push(c);
    else groups.set(k, [c]);
  };

  for (const c of list) {
    const t = c.updatedAt;
    if (t >= startOfToday) push("Today", c);
    else if (t >= startOfToday - day) push("Yesterday", c);
    else if (t >= startOfToday - 7 * day) push("Previous 7 days", c);
    else if (t >= startOfToday - 30 * day) push("Previous 30 days", c);
    else push(new Date(t).toLocaleString(undefined, { month: "long", year: "numeric" }), c);
  }
  return [...groups.entries()];
}

/* ----------------------------------------------------------------- notes -- */

export async function createNote(init: Partial<Note> = {}): Promise<Note> {
  void keepForever();
  const now = Date.now();
  const note: Note = {
    id: uid(),
    title: "",
    content: "",
    createdAt: now,
    updatedAt: now,
    pinned: false,
    ...init,
  };
  await db.notes.add(note);
  return note;
}

/**
 * A title the user did not have to write. The first heading wins, then the
 * first sentence; an untitled note is never left as "Untitled" if the text
 * itself says what it is.
 */
export function deriveTitle(content: string, fallback = "Untitled note"): string {
  const heading = content.match(/^#{1,3}\s+(.+)$/m)?.[1];
  if (heading) return heading.trim().slice(0, 80);
  const firstLine = content
    .split("\n")
    .map((l) => l.replace(/^[>*\-\s#]+/, "").trim())
    .find(Boolean);
  if (!firstLine) return fallback;
  const sentence = firstLine.split(/(?<=[.!?])\s/)[0];
  return sentence.slice(0, 80) || fallback;
}

/**
 * Saving a chat answer into a note.
 *
 * Here rather than in the notebook component, which is where it used to live:
 * it is two database writes and a title, it is called from the message action
 * row in chat, and having it exported from a view meant every chat pulled in
 * the whole notebook — the editor, the lesson maker, the print layout — to
 * reach one function.
 */
export async function saveToNote(text: string, conversationId?: string): Promise<Note> {
  const now = Date.now();
  const note: Note = {
    id: `${now.toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    title: deriveTitle(text, "Saved from chat"),
    content: text,
    createdAt: now,
    updatedAt: now,
    pinned: false,
    sourceConversationId: conversationId,
  };
  await db.notes.add(note);
  return note;
}

/**
 * A page and everything brought here for it.
 *
 * The sources went with it in nobody's mind but the reader's: deleting a page
 * left every `sources` row it owned in the database, keyed to an id that no
 * longer resolves. They are not small and they are not incidental — a source
 * holds the *entire text* of whatever was attached, four hundred thousand
 * characters of somebody's book or contract or medical file, and it survived
 * the only gesture the app offers for getting rid of it. Nothing could reach
 * them afterwards to show them or to delete them; "clear everything" was the
 * one thing that ever would.
 *
 * So they go with the page, and they come back with it, which is what the undo
 * has always claimed to do.
 */
export async function deleteNote(id: string): Promise<() => Promise<void>> {
  return db.transaction("rw", db.notes, db.sources, async () => {
    const note = await db.notes.get(id);
    const sources = await db.sources.where("noteId").equals(id).toArray();
    await db.sources.where("noteId").equals(id).delete();
    await db.notes.delete(id);
    return async () => {
      await db.transaction("rw", db.notes, db.sources, async () => {
        if (note) await db.notes.put(note);
        if (sources.length) await db.sources.bulkPut(sources);
      });
    };
  });
}

/* --------------------------------------------------------------- sources -- */

/** Bring something in for a page to be made from. */
export async function addSource(
  noteId: string,
  init: { name: string; text: string; pages?: number; size?: number },
): Promise<Source> {
  const source: Source = {
    id: uid(),
    noteId,
    name: init.name,
    text: init.text,
    pages: init.pages,
    size: init.size ?? init.text.length,
    addedAt: Date.now(),
  };
  await db.sources.add(source);
  return source;
}

/** Undoable, like everything else that removes something you brought here. */
export async function removeSource(id: string): Promise<() => Promise<void>> {
  const source = await db.sources.get(id);
  await db.sources.delete(id);
  return async () => {
    if (source) await db.sources.put(source);
  };
}

/** Everything a page was made from. */
export function sourcesOf(noteId: string): Promise<Source[]> {
  return db.sources.where("noteId").equals(noteId).sortBy("addedAt");
}

/* ---------------------------------------------------------------- canvas -- */

/** A web canvas: the record, plus the folder that is its actual content. */
export async function createWebCanvas(
  files: { name: string; lang: string; content: string }[],
  init: Partial<Canvas> = {},
): Promise<Canvas> {
  void keepForever();
  const now = Date.now();
  const canvas: Canvas = {
    id: uid(),
    title: "Untitled",
    kind: "web",
    content: "",
    createdAt: now,
    updatedAt: now,
    ...init,
    // A web canvas keeps its text in canvasFiles; a stray `content` here would
    // be a second source of truth nothing reads.
    ...(init.kind ? {} : {}),
  };
  await db.transaction("rw", db.canvases, db.canvasFiles, db.canvasVersions, async () => {
    await db.canvases.add(canvas);
    for (const [i, f] of files.entries()) {
      await db.canvasFiles.add({
        id: uid(),
        canvasId: canvas.id,
        name: f.name,
        lang: f.lang,
        content: f.content,
        order: i,
        createdAt: now,
        updatedAt: now,
      });
      await pushVersion(canvas.id, f.content, "model", "first draft", f.name);
    }
  });
  return canvas;
}

export function filesOfCanvas(canvasId: string): Promise<CanvasFile[]> {
  return db.canvasFiles
    .where("[canvasId+order]")
    .between([canvasId, Dexie.minKey], [canvasId, Dexie.maxKey])
    .toArray();
}

export async function addCanvasFile(
  canvasId: string,
  file: { name: string; lang: string; content?: string },
): Promise<CanvasFile> {
  const now = Date.now();
  const existing = await filesOfCanvas(canvasId);
  const row: CanvasFile = {
    id: uid(),
    canvasId,
    name: uniqueName(file.name, existing.map((f) => f.name)),
    lang: file.lang,
    content: file.content ?? "",
    order: existing.length,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", db.canvasFiles, db.canvases, async () => {
    await db.canvasFiles.add(row);
    await db.canvases.update(canvasId, { updatedAt: now });
  });
  return row;
}

/** "app.js" beside an existing "app.js" becomes "app-2.js". */
function uniqueName(name: string, taken: string[]): string {
  if (!taken.includes(name)) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let n = 2; ; n++) {
    const candidate = `${stem}-${n}${ext}`;
    if (!taken.includes(candidate)) return candidate;
  }
}

/**
 * A file, and the history that was only ever this file's.
 *
 * Versions are keyed by canvas and filename, so a deleted `style.css` left its
 * history behind under that name — and the next `style.css` added to the same
 * canvas inherited it. Pressing "history" on a file you created a minute ago and
 * being offered the contents of a file you deleted last week is not a stale
 * cache, it is the app handing you back something you told it to get rid of. It
 * goes, and it comes back with the undo.
 */
export async function deleteCanvasFile(id: string): Promise<() => Promise<void>> {
  return db.transaction("rw", db.canvasFiles, db.canvasVersions, async () => {
    const row = await db.canvasFiles.get(id);
    const versions = row
      ? await db.canvasVersions
          .where("canvasId").equals(row.canvasId)
          .filter((v) => v.fileName === row.name)
          .toArray()
      : [];
    if (versions.length) await db.canvasVersions.bulkDelete(versions.map((v) => v.id));
    await db.canvasFiles.delete(id);
    return async () => {
      await db.transaction("rw", db.canvasFiles, db.canvasVersions, async () => {
        if (row) await db.canvasFiles.put(row);
        if (versions.length) await db.canvasVersions.bulkPut(versions);
      });
    };
  });
}

export async function createCanvas(init: Partial<Canvas> = {}): Promise<Canvas> {
  void keepForever();
  const now = Date.now();
  const canvas: Canvas = {
    id: uid(),
    title: "Untitled",
    kind: "code",
    lang: "ts",
    content: "",
    createdAt: now,
    updatedAt: now,
    ...init,
  };
  await db.transaction("rw", db.canvases, db.canvasVersions, async () => {
    await db.canvases.add(canvas);
    // The first state is a version like any other, so reverting to "how it
    // arrived" is the same operation as reverting to anything else.
    if (canvas.content) await pushVersion(canvas.id, canvas.content, "model", "first draft");
  });
  return canvas;
}

/**
 * Record a state.
 *
 * Called when a change is *accepted*, not on every keystroke — a history you
 * cannot read is not history. Consecutive identical states collapse, because a
 * revision that changed nothing should not look like one that did.
 */
export async function pushVersion(
  canvasId: string,
  content: string,
  by: CanvasVersion["by"],
  note?: string,
  /** Which file, on a web canvas. History is per file, as it is in an editor. */
  fileName?: string,
): Promise<void> {
  const mine = (await versionsOf(canvasId, fileName))[0];
  if (mine?.content === content) return;
  await db.canvasVersions.add({
    id: uid(),
    canvasId,
    fileName,
    content,
    by,
    note,
    createdAt: Date.now(),
  });
}

/**
 * Newest first. `fileName` narrows to one file's history; omitting it on a
 * single-document canvas gets that document's, because those rows carry no
 * file name at all.
 */
export async function versionsOf(canvasId: string, fileName?: string): Promise<CanvasVersion[]> {
  const all = await db.canvasVersions
    .where("[canvasId+createdAt]")
    .between([canvasId, Dexie.minKey], [canvasId, Dexie.maxKey])
    .reverse()
    .toArray();
  return all.filter((v) => (v.fileName ?? undefined) === fileName);
}

/**
 * Go back to an earlier state — by writing it as a *new* version rather than
 * by deleting the ones after it. Reverting is an edit, and an edit that
 * destroys history is how you lose the thing you were trying to get back to
 * when it turns out you reverted one step too far.
 */
export async function revertCanvas(canvasId: string, versionId: string): Promise<void> {
  const v = await db.canvasVersions.get(versionId);
  if (!v) return;
  await db.transaction("rw", db.canvases, db.canvasFiles, db.canvasVersions, async () => {
    if (v.fileName) {
      const file = (await filesOfCanvas(canvasId)).find((f) => f.name === v.fileName);
      if (file) await db.canvasFiles.update(file.id, { content: v.content, updatedAt: Date.now() });
      await db.canvases.update(canvasId, { updatedAt: Date.now() });
    } else {
      await db.canvases.update(canvasId, { content: v.content, updatedAt: Date.now() });
    }
    await pushVersion(canvasId, v.content, "you", "reverted", v.fileName);
  });
}

export async function deleteCanvas(id: string): Promise<() => Promise<void>> {
  return db.transaction("rw", db.canvases, db.canvasFiles, db.canvasVersions, async () => {
    const canvas = await db.canvases.get(id);
    const files = await db.canvasFiles.where("canvasId").equals(id).toArray();
    const versions = await db.canvasVersions.where("canvasId").equals(id).toArray();
    await db.canvasFiles.where("canvasId").equals(id).delete();
    await db.canvasVersions.where("canvasId").equals(id).delete();
    await db.canvases.delete(id);
    return async () => {
      await db.transaction("rw", db.canvases, db.canvasFiles, db.canvasVersions, async () => {
        if (canvas) await db.canvases.put(canvas);
        if (files.length) await db.canvasFiles.bulkPut(files);
        if (versions.length) await db.canvasVersions.bulkPut(versions);
      });
    };
  });
}

/* -------------------------------------------------------------- projects -- */

export async function createProject(init: Partial<Project> = {}): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: uid(),
    name: "Untitled project",
    description: "",
    instructions: "",
    createdAt: now,
    updatedAt: now,
    ...init,
  };
  await db.projects.add(project);
  return project;
}

export function filesOf(projectId: string): Promise<ProjectFile[]> {
  return db.projectFiles
    .where("[projectId+createdAt]")
    .between([projectId, Dexie.minKey], [projectId, Dexie.maxKey])
    .toArray();
}

export async function addProjectFile(
  projectId: string,
  file: { name: string; mimeType: string; text: string; size: number },
): Promise<ProjectFile> {
  const row: ProjectFile = { id: uid(), projectId, createdAt: Date.now(), ...file };
  await db.transaction("rw", db.projectFiles, db.projects, async () => {
    await db.projectFiles.add(row);
    await db.projects.update(projectId, { updatedAt: Date.now() });
  });
  return row;
}

export async function removeProjectFile(id: string): Promise<() => Promise<void>> {
  const row = await db.projectFiles.get(id);
  await db.projectFiles.delete(id);
  return async () => {
    if (row) await db.projectFiles.put(row);
  };
}

/**
 * Delete a project without deleting its conversations.
 *
 * A project is a folder, and emptying a folder into the bin along with it is
 * how people lose work they meant to keep. The chats survive with no project;
 * the restorer puts them back where they were.
 */
export async function deleteProject(id: string): Promise<() => Promise<void>> {
  return db.transaction("rw", db.projects, db.projectFiles, db.conversations, db.canvases, async () => {
    const project = await db.projects.get(id);
    const files = await db.projectFiles.where("projectId").equals(id).toArray();
    const chatIds = (await db.conversations.where("projectId").equals(id).toArray()).map((c) => c.id);
    /* Canvases are released, not deleted — exactly as chats already were.
       Deleting a project is saying "I am done with this grouping", not "burn
       the work that was in it", and code is the last thing anyone means to
       throw away by tidying a folder. */
    const canvasIds = (await db.canvases.where("projectId").equals(id).toArray()).map((c) => c.id);

    await db.projectFiles.where("projectId").equals(id).delete();
    await db.conversations.where("projectId").equals(id).modify((c) => {
      delete c.projectId;
    });
    await db.canvases.where("projectId").equals(id).modify((c) => {
      delete c.projectId;
    });
    await db.projects.delete(id);

    return async () => {
      await db.transaction("rw", db.projects, db.projectFiles, db.conversations, db.canvases, async () => {
        if (project) await db.projects.put(project);
        if (files.length) await db.projectFiles.bulkPut(files);
        for (const cid of chatIds) await db.conversations.update(cid, { projectId: id });
        for (const cid of canvasIds) await db.canvases.update(cid, { projectId: id });
      });
    };
  });
}

/* ---------------------------------------------------------------- styles -- */

export async function createStyle(init: Partial<Style> = {}): Promise<Style> {
  const now = Date.now();
  const style: Style = {
    id: uid(),
    name: "New style",
    blurb: "",
    instructions: "",
    createdAt: now,
    updatedAt: now,
    ...init,
    // A row can never claim to be a built-in: built-ins are code, and one that
    // could be shadowed by a row would be unfixable from the app.
    builtin: false,
  };
  await db.styles.add(style);
  return style;
}

export async function deleteStyle(id: string): Promise<() => Promise<void>> {
  const row = await db.styles.get(id);
  await db.styles.delete(id);
  return async () => {
    if (row) await db.styles.put(row);
  };
}
