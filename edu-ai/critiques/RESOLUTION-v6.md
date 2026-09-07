# RESOLUTION v6 — §13, §14, §15 (revising editor)

Files edited: `draft/13-14-15.md` (only).
Adjudication order: `designs/SYNTHESIS.md` > owning section (§05 gates, §08 costs/routes, §03/§11 limits, §07 retention) > critic.
Word count before: 40,981.

| Finding | Action | File | What changed |
|---|---|---|---|

### Pass A (interrupted run) — verified as landed in `draft/13-14-15.md` before pass B began

Spot-checked against the draft: 13-MARK-000/002/006/007 (response unit, blind double-marking, n≥50 per family, published funded-vs-needed arithmetic), 13-MARK-019/020/024/025/026, 13-MARK-031/032/034, 13-PED-005/012/024/025, 13-PERF-010, the 13.7 `[E6]`-unfunded definition-of-done row, the §13.8 Layer-3 power arithmetic, §14.5 in full (14-MET-001…056), §14.6 (14-ECON-005/006/007/014/015 and the FY1 $0.175 levels-Mark rate), 14-MVP-014, 14-PACK-014/015, §15.B.1–15.B.5, the §15.C identifier-grammar table, 15-SCHM-004/005, §15.A.3's rewritten HARD RULES and AO-independence rule. Not re-applied.

| Finding | Action | File | What changed |
|---|---|---|---|
| c1-F05, c1-C14 | fixed (pass A) | 13-14-15.md | 15.B.1–15.B.5 written in full, including the 8- and 12-mark levels variants c1 flagged as missing. Verified present. |
| c1-F08, c1-F15, c1-F16, c1-F17, c1-F03, c1-F30, c1-F31, c1-F01, c1-F06, c1-F29 | fixed (pass A) | 13-14-15.md | §13.3 and §13.8 rows. Verified present. |
| c3-F01, c4-C4-01 | fixed (pass A) | 13-14-15.md | §14.5 metrics tree written in full. Verified present. |
| c3-F11, c3-F12, c3-F14, c3-F22, c3-F37, c3-C17, c3 "payments and refunds missing" | fixed (pass A) | 13-14-15.md | §14.6 and §14.3. Verified present. |
| c4-C4-09, c4-C4-15, c4-C4-17, c4-C4-27, c4-C4-28, c4-C4-31 | fixed (pass A) | 13-14-15.md | §13.3 gate table T1 row, 13-MARK-025, 13.7 unfunded DoD, "nine weeks", terciles, 13-EFF-003 typography arm. Verified present. |
| c1-F19, c1 "AOs marked independently" missing | fixed (pass A) | 13-14-15.md | §15.A.3 HARD RULES. Verified present. |
| c1-F35, c2-C2-36, c3-F18, c4-C4-02 | fixed (pre-pass) | — | Stitch markers deleted; fence balance is a build check. Verified: `stitch.py` reports 200 fences, balanced. |

### Pass B (this run)

