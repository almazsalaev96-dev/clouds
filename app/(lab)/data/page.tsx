import type { Metadata } from "next";
import { Suspense } from "react";
import { DataExplorer } from "@/components/marketlab/data/DataExplorer";

export const metadata: Metadata = {
  title: "Data",
  description: "Explore real economic indicators with their sources, or clearly labelled illustrative data when a live source is unavailable.",
};

export default async function DataPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const indicator = typeof params.indicator === "string" ? params.indicator : undefined;
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-ml-lg bg-ml-subtle" />}>
      <DataExplorer initialIndicator={indicator} />
    </Suspense>
  );
}
