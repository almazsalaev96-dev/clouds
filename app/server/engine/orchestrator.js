/**
 * The Orchestrator's lint (spec §04.10, §04.8). Every drafted tutor turn is vetted
 * server-side before paint; the client never receives an unvetted draft.
 *
 * Each check is its own exported function so it can be tested on one sentence. `vetTurn`
 * runs them in the §04.10 order and returns both the violations and a mechanically
 * repaired draft. Repairs are conservative: praise, openers, closers, emoji, exclamation
 * marks, extra questions and a missing hand-back are fixed in place; a leak, an
 * over-long draft or a wrong rung is left for a regenerate, because repairing those
 * would mean writing the turn.
 */

import { rungGuidance } from './ladder.js'

/** Violation codes. `REPAIRABLE` is the subset `rewritten` actually fixes. */
export const LINT_CODES = Object.freeze({
  TOO_LONG: 'too_long',
  MULTI_QUESTION: 'multi_question',
  PRAISE: 'praise',
  SYCOPHANCY_OPENER: 'sycophancy_opener',
  EXCLAMATION: 'exclamation',
  EMOJI: 'emoji',
  CLOSER: 'closer',
  LEAK_VALUE: 'leak_value',
  LEAK_PROSE: 'leak_prose',
  LEAK_STEPS: 'leak_steps',
  NO_HANDBACK: 'no_handback',
})

/** Codes `vetTurn().rewritten` repairs without a regenerate. */
export const REPAIRABLE = Object.freeze(new Set([
  LINT_CODES.MULTI_QUESTION,
  LINT_CODES.PRAISE,
  LINT_CODES.SYCOPHANCY_OPENER,
  LINT_CODES.EXCLAMATION,
  LINT_CODES.EMOJI,
  LINT_CODES.CLOSER,
  LINT_CODES.NO_HANDBACK,
]))

/** Forbidden phrases, 0 tolerance (04-FEED-004). Person-praise is the last two rules. */
const PRAISE_PATTERNS = [
  /\bgreat (job|work|answer|start|thinking)\b/i,
  /\bgood (job|work|answer|effort)\b/i,
  /\bwell done\b/i,
  /\b(amazing|awesome|fantastic|brilliant|superb|excellent|perfect|impressive)\b/i,
  /\bnice (job|work|one)\b/i,
  /\bkeep (it )?up\b/i,
  /\bi'?m (so )?proud\b/i,
  /\byou'?(re| are) (so |such |really )?(a )?(smart|clever|bright|talented|good at|great at|natural)\b/i,
  /\byou'?ve got this\b/i,
  /\bdon'?t worry\b/i,
  /\btake a breath\b/i,
  /\byou'?re doing (great|really well|so well)\b/i,
]

/** Sycophancy openers — praise for the question rather than the work. */
const OPENER_PATTERNS = [
  /^\s*(that'?s a |what a )?(great|good|excellent|interesting|brilliant|smart|fantastic) (question|point|observation|thought)\b/i,
  /^\s*(absolutely|of course|certainly|sure thing)[,!.]/i,
  /^\s*i'?m glad you asked\b/i,
]

/** Closing filler that hands responsibility back to nobody. */
const CLOSER_PATTERNS = [
  /\bdoes (that|this) make sense\b/i,
  /\blet me know if\b/i,
  /\bfeel free to\b/i,
  /\bhope (this|that) helps\b/i,
  /\bhappy to (help|explain)\b/i,
  /\bi'?m here (to help|if you)\b/i,
  /\bjust ask\b/i,
]

const EMOJI = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{20E3}]/gu

const norm = (s) => String(s == null ? '' : s).replace(/[ \t]+/g, ' ').trim()
const words = (s) => (String(s || '').match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || [])

