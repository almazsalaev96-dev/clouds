# Exam Systems, Past Papers and Mark Schemes — Requirements for an AI Examiner

*Research lens: exam-system structure, marking anatomy, exam-prep product landscape, AI-examiner requirements, legal/licensing. Prepared September 2026 for the education-AI product bible.*

**Method note (read first).** 27 distinct web searches were executed successfully (Cambridge syllabuses 9609/9708/9709/9702/0450/0455/0580, command words, thresholds/PUM, Pearson/AQA/OCR/WJEC marking, IB, AP, SAT/ACT, OFR/ECF, Ofqual standardisation, 9609 examiner reports, ЕГЭ/ОГЭ, ЕНТ, JEE, Gaokao/CSAT/YKS, Abitur/Bac/WAEC, Singapore/ATAR/Pakistan). The session's web-search budget was then exhausted and **every** attempted page fetch (cambridgeinternational.org, gov.uk, pearson, aqa, ocr, ibo, collegeboard, arxiv, savemyexams, physicsandmathstutor, reddit, papacambridge, etc.) was blocked by the network egress proxy, so **zero primary pages could be fetched**. Consequently:

- Facts derived from search-result snippets are cited with their URL.
- Everything else is explicitly marked **(prior knowledge, unverified)** — this is most of Part C (products), Part D benchmarks and all of Part E (legal). Those sections must be re-verified before the product bible is finalised; specific verification tasks are listed under "Open questions".
- No numbers, prices or quotes have been invented; where a number is from memory it is flagged.

---

## 0. Executive summary

