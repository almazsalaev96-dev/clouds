/**
 * Cards: the due queue, the two-button review that runs FSRS, and the counts.
 *
 * Grades are `again` and `good` only — the two buttons the interface has. The
 * scheduler is `engine/fsrs.js`; this file supplies the exam date and the phase so
 * intervals ramp with the countdown and nothing is scheduled past the paper.
 */
import { all, get, run, now, uid, logEvent } from '../db.js'
import { review, desiredRetention, phaseFor } from '../engine/fsrs.js'
import {
  USER, jsonOk, readBody, str, mustCourse, resolveCourse, daysToExam, DAY_MS,
} from './courses.js'

const GRADES = new Set(['again', 'good'])
const DEFAULT_LIMIT = 60

export default function register(router) {
  /** Everything due now, soonest first. */
  router.get('/api/cards/due', ({ res, query }) => {
    const course = resolveCourse(query)
    const limit = clampInt(query.get('limit') ?? DEFAULT_LIMIT, 1, 200)
    const rows = all(
      'SELECT * FROM cards WHERE user_id = ? AND course_id = ? AND due <= ? ORDER BY due, created_at LIMIT ?',
      USER, course.id, now(), limit)
    return jsonOk(res, rows.map(r => cardView(r, course)))
  })

  /** One review. Grade in, next due date out. */
  router.post('/api/cards/:id/review', async ({ req, res, params }) => {
    const body = await readBody(req)
    const grade = str(body.grade).toLowerCase()
    if (!GRADES.has(grade)) {
      throw Object.assign(new Error('Grade this card "again" or "good".'), { status: 400 })
    }
    const card = get('SELECT * FROM cards WHERE id = ? AND user_id = ?', params.id, USER)
    if (!card) throw Object.assign(new Error(`No card ${params.id}.`), { status: 404 })
    const course = mustCourse(card.course_id)
    const days = daysToExam(course.exam_date)
    const phase = phaseFor(days == null ? 999 : days)
    const at = new Date()

    let next
    try {
      next = review(card, grade, {
        now: at,
        examDate: course.exam_date ? new Date(course.exam_date) : null,
        phase,
      })
    } catch (err) {
      console.error('[fsrs]', err)
      throw Object.assign(new Error('The scheduler could not update this card. Your review was not lost — try it again.'), { status: 500 })
    }
    if (!next || typeof next !== 'object') {
      throw Object.assign(new Error('The scheduler returned nothing for this card.'), { status: 500 })
    }

    const due = toIso(next.due) || new Date(at.getTime() + DAY_MS).toISOString()
    const stability = num(next.stability, card.stability)
    const difficulty = num(next.difficulty, card.difficulty)
    const reps = Math.max(0, Math.round(num(next.reps, (Number(card.reps) || 0) + 1)))
    const lapses = Math.max(0, Math.round(num(next.lapses, (Number(card.lapses) || 0) + (grade === 'again' ? 1 : 0))))
    const lastReview = toIso(next.last_review ?? next.lastReview) || at.toISOString()

    run('UPDATE cards SET stability = ?, difficulty = ?, due = ?, reps = ?, lapses = ?, last_review = ? WHERE id = ?',
      stability, difficulty, due, reps, lapses, lastReview, card.id)
    logEvent('card.review', { cardId: card.id, grade, due, stability, syllabusPoint: card.syllabus_point }, USER, course.id)

    const intervalDays = Math.max(0, Math.round(((new Date(due) - at) / DAY_MS) * 10) / 10)
    const remaining = Number(get(
      'SELECT COUNT(*) AS n FROM cards WHERE user_id = ? AND course_id = ? AND due <= ?',
      USER, course.id, now())?.n || 0)
    return jsonOk(res, {
      id: card.id,
      grade,
      due,
      intervalDays,
      stability: round3(stability),
      difficulty: round3(difficulty),
      reps,
      lapses,
      lastReview,
      retentionTarget: round3(safeRetention(days)),
      cappedAtExam: !!course.exam_date && new Date(due) >= new Date(String(course.exam_date).slice(0, 10) + 'T00:00:00Z'),
      remainingDue: remaining,
      line: intervalDays < 1
        ? 'Back in this session.'
        : `Next on ${new Date(due).toISOString().slice(0, 10)}, ${intervalDays} day${intervalDays === 1 ? '' : 's'} from now.`,
    })
  })

  /** A card the student wrote. Due immediately, because they made it for a reason. */
  router.post('/api/cards', async ({ req, res }) => {
    const body = await readBody(req)
    const course = body.courseId ? mustCourse(str(body.courseId)) : resolveCourse({})
    const front = str(body.front)
    const back = str(body.back)
    if (!front) throw Object.assign(new Error('Write the front of the card — the question you want to be asked.'), { status: 400 })
    if (!back) throw Object.assign(new Error('Write the back of the card — the answer you want to recall.'), { status: 400 })
    const point = str(body.syllabusPoint ?? body.syllabus_point) || 'unfiled'
    const id = uid('card')
    run('INSERT INTO cards (id,user_id,course_id,syllabus_point,front,back,source,stability,difficulty,due,reps,lapses,last_review,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      id, USER, course.id, point, front, back, str(body.source) || 'manual', 0, 5,
      toIso(body.due) || now(), 0, 0, null, now())
    logEvent('card.created', { cardId: id, syllabusPoint: point, source: 'manual' }, USER, course.id)
    return jsonOk(res, cardView(get('SELECT * FROM cards WHERE id = ?', id), course), 201)
  })

  /** The counts the Cards screen reads, and the forecast for the next week. */
  router.get('/api/cards/stats', ({ res, query }) => {
    const course = resolveCourse(query)
    const rows = all('SELECT * FROM cards WHERE user_id = ? AND course_id = ?', USER, course.id)
    const nowIso = now()
    const today = new Date()
    const days = daysToExam(course.exam_date)
    const dueBy = iso => rows.filter(r => r.due <= iso).length

    const forecast = []
    for (let i = 0; i < 7; i++) {
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i + 1)).toISOString()
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i)).toISOString()
      forecast.push({
        date: start.slice(0, 10),
        due: rows.filter(r => (i === 0 ? r.due < end : r.due >= start && r.due < end)).length,
      })
    }

    const byPoint = new Map()
    for (const r of rows) {
      if (!byPoint.has(r.syllabus_point)) byPoint.set(r.syllabus_point, { code: r.syllabus_point, total: 0, due: 0 })
      const b = byPoint.get(r.syllabus_point)
      b.total += 1
      if (r.due <= nowIso) b.due += 1
    }
    const titles = new Map(all('SELECT code,title FROM syllabus WHERE pack = ?', course.syllabus).map(r => [r.code, r.title]))

    const reviews = all("SELECT data, created_at FROM events WHERE kind = 'card.review' AND course_id = ? ORDER BY created_at DESC LIMIT 500", course.id)
    const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString()
    const recent = reviews.filter(e => e.created_at >= weekAgo)
    const again = recent.filter(e => (e.data || '').includes('"again"')).length

    return jsonOk(res, {
      courseId: course.id,
      total: rows.length,
      due: dueBy(nowIso),
      new: rows.filter(r => !Number(r.reps)).length,
      learning: rows.filter(r => Number(r.reps) > 0 && Number(r.stability) < 7).length,
      mature: rows.filter(r => Number(r.stability) >= 21).length,
      lapses: rows.reduce((n, r) => n + (Number(r.lapses) || 0), 0),
      reviewsLast7: recent.length,
      againLast7: again,
      recallLast7: recent.length ? Math.round(((recent.length - again) / recent.length) * 100) : null,
      retentionTarget: round3(safeRetention(days)),
      daysToExam: days,
      nextDue: rows.length ? rows.map(r => r.due).sort()[0] : null,
      forecast,
      byPoint: [...byPoint.values()]
        .map(b => ({ ...b, title: titles.get(b.code) || b.code }))
        .sort((a, b) => b.due - a.due || b.total - a.total),
    })
  })
}

