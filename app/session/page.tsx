"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SessionRunner } from "@/ui/session";
import { useStore } from "@/store/provider";

function Inner() {
  const params = useSearchParams();
  const { ready } = useStore();
  const minutes = Math.max(5, Math.min(240, Number(params.get("minutes") ?? 25) || 25));
  if (!ready) return <p className="muted small">Loading…</p>;
  return <SessionRunner minutes={minutes} />;
}

export default function SessionPage() {
  return (
    <Suspense fallback={<p className="muted small">Loading…</p>}>
      <Inner />
    </Suspense>
  );
}
