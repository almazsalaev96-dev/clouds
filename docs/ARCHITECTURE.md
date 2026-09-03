# Understory — Architecture

> An AI-native personal knowledge, learning, research and work environment.
> One AI that understands what you are working on.

This document is the answer to §55 (A–I) of the product specification. It is
written to be *decision-bearing*: every section states what was chosen and why
the alternative was rejected. Where a specification requirement was changed,
the change and its justification are recorded under **Departures** (§54).

---

## A. Product architecture

### The one-sentence definition

Understory is a **context engine with a conversation attached** — not a chatbot
with attachments.

That distinction is the whole product. In a chatbot, the user assembles context
by pasting and uploading. In Understory, the system assembles context by
understanding what the user is doing. Every subsystem below exists to make one
decision better: *what should the AI know right now?*

### Why that is the centre, and not conversation

The specification leans on "the AI understands context" in nearly every section,
but never names the engineering consequence. Context windows are finite. A user's
corpus is not. After a few months a serious user has thousands of blocks of
document text, hundreds of conversation turns, dozens of artifacts, a mastery
model over hundreds of concepts, and a memory store.

A single turn can afford maybe twenty of those items.

So the real product is a **ranking function** that runs on every turn, over a
heterogeneous candidate set, under a hard budget, in under a second. If it is
good, the product feels telepathic. If it is mediocre, no amount of interface
polish rescues it — the user goes back to pasting, and Understory becomes a
worse ChatGPT.

Everything else in this architecture is either a **producer of candidates** for
that ranker, a **consumer of its output**, or a **writer of signal** that makes
the next ranking better.

```
                        ┌──────────────────────────┐
   PRODUCERS            │      CONTEXT RANKER      │        CONSUMERS
                        │                          │
  documents ──────────► │  gather → score → pack   │ ──────► model router
  conversation ───────► │                          │ ──────► tool selection
  memory ─────────────► │  budgeted, provenance-   │ ──────► generation
  knowledge graph ────► │  preserving, explainable │ ──────► artifacts
  learning state ─────► │                          │
  artifacts ──────────► └────────────┬─────────────┘
       ▲                             │
       │                             ▼
       └──────────── WRITEBACK ──────┘
              (what happened becomes tomorrow's context)
```

That cycle is §43's product loop, expressed as an architecture rather than a
slogan.

### Capabilities, not applications

Per §1 and §5, there is no "PDF mode", no "study mode", no "research mode". There
are **primitives** that compose:

| Primitive | What it is | Spec |
|---|---|---|
| **Context** | A ranked, budgeted, explainable view of what matters now | §7, §11 |
| **Document** | Any source material, decomposed into addressable blocks | §14 |
| **Artifact** | An editable output object the AI and user both operate on | §16 |
| **Concept** | A unit of understanding with mastery state | §10 |
| **Memory** | A user-controlled fact the system may carry forward | §8 |
| **Tool** | A capability with honest, inspectable results | §32 |

"Make a quiz from chapter 4, then track what I get wrong, then plan my revision"
is not four features. It is: Document → Artifact → LearningEvent → Artifact,
with the context engine carrying continuity between each step. That is §40.

---

## B. UX architecture

### Navigation

§20 proposes six areas. I am shipping **four**, because two of them are not
destinations:

| Area | Purpose |
|---|---|
| **Home** | "What matters right now" — continuation, not a dashboard (§19) |
| **Workspace** | Where content lives and work happens |
| **Learn** | Mastery, weak concepts, practice |
| **Projects** | Grouping with a shared context boundary |

**Search is not a destination — it is a keystroke** (`⌘K`). Making search a tab
implies you visit it; making it a shortcut means it is available from inside the
thing you are already doing, which is when you actually need it.

**AI is not a destination either.** §26 is right that chat must not permanently
consume half the screen. The AI is a *layer* summoned in place (`⌘J`), sized to
the request, dismissed when done. A permanent chat column would contradict §24's
hierarchy — content first, assistance second.

### The interaction model

Three surfaces, in increasing weight:

1. **Inline actions** — select text or ink, get `Explain · Solve · Improve ·
   Practice`. No panel opens. Answer appears next to the thing. (§13)
