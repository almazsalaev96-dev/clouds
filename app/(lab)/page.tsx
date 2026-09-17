import Link from "next/link";
import { ArrowRight, Calculator, Database, FlaskConical, NotebookPen, Scale, TrendingUp } from "lucide-react";
import { Badge, Card, CardBody, LinkButton } from "@/components/marketlab/ui/primitives";
import { HeroChart } from "@/components/marketlab/home/HeroChart";
import { EXPERIMENTS } from "@/lib/marketlab/experiments";
import { LESSONS } from "@/lib/marketlab/learn/lessons";
import { SECTIONS, STAGES } from "@/lib/marketlab/research";

const CONCEPTS = ["elasticity", "market-equilibrium", "government-intervention", "market-failure", "costs-and-revenue", "market-structures"];

const STEPS = [
  { n: "01", title: "Ask a question", body: "Start from something you actually want to know — whether a price rise would help a business, what a shortage really costs, how much a conclusion depends on one assumption." },
  { n: "02", title: "Find the theory", body: "Every experiment names the model it uses and the assumptions that come with it, so you know what you are committing to before you run anything." },
  { n: "03", title: "Run the model", body: "Change the variables and watch the results recalculate. Nothing is animated for effect; every figure is computed from the inputs on screen." },
  { n: "04", title: "Record the run", body: "Save a run and it keeps every input, so a number in your write-up can be reproduced exactly rather than remembered approximately." },
  { n: "05", title: "Write it up", body: "The research workspace gives you the sections a piece of empirical work needs and keeps model results, real observations and your own assumptions visibly apart." },
];

