import { db } from "./db";
import { useSettings } from "./store";

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
 * on a machine you have already set up should not change its theme.
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
    const fresh = rows.filter((r) => r && typeof r.id === "string" && !existing.has(r.id));
    skipped += rows.length - fresh.length;
    if (fresh.length) {
      // bulkPut rather than bulkAdd: the ids were filtered above, and bulkAdd
      // aborts the whole batch on one duplicate that slipped through a race.
      await table.bulkPut(fresh);
      added += fresh.length;
      per.push({ label: (HUMAN[name] ?? [name, name])[fresh.length === 1 ? 0 : 1], n: fresh.length });
    }
  }

  const s = useSettings.getState();
  const untouched = !s.name && !s.systemPrompt && s.recentModels.length === 0;
  if (untouched && b.settings) {
    s.set(b.settings as never);
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
