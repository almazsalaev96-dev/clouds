/**
 * Documents.
 *
 * Importing is where the product has to earn trust: the analysis that runs after a
 * file lands says what is in the document, and every line of it is measured rather
 * than asserted. Questions come from the numbering in the text layer, figures from
 * the page's own image operators, tables from columns that actually line up. A scan
 * with no text layer is reported as a scan, not silently analysed as though it had
 * been read.
 */
import { el, add, clear, icon, aiMark, relativeTime, plural, announce, modal } from "./ui.js";
import * as store from "./store.js";
import { analyse, findings } from "./pdfintel.js";
import { WORKSHEETS } from "./bank.js";

export function documents(app) {
  const node = el("div", { class: "page stack g7" });
  const files = store.documents();

  add(node, el("header", { class: "spread" }, [
    el("div", { class: "stack" }, [
      el("h1", { class: "t-title", text: "Documents" }),
      el("p", { class: "t-2", style: { margin: "4px 0 0" },
        text: "Your own material. The file itself is never modified — your ink and notes are separate layers over it." }),
    ]),
    el("button", { class: "btn primary", onclick: () => importSheet(app) },
      [el("span", { html: icon("plus", 18) }), "Import"]),
  ]));

  if (!files.length) {
    add(node, el("div", { class: "card empty" }, [
      el("span", { class: "dim-3", html: icon("documents", 40) }),
      el("h2", { class: "t-section", text: "Your learning space is ready" }),
      el("p", { text: "Import your first worksheet and start learning. A PDF keeps its text, so Slate can tell you what is in it before you begin." }),
      el("button", { class: "btn primary", onclick: () => importSheet(app) }, "Import a PDF"),
    ]));
  } else {
    add(node, el("section", { class: "stack g3" }, [
      el("h2", { class: "t-section", text: "Recent" }),
      el("div", { class: "doc-list" }, files.map((d) => docTile(app, d))),
    ]));
  }

  add(node, el("section", { class: "stack g3" }, [
    el("h2", { class: "t-section", text: "Worksheets" }),
    el("p", { class: "t-2", style: { margin: 0 },
      text: "Built in, and fully marked: Slate knows what these questions are, so every answer is checked and diagnosed." }),
    el("div", { class: "doc-list" }, WORKSHEETS.map((w) => el("button", {
      class: "doc", onclick: () => app.openWorksheet(w.id),
    }, [
      el("div", { class: "doc-thumb" }, [
        el("i", { style: { width: "62%", height: "5px", background: "var(--paper-ink-2)" } }),
        el("i", { style: { width: "100%" } }), el("i", { style: { width: "88%" } }),
        el("i", { style: { width: "0", height: "10px" } }),
        el("i", { style: { width: "94%" } }), el("i", { style: { width: "70%" } }),
      ]),
      el("div", { class: "doc-meta" }, [
        el("span", { class: "doc-name", text: w.title }),
        el("span", { class: "t-2", text: `Mathematics · ${plural(w.questionIds.length, "question")}` }),
      ]),
    ]))),
  ]));

  return node;
}

function docTile(app, d) {
  return el("button", { class: "doc", onclick: () => app.reopenDocument(d) }, [
    el("div", { class: "doc-thumb" }, [
      el("i", { style: { width: "58%", height: "5px", background: "var(--paper-ink-2)" } }),
      el("i", { style: { width: "100%" } }), el("i", { style: { width: "92%" } }),
      el("i", { style: { width: "76%" } }),
    ]),
    el("div", { class: "doc-meta" }, [
      el("span", { class: "doc-name", text: d.name }),
      el("span", { class: "t-2", text: `${d.subject || "Document"} · ${plural(d.pages, "page")}` }),
      el("span", { class: "t-2 dim-3", text: `Opened ${relativeTime(d.lastOpened)}` }),
    ]),
  ]);
}

