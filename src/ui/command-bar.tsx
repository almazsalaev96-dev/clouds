"use client";

/**
 * The command bar.
 *
 * A product with this many capabilities cannot be navigated by menu alone. The
 * command bar is the answer to feature bloat: everything is reachable by typing
 * what you want, and the surface stays calm because it does not have to display
 * every door at once.
 *
 * Matching is natural-language-ish without a model: commands carry keyword
 * aliases, and content (topics, questions, glossary) is searched by substring
 * across title, code and body. Numbers in the query are read as minutes, so
 * "35" produces "Build a 35-minute session".
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView } from "@/view/derive";

interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  keywords: string[];
  run: () => void;
}

export function CommandBar({ onClose, onNavigate }: { onClose: () => void; onNavigate: (href: string) => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { state } = useStore();
  const bundle = useContent();

  useEffect(() => inputRef.current?.focus(), []);

  const go = (href: string) => {
    onNavigate(href);
    onClose();
  };

  const commands = useMemo<Command[]>(() => {
    const out: Command[] = [];
    const now = new Date().toISOString();
    const subjects = state.profile.subjects.filter((s) => !s.archived);

    // --- what should I do now -------------------------------------------
    const minutes = query.match(/\b(\d{1,3})\b/)?.[1];
    for (const m of minutes ? [Number(minutes)] : [10, 25, 45, 90]) {
      if (m < 3 || m > 240) continue;
      out.push({
        id: `session-${m}`,
        label: `Build a ${m}-minute session`,
        group: "Study now",
        hint: "highest value first",
        keywords: ["session", "study", "minutes", "time", "have", String(m)],
        run: () => go(`/session?minutes=${m}`),
      });
    }
    out.push({
      id: "what-next",
      label: "What should I study next?",
      group: "Study now",
      keywords: ["next", "what", "should", "study", "recommend", "priority"],
      run: () => go("/"),
    });
    out.push({
      id: "review",
      label: "Review what is due",
      group: "Study now",
      keywords: ["review", "due", "flashcards", "cards", "recall", "spaced"],
      run: () => go("/review"),
    });
    out.push({
      id: "mistakes",
      label: "Work through my mistakes",
      group: "Study now",
      keywords: ["mistakes", "wrong", "errors", "lost marks", "fix"],
      run: () => go("/mistakes"),
    });
    out.push({
      id: "mock",
      label: "Sit a mock exam",
      group: "Study now",
      keywords: ["mock", "exam", "paper", "timed", "simulate", "test"],
      run: () => go("/mock"),
    });

    // --- weak areas, per subject ----------------------------------------
    for (const enrolment of subjects) {
      const view = buildSubjectView(state, bundle, enrolment, now);
      if (!view) continue;
      out.push({
        id: `weak-${enrolment.syllabusId}`,
        label: `Show my weakest topics in ${view.syllabus.subject}`,
        group: "Diagnose",
        keywords: ["weak", "weakest", "worst", "bad", "struggling", view.syllabus.subject.toLowerCase()],
        run: () => go(`/subjects/${enrolment.syllabusId}`),
      });
      out.push({
        id: `ready-${enrolment.syllabusId}`,
        label: `Am I ready for ${view.syllabus.subject}?`,
        group: "Diagnose",
        hint: `${Math.round(view.readiness.score * 100)}% ready`,
        keywords: ["ready", "readiness", "prepared", "grade", "forecast", view.syllabus.subject.toLowerCase()],
        run: () => go("/readiness"),
      });
    }

    out.push(
      { id: "plan", label: "Plan my week", group: "Organise", keywords: ["plan", "week", "schedule", "calendar"], run: () => go("/plan") },
      { id: "progress", label: "Show my progress", group: "Organise", keywords: ["progress", "analytics", "stats", "trend"], run: () => go("/progress") },
      { id: "notes", label: "Open my notes", group: "Organise", keywords: ["notes", "write"], run: () => go("/notes") },
      { id: "technique", label: "Train exam technique", group: "Learn", keywords: ["technique", "command words", "structure", "essay", "conclusion"], run: () => go("/technique") },
      { id: "tutor", label: "Ask the tutor", group: "Learn", keywords: ["tutor", "ask", "explain", "help", "ai", "chat"], run: () => go("/tutor") },
      { id: "library", label: "Library and content status", group: "Organise", keywords: ["library", "content", "packs", "material"], run: () => go("/library") },
      { id: "settings", label: "Settings", group: "Organise", keywords: ["settings", "theme", "dark", "font", "accessibility", "export", "privacy"], run: () => go("/settings") },
    );

    // --- content search --------------------------------------------------
    const q = query.trim().toLowerCase();
    if (q.length >= 2) {
      const syllabusIds = new Set(subjects.map((s) => s.syllabusId));
      for (const syllabus of bundle.syllabuses) {
        if (syllabusIds.size && !syllabusIds.has(syllabus.id)) continue;
        for (const topic of syllabus.topics) {
          if (`${topic.code} ${topic.title}`.toLowerCase().includes(q)) {
            out.push({
              id: `topic-${topic.id}`,
              label: topic.title,
              group: "Topics",
              hint: `${syllabus.subject} · ${topic.code}`,
              keywords: [topic.title.toLowerCase(), topic.code.toLowerCase()],
              run: () => go(`/topics/${encodeURIComponent(topic.id)}`),
            });
          }
        }
        for (const cw of syllabus.commandWords) {
          if (cw.word.toLowerCase().includes(q)) {
            out.push({
              id: `cw-${syllabus.id}-${cw.word}`,
              label: `Command word: ${cw.word}`,
              group: "Technique",
              hint: cw.aoCeiling.join(" ") || undefined,
              keywords: [cw.word.toLowerCase(), "command word"],
              run: () => go(`/technique?word=${encodeURIComponent(cw.word)}`),
            });
          }
        }
      }
      for (const g of bundle.glossary.slice(0, 400)) {
        if (g.term.toLowerCase().includes(q)) {
          out.push({
            id: `glossary-${g.term}`,
            label: g.term,
            group: "Glossary",
            hint: g.definition.slice(0, 60),
            keywords: [g.term.toLowerCase()],
            run: () => go(`/glossary?term=${encodeURIComponent(g.term)}`),
          });
        }
      }
    }

    return out;
  }, [query, state, bundle]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 12);
    const words = q.split(/\s+/);
    return commands
      .map((c) => {
        const haystack = `${c.label} ${c.group} ${c.keywords.join(" ")}`.toLowerCase();
        let score = 0;
        for (const w of words) {
          if (haystack.includes(w)) score += w.length;
          if (c.label.toLowerCase().startsWith(w)) score += 6;
        }
        return { c, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 14)
      .map((x) => x.c);
  }, [commands, query]);

  useEffect(() => setActive(0), [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  };

  let lastGroup = "";

  return (
    <div className="cmd-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command bar">
      <div className="cmd" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="What do you want to do?  Try “25”, “weakest topics”, “review”…"
          aria-label="Command"
          role="combobox"
          aria-expanded="true"
          aria-controls="cmd-list"
        />
        <div className="cmd-list" id="cmd-list" role="listbox">
          {filtered.length === 0 && <div className="cmd-group">Nothing matched. Try a topic name, or a number of minutes.</div>}
          {filtered.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {header && <div className="cmd-group">{header}</div>}
                <button
                  className="cmd-item"
                  data-active={i === active}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={c.run}
                >
                  {c.label}
                  {c.hint && <span className="cmd-hint">{c.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
