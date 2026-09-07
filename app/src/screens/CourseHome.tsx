import { useCallback, useEffect, useMemo, useState } from 'react'
import { get } from '../lib/api'
import { useStore } from '../lib/state'
import { MasteryPip, masteryWord } from '../components/MasteryPip'
import type { MasteryState } from '../components/MasteryPip'
import { ReadinessRing } from '../components/ReadinessRing'
import './CourseHome.css'

/* ------------------------------------------------ what the endpoints answer */

interface CourseView {
  id: string
  title: string
  board: string
  syllabus: string
  examDate: string | null
  targetGrade: string | null
  packVersion: string
  daysToExam: number | null
  phase: string
  phaseLabel: string
  countdown: string
}

interface PointRow {
  code: string
  title: string
  paper: string
  weight: number
  mastery: number
  attempts: number
  unaidedMarks: number
  unaidedMax: number
  unaidedRate: number | null
  misconceptions: string[]
  lastSeen: string | null
  daysSince: number | null
  neverAttempted: boolean
  state: string
  itemCount: number
  marksAvailable: number
  topTariff: number
  minutes: number
}

interface TreeNode extends PointRow {
  children: TreeNode[]
}

interface PaperReadiness {
  paper: string
  readiness: number
  pointCount: number
  pointsSeen: number
  sampleSize: number
  evidence: string
}

interface CourseResponse {
  course: CourseView
  papers: PaperReadiness[]
  tree: TreeNode[]
  points: PointRow[]
  counts: { points: number; pointsSeen: number; items: number; marksAvailable: number }
}

/** Packs name papers "1"…"4"; students call them Paper 1…Paper 4. */
const paperName = (paper: string): string =>
  /^\d+$/.test(paper) ? `Paper ${paper}` : /^p\d+$/i.test(paper) ? `Paper ${paper.slice(1)}` : paper

const STATES: MasteryState[] = ['unseen', 'weak', 'developing', 'secure', 'strong']
const stateOf = (row: PointRow): MasteryState =>
  (STATES as string[]).includes(row.state) ? (row.state as MasteryState) : 'unseen'

function reasonFor(row: PointRow): string {
  if (row.attempts === 0) return `No attempt yet · ${row.itemCount} ${row.itemCount === 1 ? 'question' : 'questions'} waiting`
  const seen =
    row.daysSince == null ? 'last seen date not recorded' : row.daysSince === 0 ? 'last seen today' : `last seen ${row.daysSince} ${row.daysSince === 1 ? 'day' : 'days'} ago`
  const unaided =
    row.unaidedMax > 0 ? `, ${Math.round(row.unaidedMarks)} of ${Math.round(row.unaidedMax)} unaided marks` : ''
  return `${masteryWord(stateOf(row))} after ${row.attempts} ${row.attempts === 1 ? 'attempt' : 'attempts'}, ${seen}${unaided}`
}

/* ----------------------------------------------------------------- filters */

type Filter = 'all' | 'weak' | 'unseen' | 'due'

const FILTERS: { id: Filter; label: string; note: string }[] = [
  { id: 'all', label: 'Whole syllabus', note: 'Every point in the pack, in the board&rsquo;s own order' },
  { id: 'weak', label: 'Weak first', note: 'Points you have attempted, lowest mastery first' },
  { id: 'unseen', label: 'Never attempted', note: 'Points with no attempt on record' },
  { id: 'due', label: 'Due for review', note: 'Attempted, and not seen for seven days or more' },
]

function passes(row: PointRow, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'unseen') return row.attempts === 0
  if (filter === 'weak') return row.attempts > 0 && row.mastery < 0.6
  return row.attempts > 0 && row.daysSince != null && row.daysSince >= 7
}

/* -------------------------------------------------------------------- view */

export interface CourseHomeProps {
  /** Overrides the course the shell has selected. The shell passes none. */
  courseId?: string
}

