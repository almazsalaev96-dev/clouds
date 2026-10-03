/**
 * Opening the Studio from anywhere.
 *
 * The Studio sheet lives once, at the top of the app; every room that has
 * something to make study material from — a book dropped into the
 * Notebook, a page, a document in the Tutor, the Studio room itself —
 * asks for it through this one event rather than each growing its own.
 * Tiny on purpose: it is imported by rooms that load with the first screen.
 */
import type { ToolId } from "./standards";

export interface StudioRequest {
  /** What to make it from. None: the sheet asks. */
  source?: { name: string; text: string };
  /** A tool to start on. */
  tool?: ToolId;
  /** Ask for a file straight away. */
  pick?: boolean;
  /** Write from a topic rather than a source. */
  topic?: string;
  /** Made in a notebook: what is made is listed there, and remembers its sources. */
  from?: { notebookId: string; sourceIds: string[]; projectId?: string };
}

export const STUDIO_EVENT = "armi:studio";

export function openStudio(req: StudioRequest = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<StudioRequest>(STUDIO_EVENT, { detail: req }));
}

/** Words that make a sentence a study ask rather than a build. */
const STUDY = /\b(?:notes?|revis(?:e|ion)|flash ?cards?|cards?|quiz|exam|paper|questions?|mind ?map|glossary|timeline|summar(?:y|ise|ize)|lesson|essay plan|worked examples?|cornell|organi[sz]er|study guide|teach me|explain|gcse|a-?levels?|\bib\b|igcse|sat\b|topic|chapter|syllabus|spec(?:ification)?|mark scheme|model answers?|past paper|textbook)\b/i;
/** Words that make it a thing to build. */
const BUILD = /\b(?:app|site|website|web ?page|landing page|game|tracker|dashboard|calculator|timer|stopwatch|tool|portfolio|form|widget|simulator|visuali[sz]er|generator|player|editor|clock|counter|planner app|to-?do)\b/i;

/**
 * Where a sentence typed into the Studio's bar goes: a topic or an ask
 * for study material opens the sheet on it, a thing that runs is built,
 * a long paste is the source. Pure, so the test can read it.
 */
export function routeStudioAsk(text: string): "study" | "build" | "source" {
  const t = text.trim();
  if (t.length > 600 || t.split("\n").length > 8) return "source";
  const study = STUDY.test(t);
  const build = BUILD.test(t);
  /* "A quiz app", "flashcards site": the study word names the subject of
     the thing to build, and the verb at the front settles the rest. */
  if (build && (/^\s*(?:make|build|create|code|design)\b/i.test(t) || /\b(?:quiz|flash ?cards?|notes?|timeline|glossary|revision)\s+(?:app|site|website|page|game|tool|tracker)\b/i.test(t))) return "build";
  if (build && !study) return "build";
  if (study) return "study";
  /* Neither word: a bare topic ("Osmosis", "The Cold War") in a room for
     study material is a topic. "Make me a …" without a study word is a
     build. */
  if (/^\s*(?:make|build|create|code|write)\s+(?:me\s+)?(?:an?|the)\b/i.test(t)) return "build";
  return "study";
}
