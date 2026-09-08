/**
 * Marking. An answer goes in, a Mark comes out, and the Mark is stored whole so it
 * can be re-rendered, challenged and audited later.
 *
 * The rule this file exists to enforce: **mastery moves on unaided marks only**. An
 * answer that climbed to rung 4 or 5, or that followed a seen solution, is marked in
 * full and told in full — and it does not raise the mastery figure. The response says
 * so in words, because a number that quietly counted scaffolded work would make every
 * other figure in the product a lie.
 */
import { all, get, run, now, uid, logEvent } from '../db.js'
import { pick } from '../providers/router.js'
import { parseScheme, maxMarks } from '../marking/scheme.js'
import { mark as runMarker } from '../marking/marker.js'
import { renderMark, summaryLine } from '../marking/render.js'
import {
  USER, jsonOk, readBody, str, mustCourse, resolveCourse, safeJson,
} from './courses.js'
import { touchPoint, itemView } from './practise.js'

/** Student answers carry personal data, so DeepSeek is never eligible (§08.8). */
export const MARK_POLICY = { residency: 'global', containsPii: true, deepseekAllowed: false }

/** Mastery cannot move above this in one mark, however good the answer. */
const MAX_STEP = 0.5
/** At most this many cards are made from one Mark; a wall of cards is not feedback. */
const MAX_CARDS = 4

export default function register(router) {
  /** Mark an attempt, or mark an answer and record the attempt behind it. */
  router.post('/api/mark', async ({ req, res }) => {
    return jsonOk(res, await markAnswer(await readBody(req)), 201)
  })

  /** One stored Mark, re-rendered from the object that was saved. */
  router.get('/api/marks/:id', ({ res, params }) => {
    const row = mustMark(params.id)
    const item = get('SELECT * FROM items WHERE id = ?', row.item_id)
    const course = get('SELECT * FROM courses WHERE id = ?', row.course_id)
    // A stored Mark is re-rendered even if the pack has moved on and the scheme is
    // gone: the numbers were decided when it was made, not now.
    let scheme = null
    try { scheme = item ? mustScheme(item) : null } catch { scheme = null }
    const markObj = safeJson(row.body, null)
    if (!markObj) throw Object.assign(new Error('That mark cannot be read back. Mark the answer again.'), { status: 500 })
    return jsonOk(res, markPayload({ row, mark: markObj, item, scheme, course }))
  })

  /**
   * Challenge a Mark (§05.7). A second marker — a different provider where one is
   * configured, otherwise the same one under an independent second-marker instruction
   * — re-marks the same answer against the same scheme, and both are returned side by
   * side with the difference per assessment objective.
   */
  router.post('/api/marks/:id/challenge', async ({ req, res, params }) => {
    const body = await readBody(req).catch(() => ({}))
    const row = mustMark(params.id)
    const item = get('SELECT * FROM items WHERE id = ?', row.item_id)
    const course = get('SELECT * FROM courses WHERE id = ?', row.course_id)
    const attempt = get('SELECT * FROM attempts WHERE id = ?', row.attempt_id)
    if (!item || !attempt) throw Object.assign(new Error('The original answer is no longer on file, so it cannot be re-marked.'), { status: 409 })
    const scheme = mustScheme(item)
    const original = safeJson(row.body, null)

    // One challenge per stage. A repeat returns the comparison already made rather
    // than spending a second mark on the same question.
    const priorData = all("SELECT data FROM events WHERE kind = 'mark.challenged' ORDER BY created_at DESC LIMIT 200")
      .map(e => safeJson(e.data, {}))
      .find(d => d.markId === row.id)
    if (priorData) {
      const second = priorData.remarkId ? get('SELECT * FROM marks WHERE id = ?', priorData.remarkId) : null
      if (second) {
        return jsonOk(res, comparison({
          row, original, second, item, scheme, course,
          reason: str(priorData.reason), alreadyChallenged: true,
        }))
      }
    }

    const first = pick(taskClassFor(item, scheme), MARK_POLICY)
    const alt = pick(taskClassFor(item, scheme), { ...MARK_POLICY, allowedProviders: otherProviders(first.provider.name) })
    const provider = alt.provider.name === first.provider.name ? secondMarker(alt.provider) : alt.provider

    const remark = await runMarker({
      item, scheme, answer: str(attempt.body), provider, model: alt.model,
      effort: alt.effort, budgetMs: alt.budgetMs, attemptId: attempt.id,
      policy: MARK_POLICY, degraded: alt.degraded,
    })
    if (!remark || typeof remark !== 'object') {
      throw Object.assign(new Error('The second marker returned nothing. Try the challenge again.'), { status: 502 })
    }
    const stored = storeMark({
      mark: { ...remark, challengeOf: row.id }, attempt, item, course, scheme, model: alt.model,
    })

    const cmp = comparison({
      row, original, second: stored.row, item, scheme, course,
      reason: str(body.reason), alreadyChallenged: false,
    })

    // A revised total is applied to the unaided record so the standing mark and the
    // learner state agree. Levels and rationales are never averaged.
    if (cmp.outcome === 'revised' && isUnaided(attempt)) {
      const delta = stored.total - Number(row.total)
      run('UPDATE learner_state SET unaided_marks = MAX(0, unaided_marks + ?) WHERE user_id = ? AND course_id = ? AND syllabus_point = ?',
        delta, USER, course.id, item.syllabus_point)
      cmp.appliedToRecord = `The unaided record moved by ${delta > 0 ? '+' : ''}${delta} marks.`
    }

    logEvent('mark.challenged', {
      markId: row.id, remarkId: stored.id, outcome: cmp.outcome,
      families: [first.provider.name, alt.provider.name], deltaTotal: cmp.deltaTotal,
      deltaPerAo: cmp.deltas, reason: str(body.reason) || null,
    }, USER, course?.id || null)

    return jsonOk(res, cmp, 201)
  })
}

