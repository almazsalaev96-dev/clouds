/**
 * Tasks: what is unfinished, and tests.
 *
 * Exam mode exists to separate learning from performance. While a test is running
 * the tutor is gone — not hidden behind a tab, actually not called — because a
 * student who can reach for a hint is not measuring anything. It comes back the
 * moment the test ends, and what it comes back with is a diagnosis rather than a
 * mark: which topics the errors were in, and what to do about them.
 */
import { el, add, clear, icon, aiMark, plural, announce, modal, relativeTime } from "./ui.js";
import * as store from "./store.js";
import * as mastery from "../learning/mastery.js";
import { QUESTIONS, WORKSHEETS, conceptById, questionById, worksheetById } from "./bank.js";
import { diagnose as diagnoseAnswer } from "./help.js";

const EXAM_MINUTES = 12;
const EXAM_LENGTH = 8;

export function tasks(app) {
  const node = el("div", { class: "page stack g7" });
  const view = store.project();

  add(node, el("header", { class: "stack g2" }, [
    el("h1", { class: "t-title", text: "Tasks" }),
    el("p", { class: "t-2", style: { margin: 0 }, text: "What is unfinished, and how to find out where you actually stand." }),
  ]));

  const open = store.assignments().filter((a) => a.questionsDone < a.questionsTotal);
  add(node, el("section", { class: "stack g3" }, [
    el("h2", { class: "t-section", text: "Assignments" }),
    open.length
      ? el("div", { class: "card flat focus-list", style: { padding: "4px 12px" } },
          open.map((a) => el("div", { class: "focus", style: { cursor: "default" } }, [
            el("div", { class: "grow stack g2" }, [
              el("span", { style: { fontWeight: 600 }, text: a.title }),
              el("span", { class: "focus-why", text: `${a.questionsDone} of ${a.questionsTotal} answered` }),
              el("div", { class: "meter", style: { maxWidth: "220px" } },
                [el("i", { style: { width: `${Math.round((a.questionsDone / a.questionsTotal) * 100)}%` } })]),
            ]),
            el("button", { class: "btn small", onclick: () => app.openWorksheet(a.id) }, "Open"),
            el("button", { class: "btn small quiet", onclick: () => submitSheet(app, a) }, "Finish"),
          ])))
      : el("div", { class: "card empty" }, [
          el("p", { text: "Nothing outstanding. Opening a worksheet from Home starts one." }),
        ]),
  ]));

  add(node, el("section", { class: "stack g3" }, [
    el("h2", { class: "t-section", text: "Find out where you stand" }),
    el("div", { class: "tiles" }, [
      el("button", { class: "tile", onclick: () => app.go("exam") }, [
        el("div", { class: "row" }, [
          el("span", { class: "dim", html: icon("clock") }),
          el("span", { class: "tile-name", text: "Take a test" }),
        ]),
        el("span", { class: "t-2", text: `${EXAM_LENGTH} questions, ${EXAM_MINUTES} minutes, no tutor. It ends with a diagnosis rather than a score.` }),
      ]),
      el("button", { class: "tile", onclick: () => app.go("diagnose") }, [
        el("div", { class: "row" }, [
          el("span", { style: { color: "var(--ai)" }, html: icon("ai") }),
          el("span", { class: "tile-name", text: "Diagnose a topic" }),
        ]),
        el("span", { class: "t-2", text: "Three or four questions chosen to separate the possible causes, then an explanation of what is going wrong." }),
      ]),
    ]),
  ]));

  const runs = store.examRuns();
  if (runs.length) {
    add(node, el("section", { class: "stack g3" }, [
      el("h2", { class: "t-section", text: "Past tests" }),
      el("div", { class: "card flat focus-list", style: { padding: "4px 12px" } },
        runs.slice(0, 6).map((r) => el("div", { class: "focus", style: { cursor: "default" } }, [
          el("div", { class: "grow stack" }, [
            el("span", { style: { fontWeight: 600 }, text: r.headline }),
            el("span", { class: "focus-why", text: `${r.correct} of ${r.total} · ${relativeTime(r.at)}` }),
          ]),
        ]))),
    ]));
  }

  return node;
}