export default function HomePage() {
  const featured = EXPERIMENTS;
  const concepts = CONCEPTS.map((slug) => LESSONS.find((l) => l.slug === slug)).filter(Boolean) as typeof LESSONS;

  return (
    <div className="space-y-16 pb-8">
      {/* ------------------------------------------------------- Hero -- */}
      <section className="grid items-center gap-8 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12 lg:pt-8">
        <div>
          <Badge tone="accent">An interactive economics laboratory</Badge>
          <h1 className="ml-display mt-4 text-ml-text">
            Understand markets.<br />Test decisions.<br />Discover insights.
          </h1>
          <p className="ml-body-lg ml-prose mt-5 text-ml-text-2">
            Explore economics, business strategy and real-world data through interactive experiments and independent
            research.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton href="/experiments" variant="primary" size="lg">
              Start an experiment <ArrowRight size={16} />
            </LinkButton>
            <LinkButton href="/learn" variant="secondary" size="lg">Explore economics</LinkButton>
          </div>
          <p className="ml-small mt-5 text-ml-text-4">
            No account, nothing to install. Your work stays in this browser and can be exported at any time.
          </p>
        </div>
        <HeroChart />
      </section>

      {/* ------------------------------------------------ Experiments -- */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="ml-h1 text-ml-text">Experiments</h2>
            <p className="ml-body ml-prose mt-2 text-ml-text-2">
              Working models with real arithmetic behind them. Change a variable and every result recalculates — including
              the ones that disagree with what you expected.
            </p>
          </div>
          <Link href="/experiments" className="ml-small font-medium text-ml-accent hover:underline">All experiments →</Link>
        </div>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {featured.map((e) => (
            <li key={e.slug}>
              <Card as="article" className="group relative h-full transition-colors hover:border-ml-border-strong">
                <CardBody>
                  <div className="flex items-center gap-2">
                    <FlaskConical size={16} className="text-ml-accent" aria-hidden />
                    <Badge tone="neutral">{e.difficulty}</Badge>
                  </div>
                  <h3 className="ml-h3 mt-3 text-ml-text">
                    <Link href={`/experiments/${e.slug}`} className="after:absolute after:inset-0 group-hover:text-ml-accent">
                      {e.title}
                    </Link>
                  </h3>
                  <p className="ml-small mt-1.5 text-ml-text-2">{e.summary}</p>
                  <p className="ml-small mt-3 border-t border-ml-border pt-3 text-ml-text-4">{e.question}</p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* --------------------------------------------------- Concepts -- */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="ml-h1 text-ml-text">Economics concepts</h2>
            <p className="ml-body ml-prose mt-2 text-ml-text-2">
              {LESSONS.length} lessons across economics and business, each with definitions, the formulae that matter, a
              worked real-world example, the mistakes people actually make, and practice questions.
            </p>
          </div>
          <Link href="/learn" className="ml-small font-medium text-ml-accent hover:underline">All lessons →</Link>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {concepts.map((l) => (
            <li key={l.slug}>
              <Link
                href={`/learn/${l.slug}`}
                className="block h-full rounded-ml-md border border-ml-border bg-ml-surface px-4 py-3.5 transition-colors hover:border-ml-border-strong hover:bg-ml-subtle"
              >
                <p className="ml-label text-ml-text-4">{l.unit}</p>
                <p className="ml-h3 mt-1 text-ml-text">{l.title}</p>
                <p className="ml-small mt-1 text-ml-text-3">{l.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------ Tools -- */}
      <section className="rounded-ml-xl border border-ml-border bg-ml-surface p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div>
            <div className="flex items-center gap-2">
              <Calculator size={18} className="text-ml-accent" aria-hidden />
              <h2 className="ml-h1 text-ml-text">Business decision tools</h2>
            </div>
            <p className="ml-body ml-prose mt-2 text-ml-text-2">
              For anyone with an actual idea rather than a homework question. Work out what a price needs to be, how many
              units cover the costs, and what changes if you are wrong about demand — then generate a structured decision
              report that states its assumptions instead of hiding them.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { icon: Calculator, title: "Pricing calculator", body: "Cost, price, volume, revenue, profit and margin, with mark-up and margin kept apart." },
                { icon: Scale, title: "Break-even calculator", body: "The quantity that covers your costs, the revenue that goes with it, and your margin of safety." },
                { icon: TrendingUp, title: "Scenario comparison", body: "Low, medium and high price side by side under an elasticity assumption you choose and can state." },
                { icon: NotebookPen, title: "Decision report", body: "Question, assumptions, calculations, results, risks, limitations — exportable as Markdown." },
              ].map((f) => (
                <li key={f.title} className="rounded-ml-md border border-ml-border bg-ml-inset px-4 py-3">
                  <f.icon size={16} className="text-ml-text-4" aria-hidden />
                  <p className="ml-h3 mt-2 text-ml-text">{f.title}</p>
                  <p className="ml-small mt-1 text-ml-text-3">{f.body}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <LinkButton href="/tools" variant="primary">Open the tools <ArrowRight size={15} /></LinkButton>
            </div>
          </div>

          <div className="rounded-ml-lg border border-ml-border bg-ml-inset p-5">
            <p className="ml-label text-ml-text-4">A worked figure</p>
            <p className="ml-body mt-2 text-ml-text-2">
              A market stall pays <strong className="text-ml-text">£180</strong> a week for its pitch and{" "}
              <strong className="text-ml-text">£4.20</strong> in ingredients per box, selling at{" "}
              <strong className="text-ml-text">£7.50</strong>.
            </p>
            <dl className="mt-4 space-y-2 border-t border-ml-border pt-4">
              <div className="flex justify-between gap-3">
                <dt className="ml-small text-ml-text-3">Contribution per box</dt>
                <dd className="ml-num text-[0.875rem] font-semibold text-ml-text">£3.30</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="ml-small text-ml-text-3">Break-even</dt>
                <dd className="ml-num text-[0.875rem] font-semibold text-ml-text">55 boxes</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="ml-small text-ml-text-3">At 90 boxes, margin of safety</dt>
                <dd className="ml-num text-[0.875rem] font-semibold text-ml-positive">39%</dd>
              </div>
            </dl>
            <p className="ml-small mt-4 text-ml-text-4">
              Raise the pitch fee to £240 and break-even moves to 73 boxes — a far more fragile business, from a change
              that touched neither the price nor the ingredients.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- Research -- */}
      <section>
        <div className="flex items-center gap-2">
          <NotebookPen size={18} className="text-ml-accent" aria-hidden />
          <h2 className="ml-h1 text-ml-text">The research workspace</h2>
        </div>
        <p className="ml-body ml-prose mt-2 text-ml-text-2">
          MarketLab is built around the idea that the interesting work is the investigation, not the chart. The workspace
          gives you the {SECTIONS.length} sections a piece of empirical economics needs, a place to attach the exact model
          runs a claim rests on, and a rule it enforces throughout: model results, real-world observations and your own
          assumptions are labelled separately and stay that way into the export.
        </p>

        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((s, i) => (
            <li key={s.id} className="rounded-ml-md border border-ml-border bg-ml-surface px-4 py-3.5">
              <p className="ml-label text-ml-accent">Step {i + 1}</p>
              <p className="ml-h3 mt-1 text-ml-text">{s.label}</p>
              <p className="ml-small mt-1 text-ml-text-3">{s.blurb}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/research" variant="primary">Start a research project <ArrowRight size={15} /></LinkButton>
          <LinkButton href="/data" variant="secondary"><Database size={15} /> Browse real data</LinkButton>
        </div>
      </section>

      {/* ------------------------------------------------ How it works -- */}
      <section className="rounded-ml-xl border border-ml-navy-line bg-ml-navy p-6 sm:p-10">
        <h2 className="ml-h1 text-ml-navy-fg">How MarketLab works</h2>
        <p className="ml-body-lg ml-prose mt-2 text-ml-navy-fg-2">
          Question → theory → data → experiment → analysis → conclusion. The same five steps whether you are checking one
          idea in ten minutes or building a project over a term.
        </p>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n}>
              <p className="ml-mono text-[0.8125rem] font-medium text-[#74a0ff]">{s.n}</p>
              <p className="ml-h3 mt-1.5 text-ml-navy-fg">{s.title}</p>
              <p className="ml-small mt-1.5 text-ml-navy-fg-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------ Honest -- */}
      <section className="rounded-ml-lg border border-ml-border bg-ml-inset px-5 py-5">
        <h2 className="ml-h3 text-ml-text">What MarketLab does not claim</h2>
        <ul className="ml-body ml-rich ml-prose mt-2 space-y-1 text-ml-text-2">
          <li>Its models are simplified teaching models. A result describes the model, not any real market.</li>
          <li>It has not been shown to improve anyone&apos;s learning. That would take a study, and none has been run.</li>
          <li>It is not affiliated with any exam board, university or institution, and reproduces no exam materials.</li>
          <li>Where a live data source is unavailable, the numbers shown are clearly labelled illustrative demo data.</li>
        </ul>
        <Link href="/about" className="ml-small mt-3 inline-block font-medium text-ml-accent hover:underline">
          More about how this is built →
        </Link>
      </section>
    </div>
  );
}
