# ARMI — research, section by section

*What to add, what to change, and how each room gets more comfortable, productive and effective — with the design of each. September 2026, against the app as it stands at `f79aa62`.*

Every section reads the same way: **Now** (what is built), **What the leaders do** (from the research), **Add**, **Change**, **Design**, and a **priority**. Priorities are P1 (do next), P2 (this quarter), P3 (worth it, later). Sources are at the end.

The thread through all of it: the products people rate highest in 2026 — Claude, Perplexity, Linear, Raycast, NotebookLM, Mochi — win on *fewer things done completely* rather than more things done partially. Most of what follows is finishing, not adding.

---

## 0. Cross-cutting design language

**Now.** Dark-first, OKLCH-derived palette with matched light/dark ramps (verified: contrast on 26 pairs, theme parity lean 18%, text ladder drift 0.06). Depth by lit/shaded rims rather than drop shadows. Reading measure 47.5rem at 1.7 leading. Motion tokens with reduced-motion collapse. Inter for UI, Pinyon Script for the wordmark.

**What the leaders do.** Arc, Linear, Warp and Raycast all launched dark-first with light as the secondary mode — that matches. The 2026 dark-mode consensus: off-white text (not pure white) to avoid halation — done, L 0.92; depth by *lighter surfaces* rather than shadows, five surface levels — partly done, three levels; a dark blue-grey ground rather than pure black — done, `#0b101b`. Calm design: generous white space, fewer elements per screen, motion "with restraint, paired with a visible why and a one-click reset". Variable-font weight transitions on hover are the one 2026 flourish that reads as expensive rather than busy.

**Add.**
- A fourth and fifth surface level (`--bg-raised`, `--bg-overlay-surface`) so a dialog over a sheet over a card reads as three planes, not two. Material's guidance is five; the app has canvas / surface / subtle.
- A "Dim" dark variant beside "Lights out" — X's pattern — for people on LCD who find the near-black ground too deep. One token block, one toggle in Appearance.
- Weight-on-hover for nav items and chips using Inter's variable axis (400 → 500), 120ms. Cheap, and it is the detail that separates the apps people call "premium".

**Change.**
- Elevation in dark still leans on rims; add a *tonal* step (surface +2% L) under the rim so the two cues agree. Right now a floating panel is lit at the edge but the same tone as what it floats over.
- The `--accent-2` signal cyan is doing too many jobs (focus, CTA, dots, the wordmark's ink). Split: `--cta` for the one primary action per screen, `--accent-2` for status dots and rims only. Fewer things glow → the one that should glow does.

**Design.** Keep the 8px rhythm but make it visible: every room's header, list row and card should sit on the same 8px baseline, measured. The current gate has `type-scale` and `widths`; add a `rhythm` probe that samples the y of every heading and row and asserts `% 4 === 0`. **P2.**

---

## 1. Home and first run

**Now.** Greeting by name; four openers drawn from the person's own store (shakiest deck → missed cards → this week's page → general). No first-run questions; name is asked once.

**What the leaders do.** The first session loses 70–90% of users; median day-1 retention is ~25%. The flows that work "deliver value before signup, use AI to pre-build the workspace, and make the first task the user's actual job." Airtable's Omni asks 3–4 questions and pre-builds. Gemini's empty state is one line and a greeting. The consensus is 3–6 steps maximum and *an empty state that feels filled*.

**Add.**
- **The three-question first run** (SPEC H-1, still ⬜): *What are you studying? · What level? · What is the next date that matters?* Skippable, one screen, never a form — three chips and a date. It seeds: a first deck subject, the Tutor's register (TU-6), the exam countdown, and a "This week" opener. This is the single highest-leverage unbuilt thing in the app: every room gets better with those three facts. **P1.**
- **Daily brief** (SPEC H-4, ⬜): on the first open of a day, one card above the openers — due cards by deck, pages touched yesterday, streak, one question from the weakest topic. Computed locally, no model call. The research is unambiguous that a *habit* is what retention is; a brief is the hook for one. **P1.**
- Sample content on a truly empty store: one demo deck ("How this app works", 6 cards), one demo page. "A well-built empty state paired with good sample data teaches faster than another slide."

**Change.** The four openers are good; they should say *why* they are there ("because Cell biology is your shakiest deck") — the 2026 pattern is "adaptive changes with visible why labels". One line of `text-tertiary` under each chip.

**Design.** The greeting in Pinyon is the one moment the brand gets to be warm — keep it. Move the openers from a row of pills to a 2×2 of small cards with the why-line, so the home reads as *a plan* rather than *suggestions*. **P1 with H-1.**

---

## 2. Chat — composer, messages, models

**Now.** Streaming with rAF-smoothed word cadence; scroll-follow with a jump pill; ⌘↵ / Esc / ↑-to-edit; per-conversation drafts; edit-and-branch with ‹n/m›; copy / regenerate / switch model / explain; hint ladder in teaching stance; read-aloud; citations checked against sources; eleven Armi models as casts with a health-aware cross-company fallback; context meter; voice input; message-level "point at" selection.

**What the leaders do.** In 2026 the three big assistants have *diverged*: Claude for long documents and code, Gemini for grounded/multimodal, ChatGPT for voice and images. Gemini's redesign puts "key information in bold at the top, more as you scroll." Perplexity-style inline source chips and "show reasoning" toggles are now mid-market table stakes. Streaming with a visible cursor is universal. Memory is now free-tier everywhere. Voice mode can switch models mid-conversation (Claude, July 2026).

**Add.**
- **Slash commands** (SPEC C-9): `/study`, `/build`, `/compare`, `/check`, `/temp`, `/tutor` — typed prefixes that set the cast the router already reads. ChatGPT's `@study` proved people reach for this. Half a day. **P1.**
- **"Summarise older turns"** beside the context meter (C-7): when the thread nears the window, one press folds turns 1–n into a summary block the model reads instead. The meter already knows when; it just cannot act. **P1.**
- **Retry "with more effort"** as a third entry under Regenerate (M-4): same model, effort → high. Cheap and it is what people actually want when an answer is thin. **P2.**
- **Search within a thread** (M-15): `/` focuses a find bar, matches highlight, ↵ steps. The palette now searches *across* threads; this is the same thing *inside* one. **P2.**
- **Sources strip in chat** (M-16): unify on `lib/cite.ts` so an answer that used project files or pages ends with numbered sources that open at the span. Notebook has it; chat does not. **P2.**
- **A tree view for branched threads** (M-3): when a thread has > 3 branches, the ‹n/m› arrows hide structure nobody can see. Nobody ships this; it is the honest way to show it. **P3.**

**Change.**
- The answer's *lead*: adopt Gemini's "key line first". Ask the writer (in the house style) to open with the one-sentence answer in bold when the question has one, then the working. This is a prompt change, not UI. **P1.**
- Follow-up chips (Simpler · Example · Steps · Why? · Quiz me · Harder) are the best thing in the transcript; they should also appear *under a user's edited message* before it is sent, as suggestions for the rewrite.

**Design.**
- The user message sits in a pill on the right, the answer flat on the left — that asymmetry is right (bubbles for the person, prose for the answer). Keep it; the research says bubbles still win for the *person's* turns and flat wins for long answers.
- Byline row ("briefed first by another model · Explanatory") is the app's most distinctive UI and currently reads as a caption. Give it a 12px cast-icon and let it be a press that opens *who did what* — the cast's roles, cost, and time — which is the trust story the whole product is built on. **P1.**
- Reasoning: the "show reasoning" toggle is now a mainstream expectation. It exists (streamed reasoning); make the toggle a persistent preference rather than per-message.

---

## 3. Study — cards, sessions, mastery

**Now.** FSRS-6 with 21 weights; learning steps; cloze; write mode with a forgiving marker; cram; daily new-card cap; streak; twelve-week calendar; recall rate against 90%; deck health; **and from this week:** topics on every card labelled at generation, an attempts log of every marked answer, a mistake queue, a topic table with two signals (model + log), a confidence prompt with a two-by-two, leech handling, undo, reverse cards.

**What the leaders do.** FSRS needs 20–30% fewer reviews than SM-2 for the same retention on 500M+ reviews — the app already has it. Medical students on spaced digital cards score 6–11% higher. The March 2026 learning-science dispatch is the important caveat: *spaced retrieval works in the lab and is messier in real classrooms; testing beats restudy only when it includes feedback.* Metacognition — knowing what you don't know — is improved by retrieval practice *with accurate feedback*. Mochi wins on being "clean, fast, Markdown, distraction-free"; Anki loses on the review feeling like a chore. RemNote's insight: *any line of a note can become a card with one marker* — the gap between taking notes and making cards is the thing to close.

