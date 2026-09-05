"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Practice } from "@/ui/practice";
import { useStore } from "@/store/provider";
import type { AttemptMode } from "@/domain/question";

function Inner() {
  const params = useSearchParams();
  const { ready } = useStore();
  if (!ready) return <p className="muted small">Loading…</p>;
  const topic = params.get("topic") ?? undefined;
  const mode = (params.get("mode") as AttemptMode | null) ?? "adaptive";
  return <Practice initialTopicId={topic} mode={mode} />;
}

export default function PracticePage() {
  return (
    <Suspense fallback={<p className="muted small">Loading…</p>}>
      <Inner />
    </Suspense>
  );
}