2. **The AI panel** — a conversation with the current workspace already in
   context. Opens beside content, never over it, on large screens. (§26)
3. **Artifacts** — when output is substantial enough to be *worked on* rather
   than read, it becomes an editable object in the workspace. (§16)

The escalation is automatic. The user never chooses a surface.

### Intent, and the reversibility principle

§11 says infer intent and act when confident. §33 says never fake certainty.
These conflict: vague-intent inference is exactly where confident wrongness lives.

The specification resolves this with "ask one concise clarification when
confidence is low." I am resolving it differently, because a clarifying question
taxes the user *every single time*, including the majority of times the guess
would have been right.

**Reversibility substitutes for confidence.** The system states its assumption
inline and makes the action one gesture to undo:

> *Reading "this" as the worksheet, page 3.* [not that?]

Right guess: costs the user nothing, and they learn the system is grounded.
Wrong guess: one tap. Compare to a clarifying dialog, which costs an interaction
100% of the time to prevent a 20% error rate.

Clarification is reserved for genuine ambiguity between *equally likely* targets,
not for low confidence generally.

### First 60 seconds (§41) — and its conflict with §42

§42's wow moments 4 and 6 ("AI remembers a past difficulty", "what should I do
next?") are **structurally impossible on day one.** They require accumulated
history. Any product that appears to deliver them immediately is faking it,
which §50 forbids.

So the first session is built only on the wows that need no history:

1. Land in a workspace with the input focused. No signup wall, no questionnaire.
2. Drop in a document. Structure extraction runs immediately and visibly.
3. Ask anything, or select a passage and hit Explain.
4. The answer cites the exact block it came from — clickable, verifiable.

That is WOW 1 and WOW 2, honestly earned in under a minute. The memory-dependent
magic is a *month two* payoff and the roadmap treats it that way.

### Every screen's states (§48)

Enforced structurally, not by discipline: the client's `View` contract requires
`empty`, `loading`, `error`, and `ready` renderers. A view that does not supply
all four does not compile-check in review. Loading states are never spinners over
content — they are skeletons that preserve layout, so nothing reflows.

---

## C. Technical architecture

### Shape

The product ships as **web and native apps** (a decision made explicitly: the
distribution model of ChatGPT, Gemini and Claude). That single fact determines
the architecture:

```
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │    Web     │   │   iPad     │   │   iPhone   │     CLIENTS
   │  (built)   │   │  (later)   │   │  (later)   │     interaction only
   └─────┬──────┘   └─────┬──────┘   └─────┬──────┘
         └────────────────┼────────────────┘
                          │  HTTP + SSE
                 ┌────────▼─────────┐
                 │      SERVER      │  auth · rate limit · streaming
                 └────────┬─────────┘  ← API keys live here, only here
                          │
                 ┌────────▼─────────┐
                 │   CORE (engine)  │  platform-agnostic, dependency-free
                 │                  │
                 │  context ranker  │  ← the centre
                 │  documents       │
                 │  knowledge       │
                 │  memory          │
                 │  learning        │
                 │  model router    │
                 │  tools           │
                 │  artifacts       │
                 │  orchestrator    │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │      STORE       │  interface; JSON now, SQL later
                 └──────────────────┘
```

**The server is the product; clients are views onto it.** A document added on
web is understood on iPad without sync logic, because there is only one copy.
Cross-device continuity is not a feature here — it is the absence of a problem.

### Why core is dependency-free

`packages/core` has **zero runtime dependencies** and imports nothing from Node
beyond `node:crypto`. Consequences:

- it runs in a server, a worker, a test, or (compiled) a native app's JS bridge
- the entire intelligence layer is testable with no network and no API key
- supply-chain surface for the component holding all user knowledge is nil (§34)

§47 says avoid unnecessary dependencies. Taken seriously, that means the core of
a knowledge product should not transitively trust 400 packages.

### Runtime

Node 22 executes TypeScript natively (type stripping) and ships a test runner.
So: **no build step, no bundler, no test framework.** `node --test` is the whole
CI story. This is not minimalism for its own sake — it means the code you read is
the code that runs, and a new contributor is productive without toolchain setup.

