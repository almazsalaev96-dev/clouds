# ARMI — Product Specification

*The blueprint for the whole thing: every room, control, rule, table, state and flow. Written to be handed to a developer or a coding agent and built from, section by section.*

*Branch `claude/ai-educational-chat-16y5s3` · September 2026 · supersedes the outline in `PHASES.md` for product scope; `PHASES.md` keeps the reasoning-architecture phases.*

---

## 0. How to read this

**Status marks.** Every requirement carries one:

| Mark | Meaning |
|---|---|
| ✅ | Built and gate-verified on the branch today |
| 🟡 | Partly built; the gap is stated |
| ⬜ | Not built; this document is the spec |

**Evidence marks.** Claims about other products carry `[R]` (checked against a 2025–2026 source, listed in §25) or `[K]` (established practice, no single source). Nothing about ARMI is marked, because the code is the source.

**Identifiers.** Requirements are numbered per section (`C-7` is the seventh composer requirement) so a task, a test and a commit can name one.

**The one rule that outranks the rest.** ARMI is local-first and bring-your-own-key. Every requirement below is written under that constraint: nothing leaves the browser except the request to the model provider the person chose, through the one route that forwards it. Where the leading products do something by running a server (memory in the cloud, agents on a VM, sync through an account), this spec says how the same outcome is reached without one, or says plainly that it is out of scope.

---

## 1. Vision

### 1.1 Who, why, what, why us

| Question | Answer |
|---|---|
| **Who** | A student (IGCSE / A-Level and university first; anyone who learns second) who already pays for one or more model providers, or is willing to, and wants one place that turns those models into a tutor, a notebook, a study system and a workshop. |
| **Why** | The chat apps answer; they do not teach, remember what you are studying, keep your cards, or build the thing you asked for and let you change it. Local-first apps give you your keys and your data but stop at chat. |
| **What** | Four rooms on one data store: **Conversations** (Armi models — several AIs working a question together), **Notebook**, **Study**, **Artifacts** (things that run), with **Creative** as the front door for making. Everything on the device; every model call with your key. |
| **Why ARMI** | (1) *Casts, not models*: an Armi model is a writer plus a checker, a brief, a duel or a council from other companies, so an answer has been argued with before you read it. (2) *The four rooms share one memory*: a sentence in a note becomes a card; a card that keeps failing becomes a question; a question becomes a built quiz. (3) *Nothing leaves*: keys, notes, cards, canvases, spend — all in this browser, backed up as one plain file. (4) *Honest by construction*: citations are checked against the source before they are shown; a marker marks; the cost is added up as it happens. |
| **When** | Sitting down to study; stuck on a question; reading a PDF; wanting a working thing (a quiz, a timer, a graph) rather than a description of one. |
| **Outcome** | The person leaves knowing something they did not, with a record of it (cards due, a page written, a thing built) that the app will bring back to them tomorrow. |

### 1.2 Principles (the ten rules)

1. **Answer, then argue.** Every Armi model has at least one other model in the cast. The second opinion is bought where it changes the answer (a brief before, a check after), never as decoration.
2. **The thing itself, not a description of it.** A request for a quiz produces a quiz that runs. A request for a graph produces a graph you can pan.
3. **Show the seams.** Which Armi model answered, why the router chose what it chose, what it cost, which citation could not be found — all on the row, in words.
4. **Local-first is a promise, not a setting.** Keys in this browser only. Data in IndexedDB, persisted, backed up to one plain JSON file that outlives the app. Offline, the rooms that never needed the network keep working.
5. **The documents are material; the person typing is the only one giving instructions.** Every uploaded page, web page and tool result is quoted as data and told so.
6. **A model's name is not the product.** No vendor model name appears in the interface. The person chose an Armi model; that is what they see.
7. **44 points, 4.5:1, every theme.** Touch targets, contrast and both themes are measured by the gate, not promised.
8. **One decision per turn, written down.** What kind of job, which model, how hard to think, whether it earned a check — decided once, stored, read back.
9. **Errors say what, why and what next.** Never a status code. Never a provider's raw string.
10. **Fewer things, deeply joined.** A feature that does not connect to another room is a feature for a different app.

---

## 2. Brand

| Element | Today | Specification |
|---|---|---|
| Name | **Armi** (wordmark "Armı" in Pinyon Script in the corner) ✅ | Keep. "ARMI" in caps only for the model family ("ARMI Polaris"). |
| Icon | `icon.svg` (ink ground, signal-cyan letter) + `apple-icon.png` ✅ | ⬜ Regenerate `apple-icon.png` in the new palette; add a maskable 512×512 PNG to the manifest for Android install prompts. |
| Palette | Ice `#f3f6fc` light, case `#0b101c` dark; electric blue for structure, cyan for signal; semantic danger/success/warning tokens ✅ | Keep. Every new colour is a token in `globals.css`, never a literal. The warm half is gone: only the amber of a warning survives, because that is meaning rather than brand. |
| Type | Inter (UI), Pinyon Script (signature), tabular numerals via `.tnum` ✅ | ⬜ Add an OpenDyslexic / Atkinson Hyperlegible option under Appearance (Claude.ai ships a dyslexic font toggle `[R]`). |
| Voice | Plain, short, second person, no exclamation marks; copy explains why, not just what ✅ | Codify in §2.1. |
| AI personality | Per Armi model (Orrery withholds, Nova builds, Constellation argues) ✅ | Keep personality in the cast's stance, never in a global "friendly" prompt. |
| Motion | `--dur-fast/--dur-enter`, `anim-fade/rise/toast`, `lift`, `bloom`, reduced-motion respected ✅ | Keep. New motion must have a reduced-motion branch. |
| Sound | None | Out of scope by design (a study app in a library). |

### 2.1 Writing rules for interface copy

- Sentences, not labels: "Nothing matches *query*." not "No results".
- Say the reason: "Pictures stay out of the backup because a key in it is a key on somebody else's machine."
- Name the person's thing, not the system's: "your notebook", not "the notes table".
- Numbers in tabular figures; never "1 cards".
- A destructive action is described by what is lost and how to get it back (the undo bar), not by "Are you sure?".

---

## 3. Information architecture

### 3.1 The map

```
Armi
├── Conversations            (the default room; sidebar lists threads, pinned first)
│   ├── New chat             Ctrl/⌘ N
│   ├── Thread               messages · casts · canvases beside · compare columns
│   ├── Search               across titles and bodies
│   └── Temporary chat       nothing kept, no memory read
├── Projects                 (a folder with instructions + files that every chat inside sees)
│   └── Project              chats · files (with excerpts when large) · instructions · dropped-file notice
├── Notebook                 pages · links · backlinks · tags · outline · templates · ask
├── Study                    decks · cards (basic, cloze) · today · cram · write mode · import/export · streak
├── Artifacts                web canvases (multi-file) · documents · code · versions · preview widths · download
├── Creative                 the front door for making: composer + ideas + ten starters
└── Settings                 Model · API keys · Memory · Appearance · Data · Keyboard shortcuts
```

**Rule IA-1 ✅** The sidebar belongs to conversations. Every other room is a place you go to with its own index (`SectionIndex`), so the mental model is "rooms", not "tabs".

**Rule IA-2 ✅** Objects cross rooms by reference, never by copy: a card remembers its source note (`sourceNoteId`), a canvas remembers its conversation and project, a message remembers its canvas.

**Rule IA-3 ⬜** Every object has a stable deep link (`#armi-note-<id>`, `#armi-card-<id>`, `#armi-canvas-<id>`, `#armi-chat-<id>`) so search results, citations and the home strip open the thing directly. Today only notes have one (`#armi-note-`, `#armi-new-`).

**Rule IA-4 ✅ Global search.** `Ctrl/⌘ K` opens the command palette, which searches conversations, projects, canvases, pages (title and body) and decks, grouped by room with at most five per group, and opens the thing in its room. Message bodies and card fronts are searched too (`lib/find.ts`): two groups, "In conversations" and "In cards", that run only once two characters are typed and scan the most recent 2,000 rows — loading every message to search four words would make opening the palette the slowest thing in the app. Every hit shows **the line it matched on**, cut around the match rather than from the start of the text, with the match marked; a row that does not contain what you typed reads as a bug every time. One row per conversation however many times it is mentioned. Fields are weighted in the order the caller gives them — a card's front outranks its back — so matching the *question* wins. The leading products all search only conversations `[R]`. ⬜ Filters by room and date.

### 3.2 Navigation states

| State | Behaviour |
|---|---|
| Desktop ≥ 1024px | Sidebar open, main column, optional right panel (canvas / source / compare). |
| Tablet 640–1023px | Sidebar collapsible, canvas takes the column. |
| Phone < 640px | Sidebar as a sheet; canvas full-screen with a back bar; composer above the keyboard (`interactiveWidget: resizes-content`). |
| Print | `no-print` chrome removed; conversation prints as a document (gate: `print`). |
| Offline | Rooms work; composer explains the model needs the connection; a status region says "Offline." (§19). |

---

## 4. Design system

### 4.1 Tokens (all in `app/globals.css`)

| Group | Tokens | Notes |
|---|---|---|
| Colour | `--bg`, `--surface`, `--subtle`, `--line`, `--line-strong`, `--primary`, `--secondary`, `--tertiary`, `--faint`, `--accent`, `--accent-2`, `--accent-2-ink`, `--accent-subtle`, `--danger`, `--success`, `--highlight`, `--highlight-edge`, `--highlight-fg` | Both themes define every token; `data-theme` is always concrete (system resolved before first paint). Derived in OKLCH from three ramps — neutral 266, structure 264, signal 196 — so lightness steps are perceptually even rather than evenly spaced in hex. Dark text tops out near L 0.92, not 0.96: white on near-black halates. Dark carries less chroma than light at every hue, because saturated colour on a dark field vibrates. `--accent-2-ink` is the signal solved for *reading* — a colour tuned to be seen is not automatically one that can be read. |
| Syntax | `--syn-comment`, `--syn-keyword`, `--syn-string`, `--syn-function`, `--syn-number`, `--syn-type` | Both themes solved to one shared band (5.9 for the comment, 7.8–8.5 for the rest) rather than one theme chasing the other's numbers, which turns six hues into six browns on a pale page. Hues spread ≥ 50° apart: inside a code block, telling one token from the next matters more than contrast against the page. Mapped onto Shiki's github-light output in `lib/highlighter.ts`, so a theme switch needs no re-highlight. |
| Space / radius | Tailwind scale × density multiplier; `rounded-md/lg/xl` | Density: comfortable / compact multiplies paddings, so every target is re-measured (gate: `touch`). |
| Type | `--measure` (reading width), `--measure-wide` (code), type scale (gate: `type-scale`) | Body 15–16px; code 13px; headings ≤ 1.75rem. |
| Motion | `--dur-fast`, `--dur-enter`, `--ease-out` | `prefers-reduced-motion` collapses to opacity only. |
| Controls | `--ctl` (control size), `.tap` (44pt floor), `.btn-touch` | Any new interactive element uses `.tap` or `.ctl`. |
| Glass | `.glass` (backdrop blur surface) | Sticky headers, toasts, composer. |
| Elevation | `--shadow-sm` (card) · `--shadow-md` (menu, floating panel) · `--shadow-lg` (dialog, palette) — each its own shadow, each with a lit rim | Three levels, never one shadow scaled. In dark the ink is plain black at rising weight and the rim does the separating, because a shadow alone vanishes on a near-black ground. In light every layer used to carry a negative spread (`-1` to `-16px`) that pulled the shadow back inside the element before it drew: a ramp that existed in the stylesheet and not on a tablet in daylight, where the whole app read as line art. The blur now reaches past the edge at every level; measured, the light ramp reads 1.28 → 1.50 → 2.24 against its own canvas (was 1.26 → 1.49 → 1.75) and the two rooms are now 1.3× apart rather than 1.5×. `.lift` = a card row rising 2px in 180ms with its border warming toward the accent. |
| Focus | `:focus-visible` outline on everything · a 3px halo on a standalone text field · the composer's own line-and-lift | A halo follows the element's own corners, so the one drawn on the bare, radius-less textarea **inside** the composer rendered as a hard rectangle in a 28px pill — permanently, on any tablet with a keyboard attached. A field inside `.composer-shell` now draws nothing; the shell indicates focus for it. The shell is also out of that rule's selector list, where it had been silently replacing `--composer-lift-focus` and so *removing* the composer's elevation at the moment it was touched. |
| Glow | `.bloom` — resting 0.15, hover 0.22, on the one primary action per screen | **Nothing else glows.** Seven in the app, one per screen. The send button alone carries an ambient halo. |
| Colour budget | ~85% neutral surfaces · ~10% text hierarchy · ~5% accent | The rule that makes the accent read as valuable rather than noisy. Not yet measured by the gate; a `budget` probe sampling rendered pixels by hue is the next measured check to add. |

