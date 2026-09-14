"use client";

import * as React from "react";
import {
  AlertTriangle, GraduationCap, Info, Lightbulb, Repeat, Sigma, Star,
} from "lucide-react";
import { CALLOUT_LABELS, type CalloutKind } from "@/lib/callout";
import { cn } from "@/lib/utils";

/**
 * The difference between a page of text and a page of notes.
 *
 * Every room in this app could already ask a model for lessons, a summary,
 * key terms or questions, and every one of them came back as prose: correct,
 * complete, and a wall. Nobody revises from a wall. What revision notes have
 * that prose does not is *ranked* information — the fact that must be
 * remembered exactly, the formula with its symbols named, the mistake
 * everybody makes, the thing the examiner actually asks — each one visibly
 * not the same kind of thing as the paragraph around it.
 *
 * Markdown has one construct for that and models already use it unprompted:
 * GitHub's alert syntax, a blockquote whose first line is `[!KEY]`. So the
 * generator is told which ones to use and this draws them. The vocabulary is
 * deliberately small: five kinds somebody revising can tell apart at a
 * glance, rather than a palette of tinted boxes that all mean "look here".
 */
const KINDS: Record<
  CalloutKind,
  { icon: React.ComponentType<{ size?: number; className?: string }>; tone: string; mark: string }
> = {
  key: { icon: Star, tone: "border-l-[var(--accent)] bg-accent-subtle", mark: "text-accent" },
  formula: { icon: Sigma, tone: "border-l-line-strong bg-subtle", mark: "text-secondary" },
  mistake: { icon: AlertTriangle, tone: "border-l-[var(--warning)] bg-surface", mark: "text-warning" },
  exam: { icon: GraduationCap, tone: "border-l-[var(--accent-2)] bg-surface", mark: "text-[var(--accent-2)]" },
  recall: { icon: Repeat, tone: "border-l-line-strong bg-surface", mark: "text-tertiary" },
  note: { icon: Info, tone: "border-l-line-strong bg-surface", mark: "text-tertiary" },
  tip: { icon: Lightbulb, tone: "border-l-line-strong bg-surface", mark: "text-tertiary" },
};

export function Callout({ kind, children }: { kind: CalloutKind; children: React.ReactNode }) {
  const { icon: Icon, tone, mark } = KINDS[kind];
  const label = CALLOUT_LABELS[kind];
  return (
    /* Not an aside: a "must know" is the most load-bearing sentence on the
       page, and marking it complementary would be exactly backwards for
       somebody reading with a screen reader the night before an exam. */
    <div role="group" aria-label={label} className={cn("callout my-3 rounded-r-lg border-l-2 px-3 py-2", tone)}>
      <p className="mb-1 flex items-center gap-1.5">
        <Icon size={12} className={cn("shrink-0", mark)} />
        <span className={cn("eyebrow", mark)}>{label}</span>
      </p>
      {children}
    </div>
  );
}
