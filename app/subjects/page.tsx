"use client";
import { SubjectPage } from "@/ui/subject";
import { useStore } from "@/store/provider";

export default function SubjectsPage() {
  const { ready } = useStore();
  if (!ready) return <p className="muted small">Loading…</p>;
  return <SubjectPage />;
}
