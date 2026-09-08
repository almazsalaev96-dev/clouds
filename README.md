# Astra

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

**Look** — warm near-black rather than neutral grey, so the ground has a faint amber
cast and the two accents read against it as temperature: neo blue is *you can act
here*, orange is *the model is working*. Two very faint pools of colour sit fixed
behind everything, near the threshold of visibility, so the page reads as having depth
rather than being a flat wall. Light mode is the same identity in daylight — warm
paper, the same blue, the same orange — not a second brand.

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

- **The happy path is untested against a live provider.** No valid key was available
  in this environment. Every failure path was exercised end to end; token streaming
  was not.
- **No true virtualization.** Every turn carries `content-visibility: auto` with an
  intrinsic size, so the browser skips layout and paint for anything off-screen —
  most of the benefit, without breaking find-in-page, text selection across messages,
  or scroll restoration. A conversation in the thousands of messages would still want
  real windowing.
- **Flashcard and paper generation is untested against a live model** for the same
  reason as the chat happy path: no valid key here. The prompts, the JSON extraction
  (which tolerates fences and surrounding prose) and the failure messages are written;
  what has not been observed is a real model's output flowing through them.
- **No page numbers in the PDF.** Chrome does not support content in `@page` margin
  boxes, so numbering would mean shipping a layout engine. The browser's own print
  dialog can add headers and footers.
- **No cross-deck statistics.** There is a single "everything due today" queue, but
  no history of what you reviewed, no retention curve, and no notion of a daily new-card
  limit — all of which a serious reviewer eventually wants.
- **Screen-reader testing was not run.** Semantics, live regions, labels and focus
  order are implemented to spec but verified by inspection, not with VoiceOver.
