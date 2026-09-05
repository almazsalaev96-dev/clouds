# Authoring content packs

Lodestar is an engine. Subject material is supplied as **packs** in `content/`,
and every engine in the product — spaced repetition, mastery, priority,
adaptive selection, mistake analysis, readiness, planning — runs off whatever a
pack provides.

The design rule is that **nothing is required that can be optional**. A pack with
a manifest and a list of topic titles loads and is useful; questions, lessons,
cards and glossary can be added over months. The product degrades gracefully
rather than breaking, and the Library page always shows exactly what is missing.

Open `/library` in the running app to see what loaded, every validation error
with its file and path, and which topics still have no questions.

---

## Directory shape

```
content/
  <pack-id>/
    pack.yaml              required — qualification, board, grade scale, rights
    syllabus/*.yaml        papers, assessment objectives, command words, topics
    questions/*.yaml       question banks with mark schemes
    lessons/*.md           explanations at five depths, formulas, misconceptions
    flashcards/*.yaml      recall cards
    glossary/*.yaml        terminology and confusions
```

Files beginning `_` or `.` are ignored, so drafts can sit alongside live content.
YAML, JSON and (for lessons) Markdown are all accepted.

---

## 1. `pack.yaml`

```yaml
id: cambridge-business-9609
name: Cambridge International AS & A Level Business (9609)
version: 0.2.0

qualification:
  id: cambridge-as-a-level
  level: a-level          # igcse | o-level | as-level | a-level | ib-dp | other
  title: Cambridge International AS & A Level
  awardingDescription: Cambridge Assessment International Education
  gradeScale: ["A*", "A", "B", "C", "D", "E", "U"]   # best first

examBoard:
  id: cambridge
  name: Cambridge Assessment International Education
  shortName: Cambridge

rights:
  summary: >
    What may and may not be reproduced from this pack. Shown on the Library page.
  defaultLicence: owned   # owned | licensed | public-domain | link-only | user-owned
```

`gradeScale` must be ordered best-first: the target-grade UI and the mastery
target both read it positionally.

---

## 2. Syllabus

The structural spine. Everything else references its ids.

```yaml
id: "9609"
code: "9609"
title: Cambridge International AS & A Level Business
subject: Business
qualificationId: cambridge-as-a-level
examBoardId: cambridge

version:
  label: 2026-2028
  firstExamYear: 2026
  lastExamYear: 2028
  changes: ["What changed from the previous version"]

papers:
  - id: 9609-p4
    code: "4"
    name: Business Strategy
    durationMinutes: 75
    rawMarks: 40
    weightOfQualification: 0.20     # 0..1, across all papers should total 1
    stage: a2                       # as | a2 | combined
    sections:
      - { code: A, name: Essays, marks: 40, questionCount: 2 }

assessmentObjectives:
  - id: ao3
    code: AO3
    name: Analysis
    description: "…"
    weightByPaper:                  # keyed by paper id, values 0..1
      9609-p1: 0.20
      9609-p4: 0.40

commandWords:
  - word: Analyse
    definition: Examine in detail to show meaning and identify elements.
    aoCeiling: [AO1, AO2, AO3]
    expects: Developed chains. There are no evaluation marks available.
    answerStructure: ["Point.", "Which means…", "So…", "Consequence here."]
    weakExample: "Delegation improves motivation."
    strongExample: "…"
    trap: "Writing evaluation into an Analyse question earns nothing and costs minutes."

topics:
  - { id: b5, code: "5", title: Finance and accounting, stage: as, examWeight: 0.1 }
  - { id: b5_3, code: "5.3", title: Break-even analysis, parentId: b5,
      prerequisites: [b5_2] }
```

### The two fields that do the most work

**`weightByPaper`** on assessment objectives. Boards publish these as
percentages; Lodestar converts them into raw marks per paper and per question.
That conversion is the most decision-relevant number in the product: a student
reads "40% of Paper 4 is analysis" as trivia and "8 of the 20 marks in this
essay" as an instruction about how to write.

**`prerequisites`** on topics. When a student fails twice on a topic, the
adaptive engine routes to the prerequisite rather than simply lowering
difficulty — because the cause is usually one level down. Prerequisites also
raise a topic's priority above its own mark value, since weakness in a hub
topic silently caps everything downstream. These edges are worth authoring
carefully; they are where a lot of the intelligence comes from.

**`examWeight`** is optional. Siblings that omit it split whatever their parent
has not claimed, evenly. Leaf weights are multiplied through the ancestor chain,
so across a syllabus they sum to 1.

---

## 3. Questions

```yaml
syllabusId: "9609"
defaults:                    # merged into every question in the file
  source: { kind: original, licence: owned }
  quality: { reviewStatus: human-reviewed, confidence: 0.9 }

questions:
  - id: b-5_3-calc-1
    type: numeric
    topicIds: [b5_3]
    commandWord: Calculate
    marks: 3
    prompt: >
      A company sells at $25, variable cost is $15, fixed costs are $80,000.
      Calculate the break-even output in units.
    response: { unit: units, workingSpace: true }
    difficulty: { knowledge: 0.3, reasoning: 0.35, calculation: 0.4,
                  language: 0.2, steps: 0.4, unfamiliarContext: 0.15 }
    markScheme:
      totalMarks: 3
      style: points
      acceptedValues: [{ value: 8000, tolerance: 1, unit: units }]
      points:
        - { id: p1, text: "Contribution identified: $25 − $15 = $10", marks: 1, aoCode: AO1 }
        - { id: p2, text: "Correct formula applied", marks: 1, aoCode: AO2 }
        - { id: p3, text: "Answer 8,000 units", marks: 1, aoCode: AO2 }
      modelAnswer: "…"
      nearMissAnswer: "An answer that looks right and is not."
      examinerNotes: "Why the near-miss falls short."
    hints: ["A hint", "A stronger hint"]
    commonErrors:
      - { label: "Divided by price", description: "…", errorType: formula-error }
```

