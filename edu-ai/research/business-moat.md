# Business Strategy & Moat: How an Education AI Becomes the Best Company in the Category

*Research lens: business strategy. Date: 6 September 2026. Method note: 16 web searches ran before the session-wide search budget was exhausted; direct page fetches were blocked by the network proxy for almost every domain except github.com / raw.githubusercontent.com / storage.googleapis.com and the Hugging Face papers index, so primary fetches were concentrated there (LLM API price data, 2024–2026 learning-science papers, the LearnLM report). Facts that could not be verified live are explicitly tagged "(prior knowledge, unverified)". Every other number carries its source URL. Where sources disagree, the disagreement is shown rather than averaged.*

---

## 0. Executive summary

1. **The category is large and consolidating around two poles**: "AI in education" is sized at only USD 7.5–11.4B in 2025/26 (sources disagree by ~50%) but growing at 26–45% CAGR, while private tutoring — the budget we actually replace — is USD 70–151B (again wide disagreement), Asia-Pacific-led (35.5%), majority online (55.3%). [S1–S8]
2. **Frontier labs have already taken the free "study mode" position**: ChatGPT Study Mode (July 2025, free on every plan), Gemini Guided Learning (Aug 2025) and Claude Learning Mode exist; Google relaunched a free year of AI Pro for US students and AI Plus for students in 140+ countries on 19 Aug 2026. Generic Socratic chat is no longer a differentiator; it is the floor. [S38–S40, S12]
3. **Consumer price anchors are now fixed**: ChatGPT Go USD 8, Plus USD 20 (USD 13–24 effective by country, Turkey cheapest), Pro USD 100/200; Claude Pro USD 20 (USD 17 annual, no student discount); Gemini AI Pro USD 19.99, AI Plus USD 4.99. Edtech specialists sit far below: Quizlet Plus USD 35.99/yr, Khanmigo USD 4/mo or USD 44/yr, Brainly Plus ~USD 39/yr, Photomath Plus USD 69.99/yr, Knowunity Pro ~USD 49.99/yr; Up Learn is the outlier at £49.99/month per subject with a grade guarantee. [S9–S27]
4. **The pricing implication**: a student-facing product must live in the USD 4–12/month band (or ~USD 40–100/yr) globally, with sub-USD-5 regional tiers, unless it credibly sells *outcomes* (Up Learn-style guarantee), in which case £30–50/month per subject is proven.
5. **Chegg is the cautionary tale of building on "answers"**: >500k subscribers lost since Nov 2022, ~USD 14B market value destroyed, 22% layoffs in May 2025 and a further 45% (388 staff) in Oct 2025, stock ~USD 1 by early 2026, with Google AI Overviews killing the top of funnel as well. Any product whose value is "the answer" is a Chegg. [S30–S33]
6. **Duolingo shows the trust risk of "AI-first" messaging**: April 2025 memo → 400k TikTok followers lost, US DAU down ~5% then ~5% again (Sensor Tower), Q2 2025 DAU growth 40% vs 60% historic; yet the company still crossed 50M DAU and its first USD 1B year. Lesson: users punish *replacing humans* rhetoric, not AI features per se. [S43–S46]
7. **Knowunity proves the European B2C playbook**: €27M Series B (June 2025), 20M users in 15 countries, 1 in 3 German school students, 380k student creators, 3M peer-created materials, "TikTok for schoolwork" positioning — community + UGC + AI on top, monetised at ~USD 49.99/yr. [S41–S42, S26–S27]
8. **Khanmigo proves B2B2C distribution works when price is ~USD 10/student/yr and teachers get it free**: 795 US districts, 770k US students, 2M global users by end of 2024-25; Microsoft's Azure donation made the teacher tier free. [S15–S16]
9. **Learning science is now a business argument, not just a pedagogical one**: a 2026 RCT (N=1,222) shows ~10 minutes of answer-giving AI reduces persistence and unassisted performance; the ETH MathTutorBench shows subject expertise does *not* translate into teaching ability; a 2026 study shows every off-the-shelf model, up to 72B, leaks the answer in the opening turn >96% of the time. A product that *measurably* avoids this is differentiated from ChatGPT in a way that cannot be closed by a prompt toggle. [S47, S50, S51]
10. **Google is the most dangerous incumbent**: LearnLM pedagogy is trained into Gemini (experts preferred it +31% over GPT-4o, +11% over Claude 3.5 Sonnet), Google owns Classroom/Workspace distribution, NotebookLM, YouTube and a USD 1B US education commitment (prior knowledge). OpenAI owns mindshare and the USD 8 price point. Anthropic owns university Canvas integrations. None owns exam-board-specific mark schemes, marking calibration data, or the local school relationship. [S48, S12, S39]
11. **Real moats (in order of durability)**: (a) proprietary *exam-specific* structured data — question banks tagged to syllabus points, mark schemes, examiner reports, and above all a *calibrated marking model* validated against real examiner marks; (b) longitudinal learner graphs that make the product better the longer you use it; (c) school/teacher distribution and trust (compliance, dashboards, safeguarding); (d) community/UGC flywheel (Knowunity); (e) brand as "the honest tutor". Imagined moats: a nicer chat UI, a prompt, access to the same APIs everyone has, "memory" alone.
12. **Licensed content is a moat only if it is *structured and exclusive-ish***: publishers (Hodder, CUP, OUP, Pearson) and exam boards license non-exclusively and are launching their own AI; the defensible layer is the *derived* data (item-level difficulty, misconception tags, marking calibration), which you own outright.
13. **Regulation timing favours a fast, compliant entrant**: the EU Digital Omnibus (Reg. (EU) 2026/1744, in force 27 July 2026) moved Annex III high-risk obligations — which cover AI used for learning-outcome evaluation, placement, admissions and exam monitoring — from 2 Aug 2026 to **2 Dec 2027**; Article 50 transparency (disclose you are an AI) has applied since 2 Aug 2026. Build the high-risk documentation now and it becomes a sales weapon against less careful rivals in 2027. [S34–S37]
14. **UK and US policy are permissive but demand safety proof**: DfE guidance and product-safety expectations (filtering, monitoring, data protection, age-appropriateness), JCQ rules on AI in coursework, a US executive order on AI education (Apr 2025) and 25+ state guidance documents (prior knowledge, unverified). Schools endorse tools that give teachers visibility and never do the assessed work for the student.
15. **Unit economics are excellent if routing is disciplined**: at current API prices a heavy user (≈600 turns/month) costs USD 0.34 (DeepSeek V4 Flash), USD 1.05 (GPT-5 mini), USD 1.29 (Gemini 2.5 Flash) or USD 9.90 (Claude Sonnet 4.5 at USD 3/15) before caching; a blended router lands at ~USD 1.5–3/heavy user, ~USD 0.5–1/median paying user → 75–90% gross margin at USD 8–12/month. Free tiers must be token-capped. [S53]
16. **Seasonality is a feature**: exam calendars (May/June and Oct/Nov for Cambridge; May for AP/IB; Jan/June for ЕГЭ; JEE Jan/Apr; UNT spring) create predictable acquisition spikes and churn cliffs; price by "access until exams" (Up Learn) and design re-activation for the next cohort/subject.
17. **Go-to-market sequence**: (1) Cambridge International A Level/IGCSE students worldwide via StudyTok/YouTube creators and Reddit/TSR communities; (2) UK GCSE/A Level (largest English-language exam-prep spend, Save My Exams/Seneca-trained market); (3) international schools in the Gulf, South & SE Asia, Kazakhstan/Central Asia (Cambridge-heavy, high WTP, English-medium); (4) national exams (ЕГЭ, UNT, JEE) as localised "curriculum packs" with local pricing; (5) universities via LMS.
18. **Positioning statement**: "ChatGPT knows everything; it does not know *your* exam, *your* examiner, or *you*. [Product] is built from the mark schemes up, grades like your examiner, and tracks what you actually know."
19. **Why a company and not a feature**: the value sits in assets the labs will not build — exam-board-level marking calibration, syllabus-tagged item banks for 100+ curricula, school-grade compliance and dashboards, local-language localisation, and a learner graph that a general assistant cannot ethically or practically maintain for minors.
20. **KPIs that matter**: pre/post gains on curriculum-aligned diagnostics, predicted-grade-vs-actual delta, marking-model QWK vs examiners, answer-leak rate in Socratic mode, W4/W12 retention and exam-season re-activation, teacher NPS and school renewal, safety incident rate, LLM cost per active learner. Vanity: total sign-ups, messages sent, minutes, streaks without learning.
21. **Biggest risk**: a frontier lab ships "upload your syllabus + past papers → tutor" as a free feature and Google wires it into Classroom. Answer: be the *verified* option (calibration numbers published, examiner-validated), be in schools first, and hold the community.
22. **Second-biggest risk**: content licensing costs and exam-board takedowns of past-paper redistribution. Answer: license or link rather than host; own the derived data; negotiate board partnerships early (Cambridge, Pearson Edexcel, AQA, OCR, IB, College Board).
23. **Naming**: avoid any name containing a board's mark ("Cambridge", "IGCSE", "SAT", "Praxis"); ten candidates are proposed below, all with unverified domain/trademark status.
24. **Three-year arc**: Y1 = the best Cambridge/UK exam tutor with published calibration; Y2 = 10+ curricula, school product, Knowunity-style community; Y3 = platform for any curriculum (creator/teacher-built packs), 1M+ paying learners, category-defining outcomes data.

