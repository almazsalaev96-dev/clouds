/**
 * Layout check for the site.
 *
 * Loads the page at a range of widths and reports anything that makes the
 * document scroll horizontally — the single most common way a landing page
 * breaks on a phone, and the one that is invisible on a laptop.
 *
 * Drives Chrome over the DevTools Protocol using Node's built-in WebSocket, so
 * there is nothing to install.
 *
 *   node check.mjs [--chrome /path/to/chrome] [--port 8099]
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}

const CHROME =
  args.get('chrome') ??
  process.env.CHROME_PATH ??
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = Number(args.get('port') ?? 8099);
const WIDTHS = [320, 375, 390, 430, 600, 768, 900, 1024, 1280, 1440];

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

const site = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  try {
    const body = await readFile(join(import.meta.dirname, `.${path}`));
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => site.listen(PORT, '127.0.0.1', resolve));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9333',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

/** Chrome needs a moment before its debugging endpoint answers. */
async function debuggerURL(attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch('http://127.0.0.1:9333/json/version');
      const { webSocketDebuggerUrl } = await response.json();
      if (webSocketDebuggerUrl) return webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Chrome did not start a debugging endpoint');
}

const socket = new WebSocket(await debuggerURL());
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  const resolver = pending.get(message.id);
  if (!resolver) return;
  pending.delete(message.id);
  message.error ? resolver.reject(new Error(message.error.message)) : resolver.resolve(message.result);
});

function send(method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);

async function evaluate(expression) {
  const { result } = await send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId
  );
  return result.value;
}

/** Finds elements that stick out past the viewport, and names them. */
const OVERFLOW_PROBE = `(() => {
  const viewport = document.documentElement.clientWidth;
  const offenders = [];
  for (const element of document.querySelectorAll('body *')) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (rect.right <= viewport + 1 && rect.left >= -1) continue;
    const label = element.tagName.toLowerCase()
      + (element.id ? '#' + element.id : '')
      + (element.className && typeof element.className === 'string'
          ? '.' + element.className.trim().split(/\\s+/).join('.')
          : '');
    offenders.push({
      label,
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      text: (element.textContent || '').trim().slice(0, 40),
    });
  }
  return {
    viewport,
    scrollWidth: document.documentElement.scrollWidth,
    // Only report the outermost offenders; a wide parent makes every child wide.
    offenders: offenders.filter((candidate, index) =>
      !offenders.some((other, otherIndex) =>
        otherIndex !== index && candidate.label.startsWith(other.label) === false && false)).slice(0, 8),
  };
})()`;

let failures = 0;

for (const width of WIDTHS) {
  await send(
    'Emulation.setDeviceMetricsOverride',
    { width, height: 900, deviceScaleFactor: 1, mobile: width < 700 },
    sessionId
  );
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` }, sessionId);
  await new Promise((resolve) => setTimeout(resolve, 350));

  const report = await evaluate(OVERFLOW_PROBE);
  const overflow = report.scrollWidth - report.viewport;

  if (overflow > 1) {
    failures++;
    console.log(`✗ ${String(width).padStart(4)}px — document is ${overflow}px wider than the viewport`);
    for (const offender of report.offenders) {
      console.log(`      ${offender.label}  [${offender.left} → ${offender.right}]  "${offender.text}"`);
    }
  } else {
    console.log(`✓ ${String(width).padStart(4)}px — no horizontal overflow`);
  }
}

socket.close();
chrome.kill();
site.close();

console.log(failures === 0 ? '\nAll widths clean.' : `\n${failures} width(s) overflow.`);
process.exit(failures === 0 ? 0 : 1);
