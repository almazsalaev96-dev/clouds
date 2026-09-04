/**
 * Cambridge International AS & A Level Business (9609) — syllabus structure.
 *
 * Papers, durations, raw marks and assessment-objective weightings follow the
 * published syllabus for the current series; the topic tree follows the syllabus
 * content sections. Sub-topic *weights* are our own teaching estimate — Cambridge
 * does not publish marks per sub-topic — and drive nothing more than the ordering
 * of the revision plan.
 *
 * Verify against the official syllabus PDF before an exam series; when the owner
 * uploads their copy, the ingestion pipeline replaces this file's numbers with
 * theirs.
 */

import type { Syllabus, SyllabusNode } from '../schema';

const section = (
  id: string,
  code: string,
  title: string,
  level: SyllabusNode['level'],
  children: [string, string, number?][],
): SyllabusNode[] => [
  { id, code, title, parentId: null, level, weight: 1 },
  ...children.map(([childCode, childTitle, weight]) => ({
    id: `${id}.${childCode}`,
    code: childCode,
    title: childTitle,
    parentId: id,
    level,
    weight: weight ?? 1,
  })),
];

const nodes: SyllabusNode[] = [
  ...section('s1', '1', 'Business and its environment', 'AS', [
    ['1.1', 'Enterprise'],
    ['1.2', 'Business structure'],
    ['1.3', 'Size of business'],
    ['1.4', 'Business objectives'],
    ['1.5', 'Stakeholders in a business'],
  ]),
  ...section('s2', '2', 'People in organisations', 'AS', [
    ['2.1', 'Human resource management'],
    ['2.2', 'Motivation', 1.3],
    ['2.3', 'Management and leadership'],
  ]),
  ...section('s3', '3', 'Marketing', 'AS', [
    ['3.1', 'The nature of marketing'],
    ['3.2', 'Market research'],
    ['3.3', 'The marketing mix', 1.5],
  ]),
  ...section('s4', '4', 'Operations management', 'AS', [
    ['4.1', 'The nature of operations'],
    ['4.2', 'Inventory management'],
    ['4.3', 'Capacity utilisation'],
    ['4.4', 'Quality management'],
  ]),
  ...section('s5', '5', 'Finance and accounting', 'AS', [
    ['5.1', 'Business finance'],
    ['5.2', 'Costs'],
    ['5.3', 'Break-even analysis', 1.3],
    ['5.4', 'Budgets'],
    ['5.5', 'Cash flow forecasting and working capital'],
    ['5.6', 'Financial statements'],
  ]),
  ...section('s6', '6', 'Business and its environment (A Level)', 'A2', [
    ['6.1', 'External influences on business activity'],
    ['6.2', 'Business strategy', 1.4],
    ['6.3', 'Corporate planning and implementation'],
  ]),
  ...section('s7', '7', 'People in organisations (A Level)', 'A2', [
    ['7.1', 'Organisational structure'],
    ['7.2', 'Business communication'],
    ['7.3', 'Leadership'],
    ['7.4', 'Human resource management strategy'],
  ]),
  ...section('s8', '8', 'Marketing (A Level)', 'A2', [
    ['8.1', 'Elasticity of demand'],
    ['8.2', 'Product development and the product life cycle'],
    ['8.3', 'Sales forecasting'],
    ['8.4', 'Marketing planning and international marketing'],
  ]),
  ...section('s9', '9', 'Operations and project management', 'A2', [
    ['9.1', 'Location and scale of operations'],
    ['9.2', 'Quality management and lean production'],
    ['9.3', 'Project management and critical path analysis', 1.4],
  ]),
  ...section('s10', '10', 'Finance and accounting (A Level)', 'A2', [
    ['10.1', 'Financial statements and ratio analysis', 1.4],
    ['10.2', 'Investment appraisal', 1.4],
    ['10.3', 'Long-term financing strategy'],
  ]),
];

export const business9609: Syllabus = {
  id: 'cie-9609',
  board: 'Cambridge International',
  subject: 'Business',
  code: '9609',
  validFor: '2026–2028',
  sourceNote:
    'Paper structure and AO weightings from the published 9609 syllabus. Sub-topic weights are an Atlas teaching estimate, not a board figure.',
  papers: [
    {
      id: 'p1',
      name: 'Paper 1 — Business Concepts 1',
      rawMarks: 40,
      qualificationWeight: 0.2,
      durationMinutes: 75,
      level: 'AS',
      aoWeights: { AO1: 0.35, AO2: 0.3, AO3: 0.2, AO4: 0.15 },
    },
    {
      id: 'p2',
      name: 'Paper 2 — Business Concepts 2',
      rawMarks: 60,
      qualificationWeight: 0.3,
      durationMinutes: 90,
      level: 'AS',
      aoWeights: { AO1: 0.3, AO2: 0.3, AO3: 0.2, AO4: 0.2 },
    },
    {
      id: 'p3',
      name: 'Paper 3 — Business Decision-Making',
      rawMarks: 60,
      qualificationWeight: 0.3,
      durationMinutes: 105,
      level: 'A2',
      // The syllabus prints rounded percentages (27%/23%); the underlying mark
      // allocation is integer (16 and 14 of 60), so we store the exact fractions.
      // Rounded values would leak 0.2 of a mark into the AO totals.
      aoWeights: { AO1: 12 / 60, AO2: 16 / 60, AO3: 14 / 60, AO4: 18 / 60 },
    },
    {
      id: 'p4',
      name: 'Paper 4 — Business Strategy',
      rawMarks: 40,
      qualificationWeight: 0.2,
      durationMinutes: 75,
      level: 'A2',
      aoWeights: { AO1: 0.15, AO2: 0.1, AO3: 0.4, AO4: 0.35 },
    },
  ],
  nodes,
};
