import { Readable } from 'node:stream';
import { config } from './config.js';
import { issueToken, verifyToken, bearerToken } from './tokens.js';
import { RateLimiter } from './rateLimit.js';
import { parseTutorRequest, parseVoiceRequest, ValidationError } from './validate.js';
import { streamTutorReply, ServiceError } from './anthropic.js';
import { streamSpeech } from './elevenlabs.js';

/**
 * Routes.
 *
 * Four endpoints, and that is the whole surface:
 *   GET  /healthz              — is the tutor reachable?
 *   POST /v1/session/register  — issue an anonymous device token
 *   POST /v1/tutor/message     — stream a tutor reply (SSE)
 *   POST /v1/voice/speak       — stream spoken audio (MP3)
 *
 * Nothing here logs worksheet text, handwriting, or what a student asked. The
 * proxy is a pipe, not a record.
 */

const tutorLimiter = new RateLimiter(config.limits.tutorPerMinute, 60_000);
const voiceLimiter = new RateLimiter(config.limits.voicePerMinute, 60_000);
const registerLimiter = new RateLimiter(config.limits.registrationsPerHour, 3_600_000);

export async function route(req, res, { body, url, clientIP }) {
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'GET' && (path === '/healthz' || path === '/')) {
    return json(res, 200, {
      status: 'ok',
      tutor: config.anthropic.apiKey ? 'configured' : 'unconfigured',
      voice: config.elevenLabs.apiKey && config.elevenLabs.voiceId ? 'configured' : 'unconfigured',
    });
  }

  if (req.method === 'POST' && path === '/v1/session/register') {
    return handleRegister(res, clientIP);
  }

  if (req.method === 'POST' && path === '/v1/tutor/message') {
    return handleTutor(req, res, body);
  }

  if (req.method === 'POST' && path === '/v1/voice/speak') {
    return handleVoice(req, res, body);
  }

  return json(res, 404, { message: 'That request went somewhere that does not exist.' });
}

// MARK: Registration

function handleRegister(res, clientIP) {
  const limit = registerLimiter.take(`ip:${clientIP}`);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds));
    return json(res, 429, { message: 'Too many devices registered from here. Try again later.' });
  }

  return json(res, 200, { token: issueToken(config.tokenSecret) });
}

// MARK: Auth

/** @returns {{ ok: true, deviceId: string } | { ok: false }} */
function authenticate(req, res) {
  const token = bearerToken(req.headers.authorization);
  if (!token) {
    json(res, 401, { message: 'This app needs to reconnect to your tutor.' });
    return { ok: false };
  }

  const result = verifyToken(token, config.tokenSecret);
  if (!result.valid) {
    // 401 rather than 403: the app's recovery is to discard the token and
    // register again, which is exactly what it does on a 401.
    json(res, 401, { message: 'This app needs to reconnect to your tutor.' });
    return { ok: false };
  }

  return { ok: true, deviceId: result.deviceId };
}

// MARK: Tutor

async function handleTutor(req, res, body) {
  const auth = authenticate(req, res);
  if (!auth.ok) return;

  const limit = tutorLimiter.take(`tutor:${auth.deviceId}`);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds));
    return json(res, 429, {
      message: `Your tutor needs a short break — try again in about ${limit.retryAfterSeconds} seconds.`,
    });
  }

  let parsed;
  try {
    parsed = parseTutorRequest(body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return json(res, 400, { message: error.studentMessage });
    }
    throw error;
  }

  // Once the stream is open the status code is already sent, so any later
  // failure has to be reported as an SSE `error` event, not an HTTP status.
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no', // stop nginx buffering the stream into uselessness
  });

  const abort = new AbortController();
  // A student who closes the panel should not still be paying for the reply.
  res.on('close', () => abort.abort());

  // Keep-alive comments: a proxy in between may close an idle connection while
  // the model is still thinking about a hard question.
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) res.write(': keep-alive\n\n');
  }, 15_000);

  try {
    for await (const event of streamTutorReply(parsed.context, parsed.attachments, abort.signal)) {
      if (res.writableEnded) break;
      if (event.type === 'verdict') {
        sse(res, 'verdict', { verdict: event.verdict });
      } else if (event.type === 'text') {
        sse(res, 'delta', { text: event.text });
      }
    }
    sse(res, 'done', {});
  } catch (error) {
    if (abort.signal.aborted) {
      // The student left. Nothing to report to anyone.
    } else {
      logFailure('tutor', error);
      sse(res, 'error', { message: studentMessageFor(error) });
    }
  } finally {
    clearInterval(keepAlive);
    if (!res.writableEnded) res.end();
  }
}

// MARK: Voice

async function handleVoice(req, res, body) {
  const auth = authenticate(req, res);
  if (!auth.ok) return;

  const limit = voiceLimiter.take(`voice:${auth.deviceId}`);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds));
    return json(res, 429, { message: 'The voice needs a short break. Try again shortly.' });
  }

  let parsed;
  try {
    parsed = parseVoiceRequest(body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return json(res, 400, { message: error.studentMessage });
    }
    throw error;
  }

  const abort = new AbortController();
  res.on('close', () => abort.abort());

  try {
    const stream = await streamSpeech(parsed.text, parsed.speed, abort.signal);
    res.writeHead(200, {
      'content-type': 'audio/mpeg',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    });
    // Piping rather than buffering: the iPad starts playing after the first
    // few kilobytes instead of waiting for the whole file.
    await Readable.fromWeb(stream).pipe(res);
  } catch (error) {
    if (abort.signal.aborted) return;
    logFailure('voice', error);
    if (res.headersSent) {
      res.end();
    } else {
      json(res, error?.status ?? 502, { message: studentMessageFor(error) });
    }
  }
}

// MARK: Helpers

export function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function sse(res, event, data) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function studentMessageFor(error) {
  if (error instanceof ServiceError) return error.studentMessage;
  if (error instanceof ValidationError) return error.studentMessage;
  return "I couldn't answer that one just now. Your work is safely saved.";
}

/**
 * Logs the operator's half of a failure — never the student's.
 *
 * `detail` is upstream diagnostics. Worksheet text, handwriting and the
 * student's question are not passed to this function anywhere.
 */
function logFailure(scope, error) {
  const code = error?.code ?? error?.name ?? 'unknown';
  const detail = error?.detail ? ` detail=${String(error.detail).slice(0, 200)}` : '';
  console.error(`[${scope}] ${code}${detail}`);
}
