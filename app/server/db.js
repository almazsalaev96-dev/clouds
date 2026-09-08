// Storage for Margin. node:sqlite (built in) — no native build step, real SQL.
// Entities follow §11.2: Course, Item, MarkScheme, Attempt, Turn, Mark, LearnerState, Card, Plan.
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { SCHEMA } from './schema.js'

const FILE = process.env.MARGIN_DB || 'margin.db'
export const db = new DatabaseSync(FILE)

db.exec(SCHEMA)

export const now = () => new Date().toISOString()
export const uid = (prefix = '') => (prefix ? prefix + '_' : '') + randomUUID().slice(0, 12)

/** Run a statement with named or positional params. */
export const run = (sql, ...args) => db.prepare(sql).run(...args)
export const all = (sql, ...args) => db.prepare(sql).all(...args)
export const get = (sql, ...args) => db.prepare(sql).get(...args)

export function logEvent(kind, data, userId = null, courseId = null) {
  run('INSERT INTO events (id,user_id,course_id,kind,data,created_at) VALUES (?,?,?,?,?,?)',
    uid('ev'), userId, courseId, kind, JSON.stringify(data), now())
}
