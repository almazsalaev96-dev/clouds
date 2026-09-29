"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, FileText, FolderOpen, FolderPlus, MessageSquare, MessageSquareDashed, Paperclip, Plus,
  Presentation, SlidersHorizontal, Sparkles, Telescope, Wand2, X, Globe, ListChecks, GraduationCap, Camera, ImagePlus } from "lucide-react";
import { slashCommands, typingSlash, type SlashExtra } from "@/lib/slash";
import { mentionAt } from "@/lib/notebook";
import type { ContentBlock, Style } from "@/lib/types";
import { getModel, estimateTokens, formatTokens } from "@/lib/models";
import { engineOf } from "@/lib/presets";
import { paramsFor } from "@/lib/store";
import { MessageBar } from "./MessageBar";
import { fileToBase64, formatBytes, sniffKind, cn } from "@/lib/utils";
import { isPdf, pdfBlock, readingLine, readTextFile, cutLine } from "@/lib/pdf";
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
  placeholder = "",
  learn,
  onToggleLearn,
  onPicture,
  rulesCount = 0,
  slashExtras = [],
  onOpenRules,
  onSlides,
  slides,
  picture,
  deep,
  onToggleDeep,
  temporary,
  onToggleTemporary,
  projects = [],
  inProject = null,
  onMoveToProject,
  onNewProjectHere,
  assistants = [],
  assistantId = null,
  onAssistant,
  voice,
  findPages,
  seed,
  onSeeded,
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
  /** The next message is a picture from a description; pressed again, it is not. */
  onPicture?: () => void;
  /** How many standing rules are in force, and the way to the panel that sets them. */
  rulesCount?: number;
  onOpenRules?: () => void;
  /** The person's assistants, each a command of its own in the slash menu. */
  slashExtras?: SlashExtra[];
  /** Slides and a picture: the next message is one, chosen here and shown
      as a chip by the model at the top, where a press turns it off. */
  onSlides?: () => void;
  slides?: boolean;
  picture?: boolean;
  /** Deep research: several searches, then a report with sources. A mode of the thread. */
  deep?: boolean;
  onToggleDeep?: () => void;
  /** Only before the first message: a chat is temporary from its first word or not at all. */
  temporary?: boolean;
  onToggleTemporary?: () => void;
  /** The projects, to put this chat in one from the box; null takes it out. */
  projects?: { id: string; name: string }[];
  inProject?: string | null;
  onMoveToProject?: (projectId: string | null) => void;
  onNewProjectHere?: () => void;
  /** The assistants, to answer as one from here on; null is none. */
  assistants?: { id: string; name: string; icon: string }[];
  assistantId?: string | null;
  onAssistant?: (id: string | null) => void;
  /** Chat or Creative. */
  /** The style this thread answers in. */
  /** Voice mode, where the browser can do it. */
  voice?: import("@/lib/hooks/useVoiceMode").VoiceMode;
  /**
   * The Notebook, for "@": the pages whose titles match what follows the
   * @, best first. A page picked is attached like a file, so the answer
   * reads it and the message shows which page went with it.
   */
  findPages?: (query: string) => Promise<{ id: string; title: string; content: string }[]>;
  /** A page to have attached already, for a chat opened about it. */
  seed?: { conversationId: string; name: string; text: string } | null;
  onSeeded?: () => void;
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
  /* The menu has two second pages — a list of projects, a list of
     assistants — reached from the first and left by a back row. */
  const [pane, setPane] = React.useState<"main" | "project" | "assistant">("main");
  React.useEffect(() => { if (!plusOpen) setPane("main"); }, [plusOpen]);
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
  /* After the clear above, so a chat opened about a page arrives with it. */
  React.useEffect(() => {
    if (!seed || seed.conversationId !== conversationId) return;
    setAttachments([{ id: `page-${Date.now()}`, kind: "file", name: seed.name, mimeType: "text/markdown", size: seed.text.length, data: seed.text }]);
    onSeeded?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, conversationId]);

  /* "@" and the start of a page's name: the pages that match, to attach. */
  const mention = findPages ? mentionAt(text, text.length) : null;
  const [pageHits, setPageHits] = React.useState<{ id: string; title: string; content: string }[]>([]);
  React.useEffect(() => {
    let alive = true;
    if (!mention || !findPages) { setPageHits([]); return; }
    void findPages(mention.query).then((r) => { if (alive) setPageHits(r.slice(0, 6)); }).catch(() => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mention?.query, mention === null]);
  const attachPage = (p: { title: string; content: string }) => {
    if (mention) setText(text.slice(0, mention.start).replace(/\s+$/, text.slice(0, mention.start).trim() ? " " : ""));
    const name = `${p.title || "Untitled"}.md`;
    setAttachments((a) => (a.some((x) => x.name === name) ? a : [...a, { id: `page-${Date.now()}`, kind: "file", name, mimeType: "text/markdown", size: p.content.length, data: p.content }]));
  };

  const addFiles = React.useCallback(async (files: File[]) => {
    const next: Attachment[] = [];
    for (const file of files) {
      /* A picture goes to the model as it is, so the model's limit holds.
         A PDF or a text file is read here and only its words are sent — a
         300 MB textbook is fine; the long reader takes it in parts. */
      if (file.type.startsWith("image/") && file.size > MAX_FILE_BYTES) {
        setNotice(`${file.name} is ${formatBytes(file.size)} — pictures can be up to 20 MB.`);
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
        const out = await pdfBlock(file, (page, pages) => setNotice(readingLine(file.name, page, pages)));
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
          data: await (async () => { const r = await readTextFile(file); if (r.cut) setNotice(cutLine(file.name)); return r.text; })(),
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
        placeholder={placeholder || undefined}
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
                className="z-50 max-h-[min(72vh,640px)] w-64 overflow-y-auto rounded-md glass border border-line p-1.5 shadow-lg anim-menu"
              >
                {pane === "main" && (
                  <>
                <MenuRow icon={<Paperclip size={16} />} title="Add photos and files" onClick={() => { setPlusOpen(false); fileRef.current?.click(); }} />
                {/* The camera, on a phone the way the other apps have it: a
                    photograph of the page, the working, the board — taken
                    now, not chosen from a roll. A desk browser opens its
                    picker instead. */}
                <MenuRow icon={<Camera size={16} />} title="Take a photo" onClick={() => { setPlusOpen(false); cameraRef.current?.click(); }} />
                {onPicture && (
                  <MenuRow icon={<ImagePlus size={16} />} on={picture} title={picture ? "Stop making a picture" : "Make a picture"} hint="Describe it and it is drawn in the thread." onClick={() => { setPlusOpen(false); onPicture(); }} />
                )}
                {/* The tools, each with a line saying what it does — the +
                    menu as Gemini and ChatGPT have it, for the person who
                    would rather read a menu than learn the chips. */}
                {onToggleLearn && (
                  <MenuRow icon={<GraduationCap size={16} />} on={learn} title={learn ? "Stop learning mode" : "Learn"} hint="A plan, one step at a time, a check after each." onClick={() => { setPlusOpen(false); onToggleLearn(); }} />
                )}
                {onToggleResearch && (
                  <MenuRow icon={<Globe size={16} />} on={research} title={research ? "Stop searching the web" : "Research"} hint="Let it search the web and say what it read." onClick={() => { setPlusOpen(false); onToggleResearch(); }} />
                )}
                {onToggleDeep && (
                  <MenuRow icon={<Telescope size={16} />} on={deep} title={deep ? "Stop deep research" : "Deep research"} hint="Several searches from different angles, then a report with sources." onClick={() => { setPlusOpen(false); onToggleDeep(); }} />
                )}
                {onSlides && (
                  <MenuRow icon={<Presentation size={16} />} on={slides} title={slides ? "Stop slides" : "Slides"} hint="A deck, built and run beside the chat; prints to PDF, saves as PowerPoint." onClick={() => { setPlusOpen(false); onSlides(); }} />
                )}
                {(onMoveToProject || onNewProjectHere) && (
                  <MenuRow
                    icon={<FolderOpen size={16} />}
                    title={inProject ? `In ${projects.find((p) => p.id === inProject)?.name ?? "a project"}` : "Add to a project"}
                    hint={inProject ? "Change it, or take this chat out." : "Its instructions and files apply to this chat."}
                    more
                    onClick={() => setPane("project")}
                  />
                )}
                {onAssistant && assistants.length > 0 && (
                  <MenuRow
                    icon={<span className="flex w-4 justify-center text-sm leading-none">{assistants.find((a) => a.id === assistantId)?.icon ?? "✦"}</span>}
                    title={assistantId ? `Answering as ${assistants.find((a) => a.id === assistantId)?.name ?? "an assistant"}` : "Answer as an assistant"}
                    hint={assistantId ? "Change it, or answer as Armi." : "One of yours: its way of working, its model."}
                    more
                    onClick={() => setPane("assistant")}
                  />
                )}
                {onToggleTemporary && (
                  <MenuRow icon={<MessageSquareDashed size={16} />} on={temporary} title={temporary ? "Keep this chat" : "Temporary chat"} hint="Not kept, not remembered, gone when you leave." onClick={() => { setPlusOpen(false); onToggleTemporary(); }} />
                )}
                  </>
                )}
                {pane === "project" && (
                  <>
                    <button onClick={() => setPane("main")} className="focus-inset mb-1 flex h-8 w-full items-center gap-1.5 rounded-xl px-2 text-left text-xs text-tertiary hover:bg-subtle hover:text-primary">
                      <ChevronLeft size={14} /> Back
                    </button>
                    {onNewProjectHere && (
                      <MenuRow icon={<FolderPlus size={16} />} title="New project from this chat" hint="Named for it, with this chat in it." onClick={() => { setPlusOpen(false); onNewProjectHere(); }} />
                    )}
                    {projects.length > 0 && <p className="px-2.5 pb-1 pt-2 text-tiny font-medium uppercase tracking-wide text-tertiary">Your projects</p>}
                    <div>
                      {projects.map((p) => (
                        <MenuRow key={p.id} icon={<FolderOpen size={16} />} on={inProject === p.id} title={p.name} onClick={() => { setPlusOpen(false); onMoveToProject?.(p.id); }} />
                      ))}
                    </div>
                    {inProject && <MenuRow icon={<X size={16} />} title="No project" hint="Take this chat out of it." onClick={() => { setPlusOpen(false); onMoveToProject?.(null); }} />}
                  </>
                )}
                {pane === "assistant" && (
                  <>
                    <button onClick={() => setPane("main")} className="focus-inset mb-1 flex h-8 w-full items-center gap-1.5 rounded-xl px-2 text-left text-xs text-tertiary hover:bg-subtle hover:text-primary">
                      <ChevronLeft size={14} /> Back
                    </button>
                    <div>
                      {assistants.map((a) => (
                        <MenuRow key={a.id} icon={<span className="flex w-4 justify-center text-sm leading-none">{a.icon}</span>} on={assistantId === a.id} title={a.name} onClick={() => { setPlusOpen(false); onAssistant?.(a.id); }} />
                      ))}
                    </div>
                    {assistantId && <MenuRow icon={<X size={16} />} title="Answer as Armi" hint="No assistant on this chat." onClick={() => { setPlusOpen(false); onAssistant?.(null); }} />}
                  </>
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          {/* The modes that are on — Learn, Research, Slides, a picture — used
              to be chips here. They are chips by the model at the top now,
              one row for everything that shapes the thread, which is where
              the reference apps put them and where the eye already goes to
              read which model is answering. The menu above is still where
              they are chosen. */}
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

      {/* "@" opens the Notebook: pages to attach to this message. */}
      {mention && pageHits.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap items-center gap-1 px-4" role="listbox" aria-label="Attach a page">
          <li role="presentation" aria-hidden className="pr-1 text-xs text-tertiary">Attach from your notebook</li>
          {pageHits.map((p) => (
            <li key={p.id}>
              <button
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => attachPage(p)}
                className="btn-touch press focus-inset flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary"
              >
                <FileText size={12} className="text-tertiary" aria-hidden />
                <span className="max-w-56 truncate text-primary">{p.title || "Untitled"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

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
      {/* No line under the box: ChatGPT's app carries none, and the honesty
          it stood for is in the answers themselves — the checks, the
          citations, the confidence — where it is about something. */}
    </div>
  );
}

/**
 * One row of the plus menu: an icon, a title, a line under it saying what
 * it does, a tick when it is on, a chevron when it opens a second page.
 */
function MenuRow({ icon, title, hint, on, more, onClick }: { icon: React.ReactNode; title: string; hint?: string; on?: boolean; more?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={more ? undefined : on}
      className="focus-inset flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
    >
      <span className="mt-0.5 shrink-0 text-tertiary" aria-hidden>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        {hint && <span className="block text-xs text-tertiary">{hint}</span>}
      </span>
      {on && !more && <Check size={14} className="mt-0.5 shrink-0 text-accent" />}
      {more && <ChevronRight size={14} className="mt-0.5 shrink-0 text-tertiary" />}
    </button>
  );
}
