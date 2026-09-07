import { useCallback, useEffect, useRef, useState } from 'react'
import { get, post } from '../lib/api'
import { useStore } from '../lib/state'
import './Cards.css'

/* ------------------------------------------------ what the endpoints answer */

interface CardView {
  id: string
  courseId: string
  syllabusPoint: string
  front: string
  back: string
  source: string
  provenance: string
  due: string
  overdueDays: number
  reps: number
  lapses: number
  isNew: boolean
  isRetest: boolean
  courseTitle: string | null
}

interface ReviewResult {
  id: string
  grade: string
  due: string
  intervalDays: number
  remainingDue: number
  line: string
}

type Grade = 'again' | 'good'

export interface CardsProps {
  /** Overrides the course the shell has selected. The shell passes none. */
  courseId?: string
}

export function Cards({ courseId }: CardsProps) {
  const store = useStore()
  const course = courseId ?? store.courseId
  const [queue, setQueue] = useState<CardView[]>([])
  const [dueAtStart, setDueAtStart] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [problem, setProblem] = useState('')
  const [showBack, setShowBack] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [again, setAgain] = useState(0)
  const [lastLine, setLastLine] = useState('')
  const [saveProblem, setSaveProblem] = useState('')
  const [reloads, setReloads] = useState(0)
  const busy = useRef(false)

  useEffect(() => {
    let live = true
    setStatus('loading')
    const query = course ? `?courseId=${encodeURIComponent(course)}` : ''
    get<CardView[]>(`/api/cards/due${query}`)
      .then((cards) => {
        if (!live) return
        const list = Array.isArray(cards) ? cards : []
        setQueue(list)
        setDueAtStart(list.length)
        setReviewed(0)
        setAgain(0)
        setShowBack(false)
        setLastLine('')
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!live) return
        setProblem(error instanceof Error ? error.message : 'The due queue did not load.')
        setStatus('error')
      })
    return () => {
      live = false
    }
  }, [course, reloads])

  const card = queue[0] ?? null

  const grade = useCallback(
    (rating: Grade) => {
      if (!card || busy.current) return
      busy.current = true
      const graded = card
      setQueue((q) => (rating === 'again' ? [...q.slice(1), graded] : q.slice(1)))
      setShowBack(false)
      setReviewed((n) => n + 1)
      if (rating === 'again') setAgain((n) => n + 1)
      post<ReviewResult>(`/api/cards/${encodeURIComponent(graded.id)}/review`, { grade: rating })
        .then((result) => {
          setSaveProblem('')
          setLastLine(result.line)
        })
        .catch((error: unknown) => {
          setLastLine('')
          setSaveProblem(
            error instanceof Error
              ? `${error.message} That grade counts for this session only.`
              : 'That grade did not reach the server. It counts for this session only.',
          )
        })
        .finally(() => {
          busy.current = false
        })
    },
    [card],
  )

  const flip = useCallback(() => setShowBack((v) => !v), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (!card) return
      if (event.key === ' ') {
        event.preventDefault()
        flip()
      } else if (showBack && event.key === '1') {
        event.preventDefault()
        grade('again')
      } else if (showBack && event.key === '2') {
        event.preventDefault()
        grade('good')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, showBack, flip, grade])

  const left = queue.length
  const progress =
    dueAtStart === 0
      ? 'Nothing due'
      : `${dueAtStart} due when you started · ${left} left · ${reviewed} reviewed${again > 0 ? ` · ${again} sent round again` : ''}`

  return (
    <main className="cards" aria-labelledby="cards-heading">
      <header className="cards__head">
        <h1 id="cards-heading" className="cards__heading">
          Cards
        </h1>
        <p className="cards__progress mono" role="status">
          {progress}
        </p>
      </header>

      {status === 'loading' ? <p className="cards__note">Loading the due queue.</p> : null}

      {status === 'error' ? (
        <section className="cards__panel" role="alert">
          <p>{problem}</p>
          <p>No card has been marked reviewed.</p>
          <button type="button" className="cards__button" onClick={() => setReloads((n) => n + 1)}>
            Try again
          </button>
        </section>
      ) : null}

      {saveProblem ? (
        <p className="cards__warn" role="status">
          {saveProblem}
        </p>
      ) : null}

      {status === 'ready' && card ? (
        <section className="cards__card">
          <div className="cards__body" aria-live="polite">
            <p className="cards__face read">{card.front}</p>
            {showBack ? (
              <>
                <hr className="cards__rule" />
                <p className="cards__back read">{card.back}</p>
              </>
            ) : null}
          </div>
          <p className="cards__provenance">
            {card.provenance}
            {card.isNew ? ' · first time you have seen this card' : ''}
            {!card.isNew && card.overdueDays > 0 ? ` · ${card.overdueDays} days overdue` : ''}
          </p>
          {showBack ? (
            <div className="cards__grades">
              <button type="button" className="cards__button" onClick={() => grade('again')}>
                Again <span className="cards__key mono">1</span>
              </button>
              <button type="button" className="cards__button cards__button--primary" onClick={() => grade('good')}>
                Good <span className="cards__key mono">2</span>
              </button>
            </div>
          ) : (
            <div className="cards__grades">
              <button type="button" className="cards__button cards__button--primary" onClick={flip}>
                Show the back <span className="cards__key mono">Space</span>
              </button>
            </div>
          )}
          <p className="cards__hint">
            Space turns the card over. 1 brings it back before you finish; 2 schedules it further out.
          </p>
          {lastLine ? (
            <p className="cards__last mono" role="status">
              {lastLine}
            </p>
          ) : null}
        </section>
      ) : null}

      {status === 'ready' && !card ? (
        <section className="cards__panel">
          {reviewed > 0 ? (
            <>
              <h2 className="cards__done-heading">The queue is empty.</h2>
              <p>
                {reviewed} {reviewed === 1 ? 'review' : 'reviews'} done
                {again > 0 ? `, ${again} of them a second look` : ''}. Nothing else is due today.
              </p>
            </>
          ) : (
            <>
              <h2 className="cards__done-heading">No cards are due.</h2>
              <p>
                Cards are written when your work is marked, so an empty queue means the marking has caught up — not
                that there is nothing worth doing.
              </p>
            </>
          )}
          <div className="cards__next">
            <a className="cards__go" href="#/practise">
              Answer a question instead
            </a>
            <a className="cards__link" href="#/today">
              Back to today
            </a>
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default Cards
