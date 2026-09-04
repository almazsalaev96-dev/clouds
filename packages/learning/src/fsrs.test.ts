import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMETERS, FsrsScheduler } from './fsrs';
import { CardState, MS_PER_DAY, Rating, type MemoryState } from './types';

const T0 = Date.UTC(2026, 0, 1, 9, 0, 0);
const day = (n: number) => T0 + n * MS_PER_DAY;

/** Graduate a card out of learning so tests can work in the Review state. */
function graduated(s: FsrsScheduler, at = T0): MemoryState {
  return s.review(s.newCard(at), Rating.Easy, at).card;
}

describe('FsrsScheduler parameters', () => {
  it('ships the 21-weight FSRS-6 vector', () => {
    expect(DEFAULT_PARAMETERS).toHaveLength(21);
  });

  it('rejects a wrong-length parameter vector', () => {
    expect(() => new FsrsScheduler({ parameters: [0.1, 0.2] })).toThrow(/expects 21 parameters/);
  });

  it('rejects an out-of-bounds weight', () => {
    const bad = [...DEFAULT_PARAMETERS];
    bad[4] = 99;
    expect(() => new FsrsScheduler({ parameters: bad })).toThrow(/w\[4\]/);
  });

  it('rejects a desired retention outside (0,1)', () => {
    expect(() => new FsrsScheduler({ desiredRetention: 1 })).toThrow(/desiredRetention/);
  });
});

describe('retrievability', () => {
  const s = new FsrsScheduler();

  it('is 0 for a card that has never been reviewed', () => {
    expect(s.retrievability(s.newCard(T0), T0)).toBe(0);
  });

  it('is 1 immediately after a review', () => {
    const card = graduated(s);
    expect(s.retrievability(card, card.lastReview as number)).toBeCloseTo(1, 10);
  });

  it('is exactly 0.9 after S days — the definition of stability', () => {
    const card: MemoryState = {
      state: CardState.Review,
      step: null,
      stability: 10,
      difficulty: 5,
      lastReview: T0,
      due: day(10),
    };
    expect(s.retrievability(card, day(10))).toBeCloseTo(0.9, 10);
  });

  it('decays monotonically with elapsed time', () => {
    const card = graduated(s);
    const series = [1, 5, 20, 100].map((d) => s.retrievability(card, day(d)));
    for (let i = 1; i < series.length; i++) {
      expect(series[i]).toBeLessThan(series[i - 1] as number);
    }
  });
});

describe('grading', () => {
  const s = new FsrsScheduler({ learningStepsMinutes: [], relearningStepsMinutes: [] });

  it('orders first-review intervals Again <= Hard <= Good <= Easy', () => {
    const intervals = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map(
      (r) => s.review(s.newCard(T0), r, T0).intervalMs,
    );
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1] as number);
    }
  });

  it('orders difficulty Easy < Good < Hard < Again after one review', () => {
    const d = [Rating.Easy, Rating.Good, Rating.Hard, Rating.Again].map(
      (r) => s.review(s.newCard(T0), r, T0).card.difficulty as number,
    );
    for (let i = 1; i < d.length; i++) {
      expect(d[i]).toBeGreaterThan(d[i - 1] as number);
    }
  });

  it('drops stability on a lapse and raises it on a success', () => {
    const card = { ...graduated(s), due: day(30) };
    const before = card.stability as number;
    const lapsed = s.review(card, Rating.Again, day(30)).card.stability as number;
    const recalled = s.review(card, Rating.Good, day(30)).card.stability as number;
    expect(lapsed).toBeLessThan(before);
    expect(recalled).toBeGreaterThan(before);
  });

  it('grows stability more when recall was harder to retrieve (spacing effect)', () => {
    const card = graduated(s);
    const soon = s.review(card, Rating.Good, day(1)).card.stability as number;
    const late = s.review(card, Rating.Good, day(30)).card.stability as number;
    expect(late).toBeGreaterThan(soon);
  });

  it('keeps difficulty inside 1..10 under 200 consecutive failures', () => {
    let card = graduated(s);
    for (let i = 1; i <= 200; i++) card = s.review(card, Rating.Again, day(i)).card;
    expect(card.difficulty as number).toBeGreaterThanOrEqual(1);
    expect(card.difficulty as number).toBeLessThanOrEqual(10);
    expect(card.stability as number).toBeGreaterThan(0);
  });
});

