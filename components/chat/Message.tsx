"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, ChevronRight as Caret, Copy,
  Download, MoreHorizontal, NotebookPen, PanelRight, Pencil, RefreshCw, Volume2, X,
} from "lucide-react";
import type { ChatError, Message as Msg } from "@/lib/types";
import { getModel, formatTokens, MODELS } from "@/lib/models";
import { blockText } from "@/lib/db";
import { cn, formatDuration } from "@/lib/utils";
import { Markdown } from "./Markdown";
import { IconButton, Button, Tooltip } from "@/components/ui/primitives";
import { ProviderMark } from "@/components/ui/ProviderMark";
import { useArtifact } from "./ArtifactPanel";

/* ---------------------------------------------------------------- user ---- */

/**
 * User turns are bubbles capped at 80% width; assistant turns are unbubbled and
 * full width. The asymmetry is deliberate: it makes the answer read as a
 * document and the question as an utterance, which is how people actually
 * think about the exchange.
 */
function UserMessageImpl({
  message,
  siblings,
  index,
  onNavigate,
  onEdit,
  entering,
}: {
  message: Msg;
  siblings: Msg[];
  index: number;
  onNavigate: (id: string) => void;
  onEdit: (message: Msg, text: string) => void;
  entering?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const text = blockText(message.content);
  const images = message.content.filter((b) => b.type === "image");
  const files = message.content.filter((b) => b.type === "file");
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(ref.current.value.length, ref.current.value.length);
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [editing]);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (editing) {
    return (
      <div className="group flex flex-col items-end gap-2 py-3">
        <div className="w-full max-w-[85%] rounded-lg border border-accent bg-surface p-3">
          <textarea
            ref={ref}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                onEdit(message, draft);
                setEditing(false);
              }
            }}
            className="w-full resize-none bg-transparent text-base text-primary outline-none"
            rows={1}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!draft.trim()}
              onClick={() => {
                onEdit(message, draft);
                setEditing(false);
              }}
            >
              Send
            </Button>
          </div>
        </div>
        <p className="text-xs text-tertiary">
          Editing branches the conversation. The original is kept.
        </p>
      </div>
    );
  }

  return (
    <div id={`m-${message.id}`} className={cn("msg group flex flex-col items-end gap-1.5 py-3", entering && "msg-enter")}>
      {images.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
          {images.map((img, i) =>
            img.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`data:${img.mimeType};base64,${img.data}`}
                alt={img.name ?? "Attached image"}
                className="max-h-48 rounded-lg border border-line object-cover"
              />
            ) : null,
          )}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
          {files.map((f, i) =>
            f.type === "file" ? (
              <span key={i} className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-secondary">
                {f.name}
              </span>
            ) : null,
          )}
        </div>
      )}

      {text && (
        <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-subtle px-3.5 py-2.5 text-base [overflow-wrap:anywhere]">
          {text}
        </div>
      )}

      <div className="flex h-6 items-center gap-0.5 reveal">
        {siblings.length > 1 && (
          <BranchNav siblings={siblings} index={index} onNavigate={onNavigate} />
        )}
        <IconButton
          label={copied ? "Copied" : "Copy"}
          size={26}
          onClick={copy}
        >
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
        </IconButton>
        <IconButton
          label="Edit"
          size={26}
          onClick={() => {
            setDraft(text);
            setEditing(true);
          }}
        >
          <Pencil size={13} />
        </IconButton>
      </div>
    </div>
  );
}

/**
 * Memoised because the transcript re-renders on every frame of a stream, and
 * a message that has not changed has no business re-rendering — parsing its
 * markdown and re-highlighting its code — sixty times a second.
 */
export const UserMessage = React.memo(UserMessageImpl);

/* ----------------------------------------------------------- assistant ---- */

