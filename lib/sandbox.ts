/**
 * Code that runs here, in a box.
 *
 * The other assistants run Python on their servers; this app has no server
 * of its own, so it runs JavaScript in a Web Worker in the browser — no
 * DOM, no network, a time limit, and the tab untouched if the code loops.
 * Enough for what the model reaches for: parse a CSV, sum a column, work a
 * date, transform a list, check a formula on real numbers.
 *
 * The box has two walls. The worker is made inside an iframe with
 * `sandbox="allow-scripts"`, so it has an origin of its own and none of the
 * app's storage — not the keys, not the conversations, not the notes. And
 * that frame carries a Content-Security-Policy the worker inherits:
 * scripts may come only from the frame and from blob: URLs, and nothing
 * may connect out, so fetch, XHR, WebSocket, EventSource, importScripts and
 * a dynamic import of a URL all fail. Nulling the names on the worker is
 * kept as a third, cheaper wall, since a policy is easier to get wrong than
 * a line of code.
 */

const LIMIT_MS = 8_000;
const MAX_OUT = 12_000;

const WORKER = `
self.fetch = undefined; self.XMLHttpRequest = undefined; self.WebSocket = undefined; self.importScripts = undefined;
const fmt = (v) => { try { if (typeof v === "string") return v; if (v instanceof Error) return String(v); const s = JSON.stringify(v, null, 1); return s === undefined ? String(v) : s; } catch { return String(v); } };
self.onmessage = async (e) => {
  const { code, input } = e.data;
  const logs = [];
  const con = { log: (...a) => logs.push(a.map(fmt).join(" ")), info: (...a) => logs.push(a.map(fmt).join(" ")), warn: (...a) => logs.push("warning: " + a.map(fmt).join(" ")), error: (...a) => logs.push("error: " + a.map(fmt).join(" ")), table: (v) => logs.push(fmt(v)) };
  try {
    const fn = new Function("console", "input", "return (async () => {\\n" + code + "\\n})()");
    const result = await fn(con, input);
    self.postMessage({ ok: true, logs, result: result === undefined ? undefined : fmt(result) });
  } catch (err) {
    self.postMessage({ ok: false, logs, error: fmt(err && err.message ? err.message : err) });
  }
};`;

const HOST = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none'"><script>
const WORKER = ${JSON.stringify(WORKER)};
addEventListener("message", (e) => {
  if (e.source !== parent) return;
  const { code, input } = e.data || {};
  if (typeof code !== "string") return;
  let worker;
  try { worker = new Worker(URL.createObjectURL(new Blob([WORKER], { type: "text/javascript" }))); }
  catch (err) { parent.postMessage({ ok: false, logs: [], error: "Could not start the sandbox: " + (err && err.message ? err.message : err) }, "*"); return; }
  worker.onmessage = (m) => { parent.postMessage(m.data, "*"); worker.terminate(); };
  worker.onerror = (m) => { parent.postMessage({ ok: false, logs: [], error: (m && m.message) || "The sandbox threw before the code ran." }, "*"); worker.terminate(); };
  worker.postMessage({ code, input });
});
parent.postMessage({ ready: true }, "*");
</script>`;

export interface Ran {
  ok: boolean;
  /** What console.log printed, then the returned value, bounded. */
  output: string;
  error?: string;
  ms: number;
}

export function runCode(code: string, input?: string): Promise<Ran> {
  return new Promise((resolve) => {
    const started = Date.now();
    if (typeof document === "undefined") {
      resolve({ ok: false, output: "", error: "Could not start the sandbox: no page to run it in.", ms: 0 });
      return;
    }
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.title = "Code sandbox";
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
    frame.srcdoc = HOST;
    let settled = false;
    const finish = (ran: Ran) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      frame.remove();
      resolve(ran);
    };
    const timer = setTimeout(() => {
      finish({ ok: false, output: "", error: `Stopped after ${LIMIT_MS / 1000} seconds — the code did not finish in time.`, ms: Date.now() - started });
    }, LIMIT_MS);
    const onMessage = (e: MessageEvent<{ ready?: boolean; ok?: boolean; logs?: string[]; result?: string; error?: string }>) => {
      if (e.source !== frame.contentWindow || !e.data || typeof e.data !== "object") return;
      if (e.data.ready) {
        frame.contentWindow?.postMessage({ code, input: input ?? "" }, "*");
        return;
      }
      const parts = [...(e.data.logs ?? [])];
      if (e.data.result !== undefined) parts.push(`→ ${e.data.result}`);
      let output = parts.join("\n");
      if (output.length > MAX_OUT) output = output.slice(0, MAX_OUT) + "\n[… cut at 12,000 characters]";
      finish({ ok: Boolean(e.data.ok), output, error: e.data.error, ms: Date.now() - started });
    };
    window.addEventListener("message", onMessage);
    frame.onerror = () => finish({ ok: false, output: "", error: "Could not start the sandbox.", ms: Date.now() - started });
    document.body.appendChild(frame);
  });
}
