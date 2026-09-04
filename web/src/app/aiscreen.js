/**
 * The tutor, full screen.
 *
 * The same conversation as the workspace panel, with the same context — moving
 * between them never restarts the discussion, because the thread and the context
 * both live on the workspace rather than on either surface.
 */
import { el, add, clear, icon, aiMark, plural } from "./ui.js";
import * as store from "./store.js";
import * as ai from "./ai.js";
import * as tutor from "./tutor.js";

export function aiScreen(app) {
  const ws = app.workspace;
  const node = el("div", { class: "page stack g5" });
  const ctx = ws.doc ? ws.context() : null;
  const connected = tutor.available();

  add(node, el("header", { class: "stack g2" }, [
    el("h1", { class: "t-title", text: "Tutor" }),
    el("p", { class: "t-2", style: { margin: 0 },
      text: ws.doc
        ? `Carrying on from ${ws.doc.title} — ${ai.describe(ctx).label}.`
        : "Nothing is open, so there is no page to talk about yet. Open a worksheet and the tutor follows you into it." }),
  ]));

  add(node, el("section", { class: "card stack g3" }, connected
    ? [
        el("div", { class: "row" }, [aiMark("idle"), el("span", { class: "t-cap", style: { color: "var(--ai)" }, text: "Tutor connected" })]),
        el("p", { class: "t-body", style: { margin: 0 },
          text: tutor.state.sameOrigin
            ? "The tutor runs on this site, and the API key lives in the deployment's environment variables. Nothing in this page has ever seen it."
            : `Connected to ${tutor.state.origin}. Your key stays on that server.` }),
      ]
    : [
        el("div", { class: "row" }, [aiMark("idle"), el("span", { class: "t-cap", style: { color: "var(--ai)" }, text: "Written help" })]),
        el("p", { class: "t-body", style: { margin: 0 },
          text: "No tutor server is answering, so replies here come from each worksheet's own explanation, from what the marker found in your answers, and from your record — not generated." }),
        el("p", { class: "t-2", style: { margin: 0 },
          text: "A model that answers your own questions needs an API key, and a key in a web page is a key published. Slate keeps yours on a server instead." }),
        el("button", { class: "btn small", onclick: () => app.go("settings") }, "Set up the tutor"),
      ]));

  const thread = el("div", { class: "stack" });
  const paint = () => {
    clear(thread);
    if (!ws.thread.length) {
      add(thread, el("div", { class: "empty" }, [
        el("span", { style: { color: "var(--ai)" }, html: icon("ai", 34) }),
        el("p", { text: ws.doc
          ? "Ask about the page you are on, or about anything you have written."
          : "Open something first, and this becomes a conversation about it." }),
      ]));
      return;
    }
    for (const turn of ws.thread) add(thread, ws.turnNode(turn));
  };
  paint();
  add(node, thread);

  const composer = new ai.Composer({
    getContext: () => (ws.doc ? ws.context() : null),
    onAsk: async (request) => {
      if (!ws.doc) { app.go("home"); return; }
      await ws.ask(request);
      paint();
      thread.scrollIntoView({ block: "end", behavior: "smooth" });
    },
  });
  add(node, composer.node);
  return node;
}
