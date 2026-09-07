/**
 * The plan and the progress figures.
 *
 * Today's session is composed by the scheduler, not by the student, and the split
 * between retrieval, practice, new material and timed work changes with the phase of
 * the nearest paper (§04.13). Every block names the items it holds and the reason it
 * was chosen; a block the student cannot see the reason for is a block they will not
 * trust.
 *
 * Progress reports what the record supports and says when it does not support
 * anything: an unaided-mark-gain figure from three attempts is not a figure.
 */
import { all, get } from '../db.js'
import {
  USER, jsonOk, resolveCourse, courseView, pointsWithState, readinessByPaper,
  daysToExam, phaseOf, DAY_MS,
} from './courses.js'
import { rankedPoints, itemsForPoint, itemView } from './practise.js'
import { phaseFor } from '../engine/fsrs.js'

/**
 * The phase mix (§04.13). Shares of one session's minutes.
 * A: >8 weeks · B: 3–8 weeks · C: inside 3 weeks, where new material stops and
 * retrieval is exam-critical only.
 */
export const PHASE_MIX = {
  A: { due: 0.60, practise: 0.25, new: 0.15, timed: 0 },
  B: { due: 0.50, practise: 0.35, new: 0.15, timed: 0 },
  C: { due: 0.40, practise: 0, new: 0, timed: 0.60 },
}

/** Session length (04-MIX-001): 12–25 minutes on a weekday, 25–45 at the weekend. */
const WEEKDAY_MINUTES = 20
const WEEKEND_MINUTES = 35
/** The window the unaided-gain figure is computed over, and the one it compares to. */
const UMG_WINDOW_DAYS = 28
/** Below this many unaided marks in the window, no figure is reported at all. */
const UMG_MIN_SAMPLE = 5
/** Below this many rated attempts, no calibration curve is drawn (04-CALB-005). */
const CALIBRATION_MIN = 25

export default function register(router) {
  /** Today's session: the blocks, their items, and why each one is there. */
  router.get('/api/plan/today', ({ res, query }) => {
    const course = resolveCourse(query)
    const at = new Date()
    const plan = composeDay(course, at, { deep: true })
    const goal = weeklyGoal(course)
    return jsonOk(res, {
      courseId: course.id,
      course: courseView(course),
      ...plan,
      goal,
      quietHours: quietHours(at),
    })
  })

  /** The next seven days: the shape of each, with rest days built in. */
  router.get('/api/plan/week', ({ res, query }) => {
    const course = resolveCourse(query)
    const start = new Date()
    const cards = all('SELECT due FROM cards WHERE user_id = ? AND course_id = ?', USER, course.id)
    const days = []
    for (let i = 0; i < 7; i++) {
      const at = new Date(start.getTime() + i * DAY_MS)
      const dayStart = startOfDay(at)
      const dayEnd = new Date(dayStart.getTime() + DAY_MS)
      const due = cards.filter(c => new Date(c.due) < dayEnd && (i === 0 || new Date(c.due) >= dayStart)).length
      const plan = composeDay(course, at, { deep: false })
      days.push({
        date: dayStart.toISOString().slice(0, 10),
        weekday: WEEKDAYS[dayStart.getDay()],
        weekend: isWeekend(dayStart),
        phase: plan.phase,
        daysToExam: plan.daysToExam,
        minutes: plan.minutes,
        mix: plan.mix,
        timed: plan.blocks.some(b => b.kind === 'timed'),
        dueForecast: due,
        focus: plan.blocks.flatMap(b => b.points || []).slice(0, 3),
      })
    }
    // Two rest days a week, chosen where the least is due — but never inside the
    // last three weeks, where every day carries a paper's worth of work.
    const phase = phaseOf(course)
    if (phase !== 'C') {
      const candidates = days.slice(1).sort((a, b) => a.dueForecast - b.dueForecast).slice(0, 2)
      for (const d of candidates) { d.rest = true; d.minutes = 0 }
    }
    for (const d of days) if (d.rest == null) d.rest = false
    return jsonOk(res, {
      courseId: course.id,
      phase,
      daysToExam: daysToExam(course.exam_date),
      days,
      note: phase === 'C'
        ? 'Inside three weeks: timed sections and the retrieval that follows them. No new material.'
        : 'Two rest days are part of the week, not a failure of it.',
    })
  })

  /** Mastery, readiness, the unaided gain figure, and calibration. */
  router.get('/api/progress', ({ res, query }) => {
    const course = resolveCourse(query)
    const points = pointsWithState(course)
    const papers = readinessByPaper(points)
    const marks = markRecord(course)
    return jsonOk(res, {
      courseId: course.id,
      course: courseView(course),
      masteryByPoint: points.map(p => ({
        code: p.code, title: p.title, paper: p.paper, weight: p.weight,
        mastery: Math.round(p.mastery * 1000) / 1000, state: p.state,
        attempts: p.attempts, unaidedMarks: p.unaidedMarks, unaidedMax: p.unaidedMax,
        unaidedRate: p.unaidedRate == null ? null : Math.round(p.unaidedRate * 1000) / 1000,
        lastSeen: p.lastSeen, daysSince: p.daysSince, itemCount: p.itemCount,
      })),
      readiness: papers,
      unaidedGain: unaidedGainPerHour(course, marks, points),
      calibration: calibration(marks),
      totals: {
        attempts: marks.length,
        unaidedAttempts: marks.filter(m => m.unaided).length,
        marksTaken: marks.length,
        pointsSeen: points.filter(p => p.attempts > 0).length,
        points: points.length,
      },
    })
  })
}

