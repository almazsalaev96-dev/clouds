import type { CSSProperties } from 'react'
import './ReadinessRing.css'

export type ReadinessRingProps = {
  /** The paper this figure is about, e.g. "Paper 2". Read out with the value. */
  paper: string
  /** Readiness 0–100, or null when there is not enough evidence for a figure. */
  percent: number | null
  /** How many marked attempts the figure rests on. Shown, because four is not forty. */
  sample: number
  /** One sentence naming what moves the figure. */
  reason?: string
  /** Diameter in px. 64 by default. */
  size?: number
}

const R = 28
const CIRC = 2 * Math.PI * R

export function ReadinessRing({ paper, percent, sample, reason, size }: ReadinessRingProps) {
  const value = percent == null || !Number.isFinite(percent) ? null : Math.max(0, Math.min(100, Math.round(percent)))
  const thin = sample > 0 && sample < 5
  const dial: CSSProperties | undefined = size ? { width: size, height: size } : undefined
  const sampleLine =
    sample <= 0
      ? 'No marked attempts yet'
      : `From ${sample} marked ${sample === 1 ? 'attempt' : 'attempts'}${thin ? ' — too few to lean on' : ''}`
  const spoken =
    value == null
      ? `${paper}: readiness not estimated yet. ${sampleLine}.`
      : `${paper}: readiness ${value} out of 100. ${sampleLine}.`

  return (
    <div className={`readiness-ring${thin ? ' readiness-ring--thin' : ''}`}>
      <div className="readiness-ring__dial" style={dial}>
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <circle className="readiness-ring__track" cx="32" cy="32" r={R} />
          {value == null ? null : (
            <circle
              className="readiness-ring__arc"
              cx="32"
              cy="32"
              r={R}
              strokeDasharray={`${((value / 100) * CIRC).toFixed(2)} ${CIRC.toFixed(2)}`}
            />
          )}
        </svg>
        <span className="readiness-ring__value mono" aria-hidden="true">
          {value == null ? '—' : value}
        </span>
      </div>
      <p className="readiness-ring__paper">{paper}</p>
      <p className="readiness-ring__sample mono">{sampleLine}</p>
      {reason ? <p className="readiness-ring__reason">{reason}</p> : null}
      <span className="sr">{spoken}</span>
    </div>
  )
}
