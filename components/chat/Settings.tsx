"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Download, ExternalLink, Eye, EyeOff, Trash2, Upload, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import type { ProviderId } from "@/lib/types";
import { PROVIDERS, getModel } from "@/lib/models";
import { createStyle, db, deleteAllData, deleteStyle } from "@/lib/db";
import { BUILT_IN_STYLES } from "@/lib/styles";
import { offerUndo } from "@/lib/undo";
import {
  backupCounts, buildBackup, downloadBackup, parseBackup, restoreBackup, say, BackupError,
} from "@/lib/backup";
import { useSettings, paramsFor, DEFAULT_PARAMS, forgetLocalStorage } from "@/lib/store";
import { useReturnFocus } from "@/lib/hooks/useReturnFocus";
import { cn } from "@/lib/utils";
import { Button, ConfirmInline, Kbd } from "@/components/ui/primitives";
import { SHORTCUT_GROUPS } from "@/components/ShortcutsOverlay";

type Tab = "keys" | "appearance" | "model" | "styles" | "data" | "shortcuts";

const TABS: { id: Tab; label: string }[] = [
  { id: "keys", label: "API keys" },
  { id: "appearance", label: "Appearance" },
  { id: "model", label: "Model" },
  { id: "styles", label: "Styles" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "data", label: "Data" },
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--bg-overlay)] anim-fade" />
        <Dialog.Content
          onCloseAutoFocus={returnFocus}
          className="fixed left-1/2 top-1/2 z-50 flex h-[34rem] max-h-[calc(100vh-3rem)] w-[44rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl glass border border-line shadow-lg anim-pop"
        >
          <nav className="flex w-40 shrink-0 flex-col gap-0.5 border-r border-line bg-subtle p-2">
            <Dialog.Title className="px-2 py-2 text-sm font-medium text-primary">Settings</Dialog.Title>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-[var(--dur-fast)]",
                  tab === t.id ? "bg-canvas font-medium text-primary" : "text-secondary hover:text-primary",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto p-5">
            {tab === "keys" && <KeysPanel configured={configured} />}
            {tab === "appearance" && <AppearancePanel />}
            {tab === "model" && <ModelPanel />}
            {tab === "styles" && <StylesPanel />}
            {tab === "shortcuts" && <ShortcutsPanel />}
            {tab === "data" && <DataPanel />}
          </div>

          <Dialog.Close
            aria-label="Close settings"
            className="ctl absolute right-3 top-3 flex [--ctl:1.75rem] items-center justify-center rounded-md text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
          >
            <X size={15} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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

function KeyRow({ provider, serverConfigured }: { provider: ProviderId; serverConfigured: boolean }) {
  const { keys, setKey } = useSettings();
  const [reveal, setReveal] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
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
      ) : (
        <div className="flex items-center gap-1.5">
          <div className="flex h-8 flex-1 items-center gap-1.5 rounded-md border border-line-strong bg-canvas px-2 focus-within:border-accent">
            <input
              type={reveal ? "text" : "password"}
              value={value}
              onChange={(e) => {
                setKey(provider, e.target.value.trim());
                setResult(null);
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
          <Button size="sm" onClick={test} disabled={!value || testing}>
            {testing ? <span className="think-orb" aria-hidden /> : "Test"}
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
          className="focus-inset h-9 w-full max-w-xs rounded-md border border-line bg-canvas px-3 text-sm text-primary outline-none placeholder:text-tertiary"
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

/* --------------------------------------------------------------- model ---- */

function ModelPanel() {
  const s = useSettings();
  const model = getModel(s.modelId);
  const params = paramsFor(s.modelId);

  return (
    <Panel title="Model" description={`These settings are remembered per model. You're editing ${model.name}.`}>
      <Field label="System prompt" hint="Sent at the start of every conversation.">
        <textarea
          value={s.systemPrompt}
          onChange={(e) => s.setSystemPrompt(e.target.value)}
          rows={4}
          placeholder="e.g. Be concise. Show code before explaining it."
          className="w-full resize-y rounded-md border border-line-strong bg-canvas px-2.5 py-2 text-sm text-primary outline-none focus:border-accent"
        />
      </Field>

      <Field label={`Temperature — ${params.temperature.toFixed(2)}`} hint="Lower is more predictable.">
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={params.temperature}
          onChange={(e) => s.setParams(s.modelId, { temperature: Number(e.target.value) })}
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
          onChange={(e) => s.setParams(s.modelId, { maxTokens: Number(e.target.value) })}
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
            onChange={(v) => s.setParams(s.modelId, { reasoningEffort: v as "low" | "medium" | "high" })}
          />
        </Field>
      )}

      <button
        onClick={() => s.setParams(s.modelId, DEFAULT_PARAMS)}
        className="text-xs text-accent hover:underline"
      >
        Reset {model.name} to defaults
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
                  <Kbd keys={keys} />
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
    <div role="radiogroup" className="inline-flex rounded-md border border-line-strong bg-canvas p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "tap inline-flex items-center rounded-[6px] px-2.5 py-1 text-xs transition-colors duration-[var(--dur-fast)]",
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
          explains — and nothing about what the model knows. Pick one per chat from the
          composer.
        </p>
      </section>

      <section className="space-y-1.5">
        <p className="eyebrow text-faint">Built in</p>
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
                    className="focus-inset mt-2 w-full rounded-md border border-line bg-canvas px-2 py-1.5 text-xs text-primary outline-none placeholder:text-tertiary"
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
                    className="focus-inset mt-1.5 w-full resize-y rounded-md border border-line bg-canvas px-2 py-1.5 text-xs leading-relaxed text-primary outline-none placeholder:text-tertiary"
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
