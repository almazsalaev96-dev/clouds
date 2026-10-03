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

### 5.3 Studio (and, until it was folded in, Creations)

Claude's artifacts publish to a link and can be remixed; Gemini's Canvas edits a document beside the chat; neither ChatGPT's nor Gemini's canvas has a publish button `[R]`. Lovable and Bolt keep version history with rollback; v0 does not `[R]`. ARMI already keeps versions with a diff, runs the thing beside the conversation, downloads a canvas as one file, and previews at phone, tablet and full width. What was missing in this round was the room's model: Studio's composer and Creations' header now carry it. (Creations has since been folded into Studio — one room to ask, to start, and to find what was made — which is also how Claude's artifacts and Gemini's Canvas present: the list of things made sits with the place that makes them, not in a room of its own.) Publishing to a link is deliberately not built — it needs a server that knows the person, which the app does not have.

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

**6.0a Four models, not twelve.** ChatGPT shows one model and a few modes; Claude shows three models; Gemini two. None asks the person to know that a maths question wants a different product from a letter. ARMI's second menu — eight specialists "for a particular job" — was that ask. Built: the specialists are now what the four tiers become for a kind of work (`SPECIALTY`), read off the question or named by a verb (`/study`, `/build`, `/translate`, `/write`, `/maths`), with the row saying what the tier did ("as a builder", "teaching", "in council"). The menu is the ladder and nothing else.

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

## 7. Sixty-five capabilities against ChatGPT, Claude, Gemini, Kimi and Grok — 25 September 2026

Scored 2 / 1 / 0 (full / partial / none) per capability from each company's release notes and help pages and from SPEC.md; the page with the whole matrix is published as the artifact *ARMI Against the Field*. Parity is Σ min(ARMI, product) over the product's rows ÷ the product's own sum; "at least as capable" counts rows where ARMI's mark is not lower.

| Product | Of what it does, ARMI does | ARMI at least as capable on | ARMI leads on |
|---|---|---|---|
| ChatGPT | 92% | 92% of its rows | 27 rows |
| Claude | 91% | 92% | 27 |
| Gemini | 89% | 89% | 25 |
| Kimi | 89% | 91% | 36 |
| Grok | 91% | 92% | 36 |

(Before the two rounds below: 86 / 85 / 84 / 83 / 86; after the first, 90 / 89 / 87 / 87 / 89.)

**Only here (21 rows, none of the five has them):** a cast from a second company (brief, check, council); two answers side by side; the answer says why the model was chosen; a claim-by-claim fact-check with the contradicting page; built apps that heal their own console errors; preview at three widths; flashcards with FSRS; a tutor beside the page with a pencil; revision packs with mark schemes; lessons; today's plan and the session timer; mastery by topic; a notebook with wiki-links; local-first with no account; bring your own keys; cost of every answer shown; failover to another company; the model using the rooms as tools; sums that never reach a model; search-everything palette; a $1 subscription.

