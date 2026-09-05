# Lodestar

An adaptive learning system for Cambridge IGCSE, AS and A Level — architected so
other exam boards drop in as configuration rather than code.

It is not a website with revision resources on it. It is a set of engines that
decide **what a student should do next, why, and whether they are ready**, built
on an evidence model that accumulates from their own recorded work.

```bash
npm install
npm run dev          # http://localhost:3000
```

No database, no account, no API key required. It works immediately.

---

## What it actually does

**Ranks work by expected marks gained per hour.** Not by completion. That
produces materially different — sometimes surprising — advice: leave a topic
you are bad at alone because it is worth four marks and would take six hours;
go to a topic you think you know because it is worth thirty and is quietly
decaying.

**Models mastery as six separate signals** — ability, retention, consistency,
coverage, transfer, fluency — because a student who answers five easy questions
correctly has not mastered anything, and because a student whose problem is
*retention* needs completely different advice from one whose problem is
*transfer*. The weakest signal is always named.

**Schedules memory against the exam date.** A review scheduled for three days
after the paper is worthless, so intervals are clipped to land inside the
revision window, target retention rises as the exam approaches, and items born
from real lost marks are deliberately over-reviewed.

**Turns every lost mark into a diagnosis.** Written answers are marked against a
ledger of mark-scheme points; each point you miss is classified by cause. The
result is not "72%", it is *"seven of your nine lost marks were points made and
never developed — stop revising content, that is trainable in days"*.

**Refuses to state what the evidence cannot support.** Every derived number
carries a "Why am I seeing this?" disclosure. Grade projections always carry a
range and a list of what the number does not know, and no grade is projected at
all until there is enough recorded work to justify one.

---

## Running it

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build |
| `npm test` | 75 unit tests over the learning engines |
| `npm run content:check` | Validate every content pack; non-zero exit on errors |
| `npm run typecheck` | Strict TypeScript, no emit |
| `npm run test:e2e` | Drive a real browser through the whole loop |
| `npm run pack:new -- --board … --level … --subject … --code …` | Scaffold a new content pack |

`npm run test:e2e` expects a server on `:3111`
(`npx next start -p 3111`) and honours `CHROMIUM_PATH` when a browser is already
installed.

---

## Adding subjects

Subject material lives in `content/` as packs of YAML and Markdown. A pack with
a manifest and a list of topic titles loads and is useful; questions, lessons,
cards and glossary are added incrementally, and everything degrades gracefully
until they exist.

To start a new subject:

```bash
npm run pack:new -- --board cambridge --level igcse --subject Chemistry --code 0620
```

That writes a complete pack skeleton. Every field is a placeholder marked
`TODO`, and the pack deliberately fails validation until the syllabus is filled
in — it will not invent assessment-objective weightings or paper structures,
because a plausible guess for those is worse than an obvious blank.

**Format reference: [`docs/AUTHORING.md`](docs/AUTHORING.md).**

Open `/library` in the running app to see what loaded, every validation error
with its file and path, and exactly which topics have no questions yet.

The repository ships one worked pack — Cambridge Business 9609 — with the real
syllabus structure, assessment-objective weightings, twenty command words, and
fifteen original questions carrying full point-by-point mark schemes. Every
question in it is original; official material is linked to the awarding body,
never reproduced. See [`docs/CONTENT-RIGHTS.md`](docs/CONTENT-RIGHTS.md).

---

## AI

Optional. Everything above — spaced repetition, mastery, priority, adaptive
selection, mistake analysis, readiness, planning, mocks, analytics — is
deterministic and runs with no provider configured.

Setting a key additionally enables the tutor, AI-assisted marking, explanation
generation and question generation. Copy `.env.example` to `.env.local`. Keys
are server-side only and never reach the browser.

Where AI is unavailable the product says what failed and offers the
deterministic path, rather than showing an error. In the case of marking, that
path — self-marking against the real scheme — is the pedagogically stronger
option anyway, which is why it is the default rather than the apology.

---

## Documentation

| | |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How it is built and why |
| [`docs/AUTHORING.md`](docs/AUTHORING.md) | The content pack format |
| [`docs/CONTENT-RIGHTS.md`](docs/CONTENT-RIGHTS.md) | What may and may not be reproduced |
| [`docs/PRIVACY.md`](docs/PRIVACY.md) | What is stored, where, and what leaves the device |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | What is built, what is partial, what is not started |

---

## Stack

Next.js 15 · React 19 · TypeScript (strict, `noUncheckedIndexedAccess`) · Zod ·
IndexedDB · Vitest · Playwright. Hand-authored CSS design system; no UI
framework. Charts are inline SVG; no charting library.
