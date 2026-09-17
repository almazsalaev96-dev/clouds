"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Send, Sparkles, X } from "lucide-react";
import { Badge, Button, Spinner, Textarea, cx } from "@/components/marketlab/ui/primitives";
import { answerLocally, PROVENANCE_TAGS, type AssistantContext } from "@/lib/marketlab/assistant";

/**
 * The Lab Assistant panel.
 *
 * It answers from a server route when an API key is configured and from
 * MarketLab's own lesson corpus when one is not, and it says which of the two
 * is happening. The key never reaches this component: the browser posts a
 * question to `/api/lab-assistant` and the key lives only in that route's
 * process environment.
 *
 * The page tells the assistant what is on screen through `setLabContext`, so
 * "why did revenue fall?" can be answered about the actual numbers rather than
 * in general.
 */

type Turn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "ai" | "offline";
  links?: Array<{ label: string; href: string }>;
  followUp?: string[];
};

/* A tiny module-level channel. The alternative — threading a provider through
   every page — buys nothing, because there is exactly one assistant. */
let currentContext: AssistantContext | null = null;
const listeners = new Set<() => void>();

export function setLabContext(context: AssistantContext | null) {
  currentContext = context;
  listeners.forEach((l) => l());
}

/** Publishes the page's current inputs and results to the assistant. */
export function useLabContext(context: AssistantContext | null) {
  const serialised = JSON.stringify(context);
  React.useEffect(() => {
    setLabContext(context ? (JSON.parse(serialised) as AssistantContext) : null);
    return () => setLabContext(null);
    // Compared by value: an experiment re-renders on every slider tick and a
    // reference comparison would republish the context each time.
  }, [serialised]); // eslint-disable-line react-hooks/exhaustive-deps
}

const STARTERS = [
  "Explain what is on my screen",
  "What assumptions am I making?",
  "Critique my hypothesis",
  "Suggest a research question",
];

