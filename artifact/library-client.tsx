"use client";

/**
 * Library, for the single-file build.
 *
 * The real Library page is a server component that reads and validates
 * `content/` from disk on every request. There is no filesystem here, so this
 * renders the same information from the content bundle that was compiled into
 * the page, plus the validation summary captured at build time. It says so
 * plainly rather than implying it is re-validating live.
 */

import { useContent, useStore } from "@/store/provider";
import { childTopics } from "@/domain/curriculum";
import { ReportedIssues } from "@/ui/reported-issues";

declare const __BUILD_INFO__: { builtAt: string; errors: number; warnings: number };

export default function LibraryClient() {
  const bundle = useContent();
  const { ready } = useStore();
  if (!ready) return <p className="muted small">Loading…</p>;

  return (
    <div className="stack loose">
      <header className="stack tight">
        <p className="eyebrow">Library</p>
        <h1>Content status</h1>
        <p className="lede">
          Lodestar is the engine; subject material is supplied as packs in <code>content/</code>.
        </p>
      </header>

      <div className="callout info">
        <div className="callout-title">This is the published build</div>
        <p className="small" style={{ margin: 0 }}>
          Packs were compiled into this page on {__BUILD_INFO__.builtAt}, with{" "}
          {__BUILD_INFO__.errors} error{__BUILD_INFO__.errors === 1 ? "" : "s"} and{" "}
          {__BUILD_INFO__.warnings} warning{__BUILD_INFO__.warnings === 1 ? "" : "s"}. Run the app
          locally (<code>npm run dev</code>) for live validation with per-file diagnostics, or{" "}
          <code>npm run content:check</code> from the command line.
        </p>
      </div>

      <div className="grid two">
        {bundle.packs.map(({ manifest, stats }) => (
          <section className="card" key={manifest.id}>
            <div className="card-head">
              <h2 className="card-title">
                {manifest.examBoard.shortName} · {manifest.qualification.title}
              </h2>
              <span className="chip">v{manifest.version}</span>
            </div>
            <h3>{manifest.name}</h3>
            {manifest.description && <p className="small muted">{manifest.description}</p>}

            <div className="grid four" style={{ marginTop: 14, gap: 10 }}>
              <div className="stat">
                <span className="stat-label">Topics</span>
                <span className="stat-value small num">{stats.topics}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Questions</span>
                <span className="stat-value small num">{stats.questions}</span>
                <span className="stat-note">{stats.questionMarks} marks</span>
              </div>
              <div className="stat">
                <span className="stat-label">Cards</span>
                <span className="stat-value small num">{stats.cards}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Lessons</span>
                <span className="stat-value small num">{stats.lessons}</span>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="row between">
                <span className="tiny muted">Leaf topics with at least one question</span>
                <span className="num tiny">{Math.round(stats.coverage * 100)}%</span>
              </div>
              <div className="meter">
                <div
                  className={`meter-fill ${stats.coverage > 0.7 ? "secure" : stats.coverage > 0.35 ? "fading" : "risk"}`}
                  style={{ width: `${Math.max(1, stats.coverage * 100)}%` }}
                />
              </div>
            </div>

            {manifest.rights?.summary && (
              <div className="callout info" style={{ marginTop: 14 }}>
                <div className="callout-title">Content rights</div>
                <p className="small" style={{ margin: 0 }}>{manifest.rights.summary}</p>
              </div>
            )}
          </section>
        ))}
      </div>

      <ReportedIssues />

      <section className="card">
        <div className="card-head"><h2 className="card-title">Loaded subjects</h2></div>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr><th>Syllabus</th><th className="num">Topics</th><th className="num">Questions</th><th className="num">Marks</th><th>Papers</th></tr>
            </thead>
            <tbody>
              {bundle.syllabuses.map((s) => {
                const qs = bundle.questions.filter((q) => q.syllabusId === s.id);
                const leaves = s.topics.filter((t) => childTopics(s, t.id).length === 0);
                return (
                  <tr key={s.id}>
                    <td className="small"><strong>{s.subject}</strong> <span className="muted">{s.code} · {s.version.label}</span></td>
                    <td className="num">{leaves.length}</td>
                    <td className="num">{qs.length}</td>
                    <td className="num">{qs.reduce((t, q) => t + q.marks, 0)}</td>
                    <td className="small muted">{s.papers.map((p) => `P${p.code}`).join(" · ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">Adding material</h2></div>
        <div className="prose small">
          <p>A pack is a directory under <code>content/</code>:</p>
          <pre style={{ background: "var(--panel-2)", padding: 14, borderRadius: "var(--radius-sm)", overflowX: "auto", fontSize: "0.82rem", lineHeight: 1.6 }}>{`content/<pack-id>/
  pack.yaml              qualification, board, grade scale, content rights
  syllabus/*.yaml        papers, assessment objectives, command words, topics
  questions/*.yaml       question banks with point-by-point mark schemes
  lessons/*.md           explanations at five depths, formulas, misconceptions
  flashcards/*.yaml      recall cards
  glossary/*.yaml        terminology`}</pre>
          <p>
            Scaffold one with <code>npm run pack:new</code>. Nothing is required beyond{" "}
            <code>pack.yaml</code> and a syllabus with topics; the rest is added incrementally and the
            product degrades gracefully rather than breaking. Format reference is in{" "}
            <code>docs/AUTHORING.md</code>.
          </p>
        </div>
      </section>
    </div>
  );
}
