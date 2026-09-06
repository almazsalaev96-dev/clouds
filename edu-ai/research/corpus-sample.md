# Founder-supplied corpus sample — what the "books and past papers" actually look like

*Source: the founder pasted, mid-session, the full extracted text of ten PDFs (copyright notices and logos stripped). This note records what the material is, how it is structured, the defects an ingestion pipeline must handle, and what it implies for the product. The founder said: "this is some material, but keep going" — i.e. it is a sample, not the whole library.*

## 1. Inventory of the sample

| File (as named) | Subject / syllabus | Type | Approx. structure |
|---|---|---|---|
| cie-as-biology-9700-practical-v1-znotes.pdf | Cambridge AS Biology 9700 (Paper 3 practical) | Third-party revision notes (ZNotes) | Skeletal mark-scheme skill breakdown (marks per skill), variables, dilution, measurement quality, tables/graphs/drawings, maths skills, error analysis |
| cie-as-biology-9700-theory-v2-znotes.pdf | AS Biology 9700 theory | Revision notes | 11 syllabus chapters (cell structure → immunity), definitions, comparison tables, many "[Image: …]" figure placeholders |
| cie-as-business-9609-v2-znotes.pdf | AS Business 9609 | Revision notes | Chapters 1–5 (Business & environment, People, Marketing, Operations, Finance), numbered 1.1, 1.2 …, advantage/disadvantage tables, 4 appendix tables (PLC × 4Ps, legal forms, stakeholders, ratios) |
| cie-as-chemistry-9701-practical-v2-znotes.pdf | AS Chemistry 9701 practical | Revision notes | Errors, apparatus accuracy table, titration protocol, salt analysis, enthalpy, rates, "problem → improvement" table |
| cie-as-chemistry-9701-theory-v2-znotes.pdf | AS Chemistry 9701 theory | Revision notes | 19 chapters (stoichiometry → analytical techniques), reaction tables (reagent / condition / mechanism), many equations in plain text |
| cie-as-computerscience-9608-practical-v1-znotes.pdf | AS Computer Science 9608 (Paper 2) | Revision notes | Pseudocode conventions, Python equivalents, data types, sorting/searching, testing |
| cie-as-computerscience-9608-theory-v1-znotes.pdf | AS Computer Science 9608 (Paper 1) | Revision notes | Number systems, media, networks, hardware, processor (RTN, instruction set table), system software, security, ethics, databases & SQL |
| cie-as-economics-9708-v1-znotes.pdf | AS Economics 9708 | Revision notes | Basic ideas, price system, government intervention, macro, policies; dense definitions; elasticity/PED tables; macro policy flowchart |
| cie-as-informationtechnology-9626-v1-znotes.pdf | AS IT 9626 | Revision notes | 10 chapters (data/information → sound & video editing) |
| cie-as-physics-9702-practical-v2 / theory-v1 | AS Physics 9702 | Revision notes | Practical: instruments, uncertainties, big "error → improvement" tables. Theory: 13 chapters, formulas in plain text |
| cie-as-psychology-9990-corestudies-v1-znotes.pdf | AS Psychology 9990 | Revision notes | 12 core studies in a fixed template: title/year → psychology investigated → background → aims → procedure → results → conclusions → ethics → strengths → weaknesses → issues & debates |
| "organic chemistry mechanisms of organic reactions.pdf" | 9701 organic mechanisms | Hand-compiled mark-scheme extracts | Per past paper (e.g. "S 10 variant 21", "W 09 variant 21", "S14 variant 21", "W 15 variant 22"): a mechanism diagram description + the official marking points (M1…M5) |

Note: syllabus codes 9608 and the 9609/9701/9702 note versions are older editions (9608 was replaced by 9618 from 2021 exams; Business 9609 has a 2023–2025 and a 2026–2028 syllabus). The corpus will therefore contain **stale editions** that must be version-tagged and reconciled against the current syllabus.

## 2. Defects and quirks an ingestion pipeline must handle (all observed in this sample)

