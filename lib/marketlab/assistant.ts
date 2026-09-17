/**
 * The Lab Assistant: its rules, its prompt, and the version of it that works
 * with no API key at all.
 *
 * Two things make this assistant different from a chat box bolted onto a
 * chart.
 *
 * THE LABELS. Every claim it makes is tagged with where the claim came from —
 * established economics, something the user typed, something MarketLab
 * calculated, an assumption, a hypothesis, or a suggestion. A research tool
 * whose output cannot be sorted into those six buckets is not usable in
 * research, because the student cannot tell which parts they are allowed to
 * rely on.
 *
 * THE FALLBACK. With no key configured, the assistant does not disappear
 * behind an error. `answerLocally` reads the same lesson corpus the Learn
 * section uses and the same numbers the experiment is showing, and answers
 * from them. It is narrower than a model, and it says so, but it never invents
 * a citation and never claims a result the app did not compute.
 */

import { LESSONS, type Lesson } from "./learn/lessons";
import { EXPERIMENTS } from "./experiments";

export type Provenance = "fact" | "user-data" | "calculated" | "assumption" | "hypothesis" | "suggestion";

export const PROVENANCE_TAGS: Record<Provenance, { label: string; meaning: string }> = {
  fact: { label: "Known", meaning: "Established economics or business theory, the kind you would find in a textbook." },
  "user-data": { label: "Your data", meaning: "A value you entered or a figure from a source you supplied." },
  calculated: { label: "Calculated", meaning: "Computed by MarketLab from the inputs shown, and reproducible from them." },
  assumption: { label: "Assumption", meaning: "Something taken as given in order to proceed. It may be wrong." },
  hypothesis: { label: "Hypothesis", meaning: "A claim being tested, not one being asserted." },
  suggestion: { label: "Suggestion", meaning: "A next step to consider. It is advice, not a finding." },
};

