"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Check, ChevronDown, GraduationCap, Hammer, Layers, Orbit, Scale, Search, Star,
  Telescope, Wand2, Zap,
} from "lucide-react";
import type { ModelSpec, ProviderId } from "@/lib/types";
import { AUTO, MODELS, PROVIDERS, getModel } from "@/lib/models";
import { PRESETS, getPreset, resolveCast, type Cast, type Preset, type Role } from "@/lib/presets";
import { ProviderMark } from "@/components/ui/ProviderMark";
import { useSettings, paramsFor } from "@/lib/store";
import { cn, fuzzyScore } from "@/lib/utils";

/**
 * A face for each tactic.
 *
 * Held here rather than in `lib/presets.ts` because that file is pure and
 * testable and has no business importing React. The preset carries a name;
 * this turns it into something.
 */
const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  orbit: Orbit,
  zap: Zap,
  telescope: Telescope,
  layers: Layers,
  hammer: Hammer,
  "graduation-cap": GraduationCap,
  scale: Scale,
};

/** The face of one Armi model, wherever it is named outside this menu. */
export function PresetIcon({
  id,
  size = 13,
  className,
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[getPreset(id)?.icon ?? ""] ?? Orbit;
  return <Icon size={size} className={className} />;
}

export function ModelPicker({
  open,
  onOpenChange,
  value,
  onChange,
  configured,
  align = "start",
  presets = true,
  children,
}: {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  value: string;
  onChange: (id: string) => void;
  configured: Record<string, boolean>;
  align?: "start" | "center" | "end";
  /**
   * Whether Armi's own models are on offer.
   *
   * Off where the caller needs a plain engine and nothing else: the revise
   * picker hands its choice to a one-shot call that runs no tactic, so a row
   * promising a second opinion there would promise something that cannot
   * happen.
   */
  presets?: boolean;
  children?: React.ReactNode;
}) {
  const { favorites, toggleFavorite, recentModels, keys } = useSettings();
  const [query, setQuery] = React.useState("");
  const auto = value === AUTO;
  const where = React.useMemo(() => ({ configured, keys }), [configured, keys]);
  /* What is actually selected: one of Armi's own models, or an engine
     directly. `getModel` answers the app default for an id it does not know,
     so asking it about "nova" would draw Sonnet's name under Nova's row. */
  const preset = presets ? getPreset(value) : null;
  const cast = preset ? resolveCast(value, where)! : null;
  const model = getModel(cast ? cast.answer.modelId : value);

  const available = (m: ModelSpec) => configured[m.provider] || Boolean(keys[m.provider]);
  /* A tactic needs a key — any key. Which one it lands on is its own affair. */
  const anyKey = MODELS.some(available);

  const results = React.useMemo(() => {
    if (!query.trim()) return null;
    const models = MODELS.map((m) => ({
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
    /* Armi's own names are searched too, and the engine's name finds them as
       well: somebody who types "opus" and is offered Orion has learned what
       Orion is, which is the one thing a rename can otherwise cost you. */
    const armi = !presets
      ? []
      : PRESETS.map((p) => ({
          p,
          score: Math.max(
            fuzzyScore(query, p.name),
            fuzzyScore(query, p.tagline) * 0.5,
            fuzzyScore(query, getModel(resolveCast(p.id, where)!.answer.modelId).name) * 0.4,
            fuzzyScore(query, p.blurb) * 0.3,
          ),
        }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((r) => r.p);
    return { models, armi };
  }, [query, presets, where]);

  const favModels = MODELS.filter((m) => favorites.includes(m.id));
  const recent = recentModels
    .map((id) => MODELS.find((m) => m.id === id))
    .filter((m): m is ModelSpec => Boolean(m) && !favorites.includes(m!.id))
    .slice(0, 3);

  const armiRow = (p: Preset) => (
    <PresetRow
      key={p.id}
      preset={p}
      cast={resolveCast(p.id, where)!}
      available={anyKey}
      selected={p.id === value}
      onSelect={() => {
        onChange(p.id);
        onOpenChange?.(false);
        setQuery("");
      }}
    />
  );

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
              results.armi.length || results.models.length ? (
                <>
                  {results.armi.map(armiRow)}
                  {results.models.map(row)}
                </>
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

                {/* Armi's own, which are tactics rather than weights: which
                    engine to run on, how hard to think, how to write, and
                    whether a second company checks the answer. Every row says
                    what it is running on, because an app that renamed other
                    people's models and hid whose they were would be taking
                    credit for work it did not do. */}
                {presets && (
                  <Section label="Armi models">{PRESETS.map(armiRow)}</Section>
                )}

                {favModels.length > 0 && <Section label="Starred">{favModels.map(row)}</Section>}
                {recent.length > 0 && <Section label="Recent">{recent.map(row)}</Section>}
                {presets && (
                  <h3 className="mt-1 border-t border-line px-2 pb-0.5 pt-2 text-tiny font-medium text-tertiary">
                    Or an engine directly
                  </h3>
                )}
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
          {cast && <CastRow cast={cast} />}

          {!auto && model.reasoning && (
            <EffortRow
              /* Stored against what is selected, not against what it resolves
                 to: "Orion thinks hard" is a fact about Orion, and writing it
                 to Opus would change every other tactic that lands there. */
              modelId={value}
              fallback={preset?.effort}
            />
          )}
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
 * One of Armi's own, with the engine it is running on named underneath.
 *
 * The second line is the whole ethic of this feature in eleven words. Astro
 * is Armi's; Claude Sonnet 4.5 is Anthropic's; the row says both, every time,
 * and the person can go and pick the engine directly if they would rather.
 * Rename without the second line and the app is claiming a laboratory it does
 * not have.
 */
function PresetRow({
  preset,
  cast,
  available,
  selected,
  onSelect,
}: {
  preset: Preset;
  cast: Cast;
  available: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const engine = getModel(cast.answer.modelId);
  return (
    <div
      className={cn(
        "tap group flex w-full items-center gap-2 rounded-sm px-2 py-1.5 transition-colors duration-[var(--dur-fast)]",
        selected ? "bg-accent-subtle" : "hover:bg-subtle",
        !available && "opacity-45",
      )}
    >
      <PresetIcon id={preset.id} size={13} className="shrink-0 text-[var(--accent-2)]" />
      <button
        onClick={onSelect}
        className="focus-inset min-w-0 flex-1 rounded-md text-left"
        aria-label={`${preset.name} — ${preset.tagline}, running on ${engine.name}${cast.parts
          .map((p) => ` with ${getModel(p.modelId).name} to ${JOB[p.role]}`)
          .join("")}`}
      >
        <span className="block truncate text-[0.8125rem] font-medium leading-tight text-primary">
          {preset.name}
        </span>
        <span className="block truncate text-tiny text-tertiary">
          {!available ? (
            "No key configured yet"
          ) : (
            <>
              {preset.tagline} · <span className="text-secondary">{engine.short}</span>
              {cast.short && <span className="text-warning"> · needs a second key</span>}
            </>
          )}
        </span>
      </button>
      <span className="shrink-0 text-tertiary" aria-hidden>
        <ProviderMark provider={engine.provider} size={11} />
      </span>
      {selected && <Check size={13} className="shrink-0 text-accent" />}
    </div>
  );
}

/** What each member of the cast is there to do, in the words a person uses. */
const JOB: Record<Role, string> = {
  brief: "brief it first",
  check: "check it after",
  duel: "answer it as well",
};
const DOES: Record<Role, string> = {
  brief: "briefs it first",
  check: "checks it after",
  duel: "answers it as well",
};

/**
 * Who is in the cast, spelled out under the menu.
 *
 * The rows have room for one name and an Armi model is two or three, so the
 * one that is selected says the whole of it here: who writes, who briefs, who
 * checks, and — when there is only one company's key in this browser — which
 * of those cannot happen. A tactic that quietly ran with half its cast would
 * be charging a reputation to a single call.
 */
function CastRow({ cast }: { cast: Cast }) {
  return (
    <div className="border-t border-line px-2.5 py-1.5">
      <p className="text-tiny leading-5 text-tertiary">
        <span className="text-secondary">{getModel(cast.answer.modelId).name}</span> writes
        {cast.parts.map((p) => (
          <React.Fragment key={p.role}>
            {" · "}
            <span className="text-secondary">{getModel(p.modelId).name}</span> {DOES[p.role]}
          </React.Fragment>
        ))}
      </p>
      {cast.short && <p className="text-tiny leading-5 text-warning">{cast.short}</p>}
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
function EffortRow({ modelId, fallback }: { modelId: string; fallback?: "low" | "medium" | "high" }) {
  const setParams = useSettings((s) => s.setParams);
  /* An Armi model arrives with an effort already chosen — it is half of what
     the name means — and the row shows that until somebody overrules it. */
  const current = paramsFor(modelId).reasoningEffort ?? fallback ?? "medium";
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
