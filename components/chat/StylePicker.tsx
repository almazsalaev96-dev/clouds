"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, Palette, Plus } from "lucide-react";
import { BUILT_IN_STYLES, DEFAULT_STYLE_ID } from "@/lib/styles";
import type { Style } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * How you want to be talked to, next to the room you are standing in.
 *
 * It used to sit in the composer beside the mode switch and the tools popover,
 * and when those two went — the app reads the request now rather than asking
 * about the machine before you have typed — this was the only one of the three
 * left that is genuinely a preference. Nothing in a sentence reliably says
 * whether you want to be argued with or taught, so it stays a control.
 *
 * It sits with the room switch rather than over the box you type in because it
 * belongs to the thread, not to the message: it is the register every answer
 * here comes back in, which is the same kind of fact as which room you are in.
 * The composer is for the thing you are about to say.
 */
export function StylePicker({
  styleId,
  customStyles,
  onStyleChange,
  onEditStyles,
}: {
  styleId: string;
  customStyles: Style[];
  onStyleChange: (id: string) => void;
  onEditStyles: () => void;
}) {
  const [stylesOpen, setStylesOpen] = React.useState(false);
  const styles = React.useMemo(() => [...BUILT_IN_STYLES, ...customStyles], [customStyles]);
  const style = styles.find((s) => s.id === styleId);

  return (
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
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          side="bottom"
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
  );
}
