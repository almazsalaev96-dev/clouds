import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { get, streamTurn } from '../lib/api'
import type { Item, SyllabusPoint, TurnRecord } from '../lib/api'
import { useStore } from '../lib/state'
import { Composer } from '../components/Composer'
import type { Intent, Mode } from '../components/Composer'
import { TurnCard } from '../components/TurnCard'
import type { Citation } from '../components/TurnCard'
import { LadderControl } from '../components/LadderControl'
import './Session.css'

/* ------------------------------------------------------------------ *
 * Reading the API.
 *
 * The endpoints return a mixture of the SQLite columns and camel-cased
 * views of them, so every field the screen reads goes through one of the
 * readers below. A naming difference then costs a line, never the screen.
 * ------------------------------------------------------------------ */

function field(source: unknown, ...keys: string[]): unknown {
  if (!source || typeof source !== 'object') return undefined
  const row = source as Record<string, unknown>
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}
const asText = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined)
const asNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return undefined
}
function asList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  const nested = field(v, 'turns', 'items', 'points', 'syllabus', 'rows', 'data')
  return Array.isArray(nested) ? nested : []
}

export interface ItemView {
  id: string
  stem: string
  stimulus?: string
  tariff?: number
  commandWord?: string
  syllabusPoint?: string
  pointTitle?: string
  paper?: string
}

export function readItem(raw: Item | unknown): ItemView {
  return {
    id: asText(field(raw, 'id')) ?? '',
    stem: asText(field(raw, 'stem', 'question')) ?? '',
    stimulus: asText(field(raw, 'stimulus')),
    tariff: asNumber(field(raw, 'tariff', 'marks')),
    commandWord: asText(field(raw, 'commandWord', 'command_word')),
    syllabusPoint: asText(field(raw, 'syllabusPoint', 'syllabus_point')),
    pointTitle: asText(field(raw, 'pointTitle', 'point_title')),
    paper: asText(field(raw, 'paper')),
  }
}

export interface PointView { code: string; title: string }

export function readPoint(raw: SyllabusPoint | unknown): PointView {
  return {
    code: asText(field(raw, 'code')) ?? '',
    title: asText(field(raw, 'title', 'name')) ?? '',
  }
}

/**
 * The gate as the server states it: `open: true` means the student may go through.
 * The screen speaks of it the other way round — the gate is *waiting* for a go.
 */
export function readGate(value: unknown): { open: boolean; message?: string } | undefined {
  if (typeof value === 'string') {
    const text = value.trim()
    if (text.startsWith('{')) {
      try { return readGate(JSON.parse(text) as unknown) } catch { /* not JSON */ }
    }
    if (!text) return undefined
    return { open: text !== 'open' }
  }
  if (value && typeof value === 'object') {
    const open = field(value, 'open')
    return {
      open: open === true,
      message: asText(field(value, 'message')),
    }
  }
  return undefined
}

/** "Seen solution · retest Thursday" — the weekday the retest card is due. */
export function weekdayOf(value: unknown): string | undefined {
  const due = asText(field(value, 'due')) ?? (typeof value === 'string' ? value : undefined)
  if (!due) return undefined
  const date = new Date(due)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toLocaleDateString('en-GB', { weekday: 'long' })
}

export interface UiTurn {
  id: string
  role: 'user' | 'assistant'
  text: string
  rung?: number
  gateWaiting?: boolean
  seenSolution?: boolean
  retestLabel?: string
  model?: string
  cost?: number
  ttftMs?: number
  streaming?: boolean
  stopped?: boolean
  queued?: boolean
  error?: string
  citations?: Citation[]
}

function readCitations(value: unknown): Citation[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: Citation[] = []
  value.forEach((row, i) => {
    const label = typeof row === 'string' ? row : asText(field(row, 'label', 'title', 'ref'))
    if (!label) return
    out.push({
      id: asText(field(row, 'id')) ?? `cite${i}`,
      label,
      body: asText(field(row, 'body', 'quote', 'passage')),
    })
  })
  return out.length ? out : undefined
}

