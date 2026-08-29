#!/usr/bin/env node
/**
 * MathBubble server.
 *
 * Two jobs, no dependencies:
 *   1. Serve /public as a static site (so the PWA installs on an iPad).
 *   2. Proxy chat requests to the Anthropic API so the API key never ships
 *      to the browser.
 *
 * If ANTHROPIC_API_KEY is not set the proxy reports that to the client, which
 * then falls back to a key the student pastes in themselves (stored only in
 * that browser). That keeps the app usable with zero server setup.
 */

'use strict';

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '0.0.0.0';
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
// Only some Anthropic keys need this (identity-linked keys spanning more
// than one workspace); unset, the header below is simply never sent.
const WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID || '';
const DEFAULT_MODEL = process.env.MATHBUBBLE_MODEL || 'claude-sonnet-5';
const ANTHROPIC_VERSION = '2023-06-01';
// Overridable so the proxy can point at a gateway (or a stub, in tests).
const API_BASE = new URL(process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY = 12 * 1024 * 1024; // room for a page-sized PNG crop

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'cache-control': 'no-store', ...headers });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'content-type': MIME['.json'] });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';

  const target = path.join(PUBLIC_DIR, path.normalize(pathname));
  if (!target.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');

  let stat;
  try {
    stat = await fsp.stat(target);
  } catch {
    return send(res, 404, 'Not found');
  }
  if (stat.isDirectory()) return send(res, 404, 'Not found');

  const ext = path.extname(target).toLowerCase();
  // Long-cache the immutable vendor bundle, revalidate everything else so a
  // redeploy is picked up without students clearing site data.
  const cache = target.includes(`${path.sep}vendor${path.sep}`)
    ? 'public, max-age=604800, immutable'
    : 'no-cache';

  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': cache,
  });
  fs.createReadStream(target).pipe(res);
}

function proxyChat(req, res, payload) {
  const transport = API_BASE.protocol === 'http:' ? http : https;
  const upstream = transport.request(
    {
      hostname: API_BASE.hostname,
      port: API_BASE.port || (API_BASE.protocol === 'http:' ? 80 : 443),
      path: `${API_BASE.pathname.replace(/\/$/, '')}/v1/messages`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-length': Buffer.byteLength(payload),
        ...(WORKSPACE_ID ? { 'anthropic-workspace-id': WORKSPACE_ID } : {}),
      },
    },
    (up) => {
      res.writeHead(up.statusCode || 502, {
        'content-type': up.headers['content-type'] || 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      up.pipe(res);
    }
  );

  upstream.on('error', (err) => {
    if (!res.headersSent) sendJson(res, 502, { error: { message: `Upstream error: ${err.message}` } });
    else res.end();
  });
  req.on('aborted', () => upstream.destroy());

  upstream.end(payload);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/api/config') {
      return sendJson(res, 200, { hasServerKey: Boolean(API_KEY), model: DEFAULT_MODEL });
    }

    if (url.pathname === '/api/chat') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: { message: 'Use POST' } });
      if (!API_KEY) {
        return sendJson(res, 501, {
          error: { message: 'No server API key. Set ANTHROPIC_API_KEY, or add your own key in Settings.' },
        });
      }
      const body = await readBody(req);
      let parsed;
      try {
        parsed = JSON.parse(body.toString('utf8'));
      } catch {
        return sendJson(res, 400, { error: { message: 'Invalid JSON' } });
      }
      parsed.model = parsed.model || DEFAULT_MODEL;
      return proxyChat(req, res, JSON.stringify(parsed));
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return await serveStatic(req, res);
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    if (!res.headersSent) sendJson(res, status, { error: { message: err.message || 'Server error' } });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  MathBubble  →  http://localhost:${PORT}`);
  console.log(`  API key     →  ${API_KEY ? 'server-side (students need no key)' : 'not set (students paste their own in Settings)'}`);
  console.log(`  Model       →  ${DEFAULT_MODEL}\n`);
  console.log('  On an iPad: open the LAN address of this machine in Safari,');
  console.log('  then Share → Add to Home Screen for the full-screen app.\n');
});
