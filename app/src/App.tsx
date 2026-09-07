import { Component, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Shell } from './components/Shell'
import { TopBar } from './components/TopBar'
import { api, get } from './lib/api'
import type { Course, Health, Mark, Usage } from './lib/api'
import { setCourse, store, toggleNav, useStore } from './lib/state'
import { Today } from './screens/Today'
import { CourseHome } from './screens/CourseHome'
import { Session } from './screens/Session'
import { Practise } from './screens/Practise'
import { MarkView } from './screens/MarkView'
import type { Mark as MarkObject } from './screens/MarkView'
import { Cards } from './screens/Cards'
import { Progress } from './screens/Progress'
import { Settings } from './screens/Settings'
import { Ask } from './screens/Ask'

/** Hash routing, no router package. "#/mark/mk_1?x=1" → "/mark/mk_1". */
function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, '').split('?')[0]
  if (!raw || raw === '/') return '/today'
  return raw.startsWith('/') ? raw : `/${raw}`
}

function useHashPath(): string {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const onChange = () => setPath(currentPath())
    window.addEventListener('hashchange', onChange)
    if (!window.location.hash) window.history.replaceState(null, '', '#/today')
    onChange()
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return path
}

/* --------------------------------------------------------------- boundary */

interface BoundaryProps { resetKey: string; children: ReactNode }
interface BoundaryState { error: Error | null }

class ScreenBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[margin] screen failed', error)
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="app__panel" role="alert">
        <h1 className="app__panel-title">This screen stopped working</h1>
        <p className="app__panel-text">{error.message || 'The screen threw an error while rendering.'}</p>
        <div className="app__panel-actions">
          <button type="button" className="app__btn" onClick={() => this.setState({ error: null })}>
            Try this screen again
          </button>
          <a className="app__link" href="#/today">Go to Today</a>
        </div>
      </div>
    )
  }
}

/* ----------------------------------------------------------------- routing */

/**
 * The Mark route loads a stored Mark and hands it to the Mark view, which owns
 * every state below this point (loading, error, the spans, the AO cards).
 */
function MarkRoute({ markId }: { markId: string }) {
  const [mark, setMark] = useState<Mark | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [problem, setProblem] = useState('')

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    setProblem('')
    get<Mark>(`/api/marks/${encodeURIComponent(markId)}`)
      .then(payload => {
        if (!live) return
        setMark(payload)
        setStatus('ready')
      })
      .catch((failure: unknown) => {
        if (!live) return
        setProblem(failure instanceof Error ? failure.message : 'That mark did not load.')
        setStatus('error')
      })
    return () => { live = false }
  }, [markId])

  useEffect(() => load(), [load])

  const body = (mark?.mark ?? null) as MarkObject | null
  const answer = typeof mark?.mark?.transcript?.text === 'string' ? mark.mark.transcript.text : ''

  return (
    <MarkView
      mark={status === 'ready' ? body : null}
      answer={answer}
      status={status === 'error' ? 'error' : status === 'loading' ? 'loading' : 'ready'}
      error={status === 'error' ? problem : null}
      onRetry={() => { load() }}
    />
  )
}

function screenFor(path: string, courseId: string | null): ReactNode {
  if (path.startsWith('/mark/')) {
    const markId = decodeURIComponent(path.slice('/mark/'.length))
    if (markId) return <MarkRoute markId={markId} />
  }
  const course = courseId ?? undefined
  const base = path.split('/')[1] ?? 'today'
  switch (base) {
    case 'today': return <Today courseId={course} />
    case 'course': return <CourseHome courseId={course} />
    case 'session': return <Session />
    case 'practise':
      return (
        <Practise
          courseId={course}
          onMarked={markId => { window.location.hash = `#/mark/${encodeURIComponent(markId)}` }}
        />
      )
    case 'cards': return <Cards courseId={course} />
    case 'progress': return <Progress courseId={course} />
    // The plan is the schedule for today and the days after it; Today owns that surface.
    case 'plan': return <Today courseId={course} />
    case 'ask': return <Ask />
    case 'settings': return <Settings courseId={course} />
    default:
      return (
        <div className="app__panel">
          <h1 className="app__panel-title">No screen at {path}</h1>
          <p className="app__panel-text">That address does not match anything in Margin.</p>
          <div className="app__panel-actions">
            <a className="app__link" href="#/today">Go to Today</a>
          </div>
        </div>
      )
  }
}

/* --------------------------------------------------------------------- app */

export function App() {
  const path = useHashPath()
  const { courseId, navOpen } = useStore()
  const [courses, setCourses] = useState<Course[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [bootError, setBootError] = useState('')

  const boot = useCallback(async () => {
    setStatus('loading')
    setBootError('')
    const [healthResult, coursesResult] = await Promise.allSettled([api.health(), api.courses()])

    if (healthResult.status === 'fulfilled') setHealth(healthResult.value)

    if (coursesResult.status === 'fulfilled') {
      const list = coursesResult.value
      setCourses(list)
      const saved = store.get().courseId
      const chosen = list.find(course => course.id === saved) ?? list[0]
      if (chosen && chosen.id !== saved) setCourse(chosen.id)
      setStatus('ready')
    } else {
      const reason = coursesResult.reason
      setBootError(reason instanceof Error ? reason.message : 'The course list did not load.')
      setStatus('error')
    }

    // Usage is optional: the meter falls back to this session's own tally.
    try { setUsage(await get<Usage>('/api/usage')) } catch { setUsage(null) }
  }, [])

  useEffect(() => { void boot() }, [boot])

  const course = courses.find(candidate => candidate.id === courseId) ?? null

  let content: ReactNode
  if (status === 'loading') {
    content = (
      <div className="app__panel" aria-live="polite">
        <p className="app__panel-text">Loading your courses.</p>
      </div>
    )
  } else if (status === 'error') {
    content = (
      <div className="app__panel" role="alert">
        <h1 className="app__panel-title">Margin could not load your courses</h1>
        <p className="app__panel-text">{bootError}</p>
        <div className="app__panel-actions">
          <button type="button" className="app__btn" onClick={() => void boot()}>Try again</button>
        </div>
      </div>
    )
  } else {
    content = screenFor(path, courseId)
  }

  return (
    <Shell
      path={path}
      courses={courses}
      course={course}
      topBar={
        <TopBar
          courses={courses}
          course={course}
          onSelectCourse={setCourse}
          health={health}
          usage={usage}
          onMenu={toggleNav}
          navOpen={navOpen}
        />
      }
    >
      <ScreenBoundary resetKey={path}>{content}</ScreenBoundary>
    </Shell>
  )
}
