/**
 * The Help Ladder (spec §04.4). Five rungs, one rung per turn, reset per item, never
 * skipped and never descended within an item. Pure functions — the caller owns the
 * rung counter and stores it on the attempt.
 *
 * Rung definitions differ by item kind; the numbers do not.
 */

/** @typedef {'numeric'|'short'|'levels'|'mechanism'|'practical'} ItemKind */

/**
 * The five rungs. `whatItGives` and `whatItWithholds` are the contract a drafted turn
 * is vetted against (see orchestrator.vetTurn).
 * @type {ReadonlyArray<{n:number,name:string,description:string,whatItGives:string,whatItWithholds:string}>}
 */
export const RUNGS = Object.freeze([
  Object.freeze({
    n: 1,
    name: 'Orient',
    description: 'A metacognitive question that makes the student choose the territory.',
    whatItGives: 'One question naming the choice: which concept family, which command word, which AO.',
    whatItWithholds: 'Any principle, any procedure, any number, any part of the answer.',
  }),
  Object.freeze({
    n: 2,
    name: 'Narrow',
    description: 'A conceptual pointer: the principle that governs, stated without numbers.',
    whatItGives: 'The governing idea in one sentence — "break-even uses contribution per unit, not price".',
    whatItWithholds: 'The procedure, the arithmetic, the structure of the answer.',
  }),
  Object.freeze({
    n: 3,
    name: 'Hint the method',
    description: 'The next step only, in the imperative, with nothing carried out.',
    whatItGives: 'One step the student can execute: "subtract variable cost per unit from price".',
    whatItWithholds: 'The result of that step, the step after it, the final value.',
  }),
  Object.freeze({
    n: 4,
    name: 'Worked step',
    description: 'A partial worked step with the load-bearing part blanked for the student.',
    whatItGives: 'One completed line and one blank: "contribution = 20 - 8 = 12; break-even = 36,000 / ___".',
    whatItWithholds: 'The final value, the full chain, a model essay.',
  }),
  Object.freeze({
    n: 5,
    name: 'Full solution',
    description: 'The verified solution, labelled seen, logged, and followed by a near-transfer item.',
    whatItGives: 'The complete working or the full paragraph set, then a changed-numbers or changed-context twin to do unaided.',
    whatItWithholds: 'Nothing — but the attempt is tagged seen_solution, contributes 0 to mastery, and a retest is scheduled at 24-72 hours.',
  }),
])

/**
 * Rung 4a — the micro-worked chain for a novice on a levels item: three labelled
 * sentences (cause, mechanism, effect on this firm), 45 words in total, with the third
 * blanked. Assistance stays high; the artefact shrinks. Dropping a novice to rung 3
 * instead would run expertise reversal backwards.
 */
export const RUNG_4A = Object.freeze({
  n: 4,
  variant: '4a',
  name: 'Micro-worked chain',
  description: 'Three labelled sentences — cause, mechanism, effect on this firm — 45 words, third sentence blanked.',
  whatItGives: 'A chain small enough to parse, plus one self-explanation prompt.',
  whatItWithholds: 'The model paragraph, the essay, the judgement.',
})

/** The per-kind wording of each rung, straight from the §04.4 table. */
const RUNG_GUIDANCE = Object.freeze({
  numeric: [
    'Ask which concept family this belongs to.',
    'State the principle without numbers.',
    'Give the next step only, as an instruction.',
    'Show one worked line and blank the next value.',
    'Give the verified full working, then a numbers-changed item to do unaided.',
  ],
  short: [
    'Ask what the command word is asking for.',
    'Say what shape the answer needs: a class plus a distinguishing feature.',
    'Give the opening words of the definition.',
    'Give half the definition and blank the distinguishing feature.',
    'Give the full definition, then a sibling term to define unaided.',
  ],
  levels: [
    'Ask which AO this command word reaches that the one below does not.',
    'Name what application means here: facts true of this business, not the sector.',
    'Give the first chain to build: cause, mechanism, effect on this firm.',
    'Give one model paragraph one level above the student, with the evaluative sentence blanked. Never a model essay.',
    'Give a plan plus one exemplar paragraph, then a new context to plan unaided.',
  ],
  mechanism: [
    'Ask what acts on what here.',
    'State the rule the arrows follow.',
    'Give the first step to draw or write.',
    'Give the intermediate with one step missing.',
    'Give the full mechanism, then a homologous one to do unaided.',
  ],
  practical: [
    'Ask what the one variable being changed is.',
    'State what a control is for in this investigation.',
    'Give the method step that fixes one variable.',
    'Give the method with one control step blank.',
    'Give the full plan, then a variant investigation to plan unaided.',
  ],
})

/**
 * What a turn at this rung is allowed to do, in the item's own terms.
 * @param {number} rung 1-5
 * @param {ItemKind|string} itemKind
 * @returns {string}
 */
