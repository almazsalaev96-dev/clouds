"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Download, ExternalLink, Eye, EyeOff, Plus, Trash2, Upload, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import type { ProviderId } from "@/lib/types";
import { PROVIDERS, formatCost, getModel } from "@/lib/models";
import { addMemory, addRoutine, allMemories, createStyle, db, deleteAllData, deleteMemory, deleteRoutine, deleteStyle, forgetAll, forgetTurns } from "@/lib/db";
import { nextDueAt, scheduleLine } from "@/lib/routines";
import { ENOUGH, TOO_MANY } from "@/lib/decide";
import { AUTO_STYLE } from "@/lib/register";
import { BUILT_IN_STYLES } from "@/lib/styles";
import { offerUndo } from "@/lib/undo";
import {
  backupCounts, buildBackup, downloadBackup, parseBackup, restoreBackup, say, BackupError,
} from "@/lib/backup";
import { useSettings, paramsFor, DEFAULT_PARAMS, forgetLocalStorage } from "@/lib/store";
import { PRESETS, engineOf, getPreset, profileOf, resolveCast, shortName } from "@/lib/presets";
import { does } from "./ModelPicker";
import { useReturnFocus } from "@/lib/hooks/useReturnFocus";
import { cn } from "@/lib/utils";
import { GROUPS, RULES, rulesCount } from "@/lib/rules";
import { Button, ConfirmInline, Kbd } from "@/components/ui/primitives";
import { SHORTCUT_GROUPS } from "@/components/ShortcutsOverlay";

type Tab = "keys" | "appearance" | "model" | "styles" | "memory" | "routines" | "data" | "shortcuts" | "privacy" | "rules";

const TABS: { id: Tab; label: string }[] = [
  { id: "keys", label: "API keys" },
  { id: "appearance", label: "Appearance" },
  { id: "model", label: "Model" },
  { id: "rules", label: "Rules" },
  { id: "styles", label: "Styles" },
  { id: "memory", label: "Memory" },
  { id: "routines", label: "Routines" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "data", label: "Data" },
  { id: "privacy", label: "Privacy" },
];

export function Settings({
  open,
  onOpenChange,
  configured,
  initialTab = "keys",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  configured: Record<string, boolean>;
  initialTab?: Tab;
}) {
  const [tab, setTab] = React.useState<Tab>(initialTab);
  React.useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);
  const returnFocus = useReturnFocus(open);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--bg-overlay)] anim-scrim" />
        <Dialog.Content
          onCloseAutoFocus={returnFocus}
          /* Two shapes. Wide, a window with the pages down its left side.
             Narrow — under 40rem, which is every phone — the same window
             at 44rem wide was cut off at the screen's edge with its heading
             and half of every field outside it, so there it is the whole
             screen with the pages as a strip across the top that scrolls
             sideways, and the fields get the full width under it. */
          className={cn(
            "fixed z-50 flex overflow-hidden glass border border-line shadow-lg anim-modal",
            "inset-0 flex-col rounded-none",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[34rem] sm:max-h-[calc(100vh-3rem)] sm:w-[44rem] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:flex-row sm:rounded-xl",
          )}
        >
          <nav
            aria-label="Settings pages"
            className={cn(
              "flex shrink-0 gap-0.5 border-line bg-subtle p-2",
              "safe-top h-14 flex-row items-center overflow-x-auto border-b pe-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "sm:h-auto sm:items-stretch",
              "sm:w-40 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:pe-2",
            )}
          >
            <Dialog.Title className="px-2 py-2 text-sm font-medium text-primary max-sm:sr-only">Settings</Dialog.Title>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-[var(--dur-fast)] max-sm:min-h-9",
                  tab === t.id ? "bg-field font-medium text-primary" : "text-secondary hover:text-primary",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {tab === "keys" && <KeysPanel configured={configured} />}
            {tab === "appearance" && <AppearancePanel />}
            {tab === "model" && <ModelPanel configured={configured} />}
            {tab === "rules" && <RulesPanel />}
            {tab === "styles" && <StylesPanel />}
            {tab === "memory" && <MemoryPanel />}
            {tab === "routines" && <RoutinesPanel />}
            {tab === "shortcuts" && <ShortcutsPanel />}
            {tab === "data" && <DataPanel />}
            {tab === "privacy" && <PrivacyPanel />}
          </div>

          <Dialog.Close
            aria-label="Close settings"
            className="ctl absolute right-3 top-[0.875rem] sm:top-3 flex [--ctl:1.75rem] items-center justify-center rounded-md text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
          >
            <X size={15} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* --------------------------------------------------------------- rules ---- */

/**
 * What it must and must not do, everywhere. Each preset is one sentence a
 * person would say to a tutor, as a switch; the box under them is for the
 * rest. A count in the composer says how many are in force, because a rule
 * nobody can see being applied is a rule they will forget they set.
 */
