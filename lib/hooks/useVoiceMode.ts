"use client";

import * as React from "react";
import { guessLang } from "@/lib/lang";
import { VOICE_OFF, voiceStep, type VoiceEffect, type VoiceEvent, type VoiceState } from "@/lib/voice";

/**
 * The browser half of voice mode. The order of things is decided in
 * `lib/voice.ts`; this owns the two objects that can only exist in a page —
 * a speech recogniser and a synthesiser — and runs the effects the machine
 * hands back.
 *
 * Hidden entirely where the browser has neither: a control for something
 * the device cannot do is worse than none.
 */
interface RecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}

export interface VoiceMode {
  supported: boolean;
  phase: VoiceState["phase"];
  toggle: () => void;
}

export function useVoiceMode(opts: {
  onSend: (text: string) => void;
  /** True while an answer is on its way. */
  busy: boolean;
  /** The last finished answer in the thread, once there is one. */
  answer: { id: string; text: string } | null;
}): VoiceMode {
  const [supported, setSupported] = React.useState(false);
  const [state, setState] = React.useState<VoiceState>(VOICE_OFF);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const rec = React.useRef<RecognitionLike | null>(null);
  const send = React.useRef(opts.onSend);
  send.current = opts.onSend;
  /* The answer on the path when the question went out. The one to read is
     the first that is not it — without this, a thread that already had an
     answer would have it read back the instant the new turn began. */
  const answerRef = React.useRef(opts.answer);
  answerRef.current = opts.answer;
  const baseline = React.useRef<string | null>(null);

  React.useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => RecognitionLike;
      webkitSpeechRecognition?: new () => RecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor || !("speechSynthesis" in window)) return;
    setSupported(true);
  }, []);

  const run = React.useCallback((effects: VoiceEffect[]) => {
    for (const e of effects) {
      if (e.type === "hush") {
        try { rec.current?.abort(); } catch { /* not running */ }
        rec.current = null;
        speechSynthesis.cancel();
      } else if (e.type === "listen") {
        listen();
      } else if (e.type === "send") {
        baseline.current = answerRef.current?.id ?? null;
        send.current(e.text);
      } else if (e.type === "speak") {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(e.text);
        const lang = guessLang(e.text);
        if (lang) u.lang = lang;
        u.onend = () => dispatch({ type: "spoken" });
        u.onerror = () => dispatch({ type: "spoken" });
        speechSynthesis.speak(u);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Dispatch reads the ref, not the state, so an event arriving from a
     recogniser callback between renders still sees the phase it should. */
  const dispatch = React.useCallback((event: VoiceEvent) => {
    const next = voiceStep(stateRef.current, event);
    stateRef.current = next.state;
    setState(next.state);
    run(next.effects);
  }, [run]);

  function listen() {
    const w = window as unknown as {
      SpeechRecognition?: new () => RecognitionLike;
      webkitSpeechRecognition?: new () => RecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    try { rec.current?.abort(); } catch { /* not running */ }
    /* One phrase at a time. Continuous recognition never ends on its own,
       so the machine would never learn the person had finished; a single
       utterance ends at the pause, which is the turn boundary a conversation
       actually has. */
    const r = new Ctor();
    r.continuous = false;
    r.interimResults = false;
    r.lang = navigator.language || "en-US";
    let heard = "";
    let broke = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) heard += e.results[i][0].transcript;
      }
    };
    r.onend = () => {
      if (rec.current !== r) return;
      rec.current = null;
      dispatch(heard.trim() ? { type: "heard", text: heard } : broke ? { type: "failed" } : { type: "silence" });
    };
    r.onerror = (e) => {
      /* "no-speech" is silence and is retried; anything else — no permission,
         no network, no microphone — is a mode that cannot run. onend follows
         and reports it. */
      const kind = e.error;
      if (kind && kind !== "no-speech" && kind !== "aborted") broke = true;
    };
    rec.current = r;
    try {
      r.start();
    } catch {
      rec.current = null;
      dispatch({ type: "failed" });
    }
  }

  /* The answer arrives as data, not as an event: when the thread stops being
     busy and the last answer is one this loop has not read, read it. */
  const { busy, answer } = opts;
  React.useEffect(() => {
    if (busy || !answer) return;
    if (stateRef.current.phase !== "thinking") return;
    if (answer.id === baseline.current) return;
    dispatch({ type: "answered", id: answer.id, text: answer.text });
  }, [busy, answer, dispatch]);

  React.useEffect(() => () => run([{ type: "hush" }]), [run]);

  const toggle = React.useCallback(() => {
    dispatch(stateRef.current.phase === "off" ? { type: "start" } : { type: "stop" });
  }, [dispatch]);

  return { supported, phase: state.phase, toggle };
}
