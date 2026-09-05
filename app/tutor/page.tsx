"use client";

/**
 * The tutor.
 *
 * Not a generic chatbot with a subject prefix. It is given the student's
 * standing, their recorded mistakes, the syllabus's own command-word
 * definitions and what they are currently looking at — so it can decline to
 * re-explain something they have already demonstrated, and can apply the
 * board's actual definitions rather than plausible ones.
 *
 * When no provider is configured the page says so and points at the offline
 * paths, rather than showing a broken text box.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { TUTOR_MODES, type TutorMode } from "@/ai/prompts";
import { MARK_LOSS_LABELS } from "@/domain/question";
import { Card, Callout, Chip, Empty } from "@/ui/components";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function TutorPage() {
  const { state, ready } = useStore();
  const bundle = useContent();
  const now = new Date().toISOString();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [mode, setMode] = useState<TutorMode>("teacher");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; fallback: string } | null>(null);
  const [topicId, setTopicId] = useState<string>("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // No server means no provider, by definition. Probing anyway logs a CORS
    // failure that reads like a fault rather than the expected state.
    if (!/^https?:$/.test(window.location.protocol)) {
      setAvailable(false);
      return;
    }
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((d: { available: boolean }) => setAvailable(d.available))
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages.length]);

  const views = useMemo(
    () =>
      state.profile.subjects
        .filter((s) => !s.archived)
        .map((e) => buildSubjectView(state, bundle, e, now))
        .filter((v): v is SubjectView => v !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, bundle],
  );

  if (!ready) return <p className="muted small">Loading…</p>;
  const view = views[0];
  if (!view) return <Empty title="No subjects yet">Add a subject first.</Empty>;

  const topic = view.syllabus.topics.find((t) => t.id === topicId);

  // The context the tutor is given. Deliberately narrow: what this turn needs,
  // never the whole store.
  const buildContext = () => {
    const weakest = view.priorities.slice(0, 3).map((p) => {
      const t = view.syllabus.topics.find((x) => x.id === p.topicId);
      const m = view.topicMastery.get(p.topicId);
      return `${t?.title ?? p.topicId}: ${Math.round((m?.score ?? 0) * 100)}% mastery, weakest signal ${m?.limitingFactor ?? "unknown"}`;
    });
    const strong = [...view.topicMastery.entries()]
      .filter(([, m]) => m.observations >= 3 && m.score >= 0.75)
      .slice(0, 4)
      .map(([tid]) => view.syllabus.topics.find((t) => t.id === tid)?.title)
      .filter(Boolean);

    return {
      subject: view.syllabus.subject,
      syllabusCode: view.syllabus.code,
      syllabusTitle: view.syllabus.title,
      topicTitle: topic?.title,
      objectives: view.syllabus.objectives.filter((o) => o.topicId === topicId).map((o) => o.statement).slice(0, 20),
      commandWords: view.syllabus.commandWords.map((c) => ({ word: c.word, definition: c.definition, aoCeiling: c.aoCeiling })),
      masterySummary: [
        strong.length ? `Already demonstrated: ${strong.join(", ")} — do not re-teach these.` : "",
        weakest.length ? `Weakest areas: ${weakest.join("; ")}.` : "",
        `Readiness ${Math.round(view.readiness.score * 100)}%, limiting dimension ${view.readiness.limitingDimension?.label ?? "unknown"}.`,
      ].filter(Boolean).join(" "),
      recentMistakes: state.mistakes
        .filter((m) => m.status !== "eliminated")
        .slice(-8)
        .map((m) => `${MARK_LOSS_LABELS[m.category]}${m.requiredPoint ? `: missed "${m.requiredPoint}"` : ""}`),
      targetGrade: view.enrolment.targetGrade,
      daysToExam: view.daysToExam,
    };
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, messages: next, context: buildContext() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({ message: data.error ?? "The tutor could not respond.", fallback: data.fallback ?? "" });
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: data.text }]);
    } catch {
      setError({
        message: "The request did not reach the server.",
        fallback: "Everything else in Lodestar works offline — practice, review, marking and planning are unaffected.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack loose" style={{ maxWidth: 860 }}>
      <header className="stack tight">
        <p className="eyebrow">Tutor</p>
        <h1>{state.profile.tutorName ?? "Your tutor"}</h1>
        <p className="lede">
          It knows what you have already demonstrated, what you keep getting wrong, and this
          syllabus&rsquo;s own command-word definitions — so it can skip what you know and apply the real
          definitions rather than plausible ones.
        </p>
      </header>

      {available === false && (
        <Callout kind="warn" title="No AI provider is configured">
          The tutor needs an API key set server-side (see <code>.env.example</code>). Everything else in
          Lodestar runs without it. In the meantime:{" "}
          <Link href="/subjects">topic explanations, worked examples and misconception notes</Link> are
          available offline, and the hint ladder on each question serves the same purpose as guided
          questioning.
        </Callout>
      )}

      <div className="row between">
        <div className="pill-tabs">
          {TUTOR_MODES.map((m) => (
            <button key={m.id} className="pill-tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)} title={m.blurb}>
              {m.label}
            </button>
          ))}
        </div>
        <select value={topicId} onChange={(e) => setTopicId(e.target.value)} style={{ maxWidth: 240 }} aria-label="Topic context">
          <option value="">No topic context</option>
          {view.syllabus.topics.map((t) => (
            <option key={t.id} value={t.id}>{t.code} {t.title}</option>
          ))}
        </select>
      </div>

      <p className="small muted">{TUTOR_MODES.find((m) => m.id === mode)?.blurb}</p>

      <Card>
        <div className="stack" style={{ minHeight: 240 }}>
          {messages.length === 0 && (
            <div className="stack tight">
              <p className="small muted">Try one of these, or ask anything:</p>
              <div className="row" style={{ gap: 6 }}>
                {[
                  "Explain this like I'm starting from zero",
                  "Why does this happen?",
                  "What would the examiner expect here?",
                  "What's the common mistake on this?",
                  "Connect this to another topic",
                  "Test me on my weakest area",
                ].map((s) => (
                  <button key={s} className="btn small" onClick={() => setInput(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "88%",
                padding: "10px 14px",
                borderRadius: "var(--radius)",
                background: m.role === "user" ? "var(--accent-soft)" : "var(--panel-2)",
                border: "1px solid var(--rule)",
              }}
            >
              <div className="prose small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.68 }}>{m.content}</div>
            </div>
          ))}

          {busy && <p className="small muted">Thinking…</p>}
          {error && (
            <Callout kind="warn" title={error.message}>
              {error.fallback}
            </Callout>
          )}
          <div ref={endRef} />
        </div>
      </Card>

      <div className="row" style={{ alignItems: "flex-end" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
          }}
          placeholder={topic ? `Ask about ${topic.title}…` : "Ask anything about your syllabus…"}
          style={{ minHeight: 70 }}
          aria-label="Message"
          disabled={available === false}
        />
        <button className="btn primary" onClick={() => void send()} disabled={busy || !input.trim() || available === false}>
          Send
        </button>
      </div>
      <p className="tiny muted">
        ⌘/Ctrl + Enter to send. Only the context this question needs is sent — your topic, your
        standing and your recorded mistakes, never your whole store.
      </p>
    </div>
  );
}
