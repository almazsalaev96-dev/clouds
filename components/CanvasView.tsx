"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Bug, Check, Eye, FilePlus2, FileText, History, LayoutTemplate, MessageSquareCode,
  Pencil, Play, RotateCcw, Send, Terminal, Trash2, X,
} from "lucide-react";
import type { Canvas, CanvasFile, CanvasVersion } from "@/lib/types";
import {
  addCanvasFile, createCanvas, createWebCanvas, db, deleteCanvas, deleteCanvasFile,
  filesOfCanvas, pushVersion, revertCanvas, versionsOf,
} from "@/lib/db";
import { offerUndo } from "@/lib/undo";
import { cheapestAvailable, explainCode, reviseCanvas } from "@/lib/generate";
import { collapse, diffStat, lineDiff, type DiffOp } from "@/lib/diff";
import { assembleWeb, ENTRY, locate, webTemplate } from "@/lib/web";
import { cn } from "@/lib/utils";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { useDebounced } from "@/lib/hooks/useDebounced";
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
 *
 * A canvas comes in three shapes. A document is prose. A code file is one
 * file. A **web app** is a folder — markup, styling and behaviour — that runs
 * in a sandboxed frame beside the editor, with its console piped back out, so
 * the loop from "change this" to "see it" never leaves the room.
 */

const LANGS = ["ts", "tsx", "js", "py", "go", "rs", "sql", "sh", "html", "css", "json", "md"];

const LANG_OF: Record<string, string> = {
  html: "html", htm: "html", css: "css", js: "js", mjs: "js", jsx: "js",
  ts: "ts", tsx: "tsx", json: "json", svg: "html", md: "md",
};

const langOfName = (name: string) => LANG_OF[name.split(".").pop()?.toLowerCase() ?? ""] ?? "txt";

