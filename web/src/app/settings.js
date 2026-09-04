/**
 * Settings, and the honest account of what this build is.
 *
 * The tutor server field is the one that matters: Slate never holds a provider
 * credential, which is why there is a gateway to point at rather than a key to
 * paste. A key in a web page is a key published, and no amount of obfuscation
 * changes that — so the field asks for a URL and nothing else.
 */
import { el, add, clear, icon, aiMark, announce, modal } from "./ui.js";
import * as tutor from "./tutor.js";
import * as store from "./store.js";

const STATUS = {
  ready: ["Tutor connected", "success"],
  needsCode: ["Tutor needs an access code", "warning"],
  notConfigured: ["Tutor deployed, no API key yet", "warning"],
  absent: ["No tutor server", "unknown"],
  checking: ["Looking for a tutor…", "unknown"],
  unknown: ["Not checked yet", "unknown"],
};

/**
 * The one screen where the key question gets a straight answer.
 *
 * There is no field here for an Anthropic or ElevenLabs key, and there never will
 * be. A key in a web page is readable in the page source, in browser storage and
 * in the network tab — putting one here would not be a convenience, it would be
 * publishing it. The key goes in the deployment's environment variables, where
 * only the server can read it.
 */
function tutorSection(app) {
  const node = el("section", { class: "card stack g4" });

  const paint = () => {
    clear(node);
    const [label, tone] = STATUS[tutor.state.mode] || STATUS.unknown;

    add(node,
      el("div", { class: "spread" }, [
        el("h2", { class: "t-section", style: { margin: 0 }, text: "Tutor" }),
        el("span", { class: `tag ${tone}`, text: label }),
      ]),
      el("p", { class: "t-2", style: { margin: 0 }, text: describe() }),
    );

    if (tutor.state.mode === "ready" || tutor.state.mode === "needsCode") {
      add(node, codeField(paint));
    }
    if (tutor.state.mode === "notConfigured" || tutor.state.mode === "absent") {
      add(node, setUpSteps());
    }
    add(node, advanced(paint), el("div", { class: "row" }, [
      el("button", {
        class: "btn small", onclick: async () => { await tutor.probe(); paint(); },
      }, "Check again"),
    ]));
  };

  const describe = () => {
    switch (tutor.state.mode) {
      case "ready":
        return tutor.state.sameOrigin
          ? "The tutor runs on this site. Your API key is an environment variable on the server and has never been in this page."
          : `Connected to ${tutor.state.origin}. Your key stays on that server.`;
      case "needsCode":
        return "This tutor is running but only answers callers who present its access code. The code is not your API key — it is a password the deployment's owner chooses, and it can be changed at any time.";
      case "notConfigured":
        return tutor.state.detail;
      case "absent":
        return "Nothing is answering, so Slate is using its written help. Everything else — the marking, the diagnosis, the memory model — works exactly the same without a tutor.";
      default:
        return "Checking whether this deployment has a tutor.";
    }
  };

  paint();
  tutor.onChange(paint);
  return node;
}

function codeField(paint) {
  const input = el("input", {
    class: "field", type: "password", autocomplete: "off", spellcheck: "false",
    value: tutor.accessCode(), placeholder: "Access code", "aria-label": "Tutor access code",
  });
  return el("div", { class: "stack g3" }, [
    el("label", { class: "t-2", style: { margin: 0 },
      text: "Access code — the value of SLATE_APP_TOKEN on your gateway. Never an API key." }),
    input,
    el("div", { class: "row" }, [
      el("button", {
        class: "btn primary small",
        onclick: async () => {
          const value = input.value.trim();
          if (tutor.looksLikeSecret(value)) {
            refuseSecret();
            input.value = "";
            return;
          }
          store.setPref("accessCode", value);
          await tutor.probe();
          paint();
          announce(tutor.state.mode === "ready" ? "Tutor connected" : "Saved");
        },
      }, "Save and connect"),
      tutor.accessCode() ? el("button", {
        class: "btn quiet small",
        onclick: async () => { store.setPref("accessCode", ""); await tutor.probe(); paint(); },
      }, "Forget it") : null,
    ]),
  ]);
}

