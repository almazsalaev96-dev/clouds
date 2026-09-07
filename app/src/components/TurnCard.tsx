import type { ReactNode } from 'react'
import './TurnCard.css'

export interface Citation {
  id: string
  label: string
  /** The passage itself, where the turn carried it. */
  body?: string
}

export interface TurnCardProps {
  role: 'user' | 'assistant'
  text: string
  /** Help-ladder rung this turn was written at (1–5). */
  rung?: number | null
  /** The effort gate had not been satisfied when this turn was written: it asks for a go first. */
  gateWaiting?: boolean
  seenSolution?: boolean
  /** "Seen solution · retest Thursday" — the weekday when the server named one. */
  retestLabel?: string
  /** This turn is still arriving. */
  streaming?: boolean
  /** Route status while nothing has arrived yet ("Reading the 9609 P2 mark scheme…"). */
  status?: string | null
  stopped?: boolean
  queued?: boolean
  error?: string | null
  onRetry?(): void
  model?: string | null
  cost?: number | null
  ttftMs?: number | null
  /** Settings › technical footer. Off by default. */
  showFooter?: boolean
  citations?: Citation[]
  onCitation?(citation: Citation): void
}

const RUNG_NAMES = [
  'Metacognitive prompt',
  'Conceptual pointer',
  'The next step',
  'Worked step with a blank',
  'Full solution and one like it',
]

/* ------------------------------------------------------------------ *
 * A small markdown renderer. Bold, italic, inline code, fenced code,
 * ordered and unordered lists, paragraphs. Nothing else, no package.
 * ------------------------------------------------------------------ */

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[]; start: number }
  | { kind: 'code'; text: string; lang: string; open: boolean }

