# Research Index — decisions, numbers, contradictions, reading guide

*Compiled 6 September 2026 from nine research briefs (~73k words) in `research/`. Read this instead of the briefs; open a brief only when the pointer says so. Source pointers use `<file>#<section heading>`. Two further files (`gap-legal-and-incumbents.md`, `gap-marking-and-cambridge.md`) exist but were empty stubs at compile time — do not cite them. Abbreviations: FB = frontier-baseline.md, EC = edu-competitors.md, LS = learning-science.md, ES = exam-systems.md, UX = ux-design.md, AR = architecture.md, BM = business-moat.md, SV = student-voice.md, CS = corpus-sample.md.*

## A. Decisions the evidence already forces

### Positioning

1. **Do not sell "Socratic chat" — it is free everywhere and only a prompt layer.** — evidence: all three lab study modes are free and toggle-off in one click; OpenAI's FAQ concedes Study Mode "may give a direct answer". — source: FB#0. Executive summary (items 2–3); EC#1. Big-lab study modes.
2. **The home object is a Course = board + syllabus code + level + exam session, not "New chat".** — evidence: no lab product maps answers to a syllabus code, AO, command word or mark-scheme line; Study Mode cannot run inside ChatGPT Projects. — source: FB#7. "Things all of them do badly"; EC#8. Implications (items 2–3).
3. **The hero feature is examiner-calibrated marking with a published agreement number.** — evidence: students' #1 exam pain is lenient/inconsistent marking ("ChatGPT predicts me like 16 marks and in reality I'll get 3"); no competitor publishes agreement statistics. — source: SV#2.2 The marking problem in depth; ES#3. Part C; EC#5. White-space opportunities (rank 1).
4. **Never let the core value be "the answer".** — evidence: Chegg lost >500k subscribers, ~USD 14B market value, 22% + 45% layoffs, stock ~USD 1. — source: EC#3. Why players failed; BM#4.1 Failures and shocks.
5. **Never message "AI replaces teachers/tutors".** — evidence: Duolingo's "AI-first" memo cost ~400k TikTok followers and two ~5% US DAU dips. — source: BM#4.1; EC#7. Ten mistakes (item 4).
6. **Beachhead = Cambridge International A Level/IGCSE; then UK boards; then one structured national exam (ЕГЭ or UNT).** — evidence: CAIE is fragmented micro-startups (ExamPal, Paperstack, MarkMaster) and publishes the most complete marking supervision signal of any board. — source: EC#0 (item 14); ES#0 (item 1); BM#2.3 International sequencing.
7. **No efficacy claim that is not pre-registered; realistic target 0.3–0.7 SD, never "2x".** — evidence: Bloom's 2-sigma never replicated (96-study meta ≈0.37 SD); Alpha School's "2.6x" collapsed under 404 Media scrutiny. — source: LS#1.8 Mastery learning, Bloom, ITS; EC#7 (item 5).
8. **Build a system (content + marking + learner model + school workflow), not a chatbot skin.** — source: EC#3 (last row); BM#6.2 Why a company, not a feature.

### Pedagogy and tutor behaviour

9. **Effort gate: no solution on a gradable item before an attempt, a plan, or "don't know where to start" + one sentence.** — evidence: Bastani et al. 2025 (n≈1,000): unguarded GPT +48% practice but lower exam scores; guard-railed tutor +127% practice, no exam harm. — source: LS#3.1 The help ladder (Rule A1); LS#2.1 Evidence matrix.
10. **Five-rung help ladder, one rung per turn; entry rung set by mastery (<0.4 → worked example; >0.7 → question).** — evidence: expertise reversal: high assistance helps novices d=0.505, hurts experts d=−0.428. — source: LS#3.1 (Rules A2–A3); LS#1.5 Worked examples.
11. **"Just give me the answer" is honoured after one attempt via explicit intent buttons (Teach me / Check my steps / Just the answer), labelled "seen-solution", followed by a near-transfer item and a 24–72 h retest — never refused, never lectured.** — evidence: refusals and condescension drive churn ("annoys you into learning"); students complain in both directions. — source: LS#3.10; SV#2.1 Top 25 pains (#9, #10); SV#Implications (item 10); EC#7 (item 9).
12. **Tutoring turns ≤120 words, one move, one question, hand the pen back.** — evidence: "walls of text" is a top-6 pain; multi-turn pedagogy failures rise 17.7% → 77.8% (SafeTutors). — source: LS#3.2 Anatomy of a good tutoring turn; SV#2.1 (#6); LS#2.5.
13. **Ban person-praise, unearned praise, exclamation marks, emoji and "Great question"; feedback = task + process + self-regulation, opening with the highest-yield lost mark; enforce with a formatting lint.** — evidence: feedback d=0.48 driven by information content; praise inflation is worst in interpretive subjects; sycophancy is students' second-most-hated trait. — source: LS#1.7 Feedback; LS#3.6 (Rules E1, E4); SV#0 (item 4); UX#Implications (item 24).
14. **Practice design: every explanation is followed by in-session and delayed retrieval; notes render retrieval-first; daily mix ≥60% due reviews / ≥25% interleaved / ≤15% new with no blocked drills after first exposure; each new topic opens with a 3–5 item retrieval probe with confidence ratings, plus predict–postdict–compare on mocks.** — evidence: practice testing g=0.61; interleaving g=0.42 (Rohrer RCT d=0.83); productive failure d=0.36; calibration training g≈0.57. — source: LS#1.2; LS#1.4; LS#1.6; LS#1.9; LS#3.3 (Rule B2); LS#3.5 (Rule D3); LS#3.7.
15. **Every syllabus point ships with a misconception list mined from examiner reports plus diagnostic distractors.** — evidence: 9609 reports flag revenue/profit confusion, wrong stakeholder, definitions that recycle the term. — source: LS#3.3 (Rule B1); ES#2.7.
16. **Ship a cognitive-debt guard (solution-request ratio, attempt latency <8 s, copy-paste, retrieval avoidance, confidence gap) with graduated non-punitive responses, A/B-tested on 28-day retention.** — source: LS#3.11.
17. **Pedagogy is enforced by system instructions plus an orchestrator that vets each draft turn for answer leakage; 30-turn adversarial-student evals gate every prompt/model change.** — evidence: LearnLM team: robust "do not give away the answer" under pressure is developers' top request, RL >> SFT; off-the-shelf models leak the answer in the opening turn >96% of the time. — source: LS#2.4 LearnLM; LS#2.5; LS#3.12; BM#0 (item 9).
18. **The tutor pre-solves each problem with a strong model and holds the answer key; it never grades an exam-style item without a mark scheme in context.** — evidence: every positive AI-tutoring RCT gave the tutor a verified key; critics: Study Mode is "a tutor that didn't prep for the session". — source: LS#2.2; SV#0 (item 24).

### Exam engine and marking

