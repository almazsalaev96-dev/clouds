/**
 * Mark-Yield ranking (spec §07.5). The number that decides what the student practises
 * next: expected qualification marks gained per minute of study on one syllabus point.
 *
 *   E = paper weight x probability it appears x marks on offer   (tariff exposure)
 *   G = max(0, target mastery - current mastery)                 (headroom)
 *   U = 1 - retrievability at the paper                          (decay urgency)
 *   T = clamp(learnability x transfer, 0.5, 1.5)                 (transfer factor)
 *   m = max(5, base minutes x sqrt(G) x rung factor + 8 x open misconceptions)
 *   Y = E x G x U x T x min(1, 20/m) / 20
 *
 * The square root in `m` is deliberate and load-bearing. Minutes-to-target is SUBLINEAR
 * in headroom: a point that needs twice the learning does not cost twice the minutes.
 * With a linear `m`, headroom cancels out of the ratio and the planner spends its time
 * topping up nearly-mastered topics while the weak points starve. With sqrt, Y is
 * strictly increasing in G, so a weak high-tariff point outranks a nearly-finished one.
 *
 * The `min(1, 20/m)` factor caps what a short top-up can claim: a point five minutes
 * from its target earns the marks it can earn in a 20-minute block, not a rate
 * extrapolated from five minutes.
 *
 * Pure functions. The ranking orders study; it does not decide what is studied — the
 * coverage rule below keeps never-attempted points from starving.
 */

import { retrievability } from './fsrs.js'

/**
 * Tunable weights. Every constant the formula uses lives here so the ranking can be
 * retuned without editing the arithmetic.
 */
export const WEIGHTS = Object.freeze({
  /** Target mastery by course target grade (M_grade). */
  gradeTargets: Object.freeze({ 'A*': 0.9, A: 0.85, B: 0.75, C: 0.65, D: 0.55, E: 0.55 }),
  /** How far exposure moves the target either side of the grade target. */
  targetExposureSpread: 0.15,
  targetMin: 0.55,
  targetMax: 0.95,
  /** Skill nodes on levels papers never sit below this target. */
  skillTargetFloor: 0.85,
  /** Transfer: +0.25 per dependent point below its own target, at most two. */
  transferPerDependent: 0.25,
  maxDependents: 2,
  skillTransfer: 1.5,
  transferMin: 0.5,
  transferMax: 1.5,
  learnabilityMin: 0.6,
  learnabilityMax: 1.4,
  /** Minutes model. */
  blockMinutes: 20,
  minMinutes: 5,
  minutesPerMisconception: 8,
  defaultBaseMinutes: 45,
  rungFactorPerRung: 0.1,
  rungFactorMax: 1.4,
  /** Retrievability estimate when a point carries no FSRS figure of its own. */
  stabilityFloorDays: 1.5,
  stabilityPerMastery: 24,
  /** Ranking. */
  coverageTopN: 5,
  tieEpsilon: 0.002,
  defaultPaperWeight: 0.5,
  defaultProbability: 0.5,
  defaultMarksOnOffer: 6,
})

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
const num = (x, fallback = 0) => (Number.isFinite(Number(x)) ? Number(x) : fallback)

/** Stable, order-independent tie-break so the same graph always ranks the same way. */
function hash32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Normalise one syllabus point into the fields the formula needs. Every field has a
 * documented fallback so a partly-populated learner graph still ranks.
 *
 * Accepted shape (all optional but `id`):
 *   `{id, code, title, paper, paperWeight, paperWeightPct, paperMaxMarks, daysToPaper,
 *     probability, marksOnOffer, mastery, attempts, lastSeenDays, retrievability,
 *     baseMinutes, rungMean, misconceptions, dependentsBelowTarget, learnability, isSkill}`
 */
