"use client";

import * as React from "react";
import { ArrowUp, AudioLines, Mic, Square } from "lucide-react";
import { useSettings } from "@/lib/store";
import { useDictation } from "@/lib/hooks/useDictation";
import { Tooltip } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * The box you type in. One of them, everywhere.
 *
 * There used to be two. Chat had a 28px-radius container with the text on its
 * own line and the controls beneath it; the canvas had a 44px-tall pill with
 * the send button floating outside it, and no way to dictate at all. They were
 * the same request — say a thing to the model — wearing two different faces,
 * and moving between the two rooms meant re-learning where the send button
 * lives and re-discovering that the microphone is missing from one of them.
 *
 * So the shell, the typography, the growth, the keyboard, the microphone and
 * the send button are all here, and a room supplies only what is genuinely its
 * own: what it says in the placeholder, and which controls belong on the row.
 *
 * Three slots, in the order they are read:
 *
 *   above  attachments in chat, one-press edits on a canvas — whatever is
 *          about the message rather than in it
 *   left   the controls that change the request; wraps on a narrow screen
 *   right  the controls that identify it; pinned, never wraps
 *
 * Send is not a slot. It is the one control this thing exists for, it is
 * always last, and it is always in the same place.
 */

export interface MessageBarProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  placeholder: string;
  /** The name a screen reader reads for the box itself. */
  ariaLabel?: string;
  /** Greyed and inert; the send disc shows the thinking orb instead. */
  busy?: boolean;
  /** Streaming: send becomes stop, in place. */
  streaming?: boolean;
  onStop?: () => void;
  /** False greys the send disc — nothing to send, or nowhere to send it. */
  canSend?: boolean;
  above?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** ↑ on an empty box. Chat edits the last thing you said; nothing else does. */
  onArrowUp?: () => void;
  /** Chat turns a long paste into a chip and a pasted image into an attachment. */
  onPaste?: (e: React.ClipboardEvent) => void;
  /** Focus on mount — true where the box is the only thing to do. */
  autoFocus?: boolean;
  /** Re-focuses and puts the caret at the end when this changes. */
  focusKey?: string;
  /** Voice mode: listen, send, speak, listen. Hidden where unsupported. */
  voice?: { supported: boolean; phase: "off" | "listening" | "thinking" | "speaking"; toggle: () => void };
  className?: string;
  /** Focus even on a touch screen: the box was asked for by a press. */
  focusOnTouch?: boolean;
}

