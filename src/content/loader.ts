/**
 * Content pack loader.
 *
 * Reads `content/<pack-id>/` from disk, validates it, cross-checks referential
 * integrity, and returns a typed pack plus a diagnostics report. Runs on the
 * server only (it touches the filesystem); the client receives loaded packs as
 * plain serialisable data.
 *
 * The diagnostics are the point. A question that references a topic id that
 * does not exist will silently disappear from every filter in the product, and
 * nobody will notice for months. Here it is an error with a filename attached.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, extname, basename, relative } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import {
  cardFileSchema,
  glossaryFileSchema,
  lessonSchema,
  packManifestSchema,
  questionFileSchema,
  questionSchema,
  syllabusSchema,
  type CardInput,
  type GlossaryEntryInput,
  type LessonInput,
  type PackManifest,
} from "./schema";
import type { Question } from "@/domain/question";
import type { Syllabus } from "@/domain/curriculum";

export interface Diagnostic {
  level: "error" | "warning" | "info";
  file: string;
  path?: string;
  message: string;
}

export interface ContentPack {
  manifest: PackManifest;
  syllabuses: Syllabus[];
  questions: Question[];
  lessons: LessonInput[];
  cards: CardInput[];
  glossary: GlossaryEntryInput[];
  diagnostics: Diagnostic[];
  stats: PackStats;
}

export interface PackStats {
  syllabuses: number;
  topics: number;
  objectives: number;
  questions: number;
  questionMarks: number;
  lessons: number;
  cards: number;
  glossaryTerms: number;
  /** Topics with at least one question. */
  topicsWithQuestions: number;
  /** Topics with a lesson. */
  topicsWithLessons: number;
  coverage: number;
}

export const CONTENT_ROOT = join(process.cwd(), "content");

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function readStructured(file: string): unknown {
  const raw = readFileSync(file, "utf8");
  const ext = extname(file).toLowerCase();
  if (ext === ".json") return JSON.parse(raw);
  if (ext === ".yaml" || ext === ".yml") return yaml.load(raw);
  if (ext === ".md" || ext === ".markdown") return parseMarkdown(raw);
  throw new Error(`Unsupported content file type: ${ext}`);
}

/**
 * Markdown lessons: YAML front matter for structure, body becomes the
 * `standard` explanation unless `## depth: simple` style sections are used.
 *
 * Recognised body sections (case-insensitive H2s):
 *   ## 30 seconds | ## Simple | ## Standard | ## Exam | ## Deep
 *   ## Key terms | ## Misconceptions | ## Limitations | ## Examples
 */
export function parseMarkdown(raw: string): Record<string, unknown> {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const front = fmMatch ? (yaml.load(fmMatch[1]!) as Record<string, unknown>) ?? {} : {};
  const body = fmMatch ? fmMatch[2]! : raw;

  const sections = splitSections(body);
  const explanations: Record<string, string> = {};
  const depthMap: Record<string, string> = {
    "30 seconds": "thirty-second",
    "thirty seconds": "thirty-second",
    simple: "simple",
    standard: "standard",
    exam: "exam",
    "exam level": "exam",
    deep: "deep",
  };

  const keyTerms: { term: string; definition: string }[] = [];
  const misconceptions: { belief: string; correction: string }[] = [];
  const limitations: string[] = [];
  const examples: { label: string; body: string }[] = [];

  for (const [heading, content] of sections) {
    const key = heading.trim().toLowerCase();
    if (depthMap[key]) {
      explanations[depthMap[key]!] = content.trim();
    } else if (key === "key terms" || key === "glossary") {
      for (const line of content.split("\n")) {
        const m = line.match(/^[-*]\s*\*\*(.+?)\*\*\s*[—:-]\s*(.+)$/) ?? line.match(/^[-*]\s*(.+?)\s*[—:-]\s+(.+)$/);
        if (m) keyTerms.push({ term: m[1]!.trim(), definition: m[2]!.trim() });
      }
    } else if (key === "misconceptions") {
      for (const line of content.split("\n")) {
        const m = line.match(/^[-*]\s*(.+?)\s*→\s*(.+)$/);
        if (m) misconceptions.push({ belief: m[1]!.trim(), correction: m[2]!.trim() });
      }
    } else if (key === "limitations" || key === "this fails when") {
      for (const line of content.split("\n")) {
        const m = line.match(/^[-*]\s*(.+)$/);
        if (m) limitations.push(m[1]!.trim());
      }
    } else if (key === "examples") {
      examples.push({ label: "Example", body: content.trim() });
    }
  }

  if (!Object.keys(explanations).length && body.trim()) {
    explanations.standard = body.trim();
  }

  return {
    ...front,
    explanations: { ...(front.explanations as object | undefined), ...explanations },
    ...(keyTerms.length ? { keyTerms: [...((front.keyTerms as never[]) ?? []), ...keyTerms] } : {}),
    ...(misconceptions.length ? { misconceptions: [...((front.misconceptions as never[]) ?? []), ...misconceptions] } : {}),
    ...(limitations.length ? { limitations: [...((front.limitations as never[]) ?? []), ...limitations] } : {}),
    ...(examples.length ? { examples: [...((front.examples as never[]) ?? []), ...examples] } : {}),
  };
}