export function readTurn(raw: TurnRecord | unknown, fallbackId: string): UiTurn {
  const role = asText(field(raw, 'role'))
  const gate = readGate(field(raw, 'gate'))
  const rung = asNumber(field(raw, 'rung'))
  return {
    id: asText(field(raw, 'id')) ?? fallbackId,
    role: role === 'user' || role === 'student' ? 'user' : 'assistant',
    text: asText(field(raw, 'body', 'text')) ?? '',
    rung,
    gateWaiting: gate ? !gate.open : undefined,
    seenSolution: rung !== undefined && rung >= 5,
    model: asText(field(raw, 'model')),
    cost: asNumber(field(raw, 'cost')),
    ttftMs: asNumber(field(raw, 'ttftMs', 'ttft_ms')),
    citations: readCitations(field(raw, 'citations')),
  }
}

/* ------------------------------------------------------------------ *
 * The streaming hook. Session and Ask both run their turns through it,
 * so §09.8 is implemented once.
 * ------------------------------------------------------------------ */

const CHARS_PER_FRAME = 90     // 09-STRM-004
const STATUS_AT = 800          // 09-STRM-002
const SLOW_AT = 6000           // 09-STRM-003

export interface SendOptions {
  intent: Intent
  text: string
  itemId?: string | null
  mode?: Mode
  /** The student clicked a rung above the one they were given. */
  studentRequested?: boolean
  requestedRung?: number
  /** false when the send has no student words of its own to paint. */
  echo?: boolean
}

export interface LadderState {
  rung: number
  budget: number
  cappedBy?: string
  waiting: boolean
}

