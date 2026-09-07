import { useCallback, useEffect, useMemo, useState } from 'react'
import { get } from '../lib/api'
import { useStore } from '../lib/state'
import './Today.css'

/* The shapes /api/plan/today answers with. Kept beside the screen that reads them. */

interface CourseView {
  id: string
  title: string
  examDate: string | null
  daysToExam: number | null
  phase: string
  phaseLabel: string
  countdown: string
}

interface PlanItem {
  id: string
  syllabusPoint: string
  paper: string
  commandWord: string
  tariff: number
  expectedMinutes: number
}

interface PlanBlockView {
  kind: string
  title: string
  minutes: number
  count?: number
  reason: string
  reasons?: string[]
  points?: string[]
  /** The same syllabus points, named — codes are not something a student reads. */
  topics?: { code: string; title: string }[]
  cardIds?: string[]
  items?: PlanItem[]
  timed?: boolean
}

interface Goal {
  target: number
  done: number
  restDays: number
  unit: string
  line: string
}

interface TodayResponse {
  courseId: string
  course: CourseView
  date: string
  phase: string
  phaseNote: string
  daysToExam: number | null
  minutes: number
  plannedMinutes: number
  shortfall: number
  shortfallNote: string | null
  mix: { due: number; practise: number; new: number; timed: number }
  blocks: PlanBlockView[]
  goal: Goal
  quietHours: { from: string; to: string; quiet: boolean; line: string | null }
}

/* ------------------------------------------------------- local preferences */

interface QuietPref { on: boolean; start: string; end: string }

function readQuietPref(): QuietPref {
  const fallback: QuietPref = { on: true, start: '22:00', end: '07:00' }
  try {
    const raw = window.localStorage.getItem('margin.settings')
    if (!raw) return fallback
    const saved = JSON.parse(raw) as Record<string, unknown>
    return {
      on: saved.quietHoursOn !== false,
      start: typeof saved.quietStart === 'string' ? saved.quietStart : fallback.start,
      end: typeof saved.quietEnd === 'string' ? saved.quietEnd : fallback.end,
    }
  } catch {
    return fallback
  }
}

const minutesOfDay = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1
}

/** True inside the quiet window, which may wrap past midnight. */
export function insideQuietHours(at: Date, quiet: QuietPref): boolean {
  if (!quiet.on) return false
  const start = minutesOfDay(quiet.start)
  const end = minutesOfDay(quiet.end)
  if (start < 0 || end < 0) return false
  const minute = at.getHours() * 60 + at.getMinutes()
  return start <= end ? minute >= start && minute < end : minute >= start || minute < end
}

/* --------------------------------------------------- what the student ticked */

