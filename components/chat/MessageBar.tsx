"use client";

import * as React from "react";
import { ArrowUp, Mic, Square } from "lucide-react";
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
  className?: string;
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
  onArrowUp,
  onPaste,
  autoFocus,
  focusKey,
  className,
}: MessageBarProps) {
  const settings = useSettings();
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation((chunk) => onChange(value ? `${value} ${chunk}` : chunk));

  /* Auto-grow. The box grows upward and the page never shifts, which is what
     makes writing four lines feel like the same act as writing one. */
  const resize = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.4)}px`;
  }, []);
  React.useEffect(resize, [value, resize]);

  React.useEffect(() => {
    if (!autoFocus && focusKey === undefined) return;
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
        "vt-bar composer-shell rounded-[28px] border transition-[box-shadow,border-color] duration-[var(--dur-fast)] ease-[var(--ease-std)]",
        className,
      )}
    >
      {above}

      {/* The line you type on gets the full width. Nothing shares it. */}
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
        className="max-h-[45vh] w-full resize-none bg-transparent px-5 pb-1 pt-4 text-base leading-6 text-primary outline-none placeholder:text-tertiary"
      />

      {/* Two groups, not one wrapping row. Only the left group wraps — send is
          the one control this row exists for, and as a single wrapping line it
          fell to a line of its own at 1440px and off the right edge entirely
          at 390px. Anchored here it can do neither. */}
      <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-0.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">{left}</div>

        <div className="flex min-w-0 items-center gap-1">
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
                "bloom focus-inset absolute inset-0 flex items-center justify-center rounded-full transition-[opacity,background-color,color,box-shadow,transform] duration-[var(--dur-fast)] ease-[var(--ease-std)]",
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