/** Before handing work in, say plainly what is about to be handed in. */
function submitSheet(app, assignment) {
  const ws = worksheetById[assignment.id];
  const answered = new Set(store.allEvents()
    .filter((e) => e.type === "attempt" && ws.questionIds.includes(e.questionId))
    .map((e) => e.questionId));
  const missing = ws.questionIds.filter((id) => !answered.has(id));
  const strokes = Object.values(store.strokesFor(`ws:${ws.id}`, 0) || []).length;

  const body = el("div", { class: "stack g3" }, [
    el("p", { class: "t-body", style: { margin: 0 }, text: "Ready to submit" }),
    el("ul", { class: "t-2", style: { margin: 0, paddingLeft: "20px" } }, [
      el("li", { text: `${plural(ws.questionIds.length, "question")}, ${answered.size} answered` }),
      el("li", { text: `${plural(strokes, "handwritten stroke")} on the page` }),
      missing.length ? el("li", { style: { color: "var(--warning)" },
        text: `${plural(missing.length, "question")} still unanswered — you can submit anyway.` }) : null,
    ]),
    el("p", { class: "t-2", style: { margin: 0 },
      text: "Sending to a teacher needs a server that holds their address, so here the export is a PDF: print to PDF and attach it wherever you normally would." }),
  ]);

  modal("Finish and export", body, [
    { label: "Not yet", variant: "quiet" },
    { label: "Export", variant: "primary", onclick: () => { app.openWorksheet(ws.id); setTimeout(() => window.print(), 400); } },
  ]);
}

// ----------------------------------------------------------------- the test

/**
 * The questions chosen for a test: weakest topics first, one from each before any
 * topic repeats, so the result says something about breadth rather than about a
 * single bad afternoon.
 */
function chooseQuestions(view) {
  const rank = new Map(view.concepts.map((c) => [c.conceptId, c.pUnaided]));
  const byConcept = new Map();
  for (const q of QUESTIONS) {
    if (!byConcept.has(q.conceptId)) byConcept.set(q.conceptId, []);
    byConcept.get(q.conceptId).push(q);
  }
  const concepts = [...byConcept.keys()]
    .sort((a, b) => (rank.get(a) ?? 0.4) - (rank.get(b) ?? 0.4));
  const out = [];
  let round = 0;
  while (out.length < EXAM_LENGTH && round < 6) {
    for (const id of concepts) {
      const pool = byConcept.get(id);
      if (pool[round]) out.push(pool[round]);
      if (out.length >= EXAM_LENGTH) break;
    }
    round += 1;
  }
  return out;
}

