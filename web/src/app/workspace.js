/**
 * The workspace: the student's work, then their attention, then the AI, then
 * navigation — in that order of priority, on the screen and in the code.
 *
 * The structural decision that makes the AI feel built in rather than bolted on is
 * that the ink canvas never receives the pointer. Events land on the sheet,
 * `InkSurface` claims the ones a pen makes, and everything else falls through to
 * the page beneath. So the Pencil writes and the finger works the interface at the
 * same time, and the app always knows which question, which working and which page
 * the student is looking at — which is what "explain this" needs in order to mean
 * anything.
 */
import { el, add, clear, icon, aiMark, pretty, announce, plural, modal } from "./ui.js";
import { InkSurface } from "./ink.js";
import * as store from "./store.js";
import * as ai from "./ai.js";
import * as mastery from "../learning/mastery.js";
import { questionById, conceptById, worksheetById } from "./bank.js";
import { diagnose } from "./help.js";

const PEN_TOOLS = [
  ["pen", "Pen"], ["pencil", "Pencil"], ["highlighter", "Highlighter"],
  ["eraser", "Eraser"], ["lasso", "Select"], ["shape", "Shape"], ["text", "Text"],
];

export class Workspace {
  constructor(app) {
    this.app = app;
    this.node = el("div", { class: "ws" });
    this.tool = "pen";
    this.fingerDraws = false;
    // On a narrow iPad the panel covers the page, so it starts closed there and the
    // dock button invites it in. On a wide one it is a column and can simply be open.
    this.panelOpen = store.getPref("panelOpen", window.innerWidth > 1180);
    this.doc = null;
    this.pageIndex = 0;
    this.selectedQuestion = null;
    this.workingSelection = null;
    this.results = {};        // questionId -> { result, diagnosis, submitted }
    this.helpUsed = {};       // questionId -> deepest assistance taken
    this.thread = [];
    this.busy = false;
  }

  // ---------------------------------------------------------------- opening

  open(doc) {
    this.doc = doc;
    this.pageIndex = 0;
    this.workingSelection = null;
    this.thread = [];
    this.selectedQuestion = doc.kind === "worksheet"
      ? worksheetById[doc.worksheetId].questionIds[0] : null;
    this.render();
  }

  mount() {
    if (!this.node.firstChild) this.render();
    return this.node;
  }

  destroy() {
    if (this.observer) { this.observer.disconnect(); this.observer = null; }
    ai.dismissBubble();
    store.flush();
  }

  // -------------------------------------------------------------- structure

  render() {
    clear(this.node);
    if (!this.doc) {
      add(this.node, el("div", { class: "empty" }, [
        el("span", { class: "dim-3", html: icon("book", 40) }),
        el("h2", { class: "t-section", text: "Your learning space is ready" }),
        el("p", { text: "Open a topic from Home, or import a worksheet and write on it with the Pencil." }),
        el("div", { class: "row" }, [
          el("button", { class: "btn primary", onclick: () => this.app.go("home") }, "Choose a topic"),
          el("button", { class: "btn", onclick: () => this.app.go("documents") }, "Import a PDF"),
        ]),
      ]));
      return;
    }

    add(this.node, this.bar());

    this.stage = el("div", { class: "stage" });
    this.sheetWrap = el("div", { class: "sheet-wrap" });
    this.sheet = el("div", { class: `sheet ${this.doc.kind === "worksheet" ? "" : "fixed-ratio"}`.trim() });
    this.content = el("div", { class: "sheet-content" });
    this.inkCanvas = el("canvas", { class: "sheet-ink", "aria-hidden": "true" });
    add(this.sheet, this.content, this.inkCanvas);
    add(this.sheetWrap, this.sheet);
    add(this.stage, this.sheetWrap, this.tools());

    this.panel = el("aside", { class: "panel", "aria-label": "Tutor" });
    this.body = el("div", { class: "ws-body" });
    add(this.body, this.stage, this.panelOpen ? this.panel : this.dock());
    add(this.node, this.body);

    this.ink = new InkSurface(this.inkCanvas, this.sheet, {
      getTool: () => this.tool,
      shouldDraw: (type) => (type === "pen" ? true : this.fingerDraws),
      onCommit: (stroke) => store.addStroke(this.doc.id, this.pageIndex, stroke),
      onChange: (strokes) => {
        store.clearInk(this.doc.id, this.pageIndex);
        for (const s of strokes) store.addStroke(this.doc.id, this.pageIndex, s);
      },
      onSelect: (selection) => this.onWorkingSelected(selection),
    });

    this.renderPage();
    if (this.panelOpen) this.renderPanel();

    // The sheet resizes for many reasons — a tab shown again, a rotation, a split
    // view, the panel opening. Watching the element covers all of them.
    if (this.observer) this.observer.disconnect();
    this.observer = new ResizeObserver(() => this.fit());
    this.observer.observe(this.sheet);
  }