19. **Mark per Assessment Objective with quoted evidence spans, following the board's own procedure (Cambridge best-fit per AO grid; AQA ladder-up; OCR top-down); never a bare score.** — evidence: 9609 (2026–28) weights AO1–AO4 25% each overall but Paper 1 is AO1 35%/AO2 30% and Paper 4 AO3 40%/AO4 35%. — source: ES#0 (items 2–4); ES#2.1; ES#4.3 Showing the rationale.
20. **Two marking engines: points-based (M/A/B marks, ECF/own-figure rule, working required) and levels-based (descriptor → level → position within level); encode per-board conventions ("//", "ORA", "ecf", "max", OCR codes ✓ × Ø BOD CON RE GA ECF NC I).** — evidence: OFR/ECF is universal; students report ChatGPT crediting both halves of "X // Y". — source: ES#2.1; ES#2.4; ES#0 (item 7); SV#Implications (item 5).
21. **Command-word compliance check before marking; mismatch caps the level and produces a coaching line.** — source: ES#1.1 Command words; ES#2.3.
22. **Launch gates per paper: points-based exact ≥97%, ±1 ≥99.5%; 8–12-mark levels QWK ≥0.80, ±1 ≥90%; 20–30-mark essays QWK ≥0.75, within tolerance ≥85%, level agreement ≥80%; signed error within ±0.3/10; run-to-run ≤1 mark. Gold sets are real marked scripts (Cambridge Example Candidate Responses, AP samples, double-marked mocks); production runs seeded scripts with tolerances like Ofqual. Hide marking and predicted grades below gate.** — evidence: top models are ~±1 mark from teachers but more lenient than trained examiners; three AIs gave 4/6, 5/6, 6/6 for one essay. — source: ES#4.1 Accuracy targets; ES#2.6; EC#8 (item 5); AR#2.7; SV#2.1 (#1, #12).
23. **Correct for LLM generosity (examiner persona, negative exemplars, monthly bias audit per model); ensemble two model families on essays; disagreement >1 level → human.** — source: EC#8 (items 6, 8); AR#2.6; SV#3 (wish #1).
24. **Predicted grade = raw → component threshold → PUM → option grade, shown as a range across recent series with "marks to next grade"; A* only at option level.** — evidence: thresholds are per component per series; minimum A* = PUM 90. — source: ES#1.1 Grade thresholds and PUM; ES#4.4; EC#8 (item 10).
25. **Handwriting: photo → transcription → student confirms → mark; never mark unconfirmed low-confidence transcription.** — source: ES#4.7; AR#1.5 (vision row); UX#2 Composer design.
26. **Timed mock mode derives minutes-per-mark from paper metadata, supports extra-time percentages and rest breaks, and ends with a Principal-Examiner-style debrief.** — source: ES#4.8; LS#1.10; SV#8.
27. **Question generation is constrained by tariff, AO split and command word, emits a board-format mark scheme, passes a style check and an independent-model solvability check, never reproduces real paper text.** — source: ES#4.6; SV#3 (wish #8).
28. **Machine-scored exams (SAT, ЕНТ, JEE, YKS) get an item-bank/IRT engine; IB IA/EE get criteria coaching with "teacher marks first".** — source: ES#0 (item 15); ES#Implications (items 23–24).

### Content, library and licensing

29. **Curricula are data packs with one schema {qualification, syllabus code, version years, papers, AOs with per-paper weights, command words, numbered content tree, grade scale, threshold history}; a new board = ingestion, no code.** — source: ES#1.9 (generalisation rule); ES#Implications (item 1); EC#8 (item 3).
30. **Ingest from PDFs with a two-pass pipeline (Docling structural parse + VLM page audit, per-page confidence, human QA queue) — never from text dumps.** — evidence: the founder's sample lost every figure, flattened maths and duplicated blocks; OCR tools score 29–84 on old-scan maths. — source: CS#2 Defects and quirks; AR#2.1; AR#0 (item 9).
31. **Every chunk carries board/syllabus/version/paper/question/AO/command-word/page metadata and a trust rank (syllabus > endorsed textbook > mark scheme > examiner report > revision notes > user upload); retrieval filters by syllabus code and version before similarity; conflicts between uploaded notes and canon are surfaced with citations.** — evidence: sample notes contain factual slips ("273°C", uracil in DNA) and stale editions (9608 → 9618). — source: CS#2 (items 6, 8); CS#5; AR#2.3.
32. **Question ↔ mark-scheme item ↔ examiner comment ↔ syllabus point ↔ textbook section links are first-class rows; marking points are structured records (M1…M5 with conjunctive conditions).** — evidence: the most valuable file in the founder's sample is the hand-curated mechanisms mark-scheme extract. — source: CS#3; CS#5 (item 3); AR#2.5.
33. **Licensing posture: facts layer free; deep-link official PDFs; server-side RAG with short attributed extracts; transient user uploads; original board-style items as default practice bank; licence talks with Cambridge, Pearson and one publisher before scale. The defensible asset is the derived layer (tags, difficulty, misconceptions, calibration data), not the licensed text.** — evidence: Cambridge's older papers sit behind the School Support Hub; IB pursues unlicensed sites; publishers license non-exclusively; ZNotes is believed CC BY-NC-SA. — source: ES#5.4; BM#3.1 Scorecard; CS#3.

### Design and UX

34. **Default study layout is a three-pane workspace (Library ▸ Chat ▸ Source/Scratchpad): `280px 1fr 480px` at ≥1280 px; two panes 900–1279 px; one pane + bottom sheet <900 px.** — source: UX#27 Deliverable (d); UX#1.2.
35. **Mode is a visible chip in the composer (Tutor / Exam / Explain / Quiz), never a dropdown; the Course replaces any "Study mode" toggle.** — evidence: incumbents bury learning mode and users lose it ("So they've removed study mode?"). — source: UX#0 (item 2); UX#2; SV#2.1 (#16); FB#Implications (item 7).
36. **Every syllabus/mark-scheme/textbook claim carries a numbered citation chip that opens the exact PDF page with the span highlighted within 400 ms.** — source: UX#8 Citations; UX#28; AR#Implications (item 3).
37. **Typography: chat 17 px/1.55/68 ch; reader 18 px/1.6/66 ch; Inter default with Atkinson Hyperlegible Next, OpenDyslexic and a serif switchable; Cyrillic/Kazakh glyph coverage tested in CI.** — evidence: Butterick 15–25 px / 120–145% / 45–90 ch. — source: UX#4; UX#5; SV#9.
38. **Motion and streaming: all UI <300 ms (drawers ≤320), `cubic-bezier(.23,1,.32,1)`, never `ease-in`, no animation on Send or the palette, reduced-motion = opacity/colour only; optimistic message <50 ms, status text if TTFT >800 ms, prior paragraphs never reflow, unclosed math/code held as skeleton, no auto-scroll after 120 px user scroll.** — evidence: Kowalski/Vercel/M3/Carbon converge; Gemini's pulsing "thinking" background was criticised; TTFT varies 3–5× across providers. — source: UX#17; UX#25; UX#3; AR#4.8.
39. **Flashcards default to two buttons (Again / Got it) at FSRS 0.90; mastery is a 4-state pip per syllabus point with decay and a "why" tooltip; never a bare percentage.** — evidence: Anki users press Good 80–95% of the time; Khan mastery levels can drop. — source: UX#11; UX#12.
40. **No daily streaks, loss animations, shame notifications or confetti; ≤1 opt-in factual notification per day; weekly learning-event goals with rest days.** — evidence: abstinence-violation effect; "You made Duo sad" backlash; introjected motivation predicts ill-being. — source: UX#16; UX#23; LS#1.10; LS#3.9 (item 8).
41. **WCAG 2.2 AA as CI gates (4.5:1, 24×24 px targets, 44 pt touch, 2 px/3:1 focus, drag alternatives, 320 px reflow); dark mode is a grey ladder, never #000; OKLCH 12-step scales.** — source: UX#20; UX#19; FB#Implications (item 21).
42. **Math is native: KaTeX (htmlAndMathml) out, MathLive keypad + camera-with-LaTeX-confirmation in, lazy MathJax SRE for speech, Copy-as-LaTeX, mhchem, decimal-comma locales accepted.** — source: UX#6; UX#2; AR#3.
43. **Empty state shows work (Continue / Due / Next exam); onboarding ≤3 screens (board → subjects → exam date) with a question before an account; first session yields a marked answer within 90 s.** — source: UX#15; SV#Implications (items 16–18); FB#Implications (item 7).

