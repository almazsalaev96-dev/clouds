import { useCallback, useEffect, useRef, useState } from 'react'
import { TariffPill } from '../components/TariffPill'
import { MarkView } from './MarkView'
import type { ItemView, MarkPayload } from './MarkView'
import { ApiError, get, post, unwrapList } from '../lib/api'
import type { Course } from '../lib/api'
import './Practise.css'

/** GET /api/practise/next: the item, and the engine's reason for choosing it. */
interface NextResponse {
  courseId: string
  item: ItemView | null
  point?: { code?: string; title?: string; paper?: string } | null
  reason?: string
  entryRung?: number
}

interface AttemptResponse {
  id: string
  unaided?: boolean
}

export interface PractiseProps {
  /** Course to practise. With none given, the first course on the account is used. */
  courseId?: string
  /** Called when a mark commits, for whatever owns the route. */
  onMarked?: (markId: string, courseId: string) => void
}

/* ------------------------------------------------------------ the effort gate */

const COMMAND_NEED: Record<string, string> = {
  evaluate: 'a judgement, with a reason attached to it',
  discuss: 'one point on each side, and where you land',
  analyse: 'a cause and the consequence it leads to, linked',
  explain: 'a reason, not only a statement',
  justify: 'a choice and the ground you choose it on',
  assess: 'one factor weighed against another',
  recommend: 'one option chosen, and why that one',
  calculate: 'your working, even one line of it',
  define: 'one sentence in your own words',
  state: 'one sentence in your own words',
  describe: 'what happens, in order',
  identify: 'the term itself',
  outline: 'the two or three steps, in order',
}

