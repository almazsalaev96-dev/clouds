"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Check, ChevronDown, FileText, MessageSquare, Paperclip, Plus,
  SlidersHorizontal, Sparkles, Wand2, X, Globe, ListChecks, GraduationCap, Camera, ImagePlus } from "lucide-react";
import { slashCommands, typingSlash, type SlashExtra } from "@/lib/slash";
import type { ContentBlock, Style } from "@/lib/types";
import { getModel, estimateTokens, formatTokens } from "@/lib/models";
import { engineOf } from "@/lib/presets";
import { paramsFor } from "@/lib/store";
import { MessageBar } from "./MessageBar";
import { fileToBase64, formatBytes, sniffKind, cn } from "@/lib/utils";
import { isPdf, pdfBlock } from "@/lib/pdf";
import { useSettings, useDrafts } from "@/lib/store";
import { Tooltip } from "@/components/ui/primitives";

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
  configured,
  onSend,
  onStop,
  onEditLast,
  onOpenModels,
  research,
  onToggleResearch,
  placeholder = "How can I help you today?",
  learn,
  onToggleLearn,
  onPicture,
  rulesCount = 0,
  slashExtras = [],
  onOpenRules,
  voice,
}: {
  conversationId: string;
  streaming: boolean;
  contextTokens: number;
  /** The thread's model, not the app's. May be one of Armi's own. */
  modelId: string;
  /** Which providers have a key, for working out what an Armi model runs on. */
  configured: Record<string, boolean>;
  /** Kept for the context warning; the cost itself lives in the thread menu. */
  spentUsd?: number;
  onSend: (content: ContentBlock[]) => void;
  onStop: () => void;
  onEditLast: () => void;
  onOpenModels: () => void;
  /** Whether this conversation may search the web. */
  research?: boolean;
  onToggleResearch?: () => void;
  /** What the box asks, so it says which mode the thread is in. */
  placeholder?: string;
  /** Learn: a plan, one step at a time, a check after each. A mode of the thread. */
  learn?: boolean;
  onToggleLearn?: () => void;
  /** Put "/image " in the box: a picture from a description. */
  onPicture?: () => void;
  /** How many standing rules are in force, and the way to the panel that sets them. */
  rulesCount?: number;
  onOpenRules?: () => void;
  /** The person's assistants, each a command of its own in the slash menu. */
  slashExtras?: SlashExtra[];
  /** Chat or Creative. */
  /** The style this thread answers in. */
  /** Voice mode, where the browser can do it. */
  voice?: import("@/lib/hooks/useVoiceMode").VoiceMode;
}) {
  const settings = useSettings();
  const drafts = useDrafts();
  /* The window belongs to the engine, and on one of Armi's own models the
     engine is whichever one it resolves to here. Asking `getModel` about a
     tactic returns the app default, which would draw a 200k meter under a
     model with a million. */
  const model = getModel(engineOf(modelId, { configured, keys: settings.keys }));
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const [plusOpen, setPlusOpen] = React.useState(false);
  const reasoning = paramsFor(modelId).reasoningEffort;
  /* The same three words the picker uses. "Medium" on the bar and "Normal"
     in the menu below it are two names for one setting, which reads as two
     settings. */
  const effort = reasoning ? { low: "Quick", medium: "Normal", high: "Hard" }[reasoning] : "";

  /* Tools carries a state, so the pill has to show it: "on" means this thread
     will not answer the way the defaults would. */

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
      /* The label and the bytes have to agree. The type is the browser's
         guess from the extension; the sniff is the first twelve bytes. A
         file that says it is an image and is not is refused with the reason,
         rather than sent to a model as a picture that does not decode. */
      const claimsImage = file.type.startsWith("image/");
      const claimsPdf = isPdf(file);
      const really = claimsImage || claimsPdf ? await sniffKind(file) : "other";
      if ((claimsImage && really !== "image") || (claimsPdf && really !== "pdf")) {
        setNotice(`${file.name} isn't really ${claimsImage ? "an image" : "a PDF"} — its contents don't match its name.`);
        continue;
      }
      const isImage = claimsImage;
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
  /** What comes after the slash, while one is being typed at the start. */
  const typing = typingSlash(text);
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
        placeholder={placeholder}
        onArrowUp={onEditLast}
        onPaste={onPaste}
        focusKey={conversationId}
        voice={voice}
        above={
          /* Attachments live inside the container, above the line you type on,
             so the whole thing reads as one object rather than a box with a
             tray balanced on top of it. */
          attachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 px-3 pb-1 pt-3">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="group/chip flex items-center gap-2 rounded-md border border-line bg-field py-1 pl-1 pr-2 anim-pop"
              >
                {a.kind === "image" && a.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.preview} alt="" className="size-8 rounded-lg object-cover" />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-lg bg-subtle text-tertiary">
                    <FileText size={14} />
                  </span>
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="max-w-48 truncate text-xs text-secondary">{a.name}</span>
                  {/* What it is and how big, the two things you check before
                      you send something — the chip used to show only the
                      name, which is the one thing you already knew. */}
                  <span className="text-tiny text-faint">
                    {a.kind === "image" ? "Image" : a.mimeType === "application/pdf" ? "PDF" : (a.name.split(".").pop() ?? "file").toUpperCase()}
                    {" · "}
                    {formatBytes(a.size)}
                  </span>
                </span>
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
            <Tooltip label="Add files and tools">
              <Popover.Trigger asChild>
                <button
                  aria-label="Add files and tools"
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
                className="z-50 w-60 rounded-md glass border border-line p-1.5 shadow-lg anim-menu"
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
                {/* The camera, on a phone the way the other apps have it: a
                    photograph of the page, the working, the board — taken
                    now, not chosen from a roll. A desk browser opens its
                    picker instead. */}
                <button
                  onClick={() => { setPlusOpen(false); cameraRef.current?.click(); }}
                  className="focus-inset flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                >
                  <Camera size={16} className="text-tertiary" />
                  Take a photo
                </button>
                {onPicture && (
                  <button
                    onClick={() => { setPlusOpen(false); onPicture(); }}
                    className="focus-inset flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                  >
                    <ImagePlus size={16} className="mt-0.5 shrink-0 text-tertiary" />
                    <span className="min-w-0 flex-1">
                      <span className="block">Make a picture</span>
                      <span className="block text-xs text-tertiary">Describe it and it is drawn in the thread.</span>
                    </span>
                  </button>
                )}
                {/* The tools, each with a line saying what it does — the +
                    menu as Gemini and ChatGPT have it, for the person who
                    would rather read a menu than learn the chips. */}
                {onToggleLearn && (
                  <button
                    onClick={() => { setPlusOpen(false); onToggleLearn(); }}
                    aria-pressed={Boolean(learn)}
                    className="focus-inset flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                  >
                    <GraduationCap size={16} className="mt-0.5 shrink-0 text-tertiary" />
                    <span className="min-w-0 flex-1">
                      <span className="block">{learn ? "Stop learning mode" : "Learn"}</span>
                      <span className="block text-xs text-tertiary">A plan, one step at a time, a check after each.</span>
                    </span>
                    {learn && <Check size={14} className="mt-0.5 shrink-0 text-accent" />}
                  </button>
                )}
                {onToggleResearch && (
                  <button
                    onClick={() => { setPlusOpen(false); onToggleResearch(); }}
                    aria-pressed={Boolean(research)}
                    className="focus-inset flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
                  >
                    <Globe size={16} className="mt-0.5 shrink-0 text-tertiary" />
                    <span className="min-w-0 flex-1">
                      <span className="block">{research ? "Stop searching the web" : "Research"}</span>
                      <span className="block text-xs text-tertiary">Let it search the web and say what it read.</span>
                    </span>
                    {research && <Check size={14} className="mt-0.5 shrink-0 text-accent" />}
                  </button>
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          {/* The web, switched on where the question is typed.
              ---------------------------------------------------------
              It was a globe in the top bar, which is where a *setting*
              goes — and this is not a setting, it is a decision about the
              sentence being written at that moment. All three of the apps
              this one is answering to put the tools inside the box for
              exactly that reason: the thing that changes what the answer
              is made of belongs next to the thing you are making it from,
              and it has to be visible while you type rather than found
              first. Named as well as drawn, because a globe alone is a
              guess about what kind of globe it is. */}
          {onToggleResearch && research && (
            <Tooltip label="Research is on — press to stop">
              <button
                type="button"
                aria-label="Stop searching the web"
                aria-pressed
                onClick={onToggleResearch}
                className="btn-touch press focus-inset flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--accent)_40%,transparent)] bg-accent-subtle px-2.5 text-xs font-medium text-accent transition-colors duration-[var(--dur-fast)]"
              >
                <Globe size={14} />
                Research
                <X size={12} className="opacity-70" />
              </button>
            </Tooltip>
          )}

{          /* Tools are *chosen* in the menu and *shown* here only while they
             are on. They used to sit in the bar permanently, off, which is
             two switches staring at you before you have typed anything —
             and the composer is where a sentence is written, not a control
             panel. So the + menu lists them with a line each and a tick on
             the one that is on, exactly as the model picker marks the model
             that is chosen; the bar carries a dismissible chip while a tool
             is running, which is the same pattern as an applied filter. */}
          {onToggleLearn && learn && (
            <Tooltip label="Learn is on — press to stop">
              <button
                type="button"
                aria-label="Stop learning mode"
                aria-pressed
                onClick={onToggleLearn}
                className="btn-touch press focus-inset flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--accent)_40%,transparent)] bg-accent-subtle px-2.5 text-xs font-medium text-accent transition-colors duration-[var(--dur-fast)]"
              >
                <GraduationCap size={14} />
                Learn
                <X size={12} className="opacity-70" />
              </button>
            </Tooltip>
          )}

          {/* The rules in force, said in one word and a number, a press from
              the panel that sets them. Quiet, because it is a fact about
              every answer rather than a choice about this one — and there
              at all because a rule nobody can see being applied is a rule
              they will forget they set. */}
          {onOpenRules && rulesCount > 0 && (
            <Tooltip label="Your rules — what it must and must not do, everywhere">
              <button
                type="button"
                onClick={onOpenRules}
                aria-label={`${rulesCount} ${rulesCount === 1 ? "rule" : "rules"} in force — open the rules`}
                className="btn-touch press focus-inset flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-xs text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
              >
                <ListChecks size={13} />
                {rulesCount} {rulesCount === 1 ? "rule" : "rules"}
              </button>
            </Tooltip>
          )}

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Take a photo to attach"
            tabIndex={-1}
            className="sr-only"
            onChange={async (e) => {
              await addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
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



          </>
        }
        right={null}
      />

      {/* A slash at the start of the box opens the list of what a slash can
          do, narrowed as it is typed. Shown here, under the box, because it
          answers a question the person has just asked by typing "/" — and a
          command that has to be remembered is a menu with worse discovery. */}
      {typing !== null && (
        <ul className="mt-1.5 flex flex-wrap gap-1 px-4" role="listbox" aria-label="Commands">
          {slashCommands(slashExtras)
            .filter((c) => c.command.startsWith(typing))
            .slice(0, 8)
            .map((c) => (
              <li key={c.command}>
                <button
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setText(`/${c.command} `)}
                  className="btn-touch press focus-inset flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary"
                >
                  <span className="font-medium text-primary">/{c.command}</span>
                  <span className="hidden text-tertiary sm:inline">{c.does}</span>
                </button>
              </li>
            ))}
          {!slashCommands(slashExtras).some((c) => c.command.startsWith(typing)) && (
            <li className="px-1 text-xs text-tertiary">No command called “/{typing}” — it will be sent as written.</li>
          )}
        </ul>
      )}

      {overContext && (
        <p className="mt-1.5 flex items-center gap-1.5 px-4 text-xs text-warning tnum">
          <span className="size-1 rounded-full bg-[var(--live)]" aria-hidden />
          {formatTokens(totalTokens)} of {formatTokens(model.contextWindow)} — this thread is nearly full
        </p>
      )}
      {/* One line, the same one every serious assistant carries, because it
          is true: the casts argue with an answer before you read it, and the
          answer can still be wrong. Under the box rather than under every
          answer, where it would be read once and then be furniture. */}
      <p className="no-print mt-1.5 px-4 text-center text-xs text-tertiary">Armi can be wrong. Check what matters.</p>
    </div>
  );
}
