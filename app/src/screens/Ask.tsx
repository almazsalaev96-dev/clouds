import { useEffect, useRef, useState } from 'react'
import { get } from '../lib/api'
import { Composer } from '../components/Composer'
import type { Intent } from '../components/Composer'
import { TurnCard } from '../components/TurnCard'
import { newSessionId, useSessionStream, useTechnicalFooter } from './Session'
import './Session.css'

/** §15.E `ask.scope` — permanent, never dismissible (10-ASKS-004). */
const SCOPE = 'Ask — general help. Not marked, not grounded in a syllabus, and not counted as study.'

const GENERIC = [
  'What does the command word "evaluate" want?',
  'Explain opportunity cost in two sentences.',
  'Check my working on this and say where it first goes wrong.',
]

function courseTitles(data: unknown): string[] {
  const rows = Array.isArray(data) ? data : []
  const out: string[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, unknown>
    const title = record.title ?? record.syllabus ?? record.name
    if (typeof title === 'string' && title) out.push(title)
  }
  return out
}

export function Ask() {
  const showFooter = useTechnicalFooter()
  const [sessionId] = useState(() => newSessionId('ask'))
  const [draft, setDraft] = useState('')
  const [intent, setIntent] = useState<Intent>('learn')
  const [examples, setExamples] = useState<string[]>(GENERIC)
  const [showNew, setShowNew] = useState(false)

  const {
    turns, streaming, status, degraded, online, send, stop, retry,
  } = useSessionStream({ courseId: null, sessionId, statusLine: 'Working on it…' })

  const streamRef = useRef<HTMLDivElement | null>(null)
  const pinned = useRef(true)

  // Examples come from the student's own courses where they have any.
  useEffect(() => {
    let live = true
    get('/api/courses')
      .then((data: unknown) => {
        if (!live) return
        const titles = courseTitles(data).slice(0, 2)
        if (titles.length === 0) return
        setExamples([
          ...titles.map(t => `Explain the hardest idea in ${t} in plain words.`),
          GENERIC[0],
        ])
      })
      .catch(() => { /* the generic examples already stand */ })
    return () => { live = false }
  }, [])

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

  function submit(next: Intent) {
    const text = draft
    setDraft('')
    send({ intent: next, text, itemId: null })
  }

  return (
    <div className="ask">
      <header className="ask__head">
        <h1 className="ask__title">Ask</h1>
      </header>
      {/* Said once, plainly, and it stays said. */}
      <p className="ask__scope">{SCOPE}</p>

      <div className="ask__stream" ref={streamRef} onScroll={onScroll}>
        <div className="ask__lane">
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
          {turns.length === 0 && (
            <>
              <p className="session__lede">No course, no gate, no marks. Ask the question you have now.</p>
              <ul className="ask__examples">
                {examples.map(text => (
                  <li key={text}>
                    <button
                      type="button"
                      className="ask__example"
                      onClick={() => send({ intent: 'learn', text, itemId: null })}
                    >
                      {text}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {turns.map(turn => (
            <TurnCard
              key={turn.id}
              role={turn.role}
              text={turn.text}
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
            />
          ))}
        </div>
        {showNew && (
          <button type="button" className="session__new" onClick={() => {
            const el = streamRef.current
            if (!el) return
            pinned.current = true
            el.scrollTop = el.scrollHeight
            setShowNew(false)
          }}>
            New below
          </button>
        )}
      </div>

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={submit}
        placeholder="Ask anything"
        intent={intent}
        onIntentChange={setIntent}
        showIntents={false}
        streaming={streaming}
        onStop={stop}
        sendLabel={online ? 'Send' : 'Will send'}
      />
    </div>
  )
}
