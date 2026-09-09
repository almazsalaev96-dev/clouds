import Dexie, { type Table } from "dexie";
import type {
  Attempt, Canvas, CanvasVersion, Card, ContentBlock, Conversation, Deck,
  Message, Note, Paper, Problem, Project, ProjectFile, Skill, Style, Trap,
} from "./types";
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
  skills!: Table<Skill, string>;
  traps!: Table<Trap, string>;
  problems!: Table<Problem, string>;
  attempts!: Table<Attempt, string>;
  canvases!: Table<Canvas, string>;
  canvasVersions!: Table<CanvasVersion, string>;
  projects!: Table<Project, string>;
  projectFiles!: Table<ProjectFile, string>;
  styles!: Table<Style, string>;

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
  }
}

export const db = new ChatDB();

/**
 * Without these, the first schema change hard-fails for anyone with a second
 * tab open: the new tab's open() rejects, every live query renders its empty
 * fallback forever, and the app looks like it lost all of the user's work.
 */
if (typeof window !== "undefined") {
  db.on("versionchange", () => {
    db.close();
    location.reload();
  });
  db.on("blocked", () => {
    console.warn("Close Armi's other tabs to finish updating.");
  });
}

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export async function createConversation(
  init: string | Partial<Conversation> = DEFAULT_MODEL_ID,
): Promise<Conversation> {
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

export async function deleteAllData() {
  await db.transaction(
    "rw",
    [
      db.conversations, db.messages, db.notes, db.decks, db.cards, db.papers,
      db.skills, db.traps, db.problems, db.attempts,
    ],
    async () => {
      await db.messages.clear();
      await db.conversations.clear();
      await db.notes.clear();
      await db.decks.clear();
      await db.cards.clear();
      await db.papers.clear();
      await db.skills.clear();
      await db.traps.clear();
      await db.problems.clear();
      await db.attempts.clear();
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

export async function deleteNote(id: string): Promise<() => Promise<void>> {
  const note = await db.notes.get(id);
  await db.notes.delete(id);
  return async () => {
    if (note) await db.notes.put(note);
  };
}

/* ----------------------------------------------------------------- decks -- */

export async function createDeck(title: string, source: Partial<Deck> = {}): Promise<Deck> {
  const deck: Deck = { id: uid(), title, createdAt: Date.now(), ...source };
  await db.decks.add(deck);
  return deck;
}

export async function deleteDeck(id: string): Promise<() => Promise<void>> {
  return db.transaction("rw", db.decks, db.cards, async () => {
    const deck = await db.decks.get(id);
    // Scheduling state is the expensive part of a deck. Losing it silently
    // means every card comes back due tomorrow as if it were new.
    const cards = await db.cards.where("deckId").equals(id).toArray();
    await db.cards.where("deckId").equals(id).delete();
    await db.decks.delete(id);
    return async () => {
      await db.transaction("rw", db.decks, db.cards, async () => {
        if (deck) await db.decks.put(deck);
        if (cards.length) await db.cards.bulkPut(cards);
      });
    };
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

export async function deletePaper(id: string): Promise<() => Promise<void>> {
  const paper = await db.papers.get(id);
  await db.papers.delete(id);
  return async () => {
    if (paper) await db.papers.put(paper);
  };
}

/* ---------------------------------------------------------------- skills -- */

export async function createSkill(init: Partial<Skill> = {}): Promise<Skill> {
  const now = Date.now();
  const skill: Skill = {
    id: uid(),
    name: "",
    goal: "",
    primer: "",
    band: 1,
    state: "sketching",
    trapCount: 0,
    createdAt: now,
    updatedAt: now,
    ...init,
  };
  await db.skills.add(skill);
  return skill;
}

export async function deleteSkill(id: string): Promise<() => Promise<void>> {
  return db.transaction("rw", [db.skills, db.traps, db.problems, db.attempts], async () => {
    const skill = await db.skills.get(id);
    const traps = await db.traps.where("skillId").equals(id).toArray();
    const problems = await db.problems.where("skillId").equals(id).toArray();
    // Attempts are the only record of how the practice actually went. They are
    // not regenerable from anything.
    const attempts = await db.attempts.where("skillId").equals(id).toArray();
    await db.attempts.where("skillId").equals(id).delete();
    await db.problems.where("skillId").equals(id).delete();
    await db.traps.where("skillId").equals(id).delete();
    await db.skills.delete(id);
    return async () => {
      await db.transaction("rw", [db.skills, db.traps, db.problems, db.attempts], async () => {
        if (skill) await db.skills.put(skill);
        if (traps.length) await db.traps.bulkPut(traps);
        if (problems.length) await db.problems.bulkPut(problems);
        if (attempts.length) await db.attempts.bulkPut(attempts);
      });
    };
  });
}

/* ---------------------------------------------------------------- canvas -- */

export async function createCanvas(init: Partial<Canvas> = {}): Promise<Canvas> {
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
): Promise<void> {
  const last = await db.canvasVersions
    .where("[canvasId+createdAt]")
    .between([canvasId, Dexie.minKey], [canvasId, Dexie.maxKey])
    .last();
  if (last?.content === content) return;
  await db.canvasVersions.add({
    id: uid(),
    canvasId,
    content,
    by,
    note,
    createdAt: Date.now(),
  });
}

export async function versionsOf(canvasId: string): Promise<CanvasVersion[]> {
  return db.canvasVersions
    .where("[canvasId+createdAt]")
    .between([canvasId, Dexie.minKey], [canvasId, Dexie.maxKey])
    .reverse()
    .toArray();
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
  await db.transaction("rw", db.canvases, db.canvasVersions, async () => {
    await db.canvases.update(canvasId, { content: v.content, updatedAt: Date.now() });
    await pushVersion(canvasId, v.content, "you", "reverted");
  });
}

export async function deleteCanvas(id: string): Promise<() => Promise<void>> {
  return db.transaction("rw", db.canvases, db.canvasVersions, async () => {
    const canvas = await db.canvases.get(id);
    const versions = await db.canvasVersions.where("canvasId").equals(id).toArray();
    await db.canvasVersions.where("canvasId").equals(id).delete();
    await db.canvases.delete(id);
    return async () => {
      await db.transaction("rw", db.canvases, db.canvasVersions, async () => {
        if (canvas) await db.canvases.put(canvas);
        if (versions.length) await db.canvasVersions.bulkPut(versions);
      });
    };
  });
}

/** Everything due, across every skill, oldest first. */
export function dueTraps(traps: Trap[], now = Date.now()): Trap[] {
  return traps.filter((t) => t.state !== "held" && t.due <= now).sort((a, b) => a.due - b.due);
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
  return db.transaction("rw", db.projects, db.projectFiles, db.conversations, async () => {
    const project = await db.projects.get(id);
    const files = await db.projectFiles.where("projectId").equals(id).toArray();
    const chatIds = (await db.conversations.where("projectId").equals(id).toArray()).map((c) => c.id);

    await db.projectFiles.where("projectId").equals(id).delete();
    await db.conversations.where("projectId").equals(id).modify((c) => {
      delete c.projectId;
    });
    await db.projects.delete(id);

    return async () => {
      await db.transaction("rw", db.projects, db.projectFiles, db.conversations, async () => {
        if (project) await db.projects.put(project);
        if (files.length) await db.projectFiles.bulkPut(files);
        for (const cid of chatIds) await db.conversations.update(cid, { projectId: id });
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
