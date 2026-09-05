# CLAUDE.md

Lodestar: an adaptive exam-learning system (Next.js 15, React 19, strict
TypeScript). The engines are the product; subject material is data in
`content/`.

## Commands

```bash
npm run dev              # dev server
npm test                 # unit tests over the engines (fast, run these often)
npm run typecheck        # strict tsc, no emit
npm run content:check    # validate all content packs; non-zero exit on errors
npm run pack:new -- --board … --level … --subject … --code …   # scaffold a pack
npm run build && npx next start -p 3111   # then:
npm run test:e2e         # browser suite (set CHROMIUM_PATH if preinstalled)
```

## Architecture in one paragraph

`src/domain` is pure TypeScript — no IO, no React — and holds every learning
engine (mastery, scheduling, priority, adaptive, mistakes, readiness, planner,
events). `src/content` loads and validates packs from `content/`. `src/store`
is local-first persistence (IndexedDB, whole-document writes, forward
migration). `src/view/derive.ts` joins content × student state into view
models. `src/ui` + `app/` render it. `src/ai` is server-only, provider-
abstracted, optional. Dependency rule: domain depends on nothing; nothing
depends on ui. Full rationale: `docs/ARCHITECTURE.md`.

## Hard rules (each one exists because of a real bug or a real harm)

- **Every derived number carries `because: string[]`** and is rendered behind a
  "Why am I seeing this?" disclosure. No unexplained numbers.
- **Never state what the evidence cannot support.** `forecastGrade` refuses to
  project below eight attempts; follow that pattern for any new estimate. A
  prior is not a measurement.
- **Question data and attempt data never mix.** Attempts pin `questionVersion`;
  editing content must never rewrite history.
- **All statistics derive from the event/attempt log** — never increment a
  counter in a component.
- **AI is an accelerant, never a dependency.** Every feature has a working
  deterministic path; AI failures surface the alternative, not "something went
  wrong". Keys are server-only (`src/ai` imports `server-only`).
- **Never invent official exam-board facts** (AO weightings, command-word
  definitions, thresholds, mark schemes) — in code, prompts, or content. Blank
  and labelled beats plausible and wrong. The pack scaffolder deliberately
  refuses to guess these.
- **Content rights:** original questions only; `link-only` material is linked,
  never rendered. See `docs/CONTENT-RIGHTS.md`.
- **Hooks above early returns** — `/progress` once crashed in production from a
  `useMemo` below a conditional return.
- **React loops advance via effects,** not render-time microtasks (the practice
  session once silently stalled).

## Conventions

- Board-agnostic: Cambridge is configuration. Never hardcode a board's
  behaviour into an engine; put it in pack data.
- Ids are plain string aliases (`TopicId` etc.) — named for readability, not
  branded.
- Styling: tokens and classes in `app/globals.css` only; no UI framework, no
  charting library (charts are inline SVG in `src/ui/charts.tsx`).
- Copy register: academic coach — plain, concrete, no exclamation marks, no
  praise inflation. "Master topic", not "complete module".
- When adding an engine, add tests for the property that is easy to get subtly
  wrong (see `src/domain/engines.test.ts` for the style).

## Gotchas in this environment

- `pkill -f "next start"` (or any pattern echoing your own command) kills your
  own shell — exit 144. Use `ps aux | grep "[n]ext-server" | awk '{print $2}' | xargs -r kill`.
- Playwright: use `executablePath: process.env.CHROMIUM_PATH` with the
  preinstalled browser; `networkidle` never settles when the font CDN is
  blocked — the e2e suite blocks those requests and waits on `domcontentloaded`.

## Where things stand

`docs/ROADMAP.md` maps the whole product spec to built / partial / not started
and is kept honest — update it when you build or discover otherwise.
