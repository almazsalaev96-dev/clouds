/**
 * The vendor abstraction layer (§08.11). Every provider implements this shape, so no
 * vendor-specific prompt text or SDK reaches product code.
 *
 * @typedef {{role:'user'|'assistant', content:string}} Msg
 * @typedef {Object} CompleteReq
 * @property {string} system
 * @property {Msg[]} messages
 * @property {'low'|'medium'|'high'} [effort]
 * @property {number} [maxTokens]
 * @property {object} [schema]   JSON Schema — when present the reply must be valid JSON.
 * @property {number} [temperature]
 *
 * @typedef {Object} CompleteRes
 * @property {string} text
 * @property {any}    [json]
 * @property {string} model
 * @property {{in:number,out:number}} usage
 * @property {number} costUsd
 *
 * @typedef {Object} Provider
 * @property {string} name
 * @property {boolean} configured
 * @property {(req:CompleteReq)=>Promise<CompleteRes>} complete
 * @property {(req:CompleteReq)=>AsyncGenerator<string,CompleteRes,void>} [stream]
 */

/** Pull the first JSON object out of a model reply that may be fenced or prefaced. */
export function extractJson(text) {
  if (!text) return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.search(/[[{]/)
  if (start < 0) return null
  // Walk to the matching close so trailing prose cannot break the parse.
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < raw.length; i++) {
    const c = raw[i]
    if (esc) { esc = false; continue }
    if (c === '\\') { esc = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === '{' || c === '[') depth++
    else if (c === '}' || c === ']') {
      depth--
      if (depth === 0) { try { return JSON.parse(raw.slice(start, i + 1)) } catch { return null } }
    }
  }
  return null
}

export const PRICES = {
  // USD per million tokens, in/out. Used for the cost line on every call (§08.12).
  'claude-sonnet-5':      { in: 3,    out: 15 },
  'claude-opus-5':        { in: 15,   out: 75 },
  'claude-haiku-4-5':     { in: 1,    out: 5 },
  'gpt-5.6':              { in: 2.5,  out: 10 },
  'gemini-3.8-flash':     { in: 0.3,  out: 2.5 },
  'gemini-3.1-pro':       { in: 1.25, out: 10 },
  'deepseek-v4':          { in: 0.28, out: 0.42 },
  'mock':                 { in: 0,    out: 0 },
}

export function priceOf(model, usage) {
  const p = PRICES[model] || { in: 0, out: 0 }
  return (usage.in / 1e6) * p.in + (usage.out / 1e6) * p.out
}
