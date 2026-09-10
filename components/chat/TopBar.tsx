"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Archive, ArchiveRestore, Check, Download, FolderOpen, MoreHorizontal,
  NotebookPen, PanelLeft, Pin, PinOff, Trash2,
} from "lucide-react";
import type { Conversation, Project } from "@/lib/types";
import { useSettings } from "@/lib/store";
import { formatCost, formatTokens } from "@/lib/models";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/primitives";

export function TopBar({
  conversation,
  scrolled,
  onRename,
  onExport,
  onDelete,
  onTogglePin,
  onToggleArchive,
  onSaveAsNote,
  projects,
  onMoveToProject,
  onOpenProject,
}: {
  conversation: Conversation | null;
  scrolled: boolean;
  onRename: (title: string) => void;
  onExport: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onSaveAsNote: () => void;
  projects: Project[];
  /** null takes the conversation out of whatever project it is in. */
  onMoveToProject: (projectId: string | null) => void;
  onOpenProject: (projectId: string) => void;
}) {
  const { sidebarOpen, toggleSidebar } = useSettings();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  return (
    <header
      className={cn(
        "glass safe-top no-print sticky top-0 z-20 flex h-[calc(var(--topbar-h)+env(safe-area-inset-top))] shrink-0 items-center gap-1 px-2 transition-[border-color] duration-[var(--dur-fast)]",
        "border-b",
        // The hairline only exists once there is content above it to separate.
        scrolled ? "border-line" : "border-transparent",
      )}
    >
      {!sidebarOpen && (
        <IconButton label="Show sidebar" keys={["mod", "\\"]} onClick={toggleSidebar}>
          <PanelLeft size={16} />
        </IconButton>
      )}

      {/* The model picker is not here. It sits in the composer, next to the
          box you are about to type in, where the decision actually is. */}

      {/* Which project you are inside, where you can see it while you type.
          A chat that silently carries three pages of instructions and says
          nothing about it is a chat whose answers you cannot account for. */}
      {conversation?.projectId && (
        <button
          onClick={() => onOpenProject(conversation.projectId!)}
          className="focus-inset ml-1 flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-full border border-line bg-accent-subtle px-2.5 text-xs text-accent transition-colors duration-[var(--dur-fast)] hover:border-line-strong"
        >
          <FolderOpen size={12} className="shrink-0" />
          <span className="max-w-[9rem] truncate">
            {projects.find((p) => p.id === conversation.projectId)?.name ?? "Project"}
          </span>
        </button>
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
        {conversation && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                aria-label="Conversation options"
                className="flex size-8 items-center justify-center rounded-md text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
              >
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 w-52 rounded-lg glass border border-line p-1 shadow-lg anim-pop"
              >
                <Item onSelect={onTogglePin} icon={conversation.pinned ? <PinOff size={14} /> : <Pin size={14} />}>
                  {conversation.pinned ? "Unpin" : "Pin to top"}
                </Item>
                {/* Moving a chat into a project is a *retrospective* action —
                    you rarely know it belongs to one until the third message —
                    so it lives here rather than only at the moment of creation. */}
                {projects.length > 0 && (
                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger className="focus-inset flex h-8 w-full cursor-default items-center gap-2.5 rounded-md px-2 text-sm text-secondary outline-none transition-colors duration-[var(--dur-fast)] data-[highlighted]:bg-subtle data-[highlighted]:text-primary">
                      <FolderOpen size={14} className="shrink-0 text-tertiary" />
                      <span className="flex-1 text-left">Project</span>
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.SubContent
                        sideOffset={4}
                        className="z-50 max-h-72 w-52 overflow-y-auto rounded-lg glass border border-line p-1 shadow-lg anim-pop"
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
        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors duration-[var(--dur-fast)]",
        danger ? "text-danger data-[highlighted]:bg-[var(--danger-subtle)]" : "text-secondary data-[highlighted]:bg-subtle data-[highlighted]:text-primary",
      )}
    >
      <span className="text-tertiary">{icon}</span>
      {children}
    </DropdownMenu.Item>
  );
}
