/** The screens that are not the page: Desk, Diagnose, Progress, Settings. */
import { el, clear, add, plural, relativeTime, sheet as modal, announce } from "./ui.js";
import * as store from "./store.js";
import * as engine from "../learning/index.js";
import { WORKSHEETS, CONCEPTS, conceptById, worksheetById } from "./bank.js";
import { DIAGNOSTICS, diagnosticFor, hypothesisById } from "./diagnostics.js";
import { clearExample } from "./seed.js";

const STATE_COPY = {
  unseen: "not started",
  introduced: "shown, not yet demonstrated",
  practicing: "practising",
  developing: "developing",
  reliable: "reliable",
  transferable: "transfers to new situations",
  mastered: "mastered",
};

const ACTION_COPY = {
  fixWeakness: "Work on a weakness",
  retrievalReview: "Recall practice",
  transferProbe: "Check it transfers",
  finishAssignment: "Finish what is started",
  diagnostic: "Find out what is wrong",
  rest: "Stop for now",
};

// ------------------------------------------------------------------- Desk

export function desk(app) {
  const view = store.project();
  const node = el("div", { class: "screen desk" });

  node.appendChild(el("header", { class: "screen-head" }, [
    el("h1", { text: "Desk" }),
    el("p", { class: "muted", text: sessionLine(view) }),
  ]));

  if (store.getPref("exampleHistory", false)) {
    node.appendChild(el("div", { class: "notice" }, [
      el("p", { text: "Everything below is worked out from three weeks of example history, so there is something to show. It is not your work." }),
      el("button", {
        class: "btn ghost", onclick: () => { clearExample(store); app.rerender(); announce("Example history cleared"); },
      }, "Clear it and start from nothing"),
    ]));
  }

  const next = view.nextBestAction;
  if (next) {
    node.appendChild(el("section", { class: `card next ${next.kind === "rest" ? "rest" : ""}`.trim() }, [
      el("span", { class: "card-kind", text: ACTION_COPY[next.kind] || next.kind }),
      el("h2", { text: next.title }),
      el("p", { class: "card-reason", text: next.reason }),
      el("p", { class: "muted small", text: `About ${Math.round(next.minutes)} minutes.` }),
      next.kind === "rest" ? null : el("button", {
        class: "btn primary", onclick: () => startAction(app, next),
      }, "Start"),
      el("details", { class: "why" }, [
        el("summary", { text: "Why this, and not something else" }),
        el("ul", { class: "reasons" }, view.recommendations.slice(0, 5).map((r) =>
          el("li", { text: `${r.title} — value ${r.value.toFixed(2)} over ${r.minutes} min = ${r.score.toFixed(3)} per minute` }))),
        el("p", { class: "muted small", text: "Ranked by value per minute. Nothing here is a streak, a target or a nudge to keep going." }),
      ]),
    ]));
  } else {
    node.appendChild(el("section", { class: "card" }, [
      el("h2", { text: "Start anywhere" }),
      el("p", { class: "muted", text: "There is no evidence yet, so there is nothing to recommend. Pick a worksheet below — after a few answers this becomes specific." }),
    ]));
  }

  if (view.plan.length > 1) {
    node.appendChild(el("section", { class: "card" }, [
      el("h2", { text: "If you have half an hour" }),
      el("ol", { class: "plan" }, view.plan.map((p) => el("li", {}, [
        el("span", { class: "plan-title", text: p.title }),
        el("span", { class: "plan-min", text: `${Math.round(p.minutes)} min` }),
      ]))),
    ]));
  }

  const fading = view.concepts.filter((c) => c.needsReview);
  if (fading.length) {
    node.appendChild(el("section", { class: "card" }, [
      el("h2", { text: "Fading" }),
      el("p", { class: "muted small", text: "You knew these. The estimate is that recall has dropped since." }),
      el("ul", { class: "list" }, fading.map((c) => el("li", {}, [
        el("span", { text: c.name }),
        el("span", { class: "muted", text: `recall ${Math.round(c.retrievability * 100)}%` }),
      ]))),
    ]));
  }

  if (view.patterns.length) {
    node.appendChild(el("section", { class: "card" }, [
      el("h2", { text: "A pattern, not a one-off" }),
      el("ul", { class: "list" }, view.patterns.map((p) => el("li", {}, [
        el("span", { text: engine.misconceptions.headline(p) }),
      ]))),
      el("p", { class: "muted small", text: `Shown only after ${engine.misconceptions.MIN_OCCURRENCES} occurrences across ${engine.misconceptions.MIN_DISTINCT_QUESTIONS} different questions, so a bad afternoon is not called a pattern.` }),
    ]));
  }

  node.appendChild(el("section", { class: "card" }, [
    el("h2", { text: "Worksheets" }),
    el("div", { class: "grid" }, WORKSHEETS.map((ws) => {
      const c = view.concepts.find((x) => x.conceptId === ws.conceptIds[0]);
      return el("button", {
        class: "tile", onclick: () => openWorksheet(app, ws.id),
      }, [
        el("span", { class: "tile-title", text: ws.title }),
        el("span", { class: "tile-sub", text: c ? `${Math.round(c.pUnaided * 100)}% unaided · ${STATE_COPY[c.state]}` : "not started" }),
      ]);
    })),
  ]));

  node.appendChild(el("section", { class: "card" }, [
    el("h2", { text: "Your own material" }),
    el("p", { class: "muted small", text: "Import a PDF and write on it with the Pencil. The file is never modified: your ink is a separate layer." }),
    el("button", { class: "btn", onclick: () => app.importPdf() }, "Import a PDF"),
  ]));

  return node;
}