function AssistantMessageImpl({
  message,
  siblings,
  index,
  onNavigate,
  onRegenerate,
  onSaveToNote,
  entering,
  isLast,
}: {
  message: Msg;
  siblings: Msg[];
  index: number;
  onNavigate: (id: string) => void;
  onRegenerate: (message: Msg, modelId?: string) => void;
  onSaveToNote: (text: string) => void;
  entering?: boolean;
  /** The answer you are about to act on keeps its controls on screen. */
  isLast?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const text = blockText(message.content);
  const model = message.modelId ? getModel(message.modelId) : null;
  const artifact = useArtifact();

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  /* A whole answer, as a file, without going through the thread exporter —
     the unit people actually want to keep is usually one reply. */
  const copyAsMarkdown = () => {
    const stamp = new Date(message.createdAt).toISOString().slice(0, 10);
    const name = (text.match(/^#{1,3}\s+(.+)$/m)?.[1] ?? model?.name ?? "answer")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stamp}-${name || "answer"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const speak = () => {
    if (speaking) {
      speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text.replace(/```[\s\S]*?```/g, " code block "));
    utter.onend = () => setSpeaking(false);
    speechSynthesis.speak(utter);
    setSpeaking(true);
  };

  return (
    <div id={`m-${message.id}`} className={cn("msg group py-3", entering && "msg-enter")}>
      {/* Who is speaking, before you read what they said. In an app with four
          providers this is not metadata — it is context. */}
      <div className="mb-2 flex items-center gap-2 text-xs text-tertiary">
        {model && (
          <span className="text-secondary">
            <ProviderMark provider={model.provider} size={12} />
          </span>
        )}
        <span className="font-medium text-secondary">{model?.name ?? "Assistant"}</span>
        {message.latencyMs != null && <span className="tnum">{formatDuration(message.latencyMs)}</span>}
        {message.usage && message.usage.outputTokens > 0 && (
          <span className="tnum">{formatTokens(message.usage.outputTokens)} tok</span>
        )}
        {message.stopReason === "aborted" && <span className="text-warning">stopped</span>}
        {message.stopReason === "length" && <span className="text-warning">hit length limit</span>}
      </div>

      {message.reasoning && <Reasoning text={message.reasoning} />}

      {text ? <Markdown content={text} /> : message.error ? null : (
        <p className="text-sm italic text-tertiary">No response.</p>
      )}

      {message.error && <InlineError message={message.error} onRetry={() => onRegenerate(message)} />}

      {/* Not every action is equal, so they are not drawn equal. Copy and
          regenerate are what people reach for; the rest live one click deeper
          rather than making you read seven identical icons to find the two.

          The row stays put on the last answer — that is the one you are about
          to act on, and making it appear only on hover means discovering it by
          accident. Earlier answers keep it on hover, where it does not compete
          with the reading. */}
      <div
        className="mt-1.5 flex h-7 items-center gap-0.5 reveal"
        data-visible={isLast ? "true" : undefined}
      >
        {siblings.length > 1 && <BranchNav siblings={siblings} index={index} onNavigate={onNavigate} />}
        <IconButton label={copied ? "Copied" : "Copy"} size={28} onClick={copy}>
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
        </IconButton>
        <IconButton label="Regenerate" size={28} onClick={() => onRegenerate(message)}>
          <RefreshCw size={14} />
        </IconButton>
        <DropdownMenu.Root>
          <Tooltip label="Regenerate with another model">
            <DropdownMenu.Trigger asChild>
              <button
                aria-label="Regenerate with another model"
                className="ctl focus-inset flex [--ctl:1.5rem] items-center justify-center rounded-md text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
              >
                <ChevronDown size={13} />
              </button>
            </DropdownMenu.Trigger>
          </Tooltip>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={6}
              className="z-50 w-60 rounded-lg border border-line bg-surface p-1 shadow-md anim-pop"
            >
              {MODELS.filter((m) => m.id !== message.modelId).map((m) => (
                <DropdownMenu.Item
                  key={m.id}
                  onSelect={() => onRegenerate(message, m.id)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-secondary outline-none transition-colors duration-[var(--dur-fast)] data-[highlighted]:bg-subtle data-[highlighted]:text-primary"
                >
                  <span className="text-tertiary">
                    <ProviderMark provider={m.provider} size={12} />
                  </span>
                  <span className="truncate">{m.name}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* One overflow, always in the same place, whether or not the answer is
            long enough to lift into a panel. A control that appears and
            disappears between messages moves everything next to it. */}
        <DropdownMenu.Root>
          <Tooltip label="More">
            <DropdownMenu.Trigger asChild>
              <button
                aria-label="More actions"
                className="ctl focus-inset flex [--ctl:1.75rem] items-center justify-center rounded-md text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
              >
                <MoreHorizontal size={15} />
              </button>
            </DropdownMenu.Trigger>
          </Tooltip>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={6}
              className="z-50 w-56 rounded-lg border border-line bg-surface p-1 shadow-md anim-pop"
            >
              <DropdownMenu.Item
                onSelect={() => onSaveToNote(text)}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-secondary outline-none transition-colors duration-[var(--dur-fast)] data-[highlighted]:bg-subtle data-[highlighted]:text-primary"
              >
                <NotebookPen size={15} className="text-tertiary" />
                Keep as a note
              </DropdownMenu.Item>
              {artifact && (
                <DropdownMenu.Item
                  onSelect={() =>
                    artifact.open({
                      kind: "document",
                      title: text.match(/^#{1,3}\s+(.+)$/m)?.[1]?.slice(0, 60) ?? "Answer",
                      content: text,
                    })
                  }
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-secondary outline-none transition-colors duration-[var(--dur-fast)] data-[highlighted]:bg-subtle data-[highlighted]:text-primary"
                >
                  <PanelRight size={15} className="text-tertiary" />
                  Open in side panel
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault();
                  speak();
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-secondary outline-none transition-colors duration-[var(--dur-fast)] data-[highlighted]:bg-subtle data-[highlighted]:text-primary"
              >
                <Volume2 size={15} className={cn(speaking ? "text-accent" : "text-tertiary")} />
                {speaking ? "Stop reading" : "Read aloud"}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
              <DropdownMenu.Item
                onSelect={copyAsMarkdown}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-secondary outline-none transition-colors duration-[var(--dur-fast)] data-[highlighted]:bg-subtle data-[highlighted]:text-primary"
              >
                <Download size={15} className="text-tertiary" />
                Download as Markdown
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Reading aloud is the one action with a running state, so it stays
            visible while it runs rather than hiding in a menu you have to
            reopen to stop it. */}
        {speaking && (
          <IconButton label="Stop reading" size={28} onClick={speak} active>
            <Volume2 size={14} />
          </IconButton>
        )}
      </div>
    </div>
  );
}

export const AssistantMessage = React.memo(AssistantMessageImpl);

/* -------------------------------------------------------------- pieces ---- */

/** Collapsed by default: reasoning must never outweigh the answer visually. */
function Reasoning({ text }: { text: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 text-sm text-tertiary transition-colors duration-[var(--dur-fast)] hover:text-secondary"
      >
        <Caret size={13} className={cn("transition-transform duration-[var(--dur-fast)]", open && "rotate-90")} />
        Reasoning
      </button>
      {open && (
        <div className="mt-2 whitespace-pre-wrap border-l-2 border-line pl-3 text-sm text-secondary anim-fade">
          {text}
        </div>
      )}
    </div>
  );
}

export function BranchNav({
  siblings,
  index,
  onNavigate,
}: {
  siblings: Msg[];
  index: number;
  onNavigate: (id: string) => void;
}) {
  return (
    <span className="mr-1 flex items-center text-xs text-tertiary">
      <button
        aria-label="Previous version"
        disabled={index <= 0}
        onClick={() => onNavigate(siblings[index - 1].id)}
        className="ctl flex [--ctl:1.5rem] items-center justify-center rounded-sm hover:bg-subtle hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronLeft size={13} />
      </button>
      <span className="tnum px-0.5">
        {index + 1}/{siblings.length}
      </span>
      <button
        aria-label="Next version"
        disabled={index >= siblings.length - 1}
        onClick={() => onNavigate(siblings[index + 1].id)}
        className="ctl flex [--ctl:1.5rem] items-center justify-center rounded-sm hover:bg-subtle hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronRight size={13} />
      </button>
    </span>
  );
}

/**
 * Every failure gets one plain sentence and one specific action. The raw
 * provider payload stays in the console where it belongs.
 */
export function InlineError({
  message,
  error,
  onRetry,
  onAddKey,
  onSwitchModel,
  onDismiss,
}: {
  message?: string;
  error?: ChatError;
  onRetry?: () => void;
  onAddKey?: () => void;
  onSwitchModel?: () => void;
  onDismiss?: () => void;
}) {
  const text = error?.message ?? message ?? "Something went wrong.";
  const action = error?.action ?? "retry";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-l-2 border-[var(--stop)] py-1 pl-3 anim-fade">
      <span className="text-sm text-primary">{text}</span>
      <span className="ml-auto flex items-center gap-1">
        {action === "add_key" && onAddKey && (
          <Button size="sm" variant="secondary" onClick={onAddKey}>
            Add key
          </Button>
        )}
        {(action === "switch_model" || action === "shorten") && onSwitchModel && (
          <Button size="sm" variant="secondary" onClick={onSwitchModel}>
            Switch model
          </Button>
        )}
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        )}
        {onDismiss && (
          <Tooltip label="Dismiss">
            <button
              onClick={onDismiss}
              aria-label="Dismiss error"
              className="ctl flex [--ctl:1.75rem] items-center justify-center rounded-sm text-tertiary hover:bg-subtle hover:text-primary"
            >
              <X size={14} />
            </button>
          </Tooltip>
        )}
      </span>
    </div>
  );
}