const TOKEN_ANSWER = /^(idk|dunno|dk|no idea|i don'?t know|nothing|none|n\/?a|\?+|\.+|-+|x+|test|asdf)$/i

const flatten = (value: string): string => value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * The gate in this screen: an empty or near-empty answer is not marked, and the
 * screen says what is missing instead. It never refuses and never lectures — what
 * counts as an attempt is small, and it is named.
 */
export function gateMessage(answer: string, item: Pick<ItemView, 'commandWord' | 'stem'>): string | null {
  const body = answer.trim()
  const command = (item.commandWord || '').trim()
  const need = COMMAND_NEED[command.toLowerCase()] || 'a first line in your own words'
  const deal = `${command || 'This question'} wants ${need}. Two bullets of a plan count as an attempt.`

  if (!body) return `There is nothing here to mark yet. ${deal}`
  if (TOKEN_ANSWER.test(body)) {
    return `"${body}" gives the marker nothing to read. Put down the one thing you do know about this topic — that counts. ${deal}`
  }
  const words = body.split(/\s+/).filter(Boolean)
  if (words.length < 4) return `Four words is not yet an answer. ${deal}`
  if (new Set(words.map((word) => word.toLowerCase())).size < 3) {
    return `One word repeated is not something the marker can read. ${deal}`
  }
  const stem = flatten(item.stem || '')
  if (stem && flatten(body) && stem.includes(flatten(body))) return `That is the question copied back. ${deal}`
  return null
}

/* ------------------------------------------------------------------ the rest */

function confidenceWords(value: number): string {
  if (value <= 20) return 'Guessing'
  if (value <= 45) return 'Not sure'
  if (value <= 70) return 'Think so'
  if (value <= 90) return 'Fairly sure'
  return 'Sure'
}

function clock(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/** A 2-mark answer does not get an essay box. */
function rowsForTariff(tariff: number): number {
  if (tariff <= 2) return 3
  if (tariff <= 4) return 6
  if (tariff <= 8) return 11
  if (tariff <= 12) return 16
  return 20
}

const SKIP_REASONS: Array<[string, string]> = [
  ['too_hard', 'Too hard right now'],
  ['seen_it', 'I have seen this one'],
  ['no_time', 'No time for it'],
  ['other', 'Something else'],
]

const FLAG_REASONS: Array<[string, string]> = [
  ['unclear', 'The question is unclear'],
  ['scheme', 'The marking looks wrong'],
  ['broken', 'Something is broken'],
  ['other', 'Something else'],
]

const NOTES_KEY = 'margin.practise.notes'

interface RunNote { itemId: string; kind: 'skip' | 'flag'; reason: string; at: string }

function readNotes(): RunNote[] {
  try {
    const raw = window.localStorage.getItem(NOTES_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as RunNote[]) : []
  } catch {
    return []
  }
}

function writeNote(note: RunNote): boolean {
  try {
    window.localStorage.setItem(NOTES_KEY, JSON.stringify([...readNotes(), note].slice(-200)))
    return true
  } catch {
    return false
  }
}

/* --------------------------------------------------------------- the screen */

export function Practise({ courseId, onMarked }: PractiseProps) {
  const [course, setCourse] = useState<string | null>(courseId ?? null)
  const [item, setItem] = useState<ItemView | null>(null)
  const [why, setWhy] = useState<string | null>(null)
  const [entryRung, setEntryRung] = useState(0)
  const [emptyRun, setEmptyRun] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [answer, setAnswer] = useState('')
  const [confidence, setConfidence] = useState(50)
  const [confidenceTouched, setConfidenceTouched] = useState(false)
  const [gate, setGate] = useState<string | null>(null)

  const [seconds, setSeconds] = useState(0)
  const [timerShown, setTimerShown] = useState(true)

  const [phase, setPhase] = useState<'loading' | 'answering' | 'marking' | 'marked'>('loading')
  const [payload, setPayload] = useState<MarkPayload | null>(null)
  const [stage, setStage] = useState<string>('')
  const [markError, setMarkError] = useState<string | null>(null)
  const [markSeconds, setMarkSeconds] = useState(0)

  const [skipOpen, setSkipOpen] = useState(false)
  const [flagOpen, setFlagOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const answerRef = useRef<HTMLTextAreaElement | null>(null)
  const submitted = useRef('')
  const seen = useRef<string[]>([])

  const loadItem = useCallback(async () => {
    setPhase('loading')
    setLoadError(null)
    setEmptyRun(null)
    setPayload(null)
    setMarkError(null)
    setGate(null)
    setAnswer('')
    setConfidence(50)
    setConfidenceTouched(false)
    setSeconds(0)
    setNote(null)
    try {
      let id = course
      if (!id) {
        const courses = unwrapList<Course>(await get<unknown>('/api/courses'), 'courses')
        id = courses[0]?.id ?? null
        setCourse(id)
      }
      if (!id) throw new ApiError(404, 'No course yet. Create one, then come back to practise.')
      const skipped = readNotes().filter((entry) => entry.kind === 'skip').map((entry) => entry.itemId)
      const exclude = [...new Set([...seen.current, ...skipped])].slice(-25)
      const query = `courseId=${encodeURIComponent(id)}${exclude.length ? `&exclude=${encodeURIComponent(exclude.join(','))}` : ''}`
      const next = await get<NextResponse>(`/api/practise/next?${query}`)
      if (!next.item) {
        setEmptyRun(next.reason || 'Nothing left to practise on this course today.')
        setItem(null)
        setPhase('answering')
        return
      }
      setItem(next.item)
      setWhy(next.reason ?? null)
      setEntryRung(typeof next.entryRung === 'number' ? next.entryRung : 0)
      setPhase('answering')
    } catch (failure) {
      setLoadError(failure instanceof ApiError ? failure.message : 'The item did not load. Try again.')
      setPhase('answering')
    }
  }, [course])

  useEffect(() => { void loadItem() }, [loadItem])

  useEffect(() => {
    if (phase !== 'answering' || !item) return
    const tick = window.setInterval(() => setSeconds((was) => was + 1), 1000)
    return () => window.clearInterval(tick)
  }, [phase, item])

  useEffect(() => {
    if (phase !== 'marking') return
    const tick = window.setInterval(() => setMarkSeconds((was) => was + 1), 1000)
    return () => window.clearInterval(tick)
  }, [phase])

  const submit = useCallback(async () => {
    if (!item || !course) return
    const failure = gateMessage(answer, item)
    if (failure) {
      setGate(failure)
      answerRef.current?.focus()
      return
    }
    setGate(null)
    submitted.current = answer
    setMarkError(null)
    setMarkSeconds(0)
    setPhase('marking')
    setStage('Recording your attempt')

    try {
      const attempt = await post<AttemptResponse>('/api/practise/attempt', {
        courseId: course,
        itemId: item.id,
        body: answer,
        mode: 'practise',
        entryRung,
        maxRung: entryRung,
        confidence,
        seconds,
      })
      setStage(`Marking against the ${item.paper ? `${item.paper} ` : ''}mark scheme`)
      const mark = await post<MarkPayload>('/api/mark', { attemptId: attempt.id })
      setPayload(mark)
      setPhase('marked')
      setStage('')
      if (!seen.current.includes(item.id)) seen.current.push(item.id)
      if (typeof mark.id === 'string' && onMarked) onMarked(mark.id, course)
    } catch (thrown) {
      setMarkError(
        thrown instanceof ApiError
          ? thrown.message
          : 'The marker did not answer. Your answer is on this page — send it again when you are ready.',
      )
      setPhase('marked')
      setStage('')
    }
  }, [answer, confidence, course, entryRung, item, onMarked, seconds])

  const skip = (reason: string) => {
    if (!item) return
    setSkipOpen(false)
    const kept = writeNote({ itemId: item.id, kind: 'skip', reason, at: new Date().toISOString() })
    if (!seen.current.includes(item.id)) seen.current.push(item.id)
    setNote(kept
      ? 'Skipped, with the reason kept. It comes back in a later run.'
      : 'Skipped. This browser is not storing the reason, so it may come back sooner.')
    void loadItem()
  }

  const flag = (reason: string) => {
    if (!item) return
    setFlagOpen(false)
    const kept = writeNote({ itemId: item.id, kind: 'flag', reason, at: new Date().toISOString() })
    setNote(kept
      ? 'Flagged, with the reason kept. The question stays on screen.'
      : 'Flagged for this session only — this browser is not storing it.')
  }

  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0

  if (phase === 'loading') {
    return (
      <div className="practise practise--loading" aria-busy="true">
        <div className="practise__skeleton practise__skeleton--head" />
        <div className="practise__skeleton practise__skeleton--stem" />
        <div className="practise__skeleton practise__skeleton--box" />
        <p className="practise__status">Choosing the question that is worth the most marks to you now.</p>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="practise">
        <div className="practise__error" role="status">
          <p className="practise__error-line">{emptyRun || loadError || 'No item came back.'}</p>
          <button type="button" className="practise__secondary" onClick={() => void loadItem()}>Look again</button>
        </div>
      </div>
    )
  }

  return (
    <div className="practise">
      <header className="practise__head">
        <div className="practise__ident">
          <TariffPill tariff={item.maxMarks ?? item.tariff} commandWord={item.commandWord ?? null} />
          {item.pointTitle || item.syllabusPoint ? (
            <span className="practise__point">{item.pointTitle || item.syllabusPoint}</span>
          ) : null}
          {item.paper ? <span className="practise__provenance mono">{item.paper}</span> : null}
        </div>
        {why ? <p className="practise__why">{why}</p> : null}
        {!item.markable ? (
          <p className="practise__note">This one has no mark scheme in the pack, so it comes back as evidence without a number.</p>
        ) : null}
      </header>

      {loadError ? <p className="practise__note" role="status">{loadError}</p> : null}

      {item.stimulus ? (
        <details className="practise__stimulus" open>
          <summary className="practise__stimulus-summary">The case material</summary>
          <div className="practise__stimulus-body read">{item.stimulus}</div>
        </details>
      ) : null}

      <h1 className="practise__stem read">{item.stem}</h1>

      {phase === 'answering' ? (
        <>
          <div className="practise__answer">
            <label className="practise__label" htmlFor="practise-answer">Your answer</label>
            <textarea
              id="practise-answer"
              ref={answerRef}
              className="practise__textarea read"
              rows={rowsForTariff(item.maxMarks ?? item.tariff)}
              value={answer}
              spellCheck
              onChange={(event) => { setAnswer(event.target.value); if (gate) setGate(null) }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void submit() }
              }}
            />
            <div className="practise__meta">
              <span className="practise__count mono" aria-hidden="true">{words}</span>
              {timerShown ? (
                <span className="practise__timer mono">
                  {clock(seconds)}
                  {item.expectedMinutes ? <span className="practise__timer-guide"> of about {item.expectedMinutes} min</span> : null}
                </span>
              ) : null}
              <button type="button" className="practise__link" onClick={() => setTimerShown((was) => !was)}>
                {timerShown ? 'Hide the timer' : 'Show the timer'}
              </button>
            </div>
          </div>

          {gate ? (
            <p className="practise__gate" role="alert">{gate}</p>
          ) : (
            <p className="practise__gate-quiet">Your go first. The mark scheme opens once you have written something.</p>
          )}

          <div className="practise__confidence">
            <label className="practise__label" htmlFor="practise-confidence">How sure are you of this answer?</label>
            <div className="practise__slider-row">
              <input
                id="practise-confidence"
                className="practise__slider"
                type="range"
                min={0}
                max={100}
                step={5}
                value={confidence}
                aria-valuetext={`${confidenceWords(confidence)}, ${confidence} out of 100`}
                onChange={(event) => { setConfidence(Number(event.target.value)); setConfidenceTouched(true) }}
              />
              <span className="practise__confidence-word">
                {confidenceTouched ? confidenceWords(confidence) : 'Not rated'}
                {confidenceTouched ? <span className="practise__confidence-number mono"> {confidence}/100</span> : null}
              </span>
            </div>
            <p className="practise__confidence-note">
              Recorded before the mark, so how sure you were can be read against how it went. It never changes the mark.
            </p>
          </div>

          <div className="practise__actions">
            <button type="button" className="practise__submit" onClick={() => void submit()}>Mark this answer</button>
            <button
              type="button"
              className="practise__secondary"
              aria-expanded={skipOpen}
              onClick={() => { setSkipOpen((was) => !was); setFlagOpen(false) }}
            >
              Skip
            </button>
            <button
              type="button"
              className="practise__secondary"
              aria-expanded={flagOpen}
              onClick={() => { setFlagOpen((was) => !was); setSkipOpen(false) }}
            >
              Flag
            </button>
          </div>

          {skipOpen ? (
            <div className="practise__reasons">
              <p className="practise__label">Why are you skipping it? It comes back either way.</p>
              {SKIP_REASONS.map(([value, label]) => (
                <button type="button" key={value} className="practise__chip" onClick={() => skip(value)}>{label}</button>
              ))}
            </div>
          ) : null}

          {flagOpen ? (
            <div className="practise__reasons">
              <p className="practise__label">What is wrong with it?</p>
              {FLAG_REASONS.map(([value, label]) => (
                <button type="button" key={value} className="practise__chip" onClick={() => flag(value)}>{label}</button>
              ))}
            </div>
          ) : null}

          {note ? <p className="practise__note" role="status">{note}</p> : null}
        </>
      ) : (
        <>
          <section className="practise__submitted">
            <h2 className="practise__label">What you submitted</h2>
            <p className="practise__submitted-meta mono">
              {clock(seconds)} · {confidenceTouched ? `${confidenceWords(confidence)} (${confidence}/100)` : 'confidence not rated'}
            </p>
          </section>

          <MarkView
            mark={payload ?? { item }}
            answer={submitted.current}
            status={phase === 'marking' ? 'streaming' : markError ? 'error' : 'ready'}
            statusLine={phase === 'marking' ? `${stage} · ${markSeconds}s` : null}
            error={markError}
            onRetry={() => void submit()}
            compact
          />

          {phase === 'marked' ? (
            <div className="practise__actions practise__actions--after">
              <button type="button" className="practise__secondary" onClick={() => void loadItem()}>Next item</button>
              <button
                type="button"
                className="practise__link"
                onClick={() => { setPhase('answering'); setPayload(null); setMarkError(null) }}
              >
                Back to my answer
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default Practise
