# Judging — three visions, one rubric, decisive rulings

*Head of product, 6 September 2026. Inputs: research/INDEX.md (A-decisions, B-numbers, C-contradictions, E-founder questions), the two gap briefs (GM = gap-marking-and-cambridge, GL = gap-legal-and-incumbents), corpus-sample.md, PLAN.md, and the three visions: **P** = vision-pedagogy (learning-outcomes first), **C** = vision-craft (interface first), **F** = vision-platform (platform/company first). Scores are 1–10; rulings are final unless SYNTHESIS §15 marks them founder-owned.*

## 1. Rubric

| Criterion | P (pedagogy) | C (craft) | F (platform) | Note |
|---|---|---|---|---|
| Differentiation vs frontier labs' free study modes | 9 | 8 | 9 | P and F both make the marker-with-a-number the spine; C's differentiators are real but several (calm, speed) are copyable by a lab in a quarter. |
| Pedagogical soundness | 10 | 8 | 7 | P's entry-rung-by-item-type, phase-dependent mix and paragraph-not-essay rung 4 are the best learning-science reasoning in the set. F treats pedagogy as a checklist. |
| Exam-outcome leverage | 10 | 8 | 8 | P's mark-yield planner and "one marked Attempt per day" tie every loop to component marks. C's Mark-first onboarding is the strongest single conversion-to-outcome idea. |
| Design excellence | 6 | 10 | 5 | C is a buildable spec (tokens, states, microcopy, rail, chip system). P and F describe screens; they do not design them. |
| Technical feasibility (four APIs + founder's content) | 7 | 8 | 9 | F's route table, pack schema, compiler stages and cost model are directly implementable. P under-specifies ingestion; C assumes the platform exists. |
| Business viability | 7 | 6 | 9 | F alone reasons about CAC, seasonality, quotas, margin, school activation and the second market. C has no GTM. |
| Legal/safety realism | 7 | 7 | 10 | F's three-provenance model, "no Cambridge mark-scheme viewer", policy object and staged age floor are the only fully realistic posture given GL§0 (Cambridge refuses electronic publication). |
| Completeness vs PLAN.md 00–15 | 8 | 8 | 9 | F covers 06/08/11/12/14 deepest; P covers 04/05/13; C covers 09/10. None covers 02 (personas) or 15 (appendices) well. |
| Internal coherence | 9 | 9 | 8 | F contradicts itself on second-marking (20% sample in the route table vs 100% in §8) and puts predicted grades on Home while claiming calm. |
| **Total /90** | **73** | **72** | **74** | Each wins its own lens decisively; no vision is dispensable. |

## 2. Per vision

### P — Learning-outcomes first
**Adopt (5 strongest).** (1) The Attempt as the atomic record and the rule "a feature that does not create or improve Attempts is not in the MVP" — this becomes the scoping knife. (2) Entry rung set by mastery *and* item type; rung 4 on a levels item is a paragraph one level above the student with the evaluative sentence blanked, never a model essay. (3) Phase-dependent session mix with timed papers replacing card reviews inside three weeks; between-papers mode at T−7 per component. (4) Mark-yield planning: `tariff_exposure × (1−M) × (1−R(t_exam)) × learnability / hours`. (5) The three-layer efficacy programme (in-product RCTs → observational June 2027 → pre-registered cluster RCT 2027–28, MDE 0.25 SD) and the calibration-as-outcome loop (Brier, predict–postdict, overconfident-wrong at ×0.5 interval).
**Weaknesses.** (1) The QWK argument conflates Ofqual's probability-of-definitive-grade (0.52–0.74) with human–human QWK; we do not yet have a measured human line for 9609 essays. (2) Its north-star ("mark gain on blind-marked mocks per hour") is only observable in partner schools; it needs an in-product proxy. (3) Screens are listed, not designed; the two-chip-system problem C identifies is left standing.
**Verdict.** The pedagogy and exam-engine sections of the master prompt are built on P, with the metric conflation corrected and the north star made measurable.

### C — Interface craft first
**Adopt.** (1) Mark-before-the-account: no onboarding screens before the first Mark; two fields in a sheet; account at "Save this Course". (2) One composer chip with three modes (Learn · Practise · Mark); intent chips as a reply row under the tutor turn, only on gradable items. (3) The right pane as a 48 px rail until a citation, artifact or Mark needs it. (4) The complete token, motion, dark-mode, reading-comfort and microcopy specification, plus the pixel release checklist — adopted verbatim as the design-system baseline. (5) Evidence-on-the-page marking: credited/partial/uncredited spans highlighted inside the student's own answer; total as a band with a calibration badge; exactly one primary next action.
**Weaknesses.** (1) Cognitive-debt guard demoted to v1 and no efficacy design of its own. (2) No economics, no GTM, no licensing mechanics — it assumes the source pane can always open the page. (3) Literata-as-reading-default and 12% preference-change targets are taste with a thin evidence base.
**Verdict.** Sections 09–10 of the master prompt are C, near-verbatim; its IA rulings (rail, three-mode chip, Mark-first landing) override P and F.

### F — Platform and company first
**Adopt.** (1) The curriculum pack schema (boards → syllabi → nodes → papers → thresholds → questions → mark_scheme_items → examiner_insights → links) with pack readiness states `draft → ingested → mapped → gold-seeded → gated → live`. (2) The curriculum compiler as an internal tool from month 1, with 0450 and 9708 as its first outputs. (3) The three-provenance content model (OWN / LICENSED / USER, no `scraped` class), the provenance ledger, per-document kill switch and the month-1 licensing conversations in priority order. (4) The route table with per-call budgets, cache assertions in CI, dated hazards in config, and 100% cross-family second-marking on ≥12-mark items for the first two series. (5) Per-tenant policy object, staged age floor, and the multi-tenant visibility rules (students own transcripts; teachers see attempts/hint depth; parents see aggregates).
**Weaknesses.** (1) Timed papers and the generator pushed to v1 — but original items are the *only* legal practice bank at launch, so the generator is load-bearing. (2) Predicted-grade card on Home contradicts the calm/anxiety evidence [SV#8]. (3) Four-mode chip and a "default open" third pane inherit INDEX's UX debt.
**Verdict.** Sections 06, 08, 11, 12 and 14 of the master prompt are built on F; its tiering of the generator, timed mode and predicted-grade placement is overruled.

## 3. Adjudication log

Format: **claim** → *ruling* — reason. "INDEX" = the A-decision as written.

### 3.1 P's disagreements with INDEX
1. **[A22] absolute QWK gates → *modify*.** Final rule: a paper's marking ships when it meets **both** an absolute floor (points exact ≥97% / ±1 ≥99.5%; 8–12-mark QWK ≥0.75; 20–30-mark QWK ≥0.70) **and** the measured human–human QWK on the same Tier-1 double-marked gold items; where the human line is not yet measured, the floor applies alone and the mark carries a "provisional" badge. 0.80 stays as the published stretch and as the point where the provisional badge drops. The Ofqual 0.52–0.74 figures are grade-reliability probabilities, not QWK (GM§0 item 2), so they justify measuring our own line, not lowering floors further.
2. **[A14] 60/25/15 as a constant → *adopt P*.** Mix is phase-dependent (SYNTHESIS §7): >8 weeks 60/25/15; 3–8 weeks 50/35/15 with one timed section weekly; <3 weeks timed sections replace card reviews as the interleaving mechanism and new material locks unless overridden. The evidence for interleaving is about mixing, not about flashcards specifically.
3. **[A55] full teacher mode from day one → *modify*.** MVP = teacher-as-calibrator (class code, syllabus-locked assignment with allowed-help level, attempts-and-hints view, audit-and-override feeding the gold set, mock import, calibration queue), free. Full console, SSO/roster, LMS and evidence export are v1. F's "free forever" stands.
4. **[A61] six co-equal north-star metrics → *adopt P's principle, modify the metric*.** Single north star = **Unaided Mark Gain per study hour (UMG/h)**: change in unaided, timed component-mark estimate on unseen items from gated papers, audited against blind-marked school mocks each term and actual grades each August. Predicted-vs-actual error is the trust metric; retention, transfer, Brier, velocity are diagnostics; DAU/minutes are guard-rails.
5. **[A10] entry rung by mastery alone → *adopt P*.** Entry rung = f(mastery, item type). Levels items never receive a full model answer as rung 4; rung 5 on a 20-marker is a plan plus one exemplar paragraph; full model answers exist only for past papers after the student's own marked attempt.
6. **[A44] routing is secondary; fund evals before RL → *reject the demotion, adopt the funding order*.** The route table is cheap to specify and expensive to leave open (cache layout, cost, latency all depend on it), so it stays fully specified. RL/fine-tuned tutoring layer remains LATER, contingent on the orchestrator failing to hold leak <5%.

### 3.2 C's disagreements with INDEX
7. **[A35] Tutor/Exam/Explain/Quiz chip → *adopt C: Learn · Practise · Mark*.** Explain is depth (effort dial, rung 5) inside Learn; Quiz is an object (probe card, `/quiz`, Cards tab), not a mode. Seven visible states across two chip systems fails the 3-second mode-identification test. F's four-mode table is overruled.
8. **[A34] third pane open by default → *adopt C*.** Grid `280px 1fr 480px` stands; the right pane's default state is a 48 px rail that opens on first citation, artifact or Mark; Mark view and Reader open it by default. Measure: ≥60% of study sessions open it or we revisit.
9. **[A24] predicted grade prominence → *adopt C, extend*.** Method unchanged; surface = Progress › Paper and the mock debrief only; never Home, never notifications; parent digest shows it only if the student enables "share predicted grade" (default off); teachers see it in the console for gated papers. F's Home card is rejected.
10. **[A43] onboarding before first Mark → *adopt C*.** Default landing is the composer with four sample chips and "Photograph your own"; board and subject in a two-field sheet on paste; level, session, exam date after "Save this Course". The board→subjects→date path survives only for class-code and app-store entry where a Course is pre-loaded.
11. **[A47] vendor name as headline on Mark card → *adopt C*.** Vendor appears as a chip on the calibration line; the agreement number is the headline.
12. **[A37] Literata as reading default for essay subjects → *reject for MVP, keep the test*.** Inter everywhere at launch; Literata ships in the reading-comfort set; a reading-fatigue A/B in v1 decides any default change. One fewer launch variable and Cyrillic italics need testing first.
13. **[C6] weekly goal hidden in exam weeks → *adopt*.** Goals build habit in September; they do not police May.

### 3.3 F's disagreements with INDEX
14. **[A6]/[E3] second market by pack reuse, not geography → *adopt as distribution sequence; curriculum choice stays founder-owned*.** CAIE consumers → CAIE/Edexcel IAL international schools (Gulf, Kazakhstan, Pakistan, Malaysia) → Edexcel IAL pack (>60% graph reuse) → UK boards when the compiler is <4 weeks per pack → one national exam. Recommended default recorded in SYNTHESIS §15.
15. **[A23]/[A44] cross-family second mark on 100% of ≥12-mark items for the first two series → *adopt*.** ≈+$0.03–0.06 per essay buys the most durable moat (paired marks). Drop to 20% + all disputes per paper once gated.
16. **[C12]/[E4] 16+ consumer at launch, 13–15 via school tenants → *adopt as recommended default, founder-owned*.** Teen-safety controls are still built as MUST because school-tenant under-16s use them from day one; 13+ consumer opens when the consent stack passes external audit (target month 9).
17. **[A54]/[C7] cap levels marks only; points marking uncapped with soft slow-down → *adopt*.** Free tier: 3 levels marks/day (6 in exam-week grace), points marks and cheap-tier explanations unlimited with slow-down, ≥20 uploads/day.
18. **[BM§6.7] compiler in Y2 → *adopt F: internal compiler from month 1*.** Building packs by hand and the compiler later doubles content cost. Public "any syllabus PDF" compiler remains LATER.

### 3.4 Conflicts between visions
19. **Timed papers: MUST (P, C) vs SHOULD (F) → *MUST*.** Launch is March 2027; the Easter blitz for the June series falls inside the MVP window. Paper runner with minutes-per-mark, extra time, rest breaks and the Principal-Examiner debrief ship at MVP.
20. **Question generator: MUST (P, C) vs SHOULD (F) → *MUST*.** Under the three-provenance model the original item bank is the only default practice bank; without the generator there is no Practise mode.
21. **Cognitive-debt guard: MUST (P, F) vs SHOULD (C) → *MUST for signals + L1, randomised; L2–L3 in v1*.** Instrumented from day one because the A/B needs 28-day windows before default-on.
22. **Parent digest: MUST (F, C) vs SHOULD (P) → *MUST as v0 (email, aggregate, month 6)*.** Cheap, and the parent is the payer path; the full parent surface is v1.
23. **Voice: SHOULD-v1 (P, C) vs LATER (F, INDEX C13) → *pilot behind a flag in months 10–12; GA in v2*.** Photo-of-handwriting is the v1 modality.
24. **Names → *Margin* (provisional), fallback *Nib*.** The word carries the two things the product sells — where an examiner writes and "6 marks to A" — reads calm, and avoids every board mark. Calibra/Kalibre carry a firearms connotation in Russian and a known ebook-software conflict; Marksmith transliterates badly; Bestfit and SecondMarker are descriptive. Trademark and domain clearance before any public use.
25. **Predicted grade in the parent digest: F yes vs C never → *student-controlled, default off*** (see 9).
26. **Second-family marking sample: 20% (F route table) vs 100% (F §8, P) → *100% for two series per paper*** (see 15).
27. **MVP subject list: 0455 in (C) vs out (P, F) → *v1, opportunistic*.** 0455 ships in months 7–9 unless the compiler yields it from 9708 at negligible cost before launch.
28. **North star: single (P) vs list (C, F) → *single*** (see 4).
29. **Teacher mode scope at MVP: full (F, C) vs calibrator (P) → *calibrator*** (see 3).