  bar() {
    const where = this.doc.kind === "worksheet"
      ? { subject: "Mathematics", title: worksheetById[this.doc.worksheetId].title }
      : { subject: this.doc.subject || "Document", title: this.doc.title };
    const pages = this.pageCount();
    return el("header", { class: "ws-bar" }, [
      el("button", { class: "tool", "aria-label": "Back", onclick: () => this.app.go("home") },
        [el("span", { html: icon("back") })]),
      el("div", { class: "ws-where grow" }, [
        el("b", { text: where.title }),
        el("span", { text: `Working on: ${where.subject}` }),
      ]),
      pages > 1 ? el("div", { class: "row", style: { gap: "2px" } }, [
        el("button", {
          class: "tool", "aria-label": "Previous page", disabled: this.pageIndex === 0,
          onclick: () => { this.pageIndex -= 1; this.renderPage(); this.renderPanel(); },
        }, [el("span", { html: icon("back", 18) })]),
        el("span", { class: "t-2 num", text: `${this.pageIndex + 1} / ${pages}` }),
        el("button", {
          class: "tool", "aria-label": "Next page", disabled: this.pageIndex >= pages - 1,
          onclick: () => { this.pageIndex += 1; this.renderPage(); this.renderPanel(); },
        }, [el("span", { html: icon("chevron", 18) })]),
      ]) : null,
      el("button", { class: "tool", "aria-label": "Print or export", onclick: () => this.print() },
        [el("span", { html: icon("print") })]),
      el("button", {
        class: `tool ai ${this.panelOpen ? "on" : ""}`.trim(), "aria-label": "Tutor",
        "aria-pressed": this.panelOpen, onclick: () => this.togglePanel(),
      }, [el("span", { html: icon("ai") })]),
    ]);
  }

  tools() {
    const button = (id, label) => el("button", {
      class: `tool ${this.tool === id ? "on" : ""}`.trim(), title: label, "aria-label": label,
      "aria-pressed": this.tool === id,
      onclick: () => { this.tool = id; this.ink.clearSelection(); this.refreshTools(); },
    }, [el("span", { html: icon(id) })]);

    this.toolbar = el("div", { class: "tools", role: "toolbar", "aria-label": "Pencil tools" }, [
      ...PEN_TOOLS.map(([id, label]) => button(id, label)),
      el("span", { class: "sep" }),
      el("button", {
        class: `tool ${this.fingerDraws ? "on" : ""}`.trim(),
        title: "Draw with finger or mouse as well as pen", "aria-pressed": this.fingerDraws,
        onclick: () => { this.fingerDraws = !this.fingerDraws; this.refreshTools(); },
      }, [el("span", { html: icon("finger") })]),
      el("button", {
        class: "tool", title: "Undo the last stroke", "aria-label": "Undo",
        onclick: () => {
          if (store.undoStroke(this.doc.id, this.pageIndex)) {
            this.ink.setStrokes(store.strokesFor(this.doc.id, this.pageIndex));
            announce("Stroke removed");
          }
        },
      }, [el("span", { html: icon("undo") })]),
    ]);
    return this.toolbar;
  }

  refreshTools() {
    const buttons = this.toolbar.querySelectorAll(".tool");
    PEN_TOOLS.forEach(([id], i) => {
      buttons[i].classList.toggle("on", this.tool === id);
      buttons[i].setAttribute("aria-pressed", this.tool === id);
    });
    const finger = buttons[PEN_TOOLS.length];
    finger.classList.toggle("on", this.fingerDraws);
    finger.setAttribute("aria-pressed", this.fingerDraws);
  }

