/**
 * Talking to Claude.
 *
 * Preferred path is the local proxy (/api/chat) so no key touches the browser.
 * If the server has no key, we fall back to a key the student saved in
 * Settings and call the API directly. Both paths speak the same SSE stream,
 * so the parser below is shared.
 */

import { prefs } from './store.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 1600;

let configPromise = null;

export function serverConfig() {
  if (!configPromise) {
    configPromise = fetch('/api/config')
      .then((r) => (r.ok ? r.json() : { hasServerKey: false }))
      .catch(() => ({ hasServerKey: false }));
  }
  return configPromise;
}

export class NeedsKeyError extends Error {
  constructor() {
    super('Add your Anthropic API key in Settings to start asking questions.');
    this.name = 'NeedsKeyError';
  }
}

async function openStream(body, signal) {
  const config = await serverConfig();
  const key = (prefs.get('apiKey') || '').trim();

  if (config.hasServerKey) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (res.status !== 501) return res;
    // Server lost its key mid-session; fall through to the personal key.
  }

  if (!key) throw new NeedsKeyError();

  return fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal,
  });
}

async function readError(res) {
  let detail = '';
  try {
    const data = await res.json();
    detail = data?.error?.message || '';
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 401) return 'That API key was rejected. Check it in Settings.';
  if (res.status === 429) return 'Rate limited — wait a few seconds and ask again.';
  if (res.status === 529 || res.status === 503) return 'Claude is busy right now. Try again in a moment.';
  return detail || `Request failed (${res.status}).`;
}

/**
 * Streams a reply, calling onDelta with each new chunk of text.
 * Returns the complete text.
 */
export async function streamChat({ system, messages, signal, onDelta }) {
  const body = {
    model: prefs.get('model') || 'claude-sonnet-5',
    max_tokens: MAX_TOKENS,
    system,
    messages,
    stream: true,
  };

  const res = await openStream(body, signal);
  if (!res.ok) throw new Error(await readError(res));
  if (!res.body) throw new Error('Streaming is not supported in this browser.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let cut;
    while ((cut = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);

      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        let event;
        try {
          event = JSON.parse(raw);
        } catch {
          continue;
        }
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          text += event.delta.text;
          onDelta?.(event.delta.text, text);
        } else if (event.type === 'error') {
          throw new Error(event.error?.message || 'The model returned an error.');
        }
      }
    }
  }

  return text;
}

/** Splits a PNG data URL into the shape the Messages API wants. */
export function imageBlock(dataUrl) {
  const [meta, data] = dataUrl.split(',');
  const media = /data:(image\/[a-z+]+);/.exec(meta)?.[1] || 'image/png';
  return { type: 'image', source: { type: 'base64', media_type: media, data } };
}
