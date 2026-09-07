import { useMemo, useState } from 'react'
import { AOCard, AOCardSkeleton } from '../components/AOCard'
import type { AoBand, AoResult } from '../components/AOCard'
import { SpanText, buildRuns } from '../components/SpanText'
import type { SpanClass, SpanRun, SpanSource } from '../components/SpanText'
import { TariffPill } from '../components/TariffPill'
import { ApiError, post } from '../lib/api'
import type { CalibrationState, MarkBody, Span } from '../lib/api'
import './MarkView.css'

/* ------------------------------------------------------------------- shapes */

/** The item as the API draws it for a screen (`itemView` in routes/practise.js). */
export interface ItemView {
  id: string
  pack?: string
  syllabusPoint?: string
  pointTitle?: string | null
  paper?: string
  commandWord?: string
  tariff: number
  maxMarks?: number
  kind?: string
  stem?: string
  stimulus?: string | null
  difficulty?: number | null
  expectedMinutes?: number
  markable?: boolean
  schemeKind?: string | null
}

/**
 * What POST /api/mark and GET /api/marks/:id answer with: the stored Mark object
 * under `mark`, the renderer's own keys spread across the top level, and the row's
 * totals. The index signature is that spread — the renderer owns those names.
 */
export interface MarkPayload {
  id?: string
  attemptId?: string
  itemId?: string
  courseId?: string
  total?: number
  max?: number
  percent?: number | null
  summary?: string
  aos?: unknown
  mark?: MarkBody | null
  model?: string | null
  degraded?: boolean | null
  createdAt?: string
  item?: ItemView | null
  answer?: string
  [key: string]: unknown
}

export interface MarkHeaderView {
  question_ref: string | null
  tariff: number
  command_word: string | null
  ao_split: Record<string, number> | null
  syllabus_point: string | null
  scheme_id: string | null
  pack_version: string | null
}

export interface TotalBand {
  low: number
  modal: number
  high: number
  tolerance: number
  exact: boolean
}

export interface CommandWordView {
  command_word: string | null
  ceiling_ao: string | null
  met: boolean
  coaching_line: string | null
}

export interface ApplicationCheckView {
  tested: number
  passed: Span[]
  failed: Span[]
  /** The renderer's own sentence for the check, when it sent one. */
  line: string | null
}

export interface ExaminerWarningView {
  paraphrase: string
  series: string | null
  matched_line_ref: string | null
}

export interface NextActionView {
  kind: string
  label: string | null
  text: string | null
  target_ao: string | null
  target_line_ref: string | null
  expected_gain: string | null
}

export interface CalibrationView {
  state: CalibrationState | 'unknown'
  qwk: number | null
  human_line: number | null
  n_scripts: number | null
  badge_text: string | null
}

/** The Mark as this screen draws it: one shape, whatever the payload looked like. */
export interface Mark {
  mark_id: string | null
  attempt_id: string | null
  header: MarkHeaderView
  total_band: TotalBand | null
  tolerance_line: string | null
  per_ao: AoResult[]
  runs: SpanRun[] | null
  command_word_check: CommandWordView | null
  application_check: ApplicationCheckView | null
  examiner_warnings: ExaminerWarningView[]
  /** Notes about the marking run itself — a dropped quote, a budget overrun. */
  notes: string[]
  next_action: NextActionView | null
  calibration: CalibrationView
  show_number: boolean
  answer: string
  model: string | null
  degraded: boolean
  summary: string | null
}

export type MarkStatus = 'ready' | 'loading' | 'streaming' | 'error'

/* -------------------------------------------------------------- normalising */

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null

