# RESOLUTION-v4 — revising editor for §09 and §10

File edited: `draft/09-10.md` (§09 Design system and UX specification; §10 Screen-by-screen specification).
Adjudication order: SYNTHESIS.md wins over any critic; where a critic shows SYNTHESIS itself is wrong, the text is kept with a one-line PROVISIONAL note and logged here.
Owning-section rule applied throughout: routes/costs → §08, gates → §05.6, tokens → §09, retention → §07.8, pricing → §14.6. Founder decisions are cited as E1–E17 (§15.G); appendices as §15.A–§15.I.

Word count before this pass began (pass 1): 42,764. After pass 1 (interrupted before the log was written): 46,951. After pass 2 (this resumed pass): 51,677.

## Pass 1 (reconstructed from the draft — the log write was interrupted mid-call)

Verified present in the draft by grep before any further editing; not re-applied.

| Finding | Action | File | What changed |
|---|---|---|---|
| c2-C2-01 | fixed (pass 1) | draft/09-10.md | §10.24 crisis-resources config written in full: `crisis_resources@1`, the four-placeholder contract, GB/US/KZ/RU/`_eu`/`_default` regions with `verified_on` gating, plus 10-STAT-001…005. |
| c2-C2-03 | fixed (pass 1) | draft/09-10.md | `--border-control` added and made the gated token; decorative hairlines named as the 1.4.11 exemption. |
| c2-C2-04 | fixed (pass 1) | draft/09-10.md | `--warning-line` added for underlines, rules and text; `75%` kept as fill only. |
| c2-C2-05 | fixed (pass 1) | draft/09-10.md | Citation numeral raised to `--text-xs`; no "11 px" survives anywhere in the file. |
| c2-C2-06 | fixed (pass 1) | draft/09-10.md | `⌘⇧B` Branch and `⌘⇧K` Scratchpad added to 09-KEYS-001; the table declared the authoritative map. |
| c2-C2-07 | fixed (pass 1) | draft/09-10.md | 09-QA-056 and 10.1 acceptance #3 now cite the §11.14 route budget and state no number. |
| c2-C2-08 | fixed (pass 1) | draft/09-10.md | IntentRow moved to `⌥1/⌥2/⌥3`; bare digits reserved for ConfidenceSlider and card grading. |
| c2-C2-13 | fixed (pass 1) | draft/09-10.md | `confidence_default`, `predict_skipped` ("Not sure"), `postdict_skipped` ("Show me the marks" at 10 s) all present. |
| c2-C2-14 | fixed (pass 1) | draft/09-10.md | 09-PRIN-007 rewritten to the band-where-uncertain rule with the `exact` state. |
| c2-C2-15 | fixed (pass 1) | draft/09-10.md | `--banner-h` 40 / `--banner-h-2` 56, max two stacked; 10.24 Layout restated. |
| c2-C2-16 | fixed (pass 1) | draft/09-10.md | Two named presets `preset.comfort` and `preset.dyslexia` with distinct numbers. |
| c2-C2-17 | fixed (pass 1) | draft/09-10.md | 10.16 distinguishes Library ingestion (PDF only) from the composer's accepted types. |
| c2-C2-23 | fixed (pass 1) | draft/09-10.md | 10.1 `gated` renders the `anonymous:` block of `limits.yaml` rather than declaring a number. |
| c2-C2-24 | fixed (pass 1) | draft/09-10.md | 10-PAPR-007: nothing blocked, quota stated before start, weekly full mock allowance named. |
| c2-C2-25 | fixed (pass 1) | draft/09-10.md | Mobile Mark order rewritten: header → command word → band → AO cards → "Show my answer". |
| c2-C2-26 | fixed (pass 1) | draft/09-10.md | `--fg-muted` / `--bg-accent` removed; 09-QA-018 now fails an unknown token name in §09–§10. |
| c2-C2-27 | fixed (pass 1) | draft/09-10.md | `wide` grid variant and `--panel-w-2` 440 added; 10.7 ≥1600 layout cites it. |
| c2-C2-29 | fixed (pass 1) | draft/09-10.md | UserMessage edit trigger specified for hover, long-press and ⋯; 10-SESN-011 added. |
| c2-C2-30 | fixed (pass 1) | draft/09-10.md | 09-STRM-014 Continue-after-Stop written. |
| c2-C2-31 | fixed (pass 1) | draft/09-10.md | MemoryChip added to 09-COMP-001, 10.5 and 10-SESN-010; `memory.written` string added. |
| c2-C2-32 | fixed (pass 1) | draft/09-10.md | Inline exception extended to CitationChips; coarse-pointer tap opens the SourcePane sheet. |
| c2-C2-33 | fixed (pass 1) | draft/09-10.md | Six required sheets; wireframe reads "STEP 3 OF 6". |
| c2-C2-34 | fixed (pass 1) | draft/09-10.md | Age band moved to the first field of `save`, before any identifier. |
| c2-C2-37 / C2-38 | fixed (pass 1) | draft/09-10.md | Flip uses `--dur-base`; `--dur-shimmer` tokenised; the spring object moved to `motion.ts`. |
| c2-C2-39 | fixed (declined control) (pass 1) | draft/09-10.md | The Density control was deleted rather than tokenised, per c2's own preference. |
| c2-C2-41 / C2-42 | fixed (pass 1) | draft/09-10.md | "Esc Esc" and the "Capitalise Each Word" toggle both deleted. |
| c4-C4-10 | fixed (pass 1) | draft/09-10.md | 09-COPY-002 gained a `key` column and named §15.E the catalogue of record. |
| c4-C4-31 | fixed (pass 1) | draft/09-10.md | `--font-serif` carries an explicit PROVISIONAL flip condition. |
| c4-C4-34 | fixed (pass 1) | draft/09-10.md | 09-STRM-015 (interrupt-and-add) and 09-STRM-016 (cross-device resume) written. |
| c1-F23 | fixed (pass 1) | draft/09-10.md | Debrief AO denominators computed from `pack.papers[p].ao_weights × paper.marks`; 10-DBRF-008 added and marked PROVISIONAL until 15-OPEN-010. |
| c1-F28 | fixed (pass 1) | draft/09-10.md | 10-DBRF-001 gained the 10-second "Show me the marks" escape. |
| c1-F34 | fixed (pass 1) | draft/09-10.md | 10.6's tariff word-count guide replaced by a structure guide from the scheme's evidence rules. |
| c2-C2-36 | fixed (pre-critique) | build | Stitch markers deleted and a build check added — outside this file. |