export function LabAssistant({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  const pathname = usePathname();
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    listeners.add(force);
    return () => { listeners.delete(force); };
  }, []);

  React.useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, open]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onOpenChange(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setError(null);
    setDraft("");
    const mine: Turn = { id: `u${Date.now()}`, role: "user", content: text };
    setTurns((t) => [...t, mine]);
    setBusy(true);

    try {
      const response = await fetch("/api/lab-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: text,
          context: currentContext,
          history: turns.slice(-6).map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? `The assistant replied ${response.status}.`);
      setTurns((t) => [...t, {
        id: `a${Date.now()}`,
        role: "assistant",
        content: String(data.answer ?? ""),
        mode: data.mode === "ai" ? "ai" : "offline",
        links: Array.isArray(data.links) ? data.links : undefined,
        followUp: Array.isArray(data.followUp) ? data.followUp : undefined,
      }]);
    } catch (e) {
      // The route is the only thing that can fail here, and when it does the
      // offline assistant still works — it runs in this browser.
      const local = answerLocally(text, currentContext);
      setTurns((t) => [...t, {
        id: `a${Date.now()}`, role: "assistant", content: local.body,
        mode: "offline", links: local.links, followUp: local.followUp,
      }]);
      setError(e instanceof Error ? e.message : "Could not reach the assistant route; answered offline instead.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="ml-no-print fixed inset-0 z-40 lg:left-auto lg:inset-y-0 lg:right-0 lg:w-[26rem]">
      <div className="absolute inset-0 bg-[var(--ml-overlay)] lg:hidden" onClick={() => onOpenChange(false)} aria-hidden />
      <section
        aria-label="Lab Assistant"
        className="ml-fade-in absolute inset-y-0 right-0 flex w-full flex-col border-l border-ml-border bg-ml-surface shadow-ml-lg sm:max-w-[26rem]"
      >
        <header className="flex items-center justify-between gap-2 border-b border-ml-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-ml-accent" aria-hidden />
            <h2 className="ml-h3 text-ml-text">Lab Assistant</h2>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close assistant"
            className="rounded-ml-xs p-1.5 text-ml-text-3 hover:bg-ml-subtle">
            <X size={18} />
          </button>
        </header>

        <div className="ml-scroll flex-1 overflow-y-auto px-4 py-4">
          {turns.length === 0 ? (
            <div>
              <p className="ml-body text-ml-text-2">
                I can explain a concept, check a calculation, question a hypothesis, or help you turn a curiosity into a
                research question.
              </p>
              <p className="ml-small mt-3 text-ml-text-3">
                Every claim I make is labelled with where it came from:
              </p>
              <ul className="mt-2 space-y-1.5">
                {(Object.keys(PROVENANCE_TAGS) as Array<keyof typeof PROVENANCE_TAGS>).map((k) => (
                  <li key={k} className="ml-small flex gap-2 text-ml-text-3">
                    <span className="ml-mono shrink-0 text-ml-accent">[{PROVENANCE_TAGS[k].label}]</span>
                    <span>{PROVENANCE_TAGS[k].meaning}</span>
                  </li>
                ))}
              </ul>
              {currentContext ? (
                <div className="mt-4 rounded-ml-md border border-ml-border bg-ml-inset px-3 py-2.5">
                  <p className="ml-label text-ml-text-4">I can see</p>
                  <p className="ml-small mt-1 text-ml-text-2">
                    {currentContext.experiment ? `The ${currentContext.experiment} experiment` : `The ${currentContext.surface} section`}
                    {currentContext.outputs?.length ? `, with ${currentContext.outputs.length} results on screen.` : "."}
                  </p>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => void ask(s)}
                    className="ml-small rounded-full border border-ml-border px-3 py-1.5 text-ml-text-2 hover:bg-ml-subtle">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {turns.map((t) => (
                <li key={t.id}>
                  {t.role === "user" ? (
                    <div className="ml-auto max-w-[85%] rounded-ml-md rounded-br-sm bg-ml-accent-subtle px-3 py-2">
                      <p className="ml-body text-ml-text">{t.content}</p>
                    </div>
                  ) : (
                    <div>
                      {t.mode ? (
                        <Badge tone={t.mode === "ai" ? "accent" : "neutral"} className="mb-1.5">
                          {t.mode === "ai" ? "AI answer" : "Offline answer"}
                        </Badge>
                      ) : null}
                      <div className="ml-body ml-rich whitespace-pre-wrap text-ml-text-2">
                        <AssistantBody text={t.content} />
                      </div>
                      {t.links?.length ? (
                        <ul className="mt-2 space-y-1">
                          {t.links.map((l) => (
                            <li key={l.href}>
                              <Link href={l.href} className="ml-small text-ml-accent hover:underline">{l.label} →</Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {t.followUp?.length ? (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {t.followUp.map((f) => (
                            <button key={f} type="button" onClick={() => void ask(f)}
                              className="ml-small rounded-full border border-ml-border px-2.5 py-1 text-left text-ml-text-3 hover:bg-ml-subtle">
                              {f}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {busy ? (
            <div className="mt-4 flex items-center gap-2 text-ml-text-3">
              <Spinner /> <span className="ml-small">Thinking…</span>
            </div>
          ) : null}
          {error ? <p className="ml-small mt-3 text-ml-warning">{error}</p> : null}
          <div ref={endRef} />
        </div>

        <form
          className="border-t border-ml-border p-3"
          onSubmit={(e) => { e.preventDefault(); void ask(draft); }}
        >
          <div className="flex items-end gap-2">
            <Textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(draft); }
              }}
              placeholder="Ask about a concept, a number on your screen, or your hypothesis…"
              aria-label="Ask the Lab Assistant"
              className="min-h-[2.75rem]"
            />
            <Button type="submit" variant="primary" disabled={busy || draft.trim().length === 0} aria-label="Send">
              <Send size={15} />
            </Button>
          </div>
          <p className="ml-small mt-2 text-ml-text-4">
            The assistant can be wrong. It will not invent citations, and it will not write your research for you.
          </p>
        </form>
      </section>
    </div>
  );
}

/** Renders the provenance tags as chips and leaves the rest as plain text. */
function AssistantBody({ text }: { text: string }) {
  const parts = text.split(/(\[(?:Known|Your data|Calculated|Assumption|Hypothesis|Suggestion)\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\[(Known|Your data|Calculated|Assumption|Hypothesis|Suggestion)\]$/.exec(part);
        if (!m) return <span key={i}>{renderInline(part)}</span>;
        const tone = m[1] === "Calculated" ? "accent" : m[1] === "Known" ? "neutral" : m[1] === "Suggestion" ? "positive" : "warning";
        return <Badge key={i} tone={tone as "accent" | "neutral" | "positive" | "warning"} className="mr-1 align-middle">{m[1]}</Badge>;
      })}
    </>
  );
}

/** Just enough markdown for the offline answers: **bold**, `code`, - bullets. */
function renderInline(text: string): React.ReactNode {
  const chunks = text.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g);
  return chunks.map((c, i) => {
    if (/^\*\*[^*]+\*\*$/.test(c)) return <strong key={i} className="font-semibold text-ml-text">{c.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(c)) return <code key={i}>{c.slice(1, -1)}</code>;
    if (/^_[^_]+_$/.test(c)) return <em key={i} className={cx("not-italic text-ml-text-4")}>{c.slice(1, -1)}</em>;
    return <React.Fragment key={i}>{c}</React.Fragment>;
  });
}