function sessionLine(view) {
  const answered = store.allEvents().filter((e) => e.type === "attempt").length;
  if (!answered) return "Nothing recorded yet. Everything below becomes specific once there is evidence.";
  const worked = Math.round(store.minutesWorkedToday());
  return `${plural(answered, "answer")} recorded${worked > 1 ? `, about ${worked} minutes of work today` : ""}.`;
}

function openWorksheet(app, worksheetId) {
  const ws = worksheetById[worksheetId];
  const already = store.allEvents().some((e) => e.type === "worksheetOpened" && e.assignmentId === worksheetId);
  if (!already) {
    store.append({
      type: "worksheetOpened", assignmentId: worksheetId, title: ws.title,
      conceptIds: ws.conceptIds, questionsTotal: ws.questionIds.length,
    });
    store.invalidate();
  }
  app.openDocument({ id: `ws:${worksheetId}`, kind: "worksheet", worksheetId, title: ws.title });
}

function startAction(app, action) {
  if (action.kind === "diagnostic") { app.go("diagnose", { conceptId: action.conceptIds[0] }); return; }
  if (action.assignmentId) { openWorksheet(app, action.assignmentId); return; }
  const conceptId = action.conceptIds[0];
  const ws = WORKSHEETS.find((w) => w.conceptIds.includes(conceptId));
  if (ws) openWorksheet(app, ws.id);
  else app.go("progress");
}

// --------------------------------------------------------------- Diagnose

