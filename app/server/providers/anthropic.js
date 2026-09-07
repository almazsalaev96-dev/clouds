/**
 * Anthropic adapter (§08.11). Raw HTTP over fetch — no SDK, no vendor prompt text.
 *
 * POST https://api.anthropic.com/v1/messages, headers `x-api-key` and
 * `anthropic-version: 2023-06-01`.
 */
import { extractJson, priceOf } from './types.js'

/**
 * Our model ids → the vendor's. This table is configuration, not truth: vendor
 * ids drift and get renamed, so a rename lands here and nowhere else.
 * `temperature` is only sent to models that still accept it — the current
 * thinking models reject the field outright rather than ignoring it.
 */
const MODELS = {
  'claude-sonnet-5': { id: 'claude-sonnet-5', temperature: false },
  'claude-opus-5': { id: 'claude-opus-5', temperature: false },
  'claude-haiku-4-5': { id: 'claude-haiku-4-5', temperature: true },
}

const EFFORT = { low: 'low', medium: 'medium', high: 'high' }

const NAME = 'anthropic'
const URL = 'https://api.anthropic.com/v1/messages'
const VERSION = '2023-06-01'
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
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': VERSION,
        },
        body: JSON.stringify(body),
        signal: g.signal,
      })
    } catch (err) {
      g.clear()
      const timedOut = err?.name === 'AbortError'
      if (attempt++ === 0) { await sleep(backoffMs(null)); continue }
      throw fail(timedOut
        ? 'Anthropic did not answer within 60 seconds. The request was not charged; try again or switch model.'
        : `Anthropic could not be reached: ${String(err?.message || err).slice(0, 200)}`, timedOut ? 504 : 502)
    }
    if (res.ok) return { res, g }
    const text = await res.text().catch(() => '')
    const retryable = res.status === 429 || res.status >= 500
    g.clear()
    if (retryable && attempt++ === 0) { await sleep(backoffMs(res)); continue }
    throw fail(`Anthropic returned ${res.status}: ${detail(text)}`, res.status)
  }
}

function buildBody(req, model, stream) {
  const entry = MODELS[model] || { id: model, temperature: false }
  const body = {
    model: entry.id,
    max_tokens: Number(req.maxTokens) > 0 ? Number(req.maxTokens) : 1024,
    messages: (req.messages || []).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '') })),
  }
  if (req.system) body.system = String(req.system)

  const outputConfig = {}
  if (EFFORT[req.effort]) outputConfig.effort = EFFORT[req.effort]
  // Constrained decoding (08-SCH-001): the reply is JSON by construction.
  if (req.schema) outputConfig.format = { type: 'json_schema', schema: req.schema }
  if (Object.keys(outputConfig).length) body.output_config = outputConfig

  if (typeof req.temperature === 'number' && entry.temperature) body.temperature = req.temperature
  if (stream) body.stream = true
  return body
}

const textOf = (content) => (Array.isArray(content) ? content : [])
  .filter(block => block?.type === 'text')
  .map(block => block.text || '')
  .join('')

function usageOf(raw) {
  const u = raw || {}
  return {
    in: Number(u.input_tokens || 0) + Number(u.cache_read_input_tokens || 0) + Number(u.cache_creation_input_tokens || 0),
    out: Number(u.output_tokens || 0),
  }
}

function result(req, model, text, usage) {
  const out = { text, model, usage, costUsd: priceOf(model, usage) }
  if (req.schema) {
    const parsed = extractJson(text)
    if (parsed === null) throw fail('Anthropic returned a reply that is not the JSON the schema asked for.', 502)
    out.json = parsed
  }
  return out
}

/** Server-sent events, one parsed `{event, data}` per block. */
async function* events(res, g) {
  const decoder = new TextDecoder()
  let buf = ''
  for await (const chunk of res.body) {
    g.bump()
    buf = (buf + decoder.decode(chunk, { stream: true })).replace(/\r\n/g, '\n')
    let at
    while ((at = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, at)
      buf = buf.slice(at + 2)
      let name = 'message', data = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) name = line.slice(6).trim()
        else if (line.startsWith('data:')) data += (data ? '\n' : '') + line.slice(5).trim()
      }
      if (data) yield { event: name, data }
    }
  }
}

export const anthropic = {
  name: NAME,
  get configured() { return !!process.env.ANTHROPIC_API_KEY },

  async complete(req) {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw fail('ANTHROPIC_API_KEY is not set, so this call cannot run.', 503)
    const model = req.model || 'claude-sonnet-5'
    const { res, g } = await send(buildBody(req, model, false), key)
    let payload
    try { payload = await res.json() } finally { g.clear() }
    if (payload?.stop_reason === 'refusal') throw fail('Anthropic declined this request.', 422)
    return result(req, model, textOf(payload?.content), usageOf(payload?.usage))
  },

  async *stream(req) {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw fail('ANTHROPIC_API_KEY is not set, so this call cannot run.', 503)
    const model = req.model || 'claude-sonnet-5'
    const { res, g } = await send(buildBody(req, model, true), key)
    let text = ''
    const usage = { in: 0, out: 0 }
    try {
      for await (const ev of events(res, g)) {
        if (ev.event === 'ping') continue
        let payload
        try { payload = JSON.parse(ev.data) } catch { continue }
        if (payload.type === 'error') throw fail(`Anthropic stopped mid-stream: ${detail(ev.data)}`, 502)
        if (payload.type === 'message_start') {
          const started = usageOf(payload.message?.usage)
          usage.in = started.in
          usage.out = started.out
        } else if (payload.type === 'content_block_delta' && payload.delta?.type === 'text_delta') {
          text += payload.delta.text
          yield payload.delta.text
        } else if (payload.type === 'message_delta') {
          if (payload.usage?.output_tokens) usage.out = Number(payload.usage.output_tokens)
          if (payload.delta?.stop_reason === 'refusal') throw fail('Anthropic declined this request.', 422)
        }
      }
    } finally {
      g.clear()
    }
    return result(req, model, text, usage)
  },
}

export default anthropic
