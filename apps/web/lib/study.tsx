'use client';

/**
 * The study projection.
 *
 * Everything the UI renders is derived here by replaying the append-only event log
 * through the learning engine: FSRS memory state per card, mastery per objective,
 * calibration across all confidence-rated answers, and the mark-weighted priority
 * list. Nothing derived is ever persisted, so changing the algorithm changes the
 * app's answers without a migration.
 */

import {
  assessMastery,
  buildSession,
  calibration,
  FsrsScheduler,
  newMastery,
  prioritise,
  probabilityCorrect,
  Rating,
  updateMastery,
  type CalibrationReport,
  type MasteryState,
  type MemoryState,
  type PrioritisedObjective,
  type SchedulableCard,
  type SessionPlan,
} from '@atlas/learning';
import { business9609, business9609Items, marksPerObjective, type Item } from '@atlas/content';
import {
  appendEvent,
  clearAll,
  DEFAULT_SETTINGS,
  loadEvents,
  loadSettings,
  newEventId,
  saveSettings,
  type Settings,
  type StudyEvent,
} from './db';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface CardView extends SchedulableCard {
  item: Item;
  /** Reviews recorded for this card so far. */
  reviews: number;
  lapses: number;
}

export interface ObjectiveView {
  id: string;
  code: string | undefined;
  title: string;
  parentId: string | null;
  level: 'AS' | 'A2' | 'both';
  marksAtStake: number;
  probability: number;
  mastered: boolean;
  masteryReason: string;
  attempts: number;
  cardCount: number;
  /** Cards previously reviewed and now due again. */
  dueCount: number;
  /** Cards never seen. Deliberately counted apart from due — they are not a backlog. */
  newCount: number;
}

export interface StudyState {
  ready: boolean;
  /** Storage is unavailable (private window, blocked cookies) — session is memory-only. */
  ephemeral: boolean;
  settings: Settings;
  cards: CardView[];
  objectives: ObjectiveView[];
  calibration: CalibrationReport;
  priorities: PrioritisedObjective[];
  events: StudyEvent[];
  streakDays: number;
  reviewedToday: number;
  session: SessionPlan;
  scheduler: FsrsScheduler;
  now: number;
  record: (input: RecordReviewInput) => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
  reset: () => Promise<void>;
  exportJson: () => string;
}

export interface RecordReviewInput {
  cardId: string;
  objectiveId: string;
  rating: Rating;
  latencyMs: number;
  confidence?: number;
  correct?: boolean;
}

const StudyContext = createContext<StudyState | null>(null);

const DAY = 86_400_000;
const startOfDay = (t: number) => Math.floor(t / DAY) * DAY;

