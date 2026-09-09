"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Eye, History, Pencil, Play, RotateCcw, Send, X } from "lucide-react";
import type { Canvas, CanvasVersion } from "@/lib/types";
import { createCanvas, db, deleteCanvas, pushVersion, revertCanvas, versionsOf } from "@/lib/db";
import { offerUndo } from "@/lib/undo";
import { cheapestAvailable, reviseCanvas } from "@/lib/generate";
import { collapse, diffStat, lineDiff, type DiffOp } from "@/lib/diff";
import { cn } from "@/lib/utils";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { Markdown } from "@/components/chat/Markdown";
import { Button, IconButton, SaveBadge } from "@/components/ui/primitives";
import { DetailBar, SectionIndex } from "@/components/SectionIndex";

/**
 * The canvas: a document you and the model both write to.
 *
 * A chat answer longer than a screen is not help, it is homework — you read
 * it, find the three lines that changed, and paste them somewhere by hand. So
 * a revision here comes back as *the document*, and the only question you have
 * to answer is whether to keep it.
 *
 * Which is why nothing a model produces lands without being shown first. The
 * diff is not a nicety: handing the pen to something that rewrites the whole
 * file is only safe if you can see what it touched, and if you cannot, people
 * accept anyway and a quiet deletion in the middle of a working file ships.
 */

const LANGS = ["ts", "tsx", "js", "py", "go", "rs", "sql", "sh", "html", "css", "json", "md"];

export function CanvasView({
  canvasId,
  configured,
  onSelect,
  onNew,
  onBack,
}: {
  canvasId: string | null;
  configured: Record<string, boolean>;
  onSelect: (id: string) => void;
  onNew: () => void;
  onBack: () => void;
}) {
  const canvases = useLiveQuery(() => db.canvases.orderBy("updatedAt").reverse().toArray(), []);
  const canvas = useLiveQuery(() => (canvasId ? db.canvases.get(canvasId) : undefined), [canvasId]);

  if (!canvas) {
    return (
      <SectionIndex
        title="Code"
        newLabel="New canvas"
        emptyTitle="No canvases yet."
        emptyHint="A canvas is a document you and the model both edit. Ask for a change and it comes back revised in place, with a diff, instead of pasted into the conversation."
        loading={canvases === undefined}
        items={(canvases ?? []).map((c) => ({
          id: c.id,
          title: c.title || "Untitled",
          preview: c.content.split("\n").find((l) => l.trim()) ?? "Empty",
          meta: c.kind === "code" ? (c.lang ?? "code") : "doc",
          searchText: c.content,
        }))}
        onOpen={onSelect}
        onNew={onNew}
        onDelete={async (id) => {
          const title = canvases?.find((c) => c.id === id)?.title || "canvas";
          offerUndo(title, await deleteCanvas(id));
        }}
      />
    );
  }

  return <Editor key={canvas.id} canvas={canvas} configured={configured} onBack={onBack} />;
}

/* ---------------------------------------------------------------- editor -- */

type Mode = "edit" | "preview" | "run";

