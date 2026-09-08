/**
 * The chat spine: what a turn is asked for, and what it makes.
 *
 * The chat is the product, so these are the paths a student actually takes — ask for
 * cards, be set a question, have an answer marked — and the two things that must not
 * happen: an exam answer swallowed because it mentioned a card, and a file the
 * student added handed back out again in full on every reload.
 *
 *   node --test server/
 */
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

const DB_FILE = join(tmpdir(), `margin-session-${process.pid}.db`)
const DB_FILES = [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]
for (const f of DB_FILES) rmSync(f, { force: true })
process.env.MARGIN_DB = DB_FILE

const { createRouter, dispatch } = await import('../http.js')
const { seedIfEmpty } = await import('../packs/seed.js')
const { default: registerSession, wantsCards, wantsQuestion, topicAsked } = await import('./session.js')
const { default: registerCourses } = await import('./courses.js')
const { default: registerCards } = await import('./cards.js')
const { default: registerMark } = await import('./mark.js')
const { all } = await import('../db.js')

seedIfEmpty()
const router = createRouter()
registerCourses(router)
registerSession(router)
registerCards(router)
registerMark(router)

const COURSE = all('SELECT * FROM courses')[0]
const pack = JSON.parse(readFileSync(fileURLToPath(new URL('../packs/9609.json', import.meta.url)), 'utf8'))

after(() => { for (const f of DB_FILES) rmSync(f, { force: true }) })

/* --------------------------------------------------------------- the detectors */

test('a request for cards is told apart from a mention of one', () => {
  for (const said of [
    'make me flashcards',
    'Make me flashcards on cash flow',
    'can you create some cards for me',
    'turn my notes into cards',
    'give me 5 flashcards',
  ]) assert.ok(wantsCards(said), `should ask for cards: ${said}`)

  for (const said of [
    'review my cards',
    'open my due cards',
    // These carry a making verb, so only the review guard tells them apart from a
    // request to make more.
    'I want to review my cards',
    'I need to revise the cards I already have',
    'Explain how a business finances new equipment',
    'What is a debit card used for in a small business',
  ]) assert.ok(!wantsCards(said), `should not ask for cards: ${said}`)
})

test('a request to be set a question is told apart from having one', () => {
  for (const said of [
    'give me a question',
    'Give me an exam question on break-even',
    'ask me one',
    'set me a past paper question',
    'another question please',
  ]) assert.ok(wantsQuestion(said), `should ask to be set work: ${said}`)

  for (const said of [
    'I have a question about cash flow',
    'answer my question about gearing',
    'Explain the difference between profit and cash',
  ]) assert.ok(!wantsQuestion(said), `should not ask to be set work: ${said}`)
})

test('a topic is read off the request, and a placeholder is not a topic', () => {
  assert.equal(topicAsked('Make me cards on cash flow'), 'cash flow')
  assert.equal(topicAsked('give me a question about break-even analysis'), 'break-even analysis')
  // These name no topic: they ask for whatever is in front of the student.
  assert.equal(topicAsked('Make me flashcards on the topic I am weakest on.'), '')
  assert.equal(topicAsked('make me flashcards on this'), '')
  assert.equal(topicAsked('make me some cards'), '')
})

/* ------------------------------------------------------------------ the turns */

/** One turn through the real route, with the stream collected instead of written. */
async function turn(body) {
  const req = Object.assign(
    Readable.from([Buffer.from(JSON.stringify(body))]),
    { method: 'POST', url: '/api/session/turn' },
  )
  const chunks = []
  const res = {
    headersSent: false, status: 0, payload: '',
    on() {},
    writeHead(status) { this.status = status; this.headersSent = true },
    write(text) { chunks.push(text) },
    end(text) { if (text) this.payload = text },
  }
  await dispatch(router, req, res, () => { throw new Error('no route for the turn') })
  if (!chunks.length) return { status: res.status, events: [], body: res.payload ? JSON.parse(res.payload) : null }
  const events = []
  for (const frame of chunks.join('').split('\n\n')) {
    const name = frame.match(/^event: (.+)$/m)
    const data = frame.match(/^data: (.+)$/m)
    if (name && data) events.push({ event: name[1], data: JSON.parse(data[1]) })
  }
  return { status: res.status, events, body: null }
}

const prose = (r) => r.events.filter(e => e.event === 'delta').map(e => e.data.text).join('')
const final = (r) => r.events.find(e => e.event === 'turn')?.data ?? null
const made = (r) => final(r)?.artefacts ?? []

async function read(path) {
  const req = Object.assign(Readable.from([]), { method: 'GET', url: path })
  const res = {
    headersSent: false, status: 0, payload: '', on() {},
    writeHead(status) { this.status = status; this.headersSent = true },
    end(text) { this.payload = text || '' },
  }
  await dispatch(router, req, res, () => { throw new Error(`no route for ${path}`) })
  return { status: res.status, body: res.payload ? JSON.parse(res.payload) : null }
}

