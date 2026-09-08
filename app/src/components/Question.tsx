import { TariffPill } from './TariffPill'
import type { QuestionArtefact } from '../lib/artefacts'
import './Question.css'

export interface QuestionProps {
  question: QuestionArtefact
  /** True while this is the question the composer is answering. */
  answering: boolean
  /** Take this question up, or put it down. */
  onAnswer(): void
  onDrop(): void
}

/**
 * An exam question, set in the conversation.
 *
 * It is the real question at its real tariff, with its case material, because a
 * question shown at less than its tariff teaches a student to under-write. Taking it
 * up binds the thread to it, so what they write next goes through the gate, the
 * ladder and the mark scheme rather than being chatted about.
 */
export function Question({ question, answering, onAnswer, onDrop }: QuestionProps) {
  return (
    <section
      className={answering ? 'question question--answering' : 'question'}
      aria-label={`Question worth ${question.tariff ?? 0} marks`}
    >
      <header className="question__head">
        <TariffPill tariff={question.tariff ?? 0} commandWord={question.commandWord ?? null} />
        <span className="question__where mono">
          {question.paper ? `Paper ${question.paper}` : null}
          {question.paper && question.syllabusPoint ? ' · ' : null}
          {question.syllabusPoint}
        </span>
      </header>

      {question.stimulus ? (
        <details className="question__stimulus">
          <summary className="question__stimulus-summary">The case material</summary>
          <div className="question__stimulus-body read">{question.stimulus}</div>
        </details>
      ) : null}

      <p className="question__stem read">{question.stem}</p>

      <div className="question__actions">
        {answering ? (
          <>
            <span className="question__live mono" role="status">Answering this</span>
            <button type="button" className="question__drop" onClick={onDrop}>Put it down</button>
          </>
        ) : (
          <button type="button" className="question__take" onClick={onAnswer}>Answer this</button>
        )}
      </div>
    </section>
  )
}