function Editor({
  canvas,
  configured,
  onBack,
}: {
  canvas: Canvas;
  configured: Record<string, boolean>;
  onBack: () => void;
}) {
  const [draft, setDraft] = React.useState(canvas.content);
  const [mode, setMode] = React.useState<Mode>("edit");
  const [instruction, setInstruction] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [proposal, setProposal] = React.useState<{
    content: string;
    note: string;
  } | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [versions, setVersions] = React.useState<CanvasVersion[]>([]);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => setDraft(canvas.content), [canvas.id]);

  const autosave = useAutosave<Canvas>(
    canvas.id,
    React.useCallback((id, patch) => {
      void db.canvases.update(id, { ...patch, updatedAt: Date.now() });
    }, []),
  );

  const runnable = canvas.kind === "code" && (canvas.lang === "html" || canvas.lang === "css");

  const loadVersions = React.useCallback(async () => {
    setVersions(await versionsOf(canvas.id));
  }, [canvas.id]);

  React.useEffect(() => {
    if (showHistory) void loadVersions();
  }, [showHistory, loadVersions]);

  const revise = async () => {
    const text = instruction.trim();
    if (!text || busy) return;
    const modelId = cheapestAvailable(configured);
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings to ask for a revision.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      // The draft, not the saved copy: revising a version of the file you can
      // see on screen but the model cannot is the fastest way to lose an edit.
      const out = await reviseCanvas(draft, text, canvas.kind, canvas.lang, modelId);
      if (!out) setNotice("The model didn't return a usable revision. Try saying it differently.");
      else if (out.trim() === draft.trim())
        setNotice("It came back unchanged — the instruction may not apply here.");
      else setProposal({ content: out, note: text });
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!proposal) return;
    /* Record what was there before replacing it. Without this a canvas whose
       first change comes from the model has no version to go back to — the
       history starts at the rewrite, and "undo" has nothing to undo to.
       Identical states collapse, so this is free when the state is already
       recorded. */
    await pushVersion(canvas.id, draft, "you");
    setDraft(proposal.content);
    await db.canvases.update(canvas.id, {
      content: proposal.content,
      updatedAt: Date.now(),
    });
    await pushVersion(canvas.id, proposal.content, "model", proposal.note);
    setProposal(null);
    setInstruction("");
    void loadVersions();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailBar onBack={onBack} backLabel="All canvases" wide={canvas.kind === "code"}>
        {/* On a phone the title and five controls do not fit on one line, and
            what loses the fight is the title — the one thing that says which
            file you are in. So the row wraps: name first, controls under it. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-0.5">
          <input
            value={canvas.title}
            onChange={(e) => void db.canvases.update(canvas.id, { title: e.target.value })}
            aria-label="Canvas title"
            className="tap min-w-0 flex-1 basis-full bg-transparent text-sm font-medium text-primary outline-none sm:basis-0"
          />
          <div className="flex min-w-0 shrink-0 items-center gap-1">
            <SaveBadge state={autosave.state} />

            {canvas.kind === "code" && (
              <select
                value={canvas.lang ?? "ts"}
                onChange={(e) => void db.canvases.update(canvas.id, { lang: e.target.value })}
                aria-label="Language"
                className="ctl-h focus-inset h-7 rounded-md border border-line bg-surface px-1.5 text-xs text-secondary"
              >
                {LANGS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            )}

            {/* While a revision is waiting, the only decision left is keep or
            discard — so the view controls step out of the way rather than
            offering modes that the diff is already overriding. */}
            {!proposal && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
                >
                  {mode === "edit" ? <Eye size={13} /> : <Pencil size={13} />}
                  {mode === "edit" ? "Preview" : "Edit"}
                </Button>
                {runnable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setMode(mode === "run" ? "edit" : "run")}
                  >
                    <Play size={13} />
                    {mode === "run" ? "Stop" : "Run"}
                  </Button>
                )}
                <IconButton
                  label="Version history"
                  active={showHistory}
                  onClick={() => setShowHistory((v) => !v)}
                >
                  <History size={15} />
                </IconButton>
              </>
            )}
          </div>
        </div>
      </DetailBar>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          {notice && (
            <p className="mx-auto w-full max-w-[var(--measure-wide)] px-4 pt-2 text-xs text-warning anim-fade">
              {notice}
            </p>
          )}

          {proposal ? (
            <DiffView
              wide={canvas.kind === "code"}
              before={draft}
              after={proposal.content}
              note={proposal.note}
              onAccept={accept}
              onReject={() => setProposal(null)}
            />
          ) : mode === "run" ? (
            <Preview canvas={canvas} content={draft} />
          ) : mode === "preview" ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div
                className={cn(
                  "mx-auto w-full",
                  canvas.kind === "code" ? "max-w-[var(--measure-wide)]" : "max-w-[var(--measure)]",
                )}
              >
                {canvas.kind === "code" ? (
                  <CodeBlock code={draft} lang={canvas.lang} filename={canvas.title} />
                ) : (
                  <Markdown content={draft} />
                )}
              </div>
            </div>
          ) : (
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                autosave.save(canvas.id, { content: e.target.value });
              }}
              onBlur={() => void pushVersion(canvas.id, draft, "you")}
              spellCheck={canvas.kind === "doc"}
              aria-label="Canvas content"
              className={cn(
                "min-h-0 flex-1 resize-none bg-transparent px-4 py-4 text-primary outline-none",
                // The editing column matches the bar above it and the box
                // below it. Left unbounded, code ran the full width of a
                // 27-inch screen while its own title sat in a centred column.
                "mx-auto w-full",
                canvas.kind === "code"
                  ? "max-w-[var(--measure-wide)] font-mono text-[13px] leading-[1.7]"
                  : "max-w-[var(--measure)] text-base leading-[1.75]",
              )}
            />
          )}

          {/* Asking for a change is the point of the room, so it sits where
              the composer sits everywhere else in the app. */}
          {!proposal && (
            <div className="composer-dock shrink-0 px-4 pt-2">
              <div
                className={cn(
                  "mx-auto flex w-full items-end gap-2",
                  canvas.kind === "code" ? "max-w-[var(--measure-wide)]" : "max-w-[var(--measure)]",
                )}
              >
                <input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void revise())
                  }
                  placeholder={
                    canvas.kind === "code"
                      ? "Ask for a change — “add retry with backoff”"
                      : "Ask for a change — “tighten the second section”"
                  }
                  aria-label="Ask for a change"
                  className="composer-shell focus-inset h-11 min-w-0 flex-1 rounded-full border px-4 text-[15px] text-primary outline-none placeholder:text-tertiary"
                />
                <button
                  onClick={() => void revise()}
                  disabled={busy || !instruction.trim()}
                  aria-label="Ask for a change"
                  className="bloom focus-inset flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--cta)] text-[var(--cta-fg)] transition-colors disabled:bg-subtle disabled:text-faint"
                >
                  {busy ? <span className="think-orb" aria-hidden /> : <Send size={17} />}
                </button>
              </div>
            </div>
          )}
        </div>

        {showHistory && (
          <VersionList
            versions={versions}
            onRevert={async (id) => {
              await revertCanvas(canvas.id, id);
              const fresh = await db.canvases.get(canvas.id);
              if (fresh) setDraft(fresh.content);
              void loadVersions();
            }}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ diff -- */

function DiffView({
  before,
  after,
  note,
  wide,
  onAccept,
  onReject,
}: {
  before: string;
  after: string;
  note: string;
  wide?: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const ops = React.useMemo(() => lineDiff(before, after), [before, after]);
  const stat = React.useMemo(() => diffStat(ops), [ops]);
  const rows = React.useMemo(() => collapse(ops), [ops]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="glass sticky top-0 z-10 border-b border-line">
        <div
          className={cn(
            "mx-auto flex w-full flex-wrap items-center gap-3 px-4 py-2.5",
            wide ? "max-w-[var(--measure-wide)]" : "max-w-[var(--measure)]",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-sm text-secondary">{note}</span>
          <span className="tnum shrink-0 text-xs">
            <span className="text-success">+{stat.added}</span>{" "}
            <span className="text-danger">−{stat.removed}</span>
          </span>
          <Button size="sm" variant="ghost" onClick={onReject}>
            <X size={13} />
            Discard
          </Button>
          <Button size="sm" variant="primary" className="bloom" onClick={onAccept}>
            <Check size={13} />
            Keep
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <div
          className={cn(
            "mx-auto w-full overflow-x-auto rounded-lg border border-line bg-inset",
            wide ? "max-w-[var(--measure-wide)]" : "max-w-[var(--measure)]",
          )}
        >
          <pre className="min-w-max font-mono text-[12.5px] leading-[1.65]">
            {rows.map((row, i) =>
              row.type === "gap" ? (
                <div
                  key={i}
                  className="select-none bg-subtle px-3 py-0.5 text-center text-[11px] text-faint"
                >
                  {row.count} unchanged {row.count === 1 ? "line" : "lines"}
                </div>
              ) : (
                <div
                  key={i}
                  className={cn(
                    "px-3",
                    row.type === "add" &&
                      "bg-[color-mix(in_srgb,var(--go)_16%,transparent)] text-primary",
                    row.type === "remove" &&
                      "bg-[color-mix(in_srgb,var(--stop)_14%,transparent)] text-secondary",
                    row.type === "same" && "text-tertiary",
                  )}
                >
                  <span className="mr-2 inline-block w-3 select-none text-faint">
                    {row.type === "add" ? "+" : row.type === "remove" ? "−" : " "}
                  </span>
                  {(row as DiffOp).text || " "}
                </div>
              ),
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- preview -- */

function Preview({ canvas, content }: { canvas: Canvas; content: string }) {
  const html =
    canvas.lang === "css" ? `<style>${content}</style><p>Styled sample text.</p>` : content;
  return (
    <div className="mx-auto min-h-0 w-full max-w-[var(--measure-wide)] flex-1 overflow-hidden px-4 py-3">
      {/* Sandboxed with no `allow-same-origin`, so the page cannot reach this
          app's storage, cookies or IndexedDB. It runs its own scripts and
          nothing else — a preview that can read the conversations sitting
          beside it is not a preview, it is an exploit. */}
      <iframe
        title="Preview"
        sandbox="allow-scripts"
        srcDoc={html}
        className="h-full w-full rounded-lg border border-line bg-white"
      />
    </div>
  );
}

/* -------------------------------------------------------------- versions -- */

function VersionList({
  versions,
  onRevert,
  onClose,
}: {
  versions: CanvasVersion[];
  onRevert: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <aside className="glass hidden w-64 shrink-0 flex-col overflow-y-auto border-l border-line md:flex">
      <div className="flex h-10 items-center gap-2 border-b border-line px-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
          History
        </span>
        <IconButton label="Close history" size={26} className="ml-auto" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </div>
      {versions.length === 0 ? (
        <p className="px-3 py-4 text-xs text-tertiary">Nothing saved yet.</p>
      ) : (
        <ul className="p-1.5">
          {versions.map((v, i) => (
            <li key={v.id}>
              <button
                onClick={() => onRevert(v.id)}
                className="focus-inset lift group w-full rounded-lg px-2.5 py-2 text-left hover:bg-subtle"
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-primary">
                    {i === 0 ? "Current" : v.by === "model" ? "Model" : "You"}
                  </span>
                  <span className="tnum ml-auto text-[11px] text-faint">
                    {new Date(v.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                {v.note && (
                  <span className="mt-0.5 block truncate text-[11px] text-tertiary">{v.note}</span>
                )}
                {i > 0 && (
                  <span className="mt-1 hidden items-center gap-1 text-[11px] text-accent group-hover:flex">
                    <RotateCcw size={10} />
                    Restore this
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

/* ---------------------------------------------------------- from the chat -- */

/** Lift a code block or an answer out of a conversation and into a canvas. */
export async function toCanvas(
  content: string,
  opts: {
    title?: string;
    kind?: Canvas["kind"];
    lang?: string;
    conversationId?: string;
  } = {},
): Promise<Canvas> {
  return createCanvas({
    title: opts.title?.slice(0, 80) || "Untitled",
    kind: opts.kind ?? "code",
    lang: opts.lang,
    content,
    sourceConversationId: opts.conversationId,
  });
}
