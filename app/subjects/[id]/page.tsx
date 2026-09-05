"use client";
import { use } from "react";
import { SubjectPage } from "@/ui/subject";
import { useStore } from "@/store/provider";

export default function OneSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ready } = useStore();
  if (!ready) return <p className="muted small">Loading…</p>;
  return <SubjectPage syllabusId={decodeURIComponent(id)} />;
}
