/**
 * The page: paper on the left, tutor on the right.
 *
 * The important structural decision is that the ink canvas never receives the
 * pointer. Events land on the sheet, `InkSurface` claims the ones a pen makes,
 * and everything else falls through to the buttons and text on the page. So the
 * Pencil writes and the finger works the interface, at the same time, with no
 * mode to switch.
 */
import { el, clear, add, icon, pretty, announce, plural } from "./ui.js";
import { InkSurface } from "./ink.js";
import * as store from "./store.js";
import { questionById, conceptById, worksheetById } from "./bank.js";
import { diagnose, localRung, RUNGS, RUNG_LABEL, RUNG_COST, askGateway } from "./help.js";
import * as mastery from "../learning/mastery.js";

export class StudyView {
  constructor(app) {
    this.app = app;
    this.node = el("div", { class: "study" });
    this.tool = "pen";
    this.fingerDraws = false;
    this.zoom = 1;
    this.selected = null;      // questionId
    this.rungUsed = {};        // questionId -> highest rung reached this attempt
    this.lastResult = {};      // questionId -> { result, diagnosis }
    this.doc = null;           // { id, kind: "worksheet" | "pdf", ... }
    this.pageIndex = 0;
  }

  // -------------------------------------------------------------- lifecycle

  /** Called whenever the Page tab is shown, including straight after a reload. */
  mount() {
    if (!this.node.firstChild) this.render();
    return this.node;
  }

  open(doc) {
    this.doc = doc;
    this.pageIndex = 0;
    this.selected = doc.kind === "worksheet" ? worksheetById[doc.worksheetId].questionIds[0] : null;
    this.render();
  }

  render() {
    clear(this.node);
    if (!this.doc) {
      this.node.appendChild(el("div", { class: "empty" }, [
        el("p", { text: "Nothing open. Pick a worksheet or import a PDF from the Desk." }),
      ]));
      return;
    }
    this.node.appendChild(this.toolbar());
    this.stage = el("div", { class: "stage" });
    this.sheetEl = el("div", { class: "sheet" });
    this.contentEl = el("div", { class: "sheet-content" });
    this.inkCanvas = el("canvas", { class: "sheet-ink", "aria-hidden": "true" });
    add(this.sheetEl, this.contentEl, this.inkCanvas);
    this.stage.appendChild(this.sheetEl);

    this.side = el("aside", { class: "side" });
    this.node.appendChild(el("div", { class: "study-body" }, [this.stage, this.side]));

    this.ink = new InkSurface(this.inkCanvas, this.sheetEl, {
      getTool: () => this.tool,
      shouldDraw: (type) => (type === "pen" ? true : this.fingerDraws),
      onCommit: (stroke) => store.addStroke(this.doc.id, this.pageIndex, stroke),
      onChange: (strokes) => {
        store.clearInk(this.doc.id, this.pageIndex);
        for (const s of strokes) store.addStroke(this.doc.id, this.pageIndex, s);
      },
    });

    this.renderPage();
    this.renderSide();

    // The sheet changes size for many reasons — the tab being shown again, a
    // rotation, a split view, the side panel wrapping underneath. Watching the
    // element covers all of them; a window resize listener covers only one, and
    // missed the case where ink had been drawn while the page was hidden.
    if (this.observer) this.observer.disconnect();
    this.observer = new ResizeObserver(() => this.fitSheet());
    this.observer.observe(this.sheetEl);
  }

  destroy() {
    if (this.observer) { this.observer.disconnect(); this.observer = null; }
    store.flush();
  }

  // ---------------------------------------------------------------- toolbar

  toolbar() {
    const toolButton = (id, label, glyph) => el("button", {
      class: `tool ${this.tool === id ? "on" : ""}`.trim(),
      title: label, "aria-label": label, "aria-pressed": this.tool === id,
      onclick: () => { this.tool = id; this.render(); },
    }, [el("span", { class: "tool-icon", html: glyph })]);

    const pages = this.pageCount();
    return el("header", { class: "study-bar" }, [
      el("button", { class: "btn ghost", onclick: () => this.app.go("desk") }, "‹ Desk"),
      el("h1", { class: "study-title", text: this.doc.title }),
      el("div", { class: "tools" }, [
        toolButton("pen", "Pen", icon("pen")),
        toolButton("pencil", "Pencil", icon("pencil")),
        toolButton("highlighter", "Highlighter", icon("highlighter")),
        toolButton("eraser", "Eraser", icon("eraser")),
        el("button", {
          class: `tool ${this.fingerDraws ? "on" : ""}`.trim(),
          title: "Draw with finger or mouse as well as pen",
          "aria-pressed": this.fingerDraws,
          onclick: () => { this.fingerDraws = !this.fingerDraws; this.render(); },
        }, [el("span", { class: "tool-icon", html: icon("finger") })]),
        el("button", {
          class: "tool", title: "Undo the last stroke",
          onclick: () => {
            if (store.undoStroke(this.doc.id, this.pageIndex)) {
              this.ink.setStrokes(store.strokesFor(this.doc.id, this.pageIndex));
              announce("Stroke removed");
            }
          },
        }, [el("span", { class: "tool-icon", html: icon("undo") })]),
        el("button", {
          class: "tool", title: "Print or save this page as a PDF, with your working on it",
          onclick: () => this.print(),
        }, [el("span", { class: "tool-icon", html: icon("print") })]),
      ]),
      pages > 1 ? el("div", { class: "pager" }, [
        el("button", {
          class: "btn ghost", disabled: this.pageIndex === 0,
          onclick: () => { this.pageIndex -= 1; this.renderPage(); this.renderSide(); },
        }, "‹"),
        el("span", { class: "pager-label", text: `${this.pageIndex + 1} / ${pages}` }),
        el("button", {
          class: "btn ghost", disabled: this.pageIndex >= pages - 1,
          onclick: () => { this.pageIndex += 1; this.renderPage(); this.renderSide(); },
        }, "›"),
      ]) : null,
    ]);
  }