function RulesPanel() {
  const s = useSettings();
  const on = s.rules ?? [];
  const count = rulesCount(on, s.systemPrompt);
  return (
    <Panel
      title="Rules"
      description={`What it must and must not do, in every room and every answer. ${count === 0 ? "None set yet." : count === 1 ? "One rule is in force." : `${count} rules are in force.`}`}
    >
      {GROUPS.map((g) => (
        <Field key={g.id} label={g.label}>
          <div className="divide-y divide-line rounded-lg border border-line bg-surface">
            {RULES.filter((r) => r.group === g.id).map((r) => {
              const isOn = on.includes(r.id);
              return (
                <label key={r.id} className="tap flex cursor-pointer items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-primary">{r.label}</span>
                    <span className="block text-xs text-tertiary">{r.blurb}</span>
                  </span>
                  <button
                    role="switch"
                    aria-checked={isOn}
                    aria-label={r.label}
                    onClick={() => s.toggleRule(r.id)}
                    className={cn(
                      "focus-inset relative h-6 w-10 shrink-0 rounded-full transition-colors duration-[var(--dur-fast)]",
                      isOn ? "bg-[var(--cta)]" : "bg-[var(--border-strong)]",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[var(--shadow-sm)] transition-transform duration-[var(--dur-fast)]",
                        isOn ? "translate-x-[1.125rem]" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </label>
              );
            })}
          </div>
        </Field>
      ))}

      <Field label="Your own rules" hint="One a line. Specific and action-shaped works — “always show the units”, not “be helpful”. These go at the start of every conversation, after the presets.">
        <textarea
          value={s.systemPrompt}
          onChange={(e) => s.setSystemPrompt(e.target.value)}
          rows={4}
          aria-label="Your own rules"
          placeholder={"Always show the units.\nCall the exam board AQA, not the board."}
          className="w-full resize-y rounded-md border border-line-strong bg-field px-2.5 py-2 text-sm text-primary outline-none focus:border-accent"
        />
      </Field>
    </Panel>
  );
}

/* ------------------------------------------------------------- privacy ---- */

/**
 * What is stored, what leaves, and how to be rid of it.
 *
 * An app that says "nothing leaves this browser" on its front page owes the
 * reader one screen that spells out exactly what that means, including the
 * part where it is not absolute: a question you ask a model does leave, to
 * the company whose key you added, because that is what asking costs. Saying
 * only the comfortable half is how "private" becomes marketing.
 */
function PrivacyPanel() {
  return (
    <Panel title="Privacy" description="The whole of it, in the order that matters.">
      <div className="space-y-3 text-sm">
        <Line title="Stored in this browser">
          Conversations, pages, cards, canvases, projects, memories, settings and what
          answers have cost. They live in this browser&rsquo;s own database, on this
          device. No account, no server of ours holds a copy, and clearing your browser
          data clears them — which is why Data has a backup.
        </Line>
        <Line title="What leaves, and where it goes">
          The question you ask, the thread it belongs to, and any material the answer
          needs. It goes to the provider whose key you added, through this app&rsquo;s own
          forwarding route, which reads nothing and keeps nothing. What that company then
          does with it is their policy, not ours — it is worth reading once.
          With Research on, the same company also runs a web search on its own servers
          for that turn; the search terms are the model&rsquo;s reading of your question,
          and every page it drew on is listed under the answer.
          When the model uses one of the rooms — saves cards, looks in your notes —
          the tool runs in this browser and only what it answers goes back to that
          same company as part of the turn: the passages a search found, the count
          of cards saved. Nothing is sent that the turn did not already involve.
        </Line>
        <Line title="Your keys">
          A key you paste is kept in this browser and sent only to its own provider. It is
          never written into a backup file, never logged, and never shown in full again
          once saved.
        </Line>
        <Line title="What we never do">
          No analytics, no tracking, no telemetry, no advertising, and nothing of yours is
          used to train anything.
        </Line>
        <Line title="Getting rid of it">
          Data &rarr; Delete everything removes the lot from this browser in one press.
          Clearing site data in your browser does the same. Anything already sent to a
          provider is theirs to delete, on their terms.
        </Line>
      </div>
    </Panel>
  );
}

function Line({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="mb-1 text-sm font-medium text-primary">{title}</p>
      <p className="text-xs leading-relaxed text-secondary">{children}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- keys ---- */

function KeysPanel({ configured }: { configured: Record<string, boolean> }) {
  return (
    <Panel
      title="API keys"
      description="Keys set on the server never reach this browser. A key you paste here is stored in this browser only, and is sent to your own server, which forwards it to the provider — never to anyone else."
    >
      <div className="space-y-2">
        {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => (
          <KeyRow key={p} provider={p} serverConfigured={Boolean(configured[p])} />
        ))}
      </div>
      <p className="mt-4 text-xs text-tertiary">
        To set a key on the server instead, put it in{" "}
        <code className="rounded-sm bg-subtle px-1">.env.local</code> and restart.
      </p>
    </Panel>
  );
}

/**
 * A stored key, shown as much as it takes to recognise it.
 *
 * The prefix says which provider issued it and the last four say which key
 * it is, which is everything a person needs to answer "is the right one in
 * here?". The middle is the part that would let somebody else use it, and
 * it never comes back on screen.
 */
function maskKey(key: string): string {
  if (!key) return "Not set";
  if (key.length <= 12) return "•".repeat(Math.max(4, key.length));
  return `${key.slice(0, 6)}${"•".repeat(10)}${key.slice(-4)}`;
}

function KeyRow({ provider, serverConfigured }: { provider: ProviderId; serverConfigured: boolean }) {
  const { keys, setKey } = useSettings();
  const [reveal, setReveal] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  /* Typing starts open when there is nothing stored, and a stored key stays
     masked until somebody asks to replace it. */
  const [editing, setEditing] = React.useState(() => !(useSettings.getState().keys[provider] ?? ""));
  const [result, setResult] = React.useState<{ ok: boolean; message?: string; ms?: number } | null>(null);
  const meta = PROVIDERS[provider];
  const value = keys[provider] ?? "";

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, key: value }),
      });
      setResult(await res.json());
    } catch {
      setResult({ ok: false, message: "Couldn't reach the server." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            serverConfigured || value ? "bg-success" : "bg-[var(--border-strong)]",
          )}
        />
        <span className="text-sm font-medium text-primary">{meta.name}</span>
        <span className="text-xs text-tertiary">
          {serverConfigured ? "Set on the server" : value ? "Stored in this browser" : "Not set"}
        </span>
        <a
          href={meta.keyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-xs text-accent hover:underline"
        >
          Get a key
          <ExternalLink size={11} />
        </a>
      </div>

      {serverConfigured ? (
        <p className="text-xs text-secondary">
          This provider is already configured server-side. Nothing to do here.
        </p>
      ) : editing ? (
        /* While it is being typed, and only then, the key can be read back.
           This is the one moment it is worth showing: somebody who has just
           pasted forty characters out of a dashboard needs to see that all
           forty arrived. */
        <div className="flex items-center gap-1.5">
          <div className="flex h-8 flex-1 items-center gap-1.5 rounded-md border border-line-strong bg-field px-2 focus-within:border-accent">
            <input
              autoFocus
              type={reveal ? "text" : "password"}
              value={value}
              onChange={(e) => {
                setKey(provider, e.target.value.trim());
                setResult(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && value) setEditing(false);
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder={meta.keyPrefix ? `${meta.keyPrefix}…` : "Paste your key"}
              aria-label={`${meta.name} API key`}
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent font-mono text-xs text-primary outline-none placeholder:font-sans placeholder:text-tertiary"
            />
            <button
              onClick={() => setReveal((r) => !r)}
              aria-label={reveal ? "Hide key" : "Show key"}
              className="text-tertiary hover:text-primary"
            >
              {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setReveal(false);
              setEditing(false);
            }}
            disabled={!value}
          >
            Done
          </Button>
        </div>
      ) : (
        /* Saved. The secret is never drawn in full again: enough of it to
           tell one key from another, and nothing a camera over your shoulder
           could use. Whoever owns it has it where they got it. */
        <div className="flex flex-wrap items-center gap-1.5">
          <code className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-line bg-inset px-2 font-mono text-xs text-secondary">
            {maskKey(value)}
          </code>
          <Button size="sm" onClick={test} disabled={testing}>
            {testing ? <span className="think-orb" aria-hidden /> : "Test"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setResult(null);
              setEditing(true);
            }}
          >
            Replace
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setKey(provider, "");
              setResult(null);
              setEditing(true);
            }}
          >
            Remove
          </Button>
        </div>
      )}

      {result && (
        <p className={cn("mt-2 flex items-center gap-1.5 text-xs anim-fade", result.ok ? "text-success" : "text-danger")}>
          {result.ok ? (
            <>
              <Check size={12} /> Working — {result.ms}ms round trip.
            </>
          ) : (
            result.message
          )}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- appearance ---- */

function AppearancePanel() {
  const s = useSettings();
  return (
    <Panel title="Appearance">
      <Field label="Your name" hint="For the greeting. It stays in this browser and is never sent to a model.">
        <input
          value={s.name}
          onChange={(e) => s.set({ name: e.target.value, nameAsked: true })}
          placeholder="What should Armi call you?"
          aria-label="Your name"
          className="focus-inset h-9 w-full max-w-xs rounded-md border border-line bg-field px-3 text-sm text-primary outline-none placeholder:text-tertiary"
        />
      </Field>
      <Field label="Theme">
        <Segmented
          value={s.theme}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
          onChange={(v) => s.setTheme(v as typeof s.theme)}
        />
      </Field>
      <Field label="Tone" hint="The undertone of the greys. Cool is the app's blue; warm is a paper that is easier on the eyes over a long session.">
        <Segmented
          value={s.tone ?? "cool"}
          options={[
            { value: "cool", label: "Cool" },
            { value: "warm", label: "Warm" },
          ]}
          onChange={(v) => s.setTone(v as "cool" | "warm")}
        />
      </Field>

      <Field label="Thinking" hint="When a model shows its reasoning, whether it opens by itself under the answer or waits as a line to press.">
        <Segmented
          value={s.thinkingOpen ? "open" : "closed"}
          options={[
            { value: "closed", label: "A line to press" },
            { value: "open", label: "Open by itself" },
          ]}
          onChange={(v) => s.setThinkingOpen(v === "open")}
        />
      </Field>

      <Field label="Text size" hint="Every letter in the app, in steps. The layout keeps its proportions.">
        <Segmented
          value={s.textSize ?? "normal"}
          options={[
            { value: "small", label: "Small" },
            { value: "normal", label: "Normal" },
            { value: "large", label: "Large" },
            { value: "larger", label: "Larger" },
          ]}
          onChange={(v) => s.set({ textSize: v as typeof s.textSize })}
        />
      </Field>
      <Field label="Density" hint="Scales every spacing value in the app.">
        <Segmented
          value={s.density}
          options={[
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Comfortable" },
            { value: "spacious", label: "Spacious" },
          ]}
          onChange={(v) => s.setDensity(v as typeof s.density)}
        />
      </Field>
      <Field label="Code blocks">
        <div className="space-y-2">
          <Toggle
            checked={s.showLineNumbers}
            onChange={(v) => s.set({ showLineNumbers: v })}
            label="Always show line numbers"
            hint="Otherwise they appear past 12 lines."
          />
          <Toggle checked={s.wrapCode} onChange={(v) => s.set({ wrapCode: v })} label="Wrap long lines by default" />
        </div>
      </Field>
      <Field label="Sending">
        <Toggle
          checked={s.sendOnEnter}
          onChange={(v) => s.set({ sendOnEnter: v })}
          label="Enter sends the message"
          hint="When off, Enter adds a newline and ⌘↵ sends."
        />
      </Field>
    </Panel>
  );
}

/**
 * A prompt on a schedule.
 *
 * The three flagships run theirs on a server; this app has none that knows
 * anybody, so a routine runs the next time Armi is open after its time —
 * said on the panel rather than hidden. For "every weekday morning, ask me
 * what is due" that is the moment it was wanted.
 */
const DAY_PICKS: { label: string; days: number[] }[] = [
  { label: "Every day", days: [] },
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Weekends", days: [0, 6] },
];

function RoutinesPanel() {
  const routines = useLiveQuery(() => db.routines.orderBy("createdAt").toArray(), [], []);
  const [prompt, setPrompt] = React.useState("");
  const [time, setTime] = React.useState("07:30");
  const [days, setDays] = React.useState<number[]>([1, 2, 3, 4, 5]);
  const now = Date.now();

  const add = async () => {
    const text = prompt.trim();
    const [h, m] = time.split(":").map(Number);
    if (!text || !Number.isFinite(h) || !Number.isFinite(m)) return;
    await addRoutine({ prompt: text, hour: h, minute: m, days });
    setPrompt("");
  };

  return (
    <Panel
      title="Routines"
      description="A prompt that runs on a schedule, as a new conversation. Nothing runs on a server: a routine runs the next time Armi is open after its time, and once for each time it was due."
    >
      <Field label="New routine">
        <div className="space-y-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
            placeholder="Quiz me on what is due today, one question at a time"
            aria-label="What to send"
            className="focus-inset h-9 w-full rounded-md border border-line bg-field px-3 text-sm text-primary outline-none placeholder:text-tertiary"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="At what time"
              className="focus-inset h-9 rounded-md border border-line bg-field px-2.5 text-sm text-primary outline-none tnum"
            />
            <Segmented
              value={DAY_PICKS.find((d) => d.days.join(",") === days.join(","))?.label ?? "Every day"}
              options={DAY_PICKS.map((d) => ({ value: d.label, label: d.label }))}
              onChange={(v) => setDays(DAY_PICKS.find((d) => d.label === v)?.days ?? [])}
            />
            <Button size="sm" variant="secondary" disabled={!prompt.trim()} onClick={() => void add()}>
              <Plus size={14} />
              Add
            </Button>
          </div>
        </div>
      </Field>

      <Field label={routines.length ? `Routines · ${routines.length}` : "Routines"}>
        {routines.length === 0 ? (
          <p className="text-sm text-tertiary">None yet. A routine is a message you would otherwise type at the same time every day.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)] rounded-md border border-line" aria-label="Routines">
            {routines.map((r) => (
              <li key={r.id} className="flex items-start gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-primary [overflow-wrap:anywhere]">{r.prompt}</p>
                  <p className="mt-0.5 text-xs text-tertiary tnum">
                    {scheduleLine(r)}
                    {r.enabled ? ` · next ${new Date(nextDueAt(r, now)).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : " · paused"}
                    {r.lastRan ? ` · last ran ${new Date(r.lastRan).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={r.enabled}
                  aria-label={`${r.enabled ? "Pause" : "Resume"} "${r.prompt.slice(0, 40)}"`}
                  onClick={() => void db.routines.update(r.id, { enabled: !r.enabled })}
                  className={cn(
                    "mt-1 flex h-[18px] w-8 shrink-0 items-center rounded-full p-0.5 transition-colors duration-[var(--dur-fast)]",
                    r.enabled ? "bg-[var(--accent-fill)]" : "bg-[var(--border-strong)]",
                  )}
                >
                  <span className={cn("block size-3.5 rounded-full bg-white shadow transition-transform duration-[var(--dur-fast)]", r.enabled && "translate-x-3.5")} />
                </button>
                <button
                  aria-label={`Delete "${r.prompt.slice(0, 40)}"`}
                  onClick={async () => offerUndo(r.prompt, await deleteRoutine(r.id))}
                  className="ctl flex [--ctl:1.75rem] shrink-0 items-center justify-center rounded-sm text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-[var(--danger)]"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>
    </Panel>
  );
}

/* --------------------------------------------------------------- model ---- */

function ModelPanel({ configured }: { configured: Record<string, boolean> }) {
  const s = useSettings();
  /* Sampling settings belong to the engine, not to the tactic. Somebody on
     Nova who drags the temperature is setting it for whatever Nova runs on —
     writing it under "nova" would store a number nothing ever reads, which is
     worse than not offering the control at all. Said in the description
     rather than left to be discovered. */
  const preset = getPreset(s.modelId);
  const engineId = engineOf(s.modelId, { configured, keys: s.keys });
  const model = getModel(engineId);
  const params = paramsFor(engineId);

  return (
    <Panel
      title="Model"
      description={
        preset
          ? `You are on ${preset.name}. These are remembered against whichever engine it is running today, which is why they can look different after a key is added.`
          : `These settings are remembered per model.`
      }
    >
      <Field
        label="The Armi models"
        hint="Each one is a cast: two or three models, from different companies wherever your keys allow it, with a different job each. Armi trains no models of its own — it decides which to call, what to ask each of them, and what to do when they disagree. Which companies those are is set by the keys on the Keys tab. Prices are for a turn of ordinary size, summed over every model it calls."
      >
        <ArmiTable configured={configured} />
      </Field>

      <Field label={`Temperature — ${params.temperature.toFixed(2)}`} hint="Lower is more predictable.">
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={params.temperature}
          onChange={(e) => s.setParams(engineId, { temperature: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
      </Field>

      <Field label={`Max output — ${params.maxTokens.toLocaleString()} tokens`}>
        <input
          type="range"
          min={1024}
          max={model.maxOutput}
          step={1024}
          value={Math.min(params.maxTokens, model.maxOutput)}
          onChange={(e) => s.setParams(engineId, { maxTokens: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
      </Field>

      {model.reasoning && (
        <Field label="Reasoning effort" hint="More thinking costs more and takes longer.">
          <Segmented
            value={params.reasoningEffort ?? "medium"}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
            onChange={(v) => s.setParams(engineId, { reasoningEffort: v as "low" | "medium" | "high" })}
          />
        </Field>
      )}

      <button
        onClick={() => s.setParams(engineId, DEFAULT_PARAMS)}
        className="text-xs text-accent hover:underline"
      >
        Reset {preset ? preset.short : "Armi"} to defaults
      </button>
    </Panel>
  );
}

/* ----------------------------------------------------------- shortcuts ---- */

function ShortcutsPanel() {
  return (
    <Panel title="Keyboard shortcuts" description="Press ? anywhere to see this without opening settings.">
      {SHORTCUT_GROUPS.map(({ group, items }) => (
        <section key={group}>
          <h3 className="mb-1 text-xs font-medium text-tertiary">{group}</h3>
          <dl className="divide-y divide-[var(--border-subtle)]">
            {items.map(([label, keys]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-2">
                <dt className="text-sm text-secondary">{label}</dt>
                <dd className="shrink-0">
                  <Kbd keys={keys} always />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Panel>
  );
}

/* ---------------------------------------------------------------- data ---- */

/**
 * What this month has cost, and what everything has.
 *
 * An app whose whole arrangement is "you bring the keys" owes the person a
 * running total, and it had one only per conversation, in a place nobody
 * looks. Summed from the answers themselves — each carries what it cost —
 * so a conversation that ran across a month boundary is counted on the
 * days it happened. By Armi model, because that is the thing the person
 * chose and the only name this app puts on screen.
 */
function Spend() {
  /* Read once, when the panel opens, one row at a time. A live query over
     every message would re-read the whole table — pictures and all — on
     each rating or reply while the dialog was open, for a number that
     changes by a fraction of a cent. */
  const [rows, setRows] = React.useState<{ any: boolean; month: number; ever: number; by: [string, number][] } | null>(null);
  React.useEffect(() => {
    let live = true;
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let month = 0, ever = 0, any = false;
    const by = new Map<string, number>();
    void db.messages
      .each((m) => {
        if (!m.usage) return;
        any = true;
        const usd = m.usage.costUsd ?? 0;
        ever += usd;
        if (m.createdAt >= from) {
          month += usd;
          /* An answer with no Armi model on it — a Compare column, an
             engine picked by hand — is counted, and not put under a name
             it did not have. */
          const who = m.presetId ? shortName(m.presetId) : "Other";
          by.set(who, (by.get(who) ?? 0) + usd);
        }
      })
      .then(() => live && setRows({ any, month, ever, by: [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6) }));
    return () => {
      live = false;
    };
  }, []);
  if (!rows?.any) return null;
  return (
    <Field label="What it has cost" hint="Chat answers, added up at the providers' published prices as they came in. The quieter calls — briefs, checks, cards, summaries — are not counted, and your bill is the provider's.">
      <div className="rounded-md border border-line bg-field px-3 py-2.5 text-sm">
        <p className="flex items-baseline justify-between">
          <span className="text-primary">This month</span>
          <span className="tnum font-medium text-primary">{formatCost(rows.month)}</span>
        </p>
        {rows.by.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 border-t border-line pt-1.5" aria-label="This month, by model">
            {rows.by.map(([who, usd]) => (
              <li key={who} className="flex items-baseline justify-between text-xs text-tertiary">
                <span>{who}</span>
                <span className="tnum">{formatCost(usd)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 flex items-baseline justify-between border-t border-line pt-1.5 text-xs text-tertiary">
          <span>Since the start</span>
          <span className="tnum">{formatCost(rows.ever)}</span>
        </p>
      </div>
    </Field>
  );
}

function DataPanel() {
  const [confirming, setConfirming] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [busy, setBusy] = React.useState<false | "save" | "load">(false);
  const [said, setSaid] = React.useState<string | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const save = async () => {
    setBusy("save");
    setProblem(null);
    try {
      const b = await buildBackup();
      downloadBackup(b);
      setSaid(`Saved ${say(backupCounts(b))}.`);
    } catch {
      setProblem("Could not read the database to write a backup.");
    } finally {
      setBusy(false);
    }
  };

  const load = async (file: File) => {
    setBusy("load");
    setProblem(null);
    setSaid(null);
    try {
      const result = await restoreBackup(parseBackup(await file.text()));
      setSaid(
        result.added
          ? `Brought back ${say(result.per)}.${result.skipped ? ` ${result.skipped} were already here.` : ""}`
          : "Everything in that file was already here.",
      );
      /* Only when something actually arrived. A live query cannot notice a
         bulk write it did not make, so the app has to be told — but reloading
         to show you nothing is a jolt for no reason, and it took the sentence
         explaining why nothing happened with it. */
      if (result.added) setTimeout(() => location.reload(), 1400);
    } catch (e) {
      setProblem(e instanceof BackupError ? e.message : "Could not read that file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Data"
      description="Everything lives in this browser's IndexedDB and is never uploaded anywhere. Which also means clearing your browser data clears it — so take a copy."
    >
      <Spend />

      {/* The half of "nothing leaves this browser" that nobody says out loud
          is "and nothing survives it". This is the answer to that. */}
      <div className="mb-3 rounded-lg border border-line p-3">
        <p className="mb-2 text-sm text-primary">Save a copy</p>
        <p className="mb-3 text-xs text-secondary">
          One file with every conversation, page, canvas, project and style in it — plain JSON, readable
          in any text editor, so it outlives this app. Your API keys are deliberately left out: a backup
          ends up in Downloads and gets synced, and a key in it is a key on somebody else&rsquo;s machine.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void save()} disabled={Boolean(busy)}>
            <Download size={13} />
            {busy === "save" ? "Saving…" : "Save a copy"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            aria-label="Choose a backup to bring back"
            tabIndex={-1}
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) await load(f);
            }}
          />
          <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
            <Upload size={13} />
            {busy === "load" ? "Reading…" : "Bring one back"}
          </Button>
        </div>
        {said && <p className="mt-2 text-xs text-success">{said}</p>}
        {problem && <p className="mt-2 text-xs text-danger">{problem}</p>}
        <p className="mt-2 text-xs text-tertiary">
          Bringing one back adds what is missing and never overwrites what is already here.
        </p>
      </div>

      <div className="rounded-lg border border-line p-3">
        <p className="mb-2 text-sm text-primary">Delete everything</p>
        <p className="mb-3 text-xs text-secondary">
          Every conversation, page, canvas, project and style, and your settings and API keys with
          them, gone from this browser. This cannot be undone, and it genuinely deletes — nothing is
          kept anywhere else.
        </p>
        {done ? (
          <p className="text-xs text-success">Deleted.</p>
        ) : confirming ? (
          <ConfirmInline
            question="Delete everything?"
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              await deleteAllData();
              /* The database is only half of what this app stores. The other
                 half is localStorage — the settings, which hold the API keys,
                 and every unsent draft — and it was surviving a button whose
                 own text promised that nothing is kept anywhere else. */
              forgetLocalStorage();
              setConfirming(false);
              setDone(true);
              setTimeout(() => location.reload(), 600);
            }}
          />
        ) : (
          <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
            Delete all data
          </Button>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------- pieces ---- */

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="anim-fade">
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      {description && <p className="mt-1 max-w-prose text-sm text-secondary">{description}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </div>
  );
}

/**
 * What each Armi model actually is, at length.
 *
 * The picker has room for a name, a line and the model that writes; this is
 * where the rest of it lives — the whole cast, what a turn costs, and two or
 * three of the requests each one is the right answer to. A person choosing
 * between thirteen named things deserves somewhere that spells out what the
 * names mean, and a menu is the wrong place to put it.
 */
function ArmiTable({ configured }: { configured: Record<string, boolean> }) {
  const keys = useSettings((s) => s.keys);
  const where = { configured, keys };
  return (
    <ul className="space-y-2.5">
      {PRESETS.map((p) => {
        const cast = resolveCast(p.id, where)!;
        const profile = profileOf(cast);
        return (
          <li key={p.id} className="rounded-lg border border-line bg-field px-3 py-2.5">
            <p className="text-sm font-medium text-primary">
              {p.name} <span className="font-normal text-tertiary">— {p.tagline}</span>
            </p>
            <p className="mt-0.5 text-xs text-secondary">{p.blurb}</p>
            <p className="mt-1.5 text-xs text-tertiary">
              <span className="text-secondary">one writes</span>
              {cast.parts.map((x, i) => (
                <React.Fragment key={`${x.role}${i}`}>
                  {" · "}
                  <span className="text-secondary">one</span> {does(x)}
                  {x.sameCompany && <span className="text-warning"> (sibling)</span>}
                </React.Fragment>
              ))}
            </p>
            <p className="mt-0.5 text-xs text-faint tnum">
              {profile.calls} model{profile.calls === 1 ? "" : "s"} a turn · about {formatCost(profile.usd)} an answer
            </p>
            {cast.short && <p className="mt-0.5 text-xs text-warning">{cast.short}</p>}
            <p className="mt-1 text-xs italic text-faint">
              {p.examples.map((e) => `“${e}”`).join("  ·  ")}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-primary">{label}</p>
      {hint && <p className="mb-1.5 text-xs text-tertiary">{hint}</p>}
      {children}
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" className="inline-flex rounded-md border border-line-strong bg-field p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "tap inline-flex items-center rounded-xs px-2.5 py-1 text-xs transition-colors duration-[var(--dur-fast)]",
            value === o.value ? "bg-surface font-medium text-primary shadow-sm" : "text-secondary hover:text-primary",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 flex h-[18px] w-8 shrink-0 items-center rounded-full p-0.5 transition-colors duration-[var(--dur-fast)]",
          /* The fill, not the text colour.
             --accent is a *foreground* in dark — #aab9ff, a pale periwinkle —
             so a white knob riding on it sat at 1.89:1 and the switch's ON
             state all but disappeared, under the 3:1 floor a control state
             has to clear. --accent-fill is the same colour in light, so this
             changes nothing there and fixes the one theme it was wrong in. */
          checked ? "bg-[var(--accent-fill)]" : "bg-[var(--border-strong)]",
        )}
      >
        <span
          className={cn(
            "size-[14px] rounded-full bg-white transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)]",
            checked && "translate-x-3.5",
          )}
        />
      </button>
      <span>
        <span className="block text-sm text-primary">{label}</span>
        {hint && <span className="block text-xs text-tertiary">{hint}</span>}
      </span>
    </label>
  );
}

/* ---------------------------------------------------------------- memory -- */

/**
 * Everything the app knows about you, in full, each line deletable.
 *
 * The list is the feature. ChatGPT's memory earned its reputation the day
 * people could open it and read what had been kept; a memory you cannot
 * see is a rumour about you. So this shows every line, says where each came
 * from in time, lets you add one in your own words, and lets you switch the
 * whole thing off without losing the list.
 */
function MemoryPanel() {
  const settings = useSettings();
  const memories = useLiveQuery(allMemories, [], []);
  const [draft, setDraft] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    await addMemory(text);
    setDraft("");
  };

  return (
    <Panel
      title="Memory"
      description="Things you asked to be remembered, kept on this device and used in every conversation that is not temporary. Say “remember that…” in a chat, press Remember on something you said, or write one here."
    >
      <Toggle
        checked={settings.memoryOn}
        onChange={(memoryOn) => settings.set({ memoryOn })}
        label="Use memory"
        hint="Off keeps the list but sends none of it."
      />

      <Toggle
        checked={settings.actionsOn}
        onChange={(actionsOn) => settings.set({ actionsOn })}
        label="Let it use the rooms"
        hint="The model can save cards, write a page, keep a memory, add to a project, look in your notes and past conversations, do sums exactly and check the clock — each one shown under the answer with Undo. Off, it can only answer."
      />

      <Field label="Add something to remember">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
            placeholder="I teach year 9 maths"
            aria-label="Something to remember"
            className="focus-inset h-9 min-w-0 flex-1 rounded-md border border-line bg-field px-3 text-sm text-primary outline-none placeholder:text-tertiary"
          />
          <Button size="sm" variant="secondary" disabled={!draft.trim()} onClick={() => void add()}>
            <Plus size={14} />
            Add
          </Button>
        </div>
      </Field>

      <Learned />

      <Field label={memories.length ? `Remembered · ${memories.length}` : "Remembered"}>
        {memories.length === 0 ? (
          <p className="text-sm text-tertiary">Nothing yet. Memory holds only what you put in it.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)] rounded-md border border-line" aria-label="Memories">
            {memories.map((m) => (
              <li key={m.id} className="flex items-start gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-primary [overflow-wrap:anywhere]">{m.text}</p>
                  <p className="mt-0.5 text-xs text-tertiary tnum">{new Date(m.createdAt).toLocaleDateString()}</p>
                </div>
                <button
                  aria-label={`Forget "${m.text.slice(0, 40)}"`}
                  onClick={async () => offerUndo(m.text, await deleteMemory(m.id))}
                  className="ctl flex [--ctl:1.75rem] shrink-0 items-center justify-center rounded-sm text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-[var(--danger)]"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {memories.length > 1 && (
          <div className="mt-2">
            {confirming ? (
              <ConfirmInline
                question="Forget everything?"
                onConfirm={async () => {
                  setConfirming(false);
                  offerUndo(`${memories.length} memories`, await forgetAll());
                }}
                onCancel={() => setConfirming(false)}
              />
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
                Forget all
              </Button>
            )}
          </div>
        )}
      </Field>
    </Panel>
  );
}

/**
 * What the app has worked out about its own answers.
 *
 * The other half of memory, and the half nobody else shows you. Every turn
 * is recorded with what was decided about it — what kind of job it was
 * read as, which model answered, whether the answer needed checking — and
 * then with what you did about the answer. A thumbs-down, a regenerate, a
 * Tighten and a rewritten question all mean the same thing: that answer was
 * not worth having. When enough of them pile up for one kind of work on one
 * model, the next answer of that shape is checked by a second model without
 * anyone asking for it.
 *
 * Shown here because a system that quietly grades your work and changes its
 * behaviour on the result should be able to say what it thinks it knows.
 */
function Learned() {
  const turns = useLiveQuery(() => db.turns.orderBy("at").reverse().limit(400).toArray(), [], []);
  const rows = React.useMemo(() => {
    /* Grouped by the Armi model, which is the thing the person chose and the
       only name on this screen. The rule underneath is keyed on the engine —
       it is an engine that is bad at a kind of work — and that key is
       untouched; this is what the record says, not what it does. */
    const by = new Map<string, { kind: string; who: string; n: number; bad: number }>();
    for (const t of turns) {
      const who = t.presetId ?? t.modelId;
      const key = `${t.kind}\u0000${who}`;
      const row = by.get(key) ?? { kind: t.kind, who, n: 0, bad: 0 };
      row.n += 1;
      if (t.outcome && t.outcome !== "good") row.bad += 1;
      by.set(key, row);
    }
    return [...by.values()].sort((a, b) => b.n - a.n).slice(0, 8);
  }, [turns]);

  if (!turns.length) return null;

  return (
    <Field
      label={`What the app has learned · ${turns.length}`}
      hint={`Kept on this device. After ${ENOUGH} answers of one kind from one model, ${Math.round(TOO_MANY * 100)}% of them going wrong earns the next one a check by a second model.`}
    >
      <ul className="divide-y divide-[var(--border-subtle)] rounded-md border border-line" aria-label="What the app has learned">
        {rows.map((r) => {
          const checking = r.n >= ENOUGH && r.bad / r.n >= TOO_MANY;
          return (
            <li key={`${r.kind}-${r.who}`} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-primary">
                {r.kind} · <span className="text-secondary">{shortName(r.who)}</span>
              </span>
              <span className="tnum shrink-0 text-xs text-tertiary">
                {r.bad} of {r.n} needed another go
              </span>
              {checking && (
                <span className="shrink-0 rounded-full bg-accent-subtle px-2 py-0.5 text-xs text-accent">checking</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-2">
        <Button size="sm" variant="ghost" onClick={async () => offerUndo(`${turns.length} decisions`, await forgetTurns())}>
          Forget what it learned
        </Button>
      </div>
    </Field>
  );
}

/* ---------------------------------------------------------------- styles -- */

/**
 * Built-ins are shown but not editable, and that is the point of showing them:
 * a style you can read is a style you can copy, and "start from Explanatory and
 * change two lines" is how most people would rather write one than from a blank
 * box titled Instructions.
 */
function StylesPanel() {
  const settings = useSettings();
  const custom = useLiveQuery(() => db.styles.orderBy("updatedAt").toArray(), [], []);
  const [editing, setEditing] = React.useState<string | null>(null);

  const startFrom = async (name: string, instructions: string) => {
    const style = await createStyle({ name, instructions, blurb: "Yours." });
    setEditing(style.id);
  };

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-sm font-medium text-primary">Response styles</h3>
        <p className="mt-1 text-xs text-tertiary">
          A style changes the shape of an answer — how long, how formal, how much it
          explains — and nothing about what the model knows. On Auto the app reads
          each request and picks one, and says which on the answer. Choosing one
          yourself turns that off for the thread.
        </p>
      </section>

      <section className="space-y-1.5">
        <p className="eyebrow text-faint">Chosen for you</p>
        <button
          onClick={() => settings.setStyle(AUTO_STYLE)}
          className={cn(
            "focus-inset w-full rounded-lg border p-3 text-left transition-colors duration-[var(--dur-fast)]",
            settings.styleId === AUTO_STYLE ? "border-accent bg-accent-subtle" : "border-line bg-surface hover:border-line-strong",
          )}
        >
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-primary">Auto</span>
            <span className="text-xs text-tertiary">Read from the request, and from you.</span>
            {settings.styleId === AUTO_STYLE && <Check size={13} className="ml-auto shrink-0 text-accent" />}
          </span>
          <span className="mt-1 block text-xs text-tertiary">
            Short questions get short answers; “why does it…” gets the reasoning; a letter
            for somebody else gets written properly. Saying twice that an answer was too
            long is taken as an instruction.
          </span>
        </button>

        <p className="eyebrow pt-2 text-faint">Built in</p>
        {BUILT_IN_STYLES.map((st) => (
          <div key={st.id} className="rounded-lg border border-line bg-surface p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-primary">{st.name}</span>
              <span className="text-xs text-tertiary">{st.blurb}</span>
              {st.instructions && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => void startFrom(`${st.name} (mine)`, st.instructions)}
                >
                  Start from this
                </Button>
              )}
            </div>
            {st.instructions && (
              <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-secondary">
                {st.instructions}
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="eyebrow text-faint">Yours</p>
          <Button
            size="sm"
            variant="primary"
            className="ml-auto"
            onClick={() => void startFrom("New style", "")}
          >
            Write a style
          </Button>
        </div>

        {custom.length === 0 ? (
          <p className="text-xs text-tertiary">None yet.</p>
        ) : (
          custom.map((st) => (
            <div key={st.id} className="rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <input
                  value={st.name}
                  onChange={(e) =>
                    void db.styles.update(st.id, { name: e.target.value, updatedAt: Date.now() })
                  }
                  aria-label="Style name"
                  className="focus-inset min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-medium text-primary outline-none"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(editing === st.id ? null : st.id)}
                >
                  {editing === st.id ? "Done" : "Edit"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${st.name}`}
                  onClick={async () => {
                    // A chat pointing at a deleted style would answer in no
                    // style at all and never say why, so the default takes over.
                    if (settings.styleId === st.id) settings.setStyle("normal");
                    offerUndo(st.name, await deleteStyle(st.id));
                  }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
              {editing === st.id ? (
                <>
                  <input
                    value={st.blurb}
                    onChange={(e) =>
                      void db.styles.update(st.id, { blurb: e.target.value, updatedAt: Date.now() })
                    }
                    placeholder="One line, for the picker"
                    aria-label="Style description"
                    className="focus-inset mt-2 w-full rounded-md border border-line bg-field px-2 py-1.5 text-xs text-primary outline-none placeholder:text-tertiary"
                  />
                  <textarea
                    value={st.instructions}
                    onChange={(e) =>
                      void db.styles.update(st.id, {
                        instructions: e.target.value,
                        updatedAt: Date.now(),
                      })
                    }
                    rows={6}
                    placeholder="Write it as instructions to the model: “Answer in as few words as the question takes. No preamble.”"
                    aria-label="Style instructions"
                    className="focus-inset mt-1.5 w-full resize-y rounded-md border border-line bg-field px-2 py-1.5 text-xs leading-relaxed text-primary outline-none placeholder:text-tertiary"
                  />
                </>
              ) : (
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-secondary">
                  {st.instructions || "No instructions yet."}
                </p>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
