import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EXPERIMENTS, findExperiment } from "@/lib/marketlab/experiments";
import { ElasticityExperiment } from "@/components/marketlab/experiments/ElasticityExperiment";
import { SupplyDemandExperiment } from "@/components/marketlab/experiments/SupplyDemandExperiment";
import { ProfitExperiment } from "@/components/marketlab/experiments/ProfitExperiment";
import { CompetitionExperiment } from "@/components/marketlab/experiments/CompetitionExperiment";

export function generateStaticParams() {
  return EXPERIMENTS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const meta = findExperiment(slug);
  if (!meta) return { title: "Experiment not found" };
  return { title: meta.title, description: meta.question };
}

export default async function ExperimentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  switch (slug) {
    case "elasticity": return <ElasticityExperiment />;
    case "supply-demand": return <SupplyDemandExperiment />;
    case "profit": return <ProfitExperiment />;
    case "competition": return <CompetitionExperiment />;
    default: notFound();
  }
}
