# Learning Science and AI-Tutoring Evidence → Concrete Product Rules for an Exam-Success AI Tutor

*Research lens: learning science + AI-tutoring evidence (2023–2026). Written September 2026. Every number carries a source; items I could not verify online are marked "(prior knowledge, unverified)". Method note: 34 web searches were run; the network egress proxy blocked most journal/preprint hosts (PNAS, arXiv, NBER, Springer, Wikipedia, etc.), so primary text was obtained where possible through Hugging Face's arXiv mirror (MIT "Your Brain on ChatGPT", Tutor CoPilot, LearnLM, SafeTutors, MathTutorBench, "Sycophantic Praise") and GitHub (FSRS benchmark/algorithm). Other facts come from search-result abstracts and secondary summaries and are cited to the underlying paper URL.*

---

## 0. Executive summary

1. **The single biggest design risk is not hallucination; it is a tutor that quietly does the work for the student.** Bastani et al. (PNAS 2025, ~1,000 Turkish high-schoolers) found an unguarded GPT-4 interface ("GPT Base") raised practice performance +48% but *lowered* subsequent closed-book exam performance, while a guard-railed "GPT Tutor" (hints, no answers, must attempt first) raised practice +127% and removed the exam harm. [S2]
2. **Guardrails must be enforced at the system level and survive student pressure.** Google's LearnLM team reports that the single most-requested capability from education developers is a model that reliably follows "do not give away the answer" / "stay on topic" *even when the student tries to circumvent it*; they found RLHF far more effective than SFT for this. [S6b]
3. **Multi-turn is where tutors break.** SafeTutors (2026) found pedagogical failures (answer over-disclosure, misconception reinforcement, abdication of scaffolding) rising from 17.7% in single-turn to 77.8% over multi-turn dialogue, and "scale doesn't reliably help". MathTutorBench (2025) independently found questioning strategies fail in longer dialogs and that solving ability does not translate into teaching ability. [S23][S24]
4. **Well-designed AI tutoring can beat the best classroom instruction.** Kestin et al. (Scientific Reports, June 2025; Harvard PS2, Fall 2023, ~190 students, crossover RCT) found students using a purpose-built, scaffolded AI tutor learned roughly twice as much as in a research-based active-learning class, in less time. The tutor used expert-authored scaffolds, step-by-step reasoning, and guardrails. [S1]
5. **But a generic chatbot bolted onto practice does little.** The two-year Khanmigo cluster RCT in 18 Tennessee middle schools (NBER w35620) found +1.3 national percentile ranks per term (≈0.06–0.08 SD/yr; 0.14 SD for a full year of active use), no better than Khan Academy without AI; *engagement, not model capability, was the binding constraint*. [S4]
6. **Human-in-the-loop AI works and shifts pedagogy in the right direction.** Tutor CoPilot RCT (~900 tutors, ~1,800 K-12 students): +4 pp topic mastery (p<0.01), +9 pp for students of lower-rated tutors, $20/tutor/yr; tutors with CoPilot asked more guiding questions and gave away the answer less. [S3]
7. **Cognitive debt is real but the headline studies are weaker than the press coverage.** MIT "Your Brain on ChatGPT" (n=54, only 18 in session 4; preprint) found weakest EEG connectivity, lowest essay ownership and inability to quote one's own essay in the LLM group; Gerlich (2025, n=666) is cross-sectional self-report; Microsoft/CMU CHI 2025 (n=319) found higher confidence *in the AI* predicts less critical thinking while higher *self*-confidence predicts more. Treat as directional, design against it anyway. [S5][S7][S8]
8. **Bloom's "2 sigma" is a myth as a benchmark.** It rested on two graduate-student studies; a 2020 meta-analysis of 96 tutoring studies averaged ≈0.37 SD and none reached 2 SD; Kraft: the claim "anchored education researchers' expectations for unrealistically large effect sizes". Realistic targets for us: 0.3–0.7 SD. [S14]
9. **Classic ITS effect sizes set the bar we must clear:** Kulik & Fletcher 2016 median 0.66 SD across 50 evaluations vs classroom; VanLehn 2011 step-based tutoring 0.76 SD (≈ human tutoring 0.79). [S13]
10. **Retrieval practice is the highest-yield technique:** Adesope et al. 2017 g=0.61 [0.58, 0.65] vs restudy and all other comparators; secondary students benefit most; classroom ≈ lab. [S15]
11. **Spacing has a known optimum:** Cepeda et al. 2008 (n>1,350): optimal gap ≈20–40% of a one-week retention interval, falling to ≈5–10% for a one-year interval. For exam prep this means the review schedule must be computed backwards from the exam date. [S16]
12. **FSRS beats older schedulers on 727M real Anki reviews** (10k users): FSRS-7 log loss 0.337 vs HLR 0.469 / Ebisu 0.499; FSRS-6 is reported to beat Anki-SM-2 for 99.6% of users; the oft-quoted "20–30% fewer reviews for equal retention" is a simulation result, not an RCT. Use FSRS (open source) with per-user parameter fitting. [S17][S18]
13. **Interleaving:** Brunmair & Richter 2019 g=0.42 overall, g=0.34 for maths; Rohrer et al. 2020 RCT (787 students, 4 months) 61% vs 38% on a delayed test, d=0.83. Mixed-topic practice sets are a product requirement, not a nicety. [S19]
14. **Self-explanation prompts:** Bisra et al. 2018 g=0.55 across 69 effect sizes, works for conceptual and procedural knowledge across subjects. "Explain why that step is valid" is a cheap, evidence-based tutor move. [S20]
15. **Productive failure:** Sinha & Kapur 2021 (166 comparisons, 53 studies, 12k+ participants) d=0.36 [0.20, 0.51] on conceptual knowledge/transfer for problem-solving-first vs instruction-first, no cost to procedural knowledge; stronger for grade 6+ and with high-fidelity design (elicit multiple failed attempts before teaching). [S21]
16. **Expertise reversal is quantified:** a 2025 meta-analysis (176 effects, 60 studies, 5,924 participants) found low-prior-knowledge learners learn better with high assistance (d=0.505) while high-prior-knowledge learners learn better with low assistance (d=−0.428). Fading of worked examples/prompts must be per-student and performance-triggered. [S22]
17. **Feedback:** Wisniewski, Zierer & Hattie 2020 (435 studies, 994 effects, 61k participants) d=0.48 overall, but effect depends on *information content*; feedback works better on cognitive/motor outcomes than motivational ones. Praise-only feedback is near useless; task+process+self-regulation feedback is what moves learning. [S25]
18. **Illusions of competence are the default student state.** Dunlosky et al. 2013 rate highlighting and rereading "low utility" despite being the most-used strategies; practice testing and distributed practice are "high utility". Calibration training works: a meta-analysis of 56 studies (7,667 participants) found g≈0.57 improvement in monitoring accuracy, especially with prediction + postdiction judgments. [S26][S27]
19. **Motivation:** Howard et al. 2021 (344 samples, 223,209 students): intrinsic motivation predicts achievement and well-being; identified regulation predicts persistence; introjected (guilt/ego) motivation predicts persistence *and* ill-being. Competence is the strongest need-predictor of autonomous motivation. Design for competence signals first, autonomy second. [S28]
20. **Growth mindset interventions are weak on average:** Sisk et al. 2018 (273 studies, 365,915 participants) ≈1% of variance; Macnamara & Burgoyne 2023 d=0.05 and non-significant after bias correction; possible benefit for low-SES/at-risk students. Do not build the product around mindset messaging. [S29]
21. **Streaks backfire once broken** (abstinence-violation effect, "streak creep", loss-aversion-driven "performative learning"); Duolingo had to add streak freezes. Our habit loop should reward *learning events* (retrieval sessions completed, mastery gained), not consecutive days. [S30]
22. **Sleep is a learning input:** Okano et al. 2019 (Fitbit, MIT students) sleep duration/quality/consistency over the *month and week* before exams explained ≈25% of grade variance; the night before was unrelated. A 2024 meta-analysis shows sleep restriction impairs both encoding and consolidation. The scheduler should refuse to plan all-nighters. [S31][S32]
23. **Test anxiety is a measurable drag:** von der Embse et al. 2018 (238 studies, 1988–2018) show consistent negative relationships with performance; CBT, skill-building and biofeedback interventions reduce anxiety *and* raise scores. Timed, exam-condition mock practice is the skill-building arm we can ship. [S33]
24. **Sycophancy is now framed as an educational safety risk** (May 2026 paper); a June 2026 framework shows excessive praise is far more frequent in social/interpretive domains (i.e., essays, humanities — exactly A-Level Business/Economics/History territory) than in objective reasoning. Praise calibration must be an explicit eval. [S34][S35]
25. **Measure learning, not engagement.** Anthropic (1M student conversations, April 2025) and OpenAI (Aug 2026: up to 70M conversations/week are people testing their own knowledge) show massive demand; but the Khanmigo result shows usage ≠ learning. Our north-star metrics must be delayed-retention and transfer scores on unaided assessments. [S9][S10][S4]

