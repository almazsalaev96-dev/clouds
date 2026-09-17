/**
 * The research workspace's data model.
 *
 * The one design rule here: MarketLab never writes a student's research for
 * them. There is no "generate my report" button and no section that arrives
 * pre-filled with plausible prose. What the app supplies is structure — the
 * sections a piece of empirical work actually needs, in the order the work
 * actually happens — plus the ability to attach the exact model runs a claim
 * rests on, so a reader can check it.
 *
 * `toMarkdown` exports exactly what the student wrote. An empty section
 * exports as an empty section.
 */

import type { ExperimentSlug } from "./experiments";

export type SectionId =
  | "question" | "hypothesis" | "background" | "theory" | "context"
  | "sources" | "method" | "experiments" | "results" | "discussion"
  | "limitations" | "conclusion" | "references";

export type Stage = "question" | "hypothesis" | "data" | "analyse" | "interpret" | "write";

export interface SectionSpec {
  id: SectionId;
  label: string;
  /** What belongs in this section, in one sentence. */
  guide: string;
  /** Questions to answer, shown as a checklist beside the editor. */
  prompts: string[];
  stage: Stage;
  /** Roughly how long this section usually runs, to set expectations. */
  hint: string;
}

export const STAGES: Array<{ id: Stage; label: string; blurb: string }> = [
  { id: "question", label: "Choose a question", blurb: "Narrow a curiosity into something you could actually answer." },
  { id: "hypothesis", label: "Build a hypothesis", blurb: "State what you expect, and what would show you were wrong." },
  { id: "data", label: "Collect data", blurb: "Decide what evidence counts, and where it comes from." },
  { id: "analyse", label: "Analyse", blurb: "Run the experiments and record what they gave you." },
  { id: "interpret", label: "Interpret", blurb: "Say what the results mean — and what they do not." },
  { id: "write", label: "Write up", blurb: "Assemble the argument so a reader can check it." },
];

export const SECTIONS: SectionSpec[] = [
  {
    id: "question", label: "Research question", stage: "question",
    guide: "The single question this project answers. It should be narrow enough to answer and specific about what is being measured.",
    prompts: [
      "Can you answer this with the evidence you can actually get?",
      "Does it name the thing being varied and the thing being measured?",
      "Would two people reading it agree on what counts as an answer?",
    ],
    hint: "One sentence",
  },
  {
    id: "hypothesis", label: "Hypothesis", stage: "hypothesis",
    guide: "What you expect to find, and why theory leads you to expect it. A hypothesis you cannot be wrong about is not one.",
    prompts: [
      "What result would count as supporting this?",
      "What result would count against it?",
      "Which economic theory does the expectation come from?",
    ],
    hint: "2–4 sentences",
  },
  {
    id: "background", label: "Background", stage: "question",
    guide: "Why this question is worth asking, and what is already known about it.",
    prompts: ["Who cares about the answer, and what would they do with it?", "What has already been established?"],
    hint: "200–400 words",
  },
  {
    id: "theory", label: "Economic theory", stage: "question",
    guide: "The models and definitions the project rests on, stated precisely enough that a reader knows what you are assuming.",
    prompts: ["Which model are you using?", "What does it assume?", "Where is it known to break down?"],
    hint: "200–400 words",
  },
  {
    id: "context", label: "Business context", stage: "question",
    guide: "The real setting — the firm, the market, the decision. This is what stops the project being an exercise.",
    prompts: ["Whose decision is this?", "What constraints are they actually under?"],
    hint: "150–300 words",
  },
  {
    id: "sources", label: "Data sources", stage: "data",
    guide: "Where every number came from. Distinguish published statistics, data you collected yourself, and figures produced by a model.",
    prompts: [
      "For each source: who published it, when, and covering what?",
      "Which numbers are observations and which are model output?",
      "What is each source's known weakness?",
    ],
    hint: "A list, with links",
  },
  {
    id: "method", label: "Methodology", stage: "data",
    guide: "What you did, in enough detail that someone else could repeat it and get the same numbers.",
    prompts: [
      "What were the parameter values, and why those?",
      "What was held constant?",
      "How many runs, and how were they chosen?",
    ],
    hint: "300–500 words",
  },
  {
    id: "experiments", label: "Experiments", stage: "analyse",
    guide: "Which model runs this project uses. Attach the saved runs below so a reader can reproduce each one exactly.",
    prompts: ["Does every claim in the results have a run behind it?", "Are the attached runs the ones you actually used?"],
    hint: "Attach runs, then annotate",
  },
  {
    id: "results", label: "Results", stage: "analyse",
    guide: "What the runs produced. Numbers and charts only — save the interpretation for the discussion.",
    prompts: ["Is every figure traceable to a run or a source?", "Have you reported results that did not fit the hypothesis?"],
    hint: "300–500 words + tables",
  },
  {
    id: "discussion", label: "Discussion", stage: "interpret",
    guide: "What the results mean, how well they fit the theory, and what else could explain them.",
    prompts: [
      "Does the evidence actually support the claim you are making?",
      "What is the strongest alternative explanation?",
      "Which results surprised you?",
    ],
    hint: "400–700 words",
  },
  {
    id: "limitations", label: "Limitations", stage: "interpret",
    guide: "What this project cannot show. Be specific: a model assumption, a data gap, a confound — not 'more research is needed'.",
    prompts: [
      "Which model assumption most affects your conclusion?",
      "What did you have no data on?",
      "What would change your answer if it were false?",
    ],
    hint: "200–400 words",
  },
  {
    id: "conclusion", label: "Conclusion", stage: "write",
    guide: "The answer to the research question, stated as strongly as the evidence — and no more strongly.",
    prompts: ["Does this answer the question you actually asked?", "Is the confidence in it proportionate to the evidence?"],
    hint: "150–250 words",
  },
  {
    id: "references", label: "References", stage: "write",
    guide: "Every source, in a consistent style. Only sources you actually read.",
    prompts: ["Have you cited every data source?", "Is each one something you read, not something you were told existed?"],
    hint: "A list",
  },
];

