"use client";

/**
 * Reported content issues, shown on the Library page.
 *
 * Reports are stored in the student's own event log (local-first, like
 * everything else), so this list shows what was reported *from this browser*.
 * The copy says so plainly — pretending it is a central queue would be lying
 * about where the data lives.
 */

import { useMemo } from "react";
import { useContent, useStore } from "@/store/provider";
import { ofType } from "@/domain/events";

export function ReportedIssues() {
  const { state, ready } = useStore();
  const bundle = useContent();

  const reports = useMemo(() => ofType(state.events, "content_reported").slice().reverse(), [state.events]);

  if (!ready || reports.length === 0) return null;

  const promptOf = (id: string) => bundle.questions.find((q) => q.id === id)?.prompt ?? "(question not in current packs)";

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Reported issues · {reports.length}</h2>
      </div>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Flagged from questions in this browser. Fix the content file, bump the question&rsquo;s{" "}
        <code>version</code>, and re-run <code>npm run content:check</code>.
      </p>
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr><th>When</th><th>Question</th><th>Issue</th></tr>
          </thead>
          <tbody>
            {reports.slice(0, 20).map((r, i) => (
              <tr key={i}>
                <td className="small muted">{r.at.slice(0, 10)}</td>
                <td className="small">
                  <code className="tiny">{r.questionId}</code>
                  <br />
                  {promptOf(r.questionId).slice(0, 90)}…
                </td>
                <td className="small">{r.issue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
