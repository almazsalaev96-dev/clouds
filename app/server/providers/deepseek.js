/**
 * DeepSeek adapter (§08.11). Raw HTTP over fetch — no SDK.
 *
 * POST https://api.deepseek.com/chat/completions (OpenAI-shaped, with its own
 * rules about which fields the reasoning model accepts).
 *
 * The routing policy (§08.8) decides whether this provider may be used at all —
 * never PII, never an EU/UK tenant. That check lives in `router.js`, not here.
 */
import { extractJson, priceOf } from './types.js'

/**
 * Our model ids → the vendor's. This table is configuration, not truth: vendor
 * ids drift and get renamed, so a rename lands here and nowhere else.
 * `reasoner` is the id used when the route asks for high effort; the chat model
 * is used otherwise, and only the chat model accepts `temperature`.
 */
const MODELS = {
  'deepseek-v4': { id: 'deepseek-chat', reasoner: 'deepseek-reasoner' },
}

const NAME = 'deepseek'
const URL = 'https://api.deepseek.com/chat/completions'
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
        ? 'DeepSeek did not answer within 60 seconds. Try again or switch model.'
        : `DeepSeek could not be reached: ${String(err?.message || err).slice(0, 200)}`, timedOut ? 504 : 502)
    }
    if (res.ok) return { res, g }
    const text = await res.text().catch(() => '')
    const retryable = res.status === 429 || res.status >= 500
    g.clear()
    if (retryable && attempt++ === 0) { await sleep(backoffMs(res)); continue }
    throw fail(`DeepSeek returned ${res.status}: ${detail(text)}`, res.status)
  }
}

/**
 * DeepSeek has JSON mode rather than a schema mode, and it only holds if the
 * prompt itself asks for JSON — so the schema is appended to the system prompt
 * and the reply is run through `extractJson` (08-SCH-001 fallback path).
 */
function buildBody(req, model, stream) {
  const entry = MODELS[model] || { id: model, reasoner: null }
  const reasoning = req.effort === 'high' && !!entry.reasoner
  const id = reasoning ? entry.reasoner : entry.id

  let system = String(req.system || '')
  if (req.schema) {
    system += `${system ? '\n\n' : ''}Reply with one JSON object and nothing else. It must satisfy this JSON Schema:\n${JSON.stringify(req.schema)}`
  }

  const messages = []
  if (system) messages.push({ role: 'system', content: system })
  for (const m of req.messages || []) {
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '') })
  }

  const body = {
    model: id,
    messages,
    max_tokens: Number(req.maxTokens) > 0 ? Number(req.maxTokens) : 1024,
  }
  if (reasoning) body.reasoning_effort = 'high'
  else if (typeof req.temperature === 'number') body.temperature = req.temperature
  if (req.schema) body.response_format = { type: 'json_object' }
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
    if (parsed === null) throw fail('DeepSeek returned a reply that is not the JSON the schema asked for.', 502)
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

export const deepseek = {
  name: NAME,
  get configured() { return !!process.env.DEEPSEEK_API_KEY },

  async complete(req) {
    const key = process.env.DEEPSEEK_API_KEY
    if (!key) throw fail('DEEPSEEK_API_KEY is not set, so this call cannot run.', 503)
    const model = req.model || 'deepseek-v4'
    const { res, g } = await send(buildBody(req, model, false), key)
    let payload
    try { payload = await res.json() } finally { g.clear() }
    const message = payload?.choices?.[0]?.message
    return result(req, model, String(message?.content || ''), usageOf(payload?.usage))
  },

  async *stream(req) {
    const key = process.env.DEEPSEEK_API_KEY
    if (!key) throw fail('DEEPSEEK_API_KEY is not set, so this call cannot run.', 503)
    const model = req.model || 'deepseek-v4'
    const { res, g } = await send(buildBody(req, model, true), key)
    let text = ''
    let usage = { in: 0, out: 0 }
    try {
      for await (const data of dataEvents(res, g)) {
        if (data === '[DONE]') break
        let payload
        try { payload = JSON.parse(data) } catch { continue }
        if (payload.error) throw fail(`DeepSeek stopped mid-stream: ${detail(data)}`, 502)
        if (payload.usage) usage = usageOf(payload.usage)
        // `reasoning_content` is the model's own thinking: never streamed to a student.
        const piece = payload.choices?.[0]?.delta?.content
        if (typeof piece === 'string' && piece) {
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

export default deepseek