function readPoint(p = {}) {
  const paperWeight = Number.isFinite(Number(p.paperWeight))
    ? Number(p.paperWeight)
    : (Number.isFinite(Number(p.paperWeightPct)) && Number.isFinite(Number(p.paperMaxMarks))
      ? Number(p.paperWeightPct) / Number(p.paperMaxMarks)
      : WEIGHTS.defaultPaperWeight)
  const attempts = Math.max(0, Math.round(num(p.attempts, 0)))
  const mastery = clamp(num(p.mastery ?? p.M, 0), 0, 1)
  const lastSeenDays = Number.isFinite(Number(p.lastSeenDays)) ? Number(p.lastSeenDays) : Infinity
  return {
    id: String(p.id ?? p.code ?? p.syllabus_point ?? ''),
    title: String(p.title ?? p.code ?? p.id ?? 'this point'),
    paper: p.paper == null ? null : String(p.paper),
    paperWeight,
    paperWeightPct: Number.isFinite(Number(p.paperWeightPct)) ? Number(p.paperWeightPct) : null,
    daysToPaper: Number.isFinite(Number(p.daysToPaper)) ? Number(p.daysToPaper) : Infinity,
    probability: clamp(num(p.probability, WEIGHTS.defaultProbability), 0, 1),
    marksOnOffer: Math.max(0, num(p.marksOnOffer ?? p.tariff, WEIGHTS.defaultMarksOnOffer)),
    mastery,
    attempts,
    lastSeenDays,
    retrievability: Number.isFinite(Number(p.retrievability)) ? clamp(Number(p.retrievability), 0, 1) : null,
    baseMinutes: clamp(num(p.baseMinutes ?? p.estMinutes, WEIGHTS.defaultBaseMinutes), 5, 240),
    rungMean: clamp(num(p.rungMean, 1), 1, 5),
    misconceptions: clamp(Math.round(num(p.misconceptions, 0)), 0, 3),
    dependentsBelowTarget: Math.max(0, Math.round(num(p.dependentsBelowTarget, 0))),
    learnability: clamp(num(p.learnability, 1), WEIGHTS.learnabilityMin, WEIGHTS.learnabilityMax),
    isSkill: p.isSkill === true || p.kind === 'skill',
    raw: p,
  }
}

/**
 * Retrievability at the paper. An unattempted point is 0 by definition. Otherwise the
 * point's own FSRS figure is used when the learner graph carries one; failing that, the
 * curve is run over a stability estimated from mastery, which is honest about being an
 * estimate rather than pretending the point was never seen.
 */
function retrievabilityOf(pt) {
  if (pt.retrievability != null) return pt.retrievability
  if (pt.attempts === 0) return 0
  if (!Number.isFinite(pt.lastSeenDays)) return 0
  const stability = WEIGHTS.stabilityFloorDays + WEIGHTS.stabilityPerMastery * pt.mastery
  const horizon = Number.isFinite(pt.daysToPaper) ? Math.max(0, pt.daysToPaper) : 0
  return retrievability(pt.lastSeenDays + horizon, stability)
}

/**
 * The per-point mastery target, exposure-weighted rather than flat: secure the
 * high-tariff, high-frequency basics completely and accept gaps on the rare ones.
 * @param {ReturnType<typeof readPoint>} pt
 * @param {number} exposure this point's E
 * @param {number} maxExposure the largest E in the course
 * @param {string} targetGrade
 * @returns {number} 0.55-0.95
 */
function targetFor(pt, exposure, maxExposure, targetGrade) {
  const base = WEIGHTS.gradeTargets[String(targetGrade || 'B').toUpperCase()] ?? WEIGHTS.gradeTargets.B
  const normalised = maxExposure > 0 ? exposure / maxExposure : 0
  let target = base + WEIGHTS.targetExposureSpread * (2 * normalised - 1)
  target = clamp(target, WEIGHTS.targetMin, WEIGHTS.targetMax)
  if (pt.isSkill) target = Math.max(target, WEIGHTS.skillTargetFloor)
  return target
}

