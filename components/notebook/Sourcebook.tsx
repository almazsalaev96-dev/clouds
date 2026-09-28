"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft, ArrowUp, BookOpen, Check, ChevronLeft, Copy, FileText, Globe, Layers, MoreHorizontal, NotebookPen,
  PanelLeftClose, Pin, Plus, Settings2, Sparkles, Square, Trash2, X,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { complete, extractJson, makeFromSources } from "@/lib/generate";
import { whyItFailed } from "@/lib/complete";
import { extractCitations, findIn } from "@/lib/cite";
import { createNote, db, removeSource } from "@/lib/db";
import { offerUndo } from "@/lib/undo";
import { openStudio } from "@/lib/studioBus";
import { chatInstruction, guidePrompt, guideStale, readGuide, readSourceGuide, sourceGuidePrompt, suggestions } from "@/lib/sourcebook";
import type { ToolId } from "@/lib/standards";
import type { AudioOverview, Note, NotebookState, NotebookTurn, Source } from "@/lib/types";
import { uid } from "@/lib/db";
import { Markdown } from "@/components/chat/Markdown";
import { RevisePicker, useReviseModel } from "@/components/chat/RevisePicker";
import { ICONS } from "@/components/studio/StudyTools";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { AudioOverviewCard } from "./AudioOverview";
import { AddSources } from "./AddSources";
import { RoomToggle } from "@/components/ui/RoomToggle";

type Tab = "sources" | "chat" | "studio";

/** The Studio, as a notebook offers it: what a student makes from sources, most asked-for first. */
const STUDIO: { tool: ToolId; name: string }[] = [
  { tool: "mindmap", name: "Mind map" },
  { tool: "guide", name: "Study guide" },
  { tool: "summary", name: "Briefing doc" },
  { tool: "faq", name: "FAQ" },
  { tool: "flashcards", name: "Flashcards" },
  { tool: "quiz", name: "Quiz" },
  { tool: "timeline", name: "Timeline" },
  { tool: "notes", name: "Revision notes" },
  { tool: "glossary", name: "Key terms" },
  { tool: "paper", name: "Exam paper" },
];

/**
 * A notebook made of sources: what you brought on the left, a conversation
 * that answers only from it in the middle, and what you can make from it on
 * the right. On a phone the three are tabs.
 *
 * It is a page underneath — the sources hang off it as they always have —
 * so everything a page can do, it can still do, one press away.
 */
