// A very small router: enough for this API, no framework.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2', '.map':'application/json' }

export function createRouter() {
  const routes = []
  const add = (method) => (path, handler) => {
    const keys = []
    const rx = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '$')
    routes.push({ method, rx, keys, handler })
  }
  return { get: add('GET'), post: add('POST'), patch: add('PATCH'), del: add('DELETE'), routes }
}

export async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > 2_000_000) throw Object.assign(new Error('Body too large'), { status: 413 })
    chunks.push(c)
  }
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw Object.assign(new Error('Body is not valid JSON'), { status: 400 }) }
}

export function json(res, body, status = 200) {
  const s = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(s) })
  res.end(s)
}

/** Server-sent events, used for the streaming contract in §09.8. */
export function sse(res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })
  let open = true
  res.on('close', () => { open = false })
  return {
    get open() { return open },
    send(event, data) { if (open) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) },
    end() { if (open) { res.write('event: done\ndata: {}\n\n'); res.end(); open = false } },
  }
}

export function serveStatic(root) {
  return (req, res) => {
    const url = new URL(req.url, 'http://x')
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
    let file = join(root, p)
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html')
    if (!existsSync(file)) { res.writeHead(404); return res.end('Not found') }
    const type = TYPES[extname(file)] || 'application/octet-stream'
    const immutable = /\/assets\//.test(p)
    res.writeHead(200, { 'content-type': type, 'cache-control': immutable ? 'public,max-age=31536000,immutable' : 'no-cache' })
    createReadStream(file).pipe(res)
  }
}

export async function dispatch(router, req, res, fallback) {
  const url = new URL(req.url, 'http://x')
  for (const r of router.routes) {
    if (r.method !== req.method) continue
    const m = url.pathname.match(r.rx)
    if (!m) continue
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]))
    try {
      return await r.handler({ req, res, params, query: url.searchParams })
    } catch (err) {
      if (res.headersSent) { try { res.end() } catch {} ; return }
      const status = err.status || 500
      if (status >= 500) console.error('[api]', req.method, url.pathname, err)
      return json(res, { error: err.message || 'Server error' }, status)
    }
  }
  return fallback(req, res)
}
