/**
 * OpenAI adapter (§08.11). Raw HTTP over fetch — no SDK.
 *
 * POST https://api.openai.com/v1/chat/completions.
 */
import { extractJson, priceOf } from './types.js'

/**
 * Our model ids → the vendor's. This table is configuration, not truth: vendor
 * ids drift and get renamed, so a rename lands here and nowhere else.
 * `reasoning` models take `reasoning_effort` and `max_completion_tokens`, and
 * reject `temperature`; chat models are the other way round.
 */
const MODELS = {
  'gpt-5.6': { id: 'gpt-5.6', reasoning: true },
}

const EFFORT = { low: 'low', medium: 'medium', high: 'high' }

const NAME = 'openai'
const URL = 'https://api.openai.com/v1/chat/completions'
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
async function send(body, key) {
  let attempt = 0
  for (;;) {
    const g = guard()
    let res
    try {
      res = await fetch(URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: g.signal,
      })
    } catch (err) {
      g.clear()
      const timedOut = err?.name === 'AbortError'
      if (attempt++ === 0) { await sleep(backoffMs(null)); continue }
      throw fail(timedOut
        ? 'OpenAI did not answer within 60 seconds. Try again or switch model.'
        : `OpenAI could not be reached: ${String(err?.message || err).slice(0, 200)}`, timedOut ? 504 : 502)
    }
    if (res.ok) return { res, g }
    const text = await res.text().catch(() => '')
    const retryable = res.status === 429 || res.status >= 500
    g.clear()
    if (retryable && attempt++ === 0) { await sleep(backoffMs(res)); continue }
    throw fail(`OpenAI returned ${res.status}: ${detail(text)}`, res.status)
  }
}

function buildBody(req, model, stream) {
  const entry = MODELS[model] || { id: model, reasoning: true }
  const messages = []
  if (req.system) messages.push({ role: 'system', content: String(req.system) })
  for (const m of req.messages || []) {
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '') })
  }

  const body = { model: entry.id, messages }
  const limit = Number(req.maxTokens) > 0 ? Number(req.maxTokens) : 1024
  if (entry.reasoning) body.max_completion_tokens = limit
  else body.max_tokens = limit

  if (entry.reasoning) {
    if (EFFORT[req.effort]) body.reasoning_effort = EFFORT[req.effort]
  } else if (typeof req.temperature === 'number') {
    body.temperature = req.temperature
  }

  // Constrained decoding (08-SCH-001): a strict JSON schema, not a JSON hint.
  if (req.schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'result', strict: true, schema: req.schema },
    }
  }
  if (stream) {
    body.stream = true
    body.stream_options = { include_usage: true }
  }
  return body
}

const usageOf = (raw) => ({
  in: Number(raw?.prompt_tokens || 0),
  out: Number(raw?.completion_tokens || 0),
})

function result(req, model, text, usage) {
  const out = { text, model, usage, costUsd: priceOf(model, usage) }
  if (req.schema) {
    const parsed = extractJson(text)
    if (parsed === null) throw fail('OpenAI returned a reply that is not the JSON the schema asked for.', 502)
    out.json = parsed
  }
  return out
}

/** Server-sent events, `data:` payloads only — this API sends no event names. */
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

export const openai = {
  name: NAME,
  get configured() { return !!process.env.OPENAI_API_KEY },

  async complete(req) {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw fail('OPENAI_API_KEY is not set, so this call cannot run.', 503)
    const model = req.model || 'gpt-5.6'
    const { res, g } = await send(buildBody(req, model, false), key)
    let payload
    try { payload = await res.json() } finally { g.clear() }
    const choice = payload?.choices?.[0]
    if (choice?.message?.refusal) throw fail(`OpenAI declined this request: ${String(choice.message.refusal).slice(0, 200)}`, 422)
    return result(req, model, String(choice?.message?.content || ''), usageOf(payload?.usage))
  },

  async *stream(req) {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw fail('OPENAI_API_KEY is not set, so this call cannot run.', 503)
    const model = req.model || 'gpt-5.6'
    const { res, g } = await send(buildBody(req, model, true), key)
    let text = ''
    let usage = { in: 0, out: 0 }
    try {
      for await (const data of dataEvents(res, g)) {
        if (data === '[DONE]') break
        let payload
        try { payload = JSON.parse(data) } catch { continue }
        if (payload.error) throw fail(`OpenAI stopped mid-stream: ${detail(data)}`, 502)
        if (payload.usage) usage = usageOf(payload.usage)
        const delta = payload.choices?.[0]?.delta
        if (delta?.refusal) throw fail(`OpenAI declined this request: ${String(delta.refusal).slice(0, 200)}`, 422)
        if (typeof delta?.content === 'string' && delta.content) {
          text += delta.content
          yield delta.content
        }
      }
    } finally {
      g.clear()
    }
    return result(req, model, text, usage)
  },
}

export default openai
