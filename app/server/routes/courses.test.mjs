/**
 * The course layer's two claims a student reads directly: the order of the syllabus,
 * and how much of the record on it they actually made.
 *
 *   node --test server/
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { compareCode } from './courses.js'

test('syllabus codes sort as numbers, not as words', () => {
  const shuffled = ['10', '2', '1', '5.10', '5.2', '10.1', '1.1', '5.9', '3']
  assert.deepEqual(
    [...shuffled].sort(compareCode),
    ['1', '1.1', '2', '3', '5.2', '5.9', '5.10', '10', '10.1'],
  )
})

test('a parent sorts before its own children', () => {
  assert.ok(compareCode('5', '5.1') < 0)
  assert.ok(compareCode('5.1', '5') > 0)
  assert.equal(compareCode('5.1', '5.1'), 0)
})

test('a code with a non-numeric segment still orders deterministically', () => {
  const codes = ['2b', '2a', '2', '2.1']
  const once = [...codes].sort(compareCode)
  const twice = [...codes].reverse().sort(compareCode)
  assert.deepEqual(once, twice, 'the comparator must be a total order')
})
