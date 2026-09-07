import { useEffect, useState } from 'react'
import { get } from '../lib/api'
import { useStore } from '../lib/state'
import { MasteryPip, masteryWord } from '../components/MasteryPip'
import type { MasteryState } from '../components/MasteryPip'
import { ReadinessRing } from '../components/ReadinessRing'
import './Progress.css'

/* ------------------------------------------------ what the endpoint answers */

interface CourseView {
  id: string
  title: string
  examDate: string | null
  packVersion: string
  daysToExam: number | null
  countdown: string
}

interface MasteryPoint {
  code: string
  title: string
  paper: string
  weight: number
  mastery: number
  state: string
  attempts: number
  unaidedMarks: number
  unaidedMax: number
  unaidedRate: number | null
  lastSeen: string | null
  daysSince: number | null
  itemCount: number
}

interface PaperReadiness {
  paper: string
  readiness: number
  pointCount: number
  pointsSeen: number
  sampleSize: number
  evidence: string
}

interface UnaidedGain {
  value: number | null
  gainMarks?: number
  hours: number
  sampleSize: number
  comparedWith?: number
  windowDays: number
  note: string
}

interface CalibrationPoint {
  band: string
  predicted: number | null
  actual: number | null
  n: number
}

interface Calibration {
  points: CalibrationPoint[]
  n: number
  minimum: number
  meanPredicted?: number
  meanActual?: number
  signedError: number | null
  verdict: string | null
  note: string
}

interface ProgressResponse {
  courseId: string
  course: CourseView
  masteryByPoint: MasteryPoint[]
  readiness: PaperReadiness[]
  unaidedGain: UnaidedGain
  calibration: Calibration
  totals: { attempts: number; unaidedAttempts: number; marksTaken: number; pointsSeen: number; points: number }
}

/* ------------------------------------------------------------------ shaping */

/** Packs name papers "1"…"4"; students call them Paper 1…Paper 4. */
const paperName = (paper: string): string =>
  /^\d+$/.test(paper) ? `Paper ${paper}` : /^p\d+$/i.test(paper) ? `Paper ${paper.slice(1)}` : paper

const STATES: MasteryState[] = ['unseen', 'weak', 'developing', 'secure', 'strong']
const stateOf = (row: MasteryPoint): MasteryState =>
  (STATES as string[]).includes(row.state) ? (row.state as MasteryState) : 'unseen'

interface HeatRow {
  code: string
  title: string
  points: MasteryPoint[]
}

const parentOf = (code: string): string | null => {
  const cut = code.lastIndexOf('.')
  return cut > 0 ? code.slice(0, cut) : null
}

/** Rows are topics, cells are the points under them. A topic row is never also a cell. */
function heatRows(points: MasteryPoint[]): HeatRow[] {
  const headings = new Set<string>()
  for (const p of points) {
    const parent = parentOf(p.code)
    if (parent) headings.add(parent)
  }
  const titles = new Map(points.map((p) => [p.code, p.title]))
  const rows = new Map<string, HeatRow>()
  const order: string[] = []
  for (const p of points) {
    if (headings.has(p.code)) continue
    const head = parentOf(p.code) ?? 'all'
    if (!rows.has(head)) {
      rows.set(head, {
        code: head === 'all' ? '' : head,
        title: titles.get(head) ?? (head === 'all' ? 'Syllabus' : head),
        points: [],
      })
      order.push(head)
    }
    rows.get(head)?.points.push(p)
  }
  return order.map((code) => rows.get(code)).filter((row): row is HeatRow => row != null && row.points.length > 0)
}

function countStates(points: MasteryPoint[]): Record<MasteryState, number> {
  const counts: Record<MasteryState, number> = { unseen: 0, weak: 0, developing: 0, secure: 0, strong: 0 }
  for (const p of points) counts[stateOf(p)] += 1
  return counts
}

function reasonFor(row: MasteryPoint): string {
  if (row.attempts === 0) return 'No attempt on record'
  const seen =
    row.daysSince == null ? 'last seen date not recorded' : row.daysSince === 0 ? 'last seen today' : `last seen ${row.daysSince} ${row.daysSince === 1 ? 'day' : 'days'} ago`
  return `${masteryWord(stateOf(row))} after ${row.attempts} ${row.attempts === 1 ? 'attempt' : 'attempts'}, ${seen}`
}

/* ------------------------------------------------------- calibration chart */

