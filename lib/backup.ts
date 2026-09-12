import { db } from "./db";
import { admits } from "./rows";
import { DEFAULT_SETTINGS, useSettings } from "./store";

/**
 * Taking your work with you.
 *
 * The app's promise is that nothing leaves this browser. The unspoken half of
 * that promise was that nothing *survives* it: everything lives in one
 * origin's IndexedDB, and clearing site data, switching machines, or a browser
 * deciding to evict storage under pressure took the lot. Settings said so
 * plainly and offered no remedy, which is a warning rather than an answer.
 *
 * So: one file, everything in it, and a way back in. It is JSON rather than
 * anything cleverer because the point is that it outlives this app — you
 * should be able to open it in a text editor in five years and find your
 * writing, whether or not this still runs.
 *
 * Two deliberate omissions, both about not turning a backup into a liability:
 *
 *  - **API keys are never written.** A backup lands in Downloads, gets synced,
 *    gets emailed to yourself. A key in it is a key on somebody's server. They
 *    are the one thing here that is trivially replaceable and genuinely costly
 *    to leak, so the file says which providers you had configured and not what
 *    the keys were.
 *  - **Nothing is compressed or encoded.** A backup you cannot read is a
 *    backup you cannot check, and a format you have to trust is the opposite
 *    of the point.
 */

/** Bumped only when the shape changes in a way a reader must know about. */
export const BACKUP_VERSION = 1;

/* Every table, named once. Adding one to the database and forgetting it here
   would produce a backup that silently loses a whole kind of thing, so the
   list is asserted against the live database below rather than trusted. */
const TABLES = [
  "conversations",
  "messages",
  "notes",
  "canvases",
  "canvasFiles",
  "canvasVersions",
  "projects",
  "projectFiles",
  "styles",
  "sources",
] as const;

type TableName = (typeof TABLES)[number];

export interface Backup {
  app: "armi";
  version: number;
  exportedAt: number;
  /** Which providers had a key, so a restore can tell you what to re-enter. */
  hadKeysFor: string[];
  settings: Record<string, unknown>;
  data: Record<string, unknown[]>;
}

/** Settings worth carrying, minus anything secret or specific to one machine. */
const SETTING_KEYS = [
  "theme", "density", "modelId", "reviseModelId", "systemPrompt", "styleId",
  "mode", "name", "nameAsked", "sendOnEnter", "showLineNumbers", "wrapCode",
  "params", "favorites", "recentModels",
] as const;

/**
 * Everything the database holds that this file does not name.
 *
 * The list above is kept by hand, and a hand-kept list is precisely what goes
 * wrong: a table added next year is a table a backup silently drops, and you
 * find out when you restore. Asked of the live database instead, so the answer
 * cannot drift from the schema.
 */
export function missingFromBackup(): string[] {
  const named = new Set<string>(TABLES);
  return db.tables.map((t) => t.name).filter((n) => !named.has(n));
}

export async function buildBackup(): Promise<Backup> {
  const data: Record<string, unknown[]> = {};
  for (const name of TABLES) {
    data[name] = await db.table(name).toArray();
  }
  /* Not thrown: a backup missing one table is worth far more than no backup.
     Loud enough to be seen by whoever added the table, quiet enough not to
     stand between somebody and their own writing. */
  const missed = missingFromBackup();
  if (missed.length) {
    console.warn(`Backup does not include: ${missed.join(", ")} — add them to lib/backup.ts`);
  }

  const s = useSettings.getState() as unknown as Record<string, unknown>;
  const DEFAULTS = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
  const settings: Record<string, unknown> = {};
  for (const k of SETTING_KEYS) if (s[k] !== undefined) settings[k] = s[k];

  return {
    app: "armi",
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    hadKeysFor: Object.entries((s.keys ?? {}) as Record<string, string>)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => k),
    settings,
    data,
  };
}

/** How much is in it, for a sentence someone can check before they trust it. */
export function backupCounts(b: Backup): { label: string; n: number }[] {
  const say: [TableName, string, string][] = [
    ["conversations", "conversation", "conversations"],
    ["messages", "message", "messages"],
    ["notes", "page", "pages"],
    ["canvases", "canvas", "canvases"],
    ["projects", "project", "projects"],
    ["styles", "style", "styles"],
    ["sources", "source", "sources"],
  ];
  return say
    .map(([t, one, many]) => {
      const n = (b.data[t] ?? []).length;
      return { n, label: n === 1 ? one : many };
    })
    .filter((x) => x.n > 0);
}

/** The same phrasing, for what a restore actually brought in. */
const HUMAN: Record<string, [string, string]> = {
  conversations: ["conversation", "conversations"],
  messages: ["message", "messages"],
  notes: ["page", "pages"],
  canvases: ["canvas", "canvases"],
  canvasFiles: ["file", "files"],
  canvasVersions: ["version", "versions"],
  projects: ["project", "projects"],
  projectFiles: ["project file", "project files"],
  styles: ["style", "styles"],
  sources: ["source", "sources"],
};

