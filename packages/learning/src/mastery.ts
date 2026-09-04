/**
 * Mastery estimation per syllabus objective.
 *
 * A card's FSRS state answers "will you remember this fact"; mastery answers "can
 * you do this objective". Different questions, so different models.
 *
 * We use a light Elo-style update: each objective has a latent ability, each item a
 * difficulty, and P(success) is the logistic of their difference. Cheap, online,
 * needs no training data, well understood.
 *
 * Mastery is only *claimed* when the evidence is spaced and varied — a run of
 * correct answers inside one sitting is not mastery (MASTER-PROMPT.md §4.3).
 */

const LOGISTIC_SCALE = 1.0;
const MS_PER_DAY = 86_400_000;

export interface MasteryState {
  objectiveId: string;
  /** Latent ability, roughly -4..+4. 0 = the average item is a coin flip. */
  ability: number;
  /** Count of graded attempts. */
  attempts: number;
  /** Day-stamps (epoch ms, midnight) on which this objective was practised. */
  practiceDays: number[];
  lastSeen: number | null;
}

export interface MasteryUpdate {
  correct: boolean;
  /** Item difficulty on the same latent scale, -4..+4. 0 = average. */
  itemDifficulty?: number;
  at: number;
}

export function newMastery(objectiveId: string): MasteryState {
  return { objectiveId, ability: 0, attempts: 0, practiceDays: [], lastSeen: null };
}

/** P(correct) for this ability against an item of the given difficulty. */
export function probabilityCorrect(ability: number, itemDifficulty = 0): number {
  return 1 / (1 + Math.exp(-LOGISTIC_SCALE * (ability - itemDifficulty)));
}

/**
 * Online update. The learning rate decays with attempts, so early evidence moves
 * the estimate quickly and later evidence refines it.
 */
export function updateMastery(state: MasteryState, update: MasteryUpdate): MasteryState {
  const difficulty = update.itemDifficulty ?? 0;
  const expected = probabilityCorrect(state.ability, difficulty);
  const k = 0.9 / (1 + state.attempts * 0.12);
  const ability = clampAbility(state.ability + k * ((update.correct ? 1 : 0) - expected));

  const dayKey = Math.floor(update.at / MS_PER_DAY) * MS_PER_DAY;
  const practiceDays = state.practiceDays.includes(dayKey)
    ? state.practiceDays
    : [...state.practiceDays, dayKey].slice(-30);

  return { ...state, ability, attempts: state.attempts + 1, practiceDays, lastSeen: update.at };
}

export interface MasteryVerdict {
  /** P(correct) on an average item of this objective. */
  probability: number;
  /** Enough spaced, varied evidence to call it mastered? */
  mastered: boolean;
  /** What is still missing, in plain words, when not yet mastered. */
  reason: string;
}

export interface MasteryThresholds {
  probability?: number;
  attempts?: number;
  /** Minimum distinct days practised — this is the anti-cram rule. */
  distinctDays?: number;
}

export function assessMastery(
  state: MasteryState,
  thresholds: MasteryThresholds = {},
): MasteryVerdict {
  const minProbability = thresholds.probability ?? 0.85;
  const minAttempts = thresholds.attempts ?? 4;
  const minDays = thresholds.distinctDays ?? 2;
  const probability = probabilityCorrect(state.ability);

  if (state.attempts < minAttempts) {
    return {
      probability,
      mastered: false,
      reason: `needs ${minAttempts - state.attempts} more attempts`,
    };
  }
  if (state.practiceDays.length < minDays) {
    return { probability, mastered: false, reason: 'needs practice on another day' };
  }
  if (probability < minProbability) {
    return { probability, mastered: false, reason: 'accuracy still below target' };
  }
  return { probability, mastered: true, reason: 'spaced and accurate' };
}

function clampAbility(x: number): number {
  return Math.min(Math.max(x, -4), 4);
}
