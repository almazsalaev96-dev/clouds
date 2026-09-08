/**
 * The card maker's two promises: a deck belongs to this course, and a card on it is
 * a card — one question with one short answer that is not the question again. The
 * built-in provider is exercised directly, because it is the deck every first-time
 * reader is shown.
 *
 *   node --test server/
 */
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { makeCards } from './cardmaker.js'
import { mock } from '../providers/mock.js'

const pack = JSON.parse(readFileSync(fileURLToPath(new URL('../packs/9609.json', import.meta.url)), 'utf8'))
const POINTS = pack.syllabus
const CODES = new Set(POINTS.map((p) => p.code))

const COURSE = { title: 'Business 9609', board: 'Cambridge International', syllabus: '9609' }

/** A tutor turn that states three things about 3.2 Market research, and a student around it. */
const TRANSCRIPT = [
  { role: 'student', content: 'I keep mixing up the two kinds of market research.' },
  { role: 'tutor', content: 'Market research is the gathering of information about customers and competitors before a decision.\nPrimary research is data you collect yourself, from your own customers.\nSecondary research is data someone else already collected and published.' },
  { role: 'student', content: 'Can you make me some cards on that?' },
]

/** A provider that offers exactly the deck a test wants to see linted. */
const offering = (cards) => ({
  name: 'stub',
  configured: true,
  async complete() {
    return { text: JSON.stringify({ cards }), json: { cards }, model: 'stub', usage: { in: 0, out: 0 }, costUsd: 0 }
  },
})

const deckFrom = (over = {}) => makeCards({
  course: COURSE, topic: 'market research', transcript: TRANSCRIPT, points: POINTS,
  provider: mock, model: 'mock', count: 6, ...over,
})

test('a conversation about a real syllabus point makes a deck on that point', async () => {
  const deck = await deckFrom()
  assert.ok(deck.cards.length > 0, 'the built-in provider must still leave a student with cards')
  assert.deepEqual(deck.grounded, [{ code: '3.2', title: 'Market research' }])
  assert.equal(deck.topic, 'market research')
  for (const card of deck.cards) {
    assert.ok(card.front.includes('?') || /_{3,}/.test(card.front), `not a question: "${card.front}"`)
    assert.ok(card.back.length > 0)
    assert.ok(card.why.includes('3.2'), `a card should say where it came from: "${card.why}"`)
  }
})

test('every card names a syllabus point that exists on the course', async () => {
  const deck = await deckFrom({
    provider: offering([
      { front: 'What is secondary research?', back: 'Data someone else has already collected and published.', syllabus_point: '3.2' },
      { front: 'What is a redox titration?', back: 'A titration where electrons are transferred.', syllabus_point: '9.9 Redox' },
    ]),
  })
  assert.deepEqual(deck.cards.map((c) => c.front), ['What is secondary research?'])
  for (const card of deck.cards) assert.ok(CODES.has(card.syllabusPoint), `${card.syllabusPoint} is not on this course`)
  assert.ok(
    deck.warnings.some((w) => w.includes('9.9 Redox') && w.includes('not a syllabus point on this course')),
    `the drop must be said out loud: ${JSON.stringify(deck.warnings)}`,
  )
})

test('a back that is a paragraph is dropped, and the deck says why', async () => {
  const paragraph = 'Market research is the systematic gathering, recording and analysis of data about the customers, competitors and wider market a business sells into, so that a decision about price, product, place or promotion can be taken on evidence rather than on the opinion of the person taking it.'
  const deck = await deckFrom({
    provider: offering([
      { front: 'What is primary research?', back: 'Data you collect yourself, from your own customers.', syllabus_point: '3.2' },
      { front: 'What is market research?', back: paragraph, syllabus_point: '3.2' },
    ]),
  })
  assert.deepEqual(deck.cards.map((c) => c.front), ['What is primary research?'])
  assert.ok(
    deck.warnings.some((w) => w.includes('What is market research?') && /\d+ words/.test(w) && w.includes('paragraph')),
    `the length drop must be said out loud: ${JSON.stringify(deck.warnings)}`,
  )
})

test('a back that only repeats its front is not a card', async () => {
  const deck = await deckFrom({
    provider: offering([
      { front: 'What is market research?', back: 'Market research.', syllabus_point: '3.2' },
    ]),
  })
  assert.equal(deck.cards.length, 3, 'with nothing usable offered, the conversation itself is cut into cards')
  assert.ok(deck.warnings.some((w) => w.includes('the back only says the front again')), JSON.stringify(deck.warnings))
})

