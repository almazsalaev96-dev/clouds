"use client";

/**
 * The whole component vocabulary MarketLab is built from.
 *
 * Kept in one file on purpose: the value of a design system is that a card
 * looks the same wherever it appears, and that is easiest to hold true when
 * every variant is visible on one screen. Nothing here hardcodes a colour — all
 * of it resolves to the tokens in `marketlab.css`, which is what makes the dark
 * theme a re-derivation rather than an inversion.
 */

import * as React from "react";

export function cx(...parts: Array<string | false | null | undefined | 0>): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");
}

/* ---------------------------------------------------------------- Button -- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-ml-sm font-medium " +
  "transition-[background-color,border-color,color,box-shadow] duration-150 " +
  "disabled:opacity-45 disabled:cursor-not-allowed select-none whitespace-nowrap";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-ml-accent text-ml-accent-fg hover:bg-ml-accent-hover shadow-ml-sm",
  secondary: "bg-ml-surface text-ml-text border border-ml-border hover:bg-ml-subtle",
  ghost: "text-ml-text-2 hover:bg-ml-subtle hover:text-ml-text",
  danger: "bg-ml-negative-subtle text-ml-negative border border-ml-negative/25 hover:bg-ml-negative hover:text-white",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-9.5 px-4 text-[0.875rem]",
  lg: "h-11 px-5 text-[0.9375rem]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...rest }, ref,
) {
  return <button ref={ref} type={type} className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)} {...rest} />;
});

/** The same surface as a Button, for an anchor. */
export function LinkButton({
  variant = "secondary", size = "md", className, ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <a className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)} {...rest} />;
}

/* ------------------------------------------------------------------ Card -- */

/**
 * `min-w-0` is not decoration. A grid or flex item defaults to
 * `min-width: auto`, which means it refuses to be narrower than its widest
 * unbreakable content — a formula set in `white-space: pre`, a wide table, a
 * long number. The item then pushes the whole track wider than the viewport
 * and the page scrolls sideways on a phone. Cards are the things that go in
 * grids, so the floor is removed here once rather than at every call site.
 */
export function Card({ className, as: As = "div", ...rest }: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  return <As className={cx("min-w-0 rounded-ml-lg border border-ml-border bg-ml-surface", className)} {...rest} />;
}

export function CardHeader({ title, description, actions, className }: {
  title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-4 border-b border-ml-border px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="ml-h3 text-ml-text">{title}</h3>
        {description ? <p className="ml-small mt-1 text-ml-text-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("px-5 py-4", className)} {...rest} />;
}

/* ----------------------------------------------------------------- Badge -- */

type Tone = "neutral" | "accent" | "positive" | "negative" | "warning";

const TONE: Record<Tone, string> = {
  neutral: "bg-ml-subtle text-ml-text-2 border-ml-border",
  accent: "bg-ml-accent-subtle text-ml-accent border-ml-accent/25",
  positive: "bg-ml-positive-subtle text-ml-positive border-ml-positive/25",
  negative: "bg-ml-negative-subtle text-ml-negative border-ml-negative/25",
  warning: "bg-ml-warning-subtle text-ml-warning border-ml-warning/30",
};

export function Badge({ tone = "neutral", className, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium leading-5",
        TONE[tone], className,
      )}
      {...rest}
    />
  );
}

/* --------------------------------------------------------------- Callout -- */

