/**
 * What a turn can make.
 *
 * The chat is the product, so the things a student asks for arrive *in* the thread
 * rather than on another screen: a deck of cards, a question to attempt, the mark on
 * what they wrote. A turn carries zero or more of these, and the screen draws each
 * one under the prose that introduced it.
 *
 * The kinds are open on purpose — an artefact whose kind this build does not know is
 * skipped rather than crashing the thread it arrived in.
 */
export interface FlashcardDraft {
  front: string
  back: string
  syllabusPoint?: string | null
  /** Why this card exists — shown when the student asks what it is for. */
  why?: string | null
}

/** A syllabus point a deck sits on, as the course names it. */
export interface GroundedPoint {
  code: string
  title: string
}

export interface DeckArtefact {
  id: string
  kind: 'flashcards'
  topic: string | null
  cards: FlashcardDraft[]
  /** The syllabus points the deck was actually built from. */
  grounded?: GroundedPoint[]
  /** What the maker dropped, and why. Shown rather than hidden. */
  warnings?: string[]
  model?: string | null
}

export interface QuestionArtefact {
  id: string
  kind: 'question'
  itemId: string
  stem: string
  commandWord?: string | null
  tariff?: number | null
  paper?: string | null
  stimulus?: string | null
  syllabusPoint?: string | null
}

export interface MarkArtefact {
  id: string
  kind: 'mark'
  markId: string
  itemId?: string | null
  total?: number | null
  max?: number | null
}

export type Artefact = DeckArtefact | QuestionArtefact | MarkArtefact

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const text = (source: Record<string, unknown>, key: string): string | null => {
  const value = source[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const number = (source: Record<string, unknown>, key: string): number | null => {
  const value = source[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const strings = (source: Record<string, unknown>, key: string): string[] => {
  const value = source[key]
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v.trim()) : []
}

/**
 * The points a deck sits on. A point with no code is not a point, and a point with
 * no title is shown by its code — which is what the syllabus itself does.
 */
function readGrounded(value: unknown): GroundedPoint[] {
  if (!Array.isArray(value)) return []
  const out: GroundedPoint[] = []
  for (const entry of value) {
    if (typeof entry === 'string') {
      const said = entry.trim()
      if (said) out.push({ code: said, title: '' })
      continue
    }
    const source = record(entry)
    const code = source ? text(source, 'code') : null
    if (!code) continue
    out.push({ code, title: (source && text(source, 'title')) ?? '' })
  }
  return out
}

function readCards(value: unknown): FlashcardDraft[] {
  if (!Array.isArray(value)) return []
  const out: FlashcardDraft[] = []
  for (const entry of value) {
    const source = record(entry)
    if (!source) continue
    const front = text(source, 'front')
    const back = text(source, 'back')
    // A card missing either side is not a card. Drawing a blank one would be worse
    // than leaving it out, and the maker already reports what it dropped.
    if (!front || !back) continue
    out.push({
      front,
      back,
      syllabusPoint: text(source, 'syllabusPoint') ?? text(source, 'syllabus_point'),
      why: text(source, 'why'),
    })
  }
  return out
}

/** One artefact off the wire, or null if this build cannot draw it. */
export function readArtefact(value: unknown): Artefact | null {
  const source = record(value)
  if (!source) return null
  const id = text(source, 'id') ?? `artefact-${Math.random().toString(36).slice(2, 10)}`
  const kind = text(source, 'kind')

  if (kind === 'flashcards') {
    const cards = readCards(source.cards)
    if (!cards.length) return null
    return {
      id,
      kind: 'flashcards',
      topic: text(source, 'topic'),
      cards,
      grounded: readGrounded(source.grounded),
      warnings: strings(source, 'warnings'),
      model: text(source, 'model'),
    }
  }

  if (kind === 'question') {
    const itemId = text(source, 'itemId') ?? text(source, 'item_id')
    const stem = text(source, 'stem')
    if (!itemId || !stem) return null
    return {
      id,
      kind: 'question',
      itemId,
      stem,
      commandWord: text(source, 'commandWord') ?? text(source, 'command_word'),
      tariff: number(source, 'tariff'),
      paper: text(source, 'paper'),
      stimulus: text(source, 'stimulus'),
      syllabusPoint: text(source, 'syllabusPoint') ?? text(source, 'syllabus_point'),
    }
  }

  if (kind === 'mark') {
    const markId = text(source, 'markId') ?? text(source, 'mark_id')
    if (!markId) return null
    return {
      id,
      kind: 'mark',
      markId,
      itemId: text(source, 'itemId') ?? text(source, 'item_id'),
      total: number(source, 'total'),
      max: number(source, 'max'),
    }
  }

  return null
}

export const readArtefacts = (value: unknown): Artefact[] =>
  (Array.isArray(value) ? value : []).map(readArtefact).filter((a): a is Artefact => a !== null)
