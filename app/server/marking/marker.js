/**
 * The Examiner Twin (§05.4, §05.5).
 *
 * mark() returns a Mark object: marks per assessment objective with the level and
 * the descriptor relied on, evidence quoted verbatim from the student's own answer
 * with character offsets, the points or descriptors missed, a command-word check,
 * the cover-the-name application test, a confidence band, a calibration badge and
 * exactly one next action.
 *
 * The division of labour is deliberate. The model is asked only for judgements —
 * which marking points are met, which band fits, where the evidence sits. Totals,
 * ordering, dependencies, error-carried-forward, the application test, the
 * annotations and the badge are computed here, in code, where they can be tested
 * and cannot drift. Every quoted span is checked against the answer before it is
 * allowed into the Mark: a fabricated quote is the fastest way to lose a student.
 *
 * Nothing here throws when the model is absent or unusable. With no API key the
 * router hands over the mock provider, the structured call fails to parse, and the
 * deterministic judge below marks the answer instead — the Mark then says so.
 */

import { randomUUID } from 'node:crypto'
import { extractJson } from '../providers/types.js'
import {
  AO_ORDER, AO_ROLE, REASON_CODES, REASON_TEXT, deepFreeze, parseScheme,
  commandWordRule, aosUnderCeiling, levelFor, bandForMark, pointById, sharesSpan,
} from './scheme.js'

// ─────────────────────────────────────────────────────────────── text utilities

/** Line index over the answer, so every span can carry a line reference. */
export function lineIndex(text) {
  const lines = []
  let start = 0
  let n = 1
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      lines.push({ n, start, end: i, text: text.slice(start, i) })
      start = i + 1
      n++
    }
  }
  return lines
}

/** "L11–L14" for a span, or "L7" when it sits on one line. */
export function lineRef(lines, start, end) {
  const from = lines.find((l) => start >= l.start && start <= l.end) || lines[0]
  let to = from
  for (const l of lines) if (end > l.start && end <= l.end + 1) to = l
  if (!from) return null
  return from.n === to.n ? `L${from.n}` : `L${from.n}–L${to.n}`
}

const WS = /\s+/g
const norm = (s) => String(s || '').replace(WS, ' ').trim()

/**
 * 05-MARK-001. Confirm a quote really is the student's text.
 * Exact at the offsets given → kept. Verbatim somewhere else in the answer →
 * offsets corrected and the repair recorded. Anything else → dropped.
 */
export function locateQuote(text, quote, hintStart) {
  const q = String(quote || '')
  if (!q.trim()) return null
  if (Number.isInteger(hintStart) && hintStart >= 0 && text.slice(hintStart, hintStart + q.length) === q) {
    return { start: hintStart, end: hintStart + q.length, repaired: false }
  }
  const direct = text.indexOf(q)
  if (direct >= 0) return { start: direct, end: direct + q.length, repaired: true }

  // Whitespace differs (a line break the model turned into a space, say).
  const flat = norm(q)
  if (!flat) return null
  const map = []
  let flatText = ''
  let pending = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (/\s/.test(c)) { pending = flatText.length > 0; continue }
    if (pending) { flatText += ' '; map.push(i); pending = false }
    flatText += c
    map.push(i)
  }
  const at = flatText.indexOf(flat)
  if (at < 0) return null
  const start = map[at]
  const end = map[at + flat.length - 1] + 1
  return { start, end, repaired: true }
}

const STOP = new Set(['this', 'that', 'these', 'those', 'with', 'from', 'into', 'they', 'them', 'their',
  'have', 'has', 'had', 'been', 'being', 'will', 'would', 'could', 'should', 'there', 'then', 'than',
  'because', 'which', 'what', 'when', 'where', 'also', 'more', 'most', 'some', 'such', 'very', 'much',
  'each', 'both', 'about', 'over', 'under', 'other', 'another', 'does', 'doing', 'were', 'was', 'are',
  'and', 'the', 'for', 'not', 'but', 'its', 'it', 'a', 'an', 'of', 'to', 'in', 'on', 'as', 'is', 'be'])

// "three years" is a figure from the case; "one product" is an article. Words below
// three are quantifiers far more often than they are data, so they are not mapped.
const WORD_NUM = {
  three: '3', four: '4', five: '5', six: '6',
  seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
}

function stem(w) {
  let s = w
  for (const suf of ['isation', 'ization', 'ations', 'ation', 'ising', 'izing', 'ings', 'ing', 'ies', 'ied', 'ers', 'er', 'ed', 'es', 's']) {
    if (s.length - suf.length >= 4 && s.endsWith(suf)) { s = s.slice(0, -suf.length); break }
  }
  return s
}

function wordsMatch(a, b) {
  if (a === b) return true
  const sa = stem(a)
  const sb = stem(b)
  if (sa === sb) return true
  if (sa.length >= 5 && sb.startsWith(sa)) return true
  if (sb.length >= 5 && sa.startsWith(sb)) return true
  return false
}

/** Content words: the ones that carry the meaning a scheme is looking for. */
export function contentWords(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9%$'\s-]/g, ' ')
    .split(/[\s-]+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length >= 3 && !STOP.has(w))
}

/** Figures, normalised so "$40 000", "40,000" and "40000" are one number. */
export function numbersIn(s) {
  const t = String(s || '').toLowerCase().replace(/(\d)[\s,](?=\d{3}\b)/g, '$1')
  const out = new Set()
  for (const m of t.matchAll(/\d+(?:\.\d+)?/g)) out.add(String(Number(m[0])))
  for (const [word, digit] of Object.entries(WORD_NUM)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) out.add(digit)
  }
  return [...out]
}

/** How much of `needle` (a scheme phrase) is present in `haystack` (the answer). */
function overlap(needle, haystack) {
  const want = [...new Set(contentWords(needle))]
  if (!want.length) return 0
  const have = contentWords(haystack)
  let hits = 0
  for (const w of want) if (have.some((h) => wordsMatch(w, h))) hits++
  return hits / want.length
}

/** Sentences with their offsets. Blank lines end a sentence too. */
export function sentences(text) {
  const out = []
  let start = 0
  const push = (from, to) => {
    let a = from
    while (a < to && /\s/.test(text[a])) a++
    let b = to
    while (b > a && /\s/.test(text[b - 1])) b--
    if (b - a >= 3) out.push({ text: text.slice(a, b), start: a, end: b })
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if ((c === '.' || c === '!' || c === '?') && (i + 1 >= text.length || /\s/.test(text[i + 1]))) {
      push(start, i + 1); start = i + 1
    } else if (c === '\n' && /\n/.test(text.slice(i + 1, i + 3))) {
      push(start, i); start = i + 1
    }
  }
  push(start, text.length)
  return out
}

function paragraphOf(text, offset) {
  const before = text.lastIndexOf('\n\n', offset)
  return before < 0 ? 0 : before
}

// ───────────────────────────────────────────────────── deterministic evidence

// 05-PROC-002: count links, never words.
const LINK_RE = /\b(?:which (?:would|will|can|could|may|might|then|in turn|cuts?|raises?|lowers?|reduces?|increases?)|so that|so\b|therefore|thus|hence|consequently|as a result|resulting in|results? in|leads? to|leading to|causes?|causing|because|since|means that|means\b|enabl\w+|allow\w+|forc\w+|in turn|this makes)\b/gi
const CONDITIONAL_RE = /(?:^|[.\n]\s*)(?:if|when|where)\b/gi

export function countLinks(text) {
  const a = [...String(text || '').matchAll(LINK_RE)].length
  const b = [...String(text || '').matchAll(CONDITIONAL_RE)].length
  return Math.min(6, a + b)
}

const JUDGEMENT_RE = /\b(?:should|ought to|must (?:choose|pursue|adopt)|recommend\w*|i would (?:choose|advise|recommend)|the better option|the best option|is preferable|conclude that|is the right)\b/i
const HEDGE_RE = /\b(?:it (?:really )?depends|depends on the situation|both (?:have|are|options|strategies)|advantages and disadvantages|whichever|some .{0,40} and some|either could)\b/i
/** A conclusion that decides nothing — the reason it earns no evaluation mark. */
const NON_DECISION_RE = /\b(?:it (?:really )?depends|depends on the situation|advantages and disadvantages|whichever|either could|some .{0,40} and some do not)\b/i
const WEIGH_STRONG_RE = /\b(?:outweigh\w*|more important than|less important than|greater than|on balance|rather than|in the (?:long|short) (?:run|term)|the main .{0,20}(?:risk|cost|benefit|factor))\b/i
const WEIGH_WEAK_RE = /\b(?:whereas|however|although)\b/i
const CONDITION_RE = /\b(?:provided that|as long as|only if|unless|so long as|if the .{0,60}(?:falls|rises|holds|continues|refuse|is)|given the)\b/i
const DEFINITION_RE = /\b(?:means|is defined as|is when|refers to|is a |are a |is the process)\b/i
const WORKING_RE = /[=+×÷*/]|\b\d+\s*[-+x*/]\s*\d+/

/**
 * Is this sentence a definition rather than a step in an argument? "X means Y" is a
 * concept; "the constraint means the costs would need debt" is a causal link. The
 * difference is where the verb sits: a definition names its subject and then defines it.
 */