export function useSessionStream(options: {
  courseId: string | null
  sessionId: string
  statusLine: string
}) {
  const { courseId, sessionId, statusLine } = options
  const [turns, setTurns] = useState<UiTurn[]>([])
  const [streaming, setStreaming] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [handback, setHandback] = useState('')
  const [ladder, setLadder] = useState<LadderState>({ rung: 0, budget: 5, waiting: true })
  const [degraded, setDegraded] = useState(false)
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine)

  const buffer = useRef('')
  const frame = useRef(0)
  const activeId = useRef<string | null>(null)
  const stopper = useRef<(() => void) | null>(null)
  const timers = useRef<number[]>([])
  const queue = useRef<{ options: SendOptions; turnId: string }[]>([])
  const lastSend = useRef<SendOptions | null>(null)

  const clearTimers = useCallback(() => {
    timers.current.forEach(t => window.clearTimeout(t))
    timers.current = []
  }, [])

  const patch = useCallback((id: string, next: Partial<UiTurn>) => {
    setTurns(list => list.map(t => (t.id === id ? { ...t, ...next } : t)))
  }, [])

  const drain = useCallback(() => {
    frame.current = 0
    const id = activeId.current
    if (!id || buffer.current.length === 0) return
    const chunk = buffer.current.slice(0, CHARS_PER_FRAME)
    buffer.current = buffer.current.slice(chunk.length)
    setTurns(list => list.map(t => (t.id === id ? { ...t, text: t.text + chunk } : t)))
    if (buffer.current.length > 0) frame.current = window.requestAnimationFrame(drain)
  }, [])

  const schedule = useCallback(() => {
    if (frame.current === 0) frame.current = window.requestAnimationFrame(drain)
  }, [drain])

  const flush = useCallback(() => {
    if (frame.current !== 0) { window.cancelAnimationFrame(frame.current); frame.current = 0 }
    const id = activeId.current
    const rest = buffer.current
    buffer.current = ''
    if (id && rest) setTurns(list => list.map(t => (t.id === id ? { ...t, text: t.text + rest } : t)))
  }, [])

  const run = useCallback((sendOptions: SendOptions, assistantId: string) => {
    lastSend.current = sendOptions
    activeId.current = assistantId
    buffer.current = ''
    setStreaming(true)
    setStatus(null)
    clearTimers()
    timers.current.push(window.setTimeout(() => setStatus(statusLine), STATUS_AT))
    timers.current.push(window.setTimeout(
      () => setStatus('Taking longer than usual. Stop and send it again if you would rather not wait.'),
      SLOW_AT))

    const finish = () => {
      flush()
      clearTimers()
      setStatus(null)
      setStreaming(false)
      activeId.current = null
      stopper.current = null
    }

    stopper.current = streamTurn(
      {
        sessionId,
        courseId,
        itemId: sendOptions.itemId ?? null,
        text: sendOptions.text,
        intent: sendOptions.intent,
        mode: sendOptions.mode ?? 'learn',
        studentRequested: sendOptions.studentRequested === true,
        requestedRung: sendOptions.requestedRung,
      },
      {
        onStatus(text: string) {
          if (text) setStatus(text)
        },
        onDelta(text: string) {
          clearTimers()
          setStatus(null)
          buffer.current += text
          schedule()
        },
        onRevise(text: string) {
          buffer.current = ''
          patch(assistantId, { text })
        },
        onTurn(meta) {
          flush()
          const gate = readGate(field(meta, 'gate'))
          const rung = asNumber(field(meta, 'rung')) ?? 0
          const seen = field(meta, 'seenSolution', 'seen_solution') === true
          const retest = weekdayOf(field(meta, 'retest'))
          patch(assistantId, {
            streaming: false,
            rung,
            gateWaiting: gate ? !gate.open : undefined,
            seenSolution: seen,
            retestLabel: retest,
            model: asText(field(meta, 'model')),
            cost: asNumber(field(meta, 'cost')),
            ttftMs: asNumber(field(meta, 'ttftMs', 'ttft_ms')),
            citations: readCitations(field(meta, 'citations')),
          })
          setLadder(previous => ({
            rung: Math.max(rung, 0),
            budget: asNumber(field(meta, 'rungBudget')) ?? previous.budget,
            cappedBy: asText(field(meta, 'cappedBy')),
            waiting: gate ? !gate.open : previous.waiting,
          }))
          setHandback(asText(field(meta, 'handback')) ?? '')
          setDegraded(field(meta, 'degraded') === true)
          finish()
        },
        onError(error) {
          flush()
          const message = asText(field(error, 'message'))
            ?? 'The turn stopped before it finished. Your message is still here.'
          patch(assistantId, { streaming: false, error: message })
          finish()
        },
      },
    )
  }, [courseId, sessionId, statusLine, clearTimers, flush, patch, schedule])

  const send = useCallback((sendOptions: SendOptions) => {
    if (activeId.current) return
    if (sendOptions.text.trim().length === 0) return
    const stamp = Math.random().toString(36).slice(2, 10)
    const userId = `u${stamp}`
    const assistantId = `a${stamp}`
    const echo = sendOptions.echo !== false

    if (!online) {
      setTurns(list => [...list, { id: userId, role: 'user', text: sendOptions.text, queued: true }])
      queue.current.push({ options: { ...sendOptions, echo: false }, turnId: userId })
      return
    }

    setTurns(list => [
      ...list,
      ...(echo ? [{ id: userId, role: 'user' as const, text: sendOptions.text }] : []),
      { id: assistantId, role: 'assistant' as const, text: '', streaming: true },
    ])
    run(sendOptions, assistantId)
  }, [online, run])

  const stop = useCallback(() => {
    const id = activeId.current
    stopper.current?.()
    flush()
    clearTimers()
    setStatus(null)
    setStreaming(false)
    if (id) patch(id, { streaming: false, stopped: true })
    activeId.current = null
    stopper.current = null
  }, [clearTimers, flush, patch])

  const retry = useCallback(() => {
    const previous = lastSend.current
    if (!previous || activeId.current) return
    const assistantId = `a${Math.random().toString(36).slice(2, 10)}`
    setTurns(list => [...list, { id: assistantId, role: 'assistant', text: '', streaming: true }])
    run({ ...previous, echo: false }, assistantId)
  }, [run])

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  // What was written offline goes out in order once the connection returns.
  useEffect(() => {
    if (!online || streaming || activeId.current || queue.current.length === 0) return
    const next = queue.current.shift()
    if (!next) return
    patch(next.turnId, { queued: false })
    const assistantId = `a${Math.random().toString(36).slice(2, 10)}`
    setTurns(list => [...list, { id: assistantId, role: 'assistant', text: '', streaming: true }])
    run(next.options, assistantId)
  }, [online, streaming, patch, run])

  useEffect(() => () => {
    timers.current.forEach(t => window.clearTimeout(t))
    if (frame.current !== 0) window.cancelAnimationFrame(frame.current)
    stopper.current?.()
  }, [])

  return {
    turns, setTurns, streaming, status, handback, ladder, setLadder,
    degraded, online, send, stop, retry,
  }
}