/** What the page hands the assistant so it can talk about what is on screen. */
export interface AssistantContext {
  /** Where the user is. */
  surface: "experiment" | "research" | "tools" | "data" | "learn" | "general";
  experiment?: string;
  /** Inputs currently set, already formatted. */
  inputs?: Array<{ label: string; value: string }>;
  /** Results currently shown, already formatted. */
  outputs?: Array<{ label: string; value: string }>;
  /** The research project's title and question, when there is one. */
  projectTitle?: string;
  projectQuestion?: string;
  hypothesis?: string;
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export const SYSTEM_PROMPT = `You are Lab Assistant, the economics and business research tutor inside MarketLab. You are helping a Year 12 student working towards Cambridge AS/A-level Economics and Business who is conducting their own independent research project.

HOW YOU ANSWER

1. Label the status of every substantive claim, using these exact prefixes at the start of the relevant sentence or bullet:
   [Known] — established economics or business theory.
   [Your data] — a number the student supplied or a figure from their source.
   [Calculated] — a result MarketLab computed, quoted from the context you were given.
   [Assumption] — something being taken as given.
   [Hypothesis] — a claim being tested rather than asserted.
   [Suggestion] — a next step, clearly advice rather than a finding.

2. Be short. Aim for under 200 words unless the student asks for depth. A dense, specific answer beats a complete one.

3. End with one genuinely useful question that moves their thinking forward. One question, not three.

WHAT YOU MUST NOT DO

- Never invent a citation, a paper, an author, a statistic or a dataset. If you do not have a source, say you do not have one. It is always acceptable to say "I don't know" or "I can't verify that".
- Never claim the student ran an experiment, collected data or found a result unless it appears in the context you were given.
- Never write their research for them. You may critique, question, check arithmetic, explain a concept and suggest structure. You may not draft their conclusion, their discussion or their hypothesis as finished prose.
- Never present a MarketLab model result as evidence about a real market. The models are illustrative; say so whenever a conclusion is being drawn from one.
- Never claim MarketLab has been shown to improve learning or that its models are validated. Neither has been tested.

WHAT YOU ARE ESPECIALLY GOOD AT

- Explaining a concept in terms of the numbers currently on the student's screen.
- Checking whether a conclusion actually follows from the evidence given.
- Finding the assumption a piece of reasoning is resting on and naming it.
- Turning a vague curiosity into a research question that could actually be answered.
- Asking what result would count as evidence against a hypothesis.
- Spotting an arithmetic or sign error, especially the sign of a price elasticity.`;

export function contextBlock(context: AssistantContext | null): string {
  if (!context) return "";
  const lines: string[] = ["The student is currently looking at:"];
  lines.push(`- Section: ${context.surface}`);
  if (context.experiment) {
    const meta = EXPERIMENTS.find((e) => e.slug === context.experiment);
    lines.push(`- Experiment: ${meta ? meta.title : context.experiment}`);
    if (meta) lines.push(`- That experiment's research question: ${meta.question}`);
  }
  if (context.projectTitle) lines.push(`- Research project: ${context.projectTitle}`);
  if (context.projectQuestion) lines.push(`- Their research question: ${context.projectQuestion}`);
  if (context.hypothesis) lines.push(`- Their hypothesis: ${context.hypothesis}`);
  if (context.inputs?.length) {
    lines.push("- Inputs they have set (these are [Your data] or [Assumption]):");
    for (const i of context.inputs) lines.push(`    ${i.label}: ${i.value}`);
  }
  if (context.outputs?.length) {
    lines.push("- Results MarketLab has computed (these are [Calculated]):");
    for (const o of context.outputs) lines.push(`    ${o.label}: ${o.value}`);
  }
  lines.push("Quote these figures exactly. Do not invent any others.");
  return lines.join("\n");
}

/* ---------------------------------------------------------------------------
   The offline assistant
   ------------------------------------------------------------------------ */

export type AnswerKind = "explanation" | "critique" | "calculation" | "suggestion" | "structure" | "unknown";

export interface LocalAnswer {
  kind: AnswerKind;
  body: string;
  /** Questions back to the student. The assistant's most useful output. */
  followUp: string[];
  /** Links into MarketLab's own material. Never an external citation. */
  links: Array<{ label: string; href: string }>;
}

const STOP = new Set([
  "what", "is", "the", "a", "an", "of", "how", "does", "do", "my", "i", "can", "you",
  "explain", "tell", "me", "about", "and", "to", "in", "for", "with", "on", "it", "this",
  "that", "are", "be", "should", "would", "why", "when", "which", "s",
]);

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Scores every lesson against the question and returns the best, if any is close enough. */
export function matchLesson(question: string): Lesson | null {
  const words = keywords(question);
  if (words.length === 0) return null;
  let best: { lesson: Lesson; score: number } | null = null;
  for (const lesson of LESSONS) {
    const haystack = [
      lesson.title, lesson.summary, lesson.unit,
      ...lesson.definitions.map((d) => d.term),
      ...lesson.definitions.map((d) => d.meaning),
      ...lesson.formulae.map((f) => f.label),
      lesson.explanation.join(" "),
    ].join(" ").toLowerCase();
    let score = 0;
    for (const word of words) {
      if (lesson.title.toLowerCase().includes(word)) score += 4;
      else if (lesson.definitions.some((d) => d.term.toLowerCase().includes(word))) score += 3;
      else if (haystack.includes(word)) score += 1;
    }
    if (!best || score > best.score) best = { lesson, score };
  }
  // Two incidental word matches are not a topic. The threshold is what stops
  // the fallback confidently answering a question it did not understand.
  return best && best.score >= 4 ? best.lesson : null;
}

const CRITIQUE_CUES = /\b(hypothes\w+|critique|criticise|criticize|is my|any good|feedback|improve my|weak|strong enough|valid)\b/i;
const SUGGEST_CUES = /\b(suggest|idea|what should i|next step|what else|another experiment|research question|topic)\b/i;
const STRUCTURE_CUES = /\b(structure|outline|section|write.?up|report|essay|format|order)\b/i;
const CALC_CUES = /\b(calculat\w+|check my|working|arithmetic|sum|formula|result|number|answer)\b/i;

export function answerLocally(question: string, context: AssistantContext | null): LocalAnswer {
  const q = question.trim();
  const offlineNote = "\n\n_Offline mode: no AI key is configured, so this answer comes from MarketLab's own lesson notes and the numbers on your screen. It cannot reason about anything outside them._";

  if (q.length === 0) {
    return {
      kind: "unknown",
      body: "Ask me about a concept, a calculation on your screen, or your research question." + offlineNote,
      followUp: ["What are you trying to work out?"],
      links: [],
    };
  }

  if (CRITIQUE_CUES.test(q)) {
    const target = context?.hypothesis ?? context?.projectQuestion;
    const lines = [
      "I can give you a checklist rather than a verdict — whether a hypothesis is good depends on evidence I do not have.",
      "",
      target ? `**What you have written:** ${target}` : "**You have not written a hypothesis yet.** That is the first thing to fix.",
      "",
      "**Test it against these five:**",
      "1. **Is it falsifiable?** Name the result that would show it was wrong. If you cannot, it is not a hypothesis.",
      "2. **Is it specific?** 'Price affects revenue' is not testable. 'A 10% price rise reduces total revenue when |PED| > 1' is.",
      "3. **Does it name a mechanism?** Which piece of theory predicts this, and why?",
      "4. **Can you measure both sides?** With the data you can actually get, not the data you wish you had.",
      "5. **Is it about the model or the world?** A MarketLab result supports a claim about MarketLab's model. Saying anything about a real market needs real observations.",
    ];
    return {
      kind: "critique",
      body: lines.join("\n") + offlineNote,
      followUp: [
        "What specific result would make you abandon this hypothesis?",
        "Which of those five is weakest at the moment?",
      ],
      links: [{ label: "Research workspace", href: "/research" }],
    };
  }

  if (STRUCTURE_CUES.test(q)) {
    return {
      kind: "structure",
      body: [
        "A piece of empirical work in economics usually runs in this order, and MarketLab's research workspace lays the sections out the same way:",
        "",
        "1. **Research question** — one sentence, narrow enough to answer.",
        "2. **Hypothesis** — what you expect, and what would show you wrong.",
        "3. **Background and theory** — the model you are using and what it assumes.",
        "4. **Data sources** — where every number came from, separating observations from model output.",
        "5. **Methodology** — enough detail for someone else to reproduce your runs.",
        "6. **Results** — what you got. Numbers only; no interpretation yet.",
        "7. **Discussion** — what it means, and the strongest alternative explanation.",
        "8. **Limitations** — specific ones, not 'more research is needed'.",
        "9. **Conclusion** — the answer, stated no more strongly than the evidence allows.",
        "10. **References** — only sources you actually read.",
        "",
        "The two sections that most improve a piece of work are the ones people rush: limitations, and the alternative explanation in the discussion.",
      ].join("\n") + offlineNote,
      followUp: ["Which section are you stuck on right now?"],
      links: [{ label: "Open the research workspace", href: "/research" }],
    };
  }

  const lesson = matchLesson(q);

  if (lesson) {
    const defs = lesson.definitions.slice(0, 3).map((d) => `- **${d.term}** — ${d.meaning}`);
    const formulae = lesson.formulae.slice(0, 3).map((f) => `- \`${f.expression}\` — ${f.label}`);
    const body = [
      `**${lesson.title}**`,
      "",
      lesson.explanation[0],
      "",
      "**Key terms**",
      ...defs,
      ...(formulae.length ? ["", "**Formulae**", ...formulae] : []),
      "",
      `**Watch out for:** ${lesson.mistakes[0]}`,
    ].join("\n");

    const links: Array<{ label: string; href: string }> = [
      { label: `Read the full lesson: ${lesson.title}`, href: `/learn/${lesson.slug}` },
    ];
    if (lesson.activity) links.push({ label: lesson.activity.label, href: lesson.activity.href });

    return {
      kind: CALC_CUES.test(q) ? "calculation" : "explanation",
      body: body + offlineNote,
      followUp: [
        lesson.questions[0]?.prompt ?? `What part of ${lesson.title.toLowerCase()} is giving you trouble?`,
      ],
      links,
    };
  }

  if (SUGGEST_CUES.test(q)) {
    return {
      kind: "suggestion",
      body: [
        "Here are research questions MarketLab can actually help you investigate. Each one is answerable with the models in the app plus data you can collect yourself:",
        "",
        "- How does the revenue effect of a price change depend on the elasticity of demand, and at what elasticity does the direction flip?",
        "- How sensitive is a small business's break-even point to a change in fixed costs, and what does that say about its risk?",
        "- Under a simplified competition model, how much does the profit-maximising price depend on the assumed price sensitivity?",
        "- How do a demand shock and a supply shock of the same size differ in their effect on price versus quantity?",
        "- What happens to the modelled deadweight loss as a price ceiling is lowered further below equilibrium?",
        "",
        "Every one of those is a question about a model. To say anything about a real market you would need to pair it with observations — prices you collected, a survey you ran, or published data with a source.",
      ].join("\n") + offlineNote,
      followUp: ["Which of those is closest to something you are actually curious about?"],
      links: [{ label: "Browse the experiments", href: "/experiments" }],
    };
  }

  if (context?.outputs?.length) {
    const lines = [
      "I could not find a lesson matching that question, but I can tell you what is currently on your screen:",
      "",
      ...(context.inputs ?? []).map((i) => `- **${i.label}** — ${i.value} _(your input)_`),
      ...(context.outputs ?? []).map((o) => `- **${o.label}** — ${o.value} _(calculated by MarketLab)_`),
      "",
      "Ask me about one of those by name and I will explain how it was worked out.",
    ];
    return {
      kind: "unknown",
      body: lines.join("\n") + offlineNote,
      followUp: ["Which of those figures do you want explained?"],
      links: [],
    };
  }

  return {
    kind: "unknown",
    body: [
      "I could not find anything in MarketLab's lesson notes that matches that question, and I am not going to guess.",
      "",
      "In offline mode I can help with: the concepts covered in the Learn section, the figures on an experiment you have open, critiquing a hypothesis, and structuring a research report.",
      "",
      "Try naming a concept — elasticity, break-even, equilibrium, market failure, gearing — or ask about a number on your screen.",
    ].join("\n") + offlineNote,
    followUp: ["What is the underlying thing you are trying to work out?"],
    links: [{ label: "Browse the Learn section", href: "/learn" }],
  };
}
