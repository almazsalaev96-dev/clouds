/**
 * The typed client. Every screen fetches through here, so there is one place where
 * an error becomes an ApiError and one place that knows how to read the turn stream.
 */
import { noteUsage } from './state'

/* ------------------------------------------------------------------- entities */

/** A permissive union: the named values autocomplete, an unexpected one still types. */
type Open<T extends string> = T | (string & {})

export type Phase = Open<'A' | 'B' | 'C'>
export type MasteryState = Open<'unseen' | 'weak' | 'developing' | 'secure' | 'strong'>
export type CalibrationState = Open<'gated' | 'provisional' | 'uncalibrated'>
export type SessionMode = Open<'learn' | 'practise' | 'mark'>
export type TurnIntent = Open<'learn' | 'check' | 'answer'>
export type TurnRole = Open<'user' | 'assistant'>
export type SchemeKind = Open<'levels' | 'points'>
export type ReasonCode = Open<
  | 'SINGLE_LINK' | 'ASSERTION_NO_LINK' | 'GENERIC_NOT_CONTEXT' | 'DATA_NOT_USED'
  | 'EVAL_IN_ANALYSE' | 'TERM_REPEATED_IN_DEFINITION' | 'WRONG_STAKEHOLDER'
  | 'NO_WORKING' | 'UNITS_MISSING' | 'SIG_FIG' | 'CONTRADICTION' | 'ILLEGIBLE'
  | 'OUT_OF_SCOPE' | 'ATOM_NOT_MET' | 'NOT_IN_INDICATIVE_VALID_ALT' | 'DUPLICATE_POINT'
>

/** GET /api/courses — the row plus the countdown the server computes for it. */
export interface Course {
  id: string
  title: string
  board: string
  syllabus: string
  examDate: string | null
  targetGrade: string | null
  packVersion: string
  createdAt: string
  daysToExam: number | null
  weeksToExam: number | null
  phase: Phase
  phaseLabel: string
  countdown: string
}

/** An exam item as the client may see it: never the mark scheme. */
export interface Item {
  id: string
  stem: string
  pack?: string
  syllabusPoint?: string
  paper?: string
  commandWord?: string
  tariff?: number
  /** The scheme's own maximum where it differs from the printed tariff. */
  maxMarks?: number
  kind?: string
  stimulus?: string | null
  difficulty?: number | null
  expectedMinutes?: number
  markable?: boolean
  schemeKind?: SchemeKind | null
}

/** One syllabus point with this learner's state on it. */
export interface SyllabusPoint {
  code: string
  title: string
  id?: string
  paper?: string
  parent?: string | null
  weight?: number
  mastery?: number
  state?: MasteryState
  attempts?: number
  unaidedMarks?: number
  unaidedMax?: number
  unaidedRate?: number | null
  misconceptions?: string[]
  lastSeen?: string | null
  daysSince?: number | null
  neverAttempted?: boolean
  itemCount?: number
  marksAvailable?: number
  topTariff?: number
  minutes?: number
  /** Present on the nested tree from GET /api/courses/:id. */
  children?: SyllabusPoint[]
}

export interface Attempt {
  id: string
  courseId?: string
  itemId?: string
  body?: string
  mode?: SessionMode
  entryRung?: number
  maxRung?: number
  seenSolution?: boolean | number
  confidence?: number | null
  seconds?: number
  createdAt?: string
  markId?: string | null
  item?: Item | null
}

/** A passage of the student's own answer, located by character offset (§05.2). */
export interface Span {
  quote: string
  char_start: number
  char_end: number
  line_ref?: string | null
  evidence_kind?: string | null
  links_counted?: number | null
  marking_point_id?: string | null
  reason_code?: ReasonCode | null
  reason?: string | null
}

/** One assessment objective's verdict: the level, the descriptor, the spans. */
export interface AOCard {
  ao: string
  max: number
  level: number | null
  marks: number
  confidence?: number
  descriptor_relied_on?: { band_id?: string; paraphrase: string; source_ref?: string | null } | null
  credited_spans?: Span[]
  partial_spans?: Span[]
  uncredited_attempts?: Span[]
  missing_points?: string[]
  capped?: boolean
}

export interface PointMark {
  point_id?: string
  awarded: number
  max?: number
  text?: string
  spans?: Span[]
  reason_code?: ReasonCode | null
  reason?: string | null
}