export function exam(app) {
  const node = el("div", { class: "exam" });
  const questions = chooseQuestions(store.project());
  const answers = new Array(questions.length).fill("");
  let index = 0;
  let finished = false;
  const startedAt = Date.now();
  const endsAt = startedAt + EXAM_MINUTES * 60_000;

  const clock = el("span", { class: "exam-clock num" });
  const body = el("div", { class: "exam-body" });

  const tick = () => {
    if (finished) return;
    const left = Math.max(0, endsAt - Date.now());
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    clock.textContent = `${m}:${String(s).padStart(2, "0")}`;
    clock.classList.toggle("low", left < 60_000);
    if (left <= 0) finish();
  };
  const timer = setInterval(tick, 1000);
  tick();
  node.addEventListener("slate:teardown", () => clearInterval(timer));

  const bar = el("header", { class: "exam-bar" }, [
    el("span", { class: "t-2 num", id: "exam-count", text: `Question 1 of ${questions.length}` }),
    el("div", { class: "row" }, [
      el("span", { class: "dim", html: icon("clock", 18) }), clock,
      el("button", { class: "btn quiet small", onclick: () => confirmQuit() }, "End"),
    ]),
  ]);

  function renderQuestion() {
    clear(body);
    const q = questions[index];
    bar.querySelector("#exam-count").textContent = `Question ${index + 1} of ${questions.length}`;
    const field = el("input", {
      class: "field", type: "text", value: answers[index], autocomplete: "off",
      spellcheck: "false", placeholder: "Your answer", "aria-label": "Your answer",
      oninput: (e) => { answers[index] = e.target.value; },
      onkeydown: (e) => { if (e.key === "Enter") next(); },
    });
    add(body, el("div", { class: "exam-inner" }, [
      el("span", { class: "t-cap", text: conceptById[q.conceptId].name }),
      el("p", { class: "exam-q", style: { margin: 0 }, text: q.prompt }),
      field,
      el("div", { class: "spread" }, [
        el("button", {
          class: "btn quiet", disabled: index === 0,
          onclick: () => { index -= 1; renderQuestion(); },
        }, "Back"),
        el("button", { class: "btn primary", onclick: next },
          index === questions.length - 1 ? "Finish" : "Next"),
      ]),
    ]));
    field.focus();
  }

  function next() {
    if (index === questions.length - 1) finish();
    else { index += 1; renderQuestion(); }
  }

  function confirmQuit() {
    modal("End the test?", el("p", { text: "Your answers so far will still be marked and diagnosed." }), [
      { label: "Keep going", variant: "quiet" },
      { label: "End it", variant: "primary", onclick: () => finish() },
    ]);
  }

  /** Every test produces a diagnosis. A score alone tells the student nothing. */
  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(timer);

    const marked = questions.map((q, i) => {
      const submitted = answers[i].trim();
      const result = submitted ? app.grade(submitted, q.expected)
        : { verdict: "abstain", reason: "left blank", nearMiss: null, parsed: false };
      const diagnosis = diagnoseAnswer(result, q);
      store.append({
        type: "attempt", questionId: q.id, conceptId: q.conceptId, submitted,
        outcome: result.verdict === "correct" ? "correct"
          : result.verdict === "partiallyCorrect" ? "partial" : "incorrect",
        errorType: submitted ? diagnosis.errorType : "unreadable",
        nearMiss: result.nearMiss ? result.nearMiss.kind : null,
        assistance: "none", kind: "exam", sessionId: store.sessionId,
        graderReason: result.reason,
      });
      return { q, submitted, result, diagnosis };
    });
    store.invalidate();

    const correct = marked.filter((m) => m.result.verdict === "correct").length;
    const byConcept = new Map();
    for (const m of marked) {
      const entry = byConcept.get(m.q.conceptId) || { right: 0, total: 0, kinds: [] };
      entry.total += 1;
      if (m.result.verdict === "correct") entry.right += 1;
      else if (m.result.nearMiss) entry.kinds.push(m.result.nearMiss.kind);
      byConcept.set(m.q.conceptId, entry);
    }
    const weakest = [...byConcept.entries()]
      .sort((a, b) => (a[1].right / a[1].total) - (b[1].right / b[1].total));
    const headline = weakest.length && weakest[0][1].right < weakest[0][1].total
      ? `Weakest under time: ${conceptById[weakest[0][0]].name}`
      : "Held up across every topic";

    store.append({
      type: "examCompleted", correct, total: questions.length, headline,
      minutes: Math.round((Date.now() - startedAt) / 60000),
      sessionId: store.sessionId,
    });
    store.invalidate();
    renderDiagnosis(marked, correct, byConcept, headline);
  }

  function renderDiagnosis(marked, correct, byConcept, headline) {
    clear(node);
    const view = store.project();
    add(node, el("div", { class: "scroll" }, [
      el("div", { class: "page stack g6" }, [
        el("header", { class: "stack g2" }, [
          el("span", { class: "t-cap", text: "Diagnosis" }),
          el("h1", { class: "t-title", text: headline }),
          el("p", { class: "t-2", style: { margin: 0 },
            text: `${correct} of ${marked.length} correct in ${Math.round((Date.now() - startedAt) / 60000)} minutes. The number matters less than the pattern below.` }),
        ]),

        el("section", { class: "card stack g4" }, [
          el("h2", { class: "t-section", text: "By topic" }),
          el("div", { class: "stack g3" }, [...byConcept.entries()].map(([id, e]) => el("div", { class: "stack g2" }, [
            el("div", { class: "spread" }, [
              el("span", { style: { fontWeight: 600 }, text: conceptById[id].name }),
              el("span", { class: "t-2 num", text: `${e.right} / ${e.total}` }),
            ]),
            el("div", { class: `meter ${e.right === e.total ? "success" : e.right ? "warning" : ""}`.trim() },
              [el("i", { style: { width: `${Math.round((e.right / e.total) * 100)}%` } })]),
            e.kinds.length ? el("span", { class: "t-2", text: `Errors of one kind: ${[...new Set(e.kinds)].join(", ")}` }) : null,
          ]))),
        ]),

        el("section", { class: "card stack g4" }, [
          el("h2", { class: "t-section", text: "Question by question" }),
          el("div", { class: "stack g3" }, marked.map((m) => el("div", { class: "stack g2" }, [
            el("div", { class: "spread" }, [
              el("span", { class: "t-math", text: m.q.prompt }),
              el("span", { class: `tag ${m.result.verdict === "correct" ? "mastered" : "weak"}`,
                text: m.result.verdict === "correct" ? "Correct" : m.submitted ? "Wrong" : "Blank" }),
            ]),
            m.result.verdict === "correct" ? null
              : el("span", { class: "t-2", text: m.submitted
                  ? `You wrote ${m.submitted}. ${[m.diagnosis.right, m.diagnosis.fix].filter(Boolean).join(" ")}`
                  : `Left blank. The answer is ${m.q.solution}.` }),
          ]))),
        ]),

        el("section", { class: "card stack g3", style: { borderColor: "var(--ai-line)" } }, [
          el("div", { class: "row" }, [aiMark("idle"), el("span", { class: "t-cap", style: { color: "var(--ai)" }, text: "What to do next" })]),
          el("p", { class: "t-body", style: { margin: 0 },
            text: view.nextBestAction ? `${view.nextBestAction.title} — ${view.nextBestAction.reason}` : "Keep practising; there is not enough here yet to point anywhere specific." }),
          el("div", { class: "row wrap" }, [
            view.nextBestAction ? el("button", {
              class: "btn primary", onclick: () => app.start(view.nextBestAction),
            }, "Start") : null,
            el("button", { class: "btn quiet", onclick: () => app.go("home") }, "Back to Home"),
          ]),
        ]),
      ]),
    ]));
    announce(`Test finished. ${headline}`);
  }

  add(node, bar, body);
  renderQuestion();
  return node;
}
