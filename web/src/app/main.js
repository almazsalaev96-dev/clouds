/**
 * Shell and router.
 *
 * The grader is imported from the gateway's own TypeScript source and bundled into
 * this page by `web/tools/build.mjs`, so the browser marks answers with the code
 * the server runs rather than with a second implementation that drifts. The
 * learning engine here is the same JavaScript module the parity tests hold to
 * `fixtures/learning-golden.json`, alongside the Python reference and the Swift
 * port.
 */
import { grade } from "../../../server/src/grading/grade.ts";
import { el, add, clear, icon, announce } from "./ui.js";
import * as store from "./store.js";
import { seed } from "./seed.js";
import * as tutor from "./tutor.js";
import { Workspace } from "./workspace.js";
import { home } from "./home.js";
import { documents, analysing } from "./documents.js";
import { subjects, progress } from "./knowledge.js";
import { tasks, exam } from "./tasks.js";
import { diagnose } from "./diagnose.js";
import { aiScreen } from "./aiscreen.js";
import { settings } from "./settings.js";
import { WORKSHEETS, worksheetById } from "./bank.js";

const RAIL = [
  ["home", "Home", "home"],
  ["documents", "Documents", "documents"],
  ["subjects", "Subjects", "subjects"],
  ["tasks", "Tasks", "tasks"],
  ["ai", "Tutor", "ai"],
  ["progress", "Progress", "progress"],
];

const SCREENS = {
  home: (app) => home(app),
  documents: (app) => documents(app),
  workspace: (app) => app.workspace.mount(),
  subjects: (app) => subjects(app),
  tasks: (app) => tasks(app),
  exam: (app) => exam(app),
  ai: (app) => aiScreen(app),
  progress: (app) => progress(app),
  diagnose: (app, p) => diagnose(app, p),
  settings: (app) => settings(app),
  analysing: (app, p) => analysing(app, p.doc),
};

/** Screens that manage their own scrolling and fill the frame. */
const FULL_BLEED = new Set(["workspace", "exam"]);

class App {
  constructor(root) {
    this.root = root;
    this.screen = "home";
    this.params = {};
    this.workspace = new Workspace(this);
    this.grade = grade;
  }

  boot() {
    store.load();
    // An app with nothing in it cannot show what it does, so a first run starts
    // from example history rather than from a blank progress table.
    if (store.allEvents().length === 0 && store.getPref("exampleHistory", null) === null) seed(store);

    store.subscribe((detail) => {
      if (detail.type === "storageError") {
        announce("This browser refused to save. Your work is still on screen but will not survive a reload.");
      }
    });

    this.mount();

    // Ask the deployment whether it has a tutor. Where the gateway runs on this
    // origin — the Vercel deployment in this repository — there is nothing to
    // configure: the page finds it, and the API key stays on the server.
    tutor.probe().then(() => {
      if (this.screen === "settings" || this.screen === "ai") this.rerender();
    });

    const last = store.getPref("lastDocument", null);
    if (last && last.kind === "worksheet") this.workspace.open(last);

    window.addEventListener("beforeunload", () => store.flush());
    document.addEventListener("visibilitychange", () => { if (document.hidden) store.flush(); });
  }

  mount() {
    clear(this.root);
    this.main = el("main", { class: "main", id: "main" });
    add(this.root, this.rail(), this.main);
    this.rerender();
  }

  rail() {
    this.railEl = el("nav", { class: "rail", "aria-label": "Sections" }, [
      el("div", { class: "rail-mark", "aria-hidden": "true", text: "S" }),
      ...RAIL.map(([id, label, glyph]) => el("button", {
        class: `rail-item ${id === "ai" ? "ai" : ""}`.trim(), dataset: { screen: id },
        title: label, onclick: () => this.go(id),
      }, [
        el("span", { html: icon(glyph) }),
        el("span", { class: "rail-label", text: label }),
      ])),
      el("div", { class: "rail-spacer" }),
      el("button", {
        class: "rail-item", dataset: { screen: "settings" }, title: "Settings",
        onclick: () => this.go("settings"),
      }, [el("span", { html: icon("settings") }), el("span", { class: "rail-label", text: "Settings" })]),
    ]);
    return this.railEl;
  }