function definitionAt(text) {
  const m = DEFINITION_RE.exec(text)
  return m && m.index < 45 && text.length < 260 ? m : null
}

/** Two spans covering the same stretch of the answer are one span. Keep the stronger. */
const CLASS_RANK = { credited: 3, partial: 2, uncredited: 1 }
function dedupeSpans(spans) {
  const out = []
  for (const s of spans) {
    const clash = out.find((o) => Math.max(o.char_start, s.char_start) < Math.min(o.char_end, s.char_end))
    if (!clash) { out.push(s); continue }
    if ((CLASS_RANK[s.class] || 0) > (CLASS_RANK[clash.class] || 0)) out[out.indexOf(clash)] = s
  }
  return out.sort((a, b) => a.char_start - b.char_start)
}

/**
 * Everything the engine can establish without asking a model: the concepts named,
 * the causal chains and how many links each carries, the spans that use a fact
 * true only of this business, the judgement, the weighing and the condition.
 */
export function evidenceSignals(answer, scheme) {
  const sents = sentences(answer)
  const ctx = scheme?.context || null

  const concepts = []
  const seenConcept = new Set()
  for (const s of sents) {
    let label = null
    for (const ic of scheme?.indicative || []) {
      if (overlap(ic.text, s.text) >= 0.5) { label = ic.text; break }
    }
    if (!label) {
      for (const p of scheme?.points || []) {
        if (p.ao === 'AO1' && overlap(p.text, s.text) >= 0.6) { label = p.text; break }
      }
    }
    if (!label && definitionAt(s.text)) {
      label = s.text.slice(0, definitionAt(s.text).index).trim() || s.text.slice(0, 60)
    }
    if (!label) continue
    const key = contentWords(label).slice(0, 3).join(' ')
    if (seenConcept.has(key)) continue
    seenConcept.add(key)
    concepts.push({ label, start: s.start, end: s.end, quote: s.text })
  }

  const chains = []
  let open = null
  for (const s of sents) {
    // A definition is a concept, not a link: "X means Y" states, it does not explain.
    const links = definitionAt(s.text) ? 0 : countLinks(s.text)
    if (links > 0) {
      if (open && paragraphOf(answer, s.start) === open.para) {
        open.end = s.end
        open.links = Math.min(4, open.links + links)
        open.quote = answer.slice(open.start, open.end)
      } else {
        open = { start: s.start, end: s.end, links: Math.min(4, links), quote: s.text, para: paragraphOf(answer, s.start) }
        chains.push(open)
      }
    } else {
      open = null
    }
  }
  chains.sort((a, b) => b.links - a.links)

  const applications = []
  for (const s of sents) {
    const looksApplied = /\d/.test(s.text) || (ctx?.businessName && s.text.includes(ctx.businessName))
      || (ctx?.caseFacts || []).some((f) => overlap(f, s.text) >= 0.4)
    if (!looksApplied) continue
    const verdict = coverTheName(s.text, ctx)
    applications.push({ start: s.start, end: s.end, quote: s.text, ...verdict })
  }

  const judgements = []
  for (const s of sents) {
    if (!JUDGEMENT_RE.test(s.text)) continue
    judgements.push({ start: s.start, end: s.end, quote: s.text, committed: !HEDGE_RE.test(s.text) })
  }
  const hedges = sents.filter((s) => NON_DECISION_RE.test(s.text) && !JUDGEMENT_RE.test(s.text))
    .map((s) => ({ start: s.start, end: s.end, quote: s.text }))
  const weighings = sents
    .map((s) => ({ s, weight: WEIGH_STRONG_RE.test(s.text) ? 2 : WEIGH_WEAK_RE.test(s.text) ? 1 : 0 }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.s.start - b.s.start)
    .map(({ s, weight }) => ({ start: s.start, end: s.end, quote: s.text, weight }))
  const conditions = sents.filter((s) => CONDITION_RE.test(s.text))
    .map((s) => ({ start: s.start, end: s.end, quote: s.text }))

  const data = []
  for (const s of sents) {
    if (!/\d/.test(s.text)) continue
    const verdict = usesSuppliedData(s.text, ctx)
    data.push({ start: s.start, end: s.end, quote: s.text, ...verdict })
  }

  return {
    sentences: sents, concepts, chains, applications, judgements, hedges, weighings, conditions, data,
    hasWorking: WORKING_RE.test(answer),
    committed: judgements.some((j) => j.committed),
  }
}

/**
 * The cover-the-name test (05-MARK-006). Would this sentence still be true with any
 * other firm's name in it? If yes it is not application. `context.case_facts` is the
 * only ground truth (05-SCHM-008).
 */
export function coverTheName(quote, context) {
  if (!context || !context.caseFacts?.length) {
    return { pass: false, fact: null, reason_code: 'GENERIC_NOT_CONTEXT' }
  }
  const name = (context.businessName || '').toLowerCase()
  const stripped = name ? String(quote).toLowerCase().split(name).join(' ') : String(quote).toLowerCase()
  const qNums = numbersIn(stripped)
  const qWords = contentWords(stripped)
  for (const fact of context.caseFacts) {
    const fNums = numbersIn(fact)
    if (fNums.length && fNums.some((n) => qNums.includes(n))) return { pass: true, fact, reason_code: null }
    // Words short enough to be common ("one", "line", "risk") prove nothing: a span
    // passes on distinctive wording only, or it is not application.
    const fWords = [...new Set(contentWords(fact))].filter((w) => w !== name && w.length >= 5)
    if (!fWords.length) continue
    const shared = fWords.filter((w) => qWords.some((q) => wordsMatch(w, q)))
    if (shared.length >= Math.min(2, fWords.length)) return { pass: true, fact, reason_code: null }
  }
  return { pass: false, fact: null, reason_code: 'GENERIC_NOT_CONTEXT' }
}

/** 05-MARK-015. On a data-response item the credit-bearing behaviour is using the figures. */
export function usesSuppliedData(quote, context) {
  const series = context?.dataSeries || []
  if (!series.length) return { pass: false, series: null, reason_code: 'DATA_NOT_USED' }
  const qNums = numbersIn(quote)
  for (const s of series) {
    const values = s.values.map((v) => String(v))
    if (values.some((v) => qNums.includes(v))) return { pass: true, series: s.label, reason_code: null }
    if (overlap(s.label, quote) >= 0.6 && /\b(?:rose|fell|increase\w*|decrease\w*|trend|highest|lowest|doubled|halved)\b/i.test(quote)) {
      return { pass: true, series: s.label, reason_code: null }
    }
  }
  return { pass: false, series: null, reason_code: 'DATA_NOT_USED' }
}

// ─────────────────────────────────────────────────────────────── the prose lint

const PRAISE = /\b(?:great|excellent|well done|fantastic|amazing|good job|brilliant|nice work|perfect|impressive|superb|wonderful|awesome|keep it up)\b/i

/** §04 lint: no praise, no exclamation marks, no emoji in any free-text field. */
export function lintProse(text) {
  if (!text) return null
  const clean = String(text).replace(/!+/g, '.').replace(/\s*\.\s*\./g, '.').trim()
  if (!clean) return null
  if (PRAISE.test(clean)) return null
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(clean)) return null
  return clean
}

const countWords = (s) => (String(s || '').trim() ? String(s).trim().split(/\s+/).length : 0)

// ───────────────────────────────────────────────────────────── the model prompt

function gridText(scheme, aoOrder) {
  const lines = []
  for (const ao of aoOrder) {
    const grid = scheme.levels.find((g) => g.ao === ao)
    if (!grid) continue
    lines.push(`${ao} — ${grid.max} marks`)
    for (const b of grid.bands) {
      const rule = b.evidenceRule ? ` · evidence: ${b.evidenceRule}` : ''
      lines.push(`  Level ${b.level} (${b.range[0]}–${b.range[1]}): ${b.descriptor}${rule}`)
      if (b.withinBandRule) {
        for (let m = b.range[0]; m <= b.range[1]; m++) {
          lines.push(`    ${m}: ${b.withinBandRule[m]}`)
        }
      }
    }
  }
  return lines.join('\n')
}

function pointsText(scheme, order) {
  return order.map((p) => {
    const bits = [`${p.id} [${p.type}${p.ao ? ' ' + p.ao : ''}, ${p.marks} mark${p.marks === 1 ? '' : 's'}] ${p.text}`]
    if (p.conjunctive.length) bits.push(`  every part required: ${p.conjunctive.map((a) => a.text).join(' AND ')}`)
    if (p.alternatives.length) bits.push(`  alternatives (credit once): ${p.alternatives.join(' // ')}`)
    if (p.accept.length) bits.push(`  accept: ${p.accept.join('; ')}`)
    if (p.reject.length) bits.push(`  reject: ${p.reject.join('; ')}`)
    if (p.dependsOn) bits.push(`  depends on ${p.dependsOn}`)
    return bits.join('\n')
  }).join('\n')
}

