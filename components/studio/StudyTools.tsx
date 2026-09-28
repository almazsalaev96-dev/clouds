"use client";

import * as React from "react";
import {
  BookOpen, CalendarDays, ClipboardCheck, FileText, GitBranch, GraduationCap, Headphones, Highlighter,
  Layers, ListChecks, MessageCircleQuestion, NotebookTabs, PenLine, Presentation, Rows3, ScrollText, Sigma, Sparkles, Tags, Trophy,
} from "lucide-react";
import { TOOLS, type ToolId } from "@/lib/studio";
import { openStudio } from "@/lib/studioBus";
import { Button } from "@/components/ui/primitives";

export const ICONS: Record<ToolId, React.ReactNode> = {
  notes: <Highlighter size={16} />,
  guide: <BookOpen size={16} />,
  organiser: <Rows3 size={16} />,
  cornell: <NotebookTabs size={16} />,
  flashcards: <Layers size={16} />,
  quiz: <ListChecks size={16} />,
  paper: <FileText size={16} />,
  questions: <PenLine size={16} />,
  mindmap: <GitBranch size={16} />,
  glossary: <Tags size={16} />,
  timeline: <CalendarDays size={16} />,
  summary: <ScrollText size={16} />,
  worked: <Sigma size={16} />,
  essay: <Presentation size={16} />,
  model: <Trophy size={16} />,
  lesson: <GraduationCap size={16} />,
  plan: <CalendarDays size={16} />,
  listen: <Headphones size={16} />,
  checker: <ClipboardCheck size={16} />,
  faq: <MessageCircleQuestion size={16} />,
};

/**
 * The study tools, at the top of the Studio: every one of them, each a
 * press away, each asking for a book, a page or a topic and then writing
 * to its standard. The same sheet opens from the Notebook, Study and the
 * Tutor, so a tool learned here is the same tool everywhere.
 */
export function StudyTools() {
  const lead = TOOLS.filter((t) => ["notes", "paper", "checker", "flashcards", "quiz", "mindmap"].includes(t.id));
  const rest = TOOLS.filter((t) => !lead.includes(t));
  const [more, setMore] = React.useState(false);
  const tile = (t: (typeof TOOLS)[number]) => (
    <li key={t.id}>
      <button
        onClick={() => openStudio({ tool: t.id })}
        /* "Make flashcards", not "Flashcards": the ready-made apps below
           carry the plain names, and a study tool is a different thing. */
        aria-label={t.id === "checker" ? "Check an answer" : `Make ${t.name.charAt(0).toLowerCase()}${t.name.slice(1)}`}
        className="focus-ring group flex h-full w-full items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-left transition-colors hover:border-[var(--border-strong)]"
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent" aria-hidden>{ICONS[t.id]}</span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-primary">{t.name}</span>
          <span className="mt-0.5 block text-xs leading-snug text-tertiary">{t.blurb}</span>
        </span>
      </button>
    </li>
  );
  return (
    <section aria-label="Study tools" className="mb-6">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-medium text-primary">Study tools</h2>
      </div>
      <button
        onClick={() => openStudio({})}
        className="focus-ring mb-2 flex w-full items-center gap-3 rounded-xl border border-[var(--accent)]/40 bg-accent-subtle px-4 py-3 text-left transition-colors hover:border-[var(--accent)]"
      >
        <Sparkles size={18} className="shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-primary">Make study materials from a book or notes</span>
          <span className="block text-xs text-secondary">Notes, cards, papers and more</span>
        </span>
      </button>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{lead.map(tile)}</ul>
      {more && <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{rest.map(tile)}</ul>}
      <Button size="sm" variant="ghost" className="mt-2" onClick={() => setMore((v) => !v)} aria-expanded={more}>
        {more ? "Fewer tools" : `All ${TOOLS.length} tools`}
      </Button>
    </section>
  );
}
