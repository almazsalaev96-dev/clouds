"use client";

import type * as React from "react";
import {
  BookOpen, CalendarDays, ClipboardCheck, FileText, GitBranch, GraduationCap, Headphones, Highlighter,
  Layers, ListChecks, MessageCircleQuestion, NotebookTabs, PenTool, PenLine, Presentation, Rows3, ScrollText, Sigma, Sparkles, Tags, Trophy,
} from "lucide-react";
import type { ToolId } from "@/lib/studio";

export const ICONS: Record<ToolId, React.ReactNode> = {
  slides: <Presentation size={16} />,
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
  annotate: <PenTool size={16} />,
};

/* The tiles that used to live here are gone: the Studio opens as a
   column and a bar now (StudioBar.tsx), and the tools are chips above the
   bar. The icons stay, because the bar and the Sourcebook both draw them. */
