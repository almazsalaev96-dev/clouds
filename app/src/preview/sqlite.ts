/**
 * `node:sqlite`, for the browser build.
 *
 * The routes are written against real SQL, so the preview gives them real SQL rather
 * than a second implementation of the API: SQLite compiled to JavaScript, behind the
 * same `DatabaseSync` surface `server/db.js` opens. Every route, every engine and the
 * whole marking path then run in the page exactly as they run on a server — there is
 * no second version of any of it to drift.
 *
 * It lives in memory. A reload starts a fresh course, which is what a preview is.
 */
interface Stmt {
  bind(values: unknown[]): void
  step(): boolean
  getAsObject(): Record<string, unknown>
  free(): void
}
interface SqlDatabase {
  exec(sql: string): void
  prepare(sql: string): Stmt
}

let SQL: { Database: new () => SqlDatabase } | null = null

/** Load the engine. Must finish before anything imports `server/db.js`. */
export async function openDatabase(): Promise<void> {
  if (SQL) return
  const init = (await import('sql.js/dist/sql-asm.js')).default as (config?: unknown) => Promise<typeof SQL>
  SQL = await init({})
}

export class DatabaseSync {
  #db: SqlDatabase

  constructor(_file?: string) {
    if (!SQL) throw new Error('The preview database was used before it was opened.')
    this.#db = new SQL.Database()
  }

  exec(sql: string): void {
    // WAL and foreign-key pragmas mean nothing to an in-memory build and this engine
    // rejects some of them; the schema they precede is what matters.
    this.#db.exec(sql.replace(/^\s*PRAGMA[^;]*;/gim, ''))
  }

  /**
   * node:sqlite takes positional parameters as arguments and hands back plain
   * objects. sql.js takes an array and steps a cursor. That is the whole difference.
   */
  prepare(sql: string) {
    const rows = (args: unknown[], limit = Infinity): Record<string, unknown>[] => {
      const stmt = this.#db.prepare(sql)
      const out: Record<string, unknown>[] = []
      try {
        stmt.bind(args.map(v => (v === undefined ? null : v)))
        while (out.length < limit && stmt.step()) out.push(stmt.getAsObject())
      } finally {
        stmt.free()
      }
      return out
    }
    return {
      run: (...args: unknown[]) => { rows(args); return { changes: 1, lastInsertRowid: 0 } },
      all: (...args: unknown[]) => rows(args),
      get: (...args: unknown[]) => rows(args, 1)[0],
    }
  }

  close(): void {}
}

export default { DatabaseSync }
