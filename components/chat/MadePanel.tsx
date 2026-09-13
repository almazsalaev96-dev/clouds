"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { RefreshCw, SquarePen, X } from "lucide-react";
import type { CanvasFile } from "@/lib/types";
import { db, filesOfCanvas } from "@/lib/db";
import { assembleWeb, ENTRY } from "@/lib/web";
import { useResolvedTheme } from "@/components/CanvasView";
import { IconButton } from "@/components/ui/primitives";

/**
 * The made thing, running beside the conversation that made it.
 *
 * ChatGPT's canvas, Claude's artifacts and Gemini's canvas all do the same
 * thing for the same reason: the person who asked for flashcards wants the
 * flashcards on screen while they say "make the back bigger", not a trip to
 * another room and back for every change. So this is a column, not a page —
 * the thread stays where it was, and a second answer that is a page replaces
 * what is running here without anyone pressing anything.
 *
 * It is a viewer and nothing else. Editing, versions, the console, "Use it"
 * — all of that is Code's, one press away, and building a second copy of
 * it here would be two places for one thing.
 */
export function MadePanel({
  canvasId,
  onClose,
  onEdit,
}: {
  canvasId: string;
  onClose: () => void;
  /** Open it in Code, where it can be edited, versioned, and used full-screen. */
  onEdit: () => void;
}) {
  const canvas = useLiveQuery(() => db.canvases.get(canvasId), [canvasId]);
  const web = canvas?.kind === "web";
  const files = useLiveQuery(() => (web ? filesOfCanvas(canvasId) : Promise.resolve([] as CanvasFile[])), [canvasId, web], [] as CanvasFile[]);
  const theme = useResolvedTheme();
  const [nonce, setNonce] = React.useState(0);

  const srcDoc = React.useMemo(() => {
    if (!canvas) return "";
    const list: CanvasFile[] = web
      ? files
      : [{ id: canvas.id, canvasId: canvas.id, name: ENTRY, lang: "html", content: canvas.content, order: 0, createdAt: 0, updatedAt: 0 }];
    return assembleWeb(list, theme, `made:${nonce}`).html;
  }, [canvas, files, web, theme, nonce]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = canvas?.title || "Made";

  return (
    <>
      <div onClick={onClose} aria-hidden className="fixed inset-0 z-30 bg-[var(--bg-overlay)] anim-fade lg:hidden" />
      <aside
        aria-label={`${title}, running`}
        className="fixed inset-y-0 right-0 z-40 flex w-[min(44rem,100vw)] flex-col border-l border-line bg-surface anim-fade lg:relative lg:z-auto lg:w-[clamp(24rem,44vw,44rem)] lg:shrink-0"
        style={{ animationDuration: "var(--dur-layout)" }}
      >
        <header className="flex h-[var(--topbar-h)] shrink-0 items-center gap-1 border-b border-line px-3">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{title}</span>
          <span className="shrink-0 text-xs text-tertiary">running</span>
          <IconButton label="Reload" size={28} onClick={() => setNonce((n) => n + 1)}>
            <RefreshCw size={14} />
          </IconButton>
          <IconButton label="Open in Code" size={28} onClick={onEdit}>
            <SquarePen size={14} />
          </IconButton>
          <IconButton label="Close" keys={["Esc"]} size={28} onClick={onClose}>
            <X size={15} />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 bg-canvas">
          {canvas ? (
            <iframe
              key={nonce}
              title={`${title} — running`}
              /* Opaque origin, like every preview here: the page can run its
                 own code and reach nothing of this app's. */
              sandbox="allow-scripts allow-forms"
              srcDoc={srcDoc}
              className="h-full w-full border-0 bg-transparent"
            />
          ) : (
            <p className="p-4 text-sm text-tertiary">This was deleted.</p>
          )}
        </div>
      </aside>
    </>
  );
}
