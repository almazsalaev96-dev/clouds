/**
 * Models on this computer: free, private, and run by the person.
 *
 * Ollama and LM Studio both run downloaded open models (Qwen, Gemma,
 * gpt-oss and the rest) behind an OpenAI-shaped API on localhost. Armi's
 * server is somewhere else on the internet and cannot reach anybody's
 * localhost, so these are called from the browser directly: the question
 * goes from this tab to the person's own machine and nowhere else — no key,
 * no bill, no company in between.
 *
 * Three pieces:
 *  - `discover` asks the local server what is installed (and, for Ollama,
 *    what each model can do: see pictures, call tools, think);
 *  - the list is kept in settings and registered with `lib/models.ts`, so
 *    `getModel("local/qwen3.8")` knows it on the next load before anything
 *    has been asked again;
 *  - `localResponse` runs the same OpenAI-compatible adapter the server uses
 *    for the cloud companies, here in the browser, and wraps its events in
 *    the same SSE frames `/api/chat` sends — so the two places that read a
 *    stream (`useStream`, `complete`) take a local answer with one branch
 *    and no second parser.
 *
 * What stands in the way is the browser's cross-origin rule: a local server
 * must say this site may call it. Ollama allows localhost by itself and
 * anything else only through OLLAMA_ORIGINS; LM Studio has an "Enable CORS"
 * switch. A refusal and a server that is not running look the same from
 * here, so the message says both and how to fix each.
 */
import type { ChatRequest, ModelSpec } from "./types";
import { setLocalModels } from "./models";
import { streamOpenAICompatible } from "./providers/openai";
import { useSettings, type LocalSetup, type LocalModel } from "./store";

export const LOCAL_SERVERS = [
  { id: "ollama", name: "Ollama", url: "http://localhost:11434/v1" },
  { id: "lmstudio", name: "LM Studio", url: "http://localhost:1234/v1" },
] as const;

/** Where the API lives, from whatever the person typed: a bare port, no /v1, a trailing slash. */
export function normaliseUrl(raw: string): string {
  let u = raw.trim();
  if (!u) return LOCAL_SERVERS[0].url;
  if (/^\d+$/.test(u)) u = `http://localhost:${u}`;
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  u = u.replace(/\/+$/, "");
  if (!/\/v1$/.test(u)) u += "/v1";
  return u;
}

/** The server's root, for Ollama's own endpoints beside the OpenAI ones. */
const rootOf = (url: string) => url.replace(/\/v1$/, "");

export const localId = (name: string) => `local/${name}`;

/** A readable name from a tag: "qwen3.8:27b" → "Qwen3.8 27b"; "lmstudio-community/gemma-4-12b-it-GGUF" → "gemma-4-12b-it". */
export function nameOf(tag: string): string {
  const last = tag.split("/").pop() ?? tag;
  const bare = last.replace(/-GGUF$/i, "").replace(/:latest$/i, "");
  const [base, size] = bare.split(":");
  const pretty = base.charAt(0).toUpperCase() + base.slice(1);
  return size ? `${pretty} ${size}` : pretty;
}

/** What the app needs to know about a local model, from what the server said. */
export function specOf(m: LocalModel): ModelSpec {
  const name = nameOf(m.name);
  return {
    id: localId(m.name),
    provider: "local",
    apiName: m.name,
    name,
    short: name,
    blurb: "On this computer — free and private",
    /* What the app will send. Ollama's own default window is small (4K
       tokens on most graphics cards unless OLLAMA_CONTEXT_LENGTH is set),
       so without a figure from the server the history is kept short enough
       to fit rather than cut off silently at the other end. */
    contextWindow: m.context && m.context > 0 ? m.context : 8_192,
    maxOutput: 4_096,
    priceIn: 0,
    priceOut: 0,
    vision: m.vision,
    reasoning: false,
    tools: m.tools,
  };
}

/** Kept in step with settings: what is installed is what `getModel` knows. */
function register(setup: LocalSetup | null) {
  setLocalModels((setup?.models ?? []).map(specOf));
}
register(useSettings.getState().local);
useSettings.subscribe((s, prev) => {
  if (s.local !== prev.local) register(s.local);
});

export function localUrl(): string {
  return normaliseUrl(useSettings.getState().local?.url ?? LOCAL_SERVERS[0].url);
}

export type Discovered =
  | { ok: true; url: string; models: LocalModel[] }
  | { ok: false; url: string; why: "unreachable" | "empty" | "bad"; message: string };

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await run(ac.signal);
  } finally {
    clearTimeout(t);
  }
}