function buildSystem(scheme, item, cw, ordering) {
  const parts = []
  parts.push(`You are the examiner for ${item.paper ? `Paper ${item.paper}` : 'this paper'}. You mark to the scheme below and to nothing else. You are marking one response, not writing a report about it.`)
  parts.push(`Procedure — ${scheme.levelProcedure}. ${scheme.kind === 'levels' || scheme.kind === 'mixed'
    ? 'Level each assessment objective independently from its own grid. Read the whole response for that objective, choose the band whose descriptor is the best fit — the response need not meet every clause — then place the mark inside the band by the band\'s own rule. Evidence for one objective never lifts another.'
    : 'Credit each marking point independently against the response. A point with several required parts is credited only when every part is evidenced; say which part failed.'}`)
  parts.push([
    'Rules you do not bend:',
    '- Credit what the answer says, never what it implies you would have written.',
    '- Every quote must be copied character for character from the answer. Do not tidy, shorten or correct it.',
    '- Count causal links, never words. A link joins a cause to a mechanism, an effect or a consequence.',
    '- Application is credited only for a fact that is true of this business alone.',
    '- One span may serve two assessment objectives. It may not serve two marking points unless the scheme licenses it.',
    '- Examiner voice: no praise, no encouragement, no exclamation marks.',
  ].join('\n'))
  parts.push(`Command word: ${cw.word || 'none stated'} — ${cw.requirement}. Objectives on offer: ${aosUnderCeiling(scheme.aoCeiling).join(', ')}.`)
  parts.push(`Question (${scheme.marksTotal} marks):\n${item.stem || ''}`)
  if (item.stimulus) parts.push(`Stimulus:\n${item.stimulus}`)
  if (scheme.levels.length) parts.push(`The grid:\n${gridText(scheme, ordering.aoOrder)}`)
  if (scheme.points.length) parts.push(`Marking points:\n${pointsText(scheme, ordering.pointOrder)}`)
  if (scheme.indicative.length) {
    parts.push(`Indicative content — a guide, not a checklist. Credit a valid alternative and say so:\n${ordering.indicative.map((ic) => `- ${ic.text}`).join('\n')}`)
  }
  if (scheme.context?.caseFacts?.length) {
    parts.push(`Case facts — the only ground truth for application:\n${scheme.context.caseFacts.map((f) => `- ${f}`).join('\n')}`)
  }
  if (scheme.context?.dataSeries?.length) {
    parts.push(`Supplied figures — the only ground truth for the data check:\n${scheme.context.dataSeries.map((s) => `- ${s.label}${s.unit ? ` (${s.unit})` : ''}: ${s.values.join(', ')}`).join('\n')}`)
  }
  parts.push('Return JSON only, in the shape the schema names. Offsets are character positions in the answer text exactly as it is given to you.')
  return parts.join('\n\n')
}

const SPAN_SCHEMA = {
  type: 'object',
  required: ['quote', 'class'],
  properties: {
    quote: { type: 'string' },
    char_start: { type: 'integer' },
    char_end: { type: 'integer' },
    class: { type: 'string', enum: ['credited', 'partial', 'uncredited'] },
    evidence_kind: { type: 'string' },
    links_counted: { type: 'integer' },
    reason_code: { type: 'string', enum: REASON_CODES },
    reason: { type: 'string' },
  },
}

const LEVELS_SCHEMA = {
  type: 'object',
  required: ['per_ao'],
  properties: {
    per_ao: {
      type: 'array',
      items: {
        type: 'object',
        required: ['ao', 'level', 'marks', 'spans'],
        properties: {
          ao: { type: 'string' },
          level: { type: 'integer' },
          marks: { type: 'integer' },
          within_band_reason: { type: 'string' },
          spans: { type: 'array', items: SPAN_SCHEMA },
          missing: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    advice: {
      type: 'object',
      properties: { target_ao: { type: 'string' }, text: { type: 'string' } },
    },
  },
}

const POINTS_SCHEMA = {
  type: 'object',
  required: ['per_point'],
  properties: {
    per_point: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'met'],
        properties: {
          id: { type: 'string' },
          met: { type: 'boolean' },
          method_correct: { type: 'boolean' },
          atoms: {
            type: 'array',
            items: {
              type: 'object',
              required: ['text', 'met'],
              properties: { text: { type: 'string' }, met: { type: 'boolean' } },
            },
          },
          quote: { type: 'string' },
          char_start: { type: 'integer' },
          char_end: { type: 'integer' },
          links_counted: { type: 'integer' },
          reason_code: { type: 'string', enum: REASON_CODES },
          reason: { type: 'string' },
        },
      },
    },
    uncredited: { type: 'array', items: SPAN_SCHEMA },
    advice: { type: 'object', properties: { target_ao: { type: 'string' }, text: { type: 'string' } } },
  },
}

/** A mixed scheme is levelled and pointed in one call. */
const MIXED_SCHEMA = {
  type: 'object',
  required: ['per_ao', 'per_point'],
  properties: { ...LEVELS_SCHEMA.properties, ...POINTS_SCHEMA.properties },
}

function schemaFor(scheme) {
  if (scheme.levels.length && scheme.points.length) return MIXED_SCHEMA
  return scheme.levels.length ? LEVELS_SCHEMA : POINTS_SCHEMA
}

async function callModel({ provider, model, system, user, schema, effort, budgetMs }) {
  if (!provider || typeof provider.complete !== 'function') return null
  let timer = null
  try {
    const work = provider.complete({
      system,
      messages: [{ role: 'user', content: user }],
      schema,
      effort: effort || 'high',
      maxTokens: 4000,
      temperature: 0,
      model,
    })
    const guard = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('marking call exceeded its budget')), Math.max(1000, budgetMs || 45000))
    })
    const res = await Promise.race([work, guard])
    const data = res?.json ?? extractJson(res?.text || '')
    if (!data || typeof data !== 'object') return null
    return { data, model: res?.model || model, usage: res?.usage || null, costUsd: res?.costUsd ?? null }
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// ────────────────────────────────────────────────── reading the model's answer

function readSpan(raw, answer, lines, dropped, where) {
  const quote = typeof raw?.quote === 'string' ? raw.quote : ''
  const at = locateQuote(answer, quote, Number.isInteger(raw?.char_start) ? raw.char_start : null)
  if (!at) {
    dropped.push({ where, quote: quote.slice(0, 120), reason: 'not a verbatim substring of the answer' })
    return null
  }
  const reasonCode = REASON_CODES.includes(raw?.reason_code) ? raw.reason_code : null
  return {
    quote: answer.slice(at.start, at.end),
    char_start: at.start,
    char_end: at.end,
    line_ref: lineRef(lines, at.start, at.end),
    evidence_kind: typeof raw?.evidence_kind === 'string' ? raw.evidence_kind.slice(0, 40) : null,
    links_counted: Number.isInteger(raw?.links_counted) ? raw.links_counted : null,
    reason_code: reasonCode,
    reason: lintProse(raw?.reason) || (reasonCode ? REASON_TEXT[reasonCode] : null),
    marking_point_id: typeof raw?.marking_point_id === 'string' ? raw.marking_point_id : null,
    case_fact_ref: null,
    repaired: at.repaired,
  }
}

function readLevelsJudgement(data, { scheme, answer, lines, dropped }) {
  const rows = Array.isArray(data?.per_ao) ? data.per_ao : []
  if (!rows.length) return null
  const byAo = new Map()
  for (const row of rows) {
    const ao = String(row?.ao || '').toUpperCase().replace(/[\s_-]/g, '')
    const grid = scheme.levels.find((g) => g.ao === ao)
    if (!grid) continue
    const bands = grid.bands
    let level = Number.isInteger(row?.level) ? row.level : null
    let band = level == null ? null : bands.find((b) => b.level === level)
    if (!band) {
      const marks = Number.isInteger(row?.marks) ? row.marks : 0
      band = bandForMark(ao, Math.max(0, Math.min(marks, grid.max)), scheme) || bands[bands.length - 1]
      level = band.level
    }
    const marks = Math.max(band.range[0], Math.min(band.range[1], Number.isInteger(row?.marks) ? row.marks : band.range[0]))
    const spans = (Array.isArray(row?.spans) ? row.spans : [])
      .map((s) => {
        const span = readSpan(s, answer, lines, dropped, `${ao} span`)
        if (!span) return null
        const klass = ['credited', 'partial', 'uncredited'].includes(s?.class) ? s.class : 'credited'
        return { ...span, class: klass }
      })
      .filter(Boolean)
    const missing = (Array.isArray(row?.missing) ? row.missing : [])
      .map((m) => lintProse(m)).filter(Boolean).slice(0, 3)
    byAo.set(ao, { ao, max: grid.max, level, marks, band, spans, missing })
  }
  for (const grid of scheme.levels) if (!byAo.has(grid.ao)) return null
  return scheme.levels.map((g) => byAo.get(g.ao))
}

