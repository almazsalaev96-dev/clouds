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
| Name | **Armi** (wordmark "Armı" in Pinyon Script in the corner) ✅ | Keep. "ARMI" in caps only for the model family ("ARMI One"). |
| Icon | `icon.svg` + `apple-icon.png` ✅ | ⬜ Add maskable 512×512 PNG to the manifest for Android install prompts. |
| Palette | Paper `#f7f3ea` light, ink `#1a1917` dark; one accent; semantic danger/success/highlight tokens ✅ | Keep. Every new colour is a token in `globals.css`, never a literal. |
| Type | Inter (UI), Pinyon Script (signature), tabular numerals via `.tnum` ✅ | ⬜ Add an OpenDyslexic / Atkinson Hyperlegible option under Appearance (Claude.ai ships a dyslexic font toggle `[R]`). |
| Voice | Plain, short, second person, no exclamation marks; copy explains why, not just what ✅ | Codify in §2.1. |
| AI personality | Per Armi model (Tutor withholds, Forge builds, Council argues) ✅ | Keep personality in the cast's stance, never in a global "friendly" prompt. |
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

**Rule IA-4 ⬜ Global search** (`Ctrl/⌘ K` already opens the command palette): one box that searches conversations, pages, cards, canvases and project files; results grouped by room, each row showing the matching line; filters by room and date. The leading products all search only conversations `[R]`; the four-room store is the reason to do better.

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
| Colour | `--bg`, `--surface`, `--subtle`, `--line`, `--line-strong`, `--primary`, `--secondary`, `--tertiary`, `--faint`, `--accent`, `--accent-2`, `--accent-subtle`, `--danger`, `--success`, `--highlight`, `--highlight-edge`, `--highlight-fg` | Both themes define every token; `data-theme` is always concrete (system resolved before first paint). |
| Space / radius | Tailwind scale × density multiplier; `rounded-md/lg/xl` | Density: comfortable / compact multiplies paddings, so every target is re-measured (gate: `touch`). |
| Type | `--measure` (reading width), `--measure-wide` (code), type scale (gate: `type-scale`) | Body 15–16px; code 13px; headings ≤ 1.75rem. |
| Motion | `--dur-fast`, `--dur-enter`, `--ease-out` | `prefers-reduced-motion` collapses to opacity only. |
| Controls | `--ctl` (control size), `.tap` (44pt floor), `.btn-touch` | Any new interactive element uses `.tap` or `.ctl`. |
| Glass | `.glass` (backdrop blur surface) | Sticky headers, toasts, composer. |

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

