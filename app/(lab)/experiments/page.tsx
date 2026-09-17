import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Card, CardBody } from "@/components/marketlab/ui/primitives";
import { EXPERIMENTS } from "@/lib/marketlab/experiments";

export const metadata: Metadata = {
  title: "Experiments",
  description: "Interactive economic and business models. Change the variables and watch every result recalculate.",
};

export default function ExperimentsPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="ml-h1 text-ml-text">Experiment Lab</h1>
        <p className="ml-body-lg ml-prose mt-2 text-ml-text-2">
          Four working models. Each one states the question it answers, shows the formulae it evaluates, and lists what it
          cannot tell you. Change anything and every figure updates at once — there is no run button because there is
          nothing to wait for.
        </p>
      </header>

      <ul className="grid gap-4 md:grid-cols-2">
        {EXPERIMENTS.map((e) => (
          <li key={e.slug}>
            <Card as="article" className="group h-full transition-colors hover:border-ml-border-strong">
              <CardBody className="flex h-full flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{e.difficulty}</Badge>
                  <Badge tone="neutral">{e.minutes} min</Badge>
                </div>
                <h2 className="ml-h2 mt-3 text-ml-text">
                  <Link href={`/experiments/${e.slug}`} className="after:absolute after:inset-0 group-hover:text-ml-accent">
                    {e.title}
                  </Link>
                </h2>
                <p className="ml-body mt-1.5 text-ml-text-2">{e.summary}</p>

                <div className="mt-4 rounded-ml-md border border-ml-border bg-ml-inset px-3.5 py-3">
                  <p className="ml-label text-ml-text-4">Research question</p>
                  <p className="ml-small mt-1 text-ml-text-2">{e.question}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {e.topics.map((t) => (
                    <span key={t} className="ml-small rounded-full bg-ml-subtle px-2 py-0.5 text-ml-text-3">{t}</span>
                  ))}
                </div>

                <p className="ml-small mt-auto pt-4 font-medium text-ml-accent">
                  Open experiment <ArrowRight size={13} className="inline" aria-hidden />
                </p>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <Card>
        <CardBody>
          <h2 className="ml-h3 text-ml-text">What counts as an experiment here</h2>
          <p className="ml-body ml-prose mt-2 text-ml-text-2">
            Each of these is a model: a set of equations plus the numbers you feed them. A result tells you what follows
            from those assumptions, and nothing else. That is genuinely useful — it is how you find out whether an
            argument holds together, which assumption a conclusion is resting on, and how much the answer would move if
            that assumption were wrong. It is not evidence about any real market, and MarketLab labels every figure so
            that the distinction survives into your write-up.
          </p>
          <p className="ml-body ml-prose mt-3 text-ml-text-2">
            To say something about the real world you need observations: prices you recorded, a survey you ran, published
            statistics with a source. The <Link href="/data" className="text-ml-accent underline">Data</Link> section is
            where those come in, and the <Link href="/research" className="text-ml-accent underline">Research workspace</Link>{" "}
            is where the two get held apart on purpose.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