export function Callout({ tone = "neutral", title, children, className }: {
  tone?: Tone; title?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  const border: Record<Tone, string> = {
    neutral: "border-ml-border bg-ml-inset",
    accent: "border-ml-accent/25 bg-ml-accent-subtle",
    positive: "border-ml-positive/25 bg-ml-positive-subtle",
    negative: "border-ml-negative/25 bg-ml-negative-subtle",
    warning: "border-ml-warning/30 bg-ml-warning-subtle",
  };
  return (
    <div className={cx("rounded-ml-md border px-4 py-3", border[tone], className)}>
      {title ? <p className="ml-small font-semibold text-ml-text">{title}</p> : null}
      <div className={cx("ml-small ml-rich text-ml-text-2", title ? "mt-1" : "")}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------- Form bits -- */

export function Field({ label, hint, htmlFor, children, error, className }: {
  label: React.ReactNode; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode; error?: string | null; className?: string;
}) {
  return (
    <div className={cx("min-w-0", className)}>
      <label htmlFor={htmlFor} className="ml-label block text-ml-text-3">{label}</label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p role="alert" className="ml-small mt-1.5 text-ml-negative">{error}</p>
      ) : hint ? (
        <p className="ml-small mt-1.5 text-ml-text-4">{hint}</p>
      ) : null}
    </div>
  );
}

/* `border-ml-border-strong`, not `border-ml-border`: the boundary of a control
   is what makes it findable, and WCAG asks it to clear 3:1 against the surface
   behind it. The faint hairline is for cards, which are not controls. */
const INPUT_CLASS =
  "w-full rounded-ml-sm border border-ml-border-strong bg-ml-surface px-3 py-2 text-[0.9375rem] text-ml-text " +
  "placeholder:text-ml-text-4 transition-colors hover:border-ml-text-3 " +
  "focus:border-ml-accent focus:outline-none focus:ring-2 focus:ring-ml-accent/25 disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(INPUT_CLASS, className)} {...rest} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx(INPUT_CLASS, "ml-scroll resize-y leading-[1.65]", className)} {...rest} />;
  },
);

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(INPUT_CLASS, "cursor-pointer appearance-none bg-[length:0] pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

/**
 * A number field that never lets a broken value reach the model.
 *
 * It keeps the raw string while you type — so backspacing to nothing, or
 * typing "1." on the way to "1.5", does not snap the value out from under the
 * cursor — and only commits a parsed number when one exists. Out-of-range and
 * non-numeric entries surface as an error message rather than silently
 * becoming zero, which is the behaviour that makes calculators lie.
 */
export function NumberInput({
  value, onChange, min, max, step = "any", suffix, prefix, id, disabled, className, "aria-describedby": describedBy,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: number | "any";
  prefix?: string; suffix?: string;
  id?: string; disabled?: boolean; className?: string;
  "aria-describedby"?: string;
}) {
  const [raw, setRaw] = React.useState(String(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setRaw(String(value));
  }, [value, focused]);

  const parsed = Number(raw);
  const empty = raw.trim() === "";
  const invalid = empty || !Number.isFinite(parsed);
  const below = !invalid && min !== undefined && parsed < min;
  const above = !invalid && max !== undefined && parsed > max;
  const error = invalid
    ? "Enter a number."
    : below ? `Cannot be below ${min}.`
    : above ? `Cannot be above ${max}.`
    : null;

  return (
    <div>
      <div className={cx("relative flex items-center", className)}>
        {prefix ? <span className="ml-mono pointer-events-none absolute left-3 text-[0.875rem] text-ml-text-4">{prefix}</span> : null}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className={cx(
            INPUT_CLASS, "ml-num tabular-nums",
            prefix && "pl-7", suffix && "pr-10",
            error && "border-ml-negative focus:border-ml-negative focus:ring-ml-negative/25",
          )}
          value={raw}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            // On the way out, settle on something valid so the model is never
            // left holding the last good value while the box shows nonsense.
            if (invalid) { setRaw(String(value)); return; }
            const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
            setRaw(String(clamped));
            if (clamped !== value) onChange(clamped);
          }}
          onChange={(e) => {
            setRaw(e.target.value);
            const next = Number(e.target.value);
            if (e.target.value.trim() !== "" && Number.isFinite(next)
              && !(min !== undefined && next < min) && !(max !== undefined && next > max)) {
              onChange(next);
            }
          }}
        />
        {suffix ? <span className="pointer-events-none absolute right-3 text-[0.8125rem] text-ml-text-4">{suffix}</span> : null}
      </div>
      {error ? <p role="alert" className="ml-small mt-1 text-ml-negative">{error}</p> : null}
    </div>
  );
}