/* ------------------------------------------------------------- the day's plan */

function composeDay(course, at, { deep }) {
  const days = daysToExam(course.exam_date, at)
  const phaseKey = phaseFor(days == null ? 999 : days)
  const phase = PHASE_MIX[phaseKey] ? phaseKey : 'A'
  const minutes = isWeekend(at) ? WEEKEND_MINUTES : WEEKDAY_MINUTES
  const mix = { ...PHASE_MIX[phase] }
  // Phase B carries one timed section a week; it takes its minutes from practice
  // rather than being added on top (04-MIX-001).
  const timedToday = phase === 'C' || (phase === 'B' && at.getDay() === 6)
  if (phase === 'B' && timedToday) { mix.timed = mix.practise; mix.practise = 0 }

  const blocks = []
  const dueCards = all(
    'SELECT * FROM cards WHERE user_id = ? AND course_id = ? AND due <= ? ORDER BY due LIMIT 80',
    USER, course.id, at.toISOString())
  const dueMinutes = Math.round(minutes * mix.due)
  if (dueCards.length) {
    blocks.push({
      kind: 'due',
      title: 'Due retrieval',
      minutes: dueMinutes,
      count: Math.min(dueCards.length, Math.max(4, dueMinutes * 3)),
      reason: phase === 'C'
        ? `${dueCards.length} cards are due and every one is exam-critical this close to the paper.`
        : `${dueCards.length} cards are due. Retrieval first: it is the part that decays.`,
      points: [...new Set(dueCards.map(c => c.syllabus_point))].slice(0, 6),
      cardIds: dueCards.slice(0, 40).map(c => c.id),
    })
  }

  const ranked = deep ? rankedPoints(course) : rankedPoints(course).slice(0, 8)
  const used = new Set()

  // Every session contains one marked exam-style item at real tariff (04-MIX-001).
  // It is chosen first, so it gets the highest-yield question, and its minutes come
  // out of the session rather than being added on top of it.
  const marked = pickMarkedItem(course, ranked, at, used)
  const markedMinutes = marked ? Math.max(4, marked.item.expectedMinutes) : 0
  const practiseMinutes = Math.round(minutes * mix.practise)
  const timedMinutes = Math.round(minutes * mix.timed)

  if (practiseMinutes > 0) {
    // Interleaved practice is for topics already met; on a course with nothing behind
    // it, the ranking's own order fills the block rather than leaving it empty.
    const met = ranked.filter(r => r.point.attempts > 0)
    const pool = met.length ? [...met, ...ranked.filter(r => !r.point.attempts)] : ranked
    const chosen = takeItems(course, pool, practiseMinutes, used)
    if (chosen.items.length) {
      blocks.push({
        kind: 'practise',
        title: 'Interleaved practice',
        minutes: practiseMinutes,
        reason: chosen.reasons[0] || 'The topics with the most marks still on the table.',
        reasons: chosen.reasons,
        points: chosen.points,
        items: chosen.items,
      })
    }
  }

  const newMinutes = Math.round(minutes * mix.new)
  if (newMinutes > 0) {
    const fresh = ranked.filter(r => r.point.attempts === 0)
    const chosen = takeItems(course, fresh, newMinutes, used)
    if (chosen.items.length) {
      blocks.push({
        kind: 'new',
        title: 'New material',
        minutes: newMinutes,
        reason: chosen.reasons[0] || 'A syllabus point you have not attempted yet.',
        reasons: chosen.reasons,
        points: chosen.points,
        items: chosen.items,
      })
    }
  }

  if (timedMinutes > 0) {
    const chosen = takeItems(course, ranked, timedMinutes, used, { minTariff: 6 })
    if (chosen.items.length) {
      blocks.push({
        kind: 'timed',
        title: 'Timed section',
        minutes: timedMinutes,
        timed: true,
        reason: phase === 'C'
          ? 'Inside three weeks the constraint is the clock, not the content. Write this against the time.'
          : 'One timed section a week keeps the pacing honest.',
        reasons: chosen.reasons,
        points: chosen.points,
        items: chosen.items,
      })
    }
  }

  if (marked) {
    blocks.push({
      kind: 'marked',
      title: 'One question, marked',
      minutes: markedMinutes,
      reason: marked.reason,
      points: [marked.item.syllabusPoint],
      items: [marked.item],
    })
  }

  // Retrieval absorbs the difference in both directions: minutes a block could not
  // fill come back to it, and a marked question that runs long is paid for out of it.
  // The session keeps the length it was planned at.
  // New material is capped by the phase, so it never absorbs slack; retrieval, timed
  // work and practice do, in that order.
  const spent = blocks.reduce((n, b) => n + b.minutes, 0)
  const sink = ['due', 'timed', 'practise'].map(k => blocks.find(b => b.kind === k)).find(Boolean)
  if (sink && spent !== minutes) {
    sink.minutes = Math.max(2, sink.minutes + (minutes - spent))
    if (sink.kind === 'due') sink.count = Math.min(dueCards.length, Math.max(4, sink.minutes * 3))
  }
  const total = blocks.reduce((n, b) => n + b.minutes, 0)

  // A block names its topics, not their codes. "3.2 · 1.5 · 9.3" tells a student
  // nothing; "Marketing mix · Business structure" tells them what the next 20
  // minutes are about. The codes stay on the object for anything that indexes by them.
  const titleOf = new Map(pointsWithState(course).map(p => [p.code, p.title]))
  for (const block of blocks) {
    block.topics = (block.points || []).map(code => ({ code, title: titleOf.get(code) || code }))
  }

  return {
    date: startOfDay(at).toISOString().slice(0, 10),
    phase,
    phaseNote: PHASE_NOTE[phase],
    daysToExam: days,
    minutes: total,
    plannedMinutes: minutes,
    shortfall: Math.max(0, minutes - total),
    shortfallNote: total < minutes
      ? 'Nothing else is due and the pack has no more questions on the topics that matter now, so today is shorter than planned.'
      : null,
    mix,
    blocks,
  }
}

