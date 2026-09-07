/**
 * Courses: the list with its exam countdown and phase, the syllabus tree with mastery
 * per point, and a readiness figure per paper.
 *
 * One user, no auth (`u_demo`). The helpers exported here are the course-domain
 * vocabulary the other route files speak — importing them keeps one definition of
 * "what phase are we in" and "what does mastery 0.42 mean" in the API layer.
 */
import { all, get, run, now, uid, logEvent } from '../db.js'
import { json as sendJson, readJson } from '../http.js'
import { phaseFor } from '../engine/fsrs.js'
import { masteryState } from '../engine/markyield.js'
import { loadPack } from '../packs/seed.js'

/** One name for the two http helpers, so every route file imports them from here. */
export const jsonOk = (res, body, status = 200) => sendJson(res, body, status)
export const readBody = readJson
/** Trim a client-supplied string; anything else becomes ''. */
export const str = v => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())

/** The demo user. There is no sign-in; every row belongs to this id. */
export const USER = 'u_demo'
export const DAY_MS = 86400000

export const PHASE_LABEL = {
  A: 'More than eight weeks out',
  B: 'Three to eight weeks out',
  C: 'Inside three weeks',
}

/** Whole days from today to the paper, using date parts so a timestamp cannot shift it by one. */
export function daysToExam(examDate, from = new Date()) {
  if (!examDate) return null
  const exam = new Date(String(examDate).slice(0, 10) + 'T00:00:00Z')
  if (Number.isNaN(exam.getTime())) return null
  const today = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  return Math.round((exam.getTime() - today) / DAY_MS)
}

/** Phase letter for a course; a course with no exam date is treated as far out. */
export function phaseOf(course) {
  const d = daysToExam(course?.exam_date)
  return phaseFor(d == null ? 999 : d)
}

/** The mastery ladder lives with the ranking that reads it; re-exported for the API layer. */
export { masteryState }

/** Rule of thumb for Cambridge written papers: a little over a minute a mark, never under two. */
export function expectedMinutes(item) {
  return Math.max(2, Math.round((Number(item?.tariff) || 1) * 1.2))
}

export function mustCourse(id) {
  const c = get('SELECT * FROM courses WHERE id = ?', String(id))
  if (!c) throw Object.assign(new Error(`No course ${id}. Pick one from the course list.`), { status: 404 })
  return c
}

/**
 * Resolve the course a request is about: the `courseId` query parameter, or the
 * only course this user has. Missing entirely is a 404 that says what to do.
 */
export function resolveCourse(query) {
  const id = query?.get?.('courseId') || query?.courseId
  if (id) return mustCourse(id)
  const c = get('SELECT * FROM courses WHERE user_id = ? ORDER BY created_at LIMIT 1', USER)
  if (!c) throw Object.assign(new Error('No course yet. Create a course to begin.'), { status: 404 })
  return c
}

/** The course as the client reads it, with the countdown already worked out. */
export function courseView(c) {
  const days = daysToExam(c.exam_date)
  const phase = phaseOf(c)
  return {
    id: c.id,
    title: c.title,
    board: c.board,
    syllabus: c.syllabus,
    examDate: c.exam_date,
    targetGrade: c.target_grade,
    packVersion: c.pack_version,
    createdAt: c.created_at,
    daysToExam: days,
    weeksToExam: days == null ? null : Math.round((days / 7) * 10) / 10,
    phase,
    phaseLabel: PHASE_LABEL[phase] || PHASE_LABEL.A,
    countdown:
      days == null ? 'No exam date set'
        : days < 0 ? `${Math.abs(days)} days since the paper`
          : days === 0 ? 'Paper today'
            : `${days} days to the paper`,
    history: historyOf(c),
  }
}

/**
 * Every syllabus point in the course's pack, carrying this learner's state and the
 * items that sit on it. This is the row shape the ranking, the planner and the
 * progress screen all read.
 */
