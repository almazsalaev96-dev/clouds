# The Educational AI Landscape, September 2026: Competitors, Features, Pricing, Failures, White Space

**Lens:** competitive landscape for an AI chat product whose differentiation is *learning and exam success*.
**Method note (read first):** 44 distinct web searches were run (Sept 2026). Direct page fetches were heavily restricted by the sandbox egress proxy: only 3 primary pages could be fetched in full (Microsoft Education blog x2, Google Cloud LearnLM page, truncated). Every other fact below comes from search-result snippets of the cited page; the URL is given next to the fact. Items I could not verify online are marked **(prior knowledge, unverified)**. Where sources disagree, both figures are given.

---

## 0. Executive summary

1. **The big labs have already shipped "tutor mode" as a free feature.** ChatGPT Study Mode (July 2025) is on all plans, all models, with memory, and is the default for the Aug 2026 "ChatGPT for Teens" launch [1][2][3]. Gemini Guided Learning is free and built on LearnLM [4][5]. Claude has Learning Mode (Claude for Education, April 2025) with Canvas and Wiley integrations [8][9]. Microsoft's Study and Learn agent went GA in July 2026 at no extra cost for A1/A3/A5 licences [11][12]. A "Socratic chatbot that doesn't give answers" is therefore **table stakes, not a differentiator**.
2. **Free is the price the big labs set for students.** Google gives US college students a free year of AI Pro and students in 140+ other countries AI Plus (150+ countries, Aug 20–Dec 31 2026) [6][7]; OpenAI gives verified US K‑12 teachers ChatGPT for Teachers free through June 2028 (300k+ educators, 100+ organisations, 30 states) [13][14]; Gemini app and Gemini Notebook are free in every Workspace for Education edition [15].
3. **Where the labs are weak: exam-board specificity.** None of Study Mode, Guided Learning, Learning Mode or Study and Learn knows a *specific* syllabus code, its command words, its mark-scheme levels, or its examiner-report gripes. That is where every surviving edtech company lives (Save My Exams, PMT, Seneca, Up Learn, Medly, Knowunity, PhysicsWallah, ExamPal/Paperstack for Cambridge).
4. **Grounded, source-locked study (NotebookLM) is the other lab strength.** NotebookLM now generates flashcards, quizzes with cited answer keys, Learning Guide tutoring, audio/video overviews, mind maps, slide decks and infographics from uploaded sources; the April 2026 upgrade added topic summaries, next-step suggestions and regeneration [16][17][18]. Any "upload your notes" feature we build is competing with that, for free.
5. **The homework-answer business is dead.** Chegg: revenue down more than a third to $105.1M in Q2 (2025), subscribers -31% YoY to 3.2M (Q1 2025), 22% layoffs May 2025, 45% Oct 2025, stock ~$1, market cap from ~$12–14B to <$200M [19][20][21][22]. Root cause: students stopped paying for answers ChatGPT gives free, and Google AI Overviews killed the SEO funnel [21].
6. **Byju's is the cautionary tale on the other axis** — $22B peak valuation, insolvency (NCLT, BCCI's ₹158 crore claim, Glas Trust debt), defunct Oct 2024, "zero employees" by 2026 [23][24]. Aggressive sales and leverage, not AI, killed it.
7. **Quizlet self-harmed** by paywalling Learn/Test (Aug 2022), then discontinuing its Q‑Chat AI tutor (June 2025); its Trustpilot rating is low and the "free alternatives" SEO category is now full of competitors [25][26][27].
8. **Duolingo shows the AI-backlash pattern:** the April 2025 "AI-first" memo triggered mass streak-deletion pledges and ~400k lost TikTok followers, DAU growth dipped — yet revenue beat and the stock rose ~30% [28][29]. Lesson: users punish the *messaging* ("AI is a better teacher than humans"), not the AI features. Duolingo cut AI Video Call cost from $0.30 to <$0.01 per call by moving to open-source models and is pushing it from Max down to Super [30][31].
9. **What students actually pay for** (revealed preference): (a) exam-board-specific notes + past papers + AI marking (Save My Exams £4–12/mo, Medly £24.99/mo, Up Learn £120–150/subject with a grade guarantee) [32][33][34]; (b) "turn my stuff into flashcards/quizzes" with gamification (Gizmo 13M users, $22M Series A April 2026; Knowunity 20M users, €27M Series B) [35][36][37]; (c) cheap, safe, parent-approved tutoring (Khanmigo $4/mo, Common Sense 4 stars) [38][39]; (d) language practice with streaks (Duolingo Max >1.8M subs) [30]. They do **not** pay for generic homework answers any more.
10. **AI marking is now good enough for formative use but not for fine A-level boundaries.** Top models are "less than ±1 mark from teachers" on average; GPT‑o3 averaged 1.07 marks off with 0.96 correlation to teacher scores; one study had AI 0.22 marks from the human mean where humans differed by 0.55 [40]. Known failure modes: general LLMs are more generous than trained examiners and less consistent across similar essays; synthesis/argument essays at A level are "at the frontier" [40][41]. DfE gave teachers the green light for AI-assisted routine marking in June 2025 [41].
11. **Efficacy evidence exists and is strong when the tutor is pedagogically designed:** Harvard physics RCT (N=194, crossover) — students learned more than twice as much with the AI tutor in less time [42][43]; World Bank Nigeria RCT (Copilot/GPT‑4, 6 weeks) — 0.31 SD overall, 0.23 SD in English, equal to 1.5–2 years of business-as-usual schooling and among the most cost-effective interventions [44][45]; Google's Sierra Leone trial (1,763 students, ≥12 hours over 8 weeks of Guided Learning) — 50th→64th percentile in maths [4]; Learn Your Way (60 Chicago students) — ~11% higher retention after 3 days [46].
12. **Engagement, not capability, is the binding constraint.** Khan Academy's own Oct 2025–Apr 2026 tests found only ~15% of students in Khanmigo-enabled classrooms use it regularly [47]. Khanmigo grew from 68k users (2023‑24) to 1.4M (mid‑2025) largely via district deals, not pull [48]. Socratic friction ("won't just give the answer") is the most-cited student complaint about Study Mode and Khanmigo [49][50].
13. **Teacher tools consolidated fast:** MagicSchool (~6–8M educator sign-ups, 10k schools, 160 countries, $63M Series B 2026, 302 employees), Brisk (1M+ teachers, $15M), Diffit (text levelling, 70+ languages), SchoolAI [51][52][53]. Teachers save ~6 h/week per RAND; ~3 in 10 use AI weekly per Gallup 2025 [54]. Teacher endorsement flows to tools with **controls and visibility**, not to consumer chatbots.
14. **Cambridge International specifically is a long tail of tiny startups** — ExamPal (1,900+ past papers "graded against the actual mark scheme"), Paperstack (free, 150+ CAIE subjects, papers from 2000, photo-marking), MarkMaster AI, NeuraGeek, Cambridge Assistant (10k+ papers), AI Examiner, AskSia [55]. None has scale, design quality, or multi-model depth. This is an open beachhead.
15. **India is the largest exam-prep market and is going AI-native:** PhysicsWallah IPO'd Nov 2025 (₹3,480 crore; revenue ₹744cr→₹1,941cr→₹2,887cr FY23–25, still loss-making) with Alakh AI / AI Guru; Doubtnut (32M users) was sold to Allen for ~$10M; ProLearn raised ₹30cr pre-seed (Apr 2026) for JEE/NEET AI tutoring [56][57][58][59].
16. **Russia/CIS:** vc.ru rankings show ГоГПТ, Маша ГПТ, Umnik.AI and РешAI "displacing Решу ЕГЭ and Яндекс Репетитор", with ЕГЭ-style AI checking of essays [60]. Structured national exams (ЕГЭ, UNT) are ideal for mark-scheme-grounded AI.
17. **Sparx Maths is the model for "homework that proves learning":** RAND Europe/Cambridge found 1 h/week significantly improves grades; 15 min of practice = 83% more progress than no homework; 92% of students complete ≥30 min [61]. But schools now publish guidance because students complete Sparx with AI [62] — a huge signal that **verification of learning** is unsolved.
18. **Alpha School / 2hr Learning is the over-claim warning:** "2.6x faster", "99th percentile" from internal data; a 2026 404 Media investigation found AI-generated lesson plans that were "poorly constructed and often illogical" and unhappy students; tuition reported up to $65k/yr [63][64][65]. Do not market unverifiable multipliers.
19. **HEPI 2026 (UK undergrads, n=1,054):** 95% use AI, 94% for assessed work; usage rose 66%→92%→95% (2024→2026); text generation fell 64%→56%; only 36% feel encouraged by their institution and 38% are given tools [66]. Demand is universal; institutional provision lags — a B2B2C opening.
20. **Spaced repetition remains the most evidence-backed technique nobody in the chat category ships properly.** Anki (free, FSRS) is still the default; Mochi wins on simplicity; a 2026 meta-analysis cited SMD 0.78 for spaced repetition (secondary source; treat with caution) [67][68]. No big-lab chat product has a real scheduler.
21. **The "AI study app" tier is commoditised:** Turbolearn ($20/mo, $10 annual), StudyFetch ($19.99/mo, $96/yr), Mindgrasp ($5.99–10/mo), Gizmo (~$8.80/mo), Revisely (uploads→flashcards, Anki export) [69][70]. All do "upload → summary → flashcards → quiz". Differentiation there is impossible; differentiation on *exam outcome* is possible.
22. **Studocu pivoted (March 2026) to an AI lecture recorder** with "Give One, Get One" freemium; Course Hero (Learneo) is now "AI chat with PDF" over 70M resources [71]. Library businesses are becoming utilities.
23. **Nobody does well:** (i) a full loop of *diagnose → teach → practise on real past questions → mark to the real scheme → schedule the retry*; (ii) honest calibrated grade prediction; (iii) verification that the student, not the AI, did the work; (iv) multi-model routing for pedagogy vs. accuracy; (v) a calm, fast, beautiful interface (most exam-prep sites are PDF dumps or cluttered dashboards).
24. **Why a student would use us instead of ChatGPT/Gemini/Claude** must be answered with things the labs structurally won't do: exam-board-specific mark-scheme marking, examiner-report intelligence, real past-paper libraries, spaced retrieval scheduling, grade prediction with confidence intervals, teacher/parent visibility, and model-agnostic best-of-four answers. Ten defensible differentiators are in §7.