### Architecture and models

44. **One primary model per task class with effort tuning, not a cheapest-token cascade: tutoring → Claude Sonnet 5 (effort medium, cached persona + syllabus pack); trivial turns → Haiku 4.5 / Gemini 3.5 Flash-Lite; essay marking → Claude Opus 5 (effort high, structured JSON per AO) with GPT-5.6 Sol as calibration marker; STEM → Opus 5 / GPT-5.6 Sol + mandatory SymPy check, DeepSeek V4-Pro as cheap second solver; vision → Gemini 3.1 Pro / 3.8 Flash; voice → Gemini Live; bulk → Batch API.** — evidence: Anthropic's measured data: caching + effort tuning beats cascades except for bimodal difficulty or corpus > one context window. — source: AR#1.5 Recommended routing policy; AR#0 (items 3–4).
45. **Cache-first prompt layout (static persona + syllabus pack ≥1,024 tokens, 1 h TTL, byte-stable, before dynamic content); CI asserts cache reads; target ≥60% cached input share.** — evidence: cache reads are 10% of input price; uncached Sonnet 5 turn ~$0.019 vs ~$0.0114 cached. — source: AR#0 (item 2); AR#6; AR#Implications (item 2).
46. **DeepSeek stays behind a flag for non-PII workloads only (second-opinion maths, synthetic items).** — evidence: PRC-headquartered; procurement frameworks restrict it. — source: AR#1.4; FB#1.4.
47. **Effort dial (Quick / Think / Deep) with auto-escalation for maths; vendor model names hidden in chat but shown on marking cards.** — evidence: GPT-5 auto-router revolt ("UI theater"); students compare grader strictness across models. — source: FB#4; FB#Implications (item 8); SV#0 (item 23).
48. **Durable learner state (mastery, misconceptions, exam date, seen-solution items) lives outside the chat and is re-injected; sessions default to one topic.** — evidence: ChatGPT degrades after ~40–50 messages; "the problem isn't intelligence, it's continuity". — source: FB#7 (item 9); SV#2.1 (#7); AR#4.3.
49. **Platform: Postgres + pgvector (HNSW, hybrid BM25+vector with RRF, metadata filters first, rerank 50→8) as the single store; typed streamed message parts over resumable SSE; prompt/model policy version pinned per conversation; retrieved chunks and uploads treated as untrusted data (OWASP LLM01/08/09) with per-route tool allow-lists and no-network sandboxes.** — source: AR#2.4; AR#4.2; AR#4.4; AR#4.6.
50. **Per-tenant policy object {residency, allowed_providers, retention_days, age_band, consent_mode} drives routing; EU/UK school tenants use Vertex regional Claude/Gemini (+10%) — Anthropic first-party has no EU inference geo.** — source: AR#4.7; AR#0 (item 7).
51. **Every numeric/symbolic final answer is machine-verified (SymPy/Pyodide) before display; quotes come only from loaded set texts, else "I can't confirm this quote".** — evidence: "makes up chemicals that don't exist"; JEE students prefer a model that admits it cannot solve. — source: AR#Implications (item 6); SV#2.1 (#3, #4); SV#Implications (items 6–7).
52. **FSRS-6 for every atomic item; desired retention ramps toward the exam (0.85 >8 weeks out, 0.90 at 3–8, 0.95 <3); intervals capped at exam date; Cepeda ratio as prior for new material; per-user optimisation after enough reviews.** — evidence: FSRS-6/7 log loss 0.337–0.346 vs HLR 0.469; optimal gap ≈20–40% of a one-week retention interval. — source: LS#1.3; LS#3.5 (D1–D2); AR#3.

### Business, pricing and go-to-market

53. **Student plan USD 6–10/month (≈49–79/year) with an "access until exams" SKU; parent plan ~USD 15–25; school seats ≤USD 10–12/student/year; regional tiers at 30–50%.** — evidence: ChatGPT Go USD 8, Google AI Plus 4.99 (students free a year), Khanmigo USD 4/mo, Quizlet USD 35.99/yr; "$20/month just isn't feasible". — source: BM#1.3; BM#Implications (items 1–2); FB#0 (items 13–14); SV#2.1 (#8).
54. **Free tier stays genuinely useful (unlimited cheap-tier explanations, generous uploads, capped daily marking, grace mode in exam weeks); the active-learning core is never paywalled after launch; limits are published in plain numbers with a session + weekly meter and never cut silently.** — evidence: Quizlet paywalling Learn/Test → 1.4/5 Trustpilot; ChatGPT Free's 3 uploads/day; Claude limits megathread 799↑/6,270 comments. — source: EC#7 (item 2); FB#7 (item 14); FB#0 (item 10); BM#Implications (item 3).
55. **Teacher mode from day one (class code, syllabus-locked assignments, see attempts and hints, audit AI marks, set allowed-help level), free for teachers; parents get a fortnightly digest without transcripts.** — source: BM#2.2; SV#5.3; SV#10 (P9).
56. **Grow through creators and communities with a free-forever community tool; never SEO dependence; creator payouts on 30-day-retained subscribers.** — source: BM#2.1; EC#7 (item 11).
57. **Unit economics: blended chat turn ≈$0.0095, Opus 5 essay mark ≈$0.13, median student ≈$1.6–2.6/month, exam-season heavy user $8–13 → quotas on Opus-class marks and voice minutes; alert when a student's day >3× median.** — source: AR#6 Honest cost model; AR#4.9.

### Safety and compliance

