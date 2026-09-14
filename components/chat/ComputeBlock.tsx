"use client";

import * as React from "react";
import { ChevronDown, Play, Sigma } from "lucide-react";
import {
  COMPUTE_TIMEOUT_MS,
  computeDoc,
  type Outcome,
  type Printed,
} from "@/lib/compute";
import { CodeBlock } from "./CodeBlock";
import { cn } from "@/lib/utils";

/**
 * Who to tell when a calculation finishes.
 *
 * The block is rendered deep inside the markdown renderer, which knows
 * nothing about messages or conversations and should not. The message
 * wraps its own body in one of these, so the answer that carries the
 * calculation is the one that hears about the result.
 */
const Scope = React.createContext<{ onDone: (out: Outcome) => void } | null>(null);

export function ComputeScope({
  onDone,
  children,
}: {
  onDone?: (out: Outcome) => void;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => (onDone ? { onDone } : null), [onDone]);
  return <Scope.Provider value={value}>{children}</Scope.Provider>;
}

/**
 * A calculation, run.
 *
 * The block that arrives in the answer is not shown as code by default,
 * because the person did not ask for code — they asked what the number is.
 * What they get is the number, with the working one press away.
 *
 * It runs once, on its own, as soon as it lands. Waiting to be pressed
 * would leave the answer sitting beside an unevaluated promise, which is
 * exactly the state this feature exists to remove.
 */
export function ComputeBlock({
  code,
  onResult,
}: {
  code: string;
  /** The output, for the turn that has to answer with it. Called once. */
  onResult?: (out: Outcome) => void;
}) {
  const [out, setOut] = React.useState<Outcome | null>(null);
  const [running, setRunning] = React.useState(false);
  const [showCode, setShowCode] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const host = React.useRef<HTMLDivElement>(null);
  const told = React.useRef(false);
  const scope = React.useContext(Scope);
  const sink = React.useRef(onResult ?? scope?.onDone);
  sink.current = onResult ?? scope?.onDone;

  React.useEffect(() => {
    const el = host.current;
    if (!el) return;
    const run = `c${nonce}:${code.length}`;
    const lines: Printed[] = [];
    const started = Date.now();
    let finished = false;
    setRunning(true);
    setOut(null);

    /* The frame is created rather than rendered, and removed by hand. A
       calculation that never ends cannot be stopped from out here by any
       other means: destroying the browsing context is what stops it. */
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("title", "Calculation");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
    frame.srcdoc = computeDoc(code, run);

    const settle = (timedOut: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      frame.remove();
      const result: Outcome = { lines, timedOut, ms: Date.now() - started };
      setOut(result);
      setRunning(false);
      if (!told.current) {
        told.current = true;
        sink.current?.(result);
      }
    };

    const onMessage = (e: MessageEvent) => {
      const d = e.data as { __armiCompute?: number; __armiComputeDone?: number; run?: string; level?: Printed["level"]; text?: string };
      if (!d || d.run !== run) return;
      if (d.__armiCompute) lines.push({ level: d.level ?? "log", text: d.text ?? "" });
      else if (d.__armiComputeDone) settle(false);
    };

    const timer = setTimeout(() => settle(true), COMPUTE_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    el.appendChild(frame);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      frame.remove();
    };
  }, [code, nonce]);

  const failed = out?.lines.some((l) => l.level === "error");

  return (
    <div
      role="group"
      aria-label="Worked out"
      className="my-2 overflow-hidden rounded-md border border-line bg-surface"
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
        <Sigma size={13} className={cn("shrink-0", failed ? "text-warning" : "text-tertiary")} />
        <span className="eyebrow text-faint">Worked out</span>
        <span className="min-w-0 flex-1 truncate text-xs text-tertiary">
          {running
            ? "running"
            : out?.timedOut
              ? "stopped — it did not finish"
              : out
                ? `${out.lines.length} line${out.lines.length === 1 ? "" : "s"} · ${out.ms}ms`
                : ""}
        </span>
        <button
          onClick={() => setShowCode((s) => !s)}
          aria-expanded={showCode}
          className="no-print focus-inset flex h-7 shrink-0 items-center gap-1 rounded-sm px-1.5 text-xs text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
        >
          <ChevronDown size={12} className={cn("transition-transform duration-[var(--dur-fast)]", !showCode && "-rotate-90")} />
          Working
        </button>
        <button
          onClick={() => setNonce((n) => n + 1)}
          aria-label="Run again"
          className="no-print focus-inset flex h-7 shrink-0 items-center justify-center rounded-sm px-1.5 text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
        >
          <Play size={12} />
        </button>
      </div>

      {showCode && (
        <div className="border-b border-line p-2">
          <CodeBlock code={code} lang="js" bare />
        </div>
      )}

      {/* Where the frame lives. Zero-sized and hidden, but in the document,
          because a frame that is not in the document does not run. */}
      <div ref={host} className="sr-only" />

      <div className="px-3 py-2">
        {running && !out ? (
          <p className="sheen text-sm font-medium">Working it out</p>
        ) : out?.timedOut ? (
          <p className="text-sm text-warning">
            It ran for {COMPUTE_TIMEOUT_MS / 1000} seconds without finishing and was stopped.
          </p>
        ) : out && out.lines.length === 0 ? (
          <p className="text-sm text-tertiary">It finished and printed nothing.</p>
        ) : (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm leading-6 text-primary">
            {out?.lines.map((l, i) => (
              <span key={i} className={cn("block", l.level === "error" && "text-[var(--danger)]", l.level === "warn" && "text-warning")}>
                {l.text}
              </span>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
