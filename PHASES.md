# The build order

An architecture for an "adaptive intelligence operating system" was written
for a platform with a monorepo, services, a Postgres cluster, queues and an
event bus. This app is not that and should not become that: Armi runs in a
browser, keeps everything in IndexedDB, holds the person's own keys, and has
one server route whose whole job is to forward a request to a provider. That
is a feature, not a shortfall — nothing leaves the machine, and there is no
backend to operate.

So the architecture is worth taking apart rather than importing. Most of it
is about a question no deployment shape changes:

> Where should the next unit of intelligence be spent?

This file is the order in which that gets built here, what counts as done,
and what is already finished. It exists because this work spans sessions and
a plan that lives only in a conversation is a plan that gets rebuilt from
scratch every time.

## What the architecture asks for, and where it lands here

| Asked for | Here |
| --- | --- |
| Monorepo, services, queues, event bus | One Next.js app. The "bus" is Dexie plus the stream; the only queue is the one turn in flight. Not building this. |
| Postgres, migrations | Dexie, versioned migrations in `lib/db.ts`. Same discipline, different engine. |
| Permission engine, multi-tenant auth | One person, their own device, their own keys. The permission surface is what leaves the browser, which is `app/api/chat`. |
| Deployment architecture | Vercel, one preview per push. Done. |
| Evaluation framework | `gate.sh`: unit tests, forty-odd browser probes, measured checks on contrast, reach, widths, print and type. Done, and it is the reason this can be changed quickly. |
| Outcome contracts, uncertainty, meta-routing, verification, learning | The actual work. Phases below. |

## Done

**Phase 0 — the wire is honest.** Every request the app sends is well-formed
by construction: the transcript is put in order in one place all three
adapters share (`lib/providers/shared.ts`), and the mock refuses exactly what
the real API refuses, so the whole suite guards the shape. Before this, one
failed turn poisoned a conversation permanently and every section failed the
same way. Errors quote the provider instead of saying "something went wrong".

**Phase 1 — one decision per turn, recorded.** `lib/decide.ts` makes the
decision once: what kind of job this is, words or a working thing, how hard
to think, whether the answer has earned checking. It is stored in `turns`
with what became of it, and what became of it is what the person did — a
thumbs-down, a regenerate, a Tighten, a rewritten question. Before each turn
the app reads the last dozen answers of the same shape from the same model;
four needing another go earns the next one an automatic second opinion, and a
pairing that comes good again is forgiven. Visible and clearable in Settings.

Done when: `test-decide`, `test-turns`, `e2e-learn`, `e2e-recover` pass.

## Next, in order

**Phase 2 — the question worth asking.** The app never asks a clarifying
question, which is right nine times in ten and wrong the tenth, when it
builds the wrong thing confidently. Build a value test rather than a
politeness one: ask only when the missing fact changes the shape of the
answer and guessing wrong wastes the whole turn. One question, never a list,
never for anything that can be inferred and corrected cheaply.

Done when: a request naming a deliverable whose form depends on an unstated
fact asks exactly one question; every request in the golden set that can be
answered on assumptions is answered without asking.

**Phase 3 — retrieval that earns its place.** Project knowledge is fitted
whole-file into the prompt until the budget runs out. That is right for three
files and wrong for thirty. No embeddings: there is no server and no local
model, so lexical retrieval over paragraphs (BM25, with the document's own
structure as the unit) plus the existing whole-file path when it fits. The
prompt should carry the six paragraphs that bear on the question, named, not
the first four files in upload order.

Done when: a thirty-file project answers a question about file twenty-nine,
and the wire shows only the paragraphs that matter.

**Phase 4 — plan, then execute, for things that take more than one turn.**
The canvas already plans changes (`planChanges`). Generalise it: a request
that needs several steps gets a visible task graph, each step is run and
verified on its own, a failed step is diagnosed and retried rather than
taking the whole job down, and the work survives a reload.

Done when: a build that takes four steps can be interrupted at step three,
reopened, and resumed without redoing steps one and two.

**Phase 5 — the router learns too.** Phase 1 records which pairings go wrong.
The model router does not read that yet. Feed it: a model that keeps being
corrected for one kind of work drops down the ranking for that kind, and the
reason is shown, because a router that silently changes its mind is a router
nobody can correct.

Done when: `route()` takes what the record says and the reason line names it.

**Phase 6 — a golden set.** The gate proves the app works. It does not prove
the app decides well. Add a fixed set of requests with the decision each
should produce — kind, strategy, effort, check — and fail the gate when a
change moves them. This is what makes every later phase safe to attempt.

Done when: `test-golden` runs in the gate and a deliberate mis-tuning fails it.

**Phase 7 — uncertainty with a shape.** One confidence number cannot be acted
on. Separate doubt about what was asked, about the facts, and about whether
the thing works, because each has a different cure: ask, retrieve, run it.
This is what Phase 2 and Phase 3 should consult rather than guess.

Done when: the three are computed per turn and each one drives the action
that reduces it.

**Phase 8 — everything is an object.** A conversation, an artifact, a note
and a project are already rows that half-reference each other. Make the
references real and two-way, so an answer can point at the thing it built,
the note it came from and the project it belongs to, and a question about any
of them can reach the others.

Done when: opening an artifact shows the conversation that made it, and
asking about a note can reach the project it lives in.

## Rules that hold across all of it

- **Minimum sufficient intelligence.** The cheapest path that meets the
  quality the task needs. A sum is arithmetic, not a model call.
- **Nothing silent.** Every decision the app makes on the person's behalf is
  visible in a sentence they would use themselves, and reversible.
- **Local, or it does not happen.** No telemetry leaves the device. The
  record the app learns from is the person's, shown in full, deletable.
- **The gate is the contract.** A phase is not done until it is in `gate.sh`.