const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function readDone(): string[] {
  try {
    const raw = window.localStorage.getItem('margin.today.done')
    const saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    const list = saved[dayKey(new Date())]
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeDone(ids: string[]): void {
  try {
    const raw = window.localStorage.getItem('margin.today.done')
    const saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    saved[dayKey(new Date())] = ids
    window.localStorage.setItem('margin.today.done', JSON.stringify(saved))
  } catch {
    /* No storage: the ticks last for this visit, which is all they are for. */
  }
}

/* ----------------------------------------------------------------- helpers */

const KIND_LABEL: Record<string, string> = {
  due: 'Retrieval',
  practise: 'Practice',
  new: 'New material',
  timed: 'Timed',
  marked: 'Marked',
}

const KIND_ACTION: Record<string, string> = {
  due: 'Review the cards',
  practise: 'Start practising',
  new: 'Start this point',
  timed: 'Start the timed section',
  marked: 'Answer and be marked',
}

function hrefFor(block: PlanBlockView): string {
  return block.kind === 'due' ? '#/cards' : '#/practise'
}

function blockId(block: PlanBlockView, index: number): string {
  return `${block.kind}-${index}`
}

function mixLine(data: TodayResponse): string {
  const parts: string[] = []
  const push = (share: number, word: string) => {
    if (share > 0) parts.push(`${Math.round(share * 100)}% ${word}`)
  }
  push(data.mix.due, 'due retrieval')
  push(data.mix.practise, 'interleaved practice')
  push(data.mix.new, 'new material')
  push(data.mix.timed, 'timed work')
  const shape = parts.length > 0 ? `Today's mix: ${parts.join(' · ')}. ` : ''
  return `${shape}${data.phaseNote}`
}

const DATE_LINE = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

/* -------------------------------------------------------------------- view */

export interface TodayProps {
  /** Overrides the course the shell has selected. The shell passes none. */
  courseId?: string
}

export function Today({ courseId }: TodayProps) {
  const store = useStore()
  const course = courseId ?? store.courseId
  const [data, setData] = useState<TodayResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [problem, setProblem] = useState('')
  const [done, setDone] = useState<string[]>(() => readDone())
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let live = true
    setStatus('loading')
    const query = course ? `?courseId=${encodeURIComponent(course)}` : ''
    get<TodayResponse>(`/api/plan/today${query}`)
      .then((payload) => {
        if (!live) return
        setData(payload)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!live) return
        setProblem(error instanceof Error ? error.message : 'The plan did not load.')
        setStatus('error')
      })
    return () => {
      live = false
    }
  }, [course, reloads])

  const toggle = useCallback(
    (id: string) => {
      const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id]
      setDone(next)
      writeDone(next)
    },
    [done],
  )

  const now = useMemo(() => new Date(), [reloads])
  const quietPref = useMemo(() => readQuietPref(), [reloads])
  const quiet = insideQuietHours(now, quietPref) || data?.quietHours.quiet === true
  const quietFrom = quietPref.on ? quietPref.start : (data?.quietHours.from ?? '22:00')

  const blocks = data?.blocks ?? []
  const doneCount = blocks.filter((b, i) => done.includes(blockId(b, i))).length
  const allDone = blocks.length > 0 && doneCount === blocks.length
  const doneMinutes = blocks
    .filter((b, i) => done.includes(blockId(b, i)))
    .reduce((sum, b) => sum + b.minutes, 0)

  const planList = (
    <ol className="today__blocks">
      {blocks.map((block, index) => {
        const id = blockId(block, index)
        const ticked = done.includes(id)
        const label = KIND_LABEL[block.kind] ?? block.title
        return (
          <li key={id} className={`today__block${ticked ? ' today__block--done' : ''}`}>
            <p className="today__kind mono">{label}</p>
            <p className="today__minutes mono">
              {block.minutes} min
              {block.count != null ? ` · ${block.count} cards` : ''}
              {block.items != null && block.items.length > 0
                ? ` · ${block.items.length} ${block.items.length === 1 ? 'question' : 'questions'}`
                : ''}
            </p>
            <h2 className="today__block-title">{block.title}</h2>
            <p className="today__why">{block.reason}</p>
            {block.topics && block.topics.length > 0 ? (
              <p className="today__points">
                {block.topics.map(t => t.title).join(' · ')}
              </p>
            ) : null}
            <div className="today__block-actions">
              <a className="today__go" href={hrefFor(block)}>
                {KIND_ACTION[block.kind] ?? 'Open'}
              </a>
              <button type="button" className="today__done" aria-pressed={ticked} onClick={() => toggle(id)}>
                {ticked ? 'Done' : 'Mark done'}
              </button>
            </div>
          </li>
        )
      })}
    </ol>
  )

  return (
    <main className="today" aria-labelledby="today-heading">
      <header className="today__head">
        <h1 id="today-heading" className="today__heading">
          Today
        </h1>
        <p className="today__date mono">
          {DATE_LINE.format(now)}
          {data ? ` · ${data.course.countdown}` : ''}
        </p>
        {data && data.blocks.length > 0 ? (
          <p className="today__note">
            {data.minutes} minutes across {data.blocks.length} {data.blocks.length === 1 ? 'block' : 'blocks'}
            {data.plannedMinutes !== data.minutes ? `, against ${data.plannedMinutes} planned` : ''}.
          </p>
        ) : null}
        {data?.shortfallNote ? <p className="today__note">{data.shortfallNote}</p> : null}
      </header>

      {quiet ? (
        <section className="today__quiet" aria-labelledby="today-quiet-heading">
          <h2 id="today-quiet-heading" className="today__quiet-heading">
            It is past {quietFrom}. Stop for tonight.
          </h2>
          <p className="today__quiet-line">
            {data?.quietHours.line ??
              'Sleep does the consolidation that another hour of practice will not. Nothing here is due before morning.'}
          </p>
          <details className="today__quiet-more">
            <summary>Show tonight&rsquo;s plan anyway</summary>
            {status === 'ready' ? planList : <p className="today__note">Loading the plan.</p>}
          </details>
        </section>
      ) : null}

      {!quiet && status === 'loading' ? (
        <ol className="today__blocks" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="today__block today__block--skeleton" />
          ))}
        </ol>
      ) : null}

      {!quiet && status === 'error' ? (
        <section className="today__error" role="alert">
          <p>{problem}</p>
          <p>Your cards and your syllabus still work while the scheduler is down.</p>
          <div className="today__block-actions">
            <button type="button" className="today__done" onClick={() => setReloads((n) => n + 1)}>
              Try again
            </button>
            <a className="today__link" href="#/cards">
              Go to cards
            </a>
          </div>
        </section>
      ) : null}

      {!quiet && status === 'ready' ? (
        blocks.length > 0 ? (
          planList
        ) : (
          <section className="today__empty">
            <p>
              Nothing is scheduled today. That is the plan and not a gap: there is no card due and no question
              waiting on a point you have opened.
            </p>
            <a className="today__go" href="#/course">
              Pick a syllabus point to start
            </a>
          </section>
        )
      ) : null}

      {allDone ? (
        <p className="today__celebration" role="status">
          The plan is finished: {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}, {doneMinutes} minutes.
        </p>
      ) : null}

      {data && !quiet ? <p className="today__mix">{mixLine(data)}</p> : null}

      {data ? (
        <section className="today__goal" aria-labelledby="today-goal-heading">
          <h2 id="today-goal-heading" className="today__goal-heading">
            This week
          </h2>
          <p className="today__goal-line">
            {data.goal.done} of {data.goal.target} study days, with {data.goal.restDays} rest{' '}
            {data.goal.restDays === 1 ? 'day' : 'days'} in the week. A week you miss is not carried into the next one.
          </p>
          <span className="today__discs" aria-hidden="true">
            {Array.from({ length: data.goal.target }, (_, i) => (
              <span key={`goal-${i}`} className={`today__disc${i < data.goal.done ? ' today__disc--filled' : ''}`} />
            ))}
            {Array.from({ length: data.goal.restDays }, (_, i) => (
              <span key={`rest-${i}`} className="today__disc today__disc--rest" />
            ))}
          </span>
        </section>
      ) : null}
    </main>
  )
}

export default Today
