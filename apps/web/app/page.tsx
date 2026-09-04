'use client';

import Link from 'next/link';
import { business9609, aoMarkTotals, AO_LABELS, type AssessmentObjective } from '@atlas/content';
import { useStudy } from '@/lib/study';
import { Stat } from '@/components/Stat';

const AOS: AssessmentObjective[] = ['AO1', 'AO2', 'AO3', 'AO4'];
const DAY = 86_400_000;

export default function TodayPage() {
  const study = useStudy();
  const { session, priorities, settings, calibration, now } = study;

  if (!study.ready) return <div className="empty">Loading your study log…</div>;

  const totals = aoMarkTotals(business9609);
  const daysToExam =
    settings.examAt !== null ? Math.max(0, Math.ceil((settings.examAt - now) / DAY)) : null;
  const untouched = study.cards.filter((c) => c.reviews === 0).length;

  const tasks: { title: string; why: string; href: '/review' | '/map' }[] = [];
  if (session.counts.due > 0) {
    tasks.push({
      title: `Review ${session.counts.due} due ${session.counts.due === 1 ? 'item' : 'items'}`,
      why:
        session.backlog > 0
          ? `${session.backlog} more are waiting behind this session`
          : 'These are the ones closest to being forgotten',
      href: '/review',
    });
  }
  if (session.counts.new > 0) {
    tasks.push({
      title: `Learn ${session.counts.new} new ${session.counts.new === 1 ? 'item' : 'items'}`,
      why: 'Capped deliberately — new material costs more attention than review',
      href: '/review',
    });
  }
  if (priorities[0]) {
    tasks.push({
      title: `Target ${priorities[0].label}`,
      why: priorities[0].why,
      href: '/map',
    });
  }

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">
          {business9609.board} · {business9609.subject} {business9609.code}
          {daysToExam !== null ? ` · ${daysToExam} days to the exam` : ''}
        </div>
        <h1>Today</h1>
        <p className="lede">
          {session.counts.total > 0
            ? `${session.counts.total} items queued — ${session.counts.due} due for review, ${session.counts.new} new.`
            : 'Nothing is due right now. That is the schedule working, not a gap to fill.'}
        </p>
      </div>

      <div className="stat-row">
        <Stat value={session.counts.due} label="due now" />
        <Stat value={untouched} label="not yet started" />
        <Stat value={study.reviewedToday} label="reviewed today" />
        <Stat
          value={study.streakDays}
          label={study.streakDays === 1 ? 'day streak' : 'day streak'}
        />
      </div>

      <div className="section-title">Your queue</div>
      <div className="card">
        {session.counts.total === 0 ? (
          <div className="empty">
            <div className="big">Nothing due.</div>
            Come back when the scheduler says so — reviewing early costs time and buys
            almost no extra retention.
          </div>
        ) : (
          tasks.map((task, index) => (
            <Task key={task.title} index={index + 1} title={task.title} why={task.why} href={task.href} />
          ))
        )}
      </div>

      <div className="grid grid-2" style={{ marginTop: '0.85rem' }}>
        <div className="card">
          <div className="card-head">
            <h2>Where the marks actually are</h2>
            <span className="chip">{totals.totalRawMarks} raw marks</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
            Each assessment objective carries exactly a quarter of this qualification.
            Revision that is only memorisation is competing for the smallest quarter.
          </p>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Objective</th>
                  <th className="num">Marks</th>
                  <th className="num">Share</th>
                </tr>
              </thead>
              <tbody>
                {AOS.map((ao) => (
                  <tr key={ao}>
                    <td>
                      <strong>{ao}</strong>{' '}
                      <span style={{ color: 'var(--muted)' }}>{AO_LABELS[ao]}</span>
                    </td>
                    <td className="num">{Math.round(totals.perAo[ao])}</td>
                    <td className="num">
                      {Math.round((totals.perAo[ao] / totals.totalRawMarks) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Marks at risk</h2>
            {priorities.length > 0 && <span className="chip warn">top {Math.min(5, priorities.length)}</span>}
          </div>
          {priorities.length === 0 ? (
            <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
              Answer a few items and this ranks every topic by the marks it is currently
              costing you, divided by the hours needed to fix it.
            </p>
          ) : (
            <div>
              {priorities.slice(0, 5).map((p) => (
                <div key={p.objectiveId} className="tree-node">
                  <div className="tree-row">
                    <div className="tree-title">{p.label}</div>
                    <div className="tree-marks">{p.marksAtRisk.toFixed(1)}</div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{p.why}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {calibration.verdict !== 'insufficient-data' && (
        <div className="card" style={{ marginTop: '0.85rem' }}>
          <div className="card-head">
            <h2>How well you know what you know</h2>
            <span
              className={`chip ${calibration.verdict === 'well-calibrated' ? 'good' : 'warn'}`}
            >
              {calibration.verdict.replace('-', ' ')}
            </span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--ink-soft)' }}>
            Across {calibration.n} rated answers you were right{' '}
            {Math.round(calibration.accuracy * 100)}% of the time and expected to be right{' '}
            {Math.round(calibration.meanConfidence * 100)}% of the time
            {calibration.verdict === 'overconfident'
              ? ' — the gap is where surprises in an exam come from.'
              : calibration.verdict === 'underconfident'
                ? ' — you know more than you are giving yourself credit for.'
                : '. That match is worth protecting.'}
          </p>
        </div>
      )}
    </>
  );
}

function Task({
  index,
  title,
  why,
  href,
}: {
  index: number;
  title: string;
  why: string;
  href: '/review' | '/map';
}) {
  return (
    <Link className="task" href={href}>
      <span className="task-mark">{index}</span>
      <span className="task-body">
        <span className="task-title">{title}</span>
        <span className="task-why" style={{ display: 'block' }}>
          {why}
        </span>
      </span>
      <span className="task-go">Start →</span>
    </Link>
  );
}