/* -------------------------------------------------------------- the pipeline */

/**
 * Mark one answer and store the Mark, exactly as `POST /api/mark` does.
 *
 * Exported because the chat marks in the thread: a student who writes an answer to
 * the question in front of them gets the same Mark, from the same code, whether it
 * arrives on this route or on a Turn. Two paths to a mark would be two markings.
 */
export async function markAnswer(body) {
  const { attempt, item, course } = resolveTarget(body)
  const scheme = mustScheme(item)
  const answer = str(attempt.body)
  if (!answer) throw Object.assign(new Error('There is nothing to mark. Write the answer first.'), { status: 400 })

  const route = pick(taskClassFor(item, scheme), MARK_POLICY)
  const markObj = await runMarker({
    item, scheme, answer, provider: route.provider, model: route.model,
    effort: route.effort, budgetMs: route.budgetMs, attemptId: attempt.id,
    policy: MARK_POLICY, degraded: route.degraded,
  })
  if (!markObj || typeof markObj !== 'object') {
    throw Object.assign(new Error('The marker returned nothing. Try again in a moment.'), { status: 502 })
  }

  const stored = storeMark({ mark: markObj, attempt, item, course, scheme, model: route.model })
  const feedbackOnly = isFeedbackOnly(markObj)
  const mastery = applyMastery({ attempt, item, course, total: stored.total, max: stored.max, feedbackOnly })
  const cards = cardsFromMark({ mark: markObj, item, course, markId: stored.id })

  logEvent('mark.created', {
    markId: stored.id, itemId: item.id, total: stored.total, max: stored.max,
    unaided: mastery.unaided, model: route.model, degraded: route.degraded, cards: cards.length,
  }, USER, course.id)

  return markPayload({
    row: stored.row, mark: markObj, item, scheme, course,
    mastery, cardsCreated: cards, degraded: route.degraded,
  })
}

