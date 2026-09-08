"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn, isMac } from "@/lib/utils";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  // 500ms before the first tip, then instant within the group: slow enough not
  // to nag while the mouse is passing through, fast enough to feel responsive
  // once the user is clearly exploring the toolbar.
  return (
    <TooltipPrimitive.Provider delayDuration={500} skipDelayDuration={300}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({
  label,
  keys,
  side = "top",
  children,
}: {
  label: string;
  keys?: string[];
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-1 text-xs text-primary shadow-md anim-pop"
        >
          {label}
          {keys && <Kbd keys={keys} />}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function Kbd({ keys }: { keys: string[] }) {
  const [mac, setMac] = React.useState(true);
  React.useEffect(() => setMac(isMac()), []);
  return (
    <span className="flex gap-0.5">
      {keys.map((k) => (
        <kbd
          key={k}
          className="min-w-[1.25em] rounded-[4px] border border-line bg-subtle px-1 text-center font-sans text-[11px] leading-[1.5] text-tertiary"
        >
          {k === "mod" ? (mac ? "⌘" : "Ctrl") : k === "shift" ? "⇧" : k === "enter" ? "↵" : k}
        </kbd>
      ))}
    </span>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-[var(--dur-fast)] ease-[var(--ease-std)] disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-accent text-accent-fg hover:bg-accent-hover",
        variant === "secondary" && "border border-line-strong bg-surface text-primary hover:bg-subtle",
        variant === "ghost" && "text-secondary hover:bg-subtle hover:text-primary",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
});

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  keys?: string[];
  active?: boolean;
  size?: number;
};

/**
 * Icon-only controls always carry an accessible name and a tooltip. An icon
 * without a name is a guessing game for everyone and a dead end for a screen
 * reader.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, keys, active, className, size = 32, ...props }, ref) {
    return (
      <Tooltip label={label} keys={keys}>
        <button
          ref={ref}
          aria-label={label}
          aria-pressed={active}
          style={{ width: size, height: size }}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-[var(--dur-fast)] ease-[var(--ease-std)] disabled:pointer-events-none disabled:opacity-35",
            active ? "bg-subtle text-primary" : "text-tertiary hover:bg-subtle hover:text-primary",
            className,
          )}
          {...props}
        />
      </Tooltip>
    );
  },
);

/** Destructive actions confirm inline. Modals are for things needing paragraphs. */
export function ConfirmInline({
  question,
  onConfirm,
  onCancel,
}: {
  question: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 anim-fade" onClick={(e) => e.stopPropagation()}>
      <span className="text-xs text-secondary">{question}</span>
      <button
        onClick={onConfirm}
        className="rounded-sm px-1.5 text-xs font-medium text-danger hover:bg-[var(--danger-subtle)]"
      >
        Yes
      </button>
      <button onClick={onCancel} className="rounded-sm px-1.5 text-xs text-tertiary hover:bg-subtle">
        No
      </button>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
      aria-hidden
    />
  );
}
