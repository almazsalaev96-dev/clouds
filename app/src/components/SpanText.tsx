import type { Span } from '../lib/api'
import './SpanText.css'

/** How a stretch of the student's writing was treated by the marker. */
export type SpanClass = 'credited' | 'partial' | 'uncredited'

/** A span as the Mark object carries it (§05.2): a verbatim quote plus its offsets. */
export type MarkSpan = Span

/** One segment of the answer as it is drawn: either plain text or a marked span. */
export interface SpanRun {
  id: string
  text: string
  kind: SpanClass | 'plain'
  ao: string | null
  point: string | null
  reason: string | null
  lineRef: string | null
}

const KIND_WORD: Record<SpanClass, string> = {
  credited: 'Credited',
  partial: 'Partly credited',
  uncredited: 'Not credited',
}

const KIND_GLYPH: Record<SpanClass, string> = { credited: '✓', partial: '·', uncredited: '×' }

/** Reason codes from 05-MARK-003, said in words a student can act on. */
const REASON_TEXT: Record<string, string> = {
  SINGLE_LINK: 'one link in the chain, where the band asks for two',
  ASSERTION_NO_LINK: 'asserted, with no link to a consequence',
  GENERIC_NOT_CONTEXT: 'true of any business — it fails the cover-the-name test',
  DATA_NOT_USED: 'the figures in the stimulus are not used here',
  EVAL_IN_ANALYSE: 'judgement offered where analysis was asked for',
  TERM_REPEATED_IN_DEFINITION: 'the term is repeated inside its own definition',
  WRONG_STAKEHOLDER: 'the wrong stakeholder for this question',
  NO_WORKING: 'no working shown for the value',
  UNITS_MISSING: 'units missing',
  SIG_FIG: 'significant figures not as the scheme requires',
  CONTRADICTION: 'contradicts an earlier statement',
  ILLEGIBLE: 'could not be read',
  OUT_OF_SCOPE: 'outside what this grid can credit',
  ATOM_NOT_MET: 'one required part of the marking point is missing',
  NOT_IN_INDICATIVE_VALID_ALT: 'a valid alternative outside the indicative content — credited, and flagged for your teacher',
  DUPLICATE_POINT: 'the same point already credited',
}

/** Stable id shared by the span in the answer and the quote row in its AO card. */
export function spanId(ao: string, kind: SpanClass, index: number): string {
  return `${ao}-${kind}-${index}`
}

export function reasonSentence(span: MarkSpan): string | null {
  if (span.reason) return span.reason
  if (span.reason_code && REASON_TEXT[span.reason_code]) return REASON_TEXT[span.reason_code]
  if (span.reason_code) return span.reason_code.toLowerCase().replace(/_/g, ' ')
  if (typeof span.links_counted === 'number') {
    return `${span.links_counted} ${span.links_counted === 1 ? 'link' : 'links'} counted in the chain`
  }
  return null
}

export interface SpanSource {
  ao: string
  kind: SpanClass
  spans: MarkSpan[]
}

interface Placed {
  start: number
  end: number
  run: Omit<SpanRun, 'text'>
}

/**
 * Cut the answer into runs. A quote that is not a verbatim substring at its offsets
 * is dropped rather than drawn somewhere plausible (05-MARK-001): a highlight over
 * words the student did not write is worse than no highlight.
 */
