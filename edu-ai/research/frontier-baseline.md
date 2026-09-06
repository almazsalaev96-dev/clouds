# Frontier AI Chat Products: The Table-Stakes Feature Baseline (September 2026)

Lens: what ChatGPT, Gemini, Claude, DeepSeek (and Grok, Copilot, Perplexity, Mistral) ship in their consumer chat products today, what users love and hate, and what a learning-first product must match, may skip, and can exploit.

Method note: 26 web searches plus ~35 primary-page extractions (vendor pricing pages, help-center articles, release notes, official blogs) and Reddit threads, all fetched 6 September 2026. The corporate egress proxy blocked direct WebFetch to most vendor domains; primary pages were retrieved through the Nimble extraction connector instead. Facts are dated; where only third-party sources were available (e.g. some plan prices that render client-side), this is flagged. Anything from memory rather than a fetched page is marked "(prior knowledge, unverified)".

---

## 0. Executive summary

1. **The baseline is now enormous and moving monthly.** ChatGPT's own pricing matrix lists ~45 consumer features (Projects, shared projects, scheduled tasks, Sites, built-in browser, Skills, Plugins, Study mode, memory, voice with video, record mode, interactive tables/charts, Codex, "ChatGPT Work" agent mode) [S1]. Matching all of it feature-for-feature is impossible for a new entrant; matching the *core chat loop* plus the *learning-relevant* subset is realistic.
2. **Every frontier product now has a "learning mode", and they are all thin prompt layers.** ChatGPT Study Mode ("powered by custom system instructions" [S8]), Gemini Guided Learning (LearnLM-infused), Claude Learning style (Socratic prompt) all: toggle on/off, can be bypassed, sometimes "give a direct answer" by OpenAI's own admission [S2], and have no exam-board/mark-scheme grounding. This is the single biggest opening.
3. **Study mode is free everywhere.** ChatGPT Study mode is on all plans incl. Free [S1][S2]; Gemini Guided Learning, quizzes, flashcards, practice tests (SAT/JEE Main/NEET UG) are on the free tier [S13][S14]; Claude's Learning style is free. We cannot charge for "Socratic mode" alone.
4. **Structured study artefacts are now standard:** Gemini makes interactive quizzes with hints, "Analyze my performance", flashcards with shuffle + TTS, timed full-length practice tests, and "study notebooks" with a diagnostic quiz → adaptive bite-sized lessons → progress tracking [S13][S15]. NotebookLM (renamed "Gemini Notebook" in 2026) gives flashcards/quizzes/reports/mind maps/audio+video overviews with per-day quotas (Free: 10 quizzes/day, 3 audio overviews/day) [S16]. ChatGPT added in-conversation interactive quizzes to all consumer plans on 14 Aug 2026 [S6] and 70+ interactive math/science visualisations (Mar 2026) [S7].
5. **Google is the most complete "education stack":** free AI Pro for students (1 year, US) / AI Plus in 140+ countries [S18][S17]; teacher-led Guided Learning, study notebooks and NotebookLM assignable from Google Classroom; a Classroom MCP server; Chromebook "Class tools" that can lock students into Guided Learning; Princeton Review GRE/ACT practice tests inside Gemini [S11][S12]. Any curriculum-specific product must be visibly better than "free Gemini + NotebookLM".
6. **OpenAI's education moat is *teen safety + parental controls*, not pedagogy.** ChatGPT for Teens (18 Aug 2026): auto-placement of 13–17s via age prediction, Study Mode default, "responsible homework reminders" that detect shortcut attempts, Study Hours, Quiet Hours, break reminders, sensitive-image reminders, no romantic language, parent safety notifications without transcript access [S3][S4]. Regulators and schools will expect this bar from us.
7. **Evidence claims are still weak.** OpenAI's own RCT (300+ college students): ~15% higher exam score in microeconomics, no significant effect in neuroscience [S8]. Google cites "experts preferred LearnLM over GPT-4o by 31%" (2025, expert preference not learning outcomes) [S9]. Nobody publishes exam-grade uplift for a national curriculum. We can win on measured outcomes.
8. **Memory has converged on "auto-synthesised, editable, per-project, with incognito".** ChatGPT (June 2026) replaced the saved-memories list with an auto-rewritten "memory summary" + per-response "sources" [S5][S6]; Claude (Jul–Aug 2026) stores editable "Topics", per-project memory, excludes sensitive topics by default, and is free [S20][S21]; Gemini imports memories from other assistants [S17]. Table stakes: editable memory, project-scoped memory, temporary/incognito chat, import/export.
9. **Model pickers are a mess users hate but insist on keeping.** The GPT-5 auto-router (Aug 2025) triggered a revolt ("a model picker that's now basically UI theater" [S31]); OpenAI restored legacy models, then went through Thinking Light/Standard/Extended/Heavy → Instant/Medium/High/Extra High/Pro Standard/Pro Extended (June 2026) [S6]. Gemini exposes Fast/Thinking/Pro + Standard/Extended/Deep Think [S10]. Users want *effort control*, not model names.
10. **Usage limits are the #1 complaint for Claude and a top-3 for everyone.** r/ClaudeAI limits megathread: 799 upvotes / 6,270 comments; "'Hi' costing 3-4%"; "Pro plan is basically unusable"; users cancel because they "don't want to think about optimizing prompts" [S32]. Anthropic's own help page lists eight factors that consume limits and a Settings > Usage progress bar [S22]. Gemini moved to opaque "compute-based" 5-hour/weekly limits (May 2026) [S10]. Transparent, predictable limits are a differentiator.
11. **Sycophancy and verbosity are the dominant *quality* complaints.** "It starts all answers with 'ooooh I love this question'" [S33]; 5,336-upvote thread on prompts to stop "glazing" [S34]; OpenAI shipped tone presets, warmth/enthusiasm/emoji/headers sliders (Dec 2025) and a "Candid" preset in response [S6]. For exam prep, flattery is actively harmful: a tutor must say "this would get 2/8 marks" and why.
12. **Context loss inside long chats is a universal complaint** ("behavior becoming fuzzier after roughly 40-50 messages" for ChatGPT [S30]; Gemini "forgets the context immediately", UI context ~32K on free [S35][S10]). Claude introduced context compaction for "infinite-length conversations" (Nov 2025) [S19]; ChatGPT loads long chats progressively (Aug 2026) [S6]. A study session that spans weeks needs durable structured state, not one long chat.
13. **Prices have standardised at $0 / ~$5–10 / $20 / $100 / $200.** ChatGPT Free/Go/Plus/Pro (Pro = 5x or 20x Plus) [S1] (Go ≈ $8, Plus $20, Pro $100/$200 per third parties [S36]); Google AI Plus $4.99, Pro $19.99, Ultra $99.99/$199.99 [S17]; Claude Pro $20 ($17 annual), Max $100/$200 [S23]; Mistral Pro $14.99 (students $5.99) [S24]; Perplexity $20/$200 + $10 Education Pro (third-party) [S37]; Grok Lite $10 / SuperGrok $30 / Heavy $300 (third-party) [S38]. Ads arrived on ChatGPT Free/Go (US Feb 2026, UK June 2026), never for under-18s [S25].
14. **Student discounts are now a competitive weapon:** Google gives a whole year of AI Pro free; Mistral $5.99; Perplexity $10 Education; ChatGPT Go free for 12 months in India [S6]. Expect a student's willingness to pay to be anchored at ~$5–10/month.
15. **Free tiers are generous on the chat loop, stingy on files/uploads/context.** ChatGPT Free: 3 file uploads/day, 27K context (Instant), 5 files per project [S26][S1][S27]; Gemini free: 32K context [S10]; NotebookLM free: 50 sources/notebook, 50 chats/day [S16]. An exam-prep product that ingests textbooks and past papers *for* the student sidesteps the upload-limit pain.
16. **Voice has split into two camps:** OpenAI's full-duplex GPT-Live-1 (interrupt naturally, text streams alongside speech) but no camera/screen share yet [S6]; Gemini Live has camera + screen share in free tier and is now merged into chat (May 2026) [S17]. Voice tutoring with a camera pointed at handwritten working is a real, shipped expectation.
17. **Side-by-side editing is universal:** ChatGPT Canvas (targeted paragraph rewrite, shared links require an account), Claude Artifacts (publishable, embeddable, now edit-in-place "highlight and type the change", Jun 2026) [S19], Gemini Canvas (also hosts quizzes/flashcards/practice tests) [S13], Mistral Canvas [S24]. A "worked answer / essay draft" pane is expected.
18. **Agentic modes are consolidating but are not learning features:** ChatGPT Agent mode/Operator/Atlas were folded into "ChatGPT Work" (9 Jul 2026), Atlas retired 9 Aug 2026 [S6]; Claude Cowork (GA Apr 2026, web/mobile Jul 2026) with scheduled tasks and computer use [S19]; Gemini Agent/Spark (Ultra only) [S17]. Nice-to-have for us: scheduled revision tasks, not generic agents.
19. **Connectors/apps are table stakes for adults, marginal for a 16-year-old.** ChatGPT app directory (Dec 2025), Google Drive in Library, Gmail/Calendar; Claude MCP connectors even on Free [S23]; Gemini connected apps incl. Canva/OpenTable [S17]. For students the relevant integrations are LMS (Canvas, Schoology, Moodle, Google Classroom), Google Drive and calendar for a revision timetable.
20. **Well-being controls are becoming standard for consumer AI:** Claude break reminders + quiet hours + monthly "Reflect" recap (Jul 2026) [S19][S28]; ChatGPT Teens break reminders, Quiet Hours [S3]; Gemini under-13 via Family Link only, no supervised accounts in EEA/UK [S29]. Build these in from day one.
21. **Where all of them are bad (exploitable):** no curriculum/mark-scheme grounding; no persistent mastery model per syllabus point; no spaced-repetition scheduler across sessions (Gemini study notebooks come closest); no exam-style marking with examiner language; sycophancy; opaque limits; learning mode that can be switched off in one click; quizzes generated from thin air (hallucinated facts); no under-18 product outside the US/EEA-restricted paths; laggy long chats; sidebar clutter.
22. **UX details worth copying:** ChatGPT's model/effort picker inside the composer; branch-from-any-message; "interrupt and update mid-run"; large pastes auto-converted to attachments; Cmd+A selects only conversation; Claude's usage progress bars, ghost-icon incognito, memory citations to past chats, calm typography; Gemini's "Analyze my performance" and shareable quizzes; NotebookLM's Studio panel and source-grounded citations.
23. **UX details to avoid:** silent model downgrades and routing; multiple overlapping "modes" (Study vs Quizzes vs Projects vs GPTs, with Study mode unavailable inside Projects/GPTs/Temporary chats [S2]); features gated by country/age/account-type in confusing ways (Gemini study notebooks 18+, OpenStax US-only); Gemini "randomly starts generating images out of nowhere" [S35]; unannounced limit cuts.
24. **Strategic conclusion:** parity is achievable on the *chat core* (streaming, edit/regenerate, branching, effort picker, memory, projects, files, canvas, voice, search with citations, temporary chat, sharing/export, mobile/desktop, shortcuts, accessibility). Do **not** chase image/video/music generation, agents, sites, shopping, health. Spend the surplus on the exam-grounded learning engine, transparent limits, an anti-sycophancy tutor voice, and a UI that is visibly calmer than ChatGPT's.