58. **Teen-safe by design in every market (age assurance, Study Hours, Quiet Hours, break reminders, no companion behaviour, no ads ever, parent notifications without transcripts — parity with ChatGPT for Teens); Article 50 disclosure by default; EU AI Act Annex III technical file ready before 2 Dec 2027; UK AADC and DfE product-safety expectations mapped; no training on pupil data without consent; UK/EU residency; Fable 5.1 is not ZDR-eligible (30-day retention).** — evidence: OpenAI's teen product (18 Aug 2026) sets the regulator-visible bar; Digital Omnibus Reg. (EU) 2026/1744 deferred Annex III (covers evaluating learning outcomes) to 2 Dec 2027; Art. 50 applied since 2 Aug 2026. — source: FB#1.1 Teens & parental controls; FB#7 (item 10); BM#5.1; BM#5.5; AR#4.7.
59. **Never produce submittable coursework (NEA/IA/EE); switch to draft-feedback mode and log an exportable "learning receipt" (attempts, hints, drafts, marks).** — evidence: 94% of UK undergrads use GenAI on assessed work; 64% of US high-schoolers fear false accusation; ESL writers flagged 2–3× more. — source: SV#7; SV#Implications (item 23); BM#Implications (item 12); LS#3.9 (item 1).
60. **Plan for distress messages (warm, brief, honest, back to the plan, crisis signposting) and a sleep-aware planner that refuses late cramming in exam week.** — evidence: 15% of UK undergrads use AI for companionship; month-before sleep explains ≈25% of grade variance. — source: SV#8; LS#3.5 (Rule D4).

### Metrics

61. **North-star = learning on unaided tasks (7/28-day retention, transfer, predicted-vs-actual grade, mastery velocity, Brier calibration) plus marking QWK per paper and answer-leak rate <5%; DAU/minutes/streaks are guard-rails. Every feature names the metric it moves; first pre-registered efficacy study within two exam sessions; calibration published per board.** — evidence: Khanmigo two-year RCT: +1.3 percentile/term (≈0.06–0.08 SD/yr), no better than Khan without AI; the field has only OpenAI's +15% microeconomics RCT and no exam-board data. — source: LS#3.8; BM#6.5; FB#Implications (item 25); EC#8 (item 24).

## B. Key numbers table

Confidence: **H** = primary page/API doc fetched; **M** = search snippet or secondary summary of a named primary; **L** = prior knowledge, single unverified source, or our own product decision.

| Metric | Value | Source file | Confidence |
|---|---|---|---|
| Retrieval practice (Adesope 2017) | g = 0.61 [0.58, 0.65] | learning-science | M |
| Interleaving (Brunmair & Richter 2019; Rohrer 2020) | g = 0.42; RCT d = 0.83 (61% vs 38%) | learning-science | M |
| Self-explanation (Bisra 2018) | g = 0.55 | learning-science | M |
| Productive failure (Sinha & Kapur 2021) | d = 0.36 [0.20, 0.51] | learning-science | M |
| Expertise reversal (2025 meta) | novices +0.505 high assistance; experts −0.428 | learning-science | M |
| Feedback (Wisniewski 2020) | d = 0.48 | learning-science | M |
| Optimal spacing gap (Cepeda 2008) | ≈20–40% of 1-week RI; ≈5–10% of 1-year RI | learning-science | M |
| FSRS benchmark (Anki, 10k users) | FSRS-7 log loss 0.337; FSRS-6 0.346; HLR 0.469 | learning-science, architecture | H |
| Bastani 2025 (n≈1,000) | GPT Base +48% practice, exam worse; GPT Tutor +127%, exam ≈ control | learning-science | M |
| Kestin 2025 Harvard RCT (~190) | ≈2× learning gain vs active-learning class | learning-science, edu-competitors | M |
| Tutor CoPilot RCT | +4 pp mastery; +9 pp weaker tutors; $20/tutor/yr | learning-science, business-moat | M |
| Khanmigo 2-year RCT (18 schools) | +1.3 percentile/term ≈ 0.06–0.08 SD/yr; ≈ Khan without AI | learning-science | M |
| World Bank Nigeria RCT | +0.31 SD overall | learning-science, edu-competitors | M |
| OpenAI Study Mode RCT (300+) | +15% microeconomics; ns neuroscience | frontier-baseline | H |
| LearnLM expert preference | +31% vs GPT-4o; +11% vs Claude 3.5 Sonnet | learning-science, business-moat | H |
| SafeTutors multi-turn failure | 17.7% → 77.8% | learning-science | M |
| HeuristicEdu answer leak | >96% in opening turn, all models to 72B | business-moat | M |
| Khanmigo adoption | 1.4M users mid-2025; ~15% regular classroom use; 795 districts | edu-competitors, business-moat | M |
| AI marking vs teachers (marking.ai) | ~±1 mark avg; GPT-o3 1.07 off, r=0.96; LLMs more lenient | edu-competitors | M |
| Proposed marking gates | points exact ≥97% / ±1 ≥99.5%; 8–12-mark QWK ≥0.80; 20–30-mark QWK ≥0.75, level agreement ≥80% | exam-systems | L (decision) |
| Human–human essay QWK | ~0.7–0.85 | exam-systems | L |
| 9609 AO weights | 25/25/25/25 A Level; P1 AO1 35/AO2 30; P4 AO3 40/AO4 35 | exam-systems | M |
| 9708 / 0450 / 0455 / 9702 AO weights | 35/40/25; 40/20/25/15; 40/40/20; 40/40/20 (P3, P5 = 100% AO3) | exam-systems | M |
| Cambridge PUM | min A* = PUM 90; A* only at option level | exam-systems | M |
| Chegg | subs 3.2M (−31%); Q2 rev $105.1M; layoffs 22% + 45%; cap <$200M from $12–14B | edu-competitors, business-moat | M |
| Duolingo | Q1-26 rev $234M (+40%); 38M DAU; Max >1.8M; video call $0.30 → <$0.01 | edu-competitors | M |
| Knowunity | €27M Series B; 20M users; 380k creators; 3M materials; Pro ~$49.99/yr | edu-competitors, business-moat | M |
| Save My Exams | £12/mo or £4/mo annual; Trustpilot ~4★/1,900 | edu-competitors | M |
| Up Learn | £119.99–149.99/subject to exams or £49.99/mo; guarantee at 90% completion | edu-competitors, business-moat | M |
| Khanmigo / Quizlet prices | $4/mo, $44/yr, ~$10/student/yr districts; Quizlet $35.99/yr, Trustpilot 1.4/5 | edu-competitors, business-moat | M |
| Frontier consumer prices | ChatGPT Go ≈$8 / Plus $20 / Pro $100–200; Gemini Plus $4.99 / Pro $19.99; Claude Pro $20 ($17 annual), Max $100/200 | frontier-baseline, business-moat | M/H |
| Student offers | Google 1 year free AI Pro (US) / AI Plus (140+ countries) to 31 Dec 2026; Mistral $5.99; Perplexity Edu $10 | frontier-baseline | H/M |
| ChatGPT Free limits | 3 uploads/day; 27K context; 5 project files | frontier-baseline | H |
| Gemini free / NotebookLM free | 32K context; 50 sources, 50 chats/day, 10 quizzes/day, 3 audio overviews/day | frontier-baseline | H |
| Claude limits megathread | 799 upvotes / 6,270 comments | frontier-baseline | H |
| AI-in-education market 2025/26 | USD 7.5–11.4B; 26–45% CAGR | business-moat | M |
| Private tutoring market 2025 | USD 70–151B; APAC 35.5%; online 55.3% | business-moat | M |
| EU AI Act Digital Omnibus | Reg. (EU) 2026/1744 in force 27 Jul 2026; Annex III to 2 Dec 2027; Art. 50 since 2 Aug 2026 | business-moat | M |
| Claude API prices | Fable 5.1 $10/$50; Opus 5 $5/$25; Sonnet 5 $2/$10; Haiku 4.5 $1/$5; cache read 10% (2.5% Fable) | architecture | H |
| Gemini API prices | 3.1 Pro $2/$12; 3.8 Flash $0.75/$3.75 intro → $1.50/$7.50 on 1 Jan 2027; 3.5 Flash-Lite $0.30/$2.50 | architecture | H |
| OpenAI / DeepSeek prices | GPT-5.6 Sol $5/$0.50 cached/$30; DeepSeek V4 Flash $0.14/$0.28 or peak/off-peak (conflicting) | architecture | L |
| Anthropic spend caps / EU geo | Start $500, Build $1,000, Scale $200k/month; no EU inference geo first-party (Vertex regional +10%) | architecture | H |
| OCR benchmark (olmOCR-bench) | Chandra 83.1; olmOCR 82.4; Marker 76.1; Mistral OCR 72.0; old-scan maths 29–84 | architecture | H |
| Per-turn / per-mark cost | cached Sonnet 5 turn ≈ $0.0114; blended ≈ $0.0095; Opus 5 essay ≈ $0.13 | architecture | M (estimate) |
| Cost per student/month | median $1.6–2.6; exam-season heavy $8–13; light school seat ≈$0.9 | architecture | M (estimate) |
| Performance budgets | TTFT p50 <800 ms / p95 <1.5 s; retrieval <120 ms; LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1; essay first AO card <8 s, full <45 s | architecture, ux-design | H (CWV) / L (ours) |
| Typography defaults | chat 17 px/1.55/68 ch; reader 18 px/1.6/66 ch; UI 14 px; min 12 px | ux-design | L (from Butterick/Apple) |
| Motion tokens | press 120; base 220; drawer 320; stagger 40 ms; all UI <300 ms | ux-design | H (Kowalski/M3/Carbon) |
| WCAG 2.2 AA numbers | 4.5:1; 24×24 px targets; 2 px/3:1 focus; 1.5× line-height survival; 320 px reflow | ux-design | H |
| Student AI usage | UK undergrads 95% (94% assessed work); US teens 64% chatbots / 54% schoolwork; US 12–29 62% homework | student-voice | H |
| Fear of false accusation | 64% US high-schoolers; 53% deterred (HEPI 2025); ESL flagged 2–3× | student-voice | H/M |
| UK teachers catching unauthorised AI | 15% (2023) → 58% (2026); maths 5% → 61% | student-voice | H |
| Corpus sample | ZNotes PDFs for 9609/9700/9701/9702/9708/9626/9608/9990 + one mark-scheme extract; 9608 superseded by 9618 | corpus-sample | H |

