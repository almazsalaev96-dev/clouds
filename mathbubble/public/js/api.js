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

// Relative to this module, so the app finds its proxy whether it is served at
// the origin root or from a sub-path — and simply finds nothing (falling back
// to a personal key) when it is hosted as static files with no server at all.
const API_ROOT = new URL('../api/', import.meta.url);
const endpoint = (name) => new URL(name, API_ROOT).href;

let configPromise = null;

export function serverConfig() {
  if (!configPromise) {
    configPromise = fetch(endpoint('config'))
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

/** Thrown for anything the student can fix from the Settings sheet. */
export class KeyProblemError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KeyProblemError';
  }
}

async function openStream(body, signal) {
  const config = await serverConfig();
  const key = (prefs.get('apiKey') || '').trim();

  if (config.hasServerKey) {
    const res = await fetch(endpoint('chat'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (res.status !== 501) return res;
    // Server lost its key mid-session; fall through to the personal key.
  }

  if (!key) throw new NeedsKeyError();

  const headers = {
    'content-type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  const workspaceId = (prefs.get('workspaceId') || '').trim();
  if (workspaceId) headers['anthropic-workspace-id'] = workspaceId;

  return fetch(ANTHROPIC_URL, { method: 'POST', headers, body: JSON.stringify(body), signal });
}

async function readError(res) {
  let detail = '';
  try {
    const data = await res.json();
    detail = data?.error?.message || '';
  } catch {
    /* non-JSON error body */
  }

  // A key tied to more than one workspace needs the workspace named
  // explicitly — Anthropic reports it as a 400 mentioning the header.
  if (res.status === 400 && /workspace/i.test(detail)) {
    const err = new KeyProblemError(
      'This key needs a Workspace ID — add it in Settings (below the key), or create a plain API key at console.anthropic.com/settings/keys instead.'
    );
    err.fixable = true;
    return err;
  }
  if (res.status === 401) {
    const err = new KeyProblemError('That API key was rejected. Check it in Settings.');
    err.fixable = true;
    return err;
  }
  if (res.status === 429) return new Error('Rate limited — wait a few seconds and ask again.');
  if (res.status === 529 || res.status === 503) return new Error('Claude is busy right now. Try again in a moment.');
  return new Error(detail || `Request failed (${res.status}).`);
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
  if (!res.ok) throw await readError(res);
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