---

## 1. Big-lab study modes (table stakes)

| Product | Launched | Pedagogy / mechanics | Grounding | Pricing / access | Traction / evidence | Weaknesses observed |
|---|---|---|---|---|---|---|
| **ChatGPT Study Mode** (OpenAI) | 29 Jul 2025 [72][73] | Socratic questions, staged explanations, quizzes, responds to mistakes; uses memory when enabled; works with any model [1][2] | User uploads; no exam-board content | Free on all plans globally (as of Apr 2026) [2] | Default in ChatGPT for Teens (18 Aug 2026) with minor routing and parental controls [3] | Toggle-off is one click; educators warn it "works for college students, fails for the age group that needs it most" [49]; no teacher controls |
| **ChatGPT for Teachers / Edu / plugins** | 2025→Aug 2026 | Lesson/quiz/study-plan generation; K‑12 Educator, College Educator, College Student plugins [74] | Institution workspace | Free for verified US K‑12 teachers to June 2028 [13][14]; ChatGPT Edu licensed for HE | 300k+ educators, 100+ K‑12 orgs, 30 states [13]; National Academy for AI Instruction targets 400k teachers [14] | Supply-side (teachers), not student outcomes |
| **Gemini Guided Learning** (Google) | 2025 | LearnLM-based tutoring mode; "from answers to understanding"; videos, diagrams, quizzes [4][5] | Google search + uploads | Free; AI Pro free 1 yr for US students, AI Plus in 140+ countries, 150+ countries, 20 Aug–31 Dec 2026 [6][7] | Sierra Leone RCT: 1,763 students, ≥12 h / 8 weeks → +14 percentile points maths [4]; LearnLM preferred over GPT‑4o by 31% by experts [10] | Generic; no syllabus alignment; Google's own "Student Hub" (Study Notebooks, 3D sims, Deep Research via Gemini Live) is US-first [6] |
| **Learn Your Way** (Google Labs) | Sept 2025 | Rewrites textbook chapters to grade level and interests; mind maps, audio lessons, immersive text, embedded quizzes [46][75] | Uploaded textbook | Free experiment | 60 Chicago HS students; ~11% better retention at 3 days [46] | Experiment, not product; shows where Gemini is heading (adaptive textbooks) |
| **NotebookLM** | 2024→ | Source-locked Q&A; Sept 2025 flashcards, quizzes (MCQ/short answer) with cited answer keys, reports [16]; Apr 2026: topic summaries, next steps, regenerate; Learning Guide tutoring [17][18] | **Only** user sources — strongest grounding story | Free in all Workspace for Education editions; Pro/Ultra limits (limits not verifiable — blocked) | Widely adopted by teachers [76] | No scheduling, no mark schemes, no exam mode; source cap per notebook |
| **Claude Learning Mode / Claude for Education / Claude for Teachers** (Anthropic) | 2 Apr 2025 [77]; Teachers 2025–26 [9] | Socratic questioning, concept reinforcement, structured academic templates [8] | Canvas LMS integration; Wiley peer-reviewed library [8] | Campus licences; partners 2026 incl. USF, LSE, Northeastern, Dartmouth, Syracuse, Champlain, Northumbria, UVA, Pittsburgh; Stanford campus-wide from 30 Jun 2026 [8][78] | HE-only positioning | No K‑12 or exam-board play; no consumer student tier found |
| **Microsoft Study and Learn** (M365 Copilot) | May 2026 announce, Jul 2026 GA [11][12] | Four principles: adaptive scaffolding, productive struggle, active learning, application/transfer; flashcards, quizzes, matching, fill-in-blank; step-by-step with visuals; citations from student's own files | OneDrive/SharePoint class files | No extra cost with A1/A3/A5; ages 13–17 age-gated; off by default for K‑12, IT enables [11][12] | School-leader quote: "asking Copilot Chat better questions" [11] | US-English only at GA; no exam alignment; tied to M365 tenant |
| **xAI Grok** | Jun 2026 | Free Grok add-ins for Word/PowerPoint/Excel [79] | — | Free | — | No dedicated tutor mode found (search) |
| **Apple** | — | Nothing education-specific found in 2026 results beyond iOS 27 AI across apps [79] | — | — | — | — |

**Implication:** the four labs converge on the same five features (Socratic mode, quiz/flashcard generation from uploads, memory, citations to user sources, teen safety). We must match all five on day one and stop there; every hour spent re-inventing them is wasted.

---

## 2. Consumer study & tutoring apps

### 2.1 Feature matrix (all players)