## C. Contradictions and tensions between briefs

1. **Consumer price point.** FB: ~$8–10 student plan; BM: $6–9/mo or $49–79/yr; EC: under SME's £4/mo-annual for one subject and under Medly's £24.99 for all; AR: "$15–20/month viable only with per-tier quotas". *Resolution:* student plan $6–10/month plus an "until exams" annual SKU; parent tier $15–25 carries heavy-tail economics; AR's figure is a ceiling for uncapped heavy users, satisfied by quotas rather than list price.
2. **API price bases and cost per user.** BM#6.6 uses an older price file (GPT-5 mini, Sonnet 4.5 $3/$15) → $1.5–3 per heavy user; AR#6 uses verified Sept 2026 prices and a richer usage shape → $8–13 per heavy user; DeepSeek prices conflict even within AR. *Resolution:* budget on AR; treat BM's 75–85% margin as optimistic-median; never budget on DeepSeek until read from its docs.
3. **Routing philosophy.** EC/BM: "best-of-four, cheapest for drills, DeepSeek for cost, visible provenance"; AR (measured): one primary family per task class + effort tuning, DeepSeek non-PII only; FB: hide model names; SV: students want to see which model marked. *Resolution:* AR's task-class routing; effort dial is the user control; provenance shown on marking cards only; DeepSeek is a flagged second solver on anonymised text.
4. **Marking accuracy gates.** FB "±1 mark on 80% of 200 answers"; EC "MAE ≤1 short answers, level agreement ≥80% essays"; ES tiered (exact ≥97%; QWK ≥0.80 for 8–12 marks; QWK ≥0.75 for 20–30); AR "QWK ≥0.80 on 9609 P2 before predicted grade"; BM Y1 "QWK ≥0.75 pilot"; SV "±1 level on ≥85%, run-to-run ≤1". *Resolution:* ES's tiers are the per-paper release gate; AR's 0.80 unlocks predicted grades; SV's run-to-run ≤1 is an added consistency gate; BM's 0.75 is a pilot target.
5. **How hard to withhold answers.** FB: "Answer" is a logged, rate-limited escape hatch visible to parent/teacher; LS: effort gate + labelled answer-on-demand; SV: "do not force Socratic dialogue", refusals cause churn; EC: give the answer once earned. *Resolution:* effort gate + intent chips; answers never rate-limited, only labelled "seen-solution" with a scheduled retest; parent/teacher see aggregate ladder depth, not per-request policing; the debt guard escalates gently and is A/B-tested on retention.
6. **Streaks.** UX: weekly goals with rest days; LS: learning-event streaks only; EC: light gamification behind a toggle; FB: streak-free. *Resolution:* no daily streak counter anywhere; one weekly learning-event goal with rest days; anything else opt-in and never loss-framed.
7. **Free-tier generosity.** FB: unlimited fast-model chat, ≥20 uploads/day, ≥128K context; BM: capped tokens, 1 marked essay/day, cheapest tier; EC: N marked questions + unlimited explanations; SV: no cap that "breaks after two messages". *Resolution:* unlimited cheap-tier explanations with soft slow-down (never a hard mid-session stop), generous uploads, marking capped per day, grace mode in exam weeks.
8. **FSRS fitting threshold and benchmark size.** LS: fit after ~400 reviews, benchmark 727M reviews; AR: ~1,000 reviews, 350M. *Resolution:* shrinkage fit from ~400, full parameters from ~1,000; cite benchmark by FSRS version and snapshot date.
9. **EU AI Act status.** BM: Reg. (EU) 2026/1744 published 24 Jul 2026, Annex III deferred to 2 Dec 2027; AR: treats the delay as an unverified Nov 2025 proposal. *Resolution:* BM is more specific and cited; confirm with counsel; build the technical file regardless.
10. **Licensing vs the "pre-ingested library" pitch.** FB/EC market pre-ingested textbooks and papers cited as "9609/22 May 2024 Q3(b) MS p.7"; ES warns Cambridge and IB do not permit redistribution; CS notes ZNotes is CC BY-NC-SA. *Resolution:* the citation UX survives via short attributed extracts and deep links; full-text display and re-hosting wait for licences; the practice bank defaults to original items.
11. **Human-in-the-loop for marks.** BM/SV: first-pass marking that a teacher confirms, "never auto-final"; FB/EC: consumer-facing AI marks as a direct feature. *Resolution:* consumer practice marks carry confidence bands and calibration status; anything feeding a school-recorded grade requires teacher confirmation (also the Annex III posture).
12. **Age positioning.** FB: a 13–18 product compliant in UK/EU/CIS/India is open territory; AR: COPPA/AADC/GDPR consent complexity and Fable 5.1's 30-day retention. *Resolution:* 13+ with age assurance and parental consent; under-13 deferred.
13. **Voice priority.** FB: voice "S" and voice + camera a shipped expectation; AR: priced at ~$0.016/min; SV: barely mentioned. *Resolution:* photo-of-handwriting is v1; live voice/camera is v2.
14. **Minor data disagreements not to propagate:** Khanmigo 1.4M (EC) vs 2M global (BM) — different dates/scopes; Quizlet $7.99/mo vs "$2.99/mo" (EC); Up Learn per-subject vs monthly (different SKUs); Brainly $23.99 period unclear; spaced-repetition SMD 0.78 (EC, vendor blog) vs Adesope g=0.61 (LS, peer-reviewed) — cite the latter.