/* ----------------------------------------------------------------- index -- */

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
        lead={<Starters onSelect={onSelect} />}
        items={(canvases ?? []).map((c) => ({
          id: c.id,
          title: c.title || "Untitled",
          preview:
            c.kind === "web"
              ? "A web app — markup, styling and behaviour"
              : (c.content.split("\n").find((l) => l.trim()) ?? "Empty"),
          meta: c.kind === "web" ? "web app" : c.kind === "code" ? (c.lang ?? "code") : "doc",
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

/**
 * What you can start. Three tiles rather than one button, because the three
 * shapes are not variations of a setting you would go looking for — they are
 * different rooms, and the only moment anyone is deciding between them is now.
 */
function Starters({ onSelect }: { onSelect: (id: string) => void }) {
  const start = [
    {
      icon: <LayoutTemplate size={16} />,
      title: "Web app",
      blurb: "A page that runs beside the editor.",
      make: async () => (await createWebCanvas(webTemplate(), { title: "Counter" })).id,
    },
    {
      icon: <MessageSquareCode size={16} />,
      title: "Code file",
      blurb: "One file, any language.",
      make: async () => (await createCanvas({ kind: "code", lang: "ts" })).id,
    },
    {
      icon: <FileText size={16} />,
      title: "Document",
      blurb: "Markdown you can print.",
      make: async () => (await createCanvas({ kind: "doc", title: "Untitled" })).id,
    },
  ];

  return (
    <div className="mb-5 grid gap-2 sm:grid-cols-3">
      {start.map((s) => (
        <button
          key={s.title}
          onClick={async () => onSelect(await s.make())}
          className="lift focus-inset tap flex flex-col items-start gap-0.5 rounded-xl border border-line bg-surface p-3 text-left transition-colors duration-[var(--dur-fast)] hover:border-line-strong"
        >
          <span className="text-accent">{s.icon}</span>
          <span className="mt-1 text-sm font-medium text-primary">{s.title}</span>
          <span className="text-xs text-tertiary">{s.blurb}</span>
        </button>
      ))}
    </div>
  );
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
  const web = canvas.kind === "web";
  const files = useLiveQuery(() => (web ? filesOfCanvas(canvas.id) : []), [canvas.id, web], []);

  const [activeFileId, setActiveFileId] = React.useState<string | null>(null);
  const activeFile: CanvasFile | undefined =
    files.find((f) => f.id === activeFileId) ?? files[0];

  /* The one piece of text on screen, whichever shape the canvas is. Everything
     below — the editor, the diff, the history, the revise box — works on this
     and never has to know whether it came from a row or from the canvas. */
  const doc = web
    ? {
        key: activeFile?.id ?? "none",
        name: activeFile?.name ?? "",
        lang: activeFile?.lang,
        content: activeFile?.content ?? "",
        fileName: activeFile?.name,
      }
    : { key: canvas.id, name: canvas.title, lang: canvas.lang, content: canvas.content, fileName: undefined };

  const [draft, setDraft] = React.useState(doc.content);
  const [mode, setMode] = React.useState<Mode>(web ? "run" : "edit");
  const [instruction, setInstruction] = React.useState("");
  const [busy, setBusy] = React.useState<false | "revise" | "explain">(false);
  const [proposal, setProposal] = React.useState<{ content: string; note: string } | null>(null);
  const [report, setReport] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [versions, setVersions] = React.useState<CanvasVersion[]>([]);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Switching file is switching document: the draft follows, and anything
  // half-decided about the old one is dropped rather than applied to the new.
  React.useEffect(() => {
    setDraft(doc.content);
    setProposal(null);
    setReport(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.key]);

  // A file edited elsewhere — reverted from history, accepted from a diff —
  // must show here too, but only when this editor is not the one typing.
  const savedRef = React.useRef(doc.content);
  React.useEffect(() => {
    if (doc.content !== savedRef.current) {
      savedRef.current = doc.content;
      setDraft(doc.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.content]);

  const autosave = useAutosave<{ content: string }>(
    doc.key,
    React.useCallback(
      (key, patch) => {
        savedRef.current = patch.content ?? savedRef.current;
        if (web) {
          void db.canvasFiles.update(key, { ...patch, updatedAt: Date.now() });
          void db.canvases.update(canvas.id, { updatedAt: Date.now() });
        } else {
          void db.canvases.update(key, { ...patch, updatedAt: Date.now() });
        }
      },
      [web, canvas.id],
    ),
  );

  const runnable = web || (canvas.kind === "code" && (canvas.lang === "html" || canvas.lang === "css"));

  const loadVersions = React.useCallback(async () => {
    setVersions(await versionsOf(canvas.id, doc.fileName));
  }, [canvas.id, doc.fileName]);

  React.useEffect(() => {
    if (showHistory) void loadVersions();
  }, [showHistory, loadVersions]);

  /** The rest of the folder, so a revision can see what it has to fit into. */
  const siblings = React.useMemo(
    () =>
      web
        ? files.filter((f) => f.id !== activeFile?.id).map((f) => ({ name: f.name, content: f.content }))
        : undefined,
    [web, files, activeFile?.id],
  );

  const run = async (text: string) => {
    if (!text.trim() || busy) return;
    const modelId = cheapestAvailable(configured);
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings to ask for a revision.");
      return;
    }
    setBusy("revise");
    setNotice(null);
    setReport(null);
    try {
      // The draft, not the saved copy: revising a version of the file you can
      // see on screen but the model cannot is the fastest way to lose an edit.
      const out = await reviseCanvas(draft, text, canvas.kind, doc.lang, modelId, siblings);
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

  const explain = async () => {
    const modelId = cheapestAvailable(configured);
    if (!modelId) {
      setNotice("No key configured yet — add one in Settings.");
      return;
    }
    setBusy("explain");
    setNotice(null);
    try {
      setReport((await explainCode(draft, doc.lang, modelId, siblings)) ?? "Nothing came back.");
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      setBusy(false);
    }
  };

  const commit = async (content: string) => {
    if (web && activeFile) {
      await db.canvasFiles.update(activeFile.id, { content, updatedAt: Date.now() });
      await db.canvases.update(canvas.id, { updatedAt: Date.now() });
    } else {
      await db.canvases.update(canvas.id, { content, updatedAt: Date.now() });
    }
    savedRef.current = content;
  };

  const accept = async () => {
    if (!proposal) return;
    /* Record what was there before replacing it. Without this a canvas whose
       first change comes from the model has no version to go back to — the
       history starts at the rewrite, and "undo" has nothing to undo to.
       Identical states collapse, so this is free when the state is already
       recorded. */
    await pushVersion(canvas.id, draft, "you", undefined, doc.fileName);
    setDraft(proposal.content);
    await commit(proposal.content);
    await pushVersion(canvas.id, proposal.content, "model", proposal.note, doc.fileName);
    setProposal(null);
    setInstruction("");
    void loadVersions();
  };

  const column = canvas.kind === "doc" ? "max-w-[var(--measure)]" : "max-w-[var(--measure-wide)]";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailBar onBack={onBack} backLabel="All canvases" wide={canvas.kind !== "doc"}>
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
                    variant={mode === "run" ? "secondary" : "ghost"}
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

      {web && !proposal && (
        <FileTabs
          files={files}
          activeId={activeFile?.id ?? null}
          onSelect={setActiveFileId}
          onAdd={async (name) => {
            const f = await addCanvasFile(canvas.id, { name, lang: langOfName(name) });
            setActiveFileId(f.id);
          }}
          onDelete={async (f) => {
            if (f.name === ENTRY) {
              setNotice("index.html is the page itself — the folder has nothing to open without it.");
              return;
            }
            if (activeFile?.id === f.id) setActiveFileId(null);
            offerUndo(f.name, await deleteCanvasFile(f.id));
          }}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          {notice && (
            <p className={cn("mx-auto w-full px-4 pt-2 text-xs text-warning anim-fade", column)}>
              {notice}
            </p>
          )}

          {proposal ? (
            <DiffView
              wide={canvas.kind !== "doc"}
              before={draft}
              after={proposal.content}
              note={proposal.note}
              onAccept={accept}
              onReject={() => setProposal(null)}
            />
          ) : mode === "run" ? (
            web ? (
              <WebPreview files={files} draft={draft} activeName={doc.name} />
            ) : (
              <DocPreview canvas={canvas} content={draft} />
            )
          ) : mode === "preview" ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className={cn("mx-auto w-full", column)}>
                {canvas.kind === "doc" ? (
                  <Markdown content={draft} />
                ) : (
                  <CodeBlock code={draft} lang={doc.lang} filename={doc.name || canvas.title} />
                )}
              </div>
            </div>
          ) : (
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                autosave.save(doc.key, { content: e.target.value });
              }}
              onBlur={() => void pushVersion(canvas.id, draft, "you", undefined, doc.fileName)}
              spellCheck={canvas.kind === "doc"}
              aria-label="Canvas content"
              className={cn(
                "min-h-0 flex-1 resize-none bg-transparent px-4 py-4 text-primary outline-none",
                // The editing column matches the bar above it and the box
                // below it. Left unbounded, code ran the full width of a
                // 27-inch screen while its own title sat in a centred column.
                "mx-auto w-full",
                column,
                canvas.kind === "doc"
                  ? "text-base leading-[1.75]"
                  : "font-mono text-[13px] leading-[1.7]",
              )}
            />
          )}

          {report && !proposal && (
            <Report text={report} column={column} onClose={() => setReport(null)} />
          )}

          {/* Asking for a change is the point of the room, so it sits where
              the composer sits everywhere else in the app. */}
          {!proposal && (
            <div className="composer-dock shrink-0 px-4 pt-2">
              <div className={cn("mx-auto w-full", column)}>
                <Shortcuts
                  kind={canvas.kind}
                  busy={busy}
                  onRun={run}
                  onExplain={explain}
                  lang={doc.lang}
                />
                <div className="flex w-full items-end gap-2">
                  <input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void run(instruction))
                    }
                    placeholder={
                      canvas.kind === "doc"
                        ? "Ask for a change — “tighten the second section”"
                        : "Ask for a change — “add retry with backoff”"
                    }
                    aria-label="Ask for a change"
                    className="composer-shell focus-inset h-11 min-w-0 flex-1 rounded-full border px-4 text-[15px] text-primary outline-none placeholder:text-tertiary"
                  />
                  <button
                    onClick={() => void run(instruction)}
                    disabled={Boolean(busy) || !instruction.trim()}
                    aria-label="Ask for a change"
                    className="bloom focus-inset flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--cta)] text-[var(--cta-fg)] transition-colors disabled:bg-subtle disabled:text-faint"
                  >
                    {busy === "revise" ? <span className="think-orb" aria-hidden /> : <Send size={17} />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {showHistory && (
          <VersionList
            versions={versions}
            label={web ? doc.name : undefined}
            onRevert={async (id) => {
              await revertCanvas(canvas.id, id);
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
                    row.type === "add" && "bg-[color-mix(in_srgb,var(--go)_16%,transparent)] text-primary",
                    row.type === "remove" && "bg-[color-mix(in_srgb,var(--stop)_14%,transparent)] text-secondary",
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

/* ------------------------------------------------------------- shortcuts -- */

/**
 * The five one-press edits.
 *
 * Taken from ChatGPT's canvas, which settled on exactly this set: add
 * comments, add logs, fix bugs, port to a language, and one that explains
 * rather than edits. They are worth copying because they are the things
 * people ask for over and over, and typing "add comments explaining what each
 * function does" for the hundredth time is the app failing to notice a
 * pattern. Explain is the one that must never touch the file — a shortcut that
 * sometimes edits and sometimes does not is one nobody trusts with either.
 */
const PORTS = ["TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C++", "SQL"];

function Shortcuts({
  kind,
  lang,
  busy,
  onRun,
  onExplain,
}: {
  kind: Canvas["kind"];
  lang?: string;
  busy: false | "revise" | "explain";
  onRun: (instruction: string) => void;
  onExplain: () => void;
}) {
  const [portOpen, setPortOpen] = React.useState(false);

  if (kind === "doc") {
    return (
      <Row>
        <Chip busy={busy === "revise"} onClick={() => onRun("Tighten this. Cut every word that is not doing work, and keep every fact.")}>
          Tighten
        </Chip>
        <Chip busy={busy === "revise"} onClick={() => onRun("Fix the spelling, grammar and punctuation. Change nothing else — not the wording, not the structure.")}>
          Proofread
        </Chip>
        <Chip busy={busy === "revise"} onClick={() => onRun("Add headings and a little structure where the document has grown long enough to need them. Do not rewrite the prose.")}>
          Add structure
        </Chip>
        <Chip busy={busy === "explain"} onClick={onExplain}>
          Explain
        </Chip>
      </Row>
    );
  }

  return (
    <Row>
      <Chip
        busy={busy === "revise"}
        onClick={() => onRun("Add comments. Explain why the non-obvious parts are the way they are, not what each line does. Change no code.")}
      >
        Add comments
      </Chip>
      <Chip
        busy={busy === "revise"}
        onClick={() => onRun("Add logging at the points that would tell someone what went wrong: inputs at each boundary, the value of anything the logic branches on, and errors. Change no behaviour.")}
      >
        <Terminal size={12} />
        Add logs
      </Chip>
      <Chip
        busy={busy === "revise"}
        onClick={() => onRun("Find the bugs and fix them. Change only what is broken. If nothing is broken, return the file unchanged.")}
      >
        <Bug size={12} />
        Fix bugs
      </Chip>

      <span className="relative">
        <Chip busy={false} onClick={() => setPortOpen((v) => !v)} aria-expanded={portOpen}>
          Port to…
        </Chip>
        {portOpen && (
          <>
            <span className="fixed inset-0 z-10" onClick={() => setPortOpen(false)} aria-hidden />
            <span className="glass absolute bottom-full left-0 z-20 mb-1 flex w-40 flex-col rounded-xl border border-line p-1 shadow-lg anim-pop">
              {PORTS.filter((p) => p.toLowerCase() !== lang?.toLowerCase()).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPortOpen(false);
                    onRun(`Port this to ${p}. Keep the same behaviour, the same names, and the same structure where the language allows it. Return only the ported file.`);
                  }}
                  className="focus-inset rounded-lg px-2.5 py-1.5 text-left text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                >
                  {p}
                </button>
              ))}
            </span>
          </>
        )}
      </span>

      <Chip busy={busy === "explain"} onClick={onExplain}>
        Explain
      </Chip>
    </Row>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Shortcuts">
      {children}
    </div>
  );
}

function Chip({
  children,
  busy,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  busy: boolean;
  onClick: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="tap focus-inset inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary disabled:opacity-40"
      {...rest}
    >
      {children}
    </button>
  );
}

/** What Explain came back with. Prose, never applied to anything. */
function Report({
  text,
  column,
  onClose,
}: {
  text: string;
  column: string;
  onClose: () => void;
}) {
  return (
    <div className={cn("mx-auto max-h-[38vh] w-full shrink-0 overflow-y-auto px-4", column)}>
      <div className="rounded-xl border border-line bg-surface p-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
            Explanation
          </span>
          <IconButton label="Close explanation" size={26} className="ml-auto" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
        <Markdown content={text} />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- files -- */

function FileTabs({
  files,
  activeId,
  onSelect,
  onAdd,
  onDelete,
}: {
  files: CanvasFile[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  onDelete: (f: CanvasFile) => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");

  return (
    <div className="mx-auto flex w-full max-w-[var(--measure-wide)] shrink-0 items-center gap-1 overflow-x-auto px-4 pt-2">
      {files.map((f) => {
        const on = f.id === (activeId ?? files[0]?.id);
        return (
          <span key={f.id} className="group relative shrink-0">
            <button
              onClick={() => onSelect(f.id)}
              aria-current={on}
              className={cn(
                "tap focus-inset rounded-lg px-2.5 py-1 font-mono text-xs transition-colors duration-[var(--dur-fast)]",
                on ? "bg-accent-subtle text-accent" : "text-tertiary hover:bg-subtle hover:text-primary",
              )}
            >
              {f.name}
            </button>
            {f.name !== ENTRY && (
              <button
                onClick={() => onDelete(f)}
                aria-label={`Delete ${f.name}`}
                className="absolute -right-1 -top-1 hidden size-4 items-center justify-center rounded-full bg-inset text-tertiary hover:text-danger group-hover:flex"
              >
                <Trash2 size={9} />
              </button>
            )}
          </span>
        );
      })}

      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onAdd(name.trim());
            setName("");
            setAdding(false);
          }}
          className="shrink-0"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setAdding(false)}
            placeholder="about.html"
            aria-label="New file name"
            className="focus-inset h-7 w-28 rounded-lg border border-line bg-surface px-2 font-mono text-xs text-primary outline-none placeholder:text-tertiary"
          />
        </form>
      ) : (
        <IconButton label="Add a file" size={28} onClick={() => setAdding(true)}>
          <FilePlus2 size={13} />
        </IconButton>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- preview -- */

interface Line {
  id: number;
  level: string;
  text: string;
}

/**
 * The app, running.
 *
 * Sandboxed with `allow-scripts` and no `allow-same-origin`, so the page runs
 * on an opaque origin: it can execute its own code and reach nothing of this
 * app's — not the conversations, not the keys, not storage. A preview that can
 * read what is sitting beside it is not a preview.
 *
 * Its console is piped back out, which is the part that makes this usable
 * rather than a demo. An error inside a sandboxed frame is otherwise invisible
 * — no devtools panel points at it — and "it just doesn't work" with nothing
 * on screen is where people give up.
 */
function WebPreview({
  files,
  draft,
  activeName,
}: {
  files: CanvasFile[];
  draft: string;
  activeName: string;
}) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [lines, setLines] = React.useState<Line[]>([]);
  const [open, setOpen] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const nextId = React.useRef(0);

  /* The file you are typing in is not saved yet, so the preview would run the
     copy from a keystroke ago. Debounced rather than live: re-running on every
     character makes a page that flickers and a counter that never counts. */
  const merged = React.useMemo(
    () => files.map((f) => (f.name === activeName ? { ...f, content: draft } : f)),
    [files, draft, activeName],
  );
  const settled = useDebounced(merged, 500);
  const { html: srcDoc, map } = React.useMemo(() => assembleWeb(settled), [settled]);
  const mapRef = React.useRef(map);
  mapRef.current = map;

  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Identified by window, not by origin: a sandboxed frame has none.
      if (e.source !== frameRef.current?.contentWindow) return;
      const d = e.data as { __armiConsole?: number; level?: string; text?: string };
      if (!d || d.__armiConsole !== 1) return;
      /* "line 76" means line 76 of the assembled page, which nobody wrote.
         Translated back to the file and line you are looking at. */
      const text = String(d.text ?? "").replace(/\(line (\d+)\)/, (whole, n: string) => {
        const at = locate(mapRef.current, Number(n));
        return at ? `(${at.name}:${at.line})` : whole;
      });
      const line = { id: nextId.current++, level: String(d.level ?? "log"), text };
      setLines((l) => [...l.slice(-199), line]);
      if (line.level === "error") setOpen(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Every run starts with a clean console; keeping the last run's errors is
  // how you spend ten minutes chasing something you already fixed.
  React.useEffect(() => setLines([]), [srcDoc, nonce]);

  const errors = lines.filter((l) => l.level === "error").length;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[var(--measure-wide)] flex-1 flex-col px-4 py-3">
      <iframe
        key={nonce}
        ref={frameRef}
        title="Preview"
        sandbox="allow-scripts allow-forms"
        srcDoc={srcDoc}
        className="min-h-0 w-full flex-1 rounded-lg border border-line bg-white"
      />

      <div className="mt-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            <Terminal size={13} />
            Console
            {lines.length > 0 && (
              <span
                className={cn(
                  "tnum rounded-full px-1.5 text-[11px]",
                  errors
                    ? "bg-[var(--danger-subtle)] text-danger"
                    : "bg-subtle text-tertiary",
                )}
              >
                {errors || lines.length}
              </span>
            )}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNonce((n) => n + 1)}>
            <RotateCcw size={13} />
            Reload
          </Button>
        </div>

        {open && (
          <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-line bg-inset p-2 font-mono text-[12px] leading-[1.6]">
            {lines.length === 0 ? (
              <p className="text-tertiary">Nothing logged yet.</p>
            ) : (
              lines.map((l) => (
                <p
                  key={l.id}
                  className={cn(
                    "whitespace-pre-wrap break-words",
                    l.level === "error"
                      ? "text-danger"
                      : l.level === "warn"
                        ? "text-warning"
                        : "text-secondary",
                  )}
                >
                  {l.text}
                </p>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** A single HTML or CSS file, run on its own. */
function DocPreview({ canvas, content }: { canvas: Canvas; content: string }) {
  const html = canvas.lang === "css" ? `<style>${content}</style><p>Styled sample text.</p>` : content;
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
  label,
  onRevert,
  onClose,
}: {
  versions: CanvasVersion[];
  /** Which file this history belongs to, when the canvas is a folder. */
  label?: string;
  onRevert: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <aside className="glass hidden w-64 shrink-0 flex-col overflow-y-auto border-l border-line md:flex">
      <div className="flex h-10 items-center gap-2 border-b border-line px-3">
        <span className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
          {label ? `History · ${label}` : "History"}
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
  opts: { title?: string; kind?: Canvas["kind"]; lang?: string; conversationId?: string } = {},
): Promise<Canvas> {
  return createCanvas({
    title: opts.title?.slice(0, 80) || "Untitled",
    kind: opts.kind ?? "code",
    lang: opts.lang,
    content,
    sourceConversationId: opts.conversationId,
  });
}

