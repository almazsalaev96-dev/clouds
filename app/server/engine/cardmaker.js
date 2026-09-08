/**
 * The card maker. A conversation goes in, a deck of flashcards comes out.
 *
 * Two rules decide what survives. A card must sit on a syllabus point of *this*
 * course: the scheduler files every card by point, so a card on nothing is a card
 * that never comes due and never counts towards a topic — dropping it is kinder than
 * storing it. And a card must be a card: one question, one short answer, not a
 * paragraph, and not a restatement of its own front. Both rules run over whatever
 * the model returns, and every drop is reported in `warnings` rather than swallowed.
 *
 * Nothing here throws when the model is absent or unusable. With no API key the
 * router hands over the mock provider, whose deck fails the rules above, and the
 * conversation itself is then mined for the definitions it already contains — the
 * warnings say so, so a student is never shown a deck that came from nowhere.
 *
 * Deterministic: no clock, no randomness, no I/O. The same conversation, the same
 * points and the same provider make the same deck.
 */
import { extractJson } from '../providers/types.js'
import { contentWords, wordCount } from './gate.js'

/** Cards made when the caller names no number, and the most one deck may hold. */
const DEFAULT_COUNT = 6
const MAX_COUNT = 20

/** A back longer than this is a paragraph. Recall wants an answer, not a page. */
const BACK_MAX_WORDS = 30

/** How much of a back may be words already in its own front before it teaches nothing. */
const REPEAT_AT = 0.8

/** How much of a syllabus point's title must be present before the text names it. */
const MATCH_AT = 0.5

/** The `generate` route's latency budget (§08.2); a deck is not worth a hung request. */
const BUDGET_MS = 20000

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim()
/** Whitespace tidied, but line breaks kept: they end a sentence in a chat turn. */
const tidy = (s) => String(s == null ? '' : s).replace(/[ \t]+/g, ' ').trim()

/** Sentences, keeping their terminators; a line break ends one too. */
const sentencesOf = (text) => String(text || '').split(/(?<=[.?!])\s+|\n+/).map((s) => s.trim()).filter(Boolean)

/** A fragment short enough to name a card in a warning a student reads. */
const snip = (text, limit = 56) => {
  const t = norm(text)
  return t.length <= limit ? t : t.slice(0, t.lastIndexOf(' ', limit) > 20 ? t.lastIndexOf(' ', limit) : limit).trim() + '…'
}

/**
 * How much of `needle` is present in `haystack`, by content word.
 *
 * Hyphens are opened out first: a student asking for "cash flow" is asking for
 * "Cash-flow forecasting and working capital", and a compound that stayed one token
 * would match nothing they ever type.
 */
function overlap(needle, haystack) {
  const want = [...new Set(contentWords(unhyphen(needle)))]
  if (!want.length) return 0
  const have = new Set(contentWords(unhyphen(haystack)))
  return want.filter((w) => have.has(w)).length / want.length
}

const unhyphen = (s) => String(s == null ? '' : s).replace(/[-\u2010-\u2015]/g, ' ')

// ──────────────────────────────────────────────────────────── the course's points

/** The syllabus points a deck may sit on, as {code, title}. */
function readPoints(points) {
  const out = []
  const seen = new Set()
  for (const p of Array.isArray(points) ? points : []) {
    const code = norm(p?.code ?? p?.syllabus_point ?? p?.syllabusPoint)
    const title = norm(p?.title)
    if (!code || seen.has(code)) continue
    seen.add(code)
    out.push({ code, title: title || code })
  }
  return out
}

/**
 * Does this topic name this point? Its code, a code it is the parent of ("3" asks
 * for 3.1 and 3.2), or enough of its title.
 */
function topicNames(point, topic) {
  const t = topic.toLowerCase()
  const code = point.code.toLowerCase()
  const head = t.split(/\s+/)[0].replace(/[.:,)]$/, '')
  if (head === code || code.startsWith(head + '.')) return true
  // Either way round: "market research" names the point whose title it is, and
  // "cash flow" names the point whose title contains it.
  return Math.max(overlap(point.title, t), overlap(t, point.title)) >= MATCH_AT
}

/**
 * The points a deck may draw on. A topic the student named wins; with no topic the
 * conversation is read for the points it already talks about; with neither, the
 * whole course is on the table.
 */
function focusFor(points, topic, text) {
  if (topic) {
    const named = points.filter((p) => topicNames(p, topic))
    return named.length ? { points: named, topic: null, named: true } : { points, topic: null, named: false }
  }
  const scored = points
    .map((p) => ({ point: p, score: overlap(p.title, text) }))
    .filter((x) => x.score >= MATCH_AT)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
  if (!scored.length) return { points, topic: null, named: false }
  const keep = new Set(scored.map((x) => x.point.code))
  return { points: points.filter((p) => keep.has(p.code)), topic: scored[0].point.title, named: true }
}

