"use client";

/**
 * Design-system components.
 *
 * Small, unopinionated, and styled entirely by the tokens in globals.css. The
 * one rule with teeth: any component that displays a derived number must accept
 * a `because` array and render it behind a "Why?" disclosure. A student who
 * cannot interrogate a number will not act on it.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { RetentionState } from "@/domain/mastery";

export function Card({
  title,
  action,
  children,
  className = "",
  lift,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  lift?: boolean;
}) {
  return (
    <section className={`card ${lift ? "lift" : ""} ${className}`}>
      {(title || action) && (
        <header className="card-head">
          {title && <h2 className="card-title">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  note,
  tone,
  small,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: RetentionState | "accent";
  small?: boolean;
}) {
  const colour =
    tone === "secure" ? "var(--secure)"
      : tone === "stable" ? "var(--stable)"
      : tone === "fading" ? "var(--fading)"
      : tone === "at-risk" ? "var(--risk)"
      : tone === "forgotten" ? "var(--lost)"
      : tone === "accent" ? "var(--accent)"
      : undefined;
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${small ? "small" : ""}`} style={colour ? { color: colour } : undefined}>
        {value}
      </span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

export function Meter({
  value,
  target,
  tone = "accent",
  label,
}: {
  value: number;
  target?: number;
  tone?: "accent" | RetentionState;
  label?: string;
}) {
  const cls = tone === "accent" ? "" : tone === "at-risk" ? "risk" : tone === "forgotten" ? "lost" : tone;
  return (
    <div
      className="meter"
      role="meter"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={`meter-fill ${cls}`} style={{ width: `${Math.max(1, Math.min(100, value * 100))}%` }} />
      {target !== undefined && (
        <div className="meter-target" style={{ left: `${Math.min(100, target * 100)}%` }} title={`Target ${Math.round(target * 100)}%`} />
      )}
    </div>
  );
}

export function Chip({
  children,
  tone,
  title,
}: {
  children: ReactNode;
  tone?: RetentionState | "accent" | "ao1" | "ao2" | "ao3" | "ao4" | "lost";
  title?: string;
}) {
  const cls =
    tone === "at-risk" ? "risk" : tone === "forgotten" ? "lost" : tone ?? "";
  return (
    <span className={`chip ${cls}`} title={title}>
      {children}
    </span>
  );
}

/**
 * The explainability contract, made concrete. Every recommendation, score and
 * forecast in the product renders one of these.
 */
export function Why({ because, label = "Why am I seeing this?" }: { because: string[]; label?: string }) {
  if (!because.length) return null;
  return (
    <details className="why">
      <summary>{label}</summary>
      <ul>
        {because.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </details>
  );
}

export function Callout({
  kind = "info",
  title,
  children,
}: {
  kind?: "info" | "warn" | "danger" | "good";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={`callout ${kind}`}>
      {title && <div className="callout-title">{title}</div>}
      <div>{children}</div>
    </div>
  );
}

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p className="small" style={{ maxWidth: "48ch", margin: "0 auto 14px" }}>{children}</p>}
      {action}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="pill-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          className="pill-tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className="num muted"> · {t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Countdown / count-up timer. Drives both the practice timer and mock exams.
 * Deliberately shows over-run rather than hiding it: knowing you are 40% over
 * budget on a question is the feedback that fixes exam timing.
 */
export function Timer({
  seconds,
  budgetSeconds,
  running,
  mode = "up",
}: {
  seconds: number;
  budgetSeconds?: number;
  running: boolean;
  mode?: "up" | "down";
}) {
  const remaining = budgetSeconds !== undefined ? budgetSeconds - seconds : 0;
  const display = mode === "down" && budgetSeconds !== undefined ? Math.max(0, remaining) : seconds;
  const state =
    budgetSeconds === undefined ? "normal" : remaining < 0 ? "over" : remaining < budgetSeconds * 0.2 ? "warn" : "normal";
  return (
    <span className="timer" data-state={state} aria-live="off">
      {running ? "" : "⏸ "}
      {formatDuration(display)}
      {budgetSeconds !== undefined && mode === "up" && (
        <span className="muted"> / {formatDuration(budgetSeconds)}</span>
      )}
    </span>
  );
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function useTicker(running: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const started = useRef<number | null>(null);
  const accumulated = useRef(0);

  useEffect(() => {
    if (running) {
      started.current = Date.now();
      const t = setInterval(() => {
        setElapsed(accumulated.current + (Date.now() - (started.current ?? Date.now())) / 1000);
      }, 250);
      return () => {
        clearInterval(t);
        accumulated.current += (Date.now() - (started.current ?? Date.now())) / 1000;
        started.current = null;
      };
    }
    return;
  }, [running]);

  return elapsed;
}

export function ActionLink({
  href,
  children,
  primary,
  small,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
  small?: boolean;
}) {
  return (
    <Link href={href} className={`btn ${primary ? "primary" : ""} ${small ? "small" : ""}`}>
      {children}
    </Link>
  );
}

/** Percentage with a consistent house style: no decimals, tabular figures. */
export function Pct({ value, of }: { value: number; of?: number }) {
  const pct = of ? (of === 0 ? 0 : (value / of) * 100) : value * 100;
  return <span className="num">{Math.round(pct)}%</span>;
}

export function Marks({ earned, available }: { earned: number; available: number }) {
  return (
    <span className="num">
      {round1(earned)}<span className="muted">/{available}</span>
    </span>
  );
}

export function round1(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function relativeDays(days: number): string {
  if (days < 0) return `${Math.abs(Math.round(days))} days ago`;
  if (days < 1) return "today";
  if (days < 2) return "tomorrow";
  if (days < 14) return `in ${Math.round(days)} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}

/** A confirm-once destructive button. No modal, no ceremony. */
export function ConfirmButton({
  children,
  confirmLabel = "Sure?",
  onConfirm,
  className = "btn danger small",
}: {
  children: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={className}
      onClick={() => {
        if (armed) {
          onConfirm();
          setArmed(false);
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