---

## 1. Part A — How people learn: effect sizes and boundary conditions

### 1.1 Summary matrix

| Technique | Best estimate | Source (year) | Boundary conditions / caveats |
|---|---|---|---|
| Retrieval practice (practice testing) | g = 0.61 [0.58, 0.65] vs all comparators | Adesope, Trevisan & Sundararajan 2017 [S15] | Largest for secondary students; classroom ≈ lab; free recall/short answer ≥ MCQ; needs feedback for errors (prior knowledge, unverified) |
| Spaced/distributed practice | Optimal gap ≈ 20–40% of a 1-week RI; ≈ 5–10% of a 1-year RI | Cepeda et al. 2008 [S16] | Too-short gaps waste time; too-long gaps let forgetting dominate; Dunlosky 2013 rates "high utility" [S26] |
| Adaptive scheduling (FSRS vs SM-2) | FSRS-7 log loss 0.337 vs HLR 0.469, Ebisu 0.499 (727M reviews, 10k users); FSRS-6 reported to beat SM-2 for 99.6% of users | open-spaced-repetition benchmark [S17]; Flica summary [S18] | "20–30% fewer reviews" is simulated, not an RCT; SM-2 was never designed to output probabilities |
| Interleaving | g = 0.42 overall; g = 0.34 maths; d = 0.83 in Rohrer 2020 RCT (61% vs 38%) | Brunmair & Richter 2019; Rohrer et al. 2020 [S19] | Works when categories are similar/confusable (discrimination learning); weaker/negative if within-category items are too similar |
| Self-explanation prompts | g = 0.55 (69 effects, 64 reports) | Bisra et al. 2018 [S20] | Works for conceptual and procedural; effects across subjects; prompts should be specific ("why is this step valid?") not generic |
| Elaborative interrogation ("why is this true?") | "Moderate utility" | Dunlosky et al. 2013 [S26] | Best with some prior knowledge; effect size ≈ small–moderate (prior knowledge, unverified) |
| Worked examples / expertise reversal | Low prior knowledge: high assistance d = 0.505; high prior knowledge: low assistance d = −0.428 (176 effects, 60 studies) | 2025 meta-analysis, Learning & Instruction [S22] | Fade support per student based on prior-stage performance; erroneous examples help more experienced learners (prior knowledge, unverified) |
| Productive failure (PS-I) | d = 0.36 [0.20, 0.51] for conceptual knowledge & transfer; no procedural cost | Sinha & Kapur 2021 [S21] | Grade 6 to college; stronger when design elicits multiple failed solution attempts before instruction |
| Feedback | d = 0.48 (435 studies, 994 effects, 61k) | Wisniewski, Zierer & Hattie 2020 [S25] | Highly heterogeneous; information-rich feedback >> praise/reinforcement; stronger on cognitive than motivational outcomes |
| Mastery learning / tutoring | Tutoring ≈ 0.37 SD (96 studies, 2020); mastery learning d = 0.61 (low ability) / 0.40 (high ability) in Kulik 1990; Slavin 1987 ≈ 0 | Education Next / Wikipedia summary [S14] | Bloom's 2 SD never replicated at scale |
| Intelligent tutoring systems | Median 0.66 SD (Kulik & Fletcher 2016, 50 evaluations); 0.76 SD step-based (VanLehn 2011) | [S13] | Control condition differs between meta-analyses (classroom vs no-tutoring) |
| Metacognitive calibration training | g ≈ 0.57 improvement in monitoring accuracy (56 studies, 7,667 participants) | "Calibrating Calibration" meta-analysis, J. Ed. Psych. 2021 [S27] | Stronger with prediction + postdiction judgments and deep strategies; adult lab samples show larger effects |
| Growth-mindset interventions | d ≈ 0.05, ns after bias correction; mindset ≈ 1% of achievement variance | Macnamara & Burgoyne 2023; Sisk et al. 2018 [S29] | Possible small benefit for low-SES/at-risk students (Burnette et al. 2023) |
| Self-determination theory | Intrinsic motivation → performance & well-being; identified regulation → persistence; introjected → persistence + ill-being (344 samples, 223,209 students) | Howard et al. 2021 [S28] | Competence is the strongest antecedent of autonomous motivation, then autonomy, then relatedness |
| Test anxiety | Consistent negative relation (238 studies); CBT/skill-building/biofeedback improve both anxiety and scores | von der Embse et al. 2018 [S33] | Typical r ≈ −0.2 to −0.3 (prior knowledge, unverified) |
| Sleep | Month/week-before sleep ≈ 25% of grade variance; night-before irrelevant | Okano et al. 2019 [S31]; 2024 sleep-restriction meta-analysis [S32] | Correlational (Fitbit) but consistent with experimental consolidation literature |

### 1.2 Retrieval practice and the testing effect
- Adesope et al. (2017) meta-analysed practice testing and found g=0.61 [0.58, 0.65] versus restudying, filler or no activity; secondary students benefited more than younger or older learners; classroom experiments showed effects similar to lab studies. [S15]
- Yang et al. (2021, Psychological Bulletin) found small-to-medium effects for retrieval and transfer in classroom settings (the search summary did not give the figure; my recollection is g≈0.50 across 222 independent studies — prior knowledge, unverified). [S15]
- A 2025 Learning & Instruction paper extends the effect to "retention and application of complex educational concepts", i.e., it is not only for facts. [S15]
- Dunlosky et al. (2013) rate practice testing and distributed practice as the only two "high utility" techniques of ten; highlighting, rereading, summarisation, keyword mnemonic and imagery are "low utility"; self-explanation, elaborative interrogation and interleaving are "moderate". [S26]

**Design implication:** every explanation the tutor gives should be followed within the same session by at least one retrieval attempt, and by a scheduled delayed retrieval. The product's "notes" surface must be retrieval-first (question → reveal), not reread-first.

