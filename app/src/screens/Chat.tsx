import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { get } from '../lib/api'
import { Composer } from '../components/Composer'
import type { Intent } from '../components/Composer'
import { TurnCard } from '../components/TurnCard'
import { Deck } from '../components/Deck'
import { Question } from '../components/Question'
import { readArtefacts } from '../lib/artefacts'
import type { Artefact, QuestionArtefact } from '../lib/artefacts'
import { setSession, useStore } from '../lib/state'
import { newSessionId, readTurn, useSessionStream, useTechnicalFooter } from './Session'
import type { UiTurn } from './Session'
import './Session.css'
import './Chat.css'

/** What a blank thread offers, when the course is known and when it is not. */
const OPENERS = [
  { label: 'Make me flashcards', text: 'Make me flashcards on the topic I am weakest on.' },
  { label: 'Give me a question', text: 'Give me an exam question on the topic I am weakest on.' },
  { label: 'Mark my answer', text: 'I will paste a question and my answer. Mark it like an examiner.' },
  { label: 'Explain something', text: 'Explain the hardest idea on this course in plain words.' },
]

interface ChatProps {
  courseId?: string
  /** The conversation to open; a new one is started when this is absent. */
  conversationId?: string
}

/**
 * The chat, which is the product.
 *
 * Everything a student asks for is made here and stays here: a deck of cards, a
 * question to attempt, the mark on what they wrote. The other screens are where
 * those things live afterwards, not where they happen.
 */
