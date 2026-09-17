import type { Metadata } from "next";
import { BusinessTools } from "@/components/marketlab/tools/BusinessTools";

export const metadata: Metadata = {
  title: "Business tools",
  description: "Pricing, break-even and scenario calculators for a real business idea, plus a structured decision report.",
};

export default function ToolsPage() {
  return <BusinessTools />;
}