export function rungGuidance(rung, itemKind = 'short') {
  const rows = RUNG_GUIDANCE[itemKind] || RUNG_GUIDANCE.short
  const n = Math.min(5, Math.max(1, Math.round(Number(rung) || 1)))
  return rows[n - 1]
}

/**
 * Entry rung = f(unaided mastery, item kind, prior attempts) — 04-LADR-001.
 *
 * Bands on unaided mastery, not on the hint-inflated figure, so a student whose
 * competence is scaffold-dependent keeps the scaffold:
 *   - below 0.40  -> rung 4 (rung 4a on a levels item: see RUNG_4A)
 *   - 0.40 to 0.70 -> rung 2
 *   - above 0.70   -> rung 1
 * A novice on a levels essay therefore does not start at rung 1; they start at the
 * micro-worked chain, because their problem is the size of a model paragraph, not the
 * level of assistance.
 *
 * Prior failed attempts on this item raise the entry by one rung each, capped at 4 —
 * a student who has already tried twice is not sent back to "which concept is this?".
 *
 * @param {{mastery?:number, itemKind?:ItemKind|string, priorAttempts?:number}} input
 * @returns {number} 1-4
 */
export function entryRung({ mastery = 0, itemKind = 'short', priorAttempts = 0 } = {}) {
  const m = Number(mastery) || 0
  const tries = Math.max(0, Number(priorAttempts) || 0)
  let rung
  if (m < 0.4) rung = 4
  else if (m <= 0.7) rung = 2
  else rung = 1
  rung = Math.min(4, rung + tries)
  // A levels item never enters above 4; 4 there means the 4a micro chain, not a paragraph.
  if (itemKind === 'levels') rung = Math.min(4, rung)
  return rung
}

/**
 * True when a rung-4 delivery on this item must take the 4a micro-chain form.
 * @param {{rung:number, itemKind?:ItemKind|string, mastery?:number}} input
 * @returns {boolean}
 */
export function usesMicroChain({ rung, itemKind = 'short', mastery = 0 } = {}) {
  return itemKind === 'levels' && Number(rung) === 4 && (Number(mastery) || 0) < 0.4
}

/**
 * Climb one rung per turn, only on a failed or absent attempt after the previous rung.
 * Never skips, never descends. Pressing "Teach me" again is one rung up.
 *
 * @param {number} current current rung, 1-5
 * @param {{studentRequested?:boolean, stuckSignals?:number|Array<unknown>}} [signals]
 *   `stuckSignals` is a count (or a list) of this turn's evidence that the student is
 *   stuck: a failed attempt, an absent attempt, a repeated wrong value.
 * @returns {number} the rung the next turn should be delivered at
 */
export function nextRung(current, { studentRequested = false, stuckSignals = 0 } = {}) {
  const at = Math.min(5, Math.max(1, Math.round(Number(current) || 1)))
  const stuck = Array.isArray(stuckSignals) ? stuckSignals.length : Math.max(0, Number(stuckSignals) || 0)
  if (!studentRequested && stuck === 0) return at
  return Math.min(5, at + 1)
}

/** The highest rung each item kind delivers before the answer counts as seen. */
const BUDGET = Object.freeze({ numeric: 4, short: 4, levels: 4, mechanism: 4, practical: 4 })

/**
 * How far the ladder goes before the answer counts as seen.
 *
 * Returns the highest rung that can be delivered without setting `seen_solution` on the
 * attempt. Rung 5 is always a seen solution: it is logged, the attempt contributes 0 to
 * mastery, a retest is scheduled at 24-72 hours and a near-transfer item follows.
 *
 * On a levels item the cap is 4 in a second, harder sense (04-LADR-004): before the
 * student's own marked attempt, rung 5 delivers a plan plus one exemplar paragraph, and
 * a model essay is not available at any rung.
 *
 * @param {ItemKind|string} itemKind
 * @returns {number} the highest unseen rung, 4
 */
export function rungBudget(itemKind = 'short') {
  return BUDGET[itemKind] ?? 4
}

/**
 * The rung at which delivery sets `seen_solution = true` on the attempt.
 * @param {ItemKind|string} itemKind
 * @returns {number}
 */
export function seenSolutionRung(itemKind = 'short') {
  return rungBudget(itemKind) + 1
}

/**
 * The rung a turn may actually be delivered at, given the gate. The gate's own ceiling
 * (`maxRung` from evaluateGate) and the ladder's climb are combined here so callers do
 * not have to reconcile them.
 *
 * @param {{requested:number, gateMaxRung?:number, itemKind?:ItemKind|string}} input
 * @returns {{rung:number, seen:boolean, capped:boolean}}
 */
export function deliverableRung({ requested, gateMaxRung = 3, itemKind = 'short' } = {}) {
  const want = Math.min(5, Math.max(1, Math.round(Number(requested) || 1)))
  const ceiling = Math.min(5, Math.max(1, Math.round(Number(gateMaxRung) || 3)))
  const rung = Math.min(want, ceiling)
  return { rung, seen: rung >= seenSolutionRung(itemKind), capped: rung < want }
}
