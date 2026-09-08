/**
 * Conversations: the list of threads to reopen, and one thread in full.
 *
 * The list is derived from `turns` — a conversation exists because something was said
 * in it, not because a row was written anywhere. The `conversations` table carries a
 * title and nothing else, joined in where the student set one, so a thread nobody
 * renamed still appears with a title read off its opening line.
 */
import { all, get, run, now, logEvent } from '../db.js'
import {
  USER, jsonOk, readBody, str, mustCourse,
} from './courses.js'
import { turnView, publicItem, artefactsFor } from './session.js'

const DEFAULT_LIMIT = 30
const MAX_TITLE = 120
/** A sidebar column is one line wide; these are the characters it has to spend. */
const TITLE_CHARS = 48
const PREVIEW_CHARS = 80
const UNTITLED = 'New chat'

/**
 * One row per session, counted and dated from the turns themselves. The join is LEFT
 * so that a conversation with no stored title is still a row; the title arrives as
 * null and is derived below.
 */
const ROWS = `SELECT t.session_id AS id, c.title AS title, COUNT(*) AS n,
       MIN(t.created_at) AS started_at, MAX(t.created_at) AS last_at
  FROM turns t
  LEFT JOIN conversations c ON c.id = t.session_id AND c.user_id = ?`

export default function register(router) {
  /** Recent conversations, newest first — the sidebar list. */
  router.get('/api/conversations', ({ res, query }) => {
    const course = query.get('courseId') ? mustCourse(query.get('courseId')) : null
    const limit = clampInt(query.get('limit') ?? DEFAULT_LIMIT, 1, 100)
    const rows = all(
      `${ROWS}
        ${course ? 'WHERE t.course_id = ?' : ''}
        GROUP BY t.session_id
        ORDER BY last_at DESC, MAX(t.rowid) DESC
        LIMIT ?`,
      USER, ...(course ? [course.id] : []), limit)
    return jsonOk(res, rows.map(conversationView))
  })

  /** One conversation, with its transcript in the shape `/api/session/:sessionId` returns. */
  router.get('/api/conversations/:id', ({ res, params }) => {
    const row = mustConversation(params.id)
    const turns = all('SELECT * FROM turns WHERE session_id = ? ORDER BY created_at, rowid', row.id)
    const last = turns[turns.length - 1]
    const item = last.item_id ? get('SELECT * FROM items WHERE id = ?', last.item_id) : null
    const made = artefactsFor(row.id)
    return jsonOk(res, {
      ...row,
      sessionId: row.id,
      item: item ? publicItem(item) : null,
      // The transcript takes the name `turns` from the row's count of them, which a
      // client that wants the count still has as the length of this list.
      turns: turns.map(t => turnView(t, made.get(t.id))),
    })
  })

  /** Rename a conversation. The title is the only thing this table is for. */
  router.patch('/api/conversations/:id', async ({ req, res, params }) => {
    const row = mustConversation(params.id)
    const body = await readBody(req)
    const title = str(body.title)
    if (!title) throw Object.assign(new Error('Give the conversation a title.'), { status: 400 })
    if (title.length > MAX_TITLE) {
      throw Object.assign(new Error(`That title is ${title.length} characters. Keep it to ${MAX_TITLE}.`), { status: 400 })
    }
    const at = now()
    const stored = get('SELECT * FROM conversations WHERE id = ? AND user_id = ?', row.id, USER)
    if (stored) run('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', title, at, row.id)
    else {
      run('INSERT INTO conversations (id,user_id,course_id,title,created_at,updated_at) VALUES (?,?,?,?,?,?)',
        row.id, USER, row.courseId, title, at, at)
    }
    logEvent('conversation.renamed', { sessionId: row.id, title }, USER, row.courseId)
    return jsonOk(res, { ...row, title })
  })

  /**
   * Delete a conversation and everything said in it. The reply names the count,
   * because a student is entitled to know how much of their own writing just went.
   */
  router.del('/api/conversations/:id', ({ res, params }) => {
    const row = mustConversation(params.id)
    run('DELETE FROM artefacts WHERE session_id = ?', row.id)
    run('DELETE FROM turns WHERE session_id = ?', row.id)
    run('DELETE FROM conversations WHERE id = ? AND user_id = ?', row.id, USER)
    logEvent('conversation.deleted', { sessionId: row.id, turns: row.turns }, USER, row.courseId)
    return jsonOk(res, {
      id: row.id,
      title: row.title,
      turns: row.turns,
      line: `Deleted "${row.title}" and the ${row.turns} turn${row.turns === 1 ? '' : 's'} in it. That cannot be undone.`,
    })
  })
}

/* --------------------------------------------------------------------- shapes */

/** The sidebar row: what a conversation is called, when it last moved, and its tail. */
function conversationView(row) {
  const last = get('SELECT * FROM turns WHERE session_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1', row.id)
  const opening = get(
    "SELECT body FROM turns WHERE session_id = ? AND role = 'student' ORDER BY created_at, rowid LIMIT 1", row.id)
  return {
    id: row.id,
    title: str(row.title) || titleFrom(opening?.body),
    // Read off the last turn, as `/api/session/:sessionId` reads them: a conversation
    // is on whatever course and question it has most recently been on.
    courseId: last?.course_id || null,
    itemId: last?.item_id || null,
    turns: Number(row.n) || 0,
    lastAt: row.last_at,
    startedAt: row.started_at,
    preview: previewFrom(last?.body),
  }
}

function mustConversation(id) {
  const row = get(`${ROWS} WHERE t.session_id = ? GROUP BY t.session_id`, USER, String(id))
  if (!row) {
    throw Object.assign(new Error(`No conversation ${id}. Pick one from your recent conversations.`), { status: 404 })
  }
  return conversationView(row)
}

/* --------------------------------------------------------------------- pieces */

/**
 * A title read off the student's opening line. Cut on a word so no title ends
 * mid-word, stripped of the punctuation the cut leaves dangling, and started upright
 * because a sidebar of lower-case fragments reads as a list of scraps.
 */
function titleFrom(body) {
  const cut = cutOnWord(oneLine(body), TITLE_CHARS).replace(/[\s\p{P}]+$/u, '')
  return cut ? cut[0].toUpperCase() + cut.slice(1) : UNTITLED
}

/** The opening of the last thing said, so the row shows where the thread got to. */
function previewFrom(body) {
  const line = oneLine(body)
  const cut = cutOnWord(line, PREVIEW_CHARS)
  // The ellipsis is not decoration: without it a cut turn reads as a finished one.
  return cut.length < line.length ? `${cut}…` : cut
}

const oneLine = body => String(body ?? '').replace(/\s+/g, ' ').trim()

function cutOnWord(text, max) {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  // A first word longer than the whole budget has no word boundary to cut on.
  return space > 0 ? cut.slice(0, space) : cut
}

function clampInt(v, lo, hi) {
  const n = Number(v)
  if (!Number.isFinite(n)) return hi
  return Math.min(hi, Math.max(lo, Math.round(n)))
}
