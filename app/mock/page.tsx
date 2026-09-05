"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MockExam } from "@/ui/mock";
import { useStore } from "@/store/provider";

function Inner() {
  const params = useSearchParams();
  const { ready } = useStore();
  if (!ready) return <p className="muted small">Loading…</p>;
  return <MockExam paperId={params.get("paper") ?? undefined} />;
}

export default function MockPage() {
  return (
    <Suspense fallback={<p className="muted small">Loading…</p>}>
      <Inner />
    </Suspense>
  );
}
