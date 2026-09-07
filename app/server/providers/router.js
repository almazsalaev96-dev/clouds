/**
 * Routing policy (§08.2). Task class → primary model → fallback, with a per-task
 * effort and budget. When no key is configured for a class the mock provider serves
 * it, so the product runs end to end with nothing installed.
 */
import { mock } from './mock.js'
import { anthropic } from './anthropic.js'
import { openai } from './openai.js'
import { google } from './google.js'
import { deepseek } from './deepseek.js'

const PROVIDERS = { anthropic, openai, google, deepseek, mock }

/** task class → [provider, model, effort, latency budget ms] */
export const ROUTES = {
  tutor:        { chain: [['anthropic','claude-sonnet-5'], ['google','gemini-3.8-flash'], ['openai','gpt-5.6']], effort: 'medium', budgetMs: 1500 },
  trivial:      { chain: [['anthropic','claude-haiku-4-5'], ['google','gemini-3.8-flash']],                      effort: 'low',    budgetMs: 500 },
  markLevels:   { chain: [['anthropic','claude-opus-5'], ['openai','gpt-5.6']],                                  effort: 'high',   budgetMs: 45000 },
  markPoints:   { chain: [['anthropic','claude-sonnet-5'], ['openai','gpt-5.6']],                                effort: 'medium', budgetMs: 15000 },
  solve:        { chain: [['anthropic','claude-opus-5'], ['openai','gpt-5.6']],                                  effort: 'high',   budgetMs: 20000 },
  generate:     { chain: [['anthropic','claude-sonnet-5'], ['deepseek','deepseek-v4']],                          effort: 'medium', budgetMs: 20000 },
  bulk:         { chain: [['anthropic','claude-haiku-4-5'], ['deepseek','deepseek-v4']],                         effort: 'low',    budgetMs: 30000 },
}

/**
 * Resolve a task class to a live provider. `policy` is the per-tenant policy object
 * (§08.8): DeepSeek is refused for anything carrying PII or for EU/UK tenants.
 */
export function pick(taskClass, policy = {}) {
  const route = ROUTES[taskClass] || ROUTES.tutor
  for (const [name, model] of route.chain) {
    if (name === 'deepseek') {
      if (policy.deepseekAllowed !== true) continue
      if (policy.containsPii) continue
      if (policy.residency === 'eu' || policy.residency === 'uk') continue
    }
    if (policy.allowedProviders && !policy.allowedProviders.includes(name)) continue
    const p = PROVIDERS[name]
    if (p?.configured) return { provider: p, model, effort: route.effort, budgetMs: route.budgetMs, degraded: false }
  }
  return { provider: mock, model: 'mock', effort: route.effort, budgetMs: route.budgetMs, degraded: true }
}

/** Which providers are live right now — surfaced in the UI so quality is never silently degraded (§08.7). */
export function providerStatus() {
  return Object.entries(PROVIDERS)
    .filter(([n]) => n !== 'mock')
    .map(([name, p]) => ({ name, configured: !!p.configured }))
}