export function Chat({ courseId, conversationId }: ChatProps) {
  const app = useStore()
  const showFooter = useTechnicalFooter()
  const [sessionId] = useState(() => conversationId ?? app.sessionId ?? newSessionId())
  const [draft, setDraft] = useState('')
  const [intent, setIntent] = useState<Intent>('learn')
  const [artefacts, setArtefacts] = useState<Record<string, Artefact[]>>({})
  const [answering, setAnswering] = useState<Answering | null>(null)
  const [resumed, setResumed] = useState(false)
  const [pinnedNew, setPinnedNew] = useState(false)

  const course = courseId ?? app.courseId ?? null

  const keepArtefacts = useCallback((turnId: string, made: Artefact[]) => {
    setArtefacts(previous => ({ ...previous, [turnId]: made }))
    // A question the student asked for is a question they are now on: binding it here
    // is what they meant, and it is what sends the next turn through the gate, the
    // ladder and the mark scheme instead of into open chat.
    const question = made.find((a): a is QuestionArtefact => a.kind === 'question')
    if (question) setAnswering(takeUp(question))
  }, [])

  const {
    turns, setTurns, streaming, status, degraded, online, send, stop, retry,
  } = useSessionStream({
    courseId: course,
    sessionId,
    statusLine: 'Reading your course…',
    onArtefacts: keepArtefacts,
  })

  // One conversation id, kept, so the thread survives a reload and can be reopened
  // from the list beside it.
  useEffect(() => { if (app.sessionId !== sessionId) setSession(sessionId) }, [app.sessionId, sessionId])

  useEffect(() => {
    if (resumed) return
    let live = true
    get<unknown>(`/api/session/${encodeURIComponent(sessionId)}`)
      .then(data => {
        if (!live) return
        const rows = (data as { turns?: unknown[] })?.turns
        if (!Array.isArray(rows) || !rows.length) return
        const restored = rows
          .map((row, i) => readStoredTurn(row, i))
          .filter((t): t is StoredTurn => t !== null)
        setTurns(restored.map(t => t.turn))
        setArtefacts(Object.fromEntries(restored.filter(t => t.artefacts.length).map(t => [t.turn.id, t.artefacts])))
        // A reopened thread is still on whatever question it was on.
        const open = (data as { itemId?: unknown })?.itemId
        const item = asRecord((data as { item?: unknown })?.item)
        if (typeof open === 'string' && open && item) {
          setAnswering({
            id: open,
            stem: typeof item.stem === 'string' ? item.stem : '',
            commandWord: typeof item.commandWord === 'string' ? item.commandWord : null,
            tariff: typeof item.tariff === 'number' ? item.tariff : null,
          })
        }
      })
      .catch(() => { /* nothing stored, or offline: this is a new thread */ })
      .finally(() => { if (live) setResumed(true) })
    return () => { live = false }
  }, [resumed, sessionId, setTurns])

  const streamRef = useRef<HTMLDivElement | null>(null)
  const atBottom = useRef(true)

  useEffect(() => {
    const el = streamRef.current
    if (!el) return
    if (atBottom.current) { el.scrollTop = el.scrollHeight; setPinnedNew(false) }
    else if (turns.length) setPinnedNew(true)
  }, [turns])

  const onScroll = useCallback(() => {
    const el = streamRef.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (atBottom.current) setPinnedNew(false)
  }, [])

  const submit = useCallback((chosen: Intent) => {
    const text = draft.trim()
    if (!text || streaming) return
    setDraft('')
    void send({ intent: chosen, text, itemId: answering?.id ?? null })
  }, [answering, draft, send, streaming])

  const empty = turns.length === 0 && !streaming

  const openers = useMemo(() => OPENERS, [])

  return (
    <div className="chat">
      <div
        className={empty ? 'chat__stream chat__stream--blank' : 'chat__stream'}
        ref={streamRef}
        onScroll={onScroll}
      >
        <div className="chat__column">
          {empty ? (
            <div className="chat__blank">
              <h1 className="chat__blank-title">What are we working on?</h1>
              <p className="chat__blank-lede">
                Ask for anything on your course. What you ask for is made here — cards, a
                question at its real tariff, the mark on what you write.
              </p>
              <div className="chat__openers">
                {openers.map(opener => (
                  <button
                    key={opener.label}
                    type="button"
                    className="chat__opener"
                    onClick={() => { setDraft(opener.text); }}
                  >
                    {opener.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="chat__turns">
              {turns.map(turn => (
                <li key={turn.id} className="chat__turn">
                  <TurnCard
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
                    onRetry={retry}
                    model={showFooter ? turn.model : null}
                    cost={showFooter ? turn.cost : null}
                    ttftMs={showFooter ? turn.ttftMs : null}
                    citations={turn.citations}
                  />
                  {(artefacts[turn.id] || []).map(artefact => {
                    if (artefact.kind === 'flashcards') {
                      return <Deck key={artefact.id} deck={artefact} courseId={course} />
                    }
                    if (artefact.kind === 'question') {
                      return (
                        <Question
                          key={artefact.id}
                          question={artefact}
                          answering={answering?.id === artefact.itemId}
                          onAnswer={() => setAnswering(takeUp(artefact))}
                          onDrop={() => setAnswering(null)}
                        />
                      )
                    }
                    return null
                  })}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {pinnedNew && (
        <button
          type="button"
          className="chat__jump"
          onClick={() => {
            const el = streamRef.current
            if (el) { el.scrollTop = el.scrollHeight; atBottom.current = true; setPinnedNew(false) }
          }}
        >
          New below
        </button>
      )}

      <div className="chat__composer">
        <div className="chat__column">
          {answering && (
            <p className="chat__answering" role="status">
              <span className="chat__answering-label mono">Answering</span>
              <span className="chat__answering-stem">
                {answering.commandWord ? `${answering.commandWord} — ` : ''}
                {answering.stem.replace(/\s+/g, ' ').slice(0, 90)}
                {answering.stem.length > 90 ? '…' : ''}
                {answering.tariff ? ` [${answering.tariff}]` : ''}
              </span>
              <button type="button" className="chat__answering-drop" onClick={() => setAnswering(null)}>
                Put it down
              </button>
            </p>
          )}
          {!online && <p className="chat__offline" role="status">You are offline. The turn will send when you are back.</p>}
          {degraded && <p className="chat__degraded" role="status">Answered by the built-in model — add an API key for full marking.</p>}
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={submit}
            placeholder="Ask, or paste a question and your answer"
            intent={intent}
            onIntentChange={setIntent}
            streaming={streaming}
            onStop={stop}
          />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ restoring */

interface StoredTurn {
  turn: UiTurn
  artefacts: Artefact[]
}

/** The question the composer is answering, as little of it as the strip needs. */
interface Answering {
  id: string
  stem: string
  commandWord: string | null
  tariff: number | null
}

const takeUp = (q: QuestionArtefact): Answering => ({
  id: q.itemId,
  stem: q.stem,
  commandWord: q.commandWord ?? null,
  tariff: q.tariff ?? null,
})

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null

/**
 * One stored turn, with whatever it made still attached to it. The turn itself is
 * read by the same function the live stream uses, so a restored thread and a live one
 * cannot disagree about what a turn is.
 */
function readStoredTurn(raw: unknown, index: number): StoredTurn | null {
  const row = asRecord(raw)
  if (!row) return null
  const turn = readTurn(raw, `restored-${index}`)
  if (!turn.text.trim()) return null
  return { turn, artefacts: readArtefacts(row.artefacts) }
}
