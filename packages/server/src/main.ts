/**
 * Entry point.
 *
 * Reads configuration from the environment; the API key never leaves this
 * process (§30). Starting without one is a supported state — everything that
 * does not require a model keeps working, and the interface says why.
 */

import { createApp } from "./app.ts";
import { createStore } from "../../core/src/store/index.ts";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const PORT = Number(process.env.PORT ?? 4300);
const DATA_FILE = process.env.DATA_FILE ?? "data/understory.json";

const store = createStore({ onChange: scheduleSave });

let saveTimer: NodeJS.Timeout | null = null;
function scheduleSave(): void {
  if (saveTimer) return;
  // Debounced: a turn writes many rows, and one fsync per row would dominate
  // the latency of the thing the user is waiting for.
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persist();
  }, 400);
}

async function persist(): Promise<void> {
  try {
    await mkdir(dirname(DATA_FILE), { recursive: true });
    await writeFile(DATA_FILE, store.snapshot(), "utf8");
  } catch (error) {
    console.error("[understory] could not save:", error);
  }
}

try {
  store.restore(await readFile(DATA_FILE, "utf8"));
  console.log(`[understory] restored from ${DATA_FILE}`);
} catch {
  console.log("[understory] starting with an empty store");
}

const { server, engine } = createApp({ store });

server.listen(PORT, () => {
  const model = engine.router.select("conversation");
  console.log(`[understory] http://localhost:${PORT}`);
  console.log(
    model.ok
      ? `[understory] model: ${model.value.id}`
      : `[understory] model: unavailable — ${model.failure.message}`,
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void persist().then(() => process.exit(0));
  });
}
