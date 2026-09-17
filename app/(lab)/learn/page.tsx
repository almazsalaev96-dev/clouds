import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import { Badge, Card, CardBody } from "@/components/marketlab/ui/primitives";
import { LESSONS, lessonsByStrand, units } from "@/lib/marketlab/learn/lessons";

export const metadata: Metadata = {
  title: "Learn",
  description: "Economics and business explained from zero, with definitions, formulae, worked examples, common mistakes and practice questions.",
};

export default function LearnPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="ml-h1 text-ml-text">Learn</h1>
        <p className="ml-body-lg ml-prose mt-2 text-ml-text-2">
          {LESSONS.length} lessons written for someone starting from nothing. Each one has a plain explanation, the key
          definitions, the formulae that matter, a real-world example worked through, the mistakes people actually make,
          and practice questions that explain themselves.
        </p>
        <p className="ml-small ml-prose mt-3 text-ml-text-4">
          The terminology follows the Cambridge AS/A-level syllabus because that is the vocabulary the subject is examined
          in. Nothing here is taken from, or claims to reproduce, any exam board&apos;s materials, and the practice
          questions are original.
        </p>
      </header>

      {(["economics", "business"] as const).map((strand) => (
        <section key={strand}>
          <h2 className="ml-h1 capitalize text-ml-text">{strand}</h2>
          {units(strand).map((unit) => (
            <div key={unit} className="mt-5">
              <p className="ml-label text-ml-text-4">{unit}</p>
              <ul className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {lessonsByStrand(strand).filter((l) => l.unit === unit).map((l) => (
                  <li key={l.slug}>
                    <Card as="article" className="group relative h-full transition-colors hover:border-ml-border-strong">
                      <CardBody className="flex h-full flex-col">
                        <div className="flex items-center gap-2">
                          <BookOpen size={15} className="text-ml-text-4" aria-hidden />
                          <span className="ml-small flex items-center gap-1 text-ml-text-4">
                            <Clock size={12} aria-hidden /> {l.minutes} min
                          </span>
                        </div>
                        <h3 className="ml-h3 mt-2.5 text-ml-text">
                          <Link href={`/learn/${l.slug}`} className="after:absolute after:inset-0 group-hover:text-ml-accent">
                            {l.title}
                          </Link>
                        </h3>
                        <p className="ml-small mt-1.5 text-ml-text-3">{l.summary}</p>
                        {l.activity ? (
                          <p className="ml-small mt-auto pt-3 text-ml-accent">Has an interactive activity</p>
                        ) : null}
                      </CardBody>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
