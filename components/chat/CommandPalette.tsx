"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Code2, Download, FileText, FolderOpen, MessageSquare, MessageSquarePlus, Moon,
  Columns2, NotebookPen, PanelLeft, Settings2, Sun, Trash2, Type, Wand2,
} from "lucide-react";
import { db } from "@/lib/db";
import { MODELS } from "@/lib/models";
import { useSettings, type Section } from "@/lib/store";
import { cn, fuzzyScore } from "@/lib/utils";
import { useReturnFocus } from "@/lib/hooks/useReturnFocus";
import { Kbd } from "@/components/ui/primitives";

interface Command {
  id: string;
  label: string;
  hint?: string;
  /** Searched, never shown whole: the body of a note or paper. */
  body?: string;
  keys?: string[];
  icon: React.ReactNode;
  group: string;
  run: () => void;
}

/**
 * How much a hit inside a note or paper body is worth.
 *
 * Scored the same way as a title — earlier is better — then scaled to a third,
 * so it comfortably beats a scattered subsequence match on some other item's
 * title but always loses to an item whose title actually contains what you
 * typed. Below two characters it is off entirely: one letter appears in every
 * document, so matching on it ranks by nothing at all.
 */
function bodyScore(query: string, body?: string): number {
  if (!body || query.length < 2) return 0;
  const at = body.toLowerCase().indexOf(query.toLowerCase());
  return at === -1 ? 0 : Math.max(60, (800 - at) / 3);
}

/** Ties broken here when two groups score the same, so the order is stable. */
const GROUP_ORDER = ["Actions", "Go to", "View", "Models", "Chats", "Projects", "Code", "Notebook"];
/** No single kind of thing may fill the list and bury the rest. */
const PER_GROUP = 5;

/**
 * First line with any substance, trimmed of Markdown scaffolding — skipping any
 * line that just repeats the title, which is most notes, whose first line is
 * the heading the title was derived from. Printing it twice is noise.
 */
