"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Download, MessageSquare, MessageSquarePlus, Moon, PanelLeft, Settings2,
  Sun, Trash2, Type,
} from "lucide-react";
import { db } from "@/lib/db";
import { MODELS } from "@/lib/models";
import { useSettings } from "@/lib/store";
import { cn, fuzzyScore } from "@/lib/utils";
import { Kbd } from "@/components/ui/primitives";

interface Command {
  id: string;
  label: string;
  hint?: string;
  keys?: string[];
  icon: React.ReactNode;
  group: string;
  run: () => void;
}

/**
 * Every action reachable by mouse is reachable here, under the same label.
 * The palette is the app's spine; a control that exists only in a menu is a
 * control keyboard users cannot find.
 */
export function CommandPalette({
  open,
  onOpenChange,
  actions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  actions: {
    newChat: () => void;
    openSettings: () => void;
    selectConversation: (id: string) => void;
    setModel: (id: string) => void;
    exportMarkdown: () => void;
    deleteConversation: () => void;
  };
}) {
  const settings = useSettings();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const conversations = useLiveQuery(
    () => db.conversations.orderBy("updatedAt").reverse().limit(50).toArray(),
    [],
    [],
  );

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const commands = React.useMemo<Command[]>(() => {
    const base: Command[] = [
      { id: "new", label: "New chat", keys: ["mod", "N"], icon: <MessageSquarePlus size={15} />, group: "Actions", run: actions.newChat },
      { id: "settings", label: "Open settings", keys: ["mod", ","], icon: <Settings2 size={15} />, group: "Actions", run: actions.openSettings },
      { id: "export", label: "Export conversation as Markdown", icon: <Download size={15} />, group: "Actions", run: actions.exportMarkdown },
      { id: "delete", label: "Delete this conversation", icon: <Trash2 size={15} />, group: "Actions", run: actions.deleteConversation },
      { id: "sidebar", label: settings.sidebarOpen ? "Hide sidebar" : "Show sidebar", keys: ["mod", "\\"], icon: <PanelLeft size={15} />, group: "View", run: settings.toggleSidebar },
      {
        id: "theme",
        label: settings.theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        keys: ["mod", "shift", "D"],
        icon: settings.theme === "dark" ? <Sun size={15} /> : <Moon size={15} />,
        group: "View",
        run: () => settings.setTheme(settings.theme === "dark" ? "light" : "dark"),
      },
      {
        id: "density",
        label: `Density: ${settings.density}`,
        hint: "Cycle",
        icon: <Type size={15} />,
        group: "View",
        run: () => {
          const order = ["compact", "comfortable", "spacious"] as const;
          settings.setDensity(order[(order.indexOf(settings.density) + 1) % order.length]);
        },
      },
    ];

    const models: Command[] = MODELS.map((m) => ({
      id: `model:${m.id}`,
      label: `Switch to ${m.name}`,
      hint: m.blurb,
      icon: <span className="flex size-[15px] items-center justify-center text-xs text-tertiary">◆</span>,
      group: "Models",
      run: () => actions.setModel(m.id),
    }));

    const chats: Command[] = (conversations ?? [])
      .filter((c) => c.title)
      .map((c) => ({
        id: `chat:${c.id}`,
        label: c.title,
        icon: <MessageSquare size={15} />,
        group: "Conversations",
        run: () => actions.selectConversation(c.id),
      }));

    return [...base, ...models, ...chats];
  }, [actions, conversations, settings]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return commands.slice(0, 12);
    return commands
      .map((c) => ({ c, score: Math.max(fuzzyScore(query, c.label), fuzzyScore(query, c.group) * 0.4) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((r) => r.c);
  }, [commands, query]);

  React.useEffect(() => setActive(0), [query]);

  React.useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (c: Command) => {
    c.run();
    onOpenChange(false);
  };

  let lastGroup = "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--bg-overlay)] anim-fade" />
        <Dialog.Content
          className="fixed left-1/2 top-[18vh] z-50 w-[34rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-lg anim-pop"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && filtered[active]) {
              e.preventDefault();
              run(filtered[active]);
            }
          }}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions, models and conversations"
            aria-label="Command palette"
            className="w-full border-b border-line bg-transparent px-4 py-3 text-base text-primary outline-none placeholder:text-tertiary"
          />
          <div ref={listRef} className="max-h-[22rem] overflow-y-auto p-1.5" role="listbox">
            {filtered.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-tertiary">Nothing matches that.</p>
            )}
            {filtered.map((c, i) => {
              const showGroup = c.group !== lastGroup;
              lastGroup = c.group;
              return (
                <React.Fragment key={c.id}>
                  {showGroup && (
                    <h3 className="px-2 pb-0.5 pt-2 text-xs font-medium text-tertiary">{c.group}</h3>
                  )}
                  <button
                    role="option"
                    aria-selected={i === active}
                    data-active={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => run(c)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-[var(--dur-fast)]",
                      i === active ? "bg-subtle" : "hover:bg-subtle",
                    )}
                  >
                    <span className="shrink-0 text-tertiary">{c.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-primary">{c.label}</span>
                      {c.hint && <span className="block truncate text-xs text-tertiary">{c.hint}</span>}
                    </span>
                    {c.keys && <Kbd keys={c.keys} />}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