export interface CommandWordCheck {
  command_word?: string | null
  ceiling_ao?: string | null
  met: boolean
  coaching_line?: string | null
  definition_ref?: string | null
  uncapped_level?: number | null
}

export interface ApplicationCheck {
  test?: string
  tested: number
  passed: Span[]
  failed: Span[]
}

export interface ExaminerWarning {
  insight_id?: string
  series?: string
  paraphrase: string
  matched_line_ref?: string | null
}

export interface NextMarkAdvice {
  primary_action?: {
    kind: string
    target_ao?: string
    target_line_ref?: string
    expected_gain?: string
    text?: string
  } | null
  secondary?: { kind: string; target_ao?: string }[]
}

export interface CalibrationStatus {
  state: CalibrationState
  qwk?: number | null
  n_scripts?: number | null
  human_line?: number | null
  last_audit?: string | null
  badge_text?: string
}

export interface MarkSource {
  kind: string
  citation: string
  deep_link?: string | null
  extract?: string | null
  trust_rank?: number
}

export interface Provenance {
  family?: string | null
  model?: string | null
  effort?: string
  degraded?: boolean
  scheme_version?: string
  pack_version?: string
  marked_at?: string
  second_marker?: { family: string; model?: string; total?: number; per_ao_levels_match?: boolean; status: string } | null
}

/** The Mark object of §05.2, as stored in marks.body and streamed by the marker. */
export interface MarkBody {
  mark_id?: string
  attempt_id?: string
  created_at?: string
  header?: {
    item_id?: string
    question_ref?: string | null
    tariff?: number
    command_word?: string | null
    ao_split?: Record<string, number> | null
    scheme_id?: string | null
    syllabus_point?: string | null
  }
  scheme_type?: SchemeKind
  total_band?: { low: number; modal: number; high: number; tolerance: number; exact?: boolean } | null
  per_ao?: AOCard[]
  per_point?: PointMark[]
  command_word_check?: CommandWordCheck | null
  application_check?: ApplicationCheck | null
  examiner_warnings?: ExaminerWarning[] | null
  missing_points?: string[] | null
  next_mark_advice?: NextMarkAdvice | null
  calibration_status?: CalibrationStatus | null
  sources?: MarkSource[]
  provenance?: Provenance | null
  annotations?: { glyph: string; char_start: number; char_end: number }[]
  visibility?: { show_number?: boolean; show_predicted_grade?: boolean; show_teacher_flag?: boolean } | null
  challenge_state?: string | null
  /** The confirmed answer the spans are measured against. */
  transcript?: { text: string; words?: number; chars?: number; lines?: { n: number; start: number; end: number }[] } | null
}

/** GET /api/marks/:id — the stored row, the Mark object, and the rendered view. */
export interface Mark {
  id: string
  attemptId: string
  itemId: string
  courseId: string
  total: number
  max: number
  percent: number | null
  summary: string
  /** The Mark object itself (§05.2). */
  mark: MarkBody
  aos?: AOCard[]
  model?: string | null
  degraded?: boolean | null
  createdAt: string
  item?: Item | null
  courseTitle?: string | null
  cards?: Card[]
  /** The renderer adds its own slots; they are read by name where needed. */
  [key: string]: unknown
}

export interface Card {
  id: string
  front: string
  back: string
  due: string
  courseId?: string
  syllabusPoint?: string
  source?: string
  provenance?: string
  stability?: number
  difficulty?: number
  overdueDays?: number
  reps?: number
  lapses?: number
  lastReview?: string | null
  createdAt?: string
  isNew?: boolean
  isRetest?: boolean
  courseTitle?: string | null
}

/** One block of the day's plan, with the reason it was scheduled. */
export interface PlanBlock {
  kind: Open<'due' | 'practise' | 'new' | 'timed' | 'review' | 'rest'>
  title: string
  minutes: number
  reason?: string
  reasons?: string[]
  count?: number
  points?: string[]
  cardIds?: string[]
  items?: Item[]
  done?: boolean
}

export interface PointProgress {
  code: string
  title: string
  paper?: string
  weight?: number
  mastery: number
  state?: MasteryState
  attempts: number
  unaidedMarks?: number
  unaidedMax?: number
  unaidedRate?: number | null
  lastSeen?: string | null
  daysSince?: number | null
  itemCount?: number
}