function readPointsJudgement(data, { scheme, answer, lines, dropped }) {
  const rows = Array.isArray(data?.per_point) ? data.per_point : []
  if (!rows.length) return null
  const byId = new Map()
  for (const row of rows) {
    const point = pointById(scheme, String(row?.id || ''))
    if (!point) continue
    const span = row?.quote ? readSpan(row, answer, lines, dropped, `point ${point.id}`) : null
    const spanDropped = !!row?.quote && !span
    const atoms = point.conjunctive.map((atom) => {
      const said = (Array.isArray(row?.atoms) ? row.atoms : []).find((a) => overlap(atom.text, a?.text || '') >= 0.6)
      return { text: atom.text, met: said ? said.met === true : row?.met === true }
    })
    byId.set(point.id, {
      id: point.id,
      met: row?.met === true,
      methodCorrect: row?.method_correct === true,
      atoms,
      span,
      spanDropped,
      links: Number.isInteger(row?.links_counted) ? row.links_counted : null,
      reasonCode: REASON_CODES.includes(row?.reason_code) ? row.reason_code : null,
      reason: lintProse(row?.reason),
    })
  }
  if (byId.size < Math.ceil(scheme.points.length / 2)) return null
  return {
    perPoint: scheme.points.map((p) => byId.get(p.id) || { id: p.id, met: false, atoms: [], span: null, reasonCode: null, reason: null }),
    uncredited: (Array.isArray(data?.uncredited) ? data.uncredited : [])
      .map((s) => readSpan(s, answer, lines, dropped, 'uncredited'))
      .filter(Boolean),
  }
}

/** One model reply → whichever halves of the judgement it actually carries. */
function readRun(data, opts) {
  const { scheme } = opts
  const wantsLevels = scheme.levels.length > 0
  const wantsPoints = scheme.points.length > 0
  const perAo = wantsLevels ? readLevelsJudgement(data, opts) : null
  const points = wantsPoints ? readPointsJudgement(data, opts) : null
  if (wantsLevels && !perAo) return null
  if (wantsPoints && !points) return null
  return {
    source: 'model',
    perAo,
    perPoint: points?.perPoint || null,
    uncredited: points?.uncredited || [],
    advice: readAdvice(data?.advice),
  }
}

function readAdvice(raw) {
  if (!raw || typeof raw !== 'object') return null
  const text = lintProse(raw.text)
  if (!text) return null
  const ao = String(raw.target_ao || '').toUpperCase().replace(/[\s_-]/g, '')
  return { targetAo: AO_ORDER.includes(ao) ? ao : null, text: text.slice(0, 320) }
}

// ─────────────────────────────────────────────────── the deterministic marker

const bandAt = (grid, level) => grid.bands.find((b) => b.level === level) || grid.bands[grid.bands.length - 1]
const topLevel = (grid) => grid.bands[0].level

/** Place a mark inside a band: the floor, plus one mark per `step` units of surplus evidence. */
function withinBand(band, surplus, step) {
  const [lo, hi] = band.range
  return Math.max(lo, Math.min(hi, lo + Math.floor(Math.max(0, surplus) / step)))
}


/** The next mark inside this band that asks for something the answer has not done. */
function nextRuleStep(band, marks) {
  const rules = band.withinBandRule
  if (!rules) return null
  const here = rules[marks]
  let from = null
  for (let m = marks + 1; m <= band.range[1]; m++) {
    if (rules[m] && rules[m] !== here) { from = m; break }
  }
  if (from == null) return null
  let to = from
  while (to + 1 <= band.range[1] && rules[to + 1] === rules[from]) to++
  return { label: to > from ? `${from}–${to}` : `${from}`, text: rules[from] }
}

function heuristicLevels(scheme, signals, answer, lines) {
  const perAo = scheme.levels.map((grid) => {
    const ao = grid.ao
    const role = AO_ROLE[ao] || 'knowledge'
    const top = topLevel(grid)
    let level = 0
    let surplus = 0
    let step = 1
    const spans = []
    const missing = []

    if (role === 'analysis') {
      const developed = signals.chains.filter((c) => c.links >= 2)
      const single = signals.chains.filter((c) => c.links === 1)
      if (developed.length) {
        level = Math.min(top, developed.length >= 2 && top >= 3 ? 3 : 2)
        const band = bandAt(grid, level)
        surplus = (developed[0].links - 2) + (developed.length - 1) * 2
        step = band.range[1] - band.range[0] >= 3 ? 2 : 1
      } else if (single.length) {
        level = Math.min(top, 1)
        surplus = single.length - 1
      }
      for (const c of developed.slice(0, 2)) {
        spans.push({ ...spanOf(c, lines), class: 'credited', evidence_kind: 'causal_chain', links_counted: c.links })
      }
      for (const c of single.slice(0, 3)) {
        spans.push({ ...spanOf(c, lines), class: 'partial', evidence_kind: 'causal_chain', links_counted: 1, reason_code: 'SINGLE_LINK', reason: REASON_TEXT.SINGLE_LINK })
      }
      const taken = (s) => spans.some((x) => Math.max(x.char_start, s.start) < Math.min(x.char_end, s.end))
      const assertion = signals.sentences
        .filter((s) => countLinks(s.text) === 0 && !definitionAt(s.text) && contentWords(s.text).length >= 5 && !taken(s))
        .sort((a, b) => contentWords(b.text).length - contentWords(a.text).length)[0]
      if (assertion) {
        spans.push({ ...spanOf(assertion, lines), class: 'uncredited', evidence_kind: 'assertion', reason_code: 'ASSERTION_NO_LINK', reason: REASON_TEXT.ASSERTION_NO_LINK })
      }
    } else if (role === 'application') {
      const passed = signals.applications.filter((a) => a.pass)
      const failed = signals.applications.filter((a) => !a.pass)
      level = Math.min(top, passed.length)
      surplus = Math.max(0, passed.length - Math.max(1, level))
      for (const a of passed.slice(0, 3)) {
        spans.push({ ...spanOf(a, lines), class: 'credited', evidence_kind: 'case_fact', case_fact_ref: a.fact })
      }
      for (const a of failed.slice(0, 2)) {
        spans.push({ ...spanOf(a, lines), class: 'uncredited', evidence_kind: 'case_fact', reason_code: 'GENERIC_NOT_CONTEXT', reason: REASON_TEXT.GENERIC_NOT_CONTEXT })
      }
    } else if (role === 'evaluation') {
      const committed = signals.judgements.filter((j) => j.committed)
      const weighing = signals.weighings
      const condition = signals.conditions
      if (committed.length && weighing.length && condition.length) level = Math.min(top, 3)
      else if (committed.length && weighing.length) level = Math.min(top, 2)
      else if (signals.judgements.length || weighing.length) level = Math.min(top, 1)
      surplus = (weighing.length ? 1 : 0) + (committed.length > 1 ? 1 : 0) + (condition.length ? 1 : 0)
      if (level >= 2) surplus = Math.max(0, surplus - 1)
      for (const j of committed.slice(0, 1)) {
        spans.push({ ...spanOf(j, lines), class: 'credited', evidence_kind: 'judgement' })
      }
      for (const w of weighing.slice(0, 1)) {
        spans.push({ ...spanOf(w, lines), class: committed.length ? 'credited' : 'partial', evidence_kind: 'weighing', reason_code: committed.length ? null : 'SINGLE_LINK', reason: committed.length ? null : 'A real weighing statement, but no decision follows from it.' })
      }
      for (const h of signals.hedges.slice(0, 2)) {
        spans.push({ ...spanOf(h, lines), class: 'uncredited', evidence_kind: 'judgement', reason_code: 'GENERIC_NOT_CONTEXT', reason: 'No decisive factor named, so nothing is decided.' })
      }
    } else {
      const c = signals.concepts
      level = Math.min(top, c.length)
      surplus = Math.max(0, c.length - Math.max(1, level))
      for (const k of c.slice(0, 3)) {
        spans.push({ ...spanOf(k, lines), class: 'credited', evidence_kind: 'concept', links_counted: 0 })
      }
    }

    const band = bandAt(grid, level)
    const marks = withinBand(band, surplus, step)
    const next = grid.bands.find((b) => b.level === level + 1)
    if (next) {
      missing.push(`${next.range[0]}${next.range[1] > next.range[0] ? `–${next.range[1]}` : ''} of ${grid.max} needs ${(next.evidenceRule || next.descriptor).replace(/\.$/, '')}`)
    } else {
      const step_ = nextRuleStep(band, marks)
      if (step_) missing.push(`${step_.label} of ${grid.max} needs ${step_.text}`)
    }
    if (role === 'evaluation' && !signals.committed) missing.push('No committed judgement — nothing is decided')
    if (role === 'application' && !signals.applications.some((a) => a.pass)) missing.push('No fact used that is true of this business alone')

    return { ao, max: grid.max, level, marks, band, spans: dedupeSpans(spans.filter((s) => s.char_start != null)), missing: missing.slice(0, 3) }
  })
  return { source: 'heuristic', perAo, advice: null }
}

function spanOf(x, lines) {
  return {
    quote: x.quote ?? x.text,
    char_start: x.start,
    char_end: x.end,
    line_ref: lineRef(lines, x.start, x.end),
    evidence_kind: null,
    links_counted: null,
    reason_code: null,
    reason: null,
    marking_point_id: null,
    case_fact_ref: null,
    repaired: false,
  }
}

/**
 * Is one atom of a conjunctive point evidenced? An atom that lists alternatives
 * ("customisation, one-off working or skilled labour") is satisfied by any one of them.
 * The scheme's accept[] list phrases the whole point, not each atom, so it is not
 * consulted here — that is what lets a conjunctive point fail on one half.
 */
function atomMet(atom, answer, point) {
  const text = atom.text
  if (/\bor\b/i.test(text)) {
    const options = text.split(/,|\bor\b/i).map((s) => s.trim()).filter(Boolean)
    if (options.some((o) => overlap(o, answer) >= 0.5)) return true
  }
  if (overlap(text, answer) >= 0.5) return true
  return overlap(text, answer) >= 0.34 && overlap(point.text, answer) >= 0.4
}