---

## 1. Product-by-product inventory

### 1.1 ChatGPT (OpenAI) — Free / Go / Plus / Pro / Edu / Teens

**Plans and prices** (pricing page as of 6 Sep 2026; prices render client-side so dollar amounts come from third-party trackers [S36]): Free ($0), Go (≈$8/mo; "may include ads"), Plus (≈$20), Pro ("From" ≈$100 with "5x or 20x more usage"; a "Pro Lite" tier is referenced in the Sites release note), Business, Enterprise, Edu (contact sales), K-12 Teachers plan page [S1][S6]. Free: "Unlimited text chats with GPT-5.6 Luna" plus *limited* uploads, image generation, voice, deep research, memory/context, Codex and ChatGPT Work. Plus adds "Advanced reasoning models with GPT-6 Astra and GPT-5.6", projects, scheduled tasks, custom GPTs, expanded memory. Pro adds "Pro reasoning powered by GPT-6 Astra", unlimited/faster images, maximum deep research [S1].

**Context windows by plan** (official table): GPT Instant total 27K (Free) / 54K (Go, Plus) / 128K (Pro); input max "~12 / ~40 / ~40 / ~250 pages". Reasoning total "Varies" (Free) / 256K / 256K / 400K; input ~320 / ~320 / ~680 pages. OpenAI notes the user-input share is smaller because system instructions, tools, personality and memories consume the window [S1].

**Feature matrix (official)** [S1]: Projects and shared projects (all plans); scheduled tasks (Go+); Sites (Plus+); built-in browser (all); Plugins (all); Skills beta (all); Study mode (all); Voice (all), Voice with video (Go+); Memory (Free "Limited"); Search (all); Data analysis (Free limited); Vision (Free limited); Interactive apps (all); Create & share GPTs (Go+); Interactive tables and charts (Plus+); Record mode (Plus+); Developer mode (Plus+); Image generation with Thinking (Plus+); Deep research (Free/Go limited).

**Conversation UX (from release notes)** [S6]:
- Model/effort picker now lives in the composer (Apr 28 2026) and was simplified on Jun 10 2026 to Instant / Medium / High / Extra High (Pro) / Pro Standard / Pro Extended, with a user toggle for whether Instant auto-escalates to Medium. "Think" button available even on Free/Go web (Aug 14 2026).
- "Fast answers" (Apr 22 2026): high-confidence factual questions answered without personalisation; can be turned off.
- Branch conversation from any message ("Branch in new chat", Sept 4 2025, all logged-in web users).
- Interrupt long-running tasks and inject new information mid-run (Nov 5 2025).
- Personality presets (Default, Professional, Friendly, Candid, Quirky, Efficient, Nerdy→sunset Mar 2026, Cynical) plus sliders for warmth, enthusiasm, headers/lists, emojis (Dec 19 2025); custom instructions raised to 5,000 chars (Jul 15 2026); personality changes apply to existing chats immediately (Nov 7 2025).
- Long-chat performance: progressive message loading and streaming of interactive content (Aug 21 2026); 20 files per message; Cmd+A selects only the conversation (Feb 13 2026); large pastes become attachments (all plans, Aug 4 2026).
- Interactive code blocks with split-screen preview (Feb 19 2026); Canvas since Dec 2024.
- Search across chats, projects, images and documents from the sidebar with filters (Jul 14 2026, all plans); pinned chats; simplified mobile sidebar (Mar 26 2026); File Library (Mar 2026) with storage management; Google Drive in Library (Aug 2026).

**Memory** [S5][S6]: June 2026 "improved memory" replaces the list of saved memories with an auto-updated *memory summary* (editable by typing corrections or highlighting text; "Delete and turn off memory"), plus a per-response *sources* book icon explaining which memory/custom instruction/file shaped the answer. Legacy saved-memories mode is still selectable. Plus/Pro got "twice as much memory capacity". Temporary Chats don't read or write memory; since Aug 27 2026 a temporary chat can optionally be *personalised* (use memory/instructions) and can be *saved* into history [S6].

**Projects** [S27]: unlimited projects on all plans; file caps Free 5 / Go & Plus 25 / Pro, Edu, Business 40; project instructions override global custom instructions; "project-only memory" isolates context; sharing with edit/chat roles; collaborator caps Free 5 / Plus & Go 10 / Pro 100; branched chats inside shared projects. Notably, **Study Mode and Study Hours do not apply inside Projects, GPTs or Temporary Chats** [S2][S27].

**Files** [S26]: 512 MB per file, 2M tokens per text file, ~50 MB spreadsheets, 20 MB images; 80 files per 3 hours (paid), **Free: 3 uploads/day**; 25 GB storage per user; images inside PDFs are discarded except Enterprise "visual retrieval".

**Study Mode** [S2][S40]: activated via `@study`, the `+` tools menu, or chatgpt.com/studymode; available on all plans, all models, web/iOS/Android. Behaviours: Socratic guiding questions, layered explanations, knowledge checks, works with uploads, personalised via memory. Can be turned off by deleting the token. Some accounts see a separate **Quizzes** shortcut; in-conversation interactive quizzes shipped to all consumer plans 14 Aug 2026 [S6]. Edu admins can force study mode workspace-wide (selector then disappears). OpenAI's own limitations text: "there may be times when it gives a direct answer"; it "does not add extra messages, bypass rate limits". Marketing page promises "Progress tracking: See what you've mastered and where to focus next" [S40] — in practice this is conversational, not a dashboard (prior knowledge, unverified).