/**
 * The point a card claims, resolved against the course. The code as written, the code
 * at the head of "3.2 Market research", the title, or enough of the title — anything
 * else belongs to no point here.
 */
function pointFor(ref, points) {
  const t = norm(ref).toLowerCase()
  if (!t) return null
  const head = t.split(/\s+/)[0].replace(/[.:,)]$/, '')
  for (const p of points) if (t === p.code.toLowerCase() || head === p.code.toLowerCase()) return p
  for (const p of points) if (t === p.title.toLowerCase()) return p
  let best = null
  for (const p of points) {
    const score = overlap(p.title, t)
    if (score >= MATCH_AT && (!best || score > best.score)) best = { point: p, score }
  }
  return best?.point || null
}

// ──────────────────────────────────────────────────────────────── the model prompt

function buildSystem({ course, points, count }) {
  const parts = []
  parts.push(`You write revision flashcards for a student taking ${course?.title || 'this course'}${course?.syllabus ? ` (${course.board || 'syllabus'} ${course.syllabus})` : ''}. You write cards from the conversation you are given and from nothing else.`)
  parts.push(`Syllabus points on this course — a card must sit on one of these, and you name which by its code:\n${points.map((p) => `- ${p.code} ${p.title}`).join('\n')}`)
  parts.push([
    'What a card is:',
    '- The front asks one thing: a question, or a sentence with one blank written as ____.',
    `- The back is the answer to that one thing, in at most ${BACK_MAX_WORDS} words.`,
    '- The back says something the front does not. A back that repeats its front teaches nothing.',
    '- No two cards share a front.',
    '- A fact the conversation never stated is not a card, however true it is.',
  ].join('\n'))
  parts.push(`Write at most ${count} cards. Return JSON only, in the shape the schema names.`)
  return parts.join('\n\n')
}

function buildUser(turns, topic, count) {
  const body = turns.map((t) => `${t.role === 'tutor' ? 'Tutor' : 'Student'}: ${t.text}`).join('\n\n')
  return `The conversation so far:\n\n${body}\n\nMake up to ${count} cards${topic ? ` on ${topic}` : ''}.`
}

const DECK_SCHEMA = {
  type: 'object',
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        required: ['front', 'back', 'syllabus_point'],
        properties: {
          front: { type: 'string' },
          back: { type: 'string' },
          syllabus_point: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
  },
}

async function callModel({ provider, model, system, user, schema }) {
  if (!provider || typeof provider.complete !== 'function') return null
  let timer = null
  try {
    const work = provider.complete({
      system,
      messages: [{ role: 'user', content: user }],
      schema,
      effort: 'medium',
      maxTokens: 2000,
      temperature: 0,
      model,
    })
    const guard = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('the card call exceeded its budget')), BUDGET_MS)
    })
    const res = await Promise.race([work, guard])
    const data = res?.json ?? extractJson(res?.text || '')
    if (!data || typeof data !== 'object') return null
    return { data }
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** One model reply → the cards it offered, in this module's own shape. */
function readDeck(data) {
  const rows = Array.isArray(data?.cards) ? data.cards : Array.isArray(data) ? data : []
  return rows.filter((c) => c && typeof c === 'object').map((c) => ({
    front: norm(c.front ?? c.question),
    back: norm(c.back ?? c.answer),
    ref: norm(c.syllabus_point ?? c.syllabusPoint ?? c.point ?? c.code),
    why: norm(c.why ?? c.reason),
  }))
}

// ─────────────────────────────────────────────────────────────────────── the lint

/** A front is a card only if it asks: a question mark, or a blank to fill. */
const asksSomething = (front) => front.includes('?') || /_{3,}/.test(front)

/** A back made of words already in its own front is the front again. */
function repeatsFront(front, back) {
  const said = [...new Set(contentWords(back))]
  if (!said.length) return true
  const asked = new Set(contentWords(front))
  return said.filter((w) => asked.has(w)).length / said.length >= REPEAT_AT
}

const frontKey = (front) => front.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim()

/**
 * Every candidate card against the two rules, in the order a student would ask them:
 * is this card mine, and is it a card? Each drop leaves a sentence behind.
 */
