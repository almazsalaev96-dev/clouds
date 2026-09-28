"use client";

import * as React from "react";
import { AudioLines, Download, FileText, Hand, Pause, Play, RotateCcw, Settings2, SkipBack, SkipForward, Square, Trash2 } from "lucide-react";
import { complete } from "@/lib/generate";
import { whyItFailed } from "@/lib/complete";
import { createNote } from "@/lib/db";
import { guessLang } from "@/lib/lang";
import { FORMATS, HOSTS, LENGTHS, audioPrompt, joinPrompt, minutesOf, pickVoices, readScript, scriptText, speakChunks } from "@/lib/sourcebook";
import type { AudioFormat, AudioLength, AudioLine, AudioOverview as Audio } from "@/lib/types";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Src = { id: string; name: string; text: string };

/**
 * The audio overview: the notebook's sources as a conversation between two
 * hosts, read aloud by the device's own voices.
 *
 * Read by the browser rather than rendered to a file on a server, which is
 * the honest trade: nothing to pay for and nothing to wait for once the
 * script is written, at the price of voices that are only as good as the
 * device's. The transcript is always there, follows the voice, and a line
 * pressed is where it plays from.
 */
export function AudioOverviewCard({ title, sources, audio, modelId, onSave, onKeep, onNotice }: {
  title: string;
  sources: Src[];
  audio?: Audio;
  modelId: string | null;
  onSave: (audio: Audio | undefined) => Promise<void>;
  onKeep: (title: string, content: string) => Promise<void>;
  onNotice: (text: string) => void;
}) {
  const [customising, setCustomising] = React.useState(false);
  const [format, setFormat] = React.useState<AudioFormat>(audio?.format ?? "deep");
  const [length, setLength] = React.useState<AudioLength>(audio?.length ?? "default");
  const [focus, setFocus] = React.useState(audio?.focus ?? "");
  const [writing, setWriting] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const generate = async () => {
    if (!modelId) { onNotice("No key configured yet — add one in Settings."); return; }
    if (!sources.length) { onNotice("Choose at least one source for the hosts to talk about."); return; }
    setWriting(true);
    setCustomising(false);
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const raw = await complete(audioPrompt(sources, { format, length, focus }), { modelId, maxTokens: 6_000, temperature: 0.7, signal: ctl.signal });
      if (ctl.signal.aborted) return;
      const lines = readScript(raw ?? "");
      if (lines.length < 4) { onNotice("The conversation did not come back in a shape that could be read aloud. Try again."); return; }
      await onSave({ format, length, focus: focus.trim(), lines, for: sources.map((s) => s.id), at: Date.now() });
    } catch (err) {
      if (!ctl.signal.aborted) onNotice(whyItFailed(err, "The audio overview could not be written."));
    } finally {
      setWriting(false);
      abortRef.current = null;
    }
  };

  const formatName = FORMATS.find((f) => f.id === (audio?.format ?? format))?.name ?? "Deep dive";

  return (
    <section aria-label="Audio Overview" className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent"><AudioLines size={16} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-primary">Audio Overview</h3>
          <p className="truncate text-xs text-tertiary">
            {audio ? `${formatName} · about ${minutesOf(audio.lines)} min · ${HOSTS[0]} and ${HOSTS[1]}` : "Two hosts talk the sources through, out loud"}
          </p>
        </div>
      </div>

      {writing ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-subtle px-3 py-2.5 text-sm text-secondary" role="status">
          <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden />
          <span className="flex-1">Writing the conversation from {sources.length} source{sources.length === 1 ? "" : "s"}…</span>
          <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}><Square size={12} /> Stop</Button>
        </div>
      ) : customising ? (
        <Customise
          format={format} setFormat={setFormat}
          length={length} setLength={setLength}
          focus={focus} setFocus={setFocus}
          onGenerate={() => void generate()}
          onCancel={() => setCustomising(false)}
        />
      ) : audio ? (
        <Player
          key={audio.at}
          title={title}
          audio={audio}
          sources={sources}
          modelId={modelId}
          onSave={onSave}
          onKeep={onKeep}
          onNotice={onNotice}
          onRedo={() => setCustomising(true)}
        />
      ) : (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setCustomising(true)}><Settings2 size={13} /> Customise</Button>
          <Button size="sm" variant="primary" onClick={() => void generate()} disabled={!sources.length}>Generate</Button>
        </div>
      )}
    </section>
  );
}