function resolveTarget(body) {
  if (body.attemptId) {
    const attempt = get('SELECT * FROM attempts WHERE id = ?', str(body.attemptId))
    if (!attempt) throw Object.assign(new Error(`No attempt ${body.attemptId}.`), { status: 404 })
    const item = get('SELECT * FROM items WHERE id = ?', attempt.item_id)
    if (!item) throw Object.assign(new Error('The item behind that attempt is missing from the pack.'), { status: 409 })
    return { attempt, item, course: mustCourse(attempt.course_id) }
  }
  const item = get('SELECT * FROM items WHERE id = ?', str(body.itemId))
  if (!item) throw Object.assign(new Error('Send an attemptId, or an itemId with the answer.'), { status: 400 })
  const course = body.courseId ? mustCourse(str(body.courseId)) : resolveCourse({})
  const answer = str(body.answer ?? body.body)
  if (!answer) throw Object.assign(new Error('There is nothing to mark. Write the answer first.'), { status: 400 })
  const id = uid('a')
  run('INSERT INTO attempts (id,course_id,item_id,user_id,body,mode,entry_rung,max_rung,seen_solution,confidence,seconds,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    id, course.id, item.id, USER, answer, 'mark', 0, 0, 0,
    body.confidence == null ? null : Math.max(0, Math.min(100, Math.round(Number(body.confidence) || 0))),
    Math.max(0, Math.round(Number(body.seconds) || 0)), now())
  touchPoint(course.id, item.syllabus_point)
  return { attempt: get('SELECT * FROM attempts WHERE id = ?', id), item, course }
}

function mustScheme(item) {
  if (!item?.scheme_id) throw schemeMissing(item)
  const row = get('SELECT * FROM schemes WHERE id = ?', item.scheme_id)
  if (!row) throw schemeMissing(item)
  const raw = safeJson(row.body, null)
  if (!raw) throw schemeMissing(item)
  try {
    return parseScheme(raw)
  } catch (err) {
    throw Object.assign(new Error(`The mark scheme for this question will not load: ${err.message}`), { status: 500 })
  }
}

/** A missing scheme is a hard stop, not a guessed number (11-RAG-005). */
function schemeMissing(item) {
  return Object.assign(
    new Error(`This question has no mark scheme in the pack, so it cannot be given a number. Use Learn for feedback on ${item?.id || 'it'}.`),
    { status: 422 })
}

/** Levels work and anything at eight marks or above goes to the deeper route. */
function taskClassFor(item, scheme) {
  const kind = scheme?.kind || item?.kind
  return kind === 'levels' || Number(item?.tariff) >= 8 ? 'markLevels' : 'markPoints'
}

function storeMark({ mark, attempt, item, course, scheme, model }) {
  const max = markMax(mark, item, scheme)
  const total = markTotal(mark, max)
  const id = uid('m')
  run('INSERT INTO marks (id,attempt_id,item_id,course_id,body,total,max,calibration,model,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    id, attempt.id, item.id, course.id, JSON.stringify(mark), total, max,
    JSON.stringify(mark.calibration_status ?? null), model || null, now())
  return { id, total, max, row: get('SELECT * FROM marks WHERE id = ?', id) }
}

/**
 * Mastery moves on unaided marks only.
 *
 * Unaided means the attempt did not see the solution and did not climb past rung 3.
 * An aided attempt still records exposure — attempts and last_seen — and still makes
 * cards; it just does not move the figure the planner and the readiness rings read.
 */
