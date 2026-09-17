"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Aperture, Check, ChevronDown, Compass, Eye, Feather, GraduationCap, Hammer, Languages,
  Network, Scale, Search, Sigma, Wand2, Zap,
} from "lucide-react";
import type { ModelSpec } from "@/lib/types";
import { AUTO, MODELS, formatCost, getModel } from "@/lib/models";
import {
  PRESETS, SEAT_NAMES, getPreset, profileOf, resolveCast, type Cast, type Player, type Preset,
} from "@/lib/presets";
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
  compass: Compass,
  zap: Zap,
  sigma: Sigma,
  network: Network,
  aperture: Aperture,
  hammer: Hammer,
  eye: Eye,
  "graduation-cap": GraduationCap,
  languages: Languages,
  feather: Feather,
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
  const Icon = ICONS[getPreset(id)?.icon ?? ""] ?? Compass;
  return <Icon size={size} className={className} />;
}

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
  const { keys } = useSettings();
  const [query, setQuery] = React.useState("");
  const auto = value === AUTO;
  const where = React.useMemo(() => ({ configured, keys }), [configured, keys]);
  /* What is actually selected: one of Armi's own models, or an engine
     directly. `getModel` answers the app default for an id it does not know,
     so asking it about "nova" would draw the default engine's name under
     Nova's row. */
  const preset = getPreset(value);
  const cast = preset ? resolveCast(value, where)! : null;
  const model = getModel(cast ? cast.answer.modelId : value);

  const available = (m: ModelSpec) => configured[m.provider] || Boolean(keys[m.provider]);
  /* A tactic needs a key — any key. Which one it lands on is its own affair. */
  const anyKey = MODELS.some(available);

  const results = React.useMemo(() => {
    if (!query.trim()) return null;
    /* Searched by name, by what it is for, and by the words in its blurb —
       "code", "translate", "exam" all find the tactic built for them.
       Engine names are matched too, at the bottom of the scale and never
       drawn: somebody who arrives knowing the name of a model from the
       news should land on the Armi model that runs on it rather than on
       "No model matches that", and learn the name we do use. Matching a
       word is not displaying it. */
    return PRESETS.map((x) => ({
      x,
      score: Math.max(
        fuzzyScore(query, x.name),
        fuzzyScore(query, x.short) * 0.9,
        fuzzyScore(query, x.tagline) * 0.5,
        fuzzyScore(query, x.blurb) * 0.3,
        Math.max(0, ...x.examples.map((e) => fuzzyScore(query, e) * 0.25)),
        Math.max(0, ...x.engines.map((id) => fuzzyScore(query, getModel(id).name) * 0.2)),
      ),
    }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.x);
  }, [query]);

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

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        {children ?? (
          <button className="tap flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary transition-colors duration-[var(--dur-fast)] hover:bg-subtle">
            {auto ? "Auto" : (preset?.short ?? model.name)}
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
                results.map(armiRow)
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
                    <span className="block truncate text-tiny text-tertiary">ARMI Core reads the request and picks</span>
                  </span>
                  {auto && <Check size={13} className="shrink-0 text-accent" />}
                </button>

                {/* Armi's own, and only Armi's own.
                    The menu used to end with every engine this app can call,
                    listed by its maker's name — which made the product's own
                    models look like a layer over somebody else's catalogue.
                    They are the catalogue now. Which engines a tactic rents
                    is not a thing to choose from a menu: it depends on the
                    keys in this browser, it changes when one is added, and it
                    is answered in Settings for anybody who wants to know. */}
                <Section label="Armi models">
                  {PRESETS.filter((x) => x.group === "everyday").map(armiRow)}
                </Section>
                {/* The specialists, under their own heading. Eleven rows in
                    one list is a catalogue; five for anything and six for one
                    thing is a menu. */}
                <Section label="For a particular job">
                  {PRESETS.filter((x) => x.group === "job").map(armiRow)}
                </Section>
              </>
            )}
          </div>

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

/**
 * One of Armi's own, with what it is for underneath.
 *
 * The second line used to name the engine the row was renting, which was the
 * honest thing to do while the menu below it was a catalogue of engines. It
 * is not one any more: an Armi model is a cast of two or three, the row has
 * space for one name, and the name of the first of them is not a truer
 * description of what answers than "two models deep" is. Who is in the cast
 * is under the menu, in full, for whichever row is selected; which companies
 * those turn out to be is a fact about the keys in this browser and is in
 * Settings. What the row must never do is quietly claim a laboratory this app
 * does not have — hence the warning when one key means the cast is siblings.
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
        aria-label={`${preset.name} — ${preset.tagline}, ${cast.parts.length + 1} models a turn`}
      >
        <span className="block truncate text-[0.8125rem] font-medium leading-tight text-primary">
          {preset.name}
        </span>
        <span className="block truncate text-tiny text-tertiary">
          {!available ? (
            "No key configured yet"
          ) : (
            <>
              {preset.tagline}
              {/* Three words for what the line under the menu says in full.
                  This used to be a two-way choice — "one company" or "needs a
                  second key" — which had no way to say the third thing that
                  can now happen: every seat filled, none of them sharing with
                  the writer, and still fewer labs than seats. */}
              {cast.short && (
                <span className="text-warning">
                  {" · "}
                  {cast.parts.some((x) => x.sameCompany)
                    ? "one company"
                    : cast.parts.length < preset.cast.length
                      ? "needs a second key"
                      : "some seats share a company"}
                </span>
              )}
            </>
          )}
        </span>
      </button>
      {selected && <Check size={13} className="shrink-0 text-accent" />}
    </div>
  );
}

/**
 * What each member of the cast is there to do, in the words a person uses.
 *
 * A council seat says which half of the question it took rather than "sits
 * on the council", because "one on strategy · one on the reasoning" is the
 * whole design in one line and the other phrasing is a committee.
 */
export function does(p: Player): string {
  if (p.role === "council") return SEAT_NAMES[p.angle ?? "strategy"];
  return p.role === "brief" ? "briefs it first" : p.role === "check" ? "checks it after" : "answers it as well";
}
const job = (p: Player) =>
  p.role === "council" ? `work ${SEAT_NAMES[p.angle ?? "strategy"]}` : does(p).replace(/s\b/, "");

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
  const p = profileOf(cast);
  return (
    <div className="border-t border-line px-2.5 py-1.5">
      {/* What the cast *does*, which is the part that makes this an Armi
          model rather than a label. Which companies it rents to do it is a
          fact about this browser's keys — it changes when a key is added and
          nothing the reader did changed — so it lives one hover away and, in
          full, in Settings, where every tactic is listed against its engines.
          Nothing here claims to have built a model. */}
      <p className="text-tiny leading-5 text-tertiary">
        <span className="text-secondary">one writes</span>
        {cast.parts.map((x, i) => (
          <React.Fragment key={`${x.role}${i}`}>
            {" · "}
            <span className="text-secondary">one</span> {does(x)}
            {/* Which kind of second opinion this is. A sibling is still a
                second reading and is still worth having; it is not the
                independent one, and the row that says "checks it after"
                would otherwise be claiming it was. */}
            {x.sameCompany && <span className="text-warning"> (sibling)</span>}
          </React.Fragment>
        ))}
      </p>
      {/* The number a person can actually use. Price per million tokens is
          the number nobody can: it asks them to know how long their own
          question is, and on a tactic that calls three models it asks them
          to do it three times and add up. */}
      <p className="text-tiny leading-5 text-faint tnum">
        {p.calls} model{p.calls === 1 ? "" : "s"} a turn · about {formatCost(p.usd)} an answer
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