function text(source: Record<string, unknown> | null, keys: string[]): string | null {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function num(source: Record<string, unknown> | null, keys: string[]): number | null {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return null
}

function list(source: Record<string, unknown> | null, keys: string[]): unknown[] {
  if (!source) return []
  for (const key of keys) {
    const value = source[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function toSpan(raw: unknown): Span | null {
  if (typeof raw === 'string') {
    return raw.trim() ? { quote: raw.trim(), char_start: -1, char_end: -1 } : null
  }
  const source = record(raw)
  if (!source) return null
  const quote = text(source, ['quote', 'text', 'span', 'evidence'])
  if (!quote) return null
  return {
    quote,
    char_start: num(source, ['char_start', 'charStart', 'start']) ?? -1,
    char_end: num(source, ['char_end', 'charEnd', 'end']) ?? -1,
    line_ref: text(source, ['line_ref', 'lineRef', 'line']),
    marking_point_id: text(source, ['marking_point_id', 'markingPointId', 'point_id', 'pointId']),
    reason_code: text(source, ['reason_code', 'reasonCode', 'code']),
    reason: text(source, ['reason', 'why', 'note']),
    links_counted: num(source, ['links_counted', 'linksCounted', 'links']),
  }
}

const spansOf = (source: Record<string, unknown> | null, keys: string[]): Span[] =>
  list(source, keys).map(toSpan).filter((span): span is Span => span !== null)

function toBands(raw: unknown): AoBand[] | null {
  if (!Array.isArray(raw)) return null
  const bands = raw
    .map((entry): AoBand | null => {
      const source = record(entry)
      if (!source) return null
      const level = num(source, ['level', 'band'])
      const descriptor = text(source, ['descriptor', 'text', 'paraphrase'])
      if (level == null || !descriptor) return null
      const range = source.range
      return {
        level,
        descriptor,
        range: Array.isArray(range) ? range.map(Number).filter((n) => Number.isFinite(n)) : null,
      }
    })
    .filter((band): band is AoBand => band !== null)
  return bands.length ? bands : null
}

function toAo(raw: unknown): AoResult | null {
  const source = record(raw)
  if (!source) return null
  const kind = text(source, ['kind'])
  // A points card is identified by its marking point; an AO card by its objective.
  const ao = kind === 'point'
    ? text(source, ['id', 'point_id', 'title'])
    : text(source, ['ao', 'id', 'name', 'objective'])
  if (!ao) return null

  const descriptorObject = record(source.descriptor_relied_on ?? source.descriptorReliedOn)
  const descriptorText = text(source, ['descriptor', 'levelDescriptor', 'credit_text', 'band_descriptor'])
  const bandId = text(source, ['band_id', 'bandId'])

  // The renderer hands back one span list with a class on each span; the Mark object
  // hands back three lists. Both end up in the same three buckets.
  const buckets: Record<SpanClass, Span[]> = {
    credited: spansOf(source, ['credited_spans', 'creditedSpans', 'credited']),
    partial: spansOf(source, ['partial_spans', 'partialSpans', 'partial']),
    uncredited: spansOf(source, ['uncredited_attempts', 'uncreditedAttempts', 'uncredited', 'missed_spans']),
  }
  for (const entry of list(source, ['spans'])) {
    const span = toSpan(entry)
    if (!span) continue
    const klass = CLASS_OF[(text(record(entry), ['class', 'kind', 'status']) || '').toLowerCase()]
    if (klass) buckets[klass].push(span)
  }

  const missing = list(source, ['missing_points', 'missingPoints', 'missing', 'next'])
    .map((entry) => (typeof entry === 'string' ? entry : text(record(entry), ['text', 'descriptor', 'point']) ?? ''))
    .filter(Boolean)
  const atoms = text(source, ['atoms_line'])
  if (atoms) missing.push(atoms)
  // Why a point is uncredited is the next mark to go for; why one *is* credited is
  // already shown against the quote, and repeating it there reads as a second gap.
  const marks = num(source, ['marks', 'awarded', 'score']) ?? 0
  const max = num(source, ['max', 'tariff', 'outOf']) ?? 0
  const pointReason = kind === 'point' && marks < max ? text(source, ['reason']) : null
  if (pointReason && !buckets.uncredited.length && !missing.length) missing.push(pointReason)

  const title = text(source, ['title', 'label'])
  const name = title && title !== ao ? title.replace(new RegExp(`^${ao}\\s*`), '') : text(source, ['credit_text'])

  return {
    kind: kind === 'point' ? 'point' : 'objective',
    ao,
    name,
    marks,
    max,
    level: num(source, ['level', 'band']),
    levels: num(source, ['levels', 'levelCount', 'of']),
    confidence: num(source, ['confidence']) ?? undefined,
    descriptor_relied_on: descriptorObject
      ? {
          band_id: text(descriptorObject, ['band_id', 'bandId']) ?? undefined,
          paraphrase: text(descriptorObject, ['paraphrase', 'text', 'descriptor']) ?? '',
          source_ref: text(descriptorObject, ['source_ref', 'sourceRef']),
        }
      : descriptorText && descriptorText !== name
        ? { paraphrase: descriptorText, band_id: bandId ?? undefined }
        : null,
    credited_spans: buckets.credited,
    partial_spans: buckets.partial,
    uncredited_attempts: buckets.uncredited,
    missing_points: missing.slice(0, 3),
    bands: toBands(source.bands ?? source.grid ?? source.levels_grid),
  }
}

const CLASS_OF: Record<string, SpanClass> = {
  credited: 'credited', credit: 'credited', awarded: 'credited', ok: 'credited', '✓': 'credited',
  partial: 'partial', part: 'partial', partly: 'partial', bod: 'partial',
  uncredited: 'uncredited', missed: 'uncredited', none: 'uncredited', no: 'uncredited', '×': 'uncredited',
}

/**
 * The runs the server renderer produced, used when the cards carry no spans of their
 * own. Each run states its class and the spans covering it, so the objective and the
 * reason come off `refs`.
 */
function runsFromPayload(payload: Record<string, unknown>, answer: string): SpanRun[] | null {
  const raw = list(payload, ['runs', 'spans', 'answerSpans', 'answer_runs', 'segments'])
  if (!raw.length) return null
  const out: SpanRun[] = []
  let index = 0
  for (const entry of raw) {
    const source = record(entry)
    if (!source) continue
    const body = text(source, ['text', 'quote']) ?? ''
    if (!body) continue
    const rawKind = (text(source, ['class', 'kind', 'type', 'status', 'glyph']) || '').toLowerCase()
    const kind = CLASS_OF[rawKind]
    const ref = record(list(source, ['refs'])[0])
    index += 1
    out.push({
      id: `run-${index}`,
      text: body,
      kind: kind ?? 'plain',
      ao: text(ref, ['ao']) ?? text(source, ['ao', 'objective']),
      point: text(ref, ['point_id', 'marking_point_id']) ?? text(source, ['point_id', 'marking_point_id']),
      reason: text(ref, ['reason']) ?? text(source, ['reason']),
      lineRef: text(source, ['line_ref', 'lineRef']),
    })
  }
  if (!out.length) return null
  // Only trust a complete segmentation: anything short of the whole answer is dropped
  // rather than drawn over the wrong words.
  return out.map((run) => run.text).join('') === answer ? out : null
}

function calibrationOf(
  payload: Record<string, unknown>,
  body: Record<string, unknown> | null,
  badge: Record<string, unknown> | null = null,
): CalibrationView {
  const source = record(body?.calibration_status ?? payload.calibration_status ?? payload.calibration) ?? badge
  const asState = typeof (body?.calibration ?? payload.calibration) === 'string'
    ? String(body?.calibration ?? payload.calibration)
    : null
  const state = (text(source, ['state']) || text(badge, ['state']) || asState || 'unknown') as CalibrationView['state']
  return {
    state,
    qwk: num(source, ['qwk', 'agreement']),
    human_line: num(source, ['human_line', 'humanLine']),
    n_scripts: num(source, ['n_scripts', 'nScripts', 'scripts']),
    badge_text: text(source, ['badge_text', 'badgeText']) ?? text(badge, ['text']),
  }
}

/**
 * One payload shape in, one shape the screen can draw out. The API answers with the
 * renderer's own view data spread across the top level (`cards`, `runs`, `checks`,
 * `band`, `badge`, `next_action`), the stored Mark object under `mark`, and the row's
 * totals; older or thinner shapes fall through to the Mark object itself.
 */
export function normaliseMark(input: MarkPayload, answer = ''): Mark {
  const payload = input as Record<string, unknown>
  const body = record(payload.mark)
  const item = record(payload.item)
  const checks = record(payload.checks)
  const bandView = record(payload.band)

  // Either the rendered payload, or the Mark object itself handed straight in.
  const source = body ?? payload
  const cards = list(payload, ['cards'])
  const objectives = [...list(source, ['per_ao', 'aos', 'aoCards']), ...list(source, ['per_point'])]
  const aoRaw = cards.length
    ? cards
    : objectives.length
      ? objectives
      : Array.isArray(payload.aos) ? payload.aos : []
  const perAo = aoRaw.map(toAo).filter((ao): ao is AoResult => ao !== null)

  // The tariff line is per objective. Points cards are named by marking point, so
  // they would spell out "K1 1 · AP1 1"; the scheme's own AO split is what belongs there.
  const aoSplit: Record<string, number> = {}
  for (const ao of perAo) if (ao.kind !== 'point' && ao.max > 0) aoSplit[ao.ao] = ao.max

  const header = record(source.header)
  const totalBandRaw = record(source.total_band) ?? (bandView && bandView.show !== false ? bandView : null)
  const total = num(payload, ['total']) ?? perAo.reduce((sum, ao) => sum + ao.marks, 0)
  const max = num(payload, ['max']) ?? num(bandView, ['max']) ?? num(item, ['maxMarks', 'tariff'])
    ?? num(header, ['tariff']) ?? perAo.reduce((sum, ao) => sum + ao.max, 0)
  const tolerance = num(totalBandRaw, ['tolerance']) ?? 0
  const totalBand: TotalBand = {
    low: num(totalBandRaw, ['low']) ?? total,
    modal: num(totalBandRaw, ['modal', 'total']) ?? total,
    high: num(totalBandRaw, ['high']) ?? total,
    tolerance,
    exact: totalBandRaw
      ? totalBandRaw.exact === true
      : text(item, ['schemeKind']) === 'points' && tolerance === 0,
  }
  const toleranceLine = text(bandView, ['tolerance_line'])

  const commandRaw = record(checks?.command_word ?? source.command_word_check)
  const applicationRaw = record(checks?.application ?? source.application_check)
  const adviceRaw = record(source.next_mark_advice)
  const primaryRaw = record(payload.next_action ?? adviceRaw?.primary_action ?? adviceRaw?.primaryAction)
  const visibility = record(source.visibility)

  // The renderer hangs most examiner warnings on their card and passes the rest as
  // lines; the Mark object carries them all. One list, no repeats.
  const warnings: ExaminerWarningView[] = []
  const already = new Set<string>()
  const addWarning = (entry: unknown) => {
    const source = record(entry)
    const paraphrase = typeof entry === 'string' ? entry : text(source, ['paraphrase', 'text', 'note'])
    if (!paraphrase) return
    const key = paraphrase.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (already.has(key)) return
    already.add(key)
    warnings.push({
      paraphrase,
      series: text(source, ['series']),
      matched_line_ref: text(source, ['matched_line_ref', 'matchedLineRef', 'line_ref']),
    })
  }
  for (const entry of list(source, ['examiner_warnings'])) addWarning(entry)
  for (const card of cards) addWarning(record(card)?.warning)
  for (const entry of list(payload, ['examiner_warnings', 'examinerWarnings'])) addWarning(entry)

  // The renderer's `warnings` list mixes examiner-report lines with notes about the
  // marking run itself. The first belong beside the question; the second are said
  // plainly rather than dropped, because a dropped span is a trust matter.
  const notes: string[] = []
  for (const entry of list(payload, ['warnings'])) {
    if (typeof entry !== 'string') { addWarning(entry); continue }
    const report = /^examiners?[''`]? report(?:, ([^:]+))?:\s*/i.exec(entry)
    if (report) addWarning({ paraphrase: entry.slice(report[0].length), series: report[1] ?? null })
    else notes.push(entry)
  }

  const answerText = answer || text(payload, ['answer', 'response'])
    || text(record(payload.attempt), ['body', 'answer'])
    || text(record(source.transcript), ['text']) || ''

  const badge = record(payload.badge)
  const calibration = calibrationOf(payload, source, badge)

  return {
    mark_id: text(payload, ['id', 'markId', 'mark_id']),
    attempt_id: text(payload, ['attemptId', 'attempt_id']),
    header: {
      question_ref: text(item, ['paper']) ?? text(header, ['question_ref', 'paper']) ?? text(payload, ['question_ref']),
      tariff: max,
      command_word: text(item, ['commandWord'])
        ?? text(header, ['command_word'])
        ?? text(commandRaw, ['command_word', 'commandWord']),
      ao_split: Object.keys(aoSplit).length
        ? aoSplit
        : (record(header?.ao_split) as Record<string, number> | null),
      syllabus_point: text(item, ['pointTitle', 'syllabusPoint']) ?? text(header, ['syllabus_point']),
      scheme_id: text(source, ['scheme_id', 'schemeId']) ?? text(header, ['scheme_id']),
      pack_version: text(item, ['pack']) ?? text(source, ['pack_version']) ?? text(header, ['pack_version']),
    },
    total_band: totalBand,
    tolerance_line: toleranceLine,
    per_ao: perAo,
    runs: runsFromPayload(payload, answerText),
    command_word_check: commandRaw
      ? {
          command_word: text(commandRaw, ['command_word', 'commandWord']),
          ceiling_ao: text(commandRaw, ['ceiling_ao', 'ceilingAo']),
          met: commandRaw.met !== false,
          coaching_line: text(commandRaw, ['coaching_line', 'coachingLine', 'line', 'text'])
            ?? text(payload, ['coaching_line']),
        }
      : null,
    application_check: applicationRaw
      ? {
          tested: num(applicationRaw, ['tested']) ?? 0,
          passed: spansOf(applicationRaw, ['passed']),
          failed: spansOf(applicationRaw, ['failed']),
          line: text(applicationRaw, ['line']),
        }
      : null,
    examiner_warnings: warnings,
    notes,
    next_action: primaryRaw
      ? {
          kind: text(primaryRaw, ['kind', 'action']) || 'next',
          label: text(primaryRaw, ['label']),
          text: text(primaryRaw, ['text', 'line', 'detail']),
          target_ao: text(primaryRaw, ['target_ao', 'targetAo', 'ao']),
          target_line_ref: text(primaryRaw, ['target_line_ref', 'targetLineRef', 'line_ref']),
          expected_gain: text(primaryRaw, ['expected_gain', 'expectedGain', 'gain']),
        }
      : null,
    calibration,
    show_number: (visibility ? visibility.show_number !== false : true)
      && (bandView ? bandView.show !== false : true)
      && calibration.state !== 'uncalibrated',
    answer: answerText,
    model: text(payload, ['model']) ?? text(record(source.provenance), ['model']),
    degraded: payload.degraded === true,
    summary: text(payload, ['summary']),
  }
}

const isViewModel = (value: unknown): value is Mark =>
  !!value && typeof value === 'object' && Array.isArray((value as Mark).per_ao) && 'calibration' in (value as Mark)

/* ------------------------------------------------------------------- copy */

const ACTION_LABEL: Record<string, string> = {
  rewrite_paragraph: 'Rewrite the weakest paragraph',
  add_working: 'Add the working',
  redo_calculation: 'Redo the calculation',
  answer_the_command_word: 'Answer the command word',
  add_context: 'Put the case detail in',
  retry_unaided: 'Try one like this, unaided',
  another_like_this: 'Another like this',
  explain_ao: 'Explain this objective',
}

function calibrationLines(status: CalibrationView): { badge: string; why: string | null } {
  if (status.state === 'gated') {
    const parts: string[] = ['Calibrated on this paper']
    if (status.qwk != null) parts.push(`agreement ${status.qwk.toFixed(2)}`)
    if (status.n_scripts != null) parts.push(`${status.n_scripts} scripts`)
    return { badge: status.badge_text || parts.join(' · '), why: null }
  }
  if (status.state === 'provisional') {
    const bits: string[] = []
    if (status.qwk != null) bits.push(`agreement with human markers is ${status.qwk.toFixed(2)}`)
    if (status.human_line != null) bits.push(`the gate is ${status.human_line.toFixed(2)}`)
    if (status.n_scripts != null) bits.push(`${status.n_scripts} scripts checked so far`)
    return {
      badge: status.badge_text || 'Practice estimate — not yet calibrated',
      why: bits.length
        ? `${bits.join(', ')}. Until it clears the gate, read the number as an estimate and the evidence below as the result.`
        : 'This paper has not passed its agreement check against human markers yet, so read the number as an estimate and the evidence below as the result.',
    }
  }
  if (status.state === 'uncalibrated') {
    return {
      badge: status.badge_text || 'Not calibrated — no number on this paper',
      why: 'There is no agreement figure for this paper yet, so no total is shown. The spans, the checks and the advice are unchanged.',
    }
  }
  return {
    badge: status.badge_text || 'Marked against this scheme · no agreement figure recorded',
    why: 'Nobody has compared this paper against human markers yet, so the number is what the scheme gives, not a measured agreement.',
  }
}

/* -------------------------------------------------------------- challenge */

export interface CompareSide { marks: number; max: number; level: number | null; descriptor: string | null }

export interface CompareRow {
  ao: string
  original: CompareSide | null
  remark: CompareSide | null
  delta: number
  levelChanged: boolean
  deciding: Span | null
}

export interface Comparison {
  outcome: string
  line: string | null
  rows: CompareRow[]
  originalTotal: number | null
  remarkTotal: number | null
  tolerance: number | null
  alreadyChallenged: boolean
}

const OUTCOME_SENTENCE: Record<string, string> = {
  stands: 'The second marker read it the same way, inside the tolerance for this paper. The original mark stands.',
  revised: 'The second marker read it differently. The re-mark is the one that counts; the original is kept beside it.',
  split: 'The two markers put it in different levels. Both readings are kept — this is the case to take to your teacher.',
}

function sideOf(raw: unknown): CompareSide | null {
  const source = record(raw)
  if (!source) return null
  return {
    marks: num(source, ['marks']) ?? 0,
    max: num(source, ['max']) ?? 0,
    level: num(source, ['level']),
    descriptor: text(source, ['descriptor']),
  }
}

/** The challenge endpoint's answer, read into the two-column compare table. */
export function readComparison(raw: unknown, original: Mark): Comparison {
  const source = record(raw) ?? {}
  const remarkPayload = record(source.remark)
  const remarkMark = remarkPayload ? normaliseMark(remarkPayload as MarkPayload, original.answer) : null
  const rows = list(source, ['deltas', 'rows', 'per_ao']).map((entry) => {
    const row = record(entry) ?? {}
    const ao = text(row, ['ao']) || ''
    const remarkAo = remarkMark?.per_ao.find((one) => one.ao === ao) ?? null
    const originalAo = original.per_ao.find((one) => one.ao === ao) ?? null
    const deciding =
      (remarkAo?.credited_spans ?? []).find(
        (span) => !(originalAo?.credited_spans ?? []).some((was) => was.quote === span.quote),
      ) ?? null
    return {
      ao,
      original: sideOf(row.original),
      remark: sideOf(row.remark ?? row.second ?? row.second_look),
      delta: num(row, ['deltaMarks', 'delta']) ?? 0,
      levelChanged: row.levelChanged === true,
      deciding,
    }
  })
  return {
    outcome: text(source, ['outcome']) || 'stands',
    line: text(source, ['line']),
    rows,
    originalTotal: num(record(source.original), ['total']),
    remarkTotal: num(remarkPayload, ['total']),
    tolerance: num(source, ['tolerance']),
    alreadyChallenged: source.alreadyChallenged === true,
  }
}

/* ------------------------------------------------------------------- view */

export interface MarkViewProps {
  /** The Mark, either as the API sent it or already normalised. */
  mark: MarkPayload | Mark | null
  /** The student's answer, verbatim. It stays on screen through every state. */
  answer?: string
  status?: MarkStatus
  /** What the marker is doing right now, in words. */
  statusLine?: string | null
  error?: string | null
  onRetry?: () => void
  onPrimaryAction?: (action: NextActionView) => void
  /** Objectives the grid will carry, so the cards hold their height while marking. */
  expectedAos?: string[]
  compact?: boolean
}

export function MarkView({
  mark: input,
  answer = '',
  status = 'ready',
  statusLine,
  error,
  onRetry,
  onPrimaryAction,
  expectedAos,
  compact = false,
}: MarkViewProps) {
  const [activeAo, setActiveAo] = useState<string | null>(null)
  const [activeSpan, setActiveSpan] = useState<string | null>(null)
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [challengeError, setChallengeError] = useState<string | null>(null)
  const [comparison, setComparison] = useState<Comparison | null>(null)

  const mark = useMemo<Mark | null>(() => {
    if (!input) return null
    return isViewModel(input) ? input : normaliseMark(input, answer)
  }, [input, answer])

  const shownAnswer = answer || mark?.answer || ''
  const perAo = mark?.per_ao ?? []

  const runs = useMemo(() => {
    const sources: SpanSource[] = []
    for (const ao of perAo) {
      if (ao.credited_spans?.length) sources.push({ ao: ao.ao, kind: 'credited', spans: ao.credited_spans })
      if (ao.partial_spans?.length) sources.push({ ao: ao.ao, kind: 'partial', spans: ao.partial_spans })
      if (ao.uncredited_attempts?.length) sources.push({ ao: ao.ao, kind: 'uncredited', spans: ao.uncredited_attempts })
    }
    if (!sources.length && mark?.runs?.length) return mark.runs
    return buildRuns(shownAnswer, sources)
  }, [mark, perAo, shownAnswer])

  const pending = useMemo(() => {
    const wanted = expectedAos ?? Object.keys(mark?.header.ao_split ?? {})
    const done = new Set(perAo.map((ao) => ao.ao))
    return wanted.filter((ao) => !done.has(ao))
  }, [expectedAos, mark, perAo])

  const band = mark?.total_band ?? null
  const calibration = mark ? calibrationLines(mark.calibration) : null
  const showNumber = !!band && !!mark?.show_number && mark.calibration.state !== 'uncalibrated'
  const streaming = status === 'streaming' || status === 'loading'
  // While the first objective is still coming there is no total to show, and a zero
  // in the total's place would be a lie about the mark.
  const marking = streaming && perAo.length === 0
  const action = mark?.next_action ?? null

  const runAction = (next: NextActionView) => {
    if (onPrimaryAction) return onPrimaryAction(next)
    if (next.target_ao) {
      setActiveAo(next.target_ao)
      document.getElementById(`ao-${next.target_ao}`)?.scrollIntoView({ block: 'center' })
    }
  }

  const sendChallenge = async () => {
    if (!mark?.mark_id) return
    setSending(true)
    setChallengeError(null)
    try {
      const raw = await post<unknown>(`/api/marks/${mark.mark_id}/challenge`, { reason: reason.trim() })
      setComparison(readComparison(raw, mark))
      setChallengeOpen(false)
    } catch (failure) {
      setChallengeError(
        failure instanceof ApiError ? failure.message : 'The second marker did not answer. Your challenge is not lost — send it again.',
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={compact ? 'mark-view mark-view--compact' : 'mark-view'}>
      <header className="mark-view__header">
        <div className="mark-view__ident">
          <TariffPill tariff={mark?.header.tariff ?? 0} commandWord={mark?.header.command_word ?? null} />
          {mark?.header.question_ref ? <span className="mark-view__ref mono">{mark.header.question_ref}</span> : null}
          {mark?.header.syllabus_point ? <span className="mark-view__point">{mark.header.syllabus_point}</span> : null}
        </div>
        {mark?.header.ao_split ? (
          <p className="mark-view__split mono">
            {Object.entries(mark.header.ao_split).map(([ao, max]) => `${ao} ${max}`).join(' · ')}
          </p>
        ) : null}
        {mark?.header.scheme_id || mark?.header.pack_version ? (
          <p className="mark-view__provenance mono">
            {[mark?.header.scheme_id, mark?.header.pack_version].filter(Boolean).join(' · ')}
          </p>
        ) : null}
        {mark?.degraded ? (
          <p className="mark-view__degraded">
            Marked by the built-in marker: no model provider is configured, so this reads the scheme and matches against it directly.
          </p>
        ) : null}
      </header>

      <div className="mark-view__result" hidden={marking}>
        {showNumber && band ? (
          <>
            <p className="mark-view__total mono">
              <span className="mark-view__total-number">
                {band.low === band.high ? band.modal : `${band.low}–${band.high}`}
              </span>
              <span className="mark-view__total-of"> of {mark?.header.tariff ?? band.high}</span>
              {band.exact ? <span className="mark-view__exact"> · exact</span> : null}
            </p>
            {mark?.tolerance_line ? (
              <p className="mark-view__tolerance">{mark.tolerance_line}</p>
            ) : band.low !== band.high && band.tolerance ? (
              <p className="mark-view__tolerance">Real examiners disagree by about ±{band.tolerance} on items like this.</p>
            ) : null}
          </>
        ) : (
          <p className="mark-view__no-number">
            No total on this paper yet — the objectives below are the result.
          </p>
        )}
        {calibration ? (
          <>
            <p className={mark?.calibration.state === 'gated' ? 'mark-view__badge' : 'mark-view__badge mark-view__badge--soft'}>
              {calibration.badge}
              {mark?.model ? <span className="mark-view__vendor mono"> {mark.model}</span> : null}
            </p>
            {calibration.why ? <p className="mark-view__badge-why">{calibration.why}</p> : null}
          </>
        ) : null}
      </div>

      {mark?.command_word_check ? (
        <p className={mark.command_word_check.met ? 'mark-view__command' : 'mark-view__command mark-view__command--unmet'}>
          <span className="mark-view__command-flag mono" aria-hidden="true">{mark.command_word_check.met ? '✓' : '!'}</span>
          <span>
            <span className="sr">{mark.command_word_check.met ? 'Command word answered. ' : 'Command word not answered. '}</span>
            {mark.command_word_check.coaching_line ||
              `${mark.command_word_check.command_word ?? mark.header.command_word ?? 'The command word'} — ${
                mark.command_word_check.met ? 'answered.' : 'not answered in this response.'
              }`}
          </span>
        </p>
      ) : null}

      <p className="mark-view__status" aria-live="polite">
        {streaming
          ? statusLine || 'Marking against the grid, one objective at a time.'
          : error
            ? 'Marking stopped. Your answer is unchanged.'
            : ''}
      </p>

      {error ? (
        <div className="mark-view__error" role="alert">
          <p className="mark-view__error-line">{error}</p>
          <p className="mark-view__error-note">Your answer is on this page and has not been touched.</p>
          {onRetry ? <button type="button" className="mark-view__retry" onClick={onRetry}>Mark it again</button> : null}
        </div>
      ) : null}

      <div className="mark-view__body">
        <div className="mark-view__cards">
          {perAo.map((ao) => (
            <div className="mark-view__card-slot" id={`ao-${ao.ao}`} key={ao.ao}>
              <AOCard
                ao={ao}
                active={activeAo === ao.ao}
                activeSpan={activeSpan}
                onHover={setActiveAo}
                onSelectSpan={(id, which) => { setActiveSpan(id); setActiveAo(which) }}
              />
            </div>
          ))}
          {pending.map((ao) => (
            <AOCardSkeleton key={ao} ao={ao} max={mark?.header.ao_split?.[ao] ?? null} />
          ))}
        </div>

        <div className="mark-view__answer">
          <h2 className="mark-view__answer-title">Your answer, with the marker's reading on it</h2>
          <p className="mark-view__legend">
            <span className="mark-view__legend-item">✓ solid underline — credited</span>
            <span className="mark-view__legend-item">· dashed — partly credited</span>
            <span className="mark-view__legend-item">× dotted — not credited</span>
          </p>
          <SpanText
            text={shownAnswer}
            runs={runs}
            activeAo={activeAo}
            activeSpan={activeSpan}
            onHoverSpan={(run) => setActiveAo(run ? run.ao : null)}
            onSelectSpan={(run) => { setActiveSpan(run.id); setActiveAo(run.ao) }}
          />
        </div>
      </div>

      {mark?.application_check ? (
        <section className="mark-view__check">
          <h2 className="mark-view__check-title">Cover the name</h2>
          <p className="mark-view__check-line">
            {mark.application_check.line
              || `Cover the business name and read it back: ${mark.application_check.passed.length} of ${mark.application_check.tested} ${
                mark.application_check.tested === 1 ? 'point still names this case' : 'points still name this case'
              }.`}
          </p>
          {mark.application_check.failed.length ? (
            <ul className="mark-view__check-list">
              {mark.application_check.failed.map((failed, index) => (
                <li key={`${failed.line_ref ?? 'x'}-${index}`}>
                  {failed.line_ref ? <span className="mono">{failed.line_ref} </span> : null}
                  <span className="read">“{failed.quote}”</span>
                  <span className="mark-view__check-why"> — true of any business, so it earns no application mark.</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {mark?.examiner_warnings.length ? (
        <section className="mark-view__check">
          <h2 className="mark-view__check-title">What examiners report on this question</h2>
          <ul className="mark-view__check-list">
            {mark.examiner_warnings.map((warning, index) => (
              <li key={index}>
                {warning.paraphrase}
                <span className="mark-view__series mono">
                  {warning.series ? ` ${warning.series}` : ''}
                  {warning.matched_line_ref ? ` · ${warning.matched_line_ref}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {mark?.notes.length ? (
        <p className="mark-view__notes">
          {mark.notes.join(' ')}
        </p>
      ) : null}

      {action ? (
        <section className="mark-view__next">
          <h2 className="mark-view__check-title">One thing next</h2>
          {action.text ? <p className="mark-view__next-text read">{action.text}</p> : null}
          <button type="button" className="mark-view__primary" onClick={() => runAction(action)}>
            {ACTION_LABEL[action.kind] || action.label || 'Do this next'}
          </button>
          {action.expected_gain || action.target_ao ? (
            <p className="mark-view__next-gain mono">
              {[action.target_ao, action.target_line_ref, action.expected_gain].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </section>
      ) : null}

      {mark?.mark_id ? (
        <section className="mark-view__challenge">
          <h2 className="mark-view__check-title">Read it differently?</h2>
          <p className="mark-view__challenge-invite">
            Send it to a second marker. Arguing with a mark is welcome — it is how the marking gets calibrated. Your original
            mark is kept either way, and the two readings are shown side by side.
          </p>

          {!challengeOpen && !comparison ? (
            <button type="button" className="mark-view__challenge-open" onClick={() => setChallengeOpen(true)}>
              Challenge this mark
            </button>
          ) : null}

          {challengeOpen ? (
            <div className="mark-view__challenge-form">
              <label className="mark-view__label" htmlFor="challenge-reason">Which part, and why (optional)</label>
              <input
                id="challenge-reason"
                className="mark-view__reason"
                type="text"
                maxLength={200}
                value={reason}
                placeholder="AO4 — I did commit to one option at the end"
                onChange={(event) => setReason(event.target.value)}
              />
              <div className="mark-view__challenge-actions">
                <button type="button" className="mark-view__primary" onClick={() => void sendChallenge()} disabled={sending}>
                  {sending ? 'A second marker is reading it…' : 'Send for a second look'}
                </button>
                <button type="button" className="mark-view__text-button" onClick={() => setChallengeOpen(false)}>
                  Back to the mark
                </button>
              </div>
              {challengeError ? <p className="mark-view__error-line" role="alert">{challengeError}</p> : null}
            </div>
          ) : null}

          {comparison ? (
            <div className="mark-view__compare">
              <p className="mark-view__compare-outcome">
                <span className="mark-view__compare-word mono">{comparison.outcome}</span>{' '}
                {OUTCOME_SENTENCE[comparison.outcome] || 'Both readings are kept.'}
                {comparison.originalTotal != null && comparison.remarkTotal != null
                  ? ` Total ${comparison.originalTotal} → ${comparison.remarkTotal}.`
                  : ''}
              </p>
              {comparison.line ? <p className="mark-view__deciding">{comparison.line}</p> : null}
              {comparison.alreadyChallenged ? (
                <p className="mark-view__deciding">This mark has had its second look already; this is what the two markers said.</p>
              ) : null}
              <table className="mark-view__table">
                <caption className="sr">The original mark against the second look, per assessment objective</caption>
                <thead>
                  <tr>
                    <th scope="col">Objective</th>
                    <th scope="col">Original</th>
                    <th scope="col">Second look</th>
                    <th scope="col">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.ao} className={row.delta !== 0 || row.levelChanged ? 'is-changed' : undefined}>
                      <th scope="row">{row.ao}</th>
                      <td className="mono">{row.original ? `L${row.original.level ?? '—'} · ${row.original.marks}/${row.original.max}` : '—'}</td>
                      <td className="mono">{row.remark ? `L${row.remark.level ?? '—'} · ${row.remark.marks}/${row.remark.max}` : '—'}</td>
                      <td className="mono">
                        {row.delta === 0 && !row.levelChanged
                          ? 'unchanged'
                          : `${row.delta > 0 ? '+' : ''}${row.delta}${row.levelChanged ? ' · level changed' : ''}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {comparison.rows
                .filter((row) => (row.delta !== 0 || row.levelChanged) && row.original?.descriptor && row.remark?.descriptor)
                .map((row) => (
                  <div className="mark-view__rationales" key={`rationale-${row.ao}`}>
                    <div className="mark-view__rationale">
                      <h3 className="mark-view__rationale-title">{row.ao} · first marker</h3>
                      <p className="read">{row.original?.descriptor}</p>
                    </div>
                    <div className="mark-view__rationale">
                      <h3 className="mark-view__rationale-title">{row.ao} · second marker</h3>
                      <p className="read">{row.remark?.descriptor}</p>
                    </div>
                  </div>
                ))}
              {comparison.rows.filter((row) => row.deciding).map((row) => (
                <p className="mark-view__deciding" key={`deciding-${row.ao}`}>
                  <span className="mono">{row.ao}{row.deciding?.line_ref ? ` · ${row.deciding.line_ref}` : ''} </span>
                  <span className="read">“{row.deciding?.quote}”</span>
                  <span className="mark-view__check-why"> — the line the second marker read differently.</span>
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

export default MarkView