function applyMastery({ attempt, item, course, total, max, feedbackOnly }) {
  const point = item.syllabus_point
  const before = get('SELECT * FROM learner_state WHERE user_id = ? AND course_id = ? AND syllabus_point = ?', USER, course.id, point)
  const prior = before ? Number(before.mastery) || 0 : 0
  const unaided = isUnaided(attempt)
  const ratio = max > 0 ? Math.max(0, Math.min(1, total / max)) : 0

  if (!before) {
    run('INSERT INTO learner_state (user_id,course_id,syllabus_point,mastery,attempts,unaided_marks,unaided_max,last_seen,misconceptions) VALUES (?,?,?,?,?,?,?,?,?)',
      USER, course.id, point, 0, 0, 0, 0, now(), '[]')
  }

  if (feedbackOnly) {
    run('UPDATE learner_state SET last_seen = ? WHERE user_id = ? AND course_id = ? AND syllabus_point = ?', now(), USER, course.id, point)
    return {
      unaided,
      moved: false,
      before: prior,
      after: prior,
      reason: 'This paper is not calibrated yet, so the Mark carries feedback and no number. Nothing to move mastery with.',
    }
  }

  if (!unaided) {
    run('UPDATE learner_state SET last_seen = ? WHERE user_id = ? AND course_id = ? AND syllabus_point = ?', now(), USER, course.id, point)
    return {
      unaided: false,
      moved: false,
      before: prior,
      after: prior,
      reason: attempt.seen_solution
        ? 'You saw the solution on this one, so it does not raise mastery. The retest will.'
        : `This answer used rung ${attempt.max_rung}, so it does not raise mastery. Answer one unaided to move it.`,
    }
  }

  // A heavier question is stronger evidence, so it moves the figure further — but
  // never more than half the distance to the truth on a single answer.
  const weight = Math.min(MAX_STEP, 0.15 + (Number(item.tariff) || 2) / 20)
  const after = Math.max(0, Math.min(1, prior + weight * (ratio - prior)))
  run('UPDATE learner_state SET mastery = ?, unaided_marks = unaided_marks + ?, unaided_max = unaided_max + ?, last_seen = ? WHERE user_id = ? AND course_id = ? AND syllabus_point = ?',
    after, total, max, now(), USER, course.id, point)
  return {
    unaided: true,
    moved: Math.abs(after - prior) > 0.0005,
    before: Math.round(prior * 1000) / 1000,
    after: Math.round(after * 1000) / 1000,
    reason: `Unaided, ${total} of ${max}: mastery on ${point} moved from ${prior.toFixed(2)} to ${after.toFixed(2)}.`,
  }
}

/** Unaided: no seen solution, and the ladder never went past the hint rung. */
export function isUnaided(attempt) {
  return !Number(attempt?.seen_solution) && (Number(attempt?.max_rung) || 0) <= 3
}

/** One card per marking point that was missed, up to four, deduplicated by front. */
function cardsFromMark({ mark, item, course, markId }) {
  const missed = missedPoints(mark).slice(0, MAX_CARDS)
  if (!missed.length) return []
  const existing = new Set(all('SELECT front FROM cards WHERE user_id = ? AND course_id = ? AND syllabus_point = ?',
    USER, course.id, item.syllabus_point).map(r => r.front))
  // The stem carries its own tariff bracket — "… [2]" — so repeating it as
  // "(2 marks)" said the same thing twice, and prefixing the command word turned
  // "Define the term…" into "Define (2 marks): Define the term…". The syllabus code
  // is on the card's own provenance line and does not belong in the prompt.
  const stem = shorten(String(item.stem).replace(/\s+/g, ' ').replace(/\s*\[\d+\]\s*$/, ''), 140)
  const made = []
  for (const m of missed) {
    const front = `${item.command_word} · ${item.tariff} ${item.tariff === 1 ? 'mark' : 'marks'}\n${stem}\n\nWhich point did your answer miss${m.ao ? ` on ${m.ao}` : ''}?`
    if (existing.has(front)) continue
    const id = uid('card')
    run('INSERT INTO cards (id,user_id,course_id,syllabus_point,front,back,source,stability,difficulty,due,reps,lapses,last_review,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      id, USER, course.id, item.syllabus_point, front, m.text,
      `mark:${markId}`, 0, 5, now(), 0, 0, null, now())
    existing.add(front)
    made.push({ id, front, back: m.text, ao: m.ao || null })
  }
  return made
}

/* --------------------------------------------------------------- Mark reading */

/**
 * The Mark object is the marker's (`server/marking/marker.js`): `total_band` carries
 * the number, `per_ao` the levels work, `per_point` the points work, `ao_totals` the
 * sum of both. These readers take what the API stores and shows, and never invent a
 * number the Mark does not carry.
 */
