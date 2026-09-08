"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ArrowUp, Brain, Check, FileText, Mic, Paperclip, Plus, SlidersHorizontal, Square, X } from "lucide-react";
import type { ContentBlock } from "@/lib/types";
import { getModel, estimateTokens, formatTokens, MODELS } from "@/lib/models";
import { fileToBase64, formatBytes, cn } from "@/lib/utils";
import { useSettings, useDrafts } from "@/lib/store";
import { useDictation } from "@/lib/hooks/useDictation";
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
  /** Kept for the context warning; the cost itself lives in the thread menu. */
  spentUsd?: number;
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
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [plusOpen, setPlusOpen] = React.useState(false);
  const [toolsOpen, setToolsOpen] = React.useState(false);

  /* Tools carries a state, so the pill has to show it: "on" means this thread
     will not answer the way the defaults would. */
  const thinkLonger =
    model.reasoning && (settings.params[modelId]?.reasoningEffort ?? "medium") === "high";
  const toolsActive = thinkLonger || compareWith.length > 0;

  const text = drafts.drafts[conversationId] ?? "";
  const setText = (v: string) => drafts.setDraft(conversationId, v);

  const dictation = useDictation(
    React.useCallback(
      (phrase: string) => {
        const current = useDrafts.getState().drafts[conversationId] ?? "";
        drafts.setDraft(conversationId, current ? `${current} ${phrase}` : phrase);
      },
      [conversationId, drafts],
    ),
  );
  const dragDepth = React.useRef(0);

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

      {/* One rounded object: what you attached, what you type, and the controls
          that act on it. The focus treatment is a lift, not a colour — an
          accent ring on the thing you type in every single time is a light
          that never turns off. */}
      <div
        className="composer-shell rounded-[28px] border transition-[box-shadow,border-color] duration-[var(--dur-fast)] ease-[var(--ease-std)]"
      >
        {/* Attachments live inside the container, above the line you type on,
            so the whole thing reads as one object rather than a box with a
            tray balanced on top of it. */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-1 pt-3">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="group/chip flex items-center gap-2 rounded-xl border border-line bg-canvas py-1 pl-1 pr-2 anim-pop"
              >
                {a.kind === "image" && a.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.preview} alt="" className="size-8 rounded-lg object-cover" />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-lg bg-subtle text-tertiary">
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

        {/* The line you type on gets the full width. Nothing shares it. */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          rows={1}
          placeholder="Ask anything"
          aria-label="Message"
          className="max-h-[45vh] w-full resize-none bg-transparent px-5 pb-1 pt-4 text-[16px] leading-6 text-primary outline-none placeholder:text-tertiary"
        />

        {/* Controls sit under the text, left to right in the order you reach
            for them: add something, change how it thinks, speak, send. */}
        <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-0.5">
          {/* Everything you can add to a message, behind one control. */}
          <Popover.Root open={plusOpen} onOpenChange={setPlusOpen}>
            <Tooltip label="Add photos and files">
              <Popover.Trigger asChild>
                <button
                  aria-label="Add photos and files"
                  className="ctl focus-inset flex [--ctl:2.25rem] shrink-0 items-center justify-center rounded-full text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                >
                  <Plus size={18} />
                </button>
              </Popover.Trigger>
            </Tooltip>
            <Popover.Portal>
              <Popover.Content
                align="start"
                side="top"
                sideOffset={8}
                className="z-50 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-lg anim-pop"
              >
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    fileRef.current?.click();
                  }}
                  className="focus-inset flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                >
                  <Paperclip size={16} className="text-tertiary" />
                  Add photos and files
                </button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <input
            ref={fileRef}
            type="file"
            multiple
            className="sr-only"
            onChange={async (e) => {
              await addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />

          {/* The two things that change the shape of the answer, not its
              content: how hard the model thinks, and how many answer at once. */}
          <Popover.Root open={toolsOpen} onOpenChange={setToolsOpen}>
            <Popover.Trigger asChild>
              <button
                aria-label="Tools"
                className={cn(
                  "ctl-h focus-inset flex shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm transition-colors duration-[var(--dur-fast)]",
                  toolsActive
                    ? "bg-accent-subtle text-accent"
                    : "text-secondary hover:bg-subtle hover:text-primary",
                )}
              >
                <SlidersHorizontal size={17} />
                <span className="pr-0.5">Tools</span>
                {compareWith.length > 0 && (
                  <span className="tnum text-xs opacity-80">{compareWith.length + 1}</span>
                )}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="start"
                side="top"
                sideOffset={8}
                className="z-50 w-72 rounded-2xl border border-line bg-surface p-1.5 shadow-lg anim-pop"
              >
                {model.reasoning ? (
                  <button
                    onClick={() =>
                      settings.setParams(modelId, { reasoningEffort: thinkLonger ? "medium" : "high" })
                    }
                    className="focus-inset flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-[var(--dur-fast)] hover:bg-subtle"
                  >
                    <Brain size={16} className={cn("mt-0.5 shrink-0", thinkLonger ? "text-accent" : "text-tertiary")} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-primary">Think longer</span>
                      <span className="block text-xs text-tertiary">
                        Slower, and better on problems with steps.
                      </span>
                    </span>
                    {thinkLonger && <Check size={14} className="mt-1 shrink-0 text-accent" />}
                  </button>
                ) : (
                  <p className="px-2.5 py-2 text-xs text-tertiary">
                    {model.name} answers in one pass — there is no thinking step to lengthen.
                  </p>
                )}

                <div className="my-1 h-px bg-[var(--border-subtle)]" />
                <p className="flex items-center justify-between px-2.5 pb-1 pt-1.5 text-xs text-tertiary">
                  <span>Answer alongside {model.name}</span>
                  {compareWith.length > 0 && (
                    <button
                      onClick={() => onCompareChange([])}
                      className="text-xs text-accent hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </p>
                <div className="max-h-56 overflow-y-auto">
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
                        className="focus-inset flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                      >
                        <span className="text-tertiary">
                          <ProviderMark provider={m.provider} size={12} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{m.name}</span>
                        {on && <Check size={14} className="shrink-0 text-accent" />}
                      </button>
                    );
                  })}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <div className="flex-1" />

          {dictation.supported && (
            <Tooltip label={dictation.listening ? "Stop dictating" : "Dictate"}>
              <button
                onClick={dictation.toggle}
                aria-label={dictation.listening ? "Stop dictating" : "Dictate"}
                aria-pressed={dictation.listening}
                className={cn(
                  "ctl focus-inset flex [--ctl:2.25rem] shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--dur-fast)]",
                  dictation.listening
                    ? "bg-[color-mix(in_srgb,var(--stop)_14%,transparent)] text-[var(--stop)]"
                    : "text-secondary hover:bg-subtle hover:text-primary",
                )}
              >
                <Mic size={18} />
              </button>
            </Tooltip>
          )}

          {/* Send becomes stop in place. A monochrome disc reads as the one
              terminal action without spending the accent on something the eye
              already finds by shape and position. */}
          <div className="ctl relative [--ctl:2.25rem] shrink-0">
            <button
              onClick={send}
              disabled={!canSend || streaming}
              aria-label="Send message"
              className={cn(
                "focus-inset absolute inset-0 flex items-center justify-center rounded-full transition-[opacity,background-color,color] duration-[var(--dur-fast)] ease-[var(--ease-std)]",
                "bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90",
                "disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-faint)]",
                streaming ? "pointer-events-none opacity-0" : "opacity-100",
              )}
            >
              <ArrowUp size={19} />
            </button>
            <button
              onClick={onStop}
              aria-label="Stop generating"
              className={cn(
                "focus-inset absolute inset-0 flex items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] transition-opacity duration-[var(--dur-fast)] ease-[var(--ease-std)]",
                streaming ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <Square size={12} fill="currentColor" />
            </button>
          </div>
        </div>

        {overContext && (
          <p className="flex items-center gap-1.5 px-4 pb-2 text-xs text-warning tnum">
            <span className="size-1 rounded-full bg-[var(--live)]" aria-hidden />
            {formatTokens(totalTokens)} of {formatTokens(model.contextWindow)} — this thread is nearly full
          </p>
        )}
      </div>

      <p className="mt-2 text-center text-xs text-tertiary">
        Models make mistakes. Check anything that matters.
      </p>
    </div>
  );
}
