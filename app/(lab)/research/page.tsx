import type { Metadata } from "next";
import { ResearchWorkspace } from "@/components/marketlab/research/ResearchWorkspace";

export const metadata: Metadata = {
  title: "Research",
  description: "Run your own investigation: a question, a hypothesis, the model runs behind each claim, and a structured write-up.",
};

export default function ResearchPage() {
  return <ResearchWorkspace />;
}