const PHASE_NOTE = {
  A: 'More than eight weeks out: most of the session is retrieval, a quarter is interleaved practice, a little is new.',
  B: 'Three to eight weeks out: retrieval and practice, with one timed section a week.',
  C: 'Inside three weeks: timed work and the retrieval that comes out of it. No new material.',
}

/** Fill a block's minutes from the ranked points, without repeating an item. */
function takeItems(course, ranked, minutes, used, { minTariff = 0 } = {}) {
  const items = []
  const reasons = []
  const points = []
  let spent = 0
  for (const entry of ranked) {
    if (spent >= minutes) break
    const candidates = itemsForPoint(course, entry.point.code)
      .filter(i => !used.has(i.id) && i.tariff >= minTariff)
    if (!candidates.length) continue
    // Interleave: never two of the same kind in a row inside one block (04-MIX-002).
    const lastKind = items.length ? items[items.length - 1].kind : null
    const pickFrom = candidates.filter(i => i.kind !== lastKind)
    const item = (pickFrom.length ? pickFrom : candidates)[0]
    const view = itemView(item)
    used.add(item.id)
    items.push(view)
    reasons.push(entry.reason)
    points.push(entry.point.code)
    spent += view.expectedMinutes
  }
  return { items, reasons, points }
}

/**
 * The marked question: 2–5 marks on a weekday, 8–12 once or twice a week, and a
 * 20-marker weekly once the paper is inside eight weeks on a levels course.
 */
