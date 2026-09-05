# Roadmap — what is built, what is partial, what is not

An honest map of the full specification against what exists in this repository.
Nothing below is marked ✅ unless it works with real data and is reachable in the
running app.

**Legend** — ✅ built · ◐ partial · ○ not started · ⊘ deliberately not doing

---

## Phase 1 — the core loop (essentially complete)

| # | System | | Notes |
|---|---|---|---|
| 1 | Product philosophy | ✅ | Optimises marks-per-hour, not time-on-site. No engagement metrics anywhere. |
| 2 | Personal academic profile | ✅ | Six mastery signals, retention, error patterns, response time, confidence calibration, command-word performance, mark-loss patterns — all derived from the attempt log. |
| 3 | Information architecture | ◐ | 15 areas, grouped by intent (Now / Learn / Prove / Organise) rather than a flat list of 20. Skills, Challenges, Groups not built. |
| 4 | Home dashboard | ✅ | Answers all five questions above the fold. Every metric leads to an action. |
| 5 | Exam board + syllabus engine | ✅ | Full hierarchy, syllabus versions, per-paper AO weightings converted to raw marks, command words, grade-threshold schema. Board is configuration, not code. |
| 6 | Subject page | ✅ | Topic map, mastery vs target, paper structures, AO mark tables. |
| 7 | Topic page | ◐ | Five tabs (Understand / Practise / Recall / Exam / Mistakes), opening on whichever step the evidence says you need. Nine-tab split not built; the extra tabs would have been navigation, not capability. |
| 8 | Understand mode | ✅ | Five explanation depths from pack content; deeper questioning via the tutor. |
| 10 | Micro-lessons | ✅ | Authored and displayed; per-unit mastery scoring not separated yet. |
| 11 | Active recall engine | ✅ | 16 question types; format varied deliberately across a session. |
| 12 | Question engine | ✅ | Universal metadata model powering every filter and the whole personalisation engine. |
| 16 | AI marking engine | ◐ | Route, prompts and structured schema built and constrained; not yet wired into the answer UI, which currently uses the ledger. |
| 17 | Mark-loss analytics | ✅ | 20-category taxonomy, technique-versus-knowledge split, prescriptions. |
| 18 | Mistake Lab | ✅ | Every lost mark is an object with cause, repair ladder, and auto-minted review card. |
| 19 | Wrong-answers mode | ✅ | Practice filter, plus the dedicated re-attempt queue. |
| 20 | Spaced repetition | ✅ | FSRS-family, exam-aware, importance-weighted. |
| 21 | Flashcards | ◐ | Eight card kinds, mistake-generated cards, intervals shown before grading. Rapid-fire and confidence modes not built. |
| 22–24 | AI tutor / Socratic / Examiner | ✅ | Eight modes, given real student standing and the pack's own command words. |
| 30 | Diagnostic test | ◐ | The adaptive engine performs the same function continuously; no distinct pre-study diagnostic flow. |
| 31 | Smart study plan | ✅ | Re-derived every open; phases as proportions of remaining time. |
| 32 | Priority score | ✅ | Expected marks per hour, with diminishing returns and prerequisite weighting. |
| 33–34 | "What should I study" / session generator | ✅ | Every screen; nine length presets; shaped sessions with definitions of done. |
| 35 | Focus mode | ✅ | Minimal interface, timer, session objective. |
| 41 | Grade forecast | ✅ | Always a range, always with confidence and caveats. Refuses to project below eight attempts. |
| 44 | Difficulty engine | ✅ | Six dimensions, not easy/medium/hard. |
| 45 | Adaptive questioning | ✅ | Targets ~75% success; routes to prerequisites after two failures. |
| 46 | Interleaving | ✅ | Maximum-distance interleaving, not random shuffle. |
| 50–51 | Command word / answer structure trainer | ✅ | AO ceilings, traps, weak-versus-strong examples, mark-tally table derived from real AO weightings. |
| 57–58 | Glossary / comparison mode | ✅ | Confusable terms shown side by side. |
| 59 | Explain my mistake | ✅ | Cause, what was required, and a repair ladder ordered by cause type. |
| 60 | Confidence calibration | ✅ | Detects the fluency illusion. |
| 61–63 | Mastery / decay / prerequisites | ✅ | All three, with prerequisite failure surfaced on the topic page. |
| 67 | Daily mission | ✅ | Generated from priorities, review load and open mistakes. |
| 70–71 | Readiness centre / preparation checklist | ✅ | Eight dimensions, limiting factor named, explicit "what this does not know". |
| 75 | Global search | ✅ | Command bar over topics, command words, glossary; reads a number as a session length. |
| 85 | Accessibility | ✅ | Dark mode, font scale, high contrast, dyslexia-friendly, reduced motion, keyboard nav, focus never removed, SVG text alternatives. |
| 86–87 | Responsive / UI principles | ✅ | Editorial, calm, progressive disclosure. Colour carries meaning only. |
| 88 | Command bar | ✅ | ⌘K. |
| 92–96 | Content quality, source of truth, rights, AI safety | ✅ | Licence field enforced by the loader; AI constrained to supplied material. |
| 100 | Question bank architecture | ✅ | Questions versioned separately from attempts. |
| 101–103 | Analytics / student analytics / heatmap | ✅ | Event-derived; heatmap encodes evidence volume as opacity. |
| 108 | Post-session review | ✅ | What improved, what is still weak, what next. |
| 140–143 | Architecture, provider abstraction, cost control, cache | ✅ | Server-only, task-routed, budgeted, cached. |
| 147–150 | Event model, personalisation, recommendation, "why am I seeing this" | ✅ | Explainability is a hard contract, not a feature. |
| 155 | Testing | ✅ | 75 unit tests, content validation CLI, 21-check browser suite. |
| 159–162 | Design system, hierarchy, micro-interactions, command centre | ✅ | Hand-authored; no UI framework. |
| 163–164 | Core differentiator and the main loop | ✅ | Diagnose → learn → recall → practise → mark → understand → adapt → review → mock → analyse. |
| 185 | Failure handling | ✅ | Typed AI errors carrying the deterministic alternative. Never "something went wrong". |
| 187–189 | Data ownership, privacy, product language | ✅ | One-file export, local-first, coach's register throughout. |