/** Where a number in this project came from. The workspace insists on knowing. */
export type Provenance = "model" | "observed" | "entered";

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  model: "Model result",
  observed: "Real-world observation",
  entered: "User-entered data",
};

export const PROVENANCE_HELP: Record<Provenance, string> = {
  model: "Produced by a MarketLab model from the parameters shown. True of the model, not of any real market.",
  observed: "Measured or published data about the real world, with a source.",
  entered: "A value you supplied — an assumption, an estimate or a plan.",
};

export interface Note {
  id: string;
  body: string;
  provenance: Provenance;
  createdAt: number;
}

/** A saved experiment run: inputs, headline outputs, and when it was taken. */
export interface SavedRun {
  id: string;
  experiment: ExperimentSlug;
  label: string;
  createdAt: number;
  /** Everything needed to reproduce the run exactly. */
  inputs: Record<string, number | string | boolean>;
  /** The headline figures, already formatted for display. */
  outputs: Array<{ label: string; value: string }>;
  note?: string;
}

export interface ResearchProject {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  sections: Partial<Record<SectionId, string>>;
  notes: Note[];
  /** IDs of saved runs attached to this project. */
  attachments: string[];
}

export function emptyProject(title = "Untitled research project", id?: string): ResearchProject {
  const now = Date.now();
  return {
    id: id ?? `proj_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    createdAt: now,
    updatedAt: now,
    sections: {},
    notes: [],
    attachments: [],
  };
}

/** A section counts as written once it has more than a few words in it. */
export function isWritten(text: string | undefined): boolean {
  return (text ?? "").trim().split(/\s+/).filter(Boolean).length >= 5;
}

export interface Progress {
  completed: number;
  total: number;
  fraction: number;
  byStage: Array<{ stage: Stage; completed: number; total: number }>;
  /** The first unwritten section, which is where "continue" goes. */
  next: SectionSpec | null;
}

export function researchProgress(project: ResearchProject): Progress {
  const completed = SECTIONS.filter((s) => isWritten(project.sections[s.id])).length;
  const byStage = STAGES.map((stage) => {
    const inStage = SECTIONS.filter((s) => s.stage === stage.id);
    return {
      stage: stage.id,
      completed: inStage.filter((s) => isWritten(project.sections[s.id])).length,
      total: inStage.length,
    };
  });
  return {
    completed,
    total: SECTIONS.length,
    fraction: SECTIONS.length === 0 ? 0 : completed / SECTIONS.length,
    byStage,
    next: SECTIONS.find((s) => !isWritten(project.sections[s.id])) ?? null,
  };
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Markdown export. Deliberately plain: headings, the student's text, and the
 * attached runs as tables. Nothing is added, summarised or smoothed.
 */
export function toMarkdown(project: ResearchProject, runs: SavedRun[] = []): string {
  const lines: string[] = [];
  lines.push(`# ${project.title}`, "");
  lines.push(`*Drafted in MarketLab · started ${formatDate(project.createdAt)} · last edited ${formatDate(project.updatedAt)}*`, "");

  for (const section of SECTIONS) {
    lines.push(`## ${section.label}`, "");
    const body = (project.sections[section.id] ?? "").trim();
    lines.push(body.length > 0 ? body : "_Not yet written._", "");

    if (section.id === "experiments" && runs.length > 0) {
      for (const run of runs) {
        lines.push(`### Run: ${run.label}`, "");
        lines.push(`*${run.experiment} · saved ${formatDate(run.createdAt)}*`, "");
        lines.push("| Input | Value |", "| --- | --- |");
        for (const [k, v] of Object.entries(run.inputs)) lines.push(`| ${k} | ${String(v)} |`);
        lines.push("", "| Result | Value |", "| --- | --- |");
        for (const out of run.outputs) lines.push(`| ${out.label} | ${out.value} |`);
        if (run.note) lines.push("", `> ${run.note}`);
        lines.push("");
      }
    }
  }

  if (project.notes.length > 0) {
    lines.push("## Research notes", "");
    for (const note of project.notes) {
      lines.push(`- **[${PROVENANCE_LABEL[note.provenance]}]** ${note.body.trim()}`);
    }
    lines.push("");
  }

  lines.push("---", "");
  lines.push(
    "Generated by MarketLab. Figures marked *Model result* come from MarketLab's own models and describe those models, not any real market. " +
    "Figures marked *Real-world observation* carry their source above. This export contains only text written by the author.",
    "",
  );
  return lines.join("\n");
}

/** A single run, exported on its own — for pasting into a lab book. */
export function runToMarkdown(run: SavedRun): string {
  const lines = [`### ${run.label}`, "", `*${run.experiment} · saved ${formatDate(run.createdAt)}*`, ""];
  lines.push("| Input | Value |", "| --- | --- |");
  for (const [k, v] of Object.entries(run.inputs)) lines.push(`| ${k} | ${String(v)} |`);
  lines.push("", "| Result | Value |", "| --- | --- |");
  for (const out of run.outputs) lines.push(`| ${out.label} | ${out.value} |`);
  if (run.note) lines.push("", `> ${run.note}`);
  lines.push("", "_Model result — produced by a MarketLab model from the inputs above._", "");
  return lines.join("\n");
}