function pickMarkedItem(course, ranked, at, used) {
  const days = daysToExam(course.exam_date, at)
  const weekend = isWeekend(at)
  const sunday = at.getDay() === 0
  let lo = 2, hi = 5
  if (weekend) { lo = 8; hi = 12 }
  if (sunday && days != null && days <= 56) { lo = 12; hi = 20 }
  // Points already attempted come first: the marked question is meant to measure
  // something the student has met, and it leaves the fresh points for new material.
  const order = [...ranked.filter(r => r.point.attempts > 0), ...ranked.filter(r => !r.point.attempts)]
  for (const entry of order) {
    const candidates = itemsForPoint(course, entry.point.code)
      .filter(i => !used.has(i.id) && i.tariff >= lo && i.tariff <= hi)
    if (!candidates.length) continue
    used.add(candidates[0].id)
    return {
      item: itemView(candidates[0]),
      reason: `${entry.reason} Marked at full tariff, because a mark you have not been given is a mark you cannot check.`,
    }
  }
  return null
}

/* --------------------------------------------------------------- weekly goal */

/**
 * The weekly goal is learning events, not minutes and never a streak. It is the
 * median of the last three weeks, floored at three, capped at five so two rest days
 * survive — and it is never raised in the week after a missed one (04-MOTV-005).
 */
function weeklyGoal(course) {
  const since = new Date(Date.now() - 28 * DAY_MS).toISOString()
  const days = new Set()
  const weeks = [0, 0, 0]
  const attempts = all('SELECT created_at FROM attempts WHERE user_id = ? AND course_id = ? AND created_at > ?', USER, course.id, since)
  const reviews = all("SELECT created_at FROM events WHERE kind = 'card.review' AND course_id = ? AND created_at > ?", course.id, since)
  const thisWeekStart = startOfWeek(new Date())
  const seen = new Set()
  for (const r of [...attempts, ...reviews]) {
    const d = new Date(r.created_at)
    const key = d.toISOString().slice(0, 10)
    if (d >= thisWeekStart) { days.add(key); continue }
    const back = Math.floor((thisWeekStart - startOfWeek(d)) / (7 * DAY_MS))
    if (back >= 1 && back <= 3 && !seen.has(back + key)) { weeks[back - 1] += 1; seen.add(back + key) }
  }
  const history = weeks.filter(w => w > 0).sort((a, b) => a - b)
  const median = history.length ? history[Math.floor(history.length / 2)] : 5
  const lastWeek = weeks[0]
  const target = history.length && lastWeek < median
    ? Math.max(3, lastWeek) // never raised in the week after a miss
    : Math.max(3, Math.min(5, median))
  return {
    target,
    done: days.size,
    restDays: 2,
    unit: 'sessions',
    line: `Last week: ${lastWeek} session${lastWeek === 1 ? '' : 's'}. This week: ${days.size} of ${target}.`,
  }
}

