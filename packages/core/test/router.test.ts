import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelRouter } from "../src/model/router.ts";
import { ScriptedProvider } from "../src/model/scripted.ts";

const provider = (
  id: string,
  qualityRank: number,
  costPerMTokIn: number,
  extra: Partial<Parameters<typeof ScriptedProvider>[0]["capabilities"]> = {},
  available = true,
) => new ScriptedProvider({
  id, turns: [], available,
  capabilities: { qualityRank, costPerMTokIn, ...extra } as never,
});

const fleet = () => new ModelRouter()
  .register(provider("haiku", 40, 1, { reasoning: "low", contextTokens: 200_000 }))
  .register(provider("sonnet", 70, 2))
  .register(provider("opus", 100, 5));

test("quality-sensitive work takes the most capable model, not the cheapest", () => {
  for (const task of ["conversation", "reasoning"] as const) {
    const chosen = fleet().select(task);
    assert.ok(chosen.ok);
    assert.equal(chosen.value.id, "opus", `${task} should route to the strongest model`);
  }
});

test("high-volume work takes the cheapest model that qualifies", () => {
  for (const task of ["titling", "classification"] as const) {
    const chosen = fleet().select(task);
    assert.ok(chosen.ok);
    assert.equal(chosen.value.id, "haiku", `${task} should route to the cheapest model`);
  }
});

test("a model that cannot meet the requirement is never selected", () => {
  // Haiku's reasoning depth is too low for reasoning work, whatever it costs.
  const candidates = fleet().candidates("reasoning").map((p) => p.id);
  assert.ok(!candidates.includes("haiku"));
  assert.deepEqual(candidates, ["opus", "sonnet"]);
});

test("an unavailable model is skipped in favour of the next best", () => {
  const router = new ModelRouter()
    .register(provider("opus", 100, 5, {}, false))
    .register(provider("sonnet", 70, 2));
  const chosen = router.select("conversation");
  assert.ok(chosen.ok);
  assert.equal(chosen.value.id, "sonnet", "one missing key must not take down the capability");
});

test("with nothing available the router reports the real reason", () => {
  const router = new ModelRouter().register(provider("opus", 100, 5, {}, false));
  const chosen = router.select("conversation");
  assert.equal(chosen.ok, false);
  if (!chosen.ok) assert.equal(chosen.failure.code, "model_unavailable");
});

test("with nothing registered the failure says so rather than throwing", () => {
  const chosen = new ModelRouter().select("conversation");
  assert.equal(chosen.ok, false);
  if (!chosen.ok) assert.match(chosen.failure.message, /No model is configured/);
});