### Types

`mcq` · `multi-select` · `numeric` · `short-answer` · `structured` · `essay` ·
`calculation` · `data-response` · `cloze` · `match` · `order` · `label-diagram` ·
`graph-read` · `code-trace` · `translation` · `true-false`

The first eight of these are **objectively markable**: Lodestar marks them
exactly, with no AI and no judgement, including diagnostics for the missing
×100, the inverted formula and the wrong unit. The rest go to the mark-scheme
ledger.

### Mark-scheme points are the most valuable thing you can author

Written answers are self-marked point by point, and each unticked point becomes
a classified mistake with a repair path and a review schedule. So a question
with a good point list produces far more than a score: it produces a diagnosis.

Write each point so a student can honestly judge their own answer against it.
Use `alternatives` for "accept also" wordings and `rejects` for the trap.
`aoCode` on each point is what powers the assessment-objective heatmap — the
chart that reveals a student who is strong on recall and weak on evaluation.

### Difficulty is six-dimensional

A question can be conceptually trivial and arithmetically brutal. The adaptive
engine needs to tell those apart when serving a student who is failing on
arithmetic but strong on concepts. All six default to sensible middles if
omitted, but authoring them properly makes selection markedly better.

### Rights

Every question declares `source.kind` and `source.licence`. The loader warns
when past-paper content is marked `owned`, and errors when `link-only` material
has no official URL. `link-only` material is never rendered as content — it is
linked to the awarding body. See `docs/CONTENT-RIGHTS.md`.

---

## 4. Lessons

Markdown with YAML front matter. H2 headings become explanation depths:

```markdown
---
id: lesson-break-even
topicId: b5_3
title: Break-even analysis
formulas:
  - name: Break-even output
    expression: fixed costs ÷ contribution per unit
    commonMistakes: ["Dividing by price rather than contribution."]
---

## 30 seconds
Three sentences. Mechanism, not definition.

## Simple
Assume no prior knowledge. One analogy, labelled as an analogy, plus its limits.

## Standard
Mechanism, why it happens, one worked example, one boundary case.

## Exam
What the examiner rewards, and the two things candidates most often omit.

## Deep
Underlying theory, edge cases, where the standard account simplifies.

## Misconceptions
- Break-even is where profit starts on each unit → Every unit contributes from the first.

## Limitations
- Assumes everything produced is sold.

## Key terms
- **Contribution** — Selling price minus variable cost per unit.
```

`## Limitations` is worth special attention: every "this fails when…" is an
evaluation sentence waiting to be used, and the Understand tab presents them as
exactly that.

---

## 5. Flashcards and glossary

```yaml
# flashcards/core.yaml
syllabusId: "9609"
cards:
  - { id: c-breakeven, kind: formula, topicIds: [b5_3],
      front: "Break-even output", back: "Fixed costs ÷ contribution per unit" }
```

```yaml
# glossary/business.yaml
entries:
  - term: Contribution
    definition: Selling price per unit minus variable cost per unit.
    topicIds: [b5_3]
    confusedWith: [Profit]        # drives comparison mode
    examUsage: "Contribution is $10, so 8,000 units cover $80,000 of fixed costs."
```

Cards are also created automatically from every mark a student loses, and those
are scheduled more aggressively than authored ones.

---

## Validating

```bash
npm run content:check
```

Prints per-pack statistics and every diagnostic. It exits non-zero on errors, so
it works as a CI gate. The same information is on `/library` in the app.

Checks performed:

- schema validity, with the file and path named
- unknown topic, objective, paper and syllabus ids
- duplicate question ids and duplicate mark-point ids
- mark-scheme points that do not sum to the question's marks
- MCQs with no correct option, or more than one on a single-answer question
- numeric questions with no accepted values; cloze questions with no blanks
- `link-only` material with no source URL
- past-paper content claiming rights it probably does not hold
- topics with no questions (reported as coverage gaps, not errors)

---

## A practical order of work

1. **`pack.yaml` and the syllabus.** Papers, AO weightings, command words,
   topics. This alone gives a working subject map, real AO mark conversions and
   the technique trainer.
2. **Prerequisite edges** between topics. Cheap to write, and they change how
   the adaptive engine and the priority ranking behave.
3. **Questions for the heaviest topics first.** Untested topics are treated as
   unlearned, so coverage drives the whole recommendation engine. Twenty good
   questions across the heavy topics beat two hundred on one.
4. **Mark schemes with `aoCode` on every point.** This is what turns scores into
   diagnoses and lights up the heatmap.
5. **Lessons for the topics students find hardest**, starting with
   `## Limitations` and `## Misconceptions` — the highest-value sections.
6. **Cards and glossary** last; mistakes generate cards on their own.
