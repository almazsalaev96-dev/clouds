"use client";
import { use } from "react";
import { TopicPage } from "@/ui/topic";
import { useStore } from "@/store/provider";

export default function OneTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ready } = useStore();
  if (!ready) return <p className="muted small">Loading…</p>;
  return <TopicPage topicId={decodeURIComponent(id)} />;
}
