"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, Star, Wand2 } from "lucide-react";
import type { ModelSpec, ProviderId } from "@/lib/types";
import { AUTO, MODELS, PROVIDERS, getModel } from "@/lib/models";
import { ProviderMark } from "@/components/ui/ProviderMark";
import { useSettings, paramsFor } from "@/lib/store";
import { cn, fuzzyScore } from "@/lib/utils";

export function ModelPicker({
  open,
  onOpenChange,
  value,
  onChange,
  configured,
  align = "start",
  children,
}: {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  value: string;
  onChange: (id: string) => void;
  configured: Record<string, boolean>;
  align?: "start" | "center" | "end";
  children?: React.ReactNode;
}) {
  const { favorites, toggleFavorite, recentModels, keys } = useSettings();
  const [query, setQuery] = React.useState("");
  const auto = value === AUTO;
  const model = getModel(value);

  const available = (m: ModelSpec) => configured[m.provider] || Boolean(keys[m.provider]);

  const results = React.useMemo(() => {
    if (!query.trim()) return null;
    return MODELS.map((m) => ({
      m,
      score: Math.max(
        fuzzyScore(query, m.name),
        fuzzyScore(query, PROVIDERS[m.provider].name) * 0.6,
        fuzzyScore(query, m.blurb) * 0.3,
      ),
    }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.m);
  }, [query]);

  const favModels = MODELS.filter((m) => favorites.includes(m.id));
  const recent = recentModels
    .map((id) => MODELS.find((m) => m.id === id))
    .filter((m): m is ModelSpec => Boolean(m) && !favorites.includes(m!.id))
    .slice(0, 3);

  const row = (m: ModelSpec) => (
    <ModelRow
      key={m.id}
      model={m}
      selected={m.id === value}
      available={available(m)}
      favorite={favorites.includes(m.id)}
      onToggleFavorite={() => toggleFavorite(m.id)}
      onSelect={() => {
        onChange(m.id);
        onOpenChange?.(false);
        setQuery("");
      }}
    />
  );

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        {children ?? (
          <button className="tap flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary transition-colors duration-[var(--dur-fast)] hover:bg-subtle">
            {auto ? "Auto" : model.name}
            <ChevronDown size={13} className="text-tertiary" />
          </button>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={8}
          /* Narrow, like the menu this is modelled on. The old one was
             twenty-six rems of panel carrying three lines per model —
             a name, a sentence, and a row of numbers about context
             windows and dollars per million. Almost nobody choosing a
             model is choosing on price in the second before they type,
             and the numbers are still in Settings for the times they
             are. What is left is the question the menu is for: which
             one answers this. */
          className="z-50 w-[17.5rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-md glass border border-line shadow-lg anim-menu"
        >
          {/* Eleven models is more than a list you scan and fewer than a
              catalogue, so the filter is a line rather than a field: no
              border, no box, just somewhere to start typing. */}
          <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-1.5">
            <Search size={12} className="shrink-0 text-tertiary" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models"
              aria-label="Search models"
              className="w-full bg-transparent text-[0.8125rem] text-primary outline-none placeholder:text-tertiary"
            />
          </div>

          <div className="max-h-[19rem] overflow-y-auto p-1">
            {results ? (
              results.length ? (
                results.map(row)
              ) : (
                <p className="px-3 py-6 text-center text-xs text-tertiary">No model matches that.</p>
              )
            ) : (
              <>
                {/* First, and on its own, because it is not one of the models —
                    it is the choice not to choose, which is the right answer
                    for most people most of the time. The person asking is the
                    one least equipped to know whether this request wants the
                    long-context model or the fast one. */}
                <button
                  onClick={() => {
                    onChange(AUTO);
                    onOpenChange?.(false);
                  }}
                  className={cn(
                    "tap focus-inset flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors duration-[var(--dur-fast)] hover:bg-subtle",
                    auto && "bg-accent-subtle",
                  )}
                >
                  <Wand2 size={13} className="shrink-0 text-[var(--accent-2)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.8125rem] font-medium leading-tight text-primary">Auto</span>
                    <span className="block truncate text-tiny text-tertiary">Reads the request and picks</span>
                  </span>
                  {auto && <Check size={13} className="shrink-0 text-accent" />}
                </button>

                {favModels.length > 0 && <Section label="Starred">{favModels.map(row)}</Section>}
                {recent.length > 0 && <Section label="Recent">{recent.map(row)}</Section>}
                {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => {
                  const shown = new Set([...favModels, ...recent].map((m) => m.id));
                  const list = MODELS.filter((m) => m.provider === p && !shown.has(m.id));
                  if (!list.length) return null;
                  return (
                    <Section key={p} label={PROVIDERS[p].name}>
                      {list.map(row)}
                    </Section>
                  );
                })}
              </>
            )}
          </div>

          {/* How hard it thinks, where the model is chosen rather than two
              screens away in Settings. Only for the models it means
              anything for, and only when one is actually selected: on Auto
              the effort is decided per message from the request. */}
          {!auto && model.reasoning && <EffortRow modelId={value} />}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-1">
      <h3 className="px-2 pb-0.5 pt-1.5 text-tiny font-medium text-tertiary">{label}</h3>
      {children}
    </section>
  );
}

function ModelRow({
  model: m,
  selected,
  available,
  favorite,
  onSelect,
  onToggleFavorite,
}: {
  model: ModelSpec;
  selected: boolean;
  available: boolean;
  favorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      className={cn(
        "tap group flex w-full items-center gap-2 rounded-sm px-2 py-1.5 transition-colors duration-[var(--dur-fast)]",
        selected ? "bg-accent-subtle" : "hover:bg-subtle",
        // Unavailable models are dimmed with a reason, never hidden: hiding
        // makes the app look like it lacks the model.
        !available && "opacity-45",
      )}
    >
      <ProviderMark provider={m.provider} size={13} />
      <button onClick={onSelect} className="focus-inset min-w-0 flex-1 rounded-md text-left">
        <span className="block truncate text-[0.8125rem] font-medium leading-tight text-primary">{m.name}</span>
        {/* One line, and it is the one that answers "which of these do I
            want": what the model is for. The capability icons that used to
            sit beside the name said the same thing in symbols nobody hovers,
            and the row of prices below it answered a question nobody was
            asking yet. */}
        <span className="block truncate text-tiny text-tertiary">
          {/* The first sentence of the blurb, not all of it. "Deepest
              reasoning. Best for hard problems and long code." is two
              answers to the question, and in a menu this narrow the second
              one arrives as an ellipsis. The rest is in Settings. */}
          {available ? m.blurb.split(/(?<=\.)\s/)[0].replace(/\.$/, "") : "No key for this provider yet"}
        </span>
      </button>
      <button
        onClick={onToggleFavorite}
        aria-label={favorite ? `Unstar ${m.name}` : `Star ${m.name}`}
        data-visible={favorite || undefined}
        className="ctl reveal flex [--ctl:1.5rem] shrink-0 items-center justify-center rounded-sm text-tertiary hover:bg-canvas hover:text-primary"
      >
        <Star size={11} className={cn(favorite && "fill-current text-warning")} />
      </button>
      {selected && <Check size={13} className="shrink-0 text-accent" />}
    </div>
  );
}

/**
 * How hard this model thinks, set where it is chosen.
 *
 * It lived in Settings, behind a tab, next to the temperature — which is
 * where you put something people configure once. Effort is not that: it is
 * the difference between an answer in two seconds and a better one in
 * twenty, and the moment anybody wants to change it is the moment they are
 * looking at the model.
 */
function EffortRow({ modelId }: { modelId: string }) {
  const setParams = useSettings((s) => s.setParams);
  const current = paramsFor(modelId).reasoningEffort ?? "medium";
  const options: { id: "low" | "medium" | "high"; label: string }[] = [
    { id: "low", label: "Quick" },
    { id: "medium", label: "Normal" },
    { id: "high", label: "Hard" },
  ];
  return (
    <div className="flex items-center gap-2 border-t border-line px-2.5 py-1.5">
      <span className="text-tiny text-tertiary">Thinks</span>
      <div role="radiogroup" aria-label="How hard it thinks" className="ml-auto inline-flex rounded-md border border-line-strong bg-canvas p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={current === o.id}
            onClick={() => setParams(modelId, { reasoningEffort: o.id })}
            className={cn(
              "tap inline-flex items-center rounded-xs px-1.5 py-0.5 text-tiny transition-colors duration-[var(--dur-fast)]",
              current === o.id ? "bg-surface font-medium text-primary shadow-sm" : "text-secondary hover:text-primary",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
