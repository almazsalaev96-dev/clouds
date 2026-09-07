/**
 * The ranking's two student-facing promises: it says where you stand in words, and
 * the marks it says are on offer are the marks actually on offer.
 *
 *   node --test server/
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { explain, masteryState } from './markyield.js'

const point = (over = {}) => ({
  code: '7.3', paper: '4', paperWeightPct: 30, weight: 0.3,
  mastery: 0.13, attempts: 2, marksOnOffer: 20, lastSeenDays: 3, misconceptions: 0,
  ...over,
})

test('a student is told a word, never a decimal', () => {
  const line = explain(point())
  assert.ok(!/0\.\d/.test(line), `a raw mastery figure leaked into "${line}"`)
  assert.match(line, /\bweak\b/)
})

test('the tariff quoted is the topic’s own, not a default', () => {
  assert.match(explain(point({ marksOnOffer: 20 })), /20-mark topic/)
  assert.match(explain(point({ marksOnOffer: 2 })), /2-mark topic/)
})

test('a point never attempted is described as such, with no mastery word', () => {
  const line = explain(point({ attempts: 0, mastery: 0 }))
  assert.match(line, /have not attempted/)
  assert.ok(!/\b(weak|developing|secure|strong)\b/.test(line), line)
})

test('the mastery ladder ignores a seeded figure with no attempts behind it', () => {
  assert.equal(masteryState(0.9, 0), 'unseen')
  assert.equal(masteryState(0.2, 3), 'weak')
  assert.equal(masteryState(0.5, 3), 'developing')
  assert.equal(masteryState(0.7, 3), 'secure')
  assert.equal(masteryState(0.9, 3), 'strong')
})
