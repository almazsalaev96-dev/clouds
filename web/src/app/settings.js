/**
 * Settings, and the honest account of what this build is.
 *
 * The tutor server field is the one that matters: Slate never holds a provider
 * credential, which is why there is a gateway to point at rather than a key to
 * paste. A key in a web page is a key published, and no amount of obfuscation
 * changes that — so the field asks for a URL and nothing else.
 */
import { el, add, icon, announce, modal } from "./ui.js";
import * as store from "./store.js";

export function settings(app) {
  const node = el("div", { class: "page stack g6" });
  add(node, el("header", {}, [el("h1", { class: "t-title", text: "Settings" })]));

  const name = el("input", { class: "field", type: "text", value: store.getPref("name", "") || "",
    placeholder: "What should Slate call you?", "aria-label": "Your name" });
  add(node, el("section", { class: "card stack g3" }, [
    el("h2", { class: "t-section", text: "Your name" }),
    name,
    el("div", { class: "row" }, [
      el("button", {
        class: "btn", onclick: () => { store.setPref("name", name.value.trim()); app.rerender(); announce("Saved"); },
      }, "Save"),
    ]),
  ]));

  const url = el("input", { class: "field", type: "url", value: store.getPref("gatewayUrl", "") || "",
    placeholder: "https://your-gateway.example.com", "aria-label": "Tutor server address" });
  add(node, el("section", { class: "card stack g3" }, [
    el("h2", { class: "t-section", text: "Tutor server" }),
    el("p", { class: "t-2", style: { margin: 0 },
      text: "Slate never holds an API key. Requests go to a gateway you run; the gateway holds the credentials and talks to the model. Leave this blank and the app works entirely offline, with written help instead of a tutor." }),
    url,
    el("div", { class: "row" }, [
      el("button", {
        class: "btn primary",
        onclick: async () => {
          const value = url.value.trim();
          store.setPref("gatewayUrl", value);
          if (!value) { announce("Tutor server cleared"); app.rerender(); return; }
          try {
            const r = await fetch(`${value.replace(/\/+$/, "")}/health`);
            announce(r.ok ? "Tutor server reachable" : `The server answered ${r.status}`);
          } catch (err) {
            announce(`Could not reach the server: ${err.message}`);
          }
          app.rerender();
        },
      }, "Save and test"),
    ]),
  ]));

  const exam = el("input", { class: "field", type: "date", value: store.getPref("examDate", "") || "",
    "aria-label": "Exam date" });
  add(node, el("section", { class: "card stack g3" }, [
    el("h2", { class: "t-section", text: "Exam date" }),
    el("p", { class: "t-2", style: { margin: 0 },
      text: "Optional. If set, review intervals tighten as it approaches — target retention rises from 90% to 95%." }),
    exam,
    el("div", { class: "row" }, [
      el("button", {
        class: "btn",
        onclick: () => {
          store.setPref("examDate", exam.value);
          const days = exam.value ? (new Date(`${exam.value}T09:00:00`).getTime() - Date.now()) / 86_400_000 : null;
          store.setPref("daysUntilExam", days !== null && days > 0 ? days : null);
          store.invalidate();
          announce("Saved");
          app.rerender();
        },
      }, "Save"),
    ]),
  ]));

  add(node, el("section", { class: "card stack g3" }, [
    el("h2", { class: "t-section", text: "Your data" }),
    el("p", { class: "t-2", style: { margin: 0 },
      text: "Everything is stored in this browser. Nothing is uploaded unless you connect a tutor server, and then only the question and your working — not your name, and not the whole document." }),
    el("div", { class: "row wrap" }, [
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
          modal("Erase everything?", el("p", {
            text: "This removes every answer, every conclusion drawn from it, and all your ink. Because conclusions are recomputed from the log rather than stored, deleting the log deletes the beliefs too — there is no second copy.",
          }), [
            { label: "Cancel", variant: "quiet" },
            { label: "Erase", variant: "danger",
              onclick: () => { store.eraseEverything(); store.invalidate(); app.rerender(); announce("Erased"); } },
          ]);
        },
      }, "Erase everything"),
    ]),
  ]));

  add(node, el("section", { class: "card stack g3" }, [
    el("h2", { class: "t-section", text: "What is real here, and what is not" }),
    el("ul", { class: "t-body dim", style: { margin: 0, paddingLeft: "20px" } }, [
      "The marker is real, and is the gateway's own code. It parses your answer and the expected answer into expressions and compares them by evaluation, so 5, x = 5 and 10/2 all count — and it names sign flips, inverted fractions, degree and radian mix-ups and unit errors specifically.",
      "The learning model is real, and is the same model three times over: a Python reference, a Swift port for iPad, and this JavaScript build all reproduce one shared set of golden fixtures to nine decimal places.",
      "The adaptive diagnostic is real. Questions are chosen by expected information gain in bits, and a question that cannot separate the explanations is not asked.",
      "Document analysis is real and measured: questions come from the numbering in the text layer, figures from the page's own image operators, tables from columns that line up.",
      "The tutor's words are not real without a server. Written help ships with the app; a model that answers your own questions needs credentials, and credentials do not belong in a web page.",
      "Handwriting is captured, not read. Recognising your working needs a model, so the answer box is typed and the tutor is told what you typed rather than what you wrote.",
    ].map((t) => el("li", { text: t, style: { marginBottom: "8px" } }))),
  ]));

  return node;
}
