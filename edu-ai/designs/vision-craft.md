# Vision — Interface craft first — the calmest, fastest, most beautiful learning workspace ever shipped

*Design-lens vision, 6 September 2026, input to the master build prompt. Citations: [A12]/[B: row]/[C3]/[E4]/[G#nn] = research/INDEX.md sections A–G; UX, SV, LS, ES, FB, CS = the briefs; GM/GL = the two gap briefs.*


## 1. One-paragraph thesis (what this product is, in your lens's terms)

This is a **workspace, not a chat**: a three-pane room where a student, their exam and their sources sit together — Course tree on the left, the working conversation in the middle, the exact page of the syllabus, mark scheme or textbook on the right — and where every response is shaped by the interface before the model even speaks. In craft terms the product is four objects rendered with obsessive care: the **Course** (board + syllabus code + level + session, the home object [A2]), the **Turn** (a ≤120-word, one-move tutor card that visibly hands the pen back [A12]), the **Mark** (a per-AO card that quotes the student's own words as evidence, warns in the examiner's voice and says what to do next [A19]), and the **Source chip** (a numbered citation that opens the real page, span highlighted, in under 400 ms [A36]). Around them: type built for 40-minute reading (17 px/1.55/68 ch), motion that never exceeds 300 ms [A38], progress told in four-state pips and reasons instead of percentages and streaks [A39][A40], and a voice that never flatters [A13]. The bet of this lens is that **calm, speed and legibility are learning interventions**: a page that never reflows while streaming, feedback that arrives while the attempt is still in working memory, and a screen that shows the next right action and nothing else, together move retention more than any prompt-level "Socratic" trick — and they are what general-purpose chat, built for everyone, cannot ship for a 17-year-old with Paper 2 in 41 days.

## 2. Positioning: the honest answer to "why would a student use this instead of ChatGPT / Gemini / Claude (with their free study modes) + Save My Exams?" — 8–12 defensible differentiators, each tied to evidence [cite]

The honest framing: the labs know more than we ever will and their study modes are free [A1]; Save My Exams has more notes than we will write in two years. A student switches only if, for the 40 minutes a night that matter, our room turns effort into marks measurably better.

1. **The workspace is built around the exam, not the message.** No lab product maps an answer to a syllabus code, an AO, a command word or a mark-scheme line, and Study Mode cannot even run inside ChatGPT Projects [A2][FB#7]. Our left pane *is* the syllabus tree; the right pane *is* the mark scheme.
2. **Marking you can see, quote and check.** Students' #1 pain is lenient, drifting marking ("ChatGPT predicts me like 16 marks and in reality I'll get 3") [A3][SV#2.2]. Ours marks per AO with the credited span highlighted in the student's own text, follows the board's best-fit procedure [A19], shows a band and publishes agreement per paper [A22]; no incumbent publishes accuracy [GL#0].
3. **Citations that open the page.** Every syllabus, mark-scheme or textbook claim carries a chip that opens the exact PDF page with the span highlighted [A36][UX#8]. NotebookLM does this for uploads; nobody does it for the curriculum canon with trust ranking [A31].
4. **Mode is visible and cannot be lost.** All three labs bury learning mode in a dropdown and users lose it ("So they've removed study mode?") [A35][UX#0]. Ours is a persistent chip and the Course sets the behaviour; there is no toggle to fall off.
5. **One move per turn, then the pen comes back.** "Walls of text" is a top-six pain and multi-turn pedagogy failure rises from 17.7% to 77.8% over a session [A12][B: SafeTutors]. Our turn is a typographic object with a word budget, one question and an explicit hand-back, enforced by a lint.
6. **The effort gate is a UI, not a refusal.** Bastani (n≈1,000): unguarded GPT raised practice 48% but lowered exam scores; the guarded tutor raised practice 127% with no harm [A9]. Ours asks for an attempt with three chips (Teach me / Check my steps / Just the answer) and honours "just the answer" after one attempt, labelled seen-solution, with a retest [A11][C5].
7. **Feedback timing you can feel.** Optimistic message in <50 ms, status text if the first token takes >800 ms, first AO card within 8 s, prior paragraphs never reflow [A38][B: performance budgets]. Feedback works by information content and timing (d=0.48) [A13].
8. **Progress without shame.** No daily streaks, no loss animations, ≤1 factual notification a day, weekly goals with rest days [A40]. "You made Duo sad" is the textbook counter-example [UX#12]; post-mock burnout is real [SV#8]. Four-state pips with a "why" tooltip replace percentages and green/red [A39].
9. **Reading comfort as a system, not a setting.** One preference set (family incl. Atkinson Hyperlegible Next and OpenDyslexic, size, leading, tracking, measure) honoured by chat, reader, cards and print; Cyrillic/Kazakh coverage tested in CI [A37]. Dyslexic and ADHD students already use ChatGPT as a reading aid and complain about busy screens [SV#9].
10. **Math and handwriting are native.** KaTeX out, MathLive keypad in, camera → transcription → confirm → mark [A25][A42]; students still call chat maths "unusable" [GL#0].
11. **Limits you can see.** A session + weekly meter in plain numbers, soft slow-down instead of a hard mid-revision stop, grace mode in exam weeks [A54][C7]. Limit opacity is the labs' most-complained trait [B: Claude limits].
12. **Teachers and parents are in the room by design.** Class code, syllabus-locked assignments, visible attempts and hints, exportable learning receipt [A55][A59]; a fortnightly parent digest without transcripts. Being the tool a school endorses is a moat a consumer chat cannot buy [SV#5.3].

We do not claim better general knowledge, coding, images or "2× learning" [A7] — only the shortest path from a wrong answer to a right one, rendered beautifully.

## 3. The product model: primary object, core loops (daily / weekly / exam-cycle), the user's first 10 minutes, the first week, the exam week

**Primary object: the Course.** A Course = {board, syllabus code, version years, level, exam session} [A2][A29]. Everything hangs off it: the syllabus tree with mastery pips, the paper list, the card deck, the plan, the memory. There is no "New chat" button on Home; there is "Continue", "Due", "Next paper". A conversation is a **Session** scoped to one Course and, by default, one topic [A48]; when a student drifts to a second topic the tutor offers to open a new Session rather than letting context rot.

**Secondary objects.** *Question* (tariff, AO split, command word, mark scheme, examiner notes); *Attempt*; *Mark* (per-AO record with spans, confidence, calibration status); *Card* (FSRS-6 item [A52]); *Source* (page-addressable, trust-ranked [A31]); *Plan* (weekly blocks on an exam spine).

**Daily loop (15–40 min).** Home shows three things: *Continue* (last Session, one line of where you stopped), *Due* (n cards, m minutes), *Next* (the planned block). The mix is enforced by the scheduler, not by willpower: ≥60% due reviews, ≥25% interleaved practice, ≤15% new [A14]. A typical evening: 6 min of cards → one exam-style question through the effort gate → a Mark → one ladder climb on the lost AO → a calm end card ("18 cards · 1 question marked · 3.2 Motivation moved to ¾").

**Weekly loop.** Sunday (or the student's chosen day) the Plan proposes next week's blocks from mastery decay, exam distance and the paper schedule; the student accepts or drags. A weekly learning-event goal (e.g. "4 sessions") with two rest days [A40].

**Exam-cycle loop.** September: import subjects and dates, light habit. November: first mock → per-question post-mortem → weak-topic map [SV#8]. January: mock results met with a plan, not platitudes. Easter: past-paper blitz by mark-yield per syllabus point. Exam weeks: next-paper-only, sleep-aware planner [A60], grace-mode limits [A54]. Results day: threshold guidance from real tables only [A24].

**The first 10 minutes (no account yet).** 0:00 landing shows one composer and one line: "Paste an answer, or photograph one. We'll mark it like an examiner." 0:20 the student pastes a 12-mark 9609 answer (or picks a sample question). 0:25 a two-field sheet asks board and subject. 0:40 the marking card streams: AO1 first within 8 s, full card within 45 s [B: performance budgets], quoted spans lighting up in the answer on the left as each AO lands. 1:30 the student clicks a citation chip; the mark scheme opens on the right at the exact line. 2:00 a single next action: "Rewrite the evaluation paragraph — one link in the chain gets you to L2." 4:00 the rewrite is re-marked; the delta is shown ("+3 marks, AO4 L1→L2"). 6:00 the effort gate appears on a fresh question. 8:00 "Save this Course" creates the account, sets the exam date and offers an import (mock photo, Anki deck). By minute 10: a marked answer, a re-marked improvement, one open source page, one pip filled.

**The first week.** Day 1 evening: the first Due set, auto-made from day-1 mistakes. Day 2: a past-paper question, timer off. Day 3: the seen-solution retest appears. Day 5: a timed 30-minute Paper section. Day 7: the weekly card — sessions done, points moved, ring changes with reasons, next week's proposal.

**The exam week.** Home collapses to one paper: "Paper 2 · Thursday 09:00 · 3 days". Sessions default to 25 minutes; the planner shows a sleep line and declines to schedule after 22:30 [A60]. Marking limits enter grace mode. The composer's default intent becomes *Check my steps*. After the paper is sat, the Course silently archives that paper's cards and the tutor will not re-litigate it. The tone is the calmest in the product: no rings, no deltas, just the next block.

## 4. Feature set by tier: MUST (MVP, Cambridge-first), SHOULD (v1), LATER (v2) — as a table with one-line acceptance criteria; include the table-stakes parity list explicitly as MUST

Tiering follows the beachhead: MUST = Cambridge A Level/IGCSE launch (9609/0450 and 9708/0455 levels marker; 9709/0580 points marker; 9701/9702/9700 tutor + points marker) [G#14]. Criteria are written as gates.

| Tier | Feature | Acceptance criterion |
|---|---|---|
| **MUST — parity** [FB#6 M rows] | Streaming with stop; progressive history | Optimistic message <50 ms; TTFT p50 <800 ms; Stop replaces Send in place [A38] |
| MUST | Edit any earlier message; branch from any message | Visible branch pill; no history lost |
| MUST | Effort dial Quick/Think/Deep, auto-escalate for maths | Vendor names hidden in chat, shown on Mark cards [A47] |
| MUST | Memory: inspectable, editable, per-Course, sensitive exclusions, export/import; incognito | Every memory line editable; incognito writes no learner state [G#07] |
| MUST | Course = project (files, instructions, scoped memory); search across everything; pin/archive | Study behaviour cannot be toggled off inside a Course [A2][A35]; ⌘K <150 ms |
| MUST | Uploads (PDF/DOCX/PPTX/XLSX/images/code, ≥20/msg); handwriting OCR; web search, library-first | Photo → transcript → confirm before any Mark [A25]; off-syllabus results labelled |
| MUST | Artifact pane with edit-in-place and versions | Outputs >40 lines open as artifacts; export PDF/DOCX/MD/Anki |
| MUST | In-chat quizzes; flashcards with real SRS; timed tests from real paper structure | FSRS-6, two buttons, offline [A39][A52]; extra time and rest breaks [A26] |
| MUST | Guided behaviour default-on, lockable by teacher/parent | Leak rate <5% on 30-turn adversarial evals [A9][A17] |
| MUST | Teen safety: age assurance, Study/Quiet Hours, breaks, parental controls without transcripts | Parity with ChatGPT for Teens [A58] |
| MUST | Usage meter, published limits | Soft slow-down; never a hard mid-session stop [A54] |
| MUST | iOS/Android with widgets; shortcuts; screen-reader labels; reduced motion; dyslexia type | WCAG 2.2 AA gates green on every PR [A41] |
| MUST | Multilingual tutoring (explain in L1, answer in exam English); export everything | Cyrillic glyph test in CI [A37]; Anki .apkg round-trips scheduling |
| **MUST — learning core** | Effort gate, five-rung ladder, intent chips | One rung per turn; entry rung by mastery [A10][A11] |
| MUST | ≤120-word one-move turns with lint | Praise audit <5%; no exclamation marks or emoji [A13] |
| MUST | Per-AO marking with quoted spans, board procedure, command-word check, confidence band | Points exact ≥97%; 8–12-mark QWK ≥0.80; essays QWK ≥0.75; run-to-run ≤1; hidden below gate [A21][A22] |
| MUST | Citation chip → exact page with highlight | ≤400 ms p95; no syllabus claim without a chip [A36] |
| MUST | Misconception lists + distractors per syllabus point | ≥3 mined misconceptions per 9609/9708 point [A15] |
| MUST | Mastery pips, readiness rings, planner with rest days and sleep line | No bare percentage; zero streak strings [A39][A40] |
| MUST | Predicted-grade range via thresholds/PUM | Only for papers above QWK 0.80 [A24][C4] |
| MUST | Exam-style generator (tariff, AO split, command word, board-format MS) | Independent solvability check; never real paper text [A27] |
| MUST | Teacher mode (class code, locked assignments, attempts/hints, audit) | Teacher confirms before any school-recorded mark [A55][C11] |
| MUST | Learning receipt; coursework → draft-feedback mode | Receipt exports as PDF [A59] |
| MUST | Verified numerics; no invented quotes | Every numeric answer SymPy-checked; 0 invented quotes [A51] |
| **SHOULD — v1** | Voice with transcript; reasoning summary; interrupt-and-add; scheduled reminders | Voice quota ≤$0.016/min [C13]; ≤1 reminder/day |
| SHOULD | LMS connectors; MCP client; share by link; code interpreter | One school pilot round-trip; no-network sandbox [A49] |
| SHOULD | UK boards as data packs; whiteboard; cognitive-debt guard | New board = ingestion [A29]; guard costs ≤1–2 pp retention [A16] |
| **LATER — v2** | ЕГЭ/UNT pack with RU/KZ UI; IRT engine; IB IA/EE coaching; community sharing with payouts; guarantee SKU | [E3]; ability ±0.2 logits [A28]; never submittable text [A59]; payouts on 30-day-retained subs [A56]; guarantee after two calibrated sessions [E9] |
| **Never** | Image/video generation, browser agents, ads, daily streaks, companion behaviour | Absent from the codebase; ad SDKs blocked by lint [A58][A40] |

## 5. The unique bets (5–8): what we do that nobody does, why it works, how we would know it works

1. **The Mark before the account.** Nobody gives an anonymous visitor an examiner-grade, per-AO mark with quoted evidence in 90 seconds. *Why:* marking is the #1 pain and the first marked answer is the "aha" competitors cannot deliver [A3][SV#Impl 18]. *How we know:* ≥55% of landing visitors who paste an answer reach a full Mark; ≥35% of those create a Course within the session; median time-to-first-Mark ≤90 s.
2. **The Turn as a designed object.** Tutor replies are cards with a word budget, one move and a visible hand-back (the composer focuses; its placeholder names the action). *Why:* multi-turn failure and walls of text are where AI tutoring breaks [A12][B: SafeTutors]; a UI-enforced format beats a prompt asking nicely. *How we know:* median assistant turn ≤110 words; student reply rate after a tutor turn ≥80%; attempt latency ≥8 s on non-trivial items.
3. **Evidence-on-the-page marking.** The Mark card highlights credited and uncredited spans *inside the student's own answer*, links each to the mark-scheme line or descriptor, and quotes the examiner report where the answer commits a known sin [GM#0 item 7]. *Why:* per-criterion marking with quoted evidence also reduces LLM leniency and length bias [GM#A1.3]. *How we know:* QWK per paper against gold scripts [A22]; ≥70% of Marks followed by a rewrite within the session.
4. **The source pane as the trust surface.** Citation chips open the exact page, and "Show me in the book" is a standing action on every paragraph [A36]. *Why:* inline sources change verification behaviour [UX#8]. *How we know:* ≥60% of study sessions open the source pane; chip open time p95 ≤400 ms; hallucination reports per 1,000 Marks trending to zero.
5. **Latency as a design material.** Explicit TTFT states, streaming that never reflows earlier paragraphs, skeletons for unclosed math, first AO card <8 s [A38]. *Why:* feedback effect depends on timing as much as content [A13]. *How we know:* CLS above the cursor = 0 in the jank test; TTFT p95 <1.5 s; Mark first-card p95 <8 s.
6. **Quiet progress.** Pips with reasons, rings that decay transparently, a heatmap without red, weekly goals with rest days, one calm celebration [A39][A40]. *Why:* introjected motivation predicts ill-being; the exam-year emotional calendar is already brutal [SV#8]. *How we know:* 28-day retention equal or better than a streak variant in the pre-registered A/B; zero shame-copy strings; self-reported anxiety item in the weekly card not rising through the year.
7. **Reading comfort as one system.** Family, size, leading, tracking, measure set once; honoured by chat, reader, cards and print; Cyrillic/Kazakh coverage in CI; Atkinson Hyperlegible Next and OpenDyslexic as first-class faces [A37]. *Why:* individual font effects are real, so choice beats one "dyslexia font" [UX#5][SV#9]. *How we know:* ≥12% of active users change a reading preference.
8. **The Paper as a native surface.** A past paper is not a PDF in a chat; it is a question-by-question runner with the tariff, timer, answer area, camera, and a Principal-Examiner debrief at the end [A26]. *Why:* timed practice is what students do at Easter and nobody renders it well [SV#4]. *How we know:* ≥1 timed Paper per active student per fortnight in the 8 weeks before exams.

## 6. Information architecture and key screens: list every screen/surface with a 3–6 line description of what it shows and does (desktop and mobile)

Top-level IA: **Home · Course (Learn / Papers / Cards / Plan / Progress) · Library · Search (⌘K) · Settings**, plus **Teacher** and **Parent** role surfaces. Breakpoints per [A34]; mobile is a back-arrow route stack, not a hamburger.

1. **Landing / First Mark** — one composer, one sentence, a sample-question picker; marking streams in the same view; two-field board/subject sheet; account only at "Save this Course".
2. **Home** — three cards (Continue · Due · Next) above a 7-day strip with exam chips; no greeting larger than 20 px; empty state shows work, never a mascot [A43]. Widget mirrors Due and Next.
3. **Course › Learn (the workspace)** — sidebar syllabus tree with pips; centre Session with turns, Marks, artifact cards; right pane tabs Source · Scratchpad · Artifact · Cards. The right pane sits as a 48 px rail until a citation or artifact needs it. Mobile: Session full-screen; sources and keypad as sheets with 50/92% detents.
4. **Session (tutor conversation)** — one topic; composer with mode chip, effort dial, +, math, camera, mic; intent chips appear only on gradable items; ThinkingRow collapsed.
5. **Paper runner / Timed mock** — paper header (code, series, minutes, marks), question nav rail with tariff pills, answer area (text/keypad/camera), timer with extra-time %, rest-break button; ends in the debrief screen. Mobile: question-at-a-time, timer in the top bar.
6. **Mark view** — student answer left with highlighted spans; per-AO cards right; total with confidence band; examiner-report warnings; command-word check; "Next action" and "Rewrite" buttons; model chip; "Show teacher" flag. Mobile: answer on top, cards below, span taps scroll to the card.
7. **Reader (Source pane / full-screen Reader)** — page-accurate PDF or structured text, highlight, page nav, citation arrows, selection popover (Ask · Explain · Define · Save as card · Quote); trust badge (Syllabus / Endorsed textbook / Mark scheme / Examiner report / Your notes). Mobile: full-screen route from a chip.
8. **Cards / Review** — deck list with due counts; review screen with two buttons, next-interval hints, session progress bar, calm end summary; card editor with cloze and math. Offline-capable. Mobile: buttons in the bottom 20%.
9. **Progress** — syllabus tree with pips and decay reasons; readiness ring per paper; heatmap (5 tones, no red); wrong-question bank; predicted-grade range only for gated papers, with marks-to-next-grade per component [A24].
10. **Plan** — week strip, exam spine, 25/45-minute blocks (drag + tap alternative), "Why this plan" disclosure, sleep line, weekly goal with rest days, reminder opt-in.
11. **Library** — sources per Course by trust rank; upload (PDF/photo/Anki/Quizlet), ingestion status with per-page confidence, notes-vs-canon conflicts list [CS#5]; paste-a-mark-scheme → structured marking points tool.
12. **Search / Command palette** — ⌘K, verb-first ("Quiz me on…", "Open Paper 2 2024…", "Explain simpler"), fuzzy across Sessions/files/syllabus points; zero animation [UX#14].
13. **Settings** — single scroll with sticky nav (sections in 7.10); Data & privacy holds the memory list, incognito, export and delete.
14. **Usage meter & plan** — session and weekly bars in plain numbers; exam-week grace indicator [A54].
15. **Teacher console** — classes by code; syllabus-locked assignments; per-student attempts, ladder depth and Marks to audit; allowed-help level per task; exports [A55].
16. **Parent digest** — fortnightly topics, minutes, trend, one suggestion; no transcripts; Study/Quiet Hours controls [A58].
17. **Learning receipt / Share** — timeline of attempts, hints, drafts and Marks; PDF export; public link with learner state stripped [A59].
18. **Onboarding sheets** — board → subjects → exam date, ≤3 steps, after the first Mark.
19. **System states** — offline banner, inline error cards, limit banner (7.14).

## 7. Your lens in depth (the section where you go deepest — see lens brief)

The principle under everything here: **the interface is a pedagogical instrument.** Calm reduces extraneous load so working memory goes to the content; speed keeps feedback inside the window where the attempt is still live; a single visible next action is the design equivalent of "one move per turn". Every number below serves one of those three.

### 7.1 The learning workspace layout

**Desktop ≥1280 px.** CSS grid `280px 1fr 480px`; sidebar resizable 240–360, right pane 360–640, both persisted per user [A34][UX#27]. Top bar 48 px: breadcrumb (Course › Unit › Session), mode chip mirror, usage dot, ⌘K. **Sidebar**: 8 px padding, 32 px rows, 14 px labels, 12 px caps headers at +0.06 em, 16 px tree indent, active row step-3 fill radius 6 px; tree is Subject ▸ Unit ▸ Syllabus point with a 10 px mastery pip on every point; "Recent" and "Due today" are secondary groups under the tree, never the primary list [UX#1.2]. **Centre**: Session column centred at max 68 ch (≈720 px at 17 px), 24 px gutters, composer sticky with a 24 px fade above; when the right pane closes the column does *not* widen. **Right pane**: 40 px tab strip (Source · Scratchpad · Artifact · Cards); collapsed state is a 48 px rail with the citation count badge, so a fresh Session is two panes and the third appears the moment a chip is clicked — an empty pane is noise.

**Tablet 900–1279 px.** `1fr 420px`; sidebar becomes a left overlay (320 ms `--ease-drawer`, 40% scrim). Portrait <1024 px: the right pane is a bottom sheet with 50%/92% detents; landscape docks the math keypad under the composer.

**Mobile <900 px.** One pane. Top bar 44 pt (back · title · ⋯). Session full-width, 16 px gutters. Composer above the home indicator with safe-area padding; camera · mic · send in the right 40% of the width. Source, mode picker, keypad and card editor are sheets (36×5 px handle, tap-to-close scrim). Library is a route reached by the back arrow, not a drawer. Flashcards are a full-screen route with two 56 px buttons in the bottom 20% [UX#21].

*Why this helps learning:* checking a claim costs one gesture; a 68 ch measure survives a 40-minute session; the syllabus tree orients the student in the exam's structure, not a list of chats.

### 7.2 The composer and its modes

Rest height 56 px, grows to 8 lines then scrolls; padding 12/16; radius 12 px (calmer than a pill); hairline border, step-8 focus ring. Left cluster: **+** (files, photo, paste mark scheme, import deck) and the **mode chip**. Right cluster: **effort dial** (Quick · Think · Deep, 28 px, ↗ marks auto-escalation for maths [A47]), mic, camera, **Send** — the only filled button on screen, replaced in place by Stop.

**One chip, three modes: Learn · Practise · Mark.** *Learn* = tutoring with the effort gate and ladder; *Practise* = exam-style items with tariff and timer; *Mark* = "here is my answer, mark it". The chip is a segmented pill (32 px, 13 px labels) that is always visible, has `/learn` `/practise` `/mark` aliases, and is remembered per Course. The Course sets behaviour; there is no "study toggle" to lose [A35]. Intent chips (Teach me · Check my steps · Just the answer) are **not** in the composer — they appear as a reply row under the tutor's turn when a gradable item is open (see 7.3), so the composer never carries two chip systems.

**Composer states.** `Aa` text (default) · `∑` math: MathLive field replaces the text area, 5×4 keypad (10×4 landscape tablet), live KaTeX preview line 24 px above the keys, decimal comma accepted and normalised [A42] · `📷` camera: full-screen, crop rectangle 70%×25%, 44 pt handles, then a **confirmation card** showing the transcription with low-confidence tokens underlined; "Looks right" is required before any Mark [A25] · `🎤` voice (v1): push-to-talk waveform with live transcript. A slash menu lists verbs; a quiet token hint appears only in the last 15% of a session budget.

### 7.3 The tutor-session experience

**Streaming contract.** Optimistic user message and three-dot indicator <50 ms; after 800 ms the dots become one line of status in muted 13 px ("Reading the 9609 P2 mark scheme…"); after 6 s "Taking longer than usual" with Stop; tokens buffered and painted per frame at ≤90 characters per 16 ms; previous DOM nodes immutable; unclosed `$$` or fences held as a skeleton of the expected height; no auto-scroll after 120 px of user scroll, a "↓ New" pill instead [A38][UX#3]. Thinking is a collapsed, non-animated "Thought for 6 s ▸" row.

**The Turn card.** Assistant text sits on the canvas with no bubble; user messages are step-3 tinted blocks, radius 16, max 80% width. A tutor turn in Learn mode renders as up to four short lines in this fixed order: *what was right* (task-level, specific) → *the one thing wrong or missing, named* → *one move* (question, hint or micro-example) → *the hand-back*, which is not text but behaviour: the composer takes focus and its placeholder becomes the action ("Try the next line", "Name the stakeholder first") [LS#3.2]. Lint on the model output blocks a second question, praise words, exclamation marks and emoji before paint [A13]; when the lint trips, the turn is regenerated, not shown with a warning.

**Effort gate UI.** On a gradable item the tutor's first turn is short ("Have a go first — even a plan or the first line is enough.") and beneath it a reply row of three chips: **Teach me** · **Check my steps** · **Just the answer**. Chips are 32 px outline, keyboard 1/2/3. *Just the answer* is enabled after one attempt or a one-sentence "I don't know where to start because…" [A9][A11]; before that it is present but shows a tooltip "After one attempt". When used, the solution card carries a small neutral tag **Seen solution · retest Thu** and the item is scheduled 24–72 h out; no lecture text appears anywhere.

**Hints UI.** A vertical **help ladder** sits in the message margin as five 8 px rungs; the current rung is filled, lower rungs are dotted. Hover names the rung (What is it asking? · Which principle? · Next step · Fill the blank · Full solution). The student can ask for the next rung with a 28 px "More help" button or `⇧↓`; the tutor never climbs two rungs in one turn and the entry rung is set by mastery (<0.4 starts at the worked example) [A10]. Rung reached is logged and is what teachers see in aggregate [C5].

**Retrieval moments.** A new topic opens with a 3–5 item probe card with a confidence slider (Sure · Think so · Guessing) [A14]; post-explanation retrieval is a card, not chat text, so practice is recognisable by shape.

### 7.4 The marking experience

**Layout (Mark view).** Two columns in the centre pane at ≥1280 px: the answer left (18/1.6, 66 ch), the Mark right (360–420 px); below 1024 px the answer sits on top and span taps scroll to the card.

**Streaming order.** Header first (question id, tariff, command word, this paper's AO split — 9609 P2 AO1 35% / AO2 30% [A19]); then one **AO card** per objective, each within 8 s, total ≤45 s [B: performance budgets]. Each card: AO label and level reached (e.g. "AO3 Analysis · Level 2 of 3 · 4/6"), the descriptor line relied on, and **quoted spans** from the answer. As a span is credited it highlights in the answer column: credited = 2 px accent underline, step-3 accent wash; partially credited = dotted underline; uncredited attempt = warning dotted underline with the reason on hover ("assertion without a link in the chain — L1 not L2") [ES#4.3]. Points-based papers use the same card with M/A/B marks, an **ecf** mono badge and OCR-style annotations (✓ × BOD ECF NC) as 16 px margin glyphs, never emoji [A20].

**Warnings and examiner voice.** A matched examiner-report criticism renders as a distinct blockquote (2 px warning rule, series badge "9609 m25 ER") quoting the report [GM#0]. The command-word check is one line under the header ("*Evaluate* — a judgement is required; none found → capped at L2") [A21].

**Total, confidence and calibration.** The total is a **band**, not a point: "11–13 / 20", with the modal mark bold. Beneath: a calibration badge in 12 px — "Calibrated on 9609 P2 · agreement QWK 0.82 · 312 scripts · last audit Aug 2026" — or, below gate, "Practice estimate — not yet calibrated for this paper" and no predicted grade [A22][C11]. The model chip shows which family marked; essay disagreement >1 level shows "Sent for human check" [A23]; **Show teacher** flags the Mark for the console.

**What to do next.** One primary button — **Rewrite the weakest paragraph** — opens the paragraph in the Artifact tab with the lost AO descriptor pinned above it; one secondary — **Explain this AO**; one tertiary — **Another like this** (generator, same tariff and command word) [A27]. After a re-mark the delta ("+3 · AO4 L1→L2") fades in over 220 ms; no confetti. Every Mark becomes cards automatically and feeds the wrong-question bank.

### 7.5 The source pane and citation chips

**Chip.** 18 px tall, 11 px semibold tabular numeral, radius 6, step-3 fill, step-11 text, placed after the sentence before the space, with a 24 px invisible hit area [UX#8]. Hover/focus card in 120 ms: source title, chapter/page, a 2–3 line excerpt with the span bold, trust badge, "Open". Click opens the right pane at the **exact page** with the span highlighted (`--highlight-source` 35% light / 40% dark), page number in the header, previous/next citation arrows, within 400 ms from cache [A36]. Pages render at device pixel ratio with a selectable text layer (dark-mode handling in 7.11).

**Trust badges** are five text badges — Syllabus · Endorsed textbook · Mark scheme · Examiner report · Your notes — and the tutor's wording follows the rank [A31]. When uploaded notes conflict with canon, a **conflict card** appears in the Session: two quoted lines with their chips ("Your notes: 273 °C · Syllabus: 273 K") and the canon wins by default [CS#2 item 6].

**Selection popover** (150 ms after mouseup, long-press on touch): Ask · Explain · Define · Save as card · Quote in chat, with keyboard equivalents. "Show me where in the book" is a standing action on every assistant paragraph. For unlicensed board material the pane shows a short attributed extract and a deep link to the official PDF [A33][GL#0].
### 7.6 Flashcards and review

Full-screen route. Card face centred, 20 px body, KaTeX, images ≤60% height; flip on tap/Space with a 200 ms ease-out flip (150 ms crossfade under reduced motion). Two buttons, **Again** (neutral-destructive tint) and **Got it** (primary), each 50% width × 56 px, keyboard 1/3/Space; next-interval hint in 12 px muted under each, hideable; Hard/Easy behind a setting [A39][UX#11]. Header: 3 px progress bar, "12 of 30". FSRS-6 with retention ramping 0.85 → 0.90 → 0.95 toward the exam and intervals capped at the exam date [A52]. Provenance line on every card ("From your Mark · 9609 P2 Q3(b)"). End card: cards reviewed, estimated retention, next review day — three lines, no animation. Works offline.

### 7.7 Mastery and progress without streak shame

**Pip** = 10 px circle with four states by *shape*: empty ring · quarter fill · three-quarter fill · full disc, coloured on a single semantic scale; hover shows the reason ("¾ — 2 correct unaided, last seen 6 days ago; decays to ½ on 20 Sep without practice") [A39]. **Readiness ring** per paper, 64 px, thin 4 px stroke, with the decay reason in text underneath. **Heatmap**: 12 px cells, 3 px gap, five tones of one hue, never red, no streak number. **Weekly card**: sessions vs goal (rest days neutral), points moved, ring deltas with reasons, next week's proposal. The single celebratory moment in the product — a 400 ms two-tone fade on the ring — fires once when a paper first reaches "ready" [UX#23]. Predicted-grade range appears only on Progress › Paper, for gated papers, as "B–A (June 2025 thresholds) · 6 marks to A on P2" [A24].

### 7.8 The planner

Week strip 7 × 44 pt with today ring and exam chips (tabular countdown, information not pressure); blocks of 25/45 minutes labelled by syllabus point and type (Review · Practise · Paper); drag to move with a tap alternative (⋯ › Move); "Why this plan" links each block to the pip that produced it; changes are **proposed**, never silently applied [UX#13]. A sleep line at the student's chosen bedtime greys the hours after it; in exam week the planner declines late blocks with one sentence [A60]. Extra-time percentage and rest breaks are Course settings that every timer inherits [A26].

### 7.9 Onboarding, first 10 minutes (screen spec)

Landing: 640 px composer at 40% viewport height, one 20 px line above, four sample chips below ("9609 12-mark evaluation", "0580 vectors", "9701 mechanism", "Photograph your own"); no hero, no feature grid. Paste → a 2-field sheet slides up (board, subject; typeahead; 320 ms drawer) → the Mark view streams. After the first re-mark, a quiet inline card "Save this Course" (email/Apple/Google) then exam date and an optional import (photo of a mock, Anki/Quizlet file, PMT/SME notes). Three sheets maximum, each ≤2 fields [A43].

### 7.10 Settings and accessibility

One scrolling page, sticky nav, one-line consequence under every toggle, live type preview. **Reading comfort**: family (System · Inter · Atkinson Hyperlegible Next · OpenDyslexic · Literata serif), size 14–24 px stepper, leading 1.4/1.55/1.7, letter-spacing 0/+0.05/+0.12 em, measure narrow/medium/wide, a one-tap preset (18 px / 1.7 / +0.05 em / 60 ch / warm background), "Capitalise Each Word" toggle requested by dyslexic readers [SV#9]; applied to chat, reader, cards, print [A37]. **Motion**: reduce-motion honours the OS and can be forced. **Contrast+** variant. **Language**: UI language, language of explanation, decimal comma. **Cyrillic/RTL**: tested Kazakh glyphs (Ә Ғ Қ Ң Ө Ұ Ү Һ І), serif with true Cyrillic italics, logical CSS properties, mirrored chevrons, un-mirrored math [UX#22]. **Focus**: 2 px ring + 2 px offset, never obscured by the sticky composer. **Screen reader**: messages as `article` in a `log`, announced once; math via MathML plus lazy SRE speech; graphs with audio trace [A42]. Targets ≥24 px, 44 pt on touch; all CI gates [A41].

### 7.11 Dark mode

A grey ladder, never #000, elevation = lighter surface [A41]: app `oklch(16% 0.006 260)`, subtle 19%, element 23%, hover 26%, active 29%; borders 27/32/42%; text 94% and muted 70%; accent lifted and desaturated to `oklch(72% 0.13 250)`; source highlight alpha 0.40; PDF pages stay paper-coloured on a step-2 surface. Both themes plus Contrast+ ship from day one; automated contrast tests run across every token pair.

### 7.12 Tokens

**Type** (Inter with `opsz`, fallback system-ui; Literata for reading; Geist Mono for code): xs 12/1.35 · sm 13/1.4 · ui 14/1.43 · body 17/1.55 · read 18/1.6 · lg 20/1.4 · h3 20/1.3 · h2 24/1.25 · h1 30/1.2 · display 36/1.1; tracking display −0.02 em, caps +0.06 em; measures 68 ch chat, 66 ch reader, 60 ch focus; tabular numerals on every number that changes [UX#25].
**Space** 4-px base: 4 8 12 16 20 24 32 40 48 64. **Radii**: 4 6 8 12 16 20, pill 9999. **Sizes**: control 36, control-lg 44, row 32, composer-min 56, target-min 24, touch-min 44, sidebar 280 (240–360), panel 480 (360–640).
**Colour (light, OKLCH, Radix 12-step semantics)**: bg-app `98.5% 0.004 90` · bg-subtle 97% · bg-el 94.5% · hover 92% · active 89% · border-subtle 88% · border 83% · border-strong 74% · text-muted `48% 0.01 90` (≥Lc 60) · text `20% 0.012 90` (≥Lc 90) · accent `55% 0.16 250` with white text · accent-subtle `95% 0.03 250` · success `60% 0.14 150` · warning `75% 0.15 80` · danger `58% 0.19 25` · highlight-source `90% 0.14 95 / 0.35`.
**Elevation**: borders first; hairline `0 0 0 1px oklch(0% 0 0 / 0.08)`; shadow-2 `0 1px 1px /.02, 0 2px 2px /.04` + hairline; shadow-4 for modals `0 8px 16px −4px /.04, 0 24px 32px −8px /.06` + hairline; no shadows on list cards.
**Motion**: press 120 · tooltip 150 · fast 180 · base 220 · page 260 · drawer 320 · stagger 40; `--ease-out cubic-bezier(.23,1,.32,1)`, `--ease-in-out (.77,0,.175,1)`, `--ease-drawer (.32,.72,0,1)`; springs only for drag-to-dismiss `{duration .5, bounce .15}`; animate `transform`/`opacity` only, start scale 0.96 not 0, `:active` 0.97, hover effects only under `(hover:hover) and (pointer:fine)`; **zero animation** on Send, the palette and keyboard-initiated actions; reduced motion = opacity/colour only at ≤160 ms, shimmer off [A38][UX#17].
**Icons**: one outline family (Lucide), 24 px grid, 2 px stroke, 16/20 optical variants, icon colour = row text colour.

### 7.13 Microcopy voice and tone

Voice: an examiner who is on your side. Short, specific, declarative; examiner vocabulary explained in plain words; no exclamation marks, no emoji, no "Great question", no therapy-speak [A13][SV#Impl 20]. Example strings:

| Situation | String |
|---|---|
| Effort gate | "Have a go first — a plan or the first line is enough." |
| Just-the-answer chip, before an attempt | "After one attempt." |
| Seen-solution tag | "Seen solution · retest Thursday" |
| Mark header | "Evaluate — a judgement is required. None found, so AO4 is capped at Level 2." |
| Uncredited span hover | "Assertion without a link in the chain — L1, not L2." |
| Examiner-report warning | "Examiners' report, m25: 'simply repeating the business name will not count as application.'" |
| Calibration badge | "Calibrated on 9609 P2 · agreement 0.82 · 312 scripts" |
| Weekly card | "4 of 4 sessions. 3.2 Motivation moved to ¾. Paper 2 readiness unchanged: no timed practice this week." |
| Notification (opt-in) | "18 cards due · about 6 minutes." |
| Exam-week grace | "Exam week: marking limits are off until Friday." |
| Quote unverifiable | "I can't confirm that quote from the set text, so I won't use it." |
| Distress at 1 a.m. | "That sounds like a hard night. You are not failing — your last three Marks went up. Tonight: sleep. Tomorrow's first block is 25 minutes on 3.2. If things feel worse than exam stress, here is someone to talk to." |
| Coursework request | "I can't write this for you — it would be submitted. I can mark your draft against the criteria and log what we did." |

### 7.14 Empty, error and offline states

Empty Home = work (Continue · Due · Next), never a greeting or mascot; empty deck = "Cards appear here from your Marks and highlights" [A43]. Errors are inline cards: plain cause, one primary action ("Retry with Think"), one secondary ("Copy my message"); never a modal [UX#18]. Offline: a 32 px banner, sends queued with a visible "Will send" tag, cards fully reviewable (local FSRS), downloaded units readable; the Mark button is disabled with the reason. Skeletons match final geometry; spinners only for <1 s confirmations. Limit reached: soft slow-down to the cheap tier with a factual line, never a mid-session stop [A54].

### 7.15 Pixel-level quality checklist (release gate)

UX#28 is adopted verbatim as the reviewer checklist; these are the additions this vision requires. (1) Zero layout shift above the stream cursor, measured. (2) Every syllabus/mark-scheme claim carries a chip; chip → page ≤400 ms p95. (3) Mark card shows spans in the answer, a band not a point, a calibration badge and exactly one primary action; the praise-lint report is attached to the release. (4) Send, palette and keyboard actions animate nothing; reduced motion verified in Playwright. (5) No streak strings and ≤1 notification/day, enforced by a policy test on the copy corpus. (6) Cyrillic + Kazakh sample renders in-family; RTL smoke test passes. (7) Right pane is a 48 px rail until needed; chat measure never exceeds 68 ch. (8) One accent hue; AO cards distinguished by label, not colour.

## 8. What we deliberately do NOT do (and why), and where you disagree with INDEX decisions (say so explicitly with reasons)

**We do not build:** image, video or music generation (deterministic diagram and graph renderers do the exam's work) [FB#6]; browser agents; deep-research reports; a companion persona [A58]; ads, ever; daily streaks, leagues or XP [A40]; a marketplace of "GPTs"; a PDF mirror of board papers [A33]; "AI replaces your tutor" messaging [A5]; efficacy multipliers in marketing [A7]; a fourth chat mode — the chip stays at three.

**Refused for craft reasons:** four-button grading by default, percentage mastery, a model picker (effort dial only), suggestion-chip carpets on Home, onboarding tours, modals for anything recoverable, motion on Send.

**Where this lens disagrees with the INDEX — explicitly.**

1. **[A35] "Mode chip: Tutor / Exam / Explain / Quiz."** Four modes plus the three intent chips of [A11] is two chip systems and seven states; new users will not identify the current mode in 3 s [UX#Impl 2]. I propose **Learn · Practise · Mark** as the composer chip, with *Explain* folded into Learn (the ladder's rung-5 and the effort dial cover depth) and *Quiz* delivered as an in-chat card via `/quiz` or the Cards tab. Intent chips live under the tutor's turn, only when a gradable item is open.
2. **[A34] "Default layout is three panes."** The grid is right; the *default state* is wrong. An empty right pane on a fresh Session is visual debt. Ship the third pane as a 48 px rail that opens on the first citation, artifact or Mark; measure whether ≥60% of sessions still open it [UX#Impl 1].
3. **[A24] predicted-grade range "shown".** Agree with the method; disagree with prominence. A predicted grade on Home is an anxiety device in an exam-year calendar already full of them [SV#8]. It lives on Progress › Paper only, below the readiness ring, and never in a notification or digest.
4. **[A43] "onboarding ≤3 screens with a question before an account."** Go further: there are **no onboarding screens before the first Mark**. Two fields (board, subject) in a sheet during the first marking; level, session and exam date after "Save this Course". The 90-second first Mark is the onboarding.
5. **[A47] "vendor model names shown on marking cards."** Agree, but as a *chip on the calibration line*, not a headline; students should compare calibration numbers, not brand names — the number is what we want them to trust.
6. **[A37] Inter as default.** Keep Inter for UI; offer *Literata* as the reading default for essay subjects, decided by a reading-fatigue test — a single grotesque for 40 minutes of prose is where the safe choice is not the best one.
7. **[C6] weekly goal.** Agree, but it must be invisible on Home in exam weeks; goals build the habit in September, they do not police May.

## 9. MVP scope for a 6-month build with a small team + AI coding agents; then the 18-month roadmap

**Team:** 1 design lead, 2 product engineers (web + Expo), 1 ML/eval engineer, 1 curriculum lead with examiner contractors, founder on partnerships, plus AI coding agents for components, tests and lint tooling. shadcn-based tokens under a custom skin [E15]; web first.

**Months 1–2 — the room and the Mark.** Tokens, type, motion lint, dark mode, WCAG gates. Three-pane shell with rail state. Composer with mode chip, effort dial, keypad, camera → confirm. Streaming contract and jank test. Mark view for 9609 P2 and 0450 with AO cards, spans, band, calibration badge. Chips → exact page on syllabus/specimen material. First Mark before account. Gold sets (300 double-marked scripts per paper) begin [E6].

**Months 3–4 — the loops.** Course object, syllabus tree, Session scoping, memory panel. Effort gate, ladder, intent chips, lint. FSRS-6 cards with auto-cards from Marks. Paper runner with timers and debrief. 9709/0580 points marker with SymPy and ECF; 9708/0455 levels marker; misconception lists. Home, Plan v1, Progress, usage meter.

**Months 5–6 — trust and launch.** Generator with solvability check. Teacher console and parent digest. Learning receipt and coursework guardrail. Teen controls. RU/KZ strings and Cyrillic tests. iOS/Android builds. Calibration published above gate; predicted grades gated at QWK 0.80. Pixel checklist as release gate; pre-registered efficacy design filed. Launch for the June 2027 series.

**Months 7–12 (v1).** Sciences coverage (9701/9702/9700 incl. practical planning); UK board packs; voice; whiteboard; connectors and MCP; share links; debt-guard A/B; rubric-refinement loop against gold sets [GM#0 item 4]; first efficacy readout after June 2027.

**Months 13–18 (v2).** Second market pack (ЕГЭ or UNT per [E3]) with IRT engine; IB IA/EE coaching; community decks with creator payouts; Contrast+ and full RTL; outcome-guarantee SKU only if two sessions of calibration data support it; Annex III technical file complete before 2 Dec 2027 [A58].

## 10. Metrics of success (north-star, guard-rails, per-feature) and the biggest risks with mitigations

**North-star:** learning on unaided tasks — 7/28-day delayed retention on syllabus points, near-transfer success after seen-solutions, predicted-vs-actual grade error per paper, mastery velocity, Brier calibration — plus marking QWK per paper and answer-leak rate <5% [A61]. DAU, minutes and session counts are guard-rails, not goals.

**Design-lens metrics.** Time-to-first-Mark ≤90 s median; landing → full Mark ≥55%; Mark → rewrite ≥70%; source pane opened in ≥60% of sessions; chip open p95 ≤400 ms; TTFT p50 <800 ms; first AO card p95 <8 s; CLS above cursor 0; median tutor turn ≤110 words; reply after tutor turn ≥80%; attempt latency ≥8 s; mode identified in <3 s; ≥12% change a reading preference; praise audit <5%; zero shame strings; WCAG gates green on 100% of releases; store ratings ≥4.5 with "calm" and "honest" in the top review terms.

**Guard-rails.** 30-day retention falls ≤1–2 pp in any pedagogy A/B [A16]; weekly anxiety item flat through the year; limit tickets <2% of MAU; cost per student within AR's envelope ($1.6–2.6 median, $8–13 heavy) [A57].

**Biggest risks and mitigations.**
1. *Marking trust breaks on one viral bad Mark.* Bands not points; calibration badge; human check on disagreement; publish agreement per paper, hide below gate [A22][A23]; one-tap "Dispute this mark" with a visible outcome.
2. *The effort gate reads as a refusal.* Chips not walls; "Just the answer" after one attempt; never rate-limited; retention A/B with a kill-switch [C5].
3. *Latency variance across four providers ruins the feel.* TTFT states designed for 0.3–3 s; route on measured p95; cache-first prompts [A45]; streaming contract tested in CI.
4. *Licensing forces the source pane to go dark.* Extract + deep-link fallback designed from day one; original item bank as default practice; Cambridge and CLA talks before scale [A33][GL#0].
5. *Parser errors put wrong maths on beautiful pages.* Two-pass ingestion with per-page confidence; low-confidence pages show a "verify against the PDF" badge in the pane [A30].
6. *Exam-week cost spike.* Grace mode budgeted; quotas on Opus-class Marks; alert when a student's day exceeds 3× median [A57].

## 11. Names: 3 candidate product names with rationale (avoid exam-board marks)

All three avoid board marks [E10]; trademark and domain checks (UKIPO/EUIPO/USPTO/WIPO, .com/.ai/.app) are required before use.

1. **Margin** — where an examiner writes, and the distance to the next grade ("6 marks to A"); also what a calm interface is made of. Reads as premium and quiet. Risk: a common word, likely contested in class 41/42; domain needs a modifier (margin.study).
2. **Nib** — the tip of the pen; the product's core gesture is handing the pen back. Three letters, transliterates cleanly (Ниб), easy icon (a nib forming a tick). Risk: needs brand-building; check conflicts with pen makers.
3. **Quire** — a gathering of pages, the physical unit of an exam script; homophone of "choir" and "enquire". Distinctive, ownable, spells well in Cyrillic (Квайр) and carries the paper-and-marks feeling without being descriptive. Risk: pronunciation friction for non-native speakers; explain once in the logo lockup ("Quire — /kwaɪə/").

Recommendation: **Margin** if the mark is clear; otherwise **Nib**. Both fit a product whose whole design argument is that the space around the words is where learning happens.
