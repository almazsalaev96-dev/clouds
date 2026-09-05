"use client";

/**
 * Glossary and comparison mode.
 *
 * Terms students confuse are shown side by side, because the confusion is the
 * point: "contribution versus profit" is a mark-losing distinction, and seeing
 * the two definitions adjacent fixes it faster than reading either alone.
 */

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useContent } from "@/store/provider";
import { Card, Callout, Chip, Empty } from "@/ui/components";

function GlossaryInner() {
  const params = useSearchParams();
  const bundle = useContent();
  const [query, setQuery] = useState(params.get("term") ?? "");

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bundle.glossary
      .filter((e) => !q || e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q))
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [bundle.glossary, query]);

  const byTerm = useMemo(() => new Map(bundle.glossary.map((e) => [e.term.toLowerCase(), e])), [bundle.glossary]);

  if (bundle.glossary.length === 0) {
    return (
      <div className="stack loose">
        <header><p className="eyebrow">Glossary</p><h1>No terms loaded</h1></header>
        <Empty title="Add a glossary file to a content pack">
          Glossary entries live at <code>content/&lt;pack&gt;/glossary/*.yaml</code>. Each term can
          declare what students confuse it with, which drives comparison mode.
        </Empty>
      </div>
    );
  }

  return (
    <div className="stack loose">
      <header className="stack tight">
        <p className="eyebrow">Glossary · {bundle.glossary.length} terms</p>
        <h1>Terminology, and what it gets confused with</h1>
      </header>

      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search terms and definitions…" aria-label="Search glossary" />

      <div className="stack tight">
        {entries.map((e) => {
          const confusions = (e.confusedWith ?? []).map((c) => byTerm.get(c.toLowerCase())).filter(Boolean);
          return (
            <Card key={e.term}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <h3>{e.term}</h3>
                {e.topicIds?.length ? <Chip>{e.topicIds.length} topic{e.topicIds.length === 1 ? "" : "s"}</Chip> : null}
              </div>
              <p className="small" style={{ margin: 0 }}>{e.definition}</p>
              {e.examUsage && (
                <p className="small" style={{ margin: "8px 0 0", fontStyle: "italic", color: "var(--muted)" }}>
                  In an answer: {e.examUsage}
                </p>
              )}
              {confusions.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>Commonly confused with</p>
                  <div className="stack tight">
                    {confusions.map((c) => (
                      <div key={c!.term} className="callout" style={{ padding: "9px 12px" }}>
                        <strong className="small">{c!.term}</strong>
                        <span className="small"> — {c!.definition}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {entries.length === 0 && <Empty title="Nothing matched">Try a different term.</Empty>}
      </div>
    </div>
  );
}

export default function GlossaryPage() {
  return (
    <Suspense fallback={<p className="muted small">Loading…</p>}>
      <GlossaryInner />
    </Suspense>
  );
}