function quietHours(at) {
  const hour = at.getHours()
  const quiet = hour >= 22 || hour < 6
  return {
    from: '22:00',
    to: '06:00',
    quiet,
    line: quiet
      ? 'It is after ten. Sleep consolidates what you did today; a short card review is the most this hour is worth.'
      : null,
  }
}

/* ------------------------------------------------------------------- progress */

/** Every mark with the attempt behind it, so aided and unaided can be told apart. */
function markRecord(course) {
  const rows = all(`SELECT m.id, m.total, m.max, m.created_at, i.paper, i.syllabus_point AS point, i.tariff,
                           a.seen_solution, a.max_rung, a.seconds, a.confidence, a.mode
                    FROM marks m
                    JOIN attempts a ON a.id = m.attempt_id
                    JOIN items i ON i.id = m.item_id
                    WHERE m.course_id = ?
                    ORDER BY m.created_at`, course.id)
  return rows.map(r => ({
    id: r.id,
    total: Number(r.total) || 0,
    max: Number(r.max) || 0,
    at: r.created_at,
    paper: r.paper,
    point: r.point,
    tariff: Number(r.tariff) || 0,
    seconds: Number(r.seconds) || 0,
    confidence: r.confidence == null ? null : Number(r.confidence),
    mode: r.mode,
    unaided: !Number(r.seen_solution) && (Number(r.max_rung) || 0) <= 3,
  }))
}

/**
 * Unaided mark gain per hour: the change in the unaided component-mark estimate over
 * the last four weeks, divided by the hours studied in them. Reported with its sample
 * size, and withheld entirely below five unaided marks in the window — a figure from
 * three answers is noise wearing a decimal point (04-NSTR-005).
 */
function unaidedGainPerHour(course, marks, points) {
  const nowMs = Date.now()
  const windowStart = nowMs - UMG_WINDOW_DAYS * DAY_MS
  const priorStart = nowMs - 2 * UMG_WINDOW_DAYS * DAY_MS
  const inWindow = marks.filter(m => m.unaided && new Date(m.at).getTime() >= windowStart)
  const before = marks.filter(m => m.unaided && new Date(m.at).getTime() >= priorStart && new Date(m.at).getTime() < windowStart)

  const paperMarks = new Map()
  for (const p of points) paperMarks.set(p.paper, (paperMarks.get(p.paper) || 0) + p.marksAvailable)

  const estimate = list => {
    const byPaper = new Map()
    for (const m of list) {
      if (!byPaper.has(m.paper)) byPaper.set(m.paper, { total: 0, max: 0 })
      const b = byPaper.get(m.paper)
      b.total += m.total
      b.max += m.max
    }
    let sum = 0
    for (const [paper, b] of byPaper) {
      if (b.max <= 0) continue
      sum += (b.total / b.max) * (paperMarks.get(paper) || 0)
    }
    return sum
  }

  const seconds = Number(get(
    'SELECT SUM(seconds) AS s FROM attempts WHERE user_id = ? AND course_id = ? AND created_at > ?',
    USER, course.id, new Date(windowStart).toISOString())?.s || 0)
  const reviews = Number(get(
    "SELECT COUNT(*) AS n FROM events WHERE kind = 'card.review' AND course_id = ? AND created_at > ?",
    course.id, new Date(windowStart).toISOString())?.n || 0)
  // Card reviews are study time too, at the twenty seconds a two-button review takes.
  const hours = (seconds + reviews * 20) / 3600

  if (inWindow.length < UMG_MIN_SAMPLE || hours < 0.25) {
    return {
      value: null,
      sampleSize: inWindow.length,
      hours: Math.round(hours * 10) / 10,
      windowDays: UMG_WINDOW_DAYS,
      note: `Not enough unaided evidence yet: ${inWindow.length} unaided mark${inWindow.length === 1 ? '' : 's'} in ${UMG_WINDOW_DAYS} days. The figure appears at ${UMG_MIN_SAMPLE}.`,
    }
  }
  const gain = estimate(inWindow) - (before.length ? estimate(before) : 0)
  const value = gain / hours
  return {
    value: Math.round(value * 100) / 100,
    gainMarks: Math.round(gain * 10) / 10,
    hours: Math.round(hours * 10) / 10,
    sampleSize: inWindow.length,
    comparedWith: before.length,
    windowDays: UMG_WINDOW_DAYS,
    note: before.length
      ? `${inWindow.length} unaided marks over ${Math.round(hours * 10) / 10} hours, against the ${before.length} in the four weeks before.`
      : `${inWindow.length} unaided marks over ${Math.round(hours * 10) / 10} hours. There is no earlier window to compare with yet, so this is a level, not a gain.`,
  }
}