/**
 * Score one point. Exposed so a single point can be tested against the worked example.
 * @param {object} point
 * @param {{targetGrade?:string, maxExposure?:number}} [opts]
 * @returns {{y:number, marksPerHour:number, factors:{E:number,G:number,U:number,T:number,m:number,cap:number,target:number,retrievability:number}}}
 */
export function score(point, opts = {}) {
  const pt = readPoint(point)
  const E = pt.paperWeight * pt.probability * pt.marksOnOffer
  const maxExposure = num(opts.maxExposure, E) || E
  const target = targetFor(pt, E, maxExposure, opts.targetGrade)
  const G = Math.max(0, target - pt.mastery)
  const R = retrievabilityOf(pt)
  const U = 1 - R
  const transfer = pt.isSkill
    ? WEIGHTS.skillTransfer
    : 1 + WEIGHTS.transferPerDependent * Math.min(pt.dependentsBelowTarget, WEIGHTS.maxDependents)
  const T = clamp(pt.learnability * transfer, WEIGHTS.transferMin, WEIGHTS.transferMax)
  const rungFactor = clamp(1 + WEIGHTS.rungFactorPerRung * (pt.rungMean - 1), 1, WEIGHTS.rungFactorMax)
  // Sublinear in G on purpose: see the module note. Linear here would cancel headroom out.
  const m = Math.max(
    WEIGHTS.minMinutes,
    pt.baseMinutes * Math.sqrt(G) * rungFactor + WEIGHTS.minutesPerMisconception * pt.misconceptions,
  )
  const cap = Math.min(1, WEIGHTS.blockMinutes / m)
  const y = (E * G * U * T * cap) / WEIGHTS.blockMinutes
  const marksPerHour = pt.paperWeight > 0 ? (60 * y) / pt.paperWeight : 0
  return {
    y,
    marksPerHour,
    factors: { E, G, U, T, m, cap, target, retrievability: R },
  }
}

/**
 * Five mastery states, named the way the interface names them. A point with no
 * attempts is `unseen` however high a seeded figure reads. Defined here, beside the
 * ranking that reads it, so the API layer and the ranker cannot drift apart.
 */
export function masteryState(mastery, attempts) {
  if (!attempts) return 'unseen'
  const m = Number(mastery) || 0
  if (m < 0.35) return 'weak'
  if (m < 0.6) return 'developing'
  if (m < 0.85) return 'secure'
  return 'strong'
}

/**
 * A one-line human reason, in the student's terms. Never the formula, never a decimal
 * of Y: "Paper 2 carries 30%, you are at 0.35 on a 6-mark topic, last seen 12 days ago".
 *
 * @param {object} point
 * @param {{targetGrade?:string, maxExposure?:number}} [opts]
 * @returns {string}
 */
export function explain(point, opts = {}) {
  const pt = readPoint(point)
  const parts = []
  if (pt.paper && pt.paperWeightPct != null) parts.push(`Paper ${pt.paper} carries ${Math.round(pt.paperWeightPct)}%`)
  else if (pt.paper) parts.push(`Paper ${pt.paper}`)
  const tariff = `${Math.round(pt.marksOnOffer)}-mark topic`
  if (pt.attempts === 0) parts.push(`you have not attempted this ${tariff}`)
  // A student cannot act on "0.13". The word is the same one the pip beside the
  // point uses, so the two never disagree.
  else parts.push(`you are ${masteryState(pt.mastery, pt.attempts)} on a ${tariff}`)
  if (pt.attempts > 0 && Number.isFinite(pt.lastSeenDays)) {
    const d = Math.round(pt.lastSeenDays)
    parts.push(d <= 0 ? 'last seen today' : `last seen ${d} day${d === 1 ? '' : 's'} ago`)
  }
  if (pt.misconceptions > 0) {
    parts.push(`${pt.misconceptions} open misconception${pt.misconceptions === 1 ? '' : 's'}`)
  }
  const line = parts.join(', ')
  return line ? `${line[0].toUpperCase()}${line.slice(1)}.` : 'Not yet ranked.'
}

