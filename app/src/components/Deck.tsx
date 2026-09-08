import { useState } from 'react'
import { post } from '../lib/api'
import type { DeckArtefact } from '../lib/artefacts'
import './Deck.css'

export interface DeckProps {
  deck: DeckArtefact
  courseId?: string | null
  /** Told when the deck is kept, so the thread can say what happened to it. */
  onKept?(count: number): void
}

type Saving = 'idle' | 'saving' | 'kept' | 'error'

/**
 * A deck of cards, made in the conversation.
 *
 * It is a draft until the student keeps it: cards that are only looked at are not
 * scheduled, do not appear in the review queue, and do not pretend to be work done.
 * Keeping is one press, and it says what it did.
 */
export function Deck({ deck, courseId, onKept }: DeckProps) {
  const [turned, setTurned] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState<Saving>('idle')
  const [problem, setProblem] = useState<string | null>(null)
  const [kept, setKept] = useState(0)

  const turn = (index: number) => {
    setTurned(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const keep = async () => {
    setSaving('saving')
    setProblem(null)
    try {
      const body = {
        courseId: courseId ?? undefined,
        source: `chat:${deck.id}`,
        cards: deck.cards.map(card => ({
          front: card.front,
          back: card.back,
          syllabusPoint: card.syllabusPoint ?? undefined,
        })),
      }
      const saved = await post<{ created?: unknown[]; skipped?: unknown[] }>('/api/cards/bulk', body)
      const count = Array.isArray(saved.created) ? saved.created.length : deck.cards.length
      setKept(count)
      setSaving('kept')
      onKept?.(count)
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : 'The deck did not save. Try again.')
      setSaving('error')
    }
  }

  return (
    <section className="deck" aria-label={deck.topic ? `Cards on ${deck.topic}` : 'Cards'}>
      <header className="deck__head">
        <h3 className="deck__title">
          {deck.cards.length} card{deck.cards.length === 1 ? '' : 's'}
          {deck.topic ? <span className="deck__topic"> · {deck.topic}</span> : null}
        </h3>
        {deck.grounded && deck.grounded.length > 0 && (
          <p className="deck__grounded mono">
            {deck.grounded.map(point => `${point.code}${point.title ? ` ${point.title}` : ''}`).join(' · ')}
          </p>
        )}
      </header>

      <ol className="deck__list">
        {deck.cards.map((card, index) => {
          const open = turned.has(index)
          return (
            <li key={`${deck.id}-${index}`} className="deck__card">
              <button
                type="button"
                className="deck__face"
                aria-expanded={open}
                onClick={() => turn(index)}
              >
                <span className="deck__front read">{card.front}</span>
                <span className="deck__turn mono">{open ? 'hide' : 'show'}</span>
              </button>
              {open && (
                <div className="deck__back read">
                  {card.back}
                  {card.syllabusPoint ? <span className="deck__point mono">{card.syllabusPoint}</span> : null}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {deck.warnings && deck.warnings.length > 0 && (
        <ul className="deck__warnings">
          {deck.warnings.map((warning, i) => <li key={i}>{warning}</li>)}
        </ul>
      )}

      <div className="deck__actions">
        {saving === 'kept' ? (
          <p className="deck__kept" role="status">
            {kept} card{kept === 1 ? '' : 's'} kept — they are in your review queue now.{' '}
            <a className="deck__link" href="#/cards">Open cards</a>
          </p>
        ) : (
          <button
            type="button"
            className="deck__keep"
            onClick={() => void keep()}
            disabled={saving === 'saving'}
          >
            {saving === 'saving' ? 'Keeping…' : 'Keep these cards'}
          </button>
        )}
        {problem && <p className="deck__problem" role="alert">{problem}</p>}
      </div>
    </section>
  )
}
