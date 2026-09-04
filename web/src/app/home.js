/**
 * Home.
 *
 * Not a dashboard. The screen answers one question — what is the most useful thing
 * this student can do right now — and everything else on it is secondary to that
 * answer. There are no streaks, no daily targets and no counters designed to bring
 * anyone back tomorrow; the recommendation is ranked by value per minute from the
 * student's own evidence, and it will happily tell them to stop.
 */
import { el, add, icon, aiMark, plural, greeting, relativeTime } from "./ui.js";
import * as store from "./store.js";
import * as engine from "../learning/index.js";
import { WORKSHEETS, CONCEPTS, worksheetById } from "./bank.js";
import { clearExample } from "./seed.js";

const STATE_LABEL = {
  unseen: "Not started", introduced: "Introduced", practicing: "Practising",
  developing: "Developing", reliable: "Strong", transferable: "Transfers", mastered: "Mastered",
};
const STATE_TAG = {
  unseen: "unknown", introduced: "unknown", practicing: "weak",
  developing: "developing", reliable: "strong", transferable: "strong", mastered: "mastered",
};
const ACTION_KIND = {
  fixWeakness: "Work on a weakness", retrievalReview: "Recall practice",
  transferProbe: "Check it transfers", finishAssignment: "Finish what is started",
  diagnostic: "Find out what is wrong", rest: "Stop for now",
};

export function home(app) {
  const view = store.project();
  const node = el("div", { class: "page stack g7" });
  const name = store.getPref("name", "");

  add(node, el("header", { class: "greet" }, [
    el("h1", { class: "t-large", text: name ? `${greeting()}, ${name}` : `${greeting()}` }),
    el("p", { class: "t-2", style: { margin: "6px 0 0" }, text: line(view) }),
  ]));

  if (store.getPref("exampleHistory", false)) {
    add(node, el("div", { class: "notice" }, [
      el("p", { text: "Everything here is worked out from three weeks of example history, so there is something to show. It is not your work." }),
      el("button", {
        class: "btn quiet small",
        onclick: () => { clearExample(store); app.rerender(); },
      }, "Clear it"),
    ]));
  }

  add(node, nextStep(app, view));

  const pattern = view.patterns[0];
  if (pattern) add(node, patternCard(app, pattern));

  const rest = view.recommendations.filter((r) => r !== view.nextBestAction && r.kind !== "rest").slice(0, 3);
  if (rest.length) {
    add(node, el("section", { class: "stack g3" }, [
      el("h2", { class: "t-section", text: "Your focus" }),
      el("div", { class: "card flat focus-list", style: { padding: "4px 12px" } },
        rest.map((r) => el("button", { class: "focus", onclick: () => app.start(r) }, [
          el("div", { class: "grow stack" }, [
            el("span", { style: { fontWeight: 600 }, text: r.title }),
            el("span", { class: "focus-why", text: r.reason }),
          ]),
          el("span", { class: "focus-min", text: `${Math.round(r.minutes)} min` }),
          el("span", { class: "dim-3", html: icon("chevron", 18) }),
        ]))),
    ]));
  }

  add(node, continueCard(app, view));
  add(node, topics(app, view));
  return node;
}

function line(view) {
  const answers = store.allEvents().filter((e) => e.type === "attempt").length;
  if (!answers) return "Nothing recorded yet. Open a worksheet and this becomes specific.";
  const minutes = Math.round(store.minutesWorkedToday());
  const fading = view.concepts.filter((c) => c.needsReview).length;
  return [
    `${plural(answers, "answer")} recorded`,
    minutes > 1 ? `about ${minutes} minutes today` : null,
    fading ? `${plural(fading, "topic")} fading` : null,
  ].filter(Boolean).join(" · ");
}

/** The single recommendation, presented as the AI's own reading of the evidence. */
function nextStep(app, view) {
  const next = view.nextBestAction;
  if (!next) {
    return el("section", { class: "next" }, [
      el("div", { class: "row" }, [aiMark("idle"), el("span", { class: "t-cap", text: "Your next step" })]),
      el("h2", { class: "t-title", text: "Start anywhere" }),
      el("p", { class: "t-body dim", style: { margin: 0 },
        text: "There is no evidence yet, so there is nothing honest to recommend. Pick a topic below; after a few answers this becomes specific." }),
    ]);
  }
  return el("section", { class: "next" }, [
    el("div", { class: "row" }, [aiMark("idle"), el("span", { class: "t-cap", text: "Your next step" })]),
    el("h2", { class: "t-title", text: next.title }),
    el("p", { class: "t-body dim", style: { margin: 0 }, text: next.reason }),
    el("div", { class: "row wrap" }, [
      next.kind === "rest" ? null : el("button", { class: "btn primary", onclick: () => app.start(next) }, "Start"),
      el("span", { class: "t-2", text: `${ACTION_KIND[next.kind] || next.kind} · about ${Math.round(next.minutes)} minutes` }),
    ]),
    el("details", {}, [
      el("summary", { class: "t-2", style: { cursor: "pointer" }, text: "Why this, and not something else" }),
      el("ul", { class: "t-2", style: { margin: "8px 0 0", paddingLeft: "20px" } },
        view.recommendations.slice(0, 5).map((r) => el("li", {
          text: `${r.title} — value ${r.value.toFixed(2)} over ${Math.round(r.minutes)} min = ${r.score.toFixed(3)} per minute`,
        }))),
    ]),
  ]);
}