## Pass 2 (this session)

| Finding | Action | File | What changed |
|---|---|---|---|
| c2-C2-11 | fixed | draft/09-10.md | **§10.26 Ask written in full** to the 10-CONV-001 template: purpose, Stage MVP, jobs, route `/ask/:sessionId`, layout (the 10.5 layout minus CourseTree and HelpLadder), regions, wireframe, six states, shortcuts (including the chords that are deliberately absent), Data, and 10-ASKS-001…008. What Ask does **not** do is stated once and enforced by 10-ASKS-002: zero rows to `attempts`, `marks`, `cards`, `memories`, `plan_blocks` and `calibration.*`, no band, no levels-Mark spend, no Plan change, mastery byte-identical before and after. 10-ASKS-003 keeps the no-refusal rule (a mark request returns the answer plus a **Move to a Course** offer); 10-ASKS-005 makes the move non-retroactive; 10-ASKS-006 keeps every §12 safety surface unchanged; 10-ASKS-007 stops Ask silently replacing the product. The palette verb `Ask <anything>`, the 10-CONV-003 route row and the Home sidebar row were already present from pass 1. |
| c4-C4-22 | fixed | draft/09-10.md | **§10.27 Public paper finder written in full** — the free-forever logged-out finder SYNTHESIS §12 makes distribution channel 3 and §14.4 gives an owner. Routes `/papers` and `/papers/:board/:subject/:series/:component`, public two-column layout, regions, wireframe, six states including `link_dead`, URL-state filters, no-learner-write Data block, and 10-FIND-001…008: hosts nothing (06-STOR-006), renders **no** exam-derived text at any length (not even the 06-STOR-001 extract allowance, because the page is indexable), non-affiliation line on every route, weekly link check with a <1% dead ceiling, server-rendered and indexable with JS off, exactly one conversion strip and no auth gate, three analytics events and no email capture, and a signed-in visitor offered rather than redirected. |
| c2-C2-40 | fixed | draft/09-10.md | Template conformance completed. (a) A `**Stage.**` block now exists on all 25 screens — 17 were added this pass (10.1–10.8, 10.17–10.25); 10-CONV-001's Stage row now says it is required and names the docs-lint. (b) 10-CONV-001's Acceptance row names the two permitted forms (numbered list, or `| ID | Requirement | Acceptance |` table) and prefers the id-bearing table, so the existing per-screen requirement tables are conformant rather than defects — no requirement id was renamed or removed. (c) The Interactions row now permits named sub-blocks (10.10's `Timer`/`Submit`, 10.12's `Review interaction`) provided the screen's shortcuts appear in one of them, and forbids the block being simply absent. (d) 10.24 gained the missing **States**, **Interactions and shortcuts** and **Data** blocks. |
| c2-C2-40 (route table) | fixed | draft/09-10.md | 10-CONV-003 promised "the four-letter screen tag in the table below" and the table had no tag column. Added the `<SCR>` column with all 22 tags, plus the three missing rows (Scratchpad/Artifact `SCRA`, Search/Command palette `SRCH`, Distress/system states `STAT`) and the two new screens (`ASKS`, `FIND`). |
| c2-C2-02 (residue) | fixed | draft/09-10.md | 10.24 row 3 still read "50 min continuous, then every 25 min", which is the contradiction c2 asked to delete. It now states the adjudicated rule once: first nudge at 50 min, one repeat at 110 min and no more that day, 25 min in exam week, 40 min while `wellbeing_state = watch` (12-WELL-002), suppressed inside a timed paper, within 30 min of an exam, and inside a Card review under 10 min. |
| c2-C2-10 (residue) | fixed | draft/09-10.md | 10.24 row 10 still carried the false string "Exam week: marking limits are off until Friday." It is now the plan-conditional pair (`limits.grace.free` / `limits.grace.paid`) rendering the number from `limits.yaml`, with the false wording named as a copy-lint failure. §09.11 row 10 was already correct from pass 1; the two now agree. |
| c4-C4-10 (residue) | fixed | draft/09-10.md | §10.24's catalogue repeated ten strings with no keys, which is what made 15-STR-001 ambiguous. The table gained a `key` column (12 keys), and a preamble states that §15.E is the record, that a row here and the matching 09-COPY-002 "Do" column are the same object, and that the catalogue test compares all three byte-for-byte. |
| c4-C4-13 | fixed | draft/09-10.md | One direction, one vocabulary. 10-CHLG-005 now instruments `challenge_rate = challenges ÷ marks` <3% and `overturn_rate = revised ÷ challenges` <30%, and states that "upheld" is an outcome of a single challenge (the state machine), never a metric — a rate named `upheld_rate` fails the metrics lint, because the same number read as "upheld" and as "overturned" alarms in opposite directions. 10-CHLG-004 repointed; the 10.20 and 10.25 dashboard fixtures rewritten ("challenge 1.9% · overturn 22%"). |
| c2-C2-18 | fixed | draft/09-10.md | 10.23 gained the split Stage block: MVP = Receipt cover, timeline, exports and Mark sharing (`/m/:markToken` already exists at MVP in 10.1); v1 = public revocable `/r/:token` Receipt and Artifact links and the `/share/mark/:markId` cards. It states explicitly that this supersedes any reading of 03-PAR-025 that defers all sharing. 10.1's Stage block makes anonymous Mark sharing MVP on the acquisition surface too. |
| c2-C2-33 (residue) | fixed | draft/09-10.md | 10-CONV-003's Course-setup row still listed the old eight steps (`board · syllabus · papers · date · target · level · consent · import`) while 10.2 had been corrected to six. The route row now names the six required steps plus optional `import`. |
| c1-F33 | fixed | draft/09-10.md | New 10-CONV-005a: every syllabus point number and title in a §10 wireframe, example or fixture is read from `fixtures/syllabus_points.ts`, generated from the Pack — never typed. A docs-lint resolves every `\d.\d(.\d)? Title` hit in §04, §07 and §10 against that file and fails on an unknown point, which is what makes the §07.5-vs-§10.6 disagreement correctable in one place when 15-OPEN-010 resolves the 2026–28 numbering. |
| c1-F34 (consistency) | fixed | draft/09-10.md | 10.17's Scratchpad header still printed a tariff-derived word target ("214 / about 500"), the same coaching c1 had removed from 10.6. It is now an unlabelled count with no target and a one-clause reason. |
| c2-C2-11 (keyboard) | fixed | draft/09-10.md | `⌘⇧A` Ask and `⌘⇧O` Move this Ask to a Course added to 09-KEYS-001. To avoid a duplicate registration with the SelectionPopover's existing `⌘⇧A`, the map defines one Ask chord disambiguated by whether a selection exists, and 09-COMP-001's SelectionPopover row says so. 09-KEYS-001's acceptance paragraph now defines route-scoped chords (`⌘⇧O` on `/ask`, `⌘.` on the Mark view) as asserted-absent elsewhere rather than bound twice, so the shortcut-registry test stays decidable. |
| c2-C2-44 (partial) | partially fixed | draft/09-10.md | Two new canonical strings written with keys — `ask.scope` (row 24) and `ask.move_offer` (row 25) — so 10-ASKS-003 and 10-ASKS-004 are verifiable against §15.E. The three coverage tables c2 asks for (25 empty states, Settings consequences, incognito/memory/stop-continue) are §15.E's to write; §09.11 already names §15.E the catalogue of record and fails the build on a missing key, which is the enforcement half. |
| c4-C4-04 (§09/§10 share) | no change needed | draft/09-10.md | Every §0x/§1x cross-reference in this file was re-resolved against the actual subsection headings of the other drafts: §05.2 Mark contract, §05.8 predicted grades, §05.10 generator, §05.11 handwriting, §05.7 challenges, §04.12 FSRS, §04.6 misconception diagnosis, §11.13 retention, §11.14 route budgets all land correctly. No `§09.15`, `§05.5 gate`, `§04.7.x`, `§05.8.1` or `§04.11` citation exists in this file. |
| c4-C4-03 | not mine | — | §05.13 (machine-scored and IRT engine) is the §05 editor's, per the brief's owner line. |
| c3-F04 / c3-C13 | not mine | — | No `policy_version` literal appears in §09–§10; the drifting values are in §05, §08 and §12. |
| c1-F02, F31; c4-C4-08, C4-14, C4-20, C4-24, C4-25; c2-C2-09, C2-12, C2-19, C2-20, C2-21, C2-22, C2-28, C2-35, C2-43 | out of scope | — | Owned by §01–§08 or §11–§15. Where their §09/§10 half exists it is already done: C2-12's Account section is in the 10-CONV-003 `/settings/:section` list, C2-19's budgets are cited from §11.14, C2-28's route vocabulary is 10-CONV-003's and is now generated from the router manifest, C2-35's price-literal ban is 09-COPY-003 rule (k). |

## Cross-file dependencies created by this pass

These are correct as written here and require one edit in another editor's file to close:

1. `ask.scope` and `ask.move_offer` must be added to §15.E under those exact keys (§09.11 rows 24–25 carry the byte-exact text).
2. `fixtures/syllabus_points.ts` should appear in the §00.5 file manifest (10-CONV-005a names it).
3. §14.4's channel table should cite §10.27 as the finder's screen spec, and §06 should carry the 06-STOR-010 logged-out rule c4-C4-22 names; 10-FIND-001…002 state the finder's half of it.
4. §11.14's route budget table needs `/ask/:sessionId` and `/papers*` rows, in the 10-CONV-003 vocabulary.