---

## 1. Market size, growth and willingness to pay (Part A)

### 1.1 Market sizing — with methodology warnings

| Segment | Estimate | Source | Notes |
|---|---|---|---|
| AI in education, 2025 | USD 7.52B | GlobeNewswire/ResearchAndMarkets (Apr 2026) [S2] | → USD 10.6B 2026 → USD 42.48B 2030, ~45% CAGR |
| AI in education, 2025 | USD 8.3B (USD 11.4B in 2026) | ResearchAndMarkets [S3] | 42.83% CAGR 2025–2030 |
| AI in education, 2026 | USD 9.58B | Precedence Research [S1] | → USD 136.79B by 2035, 34.52% CAGR |
| AI in education | 25.9% CAGR 2026–2033 | Grand View Research [S4] | Lower growth assumption |
| Private tutoring, 2025 | USD 133.8B → USD 248.4B 2034 | IMARC (7.12% CAGR) [S5] | |
| Private tutoring, 2025 | USD 131.04B (USD 142.98B in 2026) | Business Research Co. [S6] | |
| Private tutoring, 2025 | USD 70.4B | Future Market Insights [S7] | Narrower definition |
| Private tutoring, 2025 | USD 151.3B, 8.4% CAGR to USD 266.1B (2032) | Stellar MR [S8] | APAC 35.5% share, North America 27.6%, online 55.3% |

**How to read this**: the "AI in education" numbers are vendor-revenue estimates from syndicated research houses with opaque methods; the 2x spread between the low and high tutoring numbers reflects whether informal/shadow tutoring is included. The strategically important fact is not the absolute number but the *ratio*: AI-in-education revenue is <10% of tutoring spend. The product's addressable budget is the tutoring budget (parents already pay), not the "AI software" budget.