/** Refusing a pasted credential is part of the product, not an error path. */
function refuseSecret() {
  modal("That looks like an API key", el("div", { class: "stack g3" }, [
    el("p", { style: { margin: 0 },
      text: "Slate will not store it, because a key kept in a web page is a key published: it is readable in the page source, in browser storage and in the network tab by anyone using this device." }),
    el("p", { style: { margin: 0 },
      text: "Put it in your deployment instead — Vercel → your project → Settings → Environment Variables → ANTHROPIC_API_KEY — and redeploy. Only the server can read it there, and this page will find the tutor by itself." }),
    el("p", { class: "t-2", style: { margin: 0 },
      text: "If you have already pasted that key somewhere public, rotate it in the Anthropic Console." }),
  ]), [{ label: "Understood", variant: "primary" }]);
}

function setUpSteps() {
  const step = (n, title, body) => el("div", { class: "row", style: { alignItems: "flex-start" } }, [
    el("span", { class: "tag strong", style: { minWidth: "22px", justifyContent: "center" }, text: String(n) }),
    el("div", { class: "stack", style: { gap: "2px" } }, [
      el("span", { style: { fontWeight: 600 }, text: title }),
      el("span", { class: "t-2", text: body }),
    ]),
  ]);
  return el("div", { class: "stack g3" }, [
    el("div", { class: "row" }, [aiMark("idle"), el("span", { class: "t-cap", style: { color: "var(--ai)" }, text: "Turning the tutor on" })]),
    step(1, "Open your Vercel project", "Settings → Environment Variables."),
    step(2, "Add ANTHROPIC_API_KEY", "Your key from console.anthropic.com. It is read only by the server function, never sent to this page."),
    step(3, "Add SLATE_APP_TOKEN", "Any long random string you choose. It stops a public deployment becoming a free tutor billed to you — required in production for exactly that reason."),
    step(4, "Redeploy, then enter that same token here", "Optionally add ELEVENLABS_API_KEY for spoken replies, and SLATE_EFFORT=medium if answers ever hit the function's time limit."),
    el("p", { class: "t-2", style: { margin: 0 },
      text: "Nothing else changes: the marking, the diagnosis and the memory model all run in this page and never needed a key." }),
  ]);
}

function advanced(paint) {
  const input = el("input", {
    class: "field", type: "url", value: store.getPref("gatewayUrl", "") || "",
    placeholder: "https://your-gateway.example.com", "aria-label": "Gateway address",
  });
  return el("details", {}, [
    el("summary", { class: "t-2", style: { cursor: "pointer" }, text: "Use a gateway somewhere else" }),
    el("div", { class: "stack g3", style: { marginTop: "12px" } }, [
      el("p", { class: "t-2", style: { margin: 0 },
        text: "Leave this blank to use the tutor on this site. Set it to run your own gateway elsewhere — it must send CORS headers for this origin." }),
      input,
      el("div", { class: "row" }, [
        el("button", {
          class: "btn small",
          onclick: async () => {
            const value = input.value.trim();
            if (tutor.looksLikeSecret(value)) { refuseSecret(); input.value = ""; return; }
            store.setPref("gatewayUrl", value);
            await tutor.probe();
            paint();
            announce("Saved");
          },
        }, "Save"),
      ]),
    ]),
  ]);
}

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

  add(node, tutorSection(app));

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
      "The tutor's words need a server. When this deployment has an ANTHROPIC_API_KEY set, the tutor answers for real; without one you get written help instead, labelled as written help. The key is only ever read by the server function — there is no field in this app that accepts one, and pasting one is refused.",
      "Handwriting is captured, not read. Recognising your working needs a model, so the answer box is typed and the tutor is told what you typed rather than what you wrote.",
    ].map((t) => el("li", { text: t, style: { marginBottom: "8px" } }))),
  ]));

  return node;
}
