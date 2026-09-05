/**
 * Library — content status.
 *
 * This page exists for whoever is supplying the subject material. It shows what
 * loaded, what each pack contains, exactly which topics have no questions yet,
 * and every validation error with its file and path. A question bank rots
 * quietly: a question referencing a topic id that no longer exists simply
 * disappears from every filter and nobody notices for months. Here it is a
 * line item.
 *
 * Server component: it reads the filesystem, so it never ships to the client.
 */

import Link from "next/link";
import { getBundle, getDiagnostics } from "@/content/bundle";
import { childTopics } from "@/domain/curriculum";

export const dynamic = "force-dynamic";

export default function LibraryPage() {
  const bundle = getBundle();
  const diagnostics = getDiagnostics();
  const errors = diagnostics.filter((d) => d.level === "error");
  const warnings = diagnostics.filter((d) => d.level === "warning");
  const gaps = diagnostics.filter((d) => d.level === "info");

  return (
    <div className="stack loose">
      <header className="stack tight">
        <p className="eyebrow">Library</p>
        <h1>Content status</h1>
        <p className="lede">
          Lodestar is the engine; subject material is supplied as packs in <code>content/</code>.
          Everything below is read from disk and validated on every request.
        </p>
      </header>

      {bundle.packs.length === 0 ? (
        <div className="empty">
          <h3>No packs loaded</h3>
          <p className="small" style={{ maxWidth: "52ch", margin: "0 auto" }}>
            Create <code>content/&lt;pack-id&gt;/pack.yaml</code> and a syllabus file to get started.
            The format is documented in <code>docs/AUTHORING.md</code>, and the shortest useful pack is
            a manifest plus a list of topics.
          </p>
        </div>
      ) : (
        <div className="grid two">
          {bundle.packs.map(({ manifest, stats }) => (
            <section className="card" key={manifest.id}>
              <div className="card-head">
                <h2 className="card-title">{manifest.examBoard.shortName} · {manifest.qualification.title}</h2>
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
                  <span className="tiny muted">Topics with at least one question</span>
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
      )}

      {errors.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title" style={{ color: "var(--lost)" }}>
              {errors.length} error{errors.length === 1 ? "" : "s"} — this content is not loading
            </h2>
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>File</th><th>Path</th><th>Problem</th></tr></thead>
              <tbody>
                {errors.slice(0, 40).map((d, i) => (
                  <tr key={i}>
                    <td className="small"><code>{d.file}</code></td>
                    <td className="small muted">{d.path ?? "—"}</td>
                    <td className="small">{d.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {warnings.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title" style={{ color: "var(--fading)" }}>
              {warnings.length} warning{warnings.length === 1 ? "" : "s"} — loaded, but check these
            </h2>
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>File</th><th>Item</th><th>Warning</th></tr></thead>
              <tbody>
                {warnings.slice(0, 40).map((d, i) => (
                  <tr key={i}>
                    <td className="small"><code>{d.file}</code></td>
                    <td className="small muted">{d.path ?? "—"}</td>
                    <td className="small">{d.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {gaps.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Coverage gaps — {gaps.length} topic{gaps.length === 1 ? "" : "s"} with no questions</h2>
          </div>
          <p className="small muted" style={{ marginBottom: 12 }}>
            These topics exist in the syllabus and cannot yet be practised or measured. Adding
            questions here is the highest-value content work available, because an untested topic is
            treated as unlearned by every engine in the product — which is honest, but pessimistic.
          </p>
          <div className="row" style={{ gap: 6 }}>
            {gaps.slice(0, 60).map((d, i) => (
              <span key={i} className="chip" title={d.message}>{d.message.replace(/^No questions yet for "|"\.$/g, "")}</span>
            ))}
          </div>
        </section>
      )}

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
            Every file is validated on load. Nothing is required beyond{" "}
            <code>pack.yaml</code> and a syllabus with topics — questions, lessons and cards can be
            added incrementally, and the product degrades gracefully rather than breaking when they
            are missing. Full format reference is in <code>docs/AUTHORING.md</code>.
          </p>
          <p>
            <Link href="/subjects">Browse loaded subjects →</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