1. **Figures are lost.** Every diagram arrives as a bracketed placeholder such as `[Image: Labeled diagram of a mitochondrion showing …]` or `[Diagram: Set objectives -> Assess problem -> …]`. The pipeline must extract the real figures from the PDFs (image crops + vision-model captions), not rely on text extraction.
2. **Bullet glyph artefacts.** ZNotes bullets were extracted as the word "Game" (e.g. "Game Behaviour, cognition and emotions can be explained…"), or as "o", "O", "○", "•" inconsistently. Needs a per-source cleaning rule.
3. **Duplicated blocks.** Whole paragraphs repeat (Business 9609 "Economies of scale" appears twice; Psychology Pepperberg "Results/Conclusions" repeated three times; "Leadership: The art of…" ×3; "On-demand streaming:" ×6). Dedupe by fuzzy hashing within a document.
4. **Broken maths and units.** Superscripts flattened ("C6H12O6", "cm-3", "10^23", "mol dm-3"), fractions linearised ("% error = No. of readings × Half of smallest scale division × Total reading 100%" is mangled), Greek letters sometimes present ("Ψ", "ΔH"), sometimes lost. A maths-normalisation pass (and preferably Mathpix-style OCR of the PDF itself) is required before anything is shown as a formula.
5. **Tables survive as GitHub-markdown**, but some cells merged (Biology dilution table header), some rows misaligned (Chemistry 9.4 table has 5 columns under 3 headers). Table extraction from the PDF layout is more reliable than from text.
6. **Typos and factual slips in third-party notes** — e.g. "Pilivan" (Piliavin), "Schatcher" (Schachter), "Arieses", "Standard Conditions: 101KPa and 273°C" (should be 273 K), a "V = Ir − E" typo flagged in the text itself, "Pyrimidines … (Adenine, uracil and cytosine)" (should be thymine). **Revision notes are not ground truth**: they must be ranked below syllabus + endorsed textbook + mark scheme in retrieval, and the tutor must be able to say "the notes you uploaded say X; the syllabus/textbook says Y".
7. **Cross-references** ("ref 4.1 phospholipids", "See TABLE 4 for ratio analysis", "More about measles, malaria and small pox in 11.2") need resolving into links.
8. **Numbering aligns with syllabus sections** ("1.1 Enterprise", "2.2 Motivation", "13.14 Geometric isomers") — this is the hook for tagging chunks to syllabus points, but numbering is the *note's* numbering, not necessarily the official syllabus numbering; a mapping table per source is needed.
9. **Mark-scheme extracts have a precise micro-format** that the AI examiner must reproduce verbatim-style: numbered marking points with the exact creditable feature, e.g. for a nucleophilic-addition mechanism — "M1 = lone pair AND curly arrow from lone pair to carbonyl C; M2 = partial charges on C=O AND curly arrow from bond to O−; M3 = structure of intermediate including charge; M4 = lone pair AND two correct curly arrows; M5 = CN− regenerated". Points are all-or-nothing, conjunctive ("AND"), and tied to drawing conventions (dipoles, lone pairs, arrow origins).
10. **Paper/series identifiers are informal** ("S 10 variant 21", "W 09 variant 21", "10 variant 23"): the pipeline needs a normaliser to canonical IDs (9701/21/M/J/10 etc.).

## 3. What this tells us about the founder's library and the product

- The library is (at least partly) **Cambridge International AS/A Level, multi-subject, English-medium**, mixing third-party revision notes with **hand-curated mark-scheme extracts**. This confirms the beachhead: Cambridge 9609/9708/9701/9702/9700/9990/9618 + IGCSE.
- The most valuable asset in the sample is the small mechanisms file: it is exactly the *derived layer* (question → official marking points) that turns an LLM into an examiner. The product should make it trivial for the founder (and later teachers/students) to add such extracts, and should store them as structured marking-point records, not prose.
- The Psychology core-studies notes follow a rigid 11-field template — an ideal candidate for **structured extraction into cards** (aim / sample / IV / DV / results / evaluation) and for evaluation-point drills ("give two weaknesses of Milgram's sample").
- Practical-paper notes (Biology/Chemistry/Physics "error → improvement" tables) map directly onto **points-based marking rules** for planning/evaluation questions.
- The Business notes carry the same AO/skills lens as the founder's existing repo plan (`business-9609/00-MASTER-PLAN.md`), which should be treated as an additional, higher-quality input.
- Licensing: ZNotes publishes under a Creative Commons licence (believed CC BY-NC-SA 4.0 — **verify**). Non-commercial terms would constrain use inside a paid product; treat ZNotes-derived text as *user-uploaded study material* processed for that user, not as a redistributed library asset, unless a licence is agreed.

