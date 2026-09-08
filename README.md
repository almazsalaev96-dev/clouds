# Clouds

One calm interface for Claude, GPT, Gemini and DeepSeek. You bring the API keys.

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
switching, and models without a key dimmed with a reason rather than hidden.

**The rest** — command palette (`⌘K`), keyboard operation throughout, light/dark with
no flash, three densities, and every empty and error state written rather than
defaulted.

## How it's put together

```
app/
  api/chat/        SSE proxy. Keys resolve server-side; abort propagates upstream.
  api/models/      Which providers the server can answer for. Never sends a key.
  api/test-key/    One-token round trip for the Test button.
  globals.css      Every token in the app. Nothing else hardcodes a value.
lib/
  providers/       One adapter per provider, one normalized event stream.
  hooks/useStream  The streaming controller and the reveal buffer.
  db.ts            Dexie. The message tree, path resolution, branching.
  store.ts         Settings and drafts, persisted.
components/chat/   Sidebar, composer, message list, code blocks, dialogs.
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

## Verified

- `npm run build` and `tsc --noEmit` clean; no `any`, TypeScript strict.
- First Load JS **203 kB** for the app route, under the 250 kB budget. The markdown
  pipeline (micromark, GFM, KaTeX) is a separate chunk, and Shiki grammars load per
  language on demand.
- All four adapters exercised against their live APIs with a deliberately invalid
  key: each returns a correctly classified `bad_key` through the SSE stream, and a
  provider with no key returns `no_key` before any request is made.
- Rendered and screenshotted in light and dark at 1440×900 and at 390×844.

## Known gaps

Stated plainly, because a checklist you cannot trust is worse than no checklist.

- **The happy path is untested against a live provider.** No valid key was available
  in this environment. Every failure path was exercised end to end; token streaming
  was not.
- **Shiki runs on the main thread**, not in a Web Worker as the brief calls for. It
  never runs *during* a stream — blocks stay plain monospace until 60ms after the
  last token — so the streaming frame budget is unaffected either way. Moving it is
  contained behind `lib/highlighter.ts`.
- **No virtualization yet.** Conversations past a few hundred messages will render
  every node. The brief puts this at ~80 messages; it belongs in the next pass.
- **No artifact/right-hand panel.** Long outputs render inline. The layout reserves
  the column for it.
- **No side-by-side model comparison.** The adapter layer supports it; the UI
  doesn't yet.
- **Screen-reader testing was not run.** Semantics, live regions, labels and focus
  order are implemented to spec but verified by inspection, not with VoiceOver.