/** Where each counted connective sits, and which sentence carries it. */
function linkSites(answer, chain, sents) {
  const sites = []
  for (const m of chain.quote.matchAll(LINK_RE)) {
    const at = chain.start + m.index
    const sentence = sents.find((s) => at >= s.start && at < s.end)
    if (sentence) sites.push({ at, sentence })
  }
  return sites
}

function heuristicPoints(scheme, signals, answer, lines) {
  const chainPoints = scheme.points.filter((p) => /\blink|chain|mechanism|consequence|leads|because|develop/i.test(p.text))
  const maxLinks = signals.chains.length ? signals.chains[0].links : 0
  const bestChain = signals.chains[0] || null
  const sites = bestChain ? linkSites(answer, bestChain, signals.sentences) : []

  const perPoint = scheme.points.map((point) => {
    const atoms = point.conjunctive.map((a) => ({ text: a.text, met: atomMet(a, answer, point) }))
    let met
    let span = null
    let reasonCode = null
    let reason = null

    const chainIndex = chainPoints.indexOf(point)
    if (chainIndex >= 0) {
      // A stated mechanism plus its effect needs one connective; each further step needs another.
      met = maxLinks >= chainIndex + 2
      if (met && bestChain) {
        const site = sites[chainIndex + 1]
        span = { ...spanOf(site ? site.sentence : bestChain, lines), links_counted: chainIndex + 2 }
      }
      if (!met) {
        reasonCode = maxLinks === 0 ? 'ASSERTION_NO_LINK' : 'SINGLE_LINK'
        reason = maxLinks === 0
          ? 'Nothing is explained: the answer asserts and moves on.'
          : 'The chain stops before this step.'
      }
    } else if (atoms.length) {
      met = point.allRequired ? atoms.every((a) => a.met) : atoms.some((a) => a.met)
      if (!met && atoms.some((a) => a.met)) reasonCode = 'ATOM_NOT_MET'
    } else {
      met = overlap(point.text, answer) >= 0.5
        || point.alternatives.some((a) => overlap(a, answer) >= 0.5)
        || point.accept.some((a) => overlap(a, answer) >= 0.6)
    }
    if (point.reject.some((r) => overlap(r, answer) >= 0.7)) { met = false; reasonCode = 'OUT_OF_SCOPE' }

    if (!span && chainIndex < 0) {
      const probe = atoms.find((a) => a.met)?.text || point.text
      let best = null
      for (const s of signals.sentences) {
        const score = overlap(probe, s.text)
        if (score >= 0.34 && (!best || score > best.score)) best = { s, score }
      }
      if (best) span = spanOf(best.s, lines)
    }

    return {
      id: point.id,
      met,
      methodCorrect: signals.hasWorking,
      atoms,
      span: met || reasonCode ? span : null,
      links: chainIndex >= 0 ? maxLinks : null,
      reasonCode,
      reason,
    }
  })

  const uncredited = []
  if (scheme.aoCeiling !== 'AO4') {
    for (const j of signals.judgements.slice(0, 1)) {
      uncredited.push({ ...spanOf(j, lines), reason_code: 'EVAL_IN_ANALYSE', reason: REASON_TEXT.EVAL_IN_ANALYSE })
    }
  }
  return { source: 'heuristic', perPoint, uncredited, advice: null }
}

// ─────────────────────────────────────────── turning judgements into the Mark

function resolvePoints(scheme, judgement, lines) {
  const awarded = new Map()
  const rows = []
  const claimed = []
  const unverified = []

  for (const p of scheme.points) {
    const j = judgement.perPoint.find((x) => x.id === p.id) || { id: p.id, met: false, atoms: [], span: null }
    const atoms = p.conjunctive.length
      ? p.conjunctive.map((a, i) => ({ text: a.text, met: j.atoms?.[i]?.met === true }))
      : []
    let met = j.met === true
    let reasonCode = j.reasonCode || null
    let glyph = '✓'
    let ecfFrom = null

    if (p.allRequired && atoms.length && !atoms.every((a) => a.met)) {
      met = false
      reasonCode = atoms.some((a) => a.met) ? 'ATOM_NOT_MET' : reasonCode
    }

    if (met && p.dependsOn && !awarded.get(p.dependsOn)) {
      // 05-PROC-006/007: a dependent mark cannot be awarded without its dependency,
      // unless the scheme allows the candidate's own figure to be carried forward.
      if (scheme.ecfPolicy.allowed && (p.ecf || p.type === 'FT') && !p.cao && j.methodCorrect) {
        glyph = 'ECF'
        ecfFrom = p.dependsOn
      } else {
        met = false
        reasonCode = reasonCode || null
      }
    }

    // 05-SCHM-009: one span, one point, unless the scheme licenses sharing. A mark and
    // the mark that depends on it are the exception the rule assumes: an accuracy mark
    // is read off the same working as its method mark and never double-counts it.
    const shared = []
    if (met && j.span) {
      for (const prior of claimed) {
        const a = Math.max(prior.span.char_start, j.span.char_start)
        const b = Math.min(prior.span.char_end, j.span.char_end)
        const cover = (b - a) / Math.max(1, Math.min(prior.span.char_end - prior.span.char_start, j.span.char_end - j.span.char_start))
        if (b <= a || cover <= 0.5) continue
        const linked = p.dependsOn === prior.id || pointById(scheme, prior.id)?.dependsOn === p.id
        if (linked) continue
        if (sharesSpan(scheme, prior.id, p.id)) shared.push(prior.id)
        else { met = false; reasonCode = 'DUPLICATE_POINT' }
      }
    }

    if (!met) glyph = j.span ? '×' : 'Ø'
    else if (!ecfFrom) glyph = '✓'
    // 05-MARK-001: the point may stand, but a mark whose evidence cannot be found in
    // the answer is shown as benefit of the doubt, never as a clean tick.
    if (met && j.spanDropped) { glyph = 'BOD'; unverified.push(p.id) }

    const marks = met ? p.marks : 0
    awarded.set(p.id, met)
    if (met && j.span) claimed.push({ id: p.id, span: j.span })

    const failedAtom = atoms.find((a) => !a.met)
    const reason = (met && j.spanDropped ? 'The evidence quoted for this point is not in your answer, so a teacher should confirm the mark.' : null)
      || lintProse(j.reason)
      || (reasonCode === 'ATOM_NOT_MET' && failedAtom ? `The scheme wants both parts. Missing: ${failedAtom.text}.` : null)
      || (!met && p.dependsOn && !awarded.get(p.dependsOn) ? `Depends on ${p.dependsOn}, which was not awarded.` : null)
      || (reasonCode ? REASON_TEXT[reasonCode] : null)

    for (const s of shared) {
      const other = rows.find((r) => r.marking_point_id === s)
      if (other) other.shared_with = [...(other.shared_with || []), p.id]
    }

    rows.push({
      marking_point_id: p.id,
      type: p.type,
      ao: p.ao,
      max: p.marks,
      awarded: marks,
      glyph,
      credit_text: p.text,
      quote: met || j.span ? j.span?.quote ?? null : null,
      char_start: j.span?.char_start ?? null,
      char_end: j.span?.char_end ?? null,
      line_ref: j.span?.line_ref ?? null,
      links_counted: j.links ?? null,
      atoms,
      shared_with: shared.length ? shared : null,
      ecf_from: ecfFrom,
      reason_code: reasonCode,
      reason,
    })
  }

  const uncredited = (judgement.uncredited || []).map((s) => ({
    ...s,
    reason_code: s.reason_code || 'OUT_OF_SCOPE',
    reason: s.reason || REASON_TEXT[s.reason_code || 'OUT_OF_SCOPE'],
  }))

  return { rows, uncredited, unverified }
}

/** Median of the ensemble. An even split takes the lower of the two middles: on a
 *  disagreement the examiner's caution is downward, and the band still carries it. */
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.floor((s[mid - 1] + s[mid]) / 2)
}

/** 05-MARK-011. Agreement across the ensemble, reported rather than hidden. */
function confidenceFor(levels, marks, source) {
  if (source === 'heuristic') return 0.6
  if (levels.length < 2) return 0.75
  const same = levels.filter((l) => l === median(levels)).length
  let c = same === levels.length ? 0.95 : same >= 2 ? 0.7 : 0.45
  const spread = Math.max(...marks) - Math.min(...marks)
  if (spread > 1) c -= 0.05 * (spread - 1)
  return Math.max(0.3, Math.round(c * 100) / 100)
}

export function confidenceBand(value) {
  if (value >= 0.8) return 'high'
  if (value >= 0.6) return 'medium'
  return 'check with teacher'
}

