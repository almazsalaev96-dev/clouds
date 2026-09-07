import type { CSSProperties } from 'react'
import './MasteryPip.css'

/** The five mastery states. Shape carries the meaning; colour only reinforces it. */
export type MasteryState = 'unseen' | 'weak' | 'developing' | 'secure' | 'strong'

const FRACTION: Record<MasteryState, number> = {
  unseen: 0,
  weak: 0.25,
  developing: 0.5,
  secure: 0.75,
  strong: 1,
}

const WORD: Record<MasteryState, string> = {
  unseen: 'not attempted',
  weak: 'weak',
  developing: 'developing',
  secure: 'secure',
  strong: 'strong',
}

const SHAPE: Record<MasteryState, string> = {
  unseen: 'open ring',
  weak: 'quarter filled',
  developing: 'half filled',
  secure: 'three quarters filled',
  strong: 'filled disc',
}

/**
 * Map a mastery value (0–1) and an attempt count onto a state.
 * A point with no attempts is unseen however the model scores it.
 */
export function masteryStateOf(mastery: number | null | undefined, attempts = 0): MasteryState {
  if (attempts <= 0 || mastery == null || !Number.isFinite(mastery)) return 'unseen'
  if (mastery < 0.35) return 'weak'
  if (mastery < 0.6) return 'developing'
  if (mastery < 0.85) return 'secure'
  return 'strong'
}

/** The word a student reads for a state. */
export function masteryWord(state: MasteryState): string {
  return WORD[state]
}

function wedge(cx: number, cy: number, r: number, fraction: number): string {
  const angle = fraction * Math.PI * 2 - Math.PI / 2
  const x = cx + r * Math.cos(angle)
  const y = cy + r * Math.sin(angle)
  const large = fraction > 0.5 ? 1 : 0
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x.toFixed(3)} ${y.toFixed(3)} Z`
}

export type MasteryPipProps = {
  state: MasteryState
  /** The syllabus figure this pip stands for, e.g. "3.2 Motivation". Named in the label. */
  figure: string
  /** One sentence saying how the state was reached; joined onto the accessible label. */
  reason?: string
  /** Edge length in px. 12 by default. */
  size?: number
}

export function MasteryPip({ state, figure, reason, size }: MasteryPipProps) {
  const fraction = FRACTION[state]
  const label = `${figure}: ${WORD[state]}, ${SHAPE[state]}${reason ? `. ${reason}` : ''}`
  const style: CSSProperties | undefined = size ? { width: size, height: size } : undefined
  return (
    <span
      className={`mastery-pip mastery-pip--${state}`}
      role="img"
      aria-label={label}
      title={label}
      style={style}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle className="mastery-pip__ring" cx="12" cy="12" r="9" />
        {fraction > 0 && fraction < 1 ? (
          <path className="mastery-pip__fill" d={wedge(12, 12, 9, fraction)} />
        ) : null}
        {fraction === 1 ? <circle className="mastery-pip__fill" cx="12" cy="12" r="9" /> : null}
      </svg>
    </span>
  )
}
