/**
 * Pack scaffolder.
 *
 * Creates a valid, immediately-loadable content pack from a one-line
 * description, so adding a subject starts from something that works rather than
 * from a blank directory and a format reference.
 *
 * Usage:
 *   npx tsx scripts/new-pack.ts --board cambridge --level igcse \
 *     --subject Chemistry --code 0620 --version 2026-2028
 *
 * Everything it writes is a placeholder marked TODO. It deliberately does not
 * invent assessment-objective weightings, paper structures or command-word
 * definitions: those are factual properties of a qualification, and a plausible
 * guess is worse than an obvious blank, because a guess gets shipped.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]?.replace(/^--/, "");
  const value = process.argv[i + 1];
  if (key && value) args.set(key, value);
}

const required = ["board", "level", "subject", "code"];
const missing = required.filter((r) => !args.has(r));
if (missing.length) {
  console.error(
    `Missing: ${missing.map((m) => `--${m}`).join(", ")}\n\n` +
      `Example:\n  npx tsx scripts/new-pack.ts --board cambridge --level igcse \\\n` +
      `    --subject Chemistry --code 0620 --version 2026-2028\n\n` +
      `  --level must be one of: igcse, o-level, as-level, a-level, ib-dp, other`,
  );
  process.exit(1);
}

const board = args.get("board")!;
const level = args.get("level")!;
const subject = args.get("subject")!;
const code = args.get("code")!;
const version = args.get("version") ?? "TODO-first-last-exam-year";
const packId = args.get("id") ?? `${board}-${subject.toLowerCase().replace(/\s+/g, "-")}-${code}`;

const LEVELS: Record<string, { title: string; scale: string[] }> = {
  igcse: { title: "Cambridge IGCSE", scale: ["A*", "A", "B", "C", "D", "E", "F", "G", "U"] },
  "o-level": { title: "Cambridge O Level", scale: ["A*", "A", "B", "C", "D", "E", "U"] },
  "as-level": { title: "Cambridge International AS Level", scale: ["A", "B", "C", "D", "E", "U"] },
  "a-level": { title: "Cambridge International AS & A Level", scale: ["A*", "A", "B", "C", "D", "E", "U"] },
  "ib-dp": { title: "IB Diploma Programme", scale: ["7", "6", "5", "4", "3", "2", "1"] },
  other: { title: "TODO", scale: ["A", "B", "C", "U"] },
};

const preset = LEVELS[level];
if (!preset) {
  console.error(`Unknown --level "${level}". Use one of: ${Object.keys(LEVELS).join(", ")}`);
  process.exit(1);
}

const dir = join(process.cwd(), "content", packId);
if (existsSync(dir)) {
  console.error(`content/${packId} already exists. Choose a different --id.`);
  process.exit(1);
}

for (const sub of ["syllabus", "questions", "lessons", "flashcards", "glossary"]) {
  mkdirSync(join(dir, sub), { recursive: true });
}

const syllabusId = code;

writeFileSync(
  join(dir, "pack.yaml"),
  `id: ${packId}
name: ${preset.title} ${subject} (${code})
description: >
  TODO — one sentence on what this pack covers.
version: 0.1.0

qualification:
  id: ${board}-${level}
  level: ${level}
  title: ${preset.title}
  awardingDescription: TODO — the awarding body's full name
  gradeScale: [${preset.scale.map((g) => `"${g}"`).join(", ")}]

examBoard:
  id: ${board}
  name: TODO — full board name
  shortName: TODO

rights:
  summary: >
    TODO — state what may and may not be reproduced from this pack.
    See docs/CONTENT-RIGHTS.md. Original questions written in the style of the
    qualification are safe; past papers and mark schemes are not.
  defaultLicence: owned

lastVerified: "${new Date().toISOString().slice(0, 10)}"
`,
);

writeFileSync(
  join(dir, "syllabus", `${subject.toLowerCase().replace(/\s+/g, "-")}-${code}.yaml`),
  `# ${preset.title} ${subject} (${code})
#
# Fill this from the OFFICIAL published syllabus. Do not estimate assessment
# objective weightings or paper structures — they are factual, they differ
# between syllabus versions, and the AO weightings in particular drive the
# single most decision-relevant number the product shows a student.

id: "${syllabusId}"
code: "${code}"
title: TODO — the syllabus's full published title
subject: ${subject}
qualificationId: ${board}-${level}
examBoardId: ${board}

version:
  label: "${version}"
  firstExamYear: 2026   # TODO
  lastExamYear: 2028    # TODO
  changes:
    - TODO — what changed from the previous syllabus version

papers:
  - id: ${code}-p1
    code: "1"
    name: TODO — paper name
    durationMinutes: 0          # TODO
    rawMarks: 0                 # TODO
    weightOfQualification: 0.0  # TODO — 0..1; across all papers should total 1
    stage: combined             # as | a2 | combined
    sections:
      - { code: A, name: TODO, marks: 0 }

assessmentObjectives:
  # Boards publish these as percentages per paper. Lodestar converts them into
  # raw marks, which is what changes how a student writes.
  - id: ao1
    code: AO1
    name: TODO
    description: TODO
    weightByPaper:
      ${code}-p1: 0.0   # TODO

commandWords:
  # aoCeiling is the highest assessment objective this command word can reach.
  # Getting these right is worth a lot: it is the difference between a wasted
  # paragraph and full marks.
  - word: TODO
    definition: TODO
    aoCeiling: [AO1]
    expects: TODO — what the examiner is actually looking for
    answerStructure:
      - TODO — the shape of a full-mark answer
    trap: TODO — the mistake this command word most often provokes

topics:
  # Top-level sections first, then subtopics with parentId.
  # examWeight is optional: siblings that omit it split their parent evenly.
  - { id: t1, code: "1", title: TODO, examWeight: 0.0 }
  - { id: t1_1, code: "1.1", title: TODO, parentId: t1 }

  # prerequisites is where a lot of the intelligence comes from: when a student
  # fails twice on a topic, the adaptive engine routes to its prerequisite
  # rather than simply lowering difficulty.
  # - { id: t2_1, code: "2.1", title: TODO, parentId: t2, prerequisites: [t1_1] }

objectives: []

skills:
  - id: sk-todo
    name: TODO
    description: TODO — a transferable skill, as opposed to a piece of knowledge
    drill: TODO — how to practise it in isolation

officialResources:
  - { label: Syllabus (PDF), kind: syllabus, url: "https://TODO" }
  - { label: Past papers and mark schemes, kind: past-papers, url: "https://TODO" }
`,
);

writeFileSync(
  join(dir, "questions", "example.yaml"),
  `# Delete this file once you have real questions, or use it as a template.
#
# Every question here must be ORIGINAL. Writing a question that assesses the
# same objective at the same difficulty is normal practice; copying a past-paper
# question is not. See docs/CONTENT-RIGHTS.md.

syllabusId: "${syllabusId}"

defaults:
  source:
    kind: original
    licence: owned
    attribution: Written for Lodestar in the style of the qualification.
  quality: { reviewStatus: draft, confidence: 0.8 }

questions:
  - id: ${code}-example-1
    type: mcq
    topicIds: [t1_1]
    marks: 1
    prompt: TODO — the question
    response:
      choices:
        - { id: a, text: TODO — the correct option, correct: true }
        - { id: b, text: TODO — a wrong option,
            misconception: TODO — why a student would pick this, shown as feedback }
    markScheme:
      totalMarks: 1
      style: points
      modelAnswer: TODO

  - id: ${code}-example-2
    type: short-answer
    topicIds: [t1_1]
    commandWord: Explain
    marks: 4
    prompt: TODO — the question
    markScheme:
      totalMarks: 4
      style: points
      # One point per mark, each independently creditable, each written so a
      # student can honestly judge their own answer against it. The aoCode on
      # each point is what powers the assessment-objective heatmap.
      points:
        - { id: p1, text: TODO — what earns this mark, marks: 1, aoCode: AO1 }
        - { id: p2, text: TODO, marks: 1, aoCode: AO2 }
        - { id: p3, text: TODO, marks: 1, aoCode: AO3 }
        - { id: p4, text: TODO, marks: 1, aoCode: AO3 }
      modelAnswer: TODO
      nearMissAnswer: TODO — an answer that looks right and is not
      examinerNotes: TODO — why the near-miss falls short
    commonErrors:
      - { label: TODO, description: TODO, errorType: no-chain }
`,
);

writeFileSync(
  join(dir, "lessons", "example.md"),
  `---
id: lesson-example
syllabusId: "${syllabusId}"
topicId: t1_1
title: TODO — topic title
---

## 30 seconds

TODO — three sentences. The mechanism, not the definition.

## Simple

TODO — assume no prior knowledge. One analogy, labelled as an analogy, and its limits.

## Standard

TODO — mechanism, why it happens, one worked example, one boundary case.

## Exam

TODO — what the examiner rewards, and the two things candidates most often omit.

**Most commonly lost here:** TODO — the single mistake that costs the most marks.

## Misconceptions

- TODO — what students wrongly believe → TODO — the correction

## Limitations

- TODO — this fails when…

Every line here is an evaluation sentence waiting to be used, which is why this
section is worth writing carefully.

## Key terms

- **TODO** — TODO
`,
);

writeFileSync(
  join(dir, "flashcards", "core.yaml"),
  `syllabusId: "${syllabusId}"
cards:
  - { id: ${code}-card-1, kind: definition, topicIds: [t1_1],
      front: TODO, back: TODO }
`,
);

writeFileSync(
  join(dir, "glossary", "terms.yaml"),
  `syllabusId: "${syllabusId}"
entries:
  - term: TODO
    definition: TODO
    topicIds: [t1_1]
    confusedWith: []      # terms students mix this up with — drives comparison mode
    examUsage: TODO — how it would appear in a real answer
`,
);

console.log(`Created content/${packId}/

  pack.yaml
  syllabus/${subject.toLowerCase().replace(/\s+/g, "-")}-${code}.yaml
  questions/example.yaml
  lessons/example.md
  flashcards/core.yaml
  glossary/terms.yaml

Every file is a placeholder marked TODO, and the pack will not pass validation
until the syllabus is filled in — that is deliberate.

Next:
  1. Fill the syllabus from the official published document. Papers, assessment
     objective weightings and command words first: they are what the whole
     product reasons from.
  2. npm run content:check
  3. npm run dev, then open /library
`);