function commandWordCheck(scheme, signals, cw, gridLevelOfCeiling) {
  const ceiling = scheme.aoCeiling
  const word = cw.word || scheme.commandWord || ''
  const Command = word ? word[0].toUpperCase() + word.slice(1) : 'This question'
  const evalOffered = ceiling === 'AO4'
  const strays = signals.judgements.length

  if (!evalOffered && strays > 0) {
    // 05-PROC-004, fixed line.
    return {
      command_word: word || null,
      ceiling_ao: ceiling,
      definition_ref: scheme.commandWordDefRef,
      met: true,
      uncapped_level: cw.uncapped,
      cap_binding: false,
      coaching_line: `${Command} — no evaluation marks are available on this question; the ${strays} sentence${strays === 1 ? '' : 's'} of judgement earned nothing.`,
    }
  }
  if (evalOffered && !signals.committed) {
    const capLevel = (cw.uncapped ?? 2) + 1
    const binding = gridLevelOfCeiling != null && gridLevelOfCeiling > (cw.uncapped ?? 2)
    return {
      command_word: word || null,
      ceiling_ao: ceiling,
      definition_ref: scheme.commandWordDefRef,
      met: false,
      uncapped_level: cw.uncapped ?? 2,
      cap_binding: binding,
      coaching_line: `${Command} — ${cw.requirement}. None committed, so ${ceiling} cannot reach Level ${capLevel}.`,
    }
  }
  return {
    command_word: word || null,
    ceiling_ao: ceiling,
    definition_ref: scheme.commandWordDefRef,
    met: true,
    uncapped_level: cw.uncapped,
    cap_binding: false,
    coaching_line: `${Command} — ${cw.requirement}. The answer does that.`,
  }
}

const ADVICE_LABEL = {
  rewrite_paragraph: 'Rewrite it',
  add_working: 'Show the working',
  redo_calculation: 'Redo the calculation',
  answer_the_command_word: 'Answer the command word',
  add_context: 'Use the case',
  retry_unaided: 'Try it again unaided',
}

const GAP_LINE = {
  AO4_no_judgement: 'your evaluation commits to nothing',
  AO4_no_weighing: 'your evaluation names no criterion',
  AO3_single_link: 'your analysis stops after one link',
  AO3_none: 'your analysis never leaves assertion',
  AO2_generic: 'your application would be true of any business',
  AO2_none: 'your application uses no fact from the case',
  AO1_partial: 'your knowledge covers half the scheme wording',
}

function nextAction({ scheme, perAo, perPoint, signals, cwCheck, advice, lines }) {
  let target = null
  if (perAo?.length) {
    let best = -1
    for (const row of perAo) {
      const grid = scheme.levels.find((g) => g.ao === row.ao)
      const next = grid.bands.find((b) => b.level === row.level + 1)
      const reach = next ? 1 : 0.4
      const score = (row.max - row.marks) * reach
      if (score > best) { best = score; target = row }
    }
  }
  let pointTargetAo = null
  if (!target && perPoint?.length) {
    const deficit = {}
    for (const p of perPoint) if (p.ao) deficit[p.ao] = (deficit[p.ao] || 0) + (p.max - p.awarded)
    // A tie goes to the higher objective: the marks there are usually the reachable ones.
    pointTargetAo = Object.entries(deficit)
      .sort((a, b) => b[1] - a[1] || AO_ORDER.indexOf(b[0]) - AO_ORDER.indexOf(a[0]))
      .filter(([, d]) => d > 0)[0]?.[0] || null
  }
  const targetAo = target?.ao || pointTargetAo || scheme.aoCeiling

  let kind = 'rewrite_paragraph'
  if (targetAo === 'AO4' && !cwCheck.met) kind = 'answer_the_command_word'
  else if (targetAo === 'AO2') kind = 'add_context'
  else if (scheme.workingRequired && !signals.hasWorking) kind = 'add_working'

  const missed = target?.missing?.[0]
    || (perPoint || []).filter((p) => !p.awarded).map((p) => p.credit_text)[0]
    || null

  const anchor = signals.weighings[0] || signals.chains[0] || signals.judgements[0] || signals.sentences[signals.sentences.length - 1]
  const targetLine = anchor ? lineRef(lines, anchor.start, anchor.end) : null

  const gain = target
    ? (() => {
      const grid = scheme.levels.find((g) => g.ao === target.ao)
      const next = grid?.bands.find((b) => b.level === target.level + 1)
      if (!next) return `+${Math.max(1, target.max - target.marks)}`
      return `+${Math.max(1, next.range[0] - target.marks)} to +${Math.max(1, next.range[1] - target.marks)}`
    })()
    : `+${(perPoint || []).filter((p) => !p.awarded).reduce((s, p) => s + p.max, 0) || 1}`

  const standing = {
    answer_the_command_word: `Decide. Name the one factor that settles it${targetLine ? ` — the point you already make at ${targetLine} is the strongest candidate` : ''}, say why it outweighs the other side, and attach a condition from the case.`,
    add_context: 'Use a fact that is true of this business alone, and attach it to the point it supports.',
    add_working: 'Show the working. A wrong final answer with no method scores zero.',
    redo_calculation: 'Redo the calculation from your own figures and show every step.',
    rewrite_paragraph: `Take the point at ${targetLine || 'your strongest paragraph'} one step further: say what follows from it${missed ? '' : ' and for whom'}.`,
    retry_unaided: 'Try the question again without help before reading any more.',
  }
  const text = advice?.text || standing[kind] || standing.rewrite_paragraph

  let gapKey = null
  if (targetAo === 'AO4') gapKey = signals.committed ? 'AO4_no_weighing' : 'AO4_no_judgement'
  else if (targetAo === 'AO3') gapKey = signals.chains.some((c) => c.links >= 2) ? 'AO3_single_link' : 'AO3_none'
  else if (targetAo === 'AO2') gapKey = signals.applications.some((a) => a.pass) ? 'AO2_generic' : 'AO2_none'
  else if (targetAo === 'AO1') gapKey = 'AO1_partial'

  const secondary = []
  if (perAo?.length) {
    const other = perAo.filter((r) => r.ao !== targetAo).sort((a, b) => (b.max - b.marks) - (a.max - a.marks))[0]
    if (other) secondary.push({ kind: 'explain_ao', target_ao: other.ao, label: `Why ${other.ao} stalled` })
  }
  secondary.push({ kind: 'another_like_this', target_ao: null, label: 'Another like this' })

  return {
    primary_action: {
      kind,
      label: ADVICE_LABEL[kind],
      target_ao: targetAo,
      target_line_ref: targetLine,
      expected_gain: gain,
      text,
      gap_line: gapKey ? GAP_LINE[gapKey] : null,
    },
    secondary,
  }
}

function examinerWarnings(scheme, { signals, perAo, perPoint, lines }) {
  const fired = []
  const usedAo = new Set()
  for (const insight of scheme.examinerInsights) {
    let hit = null
    switch (insight.heuristic) {
      case 'business_name_only': hit = signals.applications.find((a) => !a.pass) || null; break
      case 'it_depends_conclusion': hit = signals.hedges[0] || null; break
      case 'partial_definition': hit = (perPoint || []).some((p) => p.reason_code === 'ATOM_NOT_MET') ? signals.sentences[0] : null; break
      case 'single_link_only': hit = signals.chains.every((c) => c.links < 2) ? signals.chains[0] || null : null; break
      case 'no_working': hit = !signals.hasWorking ? signals.sentences[0] || null : null; break
      default: {
        const row = (perAo || []).find((r) => r.ao === insight.ao)
        hit = row && row.marks * 2 < row.max ? signals.sentences[0] || null : null
      }
    }
    if (!hit) continue
    if (insight.ao && usedAo.has(insight.ao)) continue
    if (insight.ao) usedAo.add(insight.ao)
    const start = hit.start ?? hit.char_start ?? null
    const end = hit.end ?? hit.char_end ?? null
    fired.push({
      insight_id: insight.id,
      series: insight.series,
      paraphrase: insight.paraphrase,
      matched_line_ref: start != null ? lineRef(lines, start, end ?? start) : null,
      matched_char_start: start,
      ao: insight.ao,
    })
    if (fired.length >= 3) break
  }
  return fired
}

function badgeFor(calibration, scheme, item) {
  const state = calibration?.state || 'provisional'
  const paper = calibration?.paperLabel || (item.paper ? `Paper ${item.paper}` : scheme.paper ? `Paper ${scheme.paper}` : 'this paper')
  if (state === 'gated' && calibration?.qwk != null) {
    return `Calibrated on ${paper} · agreement ${calibration.qwk.toFixed(2)}${calibration.nScripts ? ` · ${calibration.nScripts} scripts` : ''}`
  }
  if (state === 'uncalibrated') return 'Feedback only — this paper is not yet calibrated'
  if (state === 'n/a') return `Key-marked on ${paper} · agreement with the key is exact`
  return 'Practice estimate — not yet calibrated'
}

// ──────────────────────────────────────────────────────────────────── mark()

/**
 * Mark one attempt.
 *
 * @param {object}  a
 * @param {object}  a.item     the item being answered: {id, tariff, command_word, paper, stem, stimulus}
 * @param {object}  a.scheme   the mark scheme (raw or parsed). null runs feedback-only mode (05-SCOP-002).
 * @param {string}  a.answer   the student's confirmed transcript, verbatim
 * @param {object} [a.provider] a Provider from server/providers
 * @param {string} [a.model]
 * @returns {Promise<object>} a frozen Mark object
 */
