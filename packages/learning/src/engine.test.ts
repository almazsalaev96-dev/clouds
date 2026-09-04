import { describe, expect, it } from 'vitest';
import { adjacentRepeats, buildSession, interleave, type SchedulableCard } from './session.js';
import { assessMastery, newMastery, probabilityCorrect, updateMastery } from './mastery.js';
import { calibration } from './calibration.js';
import { examUrgency, prioritise } from './priority.js';
import { CardState, MS_PER_DAY, type MemoryState } from './types.js';

const T0 = Date.UTC(2026, 0, 1, 9, 0, 0);
const day = (n: number) => T0 + n * MS_PER_DAY;

function card(id: string, topicId: string, memory: Partial<MemoryState> = {}, weight?: number): SchedulableCard {
  return {
    id,
    topicId,
    weight,
    memory: {
      state: CardState.Review,
      step: null,
      stability: 10,
      difficulty: 5,
      lastReview: day(-10),
      due: day(-1),
      ...memory,
    },
  };
}

describe('buildSession', () => {
  it('takes due cards first and caps new ones', () => {
    const cards = [
      ...Array.from({ length: 8 }, (_, i) => card(`d${i}`, `t${i % 3}`)),
      ...Array.from({ length: 8 }, (_, i) =>
        card(`n${i}`, `t${i % 3}`, { stability: null, difficulty: null, lastReview: null, due: T0 }),
      ),
    ];
    const plan = buildSession(cards, { now: T0, limit: 10, newCardLimit: 2 });
    expect(plan.counts.due).toBe(8);
    expect(plan.counts.new).toBe(2);
    expect(plan.counts.total).toBe(10);
  });

  it('never introduces new cards beyond the session limit', () => {
    const cards = Array.from({ length: 20 }, (_, i) =>
      card(`n${i}`, `t${i % 4}`, { stability: null, difficulty: null, lastReview: null, due: T0 }),
    );
    const plan = buildSession(cards, { now: T0, limit: 5, newCardLimit: 100 });
    expect(plan.counts.total).toBe(5);
  });

  it('excludes cards that are not yet due', () => {
    const plan = buildSession([card('a', 't1', { due: day(5) })], { now: T0, limit: 10, newCardLimit: 0 });
    expect(plan.counts.total).toBe(0);
  });

  it('reports the backlog it could not fit', () => {
    const cards = Array.from({ length: 30 }, (_, i) => card(`d${i}`, `t${i % 3}`));
    const plan = buildSession(cards, { now: T0, limit: 10 });
    expect(plan.backlog).toBe(20);
  });

  it('prioritises the card that is most overdue relative to its own stability', () => {
    // Both two days late, but a 2-day card is far more at risk than a 200-day card.
    const fragile = card('fragile', 't1', { stability: 2, due: day(-2) });
    const durable = card('durable', 't2', { stability: 200, due: day(-2) });
    const plan = buildSession([durable, fragile], { now: T0, limit: 2, newCardLimit: 0 });
    expect(plan.cards[0]?.id).toBe('fragile');
  });

  it('interleaves topics rather than blocking them', () => {
    const cards = [
      card('a1', 'algebra'), card('a2', 'algebra'), card('a3', 'algebra'),
      card('b1', 'trig'), card('b2', 'trig'), card('b3', 'trig'),
    ];
    const plan = buildSession(cards, { now: T0, limit: 6, newCardLimit: 0 });
    expect(adjacentRepeats(plan.cards)).toBe(0);
  });
});

describe('interleave', () => {
  it('leaves short lists alone', () => {
    const items = [{ topicId: 'a' }, { topicId: 'a' }];
    expect(interleave(items)).toEqual(items);
  });

  it('is a no-op at strength 0 (blocked practice)', () => {
    const items = [{ topicId: 'a' }, { topicId: 'a' }, { topicId: 'b' }];
    expect(interleave(items, 0)).toEqual(items);
  });

  it('keeps every item exactly once', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ topicId: `t${i % 4}`, id: i }));
    const out = interleave(items);
    expect(out).toHaveLength(25);
    expect(new Set(out.map((o) => o.id)).size).toBe(25);
  });

  it('cannot avoid repeats when only one topic is left', () => {
    const items = [{ topicId: 'a' }, { topicId: 'a' }, { topicId: 'a' }];
    expect(adjacentRepeats(interleave(items))).toBe(2);
  });
});

describe('mastery', () => {
  it('starts at a coin flip', () => {
    expect(probabilityCorrect(newMastery('o1').ability)).toBeCloseTo(0.5, 6);
  });

  it('rises with correct answers and falls with wrong ones', () => {
    let up = newMastery('o1');
    let down = newMastery('o1');
    for (let i = 0; i < 6; i++) {
      up = updateMastery(up, { correct: true, at: day(i) });
      down = updateMastery(down, { correct: false, at: day(i) });
    }
    expect(up.ability).toBeGreaterThan(0);
    expect(down.ability).toBeLessThan(0);
  });

  it('refuses to call it mastery without spacing — the anti-cram rule', () => {
    let state = newMastery('o1');
    for (let i = 0; i < 12; i++) {
      state = updateMastery(state, { correct: true, at: T0 + i * 60_000 }); // all one sitting
    }
    const verdict = assessMastery(state);
    expect(verdict.probability).toBeGreaterThan(0.85);
    expect(verdict.mastered).toBe(false);
    expect(verdict.reason).toMatch(/another day/);
  });

  it('grants mastery once the same evidence is spread across days', () => {
    let state = newMastery('o1');
    for (let i = 0; i < 12; i++) state = updateMastery(state, { correct: true, at: day(i) });
    expect(assessMastery(state).mastered).toBe(true);
  });

  it('needs a minimum number of attempts however good they look', () => {
    let state = newMastery('o1');
    state = updateMastery(state, { correct: true, at: day(0) });
    state = updateMastery(state, { correct: true, at: day(1) });
    expect(assessMastery(state).reason).toMatch(/more attempts/);
  });

  it('credits harder items more than easy ones', () => {
    const hard = updateMastery(newMastery('o1'), { correct: true, itemDifficulty: 2, at: T0 });
    const easy = updateMastery(newMastery('o1'), { correct: true, itemDifficulty: -2, at: T0 });
    expect(hard.ability).toBeGreaterThan(easy.ability);
  });

  it('deduplicates several attempts on the same day', () => {
    let state = newMastery('o1');
    state = updateMastery(state, { correct: true, at: T0 });
    state = updateMastery(state, { correct: true, at: T0 + 3_600_000 });
    expect(state.practiceDays).toHaveLength(1);
    expect(state.attempts).toBe(2);
  });
});

