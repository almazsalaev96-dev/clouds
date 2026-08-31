import test from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/rateLimit.js';
import { prepareSpeechText, voiceSettingsFor } from '../src/elevenlabs.js';

test('a burst up to capacity is allowed, then refused', () => {
  const limiter = new RateLimiter(3, 60_000);
  const now = Date.now();

  assert.equal(limiter.take('device', now).allowed, true);
  assert.equal(limiter.take('device', now).allowed, true);
  assert.equal(limiter.take('device', now).allowed, true);

  const refused = limiter.take('device', now);
  assert.equal(refused.allowed, false);
  assert.ok(refused.retryAfterSeconds >= 1);
});

test('the bucket refills continuously rather than on a boundary', () => {
  const limiter = new RateLimiter(6, 60_000);
  const start = Date.now();

  for (let i = 0; i < 6; i++) limiter.take('device', start);
  assert.equal(limiter.take('device', start).allowed, false);

  // A tenth of the window has passed, so a tenth of the capacity is back.
  assert.equal(limiter.take('device', start + 10_000).allowed, true);
});

test('devices are limited independently', () => {
  const limiter = new RateLimiter(1, 60_000);
  const now = Date.now();
  assert.equal(limiter.take('a', now).allowed, true);
  assert.equal(limiter.take('b', now).allowed, true);
  assert.equal(limiter.take('a', now).allowed, false);
});

test('idle buckets are swept so memory does not grow without bound', () => {
  const limiter = new RateLimiter(5, 1000);
  const start = Date.now();

  for (let i = 0; i < 50; i++) limiter.take(`device-${i}`, start);
  assert.equal(limiter.size, 50);

  limiter.take('fresh', start + 5000);
  assert.ok(limiter.size < 5, `expected stale buckets to be swept, ${limiter.size} remain`);
});

// MARK: Speech preparation

test('markdown is stripped before the voice reads it', () => {
  const spoken = prepareSpeechText('**Try** substituting `x = 4` into the *original* equation.');
  assert.equal(spoken, 'Try substituting x = 4 into the original equation.');
});

test('link syntax is read as its text', () => {
  assert.equal(prepareSpeechText('See [the method](https://example.com) again.'), 'See the method again.');
});

test('long text is cut at a sentence end, never mid-word', () => {
  const text = `${'This is a sentence. '.repeat(200)}`;
  const spoken = prepareSpeechText(text, 100);
  assert.ok(spoken.length <= 100);
  assert.ok(spoken.endsWith('.'), `expected a sentence end, got: ${spoken.slice(-20)}`);
});

test('speech with no sentence break is still bounded', () => {
  const spoken = prepareSpeechText('x'.repeat(500), 100);
  assert.equal(spoken.length, 100);
});

test('voice settings clamp the speed and steady the fast end', () => {
  assert.equal(voiceSettingsFor(99).speed, 1.4);
  assert.equal(voiceSettingsFor(0).speed, 0.7);
  assert.ok(voiceSettingsFor(1.3).stability > voiceSettingsFor(1.0).stability);
});
