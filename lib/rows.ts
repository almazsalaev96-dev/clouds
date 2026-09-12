/**
 * Whether a row read off a file is a row this app can render.
 *
 * `restoreBackup` used to ask one question — is the id a string — and hand the
 * rest to `bulkPut`. That is fine for a file this app wrote and wrong for every
 * other way a file arrives: a backup lands in Downloads, gets synced, gets
 * truncated by a full disk, gets opened in a text editor by somebody curious.
 * A message whose `content` came back as a string rather than an array of
 * blocks passed that check, went into the database, and then reached
 * `blockText`, which does `content.map(...)`.
 *
 * That throw happens during render, and the thread is reopened on the next load
 * because `lastConversationId` points at it — so one bad row made the app
 * permanently unopenable, with every conversation the person had ever had
 * inside the database they could no longer reach. `CrashNet` is the other half
 * of the answer; this is the half that stops it being planted at all.
 *
 * ## Deliberately shallow, and deliberately its own file
 *
 * It is not a schema validator and must not become one. It checks the fields
 * that are dereferenced *without a guard* somewhere on the render path, which
 * is a far shorter list than "the type" — every field not named here is one the
 * app already handles being absent.
 *
 * And it lives apart from `backup.ts` because that module reaches the database
 * on import. A predicate that decides what is allowed into permanent storage
 * should be testable without one.
 */
export type Row = Record<string, unknown>;

const isBlocks = (v: unknown): boolean =>
  Array.isArray(v) && v.every((b) => b !== null && typeof b === "object");

export const ROW_SHAPE: Record<string, (r: Row) => boolean> = {
  /* The one that actually crashed. `content` is mapped over in `blockText`,
     which is called from the token estimate on every open. */
  messages: (r) =>
    isBlocks(r.content) &&
    (r.role === "user" || r.role === "assistant" || r.role === "system") &&
    typeof r.conversationId === "string",

  /* A title is rendered into the sidebar and the tab; anything but a string or
     nothing at all reaches `.slice` and `.trim`. */
  conversations: (r) => r.title === undefined || typeof r.title === "string",

  /* Both are read as text by the editor and the highlighter. */
  canvasFiles: (r) => typeof r.path === "string" && typeof r.content === "string",
  projectFiles: (r) => typeof r.name === "string",

  /* An orphan source renders under no note and is unreachable, which is not a
     crash but is a row nobody can ever delete. */
  sources: (r) => typeof r.noteId === "string",
};

/**
 * The whole question the restore asks of a row.
 *
 * `known` is the set of ids already in the table: a backup re-imported twice
 * should add nothing the second time rather than overwrite what has happened
 * since.
 */
export function admits(table: string, r: unknown, known: Set<string>): boolean {
  if (!r || typeof r !== "object") return false;
  const row = r as Row;
  if (typeof row.id !== "string" || !row.id) return false;
  if (known.has(row.id)) return false;
  const shape = ROW_SHAPE[table];
  return shape ? shape(row) : true;
}
