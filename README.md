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

**Look** — a Void Navy ground (`#030817`) and one indigo primary, in two steps: the
deep step (`#2F45E0`) fills and holds white text, the light step (`#7D90FF`) is the
same hue raised until it can be read on the navy. Two steps rather than one because no
single value can do both — white needs the fill below `L 0.183` and the navy needs the
text above `L 0.186`, and those thresholds cross. Indigo over azure for two reasons
that are checkable: it holds the widest contrast margin of the families tried, and it
sits furthest in hue from lime and orange, so the signals never read as a shade of the
brand. Then three signals — Acid Lime, Hyper Orange, Signal Red — that never fill anything
larger than a badge, a caret or a 2px rule. That restraint is the palette: a colour
used everywhere stops meaning anything, so lime marks work waiting, orange marks the
model running, and red marks something you cannot undo. Failures get a red rule and a
sentence, not a panel of red.

Two constraints are enforced rather than assumed. The primary's two steps exist because
one value cannot serve both roles, as above. And a signal used as text is not the same value as a
signal used as a fill: light mode darkens lime to `#4C6B00` for type, while the badge
keeps the vivid `#D8FF38` with navy on top. Every pair was computed, not eyeballed;
control borders clear 3:1 against the page, body text 4.5:1, in both themes.

**Thinking** — one motif wherever the model is running: a ring of field energy that
turns, and a hairline that travels the width of whatever is live. It says *running*
without claiming to know how much longer, which a progress bar would, and would be
lying about. The streaming caret runs blue at its base to orange at its tip; the
composer border joins the same event, so where you type and where text appears are
visibly one thing. Under `prefers-reduced-motion` the ring stops turning and the line
stops travelling, but both stay visible — reduced motion still needs the state to be
legible.

**Navigation** — the sidebar belongs to conversations: New chat, search, then the
history. Notes, Cards and Papers sit above that as destinations, separated by a
hairline, each opening as its own page with its own index in the main column. Taking
the chat list away to show a note list would cost more than it buys.

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

**The rest** — command palette (`⌘K`), keyboard operation throughout, light/dark with
no flash, three densities, and every empty and error state written rather than
defaulted.

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
node audit.mjs        # Apple HIG: targets, safe areas, zoom, names, focus, contrast mode
node contrast.mjs     # every text/background pair the app renders, against WCAG
node shoot-smoke.mjs  # every section loads, undo works, no runtime errors
node shoot-touch.mjs  # nothing under 44px on a phone, nothing changed on desktop
```

And the end-to-end run, which needs the app pointed at the mock provider:

```bash
node mock-provider.mjs &
ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100 &
node e2e.mjs         # 15 assertions across the whole happy path
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
