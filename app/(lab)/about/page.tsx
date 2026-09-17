import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody, CardHeader, Callout } from "@/components/marketlab/ui/primitives";
import { EXPERIMENTS } from "@/lib/marketlab/experiments";
import { LESSONS } from "@/lib/marketlab/learn/lessons";
import { SECTIONS } from "@/lib/marketlab/research";
import { INDICATORS } from "@/lib/marketlab/data/indicators";

export const metadata: Metadata = {
  title: "About",
  description: "What MarketLab is, how it is built, what it deliberately does not claim, and how your work is stored.",
};

export default function AboutPage() {
  return (
    <div className="ml-prose space-y-8">
      <header>
        <h1 className="ml-h1 text-ml-text">About MarketLab</h1>
        <p className="ml-body-lg mt-2 text-ml-text-2">
          An interactive economics laboratory, built as an independent research project by a Year 12 student studying
          Cambridge AS/A-level Economics and Business.
        </p>
      </header>

      <Card>
        <CardHeader title="What it is for" />
        <CardBody className="ml-body space-y-3 text-ml-text-2">
          <p>
            Most economics teaching moves in one direction: here is a model, here is a diagram, here is a question about
            the diagram. MarketLab is built for the other direction — you start with something you want to know, find the
            model that bears on it, run it with numbers you choose, and then have to decide what the result actually
            supports.
          </p>
          <p>
            The question the whole product is organised around is this: <strong className="text-ml-text">how can
            interactive economic models and business experiments help students understand real-world market
            decisions?</strong> That is a question, not a claim. Answering it would need a study with students in it, and
            no such study has been run.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="What is in it" />
        <CardBody>
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              [`${EXPERIMENTS.length} experiments`, "Price elasticity and revenue; supply, demand and price controls; a business profit simulator; and a simplified model of competitive pricing."],
              [`${LESSONS.length} lessons`, "Economics and business from zero, each with definitions, formulae, a worked example, common mistakes and original practice questions."],
              ["4 business tools", "Pricing, break-even, scenario comparison and a structured decision report, all reading one set of numbers."],
              [`${SECTIONS.length}-section research workspace`, "A place to run a real investigation and keep model results, real observations and your own assumptions visibly apart."],
              [`${INDICATORS.length} indicators`, "Real World Bank series, with what each measures and what it misses — or clearly labelled illustrative data when no live source can be reached."],
              ["A Lab Assistant", "An economics tutor that labels the status of every claim it makes, and works offline from the lesson corpus when no AI key is configured."],
            ].map(([term, detail]) => (
              <div key={term}>
                <dt className="ml-h3 text-ml-text">{term}</dt>
                <dd className="ml-small mt-1 text-ml-text-3">{detail}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <Callout tone="warning" title="What MarketLab does not claim">
        <ul>
          <li>
            <strong>The models are teaching models.</strong> Straight-line demand curves, constant unit costs, a logit
            share rule. A result describes the model and the numbers you gave it. It is not evidence about any real
            market, and every experiment lists the specific assumptions it rests on.
          </li>
          <li>
            <strong>It has not been shown to improve learning.</strong> That would require a study with a comparison
            group, and none has been conducted. Any claim otherwise would be an invented finding.
          </li>
          <li>
            <strong>It is not affiliated with anyone.</strong> Not with any examination board, university, institution or
            company. It reproduces no exam materials. The syllabus terminology is used because it is the vocabulary the
            subject is examined in; the words are standard economics, and all the explanations are original.
          </li>
          <li>
            <strong>There are no users, awards, partnerships or testimonials on this site</strong>, because there are
            none to report.
          </li>
          <li>
            <strong>Demo data is labelled as demo data.</strong> Where a live source cannot be reached, the figures shown
            are generated for illustration and say so on the chart, in the table and in the export.
          </li>
        </ul>
      </Callout>

      <Card>
        <CardHeader title="How it is built" />
        <CardBody className="ml-body space-y-3 text-ml-text-2">
          <p>
            Next.js with the App Router, TypeScript in strict mode, and Tailwind CSS v4. The charts are hand-written SVG
            rather than a charting library: every mark had to resolve to a design token so the dark theme could be
            re-derived rather than filtered, every chart had to have a table view for screen readers, and no chart was
            ever going to be allowed two y-axes.
          </p>
          <p>
            The economics lives in plain TypeScript modules with no React in them — elasticity, market equilibrium,
            costs and profit, competitive shares — which is what makes them testable. A calculation that cannot be
            performed returns <code className="ml-mono">null</code>, never <code className="ml-mono">0</code> and never{" "}
            <code className="ml-mono">NaN</code>, and the interface is obliged to say why. Break-even when price is below
            variable cost is the clearest case: a spreadsheet returns a confident negative number, and the honest answer
            is that there is no such quantity.
          </p>
          <p>
            There is a test suite covering the arithmetic, including the edge cases the models are most likely to be
            wrong about — a price change of zero, a starting quantity of zero, a non-binding price control, a negative
            contribution per unit, and a logit that would otherwise overflow.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Your work, and where it lives" />
        <CardBody className="ml-body space-y-3 text-ml-text-2">
          <p>
            There is no account and no sign-up, because a registration wall is the fastest way to stop somebody trying
            the thing. Everything you write — research projects, notes, saved runs, your theme and currency — is stored
            in this browser&apos;s local storage and is sent nowhere.
          </p>
          <p>
            The cost of that is real: your work does not follow you to another device, and clearing site data removes it.
            Every screen that holds work therefore offers an export, and the research workspace exports the whole project
            as Markdown or prints to PDF.
          </p>
          <p>
            The Lab Assistant is the only feature that sends anything anywhere. Your question and the figures currently
            on screen go to MarketLab&apos;s own server route, which calls an AI provider if a key is configured. No API
            key is ever exposed to the browser, and none is accepted from it.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Using MarketLab in a piece of research" />
        <CardBody className="ml-body space-y-3 text-ml-text-2">
          <p>If you quote a figure from here, say which kind of figure it is. There are exactly three:</p>
          <ul className="ml-rich list-disc pl-5">
            <li><strong>Model result</strong> — computed by MarketLab from stated parameters. Cite the parameters.</li>
            <li><strong>Real-world observation</strong> — from a data source. Cite the publisher, not MarketLab.</li>
            <li><strong>User-entered data</strong> — an assumption or estimate you supplied. Say where it came from.</li>
          </ul>
          <p>
            The research workspace keeps those labels attached and carries them into the export, which is the single most
            useful thing it does. A saved run keeps every input, so any number in a write-up can be reproduced rather
            than remembered.
          </p>
          <p>
            <Link href="/research" className="text-ml-accent underline">Start a research project →</Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
