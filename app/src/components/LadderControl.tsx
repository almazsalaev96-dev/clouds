import './LadderControl.css'

export interface LadderControlProps {
  /** Rung the ladder has reached on this item: 0 before the first turn, otherwise 1–5. */
  current: number
  /** Highest rung this item allows right now. Rungs above it are out of reach, not missing. */
  max: number
  /** Why the rungs above max are out of reach, in the student's terms. */
  budgetReason?: string
  onRequest(rung: number): void
  /** A turn is streaming: the ladder cannot move until it lands. */
  busy?: boolean
}

const RUNGS: { n: number; name: string; what: string }[] = [
  { n: 1, name: 'Metacognitive', what: 'A question about what the item is asking for.' },
  { n: 2, name: 'Conceptual pointer', what: 'The principle, with no numbers.' },
  { n: 3, name: 'The next step', what: 'The one step to take now, and no further.' },
  { n: 4, name: 'Worked step, one blank', what: 'The working up to a gap you fill.' },
  { n: 5, name: 'Full solution', what: 'The whole answer, then one like it to do unaided.' },
]

export function LadderControl(props: LadderControlProps) {
  const { current, max, budgetReason, onRequest, busy = false } = props
  const reasonId = 'ladder-reason'
  const capped = max < RUNGS.length && !!budgetReason

  return (
    <nav className="ladder" aria-label="Help ladder">
      <p className="ladder__title sr">
        Help ladder. Rung {current > 0 ? current : 'none yet'} of {RUNGS.length}.
      </p>
      <ol className="ladder__rungs">
        {RUNGS.map(r => {
          const reached = current >= r.n
          const isCurrent = current === r.n
          const outOfReach = r.n > max
          const climbable = !outOfReach && r.n > current && !busy
          const state = outOfReach
            ? 'Out of reach for now'
            : isCurrent ? 'Where you are'
              : reached ? 'Already given'
                : 'More help'
          return (
            <li key={r.n} className="ladder__rung">
              <button
                type="button"
                className={
                  'ladder__pip'
                  + (reached ? ' ladder__pip--filled' : '')
                  + (outOfReach ? ' ladder__pip--locked' : '')
                }
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={!climbable}
                aria-describedby={outOfReach && capped ? reasonId : undefined}
                title={`Rung ${r.n} · ${r.name} — ${r.what}`}
                onClick={() => { if (climbable) onRequest(r.n) }}
              >
                <span className="ladder__num mono" aria-hidden="true">{r.n}</span>
                <span className="sr">
                  Rung {r.n}, {r.name}. {r.what} {state}.
                </span>
              </button>
              <span className="ladder__name" aria-hidden="true">{r.name}</span>
            </li>
          )
        })}
      </ol>
      {capped && <p className="ladder__reason" id={reasonId}>{budgetReason}</p>}
    </nav>
  )
}