/** A slider and a number box driving one value, which is how a lab bench works. */
export function SliderField({
  label, value, onChange, min, max, step, prefix, suffix, hint, format,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
  prefix?: string; suffix?: string; hint?: string;
  format?: (v: number) => string;
}) {
  const id = React.useId();
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="ml-label text-ml-text-3">{label}</label>
        <span className="ml-num text-[0.8125rem] font-medium text-ml-text">
          {format ? format(value) : `${prefix ?? ""}${value.toLocaleString("en-GB")}${suffix ?? ""}`}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <input
          id={id}
          type="range"
          className="ml-slider flex-1"
          style={{ ["--ml-fill" as string]: `${fill}%` }}
          min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="w-24 shrink-0">
          <NumberInput value={value} onChange={onChange} min={min} max={max} step={step} />
        </div>
      </div>
      {hint ? <p className="ml-small mt-1 text-ml-text-4">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked ? "border-ml-accent bg-ml-accent" : "border-ml-border-strong bg-ml-subtle",
        )}
      >
        <span
          className={cx(
            "block h-4 w-4 rounded-full bg-white shadow-ml-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="ml-small block font-medium text-ml-text">{label}</span>
        {hint ? <span className="ml-small block text-ml-text-4">{hint}</span> : null}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------- Segmented -- */

export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; hint?: string }>; label?: string;
}) {
  return (
    /* Full width on a phone with equal segments, natural width above it. As an
       `inline-flex` it simply overflowed its card at 390px and the last option
       was cut in half. */
    <div role="radiogroup" aria-label={label} className="flex w-full rounded-ml-sm border border-ml-border-strong bg-ml-inset p-0.5 sm:inline-flex sm:w-auto">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 truncate rounded-[6px] px-3 py-1.5 text-[0.8125rem] font-medium transition-colors sm:flex-none",
            value === o.value
              ? "bg-ml-surface text-ml-text shadow-ml-sm"
              : "text-ml-text-3 hover:text-ml-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ MetricCard -- */

export function MetricCard({ label, value, delta, tone = "neutral", hint, provenance }: {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: React.ReactNode;
  tone?: "neutral" | "positive" | "negative";
  hint?: React.ReactNode;
  /** Where the number came from. Shown on every headline figure, deliberately. */
  provenance?: "Calculated" | "Your input" | "Assumption" | "Observed" | "Demo figure";
}) {
  const valueTone = tone === "positive" ? "text-ml-positive" : tone === "negative" ? "text-ml-negative" : "text-ml-text";
  return (
    <div className="rounded-ml-md border border-ml-border bg-ml-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="ml-label text-ml-text-4">{label}</p>
        {provenance ? (
          <span className="ml-label shrink-0 text-[0.625rem] font-medium tracking-wide text-ml-text-4 normal-case">{provenance}</span>
        ) : null}
      </div>
      <p className={cx("ml-num mt-1.5 text-[1.5rem] font-semibold leading-none tracking-[-0.02em]", valueTone)}>{value}</p>
      {delta ? <p className="ml-num ml-small mt-1.5 text-ml-text-3">{delta}</p> : null}
      {hint ? <p className="ml-small mt-1 text-ml-text-4">{hint}</p> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- Table -- */

export function Table({ head, children, caption, className }: {
  head: React.ReactNode[]; children: React.ReactNode; caption?: string; className?: string;
}) {
  return (
    <div className={cx("ml-scroll overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">
        {caption ? <caption className="ml-small pb-2 text-left text-ml-text-4">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-ml-border">
            {head.map((h, i) => (
              <th key={i} scope="col" className={cx("ml-label whitespace-nowrap px-3 py-2 text-ml-text-4", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ml-border">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ numeric, className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cx("px-3 py-2 text-[0.875rem] text-ml-text-2", numeric && "ml-num text-right text-ml-text", className)}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------ Empty/Load -- */

export function EmptyState({ title, body, action, icon }: {
  title: string; body: string; action?: React.ReactNode; icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-ml-lg border border-dashed border-ml-border bg-ml-inset px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-ml-text-4">{icon}</div> : null}
      <p className="ml-h3 text-ml-text">{title}</p>
      <p className="ml-body ml-prose mt-1.5 text-ml-text-3">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-ml-border border-t-ml-accent", className)}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-ml-sm bg-ml-subtle", className)} aria-hidden />;
}

/* ----------------------------------------------------------------- Modal -- */

export function Modal({ open, onClose, title, description, children, footer, wide }: {
  open: boolean; onClose: () => void;
  title: string; description?: string;
  children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-[var(--ml-overlay)]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "ml-fade-in ml-scroll relative max-h-[88vh] w-full overflow-y-auto rounded-t-ml-xl border border-ml-border bg-ml-surface shadow-ml-lg sm:rounded-ml-xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="sticky top-0 z-10 border-b border-ml-border bg-ml-surface px-5 py-4">
          <h2 className="ml-h2 text-ml-text">{title}</h2>
          {description ? <p className="ml-small mt-1 text-ml-text-3">{description}</p> : null}
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="sticky bottom-0 border-t border-ml-border bg-ml-surface px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Formula ---- */

export function Formula({ label, expression, note }: { label: string; expression: string; note?: string }) {
  return (
    <div className="min-w-0">
      <p className="ml-label text-ml-text-4">{label}</p>
      <p className="ml-formula mt-1.5">{expression}</p>
      {note ? <p className="ml-small mt-1.5 text-ml-text-3">{note}</p> : null}
    </div>
  );
}

/* --------------------------------------------------------------- Details -- */

export function Disclosure({ summary, children, defaultOpen }: {
  summary: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-ml-md border border-ml-border bg-ml-surface">
      <summary className="ml-small flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium text-ml-text marker:hidden">
        {summary}
        <span aria-hidden className="text-ml-text-4 transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="border-t border-ml-border px-4 py-3">{children}</div>
    </details>
  );
}
