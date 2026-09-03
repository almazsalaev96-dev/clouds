/**
 * Data layer (§30).
 *
 * The security property that matters here: `userId` is a *parameter of the
 * interface*, not a column that handlers are trusted to filter on. A caller
 * cannot express "read every user's documents" — the type system does not
 * offer that shape. Cross-tenant leakage therefore requires changing this
 * file, not forgetting a WHERE clause in a handler.
 *
 * The implementation is an in-memory map with optional JSON persistence.
 * It is deliberately swappable: `Store` is an interface, and moving to
 * Postgres or SQLite means writing one adapter, not touching callers.
 */

import { randomUUID } from "node:crypto";
import type {
  Annotation,
  Artifact,
  Block,
  Concept,
  Conversation,
  Document,
  Edge,
  Entity,
  Id,
  LearningEvent,
  Memory,
  Message,
  Mistake,
  Project,
  Task,
  User,
  Workspace,
} from "../types/index.ts";

export const newId = (): Id => randomUUID();

export const now = (): number => Date.now();

/** Fields the store fills in, so callers never invent timestamps or ids. */
export type New<T extends Entity> = Omit<T, "id" | "createdAt" | "updatedAt">;

export interface Query<T> {
  /** Exact-match filter on any subset of fields. */
  where?: Partial<T>;
  /** Predicate applied after `where`, for anything structural. */
  filter?: (row: T) => boolean;
  sort?: (a: T, b: T) => number;
  limit?: number;
}

export interface Collection<T extends Entity> {
  insert(userId: Id, row: New<T>): T;
  /** Returns undefined rather than throwing; absence is normal, not exceptional. */
  get(userId: Id, id: Id): T | undefined;
  update(userId: Id, id: Id, patch: Partial<New<T>>): T | undefined;
  delete(userId: Id, id: Id): boolean;
  list(userId: Id, query?: Query<T>): T[];
  count(userId: Id, query?: Query<T>): number;
  /** Removes every row belonging to a user. Used by account deletion (§34). */
  deleteAllForUser(userId: Id): number;
}

class MemoryCollection<T extends Entity> implements Collection<T> {
  /** userId → (id → row). Partitioning by user makes leakage structurally hard. */
  private byUser = new Map<Id, Map<Id, T>>();

  private onChange: () => void;

  constructor(onChange: () => void) {
    this.onChange = onChange;
  }

  private partition(userId: Id): Map<Id, T> {
    let p = this.byUser.get(userId);
    if (!p) {
      p = new Map();
      this.byUser.set(userId, p);
    }
    return p;
  }

  insert(userId: Id, row: New<T>): T {
    const ts = now();
    const full = { ...row, id: newId(), userId, createdAt: ts, updatedAt: ts } as unknown as T;
    this.partition(userId).set(full.id, full);
    this.onChange();
    return full;
  }

  get(userId: Id, id: Id): T | undefined {
    return this.partition(userId).get(id);
  }

  update(userId: Id, id: Id, patch: Partial<New<T>>): T | undefined {
    const p = this.partition(userId);
    const existing = p.get(id);
    if (!existing) return undefined;
    // id, userId and createdAt are not patchable by construction.
    const next = { ...existing, ...patch, id: existing.id, userId, createdAt: existing.createdAt, updatedAt: now() } as T;
    p.set(id, next);
    this.onChange();
    return next;
  }

  delete(userId: Id, id: Id): boolean {
    const removed = this.partition(userId).delete(id);
    if (removed) this.onChange();
    return removed;
  }

  list(userId: Id, query: Query<T> = {}): T[] {
    let rows = [...this.partition(userId).values()];
    if (query.where) {
      const entries = Object.entries(query.where) as Array<[keyof T, unknown]>;
      rows = rows.filter((row) => entries.every(([k, v]) => row[k] === v));
    }
    if (query.filter) rows = rows.filter(query.filter);
    if (query.sort) rows.sort(query.sort);
    if (query.limit !== undefined) rows = rows.slice(0, query.limit);
    return rows;
  }