export function StudyProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<StudyEvent[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  // Pinned per mount so a render pass can't shift "now" mid-calculation.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [loadedEvents, loadedSettings] = await Promise.all([loadEvents(), loadSettings()]);
      if (cancelled) return;
      setEvents(loadedEvents);
      setSettings(loadedSettings);
      setEphemeral(typeof indexedDB === 'undefined');
      setNow(Date.now());
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep "now" fresh enough that due counts don't go stale in a long-open tab.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const scheduler = useMemo(
    () =>
      new FsrsScheduler({
        desiredRetention: settings.desiredRetention,
        enableFuzz: true,
      }),
    [settings.desiredRetention],
  );

  const projection = useMemo(
    () => project(events, scheduler, now),
    [events, scheduler, now],
  );

  const marks = useMemo(() => marksPerObjective(business9609), []);

  const objectives = useMemo<ObjectiveView[]>(() => {
    const cardsByObjective = new Map<string, CardView[]>();
    for (const card of projection.cards) {
      const list = cardsByObjective.get(card.item.objectiveId) ?? [];
      list.push(card);
      cardsByObjective.set(card.item.objectiveId, list);
    }
    return business9609.nodes.map((node) => {
      const mastery = projection.mastery.get(node.id) ?? newMastery(node.id);
      const verdict = assessMastery(mastery);
      const cards = cardsByObjective.get(node.id) ?? [];
      return {
        id: node.id,
        code: node.code,
        title: node.title,
        parentId: node.parentId,
        level: node.level,
        marksAtStake: marks.get(node.id) ?? 0,
        probability: verdict.probability,
        mastered: verdict.mastered,
        masteryReason: verdict.reason,
        attempts: mastery.attempts,
        cardCount: cards.length,
        dueCount: cards.filter((c) => c.reviews > 0 && c.memory.due <= now).length,
        newCount: cards.filter((c) => c.reviews === 0).length,
      };
    });
  }, [projection, marks, now]);

  const priorities = useMemo(
    () =>
      prioritise(
        objectives
          .filter((o) => o.cardCount > 0)
          .map((o) => {
            const mastery = projection.mastery.get(o.id);
            const confidences = projection.confidenceByObjective.get(o.id) ?? [];
            const meanConfidence =
              confidences.length >= 3
                ? confidences.reduce((s, c) => s + c, 0) / confidences.length
                : undefined;
            return {
              objectiveId: o.id,
              label: `${o.code ? `${o.code} ` : ''}${o.title}`,
              marksAtStake: o.marksAtStake,
              probability: o.probability,
              lastPractised: mastery?.lastSeen ?? null,
              ...(meanConfidence !== undefined ? { meanConfidence } : {}),
            };
          }),
        { now, ...(settings.examAt ? { examAt: settings.examAt } : {}) },
      ).filter((p) => p.marksAtRisk > 0),
    [objectives, projection, now, settings.examAt],
  );

  const session = useMemo(
    () =>
      buildSession(
        projection.cards.map((c) => ({
          ...c,
          weight: marks.get(c.item.objectiveId) ?? 1,
        })),
        {
          now,
          limit: settings.sessionLimit,
          newCardLimit: settings.newCardLimit,
        },
      ),
    [projection.cards, marks, now, settings.sessionLimit, settings.newCardLimit],
  );

  const record = useCallback(
    async (input: RecordReviewInput) => {
      const at = Date.now();
      const event: StudyEvent = {
        id: newEventId(at),
        type: 'review',
        at,
        ...input,
      };
      setEvents((previous) => [...previous, event]);
      setNow(at);
      await appendEvent(event);
    },
    [],
  );

  const update = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      await saveSettings(next);
    },
    [settings],
  );

  const reset = useCallback(async () => {
    await clearAll();
    setEvents([]);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const exportJson = useCallback(
    () =>
      JSON.stringify(
        { exportedAt: new Date().toISOString(), version: 1, settings, events },
        null,
        2,
      ),
    [settings, events],
  );

  const value: StudyState = {
    ready,
    ephemeral,
    settings,
    cards: projection.cards,
    objectives,
    calibration: projection.calibration,
    priorities,
    events,
    streakDays: projection.streakDays,
    reviewedToday: projection.reviewedToday,
    session,
    scheduler,
    now,
    record,
    update,
    reset,
    exportJson,
  };

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy(): StudyState {
  const context = useContext(StudyContext);
  if (!context) throw new Error('useStudy must be used inside <StudyProvider>');
  return context;
}

interface Projection {
  cards: CardView[];
  mastery: Map<string, MasteryState>;
  calibration: CalibrationReport;
  confidenceByObjective: Map<string, number[]>;
  streakDays: number;
  reviewedToday: number;
}

/**
 * Replay the log. Pure function of (events, scheduler, now) — this is the single
 * place where raw history becomes everything the app knows.
 */
function project(events: readonly StudyEvent[], scheduler: FsrsScheduler, now: number): Projection {
  const memory = new Map<string, MemoryState>();
  const counts = new Map<string, { reviews: number; lapses: number }>();
  const mastery = new Map<string, MasteryState>();
  const confidenceByObjective = new Map<string, number[]>();
  const observations: { confidence: number; correct: boolean }[] = [];
  const activeDays = new Set<number>();

  for (const event of events) {
    if (event.type !== 'review') continue;

    const current = memory.get(event.cardId) ?? scheduler.newCard(event.at);
    memory.set(event.cardId, scheduler.review(current, event.rating, event.at, event.cardId).card);

    const tally = counts.get(event.cardId) ?? { reviews: 0, lapses: 0 };
    tally.reviews += 1;
    if (event.rating === Rating.Again) tally.lapses += 1;
    counts.set(event.cardId, tally);

    // A card graded Again is the clearest "not known yet" signal we have; anything
    // else counts as a success for the objective's ability estimate.
    const correct = event.correct ?? event.rating !== Rating.Again;
    const objective = mastery.get(event.objectiveId) ?? newMastery(event.objectiveId);
    mastery.set(event.objectiveId, updateMastery(objective, { correct, at: event.at }));

    if (event.confidence !== undefined) {
      observations.push({ confidence: event.confidence, correct });
      const list = confidenceByObjective.get(event.objectiveId) ?? [];
      list.push(event.confidence);
      confidenceByObjective.set(event.objectiveId, list);
    }

    activeDays.add(startOfDay(event.at));
  }

  const cards: CardView[] = business9609Items.map((item) => {
    const tally = counts.get(item.id) ?? { reviews: 0, lapses: 0 };
    return {
      id: item.id,
      topicId: item.objectiveId,
      item,
      reviews: tally.reviews,
      lapses: tally.lapses,
      memory: memory.get(item.id) ?? {
        state: 'learning',
        step: 0,
        stability: null,
        difficulty: null,
        lastReview: null,
        due: now,
      },
    };
  });

  return {
    cards,
    mastery,
    calibration: calibration(observations),
    confidenceByObjective,
    streakDays: streak(activeDays, now),
    reviewedToday: events.filter((e) => startOfDay(e.at) === startOfDay(now)).length,
  };
}

/**
 * Consecutive days of study ending today or yesterday.
 *
 * Yesterday still counts: the day is not over, and a streak that breaks at
 * midnight is a guilt mechanic, not a learning one (MASTER-PROMPT.md §12).
 */
function streak(activeDays: ReadonlySet<number>, now: number): number {
  const today = startOfDay(now);
  let cursor = activeDays.has(today) ? today : today - DAY;
  if (!activeDays.has(cursor)) return 0;
  let count = 0;
  while (activeDays.has(cursor)) {
    count += 1;
    cursor -= DAY;
  }
  return count;
}

export { probabilityCorrect };
