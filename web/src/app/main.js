/**
 * Entry point and router.
 *
 * The grader is imported from the gateway's own TypeScript source, bundled into
 * this file by `web/tools/build.mjs`. That is deliberate: the browser build must
 * not be a second, drifting implementation of how an answer is marked. Likewise
 * the learning engine here is the same JavaScript module that the parity tests
 * run against `fixtures/learning-golden.json`, alongside the Python reference and
 * the Swift port.
 */
import { grade } from "../../../server/src/grading/grade.ts";
import { el, clear, add, icon, announce } from "./ui.js";
import * as store from "./store.js";
import { StudyView } from "./study.js";
import { desk, diagnose, progress, settings } from "./views.js";
import { seed } from "./seed.js";

const SCREENS = {
  desk: { label: "Desk", icon: "desk", render: (app) => desk(app) },
  study: { label: "Page", icon: "page", render: (app) => app.study.mount() },
  diagnose: { label: "Diagnose", icon: "diagnose", render: (app, p) => diagnose(app, p) },
  progress: { label: "Progress", icon: "progress", render: (app) => progress(app) },
  settings: { label: "Settings", icon: "settings", render: (app) => settings(app) },
};

class App {
  constructor(root) {
    this.root = root;
    this.screen = "desk";
    this.params = {};
    this.study = new StudyView(this);
    this.grade = grade;
  }

  start() {
    store.load();
    // An app with nothing in it cannot show what it does, so a first run starts
    // from example history rather than from a blank progress table.
    if (store.allEvents().length === 0 && store.getPref("exampleHistory", null) === null) seed(store);
    store.subscribe((detail) => {
      if (detail.type === "storageError") {
        announce("This browser refused to save. Your work is still on screen but will not survive a reload.");
      }
    });
    // Coming back to the Page tab should find the page you left, not an empty room.
    const last = store.getPref("lastDocument", null);
    if (last && last.kind === "worksheet") this.study.open(last);
    this.mount();
    window.addEventListener("beforeunload", () => store.flush());
    document.addEventListener("visibilitychange", () => { if (document.hidden) store.flush(); });
  }

  mount() {
    clear(this.root);
    this.main = el("main", { class: "main", id: "main" });
    add(this.root, this.nav(), this.main);
    this.rerender();
  }

  nav() {
    this.navEl = el("nav", { class: "nav", "aria-label": "Sections" }, [
      el("div", { class: "brand" }, [
        el("span", { class: "brand-mark", text: "◱" }),
        el("span", { class: "brand-name", text: "Slate" }),
      ]),
      ...Object.entries(SCREENS).map(([id, s]) => el("button", {
        class: "nav-item", dataset: { screen: id },
        onclick: () => this.go(id),
      }, [
        el("span", { class: "nav-icon", html: icon(s.icon) }),
        el("span", { class: "nav-label", text: s.label }),
      ])),
    ]);
    return this.navEl;
  }

  go(screen, params = {}) {
    if (this.screen === "study" && screen !== "study") this.study.destroy();
    this.screen = screen;
    this.params = params;
    this.rerender();
  }

  rerender() {
    store.invalidate();
    clear(this.main);
    this.main.appendChild(SCREENS[this.screen].render(this, this.params));
    for (const item of this.navEl.querySelectorAll(".nav-item")) {
      const on = item.dataset.screen === this.screen;
      item.classList.toggle("on", on);
      item.setAttribute("aria-current", on ? "page" : "false");
    }
    this.main.scrollTop = 0;
  }

  openDocument(doc) {
    // A PDF lives in memory only: its bytes are the student's file, not ours to keep.
    store.setPref("lastDocument", doc.kind === "worksheet" ? doc : null);
    this.study.open(doc);
    this.go("study");
    // The stage only has a size once it is in the document.
    requestAnimationFrame(() => this.study.fitSheet());
  }

  async importPdf() {
    const input = el("input", { type: "file", accept: "application/pdf" });
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      announce("Opening the PDF…");
      try {
        const lib = await pdfLibrary();
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pdf = await lib.getDocument({ data: bytes }).promise;
        store.append({ type: "documentImported", name: file.name, pages: pdf.numPages });
        this.openDocument({
          id: `pdf:${file.name}:${file.size}`, kind: "pdf", title: file.name, pdf,
        });
      } catch (err) {
        announce(`That PDF could not be opened: ${err.message}`);
      }
    });
    input.click();
  }
}

/**
 * pdf.js is loaded on demand rather than at boot: a student who only ever uses
 * the built-in worksheets should not pay for a renderer they never open.
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
app.start();
window.__slate = { app, store };
