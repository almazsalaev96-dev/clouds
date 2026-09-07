/**
 * The Effort Gate (spec §04.3).
 *
 * An attempt is a commitment, not a keystroke. This module decides whether a student
 * has committed something markable before solution content (ladder rungs 4-5, a
 * correctness confirmation, "Just the answer") may be handed over. It is pure: no
 * database, no model call, no clock of its own — everything it judges arrives as an
 * argument, so every rule below is directly testable.
 *
 * The gate never blocks rungs 1-3 (04-GATE-003). A closed gate is never a refusal
 * sentence: `message` always names the one thing to write next.
 */

/** Words carrying no subject meaning; stripped before any content-word test. */
const STOPWORDS = new Set((
  'a about above after again all also am an and any are as at be because been before being below ' +
  'between both but by can cant come could did do does doing done dont down during each else even ' +
  'ever every few for from further get gets give go going got had has have having he her here hers ' +
  'him his how i if in into is it its just know like made make many may me might more most much must ' +
  'my need no nor not now of off on once one only or other others our out over own put said same say ' +
  'see she should since so some still such take than that the their them then there these they thing ' +
  'things this those though through to too under until up upon us use used using very was way we well ' +
  'were what when where whether which while who whom why will with within would you your yours'
).split(' '))

/** Inputs that are keystrokes rather than commitments (04-GATE-008 `gate_quality = token`). */
const TOKEN_PATTERNS = [
  /^[\s.?!,-]*$/,
  /^(idk|dk|dunno|no ?idea|nothing|none|nope|help|hi|hey|hello|ok|okay|k|yes|yeah|no|maybe|sure|hmm+|meh)[\s.!?]*$/i,
  /^i\s*(really\s*)?do\s*n[o']?t\s*know[\s.!?]*$/i,
  /^i\s*have\s*no\s*idea[\s.!?]*$/i,
  /^(lorem|asdf|qwerty|test|blah)/i,
  /^(.)\1*$/,
]

/** Openers that mean "I am stuck" — they pass only with a specific sentence attached. */
const DONT_KNOW_OPENER = /\b(i\s*do\s*n[o']?t\s*know|i\s*have\s*no\s*idea|no\s*idea|i'?m\s*(really\s*)?stuck|i\s*can'?t\s*(see|work\s*out|start|get)|not\s*sure\s*how|i\s*don'?t\s*get)\b/i

/** An explicit surrender. Honoured after one real attempt (04.9 "I give up"). */
const GIVE_UP = /\b(i\s*give\s*up|giving\s*up|i\s*quit|just\s*tell\s*me|tell\s*me\s*the\s*answer|show\s*me\s*the\s*answer|forget\s*it)\b/i

/** A named method counts on a numeric item even with no arithmetic yet. */
const NAMED_METHOD = /\b(use|using|apply|applying|formula|equation|method|work\s*out|calculate|substitute|rearrange|divide|multiply|subtract|add)\b/i

/** Practical items need a variable named, not a sentiment. */
const VARIABLE_TALK = /\b(variable|independent|dependent|control|controlled|constant|keep\s+the\s+same|measure|repeat|vary|change)\b/i

/** A stated judgement is a levels attempt on its own. */
const JUDGEMENT = /\b(i\s*think|i'?d\s*argue|i\s*would\s*argue|in\s*my\s*view|overall|the\s*most\s*important|it\s*depends|therefore|because)\b/i

/** The per-item-kind line shown when nothing markable has been written yet. */
export const GATE_PROMPTS = Object.freeze({
  numeric: 'One line first: the method you would use, or your first step. A number on its own counts.',
  short: 'One sentence is enough — write the definition the way you would say it.',
  levels: 'Two bullet points or one stated judgement is enough to start.',
  mechanism: 'Name the first step in words — where it starts and what it acts on.',
  practical: 'Name the variable you would change and one you would keep the same.',
  default: 'One line of your own first — what you tried, or what is blocking you.',
})

/** Shown when the input is a keystroke rather than a commitment (04-GATE-002 wording). */
export const TOKEN_PROMPT = 'One sentence on what you do know is enough — what is the question asking for?'
/** Shown when the student has only asked a question back. */
export const QUESTION_ONLY_PROMPT = 'Say what you think first, even roughly, and I will work from your line.'
/** Shown when the student has pasted the stem back. */
export const STEM_COPY_PROMPT = 'That is the question again. Add one line of your own — a number, a method, or the word you are stuck on.'

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim()
const lower = (s) => norm(s).toLowerCase()

/** Words of ≥3 letters that are not stopwords. @param {string} text @returns {string[]} */
export function contentWords(text) {
  return lower(text)
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
}

/** True when the text contains a numeric value (a bare final answer counts on numeric items). */
export const hasNumber = (text) => /\d/.test(String(text || ''))

/** Word count, punctuation excluded. */
export const wordCount = (text) => (lower(text).match(/[a-z0-9][a-z0-9'-]*/g) || []).length

/**
 * Every sentence is a question — the student has asked, not committed.
 * @param {string} text
 * @returns {boolean}
 */
export function isQuestionOnly(text) {
  const t = norm(text)
  if (!t || !t.includes('?')) return false
  const sentences = t.split(/(?<=[.?!])\s+/).map(norm).filter(Boolean)
  if (!sentences.length) return false
  return sentences.every((s) => s.endsWith('?'))
}

/**
 * The student has handed the stem back. Two tests: the text is a long contiguous slice
 * of the stem, or almost none of its content words are new.
 * @param {string} text
 * @param {string} [stem]
 * @returns {boolean}
 */
export function looksLikeStemCopy(text, stem) {
  const t = lower(text)
  const s = lower(stem)
  if (!t || !s || t.length < 20) return false
  if (s.includes(t)) return true
  const stemWords = new Set(contentWords(s))
  const mine = contentWords(t)
  if (mine.length < 6) return false
  const novel = mine.filter((w) => !stemWords.has(w)).length
  return novel / mine.length < 0.25
}

/** The lexicon a domain term is checked against: the item's own vocabulary. */
function lexicon(item = {}) {
  const bag = new Set()
  const push = (s) => contentWords(s).forEach((w) => bag.add(w))
  for (const t of item.terms || []) push(t)
  for (const t of item.keywords || []) push(t)
  push(item.stem)
  push(item.title)
  push(item.syllabus_point)
  push(item.syllabus_title)
  push(item.command_word)
  return bag
}

/**
 * Does the student's text name something from this item's subject vocabulary?
 * With no item vocabulary to check against (a free Ask), six words of prose stands in.
 * @param {string} text
 * @param {object} [item]
 * @returns {boolean}
 */
export function hasDomainTerm(text, item = {}) {
  const bag = lexicon(item)
  const mine = contentWords(text)
  if (!bag.size) return mine.length >= 4 || wordCount(text) >= 6
  if (mine.some((w) => bag.has(w))) return true
  for (const term of [...(item.terms || []), ...(item.keywords || [])]) {
    if (term && lower(text).includes(lower(term))) return true
  }
  return false
}

/**
 * Gate quality (04-GATE-008): `substantive` opens everything, `token` opens rungs 1-4
 * but never rung 5, `none` is an empty composer.
 * @param {string} text
 * @param {object} [item] item context — `stem` and `lastTurn` are used to catch pastes.
 * @returns {'substantive'|'token'|'none'}
 */
export function classifyQuality(text, item = {}) {
  const t = norm(text)
  if (!t) return 'none'
  if (TOKEN_PATTERNS.some((re) => re.test(t))) return 'token'
  if (t.length < 3) return 'token'
  const words = contentWords(t)
  if (words.length >= 3 && new Set(words).size / words.length < 0.5) return 'token'
  if (looksLikeStemCopy(t, item.stem)) return 'token'
  if (item.lastTurn && looksLikeStemCopy(t, item.lastTurn)) return 'token'
  if (words.length === 0 && !hasNumber(t)) return 'token'
  return 'substantive'
}

/**
 * One attempt-shaped line: enough to end a 90-second time-box, below the bar for a
 * cold attempt. Four words, or a number, and not a token.
 * @param {string} text
 * @param {object} [item]
 * @returns {boolean}
 */
export function attemptShaped(text, item = {}) {
  if (classifyQuality(text, item) !== 'substantive') return false
  return wordCount(text) >= 4 || hasNumber(text)
}

/** A plan: two or more bullet or numbered lines (04-LADR-006 — a first-class artefact). */
export function looksLikePlan(text) {
  const lines = String(text || '').split(/\n+/).map(norm).filter(Boolean)
  const bullets = lines.filter((l) => /^([-*•]|\d+[.)])\s+/.test(l) && wordCount(l) >= 2)
  if (bullets.length >= 2) return true
  const semi = norm(text).split(/;\s*/).filter((s) => wordCount(s) >= 3)
  return semi.length >= 2 && /^(plan|point 1|first)/i.test(norm(text))
}

/**
 * Does this text satisfy the gate for this item kind? (04.3 table.)
 * @param {string} text
 * @param {'numeric'|'short'|'levels'|'mechanism'|'practical'|string} kind
 * @param {object} [item]
 * @returns {boolean}
 */
export function satisfiesByKind(text, kind, item = {}) {
  const t = norm(text)
  const words = wordCount(t)
  const term = hasDomainTerm(t, item)
  switch (kind) {
    case 'numeric':
      // A final value, a first line of working, or a named method.
      if (hasNumber(t)) return true
      return words >= 4 && term && NAMED_METHOD.test(t)
    case 'levels':
      // A plan of two points, a first paragraph, or a stated judgement.
      if (looksLikePlan(t)) return true
      if (words >= 25 && term) return true
      return words >= 8 && term && JUDGEMENT.test(t)
    case 'mechanism':
      return words >= 5 && term
    case 'practical':
      return words >= 6 && term && VARIABLE_TALK.test(t)
    case 'short':
    default:
      // A definition or one-sentence answer, even wrong.
      return (words >= 4 && term) || (words >= 6) || (hasNumber(t) && words >= 2)
  }
}

/** "I don't know" plus one specific sentence of what they do know (04.3, any item type). */
function dontKnowPlusSentence(text, item) {
  if (!DONT_KNOW_OPENER.test(text)) return false
  const rest = norm(String(text).replace(DONT_KNOW_OPENER, ' '))
  return wordCount(rest) >= 4 && (hasDomainTerm(rest, item) || hasNumber(rest))
}

/**
 * Decide whether the gate is open on this item for this student.
 *
 * `open: true` means solution content may be handed over — the ladder's own cap
 * (see `ladder.rungBudget`) still applies, and `maxRung` carries the 04-GATE-008 rule
 * that a token input never reaches rung 5.
 *
 * Exceptions that open the gate with no attempt:
 *   - `never_taught` — mastery 0 with no prior attempt on the syllabus point, so the
 *     entry rung (4, or 4a on a levels item) is the right assistance, not a gate;
 *   - `two_attempts` — the student has already committed twice on this item;
 *   - `gave_up` — an explicit "I give up" after one real attempt;
 *   - `timebox_line` — the 90-second time-box has elapsed and one attempt-shaped line
 *     has been written (04-GATE-002).
 *
 * @param {Object} input
 * @param {string} input.text            what the student just wrote
 * @param {Object} input.item            `{kind, stem, terms?, keywords?, syllabus_point?, command_word?, lastTurn?}`
 * @param {number} input.mastery         unaided mastery of the item's syllabus point, 0-1
 * @param {number} input.secondsOnItem   seconds since the item was shown
 * @param {number} input.priorAttempts   committed attempts already made on this item
 * @returns {{open:boolean, reason:string, message:string|null, kind:'substantive'|'token'|'none', maxRung:number, timebox:boolean}}
 */
export function evaluateGate({ text = '', item = {}, mastery = 0, secondsOnItem = 0, priorAttempts = 0 } = {}) {
  const itemKind = item.kind || 'short'
  const quality = classifyQuality(text, item)
  const seconds = Number(secondsOnItem) || 0
  const tries = Number(priorAttempts) || 0
  const m = Number(mastery) || 0

  const open = (reason, message = null) => ({
    open: true,
    reason,
    message,
    kind: quality,
    maxRung: quality === 'substantive' ? 5 : 4,
    timebox: false,
  })
  const shut = (reason, message) => ({
    open: false,
    reason,
    message,
    kind: quality,
    maxRung: 3,
    timebox: seconds >= 20 || tries >= 1 || quality === 'token',
  })

  // 1. A real commitment, judged against the item kind.
  if (quality === 'substantive') {
    if (dontKnowPlusSentence(text, item)) return open('dont_know_plus_sentence')
    if (itemKind === 'levels' && looksLikePlan(text)) return open('plan')
    if (!isQuestionOnly(text) && satisfiesByKind(text, itemKind, item)) return open('attempt')
  }

  // 2. Exceptions earned by what the student has already done on this item.
  if (tries >= 2) return open('two_attempts')
  if (GIVE_UP.test(text) && tries >= 1) return open('gave_up')
  if (seconds >= 90 && attemptShaped(text, item)) return open('timebox_line')

  // 3. Closed — say what to write, never why it is being withheld.
  //
  // These run BEFORE the never-taught exception on purpose. An empty box, a bare
  // "idk", a pasted stem or a bare question is not an attempt, and on a topic the
  // student has never met it is exactly the moment the gate exists for: the prompt
  // is what elicits the first commitment. Teaching is not what is gated — rungs 1–3
  // stay available through the ladder — only solution content is.
  if (quality === 'none') return shut('no_attempt', GATE_PROMPTS[itemKind] || GATE_PROMPTS.default)
  if (looksLikeStemCopy(text, item.stem)) return shut('stem_copy', STEM_COPY_PROMPT)
  if (quality === 'token') return shut('token', TOKEN_PROMPT)
  if (isQuestionOnly(text)) return shut('question_only', QUESTION_ONLY_PROMPT)

  // 4. Never taught: the student wrote something real but thin on a point they have
  //    never attempted. Assist at the entry rung rather than gate them — but cap the
  //    assistance below the worked step, since nothing has been committed yet.
  if (m <= 0 && tries === 0) return { ...open('never_taught'), maxRung: 3 }

  return shut('thin_attempt', GATE_PROMPTS[itemKind] || GATE_PROMPTS.default)
}