/**
 * Syllabus codes are dotted numbers, not words. Sorted as text, "10" lands between
 * "1" and "2" and the contents page reads 1, 10, 2, 3 — so they are compared segment
 * by segment, numerically where both sides are numbers.
 */
export function compareCode(a, b) {
  const left = String(a || '').split('.')
  const right = String(b || '').split('.')
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const x = left[i], y = right[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const nx = Number(x), ny = Number(y)
    if (Number.isFinite(nx) && Number.isFinite(ny)) { if (nx !== ny) return nx - ny }
    else if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

export function pointsWithState(course) {
  const pack = course.syllabus
  const rows = all('SELECT * FROM syllabus WHERE pack = ?', pack).sort((a, b) => compareCode(a.code, b.code))
  const state = all('SELECT * FROM learner_state WHERE user_id = ? AND course_id = ?', USER, course.id)
  const byPoint = new Map(state.map(s => [s.syllabus_point, s]))
  const counts = new Map(all(
    'SELECT syllabus_point AS p, COUNT(*) AS n, SUM(tariff) AS marks, MAX(tariff) AS top FROM items WHERE pack = ? GROUP BY syllabus_point',
    pack).map(r => [r.p, r]))
  const today = new Date()
  return rows.map(r => {
    const s = byPoint.get(r.code)
    const c = counts.get(r.code)
    const mastery = s ? Number(s.mastery) || 0 : 0
    const attempts = s ? Number(s.attempts) || 0 : 0
    const lastSeen = s?.last_seen || null
    const daysSince = lastSeen ? Math.max(0, Math.round((today - new Date(lastSeen)) / DAY_MS)) : null
    const unaidedMarks = s ? Number(s.unaided_marks) || 0 : 0
    const unaidedMax = s ? Number(s.unaided_max) || 0 : 0
    return {
      // identity — several aliases because the ranking engine reads points by name
      id: r.id,
      code: r.code,
      syllabus_point: r.code,
      title: r.title,
      paper: r.paper,
      parent: r.parent || null,
      weight: Number(r.weight) || 1,
      // learner state
      mastery,
      attempts,
      unaidedMarks,
      unaidedMax,
      unaided_marks: unaidedMarks,
      unaided_max: unaidedMax,
      unaidedRate: unaidedMax > 0 ? unaidedMarks / unaidedMax : null,
      misconceptions: safeJson(s?.misconceptions, []),
      lastSeen,
      last_seen: lastSeen,
      daysSince,
      daysSinceSeen: daysSince == null ? 999 : daysSince,
      neverAttempted: attempts === 0,
      state: masteryState(mastery, attempts),
      // items on this point
      itemCount: c ? Number(c.n) || 0 : 0,
      marksAvailable: c ? Number(c.marks) || 0 : 0,
      topTariff: c ? Number(c.top) || 0 : 0,
      // What this topic is worth when it comes up — the biggest question set on it.
      // Without this the ranker fell back to one constant for every point, so a
      // 20-mark essay topic and a 2-mark definition scored the same marks on offer.
      marksOnOffer: c ? Number(c.top) || 0 : 0,
      minutes: c ? Math.max(3, Math.round((Number(c.top) || 4) * 1.2)) : 5,
    }
  })
}

/**
 * Readiness for one paper is the weight-weighted mean mastery of its points. The
 * sample size is reported beside it and never folded into it: a readiness figure
 * from four attempts is not the same claim as one from forty.
 */
/**
 * How much of the record on this course the learner actually made.
 *
 * The demo course ships a study history so the app is not empty on first run. That
 * history feeds readiness, and readiness is a claim about evidence — so where the
 * state asserts more attempts than this course has actually stored, the interface
 * says so rather than presenting borrowed numbers as the student's own work.
 */
export function historyOf(course) {
  const claimed = Number(get(
    'SELECT COALESCE(SUM(attempts), 0) AS n FROM learner_state WHERE user_id = ? AND course_id = ?',
    USER, course.id)?.n) || 0
  const yours = Number(get(
    'SELECT COUNT(*) AS n FROM attempts WHERE user_id = ? AND course_id = ?',
    USER, course.id)?.n) || 0
  const sample = Math.max(0, claimed - yours)
  return {
    claimed,
    yours,
    sample,
    // One attempt of slack: rounding in the state should not raise a banner.
    borrowed: sample > 1,
    line: sample > 1
      ? `Readiness includes a sample study history that came with this demo course. ${yours} of these ${claimed} attempts ${yours === 1 ? 'is' : 'are'} yours.`
      : null,
  }
}

export function readinessByPaper(points) {
  const byPaper = new Map()
  for (const p of points) {
    const key = p.paper || 'Paper'
    if (!byPaper.has(key)) byPaper.set(key, { paper: key, sumW: 0, sumWM: 0, pointCount: 0, attempts: 0, unaidedMarks: 0, unaidedMax: 0, seen: 0 })
    const b = byPaper.get(key)
    b.sumW += p.weight
    b.sumWM += p.weight * p.mastery
    b.pointCount += 1
    b.attempts += p.attempts
    b.unaidedMarks += p.unaidedMarks
    b.unaidedMax += p.unaidedMax
    if (p.attempts > 0) b.seen += 1
  }
  return [...byPaper.values()].map(b => ({
    paper: b.paper,
    readiness: b.sumW ? Math.round((b.sumWM / b.sumW) * 1000) / 1000 : 0,
    pointCount: b.pointCount,
    pointsSeen: b.seen,
    sampleSize: b.attempts,
    unaidedMarks: Math.round(b.unaidedMarks * 10) / 10,
    unaidedMax: Math.round(b.unaidedMax * 10) / 10,
    unaidedRate: b.unaidedMax > 0 ? Math.round((b.unaidedMarks / b.unaidedMax) * 1000) / 1000 : null,
    evidence: b.attempts >= 12 ? 'sufficient' : b.attempts >= 4 ? 'thin' : 'insufficient',
  })).sort((a, b) => String(a.paper).localeCompare(String(b.paper)))
}

/** Nest the flat point list by `parent`, which packs may write as a code or as a row id. */
export function nestPoints(points) {
  const byCode = new Map(points.map(p => [p.code, p]))
  const byId = new Map(points.map(p => [p.id, p]))
  const nodes = new Map(points.map(p => [p.code, { ...p, children: [] }]))
  const roots = []
  for (const p of points) {
    const parent = p.parent && (byCode.get(p.parent) || byId.get(p.parent))
    if (parent && parent.code !== p.code) nodes.get(parent.code).children.push(nodes.get(p.code))
    else roots.push(nodes.get(p.code))
  }
  const order = (list) => { list.sort((a, b) => compareCode(a.code, b.code)); list.forEach(n => order(n.children)) }
  order(roots)
  return roots
}

export function safeJson(text, fallback) {
  if (text == null) return fallback
  try { return JSON.parse(text) } catch { return fallback }
}

/** The misconception library for a pack — pack data, not a database table. */
export function misconceptionsFor(pack, syllabusPoint) {
  let data = null
  try { data = loadPack(pack) } catch { return [] }
  const list = Array.isArray(data?.misconceptions) ? data.misconceptions : []
  if (!syllabusPoint) return list
  return list.filter(m => m?.syllabus_point === syllabusPoint || m?.syllabusPoint === syllabusPoint)
}

export default function register(router) {
  /** Every course with its countdown, phase and pack version. */
  router.get('/api/courses', ({ res }) => {
    const rows = all('SELECT * FROM courses WHERE user_id = ? ORDER BY created_at', USER)
    return jsonOk(res, rows.map(courseView))
  })

  /** One course: the syllabus tree with mastery per point, readiness per paper. */
  router.get('/api/courses/:id', ({ res, params }) => {
    const course = mustCourse(params.id)
    const points = pointsWithState(course)
    return jsonOk(res, {
      course: courseView(course),
      papers: readinessByPaper(points),
      tree: nestPoints(points),
      points,
      counts: {
        points: points.length,
        pointsSeen: points.filter(p => p.attempts > 0).length,
        items: points.reduce((n, p) => n + p.itemCount, 0),
        marksAvailable: points.reduce((n, p) => n + p.marksAvailable, 0),
      },
    })
  })

  /** Create a course. Board and pack version default to the seeded pack's. */
  router.post('/api/courses', async ({ req, res }) => {
    const body = await readBody(req)
    const title = str(body.title)
    const syllabus = str(body.syllabus)
    if (!title) throw Object.assign(new Error('Give the course a title.'), { status: 400 })
    if (!syllabus) throw Object.assign(new Error('Give the syllabus code, for example 9609.'), { status: 400 })
    if (body.examDate && Number.isNaN(new Date(String(body.examDate)).getTime())) {
      throw Object.assign(new Error('The exam date is not a date. Use YYYY-MM-DD.'), { status: 400 })
    }
    let packVersion = str(body.packVersion)
    if (!packVersion) {
      try { packVersion = String(loadPack(syllabus)?.version || 'unversioned') } catch { packVersion = 'unversioned' }
    }
    const id = uid('c')
    run(
      'INSERT INTO courses (id,user_id,board,syllabus,title,exam_date,target_grade,pack_version,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      id, USER, str(body.board) || 'Cambridge International', syllabus, title,
      body.examDate ? String(body.examDate).slice(0, 10) : null,
      str(body.targetGrade) || null, packVersion, now())
    logEvent('course.created', { title, syllabus }, USER, id)
    return jsonOk(res, courseView(mustCourse(id)), 201)
  })

  /**
   * What this account has actually spent — turns taken, answers marked, dollars.
   * The top bar reads it on every load; without it the meter shows zero however
   * much work has been done, which reads as "nothing here is real".
   */
  router.get('/api/usage', ({ res, query }) => {
    const course = query.courseId ? mustCourse(query.courseId) : null
    const scope = course ? ' AND course_id = ?' : ''
    const args = course ? [USER, course.id] : [USER]
    const turns = get(`SELECT COUNT(*) AS n, COALESCE(SUM(cost), 0) AS cost FROM turns WHERE role = 'tutor'${course ? ' AND course_id = ?' : ''}`,
      ...(course ? [course.id] : []))
    const marks = get(`SELECT COUNT(*) AS n FROM marks WHERE 1 = 1${course ? ' AND course_id = ?' : ''}`,
      ...(course ? [course.id] : []))
    const cards = get(`SELECT COUNT(*) AS n FROM cards WHERE user_id = ?${scope}`, ...args)
    const first = get(`SELECT MIN(created_at) AS at FROM turns WHERE 1 = 1${course ? ' AND course_id = ?' : ''}`,
      ...(course ? [course.id] : []))
    return jsonOk(res, {
      turns: Number(turns?.n) || 0,
      marks: Number(marks?.n) || 0,
      cards: Number(cards?.n) || 0,
      // Rounded to the cent the meter prints, not to a float that renders as 0.30000000000000004.
      cost_usd: Math.round((Number(turns?.cost) || 0) * 10000) / 10000,
      since: first?.at || null,
    })
  })

  /** The syllabus for a course, flat and nested, with mastery on every point. */
  router.get('/api/syllabus/:courseId', ({ res, params }) => {
    const course = mustCourse(params.courseId)
    const points = pointsWithState(course)
    return jsonOk(res, {
      courseId: course.id,
      pack: course.syllabus,
      packVersion: course.pack_version,
      points,
      tree: nestPoints(points),
      papers: readinessByPaper(points),
    })
  })
}