function markMax(mark, item, scheme) {
  const tariff = Number(mark?.header?.tariff)
  if (Number.isFinite(tariff) && tariff > 0) return tariff
  const totals = Object.values(mark?.ao_totals || {})
  const summed = totals.reduce((n, t) => n + (Number(t?.max) || 0), 0)
  if (summed > 0) return summed
  if (scheme) {
    try { const n = Number(maxMarks(scheme)); if (Number.isFinite(n) && n > 0) return n } catch { /* the tariff stands */ }
  }
  return Number(item?.tariff) || 0
}

function markTotal(mark, max) {
  const modal = Number(mark?.total_band?.modal)
  if (Number.isFinite(modal)) return clamp(modal, 0, max)
  const totals = Object.values(mark?.ao_totals || {})
  const summed = totals.reduce((n, t) => n + (Number(t?.awarded) || 0), 0)
  return clamp(summed, 0, max)
}

/**
 * Feedback only: the paper is not calibrated, so the Mark carries spans, checks and
 * a next action but no number (11-RAG-005, 05-GATE). Nothing that reads a number may
 * run on one — including mastery.
 */
export function isFeedbackOnly(mark) {
  return !mark?.total_band || mark?.procedure_used === 'feedback_only'
}

/** Per-assessment-objective rows, from the levels grid or from the points totals. */
export function aoRows(mark) {
  if (Array.isArray(mark?.per_ao) && mark.per_ao.length) {
    return mark.per_ao.map(r => ({
      ao: String(r.ao),
      marks: Number(r.marks) || 0,
      max: Number(r.max) || 0,
      level: r.level ?? null,
      descriptor: r.descriptor_relied_on?.paraphrase ?? null,
    }))
  }
  return Object.entries(mark?.ao_totals || {}).map(([ao, t]) => ({
    ao,
    marks: Number(t?.awarded) || 0,
    max: Number(t?.max) || 0,
    level: null,
    descriptor: null,
  }))
}

/** What the answer did not earn: the missing level points, then the missed criteria. */
function missedPoints(mark) {
  const out = []
  for (const row of mark?.per_ao || []) {
    for (const text of row.missing_points || []) {
      if (typeof text === 'string' && text.trim()) out.push({ text: text.trim(), ao: row.ao })
    }
  }
  for (const p of mark?.per_point || []) {
    if ((Number(p.awarded) || 0) >= (Number(p.max) || 0)) continue
    const text = str(p.credit_text) || str(p.reason)
    if (text) out.push({ text, ao: p.ao || null })
  }
  return out
}

/* ------------------------------------------------------------------- payloads */

function markPayload({ row, mark, item, scheme, course, mastery, cardsCreated, degraded }) {
  let rendered = {}
  try {
    const r = renderMark(mark, { item, scheme })
    if (r && typeof r === 'object') rendered = r
  } catch (err) {
    console.error('[render]', err)
  }
  let summary = null
  try { summary = summaryLine(mark) } catch { summary = null }
  const max = Number(row.max) || markMax(mark, item, scheme)
  const total = Number(row.total) || 0
  const feedbackOnly = isFeedbackOnly(mark)
  return {
    // The renderer owns the shape the Mark view draws: heading, band, badge, cards,
    // runs, checks, warnings, next_action, summary. The API adds only its own record.
    ...rendered,
    id: row.id,
    attemptId: row.attempt_id,
    itemId: row.item_id,
    courseId: row.course_id,
    total: feedbackOnly ? null : total,
    max,
    percent: feedbackOnly || max <= 0 ? null : Math.round((total / max) * 100),
    feedbackOnly,
    summary: rendered.summary || summary || (feedbackOnly ? 'Feedback only' : `${total} of ${max}`),
    aos: aoRows(mark),
    mark,
    model: row.model,
    degraded: degraded ?? null,
    createdAt: row.created_at,
    item: item ? itemView(item) : null,
    courseTitle: course?.title || null,
    mastery: mastery || null,
    cardsCreated: cardsCreated || [],
  }
}