/* --------------------------------------------------------------------- shapes */

function cardView(r, course) {
  const overdueDays = Math.max(0, Math.round((Date.now() - new Date(r.due).getTime()) / DAY_MS))
  return {
    id: r.id,
    courseId: r.course_id,
    syllabusPoint: r.syllabus_point,
    front: r.front,
    back: r.back,
    source: r.source,
    provenance: provenanceLine(r),
    stability: round3(Number(r.stability) || 0),
    difficulty: round3(Number(r.difficulty) || 0),
    due: r.due,
    overdueDays,
    reps: Number(r.reps) || 0,
    lapses: Number(r.lapses) || 0,
    lastReview: r.last_review,
    createdAt: r.created_at,
    isNew: !Number(r.reps),
    isRetest: String(r.source || '').startsWith('retest:'),
    courseTitle: course?.title || null,
  }
}

/** Where the card came from, in a sentence the student can check. */
function provenanceLine(r) {
  const when = new Date(r.created_at)
  const date = Number.isNaN(when.getTime()) ? '' : when.toISOString().slice(0, 10)
  const src = String(r.source || '')
  if (src.startsWith('mark:')) return `From your mark on ${r.syllabus_point}, ${date}`
  if (src.startsWith('retest:')) return `Retest of a question you saw the solution to, ${date}`
  if (src === 'manual') return `You wrote this card, ${date}`
  return `From ${src || 'your course'}, ${date}`
}

/* --------------------------------------------------------------------- pieces */

function safeRetention(days) {
  try {
    const r = Number(desiredRetention(days == null ? 999 : days))
    if (Number.isFinite(r) && r > 0 && r < 1) return r
  } catch { /* fall through */ }
  return 0.9
}

function toIso(v) {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function num(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) ? n : (Number(fallback) || 0)
}

function round3(n) {
  return Math.round((Number(n) || 0) * 1000) / 1000
}

function clampInt(v, lo, hi) {
  const n = Number(v)
  if (!Number.isFinite(n)) return hi
  return Math.min(hi, Math.max(lo, Math.round(n)))
}
