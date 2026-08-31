import http from 'node:http';
import { config, validateConfig } from './config.js';
import { route, json } from './router.js';

/**
 * The HTTP server.
 *
 * Node's built-in `http` with no framework. The routing table is four entries;
 * a framework would add dependencies, a middleware stack, and a supply chain,
 * to a service whose entire job is to hold two API keys safely.
 */

/** Reads a request body with a hard ceiling, refusing anything larger. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        // Destroy rather than just reject: without this the client keeps
        // uploading a body nobody will read.
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * The client address, honouring a single trusted proxy hop.
 *
 * Only used for rate limiting registrations. `x-forwarded-for` is client
 * controlled, so this is trusted exactly as far as the deployment's own
 * reverse proxy — which is why it isn't used for anything security relevant.
 */
function clientAddress(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length < 200) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

export const server = http.createServer(async (req, res) => {
  // Nothing here is embedded in a web page, so no origin needs access. The
  // iPad app is not a browser and is unaffected.
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');

  let url;
  try {
    url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  } catch {
    return json(res, 400, { message: 'That request was malformed.' });
  }

  let body;
  if (req.method === 'POST') {
    try {
      const raw = await readBody(req, config.limits.maxBodyBytes);
      body = raw.length > 0 ? JSON.parse(raw.toString('utf8')) : {};
    } catch (error) {
      if (error?.status === 413) {
        return json(res, 413, { message: 'That was too large to send. Try asking about a smaller part of the page.' });
      }
      return json(res, 400, { message: 'That request was malformed.' });
    }
  }

  try {
    await route(req, res, { body, url, clientIP: clientAddress(req) });
  } catch (error) {
    console.error('[server] unhandled', error?.message ?? error);
    if (!res.headersSent) {
      json(res, 500, { message: "Something went wrong on our side. Your work is safely saved." });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
});

// Long enough for a slow first token, short enough that a wedged upstream
// doesn't hold a socket forever.
server.requestTimeout = 180_000;
server.headersTimeout = 20_000;
server.keepAliveTimeout = 65_000;

/** Only listen when run directly, so tests can import the server. */
const isDirectRun = process.argv[1]?.endsWith('server.js');

if (isDirectRun) {
  const { errors, warnings } = validateConfig();

  for (const warning of warnings) console.warn(`[config] ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`[config] ${error}`);
    process.exit(1);
  }

  server.listen(config.port, config.host, () => {
    console.log(`Study Desk proxy listening on http://${config.host}:${config.port}`);
    if (config.tokenSecretWasGenerated) {
      console.warn('[config] TOKEN_SECRET was generated for this run; devices will need to re-register after a restart.');
    }
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      console.log(`\n${signal} received, finishing in-flight requests…`);
      server.close(() => process.exit(0));
      // Don't let a hung stream block shutdown indefinitely.
      setTimeout(() => process.exit(0), 5000).unref();
    });
  }
}