export function say(counts: { label: string; n: number }[]): string {
  const parts = counts.map((c) => `${c.n} ${c.label}`);
  if (parts.length <= 1) return parts[0] ?? "nothing";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export class BackupError extends Error {}

export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("That file is not JSON. Pick the file this app wrote.");
  }
  const b = raw as Partial<Backup>;
  if (!b || b.app !== "armi" || typeof b.version !== "number") {
    throw new BackupError("That is not an Armi backup.");
  }
  if (b.version > BACKUP_VERSION) {
    throw new BackupError(
      `That backup was written by a newer version of Armi (${b.version}). Update before restoring it.`,
    );
  }
  if (!b.data || typeof b.data !== "object") throw new BackupError("That backup has no data in it.");
  return b as Backup;
}

/** Equal enough to say "nobody has touched this". */
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === 0 && b.length === 0;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    return Object.keys(a).length === 0 && Object.keys(b).length === 0;
  }
  return a === b;
}

/** The shape the setting already is — a string for a string, a list for a list. */
function shaped(v: unknown, like: unknown): boolean {
  if (Array.isArray(like)) return Array.isArray(v);
  if (like === null) return v === null || typeof v === "string";
  if (like && typeof like === "object") return Boolean(v) && typeof v === "object" && !Array.isArray(v);
  return typeof v === typeof like;
}

export interface RestoreResult {
  added: number;
  skipped: number;
  /** Named so the message can say what actually arrived. */
  per: { label: string; n: number }[];
}

/**
 * Restore by adding what is missing.
 *
 * Never overwrite. A restore usually happens onto a machine that already has
 * something on it, and the failure everyone fears is the backup quietly
 * winning an argument with work you did since. Rows whose id is already here
 * are left exactly as they are and counted, so the result can say so.
 *
 * Settings are only applied when this browser has none of its own — restoring
 * on a machine you have already set up should not change its theme — and only
 * the settings this file knows the names of.
 *
 * That last part is the difference between reading a file and executing one. A
 * backup is JSON that arrived from somewhere: a colleague, an old laptop, an
 * email attachment, a text editor somebody was curious in. The export side has
 * always filtered to a named list, with a comment explaining that a key in a
 * file in Downloads is a key on somebody's server — and the import side then
 * took `b.settings` entire and merged it into the store, so a file with a
 * `keys` object in it wrote API keys into the browser of whoever opened it, and
 * anything else in it landed in the store unchecked. Same list, both
 * directions, and the value has to be the shape the setting already is.
 */
export async function restoreBackup(b: Backup): Promise<RestoreResult> {
  let added = 0;
  let skipped = 0;
  const per: { label: string; n: number }[] = [];

  for (const name of TABLES) {
    const rows = (b.data[name] ?? []) as { id?: string }[];
    if (!rows.length) continue;
    const table = db.table(name);
    const existing = new Set<string>(
      (await table.toCollection().primaryKeys()).map((k) => String(k)),
    );
    /* `admits` rather than an id check. A backup arrives from Downloads, from
       a sync folder, from a text editor somebody was curious in, and a row
       this app cannot render is a row that takes the whole app down on the
       next open — see `lib/rows.ts` for the one that really did it. */
    const fresh = rows.filter((r) => admits(name, r, existing));
    skipped += rows.length - fresh.length;
    if (fresh.length) {
      // bulkPut rather than bulkAdd: the ids were filtered above, and bulkAdd
      // aborts the whole batch on one duplicate that slipped through a race.
      await table.bulkPut(fresh);
      added += fresh.length;
      per.push({ label: (HUMAN[name] ?? [name, name])[fresh.length === 1 ? 0 : 1], n: fresh.length });
    }
  }

  const s = useSettings.getState() as unknown as Record<string, unknown>;
  const DEFAULTS = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
  /* Untouched means untouched: anything a person can have chosen, not the three
     fields that happened to be checked. Someone who had picked a dark theme and
     never typed their name was having the theme taken off them by a restore
     whose own documentation promised it would not.

     `section` and `lastConversationId` are where you were, not what you chose,
     and `keys` is deliberately never in a backup, so none of the three counts. */
  const untouched = SETTING_KEYS.every((k) => same(s[k], DEFAULTS[k]));
  if (untouched && b.settings && typeof b.settings === "object") {
    const clean: Record<string, unknown> = {};
    for (const k of SETTING_KEYS) {
      const v = (b.settings as Record<string, unknown>)[k];
      // The shape the setting already has, or nothing. A file is not a program.
      if (v !== undefined && shaped(v, DEFAULTS[k])) clean[k] = v;
    }
    if (Object.keys(clean).length) (useSettings.getState() as unknown as { set: (p: unknown) => void }).set(clean);
  }

  return { added, skipped, per };
}

/** A name you can find again: the app, and the day. */
export function backupFilename(at = Date.now()): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `armi-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export function downloadBackup(b: Backup) {
  const blob = new Blob([JSON.stringify(b, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename(b.exportedAt);
  a.click();
  URL.revokeObjectURL(url);
}