function siftDeck(candidates, { points, count, warnings }) {
  const kept = []
  const seen = new Set()
  for (const c of candidates) {
    if (!c.front) {
      warnings.push('Dropped a card that asked nothing.')
      continue
    }
    if (!c.back) {
      warnings.push(`Dropped "${snip(c.front, 40)}" — it came with no answer on the back.`)
      continue
    }
    const point = pointFor(c.ref, points)
    if (!point) {
      warnings.push(`Dropped "${snip(c.front, 40)}" — ${c.ref ? `"${snip(c.ref, 32)}" is not a syllabus point on this course` : 'it names no syllabus point'}, so it would never come up for review.`)
      continue
    }
    if (!asksSomething(c.front)) {
      warnings.push(`Dropped "${snip(c.front, 40)}" — the front asks nothing, so there is nothing to recall.`)
      continue
    }
    const length = wordCount(c.back)
    if (length > BACK_MAX_WORDS) {
      warnings.push(`Dropped "${snip(c.front, 40)}" — the back runs to ${length} words, which is a paragraph rather than an answer.`)
      continue
    }
    if (repeatsFront(c.front, c.back)) {
      warnings.push(`Dropped "${snip(c.front, 40)}" — the back only says the front again.`)
      continue
    }
    const key = frontKey(c.front)
    if (seen.has(key)) {
      warnings.push(`Two cards asked "${snip(c.front, 40)}", so the deck keeps one.`)
      continue
    }
    seen.add(key)
    kept.push({
      front: c.front,
      back: c.back,
      syllabusPoint: point.code,
      why: c.why || `From this conversation, on ${point.code} ${point.title}.`,
    })
  }
  if (kept.length > count) {
    warnings.push(`Kept the first ${count} of ${kept.length} cards; ask again for the rest.`)
    return kept.slice(0, count)
  }
  return kept
}

// ────────────────────────────────────────────────── the deck the conversation made

/** "X is Y", "X means Y", "X refers to Y" — the shape a card can be cut from. */
const STATES = /^(.{3,70}?)\s+(is|are|means|refers to)\s+(.+)$/i

/**
 * A term that carries a clause of its own is not a term.
 *
 * "Shareholders own part of a company and are one stakeholder group" matches the
 * shape above with everything before "are" as the term, which asks "what are
 * shareholders own part of a company and?". A term is a name, so it holds no
 * conjunction, no relative pronoun and no second verb.
 */
const NOT_A_TERM = /\b(?:and|or|but|so|because|which|that|when|while|if|then|therefore)\b/i

/**
 * A term that opens with a preposition is the tail of a clause, not a name. "In
 * Herzberg's two-factor theory pay is a hygiene factor" would otherwise be asked as
 * "What is in Herzberg's two-factor theory pay?".
 */
const NOT_A_LEAD = /^(?:in|on|at|by|for|from|with|under|over|within|after|before|during|about|as|to|of)\b/i

/** Lower a leading capital, but leave an acronym — "USP" is not "uSP". */
const lowerLead = (term) => (/^[A-Z](?:[a-z]|\s)/.test(term) ? term[0].toLowerCase() + term.slice(1) : term)

/**
 * The deck the conversation already contains. Every sentence that states what
 * something is becomes the question it answers, so nothing is invented: the back is
 * the tutor's own words, cut at the sentence, never summarised into something
 * neither of them said.
 */
function fromConversation(turns, points, origin = 'this conversation') {
  const out = []
  for (const turn of turns) {
    for (const sentence of sentencesOf(turn.text)) {
      const m = STATES.exec(sentence.replace(/[.!?]+$/, ''))
      if (!m) continue
      // Connectives go; the article stays, because "what is useful figure?" is not a
      // question and "what is the useful figure?" is.
      const term = norm(m[1]).replace(/^(?:so|and|but|then)\s+/i, '')
      const body = norm(m[3])
      if (!term || NOT_A_TERM.test(term) || NOT_A_LEAD.test(term) || wordCount(term) > 6) continue
      if (wordCount(body) < 3 || wordCount(body) > BACK_MAX_WORDS) continue
      const point = pointFor(sentence, points) || (points.length === 1 ? points[0] : null)
      if (!point) continue
      out.push({
        front: `What ${m[2].toLowerCase() === 'are' ? 'are' : 'is'} ${lowerLead(term)}?`,
        back: body[0].toUpperCase() + body.slice(1) + '.',
        ref: point.code,
        why: `From ${origin}, on ${point.code} ${point.title}.`,
      })
    }
  }
  return out
}

/**
 * The deck the course itself already contains.
 *
 * A thread that has said nothing yet still has material behind it: what the pack
 * records that students get wrong on a point is a statement of the right answer, and
 * the same sentence miner cuts it into cards. Each entry is mined against its own
 * point, so a card can only ever be filed where its material came from.
 */
function fromMaterial(material, points) {
  const out = []
  for (const entry of Array.isArray(material) ? material : []) {
    const point = pointFor(entry?.code, points)
    if (!point) continue
    const text = tidy(entry?.text)
    if (!text) continue
    out.push(...fromConversation([{ role: 'tutor', text }], [point], 'your course material'))
  }
  return out
}

// ─────────────────────────────────────────────────────────────────── makeCards()

