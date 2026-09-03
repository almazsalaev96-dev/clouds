# Understory

An AI-native personal knowledge, learning, research and work environment.

The product is a **context engine with a conversation attached** — not a chatbot
with attachments. In a chatbot, you assemble context by pasting and uploading.
Here, the system assembles it by understanding what you are working on.

Ships as web and native clients over one server: the server holds the
intelligence, the clients are views onto it.

---

## Running it

```bash
npm install
npm start                # http://localhost:4300
```

No build step. Node 22 runs the TypeScript directly and `node --test` is the
whole test story.

The AI needs a key:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

**Without one, the product still runs** — reading, structure extraction,
search, artifacts, mastery and memory all work, and the interface says plainly
that conversation is unavailable rather than appearing broken.

```bash
npm test          # everything (154 tests)
npm run test:unit # the intelligence core, no network
npm run test:api  # the HTTP API
npm run test:ui   # the real interface, driven in a real browser
```

---

## Layout

```
docs/ARCHITECTURE.md   the design, and every departure from the spec with its reason
docs/shots/            screenshots of the running app

packages/core/         the intelligence — zero runtime dependencies
  context/             the ranker: what the AI knows on any given turn
  documents/           structure extraction with exact character offsets
  knowledge/           BM25 retrieval + graph expansion
  learning/            mastery, mistake patterns, next best action
  memory/              user-controlled memory with provenance
  model/               provider port + task-based routing
  tools/               registry, calculator, search, artifact tools
  orchestrator/        turn execution
  store/               data layer; user scoping is a parameter of the interface

packages/server/       HTTP + SSE; API keys live here and only here
apps/web/              the client — iPad-first, no framework, no build
tools/contrast.js      WCAG verification for the design tokens
```

---

## The parts that carry the weight

**The context ranker** (`packages/core/src/context/`). Context windows are
finite; a corpus is not. Every turn is a ranking problem: which twenty of
eventually fifty thousand things should the model see? Named features, tunable
weights in one file, and two-phase packing with budget floors so a large
document can never evict your selection, your memories, or the conversation
you are in the middle of.

**Citation resolution** (`packages/core/src/context/citations.ts`). "Never
invent citations" cannot be a prompt instruction — prompting is a request, not
a control. Citations are resolved against the retrieved set *and* re-read from
the stored document at their recorded offsets, so a block whose source text has
drifted stops counting as evidence. Anything unresolvable is stripped before
render and the answer is flagged.

**Honest mastery** (`packages/core/src/learning/`). Mastery moves only on
graded attempts, and every estimate carries a confidence, so "not enough
evidence yet" is sayable. With no evidence, next-best-action returns nothing
rather than inventing encouragement.

**Tools that ran or didn't** (`packages/core/src/tools/`). The transcript is
generated from the invocation log, not the model's narration, so "claimed a
calculation it never did" is not a representable state.

---

## What is deliberately not built

Research mode, presentations, projects and tasks, voice, spaced-repetition
scheduling, real embeddings, and the native client. Reasons for each are in
`docs/ARCHITECTURE.md` under MVP boundary — most come down to the same thing:
doing them badly is worse than not doing them, because confidently wrong output
costs more trust than a missing feature.

---

## Deploying to Vercel

One command, from a machine that can reach Vercel:

```bash
npm install
npm run deploy          # builds, then deploys to production
npm run deploy:preview  # same, to a preview URL
```

`tools/build-vercel.mjs` emits Vercel's Build Output API tree — the server
bundled to one function, the client bundled and served statically — and
`vercel deploy --prebuilt` uploads exactly that. The first run asks you to log
in and pick a scope; after that it is the one command.

To get a deployment on every push instead, import the repository at
vercel.com (needs the [Vercel GitHub App](https://github.com/apps/vercel)) and
**set the production branch to `claude/ai-native-knowledge-platform-ks7zt0`** —
the repository default branch contains none of this code, so leaving it
alone builds an empty site.

Then set `ANTHROPIC_API_KEY` in the project's environment variables.

### Two things deployment does not change, and one that it does

Reading, structure extraction, search, artifacts, mastery and memory work
without a model. The interface says plainly when conversation is unavailable.

**Serverless functions are ephemeral and there is no database attached**, so
the store lives only in a warm instance's memory and does not survive a
restart. The deployed app says so on screen rather than letting anyone discover
it by losing work. Making it durable is a `Store` adapter — `Store` is an
interface and every caller goes through it — not a rewrite.