Legend: ● full, ◐ partial, ○ none/unknown. "Board" = exam-board-specific alignment. "Papers" = real past-paper practice. "Mark" = AI marking against a mark scheme. "SRS" = spaced repetition scheduler. "Plan" = study planner. "Mastery" = per-topic mastery analytics. "T/P" = teacher/parent dashboard. "Own" = own/authored content or textbooks.

| Player | Tutor chat | Board | Papers | Mark | Flash-cards | SRS | Plan | Mastery | T/P | Own content | Model | Price | Platforms | Traction | Sources |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ChatGPT Study Mode | ● | ○ | ○ | ◐ (generic) | ◐ | ○ | ○ | ○ | ◐ (teens parental) | ○ | GPT (any) | Free–$20+ | Web/iOS/Android | Largest reach | [1][2][3] |
| Gemini Guided Learning | ● | ○ | ○ | ◐ | ● | ○ | ○ | ○ | ○ | ○ | Gemini/LearnLM | Free; Pro free for students | All | — | [4][6] |
| NotebookLM | ◐ (Learning Guide) | ○ | ○ | ○ | ● | ○ | ○ | ○ | ○ | user sources | Gemini | Free/Pro | Web/mobile | Broad edu use | [16][17][18] |
| Claude Learning Mode | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | Wiley (HE) | Claude | Campus licence | Web/apps | ~10 named universities + Stanford | [8][78] |
| MS Study and Learn | ● | ○ | ○ | ○ | ● | ○ | ○ | ○ | ◐ (IT admin) | class files | GPT via Copilot | Free w/ A1–A5 | M365 | GA Jul 2026 | [11][12] |
| Khanmigo | ● | ◐ (US CCSS; SAT/AP via Khan) | ◐ | ◐ (writing coach) | ○ | ○ | ◐ | ● (Khan mastery) | ● | Khan exercises/videos | GPT‑4 class (prior knowledge, unverified) | $4/mo, $44/yr; free for teachers | Web | 1.4M users mid‑2025; ~15% regular classroom use | [38][47][48] |
| Duolingo Max / Video Call | ● (Lily) | n/a | n/a | ◐ | ● | ● (implicit) | ● | ● | ◐ (Schools) | own | open-source models for video call | Max tier; Video Call → Super | iOS/Android/web | 38M DAU Q1‑26; Max >1.8M | [30][31] |
| Quizlet Plus | ○ (Q‑Chat killed Jun 2025) | ○ | ○ | ○ | ● | ◐ | ○ | ◐ | ◐ | user sets (300M+/500M claimed) | — | $7.99/mo or $35.99/yr (one source: $2.99/mo) | All | Declining goodwill | [25][26][27] |
| Brainly | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | community Q&A | — | Premium $23.99 | All | — | [80] |
| Photomath / Gauth | ● (math camera) | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | solver | — | $9.99 / Gauth $7.99 mo ($5 annual) | Mobile | Gauth 100M+ downloads | [80][81] |
| Chegg | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | textbook solutions | — | $19.95 | Web | 3.2M subs (Q1‑25), collapsing | [19][20][80] |
| Course Hero (Learneo) | ◐ (AI chat with PDF) | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | 70M docs | — | subscription | Web | — | [71] |
| Studocu | ◐ (AI lecture recorder) | ○ | ○ | ○ | ● | ○ | ○ | ○ | ○ | peer docs | — | freemium "Give One, Get One" | Web/mobile | — | [71] |
| Knowunity | ● (SchoolGPT) | ● (national curricula, 15 countries) | ◐ | ○ | ● | ○ | ○ | ◐ | ○ | 3M peer materials | — | freemium | Mobile | 20M users; 1 in 3 German students | [36][37] |
| Gizmo | ◐ | ○ | ○ | ○ | ● | ● | ◐ | ◐ | ○ | user uploads | — | ~$8.80/mo | Mobile/web | 13M users, 120 countries | [35][69] |
| Save My Exams | ◐ (Smart Tutor) | ● (UK boards, CIE, IB) | ● | ● (Smart Mark) | ● | ○ | ○ | ◐ | ○ | examiner-written notes | — | from £12/mo or £4/mo annual | Web | Trustpilot 4★/~1,900 | [32][82][83] |
| Physics & Maths Tutor | ○ | ● | ● | ○ | ● | ○ | ○ | ◐ (free account tracking) | ○ | PDFs, predicted papers | — | Free | Web | Very high UK usage (no number) | [84][85] |
| Seneca | ● (Amelia) | ● | ◐ | ● (AI-marked exam Qs) | ● | ◐ | ○ | ● | ● (schools) | 800+ courses | — | Premium tiers (price not verifiable) | Web/mobile | 15M students | [86][87] |
| Up Learn | ● | ● (A level boards) | ● | ● (2 examiner-marked papers) | ○ | ● (adaptive) | ● | ● | ● (parents) | own video courses | — | £119.99–£149.99/subject to exams; A*/A guarantee at 90% completion; 97% A*/A claim | Web | — | [34][88] |
| Cognito | ○ | ● (AQA, Edexcel, OCR, SQA) | ◐ | ○ | ◐ | ○ | ○ | ◐ | ○ | 400+ videos | — | Free | Web | — | [33] |
| Medly AI | ● | ● (GCSE, A level, IGCSE, IB, AP, SAT) | ● | ● (typed + handwritten) | ● | ◐ | ◐ | ● | ○ | own question bank; free "Medly Mocks" | — | Free tier; £24.99/mo or £180/yr | iOS/web | $8M seed Aug 2026 | [33][89] |
| Revisely | ○ | ◐ | ◐ | ◐ | ● | ◐ | ○ | ○ | ◐ | user uploads | — | tiered | Web | — | [70] |
| Sparx Maths | ○ | ● | ○ | auto | ○ | ● | ● (homework) | ● | ● | own | — | school licence | Web | 92% complete ≥30 min; RAND/Cambridge evidence | [61][62] |
| Anki / Mochi / RemNote | ○ | ○ | ○ | ○ | ● | ● (FSRS) | ○ | ◐ | ○ | user/shared decks | — | Free / ~$5 | All | Default SRS | [67][68] |
| Turbolearn / StudyFetch / Mindgrasp | ◐ | ○ | ○ | ○ | ● | ◐ | ○ | ○ | ○ | uploads | — | $10–20/mo | Web/mobile | Turbolearn raised $750k | [69] |
| MagicSchool / Brisk / Diffit / SchoolAI | teacher-side | ◐ | ○ | ● (rubric grading) | ● | ○ | ● | ◐ | ● | — | multi | free + school | Web/Chrome | MagicSchool 6–8M educators; Brisk 1M+ | [51][52][53] |
| PhysicsWallah (Alakh AI) | ● | ● (JEE/NEET/CBSE) | ● | ◐ | ○ | ○ | ● | ● | ● | own video/tests | — | low-cost courses | Mobile | 10M+ downloads; ₹2,887cr FY25 revenue | [56][57][90] |
| Doubtnut (Allen) | ● (photo doubt) | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ | solutions | — | freemium | Mobile | 32M users | [90] |
| Cambridge micro-startups (ExamPal, Paperstack, MarkMaster, NeuraGeek, Cambridge Assistant, AI Examiner) | ● | ● (CAIE) | ● (1,900–10,000+ papers) | ● (vs. mark scheme, photo) | ◐ | ○ | ○ | ◐ | ○ | past papers | GPT-class (unverified) | free–low | Web/mobile | tiny | [55] |
| ЕГЭ tools (ГоГПТ, Маша ГПТ, Umnik.AI, РешAI) | ● | ● (ЕГЭ/ОГЭ) | ● | ● (essay checking "as on the real exam") | ○ | ○ | ○ | ◐ | ○ | task banks | wrappers | freemium RUB | Web/Telegram | growing | [60] |
| Alpha School / 2hr Learning | ● (software) | US | ○ | ● | ○ | ● | ● | ● | ● | proprietary | — | up to ~$65k/yr tuition | school | claims unverified; investigated | [63][64][65] |