| Finding | Action | File | What changed |
|---|---|---|---|
| c3-F02 | fixed | 13-14-15.md | `Mark@3.provenance` rebuilt: `{family, model, effort, host, region, policy_version, pack_version, scheme_version, marker_instructions_version, route_rung, cache_hit, seed, self_consistency, second_marker, seed_script, marked_at}`. `temperature` deleted, with a stated reason (08-ENS-003: temperature is not settable, so `{"const": 0}` was a claim the adapter cannot make). |
| c3-F04, c3-C13 | fixed | 13-14-15.md | `policy_version` added to `common@1.$defs` with the `^\d{4}\.\d{2}\.\d+(-rc\d+)?$` grammar and `$ref`'d from `Attempt@2` and `LearnerState@2`; per-paper marker identity moved to `marker_instructions_version`. The §13.3 calibration-report YAML, which printed `policy_version: mark-9609-p2@2027.03.2`, now prints `2027.03.2` plus the marker-instructions line. |
| c3-F10, c3-C9 | fixed | 13-14-15.md | `Pack@2.links[].provenance` (compiler/human/OWN/LICENSED) renamed to `links[].derivation` with the grammar `compiler_v<n>[+human] \| editor \| licence:<id>`; rights stay on `documents[].provenance`, which keeps 06-PROV-001's three members. New 15-SCHM-009. |
| c3-F24, c3-C10 | fixed | 13-14-15.md | `Pack@2.syllabus.aos[].definition_verbatim` (required) replaced by `definition` + `wording_status ∈ {own_paraphrase, licensed_verbatim}` + `source_ref`, defaulting to paraphrase, so 06-PACK-004's "command words are the only verbatim board text" holds. New 15-SCHM-010 with the 8-gram overlap check. |
| c3-F27 | fixed | 13-14-15.md | `series` added to `common@1.$defs` as `^(F/M\|M/J\|O/N)/[0-9]{2}$` and `$ref`'d from `Item@2.question_ref` and `ItemTags@1.source`. The old `^[MJON]/[JN]/[0-9]{4}$` admitted `N/J/2025` and used a four-digit year the normaliser never emits. Grammar-table row added. |
| c3-F26 | fixed | 13-14-15.md | `Item@2.question_ref` gains a required `canonical` string with its own pattern, so the ULID primary key and the board-notation reference are both present and joinable; the grammar table says which is which. |
| c3-F28 | fixed | 13-14-15.md | Snake_case enums: `gold_seeded`, `expert_marked`, `machine_scored`; `readiness` and `twin_state` moved into `common@1.$defs`; `provisional` added to `twin_state`. New 15-SCHM-006 (hyphen lint) and 15-SCHM-007. §15.F's two `gold-seeded` prose occurrences fixed. |
| c3-F29 | fixed | 13-14-15.md | `licence_basis` promoted from a bare enum to a `common@1` object with `basis ∈ {own, licensed, user, quotation, public_with_permission}` and a required `quotation {exception, jurisdiction, reviewed_by, reviewed_at}` sub-object; `$ref`'d from `MarkScheme@3.source` and `Pack@2.documents[]`. `text_status` (with `own_facts`) added to `documents[]`. New 15-SCHM-008. |
| c3-F36, c3-C15 | fixed | 13-14-15.md | New 13-EVAL-008: teen and school traffic resolves to `trace_content: none`, so gold responses, replayed dialogues and regression fixtures come only from the consented Tier 1 pipeline and the seeded gold of 13-MARK-030 — never from production traces, and 08-SCH-007's 90-day window is not a consent basis. One field name; `logging_level` retired. |
| c3 "missing: Pack version change mid-Course" | fixed | 13-14-15.md | `Pack@2.node_aliases[]` added (`renumbered / split / merged / withdrawn`, with `share` on a split) plus 15-SCHM-011: Courses pin their version, history joins through aliases, re-marking under a new Pack is prohibited. |
| c3-F23 | fixed | 13-14-15.md | 15-CMD-004 rewritten as an interpolation (`"{Command} — {requirement}. None found, so {ceiling_ao} cannot reach Level {n}."`) because 9708/0455 have three AOs and 9702 has AO1–AO3; new 15-CMD-005 forbids a literal AO number in any catalogue string. The example line also now says "cannot reach Level 3" rather than "capped at Level 2", matching c1-F04's ceiling-not-cap rule. |
| c4-C4-11 | fixed | 13-14-15.md | New 15-STR-005 reserves `15-STR-NNN` for requirements and fixes the citation form as `§15.E · <key>`. The two dangling row-number citations are gone: 15-CMD-004 no longer carries one, and 15-TAG-007's now cites `§15.E · mark.header.diagram`. |
| c4-C4-10, c4-C4-06 | fixed | 13-14-15.md | §15.E preamble now states it is the single catalogue and that §01.6, 09.11 and §10.24 hold no independent wording. §15.A.3's `schema_id = mark@3` corrected to `Mark@3` (15.C's `Name@n` rule). |
| c2-C2-44 | fixed | 13-14-15.md | Three keyed tables added to §15.E: session/memory/stream states (nine keys), an `empty.<screen>` per §10 screen (28 rows, covering 10.1–10.27), and `settings.<section>.<control>.consequence` for every control in 10.19 (29 rows). New 15-STR-008 turns 15-STR-001's claim into a generated coverage report. The forty numbered rows are unchanged in count, so the subsection heading still reads true. |
| c2-C2-09 | fixed | 13-14-15.md | `incognito.banner` and `incognito.save_offer` written, byte-identical to the strings §10.19 now renders. |
| c2-C2-30, c2-C2-31 | fixed | 13-14-15.md | `stream.stopped`, `stream.continue`, `memory.written`, `memory.forgotten` written. |
| c2-C2-35, c1-F01 (string half) | fixed | 13-14-15.md | §15.E #22 drops the "$8" price literal and matches 09-COPY-002's wording; new 15-STR-006 bans a price literal in any in-product notice. `answer.scope_locked` and its tooltip are now catalogue keys, which is what 13-PED-012 has been citing. |
| c2-C2-10 | fixed | 13-14-15.md | #23 split into `quota.grace.free` ("{grace_limit} levels Marks a day") and `quota.grace.paid` ("no levels-Mark limit"); #21/#22/#24 now render `{daily_limit}`, `{remaining}` and `{monthly_limit}` from `limits.yaml`. New 15-STR-007 bans a hard-coded number in a catalogue value. |
| c2-C2-17 | fixed | 13-14-15.md | #31's "30 MB" replaced by `{limit}`, filled from `limits.yaml`; §14/§15 no longer state an upload ceiling at all, which leaves §03.3 the owner. |
| c2-C2-43 | fixed | 13-14-15.md | #24's "your calibration page" → "this paper's calibration numbers" (the page is per paper, 05-GATE-008). |
| c4-C4-13, c1-F17 | fixed | 13-14-15.md | §15.F gains an **Overturn rate** entry defining `overturn_rate` as the only challenge-outcome metric and explaining why "upheld" was retired; the Challenge-a-mark entry now states both fields. 15.C.5 adds the distinction that `challenge_state.upheld` is a per-Mark outcome and is never aggregated. |
| c1-F31 (length-bias half) | fixed | 13-14-15.md | The gate table's length-bias row now uses 13-MARK-019's CI test at n ≥ 100 per tercile instead of a bare 0.05 point-estimate gap, so the two rows cannot disagree on method. |
| c1-F40 | fixed | 13-14-15.md | `papers[].markable ∈ {full, feedback_only, not_marked}` with `not_marked_reason` added to `Pack@2` and made required; new 15-SCHM-012 names 9702 P3, 9701 P3 and the practical-performance components and fixes the student-facing reason string. |
| c2-C2-11 | fixed elsewhere; cross-reference repaired here | 13-14-15.md | §10.26 Ask is written by the §10 owner. §15.F's **Ask** entry now points at it and states the three things Ask does not do. |
| c4-C4-22 | cross-reference repaired here | 13-14-15.md | §10.27 Public paper finder is written by the §10 owner; §14.4 channel 2 now cites it instead of describing an unowned surface. |
| c1-F35, c2-C2-36, c3-F18, c4-C4-02, c4-C4-04 (my files) | verified | 13-14-15.md | `stitch.py` reports zero cross-references to non-existent subsections and zero duplicate ID rows across the whole document; 200 code fences, balanced. |
| c3-F16, c3-C11 | declined (not my section) | — | §00.3's founder-decision table is the §00 owner's. §15.G already carries E1–E17 with 15-FDR-001's alias rule and 15-FDR-004's same-PR acceptance line. |
| c1-F26, c1-F27, c1-F02, c1-F04, c1-F09, c1-F18…F22 | declined (not my section) | — | §05 and §07 findings. §13 was corrected where it restated a §05 constant (13-MARK-013 now defers to 05-MARK-009 rather than restating tolerances). |
| c4-C4-03 | declined (not my section) | — | §05.13 is the §05 owner's. §13 already carries the gate row for it (13-MARK-026) with `status: blocked_on_engine_spec` until §05 lands. |
| c4-C4-30 | declined (not my section) | — | The title block's word and requirement counts are generated by `stitch.py`, which owns them. |
| c4-C4-24 | partially fixed | 13-14-15.md | The UMG/h denominator edge cases c4 asks for live in 14-MET-009a (four named `reason` values plus the `not_estimable` share published beside every cohort number). The §04.14 calibration cold-start is the §04 owner's. |
| c4-C4-16, c4-C4-25, c4-C4-08, c4-C4-14, c4-C4-20, c4-C4-21, c4-C4-23 | declined (not my section) | — | §01, §03, §07 and §09 findings. |
| c2-C2-01…C2-08, C2-12…C2-34, C2-37…C2-42 | declined (not my section) | — | §09 and §10 findings. §15.E now supplies every string those sections need to render. |

### Word counts

`draft/13-14-15.md` — 40,981 words at the start of pass A · 46,358 at the start of pass B (pass A's edits, unlogged when it was interrupted) · **50,002** after pass B.

### Build

`python3 stitch.py` → 225,487 words, sections 00–15, 1,554 unique requirement IDs. Zero cross-references to non-existent subsections, zero IDs defined in more than one table row, zero empty or thin subsections, 200 code fences balanced. All nine JSON blocks in this file parse.