describe('learning and relearning steps', () => {
  const s = new FsrsScheduler({ learningStepsMinutes: [1, 10], relearningStepsMinutes: [10] });

  it('walks a new card through both learning steps before graduating', () => {
    const first = s.review(s.newCard(T0), Rating.Good, T0);
    expect(first.card.state).toBe(CardState.Learning);
    expect(first.card.step).toBe(1);
    expect(first.intervalMs).toBe(10 * 60_000);

    const second = s.review(first.card, Rating.Good, T0 + 10 * 60_000);
    expect(second.card.state).toBe(CardState.Review);
    expect(second.card.step).toBeNull();
    expect(second.intervalMs).toBeGreaterThanOrEqual(MS_PER_DAY);
  });

  it('sends a lapsed review card into relearning, not straight back to review', () => {
    const card = { ...graduated(s), due: day(20) };
    const lapse = s.review(card, Rating.Again, day(20));
    expect(lapse.card.state).toBe(CardState.Relearning);
    expect(lapse.intervalMs).toBe(10 * 60_000);

    const back = s.review(lapse.card, Rating.Good, day(20) + 10 * 60_000);
    expect(back.card.state).toBe(CardState.Review);
  });

  it('resets to the first step when a learning card is failed', () => {
    const stepTwo = s.review(s.newCard(T0), Rating.Good, T0).card;
    const failed = s.review(stepTwo, Rating.Again, T0 + 60_000);
    expect(failed.card.step).toBe(0);
    expect(failed.intervalMs).toBe(60_000);
  });

  it('graduates immediately when no learning steps are configured', () => {
    const none = new FsrsScheduler({ learningStepsMinutes: [] });
    expect(none.review(none.newCard(T0), Rating.Good, T0).card.state).toBe(CardState.Review);
  });
});

describe('desired retention', () => {
  it('schedules shorter intervals for a higher retention target', () => {
    const relaxed = new FsrsScheduler({ desiredRetention: 0.8 });
    const strict = new FsrsScheduler({ desiredRetention: 0.95 });
    expect(strict.nextIntervalDays(50)).toBeLessThan(relaxed.nextIntervalDays(50));
  });

  it('returns S days at 0.9 retention, the calibration point of the model', () => {
    const s = new FsrsScheduler({ desiredRetention: 0.9 });
    expect(s.nextIntervalDays(21)).toBe(21);
  });

  it('never schedules less than a day or more than the maximum', () => {
    const s = new FsrsScheduler({ maximumIntervalDays: 365 });
    expect(s.nextIntervalDays(0.01)).toBe(1);
    expect(s.nextIntervalDays(100_000)).toBe(365);
  });
});

describe('determinism', () => {
  it('replays a review history to an identical state', () => {
    const ratings = [Rating.Good, Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;
    const run = () => {
      const s = new FsrsScheduler({ enableFuzz: true });
      let card = s.newCard(T0);
      ratings.forEach((r, i) => {
        card = s.review(card, r, day(i * 3), 'card-42').card;
      });
      return card;
    };
    expect(run()).toEqual(run());
  });

  it('fuzzes long intervals apart for different cards but stays within ±5%', () => {
    const s = new FsrsScheduler({ enableFuzz: true, learningStepsMinutes: [] });
    const base = { ...graduated(s), due: day(60) };
    const plain = new FsrsScheduler({ learningStepsMinutes: [] });
    const unfuzzedDays = plain.review(base, Rating.Good, day(60)).intervalMs / MS_PER_DAY;
    const seen = new Set<number>();
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const days = s.review(base, Rating.Good, day(60), id).intervalMs / MS_PER_DAY;
      seen.add(days);
      expect(Math.abs(days - unfuzzedDays)).toBeLessThanOrEqual(
        Math.max(unfuzzedDays * 0.05, 1) + 1,
      );
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
