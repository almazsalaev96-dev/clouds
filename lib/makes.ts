/**
 * Things you can make.
 *
 * This half is the list: a name, a blurb, a mark and the half-sentence the
 * composer offers. Small on purpose — it is in the first bundle, because the
 * row has to be there before anyone presses anything.
 *
 * The other half is the folders themselves, and they are forty-eight kilobytes
 * of markup, styling and behaviour that most people will never press. Those
 * live in `makes.templates` and arrive when one is actually chosen, which is a
 * network round trip nobody notices against a database write and a page load,
 * and forty-eight kilobytes everybody else never pays for.
 */

export interface Make {
  id: string;
  name: string;
  blurb: string;
  /** Named here, resolved to a component where the icons live. */
  icon: string;
  /** What the canvas is called when you make one. */
  title: string;
  /** The half-sentence the composer offers, for filling it with your material. */
  ask: string;
  /** The folder, fetched when it is wanted. */
  files: () => Promise<{ name: string; lang: string; content: string }[]>;
}

const load = () => import("./makes.templates");

export const MAKES: Make[] = [

  {
    id: "flashcards",
    name: "Flashcards",
    blurb: "A deck that flips. Space, arrows, again-later.",
    icon: "Sparkles",
    title: "Flashcards",
    ask: "Fill this deck with cards for ",
    files: async () => (await load()).flashcards(),
  },
  {
    id: "timetable",
    name: "Timetable",
    blurb: "A week grid with a line that says where you are.",
    icon: "CalendarRange",
    title: "Week",
    ask: "Fill this timetable in with ",
    files: async () => (await load()).timetable(),
  },
  {
    id: "quiz",
    name: "Quiz",
    blurb: "One question at a time, scored, with the why.",
    icon: "ListChecks",
    title: "Quiz",
    ask: "Write the questions for a quiz on ",
    files: async () => (await load()).quiz(),
  },
  {
    id: "checklist",
    name: "Checklist",
    blurb: "A list that ticks, sweeps and keeps count.",
    icon: "CheckCheck",
    title: "Checklist",
    ask: "Fill this checklist in for ",
    files: async () => (await load()).checklist(),
  },
  {
    id: "timer",
    name: "Timer",
    blurb: "A ring that sweeps. Focus, break, repeat.",
    icon: "Timer",
    title: "Focus timer",
    ask: "Set this timer up for ",
    files: async () => (await load()).timer(),
  },
  {
    id: "mindmap",
    name: "Mind map",
    blurb: "A topic in the middle, branches you can grow and drag.",
    icon: "GitBranch",
    title: "Mind map",
    ask: "Fill this mind map in for ",
    files: async () => (await load()).mindmap(),
  },
  {
    id: "kanban",
    name: "Board",
    blurb: "To do, doing, done. Drag cards across, or press the arrows.",
    icon: "Columns3",
    title: "Board",
    ask: "Fill this board with ",
    files: async () => (await load()).kanban(),
  },
  {
    id: "countdown",
    name: "Countdown",
    blurb: "Days to the exam, and the milestones on the way.",
    icon: "Hourglass",
    title: "Countdown",
    ask: "Set this countdown for ",
    files: async () => (await load()).countdown(),
  },
  {
    id: "whiteboard",
    name: "Whiteboard",
    blurb: "Draw, erase, undo. Saves as a picture.",
    icon: "PenTool",
    title: "Whiteboard",
    ask: "Set this whiteboard up with ",
    files: async () => (await load()).whiteboard(),
  },
  {
    id: "plotter",
    name: "Graph",
    blurb: "Type y = f(x) and see it. Pan, zoom, read a point.",
    icon: "LineChart",
    title: "Graph",
    ask: "Plot these on the graph: ",
    files: async () => (await load()).plotter(),
  },
];

export function findMake(id: string | undefined): Make | undefined {
  return MAKES.find((m) => m.id === id);
}