  go(screen, params = {}) {
    if (this.screen === "workspace" && screen !== "workspace") this.workspace.destroy();
    if (this.screen === "exam" && screen !== "exam" && this.main.firstChild) {
      this.main.firstChild.dispatchEvent(new CustomEvent("slate:teardown"));
    }
    this.screen = screen;
    this.params = params;
    this.rerender();
  }

  rerender() {
    store.invalidate();
    clear(this.main);
    const view = SCREENS[this.screen](this, this.params);
    if (FULL_BLEED.has(this.screen)) add(this.main, view);
    else add(this.main, el("div", { class: "scroll" }, [view]));

    for (const item of this.railEl.querySelectorAll(".rail-item")) {
      const on = item.dataset.screen === this.screen
        || (item.dataset.screen === "home" && this.screen === "workspace");
      item.classList.toggle("on", on);
      item.setAttribute("aria-current", on ? "page" : "false");
    }
  }

  // -------------------------------------------------------------- actions

  openWorksheet(worksheetId) {
    const ws = worksheetById[worksheetId];
    if (!ws) return;
    const already = store.allEvents().some((e) => e.type === "worksheetOpened" && e.assignmentId === worksheetId);
    if (!already) {
      store.append({
        type: "worksheetOpened", assignmentId: worksheetId, title: ws.title,
        conceptIds: ws.conceptIds, questionsTotal: ws.questionIds.length,
      });
    }
    store.invalidate();
    this.openDocument({ id: `ws:${worksheetId}`, kind: "worksheet", worksheetId, title: ws.title });
  }

  openDocument(doc) {
    // A PDF lives in memory only: its bytes are the student's file, not ours to keep.
    store.setPref("lastDocument", doc.kind === "worksheet" ? doc : null);
    if (doc.kind === "pdf") store.append({ type: "documentOpened", documentId: doc.id });
    this.workspace.open(doc);
    this.go("workspace");
    requestAnimationFrame(() => this.workspace.fit());
  }

  /** A recommendation is only useful if pressing it goes somewhere. */
  start(action) {
    if (action.kind === "diagnostic") { this.go("diagnose", { conceptId: action.conceptIds[0] }); return; }
    if (action.kind === "rest") { this.go("home"); return; }
    if (action.assignmentId) { this.openWorksheet(action.assignmentId); return; }
    const worksheet = WORKSHEETS.find((w) => w.conceptIds.includes(action.conceptIds[0]));
    if (worksheet) this.openWorksheet(worksheet.id);
    else this.go("progress");
  }

  async importFile(file) {
    const id = `pdf:${file.name}:${file.size}`;
    if (file.type === "application/pdf") {
      try {
        const lib = await pdfLibrary();
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pdf = await lib.getDocument({ data: bytes }).promise;
        this.go("analysing", { doc: { id, kind: "pdf", title: file.name, size: file.size, pdf } });
      } catch (err) {
        announce(`That PDF could not be opened: ${err.message}`);
      }
      return;
    }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      store.append({ type: "documentImported", documentId: id, name: file.name, size: file.size, pages: 1, subject: null });
      this.openDocument({ id, kind: "image", title: file.name, url });
      return;
    }
    announce("Slate can open PDFs and photographs of pages.");
  }

  reopenDocument(record) {
    // The bytes were never kept, so reopening asks for the file again rather than
    // pretending to have it.
    announce("Choose the file again — Slate stores your ink and notes, never a copy of your document.");
    const input = el("input", { type: "file", accept: "application/pdf,image/*" });
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (file) this.importFile(file);
    });
    input.click();
  }
}

/**
 * pdf.js is loaded on demand: a student who only uses the built-in worksheets
 * should not pay for a renderer they never open.
 */
let pdfPromise = null;
function pdfLibrary() {
  if (pdfPromise) return pdfPromise;
  pdfPromise = new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(configure(window.pdfjsLib));
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs";
    script.type = "module";
    script.onload = () => (window.pdfjsLib
      ? resolve(configure(window.pdfjsLib))
      : reject(new Error("pdf.js loaded but did not register")));
    script.onerror = () => reject(new Error("pdf.js could not be downloaded"));
    document.head.appendChild(script);
  });
  return pdfPromise;
}

function configure(lib) {
  lib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";
  return lib;
}

const app = new App(document.getElementById("app"));
app.boot();
window.__slate = { app, store };
