"use client";
import { Review } from "@/ui/review";
import { useStore } from "@/store/provider";

export default function ReviewPage() {
  const { ready } = useStore();
  if (!ready) return <p className="muted small">Loading…</p>;
  return <Review />;
}