1. **Cambridge International (CAIE) is the most "AI-examiner-friendly" system to start with**: every syllabus publishes (a) numbered content points, (b) four assessment objectives with per-paper weightings, (c) a standardised command-word glossary (standardised across syllabuses from 2019 onwards — https://www.tutopiya.com/blog/igcse/command-words-keywords/igcse-command-words-complete-guide-cambridge-edexcel/), (d) per-series mark schemes with generic marking principles and levels-of-response grids, (e) principal-examiner reports per component, (f) example candidate responses with examiner commentary, and (g) per-component grade thresholds. This is a complete supervision signal for an AI marker.
2. **9609 Business (2026–2028 syllabus)** weights AO1 Knowledge / AO2 Application / AO3 Analysis / AO4 Evaluation at **25% each at A Level**; AO weights differ sharply by paper (Paper 1: AO1 35%, AO2 30%; Paper 4: AO3 40%, AO4 35%) (https://www.cambridgeinternational.org/Images/697371-2026-2028-syllabus.pdf via https://www.tutopiya.com/blog/a-level-exam-trends-2026/a-level-2026-exam-trends-cambridge-business-9609/). An AI examiner must therefore mark *per AO*, not holistically.
3. **AO weights are subject-specific and drive the marking model**: 9708 Economics ≈ AO1 35 / AO2 (analysis) 40 / AO3 (evaluation) 25; 0450 IGCSE Business AO1 40 / AO2 20 / AO3 25 / AO4 15; 0455 IGCSE Economics AO1 40 / AO2 40 / AO3 20; 9702 Physics AO1 40 / AO2 40 / AO3 (experimental) 20 with Papers 3 and 5 being 100% AO3 (sources in §1).
4. **Two marking paradigms must be implemented separately**: *points-based* (each creditworthy point = 1 mark; dominant in maths, sciences, short-answer) and *levels-based / markbands* (best-fit descriptor, then position within level; dominant in essays, data response, humanities). Boards differ in *procedure*: AQA says start at the lowest level and climb the "ladder"; OCR says start at the highest level and work down (see §2). The AI must follow the board's procedure, not a generic one.
5. **Command words are the contract between question and mark scheme.** Cambridge's list (analyse, assess, calculate, comment, compare, consider, contrast, define, describe, discuss, evaluate, explain, give, identify, justify, outline, state, suggest, etc.) maps almost 1:1 to AOs; e.g. *evaluate* → "make an informed judgement… supported by evidence; top marks need both sides weighed AND a justified judgement" (https://www.tutopiya.com/blog/command-words-cambridge-edexcel-aqa-ib/). The product should hard-code a command-word → expected-response-shape → AO table per board.
6. **Own-figure rule (OFR) / error carried forward (ECF)** is universal: a wrong figure carried into later working is not penalised twice if the method is correct (https://qualifications.pearson.com/content/dam/pdf/BTEC-Nationals/Business/2016/External-assessments/31463H_unit3_rms_20190814.pdf; https://en.wikipedia.org/wiki/Error_Carried_Forward). The AI marker must implement ECF explicitly across question parts.
7. **OCR's annotation vocabulary** (✓, ×, Ø omission, BOD benefit of doubt, CON contradiction, RE rounding error, GA sig-fig error, ECF, L1/L2/L3, BDG benefit of doubt not given, NC noted no credit, I ignore) is a ready-made schema for the AI examiner's per-line annotations (https://www.docsity.com/en/docs/a-level-june-2025-ocr-biology-paper-1-mark-scheme/14272294/).
8. **Grade thresholds are per component, per series, and there is no A\* at component level**; A\* exists only at syllabus/option level (https://www.cambridgeinternational.org/Images/740287-business-9609-june-2025-grade-threshold-table.pdf; https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/grade-threshold-tables/). Percentage Uniform Marks (PUM) put grades on a common scale: minimum A\* = PUM 90 (https://www.cambridgeinternational.org/Images/209304-a-guide-to-percentage-uniform-marks.pdf). Predicted-grade modelling must combine component raw marks → option thresholds → PUM.
9. **Examiner reports are the richest "what loses marks" corpus.** Verified 9609 examples: analysing disadvantages to the *business* when the question asked about *employees*; definitions that repeat the term; skipping calculation working (all-or-nothing risk); assuming higher sales ⇒ higher profit; trying to analyse every appendix and running out of time (https://www.thinka.ai/en-HK/past-paper/Cambridge-IAS-Level/Business-9609/2025-jun-v2/analysis; https://bestexamhelp.com/exam/cambridge-international-a-level/business-9609/2024/9609_m24_er.pdf).
10. **Standardisation is how humans reach reliability**: standardisation meetings, then "seed" items with an agreed mark and a tolerance inserted randomly during on-screen marking; markers who miss the seed are paused until re-standardised (https://www.gov.uk/government/publications/ofqual-guide-for-schools-and-colleges-2025/ofqual-guide-for-schools-and-colleges-2025; https://rsremotetutoring.co.uk/gcse/mark-scheme-of-gcse-paper/). An AI examiner should be evaluated exactly this way: seeded scripts with official marks and per-question tolerances.
11. **Pearson Edexcel levels grids tag each bullet with the AO it targets** and mark "holistically"; 2025 IAL Economics rewording aligned bullets across routes (https://qualifications.pearson.com/en/about-us/qualification-brands/edexcel.updates.html?article=%2Fcontent%2Fdemo%2Fen%2Fnews-policy%2Fsubject-updates%2Feconomics%2Fial-economics-assessment-support). AQA warns examiners not to over/under-reward a skill relative to AO weights and that indicative content is "not… complete, full or model answers" (https://filestore.aqa.org.uk/resources/english/AQA-87001-SMS.PDF).
12. **IB** grades 1–7 per subject, 45-point diploma, TOK+EE A–E combine to 0–3 points, IA ≈ 20% of most subjects, teacher-marked then IB-moderated; boundaries are set after each session (https://ibo.org/programmes/diploma-programme/assessment-and-exams/; https://myrevisionagent.com/guides/ib-internal-assessment; https://www.tutopiya.com/tools/blog/ib-diploma-grade-boundaries-2026/). Markbands are criterion-based — structurally similar to Cambridge levels but with different descriptor language.
13. **AP** uses analytic rubrics: AP Lang essays = 6 points (thesis 0–1, evidence & commentary 0–4, sophistication 0–1), 3 FRQs = 18 points ≈ 55% of the exam; composite → 1–5 (https://apcentral.collegeboard.org/media/pdf/ap25-sg-english-language-set-1.pdf; https://collegeprep.uworld.com/ap/ap-english-language-and-composition/score-guide/). Rubric points are binary/decision-rule based — easy to make an LLM reason over.
14. **Digital SAT**: two sections (Reading & Writing, Math), two modules each, module 2 adapts to module 1, 400–1600, IRT scoring (https://www.makon.ai/blog/digital-sat-format/; https://pursu.io/guide/how-does-digital-sat-scoring-work-in-2025). **Enhanced ACT (2025–26)**: Science optional and excluded from the Composite (now average of English, Reading, Math); 131 questions without Science; 12–27% more time per question; rollout April 2025 online → Sept 2025 paper → spring 2026 school-day (https://www.learner.com/blog/act-2025-changes; https://www.kaptest.com/study/act/test-changes-2025/). Practice-test engines for these need item-difficulty calibration, not mark schemes.
15. **National exams split into two families**: *machine-scored selection tests* (ЕНТ 120 items/5 subjects; JEE Main +4/−1, 90 questions attempt 75; YKS TYT 120 MCQ in 135 min; Gaokao 750 in 3+1+2; CSAT) where the product's job is item banks + analytics; and *criteria-marked written exams* (ЕГЭ part 2, Abitur, Bac, WAEC theory, CBSE) where the AI-examiner is applicable. Sources in §1.9.
16. **ЕГЭ** has a two-scale system (первичные → тестовые, published by FIPI/Rosobrnadzor each spring after the early wave) and per-subject changes in 2026 were minimal (https://t-j.ru/guide/shkala-ege/; https://ctege.info/ege-2026/izmeneniya-ege-2026.html). ОГЭ 2026 changed four subjects; Literature gained a "Фактологическая точность" criterion and max 39 (https://lenta.ru/articles/2025/11/19/izmeneniya-oge-2026/).
17. **ЕНТ-2026** (Kazakhstan): 3 compulsory (History of Kazakhstan 20 items, reading literacy 10, mathematical literacy 10) + 2 profile subjects (40 each) = 120 items; thresholds 5/5/3/3; applicants may sit twice May–July and choose the better certificate; ~240k applicants (https://tengrinews.kz/newseducation/kazahstane-startovalo-osnovnoe-ent-format-porogovyie-ballyi-598927/; https://edu.mcfr.kz/article/4440-ent-2026-v-kazahstane-bally-predmety-izmeneniya).
18. **For the AI-examiner, the measurable targets should mirror exam-board QA**: quadratic weighted kappa (QWK) vs. official marks, exact- and adjacent-agreement, and *within-tolerance rate* per question type; the gold set should be Cambridge Example Candidate Responses + real marked scripts, never model-generated answers. Proposed targets in §4 (prior knowledge for typical human–human ranges, flagged).
19. **Product surface that follows from the marking anatomy**: mark by AO with quoted evidence spans; level-by-level justification; explicit ECF; command-word check ("you *described* but the question said *evaluate*"); context/application check for case-study papers; a "what an examiner would write in the report" panel; predicted grade with threshold provenance.
20. **Exam-prep incumbents** (Save My Exams, PMT, Seneca, Up Learn, Revisely, Cognito, ExamQA, Medify, Exam Papers Plus) could not be fetched in this session; their feature sets are summarised from prior knowledge in §3 and must be re-verified. The recurring gaps (from prior knowledge of student forums): AI marking that is too lenient or generic, weak Cambridge International coverage in UK-first products, model answers without examiner-style critique, and no end-to-end "sit → mark → diagnose → next question" loop.
21. **Legal (all prior knowledge, unverified in this session)**: past papers and mark schemes are copyright works of the boards (UCLES, Pearson, AQA, OCR, WJEC, IB, College Board). UK boards generally permit *non-commercial educational* reproduction within schools; third-party hosting is tolerated for some boards (Pearson historically grants permission to non-commercial sites) but not for Cambridge (older papers are on the restricted School Support Hub) or IB (papers are sold via the IB store and IB pursues unlicensed sites). **Do not assume the founder's library can be redistributed**; plan for licences or a "bring-your-own-paper" design.
22. **Recommended content strategy**: (a) store *facts* (syllabus structure, AO weights, command words, threshold tables) freely; (b) deep-link/embed official public PDFs rather than re-host; (c) for RAG on mark schemes, keep board text server-side and surface only short attributed extracts plus the model's own rationale; (d) generate original, board-style items at scale as the default practice corpus; (e) open licensing conversations with Cambridge, Pearson and one textbook publisher before launch; (f) allow users to upload their own copies of papers for marking (transient processing).
23. **Design constraint**: every marking output must be *auditable* — show the mark-scheme line or level descriptor relied on, the quote from the student's answer, and a confidence flag; this is what makes an AI mark defensible to teachers and what distinguishes the product from generic chatbots.
24. **Highest-value first milestones**: (1) 9609/0450 Business and 9708/0455 Economics levels-based marker with per-AO rationale; (2) 9709/0580 Maths points-based marker with ECF and method marks; (3) predicted-grade engine from published thresholds; (4) command-word-faithful question generator; (5) photo-of-handwriting → transcription confirmation → marking pipeline.

---

## 1. Part A — How the major exam systems are structured

### 1.1 Cambridge International (IGCSE, O Level, AS & A Level)

**Qualification families and codes.** IGCSE syllabuses use 0xxx codes (e.g. 0450 Business Studies, 0455 Economics, 0580 Mathematics), O Level uses 1xxx–7xxx (e.g. 7115 Business Studies), AS & A Level uses 9xxx (9609 Business, 9708 Economics, 9709 Mathematics, 9702 Physics) *(prior knowledge, unverified)*. Exam series: March (India), June, November *(prior knowledge, unverified)*. Each syllabus document is versioned by examination years (e.g. "2026–2028 syllabus", https://www.cambridgeinternational.org/Images/697371-2026-2028-syllabus.pdf).

**What Cambridge publishes per syllabus** (the AI-examiner's data model should mirror this):

| Artefact | Content | Why it matters for an AI examiner |
|---|---|---|
| Syllabus PDF | Aims, numbered content (e.g. 1.1.1…), assessment overview (papers, duration, marks, weightings), AO definitions and per-paper AO weights, command words with definitions, grade descriptions | Ground truth for tagging, weighting and question generation |
| Question paper + insert | The paper; case study/insert for business/economics | Source for context/application checks |
| Mark scheme | Generic marking principles, points-based answers, levels-of-response grids, indicative content | The supervision signal |
| Principal Examiner Report | Per component: key messages, general comments, comments on specific questions | "What loses marks" corpus |
| Example Candidate Responses | Real scripts at several grade levels with examiner comments "linked to specific parts of the answer" and "Improving the response" plus "common mistakes" lists (https://www.cambridgeinternational.org/Images/417166-example-candidate-responses.pdf) | Best gold set for calibration |
| Grade thresholds | Per component and per option, per series (https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/grade-threshold-tables/) | Predicted-grade engine |
| Learner guide / scheme of work | Study advice, command-word explanations *(prior knowledge)* | Coaching content |

**9609 Business (2026–2028 syllabus).** AOs: AO1 Knowledge and understanding ("demonstrate knowledge and understanding of business concepts, terms and theories"); AO2 Application ("apply… to problems and issues in a variety of familiar and unfamiliar business situations and contexts"); AO3 Analysis ("analyse business problems, issues and situations by using appropriate methods and techniques to make sense of qualitative and quantitative business information"); AO4 Evaluation. A Level weighting 25/25/25/25. Paper 1 (short answer + essay) AO1 35%, AO2 30%; Paper 2 (case study) Section A four compulsory 5-mark questions, Section B one 20-mark question from two; Paper 3 (case study + essay) two compulsory 30-mark questions each with written, numerical and/or diagrammatic data; Paper 4 emphasises AO3 40%, AO4 35% (https://www.tutopiya.com/blog/a-level-exam-trends-2026/a-level-2026-exam-trends-cambridge-business-9609/, https://www.tutopiya.com/learning-portal/resource/cambridge-international-a-levels/business/standard/9609, syllabus PDF above). Durations/marks per paper were not captured in the search snippets — **verify from the syllabus PDF** (the 2023+ structure is, from prior knowledge and unverified: P1 1h15/40 marks, P2 1h30/60 marks, P3 1h45/60 marks, P4 1h15/40 marks; AS = P1+P2, A Level = P1–P4).

**9708 Economics (2023–2025 and 2026–2028).** Paper 1 multiple choice, 1 hour, 30 questions (AS content); Paper 2 data response and essays, 2 hours; Paper 3 multiple choice, 1h15, 30 questions (A Level content, AS assumed); Paper 4 data response (20 marks) + essays from a choice (20 marks each). AO weighting ≈ AO1 Knowledge 35%, AO2 Analysis 40%, AO3 Evaluation 25% (https://9708economics.com/syllabus; https://www.cambridgeinternational.org/Images/697423-2026-2028-syllabus.pdf via https://www.studocu.com/row/document/st-josephs-boys-high-school/linguistics/cambridge-international-as-a-level-economics-9708-syllabus-2026-2028/155617973).

**9709 Mathematics (2026–2027).** Three routes (AS; staged A Level; linear A Level). A Level weightings: Pure Mathematics 1 — 1h50, 75 marks, 10–12 structured questions, 30%; Pure Mathematics 3 — 1h50, 75 marks, 9–11 questions, 30%; Mechanics — 1h15, 50 marks, 6–8 questions, 20%; Probability & Statistics — remaining 20% (https://www.cambridgeinternational.org/Images/697427-2026-2027-syllabus.pdf via https://cambridgepapers.net/assessment-overview-cambridge-international-as-and-a-level-mathematics-9709). Marking is points-based with M (method), A (accuracy), B (independent) marks and explicit follow-through rules *(prior knowledge, unverified)*.

**9702 Physics (2025–2027).** AO1 40%, AO2 (handling, applying and evaluating information) 40%, AO3 (experimental skills and investigations) 20%. By paper: P1 AO1 50/AO2 50; P2 50/50; P3 100% AO3; P4 50/50; P5 (Planning, Analysis and Evaluation) 1h15, 30 marks, two questions, 100% AO3 (https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf via https://www.studocu.com/row/document/beaconhouse-newlands-islamabad/computer-science/cambridge-international-as-a-level-physics-9702-syllabus-2025-2027/164735363).

**0450 IGCSE Business Studies (2023–2025).** AO1 40 / AO2 20 / AO3 25 / AO4 15 overall; Paper 1 (four questions, short answers + structured data response, whole syllabus): AO1 50/AO2 20/AO3 20/AO4 10; Paper 2 (four questions on a case-study insert): 30/20/30/20 (https://www.cambridgeinternational.org/Images/596930-2023-2025-syllabus.pdf via https://fundootutor.com/blogs/igcse-business-0450-igcse-business-studies-0450-syllabus-a-comprehensive-overview/). A 2027 version was not found — **verify**.

**0455 IGCSE Economics.** Paper 1 Multiple Choice 45 min, 30 marks, 30%; Paper 2 Structured Questions 2h15, 90 marks, 70% — one compulsory question + three from four. AO1 40 / AO2 Analysis 40 / AO3 Evaluation 20; a recent revision *increased* AO1/AO2 weight and *reduced* AO3, cutting marks on Section A Q1 (https://www.cambridgeinternational.org/Images/596945-2023-2025-syllabus.pdf; https://thinkigcse.net/economics/page/58471/new-syllabus).

**0580 IGCSE Mathematics (2025–2027).** Core (grades C–G) sits Papers 1 and 3; Extended (A\*–E) sits Papers 2 and 4; from 2025 one paper per tier is non-calculator (P1 Core, P2 Extended) and one calculator (P3, P4); each paper 50%; nine content strands (Number; Algebra and graphs; Coordinate geometry; Geometry; Mensuration; Trigonometry; Transformations and vectors; Probability; Statistics) (https://www.cambridgeinternational.org/Images/662466-2025-2027-syllabus.pdf via https://homeschool.asia/blogs/syllabus-breakdown-of-igcse-extended-maths-0580/).

**Grade thresholds and PUM.** Thresholds are set per syllabus per series and vary with paper difficulty (https://www.tutopiya.com/blog/cambridge-igcse-grading-explained/). Component-level tables give A–E minimum marks; A\* is awarded only at syllabus/option level (https://www.cambridgeinternational.org/Images/740287-business-9609-june-2025-grade-threshold-table.pdf). PUM "is not the total mark… It is a point on a common scale for all syllabuses to show whether the candidate's performance is close to the top, middle or bottom of the grade"; minimum A\* → PUM 90; PUM appears on the statement of results, not the certificate (https://www.cambridgeinternational.org/Images/209304-a-guide-to-percentage-uniform-marks.pdf; https://skolatis.com/percentage-uniform-marks-explained/). *(Prior knowledge, unverified: A→80, B→70, C→60, D→50, E→40; IGCSE F→30, G→20; within a grade PUM is linearly interpolated between thresholds.)*

**Command words (Cambridge).** Standardised from 2019 syllabuses; each syllabus prints the subset it uses (https://www.tutopiya.com/blog/igcse/command-words-keywords/igcse-command-words-complete-guide-cambridge-edexcel/). Verified definitions: *Analyse* = "identify components and the relationship between them; draw out and relate implications"; *Evaluate* = "make an informed judgement about the importance or value of something, supported by evidence" — top marks need both sides weighed and a justified conclusion; *Justify* = "support a case, choice or decision with evidence and reasoned argument" (https://www.tutopiya.com/blog/command-words-cambridge-edexcel-aqa-ib/). The full official list — from prior knowledge, unverified wording — is: Analyse, Assess (make an informed judgement), Calculate (work out from given facts, figures or information), Comment (give an informed opinion), Compare (identify/comment on similarities and/or differences), Consider (review and respond to given information), Contrast (identify/comment on differences), Define (give precise meaning), Demonstrate (show how or give an example), Describe (state the points of a topic / give characteristics and main features), Develop (take forward to a more advanced stage), Discuss (write about issue(s) or topic(s) in depth in a structured way), Evaluate, Examine (investigate closely, in detail), Explain (set out purposes or reasons / make relationships clear / say why and/or how and support with evidence), Give (produce an answer from a given source or recall/memory), Identify (name/select/recognise), Justify, Outline (set out main points), Predict (suggest what may happen based on available information), Sketch (make a simple freehand drawing showing key features), State (express in clear terms), Suggest (apply knowledge to a new situation / propose reasons or considerations), Summarise (select and present the main points). **Action:** extract the verbatim table from each target syllabus PDF and store per syllabus, since subsets differ.

### 1.2 Pearson Edexcel (GCSE 9–1, A Level, International GCSE/IAL)

- Levels-based mark schemes: "the marking grids have been designed to assess student work holistically, and the grids identify the Assessment Objective being targeted by the level descriptors"; candidates are "placed in the level that best describes their answer… with marks awarded towards the top or bottom of that level depending on how they have evidenced each of the descriptor bullet points" (https://qualifications.pearson.com/en/about-us/qualification-brands/edexcel.updates.html?article=%2Fcontent%2Fdemo%2Fen%2Fnews-policy%2Fsubject-updates%2Feconomics%2Fial-economics-assessment-support). For A Level, each *bullet* in a level is tagged to an AO — richer than Cambridge's level-per-AO grids.
- 2025: IAL Economics levels-based bullets were reworded "to better align the mark scheme and increase comparability across assessment routes" (same source) — an example of mark-scheme drift the product must version.
- Pearson explains raw marks → grade boundaries (and, for modular/IAL, uniform marks) at https://qualifications.pearson.com/en/qualifications/edexcel-a-levels/understanding-marks-and-grades.html (not fetched). Mark schemes are published after results (https://support.pearson.com/uk/s/article/Results-Mark-Schemes). *(Prior knowledge, unverified: Edexcel GCSE/A Level are linear with raw-mark boundaries; IAL is modular with UMS; A Level maths mark schemes use M/A/B marks with explicit "ft" follow-through; Pearson publishes "Examiner Reports" and ResultsPlus item-level data to schools.)*

### 1.3 AQA

- Levels of response: "Start at the lowest level of the mark scheme and use it as a ladder to see whether the answer meets the descriptor for that level"; the level descriptor "shows the average performance for the level"; indicative content "sample responses… are not intended to be complete, full or model answers… an indicative extract of a response at the required level"; and "when deciding upon a mark in the level, examiners should bear in mind the relative weightings of the assessment objectives and be careful not to over or under reward a particular skill" (https://filestore.aqa.org.uk/resources/english/AQA-87001-SMS.PDF; https://mmerevise.co.uk/app/uploads/2025/09/AQA-77121-MS-JUN24.pdf).
- *(Prior knowledge, unverified: AQA mark schemes for sciences use "levels of response" for 6-mark extended questions and point marking elsewhere; GCSE English/History/Geography/RS carry SPaG marks; AQA publishes "Reports on the exam" per paper and Enhanced Results Analysis.)*

### 1.4 OCR

- June 2025 mark schemes define annotations: ✓ correct; × incorrect; Ø omission; BOD benefit of doubt given; CON contradiction; RE rounding error; GA error in significant figures; ECF error carried forward; Level 1/2/3; BDG benefit of doubt not given; NC noted but no credit; I ignore (https://www.docsity.com/en/docs/a-level-june-2025-ocr-biology-paper-1-mark-scheme/14272294/).
- Levels procedure: "start at the highest level and work down until they reach the level that matches the answer"; within-level descriptors distinguish borderline/bottom/"just enough achievement on balance"/above bottom/consistently meets (same source).
- Assistant examiners send brief reports on candidate performance (strengths, common errors) to team leaders, which feed the published Examiners' Report (same source).

### 1.5 WJEC / Eduqas

- Publishes per-subject examiners' reports each summer (e.g. Eduqas A Level Psychology S25: https://www.eduqas.co.uk/media/mx0lc512/eduqas-a-level-psychology-report-s25-e.pdf; GCSE English Language: https://www.wjec.co.uk/media/e22pmqxa/gcse-english-language-examiners-report-summer-2025.pdf). Reports open with a summary of performance by AO and note that where responses missed the top band it was "typically due to a lack of depth rather than poor application". Mark schemes use "bands" rather than "levels" *(terminology; prior knowledge that structure is equivalent)*.

### 1.6 IB Diploma Programme

- Subjects graded 1–7; diploma max 45 = six subjects + up to 3 points from TOK + EE (each A–E, combined via matrix); pass needs ≥24 points, no E in TOK/EE, ≥12 HL points, ≥9 SL points, CAS complete, and limits on low grades (https://www.tutelaprep.com/blog/what-score-do-i-need-to-pass-ibdp-exams-2026-guide--tips/; https://ibo.org/programmes/diploma-programme/assessment-and-exams/).
- Internal assessment ≈ 20% of most subjects, teacher-marked and IB-moderated (https://myrevisionagent.com/guides/ib-internal-assessment). Boundaries are set after each session and vary (https://www.tutopiya.com/tools/blog/ib-diploma-grade-boundaries-2026/).
- *(Prior knowledge, unverified: markbands per question type, e.g. Business Management 10-mark and Economics 15-mark essay markbands with descriptors for knowledge, application, analysis/synthesis, evaluation; EE marked on criteria A–E totalling 34 marks; TOK essay 10 marks by "global impression"; command terms glossary organised by AO level.)*

### 1.7 AP (College Board)

- Analytic rubrics: AP Lang synthesis/rhetorical analysis/argument each 6 points — Row A thesis (0–1), Row B evidence & commentary (0–4), Row C sophistication (0–1); FRQs = 18 points ≈ 55% of the exam (https://apcentral.collegeboard.org/media/pdf/ap25-sg-english-language-set-1.pdf; https://collegeprep.uworld.com/ap/ap-english-language-and-composition/score-guide/). Composite (e.g. 109/120) → 1–5 (https://scienceoflearning.jhu.edu/tof/ap-lang-score-calculator).
- 2025 AP exams moved largely to digital delivery with new scoring/security processes (https://allaccess.collegeboard.org/2025-ap-exams-scoring-standards-and-security-new-digital-era). *(Prior knowledge, unverified: Calculus AB/BC FRQ = 6 questions × 9 points; readers score at the annual AP Reading with calibration; College Board publishes scoring guidelines, sample responses and scoring commentary each year — a strong gold set.)*

### 1.8 SAT / ACT

- Digital SAT: Reading & Writing + Math, each two modules, module 2 difficulty set by module 1; 400–1600 (200–800 per section); IRT scoring "meaning the difficulty of questions answered correctly factors into your score" (https://www.makon.ai/blog/digital-sat-format/; https://pursu.io/guide/how-does-digital-sat-scoring-work-in-2025; https://testbook.com/en-us/sat-exam/digital-sat-format).
- Enhanced ACT: Science optional and outside the Composite (English, Reading, Math average); 131 questions without Science vs 215 originally; 12–27% more time per question; April 2025 national online, September 2025 national paper, spring 2026 school-day (https://www.learner.com/blog/act-2025-changes; https://www.kaptest.com/study/act/test-changes-2025/; https://edisonprep.com/upcoming-changes-to-the-act-and-what-it-means-for-the-class-of-2026/). Some colleges still want Science (https://www.compassprep.com/new-act-policies/).

### 1.9 Survey of other national systems

| System | Structure (as found) | Marking type | Source |
|---|---|---|---|
| Russia ЕГЭ | Per-subject KIM with short-answer and extended-response parts; primary → 100-point test scale, published by FIPI/Rosobrnadzor each spring after the early wave; 2026 changes minimal (Russian task 7 wording widened) | Part 1 machine; Part 2 expert, criteria-based | https://t-j.ru/guide/shkala-ege/; https://ctege.info/ege-2026/izmeneniya-ege-2026.html; https://lenta.ru/articles/2026/04/21/ege-po-russkomu-yazyku/ |
| Russia ОГЭ | 2026 KIM changes in Russian, Literature, Informatics, Geography; Literature adds "Фактологическая точность" criterion, max 39; Informatics moves to domestic software | Mixed | https://lenta.ru/articles/2025/11/19/izmeneniya-oge-2026/; https://ria.ru/obrazovanie/izmeneniya-oge-2026/ |
| Kazakhstan ЕНТ | 5 subjects: History of KZ 20, reading literacy 10, math literacy 10, 2 profile × 40 = 120 items; thresholds 5/5/3/3; sit up to twice May–July; ~240k applicants in 2026 | Machine-scored | https://tengrinews.kz/newseducation/kazahstane-startovalo-osnovnoe-ent-format-porogovyie-ballyi-598927/; https://edu.mcfr.kz/article/4440-ent-2026-v-kazahstane-bally-predmety-izmeneniya |
| India JEE Main | Jan + April sessions; Paper 1: 90 questions, attempt 75; +4/−1, no penalty for unattempted; MCQ + numerical value | Machine | https://www.vedantu.com/jee-main/exam-pattern; https://infinitylearn.com/iit-jee-exam/jee-mains-exam-pattern |
| India NEET / CBSE | Not captured. *(Prior knowledge, unverified: NEET 180 questions, 720 marks, +4/−1; CBSE Class 10 to have two board exam opportunities from 2026; CBSE marking schemes published with step marks.)* | NEET machine; CBSE criteria | — |
| China Gaokao | 750 total; Chinese, Maths, foreign language 150 each; "3+1+2": Physics or History 100; two of Chemistry/Biology/Politics/Geography 100 each | Mixed; essays human-marked | https://www.lingoace.com/blog/gaokao-exam/; https://practicetestgeeks.com/gaokao/gaokao-subjects-and-scoring |
| Korea CSAT (Suneung) | Once a year in November; Korean, Math, English, Korean History (mandatory), Social/Natural Sciences, optional second foreign language; ~8 hours | Machine (MCQ + short answer); standard scores/percentiles/grades *(prior)* | https://yocket.com/blog/korean-sat-exam; https://stay.enko.kr/blog/en/what-is-suneung-a-to-z-guide-to-the-korean-college-exam-for-foreign-residents/ |
| Turkey YKS | TYT: 120 four-option MCQ in 135 min (Turkish 40, Maths 40, Social 20, Science 20), scaled 100–500; AYT 180 min; 2026 AYT on 21 June; ÖSYM publishes question booklets and answer keys | Machine | https://mhbeducation.com/en/blog/yks-exam; https://rasastudy.com/blog/yks-2026-exam-dates-turkey-guide?lang=en; https://www.osym.gov.tr/2026yks-tyt-ayt-ve-ydt-temel-soru-kitapciklari-ve-cevap-anahtarlari |
| Germany Abitur | 15-point course scale; ≥300/600 to qualify; final 1.0–4.0 via 17/3 − (points ÷ 180); common task pool extended to Biology, Chemistry, Physics from 2025 | Teacher/expert marked to Land criteria | https://www.studying-in-germany.org/german-abitur/; https://itutoronline.com/blog/abitur-subjects-and-grading-explained |
| France Baccalauréat | 40% contrôle continu, 60% terminal exams; Parcoursup 2026 no longer counts all continuous-assessment marks | Human marked with barèmes | https://www.education.gouv.fr/reussir-au-lycee/comment-calculer-votre-note-au-baccalaureat-325511; https://www.cafepedagogique.net/2025/09/02/baccalaureat-parcoursup-2026-toutes-les-notes-du-controle-continu-ne-compteront-plus/ |
| Nigeria WAEC / JAMB | WASSCE across 5 countries; 8–9 subjects from 2026; JAMB UTME registration 20 Jan–3 Mar 2026 | WAEC objective + theory; UTME CBT | https://awajis.com/waec-exam-guide-timetable-schemes-and-syllabus/; https://www.androidpols.com.ng/2025/09/2026-jamb-utme-and-waec-registration.html |
| Pakistan Matric/FSc | Pass mark raised 33%→40% nationally; grace marks 3→5 from 2025; new grading for matric 2026, intermediate 2027; Karachi boards e-marking from 2025 | Human marked | https://tribune.com.pk/story/2571144/matric-intermediate-students-will-now-need-40-marks-to-pass-exams; https://www.geo.tv/latest/575338-nationwide-increase-in-passing-and-grace-marks-for-board-exams-announced; https://tribune.com.pk/story/2517087/karachi-education-boards-to-use-e-marking-for-2025-exams |
| Singapore | 2026 last year of GCE N(T)/N(A)/O-Level awards; from 2027 the Singapore-Cambridge SEC under Full Subject-Based Banding (G1/G2/G3); A Level continues | Cambridge-style | https://www.seab.gov.sg/secondary-education-certificate-sec/; https://ask.gov.sg/seab/questions/cmkkrkf6c0019pnhlauyrt2mj |
| Australia ATAR (HSC/VCE) | ~76k HSC and ~55k VCE candidates in 2025; subjects scaled by candidates' performance in their other subjects | Human marked to marking guidelines; scaled | https://compareprivateschools.com.au/guides/atar-vce-hsc-scaling-explained/; https://www.auguide.com.au/en/blog/understanding-vce-hsc-complete-guide-parents-2025/ |
| USA HS | GPA (4.0 scale) + AP/SAT/ACT; Common Core state standards *(prior knowledge)* | — | — |

**Generalisation rule for the product:** every curriculum is describable by the same schema — {qualification, syllabus code, version/years, papers[{duration, marks, weighting, question types}], AOs[{name, definition, weight per paper}], command words[], content tree (numbered), grade scale, threshold history}. Systems differ mainly in whether extended writing is expert-marked (AI-examiner applicable) or machine-scored (item-bank/IRT applicable).

---

## 2. Part B — Anatomy of marking

### 2.1 Points-based vs levels-based schemes

| Dimension | Points-based | Levels-based / markbands |
|---|---|---|
| Typical subjects | Maths, sciences, short-answer humanities | Essays, data-response, case studies |
| Unit of credit | Each mark tied to a specific point (M/A/B marks in maths; "1 mark for each…") | A level descriptor (e.g. L1–L4) with a mark range; then position within level |
| Board procedure | Tick per point; cap by "max"; ECF/OFR applies | AQA: climb from lowest level (https://filestore.aqa.org.uk/resources/english/AQA-87001-SMS.PDF); OCR: descend from highest (https://www.docsity.com/en/docs/a-level-june-2025-ocr-biology-paper-1-mark-scheme/14272294/); Cambridge: "best fit, not perfect fit… holistic" (https://www.cambridgeinternational.org/Images/417166-example-candidate-responses.pdf) |
| Role of indicative content | Exhaustive-ish answer list, plus "accept/ignore/reject" notes | Guide only — "not… complete, full or model answers"; valid alternatives credited |
| AO handling | Usually one AO per mark | Cambridge 2023+ Business/Economics: separate level grids per AO (e.g. AO1, AO2, AO3, AO4 each with own levels) *(prior knowledge)*; Pearson: AO tagged per bullet inside a level |
| AI implementation | Extraction + matching + arithmetic check + ECF | Rubric reasoning: evidence spans → descriptor match → level → within-level placement |

### 2.2 Indicative content
Indicative content lists plausible points an examiner may see; it is neither exhaustive nor mandatory (AQA source above). For the AI examiner: indicative content is a *retrieval aid and calibration anchor*, not a checklist — a response with a valid point absent from indicative content must still be credited, and the AI should say "credited as a valid alternative not in indicative content" so a teacher can review.

### 2.3 Command words and AO tagging
Command words map to AOs and to response shapes (see §1.1 list). A practical mapping table for Cambridge Business/Economics *(compiled; wording prior knowledge)*:

| Command word | Expected shape | AO(s) usually credited | Common failure (from examiner reports) |
|---|---|---|---|
| Define / State / Identify | 1–2 sentence precision | AO1 | Repeating the term in the definition (https://www.thinka.ai/en-HK/past-paper/Cambridge-IAS-Level/Business-9609/2025-jun-v2/analysis) |
| Explain | Point + reason/mechanism (+ context if case-based) | AO1 + AO2 (+AO3) | Listing without "because…" chains |
| Analyse | Chains of cause→effect→consequence, linked to context | AO2 + AO3 | Generic textbook analysis with no context; wrong stakeholder (business vs employees) |
| Evaluate / Assess / Discuss / Recommend / Justify | Two-sided argument + weighed, contextual judgement | AO3 + AO4 | Assertions without "it depends on…"; conclusion that restates points; assuming higher sales ⇒ higher profit |
| Calculate | Formula, substitution, working, units | AO2 (quantitative) | Skipping working — all-or-nothing risk if answer wrong |

### 2.4 Own-figure rule / error carried forward
"Where an answer makes use of a candidate's own incorrect figure from previous working, the 'own figure rule' applies: full marks will be given if a correct and complete method is used" (https://qualifications.pearson.com/content/dam/pdf/BTEC-Nationals/Business/2016/External-assessments/31463H_unit3_rms_20190814.pdf). ECF is the newer name; the purpose is to avoid penalising a single error repeatedly (https://en.wikipedia.org/wiki/Error_Carried_Forward; https://www.ibmastery.com/blog/ib-business-marking-codes). Cambridge 9708 mark schemes use their own abbreviation set (https://markscheme.app/blog/cambridge-9708-mark-scheme-abbreviations — not fetched).

### 2.5 Quality of written communication (QWC / SPaG)
*(Prior knowledge, unverified: GCSE 9–1 English Literature, History, Geography and Religious Studies allocate ~5% of marks to spelling, punctuation, grammar and specialist terminology on designated questions; legacy "QWC" strands were folded into levels descriptors in current A Levels; IB and AP credit "sophistication"/"clarity" within rubric rows rather than as separate marks.)* Implementation: a separate, clearly labelled SPaG/communication sub-score only where the board awards it; otherwise fold into level descriptors.

### 2.6 How examiners are standardised
- Standardisation meetings: examiners "learn the mark scheme and practise marking sample answers… and must demonstrate they can apply the mark scheme accurately before being allowed to mark real scripts" (https://rsremotetutoring.co.uk/gcse/mark-scheme-of-gcse-paper/).
- Seeding: senior examiners pre-select "seed" items, agree a mark and a **tolerance**; seeds are inserted randomly during on-screen marking; a marker outside tolerance is paused until re-standardised (https://www.gov.uk/government/publications/ofqual-guide-for-schools-and-colleges-2025/ofqual-guide-for-schools-and-colleges-2025).
- Oversight: Ofqual attended 48 standardisation events in summer 2024 (https://www.gov.uk/government/publications/ofqual-delivery-report-2024/ofqual-delivery-report-2024); the 2025 delivery report exists (https://www.gov.uk/government/publications/ofqual-delivery-report-2025/ofqual-delivery-report-2025). NATE (Aug 2025) discussed marking quality in English (https://www.nate.org.uk/2025/08/22/making-marks-the-quality-of-gcse-and-a-level-english-exam-marking/).
- Cambridge: enquiries about results and marks on scripts are governed by https://www.cambridgeinternational.org/Images/717419-enquiries-about-results-and-marks-on-scripts.pdf.
- *(Prior knowledge, unverified: Ofqual's marking-consistency research reports probabilities of a script receiving the "definitive" grade of ~0.96 for maths but ~0.6 for English Language/History — i.e. human reliability for extended writing is itself limited; tolerances are typically ±1 mark on short items and a few marks on 20–30-mark essays.)*

### 2.7 Typical examiner-report criticisms (verified 9609 + prior knowledge by subject)
Verified (9609, 2024–2025 series): wrong stakeholder focus (Q5(a) autocratic management — employees, not business); definitions that recycle the term; missing formula/working (QZ contract profit); revenue/profit confusion; over-analysing appendices and running out of time (https://www.thinka.ai/en-HK/past-paper/Cambridge-IAS-Level/Business-9609/2025-jun-v2/analysis; https://bestexamhelp.com/exam/cambridge-international-a-level/business-9609/2024/9609_m24_er.pdf; https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload/9609_m25_er.pdf).
*(Prior knowledge, unverified, by subject — to be replaced with quotes once reports are fetched):* Maths — premature rounding, not showing method, misreading "exact"; Physics — units/sig figs, quoting rather than applying laws, poor graph scales in P5; Economics — unlabelled or wrong diagrams, evaluation absent or generic, not using data provided; English — "feature-spotting" without effect, retelling plot; History — narrative instead of argument, ignoring the question's date range; Geography — case-study detail missing; Computer Science — pseudocode without structure.

---

## 3. Part C — What exam-prep products do with past papers

**Caveat: none of these sites could be fetched in this session; the table is prior knowledge (as of 2025) and must be re-verified, especially pricing and AI features.**

| Product | Core assets | AI/adaptive features | Boards | Known gaps (prior knowledge from forums) |
|---|---|---|---|---|
| Save My Exams | Revision notes, topic questions with model answers, past papers, flashcards, videos | AI-marked practice / mock features introduced 2024–25 (name/scope unverified) | AQA, Edexcel, OCR, WJEC, CIE, IB, AP, SAT | Paywall; model answers not always in examiner voice; AI marks reported as lenient |
| Physics & Maths Tutor (PMT) | Free past papers by year and by topic, mark schemes, notes, tutoring/courses | Limited (tutor marketplace) | UK boards + CIE for some subjects | PDFs only; no marking loop; states permission from boards for hosting (unverified) |
| Seneca Learning | Free adaptive courses; premium | AI marking of exam-style questions (launched ~2023, unverified) | UK boards | Shallow at A Level; AI feedback generic |
| Up Learn | Video-led A Level courses with A\*/A guarantee (money-back, conditions apply) | Adaptive quizzing | AQA/Edexcel/OCR A Level | Few subjects; no free tier |
| Revisely | Notes, quizzes | AI quiz/flashcard generator from uploaded notes; AI marking of exam answers | UK boards | Accuracy of generated items |
| Cognito | Free GCSE science/maths videos + quizzes | — | UK GCSE | No A Level |
| ExamQA | Past-paper questions by topic, mark schemes | — | UK GCSE/A Level sciences | Limited feedback |
| Medify | UCAT/BMAT question banks, mocks, analytics | Adaptive analytics | UCAT | Not school curriculum |
| Bicycle | GCSE app (details unverified) | AI tutoring (unverified) | UK GCSE | — |
| Exam Papers Plus | 11+/13+ practice papers, printable/digital | — | UK entrance | Not curriculum exams |

Pattern: incumbents are strong on *content aggregation* (notes + questions + PDFs) and weak on *examiner-grade feedback loops*. None publishes agreement statistics for AI marking, none exposes per-AO marking with quoted evidence, and none links marks to published thresholds for a predicted grade with provenance. This is the gap.

---

## 4. Part D — Requirements for an AI examiner

### 4.1 Accuracy targets and how to measure them
Metrics (standard in automated-essay-scoring research; **specific literature values are prior knowledge and unverified in this session**):
- **Quadratic weighted kappa (QWK)** between AI mark and official/senior-examiner mark per question; report also exact agreement, adjacent (±1) agreement, mean absolute error, and **within-tolerance rate** using board-style tolerances.
- **Bias**: mean signed error (leniency/severity) overall and by level, by answer length, by language background.
- **Calibration**: agreement should hold at each level; report a confusion matrix per level.
- **Human baseline**: human–human QWK on essay scoring is typically ~0.7–0.85 *(prior knowledge)*; Ofqual-style probability of "definitive mark" is much lower for essays than maths *(prior knowledge)*.

Proposed launch gates (product decisions, not literature): points-based numeric/short answer — exact agreement ≥ 97%, within ±1 mark ≥ 99.5%; levels-based 8–12 mark — QWK ≥ 0.80, within ±1 ≥ 90%; 20–30 mark essays — QWK ≥ 0.75, within board-style tolerance (±2–3) ≥ 85%, level agreement ≥ 80%; mean signed error within ±0.3 marks per 10.

Gold sets: (1) Cambridge Example Candidate Responses (real scripts, official marks, examiner comments — https://www.cambridgeinternational.org/Images/417166-example-candidate-responses.pdf); (2) AP sample responses with scoring commentary; (3) teacher-marked mocks from partner schools with double marking; (4) synthetic answers only for robustness (never as ground truth). Replicate the *seeding* protocol: hold-out seeds inserted into every marking batch in production; drift alarms if the model exits tolerance.

### 4.2 Calibration against mark schemes and examiner reports
- Ingest mark schemes as structured objects: {question id, max marks, scheme type, level grid per AO, indicative content, accept/reject notes, ECF rules}. Version by series (schemes change wording; see Pearson 2025 rewording).
- Ingest examiner reports as *rules*: each criticism becomes a checkable heuristic tagged to syllabus point and command word (e.g. "if question asks impact on employees and answer discusses business, flag AO2 misdirection").
- Per-board procedure prompts: AQA ladder-up; OCR top-down; Cambridge best-fit holistic per AO grid; Pearson bullet-level AO evidence.

### 4.3 Showing the rationale
Output schema per question: total mark; per-AO or per-level breakdown; for each credited mark/level, the **quoted span** from the student's answer and the mark-scheme line or descriptor relied on; uncredited attempts with the reason (e.g. "assertion without justification — AO4 L1 not L2"); annotations using an OCR-style vocabulary (✓ × BOD ECF NC I); command-word compliance check; context/application check for case-study papers; "examiner-report style" one-paragraph summary; confidence and "show teacher" flag when ambiguous.

### 4.4 Predicted-grade modelling
Inputs: per-component raw marks on the student's practice papers; official component and option thresholds for the same syllabus across recent series; component weightings. Method: convert each component score to PUM-equivalent using the series threshold table (A\* = 90 etc.), aggregate with weightings, report a grade *range* with the threshold series used and the spread across the last N series; show the "marks to next grade" delta per component. Note that A\* exists only at option level (https://www.cambridgeinternational.org/Images/740287-business-9609-june-2025-grade-threshold-table.pdf). For IB/AP show the boundary variability explicitly.

### 4.5 Tagging questions by syllabus point
Each past-paper question and generated item carries: syllabus code + version, content point(s) (e.g. 9609 1.1.1), AO(s) with mark split, command word, marks, paper/section, cognitive demand, data type (text/numeric/diagram), difficulty proxy (facility from thresholds where available). Tagging should be model-assisted then human-verified for the initial corpus; the tag set mirrors the syllabus numbering exactly so it survives syllabus revisions with a mapping table.

### 4.6 Generating faithful exam-style questions
Constraints: use the board's command words only; respect mark tariffs and AO split per question type (e.g. 9609 P2 Section A 5-mark; P3 30-mark data-rich compulsory); reproduce insert/case-study conventions (fictional company, currency, tables, appendices); produce a mark scheme in the board's format (points list or level grid) at the same time; run a "style-similarity" review against real papers and a "solvability" check with an independent model. Never regenerate real past-paper text verbatim.

### 4.7 Diagrams, graphs, calculations, handwriting
- Photo → vision model transcription → **student confirms transcription** (editable) → marking. Keep the confirmation step: it converts an OCR problem into a text problem and protects against mis-marking illegible work.
- Calculations: recompute with a tool; award method marks from working; apply ECF across parts; enforce units/sig-fig rules the scheme specifies (OCR RE/GA annotations).
- Diagrams (economics supply/demand, physics graphs): require labelled axes/curves/shifts; mark scheme diagram criteria as a checklist; accept a structured description when the image is unclear.
- Physics P5 / practical: mark tables, graph scaling, gradient/intercept extraction, uncertainty statements as discrete points.

### 4.8 Essay-planning coaching and timing practice
- Plan templates derived from the level grids (e.g. for a 20-mark evaluate: define → two developed context-linked analysis chains → counter-argument → weighted judgement with "it depends on").
- Timing: minutes-per-mark from paper duration/marks (e.g. 9709 P1 75 marks in 110 min ≈ 1.47 min/mark; 9702 P5 30 marks in 75 min = 2.5 min/mark; 0455 P2 90 marks in 135 min = 1.5 min/mark); timed mode with per-question pacing bars and a post-mortem of where time went.

---

## 5. Part E — Legal and licensing (prior knowledge, unverified in this session; treat as hypotheses to confirm with counsel)

### 5.1 Copyright status and terms of use
| Rights holder | Materials | Public availability | Typical permission position (prior knowledge) |
|---|---|---|---|
| Cambridge University Press & Assessment (UCLES) | Past papers, mark schemes, examiner reports, ECRs, syllabuses | Recent series free on public site; older archive on School Support Hub (centre login) | © UCLES; use within registered centres for teaching; third-party republication requires permission; inserts may contain third-party copyright text |
| Pearson Edexcel | Papers, mark schemes, examiner reports | Free on site after an embargo | Non-commercial educational use permitted; has historically granted permission to non-commercial revision sites on request |
| AQA | Papers, mark schemes, reports | Free | Reproduction within schools/colleges for internal use; commercial use needs permission |
| OCR | Same | Free | Similar; copyright policy page at https://www.ocr.org.uk/about/our-policies/website-policies/copyright/ (not fetched) |
| WJEC/Eduqas | Same | Free | Similar |
| IB | Past papers and markschemes | Sold via IB store; not free | Strict; IB pursues unlicensed distribution |
| College Board | Released FRQs, scoring guidelines, samples | Free on AP Central | Permission for educational, non-commercial use with attribution; SAT practice materials under CB terms |
| Textbook publishers (Hodder, CUP, OUP, Pearson, Collins) | Endorsed textbooks | Purchased | No right to store/redistribute full text; RAG over full text needs a licence |

### 5.2 AI-licensing landscape 2025–2026 (prior knowledge, unverified)
- Publisher–AI deals proliferated in 2024–2025 (e.g. Wiley, Taylor & Francis, HarperCollins, OUP and CUP announced or disclosed licensing/partnership arrangements); terms are typically training-focused, not consumer redistribution.
- UK: the 2024–25 government consultation proposed a TDM exception with rights-holder opt-out; strong creative-sector opposition; the Data (Use and Access) Act 2025 passed without resolving it and the government committed to further reports/consultation into 2026. Fair dealing for "non-commercial research" and "quotation" is narrow and does not cover a commercial consumer product's full-text storage.
- US: *Thomson Reuters v. Ross* (D. Del., Feb 2025) rejected fair use for training on headnotes; *Bartz v. Anthropic* (N.D. Cal., June 2025) found training on lawfully acquired books fair use but not the pirated library, followed by a large settlement (Sept 2025); *Kadrey v. Meta* (June 2025) found fair use on the record presented. Net: lawful acquisition and non-substitutive output matter; verbatim display of protected text to consumers is the highest-risk activity.

### 5.3 What competitors do (prior knowledge, unverified)
PMT and similar sites state they host board materials with permission (Pearson/AQA/OCR) and that Cambridge papers are hosted for a limited window or linked; Save My Exams re-writes questions and model answers in its own words and links to official papers for some boards; IB materials are generally not re-hosted by reputable sites.

### 5.4 Recommended content strategy (cautious)
1. **Facts layer (safe):** syllabus structure, AO weights, paper formats, command words with attribution, threshold tables, examiner-report *rules* paraphrased with citation.
2. **Link layer:** deep links / embedded viewers to official public PDFs; never strip copyright notices.
3. **RAG layer (server-side only):** mark schemes and examiner reports indexed for retrieval; surface short attributed extracts (a mark-scheme line, a level descriptor) plus the model's own rationale; log every extract for licence audits.
4. **Bring-your-own-paper:** students upload their own copy of a paper/answer; processed transiently, not added to a shared corpus.
5. **Original items as the default corpus:** board-style generated questions with generated mark schemes; clearly labelled "in the style of".
6. **Licences before scale:** open discussions with Cambridge (partnership/licensing), Pearson, and one textbook publisher for the initial subjects; budget for per-user or per-title fees.
7. **Textbooks:** use for retrieval-grounded explanations with snippet limits and citations; no chapter display unless licensed.
8. **Geography of risk:** UK/EU stricter than US; IB and Cambridge stricter than Pearson/AQA; treat national exam bodies (FIPI, ÖSYM, NTA) case by case — many publish demo variants/answer keys under open terms.

---

## Implications for our product (testable rules and features)

1. **Data model = board schema.** Every curriculum is stored as {qualification, syllabus code, version years, papers, AOs with per-paper weights, command words, numbered content tree, grade scale, threshold history}. Test: 9609, 9708, 9709, 9702, 0450, 0455, 0580, IB Econ, AP Lang, ЕГЭ Maths load without schema changes.
2. **Mark per AO, never only holistically**, for boards whose schemes split levels by AO (Cambridge 2023+ Business/Economics). Test: output contains per-AO marks summing to total.
3. **Follow the board's level procedure** (AQA ladder-up, OCR top-down, Cambridge best-fit). Test: procedure named in rationale and matches board config.
4. **Quote or it didn't happen.** Every credited mark cites a span from the student's answer plus the scheme line/descriptor. Test: no mark without a span.
5. **Command-word compliance check** runs before marking; mismatch produces a specific coaching line. Test: "describe" answer to an "evaluate" question is capped at AO1/AO2 levels and flagged.
6. **Context/application detector** for case-study papers: penalise generic answers exactly as the scheme does (AO2 level 1). Test: identical answer with company names removed scores lower on AO2.
7. **ECF/OFR implemented across parts**; rationale states "own figure carried forward". Test: wrong part (a) figure used correctly in (b) earns full method marks.
8. **Annotation vocabulary** aligned to OCR-style codes (✓ × Ø BOD CON RE GA ECF NC I) rendered inline. Test: each annotation maps to a documented meaning.
9. **Working-required rule for calculations**: award method marks only when working is shown; warn students that missing working risks zero (9609 report).
10. **Indicative-content is a guide**: valid alternatives are credited and labelled "not in indicative content" for teacher review.
11. **Predicted grade with provenance**: raw → component threshold → PUM → option grade, showing series used and range across recent series; A\* only at option level. Test: recompute against a published threshold table exactly.
12. **Seeded-script QA in production**: every marking model version must pass a held-out seed set with per-question tolerances before deploy; publish QWK/tolerance stats per subject in-app.
13. **Reliability disclosure**: display confidence and "ask a teacher" flag when the model's self-consistency across re-marks exceeds tolerance.
14. **Examiner-report voice**: after each mock, generate a "Principal Examiner" style report (key messages, general comments, question-level comments) using verified criticism patterns.
15. **Question generator constrained by tariff/AO/command word** and paired with a board-format mark scheme; style check against real papers; solvability check by a second model.
16. **Syllabus-point tagging at ingestion**, human-verified for the seed corpus; tags identical to syllabus numbering; mapping tables across syllabus versions.
17. **Handwriting pipeline with confirmation step** (photo → transcription → student edits → mark). Test: marking never proceeds on unconfirmed transcription when confidence < threshold.
18. **Diagram checklists** for economics/physics graphs (axes, labels, shifts, gradient) drawn from mark-scheme criteria.
19. **Timing mode** with minutes-per-mark pacing derived from paper metadata and per-question post-mortem.
20. **Essay planner templates** derived from level descriptors; the planner enforces two-sided argument + contextual judgement for evaluate/assess/discuss.
21. **Mark-scheme versioning by series**; rationale cites the series and version; alerts when a syllabus revision changes AO weights (e.g. 0455).
22. **Licensing-aware storage**: board text lives server-side; UI shows short attributed extracts; user uploads are transient; original generated items are the default practice bank.
23. **Machine-scored exams get a different engine**: item banks with IRT/difficulty calibration and adaptive practice (SAT/ЕНТ/JEE/YKS), not rubric marking.
24. **Continuous-assessment systems (IB IA/EE, Bac contrôle continu, Abitur)** get criteria-based coaching and moderation-style feedback, with clear "teacher marks first" messaging.
25. **Per-subject examiner-criticism packs** curated from official reports and refreshed each series; each pack item is a machine-checkable heuristic plus a student-facing tip.

---

## Open questions / things we could not verify

1. Exact 9609 (2026–2028) paper durations/marks and the per-AO level grids (marks per level per AO for 5/8/12/20/30-mark questions) — needs the syllabus and 2–3 mark schemes.
2. Verbatim Cambridge command-word definitions per syllabus (list above is from memory).
3. 0450 2027 syllabus changes; 0455 revision date; 9709 P2/P6 details.
4. Concrete June 2025 threshold numbers for 9609/9708/9709/9702/0450/0455/0580 (tables exist at the URLs cited but were not readable).
5. Whether human–human agreement statistics (Ofqual marking-consistency studies) are current enough to serve as targets; exact tolerance values used by boards.
6. Current AI-marking features, names, pricing and user complaints for Save My Exams, PMT, Seneca, Up Learn, Revisely, Cognito, ExamQA, Medify, Bicycle, Exam Papers Plus — none fetched.
7. 2025–2026 peer-reviewed QWK results for GPT/Claude/Gemini on rubric-based marking, and any UK exam-board AI-marking pilots (AQA/OCR/Pearson/Cambridge) and Ofqual's stated position.
8. All Part E claims: current wording of Cambridge, Pearson, AQA, OCR, IB, College Board terms; PMT's/SME's permission statements; 2025–26 publisher AI-licence terms; UK copyright-and-AI policy status as of September 2026; status of US cases.
9. NEET 2026 and CBSE 2026 two-exam structure; CSAT scoring bands; JAMB UTME 2026 format details.
10. Whether 9609 Paper 3 is "two compulsory 30-mark questions" (search snippet) vs a multi-question case study — confirm against the paper.

---

## Sources

1. https://www.cambridgeinternational.org/Images/697371-2026-2028-syllabus.pdf (9609 syllabus 2026–2028; not fetched, cited via snippets)
2. https://www.tutopiya.com/blog/a-level-exam-trends-2026/a-level-2026-exam-trends-cambridge-business-9609/
3. https://www.tutopiya.com/learning-portal/resource/cambridge-international-a-levels/business/standard/9609
4. https://www.tutopiya.com/blog/igcse/command-words-keywords/igcse-command-words-complete-guide-cambridge-edexcel/
5. https://www.tutopiya.com/blog/command-words-cambridge-edexcel-aqa-ib/
6. https://markscheme.app/blog/cambridge-command-words-explained (not fetched)
7. https://www.cambridgeinternational.org/Images/417166-example-candidate-responses.pdf
8. https://www.cambridgeinternational.org/Images/583260-cambridge-international-as-and-a-level-english-language-9093-paper-1-example-candidate-responses.pdf
9. https://www.cambridgeinternational.org/Images/717419-enquiries-about-results-and-marks-on-scripts.pdf
10. https://www.cambridgeinternational.org/Images/740287-business-9609-june-2025-grade-threshold-table.pdf
11. https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/grade-threshold-tables/
12. https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/grade-threshold-tables/june-2025/
13. https://www.cambridgeinternational.org/Images/209304-a-guide-to-percentage-uniform-marks.pdf
14. https://skolatis.com/percentage-uniform-marks-explained/
15. https://www.tutopiya.com/blog/cambridge-igcse-grading-explained/
16. https://www.cambridgeinternational.org/Images/697427-2026-2027-syllabus.pdf (9709)
17. https://cambridgepapers.net/assessment-overview-cambridge-international-as-and-a-level-mathematics-9709
18. https://www.cambridgeinternational.org/Images/596930-2023-2025-syllabus.pdf (0450)
19. https://fundootutor.com/blogs/igcse-business-0450-igcse-business-studies-0450-syllabus-a-comprehensive-overview/
20. https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf (9702)
21. https://www.studocu.com/row/document/beaconhouse-newlands-islamabad/computer-science/cambridge-international-as-a-level-physics-9702-syllabus-2025-2027/164735363
22. https://www.cambridgeinternational.org/Images/662466-2025-2027-syllabus.pdf (0580)
23. https://homeschool.asia/blogs/syllabus-breakdown-of-igcse-extended-maths-0580/
24. https://www.cambridgeinternational.org/Images/697423-2026-2028-syllabus.pdf (9708)
25. https://9708economics.com/syllabus
26. https://www.cambridgeinternational.org/Images/596945-2023-2025-syllabus.pdf (0455)
27. https://thinkigcse.net/economics/page/58471/new-syllabus
28. https://qualifications.pearson.com/en/about-us/qualification-brands/edexcel.updates.html?article=%2Fcontent%2Fdemo%2Fen%2Fnews-policy%2Fsubject-updates%2Feconomics%2Fial-economics-assessment-support
29. https://qualifications.pearson.com/en/qualifications/edexcel-a-levels/understanding-marks-and-grades.html
30. https://support.pearson.com/uk/s/article/Results-Mark-Schemes
31. https://qualifications.pearson.com/content/dam/pdf/BTEC-Nationals/Business/2016/External-assessments/31463H_unit3_rms_20190814.pdf
32. https://filestore.aqa.org.uk/resources/english/AQA-87001-SMS.PDF
33. https://mmerevise.co.uk/app/uploads/2025/09/AQA-77121-MS-JUN24.pdf
34. https://www.docsity.com/en/docs/a-level-june-2025-ocr-biology-paper-1-mark-scheme/14272294/
35. https://www.eduqas.co.uk/media/mx0lc512/eduqas-a-level-psychology-report-s25-e.pdf
36. https://www.wjec.co.uk/media/e22pmqxa/gcse-english-language-examiners-report-summer-2025.pdf
37. https://ibo.org/programmes/diploma-programme/assessment-and-exams/
38. https://myrevisionagent.com/guides/ib-internal-assessment
39. https://www.tutelaprep.com/blog/what-score-do-i-need-to-pass-ibdp-exams-2026-guide--tips/
40. https://www.tutopiya.com/tools/blog/ib-diploma-grade-boundaries-2026/
41. https://apcentral.collegeboard.org/media/pdf/ap25-sg-english-language-set-1.pdf
42. https://collegeprep.uworld.com/ap/ap-english-language-and-composition/score-guide/
43. https://scienceoflearning.jhu.edu/tof/ap-lang-score-calculator
44. https://allaccess.collegeboard.org/2025-ap-exams-scoring-standards-and-security-new-digital-era
45. https://www.makon.ai/blog/digital-sat-format/
46. https://pursu.io/guide/how-does-digital-sat-scoring-work-in-2025
47. https://testbook.com/en-us/sat-exam/digital-sat-format
48. https://www.learner.com/blog/act-2025-changes
49. https://www.kaptest.com/study/act/test-changes-2025/
50. https://edisonprep.com/upcoming-changes-to-the-act-and-what-it-means-for-the-class-of-2026/
51. https://www.compassprep.com/new-act-policies/
52. https://en.wikipedia.org/wiki/Error_Carried_Forward
53. https://www.ibmastery.com/blog/ib-business-marking-codes
54. https://markscheme.app/blog/cambridge-9708-mark-scheme-abbreviations (not fetched)
55. https://www.gov.uk/government/publications/ofqual-guide-for-schools-and-colleges-2025/ofqual-guide-for-schools-and-colleges-2025
56. https://www.gov.uk/government/publications/ofqual-delivery-report-2024/ofqual-delivery-report-2024
57. https://www.gov.uk/government/publications/ofqual-delivery-report-2025/ofqual-delivery-report-2025
58. https://rsremotetutoring.co.uk/gcse/mark-scheme-of-gcse-paper/
59. https://www.nate.org.uk/2025/08/22/making-marks-the-quality-of-gcse-and-a-level-english-exam-marking/
60. https://www.thinka.ai/en-HK/past-paper/Cambridge-IAS-Level/Business-9609/2025-jun-v2/analysis
61. https://bestexamhelp.com/exam/cambridge-international-a-level/business-9609/2024/9609_m24_er.pdf
62. https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload/9609_m25_er.pdf
63. https://t-j.ru/guide/shkala-ege/
64. https://ctege.info/ege-2026/izmeneniya-ege-2026.html
65. https://lenta.ru/articles/2026/04/21/ege-po-russkomu-yazyku/
66. https://lenta.ru/articles/2025/11/19/izmeneniya-oge-2026/
67. https://ria.ru/obrazovanie/izmeneniya-oge-2026/
68. https://tengrinews.kz/newseducation/kazahstane-startovalo-osnovnoe-ent-format-porogovyie-ballyi-598927/
69. https://edu.mcfr.kz/article/4440-ent-2026-v-kazahstane-bally-predmety-izmeneniya
70. https://www.vedantu.com/jee-main/exam-pattern
71. https://infinitylearn.com/iit-jee-exam/jee-mains-exam-pattern
72. https://www.lingoace.com/blog/gaokao-exam/
73. https://practicetestgeeks.com/gaokao/gaokao-subjects-and-scoring
74. https://yocket.com/blog/korean-sat-exam
75. https://stay.enko.kr/blog/en/what-is-suneung-a-to-z-guide-to-the-korean-college-exam-for-foreign-residents/
76. https://mhbeducation.com/en/blog/yks-exam
77. https://rasastudy.com/blog/yks-2026-exam-dates-turkey-guide?lang=en
78. https://www.osym.gov.tr/2026yks-tyt-ayt-ve-ydt-temel-soru-kitapciklari-ve-cevap-anahtarlari
79. https://www.studying-in-germany.org/german-abitur/
80. https://itutoronline.com/blog/abitur-subjects-and-grading-explained
81. https://www.education.gouv.fr/reussir-au-lycee/comment-calculer-votre-note-au-baccalaureat-325511
82. https://www.cafepedagogique.net/2025/09/02/baccalaureat-parcoursup-2026-toutes-les-notes-du-controle-continu-ne-compteront-plus/
83. https://awajis.com/waec-exam-guide-timetable-schemes-and-syllabus/
84. https://www.androidpols.com.ng/2025/09/2026-jamb-utme-and-waec-registration.html
85. https://tribune.com.pk/story/2571144/matric-intermediate-students-will-now-need-40-marks-to-pass-exams
86. https://www.geo.tv/latest/575338-nationwide-increase-in-passing-and-grace-marks-for-board-exams-announced
87. https://tribune.com.pk/story/2517087/karachi-education-boards-to-use-e-marking-for-2025-exams
88. https://www.seab.gov.sg/secondary-education-certificate-sec/
89. https://ask.gov.sg/seab/questions/cmkkrkf6c0019pnhlauyrt2mj
90. https://compareprivateschools.com.au/guides/atar-vce-hsc-scaling-explained/
91. https://www.auguide.com.au/en/blog/understanding-vce-hsc-complete-guide-parents-2025/
92. https://www.ocr.org.uk/about/our-policies/website-policies/copyright/ (not fetched)
