"use client";

import * as React from "react";
import { Check, Copy, Cpu, Download, ExternalLink, RefreshCw } from "lucide-react";
import { useSettings } from "@/lib/store";
import { LOCAL_SERVERS, SUGGESTED, discover, localId, nameOf, normaliseUrl } from "@/lib/local";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Free AI on this computer: set up, connected, and chosen, in one page.
 *
 * Three steps, in the order a person does them — install a runner, let this
 * site talk to it, download a model — and then a Connect that lists what is
 * installed with a "Use" on each. The download list is a short one on
 * purpose: seven models that cover a laptop to a workstation, each with
 * what it needs and what it is good at, rather than a catalogue.
 */
export function LocalPanel() {
  const local = useSettings((s) => s.local);
  const set = useSettings((s) => s.set);
  const modelId = useSettings((s) => s.modelId);
  const setModel = useSettings((s) => s.setModel);
  const [url, setUrl] = React.useState(local?.url ?? LOCAL_SERVERS[0].url);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const origin = typeof location !== "undefined" ? location.origin : "";

  const connect = async () => {
    setBusy(true);
    setMsg(null);
    const got = await discover(url, origin);
    setBusy(false);
    if (got.ok) {
      set({ local: { url: got.url, models: got.models, checkedAt: Date.now() } });
      setUrl(got.url);
      setMsg({ ok: true, text: `Connected — ${got.models.length} model${got.models.length === 1 ? "" : "s"} on this computer.` });
    } else {
      setMsg({ ok: false, text: got.message });
    }
  };

  return (
    <div className="anim-fade">
      <h2 className="text-lg font-semibold text-primary">Free AI on your computer</h2>
      <p className="mt-1 max-w-prose text-sm text-secondary">
        Download a free open model and run it on your own computer. Answers never leave your computer, cost nothing and need no key.
        Big models need a strong computer; small ones run on most laptops.
      </p>

      <ol className="mt-4 space-y-4 text-sm">
        <Step n={1} title="Install Ollama (or LM Studio)">
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-primary hover:bg-subtle" href="https://ollama.com/download" target="_blank" rel="noreferrer">
              <Download size={13} aria-hidden /> Get Ollama <ExternalLink size={11} aria-hidden className="text-tertiary" />
            </a>
            <a className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-primary hover:bg-subtle" href="https://lmstudio.ai" target="_blank" rel="noreferrer">
              <Download size={13} aria-hidden /> Get LM Studio <ExternalLink size={11} aria-hidden className="text-tertiary" />
            </a>
          </div>
        </Step>

        <Step n={2} title="Let this site use it">
          <p className="text-secondary">Ollama only answers websites it is told about. Set this, then quit and reopen Ollama:</p>
          <CodeLine text={`OLLAMA_ORIGINS=${origin || "https://your-armi-address"}`} label="Copy the Ollama setting" />
          <details className="mt-1.5 text-xs text-tertiary">
            <summary className="cursor-pointer select-none text-secondary">How, on my computer</summary>
            <ul className="mt-1.5 space-y-1.5">
              <li><b className="text-secondary">Windows:</b> Start → search “environment variables” → Edit environment variables for your account → New → name <code>OLLAMA_ORIGINS</code>, value <code>{origin}</code>. Then restart Ollama from the Start menu.</li>
              <li><b className="text-secondary">Mac:</b> in Terminal: <code>launchctl setenv OLLAMA_ORIGINS &quot;{origin}&quot;</code>, then quit and reopen Ollama.</li>
              <li><b className="text-secondary">Linux:</b> <code>sudo systemctl edit ollama.service</code>, add <code>Environment=&quot;OLLAMA_ORIGINS={origin}&quot;</code> under [Service], then <code>sudo systemctl restart ollama</code>.</li>
              <li><b className="text-secondary">LM Studio:</b> Developer tab → start the server → switch on “Enable CORS”.</li>
            </ul>
          </details>
        </Step>

        <Step n={3} title="Download a model">
          <p className="text-secondary">Pick one your computer can hold, and run its command in a terminal:</p>
          <ul className="mt-2 space-y-2" aria-label="Free models to download">
            {SUGGESTED.map((m) => (
              <li key={m.tag} className="rounded-xl border border-line bg-surface px-3 py-2.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-primary">{m.name}</span>
                  <span className="text-xs text-tertiary tnum">{m.size} download · needs {m.memory}</span>
                </div>
                <p className="mt-0.5 text-xs text-secondary">{m.good}</p>
                <CodeLine text={`ollama pull ${m.tag}`} label={`Copy the command for ${m.name}`} />
              </li>
            ))}
          </ul>
        </Step>

        <Step n={4} title="Connect">
          <div role="radiogroup" aria-label="Which program" className="flex flex-wrap gap-1.5">
            {LOCAL_SERVERS.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={normaliseUrl(url) === s.url}
                onClick={() => setUrl(s.url)}
                className={cn("btn-touch focus-ring rounded-full border px-3 py-1 text-xs", normaliseUrl(url) === s.url ? "border-transparent bg-cta text-cta-fg" : "border-line text-secondary hover:bg-subtle")}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void connect(); }}
              aria-label="Server address"
              spellCheck={false}
              className="field min-w-0 flex-1 rounded-lg border border-line bg-field px-3 py-1.5 font-mono text-xs text-primary outline-none focus:border-[var(--accent)]"
            />
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void connect()}>
              <RefreshCw size={13} className={cn(busy && "animate-spin")} aria-hidden />
              {busy ? "Connecting…" : local ? "Check again" : "Connect"}
            </Button>
          </div>
          {msg && (
            <p role="status" className={cn("mt-2 text-xs", msg.ok ? "text-secondary" : "text-[var(--danger)]")}>{msg.text}</p>
          )}
          {local && local.models.length > 0 && (
            <ul className="mt-3 divide-y divide-[var(--border-subtle)] rounded-xl border border-line" aria-label="Models on this computer">
              {local.models.map((m) => {
                const id = localId(m.name);
                const on = modelId === id;
                return (
                  <li key={m.name} className="flex items-center gap-3 px-3 py-2">
                    <Cpu size={14} className="shrink-0 text-tertiary" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-primary">{nameOf(m.name)}</span>
                      <span className="block text-tiny text-tertiary">
                        {[m.vision && "sees pictures", m.tools && "uses tools", m.thinks && "thinks first"].filter(Boolean).join(" · ") || "text"}
                      </span>
                    </span>
                    <Button size="sm" variant={on ? "secondary" : "ghost"} onClick={() => setModel(id)} aria-label={`Use ${nameOf(m.name)}`} aria-pressed={on}>
                      {on ? <><Check size={13} aria-hidden /> In use</> : "Use"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {local && (
            <button onClick={() => { set({ local: null }); setMsg(null); }} className="mt-2 text-xs text-tertiary underline-offset-2 hover:text-primary hover:underline">
              Disconnect
            </button>
          )}
        </Step>
      </ol>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-primary tnum" aria-hidden>{n}</span>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium text-primary">{title}</h3>
        <div className="mt-1.5">{children}</div>
      </div>
    </li>
  );
}

function CodeLine({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-subtle px-2.5 py-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-primary">{text}</code>
      <button
        onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {}); }}
        aria-label={label}
        className="ctl focus-ring flex [--ctl:1.75rem] shrink-0 items-center justify-center rounded-md text-tertiary hover:bg-surface hover:text-primary"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
}
