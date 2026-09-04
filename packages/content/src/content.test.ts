import { describe, expect, it } from 'vitest';
import { business9609 } from './seed/business-9609.syllabus.js';
import { business9609Items } from './seed/business-9609.items.js';
import { Item, parseItems, parseSyllabus } from './schema.js';
import { aoMarkTotals, marksPerGradeBand, marksPerObjective, minutesPerMark } from './marks.js';

describe('9609 syllabus', () => {
  it('validates against the schema', () => {
    expect(() => parseSyllabus(business9609)).not.toThrow();
  });

  it('has four papers totalling 200 raw marks', () => {
    expect(business9609.papers).toHaveLength(4);
    expect(business9609.papers.reduce((s, p) => s + p.rawMarks, 0)).toBe(200);
  });

  it('has paper weightings that sum to the whole qualification', () => {
    const total = business9609.papers.reduce((s, p) => s + p.qualificationWeight, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('rejects a paper whose AO weights do not sum to 1', () => {
    const broken = {
      ...business9609,
      papers: [
        { ...business9609.papers[0], aoWeights: { AO1: 0.5, AO2: 0.2, AO3: 0.2, AO4: 0.2 } },
        ...business9609.papers.slice(1),
      ],
    };
    expect(() => parseSyllabus(broken)).toThrow(/AO weights sum/);
  });

  it('rejects a node pointing at a parent that does not exist', () => {
    const broken = {
      ...business9609,
      nodes: [...business9609.nodes, { id: 'x', title: 'Orphan', parentId: 'nope', level: 'AS', weight: 1 }],
    };
    expect(() => parseSyllabus(broken)).toThrow(/unknown parent/);
  });
});

describe('mark arithmetic', () => {
  it('puts exactly 50 raw marks on each assessment objective', () => {
    const totals = aoMarkTotals(business9609);
    expect(totals.totalRawMarks).toBe(200);
    for (const ao of ['AO1', 'AO2', 'AO3', 'AO4'] as const) {
      expect(totals.perAo[ao]).toBeCloseTo(50, 6);
    }
  });

  it('shows AO1 shrinking and AO4 growing from Paper 1 to Paper 4', () => {
    const { perPaper } = aoMarkTotals(business9609);
    expect(perPaper.p1?.AO1).toBeGreaterThan(perPaper.p4?.AO1 as number);
    expect(perPaper.p4?.AO3).toBeGreaterThan(perPaper.p1?.AO3 as number);
  });

  it('scopes totals to the papers asked for (AS only)', () => {
    const asPapers = business9609.papers.filter((p) => p.level === 'AS');
    expect(aoMarkTotals(business9609, asPapers).totalRawMarks).toBe(100);
  });

  it('spreads every leaf a share of the marks, summing to the qualification total', () => {
    const perObjective = marksPerObjective(business9609);
    const total = [...perObjective.values()].reduce((s, m) => s + m, 0);
    expect(total).toBeCloseTo(200, 3);
    expect(perObjective.size).toBeGreaterThan(30);
  });

  it('gives a more heavily weighted sub-topic more marks than its siblings', () => {
    const perObjective = marksPerObjective(business9609);
    // 3.3 The marketing mix carries weight 1.5 against its siblings' 1.0.
    expect(perObjective.get('s3.3.3') as number).toBeGreaterThan(
      perObjective.get('s3.3.1') as number,
    );
  });

  it('computes pacing in minutes per mark', () => {
    expect(minutesPerMark(business9609.papers[0]!)).toBeCloseTo(75 / 40, 6);
    expect(marksPerGradeBand(200)).toBe(13);
  });
});

describe('9609 starter deck', () => {
  it('validates against the item schema', () => {
    expect(() => parseItems(business9609Items)).not.toThrow();
  });

  it('has no duplicate ids', () => {
    const ids = business9609Items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('attaches every item to a real syllabus node', () => {
    const nodeIds = new Set(business9609.nodes.map((n) => n.id));
    const orphans = business9609Items.filter((i) => !nodeIds.has(i.objectiveId));
    expect(orphans.map((o) => `${o.id} -> ${o.objectiveId}`)).toEqual([]);
  });

  it('records provenance and licence on every item', () => {
    for (const item of business9609Items) {
      expect(Item.parse(item).provenance).toBe('authored');
      expect(item.licence).toBe('authored-atlas');
    }
  });

  it('gives every distractor a named misconception and a correction', () => {
    const mcqs = business9609Items.filter((i) => i.type === 'mcq');
    expect(mcqs.length).toBeGreaterThan(0);
    for (const mcq of mcqs) {
      expect(mcq.distractors?.length ?? 0).toBeGreaterThanOrEqual(2);
      for (const d of mcq.distractors ?? []) {
        expect(d.misconception.length).toBeGreaterThan(10);
        expect(d.correction.length).toBeGreaterThan(10);
      }
    }
  });

  it('covers all four assessment objectives, not just knowledge', () => {
    const covered = new Set(business9609Items.flatMap((i) => i.aos));
    expect([...covered].sort()).toEqual(['AO1', 'AO2', 'AO3', 'AO4']);
  });

  it('spans both AS and A2 content', () => {
    const levelOf = new Map(business9609.nodes.map((n) => [n.id, n.level]));
    const levels = new Set(business9609Items.map((i) => levelOf.get(i.objectiveId)));
    expect(levels.has('AS')).toBe(true);
    expect(levels.has('A2')).toBe(true);
  });
});