function preview(content: string, title: string): string | undefined {
  const t = title.trim().toLowerCase();
  const line = content
    .split("\n")
    .map((l) => l.replace(/^#{1,6}\s+|^[-*+]\s+|^>\s?/, "").trim())
    .find((l) => l.length > 0 && l.toLowerCase() !== t);
  return line ? line.slice(0, 90) : undefined;
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
    /** Opens an item and moves to its section. Both halves, always. */
    open: (section: Section, id: string) => void;
    goToSection: (section: Section) => void;
    setModel: (id: string) => void;
    exportMarkdown: () => void;
    deleteConversation: () => void;
    hasConversation: boolean;
    /**
     * What you are looking at, and what saying something would do to it.
     *
     * The palette knew how to *find* things and nothing about where you were,
     * so the only thing you could do with a sentence was search for it. Given
     * the current object, the same box becomes "say what you want" — which is
     * the thing people try first and the thing it could not do.
     */
    focus: { what: string; where: string } | null;
    /** Carry an instruction out on whatever is in focus. */
    ask: (text: string) => void;
    /**
     * Ask a second model the same question, alongside the first.
     *
     * It used to be a checklist inside the composer's Tools popover, which
     * meant deciding whether you wanted two answers before you had seen one.
     * Here it is a command like any other: out of the way until the moment you
     * want it, and reachable by typing the model's name.
     */
    compareWith: string[];
    setCompareWith: (ids: string[]) => void;
    canUseModel: (id: string) => boolean;
  };
}) {
  const settings = useSettings();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  /* Everything you have made, in one index. A palette that finds only your
     chats is a chat switcher wearing a palette's clothes — and the moment the
     app grew notes, decks, papers and skills, four fifths of your work became
     unreachable from the one place you go to find things. Loaded only while
     the palette is mounted, which is only while it is open. */
  const conversations = useLiveQuery(
    () => db.conversations.orderBy("updatedAt").reverse().limit(60).toArray(),
    [],
    [],
  );
  const projects = useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().limit(40).toArray(), [], []);
  const canvases = useLiveQuery(() => db.canvases.orderBy("updatedAt").reverse().limit(40).toArray(), [], []);
  const notes = useLiveQuery(() => db.notes.orderBy("updatedAt").reverse().limit(60).toArray(), [], []);

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
      // Offered only when there is one. A command that silently does nothing
      // teaches you not to trust the list it is in.
      ...(actions.hasConversation
        ? [
            { id: "export", label: "Export conversation as Markdown", icon: <Download size={15} />, group: "Actions", run: actions.exportMarkdown },
            { id: "delete", label: "Delete this conversation", icon: <Trash2 size={15} />, group: "Actions", run: actions.deleteConversation },
          ]
        : []),
      /* One per model, because "compare" on its own is a menu inside a menu and
         the thing you actually know is which model you want to hear from. The
         one already answering is not in the list, and neither is a model with
         no key — a command that silently does nothing teaches you not to trust
         the list it is in. */
      ...MODELS.filter((m) => m.id !== settings.modelId && actions.canUseModel(m.id)).map((m) => ({
        id: `alongside-${m.id}`,
        label: actions.compareWith.includes(m.id)
          ? `Stop asking ${m.name} alongside`
          : `Also ask ${m.name}, alongside`,
        icon: <Columns2 size={15} />,
        group: "Answer",
        run: () =>
          actions.setCompareWith(
            actions.compareWith.includes(m.id)
              ? actions.compareWith.filter((x) => x !== m.id)
              : [...actions.compareWith, m.id],
          ),
      })),
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

    /* Going somewhere is a command too. Without these the only way into a
       section is the sidebar, which is exactly the mouse the palette exists
       to replace. */
    const nav: Command[] = (
      [
        ["chat", "Chats", <MessageSquare key="c" size={15} />],
        ["code", "Code", <Code2 key="k" size={15} />],
        ["projects", "Projects", <FolderOpen key="j" size={15} />],
        ["notebook", "Notebook", <NotebookPen key="n" size={15} />],
      ] as const
    ).map(([id, label, icon]) => ({
      id: `go:${id}`,
      label: `Go to ${label}`,
      icon,
      group: "Go to",
      run: () => actions.goToSection(id as Section),
    }));

    const chats: Command[] = (conversations ?? [])
      .filter((c) => c.title)
      .map((c) => ({
        id: `chat:${c.id}`,
        label: c.title,
        icon: <MessageSquare size={15} />,
        group: "Chats",
        run: () => actions.open("chat", c.id),
      }));

    /* Notes and papers are searched by their body as well as their title,
       because that is how you actually remember a note: by a phrase in it,
       not by the heading you never wrote. */
    const projectCmds: Command[] = (projects ?? []).map((p) => ({
      id: `project:${p.id}`,
      label: p.name || "Untitled project",
      hint: p.description || undefined,
      body: p.instructions,
      icon: <FolderOpen size={15} />,
      group: "Projects",
      run: () => actions.open("projects", p.id),
    }));

    const canvasCmds: Command[] = (canvases ?? []).map((c) => ({
      id: `canvas:${c.id}`,
      label: c.title || "Untitled",
      hint: c.content.split("\n").find((l) => l.trim()) ?? "Empty",
      body: c.content,
      icon: <Code2 size={15} />,
      group: "Code",
      run: () => actions.open("code", c.id),
    }));

    const noteCmds: Command[] = (notes ?? []).map((n) => ({
      id: `note:${n.id}`,
      label: n.title || "Untitled page",
      hint: preview(n.content, n.title),
      body: n.content,
      icon: <FileText size={15} />,
      group: "Notebook",
      run: () => actions.open("notebook", n.id),
    }));

    return [
      ...base, ...nav, ...models,
      ...chats, ...projectCmds, ...canvasCmds, ...noteCmds,
    ];
  }, [actions, conversations, projects, canvases, notes, settings]);

  /* Ranking has two jobs at once: put the best thing first, and keep each
     group in one piece. Sorting purely by score interleaves a note between two
     chats and prints the same heading three times, which reads as a bug. So
     items are scored individually, groups inherit their best item's score, and
     the list is ordered by group and then within it. */
  const filtered = React.useMemo(() => {
    const q = query.trim();

    if (!q) {
      // The resting list is what you would reach for without typing: the
      // actions, then the few things you touched last.
      const recent = commands.filter((c) => /^(chat|note|deck|paper|skill):/.test(c.id));
      return [...commands.filter((c) => c.group === "Actions"), ...recent.slice(0, 8)];
    }

    const scored = commands
      .map((c) => ({ c, score: Math.max(fuzzyScore(q, c.label), fuzzyScore(q, c.group) * 0.4, bodyScore(q, c.body)) }))
      .filter((r) => r.score > 0);

    const byGroup = new Map<string, typeof scored>();
    for (const r of scored) {
      const list = byGroup.get(r.c.group);
      if (list) list.push(r);
      else byGroup.set(r.c.group, [r]);
    }

    const rows = [...byGroup.entries()]
      .map(([group, items]) => ({
        group,
        items: items.sort((a, b) => b.score - a.score).slice(0, PER_GROUP),
        best: Math.max(...items.map((i) => i.score)),
      }))
      .sort((a, b) =>
        b.best - a.best ||
        GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
      )
      .flatMap((g) => g.items.map((i) => i.c))
      .slice(0, 24);

    /* Say it, rather than find it.
       ------------------------------------------------------------------
       Offered whenever what you typed reads like a sentence rather than a
       name — several words, or words with a space in them that match nothing
       well. The test is deliberately generous in one direction and strict in
       the other: "settings" should never become an instruction, and "make this
       shorter" should never be a failed search. So it appears when there is
       something to act on and either nothing matched or what you typed is
       longer than anybody types into a search box.

       First in the list, because when it applies it is what you meant. */
    const sentence = q.includes(" ") && q.length >= 8;
    if (actions.focus && sentence && (rows.length === 0 || q.split(/\s+/).length >= 3)) {
      const say: Command = {
        id: "ask:focus",
        label: q,
        hint: actions.focus.where,
        icon: <Wand2 size={15} />,
        group: "Say what you want",
        run: () => actions.ask(q),
      };
      return [say, ...rows];
    }
    return rows;
  }, [commands, query, actions]);

  React.useEffect(() => setActive(0), [query]);

  React.useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (c: Command) => {
    c.run();
    onOpenChange(false);
  };

  let lastGroup = "";
  const returnFocus = useReturnFocus(open);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--bg-overlay)] anim-fade" />
        <Dialog.Content
          onCloseAutoFocus={returnFocus}
          className="fixed left-1/2 top-[18vh] z-50 w-[34rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-xl glass border border-line shadow-lg anim-pop"
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
            placeholder={actions.focus ? `Search, or say what to do with ${actions.focus.what}` : "Search everything"}
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
                      "focus-inset flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-[var(--dur-fast)]",
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
