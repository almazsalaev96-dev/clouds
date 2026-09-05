"use client";

/**
 * Notes.
 *
 * Notes that can be tested, not just stored. Any note can be turned into recall
 * cards in one action, because a note you never retrieve is a note you have not
 * learned — and the whole product is built on the finding that producing beats
 * re-reading.
 */

import { useMemo, useState } from "react";
import { useContent, useStore } from "@/store/provider";
import { addCard, uid } from "@/view/actions";
import { Card, Callout, Chip, ConfirmButton, Empty } from "@/ui/components";
import type { Note } from "@/store/types";

export default function NotesPage() {
  const { state, update, ready } = useStore();
  const bundle = useContent();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const topics = useMemo(
    () => bundle.syllabuses.flatMap((s) => s.topics.map((t) => ({ id: t.id, label: `${t.code} ${t.title}`, syllabusId: s.id }))),
    [bundle],
  );

  if (!ready) return <p className="muted small">Loading…</p>;

  const notes = state.notes.filter(
    (n) => !query || `${n.title} ${n.body}`.toLowerCase().includes(query.toLowerCase()),
  );
  const active = state.notes.find((n) => n.id === activeId);

  const create = () => {
    const now = new Date().toISOString();
    const note: Note = { id: uid("note"), title: "Untitled", body: "", topicIds: [], createdAt: now, updatedAt: now };
    update((s) => ({ ...s, notes: [note, ...s.notes] }));
    setActiveId(note.id);
  };

  const patch = (id: string, changes: Partial<Note>) =>
    update((s) => ({
      ...s,
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n)),
    }));

  /**
   * Turn a note into cards. Lines shaped "term — definition" or "Q: … A: …"
   * become cards directly; everything else is left alone rather than guessed
   * at, because a bad auto-generated card is worse than no card.
   */
  const toCards = (note: Note) => {
    const now = new Date().toISOString();
    const made: { front: string; back: string }[] = [];
    for (const raw of note.body.split("\n")) {
      const line = raw.trim().replace(/^[-*]\s*/, "");
      const dash = line.match(/^(.{3,80}?)\s+[—–-]\s+(.{5,})$/);
      const qa = line.match(/^Q:\s*(.+?)\s*A:\s*(.+)$/i);
      if (qa) made.push({ front: qa[1]!, back: qa[2]! });
      else if (dash) made.push({ front: dash[1]!, back: dash[2]! });
    }
    if (!made.length) {
      setMessage(
        'No cards could be made. Write lines as "term — definition" or "Q: … A: …" and they will convert; anything else is left alone rather than guessed at.',
      );
      return;
    }
    update((s) => {
      let next = s;
      for (const m of made) {
        next = addCard(next, {
          syllabusId: bundle.syllabuses[0]?.id,
          topicIds: note.topicIds,
          kind: "definition",
          front: m.front,
          back: m.back,
          origin: "note",
          source: `Note: ${note.title}`,
        }, now);
      }
      return next;
    });
    setMessage(`${made.length} card${made.length === 1 ? "" : "s"} created and scheduled for review.`);
  };

  return (
    <div className="stack loose">
      <header className="row between">
        <div>
          <p className="eyebrow">Notes</p>
          <h1>Notes you can be tested on</h1>
        </div>
        <button className="btn primary" onClick={create}>New note</button>
      </header>

      {message && <Callout kind="info">{message}</Callout>}

      {state.notes.length === 0 ? (
        <Empty title="No notes yet" action={<button className="btn primary" onClick={create}>Write one</button>}>
          Write from memory first, then correct against the source in a different colour. The
          correction pass is where the learning happens — copying is not.
        </Empty>
      ) : (
        <div className="grid two">
          <div className="stack tight">
            <input type="search" placeholder="Search notes…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search notes" />
            {notes.map((n) => (
              <button key={n.id} className="choice" data-selected={activeId === n.id} onClick={() => setActiveId(n.id)}>
                <span>
                  <strong>{n.title || "Untitled"}</strong>
                  <br />
                  <span className="tiny muted">
                    {n.updatedAt.slice(0, 10)} · {n.body.trim() ? `${n.body.trim().split(/\s+/).length} words` : "empty"}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {active ? (
            <Card>
              <div className="stack">
                <input
                  type="text"
                  value={active.title}
                  onChange={(e) => patch(active.id, { title: e.target.value })}
                  aria-label="Note title"
                  style={{ fontFamily: "var(--serif)", fontSize: "1.2rem", border: 0, padding: 0 }}
                />
                <div className="field">
                  <label htmlFor="note-topic" className="tiny">Linked topic</label>
                  <select
                    id="note-topic"
                    value={active.topicIds[0] ?? ""}
                    onChange={(e) => patch(active.id, { topicIds: e.target.value ? [e.target.value] : [] })}
                  >
                    <option value="">Not linked</option>
                    {topics.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <textarea
                  className="answer-box"
                  value={active.body}
                  onChange={(e) => patch(active.id, { body: e.target.value })}
                  aria-label="Note body"
                  placeholder={"Write from memory first.\n\nLines like:\n  Contribution — price minus variable cost per unit\n  Q: What does gearing measure? A: The share of capital employed funded by debt\n\nconvert straight into recall cards."}
                />
                <div className="row">
                  <button className="btn" onClick={() => toCards(active)}>Turn into recall cards</button>
                  <div className="spacer" />
                  <ConfirmButton
                    onConfirm={() => {
                      update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== active.id) }));
                      setActiveId(null);
                    }}
                  >
                    Delete
                  </ConfirmButton>
                </div>
              </div>
            </Card>
          ) : (
            <Card><p className="small muted">Select a note.</p></Card>
          )}
        </div>
      )}
    </div>
  );
}
