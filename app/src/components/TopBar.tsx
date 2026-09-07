import type { Course, Health, Usage } from '../lib/api'
import { isDegraded } from '../lib/api'
import { setTheme, useStore } from '../lib/state'
import type { Theme } from '../lib/state'
import './TopBar.css'

export interface TopBarProps {
  courses: Course[]
  course: Course | null
  onSelectCourse: (courseId: string) => void
  /** null while /api/health is still in flight. */
  health: Health | null
  /** Server-side usage when the API offers it; otherwise this session's own tally. */
  usage: Usage | null
  onMenu: () => void
  navOpen: boolean
}

const DAY = 86_400_000

/** Whole days from today to the exam, negative once it has gone. */
export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null
  const exam = new Date(isoDate)
  if (Number.isNaN(exam.getTime())) return null
  const startOfExamDay = Date.UTC(exam.getUTCFullYear(), exam.getUTCMonth(), exam.getUTCDate())
  const today = new Date()
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.round((startOfExamDay - startOfToday) / DAY)
}

/** §04.13 phases: A beyond eight weeks, B from eight to three, C inside three. */
export function phaseFor(days: number | null): 'A' | 'B' | 'C' | null {
  if (days === null || days < 0) return null
  if (days > 56) return 'A'
  if (days >= 21) return 'B'
  return 'C'
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function formatExamDate(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function money(value: number): string {
  return value < 0.01 && value > 0 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`
}

export function TopBar({ courses, course, onSelectCourse, health, usage, onMenu, navOpen }: TopBarProps) {
  const { theme, usage: local } = useStore()
  // The server computes the countdown; the local fallback keeps the bar honest
  // if a course arrives without one.
  const days = course?.daysToExam ?? daysUntil(course?.examDate ?? null)
  const phase = course?.phase ?? phaseFor(days)
  const degraded = isDegraded(health)
  const examLabel = course?.examDate ? formatExamDate(course.examDate) : ''

  const turns = usage?.turns ?? local.turns
  const marks = usage?.marks ?? local.marks
  const cost = usage?.cost_usd ?? local.costUsd

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__menu"
        onClick={onMenu}
        aria-expanded={navOpen}
        aria-controls="shell-nav"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" aria-hidden="true" focusable="false">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <span className="sr">{navOpen ? 'Hide navigation' : 'Show navigation'}</span>
      </button>

      <a className="topbar__wordmark" href="#/today">Margin</a>

      <label className="sr" htmlFor="topbar-course">Course</label>
      <select
        id="topbar-course"
        className="topbar__course"
        value={course?.id ?? ''}
        onChange={event => onSelectCourse(event.target.value)}
        disabled={courses.length === 0}
      >
        {courses.length === 0 && <option value="">No course yet</option>}
        {courses.map(option => (
          <option key={option.id} value={option.id}>{option.syllabus} · {option.title}</option>
        ))}
      </select>

      <p className="topbar__exam mono">
        {days === null ? (
          <span className="topbar__exam-none">Exam date not set</span>
        ) : days < 0 ? (
          <>
            <span aria-hidden="true">Exam sat</span>
            <span className="sr">The exam date has passed.</span>
          </>
        ) : (
          <>
            <span aria-hidden="true">{days} {days === 1 ? 'day' : 'days'} · Phase {phase}</span>
            <span className="sr">
              {days} {days === 1 ? 'day' : 'days'} until the exam on {examLabel}, revision phase {phase}.
            </span>
          </>
        )}
      </p>

      <p className="topbar__usage mono">
        <span className="sr">Usage so far: </span>
        {turns} turns · {marks} marks · {money(cost)}
      </p>

      {health && degraded && (
        <p className="topbar__degraded" role="status">
          <span className="topbar__degraded-glyph" aria-hidden="true">!</span>
          Running on the built-in model — add an API key for full marking.
        </p>
      )}

      <div className="topbar__theme" role="group" aria-label="Theme">
        {THEMES.map(option => (
          <button
            key={option.value}
            type="button"
            className="topbar__theme-btn"
            aria-pressed={theme === option.value}
            onClick={() => setTheme(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </header>
  )
}