### 2.2 Player notes (specifics worth remembering)

**Khanmigo.** $4/mo or $44/yr; free to teachers; Common Sense Media 4 stars, above ChatGPT/Bard [38][39]. Strongest in math because it sits on Khan's exercise library; students "used to instant-answer tools like Photomath may find Khanmigo frustrating" [50]. Growth 68k → 1.4M users in ~18 months came via districts [48]; internal product tests (Oct 2025–Apr 2026) found only ~15% regular usage in enabled classrooms [47]. Occasional calculation errors were acknowledged early and mitigated by fine-tuning math handling [50]. **Takeaway:** content + mastery map + AI is the right stack; distribution via schools does not equal engagement.

**Duolingo.** Q1 2026 revenue $234M (+40% YoY), DAU 38M (from 31.4M); Q2 2026 DAU +23%; Max crossed 1.8M subscribers; Video Call cost dropped from $0.30 to <$0.01 via open-source models and is being extended from Max to Super [30][31]. Guidance Q3: bookings ~$307M (+9%), revenue $302M (+11%) — growth is decelerating [30]. The 2025 backlash: CEO "AI-first" LinkedIn memo + "AI is a better teacher than humans... teachers provide childcare" podcast line → streak-deletion protests, TikTok/Instagram wiped 17 May 2025, ~400k TikTok followers lost; DAU growth dipped but revenue beat [28][29][91]. **Takeaway:** the cheapest-possible-inference voice tutor is now a solved cost problem; never position AI as replacing teachers.

**Quizlet.** Plus $7.99/mo or $35.99/yr (a second source lists $2.99/mo ≈ $35/yr — disagreement; likely annual-equivalent) [25][27]. Learn and Test modes were paywalled 1 Aug 2022; Q‑Chat discontinued June 2025 with no announced return; Magic Notes converts notes to flashcards/outlines/tests [25][26][27]. Student press: "paywalls place priority on profits over pupils" [92]. Claims 300M+ (one source 500M) learners [25]. **Takeaway:** never paywall the *active-learning* core after giving it away; students remember.

**Brainly / Photomath / Gauth / Chegg price ladder:** Brainly Premium $23.99, Photomath Plus $9.99, Chegg $19.95, Gauth Plus $7.99/mo or $5 annual; Gauth (ByteDance) has 100M+ downloads and is "arguably the best free AI homework helper in 2026" [80][81]. **Takeaway:** the answer-engine tier is a race to free.

**Knowunity.** €27M Series B (June 2025, led by XAnge; total €45M); 20M users in 15 countries; 1 in 3 German students; reached 1 in 10 students in LatAm months after launch; SchoolGPT assistant over 3M peer-created materials "localised across markets and fine-tuned to national curricula" [36][37]. **Takeaway:** curriculum localisation + peer content is a real moat in non-English markets; they have no exam-marking depth.

**Gizmo.** $22M Series A (15 Apr 2026, Shine Capital; Ada, Seek, GSV, NFX); 13M users in 120+ countries; converts notes/PDFs/slides/online content into adaptive flashcards and quizzes with gamified and social features ("as addictive as TikTok"); ~$8.80/mo; expanding to US college [35][69][93]. **Takeaway:** social/gamified retrieval practice has demand; they lack curriculum and marking.

**Save My Exams.** Examiner-written notes, large past-paper library, Smart Mark AI marking; free account limited; paid from £12/mo or £4/mo billed annually [32][82]. Trustpilot ~4★ across ~1,900 reviews; complaints: annual price "almost doubled from $72 to $144", only one free practice question, gaps for some boards/subjects, can only practise by topic groups; marketing claim "students improve by 2.6 grades" [83]. PMT and Cognito both publish "Save My Exams alternative" pages [84][94]. **Takeaway:** the SME model (board-aligned notes + papers + marking) is the proven paid bundle in the UK; its UX and pricing are attackable.

**Physics & Maths Tutor.** Entirely free; nine subjects across GCSE/IGCSE/A level/IAL; past papers, mark schemes, examiner reports, topic questions, notes; 2026 free predicted papers; free account for progress tracking [84][85]. **Takeaway:** content is free everywhere; value must be in the loop around content.

**Seneca.** 15M students; Premium includes 800+ courses, AI-marked exam questions "that mirror real GCSE assessment formats", Amelia curriculum-trained assistant, Magic quiz assignments; school and international-school plans [86][87]. **Takeaway:** teacher-assignable AI-marked practice is the school wedge.

**Up Learn.** £119.99 (Core) / £149.99 (Master) per subject "Access Until Exams 2026", monthly option; A*/A or money back if ≥90% course completion; "97% A*/A success rate"; AI diagnostic + Oxbridge tutors + 2 examiner-marked papers [34][88]. **Takeaway:** outcome guarantees convert parents; completion gating protects the guarantor.

**Medly AI.** GCSE, A level, IGCSE, IB, AP, SAT; write typed or handwritten answers and get marked "like an examiner would: which points you hit, where the marks went"; free daily tier + free national "Medly Mocks"; £24.99/mo or £180/yr; $8M seed (Aug 2026) to expand US SAT, AP/ACT by end 2026 [33][89]. **Takeaway:** closest analogue to our thesis; small team, mobile-first; watch closely.

**Sparx Maths.** RAND Europe/Cambridge: 1 h/week significantly improves grades; 15 min/week → 83% more progress than no homework; 92% of students complete ≥30 min; all schools migrating to a new platform by Sept 2026 [61][95]. Schools now issue guidance because students complete Sparx with AI [62]. **Takeaway:** the "did the student actually learn?" verification gap is the next big product problem.

**MagicSchool / Brisk / Diffit / SchoolAI.** MagicSchool: $65.3M total, $63M Series B (2026), 6M+ educators (another source ~8M sign-ups), 10k+ schools, 160 countries, 302 employees; Brisk: 1M+ teachers, $15M (Mar 2025), lives inside Docs/Slides/Forms/YouTube/Canvas/Schoology; Diffit: leveled texts in 70+ languages; SchoolAI: student-facing with teacher control [51][52][53]. **Takeaway:** teachers adopt tools that live inside their workflow and give them control.

**Anki / Mochi / RemNote.** Anki remains default (free core, FSRS, largest shared-deck library, scales to 10k+ cards); Mochi for minimalists (first deck in ~10 min vs hours for Anki); RemNote for connected notes; AI now converts lectures to cards; 2026 meta-analysis SMD 0.78 favouring spaced repetition (cited via a vendor blog — verify) [67][68]. **Takeaway:** ship FSRS-class scheduling with zero setup and we beat both Anki's UX and Quizlet's algorithm.

**Studocu / Course Hero.** Studocu pivoted March 2026 to AI Notetaker + Lecture Recorder (transcripts, summaries, quizzes) with "Give One, Get One" freemium; Course Hero: 70M+ resources, AI chat with PDFs, textbook solutions [71]. **Takeaway:** document libraries are converging on the same commodity features.