### Security (§30, §34)

| Concern | Decision |
|---|---|
| Model API keys | Server-only, read from env, never serialised into any response |
| Transport | TLS terminated ahead of the app; app refuses non-local plaintext in production |
| Auth | Session token per user; every store query is scoped by `userId` at the store boundary, not by caller discipline |
| Authorisation | Ownership checked in the store layer — a handler *cannot* read another user's row even if it tries |
| Rate limiting | Per-user token bucket on model-invoking routes |
| Data minimisation | Memory writes require an explicit provenance record; nothing is inferred silently (§8) |
| Deletion | Cascading delete by user, verified by test |

### Error handling (§33)

Failure is modelled as data, not exceptions. Every capability returns a
discriminated result carrying either a value or a typed failure
(`model_unavailable`, `no_api_key`, `tool_failed`, `parse_failed`, `timeout`,
`budget_exceeded`). The UI renders each distinctly. There is no state in which
the interface silently does nothing — the most common failure mode of AI products
and the one §33 exists to prevent.

Specifically: **with no API key configured, the system says so plainly** and the
non-model half of the product (ingestion, structure, retrieval, search,
artifacts, mastery) keeps working. It does not pretend to think.

---

## D. AI architecture

### Context assembly — the ranker

Runs on every turn, in five stages:

**1. Gather.** Candidates are collected from every producer in parallel. Each
candidate is `{ kind, id, text, spans, recency, salience, source }`.

Sources: current selection · open document blocks · retrieved blocks (query) ·
recent conversation · relevant memories · linked artifacts · weak concepts ·
graph neighbours of anything already selected.

**2. Score.** A transparent linear model over named features, not a black box:

| Feature | Rationale |
|---|---|
| `explicit` | The user pointed at it. Dominates everything. |
| `lexicalMatch` | BM25 against the turn's query |
| `recency` | Exponential decay; what you touched matters |
| `proximity` | Same document/page as the current view |
| `graphDistance` | Hops from an already-selected node |
| `learningRelevance` | Concept is weak and the turn touches it |
| `pinned` | User explicitly kept it |

Weights are **named constants in one file**, tunable and testable. Every ranking
decision is explainable — the API can return *why* each item was included, which
is what makes §22's proactivity "explainable" rather than spooky.

**3. Pack.** Greedy fill under a token budget, with reserved floors so that one
huge document cannot evict the user's selection or their memory. Budget floors
are a correctness property and are unit-tested.

**4. Generate.** The packed context is rendered into a prompt with each block
labelled by its provenance handle.

**5. Write back.** What happened becomes signal: retrieval hits, concepts
touched, graded outcomes, artifacts created. This is the loop closing.

### Provenance is structural, not prompted

§17 says "never invent citations". **A prompt instruction is not a control.**

Enforcement:

1. Retrieval emits blocks with real addresses (`documentId`, `blockId`,
   `startOffset`, `endOffset`).
2. The prompt exposes only those handles.
3. Generated citations are **parsed and resolved** against the retrieved set.
4. Any citation that does not resolve is **stripped before render**, and the
   response is flagged as having had an unresolvable citation.

A fabricated citation therefore cannot reach the user, regardless of what the
model emits. This is the single most important trust mechanism in the product.

### Model abstraction (§31)

The abstraction is at the **task** level, not the "swap the model" level, because
prompts are in practice model-specific and a naive provider swap silently
degrades quality.

```
ModelRouter.select(task) → provider
```

Tasks: `conversation` · `reasoning` · `extraction` · `classification` ·
`titling` · `embedding`. Each declares its needs (reasoning depth, context
length, multimodality, latency sensitivity, cost tolerance). The router picks the
cheapest provider meeting the requirement, with declared fallback order.

Cheap, high-volume tasks (titling, classification) route to small models. Only
genuine reasoning pays for a large one. This is a real cost-control mechanism,
not a gesture at model-agnosticism.

### Memory (§8)

Memory is **append-only with explicit provenance**. Every memory records what
was said and where. Nothing is inferred silently. The user can list, edit, delete,
disable, and export. A memory that was never used in a turn is decayed and
eventually retired — memory that does not earn its place is deleted, which is the
difference between useful and creepy.

