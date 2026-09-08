"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dictation through the browser's own speech recognition.
 *
 * The mic exists because ChatGPT's composer has one, but a control that does
 * nothing is worse than no control — so this is real dictation rather than a
 * decorative icon, and it hides itself entirely where the browser cannot do it
 * instead of sitting there greyed out.
 *
 * Interim results are shown as they arrive and replaced when the phrase
 * settles, so the text does not stutter between guesses.
 */
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

export function useDictation(onText: (append: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const committed = useRef("");
  const sink = useRef(onText);
  sink.current = onText;

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    setSupported(true);

    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    r.onresult = (e) => {
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
      }
      if (final) {
        // Only settled phrases reach the composer: interim guesses rewrite
        // themselves, and watching that happen in your own draft is horrible.
        const text = final.trim();
        if (text && text !== committed.current) {
          committed.current = text;
          sink.current(text);
        }
      }
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognition.current = r;

    return () => {
      r.onresult = null;
      r.onend = null;
      r.onerror = null;
      try {
        r.stop();
      } catch {
        /* already stopped */
      }
    };
  }, []);

  const toggle = useCallback(() => {
    const r = recognition.current;
    if (!r) return;
    if (listening) {
      r.stop();
      setListening(false);
      return;
    }
    committed.current = "";
    try {
      r.start();
      setListening(true);
    } catch {
      /* start() throws if it is already running */
    }
  }, [listening]);

  return { supported, listening, toggle };
}
