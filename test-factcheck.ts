/* A fact-check reads what came back, and confidence is put together honestly.
 *   npx jiti test-factcheck.ts */
import { parseClaims, systemConfidence } from "./lib/factcheck";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nReading the claims");
{
  const rows = parseClaims('Here you go:\n{"claims":[{"claim":"A","verdict":"supported","note":"found"},{"claim":"B","verdict":"unsupported","note":"page says otherwise"},{"claim":"C","verdict":"maybe","note":""}]}');
  check(rows?.length === 3, "three claims, prose around the JSON ignored", `${rows?.length}`);
  check(rows?.[2].verdict === "uncertain", "an unknown verdict is read as uncertain, not as support", rows?.[2].verdict);
  check(parseClaims("no json here") === null && parseClaims('{"claims":[]}') === null, "nothing usable is null, not an empty check");
  const many = parseClaims(JSON.stringify({ claims: Array.from({ length: 9 }, (_, i) => ({ claim: `c${i}`, verdict: "supported", note: "" })) }));
  check(many?.length === 6, "at most six", `${many?.length}`);
}

console.log("\nWhat can be said");
{
  const facts = (v: ("supported" | "unsupported" | "uncertain")[]) => ({ claims: v.map((verdict, i) => ({ text: `c${i}`, verdict, note: "" })), sources: [], modelId: "m", at: 0 });
  check(systemConfidence(null, null) === null, "nothing done, nothing said");
  check(systemConfidence({ agrees: "agrees" }, null)?.level === "likely", "two models agreeing with nothing looked up is likely, not high");
  check(systemConfidence({ agrees: "agrees" }, facts(["supported", "supported"]))?.level === "high", "every claim found and a second company agreeing is high");
  check(systemConfidence(null, facts(["supported", "supported"]))?.level === "high", "every claim found is high on its own");
  check(systemConfidence({ agrees: "agrees" }, facts(["supported", "unsupported"]))?.level === "low", "one claim contradicted is doubtful, whatever the models thought");
  check(systemConfidence({ agrees: "disagrees" }, facts(["supported"]))?.level === "low", "a second company disagreeing is doubtful");
  check(systemConfidence({ agrees: "partly" }, facts(["supported", "uncertain"]))?.level === "likely", "some found, mostly agreed: likely");
  check(systemConfidence(null, facts(["uncertain", "uncertain"]))?.level === "uncertain", "nothing settled is uncertain");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