### 4.2 Components (existing, in `components/ui/primitives.tsx` and siblings)

Button (primary/ghost/danger, sm/md), IconButton (with `keys` hint), Tooltip, Kbd, ConfirmInline, Field, Panel, Dialog (Radix), UndoBar, CrashNet, Shell (offline), SectionIndex, DetailBar, MessageBar (composer), Message, MessageList, ModelPicker, Settings, ShortcutsOverlay, CodeEditor, DiffView, MakeRow/MakeMark, CanvasView, StudyView, NotebookView, ProjectsView, CreativeView, EmptyState.

**DS-1 ⬜** Add: `Chip` (filter/tag, pressable, `aria-pressed`), `Meter` (context window / budget bar), `Callout` (info/warn/danger with an icon and one action), `Sheet` (phone bottom sheet used by attachments and the tools menu), `Skeleton` variants for message and canvas.

**DS-2 ✅** Every list is named (`aria-label`), every icon button has an accessible name, every dialog returns focus (`useReturnFocus`).

### 4.3 Accessibility floors (measured by the gate)

| Floor | Standard | Gate |
|---|---|---|
| Touch targets ≥ 44×44pt on touch, ≥ 24×24 CSS px everywhere (WCAG 2.2 SC 2.5.8 `[R]`) | Apple HIG / WCAG 2.2 AA | `touch` |
| Text contrast ≥ 4.5:1, large ≥ 3:1, both themes | WCAG 2.2 AA | `contrast`, `theme-parity` |
| Focus visible on every control; not obscured by sticky bars (SC 2.4.11) | WCAG 2.2 AA | `reach`, `shell` |
| Drag has a pointer alternative (SC 2.5.7): board cards have arrow buttons; mind-map nodes have grow buttons | WCAG 2.2 AA | `e2e-makes` |
| Live regions for streaming, errors, undo, offline | WAI-ARIA | `e2e-error` |
| Reduced motion honoured | WCAG 2.3.3 | `audit` |
| Keyboard: every action reachable; shortcuts overlay (`?`) | — | `keys` |

---

## 5. Home, onboarding and empty states

### 5.1 First run ✅ / 🟡

Today: no wizard. A signature, a greeting that knows the hour and your name, the box, and — only when nothing is waiting elsewhere — one line of text saying that `/` lists what the app can be asked to do. Keys are asked for at the first send, not before.

**H-0 ✅ No chips.** Four boxed openers used to sit under the box. Half of them were sentences you were meant to finish (`Explain `, `Make me a working quiz on `) and a half-sentence inside a hard-edged chip does not read as an invitation to keep typing — it reads as a label that got cut off; four of them turned the blank page into a form to get past before you were allowed to type. What they were for survives in two better places: the waiting line says what is genuinely due in the other rooms, and `/` lists the commands *in the box, while you are already typing*. This is the same move Gemini's 2026 redesign made `[R]`; onboarding as a form is the anti-pattern.

**H-1 ⬜ Three-question first run**, skippable, one screen, never a form:
1. "What are you working towards?" — chips: IGCSE · A-Level · University · Something else (sets the default study register and exam intelligence, §13.6).
2. "Which subjects?" — free text with suggestions (seeds Notebook templates and Study decks).
3. "Add a key when you are ready" — one line explaining keys stay in this browser, with a "Later" that is the same size as "Add key".

**H-1b ✅ Every room's empty state is the same object as the chat's**: the title in the display italic, one sentence, and the ways in as a quiet line of presses — no dashed box, no paragraph, no second copy of the header's button. The empty Notebook does not offer to be asked. Populated, the rooms are held to `e2e-rooms`: previews are prose (`lib/plain.ts`), a deck lists soonest-due first, a project row counts its files and chats, the knowledge meter never says 0% of something that fits, and the recall line never says NaN.

**H-1c ✅ Comfort on a tablet.** Three things measured on an iPad: (1) every room had a topbar-height strip above its own header whose only occupant appears below `md` with the sidebar closed — fifty-six pixels of nothing, two headers; the strip renders only when it has something in it. (2) On iOS the layout viewport does not shrink for the software keyboard, so a bottom-docked composer sat under it; the shell writes the visual viewport's shortfall to `--kb` and `.app-frame` is `100dvh` less that, ignoring gaps under 100px (a toolbar, not a keyboard). (3) The box focused itself on every blank page and room entry, which on a touch screen raises the keyboard over half the page before a word is read; `MessageBar` now focuses itself only where the primary pointer is fine, unless `focusOnTouch` says the focus is the point (Study's "New deck"). Gate: `e2e-rooms` (touch context, `hasTouch`).

**H-1d ✅ Comfort on a phone.** Measured at 430px with a finger for a pointer: (1) Settings was a 44rem window cut off at the screen's edge, its heading and half of every key field outside it; under `sm` it is the whole screen, the pages a strip across the top that scrolls sideways, the fields full width. (2) Opening a page in the Notebook put the caret in it and the keyboard over it; the editor focuses itself only on a fine pointer, and a press (a shape chosen, an outline heading) still focuses on any device. `MessageBar` likewise counts only a *change* of `focusKey` as a press — the first value arrives with the room. (3) The composer spent a row on a paperclip alone; under 34rem the two control groups share the row under the line when they fit and wrap only when they do not. (4) The study session's hint said "Space to show the answer" and "1 – 4 · Esc" on a screen with no keys; on a coarse pointer it says tap and press. (5) The Notebook's page editor drew the standalone-field halo — a box around the whole page the moment you wrote — and a field inside a wrapper that shows `focus-within` drew a second, square ring inside a rounded one; neither does now (`textarea.bare`, and any field under a `focus-within:` wrapper). (6) The sidebar's sticky date headers were surface-white bars on a canvas-tinted column; they take the canvas tint. (7) A made thing's header wrapped its five controls and project picker under the title with the back button floating between the two rows and the picker cut off at the edge: the back button now sits on the title's row (`DetailBar wraps`), the controls row scrolls sideways, the preview-width row never breaks a button over two lines, and the shortcut chips are one scrolling row instead of two over the box; a project's name and its button stay on one row. (8) The three remaining dashed borders — the "Open files" starter, Creative's "Bring your own" and the MakeRow's "Anything else…" — are solid now, the dashed line having been the one the person pointed at and asked to lose; and the starter cards sit two to a row on a phone rather than one under another, so what has been made is not below the fold. (9) The grade buttons' key numbers and the blank page's dot separators are gone on a phone — the dots because one was left dangling at a wrapped line's end. Gate: `e2e-phone`.

**H-2 ✅** Empty states are invitations with a verb ("What should we make?", "Nothing written down yet"), each with the primary action beside them.

**H-3 🟡 Home strip.** Today: cards due, pages, things made. Add: "Continue" (last conversation, last canvas), "Today's plan" (from §13.8), and the exam countdown when one is set.

**H-4 ⬜ Daily brief (local).** On first open of a day: due cards, pages touched yesterday, streak, one suggested question from the weakest topic. Computed locally from the store; no model call unless asked.

---

## 6. The composer

### 6.1 Anatomy

```
┌──────────────────────────────────────────────────────────────────┐
│  Message…                                                        │
│                                                                  │
│  [+]  [🎤]   Armi model: One ▾    (effort ▾ when set)   [↑ Send] │
└──────────────────────────────────────────────────────────────────┘
   ↑ attach / camera / paste image / files / from notebook / from a project
```

The rule from the flagship products: show three controls, hide the rest in one menu (ChatGPT "+" sheet, Gemini merged "+"/Tools, Claude "Search and tools") `[R]`. Perplexity is the exception that proves it: mode, model and sources visible because those *are* the product `[R]`. For ARMI, the Armi model *is* the product, so it stays visible; everything else goes behind "+".

| # | Control | Today | Spec |
|---|---|---|---|
| C-1 | Text area, grows to 8 lines, Enter sends, Shift+Enter newline, ⌘↑ edits last message | ✅ | Keep. |
| C-2 | Armi model picker (name + one line of what it does; no vendor names) | ✅ `ModelPicker` | Add capability dots: *thinks*, *sees pictures*, *long*; add "Auto" explanation line. |
| C-3 | Effort (Low/Balanced/Deep) | ✅ per preset, overridable | Surface as a segmented control only when the preset allows; default hidden. |
| C-4 | "+" menu: Files, Photo/camera, From notebook (pick a page), From project (pick a file), Voice note | 🟡 files/images ✅; notebook/project pick ⬜ | Bottom sheet on phone. |
| C-5 | Voice: push-to-talk and hands-free, live transcript in the box, interrupt by tapping | ✅ `lib/voice.ts` (recognition) | ⬜ Read-aloud of answers (browser TTS), per-message. |
| C-6 | Stop (replaces Send while streaming); Esc stops | ✅ | Keep. |
| C-7 | Context meter: a line under the box when the thread nears the model's window ("12k of 200k — this thread is nearly full") | 🟡 line ✅ | ⬜ "Summarise older turns" beside it. |
| C-8 | Attachments strip: thumbnails, remove, size, "will be read as text" for PDFs | ✅ | Add page count for PDFs. |
| C-9 | Slash commands | ✅ `lib/slash.ts` | `/study` `/build` `/research` `/compare` `/check` `/temp`, and every Armi model by its short name (`/parallax …`). A slash at the start of the box lists what a slash can do, narrowed as it is typed; an unknown command says so and is sent as written — a typo must not silently become a different room. The command is stripped from the message kept; a bare `/research` is a setting, not a message. `/study` beats Auto's reading for that turn: the person said which room it belongs in. `/compare` is Binary for that turn — two companies side by side, one column where only one company has a key. `/check` sets a second reading on the reply whatever the tactic would have done; the row says "second reading asked for" (asked, not done — with one company's key the notice says nobody can). Gate: `e2e-slash`, `test-slash`. |
| C-10 | Ideas row under the box on an empty thread | ✅ Creative (six, sent as they are); ✅ chat (four openers that fill the box: the shakiest deck, the cards you keep missing, your latest page, then general ones only to fill the row) | — |
| C-11 | Paste handling: code becomes a fenced block, long text becomes an attachment, image becomes an attachment | 🟡 | Threshold 1,500 characters. |
| C-12 | Draft persistence per thread (unsent text survives navigation and reload) | ⬜ | `localStorage` per conversation id; wrapped in try/catch. |

### 6.2 States

`idle` → `composing` (Send enabled when text or attachment) → `sending` → `waiting` (elapsed counter, not a spinner) → `streaming` (Stop) → `retrying · Ns` (automatic, cancellable) → `idle`. Offline: Send disabled with the reason inline. No key: Send opens Settings → API keys with the provider pre-selected.

---

## 7. The conversation

### 7.1 Message anatomy

```
┌ user ─────────────────────────────────────────────────────────┐
│ text · attachments (thumb, name) · [Edit] [Copy]                │
└────────────────────────────────────────────────────────────────┘
┌ assistant ────────────────────────────────────────────────────┐
│ Armi Polaris · "chose Parallax: the question is numeric" · 1.8s  │
│ (thinking, collapsed: "Working it through…")                   │
│ body — prose, code, math, tables, citations, canvas card       │
│ [Copy] [Retry ▾] [Check with another] [Rate ▲▼] [Read aloud]   │
│ ‹ 2/3 ›  (branch arrows when edited or retried)                │
│ ✎ verdict from the checker, when the cast had one              │
└────────────────────────────────────────────────────────────────┘
```

