import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { Badge, Callout, Card, CardBody, CardHeader, Formula, LinkButton } from "@/components/marketlab/ui/primitives";
import { Practice } from "@/components/marketlab/learn/Practice";
import { LESSONS, findLesson } from "@/lib/marketlab/learn/lessons";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lesson = findLesson(slug);
  if (!lesson) return { title: "Lesson not found" };
  return { title: lesson.title, description: lesson.summary };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = findLesson(slug);
  if (!lesson) notFound();

  const related = lesson.related.map((s) => findLesson(s)).filter(Boolean) as typeof LESSONS;

  return (
    <article className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/learn" className="ml-small text-ml-text-3 hover:text-ml-accent">Learn</Link>
          <span aria-hidden className="text-ml-text-4">/</span>
          <Badge tone="neutral" className="capitalize">{lesson.strand}</Badge>
          <Badge tone="neutral">{lesson.unit}</Badge>
          <span className="ml-small flex items-center gap-1 text-ml-text-4"><Clock size={12} aria-hidden /> {lesson.minutes} min</span>
        </div>
        <h1 className="ml-h1 mt-2.5 text-ml-text">{lesson.title}</h1>
        <p className="ml-body-lg ml-prose mt-2 text-ml-text-2">{lesson.summary}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="The idea" />
            <CardBody className="ml-body ml-prose space-y-3.5 text-ml-text-2">
              {lesson.explanation.map((p, i) => <p key={i}>{p}</p>)}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="A real-world example" />
            <CardBody className="ml-body ml-prose text-ml-text-2">{lesson.example}</CardBody>
          </Card>

          {lesson.formulae.length > 0 ? (
            <Card>
              <CardHeader title="Formulae" description="Worth being able to write down from memory." />
              <CardBody className="space-y-4">
                {lesson.formulae.map((f) => <Formula key={f.label} {...f} />)}
              </CardBody>
            </Card>
          ) : null}

          <Callout tone="warning" title="Common mistakes">
            <ul>{lesson.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
          </Callout>

          <Practice questions={lesson.questions} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
          {lesson.activity ? (
            <Card>
              <CardHeader title="Try it" description="The fastest way to believe this is to move the numbers yourself." />
              <CardBody>
                <p className="ml-small text-ml-text-2">{lesson.activity.description}</p>
                <div className="mt-3">
                  <LinkButton href={lesson.activity.href} variant="primary" size="sm">
                    {lesson.activity.label} <ArrowRight size={14} />
                  </LinkButton>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Key definitions" />
            <CardBody>
              <dl className="space-y-3">
                {lesson.definitions.map((d) => (
                  <div key={d.term}>
                    <dt className="ml-small font-semibold text-ml-text">{d.term}</dt>
                    <dd className="ml-small mt-0.5 text-ml-text-3">{d.meaning}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          {related.length > 0 ? (
            <Card>
              <CardHeader title="Next" />
              <CardBody>
                <ul className="space-y-2">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link href={`/learn/${r.slug}`} className="ml-small text-ml-accent hover:underline">{r.title} →</Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
