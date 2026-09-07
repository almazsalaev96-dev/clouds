/**
 * Practise: what to answer next, and the record of having answered it.
 *
 * "Next" is not a shuffle. It is the Mark-Yield ranking (§07.5) over the course's
 * syllabus points, and the endpoint returns the reason string with the item so the
 * student can see why this question and not another one.
 *
 * The ranking helpers are exported because the planner builds today's session from
 * the same ordering — one ranking in the API, not two that drift.
 */
import { all, get, run, now, uid, logEvent } from '../db.js'
import { rank, explain } from '../engine/markyield.js'
import { entryRung } from '../engine/ladder.js'
import { parseScheme, maxMarks } from '../marking/scheme.js'
import {
  USER, jsonOk, readBody, str, mustCourse, resolveCourse, pointsWithState,
  daysToExam, phaseOf, expectedMinutes, safeJson,
} from './courses.js'

const MODES = new Set(['learn', 'practise', 'mark', 'timed', 'retest'])

export default function register(router) {
  /** The next item, with the reason it was chosen. */
  router.get('/api/practise/next', ({ res, query }) => {
    const course = resolveCourse(query)
    const exclude = (query.get('exclude') || '').split(',').map(s => s.trim()).filter(Boolean)
    const paper = query.get('paper') || null
    const maxTariff = Number(query.get('maxTariff')) || null
    const choice = nextItemFor(course, { exclude, paper, maxTariff })
    if (!choice) {
      return jsonOk(res, {
        item: null,
        reason: 'Every question in this pack has been answered in the last day. Review your due cards, or widen the filter.',
        courseId: course.id,
      })
    }
    return jsonOk(res, {
      courseId: course.id,
      item: choice.item,
      point: publicPoint(choice.point),
      reason: choice.reason,
      score: choice.score,
      entryRung: choice.entryRung,
      alternatives: choice.alternatives,
    })
  })

  /** Record an Attempt. This is the row every later claim about progress rests on. */
  router.post('/api/practise/attempt', async ({ req, res }) => {
    const body = await readBody(req)
    const course = mustCourse(str(body.courseId) || resolveCourse({}).id)
    const item = get('SELECT * FROM items WHERE id = ?', str(body.itemId))
    if (!item) throw Object.assign(new Error(`No item ${body.itemId}.`), { status: 404 })
    const answer = str(body.body ?? body.answer)
    if (!answer) throw Object.assign(new Error('The attempt is empty. Write your answer before recording it.'), { status: 400 })

    const mode = MODES.has(body.mode) ? body.mode : 'practise'
    const entry = clampRung(body.entryRung ?? body.entry_rung, 0)
    const max = clampRung(body.maxRung ?? body.max_rung, entry)
    const seen = body.seenSolution === true || body.seen_solution === 1 || max >= 5 ? 1 : 0
    const confidence = body.confidence == null ? null : clampInt(body.confidence, 0, 100)
    const seconds = clampInt(body.seconds ?? 0, 0, 60 * 60 * 6)

    const id = uid('a')
    run('INSERT INTO attempts (id,course_id,item_id,user_id,body,mode,entry_rung,max_rung,seen_solution,confidence,seconds,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      id, course.id, item.id, USER, answer, mode, entry, max, seen, confidence, seconds, now())

    // Seeing a point counts as exposure whatever the mark turns out to be; only the
    // Mark moves mastery, and only when the attempt was unaided (routes/mark.js).
    touchPoint(course.id, item.syllabus_point)
    logEvent('attempt.recorded', {
      itemId: item.id, mode, entryRung: entry, maxRung: max, seenSolution: !!seen, confidence, seconds,
    }, USER, course.id)

    return jsonOk(res, {
      id,
      courseId: course.id,
      itemId: item.id,
      mode,
      entryRung: entry,
      maxRung: max,
      seenSolution: !!seen,
      confidence,
      seconds,
      unaided: seen === 0 && max <= 3,
      createdAt: now(),
    }, 201)
  })

  /** One item, as the runner draws it. The mark scheme is deliberately not included. */
  router.get('/api/items/:id', ({ res, params, query }) => {
    const item = get('SELECT * FROM items WHERE id = ?', params.id)
    if (!item) throw Object.assign(new Error(`No item ${params.id}.`), { status: 404 })
    const courseId = query.get('courseId')
    const course = courseId ? mustCourse(courseId) : get('SELECT * FROM courses WHERE user_id = ? AND syllabus = ? LIMIT 1', USER, item.pack)
    const point = get('SELECT * FROM syllabus WHERE pack = ? AND code = ?', item.pack, item.syllabus_point)
    const state = course
      ? get('SELECT * FROM learner_state WHERE user_id = ? AND course_id = ? AND syllabus_point = ?', USER, course.id, item.syllabus_point)
      : null
    const mastery = state ? Number(state.mastery) || 0 : 0
    const attempts = course
      ? all('SELECT id,mode,entry_rung,max_rung,seen_solution,confidence,seconds,created_at FROM attempts WHERE user_id = ? AND item_id = ? ORDER BY created_at DESC LIMIT 5', USER, item.id)
      : []
    return jsonOk(res, {
      ...itemView(item),
      pointTitle: point?.title || null,
      mastery,
      masteryAttempts: state ? Number(state.attempts) || 0 : 0,
      entryRung: safeEntryRung({ mastery, itemKind: item.kind, priorAttempts: attempts.length }),
      attempts: attempts.map(a => ({
        id: a.id, mode: a.mode, entryRung: a.entry_rung, maxRung: a.max_rung,
        seenSolution: !!a.seen_solution, confidence: a.confidence, seconds: a.seconds, createdAt: a.created_at,
      })),
    })
  })
}

/* ------------------------------------------------------------------- ranking */

/**
 * The Mark-Yield ordering over this course's syllabus points, with the engine's own
 * reason line attached. If the engine returns a shape this file does not recognise
 * the points are still returned, ordered by the plainest useful proxy — weak and
 * stale first — and the fallback is flagged rather than hidden.
 */
export function rankedPoints(course, opts = {}) {
  const points = pointsWithState(course)
  const days = daysToExam(course.exam_date)
  const options = {
    daysToExam: days == null ? 999 : days,
    examDate: course.exam_date || null,
    phase: phaseOf(course),
    target: Number(opts.target) || 0.85,
    now: new Date(),
    ...opts,
  }
  const byCode = new Map(points.map(p => [p.code, p]))
  let ordered = []
  let fallback = false
  try {
    const ranked = rank(points, options)
    for (const r of Array.isArray(ranked) ? ranked : []) {
      const code = pointCode(r)
      const p = byCode.get(code)
      if (p && !ordered.some(o => o.point.code === code)) {
        ordered.push({ point: p, score: Number(r?.score ?? r?.yield ?? r?.value ?? 0) || 0 })
      }
    }
  } catch (err) {
    console.error('[markyield]', err)
  }
  if (!ordered.length) {
    fallback = true
    ordered = [...points]
      .sort((a, b) => (a.mastery - b.mastery) || (b.daysSinceSeen - a.daysSinceSeen))
      .map(p => ({ point: p, score: 0 }))
  }
  return ordered.map(o => ({
    ...o,
    reason: reasonFor(o.point, options),
    fallbackOrder: fallback,
  }))
}

/** The engine's own sentence; a factual one from the row if it cannot produce one. */
function reasonFor(point, options) {
  try {
    const line = explain(point, options)
    if (typeof line === 'string' && line.trim()) return line.trim()
  } catch (err) {
    console.error('[markyield.explain]', err)
  }
  const seen = point.daysSince == null ? 'never attempted' : `last seen ${point.daysSince} days ago`
  return `${point.paper} · ${point.code} ${point.title}: mastery ${point.mastery.toFixed(2)}, ${seen}.`
}

/**
 * The next item to answer: the highest-yield point that still has an item the
 * student has not just done. Returns the item, the point and the reason.
 */
export function nextItemFor(course, { exclude = [], paper = null, maxTariff = null, sinceHours = 24 } = {}) {
  const ranked = rankedPoints(course)
  const recent = new Set(all(
    'SELECT item_id FROM attempts WHERE user_id = ? AND course_id = ? AND created_at > ?',
    USER, course.id, new Date(Date.now() - sinceHours * 3600 * 1000).toISOString()).map(r => r.item_id))
  const skip = new Set([...exclude, ...recent])

  for (const entry of ranked) {
    if (paper && entry.point.paper !== paper) continue
    const items = itemsForPoint(course, entry.point.code)
      .filter(i => !skip.has(i.id))
      .filter(i => !maxTariff || i.tariff <= maxTariff)
    if (!items.length) continue
    const item = chooseItem(items, entry.point)
    return {
      item: itemView(item),
      point: entry.point,
      reason: entry.reason,
      score: entry.score,
      entryRung: safeEntryRung({ mastery: entry.point.mastery, itemKind: item.kind, priorAttempts: entry.point.attempts }),
      alternatives: ranked.slice(1, 4).map(e => ({ code: e.point.code, title: e.point.title, reason: e.reason })),
    }
  }
  return null
}

/** Items on a point, cheapest query first; the scheme id is kept, the scheme is not. */
export function itemsForPoint(course, code) {
  return all('SELECT * FROM items WHERE pack = ? AND syllabus_point = ? ORDER BY tariff, id', course.syllabus, code)
}

/**
 * Within a point, pick the item whose tariff suits the mastery: a student at 0.2
 * gets the short one, a student at 0.8 gets the essay. Ties break on the item the
 * student has answered least often.
 */
function chooseItem(items, point) {
  const wanted = point.mastery < 0.35 ? 3 : point.mastery < 0.6 ? 6 : 12
  const counts = new Map(all(
    'SELECT item_id AS id, COUNT(*) AS n FROM attempts WHERE user_id = ? GROUP BY item_id').map(r => [r.id, Number(r.n) || 0]))
  return [...items].sort((a, b) => {
    const d = Math.abs(a.tariff - wanted) - Math.abs(b.tariff - wanted)
    if (d !== 0) return d
    return (counts.get(a.id) || 0) - (counts.get(b.id) || 0)
  })[0]
}

/* --------------------------------------------------------------------- shapes */

/** The client-safe item. Never carries the mark scheme body. */
export function itemView(item) {
  const scheme = item.scheme_id ? get('SELECT * FROM schemes WHERE id = ?', item.scheme_id) : null
  let marks = Number(item.tariff) || 0
  let schemeKind = scheme?.kind || null
  if (scheme) {
    try {
      const parsed = parseScheme(safeJson(scheme.body, null))
      const m = Number(maxMarks(parsed))
      if (Number.isFinite(m) && m > 0) marks = m
      schemeKind = parsed?.kind || schemeKind
    } catch { /* the tariff stands as the maximum */ }
  }
  return {
    id: item.id,
    pack: item.pack,
    syllabusPoint: item.syllabus_point,
    paper: item.paper,
    commandWord: item.command_word,
    tariff: Number(item.tariff) || 0,
    maxMarks: marks,
    kind: item.kind,
    stem: item.stem,
    stimulus: item.stimulus || null,
    difficulty: item.difficulty == null ? null : Number(item.difficulty),
    expectedMinutes: expectedMinutes(item),
    markable: !!scheme,
    schemeKind,
  }
}

export function publicPoint(p) {
  return {
    code: p.code, title: p.title, paper: p.paper, weight: p.weight,
    mastery: p.mastery, state: p.state, attempts: p.attempts,
    lastSeen: p.lastSeen, daysSince: p.daysSince, itemCount: p.itemCount,
  }
}

/* --------------------------------------------------------------------- pieces */

export function touchPoint(courseId, code) {
  const existing = get('SELECT * FROM learner_state WHERE user_id = ? AND course_id = ? AND syllabus_point = ?', USER, courseId, code)
  if (existing) {
    run('UPDATE learner_state SET attempts = attempts + 1, last_seen = ? WHERE user_id = ? AND course_id = ? AND syllabus_point = ?',
      now(), USER, courseId, code)
  } else {
    run('INSERT INTO learner_state (user_id,course_id,syllabus_point,mastery,attempts,unaided_marks,unaided_max,last_seen,misconceptions) VALUES (?,?,?,?,?,?,?,?,?)',
      USER, courseId, code, 0, 1, 0, 0, now(), '[]')
  }
}

function pointCode(r) {
  if (typeof r === 'string') return r
  return r?.code || r?.syllabus_point || r?.point?.code || (typeof r?.point === 'string' ? r.point : null)
}

function safeEntryRung(args) {
  try {
    const n = Number(entryRung(args))
    if (Number.isFinite(n)) return Math.min(5, Math.max(1, Math.round(n)))
  } catch { /* the ladder starts at the bottom if the engine cannot say */ }
  return 1
}

function clampRung(v, fallback) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(5, Math.max(0, Math.round(n)))
}

function clampInt(v, lo, hi) {
  const n = Number(v)
  if (!Number.isFinite(n)) return lo
  return Math.min(hi, Math.max(lo, Math.round(n)))
}
