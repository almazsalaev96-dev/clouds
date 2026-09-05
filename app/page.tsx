"use client";

import { useStore } from "@/store/provider";
import { Onboarding } from "@/ui/onboarding";
import { CommandCentre } from "@/ui/home";

export default function HomePage() {
  const { state, ready } = useStore();
  if (!ready) return <Loading />;
  return state.profile.subjects.length === 0 ? <Onboarding /> : <CommandCentre />;
}

function Loading() {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      <div className="card" style={{ height: 90 }} />
      <div className="grid four">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ height: 88 }} />
        ))}
      </div>
      <div className="grid two">
        <div className="card" style={{ height: 240 }} />
        <div className="card" style={{ height: 240 }} />
      </div>
    </div>
  );
}
