"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Download, Layers, MoreHorizontal, NotebookPen, PanelLeft, Pin, PinOff, Trash2 } from "lucide-react";
import type { Conversation } from "@/lib/types";
import { useSettings } from "@/lib/store";
import { formatCost, formatTokens } from "@/lib/models";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/primitives";
import { ModelPicker } from "./ModelPicker";

export function TopBar({
  conversation,
  scrolled,
  configured,
  modelPickerOpen,
  onModelPickerOpenChange,
  modelId,
  onModelChange,
  onRename,
  onExport,
  onDelete,
  onTogglePin,
  onSaveAsNote,
  onMakeCards,
  busy,
}: {
  conversation: Conversation | null;
  scrolled: boolean;
  configured: Record<string, boolean>;
  modelPickerOpen: boolean;
  onModelPickerOpenChange: (o: boolean) => void;
  modelId: string;
  onModelChange: (id: string) => void;
  onRename: (title: string) => void;
  onExport: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onSaveAsNote: () => void;
  onMakeCards: () => void;
  busy: boolean;
}) {
  const { sidebarOpen, toggleSidebar } = useSettings();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  return (
    <header
      className={cn(
        "no-print sticky top-0 z-20 flex h-[var(--topbar-h)] shrink-0 items-center gap-1 px-2 backdrop-blur-xl transition-[border-color] duration-[var(--dur-fast)]",
        "border-b bg-[color-mix(in_srgb,var(--bg-canvas)_80%,transparent)]",
        // The hairline only exists once there is content above it to separate.
        scrolled ? "border-line" : "border-transparent",
      )}
    >
      {!sidebarOpen && (
        <IconButton label="Show sidebar" keys={["mod", "\\"]} onClick={toggleSidebar}>
          <PanelLeft size={16} />
        </IconButton>
      )}

      <ModelPicker
        open={modelPickerOpen}
        onOpenChange={onModelPickerOpenChange}
        value={modelId}
        onChange={onModelChange}
        configured={configured}
      />

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
                className="z-50 w-52 rounded-lg border border-line bg-surface p-1 shadow-md anim-pop"
              >
                <Item onSelect={onTogglePin} icon={conversation.pinned ? <PinOff size={14} /> : <Pin size={14} />}>
                  {conversation.pinned ? "Unpin" : "Pin to top"}
                </Item>
                <Item onSelect={onSaveAsNote} icon={<NotebookPen size={14} />}>
                  Save as a note
                </Item>
                <Item onSelect={onMakeCards} icon={<Layers size={14} />}>
                  {busy ? "Making flashcards…" : "Make flashcards"}
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