export interface PaperReadiness {
  paper: string
  readiness: number
  pointCount: number
  pointsSeen: number
  sampleSize: number
  unaidedMarks: number
  unaidedMax: number
  unaidedRate: number | null
  evidence: Open<'sufficient' | 'thin' | 'insufficient'>
}

/** GET /api/progress — mastery per point, readiness per paper, the honest sample size. */
export interface Progress {
  courseId: string
  course?: Course
  masteryByPoint: PointProgress[]
  readiness: PaperReadiness[]
  unaidedGain?: unknown
  calibration?: unknown
  totals?: {
    attempts: number
    unaidedAttempts: number
    marksTaken: number
    pointsSeen: number
    points: number
  }
}

/** One persisted turn of a session. */
export interface TurnRecord {
  id: string
  role: TurnRole
  body: string
  rung: number | null
  intent: TurnIntent | null
  handback: string | null
  /** Parsed JSON when the server stored an object; shape belongs to the gate. */
  gate: unknown
  lint: unknown
  model: string | null
  cost: number | null
  ttftMs: number | null
  itemId: string | null
  createdAt: string
}

export interface ProviderStatus { name: string; configured: boolean }
export interface Health { ok: boolean; providers: ProviderStatus[] }

export interface Usage {
  turns?: number
  marks?: number
  cards?: number
  cost_usd?: number
  costUsd?: number
  since?: string
}

/* --------------------------------------------------------------------- errors */

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function messageFor(status: number, body: unknown): string {
  if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
    return (body as { error: string }).error
  }
  if (status === 404) return 'That is not there any more. Go back and pick it again.'
  if (status === 429) return 'Too many requests at once. Wait a moment and send it again.'
  if (status >= 500) return 'The server could not finish that. Try again.'
  return `Request failed with status ${status}.`
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check it is running, then try again.')
  }
  const text = await response.text()
  let parsed: unknown = null
  if (text) { try { parsed = JSON.parse(text) } catch { parsed = null } }
  if (!response.ok) throw new ApiError(response.status, messageFor(response.status, parsed))
  return parsed as T
}

export function get<T>(path: string): Promise<T> { return request<T>('GET', path) }
export function post<T>(path: string, body?: unknown): Promise<T> { return request<T>('POST', path, body ?? {}) }
export function patch<T>(path: string, body?: unknown): Promise<T> { return request<T>('PATCH', path, body ?? {}) }
export function del<T>(path: string): Promise<T> { return request<T>('DELETE', path) }

/**
 * Endpoints answer either with a bare array or with the array under a key.
 * Screens should not have to care which.
 */
export function unwrapList<T>(payload: unknown, key?: string): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const candidates = key ? [key, 'items', 'rows', 'data', 'results'] : ['items', 'rows', 'data', 'results']
    for (const candidate of candidates) {
      if (Array.isArray(record[candidate])) return record[candidate] as T[]
    }
  }
  return []
}

/** True when no real provider is configured and the built-in model is answering. */
export function isDegraded(health: Health | null): boolean {
  if (!health) return false
  return !health.providers.some(provider => provider.configured)
}

/* ------------------------------------------------------------------ streaming */

export interface TurnRequest {
  /** What the student wrote. The server rejects an empty one. */
  text?: string
  sessionId?: string | null
  courseId?: string | null
  itemId?: string | null
  intent?: TurnIntent
  mode?: SessionMode
  rung?: number
  studentRequested?: boolean
  [key: string]: unknown
}

/** Whatever the server closes the stream with: the persisted turn and its cost line. */
export interface TurnMeta {
  id?: string
  sessionId?: string
  rung?: number
  rungName?: string | null
  rungBudget?: number
  cappedBy?: string | null
  handback?: string | null
  gate?: unknown
  lint?: unknown
  model?: string
  cost?: number
  ttftMs?: number
  degraded?: boolean
  seenSolution?: boolean
  retest?: string | null
  usage?: { in?: number; out?: number }
  /** Frames carry more than this; unknown keys stay readable. */
  [key: string]: unknown
}

export interface StreamHandlers {
  /** The opening frame: session id, gate state, hand-back, degraded flag. */
  onStart?: (meta: TurnMeta) => void
  onDelta?: (text: string) => void
  /** The tutor replacing what it already said — a correction, not an append. */
  onRevise?: (text: string) => void
  onTurn?: (meta: TurnMeta) => void
  onError?: (error: ApiError) => void
  /** Route status while nothing has streamed yet: "Reading the mark scheme…". */
  onStatus?: (text: string) => void
  onDone?: () => void
}