export function diagnose(app, params = {}) {
  const node = el("div", { class: "screen" });
  node.appendChild(el("header", { class: "screen-head" }, [
    el("h1", { text: "Diagnose" }),
    el("p", { class: "muted", text: "This does not produce a score. It produces an explanation for what is going wrong, and stops as soon as one explanation is likely enough." }),
  ]));

  const body = el("div");
  node.appendChild(body);

  const chooser = () => {
    clear(body).appendChild(el("section", { class: "card" }, [
      el("h2", { text: "Pick a topic" }),
      el("div", { class: "grid" }, DIAGNOSTICS.map((d) => el("button", {
        class: "tile", onclick: () => run(d),
      }, [
        el("span", { class: "tile-title", text: d.title }),
        el("span", { class: "tile-sub", text: `${d.hypotheses.length} competing explanations` }),
      ]))),
    ]));
  };

  const run = (diagnostic) => {
    let state = engine.eig.newRun(diagnostic.hypotheses);
    const startedAt = Date.now();
    const h0 = engine.eig.remainingUncertainty(state);

    const step = () => {
      clear(body);
      const question = engine.eig.selectNext(state.prior, diagnostic.questions, state.asked);
      const confident = engine.eig.isConfident(state, 0.8);

      body.appendChild(el("section", { class: "card thin" }, [
        el("div", { class: "bits" }, [
          el("div", { class: "bits-bar" }, [
            el("div", {
              class: "bits-fill",
              style: { width: `${Math.max(2, Math.round((engine.eig.remainingUncertainty(state) / h0) * 100))}%` },
            }),
          ]),
          el("p", {
            class: "muted small",
            text: `${engine.eig.remainingUncertainty(state).toFixed(2)} of ${h0.toFixed(2)} bits of uncertainty left after ${plural(state.asked.length, "question")}.`,
          }),
        ]),
      ]));

      if (confident || !question) {
        finish(diagnostic, state, startedAt, h0);
        return;
      }

      const gain = engine.eig.expectedInformationGain(state.prior, question);
      body.appendChild(el("section", { class: "card" }, [
        el("p", { class: "q-prompt", text: question.prompt }),
        el("div", { class: "options" }, question.options.map((o) => el("button", {
          class: "btn option",
          onclick: () => { state = engine.eig.observe(state, question, o.response); step(); },
        }, o.label))),
        el("details", { class: "why" }, [
          el("summary", { text: "Why this question" }),
          el("p", { text: `Chosen because it is expected to remove ${gain.toFixed(2)} bits of uncertainty about the cause — more per minute than any other question left.` }),
          el("ul", { class: "reasons" }, engine.eig.rank(state.prior, diagnostic.questions.filter((q) => !state.asked.includes(q.id)))
            .map((r) => el("li", { text: `${r.question.prompt} — ${r.score.toFixed(3)} bits per minute` }))),
        ]),
      ]));
    };

    const finish = (d, final, started, initialBits) => {
      const lead = engine.eig.leading(final);
      const hypothesis = hypothesisById(d, lead.id);
      const resolved = initialBits - engine.eig.remainingUncertainty(final);

      store.append({
        type: "diagnosticCompleted", conceptId: d.conceptId,
        hypothesis: lead.id, probability: lead.probability,
        questionsAsked: final.asked.length, bitsResolved: resolved,
        sessionId: store.sessionId,
      });
      // Diagnostic answers are evidence about ability too, at the engine's own rate.
      for (const t of final.transcript) {
        const q = d.questions.find((x) => x.id === t.questionId);
        const best = Object.entries(q.likelihoods.fluent).sort((a, b) => b[1] - a[1])[0][0];
        store.append({
          type: "attempt", questionId: q.id, conceptId: d.conceptId,
          submitted: t.response,
          outcome: t.response === best ? "correct" : "incorrect",
          errorType: t.response === best ? null : "misconception",
          assistance: "none", kind: "diagnostic", sessionId: store.sessionId,
          graderReason: "diagnostic multiple choice",
        });
      }
      store.invalidate();

      clear(body);
      add(body,
        el("section", { class: "card finding" }, [
          el("span", { class: "card-kind", text: "Diagnosis" }),
          el("h2", { text: hypothesis.label }),
          el("p", { text: hypothesis.advice }),
          el("p", { class: "muted small", text: `${Math.round(lead.probability * 100)}% likely given your answers. ${plural(final.asked.length, "question")} asked, ${resolved.toFixed(2)} bits of ${initialBits.toFixed(2)} resolved, ${Math.round((Date.now() - started) / 1000)} seconds.` }),
        ]),
        el("section", { class: "card" }, [
          el("h3", { text: "The other explanations, and how likely they now are" }),
          el("ul", { class: "list" }, Object.entries(final.prior)
            .sort((a, b) => b[1] - a[1])
            .map(([id, p]) => el("li", {}, [
              el("span", { text: hypothesisById(d, id).label }),
              el("span", { class: "muted", text: `${Math.round(p * 100)}%` }),
            ]))),
          el("p", { class: "muted small", text: "Nothing is ruled out. These are the posterior probabilities, and they move again with every answer you give anywhere in the app." }),
        ]),
        el("div", { class: "row" }, [
          el("button", { class: "btn primary", onclick: () => { const ws = WORKSHEETS.find((w) => w.conceptIds.includes(d.conceptId)); if (ws) openWorksheet(app, ws.id); } }, "Practise this topic"),
          el("button", { class: "btn ghost", onclick: chooser }, "Diagnose something else"),
        ]),
      );
    };

    step();
  };

  if (params.conceptId && diagnosticFor(params.conceptId)) run(diagnosticFor(params.conceptId));
  else chooser();
  return node;
}

