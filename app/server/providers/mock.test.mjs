/**
 * The built-in provider is what Margin marks with when no API key is set, so it
 * is the marking every first-time reader sees. These tests hold it to the two
 * things the product promises: a good answer is credited, and a mark is always
 * evidenced by the student's own words at the offsets it claims.
 *
 *   node --test server/
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mock } from './mock.js'
import { parseScheme } from '../marking/scheme.js'
import { mark } from '../marking/marker.js'

const pack = JSON.parse(readFileSync(fileURLToPath(new URL('../packs/9609.json', import.meta.url)), 'utf8'))
const itemById = (id) => pack.items.find((i) => i.id === id)
const schemeFor = (item) => parseScheme(pack.schemes.find((s) => s.id === item.scheme_id))

const markWith = (item, answer) => mark({ item, scheme: schemeFor(item), answer, provider: mock, model: 'mock' })

const total = (m) =>
  (m.per_point || []).reduce((sum, p) => sum + p.awarded, 0) +
  (m.per_ao || []).reduce((sum, a) => sum + a.marks, 0)

const pointById = (m, id) => (m.per_point || []).find((p) => p.marking_point_id === id)

/** Every span a Mark shows, from either procedure. */
function spansOf(m) {
  const out = []
  for (const p of m.per_point || []) if (p.quote) out.push(p)
  for (const a of m.per_ao || []) for (const s of a.spans || []) if (s.quote) out.push(s)
  return out
}

// itm_9609_p2_10: "Explain two benefits to Solara Skincare of setting a separate
// budget for each of its three country markets." Its scheme is written the way a
// real one is — "a relevant benefit of budgeting identified" describes the credit,
// it does not supply words to match against.
const SOLARA = 'itm_9609_p2_10'

const ANSWERED =
  'One benefit is that Solara can compare actual spend with the plan in each of its three ' +
  'countries, so it spots the market that is overspending early. A second benefit is that each ' +
  'country manager is accountable for their own budget, which motivates them to control costs.'

const GENERIC =
  'One benefit is that a budget helps a business control its costs. Another benefit is that a ' +
  'budget lets managers plan ahead for the future.'

const OFF_TOPIC = 'I like cheese. Cheese is made from milk and it tastes good on toast.'

test('a good answer is credited, not scored zero for using its own words', async () => {
  const item = itemById(SOLARA)
  const m = await markWith(item, ANSWERED)
  assert.ok(total(m) >= 3, `expected 3 or 4 of 4, got ${total(m)}`)
  assert.ok(total(m) <= item.tariff, `awarded more than the tariff: ${total(m)}`)
  assert.equal(pointById(m, 'K1').awarded, 1, 'the benefit stated is an AO1 mark')
  assert.equal(pointById(m, 'AP1').awarded, 1, 'tying it to the three countries is the AO2 mark')
})

test('an off-topic answer earns nothing', async () => {
  const m = await markWith(itemById(SOLARA), OFF_TOPIC)
  assert.equal(total(m), 0)
  for (const p of m.per_point) assert.equal(p.awarded, 0)
})

test('a generic answer takes the knowledge mark and loses the application mark', async () => {
  const m = await markWith(itemById(SOLARA), GENERIC)
  assert.equal(pointById(m, 'K1').awarded, 1, 'a benefit is still a benefit')
  assert.equal(pointById(m, 'AP1').awarded, 0, 'nothing here is true only of Solara')
  assert.equal(pointById(m, 'AP1').reason_code, 'GENERIC_NOT_CONTEXT')
})

test('an answer that never links earns no AO3 mark', async () => {
  const m = await markWith(itemById(SOLARA), GENERIC)
  assert.equal(pointById(m, 'AN1').awarded, 0)
})

test('every quoted span is verbatim at the offsets it claims', async () => {
  for (const [id, answer] of [[SOLARA, ANSWERED], [SOLARA, GENERIC], ['itm_9609_p4_01', ANSWERED]]) {
    const m = await markWith(itemById(id), answer)
    for (const span of spansOf(m)) {
      assert.equal(
        answer.slice(span.char_start, span.char_end), span.quote,
        `${id}: quote is not the text at ${span.char_start}–${span.char_end}`,
      )
    }
  }
})

test('two points are never credited from the same words', async () => {
  const m = await markWith(itemById(SOLARA), ANSWERED)
  const credited = (m.per_point || []).filter((p) => p.awarded > 0 && p.quote)
  for (const a of credited) {
    for (const b of credited) {
      if (a === b || a.shared_with?.includes(b.marking_point_id)) continue
      const overlap = Math.min(a.char_end, b.char_end) - Math.max(a.char_start, b.char_start)
      const shortest = Math.min(a.char_end - a.char_start, b.char_end - b.char_start)
      const linked = a.marking_point_id === 'AP1' || b.marking_point_id === 'AP1' // AP1 develops K1
      if (!linked) assert.ok(overlap <= 0 || overlap / shortest <= 0.5, `${a.marking_point_id} and ${b.marking_point_id} quote the same words`)
    }
  }
})

test('nothing is written off that the student did not write', async () => {
  for (const answer of [ANSWERED, GENERIC]) {
    const m = await markWith(itemById(SOLARA), answer)
    for (const attempt of m.uncredited_attempts || []) {
      assert.equal(answer.slice(attempt.char_start, attempt.char_end), attempt.quote)
      assert.ok(
        !(m.per_point || []).some((p) => p.awarded > 0 && p.char_start === attempt.char_start),
        'a credited span is being shown as an uncredited attempt as well',
      )
    }
  }
})

test('the same answer marked twice gives the same mark', async () => {
  const item = itemById(SOLARA)
  // Identity and wall-clock differ by design; the judgement must not.
  const judgement = (m) => JSON.stringify({
    total_band: m.total_band,
    per_point: m.per_point,
    per_ao: m.per_ao,
    ao_totals: m.ao_totals,
    annotations: m.annotations,
    command_word_check: m.command_word_check,
    application_check: m.application_check,
    next_mark_advice: m.next_mark_advice,
  })
  assert.equal(judgement(await markWith(item, ANSWERED)), judgement(await markWith(item, ANSWERED)))
})

test('every scheme in the pack loads, so every question can be marked', () => {
  const broken = []
  for (const item of pack.items) {
    const raw = pack.schemes.find((s) => s.id === item.scheme_id)
    if (!raw) { broken.push(`${item.id}: no scheme`); continue }
    try { parseScheme(raw) } catch (err) { broken.push(`${item.id}: ${err.message}`) }
  }
  assert.deepEqual(broken, [])
})

test('a scheme-faithful answer scores well and a cheese answer scores nothing, on every item', async () => {
  const thin = []
  for (const item of pack.items) {
    const scheme = schemeFor(item)
    const own = [
      ...(scheme.points || []).map((p) => p.creditText || ''),
      ...(scheme.indicative || []).map((c) => c.text || ''),
    ].filter(Boolean).join('. ')
    if (!own) continue
    const good = await markWith(item, `${own}.`)
    const nothing = await markWith(item, OFF_TOPIC)
    assert.equal(total(nothing), 0, `${item.id} credited an off-topic answer`)
    if (total(good) === 0) thin.push(item.id)
  }
  assert.deepEqual(thin, [], 'these items score zero on an answer made of their own mark scheme')
})
