# Interface Craft for a Learning-First AI Chat: What "Every Pixel Better" Means in Practice

*Research lens: interface craft. Prepared September 2026 for the education-AI product bible. Method: 28 web searches + ~30 primary pages (W3C WCAG source, Apple HIG, Material 3 token docs, IBM Carbon, Tailwind v4, Radix Colors, Anki manual, FSRS docs, KaTeX/MathJax, Emil Kowalski's animation standards, Vercel/Raycast token dumps, press coverage of ChatGPT/Claude/Gemini/Perplexity/NotebookLM 2025–26). Items marked "(prior knowledge, unverified)" could not be fetched because the network proxy blocked those domains; treat them as hypotheses to confirm.*

---

## 0. Executive summary

1. **Calm beats clever.** The 2025–26 redesigns that were praised (Linear's "design reset", Gemini's larger type and rounded composer) reduced visual noise and increased hierarchy; the ones criticised (ChatGPT's flat, recency-ordered sidebar; Gemini's pulsing gradient background) added motion or clutter without a task benefit. [48][64][65]
2. **Learning modes are now table stakes, but all three incumbents hide them in a dropdown.** ChatGPT "Study and learn" is a Tools-menu toggle / `/study`; Claude "Learning" is a style-dropdown option (Aug 2025); Gemini "Guided Learning" likewise. None changes the *layout* of the workspace — that is the open lane. [3][4][5][6]
3. **Citations that jump to the exact passage are the trust surface.** NotebookLM's numbered inline citations open the source pane at the passage; Perplexity's numbered chips show a hover card with domain, title and excerpt plus a source strip. 2025–26 HCI studies find *inline* source presentation changes attention and verification behaviour compared with a trailing source list. [8][9][10][11][12][14]
4. **Typography numbers converge:** body 16–18 px on web (Butterick: 15–25 px; Readwise Reader default 20 px; iOS Body 17 pt), line-height 1.4–1.6 (Butterick 120–145 %; Reader default 1.4; Tailwind base 1.5), measure 45–90 characters (Butterick), WCAG text-spacing must survive 1.5× line-height / 0.12 em letter-spacing / 0.16 em word-spacing / 2× paragraph spacing. [47][56][66][46][33]
5. **Motion has consensus numbers:** UI transitions < 300 ms; button feedback 100–160 ms; tooltips 125–200 ms; dropdowns 150–250 ms; modals/drawers 200–500 ms; never `ease-in` on UI; stagger 30–80 ms; exits ~20 % faster than entrances; no animation on actions performed 100+ times a day. Material 3 durations: 50–1000 ms in 50 ms steps; Carbon: 70/110/150/240/400/700 ms. [16][17][18][43][71]
6. **Springs are the 2025 default for gestures, not for chat.** Material 3 Expressive (May 2025) ships spatial springs (damping 0.9, stiffness 300/700/1400) and effects springs (damping 1.0, stiffness 800/1600/3800); Emil Kowalski recommends `{duration: 0.5, bounce: 0.1–0.3}` and bounce only for drag-to-dismiss. [41][42][43][17]
7. **Reduced motion is not "no motion".** Apple: replace transitions with fades, tighten springs, avoid ~0.2 Hz oscillation; Kowalski: keep opacity/colour, drop position changes. [55][57][17]
8. **WCAG 2.2 AA is the floor and it has numbers:** 24×24 CSS px targets (2.5.8), focus indicator ≥ 2 px perimeter at 3:1 (2.4.13), focus never fully hidden by sticky bars (2.4.11), every drag has a tap alternative (2.5.7), reflow at 320 px / 400 % zoom (1.4.10), 4.5:1 text contrast (1.4.3). [29][30][31][32][34][35]
9. **Apple's control minimums are stricter than WCAG on touch:** 44×44 pt hit area convention, 28×28 pt minimum control on iOS, 12–24 pt padding between controls, text ≥ 11 pt, allow 200 % text enlargement. [57][56]
10. **Dark mode = grey, not black, with a surface ladder.** Material: dark grey (not pure black) to keep shadows visible and reduce eye strain for light text; Raycast's ladder is #07080a → #0d0d0d → #101111 → #121212; Apple provides base + elevated background sets. [44][60][58]
11. **Colour systems: OKLCH + a 12-step semantic scale.** Tailwind v4 palettes are OKLCH (`neutral-900 = oklch(21% 0.034 264.665)`); Radix's 12 steps map 1–2 backgrounds, 3–5 component fills, 6–8 borders, 9–10 solids, 11–12 text with steps 11/12 guaranteed Lc 60/Lc 90 APCA on step 2. [46][72]
12. **Elevation: borders first, stacked soft shadows second.** Vercel uses a 1 px inset hairline (`0 0 0 1px #00000014`) plus 2–3 stacked shadows at 4–12 % black; Raycast uses no drop shadows at all. Never a single heavy drop. [59][60]
13. **Math rendering: KaTeX for speed and SSR determinism, MathJax for accessibility.** KaTeX renders synchronously with no reflow and identical output server-side; MathJax 3/4 closed the speed gap and ships speech generation + an expression explorer for screen readers. A learning product needs both properties (see §6). [20][21][22]
14. **Math input is a solved component problem.** Khan's `math-input` (multi-page swipeable keypads, draggable detached cursor handle) and MathLive (`<math-field>`, virtual keyboard, LaTeX/MathML/MathJSON export, math-to-speech) are open source. Photomath's camera flow is: frame → drag-resize crop corner → shoot → step list. [73][74][62]
15. **Flashcards: two buttons are better than four.** Anki users press Good 80–95 % of the time; FSRS is "a little more accurate" for people who use only Again/Good; pressing Hard for a lapse corrupts scheduling. Default retention 0.90; keyboard 1–4 / Space. [51][53][52]
16. **Mastery should be levelled, not percentaged.** Khan Academy: Attempted → Familiar (70–85 %) → Proficient (100 % on an exercise) → Mastered (holds on a later challenge); 50/80/100 points; levels can drop. Khan is currently reworking this in its "reimagined" experience. [50]
17. **Streaks have a 2025 backlash.** "You made Duo sad" push copy, streak-driven "terror", and a publicised 1,200-day-streak quit are now standard case studies of shame-based design; loss aversion works short-term and corrodes trust long-term. [37][38][39][40]
18. **Skeletons beat spinners for content, not for actions.** Studies report ~30 % lower perceived wait with skeletons versus spinners; spinners remain fine for < 1 s confirmations. [67]
19. **TTFT is the latency users feel.** < 100 ms feels instant, < 1 s keeps flow, ~10 s is the attention limit; streaming turns a wait into visible progress; provider TTFT varies 3–5× for the same model class, so the UI must be designed for a 0.3–3 s first token. [63]
20. **Sidebars fail when they are flat, recency-only lists.** ChatGPT's 2025–26 sidebar changes (Projects now expand inline; no folders) generated third-party "fix the sidebar" extensions; Linear's redesign explicitly increased navigation hierarchy and density. [65][48]
21. **Command palette + dense rows is how power learners move.** Raycast: 36 px inputs, 6 px row radius, 8 px base grid, keycaps 20 px, no shadows; Kowalski: never animate the palette. [60][17]
22. **Iconography:** a single outline family at 24 px / 2 px stroke (Lucide-style) or Phosphor at matched weight; never mix families in one surface (prior knowledge; Lucide guide page blocked). [—]
23. **Cyrillic is a first-class requirement, not a fallback.** Inter has tabular numerals, slashed zero and contextual alternates and is the de facto UI font for Cyrillic-quality interfaces; Atkinson Hyperlegible Next (2025) now covers 150+ languages in 7 weights, giving a dyslexia/low-vision toggle that still renders Russian/Kazakh. [77][24][25]
24. **Anti-patterns to ban in the bible:** shame streaks, notification spam, flat chat lists, low-contrast grey text (< 4.5:1), modal abuse, exclamation-mark sycophancy, emoji as bullets, walls of bullets, confetti on trivial events, pulsing backgrounds while "thinking". [38][39][64][35]
25. **The differentiating layout is a three-pane learning workspace** (Library ▸ Chat/Study ▸ Source/Scratchpad) that collapses to one pane on mobile with a bottom sheet for the source — nobody in the consumer chat category ships this as the default for study. (Synthesis; see §17.)

---

## 1. Layout and sidebar architecture

### 1.1 What incumbents do (2025–26)

| Product | Left rail | Centre | Right / secondary | Notes |
|---|---|---|---|---|
| ChatGPT | Flat, recency-ordered chat list; Projects (folders) expand *inline* in sidebar since mid-2026; GPTs/pinned items moved | Single column chat, max-width column | Canvas opens as split pane | Users describe the sidebar as "sucks now"; forum threads ask for fixed project expansion and adjustable width [65] |
| Claude.ai | Chats + Projects; "Learning" is a **style dropdown** option (Aug 2025) [3][4] | Chat column | Artifacts side panel (code/doc preview) — (prior knowledge, unverified) | Learning mode is Socratic behaviour, not a layout change |
| Gemini (2026 redesign) | Account/settings moved into sidebar; model picker under sidebar chevron | Larger greeting, no suggestion chips, larger text, rounded input bar | "+" overlay consolidates uploads, Drive, image gen, Canvas | Reviewers criticised the pulsing gradient background while thinking [64] |
| Perplexity | Library/Spaces | Answer with source strip above, numbered chips inline | Sources panel | Citation UI is the signature [8][9][10] |
| NotebookLM | Sources pane (left) | Chat (centre) | Studio (right): audio overview, notes, guides | Click a citation → source pane scrolls to exact passage [14][15] |
| Linear (reference) | Dense, hierarchical sidebar; 2024 redesign "reduced visual noise, maintained alignment, increased hierarchy and density of navigation" [48] | List/board | Side panel for details | Gold standard for calm density |

### 1.2 Lessons
- **Hierarchy over recency.** A study product has natural hierarchy: Subject ▸ Topic/Unit ▸ Session. Use it. A recency list is only acceptable as a secondary "Recent" group.
- **Three panes with two collapse points.** Desktop ≥ 1280 px: three panes. 900–1279 px: two panes (library becomes an overlay). < 900 px: one pane + bottom sheet.
- **Resizable, remembered widths.** ChatGPT users explicitly request adjustable sidebar width [65]; Linear ships it.
- **Don't reflow the whole page when a side panel opens.** NotebookLM/Claude both slide a panel in and *narrow* the chat measure; keep the chat's max measure ≤ 75 ch after narrowing so text does not become a wall.

---

## 2. Composer design

**Observed patterns**
- ChatGPT (July 2025 redesign): a "Tools" dropdown in the composer — Study and learn, Deep research, Agent, Create image, etc.; `/study` slash command also toggles the mode [5][6][7].
- Gemini 2026: "+" button merges attachments and tools; rounded pill input; prominent mic [64].
- Claude: style dropdown (Normal / Concise / Explanatory / Formal / **Learning**) next to model picker [3][4].
- Photomath: camera with a drag-resizable crop rectangle (hold bottom-right corner), shoot, then step-by-step [62].
- Khan Academy `math-input`: multiple keypad configurations (fractions/mixed numbers vs algebra), multi-page swipeable keypads, touch-and-drag like the stock OS keyboard, **draggable cursor with a detached handle** for touch precision [73].
- MathLive: `<math-field>` web component, mobile virtual keyboard, physical shortcuts, exports LaTeX/MathML/ASCIIMath/Typst/MathJSON, math-to-speech + ARIA [74].

**Numbers to copy**
- Composer height at rest 52–56 px (one line), grows to max 8 lines then scrolls; padding 12 px 16 px; radius 16–20 px (Gemini/ChatGPT pill style) or 12 px if you want a calmer, less "bubbly" look.
- Attach ("+") and Mode chips left; Mic and Send right; Send is the only filled button on screen.
- Mode is a **persistent chip inside the composer** ("Tutor", "Exam", "Explain", "Quiz me"), not a hidden dropdown — this is the visible difference from incumbents.
- Math keyboard: a fourth composer state (`Aa` / `∑` / `📷` / `🎤`) that swaps the OS keyboard for a 5×4 keypad; landscape tablets show a 10×4 keypad; ship a LaTeX preview line above the keypad, rendered live with KaTeX.
- Photo of homework: camera opens full-screen with a crop rectangle defaulting to 70 % width × 25 % height in the centre; corner handles 44 pt; "Retake / Use" bottom bar within the thumb zone; on capture show the recognised LaTeX for confirmation before sending (Photomath's "scan and edit" step) [62].

---

## 3. Streaming, thinking, and typing indicators

- **TTFT is the perceived latency**; < 100 ms instant, 100 ms–1 s noticeable but flow-preserving, ~10 s attention limit; streaming makes users feel like participants rather than observers [63].
- Provider TTFT for the same model class varies 3–5× [63]; with four providers behind one product, the UI must be designed for first tokens anywhere from 300 ms to 3 s.
- Gemini's pulsing gradient background during processing was called out negatively [64]; Kowalski's rule: no animation on the 100-times-a-day path [17]. A chat send is a 100-times-a-day path.

**Rules**
1. On Send: message appears instantly (optimistic), composer clears, scroll pins to bottom, a 3-dot indicator appears at the assistant slot *within 50 ms*.
2. If first token > 800 ms, swap the dots for a one-line status ("Reading the mark scheme…") — text, not a spinner.
3. Stream at a smoothed cadence: buffer tokens and paint every animation frame; if provider bursts, pace paint to ≤ 90 characters per 16 ms frame so lines don't jump.
4. Render Markdown, math and code **progressively but stably**: never re-layout previous paragraphs; hold an unclosed `$$` or ``` block as a skeleton until closed.
5. Stop button replaces Send during streaming, same position, same size (Fitts's law; prior knowledge).
6. Never auto-scroll if the user has scrolled up more than 120 px; show a "↓ New" pill instead.
7. Show "thinking" as a collapsed, monotone, non-animated row ("Thought for 6 s ▸"), not a live scrolling stream by default.

---

## 4. Message density and readability

- Butterick's four core rules: body point size 15–25 px on the web; line spacing 120–145 % of point size; line length 45–90 characters including spaces; and use a professional font [47].
- Readwise Reader defaults: 20 px, line spacing 1.4, adjustable line width; range 14–80 px with shortcuts [66].
- Apple iOS Body 17 pt / 22 pt leading; Callout 16/21; Subhead 15/20; Footnote 13/18; Caption 12/16 and 11/13; minimum 11 pt; avoid Ultralight/Thin/Light [56].
- Tailwind v4 defaults: `base 1rem/1.5`, `lg 1.125rem/1.56`, `sm 0.875rem/1.43` [46].
- Vercel: body-md 16/24, body-lg 18/28, body-sm 14/20, code 13/20 [59]. Raycast: body 16/1.6 [60].

**Our defaults**
| Context | Size | Line-height | Max measure |
|---|---|---|---|
| Chat body (desktop) | 17 px | 1.55 (≈26 px) | 68 ch (~720 px at 17 px Inter) |
| Chat body (mobile) | 17 px | 1.5 | full width, 16 px gutters |
| Reading/Textbook pane | 18 px | 1.6 | 66 ch |
| Reader "Focus" setting | 20 px | 1.6 | 60 ch |
| UI labels | 14 px | 1.43 | — |
| Captions/metadata | 12–13 px | 1.33–1.4 | — |
| Code | 13–14 px mono | 1.5–1.6 | scroll-x container |

Paragraph spacing 0.75 em (≈ 12–13 px) between paragraphs in chat, 1 em in reading pane; no indent. Lists: 4 px between items, marker inset 1.25 em. Headings inside assistant messages capped at h3 size (20 px / 600) — an assistant reply is not a landing page.

**Message layout:** no bubbles for the assistant (full-measure text on the canvas); user messages in a subtle tinted block (step-3 fill from the neutral scale, radius 16 px, max 80 % width, right-aligned on mobile, left-aligned in a narrower column on desktop). Per-message actions (copy, retry, "explain simpler", "quiz me on this") appear on hover/focus at 12 px icons with 24 px targets, always visible on touch as a single overflow "⋯".

---

## 5. Typography choices and dyslexia options

- **Inter**: variable 100–900, contextual alternates, slashed zero, tabular numbers; Display subfamily/optical size in development [77]. Strong Cyrillic in practice (prior knowledge, unverified — verify Kazakh Ә, Ғ, Қ, Ң, Ө, Ұ, Ү, Һ, І rendering).
- **Geist** (Vercel): weights 400/500/600 used, negative tracking at display sizes (-2.4 px at 48 px) is "part of the voice"; mono for technical labels only [59]. Cyrillic coverage: unverified.
- **Atkinson Hyperlegible Next** (Braille Institute, 2025): 7 weights (2 → 7), 150+ languages (27 → 150+), variable, plus a Mono; SIL OFL [24][25]. Designed for low vision; b/d remain mirror images so it is not a dyslexia cure [26].
- **Lexend**: claims of "instantaneous" fluency improvement are not cited in the repo README; treat as marketing [27].
- **OpenDyslexic**: widely requested; the ACM TOCHI study (Wallace et al., 2022) found *individual* font effects on reading speed, supporting a per-user font choice rather than one "dyslexia font" [28].
- WCAG 1.4.12 text spacing (AA): content must survive line-height 1.5×, paragraph 2×, letter 0.12 em, word 0.16 em [33].

**Ship**: font family switcher (System / Inter / Atkinson Hyperlegible Next / OpenDyslexic / Serif for long reading), size stepper 14–24 px, line-height 1.4/1.55/1.7, letter-spacing 0 / +0.05 em / +0.12 em, measure narrow/medium/wide, and a one-tap "Reading comfort" preset that sets 18 px / 1.7 / +0.05 em / 60 ch / warm background. All chat, reader and flashcard surfaces honour it.

---

## 6. Math rendering

| | KaTeX | MathJax 3/4 |
|---|---|---|
| Speed | Synchronous, no reflow; the historical reason to choose it [21] | v3 rewrite "closed the gap"; some tests show MathJax 3 faster in scenarios; KaTeX still wins on font loading and bundle size [20] |
| SSR | Same output in Node and browser — pre-render to HTML [21] | Possible but heavier |
| Coverage | Missing `\label`/`\eqref` and some packages [20] | Broader LaTeX, mhchem etc. |
| Accessibility | Emits MathML alongside HTML (htmlAndMathml) — (prior knowledge) | Built-in speech generation and an **expression explorer**, Nemeth braille via SRE [22] |

**Decision**: KaTeX for streaming/inline rendering (speed and stability while tokens arrive), with `output: htmlAndMathml`, and a "Read aloud / explore" action that lazily loads MathJax's SRE for speech and step-through exploration on demand. Every rendered formula: right-click/long-press → "Copy as LaTeX", "Copy as MathML", "Copy as plain text". Display math gets 16 px vertical margin and horizontal scroll inside a container; inline math is baseline-aligned and never wraps mid-fraction. Chemistry needs `mhchem`. Number formats must follow locale (decimal comma for ru-RU/kk-KZ) without breaking LaTeX.

---

## 7. Code blocks and tables

- Vercel: code 13 px / 20 px on #171717 with 24 px padding [59]. Raycast: mono for "this is a tool" signals only [60].
- Code block: header row 32 px with language label (12 px mono, muted) and Copy button (24 px target, appears on hover, always on touch); line numbers optional; horizontal scroll, never wrap by default; syntax theme with ≥ 4.5:1 for all token colours in both themes.
- Tables in chat: full-width of the measure, 12 px cell padding, 1 px hairline rows, sticky header when > 8 rows, horizontal scroll container (WCAG reflow exception covers data tables [34]). Numeric columns right-aligned with tabular numerals (`font-variant-numeric: tabular-nums`, available in Inter [77]).
- Mark-scheme tables (AO1/AO2/AO3 columns, marks) are a first-class component, not generic Markdown tables.

---

## 8. Citations, footnotes and the source viewer

**Perplexity pattern** [8][9][10]: numbered chips at the end of the claim; hover card = favicon/domain, title, excerpt; carousel when multiple sources support one claim; horizontal source strip of cards above the answer; expandable full source list.
**NotebookLM pattern** [14][15]: numbered inline citation → click → left pane opens the source at the exact passage, highlighted; "Source guide" summary at top of each source.
**Research** (2025–26 arXiv, abstracts via search): source-presentation design affects attention, interaction and persuasion; inline placement drives more verification than trailing lists [11][12].

**Our spec**
- Chip: 18 px tall, 11 px semibold tabular numeral, radius 6 px, step-3 fill, step-11 text; sits in the text flow after the sentence, before the full stop's following space; 24 px invisible hit area.
- Hover/focus card within 120 ms: book/paper title, chapter/page, 2–3-line excerpt with the cited span bold, "Open in source" link.
- Click: right pane opens the **exact page of the PDF** with the span highlighted (yellow at 30 % alpha in light, 40 % in dark), page number in the pane header, previous/next citation arrows.
- "Show me where in the book" is a standing action on every assistant paragraph.
- Examiner-report quotes render as a distinct blockquote style with the exam series/year badge.

---

## 9. Side-by-side source viewer, highlight-to-ask, scratchpad

- Right pane width 420–560 px (resizable), min 360 px; chat measure shrinks but never below 56 ch.
- PDF page rendered at device pixel ratio; text layer selectable; selection popover (appears 150 ms after mouseup, above the selection, arrow centred) with **Ask · Explain · Define · Save as card · Quote in chat**. Long-press on touch.
- Scratchpad/whiteboard: a second tab in the right pane; pen, highlighter, eraser, text, math tile (opens the math keyboard); infinite canvas with 8 px dot grid; Apple Pencil / stylus low-latency path; "Send to chat" screenshots the selection. (Freeform/Apple Notes math conventions: prior knowledge, unverified.)
- Diagrams: Mermaid renders natively (20+ diagram types, themeable) [75]; function graphs via an embedded graphing component with Desmos-style keyboard access and **audio trace** (pitch ↔ y, static for negative y, overtone for positive x, pop at intersections) [68].

---

## 10. Canvas, artifacts and long outputs

- Anything longer than ~40 lines (an essay plan, a model answer, a revision sheet) should open as an **artifact tab** in the right pane, with the chat holding a compact card (title, 2-line summary, "Open"). This is Claude's artifacts pattern generalised (prior knowledge, unverified).
- Artifact toolbar: version stepper, Copy, Export (PDF/DOCX/Markdown/Anki .apkg), Print. Print CSS: 11 pt serif or Inter, 1.4 line-height, 2 cm margins, page numbers, math via KaTeX SSR so it prints crisply [21].

---

## 11. Flashcard review UI

Facts from the Anki manual and FSRS docs:
- Buttons Again(1) / Hard(2) / Good(3, Space, Enter) / Easy(4); each button shows the next interval; Good is pressed 80–95 % of the time; Again 5–20 %; a simplified Again/Good workflow is explicitly supported [51].
- FSRS: default desired retention 90 %; range 0.70–0.99; "Hard" must never be used for a lapse; FSRS is "a little more accurate" for users who mostly use Again/Good [53][52].
- Add-ons like Pass/Fail exist precisely to remove four-button decision paralysis [54].

**Our spec**
- Default two buttons: **Again** (left, neutral-destructive tint) and **Got it** (right, primary) each 50 % width × 56 px in the thumb zone; optional "Hard/Easy" revealed by a setting. Keyboard 1/3/Space.
- Card face: centre-aligned, 20 px body, math via KaTeX, image max 60 % height; flip on tap/Space with a 200 ms `ease-out` 3D flip or a 150 ms crossfade under reduced motion.
- Show next interval in 12 px muted text under each button (Anki convention) but let the user hide it.
- Session header: progress bar (thin 3 px, step-9 colour), "12 of 30", and an exit that autosaves.
- End of session: a **calm summary** (cards reviewed, retention estimate, next review date), no confetti.

---

## 12. Progress and mastery visualisation

- Khan Academy levels: Not started → Attempted → Familiar (70–85 %) → Proficient (100 % on exercise/quiz/test) → Mastered (holds on a later mastery challenge); 50/80/100 mastery points; course mastery % = share of skills at Proficient or Mastered; levels can go down [50]. Khan notes Course Mastery is temporarily absent from its "reimagined" experience [50].
- Brilliant: a branching path showing "exactly where you are and what comes next", XP counters, tangram-style loaders; streaks and leagues exist but are layered, not primary [69].
- Duolingo: streak-first, "You made Duo sad" push copy; 2025 backlash and streak-quit posts [38][40]; "streak creep" analysis of loss aversion backfiring [39].

**Our spec**
- Mastery is shown per syllabus point as a 4-state pip (empty / quarter / three-quarter / full ring) with a semantic colour scale, never a raw percentage alone. Colour + shape (Apple: never colour alone) [58].
- Course view: syllabus tree with pips; an "Exam readiness" ring per paper that decays without evidence (transparent about *why*: "no practice on 3.2 since 12 days").
- Heatmap of study days done well: 12 px cells, 3 px gap, 5 tone steps of one hue, weekday labels, tooltip with minutes and topics; no "current streak" number larger than 14 px; never red for missed days.
- Streaks, if any, are **weekly goals** with two free "rest days" and no loss animation.

---

## 13. Planner and calendar

- Week strip at top (7 × 44 pt cells), today ring, exam dates as pinned chips with a countdown in tabular numerals.
- Sessions are 25/45-minute blocks; drag to move on desktop, but every drag has a tap alternative (WCAG 2.5.7 AA) [32].
- Plan changes propose, never silently rewrite; a "Why this plan" disclosure links to mastery data.

---

## 14. Command palette and keyboard shortcuts

- Raycast tokens: input 36 px, primary button 36 px, row radius 6 px, spacing 2/4/8/12/16/24/32 px, keycap 20 px with 4 px radius, no shadows, surface ladder for depth, Inter with `ss03` [60].
- Kowalski: never animate command palette open/close or keyboard-initiated actions [17][18].
- Our palette: `⌘K` / `Ctrl K`; verbs first ("Quiz me on…", "Open past paper…", "Explain simpler"); recent + fuzzy; `⌘/` shortcut sheet; `⌘J` toggle source pane; `⌘⇧M` math keyboard; `Esc` always closes the topmost layer; focus returns to the composer.

---

## 15. Empty states, onboarding, settings

- Gemini removed suggestion chips for a larger greeting [64]; ChatGPT keeps 3–4 chips. For a study product the empty state should be **work, not greeting**: "Continue: Business 9609 · 3.2 Motivation" card, "Due: 18 cards", "Next exam in 41 days", plus one composer hint.
- Onboarding ≤ 3 screens: curriculum → subjects/level → exam date. No account wall before the first question (Gemini/ChatGPT allow anonymous starts).
- Settings: single scrolling page with a sticky section nav (Appearance · Reading comfort · Tutor behaviour · Notifications · Data & privacy · Shortcuts); every toggle has a one-line consequence; live preview for typography.

---

## 16. Notifications and reminders, ethically

Evidence: Duolingo's guilt-based reminders are the canonical counter-example [38][39][40]. Apple/NN/g emphasise user control (prior knowledge).

Rules: opt-in only, set during planning ("Remind me Tue/Thu 18:00"); one notification per day max; copy is factual ("18 cards due · 6 min"), never emotional; a "Mute until after exams" one-tap; digest email weekly at most; never notify about streak loss.

---

## 17. Motion and micro-interaction principles (with numbers)

| Source | Durations | Easing |
|---|---|---|
| Kowalski STANDARDS [17] | press 100–160; tooltip 125–200; dropdown 150–250; modal/drawer 200–500; all UI < 300; stagger 30–80; reduced-motion fade 200 | `--ease-out: cubic-bezier(.23,1,.32,1)`; `--ease-in-out: cubic-bezier(.77,0,.175,1)`; `--ease-drawer: cubic-bezier(.32,.72,0,1)`; spring `{duration:.5,bounce:.2}` |
| Vercel open-agents skill [18] | micro 100–150; standard 150–250; modal 200–300; exits ~20 % faster | quint-out `.23,1,.32,1`; expo-out `.19,1,.22,1` |
| Material 3 [43] | short 50/100/150/200; medium 250/300/350/400; long 450–600; extra-long 700–1000 | standard `.2,0,0,1`; decelerate `0,0,0,1`; accelerate `.3,0,1,1`; emphasized-decelerate `.05,.7,.1,1`; emphasized-accelerate `.3,0,.8,.15`; springs damping .9/1.0, stiffness 300–3800 |
| IBM Carbon [71] | fast 70/110; moderate 150/240; slow 400/700 | productive standard `.2,0,.38,.9`; entrance `0,0,.38,.9`; exit `.2,0,1,.9`; expressive `.4,.14,.3,1` |
| Tailwind v4 [46] | — | in `.4,0,1,1`; out `0,0,.2,1`; in-out `.4,0,.2,1` |
| Apple HIG [55][57] | — | avoid ~0.2 Hz oscillation; under Reduce Motion tighten springs, replace transitions with fades, avoid z-axis changes |

Principles: animate only `transform`/`opacity` (and `clip-path`); never `scale(0)`, start at 0.95–0.97; popovers scale from the trigger via `transform-origin`; elements that move together share one duration and easing; `:active` scale 0.97; hover effects only under `@media (hover:hover) and (pointer:fine)`; frequency tiers (100+/day → none, tens → near-imperceptible, occasional → standard, rare → delight) [16][17][18].

---

## 18. Skeletons, errors, offline

- Skeletons reduce perceived wait ~30 % versus spinners and improve ease-of-navigation ratings (Mejtoft et al., 2018; industry replications) [67]. Use skeletons for lists, PDF pages, flashcard decks; spinners only for < 1 s confirmations.
- Skeleton shapes must match final layout (spatial priming) — same heights, same radii; shimmer at 1.6 s linear loop, disabled under reduced motion.
- Errors: inline, in place of the failed message, with the cause in plain language and one primary action ("Retry with a different model"), one secondary ("Copy my message"). Never a modal for a recoverable error.
- Offline: banner 32 px at top, queue sends, flashcards fully reviewable offline (local FSRS), textbooks downloaded per unit.

---

## 19. Dark mode, colour, spacing, radii, elevation, icons

- Dark: Material — dark grey, not black, so shadows remain visible and light text strains less; higher elevation = lighter surface via overlays [44]. Apple — separate base and elevated background sets; supply light/dark *and* increased-contrast variants [58]. Raycast ladder #07080a/#0d0d0d/#101111/#121212 with hairline #242728 and text #f4f4f6 / #cdcdcd / #9c9c9d / #6a6b6c [60].
- Colour: Tailwind v4 is OKLCH (`neutral-50 oklch(98.5% 0 none)`, `neutral-900 oklch(21% .034 264.665)`, `blue-500 oklch(62.3% .214 259.815)`) [46]; Radix 12-step semantics with APCA guarantees on text steps [72]; shadcn's semantic roles (background/foreground/card/popover/primary/secondary/muted/accent/destructive/border/input/ring/sidebar) are the industry-default token *names* (prior knowledge; docs page blocked).
- Spacing: 4 px base (Vercel 4…192 [59]; Tailwind `--spacing: .25rem` [46]; Raycast 8 px rhythm [60]).
- Radii: Tailwind sm 4 / md 6 / lg 8 / xl 12 / 2xl 16 / 3xl 24 / 4xl 32 px [46]; Vercel 6 px base UI, 8–12 cards, 100 px pills [59]; Raycast 6 px rows, 8 px buttons [60].
- Elevation: Vercel Level 1 = `0 0 0 1px #00000014` inset; Level 2 = `0 1px 1px #00000005, 0 2px 2px #0000000a` + inset; Level 5 (modals) = `0 1px 1px #00000005, 0 8px 16px -4px #0000000a, 0 24px 32px -8px #0000000f` + inset [59].
- Icons: one outline family; 24 px grid, 2 px stroke, 16/20 px optical variants for dense rows (Lucide conventions — prior knowledge, guide page blocked); icon colour = text colour of the row.

---

## 20. Accessibility (WCAG 2.2 AA + Apple)

| Requirement | Value | Source |
|---|---|---|
| Text contrast | 4.5:1; large text 3:1 | [35] |
| Target size (2.5.8, AA) | ≥ 24×24 CSS px or 24 px spacing circle; inline text links exempt | [30] |
| Focus appearance (2.4.13) | ≥ area of a 2 px perimeter; 3:1 change; **note: W3C published 2.4.13 at AAA in the final Rec while the Understanding draft says AA — treat as required anyway** | [29][36] |
| Focus not obscured (2.4.11, AA) | focused item never fully hidden by sticky header/footer/composer; use `scroll-padding` | [31] |
| Dragging (2.5.7, AA) | tap alternative for every drag | [32] |
| Text spacing (1.4.12, AA) | survive 1.5× line-height, 2× paragraph, .12 em letter, .16 em word | [33] |
| Reflow (1.4.10, AA) | 320 px width / 400 % zoom; data tables may scroll | [34] |
| Apple controls | 44×44 pt convention; 28×28 pt minimum; 12–24 pt gaps; text ≥ 11 pt; 200 % Dynamic Type; Increase Contrast variants; colour never alone | [57][58] |
| Math a11y | MathML output + speech/explorer (MathJax SRE); Desmos-style audio trace for graphs | [22][68] |

Focus ring spec: 2 px solid step-8 accent + 2 px offset (`outline-offset: 2px`), visible on all themes; `:focus-visible` only. Screen-reader: assistant messages as `role="article"` inside a `role="log"` with `aria-live="polite"` on completion (not per token). Reduced motion respected everywhere; reduce-transparency removes backdrop blur.

---

## 21. Mobile-first specifics

- One pane; top bar 44 pt; composer docked above the home indicator with safe-area insets; the Send/Mic/Camera cluster in the bottom-right thumb zone; primary flashcard buttons full-width bottom.
- Bottom sheets (source viewer, math keyboard, mode picker) with detents at 50 % and 92 %, drag handle 36×5 px, `--ease-drawer` 320 ms, and a tap-to-close scrim (drag alternative per 2.5.7 [32]).
- Haptics: light impact on card flip and correct answer; none on errors of the *tutor* (do not punish); selection tick on keypad keys.
- Gesture conflicts: horizontal swipe on cards only inside the card area; PDF pinch-zoom disables sheet drag while zoomed.
- Camera and Pencil: capture at ≥ 1080 p, auto-straighten, show recognised LaTeX before sending.

---

## 22. i18n, RTL, Cyrillic

- Every string externalised; date/number via `Intl`; decimal comma locales must not break math input (accept both, normalise to LaTeX).
- Cyrillic: prefer Inter (tabular numerals, contextual alternates, slashed zero) [77]; verify Kazakh/Uzbek/Kyrgyz extension glyphs; Atkinson Next as the accessibility alternative covers 150+ languages [24]. Serif reading font must have true Cyrillic italics (prior knowledge, unverified: e.g., Literata, PT Serif).
- RTL (Arabic/Hebrew curricula later): logical CSS properties only (`margin-inline-start`), mirrored chevrons, un-mirrored math and code.

---

## 23. Anti-patterns (ban list)

1. Shame or guilt notifications ("You made Duo sad") [38][40]. 2. Streak-loss animations and daily-streak counters as the hero metric [39]. 3. Flat recency-only sidebars with no hierarchy [65]. 4. Grey text under 4.5:1 [35]. 5. Modals for recoverable errors or confirmations that could be inline/undo. 6. Sycophantic openers ("Great question!") and exclamation marks in tutor voice. 7. Emoji as bullets or section markers. 8. Walls of bullet points where a two-sentence explanation would do. 9. Confetti/celebration for routine events; reserve one calm celebration for genuine milestones (exam readiness reached). 10. Animated/pulsing backgrounds while waiting [64]. 11. `ease-in` on UI, `scale(0)` entrances, bounce on standard UI [17][18]. 12. Hidden learning mode in a dropdown as the only affordance [3][5]. 13. Four-button grading by default [51][53]. 14. Pure-black dark mode with saturated accents [44]. 15. Colour-only status (green/red pips without shape) [58]. 16. Auto-scroll that yanks the reader while streaming. 17. Percent-only mastery numbers that imply false precision [50].

---

## 24. Deliverable (a): 16 design principles

1. **Calm by default, expressive by exception** — motion, colour and celebration budgets are spent on rare, meaningful moments (Kowalski frequency tiers; Apple "brevity and precision") [17][55].
2. **The source is one click away, always** — every claim about a syllabus, mark scheme or textbook carries a citation that opens the exact page (NotebookLM/Perplexity) [10][14].
3. **Reading is the primary activity; design for a 60–75 ch measure at 17–18 px** (Butterick, Reader defaults) [47][66].
4. **Mode is visible** — the tutor/exam/explain state lives as a chip in the composer, not in a dropdown [5][3].
5. **Two-button grading, four-state mastery** — reduce decision cost (Anki data), and never show false precision [51][50].
6. **Hierarchy over recency** — Subject ▸ Unit ▸ Session; recents are secondary (Linear reset vs ChatGPT sidebar) [48][65].
7. **Instant acknowledgement, honest waiting** — optimistic UI within 50 ms, status text after 800 ms, no decorative loaders [63][67].
8. **Stability while streaming** — text never jumps; unclosed math/code blocks are skeletons until closed.
9. **Borders first, shadows second** — hairline-defined surfaces, stacked soft shadows only for floating layers [59][60].
10. **Grey dark mode with a surface ladder** — never pure black; elevation = lighter surface [44][60].
11. **Accessibility numbers are design tokens** — 24 px targets, 2 px/3:1 focus, 1.5 line-height survival, 320 px reflow [29][30][33][34].
12. **Keyboard-complete, palette-first for power users; thumb-complete for phones** [60][57].
13. **Respect the learner's attention** — one notification a day max, opt-in, factual copy; no guilt [38][39].
14. **Math is native** — LaTeX in, KaTeX out, copy-as-LaTeX, math-to-speech, keypad and camera as first-class inputs [21][22][73][74].
15. **Progress is evidence-based and reversible** — Khan-style decay with an explanation, never a punishment [50].
16. **Every surface honours the same reading preferences** — font, size, spacing set once, applied to chat, reader, cards, print [33][66].

---

## 25. Deliverable (b): token starter

```css
/* Type (Inter, opsz where available; fallback system-ui) */
--font-sans: "Inter", "Atkinson Hyperlegible Next", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--font-serif: "Literata", "PT Serif", Georgia, serif;          /* reading pane option */
--font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, monospace;
--text-xs: 12px/1.35;  --text-sm: 13px/1.4;  --text-ui: 14px/1.43;
--text-body: 17px/1.55; --text-read: 18px/1.6; --text-lg: 20px/1.4;
--text-h3: 20px/1.3; --text-h2: 24px/1.25; --text-h1: 30px/1.2; --text-display: 36px/1.1;
--tracking-display: -0.02em; --tracking-body: 0; --tracking-caps: 0.06em;
--measure-chat: 68ch; --measure-read: 66ch; --measure-focus: 60ch;

/* Spacing (4 px base) */
--space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 20px;
--space-6: 24px; --space-8: 32px; --space-10: 40px; --space-12: 48px; --space-16: 64px;

/* Radii */
--radius-xs: 4px; --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px; --radius-2xl: 20px; --radius-pill: 9999px;

/* Colour roles (OKLCH; 12-step neutral + 12-step accent, Radix semantics) */
--bg-app:        oklch(98.5% 0.004 90);   /* step 1 light */
--bg-subtle:     oklch(97% 0.004 90);     /* step 2 */
--bg-el:         oklch(94.5% 0.004 90);   /* step 3 component fill */
--bg-el-hover:   oklch(92% 0.004 90);     /* step 4 */
--bg-el-active:  oklch(89% 0.005 90);     /* step 5 */
--border-subtle: oklch(88% 0.005 90);     /* step 6 */
--border:        oklch(83% 0.006 90);     /* step 7 */
--border-strong: oklch(74% 0.008 90);     /* step 8 (focus) */
--text-muted:    oklch(48% 0.01 90);      /* step 11, >= Lc 60 on step 2 */
--text:          oklch(20% 0.012 90);     /* step 12, >= Lc 90 */
--accent:        oklch(55% 0.16 250);     /* step 9 solid, white text */
--accent-hover:  oklch(50% 0.16 250);
--accent-subtle: oklch(95% 0.03 250);
--success: oklch(60% 0.14 150); --warning: oklch(75% 0.15 80); --danger: oklch(58% 0.19 25);
--highlight-source: oklch(90% 0.14 95 / 0.35);

/* Dark (grey ladder, not black) */
[data-theme=dark] {
  --bg-app: oklch(16% 0.006 260); --bg-subtle: oklch(19% 0.006 260); --bg-el: oklch(23% 0.007 260);
  --bg-el-hover: oklch(26% 0.007 260); --bg-el-active: oklch(29% 0.008 260);
  --border-subtle: oklch(27% 0.008 260); --border: oklch(32% 0.009 260); --border-strong: oklch(42% 0.01 260);
  --text-muted: oklch(70% 0.01 260); --text: oklch(94% 0.005 260);
  --accent: oklch(72% 0.13 250); /* desaturated, lighter */
  --highlight-source: oklch(85% 0.14 95 / 0.40);
}

/* Elevation (border-first) */
--ring-hairline: 0 0 0 1px oklch(0% 0 0 / 0.08);
--shadow-1: var(--ring-hairline);
--shadow-2: 0 1px 1px oklch(0% 0 0 / .02), 0 2px 2px oklch(0% 0 0 / .04), var(--ring-hairline);
--shadow-3: 0 2px 2px oklch(0% 0 0 / .04), 0 8px 16px -4px oklch(0% 0 0 / .04), var(--ring-hairline);
--shadow-4: 0 1px 1px oklch(0% 0 0 / .02), 0 8px 16px -4px oklch(0% 0 0 / .04), 0 24px 32px -8px oklch(0% 0 0 / .06), var(--ring-hairline);

/* Motion */
--dur-press: 120ms; --dur-tooltip: 150ms; --dur-fast: 180ms; --dur-base: 220ms; --dur-drawer: 320ms; --dur-page: 260ms;
--ease-out: cubic-bezier(.23, 1, .32, 1);
--ease-in-out: cubic-bezier(.77, 0, .175, 1);
--ease-drawer: cubic-bezier(.32, .72, 0, 1);
--ease-standard: cubic-bezier(.2, 0, 0, 1);       /* M3 */
--spring-gesture: spring(0.5s, bounce 0.15);      /* framer: {type:"spring",duration:.5,bounce:.15} */
--stagger: 40ms;
@media (prefers-reduced-motion: reduce) { :root { --dur-base: 160ms; } /* opacity/colour only; no translate/scale */ }

/* Sizes */
--target-min: 24px; --touch-min: 44px; --control-h: 36px; --control-h-lg: 44px; --row-h: 32px; --composer-min: 56px;
--sidebar-w: 280px; --sidebar-min: 240px; --sidebar-max: 360px; --panel-w: 480px; --panel-min: 360px;
--focus-ring: 0 0 0 2px var(--bg-app), 0 0 0 4px var(--border-strong);
```

Sources for the numbers: [46][59][60][72][17][43][71][30][29][57].

---

## 26. Deliverable (c): component inventory (learning-first chat)

**Shell**: AppShell (3-pane grid), Sidebar (tree: Subject ▸ Unit ▸ Session; Recents; Due today), TopBar (breadcrumb, mode chip, model chip, ⌘K), RightPanel (tabs: Source · Scratchpad · Artifact · Cards), BottomSheet (mobile), CommandPalette, ShortcutSheet, Toast (bottom-left desktop / top mobile, 4 s, undo), Banner (offline/limits).
**Conversation**: MessageList (virtualised), UserMessage, AssistantMessage (Markdown, KaTeX, code, tables, citations), ThinkingRow (collapsed), StreamCursor, ScrollToLatestPill, MessageActions (copy/retry/simpler/quiz/cite), FollowUpChips (max 3), CitationChip + CitationCard, SourceQuote (examiner report), MarkSchemeTable, ModelAnswerCard (opens artifact), ErrorInline.
**Composer**: Composer (auto-grow), ModeChip (Tutor/Exam/Explain/Quiz), AttachMenu (+), MathKeyboard (5×4 / 10×4, live LaTeX preview), CameraCapture (crop + recognise + confirm), VoiceInput (waveform, push-to-talk and toggle), SlashMenu, SendStopButton, TokenBudgetHint (quiet).
**Learning**: FlashcardReview (two-button default), CardEditor (front/back/cloze/math), DeckList, MasteryPip (4-state), SyllabusTree, ExamReadinessRing, StudyHeatmap, PlannerWeek, SessionTimer (25/45), PracticeQuestion (exam-style with marks), MarkingRubric (AO bands), Hint ladder (3 levels), WorkedStepper (reveal steps), GraphView (audio trace), Whiteboard (pen/highlighter/math tile), QuizRunner.
**Reader**: PdfViewer (page-accurate, text layer, highlight), SelectionPopover (Ask/Explain/Define/Save card/Quote), TextbookOutline, ReadingPrefs (font/size/leading/spacing/measure/theme), PrintExport.
**System**: Skeletons (list/message/page/card), EmptyState (Continue/Due/Next exam), Onboarding (3 steps), SettingsPage, NotificationPrefs, ThemeSwitch (light/dark/system + contrast+), A11yPrefs (reduce motion/transparency, dyslexia preset), LocaleSwitch.

---

## 27. Deliverable (d): the learning-workspace layout

**Desktop (≥ 1280 px)** — CSS grid `280px 1fr 480px` (sidebar resizable 240–360; panel 360–640; both remembered per user). Top bar 48 px. Sidebar: 8 px padding, 32 px rows, 14 px labels, section headers 12 px caps at 0.06 em tracking, tree indent 16 px, active row step-3 fill with 6 px radius. Centre: chat column centred with max measure 68 ch (≈ 720 px), 24 px gutters, composer sticky at bottom with 16 px margin and a 24 px fade above. Right panel: tab strip 40 px, PDF page at 100 % width with 16 px padding, citation nav in header. When the panel is closed, chat stays at 68 ch (does not widen to fill). Between 1280 and 1600 px the panel shrinks first; above 1600 px surplus goes to margins.

**Tablet (900–1279 px)** — two panes: chat + right panel (`1fr 420px`); sidebar becomes an overlay drawer from the left (320 ms `--ease-drawer`, scrim 40 %). In portrait (< 1024 px) the right panel becomes a 50 %-height bottom sheet with a 92 % detent; the math keyboard docks under the composer in landscape.

**Mobile (< 900 px)** — one pane. Top bar 44 pt (back/title/⋯). Message list full-width, 16 px gutters. Composer docked with safe-area bottom padding; camera + mic + send in the right 40 % of the width. Source viewer, mode picker, math keyboard and card editor are bottom sheets. Flashcards are a full-screen route with two 56 px buttons in the bottom 20 % of the screen. Sidebar is a full-screen route ("Library"), reached by the back arrow, not a hamburger drawer.

---

## 28. Deliverable (e): pixel-by-pixel quality bar (reviewer checklist)

**Type & text**
- [ ] Chat body 17 px/1.55, reader 18 px/1.6; no measure wider than 75 ch anywhere.
- [ ] No text under 12 px; captions ≥ 12 px and ≥ 4.5:1.
- [ ] Headings inside replies ≤ 20 px/600; no h1 inside a chat message.
- [ ] Tabular numerals in tables, timers, countdowns; slashed zero in code.
- [ ] Cyrillic and Kazakh sample paragraph renders in the same family (no fallback glyphs).
- [ ] Layout survives WCAG text-spacing bookmarklet (1.5/2/.12/.16) and 200 % font size without clipping.
**Colour & contrast**
- [ ] Every text/background pair ≥ 4.5:1 (3:1 large); focus ring 3:1 against adjacent colours.
- [ ] Dark theme: no `#000` surfaces; four-step ladder visible; accents desaturated.
- [ ] Status never conveyed by colour alone (pips have fill shape, chips have icons).
**Layout & spacing**
- [ ] All spacing on the 4 px grid; sidebar rows 32 px; controls 36 px; touch targets ≥ 44 pt on mobile, ≥ 24 px everywhere.
- [ ] Panels resizable, widths persisted; chat measure does not exceed 68 ch when panel closes.
- [ ] Sticky composer never hides a focused element (`scroll-padding-bottom` ≥ composer height).
- [ ] 320 px viewport: no horizontal page scroll; only tables/code/PDF scroll internally.
**Motion**
- [ ] No UI transition > 300 ms except drawers (≤ 320) and page routes (≤ 260).
- [ ] No `ease-in`, no `scale(0)`, no bounce outside drag-to-dismiss.
- [ ] Send, palette, keyboard actions: zero animation.
- [ ] `prefers-reduced-motion`: no translate/scale, fades ≤ 160 ms; skeleton shimmer off.
**Streaming**
- [ ] Optimistic user message < 50 ms; indicator < 50 ms; status text if TTFT > 800 ms.
- [ ] Prior paragraphs never shift during streaming; unclosed math/code held as skeleton.
- [ ] Auto-scroll stops after 120 px user scroll; "↓ New" pill appears.
**Math & sources**
- [ ] Inline math baseline-aligned; display math scrolls, never overflows.
- [ ] Right-click/long-press on any formula offers Copy LaTeX / MathML / text.
- [ ] Every citation chip opens the exact PDF page with highlighted span within 400 ms (cached).
- [ ] Mark-scheme tables use the dedicated component with AO columns.
**Learning surfaces**
- [ ] Flashcards default to two buttons, next-interval hint visible, keyboard 1/3/Space.
- [ ] Mastery pips have 4 states and a "why" tooltip; no bare percentages.
- [ ] No streak-loss copy, no shame notifications, ≤ 1 notification/day.
**Accessibility**
- [ ] Full keyboard traversal with visible focus; Esc closes topmost layer and restores focus.
- [ ] Screen reader announces completed assistant message once; math readable via MathML/speech.
- [ ] Every drag (planner, sliders, sheets) has a tap alternative.
**Polish**
- [ ] Icons single family, consistent stroke, optically centred in 24 px boxes.
- [ ] Borders 1 px hairlines; shadows stacked and ≤ 12 % alpha; no single heavy drop.
- [ ] Empty states show work to continue, not a greeting; no emoji in system copy.

---

## Implications for our product (testable rules and features)

1. Ship a **three-pane workspace** as the default study layout (Library / Chat / Source) with the collapse points above; measure: ≥ 60 % of study sessions open the source pane at least once.
2. **Mode chip in the composer** (Tutor / Exam / Explain / Quiz) — visible state, `/tutor` etc. as aliases; test: new users identify the current mode in < 3 s.
3. **Citation chip → exact page** for textbook and mark-scheme claims; target open time ≤ 400 ms from cache; no assistant claim about a syllabus point without a chip.
4. **Typography defaults 17/1.55/68 ch** (chat) and 18/1.6/66 ch (reader); reading-comfort preset one tap away; all surfaces share prefs.
5. **Font switcher** with Inter, Atkinson Hyperlegible Next, OpenDyslexic, serif; validate Cyrillic/Kazakh coverage per family in CI with a glyph-coverage test.
6. **Motion tokens** exactly as in §25; lint rule forbidding `ease-in`, durations > 320 ms, and animation on Send/palette.
7. **Reduced-motion mode** implemented as opacity/colour-only with 160 ms fades; automated Playwright check with `prefers-reduced-motion: reduce`.
8. **Streaming stability contract**: previous DOM nodes immutable during a stream; skeleton placeholders for unclosed fences; jank test = zero layout shifts above the cursor.
9. **TTFT-aware states**: dots at 0–800 ms, status line after 800 ms, "taking longer than usual" after 6 s with a Stop; measure P95 TTFT per provider and route accordingly.
10. **KaTeX + MathML** as the render path; lazy MathJax SRE for speech; Copy-as-LaTeX on every formula; test suite of 200 syllabus formulas across subjects incl. chemistry (`mhchem`).
11. **Math keyboard and camera** as composer states; adopt MathLive or Khan `math-input`; camera flow includes a LaTeX confirmation step.
12. **Two-button flashcards by default** with FSRS at 0.90 retention; optional four-button; keyboard mapping 1/3/Space; end-of-session summary with no confetti.
13. **Four-state mastery pips** per syllabus point with decay and explanation; exam-readiness ring per paper; never a bare percent.
14. **Heatmap without punishment**: no red, no streak hero number; weekly goal with rest days.
15. **Notifications**: opt-in during planning only; ≤ 1/day; factual copy; "mute until exams" one tap; zero streak-loss messages (policy test on copy strings).
16. **Sidebar hierarchy** Subject ▸ Unit ▸ Session with Recents secondary; resizable 240–360 px; width persisted.
17. **Command palette** with verb-first learning actions; zero animation; ⌘K/⌘J/⌘⇧M shortcuts; shortcut sheet.
18. **Dark theme ladder** (4 greys) with desaturated accents and separate highlight alpha; automated contrast tests for both themes across all tokens.
19. **Border-first elevation**; stacked shadows only for popovers/modals/drawers; no shadows on cards in lists.
20. **WCAG 2.2 AA gates in CI**: axe + custom checks for 24 px targets, focus ring geometry, text-spacing survival, 320 px reflow, drag alternatives.
21. **Mobile bottom sheets** with 50/92 % detents and tap-to-close; flashcard buttons in the bottom 20 %; camera/mic/send in the right 40 %.
22. **Artifacts for long outputs** (> 40 lines) with export to PDF/DOCX/Markdown/Anki; print CSS validated on A4 and Letter.
23. **Empty state = Continue / Due / Next exam**, no greeting text larger than 20 px; onboarding ≤ 3 screens; question before account.
24. **Copy style guide**: no exclamation marks in tutor voice, no emoji, ≤ 5 bullets per list before prose is required, "Great question" banned; enforced by a response-formatting lint on model output.
25. **Selection popover** in reader and chat (Ask/Explain/Define/Save card/Quote) with 150 ms appearance and keyboard equivalent.
26. **Locale**: decimal comma accepted in math input; `Intl` everywhere; RTL-ready logical properties from day one.

---

## Open questions / things we could not verify

- Exact current layouts of Claude.ai artifacts panel, NotebookLM's 2026 three-panel proportions, and Khanmigo's student UI — domains were blocked; confirm with screenshots before the bible freezes pixel values.
- WCAG 2.4.13 Focus Appearance level: the W3C Understanding source in the repo says AA, while the final 2023 Recommendation moved it to AAA (Deque summary). Our stance: meet it regardless.
- Lucide's official stroke/padding numbers (page blocked) — verify 24 px / 2 px / 1 px padding before locking the icon spec.
- Inter and Geist Cyrillic coverage for Kazakh/Uzbek extensions — verify glyph tables; Geist may lack extended Cyrillic.
- Whether MathJax 4's SRE can run lazily alongside KaTeX output without double rendering — prototype needed.
- Skeleton "30 % faster" figure is widely repeated from Mejtoft et al. (2018) and industry replications; the effect size for chat-specific skeletons is unmeasured — run our own A/B.
- Arc/Dia, Things 3, Apple Notes/Freeform, Kindle, Notion 2025 details could not be fetched; the mobile sheet/detent and whiteboard conventions above are from prior knowledge.
- Perplexity's exact chip sizes and hover-card timing are inferred; measure from the live product.
- Duolingo's 2022 path redesign metrics were not retrievable in this session; we cite only the 2025 criticism.
- The 2025–26 arXiv studies on source presentation (2512.12207, 2601.14611) were read via search snippets only; pull the PDFs for effect sizes.

---

## Sources

1. https://www.parallelhq.com/blog/ux-ai-chatbots
2. https://www.nngroup.com/topic/ai/
3. https://www.engadget.com/ai/anthropic-brings-claudes-learning-mode-to-regular-users-and-devs-170018471.html
4. https://dataconomy.com/2025/08/15/anthropic-extends-claudes-learning-mode-to-all-users/
5. https://help.openai.com/en/articles/11780217-chatgpt-study-mode-faq
6. https://www.datastudios.org/post/chatgpt-and-the-new-tools-interface-six-modes-to-access-agent-research-study-and-creation
7. https://www.edweek.org/technology/what-teachers-should-know-about-chatgpts-new-study-mode-feature/2025/07
8. https://www.aydesign.ai/blog/ai-citation-source-ui-patterns-2026
9. https://www.shapeof.ai/patterns/citations
10. https://www.aiuxplayground.com/gallery/perplexity-citations/
11. https://arxiv.org/pdf/2512.12207
12. https://arxiv.org/pdf/2601.14611
13. https://www.shadcn.io/ai/inline-citation
14. https://pasqualepillitteri.it/en/news/4248/notebooklm-source-attribution-prompts-sources
15. https://monsha.ai/blog/notebooklm-for-teachers
16. https://github.com/emilkowalski/skills/blob/main/skills/animate/SKILL.md
17. https://github.com/emilkowalski/skills/blob/main/skills/review-animations/STANDARDS.md
18. https://github.com/vercel-labs/open-agents/blob/main/.agents/skills/web-animation-design/SKILL.md
19. https://emilkowal.ski/ui/7-practical-animation-tips
20. https://biggo.com/news/202511040733_KaTeX_MathJax_Web_Rendering_Comparison
21. https://github.com/KaTeX/KaTeX/blob/main/README.md
22. https://github.com/mathjax/MathJax/blob/master/README.md
23. https://www.intmath.com/cg5/katex-mathjax-comparison.php
24. https://www.printmag.com/type-tuesday/atkinson-hyperlegible-next-applied-design/
25. https://github.com/googlefonts/atkinson-hyperlegible-next
26. https://focusflowapp.in/blog/lexend-vs-atkinson-hyperlegible-2026
27. https://github.com/googlefonts/lexend
28. https://dl.acm.org/doi/10.1145/3502222
29. https://github.com/w3c/wcag/blob/main/understanding/22/focus-appearance.html
30. https://github.com/w3c/wcag/blob/main/understanding/22/target-size-minimum.html
31. https://github.com/w3c/wcag/blob/main/understanding/22/focus-not-obscured-minimum.html
32. https://github.com/w3c/wcag/blob/main/understanding/22/dragging-movements.html
33. https://github.com/w3c/wcag/blob/main/guidelines/sc/21/text-spacing.html
34. https://github.com/w3c/wcag/blob/main/understanding/21/reflow.html
35. https://github.com/w3c/wcag/blob/main/guidelines/sc/20/contrast-minimum.html
36. https://www.deque.com/blog/wcag-2-2-is-at-the-proposed-recommendation-stage/
37. https://uxmag.medium.com/the-psychology-of-hot-streak-game-design-how-to-keep-players-coming-back-every-day-without-shame-3dde153f239c
38. https://webdesignerdepot.com/the-art-of-duolingo-notifications-the-subtle-manipulation-of-language-learners/
39. https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification
40. https://www.threads.com/@vkelleyart/post/DSU8NJWjkCc/
41. https://www.androidauthority.com/google-material-3-expressive-features-changes-availability-supported-devices-3556392/
42. https://supercharge.design/blog/material-3-expressive
43. https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md
44. https://github.com/material-components/material-components-android/blob/master/docs/theming/Dark.md
45. https://www.maviklabs.com/blog/design-tokens-tailwind-v4-2026/
46. https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/theme.css
47. https://practicaltypography.com/summary-of-key-rules.html
48. https://linear.app/now/how-we-redesigned-the-linear-ui and https://linear.app/now/a-design-reset
49. https://rauno.me/craft/interaction-design
50. https://support.khanacademy.org/hc/en-us/articles/5548760867853--How-do-Khan-Academy-s-Mastery-levels-work and https://support.khanacademy.org/hc/en-us/articles/47216131257997
51. https://github.com/ankitects/anki-manual/blob/main/src/studying.md
52. https://github.com/ankitects/anki-manual/blob/main/src/deck-options.md
53. https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md
54. https://forums.ankiweb.net/t/fsrs-button-strategy-for-new-cards-good-or-again/57340 and https://github.com/lambdadog/passfail2
55. https://developer.apple.com/design/human-interface-guidelines/motion (read via mirror https://github.com/tmaasen/apple-dev-mcp/blob/main/content/universal/motion.md)
56. https://developer.apple.com/design/human-interface-guidelines/typography (mirror: content/universal/typography.md)
57. https://developer.apple.com/design/human-interface-guidelines/accessibility (mirror: content/universal/accessibility.md)
58. https://developer.apple.com/design/human-interface-guidelines/color (mirror: content/universal/color.md)
59. https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/vercel/DESIGN.md
60. https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md
61. https://www.shadcn.io/design/vercel
62. https://photomath.com/ and https://support.google.com/photomath/answer/14333327
63. https://aimultiple.com/llm-latency-benchmark ; https://tianpan.co/blog/2026/04/16/streaming-ttft-latency-perception ; https://tianpan.co/blog/2026/04/20/latency-perception-gap-ai-interfaces ; https://redis.io/blog/streaming-llm-responses/
64. https://www.androidauthority.com/gemini-app-android-redesign-3668250/ ; https://www.androidauthority.com/gemini-neural-expressive-android-app-hands-on-3668985/ ; https://www.androidheadlines.com/2026/05/google-gemini-new-ui-rollout-overlay-gradients-pulsing.html
65. https://www.popularai.org/p/chatgpt-sidebar-pinned-chats-gpts-projects-missing ; https://community.openai.com/t/chatgpt-projects-no-longer-opens-the-same-project-page-view-as-before-chats-now-only-appear-in-the-sidebar/1381332 ; https://community.openai.com/t/chatgpt-sidebar-improvements-fixed-project-expansion-plus-and-adjustable-sidebar-width-all-users/1182272
66. https://docs.readwise.io/reader/docs/faqs/appearance
67. https://www.researchgate.net/publication/326858669_The_effect_of_skeleton_screens_Users'_perception_of_speed_and_ease_of_navigation ; https://www.onething.design/post/skeleton-screens-vs-loading-spinners
68. https://help.desmos.com/hc/en-us/articles/37064105800333-Audio-Trace ; https://help.desmos.com/hc/en-us/articles/4404860698253-What-Accessibility-features-does-Desmos-offer
69. https://ustwo.com/work/brilliant/ ; https://screensdesign.com/showcase/brilliant-learn-by-doing
70. https://destiner.io/blog/post/designing-a-command-palette/
71. https://github.com/carbon-design-system/carbon/blob/main/packages/motion/src/dtcg/motion.json
72. https://github.com/radix-ui/website/blob/main/data/colors/docs/palette-composition/understanding-the-scale.mdx
73. https://github.com/Khan/perseus/blob/main/packages/math-input/README.md
74. https://github.com/arnog/mathlive/blob/master/README.md
75. https://github.com/mermaid-js/mermaid/blob/develop/README.md
76. https://github.com/vercel/ai-elements/blob/main/README.md
77. https://github.com/rsms/inter/blob/master/README.md