**Where the spend is** (prior knowledge, unverified, but consistent with S8): East Asia (China, Korea, Japan), South Asia (India's JEE/NEET coaching), the Gulf's international-school families, UK (Sutton Trust surveys have repeatedly found roughly 30% of English pupils report private tuition at some point), Russian-speaking ЕГЭ preparation, Kazakhstan UNT preparation, Turkey's YKS dershane market.

### 1.2 Willingness to pay by segment

| Segment | What they pay today | Evidence | Implication |
|---|---|---|---|
| Students (self-pay, 15–19) | USD 3–10/month for apps; often nothing | Quizlet Plus USD 35.99/yr [S17]; Knowunity Pro ~USD 49.99/yr [S27]; Brainly Plus ~USD 39/yr [S24]; ChatGPT Go USD 8 [S9] | Price ≤ USD 8/month; annual ≤ USD 60; regional tiers |
| Parents (exam years) | £30–60/hour tutoring (UK, prior knowledge); Up Learn £49.99/month/subject [S19]; £477/subject/yr via school [S21] | Up Learn's pricing survives because it sells a grade guarantee | A "Parent plan" at £15–30/month with progress reports and a guarantee is viable |
| Schools / districts | ~USD 10/student/yr (Khanmigo enterprise) [S15]; Seneca Premium for Schools priced per school [S18] | Khanmigo reached 795 districts at this level [S16] | B2B must be ≤ USD 10–15/student/yr in K-12; higher in international schools |
| Tutors / tutoring centres | Pay for content and admin tools; Tutor CoPilot cost USD 20/tutor/yr in the RCT [S49] | Tutors are multipliers: 1 tutor ≈ 20–50 students | Tutor tier with student seats; revenue share |
| Universities | Site licences (Claude for Education, ChatGPT Edu — priced per seat, undisclosed) [S14] | CSU-style system deals exist (prior knowledge) | Later phase; LMS integration is the entry ticket |

### 1.3 Pricing benchmarks (September 2026)

| Product | Price | Free tier | Source |
|---|---|---|---|
| ChatGPT Go | USD 8/mo (US); launched India Aug 2025, worldwide 16 Jan 2026, 170+ countries | Yes | [S9], [S11] |
| ChatGPT Plus | USD 20 list; USD 13–24 effective by country (Turkey ~USD 13–15, India ~USD 18) | — | [S10] |
| ChatGPT Pro | USD 100 (5x Plus) / USD 200 (20x Plus); not regionally discounted | — | [S10], [S11] |
| Gemini AI Pro / AI Plus | USD 19.99 / USD 4.99; **free 12 months for verified students** (US: Pro; 140+ countries: Plus), relaunched 19 Aug 2026, redeem by 31 Dec 2026, SheerID verification | Yes | [S12], [S13] |
| Claude Pro | USD 20/mo or USD 17/mo annual; **no student discount**; Claude for Education sold to universities | Yes (free tier now includes search, memory, files) | [S14] |
| Khanmigo | USD 4/mo or USD 44/yr learners; free for US teachers; districts ~USD 10/student/yr | Yes (Khan Academy) | [S15] |
| Quizlet Plus | USD 7.99/mo or USD 35.99/yr; Plus Unlimited USD 44.99/yr; 7-day trial | Yes | [S17] |
| Save My Exams | Freemium; 7-day trial; scholarship programme; exact price not retrievable (fetch blocked) | Yes | [S28], [S29] |
| Seneca Premium | 3 packages × monthly/seasonal(4-month)/annual; exact prices not retrievable | Yes (core free) | [S18] |
| Up Learn | From £49.99/month rolling per subject, or "Access Until Exams"; £477/subject/yr via schools | Trial | [S19], [S20], [S21] |
| Duolingo Super / Max | USD 12.99/mo or 95.99/yr; Max USD 29.99/mo or 167.99/yr; Family USD 119.99/yr; "Explain My Answer" made free early 2026 | Yes | [S22], [S23] |
| Brainly Plus | ~USD 10/mo or ~USD 39/yr | Yes | [S24] |
| Photomath Plus | USD 9.99/mo or 69.99/yr | Yes | [S25] |
| Knowunity Pro | ~USD 49.99/yr IAP; "from USD 7/mo" | Yes (UGC free) | [S26], [S27] |
| Chegg Study | Historically ~USD 15–20/mo (prior knowledge) | Limited | [S30] |

**Patterns**
- **Two price ladders**: general AI (USD 8 / 20 / 100–200) and edtech (USD 3–7/month effective). A student product priced like ChatGPT Plus must be *better than ChatGPT Plus for exams* by a margin students can feel in a week, or it must be cheaper than Go.
- **Regional pricing is normal** (OpenAI, Google, Knowunity's country-specific IAPs). Turkey, India, Pakistan, Nigeria, Kazakhstan, Russia need local price points of USD 2–5 or the free tier becomes the product.
- **Free-for-students is the labs' wedge**: Google gives a year free; OpenAI made Study Mode free on every plan; Anthropic gives nothing to individuals but everything to universities. A start-up cannot out-subsidise them; it must out-*specialise* them.
- **Annual and "until exams" plans** win on retention economics: the exam date is the natural contract end.

---

## 2. Go-to-market (Part B)

### 2.1 B2C channels

**Creator-led (StudyTok / YouTube)** — Knowunity's growth was explicitly "TikTok for schoolwork" [S42]; Duolingo's brand was built on the same channel and lost 400k followers in weeks when trust broke [S46]. Tactics that fit our product: (1) creator "grade my essay live" formats using our marking (visible, verifiable value); (2) subject-specific micro-creators for Cambridge Business 9609, Economics 9708, Biology 9700 etc. (audiences are small but purchase intent is high); (3) "predicted-grade reveal" shareables; (4) creator revenue share tied to *retained* subscribers, not installs.

**Communities** — Reddit (r/6thForm, r/GCSE, r/alevel, r/IBO, r/APStudents, r/JEENEETards, r/Sat), The Student Room, Discord study servers, Telegram (ЕГЭ/UNT). These communities are hostile to spam and friendly to genuinely useful free tools (free past-paper finder, free mark-scheme explainer). Rule: give the community a tool that is free forever and obviously useful; sell the personalised layer.

**Referral loops that fit education** — study-group invites (shared question sets, class leaderboards without shaming), "send your teacher a report" (teacher gets a free dashboard → school lead), parent progress emails (parent becomes payer). Knowunity's 380k creators uploading 3M materials [S41] is the model of a contribution loop; our version is *student-written model answers marked by the AI and by peers*.

**Seasonality** — Cambridge sessions: June (papers May–June, results mid-August) and November (papers Oct–Nov, results January); UK GCSE/A Level: May–June, results August; IB: May (and Nov); AP: May; SAT: ~7 dates/yr; ЕГЭ: late May–June; UNT: spring/summer windows; JEE Main: January and April, Advanced May (dates are prior knowledge, unverified for 2026/27). Design: a "days-to-exam" spine in the product; acquisition budget concentrated Jan–Apr and Sep–Oct; win-back for the next session or next qualification (IGCSE → A Level → university).

### 2.2 B2B2C

| Channel | Why | What they need | Reference points |
|---|---|---|---|
| Schools (state/international) | Distribution, trust, lower CAC, sticky | Teacher dashboards, safeguarding, data-processing agreements, SSO (Google/Microsoft/Wonde/Clever), curriculum alignment, evidence | Khanmigo 795 districts at ~USD 10/student/yr [S15–S16]; Seneca and Up Learn sell school plans [S18, S21] |
| Tutoring centres | Multiplier; already charging parents | Tutor co-pilot, marking at scale, homework setting, parent reports | Tutor CoPilot RCT: +4pp mastery overall, +9pp for weaker tutors, USD 20/tutor/yr [S49] |
| Exam boards | Legitimacy, content, calibration data | Integrity guarantees, no leak of live papers, revenue share | No verified 2026 deal found; Cambridge, Pearson and AQA all publish AI positions (prior knowledge) |
| Publishers (Hodder, CUP, OUP, Pearson) | Licensed textbooks, brand | Licensing fees or revenue share; they are also building their own AI study tools (Pearson has AI study tools inside eTextbooks — prior knowledge, unverified) | Treat as non-exclusive content suppliers, not moats |
| Governments / ministries | Whole-country deals (Estonia's AI Leap with OpenAI/Anthropic; Kazakhstan's NIS network with Cambridge — prior knowledge, unverified) | Localisation, sovereignty, procurement | Cambridge Partnership for Education is the door to ministries in Central Asia and the Gulf (prior knowledge) |

### 2.3 International sequencing

1. **UK + Cambridge International (English-medium, worldwide)** — one content build serves the UK and ~10,000 Cambridge schools in 160 countries (prior knowledge). The founder's library (Business 9609 etc.) is the seed.
2. **International schools: Gulf (UAE, Saudi, Qatar), Singapore/Malaysia, Hong Kong, Kazakhstan, Egypt, Pakistan, Nigeria, Kenya** — high WTP families on Cambridge/IB/Edexcel; English-medium; payment via parents. Regional pricing needed for Pakistan, Nigeria, Egypt, Kenya.
3. **India** — JEE/NEET/CBSE; huge but price-sensitive and dominated by domestic players (Physics Wallah listed in Nov 2025 — prior knowledge, unverified). Enter via Cambridge/IB international schools first, then CBSE Class 10/12 with a ₹ price near ChatGPT Go's ₹399 (prior knowledge).
4. **Russian-speaking & Central Asia** — ЕГЭ/ОГЭ and Kazakhstan UNT: strong exam culture, Telegram-native, local LLM preference and data-residency issues; DeepSeek/open models may be needed for cost and access. Kazakhstan is a natural early market given the founder's likely network and Cambridge/NIS presence.
5. **Turkey (YKS), SE Asia (Vietnam, Indonesia, Thailand)** — large, price-sensitive, national exams; localisation packs later.

### 2.4 Partnerships and content marketing

- **Teacher-facing free tools** (mark-scheme explainer, question generator aligned to syllabus codes) are the cheapest B2B lead engine; Khanmigo's free teacher tier drove district adoption [S15–S16].
- **Publish the calibration study**: "our marker agrees with Cambridge examiners at QWK x on 9609 Paper 2" is a marketing asset no lab has.
- **Examiner-authored content**: contract ex-examiners to write model answers and "why this scored 6/8" commentary; that is exactly the content Save My Exams built its franchise on (prior knowledge) and it converts.

---

## 3. Moats: real vs imagined (Part C)

### 3.1 Scorecard

| Candidate moat | Real? | Why | How to build it |
|---|---|---|---|
| Licensed textbooks & past papers | **Partial** | Non-exclusive; boards/publishers license to many and launch their own AI; past papers are semi-public. | Use as *input*; license or deep-link; never rely on exclusivity. |
| Structured, syllabus-tagged item bank (question ↔ syllabus point ↔ mark scheme ↔ examiner comment ↔ difficulty ↔ misconception) | **Yes** | Expensive, slow, requires subject experts; compounds across 100+ curricula; frontier labs have no incentive to do it per board. | Data pipeline + examiner QA; every generated question is tagged and gets item statistics from real use. |
| Marking-model calibration data | **Yes — the strongest** | Requires paired (student answer, examiner mark) data at scale per paper; improves with volume; auditable. A "grades like your examiner" claim is a measurable, publishable advantage. | Collect consented marked scripts; run examiner panels; publish QWK per paper; retrain per session. |
| Learning-outcome data & personalisation graph | **Yes, slowly** | Only valuable after months of use per learner and with outcome labels (actual grades). Switching cost rises with time. | Knowledge-state model per syllabus point; import results; show predicted grade with confidence. |
| Teacher/parent trust & compliance | **Yes** | Schools buy trust; the EU high-risk regime (Dec 2027) and DfE/JCQ expectations raise the bar for everyone else. | Safety-by-design, DPAs, age gates, dashboards, published policies; compliance folder ready for procurement. |
| Community / UGC | **Yes (Knowunity proves it)** | 380k creators and 3M materials are hard to replicate [S41]. | Student model answers + peer marking + creator revenue share. |
| Switching costs (notes, progress, memory) | **Moderate** | Memory alone is cheap to copy; progress *linked to a syllabus map and predicted grades* is not. | Make the learner graph exportable (trust) but uniquely useful inside. |
| School distribution | **Yes** | Multi-year contracts, SSO, teacher habit. | Land with free teacher tools; expand with paid student seats. |
| Brand | **Yes, if it means "honest tutor"** | Duolingo shows brand can be a liability if AI is framed as replacing people [S44–S46]. | Voice: warm, rigorous, never sycophantic; "we will not do your coursework". |
| Beautiful/fast UI | **No (necessary, not sufficient)** | Copied in a quarter. | Do it anyway; it drives retention, not defensibility. |
| Access to the same four LLM APIs | **No** | Everyone has it. | Router + evals are craft, not moat. |

### 3.2 Where the frontier labs are structurally stronger — and how to stay ahead

**Google**: LearnLM pedagogy is inside Gemini and experts preferred it +31% over GPT-4o, +11% over Claude 3.5 Sonnet and +13% over Gemini 1.5 Pro in role-played learning scenarios [S48]; the LearnLM report frames pedagogy as "pedagogical instruction following" and explicitly says prompting, not per-app fine-tuning, will remain how edtech specifies behaviour [S48, S54]. Google owns Classroom, Workspace for Education, YouTube, NotebookLM, and gives students a year free [S12]. **Counter**: Google will not build board-level marking calibration or take on the safeguarding liability of a minors' learning record per school; we integrate with Classroom rather than fight it.

**OpenAI**: mindshare, USD 8 Go tier in 170+ countries [S9], Study Mode free everywhere [S38], ChatGPT Edu and country deals. **Counter**: ChatGPT's incentive is engagement and breadth; the 2026 persistence RCT is a direct critique of its default behaviour [S47]. We compete on *verified learning*, not features.

**Anthropic**: Learning Mode, Claude for Education with university LMS integrations [S14]; strongest on refusal-to-hand-over-answers per reviewers [S40]. **Counter**: no K-12/exam focus, no student discount, US-university-centric.

**DeepSeek / open weights**: the cost floor (V4 Flash USD 0.14/0.28 per M tokens [S53]) and the option for data-residency markets. We use them; they do not compete for the student relationship.

**The lasting asymmetry**: labs optimise one model for everyone; an exam-success company optimises a *system* (content + marking + learner model + school workflow + community) for a specific outcome that can be audited against a public result (the grade). MathTutorBench's finding that pedagogy and subject expertise trade off, with tutoring "specialisation" resolving it [S51], and HeuristicEdu's finding that answer-leak behaviour is "behavioral rather than capability-driven" and not fixed by scale [S50], are the scientific basis for that asymmetry.

---

## 4. Lessons from failures, shocks and durable companies (Part D)

### 4.1 Failures and shocks

| Case | What happened | Lesson for us |
|---|---|---|
| **Chegg** | Lost >500k subscribers since Nov 2022; ~USD 14B value destroyed; 22% layoffs May 2025, 45% (388 staff) Oct 2025; stock ~USD 1 early 2026; Google AI Overviews removed search discovery [S30–S33] | Do not sell *answers*; do not depend on Google search; build owned distribution (schools, community, app). |
| **Byju's** (prior knowledge, unverified) | Peak ~USD 22B valuation (2022) → insolvency proceedings in India (2024) after a USD 1.2B term-loan default, mis-selling complaints, governance failures and debt-funded acquisitions (Aakash, WhiteHat Jr) | Never sell to parents with pressure tactics; no debt-fuelled M&A; unit economics before scale; governance from day one. |
| **2U** (prior knowledge, unverified) | Chapter 11 in July 2024 under ~USD 1B debt after paying USD 800M for edX (2021); OPM revenue-share model collapsed as universities insourced | Do not build a business whose margin is another institution's discretionary spend; own the learner relationship. |
| **Coursera** (prior knowledge, unverified) | Slowing growth; announced an all-stock merger with Udemy in December 2025 | Generic skills content commoditises; credentials and outcomes are what remain. |
| **Pearson** (prior knowledge, unverified) | Managed decline of print; now embedding AI study tools in eTextbooks and licensing content to AI firms | Publishers will be suppliers and partial competitors; move faster on product than they can. |
| **Duolingo** | "AI-first" memo (Apr 2025) → boycott threats, 400k TikTok followers lost, US DAU -5% and -5% again, Q2 DAU growth 40% vs 60% historic; still 50M DAU and first USD 1B year [S43–S46] | Never message "AI replaces teachers/tutors"; message "AI makes your teacher and you better". |
| **Khanmigo** | Fastest edtech adoption jump in 20 years per Khan's CLO: 795 districts, 770k US students, 2M users by end 2024-25 [S16]; but public efficacy evidence remains thin (the "23% retention improvement" claim in secondary blogs is from a 12-student, 8-week test [S16] and should not be cited as evidence) | Adoption ≠ learning. Publish real efficacy data; it is an open field. |

### 4.2 What durable edtech looks like

- **Anki / spaced repetition**: 20 years of durability from an algorithm and a user-owned deck corpus; FSRS-class schedulers are now the baseline and LLM-enhanced schedulers show only marginal gains (LECTOR 90.2% vs 88.4% success in simulation) [S52]. Lesson: own the learner's *practice history*; make it portable enough to trust and useful enough to stay.
- **Quizlet**: UGC sets + freemium at USD 35.99/yr [S17]; durable because the content is the users'.
- **Duolingo**: habit loops, A/B culture, USD 1B revenue, 50M DAU [S43]; durable because of daily habit and gamified progress, fragile on brand trust.
- **Khan Academy**: non-profit trust + free core + district sales for AI [S15–S16].
- **Kumon** (prior knowledge): 60+ years on daily worksheets, mastery progression and parent-visible progress — the analogue of a learner graph.
- **Sparx Maths** (prior knowledge, unverified): personalised homework used by thousands of UK schools; sold on teacher time saved and independent evaluation; the template for our school product.
- **Save My Exams** (prior knowledge, unverified): examiner-written revision notes, mark-scheme-aligned questions, freemium; the incumbent for Cambridge/UK revision — proof that *exam-specific* content beats generic content even before AI.

Common thread: durable products own either the learner's accumulated work (decks, sets, streaks, progress) or the institution's workflow — never just a model.

---

## 5. Regulation and trust (Part E)

### 5.1 EU AI Act

- **Digital Omnibus on AI — Regulation (EU) 2026/1744** published in the Official Journal 24 July 2026, in force 27 July 2026 [S35].
- **Annex III standalone high-risk obligations deferred from 2 Aug 2026 to 2 Dec 2027**; Annex I (product-embedded) to 2 Aug 2028 [S34–S35, S37].
- Education uses classed as high-risk under Annex III: determining access/admission, **evaluating learning outcomes** (including where used to steer the learning process), assessing appropriate level of education, and monitoring prohibited behaviour during tests [S36]. An AI marker that produces grades used by a school, or a placement/diagnostic that steers a learner, will very likely fall in scope when deployed to EU institutions; a purely self-study grader for practice is a grey area — get counsel, but build as if in scope.
- **Article 50 transparency** (tell users they are talking to an AI; label synthetic content) has applied since 2 Aug 2026 [S36].
- Obligations for high-risk providers (risk management system, data governance, technical documentation, logging, human oversight, accuracy/robustness, conformity assessment, registration) [S37]. Building the documentation now costs little and becomes a procurement advantage in 2027.

### 5.2 UK (prior knowledge unless stated — gov.uk fetch was blocked)

- DfE policy paper "Generative AI in education" (updated 2025) is permissive: schools may use gen-AI for planning, marking support and feedback, with data-protection and safeguarding conditions; **DfE "Generative AI: product safety expectations"** (2025) set expectations for filtering, monitoring, age-appropriate design, testing, and data protection for products used by under-18s.
- JCQ "AI Use in Assessments" guidance governs coursework/NEA: AI-produced work submitted as one's own is malpractice; the tool must not write assessed work.
- Online Safety Act duties and the Age-Appropriate Design Code (ICO) apply to any service likely to be used by children.
- Ofqual/exam boards prohibit sharing live papers; past papers are copyright of the boards (Cambridge permits educational use with conditions — verify).

### 5.3 United States (prior knowledge, unverified)

- Executive order "Advancing Artificial Intelligence Education for American Youth" (April 2025); Department of Education guidance (July 2025) on using federal funds for AI; 25–30 states had K-12 AI guidance by mid-2025 (AI for Education tracker). FERPA, COPPA (under-13), state student-privacy laws (e.g., California SOPIPA, Illinois SOPPA) and district vendor agreements (Student Data Privacy Consortium NDPA) are the practical gate.

### 5.4 Universities

- Policy has moved from bans to "disclose and cite" and course-level AI policies; integrity concerns centre on assessed work, not study. Products that log a *learning trail* (drafts, attempts, feedback) give students a way to evidence authorship — a feature, not just compliance.

### 5.5 What it takes to be the tool schools endorse rather than ban

1. Teacher visibility (dashboards, per-student logs) and teacher control (turn features on/off per class).
2. Refusal to produce submittable coursework; Socratic default for homework; explicit "practice vs assessed" modes.
3. Safeguarding: content filtering, self-harm and abuse escalation routes, age gating, no ads, no social DMs for minors.
4. Data: DPA templates, UK/EU data residency, no training on pupil data without explicit school consent, deletion on request.
5. Evidence: published calibration and learning-gain studies; independent evaluation (EEF-style) within 24 months.
6. Article 50 compliance by default and an Annex III technical file ready before Dec 2027.

---

## 6. Positioning, brand, names, KPIs, unit economics, strategy (Part F)

### 6.1 Why better than ChatGPT / Gemini / Claude for a student

- **They know everything; we know your exam.** Every answer is grounded in the syllabus code, the mark scheme and examiner reports for *your* board and session — not an average of the internet.
- **We grade like your examiner, and we prove it.** Published agreement with real examiner marks per paper; predicted grades with confidence intervals. No general assistant will publish this.
- **We refuse to make you worse.** Default behaviour is scaffolded (hints → worked steps → model answer), because handing over answers measurably reduces persistence and unassisted performance [S47]. Study modes in general assistants are optional toggles a stressed student switches off; ours is the product.
- **We remember what you know, not what you said.** A knowledge state per syllabus point, decaying over time and driving spaced retrieval — not a chat log.
- **Your teacher and parent can see it (with your consent).** Which is why schools allow it.
- **It is calm, fast and beautiful** — table stakes we still have to win on.

### 6.2 Why a company, not a feature

A lab's feature is: a model + a prompt + the user's uploads. Our company is: structured content for 100+ curricula, marking calibration data per paper, a learner graph with outcome labels, school compliance and distribution, local-language and local-exam packs, a creator community and examiner network. Each asset is slow to build, compounding and auditable against public results. The labs' own research says pedagogy should be *specified by developers/teachers on top of models* [S48]; we are the developer that specifies it best for exams.

### 6.3 Brand principles and voice

1. **Honest tutor, not oracle**: admits uncertainty, cites the mark scheme, never sycophantic.
2. **Calm**: no streak-shaming, no dark patterns, no countdown panic; "days to exam" is information, not pressure.
3. **Rigorous**: examiner language ("AO2 application", "evaluation not present") explained in plain words.
4. **On the student's side**: the product's stated job is the student's grade and understanding, not minutes in app.
5. **Never "replaces teachers"** — the Duolingo lesson [S44–S46]. Teachers are named users and beneficiaries.
6. **Visually quiet**: one accent colour, generous whitespace, instant response, keyboard-first; design as a trust signal.

### 6.4 Ten candidate names (domain and trademark status **unverified** — run UKIPO/EUIPO/USPTO/WIPO searches and check .com/.ai/.app before use; avoid any string containing a board's mark such as Cambridge, IGCSE, SAT, AP, Praxis, GCSE)

| Name | Rationale | Caveat |
|---|---|---|
| Marksmith | "Mark schemes" + craftsmanship; memorable, ownable | .com likely taken by small firms; check TM class 41/42 |
| Examina | Latinate, international, obvious purpose | Generic; .com probably taken; many near-identical marks |
| Mentora | Mentor + feminine Latin ending; warm | Common; existing companies in other sectors |
| Studia | Short, Slavic/Latin-friendly for RU/KZ markets | Very common; hard to trademark |
| Kaizen Tutor | Continuous improvement; strong in Asia | "Kaizen" widely used; descriptive |
| Alethea | Greek "truth"; fits honest-tutor brand | Existing Alethea AI (a different sector) |
| Lumen | Light/clarity; short | Heavily used (Lumen Technologies) |
| Scholé | Greek root of "school"; distinctive accent | Pronunciation friction; accent in domain |
| Gradewise | Descriptive of predicted grades | Descriptive marks are weak; .com likely taken |
| Sable | Short, calm, premium; no meaning to defend | Needs brand-building; check conflicts |

### 6.5 KPIs that matter vs vanity

| Matters | Vanity |
|---|---|
| Learning gain: pre/post on syllabus-aligned diagnostics (effect size), per topic | Total sign-ups |
| Grade delta: predicted at sign-up vs actual result (with consent); % hitting target grade | Messages sent |
| Marking calibration: QWK / exact-agreement vs examiner marks per paper, drift per session | "Accuracy" without a reference |
| Answer-leak rate in scaffolded mode (target <5%, measured like [S50]) | Minutes in app |
| Retention: W1/W4/W12; exam-season re-activation; cohort LTV by curriculum | Streak length |
| Teacher NPS; school renewal rate; % of students activated per licensed school | Number of schools "signed" |
| Safety incidents per 10k sessions; time to escalation | Feature count |
| LLM cost per weekly-active learner; gross margin by tier | Model names used |

### 6.6 Unit economics sketch

Current API prices (from llm-prices data files, Sept 2026 [S53]): GPT-5 mini USD 0.25 in / 2.00 out per M tokens; GPT-5 nano 0.05/0.40; GPT-5 1.25/10; Gemini 2.5 Flash 0.30/2.50; Gemini 2.5 Flash-Lite 0.10/0.40; Gemini 2.5 Pro 1.25/10; Claude Haiku 4.5 1/5; Claude Sonnet 4.5 3/15 (a "Sonnet 5" at 2/10 and Opus-class at 5/25 also appear in the file); DeepSeek V4 Flash 0.14/0.28 (cache hit 0.028); DeepSeek V4 Pro 1.74/3.48. Cached input is ~10% of list price across vendors.

**Heavy-user model** — 40 sessions/month × 15 turns × (3,000 input tokens incl. context, 500 output) = 1.8M input + 0.3M output per month:

| Model | Cost / heavy user / month | Notes |
|---|---|---|
| DeepSeek V4 Flash | USD 0.34 | Data-residency and quality caveats |
| GPT-5 mini | USD 1.05 | |
| Gemini 2.5 Flash | USD 1.29 | |
| Claude Haiku 4.5 | USD 3.30 | |
| Claude Sonnet 4.5 | USD 9.90 | Frontier-only is unaffordable at USD 8/month |
| Blended (80% cheap tier, 20% frontier for marking/essays, 60% cache hits) | ≈ USD 1.5–3.0 | Target |

Median paying users use ~1/3 of a heavy user → ~USD 0.5–1.0. At USD 8–12/month blended ARPU and ~USD 1.5 average LLM cost plus ~USD 0.5 infra/payments, **gross margin ≈ 75–85%**. Free-tier cost must be bounded: cap by tokens/day and route free traffic to the cheapest tier; convert on marking, predicted grades and unlimited practice. Marking a 25-mark essay (≈1,500 tokens answer + 3,000 tokens rubric/examples, 800 tokens output) costs ~USD 0.02 on Sonnet-class, ~USD 0.003 on Flash-class — cheap enough to be a free hook with a daily cap.

CAC benchmarks: creator/community CAC for students of USD 3–10 is plausible (Knowunity-style organic), paid social USD 15–40 in the UK/US (prior knowledge, unverified); with USD 60–100 annual ARPU and 40–60% annual retention, payback inside one exam cycle is feasible only if organic share stays >50%.

### 6.7 Three-year strategy outline

**Year 1 — Win one exam, prove the marker (Cambridge International + UK).**
- Ship: syllabus-tagged item banks for 6–10 high-volume Cambridge/UK subjects; examiner-calibrated marking for extended-response papers (start with Business 9609, Economics 9708, History, English, Biology); scaffolded tutor; predicted grades; past-paper practice with timing; parent report.
- Publish the first calibration study and a pre-registered learning-gain study.
- GTM: 30–50 subject creators, community free tools, 20 pilot schools (UK + Gulf + Kazakhstan). Targets: 100k MAU, 10k paying, USD 60–100 ARPU, marker QWK ≥ 0.75 on pilot papers.
- Compliance: Article 50, UK product-safety expectations, DPAs, Annex III technical file started.

**Year 2 — Many curricula, schools, community.**
- Curriculum packs: full GCSE/A Level boards, IB DP, AP/SAT, ЕГЭ, UNT, JEE foundations; a "curriculum compiler" that turns any syllabus + papers into a pack in weeks.
- School product (dashboards, class sets, homework) priced ≤ USD 12/student/yr; tutor tier.
- Community: student model answers, peer marking, creator revenue share.
- Targets: 1M MAU, 100k paying, 300 schools, first independent evaluation, EU high-risk conformity ready before 2 Dec 2027.

**Year 3 — Category definition.**
- Outcome guarantees on selected subjects (Up Learn model) backed by data; exam-board and ministry partnerships; university LMS integrations; API/licensing of the marker to publishers and tutoring chains.
- Targets: 3–5M MAU, 500k–1M paying, >40% revenue outside the UK, published grade-improvement evidence at scale, brand = "the honest tutor that knows your exam".

---

## Implications for our product (concrete, testable rules and features)

1. **Price band**: Student plan USD 6–9/month or USD 49–79/year in US/UK/EU; parent plan ~USD 15–25/month with reports; school seats ≤ USD 12/student/yr; regional tiers at 30–50% of US price in India, Pakistan, Nigeria, Egypt, Kazakhstan, Russia, Turkey (test purchasing-power-parity ladders against ChatGPT Go's local prices).
2. **"Access until exams" plan** as the default annual SKU, expiring the week after the last paper, with a one-click roll-over to the next qualification.
3. **Free tier = the community's tool**: unlimited past-paper finder and mark-scheme explainer; capped daily tokens on tutoring; 1 marked essay/day. Free traffic routed to cheapest model tier.
4. **Router policy**: cheap models for retrieval-grounded explanation and drills; frontier model only for extended-response marking, essay feedback and hard maths; prompt caching for syllabus/mark-scheme context; budget alarms per user.
5. **Never answer-first**: default scaffolded mode (hint → step → check → model answer) with measured answer-leak rate <5% on a held-out set; explicit "just show me" costs a click and is logged for the learner's own reflection. Rationale: [S47], [S50].
6. **Examiner-calibrated marking with a published number**: for every supported paper show "agreement with examiner marks: QWK x (n scripts)"; hide marking for papers below a threshold instead of pretending.
7. **Predicted grade with confidence** per subject, recalculated after each practice paper; the headline metric on the home screen, alongside "what to do next", not streaks.
8. **Learner graph keyed to syllabus codes** (e.g., 9609 §1.2.3), with decay and spaced retrieval; exportable as CSV/PDF (trust) and importable from Quizlet/Anki decks (switching in).
9. **Exam-calendar spine**: days to each paper, session (June/November), board-specific timetable; notifications timed to it; acquisition budgets follow it.
10. **Teacher mode from day one**: class code, dashboard of knowledge states, set-a-past-paper, AI-marked with teacher override; free for teachers (Khanmigo playbook).
11. **Parent report**: fortnightly email with predicted grade movement, time on task, next actions; opt-in by the student where legally required; parent becomes payer.
12. **Coursework guardrail**: detect NEA/IA/EPQ-style requests and switch to "feedback on your draft" mode; never produce submittable text; log a learning trail the student can show as evidence of authorship.
13. **Article 50 by default**: persistent "You are talking to an AI tutor" disclosure; synthetic-content labels on generated model answers.
14. **Annex III readiness folder**: risk management, data governance, logging, human-oversight design and accuracy metrics maintained as living docs; target complete before 2 Dec 2027; use it in school procurement now.
15. **Safeguarding stack**: age gate, content filters tuned for under-18s, self-harm/abuse escalation flows, no ads, no DMs; UK product-safety expectations checklist mapped feature-by-feature.
16. **Data policy**: no training on pupil data without explicit school/parent consent; UK/EU residency options; one-click deletion; DPA template published.
17. **Content strategy**: license or deep-link past papers rather than re-host; own the derived layer (tags, difficulty, misconceptions, examiner commentary written by contracted ex-examiners).
18. **Curriculum compiler**: internal tool that ingests a syllabus + papers + mark schemes and produces a tagged pack with QA workflow; target <4 weeks per new subject by end of Year 1.
19. **Community loop**: students submit model answers → AI + peer marking → best answers surfaced with examiner-style commentary → creators earn revenue share on retained subscribers.
20. **Creator programme**: subject-specific micro-creators; the shareable unit is a "grade my answer" clip and a predicted-grade card; payouts on 30-day-retained subscribers, not installs.
21. **Messaging rules**: never "replaces tutors/teachers"; always "your examiner's brain, your teacher's ally"; publish efficacy and calibration openly; admit limits.
22. **Design as trust**: sub-second first token, one accent colour, no confetti, no loss-aversion streaks; measure "calm" with a weekly survey item and rage-click rate.
23. **KPI dashboard** built on §6.5 from launch; every feature launch must name the learning or calibration metric it moves.
24. **Localisation plan**: RU/KZ/TR/HI/AR/ES interfaces by Year 2; local model options (DeepSeek/open weights) where required for cost or residency.
25. **B2B wedge**: free teacher tools → pilot → paid seats; measure activation per licensed school (target >60%), not contracts signed.
26. **Outcome guarantee experiment (Year 2–3)**: on 2–3 subjects with enough calibration data, offer a refund if the student who completes the plan misses the target grade (Up Learn precedent).

---

## Open questions / things we could not verify

- Exact 2026 prices for Save My Exams and Seneca Premium (pages blocked); Knowunity Pro monthly vs annual by country; Chegg's current price and subscriber count.
- Whether Khan Academy has published any controlled efficacy study for Khanmigo; the "23% retention" figure circulating online comes from a 12-student test and should not be used.
- Sparx Maths' independent evaluation results and school count; Save My Exams' user and revenue scale; any 2025–2026 acquisition activity in UK revision edtech.
- Whether any exam board (Cambridge, Pearson Edexcel, AQA, OCR, IB, College Board) has signed a *product* partnership with an AI company in 2025–2026, and the current terms under which Cambridge past papers may be used commercially.
- Precise text of the UK DfE "product safety expectations" and the latest JCQ AI guidance (gov.uk/jcq blocked) — verify obligations before writing the safeguarding spec.
- US state-guidance count and the content of the 2025 executive order and July 2025 ED guidance (prior knowledge only).
- Byju's, 2U and Coursera/Udemy details (prior knowledge only; verify dates and figures before quoting externally).
- Whether the EU Annex III scope captures a *self-study* practice grader (no institutional decision) — needs legal opinion per member state.
- Actual consumer CAC on TikTok/YouTube for exam-prep in 2026; creator revenue-share norms.
- Regional purchasing-power price ladders (ChatGPT Go local prices by country) — only the US USD 8 and India launch were verified.
- Google's USD 1B education commitment and Estonia/CSU/Kazakhstan deals are prior knowledge and should be confirmed.

---

## Sources

1. https://www.precedenceresearch.com/ai-in-education-market
2. https://www.globenewswire.com/news-release/2026/04/07/3269515/0/en/Global-10-6B-AI-in-Education-Market-2026-Total-Revenue-Set-to-Quadruple-During-2026-2030-Reaching-42-48-Billion.html
3. https://www.researchandmarkets.com/report/education-ai
4. https://www.grandviewresearch.com/industry-analysis/artificial-intelligence-ai-education-market-report
5. https://www.imarcgroup.com/private-tutoring-market
6. https://www.thebusinessresearchcompany.com/report/private-tutoring-global-market-report
7. https://www.futuremarketinsights.com/reports/private-tutoring-market
8. https://www.stellarmr.com/report/Private-Tutoring-Market/971
9. https://openai.com/index/introducing-chatgpt-go/
10. https://aisubscriptioncomparison.com/pricing/global-price-map/
11. https://geotoolbox.ai/blog/chatgpt-pricing
12. https://blog.google/innovation-and-ai/products/gemini-app/student-offer-google-ai/
13. https://opentherank.com/ai-pricing/gemini/student-discount/
14. https://krater.ai/blog/claude-pro-student-discount
15. https://www.edusageai.com/blogs/how-much-does-khanmigo-cost-pricing-for-teachers-and-schools-in-2026
16. https://www.buildmvpfast.com/blog/ai-tutoring-khanmigo-case-study-2026
17. https://nibble-app.com/blog/quizlet-cost
18. https://help.senecalearning.com/en/articles/3746290-how-much-is-premium
19. https://uplearn.co.uk/pricing
20. https://www.thestudentroom.co.uk/showthread.php?t=7275718
21. https://www.northernschoolstrust.co.uk/attachments/download.asp?file=6&type=pdf
22. https://www.dealnews.com/features/duolingo/cost/
23. https://languageappguide.com/pricing/duolingo-cost/
24. https://www.myengineeringbuddy.com/blog/brainly-review-pricing-features-alternatives/
25. https://www.myengineeringbuddy.com/blog/photomath-reviews-alternatives-pricing-offerings/
26. https://knowunity.co.uk/pro-plan
27. https://apps.apple.com/gb/app/knowunity-ai-revision-app/id1484296272
28. https://www.savemyexams.com/learning-hub/support/is-save-my-exams-free/
29. https://www.savemyexams.com/scholarship/
30. https://www.cnbc.com/2025/10/27/chegg-slashes-45percent-of-workforce-blames-new-realities-of-ai.html
31. https://www.techradar.com/pro/chegg-announces-move-to-reduce-workforce-by-22-percent-as-students-turn-to-ai
32. https://europeanbusinessmagazine.com/business/chegg-stock-collapse-chatgpt-ai-disruption-2026/
33. https://www.forbes.com/sites/petercohan/2025/10/29/chegg-stock-down-99-learn-whether-ai-45-layoffs-make-chgg-a-buy/
34. https://secureprivacy.ai/blog/eu-ai-act-digital-omnibus-the-new-high-risk-ai-deadlines-after-council-approval
35. https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-high-risk-deadline-omnibus-20260/
36. https://www.winssolutions.org/eu-ai-act-education-deadline-deferred/
37. https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/
38. https://ainativestudent.com/blog/chatgpt-study-mode-vs-gemini-guided-learning/
39. https://techcrunch.com/2025/08/06/google-takes-on-chatgpts-study-mode-with-new-guided-learning-tool-in-gemini/
40. https://glasp.co/articles/ai-study-modes-compared
41. https://www.eu-startups.com/2025/06/german-edtech-startup-knowunity-raises-e27-million-to-bring-ai-tutor-to-1-billion-students/
42. https://sifted.eu/articles/knowunity-raises-9m-series-a-extension-news
43. https://www.classcentral.com/report/duolingo-2025/
44. https://www.customerexperiencedive.com/news/duolingo-ai-first-consumer-backlash-lessons/757133/
45. https://sherwood.news/markets/backlash-to-duolingos-ai-memo-will-hit-q2-numbers-morgan-stanley/
46. https://buzzradar.com/blog/how-duolingos-ai-pivot-shattered-the-brand-that-mastered-viral-moments
47. https://arxiv.org/abs/2604.04721 — Liu, Christian, Dumbalska, Bakker, Dubey (Apr 2026), "AI Assistance Reduces Persistence and Hurts Independent Performance" (RCTs, N=1,222)
48. https://arxiv.org/abs/2412.16429 — "LearnLM: Improving Gemini for Learning" (Google, v3 Aug 2025)
49. https://arxiv.org/abs/2410.03017 — Tutor CoPilot RCT (900 tutors, 1,800 students)
50. https://arxiv.org/abs/2607.22996 — HeuristicEdu (Jul 2026), Socratic alignment and answer-leak rates
51. https://arxiv.org/abs/2502.18940 — MathTutorBench (ETH Zurich, 2025)
52. https://arxiv.org/abs/2508.03275 — LECTOR spaced-repetition scheduler vs FSRS/Anki (2025)
53. https://github.com/simonw/llm-prices (data/openai.json, anthropic.json, google.json, deepseek.json; fetched 6 Sep 2026)
54. https://storage.googleapis.com/deepmind-media/LearnLM/LearnLM_paper.pdf (May 2024 initial report)
55. https://www.xda-developers.com/tested-notebooklm-gemini-claude-and-chatgpt-for-studying/
56. https://arxiv.org/abs/2609.01591 — StudentSim (Sep 2026), LLM student simulators (useful for offline tutor evaluation)
57. https://arxiv.org/abs/2602.15876 — Teacher-in-the-loop personalised tasks (Feb 2026)