// --------------------------------------------------------------- Progress

export function progress(app) {
  const view = store.project();
  const node = el("div", { class: "screen" });
  node.appendChild(el("header", { class: "screen-head" }, [
    el("h1", { text: "Progress" }),
    el("p", { class: "muted", text: "Evidence, not completion. Every number here is recomputed from your answers each time this screen opens — none of it is stored." }),
  ]));

  if (!view.concepts.length) {
    node.appendChild(el("section", { class: "card" }, [
      el("p", { text: "No answers recorded yet." }),
    ]));
    return node;
  }

  node.appendChild(el("section", { class: "card" }, [
    el("table", { class: "table" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "Topic" }), el("th", { text: "Unaided" }), el("th", { text: "State" }),
        el("th", { text: "Recall now" }), el("th", { text: "Evidence" }), el("th", { text: "Due" }),
      ])]),
      el("tbody", {}, view.concepts.map((c) => el("tr", {}, [
        el("td", { text: c.name }),
        el("td", {}, [
          el("div", { class: "strip-bar tiny" }, [el("div", { class: "strip-fill", style: { width: `${Math.round(c.pUnaided * 100)}%` } })]),
          el("span", { class: "muted small", text: `${Math.round(c.pUnaided * 100)}%` }),
        ]),
        el("td", {}, [
          el("span", { text: STATE_COPY[c.state] }),
          c.needsReview ? el("span", { class: "muted small", text: ` (was ${STATE_COPY[c.freshState]})` }) : null,
        ]),
        el("td", { text: `${Math.round(c.retrievability * 100)}%` }),
        el("td", { text: `${plural(c.attempts, "attempt")}, ${c.independentCorrect} unaided` }),
        el("td", { text: c.overdueDays > 0 ? `${Math.floor(c.overdueDays)}d overdue` : relativeTime(c.dueAt) }),
      ]))),
    ]),
  ]));

  node.appendChild(el("section", { class: "card" }, [
    el("h2", { text: "How these are worked out" }),
    el("ul", { class: "prose" }, [
      el("li", { text: "Unaided is a Beta estimate over your attempts, weighted by how much help you took: an answer you were shown adds nothing to it." }),
      el("li", { text: "Recall is a forgetting curve fitted to your own review history, not a fixed schedule." }),
      el("li", { text: "A topic can go backwards. Mastery expires without review, because that is what memory does." }),
      el("li", { text: "Careless slips are separated from gaps, and do not count against ability." }),
      el("li", { text: "There are no streaks, no points and no daily target. Nothing here is designed to bring you back tomorrow." }),
    ]),
  ]));

  return node;
}

// --------------------------------------------------------------- Settings

