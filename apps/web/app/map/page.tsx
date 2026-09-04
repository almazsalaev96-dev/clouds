'use client';

import { useMemo, useState } from 'react';
import { business9609 } from '@atlas/content';
import { useStudy } from '@/lib/study';
import { percent } from '@/lib/format';

type LevelFilter = 'all' | 'AS' | 'A2';

export default function MapPage() {
  const study = useStudy();
  const [level, setLevel] = useState<LevelFilter>('all');

  const sections = useMemo(() => {
    const byId = new Map(study.objectives.map((o) => [o.id, o]));
    return business9609.nodes
      .filter((n) => n.parentId === null)
      .map((root) => ({
        root: byId.get(root.id)!,
        children: business9609.nodes
          .filter((n) => n.parentId === root.id)
          .map((n) => byId.get(n.id)!)
          .filter(Boolean),
      }))
      .filter((s) => s.root && (level === 'all' || s.root.level === level));
  }, [study.objectives, level]);

  if (!study.ready) return <div className="empty">Loading…</div>;

  const practised = study.objectives.filter((o) => o.attempts > 0);
  const mastered = practised.filter((o) => o.mastered);
  const coveredMarks = mastered.reduce((s, o) => s + o.marksAtStake, 0);

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">
          {business9609.subject} {business9609.code} · {business9609.validFor}
        </div>
        <h1>Syllabus map</h1>
        <p className="lede">
          Every sub-topic with the marks it carries and where your evidence currently
          stands. Marks per sub-topic are an estimate — the board publishes marks per
          paper, not per topic.
        </p>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="value">{practised.length}</div>
          <div className="label">topics started</div>
        </div>
        <div className="stat">
          <div className="value">{mastered.length}</div>
          <div className="label">topics mastered</div>
        </div>
        <div className="stat">
          <div className="value">{Math.round(coveredMarks)}</div>
          <div className="label">marks secured</div>
        </div>
        <div className="stat">
          <div className="value">{study.objectives.filter((o) => o.dueCount > 0).length}</div>
          <div className="label">topics with reviews due</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', margin: '1.3rem 0 0.4rem' }}>
        {(['all', 'AS', 'A2'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className="btn"
            aria-pressed={level === option}
            style={
              level === option
                ? { borderColor: 'var(--accent)', color: 'var(--accent)' }
                : undefined
            }
            onClick={() => setLevel(option)}
          >
            {option === 'all' ? 'All' : option === 'AS' ? 'AS Level' : 'A Level'}
          </button>
        ))}
      </div>

      {sections.map(({ root, children }) => (
        <div className="card" key={root.id} style={{ marginTop: '0.85rem' }}>
          <div className="card-head">
            <h2>
              <span style={{ color: 'var(--muted)', marginRight: '0.4rem' }}>{root.code}</span>
              {root.title}
            </h2>
            <span className="chip">{root.level === 'AS' ? 'AS' : 'A Level'}</span>
          </div>
          {children.map((node) => (
            <div className="tree-node" key={node.id}>
              <div className="tree-row">
                <span className="tree-title">
                  <span className="code">{node.code}</span>
                  {node.title}
                  {node.mastered && (
                    <span className="chip good" style={{ marginLeft: '0.45rem' }}>
                      mastered
                    </span>
                  )}
                  {node.dueCount > 0 && (
                    <span className="chip warn" style={{ marginLeft: '0.45rem' }}>
                      {node.dueCount} due
                    </span>
                  )}
                  {node.dueCount === 0 && node.newCount > 0 && node.attempts === 0 && (
                    <span className="chip" style={{ marginLeft: '0.45rem' }}>
                      {node.newCount} new
                    </span>
                  )}
                </span>
                <span className="tree-meter">
                  <span className="meter">
                    <span
                      style={{
                        width: percent(node.attempts === 0 ? 0 : node.probability),
                        background: node.mastered ? 'var(--good)' : 'var(--accent)',
                      }}
                    />
                  </span>
                </span>
                <span className="tree-marks">{node.marksAtStake.toFixed(1)} mk</span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                {node.cardCount === 0
                  ? 'No items yet — upload material for this topic and Atlas will build them.'
                  : node.attempts === 0
                    ? `${node.cardCount} ${node.cardCount === 1 ? 'item' : 'items'} ready, none attempted`
                    : `${percent(node.probability)} · ${node.masteryReason}`}
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