### 1.3 Spacing, SM-2, FSRS
- Cepeda et al. (2008), n>1,350, taught facts, reviewed after gaps up to 3.5 months, tested up to a year later: "the optimum gap value [was] about 20% of the test delay for delays of a few weeks, falling to about 5% when delay was one year." The ratio falls as the retention interval grows. [S16]
- FSRS models each card with Difficulty (1–10), Stability (the interval at which retrievability = 90%) and Retrievability; from FSRS-4.5 on, forgetting is a power law `R(t,S) = (1 + FACTOR·t/S)^DECAY`, and the interval is solved from the desired retention (default 0.9). Unlike SM-2, stability gains from overdue reviews "converge to an upper limit" instead of growing linearly. [S17b]
- The open benchmark (10,000 Anki users, ~727M reviews, time-series split): FSRS-7 recency log loss 0.3370 / RMSE(bins) 0.0593 / AUC 0.722; FSRS-6 0.3460; HLR (Duolingo's half-life regression) 0.4694; Ebisu v2 0.4989; naive average 0.3945. Neural models (RWKV, GRU) score slightly better than FSRS but are heavier. SM-2 is not in the main table; SM-2 comparisons live in sibling repos, and secondary sources report FSRS-6 beating Anki-SM-2 for 99.6% of users on log loss. [S17][S18]
- Caveat the community itself flags: "the 20 to 30 percent efficiency claim comes from simulation, not a controlled empirical study with real students." [S18]

**Design implication:** ship FSRS (MIT/BSD-licensed implementations exist in Rust/TS/Python) with per-user parameter optimisation once a user has ~400+ reviews; expose *desired retention* as a product concept tied to exam proximity (e.g., 0.85 in early term, 0.95 in the final 3 weeks), and compute the schedule backwards from the exam date using the Cepeda ratio as a prior for brand-new material.

### 1.4 Interleaving
- Brunmair & Richter (2019) meta-analysis: g=0.42 overall; strongest for visual materials (g=0.67), smaller for maths (g=0.34); moderated positively by between-category similarity and negatively by within-category similarity. [S19]
- Rohrer, Dedrick, Hartwig & Cheung (2020): RCT with 787 students in 54 classes over four months; unannounced test one month later: interleaved 61% vs blocked 38%, d=0.83. [S19]
- Sana & Yan (2022) show interleaved *retrieval* practice promotes science learning (URL in sources). [S19b]

**Design implication:** practice sets after the first exposure must mix problem types that students confuse (e.g., in 9609: break-even vs margin of safety vs contribution; in calculus: chain vs product rule). The tutor must not label the technique before the student chooses it.

### 1.5 Worked examples, expertise reversal, fading
- The worked-example effect is robust ("not an artefact of lousy control conditions"), but "studying worked examples lose[s] their effectiveness with increasing expertise." [S22]
- 2025 meta-analysis of the expertise-reversal effect (176 effect sizes, 60 studies, 5,924 participants): low prior knowledge → high assistance d=0.505; high prior knowledge → low assistance d=−0.428 (i.e., helping experts hurts them). The authors describe "a gradual and adaptive fading-out of prompts … according to her/his performance in the previous stage." [S22]
- Barbieri et al. (2023, Educational Psychology Review) meta-analysed worked examples in mathematics; positive overall effect (figure not retrieved; prior knowledge suggests g≈0.4–0.5, unverified). [S22b]

### 1.6 Productive failure, desirable difficulties, generation
- Sinha & Kapur (2021): PS-I beats I-PS on conceptual knowledge and transfer, d=0.36 [0.20, 0.51], across 166 comparisons; benefits strongest when students generate *multiple* (failed) solution attempts before instruction; older students (grade 6+) benefit more. [S21]
- A 2021 replication confirmed "robust effects of the efficacy of explicit failure-driven scaffolding". [S21b]
- Desirable difficulties (Bjork), the generation effect and the "Effortless Trap" paper (Brcic & Frljic, June 2026) converge: "an AI that does hard work for students feels like help while removing the very work that builds skill … the felt sense of learning is a poor gauge of the fact of it." Their proposed rule: AI should preserve target cognition and "require bounded productive effort before strong assistance". [S36]

### 1.7 Feedback
- Wisniewski et al. (2020): d=0.48; "feedback cannot be understood as a single consistent form of treatment"; impact "substantially influenced by the information content conveyed"; higher impact on cognitive and motor outcomes than motivational/behavioural. [S25]
- Prior knowledge (unverified): in the same paper, high-information feedback combining task, process and self-regulation information reached d≈0.99, whereas reinforcement/punishment-type feedback was ≈0.24 and feedback about the self (praise) was among the weakest.
- Timing: immediate feedback tends to win for procedural/error correction; slightly delayed feedback can help retention for conceptual material (prior knowledge, unverified — mixed literature; product should A/B).
- 2026 RCT of AI-mediated writing feedback (FeedbackWriter, large undergraduate course): revision quality d=0.50 (≈50th→70th percentile). [S37]

### 1.8 Mastery learning, Bloom, ITS
- Bloom's 2-sigma rested on two studies by his graduate students. Meta-analytic tutoring effects: Cohen, Kulik & Kulik 1982 ≈0.33 SD; Nickow et al. 2020 ≈0.37 SD across 96 studies, none reaching 2 SD; mastery learning Kulik 1990 d=0.61 (lower ability) / 0.40 (higher ability), Slavin 1987 near zero with stricter inclusion. Kraft: Bloom "helped to anchor education researchers' expectations for unrealistically large effect sizes". [S14]
- ITS: Kulik & Fletcher 2016 median 0.66 SD (50th→75th percentile) vs conventional classes; VanLehn 2011 step-based 0.76 vs human 0.79; the two differ because VanLehn's control was no-tutoring reading/problem solving. A 2025 arXiv meta-analysis of US K-12 ITS examines heterogeneity of effects. [S13]

### 1.9 Metacognition and calibration
- Overestimation is the norm; students who overestimated on a pretest "engaged less in metacognitive strategies, particularly in preparatory actions before quizzes" (IJAIED 2025). [S27]
- "Calibrating Calibration" (56 studies, 7,667 participants): learning-strategy instruction improved monitoring accuracy g≈0.57; larger when using prediction and postdiction confidence judgments and their difference. A 3-step classroom tool (predict → postdict → compare to actual; N=297, grades 2–12) is a ready-made pattern. [S27]

### 1.10 Motivation, mindset, habits, anxiety, sleep
- SDT (Howard et al. 2021): see §1.1; competence > autonomy > relatedness as antecedents (Bureau et al. 2022). A 2025 meta-analysis shows autonomy support *combined with structure* is optimal. [S28]
- Growth mindset: Sisk 2018 and Macnamara & Burgoyne 2023 vs Burnette et al. 2023 (multi-level meta-regression, "nuanced conclusions"); consensus: small, heterogeneous, possibly meaningful for at-risk students, not a core lever. [S29]
- Streaks: The Decision Lab documents "streak creep" and the abstinence-violation effect; commentary notes users "weren't logging in to learn anymore but to avoid losing their streak". Recovery mechanics (freezes, grace periods) mitigate. [S30]
- Test anxiety: von der Embse 2018; interventions that work include behavioural, cognitive, CBT, academic skill-building and biofeedback. [S33]
- Sleep: Okano 2019 — sleep over the preceding month/week, not the night before, predicts grades (~25% of variance); 2024 systematic review/meta-analysis: sleep restriction impairs encoding and consolidation, "short sleep impairing memory to a similar degree as not sleeping at all". [S31][S32]

### 1.11 Items covered mainly from prior knowledge (unverified online this session)
- **Cognitive load theory** (Sweller): intrinsic/extraneous/germane load; split-attention, redundancy, modality effects → keep explanations short, integrate diagrams with text, avoid redundant narration.
- **Dual coding / concrete examples**: verbal + visual representations aid learning when integrated, not decorative; concrete examples aid abstraction when multiple, varied examples are compared.
- **ZPD / scaffolding** (Vygotsky; Wood, Bruner & Ross): contingent help — increase support after failure, decrease after success — is the core of effective tutoring (contingent shifting rule).
- **Deliberate practice** (Ericsson): targeted, effortful practice on weaknesses with immediate feedback; "10,000 hours" is a popularisation.
- **Socratic dialogue**: 2025–26 studies (nursing, physics, Taiwan) report gains in reflection/critical thinking; no large RCT isolates questioning vs answers. [S38]

---

## 2. Part B — AI tutoring evidence 2023–2026

### 2.1 Evidence matrix

| Study | Setting / n | Design | Result | What made the difference |
|---|---|---|---|---|
| Kestin et al. 2025, Sci. Reports (Harvard PS2) [S1] | ~190 undergrads, Fall 2023 | Crossover RCT: AI tutor at home vs research-based active-learning class | ≈2× learning gains for AI tutor; less time; higher engagement/motivation | Expert-authored scaffolds, step-by-step, guardrails against hallucination, principles: active engagement, manage cognitive load, growth mindset, don't give answers away |
| Bastani et al. 2025, PNAS (Turkey) [S2] | ~1,000 high-school maths students | RCT: GPT Base vs GPT Tutor vs control during practice; closed-book exam after | Practice: +48% (Base), +127% (Tutor). Exam: Base *significantly worse* than control (≈−17%, prior knowledge); Tutor ≈ control | Guardrails: hints not solutions, require attempt, teacher-authored solutions; Base users used GPT as a "crutch" (asked for answers) |
| Tutor CoPilot 2024/25 (Stanford, FEV Tutor) [S3] | ~900 tutors / ~1,800 K-12 students, under-served | Pre-registered RCT; AI suggests next move to human tutor | +4 pp mastery (p<0.01); +9 pp for lower-rated tutors; $20/tutor/yr; 550k+ messages | Model of expert thinking (think-alouds); more guiding questions, less answer-giving |
| Khanmigo two-year trial (NBER w35620, 2025/26) [S4] | 18 Tennessee middle schools | Cluster RCT; Khanmigo "coach not answer" in daily remedial maths | +1.3 percentile ranks/term ≈ 0.06–0.08 SD/yr; 0.14 SD full-year active; ≈ Khan without AI | Engagement was the binding constraint; low usage |
| Nigeria (World Bank WPS 11125, May 2025) [S11] | Senior-secondary, Benin City; 6 weeks after-school | RCT; Copilot (GPT-4) with teacher facilitation | +0.31 SD overall; +0.23 SD English; ≈1.5–2 years of BAU schooling; larger for girls and higher-baseline students | Structured sessions, teacher as facilitator, curriculum-aligned prompts |
| FeedbackWriter 2026 [S37] | Large undergrad course | RCT | Revision quality d=0.50 | AI-mediated (instructor-shaped) feedback |
| UK supervised-AI-tutor study (reported 2025/26) [S39] | 165 students aged 13–15 | RCT vs online human tutors | AI slightly better | "Supervised" — humans in the loop (details unverified) |
| MIT "Your Brain on ChatGPT" (preprint, June 2025) [S5] | 54 participants, 18 in session 4 | 3 groups × 3 sessions + crossover, EEG | Connectivity scaled down with external support; LLM group: lowest ownership, could not quote own essay; LLM-to-Brain showed under-engagement; Brain-to-LLM showed higher recall/connectivity | Order matters: think first, then AI |
| Gerlich 2025, Societies [S7] | 666 participants | Cross-sectional survey + interviews | Negative correlation AI use ↔ critical thinking, mediated by cognitive offloading; younger = more dependent | Correlational; correction published Sept 2025 |
| Lee et al. (Microsoft/CMU) CHI 2025 [S8] | 319 knowledge workers, 936 examples | Survey | Higher confidence in GenAI → less critical thinking; higher self-confidence → more; CT shifts to verification/integration/stewardship | Self-report |
| Anthropic Education Report, Apr 2025 [S9] | 1M student conversations | Usage analysis | 4 patterns (direct/collaborative × problem-solving/output creation); STEM/CS over-represented; concerns about outsourcing higher-order thinking (Creating/Analyzing) | Observational |
| OpenAI usage research (Sept 2025 NBER; Aug 2026 student report) [S10] | 1.5M conversations; platform-wide | Usage analysis | Up to 70M conversations/week are people testing their own knowledge; March 2026: framework to study long-term learning effects | Observational |
| Alpha School claims [S12] | Private school network | Internal MAP analysis | "2.6× faster" not reconstructible; raw data promised to auditors not delivered as of Aug 2026; selection effects | No independent evidence |

### 2.2 What the positive studies have in common
1. **Pedagogy encoded in the system, not left to the student's prompt** (Kestin scaffolds; Bastani's GPT Tutor; Khanmigo's coach mode; Tutor CoPilot's expert model).
2. **A correct answer key is available to the tutor** (Bastani gave GPT Tutor teacher solutions; Kestin used expert-authored solutions) so it can check work rather than guess.
3. **Bounded scope** — one topic, one problem set, aligned to what will be assessed.
4. **Effort is required before help** (attempt first; hints escalate).
5. **A human or structure around the AI** (Nigeria's facilitators; Tutor CoPilot's tutors; the UK "supervised" tutor).