**Add.**
- **Cards from a line** (RemNote's move): in the Notebook, a `::` or `>>` on any line makes that line a card (`term :: definition`), and the card links back to the page. This is the single feature that makes the Notebook and Study one product instead of two. **P1.**
- **Interleaving as a session option**: "Mix decks" that draws from every deck due, shuffled by topic, rather than one deck at a time. The evidence for interleaving is strong and *no consumer app offers it as a one-press option*. The topic field makes it possible. **P1.**
- **Feedback on wrong write-mode answers, not just a verdict**: when the marker says "Not quite", offer one line from the writer on *what the gap is* ("you named the organelle, the question asked for the process"). The research says testing only helps *with feedback*; a red "Not quite" is not feedback. Cheap model call, only on request. **P1.**
- **Deck options** (S-4): per-deck new/day and desired retention (0.80–0.95). `intervalFor` already takes retention; this is plumbing. **P2.**
- **Image occlusion** (S-1): draw rectangles on a photo of notes; each is a card. Anki's most-used add-on; nobody else has it well. The Tutor already has the marquee. **P2.**
- **Typed-answer marking for maths** (S-9): numeric tolerance, units, LaTeX normalised equality. **P2.**
- **Session timer** (SP-2) and **today's plan** (SP-1) — the plan is the daily brief's study half. **P2 with H-4.**

**Change.**
- The end-of-session screen is a summary; make it a *decision*: "6 of 8 right · 2 to see again · Practise the two now?" — one button. Sessions that end with a next step are the ones that become habits.
- The "Sure?" prompt is off by default (right); after 20 answers, offer it once: "Want to know how well you know what you know?"

**Design.** Mochi is the reference: one card, centred, a lot of air, the four buttons with their costs said. The app is close. Two things: the card's question should be allowed to be *big* (24–28px) when short and step down when long — a fixed 20px reads as a form; and the grading buttons should sit at the bottom of the viewport on a phone, thumb-reachable, not under the card. **P1 (phone), P2 (type).**

---

### 3b. Revision notes that raise marks — what the evidence says, and what the pack is

The question was: a book goes in, and what comes out should make the person score as high as possible. So the question is really "which study techniques raise test scores", and that one has an answer.

**The evidence.** Dunlosky, Rawson, Marsh, Nathan & Willingham, *Improving Students' Learning With Effective Learning Techniques* (Psychological Science in the Public Interest, 2013) reviewed ten techniques across hundreds of studies and rated them by utility:

| Utility | Technique | What it is |
|---|---|---|
| **High** | Practice testing | Answering questions from memory — the "testing effect" |
| **High** | Distributed practice | Spacing sessions out over days rather than one block |
| Moderate | Elaborative interrogation | Asking "why is that true?" of each fact |
| Moderate | Self-explanation | Explaining how a new idea relates to what you know |
| Moderate | Interleaved practice | Mixing problem types in one session |
| **Low** | Summarising | Writing a summary of the text |
| **Low** | Highlighting | Marking the text |
| **Low** | Rereading | Reading it again |
| Low | Keyword mnemonic, imagery | |

The five things almost every student actually does are the five rated low. Roediger & Karpicke (*Psychological Science*, 2006) put a number on the first row: after one reading, a group that was **tested** retained about 56% a week later; a group that **reread** three times retained about 42% — and the rereaders rated their own confidence higher. Bjork's "desirable difficulties" is the same result from the other side: the techniques that feel effortful in the session are the ones that survive to the exam, and the ones that feel fluent are the ones that don't.

On marks specifically, every examiner's report in the English system says the same two things each year: candidates lose marks on the **command word** (a *describe* answered with reasons, an *evaluate* answered with a list, a *calculate* with no units) and on **not knowing what a full-mark answer contains** — the points the scheme is looking for.

**Two formats built on that evidence.** Cornell notes (Walter Pauk, Cornell University, 1962): a page split into a narrow cue column of questions, a wide notes column, and a summary strip at the bottom — revised by covering the notes and answering the cues, which turns the page itself into a practice test. Knowledge organisers (English secondary schools, widespread after ~2015): one page per topic listing exactly what must be known — terms, facts, formulas, diagrams — ranked, used for low-stakes quizzing and "look, cover, write, check".

**What the pack is, and why each piece.** A revision pack (`lib/revision.ts`) is made from one source and is four things, each a different way of being asked rather than a different way of being told:

1. **Knowledge organiser** — must-know facts ranked most-examined first; key terms as a table; formulas with symbols named; processes as numbered steps; the five common mistakes with what to do instead; *how it is asked* — the command words for the topic and what a full-mark answer to each contains (`lib/exam.ts`); links to the topics either side. At most three `[!key]` callouts: a page where everything is highlighted has nothing highlighted.
2. **Cornell notes** — six to twelve sections, each a `Cue | Notes` table where every cue is a question that can be got wrong (never "answered by the sentence before"), a three-sentence summary in the student's voice, and ten lines for the whole thing. Cover the right column: it is a retrieval sheet.
3. **Exam questions with mark schemes** — twelve in three tiers (recall 1–2 marks, apply 3–4, evaluate 6–8), each with a per-mark scheme in the examiner's words, a model answer written the way a strong candidate writes under time, and the one line "where marks are lost". For evaluate questions, what separates the middle band from the top.
4. **Cards into Study** — drafted from the organiser, so the ranked facts come back on the schedule (FSRS, `lib/study.ts`), which is the distributed practice row.

The pack downloads as one markdown file whose first page says how to use it — read the organiser once then cover it and write it out; answer the cues with the notes covered; sit the questions under time before reading the schemes — because a pack read as a summary is a summary, and summarising is on the low-utility row. What is deliberately **not** in the pack: a summary, a highlighted version of the text, a "reread this" list.

**Sources.** Dunlosky et al. 2013, PSPI 14(1) 4–58. Roediger & Karpicke 2006, Psychological Science 17(3) 249–255. Bjork & Bjork, "Making things hard on yourself, but in a good way" (2011). Pauk, *How to Study in College* (1962). Ofqual/AQA/Cambridge command-word guidance and examiners' reports (annual).

## 4a. The page you can write on — pencil, ink and marking

**What the leaders do.** Goodnotes 6 (2023→) made the pencil the AI's input: its Math Assist reads handwritten lines, checks each against the line before it, and flags the step where the working went wrong — "spellcheck for maths", on the page, locally. Apple's Math Notes (iPadOS 18) solves a handwritten expression the moment an `=` is written and re-plots as variables change. Notability's AI is audio-first; Apple Notes has markup but no reasoning. None of them shows the *page* to a frontier model with the ink on it, and none lights up the line a tutor quotes. That is the gap this room fills.

**What the web can do with a pencil.** A pencil is a `PointerEvent` with `pointerType === "pen"`, `pressure` 0..1, `tiltX/Y`; `getCoalescedEvents()` gives every sub-frame sample so a fast stroke is a curve. Safari makes pen and touch *exclusive* (the spec's own palm-rejection clause, [W3C PointerEvents §palm rejection](https://w3c.github.io/pointerevents/); [Apple Developer Forums thread 773213](https://developer.apple.com/forums/thread/773213)), so a resting palm does nothing while the pencil is down — palm rejection is the browser's. Simultaneous pen+multitouch is not available on the web, which rules out two-handed gestures but costs a study app nothing. `touch-action` decides what a finger does when the pencil is up; the rule used here is that a finger is the pencil until a pencil has been seen, and scrolls after.

**Whether writing by hand is worth it.** Mueller & Oppenheimer (2014, n=327) found longhand note-takers ahead on conceptual questions; the mechanism was *selection*, not the hand. The 2024 high-density EEG study ([van der Weel & van der Meer, Frontiers in Psychology](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1219945/full)) found handwriting recruits far wider theta-alpha connectivity than typing — but it copied familiar words with one-finger typing as the control and did not test retention ([commentary, PMC11750765](https://pmc.ncbi.nlm.nih.gov/articles/PMC11750765/); [ScienceBlog on the 2024 meta-analysis](https://scienceblog.com/t-a-2024-meta-analysis-found-a-small-achievement-advantage-for-handwritten-lecture-notes-but-the-headline-making-eeg-study-did-not-test-retention-36-students-copied-familiar-words-by-hand-or-typed-the/)). The defensible claim: writing on the page makes the person choose and generate, which is what Dunlosky's high-utility strategies have in common; highlighting alone stays low-utility, so the highlighter here says so and offers to turn marks into questions and cards.

**Built (TU-7..TU-11, `lib/ink.ts`, `components/study/Ink.tsx`).** Pen, highlighter, rubber, undo and clear over the drawn page; pressure-width strokes from coalesced samples; ink kept per page in IndexedDB; the page *with the ink* is what the model is shown, and a dragged region is cut from the inked page; "Give me a hint" first; "Why is it wrong?" returns JSON per step and the app draws a numbered tick or cross beside each step down the side of the region; every `> ` quote in an answer is a press that finds the words on the page from pdf.js text positions and lights them for nine seconds; a Make row — study guide, questions, summary — lands pages in the Notebook, and Cards in Study; with a pencil seen the page pane takes more of a landscape iPad.

## 3c. Your rules — standing instructions with switches

**What the leaders do.** ChatGPT stacks three layers — a personality preset (Default, Friendly, Efficient, Professional, Candid, Quirky, Cynical, Nerdy), custom instructions in two boxes, and memory — and its own help says the instructions that work are specific and action-shaped: "always include error handling", never "be helpful" ([OpenAI: customising your ChatGPT personality](https://help.openai.com/en/articles/11899719-customizing-your-chatgpt-personality); [ai-toolbox templates, 2026](https://www.ai-toolbox.co/chatgpt-management-and-productivity/chatgpt-custom-instructions-templates-2026); [TechCrunch on traits](https://techcrunch.com/2025/01/17/chatgpts-newest-feature-lets-user-assign-it-traits-like-chatty-and-gen-z)). Claude has Styles and project instructions; Gemini has Saved info. All three bury the free text in settings and none shows, while you type, that anything is in force.

**Built (RU-1..RU-4, `lib/rules.ts`).** A Rules panel of eleven presets as switches, each one sentence a person would say to a tutor — hints before answers, check I followed, exam standard, plain words, keep it short, one example every time, no preamble, ask before guessing, say when unsure, quote what you relied on, British English — grouped by what they change, plus a box for your own lines. What is on rides at the start of every conversation as a "Your rules" list, after the house rules and before a project's, and in the Study room's document reader too. The composer shows "3 rules" while you type, a press from the panel — because a rule nobody can see being applied is a rule they forget they set.

## 4. Tutor — a document beside the chat

**Now.** PDF/image/text taken in and kept whole; page rendered; pen/finger/mouse marquee sends a crop as an image beside the page's text; page-aware asks; cards from the page into one deck per document; arrow keys, Escape, scroll-follow, drag-and-drop, undoable delete.

**What the leaders do.** The 2026 study modes (ChatGPT Study Mode, Gemini Guided Learning, Claude Learning Mode) converge on: hints before answers, check-for-understanding after every explanation, and *refusing to hand over the answer* — Claude's mode is rated strongest for retention on exactly that. Khanmigo's RCT in UK classrooms (Dec 2025) found AI tutoring "safely and effectively" supports students. The counter-evidence matters: Gerlich 2025 (n=666) found heavier AI use correlates with *lower* critical-thinking scores via cognitive offloading, strongest in the youngest — so the tutor's job is to make the person think, not to think for them. NotebookLM's April 2026 update: Sources / Chat / Studio three columns, and a one-click "Studio" that makes a study guide, FAQ, mind map, briefing and *audio overview in four formats* (Deep Dive, Brief, Critique, Debate) from the same sources.

**Add.**
- **Studio outputs from a document**: beside "Make cards", *Study guide* (headings + the 10 things to know), *Questions* (8 exam-style with mark schemes), *Summary in 5 lines*. Same page text, three prompts, each lands as a Notebook page linked to the lesson. This is NotebookLM's whole value and it is two hours of work here. **P1.**
- **Read the page aloud, following along** (WD-9): the read-aloud exists for prose; put the text layer over the canvas and highlight the sentence being read. The "Brief" audio format is this. **P2.**
- **Persistent marks** (WD-8): keep the crops as annotations on the page between sessions, with the answer attached — the page becomes annotated by the conversation. **P2.**
- **"Is this the question?"** (HP-1): on a photo, transcribe first as editable text, then the hint ladder. The transcription step is what makes handwriting correctable. **P2.**
- **A level register** (TU-6): IGCSE / A-Level / University changes the vocabulary; set once in H-1. **P1 with H-1.**

**Change.** The tutor's stance should *default* to the hint ladder for a question about the page, and to full explanation only for "explain this". Right now "Explain this" and "Why is it wrong?" are peers; make "Give me a hint" the first chip and the explain chips second. This is the Gerlich finding turned into a default.

**Design.** The split (page left, chat right, 26–30rem) is right and matches NotebookLM's columns. Add a third, collapsible *Studio* rail on the right for the outputs above, so the room reads as *source · conversation · what came of it*. On an iPad in landscape the page should be allowed to take 60% when the pencil is down. **P1.**

---

## 4b. The 2026 refresh — what the three flagships do now, and what the evidence says about comfort

**ChatGPT (2026).** The sidebar was rebuilt: a floating mode, eight recent conversations with infinite scroll, and pinned chats, GPTs and Projects folded into one *Pinned* bucket ([ai-toolbox sidebar guide](https://www.ai-toolbox.co/chatgpt-management-and-productivity/chatgpt-sidebar-redesign-guide)). Canvas was removed on 28 May 2026 and replaced by *writing blocks* and *code blocks* inside the thread — editable in place, opened full-screen when long, changed by describing the change rather than pressing a button ([static.app](https://static.app/guides/what-is-chatgpt-canvas); [felloai](https://felloai.com/chatgpt-canvas/)). The model picker is outcome-labelled (Instant / Medium / High / Extra High) with Instant auto-switching up when a task needs it ([SurePrompts](https://sureprompts.com/blog/ai-reasoning-models-prompting-complete-guide-2026)). Study mode is a tool in the composer's + menu or `@study`: it asks what you already know and your level, explains in pieces, checks understanding, and uses memory to pitch the level; students called it "24/7 office hours", educators found it weak on open-ended questions ([OpenAI](https://openai.com/index/chatgpt-study-mode/); [Edutopia](https://www.edutopia.org/article/putting-chatgpts-study-mode-through-its-paces/); [Appscribed](https://appscribed.com/chatgpt-study-mode/)). Personality presets (Default, Friendly, Efficient, Professional, Candid, Quirky, Cynical, Nerdy) sit above custom instructions and memory ([OpenAI help](https://help.openai.com/en/articles/11899719-customizing-your-chatgpt-personality)).

**Claude (2026).** Chat and Cowork merged into one window on 16 September 2026, with requests routed automatically ([TechCrunch](https://techcrunch.com/2026/09/16/anthropic-merges-claude-chat-and-cowork-in-one-interface/)). Chat gained inline interactive charts, output styles, Fork (a branch you can come back from), `/rewind`, `/recap` and `/btw` ([Cash & Cache](https://cashandcache.substack.com/p/claude-just-had-a-crazy-2026-the)). The design language is the one every other AI app is measured against for calm: a warm-neutral palette where every grey has a yellow-brown undertone (#f5f4ed canvas, #141413 ink), a medium-weight serif for headings, white cards, wide margins, terracotta illustration — "a thoughtful companion rather than a powerful tool" ([Surlej, Bootcamp](https://medium.com/design-bootcamp/the-quiet-genius-of-claudes-branding-less-hype-more-humanity-f4f5567051cc); [oh-my-design token listing](https://oh-my-design.kr/design-systems/claude)).

**Gemini (2026).** The *Neural Expressive* redesign (I/O, May 2026): a pill-shaped prompt box, a + menu that opens a bottom sheet with upload tiles on top and each tool — image, video, Canvas, Deep Research, Guided Learning — listed underneath with a one-line description ([9to5Google](https://9to5google.com/2026/05/19/gemini-app-google-io-2026/); [Android Authority hands-on](https://www.androidauthority.com/gemini-neural-expressive-android-app-hands-on-3668985/)). Guided Learning, on LearnLM, lays out a study plan for a topic first, then walks each step with a check-in, adapting with a new analogy or a simpler example when an answer shows partial understanding, with images, videos and quizzes inside the lesson ([Google](https://blog.google/products-and-platforms/products/education/guided-learning/); [Tom's Guide](https://www.tomsguide.com/ai/google-gemini/google-geminis-guided-learning-feature-makes-ai-actually-check-if-you-understand-heres-how-it-works); [datastudios](https://www.datastudios.org/post/gemini-guided-learning-step-by-step-tutoring-features-lesson-flow-accuracy-and-limitations)). Gems are four fields: persona, task, context, format ([Suprmind](https://suprmind.ai/hub/gemini/features/)).

**Composer placement, across the three.** A + menu when most people should just type (ChatGPT, Gemini); bar chips when the mode *is* the product (Perplexity); model and effort on the composer when spend and latency matter before send (Claude); outcome labels in menus when casual users should not pick model names ([AI UX Playground composer teardown](https://aiuxplayground.com/teardowns/compare/design-the-composer/)). Streaming with a visible cursor is the baseline; numbered inline citations with expandable cards are the citation pattern; follow-up chips reduce blank-page anxiety after the first answer but must never delay the answer; reasoning blocks collapsed by default are the norm, with a setting to keep them open for people who audit ([ai-tldr chat UX patterns](https://ai-tldr.dev/learn/building-ai-apps/ai-ux-patterns/chatbot-ux-patterns/); [thefrontkit](https://thefrontkit.com/blogs/ai-chat-ui-best-practices); [hermes-agent issue 53617](https://github.com/NousResearch/hermes-agent/issues/53617)).

**Colour and reading comfort.** Warm off-whites (#F8F5F1, #FAFAF8) reduce reported screen fatigue and now dominate document and knowledge tools; cool zinc/slate neutrals dominate developer tools ([Recursion, UI colour trends 2026](https://www.recursion.agency/blog/ui-color-trends-2026); [ColorArchive on neutrals](https://colorarchive.org/guides/neutral-color-palettes/)). The W3C Design Tokens colour module (Oct 2025) standardises on OKLCH, where equal lightness steps keep contrast equal across hues ([designtokens.org](https://www.designtokens.org/tr/drafts/color/); [LogRocket](https://blog.logrocket.com/oklch-css-consistent-accessible-color-palettes)). APCA: Lc 90 preferred and Lc 75 minimum for body text, Lc 60 for large headings, judged in polarity ([APCA in a nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html); [Inkbot on WCAG 3](https://inkbotdesign.com/wcag-3-0-typography-standards/)). Dark mode: grey #121212–#1E1E1E rather than black, off-white #E0E0E0–#EDEDED text rather than white, layered surfaces and desaturated accents ([tech-rz dark mode 2026](https://www.tech-rz.com/blog/dark-mode-design-best-practices-in-2026/)). Line length 45–75 characters, 66 the most cited target ([UXPin](https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/)).

**What students say they want** from a study app: low-distraction interfaces built strictly for learning, Socratic tutoring that asks before it tells, document grounding so the answer comes from the chapter and not the model's memory, and everything from a PDF in one place ([STURIO](https://sturio.io/blog/7-best-ai-study-tools-for-students-2026); [Laxu](https://laxuai.com/blog/best-ai-study-tools-2026)).

**Where this app stands, and what to change.** Already in place: OKLCH tokens in both themes with measured contrast and parity; a 68-character measure; streamed answers with a cursor; numbered citations with a strip; follow-up chips after the answer; "Thought for Ns" collapsed; outcome-named models; a + for attachments; slash commands; a hint-first tutor with ink; rules as switches. The gaps this round closes: (1) a **warm tone** for both themes — Claude's evidence-backed calm, as a choice rather than a replacement, because the blue/cyan identity is the app's; (2) a **Learn** switch in the composer, the study-mode / Guided-Learning pattern — a plan first, one step at a time, a check-in after each, level asked once — as a mode of the thread rather than a room; (3) the **+ menu** as Gemini and ChatGPT have it — attach, learn, research, compare, temporary, each with a line saying what it does — instead of a bare paperclip; (4) a setting to keep **thinking open**, for the person who reads it.

## 4c. Calm: what the app was showing that it did not need to

**What the evidence says.** 2026's consensus is restraint: "remove everything that doesn't serve the immediate task", smart defaults over options, and progressive disclosure as the way to keep power without noise ([Envato: calm interfaces](https://elements.envato.com/learn/ux-ui-design-trends); [Mind Coders: building calm interfaces](https://medium.com/@mindcodersindore/building-calm-interfaces-less-is-more-in-2026-eab5fd810413); [Orizon](https://www.orizon.co/blog/10-ui-ux-trends-that-will-shape-2026)). For chat specifically: each layer — answer, explanation, full reasoning — should be *available on demand but hidden by default*, labels should be honest, and excessive metadata should be condensed into short phrases or grouped behind a toggle rather than printed ([thefrontkit](https://thefrontkit.com/blogs/ai-chat-ui-best-practices); [NN/g on explainable AI](https://www.nngroup.com/articles/explainable-ai/)). For sidebars: group with hierarchy, but avoid dividers that create noise, and keep one glance enough to know where you are ([alfdesigngroup](https://www.alfdesigngroup.com/post/improve-your-sidebar-design-for-web-apps); [Mobbin on dividers](https://mobbin.com/glossary/divider)).

**What was wrong here, found by looking.** (1) The active conversation row carried *three* marks for one state — a tinted pill, a filled bullet, and a 2px vertical bar pinned to `left-0`, which sat outside the pill's rounded corner and so read as a line poking out of it rather than as a marker. The third was the one that looked broken, and it is gone; the fill and the bullet remain. (2) Every answer was topped by the router's reason sharing the name's row under a `truncate` — a sentence cut off mid-word with an ellipsis, on every answer in the app, as the single most repeated piece of furniture in the transcript. The first repair tried was the calm one, hiding it behind a press; the probes rejected it, and rightly: six separate claims this app makes about its own honesty are made *in* that line — that the checker came from a different company, that a turn went round twice, that the engine it wanted was not available. Calm is not a licence to hide what a product is for. The defect was the truncation, so the line now has a line of its own, whole and wrapping, at the same quiet weight. (3) The per-answer action row and the timings were already hover-revealed with a touch fallback, and the last answer already keeps them — that part was right. (4) A populated audit of every room found two more: a project of two small files filled a thousandth of its knowledge budget, and the meter drew that as a 1px fill at the end of a nearly invisible track — a stray mark under the file list rather than "nearly empty", so the bar is drawn only above a hundredth and the sentence beneath says it in words below that, which it already did. And the twelve-week study grid carried its meaning only in an `aria-label`, directly above a line about the last *thirty* days — so a sighted reader saw unlabelled squares with somebody else's caption under them; the grid says "Last 12 weeks" now.

## 4d. Choosing: one idiom for models and for tools, and a palette turned down

**Tools, chosen rather than always there.** ChatGPT keeps its tools behind the composer's `+` — Canvas, Web Search, Deep Research, Study and Learn — and its own composer teardown states the rule: a `+` menu when most people should just type, bar chips when the mode *is* the product ([ai-basics tools menu](https://ai-basics.com/chatgpt-tools-menu/); [BGR on the composer's tool UI](https://www.bgr.com/tech/chatgpt-got-a-makeover-but-all-of-your-ai-tools-are-still-there/); [AI UX Playground composer teardown](https://aiuxplayground.com/teardowns/chatgpt/composer/)). Typing is this app's product, so Research and Learn no longer sit in the bar switched off: they are chosen from the `+` menu, which lists each with a line of what it does and a tick on the one that is on — the same mark the model picker puts against the model that is chosen. While a tool is running the bar carries a dismissible chip, which is the applied-filter pattern, so the composer only ever shows what is actually in force. That makes choosing a model and choosing a function the same motion: open a list, read a line, pick; see what is chosen, take it off.

**Saturation, measured.** Saturated hues on a dark surface optically vibrate, and the standing guidance is roughly twenty points *less* saturation in dark than in light — Material's own rule — with 15–30% reductions cited for accents specifically ([ColorPick on saturation](https://colorpick.app/blog/color-saturation-vibrancy-guide); [enigmaeasel on eye-strain palettes](https://enigmaeasel.com/color-palettes-that-reduce-eye-strain/); [updivision 2026 colour trends](https://updivision.com/blog/post/ui-color-trends-to-watch-in-2026)). Measured here, the dark theme was doing the opposite: accent at **88%** saturation against light's 72%, the signal cyan at 61%, the call to action at 64%. They come down to 58, 44 and 46, each holding its lightness exactly — lightness is what carries contrast, so every ratio in `contrast.mjs` and every step in `theme-parity.mjs` is unchanged. Same hues, same palette, turned down.

## 5. Notebook

**Now.** Markdown pages; wiki-links with backlinks and new-page-from-dead-link; tags with counts; outline; reading time; templates (Cornell, lecture, revision, lab, essay plan); selection actions (Ask · Card · Explain · Rewrite); ask-your-notebook with checked citations; sources on a page with page-level citations.

**What the leaders do.** Obsidian's pull is *ownership and links* — local Markdown, backlinks, graph. The 2026 reality check on AI note features: "for most people they don't justify cost; Apple Notes handles the majority." What *does* help students is NotebookLM's source-grounding with line-level citations — which the app has. The feature nobody else has and RemNote proves: notes that are also cards.

**Add.**
- **Cards from a line** (see §3) — this is the Notebook's half of it. **P1.**
- **Unlinked mentions** ("3 pages mention this title") with one-press linking. Obsidian's most-loved small feature. **P2.**
- **Version history** (last 50 saves, diff via `DiffView`). Without it, "Rewrite" is a destructive action. **P1** — it is a safety feature more than a feature.
- **"Turn into questions"** as a fifth selection action: three questions from the selection, each to Study. **P2.**
- **Tag page**: all pages, cards and canvases with a tag. **P3.**

**Change.** The ask-your-notebook answer should stream (it does not) and should offer scope chips (All · this tag · pinned) — both listed in the spec, both cheap.

**Design.** The page is a sheet at 50rem with 17px/1.75 — correct and better than most. The index is a list; make the pinned pages a row of small cards at the top with their first line, so the room opens on *what you were writing* rather than on a list. The outline rail should collapse to icons at < 1100px rather than vanishing. **P2.**

---

## 6. Projects — knowledge

**Now.** Projects with instructions, files (PDF with page numbers, text, Markdown, code, images), BM25 retrieval with neighbour expansion and gap marks, a "partial" flag when the material did not fit, per-project conversations.

**What the leaders do.** Claude and ChatGPT Projects both settled on: instructions (how to behave) + knowledge (what is true) + scoped memory + the chats. "A fresh chat can open already briefed" is the value. ChatGPT added voice inside projects (Aug 2026). File limits are 5/25/40 by tier — the app has none, which is a genuine advantage worth saying.

**Add.**
- **The project page** (K-5): each file's size, tokens, and *"read whole / excerpted / did not fit last time"*; plus a **"Test a question"** box that shows which excerpts *would* be sent. This is retrieval made visible, and no leader does it — it is the honest version of "did it read my file?" **P1.**
- **Pages and decks as sources** (K-6): a project includes the person's own pages by reference. The four-room store is the reason to do this. **P1.**
- **Per-project memory toggle** ("remember from this project"). **P2.**
- **OCR for scanned PDFs** (browser Tesseract, opt-in, slow, local) and table extraction. **P3.**

**Change.** The "partial" flag is a boolean; say *how* partial — "read 3 of 11 pages" — on the answer's byline.

**Design.** The project view should lead with *what it knows* (files as a compact table: name · pages · tokens · last read) and put instructions second; today it is the other way round and the files are a list of names. **P1 with K-5.**

---

## 7. Artifacts — the code room

**Now.** Canvases as files with versions and diffs; web canvases run in a srcdoc frame with console errors reported back; self-heal loop; plan-then-build in the Nova cast; download as one HTML file; phone/tablet/desktop preview widths; the "made" panel.

**What the leaders do.** Claude Artifacts: live preview in chat, no deploy step, optimised for iteration; v0: production shadcn code with one-click deploy; Cursor 3.7 (June 2026) added **Design Mode** — point at an element in the running preview and describe the change; Cursor's Visual Editor lets you drag elements and tweak spacing on running code. "The one file that makes them build what you want" — a project rules file — is now universal.

**Add.**
- **Point-and-describe editing**: click an element in the preview, the app sends its selector + outerHTML + the instruction to the writer. The `PointAt` selection mechanism in chat is most of this. This is Cursor's headline feature and it is a day here. **P1.**
- **"Open in Artifacts" / "Run"** on any HTML/JS/SVG code block in chat (SPEC §8): render in a frame beside the answer. **P1.**
- **Publish**: a one-press share link (Vercel blob or a static host) — Claude's "publish" is why artifacts spread. Needs a server; note it as the one non-local feature. **P3.**
- **Component preview grid**: for a canvas with several files, a strip of thumbnails. **P3.**

**Change.** The console-error loop currently self-heals silently up to n times; show the attempt count and the last error as a collapsible line so the person can see it working — "adaptive changes with a visible why".

**Design.** The panel should be *resizable* (drag handle, 30–70%) and remember its split per canvas; today it is fixed. Preview / Code / Split as a segmented control in the panel header, not a menu. Fullscreen preview on a phone with a floating "back to chat". This is the standard artifact-panel anatomy across Claude, v0 and Cursor and the app is one step short. **P1.**

---

## 8. Creative

**Now.** Starters: whiteboard (saved as a picture Vision can read), mind map, kanban, exam countdown, plotter/graph, timer.

**What the leaders do.** Excalidraw and tldraw are the two hand-drawn infinite canvases everyone reaches for — free, no account, marker aesthetic. Whimsical for mind maps. The AI move in 2026 is "describe → diagram" (MockFlow IdeaBoard) and the reverse: photograph a whiteboard → structured. Miro is for workshops, not students.

**Add.**
- **Whiteboard → notes**: one press turns the whiteboard picture into a Notebook page (Vision reads it; the writer structures it). The camera-to-notes flow students actually want. **P1.**
- **Mind map from a page or a chat**: the writer emits a `mermaid` mindmap from any page or answer; the mind-map starter opens it editable. Mermaid already renders. **P1.**
- **Infinite canvas with hand-drawn style** for the whiteboard (tldraw's `@tldraw/tldraw` is MIT-ish with a watermark; Excalidraw's package is MIT). Replacing the current whiteboard with Excalidraw embedded gets pen pressure, shapes, text, and export for free. **P2.**
- **Pomodoro that logs to `studyDays`** — the timer exists; wire it to the streak. **P2.**

**Change.** The starters open as blank canvases; each should open with one example already on it ("empty states that feel filled").

**Design.** A gallery of starters as cards with a live thumbnail of *your* last one, not an icon. **P2.**

---

## 9. Settings, keys, privacy

**Now.** Keys masked (`sk-ant••••••••••9f4c`), Test / Replace / Remove per provider, a privacy panel that says exactly where data goes, spend by cast, Armi models with their casts and costs.

**What the leaders do.** BYOK is now a category (BYOKList, Dyad, Calmara): "your prompts run under the provider's API terms, which exclude training by default" — and the honest caveat: "the app itself can still see and log your prompts, so BYOK improves provider-side privacy, not app-side privacy." That caveat is the app's *advantage* — it is local-first, so there is no app side — and the privacy panel should say so in those words. Key UI best practice: masked by default, reveal *paired with copy*, show created date and a label, and let people name keys. The mobile BYOK apps add biometric lock and screenshot prevention.

**Add.**
- **"Where this goes" on every send**: a tiny provider glyph on the send button's tooltip — "to Anthropic, under your key". Trust is built at the moment of sending, not in a settings page. **P1.**
- **Key created-on date and a rotate reminder** at 90 days. **P2.**
- **A local passphrase lock** (WebCrypto, keys encrypted at rest with a passphrase, biometric via WebAuthn where available). The mobile BYOK apps have it; a shared laptop needs it. **P2.**
- **Export everything** as one zip (already have per-room export? unify) and **import** — ownership is the promise. **P2.**

**Change.** The privacy panel should lead with the one sentence that distinguishes the app: *"Nothing you type is sent anywhere except to the company whose key you pasted. There is no server in between."* Then the details.

**Design.** Settings is a long single page; the 2026 pattern (Linear, Raycast) is a left rail of sections with the content pane scrolling. At the current length it is at the threshold. **P2.**

---

## 10. Search and the command palette

**Now.** ⌘K palette: actions, rooms, models, and now *inside* conversations and cards with the matched line marked; fuzzy scoring; one row per thread.

**What the leaders do.** "VS Code, Linear and Raycast built their entire UX around the command palette; users describe it as feeling like a superpower." The leading assistants search titles only.

**Add.**
- **Filters as typed prefixes**: `in:study osmosis`, `after:monday`, `tag:cells`. **P2.**
- **Recent and frequent** on the resting list, weighted by use, not just recency. **P2.**
- **Actions on results**: `→` on a card row offers Practise · Edit · Go to deck without leaving the palette. **P3.**

**Design.** The palette is the app's best screen. One change: the group headings should show counts ("In conversations · 7") so the person knows whether to scroll. **P2.**

---

## 11. Mobile and iPad

**Now.** Safe areas; 44pt targets at three densities (measured); composer clears the home indicator; keyboard resizes content; pen input in the Tutor; PWA manifest and icon.

**What the leaders do.** Gemini has a dedicated iPad layout with Split View. Goodnotes and Procreate own the Pencil (pressure, tilt, squeeze). iPadOS 26 has Stage Manager everywhere. The productivity advice is all about Split View pairs and keyboard shortcuts.

**Add.**
- **Pencil pressure in the whiteboard** (it is recorded in the Tutor and unused). **P2.**
- **A two-pane iPad layout** for Chat + Notebook and Chat + Study (the Tutor already is one). The app is built of rooms; letting two be open at ≥ 1024px is the iPad feature. **P1.**
- **Phone bottom sheet** (DS-1 `Sheet`) for attachments, the tools menu and the model picker — the model picker as a popover on a phone is the one control that still feels desktop. **P1.**
- **Maskable 512×512 icon** in the manifest and regenerate `apple-icon.png` in the new palette. **P1, trivial.**

**Change.** On a phone the study grading buttons must be at the bottom edge (see §3).

**Design.** The sidebar collapses to a 72px icon rail on a desk; on an iPad in portrait it should become a *tab bar* at the bottom (five rooms), which is what every iPad-native app does and what thumbs expect. **P1.**

---

## The short list

If only ten things get built from this, in order:

1. **Three-question first run + daily brief** (§1) — every room gets better with three facts, and a habit is what retention is.
2. **Cards from a line in the Notebook** (§3/§5) — makes two rooms one product.
3. **Studio outputs from a document** (§4) — NotebookLM's whole value, two hours here.
4. **Feedback on wrong answers, not just a verdict** (§3) — the research says testing only helps with feedback.
5. **Interleaving as a one-press session** (§3) — strong evidence, nobody ships it.
6. **Point-and-describe editing in the code room + resizable panel** (§7) — Cursor's headline feature.
7. **Slash commands + summarise older turns** (§2) — the two composer gaps with the most reach.
8. **The project page with retrieval made visible** (§6) — the honest "did it read my file?"
9. **iPad two-pane + phone tab bar + bottom sheets** (§11) — the device the Tutor was built for.
10. **The byline as a press** (§2) — the trust story, one tap deep.

---

## Sources

Chat and assistants: [IntuitionLabs enterprise comparison](https://intuitionlabs.ai/articles/claude-vs-chatgpt-vs-copilot-vs-gemini-enterprise-comparison) · [TechCrunch on Gemini at I/O 2026](https://techcrunch.com/2026/05/19/google-updates-its-gemini-app-to-take-on-chatgpt-and-claude-at-io-2026/) · [Morphllm plans and limits](https://www.morphllm.com/comparisons/chatgpt-vs-claude-vs-gemini) · [Towards AI comparison](https://pub.towardsai.net/chatgpt-vs-claude-vs-gemini-which-ai-is-actually-best-in-2026-59a50c70dcdb) · [UXPin chat UI](https://www.uxpin.com/studio/blog/chat-user-interface-design/) · [Setproduct AI chat anatomy](https://www.setproduct.com/blog/ai-chat-interface-ui-design) · [Bricx chat patterns](https://bricxlabs.com/blogs/message-screen-ui-deisgn) · [shadcn chat components](https://ui.shadcn.com/docs/changelog/2026-06-chat-components)

Study and learning science: [RemNote on Anki alternatives](https://www.remnote.com/blog/best-anki-alternatives) · [Studyglen FSRS vs SM-2](https://studyglen.com/guides/best-spaced-repetition-apps) · [learnpathhub memory research](https://learnpathhub.org/posts/spaced-repetition-flashcards/) · [Mochi](https://mochi.cards/) · [Mochi vs Anki](https://study-genius-ai.hatolabs.com/blog/mochi-vs-anki-2026) · [retrievalpractice.org](https://www.retrievalpractice.org/why-it-works) · [Hendrick, Monthly Dispatch March 2026](https://carlhendrick.substack.com/p/the-monthly-dispatch-whats-new-in-f3c) · [Eton CIRL on retrieval, spacing, interleaving](https://cirl.etoncollege.com/strategies-for-making-learning-last-retrieval-practice-spaced-practice-and-interleaving/) · [Science of effective learning (2022 review)](https://www.teachertoolkit.co.uk/wp-content/uploads/2022/10/s44159-022-00089-1.pdf)

Tutoring: [Pearson on Guided Learning and Study Mode](https://www.pearson.com/international-schools/international-schools-blog/2026/02/what-is-gemini_s-guided-learning-and-chatgpts-study-mode-.html) · [UK classroom RCT (arXiv 2512.23633)](https://arxiv.org/pdf/2512.23633) · [AI study modes compared (Glasp)](https://glasp.co/articles/ai-study-modes-compared) · [Class Central on AI tutors](https://www.classcentral.com/report/chatgpt-gemini-ai-tutors/) · [Teaching-strategy evaluation (arXiv 2603.26673)](https://arxiv.org/pdf/2603.26673)

NotebookLM and notes: [NotebookLM April 2026 update](https://bibigpt.co/features/notebooklm-2026-update-explained) · [DigitalOcean on NotebookLM](https://www.digitalocean.com/resources/articles/what-is-notebooklm) · [SolidAITech audio overviews](https://www.solidaitech.com/2026/06/notebooklm-complete-guide.html) · [Atlas on Obsidian vs Apple Notes](https://www.atlasworkspace.ai/blog/obsidian-vs-apple-notes) · [TechVerdict on AI-augmented thinking](https://www.techverdict.io/articles/notion-vs-obsidian-vs-apple-notes-2026) · [downloadchaos AI note apps review](https://downloadchaos.com/blog/best-ai-note-taking-apps-2026-complete-review)

Projects: [Opinion AI on Claude Projects](https://opinionai.substack.com/p/claude-projects-how-to-build-and) · [MemX on ChatGPT Projects](https://memx.app/glossary/chatgpt-projects/) · [felloai on ChatGPT Projects](https://felloai.com/chatgpt-projects/)

Building: [Claude Artifacts review](https://www.buildfastwithai.com/ai-tools/claude-artifacts) · [Kanopy: v0 vs Cursor vs Artifacts](https://kanopylabs.com/blog/vercel-v0-vs-cursor-composer-vs-claude-artifacts) · [Cursor Design Mode (3.7)](https://www.totalum.app/blog/cursor-design-mode-totalum) · [Cursor visual editor](https://cursor.com/blog/browser-visual-editor) · [AI UX Playground artifacts teardown](https://www.aiuxplayground.com/teardowns/claude/artifacts/) · [Muzli on the rules file](https://medium.muz.li/the-one-file-that-makes-claude-cursor-and-lovable-build-exactly-what-you-want-eefbe4e023b1)

Canvas: [CodePic tldraw vs Excalidraw](https://codepic.cc/blog/excalidraw-vs-tldraw) · [Storyflow Excalidraw alternatives](https://storyflow.so/blog/best-excalidraw-alternatives-2026) · [Atlas Miro alternatives](https://www.atlasworkspace.ai/blog/alternatives-to-miro)

Keys and privacy: [Calmara on BYOK](https://calmara.app/blog/what-is-byok-bring-your-own-key-ai) · [MoClaw BYOK guide](https://moclaw.ai/blog/byok-ai-platform-2026-guide) · [Lobsterfarm privacy-first AI](https://www.lobsterfarm.ai/guides/privacy-first-ai/) · [BYOKList](https://byoklist.com/) · [Zuplo API key practices](https://zuplo.com/blog/api-key-best-practices) · [saasframe API key UI patterns](https://www.saasframe.io/patterns/api-key)

Design: [Design Studio: UI trends 2026](https://medium.com/@designstudiouiux/the-10-ui-ux-trends-everyone-is-copying-in-2026-dbe5bc275efb) · [Groovyweb: AI app design trends](https://www.groovyweb.co/blog/ui-ux-design-trends-ai-apps-2026) · [Muzli mobile patterns 2026](https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/) · [Uxcel dark mode principles](https://uxcel.com/blog/12-principles-of-dark-mode-design-627) · [Atif Saleem dark mode patterns](https://atifsaleem.com/blog/dark-mode-design-patterns-2026) · [Figmenta dark mode and theming](https://studio.figmenta.com/en/insights/dark-mode-and-dynamic-theming-ux-comfort-strategy-for-2026) · [UXPin dark mode benefits](https://www.uxpin.com/studio/blog/dark-mode-benefits/)

Onboarding: [Userpilot onboarding 2026](https://userpilot.com/blog/best-user-onboarding-experience/) · [Appcues onboarding flows](https://www.appcues.com/blog/best-user-onboarding-examples) · [Mobbin empty states](https://mobbin.com/glossary/empty-state) · [UXCam onboarding examples](https://uxcam.com/blog/10-apps-with-great-user-onboarding/)

iPad: [Fastio iPad AI apps](https://fast.io/resources/best-ai-apps-for-ipad-2026/) · [Lifestack iPad productivity](https://lifestack.ai/blog/ipad-productivity) · [iPadOS 26](https://en.wikipedia.org/wiki/IPadOS_26)

### §4e — One key, every model

The question behind "make it so only one model can be worked, like only
ChatGPT": what happens to a product whose named models are each a *cast* of
two or three engines, when the person has one company's key?

Three answers were possible. Drop to the engines one key can run and stop
calling them Armi models — which throws away the layer the product is. Offer
them all and let the short ones quietly answer with half a cast — which is
the one a menu must never do, because the name then promises a second
opinion nobody got. Or offer what runs and say what does not.

The measurement settled it. Walking every preset against each provider
alone: **every Armi model already runs on any single key.** A cast that
cannot be filled from one company substitutes within it and says so — "one
company", "needs a second key", "(sibling)" — which is a short answer, not a
wrong one. Only a *hard* requirement has no substitution: a tactic that must
look at a picture needs a model that can see. All four companies in the
registry carry one, so today nothing is hidden at all.

So `canRun` is a guard rather than a feature: it hides nothing now and keeps
the menu honest the day an engine list grows a company that cannot see. The
visible half is the counted line under the list — the flagship menus (a
model list that grows when you sign in, a tool row that appears with a
subscription) all fail the same way, by changing silently; a person who
never saw the row has no way of knowing a key would add it.

### §4f — What colour is a dark theme, measured

Asked to make the ground "like ChatGPT black or Claude or Gemini", the
useful move was to stop arguing about it and put the four side by side in
OKLCH, where chroma is the number that says how much colour a near-black
is actually carrying.

| ground | hex | L | chroma |
|---|---|---|---|
| ChatGPT, classic | `#212121` | 0.248 | **0.000** |
| ChatGPT, near-black | `#0d0d0d` | 0.159 | **0.000** |
| Material, canonical | `#121212` | 0.182 | **0.000** |
| Gemini | `#131314` | 0.187 | **0.002** |
| Claude | `#1a1a18` | 0.217 | **0.004** |
| **ARMI, before** | `#0b101b` | 0.174 | **0.024** |

Six times Gemini. Twelve times nothing. And that is the token alone: the
app lays four soft radial washes of cyan and blue over it, and at the
centre of one the ground reaches **0.029 chroma** — seven times Claude's.
Two of the three reference grounds carry no colour whatsoever.

That is the whole finding. The stylesheet's own comment already said the
right thing — "a dark theme is not a colour; it is the absence of one" —
and then set a blue screen. Every answer in the app was being read through
a wash.

**What it cost to fix: nothing measurable.** Contrast is carried by
luminance, and chroma at this level contributes almost none of it, so
taking the colour out while holding every lightness step moves every
text-on-ground pair by less than one part in five hundred — 15.48 → 15.52
on body text. The depth ramp, the elevation rims and the type scale are
untouched because none of them is a hue.

**What is kept.** The mesh, at half strength — the one thing none of the
three has, and the only reason the app does not look like a clone of
whichever it copied. Halved, the brightest point of a blob sits at 0.011
and falls to nothing across a few centimetres; before, it sat at 0.029
across the whole screen.

**Where the yellow went.** A fourth hue is decoration unless it settles
something, and this one settles a collision that was already on screen:
the passage the model points at in a document was drawn in the signal
colour, the same cyan as every control meant to be pressed, so "I read
this sentence" and "press this" were one colour. A highlighter is yellow
everywhere outside a screen, which makes it the only colour in the set
that needs no legend. It is reserved the way the status colours are — it
never carries text, never means a state, and never becomes a fifth accent
— and it is the one token that does not step between themes, because the
paper it lands on is white at midnight too. Ink under a 0.38 wash of it
reads at 15.1, which is the point: the words stay the words.

### §4i — Gold or blue: which colour should the action be

Asked to bring the gold back "if it is better than the blue, and if not,
not", the answer had to be a measurement, because the last time the
question came up it was settled by taste, twice, in opposite directions.

**What the references do.** Three of the four assistants this app is held
against use one warm or one cool accent and nothing else. ChatGPT: a blue
disc for voice and a blue pill for the new chat, no accent anywhere else.
Gemini: a blue-to-violet gradient on the brand and the send control. Claude:
a single terracotta (`#c96442` on dark, `#da7756` on light) on the send
control and the brand, on a warm neutral ground — and it is the one of the
three whose dark theme people describe as "premium" rather than "dark
mode". Warm accent on a black ground is a known read: it is what the
reference with the best-liked dark theme does, and it is what this app's
own identity — a fountain pen, ink and a gold nib — did before the blue
round replaced it.

**Legibility, dark.** The question was whether gold can do the cyan's job
on black without losing anything, and it can:

| role | cyan (before) | gold (after) | on |
|---|---|---|---|
| signal, text strength | `#7ecdcd` 11.4 | `#d9b45a` 10.6 | black |
| signal on a panel | 9.8 | 9.1 | `#171717` |
| signal on a field | 8.3 | 7.7 | `#262626` |
| the button, ink on fill | `#84d1d1` 10.7 | `#c29e3f` 7.2 (held level with the light button's 5.5) | its own fill |
| the ink for reading | `#4babac` 7.0 | `#c09e4a` 7.0 | the bar |

Every pair stays far above AA, and the ink for reading is solved to the
same 7.0 target the cyan was, so the wordmark weighs what it weighed.

**Legibility, light — the fact that decides placement.** Gold cannot carry
text on a light page. `#d4af5a` measures 1.9 against the canvas; to reach
4.6 it has to darken to `#8c6b06`, which is an ochre, and to the 7.0 the
ink target asks for, `#6e4e00`, which is brown. That is not a flaw to fix,
it is what gold is: a colour of high lightness. So in the light theme gold
is a **fill and a stroke, never a word** — the button (an old gold, `#ac8830`, the lightest that still holds the
3:1 edge the app's own gate asks of a control, 5.5 with the ink on it),
the highlight chip in the bright gold with an ochre edge, the search mark — and wherever the signal has to be read as a letterform it is the
ochre ink. That is precisely the rule the app's first identity wrote down
("gold is the nib — a jewel, never a surface") and the blue round threw
away.

**The collisions, measured in OKLab.** A new accent has to stay away from
the three colours that mean something.

| pair | ΔE | verdict |
|---|---|---|
| gold vs the marker `#ffd23f` | 10.5 dark · 12.0 light | apart — and the marker is only ever a wash on a page, the gold only ever a stroke or fill |
| gold vs the warning, before `#ebab72` | **5.0** | too close for a colour-blind reader |
| gold vs the warning, after `#f39a6e` | 8.5 | apart; the warning moved one step toward red and still reads at 9.7 on black |
| gold vs danger `#f6979d` | 15 | apart |
| gold vs chart-2 `#ce7c22` | 13.8 | apart; the chart set is untouched |

The one cost of the change is the warning colour moving, and it moved to a
value that is better separated from the gold than it was from the old cyan
was from the go-green (6.7).

**Verdict.** Gold is the action colour, in both themes: the send disc, the
one button a screen asks you to press, the ring while an answer arrives,
the live dot, the caret's leading edge, the search mark, the letter in the
wordmark. Blue stays structure — links, the active row, focus. Yellow stays
the highlighter. Gold never becomes text in light, and never becomes a
fifth accent anywhere. Where it goes is not "where it was in the old
screenshot"; it is where the signal colour already went, because those are
the places the eye is meant to land.

### §4j — How the models work together, and where it broke

Asked to find out "how the models work together and whether everything
works", the useful answer is a map of what actually happens to a question,
followed by the places the map was wrong.

**The path of one question.**

1. **Route** (`lib/route.ts`). Pure arithmetic never reaches a model — it
   is computed here, exactly. Otherwise the request is sized in tokens, and
   models that cannot hold it, see an image in it, or search when it needs
   searching are removed before cost is weighed.
2. **Cast** (`lib/presets.ts`). An ARMI model is a *tactic*, not an engine:
   a set of jobs given to models from different companies. Eleven of them —

   | ARMI model | who does what |
   |---|---|
   | Polaris | one company lists what the answer must get right; another writes it |
   | Pulsar | the fastest answers; a second company checks while you read |
   | Parallax | one names where it will go wrong; the strongest works; a third checks; revises on an objection |
   | Constellation | three companies each take a half — strategy, reasoning, what is known — a fourth writes, a fifth checks and can send it round again |
   | Aperture | long documents; checked by another company |
   | Nova | builds; a plan first, a check after |
   | Orrery | teaches; briefed on the likely misconceptions first |
   | Lens, Binary | two companies side by side |
   | Rosetta, Voyager | translation, and writing for an audience |

   The rule that makes it work is the one `checker` enforces: a check never
   comes from the same company as the answer, because a model agreeing with
   its own weights is not a second opinion.
3. **Compose** (`lib/prompt.ts`). Identity first, then the house rules,
   then your own standing rules, memory, the project and its files chosen
   by relevance, and the style last, because form is what a long prompt
   forgets first.
4. **Stream** (`/api/chat`, `useStream`). A byte at once and a ping every
   ten seconds, so a slow model is not mistaken for a dead connection. A
   provider that refuses — out of credit, rate-limited, a bad key, down —
   hands the turn to another company, up to three hops, and the page says
   which and why.
5. **After** — `compute` blocks run the model's arithmetic for real; the
   app's own tools (cards, notes, projects, memory) run on request and can
   be undone; a check reads the answer back.

**Where it broke — measured, then fixed in this round.**

| what | before | now |
|---|---|---|
| A long book as a *source* (Notebook, Tutor) | cut to its first 90k characters (Tutor: 40k) — a 988-page textbook became its first ~40 pages, silently | read whole in ~60k-character parts by the cheapest long-window model into notes with exact quotations, then written from all of it (`lib/digest.ts`, `e2e-book`) |
| A long book *in a conversation* | sent whole to the biggest window; the provider refused it — "prompt is too long" | read in parts before the turn goes out; the thread keeps the notes (`fitFiles`, `e2e-bigfile`) |
| A silent reasoning model on a big source | the connection was dropped as dead | heartbeat (`e2e-stall`) |
| "Which AI are you?" | named the lab underneath, and a different one after a failover | Armi, and the ARMI model's name; made by Almaz (`test-identity`) |

The first row is the one that mattered most for a study app, because it
was invisible: the revision pack looked finished, cited correctly, and was
about chapter one. Citations stay honest across the new path because the
reader is told to copy its quotations exactly and `lib/cite.ts` checks
every one against the original file, not against the notes.

**What is left, honestly.** A scan with no text layer still needs OCR the
app does not do; the reader keeps quotations but not page numbers, so a
citation says which file and what sentence, not which page; and past 48
parts (~2.9M characters) a book is read in an even spread rather than
every part — the page says so when it happens.

### §4g — Where a room belongs in a list

The ask was for the shell of the reference app: the panel, the colour, the
sizes, "put them to perfect psychological place". The first three are
measurement. The fourth is an actual result from cognitive psychology, and
it had been ignored.

**The serial-position effect** — first described by Ebbinghaus, and one of
the most reliably replicated findings in the field — is that the first and
last items in a list are recalled far more readily than anything in the
middle. It is about lists exactly like a column of rooms: six entries means
two good seats and four ordinary ones, and which room gets which is a
decision whether or not anybody makes it.

Nobody had made it. The order was the order the rooms were built in:

| seat | was | strength |
|---|---|---|
| 1 — primacy | Conversations | strong |
| 2 | Projects | ordinary |
| 3 | Notebook | ordinary |
| 4 | **Study** | weakest position in the list |
| 5 | Artifacts | ordinary |
| 6 — recency | Creative | strong |

Study — the one room a chat window structurally cannot be, and the reason
somebody picks this over the tool they already have — sat in the single
worst position. Creative, the least-opened room, held the second-strongest
seat in the column.

The order now is Conversations, Study, Notebook, Projects, Creative,
Library. Primacy goes to where nearly every session starts; the seat below
it to the room that is the product's reason to exist; the middle to the
three supporting rooms, which is what a middle is for; and recency to
Library, because "where is the thing I made" is the other question people
arrive with, and the last seat suits a destination you go *looking* for
rather than one you land on.

**Sizes, measured off the reference rather than guessed.** Rows went 32 →
36 → 44. Each step was the same argument won more completely: a row built
to the size of its text is a row you read, and this is a row you put a
finger on. 36 was the floor for a pointer; 44 is Apple's floor for a touch
target and what the reference measures at (~42 at its scale). Icons 18 →
20, label 14 → 15, side padding 10 → 12.

**The panel, not the wall.** A border welded to the viewport edge says
"this is the frame of the application". A panel inset from three edges,
cornered and lifted, says "this is one surface among others" — which is the
truer description of a list of rooms, and is what all three references do
now. Flush on a phone, where a drawer covers the screen and a margin would
be a gap to nowhere.

**And the light ground, by the same method as §4f.** The canvas was
defensible at 0.0086 chroma (Gemini's surface is 0.0079), but everything
above it was not: `bg-subtle` at 0.020, the borders at 0.019, and **every
word of text at 0.030**. Cut to 35%, the text lands at 0.011 and the
surfaces between 0.003 and 0.007 — inside the band the three references
occupy (ChatGPT 0.000, Claude 0.0054, Gemini 0.0079). Contrast moves by
under 0.05 on every pair, for the same reason as before: luminance carries
contrast and none of it changed. The light mesh is halved too.

### §4h — Where the things you made should live

Asked for a Library holding everything made, the question was its shape,
and two products had already answered it.

**ChatGPT's Library** is one chronological place for the things you
generated, with edit, download and delete available from there rather than
from the conversation that made each one. The thing is the unit; the
conversation is provenance. **Google Drive** went the other way on the same
problem in 2024: its home used to make you pick Files *or* Folders and now
shows both in one list, narrowed by search chips for type and date rather
than split into views. The lesson from both is the same and it is the one
that matters: **a split view asks the reader the question they came to
avoid answering** — which room did I make that in.

ARMI's version was three lists in three rooms. A page in the Notebook, a
deck in Study, a document in the room that was called Code, then Artifacts,
then Library — a name that promised the unified thing while listing a
third of it.

So the Library is one list now: pages, decks, documents, code files and
web apps, newest first across all of them, because the date is the one
fact a person reliably remembers about something they made. A row of kind
chips narrows it — only for kinds that exist, since a chip for a kind with
nothing in it is a control that does nothing when pressed. Each row says
what it is before it says what it is called (a mark before the title), and
opens into the room that knows how to edit it: a page into the Notebook, a
deck into Study, a document into the editor.

**What stays where it was: making things.** The starters here make
canvases; a page is written in the Notebook and a deck in Study. A room
that can make everything is a room that explains itself for a paragraph
before it lets you do anything, and every reference product keeps creation
close to the surface that edits the result.



### §4k — Design and functions, September 2026: what the flagships and the evidence say, and what was built

Asked for "better design and functions, from research". A sweep of what ChatGPT, Claude, Gemini (NotebookLM is now Gemini Notebook), Perplexity, Le Chat and Grok ship, what study apps keep and drop, and the learning-science behind them; then a screenshot audit of every room at phone and tablet size.

**What lasts and what gets dropped.** Loose "chat tutor" and push features were retired this year (Quizlet's Q-Chat, ChatGPT Pulse, Grok Companions); grounded, source-cited study outputs stay (Gemini Notebook's flashcards with an "Explain" on a miss, study mode, guided learning). Users want to know which model answered (the GPT-5 router backlash) and answers that are not merely agreeable (the April 2025 sycophancy rollback).

**Evidence used this round.**
- Interleaving — Rohrer, Dedrick, Hartwig & Cheung (2020), preregistered, 787 students: mixed practice 61% vs blocked 38% a month later (d = 0.83). ARMI's due queue was ordered by due time, and cards made together fall due together — blocked by construction. Now mixed (`interleave`).
- Desired retention as a choice — FSRS benchmark (500M+ reviews); Anki exposes it. ARMI fixed it at 90%. Now 80–95% with the daily cost said beside it.
- Hints before answers (Bastani et al., PNAS 2025: plain GPT-4 help raised practice scores and lowered them once removed; a hint-giving tutor did not) — ARMI already has the hint ladder and Learning style. Confidence before the reveal (hypercorrection) — already asked (`Sureness`). Relearning in-session — already (an "again" card returns in a minute).

**Audit findings built.** Phone rooms spent ~100px on a bar holding only the sidebar button above the room's own header; the button now sits in that header. Study put the due line under the new-subject box, below the fold on a phone; due is first. Six follow-up pills wrapped to two tall rows on a phone; one swipe row. The recall line read "0% of 93" from days logged before right answers were kept; those days are left out. A Notebook page could open blank while the renderer loaded; the fallback is now the text.

**Built in the second pass.** "Why?" on a missed card, three sentences with the source's own line quoted (Gemini Notebook's Explain, `lib/explain.ts`); "Try 3 first" on a Tutor page (pretesting effect). A recap of dropped turns already existed (`recapPrompt` in `app/page.tsx`), which is the "summarise and continue" the flagships added this year. **Still worth doing:** an exam-date plan that sets the aim and spreads the load.

Sources: Rohrer et al. 2020 (gwern.net/doc/psychology/spaced-repetition/2019-rohrer.pdf); Bastani et al. PNAS 2025 (pnas.org/doi/10.1073/pnas.2422633122); Kestin et al., Sci Rep 2025 (nature.com/articles/s41598-025-97652-6); FSRS benchmark (expertium.github.io/Benchmark.html); Anki 26.05 release notes; Gemini Notebook rename (workspaceupdates.googleblog.com, July 2026); NotebookLM flashcards (support.google.com/notebooklm/answer/16958963); ChatGPT study mode (openai.com/index/chatgpt-study-mode); sycophancy post-mortem (openai.com/index/sycophancy-in-gpt-4o); Quizlet Q-Chat notice; WCAG 2.2.

### §4l — Everything ChatGPT, Claude and Gemini do (September 2026), held against ARMI

Three catalogues, one per product, from each company's help centre and release notes where reachable and from search snippets and press where not (`[unverified]` where only the latter). Roughly 90 rows each; what follows is the reading of them, not the rows.

**Where the three have gone this year.** All three merged their modes into one box that decides for itself: ChatGPT retired Canvas for in-thread writing and code blocks (May), folded agent mode into "Work" (July) and is retiring custom GPTs into plugins (September); Claude merged chat, Cowork and artifacts into "one Claude" with `/deep-research` replacing the Research toggle (16 Sep); Gemini put Deep Research, Canvas, Guided Learning and study notebooks behind one composer. The pattern ARMI already follows — Auto reads the ask, the rooms are places not modes — is the one they converged on.

**What all three have that ARMI did not, and what was done.**

| Capability | ChatGPT | Claude | Gemini | ARMI now |
|---|---|---|---|---|
| A picture from words | Images 2.5, sketch, templates | none (SVG/Design instead) | Nano Banana 2 / Pro | **Built**: `/image …` or "draw me a …" → a picture in the thread, on the OpenAI key; `Save picture`; the + menu offers it. |
| Camera in the composer | mobile | mobile | mobile | **Built**: *Take a photo* in the + menu (`capture="environment"`). |
| Text size / dyslexia font | — | font: default / system / dyslexic | — | **Built**: Appearance → Text size, four steps on the root. Dyslexia font: not yet. |
| Scheduled tasks | 3–15 active, push/email, webhooks | cloud, hourly–weekly | up to 10, Spark agent | **Built (local)**: Routines — a prompt on a schedule that runs when Armi is open, said honestly on the panel. |
| Deep research (multi-step report) | yes, with MCP sources | `/deep-research`, 1–3 min | plan → browse → cited report → audio | **Built (light)**: `/deep …` — research on, and the model told to search from several angles before writing a report with headings and a Sources list. |
| Share a conversation | public snapshot links | public link + invite | public links | **Built (local-first)**: Share → the device's share sheet (Web Share) with the thread as text, else a Markdown file; no server, so no link that outlives the browser. |
| Memory you can read and edit | saved memories + "dreaming" summary | topics, import from other assistants | saved info + personal context | Already had (Settings → Memory, offer-then-save). |
| Projects with files and instructions | 5–40 files | unlimited, RAG past the window | Gems + Notebooks | Already had (Projects, BM25 retrieval, 60k-token budget). |
| Custom assistants | GPTs → plugins | skills | Gems | Partly: Armi models (casts) + Rules + a project's instructions. A named "Gem" that bundles a project, rules and a model: not yet. |
| Study mode / guided learning | Study mode, flashcards, QuizGPT | Learning style | Guided Learning, study notebooks, quizzes | Already had, and deeper: FSRS, Tutor beside the page, mixed review, Why?, Try 3 first. |
| Audio overview / read aloud | read aloud | voice mode only | Audio Overview, Video Overview | Read aloud per answer already; a two-voice overview of a page: not yet (needs a TTS provider; the browser's voices are not good enough). |
| Files out (docx / xlsx / pptx / pdf) | via Python sandbox | file creation | file generation | Print to PDF and Markdown/HTML downloads only. Office formats: not yet. |
| Voice conversation (two-way) | GPT-Live | voice mode | Gemini Live | Recognition in, read aloud out; hands-free mode exists (`useVoiceMode`); no full-duplex model. |
| Computer / browser agent | Work, Chrome extension | Claude in Chrome, computer use | Auto browse | Out of scope for a local-first study app. |
| Data analysis (Python) | sandbox | sandbox | cloud computer | `compute` blocks run exact arithmetic and charts render from a fence; no Python. |
| Connectors | apps (Drive, Gmail, Slack…) | MCP connectors, plugins | Connected Apps | Remote MCP plugins already. |

**Sources (primary where reachable):** help.openai.com release notes and FAQ pages (study mode, memory, projects, scheduled tasks, shared links, custom GPT retirement, Word add-in); openai.com/index (GPT-Live, Images 2.5, Work, memory dreaming, parental controls); support.claude.com articles 8241126, 9487310, 9547008, 11817273, 11647753, 11088861, 10166901, 13854387, 16761823, 16762437, 8887527; support.google.com/gemini answers 14903178, 15274899, 16047321, 15719111, 16275879, 15146780, 16598469, 13695044; support.google.com/gemininotebook answers 16215270, 16212820, 16958963; blog.google and workspaceupdates.googleblog.com posts named in the catalogues. The three catalogues in full are in the session record, not in this file.

### §4m — The "maximum AI" map, held against what is here

Almaz pasted two architecture documents — a 55-item capability map and a "maximum architecture" for combining GPT, Claude, Gemini, DeepSeek and Kimi (router, model pool, independent witnesses, critic, fact-checker, confidence engine, escalation ladder, tool bus, memory layers, context engine, health, learning, shadow mode, modes). This is the honest reading of both against ARMI, item by item, and what was built where a gap was real.

**The architecture, piece by piece.**

| The document says | ARMI |
|---|---|
| Input layer: text, image, file, voice, screen | Text, images (paste, attach, camera), PDF and text files, voice in (recognition) and out (read aloud). Video and screen-share: no. |
| Intent engine | `lib/task.ts` (`taskOf`: learning, coding, research, writing, data, design, …), `lib/decide.ts` (`planTurn`: strategy, check, mode), `lib/image.ts` (a picture asked for), `lib/slash.ts` (said outright). |
| Task decomposition / planner | The casts: Constellation has three companies take a half each — strategy, reasoning, what is known — a fourth writes, a fifth checks and can send it round. Not a general planner that spawns arbitrary agents; a fixed set of named tactics, which is what makes them explainable on the row. |
| Model registry with profiles | `lib/models.ts`: window, output, prices, vision, reasoning, tools, wire, legacy. No hand-typed "reasoning: 0.9" scores — the document itself warns against them; what stands in is measured (below). |
| Router: complexity, modality, freshness, cost, window, availability | `lib/route.ts`: arithmetic never reaches a model; sized in tokens; models that cannot hold it, see it or search are removed; then cost; `wellOnly` walks round providers failing this minute (`lib/health.ts`); the router's reason is printed under every answer. |
| Route more than once | A provider refusal moves the turn (three hops); research on a model that cannot search moves it to one that can; "With more effort" re-routes the same question with a higher effort; a checker's objection sends it back to the writer (Parallax, Constellation). |
| Independent witnesses, not a telephone chain | The checker is always another company (`checker` in route.ts); the brief is written by one company for another (Polaris); Binary asks two side by side, each blind to the other. |
| Critic | Sentinel's second opinion (`lib/verify.ts`): agrees / partly / disagrees, in its own words, never told which model wrote the answer; the lint (`lib/lint.ts`) reads the answer back against the house rules. |
| Fact-checker by claims with evidence | **Built this round**: *Fact-check on the web* on any answer — the claims are pulled out one by one and each searched for by the strongest keyed model that can search; each comes back found / contradicted / unclear with the page it rests on (`lib/factcheck.ts`). |
| Confidence engine: system confidence, not model confidence | **Built**: a line under a checked answer — High confidence / Likely right / Uncertain / Doubtful — put together from the second company's reading and the evidence, never from the model's own number. A contradicted claim is Doubtful whatever the models thought. |
| Escalation ladder (deterministic → cheap → strong → two-model → multi-model → research → agent) | Level 0 is `compute` and `calculate`; then Pulsar (fast, checked while you read), Polaris (brief then write), Parallax (reason, check, revise), Constellation (council); Research and Deep on top; Nova for building. **Built**: `/fast` and `/max` name the ends of the ladder. |
| Tool bus, model-independent | `ToolSpec` once, wrapped per adapter — every model gets the same rooms. |
| Memory layers | Thread (fitted, recapped), saved memories, project instructions and files, study state, router memory (`turns`), routines. |
| Context engine: only what matters | BM25 retrieval over project files with a token budget; the fitter drops from the front and recaps what it dropped; tools are listed only when the person asked for the thing they write. |
| Model health | `lib/health.ts`: failures remembered for the minute, routing walks round them, forgotten on reload. |
| Learning system | `turns` records kind × Armi model × outcome (retry, edit, thumbs down); `withPast` stops picking a model that keeps needing another go at one kind of work. **Built**: the table is now on Settings → Model, so it is not a rumour. |
| Shadow mode, A/B tests | No. Both spend the person's own money on answers they never see; wrong for a bring-your-own-key app. |
| Modes: Fast / Balanced / Deep / Research / Coding / Agent / Maximum | Pulsar / Polaris / Parallax / Research / Nova / — / Constellation. "Agent" as a long-running autonomous loop over a browser: out of scope on purpose. |
| Multi-agent orchestrator with a dozen named agents | The named agents that exist are the ones with a measurable job: reader (digest), brief, writer, checker, council, linter, fact-checker, tutor. |

**The 55 capabilities, in short.** Have: language, conversation, intent, context, memory, reasoning, planning (fixed tactics), knowledge, web search, deep research (light), RAG, vision, voice in/out, image generation and editing, file intelligence (PDF, text, code; no Office), writing, translation, mathematics (exact), data (charts, tables, `compute`), coding, code execution (canvas and `compute`), debugging (self-heal), tool calling, MCP, personalization, custom AI (casts + rules + projects), projects, artifacts, interactive outputs, tutoring (deep), creative, automation (routines), integrations (MCP), proactive (offers, due-first, routines), verification, self-correction, safety, permissions, privacy, evaluation (the gate: ~120 checks), observability (spend, latency, tokens, router memory, actions shown), context optimization, reliability (failover, heartbeat, retries). Partial or no: audio files as input, video, computer and browser use, long-running autonomous agents, Office-format files out, a general planner.

**Built this round, in one line each.** Fact-check by claims with web evidence; a system-confidence line; `/max` and `/fast`; a picture attached to `/image` is edited, not redrawn; the router's memory on the Model panel.

### §4n — The strategy router, held against what is here

A third pasted document: the "maximum architecture" as a strategy router — cheapest sufficient strategy, a twelve-rung ladder, an intelligence broker, predictive escalation, disagreement as a signal, an evidence graph, adversarial agents, a context engine, hierarchical memory, five caches, tournaments, cost per success, a budget governor with dynamic expansion, a stop engine, agent spawning, tool-first, self-healing, lifecycle and shadow routing, feedback as routing data, task fingerprints, a decision function, three operating modes.

**Already here, by another name.** Strategy before model: `planTurn` decides compute / build / answer and whether a check is worth buying before any engine is named. Tool-first: sums never reach a model. The ladder: calculator → Pulsar → Polaris → Parallax → Constellation, plus Research, Deep and Nova, with `/fast` and `/max` at the ends. The fingerprint: `taskOf` (kind, signals) and `shapeOf` (quick, coding, depth, vision, size) — printed as the reason under the answer, not hidden. Stop engine: a check only on kinds where a disagreement can be settled (`checkable`), and only when the record says it is worth it (`withPast`). Adversarial critic: Sentinel's checker, never told who wrote the answer. Independent witnesses: always another company. Context engine: BM25 over project files under a token budget, the fitter and the recap. Memory layers: thread, saved, project, study, routine, routing. Self-healing: three hops on a refusal, a heartbeat, retries; the canvas self-heals on console errors. Lifecycle: `legacy` in the registry, Auto stays on the current generation. Feedback as routing data: `turns` and `pastFor`. Three modes: Auto, the Armi models and slashes, keys on the server.

**Built this round.**

| The document says | Now |
|---|---|
| Budget governor | Settings → Model → *Spend per answer*: Low / Balanced / Any, a ceiling on price per million the router keeps to among what can do the job (`SPEND_CAP`); a picture or a long document is never traded for price; a ceiling nothing can meet is said on the row and the cheapest that can is used. |
| Cost per success; feedback changes the choice, not only the check | The router returns the rest of the bench (`alternates`), and `movedByPast` gives the turn to the next one when the record says the first keeps needing another go at this kind of work — same thresholds as the second-opinion rule, and the row says why. |
| Predictive / offered escalation | Under a checked answer whose confidence is Uncertain or Doubtful: *Again, with more effort* · *Ask Parallax* · *Ask Constellation* — offered, because the next rung costs money and the person can see the doubt. |
| Disagreement as the signal | Binary and *Compare*: once every column is in, the cheapest model reads them side by side and says where they stand — agree / mostly / disagree — and names the point of difference, so the choice is made about that. |

**Not built, and why.** Five caches: prompt caching is on where the provider offers it, the reader's notes are cached per source, and tool results are kept on the turn; an exact- or semantic-answer cache serves a service with many users asking the same thing, not one person. Tournaments and shadow routing spend the person's own key on answers they never see. Agent spawning and a general planner: the named tactics are the agents, and they are explainable on the row because they are fixed. A quality predictor that guesses success before verifying: a model's estimate of its own success is the number the document itself says not to trust; the app measures instead — the record, the second company, the evidence.

### §4o — "ARMIS MAX", held against what is here

The second architecture document names four product tiers over the providers' current production families and asks that the router choose a *level* rather than a model, that reasoning be adaptive, that every meaningful answer pass a gate and climb when it fails, and that the bench carry roles. What was built, and what was not:

| Asked for | Built | Where |
|---|---|---|
| Four tiers: Astro 5, Mira 4.1, Lumos 4, Nova 4, each over the named stacks | Yes — the everyday group is exactly these four; engine lists follow the document's allocation (Sol / Fable 5.1 / Flash / Kimi for Astro; Terra / Opus 5.5 / Sonnet 5 with Flash checking for Mira; Terra / Sonnet 5 / Flash for Lumos; Luna / Flash / Haiku 4.5 for Nova), resolved dynamically from the keys in the browser | `lib/presets.ts` |
| Built on API ids, no fictional flagship | Yes — `gpt-6-astra` is gone; the OpenAI bench is the GPT-5.6 family; Opus 5.5 added, Opus 5 a fallback | `lib/models.ts` |
| Level 0 — no LLM | Already — the calculator, exact, for nothing; and `compute` fences for anything more | `lib/arith.ts`, `lib/answer.ts` |
| Levels 1–4 → tier | Yes — `levelOf` reads the router's shape: quick or short → 1; image → 3; depth plus the whole of something, rigour, a proof, tens of papers, or a book's worth of text → 4; else 2 | `lib/tiers.ts` |
| Adaptive reasoning | Yes — low / medium / medium / high up the rungs, and each tactic's own effort on top | `LEVEL_EFFORT`, `Preset.effort` |
| Budget as a router input | Yes — spend caps the level (low → Nova 4, balanced → never Astro 5); a picture is never traded for price | `levelOf` |
| Historical performance as a router input | Yes — within the tier, `movedByPast` hands the turn to the next writer on its bench; and the record earns the check | `resolveCast` → `alternates`, `withPast` |
| Quality gate → escalate | Yes, for the case the app can judge — a check that objects sends the second pass to a stronger writer (`escalate`) with the objection in hand, once per question; and the confidence line offers the next rungs | `resolveCast({escalated})`, `Message.tsx` |
| "One model enough?" before spending the cast | Yes — the brief and the council seats run only past a length that says the question has parts (`worthBriefing`, `worthConvening`); a one-line ask on Astro is one strong model and a check | `lib/presets.ts` |
| Disagreement detection | Partly — the judge on compared answers names the point of difference; the fact-check settles a claim on the web when asked. Not built: an automatic "which assumption differs" pass | `Compare.tsx`, `lib/factcheck.ts` |
| Evidence graph | The prompt half — reported vs established, counter-evidence, source quality, in deep research. Not built: a stored graph of claims and sources | `DEEP_RESEARCH` |
| Model-performance memory | Already — kind × model: answers, needed another go, typical wait; read by the router and shown in Settings | `pastFor`, `RouterMemory` |
| Roles: active, specialist, verifier, shadow, legacy, deprecated | Yes — `role` on the bench; shadow is never chosen blind, deprecated never called | `roleOf`, `blindPick` |
| Tournaments and shadow runs | The role only. A browser with one person's keys cannot run a model in shadow against every answer without doubling their bill; a shadow model is watched by being named in a tactic on purpose | — |
| Dynamic specialist agents | Partly — Astro convenes an independent reasoner and a long-context reader; Constellation three angles. Not built: a planner that names a cast of economist, coder, critic per question | — |
| Lumos as a perception layer | Partly — a PDF is read into text here before any model sees it, and a picture goes only to a model that can see. Not built: OCR, chart and table extraction, audio and video as separate steps | `lib/pdf.ts`, `resolveCast` |

The principle the document ends on — the cheapest, fastest strategy with a high enough chance of getting this right — is now what Auto does: a level, a tier, a cast sized to the question, and the top of the ladder for the few per cent that earn it.

## 5. Every room against the field, September 2026 — and what was built from it

A second sweep, this time by room, with the question "what does the field ship that a person in this room would miss here". Sources are the ones read on 24 September 2026; the claims about other products carry `[R]` where a page said it and `[K]` where it is common knowledge in the field.

### 5.1 The model menu and the key

The flagships hide the model behind a switch and a tier of subscription; the reference's menu is a short list with a check mark, and "Auto" is the default everywhere `[K]`. What ARMI had that they do not is the cast — a model is two or three engines with jobs — and what it lacked was two things: the menu did not read as a *scale*, and only Conversations had a menu at all. Both built: the picker draws the four tiers as a ladder in the order Auto climbs them, each rung marked and priced per answer; and every room's header carries the room's model, honoured by Study's card drafting and by the Tutor.

The key was the other wall. Every product in the field is a subscription first and a key never; ARMI was a key first and nothing else. Quizlet wraps its best features in a $35.99-a-year Plus plan `[R]`; the AI study apps compared this year sell mock exams and study plans on the same model `[R]`. **Armi Plus** is the answer that keeps the app's rule: a dollar a month, sold by a merchant of record (Dodo Payments) that issues a license key, the key kept like an API key, the server's own provider keys unlocked by it on the everyday engines only, and a monthly allowance in the merchant's own credit ledger. Nothing about the person is stored anywhere but the merchant's books; the app still has no accounts. The top of the ladder still needs a key of one's own, said on the panel in words.

### 5.2 Study

ChatGPT's study mode asks questions one at a time, checks understanding, references uploaded notes and images, and makes flashcard-style review `[R]` — all of which the Orrery and the Tutor already do beside a page. Anki's FSRS-6 scheduler is the benchmark for retention `[R]`, and ARMI runs the same family of model. Quizlet's Learn mode is "basic spacing", not a memory model `[R]`. Where the field was ahead:

- **A plan for the day.** The exam-prep apps sell "personalised practice sessions" and "daily quizzes" as a plan `[R]`; most of them are a model's guess. Built as the scheduler's own arithmetic instead: **Today**, at the top of Study — the topic slipping most with its recall rate, the page least recently read, the exam and how far off it is. No model call.
- **A test, not a review.** Studocu's mock exam and StudyGlen's practice tests build a paper from your own notes `[R]`; Quizlet's Test mode types the answer `[K]`. Built: **Test me** on any deck — ten questions, typed, marked locally, a score, the wrong ones with what was expected, and one press to study exactly those. The schedule is untouched.
- **Time, as well as count.** The calendar knew how many cards a day and never how long. Built: a 25/5 session in the Today card that logs minutes to the day.
- **The exam.** The countdown starter existed as a canvas; it is now a setting the plan reads.

Not built, and still worth it: adaptive difficulty bands in the Tutor (AD-1), past-paper practice with a hidden mark scheme (EX-2), highlights that persist on a page (WD-8).

### 5.3 Studio and Creations

Claude's artifacts publish to a link and can be remixed; Gemini's Canvas edits a document beside the chat; neither ChatGPT's nor Gemini's canvas has a publish button `[R]`. Lovable and Bolt keep version history with rollback; v0 does not `[R]`. ARMI already keeps versions with a diff, runs the thing beside the conversation, downloads a canvas as one file, and previews at phone, tablet and full width. What was missing in this round was the room's model: Studio's composer and Creations' header now carry it. Publishing to a link is deliberately not built — it needs a server that knows the person, which the app does not have.

### 5.4 Notebook and Projects

NotebookLM's Studio makes audio and video overviews, mind maps, study guides, flashcards, quizzes and reports from a bounded set of sources `[R]`; Perplexity's Spaces group sources and chats for a project `[R]`. ARMI's Notebook makes revision packs, study guides, questions and cards from a page or a document, and Projects hold instructions and files every chat can see. The gap the sweep found is audio and video overviews, which are out of scope without a speech model; the mind map is a starter in Studio.

### 5.5 What this round built, in one list

Armi Plus (§5.1) · the picker as a ladder · a model choice in every room · Today's plan · the session timer · the exam countdown · Test me · the sidebar switch in every room (§4o's follow-up).

### Sources for §5

- OpenAI, "Using study mode in ChatGPT" (help.openai.com/en/articles/11780217) and "Introducing study mode" (openai.com/index/chatgpt-study-mode).
- Coursebox, "Anki vs Quizlet: I Built the Same Deck on Both (2026)"; Quizgecko, "Quizlet vs Anki in 2026"; learnclash, "Anki vs Quizlet: Free Flashcards vs Paywall [2026]".
- Wikipedia, "Anki (software)" — FSRS integration.
- UniAcco, "Studocu AI Mock Exam Tool — Student Review 2026"; StudyGlen, "Best AI Practice Test & Exam Generator 2026"; Laxu AI, "Best AI Study Tools in 2026".
- Drafty, "What is Gemini Canvas?"; CanvasLink, "Claude Artifacts vs ChatGPT Canvas vs Gemini Canvas (2026)"; Guvi, "How to Use Claude Artifacts".
- Lovable, "Lovable vs Bolt vs V0"; UI Bakery, "Bolt vs Lovable vs V0: Which One to Choose in 2026?"; Emergent, "v0 vs Lovable vs Bolt".
- DigitalOcean, "What Is NotebookLM? Features and How to Use It in 2026"; Google, "What's new in NotebookLM: Video Overviews and an upgraded Studio"; Elephas, "NotebookLM vs Perplexity (2026)".
- OpenAI, "Pricing | OpenAI API" (developers.openai.com/api/docs/pricing); OpenRouter, "GPT-5.6 Terra"; CometAPI, "GPT-5.6 Pricing 2026: Sol, Terra & Luna" — the GPT-5.6 family and its prices, which the registry matches.
- Dodo Payments skills bundled with the `dodopayments` Claude plugin (dodo-best-practices, checkout-integration, license-keys, credit-based-billing, webhook-integration) and the `dodopayments` SDK's own resource paths, read from the package.

## 6. The four assistants by room, and the second round built from it

**6.0 A long thread is the app's problem, not the person's.** ChatGPT, Claude and Gemini never show a "switch model" button when a conversation outgrows a window: ChatGPT trims and summarises silently, Claude tells you the thread is full and offers a new one, Gemini's window is large enough that it seldom arises. ARMI already summarised the part that would not fit (T-3) and read whole books in parts; what remained was the raw refusal itself — a 200k model saying "too long" produced a red bar and a button. Built: the turn moves itself to the widest window the keys open, the same company preferred and the cheapest model at least as deep, and the row says so; the bar and the button stay only for the case where nothing holds more. The Subscribe button likewise never dead-ends: a checkout the API will not create falls back to the product's own payment link.


A shorter sweep than §5, asked the other way round: for each of ChatGPT, Claude, Gemini and Kimi, what would a person in each ARMI room miss. Read 24 September 2026.

| Room | What the field has | Here, after this round |
|---|---|---|
| Conversations | ChatGPT's picker became *Instant / Medium / High* with a line of meaning each; Instant switches itself up when a request wants thought `[R]`. Kimi's OK Computer builds sites and slides from a prompt and reads a million rows `[R]`. All four export an answer to PDF or share it `[K]`. | Thinking time is that list. Auto has climbed the ladder since §4o. An answer saves as PDF from its menu. Slides are not built. |
| Study | Every study app sells a plan and a mock; the lesson-plan tools converge on objectives, activities, checks for understanding and an exit ticket `[R]`. | Today, Test me (§5.2), and now **Make a lesson** — that shape for one learner, on a page. |
| Notebook | NotebookLM makes guides, quizzes, mind maps and audio from sources `[R]`; every document tool prints to PDF. | Packs and lessons, saved as PDF with the browser's own engine, every language intact. Audio is out of scope. |
| Projects | Claude Projects hold files and instructions for many chats; Gemini Gems are a saved expert with standing instructions and live Drive files `[R]`. | Projects hold files and instructions; the rules panel is the standing instructions. Live cloud files are not built — nothing here has an account. |
| Studio and Creations | Claude publishes an artifact to a link; Lovable and Bolt keep versions and deploy `[R]`. | Versions and a diff, one-file download, previews at three widths. Publishing needs a server that knows the person. |
| The key | Every product is a subscription; none is a key. | Armi Plus is live on Dodo's product `pdt_0NoDp6xhLdHILChollXEj`, and works from the product id alone. |

### Sources for §6

- OpenAI, "ChatGPT Business release notes" (help.openai.com/en/articles/11391654) — the June 2026 picker; reconnAI, "ChatGPT's Simplified Model Picker"; Tony Reviews Things, "ChatGPT Model Picker Simplified".
- IntuitionLabs, "Kimi K3 vs Claude, GPT-5 & Gemini: Pricing & Benchmarks 2026"; NxCode, "Kimi AI: Complete Guide to Features"; Wikipedia, "Kimi (chatbot)" — OK Computer.
- LumiChats, "Claude Projects vs ChatGPT Projects vs Gemini Gems (2026)"; OpenClaw, "Claude Skills vs ChatGPT GPTs vs Gemini Gems"; Bootstrap Creative, "ChatGPT vs Claude vs Gemini: Feature & Terminology Map (2026)".
- Forasoft, "AI Lesson Plan Generator in 2026: A District Buyer's Guide"; Edcafe AI, "10 Best AI Lesson Planners for Teachers in 2026"; Kuraplan, "9 Best AI Lesson Plan Generators (2026)".