Sensitive-category inference is refused at the write boundary, not filtered later.

### Learning (§10) — and an honest limitation

Mastery is estimated from **graded retrieval events only**: a question with a
known-correct answer, attempted, scored. A student saying "oh I get it now" is
not evidence and does not move mastery.

This means the product must **create** practice moments rather than passively
observing conversation. §10 wants the intelligence "behind the scenes"; I am
partly departing from that, because invisible mastery estimation without graded
data is fabricated confidence — exactly §50's "fake intelligence."

What stays invisible: scheduling, interleaving, difficulty adaptation,
prerequisite ordering. What becomes visible: the practice itself, and an honest
confidence indicator on every mastery number, including "not enough evidence yet."

Sparse honest data beats dense fabricated data.

### Tools (§32)

A registry of typed capabilities. Each declares a JSON schema, whether it is
side-effecting, and its trust level. Every invocation is **recorded and shown**:
what ran, with what input, what came back. §32's "never pretend a tool was used"
is enforced because the transcript is generated from the actual invocation log,
not from the model's narration of it.

---

## E. Data model (§44)

```
User ──┬── Workspace ──┬── Project ──── Document ──── Block ──── Annotation
       │               │      │
       │               │      ├──────── Conversation ──── Message
       │               │      ├──────── Artifact
       │               │      └──────── Task
       │               │
       ├── Memory      └── Concept ──── LearningEvent ──── Mistake
       │
       └── Edge (typed relationship over everything above)
```

Key decisions:

**`Block`, not `Page`.** §44 lists `Page`. Pages are a rendering artifact of PDFs;
they are the wrong unit for retrieval and citation. A block is a semantic unit
(heading, paragraph, list, table, formula, question) that *carries* a page number
when it has one. Citations address blocks; blocks report pages. This gives correct
provenance for PDFs, markdown, web pages and handwriting alike.

**`Edge` is a first-class entity.** §9's knowledge graph is not implicit foreign
keys. `Edge { fromType, fromId, toType, toId, kind, weight, provenance }` lets any
node relate to any node with a reason attached. Kinds: `mentions`, `teaches`,
`assesses`, `derived_from`, `contradicts`, `practices`, `about`.

**`Mistake` is separate from `LearningEvent`.** An event is one graded attempt.
A mistake is a *recognised pattern* across events — which is what §23's "you've
made this mistake three times" requires. Collapsing them makes that impossible.

**Everything is user-scoped at the store boundary.** `userId` is not a column
that handlers remember to filter on; it is a parameter of the store interface.

---

## F. Design system (§27, §28)

### Departure from the supplied tokens

§28's palette is a good starting point but has a contrast failure I will not ship:
tertiary text `#969696` on surface `#FFFFFF` is **2.8:1**, below WCAG AA (4.5:1)
for body text. §37 makes accessibility architectural, so the token is corrected to
`#767676` (4.54:1). Dark-mode tertiary `#707075` on `#151516` is likewise raised.

Accent `#7C6CF2` for AI is kept — it is the one place a distinct hue earns its
keep, marking "this came from the model" without a robot icon or a sparkle.

### Foundation

- **Type:** SF Pro on Apple platforms, system stack elsewhere. Editorial serif
  reserved for long-form reading surfaces only. Fluid scale, respects Dynamic Type.
- **Space:** 8pt grid, no exceptions.
- **Radii:** 6 / 10 / 16, by element weight.
- **Elevation:** two levels. Panels are separated by *hairlines and ground tone*,
  not by shadow stacking.
- **Targets:** 44pt minimum, always.
- **Motion:** 140ms micro / 240ms panel / 320ms major, all cancelled under
  `prefers-reduced-motion`. Motion only ever communicates continuity or causality.

### The AI's visual language (§21, §27)

The AI is recognisable through **behaviour**, not decoration: contextual
highlights on the exact source text, streaming that never reflows the page, a
provenance mark you can click. No avatar, no sparkles, no gradient. Where the
model is uncertain, the interface says so in words.

