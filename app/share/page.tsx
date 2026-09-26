"use client";

/**
 * A conversation, read from its link.
 *
 * Nothing here is fetched: the whole thread is in the fragment after `#`,
 * which the browser keeps to itself, and this page only unpacks and sets
 * it. The text is rendered by the same Markdown renderer the app uses for
 * an answer, which draws Markdown and nothing else — HTML in a message is
 * shown as text — so a link cannot carry a script into the reader's
 * browser. "Continue in Armi" hands the same link to the app, which makes
 * it a conversation of the reader's own.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Mark } from "@/components/brand/Logo";
import { TooltipProvider } from "@/components/ui/primitives";
import { decodeShare, type Shared } from "@/lib/share";

const MarkdownRenderer = dynamic(() => import("@/components/chat/MarkdownRenderer"), { ssr: false });

export default function SharePage() {
  const [state, setState] = React.useState<{ kind: "reading" } | { kind: "none" } | { kind: "ok"; shared: Shared; token: string }>({ kind: "reading" });

  React.useEffect(() => {
    const token = location.hash.replace(/^#/, "");
    if (!token) { setState({ kind: "none" }); return; }
    void decodeShare(token).then((shared) => setState(shared ? { kind: "ok", shared, token } : { kind: "none" }));
  }, []);

  return (
    <TooltipProvider>
    <main className="min-h-dvh bg-canvas text-primary">
      <div className="mx-auto w-full max-w-[var(--measure)] px-4 py-8 sm:py-12">
        <header className="mb-8 flex items-center justify-between gap-3">
          <a href="/" className="focus-inset flex items-center gap-2 rounded-md text-sm text-secondary hover:text-primary" aria-label="Open Armi">
            <Mark size={22} className="text-primary" />
            <span>Shared from Armi</span>
          </a>
          {state.kind === "ok" && (
            <a
              href={`/#share=${state.token}`}
              className="tap bloom focus-inset flex items-center gap-1.5 rounded-full bg-[var(--cta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cta-fg)]"
            >
              Continue in Armi
              <ArrowRight size={14} />
            </a>
          )}
        </header>

        {state.kind === "reading" && <p className="text-sm text-tertiary">Opening…</p>}

        {state.kind === "none" && (
          <div className="anim-rise">
            <h1 className="display text-2xl">Nothing to show</h1>
            <p className="mt-2 max-w-prose text-sm text-secondary">
              This link does not carry a conversation. A shared link holds the whole thread after the <code>#</code>, so one that was
              cut short by the app it was pasted into has lost its contents. Ask for it again, whole.
            </p>
          </div>
        )}

        {state.kind === "ok" && (
          <article className="anim-rise" aria-label="Shared conversation">
            <h1 className="display text-[1.75rem] leading-tight sm:text-3xl">{state.shared.t}</h1>
            <p className="mt-1.5 text-xs text-tertiary tnum">
              {new Date(state.shared.d).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })} · {state.shared.m.length} messages · the
              whole conversation is in this link; no server holds a copy
            </p>
            <ol className="mt-8 space-y-7">
              {state.shared.m.map((m, i) => (
                <li key={i} className={m.r === "user" ? "flex justify-end" : ""}>
                  {m.r === "user" ? (
                    <div className="msg max-w-[85%] rounded-2xl bg-subtle px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]" data-role="user">
                      {m.c}
                    </div>
                  ) : (
                    <div className="msg" data-role="assistant">
                      <p className="eyebrow mb-1.5 text-faint">{m.n ?? "Armi"}</p>
                      <div className="prose">
                        <MarkdownRenderer content={m.c} />
                      </div>
                      {m.s && m.s.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Sources">
                          {m.s.map((src, j) => (
                            <li key={j}>
                              <a href={src.u} target="_blank" rel="noopener noreferrer" className="focus-inset inline-flex items-center gap-1 rounded text-secondary underline decoration-[var(--border-strong)] underline-offset-2 hover:text-primary">
                                {src.t}
                                <ExternalLink size={10} />
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-tertiary">
              <span>Armi can be wrong. Check what matters.</span>
              <a href={`/#share=${state.token}`} className="focus-inset flex items-center gap-1 rounded text-secondary hover:text-primary">
                Continue this conversation in Armi
                <ArrowRight size={12} />
              </a>
            </footer>
          </article>
        )}
      </div>
    </main>
    </TooltipProvider>
  );
}
