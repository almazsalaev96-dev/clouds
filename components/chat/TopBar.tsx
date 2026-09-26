"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Archive, ArchiveRestore, Check, ChevronDown, Download, FolderOpen, MessageSquareDashed,
  MoreHorizontal, NotebookPen, PanelLeft, Pin, PinOff, Share2, Trash2, Wand2,
} from "lucide-react";
import type { Conversation, Project } from "@/lib/types";
import { useSettings } from "@/lib/store";
import { formatCost, formatTokens } from "@/lib/models";
import { cn } from "@/lib/utils";
import { IconButton, Tooltip } from "@/components/ui/primitives";
import { ModelPicker, PresetIcon } from "./ModelPicker";
import { AUTO, getModel } from "@/lib/models";
import { getPreset, resolvePreset } from "@/lib/presets";
import { paramsFor } from "@/lib/store";

export function TopBar({
  conversation,
  scrolled,
  onRename,
  onExport,
  onShare,
  onDelete,
  onTogglePin,
  onToggleArchive,
  onSaveAsNote,
  projects,
  onMoveToProject,
  onOpenProject,
  pendingProject,
  assistants = [],
  pendingAssistant,
  onOpenAssistant,
  temporary,
  research,
  onToggleResearch,
  onToggleTemporary,
  modelId,
  configured,
  modelPickerOpen,
  onModelPickerOpenChange,
  onModelChange,
}: {
  conversation: Conversation | null;
  scrolled: boolean;
  onRename: (title: string) => void;
  onExport: () => void;
  /** The device's share sheet with the thread as text, or a copy of it. */
  onShare?: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onSaveAsNote: () => void;
  projects: Project[];
  /** null takes the conversation out of whatever project it is in. */
  onMoveToProject: (projectId: string | null) => void;
  onOpenProject: (projectId: string) => void;
  /** The project a chat not yet started belongs to. */
  pendingProject?: string | null;
  /** The person's assistants, to name the one answering this thread. */
  assistants?: { id: string; name: string; icon: string }[];
  /** The assistant a chat not yet started will answer as. */
  pendingAssistant?: string | null;
  onOpenAssistant?: (id: string) => void;
  /** This chat is not kept — or the next one will not be. */
  temporary?: boolean;
  research?: boolean;
  onToggleResearch?: () => void;
  /** Only before the first message: a chat is temporary from its first word or not at all. */
  onToggleTemporary?: () => void;
  /** Which model answers this thread, and the menu that changes it. */
  modelId: string;
  configured: Record<string, boolean>;
  modelPickerOpen: boolean;
  onModelPickerOpenChange: (o: boolean) => void;
  onModelChange: (id: string) => void;
}) {
  const { sidebarOpen, toggleSidebar, keys } = useSettings();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const inProject = conversation?.projectId ?? (conversation ? null : pendingProject) ?? null;
  const asAssistant = assistants.find((a) => a.id === (conversation?.assistantId ?? (conversation ? null : pendingAssistant))) ?? null;
  /* One of Armi's own, or an engine picked directly. The bar names both: the
     tactic is what was chosen and the engine is who is answering, and an app
     that showed only the first would be claiming a model it did not build. */
  const preset = getPreset(modelId);
  const model = getModel(preset ? resolvePreset(modelId, { configured, keys })!.modelId : modelId);
  const reasoning = paramsFor(modelId).reasoningEffort ?? preset?.effort;
  const effort = reasoning ? { low: "Quick", medium: "Normal", high: "Hard" }[reasoning] : "";

  return (
    <header
      className={cn(
        "safe-top no-print sticky top-0 z-20 flex h-[calc(var(--topbar-h)+env(safe-area-inset-top))] shrink-0 items-center gap-1 px-2 transition-[border-color,background-color] duration-[var(--dur-fast)]",
        "border-b",
        /* Not a bar until there is something to be a bar over. At rest the
           page shows through and the two controls sit on it as pills, the
           way the reference's do; once the transcript scrolls under, the
           strip takes the glass and the hairline so the words stay legible
           behind the controls. */
        scrolled ? "glass border-line" : "border-transparent bg-transparent",
      )}
    >
      {/* The panel's own switch, and it lives out here rather than inside
          the panel.

          It was in the sidebar's header, which is the one place it cannot
          sensibly be: a control that hides a thing, drawn on the thing it
          hides. Collapsed, it had to be replaced by a second copy somewhere
          else, and the two took turns existing. Out here it is one control
          that never moves and never changes meaning — it says show when the
          panel is away and hide when it is there, in the same square of
          screen either way, which is what makes it findable without being
          looked for. It is also where the reference puts it. */}
      <IconButton
        label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        keys={["mod", "\\"]}
        onClick={toggleSidebar}
        className="rounded-lg hover:bg-subtle"
      >
        <PanelLeft size={16} />
      </IconButton>

      {/* Which model answers, at the top left, which is where the eye starts
          and where every assistant with more than one model puts it. It has
          been in three places: the header, then the composer beside send,
          then the composer beside the plus. The composer was the wrong room
          for it in the end — it is a fact about the whole conversation, not
          about the message you are typing, and it has to be readable while
          you are reading the answers rather than only while you type. */}
      <ModelPicker
        open={modelPickerOpen}
        onOpenChange={onModelPickerOpenChange}
        value={modelId}
        onChange={onModelChange}
        configured={configured}
        align="start"
      >
        <button
          aria-label={
            modelId === AUTO
              ? "Model: chosen automatically"
              : preset
                ? `Model: ${preset.name}`
                : "Model: Armi"
          }
          className="btn-touch focus-inset flex h-8 min-w-0 shrink items-center gap-1 rounded-full bg-subtle/70 px-3 text-[0.8125rem] text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
        >
          {modelId === AUTO ? (
            <>
              <Wand2 size={12} className="shrink-0 text-[var(--accent-2)]" />
              <span className="truncate">Auto</span>
            </>
          ) : preset ? (
            <>
              <PresetIcon id={preset.id} size={12} className="shrink-0 text-[var(--accent-2)]" />
              {/* Without the prefix: the product name is already on every
                  screen, and "ARMI Parallax" in a chip that truncates says the
                  company twice and the model not at all. */}
              <span className="truncate">{preset.short}</span>
              {/* How hard it is thinking, where that is a choice somebody made.
                  Which engine it rents is a fact about this browser's keys
                  rather than about the model they picked, and it is in the
                  menu below and in Settings. */}
              {effort && <span className="hidden text-tertiary sm:inline">{effort}</span>}
            </>
          ) : (
            /* A thread pinned to an engine before the menu stopped offering
               them. It keeps answering on that engine — changing what somebody
               chose would be worse than the name — but the chip says whose app
               this is, not whose model it rented. */
            <>
              <PresetIcon id="" size={12} className="shrink-0 text-[var(--accent-2)]" />
              <span className="truncate">Armi</span>
              {model.reasoning && effort && (
                <span className="hidden text-tertiary sm:inline">{effort}</span>
              )}
            </>
          )}
          <ChevronDown size={11} className="shrink-0 text-tertiary" />
        </button>
      </ModelPicker>

      {/* Which project you are inside, where you can see it while you type.
          A chat that silently carries three pages of instructions and says
          nothing about it is a chat whose answers you cannot account for.

          Including before the first message, when there is no conversation row
          to read it off yet — "New chat here" used to create one immediately so
          that this had something to show, which left an empty row in the
          sidebar every time somebody pressed it and changed their mind. */}
      {inProject && (
        <button
          onClick={() => onOpenProject(inProject)}
          className="focus-inset ml-1 flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-full border border-line bg-accent-subtle px-2.5 text-xs text-accent transition-colors duration-[var(--dur-fast)] hover:border-line-strong"
        >
          <FolderOpen size={12} className="shrink-0" />
          <span className="max-w-[9rem] truncate">
            {projects.find((p) => p.id === inProject)?.name ?? "Project"}
          </span>
        </button>
      )}

      {/* Who is answering, when it is one of your own: the instructions it
          carries are yours, and a chat that follows them should say so. */}
      {asAssistant && (
        <button
          onClick={() => onOpenAssistant?.(asAssistant.id)}
          aria-label={`Answering as ${asAssistant.name}`}
          className="focus-inset ml-1 flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary"
        >
          <span aria-hidden>{asAssistant.icon}</span>
          <span className="max-w-[9rem] truncate">{asAssistant.name}</span>
        </button>
      )}

      {/* Not kept, said where the title would be. A chat that is going to
          vanish should look different from one that is not, for the whole
          of its life, in the one place every screen has in common. */}
      {temporary && (
        <Tooltip label="Not saved: gone when you leave, and not remembered">
          <span className="ml-1 flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-2.5 text-xs text-secondary">
            <MessageSquareDashed size={12} className="shrink-0" />
            Temporary
          </span>
        </Tooltip>
      )}

      {conversation && (
        <div className="mx-2 hidden min-w-0 flex-1 text-center sm:block">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                onRename(draft.trim() || conversation.title);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditing(false);
              }}
              aria-label="Conversation title"
              className="w-full max-w-sm rounded-sm bg-transparent text-center text-sm text-primary outline-none ring-1 ring-accent"
            />
          ) : (
            <button
              onClick={() => {
                setDraft(conversation.title);
                setEditing(true);
              }}
              className="mx-auto block max-w-sm truncate rounded-sm px-2 py-0.5 text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
              title={conversation.title || "Untitled"}
            >
              {conversation.title || "New chat"}
            </button>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-0.5">
        {/* Before the first message only. ChatGPT, Gemini and Claude all
            put this here, top right of a new chat, and it is the right
            place: a decision about the chat you are about to have, made
            before you have it, and impossible to make after. */}
        {/* Research used to be a globe here. It moved into the composer, where
            the question it applies to is typed: it is a decision about this
            sentence rather than a property of the room, and a bare globe in
            the corner is also a guess about what kind of globe it is. The
            props stay on this component because the bar still owns temporary,
            and a room that wants the pair together has somewhere to put it. */}
        {!conversation && onToggleTemporary && (
          <IconButton label={temporary ? "Keep this chat" : "Temporary chat"} active={temporary} onClick={onToggleTemporary}>
            <MessageSquareDashed size={16} />
          </IconButton>
        )}
        {conversation && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                aria-label="Conversation options"
                className="ctl [--ctl:2rem] flex items-center justify-center rounded-md text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
              >
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 w-52 rounded-md glass border border-line p-1.5 shadow-lg anim-menu"
              >
                <Item onSelect={onTogglePin} icon={conversation.pinned ? <PinOff size={14} /> : <Pin size={14} />}>
                  {conversation.pinned ? "Unpin" : "Pin to top"}
                </Item>
                {/* Moving a chat into a project is a *retrospective* action —
                    you rarely know it belongs to one until the third message —
                    so it lives here rather than only at the moment of creation. */}
                {projects.length > 0 && (
                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger className="focus-inset flex h-9 w-full cursor-default items-center gap-2.5 rounded-md px-2 text-sm text-secondary outline-none transition-colors duration-[var(--dur-fast)] data-[highlighted]:bg-subtle data-[highlighted]:text-primary">
                      <FolderOpen size={14} className="shrink-0 text-tertiary" />
                      <span className="flex-1 text-left">Project</span>
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.SubContent
                        sideOffset={4}
                        className="z-50 max-h-72 w-52 overflow-y-auto rounded-md glass border border-line p-1.5 shadow-lg anim-menu"
                      >
                        <Item onSelect={() => onMoveToProject(null)} icon={<span className="size-3.5" />}>
                          <span className="flex-1">No project</span>
                          {!conversation.projectId && <Check size={13} className="text-accent" />}
                        </Item>
                        {projects.map((p) => (
                          <Item
                            key={p.id}
                            onSelect={() => onMoveToProject(p.id)}
                            icon={<FolderOpen size={14} />}
                          >
                            <span className="min-w-0 flex-1 truncate">{p.name}</span>
                            {conversation.projectId === p.id && (
                              <Check size={13} className="shrink-0 text-accent" />
                            )}
                          </Item>
                        ))}
                      </DropdownMenu.SubContent>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Sub>
                )}
                <Item onSelect={onSaveAsNote} icon={<NotebookPen size={14} />}>
                  Save as a note
                </Item>
                {/* Between keeping and deleting. A conversation you are done
                    with but do not want to lose does not belong in a list you
                    scan every day, and deleting it to tidy up is a decision
                    you cannot take back. */}
                <Item
                  onSelect={onToggleArchive}
                  icon={conversation.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                >
                  {conversation.archived ? "Unarchive" : "Archive"}
                </Item>
                {onShare && (
                  <Item onSelect={onShare} icon={<Share2 size={14} />}>
                    Share
                  </Item>
                )}
                <Item onSelect={onExport} icon={<Download size={14} />}>
                  Export as Markdown
                </Item>
                <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
                <Item onSelect={onDelete} icon={<Trash2 size={14} />} danger>
                  Delete conversation
                </Item>
                {conversation.costUsd > 0 && (
                  <>
                    <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
                    <p className="px-2 py-1 text-xs text-tertiary tnum">
                      {formatCost(conversation.costUsd)} spent ·{" "}
                      {formatTokens(conversation.inputTokens + conversation.outputTokens)} tokens
                    </p>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>
    </header>
  );
}

function Item({
  children,
  icon,
  danger,
  onSelect,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm outline-none transition-colors duration-[var(--dur-fast)]",
        danger ? "text-danger data-[highlighted]:bg-[var(--danger-subtle)]" : "text-secondary data-[highlighted]:bg-subtle data-[highlighted]:text-primary",
      )}
    >
      <span className="text-tertiary">{icon}</span>
      {children}
    </DropdownMenu.Item>
  );
}