Today: no wizard. The home strip shows what is waiting across rooms (cards due, pages, things made) and the composer is focused. Keys are asked for at the first send, not before. This matches the best practice (Gemini's 2026 redesign removed chips for one greeting `[R]`; onboarding as a form is the anti-pattern).

**H-1 ⬜ Three-question first run**, skippable, one screen, never a form:
1. "What are you working towards?" — chips: IGCSE · A-Level · University · Something else (sets the default study register and exam intelligence, §13.6).
2. "Which subjects?" — free text with suggestions (seeds Notebook templates and Study decks).
3. "Add a key when you are ready" — one line explaining keys stay in this browser, with a "Later" that is the same size as "Add key".

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
| C-7 | Context meter: a thin bar under the box when the thread passes 60% of the model's window, with "Summarise older turns" | ⬜ | `fitToContext` exists; the meter surfaces it. |
| C-8 | Attachments strip: thumbnails, remove, size, "will be read as text" for PDFs | ✅ | Add page count for PDFs. |
| C-9 | Slash commands: `/study`, `/build`, `/compare`, `/check`, `/temp` | ⬜ | Typed prefixes map to the same intents the router already reads (ChatGPT `@study` `[R]`). |
| C-10 | Ideas row under the box on an empty thread (six requests, sent as they are) | ✅ Creative; 🟡 chat | Chat gets a rotating set from the person's own weak topics when Study has data. |
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
│ Armi One · "chose Quant: the question is numeric" · 1.8s · $0.004 │
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
| M-4 | Retry ▾: same model · another Armi model · "with more effort" | 🟡 Retry ✅ | Add the menu. |
| M-5 | Check with another: a second cast member reads the answer and returns a verdict rendered under it (agree / disagree with the line) | ✅ (`check`, `turns`) | Keep; add "Ask both to argue" (duel) as a row action. |
| M-6 | Rate ▲▼ feeds the router's memory of pairings (`pastFor`) | ✅ | Keep. |
| M-7 | Copy: plain text, or Markdown with the "Copy as Markdown" modifier | 🟡 | Add the modifier. |
| M-8 | Read aloud with the browser voice; highlight the sentence being read; Stop | ⬜ | Browser `speechSynthesis`; no network. |
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

Armi models today: **One** (the default: a strong writer with a brief and a check), **Flash** (fast, cheap, no parts), **Quant** (numbers; a checker that re-derives), **Council** (three companies, one synthesis), **Orbit** (long context), **Forge** (builds things; canvas mode), **Vision** (pictures), **Tutor** (withholds the answer; §13.3), **Lingua** (languages), **Studio** (writing), **Duet** (two answers, one judge). Auto chooses among current models by the plan (`lib/decide.ts`).

### 7.3 Temporary chat ✅
Nothing saved, no memory read or written, no title call, marked with a ghost icon in the header; the composer says so. (Claude Incognito / ChatGPT Temporary `[R]`.)

---

## 8. Response rendering

| Block | Today | Spec |
|---|---|---|
| Prose, headings, lists, quotes | ✅ Markdown | Keep house style: prose by default, lists when the content is a list. |
| Code: fenced, highlighted (shiki), Copy, language label, wrap toggle | ✅ | ⬜ "Open in Artifacts" for HTML/JS blocks; "Run" for the sandbox-able kinds (HTML, JS, SVG) — renders in a srcdoc frame beside. |
| Math: KaTeX inline and display | ✅ | Keep; copy as LaTeX on click. |
| Tables | ✅ | ⬜ Sortable header, "Copy as CSV", "Open as sheet" (a canvas starter). |
| Diagrams: Mermaid | ⬜ | Render in a srcdoc frame; fallback to the source block if it fails. |
| Charts | 🟡 Graph starter | ⬜ A ```chart fence (JSON series) renders a small SVG chart inline; "Open in Graph" hands it to the starter. |
| Images returned by the model | n/a (no image generation) | Out of scope; images in are supported. |
| Citations `[[cite: source | quote]]` | ✅ Notebook/sources | Unify for chat (M-16); a quote that cannot be found on the page is marked "?" — never dropped, never passed off (`lib/cite.ts`). |
| Canvas card: a built thing beside the thread with Preview / Code / Files / Versions | ✅ | Keep (§15). |
| Callouts: "Cut short by a safety filter", "Stopped", "Answered again after a second model objected" | ✅ | Keep. |
| Footer line under every answer: "Armi can be wrong. Check what matters." | ⬜ | Every flagship shows one `[R]`; keep it to one line, tertiary colour. |

**R-1 ✅** All rendering of model output is untrusted: no raw HTML in prose, links get `rel="noopener"`, srcdoc frames for anything executable.

---

## 9. Models, casts and routing

### 9.1 Registry (`lib/models.ts`) ✅

Twenty-four models across four providers, each with: `id`, `provider`, `name` (never shown), `contextWindow`, `maxOutput`, `priceIn/priceOut`, `vision`, `reasoning`, `thinks: "effort" | "budget"`, `legacy`, `speed/quality` traits for the router. Default `claude-sonnet-5`.

**MR-1 ✅** Auto and the checker choose only among non-legacy models; explicit Economy/Fast presets may use legacy ones on purpose.

**MR-2 ✅ Wire rules per model** (tested in `test-wire.ts`): effort-style models get `output_config.effort` and no sampling params; budget-style models get `thinking: {type:"enabled", budget_tokens}` and low effort sends no thinking at all.

**MR-3 ⬜ Current wire shapes to adopt** (from the provider reference, September 2026 `[R]`):
- Anthropic current models: `thinking: {type: "adaptive", display: "summarized"}` (so reasoning streams instead of a long pause) + `output_config.effort`; `budget_tokens` only on Haiku-class models.
- Anthropic Opus 5 / Fable: **mid-conversation system messages** (`{role:"system"}` inside `messages`) for the per-turn prompt so the cached prefix survives; not on Sonnet 5, so keep the current two-block system for it.
- Anthropic: `stop_reason: "refusal"` handled as a callout ("Declined by the provider's safety layer") with Switch model; opt into server-side fallbacks where the provider offers them.
- Cache: `cache_control` on the stable system block and on the last message; 1h TTL for project knowledge blocks; verify `cache_read_input_tokens > 0` in the usage meter (show "cached" on the row when it is).

**MR-4 ✅ Router inputs** (`lib/decide.ts`, `lib/route.ts`): task kind, wants-a-thing, difficulty, modality (images?), context size, cost tier, speed need, provider availability (keys present), user preference (explicit preset wins), past outcomes for this pairing (`pastFor`).

**MR-5 ⬜ Fallback within the cast.** When the writer's provider returns `provider_down` twice, the turn is re-sent to the cast's next-best writer from another company, and the routed-why line says so. Today the app retries once and then shows Switch model.

**MR-6 ⬜ Model health.** A per-provider "last failure" timestamp (in memory) so Auto avoids a provider that failed in the last two minutes.

**MR-7 ✅ Effort honoured**: preset effort overrides the model default; user override overrides the preset (`paramsSet`).

### 9.2 Routing table (the rules, in order)

| Rule | Condition | Result |
|---|---|---|
| 1 | Explicit Armi model chosen | Use its cast; Auto rules skipped |
| 2 | Attachments include images | Writer must have `vision` |
| 3 | Thread + knowledge > 60% of a candidate's window | Prefer a `long` model; excerpt knowledge (§12) |
| 4 | Task = build (wants a thing) | Forge cast; canvas mode on |
| 5 | Task = numeric / proof | Quant cast (writer with reasoning, checker re-derives) |
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
| `read_notebook(query)` | local BM25 over pages | ✅ (ask-notebook) | Expose as a model tool so a chat can cite pages. |
| `read_project(query)` | local BM25 over project files | ✅ (prompt excerpts) | Same. |
| `calculate(expr)` | local (`lib/compute.ts`) | ✅ | Keep; results quoted as data. |
| `make_card(front, back)` | local write to Study | ✅ via selection | Tool form ⬜ so Tutor can offer "Shall I make a card?" and do it on yes. |
| `build_canvas(files)` | local canvas store | ✅ (Forge) | Keep. |
| `run_canvas_tests()` | srcdoc frame reports console errors back | 🟡 | ⬜ Self-heal loop (§15.4). |
| `web_search(q)` | provider server tool (Anthropic `web_search_20260209` etc.) | ⬜ | Opt-in per conversation; results quoted as data; sources strip (M-16). |
| `fetch_url(url)` | provider server tool | ⬜ | Only URLs the person pasted. |

**T-1 ✅** Every tool result enters the prompt as data (`<document>`-style fencing with the "not an instruction" sentence).

**T-2 ⬜ Permission model** (least privilege, Cursor run-modes and Claude-in-Chrome "manually approve" are the reference `[R]`):

| Level | Applies to | Prompt |
|---|---|---|
| Silent | read-only local tools (notebook, project, calculate) | none; shown in the row as "read 3 pages" |
| Confirm once per thread | write-local tools (make_card, save page) | inline "Make 4 cards? [Make] [Not now]" |
| Confirm every time | network tools (web_search, fetch_url) and anything that spends more than ~$0.10 | inline with the estimated cost |
| Never | deleting anything | the model cannot delete; only the person can |

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
| S-2 ⬜ | Reverse cards | A basic card can generate its reverse as a sibling (`reverseOf`). |
| S-3 ⬜ | Card tags and topic | `topic` (string) and `tags[]` on every card; a deck is a view, a topic is the unit of analytics. |
| S-4 ⬜ | Deck options | Per-deck new/day, desired retention (0.80–0.95), learning steps; defaults as today. |
| S-5 ⬜ | Leech handling | A card failed 8 times is flagged "leech", pulled from the queue, and offered to Tutor: "This one keeps failing — want it explained differently or split?" |
| S-6 ⬜ | Undo last rating | ⌘Z within the session restores the previous state. |
| S-7 ⬜ | Heatmap | Twelve weeks of `studyDays`, cells by reviews; taps open the day's list. |
| S-8 ⬜ | "Cards from this page/chat/file" | A model call that proposes 8–12 cards from a source, each one accept/edit/discard before it exists (NotebookLM makes cards from sources only `[R]`; the accept step is what keeps them honest). |
| S-9 ⬜ | Typed-answer marking for maths | Numeric tolerance and unit awareness (already partly in the marker); LaTeX equality by normalised string. |

### 13.3 The tutoring stance (ARMI Tutor)

The reference behaviour is shared by ChatGPT Study Mode, Gemini Guided Learning and Khanmigo `[R]`: ask what the person already knows, give a hint ladder, check understanding, withhold the final answer until the person has tried, respond to mistakes rather than restating the explanation.

| # | Requirement | Today | Spec |
|---|---|---|---|
| TU-1 | Stance: Tutor withholds the answer; the withheld thing is kept out of the model's context (`isTeaching` strips hints from the turn prompt) | ✅ | Keep. |
| TU-2 | Hint ladder: hint 1 (where to look) → hint 2 (the first step) → hint 3 (the method) → worked answer, each on a press, each recorded | ⬜ | Rendered as a stepped control under the question; the level reached is stored on the attempt (§18 `attempts`). |
| TU-3 | Check-for-understanding question after every explanation, with the person's answer marked by the marker | 🟡 | Standard in Tutor; off in other casts. |
| TU-4 | Misconception naming: when a wrong answer matches a known pattern for the topic, the reply names it ("this is the sign error most people make with…") and offers a card | ⬜ | Patterns come from the `traps` table (already in the schema) seeded per subject. |
| TU-5 | "Give me the answer" always works; Tutor says what it will cost the person ("You will remember it less well; here it is.") and answers | ✅ | Keep. |
| TU-6 | Level register: IGCSE / A-Level / University changes vocabulary and depth; set once (H-1), overridable per thread | ⬜ | — |
| TU-7 | Safety for younger users: no romance/roleplay casts, cautious on self-harm and dieting, never asks for personal details; no age gate needed because nothing is collected, but the copy assumes a teenager may be reading (OpenAI teen safeguards as the reference `[R]`) | 🟡 | Written into the house prompt. |

### 13.4 Homework by photo

Photomath and Lens established the flow: photo → recognise → solve → explain → a similar question `[R]`.

**HP-1 ⬜** Camera/photo attachment in Tutor triggers: (1) transcription of the question shown as editable text ("Is this the question?"), (2) topic identified and shown as a chip, (3) the hint ladder (TU-2) rather than the answer, (4) "Another like it" that asks the writer for an isomorphic question with changed numbers, and (5) "Make a card" of the method. Handwriting goes to a vision-capable writer; the transcription step is what makes it correctable.

### 13.5 Mistake analysis and mastery

**MA-1 ⬜ Topic mastery** from the data that already exists: FSRS stability per card aggregated by `topic` → a 0–1 mastery; attempts on Tutor questions (right/wrong/hint level) → a second signal; the two combined per topic with a simple weighted mean. Shown as a list of topics sorted weakest first, each with "what to do" (review 6 cards · try 2 questions · read your page).

**MA-2 ⬜ Error log**: every wrong write-mode answer and every wrong Tutor answer is stored (`attempts`) with the card/question, the answer given, and the misconception when named; the Study index gets "Mistakes" with a "Practise these" button (cram order from the log).

**MA-3 ⬜ Confidence**: an optional "How sure were you?" (sure / not sure) before revealing; calibration shown as a two-by-two (sure-and-right … not-sure-and-wrong) — the unhelpful quadrant is "sure and wrong".

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

**EX-1 ⬜ Exam mode** in Tutor: the question is parsed for its command word and marks ("[4]"); the reply is structured as an examiner would mark it (one line per mark point), then the model answer; then "Now you" with the marker scoring the person's attempt against the mark points (levels-of-response for essay subjects). Board and level come from H-1; other boards (Edexcel, AQA, IB) are a table entry, not a feature.

**EX-2 ⬜ Past-paper practice**: a project holding a paper PDF and its mark scheme; "Practise question 3" pulls the question by retrieval, hides the mark scheme until the attempt is submitted, then marks. The mark scheme is fenced as data (K-3) so it cannot instruct the marker.

**EX-3 ⬜ Countdown and plan**: the exam date (from the Countdown starter or H-1) drives "Today's plan" (§13.8).

### 13.7 Adaptive practice

**AD-1 ⬜** After a correct Tutor answer, the next question is one band harder; after a wrong one, a targeted explanation then a similar question at the same band (`problems.band`, `traps` already modelled). Bands are per topic, 1–5, stored on the attempt.

### 13.8 Study planning

**SP-1 ⬜ Today's plan**: computed locally each morning — due cards (by deck), the weakest topic's two questions, one page to re-read (least recently opened with the most links), and the countdown; each item is a press that opens the thing. No model call.

**SP-2 ⬜ Sessions**: a 25/5 timer that runs inside Study (the Timer starter's logic reused), logging minutes to `studyDays`; "Start a session" on the plan.

**SP-3 ⬜ Learning analytics shown**: retention (actual recall rate over the last 30 days vs desired 0.90), reviews/day, minutes/day, mastery by topic, streak; each with one sentence saying what it means and what to change. No vanity numbers (Duolingo's half-life regression underlies its progress `[R]`; ARMI's FSRS stability is the equivalent and is already stored).

---

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
| AR-3 | Preview widths; console panel showing the frame's errors | 🟡 widths ✅ | ⬜ Console panel. |
| AR-4 | Self-heal: the frame posts `error`/`unhandledrejection` to the parent; the app offers "Fix it" which sends the error and the file to the writer; loop at most twice, then stop and say so | ⬜ | The single most valuable build-loop feature the flagships have and local apps do not `[R]`. |
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
| **API keys** | One field per provider, test key, show/hide, stored in this browser only, server key wins when the host has one | Key health (last success/failure); "Where do I get one" links; a warning if a key is pasted into chat. |
| **Memory** | List, edit, delete, off switch; forget everything; forget turns | "From" links (ME-2). |
| **Appearance** | Theme light/dark/system; density; your name | Font choice incl. dyslexia-friendly; text size; reduce motion override; code theme. |
| **Data** | Spend (this month by Armi model, since the start); Save a copy (JSON backup, keys excluded); Bring back; Delete everything with inline confirm | Storage meter (`navigator.storage.estimate()`), persisted status ("kept" / "may be cleared"), export a single conversation/page/deck, scheduled backup reminder (every 30 days, dismissible). |
| **Keyboard shortcuts** | Full list (`SHORTCUT_GROUPS`) | Rebinding is out of scope. |
| **Study** ⬜ | — | Desired retention, new/day, learning steps (S-4); level register (TU-6); exam board and date (EX-1/3). |
| **Privacy** ⬜ | (covered by Data copy today) | One page that says what is stored, where, what leaves (only requests to the provider you chose), and how to delete; the same sentences as the README, kept in step. |

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
| `skills`, `traps`, `problems`, `attempts` | per schema v3 | Tutor question bank, misconceptions, attempts (hint level, correct, confidence) | 🟡 schema exists; fill by §13 |
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
| quota | "Your {provider} account is out of credit." | Switch model |
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
| 1 | **Self-heal loop for canvases** (AR-3/4) + console panel | The one build-loop feature that separates a toy from a tool | 15 |
| 2 | **Tutor hint ladder, check questions, exam mode** (TU-2/3, EX-1) | The education difference; schema exists | 13 |
| 3 | **Topic mastery, mistakes log, today's plan** (MA-1/2, SP-1) | Turns study data into direction | 13 |
| 4 | **Global search + deep links** (IA-3/4) | Four rooms need one door | 3 |
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