export function settings(app) {
  const node = el("div", { class: "screen" });
  node.appendChild(el("header", { class: "screen-head" }, [el("h1", { text: "Settings" })]));

  const url = store.getPref("gatewayUrl", "");
  const urlInput = el("input", { class: "answer wide", type: "url", value: url, placeholder: "https://your-gateway.example.com" });

  node.appendChild(el("section", { class: "card" }, [
    el("h2", { text: "Tutor server" }),
    el("p", { class: "muted small", text: "Slate never holds an API key. Requests go to a gateway you run, and the gateway holds the credentials and talks to the model. Leave this blank and the app works entirely offline, with written help instead of a tutor." }),
    urlInput,
    el("div", { class: "row" }, [
      el("button", {
        class: "btn primary",
        onclick: async () => {
          const value = urlInput.value.trim();
          store.setPref("gatewayUrl", value);
          if (!value) { announce("Tutor server cleared"); app.rerender(); return; }
          try {
            const r = await fetch(`${value.replace(/\/+$/, "")}/health`);
            announce(r.ok ? "Tutor server reachable" : `Server answered ${r.status}`);
          } catch (err) {
            announce(`Could not reach the server: ${err.message}`);
          }
          app.rerender();
        },
      }, "Save and test"),
    ]),
  ]));

  const examInput = el("input", { class: "answer wide", type: "date", value: store.getPref("examDate", "") || "" });
  node.appendChild(el("section", { class: "card" }, [
    el("h2", { text: "Exam date" }),
    el("p", { class: "muted small", text: "Optional. If set, review intervals tighten as it approaches — the target retention rises from 90% to 95%." }),
    examInput,
    el("div", { class: "row" }, [
      el("button", {
        class: "btn", onclick: () => {
          const value = examInput.value;
          store.setPref("examDate", value);
          const days = value ? (new Date(`${value}T09:00:00`).getTime() - Date.now()) / 86_400_000 : null;
          store.setPref("daysUntilExam", days !== null && days > 0 ? days : null);
          store.invalidate();
          announce("Saved");
          app.rerender();
        },
      }, "Save"),
    ]),
  ]));

  node.appendChild(el("section", { class: "card" }, [
    el("h2", { text: "Your data" }),
    el("p", { class: "muted small", text: "Everything is stored in this browser. Nothing is uploaded unless you configure a tutor server, and then only the question and your working — not your name, and not the whole document." }),
    el("div", { class: "row" }, [
      el("button", {
        class: "btn", onclick: () => {
          const blob = new Blob([store.exportAll()], { type: "application/json" });
          const a = el("a", { href: URL.createObjectURL(blob), download: "slate-study-record.json" });
          document.body.appendChild(a); a.click(); a.remove();
        },
      }, "Export everything"),
      el("button", {
        class: "btn", onclick: () => {
          const input = el("input", { type: "file", accept: "application/json" });
          input.addEventListener("change", async () => {
            try { store.importAll(await input.files[0].text()); announce("Imported"); app.rerender(); }
            catch (err) { announce(`Could not import: ${err.message}`); }
          });
          input.click();
        },
      }, "Import"),
      el("button", {
        class: "btn danger", onclick: () => {
          modal("Erase everything?", el("div", {}, [
            el("p", { text: "This removes every answer, every conclusion drawn from it, and all your ink. Because conclusions are recomputed from the log rather than stored, deleting the log deletes the beliefs too — there is no second copy." }),
          ]), [
            { label: "Cancel", variant: "ghost" },
            { label: "Erase", variant: "danger", onclick: () => { store.eraseEverything(); store.invalidate(); app.rerender(); announce("Erased"); } },
          ]);
        },
      }, "Erase everything"),
    ]),
  ]));

  node.appendChild(el("section", { class: "card" }, [
    el("h2", { text: "What this is, honestly" }),
    el("ul", { class: "prose" }, [
      el("li", { text: "The grader is real. It parses your answer and the expected answer into expressions and compares them by evaluation, so 5, x = 5 and 10/2 are all correct — and it diagnoses sign flips, reciprocals, degree/radian mix-ups and unit errors specifically." }),
      el("li", { text: "The learning model is real, and is the same one three times over: a Python reference, a Swift port for iPad, and this JavaScript build all reproduce one shared set of golden fixtures to nine decimal places." }),
      el("li", { text: "The adaptive diagnostic is real. Questions are chosen by expected information gain in bits, and a question that cannot separate the explanations is not asked." }),
      el("li", { text: "The tutor's words are not, without a server. Written help ships with the app; a model that answers your own questions needs credentials, and credentials do not belong in a web page." }),
      el("li", { text: "Handwriting is captured, not read. Recognising working needs a model, so the answer box is typed." }),
    ]),
  ]));

  return node;
}
