/**
 * Content schemas.
 *
 * This file is the contract between the person supplying subject material and
 * the engines that consume it. Three properties are deliberate:
 *
 *  1. **Everything optional that can be.** A pack with nothing but topic titles
 *     must load and be useful; richness is added incrementally. A schema that
 *     demands 40 fields per question guarantees the bank stays empty.
 *
 *  2. **Validation is loud and located.** When a pack is wrong, the error names
 *     the file, the path and what was expected. Silent coercion of bad content
 *     into a plausible shape is how question banks quietly rot.
 *
 *  3. **Rights are not optional.** Every question declares a source and a
 *     licence. `link-only` material is never rendered as content — it is linked
 *     to the awarding body. See docs/CONTENT-RIGHTS.md.
 */

import { z } from "zod";

const unit = z.number().min(0).max(1);

// --- syllabus --------------------------------------------------------------

export const paperSchema = z.object({
  id: z.string().min(1),
  code: z.string(),
  name: z.string(),
  durationMinutes: z.number().positive(),
  rawMarks: z.number().positive(),
  weightOfQualification: unit,
  stage: z.enum(["as", "a2", "combined"]).default("combined"),
  sections: z
    .array(
      z.object({
        code: z.string(),
        name: z.string(),
        description: z.string().optional(),
        marks: z.number(),
        questionCount: z.number().optional(),
        choice: z.string().optional(),
      }),
    )
    .default([]),
  materials: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const assessmentObjectiveSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  /** Keyed by paper id. Values 0..1. */
  weightByPaper: z.record(z.string(), unit).default({}),
});

export const commandWordSchema = z.object({
  word: z.string(),
  definition: z.string(),
  officialDefinition: z.string().optional(),
  aoCeiling: z.array(z.string()).default([]),
  expects: z.string().default(""),
  answerStructure: z.array(z.string()).default([]),
  weakExample: z.string().optional(),
  strongExample: z.string().optional(),
  trap: z.string().optional(),
});

export const topicSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  parentId: z.string().optional(),
  summary: z.string().optional(),
  stage: z.enum(["as", "a2"]).optional(),
  paperIds: z.array(z.string()).optional(),
  examWeight: unit.optional(),
  prerequisites: z.array(z.string()).optional(),
});

export const objectiveSchema = z.object({
  id: z.string(),
  code: z.string(),
  statement: z.string(),
  topicId: z.string(),
  aoCodes: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
  stage: z.enum(["as", "a2"]).optional(),
});

export const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  aoCode: z.string().optional(),
  drill: z.string().optional(),
});

export const gradeThresholdSchema = z.object({
  session: z.string(),
  paperCode: z.string().optional(),
  thresholds: z.record(z.string(), z.number()),
  maxMark: z.number().positive(),
  sourceUrl: z.string().url().optional(),
});

export const syllabusSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  subject: z.string(),
  qualificationId: z.string(),
  examBoardId: z.string(),
  version: z.object({
    label: z.string(),
    firstExamYear: z.number(),
    lastExamYear: z.number(),
    changes: z.array(z.string()).optional(),
    removedTopics: z.array(z.string()).optional(),
    addedTopics: z.array(z.string()).optional(),
    supersededBy: z.string().optional(),
  }),
  papers: z.array(paperSchema).default([]),
  assessmentObjectives: z.array(assessmentObjectiveSchema).default([]),
  commandWords: z.array(commandWordSchema).default([]),
  topics: z.array(topicSchema).default([]),
  objectives: z.array(objectiveSchema).default([]),
  skills: z.array(skillSchema).default([]),
  gradeThresholds: z.array(gradeThresholdSchema).optional(),
  officialResources: z
    .array(z.object({ label: z.string(), url: z.string(), kind: z.string() }))
    .optional(),
});

// --- questions -------------------------------------------------------------

export const difficultySchema = z.object({
  knowledge: unit.default(0.5),
  reasoning: unit.default(0.5),
  calculation: unit.default(0.3),
  language: unit.default(0.4),
  steps: unit.default(0.4),
  unfamiliarContext: unit.default(0.3),
  overall: unit.optional(),
});

export const markPointSchema = z.object({
  id: z.string(),
  text: z.string(),
  marks: z.number().positive(),
  aoCode: z.string().optional(),
  alternatives: z.array(z.string()).optional(),
  rejects: z.array(z.string()).optional(),
  requires: z.array(z.string()).optional(),
  skillId: z.string().optional(),
});

