/**
 * The API, served by the page itself.
 *
 * `server/http.js` speaks node:http — an async-iterable request and a writable
 * response. This gives it both, over `fetch`, so the router and every route handler
 * run unchanged in the browser. Nothing about the API is reimplemented here; this is
 * only the shape of the pipe.
 */
type Handler = (req: NodeReq, res: NodeRes) => unknown

interface NodeReq {
  url: string
  method: string
  headers: Record<string, string>
  [Symbol.asyncIterator](): AsyncIterator<Uint8Array>
}

interface NodeRes {
  headersSent: boolean
  writeHead(status: number, headers?: Record<string, unknown>): NodeRes
  setHeader(name: string, value: unknown): void
  write(chunk: string): boolean
  end(chunk?: string): void
  on(event: string, listener: () => void): void
}

/** The two Buffer calls `server/http.js` makes, and nothing else. */
function installBuffer(): void {
  const g = globalThis as Record<string, unknown>
  if (g.Buffer) return
  g.Buffer = {
    byteLength: (s: string) => new TextEncoder().encode(s).length,
    concat: (parts: Uint8Array[]) => {
      const total = parts.reduce((n, p) => n + p.length, 0)
      const out = new Uint8Array(total)
      let at = 0
      for (const p of parts) { out.set(p, at); at += p.length }
      return { toString: () => new TextDecoder().decode(out) }
    },
  }
}

function nodeRequest(request: Request, body: Uint8Array | null): NodeReq {
  const url = new URL(request.url)
  return {
    url: url.pathname + url.search,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    async *[Symbol.asyncIterator]() { if (body?.length) yield body },
  }
}

/**
 * A response the router can write to. A route that streams (the Learn turn) writes
 * many times before it ends, so the body is a stream and the Response resolves as
 * soon as the head is written rather than when the route finishes.
 */
function nodeResponse(): { res: NodeRes; response: Promise<Response> } {
  let settle!: (r: Response) => void
  const response = new Promise<Response>((resolve) => { settle = resolve })

  const encoder = new TextEncoder()
  const closers: (() => void)[] = []
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  const pending: string[] = []
  let finished = false

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
      for (const chunk of pending.splice(0)) c.enqueue(encoder.encode(chunk))
      if (finished) c.close()
    },
    cancel() { for (const close of closers) close() },
  })

  const push = (chunk: string) => {
    if (controller) controller.enqueue(encoder.encode(chunk))
    else pending.push(chunk)
  }

  const headers: Record<string, string> = {}
  let status = 200

  const res: NodeRes = {
    headersSent: false,
    writeHead(code, head) {
      status = code
      for (const [k, v] of Object.entries(head || {})) headers[k] = String(v)
      res.headersSent = true
      settle(new Response(stream, { status, headers }))
      return res
    },
    setHeader(name, value) { headers[name] = String(value) },
    write(chunk) { if (!res.headersSent) res.writeHead(status, headers); push(chunk); return true },
    end(chunk) {
      if (!res.headersSent) res.writeHead(status, headers)
      if (chunk) push(chunk)
      finished = true
      try { controller?.close() } catch { /* already closed */ }
    },
    on(event, listener) { if (event === 'close') closers.push(listener) },
  }
  return { res, response }
}

/**
 * Route `/api/*` through the app; leave everything else to the network, so the page's
 * own assets still load normally.
 */
export async function serveApiFromThisPage(): Promise<void> {
  installBuffer()
  const { createApp, dispatch, json } = await import('../../server/app.js') as {
    createApp: () => unknown
    dispatch: (router: unknown, req: NodeReq, res: NodeRes, fallback: Handler) => Promise<unknown>
    json: (res: NodeRes, body: unknown, status?: number) => void
  }
  const router = createApp()
  const passthrough = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input as RequestInfo, init)
    const path = new URL(request.url, location.origin).pathname
    if (!path.startsWith('/api/')) return passthrough(input as RequestInfo, init)

    const body = request.method === 'GET' || request.method === 'HEAD'
      ? null
      : new Uint8Array(await request.arrayBuffer())
    const { res, response } = nodeResponse()
    void dispatch(router, nodeRequest(request, body), res, (_req, r) =>
      json(r, { error: 'No such endpoint' }, 404))
    return response
  }
}