export function MessageBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel = "Message",
  busy,
  streaming,
  onStop,
  canSend = true,
  above,
  left,
  right,
  voice,
  onArrowUp,
  onPaste,
  autoFocus,
  focusKey,
  focusOnTouch,
  className,
}: MessageBarProps) {
  const settings = useSettings();
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation((chunk) => onChange(value ? `${value} ${chunk}` : chunk));

  /* One line or several. At rest the bar is a single row — the controls sit
     beside the line you type on, the way every one of the big assistants
     lays it out — and it opens into text-over-controls once what you are
     writing wraps. `tall` is the memory of that. It goes up when the text
     wraps and comes down only when the box is emptied, on purpose: a
     sentence that wraps in the narrow row fits in the wide one, and a flag
     that re-measured every keystroke would flip the layout back and forth
     under the caret. */
  const [tall, setTall] = React.useState(false);

  /* Auto-grow. The box grows upward and the page never shifts, which is what
     makes writing four lines feel like the same act as writing one. */
  const resize = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.4)}px`;
    /* 44: one line is 24 of leading inside 8 of padding each side = 40, and
       four of slack for the browser's rounding. */
    if (!el.value) setTall(false);
    else if (el.scrollHeight > 44) setTall(true);
  }, []);
  React.useEffect(resize, [value, resize]);

  /* Anything above the line — attachments, a canvas's shortcuts — is about
     the message rather than in it and wants the full width beneath it, so
     its presence stacks the bar too. */
  const stacked = tall || Boolean(above);

  /* Focus is a gift on a desk and a cost on a tablet. With a keyboard on
     the desk, putting the caret in the box saves the click everybody was
     about to make. On a touch screen the same focus raises the software
     keyboard over half the page before a word of it has been read — every
     room you walk into, every conversation you open. So the box focuses
     itself only where the primary pointer is fine, unless the caller says
     the focus is the point (a press that made this box appear), in which
     case the keyboard is what was asked for. */
  React.useEffect(() => {
    if (!autoFocus && focusKey === undefined) return;
    if (!focusOnTouch && typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && settings.sendOnEnter && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit();
      return;
    }
    /* Escape steps out. Everything that only works when you are not typing —
       j/k, ?, backing out of a section — depends on being able to leave, and a
       text box you cannot leave with the keyboard is a trap. */
    if (e.key === "Escape") {
      e.currentTarget.blur();
      return;
    }
    if (e.key === "ArrowUp" && !value && onArrowUp) {
      e.preventDefault();
      onArrowUp();
    }
  };

  const sendable = canSend && !busy && Boolean(value.trim());

  return (
    <div
      /* vt-bar names this box for the view transition. There is only ever one
         of them mounted, so when the blank page hands it to the dock on the
         first send the browser moves it down the screen rather than letting
         one vanish and another appear. */
      className={cn(
        /* The bar is the container, and it has to be an ancestor of what
           asks about it: an element cannot query its own size, so naming the
           container on the control row — which is where the thresholds are
           used — matched nothing and left the row stacked at every width. */
        "@container/bar vt-bar composer-shell rounded-[28px] border transition-[box-shadow,border-color] duration-[var(--dur-fast)] ease-[var(--ease-std)]",
        className,
      )}
    >
      {above}

      {/* One flex box, and `order` is what moves the pieces — never a remount.
          Three things live in it: the left controls, the line you type on, and
          the right controls with send at their end. In a row they read left,
          line, right. Stacked, the line takes the whole first row and the two
          groups share the second. The textarea is the same element in both
          arrangements, so the caret, the selection and the focus survive the
          change; a layout that unmounted it to move it would drop all three
          in the middle of a sentence.

          The narrow case is decided by the bar's own width and not by state:
          under 34rem there is no room for a line beside the controls whatever
          the text is doing, so the container query stacks it — the same bar
          is 266px inside a 320px phone and inside a 1024px window with the
          sidebar out, and a viewport breakpoint would call the second one
          wide. Below that width the left group takes a whole row of its own
          too, and the right group keeps the end of the last row, so send is
          still the last thing on the last line at every width. */}
      <div className="flex flex-wrap items-end gap-1 px-2.5 pb-2.5 pt-2.5">
        <div
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-1 empty:hidden @max-[34rem]/bar:order-2 @max-[34rem]/bar:basis-full",
            stacked ? "order-2" : "order-1",
          )}
        >
          {left}
        </div>

        {/* The line you type on. Full width when stacked, the free space in a row. */}
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          rows={1}
          placeholder={placeholder}
          aria-label={ariaLabel}
          /* 16px, not 15: anything smaller and iOS zooms the whole page on
             focus, and the way back out is a pinch. */
          /* The same per-block direction the answers get. Someone typing
             Arabic was watching their own sentence build left to right with
             the caret in the wrong place. */
          dir="auto"
          /* 220px ceiling, not a viewport fraction. On a 1080px window 45vh
             let the box grow to 486px, so pasting anything long pushed the
             conversation off the screen while you wrote the reply. A composer
             should stop growing while what it is answering is still readable;
             past that it scrolls. 220 is where the two specs overlap. */
          className={cn(
            "max-h-[13.75rem] min-w-0 resize-none bg-transparent px-3 py-2 text-base leading-6 text-primary outline-none placeholder:text-tertiary",
            "@max-[34rem]/bar:order-1 @max-[34rem]/bar:basis-full",
            stacked ? "order-1 basis-full" : "order-2 flex-1",
          )}
        />

        {/* `ms-auto` pins this group to the end of whichever row it lands on,
            which is what keeps send in the bottom-right corner rather than
            spread across the width. */}
        <div className="order-3 ms-auto flex min-w-0 items-center gap-1">
          {right}

          {dictation.supported && (
            <Tooltip label={dictation.listening ? "Stop dictating" : "Dictate"}>
              <button
                onClick={dictation.toggle}
                aria-label={dictation.listening ? "Stop dictating" : "Dictate"}
                aria-pressed={dictation.listening}
                className={cn(
                  "ctl focus-inset flex [--ctl:2.25rem] shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--dur-fast)]",
                  dictation.listening
                    ? "bg-[color-mix(in_oklab,var(--stop)_14%,transparent)] text-[var(--stop)]"
                    : "text-secondary hover:bg-subtle hover:text-primary",
                )}
              >
                <Mic size={18} />
              </button>
            </Tooltip>
          )}

          {/* Voice mode, next to dictation because it is dictation's big
              sibling: the mic fills the box, this one holds the whole
              conversation. Its state is on its face — Listening, Thinking,
              Speaking — because a mode you cannot see the state of is a
              mode you cannot trust with your microphone. */}
          {voice?.supported && (
            <Tooltip label={voice.phase === "off" ? "Voice mode" : "End voice mode"}>
              <button
                onClick={voice.toggle}
                aria-label={voice.phase === "off" ? "Voice mode" : "End voice mode"}
                aria-pressed={voice.phase !== "off"}
                className={cn(
                  "focus-inset flex [--ctl:2.25rem] shrink-0 items-center justify-center gap-1.5 rounded-full transition-colors duration-[var(--dur-fast)]",
                  /* Square while it is an icon, a pill once it carries a word. */
                  voice.phase === "off"
                    ? "ctl text-secondary hover:bg-subtle hover:text-primary"
                    : "ctl-h bg-accent-subtle px-3 text-accent",
                )}
              >
                <AudioLines size={18} />
                {voice.phase !== "off" && (
                  <span className="text-sm" aria-live="polite">
                    {voice.phase === "listening" ? "Listening" : voice.phase === "thinking" ? "Thinking" : "Speaking"}
                  </span>
                )}
              </button>
            </Tooltip>
          )}

          {/* Send becomes stop in place. A monochrome disc reads as the one
              terminal action without spending the accent on something the eye
              already finds by shape and position. */}
          <div className="ctl relative [--ctl:2.25rem] shrink-0">
            <button
              onClick={onSubmit}
              disabled={!sendable || streaming}
              aria-hidden={streaming || undefined}
              aria-label="Send message"
              className={cn(
                "bloom bloom-ai focus-inset absolute inset-0 flex items-center justify-center rounded-full transition-[opacity,background-color,color,box-shadow,transform] duration-[var(--dur-fast)] ease-[var(--ease-std)]",
                "bg-[var(--cta)] text-[var(--cta-fg)] hover:bg-[var(--cta-hover)]",
                /* The disabled disc has to stay a disc. On a translucent
                   composer, a fill this close to the surface behind it just
                   disappears, so it borrows the border instead of the surface. */
                "disabled:bg-[color-mix(in_oklab,var(--text-primary)_16%,transparent)] disabled:text-[var(--text-faint)]",
                streaming ? "pointer-events-none opacity-0" : "opacity-100",
              )}
            >
              {busy ? <span className="think-orb" aria-hidden /> : <ArrowUp size={19} />}
            </button>
            {onStop && (
              <button
                onClick={onStop}
                /* Both discs stay mounted so one can fade into the other in
                   place, and the one that is faded out has to leave properly:
                   invisible is not the same as gone. Without this, tabbing
                   through an idle composer lands on a Stop button nobody can
                   see, and a screen reader offers to stop a generation that
                   is not running. */
                disabled={!streaming}
                aria-hidden={!streaming || undefined}
                aria-label="Stop generating"
                className={cn(
                  "focus-inset absolute inset-0 flex items-center justify-center rounded-full bg-[var(--cta)] text-[var(--cta-fg)] transition-opacity duration-[var(--dur-fast)] ease-[var(--ease-std)]",
                  streaming ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                <Square size={12} fill="currentColor" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
