import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import './Composer.css'

/** The three workspace modes. Learn tutors, Practise poses items, Mark marks a pasted answer. */
export type Mode = 'learn' | 'practise' | 'mark'
/** How much help this send is asking for (§04.5), plus the one that asks for none. */
export type Intent = 'learn' | 'check' | 'answer' | 'mark'

const MODES: { id: Mode; label: string }[] = [
  { id: 'learn', label: 'Learn' },
  { id: 'practise', label: 'Practise' },
  { id: 'mark', label: 'Mark' },
]

const INTENTS: { id: Intent; label: string; note: string }[] = [
  { id: 'learn', label: 'Teach me', note: 'One rung of help, then the work comes back to you.' },
  { id: 'check', label: 'Check my steps', note: 'The first step that goes wrong, named and quoted.' },
  {
    id: 'answer',
    label: 'Just the answer',
    note: 'The full answer now. It is labelled as seen and one like it comes back in a few days.',
  },
  {
    id: 'mark',
    label: 'Mark it',
    note: 'Marked against the scheme, with every mark quoted from your own words.',
  },
]

/** A file the student has added to this turn but not sent yet. */
export interface Attachment {
  id: string
  name: string
  chars: number
}

export interface ComposerProps {
  value: string
  onChange(next: string): void
  /** Send the current text. Never called while streaming. */
  onSend(intent: Intent): void
  /** Placeholder: the hand-back the last turn asked for (04-TURN-003). */
  placeholder: string
  intent: Intent
  onIntentChange(next: Intent): void
  /** Omit to render no mode chips at all — Ask has no modes (10.26). */
  mode?: Mode
  onModeChange?(next: Mode): void
  /** Omit on Ask: no gradable item, so no intent row. */
  showIntents?: boolean
  /** Which intents to offer. Omit for the three that ask for help. */
  intents?: Intent[]
  streaming?: boolean
  onStop?(): void
  /** Offline: the send button says what will happen instead. */
  sendLabel?: string
  /** Shown under the row when the composer cannot send yet. */
  hint?: string
  /** What is attached to this turn. Omit the handler and no "+" is drawn. */
  attachments?: Attachment[]
  onAttach?(files: File[]): void
  onRemoveAttachment?(id: string): void
  /** Said under the row when a file could not be read. */
  attachProblem?: string | null
}

const COUNT_FROM = 1200

export function Composer(props: ComposerProps) {
  const {
    value, onChange, onSend, placeholder, intent, onIntentChange,
    mode, onModeChange, showIntents = true, intents, streaming = false, onStop,
    sendLabel = 'Send', hint,
    attachments = [], onAttach, onRemoveAttachment, attachProblem = null,
  } = props

  const ta = useRef<HTMLTextAreaElement | null>(null)
  const picker = useRef<HTMLInputElement | null>(null)
  const modeRefs = useRef<(HTMLButtonElement | null)[]>([])
  const uid = useId()
  const reasonId = `${uid}-reason`
  const noteId = `${uid}-note`
  const countId = `${uid}-count`

  // Grow to the max height set in CSS (eight lines), then scroll.
  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  // The hand-back is behaviour: when a turn finishes the composer takes focus (10-SESN-001),
  // unless the student has moved somewhere else and is working there.
  useEffect(() => {
    if (streaming) return
    const active = document.activeElement
    const idle = !active || active === document.body || active.tagName === 'BUTTON'
    if (idle) ta.current?.focus()
  }, [streaming])

  const offered = intents ? INTENTS.filter(i => intents.includes(i.id)) : INTENTS.filter(i => i.id !== 'mark')
  const activeIntent = offered.find(i => i.id === intent) ?? offered[0] ?? INTENTS[0]
  const empty = value.trim().length === 0
  const blocked = streaming
    ? 'The tutor is answering. Press Stop to write again.'
    : empty
      ? 'Write something — one line is enough.'
      : hint
  const canSend = !streaming && !empty

  function keyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSend(intent)
    }
  }

  function modeKeys(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = MODES.length - 1
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = index === last ? 0 : index + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = index === 0 ? last : index - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    else return
    e.preventDefault()
    onModeChange?.(MODES[next].id)
    modeRefs.current[next]?.focus()
  }

  return (
    <form
      className="composer"
      onSubmit={e => { e.preventDefault(); if (canSend) onSend(intent) }}
    >
      {mode && onModeChange && (
        <div className="composer__modes" role="radiogroup" aria-label="Mode">
          {MODES.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={m.id === mode}
              tabIndex={m.id === mode ? 0 : -1}
              ref={el => { modeRefs.current[i] = el }}
              className="composer__chip composer__chip--mode"
              onClick={() => onModeChange(m.id)}
              onKeyDown={e => modeKeys(e, i)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="composer__box">
        {attachments.length > 0 && (
          <ul className="composer__attached" aria-label="Added to this message">
            {attachments.map(file => (
              <li key={file.id} className="composer__attachment">
                <span className="composer__attachment-name">{file.name}</span>
                <span className="composer__attachment-size mono">
                  {file.chars.toLocaleString('en-GB')}
                </span>
                {onRemoveAttachment && (
                  <button
                    type="button"
                    className="composer__attachment-drop"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => onRemoveAttachment(file.id)}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <label className="sr" htmlFor={`${uid}-input`}>Your message</label>
        <textarea
          id={`${uid}-input`}
          ref={ta}
          className="composer__input read"
          rows={1}
          value={value}
          disabled={streaming}
          placeholder={placeholder}
          aria-describedby={[blocked ? reasonId : '', value.length > COUNT_FROM ? countId : '']
            .filter(Boolean).join(' ') || undefined}
          onChange={e => onChange(e.target.value)}
          onKeyDown={keyDown}
        />
        <div className="composer__actions">
          {onAttach && (
            <>
              <input
                ref={picker}
                id={`${uid}-files`}
                className="sr"
                type="file"
                multiple
                accept=".txt,.md,.markdown,.csv,.json,text/plain,text/markdown,text/csv"
                onChange={e => {
                  const files = Array.from(e.target.files || [])
                  if (files.length) onAttach(files)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className="composer__attach"
                aria-label="Add your own material to this message"
                title="Add your notes, a question, a page of a book"
                disabled={streaming}
                onClick={() => picker.current?.click()}
              >
                +
              </button>
            </>
          )}
          {value.length > COUNT_FROM && (
            <span className="composer__count mono" id={countId}>
              {value.length.toLocaleString('en-GB')} characters
            </span>
          )}
          {streaming
            ? (
              <button type="button" className="composer__send" onClick={() => onStop?.()}>
                Stop
              </button>
            )
            : (
              <button type="submit" className="composer__send" disabled={!canSend}>
                {sendLabel}
              </button>
            )}
        </div>
      </div>

      {attachProblem && <p className="composer__attach-problem" role="alert">{attachProblem}</p>}
      {blocked && <p className="composer__reason" id={reasonId}>{blocked}</p>}

      {showIntents && (
        <>
          <div className="composer__intents" role="group" aria-label="How much help">
            {offered.map(i => (
              <button
                key={i.id}
                type="button"
                aria-pressed={i.id === intent}
                aria-describedby={i.id === intent ? noteId : undefined}
                className="composer__chip composer__chip--intent"
                onClick={() => onIntentChange(i.id)}
              >
                {i.label}
              </button>
            ))}
          </div>
          <p className="composer__note" id={noteId}>{activeIntent.note}</p>
        </>
      )}
    </form>
  )
}
