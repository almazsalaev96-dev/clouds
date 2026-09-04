/**
 * Mark arithmetic — turning a syllabus into "where the marks actually are".
 *
 * This is the calculation that changes how a student revises. Cambridge Business
 * 9609 is the worked example: four papers, 200 raw marks, and the four assessment
 * objectives take exactly 50 marks each. Knowledge — the thing most revision time
 * goes on — is only a quarter of the paper.
 *
 * Every number the planner shows ("18 marks at risk") traces back to here.
 */

import type { AssessmentObjective, Paper, Syllabus, SyllabusNode } from './schema.js';

export interface AoMarkTotals {
  /** Raw marks per assessment objective across the whole qualification. */
  perAo: Record<AssessmentObjective, number>;
  /** Raw marks per paper per AO. */
  perPaper: Record<string, Record<AssessmentObjective, number>>;
  totalRawMarks: number;
}

const AOS: AssessmentObjective[] = ['AO1', 'AO2', 'AO3', 'AO4'];

/** Raw marks each AO carries, per paper and in total. */
export function aoMarkTotals(syllabus: Syllabus, papers?: readonly Paper[]): AoMarkTotals {
  const included = papers ?? syllabus.papers;
  const perAo: Record<AssessmentObjective, number> = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
  const perPaper: Record<string, Record<AssessmentObjective, number>> = {};

  for (const paper of included) {
    const row: Record<AssessmentObjective, number> = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
    for (const ao of AOS) {
      const marks = paper.rawMarks * (paper.aoWeights[ao] ?? 0);
      row[ao] = marks;
      perAo[ao] += marks;
    }
    perPaper[paper.id] = row;
  }

  return {
    perAo,
    perPaper,
    totalRawMarks: included.reduce((s, p) => s + p.rawMarks, 0),
  };
}

/**
 * Spread the qualification's raw marks across syllabus leaves.
 *
 * A leaf inherits its share of the marks available at its level, scaled by the
 * relative teaching weights on the path from the root. This is an estimate — no
 * board publishes marks per sub-topic — so it is deliberately simple and
 * explainable rather than falsely precise.
 */
export function marksPerObjective(syllabus: Syllabus): Map<string, number> {
  const byParent = new Map<string | null, SyllabusNode[]>();
  for (const node of syllabus.nodes) {
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  }

  const asMarks = syllabus.papers
    .filter((p) => p.level === 'AS')
    .reduce((s, p) => s + p.rawMarks, 0);
  const a2Marks = syllabus.papers
    .filter((p) => p.level === 'A2')
    .reduce((s, p) => s + p.rawMarks, 0);

  const result = new Map<string, number>();

  const walk = (node: SyllabusNode, marks: number): void => {
    const children = byParent.get(node.id) ?? [];
    if (children.length === 0) {
      result.set(node.id, marks);
      return;
    }
    const totalWeight = children.reduce((s, c) => s + c.weight, 0);
    for (const child of children) walk(child, marks * (child.weight / totalWeight));
  };

  // Roots are grouped by level first: AS sections share the AS papers' marks, A2
  // sections share the A2 papers'. Without this the two halves would dilute each
  // other and the totals would not add back up to the qualification.
  const roots = byParent.get(null) ?? [];
  const pools: Record<SyllabusNode['level'], number> = {
    AS: asMarks,
    A2: a2Marks,
    both: asMarks + a2Marks,
  };
  for (const level of ['AS', 'A2', 'both'] as const) {
    const group = roots.filter((r) => r.level === level);
    if (group.length === 0) continue;
    const groupWeight = group.reduce((s, r) => s + r.weight, 0);
    for (const root of group) walk(root, pools[level] * (root.weight / groupWeight));
  }

  return result;
}

/** Minutes available per raw mark on a paper — the pacing number that saves grades. */
export function minutesPerMark(paper: Paper): number {
  return paper.durationMinutes / paper.rawMarks;
}

/**
 * How many marks one grade boundary is worth, given a typical A/A* spacing.
 * Used only for the "what moves your grade" sensitivity line, and always shown
 * as an estimate.
 */
export function marksPerGradeBand(totalRawMarks: number, bands = 8): number {
  return Math.round(totalRawMarks / bands / 2);
}
