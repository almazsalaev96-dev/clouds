"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Briefcase, Lightbulb, Microscope } from "lucide-react";
import { Button, Modal, cx } from "@/components/marketlab/ui/primitives";
import { useHydrated, useLab, type Interest } from "@/lib/marketlab/store";

const CHOICES: Array<{ id: Interest; label: string; blurb: string; icon: typeof BarChart3; go: string }> = [
  { id: "economics", label: "Economics", blurb: "Demand, supply, elasticity, market failure.", icon: BarChart3, go: "/experiments/supply-demand" },
  { id: "business", label: "Business", blurb: "Costs, pricing, break-even, profitability.", icon: Briefcase, go: "/tools" },
  { id: "research", label: "Research", blurb: "Running my own investigation and writing it up.", icon: Microscope, go: "/research" },
  { id: "entrepreneurship", label: "Entrepreneurship", blurb: "Testing whether an idea could actually work.", icon: Lightbulb, go: "/experiments/profit" },
];

/**
 * Asked once, on the first visit to the home page, and skippable in one click.
 *
 * It exists to pick a starting point, not to gate the product: everything in
 * MarketLab is reachable whether or not this is ever answered, which is why
 * there is a "Just let me look around" and why no answer is required.
 *
 * HOME PAGE ONLY, deliberately. It used to mount in the shell and therefore
 * appear on every route, which meant a link straight to an experiment — the
 * most likely way somebody arrives from a classmate or a bookmark — opened
 * onto a dialog covering the thing they came for. An interruption is only
 * acceptable where there is nothing else to interrupt.
 */
export function Onboarding() {
  const hydrated = useHydrated();
  const onboarded = useLab((s) => s.onboarded);
  const setInterests = useLab((s) => s.setInterests);
  const complete = useLab((s) => s.completeOnboarding);
  const [picked, setPicked] = React.useState<Interest[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const onHome = pathname === "/";

  // Held back a beat so it does not race the first paint of the page behind it.
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    if (!hydrated || onboarded || !onHome) return;
    const t = setTimeout(() => setReady(true), 450);
    return () => clearTimeout(t);
  }, [hydrated, onboarded, onHome]);

  if (!hydrated || onboarded || !ready || !onHome) return null;

  const finish = (navigate: boolean) => {
    setInterests(picked);
    complete();
    if (navigate && picked.length > 0) {
      const first = CHOICES.find((c) => c.id === picked[0]);
      if (first) router.push(first.go);
    }
  };

  return (
    <Modal
      open
      onClose={() => finish(false)}
      title="What are you here for?"
      description="One question, so MarketLab can put the right thing in front of you. Everything stays available whatever you pick."
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => finish(false)}>Just let me look around</Button>
          <Button variant="primary" onClick={() => finish(true)} disabled={picked.length === 0}>
            {picked.length === 0 ? "Pick at least one" : "Start there"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {CHOICES.map((c) => {
          const on = picked.includes(c.id);
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
              className={cx(
                "rounded-ml-md border p-3.5 text-left transition-colors",
                on ? "border-ml-accent bg-ml-accent-subtle" : "border-ml-border bg-ml-surface hover:bg-ml-subtle",
              )}
            >
              <Icon size={18} aria-hidden className={on ? "text-ml-accent" : "text-ml-text-4"} />
              <p className={cx("mt-2 text-[0.9375rem] font-medium", on ? "text-ml-accent" : "text-ml-text")}>{c.label}</p>
              <p className="ml-small mt-0.5 text-ml-text-3">{c.blurb}</p>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