/**
 * Rank syllabus points by expected marks per study minute.
 *
 * Ties (|dY| < 0.002) break in a fixed order so the same graph always produces the same
 * list: nearer paper date, then lower mastery, then longer since the last attempt, then
 * a stable hash of (user, point).
 *
 * Coverage: the ranking orders study, it does not decide what is studied. If no
 * never-attempted point with exposure sits inside the top N, the highest-ranked one is
 * promoted into the last of those slots and flagged `coverage: true`, so a weak-but-rare
 * point is still taught rather than starved by the ordering.
 *
 * @param {object[]} points see `readPoint` for the accepted shape
 * @param {Object} [opts]
 * @param {string} [opts.targetGrade] 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' — default 'B'
 * @param {string} [opts.userId] used only for the deterministic tie-break
 * @param {number} [opts.coverageTopN] how many slots the coverage rule protects, default 5
 * @param {number} [opts.limit] return only the first n rows
 * @returns {Array<{id:string, point:object, rank:number, score:number, marksPerHour:number,
 *   factors:object, why:string, coverage:boolean}>}
 */
export function rank(points = [], opts = {}) {
  const list = (Array.isArray(points) ? points : []).map(readPoint)
  const exposures = list.map((pt) => pt.paperWeight * pt.probability * pt.marksOnOffer)
  const maxExposure = exposures.length ? Math.max(...exposures) : 0
  const userId = String(opts.userId || 'u_demo')

  const rows = list.map((pt, i) => {
    const s = score(pt.raw, { targetGrade: opts.targetGrade, maxExposure })
    return {
      id: pt.id,
      point: pt.raw,
      rank: 0,
      score: s.y,
      marksPerHour: s.marksPerHour,
      factors: s.factors,
      why: explain(pt.raw, { targetGrade: opts.targetGrade, maxExposure }),
      coverage: false,
      _pt: pt,
      _order: i,
    }
  })

  rows.sort((a, b) => {
    if (Math.abs(a.score - b.score) >= WEIGHTS.tieEpsilon) return b.score - a.score
    if (a._pt.daysToPaper !== b._pt.daysToPaper) return a._pt.daysToPaper - b._pt.daysToPaper
    if (a._pt.mastery !== b._pt.mastery) return a._pt.mastery - b._pt.mastery
    const aSeen = Number.isFinite(a._pt.lastSeenDays) ? a._pt.lastSeenDays : Number.MAX_SAFE_INTEGER
    const bSeen = Number.isFinite(b._pt.lastSeenDays) ? b._pt.lastSeenDays : Number.MAX_SAFE_INTEGER
    if (aSeen !== bSeen) return bSeen - aSeen
    return hash32(`${userId}:${a.id}`) - hash32(`${userId}:${b.id}`)
  })

  // Coverage floor (07-YLD-008).
  const topN = Math.max(1, Math.round(num(opts.coverageTopN, WEIGHTS.coverageTopN)))
  const covered = rows.slice(0, topN).some((r) => r._pt.attempts === 0 && r.factors.E > 0)
  if (!covered) {
    const idx = rows.findIndex((r) => r._pt.attempts === 0 && r.factors.E > 0)
    if (idx >= topN) {
      const [promoted] = rows.splice(idx, 1)
      promoted.coverage = true
      promoted.why = `${promoted.why.replace(/\.$/, '')} — scheduled now so it is covered before the paper.`
      rows.splice(topN - 1, 0, promoted)
    }
  }

  const out = rows.map((r, i) => {
    const { _pt, _order, ...rest } = r
    void _pt
    void _order
    return { ...rest, rank: i + 1 }
  })
  return Number.isFinite(Number(opts.limit)) ? out.slice(0, Math.max(0, Math.round(Number(opts.limit)))) : out
}
