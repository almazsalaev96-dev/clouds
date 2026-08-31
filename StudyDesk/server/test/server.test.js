import test from 'node:test';
import assert from 'node:assert/strict';

// The config module reads the environment once at import, so anything the
// tests need set has to be set before the server is imported.
process.env.TOKEN_SECRET = 'test-secret';
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.RATE_TUTOR_PER_MINUTE = '4';

const { server } = await import('../src/server.js');

let baseURL;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseURL = `http://127.0.0.1:${port}`;
});

test.after(() => {
  server.close();
});

async function register() {
  const response = await fetch(`${baseURL}/v1/session/register`, { method: 'POST' });
  const body = await response.json();
  return body.token;
}

function tutorBody(overrides = {}) {
  return {
    context: {
      document: { title: 'Worksheet', subject: 'Mathematics', pageNumber: 1, pageCount: 4 },
      printedText: 'Solve 2x + 5 = 15',
      studentWork: 'x = 4',
      mode: 'check',
      ...overrides,
    },
    attachments: [],
  };
}

test('healthz reports what is configured', async () => {
  const response = await fetch(`${baseURL}/healthz`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.tutor, 'configured');
});

test('registration issues a usable token', async () => {
  const token = await register();
  assert.ok(typeof token === 'string' && token.length > 20);
});

test('the tutor endpoint refuses an unauthenticated request', async () => {
  const response = await fetch(`${baseURL}/v1/tutor/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(tutorBody()),
  });
  assert.equal(response.status, 401);
  const body = await response.json();
  // The student-facing message must never leak a status code or a reason.
  assert.match(body.message, /reconnect/i);
  assert.doesNotMatch(body.message, /401|token|signature/i);
});

test('a forged token is refused', async () => {
  const response = await fetch(`${baseURL}/v1/tutor/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer v1.forged.123.abc' },
    body: JSON.stringify(tutorBody()),
  });
  assert.equal(response.status, 401);
});

test('a malformed body is refused with a readable message', async () => {
  const token = await register();
  const response = await fetch(`${baseURL}/v1/tutor/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: '{ not json',
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.message, /malformed/i);
});

test('a request with nothing to look at is refused', async () => {
  const token = await register();
  const response = await fetch(`${baseURL}/v1/tutor/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ context: { document: { title: 'Empty' } } }),
  });
  assert.equal(response.status, 400);
});

test('rate limiting kicks in per device and reports a retry time', async () => {
  const token = await register();
  const send = () =>
    fetch(`${baseURL}/v1/tutor/message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(tutorBody()),
    });

  // The configured limit is 4/minute for this test process. The upstream call
  // fails (no real API), but the limiter is consulted first, which is the
  // behaviour under test.
  const responses = [];
  for (let i = 0; i < 6; i++) {
    const response = await send();
    responses.push(response);
    await response.body?.cancel().catch(() => {});
  }

  const limited = responses.find((response) => response.status === 429);
  assert.ok(limited, 'expected a 429 once the burst was spent');
  assert.ok(Number(limited.headers.get('retry-after')) >= 1);
});

test('a rate-limited device does not affect another device', async () => {
  const fresh = await register();
  const response = await fetch(`${baseURL}/v1/tutor/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${fresh}` },
    body: JSON.stringify(tutorBody()),
  });
  assert.notEqual(response.status, 429);
  await response.body?.cancel().catch(() => {});
});

test('an upstream failure is reported as an SSE error, not an HTTP error', async () => {
  // By this point the upstream key is a fake, so the call to the model fails.
  // The contract being checked: the stream has already started, so the failure
  // must arrive as an `error` event carrying a message a student can read.
  const token = await register();
  const response = await fetch(`${baseURL}/v1/tutor/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(tutorBody()),
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);

  const text = await response.text();
  assert.match(text, /event: error/);
  assert.match(text, /safely saved|couldn't/i);
  // Nothing about the upstream, the key, or the status code reaches the client.
  assert.doesNotMatch(text, /api[-_]?key|x-api-key|test-key/i);
});

test('an unknown route returns a readable 404', async () => {
  const response = await fetch(`${baseURL}/v1/definitely-not-here`, { method: 'POST' });
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.ok(body.message);
});

test('an oversized body is refused', async () => {
  const token = await register();
  const response = await fetch(`${baseURL}/v1/tutor/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ context: { printedText: 'x'.repeat(9 * 1024 * 1024) } }),
  }).catch((error) => error);

  // The server destroys the request once the ceiling is passed, so either a
  // 413 arrives or the socket is torn down. Both are acceptable; silently
  // accepting nine megabytes is not.
  if (response instanceof Error) {
    assert.ok(response);
  } else {
    assert.ok(response.status === 413 || response.status === 400, `unexpected status ${response.status}`);
  }
});

test('responses carry the basic hardening headers', async () => {
  const response = await fetch(`${baseURL}/healthz`);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});
