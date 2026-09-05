/**
 * Content validation CLI.
 *
 * `npm run content:check` — prints per-pack statistics and every diagnostic,
 * and exits non-zero on errors so it works as a CI gate.
 */

import { listPacks, loadPack, summariseDiagnostics } from "../src/content/loader";

const packs = listPacks();
if (packs.length === 0) {
  console.log("No content packs found in content/. See docs/AUTHORING.md.");
  process.exit(0);
}

let totalErrors = 0;

for (const id of packs) {
  let pack;
  try {
    pack = loadPack(id);
  } catch (err) {
    console.error(`\n✗ ${id} — failed to load\n${err instanceof Error ? err.message : String(err)}`);
    totalErrors++;
    continue;
  }

  const counts = summariseDiagnostics(pack.diagnostics);
  totalErrors += counts.errors;
  const s = pack.stats;

  console.log(`\n${"─".repeat(72)}`);
  console.log(`${pack.manifest.name}  (${id} v${pack.manifest.version})`);
  console.log(`${"─".repeat(72)}`);
  console.log(
    `  ${s.syllabuses} syllabus · ${s.topics} topics · ${s.objectives} objectives\n` +
      `  ${s.questions} questions (${s.questionMarks} marks) · ${s.lessons} lessons · ` +
      `${s.cards} cards · ${s.glossaryTerms} glossary terms\n` +
      `  topic coverage: ${Math.round(s.coverage * 100)}% of leaf topics have at least one question`,
  );

  const show = (level: "error" | "warning", label: string) => {
    const rows = pack.diagnostics.filter((d) => d.level === level);
    if (!rows.length) return;
    console.log(`\n  ${label} (${rows.length}):`);
    for (const d of rows.slice(0, 25)) {
      console.log(`    ${d.file}${d.path ? ` [${d.path}]` : ""}: ${d.message}`);
    }
    if (rows.length > 25) console.log(`    … and ${rows.length - 25} more`);
  };

  show("error", "ERRORS — this content is not loading");
  show("warning", "WARNINGS");

  const gaps = pack.diagnostics.filter((d) => d.level === "info");
  if (gaps.length) {
    console.log(`\n  Coverage gaps (${gaps.length} topics with no questions):`);
    console.log(
      `    ${gaps.slice(0, 12).map((g) => g.path).join(", ")}${gaps.length > 12 ? `, … and ${gaps.length - 12} more` : ""}`,
    );
  }

  if (!counts.errors && !counts.warnings) console.log("\n  No problems found.");
}

console.log(`\n${"─".repeat(72)}`);
if (totalErrors) {
  console.error(`${totalErrors} error${totalErrors === 1 ? "" : "s"} across ${packs.length} pack(s).`);
  process.exit(1);
}
console.log(`${packs.length} pack(s) loaded cleanly.`);