  dock() {
    return el("button", {
      class: "dock", onclick: () => this.togglePanel(),
    }, [aiMark("idle"), el("span", { text: "Ask" })]);
  }

  togglePanel() {
    this.panelOpen = !this.panelOpen;
    store.setPref("panelOpen", this.panelOpen);
    this.render();
  }

  pageCount() { return this.doc.kind === "pdf" ? this.doc.pdf.numPages : 1; }

  // ------------------------------------------------------------------ page

  renderPage() {
    clear(this.content);
    if (this.doc.kind === "worksheet") this.renderWorksheet();
    else this.renderPdfPage();
    this.ink.setStrokes(store.strokesFor(this.doc.id, this.pageIndex));
    requestAnimationFrame(() => this.fit());
  }

  renderWorksheet() {
    const ws = worksheetById[this.doc.worksheetId];
    add(this.content, el("div", { class: "paper" }, [
      el("div", { class: "paper-head" }, [
        el("h2", { text: ws.title }),
        el("p", { text: "Write your working in the space under each question. Type the answer in the panel." }),
      ]),
      ...ws.questionIds.map((id) => this.questionBlock(questionById[id])),
    ]));
  }

  questionBlock(q) {
    const last = [...store.allEvents()].reverse()
      .find((e) => e.type === "attempt" && e.questionId === q.id);
    const node = el("section", {
      class: `q ${this.selectedQuestion === q.id ? "on" : ""}`.trim(),
      dataset: { question: q.id }, tabindex: "0", role: "button",
      "aria-label": `Question ${q.label}`,
      onclick: (e) => this.selectQuestion(q.id, e),
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.selectQuestion(q.id, e); } },
    }, [
      el("div", { class: "q-top" }, [
        el("span", { class: "q-no", text: q.label }),
        el("p", { class: "q-text", text: q.prompt }),
      ]),
      el("div", { class: "q-work ruled", "aria-hidden": "true" }),
      last ? el("span", {
        class: `q-state ${last.outcome}`, title: `Last attempt: ${last.outcome}`,
        text: last.outcome === "correct" ? "✓" : last.outcome === "partial" ? "~" : "✕",
      }) : null,
    ]);
    return node;
  }

  async renderPdfPage() {
    const canvas = el("canvas", { class: "pdf-page" });
    add(this.content, canvas);
    const page = await this.doc.pdf.getPage(this.pageIndex + 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (Math.min(1500, base.width * 2) / base.width) * dpr });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = "100%";
    this.sheet.style.aspectRatio = `${base.width} / ${base.height}`;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    this.fit();
  }

  fit() {
    if (!this.sheet) return;
    const rect = this.sheet.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;   // hidden measures zero
    this.ink.resize(rect.width, rect.height);
  }

  // ------------------------------------------------------------- selection

  selectQuestion(questionId, event) {
    this.workingSelection = null;
    this.selectedQuestion = questionId;
    for (const n of this.content.querySelectorAll(".q")) {
      n.classList.toggle("on", n.dataset.question === questionId);
    }
    this.renderPanel();
    if (event && event.clientX) {
      const host = this.sheetWrap.getBoundingClientRect();
      ai.bubble(this.sheetWrap, { x: event.clientX - host.left, y: event.clientY - host.top },
        ai.actionsFor(this.context()), (intent) => this.ask({ intent }));
    }
  }

  /** Lassoing your own working is a question about it, so offer to read it. */
  onWorkingSelected(selection) {
    this.workingSelection = selection;
    if (!selection) { this.renderPanel(); return; }
    this.renderPanel();
    const host = this.sheetWrap.getBoundingClientRect();
    const sheet = this.sheet.getBoundingClientRect();
    ai.bubble(this.sheetWrap,
      { x: selection.anchor.x + (sheet.left - host.left), y: selection.anchor.y + (sheet.top - host.top) },
      ai.actionsFor(this.context()), (intent) => this.ask({ intent }));
  }

  /** What the tutor is looking at. Everything contextual reads from this. */
  context() {
    if (this.workingSelection) {
      return {
        kind: "working", strokeCount: this.workingSelection.count,
        question: this.selectedQuestion ? questionById[this.selectedQuestion] : null,
      };
    }
    if (this.selectedQuestion) {
      return { kind: "question", question: questionById[this.selectedQuestion] };
    }
    return { kind: "page", pageIndex: this.pageIndex, title: this.doc.title };
  }

  // ------------------------------------------------------------- the panel

  renderPanel() {
    if (!this.panelOpen || !this.panel) return;
    clear(this.panel);
    const ctx = this.context();
    const q = ctx.question;

    add(this.panel, el("div", { class: "panel-head" }, [
      aiMark(this.busy ? "thinking" : "idle"),
      el("span", { class: "panel-title grow", text: "Tutor" }),
      el("button", {
        class: "tool", "aria-label": "Close the tutor", onclick: () => this.togglePanel(),
      }, [el("span", { html: icon("close", 18) })]),
    ]));

    const body = el("div", { class: "panel-body stack g5" });
    this.panelBody = body;

    add(body, el("span", { class: "ai-context" }, [
      aiMark("idle"), el("span", { text: `Looking at ${ai.describe(ctx).label}` }),
    ]));

    if (q) add(body, this.answerBlock(q));

    const shown = q && this.results[q.id];
    if (shown) add(body, this.mistakeBlock(q, shown));

    for (const turn of this.thread) add(body, this.turnNode(turn));

    const chips = ai.suggestionsFor(ctx, shown && shown.result);
    if (chips.length && !this.thread.length) {
      add(body, el("div", { class: "row wrap" }, chips.map(([intent, label]) =>
        el("button", { class: "chip ai", onclick: () => this.ask({ intent }) }, label))));
    }

    add(this.panel, body);

    this.composer = new ai.Composer({
      getContext: () => this.context(),
      onAsk: (request) => this.ask(request),
    });
    add(this.panel, el("div", { class: "panel-foot" }, [this.composer.node]));
    body.scrollTop = body.scrollHeight;
  }

  /** Ordinary UI, in the primary colour: this is marking, not intelligence. */
  answerBlock(q) {
    const input = el("input", {
      class: "field", type: "text", inputmode: "text", autocapitalize: "off",
      autocomplete: "off", spellcheck: "false", placeholder: "Your answer",
      "aria-label": `Answer to question ${q.label}`,
      onkeydown: (e) => { if (e.key === "Enter") this.check(q, input.value); },
    });
    this.answerInput = input;
    return el("div", { class: "stack g3" }, [
      el("p", { class: "t-math", style: { margin: 0 }, text: q.prompt }),
      el("div", { class: "row" }, [
        el("div", { class: "grow" }, [input]),
        el("button", { class: "btn primary", onclick: () => this.check(q, input.value) }, "Check"),
      ]),
      this.strip(q),
    ]);
  }

  strip(q) {
    const view = store.project().concepts.find((c) => c.conceptId === q.conceptId);
    if (!view) return el("p", { class: "t-2", style: { margin: 0 }, text: "No evidence on this topic yet. Your first answer starts the record." });
    return el("div", { class: "stack g2" }, [
      el("div", { class: "meter" }, [el("i", { style: { width: `${Math.round(view.pUnaided * 100)}%` } })]),
      el("span", { class: "t-2 num", text: `${conceptById[q.conceptId].name}: ${Math.round(view.pUnaided * 100)}% unaided over ${plural(view.attempts, "attempt")}` }),
    ]);
  }

  /** Your answer → what went wrong → the concept → try again. Never just "wrong". */
  mistakeBlock(q, shown) {
    const { result, diagnosis, submitted, delta } = shown;
    if (result.verdict === "correct") {
      return el("div", { class: "card flat mistake correct", style: { background: "var(--success-soft)", borderColor: "transparent" } }, [
        el("div", { class: "mistake-step" }, [
          el("h4", { text: "Correct" }),
          el("p", { text: diagnosis.right || result.reason }),
        ]),
        delta ? el("p", { class: "t-2", style: { margin: 0 }, text: delta }) : null,
      ]);
    }
    return el("div", { class: "card flat mistake" }, [
      el("div", { class: "mistake-step" }, [
        el("h4", { text: "Your answer" }),
        el("p", { class: "mistake-yours", text: submitted }),
      ]),
      el("div", { class: "mistake-step" }, [
        el("h4", { text: "What went wrong" }),
        el("p", { text: [diagnosis.right, diagnosis.fix].filter(Boolean).join(" ") }),
      ]),
      el("div", { class: "mistake-step" }, [
        el("h4", { text: "The concept" }),
        el("p", { text: q.explain }),
      ]),
      el("div", { class: "mistake-step" }, [
        el("h4", { text: "Try again" }),
        el("p", { text: q.nudge }),
        el("div", { class: "row wrap", style: { marginTop: "8px" } }, [
          el("button", { class: "chip ai", onclick: () => this.ask({ intent: "hint" }) }, "Hint"),
          el("button", { class: "chip ai", onclick: () => this.ask({ intent: "steps" }) }, "Show steps"),
          el("button", { class: "chip", onclick: () => this.ask({ intent: "answer" }) }, "Full answer"),
        ]),
      ]),
      el("details", {}, [
        el("summary", { class: "t-2", style: { cursor: "pointer" }, text: "How this was marked" }),
        el("p", { class: "t-2", style: { margin: "8px 0 0" }, text: `${result.verdict} — ${result.reason}` }),
        el("p", { class: "t-2", style: { margin: "4px 0 0" },
          text: result.parsed
            ? "Decided by evaluating both expressions at seeded sample points, not by comparing text."
            : "The answer could not be parsed as an expression, so nothing was concluded from it." }),
      ]),
      delta ? el("p", { class: "t-2", style: { margin: 0 }, text: delta }) : null,
    ]);
  }

  turnNode(turn) {
    if (turn.who === "student") {
      return el("div", { class: "turn" }, [
        el("div", { class: "turn-who", text: "You" }),
        el("div", { class: "turn-body", text: turn.text }),
      ]);
    }
    const node = el("div", { class: "turn ai" }, [
      el("div", { class: "turn-who" }, [aiMark("idle"), el("span", { text: "Tutor" })]),
      el("div", { class: "turn-body" }, [
        turn.pending
          ? el("span", { class: "loading" }, [aiMark("thinking"), el("span", { text: turn.pending })])
          : turn.error
            ? el("p", { style: { color: "var(--error)" }, text: turn.error })
            : ai.renderAnswer(turn.answer),
      ]),
    ]);
    for (const chip of node.querySelectorAll(".chip.ai[data-intent]")) {
      chip.addEventListener("click", () => this.ask({ intent: chip.dataset.intent }));
    }
    return node;
  }

  // -------------------------------------------------------------- the ask

  async ask(request) {
    const ctx = this.context();
    const q = ctx.question;

    if (request.intent === "voiceUnavailable") {
      modal("Voice needs a recogniser", el("p", {
        text: "This browser has no speech recognition, so nothing would be listening. On an iPad, dictation from the keyboard works in the box; a spoken reply needs the tutor server.",
      }), [{ label: "Close" }]);
      return;
    }

    const intent = request.intent === "ask" ? ai.intentOf(request.text) : request.intent;
    const asked = request.text || defaultPhrasing(intent, ctx);
    this.thread.push({ who: "student", text: asked });

    // Asking for help is evidence about how much this attempt will prove, so it is
    // logged before the answer arrives rather than after it.
    if (q && ["hint", "steps", "answer", "explain"].includes(intent)) {
      this.helpUsed[q.id] = deepest(this.helpUsed[q.id], intent);
      store.append({
        type: "assistanceRequested", questionId: q.id, conceptId: q.conceptId,
        rung: intent, sessionId: store.sessionId,
      });
    }

    const pending = { who: "ai", pending: "Thinking…" };
    this.thread.push(pending);
    this.busy = true;
    this.renderPanel();

    const gateway = store.getPref("gatewayUrl", "");
    const shown = q && this.results[q.id];
    try {
      if (gateway) {
        pending.pending = "Asking the tutor…";
        const reply = await ai.askGateway(gateway, {
          ask: asked,
          mode: intent,
          questionText: q ? q.prompt : "",
          selection: ctx.kind === "working" ? `${ctx.strokeCount} handwritten strokes` : "",
          workingText: shown ? `Their answer: ${shown.submitted} (marked ${shown.result.verdict}: ${shown.result.reason})` : "",
          masteryHints: this.masteryHint(q),
          subject: "mathematics",
        });
        Object.assign(pending, { pending: null, answer: reply });
      } else {
        Object.assign(pending, {
          pending: null,
          answer: ai.localAnswer(intent, ctx, {
            result: shown && shown.result, diagnosis: shown && shown.diagnosis,
            submitted: shown && shown.submitted,
          }),
        });
      }
    } catch (err) {
      Object.assign(pending, { pending: null, error: `${err.message}. Written help is still available below.` });
      this.thread.push({
        who: "ai", answer: ai.localAnswer(intent, ctx, {
          result: shown && shown.result, diagnosis: shown && shown.diagnosis,
          submitted: shown && shown.submitted,
        }),
      });
    }
    this.busy = false;
    this.renderPanel();
    announce("The tutor answered");
  }

  masteryHint(q) {
    if (!q) return "";
    const view = store.project().concepts.find((c) => c.conceptId === q.conceptId);
    if (!view) return "No history on this topic yet.";
    return `${view.name}: ${Math.round(view.pUnaided * 100)}% unaided over ${plural(view.attempts, "attempt")}, currently ${view.state}.`;
  }

  // ------------------------------------------------------------- marking

  check(q, text) {
    if (!text || !text.trim()) { announce("Type an answer first"); return; }
    const priorView = store.project().concepts.find((c) => c.conceptId === q.conceptId);
    const before = priorView ? priorView.pUnaided : mastery.predictedP(mastery.newState(q.conceptId));

    const result = this.app.grade(text, q.expected);
    const diagnosis = diagnose(result, q);
    const assistance = assistanceOf(this.helpUsed[q.id]);

    store.append({
      type: "attempt", questionId: q.id, conceptId: q.conceptId, submitted: text,
      outcome: result.verdict === "correct" ? "correct"
        : result.verdict === "partiallyCorrect" ? "partial" : "incorrect",
      errorType: diagnosis.errorType,
      nearMiss: result.nearMiss ? result.nearMiss.kind : null,
      assistance, kind: q.kind === "transfer" ? "transfer" : "practice",
      sessionId: store.sessionId, graderReason: result.reason,
    });
    store.invalidate();

    const after = store.project().concepts.find((c) => c.conceptId === q.conceptId);
    const delta = after
      ? `Unaided ability for ${after.name}: ${Math.round(before * 100)}% → ${Math.round(after.pUnaided * 100)}%`
        + (assistance === "solution" ? " — unchanged, because you were shown the answer." : "")
      : null;

    this.results[q.id] = { result, diagnosis, submitted: text, delta };
    if (result.verdict === "correct") this.helpUsed[q.id] = null;
    this.renderPage();
    this.renderPanel();
    announce(`${diagnosis.title}. ${diagnosis.fix}`);
  }

  /**
   * Export is the one place the layers are combined. The original page and the
   * student's ink stay separate everywhere else, so handing work in can never
   * alter what they were given or what they wrote.
   */
  print() {
    const wasOpen = this.panelOpen;
    if (wasOpen) { this.panelOpen = false; this.render(); }
    const done = () => {
      window.removeEventListener("afterprint", done);
      if (wasOpen) { this.panelOpen = true; this.render(); }
    };
    window.addEventListener("afterprint", done);
    setTimeout(() => window.print(), 60);
    setTimeout(done, 4000);
  }
}

const ORDER = ["explain", "hint", "steps", "answer"];
const deepest = (a, b) => (ORDER.indexOf(b) > ORDER.indexOf(a || "") ? b : a || b);

/** The deepest help taken decides how much this attempt proves about unaided work. */
function assistanceOf(rung) {
  return { explain: "hint", hint: "hint", steps: "worked", answer: "solution" }[rung] || "none";
}

function defaultPhrasing(intent, ctx) {
  const what = ai.describe(ctx).label;
  return {
    hint: `Give me a hint for ${what}`,
    explain: `Explain ${what}`,
    steps: `Show the steps for ${what}`,
    answer: `Show the full answer for ${what}`,
    check: `Check ${what}`,
    mistake: `Where did I go wrong on ${what}?`,
    example: `Give me a similar question`,
    quiz: `Quiz me on this`,
    simplify: `Explain ${what} more simply`,
    summarise: `Summarise ${what}`,
  }[intent] || `Explain ${what}`;
}