function Customise({ format, setFormat, length, setLength, focus, setFocus, onGenerate, onCancel }: {
  format: AudioFormat; setFormat: (f: AudioFormat) => void;
  length: AudioLength; setLength: (l: AudioLength) => void;
  focus: string; setFocus: (s: string) => void;
  onGenerate: () => void; onCancel: () => void;
}) {
  return (
    <div className="mt-3 space-y-3">
      <div role="radiogroup" aria-label="Format" className="grid grid-cols-2 gap-1.5">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            role="radio"
            aria-checked={format === f.id}
            onClick={() => setFormat(f.id)}
            className={cn(
              "tap focus-ring rounded-xl border p-2.5 text-left transition-colors duration-[var(--dur-fast)]",
              format === f.id ? "border-accent bg-accent-subtle" : "border-line hover:border-line-strong",
            )}
          >
            <span className="block text-sm font-medium text-primary">{f.name}</span>
            <span className="mt-0.5 block text-xs leading-snug text-tertiary">{f.blurb}</span>
          </button>
        ))}
      </div>
      <div>
        <p className="eyebrow mb-1.5 text-faint">Length</p>
        <div role="radiogroup" aria-label="Length" className="flex gap-1 rounded-full bg-subtle p-1">
          {LENGTHS.map((l) => (
            <button
              key={l.id}
              role="radio"
              aria-checked={length === l.id}
              onClick={() => setLength(l.id)}
              className={cn("ctl-h [--ctl:1.875rem] focus-ring flex-1 rounded-full text-xs transition-colors", length === l.id ? "bg-surface font-medium text-primary shadow-sm" : "text-tertiary hover:text-primary")}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="eyebrow mb-1.5 block text-faint">What should the hosts focus on?</span>
        <textarea
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          rows={3}
          placeholder="“Only the chapter on osmosis” · “Explain it for a Year 10 student” · “Quiz me as you go”"
          className="field w-full resize-none rounded-xl border border-line bg-field px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]"
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" variant="primary" onClick={onGenerate}>Generate</Button>
      </div>
    </div>
  );
}

const RATES = [0.75, 1, 1.25, 1.5, 2];

function Player({ title, audio, sources, modelId, onSave, onKeep, onNotice, onRedo }: {
  title: string;
  audio: Audio;
  sources: Src[];
  modelId: string | null;
  onSave: (audio: Audio | undefined) => Promise<void>;
  onKeep: (title: string, content: string) => Promise<void>;
  onNotice: (text: string) => void;
  onRedo: () => void;
}) {
  const lines = audio.lines;
  const can = typeof window !== "undefined" && "speechSynthesis" in window;
  const lang = React.useMemo(() => guessLang(lines.map((l) => l.text).join(" ").slice(0, 2_000)) || "en", [lines]);
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [at, setAt] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [rate, setRate] = React.useState(1);
  const [joining, setJoining] = React.useState(false);
  const [asked, setAsked] = React.useState("");
  const [answering, setAnswering] = React.useState(false);
  const token = React.useRef(0);
  const listRef = React.useRef<HTMLOListElement>(null);

  React.useEffect(() => {
    if (!can) return;
    const load = () => setVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => {
      speechSynthesis.removeEventListener?.("voiceschanged", load);
      token.current += 1;
      speechSynthesis.cancel();
    };
  }, [can]);

  const cast = React.useMemo(() => pickVoices(voices, lang), [voices, lang]);

  const run = React.useCallback((from: number, t: number, list: AudioLine[], speed: number) => {
    let idx = from;
    while (idx < list.length && list[idx].who === 2) idx += 1;
    if (idx >= list.length) { setPlaying(false); setAt(0); return; }
    setAt(idx);
    const line = list[idx];
    const parts = speakChunks(line.text);
    let k = 0;
    const next = () => {
      if (token.current !== t) return;
      if (k >= parts.length) { run(idx + 1, t, list, speed); return; }
      const u = new SpeechSynthesisUtterance(parts[k]);
      k += 1;
      const who = cast[line.who === 1 ? 1 : 0];
      if (who.voice) u.voice = who.voice;
      u.pitch = who.pitch;
      u.rate = speed;
      u.lang = who.voice?.lang ?? lang;
      u.onend = next;
      u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") next(); };
      speechSynthesis.speak(u);
    };
    next();
  }, [cast, lang]);

  const playFrom = (idx: number, list = lines, speed = rate) => {
    if (!can) return;
    token.current += 1;
    speechSynthesis.cancel();
    setPlaying(true);
    run(idx, token.current, list, speed);
  };
  const pause = () => {
    token.current += 1;
    if (can) speechSynthesis.cancel();
    setPlaying(false);
  };

  React.useEffect(() => {
    listRef.current?.querySelector(`[data-line="${at}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [at]);

  const join = async () => {
    const q = asked.trim();
    if (!q) return;
    if (!modelId) { onNotice("No key configured yet — add one in Settings."); return; }
    setAnswering(true);
    try {
      const raw = await complete(joinPrompt(sources, lines, at, q), { modelId, maxTokens: 900, temperature: 0.6 });
      const reply = readScript(raw ?? "").filter((l) => l.who !== 2).slice(0, 6);
      if (!reply.length) { onNotice("The hosts' answer did not come back. Try asking again."); return; }
      const list: AudioLine[] = [...lines.slice(0, at + 1), { who: 2, text: q }, ...reply, ...lines.slice(at + 1)];
      await onSave({ ...audio, lines: list });
      setAsked("");
      setJoining(false);
      window.setTimeout(() => playFrom(at + 2, list), 50);
    } catch (err) {
      onNotice(whyItFailed(err, "The hosts could not answer that."));
    } finally {
      setAnswering(false);
    }
  };

  const download = () => {
    const blob = new Blob([lines.map((l) => `${l.who === 2 ? "You" : HOSTS[l.who]}: ${l.text}`).join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w-]+/g, "-").toLowerCase() || "audio-overview"}-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const spoken = lines.filter((l) => l.who !== 2);
  const done = lines.slice(0, at).filter((l) => l.who !== 2).length;

  return (
    <div className="mt-3">
      {!can && <p className="mb-2 text-xs text-tertiary">This browser cannot read aloud. The whole conversation is below to read.</p>}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => (playing ? pause() : playFrom(at))}
          disabled={!can}
          aria-label={playing ? "Pause" : "Play"}
          className="ctl [--ctl:2.5rem] focus-ring flex shrink-0 items-center justify-center rounded-full bg-cta text-cta-fg disabled:opacity-40"
        >
          {playing ? <Pause size={16} /> : <Play size={16} className="translate-x-px" />}
        </button>
        <button onClick={() => playFrom(Math.max(0, at - 1))} disabled={!can} aria-label="Back a line" className="ctl [--ctl:2rem] focus-ring flex items-center justify-center rounded-full text-secondary hover:bg-subtle disabled:opacity-40"><SkipBack size={14} /></button>
        <button onClick={() => playFrom(Math.min(lines.length - 1, at + 1))} disabled={!can} aria-label="On a line" className="ctl [--ctl:2rem] focus-ring flex items-center justify-center rounded-full text-secondary hover:bg-subtle disabled:opacity-40"><SkipForward size={14} /></button>
        <div className="mx-1 h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-label="How far through" aria-valuemin={0} aria-valuemax={spoken.length} aria-valuenow={done}>
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${spoken.length ? (done / spoken.length) * 100 : 0}%` }} />
        </div>
        <label className="sr-only" htmlFor="audio-rate">Speed</label>
        <select
          id="audio-rate"
          value={rate}
          onChange={(e) => { const r = Number(e.target.value); setRate(r); if (playing) playFrom(at, lines, r); }}
          className="ctl-h [--ctl:2rem] focus-ring rounded-full border border-line bg-surface px-2 text-xs text-secondary"
        >
          {RATES.map((r) => <option key={r} value={r}>{r}×</option>)}
        </select>
      </div>

      <div className="mt-2 flex items-center gap-0.5">
        <Button size="sm" variant={joining ? "secondary" : "ghost"} onClick={() => { pause(); setJoining((j) => !j); }} title="Interrupt the hosts with a question"><Hand size={13} /> Join</Button>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => void onKeep(`${title} — Audio Overview`, `*${FORMATS.find((f) => f.id === audio.format)?.name ?? ""} audio overview, ${HOSTS[0]} and ${HOSTS[1]}.*\n\n${scriptText(lines)}`)} aria-label="Keep the transcript as a note" title="Keep the transcript as a note"><FileText size={13} /></Button>
        <Button size="sm" variant="ghost" onClick={download} aria-label="Download the transcript" title="Download the transcript"><Download size={13} /></Button>
        <Button size="sm" variant="ghost" onClick={onRedo} aria-label="Make a new one" title="Make a new one"><RotateCcw size={13} /></Button>
        <Button size="sm" variant="ghost" onClick={() => { pause(); void onSave(undefined); }} aria-label="Delete the audio overview" title="Delete"><Trash2 size={13} /></Button>
      </div>

      {joining && (
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => { e.preventDefault(); void join(); }}
          aria-label="Ask the hosts"
        >
          <input
            autoFocus
            value={asked}
            onChange={(e) => setAsked(e.target.value)}
            placeholder="Ask the hosts a question…"
            aria-label="Your question for the hosts"
            className="field min-w-0 flex-1 rounded-full border border-line bg-field px-3.5 text-sm text-primary outline-none focus:border-[var(--accent)]"
          />
          <Button size="sm" variant="primary" type="submit" disabled={answering || !asked.trim()}>{answering ? "Asking…" : "Ask"}</Button>
        </form>
      )}

      <ol ref={listRef} aria-label="Transcript" className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
        {lines.map((l, i) => (
          <li key={i} data-line={i}>
            <button
              onClick={() => (l.who === 2 ? undefined : playFrom(i))}
              aria-current={i === at && playing ? "true" : undefined}
              className={cn(
                "tap focus-inset block w-full rounded-lg px-2 py-1.5 text-left text-sm leading-relaxed transition-colors",
                i === at && playing ? "bg-accent-subtle text-primary" : "text-secondary hover:bg-subtle",
                l.who === 2 && "italic",
              )}
            >
              <span className={cn("mr-1.5 text-xs font-medium", l.who === 0 ? "text-accent" : l.who === 1 ? "text-[var(--accent-2)]" : "text-tertiary")}>
                {l.who === 2 ? "You" : HOSTS[l.who]}
              </span>
              {l.text}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