export async function mark({ item, scheme, answer, provider, model, effort, budgetMs, attemptId, policy, degraded }) {
  if (!item || typeof item !== 'object') {
    throw Object.assign(new Error('Marking needs the item that was answered'), { status: 400 })
  }
  const text = typeof answer === 'string' ? answer : ''
  if (!text.trim()) {
    throw Object.assign(new Error('There is nothing to mark — the answer is empty'), { status: 400 })
  }

  const startedAt = Date.now()
  const lines = lineIndex(text)
  const parsed = scheme ? parseScheme(scheme) : null

  if (parsed && item.tariff != null && Number(item.tariff) !== parsed.marksTotal) {
    throw Object.assign(
      new Error(`Scheme ${parsed.id || ''} is worth ${parsed.marksTotal} marks but the item is worth ${item.tariff}; the AO tariffs must sum to the item tariff`.trim()),
      { status: 400 },
    )
  }

  const tariff = (parsed?.marksTotal ?? Number(item.tariff)) || 0
  const cw = commandWordRule(parsed?.commandWord || item.command_word, parsed?.aoCeiling || 'AO3')
  const signals = evidenceSignals(text, parsed)
  const dropped = []
  const warnings = []

  // Feedback-only mode: no scheme means no number (05-SCOP-002, 05-GATE-004).
  if (!parsed) {
    const cwCheck = commandWordCheck(
      { aoCeiling: cw.ceiling, commandWord: cw.word, commandWordDefRef: null, workingRequired: false },
      signals, cw, null,
    )
    const advice = nextAction({
      scheme: { levels: [], points: [], aoCeiling: cw.ceiling, workingRequired: false },
      perAo: null, perPoint: null, signals, cwCheck, advice: null, lines,
    })
    return finish({
      item, scheme: null, text, lines, tariff, attemptId, startedAt,
      procedure: 'feedback_only', totalBand: null, perAo: null, perPoint: null,
      cwCheck, application: null, dataCheck: null, warningsList: [],
      advice, confidence: { value: 0.5, band: 'medium', note: 'No mark scheme for this question, so no number is shown.' },
      calibration: { state: 'uncalibrated', qwk: null, humanLine: null, nScripts: null, lastAudit: null },
      provenance: { source: 'none', model: null, runs: [], dropped, degraded: true },
      warnings: ['No mark scheme for this question. Feedback only: spans, checks and the next action, no number.'],
      teacherFlag: false,
    })
  }

  const isLevels = parsed.kind === 'levels' || parsed.kind === 'mixed'
  const isPoints = parsed.kind === 'points' || parsed.kind === 'mixed' || parsed.kind === 'practical'

  // 05-PIPE-006(b): self-consistency on high-tariff items — three judgements that
  // differ only in the order the objectives and anchors are presented in.
  const runCount = tariff >= 8 ? 3 : 1
  const orderings = []
  for (let i = 0; i < runCount; i++) {
    const aoOrder = parsed.levels.map((g) => g.ao)
    const pointOrder = [...parsed.points]
    const indicative = [...parsed.indicative]
    for (let r = 0; r < i; r++) {
      aoOrder.push(aoOrder.shift())
      indicative.push(indicative.shift())
    }
    orderings.push({ id: i === 0 ? 'canonical' : `anchors_rotated_${i}`, aoOrder, pointOrder, indicative })
  }

  const system0 = buildSystem(parsed, item, cw, orderings[0])
  const user = `Answer, verbatim (${countWords(text)} words):\n\n${text}`

  const results = await Promise.all(orderings.map(async (ordering, i) => {
    const system = i === 0 ? system0 : buildSystem(parsed, item, cw, ordering)
    const res = await callModel({ provider, model, system, user, effort, budgetMs, schema: schemaFor(parsed) })
    if (!res) return null
    const judgement = readRun(res.data, { scheme: parsed, answer: text, lines, dropped })
    return judgement ? { ...judgement, ordering: ordering.id, model: res.model, usage: res.usage, costUsd: res.costUsd } : null
  }))

  const runs = results.filter(Boolean)
  const source = runs.length ? 'model' : 'heuristic'
  if (!runs.length) {
    warnings.push(degraded || !provider
      ? 'Marked by the offline marker: no examiner model is configured, so the levels and points come from the scheme rules alone.'
      : 'The examiner model did not return a usable judgement, so this Mark comes from the scheme rules alone.')
  }

  let perAo = null
  let perPoint = null
  let pointUncredited = []
  let unverifiedPoints = []
  let advice = null
  let selfConsistency = null
  let modelName = runs[0]?.model || null
  let cost = 0
  for (const r of runs) cost += r.costUsd || 0

  if (isLevels) {
    const modelRuns = runs.filter((r) => r.perAo)
    const judgements = modelRuns.length ? modelRuns : [heuristicLevels(parsed, signals, text, lines)]
    advice = judgements[0].advice
    perAo = parsed.levels.map((grid) => {
      const rowsForAo = judgements.map((j) => j.perAo.find((r) => r.ao === grid.ao)).filter(Boolean)
      const levels = rowsForAo.map((r) => r.level)
      const marks = rowsForAo.map((r) => r.marks)
      const level = median(levels)
      const chosen = rowsForAo.find((r) => r.level === level) || rowsForAo[0]
      const marksInLevel = rowsForAo.filter((r) => r.level === level).map((r) => r.marks)
      const band = levelFor(grid.ao, level, parsed)
      const value = Math.max(band.range[0], Math.min(band.range[1], median(marksInLevel.length ? marksInLevel : marks)))
      let conf = confidenceFor(levels, marks, source)
      if (value > 0 && !chosen.spans.some((sp) => sp.class === 'credited')) conf = Math.round((conf - 0.2) * 100) / 100
      return {
        ao: grid.ao,
        max: grid.max,
        level,
        marks: value,
        band,
        spans: chosen.spans,
        missing: chosen.missing,
        confidence: conf,
      }
    })
    if (judgements.length > 1) {
      selfConsistency = {
        n: judgements.length,
        orderings: judgements.map((j) => j.ordering || 'canonical'),
        totals: judgements.map((j) => j.perAo.reduce((s, r) => s + r.marks, 0)),
        per_ao_medians: Object.fromEntries(perAo.map((r) => [r.ao, r.marks])),
        level_agreement: parsed.levels.every((g) => {
          const ls = judgements.map((j) => j.perAo.find((r) => r.ao === g.ao)?.level)
          return ls.every((l) => l === ls[0])
        }),
      }
    } else {
      selfConsistency = { n: 1, orderings: [judgements[0].ordering || 'canonical'], totals: [perAo.reduce((s, r) => s + r.marks, 0)], per_ao_medians: null, level_agreement: null }
    }
  }

  if (isPoints) {
    const judgement = runs.find((r) => r.perPoint) || heuristicPoints(parsed, signals, text, lines)
    advice = advice || judgement.advice
    const resolved = resolvePoints(parsed, judgement, lines)
    perPoint = resolved.rows
    pointUncredited = resolved.uncredited
    unverifiedPoints = resolved.unverified
    if (unverifiedPoints.length) {
      warnings.push(`${unverifiedPoints.join(', ')} ${unverifiedPoints.length === 1 ? 'is' : 'are'} marked on evidence that could not be found in your answer. Ask a teacher to confirm ${unverifiedPoints.length === 1 ? 'it' : 'them'}.`)
    }
    if (!selfConsistency) {
      selfConsistency = {
        n: 1,
        orderings: [judgement.ordering || 'canonical'],
        totals: [resolved.rows.reduce((s, r) => s + r.awarded, 0)],
        per_ao_medians: null,
        level_agreement: null,
      }
    }
  }

  // The command word sets which AOs are on offer and may cap the ceiling AO.
  const ceilingRow = perAo?.find((r) => r.ao === parsed.aoCeiling) || null
  const cwCheck = commandWordCheck(parsed, signals, cw, ceilingRow?.level ?? null)
  if (perAo && !cwCheck.met && cwCheck.uncapped_level != null && ceilingRow && ceilingRow.level > cwCheck.uncapped_level) {
    const band = levelFor(ceilingRow.ao, cwCheck.uncapped_level, parsed)
    ceilingRow.level = cwCheck.uncapped_level
    ceilingRow.marks = Math.min(ceilingRow.marks, band.range[1])
    ceilingRow.band = band
    ceilingRow.missing = [`A committed judgement is what lifts ${ceilingRow.ao} past Level ${cwCheck.uncapped_level}`, ...ceilingRow.missing].slice(0, 3)
  }

  // Totals are computed here, never by the model (05-MARK-009).
  const aoTotal = (perAo || []).reduce((s, r) => s + r.marks, 0)
  const pointTotal = (perPoint || []).reduce((s, r) => s + r.awarded, 0)
  const modal = Math.max(0, Math.min(tariff, aoTotal + pointTotal))

  // 05-MARK-016: `exact` claims every mark was checked against the key, not judged.
  // Only a scheme whose points are all `cao` can say that here — a method mark is a
  // judgement about working, and a band on a judgement is not hedging, it is honest.
  const deterministic = isPoints && !isLevels && parsed.points.length > 0
    && (perPoint || []).every((r) => r.reason_code !== 'DUPLICATE_POINT')
    && parsed.points.every((p) => p.cao)
  const tolerance = deterministic ? 0 : parsed.tolerance
  const totalBand = {
    low: Math.max(0, modal - tolerance),
    modal,
    high: Math.min(tariff, modal + tolerance),
    tolerance,
    exact: deterministic,
  }

  const application = parsed.context && parsed.context.kind === 'case_study'
    ? buildCheck('cover_the_name', signals.applications, lines)
    : null
  const dataCheck = parsed.context && parsed.context.kind === 'data_response'
    ? buildCheck('supplied_figures', signals.data, lines)
    : null

  const confidences = (perAo || []).map((r) => r.confidence)
  const overall = confidences.length
    ? Math.round((confidences.reduce((s, c, i) => s + c * perAo[i].max, 0) / perAo.reduce((s, r) => s + r.max, 0)) * 100) / 100
    : source === 'heuristic' ? 0.6 : 0.8
  const teacherFlag = confidences.some((c) => c < 0.6) || unverifiedPoints.length > 0

  const calibration = parsed.calibration || { state: 'provisional', qwk: null, humanLine: null, nScripts: null, lastAudit: null }

  const advicePack = nextAction({ scheme: parsed, perAo, perPoint, signals, cwCheck, advice, lines })

  return finish({
    item, scheme: parsed, text, lines, tariff, attemptId, startedAt,
    procedure: isLevels ? parsed.levelProcedure : 'points',
    totalBand: calibration.state === 'uncalibrated' ? null : totalBand,
    perAo, perPoint, pointUncredited,
    cwCheck, application, dataCheck,
    warningsList: examinerWarnings(parsed, { signals, perAo, perPoint, lines }),
    advice: advicePack,
    confidence: {
      value: overall,
      band: confidenceBand(overall),
      note: source === 'heuristic'
        ? 'Marked offline against the scheme rules; a teacher should confirm the level.'
        : selfConsistency && selfConsistency.n > 1 && selfConsistency.level_agreement === false
          ? 'The three runs disagreed on at least one level; the median is shown.'
          : null,
    },
    calibration,
    provenance: {
      source,
      model: modelName,
      effort: effort || null,
      degraded: !!degraded || source === 'heuristic',
      policy: policy?.version || null,
      selfConsistency,
      dropped,
      costUsd: Math.round(cost * 1e6) / 1e6,
    },
    warnings,
    teacherFlag,
  })
}

