"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlertCircle, Brain, Calculator, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronRight as Caret, Clock, Code2, Copy,
  Download, FolderPlus, GraduationCap, LayoutTemplate, MoreHorizontal, NotebookPen, PanelRight, Pencil, Play, RefreshCw, Scissors, Search, ShieldQuestion,
  SquarePen, ThumbsDown, ThumbsUp, Volume2, X,
} from "lucide-react";
import { builtDocument, titleOf, withoutBuild } from "@/lib/built";
import { computeBlock, type Outcome } from "@/lib/compute";
import { ComputeScope } from "./ComputeBlock";
import type { Finding } from "@/lib/lint";
import type { Action, ChatError, Message as Msg, Rating, RatingReason, WebSource } from "@/lib/types";
import { canUndo } from "@/lib/actions";
import { CALCULATOR, getModel, formatTokens } from "@/lib/models";
import { authorName, getPreset, plainly, PRESETS } from "@/lib/presets";
import { blockText } from "@/lib/db";
import { cn, describeTiming, formatDuration } from "@/lib/utils";
import { guessLang } from "@/lib/lang";
import { Markdown } from "./Markdown";
import { IconButton, Button, Tooltip } from "@/components/ui/primitives";
import { CodeBlock } from "./CodeBlock";
import { PresetIcon } from "./ModelPicker";
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
  onRemember,
  entering,
}: {
  message: Msg;
  siblings: Msg[];
  index: number;
  onNavigate: (id: string) => void;
  onEdit: (message: Msg, text: string) => void;
  /** Keep what this message says, for every conversation after this one. */
  onRemember?: (text: string) => void;
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
              {/* What it does, not what the key is called: this edits the
                  question and asks again, and the original is kept as a
                  branch. "Send" said none of that. */}
              Save &amp; regenerate
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
    <div id={`m-${message.id}`} className={cn("msg group flex flex-col items-end gap-1.5 pb-3 pt-6", entering && "msg-enter")}>
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

      {/* The same 16 as the answer. This was 15 for a while, on the argument
          that your own words are the layer being re-read at a glance rather
          than read, so the wider column and the extra leading should go to the
          side that needs them. The column and the leading still do. The size
          should not have: a bubble set a step under the reply reads as a
          caption on it, and the two halves of a conversation are one document.
          ChatGPT sets both at 16 and is right to. */}
      {text && (
        <div
          dir="auto"
          /* 94% of the column on a phone, 85% from `sm` up; a corner from the
             scale rather than a 20 drawn by hand; 14 of side padding, which is
             inside the 10-14 band where 16 was not. */
          className="max-w-[94%] whitespace-pre-wrap rounded-lg bg-subtle px-3.5 py-2.5 text-base [overflow-wrap:anywhere] sm:max-w-[85%]"
        >
          {text}
        </div>
      )}

      {/* `min-h`, not a fixed height, and it wraps. On a coarse pointer `.ctl`
          raises every control in this row to the 44pt floor, and a 24px box
          cannot hold a 44px child: they overflow it by 10px in each direction
          and the top of the hit target lands on the last line of the message
          above. Nothing clips, so nothing ever caught it. */}
      <div className="flex min-h-6 flex-wrap items-center gap-0.5 reveal">
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
        {/* Memory on your terms: the thing you said, kept because you
            pressed this, not because a model decided it was about you. */}
        {onRemember && text && (
          <IconButton label="Remember this" size={26} onClick={() => onRemember(text)}>
            <Brain size={13} />
          </IconButton>
        )}
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

/* Written as the person would type them, because they are sent as the person.
   Each names a move rather than a topic, which is what lets the same six sit
   under any answer: "simpler" means something after an explanation of tax
   and after an explanation of a regex. */
/* Under a thing that was built, the moves are different: nobody wants a
   timer explained more simply, they want it changed. */
const MAKE_FOLLOW_UPS: { label: string; text: string }[] = [
  { label: "Polish it", text: "Polish the look: spacing, hierarchy, a nicer palette. Keep everything working." },
  { label: "Add a feature", text: "Add the one feature it most obviously needs, and say what you added." },
  { label: "On a phone", text: "Make it work well on a phone: bigger targets, a layout that fits 360px." },
  { label: "My material", text: "Replace the sample data with mine — I'll paste it next. Show me where it goes." },
  { label: "Explain it", text: "Explain how it works, briefly, without repeating the code." },
];

/* The ladder a tutor climbs with you: where to look, the first step, the
   method, and only then the answer — each a press, each a real message in
   your own turn so the transcript shows what you asked for. "The answer"
   is always there, because a teaching stance is not a refusal, and the
   record of having reached for it is the honest one. */
const TEACH_FOLLOW_UPS: { label: string; text: string }[] = [
  { label: "A hint", text: "Give me one hint: only where to look or what to recall, not the step itself." },
  { label: "First step", text: "Give me the first step only, and stop there so I can do the rest." },
  { label: "The method", text: "Show me the method without the final answer — leave the last step to me." },
  { label: "The answer", text: "Give me the full answer now, then say what I should remember from it." },
  { label: "Quiz me", text: "Quiz me on this — one question at a time, and mark my answers." },
  { label: "Simpler", text: "Explain that more simply — assume I'm new to this." },
];

const FOLLOW_UPS: { label: string; text: string }[] = [
  { label: "Simpler", text: "Explain that more simply — assume I'm new to this." },
  { label: "Example", text: "Give me one concrete example of that." },
  { label: "Steps", text: "Show me the steps, one at a time." },
  { label: "Why?", text: "Why is that? What's the reasoning underneath?" },
  { label: "Quiz me", text: "Quiz me on this — one question at a time, and mark my answers." },
  { label: "Harder", text: "Take this a level up: the harder case, or what comes next." },
];

/** An answer as it would be read out: no fences, no heading marks, no link targets. */
function spoken(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " (code) ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/\$\$?[^$]*\$\$?/g, " (equation) ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8_000);
}