function splitSections(body: string): [string, string][] {
  const out: [string, string][] = [];
  const lines = body.split("\n");
  let heading: string | null = null;
  let buf: string[] = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (heading !== null) out.push([heading, buf.join("\n")]);
      heading = m[1]!;
      buf = [];
    } else if (heading !== null) {
      buf.push(line);
    }
  }
  if (heading !== null) out.push([heading, buf.join("\n")]);
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || entry.startsWith("_")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function isStructured(f: string) {
  return [".yaml", ".yml", ".json"].includes(extname(f).toLowerCase());
}
function isMarkdown(f: string) {
  return [".md", ".markdown"].includes(extname(f).toLowerCase());
}

function zodIssues(file: string, err: z.ZodError): Diagnostic[] {
  return err.issues.map((i) => ({
    level: "error" as const,
    file,
    path: i.path.join("."),
    message: i.message,
  }));
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export function listPacks(root = CONTENT_ROOT): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((d) => {
    if (d.startsWith(".") || d.startsWith("_")) return false;
    const full = join(root, d);
    return statSync(full).isDirectory() && existsSync(join(full, "pack.yaml"));
  });
}

export function loadPack(packId: string, root = CONTENT_ROOT): ContentPack {
  const dir = join(root, packId);
  const diagnostics: Diagnostic[] = [];
  const rel = (f: string) => relative(process.cwd(), f);

  // --- manifest ------------------------------------------------------------
  const manifestFile = join(dir, "pack.yaml");
  const manifestParsed = packManifestSchema.safeParse(readStructured(manifestFile));
  if (!manifestParsed.success) {
    throw new Error(
      `Invalid pack manifest at ${rel(manifestFile)}:\n` +
        manifestParsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
  }
  const manifest = manifestParsed.data;

  // --- syllabuses ----------------------------------------------------------
  const syllabuses: Syllabus[] = [];
  const syllabusDir = join(dir, "syllabus");
  const syllabusFiles = existsSync(syllabusDir)
    ? walk(syllabusDir).filter(isStructured)
    : existsSync(join(dir, "syllabus.yaml"))
      ? [join(dir, "syllabus.yaml")]
      : [];

  for (const f of syllabusFiles) {
    const parsed = syllabusSchema.safeParse(readStructured(f));
    if (!parsed.success) {
      diagnostics.push(...zodIssues(rel(f), parsed.error));
      continue;
    }
    syllabuses.push(parsed.data as unknown as Syllabus);
  }

  // Ids are branded in the domain; content authoring uses plain strings, so the
  // lookup sets are widened here rather than branding every literal in a pack.
  const topicIds = new Set<string>(syllabuses.flatMap((s) => s.topics.map((t) => String(t.id))));
  const objectiveIds = new Set<string>(syllabuses.flatMap((s) => s.objectives.map((o) => String(o.id))));
  const paperIds = new Set<string>(syllabuses.flatMap((s) => s.papers.map((p) => String(p.id))));
  const syllabusIds = new Set<string>(syllabuses.map((s) => String(s.id)));
  const defaultSyllabusId = syllabuses[0]?.id as string | undefined;

  // --- questions -----------------------------------------------------------
  const questions: Question[] = [];
  const seenQuestionIds = new Set<string>();
  for (const f of walk(join(dir, "questions")).filter(isStructured)) {
    const data = readStructured(f);
    const fileParsed = questionFileSchema.safeParse(data);
    if (!fileParsed.success) {
      diagnostics.push(...zodIssues(rel(f), fileParsed.error));
      continue;
    }
    const { defaults, syllabusId: fileSyllabusId, questions: rows } = fileParsed.data;
    for (const [i, row] of rows.entries()) {
      const merged = {
        ...defaults,
        ...row,
        syllabusId: (row as { syllabusId?: string }).syllabusId ?? fileSyllabusId ?? defaultSyllabusId,
        source: (row as { source?: unknown }).source ?? defaults?.source ?? {
          kind: "original",
          licence: manifest.rights?.defaultLicence ?? "owned",
        },
        topicIds: (row as { topicIds?: string[] }).topicIds ?? defaults?.topicIds ?? [],
        difficulty: { ...(defaults?.difficulty ?? {}), ...((row as { difficulty?: object }).difficulty ?? {}) },
        quality: (row as { quality?: object }).quality ?? defaults?.quality,
        paperId: (row as { paperId?: string }).paperId ?? defaults?.paperId,
      };
      const parsed = questionSchema.safeParse(merged);
      if (!parsed.success) {
        diagnostics.push(
          ...zodIssues(rel(f), parsed.error).map((d) => ({ ...d, path: `questions[${i}].${d.path ?? ""}` })),
        );
        continue;
      }
      const q = parsed.data;

      if (seenQuestionIds.has(q.id)) {
        diagnostics.push({ level: "error", file: rel(f), path: q.id, message: `Duplicate question id "${q.id}".` });
        continue;
      }
      seenQuestionIds.add(q.id);

      // Referential integrity — the checks that actually save you.
      for (const t of q.topicIds)
        if (topicIds.size && !topicIds.has(t))
          diagnostics.push({ level: "error", file: rel(f), path: q.id, message: `Unknown topic id "${t}".` });
      for (const o of q.objectiveIds ?? [])
        if (objectiveIds.size && !objectiveIds.has(o))
          diagnostics.push({ level: "warning", file: rel(f), path: q.id, message: `Unknown objective id "${o}".` });
      if (q.paperId && paperIds.size && !paperIds.has(q.paperId))
        diagnostics.push({ level: "error", file: rel(f), path: q.id, message: `Unknown paper id "${q.paperId}".` });
      if (q.syllabusId && syllabusIds.size && !syllabusIds.has(q.syllabusId))
        diagnostics.push({ level: "error", file: rel(f), path: q.id, message: `Unknown syllabus id "${q.syllabusId}".` });

      // Mark-scheme arithmetic.
      if (q.markScheme.points?.length) {
        const sum = q.markScheme.points.reduce((s, p) => s + p.marks, 0);
        if (Math.abs(sum - q.marks) > 0.001)
          diagnostics.push({
            level: "warning",
            file: rel(f),
            path: q.id,
            message: `Mark-scheme points total ${sum} but the question is worth ${q.marks} marks.`,
          });
        const ids = new Set<string>();
        for (const p of q.markScheme.points) {
          if (ids.has(p.id))
            diagnostics.push({ level: "error", file: rel(f), path: q.id, message: `Duplicate mark point id "${p.id}".` });
          ids.add(p.id);
        }
      }
      if (Math.abs(q.markScheme.totalMarks - q.marks) > 0.001)
        diagnostics.push({
          level: "warning",
          file: rel(f),
          path: q.id,
          message: `markScheme.totalMarks (${q.markScheme.totalMarks}) does not equal marks (${q.marks}).`,
        });

      // Objective types need a resolvable answer, or they cannot be marked.
      if (q.type === "mcq" || q.type === "true-false" || q.type === "multi-select") {
        const correct = (q.response?.choices ?? []).filter((c) => c.correct);
        if (!correct.length)
          diagnostics.push({ level: "error", file: rel(f), path: q.id, message: "No option is marked correct." });
        if (q.type !== "multi-select" && correct.length > 1)
          diagnostics.push({ level: "error", file: rel(f), path: q.id, message: "More than one correct option on a single-answer question." });
      }
      if (q.type === "numeric" && !q.markScheme.acceptedValues?.length)
        diagnostics.push({ level: "error", file: rel(f), path: q.id, message: "Numeric question has no acceptedValues." });
      if (q.type === "cloze" && !q.response?.blanks?.length)
        diagnostics.push({ level: "error", file: rel(f), path: q.id, message: "Cloze question has no blanks." });

      // Rights.
      if (q.source.licence === "link-only" && !q.source.url)
        diagnostics.push({ level: "error", file: rel(f), path: q.id, message: "link-only material must carry the official source url." });
      if (q.source.kind === "past-paper" && q.source.licence === "owned")
        diagnostics.push({
          level: "warning",
          file: rel(f),
          path: q.id,
          message: "Past-paper content marked as 'owned'. Confirm you hold the rights, or use 'licensed'/'link-only'.",
        });

      // Time expectation: default from marks if absent.
      const timeSeconds = q.timeSeconds ?? defaultTimeFor(q.marks, q.type);

      questions.push({
        ...q,
        timeSeconds,
        markScheme: { ...q.markScheme },
      } as unknown as Question);
    }
  }

  // --- lessons -------------------------------------------------------------
  const lessons: LessonInput[] = [];
  for (const f of walk(join(dir, "lessons"))) {
    if (!isStructured(f) && !isMarkdown(f)) continue;
    const data = readStructured(f) as Record<string, unknown>;
    const withDefaults = {
      id: data.id ?? basename(f).replace(/\.[^.]+$/, ""),
      syllabusId: data.syllabusId ?? defaultSyllabusId,
      ...data,
    };
    const parsed = lessonSchema.safeParse(withDefaults);
    if (!parsed.success) {
      diagnostics.push(...zodIssues(rel(f), parsed.error));
      continue;
    }
    if (topicIds.size && !topicIds.has(parsed.data.topicId))
      diagnostics.push({ level: "error", file: rel(f), message: `Unknown topic id "${parsed.data.topicId}".` });
    lessons.push(parsed.data);
  }

  // --- cards ---------------------------------------------------------------
  const cards: CardInput[] = [];
  for (const f of walk(join(dir, "flashcards")).filter(isStructured)) {
    const parsed = cardFileSchema.safeParse(readStructured(f));
    if (!parsed.success) {
      diagnostics.push(...zodIssues(rel(f), parsed.error));
      continue;
    }
    parsed.data.cards.forEach((c, i) => {
      cards.push({
        ...c,
        id: c.id ?? `${basename(f).replace(/\.[^.]+$/, "")}-${i + 1}`,
        syllabusId: c.syllabusId ?? parsed.data.syllabusId ?? defaultSyllabusId,
        topicIds: c.topicIds?.length ? c.topicIds : (parsed.data.defaults?.topicIds ?? []),
        kind: c.kind ?? parsed.data.defaults?.kind ?? "basic",
      });
    });
  }

  // --- glossary ------------------------------------------------------------
  const glossary: GlossaryEntryInput[] = [];
  for (const f of walk(join(dir, "glossary")).filter(isStructured)) {
    const parsed = glossaryFileSchema.safeParse(readStructured(f));
    if (!parsed.success) {
      diagnostics.push(...zodIssues(rel(f), parsed.error));
      continue;
    }
    glossary.push(...parsed.data.entries);
  }
  const glossaryFile = join(dir, "glossary.yaml");
  if (existsSync(glossaryFile)) {
    const parsed = glossaryFileSchema.safeParse(readStructured(glossaryFile));
    if (parsed.success) glossary.push(...parsed.data.entries);
    else diagnostics.push(...zodIssues(rel(glossaryFile), parsed.error));
  }

  // --- coverage reporting --------------------------------------------------
  const allTopics = syllabuses.flatMap((s) => s.topics);
  const leafTopics = allTopics.filter((t) => !allTopics.some((c) => c.parentId === t.id));
  const topicsWithQuestions = new Set<string>(questions.flatMap((q) => q.topicIds.map(String))).size;
  const topicsWithLessons = new Set<string>(lessons.map((l) => l.topicId)).size;

  for (const t of leafTopics) {
    const n = questions.filter((q) => q.topicIds.map(String).includes(String(t.id))).length;
    if (n === 0)
      diagnostics.push({ level: "info", file: packId, path: t.id, message: `No questions yet for "${t.title}".` });
  }

  const stats: PackStats = {
    syllabuses: syllabuses.length,
    topics: allTopics.length,
    objectives: syllabuses.reduce((s, x) => s + x.objectives.length, 0),
    questions: questions.length,
    questionMarks: questions.reduce((s, q) => s + q.marks, 0),
    lessons: lessons.length,
    cards: cards.length,
    glossaryTerms: glossary.length,
    topicsWithQuestions,
    topicsWithLessons,
    coverage: leafTopics.length ? topicsWithQuestions / leafTopics.length : 0,
  };

  return { manifest, syllabuses, questions, lessons, cards, glossary, diagnostics, stats };
}

/**
 * Default working time when a pack does not state one. Derived from the shape
 * of real papers: short recall answers run well under a minute a mark, extended
 * writing runs above it.
 */
export function defaultTimeFor(marks: number, type: string): number {
  const perMark =
    type === "mcq" || type === "true-false"
      ? 45
      : type === "essay"
        ? 95
        : type === "calculation" || type === "numeric"
          ? 80
          : marks <= 2
            ? 60
            : 72;
  return Math.round(marks * perMark);
}

export function loadAllPacks(root = CONTENT_ROOT): ContentPack[] {
  return listPacks(root).map((p) => loadPack(p, root));
}

export function summariseDiagnostics(d: Diagnostic[]) {
  return {
    errors: d.filter((x) => x.level === "error").length,
    warnings: d.filter((x) => x.level === "warning").length,
    info: d.filter((x) => x.level === "info").length,
  };
}