  count(userId: Id, query: Query<T> = {}): number {
    return this.list(userId, { ...query, limit: undefined }).length;
  }

  deleteAllForUser(userId: Id): number {
    const n = this.partition(userId).size;
    this.byUser.delete(userId);
    if (n > 0) this.onChange();
    return n;
  }

  /**
   * Inserts with a caller-supplied id. Used only by `createUser`, where the
   * row's id must equal the userId that scopes it — otherwise a lookup of
   * "this user's own record" cannot be expressed.
   */
  insertWithId(userId: Id, id: Id, row: New<T>): T {
    const ts = now();
    const full = { ...row, id, userId, createdAt: ts, updatedAt: ts } as unknown as T;
    this.partition(userId).set(id, full);
    this.onChange();
    return full;
  }

  /** Serialisation hooks, used only by the persistence layer. */
  dump(): Record<Id, T[]> {
    const out: Record<Id, T[]> = {};
    for (const [userId, rows] of this.byUser) out[userId] = [...rows.values()];
    return out;
  }

  load(data: Record<Id, T[]>): void {
    this.byUser = new Map(
      Object.entries(data).map(([userId, rows]) => [userId, new Map(rows.map((r) => [r.id, r]))]),
    );
  }
}

export interface Store {
  users: Collection<User>;
  workspaces: Collection<Workspace>;
  projects: Collection<Project>;
  documents: Collection<Document>;
  blocks: Collection<Block>;
  annotations: Collection<Annotation>;
  conversations: Collection<Conversation>;
  messages: Collection<Message>;
  artifacts: Collection<Artifact>;
  concepts: Collection<Concept>;
  learningEvents: Collection<LearningEvent>;
  mistakes: Collection<Mistake>;
  memories: Collection<Memory>;
  tasks: Collection<Task>;
  edges: Collection<Edge>;
  /**
   * Creates a user whose row id *is* its userId, so `users.get(id, id)`
   * resolves. Every other entity gets a generated id via `insert`.
   */
  createUser(input: { displayName: string; memoryEnabled?: boolean }): User;
  /** §34: complete deletion, verified by test. */
  deleteUser(userId: Id): void;
  snapshot(): string;
  restore(json: string): void;
}

const COLLECTION_NAMES = [
  "users", "workspaces", "projects", "documents", "blocks", "annotations",
  "conversations", "messages", "artifacts", "concepts", "learningEvents",
  "mistakes", "memories", "tasks", "edges",
] as const;

export function createStore(opts: { onChange?: () => void } = {}): Store {
  const notify = opts.onChange ?? (() => {});
  const collections = Object.fromEntries(
    COLLECTION_NAMES.map((name) => [name, new MemoryCollection<never>(notify)]),
  ) as unknown as Record<(typeof COLLECTION_NAMES)[number], MemoryCollection<Entity>>;

  return {
    ...(collections as unknown as Omit<Store, "deleteUser" | "snapshot" | "restore">),

    createUser(input: { displayName: string; memoryEnabled?: boolean }): User {
      const id = newId();
      return (collections.users as unknown as MemoryCollection<User>).insertWithId(id, id, {
        displayName: input.displayName,
        memoryEnabled: input.memoryEnabled ?? true,
      } as unknown as New<User>);
    },

    deleteUser(userId: Id) {
      for (const name of COLLECTION_NAMES) collections[name].deleteAllForUser(userId);
      notify();
    },

    snapshot(): string {
      const out: Record<string, unknown> = { version: 1 };
      for (const name of COLLECTION_NAMES) out[name] = collections[name].dump();
      return JSON.stringify(out);
    },

    restore(json: string) {
      const data = JSON.parse(json) as Record<string, Record<Id, Entity[]>>;
      for (const name of COLLECTION_NAMES) {
        if (data[name]) collections[name].load(data[name]);
      }
    },
  };
}