**Where all five are ahead (3 rows, was 6):** a computer or browser agent; two-way voice through a voice model; native phone apps. The agent needs a server that knows who you are, which a local-first app does not have; a voice model is a provider feature a key would buy (the app already talks both ways through the browser's own recognition and speech); the app installs as a web app.

**Closed this round:** deep research is now a planned pass of three to five searches, each its own call, with the findings and their pages handed to the writer (2, was 1); the model can run JavaScript in a sandbox and read what came out — the data work the others send to a Python server, done in the browser (2, was 1); Word out of any page or answer and PowerPoint out of any deck, beside PDF (2, was 1).

**Built from this round:** `/slides` and "make me ten slides on…" build a deck that runs beside the chat (one section a slide, arrow keys, a counter, print to PDF one slide a page), closing a row all five had; and the *Easier reading* switch in Appearance (a plain face, wider letter, word and line spacing) closes the dyslexia row Claude led on.

**Speed, measured (25 September).** Load to a usable box 251 ms with 339 kB of script; Enter to the first words 246 ms of the app's own overhead; Settings 390 ms then 40 ms; the palette 330 then 30; a room 50–450 ms, most of it the transition, now 180 ms. Every room and dialog chunk is warmed at idle. The whole table is SPEC §21. The catalogue of every shipped function, with what each still lacks, is published as the artifact *Every Function of ARMI*.

**Hardened, 26 September.** A review of the round above found two doors the new functions had opened and the probes had not tried. The print window shared the app's origin, so a built or uploaded page's own `<script>` could have read the keys and the notes from storage before the dialog came up; printing now happens from a sandboxed frame in the page (an origin of its own, no pop-up to block). The code sandbox was a worker on the app's origin, so model-written code could reach IndexedDB and, through a dynamic import or EventSource, the network; the worker is now made inside an opaque-origin frame carrying a policy that closes every outbound door, and `e2e-office` runs code that tries each one and counts on the mock that nothing left. Smaller: deep research runs once per question (a regenerate reuses the notes; a follow-up under five words is answered from the thread); a deck is recognised by the exact class token, on the exported page, with notes kept out of the slide body; "write speaker notes for my slides" is prose, not a build. And one row closed: *Save as Excel* on every table in an answer, a workbook written by hand over the zip library Word already uses, figures as numbers, header frozen and filterable, read back by an independent reader in the gate.

**Two more rows closed, 26 September.** *Assistants* — a name, an icon, how it works, which Armi model answers and an opening line, kept together (Settings → Assistants); on the front door as a chip, in the box as `/its-name`, in the palette as "Chat with …"; its instructions go in the system prompt after your rules and before the project's, so a rule still holds inside it. That is the GPTs / Gems / Skills row (2, was 1). And *share by link* without a server: the link carries the whole thread, compressed, after the `#`, which the browser never sends; whoever opens `/share#…` reads it as a page, rendered by the same Markdown renderer as an answer (HTML in a message stays text), and "Continue in Armi" makes it a conversation of their own, dated and titled as it was. That is the share row (2, was 1). Both are in the gate: `e2e-assistants`, `e2e-share`.

**Working together, audited 26 September.** Every prompt of five representative turns was dumped from the wire (a full Astro cast with rules, an assistant, a project and a document; a Study turn; an Auto one-liner and its follow-up; a Nova turn) and read end to end. What the reading found: the brief, the council seats and the check were given the question alone — no project document, no attachment, no earlier turn — so a checker could object to a figure taken from the project's own budget and a "what is known" seat had nothing to know from; council notes were headed "On on the reasoning"; the teaching stance asked for three closing questions while Learn mode asked for one; a "thanks, make it shorter" bought a brief and a second model's check of the shortened answer; the assistant section opened "You are Chem coach" under the line that says you are Armi; and the tools paragraph offered `run_code` beside the compute block without saying which is for what. All six are fixed and held by `e2e-together`, which seeds the project, the document, the assistant and an attachment, runs the full cast and reads on the mock which calls carried the shared page.

**Comfort while waiting, 26 September.** A full cast turn spends its first seconds on a brief and a council before anything streams, and in that stretch the screen said nothing: no stage, no Stop, and the box would take a second question and start a second turn on top. Now the status line names the stage, Stop is there from the first moment and aborts the calls, the box waits, and a stopped turn leaves the question for a retry. Under a finished answer the check is visible while it runs. An answer that lands in a hidden tab renames the tab until it is looked at. Held by `e2e-waiting`, with a mock that can hold one kind of call back for as long as a real one takes.

**The frame, 27 September.** ChatGPT's sidebar carries its own open/close control and, closed on a desk, leaves an icon rail rather than nothing (the mark at the top, which turns into the open-sidebar icon under the pointer; new chat; search; the rooms; the account); its shortcut is ⌘⇧S. That is now the frame here, with ⌘\ kept beside the reference's chord and the bar's toggle left only for the phone's drawer. The box's plus menu now holds what the composers of ChatGPT, Claude and Gemini hold between them — files, a photo, a picture, Learn, web research, deep research, slides, a comparison, a project and an assistant — each with a line saying what it does, and two of them a page deeper: putting the chat in a project (or making one from it, named for it) and choosing who answers. A seeded random walk, `e2e-monkey`, now presses, types, resizes and navigates for ninety seconds looking for the crash nobody wrote a test for, and fails on the step that threw.

**Names.** Astro, Mira, Lumos and Nova stay. A model name has to be one word, ownable, and mean nothing wrong in the languages of the people using it; a borrowed name (a rival's) would be a claim about who trained it, and this app trains nothing.

### Sources for §7

- OpenAI, ChatGPT release notes (help.openai.com/en/articles/6825453); Releasebot, ChatGPT updates September 2026; Suprmind, ChatGPT features 2026.
- Anthropic, Claude release notes (support.claude.com/en/articles/12138966); Releasebot, Claude updates September 2026; Suprmind, Claude features 2026.
- Google, Gemini release updates (gemini.google.com/updates); Suprmind, How Gemini works; MacRumors, Google I/O 2026 roundup.
- Moonshot AI (moonshot.ai); Wikipedia, Kimi (chatbot); mysummit.school, Kimi in 2026.
- xAI: Suprmind, Grok features 2026; AIToolsRecap, How to use Grok in 2026; gstory, Grok limits.

## 7. How the best do bigger tasks, and what Craft takes from it

**The question.** A person asks in a few words for something they picture whole. What do the leading systems do between the words and the answer, and what does the evidence say about doing more before answering?

**What they do.** ChatGPT's unified system puts a real-time router in front of two models and decides, per request, whether to answer fast or "think longer", trained on when people switch models and on measured correctness; the newer Instant models decide it themselves, per question `[R1][R2]`. Gemini's Deep Research writes a research plan first and asks the person to confirm or edit it before it reads anything, then reads dozens of sources against that plan `[R3][R4]`. Manus and the agents that followed it split a planner from an executor, which is what lets a fifteen-to-ninety-minute task keep its shape `[R5]`. Claude Code's own review runs a critic over a plan before execution, and the loops people build on it draft, critique and merge before stopping for approval `[R6]`.

**What the evidence says about doing more.** The generate → critique → refine cycle (evaluator-optimizer, Self-Refine, Reflexion) lifts quality when the criteria are clear, and the cost is real: a two-round loop lands at three to five times the single-shot bill and cannot parallelise, so latency grows faster than cost. The curve is steep then flat: the first round lifts the mean by several points at under two times the cost, the second by a fraction of a point at over three times, the third is usually negative on both axes. And the evaluator matters more than the loop — with an oracle evaluator Reflexion beats self-consistency by a wide margin, with an ordinary model as evaluator it does not `[R7][R8]`.

**What Craft takes from it.** (1) A gate, not a habit: the stage runs only when the task is more than a normal one, decided by a rule that is pure and tested rather than by the model's mood. (2) The plan is a *standard* the person can read — Gemini's plan review, applied to the bar rather than to the search list — and it is set by studying the field, because the makers a person already trusts are the best available definition of "good". (3) Ask once, with examples, only when an open choice would change the whole thing; otherwise decide as a good maker would and say what was decided. (4) One round of judge-and-improve, never two, and the judge from a different company than the writer wherever there are two keys, because the evaluator is the half of the loop that earns its keep. (5) Everything shown: the stage on the status line, the standard as a block on the answer, the judgement on the row — a loop the person cannot see is a bill they cannot account for.

Sources: [R1] [Introducing GPT-5 — OpenAI](https://openai.com/index/introducing-gpt-5/); [R2] [GPT-5.1 — OpenAI](https://openai.com/index/gpt-5-1/); [R3] [Use Deep Research in Gemini Apps — Google](https://support.google.com/gemini/answer/15719111?hl=en); [R4] [How to use Deep Research with the Gemini API — Philipp Schmid](https://www.philschmid.de/deep-research-update); [R5] [Manus AI in 2026 — Future AGI](https://futureagi.com/blog/manus-ai-comparison-2025/); [R6] [Code Review — Claude Code Docs](https://code.claude.com/docs/en/code-review); [R7] [Evaluating LLM Self-Reflection Loops — Future AGI](https://futureagi.com/blog/evaluating-llm-self-reflection-loops-2026/); [R8] [Reasoning in Token Economies: Budget-Aware Evaluation of LLM Reasoning Strategies — arXiv](https://arxiv.org/pdf/2406.06461).

## 8. What a student needs to see to get the most marks — and the Study results card

**The question.** A student opens Study. What should it tell them first, so that the next twenty minutes win the most marks?

**What the field shows.** Seneca, the revision platform most UK secondary schools use, reports to students and teachers in three numbers: a score, a memory figure and completion, per topic `[S1][S2]`. Save My Exams sells exam questions with mark schemes and topic-by-topic progress against the specification `[S3]`. Both lead with a result and a next step, not a history. What ARMI had was a history: a line for the shakiest deck, a line for the weakest topic, a mistakes count, a calendar and a sureness chart, each true and none of them the answer to "how ready am I, and what now?"

**What the evidence says works.** Dunlosky and colleagues rated ten study techniques; only two earned *high utility*: practice testing and distributed (spaced) practice, with interleaving *moderate* `[S4][S5]`. Retrieval and spacing are strongest together, not as alternatives `[S6][S7]`, and a student's own sense of how well they know something is a poor guide, which is why a number built from what they actually recalled beats one they feel `[S8]`.

**What was built from it.** (1) One score, **exam readiness**, computed from the memory model rather than from time spent: every card's chance of being recalled today, with a card never studied counting as nothing, because on the day it is worth nothing. (2) Said in words as well: a band, and the plain sentence *Tested on all of it today, you would likely get about N% right*. (3) Known, shaky and not started on one bar, so the size of each gap is visible. (4) The trend of answers actually got right, against the fortnight before, only once there are enough answers to mean something. (5) **Most marks for your time**: at most three moves, each one press, ranked by marks: practise the weakest topic (retrieval where the loss is largest), redo the mistakes, review what is due (spacing), learn what was never started. The weakest topic is chosen by the same readiness measure as the headline, so the card never contradicts itself. (6) Everything else that was scattered across the room now sits inside that one card.

Sources: [S1] [Seneca — EdTech Impact](https://edtechimpact.com/products/seneca/); [S2] [Studying on Seneca — Seneca help](https://help.senecalearning.com/en/collections/2699118-studying-on-seneca); [S3] [Save My Exams vs Seneca](https://www.savemyexams.com/learning-hub/support/save-my-exams-vs-seneca/); [S4] [Dunlosky et al., Improving Students' Learning With Effective Learning Techniques — Psychological Science in the Public Interest](https://journals.sagepub.com/doi/abs/10.1177/1529100612453266); [S5] [Strengthening the Student Toolbox — American Educator](https://www.aft.org/ae/fall2013/dunlosky); [S6] [Retrieval and spaced practice: study strategies that must be combined — Evidence Based Education](https://evidencebased.education/resource/retrieval-and-spaced-practice-study-strategies-that-must-be-combined/); [S7] [Strategies for making learning last — Eton College CIRL](https://cirl.etoncollege.com/strategies-for-making-learning-last-retrieval-practice-spaced-practice-and-interleaving/); [S8] [Why retrieval practice works — RetrievalPractice.org](https://www.retrievalpractice.org/why-it-works).

## 9. Save My Exams, and building past it

**The question.** The person asked for a Study room that does everything Save My Exams and the others do, better, more comfortably, and better designed.

**What Save My Exams does.** Revision notes written to each board's specification, with worked examples and examiner tips; topic questions ranked easy to hard with mark schemes and model answers; *Smart Mark*, AI marking against the board's scheme, on supported questions only, for Premium; *Target Test*, a test built from chosen topics, difficulty and length; timed mock exams marked with a grade indicator; past papers; flashcards sorted into piles; a *Strengths & Weaknesses* score per topic that needs about ten answered questions before it says anything; and a study planner the student fills in by hand `[E1]–[E6]`. Seneca adds forgetting-curve scheduling and a wrong-answers mode behind Premium `[E7]`; Physics & Maths Tutor gives past-paper questions by topic as static PDFs `[E8]`; Quizlet moved Learn and Test behind Plus `[E9]`; Carousel leaves anything but an exact answer to be self-marked `[E10]`.

**What students complain about.** Paywalls and upsell on the parts that matter (notes limited, AI marking paid); marking limited to the questions a site has prepared; no tutor to ask when a mark is lost; a weakness score that needs ten questions per topic; planners that do not plan; flashcards that are piles rather than a schedule; content errors with nowhere to report them `[E11]–[E13]`.

**What was built from it.** (1) A course from any subject, level and board, its specification written out topic by topic. (2) Questions with no end: any topic, four difficulties, never the last ones again. (3) Marking of every answer, typed or photographed, point by point against the scheme, with the student's own answer rewritten to full marks, so the gap is shown, not scored. (4) A tutor one press after the marking, handed the question, the answer and what was missed. (5) Missed points turned into cards on the existing FSRS schedule. (6) A result from the first answer, not the tenth: likely marks over the whole specification, which counts an untouched topic as nothing, and the next three moves ranked by marks. (7) Mock papers aimed at the weakest topics with no setup, timed and marked by topic. (8) A checklist whose colours come from the marks, not from ticking. (9) *Something wrong? Replace it* on every question. (10) No grade indicator: a grade needs the year's boundaries for that board, subject and tier, which a model does not know reliably, so the result is given in marks.

Sources: [E1] [Smart Mark — Save My Exams](https://www.savemyexams.com/study-tools/smart-mark/); [E2] [Target Test — Save My Exams](https://www.savemyexams.com/study-tools/target-test/); [E3] [Mock Exams — Save My Exams](https://www.savemyexams.com/study-tools/mock-exams/); [E4] [How to use Strengths & Weaknesses — Save My Exams](https://www.savemyexams.com/learning-hub/sme-articles/how-to-use-strengths-and-weaknesses-tool/); [E5] [How to use exam questions — Save My Exams](https://www.savemyexams.com/learning-hub/sme-articles/how-to-use-exam-questions/); [E6] [Study Planner — Save My Exams](https://www.savemyexams.com/study-tools/study-planner/); [E7] [What is Premium — Seneca help](https://help.senecalearning.com/en/articles/2663301-what-is-premium); [E8] [Physics & Maths Tutor resources](https://www.pmt.education/blog/students/physics-and-maths-tutor-resources/); [E9] [Quizlet paywall 2026 — Words on Repeat](https://wordsonrepeat.com/blog/quizlet-paywall-2026-free-alternatives); [E10] [Marking a quiz — Carousel Learning](https://carousel-learning.zendesk.com/hc/en-gb/articles/360018711039-Marking-a-Quiz-ALL-USERS); [E11] [Save My Exams reviews — Trustpilot](https://www.trustpilot.com/review/www.savemyexams.com); [E12] [Seneca reviews — Trustpilot](https://uk.trustpilot.com/review/senecalearning.com); [E13] [Smart Mark for English — The Student Room](https://www.thestudentroom.co.uk/showthread.php?t=7628520). These pages were found by search on 28 September 2026; the network here refused to open them, so the summary above rests on the search results' own text.

## 10. Every study tool, and the rules they are written under

**The question.** The person asked for every tool Save My Exams and the others have — the marker, the paper maker, flashcards, revision notes and the rest — in one Studio for the whole app, for a book dropped into the Notebook to be read and then to ask what to make, for Craft to be universal, and for rules.

**What the field offers.** Save My Exams: revision notes by specification with worked examples and examiner tips; topic questions by difficulty with mark schemes, model answers and quick answers; Smart Mark; Target Test; mock exams and Mock Drop with a grade indicator; past papers; confidence-sorted flashcards; a study planner; strengths and weaknesses; a teachers' Test Builder `[F1]–[F5]`. Google's notebook (NotebookLM, renamed Gemini Notebook in July 2026) turns sources into audio and video overviews, a slide deck, an infographic, a mind map, reports (briefing doc, study guide with an outline, a short quiz with its key, essay questions and a glossary), flashcards and a quiz, each steerable by a line of text `[F6]–[F8]`. Knowt, Quizlet, StudyFetch and Turbo all ask the same few things after an upload — level, goal, how many, difficulty, question types, focus, language — before making notes, cards, tests and podcasts `[F9]–[F11]`. Mark schemes share conventions: one line per mark, "/" and "or" for alternatives, "allow", "ignore" and "do not accept", error carried forward, and for extended answers level descriptors with indicative content `[F12]`.

**The learning sciences the rules come from.** LearnLM's five principles (active learning, managing cognitive load, adapting to the learner, curiosity, metacognition), OpenAI's study mode (scaffolding, knowledge checks, personalisation) and Khanmigo's refusal to hand over answers `[F13]–[F15]`; retrieval, spacing and worked examples as the strategies with the strongest evidence (§8).

**What was built from it.** (1) One registry of nineteen tools, each with a written standard, used both to write the thing and to check it. (2) The reading comes first and the question second: what the material is, the tools that suit it ticked, then level, board, purpose, difficulty, focus, length. (3) Every page written under eight house rules and the student's own, checked by a second model against its standard and the source, rewritten once if short, and saying so at its foot. (4) The papers are sat and marked; the quiz is marked without a model; the marker writes a scheme in the board's conventions when none is given. (5) The same sheet from every room, and a book added to a page asks at once what to make, without spending a call to ask. (6) Craft uses the same standards, so "a mind map of X" in chat is held to the same bar as the Studio's mind map, and never falls back to nothing. (7) Four rule presets for learning, including one that refuses to write coursework to be handed in.

Sources: [F1] [Revision Notes — Save My Exams](https://www.savemyexams.com/study-tools/revision-notes/); [F2] [Smart Mark — Save My Exams](https://www.savemyexams.com/study-tools/smart-mark/); [F3] [Target Test — Save My Exams](https://www.savemyexams.com/study-tools/target-test/); [F4] [Mock Exams — Save My Exams](https://www.savemyexams.com/study-tools/mock-exams/); [F5] [Test Builder — Save My Exams](https://www.savemyexams.com/teacher-tools/test-builder/); [F6] [NotebookLM is now Gemini Notebook — Google](https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/); [F7] [Flashcards, quizzes and reports in NotebookLM — Google Workspace Updates](https://workspaceupdates.googleblog.com/2025/09/flashcards-quizzes-reports-notebook-lm-google-education.html); [F8] [Slide decks in NotebookLM — Google Help](https://support.google.com/notebooklm/answer/16757456?hl=en); [F9] [Knowt](https://knowt.com/); [F10] [Studying with Practice Tests — Quizlet Help](https://help.quizlet.com/hc/en-us/articles/25946589648013-Studying-with-Practice-Tests); [F11] [StudyFetch flashcards](https://www.studyfetch.com/features/flashcards); [F12] [AQA GCSE Physics mark scheme, June 2023](https://filestore.aqa.org.uk/sample-papers-and-mark-schemes/2023/june/AQA-8464P1F-MS-JUN23.PDF); [F13] [LearnLM prompt guide — Google](https://services.google.com/fh/files/misc/learnlm_prompt_guide.pdf); [F14] [Introducing study mode — OpenAI](https://openai.com/index/chatgpt-study-mode/); [F15] [Khanmigo](https://www.khanmigo.ai/learners). Found by search on 28 September 2026; the network here refused to open the pages, so the summary rests on the search results' text.

## 11. One workspace: the notebook, the chat and projects

**The question.** The person asked for the Notebook to be better, more comfortable and more useful, and for it to be joined to the chat and to projects so that the whole app works as one.

**What the field does.** Notion's AI answers from a person's pages across the workspace and its editor is driven by "/" for blocks and actions `[G1][G2]`. Google put NotebookLM's notebooks inside the Gemini app, so the sources a person gathered follow them into chat `[G3]`. ChatGPT and Claude projects keep chats, files and instructions together, and what is in the project is what its chats know `[G4][G5]`. Obsidian is built on links between pages and what links back `[G6]`. Apple Notes records and transcribes audio into a note `[G7]`, and Knowt and others turn a recorded lecture into notes `[G8]`. Mem's pitch is that notes surface in the answer without being fetched `[G9]`. Microsoft's Copilot in OneNote answers from more of the notebook than the page on screen `[G10]`.

**What was missing here.** Pages and chats had no way to find each other: a page could not be put in a project, a chat could not be about a page, an answer could only become a new page, never be added to one, and the chat never read the notebook unless asked to in the Notebook itself. The editor had no "/" menu, "[[" had to be typed out in full, and checklists could not be ticked.

**What was built from it.** (1) A page can be put in a project; the project lists it and every chat there is sent it, as a file would be. (2) *Chat about this page*, which remembers the page, sits in its project and is listed on the page. (3) "@" attaches a page from the chat box. (4) *Add to a page…* on every answer, marked with the chat it came from, with Undo. (5) The notebook in every answer: a page is sent only when a passage shares at least two real words with the question, never on one shared word, fenced as data, at most two pages; the answer says so, and it can be turned off. (6) A "/" menu with blocks and page actions, "[[" completion, checklists that tick where they are read. (7) A lecture recorded into the page as it is heard, and made into notes by the Studio. (8) Related pages by what they say.

Sources: [G1] [Everything you can do with Notion AI — Notion](https://www.notion.com/help/guides/everything-you-can-do-with-notion-ai); [G2] [Notion releases, 24 February 2026](https://www.notion.com/releases/2026-02-24); [G3] [Notebooks in the Gemini app — Google](https://blog.google/innovation-and-ai/products/gemini-app/notebooks-gemini-notebooklm/); [G4] [Projects in ChatGPT — OpenAI Help](https://help.openai.com/en/articles/10169521-projects-in-chatgpt); [G5] [What are projects? — Claude Help](https://support.claude.com/en/articles/9517075-what-are-projects); [G6] [Obsidian 1.9.0 changelog](https://obsidian.md/changelog/2025-05-21-desktop-v1.9.0/); [G7] [Record and transcribe audio on iPhone — Apple Support](https://support.apple.com/guide/iphone/record-and-transcribe-audio-iphbe11247b5/ios); [G8] [AI lecture note taker — Knowt](https://knowt.com/ai-lecture-note-taker); [G9] [Introducing Mem 2.0 — Mem](https://get.mem.ai/blog/introducing-mem-2-0); [G10] [Copilot in OneNote now understands more of your notes — Microsoft](https://techcommunity.microsoft.com/blog/microsoft365copilotblog/copilot-in-onenote-now-understands-more-of-your-notes/4515922). Found by search on 28 September 2026; the summary rests on the search results' text.

## 12. The notebook of sources: Google's notebook, and past it

**The question.** The person asked for the Notebook to be like Google's exactly, and better.

**What Google's notebook does.** Three panels: sources on the left, a chat grounded in them in the middle, the Studio on the right `[H1][H2]`. The chat can be configured — Default, Learning Guide or Custom, and Shorter, Default or Longer answers `[H3][H4]`. The Audio Overview comes in four formats — Deep Dive (two hosts), Brief (one speaker, under two minutes), Critique and Debate — with Shorter, Default and Longer lengths `[H5][H6]`, and in Interactive mode a listener can press Join, ask the hosts a question and hear them answer from the sources before they carry on, in the Deep Dive format only `[H7][H8]`.

**What was built.** (1) A notebook is a page opened as Sources · Chat · Studio, and still a page underneath, one press away; on a phone the three are tabs. (2) Sources come from a file, pasted text, a web page, or one of your own pages — the last is what a notebook kept apart from your notes cannot offer. The web page is read by the server, which refuses this machine, private networks and link-local addresses, and checks each redirect the same way. (3) The guide, a title, a summary and three questions; each source's own guide, whose topics ask the chat. (4) Answers only from the ticked sources, with numbered citations that open the passage in the source — and, unlike a citation taken on trust, each quote checked against the source by this app, a missing one shown as "n?" and said to be so when pressed. (5) The chat's style and length, as Google has them. (6) The Audio Overview in the four formats and three lengths with a focus, read by two of the device's voices, line by line, with the transcript following; Join works in every format, and the exchange is kept. (7) Every Studio tool, including a new FAQ, made from the ticked sources, and everything made listed in the notebook and leading back to it.

**What is honest about the difference.** Google renders the Audio Overview as recorded audio with its own voices; here it is read by the device, so it is only as good as the device's voices, and it cannot be downloaded as sound — the transcript can. Not built yet: discovering sources by web search, YouTube sources, video overviews and slide decks.

Sources: [H1] [NotebookLM gets a new look, audio interactivity and a premium version — Google](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-new-features-december-2024/); [H2] [NotebookLM is now Gemini Notebook — Google](https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/); [H3] [Use chat in Gemini Notebook — Google Help](https://support.google.com/notebooklm/answer/16179559?hl=en); [H4] [Customize the style and length of your notebook responses — Futurepedia](https://www.futurepedia.io/courses/google-notebooklm-complete-course/lessons/customize-the-style-and-length-of-your-notebook-responses); [H5] [Generate Audio Overview in Gemini Notebook — Google Help](https://support.google.com/notebooklm/answer/16212820?hl=en); [H6] [NotebookLM rolling new Audio Overview formats: Brief, Critique & Debate — 9to5Google](https://9to5google.com/2025/09/02/notebooklm-audio-overview-debate/); [H7] [Interactive Audio Overview — XDA](https://www.xda-developers.com/i-regret-ignoring-notebooklm-interactive-audio-overview/); [H8] [Audio Overview interactive mode — Futurepedia](https://www.futurepedia.io/courses/google-notebooklm-complete-course/lessons/audio-overview-interactive-mode). Found by search on 28 September 2026; the summary rests on the search results' text.

## 13. How study material should be written, from what is known about memory and marks

**The question.** The person asked for the tools to be rewritten from research: how an AI should make flashcards, notes, revision material and annotations, how notebooks and projects should be written, and how to teach so that a student at school, at university or anywhere else gets full marks. They also asked for the app to ask for the syllabus, and for files of any size.

**What the evidence says.**
- **Testing beats rereading, and spacing beats massing.** Retrieving something strengthens it more than studying it again, even when the retrieval fails at first `[I1][I2][I3]`. Reviews spread over growing gaps beat the same time massed together, and the best gap grows with how long it must be kept `[I4][I5]`. A pre-question asked before the lesson helps, even when it is answered wrongly `[I6]`. Dunlosky and colleagues rate practice testing and distributed practice as the two techniques with high utility, and highlighting and rereading as low `[I7]`.
- **Mixing topics beats one topic at a time** for problems where the method has to be chosen `[I8][I9]`.
- **For a novice, a worked example first, then faded ones.** Worked examples beat problem-solving for novices. Removing the last steps one at a time moves the student to solving alone without losing that gain `[I10][I11][I12]`. Rosenshine's principles say the same for a class: small steps, practice after each, checks for understanding, and a high success rate `[I13]`.
- **Asking why, and concrete examples.** Explaining each step to oneself improves understanding `[I14]`. Generating an answer beats reading it `[I15]`.
- **Words and a meaningful picture together.** Put the labels on the picture itself, not in a key, and leave out decoration `[I16]`. The "learning styles" idea has no support; words and a picture help everyone `[I17]`.
- **Flashcards.** Wozniak's twenty rules say understand first, keep each card minimal, avoid sets and enumerations, and use cloze deletions `[I18]`. Matuschak's five properties say a good prompt is focused, precise, consistent, tractable and effortful `[I19]`.
- **Marks.** The boards' command words set what an answer must do, for example "state", "describe", "explain", "evaluate" and "calculate". Mark schemes give a mark a creditable point, accept the scheme's key words, carry an early error forward and mark long answers by level descriptors `[I20][I21]`.
- **Deep and surface approaches.** University students who look for the principle underneath learn differently from those who memorise, and the task set shapes which approach they take `[I22]`. Proof and problem-solving follow Pólya's four steps `[I23]`, and a research paper is read in passes `[I24]`. Sleep after study keeps it `[I25]`.

**What was built from it.**
1. **One place for the rules.** `lib/pedagogy.ts` holds the rules, and every writer uses them: the Studio, the courses, the flashcards and the notes.
   - Eleven learning rules for all material.
   - Card rules: one fact per card, no lists, recall rather than recognition, and a card of its own for look-alikes.
   - Exam rules: the command word, the list rule, key words, error carried forward, units and levels of response.
   - Annotation rules:
     - Literature: What, How, Why.
     - Historical sources: Nature, Origin, Purpose.
     - Papers: Claim, Evidence, Method, Limitation.
   - Separate rules for university and for school, read from the level the student gives.
2. **Notes in the order memory works.**
   - Two questions before the topic.
   - The big idea, then small numbered points with the mark-scheme words in bold.
   - A labelled diagram.
   - A worked example, then "your turn", then "why?" prompts.
   - Common mistakes and look-alikes.
   - How the topic is examined.
   - A quick check, then mixed questions with every answer.
3. **An annotating tool** that follows those conventions.
4. **What are you studying for?** Study asks once for:
   - school, university or something else;
   - the level and the board;
   - the subjects and the target.

   The chat then pitches every answer at that. The Studio and new courses start from it.
5. **The syllabus.** A course can be built from the student's own specification document, with its units, codes and wording. The part of the document about a topic is sent with that topic's notes and questions, fenced as data.
6. **No size limit on files.**
   - PDFs are read page by page, with the page count shown.
   - Text files are read no further than 4 million characters. The student is told when there was more, so a 200 MB file is never pulled whole into memory.
   - Storage is checked before a big file is kept.

**What is honest about it.** The rules shape what a model writes; they cannot guarantee it. Every page is still checked against its standard (§10). Scanned PDFs with no text layer are still not read, because there is no OCR yet.

Sources:
- [I1] Roediger & Karpicke (2006), "Test-enhanced learning", *Psychological Science* 17(3), doi:10.1111/j.1467-9280.2006.01693.x
- [I2] Karpicke & Blunt (2011), "Retrieval practice produces more learning than elaborative studying with concept mapping", *Science* 331, doi:10.1126/science.1199327
- [I3] Kornell, Hays & Bjork (2009), "Unsuccessful retrieval attempts enhance subsequent learning", *JEP: LMC* 35(4)
- [I4] Cepeda et al. (2006), "Distributed practice in verbal recall tasks", *Psychological Bulletin* 132(3), doi:10.1037/0033-2909.132.3.354
- [I5] Cepeda et al. (2008), "Spacing effects in learning: a temporal ridgeline of optimal retention", *Psychological Science* 19(11)
- [I6] Richland, Kornell & Kao (2009), "The pretesting effect", *JEP: Applied* 15(3)
- [I7] Dunlosky et al. (2013), "Improving students' learning with effective learning techniques", *Psychological Science in the Public Interest* 14(1), doi:10.1177/1529100612453266
- [I8] Rohrer & Taylor (2007), "The shuffling of mathematics problems improves learning", *Instructional Science* 35
- [I9] Kornell & Bjork (2008), "Learning concepts and categories: is spacing the 'enemy of induction'?", *Psychological Science* 19(6)
- [I10] Sweller, cognitive load theory, as summarised in [Cognitive load theory: research that teachers really need to understand — NSW CESE (2017)](https://education.nsw.gov.au/about-us/education-data-and-research/cese/publications/literature-reviews/cognitive-load-theory)
- [I11] Renkl & Atkinson (2003), "Structuring the transition from example study to problem solving", *Educational Psychologist* 38(1)
- [I12] Atkinson, Derry, Renkl & Wortham (2000), "Learning from examples", *Review of Educational Research* 70(2)
- [I13] [Rosenshine (2012), "Principles of Instruction", *American Educator*](https://www.aft.org/sites/default/files/Rosenshine.pdf)
- [I14] Chi et al. (1994), "Eliciting self-explanations improves understanding", *Cognitive Science* 18(3)
- [I15] Slamecka & Graf (1978), "The generation effect", *JEP: HLM* 4(6)
- [I16] Mayer, *Multimedia Learning* (Cambridge University Press)
- [I17] Pashler, McDaniel, Rohrer & Bjork (2008), "Learning styles: concepts and evidence", *Psychological Science in the Public Interest* 9(3)
- [I18] [Wozniak, "Effective learning: twenty rules of formulating knowledge" — SuperMemo](https://www.supermemo.com/en/blog/twenty-rules-of-formulating-knowledge)
- [I19] [Matuschak, "How to write good prompts"](https://andymatuschak.org/prompts/)
- [I20] The command-word lists of AQA, OCR and Cambridge International, and [AQA GCSE Physics mark scheme, June 2023](https://filestore.aqa.org.uk/sample-papers-and-mark-schemes/2023/june/AQA-8464P1F-MS-JUN23.PDF)
- [I21] OCR's guidance on the assessment objectives, and Pearson's guide to using historical sources
- [I22] Marton & Säljö (1976), "On qualitative differences in learning", *British Journal of Educational Psychology* 46; Biggs & Collis, the SOLO taxonomy
- [I23] Pólya, *How to Solve It* (1945)
- [I24] [Keshav, "How to read a paper", *ACM SIGCOMM CCR* (2007)](http://ccr.sigcomm.org/online/files/p83-keshav.pdf)
- [I25] Walker & Stickgold (2004), "Sleep-dependent learning and memory consolidation", *Neuron* 44; Weinstein, Madan & Sumeracki (2018), "Teaching the science of learning", *Cognitive Research: Principles and Implications* 3

These were gathered by search on 29 September 2026. The papers are cited from their published records; the web pages could not be opened from here.

## 14. Why millions would use it — what the evidence says, and what was built from it

Gathered by search on 3 October 2026. Three questions: what people actually do with an AI assistant when they study; what they now expect of one; and what makes them come back.

**What students do with it.** The surveys agree on the same short list: explaining a concept, summarising a text, testing themselves before an exam, planning revision, checking writing, and brainstorming — with 24/7 availability and time saved as the reasons given [M1][M2][M3]. Use is no longer marginal: in the UK the share of students using generative AI for assessed work went from 53% to 88% in a year [M4], and a third of college-age adults in the US use ChatGPT [M5]. The implication for Armi: the first five things it must do perfectly are explain, summarise, quiz, plan and check — which is the Studio's first row and the chat's follow-up chips — and it must be reachable in two taps on a phone at midnight.

**What they expect now: memory, visible.** Persistent memory went from a differentiator to table stakes in a year; every serious assistant has it, and one survey of professionals put the saving at about 47 minutes a day once memory was set up [M6][M7]. The same research names the risks: memory makes an assistant likelier to tell you what you want to hear, and the UX problems of 2026 are management, transparency, privacy and control — users want to see what is held, take things out, and keep projects apart [M8][M9]. Armi already holds memory locally and lets it be edited; what was missing was *seeing* it from where you decide what to tell it. Built: the count and a door to memory on the Personalization page; a first-run card that asks the two things worth knowing (a name, a level) once and never as a modal.

**What brings people back.** Duolingo's numbers are the clearest public evidence on habit: learners with a 7-day streak retain at 2.4× the rate of those without one, and separating the streak from the daily goal raised 7-day streaks by over 40% [M10][M11]. The mechanism is loss aversion plus a visible tracker plus a small celebration [M12]. Armi keeps a streak but said it in one place (the study calendar). Built: the streak on the blank page's waiting line, the weakest topic named beside it, and a short celebration — paper falling, the streak kept — at the end of a session, drawn only when something was answered and never for a person who asked for less motion.

**What makes an app feel like theirs.** A choice of colour is the cheapest form of ownership an interface can offer, and every flagship app now has one. Built: six accents, each measured before it was written so the text accent clears 4.5:1 on the page in both themes and on the warm paper, and nothing but the accent moves when it changes.

- [M1] [The use of ChatGPT in academia: perspectives of higher education students — Cogent Education (2025)](https://www.tandfonline.com/doi/full/10.1080/2331186X.2025.2508216)
- [M2] [Is ChatGPT massively used by students nowadays? — arXiv 2412.17486](https://arxiv.org/html/2412.17486v1)
- [M3] [Students around the world find ChatGPT useful, but also express concerns — EurekAlert](https://www.eurekalert.org/news-releases/1072031)
- [M4] [Student Generative AI Survey 2025 — HEPI](https://www.hepi.ac.uk/reports/student-generative-ai-survey-2025/)
- [M5] [One-third of college-age young adults use ChatGPT — BestColleges](https://www.bestcolleges.com/news/students-embrace-chatgpt/)
- [M6] [AI memory in 2026: how to set up a persistent AI assistant — AI Magicx](https://www.aimagicx.com/blog/ai-memory-persistent-assistant-setup-guide-2026)
- [M7] [9 best AI assistants that remember your preferences in 2026 — MemoryLake](https://www.memorylake.ai/en/blogs/best-ai-assistants-that-remember-your-preferences)
- [M8] [Memory and personalization make AI more likely to tell you what you want to hear — The Register (June 2026)](https://www.theregister.com/ai-and-ml/2026/06/11/memory-and-personalization-make-ai-more-likely-to-tell-you-what-you-want-to-hear/5253850)
- [M9] [Why "AI memory" is becoming the next big UX challenge — Fintechasia (August 2026)](https://fintechasia.net/2026/08/20/why-ai-memory-is-becoming-the-next-big-ux-challenge-according-to-2026-research/)
- [M10] [Duolingo's customer retention strategy — Propel](https://www.trypropel.ai/resources/blogs/duolingo-customer-retention-strategy)
- [M11] [Duolingo — streak system detailed breakdown — Medium](https://medium.com/@salamprem49/duolingo-streak-system-detailed-breakdown-design-flow-886f591c953f)
- [M12] [The psychology behind Duolingo's streak feature — Just Another PM](https://www.justanotherpm.com/blog/the-psychology-behind-duolingos-streak-feature)

## 15. Every kind of ask, and the learning engines — what the evidence says, and what was built from it

Gathered by search on 3 October 2026. Two questions: what people actually ask an assistant for, kind by kind, and what each kind needs that the general voice does not give it; and which findings from the learning sciences an AI tutor can act on in a single reply rather than in a curriculum. The numbers marked (search) come from search summaries of the papers; the pages themselves could not all be opened from here.

**The kinds of ask.** Read across the lists people publish of what they use an assistant for — the thirty-category list this round was given, the usage surveys in §14 — and the same shapes recur under different headings: a thing to understand, a thing to make, a choice, a thing that is broken, a body, the law, ideas, a sum. The app already shaped answers for ten of these (§7, `lib/task.ts`). Six were landing in *general* and failing in a specific way each: a choice answered with a balanced survey and no verdict (the decision handed back to the person who could not make it — the same failure measured in §7 at 84% against 21%); a broken thing answered with a lecture instead of the cheapest check; a symptom answered with either a diagnosis or a refusal; a law stated as if one jurisdiction were the world; a brainstorm of four safe ideas; a sum given as a number with no working. Built: six kinds — `decide`, `fix`, `health`, `legal`, `brainstorm`, `math` — each with its own evidence in the classifier, its own shape in the prompt (`lib/shape.ts`) and its own checks for the second model (`CHECKS`), and a worked problem now earns the longer thinking pass with code, data and research.

**Testing beats rereading, and students do not believe it.** Dunlosky and colleagues rated ten study techniques and gave *practice testing* and *distributed practice* high utility, *rereading* and *highlighting* low [L1]. Tested students outscored restudiers a week later by about 61% to 40% (search) [L2]. Kornell & Bjork's learners did better with spaced, interleaved study and still rated massed study as more effective [L8] — which is why an app cannot leave the method to the student's judgement. Built: the chat's learning shape ends on something to recall, not a summary; the study rules say so (`LEARNING_RULES` 4).

**Spacing and interleaving.** 839 assessments across 317 experiments: the best gap grows with how long the memory has to last [L3]. In a randomised trial across 54 Grade-7 classes, interleaved maths practice scored 61% against 38% on an unannounced test (search) [L4]. Bjork's name for the family is *desirable difficulties*: slower now, retained longer [L5]. Built earlier (FSRS, mixed practice); kept.

**Self-explanation and the Feynman label.** Chi's eighth-graders prompted to explain each line to themselves learned more than those who read twice, and the high explainers reached the correct model of the circulatory system [L6]. The "Feynman technique" has no primary source — it is a 2011 label for the same act [L13] — so the app cites the research and keeps the plain instruction. Built: the learning shape asks, once something hard has landed, for it to be explained back, and listens for the skipped step.

**Confidence is not knowledge.** The least skilled overestimate themselves most and lack the means to notice [L7]; judging what you know while the answer is in front of you produces false confidence [L7b]. Built: before an answer they could attempt is shown, the tutor asks for theirs and how sure they are; confident-and-wrong is named and gets one more of the same kind (`LEARNING_RULES` 13, the learning shape); the `note_mistake` tool writes every wrong answer into the Study room's attempts, with the misconception named and whether they were sure, so the weakest topic and targeted practice see what the chat saw.

**Feedback: where, not whether.** Feedback's average effect is large and its variance larger — about d = 0.79 in the 2007 review [L9], d = 0.48 across 435 studies in the 2020 revisit, with the type of feedback deciding most of the difference (search) [L9b]. Feedback at the level of the task and the process ("you divided before subtracting") beats feedback about the self. Built: the learning shape says exactly where and what the mistake is called before the correction.

**The step before.** Cognitive-load theory's finding is that a novice solving problems by search uses the working memory that learning the schema needs [L10]; worked examples first, then faded, then alone. And the trouble with a later topic is usually an earlier one. Built: `LEARNING_RULES` 12 and the learning shape check the prerequisite with one question before explaining the thing asked about.

**Misconceptions are theories, not gaps.** The Force Concept Inventory showed students holding Newtonian misconceptions their instructors assumed were gone [L14]; interactive courses doubled the normalised gain of traditional ones (0.48 against 0.23, 6,500 students) [L14b]; Chi's account is that the wrong model keeps running wherever the right fact is not consciously recalled [L14c]. Built earlier (the learning shape names the wrong version and what it mispredicts); kept.

**Command words.** The boards publish them: AQA [L15], OCR [L16], Cambridge [L17] — *describe* is what happens with no why, *explain* is reasons, *evaluate* is both sides and a judgement. Built earlier in `EXAM_RULES`; the `note_mistake` tool now records "describe where explain was asked" as a named slip.

**What the big three ship.** ChatGPT's study mode (29 July 2025) uses guiding questions and step-by-step work instead of answers [L18]; Gemini's Guided Learning (6 August 2025) runs on LearnLM, asks open questions, breaks problems into steps and adds quizzes [L19]; Claude's learning mode (2 April 2025) asks Socratic questions and names the underlying principle [L20]. None of the three checks the prerequisite first, asks for confidence before revealing, or writes the mistake into a spaced-repetition store — the three things this round built.

**Growth mindset, with its caveat.** Two meta-analyses put the average effect of mindset interventions near zero [L12]; the large national trial found a benefit only for lower achievers and only where peer norms supported it [L12b]. Built: nothing — the app does not tell students that effort alone will do it.

**The look of 2026.** The AI video studios set the register: near-black grounds (#0F1113, graphite #2B2F33), one acid accent (lime #D1FE17 / #CCFF00, aqua #49FFE9), ink on colour rather than white on colour, and soft fields of the accent that breathe behind one line of type [H1][H2]. Built: two accents, *Lime* and *Aqua*, measured like the six before them (text ≥ 4.5, ink on fill ≥ 4.5, fill edge ≥ 3 in both themes — which is why in the light theme the acid becomes the olive it darkens to and stays acid in the dark); an aura behind the home greeting; a press on every chip.

- [L1] [Dunlosky, Rawson, Marsh, Nathan & Willingham (2013), "Improving Students' Learning With Effective Learning Techniques", *Psychological Science in the Public Interest* 14(1)](https://pubmed.ncbi.nlm.nih.gov/26173288/)
- [L2] [Roediger & Karpicke (2006), "Test-Enhanced Learning", *Psychological Science* 17](https://gwern.net/doc/psychology/spaced-repetition/2006-roediger.pdf)
- [L3] [Cepeda, Pashler, Vul, Wixted & Rohrer (2006), "Distributed Practice in Verbal Recall Tasks", *Psychological Bulletin* 132](https://www.escholarship.org/content/qt3rr6q10c/qt3rr6q10c.pdf)
- [L4] [Rohrer, Dedrick, Hartwig & Cheung (2020), randomised trial of interleaved mathematics practice — IES](https://ies.ed.gov/use-work/awards/efficacy-study-interleaved-mathematics-practice); [Rohrer & Taylor (2007), *Instructional Science* 35](https://link.springer.com/article/10.1007/s11251-007-9015-8)
- [L5] [Bjork & Bjork (2011), "Making Things Hard on Yourself, But in a Good Way"](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-introducing-desirable-difficulties-into-practice-and-instruction-bjork-and-bjork.pdf)
- [L6] [Chi, de Leeuw, Chiu & LaVancher (1994), "Eliciting Self-Explanations Improves Understanding", *Cognitive Science* 18](https://onlinelibrary.wiley.com/doi/10.1207/s15516709cog1803_3)
- [L7] [Kruger & Dunning (1999), "Unskilled and Unaware of It", *JPSP* 77](https://www.semanticscholar.org/paper/f2c80eef3585e0569e93ace0b9770cf76c8ebabc); [L7b] [Koriat & Bjork (2005), "Illusions of Competence", *JEP: LMC* 31](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/07/Koriat_RBjork_2005.pdf)
- [L8] [Kornell & Bjork (2008), "Is Spacing the 'Enemy of Induction'?", *Psychological Science* 19](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/07/Kornell_Bjork_2008_PsychScience.pdf)
- [L9] [Hattie & Timperley (2007), "The Power of Feedback", *Review of Educational Research* 77](https://doi.org/10.3102/003465430298487); [L9b] [Wisniewski, Zierer & Hattie (2020), "The Power of Feedback Revisited", *Frontiers in Psychology*](https://doi.org/10.3389/fpsyg.2019.03087)
- [L10] [Sweller (1988), "Cognitive Load During Problem Solving", *Cognitive Science* 12](https://onlinelibrary.wiley.com/doi/10.1207/s15516709cog1202_4)
- [L11] [Agarwal (2019), "Retrieval Practice & Bloom's Taxonomy", *J. Educational Psychology* 111](https://eric.ed.gov/?id=EJ1205208); [Agarwal, Nunes & Blunt (2021), systematic review of classroom retrieval practice](https://link.springer.com/article/10.1007/s10648-021-09595-9)
- [L12] [Sisk et al. (2018), two meta-analyses of growth mindset, *Psychological Science* 29](https://www.researchgate.net/publication/323565554); [L12b] [Yeager et al. (2019), national study of a growth-mindset intervention, *Nature* 573](https://www.nature.com/articles/s41586-019-1466-y)
- [L13] [The Feynman learning technique — Farnam Street](https://fs.blog/feynman-learning-technique/); [University of York study guide](https://subjectguides.york.ac.uk/study-revision/feynman-technique)
- [L14] [Hestenes, Wells & Swackhamer (1992), "Force Concept Inventory", *The Physics Teacher* 30](https://pubs.aip.org/aapt/pte/article/30/3/141/270140/Force-concept-inventory); [L14b] [Hake (1998), *American Journal of Physics* 66 — summary](https://serc.carleton.edu/resources/1310.html); [L14c] [Chi & Brem (2009), categorical shift](https://education.asu.edu/sites/g/files/litvpz656/files/lcl/chi_brem_categorical_shift_theory_2009_2.pdf)
- [L15] [AQA command words](https://filestore.aqa.org.uk/resources/pe/AQA-8582-COMMANDWORDS.PDF)
- [L16] [OCR command words](https://www.ocr.org.uk/images/539424-command-words.pdf)
- [L17] [Cambridge International, "Understanding command words"](https://www.cambridgeinternational.org/exam-administration/what-to-expect-on-exams-day/command-words/)
- [L18] [OpenAI, "Introducing study mode" (29 July 2025)](https://openai.com/index/chatgpt-study-mode/)
- [L19] [Google, "Guided Learning in Gemini" (6 August 2025)](https://blog.google/products-and-platforms/products/education/guided-learning/)
- [L20] [Anthropic, "Introducing Claude for Education" (2 April 2025)](https://www.anthropic.com/news/introducing-claude-for-education)
- [H1] [Higgsfield on Brandfetch — logo colours](https://brandfetch.com/higgsfield.ai)
- [H2] [Higgsfield, brand-system post (X, November 2025)](https://x.com/higgsfield_ai/status/1991584216459665519)