/** Split a draft into sentences, keeping their terminators. @returns {string[]} */
export function sentences(text) {
  return String(text || '')
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const v = (code, detail) => ({ code, detail })

/**
 * A Learn turn is 120 words, or 150 when the caller has asked for depth. Mark feedback
 * carries the §04.8 four-line template and gets a larger budget.
 * @param {string} draft
 * @param {{mode?:string, depth?:boolean, wordLimit?:number}} [ctx]
 * @returns {Array<{code:string,detail:string}>}
 */
export function checkLength(draft, ctx = {}) {
  const mode = ctx.mode || 'learn'
  const limit = ctx.wordLimit ?? (mode === 'learn' ? (ctx.depth ? 150 : 120) : 220)
  const n = words(draft).length
  return n > limit ? [v(LINT_CODES.TOO_LONG, `${n} words against a limit of ${limit}`)] : []
}

/**
 * One move, one question. A second question mark splits the student's attention and is
 * the most common way a turn stops being a turn.
 */
export function checkQuestions(draft) {
  const marks = (String(draft || '').match(/\?/g) || []).length
  return marks > 1 ? [v(LINT_CODES.MULTI_QUESTION, `${marks} questions in one turn`)] : []
}

/** Praise inflation and person-praise (04-FEED-004). */
export function checkPraise(draft) {
  const out = []
  for (const re of PRAISE_PATTERNS) {
    const hit = String(draft || '').match(re)
    if (hit) out.push(v(LINT_CODES.PRAISE, `"${hit[0].trim()}"`))
  }
  return out
}

/** "Great question!" and its family, at the head of the turn. */
export function checkOpener(draft) {
  const first = sentences(draft)[0] || ''
  for (const re of OPENER_PATTERNS) {
    const hit = first.match(re)
    if (hit) return [v(LINT_CODES.SYCOPHANCY_OPENER, `"${hit[0].trim()}"`)]
  }
  return []
}

/** Any exclamation mark (04-FEED-004). */
export function checkExclamation(draft) {
  const n = (String(draft || '').match(/!/g) || []).length
  return n ? [v(LINT_CODES.EXCLAMATION, `${n} exclamation mark${n > 1 ? 's' : ''}`)] : []
}

/** Any emoji. */
export function checkEmoji(draft) {
  const hits = String(draft || '').match(EMOJI)
  return hits ? [v(LINT_CODES.EMOJI, hits.join(' '))] : []
}

/** "Does that make sense?", "Let me know if…" and the rest of the closing filler. */
export function checkClosers(draft) {
  const out = []
  for (const re of CLOSER_PATTERNS) {
    const hit = String(draft || '').match(re)
    if (hit) out.push(v(LINT_CODES.CLOSER, `"${hit[0].trim()}"`))
  }
  return out
}

/** Numbers as the student would read them: 36,000 and 36000 are the same value. */
function numbersIn(text) {
  const out = new Set()
  for (const raw of String(text || '').match(/-?\d[\d,]*(?:\.\d+)?/g) || []) {
    const n = Number(raw.replace(/,/g, ''))
    if (Number.isFinite(n)) out.add(n)
  }
  return out
}

/**
 * Answer leakage above the permitted rung. Below rung 4 a turn may not contain the
 * final value, the conclusion, or two consecutive steps of working.
 *
 * The key comes from `ctx.answer`, `ctx.key` or `ctx.item.answer`. Values that already
 * appear in the stem are given data, not a leak.
 *
 * @param {string} draft
 * @param {{rung?:number, itemKind?:string, answer?:string|number, key?:string|number, item?:object}} [ctx]
 */
export function checkLeak(draft, ctx = {}) {
  const rung = Number(ctx.rung) || 1
  if (rung >= 4) return []
  const out = []
  const item = ctx.item || {}
  const key = ctx.answer ?? ctx.key ?? item.answer ?? item.key
  const text = String(draft || '')

  if (key != null && key !== '') {
    const given = numbersIn(item.stem)
    const draftNums = numbersIn(text)
    for (const n of numbersIn(key)) {
      if (given.has(n)) continue
      if (draftNums.has(n)) { out.push(v(LINT_CODES.LEAK_VALUE, `final value ${n} appears at rung ${rung}`)); break }
    }
    const phrase = norm(String(key)).toLowerCase()
    if (!out.length && phrase && words(phrase).length >= 2 && words(phrase).length <= 12) {
      if (norm(text).toLowerCase().includes(phrase)) out.push(v(LINT_CODES.LEAK_VALUE, `the key phrase "${phrase}" appears at rung ${rung}`))
    }
  }

  const steps = String(text).split(/\n|(?<=[.;])\s+/).filter((l) => /=/.test(l) && /\d/.test(l))
  if (rung <= 3 && steps.length >= 2) {
    out.push(v(LINT_CODES.LEAK_STEPS, `${steps.length} worked lines at rung ${rung}`))
  }

  if (rung <= 3 && (ctx.itemKind || item.kind) === 'levels') {
    const prose = sentences(text).filter((s) => !s.endsWith('?'))
    if (prose.length >= 3 && words(text).length > 60) {
      out.push(v(LINT_CODES.LEAK_PROSE, `${prose.length} sentences of answer prose at rung ${rung}`))
    }
  }
  return out
}

/** Does the turn end by naming the student's next action? */
function hasHandback(draft) {
  const ss = sentences(draft)
  if (!ss.length) return false
  const last = ss[ss.length - 1]
  if (last.endsWith('?')) return true
  if (/\byour (turn|go)\b/i.test(last)) return true
  return /^(try|write|name|start|give|show|pick|state|add|count|say|list|draw|work out|finish|fill|sketch|plan|do)\b/i.test(last)
}

/**
 * A turn that does not hand back is a lecture. The hand-back is the last sentence: a
 * question, an imperative, or "your turn".
 */
export function checkHandback(draft, ctx = {}) {
  if (hasHandback(draft)) return []
  return [v(LINT_CODES.NO_HANDBACK, `no next action named${ctx.rung ? ` at rung ${ctx.rung}` : ''}`)]
}

/**
 * The composer placeholder that names the student's next action. Written from the
 * student's side of the screen, in the imperative, specific to the item and rung.
 *
 * @param {{kind?:string}} item
 * @param {number} rung 1-5
 * @returns {string}
 */
export function handbackFor(item = {}, rung = 1) {
  const kind = item.kind || 'short'
  const n = Math.min(5, Math.max(1, Math.round(Number(rung) || 1)))
  const table = {
    numeric: ['Name the concept this uses', 'Say which quantity you need first', 'Try the next line', 'Fill the blank and show the line', 'Do the transfer question unaided'],
    short: ['Say what the command word asks for', 'Write the class it belongs to', 'Write your first sentence', 'Fill in the distinguishing feature', 'Define the sibling term unaided'],
    levels: ['Name the AO you are aiming at', 'Name the stakeholder first', 'Write the cause, then the effect', 'Write the blanked sentence', 'Plan the new context unaided'],
    mechanism: ['Name what acts on what', 'Say where the first step starts', 'Draw the first step', 'Add the missing step', 'Do the homologous mechanism unaided'],
    practical: ['Name the variable you change', 'Name one thing to control', 'Write the first method step', 'Fill in the missing control step', 'Plan the variant investigation unaided'],
  }
  return (table[kind] || table.short)[n - 1]
}

/** Remove a phrase and tidy the punctuation left behind. */
function excise(text, re) {
  return text.replace(re, '').replace(/\s{2,}/g, ' ').replace(/^\s*[,;:.!]\s*/, '').trim()
}

/**
 * Mechanically repair what can be repaired: strip praise, openers, closers, emoji and
 * exclamation marks; cut every question after the first; append the hand-back when the
 * turn does not name a next action. Leaks, length and rung are left alone.
 *
 * @param {string} draft
 * @param {{rung?:number, item?:object}} [ctx]
 * @returns {string}
 */
export function repair(draft, ctx = {}) {
  let text = String(draft || '').replace(EMOJI, '')
  text = text.replace(/!+/g, '.')

  let out = []
  let seenQuestion = false
  for (let s of sentences(text)) {
    let sentence = s
    for (const re of OPENER_PATTERNS) {
      if (re.test(sentence)) sentence = excise(sentence, re)
    }
    for (const re of [...PRAISE_PATTERNS, ...CLOSER_PATTERNS]) {
      if (re.test(sentence)) sentence = excise(sentence, re)
    }
    sentence = sentence.replace(/^\s*(and|but|so)\s+/i, '').trim()
    if (!sentence || words(sentence).length === 0) continue
    if (/^[.,;:]+$/.test(sentence)) continue
    if (sentence.endsWith('?')) {
      if (seenQuestion) continue
      seenQuestion = true
    }
    if (!/[.?!]$/.test(sentence)) sentence += '.'
    sentence = sentence[0].toUpperCase() + sentence.slice(1)
    out.push(sentence)
  }

  let text2 = out.join(' ').replace(/\s{2,}/g, ' ').trim()
  if (text2 && !hasHandback(text2)) {
    text2 = `${text2} ${handbackFor(ctx.item || {}, ctx.rung || 1)}.`
  }
  return text2
}

/**
 * Vet a drafted tutor turn.
 *
 * @param {string} draft the model's drafted turn, unpainted
 * @param {Object} [ctx]
 * @param {number} [ctx.rung]      the rung this turn is permitted to deliver, 1-5
 * @param {string} [ctx.itemKind]  'numeric' | 'short' | 'levels' | 'mechanism' | 'practical'
 * @param {object} [ctx.item]      the item, used for the stem's given values and the hand-back
 * @param {string|number} [ctx.answer] the presolve key, so leakage can be detected
 * @param {string} [ctx.mode]      'learn' | 'mark' | 'ask' — sets the word budget
 * @param {boolean} [ctx.depth]    the student asked for depth: 150 words instead of 120
 * @param {number} [ctx.wordLimit] explicit override
 * @returns {{ok:boolean, violations:Array<{code:string,detail:string}>, rewritten:string, guidance:string}}
 */
export function vetTurn(draft, ctx = {}) {
  const item = ctx.item || {}
  const kind = ctx.itemKind || item.kind || 'short'
  const rung = Number(ctx.rung) || 1
  const violations = [
    ...checkLeak(draft, { ...ctx, item, itemKind: kind }),
    ...checkLength(draft, ctx),
    ...checkQuestions(draft),
    ...checkOpener(draft),
    ...checkPraise(draft),
    ...checkExclamation(draft),
    ...checkEmoji(draft),
    ...checkClosers(draft),
    ...checkHandback(draft, ctx),
  ]
  return {
    ok: violations.length === 0,
    violations,
    rewritten: repair(draft, { rung, item: { ...item, kind } }),
    guidance: rungGuidance(rung, kind),
  }
}

/**
 * True when every violation in a vet result is one `rewritten` fixed — the caller can
 * paint the repair instead of spending a regenerate.
 * @param {Array<{code:string}>} violations
 * @returns {boolean}
 */
export function isRepairable(violations = []) {
  return violations.every((x) => REPAIRABLE.has(x.code))
}