/**
 * Predicted against actual. Confidence is recorded 0–100 on the attempt; the bands
 * are twenties. No curve is drawn below twenty-five rated attempts — a shape drawn
 * from nine points is a shape the student will read as a fact (04-CALB-005).
 */
function calibration(marks) {
  const rated = marks.filter(m => m.confidence != null && m.max > 0)
  const bands = [[0, 20], [20, 40], [40, 60], [60, 80], [80, 101]]
  if (rated.length < CALIBRATION_MIN) {
    return {
      points: [],
      n: rated.length,
      minimum: CALIBRATION_MIN,
      note: `${rated.length} answer${rated.length === 1 ? '' : 's'} so far with a confidence on them. The calibration curve appears at ${CALIBRATION_MIN}.`,
      signedError: null,
      verdict: null,
    }
  }
  const series = bands.map(([lo, hi]) => {
    const inBand = rated.filter(m => m.confidence >= lo && m.confidence < hi)
    return {
      band: `${lo}–${Math.min(100, hi - 1)}`,
      predicted: inBand.length ? mean(inBand.map(m => m.confidence / 100)) : null,
      actual: inBand.length ? mean(inBand.map(m => m.total / m.max)) : null,
      n: inBand.length,
    }
  }).filter(p => p.n > 0)
  const predicted = mean(rated.map(m => m.confidence / 100))
  const actual = mean(rated.map(m => m.total / m.max))
  const signed = predicted - actual
  return {
    points: series.map(p => ({
      band: p.band,
      predicted: round3(p.predicted),
      actual: round3(p.actual),
      n: p.n,
    })),
    n: rated.length,
    minimum: CALIBRATION_MIN,
    meanPredicted: round3(predicted),
    meanActual: round3(actual),
    signedError: round3(signed),
    verdict: signed >= 0.1 ? 'overconfident' : signed <= -0.1 ? 'underconfident' : 'calibrated',
    note: signed >= 0.1
      ? `You expect ${Math.round(predicted * 100)}% and score ${Math.round(actual * 100)}%. The gap is where the revision goes.`
      : signed <= -0.1
        ? `You expect ${Math.round(predicted * 100)}% and score ${Math.round(actual * 100)}%. Trust the method — this costs you marks you have already earned.`
        : `You expect ${Math.round(predicted * 100)}% and score ${Math.round(actual * 100)}%. Your sense of your own work is accurate.`,
  }
}

/* --------------------------------------------------------------------- pieces */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function isWeekend(d) {
  const day = d.getDay()
  return day === 0 || day === 6
}

function startOfDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** Weeks start on Monday. */
function startOfWeek(d) {
  const s = startOfDay(d)
  const shift = (s.getUTCDay() + 6) % 7
  return new Date(s.getTime() - shift * DAY_MS)
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

function round3(n) {
  return n == null ? null : Math.round(n * 1000) / 1000
}