/**
 * Make a deck from a conversation.
 *
 * @param {object}   a
 * @param {object}   a.course      the course row: {title, board, syllabus}
 * @param {string}  [a.topic]      the topic the student named, if they named one
 * @param {string|Array} a.transcript the conversation: a string, or [{role, content}]
 * @param {Array}    a.points      this course's syllabus points: [{code, title}]
 * @param {object}  [a.provider]   a Provider from server/providers
 * @param {string}  [a.model]
 * @param {number}  [a.count]      how many cards to ask for
 * @returns {Promise<{cards: Array<{front:string, back:string, syllabusPoint:string, why:string}>,
 *                    topic: string|null, grounded: Array<{code:string,title:string}>, warnings: string[]}>}
 */
export async function makeCards({ course, topic, transcript, points, provider, model, count, material } = {}) {
  const known = readPoints(points)
  if (!known.length) {
    throw Object.assign(new Error('This course has no syllabus points, so there is nothing to make cards on.'), { status: 400 })
  }
  const turns = readTranscript(transcript)
  if (!turns.length) {
    throw Object.assign(new Error('There is no conversation here to make cards from.'), { status: 400 })
  }

  const want = clampCount(count)
  const asked = norm(topic)
  const text = turns.map((t) => t.text).join('\n')
  const focus = focusFor(known, asked, text)
  const warnings = []
  if (asked && !focus.named) {
    warnings.push(`No syllabus point on this course is called "${snip(asked, 40)}", so the deck covers the whole course.`)
  }

  const reply = await callModel({
    provider,
    model,
    system: buildSystem({ course, points: focus.points, count: want }),
    user: buildUser(turns, asked || focus.topic, want),
    schema: DECK_SCHEMA,
  })
  const offered = reply ? readDeck(reply.data) : []

  // Where the deck came from is one fact, said once. Reporting each fallback as it is
  // tried leaves a student reading two sentences that contradict each other.
  const offeredKept = siftDeck(offered, { points: known, count: want, warnings })
  let cards = offeredKept
  let source = cards.length ? 'written' : ''
  if (!cards.length) {
    cards = siftDeck(fromConversation(turns, focus.points), { points: known, count: want, warnings })
    if (cards.length) source = 'conversation'
  }
  // A thread that has not covered the topic yet is not a reason to hand a student an
  // empty deck: the course material behind the point says the same things.
  if (!cards.length) {
    cards = siftDeck(fromMaterial(material, focus.points), { points: known, count: want, warnings })
    if (cards.length) source = 'material'
  }

  if (source === 'conversation') {
    warnings.push(reply && offered.length
      ? 'Nothing the model offered belongs on this course, so the deck was cut from this conversation.'
      : 'No model wrote these: they are cut from what was said in this conversation.')
  } else if (source === 'material') {
    warnings.push(reply
      ? 'Nothing written belongs on this course and this conversation has not covered it, so the deck is taken from your course material.'
      : 'No model wrote these, and this conversation has not covered the topic: they are taken from your course material.')
  } else if (!cards.length) {
    warnings.push('Nothing here states a fact plainly enough to make a card from. Ask for the explanation first, then ask again for the cards.')
  }
  // A short deck is not a broken one, but a student who asked for six and got two is
  // owed the reason rather than left to wonder.
  if (cards.length && cards.length < want) {
    warnings.push(`You asked for ${want}; ${cards.length} is what this material states plainly enough to be a card. Work the topic and ask again for the rest.`)
  }

  const on = new Set(cards.map((c) => c.syllabusPoint))
  const written = source === 'written'
  return {
    cards,
    topic: asked || focus.topic || null,
    grounded: known.filter((p) => on.has(p.code)).map((p) => ({ code: p.code, title: p.title })),
    warnings,
    // Null when no model wrote these — a deck cut from the transcript or the pack is
    // the student's own words and the course's, and must not be credited elsewhere.
    model: written ? String(reply?.model || model || null) || null : null,
  }
}

/* --------------------------------------------------------------------- pieces */

/** The conversation as turns, however the caller holds it. */
function readTranscript(transcript) {
  const list = Array.isArray(transcript) ? transcript : transcript == null ? [] : [transcript]
  const out = []
  for (const turn of list) {
    const text = tidy(typeof turn === 'string' ? turn : turn?.content ?? turn?.body ?? turn?.text)
    if (!text) continue
    const role = String(typeof turn === 'string' ? 'student' : turn?.role || 'student').toLowerCase()
    out.push({ role: role === 'tutor' || role === 'assistant' ? 'tutor' : 'student', text })
  }
  return out
}

function clampCount(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return DEFAULT_COUNT
  return Math.min(MAX_COUNT, Math.max(1, Math.round(n)))
}
