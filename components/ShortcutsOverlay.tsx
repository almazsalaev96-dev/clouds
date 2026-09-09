"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Kbd } from "@/components/ui/primitives";

/**
 * The one place the whole keyboard surface is written down. It is also the
 * source the settings panel reads, so the two can never disagree — a shortcut
 * list that has drifted from the app is worse than none.
 */
export const SHORTCUT_GROUPS: { group: string; items: [string, string[]][] }[] = [
  {
    group: "Anywhere",
    items: [
      ["Command palette", ["mod", "K"]],
      ["New, in this section", ["mod", "N"]],
      ["Toggle sidebar", ["mod", "\\"]],
      ["Settings", ["mod", ","]],
      ["Toggle theme", ["mod", "shift", "D"]],
      ["This list", ["?"]],
    ],
  },
  {
    group: "Sections",
    items: [
      ["Chats", ["mod", "1"]],
      ["Projects", ["mod", "2"]],
      ["Code", ["mod", "3"]],
      ["Notes", ["mod", "4"]],
      ["Cards", ["mod", "5"]],
      ["Papers", ["mod", "6"]],
      ["Practice", ["mod", "7"]],
      ["Back out of what's open", ["Esc"]],
    ],
  },
  {
    group: "Chat",
    items: [
      ["Send", ["mod", "enter"]],
      ["Edit your last message", ["↑"]],
      ["Model picker", ["mod", "/"]],
      ["Stop generating", ["Esc"]],
      ["Copy last answer", ["mod", "shift", "C"]],
      ["Move through messages", ["j", "k"]],
      ["Leave the composer", ["Esc"]],
    ],
  },
  {
    group: "Reviewing cards",
    items: [
      ["Reveal the answer", ["Space"]],
      ["Again / Hard / Good / Easy", ["1", "2", "3", "4"]],
      ["Undo the last grade", ["U"]],
    ],
  },
];

export function ShortcutsOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--bg-overlay)] anim-fade" />
        <Dialog.Content className="glass fixed left-1/2 top-1/2 z-50 w-[40rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line p-5 shadow-lg anim-pop">
          <Dialog.Title className="text-lg font-semibold text-primary">
            Keyboard shortcuts
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-secondary">
            Everything here is also in the command palette. Keys without a modifier
            work once you have left the composer with Escape.
          </Dialog.Description>

          <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {SHORTCUT_GROUPS.map(({ group, items }) => (
              <section key={group}>
                <h3 className="mb-1.5 text-xs font-medium text-tertiary">{group}</h3>
                <dl className="divide-y divide-[var(--border-subtle)]">
                  {items.map(([label, keys]) => (
                    <div key={label} className="flex items-center justify-between gap-4 py-1.5">
                      <dt className="text-sm text-secondary">{label}</dt>
                      <dd className="shrink-0">
                        <Kbd keys={keys} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          <Dialog.Close
            aria-label="Close"
            className="ctl absolute right-3 top-3 flex [--ctl:1.75rem] items-center justify-center rounded-md text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
          >
            <X size={15} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