| # | Requirement | Today | Spec |
|---|---|---|---|
| M-1 | Streaming with a live elapsed counter; time-to-first-token and total latency recorded on the message | ✅ | Keep. |
| M-2 | Stop keeps everything streamed; the message is marked "stopped" | ✅ | Keep. |
| M-3 | Edit-and-branch: editing a user message creates a sibling; `‹ n/m ›` arrows navigate; leaf pointer per conversation | ✅ (`parentId`, `advanceLeaf`) | ⬜ A tree view in the thread menu for threads with > 3 branches (nobody ships this `[R]`; it is the honest way to show what the arrows hide). |
| M-4 | Retry ▾: same model · another Armi model · with more effort | ✅ | "With more effort" is the first entry of the regenerate menu: the same model at `high`, for that turn only, ahead of the tactic's own setting and the router's reading — the person pressing it has already seen what those two produced. The row says "asked to think harder". |
| M-5 | Check with another: a second cast member reads the answer and returns a verdict rendered under it (agree / disagree with the line) | ✅ (`check`, `turns`) | Keep; add "Ask both to argue" (duel) as a row action. |
| M-6 | Rate ▲▼ feeds the router's memory of pairings (`pastFor`) | ✅ | Keep. |
| M-7 | Copy: plain text, or Markdown with the "Copy as Markdown" modifier | 🟡 | Add the modifier. |
| M-8 | Read aloud with the browser voice in the language of the text; Stop on a second press; markup stripped before speaking | ✅ | ⬜ Highlight the sentence being read. |
| M-9 | Share: export a thread as Markdown / HTML / print | 🟡 print ✅ | Add Markdown and single-file HTML export (no server share links by design). |
| M-10 | Thinking shown collapsed, streamed live ("reasoning" events), never reformatted | ✅ | Keep; label it "Working it through" not "Thinking" for the summarised kind. |
| M-11 | Routed-why line: one sentence in plain words, names stripped (`plainly`) | ✅ | Keep. |
| M-12 | Cost and tokens per message; per-thread totals in the header menu | ✅ | Keep; Spend panel in Settings (§17). |
| M-13 | Errors inline under the question with one action (Retry / Add key / Switch model / Shorten) and a live region | ✅ | Keep; copy table in §19.4. |
| M-14 | Compare: two Armi models side by side, one question, pick the better one (feeds M-6) | ✅ | Add a third column on wide screens. |
| M-15 | Message search within a thread (`/` focuses, highlights) | ⬜ | — |
| M-16 | "Sources" strip at the end of an answer that used project files, notes or the web: numbered, each opening the source at the quoted span | 🟡 citations ✅ for notebook/sources; chat ⬜ | Unify on `lib/cite.ts`. |
| M-17 | Selection actions on an answer: Ask about this · Make a card · Save to notebook · Explain simpler | 🟡 Notebook has it | Bring to chat (Copilot's select-a-sentence pattern `[R]`). |
| M-18 | Timestamps on hover; day separators | ✅ | Keep. |

### 7.2 Casts, on the row

Every Armi model is a cast (`lib/presets.ts`): a **writer** plus one or more **parts** — *brief* (another company writes what a good answer must get right, before the writer starts), *check* (another model grades the answer after), *duel* (two answers, one judge), *council* (three opinions, one synthesis). The row shows the cast that ran as small marks after the name ("One · brief · check"). The check's verdict renders under the answer. A cast part that fails is skipped silently and noted in the routed-why line ("the check did not come back").

Armi models today, named for the sky because each name states the mechanism: **Polaris** (the default you steer by: a strong writer with a brief and a check), **Pulsar** (fast, cheap, no parts), **Parallax** (numbers; the same object sighted from two positions), **Constellation** (separate stars, one figure: three companies, one synthesis), **Aperture** (how much gets in: long context), **Nova** (builds things; canvas mode), **Lens** (pictures, two of them on the same object), **Orrery** (a machine built to teach; withholds the answer; §13.3), **Rosetta** (languages), **Voyager** (a record composed for a reader who is not you: writing), **Binary** (two bodies, neither subsumed: two answers, one judge). Auto chooses among current models by the plan (`lib/decide.ts`).

### 7.3 Temporary chat ✅
Nothing saved, no memory read or written, no title call, marked with a ghost icon in the header; the composer says so. (Claude Incognito / ChatGPT Temporary `[R]`.)

---

## 8. Response rendering

| Block | Today | Spec |
|---|---|---|
| Prose, headings, lists, quotes | ✅ Markdown | Keep house style: prose by default, lists when the content is a list. |
| Code: fenced, highlighted (shiki), Copy, language label, wrap toggle | ✅ | ⬜ "Open in Artifacts" for HTML/JS blocks; "Run" for the sandbox-able kinds (HTML, JS, SVG) — renders in a srcdoc frame beside. |
| Math: KaTeX inline and display | ✅ | Keep; copy as LaTeX on click. |
| Tables | ✅ | Sortable headers ✅ (`DataTable`, `lib/table.ts`): a column of figures sorts as figures — 2 before 30 before 100, which text sorting gets wrong; "1,200", "£12" and "12%" are read as numbers while "3 of 4" and "£1.2m" are refused rather than guessed; one "n/a" does not turn a column into text; blanks sink whichever way the column points; a stable sort so the same press twice is a reversal, not a reshuffle; the rendered rows are *moved*, never rebuilt, so links and code inside cells survive. "Copy as CSV" ✅ follows the order on screen and quotes commas, quotes and newlines. ⬜ "Open as sheet". |
| Diagrams: Mermaid | ✅ | `Diagram`: drawn once the stream ends, never mid-stream; a fence that fails to parse is shown as code, never as an error box. |
| Charts | ✅ ```chart fence | `Chart` + `lib/chart.ts`. The fence carries data only — `{type, title, unit, x, series[]}` or the short `{labels, values}` — and everything spatial is decided by fixed rules: bars ≤ 24px with a 2px surface gap and a rounded data-end square at the baseline; 2px lines broken at a null rather than bridged; 8px end markers ringed in surface; hairline solid gridlines on nice-number ticks that always include zero for bars; text in text tokens, never a series colour; a legend for ≥ 2 series; a crosshair readout listing every series at the nearest x; a table view one press away so no value is hover-only; the source under a disclosure. Four series colours (`--chart-1..4`) derived from the app's own hues and **validated** in both themes with the dataviz six-check script (worst adjacent colour-blind ΔE 13.5 light / 9.4 dark); a fifth series folds into "Other" — a fifth colour is never generated. The signal cyan is deliberately absent: at chart lightness it cannot reach the chroma floor inside sRGB. Not drawn mid-stream; an unreadable fence is shown as code. ⬜ "Open in Graph". |
| Images returned by the model | n/a (no image generation) | Out of scope; images in are supported. |
| Citations `[[cite: source | quote]]` | ✅ Notebook/sources | Unify for chat (M-16); a quote that cannot be found on the page is marked "?" — never dropped, never passed off (`lib/cite.ts`). |
| Canvas card: a built thing beside the thread with Preview / Code / Files / Versions | ✅ | Keep (§15). |
| Callouts: "Cut short by a safety filter", "Stopped", "Answered again after a second model objected" | ✅ | Keep. |
| One line under the composer: "Armi can be wrong. Check what matters." | ✅ | Every flagship shows one `[R]`; one line, tertiary, under the box rather than under every answer. |

**R-1 ✅** All rendering of model output is untrusted: no raw HTML in prose, links get `rel="noopener"`, srcdoc frames for anything executable.

---

## 9. Models, casts and routing

### 9.1 Registry (`lib/models.ts`) ✅

Twenty-four models across four providers, each with: `id`, `provider`, `name` (never shown), `contextWindow`, `maxOutput`, `priceIn/priceOut`, `vision`, `reasoning`, `thinks: "effort" | "budget"`, `legacy`, `speed/quality` traits for the router. Default `claude-sonnet-5`.

**MR-1 ✅** Auto and the checker choose only among non-legacy models; explicit Economy/Fast presets may use legacy ones on purpose.

**MR-2 ✅ Wire rules per model** (tested in `test-wire.ts`): effort-style models get `output_config.effort` and no sampling params; budget-style models get `thinking: {type:"enabled", budget_tokens}` and low effort sends no thinking at all.

**MR-3 ⬜ Current wire shapes to adopt** (from the provider reference, September 2026 `[R]`):
- Anthropic current models: `thinking: {type: "adaptive", display: "summarized"}` (so reasoning streams instead of a long pause) + `output_config.effort` ✅; `budget_tokens` only on Haiku-class models ✅.
- Anthropic Opus 5 / Fable: **mid-conversation system messages** (`{role:"system"}` inside `messages`) for the per-turn prompt so the cached prefix survives; not on Sonnet 5, so keep the current two-block system for it.
- Anthropic: `stop_reason: "refusal"` handled as a callout ("Declined by the provider's safety layer") with Switch model; opt into server-side fallbacks where the provider offers them.
- Cache: `cache_control` on the stable system block and on the last message; 1h TTL for project knowledge blocks; verify `cache_read_input_tokens > 0` in the usage meter (show "cached" on the row when it is).

**MR-4 ✅ Router inputs** (`lib/decide.ts`, `lib/route.ts`): task kind, wants-a-thing, difficulty, modality (images?), context size, cost tier, speed need, provider availability (keys present), user preference (explicit preset wins), past outcomes for this pairing (`pastFor`).

**MR-5 ✅ Somewhere else to ask.** A provider-side refusal (`provider_down`, `rate_limit`, `quota`, `bad_key`) that survives the automatic retry moves the turn to the most capable model from a *different* company that can still read the question — vision and window kept — and the row says why ("Anthropic was having trouble a moment ago"). Kinds that would fail identically anywhere (context length, content filter) are not moved.

**MR-6 ✅ Model health** (`lib/health.ts`). A provider that just refused is remembered in memory — two minutes for an outage, ninety seconds for a limit, ten for credit or a rejected key — and both routers step around it while it lasts. Never leaves nobody to ask: where everything is ailing the memory is ignored. Not recorded for `network`, `timeout` or `unknown`, which are as likely to be the café as the company. A model you picked by hand is still used; only the app's own choices move.

**MR-7 ✅ Effort honoured**: preset effort overrides the model default; user override overrides the preset (`paramsSet`).

### 9.2 Routing table (the rules, in order)

| Rule | Condition | Result |
|---|---|---|
| 1 | Explicit Armi model chosen | Use its cast; Auto rules skipped |
| 2 | Attachments include images | Writer must have `vision` |
| 3 | Thread + knowledge > 60% of a candidate's window | Prefer a `long` model; excerpt knowledge (§12) |
| 4 | Task = build (wants a thing) | Nova cast; canvas mode on |
| 5 | Task = numeric / proof | Parallax cast (writer with reasoning, checker re-derives) |
| 6 | Task = teach / "I don't understand" / study register | Tutor stance (§13.3) |
| 7 | One-liner, greeting, formatting request | Flash (no parts; cheapest current model) |
| 8 | Past outcomes for this pairing are poor (rated ▼ twice) | Next candidate |
| 9 | Provider key missing or failed recently | Skip its models |
| 10 | Otherwise | One |

---

## 10. Tools and agents

### 10.1 Tool registry (client-side, permissioned)

ARMI has no server tools by design. Tools run in the browser or are declared to the model and executed locally.

| Tool | Runs where | Today | Spec |
|---|---|---|---|
| `search_notes(query)` | local BM25 over pages (`lib/retrieve.ts`) | ✅ model tool | Passages with the page each came from; the chip opens the Notebook. |
| `search_conversations(query)` | local line match over the last 2,000 messages (`lib/find.ts`) | ✅ model tool | Lines with the conversation and date; this conversation and temporary ones excluded; the chip opens the best one. |
| `read_project(query)` | local BM25 over project files | ✅ (prompt excerpts) | Stays in the prompt: the material is already there when the turn goes out. |
| `save_to_project(name, text)` | local write to the project's knowledge | ✅ model tool | Offered only in a project. Undo removes the file. |
| `calculate(expr)` | local, exact (`lib/arith.ts`, BigInt) | ✅ model tool, and the compute path | Refuses anything that is not a sum; the model is told to use it rather than work digits out in its head. |
| `now()` | local clock | ✅ model tool | Date, time, weekday, zone — the one thing every model is wrong about. |
| `save_cards(deck, cards[])` | local write to Study | ✅ model tool | Deck by name, made if new; cards already in it skipped; the chip opens the deck; Undo removes the cards it added (and the deck, if it made it). |
| `study_status()` | local read of Study | ✅ model tool | Decks and counts, due now, streak, weakest topic with its recall. |
| `save_note(title, content)` | local write to the Notebook | ✅ model tool | Markdown; title derived if none; the chip opens the page; Undo deletes it. |
| `read_note(title)` | local read of one page (closest title) | ✅ model tool | The whole page, first 12,000 characters if longer, said so. |
| `append_note(title, content)` | local write to the end of a page | ✅ model tool | For "add this to my X page"; Undo restores the page as it was. |
| `read_made(id \| title)` | local read of one canvas (a web canvas as its files) | ✅ model tool | For "change the timer I built": the model reads what is there before it says what to change. |
| `remember(fact)` | local write to memory | ✅ model tool | Not offered in a temporary chat or with memory off; Undo forgets it. |
| `list_made(query?)` | local read of canvases | ✅ model tool | Newest first, eight at most, with ids for `read_made`; the chip opens the first. |
| `build_canvas(files)` | local canvas store | ✅ (Nova) | Keep, as a fence rather than a tool: a page is a thing to stream, not to ask for. |
| `build_canvas(files)` | local canvas store | ✅ (Nova) | Keep. |
| `run_canvas_tests()` | srcdoc frame reports console errors back | 🟡 | ⬜ Self-heal loop (§15.4). |
| `web_search(q)` | provider server tool — `web_search_20260209` on the 4.6+ family, `web_search_20250305` older, chosen by `thinks: "effort"` (`lib/providers/tools.ts`) | ✅ | **Research**, a per-conversation toggle **in the composer** (a named globe chip beside `+`), switchable mid-chat unlike Temporary. It was an icon in the top bar; it is a decision about the sentence being typed rather than a property of the room, which is why all three flagships put their tools inside the box `[R]` — and a bare globe in a corner is also a guess about what kind of globe it is, so it is named as well as drawn. On, the chip fills with the accent and reads `aria-pressed`. The search runs on the provider's servers inside the same response; the app offers the tool and translates what comes back: `server_tool_use` → "Searching for “…”" in place of "Writing"; `web_search_tool_result` → numbered sources as they arrive; `citations_delta` → a `[n]` marker into the text at the point it attaches; `pause_turn` → the turn is sent straight back, up to three times, with no added message. Sources persist on the message and render as a strip under the answer with the cited passage on the link. Only one company here searches; with Research on and another company's writer chosen, the turn moves to the strongest keyed model that can and the row says so; with no such key it says it could not search rather than answering from memory and calling it research. The privacy panel says what a search sends. Gate: `e2e-research`, `test-tools`. |
| `fetch_url(url)` | `web_fetch_20260209` / `web_fetch_20250910`, with citations on | ✅ | Offered only when a URL is already in the conversation — the tool reads nothing else, and a model told it may fetch will sometimes try. Rides with Research. |

**T-0 ✅ How a tool round works** (`lib/actions.ts`, `lib/actions.text.ts`, `lib/hooks/useStream.ts`, both adapters). The app's tools are described once (`ToolSpec`: name, description, JSON Schema) and each adapter wraps them in its envelope — `tools[].input_schema` for Anthropic, a flat `tools[].name`/`parameters` for OpenAI's Responses API, and `tools[].function.parameters` for the chat/completions shape that DeepSeek and Moonshot speak. The model's ask streams as `acting` (the row says "Saving cards" in place of "Writing"); the round ends with `calls` carrying the assistant turn in the provider's own shape (`Message.raw`, in memory only — thinking blocks and signatures go back untouched) and the stream hook runs each call in the browser, appends the raw turn and one `tool_result` per call, and asks again, up to five rounds. What was done is kept on the answer as `Message.actions` (id, name, summary, ok, open, undone), never the wire blocks; later turns are told in one line on the wire (`[Done in this app: …]`, `didOf`) so the model does not offer to do it twice. The system prompt carries "What you can do in this app" (the names and the manners: use one when it does what they asked, never a writing tool unasked, never claim what a tool did not do). Setting: Memory panel → "Let it use the rooms", default on; off, no tool goes out. Privacy panel says what a tool sends. Gate: `test-actions`, `e2e-actions` (Anthropic shape), `e2e-actions2` (OpenAI shape, two providers).

**T-3 ✅ The part that no longer fits is summarised, not simply dropped** (`lib/recap.ts`). `fitToContext` drops whole turns from the front when a thread outgrows the window and says so above the transcript — the honest version of forgetting, and still forgetting: by the fortieth exchange the model no longer knows what is being built, what was decided in turn three, or that it was asked twice not to use bullet points. So the turns that will not be sent are read once by the cheapest keyed model and carried as a record (what is being worked on, what was decided, names/numbers/dates/files, how they want to be answered, what is unfinished — at most 200 words), stored on the conversation with the id of the last message it covers. It is remade only when the drop reaches past that id, and seeded with the previous record so nothing is lost across successive trims; an edit that branches the path invalidates it by id rather than by count. It rides in the turn prompt as `## Earlier in this conversation`, fenced in `<record>` with the same sentence project knowledge gets — a summary of a prompt injection is still a prompt injection. The transcript line changes from "not sent — too long to fit" to "summarised — the thread outgrew one request". A record that cannot be bought (no key, a failed call) leaves the turn exactly as it was. Gate: `test-recap`, `e2e-recap`.

**T-1 ✅** Every tool result enters the prompt as data (`<document>`-style fencing with the "not an instruction" sentence); a tool's own reply is short, factual, and carries ids rather than instructions.

**T-2 ✅ Permission model — act, show, take back.** Chosen over confirm-first: a confirmation on every save is a dialog in the middle of every answer, and the model is only allowed a writing tool when the person asked for the thing it writes. So every action is shown as a chip under the answer with **Open** (to the deck, page, project, canvas or conversation) and **Undo** (this session: the closure lives with the registry; the chip says "undone" afterwards and the record on the message is marked so later turns are not told it exists). Read-only tools run silently and are still shown ("Checked the study room: 3 due"). The model cannot delete anything; only the person can. Network tools stay opt-in per conversation (Research). Cursor run-modes and Claude-in-Chrome "manually approve" were the reference `[R]`; the difference here is that every write is one press from gone.

### 10.2 Agents (multi-step, local)

**A-1 🟡 Plan then execute** (`PHASES.md` Phase 4). For requests that take more than one turn ("make me a revision plan for the next three weeks and the decks for each topic"), the app writes a numbered plan, shows it as a checklist in the row, executes steps with the permission model above, and checks each off. Budget: steps ≤ 12, cost ≤ a per-run cap shown before starting (default $0.50), time ≤ 5 minutes; Stop at any time keeps what is done.

**A-2 ⬜ Task state object** (§18): `tasks` table with goal, steps[], status, spend; rendered as "Goal / Done / Now / Remaining" in the thread; survives reload.

**A-3 ⬜ Scheduled, local.** "Every morning, make my brief" runs when the app is next opened after the time (no server): a `routines` table with `cron`, `lastRan`, `prompt`; the Shell checks on open. Honest limit stated in the UI: "runs when Armi is open".

**A-4 ✅** Human control everywhere: Stop, undo (30s bar, ⌘Z), edit, delete, export.

---

## 11. Memory

| Kind | Store | Today | Spec |
|---|---|---|---|
| Thread context | messages | ✅ trimmed to window | Summarise older turns on demand (C-7). |
| Project memory | project instructions + files | ✅ | Per-project "remember" toggle (ChatGPT project-only memory `[R]`) ⬜. |
| Saved memories | `memories` table; asked for by the person ("remember that…") or offered by the app | ✅ | Keep the *offer* pattern: the app proposes a memory in a callout; nothing is saved without a press. |
| Learned preferences | settings (name, style, explanation level) | ✅ partial | ⬜ "Explain at IGCSE level" as a standing preference read by Tutor. |
| Router memory | `turns` table (kind × model × outcome) | ✅ | Keep. |
| Study state | cards, studyDays | ✅ | This *is* the learning memory; Tutor reads the weakest topics (§13.7). |

**ME-1 ✅** Settings → Memory lists every memory, editable and deletable, with an off switch; temporary chats read nothing. (Claude's editable entries are the reference `[R]`.)

**ME-2 ⬜** Memories carry a "from" link to the message that produced them, and are cited when used ("from your note on 12 Sep").

---

## 12. Knowledge (projects, files, retrieval)

**K-1 ✅ Budget**: 60,000 tokens of project knowledge per turn (`KNOWLEDGE_BUDGET_TOKENS`); whole files while they fit, in the order added; a file that does not fit is reported on the project page, never cut.

**K-2 ✅ Retrieval when it does not fit** (`lib/retrieve.ts`): BM25 over paragraph chunks from every file; the best piece first, then every file's opening, then the rest by rank, then the pieces either side of hits; gaps marked `[…]`; `excerpts="true"` on the document tag; the model is told a gap is not the end. The query is the last three user turns plus the last answer. Excerpts travel with the turn prompt so the cached prefix stays cacheable.

**K-3 ✅ Injection defence**: documents are fenced as data with an explicit sentence that instructions inside them are part of the document, to be reported, not followed (Anthropic guidance: untrusted content never in the system prompt as instructions; tool results treated with skepticism `[R]`; OWASP LLM01 `[R]`).

**K-4 ✅ File intake**: PDF (text extraction, page numbers kept for citations), text, Markdown, code, images (as attachments). ⬜ OCR for scanned PDFs (browser Tesseract, opt-in, slow but local); table extraction into Markdown tables.

**K-5 ⬜ Project page**: shows each file's size, tokens, "read whole / excerpted last time / did not fit"; a "Test a question" box that shows which excerpts *would* be sent (the retrieval made visible).

**K-6 ⬜ Notebook and Study as knowledge**: a project can include the person's own pages and decks as sources, by reference.

**K-7 ⬜ Web as knowledge** (§10.1): search results and fetched pages enter through the same fence, with their URL as the source name.

---

## 13. Study intelligence

This is the layer where ARMI is meant to be better than the flagships, because it owns the data they do not: the cards, the misses, the pages, the exam.

### 13.1 Cards ✅

| Feature | Today |
|---|---|
| Card types | Basic (front/back), Cloze (`{{c1::word}}`, one hole per card, hidden text rendered as a gap) |
| Scheduler | FSRS-6 (21 default weights), desired retention 0.90, learning steps kept, `stabilitySameDay` clamped, SM-2 decks adopted on first review (`adopt`) |
| Ratings | Again · Hard · Good · Easy (1/2/3/4 keys), interval preview on each button |
| Daily cap | 20 new cards per day (`NEW_PER_DAY`), tracked via `introducedAt` |
| Write mode | Type the answer; the marker (`lib/grade.ts`: normalised, Damerau distance, list-aware, "km/h" stays one answer) suggests a rating, highlighted; the person confirms |
| Cram | Filtered order by weakness regardless of due (`cramOrder`) |
| Streak and history | `studyDays` table (`day` key), streak, per-day counts |
| Import/export | Tab/semicolon text and Anki-style TSV (`parseCards` / `exportCards`) |
| From anywhere | A selection in Notebook or an answer becomes a card in one press |

Anki's 2026 defaults are the benchmark: 90% retention, `1m 10m` steps, 15–25 new/day `[R]`; ARMI matches them and adds the marker.

### 13.2 Cards — specification

| # | Requirement | Spec |
|---|---|---|
| S-1 ⬜ | Image occlusion cards | Draw rectangles over an image (from a photo of notes or a diagram); each rectangle is a card. Stored as `{imageId, rects[]}`; rendered in a srcdoc frame. |
| S-2 ✅ | Reverse cards | "Ask it backwards" mid-session makes a real second card with its own schedule (`makeReverse`, `addReverse`). Refused for a cloze, which has no other direction, and refused where a twin already exists. |
| S-3 ✅ | Card tags and topic | `topic` and `tags[]` on every card, indexed. The writer labels them at the point of writing (`draftCards` asks for a topic per card) because afterwards it is a chore nobody does. Editable per card with a datalist of topics already in use, so two spellings do not become two topics. |
| S-4 ⬜ | Deck options | Per-deck new/day, desired retention (0.80–0.95), learning steps; defaults as today. |
| S-5 ✅ | Leech handling | Eight lapses and the card says so mid-session, with two ways out: take it to the chat to work out whether it is a bad card, or park it a year so it stops costing a slot. Parking is undoable and keeps the history, which is the evidence it was a bad card. |
| S-6 ✅ | Undo last rating | `U` puts the card back exactly as it was — the scheduler is pure, so the way back is the previous row, not a recomputation. Reachable on the end screen too, which is where a mis-press has the least slack. The day's tally stands: you did answer it. |
| S-7 ✅ | Calendar | Twelve weeks of `studyDays` on the Study index, one cell a day shaded by how much was answered. ⬜ Taps open the day's list. |
| S-8 ⬜ | "Cards from this page/chat/file" | A model call that proposes 8–12 cards from a source, each one accept/edit/discard before it exists (NotebookLM makes cards from sources only `[R]`; the accept step is what keeps them honest). |
| S-9 ⬜ | Typed-answer marking for maths | Numeric tolerance and unit awareness (already partly in the marker); LaTeX equality by normalised string. |

### 13.2b Revision pack ✅

**RP-1 ✅** A source (PDF or text) in, four things out, all from one press — "Revision pack" on a Notebook page with a source attached, or "Make a revision pack" in the Study room, which opens a new page in the Notebook waiting for the file and makes the pack the moment it lands. Recipes in `lib/revision.ts`, built on Dunlosky et al. 2013 (practice testing and distributed practice high-utility; summarising, highlighting and rereading low) and Roediger & Karpicke 2006 — see RESEARCH §3b.

| Page | Shape | Why |
|---|---|---|
| `<source> — Knowledge organiser` | Must know (ranked) · Key terms (table) · Formulas and rules · Processes (steps) · Common mistakes · How it is asked (command words + what earns full marks) · Links | The one page to pin up and be quizzed from; the command words are where marks are lost |
| `<source> — Cornell notes` | Per idea: a `Cue \| Notes` table whose cues can be got wrong, a three-sentence summary; then the whole thing in ten lines | Cover the notes and it is a practice test |
| `<source> — Exam questions` | Twelve in three tiers with marks, per-mark scheme, model answer, "where marks are lost" | The testing effect, marked the way the paper marks |
| Deck `<source>` in Study | Cards drafted from the organiser | Distributed practice on the schedule |

**RP-2 ✅** Every page carries verified citations into the source (`lib/cite.ts`); a quotation not found is shown as such. **RP-3 ✅** Any page of a pack offers **Download the pack**: one markdown file, titled for the source, with how to use it on the front, pages in reading order. Print → PDF through the existing paper stylesheet. **RP-4 ✅** Stop leaves the pages already made. Gate: `test-revision`, `e2e-pack`.

### 13.3 The tutoring stance (ARMI Orrery)

The reference behaviour is shared by ChatGPT Study Mode, Gemini Guided Learning and Khanmigo `[R]`: ask what the person already knows, give a hint ladder, check understanding, withhold the final answer until the person has tried, respond to mistakes rather than restating the explanation.

| # | Requirement | Today | Spec |
|---|---|---|---|
| TU-1 | Stance: Tutor withholds the answer; the withheld thing is kept out of the model's context (`isTeaching` strips hints from the turn prompt) | ✅ | Keep. |
| TU-2 | Hint ladder: a hint (where to look) → the first step → the method → the answer, each a press under the last answer in a teaching stance, each sent as the person's own message so the transcript records the level reached | ✅ | ⬜ Count the level reached per question into the attempts log (§13.5) once it exists. |
| TU-3 | Check-for-understanding question after every explanation, with the person's answer marked by the marker | 🟡 | Standard in Tutor; off in other casts. |
| TU-4 | Misconception naming: when a wrong answer matches a known pattern for the topic, the reply names it ("this is the sign error most people make with…") and offers a card | 🟡 | The Practice stance and Tutor's misconceptions brief name them in prose today; ⬜ a `traps` table seeded per subject so the same trap is recognised across sessions. |
| TU-5 | "Give me the answer" always works; Tutor says what it will cost the person ("You will remember it less well; here it is.") and answers | ✅ | Keep. |
| TU-6 | Level register: IGCSE / A-Level / University changes vocabulary and depth; set once (H-1), overridable per thread | ⬜ | — |
| TU-7 | Safety for younger users: no romance/roleplay casts, cautious on self-harm and dieting, never asks for personal details; no age gate needed because nothing is collected, but the copy assumes a teenager may be reading (OpenAI teen safeguards as the reference `[R]`) | 🟡 | Written into the house prompt. |

### 13.4 Homework by photo

Photomath and Lens established the flow: photo → recognise → solve → explain → a similar question `[R]`.

**HP-1 ⬜** Camera/photo attachment in Tutor triggers: (1) transcription of the question shown as editable text ("Is this the question?"), (2) topic identified and shown as a chip, (3) the hint ladder (TU-2) rather than the answer, (4) "Another like it" that asks the writer for an isomorphic question with changed numbers, and (5) "Make a card" of the method. Handwriting goes to a vision-capable writer; the transcription step is what makes it correctable.

### 13.5 Mistake analysis and mastery

**MA-1 ✅ Mastery from the memory model.** `lib/plan.ts` reads every graduated card's chance of recall now from its FSRS stability and aggregates by deck; `topicStats` does the same per *topic*, across every deck a topic appears in — which is the reading that answers "what do I do this evening". A deck is the box somebody filed it in; a topic is the thing being learned, and the two come apart the moment a deck is made from a chapter. Two signals per topic, because neither is enough alone: the model says what is likely forgotten (it can say so about a card never got wrong), and the log says what has actually been got wrong (which the model cannot know about a card answered from a button). Weakest-first, with a Practise button per row. A topic with nothing graduated draws an empty track rather than a full bar: the mean of no cards is 1 by construction, and drawing that would say "you know all of this" about a topic nobody has been asked about once.

**MA-2 ✅ Error log**: every marked answer is stored (`attempts`), right ones included — a log of only failures cannot give a rate. Each row keeps the question and the expected answer in full, so the log reads without the card, plus what was written and the topic. The Study index carries "*n* cards you keep getting wrong · Practise these", ordered by how badly each is going and bounded to 30 days: a mistake you have stopped making is not a mistake.

**MA-3 ✅ Confidence**: an optional "Sure?" before the reveal — before, or it is a memory of a guess rather than a guess. Off by default, because a question in front of every card is a tax on every card. Shown as the two-by-two, drawn as a grid because the shape is the message, with one sentence naming what it says. Sure-and-wrong is the quadrant that costs marks; not-sure-and-right gets its own sentence, because knowing more than you think changes how somebody walks into an exam.

### 13.6 Exam intelligence (Cambridge first)

The exam board's command words have official meanings `[R]`; a good answer to "Describe" that explains causes loses no marks but wastes minutes, and an "Evaluate" without a judgement loses most of them.

| Command word | Means (Cambridge) | ARMI marks for |
|---|---|---|
| Define `[R]` | Give the precise meaning | The definition, terminology exact |
| State / Give / Identify `[K]` | Express in clear terms, briefly | The point, no reasons |
| Describe `[R]` | Main features or points, no reasons | Features/steps; no "because" needed |
| Explain `[R]` | Set out purposes or reasons; "because … therefore" | Causal links |
| Calculate / Determine `[K]` | Work out from given facts, showing working | Method, units, significant figures |
| Compare / Contrast `[K]` | Similarities and/or differences | Both sides named, pairwise |
| Analyse `[R]` | Break down and show relationships between parts | Parts and their relations |
| Discuss / Consider `[K]` | Points for and against; the wider issues | Balance |
| Evaluate / Assess `[R]` | Weigh up and reach a supported conclusion | "However … overall" and a verdict |
| Justify `[K]` | Support a case with evidence | Evidence-to-claim |
| Suggest / Predict `[K]` | Apply knowledge to a new situation | Plausible application |
| Outline / Summarise `[K]` | Main points, brief | Brevity, coverage |
| Sketch / Show `[K]` | A diagram / demonstrate | The figure / the demonstration |

**EX-1 🟡 Exam mode**: a question is read for its command word and marks ("[4]", "(6 marks)") by `lib/exam.ts`; when it carries marks, or the Exam stance is on, the turn prompt tells the model the word's official meaning, what a full answer must contain, and to give exactly that many numbered mark points first, then the model answer, then the invitation to try ✅. ⬜ The marker scoring the person's attempt against those points (levels-of-response for essay subjects); board and level from H-1; other boards as table entries.

**EX-2 ⬜ Past-paper practice**: a project holding a paper PDF and its mark scheme; "Practise question 3" pulls the question by retrieval, hides the mark scheme until the attempt is submitted, then marks. The mark scheme is fenced as data (K-3) so it cannot instruct the marker.

**EX-3 ⬜ Countdown and plan**: the exam date (from the Countdown starter or H-1) drives "Today's plan" (§13.8).

### 13.7 Adaptive practice

**AD-1 ⬜** After a correct Tutor answer, the next question is one band harder; after a wrong one, a targeted explanation then a similar question at the same band (`problems.band`, `traps` already modelled). Bands are per topic, 1–5, stored on the attempt.

### 13.8 Study planning

**SP-1 ⬜ Today's plan**: computed locally each morning — due cards (by deck), the weakest topic's two questions, one page to re-read (least recently opened with the most links), and the countdown; each item is a press that opens the thing. No model call.

**SP-2 ⬜ Sessions**: a 25/5 timer that runs inside Study (the Timer starter's logic reused), logging minutes to `studyDays`; "Start a session" on the plan.

**SP-3 🟡 Learning analytics shown**: built — recall rate over the last 30 days against the 90% the schedule aims for, with one sentence on what to change when it is off; the twelve-week calendar; the streak; the shakiest deck. ⬜ Minutes/day (needs sessions, SP-2) and mastery by topic (needs S-3). No vanity numbers (Duolingo's half-life regression underlies its progress `[R]`; ARMI's FSRS stability is the equivalent and is already stored).

### 13.9 Working through a document (the tutor beside the page)

The thing a person is actually holding — a past paper, a chapter, a worksheet, a photograph of their own working — opened *beside* a conversation rather than swallowed by one. An attachment disappears into the question; here the page stays on screen, the chat sits next to it, and both of you are looking at the same thing.

| # | Requirement | Today | Spec |
|---|---|---|---|
| WD-1 | A PDF, image or text file is taken in, kept whole in the browser, and its pages drawn at a size worth pointing at | ✅ | Keep. 40MB ceiling, said plainly when exceeded. |
| WD-2 | Point at a region — pen, finger or mouse — and that crop is sent as a picture alongside the page's own words, so the model is looking at what you are looking at | ✅ | Keep. Pen pressure is recorded but unused. |
| WD-3 | The engine is chosen by the Tutor cast told there is a picture in this, so it lands on something that can see; where no key is held it says so instead of failing at the send | ✅ | Keep. |
| WD-4 | Where you were is kept: closing and coming back opens the same page | ✅ | Keep. |
| WD-5 | Cards made from a page go to one deck per document, reusing it on later passes (`deckForSource`) rather than leaving two decks with one name | ✅ | Keep. |
| WD-6 | Comforts: arrow keys turn the page (not while typing, not mid-marquee); Escape drops a region drawn by accident; the chat follows the answer and lets go when you scroll up to re-read; a dropped file is taken; a removed document is offered back by name | ✅ | Gate: `e2e-comfort`. |
| WD-7 | Handing the thread on: "Take this into a chat" carries the last answer and which page it was about into the main conversation, where the whole cast is available | ✅ | Keep. |
| WD-8 | Highlights and annotation kept on the page between sessions | ⬜ | The crop is per-question today and forgotten after. Persisting marks needs a `lessonMarks` store. |
| WD-9 | Reading the page aloud, and following along | ⬜ | The prose read-aloud exists in chat; wiring it to a rendered page needs the text layer positioned over the canvas. |

---

**TU-7 ✅ The page is a page.** Pen, highlighter, rubber, undo (⌘Z) and clear in the page's header; strokes carry pressure from every coalesced sample; ink is kept per page (`ink` table, `[lessonId+page]`) and restored on return and after a reload. A finger draws until a pencil has been seen, then scrolls; Safari keeps pen and palm apart.
**TU-8 ✅ The model sees the ink.** With ink on the page the picture sent is the page composited with the strokes; with a region, the region cut from that composite; the prompt says the ink is the person's own working.
**TU-9 ✅ Hint first.** With a region or ink on the page the first chip is "Give me a hint"; the stance asks for a hint before an explanation and a one-line check after one.
**TU-10 ✅ It writes back.** "Why is it wrong?" asks for per-step JSON and draws a numbered ✓/✗ beside each step down the region's edge (aria "Step n: holds / does not hold"); the transcript gets the same as a list. A `> ` quote in any answer about the current page is a press that finds the words (pdf.js positions, `pageLayout`/`findQuote`) and lights them on the page; a quote the page lacks says so.
**TU-11 ✅ Make from this.** Study guide · Questions · Summary → Notebook pages named "<document> — <kind>"; Cards → the document's deck. Gate: `e2e-ink`.

## 14. Notebook

| Feature | Today | Spec |
|---|---|---|
| Pages: Markdown, title, pinned, preview, search | ✅ | Keep. |
| Wiki-links `[[Title]]`, `[[Title|shown]]`, new page from a dead link, backlinks section | ✅ | ⬜ Unlinked mentions ("3 pages mention this title") with one-press linking. |
| Tags `#topic` anywhere, counts on the index, filter | ✅ | ⬜ Tag page (all pages, cards and canvases with the tag). |
| Outline (headings) with jump; reading time | ✅ | Keep. |
| Templates: Cornell, lecture, revision summary, lab, essay plan | ✅ | ⬜ Subject templates seeded from H-1. |
| Selection actions: Ask about this · Make a card · Explain · Rewrite | ✅ | ⬜ "Turn into questions" (3 questions from the selection, each to Study). |
| Ask your notebook: retrieval over all pages, citations checked, "?" for a quote not found, keep as a page | ✅ | ⬜ Scope chips: All pages · this tag · pinned; ⬜ answer streaming. |
| Sources on a page: PDFs/text attached to a page with page-level citations | ✅ (`sources`) | ⬜ Highlights: a citation press highlights the span in the source pane (exists for text; add PDF page render). |
| Version history per page | ⬜ | Keep the last 50 saves (`noteVersions`), diff view reusing `DiffView`. |
| Handwriting / pencil | ⬜ | Out of scope in the browser until a canvas starter can do it; the Whiteboard starter saves as a picture, which Vision can read. |

---

## 15. Artifacts (the Code room) and canvases

### 15.1 Model ✅

A **canvas** is `{id, kind: "web" | "doc" | "code", title, files[], versions[], conversationId?, projectId?}`; a web canvas is a folder of files (`canvasFiles`, ordered) rendered in a sandboxed `srcdoc` iframe with no origin, no network and no storage; every save is a version (`canvasVersions`); the preview offers phone / tablet / desktop widths; "Download" writes one self-contained HTML file; "Open files" imports a folder.

### 15.2 The build loop (Forge)

The reference loop is Lovable's: every change is a version, preview full-screen, diff per version, restore, publish `[R]`; Claude Artifacts adds publishing to a URL `[R]`; Cursor adds checkpoints before significant changes `[R]`.

| # | Requirement | Today | Spec |
|---|---|---|---|
| AR-1 | Describe → built and running beside the thread; "make the back bigger" edits in place | ✅ | Keep. |
| AR-2 | Versions list with restore and a diff (`DiffView`) | ✅ | Add "compare any two". |
| AR-3 | Preview widths; console piped out of the sandboxed frame (errors, warnings, logs, repeats collapsed), opening itself on the first error, each line pointing at the file and line | ✅ | Keep. |
| AR-4 | Self-heal: the frame posts `error`/`unhandledrejection` to the parent; "Fix this" on an error sends the error and the file to the writer and comes back as a diff; a kept fix that still throws is asked for again on its own, twice at most, then the app stops and says so | ✅ | The build-loop feature the flagships have and local apps do not `[R]`; every round is still a diff the person keeps or rejects. |
| AR-5 | Download as one HTML; ⬜ download as a zip of files; ⬜ "Copy share link" is *not* offered (no server) — instead "Save to Downloads" and a sentence on hosting it anywhere | 🟡 | — |
| AR-6 | Data in built apps: a canvas may `postMessage` a `save` with a JSON blob that the app stores under the canvas id (`canvasData`), and receives it on load — so a flashcard app remembers its deck without storage access | ⬜ | Bounded 1 MB; never executed. |
| AR-7 | Starter kits (ten today: Flashcards, Timetable, Quiz, Checklist, Timer, Mind map, Board, Countdown, Whiteboard, Graph), each opening running with a half-written instruction | ✅ | ⬜ Add: Sheet (a small spreadsheet with formulas), Slides (a deck from Markdown), Form (a survey that saves via AR-6), Diagram (Mermaid editor). |
| AR-8 | Explain this code / line comments on request | 🟡 | Row action on any code block. |
| AR-9 | Security: `srcdoc` sandbox without `allow-same-origin`; no external scripts unless the person allows CDN imports for that canvas (a per-canvas switch, default off); CSP note in `next.config.ts` | ✅ (sandbox) | ⬜ The CDN switch. |
| AR-10 | Print/PDF of a doc canvas | ✅ print styles | Keep. |

---

## 16. Creative

Creative is the front door for making, not a room with its own viewer (§15 owns viewing). ✅ Composer tuned for making, six ideas, ten starters, "Anything else".

**CR-1 ⬜** Ideas rotate from the person's own material when it exists: "A quiz from your Cell biology page", "A countdown to your Paper 4".

**CR-2 ⬜** "Make from…" picker: a page, a deck, a project file or a chat as the material for a starter (a Quiz from a deck, a Timetable from a plan in a chat).

---

## 17. Settings

| Panel | Fields today ✅ | Add ⬜ |
|---|---|---|
| **Model** | Default Armi model; Auto explanation; effort default; per-preset engines (`resolveCast`) shown as Armi names only | "Prefer cheaper when the difference is small" toggle; per-provider "avoid" switch. |
| **API keys** | One row per provider: status (set on the server / stored in this browser / not set), a "Get a key" link, test the connection, and — once saved — the key masked to its prefix and last four with Test, Replace and Remove. A secret is never drawn in full after it is stored ✅ | Key health (last success/failure); a warning if a key is pasted into chat. |
| **Memory** | List, edit, delete, off switch; forget everything; forget turns | "From" links (ME-2). |
| **Appearance** | Theme light/dark/system; density; your name | Font choice incl. dyslexia-friendly; text size; reduce motion override; code theme. |
| **Data** | Spend (this month by Armi model, since the start); Save a copy (JSON backup, keys excluded); Bring back; Delete everything with inline confirm | Storage meter (`navigator.storage.estimate()`), persisted status ("kept" / "may be cleared"), export a single conversation/page/deck, scheduled backup reminder (every 30 days, dismissible). |
| **Keyboard shortcuts** | Full list (`SHORTCUT_GROUPS`) | Rebinding is out of scope. |
| **Study** ⬜ | — | Desired retention, new/day, learning steps (S-4); level register (TU-6); exam board and date (EX-1/3). |
| **Answer header** ✅ | The Armi mark, the model's name, and — on hover, or always on touch — the latency and token count. The router's reason sits on its own line beneath, whole and wrapping; it is never truncated, because what it says (a second company checked this, this went round twice, the engine it wanted was unavailable) is the app's transparency claim rather than decoration. Gate: `e2e-cast`, `e2e-presets`. | — |
| **Active row** ✅ | A tinted fill and a filled bullet. No third marker: the vertical bar at `left-0` sat outside the pill's radius and read as a stray line. | — |
| **Tone** ✅ | Appearance → Tone: Cool (the app's blue-grey neutrals) or Warm (a paper: the same lightness step for step with a yellow-brown undertone; accents, charts and status unchanged). `data-tone` on the root, set before first paint. | — |
| **Thinking** ✅ | Appearance → Thinking: a line to press (default) or open by itself under the answer. | Per-model default. |
| **Learn** ✅ | A mode of the thread, beside Research in the composer and in the + menu: on the first turn asks level and prior knowledge, lays out a 3–6 step plan, then one step at a time with one checking question after each, adapts on a partial answer, never hands over a working answer unasked, says "Step n of m done". Stamped on the thread at creation when pressed first; toggled on an existing thread. `/study` turns it on. | Quiz cards from a finished plan. |
| **+ menu** ✅ | Named "Add files and tools". Attach first, then Learn and Research, each with a one-line description and a tick when it is on — the same mark the model picker puts against the chosen model. Tools are chosen here and nowhere else. | Compare, Temporary. |
| **Only what it can run** ✅ | The model menu lists an Armi model only when this browser's keys can actually run it — `canRun(id, where)`, which tests the hard requirements (today: a tactic that has to look at a picture needs a model that can see), not the soft ones. A short cast is not hidden: substitution is legitimate, and the row and the line under the menu already say "one company" or "needs a second key". What is selected is never hidden, or the composer would name a model the menu denies. What is hidden is counted at the foot of the list — "N more appear when you add another key" — because a menu that silently grows is a menu nobody knows to grow. With no key at all nothing is hidden and every row says "No key configured yet". As the registry stands, all four companies carry a model that can see, so one key of any of them runs every Armi model and nothing is hidden. Gate: `test-presets`. | Soft shortfalls as a filter you can turn on. |
| **Which API a model is asked on** ✅ | A `wire` field in the registry, beside `thinks`, because it is the same kind of fact. Every OpenAI model carries `wire: "responses"` and goes to `/v1/responses`; Anthropic has its own adapter; Moonshot and DeepSeek borrow OpenAI's *format* and stay on `/chat/completions`, which is the only endpoint they have. The reason is not taste: OpenAI's reasoning models refuse a request carrying function tools and an effort together on chat/completions, and this app sends its rooms as tools on nearly every turn, so the whole provider answered nothing until it moved. The move also buys the thing chat/completions never sent — a streamed summary of the model's thinking. The other remedy OpenAI names, effort `none`, was refused: it buys tools back by turning the thinking off without telling anybody, on a model chosen for thinking. Gate: `test-wire`, `test-responses`, `e2e-cast`, `e2e-actions2`. | Web search on that endpoint (`canSearch` is still Anthropic-only). |
| **The ground** ✅ | Dark is a near-black, not a blue-black. Measured in OKLCH against the three it is compared with: ChatGPT and Material carry 0.000 chroma, Gemini 0.002, Claude 0.004 — ARMI carried **0.024**, and 0.029 under the mesh. The lightness ramp is unchanged step for step and the hue is unchanged; the chroma is cut to a sixth, landing at 0.004 — Claude's amount, on the cool side. Every text pair moves by under 0.2%. The mesh is kept at half strength, as the one thing none of the three has. Warm tone is unaffected and remains the Claude-family choice. Gate: `contrast`, `theme-parity`, `depth`, `test-tokens`. | — |
| **`--marker`** ✅ | A yellow, reserved for the highlighter and nothing else: the Study ink highlighter (`INK.hi`, carried as a literal because a canvas cannot read a custom property) and the passage the model points at on a page — which was drawn in the signal cyan, making a sentence it had merely read look pressable. Never text, never a state, never a fifth accent. The one token identical in both themes, because the paper under it is white in both. Ink on a 0.38 wash reads 15.1. | Marker in the Notebook's own highlighting. |
| **A turn that will not die on one key** ✅ | When a company refuses for a reason that is about the company rather than the question (`provider_down`, `rate_limit`, `quota`, `bad_key`), the turn is carried to another one — each company once, up to three hops, whoever has already refused travelling with the ask so a hop cannot land back where it started (`wellOnly` hands the whole bench back when everyone is ailing, which is exactly when that would happen). The row under the answer says every step: "Anthropic is out of credit · OpenAI was rate-limiting a moment ago". The company is then stepped around for ten minutes (`noteFailure`), so later turns start somewhere that works. A context-length error or a content filter is **not** carried anywhere — those fail the same way at the next company and would only spend a second key. Compare does not fail over at all, by design: it is the same question put to two named models, and quietly swapping one for another company destroys the thing being compared. Gate: `test-route`, `test-health`, `e2e-elsewhere`. | Failover in the Study tutor, which calls `complete` directly. |
| **One-shot calls fail like chat does** ✅ | `complete` is the path every room but chat uses — titles, cards, revision packs, canvas revisions, the tutor, the deck. It discarded the provider's classified error (`return null`), so nine rooms answered a spent key with "Nothing usable came back — try saying it differently" and fifteen catch blocks answered it with "check the key and the connection". It now raises `Refused` carrying the `ChatError`; `whyItFailed(err, fallback)` is what every room prints, and the fallback can never paint over a real reason. Before raising, `complete` walks the bench itself — same `worthMoving` kinds, same `elsewhere`, same three hops, same health note — and `onMoved` tells the room so a page from a substituted model is never silent. Gate: `test-refuse`, `test-error`, `test-route`. | — |
| **The hider, and search** ✅ | The switch that hides the panel is **not on the panel**: it was a control drawn on the thing it hides, which then needed a second copy in the rail for when it had worked, and two controls with one job teaches people that neither is the real one. It sits in the bar beside the model, one control, same square of screen open or closed, saying Hide or Show. Search is a round button in the panel's header (labelled "Find a conversation", distinct from the field's own name) that reveals the box and focuses it; Escape closes it **and clears the query**, because a filter left running behind a shut box is a list missing rows for a reason nobody can see. Gate: `e2e-plugins`, `shell`, `touch`. | — |
| **The touch floor covers width too** ✅ | `.tap` pinned `min-height: 2.75rem` on a coarse pointer and nothing else. Tailwind's spacing scale is multiplied by `--density`, so a control written `size-11` is 44 at comfortable and **33 at compact** — invisible on a row, which is wider than 44 whatever the density, and exactly wrong on a square control, where width has no other floor. The round search button shipped 33×44 on a compact phone and `touch` caught it. `min-width: 2.75rem` now sits beside the height. | — |
| **The shell** ✅ | On `md` and up the sidebar is a panel inset 8px from three edges, `rounded-xl`, lifted, with no border welded to the viewport; flush on a phone. Rows are 44 tall (Apple's touch floor, and what the reference measures at), icons 20, label 15, padding 12. Order follows the serial-position effect rather than build history — Conversations, **Study**, Notebook, Projects, Creative, **Library** — so the two strong seats hold the room every session starts in and the room people go looking for, instead of Study sitting fourth of six, the weakest position in a list. Gate: `touch`, `reach`, `widths`, `theme-parity`. | Rail ordering to match. |
| **Library** ✅ | One list of everything made — pages (Notebook), decks (Study), documents, code files and web apps (canvases) — newest first across kinds, with a `Kinds` chip row (All · Pages · Decks · Documents · Code · Apps; only kinds that exist get a chip). Each row carries a kind mark before its title, a prose preview (`plainLine`), and meta (kind · project · when); decks show cards and due. Opening a row goes to the room that edits it (`openFromLibrary`: page → Notebook, deck → Study, canvas → editor). Delete offers undo per kind. Creation stays in the rooms; the Starters make canvases and "New document" makes a doc. `LibraryView` is its own chunk and renders for section `code` while no canvas is open; `CanvasView` keeps the editor. Gate: `e2e-rooms` (a page is listed beside documents, chips narrow both ways, opening a page lands in the Notebook), `e2e-canvas`. Formerly Artifacts, and Code before that. "Code" sent everyone who was not a programmer straight past a room holding decks, timetables and trackers; "Artifacts" is a word this industry uses and nobody else does. "Library" is what a person calls the place their own things are kept. Same room, same `Section` id (`code`), so nothing stored is migrated. | Absorb pages, decks and revision packs so there is one place for everything made, not two. |
| **A preview is prose** ✅ | `plainLine` strips headings, list markers, quotes, links, emphasis and HTML, and now also **tables** and **wiki-links** — the two that most often start a page made here. A revision timetable previewed as `| Day | Subject | |---|---| | Mon | Biology |`, which is a preview of the file format rather than of a timetable; it reads across as `Day · Subject · Mon · Biology`. A page linking another kept its brackets; `[[a]]` and `[[a|b]]` now show the words. And the joining is no longer a bare space: lines that were separate things (a heading, a bullet, a table row) join with a dot, while a hard-wrapped paragraph still joins with a space, because inserting punctuation into somebody's sentence is the opposite fault. Gate: `test-plain`, `e2e-rooms`. | — |
| **A count is not a control** ✅ | Deck badges ("2 due") and folder counts wore `--highlight` — a filled cyan pill with a brighter cyan edge, which is the exact treatment every pressable control wears, so the eye stopped on each looking for something to do. They are `.badge-count` now: the raised surface, a hairline, secondary ink, tabular figures. The signal colour goes back to meaning "this does something", which is the only way it means anything. | — |
| **A silent provider is not a dead connection** ✅ | `/api/chat` sends an SSE comment frame the instant the stream opens and one every ten seconds while the upstream is quiet. Seen on a revision pack from a 988-page book: a large source on a reasoning model sits for a while before its first event, and everything between the browser and the model — the edge runtime's first-byte deadline, a proxy's idle timeout — treats a silent stream as dead, so the client saw a stream that ended without `done` and said "The connection ended before the answer did." Every parser in the app already skips comment frames. The message now names the likely cause and the thing to do. Gate: `e2e-stall` (time to first byte under 1.5s against a mock that holds its first event for 4s; the answer still finishes). | — |
| **The Notebook's bar** ✅ | Was seven chips over two rows with a source attached, three without. Now the primary press stays out — Revision pack with a source, Tighten without — and the rest sit behind one `More` menu (`NoteMenu`), each with a line of what it does, in the same shape as the composer's + menu so the rooms teach one habit. The `Shortcuts` group survives for the probes that count it. Gate: `e2e-pack`, `e2e-comfort`, `e2e-bar`, `e2e-phone`. | Same treatment for any room whose bar grows past three chips. |
| **Tool chips** ✅ | The composer shows a chip only while a tool is *on*, carrying its name and an ×; pressing it turns the tool off. Off, the composer says nothing about it. | — |
| **Dark saturation** ✅ | Dark accents sit ~20 points below their light counterparts (accent 58%, signal 44%, CTA 46%), each holding its lightness so measured contrast and theme parity are unchanged. Gate: `contrast`, `theme-parity`. | — |
| **Rules** ✅ | Eleven presets as switches (hints before answers, check I followed, exam standard, plain words, keep it short, one example every time, no preamble, ask before guessing, say when unsure, quote what you relied on, British English), grouped by what they change; a box for your own lines, one a line; the count of what is in force. Sent as a "## Your rules" bullet list after the house rules and before a project's, in chat, compare and the tutor; the composer shows "N rules" while you type, a press from the panel. Gate: `e2e-rules`. | Per-room rules; rules a project overrides. |
| **Privacy** ✅ | Its own panel: what is stored in this browser, what leaves and to whom, what happens to your keys, what the app never does, and how to be rid of all of it — including the honest half, that a question you ask does leave, to the company whose key you added | Keep in step with the README. |

---

## 18. Data model (Dexie, `lib/db.ts`, database `clouds`, version 13 today)

| Table | Key fields (index) | Purpose | Status |
|---|---|---|---|
| `conversations` | id, updatedAt, pinned, archived, projectId · title, systemPrompt, temporary, leafId, inputTokens, outputTokens, costUsd | Threads | ✅ |
| `messages` | id, conversationId, parentId, createdAt · role, content[], reasoning, modelId, presetId, routedWhy, usage{inputTokens, outputTokens, costUsd, cached?}, latencyMs, ttftMs, stopReason, error, canvasId, rating, verdict | Tree of turns | ✅ (⬜ add `role` index for cheap scans) |
| `turns` | id, messageId, at, [kind+modelId] · outcome | Router memory | ✅ |
| `projects` | id, updatedAt · name, description, instructions | Folders | ✅ |
| `projectFiles` | id, projectId, createdAt · name, mimeType, text, size, pages? | Knowledge | ✅ |
| `styles` | id, updatedAt · name, instructions | Registers | ✅ |
| `memories` | id, createdAt · text, fromMessageId? | Saved memories | ✅ (⬜ `fromMessageId`) |
| `notes` | id, updatedAt, pinned · title, content | Pages | ✅ |
| `sources` | id, noteId, addedAt · name, text, pages?, size | Page attachments | ✅ |
| `decks` | id, updatedAt, sourceNoteId · name, options? | Decks | ✅ (⬜ `options`) |
| `cards` | id, deckId, due, [deckId+due] · front, back, cloze?, state, stability, difficulty, reps, lapses, lastReview, introducedAt, topic?, tags?, reverseOf?, leech? | Cards | ✅ (⬜ topic, tags, reverseOf, leech) |
| `studyDays` | day · reviews, newCards, minutes? | Streak/heatmap | ✅ (⬜ minutes) |
| `attempts` ⬜, `traps` ⬜ | id, conversationId, messageId, createdAt · question, answer, verdict?, hintLevel?, topic? / id, topic · pattern, name | Attempts and misconceptions for §13.5 (an earlier schema had `skills/traps/problems/attempts`; they were dropped in v6 and are to be redesigned, not revived) | ⬜ |
| `canvases`, `canvasFiles`, `canvasVersions` | id, updatedAt, kind, projectId · [canvasId+order], [canvasId+name], [canvasId+createdAt] | Artifacts | ✅ |
| `canvasData` ⬜ | canvasId · json (≤ 1 MB) | Built-app state (AR-6) | ⬜ |
| `noteVersions` ⬜ | id, noteId, createdAt · content | Page history | ⬜ |
| `tasks` ⬜ | id, conversationId, createdAt · goal, steps[], status, spendUsd | Agent state (A-2) | ⬜ |
| `routines` ⬜ | id · prompt, cron, lastRan | Local schedules (A-3) | ⬜ |
| `papers` (legacy v2) | — | superseded by canvases | keep migration only |

**D-1 ✅ Backup** = one JSON with every table except keys; restore merges by id and reports added/skipped; `BackupError` for a bad file.
**D-2 ✅ Persistence**: `navigator.storage.persist()` requested on first create.
**D-3 ⬜ Sync**: out of scope for v1; the backup file is the transfer. If added later: end-to-end encrypted blob in a folder the person owns (Drive/iCloud via the File System Access API), never an ARMI server.
**D-4 ⬜ Storage meter** in Settings → Data with the biggest items (attachments) and a "remove pictures older than…" action.

---

## 19. Backend, wire and shell

### 19.1 What runs where

| Piece | Where | Notes |
|---|---|---|
| App | Static Next.js pages + client components, served by Vercel | No database, no accounts. |
| `/api/chat` | Edge route: forwards to the provider, streams SSE, aborts upstream on client abort, classifies errors | Server key wins when set; otherwise the client's key travels in the body over HTTPS and is never logged. |
| `/api/models`, `/api/test-key` | Edge | Registry and key check. |
| Service worker | `public/sw.js` | Network-first page, cache-first hashed build, refresh-behind fonts/icons; never `/api/`; production only; not under automation. |
| Headers | `next.config.ts` | nosniff, `X-Frame-Options: DENY`, referrer policy, permissions policy (mic only), no-cache on the worker script. |

### 19.2 Streaming contract ✅
SSE events: `text`, `reasoning`, `usage`, `done{stopReason}`, `error{ChatError}`; the client drains at animation-frame rate; time-to-first-token recorded; a `refusal` stop reason ⬜ becomes a callout.

### 19.3 Retries ✅
One automatic retry: rate limit (wait = provider's `retry-after`, capped 20 s), overloaded/5xx, timeout, connection failure — only when nothing has arrived, never for a request the route refused; the wait is visible ("Retrying · 2s") and cancellable; a cancelled wait releases the composer. SDK defaults are 2 retries with backoff `[R]`; one is chosen so a hard limit is never hammered.

### 19.4 Error copy (classified at the adapter, never a raw string) ✅

| Kind | Sentence | Action |
|---|---|---|
| no_key | "No {provider} key yet. Add one to use this model." | Add key |
| bad_key | "{provider} rejected your API key." | Add key |
| rate_limit | "{provider} is rate-limiting your key right now." | Retry (automatic once) |
| quota | "Your {provider} account is out of credit." | Switch model — but reached only when there is nowhere left to carry the turn. Recognised by its words at any status, because the four disagree: Anthropic says it with a **400** and an `invalid_request_error`, DeepSeek with a **402**, Moonshot with a **401** that otherwise reads exactly like a rejected key, and only OpenAI uses 429. Classified by status alone it fell to `unknown`, which is not remembered, not failed over, and shown by quoting the provider's prose — so a spent key was a dead end on every turn while other keys sat unused. "Billing" alone does not count: a provider naming its billing page while refusing something else is not out of credit. |
| context_length | "This conversation is too long for the model's context window." | Shorten |
| content_filter | "{provider} declined to answer this one." | Switch model |
| unsupported_content | "This model can't read the attachments in this conversation." | Switch model |
| provider_down | "{provider} is having trouble on their end." | Switch model (after one automatic retry) |
| network | "Couldn't reach {provider}. Check the connection — this did not look like a key problem." | Retry |
| timeout | "{provider} took too long to respond." | Retry |
| unknown | "{provider} refused the request: {one quoted line}" | Retry |

*"{provider}" is the company name in an error only, because the person pasted that company's key; it never names a model.*

### 19.5 Offline ✅
Rooms work from IndexedDB; the Shell shows "Offline. Cards, pages and canvases still work; asking a model needs the connection." in a live region; Send is disabled with the same reason.

---

## 20. Security, privacy, safety

### 20.1 Threats and controls (OWASP LLM Top 10 2025 `[R]`)

| Threat | Control | Status |
|---|---|---|
| LLM01 Prompt injection via documents, pages, tool results, web | Data fencing + explicit non-instruction sentence (K-3); no tool may delete; network tools confirm every time (T-2) | ✅ / ⬜ tools |
| LLM02 Sensitive information disclosure | Keys never in prompts, never in backups, never in logs; a pasted key in the composer is warned about (⬜) | ✅ / ⬜ |
| LLM05 Improper output handling | No raw HTML from the model in prose; executables only in sandboxed srcdoc frames without same-origin | ✅ |
| LLM06 Excessive agency | Permission levels (T-2); step/cost/time budgets (A-1) | ⬜ |
| LLM07 System prompt leakage | Nothing secret in the system prompt by design; the house prompt is public in the repo | ✅ |
| LLM08 Vector/embedding weaknesses | No vector store; BM25 over the person's own files only | ✅ |
| LLM09 Misinformation | Casts (brief/check), citations verified against sources, "Armi can be wrong" line (⬜), marker for study answers | ✅ / ⬜ |
| LLM10 Unbounded consumption | Knowledge budget, context fitting, one retry, cost on every row, spend panel, per-run cap for agents (⬜) | ✅ / ⬜ |
| Key theft via XSS | nosniff, frame denial, no third-party scripts on the app origin; CSP deferred because srcdoc inherits it (documented) | ✅ |
| Malicious files | Text extraction only; images as data URLs; no file executed; PDFs parsed with a pure-JS parser | ✅ |

### 20.2 Privacy statement (to appear in Settings → Privacy ⬜ and README ✅)

- Stored: conversations, pages, cards, canvases, projects, memories, settings, spend — in this browser's IndexedDB and localStorage.
- Leaves the browser: only the request to the provider whose key you added, through the app's forwarding route, which does not store it.
- Never: analytics, accounts, telemetry, model training on your content.
- Delete: Settings → Data → Delete everything; or clear site data. Backups are yours.

### 20.3 Safety
House prompt rules: no medical/financial/legal certainty, no self-harm methods, no sexual content, no romance roleplay, age-appropriate register; the provider's own safety layer is honoured and a refusal is shown as such, never retried automatically.

---

## 21. Reliability and performance budgets

| Measure | Budget | How it is checked |
|---|---|---|
| Time to first token | ≤ provider latency + 150 ms of app overhead | `ttftMs` on the message; median shown in Settings → Data ⬜ |
| First paint (cached) | ≤ 1.0 s on a mid phone | Lighthouse in the gate ⬜ |
| Interaction to next paint | ≤ 200 ms while streaming | `drain` at animation frame ✅ |
| Retrieval | ≤ 50 ms for 300k characters | `test-retrieve` timing ⬜ |
| Study rating → next card | ≤ 100 ms | probe `e2e-study` |
| Crash | Never a white screen: `CrashNet` boundary with "Reload" and "Save a copy first" | ✅ |
| Data loss | Never: writes are transactional; undo for deletes; backup reminder | ✅ / ⬜ reminder |

---

## 22. Observability and cost (local)

**O-1 ✅** Every message carries model, preset, routed-why, tokens, cost, latency, TTFT, stop reason. **O-2 ✅** Spend by month and Armi model in Settings. **O-3 ⬜** A "Diagnostics" sheet (Settings → Data) with the last 20 requests: kind, model, tokens, cached tokens, latency, outcome — copyable for a bug report, with keys and content omitted. **O-4 ⬜** Monthly budget: a number in Settings; at 80% the composer shows a quiet line; at 100% Auto prefers the cheapest current model and says so. **O-5 ⬜** Cost per task, not per request: an agent run reports its whole spend.

---

## 23. Quality: the gate, evals, versioning

### 23.1 The gate ✅ (`gate.sh`, 79 checks)
Unit suites (route, web, task, error, lint, predict, rows, lang, mode, turns, decide, compute, register, presets, wire, callout, study, grade, retrieve, memory, voice, built, fuzz, cite) → one-provider e2e probes (chat, error, study, notebook, project, sources, canvas, makes, compare, verify, voice, backup, crash, keys…) → measured (audit, contrast, touch, theme-parity, type-scale, shell, keys, reach, widths, overlap, print, depth, shoot-smoke) → two-provider e2e → slow mock → rate-limit retry. Push only on `all passed`.

### 23.2 Evals ⬜ (PHASES Phase 6, "a golden set")
A fixed set, run against the mock for structure and against real keys for quality, scored the same way each time:

| Set | Size | Scores |
|---|---|---|
| Routing | 60 requests → expected task kind, cast, effort | exact match |
| Citations | 40 questions over 10 documents | quote found on page; page correct |
| Marker | 200 typed answers with gold ratings | agreement ≥ 0.9 |
| Tutor stance | 30 questions | withheld until attempt; hint ladder order; answer on demand |
| Command words | 26 questions × 13 words | structure matches the word |
| Injection | 25 documents with embedded instructions | none followed; reported |
| Builds | 15 requests | canvas runs without console error; instruction followed |

Run on every prompt or registry change; a regression blocks the push like a failing probe.

### 23.3 Versioning ⬜
Prompt versions (`HOUSE`, mode prompts, stances) get a hash stored on each message (`promptVersion`) so "which prompt produced this" is answerable; registry changes are commits; the DB schema is Dexie-versioned; the eval set is in the repo.

---

## 24. Roadmap (what to build next, in order)

| Order | Work | Why first | Sections |
|---|---|---|---|
| 1 | ~~Self-heal loop for canvases~~ (AR-3/4) — done | The one build-loop feature that separates a toy from a tool | 15 |
| 2 | **Tutor hint ladder ✅, check questions, exam mode 🟡** (TU-2/3, EX-1) | The education difference | 13 |
| 3 | **Topic mastery ✅, mistakes log ✅, confidence ✅, today's plan ⬜** (MA-1/2/3, SP-1) | Turns study data into direction | 13 |
| 4 | **Global search 🟡 (palette covers all rooms) + deep links** (IA-3/4) | Four rooms need one door | 3 |
| 5 | **Permission model + plan-then-execute + tasks table** (T-2, A-1/2) | Agents, safely, locally | 10, 18 |
| 6 | **Cards from a source with accept/edit** (S-8), image occlusion (S-1) | The two card features people ask for | 13 |
| 7 | **Wire upgrades**: adaptive thinking, mid-conversation system messages, refusal handling, cache read display (MR-3) | Cheaper and faster on current models | 9 |
| 8 | **Sources strip in chat, read aloud, retry menu, selection actions** (M-4/8/16/17) | Conversation parity with the flagships | 7 |
| 9 | **Golden set evals + prompt versioning** (§23) | Stops quality drifting | 23 |
| 10 | **Settings: Study, Privacy, storage meter, backup reminder, budget** | Fundamentals people notice later | 17, 22 |
| 11 | **Web search/fetch as opt-in tools** (K-7) | Current information, fenced | 10, 12 |
| 12 | **Starters: Sheet, Slides, Form, Diagram; Mermaid and charts inline** (AR-7, §8) | Breadth of what can be made | 8, 15 |

Rules that hold across all of it are in `PHASES.md` → "Rules that hold across all of it"; this document adds one: **a feature ships with its probe or its unit test, and with its status mark updated here.**

---

## 25. Sources

Flagship assistants (composer, memory, projects, agents, voice, routing, pricing): OpenAI help centre (projects, memory, voice, file uploads, release notes, study mode, age prediction), Anthropic support (memory, voice, model/effort settings, RAG for projects, Chrome permissions), Google (Gemini app redesign, Guided Learning, Temporary chats, Canvas, Double-check), Perplexity help centre (models, tasks), Microsoft support (conversation modes, deep research retirement), Kimi help, DeepSeek docs — as gathered on 2026-09-16; third-party trackers used where a vendor page could not be fetched are marked unverified in the research notes.

Education: OpenAI "Introducing study mode" and Study Mode FAQ; Google "Guided Learning" blog and LearnLM; Khan Academy / Khanmigo 2026 dashboard reporting; Anki manual (FSRS, deck options) and fsrs4anki tutorial; Duolingo half-life regression (Settles & Meeder, ACL 2016); Quizlet Learn 2026; NotebookLM student features; Photomath / Google Lens Homework; Cambridge International command words (Tutopiya and MarkScheme summaries of the official definitions).

Build tools: Lovable docs (version history, publish), Cursor docs (checkpoints, run modes, background agents), Claude Code artifacts docs, ChatGPT writing/code blocks help page.

Local-first: TypingMind docs (keys in local storage, static app), Open WebUI and LibreChat comparisons.

Trust and quality: OWASP Top 10 for LLM Applications 2025; Anthropic "Mitigate jailbreaks and prompt injections" and "Mitigating the risk of prompt injections in browser use"; WCAG 2.2 (SC 2.5.8, 2.4.11, 2.5.7); Apple HIG Generative AI / Machine Learning; NN/g AI chat research summaries; OpenAI age prediction and teen safeguards; the Claude API reference (thinking, effort, caching, mid-conversation system messages, refusal stop reason, retries) as bundled in the developer skill on 2026-09-16.