export const markLevelSchema = z.object({
  level: z.number(),
  name: z.string(),
  marksFrom: z.number(),
  marksTo: z.number(),
  descriptor: z.string(),
  aoCode: z.string().optional(),
  indicators: z.array(z.string()).optional(),
});

export const markSchemeSchema = z.object({
  totalMarks: z.number().positive(),
  style: z.enum(["points", "levels", "hybrid"]).default("points"),
  points: z.array(markPointSchema).optional(),
  levels: z.array(markLevelSchema).optional(),
  modelAnswer: z.string().optional(),
  nearMissAnswer: z.string().optional(),
  examinerNotes: z.string().optional(),
  acceptedValues: z
    .array(z.object({ value: z.number(), tolerance: z.number().optional(), unit: z.string().optional() }))
    .optional(),
  ownFigureRule: z.boolean().optional(),
});

export const questionSchema = z.object({
  id: z.string(),
  syllabusId: z.string(),
  version: z.number().int().positive().default(1),
  type: z.enum([
    "mcq", "multi-select", "numeric", "short-answer", "structured", "essay",
    "calculation", "data-response", "cloze", "match", "order", "label-diagram",
    "graph-read", "code-trace", "translation", "true-false",
  ]),
  source: z.object({
    kind: z.enum(["past-paper", "specimen", "original", "user", "ai-generated", "textbook"]),
    licence: z.enum(["owned", "licensed", "public-domain", "link-only", "user-owned"]),
    year: z.number().optional(),
    session: z.string().optional(),
    paperVariant: z.string().optional(),
    questionNumber: z.string().optional(),
    url: z.string().optional(),
    attribution: z.string().optional(),
  }),
  paperId: z.string().optional(),
  topicIds: z.array(z.string()).min(1),
  objectiveIds: z.array(z.string()).optional(),
  skillIds: z.array(z.string()).optional(),
  commandWord: z.string().optional(),
  aoMarks: z.record(z.string(), z.number()).optional(),
  marks: z.number().positive(),
  timeSeconds: z.number().positive().optional(),
  stimulus: z
    .object({
      title: z.string().optional(),
      body: z.string(),
      insertId: z.string().optional(),
      imageUrl: z.string().optional(),
      table: z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional(),
    })
    .optional(),
  prompt: z.string().min(1),
  response: z
    .object({
      choices: z
        .array(z.object({ id: z.string(), text: z.string(), correct: z.boolean().optional(), misconception: z.string().optional() }))
        .optional(),
      blanks: z.array(z.object({ id: z.string(), accepted: z.array(z.string()), caseSensitive: z.boolean().optional() })).optional(),
      pairs: z.array(z.object({ leftId: z.string(), left: z.string(), rightId: z.string(), right: z.string() })).optional(),
      sequence: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
      suggestedWords: z.number().optional(),
      workingSpace: z.boolean().optional(),
      unit: z.string().optional(),
    })
    .optional(),
  markScheme: markSchemeSchema,
  difficulty: difficultySchema.default({}),
  prerequisiteTopicIds: z.array(z.string()).optional(),
  commonErrors: z
    .array(z.object({ label: z.string(), description: z.string(), errorType: z.string().optional() }))
    .optional(),
  hints: z.array(z.string()).optional(),
  quality: z
    .object({
      reviewStatus: z.enum(["draft", "machine-checked", "human-reviewed", "published"]).default("draft"),
      lastVerified: z.string().optional(),
      verifiedBy: z.string().optional(),
      confidence: unit.optional(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
});

export const questionFileSchema = z.object({
  syllabusId: z.string().optional(),
  defaults: z
    .object({
      source: questionSchema.shape.source.optional(),
      paperId: z.string().optional(),
      topicIds: z.array(z.string()).optional(),
      difficulty: difficultySchema.optional(),
      quality: questionSchema.shape.quality.optional(),
    })
    .optional(),
  questions: z.array(questionSchema.partial({ syllabusId: true, source: true, markScheme: true }).passthrough()),
});

// --- lessons / explanations ------------------------------------------------

export const explanationDepthSchema = z.enum([
  "thirty-second",
  "simple",
  "standard",
  "exam",
  "deep",
]);

export const lessonSchema = z.object({
  id: z.string(),
  syllabusId: z.string(),
  topicId: z.string(),
  title: z.string(),
  objectiveIds: z.array(z.string()).optional(),
  /** Explanations at increasing depth. `standard` is the default rendering. */
  explanations: z.record(explanationDepthSchema, z.string()).optional(),
  /** Concept relationships for the map: "A --relation--> B". */
  conceptEdges: z
    .array(z.object({ from: z.string(), to: z.string(), relation: z.string().default("leads to") }))
    .optional(),
  keyTerms: z.array(z.object({ term: z.string(), definition: z.string() })).optional(),
  formulas: z
    .array(
      z.object({
        name: z.string(),
        expression: z.string(),
        variables: z.array(z.object({ symbol: z.string(), meaning: z.string(), unit: z.string().optional() })).optional(),
        rearrangements: z.array(z.string()).optional(),
        commonMistakes: z.array(z.string()).optional(),
        worked: z.string().optional(),
      }),
    )
    .optional(),
  /** Where students go wrong, and what the correct model is. */
  misconceptions: z.array(z.object({ belief: z.string(), correction: z.string() })).optional(),
  /** "This fails when…" — the evaluation bank. */
  limitations: z.array(z.string()).optional(),
  examples: z.array(z.object({ label: z.string(), body: z.string() })).optional(),
  /** Micro-lessons: the topic broken into the smallest masterable units. */
  microLessons: z
    .array(z.object({ id: z.string(), title: z.string(), body: z.string(), objectiveId: z.string().optional() }))
    .optional(),
  examinerNotes: z.array(z.string()).optional(),
  sources: z.array(z.object({ label: z.string(), url: z.string().optional() })).optional(),
});

// --- flashcards ------------------------------------------------------------

export const cardSchema = z.object({
  id: z.string(),
  syllabusId: z.string().optional(),
  topicIds: z.array(z.string()).default([]),
  kind: z
    .enum(["basic", "cloze", "definition", "formula", "process", "comparison", "diagram", "example"])
    .default("basic"),
  front: z.string(),
  back: z.string(),
  /** For cloze cards, the text with {{...}} deletions. */
  clozeText: z.string().optional(),
  hint: z.string().optional(),
  imageUrl: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const cardFileSchema = z.object({
  syllabusId: z.string().optional(),
  defaults: z.object({ topicIds: z.array(z.string()).optional(), kind: cardSchema.shape.kind.optional() }).optional(),
  cards: z.array(cardSchema.partial({ id: true })),
});

// --- glossary --------------------------------------------------------------

export const glossaryEntrySchema = z.object({
  term: z.string(),
  definition: z.string(),
  syllabusId: z.string().optional(),
  topicIds: z.array(z.string()).optional(),
  /** Terms students confuse this with. Powers Comparison mode. */
  confusedWith: z.array(z.string()).optional(),
  examUsage: z.string().optional(),
  translations: z.record(z.string(), z.string()).optional(),
});

export const glossaryFileSchema = z.object({
  syllabusId: z.string().optional(),
  entries: z.array(glossaryEntrySchema),
});

// --- pack manifest ---------------------------------------------------------

export const packManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default("0.1.0"),
  qualification: z.object({
    id: z.string(),
    level: z.enum(["igcse", "o-level", "as-level", "a-level", "ib-dp", "other"]),
    title: z.string(),
    awardingDescription: z.string(),
    gradeScale: z.array(z.string()).min(2),
  }),
  examBoard: z.object({
    id: z.string(),
    name: z.string(),
    shortName: z.string(),
    country: z.string().optional(),
    website: z.string().optional(),
  }),
  /** Statement of what may be reproduced from this pack. */
  rights: z
    .object({
      summary: z.string(),
      defaultLicence: z.enum(["owned", "licensed", "public-domain", "link-only", "user-owned"]).default("owned"),
    })
    .optional(),
  maintainer: z.string().optional(),
  lastVerified: z.string().optional(),
});

export type PackManifest = z.infer<typeof packManifestSchema>;
export type SyllabusInput = z.infer<typeof syllabusSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type LessonInput = z.infer<typeof lessonSchema>;
export type CardInput = z.infer<typeof cardSchema>;
export type GlossaryEntryInput = z.infer<typeof glossaryEntrySchema>;