  /**
   * Export is where the layers are finally combined, and the only place. The
   * original page and your ink are separate everywhere else, so handing work in
   * never risks altering what you were given — or what you wrote.
   */
  print() {
    document.body.classList.add("printing");
    const done = () => {
      document.body.classList.remove("printing");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    // Safari runs print() synchronously and fires afterprint late; the class is
    // removed either way.
    setTimeout(() => window.print(), 30);
    setTimeout(done, 4000);
  }

  pageCount() {
    return this.doc.kind === "pdf" ? this.doc.pdf.numPages : 1;
  }

  // ------------------------------------------------------------------- page

  renderPage() {
    clear(this.contentEl);
    if (this.doc.kind === "worksheet") this.renderWorksheet();
    else this.renderPdfPage();
    this.ink.setStrokes(store.strokesFor(this.doc.id, this.pageIndex));
    requestAnimationFrame(() => this.fitSheet());
  }

  renderWorksheet() {
    const ws = worksheetById[this.doc.worksheetId];
    const questions = ws.questionIds.map((id) => questionById[id]);
    this.contentEl.appendChild(el("div", { class: "ws" }, [
      el("div", { class: "ws-head" }, [
        el("h2", { class: "ws-title", text: ws.title }),
        el("p", { class: "ws-sub", text: "Write your working in the space under each question. Type the final answer in the panel." }),
      ]),
      ...questions.map((q) => el("section", {
        class: `ws-q ${this.selected === q.id ? "on" : ""}`.trim(),
        dataset: { question: q.id },
        onclick: () => this.select(q.id),
      }, [
        el("div", { class: "ws-q-head" }, [
          el("span", { class: "ws-q-label", text: q.label }),
          el("p", { class: "ws-q-prompt", text: q.prompt }),
        ]),
        el("div", { class: "ws-q-work", "aria-hidden": "true" }),
        this.answeredBadge(q.id),
      ])),
    ]));
  }

  answeredBadge(questionId) {
    const last = store.allEvents().filter((e) => e.type === "attempt" && e.questionId === questionId).pop();
    if (!last) return null;
    return el("span", {
      class: `ws-q-mark ${last.outcome}`,
      title: `Last attempt: ${last.outcome}`,
      text: last.outcome === "correct" ? "✓" : last.outcome === "partial" ? "~" : "✗",
    });
  }

  async renderPdfPage() {
    const canvas = el("canvas", { class: "pdf-page" });
    this.contentEl.appendChild(canvas);
    const page = await this.doc.pdf.getPage(this.pageIndex + 1);
    // Render at device resolution so pen marks sit on sharp text rather than a blur.
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const base = page.getViewport({ scale: 1 });
    const width = Math.min(1400, base.width * 2);
    const viewport = page.getViewport({ scale: (width / base.width) * dpr });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    this.sheetEl.style.aspectRatio = `${base.width} / ${base.height}`;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    this.fitSheet();
  }

  fitSheet() {
    if (!this.sheetEl) return;
    const rect = this.sheetEl.getBoundingClientRect();
    // A hidden sheet measures zero; resizing to that would throw the ink away.
    if (rect.width < 2 || rect.height < 2) return;
    this.ink.resize(rect.width, rect.height);
  }

  select(questionId) {
    if (this.selected === questionId) return;
    this.selected = questionId;
    for (const node of this.contentEl.querySelectorAll(".ws-q")) {
      node.classList.toggle("on", node.dataset.question === questionId);
    }
    this.renderSide();
  }

  // ------------------------------------------------------------- side panel

  renderSide() {
    clear(this.side);
    if (this.doc.kind === "pdf") {
      this.side.appendChild(this.pdfSide());
      return;
    }
    const q = questionById[this.selected];
    if (!q) return;
    const concept = conceptById[q.conceptId];
    const shown = this.lastResult[q.id];

    add(this.side,
      el("div", { class: "side-head" }, [
        el("span", { class: "chip", text: concept.name }),
        q.kind === "transfer" ? el("span", { class: "chip alt", text: "different angle" }) : null,
      ]),
      el("p", { class: "side-prompt", text: q.prompt }),
      this.answerBox(q),
      shown ? this.verdictCard(q, shown) : null,
      this.ladder(q),
      this.masteryStrip(q),
    );
  }

  pdfSide() {
    return el("div", { class: "side-note" }, [
      el("h3", { text: "Your PDF" }),
      el("p", { text: "Write on it with the Pencil. The original file is never modified — your ink is stored as a separate layer over it." }),
      el("p", { class: "muted", text: "Checking answers and mastery tracking work on the built-in worksheets, where Slate knows what the questions are. Reading questions out of an arbitrary PDF needs the tutor server." }),
    ]);
  }

  answerBox(q) {
    const input = el("input", {
      class: "answer", type: "text", inputmode: "text", autocapitalize: "off",
      autocomplete: "off", spellcheck: "false",
      placeholder: "Your answer, e.g. x = 5",
      "aria-label": "Your answer",
      onkeydown: (e) => { if (e.key === "Enter") this.check(q, input.value); },
    });
    this.answerInput = input;
    return el("div", { class: "answer-row" }, [
      input,
      el("button", { class: "btn primary", onclick: () => this.check(q, input.value) }, "Check"),
    ]);
  }

  verdictCard(q, { result, diagnosis, delta }) {
    return el("div", { class: `verdict ${diagnosis.tone}` }, [
      el("h3", { class: "verdict-title", text: diagnosis.title }),
      diagnosis.right ? el("p", { class: "verdict-right", text: diagnosis.right }) : null,
      diagnosis.fix ? el("p", { class: "verdict-fix", text: diagnosis.fix }) : null,
      el("details", { class: "why" }, [
        el("summary", { text: "Why this verdict" }),
        el("p", { class: "mono", text: `${result.verdict} — ${result.reason}` }),
        el("p", {
          class: "muted",
          text: result.parsed
            ? "Decided by evaluating both expressions, not by comparing text. Confidence 1.0."
            : "The answer could not be parsed as an expression, so nothing was concluded from it.",
        }),
      ]),
      delta ? el("p", { class: "delta", text: delta }) : null,
    ]);
  }

  ladder(q) {
    const used = this.rungUsed[q.id] || null;
    const rows = RUNGS.map((rung) => {
      const reached = used !== null && RUNGS.indexOf(rung) <= RUNGS.indexOf(used);
      const content = reached ? localRung(q, rung) : null;
      return el("div", { class: `rung ${reached ? "open" : ""}`.trim() }, [
        el("button", {
          class: "rung-head", onclick: () => this.useRung(q, rung),
          "aria-expanded": reached,
        }, [
          el("span", { class: "rung-name", text: RUNG_LABEL[rung] }),
          el("span", { class: "rung-cost", text: RUNG_COST[rung] }),
        ]),
        reached ? this.rungBody(content) : null,
      ]);
    });
    return el("div", { class: "ladder" }, [
      el("h3", { class: "ladder-title", text: "Help" }),
      el("p", {
        class: "ladder-note",
        text: "Every level is available now, including the answer. Using more help lowers what this attempt proves about working unaided — it never locks anything.",
      }),
      ...rows,
      this.tutorRow(q),
    ]);
  }

  rungBody(content) {
    if (!content) return null;
    if (content.kind === "steps") {
      return el("ol", { class: "rung-body steps" }, content.steps.map((s) => el("li", { text: s })));
    }
    if (content.kind === "answer") {
      return el("div", { class: "rung-body" }, [
        el("p", { class: "answer-reveal", text: pretty(content.text) }),
        el("ol", { class: "steps" }, content.steps.map((s) => el("li", { text: s }))),
      ]);
    }
    return el("p", { class: "rung-body", text: content.text });
  }

  useRung(q, rung) {
    const current = this.rungUsed[q.id] || null;
    if (current === null || RUNGS.indexOf(rung) > RUNGS.indexOf(current)) {
      this.rungUsed[q.id] = rung;
      store.append({
        type: "assistanceRequested", questionId: q.id, conceptId: q.conceptId,
        rung, sessionId: store.sessionId,
      });
    }
    this.renderSide();
    announce(`${RUNG_LABEL[rung]} shown`);
  }

  tutorRow(q) {
    const url = store.getPref("gatewayUrl", "");
    if (!url) {
      return el("div", { class: "tutor-off" }, [
        el("p", { text: "The help above is written by hand and works offline. A tutor that answers your own questions needs a server holding the API credentials." }),
        el("button", { class: "btn ghost", onclick: () => this.app.go("settings") }, "Connect a tutor server"),
      ]);
    }
    const out = el("div", { class: "tutor" });
    const ask = el("input", {
      class: "answer", type: "text", placeholder: "Ask about this question…",
      onkeydown: (e) => { if (e.key === "Enter") run(e.target.value); },
    });
    const run = async (text) => {
      if (!text.trim()) return;
      clear(out).appendChild(el("p", { class: "muted", text: "Asking the tutor…" }));
      try {
        const reply = await askGateway(url, {
          ask: text,
          questionText: q.prompt,
          workingText: `Their typed answer so far: ${this.answerInput ? this.answerInput.value : ""}`,
          masteryHints: this.masteryHint(q),
          subject: "mathematics",
        });
        add(clear(out),
          el("p", { text: reply.message }),
          reply.steps && reply.steps.length
            ? el("ol", { class: "steps" }, reply.steps.filter((s) => !s.isHidden).map((s) => el("li", { text: s.text })))
            : null,
          el("p", { class: "muted", text: `Confidence ${reply.confidence.toFixed(2)}${reply.uncertainty ? ` — ${reply.uncertainty}` : ""}` }),
        );
      } catch (err) {
        clear(out).appendChild(el("p", { class: "error", text: `The tutor server did not answer: ${err.message}` }));
      }
    };
    return el("div", { class: "tutor-on" }, [
      el("h4", { text: "Ask the tutor" }), ask, out,
    ]);
  }

  masteryHint(q) {
    const view = store.project().concepts.find((c) => c.conceptId === q.conceptId);
    if (!view) return "No history on this topic yet.";
    return `${view.name}: ${Math.round(view.pUnaided * 100)}% unaided over ${plural(view.attempts, "attempt")}, currently ${view.state}.`;
  }

  masteryStrip(q) {
    const view = store.project().concepts.find((c) => c.conceptId === q.conceptId);
    if (!view) {
      return el("p", { class: "muted small", text: "No evidence on this topic yet. Your first answer starts the record." });
    }
    return el("div", { class: "strip" }, [
      el("div", { class: "strip-bar" }, [
        el("div", { class: "strip-fill", style: { width: `${Math.round(view.pUnaided * 100)}%` } }),
      ]),
      el("p", {
        class: "muted small",
        text: `${view.name}: ${Math.round(view.pUnaided * 100)}% unaided, ${view.state}, from ${plural(view.attempts, "attempt")}.`,
      }),
    ]);
  }

  // ------------------------------------------------------------------ check

  check(q, text) {
    if (!text || !text.trim()) { announce("Type an answer first"); return; }
    // Before the first answer there is no view for this topic, so the comparison is
    // against the model's own prior rather than against nothing — the number a
    // student starts at is a real number, and saying so is more honest than hiding it.
    const priorView = store.project().concepts.find((c) => c.conceptId === q.conceptId);
    const before = priorView
      ? priorView.pUnaided
      : mastery.predictedP(mastery.newState(q.conceptId));
    const result = this.app.grade(text, q.expected);
    const diagnosis = diagnose(result, q);
    const assistance = this.assistanceLevel(q.id);

    store.append({
      type: "attempt",
      questionId: q.id,
      conceptId: q.conceptId,
      submitted: text,
      outcome: result.verdict === "correct" ? "correct"
        : result.verdict === "partiallyCorrect" ? "partial" : "incorrect",
      errorType: diagnosis.errorType,
      nearMiss: result.nearMiss ? result.nearMiss.kind : null,
      assistance,
      kind: q.kind === "transfer" ? "transfer" : "practice",
      sessionId: store.sessionId,
      graderReason: result.reason,
    });
    store.invalidate();

    const after = store.project().concepts.find((c) => c.conceptId === q.conceptId);
    const delta = after
      ? `Unaided ability for ${after.name}: ${Math.round(before * 100)}% → ${Math.round(after.pUnaided * 100)}%`
        + (assistance === "solution" ? " — unchanged, because you were shown the answer." : "")
      : null;

    this.lastResult[q.id] = { result, diagnosis, delta };
    if (result.verdict === "correct") this.rungUsed[q.id] = null;
    else if (diagnosis.openAt && !this.rungUsed[q.id]) this.rungUsed[q.id] = diagnosis.openAt;

    this.renderPage();
    this.renderSide();
    announce(`${diagnosis.title}. ${diagnosis.fix}`);
  }

  /** The most help taken before this answer decides how much it proves. */
  assistanceLevel(questionId) {
    const rung = this.rungUsed[questionId];
    if (!rung) return "none";
    return { nudge: "nudge", hint: "hint", explain: "hint", steps: "worked", solve: "solution" }[rung];
  }
}
