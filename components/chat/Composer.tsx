"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ArrowUp, Columns2, Paperclip, Square, X, FileText, Check } from "lucide-react";
import type { ContentBlock } from "@/lib/types";
import { getModel, estimateTokens, formatCost, formatTokens, MODELS } from "@/lib/models";
import { fileToBase64, formatBytes, cn } from "@/lib/utils";
import { useSettings, useDrafts } from "@/lib/store";
import { Tooltip } from "@/components/ui/primitives";
import { ProviderMark } from "@/components/ui/ProviderMark";

/** Longer than this and a paste becomes a chip instead of flooding the box. */
const PASTE_COLLAPSE_CHARS = 1500;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

interface Attachment {
  id: string;
  kind: "image" | "file";
  name: string;
  mimeType: string;
  size: number;
  data: string;
  preview?: string;
}

export function Composer({
  conversationId,
  streaming,
  contextTokens,
  modelId,
  spentUsd,
  onSend,
  onStop,
  onEditLast,
  onOpenModels,
  compareWith,
  onCompareChange,
  availableModels,
}: {
  conversationId: string;
  streaming: boolean;
  contextTokens: number;
  /** The thread's model, not the app's. */
  modelId: string;
  /** What this thread has actually cost, accumulated from real usage. */
  spentUsd: number;
  onSend: (content: ContentBlock[]) => void;
  onStop: () => void;
  onEditLast: () => void;
  onOpenModels: () => void;
  compareWith: string[];
  onCompareChange: (ids: string[]) => void;
  availableModels: (id: string) => boolean;
}) {
  const settings = useSettings();
  const drafts = useDrafts();
  const model = getModel(modelId);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const dragDepth = React.useRef(0);

  const text = drafts.drafts[conversationId] ?? "";
  const setText = (v: string) => drafts.setDraft(conversationId, v);

  /* --- Auto-grow. The composer grows upward; the page never shifts. -------- */
  const resize = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.4)}px`;
  }, []);

  React.useEffect(resize, [text, resize]);

  /* --- Drafts survive switching conversations, cursor position included. --- */
  React.useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
    setAttachments([]);
  }, [conversationId]);

  const addFiles = React.useCallback(async (files: File[]) => {
    const next: Attachment[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        setNotice(`${file.name} is ${formatBytes(file.size)} — the limit is 20 MB.`);
        continue;
      }
      const isImage = file.type.startsWith("image/");
      if (isImage) {
        next.push({
          id: crypto.randomUUID(),
          kind: "image",
          name: file.name,
          mimeType: file.type,
          size: file.size,
          data: await fileToBase64(file),
          preview: URL.createObjectURL(file),
        });
      } else {
        // Text-ish files are inlined as text; anything binary is refused with a
        // reason rather than silently sent as noise.
        const readable =
          file.type.startsWith("text/") ||
          /\.(md|txt|csv|json|ya?ml|tsx?|jsx?|py|rb|go|rs|java|c|h|cpp|sh|sql|toml|ini|env|log)$/i.test(file.name);
        if (!readable) {
          setNotice(`${file.name} isn't a text or image file, so the model can't read it.`);
          continue;
        }
        next.push({
          id: crypto.randomUUID(),
          kind: "file",
          name: file.name,
          mimeType: file.type || "text/plain",
          size: file.size,
          data: await file.text(),
        });
      }
    }
    if (next.length) setAttachments((a) => [...a, ...next]);
  }, []);

  const send = () => {
    if (streaming) return;
    const trimmed = text.trim();
    if (!trimmed && !attachments.length) return;

    const content: ContentBlock[] = [
      ...attachments.map((a): ContentBlock =>
        a.kind === "image"
          ? { type: "image", mimeType: a.mimeType, data: a.data, name: a.name }
          : { type: "file", mimeType: a.mimeType, name: a.name, text: a.data },
      ),
      ...(trimmed ? [{ type: "text" as const, text: trimmed }] : []),
    ];

    onSend(content);
    setText("");
    setAttachments([]);
    requestAnimationFrame(resize);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && settings.sendOnEnter && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
      return;
    }
    // Escape steps out of the composer. Everything that only works when you are
    // not typing — j/k, ?, backing out of a section — depends on being able to
    // leave, and a text box you cannot leave with the keyboard is a trap.
    if (e.key === "Escape") {
      e.currentTarget.blur();
      return;
    }
    // ↑ on an empty box edits the last thing you said — the fastest possible
    // path to the most common correction.
    if (e.key === "ArrowUp" && !text) {
      e.preventDefault();
      onEditLast();
    }
  };

  const onPaste = async (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length) {
      e.preventDefault();
      await addFiles(files);
      return;
    }
    const pasted = e.clipboardData.getData("text");
    if (pasted.length > PASTE_COLLAPSE_CHARS) {
      e.preventDefault();
      setAttachments((a) => [
        ...a,
        {
          id: crypto.randomUUID(),
          kind: "file",
          name: `Pasted text · ${pasted.length.toLocaleString()} chars`,
          mimeType: "text/plain",
          size: pasted.length,
          data: pasted,
        },
      ]);
    }
  };

  const draftTokens = estimateTokens(text) + attachments.reduce((n, a) => n + (a.kind === "file" ? estimateTokens(a.data) : 800), 0);
  const totalTokens = contextTokens + draftTokens;
  const overContext = totalTokens > model.contextWindow * 0.9;
  const canSend = Boolean(text.trim() || attachments.length);

  return (
    <div
      className="relative"
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        await addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {dragging && (
        <div className="absolute inset-x-0 -top-24 bottom-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-[color-mix(in_srgb,var(--accent-subtle)_85%,transparent)] anim-fade">
          <span className="text-sm font-medium text-accent">Drop to attach</span>
        </div>
      )}

      {notice && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-subtle px-3 py-1.5 text-xs text-secondary anim-fade">
          {notice}
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="ml-auto text-tertiary hover:text-primary">
            <X size={13} />
          </button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="group/chip flex items-center gap-2 rounded-md border border-line bg-surface py-1 pl-1 pr-2 anim-pop"
            >
              {a.kind === "image" && a.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.preview} alt="" className="size-7 rounded-sm object-cover" />
              ) : (
                <span className="flex size-7 items-center justify-center rounded-sm bg-subtle text-tertiary">
                  <FileText size={14} />
                </span>
              )}
              <span className="max-w-48 truncate text-xs text-secondary">{a.name}</span>
              <button
                onClick={() => setAttachments((list) => list.filter((x) => x.id !== a.id))}
                aria-label={`Remove ${a.name}`}
                className="text-tertiary transition-colors hover:text-primary"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          "rounded-xl border bg-surface transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-std)]",
          "border-line-strong shadow-sm focus-within:border-accent focus-within:shadow-md",
          streaming && "is-live",
        )}
      >
        <div className="flex items-end gap-1 p-1.5">
          <label className="shrink-0">
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={async (e) => {
                await addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <Tooltip label="Attach files">
              <span
                role="button"
                tabIndex={0}
                aria-label="Attach files"
                className="flex size-8 cursor-pointer items-center justify-center rounded-md text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
              >
                <Paperclip size={16} />
              </span>
            </Tooltip>
          </label>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            rows={1}
            placeholder={`Message ${model.name}…`}
            aria-label="Message"
            className="max-h-[40vh] min-w-0 flex-1 resize-none bg-transparent py-1.5 text-base text-primary outline-none placeholder:text-tertiary"
          />

          {/* Send becomes stop in place, via a crossfade. A second button that
              appears elsewhere makes the user re-aim mid-thought. */}
          <div className="relative size-8 shrink-0">
            <button
              onClick={send}
              disabled={!canSend || streaming}
              aria-label="Send message"
              className={cn(
                "absolute inset-0 flex items-center justify-center rounded-md bg-[var(--accent-fill)] text-accent-fg transition-[opacity,background-color] duration-[var(--dur-fast)] ease-[var(--ease-std)]",
                "hover:bg-[var(--accent-fill-hover)] disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-tertiary)]",
                streaming ? "pointer-events-none opacity-0" : "opacity-100",
              )}
            >
              <ArrowUp size={16} />
            </button>
            <button
              onClick={onStop}
              aria-label="Stop generating"
              className={cn(
                "absolute inset-0 flex items-center justify-center rounded-md bg-primary text-canvas transition-opacity duration-[var(--dur-fast)] ease-[var(--ease-std)]",
                streaming ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              style={{ background: "var(--text-primary)", color: "var(--bg-canvas)" }}
            >
              <Square size={12} fill="currentColor" />
            </button>
          </div>
        </div>

        {/* One quiet 24px strip: what you are talking to, and what it will cost. */}
        <div className="flex h-6 items-center gap-2 px-3 pb-1.5 text-xs text-tertiary">
          <button
            onClick={onOpenModels}
            className="-ml-1 flex items-center gap-1.5 rounded-sm px-1 transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-secondary"
          >
            <ProviderMark provider={model.provider} size={11} />
            {model.name}
          </button>

          <Popover.Root>
            <Tooltip label="Ask several models the same thing">
              <Popover.Trigger asChild>
                <button
                  aria-label="Compare models"
                  className={cn(
                    "flex h-5 items-center gap-1 rounded-sm px-1 transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-secondary",
                    compareWith.length && "text-accent hover:text-accent",
                  )}
                >
                  <Columns2 size={12} />
                  {compareWith.length ? `Comparing ${compareWith.length + 1}` : "Compare"}
                </button>
              </Popover.Trigger>
            </Tooltip>
            <Popover.Portal>
              <Popover.Content
                align="start"
                sideOffset={8}
                className="z-50 w-72 rounded-lg border border-line bg-surface p-1 shadow-lg anim-pop"
              >
                <p className="px-2 pb-1 pt-2 text-xs text-tertiary">
                  Answer alongside {model.name} — pick up to two.
                </p>
                <div className="max-h-72 overflow-y-auto">
                  {MODELS.filter((m) => m.id !== modelId).map((m) => {
                    const on = compareWith.includes(m.id);
                    const usable = availableModels(m.id);
                    return (
                      <button
                        key={m.id}
                        disabled={!usable || (!on && compareWith.length >= 2)}
                        onClick={() =>
                          onCompareChange(
                            on ? compareWith.filter((x) => x !== m.id) : [...compareWith, m.id],
                          )
                        }
                        className="focus-inset flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                      >
                        <span className="text-tertiary">
                          <ProviderMark provider={m.provider} size={12} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{m.name}</span>
                        {on && <Check size={13} className="shrink-0 text-accent" />}
                      </button>
                    );
                  })}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <span className="ml-auto flex items-center gap-2 tnum">
            {overContext && (
              <span className="text-warning">
                {formatTokens(totalTokens)} / {formatTokens(model.contextWindow)}
              </span>
            )}
            {!overContext && totalTokens > 0 && <span>~{formatTokens(totalTokens)} tok</span>}
            {spentUsd > 0 && (
              <Tooltip label="What this conversation has cost so far">
                <span>{formatCost(spentUsd)}</span>
              </Tooltip>
            )}
          </span>
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-tertiary">
        Models make mistakes. Check anything that matters.
      </p>
    </div>
  );
}
