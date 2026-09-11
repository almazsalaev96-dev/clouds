"use client";

import * as React from "react";
import { Check, Copy, Download, WrapText, ChevronDown, PanelRight } from "lucide-react";
import { highlight, normalizeLang } from "@/lib/highlighter";
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
    <figure className={cn("group/code overflow-hidden rounded-lg border border-line bg-inset", !bare && "my-4")}>
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
                "reveal flex size-7 items-center justify-center rounded-sm hover:bg-subtle hover:text-primary",
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
            className="flex h-7 w-[4.75rem] items-center justify-center gap-1 rounded-sm text-xs text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
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
              "px-3 py-3 font-mono text-code",
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
    </figure>
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
              added && "bg-[color-mix(in_srgb,var(--success)_12%,transparent)]",
              removed && "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]",
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
