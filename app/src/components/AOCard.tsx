import { useId, useState } from 'react'
import { spanId, reasonSentence } from './SpanText'
import type { MarkSpan, SpanClass } from './SpanText'
import type { AOCard as AoObjective } from '../lib/api'
import './AOCard.css'

export interface AoBand {
  level: number
  range?: number[] | null
  descriptor: string
}

/**
 * One assessment objective as the Mark carries it (§05.2 `per_ao[]`), plus the two
 * things the card adds: the grid's own bands, so the student can read what the next
 * level asks for, and how many levels the grid has.
 */
export interface AoResult extends AoObjective {
  name?: string | null
  levels?: number | null
  bands?: AoBand[] | null
  /** A points card is one marking point; an objective card is a whole AO. */
  kind?: 'point' | 'objective'
}

const AO_NAMES: Record<string, string> = {
  AO1: 'Knowledge and understanding',
  AO2: 'Application',
  AO3: 'Analysis',
  AO4: 'Evaluation',
}

const GROUP_LABEL: Record<SpanClass, string> = {
  credited: 'Credited',
  partial: 'Partly credited',
  uncredited: 'Not credited',
}

const GROUP_GLYPH: Record<SpanClass, string> = { credited: '✓', partial: '·', uncredited: '×' }

/** 05-MARK-011: students see a word, never a percentage. */
export function confidenceWord(confidence: number | null | undefined): string | null {
  if (typeof confidence !== 'number') return null
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.6) return 'medium'
  return 'check with your teacher'
}

export function aoName(ao: AoResult): string {
  return ao.name || AO_NAMES[ao.ao] || 'Assessment objective'
}

export interface AOCardProps {
  ao: AoResult
  /** True while a span belonging to this AO is hovered or focused in the answer. */
  active?: boolean
  activeSpan?: string | null
  onHover?: (ao: string | null) => void
  onSelectSpan?: (id: string, ao: string) => void
}

/**
 * One assessment objective: the mark it reached, the descriptor the marker relied on,
 * the student's own words as evidence, and what was missing. The level is stated in
 * words; the bar is a second reading of the same number, never the only one.
 */