## D. Unverified or weak claims to treat with care

Flagged by the briefs themselves as "(prior knowledge, unverified)", snippet-only, or single-source:

- **All of exam-systems Part E (legal/licensing)** — board terms, PMT/SME permission statements, publisher AI-licence terms, UK/US copyright status — is prior knowledge; **ES#5** must be re-verified with counsel before any content decision. Likewise ES#3 (incumbent product table) was not fetched.
- **9609 paper durations/marks and per-AO level grids** (5/8/12/20/30-mark questions) were not read from the syllabus; the "P1 1h15/40, P2 1h30/60, P3 1h45/60, P4 1h15/40" structure and "two compulsory 30-mark questions" on P3 are unverified — ES#1.1, ES#Open questions (items 1, 10).
- **Cambridge command-word definitions** beyond analyse/evaluate/justify are from memory; extract verbatim per syllabus — ES#1.1.
- **June 2025 threshold numbers** for 9609/9708/9709/9702/0450/0455/0580 exist at cited URLs but were not read — ES#Open questions (item 4).
- **Human–human QWK ~0.7–0.85 and Ofqual "definitive grade" probabilities (~0.96 maths, ~0.6 English)** — prior knowledge; ES#4.1, ES#2.6.
- **Bastani exam-decline magnitude (−17%)**, Kestin exact n/d, Wisniewski sub-effects by feedback type, Yang 2021 g≈0.50, Anthropic report percentages, MIT "working memory 15% lower" — LS#5. Open questions.
- **FSRS "20–30% fewer reviews"** is simulation, not RCT — LS#1.3.
- **UK "supervised AI tutor vs human tutors" RCT (165 students)** — secondary summary only — LS#2.1.
- **Spaced-repetition meta-analysis SMD 0.78** — cited via a vendor blog — EC#9.
- **Khanmigo "~15% regular use"** — secondary source; the "23% retention improvement" figure is from a 12-student test and must not be cited — EC#9; BM#4.1.
- **Chegg "80% of remaining workforce" (Feb 2026)** — single tracker — EC#9.
- **Save My Exams / Seneca 2026 prices, Quizlet price, Brainly period, Knowunity monthly price** — blocked pages — EC#9; BM#Open questions.
- **ChatGPT Go/Plus/Pro USD prices, "Pro Lite", GPT-6 Astra** — third-party trackers; ChatGPT Study Mode "progress tracking" UI unconfirmed — FB#Open questions.
- **Claude Learning style details** (help article 404s) and precise Claude Pro/Max message limits ("45 msgs/5h") — FB#Open questions.
- **DeepSeek consumer-app features and V4 API pricing after 16 Aug 2026** — third-party, conflicting — FB#1.4; AR#1.4.
- **OpenAI GPT-5.6 pricing, Realtime audio pricing, embeddings, file-search pricing** — snippets only — AR#1.3.
- **Gemini context-cache storage price, 3.x Live audio pricing, Batch discount (50% vs "up to 90%")** — AR#1.2.
- **Mathpix, Reducto, Azure DI, Turbopuffer/Qdrant/Pinecone, reranker, E2B/Modal pricing; Desmos/GeoGebra commercial terms** — AR#Open questions.
- **UK ICO AADC standards text, COPPA amended-rule dates, DfE product-safety expectations wording, JCQ AI guidance, US executive order/state-guidance counts** — prior knowledge — AR#4.7; BM#5.2–5.3.
- **Byju's, 2U, Coursera/Udemy, Pearson, Sparx, Kumon details; Google's $1B education commitment; Estonia/CSU/Kazakhstan deals; ~10,000 Cambridge schools in 160 countries** — BM#Open questions.
- **Market-size figures** (AI-in-education $7.5–11.4B; tutoring $70–151B) — syndicated research with opaque methods and 2× spreads — BM#1.1.
- **Reddit quotes** in SV and FB come from search snippets of named threads; vote counts and dates partly unverified; **no survey of Cambridge International students' AI use exists** — SV#Open questions.
- **"Claude holds the Socratic line hardest"** — commercial comparison blog — SV#Open questions; LS#2.6.
- **ZNotes licence (believed CC BY-NC-SA 4.0)** — CS#3.

## E. Open questions for the founder

Decisions only the founder can make; each blocks a section of the master prompt.