---

## G. Implementation roadmap (§45)

**Phase 1 — Core magic** *(this milestone)*
Context engine · document understanding with real spans · retrieval · model
abstraction · tools · artifacts · orchestration · server · iPad-first web client.
Target: a document becomes understood, cited, and turned into an editable artifact.

**Phase 2 — Intelligence**
Embedding-backed semantic search · memory maturation · graph expansion in ranking ·
mastery from graded practice · mistake pattern detection · next-best-action.

**Phase 3 — Power**
Research with multi-source synthesis and disagreement detection · presentations ·
projects and tasks · adaptive learning · native iPad client with PencilKit ·
integrations.

---

## H. Risk analysis

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Ranker mediocrity.** Everything depends on it, and it fails invisibly — the product just feels dumb. | Critical | Named features, tunable weights, explainable output, fixture-based regression tests on ranking order. Treated as the primary quality metric. |
| 2 | **Fabricated citations** destroy trust irrecoverably in a research product. | Critical | Structural resolution + stripping. Cannot be bypassed by prompting. |
| 3 | **Cold start.** No history means no memory, no graph, no mastery — half the wow moments are unavailable. | High | Day-one value built only on history-free capability. Roadmap sequences memory value to month two. Never simulate history. |
| 4 | **Mastery without graded data** is fabricated confidence. | High | Graded events only; explicit "insufficient evidence" state. |
| 5 | **Proactivity precision.** One wrong nudge costs more than ten right ones earn. | High | High confidence threshold, pull-shaped placement, always dismissible, never modal. |
| 6 | **Context cost.** Rich context is expensive per turn at scale. | Medium | Hard budgets, task-based routing to cheap models, cache-friendly prompt ordering. |
| 7 | **Handwriting fidelity** differs between native and web. | Medium | Ink understanding lives server-side; clients capture at their platform's best fidelity. Same intelligence, different input quality. |
| 8 | **Scope collapse into a feature pile** — the failure §1 warns about. | Medium | Primitives, not applications. §4's test applied to every addition. |

---

## I. MVP boundary — what is deliberately NOT built

Stated explicitly, per §55(I) and §46:

- **Research mode (§17).** Multi-source retrieval, disagreement detection and
  synthesis is a product in itself. Doing it badly is worse than not doing it,
  because bad research output is confidently wrong. Phase 3.
- **Presentations (§16).** Highest effort-to-insight ratio of the artifact types.
- **Projects and tasks (§18).** Real, but a grouping layer over primitives that
  must exist first. Building it now would be organisation without content.
- **Voice input (§12).** Genuinely useful, entirely orthogonal to the thesis.
- **Spaced repetition scheduling (§10).** Requires graded history that does not
  exist yet. Building the scheduler before the data is building a fiction.
- **Native iPad client (§25).** Cannot be compiled or tested in this environment;
  shipping unverified Swift would violate §47 and §48. The API it will consume is
  built and tested here, which is the part that determines whether the native
  client can be good.
- **Real embeddings (§39).** Interface defined, lexical retrieval shipped. Upgrading
  is a provider swap, not a rewrite. The product does not claim semantic search
  until it has it.

---

## Departures from the specification (§54)

| § | Specified | Shipped | Why |
|---|---|---|---|
| 11 | Ask a clarifying question when confidence is low | State the assumption; make it one tap to undo | Clarification taxes every interaction to prevent a minority of errors |
| 20 | Six navigation areas | Four, with Search and AI as summonable layers | You do not *visit* search or AI; you invoke them from where you are |
| 28 | Tertiary text `#969696` / `#707075` | `#767676` / raised dark equivalent | Original fails WCAG AA at 2.8:1; §37 makes a11y architectural |
| 44 | `Page` entity | `Block` entity that carries a page number | Pages are a PDF rendering detail; blocks are the correct citation unit |
| 10 | Learning intelligence stays behind the scenes | Scheduling invisible; practice and confidence visible | Invisible mastery without graded data is fabricated confidence (§50) |
| 25 | SwiftUI iPadOS client | iPad-first web client; native deferred | No Swift toolchain available; unverifiable code violates §47/§48 |