function AssistantMessageImpl({
  message,
  siblings,
  index,
  onNavigate,
  onRegenerate,
  onSaveToNote,
  onOpenMade,
  onComputed,
  onMakeCards,
  onOpenInCanvas,
  onContinue,
  onTighten,
  onFollowUp,
  teaching,
  findings,
  onRate,
  onSwitchModel,
  onVerify,
  verifying,
  entering,
  settled,
  isLast,
  onOpenAction,
  onUndoAction,
}: {
  message: Msg;
  siblings: Msg[];
  index: number;
  onNavigate: (id: string) => void;
  onRegenerate: (message: Msg, modelId?: string, opts?: { effort?: "high" }) => void;
  /** Go to the thing an action made. */
  onOpenAction?: (open: NonNullable<Action["open"]>) => void;
  /** Take an action back. */
  onUndoAction?: (message: Msg, action: Action) => void;
  onSaveToNote: (text: string) => void;
  /** Show the thing this answer built, running beside the thread. */
  onOpenMade?: (message: Msg) => void;
  /** A calculation in this answer finished; answer again with what it printed. */
  onComputed?: (message: Msg, out: Outcome) => void;
  /** Turn this answer into cards that come back on a schedule. */
  onMakeCards?: (text: string) => void;
  /** Lift this answer into a canvas and open it there. */
  onOpenInCanvas: (text: string) => void;
  /** Ask for the rest, when the answer ran out of room. */
  onContinue?: () => void;
  /** Regenerate without the packaging the linter found. Shown only with findings. */
  onTighten?: (message: Msg) => void;
  /** Send one of the canned follow-ups as the next turn. Set on the last answer only. */
  onFollowUp?: (text: string) => void;
  /** A teaching stance is on: the follow-ups become the hint ladder. */
  teaching?: boolean;
  /** What the linter found in this answer, if it is the last one. */
  findings?: Finding[];
  /** Thumbs up or down; down with a reason regenerates with that reason. */
  onRate?: (message: Msg, rating: Rating) => void;
  /** Open the model picker, when this one refused and another might not. */
  onSwitchModel?: () => void;
  /** Ask a model from another provider whether this answer is right. */
  onVerify?: (message: Msg) => void;
  verifying?: boolean;
  entering?: boolean;
  /** True for about a second after this answer finished generating. */
  settled?: boolean;
  /** The answer you are about to act on keeps its controls on screen. */
  isLast?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  /* Thumbs-down asks why, once, right here. */
  const [asking, setAsking] = React.useState(false);
  const text = blockText(message.content);
  /* An answer that is a thing: the thing runs beside the thread and the
     transcript shows a card for it, not nine hundred lines of markup. */
  const made = React.useMemo(() => {
    const doc = builtDocument(text);
    return doc ? { doc, title: titleOf(doc), prose: withoutBuild(text) } : null;
  }, [text]);
  /* Worked out here rather than asked of anything. Checked before getModel,
     which would otherwise fall back to the default and put a model's name over
     an answer it had no part in. */
  const computed = message.modelId === CALCULATOR;
  const model = message.modelId && !computed ? getModel(message.modelId) : null;
  /* Which Armi model wrote it, where one did. Stamped on the answer at send
     time, so it survives the thread being switched to something else. */
  const armi = computed ? null : getPreset(message.presetId ?? "");
  const author = computed ? null : message.modelId ? authorName(message.presetId, message.modelId) : null;
  /* Why this model, with the names taken out — they are in the header two
     elements to the left, and the ones stored by older builds are somebody
     else's. */
  const said = message.routedWhy ? plainly(message.routedWhy) : "";
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
    const name = (text.match(/^#{1,3}\s+(.+)$/m)?.[1] ?? author ?? "answer")
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
    /* As prose: the marks that only mean something on a screen — fences,
       heading hashes, list bullets, link targets, emphasis — are taken out
       before a voice reads them as punctuation. */
    const utter = new SpeechSynthesisUtterance(spoken(text));
    /* Without a language the browser reads everything in the voice it booted
       with, so an Arabic or Japanese answer came out pronounced as English —
       which is not an accent, it is unintelligible. Guessed from the script,
       because that is what is actually knowable from the text: a run of Arabic
       letters is Arabic or Persian or Urdu and any of those three voices is
       enormously closer than the English one. */
    const lang = guessLang(text);
    if (lang) utter.lang = lang;
    utter.onend = () => setSpeaking(false);
    speechSynthesis.speak(utter);
    setSpeaking(true);
  };

  return (
    <div id={`m-${message.id}`} className={cn("msg group rounded-lg pb-4 pt-3", entering && "msg-enter", settled && "msg-settled")}>
      {/* Who is speaking, before you read what they said. In an app with four
          providers this is not metadata — it is context, and it is set a step
          above metadata to say so. 12px was doing both this job and the job of
          a tiny label, and a scale where one size does two jobs has a missing
          step rather than a spare one. */}
      <div className="mb-2 flex items-center gap-2 text-meta text-tertiary">
        {/* One mark, and it is Armi's. An Armi model is a cast of two or
            three engines from different companies, so one company's mark over
            it would be picking a side — and an answer from a thread pinned to
            an engine before the menu stopped offering them is still this app
            answering. Which engines were rented is in Settings. */}
        <PresetIcon id={armi?.id ?? ""} size={12} className="shrink-0 text-[var(--accent-2)]" />
        {computed && <Calculator size={12} className="text-secondary" />}
        <span
          className="font-medium text-secondary"
          /* No tooltip naming an engine. Which one a tactic rented for this
             turn is a fact about the keys in this browser, not about the
             answer, and it is the kind of detail that ends up quoted back as
             though the app were a storefront for somebody else's models. */
          title={armi ? armi.blurb : undefined}
        >
          {computed ? "Calculator" : (author ?? "Assistant")}
        </span>
        {/* Why this one, when the app chose it rather than you. A router you
            cannot see is a router you cannot correct — and "it picked a cheap
            model for my hard question" is only a complaint you can make if you
            were told which and why. */}
        {said && (
          <span
            className="min-w-0 truncate text-tertiary"
            /* The same text the line shows, not the raw string. What is
               stored begins with a name — and, in anything written by a build
               from before the rebrand, with an engine's name. It is taken out
               of both the line and the tooltip: a line written last month is
               read today. */
            title={said}
          >
            {said}
          </span>
        )}
        <span className="reveal flex items-center gap-2">
          {message.latencyMs != null && (
            <span className="tnum" title={describeTiming(message.latencyMs, message.ttftMs)}>
              {formatDuration(message.latencyMs)}
            </span>
          )}
          {message.usage && message.usage.outputTokens > 0 && (
            <span className="tnum">{formatTokens(message.usage.outputTokens)} tok</span>
          )}
        </span>
        {message.stopReason === "aborted" && (
          <span className="flex items-center gap-2">
            <span className="text-warning">stopped</span>
            {/* Stopping is not the same as finishing, and the person who
                pressed Stop is the one most likely to want the rest a moment
                later. The same offer as running out of room, for the same
                reason, on the latest answer only. */}
            {isLast && onContinue && (
              <button
                onClick={onContinue}
                className="focus-inset rounded-md px-1.5 py-0.5 font-medium text-accent transition-colors duration-[var(--dur-fast)] hover:bg-accent-subtle"
              >
                Continue
              </button>
            )}
          </span>
        )}
        {/* All three providers report this and nothing ever showed it: an
            answer cut short by a safety system arrived looking exactly like
            one that had finished. A reader who cannot tell the difference
            between "that is the whole answer" and "that is where it was cut
            off" has been told something untrue by omission. Switching model
            is the only thing that ever helps, so it is offered here. */}
        {message.stopReason === "refusal" && (
          <span className="flex items-center gap-2">
            <span className="text-warning">{text ? "cut short by a safety filter" : "declined by a safety filter"}</span>
            {isLast && onSwitchModel && (
              <button
                onClick={onSwitchModel}
                className="focus-inset rounded-md px-1.5 py-0.5 font-medium text-accent transition-colors duration-[var(--dur-fast)] hover:bg-accent-subtle"
              >
                Try another model
              </button>
            )}
          </span>
        )}
        {message.stopReason === "length" && (
          <span className="flex items-center gap-2">
            <span className="text-warning">ran out of room</span>
            {/* The answer stopped mid-thought because it hit the output cap,
                not because it was finished. Every one of the big three offers
                the rest in one press; making someone type "continue" is
                making them do the app's job. Only on the latest answer —
                continuing an older one would fork the thread. */}
            {isLast && onContinue && (
              <button
                onClick={onContinue}
                className="focus-inset rounded-md px-1.5 py-0.5 font-medium text-accent transition-colors duration-[var(--dur-fast)] hover:bg-accent-subtle"
              >
                Continue
              </button>
            )}
          </span>
        )}
      </div>

      {message.reasoning && <Reasoning text={message.reasoning} />}

      {made ? (
        <>
          {made.prose && <Markdown content={made.prose} />}
          <MakeCard
            title={made.title}
            code={made.doc}
            onOpen={onOpenMade ? () => onOpenMade(message) : undefined}
            onEdit={() => onOpenInCanvas(text)}
          />
        </>
      ) : text ? (
        /* The calculation in this answer reports its result to this answer,
           and only from the newest one, and only once: the block re-runs
           whenever the conversation is reopened — which is free and gives
           the same numbers — but the turn it produces must not happen
           twice. `computedAt` on the message is what makes that durable
           across a reload. */
        <ComputeScope
          onDone={
            isLast && onComputed && !message.computedAt && computeBlock(text)
              ? (out) => onComputed(message, out)
              : undefined
          }
        >
          <Markdown content={text} />
        </ComputeScope>
      ) : message.error ? null : (
        <p className="text-sm italic text-tertiary">No response.</p>
      )}

      {message.error && <InlineError message={message.error} onRetry={() => onRegenerate(message)} />}

      {message.sources && message.sources.length > 0 && <Sources sources={message.sources} />}

      {message.actions && message.actions.length > 0 && (
        <Actions
          actions={message.actions}
          onOpen={onOpenAction}
          onUndo={onUndoAction ? (a) => onUndoAction(message, a) : undefined}
        />
      )}

      {message.verdict && (
        <SecondOpinion verdict={message.verdict} authorProvider={model?.provider} />
      )}

      {/* Why not good — the one question a thumbs-down earns. Each answer is
          a reason the next attempt can act on, and picking one regenerates
          with it. Skip closes it and keeps the mark. */}
      {asking && onRate && (
        <div className="no-print mt-2 flex flex-wrap items-center gap-1.5 anim-fade" role="group" aria-label="What was wrong">
          <span className="text-xs text-tertiary">What was wrong?</span>
          {(
            [
              ["wrong", "Wrong"],
              ["long", "Too long"],
              ["off", "Not what I asked"],
              ["unclear", "Unclear"],
            ] as [RatingReason, string][]
          ).map(([reason, label]) => (
            <button
              key={reason}
              onClick={() => { setAsking(false); onRate(message, { up: false, reason, at: Date.now() }); }}
              className="btn-touch press h-8 rounded-full border border-line bg-surface px-3 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setAsking(false)}
            className="btn-touch press h-8 rounded-full px-2.5 text-xs text-tertiary transition-colors duration-[var(--dur-fast)] hover:text-primary"
          >
            Skip
          </button>
        </div>
      )}

      {/* What to ask next, one press each. The things a tutor offers after an
          explanation and the things a person types most often after one:
          simpler, an example, the steps, why, test me, harder. They send a
          real message in the person's own turn, so the transcript shows what
          was asked and nothing is done behind their back. Last answer only —
          on an earlier one they would be asking about the wrong thing. */}
      {isLast && onFollowUp && !message.error && !computed && text && (
        <div className="no-print mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Follow up">
          {(made ? MAKE_FOLLOW_UPS : teaching ? TEACH_FOLLOW_UPS : FOLLOW_UPS).map((f) => (
            <button
              key={f.label}
              onClick={() => onFollowUp(f.text)}
              className="btn-touch press h-8 rounded-full border border-line bg-surface px-3 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Not every action is equal, so they are not drawn equal. Copy and
          regenerate are what people reach for; the rest live one click deeper
          rather than making you read seven identical icons to find the two.

          The row stays put on the last answer — that is the one you are about
          to act on, and making it appear only on hover means discovering it by
          accident. Earlier answers keep it on hover, where it does not compete
          with the reading. */}
      <div
        /* See the user row above: a 28px box holding 44px controls overflows
           into the answer's own last line, and at 390px eight of them cannot
           sit on one line either. Both were true before anything was added. */
        className="mt-1.5 flex min-h-7 flex-wrap items-center gap-0.5 reveal"
        data-visible={isLast ? "true" : undefined}
      >
        {siblings.length > 1 && <BranchNav siblings={siblings} index={index} onNavigate={onNavigate} />}
        <IconButton label={copied ? "Copied" : "Copy"} size={28} onClick={copy}>
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
        </IconButton>
        <IconButton label="Regenerate" size={28} onClick={() => onRegenerate(message)}>
          <RefreshCw size={14} />
        </IconButton>
        {/* The two everyone else has and this app did not. Up is one press
            and that is the end of it. Down opens one question — why — with
            four answers, and the answer chosen goes back to the model as a
            note for the next attempt, so a thumbs-down is not a number in a
            log but the start of a better answer. The asymmetry is
            deliberate: praise needs no follow-up and a complaint is only
            useful with one. */}
        {onRate && (
          <>
            <IconButton
              label={message.rating?.up ? "Marked good" : "Good answer"}
              size={28}
              active={message.rating?.up === true}
              onClick={() => { setAsking(false); onRate(message, { up: true, at: Date.now() }); }}
            >
              <ThumbsUp size={14} className={message.rating?.up ? "text-success" : undefined} />
            </IconButton>
            <IconButton
              label={message.rating && !message.rating.up ? "Marked not good" : "Not good"}
              size={28}
              active={message.rating ? !message.rating.up : false}
              onClick={() => { onRate(message, { up: false, at: Date.now() }); setAsking(true); }}
            >
              <ThumbsDown size={14} className={message.rating && !message.rating.up ? "text-danger" : undefined} />
            </IconButton>
          </>
        )}
        {/* The one thing an app holding four providers' keys can do that a
            single-provider app cannot do honestly. A model asked to check its
            own answer agrees with itself — same reasoning, same weights — so
            this always goes somewhere else, or says it cannot. */}
        {onVerify && !message.verdict && (
          <IconButton
            label={verifying ? "Checking…" : "Check with another model"}
            size={28}
            onClick={() => onVerify(message)}
            disabled={verifying}
          >
            <ShieldQuestion size={14} />
          </IconButton>
        )}
        {/* The loop the linter closes. It reads the finished answer back
            against the house rules — the header it opened with, the "let me
            explain", the "probably" with no odds — and this asks for the same
            answer without them. It appears only when there is something to
            cut; a control that is always there is one that is never read. */}
        {onTighten && findings && findings.length > 0 && (
          <IconButton label={`Tighten — ${findings[0].rule}`} size={28} onClick={() => onTighten(message)}>
            <Scissors size={14} />
          </IconButton>
        )}
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
              className="z-50 w-60 rounded-md glass border border-line p-1.5 shadow-lg anim-menu"
            >
              {/* The same list the picker offers, because "regenerate with
                  another model" means another of ours. It used to be every
                  engine this app can call, by its maker's name — which made
                  the one control people press when an answer disappoints a
                  menu of somebody else's products. */}
              {/* The same model, told to think harder. What people actually
                  want when an answer is thin is usually not a different
                  model but more of this one — and "high" is a word rather
                  than a budget, so it costs nothing to offer. */}
              <DropdownMenu.Item
                onSelect={() => onRegenerate(message, undefined, { effort: "high" })}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-secondary outline-none transition-colors duration-[var(--dur-fast)] data-[highlighted]:bg-subtle data-[highlighted]:text-primary"
              >
                <Brain size={12} className="shrink-0 text-[var(--accent-2)]" />
                <span className="truncate">With more effort</span>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
              {PRESETS.filter((x) => x.id !== message.presetId).map((x) => (
                <DropdownMenu.Item
                  key={x.id}
                  onSelect={() => onRegenerate(message, x.id)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-secondary outline-none transition-colors duration-[var(--dur-fast)] data-[highlighted]:bg-subtle data-[highlighted]:text-primary"
                >
                  <PresetIcon id={x.id} size={12} className="shrink-0 text-[var(--accent-2)]" />
                  <span className="truncate">{x.short}</span>
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
              className="z-50 w-56 rounded-md glass border border-line p-1.5 shadow-lg anim-menu"
            >
              {/* The bridge from reading to remembering. Every assistant
                  will write cards when asked; the difference here is that
                  they are kept and asked again later, which is the whole
                  of how anybody learns anything. */}
              {onMakeCards && text && (
                <DropdownMenu.Item
                  onSelect={() => onMakeCards(text)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-secondary outline-none transition-colors duration-[var(--dur-fast)] data-[highlighted]:bg-subtle data-[highlighted]:text-primary"
                >
                  <GraduationCap size={15} className="text-tertiary" />
                  Make cards from this
                </DropdownMenu.Item>
              )}
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
              {/* The panel shows an answer; the canvas keeps it. This is the
                  step from reading what the model wrote to working on it. */}
              <DropdownMenu.Item
                onSelect={() => onOpenInCanvas(text)}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-secondary outline-none transition-colors duration-[var(--dur-fast)] data-[highlighted]:bg-subtle data-[highlighted]:text-primary"
              >
                <SquarePen size={15} className="text-tertiary" />
                Edit in a canvas
              </DropdownMenu.Item>
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

/**
 * The card that stands in for a built thing in the transcript.
 *
 * What the person asked for is running in the column beside this; what
 * this shows is that it exists, what it is called, and the two things you
 * can do with it from here — open it, or look at how it was made. The code
 * is behind a press because a person who asked for flashcards did not ask
 * for markup, and the one who wants it can have it in one click.
 */
export function MakeCard({
  title,
  code,
  onOpen,
  onEdit,
}: {
  title: string;
  code: string;
  onOpen?: () => void;
  onEdit: () => void;
}) {
  const [showCode, setShowCode] = React.useState(false);
  const lines = code.split("\n").length;
  return (
    <div role="group" aria-label={`Made: ${title}`} className="my-2 max-w-[28rem] rounded-lg border border-line bg-surface shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-3 p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
          <LayoutTemplate size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-primary">{title}</span>
          <span className="block text-xs text-tertiary">Web app · runs beside the chat · <span className="tnum">{lines}</span> lines</span>
        </span>
        {onOpen && (
          <Button size="sm" variant="primary" onClick={onOpen}>
            <Play size={13} />
            Open
          </Button>
        )}
      </div>
      <div className="no-print flex items-center gap-0.5 border-t border-line px-2 py-1">
        <button
          onClick={() => setShowCode((s) => !s)}
          aria-expanded={showCode}
          className="focus-inset flex h-8 items-center gap-1.5 rounded-sm px-2 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
        >
          <Code2 size={13} />
          {showCode ? "Hide code" : "Show code"}
        </button>
        <button
          onClick={onEdit}
          className="focus-inset flex h-8 items-center gap-1.5 rounded-sm px-2 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
        >
          <SquarePen size={13} />
          Edit in Code
        </button>
      </div>
      {showCode && (
        <div className="border-t border-line p-2">
          <CodeBlock code={code} lang="html" />
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
/**
 * What a different model said about this answer.
 *
 * Deliberately not a score and not a tick. Three states, because the useful
 * middle one is "the substance holds but this bit is wrong", and a system with
 * only pass and fail pushes every partial disagreement into whichever of the
 * two is less accurate.
 *
 * A disagreement is drawn in the warning colour and an agreement is not drawn
 * in green: a confirmation should be quiet. Green ticks are how a checked
 * answer starts reading as a *correct* answer, and a second model agreeing is
 * evidence, not proof — the two can be wrong together, and are most likely to
 * be wrong together exactly where the question is hardest.
 */
function SecondOpinion({
  verdict,
  authorProvider,
}: {
  verdict: NonNullable<Msg["verdict"]>;
  /** Which company wrote it, so this can say whether the check is independent. */
  authorProvider?: string;
}) {
  const checker = getModel(verdict.modelId);
  const said =
    verdict.agrees === "agrees"
      ? "found nothing wrong"
      : verdict.agrees === "partly"
        ? "mostly agrees"
        : "disagrees";
  /* What makes this worth reading is that it did not come from the model
     that wrote the answer — and, wherever there are two keys, not from that
     company at all. That is the claim, and it is a fact about the two
     providers: it used to be gated on the answer having come from one of
     Armi's own models as well, which said "a second model" over a genuinely
     independent check whenever the thread was pinned to an engine. Which
     company it was is the detail, and it stays off the screen. */
  const from =
    authorProvider && checker.provider !== authorProvider ? "A model from another company" : "A second model";
  return (
    <div
      className={cn(
        "mt-2 rounded-xl border bg-surface p-3",
        verdict.agrees === "disagrees" ? "border-[var(--warning)]" : "border-line",
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <ShieldQuestion
          size={13}
          className={cn("shrink-0", verdict.agrees === "disagrees" ? "text-warning" : "text-tertiary")}
        />
        {/* The part of the system that does this has a name, and naming it
            here is the difference between "a model said something" and "the
            thing that checks answers ran". */}
        <span className="eyebrow text-faint">
          Sentinel · second opinion
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-tertiary">
          {from} {said}
        </span>
      </div>
      <Markdown content={verdict.text} />
    </div>
  );
}

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
        {/* Retry only where a retry can help. A missing or rejected key fails
            the same way every time, and offering Retry beside "Add key" is
            offering the wrong one of the two first. */}
        {onRetry && action !== "add_key" && (
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

/** What a URL is, when a page had no title. */
function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/**
 * The pages an answer drew on, numbered to match the markers in it.
 *
 * A strip rather than footnotes: the numbers in the text say *where* a claim
 * rests on a page, and the strip says *which* page, once, in a list that can
 * be read on its own. The cited passage rides on the link as a title, so
 * hovering says what was taken from the page without a trip to it.
 */
/**
 * What the answer did, one chip per action.
 *
 * Under the answer rather than in it, because the text is the model's and
 * this is the app's account of what actually happened — a deck with eight
 * cards in it exists whether or not the sentence above says so. Open goes
 * to the thing; Undo takes it back, for as long as this session remembers
 * how, and the chip says so afterwards rather than vanishing.
 */
export function Actions({
  actions,
  onOpen,
  onUndo,
  live,
}: {
  actions: Action[];
  onOpen?: (open: NonNullable<Action["open"]>) => void;
  onUndo?: (action: Action) => void;
  /** Still streaming: no undo yet, the turn is not over. */
  live?: boolean;
}) {
  return (
    <ul className="no-print mt-3 flex flex-wrap gap-1.5" aria-label="Done in this app">
      {actions.map((a) => (
        <li
          key={a.id}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
            a.undone
              ? "border-line text-faint line-through"
              : a.ok
                ? "border-line bg-surface text-secondary"
                : "border-danger/40 bg-danger/5 text-danger",
          )}
        >
          <ActionIcon name={a.name} ok={a.ok} />
          <span className="max-w-[24rem] truncate">{a.summary}</span>
          {!a.undone && a.ok && a.open && onOpen && (
            <button
              type="button"
              onClick={() => onOpen(a.open!)}
              className="ml-0.5 rounded px-1 font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open
            </button>
          )}
          {!live && !a.undone && a.ok && onUndo && canUndo(a.id) && (
            <button
              type="button"
              onClick={() => onUndo(a)}
              className="rounded px-1 font-medium text-tertiary hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Undo
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function ActionIcon({ name, ok }: { name: string; ok: boolean }) {
  const size = 12;
  const cls = ok ? "shrink-0 text-tertiary" : "shrink-0";
  if (!ok) return <AlertCircle size={size} className={cls} aria-hidden />;
  switch (name) {
    case "save_cards":
    case "study_status":
      return <GraduationCap size={size} className={cls} aria-hidden />;
    case "save_note":
    case "search_notes":
      return <NotebookPen size={size} className={cls} aria-hidden />;
    case "remember":
      return <Brain size={size} className={cls} aria-hidden />;
    case "save_to_project":
      return <FolderPlus size={size} className={cls} aria-hidden />;
    case "list_made":
      return <Code2 size={size} className={cls} aria-hidden />;
    case "search_conversations":
      return <Search size={size} className={cls} aria-hidden />;
    case "calculate":
      return <Calculator size={size} className={cls} aria-hidden />;
    case "now":
      return <Clock size={size} className={cls} aria-hidden />;
    default:
      return <Check size={size} className={cls} aria-hidden />;
  }
}

export function Sources({ sources }: { sources: WebSource[] }) {
  return (
    <section className="no-print mt-3 rounded-lg border border-line bg-surface px-3 py-2" aria-label="Sources">
      <h4 className="text-tiny font-medium text-tertiary">Sources</h4>
      <ol className="mt-1 space-y-0.5">
        {sources.map((s) => (
          <li key={s.n} className="flex items-baseline gap-2 text-xs">
            <span className="w-4 shrink-0 text-right text-tertiary tnum">{s.n}</span>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              title={s.quote ? `“${s.quote}”` : undefined}
              className="min-w-0 truncate text-secondary hover:text-primary hover:underline"
            >
              {s.title || hostOf(s.url)}
            </a>
            <span className="shrink-0 text-faint">{hostOf(s.url)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
