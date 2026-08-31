import test from 'node:test';
import assert from 'node:assert/strict';
import { issueToken, verifyToken, bearerToken, TOKEN_MAX_AGE_MS } from '../src/tokens.js';

const SECRET = 'test-secret-not-a-real-one';

test('a freshly issued token verifies', () => {
  const token = issueToken(SECRET);
  const result = verifyToken(token, SECRET);
  assert.equal(result.valid, true);
  assert.ok(result.deviceId.length > 0);
});

test('tokens are unique per issue', () => {
  const a = issueToken(SECRET);
  const b = issueToken(SECRET);
  assert.notEqual(a, b);
});

test('a token signed with another secret is rejected', () => {
  const token = issueToken('a-different-secret');
  const result = verifyToken(token, SECRET);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'signature');
});

test('tampering with the device id invalidates the signature', () => {
  const token = issueToken(SECRET);
  const [version, deviceId, issuedAt, signature] = token.split('.');
  const tampered = [version, `${deviceId}x`, issuedAt, signature].join('.');
  assert.equal(verifyToken(tampered, SECRET).valid, false);
});

test('tampering with the issue time invalidates the signature', () => {
  // Backdating an expired token to look fresh is the attack this defends
  // against, so the replacement time must be unmistakably different from the
  // one that was signed.
  const issuedAt = Date.now() - 60 * 60_000;
  const token = issueToken(SECRET, issuedAt);
  const [version, deviceId, signedTime, signature] = token.split('.');
  const forgedTime = String(Date.now());
  assert.notEqual(signedTime, forgedTime);

  const tampered = [version, deviceId, forgedTime, signature].join('.');
  assert.equal(verifyToken(tampered, SECRET).valid, false);
});

test('an expired token is rejected', () => {
  const issuedAt = Date.now() - TOKEN_MAX_AGE_MS - 1000;
  const token = issueToken(SECRET, issuedAt);
  const result = verifyToken(token, SECRET);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'expired');
});

test('a token issued in the future is rejected', () => {
  const token = issueToken(SECRET, Date.now() + 10 * 60_000);
  const result = verifyToken(token, SECRET);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'future');
});

test('a small clock skew is tolerated', () => {
  const token = issueToken(SECRET, Date.now() + 30_000);
  assert.equal(verifyToken(token, SECRET).valid, true);
});

test('malformed input is rejected without throwing', () => {
  for (const value of ['', 'nonsense', 'a.b.c', 'a.b.c.d.e', null, undefined, 42, {}]) {
    const result = verifyToken(value, SECRET);
    assert.equal(result.valid, false);
  }
});

test('an absurdly long token is rejected before any work is done', () => {
  const result = verifyToken('x'.repeat(5000), SECRET);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'malformed');
});

test('bearerToken pulls the token out of the header', () => {
  assert.equal(bearerToken('Bearer abc123'), 'abc123');
  assert.equal(bearerToken('bearer abc123'), 'abc123');
  assert.equal(bearerToken('  Bearer   abc123  '), 'abc123');
  assert.equal(bearerToken('Basic abc123'), null);
  assert.equal(bearerToken(''), null);
  assert.equal(bearerToken(undefined), null);
});