function textOf(data: unknown): string {
  if (typeof data === 'string') return data
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    for (const key of ['text', 'delta', 'content', 'body', 'message']) {
      if (typeof record[key] === 'string') return record[key] as string
    }
  }
  return ''
}

/**
 * POST a turn and read the SSE reply. A chunk can split a frame anywhere, so lines
 * are buffered until a blank line closes the frame. Returns an abort function.
 */
export function streamTurn(body: TurnRequest, handlers: StreamHandlers): () => void {
  const controller = new AbortController()
  let finished = false

  const finish = () => {
    if (finished) return
    finished = true
    handlers.onDone?.()
  }
  const fail = (error: ApiError) => {
    if (finished) return
    finished = true
    handlers.onError?.(error)
  }

  const handleFrame = (event: string, raw: string) => {
    let data: unknown = raw
    if (raw) { try { data = JSON.parse(raw) } catch { data = raw } }
    switch (event) {
      case 'delta': case 'token': case 'text': case 'message':
        handlers.onDelta?.(textOf(data))
        break
      case 'revise': case 'revision': case 'rewrite':
        handlers.onRevise?.(textOf(data))
        break
      case 'status': case 'route': case 'thinking':
        handlers.onStatus?.(textOf(data))
        break
      case 'start':
        handlers.onStart?.((data && typeof data === 'object' ? data : {}) as TurnMeta)
        break
      case 'turn': case 'meta': case 'final': {
        const meta = (data && typeof data === 'object' ? data : {}) as TurnMeta
        noteUsage({ turns: 1, costUsd: typeof meta.cost === 'number' ? meta.cost : 0 })
        handlers.onTurn?.(meta)
        break
      }
      case 'error': {
        const message = textOf(data) || 'The turn stopped before it finished. Send it again.'
        const status = data && typeof data === 'object' && typeof (data as { status?: unknown }).status === 'number'
          ? (data as { status: number }).status
          : 500
        fail(new ApiError(status, message))
        break
      }
      case 'done': case 'end':
        finish()
        break
      default:
        break
    }
  }

  void (async () => {
    let response: Response
    try {
      response = await fetch('/api/session/turn', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch {
      if (!controller.signal.aborted) fail(new ApiError(0, 'Cannot reach the server. Check it is running, then try again.'))
      return
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      let parsed: unknown = null
      if (text) { try { parsed = JSON.parse(text) } catch { parsed = null } }
      fail(new ApiError(response.status, messageFor(response.status, parsed)))
      return
    }
    if (!response.body) {
      fail(new ApiError(500, 'The server sent no stream to read.'))
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const parseFrame = (frame: string) => {
      let event = 'message'
      const dataLines: string[] = []
      for (const line of frame.split(/\r?\n/)) {
        if (!line || line.startsWith(':')) continue
        const colon = line.indexOf(':')
        const field = colon < 0 ? line : line.slice(0, colon)
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
        if (field === 'event') event = value
        else if (field === 'data') dataLines.push(value)
      }
      handleFrame(event, dataLines.join('\n'))
    }

    const drain = (flush: boolean) => {
      // Frames end at a blank line; \r\n is tolerated so a proxy cannot break parsing.
      for (;;) {
        const match = /\r?\n\r?\n/.exec(buffer)
        if (!match) break
        const frame = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)
        parseFrame(frame)
      }
      if (flush && buffer.trim()) {
        // A final frame with no trailing blank line still counts.
        const frame = buffer
        buffer = ''
        parseFrame(frame)
      }
    }

    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        drain(false)
      }
      buffer += decoder.decode()
      drain(true)
      finish()
    } catch {
      if (controller.signal.aborted) { finished = true; return }
      fail(new ApiError(0, 'The connection dropped mid-answer. Send it again.'))
    }
  })()

  return () => {
    finished = true
    controller.abort()
  }
}

/* ------------------------------------------------------------------ shortcuts */

/** The two calls the shell itself makes. Screens use get/post directly. */
export const api = {
  health: () => get<Health>('/api/health'),
  courses: async (): Promise<Course[]> => unwrapList<Course>(await get<unknown>('/api/courses'), 'courses'),
}