const PAD = { left: 58, right: 26, top: 24, bottom: 54 }
const PLOT = 260
const WIDTH = PAD.left + PLOT + PAD.right
const HEIGHT = PAD.top + PLOT + PAD.bottom
const sx = (v: number) => PAD.left + (Math.max(0, Math.min(100, v)) / 100) * PLOT
const sy = (v: number) => PAD.top + PLOT - (Math.max(0, Math.min(100, v)) / 100) * PLOT
const TICKS = [0, 25, 50, 75, 100]

interface Plotted {
  band: string
  predicted: number
  actual: number
  n: number
}

function CalibrationChart({ calibration }: { calibration: Calibration }) {
  const plotted: Plotted[] = calibration.points
    .filter((p): p is CalibrationPoint & { predicted: number; actual: number } => p.predicted != null && p.actual != null)
    .map((p) => ({ band: p.band, predicted: p.predicted * 100, actual: p.actual * 100, n: p.n }))
  const thin = plotted.filter((p) => p.n < 5)

  return (
    <figure className="progress__figure">
      <svg
        className="progress__chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          plotted.length === 0
            ? 'Calibration chart with nothing plotted yet'
            : `Confidence against marks: ${plotted
                .map(
                  (p) =>
                    `band ${p.band}, predicted ${Math.round(p.predicted)}, scored ${Math.round(p.actual)}, ${p.n} answers`,
                )
                .join('; ')}`
        }
      >
        <line className="progress__axis" x1={PAD.left} y1={sy(0)} x2={sx(100)} y2={sy(0)} />
        <line className="progress__axis" x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={sy(0)} />
        {TICKS.map((t) => (
          <g key={`x${t}`}>
            <line className="progress__grid" x1={sx(t)} y1={PAD.top} x2={sx(t)} y2={sy(0)} />
            <text className="progress__tick mono" x={sx(t)} y={sy(0) + 16} textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        {TICKS.map((t) => (
          <text key={`y${t}`} className="progress__tick mono" x={PAD.left - 8} y={sy(t) + 4} textAnchor="end">
            {t}
          </text>
        ))}
        <line className="progress__diagonal" x1={sx(0)} y1={sy(0)} x2={sx(100)} y2={sy(100)} />
        <text className="progress__diagonal-label" x={sx(62)} y={sy(62) - 8}>
          Predicted = scored
        </text>
        {plotted.map((p) => (
          <g key={p.band}>
            <line
              className="progress__drop"
              x1={sx(p.predicted)}
              y1={sy(p.predicted)}
              x2={sx(p.predicted)}
              y2={sy(p.actual)}
            />
            <circle className="progress__dot" cx={sx(p.predicted)} cy={sy(p.actual)} r="5" />
            <text
              className="progress__point-label"
              x={sx(p.predicted) + (p.predicted > 62 ? -10 : 10)}
              y={sy(p.actual) + (p.predicted > p.actual ? 18 : -10)}
              textAnchor={p.predicted > 62 ? 'end' : 'start'}
            >
              {Math.round(p.predicted)} said, {Math.round(p.actual)} scored (n = {p.n})
            </text>
          </g>
        ))}
        <text className="progress__axis-label" x={PAD.left + PLOT / 2} y={HEIGHT - 12} textAnchor="middle">
          What you predicted, out of 100
        </text>
        <text
          className="progress__axis-label"
          transform={`translate(15 ${PAD.top + PLOT / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          What you scored, out of 100
        </text>
      </svg>
      <figcaption className="progress__caption">
        {calibration.note}
        {plotted.length > 0
          ? ' A point below the diagonal is over-confidence on that band; above it, under-confidence.'
          : ''}
        {thin.length > 0 ? ` Bands with fewer than five answers (${thin.map((p) => p.band).join(', ')}) are drawn but too thin to lean on.` : ''}
      </figcaption>
    </figure>
  )
}

/* -------------------------------------------------------------------- view */

export interface ProgressProps {
  /** Overrides the course the shell has selected. The shell passes none. */
  courseId?: string
}

export function Progress({ courseId }: ProgressProps) {
  const store = useStore()
  const course = courseId ?? store.courseId
  const [data, setData] = useState<ProgressResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [problem, setProblem] = useState('')
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let live = true
    setStatus('loading')
    const query = course ? `?courseId=${encodeURIComponent(course)}` : ''
    get<ProgressResponse>(`/api/progress${query}`)
      .then((payload) => {
        if (!live) return
        setData(payload)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!live) return
        setProblem(error instanceof Error ? error.message : 'Progress did not load.')
        setStatus('error')
      })
    return () => {
      live = false
    }
  }, [course, reloads])

  const rows = data ? heatRows(data.masteryByPoint) : []
  const gain = data?.unaidedGain ?? null

  return (
    <main className="progress" aria-labelledby="progress-heading">
      <header className="progress__head">
        <h1 id="progress-heading" className="progress__heading">
          Progress{data ? ` · ${data.course.title}` : ''}
        </h1>
        <p className="progress__sub">
          What the record supports, with the evidence beside it: mastery point by point, readiness per paper, the
          unaided gain, and how well your confidence matches your marks.
        </p>
      </header>

      {status === 'loading' ? <p className="progress__note">Loading your record.</p> : null}

      {status === 'error' ? (
        <section className="progress__panel" role="alert">
          <p>{problem}</p>
          <p>Nothing about your record has changed.</p>
          <button type="button" className="progress__retry" onClick={() => setReloads((n) => n + 1)}>
            Try again
          </button>
        </section>
      ) : null}

      {data && status === 'ready' ? (
        <>
          <section className="progress__section" aria-labelledby="progress-mastery">
            <h2 id="progress-mastery" className="progress__section-heading">
              Mastery by syllabus point
            </h2>
            <p className="progress__note">
              {data.totals.pointsSeen} of {data.totals.points} points attempted, across {data.totals.attempts}{' '}
              {data.totals.attempts === 1 ? 'marked answer' : 'marked answers'}. Each cell is one point: the shape
              carries the state, and its label names the point.
            </p>
            {rows.length === 0 ? (
              <p className="progress__note">The pack has no syllabus points loaded, so there is nothing to map.</p>
            ) : (
              <div className="progress__heatmap">
                {rows.map((row) => {
                  const counts = countStates(row.points)
                  return (
                    <div key={row.code || row.title} className="progress__heat-row">
                      <p className="progress__heat-label">
                        {row.code ? <span className="mono">{row.code}</span> : null} {row.title}
                      </p>
                      <div className="progress__cells">
                        {row.points.map((p) => (
                          <span key={p.code} className="progress__cell">
                            <MasteryPip state={stateOf(p)} figure={`${p.code} ${p.title}`} reason={reasonFor(p)} />
                            <span className="progress__cell-code mono">{p.code}</span>
                          </span>
                        ))}
                      </div>
                      <p className="progress__heat-counts mono">
                        strong {counts.strong} · secure {counts.secure} · developing {counts.developing} · weak{' '}
                        {counts.weak} · unseen {counts.unseen}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="progress__section" aria-labelledby="progress-readiness">
            <h2 id="progress-readiness" className="progress__section-heading">
              Readiness by paper
            </h2>
            {data.readiness.length === 0 ? (
              <p className="progress__note">No paper in this pack has a point against it yet.</p>
            ) : (
              <div className="progress__rings">
                {data.readiness.map((paper) => (
                  <ReadinessRing
                    key={paper.paper}
                    paper={paperName(paper.paper)}
                    percent={paper.pointsSeen === 0 ? null : paper.readiness * 100}
                    sample={paper.sampleSize}
                    reason={`${paper.pointsSeen} of ${paper.pointCount} points attempted · evidence ${paper.evidence}`}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="progress__section" aria-labelledby="progress-unaided">
            <h2 id="progress-unaided" className="progress__section-heading">
              Unaided mark gain per hour
            </h2>
            {gain && gain.value != null ? (
              <p className="progress__figure-line">
                <span className="mono">{gain.value.toFixed(2)}</span> marks per hour studied, over{' '}
                <span className="mono">{gain.hours}</span> hours and{' '}
                <span className="mono">{gain.sampleSize}</span> unaided marks in the last {gain.windowDays} days.
              </p>
            ) : (
              <p className="progress__figure-line">
                No figure yet — {gain ? gain.sampleSize : 0} unaided{' '}
                {gain && gain.sampleSize === 1 ? 'mark' : 'marks'} on record.
              </p>
            )}
            {gain ? <p className="progress__note">{gain.note}</p> : null}
            <p className="progress__note">
              Counted only from answers written before any help was taken, on questions you had not seen.
            </p>
          </section>

          <section className="progress__section" aria-labelledby="progress-calibration">
            <h2 id="progress-calibration" className="progress__section-heading">
              Confidence against marks
            </h2>
            {data.calibration.points.length === 0 ? (
              <p className="progress__note">{data.calibration.note}</p>
            ) : (
              <CalibrationChart calibration={data.calibration} />
            )}
          </section>
        </>
      ) : null}
    </main>
  )
}

export default Progress
