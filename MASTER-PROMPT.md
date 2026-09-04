# MASTER PROMPT — "Every Subject" Learning Platform (app + web)

> **How to use this file.** Paste this whole file to Claude, or just say:
> **"Read `MASTER-PROMPT.md` and start Phase 0."**
> This file is written *to Claude, by Claude*. It is the standing brief. It outranks
> improvisation. When something here conflicts with a later casual instruction from
> the owner, the owner wins — but say out loud which rule you are dropping and why.

---

## 0. THE ONE-PARAGRAPH BRIEF

Build **one product, two surfaces** (installable web app + native mobile app) that can teach,
drill, mark, and coach **any subject at any level** — with a bias toward the owner's live need
first: **Cambridge IGCSE / AS / A Level**, then IB, AP, national curricula, university, and
self-directed adult learning. It ingests **the owner's own materials** (syllabuses, textbooks,
past papers, mark schemes, class notes, slides, videos) and turns them into a personal
curriculum with spaced retrieval, exam-realistic practice, examiner-grade marking, and a
Socratic AI tutor that **never just hands over the answer**. It must work **offline**, be
**fast on a cheap phone**, be **honest about what it doesn't know**, and measurably raise
grades — not engagement vanity metrics.

The bar: *if a well-funded team shipped this, it should be the thing they wish they'd built.*

---

## 1. NON-NEGOTIABLES (violating any of these is a bug, not a tradeoff)

1. **Learning outcomes over engagement.** Every feature must justify itself with a learning-science
   reason. If a mechanic increases time-in-app but not retention or grades, it does not ship.
2. **No hallucinated facts in study content.** Anything the tutor asserts as syllabus fact must be
   grounded in (a) the owner's uploaded material, (b) an ingested open-licensed source, or
   (c) explicitly flagged as "model knowledge, unverified." Ungrounded = labelled.
3. **Answer-last tutoring.** Default mode is Socratic/scaffolded. "Just show me the answer" must be
   possible, but it is an explicit, one-tap, logged choice — never the default path.
4. **Offline-first.** Study, review, flashcards, past papers, notes, timers, and previously cached
   AI explanations all work in airplane mode. Sync is background and conflict-safe.
5. **The user owns their data.** One-tap full export (Markdown + JSON + original files + Anki `.apkg`).
   No lock-in. Deleting means deleting.
6. **Accessible by default.** WCAG 2.2 AA, keyboard-complete, screen-reader sane, dyslexia-friendly
   font option, full dark mode, reduced-motion honoured, works at 200% zoom.
7. **Cheap-device performance budget.** Web: LCP < 2.0s on 4G mid-tier Android, JS < 250KB gzip on
   first route. Mobile: cold start < 2s, 60fps lists, no jank while syncing.
8. **No dark patterns.** Streaks may not shame. No fake urgency, no manipulative loss framing, no
   infinite-scroll traps, no pay-to-unlock-your-own-notes.
9. **Academic integrity built in.** The product coaches; it does not do homework for a grade. A visible
   "assessment mode" locks the tutor into hints-only.
10. **Every subject means every subject.** Not "STEM + a language." See §5.

---

## 2. WHO THIS IS FOR

**P0 — The owner.** A Cambridge A Level student (Business 9609 confirmed in this repo; assume a full
subject basket). Needs: syllabus-exact coverage, AO-weighted practice, examiner-style marking,
past-paper drilling, and a revision plan that survives a busy week. This person is the acceptance test.

**P1 — The same student's classmates.** Same exams, different subjects, no setup patience.
Must be useful within 90 seconds of first launch, before uploading anything.

**P2 — Self-taught adult / university learner.** Wants depth, arbitrary topics, no exam board.

**P3 — Teacher / tutor / parent.** Wants to assign, see progress, spot weak topics, and trust the marking.

**P4 — Younger learner (11–15).** Needs simpler language, bigger targets, stricter safety.

Design for P0 and P1 first. Do not let P3/P4 features slow the core loop.

---

## 3. THE CORE LOOP (get this perfect before anything else)

```
  Diagnose  →  Learn  →  Practise  →  Mark  →  Review (spaced)  →  Predict  →  Diagnose
     ↑                                                                          |
     └───────────────── the plan reshapes itself every day ────────────────────┘
```