**Learning visualisations** [S7]: 10 Mar 2026, 70+ math/science concepts (Pythagorean theorem, PV=nRT, Ohm's law, compound interest…) rendered as manipulable modules, all plans. OpenAI states "140 million people use ChatGPT to help them understand math and science concepts" weekly.

**Evidence** [S8]: RCT with 300+ college students; microeconomics: ~15% higher exam score vs no-AI control (intention-to-treat); neuroscience: directionally positive, not significant, with onboarding/technical issues. OpenAI is building a "Learning Outcomes Measurement Suite" with Univ. of Tartu and Stanford SCALE; ~20,000 Estonian students aged 16–18 in study.

**Teens & parental controls** [S3][S4]: ChatGPT for Teens (18 Aug 2026) auto-applied when age prediction or stated age says 13–17. Includes Study Mode, "responsible homework reminders" (detects shortcutting and redirects to Study Mode), Quizzes, Learning Visualizations, Study Hours (Study Mode default during set times), break reminders, sensitive-image upload reminders, teen onboarding, accent colours, no romantic language/emotional dependence. Parent controls (help centre): Reduce sensitive content (default on), model training, saved memories, Codex network access, cloud browser, Voice Mode, image generation, Study mode default (off by default), Study hours, Quiet hours (block usage); safety notifications for self-harm concerns and violent-content bans; parents *cannot* read chats; controls can be adjusted by asking ChatGPT in conversation; auto-removal at 18. Age prediction rolled out Jan 2026 (US) and EU Aug 25 2026 [S6][S39].

**Edu / Teachers** [S41][S6]: ChatGPT Edu = enterprise workspace for universities (SSO, no training, admin console, "Expanded access to GPT-6"); ChatGPT for Teachers for K-12 districts; Aug 2026 "College Student", "College Educator", "K-12 Educator" plugins for Work/Codex (study guides, quizzes, flashcards from course materials) — available only via Edu/Teacher deployments.

**Agents/Work** [S6][S42]: "ChatGPT Work" (9 Jul 2026) replaced Agent mode; available to all plans on desktop, Plus+ on web/mobile; scheduled tasks now webhook-triggered (Gmail/Slack/GitHub) and shareable, with a Free tier (Aug 25 2026); Sites (public beta, Plus+); Skills GA; Codex app. Group chats and the Atlas browser were retired (Jul–Aug 2026).

**Voice** [S6]: GPT-Live-1 (paid) / GPT-Live-1 mini (Free) since 8 Jul 2026: full-duplex, text streams alongside speech, uses search and memory, widgets; **no video or screen sharing** yet (Advanced Voice Mode retains them). Lock-screen live content (Aug 2026). Dictation improvements.

**Ads** [S25]: testing since 9 Feb 2026 (US), then AU/NZ/CA (Apr), UK (Jun). Free and Go only; never shown to accounts identified as under 18; appear below responses; an "Ads-Free" Free option exists with lower limits; ads personalisation can use memory unless disabled.

### 1.2 Google Gemini app, Gemini for Education, NotebookLM / Gemini Notebook, LearnLM

**Plans** [S17]: Google AI Plus $4.99/mo (400 GB, 2x usage, 128K context), AI Pro $19.99 (5 TB, 4x usage, 1M context, Deep Research, Veo/Flow credits, NotebookLM higher limits, YouTube Premium Lite, Jules/Antigravity), AI Ultra from $99.99 (5x Pro) and $199.99 (20x Pro), Gemini Agent, Spark, Deep Think, 20–30 TB. Students: **one free year of AI Pro (US) or AI Plus (140+ countries)**, redeem until 31 Dec 2026 [S17][S18].

**Limits** [S10]: "compute-based usage limits… refresh every 5 hours until you reach your weekly limit" (changed 17 May 2026). Free context 32K tokens, Plus 128K, Pro/Ultra 1M. Models: Gemini 3 Flash-Lite / Flash / Pro on all plans (release notes reference 3.1 Pro, 3.5 Flash, 3.6 Flash in 2026). Thinking levels: Standard, Extended, Deep Think (Ultra only, minutes). Free tier includes Canvas, Gems, Storybook, Connected Apps, **Quizzes & flashcards**, Audio overviews, Screen automation, Slide generation, Deep Research, Nano Banana 2 images, Music; **not** free: Daily brief, Gemini Spark (Pro+), Nano Banana Pro redo, video generation, scheduled actions.

**Learning features** [S13][S14][S15][S9][S18]:
- Guided Learning (6 Aug 2025): LearnLM-infused mode via "Guided Learning" chip (desktop) / "Learn" chip (mobile) or More tools; Socratic questions, step-by-step, "images, diagrams, videos and interactive quizzes"; a shareable deep link for teachers (gemini.google.com/guided-learning?query=).
- Quizzes, flashcards, study guides, full-length **practice tests (SAT, JEE Main, NEET UG)** with timer and per-section scores; quiz UX has Show hint, ask side questions, Analyze my performance, More questions; flashcards have hint, shuffle, text-to-speech, restart; results open in Canvas; shareable via g.co/gemini/share (not for school accounts).
- Study notebooks (June 2026 desktop, Aug 2026 mobile, 18+ personal accounts, school accounts incl. under-18 "in the coming weeks"): "diagnostic quiz that identifies the areas they should focus on", "bite-sized, interactive lessons", progress that updates with new quiz results and uploads; syncs with NotebookLM; SAT support, GRE/ACT full tests with The Princeton Review, ENEM (Brazil). Requires Keep Activity on; goal can't be edited after creation. Dedicated **student hub** (Aug 19 2026) to manage classes and create notebooks from syllabi.
- Integrated images and YouTube videos in answers; `@OpenStax` textbook grounding (US, 18+, English only).
- Teacher side (ISTE, 25 Jun 2026): teacher-led Guided Learning, study notebooks and NotebookLM assigned from Google Classroom with class-material grounding and per-student insights; Classroom app in Gemini; Classroom MCP server for third-party EdTech; Gemini LTI (Schoology now, Canvas soon, Moodle manual); Chromebook Class tools can lock screens to Guided Learning/NotebookLM; "Gemini in Classroom" for students of all ages with study guide/quiz/Guided Learning [S11][S12].

**NotebookLM → "Gemini Notebook" quotas** [S16] (Standard / Plus / Pro / Ultra-20TB / Ultra-30TB): notebooks 100/200/500/500/500; sources per notebook 50/100/300/500/600; chats per day 50/200/500/2.5K/5K; audio overviews per day 3/6/20/100/200; video overviews 3/6/20/100/200 (cinematic 2/10/20 on Pro+); reports, flashcards, quizzes, mind maps 10/20/100/500/1K per day; Deep Research 10/month on free. Limits change from 2 Sep 2026. Interactive audio overviews, Studio panel (slides, infographics, data tables). Workspace for Education data not used for training.

**Other Gemini UX** [S17]: Temporary Chat (Aug 2025); chat history search (Aug 2025); Gems shareable (Sept 2025) and experimental mini-app Gems (Dec 2025); Personal Intelligence connects Gmail/Photos/YouTube/Search (Jan 2026, Pro/Ultra US, off by default); import memories/chat history from other assistants (Mar 2026); Gemini for Mac (Option+Space, window sharing, Apr 2026) with Fn-key dictation (Jul 2026); Gemini Live integrated into chat with app actions and camera-to-image (May 2026); richer responses with interactive multi-layer images and 30–60 s narrated video overviews for specific topics (Pro model); Gemini Agent (Ultra, US); Spark personal agent (Ultra); Daily Brief; connected apps OpenTable/Canva/Instacart; Gemini in Chrome with auto browse.

**Children** [S29]: under-13 access only via Family Link with extra filters ("avoid Gemini claiming to be a person"), Keep Activity unavailable, not available for supervised accounts in EEA/CH/UK; Google explicitly warns Gemini "can hallucinate" and "should not be treated as a friend".

**Learn About** [S43]: Google Labs experiment still live (learning.google.com/experiments/learn-about): "conversational learning companion" with interactive guides, Simplify / Go Deeper / Get images chips, embedded MCQs and misconception boxes, curated web images/videos. Not integrated into the Gemini app.

### 1.3 Claude.ai (Anthropic), Claude for Education, Claude for Teachers

**Plans** [S23]: Free ($0) includes web search, **memory across conversations**, file creation and code execution, desktop extensions, Slack/Google Workspace connectors, remote MCP connectors, extended thinking, artifacts, voice mode, incognito chats, skills. Pro $20/mo ($17 on annual) adds more usage, Claude Code, Cowork, Design, Science, unlimited projects, more models, Microsoft 365, Claude in Chrome. Max from $100 (5x or 20x Pro), priority access. Context window 200K on all plans; Fable-class models via usage credits / "50% of weekly limits" on Max.

**Usage limits** [S22]: consumption depends on message length, attachments, conversation length, tools (Research, web search), model, *effort level*, artifacts; project knowledge is cached and "doesn't count against your limits when reused"; paid plans see progress bars for the 5-hour session and weekly limits at Settings > Usage; usage bundles purchasable. Third-party trackers describe ~45 short messages per 5 hours on Pro and repeated silent tightening (Sept 2025, Mar 2026) [S44].

**Memory & privacy** [S20][S21][S19]: memory from chat history for **all users including Free** since 2 Mar 2026; since 10 Jul 2026 stored as individual, categorised, editable "Topics"; per-project memory spaces; sensitive topics (health, religion, politics…) excluded by default with an opt-in; some data never stored (IDs, financial account numbers); citations link to the past chats used; import/export memory; incognito chats via ghost icon (all plans); pause vs reset memory.

**Conversation UX** [S19]: context compaction for "infinite-length conversations" (Nov 2025); custom in-line charts/diagrams (Mar 2026); artifacts publishable/embeddable, and since Jun 2026 "highlight the part you want changed, type the change" in a side panel; interactive MCP apps on mobile; voice mode; styles menu incl. Learning (see below); model selector (Opus/Sonnet/Haiku; Fable 5.1 and Mythos 5.1 launched 1 Sep 2026, with a mid-2026 suspension/restoration episode); file creation (xlsx/pptx/docx/pdf).

**Well-being** [S28][S19]: break reminders and quiet hours (beta on Free/Pro/Max, Jul 2026; "Neither is a hard lock"); monthly "Reflect" recap of topics, peak hours and working patterns.

**Learning mode** [S45][S46][S47]: Claude for Education (2 Apr 2025) introduced Learning mode inside Projects: "Guiding rather than answering", Socratic questioning, core concepts, templates for research papers/study guides. In Aug 2025 the Learning *style* was opened to all claude.ai users via the style dropdown, and Claude Code gained "Explanatory" and "Learning" output styles (the latter asks the user to write small strategic pieces of code) [S46][S47]. The dedicated help article for learning mode now 404s and the Claude for Education help collection has only four admin/LTI articles [S48] — i.e. the feature is a prompt style, not a product surface. Anthropic's higher-ed page frames it as "works like a good tutor: it asks questions that help you find the answers yourself" [S49]. Connectors shown: Canvas LMS, Wiley, Panopto.

**Claude for Teachers** (14 Jul 2026) [S50][S51]: free premium Claude for verified US K-12 educators (sign up by 30 Jun 2027 for a year), with Learning Commons connector (standards for all 50 states, learning progressions), Illustrative Mathematics and OpenSciEd content, teaching Skills (open-sourced), connectors to ASSISTments, Brisk, Canva Education, Coteach, Diffit, Eedi, MagicSchool, Snorkl, TeachFX; Cowork scheduled tasks ("runs every school day at 4pm"); FERPA-aligned K-12 DPA; **18+ only** — Anthropic has no student-facing under-18 product. District offering launched 28 Aug 2026. Anthropic's own research notes cognitive effort "and even getting painfully stuck" matters for mastery [S52].

### 1.4 DeepSeek chat

Official API docs (6 Sep 2026) show the current lineup: `deepseek-v4-flash` (0731), `deepseek-v4-pro` (0813) and the experimental `deepseek-v4-flash-vision-exp` (21 Aug 2026, image input); thinking mode with `reasoning_effort`, Files API, context caching, Anthropic- and OpenAI-compatible endpoints [S53][S54]. Consumer app (iOS/Android launched 20 Jan 2025) per third-party guides: free, DeepThink shows chain-of-thought live, web search, file upload (PDF/DOCX/TXT/code) with text extraction, camera/photo input, "Instant" (V4-Flash) vs "Expert" (V4-Pro) modes, 1M-token context since Feb 2026, cross-device sync [S55]. No projects/memory/voice/canvas/parental controls are documented. Dominant complaint since launch: "The server is busy. Please try again later." — "after the second chat… 'server busy'", "I literally cant use deepseek at all" [S56][S57]. Relevance for us: DeepSeek is a cheap, strong reasoning back-end (visible reasoning is a pedagogical asset for showing working), not a UX benchmark.

### 1.5 Secondary: Grok, Microsoft Copilot, Perplexity, Mistral

- **Grok (xAI)** (third-party pricing, Aug–Sep 2026) [S38]: Free; SuperGrok Lite $10 (Mar 2026); SuperGrok $30; SuperGrok Plus $100 (one source); SuperGrok Heavy $300; X Premium $8 / Premium+ $40. June 2026 switch to a single weekly usage pool across Chat/Imagine/Voice/Build. Features: DeepSearch, Think/Big Brain, voice with camera mode, Grok Imagine, companions (being retired) [S58]. No learning mode; not a benchmark for education; relevant only for its voice camera mode and 2M-context claims.
- **Microsoft Copilot** [S59][S60]: consumer Copilot Pro ($20) retired for new users 1 Oct 2025, support ended 1 Aug 2026; replacement is Microsoft 365 Premium $19.99 (Office + 6 TB); Microsoft 365 Personal/Family get 60 AI credits/month. Consumer and business apps are being merged into a "Super App"; Copilot Podcasts, Group Chat and Deep Research removed from the consumer app from 18 Aug 2026; Copilot Notebooks (study guides, mind maps) rolling out. Copilot's "study" positioning is weak; its education relevance is Microsoft 365 Education distribution, not features.
- **Perplexity** [S61][S37]: Pro (help page 21 Jul 2026): 10x citations, model choice (GPT-5.2, Claude Sonnet 4.6, Gemini 3.1 Pro, Grok 4, Sonnet Thinking; o3-Pro/Opus for Max), Best/Pro/Reasoning/Research modes, uploads incl. audio/video, image/video generation, "Create files and apps". Third-party: $20 Pro / $200 Max / **$10 Education Pro** / Comet browser free, Spaces (50 files per space on Pro), Model Council. Perplexity's citation UX (numbered inline sources, "10x citations") remains the reference for source display.
- **Mistral (Le Chat → "Vibe")** [S24]: Free (limited messages/search, image gen, 100+ connectors, $10 API credits); Pro $14.99 (**students $5.99**, max 12 months); Team $24.99; feature table: messages up to 6x free, web searches 5x, libraries/document upload 15 GB, task scheduling (5 on free), Canvas, project folders (1,000), image gen 40x, voice mode (transcription-style), Skills, custom MCP connectors, "Verified news". Memories (beta) with transparent recall (third-party) [S62].

---

## 2. Conversation UX, memory, organisation: what "good" looks like in 2026

| Capability | ChatGPT | Gemini | Claude | DeepSeek | Notes / best-in-class |
|---|---|---|---|---|---|
| Streaming + stop | Yes; progressive load of long chats; interactive content streams | Yes | Yes | Yes (streams reasoning) | ChatGPT Aug 2026 [S6] |
| Edit & regenerate user msg | Yes (all msgs) | Only most recent prompt (complaint) [S35] | Yes | Yes (prior knowledge) | Gemini gap: "I still can't go back and edit my own previous prompts" |
| Branch from a message | "Branch in new chat" (Sept 2025) | No | No (prior knowledge) | No | ChatGPT |
| Model / effort picker | In composer; Instant/Medium/High/Extra High/Pro; auto-escalate toggle | Fast/Thinking/Pro + Standard/Extended/Deep Think | Model dropdown + effort/extended thinking | Instant/Expert + DeepThink toggle | Effort dial > model names |
| Interrupt & redirect mid-task | Yes (Nov 2025) | Agent pause/take over | Cowork steer | — | ChatGPT |
| Tone/length controls | 8 presets + sliders (warmth, enthusiasm, headers, emoji); 5,000-char instructions | Saved info / Gems | Styles (Normal, Concise, Explanatory, Formal, Learning, custom) | — | Claude styles are the cleanest mental model |
| Follow-up suggestions | Homepage suggestions (paid), composer suggestions (Android) | Suggested chips | Minimal | — | Keep minimal |
| Memory | Auto memory summary + sources; project-only memory; temp chat | Personal context + Personal Intelligence (Pro+); import | Editable Topics; per-project; sensitive-topic opt-in; free | — | Claude (transparency), ChatGPT (sources UI) |
| Temporary / incognito | Temporary Chat; optional personalised; saveable | Temporary Chat | Incognito (ghost) | — | All |
| Projects / folders | Projects (files, instructions, sharing, branching) | Notebooks + study notebooks (18+) | Projects (Pro+), cached knowledge, RAG mode | — | ChatGPT for structure, Claude for caching |
| Search history | Chats+projects+files+images w/ filters | Chat search | Ask Claude to search past chats (paid) | — | ChatGPT |
| Canvas / artifacts | Canvas; interactive code blocks | Canvas (hosts quizzes/tests) | Artifacts, edit-in-place, publish/embed | — | Claude for publish; Gemini for study objects |
| Files | 512 MB, 3/day free, 80/3h paid, 20 per msg | Up to 600 sources in notebooks by plan | Files + code exec on Free | PDF/DOCX/TXT/code | Free upload caps hurt students |
| Voice | GPT-Live-1 full duplex; no video yet; AVM has video | Live with camera + screen share, merged into chat | Voice mode (all plans) | — | Gemini for perception |
| Web search + citations | Yes | Yes (Google) | Yes (Free) | Yes | Perplexity remains citation benchmark |
| Deep research | Yes (limited free) | Yes (free, quota) | Research (paid) | — | Not core for exam prep |
| Scheduled tasks | Go+; webhooks; sharing | Pro+ scheduled actions | Cowork (Pro+) | — | Use for revision reminders |
| Sharing/export | Shared links (login to view), shared projects, export data | Share links g.co, shared Gems | Publish artifacts (no login), embed, memory export | — | Claude public artifacts |
| Desktop apps | macOS, Windows, Linux (Aug 2026) | macOS (Apr 2026) | macOS, Windows | — | |
| Keyboard shortcuts | Yes (Cmd+A fix, Option/⌘ shortcuts) | Option+Space (Mac) | Yes | — | (prior knowledge for full lists) |
| Ads | Free/Go (not <18) | No | No | No | |

---

## 3. Study & learning modes compared

| Dimension | ChatGPT Study Mode | Gemini Guided Learning + study tools | Claude Learning style | NotebookLM / Gemini Notebook |
|---|---|---|---|---|
| Launch | 29 Jul 2025 [S6] | 6 Aug 2025 [S9] | Apr 2025 (Edu), Aug 2025 (all) [S45][S46] | 2024–26 rolling |
| Mechanism | System instructions written with teachers [S8] | LearnLM fine-tuned models + UI chips [S9] | Style/system prompt | Source-grounded generation |
| Plans | All, incl. Free | All, incl. Free | All, incl. Free | Free with quotas |
| Activation | `@study`, + menu, URL; not in Projects/GPTs/Temp | Chip/More tools; teacher deep link; Classroom lock | Style dropdown | Notebook → Studio |
| Quizzes | Interactive quizzes in chat (Aug 2026); flashcard-style text | Interactive quizzes with hints, analysis, more questions; flashcards w/ shuffle+TTS; timed practice tests SAT/JEE/NEET; GRE/ACT (Princeton Review) | Ad hoc in chat | Quizzes (10/day free), flashcards with progress tracking |
| Adaptive plan | No (conversational) | Study notebooks: diagnostic → lessons → auto-updating | No | Learning guide (prior knowledge) |
| Visuals | 70+ interactive math/science modules | Images + YouTube + interactive multi-layer images + 30–60 s video overviews | In-line charts/diagrams | Audio/video overviews, mind maps, slides, infographics |
| Curriculum grounding | Uploads; Edu plugins (College Student…) | Uploads; @OpenStax (US); Classroom materials (teacher-led) | Projects; Canvas LTI | Your sources only |
| Under-18 handling | ChatGPT for Teens; Study Hours; homework reminders | Study notebooks 18+ (school accounts coming); Family Link <13; EEA restricted | 18+ only | Above age of consent |
| Enforcement | Parent/admin can default it on; user can still turn off | Teacher lock via Class tools (Chromebook only) | None | n/a |
| Evidence | RCT: +15% microeconomics, n.s. neuroscience [S8] | "31% expert preference" [S9]; Sierra Leone teacher study cited [S11] | None published | None |
| Progress tracking | Marketing claims; no dashboard | Study notebook proficiency; quiz analysis | None | Flashcard progress |

Reception (Reddit): "ChatGPT's Study mode is really good" (367 upvotes, r/singularity) vs "I predict this will be removed in 6 months. Nobody is going to use it… it's not the easy mode that most want" (top comment on a 1,225-upvote r/ChatGPT thread) [S63][S64]; "chatgpt study mode feels like a marketing gimmick" (r/ChatGPTPro) [S65]; "I enjoyed the Gemini learning mode better" [S66]; a teacher: "The issue with using AI to learn is when it gets something wrong - and you don't realize because you're not an expert" [S67]; "Oh wow, they prompted their own AI to do something others figured out 27 months ago" [S68].

---

## 4. What power users consider essential vs gimmick

Essential (evidence: features users demand back when removed, or that dominate complaint threads):
1. Choice/visibility of model and reasoning effort — the GPT-5 router backlash forced OpenAI to restore legacy models within days [S31][S69].
2. Predictable usage limits with a visible meter [S32][S22].
3. Memory that is inspectable and editable, plus a true incognito mode [S5][S20].
4. Edit any earlier message and branch — Gemini users cite its absence as a reason "the Gemini app [is] so bad" [S35].
5. Stable long conversations; no silent context loss [S30][S35].
6. Fast, calm UI; no lag when typing [S70].
7. File upload without daily caps (students hit "3 per day" quickly) [S26].
8. Search over history; projects/folders [S6][S27].
9. Custom instructions that persist and apply everywhere [S6].
10. A tone that is not sycophantic ("Candid" preset demand) [S33][S34].

Gimmick or low-value for a learning product (shipped, rarely praised in learning contexts): 3D companions (Grok, being retired) [S58]; "Quirky/Cynical" personalities; sticker packs; music/video generation; Daily Brief; shopping/Instant Checkout; group chats (retired by OpenAI Jul 2026) [S6]; Sites; standalone AI browsers (Atlas retired Aug 2026) [S6]; "Your Year with ChatGPT" style recaps (nice but not core).

---

## 5. What users complain about most (with quotes)

| Complaint | Product | Evidence |
|---|---|---|
| Sycophancy / flattery | ChatGPT | "It starts all answers with 'ooooh I love this question'" [S33]; 5,336-upvote thread "For those of you who are tired of ChatGPT glazing" [S34]; "Endless flattery about how thoughtful & intelligent my requests are" [S71]; Altman admitted GPT-4o became "sycophant-y and annoying" [S30] |
| Forgetting context in long chats | ChatGPT, Gemini | "behavior becoming fuzzier after roughly 40-50 messages" [S30]; "Gemini forgets the context immediately" (r/GoogleGeminiAI) [S35]; "Gemini 3.0 forgets entire context of conversation" (r/Bard) [S72]; "context in Web / Phone UI… somewhere around the 32K range" [S73] |
| Usage limits / opacity | Claude | Megathread 799↑/6,270 comments: "'Hi' costing 3-4%. Max 20× plans dying in a day" [S32]; "Pro plan is basically unusable" (431↑) [S74]; "I've given up on Claude and cancelled… hard to understand how the limits work" [S75]; "Subscribed yesterday to Pro and I'm already hit by [limits]" (636↑) [S76] |
| Model switching / silent routing | ChatGPT | "Adults deserve to choose the model… Instead we're getting silent overrides, secret safety routers and a model picker that's now basically UI theater" [S31] |
| Verbose, over-formatted answers | ChatGPT | OpenAI shipped sliders for "more or fewer headers & lists" and emojis in response [S6] |
| Server unavailability | DeepSeek | "after the second chat… 'server busy'" [S56]; "I literally cant use deepseek at all" [S57] |
| Random/unwanted behaviour | Gemini | "Randomly starts generating images out of nowhere… breaks the flow completely" [S35]; fabricated URLs from search [S77] |
| Can't edit old prompts | Gemini | "I still can't go back and edit my own previous prompts. Claude and Chat GPT have this feature." [S35] |
| Slowness / lag | ChatGPT | Trustpilot 1.6/5 with "slow performance, glitches"; iOS typing lag [S70] |
| Feature fragmentation | Gemini/Google | Study notebooks 18+, personal accounts only, desktop first; OpenStax US-only; Class tools need Chromebooks [S15][S14][S11] |
| Hallucination in study context | All | Teacher: "when it gets something wrong - and you don't realize because you're not an expert" [S67]; Google's own child guidance: Gemini "can hallucinate and present inaccurate information as factual" [S29] |

---

## 6. MASTER PARITY CHECKLIST

Priority key: **M** = must-have at launch, **S** = should-have within first 2 quarters, **N** = nice-to-have / skip. "Has it": C = ChatGPT, G = Gemini, A = Claude, D = DeepSeek.

| # | Feature | Who has it | Priority | Notes for us |
|---|---|---|---|---|
| 1 | Token streaming with stop; progressive loading of long threads | C G A D | M | Target first token < 1 s; never block UI while loading history [S6] |
| 2 | Edit any earlier user message + regenerate | C A (G only last) | M | Gemini's gap is a named complaint [S35] |
| 3 | Branch from any message | C | M | Cheap to build on top of #2; useful for "try another method" |
| 4 | Effort/model control in composer (Fast / Think / Deep) with auto-escalate toggle | C G A D | M | Expose *effort*, hide vendor model names by default; power-user override [S6][S10] |
| 5 | Visible reasoning summary ("show working") | D (full), C/G/A (summaries) | S | Pedagogically valuable; DeepSeek-style live reasoning for maths |
| 6 | Interrupt and add info mid-generation | C | S | [S6] |
| 7 | Tone/length presets + sliders; persistent custom instructions (≥5,000 chars) | C A | M | Ship "Examiner", "Coach", "Plain" voices; never a flattering default |
| 8 | Memory: auto-synthesised, inspectable, editable, per-project, sensitive-topic exclusion, export/import | C A G | M | Claude's Topics + ChatGPT's per-answer "sources" are the bar [S20][S5] |
| 9 | Temporary/incognito chat (optionally personalised, saveable) | C G A | M | [S6][S21] |
| 10 | Projects/folders with files + instructions + project-only memory | C A G | M | For us: one "Course" = subject + board + exam session |
| 11 | Shared projects / share a chat via link (no login to view) | C A G | S | Claude's public artifacts need no account [S19] |
| 12 | Search across chats, files, projects | C G A | M | [S6] |
| 13 | Pinned/archived chats; simplified sidebar | C | M | Avoid sidebar clutter complaints |
| 14 | File upload: PDF, DOCX, PPTX, XLSX/CSV, images, code; ≥20 files/msg; OCR of handwriting | C G A D | M | Our textbooks/papers are pre-ingested so per-user caps can be generous |
| 15 | Vision input incl. photo of handwritten working | C G A D(vision-exp) | M | Core for maths/science marking |
| 16 | Canvas/artifact side panel with edit-in-place and versioning | C G A | M | Use for essays, worked solutions, notes; publish/export |
| 17 | Code interpreter / data analysis with charts | C G A | S | Needed for stats, economics, CS courses |
| 18 | Web search with inline numbered citations | C G A D | M | Restrict/label sources; prefer curriculum library first |
| 19 | Deep research reports | C G A | N | Not exam-critical; can use founder's APIs later |
| 20 | Voice: real-time, interruptible, text transcript alongside | C G A | S | Oral-exam practice, language speaking practice |
| 21 | Voice + camera / screen share | G (free), C (AVM) | S | "Point camera at your working" tutoring |
| 22 | Image generation | C G A(limited) | N | Only diagrams/graphs matter; use deterministic renderers instead |
| 23 | Video/music generation | G C | N | Skip |
| 24 | Scheduled tasks / reminders | C G A | S | Revision schedule, spaced-repetition pushes |
| 25 | Agent / computer use / browser agent | C G A | N | Skip for v1 |
| 26 | Connectors: Google Drive, Calendar, LMS (Canvas, Classroom, Schoology, Moodle) | C G A | S | Classroom MCP server and Gemini LTI are the reference [S11] |
| 27 | Custom bots (GPTs/Gems/Skills) + directory | C G A | N→S | Teacher-authored "course skills" later |
| 28 | MCP support (client) | C A G | S | Cheap to add; lets schools plug in |
| 29 | Interactive quizzes in chat with hints, per-question feedback, "analyse my performance" | G C | M | Gemini's quiz UX is the bar [S13] |
| 30 | Flashcards with shuffle, TTS, progress | G, NotebookLM | M | Add real SRS scheduling (none of them do) |
| 31 | Timed full-length practice tests with section scores | G (SAT/JEE/NEET/GRE/ACT) | M | We do it with *real past papers + mark schemes* |
| 32 | Diagnostic → adaptive lesson plan → progress | G study notebooks | M | Our core; must generalise across curricula |
| 33 | Socratic/guided mode with layered explanations | C G A | M | Default-on for students; lockable by parent/teacher |
| 34 | Interactive concept visualisations | C (70+), G | S | Start with syllabus-mapped diagrams |
| 35 | Audio overview / podcast of notes | NotebookLM, G, Copilot(removed) | N→S | Commute revision; low priority |
| 36 | Source-grounded answers with citations to *your* materials | NotebookLM, C projects | M | Cite textbook page + mark-scheme line |
| 37 | Teen mode, age assurance, parental controls (quiet hours, study hours, notifications, no transcripts) | C (full), G (Family Link) | M | Required for a school-age product; copy OpenAI's control list [S4] |
| 38 | Break reminders / well-being nudges | A C | S | Cheap goodwill [S28] |
| 39 | Usage meter with session + weekly bars; predictable limits | A | M | Turn the industry's worst complaint into a feature |
| 40 | Mobile apps (iOS/Android) with widgets, lock-screen live activity, dictation | C G A D | M | Widgets: "today's revision", streak |
| 41 | Desktop apps (macOS/Windows), global hotkey | C G A | S | |
| 42 | Keyboard shortcuts, screen-reader labels, reduced-motion, dyslexia-friendly type | C A | M | Accessibility is legally required for schools |
| 43 | Multilingual UI + tutoring in student's language | C G A D | M | ЕГЭ/UNT/JEE markets |
| 44 | Offline | none | N | Cache notes/flashcards only |
| 45 | Export (PDF/Markdown/Anki/Docs) and full data export | C A G | M | Anki export wins Reddit goodwill [S63] |
| 46 | Ads | C | N | Never; especially not for minors |
| 47 | Student pricing (~$5–10) / free tier without upload starvation | G (free year), Mistral $5.99, Perplexity $10 | M | Anchor: free core + ~$8–10 student plan |

---

## 7. "Things all of them do badly" that a learning-first product can exploit

1. **No exam-board grounding.** None maps answers to a specific syllabus code, assessment objective, command word or mark-scheme point. Gemini's closest is @OpenStax (US-only) and teacher-uploaded Classroom material; ChatGPT relies on user uploads. Our library of textbooks + past papers + examiner reports is unique if it is surfaced *in the UI* (citations to "9609/22 May 2024 Q3(b), mark scheme p.7").
2. **Learning mode is opt-out in one click** and OpenAI concedes it sometimes just answers [S2]. A product whose *default* is a scaffolded tutor, with a "just show me" escape hatch that is logged and rate-limited (and visible to parent/teacher), is a different value proposition.
3. **No persistent mastery model.** ChatGPT's "progress tracking" is marketing copy; Gemini's study notebooks track proficiency but are 18+, personal-account, goal-immutable, and siloed from chat. A per-syllabus-point mastery graph that every chat, quiz and paper updates is not offered anywhere.
4. **No real spaced repetition.** NotebookLM flashcards remember correct/incorrect; nobody schedules review with an SRS algorithm across sessions. Reddit users export to Anki manually [S63].
5. **No exam-style marking.** None produces "you would score 4/8: AO1 knowledge shown, AO3 evaluation missing; examiner report 2023 says candidates often…". This is the highest-value, hardest-to-copy feature and plays directly to the founder's asset base.
6. **Sycophancy.** Frontier defaults praise; Candid/Cynical presets are bolt-ons. An examiner does not say "great question". Build the voice into the system prompt and eval it.
7. **Hallucinated quiz content.** Quizzes are generated from model knowledge; a teacher's warning ("when it gets something wrong… you don't realize") [S67] is the core risk. Ground every question in a retrieved source, show the source, and let students report errors.
8. **Opaque and shrinking limits.** Claude's megathread and Gemini's "compute-based" limits show the pain [S32][S10]. Publish limits in plain numbers (questions/day, papers/week), show a meter, never cut silently.
9. **Long-chat context decay.** Study spans weeks. Keep durable state (mastery, misconceptions, current topic, exam date) *outside* the chat and re-inject it; keep chats short by design (one topic per session), which also sidesteps the 40–50-message degradation [S30].
10. **Age fragmentation.** Gemini's best learning surfaces are 18+; Claude is 18+; ChatGPT has the only real teen product, US-first. A 13–18 product that is compliant in the UK/EU/CIS/India from day one is open territory.
11. **Teacher/parent visibility.** Only teacher-led Google Classroom flows and ChatGPT parental notifications exist; neither gives a parent a weekly "what your child practised and where they are weak" digest without exposing transcripts.
12. **Feature sprawl and mode confusion.** ChatGPT's Study mode cannot be used inside Projects or GPTs [S2]; Gemini has Guided Learning, quizzes, study notebooks, NotebookLM, Learn About and Classroom as separate surfaces. One coherent "Course" object with everything inside it is a UX win in itself.
13. **Ads and engagement optimisation.** ChatGPT Free/Go now has ads (adults only) [S25]; several products run streak/engagement mechanics. A calm, ad-free, "finish your session and go outside" posture will be noticed by parents and schools.
14. **Upload starvation on free tiers.** 3 uploads/day (ChatGPT Free) [S26] and 32K context (Gemini free) [S10] punish exactly the student behaviour we want (upload your notes, past paper, teacher feedback). Pre-ingested curriculum content plus generous student uploads is a cheap advantage.

---

## 8. UX details to copy or avoid

**Copy from ChatGPT** [S6][S27][S5]
- Composer-integrated model/effort selector; single "Think" affordance on free tiers.
- Branch from any message; interrupt-and-update mid-run.
- Large pastes auto-attach; Cmd+A copies conversation only; 20 files/message.
- Per-response "sources" popover explaining which memory/file/instruction shaped the answer.
- Projects with colours/icons, instructions that override globals, project-only memory toggle editable later.
- Study Hours / Quiet Hours model in parental controls; parents change settings by *asking the assistant* (with Allow/Deny confirmation).
- Fast answers: skip personalisation for pure lookups (but make it visible).

**Copy from Claude** [S19][S20][S22][S28]
- Usage meter with session and weekly bars; explicit list of what consumes usage; caching of project knowledge so re-reading a textbook is free.
- Editable memory Topics; sensitive-topic opt-in; citations to prior chats; import/export.
- Ghost-icon incognito; artifacts publish without login; edit-in-place by highlighting.
- Styles as one dropdown (Concise / Explanatory / Learning) rather than a mode maze.
- Break reminders, quiet hours, monthly recap framed as reflection, not gamification.
- Restrained visual language (serif display type, warm neutrals, low-contrast chrome) that reviewers describe as "well-designed and easy to navigate" [S78].

**Copy from Gemini / NotebookLM** [S13][S15][S16][S17]
- Quiz object: hint, side-question box, Next/Previous, "Analyze my performance", "More questions", timer and per-section score; flashcards with shuffle, TTS, restart.
- Study notebook loop: diagnostic quiz → plan → auto-update on new results; syncs with a source-grounded notebook.
- Teacher deep link into a specific mode; shareable study objects; import memory/chats from other assistants; Option+Space desktop overlay; voice merged into the same thread as text.
- NotebookLM's Studio panel (one-click outputs) and explicit, table-based quota disclosure.

**Avoid**
- Silent model routing/downgrades and unannounced limit cuts [S31][S32][S44].
- Modes that don't compose (Study mode unavailable in Projects/GPTs/Temp chats) [S2].
- Age/region/account-type gating of the *learning* features (Gemini study notebooks 18+, personal accounts only; OpenStax US-only) [S15][S14].
- Verbose, header-heavy default formatting that needs sliders to fix [S6].
- Surprise multimodal behaviour ("randomly starts generating images") [S35].
- Engagement ads/ad personalisation using memory (ChatGPT Free/Go) [S25].
- Retiring surfaces users adopted (group chats, Atlas, DALL·E GPT, Copilot Deep Research) — plan surfaces for longevity [S6][S59].
- A "learning" product for teens that ships nothing for teachers/parents (Claude) or nothing for under-18s outside the US (all).

---

## Implications for our product (testable rules and features)

1. **Rule: default mode is "Tutor" (scaffolded); "Answer" is an explicit, logged escape hatch.** Test: ≥70% of student sessions end with the student producing the final step; direct-answer requests < 20% of turns for accounts under 18.
2. **Rule: every quiz question, flashcard and model answer cites a source in our library** (textbook page or past paper + mark scheme). Test: 100% of generated assessment items carry a resolvable citation; error-report rate < 1%.
3. **Feature: Exam-style marking with assessment-objective breakdown and examiner-report language**, for any curriculum with a mark scheme. Test: agreement with human marker within ±1 mark on 80% of a 200-answer benchmark per subject.
4. **Feature: per-syllabus-point mastery graph** updated by chats, quizzes and papers; visible to student, and (aggregated) to parent/teacher. Test: mastery predicts practice-paper score with r ≥ 0.6 after 3 weeks of use.
5. **Feature: spaced-repetition scheduler** (SM-2/FSRS-class) across flashcards, misconceptions and past-paper questions, with daily widget and optional scheduled reminder. Test: 7-day retention of due items ≥ 80% for active users.
6. **Rule: anti-sycophancy voice.** No praise openers; feedback states the mark and the gap first. Test: sycophancy eval (agreement-with-wrong-answer rate) < 5%; zero "great question" strings in 10k sampled responses.
7. **Feature: Course object** = subject + board + level + exam session; contains chats, uploads, quizzes, papers, mastery, timetable. No separate "Study mode" toggle to hunt for. Test: new user reaches first quiz inside a Course in < 90 s.
8. **Feature: effort dial (Quick / Think / Deep) in the composer, auto-escalation for maths/proof questions, model names hidden by default, visible in settings.** Test: < 2% of users open the model settings; satisfaction on hard maths ≥ ChatGPT High in blind test.
9. **Rule: show working.** Stream a reasoning summary for STEM steps, collapsible; final answer never appears before the scaffold in Tutor mode. Test: users rate "I understood the steps" ≥ 4.3/5.
10. **Feature: edit any message, regenerate, branch ("try another method"), interrupt-and-add.** Test: parity checklist items 1–6 pass QA on web, iOS, Android.
11. **Feature: memory = editable Topics + per-Course memory + sensitive-topic exclusion by default + incognito + import from ChatGPT/Claude/Gemini exports.** Test: 100% of memories visible and deletable in one screen; import succeeds on the three vendors' export formats.
12. **Rule: durable state lives outside the chat.** Sessions default to one topic; a "Continue where I left off" card re-injects mastery/misconceptions. Test: no measurable answer-quality drop at message 50 vs message 5 in a longitudinal eval.
13. **Feature: side-by-side Workspace pane** (essay/worked solution/notes) with highlight-to-edit, version history, export to PDF/Docx/Anki/Markdown, and public share links that don't require login. Test: export success ≥ 99%; share links open in < 1.5 s.
14. **Feature: photo-of-working input with handwriting OCR and step-level marking**; voice mode with camera for oral practice (v2). Test: OCR line accuracy ≥ 95% on a handwritten maths set.
15. **Feature: usage meter** (session + weekly) with plain-number limits published on the pricing page; no silent reductions; grace mode (slower model) instead of hard lockout during exam weeks. Test: < 3% of support tickets about limits; zero unannounced limit changes.
16. **Rule: teen-safe by design in every market** — age assurance, Study Hours, Quiet Hours, parent digest without transcripts, no romantic/companion behaviour, break reminders, no ads ever. Test: passes OpenAI-parity checklist of parental controls [S4] and UK AADC/EU DSA minor-protection review before launch.
17. **Feature: teacher/parent link** — assign a Course or paper, see class-level weak topics, lock Tutor mode; LMS via LTI 1.3 + Google Classroom (and Classroom MCP when available). Test: a teacher can assign a past paper and see results in < 5 minutes.
18. **Rule: generous student inputs.** Free tier: unlimited chat on a fast model, ≥ 20 uploads/day, ≥ 128K working context; student plan ~$8–10 with the strong reasoning tier. Test: < 5% of free users hit an upload cap in week one.
19. **Rule: multilingual from day one** (UI + tutoring in RU/KZ/HI/ES etc.), curriculum-neutral data model (board → syllabus → topic → AO → question → mark scheme). Test: adding a new curriculum requires content ingestion only, no code.
20. **Feature: transparent citations UI** (numbered inline, hover card with page image) for both web and library sources; web search off by default inside a Course unless the syllabus needs current affairs. Test: 95% of citations resolve to the quoted passage.
21. **Design rule: calm over busy.** One primary action per screen, no suggestion carousels in the tutor loop, no emoji/headers by default, serif/humanist type option, dark mode, dyslexia-friendly spacing, reduced motion; all functions reachable by keyboard and screen reader. Test: WCAG 2.2 AA audit pass; Lighthouse performance ≥ 90 on the chat view; typing latency < 16 ms on mid-range Android.
22. **Rule: never ship a surface we might retire in a year** (no agents, sites, image/music generation, companions). Test: roadmap review each quarter against this list.
23. **Feature: mobile widgets and lock-screen live activity** for "today's 10 cards / 1 past-paper question" and streak-free progress (show mastery, not streaks). Test: D7 retention uplift for widget users ≥ 10 pp.
24. **Feature: data export and account portability** (full JSON + memory export like Claude/ChatGPT). Test: export completes in < 24 h and re-imports cleanly.
25. **Evidence programme from day one:** instrument pre/post practice-paper scores per Course and publish uplift per board (the field has only OpenAI's +15% microeconomics result and no exam-board data). Test: first cohort report within two exam sessions.

---

## Open questions / things we could not verify

- Exact current USD prices for ChatGPT Go/Plus/Pro tiers and the "Pro Lite" tier: the pricing page renders amounts client-side; figures ($8/$20/$100/$200) are from third-party trackers [S36].
- Whether ChatGPT Study Mode's "progress tracking" (marketing page) exists as a UI beyond conversational recap; help centre describes none.
- Claude Learning style details: the help article 404s; behaviour in claude.ai vs Claude Code output styles is inferred from 2025 coverage and Claude Code docs [S46][S47].
- Gemini study notebooks availability for under-18 school accounts ("coming weeks" as of 25 Jun 2026) and outside personal Google accounts.
- Precise Claude Pro/Max message limits (Anthropic publishes factors, not numbers; third-party "45 messages/5h" unverified) [S44].
- DeepSeek consumer-app feature set (1M context, Instant/Expert modes) is from third-party guides; DeepSeek publishes API docs, not app docs [S55].
- Grok tier structure (SuperGrok Plus $100) and Perplexity Education Pro $10 come from third-party pricing trackers, not vendor pages.
- Keyboard-shortcut inventories, accessibility conformance statements and offline behaviour for each product were not fetched (blocked/not searched); treated as prior knowledge.
- App-store review text (iOS/Android) could not be fetched; complaint evidence is Reddit plus aggregated review sites.
- Third-party claims of a "ChatGPT memory 'dreaming' process" and Gemini "Learn About" retirement were not confirmed by vendor pages; the Learn About sign-up page is still live.

---

## Sources

- [S1] ChatGPT pricing page (features/limits matrix) — https://chatgpt.com/pricing/
- [S2] OpenAI Help: Using study mode in ChatGPT — https://help.openai.com/en/articles/11780217-chatgpt-study-mode-faq
- [S3] OpenAI: Introducing ChatGPT for Teens (18 Aug 2026) — https://openai.com/index/chatgpt-for-teens/
- [S4] OpenAI Help: Managing parental controls in ChatGPT — https://help.openai.com/en/articles/12315553
- [S5] OpenAI Help: Memory FAQ — https://help.openai.com/en/articles/8590148-memory-faq
- [S6] OpenAI Help: ChatGPT Release Notes (Dec 2022–Sep 2026) — https://help.openai.com/en/articles/6825453-chatgpt-release-notes
- [S7] OpenAI: New ways to learn math and science in ChatGPT (10 Mar 2026) — https://openai.com/index/new-ways-to-learn-math-and-science-in-chatgpt/
- [S8] OpenAI: New tools for understanding AI and learning outcomes (4 Mar 2026) — https://openai.com/index/understanding-ai-and-learning-outcomes/
- [S9] Google: Guided Learning in Gemini (6 Aug 2025) — https://blog.google/products-and-platforms/products/education/guided-learning/
- [S10] Google Help: Gemini Apps limits & upgrades for Google AI subscribers — https://support.google.com/gemini/answer/16275805
- [S11] Google: Building AI tailored for education, with educators in the lead (ISTE, 25 Jun 2026) — https://blog.google/products-and-platforms/products/education/iste-2026-educator-updates/
- [S12] Google: Supporting students with connected AI tools (25 Jun 2026) — https://blog.google/products-and-platforms/products/education/iste-students-2026/
- [S13] Google Help: Create quizzes, flashcards, practice tests & more in Gemini Apps — https://support.google.com/gemini/answer/16275879
- [S14] Google Help: Use learning tools in Gemini Apps — https://support.google.com/gemini/answer/16448384
- [S15] Google Help: Organize your projects with notebooks in Gemini Apps (study notebooks) — https://support.google.com/gemini/answer/16972047
- [S16] Google Help: Upgrade Gemini Notebook (NotebookLM limits table) — https://support.google.com/gemininotebook/answer/16213268
- [S17] Gemini app release notes (2025–2026) — https://gemini.google/release-notes/
- [S18] Google: New Gemini app tools to help students (6 Aug 2025) — https://blog.google/products/gemini/new-gemini-tools-students-august-2025
- [S19] Claude Help: Release notes (Aug 2025–Sep 2026) — https://support.claude.com/en/articles/12138966-release-notes
- [S20] Claude Help: Use Claude's chat search and memory — https://support.claude.com/en/articles/11817273
- [S21] Claude Help: Use incognito chats — https://support.claude.com/en/articles/12260368-use-incognito-chats
- [S22] Claude Help: Usage limit best practices (2 Jun 2026) — https://support.claude.com/en/articles/9797557-usage-limit-best-practices
- [S23] Claude pricing — https://claude.com/pricing
- [S24] Mistral pricing (Vibe/Le Chat plans) — https://mistral.ai/pricing
- [S25] OpenAI Help: Ads in ChatGPT — https://help.openai.com/en/articles/20001047
- [S26] OpenAI Help: File Uploads FAQ — https://help.openai.com/en/articles/8555545-file-uploads-faq
- [S27] OpenAI Help: Projects in ChatGPT — https://help.openai.com/en/articles/10169521
- [S28] Claude Help: Set break reminders and quiet hours — https://support.claude.com/en/articles/15672868
- [S29] Google Help: Guide your child's Gemini Apps experience — https://support.google.com/gemini/answer/16109150
- [S30] Techbezon: Is ChatGPT getting worse in 2026 (search summary; Altman "sycophant-y" quote via TechCrunch) — https://techbezon.com/chatgpt-getting-worse/ ; https://techcrunch.com/2025/04/29/openai-explains-why-chatgpt-became-too-sycophantic
- [S31] TechRadar: angry ChatGPT fans rebel against secret model switching — https://www.techradar.com/ai-platforms-assistants/chatgpt/openai-responds-to-furious-chatgpt-subscribers-who-accuse-it-of-secretly-switching-to-inferior-models
- [S32] r/ClaudeAI: Claude Usage Limits Discussion Megathread — https://www.reddit.com/r/ClaudeAI/comments/1s7fcjf/claude_usage_limits_discussion_megathread_ongoing/
- [S33] Yahoo Tech: "Chatty GPT users complain…" (quote "ooooh I love this question") — https://tech.yahoo.com/ai/articles/chatty-gpt-users-complain-bots-154713988.html
- [S34] r/ChatGPT: For those of you who are tired of ChatGPT glazing (5,336 upvotes) — https://www.reddit.com/r/ChatGPT/comments/1m55axo/for_those_of_you_who_are_tired_of_chatgpt_glazing/
- [S35] r/GeminiAI: Why is the Gemini app so bad? / Has Gemini become even worse? — https://www.reddit.com/r/GeminiAI/comments/1rc9846/why_is_the_gemini_app_so_bad_this_is_google_were/ ; https://www.reddit.com/r/GeminiAI/comments/1r63ool/has_gemini_become_even_worse/
- [S36] IntuitionLabs / CometAPI ChatGPT plan comparisons 2026 (third-party prices) — https://intuitionlabs.ai/articles/chatgpt-plans-comparison ; https://www.cometapi.com/chatgpt-pricing-2026-free-vs-go-vs-plus-vs-pro/
- [S37] Suprmind / eesel: Perplexity pricing 2026 (third-party) — https://suprmind.ai/hub/perplexity/pricing/ ; https://www.eesel.ai/blog/perplexity-comet-pricing
- [S38] Grok pricing 2026 (third-party): https://suprmind.ai/hub/grok/pricing/ ; https://felloai.com/grok-pricing/ ; https://www.cloudzero.com/blog/grok-pricing/
- [S39] OpenAI: Our approach to age prediction / Help: Age prediction in ChatGPT — https://openai.com/index/our-approach-to-age-prediction/ ; https://help.openai.com/en/articles/12652064-age-prediction-in-chatgpt
- [S40] ChatGPT Study mode feature page — https://chatgpt.com/features/study-mode/
- [S41] ChatGPT Edu page — https://chatgpt.com/business/education/
- [S42] ChatGPT Work page — https://chatgpt.com/work/
- [S43] Google Labs: Learn About — https://learning.google.com/experiments/learn-about
- [S44] ClaudeMeter: Claude Pro usage limits on Reddit vs server (third-party) — https://claude-meter.com/t/claude-pro-usage-limits-reddit
- [S45] Anthropic: Introducing Claude for Education (2 Apr 2025) — https://www.anthropic.com/news/introducing-claude-for-education
- [S46] AlternativeTo: Claude's learning mode now available to all users (Aug 2025) — https://alternativeto.net/news/2025/8/claude-s-learning-mode-is-now-available-to-all-users-with-new-coding-styles
- [S47] Claude Code docs: Output styles (Explanatory, Learning) — https://code.claude.com/docs/en/output-styles
- [S48] Claude Help: Claude for Education collection — https://support.claude.com/en/collections/12630177-claude-for-education
- [S49] Claude for higher education page — https://claude.com/solutions/education
- [S50] Anthropic: Introducing Claude for Teachers (14 Jul 2026) — https://www.anthropic.com/news/claude-for-teachers
- [S51] Claude for K-12 teachers page — https://claude.com/solutions/teachers
- [S52] Anthropic research: How AI assistance impacts the formation of coding skills — https://www.anthropic.com/research/AI-assistance-coding-skills
- [S53] DeepSeek API docs: Your First API Call (models list) — https://api-docs.deepseek.com/
- [S54] DeepSeek: V4-Flash-Vision-Exp release (21 Aug 2026) — https://api-docs.deepseek.com/news/news260821
- [S55] DeepSeek chat guides (third-party) — https://deepseekai.guide/guides/deepseek-chat/ ; https://deepseekai.guide/guides/deepseek-free-vs-paid/
- [S56] r/DeepSeek: why is deepseek always 'server is busy' — https://www.reddit.com/r/DeepSeek/comments/1iroi3c/why_is_deepseek_always_server_is_busy_i_always/
- [S57] r/DeepSeek: im losing my sh*t on this app — https://www.reddit.com/r/DeepSeek/comments/1ikbmj1/im_losing_my_sht_on_this_app/
- [S58] Grok features/companions 2026 (third-party) — https://suprmind.ai/hub/grok/grok-features/ ; https://aicompanionguides.com/blog/grok-companion-mode-2026-update/
- [S59] GeekWire: Microsoft merging consumer and business Copilot apps (features removed 18 Aug 2026) — https://www.geekwire.com/2026/microsoft-starts-merging-its-copilot-consumer-and-business-apps-in-advance-of-super-app-rollout/
- [S60] Copilot pricing 2026 (third-party): https://copilot-experts.com/microsoft-copilot-pricing-guide/ ; https://geotoolbox.ai/blog/copilot-pricing
- [S61] Perplexity Help: What is Perplexity Pro (21 Jul 2026) — https://www.perplexity.ai/help-center/en/articles/10352901-what-is-perplexity-pro
- [S62] Mistral Le Chat memories/features 2026 (third-party) — https://techjacksolutions.com/ai-tools/mistral/mistral-pricing/
- [S63] r/singularity: ChatGPT's Study mode is really good — https://www.reddit.com/r/singularity/comments/1mgg9fm/chatgpts_study_mode_is_really_good/
- [S64] r/ChatGPT: ChatGPT gets 'study mode' (1,225 upvotes; "removed in 6 months") — https://www.reddit.com/r/ChatGPT/comments/1me2nh5/chatgpt_gets_study_mode_to_guide_students_without/
- [S65] r/ChatGPTPro: chatgpt study mode feels like a marketing gimmick — https://www.reddit.com/r/ChatGPTPro/comments/1md3arx/chatgpt_study_mode_feels_like_a_marketing_gimmick/
- [S66] r/ChatGPTPro: I tried ChatGPT's new Study Mode — thoughts — https://www.reddit.com/r/ChatGPTPro/comments/1nius3g/i_tried_chatgpts_new_study_mode_thoughts/
- [S67] r/singularity: OpenAI: Introducing study mode (teacher comment) — https://www.reddit.com/r/singularity/comments/1mchrs2/openai_introducing_study_mode_a_new_way_to_learn/
- [S68] r/technology: ChatGPT gets 'study mode' (2,284 upvotes) — https://www.reddit.com/r/technology/comments/1me9eyy/chatgpt_gets_study_mode_to_guide_students_without/
- [S69] TechCrunch: ChatGPT's model picker is back, and it's complicated (12 Aug 2025) — https://techcrunch.com/2025/08/12/chatgpts-model-picker-is-back-and-its-complicated
- [S70] CheckThat / Cabina: ChatGPT reviews and slowness 2026 (third-party) — https://checkthat.ai/brands/chatgpt/reviews ; https://cabina.ai/blog/why-is-chatgpt-so-slow-and-how-can-i-make-it-respond-faster/
- [S71] r/ChatGPT: My ChatGPT has become too enthusiastic (3,392 upvotes) — https://www.reddit.com/r/ChatGPT/comments/1jx3od0/my_chatgpt_has_become_too_enthusiastic_and_its/
- [S72] r/Bard: Gemini 3.0 forgets entire context of conversation — https://www.reddit.com/r/Bard/comments/1pnx6z1/gemini_30_forgets_entire_context_of_conversation/
- [S73] r/GeminiAI: Just what is wrong with Gemini's Personal context — https://www.reddit.com/r/GeminiAI/comments/1t92zyp/just_what_is_wrong_with_geminis_personal_context/
- [S74] r/ClaudeAI: Pro plan is basically unusable — https://www.reddit.com/r/ClaudeAI/comments/1q9va21/pro_plan_is_basically_unusable/
- [S75] r/ClaudeAI: Claude Pro Weekly Limits: Pro Plan is objectively… — https://www.reddit.com/r/ClaudeAI/comments/1rplxbv/claude_pro_weekly_limits_pro_plan_is_objectively/
- [S76] r/ClaudeAI: Subscribed yesterday to Pro and I'm already hit by… — https://www.reddit.com/r/ClaudeAI/comments/1s54pfu/subscribed_yesterday_to_pro_and_im_already_hit_by/
- [S77] r/GeminiAI: Google Gemini thinking process cut down… (fabricated URLs) — https://www.reddit.com/r/GeminiAI/comments/1r7kkdi/google_gemini_thinking_process_cut_down_to_only/
- [S78] BGR: Anthropic Claude review — https://www.bgr.com/2213994/claude-ai-review/
- Additional context searches (2026): Google AI plans page — https://one.google.com/about/google-ai-plans/ ; TechRadar on ChatGPT personality settings — https://www.techradar.com/ai-platforms-assistants/chatgpt/chatgpts-new-personality-settings-let-you-pick-the-vibe-and-it-ranges-from-corporate-calm-to-chaotic-bestie ; Apidog GPT-Live vs Gemini Live — https://apidog.com/blog/gpt-live-vs-gemini-live/ ; Canvas vs Artifacts comparisons — https://www.shareduo.com/blog/claude-artifacts-vs-chatgpt-canvas ; Tech & Learning on Guided Learning — https://www.techlearning.com/how-to/geminis-guided-learning-mode-from-google-ai-what-educators-need-to-know