/** Files, photos and the camera are real here; a dedicated scanner is not. */
export function importSheet(app) {
  const body = el("div", { class: "stack g3" }, [
    option("file", "Files", "A PDF from this device or iCloud Drive", () => pick(app, "application/pdf")),
    option("scan", "Photos", "A photo of a worksheet from your library", () => pick(app, "image/*")),
    option("scan", "Camera", "Photograph a page now", () => pick(app, "image/*", "environment")),
    el("p", { class: "t-2", style: { margin: 0 },
      text: "Edge detection, deskewing and shadow removal need the camera pipeline in the iPad app; here a photo is imported as it is, and you can still write on it." }),
  ]);
  modal("Import", body, [{ label: "Cancel", variant: "quiet" }]);
}

function option(iconName, title, subtitle, onclick) {
  return el("button", {
    class: "focus", style: { border: "1px solid var(--border)", borderRadius: "var(--r-btn)", padding: "12px 16px" },
    onclick: () => { document.querySelector(".overlay")?.remove(); onclick(); },
  }, [
    el("span", { class: "dim", html: icon(iconName) }),
    el("div", { class: "grow stack" }, [
      el("span", { style: { fontWeight: 600 }, text: title }),
      el("span", { class: "focus-why", text: subtitle }),
    ]),
    el("span", { class: "dim-3", html: icon("chevron", 18) }),
  ]);
}

function pick(app, accept, capture) {
  const input = el("input", { type: "file", accept, capture });
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (file) app.importFile(file);
  });
  input.click();
}

/**
 * The analysis screen. The wait is narrated with what is actually happening,
 * because "Loading…" tells the student nothing and this can genuinely take a
 * second or two on a long document.
 */
export function analysing(app, doc) {
  const node = el("div", { class: "page stack g6" });
  const list = el("div", { class: "found" });
  const status = el("div", { class: "loading" }, [aiMark("thinking"), el("span", { text: "Understanding your worksheet…" })]);

  add(node,
    el("header", { class: "stack g2" }, [
      el("h1", { class: "t-title", text: doc.title }),
      el("p", { class: "t-2", style: { margin: 0 }, text: `${plural(doc.pdf ? doc.pdf.numPages : 1, "page")} · imported just now` }),
    ]),
    el("div", { class: "card stack g4" }, [status, list]),
  );

  const open = el("div", { class: "row" }, [
    el("button", { class: "btn primary", onclick: () => app.openDocument(doc) }, "Open it"),
  ]);

  (async () => {
    try {
      const analysis = doc.pdf
        ? await analyse(doc.pdf, (page, total) => {
            status.lastChild.textContent = `Reading page ${page} of ${total}…`;
          })
        : { pageCount: 1, questions: [], figures: 1, tables: 0, words: 0, subject: null, scanned: true };

      clear(status);
      add(status, aiMark("idle"), el("span", { text: "I have read this document." }));

      findings(analysis).forEach(([kind, text], i) => {
        const row = el("div", { class: "found-row", style: { animationDelay: `${i * 70}ms` } }, [
          el("span", { style: { color: kind === "scan" ? "var(--warning)" : "var(--ai)" }, html: icon(kind === "scan" ? "scan" : "check", 18) }),
          el("span", { text }),
        ]);
        add(list, row);
      });

      doc.analysis = analysis;
      doc.subject = analysis.subject;
      store.append({
        type: "documentImported", documentId: doc.id, name: doc.title,
        size: doc.size, pages: analysis.pageCount, subject: analysis.subject,
        analysis: {
          questions: analysis.questions.length, figures: analysis.figures,
          tables: analysis.tables, words: analysis.words, scanned: analysis.scanned,
        },
      });
      store.invalidate();
      add(node, open);
      announce("Document analysed");
    } catch (err) {
      clear(status);
      add(status, el("span", { style: { color: "var(--error)" } }, [
        el("strong", { text: "Something went wrong reading this file. " }),
        el("span", { text: "Your document is safe — nothing was changed. You can still open it and write on it." }),
      ]));
      add(node, open);
    }
  })();

  return node;
}