---

## Phase 2 — the obvious next work

| # | System | | What is needed |
|---|---|---|---|
| 9 | Concept maps | ○ | `conceptEdges` exist in the lesson schema; needs a force-directed SVG view. |
| 13 | Question generator UI | ◐ | Prompts and validation schema exist; needs a review-and-approve surface so generated questions enter the bank only after a human pass. |
| 14 | Past-paper browser | ◐ | Filtering works inside practice; a dedicated browse-by-year/session/paper view is not built. |
| 15 | Question deconstruction | ◐ | Command word, AO split and common errors are shown; the full "what is this question asking" breakdown is not. |
| 29 | Knowledge graph | ◐ | Prerequisite edges are a real graph driving real behaviour; there is no visualisation of it. |
| 42–43 | Score simulator / grade boundaries | ◐ | Schema and threshold mapping are built and used by the forecaster; no historical threshold data is loaded and no what-if UI exists. |
| 47–49 | Transfer / hard / easy-win modes | ◐ | Transfer is measured and difficulty is filterable; they are not packaged as named modes. |
| 52–53 | Essay lab / calculation lab | ◐ | Essay review is a tutor mode; numeric diagnostics catch the classic errors. Neither is a dedicated workspace. |
| 56 | Personalised formula sheet | ◐ | Formulas are authored per lesson; not aggregated into a personal sheet. |
| 68–69 | Weekly / monthly review | ○ | All the data exists in the event log; needs the two report surfaces. |
| 72–73 | Exam day centre / post-exam analysis | ○ | Small and high-value. |
| 78 | AI persistent memory | ◐ | Context is built per request from real state; nothing is remembered between conversations. |
| 105–107 | Persona and exam strategy | ◐ | The limiting-signal and recommended-action machinery is the substance of this; the persona framing is not surfaced. |
| 136 | Error reporting | ○ | Students cannot yet report a bad question from inside the app. |
| 144 | Feature flags | ○ | Not needed at this size; will be before multi-user. |
| 145–146 | Postgres schema and REST API | ◐ | The state shape is designed for it and the seam is documented; no SQL is written. |
| 152–153 | Offline / PWA | ◐ | Local-first means it already works offline once loaded; no service worker or manifest. |

---

## Phase 3 — needs infrastructure this does not yet have

| # | System | | Blocker |
|---|---|---|---|
| 25 | Viva / oral mode | ○ | Speech-to-text. Specified in the `AIProvider` interface, unimplemented. |
| 26–27 | Material generator / PDF studio | ○ | A document pipeline. The authoring format covers the same ground for supplied material. |
| 54–55 | Graph lab / diagram lab | ○ | Interactive canvas work. The `label-diagram` and `graph-read` question types exist as placeholders. |
| 79–81 | Teacher / classroom / parent | ○ | Multi-user storage — the first real use of the persistence seam. |
| 97 | Multi-agent orchestration | ◐ | Task-based model routing and specialised prompts exist; there is no coordinator agent. |
| 99 | RAG | ○ | Needs embeddings and a vector store. Retrieval is currently structural, which is sufficient at this content scale and much more predictable. |
| 120–125 | Language support / multimodal / handwriting | ○ | Schema carries `translations`; nothing else. |
| 127 | Lab simulations | ○ | Per-subject interactive work. |
| 134–135 | Generation pipeline / review dashboard | ◐ | Validation is built and the Library page is a read-only version of the review dashboard. |
| 154 | Monitoring | ○ | Deployment concern. |
| 156–158 | AI evaluation harness | ○ | Benchmark sets for marking agreement and question quality. Important before AI marking is trusted by default — which is part of why the ledger is the default today. |
| 170–174 | Admin panel and visual authoring | ○ | Content is file-based and version-controlled, which is better for a small team and worse for a large one. |

---

## Deliberately not doing

| # | | Why |
|---|---|---|
| 82 | Leaderboards and social competition | ⊘ | Competition as a primary mechanism optimises for the wrong thing and harms exactly the students who most need help. Study groups and shared decks would be fine; ranking students against each other would not. |
| 83–84 | Heavy gamification | ⊘ | XP and streak pressure reward time spent, not improvement. One honest streak counter exists; nothing else. |
| 178–179 | Monetisation | ⊘ | Not a product decision this codebase should make on your behalf. The architecture does not obstruct it. |

---

## The standard to hold it to

> If a student used only this platform for six months, would it genuinely provide
> syllabus coverage, understanding, recall, practice, exam technique, mistake
> correction, personalised planning, realistic exam simulation, progress
> visibility and intelligent feedback?

**Today:** every one of those exists as working machinery, and the binding
constraint is content, not code. With one subject's material loaded properly,
the answer is yes for that subject.

The honest gap is breadth of material, which is exactly the division of labour
agreed: the engine is here, and it improves the moment you pour subjects into
`content/`.
