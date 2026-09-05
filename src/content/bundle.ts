/**
 * Server-side content bundling.
 *
 * Packs are read from disk once per process and handed to the client as plain
 * serialisable data. Content is not student data: it is the same for everyone,
 * so it can be cached aggressively and rendered on the server.
 */

import "server-only";
import { loadAllPacks, type ContentPack } from "./loader";
import type { Syllabus } from "@/domain/curriculum";
import type { Question } from "@/domain/question";
import type { CardInput, GlossaryEntryInput, LessonInput, PackManifest } from "./schema";

export interface ContentBundle {
  packs: { manifest: PackManifest; stats: ContentPack["stats"] }[];
  syllabuses: (Syllabus & { packId: string })[];
  questions: Question[];
  lessons: LessonInput[];
  cards: CardInput[];
  glossary: GlossaryEntryInput[];
  diagnostics: { errors: number; warnings: number; info: number };
}

let cached: ContentBundle | null = null;

export function getBundle(): ContentBundle {
  if (cached && process.env.NODE_ENV === "production") return cached;

  const packs = loadAllPacks();
  const bundle: ContentBundle = {
    packs: packs.map((p) => ({ manifest: p.manifest, stats: p.stats })),
    syllabuses: packs.flatMap((p) => p.syllabuses.map((s) => ({ ...s, packId: p.manifest.id }))),
    questions: packs.flatMap((p) => p.questions),
    lessons: packs.flatMap((p) => p.lessons),
    cards: packs.flatMap((p) => p.cards),
    glossary: packs.flatMap((p) => p.glossary),
    diagnostics: {
      errors: packs.reduce((s, p) => s + p.diagnostics.filter((d) => d.level === "error").length, 0),
      warnings: packs.reduce((s, p) => s + p.diagnostics.filter((d) => d.level === "warning").length, 0),
      info: packs.reduce((s, p) => s + p.diagnostics.filter((d) => d.level === "info").length, 0),
    },
  };
  cached = bundle;
  return bundle;
}

export function getDiagnostics() {
  return loadAllPacks().flatMap((p) =>
    p.diagnostics.map((d) => ({ ...d, packId: p.manifest.id })),
  );
}
