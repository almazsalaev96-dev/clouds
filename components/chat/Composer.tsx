"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Brain, Check, FileText, MessageSquare, Paperclip, Palette, Plus,
  SlidersHorizontal, Sparkles, Wand2, X,
} from "lucide-react";
import type { ContentBlock, Style } from "@/lib/types";
import { AUTO, getModel, estimateTokens, formatTokens, MODELS } from "@/lib/models";
import { paramsFor } from "@/lib/store";
import { ModelPicker } from "./ModelPicker";
import { MessageBar } from "./MessageBar";
import { Segmented } from "@/components/ui/Segmented";
import { fileToBase64, formatBytes, cn } from "@/lib/utils";
import { isPdf, pdfBlock } from "@/lib/pdf";
import { useSettings, useDrafts } from "@/lib/store";
import { allStyles, findStyle, DEFAULT_STYLE_ID } from "@/lib/styles";
import { MODES, findMode } from "@/lib/modes";
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
  mode,
  onModeChange,
  styleId,
  customStyles,
  onStyleChange,
  onEditStyles,
  configured,
  modelPickerOpen,
  onModelPickerOpenChange,
  onModelChange,
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
  /** Chat or Creative. */
  mode: string;
  onModeChange: (id: string) => void;
  /** The style this thread answers in. */
  styleId: string;
  customStyles: Style[];
  onStyleChange: (id: string) => void;
  onEditStyles: () => void;
  configured: Record<string, boolean>;
  modelPickerOpen: boolean;
  onModelPickerOpenChange: (o: boolean) => void;
  onModelChange: (id: string) => void;
}) {
  const settings = useSettings();
  const drafts = useDrafts();
  const model = getModel(modelId);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [plusOpen, setPlusOpen] = React.useState(false);
  const [toolsOpen, setToolsOpen] = React.useState(false);
  const [stylesOpen, setStylesOpen] = React.useState(false);
  const spec = findMode(mode);
  const reasoning = paramsFor(modelId).reasoningEffort;
  const effort = reasoning ? reasoning[0].toUpperCase() + reasoning.slice(1) : "";
  const styles = React.useMemo(() => allStyles(customStyles), [customStyles]);
  const style = findStyle(styleId, customStyles) ?? styles[0];

  /* Tools carries a state, so the pill has to show it: "on" means this thread
     will not answer the way the defaults would. */
  const thinkLonger =
    model.reasoning && (settings.params[modelId]?.reasoningEffort ?? "medium") === "high";
  const toolsActive = thinkLonger || compareWith.length > 0;

  const text = drafts.drafts[conversationId] ?? "";
  const setText = (v: string) => drafts.setDraft(conversationId, v);

  const dragDepth = React.useRef(0);

  /* The draft survives switching conversations, caret included — that part is
     the bar's, keyed on the conversation. What is left here is the tray: an
     attachment belongs to the message it was added to and to no other. */
  React.useEffect(() => {
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
      } else if (isPdf(file)) {
        // Read here rather than refused. A PDF is the most common thing anyone
        // drags at an assistant, and "isn't a text file" is a true sentence
        // that is no use to the person reading it.
        setNotice(`Reading ${file.name}…`);
        const out = await pdfBlock(file);
        setNotice(null);
        if ("error" in out) {
          setNotice(out.error);
          continue;
        }
        next.push({
          id: crypto.randomUUID(),
          kind: "file",
          name: file.name,
          mimeType: "application/pdf",
          size: file.size,
          data: out.block.type === "file" ? out.block.text : "",
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
        <div className="absolute inset-x-0 -top-24 bottom-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-[color-mix(in_oklab,var(--accent-subtle)_85%,transparent)] anim-fade">
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

      {/* The same box that is in every other room, given this room's controls.
          The focus treatment is a lift, not a colour — an accent ring on the
          thing you type in every single time is a light that never turns off. */}
      <MessageBar
        value={text}
        onChange={setText}
        onSubmit={send}
        onStop={onStop}
        streaming={streaming}
        canSend={canSend}
        placeholder={spec.placeholder}
        onArrowUp={onEditLast}
        onPaste={onPaste}
        focusKey={conversationId}
        above={
          /* Attachments live inside the container, above the line you type on,
             so the whole thing reads as one object rather than a box with a
             tray balanced on top of it. */
          attachments.length > 0 ? (
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
          ) : null
        }
        /* Controls sit under the text, left to right in the order you reach
           for them: add something, change how it thinks, then — on the right,
           where they never move — who is answering, speak, send. */
        left={
          <>
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
                className="z-50 w-60 rounded-2xl glass border border-line p-1.5 shadow-lg anim-pop"
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

          {/* Two ways to ask, side by side. It is a segmented control rather
              than a menu because there are two of them and the one you are in
              has to be readable without opening anything — and because the
              difference is worth advertising: Creative is not a label, it
              widens the sampling distribution and asks for range. */}
          <Segmented
            value={mode}
            role="radiogroup"
            aria-label="Mode"
            className="ctl-h flex shrink-0 items-center rounded-full bg-inset p-0.5"
          >
            {MODES.map((m) => {
              const on = m.id === mode;
              const Icon = m.id === "creative" ? Sparkles : MessageSquare;
              return (
                <Tooltip key={m.id} label={m.blurb}>
                  <button
                    role="radio"
                    aria-checked={on}
                    data-on={on}
                    onClick={() => onModeChange(m.id)}
                    className={cn(
                      "btn-touch focus-inset flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors duration-[var(--dur-fast)]",
                      // The fill is the sliding indicator behind it now, so the
                      // button itself only changes what colour its ink is.
                      on ? "font-medium text-primary" : "text-tertiary hover:text-primary",
                    )}
                  >
                    <Icon
                      size={13}
                      className={cn(
                        "shrink-0 transition-colors duration-[var(--dur-fast)]",
                        // Creative is the one that changes what comes back, so
                        // it is the one that gets the gold when it is live.
                        on && m.id === "creative" ? "text-[var(--accent-2)]" : on ? "text-accent" : "",
                      )}
                    />
                    {m.label}
                  </button>
                </Tooltip>
              );
            })}
          </Segmented>

          <input
            ref={fileRef}
            type="file"
            multiple
            // Visually hidden but still in the accessibility tree, so it needs
            // a name like any other control — a screen reader landing on an
            // unnamed file input is told only "file, button".
            aria-label="Choose photos and files to attach"
            tabIndex={-1}
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
                className="z-50 w-72 rounded-2xl glass border border-line p-1.5 shadow-lg anim-pop"
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

          {/* The style sits beside Tools because it belongs to the same class
              of decision — it changes the shape of the answer, not its content
              — and because a control you have to open Settings to reach is one
              nobody changes twice. */}
          <Popover.Root open={stylesOpen} onOpenChange={setStylesOpen}>
            <Popover.Trigger asChild>
              <button
                aria-label={`Response style: ${style?.name ?? "Normal"}`}
                className={cn(
                  // btn-touch, not just ctl-h: the label hides on a phone, and
                  // a height floor alone leaves a 37px-wide icon behind it.
                  "btn-touch ctl-h focus-inset flex shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm transition-colors duration-[var(--dur-fast)]",
                  styleId !== DEFAULT_STYLE_ID
                    ? "bg-accent-subtle text-accent"
                    : "text-secondary hover:bg-subtle hover:text-primary",
                )}
              >
                <Palette size={17} />
                {/* "Normal" is the absence of a style, and a word that says
                    nothing was the last 62px keeping this row off one line at
                    1440px. The name shows once there is a name worth showing;
                    the accessible label carries it either way. */}
                {styleId !== DEFAULT_STYLE_ID && (
                  <span className="hidden pr-0.5 sm:inline">{style?.name}</span>
                )}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="start"
                side="top"
                sideOffset={8}
                className="z-50 w-72 rounded-2xl glass border border-line p-1.5 shadow-lg anim-pop"
              >
                {/* Opened on whatever is selected, not on the top of the list.
                    The list is taller than the box it is in, so with a style
                    near the bottom you could open this and not see which one
                    you were on — a picker whose whole job is to show you that.
                    `nearest` rather than `center` so the common case, a style
                    already in view, does not jump. */}
                <div className="max-h-72 overflow-y-auto">
                  {styles.map((st) => (
                    <button
                      key={st.id}
                      ref={st.id === styleId ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                      onClick={() => {
                        onStyleChange(st.id);
                        setStylesOpen(false);
                      }}
                      className="focus-inset flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-[var(--dur-fast)] hover:bg-subtle"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-primary">{st.name}</span>
                        {st.blurb && <span className="block text-xs text-tertiary">{st.blurb}</span>}
                      </span>
                      {st.id === styleId && <Check size={14} className="mt-1 shrink-0 text-accent" />}
                    </button>
                  ))}
                </div>
                <div className="my-1 h-px bg-[var(--border-subtle)]" />
                <button
                  onClick={() => {
                    setStylesOpen(false);
                    onEditStyles();
                  }}
                  className="focus-inset flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                >
                  <Plus size={16} className="text-tertiary" />
                  Write a style
                </button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          </>
        }
        right={
          <>
          {/* Which model is about to answer, an inch from the box you are
              typing in — and changeable there. It used to live in the header,
              two feet away from the decision it belongs to, which is how
              people end up sending a long prompt to the wrong one. */}
          <ModelPicker
            open={modelPickerOpen}
            onOpenChange={onModelPickerOpenChange}
            value={modelId}
            onChange={onModelChange}
            configured={configured}
            align="end"
          >
            {/* On Auto there is no provider to mark and no model to name: the
                answer is chosen per message, and putting last message's model
                here would read as a setting rather than as a decision. */}
            <button
              aria-label={modelId === AUTO ? "Model: chosen automatically" : `Model: ${model.name}`}
              className="btn-touch ctl-h focus-inset flex min-w-0 shrink items-center gap-1.5 rounded-full px-2 text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
            >
              {modelId === AUTO ? (
                <>
                  <Wand2 size={13} className="shrink-0 text-[var(--accent-2)]" />
                  <span className="truncate">Auto</span>
                </>
              ) : (
                <>
                  <ProviderMark provider={model.provider} size={13} />
                  <span className="truncate">{model.short}</span>
                  {model.reasoning && effort && (
                    <span className="hidden text-tertiary sm:inline">{effort}</span>
                  )}
                </>
              )}
            </button>
          </ModelPicker>

          </>
        }
      />

      {overContext && (
        <p className="mt-1.5 flex items-center gap-1.5 px-4 text-xs text-warning tnum">
          <span className="size-1 rounded-full bg-[var(--live)]" aria-hidden />
          {formatTokens(totalTokens)} of {formatTokens(model.contextWindow)} — this thread is nearly full
        </p>
      )}
    </div>
  );
}