describe('calibration', () => {
  it('reports insufficient data below the threshold', () => {
    expect(calibration([{ confidence: 0.9, correct: true }]).verdict).toBe('insufficient-data');
  });

  it('detects overconfidence', () => {
    const obs = Array.from({ length: 20 }, (_, i) => ({ confidence: 0.9, correct: i < 10 }));
    const report = calibration(obs);
    expect(report.verdict).toBe('overconfident');
    expect(report.bias).toBeCloseTo(0.4, 6);
  });

  it('detects underconfidence', () => {
    const obs = Array.from({ length: 20 }, (_, i) => ({ confidence: 0.4, correct: i < 18 }));
    expect(calibration(obs).verdict).toBe('underconfident');
  });

  it('calls a well-matched learner well-calibrated', () => {
    const obs = Array.from({ length: 20 }, (_, i) => ({ confidence: 0.8, correct: i < 16 }));
    const report = calibration(obs);
    expect(report.verdict).toBe('well-calibrated');
    expect(report.brier).toBeCloseTo(0.16, 6);
  });

  it('scores a perfect forecaster at Brier 0', () => {
    const obs = [
      ...Array.from({ length: 10 }, () => ({ confidence: 1, correct: true })),
      ...Array.from({ length: 10 }, () => ({ confidence: 0, correct: false })),
    ];
    expect(calibration(obs).brier).toBe(0);
  });

  it('ignores out-of-range confidences instead of poisoning the average', () => {
    const report = calibration([
      { confidence: 0.5, correct: true },
      { confidence: 1.7, correct: false },
      { confidence: Number.NaN, correct: false },
    ]);
    expect(report.n).toBe(1);
  });

  it('buckets the reliability curve', () => {
    const obs = [
      ...Array.from({ length: 10 }, () => ({ confidence: 0.9, correct: true })),
      ...Array.from({ length: 10 }, () => ({ confidence: 0.3, correct: false })),
    ];
    const report = calibration(obs);
    expect(report.buckets).toHaveLength(2);
    expect(report.buckets[0]?.accuracy).toBe(0);
    expect(report.buckets[1]?.accuracy).toBe(1);
  });
});

describe('prioritise', () => {
  const base = { now: T0, examAt: day(60) };

  it('ranks a high-mark weakness above a low-mark one', () => {
    const ranked = prioritise(
      [
        { objectiveId: 'small', label: 'Small', marksAtStake: 4, probability: 0.4 },
        { objectiveId: 'big', label: 'Big', marksAtStake: 40, probability: 0.4 },
      ],
      base,
    );
    expect(ranked[0]?.objectiveId).toBe('big');
  });

  it('ignores objectives already at target', () => {
    const ranked = prioritise(
      [
        { objectiveId: 'done', label: 'Done', marksAtStake: 50, probability: 0.95 },
        { objectiveId: 'weak', label: 'Weak', marksAtStake: 10, probability: 0.5 },
      ],
      base,
    );
    expect(ranked[0]?.objectiveId).toBe('weak');
    expect(ranked[1]?.marksAtRisk).toBe(0);
  });

  it('escalates a confident-but-wrong blind spot above an equal known weakness', () => {
    const ranked = prioritise(
      [
        { objectiveId: 'known', label: 'Known weak', marksAtStake: 20, probability: 0.5, meanConfidence: 0.5, lastPractised: T0 },
        { objectiveId: 'blind', label: 'Blind spot', marksAtStake: 20, probability: 0.5, meanConfidence: 0.9, lastPractised: T0 },
      ],
      base,
    );
    expect(ranked[0]?.objectiveId).toBe('blind');
    expect(ranked[0]?.why).toMatch(/rate yourself higher/);
  });

  it('surfaces neglected objectives', () => {
    const ranked = prioritise(
      [
        { objectiveId: 'fresh', label: 'Fresh', marksAtStake: 20, probability: 0.6, lastPractised: T0 },
        { objectiveId: 'stale', label: 'Stale', marksAtStake: 20, probability: 0.6, lastPractised: day(-45) },
      ],
      base,
    );
    expect(ranked[0]?.objectiveId).toBe('stale');
    expect(ranked[0]?.why).toMatch(/not practised/);
  });

  it('ramps urgency only inside the final four months', () => {
    expect(examUrgency(T0, day(300))).toBe(1);
    expect(examUrgency(T0, day(60))).toBeCloseTo(1.5, 6);
    expect(examUrgency(T0, day(1))).toBeGreaterThan(1.9);
    expect(examUrgency(T0)).toBe(1);
  });
});
