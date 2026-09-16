/* Finding the parts that bear on a question — without a model, a store or a network.
 *
 *   npx jiti test-retrieve.ts */
import { chunk, tokens, rank, select } from "./lib/retrieve";
import { composeSystemPrompt, KNOWLEDGE_BUDGET_TOKENS } from "./lib/prompt";
import { estimateTokens } from "./lib/models";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const BOOK = [
  "# Cell respiration",
  "Glycolysis happens in the cytoplasm. It splits glucose into two pyruvate molecules and makes a little ATP.",
  "The link reaction turns pyruvate into acetyl-CoA, releasing carbon dioxide.",
  "The Krebs cycle runs in the mitochondrial matrix. Each turn of the cycle releases carbon dioxide and hands NADH and FADH2 to the chain.",
  "The electron transport chain sits in the inner mitochondrial membrane. It uses the electrons from NADH to pump protons, and ATP synthase makes most of the ATP.",
  "Fermentation is what a cell does without oxygen: in muscle it makes lactate, in yeast it makes ethanol.",
].join("\n\n");

console.log("\nCut into pieces a paragraph long");
{
  const pieces = chunk("book", BOOK, 200);
  check(pieces.length >= 4 && pieces.length <= 7, "paragraphs joined up to about the target", `${pieces.length} pieces`);
  check(pieces.every((p, i) => p.index === i && p.source === "book"), "each knowing where it came from");
  const long = chunk("x", "One sentence. ".repeat(300), 400);
  check(long.length > 5 && long.every((c) => c.text.length <= 620), "and a wall of text is split on sentences rather than kept whole", `${long.length} pieces`);
}

console.log("\nWords that carry something");
{
  const t = tokens("What is the Krebs cycle, and where does it run?");
  check(!t.includes("what") && !t.includes("the") && !t.includes("is"), "the filler is gone", t.join(" "));
  check(t.includes("kreb") && t.includes("cycle") && t.includes("run"), "and the words that matter stay, stemmed", t.join(" "));
  check(tokens("cycles cycling cycled").every((w) => w === "cycl" || w === "cycle"), "plurals and tenses fold together", tokens("cycles cycling cycled").join(" "));
}

console.log("\nThe piece that answers comes first");
{
  const pieces = chunk("book", BOOK, 200);
  const top = rank("where does the Krebs cycle happen", pieces, 3);
  check(top.length >= 1 && /Krebs cycle runs in the mitochondrial matrix/.test(top[0].text), "the paragraph about the Krebs cycle, for a question about it", top[0]?.text.slice(0, 50));
  const etc = rank("what pumps protons", pieces, 1);
  check(/electron transport chain/.test(etc[0]?.text ?? ""), "the chain, for a question about protons", etc[0]?.text.slice(0, 40));
  check(rank("unicorns", pieces).length === 0, "and nothing for a question the text does not touch");
  const y = rank("yeast", pieces, 1);
  check(/ethanol/.test(y[0]?.text ?? ""), "a rare word outweighs a common one", y[0]?.text.slice(0, 40));
}

console.log("\nWhat to send, within a budget");
{
  const whole = select("anything", [{ name: "a", text: "short" }, { name: "b", text: "also short" }], 1000);
  check(whole.every((s) => !s.partial) && whole.length === 2, "sources that fit go whole — retrieval is for when they do not");
  const big = { name: "book", text: BOOK };
  const other = { name: "cookbook", text: "Bread needs flour, water, salt and yeast.\n\nKnead it for ten minutes.\n\nBake at two hundred and twenty degrees." };
  const picked = select("what happens in the mitochondrial matrix", [big, other], 700);
  const book = picked.find((s) => s.name === "book");
  check(Boolean(book) && book!.partial && /Krebs/.test(book!.text), "over budget, the relevant pieces of the big one are kept", book?.text.slice(0, 60));
  check(picked.reduce((n, s) => n + s.text.length, 0) <= 760, "and the budget is respected", picked.map((s) => s.text.length).join("+"));
  check(picked.some((s) => s.name === "cookbook"), "while every source still shows its opening, so the model knows what it is");
  check(/\[…\]/.test(book!.text) || !book!.partial, "with the gaps marked, so nothing reads as continuous that was not");

  const topics = Array.from({ length: 40 }, (_, i) => `Topic ${i}: ${["alder", "birch", "cedar", "damson", "elder"][i % 5]} wood is used for ${["boats", "bowls", "fences", "fires", "floors"][(i * 3) % 5]} in the north.`);
  topics[20] = "Topic 20: the quokka is a small wallaby from Rottnest Island, famous for looking as if it is smiling.";
  const long = { name: "trees", text: topics.join("\n\n") };
  const pieces = chunk("trees", long.text, 300);
  const hit = pieces.findIndex((c) => /quokka/.test(c.text));
  const got = select("where is the quokka from", [long], 1500).find((s) => s.name === "trees")!;
  check(hit > 1 && got.text.includes(pieces[hit - 1].text) && got.text.includes(pieces[hit + 1].text), "the pieces either side of a hit come with it, so an answer split across a break is not cut", `hit at ${hit} of ${pieces.length}`);
  check(!got.text.includes(pieces[pieces.length - 1].text), "but the far end of the file, which says nothing about it, does not");
}

