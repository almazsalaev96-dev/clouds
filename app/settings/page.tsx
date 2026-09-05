"use client";

/**
 * Settings.
 *
 * Accessibility is not a submenu here: font scale, contrast, motion and
 * dyslexia-friendly typography sit at the top, because a student who cannot
 * read the interface cannot use any of the rest of it.
 *
 * Data controls are equally prominent. Everything a student generates lives in
 * their own browser and can be exported as one file or deleted entirely, and
 * that is stated plainly rather than buried in a policy.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/provider";
import { Card, Callout, ConfirmButton, Stat } from "@/ui/components";
import type { Settings } from "@/store/types";

export default function SettingsPage() {
  const { state, update, ready, exportJson, importJson, reset } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  if (!ready) return <p className="muted small">Loading…</p>;
  const s = state.settings;

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    update((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));

  /**
   * Export.
   *
   * A file download is the right affordance where the page can offer one, but
   * embedded viewers block page-initiated saves outright — the link fires and
   * nothing happens, which is the worst possible outcome for the one control
   * standing between a student and losing a term of work. So the JSON is always
   * also shown for copying, and the copy is what the text points at when the
   * download cannot be trusted to arrive.
   */
  const exportNow = () => {
    const json = exportJson();
    setExported(json);
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lodestar-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Blocked or unsupported. The copy panel below is the path that works.
    }
  };

  const copyExport = async () => {
    const json = exported ?? exportJson();
    setExported(json);
    try {
      await navigator.clipboard.writeText(json);
      setMessage("Export copied to the clipboard. Paste it into a file and keep it somewhere safe.");
    } catch {
      setMessage("Copying was blocked. Select the text below and copy it manually.");
    }
  };

  return (
    <div className="stack loose" style={{ maxWidth: 760 }}>
      <header>
        <p className="eyebrow">Settings</p>
        <h1>Preferences and your data</h1>
      </header>

      <Card title="Reading and accessibility">
        <div className="stack">
          <Toggle3
            label="Theme"
            value={s.theme}
            options={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]}
            onChange={(v) => set("theme", v as Settings["theme"])}
          />
          <div className="field">
            <label htmlFor="fontScale">Text size — {Math.round(s.fontScale * 100)}%</label>
            <input
              id="fontScale"
              type="range"
              min={0.85}
              max={1.5}
              step={0.05}
              value={s.fontScale}
              onChange={(e) => set("fontScale", Number(e.target.value))}
            />
          </div>
          <Check label="High contrast" hint="Stronger borders, no shadows, higher-contrast secondary text." checked={s.highContrast} onChange={(v) => set("highContrast", v)} />
          <Check label="Dyslexia-friendly text" hint="Wider letter and word spacing, taller line height, and the Atkinson Hyperlegible face where available." checked={s.dyslexiaFriendly} onChange={(v) => set("dyslexiaFriendly", v)} />
          <Check label="Reduce motion" hint="Removes transitions and animation. Your system setting is respected automatically; this forces it on." checked={s.reducedMotion} onChange={(v) => set("reducedMotion", v)} />
        </div>
      </Card>

      <Card title="How you study">
        <div className="stack">
          <Check
            label="Ask for confidence before revealing answers"
            hint="Comparing stated confidence against actual accuracy is the only reliable way to detect the gap between feeling fluent and being able to produce. Turning it off removes the calibration analytics."
            checked={s.confidenceRating}
            onChange={(v) => set("confidenceRating", v)}
          />
          <Check
            label="Interleave topics within a session"
            hint="Mixing topics feels harder and produces better exam performance, because the exam itself interleaves. Blocked practice lets you match the method instead of choosing it."
            checked={s.interleave}
            onChange={(v) => set("interleave", v)}
          />
          <Check
            label="Show a working pane on calculation questions"
            hint="Method marks are usually available. Writing the steps is worth more than it feels like."
            checked={s.showWorking}
            onChange={(v) => set("showWorking", v)}
          />
          <Check
            label="Delay self-marking to the next day"
            hint="Delayed feedback retains better than immediate correction, and you mark more honestly once the answer is no longer fresh."
            checked={s.delayedMarking}
            onChange={(v) => set("delayedMarking", v)}
          />
        </div>
      </Card>

      <Card title="AI features">
        <div className="stack">
          <Callout kind="info" title="Lodestar works fully without AI">
            Spaced repetition, mastery, priority, adaptive selection, mistake analysis, readiness,
            planning, mocks and analytics are all deterministic and run offline. Enabling AI adds the
            tutor, marking assistance and explanation generation on top of a system that already
            works — and self-marking against a mark scheme remains the higher-value option regardless.
          </Callout>
          <Check
            label="Enable AI features where a provider is configured"
            hint="Requires a server-side API key. No key ever reaches your browser, and only the specific context a feature needs is sent — never your whole store."
            checked={s.aiEnabled}
            onChange={(v) => set("aiEnabled", v)}
          />
          <p className="tiny muted">
            Configure the provider in <code>.env.local</code>. See <code>.env.example</code>.
          </p>
        </div>
      </Card>

      <Card title="Your data">
        <div className="stack">
          <div className="grid three">
            <Stat label="Attempts" value={state.attempts.length} />
            <Stat label="Mistakes" value={state.mistakes.length} />
            <Stat label="Events" value={state.events.length} />
          </div>

          <Callout kind="info" title="Where this lives">
            Everything you generate is stored in this browser and nowhere else. There is no account and
            no server copy. That also means clearing site data deletes it, so export a backup
            occasionally — especially before an exam.
          </Callout>

          {message && <Callout kind="good">{message}</Callout>}

          <div className="row">
            <button className="btn" onClick={exportNow}>Export everything</button>
            <button className="btn" onClick={() => void copyExport()}>Copy export</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>Import a backup</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  importJson(await file.text());
                  setMessage("Backup imported. Your previous state in this browser was replaced.");
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : "That file could not be read.");
                }
              }}
            />
            <div className="spacer" />
            <ConfirmButton
              confirmLabel="Delete everything — sure?"
              onConfirm={() => {
                void reset();
                setExported(null);
                setMessage("All local data deleted.");
              }}
            >
              Delete all my data
            </ConfirmButton>
          </div>

          {exported && (
            <div className="field">
              <label htmlFor="export-json">
                Your export — {(exported.length / 1024).toFixed(0)} KB
              </label>
              <p className="hint">
                If the download did not arrive, your browser blocked it. Copy this and save it as a
                <code> .json</code> file; importing it later restores everything exactly.
              </p>
              <textarea
                id="export-json"
                readOnly
                value={exported}
                onFocus={(e) => e.currentTarget.select()}
                style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", minHeight: 120 }}
              />
            </div>
          )}
        </div>
      </Card>

      <Card title="Subjects">
        <div className="stack tight">
          {state.profile.subjects.map((sub) => (
            <div key={sub.syllabusId} className="row between" style={{ padding: "8px 0", borderBottom: "1px solid var(--rule)" }}>
              <span className="small">
                <strong>{sub.syllabusId}</strong>{" "}
                <span className="muted">
                  · target {sub.targetGrade} · {sub.stage}
                  {sub.examDate ? ` · exam ${sub.examDate}` : " · no exam date"}
                </span>
              </span>
              <ConfirmButton
                confirmLabel="Remove?"
                onConfirm={() =>
                  update((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, subjects: prev.profile.subjects.filter((x) => x.syllabusId !== sub.syllabusId) },
                  }))
                }
              >
                Remove
              </ConfirmButton>
            </div>
          ))}
          {state.profile.subjects.length === 0 && <p className="small muted">No subjects yet.</p>}
          <Link href="/" className="btn small" style={{ marginTop: 8, alignSelf: "flex-start" }}>Add a subject</Link>
        </div>
      </Card>
    </div>
  );
}

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="row" style={{ alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: "auto", marginTop: 3 }} />
      <span>
        <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{label}</span>
        {hint && <><br /><span className="small muted">{hint}</span></>}
      </span>
    </label>
  );
}

function Toggle3({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="btn-group">
        {options.map(([v, l]) => (
          <button key={v} className={`btn small ${value === v ? "primary" : ""}`} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