export function Sourcebook({ note, sources, configured, onBack, onOpenPage, onOpenDeck, onOpenPaper }: {
  note: Note;
  sources: Source[];
  configured: Record<string, boolean>;
  onBack: () => void;
  onOpenPage: (id: string) => void;
  onOpenDeck?: (id: string) => void;
  onOpenPaper?: (id: string) => void;
}) {
  const modelId = useReviseModel(configured);
  const roomToggle = React.useContext(RoomToggle);
  const nb: NotebookState = note.nb ?? {};
  /* Held here as well as saved, so a box ticks the moment it is pressed
     rather than when the database says so. */
  const savedOff = (nb.off ?? []).join(",");
  const [offIds, setOffIds] = React.useState<string[]>(nb.off ?? []);
  React.useEffect(() => { setOffIds(savedOff ? savedOff.split(",") : []); }, [savedOff]);
  const off = React.useMemo(() => new Set(offIds), [offIds]);
  const on = sources.filter((s) => !off.has(s.id));
  const [tab, setTab] = React.useState<Tab>(sources.length ? "chat" : "sources");
  const [adding, setAdding] = React.useState(false);
  const [open, setOpen] = React.useState<{ id: string; quote?: string } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);
  const [guiding, setGuiding] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const chatEnd = React.useRef<HTMLDivElement>(null);
  const kept = useLiveQuery(() => db.notes.filter((n) => n.nbOf === note.id).toArray(), [note.id], []);

  /* Written through to the page as it is in the database now, not as this
     render saw it: two things finishing close together (an answer and the
     guide) must not each put back what the other just wrote. */
  const save = React.useCallback(async (patch: Partial<NotebookState>) => {
    const now = await db.notes.get(note.id);
    await db.notes.update(note.id, { nb: { ...(now?.nb ?? {}), ...patch } });
  }, [note.id]);

  /* The guide: what the sources are, taken together, and three questions to
     start on. Written once and again only when the sources change. */
  const ids = sources.map((s) => s.id);
  const stale = guideStale(nb.guide, ids);
  const guideFor = React.useRef("");
  React.useEffect(() => {
    const key = ids.slice().sort().join(",");
    if (!sources.length || !stale || !modelId || guideFor.current === key) return;
    guideFor.current = key;
    setGuiding(true);
    void (async () => {
      try {
        const raw = await complete(guidePrompt(sources), { modelId, maxTokens: 900, temperature: 0.3 });
        const guide = readGuide(extractJson(raw ?? ""), ids);
        if (guide) {
          await save({ guide });
          if (!note.title.trim() || /^Untitled notebook$/i.test(note.title)) await db.notes.update(note.id, { title: guide.title });
        }
      } catch { /* the guide is a help, not the notebook: without it the chat still works */ }
      finally { setGuiding(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, modelId, sources.length]);

  React.useEffect(() => { chatEnd.current?.scrollIntoView?.({ block: "end" }); }, [nb.chat?.length, pending]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    if (!modelId) { setNotice("No key configured yet — add one in Settings."); return; }
    if (!on.length) { setNotice(sources.length ? "Every source is switched off. Tick at least one on the left." : "Add a source first — answers here come only from your sources."); return; }
    setQ("");
    setTab("chat");
    setNotice(null);
    setPending(text);
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const raw = await makeFromSources(chatInstruction(text, nb, nb.chat ?? []), on.map((s) => ({ name: s.name, text: s.text })), modelId, 90_000, { signal: ctl.signal });
      if (ctl.signal.aborted) return;
      if (!raw) { setNotice("Nothing usable came back. Try asking it differently."); return; }
      const { text: body, citations } = extractCitations(raw, on);
      const turn: NotebookTurn = { id: uid(), q: text, body, citations, at: Date.now() };
      const now = await db.notes.get(note.id);
      await save({ chat: [...(now?.nb?.chat ?? []), turn].slice(-60) });
      const missing = citations.filter((c) => !c.found && c.why === "missing").length;
      if (missing) setNotice(`${missing} of ${citations.length} citation${citations.length === 1 ? "" : "s"} could not be found in the source it names — marked with a “?”.`);
    } catch (err) {
      if (!ctl.signal.aborted) setNotice(whyItFailed(err, "That request failed. Check the key and the connection."));
    } finally {
      setPending(null);
      abortRef.current = null;
    }
  };

  const openCite = (turn: NotebookTurn, e: React.MouseEvent) => {
    const href = (e.target as HTMLElement).closest("a")?.getAttribute("href") ?? "";
    const m = href.match(/^#armi-cite-(\d+)$/);
    if (!m) return;
    e.preventDefault();
    const c = turn.citations.find((x) => x.n === Number(m[1]));
    if (!c) return;
    const src = sources.find((s) => s.id === c.sourceId) ?? sources.find((s) => s.name === c.sourceName);
    if (!c.found || !src) {
      setNotice(`Citation ${c.n}: “${c.quote.slice(0, 120)}” is not in ${c.sourceName} — treat that sentence with care.`);
      return;
    }
    setOpen({ id: src.id, quote: c.quote });
    setTab("sources");
  };

  const keepAnswer = async (turn: NotebookTurn) => {
    const made = await createNote({
      title: turn.q.slice(0, 80),
      content: `# ${turn.q}\n\n${turn.body}`,
      citations: turn.citations,
      nbOf: note.id,
      madeFrom: on.map((s) => s.id),
      ...(note.projectId ? { projectId: note.projectId } : {}),
    });
    const now = await db.notes.get(note.id);
    await save({ chat: (now?.nb?.chat ?? []).map((t) => (t.id === turn.id ? { ...t, savedAs: made.id } : t)) });
  };

  const keepText = async (title: string, content: string) => {
    await createNote({ title, content, nbOf: note.id, ...(note.projectId ? { projectId: note.projectId } : {}) });
    setNotice(`Kept as a note: ${title}`);
  };

  const studio = (tool?: ToolId) => {
    if (!on.length) { setNotice("Add a source first — the Studio makes things from your sources."); return; }
    openStudio({
      source: { name: nb.guide?.title || note.title || on[0].name, text: on.map((s) => (on.length > 1 ? `--- ${s.name} ---\n${s.text}` : s.text)).join("\n\n") },
      tool,
      from: { notebookId: note.id, sourceIds: on.map((s) => s.id), projectId: note.projectId },
    });
  };

  const setOff = (ids: string[]) => { setOffIds(ids); void save({ off: ids }); };
  const toggle = (id: string) => {
    const next = new Set(off);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOff([...next]);
  };
  const all = on.length === sources.length;

  const title = note.title || nb.guide?.title || "Untitled notebook";
  const chat = nb.chat ?? [];

  /* ------------------------------------------------------------ panels -- */

  const sourcesPanel = (
    <Panel label="Sources" count={sources.length} action={<Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Plus size={13} /> Add</Button>}>
      {open ? (
        <SourceView
          source={sources.find((s) => s.id === open.id)}
          quote={open.quote}
          modelId={modelId}
          onBack={() => setOpen(null)}
          onTopic={(t) => void ask(`Tell me about ${t}`)}
        />
      ) : sources.length ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <label className="tap flex cursor-pointer items-center gap-2 border-b border-line px-3 py-2 text-xs text-tertiary">
            <span className="flex-1">Select all sources</span>
            <input
              type="checkbox"
              checked={all}
              onChange={() => setOff(all ? sources.map((s) => s.id) : [])}
              aria-label="Select all sources"
              className="size-4 accent-[var(--accent)]"
            />
          </label>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1.5" aria-label="Your sources">
            {sources.map((s) => (
              <li key={s.id} className="group flex items-center gap-1 rounded-lg hover:bg-subtle">
                <button onClick={() => setOpen({ id: s.id })} className="tap focus-inset flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left">
                  {s.url ? <Globe size={14} className="shrink-0 text-[var(--accent-2)]" aria-hidden /> : <BookOpen size={14} className="shrink-0 text-[var(--accent-2)]" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate text-sm text-primary">{s.name}</span>
                </button>
                <SourceMenu name={s.name} onRemove={async () => offerUndo(s.name, await removeSource(s.id))} />
                <input
                  type="checkbox"
                  checked={!off.has(s.id)}
                  onChange={() => toggle(s.id)}
                  aria-label={`Use ${s.name}`}
                  className="mr-2 size-4 shrink-0 accent-[var(--accent)]"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <FileText size={22} className="text-faint" aria-hidden />
          <p className="text-sm text-secondary">Saved sources will appear here</p>
          <p className="text-xs text-tertiary">PDFs, web pages, pasted text, or your own pages.</p>
          <Button size="sm" variant="primary" className="mt-2" onClick={() => setAdding(true)}><Plus size={13} /> Add a source</Button>
        </div>
      )}
    </Panel>
  );

  const chatPanel = (
    <Panel label="Chat" action={<ChatSettings nb={nb} onSave={save} onClear={chat.length ? () => void save({ chat: [] }) : undefined} />}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!sources.length ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent-subtle text-accent"><Plus size={20} /></span>
            <h2 className="text-lg font-medium text-primary">Add a source to get started</h2>
            <p className="text-sm text-tertiary">A chapter, a paper, lecture notes, a web page. Every answer here comes from them, and says exactly where.</p>
            <Button variant="primary" onClick={() => setAdding(true)}>Add sources</Button>
          </div>
        ) : (
          <>
            <section aria-label="Notebook guide" className="mx-auto max-w-2xl">
              {nb.guide && !stale ? (
                <>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent-subtle text-accent"><Sparkles size={18} /></span>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-primary">{nb.guide.title}</h2>
                  <p className="mt-1 text-xs text-tertiary">{sources.length} source{sources.length === 1 ? "" : "s"}</p>
                  <div className="prose-sm mt-3 text-[0.95rem] leading-relaxed text-secondary"><Markdown content={nb.guide.summary} /></div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => void keepText(`${nb.guide!.title} — overview`, nb.guide!.summary)}><Pin size={13} /> Save to note</Button>
                    <Button size="sm" variant="secondary" onClick={() => setTab("studio")}><Sparkles size={13} /> Audio Overview</Button>
                    <Button size="sm" variant="secondary" onClick={() => studio("mindmap")}>{ICONS.mindmap} Mind map</Button>
                  </div>
                </>
              ) : (
                <div className="space-y-2" role="status" aria-label="Writing the notebook guide">
                  <div className="h-7 w-2/3 animate-pulse rounded-lg bg-subtle" />
                  <div className="h-4 w-full animate-pulse rounded bg-subtle" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-subtle" />
                  <p className="text-xs text-tertiary">{guiding ? "Reading your sources…" : modelId ? "" : "Add a key in Settings and the notebook will describe its sources here."}</p>
                </div>
              )}
            </section>

            <ol className="mx-auto mt-6 max-w-2xl space-y-6" aria-label="Conversation">
              {chat.map((t) => (
                <li key={t.id} className="space-y-3">
                  <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-subtle px-3.5 py-2 text-sm text-primary">{t.q}</p>
                  <div className="nb-answer text-[0.95rem] leading-relaxed text-primary" onClick={(e) => openCite(t, e)}>
                    <Markdown content={t.body} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => (t.savedAs ? onOpenPage(t.savedAs) : void keepAnswer(t))} aria-label={t.savedAs ? "Open the saved note" : "Save to note"}>
                      {t.savedAs ? <Check size={13} /> : <Pin size={13} />} {t.savedAs ? "Saved" : "Save to note"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard?.writeText(t.body.replace(/\[(\d+\??)\]\(#armi-cite-\d+\)/g, "[$1]"))} aria-label="Copy the answer"><Copy size={13} /></Button>
                    <span className="ml-auto text-xs text-faint tnum">{t.citations.length ? `${t.citations.filter((c) => c.found).length}/${t.citations.length} quotes found` : ""}</span>
                  </div>
                </li>
              ))}
              {pending && (
                <li className="space-y-3" role="status">
                  <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-subtle px-3.5 py-2 text-sm text-primary">{pending}</p>
                  <p className="flex items-center gap-2 text-sm text-tertiary">
                    <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden /> Reading {on.length} source{on.length === 1 ? "" : "s"}…
                    <button onClick={() => abortRef.current?.abort()} className="btn-touch focus-ring rounded-full px-2 text-xs text-tertiary hover:text-primary"><Square size={10} className="mr-1 inline" />Stop</button>
                  </p>
                </li>
              )}
            </ol>
            <div ref={chatEnd} />
          </>
        )}
      </div>
      {notice && (
        <p role="status" className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-subtle px-3 py-2 text-xs text-secondary">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="shrink-0 text-tertiary hover:text-primary"><X size={13} /></button>
        </p>
      )}
      {sources.length > 0 && (
        <div className="border-t border-line p-3">
          {!pending && suggestions(stale ? undefined : nb.guide, chat).length > 0 && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Suggested questions">
              {suggestions(nb.guide, chat).map((s) => (
                <button key={s} onClick={() => void ask(s)} className="btn-touch focus-ring shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-left text-xs text-secondary hover:border-line-strong hover:text-primary">
                  {s}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} className="flex items-end gap-2 rounded-2xl border border-line bg-field px-3 py-2 focus-within:border-[var(--accent)]">
            <textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(q); } }}
              rows={1}
              placeholder="Ask about your sources…"
              aria-label="Ask about your sources"
              className="max-h-40 min-h-[2rem] flex-1 resize-none bg-transparent py-1 text-sm text-primary outline-none placeholder:text-faint"
            />
            <span className="shrink-0 pb-1.5 text-xs text-tertiary tnum">{on.length} source{on.length === 1 ? "" : "s"}</span>
            <button type="submit" disabled={!q.trim() || Boolean(pending)} aria-label="Ask" className="ctl [--ctl:2rem] focus-ring flex shrink-0 items-center justify-center rounded-full bg-cta text-cta-fg disabled:opacity-40"><ArrowUp size={15} /></button>
          </form>
          <p className="mt-1.5 text-center text-[0.7rem] text-faint">Answers come only from the ticked sources, and every quote is checked against them.</p>
        </div>
      )}
    </Panel>
  );

  const made = [
    ...(kept ?? []).map((n) => ({ key: n.id, kind: "page" as const, id: n.id, label: n.title || "Untitled note", at: n.updatedAt })),
    ...(nb.made ?? []).filter((m) => m.kind !== "page").map((m) => ({ key: m.id, kind: m.kind, id: m.id, label: m.label, at: m.at })),
  ].sort((a, b) => b.at - a.at);

  const studioPanel = (
    <Panel label="Studio">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <AudioOverviewCard
          title={title}
          sources={on}
          audio={nb.audio}
          modelId={modelId}
          onSave={async (audio: AudioOverview | undefined) => save({ audio })}
          onKeep={keepText}
          onNotice={setNotice}
        />
        <div>
          <ul className="grid grid-cols-2 gap-1.5" aria-label="Make from these sources">
            {STUDIO.map((s) => (
              <li key={s.tool}>
                <button
                  onClick={() => studio(s.tool)}
                  className="tap focus-ring flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-2.5 text-left text-sm text-secondary transition-colors hover:border-line-strong hover:text-primary"
                >
                  <span className="text-accent">{ICONS[s.tool]}</span>
                  <span className="truncate">{s.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => studio()} className="btn-touch focus-ring mt-1.5 w-full rounded-xl px-2 py-1.5 text-xs text-tertiary hover:bg-subtle hover:text-primary">All study tools…</button>
        </div>
        <section aria-label="Notes">
          <div className="mb-1.5 flex items-center gap-2">
            <p className="eyebrow flex-1 text-faint">Notes</p>
            <Button size="sm" variant="ghost" onClick={async () => { const n = await createNote({ title: "New note", nbOf: note.id, ...(note.projectId ? { projectId: note.projectId } : {}) }); onOpenPage(n.id); }}><NotebookPen size={13} /> Add note</Button>
          </div>
          {made.length ? (
            <ul className="space-y-0.5">
              {made.map((m) => (
                <li key={m.key}>
                  <button
                    onClick={() => (m.kind === "page" ? onOpenPage(m.id) : m.kind === "deck" ? onOpenDeck?.(m.id) : onOpenPaper?.(m.id))}
                    className="tap focus-inset flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-secondary hover:bg-subtle hover:text-primary"
                  >
                    {m.kind === "deck" ? <Layers size={14} className="shrink-0 text-tertiary" /> : m.kind === "paper" ? ICONS.paper : <FileText size={14} className="shrink-0 text-tertiary" />}
                    <span className="min-w-0 flex-1 truncate">{m.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 text-xs text-tertiary">Saved answers and what you make here are kept here.</p>
          )}
        </section>
      </div>
    </Panel>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-sourcebook>
      <header className="flex shrink-0 items-center gap-2 px-3 py-2 sm:px-4">
        {roomToggle && <div className="has-room-toggle -ml-1">{roomToggle}</div>}
        <button onClick={onBack} aria-label="All pages" className="ctl focus-ring flex [--ctl:2rem] items-center justify-center rounded-full text-tertiary hover:bg-subtle hover:text-primary"><ArrowLeft size={16} /></button>
        <input
          value={note.title}
          onChange={(e) => void db.notes.update(note.id, { title: e.target.value, updatedAt: Date.now() })}
          placeholder="Untitled notebook"
          aria-label="Notebook name"
          className="ctl-h [--ctl:2.25rem] min-w-0 flex-1 truncate bg-transparent text-lg font-medium text-primary outline-none placeholder:text-faint"
        />
        <Button size="sm" variant="ghost" onClick={() => void db.notes.update(note.id, { view: "page" })} aria-label="Open as a page"><PanelLeftClose size={13} /><span className="hidden sm:inline">As a page</span></Button>
        <RevisePicker configured={configured} />
      </header>

      {/* On a phone and a small tablet, one panel at a time. */}
      <div role="tablist" aria-label="Notebook" className="mx-3 mb-2 grid shrink-0 grid-cols-3 gap-1 rounded-xl bg-subtle p-1 lg:hidden">
        {(["sources", "chat", "studio"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("ctl-h [--ctl:2.25rem] focus-ring rounded-lg text-sm capitalize transition-colors", tab === t ? "bg-surface font-medium text-primary shadow-sm" : "text-tertiary hover:text-primary")}
          >
            {t}{t === "sources" && sources.length ? ` · ${sources.length}` : ""}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 px-3 pb-3 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)_minmax(17rem,21rem)]">
        <div className={cn("min-h-0", tab === "sources" ? "flex" : "hidden", "lg:flex")}>{sourcesPanel}</div>
        <div className={cn("min-h-0", tab === "chat" ? "flex" : "hidden", "lg:flex")}>{chatPanel}</div>
        <div className={cn("min-h-0", tab === "studio" ? "flex" : "hidden", "lg:flex")}>{studioPanel}</div>
      </div>

      {adding && (
        <AddSources
          notebookId={note.id}
          onClose={() => setAdding(false)}
          onAdded={(names) => { setAdding(false); setNotice(`Added ${names.join(", ")}.`); setTab("chat"); }}
        />
      )}
    </div>
  );
}

function Panel({ label, count, action, children }: { label: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-canvas">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3.5">
        <h2 className="flex-1 text-sm font-medium text-primary">{label}{count ? <span className="ml-1.5 text-tertiary tnum">{count}</span> : null}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function SourceMenu({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button aria-label={`More for ${name}`} className="ctl [--ctl:1.75rem] focus-ring flex shrink-0 items-center justify-center rounded-md text-tertiary opacity-70 hover:bg-surface hover:text-primary group-hover:opacity-100">
          <MoreHorizontal size={14} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} className="glass anim-menu z-50 w-48 rounded-xl border border-line p-1 shadow-lg">
          <Popover.Close asChild>
            <button onClick={onRemove} className="tap focus-inset flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--danger)] hover:bg-subtle">
              <Trash2 size={13} /> Remove source
            </button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * One source, read: its guide at the top — written the first time it is
 * opened and kept — then the whole text, with the passage a citation
 * pointed at marked and scrolled to.
 */
function SourceView({ source, quote, modelId, onBack, onTopic }: {
  source?: Source;
  quote?: string;
  modelId: string | null;
  onBack: () => void;
  onTopic: (topic: string) => void;
}) {
  const [writing, setWriting] = React.useState(false);
  const hitRef = React.useRef<HTMLElement>(null);
  const asked = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!source || source.guide || !modelId || asked.current === source.id) return;
    asked.current = source.id;
    setWriting(true);
    void (async () => {
      try {
        const raw = await complete(sourceGuidePrompt(source), { modelId, maxTokens: 600, temperature: 0.3 });
        const guide = readSourceGuide(extractJson(raw ?? ""));
        if (guide) await db.sources.update(source.id, { guide });
      } catch { /* the text is still there to read */ }
      finally { setWriting(false); }
    })();
  }, [source, modelId]);

  React.useEffect(() => { hitRef.current?.scrollIntoView?.({ block: "center" }); }, [quote, source?.id]);

  if (!source) return <p className="p-4 text-sm text-tertiary">That source has been removed.</p>;
  const at = quote ? findIn(source.text, quote) : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label={`Source: ${source.name}`} role="region">
      <div className="flex items-center gap-1.5 border-b border-line px-2 py-1.5">
        <button onClick={onBack} aria-label="Back to the sources" className="ctl [--ctl:2rem] focus-ring flex items-center justify-center rounded-full text-tertiary hover:bg-subtle hover:text-primary"><ChevronLeft size={16} /></button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{source.name}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
        <section aria-label="Source guide" className="mb-4 rounded-xl bg-subtle p-3">
          <p className="eyebrow mb-1 text-faint">Source guide</p>
          {source.guide ? (
            <>
              <div className="text-sm leading-relaxed text-secondary"><Markdown content={source.guide.summary} /></div>
              {source.guide.topics.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {source.guide.topics.map((t) => (
                    <button key={t} onClick={() => onTopic(t)} className="btn-touch focus-ring rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-secondary hover:border-line-strong hover:text-primary">{t}</button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-tertiary">{writing ? "Reading it…" : "No guide yet."}</p>
          )}
        </section>
        {source.url && <a href={source.url} target="_blank" rel="noreferrer noopener" className="mb-3 block truncate text-xs text-accent underline">{source.url}</a>}
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-secondary">
          {at ? (
            <>
              {source.text.slice(Math.max(0, at.start - 20_000), at.start)}
              <mark ref={hitRef} className="rounded bg-accent-subtle px-0.5 text-primary">{source.text.slice(at.start, at.end)}</mark>
              {source.text.slice(at.end, at.end + 40_000)}
            </>
          ) : (
            source.text.slice(0, 60_000)
          )}
        </div>
      </div>
    </div>
  );
}

function ChatSettings({ nb, onSave, onClear }: { nb: NotebookState; onSave: (p: Partial<NotebookState>) => Promise<void>; onClear?: () => void }) {
  const [custom, setCustom] = React.useState(nb.custom ?? "");
  const style = nb.style ?? "default";
  const length = nb.length ?? "default";
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button aria-label="Configure the chat" className="ctl [--ctl:2rem] focus-ring flex items-center justify-center rounded-full text-tertiary hover:bg-subtle hover:text-primary"><Settings2 size={15} /></button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} aria-label="Chat settings" className="glass anim-menu z-50 w-80 rounded-2xl border border-line p-3.5 shadow-lg">
          <p className="text-sm font-medium text-primary">Configure the chat</p>
          <p className="eyebrow mb-1.5 mt-3 text-faint">How it answers</p>
          <div role="radiogroup" aria-label="How it answers" className="grid grid-cols-3 gap-1 rounded-xl bg-subtle p-1">
            {([["default", "Default"], ["guide", "Learning guide"], ["custom", "Custom"]] as const).map(([id, name]) => (
              <button key={id} role="radio" aria-checked={style === id} onClick={() => void onSave({ style: id })} className={cn("ctl-h [--ctl:2rem] focus-ring rounded-lg text-xs", style === id ? "bg-surface font-medium text-primary shadow-sm" : "text-tertiary hover:text-primary")}>{name}</button>
            ))}
          </div>
          {style === "guide" && <p className="mt-1.5 text-xs text-tertiary">Explains in steps and checks you understood, rather than handing over answers.</p>}
          {style === "custom" && (
            <textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onBlur={() => void onSave({ custom })}
              rows={3}
              placeholder="“Answer like my biology teacher, with an exam tip at the end”"
              aria-label="Custom style"
              className="field mt-2 w-full resize-none rounded-xl border border-line bg-field px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]"
            />
          )}
          <p className="eyebrow mb-1.5 mt-3 text-faint">Length</p>
          <div role="radiogroup" aria-label="Length of answers" className="grid grid-cols-3 gap-1 rounded-xl bg-subtle p-1">
            {([["shorter", "Shorter"], ["default", "Default"], ["longer", "Longer"]] as const).map(([id, name]) => (
              <button key={id} role="radio" aria-checked={length === id} onClick={() => void onSave({ length: id })} className={cn("ctl-h [--ctl:2rem] focus-ring rounded-lg text-xs", length === id ? "bg-surface font-medium text-primary shadow-sm" : "text-tertiary hover:text-primary")}>{name}</button>
            ))}
          </div>
          {onClear && (
            <Popover.Close asChild>
              <button onClick={onClear} className="tap focus-inset mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-tertiary hover:bg-subtle hover:text-primary"><Trash2 size={13} /> Clear the conversation</button>
            </Popover.Close>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

