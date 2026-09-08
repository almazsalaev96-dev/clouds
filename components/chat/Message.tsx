"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, ChevronRight as Caret, Copy,
  NotebookPen, PanelRight, Pencil, RefreshCw, ThumbsDown, ThumbsUp, Volume2, X,
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
export function UserMessage({
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
  onEdit: (text: string) => void;
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
                onEdit(draft);
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
                onEdit(draft);
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

/* ----------------------------------------------------------- assistant ---- */

export function AssistantMessage({
  message,
  siblings,
  index,
  onNavigate,
  onRegenerate,
  onSaveToNote,
  entering,
}: {
  message: Msg;
  siblings: Msg[];
  index: number;
  onNavigate: (id: string) => void;
  onRegenerate: (modelId?: string) => void;
  onSaveToNote: (text: string) => void;
  entering?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const [vote, setVote] = React.useState<"up" | "down" | null>(null);
  const [speaking, setSpeaking] = React.useState(false);
  const text = blockText(message.content);
  const model = message.modelId ? getModel(message.modelId) : null;
  const artifact = useArtifact();
  // Past roughly a screen and a half, an answer stops being part of the
  // conversation and starts being a document you scroll past to keep talking.
  const isLong = text.length > 2200;

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
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

      {message.error && <InlineError message={message.error} onRetry={() => onRegenerate()} />}

      <div className="mt-1.5 flex h-7 items-center gap-0.5 reveal">
        {siblings.length > 1 && <BranchNav siblings={siblings} index={index} onNavigate={onNavigate} />}
        <IconButton label={copied ? "Copied" : "Copy"} size={28} onClick={copy}>
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
        </IconButton>
        <IconButton label="Regenerate" size={28} onClick={() => onRegenerate()}>
          <RefreshCw size={14} />
        </IconButton>
        <DropdownMenu.Root>
          <Tooltip label="Regenerate with another model">
            <DropdownMenu.Trigger asChild>
              <button
                aria-label="Regenerate with another model"
                className="flex size-6 items-center justify-center rounded-md text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
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
                  onSelect={() => onRegenerate(m.id)}
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
        {isLong && artifact && (
          <IconButton
            label="Open in side panel"
            size={28}
            onClick={() =>
              artifact.open({
                kind: "document",
                title: text.match(/^#{1,3}\s+(.+)$/m)?.[1]?.slice(0, 60) ?? "Answer",
                content: text,
              })
            }
          >
            <PanelRight size={14} />
          </IconButton>
        )}
        <IconButton label="Keep as a note" size={28} onClick={() => onSaveToNote(text)}>
          <NotebookPen size={14} />
        </IconButton>
        <IconButton label={speaking ? "Stop reading" : "Read aloud"} size={28} onClick={speak} active={speaking}>
          <Volume2 size={14} />
        </IconButton>
        <span className="mx-1 h-3.5 w-px bg-[var(--border-subtle)]" />
        <IconButton
          label="Good response"
          size={28}
          active={vote === "up"}
          onClick={() => setVote((v) => (v === "up" ? null : "up"))}
        >
          <ThumbsUp size={14} className={cn(vote === "up" && "text-success")} />
        </IconButton>
        <IconButton
          label="Bad response"
          size={28}
          active={vote === "down"}
          onClick={() => setVote((v) => (v === "down" ? null : "down"))}
        >
          <ThumbsDown size={14} className={cn(vote === "down" && "text-danger")} />
        </IconButton>
      </div>
    </div>
  );
}

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
        Thought for a moment
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
        className="flex size-6 items-center justify-center rounded-sm hover:bg-subtle hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent"
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
        className="flex size-6 items-center justify-center rounded-sm hover:bg-subtle hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent"
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
              className="flex size-7 items-center justify-center rounded-sm text-tertiary hover:bg-subtle hover:text-primary"
            >
              <X size={14} />
            </button>
          </Tooltip>
        )}
      </span>
    </div>
  );
}