const FENCE = /^\s*```(.*)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBER = /^\s*(\d+)[.)]\s+(.*)$/

export function parseBlocks(src: string): Block[] {
  const lines = src.split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = FENCE.exec(line)
    if (fence) {
      const lang = fence[1].trim()
      const body: string[] = []
      i++
      let closed = false
      while (i < lines.length) {
        if (FENCE.test(lines[i])) { closed = true; i++; break }
        body.push(lines[i]); i++
      }
      blocks.push({ kind: 'code', text: body.join('\n'), lang, open: !closed })
      continue
    }
    if (BULLET.test(line)) {
      const items: string[] = []
      while (i < lines.length) {
        const m = BULLET.exec(lines[i])
        if (!m) break
        items.push(m[1]); i++
      }
      blocks.push({ kind: 'ul', items })
      continue
    }
    const first = NUMBER.exec(line)
    if (first) {
      const items: string[] = []
      const start = Number(first[1])
      while (i < lines.length) {
        const m = NUMBER.exec(lines[i])
        if (!m) break
        items.push(m[2]); i++
      }
      blocks.push({ kind: 'ol', items, start: Number.isFinite(start) ? start : 1 })
      continue
    }
    if (line.trim() === '') { i++; continue }
    const para: string[] = []
    while (i < lines.length) {
      const l = lines[i]
      if (l.trim() === '' || FENCE.test(l) || BULLET.test(l) || NUMBER.test(l)) break
      para.push(l.trim()); i++
    }
    blocks.push({ kind: 'p', text: para.join(' ') })
  }
  return blocks
}

const INLINE_SOURCE = '`([^`]+)`|\\*\\*([\\s\\S]+?)\\*\\*|__([\\s\\S]+?)__|\\*([^*\\n]+)\\*|_([^_\\n]+)_'

/**
 * Bold, italic and inline code as React elements. It recurses into emphasis, so the
 * matcher is built per call: one shared regex would have its lastIndex trampled by
 * the inner call and the outer loop would never end.
 */
export function renderInline(text: string, key: string): ReactNode[] {
  const matcher = new RegExp(INLINE_SOURCE, 'g')
  const out: ReactNode[] = []
  let last = 0
  let n = 0
  let m: RegExpExecArray | null
  while ((m = matcher.exec(text)) !== null) {
    if (m[0].length === 0) { matcher.lastIndex++; continue }
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = `${key}i${n++}`
    if (m[1] !== undefined) out.push(<code className="mono" key={k}>{m[1]}</code>)
    else if (m[2] !== undefined) out.push(<strong key={k}>{renderInline(m[2], k)}</strong>)
    else if (m[3] !== undefined) out.push(<strong key={k}>{renderInline(m[3], k)}</strong>)
    else if (m[4] !== undefined) out.push(<em key={k}>{renderInline(m[4], k)}</em>)
    else if (m[5] !== undefined) out.push(<em key={k}>{renderInline(m[5], k)}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** While a turn streams, an opened-but-unclosed marker is dropped rather than shown raw (09-STRM-006). */
export function hideOpenMarkers(text: string): string {
  let out = text
  for (const marker of ['`', '**', '__']) {
    if ((out.split(marker).length - 1) % 2 === 1) {
      const at = out.lastIndexOf(marker)
      out = out.slice(0, at) + out.slice(at + marker.length)
    }
  }
  for (const marker of ['*', '_']) {
    let count = 0
    for (const ch of out) if (ch === marker) count++
    if (count % 2 === 1) {
      const at = out.lastIndexOf(marker)
      out = out.slice(0, at) + out.slice(at + marker.length)
    }
  }
  return out
}

function renderBlocks(blocks: Block[], key: string, live: boolean): ReactNode[] {
  const clean = (s: string) => (live ? hideOpenMarkers(s) : s)
  return blocks.map((b, i) => {
    const k = `${key}b${i}`
    if (b.kind === 'code') {
      return (
        <pre className="turn-card__code mono" key={k} data-lang={b.lang || undefined}>
          <code>{b.text}</code>
        </pre>
      )
    }
    if (b.kind === 'ul') {
      return (
        <ul className="turn-card__list" key={k}>
          {b.items.map((it, j) => <li key={`${k}l${j}`}>{renderInline(clean(it), `${k}l${j}`)}</li>)}
        </ul>
      )
    }
    if (b.kind === 'ol') {
      return (
        <ol className="turn-card__list" key={k} start={b.start}>
          {b.items.map((it, j) => <li key={`${k}l${j}`}>{renderInline(clean(it), `${k}l${j}`)}</li>)}
        </ol>
      )
    }
    return <p className="turn-card__p" key={k}>{renderInline(clean(b.text), k)}</p>
  })
}

/** Split on the last committed block boundary so painted text is never re-laid out (09-STRM-005). */
function split(text: string, streaming: boolean): [string, string] {
  if (!streaming) return [text, '']
  const at = text.lastIndexOf('\n\n')
  if (at === -1) return ['', text]
  return [text.slice(0, at), text.slice(at + 2)]
}

export function TurnCard(props: TurnCardProps) {
  const {
    role, text, rung, gateWaiting, seenSolution, retestLabel, streaming = false, status,
    stopped, queued, error, onRetry, model, cost, ttftMs, showFooter = false,
    citations, onCitation,
  } = props

  const assistant = role === 'assistant'
  const ruled = assistant && typeof rung === 'number' && rung > 1
  const [committed, tail] = split(text, streaming)
  const nothingYet = streaming && text.length === 0

  return (
    <article
      className={`turn-card turn-card--${role}${ruled ? ' turn-card--ruled' : ''}`}
      aria-label={assistant ? 'Tutor turn' : 'Your message'}
    >
      {(gateWaiting || (typeof rung === 'number' && rung > 0) || seenSolution || queued || stopped) && (
        <div className="turn-card__badges">
          {gateWaiting && <span className="turn-card__badge turn-card__badge--gate">Your go first</span>}
          {typeof rung === 'number' && rung > 0 && (
            <span className="turn-card__badge">
              Rung {rung} of 5 · {RUNG_NAMES[Math.min(Math.max(rung, 1), 5) - 1]}
            </span>
          )}
          {seenSolution && (
            <span className="turn-card__badge turn-card__badge--seen">
              {retestLabel ? `Seen solution · retest ${retestLabel}` : 'Seen solution · retest scheduled'}
            </span>
          )}
          {queued && <span className="turn-card__badge">Queued — sends when you are back online</span>}
          {stopped && <span className="turn-card__badge">Stopped</span>}
        </div>
      )}

      {committed.length > 0 && (
        <div className={`turn-card__body${assistant ? '' : ' read'}`}>
          {renderBlocks(parseBlocks(committed), 'c', false)}
        </div>
      )}

      {/* The streaming region holds the arriving text and nothing else. */}
      <div className="turn-card__stream" aria-live="polite" aria-relevant="additions text">
        {tail.length > 0 && renderBlocks(parseBlocks(tail), 't', true)}
      </div>

      {nothingYet && (
        status
          ? <p className="turn-card__status">{status}</p>
          : <p className="turn-card__status turn-card__status--dots" aria-label="Writing">···</p>
      )}

      {error && (
        <div className="turn-card__error" role="alert">
          <p className="turn-card__errorline">{error}</p>
          {onRetry && (
            <button type="button" className="turn-card__retry" onClick={onRetry}>
              Send it again
            </button>
          )}
        </div>
      )}

      {citations && citations.length > 0 && (
        <ul className="turn-card__cites">
          {citations.map(c => (
            <li key={c.id}>
              <button type="button" className="turn-card__cite" onClick={() => onCitation?.(c)}>
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showFooter && assistant && (model || cost != null || ttftMs != null) && (
        <p className="turn-card__foot mono">
          {model ?? 'model unrecorded'}
          {cost != null && <> · ${cost.toFixed(3)}</>}
          {ttftMs != null && <> · first token {Math.round(ttftMs)} ms</>}
        </p>
      )}
    </article>
  )
}