**Alpha School / 2hr Learning.** Software teaches core subjects 1–2 h/day; "guides" not teachers; claims 2.6x faster learning, majority ~99th percentile, up to 6.5x for top performers — internal analyses; 404 Media (2026) found faulty, illogical AI lesson plans and unhappy students; WBUR coverage 23 Mar 2026; tuition cited up to $65k/yr [63][64][65]. **Takeaway:** unverifiable claims invite investigation.

**Squirrel AI / Synthesis Tutor.** Squirrel AI: large-scale adaptive tutoring centres in China (WEF, 2024 — older) [96]. Synthesis Tutor: no verifiable 2026 data retrieved. **(prior knowledge, unverified)**: Synthesis sells a K‑8 math tutor subscription in the US; Squirrel AI reports thousands of learning centres.

**India.** PhysicsWallah IPO 11–13 Nov 2025 (₹3,480 crore, band ₹103–109, listed 18 Nov); revenue ₹744cr (FY23) → ₹1,941cr (FY24) → ₹2,887cr (FY25); losses ₹84cr / ₹1,131cr / ₹243cr; Alakh AI with "AI Guru" real-time doubt solving (94% satisfaction claim), 10M+ downloads [56][57][90]. Doubtnut sold to Allen for ~$10M (2023), 32M users; Vedantu FY22 revenue ₹169cr, loss ₹696cr [58][90]. ProLearn (ex-Vedantu founder) ₹30cr pre-seed April 2026 for JEE/NEET/UPSC/CAT AI tutoring [59]. **Takeaway:** in India, content + community + price wins; AI is an add-on to a coaching brand.

**Russia (ЕГЭ).** vc.ru's 2026 ranking: ГоГПТ and Маша ГПТ (tutor mode with step-by-step), Umnik.AI ("Репетитор" assistant), РешAI (solve ЕГЭ/ОГЭ tasks, AI checking "as on the real exam", error analysis); framing: neural nets are displacing Решу ОГЭ / Яндекс Репетитор; ЕГЭ's fixed task structure makes AI prep "measurable" [60]. **Takeaway:** national exams with published task types and criteria are ideal for our mark-scheme engine.

**Cambridge International micro-startups.** ExamPal (knows Cambridge syllabi "section by section", 1,900+ past papers graded against the actual mark scheme), Paperstack (free; 150+ CAIE subjects; papers from 2000; photograph an answer, compare to official mark scheme), MarkMaster AI (point-by-point marking for IGCSE/AS), NeuraGeek (past papers + AI marking), Cambridge Assistant (10k+ papers with solutions, topicals), AI Examiner (side-by-side QP/MS with AI feedback), AskSia, Tutopiya [55]. **Takeaway:** the CAIE segment is validated but unconsolidated; none has design polish, multi-model quality, or a learning loop.

---

## 3. Why players failed or collapsed

