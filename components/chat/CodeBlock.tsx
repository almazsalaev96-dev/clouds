"use client";

import * as React from "react";
import { Check, Copy, Download, WrapText, ChevronDown, PanelRight, Play, X } from "lucide-react";
import { highlight, normalizeLang } from "@/lib/highlighter";
import { runDocument, runKindOf } from "@/lib/runnable";
import { useSettings } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/primitives";
import { useArtifact } from "./ArtifactPanel";

const LINE_NUMBER_THRESHOLD = 12;

const EXTENSIONS: Record<string, string> = {
  javascript: "js", typescript: "ts", tsx: "tsx", jsx: "jsx", python: "py",
  ruby: "rb", rust: "rs", bash: "sh", markdown: "md", yaml: "yml", cpp: "cpp",
  csharp: "cs", kotlin: "kt", html: "html", css: "css", json: "json", go: "go",
  java: "java", sql: "sql", php: "php", swift: "swift", toml: "toml",
};

export function CodeBlock({
  code,
  lang,
  filename,
  streaming,
  bare,
  wrap: wrapProp,
}: {
  code: string;
  lang?: string;
  filename?: string;
  streaming?: boolean;
  /** Inside the side panel the surrounding chrome already carries the header. */
  bare?: boolean;
  /** Lets a host (the side panel) own the wrap toggle instead. */
  wrap?: boolean;
}) {
  const settings = useSettings();
  const artifact = useArtifact();
  const [html, setHtml] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [wrapLocal, setWrap] = React.useState(settings.wrapCode);
  const wrap = wrapProp ?? wrapLocal;
  const [collapsed, setCollapsed] = React.useState(false);
  const normalized = normalizeLang(lang);
  const lines = React.useMemo(() => code.split("\n"), [code]);
  const showNumbers = settings.showLineNumbers || lines.length > LINE_NUMBER_THRESHOLD;
  const isDiff = normalized === "diff";
  const tall = lines.length > 60;
  // Below this a block is easier to read where it is than in a second column.
  const worthLifting = lines.length > 24;
  const liftedHere = artifact?.current?.kind === "code" && artifact.current.content === code;
  /* A page, a drawing, a stylesheet or a script runs under the block, in
     a frame that can reach nothing (lib/runnable.ts). */
  const runKind = React.useMemo(() => runKindOf(normalized ?? lang, code), [normalized, lang, code]);
  const [running, setRunning] = React.useState(false);

  /**
   * Highlighting a partially-received block on every chunk is expensive and
   * makes the block flicker. So: plain monospace while tokens are arriving,
   * and one highlight pass 60ms after the stream goes quiet.
   */
  React.useEffect(() => {
    if (!normalized || isDiff) {
      setHtml(null);
      return;
    }
    let cancelled = false;
    const delay = streaming ? 60 : 0;
    const t = setTimeout(() => {
      highlight(code, normalized).then((result) => {
        if (!cancelled) setHtml(result);
      });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [code, normalized, streaming, isDiff]);

  const copy = React.useCallback(async () => {
    try {
      // The raw source: never the line numbers, never a trailing newline the
      // user did not write.
      await navigator.clipboard.writeText(code.replace(/\n$/, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard denied — the button simply does not confirm */
    }
  }, [code]);

  const download = React.useCallback(() => {
    const ext = normalized ? (EXTENSIONS[normalized] ?? "txt") : "txt";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `snippet.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, filename, normalized]);

  if (liftedHere && !bare) {
    return (
      <button
        onClick={() => artifact?.open({ kind: "code", title: filename || (normalized ?? "snippet"), lang: normalized ?? undefined, content: code })}
        className="my-4 flex w-full items-center gap-2.5 rounded-lg border border-line bg-inset px-3 py-2.5 text-left transition-colors duration-[var(--dur-fast)] hover:border-line-strong"
      >
        <PanelRight size={15} className="shrink-0 text-tertiary" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-primary">
            {filename || (normalized ?? "Code")}
          </span>
          <span className="block text-xs text-tertiary">
            {lines.length} lines — open in the side panel
          </span>
        </span>
      </button>
    );
  }

  return (
    <figure className={cn("group/code overflow-hidden rounded-md border border-line bg-inset", !bare && "my-4")}>
      {!bare && (
      <figcaption className="flex h-9 items-center gap-2 border-b border-line px-3">
        <span className="truncate text-xs text-tertiary">
          {filename ? (
            <>
              <span className="text-secondary">{filename}</span>
              {normalized && <span className="ml-1.5">{normalized}</span>}
            </>
          ) : (
            // No label at all beats a wrong one, so unknown languages stay quiet.
            normalized ?? ""
          )}
        </span>

        {/* Wrap, line numbers, collapse, copy. On paper a code block is
            just code, and a Copy button printed beside it is the application
            leaking into the document. */}
        <span className="no-print ml-auto flex items-center gap-0.5">
          {runKind && !streaming && (
            <Tooltip label={running ? "Stop" : runKind === "js" ? "Run and show what it prints" : "Run and show it"}>
              <button
                onClick={() => setRunning((r) => !r)}
                aria-label={running ? "Stop running" : "Run"}
                aria-pressed={running}
                className={cn(
                  "ctl-h [--ctl:1.75rem] flex items-center justify-center gap-1 rounded-sm px-1.5 text-xs transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary",
                  running ? "text-primary" : "text-tertiary",
                )}
              >
                {running ? <X size={13} /> : <Play size={13} />}
                <span>{running ? "Stop" : "Run"}</span>
              </button>
            </Tooltip>
          )}
          {worthLifting && artifact && !streaming && (
            <Tooltip label="Open in side panel">
              <button
                onClick={() =>
                  artifact.open({
                    kind: "code",
                    title: filename || `${normalized ?? "snippet"}`,
                    lang: normalized ?? undefined,
                    content: code,
                  })
                }
                aria-label="Open code in side panel"
                className="ctl flex [--ctl:1.75rem] items-center justify-center rounded-sm text-tertiary reveal hover:bg-subtle hover:text-primary"
              >
                <PanelRight size={14} />
              </button>
            </Tooltip>
          )}
          {tall && (
            <Tooltip label={collapsed ? "Expand" : "Collapse"}>
              <button
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand code" : "Collapse code"}
                className="ctl flex [--ctl:1.75rem] items-center justify-center rounded-sm text-tertiary reveal hover:bg-subtle hover:text-primary"
              >
                <ChevronDown size={14} className={cn("transition-transform duration-[var(--dur-fast)]", collapsed && "-rotate-90")} />
              </button>
            </Tooltip>
          )}
          <Tooltip label={wrap ? "No wrap" : "Wrap lines"}>
            <button
              onClick={() => setWrap((w) => !w)}
              aria-label={wrap ? "Disable line wrapping" : "Enable line wrapping"}
              aria-pressed={wrap}
              data-visible={wrap || undefined}
              className={cn(
                "reveal ctl [--ctl:1.75rem] flex items-center justify-center rounded-sm hover:bg-subtle hover:text-primary",
                wrap ? "text-primary" : "text-tertiary",
              )}
            >
              <WrapText size={14} />
            </button>
          </Tooltip>
          <Tooltip label="Download">
            <button
              onClick={download}
              aria-label="Download code"
              className="ctl flex [--ctl:1.75rem] items-center justify-center rounded-sm text-tertiary reveal hover:bg-subtle hover:text-primary"
            >
              <Download size={14} />
            </button>
          </Tooltip>
          {/* Fixed width: the label swap must not shift the header by a pixel. */}
          <button
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy code"}
            className="ctl-h [--ctl:1.75rem] flex w-[4.75rem] items-center justify-center gap-1 rounded-sm text-xs text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
          >
            {copied ? (
              <>
                <Check size={13} className="text-success" />
                <span className="text-success">Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </span>
      </figcaption>
      )}

      {!collapsed && (
        <div
          className={cn(
            "overflow-x-auto",
            tall && "max-h-[70vh] overflow-y-auto",
          )}
        >
          <pre
            className={cn(
              "p-4 font-mono text-code",
              wrap && "whitespace-pre-wrap break-words",
            )}
          >
            {isDiff ? (
              <DiffBody lines={lines} showNumbers={showNumbers} />
            ) : showNumbers ? (
              <NumberedBody lines={lines} html={html} />
            ) : html ? (
              <code dangerouslySetInnerHTML={{ __html: stripPre(html) }} />
            ) : (
              <code>{code}</code>
            )}
          </pre>
        </div>
      )}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="w-full px-3 py-2 text-left text-xs text-tertiary hover:bg-subtle"
        >
          {lines.length} lines hidden — click to expand
        </button>
      )}
      {running && runKind && <RunPane kind={runKind} code={code} />}
    </figure>
  );
}

/**
 * The block, running. A frame with no origin and a policy that lets
 * nothing in or out, so what the model wrote can draw and compute and
 * nothing else; what it prints comes back on a bridge and shows under it.
 * Keyed by a token per run, so a stale frame's messages are ignored.
 */
function RunPane({ kind, code }: { kind: "html" | "svg" | "css" | "js"; code: string }) {
  const token = React.useMemo(() => Math.random().toString(36).slice(2), []);
  const [logs, setLogs] = React.useState<{ level: string; text: string }[]>([]);
  const [done, setDone] = React.useState(false);
  const doc = React.useMemo(() => runDocument(kind, code, token), [kind, code, token]);
  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { armiRun?: string; level?: string; text?: string } | null;
      if (!d || d.armiRun !== token) return;
      if (d.level === "done") { setDone(true); return; }
      setLogs((l) => (l.length >= 200 ? l : [...l, { level: d.level ?? "log", text: d.text ?? "" }]));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [token]);
  const errors = logs.filter((l) => l.level === "error").length;
  return (
    <div className="no-print border-t border-line bg-surface anim-fade" role="region" aria-label="Running">
      <iframe
        title="The code, running"
        sandbox="allow-scripts"
        srcDoc={doc}
        className={cn("block w-full bg-white", kind === "js" ? "h-40" : "h-72")}
      />
      <div className="flex items-center gap-2 border-t border-line px-3 py-1 text-tiny text-tertiary">
        <span className={cn("inline-block size-1.5 rounded-full", errors ? "bg-[var(--danger)]" : done ? "bg-[var(--success)]" : "bg-[var(--border-strong)]")} aria-hidden />
        <span>{errors ? `${errors} error${errors === 1 ? "" : "s"}` : done ? "Ran" : "Running…"}</span>
        <span className="ml-auto">no network, nothing saved</span>
      </div>
      {logs.length > 0 && kind !== "js" && (
        <ol className="max-h-40 overflow-y-auto border-t border-line px-3 py-1.5 font-mono text-xs" aria-label="Console">
          {logs.map((l, i) => (
            <li key={i} className={cn("whitespace-pre-wrap", l.level === "error" ? "text-danger" : l.level === "warn" ? "text-warning" : "text-secondary")}>{l.text}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Shiki returns a full <pre><code>; we supply our own, so unwrap it. */
function stripPre(html: string): string {
  const match = html.match(/<code[^>]*>([\s\S]*)<\/code>/);
  return match ? match[1] : html;
}

function NumberedBody({ lines, html }: { lines: string[]; html: string | null }) {
  const highlighted = React.useMemo(() => {
    if (!html) return null;
    const inner = stripPre(html);
    // Shiki emits one .line span per line, which we can split on safely.
    const parts = inner.split(/(?=<span class="line")/);
    return parts.length === lines.length ? parts : null;
  }, [html, lines.length]);

  return (
    <code className="grid grid-cols-[auto_1fr] gap-x-3">
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          <span
            aria-hidden
            className="select-none text-right text-tertiary tabular-nums"
            // Line numbers are decoration: they must never end up in a copy.
            style={{ userSelect: "none" }}
          >
            {i + 1}
          </span>
          {highlighted ? (
            <span dangerouslySetInnerHTML={{ __html: highlighted[i] }} />
          ) : (
            <span>{line || " "}</span>
          )}
        </React.Fragment>
      ))}
    </code>
  );
}

/** Diffs get a gutter glyph as well as a tint — never color alone. */
function DiffBody({ lines, showNumbers }: { lines: string[]; showNumbers: boolean }) {
  return (
    <code className="block">
      {lines.map((line, i) => {
        const added = line.startsWith("+") && !line.startsWith("+++");
        const removed = line.startsWith("-") && !line.startsWith("---");
        return (
          <span
            key={i}
            className={cn(
              "-mx-3 flex px-3",
              added && "bg-[color-mix(in_oklab,var(--success)_12%,transparent)]",
              removed && "bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]",
            )}
          >
            {showNumbers && (
              <span aria-hidden className="mr-3 w-6 select-none text-right text-tertiary tabular-nums">
                {i + 1}
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                "mr-2 w-2 shrink-0 select-none",
                added && "text-success",
                removed && "text-danger",
                !added && !removed && "text-tertiary",
              )}
            >
              {added ? "+" : removed ? "−" : " "}
            </span>
            <span className={cn(added && "text-success", removed && "text-danger")}>
              {line.slice(added || removed ? 1 : 0) || " "}
            </span>
          </span>
        );
      })}
    </code>
  );
}
