'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Rating, type Rating as RatingValue } from '@atlas/learning';
import { business9609 } from '@atlas/content';
import { useStudy } from '@/lib/study';
import { formatDuration } from '@/lib/format';

type Phase = 'question' | 'revealed';

const GRADES: { rating: RatingValue; name: string; key: string }[] = [
  { rating: Rating.Again, name: 'Again', key: '1' },
  { rating: Rating.Hard, name: 'Hard', key: '2' },
  { rating: Rating.Good, name: 'Good', key: '3' },
  { rating: Rating.Easy, name: 'Easy', key: '4' },
];

export default function ReviewPage() {
  const study = useStudy();
  const { session, scheduler, settings, record } = study;

  // The queue is frozen when the session starts. Re-deriving it on every answer
  // would reshuffle the deck under the learner's feet.
  const [queue, setQueue] = useState<string[] | null>(null);
  const [position, setPosition] = useState(0);
  const [phase, setPhase] = useState<Phase>('question');
  const [confidence, setConfidence] = useState(0.6);
  const [chosen, setChosen] = useState<number | null>(null);
  const [tally, setTally] = useState({ again: 0, good: 0 });
  const shownAt = useRef<number>(Date.now());

  useEffect(() => {
    if (queue === null && study.ready) setQueue(session.cards.map((c) => c.id));
  }, [queue, study.ready, session.cards]);

  const cardsById = useMemo(() => new Map(study.cards.map((c) => [c.id, c])), [study.cards]);

  const objectiveTitle = useMemo(() => {
    const map = new Map(business9609.nodes.map((n) => [n.id, n]));
    return (id: string) => {
      const node = map.get(id);
      return node ? `${node.code ? `${node.code} ` : ''}${node.title}` : id;
    };
  }, []);

  const currentId = queue?.[position];
  const card = currentId ? cardsById.get(currentId) : undefined;

  useEffect(() => {
    shownAt.current = Date.now();
    setPhase('question');
    setChosen(null);
    setConfidence(0.6);
  }, [currentId]);

  const reveal = useCallback(() => setPhase('revealed'), []);

  const grade = useCallback(
    async (rating: RatingValue) => {
      if (!card) return;
      const correct =
        card.item.type === 'mcq' && chosen !== null ? chosen === 0 : rating !== Rating.Again;
      await record({
        cardId: card.id,
        objectiveId: card.item.objectiveId,
        rating,
        latencyMs: Date.now() - shownAt.current,
        ...(settings.askConfidence ? { confidence } : {}),
        correct,
      });
      setTally((t) =>
        rating === Rating.Again ? { ...t, again: t.again + 1 } : { ...t, good: t.good + 1 },
      );
      setPosition((p) => p + 1);
    },
    [card, chosen, confidence, record, settings.askConfidence],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (phase === 'question') {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          reveal();
        }
        return;
      }
      const match = GRADES.find((g) => g.key === event.key);
      if (match) {
        event.preventDefault();
        void grade(match.rating);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, reveal, grade]);

  if (!study.ready || queue === null) return <div className="empty">Loading…</div>;

  if (queue.length === 0) {
    return (
      <div className="review-wrap">
        <div className="empty">
          <div className="big">Nothing is due.</div>
          <p>
            The scheduler is holding your cards back on purpose — reviewing before you are
            close to forgetting buys very little.
          </p>
          <Link className="btn" href="/">
            Back to Today
          </Link>
        </div>
      </div>
    );
  }

  if (!card) {
    const total = tally.again + tally.good;
    return (
      <div className="review-wrap">
        <div className="empty">
          <div className="big">
            Session done — {total} {total === 1 ? 'item' : 'items'}.
          </div>
          <p>
            {tally.again === 0
              ? 'Everything recalled. Those intervals just grew.'
              : `${tally.again} came back as "Again". Those return within minutes, not days — which is exactly what they are for.`}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <Link className="btn btn-primary" href="/">
              Back to Today
            </Link>
            <Link className="btn" href="/map">
              See the syllabus map
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const item = card.item;
  const options =
    item.type === 'mcq' && item.distractors
      ? stableShuffle(
          [
            { text: item.answer, correct: true, correction: null as string | null },
            ...item.distractors.map((d) => ({
              text: d.text,
              correct: false,
              correction: d.correction,
            })),
          ],
          item.id,
        )
      : null;
  const correctIndex = options ? options.findIndex((o) => o.correct) : -1;
  const progress = ((position + (phase === 'revealed' ? 0.5 : 0)) / queue.length) * 100;

  return (
    <div className="review-wrap">
      <div className="review-meta">
        <span>
          {position + 1} / {queue.length}
        </span>
        <span className="progress-track">
          <span className="progress-fill" style={{ width: `${progress}%` }} />
        </span>
        <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
          End
        </Link>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="chip">{objectiveTitle(item.objectiveId)}</span>
          <span style={{ display: 'flex', gap: '0.3rem' }}>
            {item.aos.map((ao) => (
              <span key={ao} className="chip accent">
                {ao}
              </span>
            ))}
            {card.reviews === 0 && <span className="chip good">new</span>}
          </span>
        </div>

        <div className="prompt">{item.prompt}</div>

        {options && (
          <div className="choices">
            {options.map((option, index) => {
              const revealed = phase === 'revealed';
              const picked = chosen === (index === correctIndex ? 0 : index);
              const state = !revealed ? '' : option.correct ? ' correct' : picked ? ' wrong' : '';
              return (
                <button
                  key={option.text}
                  type="button"
                  className={`choice${state}`}
                  disabled={revealed}
                  onClick={() => {
                    setChosen(index === correctIndex ? 0 : index);
                    setPhase('revealed');
                  }}
                >
                  {option.text}
                  {revealed && picked && !option.correct && option.correction && (
                    <span className="misconception" style={{ display: 'block' }}>
                      {option.correction}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {phase === 'question' && !options && (
          <>
            {settings.askConfidence && (
              <div className="confidence">
                <div className="confidence-label">
                  <label htmlFor="confidence">How sure are you, before you look?</label>
                  <span>{Math.round(confidence * 100)}%</span>
                </div>
                <input
                  id="confidence"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(confidence * 100)}
                  onChange={(event) => setConfidence(Number(event.target.value) / 100)}
                />
              </div>
            )}
            <button type="button" className="btn btn-primary" onClick={reveal}>
              Show answer
            </button>
          </>
        )}

        {phase === 'revealed' && (
          <>
            {!options && <div className="answer">{item.answer}</div>}
            {item.working && <div className="working">{item.working}</div>}

            <div className="grades">
              {GRADES.map((g) => (
                <button
                  key={g.rating}
                  type="button"
                  className="grade"
                  onClick={() => void grade(g.rating)}
                >
                  <div className="g-name">
                    {g.name}
                    <kbd>{g.key}</kbd>
                  </div>
                  <div className="g-when">
                    {formatDuration(scheduler.review(card.memory, g.rating, Date.now(), card.id).intervalMs)}
                  </div>
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: '0.7rem' }}>
              Grade honestly — the interval under each button is what you are choosing, and an
              inflated grade is a card you will fail later.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Deterministic per-item shuffle: the correct answer is not always first, but the
 * same card always presents its options in the same order.
 */
function stableShuffle<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = (h >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
