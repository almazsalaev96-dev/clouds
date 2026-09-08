"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Eye, Brain, Star, Wrench } from "lucide-react";
import type { ModelSpec, ProviderId } from "@/lib/types";
import { MODELS, PROVIDERS, getModel, formatContext } from "@/lib/models";
import { useSettings } from "@/lib/store";
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
          <button className="flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary transition-colors duration-[var(--dur-fast)] hover:bg-subtle">
            {model.name}
            <ChevronDown size={13} className="text-tertiary" />
          </button>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          className="z-50 w-[26rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line bg-surface shadow-lg anim-pop"
        >
          <div className="border-b border-line px-3 py-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models"
              aria-label="Search models"
              className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-tertiary"
            />
          </div>

          <div className="max-h-[26rem] overflow-y-auto p-1">
            {results ? (
              results.length ? (
                results.map(row)
              ) : (
                <p className="px-3 py-6 text-center text-xs text-tertiary">No model matches that.</p>
              )
            ) : (
              <>
                {favModels.length > 0 && (
                  <Section label="Favorites">{favModels.map(row)}</Section>
                )}
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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-1">
      <h3 className="px-2 pb-0.5 pt-2 text-xs font-medium text-tertiary">{label}</h3>
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
        "group flex w-full items-start gap-2 rounded-md px-2 py-1.5 transition-colors duration-[var(--dur-fast)]",
        selected ? "bg-accent-subtle" : "hover:bg-subtle",
        // Unavailable models are dimmed with a reason, never hidden: hiding
        // makes the app look like it lacks the model.
        !available && "opacity-45",
      )}
    >
      <button onClick={onSelect} className="focus-inset min-w-0 flex-1 rounded-md text-left">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-primary">{m.name}</span>
          {m.vision && <Cap icon={<Eye size={11} />} label="Reads images" />}
          {m.reasoning && <Cap icon={<Brain size={11} />} label="Reasons step by step" />}
          {m.tools && <Cap icon={<Wrench size={11} />} label="Can use tools" />}
          {selected && <Check size={13} className="ml-auto shrink-0 text-accent" />}
        </span>
        <span className="mt-0.5 block truncate text-xs text-secondary">{m.blurb}</span>
        <span className="mt-0.5 flex gap-2 text-xs text-tertiary tnum">
          <span>{formatContext(m.contextWindow)} ctx</span>
          <span>
            ${m.priceIn}/${m.priceOut} per 1M
          </span>
          {!available && <span className="text-warning">No key</span>}
        </span>
      </button>
      <button
        onClick={onToggleFavorite}
        aria-label={favorite ? `Unstar ${m.name}` : `Star ${m.name}`}
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm text-tertiary transition-opacity duration-[var(--dur-fast)] hover:bg-canvas hover:text-primary",
          favorite ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
        )}
      >
        <Star size={12} className={cn(favorite && "fill-current text-warning")} />
      </button>
    </div>
  );
}

function Cap({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span title={label} aria-label={label} className="shrink-0 text-tertiary">
      {icon}
    </span>
  );
}
