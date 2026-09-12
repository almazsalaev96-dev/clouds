import type { TaskKind } from "./task";

/**
 * When a picture beats a paragraph, and which picture.
 *
 * The house rules say prose by default, and they are right: structure reads as
 * thorough and usually transmits less. But that rule was written against
 * *bullets*, which delete the connective tissue of an argument — and a diagram
 * does the opposite. A flowchart is nothing but connective tissue. Left
 * unqualified, "write in prose" reads as "never draw anything", which is how
 * an app whose models all speak fluent Mermaid ended up drawing nothing.
 *
 * ## Topology, never geometry
 *
 * The single rule that decides whether this works. Asked for coordinates, a
 * model produces overlapping labels, arrows that miss their boxes and text
 * outside its container — placing things in space is measurably the weakest
 * thing these models do. Asked for *relations* — this node, that node, an edge
 * between them — it is near-perfect, because relations are language. So the
 * model is told to describe what connects to what and never where anything
 * goes, and a layout engine owns the rest.
 *
 * ## The mapping is not a preference
 *
 * Each line below pairs a shape of explanation with the form that shows it. A
 * process is a sequence of states and a flowchart is a drawing of sequenced
 * states; a comparison across two axes is a grid and a grid is a table. Getting
 * this wrong is not a matter of taste — a comparison drawn as a flowchart is
 * unreadable, and a process laid out as a table has had its order removed.
 */
const WHEN_TO_DRAW = [
  "A picture is worth it when the thing being explained is a *shape* — an order, a structure, a set of relations — and prose has to spend its sentences reconstructing that shape in the reader's head. It is not worth it for a fact, a definition, or anything one sentence already settles.",
  "Describe what connects to what and never where anything sits. No coordinates, no widths, no positions: a layout engine places it. Every model is reliable at relations and unreliable at geometry, and a diagram with overlapping labels is worse than the paragraph it replaced.",
  "Use a ```mermaid fence. This app draws them.",
  "  · a process, an algorithm, a decision — `flowchart TD`",
  "  · things happening between parties, in order — `sequenceDiagram`",
  "  · a thing that is in one of several states — `stateDiagram-v2`",
  "  · a hierarchy or a containment — `flowchart TD` with subgraphs, or `mindmap`",
  "  · events along time — `timeline`",
  "  · what relates to what — `erDiagram`, or a flowchart with undirected edges",
  "Two axes of comparison is a table, not a diagram. Quantities are a table until there are enough of them to have a shape.",
  "Keep it under about a dozen nodes. Past that the layout degrades and the picture stops being the clearer thing, which was the only reason to draw it.",
  "Never draw the same thing you just wrote. A diagram beside a paragraph restating it makes the reader reconcile two sources carrying one fact, which costs them and buys nothing — the picture replaces the passage or it does not go in.",
];

/**
 * The kinds where a drawing earns its place often enough to mention it.
 *
 * Not all of them, and deliberately. Telling a model to consider a diagram on
 * every request gets diagrams on requests that did not want one, and a
 * flowchart of a two-step process is a decoration with edges.
 */
const DRAWS: TaskKind[] = ["learning", "coding", "design", "data"];

export function visualFor(kind: TaskKind): string {
  if (!DRAWS.includes(kind)) return "";
  return ["## Drawing", "", ...WHEN_TO_DRAW].join("\n");
}