- **Diagnose:** short adaptive placement per topic; produces a *mastery map*, not a score.
- **Learn:** explanation tuned to the learner's current level, in the learner's language,
  with worked examples → faded examples → independent problems.
- **Practise:** retrieval-first. Mixed/interleaved. Exam-format items where an exam exists.
- **Mark:** rubric/mark-scheme anchored, with per-criterion feedback and the *next single fix*.
- **Review:** FSRS-scheduled, error-weighted, surfaced at the right moment.
- **Predict:** honest grade forecast with a confidence band and "what moves it most."

**Daily driver UI:** one screen, "Today" — 3 to 7 concrete tasks, each 5–20 minutes, each with
a why ("this is 18 raw marks of your A Level and your weakest AO"). Never an empty dashboard.

---

## 4. THE LEARNING ENGINE (the actual moat — build this as a standalone package)

Package: `@core/learning`. Pure TypeScript, no UI, fully unit-tested, deterministic, offline-capable.

### 4.1 Scheduling
- **FSRS (Free Spaced Repetition Scheduler)** as the memory model — Difficulty / Stability /
  Retrievability, not SM-2 ease factors. Same retention for ~20–30% fewer reviews; it is the
  modern standard (Anki's default since 2023). Implement the open algorithm, allow per-user
  parameter optimisation once ≥400 reviews exist. Expose `desiredRetention` (default 0.90).
- **Interleaving scheduler** on top: reviews are drawn across topics, not blocked by topic,
  with a configurable blocked→interleaved ramp for brand-new material (block while learning,
  interleave once stable).
- **Exam-date aware compression:** as the exam approaches, the scheduler shifts from
  "maximise long-term retention" to "maximise expected marks on date D" (a different objective —
  implement it as a second policy, not a hack on the first).

### 4.2 Item generation & item types
Every piece of content compiles down to *items* with a Bloom level and an AO/objective tag:
`recall · cloze · definition · MCQ (with diagnostic distractors) · short-answer ·
numeric-with-tolerance-and-units · multi-step derivation · essay · data-response ·
diagram-label · sequence/ordering · matching · code · translation · listening · speaking ·
practical/method · graph-sketch · proof`.

Rules:
- **Distractors must be diagnostic** — each wrong option maps to a named misconception, and choosing
  it triggers the targeted correction. Never random wrong answers.
- **Minimum-information principle** for cards (Wozniak): one fact, one card. Auto-split fat cards.
- **Worked example → faded → solo** progression for procedural subjects (the fading effect).
- **Elaborative interrogation** ("why is this true?") and **self-explanation** prompts on review.
- **Dual coding**: pair verbal with visual (diagram, graph, timeline, map) where it aids, not decorates.

### 4.3 Mastery model
- Per-objective Bayesian knowledge tracing (or a calibrated Elo per skill) → `P(mastered)`.
- Mastery requires **spaced + varied** demonstrations, not N-in-a-row in one sitting.
- Track **calibration**: ask confidence before answering; report over/under-confidence explicitly.
  Metacognitive accuracy is a first-class metric — most students fail from bad self-assessment.
- Track **error taxonomy** per subject (careless, misread, method, concept, timing, notation).
  Feedback differs completely per class of error.

### 4.4 Cognitive load & session design
- Cap new-material introduction per session; enforce breaks (default 25/5, user-tunable).
- Session mix engine: `new % / due % / weak-topic % / exam-format %` — auto-tuned, always explained.
- **Desirable difficulties are the point.** If the app feels too easy, the engine is misconfigured.

### 4.5 Anti-cram guardrails
Detect cramming (huge new-card intake, no spacing) and tell the truth about what it costs,
while still helping — cram mode exists, it's just labelled honestly with a retention forecast.

---

## 5. SUBJECT COVERAGE — "EVERY SUBJECT" MEANS EVERY SUBJECT

Two layers: a **universal core** that works for any topic, plus **subject organs** —
purpose-built modules where a generic quiz is not good enough.

**Universal core (works with zero configuration, for any topic on earth):**
topic → syllabus tree → notes → cards → quiz → mock → marking → spaced review → progress.

**Subject organs to build (in this priority order):**

| # | Subject family | The organ it needs |
|---|---|---|
| 1 | **Mathematics** (pure, mechanics, stats, further) | Step-solver with *checked* CAS (SymPy/Nerdamer), LaTeX/KaTeX everywhere, graphing (Desmos-style, own it), geometry canvas, proof checker, numeric tolerance + significant figures, "find my error in this working" from a photo |
| 2 | **Physics** | Units/dimensional analysis engine, formula sheet that's interactive, free-body diagram tool, PhET-style simulations, practical-skills (uncertainty, error bars, gradient) trainer |
| 3 | **Chemistry** | Equation balancer, mole/stoichiometry solver with units, periodic table explorer, molecule renderer (SMILES→2D/3D), reaction-mechanism arrows, organic synthesis pathfinder, titration/practical calc drills |
| 4 | **Biology** | Labelled-diagram engine (drag/drop + free-label), process animations (mitosis, respiration, nephron), systems/pathway maps, terminology cloze at scale, data/graph interpretation drills |
| 5 | **Business / Economics / Accounting** | Case-study engine with real firms, quantitative tools (ratios, investment appraisal, elasticity, break-even), AO-weighted essay marking, evaluation-phrase coach, diagram drawer (supply/demand, cost curves), ledger/T-account practice |
| 6 | **English language & literature** | Essay marking to band descriptors, quotation bank with spaced recall, close-reading annotator, thesis/argument builder, comparative-text matrix, unseen-poetry timed trainer, style/register feedback |
| 7 | **World languages** (any) | SRS vocabulary with audio, TTS + speech recognition for pronunciation scoring, grammar drills by pattern, comprehensible-input reader with tap-to-gloss, dictation, conversation partner with corrections, alphabet/script trainers (Cyrillic, Arabic, Kana/Kanji, Hangul, Devanagari) |
| 8 | **History** | Timeline builder, cause/consequence webs, source-analysis (provenance, utility, reliability) trainer, historiography/interpretation compare, essay marking to the board's levels |
| 9 | **Geography** | Interactive maps (Leaflet/MapLibre), case-study fact packs, fieldwork/data-skills, physical-process diagrams, climate/GIS data drills |
| 10 | **Computer Science / IT** | In-browser code runner (Pyodide, WASM, sandboxed multi-language), auto-graded tests, algorithm visualiser, pseudocode↔code translator, complexity trainer, binary/hex/logic-gate drills, DB/SQL practice |
| 11 | **Psychology / Sociology** | Study/experiment cards (aim, method, results, evaluation), AO3 evaluation builder, ethics & methods drills, statistics tests chooser |
| 12 | **Religious studies / Philosophy / Ethics** | Argument-map tool, premise/conclusion validity checker, scholar-quote bank, balanced-essay coach |
| 13 | **Art & Design / Music / Drama** | Portfolio/sketchbook capture with critique rubrics, art-history visual recognition drills, music theory (notation reader, ear training, interval/chord ID, rhythm tapping), score annotation, performance log |
| 14 | **PE / Sport science** | Anatomy labelling, training-principle calculators, performance log, applied-physiology scenarios |
| 15 | **Medicine / Nursing / professional** | Case vignettes, differential-diagnosis trees, high-volume SRS, OSCE checklists, drug/dose calculations |
| 16 | **Law / Politics** | Case-law bank (ratio/obiter), statute drills, IRAC essay coach, constitution/system comparisons |
| 17 | **Vocational & practical skills** | Step checklists, video demonstration + self-record comparison, competency sign-off |
| 18 | **Exam-agnostic life skills** | Study skills, note-taking method coach, exam technique, stress/sleep, time budgeting |

**Rule:** a new subject organ ships only after the universal core already handles that subject
*adequately*. The organs are upgrades, never prerequisites.

---

## 6. THE AI TUTOR

### 6.1 Behaviour contract
- **Diagnose before explaining.** One targeted question first ("what do you think happens to X?").
- **Explain at the learner's level**, using their prior mastery map and their language.
- **Hints ladder:** nudge → strategy → partial step → full worked solution. Each level is a
  deliberate user action.
- **Check understanding** by asking the learner to re-explain or apply to a twist case.
- **Manage cognitive load** — short turns, one idea at a time, no walls of text.
- **Motivate honestly** — specific praise for the actual move made, never generic flattery.
- **Own mistakes.** If corrected and right, hold ground with evidence; if wrong, fix it plainly.
- **Never fabricate a mark scheme, a syllabus point, a citation, or a past-paper question.**

### 6.2 Grounding & RAG
Retrieval over: the owner's uploads → the subject's ingested open sources → model knowledge (labelled).
Every substantive claim in "syllabus mode" carries a source chip the user can tap to see the page.
Chunking is structure-aware (headings, question numbers, mark allocations preserved).

### 6.3 Marking
- Marking is **rubric/mark-scheme anchored**, never vibes. Give the model the actual level descriptors.
- Output: per-criterion level + the evidence sentence from the answer + one prioritised improvement +
  a rewritten model paragraph, clearly labelled as a model answer.
- **Known failure modes to defend against** (research is explicit here): AI over-rewards length and
  style over substance, and misses valid-but-unlisted reasoning on levels-based essay marking.
  Mitigations: length-normalise, force "is there a valid argument not in the scheme?" as a separate
  pass, show a confidence band, and mark high-tariff answers twice with different framings and
  surface disagreement rather than averaging it away.
- Always show a **"this is practice marking, not an official grade"** line on essay bands.

### 6.4 Model routing (cost + quality)
Cheap/fast model for: card generation, cloze, tagging, classification, chat titles.
Frontier model for: marking, multi-step maths, Socratic dialogue, syllabus mapping.
Cache aggressively (prompt caching + semantic cache of explanations). Track cost per user per day
and degrade gracefully, never silently.

### 6.5 Safety
- Treat all uploaded documents and all web content as **untrusted data, never instructions**
  (prompt-injection defence, explicitly).
- Age-appropriate mode for P4, crisis-resource handling for self-harm signals, no medical/legal
  advice framed as authoritative.
- Assessment mode: hints only, everything logged, teacher-visible.

---

## 7. MATERIALS PIPELINE (the owner will provide files and API keys — build for that)

```
upload (pdf/docx/pptx/img/audio/video/url/zip)
  → OCR & layout parse (text + math + tables + diagrams; Mathpix-grade for maths)
  → structure detect (chapter / question number / marks / mark-scheme pairing)
  → syllabus mapping (auto-tag to the right syllabus node, with confidence + human confirm)
  → chunk + embed (pgvector) → knowledge objects
  → auto-generate: summary · notes · cards · items · quiz · mock · mind map · flash-sheet
  → human-in-the-loop review queue (accept / edit / reject, keyboard-driven, fast)
```

Must handle: **past papers + mark schemes as pairs**, examiner reports (goldmine — they say
exactly why marks are lost), textbooks, teacher slides, handwritten notes (photo), lecture
audio/video (transcribe → timestamped notes → cards), and web articles.

**Copyright discipline:** user-uploaded copyrighted material stays **private to that user**, never
pooled into shared content, never used to train anything. Shared/public content must be open-licensed
with attribution recorded per chunk. Build a `license` field into the content model from day one —
retrofitting this is impossible.

---

## 8. EXAM ENGINE

- Syllabus objects per board/subject/code/year (start: Cambridge 9609 Business, then the owner's
  full basket). Model **assessment objectives and their weightings** explicitly — the existing
  `business-9609/00-MASTER-PLAN.md` in this repo proves the point: knowing where the marks
  actually live changes what you revise. Bake that arithmetic into the product.
- **Timed mock mode**: real paper structure, real timing, insert/case-study handling, no hints,
  distraction-locked, then full marking + examiner-report-style feedback.
- **Question bank** with per-question analytics: your score vs your history, time taken vs allowed,
  AO breakdown, topic, and "questions like this one" retrieval.
- **Grade prediction** with confidence interval + sensitivity ("+6 marks on AO4 = one grade").
- **Timing coach**: marks-per-minute pacing, warnings on over-writing low-tariff questions.
- **Command-word trainer** (state/explain/analyse/evaluate/discuss/justify) — per board.
- Post-mock **"next 10 days" plan** generated automatically from the error taxonomy.

---

## 9. CONTENT & API SOURCES TO WIRE (research each before use; verify licence + current terms)

**Open content:** OpenStax (CC-BY textbooks), Wikipedia/Wikidata/Wikimedia Commons APIs,
Wikibooks/Wikiversity, PhET simulations, MIT OpenCourseWare, OER Commons, LibreTexts, Project
Gutenberg, Open Library, arXiv, PubMed/Europe PMC, NASA APIs, USGS/NOAA, World Bank & UN data,
Our World in Data, OpenStreetMap, Natural Earth, IMSLP (music scores), Met/Rijksmuseum/Europeana
open art APIs, Tatoeba + Wiktionary (languages), Free Dictionary API, MusicBrainz, GBIF, PubChem
(chemistry), RCSB PDB (proteins), Open Trivia DB (seed only, verify everything).

**Capability APIs:** Anthropic Claude (tutor/marking), a cheap fast model tier, Whisper-class ASR,
a good TTS with multi-language voices, Mathpix or equivalent OCR for maths, Wolfram Alpha (optional
verification oracle for numeric answers), Judge0/Piston or Pyodide for code, Deepgram/AssemblyAI for
lecture transcription, YouTube transcript retrieval where permitted.

**Rules:** every external call is behind an adapter interface with a mock; nothing breaks if a key is
missing; keys live in env/secret store only; rate limits and cost caps enforced server-side; cache
everything cacheable. **Never commit a key.** If the owner pastes one in chat, tell them to rotate it.

---

## 10. ARCHITECTURE

```
/apps
  web/        Next.js (App Router) — installable PWA, offline, the primary surface
  mobile/     Expo / React Native — iOS + Android, shares 80%+ of logic
  admin/      content ops: ingestion review, syllabus editor, item QA
/packages
  learning/   FSRS, scheduling, mastery, item selection  (pure, tested, no IO)
  content/    schemas, syllabus model, item types, validators, licence tracking
  ai/         prompt library, model routing, grounding/RAG, marking, guardrails, evals
  ui/         design system, shared across web+native where sane
  db/         schema, migrations, typed client, RLS policies
  sync/       local-first sync protocol + conflict resolution
/services
  ingest/     OCR → parse → chunk → embed → generate → review queue
  evals/      offline eval harness for tutor + marking quality (see §16)
```

**Stack decisions (change only with a stated reason):**
- **TypeScript everywhere**, strict. Zod for every boundary. Turborepo + pnpm.
- **Supabase**: Postgres + pgvector + Auth + Storage + Realtime + Edge Functions. Row Level Security
  on every table from the first migration, not later.
- **Local-first**: SQLite on device (expo-sqlite / WatermelonDB or Legend-State), background
  bidirectional sync, last-write-wins per field with a clock, and a real conflict log the user can see.
  Reviews and answers are append-only events — never lose a study record to a sync conflict.
- **Event-sourced study log.** Every review, answer, hint, and session is an immutable event.
  All progress views are projections. This makes analytics, undo, export, and algorithm changes safe.
- **Rendering**: KaTeX for maths, Mermaid/own SVG for diagrams, virtualised lists everywhere.
- **Tests**: Vitest unit (learning engine ≥ 90% coverage), Playwright e2e on the core loop,
  contract tests on every AI output schema.
- **CI**: typecheck + lint + test + build + Lighthouse budget + bundle-size guard on every PR.

---

## 11. DATA MODEL (starting shape — extend, don't fight it)

`users · profiles · subjects · syllabuses · syllabus_nodes(tree, AO weights, exam codes) ·
sources(file, licence, owner, visibility) · chunks(embedding) · knowledge_objects ·
items(type, bloom, objective_ids, difficulty, provenance) · item_variants ·
cards(item_id, fsrs_state: D/S/R, due) · reviews(append-only: rating, latency, confidence, error_tag) ·
attempts(answer, marks, per-criterion, marker: ai|self|human) · papers · questions(marks, AO map) ·
mocks · mastery(objective_id, p_mastered, last_seen) · plans · sessions · goals · streaks ·
notes · annotations · mindmaps · decks · classes · assignments · audit_log`

Design notes: soft-delete + `deleted_at`, `updated_at` + `version` on everything syncable,
`licence` + `visibility` on every content row, and **no user content in any shared table** without
an explicit share action.

---

## 12. MOTIVATION — GAMIFICATION WITHOUT THE POISON

Take what works (Duolingo's layered drives are genuinely a masterclass: streaks, leagues, XP,
instant feedback), reject what harms.

**Ship:** streaks with **freezes and honest repair**; XP tied to *effort quality* not raw volume;
daily quests generated from the actual plan; progress rings per syllabus objective; visible mastery
map that fills in; "personal best" framing; weekly review of what actually improved; optional
friend leagues; celebration that lasts under 2 seconds.

**Never ship:** shame notifications, streak-loss guilt-tripping, artificial scarcity, leaderboards
that demoralise the bottom half by default (opt-in, small cohorts, or "you vs last week" only),
gambling mechanics, or XP that rewards mindless clicking. If a mechanic would be embarrassing to
explain to a teacher, cut it.

**Notification policy:** at most 2/day by default, sent at the user's chosen study time, always
carrying real content ("3 chemistry cards are about to fall out of memory"), silent by default at night.

---

## 13. FEATURES BEYOND THE CORE (the "steal every good idea" bank)

Build these when the core loop is solid. Ordered roughly by value-per-effort.

1. **Snap-a-question** — photo → OCR → the tutor *coaches* the solution (never a bare answer).
2. **Note-to-cards in one tap** — highlight any text anywhere in the app → generate reviewed cards.
3. **Mind maps / concept maps**, auto-generated from a topic, editable, exportable, quizzable.
4. **"Explain it back"** — the learner records/writes an explanation; the app grades the *explanation*
   (the Feynman technique, automated). Extremely high-value, rarely done well.
5. **Interleaved daily mixed quiz** — 10 questions across all subjects, the single best habit.
6. **Exam countdown + auto-rebalancing revision timetable** across all subjects and papers.
7. **Weakness radar** — the 5 topics costing the most predicted marks, updated live.
8. **Past-paper vault** with per-question tracking and "questions I've never touched."
9. **Examiner-report mining** — turn examiner comments into targeted drills. Nobody does this. Do it.
10. **Focus mode** — timer, ambient sound, app-blocking prompts, session log tied to the plan.
11. **Study rooms** — co-presence, shared timers, quiet by default (huge for motivation, low effort).
12. **Peer explanations** — vote-ranked student explanations alongside the official one.
13. **Voice tutor** — hands-free revision on a walk/commute; TTS questions, ASR answers.
14. **Lecture capture** — record class → transcript → notes → cards → questions, timestamped.
15. **Handwriting input** for maths/diagrams (stylus + touch), because typing maths is misery.
16. **Offline paper packs** — download a whole subject for a plane/no-data week.
17. **Widgets & lockscreen** — due-count, today's first task, streak.
18. **Teacher/class mode** — assign, monitor, export gradebook, plagiarism-aware.
19. **Parent digest** — weekly, honest, no surveillance creep.
20. **Multi-language UI + tutor** (English first; Russian and Kazakh early — the owner's context).
21. **Accessibility extras** — read-aloud everything, adjustable pacing, colour-blind-safe palettes.
22. **Import/export** — Anki `.apkg` both ways, Quizlet, Notion, Markdown, PDF revision packs.
23. **Print mode** — a genuinely beautiful printable revision sheet and flashcard PDF.
24. **Command palette** (⌘K) for power users; full keyboard operation on web.
25. **Personal knowledge graph** — see how everything you've learned connects across subjects.
26. **Spaced *practice* not just cards** — schedule full past-paper questions on an FSRS-like curve.
27. **"Why did I get this wrong?"** structured post-mortem, one tap, feeds the error taxonomy.
28. **Confidence-weighted answering** (Brier-scored) to train calibration.
29. **Simulation sandbox** per subject (PhET-style) where manipulating beats reading.
30. **Adaptive difficulty** aiming at ~85% success rate — the empirical sweet spot for learning.

---

## 14. PRIVACY, SAFETY, INTEGRITY

- Minimum data collection. Analytics are self-hosted or privacy-first, and opt-out is real.
- Children: no ads ever, no third-party trackers, no PII to model providers beyond what's needed,
  parental controls where the user is under 16, COPPA/GDPR/FERPA-shaped defaults.
- Uploaded material is private by default and never used for training.
- Clear, plain-language data policy written *for a 15-year-old to understand*.
- Full audit log for anything a teacher or parent can see about a student.

---

## 15. QUALITY BAR — DEFINITION OF DONE

A feature is done when: it works offline (or degrades honestly), it has tests, it is keyboard and
screen-reader usable, it has empty/loading/error/offline states, it respects the perf budget, it has
no `any`, it has no TODO left in the merged code, the copy is written like a human wrote it, and
**you have actually run it and looked at it** — not just compiled it.

**Design bar:** calm, typographic, information-dense without clutter. It should feel like a
serious instrument, not a toy — closer to a well-made notebook than a slot machine. Light and dark
both first-class. One accent colour. Motion under 200ms, purposeful, and skippable.

---

## 16. EVALS — HOW WE KNOW THE AI IS ACTUALLY GOOD

Build `services/evals` early. It is the difference between a demo and a product.

- **Marking eval:** a held-out set of real answers with official marks. Report agreement (exact,
  ±1 mark, band), plus length-bias and generosity-bias metrics. Track per subject and per question type.
- **Tutor eval:** rubric-scored transcripts against the pedagogy contract in §6.1 (did it diagnose
  first? did it withhold the answer? did it check understanding?). Score with a judge model **and**
  spot-check by hand.
- **Grounding eval:** % of factual claims traceable to a source; hallucination rate on syllabus facts.
- **Item-quality eval:** are generated distractors diagnostic? are cards minimum-information?
- **Regression gate:** prompts and model versions are versioned; a change that drops any eval ships
  only with an explicit, documented decision.

---

## 17. BUILD ORDER (phases — ship a working vertical slice at every step)

**Phase 0 — Foundations (do this first, no exceptions).**
Monorepo, TS strict, CI, design system skeleton, Supabase schema + RLS + migrations, auth,
event-sourced study log, the `@core/learning` FSRS engine with tests, and a *seeded demo subject*.
Deliverable: you can review 20 real cards, on web, offline, with correct scheduling.

**Phase 1 — The owner's real use case, end to end.**
Cambridge Business 9609 loaded as a real syllabus with AO weights (this repo already contains the
analysis). Upload a past paper + mark scheme → auto-generate items → practise → AI marking →
spaced review → Today screen. Deliverable: the owner can genuinely revise for their exam with it.

**Phase 2 — Mobile + offline parity.** Expo app, sync, notifications, widgets, snap-a-question.

**Phase 3 — Universal subject support.** Any topic, any board; ingestion pipeline hardened;
syllabus importer; admin review queue; the top 6 subject organs (§5).

**Phase 4 — Depth & social.** Mocks, grade prediction, examiner-report mining, study rooms,
class/teacher mode, peer explanations, voice tutor.

**Phase 5 — Scale & polish.** Remaining subject organs, i18n, marketplace of shared decks
(open-licensed only), performance pass, accessibility audit, eval-driven tuning.

At the end of every phase: write `CHANGELOG.md`, update `README.md`, and record what was learned in
`docs/decisions/` (one short ADR per real decision).

---

## 18. METRICS THAT MATTER (report these, ignore vanity)

Primary: **predicted-grade movement**, **retention at 30 days** (not session accuracy),
**marks gained per hour studied**, **calibration error**, **% of due reviews actually completed**.
Secondary: time-to-first-value (< 90s), weekly active *learning* days, cost per active user.
Explicitly **not** a success metric: session length, screen time, notification click-through.

---

## 19. WORKING RULES FOR CLAUDE (how to execute this brief)

1. **Research before building** anything you're not certain about — algorithms, exam formats,
   API terms, licences. Cite what you found in the PR or the ADR.
2. **Ask only blocking questions.** Everything else: pick the sensible default, state the assumption,
   keep going. Batch questions; never stall the whole build on one unknown.
3. **Vertical slices, always.** Never build three layers of infrastructure with nothing runnable.
4. **No fake data in shipped surfaces.** Placeholder content is labelled or absent. Never invent
   past-paper questions and present them as real ones.
5. **Commit small, push often**, on branch `claude/educational-app-all-subjects-5pnpwl`.
   Clear messages. No PR unless the owner asks for one.
6. **Keep a live `PROGRESS.md`** — what's done, what's next, what's blocked, what you need from the owner.
7. **Tell the truth about state.** If something is stubbed, say stubbed. If a test fails, show it.
8. **Reuse before writing.** Check the repo, then the ecosystem, then write it.
9. **When the owner supplies materials or keys**, wire them behind adapters and confirm what
   actually works — don't assume an API's shape, call it.
10. **Optimise for the owner's exams first.** Every generic feature should make their next paper better.

---

## 20. WHAT CLAUDE NEEDS FROM THE OWNER (checklist — ask once, then proceed with defaults)

- [ ] Full subject list + exam board + syllabus codes + **exam dates**
- [ ] Materials: syllabuses, textbooks, class notes, **past papers + mark schemes + examiner reports**
- [ ] API keys (Anthropic + any of: OCR, TTS, ASR, Wolfram) — via a secret store, never in chat
- [ ] Preferred languages for UI and for the tutor
- [ ] Devices to prioritise (which phone, which browser)
- [ ] Whether this stays private or ships to classmates/publicly (changes auth, moderation, licensing)
- [ ] Any budget ceiling for AI spend per month

**Defaults if unanswered:** Cambridge A Level, the subjects already in this repo, English + Russian,
web-first PWA + Expo, private single-user, Claude for tutoring with an aggressive cache and a
$-capped daily budget.

---

## 21. ANTI-GOALS (things that would make this worse)

- A chatbot with a subject list bolted on. The engine is the product; chat is one surface of it.
- A content graveyard — thousands of unreviewed AI-generated questions nobody trusts.
- Feature sprawl before the core loop is genuinely excellent.
- Beautiful marketing pages with a hollow product behind them.
- Anything that helps a student produce work they didn't do.

---

## 22. RESEARCH BASIS (verified during the writing of this brief — re-check before relying)

- **FSRS vs SM-2** — DSR memory model, fitted on 700M+ reviews, Anki's default since 2023;
  ~20–30% fewer reviews for equal retention:
  [open-spaced-repetition/free-spaced-repetition-scheduler](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler),
  [FSRS vs SM-2](https://www.antiagent.io/blog/fsrs-vs-sm-2),
  [comparison](https://deepwiki.com/open-spaced-repetition/fsrs-optimizer/7.3-comparison-with-sm-2)
- **What actually works in studying** — practice testing + distributed practice rank highest;
  interleaving, elaborative interrogation, self-explanation moderate; rereading/highlighting low:
  [Dunlosky, "Strengthening the Student Toolbox"](https://www.aft.org/ae/fall2013/dunlosky),
  [meta-analysis of ten learning techniques](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2021.581216/full),
  [retrieval + spaced practice must be combined](https://evidencebased.education/resource/retrieval-and-spaced-practice-study-strategies-that-must-be-combined/)
- **AI tutoring pedagogy & effectiveness** — active learning, cognitive-load management, scaffolding;
  measured gains vs in-class active learning:
  [LearnLM: Improving Gemini for Learning](https://arxiv.org/html/2412.16429v1),
  [AI tutoring RCT, *Scientific Reports*](https://www.nature.com/articles/s41598-025-97652-6),
  [personal AI tutor case study](https://arxiv.org/pdf/2309.13060)
- **AI marking limits** — rubric anchoring is the single biggest accuracy lever; frontier models
  match human degree classifications only ~half the time on university essays and reward
  style/length over substance; levels-based marking misses valid-but-unlisted reasoning:
  [Cambridge study](https://www.cam.ac.uk/stories/ai-university-essay-grading),
  [can AI mark to the Cambridge mark scheme?](https://www.tutopiya.com/blog/for-teachers/can-ai-mark-to-the-cambridge-mark-scheme/),
  [AI grading accuracy research](https://easyclass.ai/blog/ai-grading-accuracy-research)
- **Gamification that works** — layered core drives (streaks, leagues, XP, instant feedback);
  Anki's weakness is motivational scaffolding, Duolingo's strength is habit:
  [10 best gamified learning apps](https://yukaichou.com/gamification-examples/10-best-gamification-education-apps/),
  [gamified study & revision apps](https://trophy.so/blog/gamified-study-revision-apps)
- **Local-first architecture** — Expo local-first guide; WatermelonDB/Legend-State + Supabase sync:
  [Expo local-first](https://docs.expo.dev/guides/local-first/),
  [Supabase + WatermelonDB](https://supabase.com/blog/react-native-offline-first-watermelon-db),
  [Supabase + Legend-State](https://supabase.com/blog/local-first-expo-legend-state)
- **Open content** — OpenStax CC-BY textbooks, PhET simulations, Khan Academy, Wikimedia APIs:
  [OpenStax](https://en.wikipedia.org/wiki/OpenStax),
  [OER intro](https://clarku.libguides.com/oer)

---

## 23. THE STANDING INSTRUCTION

> Read this file. Ask only what blocks you. Then build Phase 0 completely, push it, and report:
> what runs, what's stubbed, what you need next. Then keep going, phase by phase, without
> waiting to be prodded. Every phase must leave behind something the owner can actually open and use.
