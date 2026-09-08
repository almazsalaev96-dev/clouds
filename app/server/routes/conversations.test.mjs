/**
 * The conversation list is what a student reopens their work from, so what it
 * claims has to hold: the order, the name on each row, and that a delete really
 * takes the writing with it.
 *
 *   node --test server/
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Before anything opens the database: db.js reads MARGIN_DB at import time, and this
// suite writes turns and deletes them, which is not a thing to do to margin.db.
process.env.MARGIN_DB = join(mkdtempSync(join(tmpdir(), 'margin-conversations-')), 'test.db')

const { all, get, run, uid } = await import('../db.js')
const { createRouter, dispatch } = await import('../http.js')
const { seedIfEmpty } = await import('../packs/seed.js')
const { USER } = await import('./courses.js')
const { default: registerConversations } = await import('./conversations.js')

seedIfEmpty()
const COURSE = get('SELECT * FROM courses WHERE user_id = ? ORDER BY created_at LIMIT 1', USER)

const router = createRouter()
registerConversations(router)

/** Turns a minute apart, so recency is a fact about the data and not about the clock. */
let clock = Date.parse('2026-01-01T09:00:00.000Z')
const tick = () => new Date((clock += 60_000)).toISOString()

function addTurn(sessionId, role, body) {
  run('INSERT INTO turns (id,session_id,course_id,item_id,role,body,rung,intent,handback,gate,lint,model,cost,ttft_ms,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    uid('t'), sessionId, COURSE.id, null, role, body,
    role === 'tutor' ? 2 : null, 'learn', null, null, null,
    role === 'tutor' ? 'mock' : null, 0, 0, tick())
}

/** Drive a route the way the server does, through `dispatch`. */
async function call(method, path, body) {
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body))
  const req = {
    method,
    url: path,
    async *[Symbol.asyncIterator]() { if (payload) yield payload },
  }
  let status = 0
  let text = ''
  const res = {
    headersSent: false,
    writeHead(code) { status = code; this.headersSent = true; return this },
    end(chunk) { if (chunk) text += chunk },
  }
  await dispatch(router, req, res, () => { status = 404; text = '{"error":"no route"}' })
  return { status, body: JSON.parse(text || '{}') }
}

test('conversations come back most recent first', async () => {
  addTurn('s_first', 'student', 'What does ceteris paribus mean?')
  addTurn('s_second', 'student', 'How do I evaluate a monopoly?')
  addTurn('s_third', 'student', 'Why does the AD curve slope down?')

  const { status, body } = await call('GET', '/api/conversations')
  assert.equal(status, 200)
  assert.deepEqual(body.map(c => c.id).slice(0, 3), ['s_third', 's_second', 's_first'])
  assert.equal(body[0].turns, 1)
  assert.ok(body[0].lastAt >= body[1].lastAt)
})

test('the title is read off the first thing the student said', async () => {
  addTurn('s_title', 'student',
    'Explain how a rise in the minimum wage feeds through to employment in a competitive labour market.')
  addTurn('s_title', 'tutor', 'Start with the wage floor. What happens to quantity demanded above equilibrium?')

  const [row] = (await call('GET', '/api/conversations')).body.filter(c => c.id === 's_title')
  assert.equal(row.title, 'Explain how a rise in the minimum wage feeds')
  assert.ok(row.title.length <= 48, 'the title must fit a sidebar')
  assert.ok(!row.title.endsWith(' '), 'the title is cut on a word, not padded')
  assert.equal(row.turns, 2)
  assert.match(row.preview, /^Start with the wage floor/)
})

test('a tutor-only conversation is called New chat until it is named', async () => {
  addTurn('s_quiet', 'tutor', 'Put down one line first — a step, a number, or what is blocking you.')
  const [row] = (await call('GET', '/api/conversations')).body.filter(c => c.id === 's_quiet')
  assert.equal(row.title, 'New chat')
})

test('a stored title wins over the derived one', async () => {
  addTurn('s_named', 'student', 'i keep mixing up income effect and substitution effect')

  const derived = (await call('GET', '/api/conversations')).body.find(c => c.id === 's_named')
  assert.equal(derived.title, 'I keep mixing up income effect and substitution')

  const renamed = await call('PATCH', '/api/conversations/s_named', { title: 'Income vs substitution' })
  assert.equal(renamed.status, 200)
  assert.equal(renamed.body.title, 'Income vs substitution')

  const listed = (await call('GET', '/api/conversations')).body.find(c => c.id === 's_named')
  assert.equal(listed.title, 'Income vs substitution')

  const one = await call('GET', '/api/conversations/s_named')
  assert.equal(one.body.title, 'Income vs substitution')
  assert.equal(one.body.sessionId, 's_named')
  assert.equal(one.body.turns.length, 1)
  assert.equal(one.body.turns[0].body, 'i keep mixing up income effect and substitution effect')
})

test('deleting a conversation takes its turns and says how many went', async () => {
  addTurn('s_doomed', 'student', 'Define opportunity cost.')
  addTurn('s_doomed', 'tutor', 'Name the next best alternative you gave up. What was it?')
  await call('PATCH', '/api/conversations/s_doomed', { title: 'Opportunity cost' })

  const gone = await call('DELETE', '/api/conversations/s_doomed')
  assert.equal(gone.status, 200)
  assert.equal(gone.body.turns, 2)
  assert.match(gone.body.line, /2 turns/)
  assert.match(gone.body.line, /Opportunity cost/)

  assert.equal(all('SELECT id FROM turns WHERE session_id = ?', 's_doomed').length, 0)
  assert.equal(get('SELECT id FROM conversations WHERE id = ?', 's_doomed'), undefined)

  const listed = (await call('GET', '/api/conversations')).body.map(c => c.id)
  assert.ok(!listed.includes('s_doomed'))
  assert.equal((await call('GET', '/api/conversations/s_doomed')).status, 404)
})

test('a title with no turns behind it is not a conversation', async () => {
  run('INSERT INTO conversations (id,user_id,course_id,title,created_at,updated_at) VALUES (?,?,?,?,?,?)',
    's_empty', USER, COURSE.id, 'A name and nothing else', tick(), tick())

  const listed = (await call('GET', '/api/conversations')).body.map(c => c.id)
  assert.ok(!listed.includes('s_empty'), 'the list is derived from turns, not from titles')
  assert.equal((await call('GET', '/api/conversations/s_empty')).status, 404)
})
