import Dexie, { type Table } from "dexie";
import type { Card, Conversation, Deck, Message, Note, Paper, ContentBlock } from "./types";
import { DEFAULT_MODEL_ID } from "./models";

/**
 * Local-first. IndexedDB is the source of truth, which makes the app instant,
 * usable offline, and private by default. A sync backend can sit behind this
 * interface later; nothing above this file assumes one exists.
 */
class ChatDB extends Dexie {
  conversations!: Table<Conversation, string>;
  messages!: Table<Message, string>;
  notes!: Table<Note, string>;
  decks!: Table<Deck, string>;
  cards!: Table<Card, string>;
  papers!: Table<Paper, string>;

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
  }
}

export const db = new ChatDB();

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export async function createConversation(modelId = DEFAULT_MODEL_ID): Promise<Conversation> {
  const now = Date.now();
  const c: Conversation = {
    id: uid(),
    title: "",
    createdAt: now,
    updatedAt: now,
    pinned: false,
    archived: false,
    modelId,
    leafId: null,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  };
  await db.conversations.add(c);
  return c;
}

export async function addMessage(m: Omit<Message, "id" | "createdAt"> & Partial<Pick<Message, "id" | "createdAt">>) {
  const msg: Message = { id: m.id ?? uid(), createdAt: m.createdAt ?? Date.now(), ...m } as Message;
  await db.messages.add(msg);
  await db.conversations.update(msg.conversationId, { leafId: msg.id, updatedAt: Date.now() });
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

/** Siblings share a parent. Editing or regenerating adds one; nothing is lost. */
export function siblingsOf(all: Message[], m: Message): Message[] {
  return all
    .filter((x) => x.parentId === m.parentId && x.role === m.role)
    .sort((a, b) => a.createdAt - b.createdAt);
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

export async function deleteConversation(id: string) {
  await db.transaction("rw", db.conversations, db.messages, async () => {
    await db.messages.where("conversationId").equals(id).delete();
    await db.conversations.delete(id);
  });
}

export async function deleteAllData() {
  await db.transaction(
    "rw",
    [db.conversations, db.messages, db.notes, db.decks, db.cards, db.papers],
    async () => {
      await db.messages.clear();
      await db.conversations.clear();
      await db.notes.clear();
      await db.decks.clear();
      await db.cards.clear();
      await db.papers.clear();
    },
  );
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
  const now = Date.now();
  const note: Note = {
    id: uid(),
    title: "",
    content: "",
    createdAt: now,
    updatedAt: now,
    pinned: false,
    tags: [],
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

export async function deleteNote(id: string) {
  await db.notes.delete(id);
}

/* ----------------------------------------------------------------- decks -- */

export async function createDeck(title: string, source: Partial<Deck> = {}): Promise<Deck> {
  const deck: Deck = { id: uid(), title, createdAt: Date.now(), ...source };
  await db.decks.add(deck);
  return deck;
}

export async function deleteDeck(id: string) {
  await db.transaction("rw", db.decks, db.cards, async () => {
    await db.cards.where("deckId").equals(id).delete();
    await db.decks.delete(id);
  });
}

/* ---------------------------------------------------------------- papers -- */

export async function createPaper(init: Partial<Paper> = {}): Promise<Paper> {
  const now = Date.now();
  const paper: Paper = {
    id: uid(),
    title: "",
    content: "",
    createdAt: now,
    updatedAt: now,
    format: "report",
    ...init,
  };
  await db.papers.add(paper);
  return paper;
}

export async function deletePaper(id: string) {
  await db.papers.delete(id);
}
