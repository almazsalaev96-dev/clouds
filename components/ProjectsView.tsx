"use client";

import * as React from "react";
import { whyItFailed } from "@/lib/complete";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarClock, Check, FileCode2, FileText, FolderOpen, GraduationCap, Lightbulb, MessageSquare, Paperclip, Search, Sparkles, Trash2, X, Plus } from "lucide-react";
import { MessageBar } from "@/components/chat/MessageBar";
import { useDrafts } from "@/lib/store";
import type { Canvas, Project, ProjectFile } from "@/lib/types";
import {
  addProjectFile, db, deleteProject, filesOf, removeProjectFile,
} from "@/lib/db";
import { KNOWLEDGE_BUDGET_TOKENS } from "@/lib/prompt";
import { estimateTokens } from "@/lib/models";
import { offerUndo } from "@/lib/undo";
import { cn, formatBytes } from "@/lib/utils";
import { isPdf, extractPdf } from "@/lib/pdf";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { Button, IconButton, SaveBadge } from "@/components/ui/primitives";
import { Markdown } from "@/components/chat/Markdown";
import { askProject, type Source } from "@/lib/generate";
import { RevisePicker, useReviseModel } from "@/components/chat/RevisePicker";
import { DetailBar, SectionIndex } from "@/components/SectionIndex";

/**
 * Projects.
 *
 * A chat starts from nothing every time, which is fine until the fifth time you
 * paste the same syllabus in. A project is the place that remembers: standing
 * instructions, and material every chat inside it can see without being handed
 * it again.
 *
 * It is deliberately not a folder with magic in it. The instructions are text
 * you can read, the knowledge is files you can see the size of, and the meter
 * says how much of it actually reaches the model — because a project that
 * silently drops the third document is worse than one that never took it.
 */

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const READABLE =
  /\.(md|markdown|txt|csv|tsv|json|ya?ml|toml|ini|env|log|tsx?|jsx?|mjs|cjs|py|rb|go|rs|java|kt|swift|c|h|cpp|cs|php|sh|sql|html?|css|scss)$/i;

export function ProjectsView({
  projectId,
  onSelect,
  onNew,
  onBack,
  onOpenChat,
  onNewChatHere,
  onOpenCanvas,
  onNewCanvasHere,
  configured,
}: {
  projectId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onBack: () => void;
  onOpenChat: (id: string) => void;
  onNewChatHere: (projectId: string) => void;
  onOpenCanvas: (id: string) => void;
  onNewCanvasHere: (projectId: string) => void;
  /** Which providers have a key, for the question box. */
  configured: Record<string, boolean>;
}) {
  const projects = useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray(), []);
  /* What each project holds, for the row. A project is a container, and a
     row that names it without saying what is in it is a label on a closed
     box: "2 files · 3 chats · yesterday" is what decides whether to open it. */
  const counts = useLiveQuery(async () => {
    const [files, chats] = await Promise.all([db.projectFiles.toArray(), db.conversations.toArray()]);
    const out = new Map<string, { files: number; chats: number }>();
    for (const f of files) out.set(f.projectId, { files: (out.get(f.projectId)?.files ?? 0) + 1, chats: out.get(f.projectId)?.chats ?? 0 });
    for (const c of chats) if (c.projectId) out.set(c.projectId, { files: out.get(c.projectId)?.files ?? 0, chats: (out.get(c.projectId)?.chats ?? 0) + 1 });
    return out;
  }, [], new Map<string, { files: number; chats: number }>());
  const project = useLiveQuery(
    () => (projectId ? db.projects.get(projectId) : undefined),
    [projectId],
  );

  if (!project) {
    return (
      <SectionIndex
        title="Projects"
        newLabel="New project"
        right={<RevisePicker configured={configured} />}
        emptyTitle="No projects yet."
        emptyHint="A project holds instructions and material every chat inside it can see — a course, a codebase, a piece of writing."
        waysIn={[{ label: "New project", icon: <Plus size={12} />, onPick: onNew }]}
        loading={projects === undefined}
        items={(projects ?? []).map((p) => ({
          id: p.id,
          title: p.name || "Untitled project",
          icon: <FolderOpen size={16} />,
          preview: p.description || firstLine(p.instructions) || "No instructions yet",
          meta: (() => {
            const c = counts.get(p.id);
            const n = (k: number, one: string) => `${k} ${k === 1 ? one : one + "s"}`;
            return [c?.files ? n(c.files, "file") : null, c?.chats ? n(c.chats, "chat") : null, sinceLabel(p.updatedAt)].filter(Boolean).join(" · ");
          })(),
          searchText: `${p.description} ${p.instructions}`,
        }))}
        onOpen={onSelect}
        onNew={onNew}
        onDelete={async (id) => {
          const name = projects?.find((p) => p.id === id)?.name || "project";
          offerUndo(name, await deleteProject(id));
        }}
      />
    );
  }

  return (
    <ProjectPage
      key={project.id}
      project={project}
      onBack={onBack}
      onOpenChat={onOpenChat}
      onNewChatHere={onNewChatHere}
      onOpenCanvas={onOpenCanvas}
      onNewCanvasHere={onNewCanvasHere}
      configured={configured}
    />
  );
}