/** Ollama's own description of a model: what it can do and how long a window it has. */
async function ollamaShow(root: string, name: string): Promise<Partial<LocalModel>> {
  try {
    const res = await withTimeout(4_000, (signal) =>
      fetch(`${root}/api/show`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: name }), signal }),
    );
    if (!res.ok) return {};
    const j = (await res.json()) as { capabilities?: string[]; model_info?: Record<string, unknown> };
    const caps = j.capabilities ?? [];
    const ctxKey = Object.keys(j.model_info ?? {}).find((k) => k.endsWith(".context_length"));
    const trained = ctxKey ? Number(j.model_info![ctxKey]) : 0;
    return {
      vision: caps.includes("vision"),
      tools: caps.includes("tools"),
      thinks: caps.includes("thinking"),
      /* The model can take far more than Ollama gives it by default; the
         window the app assumes stays modest unless the person raised it. */
      context: trained ? Math.min(trained, 32_768) : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * What is installed at this address. Never throws; a failure says why in
 * words a person can act on, with this site's own address in the fix.
 */
export async function discover(raw: string, origin = typeof location !== "undefined" ? location.origin : ""): Promise<Discovered> {
  const url = normaliseUrl(raw);
  let res: Response;
  try {
    res = await withTimeout(5_000, (signal) => fetch(`${url}/models`, { signal }));
  } catch {
    const lm = /:1234\b/.test(url);
    return {
      ok: false,
      url,
      why: "unreachable",
      message: lm
        ? `Couldn't reach LM Studio at ${url}. Open LM Studio, go to the Developer tab, start the server and switch on "Enable CORS".`
        : `Couldn't reach ${url}. Make sure Ollama is running. If it is, it has to be told this site may use it: set OLLAMA_ORIGINS=${origin || "this site's address"} and restart Ollama.`,
    };
  }
  if (!res.ok) return { ok: false, url, why: "bad", message: `The server at ${url} answered ${res.status}. Is it an Ollama or LM Studio server?` };
  let names: string[] = [];
  try {
    const j = (await res.json()) as { data?: { id?: string }[] };
    names = (j.data ?? []).map((d) => String(d.id ?? "")).filter(Boolean);
  } catch {
    return { ok: false, url, why: "bad", message: `The server at ${url} did not answer like Ollama or LM Studio.` };
  }
  /* Embedding models answer no questions; they are for search, not chat. */
  names = names.filter((n) => !/embed|nomic-bert|bge-|e5-/i.test(n));
  if (!names.length) {
    return { ok: false, url, why: "empty", message: "Connected, but no chat models are installed yet. Download one — for example: ollama pull qwen3.5:4b" };
  }
  const root = rootOf(url);
  const isOllama = /:11434\b/.test(url) || (await fetch(`${root}/api/version`).then((r) => r.ok, () => false));
  const models: LocalModel[] = [];
  for (const name of names.slice(0, 40)) {
    const extra = isOllama ? await ollamaShow(root, name) : {};
    models.push({
      name,
      vision: extra.vision ?? /vl|vision|llava|gemma-?[34]|qwen3\.[5-9]|pixtral|glimmer/i.test(name),
      /* Tools only where the server says so: a small model offered a dozen
         tools calls them when nobody asked, and an answer becomes a mess. */
      tools: extra.tools ?? false,
      thinks: extra.thinks,
      context: extra.context,
    });
  }
  return { ok: true, url, models };
}

/**
 * A local answer, framed exactly as `/api/chat` frames a cloud one: SSE
 * `data:` lines of the app's own stream events.
 */
export function localResponse(req: ChatRequest, signal?: AbortSignal): Response {
  const enc = new TextEncoder();
  const ac = new AbortController();
  signal?.addEventListener("abort", () => ac.abort());
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
      try {
        for await (const ev of streamOpenAICompatible(req, "local", ac.signal, "local", localUrl(), { noStreamOptions: false })) {
          send(ev);
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          send({
            type: "error",
            error: {
              kind: "network",
              message: `Couldn't reach the model on your computer. Is Ollama or LM Studio still running? (${localUrl()})`,
              action: "retry",
              detail: err instanceof Error ? err.message : String(err),
            },
          });
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      ac.abort();
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

/**
 * Free models worth downloading, as of September 2026, smallest first. The
 * pull command is Ollama's; LM Studio finds the same models by name in its
 * own search. Sizes are the download, roughly; memory is what runs it
 * comfortably.
 */
export const SUGGESTED: { tag: string; name: string; size: string; memory: string; good: string }[] = [
  { tag: "qwen3.5:4b", name: "Qwen 3.5 4B", size: "3.4 GB", memory: "8 GB", good: "Best small all-rounder. Sees pictures, thinks, 200 languages including Russian." },
  { tag: "gemma4:e4b", name: "Gemma 4 E4B", size: "9.6 GB", memory: "12–16 GB", good: "Google's small model. Pictures and sound, 140 languages." },
  { tag: "qwen3.5:9b", name: "Qwen 3.5 9B", size: "6.6 GB", memory: "16 GB", good: "The strongest for its size: study help, pictures, languages." },
  { tag: "gpt-oss:20b", name: "gpt-oss 20B", size: "14 GB", memory: "16 GB", good: "OpenAI's open model. Strong step-by-step reasoning for maths and science. Text only." },
  { tag: "qwen3.8:27b", name: "Qwen 3.8 27B", size: "18 GB", memory: "24 GB graphics card or 32 GB Mac", good: "Top pick for a strong computer: coding, reasoning, pictures." },
  { tag: "gemma4:31b", name: "Gemma 4 31B", size: "20 GB", memory: "24–32 GB", good: "Google's best open model. Careful, well-written answers." },
  { tag: "gpt-oss:120b", name: "gpt-oss 120B", size: "65 GB", memory: "80 GB+", good: "The strongest open reasoning model a workstation can run." },
];
