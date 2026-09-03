/**
 * Adaptive diagnostics.
 *
 * Not a test with a score: a set of competing explanations for what is going
 * wrong, and questions chosen because their answers separate those explanations.
 * The engine ranks by expected information gain in bits and stops as soon as one
 * explanation is likely enough — usually three questions, not twenty.
 */
import { el, add, clear, icon, aiMark, plural } from "./ui.js";
import * as store from "./store.js";
import * as engine from "../learning/index.js";
import { DIAGNOSTICS, diagnosticFor, hypothesisById } from "./diagnostics.js";
import { WORKSHEETS } from "./bank.js";

export function diagnose(app, params = {}) {
  const node = el("div", { class: "page stack g6" });
  add(node, el("header", { class: "stack g2" }, [
    el("h1", { class: "t-title", text: "Diagnose" }),
    el("p", { class: "t-2", style: { margin: 0 },
      text: "This produces an explanation, not a mark. It stops as soon as one explanation is likely enough, which is usually after three questions." }),
  ]));

  const body = el("div", { class: "stack g5" });
  add(node, body);

  const chooser = () => {
    clear(body);
    add(body, el("section", { class: "stack g3" }, [
      el("h2", { class: "t-section", text: "Pick a topic" }),
      el("div", { class: "tiles" }, DIAGNOSTICS.map((d) => el("button", {
        class: "tile", onclick: () => run(d),
      }, [
        el("span", { class: "tile-name", text: d.title }),
        el("span", { class: "t-2", text: `${d.hypotheses.length} competing explanations` }),
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
      const left = engine.eig.remainingUncertainty(state);

      add(body, el("div", { class: "stack g2" }, [
        el("div", { class: "meter ai" }, [
          el("i", { style: { width: `${Math.max(2, Math.round((left / h0) * 100))}%` } }),
        ]),
        el("span", { class: "t-2 num", text: `${left.toFixed(2)} of ${h0.toFixed(2)} bits of uncertainty left after ${plural(state.asked.length, "question")}.` }),
      ]));

      if (engine.eig.isConfident(state, 0.8) || !question) { finish(diagnostic, state, startedAt, h0); return; }

      const gain = engine.eig.expectedInformationGain(state.prior, question);
      add(body, el("section", { class: "card stack g5" }, [
        el("p", { class: "t-math", style: { margin: 0, fontSize: "20px" }, text: question.prompt }),
        el("div", { class: "stack g2" }, question.options.map((o) => el("button", {
          class: "btn full", style: { justifyContent: "flex-start", fontFamily: "var(--math)", fontSize: "17px", fontWeight: "400" },
          onclick: () => { state = engine.eig.observe(state, question, o.response); step(); },
        }, o.label))),
        el("details", {}, [
          el("summary", { class: "t-2", style: { cursor: "pointer" }, text: "Why this question" }),
          el("p", { class: "t-2", text: `Expected to remove ${gain.toFixed(2)} bits of uncertainty about the cause — more per minute than anything else left.` }),
          el("ul", { class: "t-2", style: { margin: 0, paddingLeft: "20px" } },
            engine.eig.rank(state.prior, diagnostic.questions.filter((q) => !state.asked.includes(q.id)))
              .map((r) => el("li", { text: `${r.question.prompt} — ${r.score.toFixed(3)} bits per minute` }))),
        ]),
      ]));
    };

    const finish = (d, final, started, initialBits) => {
      const lead = engine.eig.leading(final);
      const hypothesis = hypothesisById(d, lead.id);
      const resolved = initialBits - engine.eig.remainingUncertainty(final);

      store.append({
        type: "diagnosticCompleted", conceptId: d.conceptId, hypothesis: lead.id,
        probability: lead.probability, questionsAsked: final.asked.length,
        bitsResolved: resolved, sessionId: store.sessionId,
      });
      for (const t of final.transcript) {
        const q = d.questions.find((x) => x.id === t.questionId);
        const best = Object.entries(q.likelihoods.fluent).sort((a, b) => b[1] - a[1])[0][0];
        store.append({
          type: "attempt", questionId: q.id, conceptId: d.conceptId, submitted: t.response,
          outcome: t.response === best ? "correct" : "incorrect",
          errorType: t.response === best ? null : "misconception",
          assistance: "none", kind: "diagnostic", sessionId: store.sessionId,
          graderReason: "diagnostic multiple choice",
        });
      }
      store.invalidate();

      clear(body);
      add(body,
        el("section", { class: "card stack g3", style: { borderColor: "var(--ai-line)" } }, [
          el("div", { class: "row" }, [aiMark("idle"), el("span", { class: "t-cap", style: { color: "var(--ai)" }, text: "Diagnosis" })]),
          el("h2", { class: "t-section", style: { margin: 0 }, text: hypothesis.label }),
          el("p", { class: "t-body", style: { margin: 0 }, text: hypothesis.advice }),
          el("p", { class: "t-2", style: { margin: 0 },
            text: `${Math.round(lead.probability * 100)}% likely given your answers. ${plural(final.asked.length, "question")}, ${resolved.toFixed(2)} bits of ${initialBits.toFixed(2)} resolved, ${Math.round((Date.now() - started) / 1000)} seconds.` }),
        ]),
        el("section", { class: "card stack g3" }, [
          el("h3", { class: "t-sub", style: { margin: 0 }, text: "The other explanations, and how likely they now are" }),
          el("div", { class: "stack g2" }, Object.entries(final.prior).sort((a, b) => b[1] - a[1])
            .map(([id, p]) => el("div", { class: "stack g2" }, [
              el("div", { class: "spread" }, [
                el("span", { text: hypothesisById(d, id).label }),
                el("span", { class: "t-2 num", text: `${Math.round(p * 100)}%` }),
              ]),
              el("div", { class: "meter" }, [el("i", { style: { width: `${Math.round(p * 100)}%` } })]),
            ]))),
          el("p", { class: "t-2", style: { margin: 0 },
            text: "Nothing is ruled out. These are posterior probabilities, and they move again with every answer you give anywhere in the app." }),
        ]),
        el("div", { class: "row wrap" }, [
          el("button", {
            class: "btn primary",
            onclick: () => { const w = WORKSHEETS.find((x) => x.conceptIds.includes(d.conceptId)); if (w) app.openWorksheet(w.id); },
          }, "Practise this topic"),
          el("button", { class: "btn quiet", onclick: chooser }, "Diagnose something else"),
        ]),
      );
    };

    step();
  };

  if (params.conceptId && diagnosticFor(params.conceptId)) run(diagnosticFor(params.conceptId));
  else chooser();
  return node;
}
