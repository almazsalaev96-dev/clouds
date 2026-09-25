/**
 * Code that runs here, in a box.
 *
 * The other assistants run Python on their servers; this app has no server
 * of its own, so it runs JavaScript in a Web Worker in the browser — no
 * DOM, no network, a time limit, and the tab untouched if the code loops.
 * Enough for what the model reaches for: parse a CSV, sum a column, work a
 * date, transform a list, check a formula on real numbers.
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
    let worker: Worker;
    try {
      worker = new Worker(URL.createObjectURL(new Blob([WORKER], { type: "text/javascript" })));
    } catch (err) {
      resolve({ ok: false, output: "", error: `Could not start the sandbox: ${(err as Error).message}`, ms: 0 });
      return;
    }
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, output: "", error: `Stopped after ${LIMIT_MS / 1000} seconds — the code did not finish in time.`, ms: Date.now() - started });
    }, LIMIT_MS);
    worker.onmessage = (e: MessageEvent<{ ok: boolean; logs: string[]; result?: string; error?: string }>) => {
      clearTimeout(timer);
      worker.terminate();
      const parts = [...e.data.logs];
      if (e.data.result !== undefined) parts.push(`→ ${e.data.result}`);
      let output = parts.join("\n");
      if (output.length > MAX_OUT) output = output.slice(0, MAX_OUT) + "\n[… cut at 12,000 characters]";
      resolve({ ok: e.data.ok, output, error: e.data.error, ms: Date.now() - started });
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ ok: false, output: "", error: e.message || "The sandbox threw before the code ran.", ms: Date.now() - started });
    };
    worker.postMessage({ code, input: input ?? "" });
  });
}
