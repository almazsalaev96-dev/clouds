# MarketLab

An interactive economics laboratory: build a model, change its assumptions, record
what happens, and write up what it does and does not show.

MarketLab lives at `/` in this repository. The previous application in this repo
(Armi) has moved to `/studio` and is unchanged; the two are separate products
sharing one Next.js app, each with its own root layout and its own stylesheet.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

No API key, account or database is required to run any part of MarketLab. Every
feature works with an empty environment; two of them work *better* with one, and
say so on screen when they are running without.

### Environment variables

| Variable | Needed for | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | The Lab Assistant's AI answers | The assistant still works. It answers from MarketLab's own lesson corpus and the figures on the current page, and labels the reply **Offline answer**. |
| `MARKETLAB_MODEL` | Choosing the assistant's model | Defaults to `claude-sonnet-4-5`. |
| `ANTHROPIC_BASE_URL` | Pointing the assistant at a gateway or proxy | Uses the provider's own host. |
| `MARKETLAB_DATA_MODE=demo` | Forcing the Data section offline | Unset, `/api/indicators` tries the World Bank API (no key needed) and falls back to clearly-labelled illustrative data, with the reason, if it cannot be reached. |

**The key never reaches the browser.** It is read inside `/api/lab-assistant`
only, and that route does not accept a key from the client — a client-supplied
key would let any visitor spend someone else's credit through this origin.

---

## What is in it

| Route | What it does |
|---|---|
| `/` | Home. The hero is a working supply-and-demand model, not a picture of one. |
| `/explore` | Everything in one place, plus four routes through it that start from a question. |
| `/experiments` | Four interactive models. |
| `/experiments/elasticity` | Price elasticity of demand and total revenue. |
| `/experiments/supply-demand` | Equilibrium, shocks, price ceilings and floors, surplus and deadweight loss. |
| `/experiments/profit` | Costs, contribution, break-even, margin of safety, price scenarios. |
| `/experiments/competition` | A logit model of three differentiated firms competing on price and appeal. |
| `/tools` | Pricing, break-even, scenario comparison and a structured decision report, all reading one set of numbers. |
| `/research` | A 13-section research workspace with notes, attached model runs and Markdown/PDF export. |
| `/data` | Real World Bank indicators, or labelled illustrative data when no live source can be reached. |
| `/learn`, `/learn/[slug]` | 20 lessons across economics and business. |
| `/about` | What this is, how it is built, and what it deliberately does not claim. |
| `/api/lab-assistant` | Server-side assistant route. AI when a key is set, MarketLab's own corpus when not. |
| `/api/indicators` | Server-side data route. Normalises any source into one shape. |

---

## How it is put together

```
app/(lab)/               MarketLab: its own root layout, its own stylesheet
app/(studio)/studio/     the previous app, unchanged
app/api/lab-assistant/   the assistant route — the only place a key is read
app/api/indicators/      the data route
lib/marketlab/           the economics, as plain TypeScript with no React in it
  num.ts                 safe arithmetic and formatting
  elasticity.ts          PED, revenue, the two demand models the charts use
  market.ts              linear equilibrium, shocks, price controls, welfare
  profit.ts              costs, contribution, break-even, scenarios
  competition.ts         logit shares, best-response pricing, HHI
  research.ts            the report schema and the Markdown export
  experiments.ts         each experiment's question, objective and limitations
  assistant.ts           the system prompt, and the offline assistant
  store.ts               local persistence (zustand + localStorage)
  data/                  the indicator catalogue and the World Bank adapter
  learn/lessons.ts       the 20-lesson corpus
components/marketlab/    UI, charts, experiments, tools, research, shell
```

Three decisions worth knowing about:

**The economics has no React in it.** Every calculation lives in a plain module
and is covered by `test-marketlab.ts`, which is why the edge cases can be tested
at all.

**A calculation that cannot be performed returns `null`.** Never `0`, never
`NaN`, never `Infinity` — and the interface is obliged to say why. Break-even
when price is below variable cost is the clearest case: a spreadsheet returns a
confident negative number, and the truth is that no such quantity exists.

**The charts are hand-written SVG.** Three requirements made a library awkward:
every mark resolves to a design token so the dark theme is re-derived rather than
filtered; every chart has a table view, because a chart alone is not an
accessible way to publish a result; and no chart may ever carry two y-scales.

---

## Tests

```bash
npx jiti test-marketlab.ts      # the arithmetic, including the edge cases
node marketlab-contrast.mjs     # every text/background pair against WCAG, both themes
node e2e-marketlab.mjs          # a real browser: routes, interaction, a11y, responsive, the API routes
npx tsc --noEmit                # types
```

The browser suite expects a production server on port 3100 (`npx next build &&
npx next start -p 3100`), which is what `bash gate.sh` does; override with
`URL=http://localhost:3000`. All three are wired into `gate.sh`.

What the suites cover:

- **Arithmetic** — PED under both conventions and the disagreement between them,
  the sign convention, revenue direction against the textbook rule, equilibrium
  and welfare against hand-worked figures, binding and non-binding price
  controls, deadweight loss, break-even including the two cases where it does not
  exist, marketing's diminishing returns, logit shares including the overflow
  case, research progress and export, the demo-data generator's determinism.
- **Colour** — every text/background pair at 4.5:1, every control edge and chart
  series at 3:1, in light and dark. The five chart series are also validated for
  colour-vision deficiency.
- **Browser** — all 13 routes render with no console error, the hero recomputes,
  switching elasticity method changes the coefficient, selling below variable
  cost reports no break-even point, a price ceiling reports a shortage, a
  research section survives a reload, the data page states live-or-demo, the
  assistant answers offline, dark mode is applied before first paint, no
  horizontal scroll on any page at 360/390/768/1024/1440, every control is
  labelled, and no key appears in the delivered page.

---

## What is deliberately not claimed

- The models are simplified teaching models. A result describes the model and the
  numbers you gave it — not any real market. Every experiment lists its own
  limitations on the page, not in a footer.
- Nothing here has been shown to improve learning. That would need a study, and
  none has been run.
- MarketLab is not affiliated with any examination board, university or
  institution, and reproduces no exam materials. The practice questions are
  original.
- Where a live data source cannot be reached, the figures shown are generated for
  illustration and say so on the chart, in the table and in the export.

---

## What is not finished

- **One live data source.** The World Bank adapter is wired up; FRED, OECD and
  national statistics offices would each be one more adapter in
  `lib/marketlab/data/` returning the same `SeriesResult` shape.
- **Work lives in one browser.** There is no account, by design — but that means
  a project does not follow you to another device. A Supabase-backed sync layer
  would slot behind `lib/marketlab/store.ts` without the UI changing.
- **PDF export is the browser's print dialogue**, styled with a print stylesheet,
  rather than a generated document.
- **The assistant does not stream.** Answers arrive whole.
- **No comparison across saved runs.** Runs can be saved and attached to a
  project, but there is no screen that puts two of them side by side yet; that is
  the single most useful next feature for the research workflow.
