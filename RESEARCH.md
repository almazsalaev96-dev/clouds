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