export function CourseHome({ courseId }: CourseHomeProps) {
  const store = useStore()
  const wanted = courseId ?? store.courseId
  const [data, setData] = useState<CourseResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [problem, setProblem] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [openTopics, setOpenTopics] = useState<string[]>([])
  const [openPoint, setOpenPoint] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let live = true
    setStatus('loading')
    ;(async (): Promise<CourseResponse> => {
      let id = wanted
      if (!id) {
        const list = await get<CourseView[]>('/api/courses')
        if (!Array.isArray(list) || list.length === 0) {
          throw new Error('There is no course yet. Create one and the syllabus appears here.')
        }
        id = list[0].id
      }
      return get<CourseResponse>(`/api/courses/${encodeURIComponent(id)}`)
    })()
      .then((payload) => {
        if (!live) return
        setData(payload)
        setOpenTopics(payload.tree.slice(0, 1).map((t) => t.code))
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!live) return
        setProblem(error instanceof Error ? error.message : 'The syllabus did not load.')
        setStatus('error')
      })
    return () => {
      live = false
    }
  }, [wanted, reloads])

  const toggleTopic = useCallback((code: string) => {
    setOpenTopics((open) => (open.includes(code) ? open.filter((c) => c !== code) : [...open, code]))
  }, [])

  const filtered = useMemo(() => {
    if (!data || filter === 'all') return []
    const rows = data.points.filter((p) => passes(p, filter))
    return filter === 'weak' ? [...rows].sort((a, b) => a.mastery - b.mastery) : rows
  }, [data, filter])

  const detailFor = useCallback(
    (row: PointRow) => (
      <div className="course-home__detail">
        <p className="course-home__reason">{reasonFor(row)}</p>
        <p className="course-home__items-line mono">
          {row.itemCount} {row.itemCount === 1 ? 'question' : 'questions'} · {row.marksAvailable} marks available ·
          longest {row.topTariff} marks · about {row.minutes} min each
        </p>
        <p className="course-home__note">
          {row.itemCount === 0
            ? 'The pack has no question on this point yet, so practice starts on a neighbouring one.'
            : 'Practice opens these one at a time, hardest-earning first. Marking is per question.'}
        </p>
        {row.misconceptions.length > 0 ? (
          <ul className="course-home__misconceptions">
            {row.misconceptions.slice(0, 3).map((m, i) => (
              <li key={`${row.code}-m${i}`}>{typeof m === 'string' ? m : JSON.stringify(m)}</li>
            ))}
          </ul>
        ) : null}
        <div className="course-home__point-actions">
          <a className="course-home__go" href="#/practise">
            Practise this point
          </a>
          <a className="course-home__link" href="#/session">
            Ask about it
          </a>
          <a className="course-home__link" href="#/cards">
            Cards
          </a>
        </div>
      </div>
    ),
    [],
  )

  const pointRow = ({ row, depth }: { row: PointRow; depth: number }) => {
    const expanded = openPoint === row.code
    return (
      <li key={row.code} className="course-home__point" style={depth > 0 ? { marginLeft: depth * 16 } : undefined}>
        <div className="course-home__row">
          <MasteryPip state={stateOf(row)} figure={`${row.code} ${row.title}`} reason={reasonFor(row)} />
          <button
            type="button"
            className="course-home__point-button"
            aria-expanded={expanded}
            onClick={() => setOpenPoint(expanded ? null : row.code)}
          >
            <span className="course-home__code mono">{row.code}</span>
            <span className="course-home__point-title">{row.title}</span>
          </button>
          <span className="course-home__state">{masteryWord(stateOf(row))}</span>
        </div>
        {expanded ? detailFor(row) : null}
      </li>
    )
  }

  const flatten = (node: TreeNode, depth: number): { row: PointRow; depth: number }[] => [
    { row: node, depth },
    ...node.children.flatMap((child) => flatten(child, depth + 1)),
  ]

  return (
    <main className="course-home" aria-labelledby="course-heading">
      {status === 'loading' ? <p className="course-home__loading">Loading the syllabus.</p> : null}

      {status === 'error' ? (
        <section className="course-home__error" role="alert">
          <h1 id="course-heading" className="course-home__title">
            Course
          </h1>
          <p>{problem}</p>
          <button type="button" className="course-home__retry" onClick={() => setReloads((n) => n + 1)}>
            Try again
          </button>
        </section>
      ) : null}

      {data && status === 'ready' ? (
        <>
          <header className="course-home__head">
            <h1 id="course-heading" className="course-home__title">
              {data.course.title}
            </h1>
            <p className="course-home__facts mono">
              {[
                data.course.examDate ? `Exam ${data.course.examDate}` : 'No exam date set',
                data.course.targetGrade ? `target ${data.course.targetGrade}` : null,
                `Pack ${data.course.syllabus} ${data.course.packVersion}`,
                data.course.countdown,
              ]
                .filter((x): x is string => x !== null)
                .join(' · ')}
            </p>
            {data.papers.length > 0 ? (
              <div className="course-home__rings">
                {data.papers.map((p) => (
                  <ReadinessRing
                    key={p.paper}
                    paper={paperName(p.paper)}
                    percent={p.pointsSeen === 0 ? null : p.readiness * 100}
                    sample={p.sampleSize}
                    reason={`${p.pointsSeen} of ${p.pointCount} points attempted`}
                  />
                ))}
              </div>
            ) : (
              <p className="course-home__note">This pack lists no papers, so there is no readiness figure to show.</p>
            )}
          </header>

          <section className="course-home__filters">
            <h2 className="sr">Filter the syllabus</h2>
            <div className="course-home__chips" role="group" aria-label="Syllabus filters">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="course-home__chip"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="course-home__filter-note">
              {filter === 'all'
                ? `Every point in the pack: ${data.counts.points} points, ${data.counts.items} questions, ${data.counts.marksAvailable} marks. ${data.counts.pointsSeen} attempted.`
                : `${FILTERS.find((f) => f.id === filter)?.note.replace('&rsquo;', '’')}. ${filtered.length} of ${data.counts.points} points.`}
            </p>
          </section>

          <section className="course-home__tree" aria-label="Syllabus points">
            {filter === 'all' ? (
              data.tree.map((topic) => {
                const open = openTopics.includes(topic.code)
                const children = topic.children.flatMap((child) => flatten(child, 0))
                return (
                  <section key={topic.code} className="course-home__topic">
                    <h2 className="course-home__topic-head">
                      <button
                        type="button"
                        className="course-home__topic-button"
                        aria-expanded={open}
                        onClick={() => toggleTopic(topic.code)}
                      >
                        <span className="course-home__caret mono" aria-hidden="true">
                          {open ? '▾' : '▸'}
                        </span>
                        <MasteryPip
                          state={stateOf(topic)}
                          figure={`${topic.code} ${topic.title}`}
                          reason={reasonFor(topic)}
                        />
                        <span className="course-home__topic-code mono">{topic.code}</span>
                        <span className="course-home__topic-title">{topic.title}</span>
                        <span className="course-home__topic-count mono">
                          {children.length} {children.length === 1 ? 'point' : 'points'}
                        </span>
                      </button>
                    </h2>
                    {open ? (
                      children.length > 0 ? (
                        <ul className="course-home__points">{children.map(pointRow)}</ul>
                      ) : (
                        <ul className="course-home__points">{pointRow({ row: topic, depth: 0 })}</ul>
                      )
                    ) : null}
                  </section>
                )
              })
            ) : filtered.length === 0 ? (
              <p className="course-home__note">
                No point matches that filter. Switch back to the whole syllabus to see everything.
              </p>
            ) : (
              <ul className="course-home__points course-home__points--flat">
                {filtered.map((row) => pointRow({ row, depth: 0 }))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  )
}

export default CourseHome
