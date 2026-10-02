"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Trash2, X } from "lucide-react";
import type { DraftCard } from "@/lib/generate";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * The cards a model wrote, before they exist.
 *
 * Every assistant will write twelve cards from an answer, and about two
 * of them are wrong — a question with its answer in it, a fact the
 * answer never said, a "back" that restates the front. A deck that takes
 * all twelve is a deck that asks you something wrong on the third day,
 * and that is the day people stop trusting it. So the cards come here
 * first: each one readable, editable in place, and droppable, with the
 * deck's name above them; nothing is kept until the button at the end.
 * Accepting is one press for the ones that are right, which is most.
 */
export function CardReview({
  drafts,
  name,
  onConfirm,
  onCancel,
}: {
  drafts: DraftCard[];
  name: string;
  onConfirm: (name: string, cards: DraftCard[]) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState(name);
  const [rows, setRows] = React.useState(() => drafts.map((d, i) => ({ id: i, front: d.front, back: d.back, topic: d.topic, keep: true })));
  const kept = rows.filter((r) => r.keep && r.front.trim() && r.back.trim());
  const edit = (id: number, patch: Partial<{ front: string; back: string; keep: boolean }>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--bg-overlay)] anim-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col overflow-hidden rounded-t-2xl glass border border-line shadow-lg anim-modal sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        >
          <div className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-primary">Cards from this answer</Dialog.Title>
              <p className="mt-0.5 text-sm text-secondary">Read them before they are kept. Fix a wrong one by typing in it; drop one with the bin.</p>
              <label className="mt-2 block">
                <span className="sr-only">Deck name</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-label="Deck name"
                  className="focus-inset rounded-md border border-line bg-field px-3 py-1.5 text-sm text-primary outline-none h-9 w-full"
                />
              </label>
            </div>
            <Dialog.Close asChild>
              <button aria-label="Close" className="ctl focus-inset flex [--ctl:2rem] shrink-0 items-center justify-center rounded-full text-tertiary hover:bg-subtle hover:text-primary"><X size={16} /></button>
            </Dialog.Close>
          </div>
          <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-3" aria-label="Cards to keep">
            {rows.map((r, i) => (
              <li
                key={r.id}
                className={cn("rounded-xl border border-line bg-surface p-3 transition-opacity duration-[var(--dur-fast)]", !r.keep && "opacity-45")}
              >
                <div className="flex items-start gap-2">
                  <span className="tnum mt-1.5 w-5 shrink-0 text-right text-xs text-faint">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <textarea
                      value={r.front}
                      onChange={(e) => edit(r.id, { front: e.target.value })}
                      rows={1}
                      aria-label={`Question ${i + 1}`}
                      disabled={!r.keep}
                      className="focus-inset rounded-md border border-line bg-field px-3 py-1.5 text-sm text-primary outline-none w-full resize-none font-medium"
                    />
                    <textarea
                      value={r.back}
                      onChange={(e) => edit(r.id, { back: e.target.value })}
                      rows={2}
                      aria-label={`Answer ${i + 1}`}
                      disabled={!r.keep}
                      className="focus-inset rounded-md border border-line bg-field px-3 py-1.5 text-sm text-primary outline-none w-full resize-none"
                    />
                    {r.topic && <span className="block text-tiny text-faint">{r.topic}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => edit(r.id, { keep: !r.keep })}
                    aria-label={r.keep ? `Drop card ${i + 1}` : `Keep card ${i + 1}`}
                    aria-pressed={!r.keep}
                    className="ctl focus-inset flex [--ctl:1.75rem] shrink-0 items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary"
                  >
                    {r.keep ? <Trash2 size={14} /> : <Check size={14} />}
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-2 border-t border-line px-5 py-3">
            <span className="text-sm text-tertiary">{kept.length} of {rows.length}</span>
            <span className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
              <Button
                size="sm"
                variant="primary"
                disabled={kept.length === 0 || !title.trim()}
                onClick={() => onConfirm(title.trim(), kept.map(({ front, back, topic }) => ({ front: front.trim(), back: back.trim(), topic })))}
              >
                Add {kept.length} card{kept.length === 1 ? "" : "s"}
              </Button>
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
