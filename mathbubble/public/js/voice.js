/**
 * The tutor's voice — text-to-speech via ElevenLabs — plus the composer's
 * microphone dictation, which is a different, unrelated browser API
 * (SpeechRecognition) and needs no key at all.
 *
 * Bring-your-own-key, like the Anthropic key: stored in this browser and
 * sent straight to ElevenLabs. There is no server proxy for it — every
 * deployment of this app, including a plain static one with no server,
 * gets the same voice feature the moment a student adds their own key.
 */

import { prefs } from './store.js';

const TTS_URL = (voiceId) => `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
const VOICES_URL = 'https://api.elevenlabs.io/v1/voices';

// ElevenLabs' own default public voice ("Rachel") — always callable on any
// account, so there is a sensible sound the very first time, before a
// student has picked a favourite from the list.
export const DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM';

export class VoiceKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VoiceKeyError';
  }
}

/** Fetches the account's voice list. Empty array (never throws) with no key or on any failure — voice is an enhancement, never something that blocks the tutor. */
export async function listVoices() {
  const key = (prefs.get('elevenKey') || '').trim();
  if (!key) return [];
  try {
    const res = await fetch(VOICES_URL, { headers: { 'xi-api-key': key } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.voices || []).map((v) => ({ id: v.voice_id, name: v.name }));
  } catch {
    return [];
  }
}

/**
 * Strips the things that read badly aloud — fenced diagram/code blocks,
 * markdown punctuation — and turns the handful of LaTeX commands a tutor's
 * replies actually use into words ($x^2$ → "x to the power of 2"). Not a
 * full LaTeX parser: good enough for the notation a school-level reply
 * uses, not built to handle arbitrary research notation.
 */
export function cleanForSpeech(text) {
  let s = String(text || '');
  s = s.replace(/```diagram[\s\S]*?```/g, ' Here is a diagram — see the page. ');
  s = s.replace(/```[\s\S]*?```/g, ' See the code on the page. ');
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => ` ${latexToWords(m)}. `);
  s = s.replace(/\$([^$\n]+)\$/g, (_, m) => ` ${latexToWords(m)} `);
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/^#{1,6}\s+/gm, '');
  s = s.replace(/^\s*[-*]\s+/gm, '');
  s = s.replace(/\n{2,}/g, '. ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function latexToWords(src) {
  let s = src;
  s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1) over ($2)');
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, 'the square root of ($1)');
  s = s.replace(/\\sqrt/g, 'square root of');
  s = s.replace(/\\int/g, 'the integral of');
  s = s.replace(/\\sum/g, 'the sum of');
  s = s.replace(/\\pi\b/g, 'pi');
  s = s.replace(/\\theta\b/g, 'theta');
  s = s.replace(/\\alpha\b/g, 'alpha');
  s = s.replace(/\\beta\b/g, 'beta');
  s = s.replace(/\\infty\b/g, 'infinity');
  s = s.replace(/\\times\b/g, ' times ');
  s = s.replace(/\\cdot\b/g, ' times ');
  s = s.replace(/\\div\b/g, ' divided by ');
  s = s.replace(/\\le\b/g, ' less than or equal to ');
  s = s.replace(/\\ge\b/g, ' greater than or equal to ');
  s = s.replace(/\\ne\b/g, ' not equal to ');
  s = s.replace(/\\approx\b/g, ' approximately ');
  s = s.replace(/\^\{?(-?\d+)\}?/g, ' to the power of $1');
  s = s.replace(/\^\{?\\circ\}?/g, ' degrees');
  s = s.replace(/_\{?([a-zA-Z0-9]+)\}?/g, ' sub $1');
  s = s.replace(/\\[a-zA-Z]+/g, ' '); // any other LaTeX command — dropped rather than read as raw backslash-gibberish
  s = s.replace(/[{}]/g, '');
  return s;
}

/**
 * Fetches speech for `text` and returns an object URL playing it. Caller
 * owns the URL and must revoke it once playback ends.
 */
export async function synthesize(text, { signal } = {}) {
  const key = (prefs.get('elevenKey') || '').trim();
  if (!key) throw new VoiceKeyError("Add your ElevenLabs API key in Settings to hear the tutor's replies.");
  const voiceId = (prefs.get('elevenVoice') || '').trim() || DEFAULT_VOICE;
  const spoken = cleanForSpeech(text);
  if (!spoken) throw new Error('Nothing to read aloud.');

  const res = await fetch(TTS_URL(voiceId), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'xi-api-key': key, accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: spoken,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
    signal,
  });

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.detail?.message || (typeof data?.detail === 'string' ? data.detail : '');
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 401) throw new VoiceKeyError('That ElevenLabs key was rejected. Check it in Settings.');
    throw new Error(detail || `Couldn't reach ElevenLabs (${res.status}).`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/* ---------------- dictation (mic → text) ---------------- */

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const dictationSupported = Boolean(Recognition);

/**
 * Wraps SpeechRecognition with a small, predictable surface: start it,
 * get interim + final text via callbacks, stop it. No key, no network call
 * this app makes itself — the browser (or OS) does the recognition.
 */
export function createDictation({ onResult, onEnd, onError, lang } = {}) {
  if (!Recognition) return null;
  const rec = new Recognition();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = lang || navigator.language || 'en-US';

  rec.onresult = (e) => {
    let final = '';
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const chunk = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += chunk;
      else interim += chunk;
    }
    onResult?.({ final, interim });
  };
  rec.onerror = (e) => onError?.(e.error);
  rec.onend = () => onEnd?.();

  return {
    start: () => rec.start(),
    stop: () => rec.stop(),
    abort: () => rec.abort(),
  };
}