function buildCheck(test, candidates, lines) {
  const passed = []
  const failed = []
  for (const c of candidates) {
    const ref = {
      line_ref: lineRef(lines, c.start, c.end),
      char_start: c.start,
      char_end: c.end,
      quote: c.quote,
    }
    if (c.pass) passed.push({ ...ref, fact: c.fact || c.series || null })
    else failed.push({ ...ref, reason_code: c.reason_code })
  }
  return { test, tested: passed.length + failed.length, passed, failed }
}

/** Assemble, lint and freeze. A Mark is immutable once it exists (05-MARK-012). */
function finish(a) {
  const {
    item, scheme, text, lines, tariff, attemptId, startedAt, procedure, totalBand,
    perAo, perPoint, pointUncredited = [], cwCheck, application, dataCheck,
    warningsList, advice, confidence, calibration, provenance, warnings, teacherFlag,
  } = a

  // One reason per kind per objective: three spans that all stop after one link say
  // so once, and the rest carry the code. Repetition is what breaks the word budget.
  const aoRows = (perAo || []).map((r) => {
    const said = new Set()
    for (const s of r.spans) {
      if (!s.reason_code) continue
      if (said.has(s.reason_code)) s.reason = null
      else said.add(s.reason_code)
    }
    return {
    ao: r.ao,
    max: r.max,
    level: r.level,
    marks: r.marks,
    confidence: r.confidence,
    confidence_band: confidenceBand(r.confidence),
    descriptor_relied_on: {
      band_id: r.band.bandId,
      paraphrase: r.band.descriptor,
      evidence_rule: r.band.evidenceRule,
    },
    within_band_reason: r.band.withinBandRule?.[r.marks] || null,
    credited_spans: r.spans.filter((s) => s.class === 'credited').map(stripClass),
    partial_spans: r.spans.filter((s) => s.class === 'partial').map(stripClass),
    uncredited_attempts: r.spans.filter((s) => s.class === 'uncredited').map(stripClass),
    missing_points: r.missing.slice(0, 3),
    }
  })

  const annotations = []
  for (const row of aoRows) {
    for (const s of row.credited_spans) annotations.push({ glyph: '✓', char_start: s.char_start, char_end: s.char_end })
    for (const s of row.uncredited_attempts) annotations.push({ glyph: 'NC', char_start: s.char_start, char_end: s.char_end })
  }
  for (const p of perPoint || []) {
    if (p.char_start == null) continue
    annotations.push({ glyph: p.glyph, char_start: p.char_start, char_end: p.char_end })
  }
  for (const s of pointUncredited) annotations.push({ glyph: 'NC', char_start: s.char_start, char_end: s.char_end })

  const aoTotals = {}
  for (const row of aoRows) aoTotals[row.ao] = { awarded: row.marks, max: row.max }
  for (const p of perPoint || []) {
    const ao = p.ao || 'AO1'
    aoTotals[ao] = aoTotals[ao] || { awarded: 0, max: 0 }
    aoTotals[ao].awarded += p.awarded
    aoTotals[ao].max += p.max
  }

  const proseFields = [
    cwCheck?.coaching_line,
    ...aoRows.flatMap((r) => [r.descriptor_relied_on.paraphrase, r.within_band_reason, ...r.missing_points, ...r.credited_spans.map((s) => s.reason), ...r.partial_spans.map((s) => s.reason), ...r.uncredited_attempts.map((s) => s.reason)]),
    ...(perPoint || []).flatMap((p) => [p.reason]),
    advice?.primary_action?.text,
  ].filter(Boolean)
  const limit = tariff >= 12 ? 220 : tariff <= 5 ? 80 : 150
  const words = proseFields.reduce((s, f) => s + countWords(f), 0)
  const lint = [...warnings]
  if (words > limit) lint.push(`The rationale runs to ${words} words against a ${limit}-word budget for a ${tariff}-mark item.`)
  if (provenance.dropped.length) {
    lint.push(`${provenance.dropped.length} quoted span${provenance.dropped.length === 1 ? ' was' : 's were'} dropped: the text did not appear in the answer.`)
  }

  const mark = {
    mark_id: `mrk_${randomUUID().slice(0, 12)}`,
    attempt_id: attemptId || null,
    created_at: new Date().toISOString(),
    header: {
      item_id: item.id ?? null,
      question_ref: item.question_ref ?? scheme?.questionId ?? null,
      part: scheme?.part ?? null,
      tariff,
      command_word: cwCheck?.command_word ?? null,
      ao_split: scheme ? { ...scheme.aoSplit } : null,
      scheme_id: scheme?.id ?? null,
      scheme_wording_status: scheme?.wordingStatus ?? null,
      pack_version: scheme?.packVersion ?? item.pack ?? null,
      paper: item.paper ?? scheme?.paper ?? null,
      level_procedure: procedure,
    },
    procedure_used: procedure,
    total_band: totalBand,
    per_ao: aoRows.length ? aoRows : null,
    per_point: perPoint
      ? perPoint.map((p) => ({
        marking_point_id: p.marking_point_id,
        type: p.type,
        ao: p.ao,
        max: p.max,
        awarded: p.awarded,
        glyph: p.glyph,
        credit_text: p.credit_text,
        quote: p.quote,
        char_start: p.char_start,
        char_end: p.char_end,
        line_ref: p.line_ref,
        links_counted: p.links_counted,
        atoms: p.atoms,
        shared_with: p.shared_with,
        ecf_from: p.ecf_from,
        reason_code: p.reason_code,
        reason: p.reason,
      }))
      : null,
    ao_totals: aoTotals,
    uncredited_attempts: pointUncredited.map(stripClass),
    command_word_check: cwCheck,
    application_check: application,
    data_reference_check: dataCheck,
    examiner_warnings: warningsList,
    next_mark_advice: advice,
    annotations: annotations.sort((x, y) => x.char_start - y.char_start),
    confidence,
    calibration_status: {
      state: calibration.state,
      qwk: calibration.qwk,
      human_line: calibration.humanLine ?? null,
      n_scripts: calibration.nScripts ?? null,
      last_audit: calibration.lastAudit ?? null,
      badge_text: badgeFor(calibration, scheme || { paper: null }, item),
    },
    transcript: {
      text,
      words: countWords(text),
      chars: text.length,
      lines: lines.map((l) => ({ n: l.n, start: l.start, end: l.end })),
    },
    provenance: {
      source: provenance.source,
      family: provenance.model ? 'model' : 'none',
      model: provenance.model,
      effort: provenance.effort ?? null,
      degraded: provenance.degraded,
      policy_version: provenance.policy ?? null,
      scheme_version: scheme?.version || scheme?.id || null,
      self_consistency: provenance.selfConsistency ?? null,
      dropped_spans: provenance.dropped,
      cost_usd: provenance.costUsd ?? 0,
      latency_ms: Date.now() - startedAt,
      marked_at: new Date().toISOString(),
    },
    rationale_budget: { limit, words, within: words <= limit },
    warnings: lint,
    challenge_state: 'none',
    visibility: {
      show_number: totalBand != null,
      show_predicted_grade: false,
      show_teacher_flag: !!teacherFlag,
    },
  }

  return deepFreeze(mark)
}

function stripClass(span) {
  const { class: _drop, ...rest } = span
  return rest
}