| Company | What happened | Root causes | Lesson for us |
|---|---|---|---|
| **Chegg** | Subs 3.2M (‑31% YoY, Q1‑25); Q2 revenue $105.1M (‑>33%); layoffs 22% (May 2025) and 45% (Oct 2025); one tracker reports a Feb 2026 plan to cut ~80% of remaining staff (single source, unconfirmed); stock ~$1.07; market cap <$200M from $12–14B [19][20][21][22][97] | Sold *answers*; ChatGPT gave them free; Google AI Overviews cut the SEO funnel; Yahoo Finance argues it "was dying way before ChatGPT" (cheating stigma, churn) [98] | Never let the core value be "get the answer". Own the loop, not the answer. Don't depend on SEO. |
| **Byju's** | $22B peak → insolvency (NCLT admitted on BCCI's ₹158 crore claim; Glas Trust creditor fight; Supreme Court Oct 2024); defunct Oct 2024; zero employees by 2026; Aakash ownership still being split mid‑2026 [23][24][99] | Debt-fuelled acquisitions, aggressive sales, governance/audit failures **(prior knowledge, unverified for detail)** | Growth financed by pressure-selling parents destroys trust; keep pricing transparent and cancellable. |
| **Quizlet (partial)** | Paywalled Learn/Test (2022), killed Q‑Chat (Jun 2025), low Trustpilot, "alternatives" SEO ecosystem [25][26][27][92] | Took away free active-learning features; bolted-on AI that didn't fit | Free tier must remain genuinely useful for learning; AI must be native to the loop. |
| **Duolingo (reputational)** | "AI-first" memo → protests, ~400k TikTok followers lost, DAU growth dip [28][29][91] | Messaging that AI replaces humans | Message "AI + your teacher", never "instead of". |
| **Alpha School (credibility)** | 404 Media/WBUR investigations; claims unverified [63][64] | Marketing multipliers from internal data | Publish methodology; make claims falsifiable. |
| **Doubtnut / Vedantu** | Doubtnut sold ~$10M; Vedantu FY22 loss ₹696cr on ₹169cr revenue [58][90] | Free doubt-solving has no moat; live-class CAC too high | Unit economics of tutoring must be inference-cheap (Duolingo's $0.01 call). |
| **Socratic (Google), Q‑Chat, Cheggmate** | Discontinued or absorbed | Features, not products | A study product is a system (content + loop + analytics), not a chatbot skin. |

---

## 4. What students pay for, what teachers endorse, what nobody does well

**Students pay for** (evidence): exam-board-specific bundles (SME £4–12/mo, Medly £24.99/mo, Up Learn £120–150/subject) [32][33][34]; gamified retrieval from their own material (Gizmo 13M, Knowunity 20M) [35][36]; cheap safe tutoring (Khanmigo $4) [38]; language practice (Duolingo Max) [30]; and, decreasingly, answers (Chegg/Brainly collapse) [19][80]. HEPI 2026: 95% of UK undergrads use AI, only 38% are given tools by their institution [66] — so most are on free tiers or paying personally. **(prior knowledge, unverified)**: ChatGPT Plus is the most common personally-paid AI subscription among students; exact share not found.

**Teachers endorse:** tools with control and visibility (Sparx, Seneca school plans, MagicSchool/Brisk inside Google Workspace, Khanmigo teacher tools) [51][52][61][86]; Common Sense's 4‑star Khanmigo over 3‑star chatbots [39]; DfE-sanctioned AI-assisted marking with teacher in control [41]; ~3 in 10 teachers use AI weekly (Gallup 2025), saving ~6 h/week (RAND) [54]. Teachers distrust one-click-off Socratic modes [49].

**Nobody does well:**
1. A closed loop: diagnose → teach → practise real past questions → mark to the real scheme with examiner-report insight → schedule the retry (FSRS) → predict the grade. Each vendor does 2–3 pieces.
2. Marking calibrated to *level descriptors* with confidence, not a point estimate; A-level synthesis essays remain "at the frontier" [40].
3. Verifying learning (Sparx-with-AI cheating problem) [62].
4. Multi-model routing (pedagogy model vs. accuracy model vs. cheap model) — every product is single-vendor.
5. Interface quality: exam-prep sites are PDF lists; study apps are cluttered gamified dashboards; lab chatbots are generic.
6. Cross-curriculum generalisation with real specificity (Knowunity localises, but has no marking; SME is UK-deep, thin elsewhere).
7. Honest, testable efficacy claims (Alpha over-claims; Up Learn's 97% is selection-biased by 90% completion gating).

---

## 5. White-space opportunities (ranked)

| Rank | Opportunity | Why it is open | Evidence |
|---|---|---|---|
| 1 | **Mark-scheme-native marking + examiner-report intelligence across any board** (Cambridge 9609 first; then AQA/Edexcel/OCR, IB, AP, ЕГЭ, UNT, JEE) | Labs won't license/curate schemes; incumbents are single-region; accuracy is now sufficient for formative use | [40][41][55][60] |
| 2 | **The full learning loop with spaced retrieval of *marked* weaknesses** (FSRS over mistakes, not over flashcards) | No chat product has a scheduler; Anki has no tutor; Gizmo has no marking | [67][68][35] |
| 3 | **Calibrated grade prediction with uncertainty and "distance to next grade"** | Up Learn/SME make claims but don't expose per-student calibrated predictions; students crave it | [34][83] |
| 4 | **Cambridge International / international-school segment** (CAIE, IB, Edexcel IAL) | Fragmented micro-startups; SME thin outside UK boards; Knowunity not in CIE | [55][32][36] |
| 5 | **Best-of-four model routing** (DeepSeek for cost, Claude for pedagogy/marking nuance, GPT/Gemini for multimodal and speed) with visible provenance | Every competitor is single-model; Duolingo proved cost can be crushed | [30][31] |
| 6 | **Learning verification** — oral checks, "explain it back", process capture, teacher-visible confidence | Sparx cheating problem; HEPI 94% use AI on assessed work | [62][66] |
| 7 | **Calm, fast, beautiful UI** as a stated category standard | Chegg/PMT/SME are utilitarian; Gizmo/Duolingo are loud | observational |
| 8 | **Parent/teacher visibility for consumer accounts** (not just school licences) | Khanmigo has it for schools; consumer apps don't | [38][48] |
| 9 | **Textbook-grounded tutoring** (the founder's licensed textbook library) with page citations | Learn Your Way is an experiment; NotebookLM needs the student to have the book | [46][16] |
| 10 | **Non-English national exams** (ЕГЭ, UNT, JEE) with local-language UI | Wrappers dominate; no design/pedagogy leader | [60][59] |
| 11 | **Free tier that is genuinely useful** (daily practice + marking cap) to win the Quizlet/SME refugees | Quizlet/SME goodwill damage | [25][83] |
| 12 | **Teacher-assignable AI-marked past-paper sets** as a school wedge | Seneca/Sparx prove the model; neither is cross-board or multi-subject deep | [61][86] |

---

## 6. "Why would a student use this instead of ChatGPT / Gemini / Claude?" — 10 defensible differentiators

1. **It marks like *your* examiner.** Answers are marked against the actual mark scheme for the actual paper (e.g. Cambridge 9609 P2 levels-of-response), with the examiner-report warnings for that question type. ChatGPT marks against its imagination. Defensible: licensed papers + schemes + a curated rubric layer + calibration data we accumulate. [40][41][55]
2. **It knows the syllabus by code.** Every topic maps to a syllabus point, assessment objective and command word; explanations use the board's terminology. Labs are deliberately curriculum-agnostic. [37][32]
3. **It remembers what you got wrong and brings it back at the right time.** FSRS-style scheduling of *marked errors and weak AOs*, not just flashcards. No lab chat product schedules anything. [67][68]
4. **It predicts your grade, honestly.** A calibrated grade band with uncertainty, refreshed after each marked attempt, and "the three things that move you up a grade". Up Learn sells a guarantee; we sell the dashboard behind it. [34]
5. **It practises on real past papers, timed, in exam layout,** then marks, then teaches the gap — a mock-exam mode with a "why the examiner gave you 3/6" debrief. Labs have no paper library; Medly/Paperstack have no depth. [33][55]
6. **It uses the best model for each job.** Marking runs on the most reliable model, drill on the cheapest, diagrams on the best multimodal model; the student sees which. No competitor is multi-vendor. [30]
7. **Grounded in the textbook you actually study from,** with page-cited explanations — and it can show the exact figure/table. NotebookLM requires you to upload; Learn Your Way is a lab demo. [16][46]
8. **Cheating-resistant by design, so teachers let you use it.** Explain-back checks, process logs, teacher-visible "confidence vs. performance" — solves the Sparx-with-AI problem and the HEPI 94%-on-assessed-work anxiety. [62][66]
9. **A study plan that reschedules itself** around the real exam timetable (May/June, Oct/Nov series; ЕГЭ dates) and your marked performance. Labs have no planner; Up Learn has one for its own courses only. [34]
10. **Every pixel calmer and faster.** Instant answer streaming, no ads, no gamification noise, keyboard-first, exam-paper typography, dark mode that examiners would approve of. In a category of PDF dumps and confetti, design is a differentiator students notice within 30 seconds (Mochi's "first deck in 10 minutes vs. hours for Anki" is the precedent). [68]
11. (Bonus) **One product across GCSE → A level → IB → SAT → university**, so the student never migrates apps; incumbents are region- or exam-locked. [32][33][36]
12. (Bonus) **Parents and teachers can see progress without seeing chats** — privacy-preserving visibility that Khanmigo offers only to schools. [38]

---

## 7. Ten mistakes competitors made that we must not repeat

1. **Selling answers** (Chegg, Brainly, Course Hero) — free frontier models zero-price answers. [19][80]
2. **Paywalling the active-learning core after giving it away** (Quizlet Learn/Test). [26][92]
3. **Killing an AI feature students used without a replacement** (Q‑Chat). [25]
4. **Saying AI replaces teachers** (Duolingo) — brand damage even when revenue survives. [28][29]
5. **Unverifiable outcome claims** (Alpha "2.6x", "99th percentile"; Up Learn "97%" gated by 90% completion; SME "2.6 grades"). [63][34][83]
6. **Debt- and pressure-fuelled growth with opaque pricing** (Byju's). [23][24]
7. **Single-model dependence and high inference cost** (Duolingo's $0.30/call before optimisation; Vedantu's live-class losses). [30][58]
8. **Distribution without engagement** (Khanmigo: 1.4M users, ~15% regular use). [47][48]
9. **Socratic friction without an escape hatch or a reason** — students toggle Study Mode off; Khanmigo frustrates. Give the answer *and* the reasoning when the learner has earned it; explain why you're withholding when you do. [49][50]
10. **Static content dumps with no loop** (PMT, Cambridge Assistant) — free, loved, and unmonetisable; and **cluttered gamified UIs** (Gizmo/Duolingo style) that repel serious exam students. [84][55][35]
11. (Bonus) **SEO dependence** — Google AI Overviews destroyed Chegg's funnel; build direct, school and community channels. [21]
12. (Bonus) **Ignoring under-13/13–17 compliance** — the labs have age-gating, parental controls, minor routing; anything less blocks school adoption. [3][11]

---

## 8. Implications for our product (concrete, testable)

**Positioning & scope**
1. Match the five lab table-stakes on day one (Socratic mode, generate quiz/flashcards from uploads, memory, citations, teen safety) and spend zero marketing on them.
2. Lead every surface with the exam: "Cambridge 9609 Business — Paper 2 — May/June 2027" is the home screen object, not "New chat".
3. Ship curriculum packs as data, not code: `{board, syllabus code, year, papers, mark schemes, examiner reports, AO weights, command-word glossary, grade thresholds}`; a new exam is a new pack (target: onboard a new board in <2 weeks).

**Marking engine (the moat)**
4. Mark with the mark scheme in context plus level descriptors; return `{marks, level, evidence spans, missing points, examiner-report warnings, confidence}`. Never return a bare score.
5. Calibrate: hold out a set of human-marked scripts per paper; ship a paper's AI marking only when mean absolute error ≤1 mark on short answers and level agreement ≥80% on essays; display the calibration status to the user (Ofqual/DfE direction: transparency) [40][41].
6. Route marking to the strongest available model (ensemble two models on essays; escalate on disagreement > 1 level). Cost cap via cheap model for MCQ/short-answer.
7. Accept handwritten answers via photo (Medly, Paperstack already do) [33][55].
8. Correct for LLM generosity: prompt with "a trained examiner would…", include negative exemplars, and measure bias per model monthly [40].

**Learning loop**
9. Every marked mistake becomes a scheduled item (FSRS-style); the "Today" screen is generated by the scheduler, not by the user.
10. Grade prediction: Bayesian band with interval, updated per attempt; show "what moves you up one grade" as three concrete AO-specific actions; never show a single number without a range.
11. Mock mode: timed, exam-layout, paper-accurate mark allocation; debrief compares to grade thresholds for that series.
12. Adaptive planner tied to real exam-series dates and the student's marked performance; re-plans weekly; exports to calendar.

**Anti-cheating / trust**
13. "Explain it back" checkpoint after any full-solution reveal; store a learning-process log the student can share with a teacher.
14. Withhold-answer policy is explicit and escapable: default to hints, but a visible "show full solution" that triggers an explain-back and schedules a retry — avoid the Study-Mode-toggle-off failure [49].

**Grounding**
15. Textbook grounding with page citations and rendered figures; syllabus point ↔ textbook section ↔ past questions triple-indexed.
16. When the user uploads notes, run the NotebookLM feature set (flashcards, quiz with cited key, guide) — parity, not differentiation.

**Design**
17. Performance budget: first token < 800 ms, full short answer < 3 s; no layout shift; keyboard-first; offline-tolerant paper viewer.
18. No streaks/confetti by default; progress shown as mastery per syllabus point and grade band; optional light gamification behind a toggle.
19. Exam-paper typography and spacing for questions; monospaced for numeric working; diagrams rendered natively.

**Pricing & access**
20. Free tier that is honestly useful: daily N marked questions + unlimited explanations; paid tier priced under Save My Exams annual-equivalent (£4/mo) for one subject and under Medly (£24.99/mo) for all-subjects; per-subject "until exams" one-off like Up Learn (£120–150) for parents [32][33][34].
21. Transparent, one-click cancel; never raise annual price by 2x without grandfathering (SME complaint) [83].
22. School plan: teacher-assignable AI-marked sets + dashboards (Seneca/Sparx model) [61][86]; comply with 13–17 age-gating and parental controls from day one [3][11].

**Go-to-market**
23. Beachhead: Cambridge International (fragmented) and one national exam (ЕГЭ or UNT) where structure makes marking measurable [55][60]; then UK boards head-on vs SME/Medly.
24. Publish an efficacy methodology (pre-registered A/B on marked-score gains) before making any outcome claim; cite Kestin, World Bank Nigeria and Sierra Leone as the standard of evidence [42][44][4].
25. Never message "AI replaces tutors/teachers"; message "your examiner in your pocket, your teacher in the loop" [28].

---

## 9. Open questions / things we could not verify

- Exact Seneca Premium and Save My Exams 2026 price points (help centre and site blocked; £12/mo & £4/mo-annual for SME from a third party [32]).
- Khanmigo's current underlying model and the primary source of the "~15% regular use" figure [47] (secondary source only).
- Chegg's Feb 2026 "80% of remaining workforce" figure appears in one tracker [97] and conflicts in scale with earlier rounds; verify against SEC filings.
- Quizlet Plus price ($7.99/mo & $35.99/yr vs. "$2.99/mo") [25][27].
- Brainly Premium "$23.99" — monthly or annual unclear [80].
- NotebookLM free/Pro/Ultra limits in 2026 (support page blocked).
- Claude Learning Mode specifics for K‑12/consumer; Anthropic Education Report data (anthropic.com blocked).
- Whether xAI or Apple shipped any dedicated student tutor in 2026 (none found).
- Synthesis Tutor and Squirrel AI 2026 pricing/traction (no 2026 data retrieved).
- Studdy, Socratic (Google), Notiq, ExamQA current status (not found in results).
- Turbolearn's revenue (CB Insights lists "$0" reported — likely undisclosed) [69].
- The 2026 spaced-repetition meta-analysis (SMD 0.78) — cited only via a vendor blog [67].
- Real user-review corpora (Reddit threads, App Store reviews) could not be opened; complaints above are from secondary summaries.
- LearnLM's current pedagogical principle list and API availability (developers.google.com blocked; only the "31% preferred over GPT‑4o" claim retrievable) [10].

---

## Sources

1. https://openai.com/index/chatgpt-study-mode/
2. https://appscribed.com/chatgpt-study-mode/
3. https://explainx.ai/blog/chatgpt-for-teens-safety-study-mode-august-2026
4. https://blog.google/products-and-platforms/products/education/guided-learning/
5. https://www.techlearning.com/how-to/geminis-guided-learning-mode-from-google-ai-what-educators-need-to-know
6. https://blog.google/products-and-platforms/products/education/back-to-school-2026/
7. https://www.explainx.ai/blog/google-gemini-free-student-plan-ai-pro-plus-august-2026
8. https://www.educatorstechnology.com/2026/02/claude-for-education.html
9. https://www.anthropic.com/news/claude-for-teachers
10. https://cloud.google.com/solutions/learnlm
11. https://www.microsoft.com/en-us/education/blog/2026/07/study-and-learn-ai-built-for-learning-in-microsoft-365-copilot/ (fetched)
12. https://www.microsoft.com/en-us/education/blog/2026/05/study-and-learn-ai-built-for-your-student/ (fetched)
13. https://9to5mac.com/2026/08/26/free-chatgpt-for-teachers-expansion/
14. https://openai.com/index/chatgpt-for-teachers/
15. https://knowledge.workspace.google.com/admin/getting-started/editions/quickstart-guide-to-gemini-and-gemini-notebook-for-education
16. https://workspaceupdates.googleblog.com/2025/09/flashcards-quizzes-reports-notebook-lm-google-education.html
17. https://notebooklm-guide.com/notebooklm-quiz-flashcard-upgrade-2026-enhanced/
18. https://www.digitalocean.com/resources/articles/what-is-notebooklm
19. https://www.cnbc.com/2025/10/27/chegg-slashes-45percent-of-workforce-blames-new-realities-of-ai.html
20. https://www.techradar.com/pro/chegg-announces-move-to-reduce-workforce-by-22-percent-as-students-turn-to-ai
21. https://www.highereddive.com/news/chegg-layoffs-strategic-alternatives-google-ai/804192/
22. https://europeanbusinessmagazine.com/business/chegg-stock-collapse-chatgpt-ai-disruption-2026/
23. https://en.wikipedia.org/wiki/Byju's
24. https://techcrunch.com/2024/08/14/indias-top-court-clears-way-for-byjus-insolvency-proceedings
25. https://thetoolsverse.com/tools/quizlet-ai-flashcards-study-games
26. https://www.mintdeck.app/blog/quizlet-paywall-free-alternative
27. https://www.myengineeringbuddy.com/blog/quizlet-reviews-alternatives-pricing-offerings/
28. https://techcrunch.com/2025/08/07/the-backlash-against-duolingo-going-ai-first-didnt-even-matter/
29. https://www.customerexperiencedive.com/news/duolingo-ai-first-consumer-backlash-lessons/757133/
30. https://finance.biggo.com/news/US_DUOL_2026-08-05
31. https://www.vaasblock.com/ai/duolingo-revenue-ai-learning-q1-2026/
32. https://neurageek.com/learn/study/save-my-exams-alternatives-cambridge-2026
33. https://www.medlyai.com/uk/blog/best_gcse_revision_apps_2026
34. https://uplearn.co.uk/pricing
35. https://www.vestbee.com/insights/articles/gizmo-raises-22-m
36. https://tech.eu/2025/06/13/knowunity-raises-eur27m-to-bring-ai-tutor-to-1-billion-students/
37. https://www.eu-startups.com/2025/06/german-edtech-startup-knowunity-raises-e27-million-to-bring-ai-tutor-to-1-billion-students/
38. https://www.khanmigo.ai/learners
39. https://www.kidsaitools.com/en/articles/khanmigo-review-2026
40. https://marking.ai/blog/how-close-is-ai-to-human-marking-accuracy
41. https://marking.ai/blog/aligning-ai-marking-with-uk-curriculum-standards
42. https://www.nature.com/articles/s41598-025-97652-6
43. https://etcjournal.com/2025/11/10/review-of-kestin-et-al-s-june-2025-harvard-study-on-ai-tutoring/
44. https://documents.worldbank.org/en/publication/documents-reports/documentdetail/099548105192529324
45. https://voxdev.org/topic/education/how-ai-tutors-improved-learning-nigeria
46. https://research.google/blog/learn-your-way-reimagining-textbooks-with-generative-ai/
47. https://aitoolsbakery.com/blog/khanmigo-updates-2026/
48. https://tutorbase.com/statistics/edtech-ai
49. https://acagamic.medium.com/5-brutal-truths-about-ai-study-mode-that-educators-wont-tell-you-5fab804c5da2
50. https://www.kidsaitools.com/en/articles/khanmigo-review-parents-complete-2026
51. https://tracxn.com/d/companies/magicschool/__0LOioeIluO5KWsLD-7nbtWxu_Es-e11xO5QGuPrtJdg
52. https://valueaddvc.com/pulse/magicschool-ai-63m-series-b-edtech-2026
53. https://blog.aieducator.tools/posts/magicschool-alternatives-for-teachers
54. https://www.taskade.com/blog/ai-tools-teachers (cites Gallup 2025, RAND 2024)
55. https://www.tryexampal.com/ ; https://paperstack.cc/ ; https://www.markmasterai.com/ ; https://neurageek.com/ ; https://cambridgeassistant.com/ ; https://www.aiexaminer.co.uk/ ; https://www.asksia.ai/test-prep/igcse
56. https://www.chittorgarh.com/ipo/physicswallah-ipo/2266/
57. https://blog.liquide.life/physicswallah-ipo-review-analysis-2025/
58. https://www.dealstreetasia.com/stories/vedantu-physicswallah-acquisitions-311757
59. https://dealroom.co/news/130878-prolearn-raises-30-crore-pre-seed-to-build-an-ai-tutor-for-indias-k-12-a/
60. https://vc.ru/top_rating/2880283-luchshie-neuroseti-dlya-podgotovki-k-ege ; https://www.reshai.xyz/
61. https://sparxmaths.com/impact/
62. https://oxtedschool.org/wp-content/uploads/sites/4/2026/04/Sparx-Maths-Homework.pdf ; https://dominicsalles.substack.com/p/has-ai-killed-homework
63. https://www.wbur.org/hereandnow/2026/03/23/alpha-school-ai
64. https://theconversation.com/ai-schools-like-alpha-promise-efficiency-but-cant-replicate-the-messy-process-that-helps-kids-learn-282464
65. https://chinatechscope.com/alpha-school-redefining-education-with-ai/
66. https://www.hepi.ac.uk/reports/student-generative-ai-survey-2026/
67. https://chunks.app/blog/best-spaced-repetition-apps-2026
68. https://smartrecallai.com/blog/anki-vs-remnote-vs-mochi-vs-supermemo ; https://study-genius-ai.hatolabs.com/blog/mochi-vs-anki-2026
69. https://laxuai.com/blog/best-ai-study-tools-2026 ; https://www.cbinsights.com/company/turbolearn-ai
70. https://aichief.com/ai-education-tools/revisely/
71. https://www.aitools-directory.com/tools/studocu-ai-student-study-helper/ ; https://softwarefinder.com/lms/course-hero
72. https://www.axios.com/2025/07/29/openai-chatgpt-study-mode
73. https://techcrunch.com/2025/07/29/openai-launches-study-mode-in-chatgpt
74. https://www.techrepublic.com/article/news-openai-chatgpt-education-plugins/
75. https://blog.google/products-and-platforms/products/education/learn-your-way/
76. https://www.chrmbook.com/notebooklm-advanced-features-teachers/
77. https://techcrunch.com/2025/04/02/anthropic-launches-an-ai-chatbot-tier-for-colleges-and-universities
78. https://uit.stanford.edu/service/claude
79. https://cryptobriefing.com/xai-grok-microsoft-office-free-add-ins/
80. https://cybernews.com/ai-tools/best-ai-homework-helper-tools/
81. https://www.aichatdaily.com/tools/gauth
82. https://www.savemyexams.com/study-tools/smart-mark/
83. https://www.trustpilot.com/review/www.savemyexams.com
84. https://www.pmt.education/blog/students/save-my-exams-alternative-physics-maths-tutor/
85. https://www.pmt.education/resources/predicted-papers/
86. https://help.senecalearning.com/en/articles/12959827-premium-ai-for-schools
87. https://help.senecalearning.com/en/articles/2663301-what-is-premium
88. https://uplearn.co.uk/guarantee
89. https://www.vestbee.com/insights/articles/medly-ai-lands-8-m
90. https://easelearnai.in/blogs/blog-post-16-best-doubt-solving-apps-in-india-2026-honest-comparison
91. https://www.techtimes.com/articles/310192/20250501/duolingo-flooded-pledges-quit-app-following-decision-replace-contractors-ai-that-owl-dead.htm
92. https://www.ntdaily.com/opinion/quizlet-s-paywalls-place-priority-on-profits-over-pupils/article_848d54c6-4eca-11ef-b6bd-bba8eff900d3.html
93. https://www.prnewswire.com/news-releases/gizmo-raises-22-million-series-a-to-make-learning-addictive-for-13-million-learners-worldwide-302741943.html
94. https://cognito.org/blog/physics-and-maths-tutor-vs-save-my-exams
95. https://support.sparxmaths.com/en/articles/469962-sparx-maths-upgrade-announcement-faqs
96. https://www.weforum.org/stories/2024/07/ai-tutor-china-teaching-gaps/
97. https://www.aiexposure.org/analysis/company-ai-layoff-announcements-2026
98. https://finance.yahoo.com/markets/stocks/articles/chegg-dying-way-chatgpt-chatbots-144926172.html
99. https://techcrunch.com/2024/07/16/byjus-once-valued-at-22-billion-faces-insolvency-proceedings
100. https://www.hepi.ac.uk/wp-content/uploads/2026/03/HEPI-Report-199-Gen-AI-Survey-2026.pdf
101. https://www.edweek.org/technology/what-teachers-should-know-about-chatgpts-new-study-mode-feature/2025/07
102. https://news.umich.edu/u-m-launches-ai-powered-coursera-coach-for-interactive-instruction