export function AOCard({ ao, active = false, activeSpan, onHover, onSelectSpan }: AOCardProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const levels = ao.levels ?? (ao.bands?.length ? Math.max(...ao.bands.map((b) => b.level)) : null)
  const confidence = confidenceWord(ao.confidence)
  const pct = ao.max > 0 ? Math.max(0, Math.min(100, (ao.marks / ao.max) * 100)) : 0
  const level = ao.level
  const nextBand = level == null ? null : ao.bands?.find((band) => band.level === level + 1) ?? null

  const groups: Array<{ kind: SpanClass; spans: MarkSpan[] }> = [
    { kind: 'credited', spans: ao.credited_spans ?? [] },
    { kind: 'partial', spans: ao.partial_spans ?? [] },
    { kind: 'uncredited', spans: ao.uncredited_attempts ?? [] },
  ]

  return (
    <section
      className={active ? 'ao-card is-linked' : 'ao-card'}
      aria-labelledby={`${panelId}-title`}
      onMouseEnter={() => onHover?.(ao.ao)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(ao.ao)}
      onBlur={() => onHover?.(null)}
    >
      <header className="ao-card__head">
        <h3 className="ao-card__title" id={`${panelId}-title`}>
          <span className="ao-card__ao mono">{ao.ao}</span> {aoName(ao)}
        </h3>
        <p className="ao-card__score mono">
          <span className="ao-card__marks">{ao.marks}</span>
          <span className="ao-card__of"> of {ao.max}</span>
        </p>
      </header>

      <p className="ao-card__level">
        {ao.level == null
          ? 'Marked point by point'
          : levels
            ? `Level ${ao.level} of ${levels}`
            : `Level ${ao.level}`}
        {confidence ? <span className="ao-card__confidence"> · marker confidence {confidence}</span> : null}
      </p>

      <div className="ao-card__bar" role="img" aria-label={`${ao.marks} of ${ao.max} marks`}>
        <span className="ao-card__bar-fill" style={{ width: `${pct}%` }} />
      </div>

      {ao.descriptor_relied_on ? (
        <blockquote className="ao-card__descriptor read">
          {ao.descriptor_relied_on.paraphrase}
          {ao.descriptor_relied_on.band_id ? (
            <span className="ao-card__band-id mono"> {ao.descriptor_relied_on.band_id}</span>
          ) : null}
        </blockquote>
      ) : null}

      {groups.map(({ kind, spans }) =>
        spans.length ? (
          <div className="ao-card__group" key={kind}>
            <h4 className="ao-card__group-title">
              <span className="ao-card__glyph mono" aria-hidden="true">{GROUP_GLYPH[kind]}</span>
              {GROUP_LABEL[kind]}
            </h4>
            <ul className="ao-card__quotes">
              {spans.map((span, index) => {
                const id = spanId(ao.ao, kind, index)
                const reason = reasonSentence(span)
                return (
                  <li className="ao-card__quote-row" key={id}>
                    <button
                      type="button"
                      className={activeSpan === id ? 'ao-card__quote is-linked' : 'ao-card__quote'}
                      onClick={() => onSelectSpan?.(id, ao.ao)}
                      onFocus={() => onHover?.(ao.ao)}
                    >
                      <span className="sr">{GROUP_LABEL[kind]}: </span>
                      {span.line_ref ? <span className="ao-card__line mono">{span.line_ref}</span> : null}
                      <span className="ao-card__quote-text read">“{span.quote}”</span>
                    </button>
                    {reason ? <p className="ao-card__reason">{reason}</p> : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null,
      )}

      {ao.missing_points && ao.missing_points.length ? (
        <div className="ao-card__group">
          <h4 className="ao-card__group-title">
            <span className="ao-card__glyph mono" aria-hidden="true">+</span>
            Next mark available here
          </h4>
          <ul className="ao-card__missing">
            {ao.missing_points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {ao.bands && ao.bands.length ? (
        <div className="ao-card__bands">
          <button
            type="button"
            className="ao-card__expander"
            aria-expanded={open}
            aria-controls={`${panelId}-bands`}
            onClick={() => setOpen((was) => !was)}
          >
            {open ? 'Hide the band descriptors' : 'Show the band descriptors'}
            {!open && nextBand ? <span className="ao-card__expander-hint"> · what Level {nextBand.level} asks for</span> : null}
          </button>
          <div className="ao-card__band-list" id={`${panelId}-bands`} hidden={!open}>
            {[...ao.bands]
              .sort((a, b) => b.level - a.level)
              .map((band) => {
                const reached = ao.level != null && band.level === ao.level
                const range = band.range && band.range.length === 2 ? `${band.range[0]}–${band.range[1]}` : null
                return (
                  <div
                    className={reached ? 'ao-card__band is-reached' : 'ao-card__band'}
                    key={band.level}
                    aria-current={reached ? 'true' : undefined}
                  >
                    <p className="ao-card__band-head">
                      <span className="mono">Level {band.level}</span>
                      {range ? <span className="ao-card__band-range mono"> {range} marks</span> : null}
                      <span className="ao-card__band-state">{reached ? ' · reached' : nextBand && band.level === nextBand.level ? ' · next' : ''}</span>
                    </p>
                    <p className="ao-card__band-text read">{band.descriptor}</p>
                  </div>
                )
              })}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export interface AOCardSkeletonProps {
  ao: string
  max?: number | null
}

/** Held at the card's real geometry while its part of the Mark is still streaming. */
export function AOCardSkeleton({ ao, max }: AOCardSkeletonProps) {
  return (
    <section className="ao-card ao-card--pending" aria-hidden="true">
      <header className="ao-card__head">
        <h3 className="ao-card__title">
          <span className="ao-card__ao mono">{ao}</span> {AO_NAMES[ao] || ''}
        </h3>
        <p className="ao-card__score mono">{max ? `— of ${max}` : '—'}</p>
      </header>
      <p className="ao-card__level">Marking</p>
      <div className="ao-card__bar"><span className="ao-card__bar-fill ao-card__bar-fill--pending" /></div>
      <div className="ao-card__skeleton-line" />
      <div className="ao-card__skeleton-line ao-card__skeleton-line--short" />
    </section>
  )
}

export default AOCard