test('asking for cards makes a deck, in the turn, on a point of this course', async () => {
  const r = await turn({ sessionId: 's_cards', courseId: COURSE.id, text: 'Make me flashcards on cash flow' })
  const deck = made(r).find(a => a.kind === 'flashcards')
  assert.ok(deck, `no deck was made: ${JSON.stringify(made(r))}`)
  assert.ok(deck.cards.length > 0, 'a deck with no cards is not a deck')
  assert.deepEqual(deck.grounded, [{ code: '5.5', title: 'Cash-flow forecasting and working capital' }])
  for (const card of deck.cards) assert.equal(card.syllabusPoint, '5.5')
  assert.match(prose(r), /5\.5 Cash-flow forecasting/)

  // And it is still there when the conversation is reopened.
  const back = await read('/api/session/s_cards')
  const stored = back.body.turns.flatMap(t => t.artefacts || []).find(a => a.kind === 'flashcards')
  assert.ok(stored, 'the deck must survive the thread being reopened')
  assert.equal(stored.cards.length, deck.cards.length)
})

test('asking for a question sets one, and the thread is then on it', async () => {
  const r = await turn({ sessionId: 's_q', courseId: COURSE.id, text: 'give me a question on break-even' })
  const question = made(r).find(a => a.kind === 'question')
  assert.ok(question, 'no question was set')
  assert.equal(question.syllabusPoint, '5.3')
  assert.ok(pack.items.some(i => i.id === question.itemId), 'the question must be an item of the pack')
  assert.equal(final(r).itemId, question.itemId, 'the turn must leave the thread on the question')
  assert.match(prose(r), /Break-even analysis/)
})

test('an answer is marked against the scheme, and the mark is readable afterwards', async () => {
  const item = pack.items.find(i => i.id === 'itm_9609_p2_01')
  const answer =
    'Contribution per pack is $2.50 − $1.60 = $0.90. Break-even output is $18 000 ÷ $0.90 = 20 000 packs ' +
    'per month. Output last month was 30 000 packs, so the margin of safety is 30 000 − 20 000 = 10 000 packs.'
  const r = await turn({ sessionId: 's_mark', courseId: COURSE.id, itemId: item.id, intent: 'mark', text: answer })
  const mark = made(r).find(a => a.kind === 'mark')
  assert.ok(mark, `no mark was made: ${prose(r)}`)
  assert.equal(mark.max, item.tariff)
  assert.ok(mark.total > 0, `a correct calculation must earn something, got ${mark.total}`)

  const back = await read(`/api/marks/${mark.markId}`)
  assert.equal(back.status, 200)
  assert.equal(back.body.id, mark.markId)
  assert.equal(back.body.itemId, item.id)
})

test('an exam answer that mentions a card is not swallowed as a request for cards', async () => {
  const answer =
    'Break-even output is fixed costs divided by contribution per pack, so the business should make ' +
    'cards that show the contribution of each product line and compare them against the fixed costs it ' +
    'has to cover every month before any profit at all is earned, which is what the margin of safety ' +
    'measures once output is above that level.'
  const r = await turn({ sessionId: 's_guard', courseId: COURSE.id, itemId: 'itm_9609_p2_01', text: answer })
  assert.deepEqual(made(r), [], 'a student mid-answer must not have it turned into a deck')

  // The short request, on the same question, still works.
  const asked = await turn({ sessionId: 's_guard', courseId: COURSE.id, itemId: 'itm_9609_p2_01', text: 'make me flashcards on this' })
  const deck = made(asked).find(a => a.kind === 'flashcards')
  assert.ok(deck, 'a short request while on a question must still make a deck')
  assert.deepEqual(deck.grounded, [{ code: '5.3', title: 'Break-even analysis' }], '"this" means the question they are on')
})

test('material the student adds is kept, used, and not handed back in full', async () => {
  const notes =
    'Working capital is the money a business has available to meet its day-to-day bills. ' +
    'The cash operating cycle is the time between paying for stock and being paid by the customer. ' +
    'Overtrading is growing sales faster than the working capital needed to support them.'
  const r = await turn({
    sessionId: 's_mat', courseId: COURSE.id, text: 'Make me flashcards from my notes',
    material: [{ name: 'notes.md', text: notes }],
  })
  const deck = made(r).find(a => a.kind === 'flashcards')
  assert.ok(deck, 'notes must be able to make a deck')
  assert.ok(
    deck.cards.some(c => /working capital/i.test(c.front)),
    `the deck must come from the notes: ${JSON.stringify(deck.cards.map(c => c.front))}`,
  )

  const back = await read('/api/session/s_mat')
  const file = back.body.turns.flatMap(t => t.artefacts || []).find(a => a.kind === 'material')
  assert.ok(file, 'the file must be shown against the turn that added it')
  assert.equal(file.name, 'notes.md')
  assert.equal(file.chars, notes.length)
  // The text stays on the server: the transcript sends the name, the size and the
  // opening, not the whole file again on every reload.
  assert.equal(file.text, undefined)
  assert.ok(file.preview.length <= 240)
})