### 2.3 What the negative/null studies have in common
1. **Open-ended chat with no answer-withholding** (GPT Base) → practice inflation, exam decline. [S2]
2. **Low engagement with an optional tool** (Khanmigo) → tiny effects regardless of model quality. [S4]
3. **AI used to *produce* rather than to *practise*** (MIT essays; Anthropic's "direct output creation") → shallow encoding, low ownership. [S5][S9]

### 2.4 LearnLM: pedagogy principles and evaluation approach
- The 2024 LearnLM paper ("Towards Responsible Development…", arXiv 2407.12687; revised 28 Nov 2025 in response to Roschelle, McLaughlin & Koedinger) translated learning-science principles into seven benchmarks (quantitative, qualitative, automatic, human) and reported LearnLM-Tutor "consistently preferred over a prompt tuned Gemini by educators and learners on a number of pedagogical dimensions." [S6]
- Its five tutor behaviours (prior knowledge, unverified wording): *inspire active learning; manage cognitive load; adapt to the learner; stimulate curiosity; deepen metacognition.*
- The December 2024 report ("LearnLM: Improving Gemini for Learning", arXiv 2412.16429) reframed the problem as **pedagogical instruction following**: training and eval examples carry system instructions describing the desired pedagogy; experts preferred LearnLM by +31% over GPT-4o, +11% over Claude 3.5 Sonnet, +13% over Gemini 1.5 Pro. Key developer finding: "Teachers or developers … want to feel confident that the AI tutor will follow the specified instructions accurately, even if a student tries to circumvent them (e.g., 'do not give away the answer' or 'stay on topic')." Also: "prompting will likely remain the best way for education product developers to specify behavior", and "While SFT seems to improve pedagogical instruction following somewhat, RL is significantly more effective". [S6b]

### 2.5 Evaluation benchmarks we should adopt
- **SafeTutors (March 2026):** 11 harm dimensions, 48 sub-risks; "the primary risk is not toxic content but the quiet erosion of learning through answer over-disclosure, misconception reinforcement, and the abdication of scaffolding"; failures rise 17.7% → 77.8% multi-turn; harms vary by subject. [S23]
- **MathTutorBench (ETH, 2025; Kapur co-author):** reward model distinguishes expert vs novice teacher responses; "subject expertise … does not immediately translate to good teaching"; "tutoring appears to become more challenging in longer dialogs, where simpler questioning strategies begin to fail." [S24]
- **Sycophancy benchmarks:** "Sycophancy is an Educational Safety Risk" (May 2026) [S34]; "Sycophantic Praise" (June 2026) — parameterised framework measuring praise relative to contribution quality and expected ability; praise inflation "far more frequently in social and interpretive domains than in objective reasoning settings"; cites Mueller & Dweck 1998 / Kamins & Dweck 1999 on person-praise harms. [S35]
- **K12-KGraph (July 2026):** curriculum-aligned knowledge graph benchmark; graph-guided SFT improves curriculum understanding — relevant to mapping syllabi like 9609. [S40]

### 2.6 Consumer "study modes" (2025–26)
ChatGPT Study Mode (July 2025), Gemini Guided Learning (Aug 2025) and Claude Learning Mode all withhold answers and ask guiding questions; reviewers describe Claude as holding "the Socratic line hardest", Gemini as most structured (stages, visuals), ChatGPT as most conversational. **No RCT evidence of learning gains for any of them was found**; they are table stakes and are easily toggled off by the student. [S41]

---

## 3. Part C — Concrete, testable product rules

### 3.1 The help ladder: answer vs hint vs question
Rule A1 — **Effort gate.** Before any solution content is shown for a gradable task, the student must submit an attempt, a plan, or an explicit "I don't know where to start" with one sentence about what they do know. (Bastani GPT Tutor; Effortless Trap "bounded productive effort before strong assistance".) [S2][S36]
Rule A2 — **Five-rung ladder, one rung per turn:** (1) metacognitive prompt ("what is the question asking / which concept family?"), (2) conceptual pointer (name the principle, no numbers), (3) procedural hint (the next step only), (4) partial worked step with a blank the student fills, (5) full worked solution **followed immediately by a near-transfer problem the student must solve unaided**. The ladder resets per problem. Log the rung reached; it is a learning signal.
Rule A3 — **Expertise-aware entry rung.** If the learner's mastery estimate for the skill is < 0.4, start at rung 4 (worked example) — novices learn better from high assistance (d=0.505); if > 0.7, start at rung 1 and refuse rung 4 unless two failed attempts (d=−0.428 for over-assisting experts). [S22]
Rule A4 — **Answer-on-demand exists but is labelled and tracked.** When the student insists, give the full solution, mark the item as "seen-solution" (not mastered), and schedule it for unaided retrieval within 24–72 h. Never lie about withholding; never moralise.
Rule A5 — **Never confirm correctness the student has not committed to.** If the student says "is it B?", ask for the reason first; a bare guess gets "commit to a reason, then I'll tell you."

### 3.2 Anatomy of a good tutoring turn (≤120 words unless the student asked for depth)
1. **Acknowledge specifically** what was right (task-level, not person-level). [S25][S35]
2. **Diagnose** the one thing that is wrong or missing, named precisely (misconception label).
3. **One move**: a question, hint or micro-example (never all three).
4. **Hand back the pen**: an explicit action for the student ("try the next line").
Forbidden in the same turn: solving beyond the current step; multiple questions; generic praise ("great job!"); restating the whole problem. Tutor CoPilot's classifier-verified shift — more guiding questions, fewer given answers — is the target distribution. [S3]

### 3.3 Eliciting and diagnosing misconceptions
Rule B1 — **Every syllabus point ships with a misconception list** (mined from examiner reports, e.g., Cambridge 9609 examiner reports repeatedly flag confusing "cash flow" with "profit" — illustrative, prior knowledge) and 2–3 diagnostic items whose distractors map to those misconceptions.
Rule B2 — **Cold-open diagnostic**: the first interaction on a topic is a 3–5 item retrieval probe with confidence ratings, not an explanation. (Productive failure d=0.36; calibration.) [S21][S27]
Rule B3 — **Ask for the reasoning trace, not the answer**: "talk me through how you got 42" → classify the error (slip vs misconception vs missing prerequisite) → route: slip = quick fix; misconception = contrast case; prerequisite = detour to prerequisite node.
Rule B4 — **Contrast cases** for confusable concepts (interleaving g=0.42): present two items differing in one feature and ask which rule applies and why. [S19]

### 3.4 Fading support
Rule C1 — **Per-skill fading state machine**: worked example → completion problem (last step blank) → completion (first step given) → full problem with hints available → full problem, no hints, timed. Advance after 2 consecutive correct at the current stage; regress after 2 consecutive errors. [S22]
Rule C2 — **Self-explanation checkpoint on every worked example**: the student must explain one step ("why divide by contribution per unit here?") before seeing the next (g=0.55). [S20]
Rule C3 — **Hints decay**: the same hint type is not offered twice for the same skill within a week; the tutor asks the student to generate the hint themselves ("what would you tell a friend stuck here?").

### 3.5 Scheduling review and interleaving
Rule D1 — **FSRS as the memory model** for every atomic item (fact, formula, definition, worked skill), with desired retention ramping toward the exam date: R=0.85 (>8 weeks out), 0.90 (3–8 weeks), 0.95 (<3 weeks). Fit parameters per user after ~400 reviews; before that use defaults. [S17]
Rule D2 — **Exam-anchored prior for first review**: for new material, first review at ≈10–20% of the time to the exam (Cepeda ridgeline) when the exam is < 8 weeks away; otherwise FSRS default. [S16]
Rule D3 — **Daily session composition**: ≥60% due reviews, ≥25% interleaved mixed practice from the last 3 topics, ≤15% new material; never a blocked set of >5 same-type items after first exposure. [S19]
Rule D4 — **Sleep-aware planner**: the study plan never schedules more than 90 minutes after 22:00 local in the week before an exam, and surfaces "sleep is worth more than this session" when the student plans late cramming (Okano 2019; 2024 meta-analysis). [S31][S32]
Rule D5 — **Load balancing**: cap new items so due reviews per day stay under a user-set ceiling; unmet reviews roll over without penalty (no "overdue" shame counters).

### 3.6 Feedback that improves learning
Rule E1 — **Feedback = task + process + self-regulation**, in that order: what is wrong, what strategy fixes it, how to check it next time. No feedback about the person. [S25]
Rule E2 — **Mark-scheme-grounded grading for essays**: for exam boards with published mark schemes and assessment objectives (e.g., Cambridge AO1–AO4 knowledge/application/analysis/evaluation), feedback names the AO and level descriptor the answer hit and quotes the sentence that limited it; then asks the student to rewrite *only* that paragraph (FeedbackWriter revision effect d=0.50). [S37]
Rule E3 — **Immediate for procedures, brief-delay for concepts (A/B test)**: correct arithmetic/definition errors instantly; for conceptual essays, deliver a 1-line verdict now and the detailed feedback after the student's own self-assessment.
Rule E4 — **Praise calibration eval**: sample 1% of tutor turns weekly; score with a praise-vs-contribution rubric (per the 2026 "Sycophantic Praise" framework); target: <5% of turns contain praise not tied to a specific correct action; humanities subjects get double sampling because inflation is higher there. [S35]

### 3.7 Building calibration (predict-then-check)
Rule F1 — **Confidence slider on every gradable answer** (sure / fairly sure / guessing). Show a per-topic calibration curve weekly: "you said 'sure' 40 times; 26 were right."
Rule F2 — **Predict-postdict-compare loop** on mocks: predicted mark before, felt mark after, actual mark; the gap is displayed and the tutor comments on the gap, not just the score (g≈0.57 monitoring improvement). [S27]
Rule F3 — **Overconfidence triggers retrieval, not reading**: items marked "sure" but wrong get a shorter FSRS interval multiplier (×0.5) and a mandatory self-explanation.
Rule F4 — **Illusion-of-competence interrupts**: if a student re-reads/asks for a re-explanation of the same passage twice without attempting retrieval, the tutor switches modality: "close the notes — tell me the three causes from memory." [S26]

### 3.8 Measuring learning rather than engagement
North-star metrics (all on *unaided* tasks):
- **Delayed retention rate**: % of items recalled at 7 and 28 days without hints.
- **Transfer score**: performance on never-seen items from the same skill node.
- **Predicted-grade accuracy**: mock-exam grade (auto-marked against the mark scheme) vs actual exam result, once available.
- **Mastery velocity**: skill nodes moved to "mastered" (2 unaided correct across ≥2 days) per hour of study.
- **Help-ladder depth trend**: average rung needed per problem should fall within a skill.
- **Calibration error** (Brier score on confidence ratings).
Guard-rail metrics: solution-request rate; % of sessions with zero retrieval; % turns >150 words; sycophancy score; multi-turn pedagogy failure rate (SafeTutors-style rubric on 30-turn conversations). Engagement (DAU, minutes) is reported but never optimised directly (Khanmigo lesson: usage without learning is possible; Duolingo lesson: streaks distort). [S4][S30][S23]

### 3.9 What to NEVER do
1. Write the graded assignment (essay, coursework, IA/EE) in submittable form; instead offer outline critique, paragraph-level feedback on student text, and model answers only for *past* papers.
2. Confirm an answer without a stated reason.
3. Give generic or person-focused praise ("you're so smart"). [S35]
4. Reveal the solution before an attempt on gradable practice (except via the labelled override). [S2]
5. Produce >150-word turns in tutoring mode without an explicit request for a full explanation (cognitive load).
6. Agree with a student's incorrect claim to keep them happy (sycophancy = educational safety risk). [S34]
7. Run a blocked drill of one type past first exposure. [S19]
8. Use streak loss, shame counters or "overdue: 312" as motivators. [S30]
9. Claim a fact about a mark scheme or examiner expectation without a retrievable source from the loaded paper/mark scheme (hallucinated marking criteria are the domain-specific hallucination risk).
10. Schedule cramming that displaces sleep in exam week. [S31]
11. Ask more than one question per turn.
12. Reward re-reading or highlighting as "study" in analytics or UI.

### 3.10 Handling "just give me the answer" without losing the user
- **Name the deal, once, briefly**: "Sure — here it is, and I'll give you one like it right after so it sticks." Then deliver rung 5 + a near-transfer item (retrieval g=0.61). No lecture. [S15]
- **Offer time-boxed struggle**: "Give me 90 seconds on this hint; if it doesn't click, full solution, no questions asked." Bounded effort is the evidence-based compromise. [S36]
- **Distinguish intents**: homework-due-in-10-minutes (answer + schedule unaided redo tomorrow), checking-my-work (ask for their answer first, then confirm), learning (ladder). A one-tap intent chip at the start of a task removes friction.
- **Show the receipt**: a small "solution seen — will re-test Thursday" chip, so students feel the product is on their side, not policing them.
- **Never gaslight**: if the student asks whether the tutor is withholding, say yes and why in one sentence.

### 3.11 A "cognitive debt guard" — how it could work
Signals (per session and rolling 14 days):
1. Solution-request ratio (rung-5 requests ÷ problems).
2. Attempt latency: time from problem shown to first student token (< 8 s on a non-trivial problem = not reading).
3. Copy-paste detection of tutor text into student answers.
4. Retrieval avoidance: re-explanation requests without intervening attempts.
5. Confidence–accuracy gap widening.
6. Output-creation vs practice ratio (Anthropic's "direct output creation" pattern). [S9]
Responses (graduated, never punitive):
- Level 1 (soft): the next session opens with a 3-item unaided retrieval on yesterday's "seen-solution" items; a calm one-line note.
- Level 2: the help ladder entry rung rises by one for that skill for 48 h; hints become questions.
- Level 3: "Brain-first mode" — for the next problem the tutor is read-only until an attempt is submitted (MIT session-4 result: think first, then AI, preserves engagement). [S5]
- Always paired with a visible *benefit* metric ("your unaided score on this topic went from 40% → 70% since we switched to brain-first"), because self-confidence (not confidence in the AI) predicts critical engagement. [S8]
Test: guard on vs off, randomised at user level, primary outcome = 28-day delayed retention and mock-exam score; secondary = retention (churn) — the guard must not cost more than 1–2 pp of 30-day retention or it will be turned off by product pressure.

### 3.12 System architecture rules implied by the evidence
- **Answer key in context**: every practice item carries a verified solution/mark scheme so the tutor checks rather than guesses (Bastani, Kestin). [S2][S1]
- **Pedagogy in system instructions + post-training, not user prompts** (LearnLM: developers need robust instruction following under student pressure; RL > SFT). Budget for a fine-tuned or RL-tuned tutoring layer on top of the API models, or at minimum a policy-enforcing orchestrator that inspects each draft turn for answer leakage. [S6b]
- **Multi-turn evals in CI**: 30-turn simulated-student conversations (including adversarial "just tell me" personas) scored on SafeTutors dimensions before every prompt/model change; single-turn evals are insufficient. [S23]
- **Subject-specific mitigations**: harm profiles differ by subject; essay subjects need sycophancy/praise controls, quantitative subjects need answer-leak controls. [S23][S35]
- **Human-in-the-loop hooks**: teacher/parent view of the help-ladder log and calibration data (Tutor CoPilot, Nigeria facilitation). [S3][S11]

---

## 4. Implications for our product (testable rules and features)

1. **Attempt-before-answer gate** on all gradable items; A/B primary metric: 7-day unaided retention. [S2]
2. **Five-rung help ladder** with per-rung logging; KPI: average rung falls over time within a skill. [S3][S36]
3. **Prior-knowledge-routed entry rung** (worked example for novices, question for experts). [S22]
4. **Faded worked examples** with mandatory self-explanation checkpoints. [S20][S22]
5. **Productive-failure openers**: each new topic starts with a 5-minute "try before we teach" problem and a confidence rating. [S21]
6. **FSRS scheduler** with exam-date-driven desired retention and per-user fitting. [S17]
7. **Cepeda prior** for first reviews of new material inside 8 weeks of the exam. [S16]
8. **Interleaved daily mix** (60/25/15 rule; no blocked drills after first exposure). [S19]
9. **Retrieval-first notes UI**: notes render as prompts with reveal; reading mode exists but is not counted as study. [S26]
10. **Task/process/self-regulation feedback template**; ban on person-praise; weekly praise-calibration audit. [S25][S35]
11. **Mark-scheme-grounded essay feedback** naming AO/level and quoting the limiting sentence, then paragraph-only rewrite. [S37]
12. **Confidence slider + calibration curve + predict/postdict/compare on mocks.** [S27]
13. **Overconfident-wrong items get ×0.5 interval and forced self-explanation.** [S27]
14. **Cognitive-debt guard** (six signals, three graduated levels) randomised on/off; must not cost >2 pp 30-day retention. [S5][S8][S9]
15. **Intent chips** (homework / check / learn) to route the help policy transparently. [S2]
16. **Learning-event streaks, not day streaks**; no loss framing; automatic grace. [S30]
17. **Sleep-aware planner** that declines to schedule late cramming in exam week. [S31][S32]
18. **Timed exam-condition mocks** as the test-anxiety intervention (skill building), with brief pre-mock breathing/reappraisal script optional. [S33]
19. **North-star dashboard = delayed retention, transfer, predicted-grade accuracy, mastery velocity, calibration error**; engagement demoted to guard-rail. [S4]
20. **Multi-turn pedagogy CI** (SafeTutors-style, adversarial student personas) gating every prompt/model release. [S23][S24]
21. **Answer key / mark scheme always in context**; refuse to grade an exam-style item without one. [S1][S2]
22. **Tutoring layer trained or RL-tuned for pedagogical instruction following**, or an orchestrator that vets each draft turn for answer leakage and >1 question. [S6b]
23. **Competence-first motivation UI**: show mastery gains and unaided-score deltas prominently; avoid mindset slogans. [S28][S29]
24. **Teacher/parent read-only view** of ladder depth, calibration and "seen-solution" items to enable human-in-the-loop. [S3][S11]
25. **Turn-length governor**: default ≤120 words in tutoring mode; full explanations on explicit request only. (Cognitive load; prior knowledge.)
26. **Misconception library per syllabus point** seeded from examiner reports; diagnostic distractors mapped to it. [S23]
27. **Never-do list enforced as evals**, not just prompt text (assignment writing, unreasoned confirmation, sycophantic agreement, blocked drills, shame counters).

---

## 5. Open questions / things we could not verify
1. Exact Bastani exam figures (the widely cited "GPT Base −17%") and the precise GPT Tutor prompt text — PNAS/PMC were blocked; the +48%/+127% practice figures and "significant decline" for GPT Base are confirmed via abstracts. [S2]
2. Kestin et al. exact n (reports vary ~180–194), effect size (Cohen's d) and time-on-task minutes; Scientific Reports and Hechinger were blocked. [S1]
3. Anthropic report percentages (I recall Direct Problem Solving ≈23%, Direct Output ≈24%, Collaborative ≈53% combined; Bloom's Creating 39.8%, Analyzing 30.2%) — could not verify; treat as prior knowledge. [S9]
4. Wisniewski 2020 breakdown by feedback type (task/process/self-regulation/praise) — the d=0.48 overall and the "information content" moderator are verified; sub-effects are from memory. [S25]
5. Yang et al. 2021 classroom testing-effect estimate (g≈0.50 from memory). [S15]
6. Whether the "3 months later, working memory 15% lower" MIT claim in The Decoder's summary is in the paper — the abstract does not contain it; treat as unverified. [S5]
7. Identity/details of the UK 165-student "supervised AI tutor vs human tutors" RCT (likely Eedi or Third Space Learning) — only a secondary summary was seen. [S39]
8. Effect of immediate vs delayed feedback for AI tutoring specifically — literature is mixed; no 2025–26 RCT found.
9. No RCT evidence yet for ChatGPT Study Mode / Gemini Guided Learning / Claude Learning Mode. [S41]
10. Whether FSRS's simulated 20–30% review savings hold in a mixed-modality exam-prep product (formulas, essays plans, diagrams) rather than flashcards. [S18]
11. OpenAI's March 2026 "long-term learning effects" framework — partners and first results not retrieved (Axios blocked). [S10]
12. Alpha School: raw MAP data still unreleased as of August 2026 per secondary sources; no third-party evaluation exists. [S12]
13. The 2025 arXiv K-12 ITS meta-analysis (2511.04997) overall effect size — not retrieved. [S13]
14. LearnLM's five behaviours wording and the 2025-11-28 revision content (peer feedback from Roschelle/McLaughlin/Koedinger) — arXiv blocked; the HF mirror lacked 2407.12687. [S6]

---

## 6. Sources
[S1] Kestin, Miller, Klales, Milbourne & Ponti (2025) "AI tutoring outperforms in-class active learning", Scientific Reports — https://www.researchgate.net/publication/392839220_AI_tutoring_outperforms_in-class_active_learning_an_RCT_introducing_a_novel_research-based_design_in_an_authentic_educational_setting ; review: https://etcjournal.com/2025/11/10/review-of-kestin-et-al-s-june-2025-harvard-study-on-ai-tutoring/ ; press: https://hechingerreport.org/proof-points-ai-tutor-harvard-physics/
[S2] Bastani, Bastani, Sungu, Ge, Kabakcı & Mariman (2025) "Generative AI without guardrails can harm learning: Evidence from high school mathematics", PNAS 122(26) — https://www.pnas.org/doi/10.1073/pnas.2422633122 ; PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC12232635/ ; Wharton summary: https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education/
[S3] Wang, Ribeiro, Robinson, Loeb & Demszky (2024/25) "Tutor CoPilot" — https://arxiv.org/abs/2410.03017v2 ; https://edworkingpapers.com/ai24-1054 ; https://edunlp.stanford.edu/projects/tutor-copilot
[S4] "One Click Away: AI Tutoring with Khanmigo in a Two-Year School Experiment", NBER w35620 — https://www.nber.org/papers/w35620 ; https://edworkingpapers.com/ai26-1551 ; summary: https://www.winssolutions.org/khanmigo-ai-tutoring-two-year-trial/ ; Khan Academy learnings: https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/
[S5] Kosmyna et al. (2025) "Your Brain on ChatGPT" — https://arxiv.org/abs/2506.08872 ; https://www.media.mit.edu/projects/your-brain-on-chatgpt/overview/ ; press: https://the-decoder.com/mit-study-shows-cognitive-debt-through-chatgpt-heres-what-it-means-in-real-world-practice/
[S6] Jurenka et al. (2024, rev. 2025) "Towards Responsible Development of Generative AI for Education: An Evaluation-Driven Approach" — https://arxiv.org/abs/2407.12687 ; https://arxiv.org/html/2407.12687
[S6b] Google DeepMind (Dec 2024, updated Aug 2025) "LearnLM: Improving Gemini for Learning" — https://arxiv.org/abs/2412.16429 ; https://huggingface.co/papers/2412.16429
[S7] Gerlich (2025) "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking", Societies 15(1):6 — https://www.mdpi.com/2075-4698/15/1/6 ; correction: https://www.researchgate.net/publication/395511406
[S8] Lee et al. (CHI 2025) "The Impact of Generative AI on Critical Thinking" — https://dl.acm.org/doi/full/10.1145/3706598.3713778 ; https://www.microsoft.com/en-us/research/publication/the-impact-of-generative-ai-on-critical-thinking-self-reported-reductions-in-cognitive-effort-and-confidence-effects-from-a-survey-of-knowledge-workers/ ; Microsoft "Learning outcomes with GenAI in the classroom" (Oct 2025): https://www.microsoft.com/en-us/research/wp-content/uploads/2025/10/GenAILearningOutcomes-Report-published-10-07-2025.pdf
[S9] Anthropic Education Report: How University Students Use Claude (Apr 2025) — https://www.anthropic.com/news/anthropic-education-report-how-university-students-use-claude ; educators report: https://www.anthropic.com/news/anthropic-education-report-how-educators-use-claude
[S10] OpenAI "How People Use ChatGPT" (Sept 2025, NBER) — https://openai.com/index/how-people-are-using-chatgpt/ ; PDF: https://cdn.openai.com/pdf/a253471f-8260-40c6-a2cc-aa93fe9f142e/economic-research-chatgpt-usage-paper.pdf ; Aug 2026 student report coverage: https://www.tun.com/home/openai-report-460m-weekly-student-messages-sent-to-chatgpt/ ; Axios Mar 2026: https://www.axios.com/2026/03/04/openai-chatgpt-learning-students-cognitive
[S11] World Bank (May 2025) "From Chalkboards to Chatbots", PRWP 11125 — https://openknowledge.worldbank.org/entities/publication/15e1ff08-15ae-4f7a-b2a8-d146e6c113ee ; https://ideas.repec.org/p/wbk/wbrwps/11125.html
[S12] Alpha School critiques — https://www.astralcodexten.com/p/your-review-alpha-school ; https://nepc.colorado.edu/blog/fprice-kids-pay ; https://paulkirschner173727.substack.com/p/alpha-school-may-be-efficient-but ; https://theinfohatch.com/alpha-school-review-ai-2-hour-learning-2026/
[S13] Kulik & Fletcher (2016) RER — https://journals.sagepub.com/doi/abs/10.3102/0034654315581420 ; K-12 ITS meta-analysis (2025): https://arxiv.org/pdf/2511.04997 ; VanLehn 2011 discussed in both.
[S14] Bloom 2-sigma critiques — https://www.educationnext.org/two-sigma-tutoring-separating-science-fiction-from-science-fact/ ; https://en.wikipedia.org/wiki/Bloom%27s_2_sigma_problem ; https://nintil.com/bloom-sigma/
[S15] Adesope, Trevisan & Sundararajan (2017) — https://journals.sagepub.com/doi/abs/10.3102/0034654316689306 ; 2025 L&I complex-concepts paper: https://www.sciencedirect.com/science/article/pii/S0959475225001434
[S16] Cepeda, Vul, Rohrer, Wixted & Pashler (2008) Psychological Science — https://journals.sagepub.com/doi/abs/10.1111/j.1467-9280.2008.02209.x ; PDF: https://files.eric.ed.gov/fulltext/ED505660.pdf
[S17] open-spaced-repetition SRS benchmark — https://github.com/open-spaced-repetition/srs-benchmark ; https://expertium.github.io/Benchmark.html
[S17b] FSRS algorithm wiki — https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
[S18] FSRS vs SM-2 summaries — https://flica.app/article/fsrs-vs-sm2 ; https://www.neurako.com/blog/fsrs-vs-sm2-spaced-repetition-algorithms-compared
[S19] Brunmair & Richter (2019) meta-analysis — https://www.psychologie.uni-wuerzburg.de/fileadmin/06020400/2019/Brunmair_Richter_in_press__2019_META-ANALYSIS_OF_INTERLEAVED_LEARNING.pdf ; Rohrer et al. 2020 discussed at https://glasp.co/articles/interleaving-practice
[S19b] Sana & Yan (2022) — https://pdf.retrievalpractice.org/spacing/InterleavedRetrievalPracticePromotesScienceLearning_SanaYan_2022.pdf
[S20] Bisra et al. (2018) "Inducing Self-Explanation: a Meta-Analysis" — https://link.springer.com/article/10.1007/s10648-018-9434-x
[S21] Sinha & Kapur (2021) RER — https://journals.sagepub.com/doi/10.3102/00346543211019105 ; [S21b] replication: https://www.sciencedirect.com/science/article/pii/S0959475221000475
[S22] "A cornerstone of adaptivity – A meta-analysis of the expertise reversal effect" (2025) — https://www.sciencedirect.com/science/article/pii/S0959475225000660 ; [S22b] worked examples in maths meta-analysis (2023): https://link.springer.com/article/10.1007/s10648-023-09745-1
[S23] SafeTutors (Mar 2026) — https://arxiv.org/abs/2603.17373
[S24] MathTutorBench (2025) — https://arxiv.org/abs/2502.18940
[S25] Wisniewski, Zierer & Hattie (2020) Frontiers in Psychology — https://pmc.ncbi.nlm.nih.gov/articles/PMC6987456
[S26] Dunlosky et al. (2013) PSPI — https://journals.sagepub.com/doi/abs/10.1177/1529100612453266
[S27] "Calibrating Calibration" meta-analysis, J. Educational Psychology (2021) — https://www.ovid.com/journals/jedup/fulltext/10.1037/edu0000674~calibrating-calibration-a-meta-analysis-of-learning-strategy ; IJAIED 2025 calibration discrepancy: https://link.springer.com/article/10.1007/s40593-025-00514-5 ; 3-step classroom intervention: https://link.springer.com/article/10.1007/s11409-025-09418-0
[S28] Howard, Bureau, Guay, Chong & Ryan (2021) — https://journals.sagepub.com/doi/abs/10.1177/1745691620966789 ; Bureau et al. 2022 antecedents: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8935530/ ; autonomy support + structure meta-analysis 2025: https://link.springer.com/article/10.1007/s10648-025-09994-2
[S29] Sisk et al. (2018) — https://pubmed.ncbi.nlm.nih.gov/29505339/ ; Macnamara & Burgoyne (2023) — https://englelab.gatech.edu/articles/2022/Macnamara%20and%20Burgoyne%20(2022)%20-%20Do%20Growth%20Mindset%20Interventions%20Impact%20Students%E2%80%99%20Academic%20Achievement.pdf ; Burnette et al. 2023: https://pmc.ncbi.nlm.nih.gov/articles/PMC10495100/
[S30] Streaks — https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification ; https://trophy.so/blog/when-your-app-needs-streak-feature ; https://www.wr-publishing.org/index.php/ijmat/article/view/908
[S31] Okano et al. (2019) npj Science of Learning — https://www.nature.com/articles/s41539-019-0055-z ; 2025 actigraphy replication: https://www.nature.com/articles/s41598-025-33775-0
[S32] Sleep restriction and memory meta-analysis (2024) — https://www.sciencedirect.com/science/article/pii/S0149763424003981
[S33] von der Embse, Jester, Roy & Post (2018) — https://www.sciencedirect.com/science/article/abs/pii/S0165032717303683 ; university test-anxiety RCT meta-analysis: https://www.sciencedirect.com/science/article/abs/pii/S0887618518302032
[S34] "Sycophancy is an Educational Safety Risk: Why LLM Tutors Need Sycophancy Benchmarks" (May 2026) — https://arxiv.org/abs/2605.14604
[S35] Vennemeyer et al. (June 2026) "Sycophantic Praise: Evaluating Excessive Praise in Language Models" — https://arxiv.org/abs/2606.07441 ; CHI 2026 "Does Sycophancy Change Decisions?" — https://dl.acm.org/doi/10.1145/3772318.3790934
[S36] Brcic & Frljic (June 2026) "The Effortless Trap: Productive Struggle, AI, and the Illusion of Learning" — https://arxiv.org/abs/2606.26181
[S37] "AI-Mediated Feedback Improves Student Revisions: A Randomized Trial with FeedbackWriter" (2026) — https://arxiv.org/html/2602.16820v2
[S38] Socratic AI studies — https://www.mdpi.com/2227-7102/16/2/184 ; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12557457/ ; https://www.sciencedirect.com/science/article/pii/S1471595326000727
[S39] UK supervised AI tutor RCT (secondary report) — https://www.the74million.org/article/ai-tutors-with-a-little-human-help-offer-reliable-instruction-study-finds/
[S40] K12-KGraph (July 2026) — https://arxiv.org/abs/2605.09635
[S41] Study modes — https://techcrunch.com/2025/08/06/google-takes-on-chatgpts-study-mode-with-new-guided-learning-tool-in-gemini/ ; https://www.pearson.com/international-schools/international-schools-blog/2026/02/what-is-gemini_s-guided-learning-and-chatgpts-study-mode-.html ; https://glasp.co/articles/ai-study-modes-compared
[S42] Additional 2025–26 context: "Five Recent AI Tutoring Studies" — https://arjunpanickssery.substack.com/p/five-recent-ai-tutoring-studies ; "The Design Gap" review of 2025–26 RCTs — https://aireadyschool.com/blog/the-design-gap-what-forty-years-of-tutoring-research-and-a-wave-of-2025-26-randomized-trials-reveal-about-why-most-ai-tutors-fail-students-and-what-the-few-that-work-are-doing-differently ; hybrid human-AI tutoring quasi-experiments: https://arxiv.org/pdf/2312.11274