/** "today", "yesterday", "5 days ago", or the date. */
function sinceLabel(at: number): string {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function firstLine(s: string): string {
  return s.split("\n").find((l) => l.trim())?.trim() ?? "";
}

/* ------------------------------------------------------------------- ask -- */

/**
 * A question about the project, rather than about one open file.
 *
 * "Where is the subscription system?" is the question people actually have,
 * and until this existed the app could only be asked about the file already
 * open — which means you had to know the answer in order to ask. A project is
 * the only place that knows what all of it is: several canvases, each possibly
 * a folder, plus whatever material was added to it.
 *
 * It never edits, and it is not a chat. A chat inside the project can already
 * do the talking; this is the "explain my project" half — one question, one
 * answer, naming files.
 *
 * What did not fit is named rather than dropped in silence. An answer that
 * says "not in this project" because the file was quietly cut is worse than no
 * answer at all, because you believe it.
 */
function AskPanel({
  project,
  canvases,
  files,
  configured,
}: {
  project: Project;
  canvases: Canvas[];
  files: ProjectFile[];
  configured: Record<string, boolean>;
}) {
  const [question, setQuestion] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [answer, setAnswer] = React.useState<{ text: string; dropped: string[] } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const modelId = useReviseModel(configured);

  const ask = async () => {
    if (!question.trim() || busy) return;
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      /* Read at the moment of asking rather than held in state: a canvas
         edited in the Code section while this page sat open would otherwise be
         answered about as it was when you arrived. */
      const sources: Source[] = [];
      for (const c of canvases) {
        const kids = await db.canvasFiles.where("canvasId").equals(c.id).sortBy("order");
        const title = c.title || "Untitled";
        if (kids.length) {
          for (const k of kids) sources.push({ name: `${title} / ${k.name}`, text: k.content, canvasId: c.id });
        } else if (c.content.trim()) {
          sources.push({ name: title, text: c.content, canvasId: c.id });
        }
      }
      for (const f of files) sources.push({ name: f.name, text: f.text });

      if (!sources.length) {
        setNotice("There is nothing in this project to read yet.");
        return;
      }
      const out = await askProject(question, sources, modelId);
      if (out) setAnswer(out);
      else setNotice("Nothing came back. Try again.");
    } catch (err) {
      setNotice(whyItFailed(err, "That request failed. Check the key and the connection."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <SectionHead
        title="Ask about this project"
        hint="Read across every file in it at once. “Where is the subscription system?” — nothing gets changed."
      />
      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="relative flex min-w-0 flex-1 items-center">
          <Search size={14} className="pointer-events-none absolute left-3 text-tertiary" />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void ask();
            }}
            placeholder="Where is…? How does…? What calls…?"
            aria-label="Ask about this project"
            className="focus-inset tap w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-primary outline-none placeholder:text-tertiary"
          />
        </span>
        <Button size="sm" variant="secondary" onClick={() => void ask()} disabled={busy || !question.trim()}>
          {busy ? "Reading…" : "Ask"}
        </Button>
      </div>

      {notice && <p className="mt-2 text-xs text-warning anim-fade">{notice}</p>}

      {answer && (
        <div className="mt-2 rounded-xl border border-line bg-surface p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="eyebrow text-faint">
              Answer
            </span>
            <IconButton label="Close answer" size={26} className="ml-auto" onClick={() => setAnswer(null)}>
              <X size={14} />
            </IconButton>
          </div>
          <Markdown content={answer.text} />
          {answer.dropped.length > 0 && (
            <p className="mt-2 text-xs text-warning">
              Too large to read this time: {answer.dropped.join(", ")}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * A section's head: a title a reader can find, one line on what it is for,
 * and the action beside them. The page's five sections used to be headed
 * by tiny capitals with the hint under and the button floating off to the
 * right, which made a project read like a settings form.
 */
function SectionHead({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-medium text-primary">{title}</h2>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-tertiary">{hint}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ page -- */

function ProjectPage({
  project,
  onBack,
  onOpenChat,
  onNewChatHere,
  onOpenCanvas,
  onNewCanvasHere,
  configured,
}: {
  project: Project;
  onBack: () => void;
  onOpenChat: (id: string) => void;
  onNewChatHere: (projectId: string) => void;
  onOpenCanvas: (id: string) => void;
  onNewCanvasHere: (projectId: string) => void;
  configured: Record<string, boolean>;
}) {
  const [instructions, setInstructions] = React.useState(project.instructions);
  const [notice, setNotice] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const files = useLiveQuery(() => filesOf(project.id), [project.id]);
  const chats = useLiveQuery(
    () => db.conversations.where("projectId").equals(project.id).toArray(),
    [project.id],
    [],
  );
  const canvases = useLiveQuery(
    () => db.canvases.where("projectId").equals(project.id).toArray(),
    [project.id],
    [],
  );

  React.useEffect(() => setInstructions(project.instructions), [project.id]);

  const autosave = useAutosave<Project>(
    project.id,
    React.useCallback((id, patch) => {
      void db.projects.update(id, { ...patch, updatedAt: Date.now() });
    }, []),
  );

  /* The meter is the honest part. Knowledge is fitted whole files at a time in
     the order it was added, so the same arithmetic runs here as at send time —
     otherwise the page says "3 documents" while the model sees two. */
  const spent = (files ?? []).reduce((n, f) => n + estimateTokens(f.text) + 24, 0);
  const overBudget = React.useMemo(() => {
    const dropped: ProjectFile[] = [];
    let used = 0;
    for (const f of files ?? []) {
      const cost = estimateTokens(f.text) + 24;
      if (used + cost > KNOWLEDGE_BUDGET_TOKENS) dropped.push(f);
      else used += cost;
    }
    return dropped;
  }, [files]);

  const addFiles = async (list: File[]) => {
    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) {
        setNotice(`${file.name} is ${formatBytes(file.size)} — the limit is 20 MB.`);
        continue;
      }
      if (isPdf(file)) {
        // A syllabus, a spec, a paper — project knowledge is a PDF at least as
        // often as it is a text file.
        setNotice(`Reading ${file.name}…`);
        try {
          const { text, pages, imageOnly } = await extractPdf(file);
          setNotice(null);
          if (imageOnly) {
            setNotice(`${file.name} is a scan — ${pages} page${pages === 1 ? "" : "s"} of pictures with no text in them.`);
            continue;
          }
          await addProjectFile(project.id, {
            name: file.name,
            mimeType: "application/pdf",
            text: `${file.name} — ${pages} page${pages === 1 ? "" : "s"}\n\n${text}`,
            size: file.size,
          });
        } catch {
          setNotice(`${file.name} could not be opened. It may be encrypted or damaged.`);
        }
        continue;
      }
      if (!file.type.startsWith("text/") && !READABLE.test(file.name)) {
        setNotice(`${file.name} isn't a text file or a PDF, so there is nothing in it to read.`);
        continue;
      }
      await addProjectFile(project.id, {
        name: file.name,
        mimeType: file.type || "text/plain",
        text: await file.text(),
        size: file.size,
      });
    }
  };

  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  const sortedCanvases = [...canvases].sort((a, b) => b.updatedAt - a.updatedAt);

  /* The notebook, as the reference draws it: an icon, the name large, one
     line on what it is, pills for what it holds, then its chats with their
     dates and a box at the bottom to ask in it. What a project is *for* is
     asked once, on an empty one, as a choice of cards rather than a blank
     instructions box — the choice writes the instructions, which stay
     editable under their pill. */
  const fresh = !project.instructions.trim() && (files?.length ?? 0) === 0 && chats.length === 0;
  const [showInstructions, setShowInstructions] = React.useState(true);
  const [showFiles, setShowFiles] = React.useState(true);
  const [ask, setAsk] = React.useState("");
  const chosenGoal = GOALS.find((g) => g.instructions === instructions.trim())?.id ?? null;
  const pickGoal = (g: (typeof GOALS)[number]) => {
    const next = chosenGoal === g.id ? "" : g.instructions;
    setInstructions(next);
    autosave.save(project.id, { instructions: next });
  };
  const askHere = () => {
    const text = ask.trim();
    if (!text) return;
    /* The words go where the new chat will read them from, then the chat
       is started here: the same path as "New chat here", with the first
       message already in the box. */
    useDrafts.getState().setDraft("new", text);
    setAsk("");
    onNewChatHere(project.id);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailBar onBack={onBack} backLabel="All projects">
        <span className="mr-auto" />
        <SaveBadge state={autosave.state} />
        {/* Not just "New chat": the sidebar has one of those, three inches
            away, that does something different. */}
        <Button size="sm" variant="primary" className="bloom" onClick={() => onNewChatHere(project.id)}>
          <MessageSquare size={13} />
          New chat here
        </Button>
      </DetailBar>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
        <div className="mx-auto w-full max-w-[var(--measure)]">
          {/* The head. */}
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-subtle text-accent" aria-hidden>
            <FolderOpen size={22} />
          </div>
          <div className="mt-4 flex flex-wrap items-start gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1 basis-[16rem]">
              {/* A textarea, not an input: a name longer than the column
                  wraps to a second line the way the reference's does,
                  rather than scrolling inside a box. Enter leaves it. */}
              <textarea
                value={project.name}
                rows={1}
                onChange={(e) => void db.projects.update(project.id, { name: e.target.value.replace(/\n/g, " ") })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
                placeholder="A project or an idea"
                aria-label="Project name"
                className="title-field tap w-full min-w-0 resize-none overflow-hidden bg-transparent font-normal text-primary outline-none placeholder:text-faint"
              />
              <input
                value={project.description}
                onChange={(e) => void db.projects.update(project.id, { description: e.target.value })}
                placeholder="What this project is, in one line"
                aria-label="Project description"
                className="tap mt-1 w-full min-w-0 bg-transparent text-base text-tertiary outline-none placeholder:text-faint"
              />
            </div>
            {/* What it holds, as pills; the ones with a panel open it. */}
            <div className="flex flex-wrap items-center gap-2 pt-2" role="group" aria-label="What this project holds">
              <Pill on={showFiles} onClick={() => setShowFiles((v) => !v)} icon={<FileText size={14} />}>
                {files?.length ? `${files.length} ${files.length === 1 ? "file" : "files"}` : "Files"}
              </Pill>
              <Pill on={showInstructions} onClick={() => setShowInstructions((v) => !v)} icon={<Sparkles size={14} />}>
                Instructions
              </Pill>
            </div>
          </div>

          {notice && <p className="mt-3 text-xs text-warning anim-fade">{notice}</p>}

          {/* What it is for — once, while it is empty. */}
          {fresh && (
            <section className="mt-6" aria-label="What do you want to work on?">
              <p className="text-base text-primary">What do you want to work on?</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {GOALS.map((g) => {
                  const on = chosenGoal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => pickGoal(g)}
                      aria-pressed={on}
                      className={cn(
                        "focus-inset lift relative flex min-h-[7rem] flex-col items-start gap-2 rounded-2xl p-4 text-left transition-colors duration-[var(--dur-fast)]",
                        on ? "bg-accent-subtle" : "bg-section hover:bg-subtle",
                      )}
                    >
                      <span className={cn("text-tertiary", on && "text-accent")}>{g.icon}</span>
                      <span className="text-base font-medium text-primary">{g.title}</span>
                      <span className="text-sm leading-snug text-tertiary">{g.blurb}</span>
                      {on && (
                        <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-surface text-primary" aria-hidden>
                          <Check size={13} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Instructions */}
          {showInstructions && (
            <section className="mt-8">
              <SectionHead title="Instructions" hint="Sent with every chat in this project, before anything you type." />
              <textarea
                value={instructions}
                onChange={(e) => {
                  setInstructions(e.target.value);
                  autosave.save(project.id, { instructions: e.target.value });
                }}
                /* Three rows, not six: one line of instructions inside a box
                   sized for a page reads as a page left blank. It grows with
                   what is typed. */
                rows={Math.min(12, Math.max(3, instructions.split("\n").length + 1))}
                placeholder="“You are helping with a second-year thermodynamics course. Use SI units. When I give a numeric answer, check it before agreeing.”"
                aria-label="Project instructions"
                className="focus-inset mt-2.5 w-full resize-y rounded-2xl border border-line bg-field px-4 py-3 text-sm leading-relaxed text-primary outline-none placeholder:text-tertiary"
              />
            </section>
          )}

          {/* Knowledge */}
          <input
            ref={fileRef}
            type="file"
            multiple
            aria-label="Add files to this project"
            tabIndex={-1}
            className="sr-only"
            onChange={async (e) => {
              setNotice(null);
              await addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          {showFiles && (
            <section className="mt-8">
              <SectionHead
                title="Files"
                hint="Every chat here can read them — notes, code, a spec, a transcript, a PDF."
                action={
                  <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                    <Paperclip size={13} />
                    Add files
                  </Button>
                }
              />
              <div className="mt-2.5 space-y-1.5">
                {files === undefined ? (
                  <div className="skeleton h-9 rounded-lg" />
                ) : files.length === 0 ? (
                  <p className="text-xs text-tertiary">Nothing yet.</p>
                ) : (
                  files.map((f) => {
                    const dropped = overBudget.some((d) => d.id === f.id);
                    return (
                      <div
                        key={f.id}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2",
                          dropped && "opacity-60",
                        )}
                      >
                        <FileText size={14} className="shrink-0 text-tertiary" />
                        <span className="min-w-0 flex-1 truncate text-sm text-primary">{f.name}</span>
                        <span className="tnum shrink-0 text-xs text-faint">{formatBytes(f.size)}</span>
                        {dropped && <span className="shrink-0 text-xs text-warning">over the limit</span>}
                        <IconButton label={`Remove ${f.name}`} size={28} onClick={async () => offerUndo(f.name, await removeProjectFile(f.id))}>
                          <Trash2 size={13} />
                        </IconButton>
                      </div>
                    );
                  })
                )}
              </div>
              {files !== undefined && files.length > 0 && (
                <div className="mt-2">
                  {spent / KNOWLEDGE_BUDGET_TOKENS >= 0.01 && (
                    <div className="h-1 overflow-hidden rounded-full bg-inset">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-[var(--dur-layout)]"
                        style={{ width: `${Math.min(100, (spent / KNOWLEDGE_BUDGET_TOKENS) * 100)}%` }}
                      />
                    </div>
                  )}
                  <p className="tnum text-xs text-faint">
                    {spent / KNOWLEDGE_BUDGET_TOKENS < 0.01
                      ? `About ${spent.toLocaleString()} tokens — all of it reaches the model`
                      : `${Math.round((spent / KNOWLEDGE_BUDGET_TOKENS) * 100)}% of the knowledge the model can hold`}
                    {overBudget.length > 0 &&
                      ` — ${overBudget.length} ${overBudget.length === 1 ? "file is" : "files are"} past it and won't be sent`}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Ask about the whole thing */}
          <div className="mt-8">
            <AskPanel project={project} canvases={sortedCanvases} files={files ?? []} configured={configured} />
          </div>

          {/* Chats, as the reference lists a notebook's: the title, and when. */}
          <section className="mt-8">
            <SectionHead title="Chats in this project" hint="Each one starts with the instructions and the files above." />
            <div className="mt-2.5">
              {sortedChats.length === 0 ? (
                <p className="text-xs text-tertiary">None yet. Ask something below to start one here.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]" aria-label="Chats in this project">
                  {sortedChats.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => onOpenChat(c.id)}
                        className="focus-inset tap flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors duration-[var(--dur-fast)] hover:bg-subtle"
                      >
                        <span className="min-w-0 flex-1 truncate text-base text-primary">{c.title || "New chat"}</span>
                        <span className="shrink-0 text-sm text-tertiary">{sinceLabel(c.updatedAt)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Made here */}
          <section className="mt-8">
            <SectionHead
              title="Made in this project"
              hint="Pages, apps, documents and code made from here follow the instructions above, the same way a chat does."
              action={
                <Button size="sm" variant="secondary" onClick={() => onNewCanvasHere(project.id)}>
                  <Sparkles size={13} />
                  Make something here
                </Button>
              }
            />
            <div className="mt-2.5">
              {sortedCanvases.length === 0 ? (
                <p className="text-xs text-tertiary">Nothing made here yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {sortedCanvases.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => onOpenCanvas(c.id)}
                        className="focus-inset tap flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors duration-[var(--dur-fast)] hover:bg-subtle"
                      >
                        <FileCode2 size={15} className="shrink-0 text-tertiary" />
                        <span className="min-w-0 flex-1 truncate text-base text-primary">{c.title || "Untitled"}</span>
                        <span className="shrink-0 text-sm text-tertiary">{sinceLabel(c.updatedAt)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* The box at the bottom, as the reference has it: ask here and a chat
          starts in this project with the question already in it. */}
      <div className="shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto w-full max-w-[var(--measure)]">
          <MessageBar
            value={ask}
            onChange={setAsk}
            onSubmit={askHere}
            placeholder="Ask in this project…"
            ariaLabel="Ask in this project"
            canSend={Boolean(ask.trim())}
            className="glass"
          />
        </div>
      </div>
    </div>
  );
}

/* What a project can be for. Each writes the standing instructions the
   choice implies; they stay editable under the Instructions pill. */
const GOALS = [
  {
    id: "organise",
    icon: <Lightbulb size={18} />,
    title: "Organise ideas",
    blurb: "Collect, sort and connect what you are thinking.",
    instructions: "Help me organise my ideas. Keep a running structure of the themes as they come up, ask what belongs where, and turn loose notes into a clear outline when I ask.",
  },
  {
    id: "learn",
    icon: <GraduationCap size={18} />,
    title: "Learn and understand",
    blurb: "Track progress and stay focused.",
    instructions: "I am learning this subject. Explain one step at a time, check that I followed before moving on, and keep track of what I have understood and what still needs work.",
  },
  {
    id: "exam",
    icon: <CalendarClock size={18} />,
    title: "Revise for an exam",
    blurb: "Notes, questions and mark schemes, to the syllabus.",
    instructions: "I am revising for an exam. Work to the syllabus and the command words, give practice questions with mark schemes, and point out the mistakes examiners see most.",
  },
  {
    id: "build",
    icon: <Sparkles size={18} />,
    title: "Build something",
    blurb: "A site, an app, a document — made and kept here.",
    instructions: "I am building something in this project. Keep the decisions we make, prefer working things over descriptions of them, and say what changed each time.",
  },
] as const;

/** A pill that opens a panel: the reference's way of showing what a notebook holds. */
function Pill({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "tap focus-inset flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors duration-[var(--dur-fast)]",
        on ? "bg-section text-primary hover:bg-subtle" : "border border-line bg-transparent text-secondary hover:bg-subtle hover:text-primary",
      )}
    >
      <span className="text-tertiary" aria-hidden>{icon}</span>
      {children}
    </button>
  );
}