test('two cards with the same front collapse to one', async () => {
  const deck = await deckFrom({
    provider: offering([
      { front: 'What is primary research?', back: 'Data you collect yourself, from your own customers.', syllabus_point: '3.2' },
      { front: 'What is primary research? ', back: 'Data gathered first hand for this decision.', syllabus_point: 'Market research' },
    ]),
  })
  assert.equal(deck.cards.length, 1)
  assert.equal(deck.cards[0].back, 'Data you collect yourself, from your own customers.')
  assert.ok(deck.warnings.some((w) => w.includes('so the deck keeps one')), JSON.stringify(deck.warnings))
})

test('the same request twice gives the same deck', async () => {
  const once = await deckFrom()
  const twice = await deckFrom()
  assert.deepEqual(twice, once)
})

test('a deck cannot be made with no syllabus points to sit on', async () => {
  await assert.rejects(() => deckFrom({ points: [] }), (err) => {
    assert.equal(err.status, 400)
    assert.match(err.message, /^This course has no syllabus points/)
    return true
  })
})

/* ------------------------------------------------------- POST /api/cards/bulk */

const DB_FILE = join(tmpdir(), `margin-cardmaker-${process.pid}.db`)
const DB_FILES = [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]
for (const f of DB_FILES) rmSync(f, { force: true })
process.env.MARGIN_DB = DB_FILE

const { createRouter, dispatch } = await import('../http.js')
const { seedIfEmpty } = await import('../packs/seed.js')
const { default: registerCards } = await import('../routes/cards.js')

seedIfEmpty()
const router = createRouter()
registerCards(router)

after(() => { for (const f of DB_FILES) rmSync(f, { force: true }) })

/** One request through the real route, with no socket in the way. */
async function call(method, path, body) {
  const req = Object.assign(
    Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]),
    { method, url: path },
  )
  const res = {
    headersSent: false, status: 0, payload: '',
    writeHead(status) { this.status = status; this.headersSent = true },
    end(text) { this.payload = text || '' },
  }
  await dispatch(router, req, res, () => { throw new Error(`no route for ${method} ${path}`) })
  return { status: res.status, body: res.payload ? JSON.parse(res.payload) : null }
}

const DECK = [
  { front: 'What is market research?', back: 'Gathering information about customers and competitors before a decision.', syllabusPoint: '3.2' },
  { front: 'What is primary research?', back: 'Data you collect yourself, from your own customers.', syllabusPoint: '3.2' },
]

test('a deck saves in one go, filed on its syllabus point', async () => {
  const saved = await call('POST', '/api/cards/bulk', { cards: DECK })
  assert.equal(saved.status, 201)
  assert.equal(saved.body.created.length, 2)
  assert.deepEqual(saved.body.skipped, [])
  assert.deepEqual(saved.body.created.map((c) => c.syllabusPoint), ['3.2', '3.2'])
  assert.match(saved.body.created[0].provenance, /Made in a conversation/)
  assert.equal(saved.body.line, '2 cards saved.')

  const due = await call('GET', '/api/cards/due')
  assert.deepEqual(due.body.map((c) => c.front).sort(), DECK.map((c) => c.front).sort())
})

test('a card with an empty back is refused in a sentence, and no card of that deck is saved', async () => {
  const refused = await call('POST', '/api/cards/bulk', {
    cards: [
      { front: 'What is a focus group?', back: 'A small guided discussion with customers.', syllabusPoint: '3.2' },
      { front: 'What is a sample?', back: '   ', syllabusPoint: '3.2' },
    ],
  })
  assert.equal(refused.status, 400)
  assert.equal(refused.body.error, 'Card 2 of this deck has no back. Write the answer you want to recall.')

  const due = await call('GET', '/api/cards/due')
  assert.ok(!due.body.some((c) => c.front === 'What is a focus group?'), 'a refused deck must not save half of itself')
})

test('a card already on this course is not saved twice', async () => {
  const again = await call('POST', '/api/cards/bulk', {
    cards: [DECK[0], { front: 'What is secondary research?', back: 'Data someone else already collected and published.', syllabusPoint: '3.2' }],
  })
  assert.equal(again.status, 201)
  assert.deepEqual(again.body.created.map((c) => c.front), ['What is secondary research?'])
  assert.deepEqual(again.body.skipped, [DECK[0].front])
  assert.equal(again.body.line, '1 card saved, 1 already on this course.')

  const due = await call('GET', '/api/cards/due')
  assert.equal(due.body.filter((c) => c.front === DECK[0].front).length, 1)
})

test('an empty deck is refused rather than saved as nothing', async () => {
  const empty = await call('POST', '/api/cards/bulk', { cards: [] })
  assert.equal(empty.status, 400)
  assert.match(empty.body.error, /nothing here to keep/)
})