export function buildRuns(text: string, sources: SpanSource[]): SpanRun[] {
  const placed: Placed[] = []
  const order: Record<SpanClass, number> = { credited: 0, partial: 1, uncredited: 2 }

  for (const source of sources) {
    source.spans.forEach((span, index) => {
      const quote = (span.quote || '').trim()
      if (!quote) return
      let start = typeof span.char_start === 'number' ? span.char_start : -1
      const end = typeof span.char_end === 'number' ? span.char_end : -1
      const atOffsets = start >= 0 && end > start && text.slice(start, end).trim() === quote
      if (!atOffsets) start = text.indexOf(quote)
      if (start < 0) return
      const stop = atOffsets ? end : start + quote.length
      placed.push({
        start,
        end: stop,
        run: {
          id: spanId(source.ao, source.kind, index),
          kind: source.kind,
          ao: source.ao,
          point: span.marking_point_id ?? null,
          reason: reasonSentence(span),
          lineRef: span.line_ref ?? null,
        },
      })
    })
  }

  placed.sort((a, b) => a.start - b.start || order[a.run.kind as SpanClass] - order[b.run.kind as SpanClass])

  const runs: SpanRun[] = []
  let cursor = 0
  for (const item of placed) {
    if (item.start < cursor) continue // overlapping quote: the first one drawn wins
    if (item.start > cursor) {
      runs.push({ id: `plain-${cursor}`, text: text.slice(cursor, item.start), kind: 'plain', ao: null, point: null, reason: null, lineRef: null })
    }
    runs.push({ ...item.run, text: text.slice(item.start, item.end) })
    cursor = item.end
  }
  if (cursor < text.length) {
    runs.push({ id: `plain-${cursor}`, text: text.slice(cursor), kind: 'plain', ao: null, point: null, reason: null, lineRef: null })
  }
  return runs
}

export function describeRun(run: SpanRun): string {
  if (run.kind === 'plain') return ''
  const parts = [KIND_WORD[run.kind]]
  if (run.ao) parts.push(run.ao)
  if (run.point) parts.push(`marking point ${run.point}`)
  if (run.lineRef) parts.push(run.lineRef)
  const head = parts.join(' · ')
  return run.reason ? `${head} — ${run.reason}` : head
}

export interface SpanTextProps {
  /** The student's answer, exactly as they wrote it. Never edited here. */
  text: string
  runs: SpanRun[]
  /** AO whose card is currently hovered or focused — its spans are lit. */
  activeAo?: string | null
  /** A single span singled out from its AO card. */
  activeSpan?: string | null
  onHoverSpan?: (run: SpanRun | null) => void
  onSelectSpan?: (run: SpanRun) => void
  /** Heading the answer is labelled by, for screen readers. */
  label?: string
}

/**
 * The student's answer with the marker's spans drawn on it. Class is carried by
 * underline style and a glyph as well as by the wash, so the reading works with no
 * colour at all; every span is focusable and describes what it matched.
 */
export function SpanText({ text, runs, activeAo, activeSpan, onHoverSpan, onSelectSpan, label = 'Your answer' }: SpanTextProps) {
  const drawn = runs.length ? runs : [{ id: 'plain-0', text, kind: 'plain' as const, ao: null, point: null, reason: null, lineRef: null }]

  return (
    <div className="span-text read" aria-label={label} role="group">
      {drawn.map((run) => {
        if (run.kind === 'plain') {
          return <span key={run.id} className="span-text__plain">{run.text}</span>
        }
        const lit = (activeAo != null && activeAo === run.ao) || activeSpan === run.id
        const description = describeRun(run)
        return (
          <mark
            key={run.id}
            id={`span-${run.id}`}
            className={`span-text__span span-text__span--${run.kind}${lit ? ' is-linked' : ''}`}
            tabIndex={0}
            title={description}
            aria-describedby={`span-desc-${run.id}`}
            onMouseEnter={() => onHoverSpan?.(run)}
            onMouseLeave={() => onHoverSpan?.(null)}
            onFocus={() => onHoverSpan?.(run)}
            onBlur={() => onHoverSpan?.(null)}
            onClick={() => onSelectSpan?.(run)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelectSpan?.(run)
              }
            }}
          >
            {run.text}
            <span className="span-text__glyph" aria-hidden="true">{KIND_GLYPH[run.kind]}</span>
            <span className="sr" id={`span-desc-${run.id}`}>{description}</span>
          </mark>
        )
      })}
    </div>
  )
}

export default SpanText