console.log("\nIn the system prompt, when a project holds more than fits");
{
  const at = Date.now();
  const filler = Array.from({ length: 1500 }, (_, i) =>
    `Paragraph ${i} of the field guide describes weather patterns, soil types and the habits of common garden birds in plain language, at a length that a reader would expect from a reference.`,
  );
  filler.splice(700, 0, "The greater bilby is a nocturnal marsupial of arid Australia; it digs spiral burrows and is the emblem of a chocolate campaign at Easter.");
  const guide = { id: "f1", projectId: "p", name: "Field guide.md", mimeType: "text/markdown", text: filler.join("\n\n"), size: 0, createdAt: at };
  const project = { id: "p", name: "Garden", description: "", instructions: "", createdAt: at, updatedAt: at };
  const recipe = { id: "f2", projectId: "p", name: "Scones.md", mimeType: "text/markdown", text: "Rub butter into flour, add milk, bake hot and quick.", size: 0, createdAt: at };
  const tooBig = estimateTokens(guide.text) > KNOWLEDGE_BUDGET_TOKENS;
  check(tooBig, "the guide alone is over the knowledge budget", `${estimateTokens(guide.text)} tokens`);

  const blind = composeSystemPrompt({ house: false, project, files: [guide, recipe] });
  check(blind.droppedFiles.some((f) => f.name === guide.name), "without a question the whole guide is dropped rather than cut");

  const asked = composeSystemPrompt({ house: false, project, files: [guide, recipe], query: "what does the greater bilby dig?" });
  check(asked.droppedFiles.length === 0, "with one, nothing is dropped", asked.droppedFiles.map((f) => f.name).join(", "));
  const v = asked.volatile ?? "";
  check(!/<document/.test(asked.text) && v.length > 0, "the excerpts ride outside the cached half, since they change with the question");
  check(/<document name="Field guide.md" excerpts="true">/.test(v), "the guide goes in as excerpts, and says so");
  check(/<document name="Scones.md">/.test(v), "the small file still goes in whole");
  check(/spiral burrows/.test(v), "the paragraph that answers the question is among them");
  check(/\[…\]/.test(v) && /Some documents are excerpts/.test(v), "the gaps are marked and explained");
  check(estimateTokens(v) < KNOWLEDGE_BUDGET_TOKENS + 2_000, "and the whole thing stays inside the budget", `${estimateTokens(v)} tokens`);
  const whole = composeSystemPrompt({ house: false, project, files: [recipe], query: "scones" });
  check(/<document name="Scones.md">/.test(whole.text) && !whole.volatile, "and what fits whole stays in the cached half, where it is paid for once");

  const csv = { id: "f3", projectId: "p", name: "Marks.csv", mimeType: "text/csv", text: Array.from({ length: 4000 }, (_, i) => `${i},student${i},${(i * 7) % 100}`).join("\n"), size: 0, createdAt: at };
  const flat = select("student2999", [{ name: csv.name, text: csv.text }], 3_000);
  check(flat.length === 1 && /student2999/.test(flat[0].text) && flat[0].text.length <= 3_000, "a file with no paragraphs or sentences is still cut to pieces that fit", `${flat[0]?.text.length ?? "none"} chars`);
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