1. **What exactly is in the content library, and what rights come with it?** The sample was ZNotes revision notes plus one hand-made mark-scheme extract. Are there licensed textbooks (Hodder/CUP), official Cambridge papers/mark schemes/examiner reports, and under what terms? (Gates sections 05, 06.)
2. **Licensing posture with Cambridge:** pursue a formal partnership/licence before launch (slower, defensible) or ship on the facts/link/original-items strategy and negotiate later (faster, takedown risk)? (Gates 06, 14.)
3. **Second market after CAIE:** UK boards (largest English-language spend, head-on with SME/Medly), ЕГЭ (Russian-language, Telegram-native, sanctions/payments risk), or UNT (Kazakhstan, founder's likely network)? (Gates 02, 14.)
4. **Age floor and school focus at MVP:** 13+ consumer with parental controls from day one, or 16+ consumer first and schools in Year 2? (Gates 02, 12.)
5. **DeepSeek usage policy:** acceptable only for anonymised second-solve/synthetic generation (recommended), or also for tutoring in CIS markets where cost/residency argue for it? (Gates 08, 11.)
6. **Budget for calibration data:** examiner panels double-marking ~300 scripts per paper and ongoing seeded QA — is this funded for Year 1 (6–10 subjects)? Without it, no published QWK and no predicted grades. (Gates 05, 13.)
7. **Publish calibration numbers publicly** (marketing asset, also exposes weak papers) — yes/no, and at what threshold?
8. **Free-tier generosity vs cost:** accept a token-capped but never-hard-stopped free tier that may cost $0.5–1/MAU in exam season? (Gates 03, 14.)
9. **Price list:** confirm $6–10 student / $15–25 parent / ≤$12 school seat and regional tiers; appetite for an Up Learn-style outcome guarantee in Year 2–3? (Gates 14.)
10. **Name and brand:** BM#6.4 lists ten unchecked candidates; the brief recommends avoiding any board's mark in the name.
11. **Voice in v1 or v2?** Evidence favours v2; founder may have a strategic reason to ship earlier.
12. **Fine-tune/RL a tutoring layer** (capex, model lock-in) or rely on prompts + orchestrator vetting for the first year?
13. **Launch languages:** English only, or RU/KZ UI at launch? (Affects fonts, math locale, packs.)
14. **Data residency commitments:** promise EU/UK residency from day one (Vertex routing, +10% cost) or US/global first?
15. **"Every pixel better" scope:** fully custom design system vs shadcn-based tokens; native mobile vs Expo; which platforms at launch (web + iOS + Android)?
16. **Teacher/parent surfaces at MVP:** minimal class code + digest, or the full console? (Gates 10.)
17. **Efficacy programme:** commit to a pre-registered study within two exam sessions and to never using unverified multipliers in marketing?

## F. Per-file abstracts

**frontier-baseline.md (~10.2k words; 26 searches, ~35 primary pages).** Inventories ChatGPT, Gemini/NotebookLM, Claude, DeepSeek and secondary products as of 6 Sep 2026: plans, limits, memory, projects, study modes, teen controls, complaints; a 47-row parity checklist (§6) and 14 exploitable weaknesses (§7). Top findings: every lab "study mode" is free and one-click-off; ChatGPT for Teens defines the parental-control bar; limit opacity and sycophancy dominate complaints; effort control beats model pickers; a Course object beats mode sprawl. Weakest on: USD prices (third-party), Claude Learning style details, app-store review text.

**edu-competitors.md (~7.3k; 44 searches, 3 full fetches).** Big-lab education plays, ~35 edtech players (feature matrix §2.1), failures (Chegg, Byju's, Quizlet, Duolingo, Alpha School), what students pay for, 12 ranked white spaces, 10 differentiators vs ChatGPT, 10 mistakes. Top findings: answer businesses are dead; students pay for board-specific bundles and gamified retrieval; CAIE is an unconsolidated beachhead; engagement, not capability, binds (Khanmigo ~15%); AI marking suffices for formative use only. Weakest on: incumbent prices, Khanmigo's model, primary review text.

**learning-science.md (~7.9k; 34 searches, primary texts via HF/GitHub).** Effect sizes for retrieval, spacing/FSRS, interleaving, self-explanation, productive failure, expertise reversal, feedback, calibration, motivation, sleep; 2023–26 AI-tutoring RCTs; LearnLM/SafeTutors/MathTutorBench; 27 testable rules (help ladder, turn anatomy, misconceptions, fading, scheduling, cognitive-debt guard, never-do list). Top findings: unguarded answer-giving harms exams; multi-turn is where tutors fail; usage ≠ learning; realistic effects 0.3–0.7 SD; sycophancy is a safety risk. Weakest on: exact figures for several blocked papers; feedback timing for AI.

**exam-systems.md (~7.8k; 27 searches, zero primary fetches).** Structure of CAIE syllabuses, Edexcel, AQA, OCR, WJEC, IB, AP, SAT/ACT and 15 national systems; anatomy of marking; AI-examiner requirements (metrics, gates, rationale schema, predicted grades, tagging, generation, handwriting); licensing hypotheses; 25 implications. Top findings: CAIE publishes a complete supervision signal; AO weights vary by paper; two marking paradigms with board-specific procedures; seed-and-tolerance QA is the model; do not assume redistribution rights. Weakest on: Part C (products) and Part E (legal) — prior knowledge; 9609 paper details.

**ux-design.md (~8.2k; 28 searches, ~30 primary pages).** Layout to i18n in 23 sections plus five deliverables: 16 principles, CSS token starter, component inventory, three-pane layout spec, pixel QA checklist. Top findings: calm beats clever; the visible mode chip and three-pane workspace are the open lane; citation-to-exact-page is the trust surface; consensus typography/motion/WCAG numbers; two-button flashcards and four-state mastery. Weakest on: exact incumbent layouts, Cyrillic glyph coverage, chat-specific skeleton effect.

**architecture.md (~10.7k; Anthropic/Vertex docs fetched, others snippets).** Verified model prices, cache economics, task-class routing table, two-pass ingestion, chunk metadata, hybrid retrieval, knowledge graph, hallucination controls, evals, tools, reference stack (Next.js 16/AI SDK 7/Postgres+pgvector/Redis/Inngest/Expo/Langfuse), data model, security, compliance, performance budgets, honest cost model, 15 risks. Top findings: caching + effort tuning beats cascades; no EU geo on Anthropic first-party; parsers weak on old-scan maths; median student ≈$1.6–2.6/month; Gemini Flash prices double 1 Jan 2027. Weakest on: OpenAI/DeepSeek pricing, reranker/vector-DB costs, EU AI Act status.

**business-moat.md (~7.4k; 16 searches).** Market sizes, willingness to pay, pricing benchmarks, GTM, international sequencing, moat scorecard, failures, regulation, positioning, brand voice, names, KPIs, unit economics, three-year arc. Top findings: the budget to win is tutoring (USD 70–151B); real moats are calibration data, tagged item banks, learner graph, school trust, community; Annex III deferred to Dec 2027; never "replaces teachers"; Y1 = win one exam and prove the marker. Weakest on: old API price base in §6.6, prior-knowledge company histories.

**student-voice.md (~11.5k; 42 searches, 14 primary pages).** Usage surveys, 25 ranked pains, 25 wishes, revision methods, teacher/parent data and quotes, cheating dynamics, exam-year emotional calendar, accessibility, nine personas, 28 implications. Top findings: #1 pain is inconsistent/lenient marking; sycophancy and hallucinated maths/quotes break trust; students already paste mark schemes and it still fails; refusals and exam-season paywalls drive churn; teachers endorse process visibility. Weakest on: Reddit bodies (snippets), Cambridge-International student data, RU/KZ voice.

**corpus-sample.md (~1.9k; founder's pasted PDFs).** Ten ZNotes revision-note PDFs plus one hand-compiled mark-scheme extract; ten ingestion defects; requirements. Top findings: figures lost, maths flattened, bullets corrupted, blocks duplicated; notes contain factual errors and rank below canon; the mark-scheme extract is the highest-value asset; stale editions need version tags; ZNotes licence likely non-commercial. Weakest on: it is a sample, not the library.

## G. Reading guide for the master prompt

For each PLAN.md section: which files/sections to open, then the must-include points.

**00 How to use this document** — Open: this index (A, C, E); LS#3.9; UX#28. Include: non-negotiables A#9 (effort gate), A#13 (no sycophancy), A#18/A#22 (no marking without a scheme or below gate), A#40 (no streaks), A#59 (no coursework); resolve ambiguity per Section C; definition of done = the CI gates in A#17, A#22, A#36, A#45, A#61.

**01 Mission, vision, positioning** — Open: BM#6.1–6.3; EC#6; FB#7; BM#3.1. Include: "they know everything; we know your exam"; why a company not a feature; honest-tutor voice; the labs' structural weaknesses (no board grounding, one-click-off modes, sycophancy, opaque limits, age fragmentation); never "replaces teachers"; realistic efficacy claims (A#7).

**02 Users, JTBD, exam-year moments** — Open: SV#10 personas; SV#8; SV#1; SV#4; BM#1.2. Include: P1 Aisha (CAIE) as primary, P8 teacher, P9 parent; September/mocks/Easter/exam-season/results cliffs; the revision ecosystem (past papers, PMT, Anki, blurting); dyslexia/ADHD/ESL/extra-time needs.

**03 Table-stakes parity** — Open: FB#6 (47-row checklist); FB#2; FB#8. Include: all "M" rows; edit/branch/interrupt; editable memory + incognito + import; Course/projects; search; files/vision; canvas; citations; usage meter; exports incl. Anki; explicit skips (image/video generation, agents, sites, ads).

**04 The learning core** — Open: LS#3 (all rules); LS#1.1; LS#3.11; SV#3; UX#11–12. Include: effort gate + five-rung ladder + intent chips; ≤120-word turn anatomy; misconception library; fading state machine; FSRS with exam-anchored retention and the 60/25/15 mix; calibration loop; cognitive-debt guard; competence-first motivation without streaks; sleep-aware planner.

**05 The exam engine** — Open: ES#1.1, ES#2, ES#4, ES#Implications; EC#8; SV#2.2; AR#2.7; CS#4.3. Include: per-AO marking with quoted spans and board procedure; points vs levels engines; ECF; command-word check; OCR-style annotations; tiered gates and seeded QA; generosity correction + dual-family ensemble; predicted grade via thresholds/PUM as a range; handwriting confirmation; timed mocks with extra time; generator constraints; examiner-report debrief.

**06 The library** — Open: CS (all); AR#2.1–2.5; ES#5.4; ES#1.1 artefact table; BM#3.1. Include: curriculum-pack schema; two-pass PDF ingestion + human QA; chunk metadata + trust rank; question↔MS↔ER↔syllabus↔textbook links; marking-point record type; notes-vs-canon behaviour; licensing layers; "show me in the book" via page-exact citations.

**07 Learner memory & knowledge graph** — Open: AR#2.5; AR#4.3; FB#1.1 and FB#1.3 (memory); LS#3.8; SV#3 (#7). Include: state outside the chat; mastery per syllabus point with decay; wrong-question bank; seen-solution items; editable Topics + per-Course memory + sensitive-topic exclusion + incognito + import/export; cross-board equivalence edges; aggregate-only parent/teacher views.

**08 Model orchestration** — Open: AR#1 (all), AR#6, AR#7; BM#0 (item 15); FB#4. Include: routing table; effort dial; cache-first layout; structured outputs per AO; SymPy verification; dual-family judges; DeepSeek non-PII flag; failover triggers; policy-version pinning; quotas; Gemini 2027 price change and Haiku retirement risk.

**09 Design system & UX spec** — Open: UX#24, UX#25, UX#17, UX#19–20, UX#23, UX#28; FB#8. Include: token starter verbatim; typography table; motion durations/easings; OKLCH 12-step scales and grey dark ladder; WCAG numbers as tokens; font switcher incl. Cyrillic; copy style guide; ban list.

**10 Screen-by-screen spec** — Open: UX#1–3, UX#8–16, UX#21, UX#26–27; SV#Implications (onboarding); FB#8. Include: three-pane layout with breakpoints; composer with mode chip, math keypad, camera-confirm; citation chip → source pane; marking view with streaming per-AO cards; two-button flashcards; mastery pips + readiness ring; planner with exam spine; command palette; empty state; teacher console; parent digest; mobile bottom sheets.

**11 Technical architecture** — Open: AR#2–5, AR#7, AR#Implications. Include: reference architecture; Postgres+pgvector schema; typed parts and resumable streams; ingestion DAG; tools (Pyodide/sandbox, KaTeX, MathLive, FSRS libs, Gemini Live); per-tenant policy object and Vertex regional routing; OWASP controls; performance budgets; Langfuse observability; cost controls.

**12 Safety, integrity & wellbeing** — Open: FB#1.1; BM#5; SV#7–8; LS#3.9; AR#4.5–4.7. Include: ChatGPT-for-Teens parity list; coursework guardrail + learning receipt; Article 50 and Annex III readiness; AADC/DfE/COPPA/FERPA/GDPR posture; distress handling; no ads; hallucination controls (mandatory citations, verified numerics, no invented quotes).

**13 Quality bar & evaluation** — Open: ES#4.1; AR#2.7; LS#2.5, LS#3.8, LS#3.12; LS#3.6 (E4); UX#28. Include: marking gates by paper type + seeded production QA; Recall@8 ≥0.92; Ragas + mark-scheme adherence; 30-turn adversarial pedagogy evals; praise audit (<5%); answer-leak rate; north-star learning metrics; pixel checklist; CWV/TTFT SLOs as release gates.

**14 Roadmap** — Open: BM#6.7; BM#2.3; ES#0 (item 24); AR#7; EC#5. Include: MVP = 9609/0450 + 9708/0455 levels marker, 9709/0580 points marker, predicted grades, question generator, handwriting pipeline; Y1 targets (100k MAU, 10k paying, QWK ≥0.75 pilot → 0.80 gate); Y2 curriculum compiler, schools, community; Y3 guarantees/partnerships; top risks (marking trust, parser errors, price shocks, licensing, Annex III).

**15 Appendices** — Open: LS#3.1–3.2; ES#4.3; ES#4.5; AR#2.3; AR#5; CS#5; ES#1.1 command words; Section E here. Include: per-mode system-prompt skeletons; marking JSON schema; question-tagging schema; mark-scheme record type; command-word → AO table; glossary (AO, PUM, ECF, levels, seeds); founder open questions.

