"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FileCode2, FileText, MessageSquare, Paperclip, Search, Trash2, X } from "lucide-react";
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
import { useReviseModel } from "@/components/chat/RevisePicker";
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
  const project = useLiveQuery(
    () => (projectId ? db.projects.get(projectId) : undefined),
    [projectId],
  );

  if (!project) {
    return (
      <SectionIndex
        title="Projects"
        newLabel="New project"
        emptyTitle="No projects yet."
        emptyHint="A project holds instructions and material that every chat started inside it can see — a course, a codebase, a piece of writing you keep coming back to."
        loading={projects === undefined}
        items={(projects ?? []).map((p) => ({
          id: p.id,
          title: p.name || "Untitled project",
          preview: p.description || firstLine(p.instructions) || "No instructions yet",
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
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 className="eyebrow text-faint">
        Ask about this project
      </h2>
      <p className="mt-1 text-xs text-tertiary">
        Read across every file in it at once. &ldquo;Where is the subscription
        system?&rdquo; — nothing gets changed.
      </p>
      <div className="mt-2 flex items-center gap-1.5">
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailBar onBack={onBack} backLabel="All projects">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-0.5">
          <input
            value={project.name}
            onChange={(e) => void db.projects.update(project.id, { name: e.target.value })}
            aria-label="Project name"
            className="tap min-w-0 flex-1 basis-full bg-transparent text-sm font-medium text-primary outline-none sm:basis-0"
          />
          <div className="flex shrink-0 items-center gap-1">
            <SaveBadge state={autosave.state} />
            {/* Not just "New chat": the sidebar has one of those, three inches
                away, that does something different. */}
            <Button size="sm" variant="primary" className="bloom" onClick={() => onNewChatHere(project.id)}>
              <MessageSquare size={13} />
              New chat here
            </Button>
          </div>
        </div>
      </DetailBar>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-3">
        <div className="mx-auto w-full max-w-[var(--measure)] space-y-7">
          <input
            value={project.description}
            onChange={(e) => void db.projects.update(project.id, { description: e.target.value })}
            placeholder="What this project is, in one line"
            aria-label="Project description"
            className="tap focus-inset w-full rounded-md bg-transparent text-sm text-secondary outline-none placeholder:text-tertiary"
          />

          {notice && <p className="text-xs text-warning anim-fade">{notice}</p>}

          {/* Instructions */}
          <section>
            <h2 className="eyebrow text-faint">
              Instructions
            </h2>
            <p className="mt-1 text-xs text-tertiary">
              Sent with every chat in this project, before anything you type.
            </p>
            <textarea
              value={instructions}
              onChange={(e) => {
                setInstructions(e.target.value);
                autosave.save(project.id, { instructions: e.target.value });
              }}
              rows={6}
              placeholder="“You are helping with a second-year thermodynamics course. Use SI units. When I give a numeric answer, check it before agreeing.”"
              aria-label="Project instructions"
              className="focus-inset mt-2 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed text-primary outline-none placeholder:text-tertiary"
            />
          </section>

          {/* Knowledge */}
          <section>
            <div className="flex items-baseline gap-2">
              <h2 className="eyebrow text-faint">
                Knowledge
              </h2>
              <Button
                size="sm"
                variant="secondary"
                className="ml-auto"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip size={13} />
                Add files
              </Button>
            </div>
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

            <div className="mt-2 space-y-1.5">
              {files === undefined ? (
                <div className="skeleton h-9 rounded-lg" />
              ) : files.length === 0 ? (
                <p className="text-xs text-tertiary">
                  Nothing yet. Text files — notes, code, a spec, a transcript.
                </p>
              ) : (
                files.map((f) => {
                  const dropped = overBudget.some((d) => d.id === f.id);
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5",
                        dropped && "opacity-60",
                      )}
                    >
                      <FileText size={14} className="shrink-0 text-tertiary" />
                      <span className="min-w-0 flex-1 truncate text-sm text-primary">{f.name}</span>
                      <span className="tnum shrink-0 text-xs text-faint">{formatBytes(f.size)}</span>
                      {dropped && (
                        <span className="shrink-0 text-xs text-warning">over the limit</span>
                      )}
                      <IconButton
                        label={`Remove ${f.name}`}
                        size={28}
                        onClick={async () => offerUndo(f.name, await removeProjectFile(f.id))}
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    </div>
                  );
                })
              )}
            </div>

            {files !== undefined && files.length > 0 && (
              <div className="mt-2">
                <div className="h-1 overflow-hidden rounded-full bg-inset">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-[var(--dur-layout)]"
                    style={{
                      width: `${Math.min(100, (spent / KNOWLEDGE_BUDGET_TOKENS) * 100)}%`,
                    }}
                  />
                </div>
                <p className="tnum mt-1 text-xs text-faint">
                  {Math.round((spent / KNOWLEDGE_BUDGET_TOKENS) * 100)}% of the knowledge the model
                  can hold
                  {overBudget.length > 0 &&
                    ` — ${overBudget.length} ${overBudget.length === 1 ? "file is" : "files are"} past it and won't be sent`}
                </p>
              </div>
            )}
          </section>

          {/* Ask about the whole thing */}
          <AskPanel project={project} canvases={sortedCanvases} files={files ?? []} configured={configured} />

          {/* Code */}
          <section>
            <div className="flex items-baseline gap-2">
              <h2 className="eyebrow text-faint">
                Code in this project
              </h2>
              <Button
                size="sm"
                variant="secondary"
                className="ml-auto"
                onClick={() => onNewCanvasHere(project.id)}
              >
                <FileCode2 size={13} />
                New code here
              </Button>
            </div>
            <p className="mt-1 text-xs text-tertiary">
              Every edit made here obeys the instructions above, the same way a chat does.
            </p>
            <div className="mt-2 space-y-1">
              {sortedCanvases.length === 0 ? (
                <p className="text-xs text-tertiary">
                  None yet. Code made here can see the project&rsquo;s instructions and its material.
                </p>
              ) : (
                sortedCanvases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onOpenCanvas(c.id)}
                    className="focus-inset lift tap flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors duration-[var(--dur-fast)] hover:bg-subtle"
                  >
                    <FileCode2 size={14} className="shrink-0 text-tertiary" />
                    <span className="min-w-0 flex-1 truncate text-sm text-primary">
                      {c.title || "Untitled"}
                    </span>
                    <span className="shrink-0 text-xs text-faint">
                      {c.kind === "web" ? "web" : c.kind === "doc" ? "doc" : (c.lang ?? "code")}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Chats */}
          <section>
            <h2 className="eyebrow text-faint">
              Chats in this project
            </h2>
            <div className="mt-2 space-y-1">
              {sortedChats.length === 0 ? (
                <p className="text-xs text-tertiary">
                  None yet. A chat started here can see everything above.
                </p>
              ) : (
                sortedChats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onOpenChat(c.id)}
                    className="focus-inset lift tap flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors duration-[var(--dur-fast)] hover:bg-subtle"
                  >
                    <MessageSquare size={14} className="shrink-0 text-tertiary" />
                    <span className="min-w-0 flex-1 truncate text-sm text-primary">{c.title}</span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