## 4. Representative verbatim excerpts (for writers who need concrete examples)

### 4.1 Business 9609 — style of a chapter opening
> ### 1.1 Enterprise
> The purpose of business activity: [Diagram: Use resources -> Product or service -> Needs of consumers …]
> Added value = Selling price - cost of bought in materials.
> Opportunity cost: The benefit of the next most desired option given up
> The business environment is dynamic because (LET B) o Competitors (Other Businesses) o Legal changes- outlaw products o Market has Less to spend (Economic) o Obsolesce (Technological)
> Social Enterprise: A business with mainly social objectives that reinvests most of its profits into benefiting society rather than maximizing returns
> Triple Bottom Line: The 3 objectives of social enterprises: Economic, Social and Environmental

### 4.2 Business 9609 — appendix table (PLC × marketing mix)
> | Product Life Cycle Phase | Price | Promotion | Place | Product |
> | Introduction | Higher than competitors | High levels of informative advertising | Restricted outlets (high class if skimming adopted) | Basic version |
> | Growth | Penetration → rising prices | Establish brand identity to encourage repeat purchases | Growing number of outlets … | Plan product improvements … |

### 4.3 Chemistry 9701 — official marking points for a mechanism (from the mechanisms file)
> **S15 variant 21** — nucleophilic addition of CN− to a carbonyl
> M1 = lone pair AND curly arrow from lone pair to carbonyl C
> M2 = partial charges on C=O AND curly arrow from bond (=) to O−
> M3 = structure of intermediate including charge
> M4 = lone pair AND two correct curly arrows (from lone pair to H AND from H-C to C)
> M5 = CN−
>
> **10 variant 23** — SN2: "mechanism must be SN2; dipole on C-Br bond or central C atom shown with δ+ (1); attack on C atom by lone pair of OH− not from negative charge (1); transition state formed with negative charge shown (1); Br− leaves/NaBr formed (1)"
>
> **W 09 variant 21** — free-radical substitution: "initiation Cl2 + uv → 2Cl·; propagation CH4 + Cl· → CH3· + HCl; CH3· + Cl2 → CH3Cl + Cl·; termination CH3· + CH3· → C2H6 or CH3· + Cl· → CH3Cl or Cl· + Cl· → Cl2"

### 4.4 Biology 9700 practical — skeletal mark scheme (skill weights)
> MANIPULATION OF APPARATUS, MEASUREMENT, AND OBSERVATION [16]: Making decisions about measurements or observations [8]; Successfully collecting data & observations [8]; Recording data and observations [4]; Displaying calculations and reasoning [2]; Data or observations layout [6]. ANALYSIS, CONCLUSIONS, AND EVALUATION [12]: Interpreting data … and identifying sources of error [6]; Drawing conclusions [3]; Suggesting improvements … [3]

### 4.5 Psychology 9990 — the fixed core-study template (field names)
> Title · Year · Psychology being investigated · Background · Aims · Procedure (Research method, Experimental design, IV, DV, Sample, Sampling technique, steps) · Results · Conclusions · Ethical issues · Strengths · Weaknesses · Issues and debates (Application; Nature vs nurture; Individual vs situational; Reductionism …)

## 5. Concrete requirements added to the product spec because of this sample

1. Ingestion must run on the **PDFs**, not on text dumps: layout-aware parsing + figure extraction + maths OCR, with per-source cleaning rules (bullet artefacts, duplicates).
2. Every chunk carries `{board, syllabus_code, syllabus_version, paper, source_type ∈ {syllabus, textbook, revision-notes, mark-scheme, examiner-report, user-upload}, section_no, trust_rank}`; retrieval and the tutor's wording respect `trust_rank`.
3. A **marking-point record type** (`question_id, part, mark_point_id, credit_text, conjunctive_conditions[], marks, AO, notes`) and a UI for the founder/teachers to add such records quickly (paste → structured).
4. A **syllabus-mapping table per source** (note section → official syllabus point) with a review UI, since third-party numbering is not official numbering.
5. A "**notes vs canon**" behaviour: when a user's uploaded notes conflict with the syllabus/textbook/mark scheme, the tutor surfaces the conflict with citations rather than silently choosing.
6. Structured-card extraction for template-shaped content (psychology studies, practical error/improvement tables, reaction tables) feeding flashcards and drills.
7. Paper-ID normaliser for informal references ("S15 v21" → canonical series/variant).
