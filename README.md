# Armi

One interface for Claude, GPT, Gemini and DeepSeek — plus the notes,
flashcards and printable papers that come out of talking to them. You bring the
API keys.

Built against [`prompts/MASTER_PROMPT.md`](prompts/MASTER_PROMPT.md), which is the
design and engineering brief this repository implements. Where the code departs from
the brief, [Known gaps](#known-gaps) says so.

---

## Running it

```bash
npm install
cp .env.example .env.local     # optional — see "Keys" below
npm run dev                    # http://localhost:3000
```

Nothing is required to start. With no keys configured the app runs, remembers
conversations, and tells you what it needs instead of failing silently.

## Keys

Two paths, and the difference is stated in the UI rather than buried here:

- **`.env.local` on the server** — the browser never sees the key. Preferred.
- **Settings → API keys** — stored in that browser only, sent to *your* server,
  which forwards it to the provider. For deployments where you don't control env.

Server keys always win. Keys are never logged, never put in a URL, and never sent
anywhere except the provider they belong to. Settings has a **Test** button that
makes a real one-token call and reports the round trip, so a green dot means
something.

## What's here

**Conversation** — streaming with stop (which keeps the partial answer), regenerate,
edit-a-message-to-fork, sibling navigation `‹ 2/3 ›`, per-conversation drafts that
survive switching away mid-sentence, pin, rename, delete, full-text search across
message bodies, Markdown export, auto-generated titles.

**Rendering** — GFM markdown, KaTeX math, tables that scroll inside their own
container, and code blocks with a language label, optional filename, wrap toggle,
download, collapse past 60 lines, line numbers past 12, diff tinting with a gutter
glyph, and a copy button that works mid-stream and never captures a line number.

**Models** — all four providers behind one adapter interface, a `⌘/` picker with
context window, price and capability chips, per-model parameters, mid-conversation
switching, regenerate-with-a-different-model, and models without a key dimmed with a
reason rather than hidden. Each provider carries a small geometric mark, so which
engine answered is legible before you start reading.

**Compare** — send one prompt to up to three models at once. They stream in parallel
columns, each on its own clock, and "Keep this one" points the conversation at the
answer you chose. The other two are not discarded: they stay under `‹ 2/3 ›`.

**Side panel** — any code block over 24 lines can be lifted into its own column. The
copy left in the thread collapses to a one-line reference, so a 900-line answer stops
burying the conversation that produced it.

**Projects** — a place with a memory. Standing instructions that go out with every
chat started inside it, and material those chats can see without being pasted in
again. The knowledge has a meter, and the meter is honest: files are fitted whole,
in the order they were added, and one that does not fit is shown greyed with
"over the limit" rather than quietly truncated — half a document is worse than
none, because the model reads the cut as the end and answers confidently about a
spec that stops mid-sentence. Deleting a project does not delete its chats; they
come out of the folder and stay. Undo puts them back inside it.

**Styles** — Normal, Concise, Explanatory, Formal, Learning, and any you write.
A style changes the *shape* of an answer and nothing about what the model knows,
which is why it is a separate control from the system prompt: "you are a tutor for
my thermodynamics course" and "keep it short" should not be edited, forgotten and
lost together. Normal carries no instructions at all — a style that says "be
balanced and natural" makes the model self-conscious about being balanced and
natural, which reads as neither. Custom styles start from a built-in you can read
rather than from a blank box titled Instructions.

Everything a chat is told before your first word is assembled in one place and in
one order — your instructions, then the project and its material, then the style.
Style last because it is the only layer that governs form, and a "keep it short"
that arrives before three pages of project knowledge is one the model has stopped
thinking about by the time it answers. It also makes the whole block a stable
prefix, which is what the provider's cache is for.

**Canvas** — a document you and the model both write to. It comes in three
shapes, and the shape is the first thing you pick, not a setting you go looking
for: a **document**, a **code file**, or a **web app**.

A web app is a folder — `index.html`, `style.css`, `app.js` — running in a frame
beside the editor. The preview resolves the page's own `<link href>` and
`<script src>` against the other files and inlines them, so what you write is a
real page that would work if you saved the folder, rather than three panes whose
relationship only exists inside this app.

Its console comes back out. An error inside a sandboxed frame is otherwise
invisible — no devtools panel points at it, and "it just doesn't work" with
nothing on screen is where people give up — so logs, warnings, uncaught errors
and unhandled rejections are piped to a drawer under the preview, with the error
count on the button so you do not have to open it to know. And the line numbers
are translated: the browser only ever sees the assembled document, so "line 76"
is mapped back to `app.js:2`. A number that looks like a line number and is not
is worse than no number, because people go to line 76 of the file they are in and
find something innocent there.

The frame is sandboxed with `allow-scripts` and no `allow-same-origin`, so the
page runs on an opaque origin: it executes its own code and reaches nothing of
this app's — not the conversations, not the keys, not storage. That is tested,
not asserted: `e2e-web.mjs` reads `window.origin` inside the frame and confirms
`localStorage` throws.

**Five one-press edits** — Add comments, Add logs, Fix bugs, Port to…, Explain.
Taken from ChatGPT's canvas, which settled on exactly this set, because they are
the things people ask for over and over and typing "add comments explaining what
each function does" for the hundredth time is the app failing to notice a
pattern. A document gets its own four instead: Tighten, Proofread, Add structure,
Explain — "Add logs" means nothing in prose. Every one of them lands as a diff
you keep or discard, except Explain, which never touches the file: a shortcut
that sometimes edits and sometimes does not is one nobody trusts with either.

Every accepted change is a version, and so is the state it replaced, so reverting
is always possible even when the first edit came from the model. History is per
file. Reverting writes a *new* version rather than deleting the ones after it,
because an undo that destroys history is how you lose the thing you were trying
to get back to.

**Look** — taken from the object the brand is: a fountain pen on cream paper.
Paper (`#f7f3ea`) is the ground — ivory, not white and not yellow. Ink (`#1a2650`)
is the words: a saturated navy, the colour a good blue ink dries to, and the only
colour most of a screen is ever made of. Gold (`#d4af5a`) is the nib — a jewel,
never a surface: the dot on the i, a badge, the tip of the caret, the edge of the
ring while an answer is arriving. Leather (`#8a4b1d`) is the desk: warmth in the
field behind everything, and the colour of *thinking*, a state that is warm and
slow rather than electric.

Two blues for two jobs, and the difference is the grammar of the interface: royal
(`#3450b5`) is *structure* — links, focus, the active row — and the deep ink
(`#1f2d66`) is *action*, the one control on a screen you are meant to press. You
write with the ink. Gold on paper cannot carry text at 4.5:1 at any value that
also holds a 3:1 edge, so gold is never asked to; it is a detail, which is what a
nib is.

Dark is a rotation, not an inversion: the ink becomes the ground and the paper
becomes the words — a page written in white on the navy the pen is filled with.
The one thing that changes hands is the action colour. On paper the action is the
ink; in the dark the ink is everywhere, so the action is the nib, gold at its true
value, lit, with the navy on top. It is the same pen either way. Every pair is
computed, not eyeballed: `node contrast.mjs` checks 28 text/background pairs in
both themes on every change.

**Type** — four faces, self-hosted from `/fonts`, latin subsets, one file per
weight, 240 KB in all. Inter for the interface and body. Cormorant Garamond for
the greeting and anywhere the words are the subject — a Garamond, because the
register that goes with a pen on deckle paper is a book, not a dashboard, and
Claude's own product makes the same split. Pinyon Script for the name and nothing
else: a copperplate script is a signature, and a signature that appears more than
once a screen is a watermark. JetBrains Mono for code. Inter had been *named* in
the font stack for a year and never served, so every screenshot in this repo, and
the app for anyone without it installed, was actually DejaVu Sans. A font you name
but do not ship is a wish.

**The mark** — the word in the ink, in a hand, with the dot on the i in gold,
which is where the pen lifts. Once per screen at most. The app icon is the initial
in the same hand on the navy, with the same gold dot.

**Thinking** — one motif wherever the model is running: a ring of field energy that
turns, and a hairline that travels the width of whatever is live. It says *running*
without claiming to know how much longer, which a progress bar would, and would be
lying about. The streaming caret runs the two purple steps, deep at its base to
light at its tip; the composer border joins the same event, so where you type and
where text appears are visibly one thing. Under `prefers-reduced-motion` the ring stops turning and the line
stops travelling, but both stay visible — reduced motion still needs the state to be
legible.

**Navigation** — the sidebar belongs to conversations: New chat, search, then the
history. Projects, Code, Notes, Cards, Papers and Practice sit above that as destinations,
separated by a hairline, each opening as its own page with its own index in the main
column. Taking the chat list away to show a note list would cost more than it buys.

**Notes** — markdown documents, edited in place, searched by body as well as title.
Keep any answer from a chat with one click, or the whole conversation. Titles derive
themselves from the first heading, so nothing is ever called "Untitled" that says what
it is in its first line.

**Flashcards** — turn a note or a conversation into a deck, then review it on the
SM-2 schedule that Anki and SuperMemo use: four grades, each showing the interval it
will actually produce, and a lapse that returns in ten minutes rather than tomorrow.
Space reveals, `1`–`4` grade, and the sidebar carries the only number that decides
whether you open a deck at all — how many are due.

**Practice** — the section the rest of the app could not do: it puts a question in
front of you that you will get wrong for a reason it can name.

The scheduled unit is not a topic, it is a *trap* — one named wrong move
("keeps the original limits after substituting"), carrying its own forgetting
curve. A topic averages over four mistakes decaying at four different rates,
which loses exactly the information worth having. Paste a note or a worked
example, and the model proposes four to six traps with the sentence you will see
the moment you make each one; you throw away the ones that aren't yours before
anything is written. Then problems are generated to catch one trap each — cloze
and numeric only, never multiple choice, because recognition puts the answer on
screen before every attempt and is defeatable by elimination.

Answers are checked locally, so being right or wrong never waits on a network
call. A miss shows the trap's own sentence and the first step, and lets you retry
in place — but it still grades as a miss, because the retry is the correction,
not a second chance. Grades are derived from what happened, never chosen and
never timed. The queue interleaves, so no two problems in a row share a trap:
blocked practice feels better and teaches less, since after the first you are
applying a rule you were just told rather than deciding which rule applies.

**Papers** — a printable document built from the same markdown. Report, essay or
notes shapes; a title, subtitle and author set on the sheet itself; "Draft it" to have
a model write it from your material; and Print / PDF to export.

**The blank page** — a greeting that knows what time it is and, once you have
said so, what you are called. It asks once, inline, after the keys are in, and
never as a modal. A name is the cheapest thing an interface can know about you and
the one that changes the most about how it reads back; it stays in the browser and
is never sent to a model.

**The rest** — command palette (`⌘K`), keyboard operation throughout, light/dark with
no flash, three densities, *Continue* on any answer that ran out of room, and
every empty and error state written rather than defaulted.

## How it's put together

```
app/
  api/chat/        SSE proxy. Keys resolve server-side; abort propagates upstream.
  api/models/      Which providers the server can answer for. Never sends a key.
  api/test-key/    One-token round trip for the Test button.
  globals.css      Every token in the app, plus the print stylesheet.
lib/
  providers/       One adapter per provider, one normalized event stream.
  hooks/useStream  The streaming controller and the reveal buffer.
  db.ts            Dexie. The message tree, notes, decks, cards, papers.
  study.ts         SM-2 scheduling.
  generate.ts      One-shot generation: titles, flashcards, paper drafts.
  store.ts         Settings, section, drafts — persisted.
components/        Sidebar and the four section views.
components/chat/   Composer, message list, code blocks, compare, dialogs.
```

Three decisions carry most of the weight:

**Messages form a tree.** Every message has a `parentId`; the UI renders one path
through it and reaches the rest by sibling navigation. Editing and regenerating add
branches. Nothing is ever destroyed. This is the one thing that cannot be retrofitted
later without a rewrite.

**Tokens are revealed on a rAF buffer.** Providers emit in ragged bursts — forty
characters, 300ms of nothing, then a hundred. Rendered raw, that reads as stuttering,
and stuttering reads as slow. Arriving text goes into a buffer that a rAF loop drains
proportionally to its backlog. Same finish time, considerably faster to watch.

**Errors are classified at the adapter boundary.** Each provider fails in its own
dialect; `classifyError` turns all of them into one sentence plus one action
(`retry`, `add_key`, `switch_model`, `shorten`). No raw provider string reaches the
interface — including Google's habit of reporting a bad key as a 400.

Comparison falls out of the tree almost for free: each column writes against the same
parent, so the three answers are siblings before anyone chooses between them.

**PDF export is the browser's print pipeline, not a library.** It already hyphenates,
breaks pages, embeds fonts and honours the user's paper size, and it hands them a file
they chose the name and location for. `@media print` in `globals.css` is therefore the
actual renderer: it strips the application, forces a light document whatever theme the
user reads in, turns the fixed-height flex shell into one continuous flow, and applies
the conventions that only exist on paper — orphans and widows, no page break after a
heading, and link URLs printed in full.

## Verified

- `npm run build` and `tsc --noEmit` clean; no `any`, TypeScript strict.
- First Load JS **203 kB** for the app route, under the 250 kB budget. The markdown
  pipeline (micromark, GFM, KaTeX) is a separate chunk, and Shiki grammars load per
  language on demand.
- All four adapters exercised against their live APIs with a deliberately invalid
  key: each returns a correctly classified `bad_key` through the SSE stream, and a
  provider with no key returns `no_key` before any request is made.
- Rendered and screenshotted in light and dark at 1440×900 and at 390×844.
- The canvas driven end to end (`e2e-canvas.mjs`): a revision proposed, shown as a
  diff with the right counts, refused entry to the database until accepted, recorded
  as two versions, reverted without losing the newer one, and a preview confirmed to
  run its own scripts on an opaque origin.
- The web canvas driven end to end (`e2e-web.mjs`): the folder runs, the `<link>`
  and `<script>` resolve against the other files, clicking a button in the
  preview counts, a `console.log` and an uncaught `ReferenceError` come back out
  with the error mapped to `app.js:2`, and `window.origin` inside the frame is
  `null` with `localStorage` throwing `SecurityError`.
- Projects and styles verified **at the wire** (`e2e-project.mjs`): the browser is
  driven, then the mock provider is asked what system prompt it actually received —
  the project's instructions, its knowledge wrapped one `<document>` per file, and
  the chosen style last. A test that asks the app what it believes it sent proves
  nothing.
- A shipping bug the production build had been hiding: the CSS minifier replaced
  the standard `backdrop-filter` with the `-webkit-` alias alone, and in a browser
  that has the property but not the alias every frosted surface in the app — the
  sidebar, the top bar, every popover and dialog — rendered as a 74%-transparent
  panel with no blur, which you could read the page straight through. It only
  happened in the built CSS, so nothing in dev would ever have shown it. `audit.mjs`
  now reads the computed value so it cannot come back.
- Every control in every section measured on a phone (`touch.mjs`), not sampled: the
  earlier check only covered the chat composer, which is where the icon buttons
  already met 44pt — while the navigation you go through to reach anything was 32.
- Compare mode driven end to end in a real browser: three columns mount, each opens
  its own request, and each renders its own classified failure independently.
- The side panel opens from a code block, collapses the inline copy to a reference,
  and closes on Escape.
- Notes, decks and papers all seeded and driven in a browser; the print layout was
  captured through Chromium's print media emulation rather than assumed.
- Highlighting confirmed to run in a real Web Worker (counted at construction, not
  assumed), producing 240 themed spans on a 40-line block.
- Three bugs found by measuring rather than by looking, all of them cascade problems:
  unlayered `button`/`input` rules were overriding every Tailwind text-size utility,
  because unlayered CSS beats every `@layer`; the `pop-in` keyframe ended on
  `transform: none`, which would erase the translate that centres a dialog; and the
  field background's `body > * { position: relative }` was overriding `position: fixed`
  on every portalled dialog, leaving each one anchored halfway down the page. The
  first moved into `@layer base`, the second now animates the independent `scale`
  property, and the third became background layers on `body` with no DOM at all.

## Known gaps

Stated plainly, because a checklist you cannot trust is worse than no checklist.

- **No successful call to a real provider has been observed.** No valid key was
  available in this environment. Every *failure* path was exercised against the
  real APIs — Anthropic and Google both answered and were classified correctly.
  The success path is covered by `e2e.mjs`, which runs the whole app against a
  mock speaking Anthropic's documented SSE format: streaming, markdown,
  highlighting, usage, cost, titling, persistence and branching all verified.
  What remains unproven is only that the real API's bytes match its own docs.
- **No true virtualization.** Every turn carries `content-visibility: auto` with an
  intrinsic size, so the browser skips layout and paint for anything off-screen —
  most of the benefit, without breaking find-in-page, text selection across messages,
  or scroll restoration. A conversation in the thousands of messages would still want
  real windowing.
- **Flashcard and paper generation has not been run against a real model.** The
  prompts, the JSON extraction (which tolerates fences and surrounding prose)
  and the failure messages are written, and the transport underneath them is
  now proven by `e2e.mjs`; what has not been observed is a real model's *output*
  flowing through the extraction.
- **No page numbers in the PDF.** Chrome does not support content in `@page` margin
  boxes, so numbering would mean shipping a layout engine. The browser's own print
  dialog can add headers and footers.
- **No cross-deck statistics.** There is a single "everything due today" queue, but
  no history of what you reviewed, no retention curve, and no notion of a daily new-card
  limit — all of which a serious reviewer eventually wants.
- **Screen-reader testing was not run.** Semantics, live regions, labels and focus
  order are implemented to spec and every control is confirmed to carry an
  accessible name (`node audit.mjs`), but nothing has been driven with VoiceOver.
- **Not an App Store app.** The interface is built to Apple's Human Interface
  Guidelines — 44pt targets on coarse pointers, safe-area insets under
  `viewport-fit=cover`, no zoom-on-focus, reduced-motion and forced-colors
  support, a manifest so it installs to the Home Screen as a standalone app.
  That is design conformance. Shipping to the App Store is a different question:
  it needs a native container, and Apple rejects thin web wrappers under
  guideline 4.2, so it would need to earn its place as an app rather than be one
  by packaging.

## Checks

Four scripts, each measuring rather than asserting — they read the live DOM and
the computed tokens, so they cannot drift from what ships. Run the app first.

```bash
node audit.mjs        # Apple HIG: safe areas, zoom, names, focus, contrast mode
node contrast.mjs     # every text/background pair the app renders, against WCAG
node touch.mjs        # every control in every section on a phone, against 44pt
node shoot-smoke.mjs  # every section loads, undo works, no runtime errors
```

And the end-to-end run, which needs the app pointed at the mock provider:

```bash
node mock-provider.mjs &
ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100 &
node e2e.mjs         # 15 assertions across the whole happy path
node e2e-canvas.mjs  # 25 assertions: edit, revise, diff, keep, revert, sandbox
node e2e-project.mjs # 21 assertions: projects and styles, read at the wire
node e2e-web.mjs     # 26 assertions: a web app runs, and its console comes back
node test-context.mjs  # context fitting and cache breakpoints, read at the wire
node test-fit.mjs      # a 360k-token thread trimmed to fit and answered
MOCK_RATE_LIMIT=1 …    # restart the mock this way, then: node test-retry.mjs
```

## What the app does to make answers better

Three things happen between pressing enter and the provider seeing the request.

**The thread is trimmed to fit.** Past the context window a provider answers
with an error, which is the worst available outcome — the conversation still
exists and the model could still answer. Older turns are dropped from the
front, whole messages only, with room reserved for the reply, and the last
message never dropped. What was left out is stated above the transcript rather
than hidden: an assistant that quietly forgets the first half of a
conversation and carries on is far more disorienting than one that says so.

**Long prefixes are cached.** Every turn re-sends everything before it, so by
the tenth exchange the same opening has been paid for and re-read ten times.
A cache breakpoint on the second-to-last message lets Anthropic keep the
prefix; later turns reuse it at a tenth of the price and skip re-reading it.
It only engages once the prefix is big enough to pay back the 25% a cache
write costs. Cached reads and writes are priced into the running cost, so the
number on screen stays true.

**A rate limit is waited out, once.** The provider usually says exactly how
long. Surfacing that as an error to click through turns a two-second wait into
a manual step at the moment someone is already annoyed. Once — not until it
works, because retrying a hard limit in a loop is how an account gets
throttled harder. Stop cancels the wait.

## Pointing at something other than the real API

Each provider's host is overridable, because plenty of deployments do not talk
to the real one directly — Azure fronts OpenAI, LiteLLM and OpenRouter front
everything, companies put a gateway in the middle for logging and spend
control, and a local model wants an OpenAI-shaped endpoint on its own machine.

```
ANTHROPIC_BASE_URL=https://gateway.internal/anthropic
OPENAI_BASE_URL=https://my-azure.openai.azure.com/openai/deployments/gpt-5
GOOGLE_BASE_URL=...
DEEPSEEK_BASE_URL=...
```

Unset, each falls back to the provider's own API.
