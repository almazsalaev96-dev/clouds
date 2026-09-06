"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QuestionBrowser } from "@/ui/question-browser";
import { useStore } from "@/store/provider";

function Inner() {
  const params = useSearchParams();
  const { ready } = useStore();
  if (!ready) return <p className="muted small">Loading…</p>;
  return <QuestionBrowser initialTopicId={params.get("topic") ?? undefined} />;
}

export default function QuestionsPage() {
  return (
    <Suspense fallback={<p className="muted small">Loading…</p>}>
      <Inner />
    </Suspense>
  );
}
