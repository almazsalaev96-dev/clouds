"use client";
import { MistakeLab } from "@/ui/mistake-lab";
import { useStore } from "@/store/provider";

export default function MistakesPage() {
  const { ready } = useStore();
  if (!ready) return <p className="muted small">Loading…</p>;
  return <MistakeLab />;
}
