"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import * as Popover from "@radix-ui/react-popover";
import { BookOpen, Check, ChevronDown, FolderOpen, Link2, MessageSquare, Mic, Square, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import type { Note } from "@/lib/types";
import { chunk, rank } from "@/lib/retrieve";
import {
  applyInsert, slashAt, slashFilter, taskCount, titleMatches, transcriptHeading, wikiAt,
  type SlashItem,
} from "@/lib/notebook";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------ head -- */

/**
 * What sits above a page: its name, where it belongs, where it came from,
 * and the way into a chat about it. The name is shown here because a
 * page read in preview used to start at its first section heading, with
 * nothing saying which page it was.
 */
export function PageHead({ note, draft, onOpenChat, onChatAbout, onOpenPage }: {
  note: Note;
  draft: string;
  onOpenChat?: (conversationId: string) => void;
  onChatAbout?: () => void;
  /** The notebook a note was made in. */
  onOpenPage?: (id: string) => void;
}) {
  const book = useLiveQuery(() => (note.nbOf ? db.notes.get(note.nbOf) : undefined), [note.nbOf]);
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const from = useLiveQuery(() => (note.sourceConversationId ? db.conversations.get(note.sourceConversationId) : undefined), [note.sourceConversationId]);
  const project = (projects ?? []).find((p) => p.id === note.projectId);
  /* Shown unless the page already opens with its own name. */
  const first = draft.split("\n").map((l) => l.replace(/^[>*\-\s#]+/, "").trim()).find(Boolean) ?? "";
  const titled = /^\s*#\s/.test(draft) || first === note.title;
  const tasks = taskCount(draft);
  const [open, setOpen] = React.useState(false);

  const move = async (projectId: string | undefined) => {
    await db.notes.update(note.id, { projectId, updatedAt: Date.now() });
    setOpen(false);
  };

  return (
    <div className="mb-4">
      {!titled && note.title && <h1 className="title-field text-primary">{note.title}</h1>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              aria-label={project ? `In the project ${project.name}` : "Add to a project"}
              className="ctl-h [--ctl:1.75rem] focus-ring flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-secondary hover:border-line-strong hover:text-primary"
            >
              <FolderOpen size={12} className="text-tertiary" aria-hidden />
              {project ? project.name : "Add to a project"}
              <ChevronDown size={11} className="text-tertiary" aria-hidden />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="start" sideOffset={6} className="glass anim-menu z-50 w-64 rounded-xl border border-line p-1 shadow-lg" aria-label="Projects">
              <p className="px-2.5 pb-1 pt-1.5 text-xs text-tertiary">A page in a project is part of what that project's chats know.</p>
              {(projects ?? []).map((p) => (
                <button key={p.id} onClick={() => void move(p.id)} className="tap focus-inset flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-secondary hover:bg-subtle hover:text-primary">
                  <FolderOpen size={13} className="shrink-0 text-tertiary" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.id === note.projectId && <Check size={13} className="text-accent" aria-hidden />}
                </button>
              ))}
              {!(projects ?? []).length && <p className="px-2.5 py-1.5 text-sm text-tertiary">No projects yet — make one in Projects.</p>}
              {project && (
                <button onClick={() => void move(undefined)} className="tap focus-inset mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-tertiary hover:bg-subtle hover:text-primary">
                  Take it out of {project.name}
                </button>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {from && onOpenChat && (
          <button onClick={() => onOpenChat(from.id)} className="ctl-h [--ctl:1.75rem] focus-ring flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-secondary hover:border-line-strong hover:text-primary" aria-label={`From the chat ${from.title || "Untitled"}`}>
            <MessageSquare size={12} className="text-tertiary" aria-hidden />
            <span className="max-w-48 truncate">From “{from.title || "a chat"}”</span>
          </button>
        )}
        {book && onOpenPage && (
          <button onClick={() => onOpenPage(book.id)} className="ctl-h [--ctl:1.75rem] focus-ring flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-secondary hover:border-line-strong hover:text-primary" aria-label={`In the notebook ${book.title || "Untitled notebook"}`}>
            <BookOpen size={12} className="text-tertiary" aria-hidden />
            <span className="max-w-48 truncate">In “{book.title || "Untitled notebook"}”</span>
          </button>
        )}
        {tasks.total > 0 && (
          <span className="tnum rounded-full bg-subtle px-2.5 py-1 text-tertiary" aria-label={`${tasks.done} of ${tasks.total} tasks done`}>
            {tasks.done}/{tasks.total} done
          </span>
        )}
        <span className="flex-1" />
        {onChatAbout && (
          <button onClick={onChatAbout} className="ctl-h [--ctl:1.75rem] focus-ring flex items-center gap-1.5 rounded-full bg-accent-subtle px-3 font-medium text-accent hover:brightness-95">
            <Sparkles size={12} aria-hidden /> Chat about this page
          </button>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------- connections -- */

/**
 * At the foot of a page: the pages that are about the same things, and
 * the chats that were opened about this one. The half of a notebook no
 * folder gives you: what else you know that bears on this.
 */
export function PageConnections({ note, pages, exclude, onSelect, onOpenChat }: {
  note: Note;
  pages: { id: string; title: string; content: string }[];
  exclude: Set<string>;
  onSelect: (id: string) => void;
  onOpenChat?: (id: string) => void;
}) {
  const chats = useLiveQuery(() => db.conversations.filter((c) => c.pageId === note.id).toArray(), [note.id], []);
  const related = React.useMemo(() => {
    const others = pages.filter((p) => p.id !== note.id && !exclude.has(p.id) && p.content.trim().length > 40);
    if (!others.length) return [];
    const query = `${note.title} ${note.content.slice(0, 600)}`;
    const hits = rank(query, others.flatMap((p) => chunk(p.id, `${p.title}\n\n${p.content}`, 900)), 20);
    const seen: string[] = [];
    for (const h of hits) if (h.score > 1.2 && !seen.includes(h.source)) seen.push(h.source);
    return seen.slice(0, 4).map((id) => others.find((p) => p.id === id)!).filter(Boolean);
  }, [note.id, note.title, note.content, pages, exclude]);
  if (!related.length && !(chats ?? []).length) return null;
  return (
    <div className="mt-6 space-y-4 border-t border-line pt-3">
      {related.length > 0 && (
        <aside aria-label="Related pages">
          <p className="eyebrow mb-1.5 flex items-center gap-1.5 text-faint"><Link2 size={11} /> Related pages</p>
          <ul className="flex flex-wrap gap-1.5">
            {related.map((p) => (
              <li key={p.id}>
                <button onClick={() => onSelect(p.id)} className="tap focus-inset rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-secondary hover:border-line-strong hover:text-primary">
                  {p.title || "Untitled"}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
      {(chats ?? []).length > 0 && onOpenChat && (
        <aside aria-label="Chats about this page">
          <p className="eyebrow mb-1.5 flex items-center gap-1.5 text-faint"><MessageSquare size={11} /> Chats about this page</p>
          <ul className="flex flex-wrap gap-1.5">
            {(chats ?? []).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6).map((c) => (
              <li key={c.id}>
                <button onClick={() => onOpenChat(c.id)} className="tap focus-inset rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-secondary hover:border-line-strong hover:text-primary">
                  {c.title || "New chat"}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}

/* ---------------------------------------------------- editor assist -- */

/** Where the caret is in a textarea, in page pixels, by the mirror trick. */
function caretPoint(el: HTMLTextAreaElement, pos: number): { x: number; y: number } {
  const style = window.getComputedStyle(el);
  const div = document.createElement("div");
  for (const p of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "paddingTop", "paddingLeft", "paddingRight", "borderTopWidth", "borderLeftWidth", "boxSizing", "whiteSpace", "wordWrap", "tabSize"] as const) {
    (div.style as unknown as Record<string, string>)[p] = style[p] as string;
  }
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.width = `${el.clientWidth}px`;
  div.textContent = el.value.slice(0, pos);
  const span = document.createElement("span");
  span.textContent = el.value.slice(pos, pos + 1) || ".";
  div.appendChild(span);
  document.body.appendChild(div);
  const rect = el.getBoundingClientRect();
  const x = rect.left + span.offsetLeft - el.scrollLeft;
  const y = rect.top + span.offsetTop - el.scrollTop + parseFloat(style.lineHeight || "24");
  document.body.removeChild(div);
  return { x, y };
}

type Popup = { kind: "slash"; start: number; query: string } | { kind: "wiki"; start: number; query: string };

/**
 * The editor's comforts, over a plain textarea: "/" for the block menu
 * and the page's AI, "[[" for a link to another page. Markdown stays the
 * format underneath — the menu writes it, so nothing is locked in.
 */
export function useEditorAssist({ textareaRef, draft, onChange, pages, onAction }: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  draft: string;
  onChange: (value: string) => void;
  pages: { id: string; title: string }[];
  onAction: (action: NonNullable<SlashItem["action"]>) => void;
}) {
  const [popup, setPopup] = React.useState<Popup | null>(null);
  const [at, setAt] = React.useState<{ x: number; y: number } | null>(null);
  const [active, setActive] = React.useState(0);

  const read = (value: string, caret: number) => {
    const s = slashAt(value, caret);
    const w = s ? null : wikiAt(value, caret);
    const next: Popup | null = s ? { kind: "slash", ...s } : w ? { kind: "wiki", ...w } : null;
    setPopup(next);
    setActive(0);
    if (next && textareaRef.current) setAt(caretPoint(textareaRef.current, next.start));
  };

  const items: { key: string; label: string; hint?: string; group?: string; run: () => void }[] = !popup
    ? []
    : popup.kind === "slash"
      ? slashFilter(popup.query).map((s) => ({ key: s.id, label: s.label, hint: s.hint, group: s.action && s.action !== "link" ? "Do" : "Write", run: () => choose(s) }))
      : titleMatches(popup.query, pages, 8).map((p) => ({ key: p.id, label: p.title, run: () => link(p.title) }))
        .concat(popup.query.trim() && !pages.some((p) => p.title.toLowerCase() === popup.query.trim().toLowerCase())
          ? [{ key: "new", label: `New page “${popup.query.trim()}”`, run: () => link(popup.query.trim()) }]
          : []);

  const replace = (insert: string) => {
    const el = textareaRef.current;
    if (!el || !popup) return;
    const caret = el.selectionStart ?? draft.length;
    const r = applyInsert(draft, popup.start, caret, insert);
    /* Written to the box and the caret placed now, not on the next frame: a
       caret set a frame late lands after whatever was typed in between, and
       the next word is written backwards around it. React sees the same
       value on its render and leaves both alone. */
    el.value = r.text;
    el.focus();
    el.setSelectionRange(r.caret, r.caret);
    onChange(r.text);
    setPopup(null);
  };
  const link = (title: string) => {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? draft.length;
    const closes = draft.slice(caret, caret + 2) === "]]";
    replace(closes ? `[[${title}¦` : `[[${title}]]¦`);
  };
  const choose = (s: SlashItem) => {
    if (s.action === "link") { replace("[[¦"); requestAnimationFrame(() => { const el = textareaRef.current; if (el) read(el.value, el.selectionStart ?? 0); }); return; }
    if (s.action) { replace(""); onAction(s.action); return; }
    if (s.id === "date") { replace(`${new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}¦`); return; }
    replace(s.insert ?? "");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!popup || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); items[Math.min(active, items.length - 1)]?.run(); }
    else if (e.key === "Escape") { e.preventDefault(); setPopup(null); }
  };
  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => read(e.target.value, e.target.selectionStart ?? e.target.value.length);
  const onBlur = () => window.setTimeout(() => setPopup(null), 150);
  const listRef = React.useRef<HTMLUListElement>(null);
  /* The list scrolls, so the chosen row is kept in sight as the arrows move. */
  React.useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, popup]);

  const menu = popup && items.length > 0 && at ? (
    <ul
      ref={listRef}
      role="listbox"
      aria-label={popup.kind === "slash" ? "Insert" : "Link to a page"}
      className="glass anim-menu fixed z-50 max-h-72 w-72 overflow-y-auto rounded-xl border border-line p-1 shadow-lg"
      style={{ left: Math.min(at.x, window.innerWidth - 300), top: Math.min(at.y + 4, window.innerHeight - 300) }}
    >
      {items.map((it, i) => (
        <li key={it.key} role="presentation">
          {it.group && it.group !== items[i - 1]?.group && (
            <p aria-hidden className="eyebrow px-2.5 pb-1 pt-2 text-faint">{it.group === "Do" ? "Do with this page" : "Write"}</p>
          )}
          <button
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={it.run}
            onMouseEnter={() => setActive(i)}
            className={cn("tap flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left", i === active ? "bg-subtle" : "")}
          >
            <span className="text-sm text-primary">{it.label}</span>
            {it.hint && <span className="text-xs text-tertiary">{it.hint}</span>}
          </button>
        </li>
      ))}
    </ul>
  ) : null;

  return { onKeyDown, onInput, onBlur, menu, open: Boolean(popup && items.length) };
}

/* -------------------------------------------------------- recorder -- */

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

export function canRecord(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * A lecture, into the page as it is said: the browser's own speech
 * recognition, final phrases written under a transcript heading, the
 * phrase still being heard shown live. Stopped, it offers to turn the
 * transcript into notes. Nothing is recorded as audio or sent anywhere
 * until the student asks for notes.
 */
export function Recorder({ draft, onChange, onDone, onClose }: {
  draft: string;
  onChange: (value: string) => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const [heard, setHeard] = React.useState("");
  const [on, setOn] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [secs, setSecs] = React.useState(0);
  const [stopped, setStopped] = React.useState(false);
  const text = React.useRef(draft);
  text.current = draft;
  const rec = React.useRef<Recognition | null>(null);
  const wanted = React.useRef(false);

  const start = React.useCallback(() => {
    const w = window as unknown as Record<string, new () => Recognition>;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setError("This browser cannot transcribe. Chrome, Edge and Safari can."); return; }
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-GB";
    r.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (final.trim()) {
        const t = final.trim();
        const sentence = t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? "" : ".");
        onChange(`${text.current.replace(/\s+$/, "")} ${sentence}`);
      }
      setHeard(interim);
    };
    /* The browser stops listening after a silence; a lecture has pauses. */
    r.onend = () => { if (wanted.current) { try { r.start(); } catch { setOn(false); } } else setOn(false); };
    r.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { wanted.current = false; setError("The microphone was not allowed. Allow it in the browser's site settings and try again."); } };
    onChange(`${text.current.replace(/\s+$/, "")}${text.current.trim() ? "\n\n" : ""}${transcriptHeading()}\n\n`);
    wanted.current = true;
    rec.current = r;
    try { r.start(); setOn(true); } catch { setError("Recording could not start."); }
  }, [onChange]);

  React.useEffect(() => {
    start();
    return () => { wanted.current = false; rec.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setSecs((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [on]);

  const stop = () => { wanted.current = false; rec.current?.stop(); setOn(false); setStopped(true); setHeard(""); };
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div role="region" aria-label="Lecture recording" className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
      {error ? (
        <p className="min-w-0 flex-1 text-sm text-warning">{error}</p>
      ) : stopped ? (
        <p className="min-w-0 flex-1 text-sm text-secondary">The transcript is on the page. Turn it into notes?</p>
      ) : (
        <p className="min-w-0 flex-1 truncate text-sm text-secondary">
          <span className="mr-2 inline-flex items-center gap-1.5 font-medium text-danger"><span className="size-2 animate-pulse rounded-full bg-[var(--danger)]" aria-hidden /> Recording</span>
          <span className="tnum text-tertiary">{mm}:{ss}</span>
          {heard && <span className="ml-2 italic text-tertiary">{heard}</span>}
        </p>
      )}
      {!stopped && !error && (
        <button onClick={stop} className="btn-touch focus-ring flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-primary hover:bg-subtle">
          <Square size={11} aria-hidden /> Stop
        </button>
      )}
      {stopped && (
        <button onClick={onDone} className="btn-touch focus-ring flex items-center gap-1.5 rounded-full bg-cta px-3 py-1 text-xs font-medium text-cta-fg">
          <Sparkles size={11} aria-hidden /> Make notes from it
        </button>
      )}
      <button onClick={() => { stop(); onClose(); }} className="btn-touch focus-ring rounded-full px-2 py-1 text-xs text-tertiary hover:text-primary">{stopped || error ? "Close" : "Cancel"}</button>
    </div>
  );
}

export { Mic };