/** Original against re-mark, per assessment objective (05-CHAL-002/004). */
function comparison({ row, original, second, item, scheme, course, reason, alreadyChallenged }) {
  const remark = safeJson(second.body, null)
  const a = aoRows(original)
  const b = aoRows(remark)
  const names = [...new Set([...a.map(x => x.ao), ...b.map(x => x.ao)])]
  const deltas = names.map(name => {
    const x = a.find(r => r.ao === name)
    const y = b.find(r => r.ao === name)
    return {
      ao: name,
      original: x ? { marks: x.marks, max: x.max, level: x.level, descriptor: x.descriptor } : null,
      remark: y ? { marks: y.marks, max: y.max, level: y.level, descriptor: y.descriptor } : null,
      deltaMarks: (y?.marks ?? 0) - (x?.marks ?? 0),
      levelChanged: String(x?.level ?? '') !== String(y?.level ?? ''),
    }
  })
  const deltaTotal = Number(second.total) - Number(row.total)
  const tolerance = Math.max(1, Math.round((Number(row.max) || 0) * 0.05))
  const levelChanged = deltas.some(d => d.levelChanged)
  const outcome = levelChanged ? 'split' : Math.abs(deltaTotal) <= tolerance ? 'stands' : 'revised'
  return {
    markId: row.id,
    remarkId: second.id,
    outcome,
    deltaTotal,
    tolerance,
    deltas,
    reason: reason || null,
    alreadyChallenged: !!alreadyChallenged,
    line: challengeLine(outcome, deltas, deltaTotal),
    original: markPayload({ row, mark: original, item, scheme, course }),
    remark: markPayload({ row: second, mark: remark, item, scheme, course }),
  }
}

function challengeLine(outcome, deltas, deltaTotal) {
  const moved = deltas.filter(d => d.deltaMarks !== 0 || d.levelChanged)
    .map(d => `${d.ao} ${d.levelChanged ? `${d.original?.level ?? '—'}→${d.remark?.level ?? '—'}` : 'level unchanged'} (${d.deltaMarks > 0 ? '+' : ''}${d.deltaMarks})`)
  if (outcome === 'stands') return `Second look by another marker: same levels, ${deltaTotal === 0 ? 'same total' : `${deltaTotal > 0 ? '+' : ''}${deltaTotal} within tolerance`}.`
  if (outcome === 'revised') return `Second look by another marker: ${moved.join('; ') || 'total revised'}. The re-mark stands.`
  return `Second look by another marker: ${moved.join('; ')}. The two markers read the level differently — ask your teacher to settle it.`
}

/* --------------------------------------------------------------------- pieces */

function mustMark(id) {
  const row = get('SELECT * FROM marks WHERE id = ?', String(id))
  if (!row) throw Object.assign(new Error(`No mark ${id}.`), { status: 404 })
  return row
}

const PROVIDER_NAMES = ['anthropic', 'openai', 'google', 'deepseek']
function otherProviders(name) {
  return PROVIDER_NAMES.filter(n => n !== name)
}

/**
 * When only one family is available, the second marker is the same model reading the
 * answer again under an independent-second-marker instruction. That changes the
 * deterministic provider's seed and a real provider's framing; it is stated in the
 * response rather than dressed up as a second opinion it is not.
 */
function secondMarker(provider) {
  const note = '\n\nYou are the SECOND MARKER. Mark independently from first principles against the scheme; do not assume the first marker was right. Marker seed: 2.'
  return {
    name: `${provider.name}#2`,
    configured: provider.configured,
    complete: req => provider.complete({ ...req, system: String(req.system || '') + note }),
    stream: provider.stream ? req => provider.stream({ ...req, system: String(req.system || '') + note }) : undefined,
  }
}

/** Cut to a word boundary, so a card front never ends mid-word. */
function shorten(text, limit) {
  if (text.length <= limit) return text
  const cut = text.slice(0, limit)
  const at = cut.lastIndexOf(' ')
  return `${(at > limit * 0.6 ? cut.slice(0, at) : cut).replace(/[,;:.\s]+$/, '')}…`
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}
