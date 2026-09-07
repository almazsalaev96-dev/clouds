/**
 * Google (Gemini) adapter (§08.11). Raw HTTP over fetch — no SDK.
 *
 * POST https://generativelanguage.googleapis.com/v1beta/models/MODEL:generateContent
 * and …:streamGenerateContent?alt=sse for the streaming form.
 */
import { extractJson, priceOf } from './types.js'

/**
 * Our model ids → the vendor's. This table is configuration, not truth: vendor
 * ids drift and get renamed, so a rename lands here and nowhere else.
 * `thinking` is the per-effort reasoning budget in tokens; -1 asks the model to
 * choose its own budget, 0 turns thinking off.
 */
const MODELS = {
  'gemini-3.8-flash': { id: 'gemini-3.8-flash', thinking: { low: 0, medium: 4096, high: 16384 } },
  'gemini-3.1-pro': { id: 'gemini-3.1-pro', thinking: { low: 1024, medium: 8192, high: 24576 } },
}

const NAME = 'google'
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT_MS = 60_000

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const fail = (message, status) => Object.assign(new Error(message), { status, provider: NAME })

/** Abort after 60s of silence; a live stream keeps bumping the deadline. */
function guard() {
  const ctl = new AbortController()
  let timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  return {
    signal: ctl.signal,
    bump() { clearTimeout(timer); timer = setTimeout(() => ctl.abort(), TIMEOUT_MS) },
    clear() { clearTimeout(timer) },
  }
}

/** Honour `retry-after` when the vendor sets it, else jittered backoff. */
function backoffMs(res) {
  const header = res && res.headers.get('retry-after')
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds, 0) * 1000, 20_000)
    const at = Date.parse(header)
    if (!Number.isNaN(at)) return Math.min(Math.max(at - Date.now(), 0), 20_000)
  }
  return Math.round(400 + Math.random() * 600)
}

function detail(body) {
  try {
    const parsed = JSON.parse(body)
    const message = parsed?.error?.message || parsed?.message
    if (message) return String(message).slice(0, 300)
  } catch { /* not JSON — fall through to the raw text */ }
  return String(body || '').replace(/\s+/g, ' ').trim().slice(0, 300) || 'no detail returned'
}

/** One POST with a single retry on 429 and 5xx. Returns an OK response. */
async function send(url, body, key) {
  let attempt = 0
  for (;;) {
    const g = guard()
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: g.signal,
      })
    } catch (err) {
      g.clear()
      const timedOut = err?.name === 'AbortError'
      if (attempt++ === 0) { await sleep(backoffMs(null)); continue }
      throw fail(timedOut
        ? 'Google did not answer within 60 seconds. Try again or switch model.'
        : `Google could not be reached: ${String(err?.message || err).slice(0, 200)}`, timedOut ? 504 : 502)
    }
    if (res.ok) return { res, g }
    const text = await res.text().catch(() => '')
    const retryable = res.status === 429 || res.status >= 500
    g.clear()
    if (retryable && attempt++ === 0) { await sleep(backoffMs(res)); continue }
    throw fail(`Google returned ${res.status}: ${detail(text)}`, res.status)
  }
}

function buildBody(req, model) {
  const entry = MODELS[model] || { id: model, thinking: null }
  const body = {
    contents: (req.messages || []).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content ?? '') }],
    })),
    generationConfig: {
      maxOutputTokens: Number(req.maxTokens) > 0 ? Number(req.maxTokens) : 1024,
    },
  }
  if (req.system) body.systemInstruction = { parts: [{ text: String(req.system) }] }
  if (typeof req.temperature === 'number') body.generationConfig.temperature = req.temperature

  const budget = entry.thinking ? entry.thinking[req.effort] : undefined
  if (typeof budget === 'number') body.generationConfig.thinkingConfig = { thinkingBudget: budget }

  // Constrained decoding (08-SCH-001).
  if (req.schema) {
    body.generationConfig.responseMimeType = 'application/json'
    body.generationConfig.responseJsonSchema = req.schema
  }
  return body
}

const textOf = (candidate) => (candidate?.content?.parts || [])
  .filter(part => typeof part?.text === 'string' && part.thought !== true)
  .map(part => part.text)
  .join('')

const usageOf = (raw) => ({
  in: Number(raw?.promptTokenCount || 0),
  out: Number(raw?.candidatesTokenCount || 0) + Number(raw?.thoughtsTokenCount || 0),
})

function result(req, model, text, usage) {
  const out = { text, model, usage, costUsd: priceOf(model, usage) }
  if (req.schema) {
    const parsed = extractJson(text)
    if (parsed === null) throw fail('Google returned a reply that is not the JSON the schema asked for.', 502)
    out.json = parsed
  }
  return out
}

/** Server-sent events, `data:` payloads only. */
async function* dataEvents(res, g) {
  const decoder = new TextDecoder()
  let buf = ''
  for await (const chunk of res.body) {
    g.bump()
    buf = (buf + decoder.decode(chunk, { stream: true })).replace(/\r\n/g, '\n')
    let at
    while ((at = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, at)
      buf = buf.slice(at + 2)
      let data = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('data:')) data += (data ? '\n' : '') + line.slice(5).trim()
      }
      if (data) yield data
    }
  }
}

function blocked(payload) {
  const reason = payload?.promptFeedback?.blockReason || payload?.candidates?.[0]?.finishReason
  return reason === 'SAFETY' || reason === 'PROHIBITED_CONTENT' || payload?.promptFeedback?.blockReason
    ? String(reason || payload.promptFeedback.blockReason)
    : null
}

export const google = {
  name: NAME,
  get configured() { return !!process.env.GOOGLE_API_KEY },

  async complete(req) {
    const key = process.env.GOOGLE_API_KEY
    if (!key) throw fail('GOOGLE_API_KEY is not set, so this call cannot run.', 503)
    const model = req.model || 'gemini-3.8-flash'
    const id = (MODELS[model] || { id: model }).id
    const { res, g } = await send(`${BASE}/${encodeURIComponent(id)}:generateContent`, buildBody(req, model), key)
    let payload
    try { payload = await res.json() } finally { g.clear() }
    const stop = blocked(payload)
    if (stop) throw fail(`Google declined this request (${stop}).`, 422)
    return result(req, model, textOf(payload?.candidates?.[0]), usageOf(payload?.usageMetadata))
  },

  async *stream(req) {
    const key = process.env.GOOGLE_API_KEY
    if (!key) throw fail('GOOGLE_API_KEY is not set, so this call cannot run.', 503)
    const model = req.model || 'gemini-3.8-flash'
    const id = (MODELS[model] || { id: model }).id
    const { res, g } = await send(`${BASE}/${encodeURIComponent(id)}:streamGenerateContent?alt=sse`, buildBody(req, model), key)
    let text = ''
    let usage = { in: 0, out: 0 }
    try {
      for await (const data of dataEvents(res, g)) {
        let payload
        try { payload = JSON.parse(data) } catch { continue }
        if (payload.error) throw fail(`Google stopped mid-stream: ${detail(data)}`, 502)
        const stop = blocked(payload)
        if (stop) throw fail(`Google declined this request (${stop}).`, 422)
        if (payload.usageMetadata) usage = usageOf(payload.usageMetadata)
        const piece = textOf(payload.candidates?.[0])
        if (piece) {
          text += piece
          yield piece
        }
      }
    } finally {
      g.clear()
    }
    return result(req, model, text, usage)
  },
}

export default google
