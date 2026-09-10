import Dexie, { type Table } from "dexie";
import type {
  Canvas, CanvasFile, CanvasVersion, ContentBlock, Conversation, Message, Note,
  Project, ProjectFile, Style,
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
  canvases!: Table<Canvas, string>;
  canvasFiles!: Table<CanvasFile, string>;
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

export async function deleteNote(id: string): Promise<() => Promise<void>> {
  const note = await db.notes.get(id);
  await db.notes.delete(id);
  return async () => {
    if (note) await db.notes.put(note);
  };
}

/* ---------------------------------------------------------------- canvas -- */

/** A web canvas: the record, plus the folder that is its actual content. */
export async function createWebCanvas(
  files: { name: string; lang: string; content: string }[],
  init: Partial<Canvas> = {},
): Promise<Canvas> {
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

export async function deleteCanvasFile(id: string): Promise<() => Promise<void>> {
  const row = await db.canvasFiles.get(id);
  await db.canvasFiles.delete(id);
  return async () => {
    if (row) await db.canvasFiles.put(row);
  };
}

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