/**
 * The technical footer is a Settings preference stamped on <html> as
 * `data-technical="on"`. Reading the attribute keeps the screens uncoupled.
 */
export function useTechnicalFooter(): boolean {
  const [on, setOn] = useState(() =>
    typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-technical') === 'on')
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      setOn(root.getAttribute('data-technical') === 'on')
    })
    observer.observe(root, { attributes: true, attributeFilter: ['data-technical'] })
    return () => observer.disconnect()
  }, [])
  return on
}

function hashParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  const at = hash.indexOf('?')
  if (at === -1) return null
  return new URLSearchParams(hash.slice(at + 1)).get(name)
}

export function newSessionId(prefix = 's'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 14)}`
}

/* ------------------------------------------------------------------ *
 * The screen.
 * ------------------------------------------------------------------ */

export function Session() {
  const app = useStore()
  const showFooter = useTechnicalFooter()
  const [route, setRoute] = useState(() => ({
    itemId: hashParam('item'),
    courseId: hashParam('course'),
  }))
  const [fallbackCourse, setFallbackCourse] = useState<string | null>(null)
  const courseId = route.courseId ?? app.courseId ?? fallbackCourse
  const [sessionId] = useState(() => app.sessionId ?? newSessionId())

  const [item, setItem] = useState<ItemView | null>(null)
  const [itemError, setItemError] = useState<string | null>(null)
  const [points, setPoints] = useState<PointView[]>([])
  const [pointsError, setPointsError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [intent, setIntent] = useState<Intent>('learn')
  const [mode, setMode] = useState<Mode>('learn')
  const [paneOpen, setPaneOpen] = useState(false)
  const [citation, setCitation] = useState<Citation | null>(null)
  const [showNew, setShowNew] = useState(false)

  const statusLine = useMemo(
    () => (item?.paper
      ? `Reading the ${item.paper} mark scheme and your last attempts…`
      : 'Reading your course materials…'),
    [item?.paper],
  )

  const {
    turns, setTurns, streaming, status, handback, ladder, setLadder,
    degraded, online, send, stop, retry,
  } = useSessionStream({ courseId, sessionId, statusLine })

  const streamRef = useRef<HTMLDivElement | null>(null)
  const pinned = useRef(true)

  useEffect(() => {
    const onHash = () => setRoute({ itemId: hashParam('item'), courseId: hashParam('course') })
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (courseId) return
    let live = true
    get('/api/courses')
      .then((data: unknown) => {
        if (!live) return
        setFallbackCourse(asText(field(asList(data)[0], 'id')) ?? null)
      })
      .catch(() => { /* the empty state already covers a session with no course */ })
    return () => { live = false }
  }, [courseId])

  // The item under study. A new item resets the ladder: it never carries across.
  useEffect(() => {
    const id = route.itemId
    setLadder({ rung: 0, budget: 5, waiting: !!id })
    if (!id) { setItem(null); setItemError(null); return }
    let live = true
    setItemError(null)
    get(`/api/items/${encodeURIComponent(id)}`)
      .then((data: unknown) => { if (live) setItem(readItem(data)) })
      .catch((error: unknown) => {
        if (!live) return
        setItem(null)
        setItemError(asText(field(error, 'message')) ?? 'That item did not load. Reload the page to try again.')
      })
    return () => { live = false }
  }, [route.itemId, setLadder])

  // Anything already said in this session, plus the item it was about.
  useEffect(() => {
    let live = true
    get(`/api/session/${encodeURIComponent(sessionId)}`)
      .then((data: unknown) => {
        if (!live) return
        const rows = asList(data)
        if (rows.length === 0) return
        setTurns(rows.map((row, i) => readTurn(row, `h${i}`)))
        const carried = field(data, 'item')
        if (carried && !hashParam('item')) setItem(readItem(carried))
      })
      .catch(() => { /* a session with no history is the ordinary case */ })
    return () => { live = false }
  }, [sessionId, setTurns])

  // Three real suggestions for the empty state, drawn from this course's syllabus.
  useEffect(() => {
    if (!courseId || route.itemId) return
    let live = true
    setPointsError(null)
    get(`/api/syllabus/${encodeURIComponent(courseId)}`)
      .then((data: unknown) => {
        if (!live) return
        const rows = asList(data).map(readPoint).filter(p => p.code && p.title)
        setPoints(rows.slice(0, 3))
        if (rows.length === 0) setPointsError('This course has no syllabus points yet. Type a question instead.')
      })
      .catch(() => {
        if (live) setPointsError('The syllabus did not load, so there are no suggestions. You can still type a question.')
      })
    return () => { live = false }
  }, [courseId, route.itemId])

  // Keep the foot in view while the student has not scrolled away (09-STRM-007).
  useEffect(() => {
    const el = streamRef.current
    if (!el) return
    if (pinned.current) { el.scrollTop = el.scrollHeight; setShowNew(false) }
    else setShowNew(true)
  }, [turns])

  function onScroll() {
    const el = streamRef.current
    if (!el) return
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (pinned.current) setShowNew(false)
  }

  function toFoot() {
    const el = streamRef.current
    if (!el) return
    pinned.current = true
    el.scrollTop = el.scrollHeight
    setShowNew(false)
  }

  function submit(next: Intent) {
    const text = draft
    setDraft('')
    send({ intent: next, text, itemId: item?.id ?? null, mode })
  }

  function climb(toRung: number) {
    send({
      intent: 'learn',
      text: 'More help, please.',
      itemId: item?.id ?? null,
      mode,
      studentRequested: true,
      requestedRung: toRung,
    })
  }

  function openCitation(next: Citation) {
    setCitation(next)
    setPaneOpen(true)
  }

  // Rungs 4 and 5 wait for the student's own go (04-GATE-001/003).
  const maxRung = item ? (ladder.waiting ? Math.min(3, ladder.budget) : ladder.budget) : 0
  const budgetReason = !item
    ? undefined
    : ladder.waiting
      ? 'Rungs 4 and 5 open once you have had a go — a plan or the first line is enough.'
      : ladder.cappedBy

  const placeholder = handback
    || (item ? 'Write your first line, or say what is blocking you' : 'Ask about anything on this course')

  return (
    <div className={`session${paneOpen ? ' session--pane' : ''}`}>
      <div className="session__main">
        <header className="session__head">
          {item
            ? (
              <div className="session__item">
                <div className="session__meta">
                  {item.tariff !== undefined && (
                    <span className="session__tariff mono">{item.tariff} marks</span>
                  )}
                  {item.commandWord && <span className="session__command">{item.commandWord}</span>}
                  {(item.paper || item.syllabusPoint) && (
                    <span className="session__point">
                      {[item.paper, item.syllabusPoint, item.pointTitle].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  {ladder.waiting && <span className="session__gate">Your go first</span>}
                </div>
                <p className="session__stem read">{item.stem}</p>
                {item.stimulus && <p className="session__stimulus read">{item.stimulus}</p>}
              </div>
            )
            : (
              <div className="session__item">
                <h1 className="session__title">Learn</h1>
                <p className="session__lede">
                  {itemError
                    ?? 'Nothing is pinned yet. Start on one of these, or type the question you have.'}
                </p>
                {points.length > 0 && (
                  <ul className="session__suggestions">
                    {points.map(point => (
                      <li key={point.code}>
                        <button
                          type="button"
                          className="session__suggestion"
                          onClick={() => send({
                            intent: 'learn',
                            mode,
                            text: `Teach me ${point.code} ${point.title}.`,
                          })}
                        >
                          <span className="session__suggestion-code mono">{point.code}</span>
                          <span>{point.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {pointsError && <p className="session__lede">{pointsError}</p>}
              </div>
            )}
          <button
            type="button"
            className="session__panebtn"
            aria-expanded={paneOpen}
            aria-controls="session-source"
            onClick={() => setPaneOpen(open => !open)}
          >
            {paneOpen ? 'Hide source' : 'Source'}
          </button>
        </header>

        {!online && (
          <p className="session__notice" role="status">
            You are offline. What you write is kept and sent when the connection is back.
          </p>
        )}
        {degraded && (
          <p className="session__notice" role="status">
            Running on the built-in model — add an API key for full marking.
          </p>
        )}

        <div className="session__stream" ref={streamRef} onScroll={onScroll}>
          <div className="session__lane">
            <div className="session__gutter">
              {item && (
                <LadderControl
                  current={ladder.rung}
                  max={maxRung}
                  budgetReason={budgetReason}
                  busy={streaming}
                  onRequest={climb}
                />
              )}
            </div>
            {/* No live region here: the only announced container is the streaming text inside a Turn. */}
            <div className="session__turns">
              {turns.length === 0 && item && (
                <p className="session__lede">
                  Put down one line — a step, a number, or what is blocking you.
                </p>
              )}
              {turns.map(turn => (
                <TurnCard
                  key={turn.id}
                  role={turn.role}
                  text={turn.text}
                  rung={turn.rung}
                  gateWaiting={turn.gateWaiting}
                  seenSolution={turn.seenSolution}
                  retestLabel={turn.retestLabel}
                  streaming={turn.streaming}
                  status={turn.streaming ? status : null}
                  stopped={turn.stopped}
                  queued={turn.queued}
                  error={turn.error}
                  onRetry={turn.error ? retry : undefined}
                  model={turn.model}
                  cost={turn.cost}
                  ttftMs={turn.ttftMs}
                  showFooter={showFooter}
                  citations={turn.citations}
                  onCitation={openCitation}
                />
              ))}
              {item && (
                <div className="session__more">
                  <button
                    type="button"
                    className="session__morebtn"
                    disabled={streaming || ladder.rung >= maxRung}
                    onClick={() => climb(Math.min(ladder.rung + 1, maxRung))}
                  >
                    More help
                  </button>
                  {ladder.rung >= maxRung && budgetReason && (
                    <span className="session__morereason">{budgetReason}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          {showNew && (
            <button type="button" className="session__new" onClick={toFoot}>
              New below
            </button>
          )}
        </div>

        <Composer
          value={draft}
          onChange={setDraft}
          onSend={submit}
          placeholder={placeholder}
          intent={intent}
          onIntentChange={setIntent}
          mode={mode}
          onModeChange={setMode}
          showIntents={!!item}
          streaming={streaming}
          onStop={stop}
          sendLabel={online ? 'Send' : 'Will send'}
        />
      </div>

      <aside id="session-source" className="session__pane" aria-label="Source" hidden={!paneOpen}>
        <h2 className="session__paneh">Source</h2>
        {citation
          ? (
            <div className="session__source">
              <p className="session__sourcelabel">{citation.label}</p>
              {citation.body
                ? <p className="session__sourcebody read">{citation.body}</p>
                : <p className="session__lede">This citation carried a reference but no passage.</p>}
            </div>
          )
          : item
            ? (
              <div className="session__source">
                <p className="session__sourcelabel">
                  {[item.paper, item.syllabusPoint, item.pointTitle].filter(Boolean).join(' · ')
                    || 'The item under study'}
                </p>
                <p className="session__sourcebody read">{item.stem}</p>
                {item.stimulus && <p className="session__sourcebody read">{item.stimulus}</p>}
              </div>
            )
            : <p className="session__lede">Nothing cited yet. A citation in a turn opens its source here.</p>}
      </aside>
    </div>
  )
}