/**
 * Proactive, but only when the evidence clears a bar: three occurrences across two
 * different questions. A bad afternoon is not a pattern, and saying it is would
 * teach the student to distrust everything else on this screen.
 */
function patternCard(app, pattern) {
  return el("section", { class: "card", style: { borderColor: "var(--ai-line)" } }, [
    el("div", { class: "row", style: { marginBottom: "8px" } }, [
      aiMark("idle"), el("span", { class: "t-cap", style: { color: "var(--ai)" }, text: "I noticed a pattern" }),
    ]),
    el("p", { class: "t-body", style: { margin: "0 0 4px" }, text: engine.misconceptions.headline(pattern) }),
    el("p", { class: "t-2", style: { margin: "0 0 16px" },
      text: `Across ${plural(pattern.distinctQuestions, "different question")}, most recently ${relativeTime(pattern.lastSeen)}.` }),
    el("div", { class: "row wrap" }, [
      el("button", {
        class: "btn small", onclick: () => app.go("diagnose", { conceptId: pattern.conceptIds[0] }),
      }, "Understand why"),
      el("button", {
        class: "btn quiet small",
        onclick: () => { const w = WORKSHEETS.find((x) => x.conceptIds.includes(pattern.conceptIds[0])); if (w) app.openWorksheet(w.id); },
      }, "Practise it"),
    ]),
  ]);
}

function continueCard(app, view) {
  const last = [...store.allEvents()].reverse().find((e) => e.type === "attempt");
  if (!last) return null;
  const worksheet = WORKSHEETS.find((w) => w.conceptIds.some((c) => c === last.conceptId));
  if (!worksheet) return null;
  const answered = new Set(store.allEvents()
    .filter((e) => e.type === "attempt" && worksheet.questionIds.includes(e.questionId))
    .map((e) => e.questionId));
  const done = answered.size;
  const total = worksheet.questionIds.length;
  const concept = view.concepts.find((c) => c.conceptId === worksheet.conceptIds[0]);

  return el("section", { class: "stack g3" }, [
    el("h2", { class: "t-section", text: "Continue" }),
    el("div", { class: "card" }, [
      el("div", { class: "spread", style: { alignItems: "flex-start" } }, [
        el("div", { class: "stack g2 grow" }, [
          el("span", { class: "t-cap", text: "Mathematics" }),
          el("span", { class: "t-sub", text: worksheet.title }),
          el("span", { class: "t-2", text: `Question ${Math.min(done + 1, total)} of ${total} · ${Math.round((done / total) * 100)}% answered` }),
        ]),
        el("button", { class: "btn primary", onclick: () => app.openWorksheet(worksheet.id) }, "Continue"),
      ]),
      el("div", { class: "meter", style: { marginTop: "16px" } }, [
        el("i", { style: { width: `${Math.round((done / total) * 100)}%` } }),
      ]),
      concept ? el("p", { class: "t-2", style: { margin: "8px 0 0" },
        text: `${Math.round(concept.pUnaided * 100)}% unaided on this topic · ${STATE_LABEL[concept.state]}` }) : null,
    ]),
  ]);
}

function topics(app, view) {
  return el("section", { class: "stack g3" }, [
    el("div", { class: "spread" }, [
      el("h2", { class: "t-section", text: "Mathematics" }),
      el("button", { class: "btn quiet small", onclick: () => app.go("subjects") }, "Knowledge map"),
    ]),
    el("div", { class: "tiles" }, CONCEPTS.map((c) => {
      const v = view.concepts.find((x) => x.conceptId === c.id);
      const worksheet = WORKSHEETS.find((w) => w.conceptIds.includes(c.id));
      const state = v ? v.state : "unseen";
      return el("button", { class: "tile", onclick: () => worksheet && app.openWorksheet(worksheet.id) }, [
        el("div", { class: "spread" }, [
          el("span", { class: "tile-name", text: c.name }),
          el("span", { class: `tag ${STATE_TAG[state]}`, text: STATE_LABEL[state] }),
        ]),
        el("div", { class: `meter ${v && v.pUnaided > 0.75 ? "success" : ""}`.trim() }, [
          el("i", { style: { width: `${Math.round((v ? v.pUnaided : 0) * 100)}%` } }),
        ]),
        el("span", { class: "t-2 num", text: v ? `${Math.round(v.pUnaided * 100)}% unaided · ${plural(v.attempts, "attempt")}` : "No evidence yet" }),
      ]);
    })),
  ]);
}
