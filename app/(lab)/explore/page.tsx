import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Calculator, Database, FlaskConical, NotebookPen } from "lucide-react";
import { Badge, Card, CardBody, CardHeader } from "@/components/marketlab/ui/primitives";
import { EXPERIMENTS } from "@/lib/marketlab/experiments";
import { LESSONS } from "@/lib/marketlab/learn/lessons";
import { INDICATORS } from "@/lib/marketlab/data/indicators";
import { SECTIONS } from "@/lib/marketlab/research";

export const metadata: Metadata = {
  title: "Explore",
  description: "Everything in MarketLab in one place — experiments, business tools, lessons, data and the research workspace.",
};

const ROUTES = [
  {
    href: "/experiments", label: "Experiments", icon: FlaskConical,
    count: `${EXPERIMENTS.length} models`,
    blurb: "Interactive economic models with real arithmetic behind them. Change a variable, watch every figure recalculate.",
  },
  {
    href: "/tools", label: "Business tools", icon: Calculator,
    count: "4 calculators",
    blurb: "Pricing, break-even, scenario comparison and a structured decision report, all fed by one set of numbers about your business.",
  },
  {
    href: "/research", label: "Research workspace", icon: NotebookPen,
    count: `${SECTIONS.length} sections`,
    blurb: "Run your own investigation: a question, a hypothesis, the runs behind each claim, and a write-up that keeps model results and real observations apart.",
  },
  {
    href: "/data", label: "Data", icon: Database,
    count: `${INDICATORS.length} indicators`,
    blurb: "Real economic indicators with what they measure, what they miss, and where they came from.",
  },
  {
    href: "/learn", label: "Learn", icon: BookOpen,
    count: `${LESSONS.length} lessons`,
    blurb: "Economics and business from zero — definitions, formulae, worked examples, common mistakes and practice questions.",
  },
];

/** Where to go if you want to start from a question rather than a section. */
const PATHS = [
  {
    question: "Would raising my price make me more money?",
    steps: [
      { label: "Learn elasticity", href: "/learn/elasticity" },
      { label: "Run the elasticity experiment", href: "/experiments/elasticity" },
      { label: "Check it against your costs", href: "/tools" },
    ],
  },
  {
    question: "How many do I need to sell to break even?",
    steps: [
      { label: "Learn break-even analysis", href: "/learn/break-even-analysis" },
      { label: "Use the break-even calculator", href: "/tools" },
      { label: "Model the whole business", href: "/experiments/profit" },
    ],
  },
  {
    question: "What actually happens when a government caps a price?",
    steps: [
      { label: "Learn government intervention", href: "/learn/government-intervention" },
      { label: "Impose a price control", href: "/experiments/supply-demand" },
      { label: "Write up what it cost", href: "/research" },
    ],
  },
  {
    question: "I want to turn this into a research project.",
    steps: [
      { label: "Pick a question", href: "/research" },
      { label: "Run the experiments", href: "/experiments" },
      { label: "Find real data", href: "/data" },
    ],
  },
];

export default function ExplorePage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="ml-h1 text-ml-text">Explore</h1>
        <p className="ml-body-lg ml-prose mt-2 text-ml-text-2">
          Everything MarketLab contains, and four routes through it if you would rather start from a question than from a
          menu.
        </p>
      </header>

      <section>
        <h2 className="ml-h2 text-ml-text">Start from a question</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {PATHS.map((p) => (
            <li key={p.question}>
              <Card className="h-full">
                <CardBody>
                  <p className="ml-h3 text-ml-text">{p.question}</p>
                  <ol className="mt-4 space-y-2">
                    {p.steps.map((s, i) => (
                      <li key={s.href + i} className="flex items-center gap-2.5">
                        <span className="ml-num inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ml-accent-subtle text-[0.6875rem] font-semibold text-ml-accent">
                          {i + 1}
                        </span>
                        <Link href={s.href} className="ml-small text-ml-text-2 hover:text-ml-accent">{s.label}</Link>
                      </li>
                    ))}
                  </ol>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="ml-h2 text-ml-text">Every section</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROUTES.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.href}>
                <Card as="article" className="group relative h-full transition-colors hover:border-ml-border-strong">
                  <CardBody>
                    <div className="flex items-center justify-between gap-2">
                      <Icon size={17} className="text-ml-accent" aria-hidden />
                      <Badge tone="neutral">{r.count}</Badge>
                    </div>
                    <h3 className="ml-h3 mt-3 text-ml-text">
                      <Link href={r.href} className="after:absolute after:inset-0 group-hover:text-ml-accent">{r.label}</Link>
                    </h3>
                    <p className="ml-small mt-1.5 text-ml-text-3">{r.blurb}</p>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="ml-h2 text-ml-text">Experiments in full</h2>
        <ul className="mt-4 space-y-3">
          {EXPERIMENTS.map((e) => (
            <li key={e.slug}>
              <Card className="group relative">
                <CardBody className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="ml-h3 text-ml-text">
                      <Link href={`/experiments/${e.slug}`} className="after:absolute after:inset-0 group-hover:text-ml-accent">
                        {e.title}
                      </Link>
                    </h3>
                    <p className="ml-small mt-1 text-ml-text-2">{e.question}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {e.topics.map((t) => (
                        <span key={t} className="ml-small rounded-full bg-ml-subtle px-2 py-0.5 text-ml-text-3">{t}</span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-ml-text-4 group-hover:text-ml-accent" aria-hidden />
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="ml-h2 text-ml-text">All lessons</h2>
        <Card className="mt-4">
          <CardHeader title={`${LESSONS.length} lessons`} description="Economics and business, in syllabus order." />
          <CardBody>
            <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {LESSONS.map((l) => (
                <li key={l.slug}>
                  <Link href={`/learn/${l.slug}`} className="ml-small text-ml-text-2 hover:text-ml-accent">
                    {l.title}
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
