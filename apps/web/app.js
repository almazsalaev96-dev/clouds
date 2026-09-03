/**
 * Understory — client.
 *
 * The interface disappears when the user is focused (§24): navigation is a
 * quiet rail, content gets the width, and the AI is summoned rather than
 * permanently parked beside the work.
 */

import { $, api, clear, h, icon, mount, percent, prose, readFileAsText, relativeTime, streamTurn } from "./lib.js";
import { loadState, notice, refreshLists, render, state, subscribe, update } from "./state.js";

// ─────────────────────────────────────────────────────────────── actions ───

async function openDocument(id, { scrollToBlock } = {}) {
  update({ view: "doc", docLoading: true, docFailure: null, openArtifact: null });
  const result = await api(`/api/documents/${id}`);
  if (!result.ok) {
    update({ docLoading: false, docFailure: result.failure, openDocument: null });
    return;
  }
  update({ docLoading: false, openDocument: result.value, selection: null });
  if (scrollToBlock) highlightBlock(scrollToBlock);
}

async function openArtifact(id) {
  update({ view: "artifact", docLoading: true, docFailure: null });
  const result = await api(`/api/artifacts/${id}`);
  if (!result.ok) {
    update({ docLoading: false, docFailure: result.failure, openArtifact: null });
    return;
  }
  update({ docLoading: false, openArtifact: result.value.artifact });
}

function highlightBlock(blockId) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-block="${blockId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.dataset.cited = "true";
    setTimeout(() => { delete el.dataset.cited; }, 2600);
  });
}

async function ensureConversation() {
  if (state.ai.conversationId) return state.ai.conversationId;
  const result = await api("/api/conversations", { method: "POST" });
  if (!result.ok) {
    update({ ai: { ...state.ai, failure: result.failure } });
    return null;
  }
  state.ai.conversationId = result.value.conversation.id;
  state.ai.title = result.value.conversation.title;
  return state.ai.conversationId;
}

async function openConversation(id) {
  update({ ai: { ...state.ai, open: true, conversationId: id, failure: null, messages: [] } });
  const result = await api(`/api/conversations/${id}`);
  if (!result.ok) {
    update({ ai: { ...state.ai, failure: result.failure } });
    return;
  }
  update({
    ai: {
      ...state.ai,
      title: result.value.conversation.title,
      messages: result.value.messages,
    },
  });
}

/** Sends a turn and streams the answer (§35: the interface never freezes). */
async function ask(text, { selection } = {}) {
  const message = text.trim();
  if (!message || state.ai.streaming) return;

  const conversationId = await ensureConversation();
  if (!conversationId) return;

  const abort = new AbortController();
  update({
    ai: {
      ...state.ai,
      open: true,
      streaming: true,
      failure: null,
      streamText: "",
      streamCitations: [],
      streamTools: [],
      trace: null,
      abort,
      messages: [
        ...state.ai.messages,
        { id: `local-${Date.now()}`, role: "user", text: message, citations: [], toolCalls: [] },
      ],
    },
  });

  await streamTurn(conversationId, {
    text: message,
    openDocumentId: state.openDocument?.document.id,
    selection: selection ?? undefined,
  }, (event) => {
    const ai = state.ai;
    switch (event.type) {
      case "context":
        ai.trace = event.trace;
        break;
      case "text":
        ai.streamText += event.text;
        break;
      case "tool":
        ai.streamTools = [...ai.streamTools, event.record];
        break;
      case "citations":
        ai.streamCitations = event.citations;
        break;
      case "done":
        ai.messages = [...ai.messages, event.message];
        ai.streaming = false;
        ai.streamText = "";
        ai.streamTools = [];
        ai.streamCitations = [];
        ai.abort = null;
        void refreshLists();
        break;
      case "failure":
        ai.failure = event.failure;
        ai.streaming = false;
        ai.abort = null;
        break;
    }
    render();
  }, abort.signal);

  // If the stream ended without a terminal event, do not leave a spinner up.
  if (state.ai.streaming) {
    update({ ai: { ...state.ai, streaming: false, abort: null } });
  }
}

async function importFiles(files) {
  const list = [...files];
  if (list.length === 0) return;

  for (const file of list) {
    const read = await readFileAsText(file);
    if (!read.ok) {
      notice(read.failure.message, "error");
      continue;
    }
    const result = await api("/api/documents", {
      method: "POST",
      body: JSON.stringify({
        // No title: the server derives one from the document's own first
        // heading, which is almost always better than the filename. It falls
        // back to the opening line when there is no heading.
        text: read.value,
        mimeType: file.type || "text/plain",
        sourceKind: "upload",
      }),
    });
    if (!result.ok) {
      notice(result.failure.message, "error");
      continue;
    }
    await refreshLists();
    const { document: doc, blocks, concepts } = result.value;
    // WOW 1: say what was understood, not merely that a file was accepted.
    notice(
      `Read ${doc.title} — ${blocks} sections` +
      (concepts.length ? `, covering ${concepts.slice(0, 3).join(", ")}` : ""),
    );
    await openDocument(doc.id);
  }
}

async function recordAttempt(conceptId, { prompt, response, correct, difficulty }) {
  const result = await api("/api/learning/attempt", {
    method: "POST",
    body: JSON.stringify({ conceptId, prompt, response, correct, difficulty }),
  });
  if (!result.ok) {
    notice(result.failure.message, "error");
    return null;
  }
  await refreshLists();
  return result.value;
}

// ────────────────────────────────────────────────────────────────── views ───

function railView() {
  const tab = (name, view, label) =>
    h("button", {
      class: "rail__btn",
      "aria-current": state.view === view ? "page" : null,
      "aria-label": label,
      title: label,
      onclick: () => update({
        view,
        openDocument: view === "doc" ? state.openDocument : null,
        // Below the split-view breakpoint the panel takes the whole width, so
        // leaving it open would make this tap look like nothing happened.
        ai: window.innerWidth <= 900 ? { ...state.ai, open: false } : state.ai,
      }),
    }, icon(name));

  return h("nav", { class: "rail", "aria-label": "Main" },
    tab("home", "home", "Home"),
    tab("learn", "learn", "Learn"),
    h("button", {
      class: "rail__btn", "aria-label": "Search (Command K)", title: "Search  ⌘K",
      onclick: openSearch,
    }, icon("search")),
    h("button", {
      class: "rail__btn", "aria-label": "Ask the AI (Command J)", title: "Ask  ⌘J",
      onclick: () => update({ ai: { ...state.ai, open: !state.ai.open } }),
    }, icon("ai")),
    h("div", { class: "rail__spacer" }),
    tab("memory", "memory", "What the AI remembers"),
    h("button", {
      class: "rail__btn", "aria-label": "Switch light or dark theme", title: "Theme",
      onclick: cycleTheme,
    }, icon("theme")),
  );
}

function askBox({ autofocus = false, placeholder = "Ask anything, or drop in a document", focusKey = "ask" } = {}) {
  const input = h("textarea", {
    class: "ask__input", rows: 1, placeholder,
    "aria-label": "Ask the AI",
    "data-focus-key": focusKey,
    oninput: (e) => {
      e.target.style.height = "auto";
      e.target.style.height = `${e.target.scrollHeight}px`;
      send.disabled = e.target.value.trim().length === 0;
    },
    onkeydown: (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    onpaste: async (e) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        await importFiles(files);
      }
    },
  });

  const send = h("button", {
    class: "ask__send", disabled: true, "aria-label": "Send",
    onclick: () => submit(),
  }, icon("send", 18));

  const picker = h("input", {
    type: "file", multiple: true, class: "sr-only",
    accept: ".txt,.md,.markdown,.csv,.tsv,.json,.html,.xml,.yaml,.yml,.log,text/*",
    onchange: (e) => { void importFiles(e.target.files); e.target.value = ""; },
  });

  const box = h("div", { class: "ask__box" },
    h("button", {
      class: "btn btn--quiet btn--sm", "aria-label": "Add a file",
      onclick: () => picker.click(),
    }, "＋"),
    input, picker, send,
  );

  function submit() {
    const value = input.value;
    if (!value.trim()) return;
    input.value = "";
    input.style.height = "auto";
    send.disabled = true;
    void ask(value);
  }

  // Drag and drop straight onto the input (§25).
  for (const type of ["dragenter", "dragover"]) {
    box.addEventListener(type, (e) => { e.preventDefault(); box.dataset.drop = "active"; });
  }
  for (const type of ["dragleave", "drop"]) {
    box.addEventListener(type, () => { delete box.dataset.drop; });
  }
  box.addEventListener("drop", (e) => {
    e.preventDefault();
    void importFiles(e.dataTransfer?.files ?? []);
  });

  if (autofocus) requestAnimationFrame(() => input.focus());
  return h("div", { class: "ask" }, box);
}

function modelBanner() {
  if (state.model.available) return null;
  return h("div", { class: "banner", role: "status" },
    h("span", {}, state.model.failure?.message ??
      "The AI is not available right now. Reading, search and notes still work."),
  );
}

function noticeBanner() {
  if (!state.notice) return null;
  return h("div", {
    class: `banner toast${state.notice.tone === "error" ? " toast--error" : ""}`,
    role: "status", "aria-live": "polite",
  },
    h("div", { style: "flex:1" }, state.notice.message),
    h("button", {
      class: "btn btn--quiet btn--sm", "aria-label": "Dismiss",
      onclick: () => update({ notice: null }),
    }, "×"),
  );
}

/** Home answers "what matters right now" — not a dashboard of widgets (§19). */
function homeView() {
  const hasAnything = state.documents.length > 0 || state.conversations.length > 0;

  return h("div", { class: "pane__inner" },
    modelBanner(),
    h("h1", {}, hasAnything ? "What are you working on?" : "Start with anything"),
    h("p", { class: "muted", style: "margin:8px 0 24px" },
      hasAnything
        ? "Ask a question, or drop in what you are reading."
        : "Drop in a document, paste your notes, or just ask. Nothing to set up first."),

    askBox({ autofocus: true }),

    // §23 — only shown when there is real evidence behind it.
    state.nextActions.length > 0 ? h("section", { style: "margin-top:32px" },
      h("div", { class: "eyebrow", style: "margin-bottom:8px" }, "Worth doing next"),
      h("div", { class: "rows" },
        state.nextActions.map((action) => h("div", { class: "suggestion" },
          h("div", { class: "suggestion__body" },
            h("div", { style: "font-weight:500" }, action.title),
            h("div", { class: "suggestion__why" }, action.because),
          ),
          h("button", {
            class: "btn btn--sm",
            onclick: () => { update({ view: "learn" }); },
          }, "Open"),
        )),
      ),
    ) : null,

    state.conversations.length > 0 ? h("section", { style: "margin-top:32px" },
      h("div", { class: "eyebrow", style: "margin-bottom:8px" }, "Continue"),
      h("div", { class: "rows" },
        state.conversations.slice(0, 4).map((c) => h("button", {
          class: "row", onclick: () => openConversation(c.id),
        },
          icon("ai", 16),
          h("div", { class: "row__main" },
            h("div", { class: "row__title" }, c.title),
            h("div", { class: "row__meta" }, relativeTime(c.updatedAt)),
          ),
        )),
      ),
    ) : null,

    state.documents.length > 0 ? h("section", { style: "margin-top:32px" },
      h("div", { class: "eyebrow", style: "margin-bottom:8px" }, "Your material"),
      h("div", { class: "rows" },
        state.documents.slice(0, 8).map((d) => h("button", {
          class: "row", onclick: () => openDocument(d.id),
        },
          icon("doc", 16),
          h("div", { class: "row__main" },
            h("div", { class: "row__title" }, d.title),
            h("div", { class: "row__meta" }, `${d.blockCount} sections · ${relativeTime(d.updatedAt)}`),
          ),
        )),
      ),
    ) : null,

    state.artifacts.length > 0 ? h("section", { style: "margin-top:32px" },
      h("div", { class: "eyebrow", style: "margin-bottom:8px" }, "Made with the AI"),
      h("div", { class: "rows" },
        state.artifacts.slice(0, 6).map((a) => h("button", {
          class: "row", onclick: () => openArtifact(a.id),
        },
          icon("doc", 16),
          h("div", { class: "row__main" },
            h("div", { class: "row__title" }, a.title),
            h("div", { class: "row__meta" }, `${a.kind} · v${a.version} · ${relativeTime(a.updatedAt)}`),
          ),
        )),
      ),
    ) : null,

    !hasAnything ? h("div", { class: "state", style: "margin-top:24px" },
      h("div", { class: "state__body tiny" },
        "Text, Markdown and CSV can be read today. ",
        h("kbd", {}, "⌘K"), " searches everything. ",
        h("kbd", {}, "⌘J"), " opens the AI.",
      ),
    ) : null,
  );
}

/** The reader. Content leads; actions appear on selection (§13, §24). */
function documentView() {
  if (state.docLoading) {
    return h("div", { class: "pane__inner" },
      h("div", { class: "skeleton skeleton--line", style: "width:40%;height:2rem" }),
      ...Array.from({ length: 8 }, () => h("div", { class: "skeleton skeleton--line" })),
    );
  }
  if (state.docFailure) {
    return h("div", { class: "pane__inner" },
      h("div", { class: "state--error" },
        h("div", { class: "state__title" }, "Could not open that document"),
        h("div", {}, state.docFailure.message),
        h("button", { class: "btn btn--sm", style: "margin-top:12px", onclick: () => update({ view: "home" }) }, "Back"),
      ),
    );
  }
  if (!state.openDocument) {
    return h("div", { class: "pane__inner" },
      h("div", { class: "state" },
        h("div", { class: "state__title" }, "Nothing open"),
        h("div", { class: "state__body" }, "Choose something from Home, or drop a file in."),
        h("button", { class: "btn", onclick: () => update({ view: "home" }) }, "Go to Home"),
      ),
    );
  }

  const { document: doc, blocks } = state.openDocument;
  let lastPage = null;

  return h("div", { class: "pane__inner pane__inner--wide" },
    h("div", { style: "display:flex;align-items:center;gap:8px;margin-bottom:24px" },
      h("button", { class: "btn btn--quiet btn--sm", "aria-label": "Back", onclick: () => update({ view: "home" }) }, icon("back", 16)),
      h("div", { style: "flex:1;min-width:0" },
        h("h1", { style: "font-size:1.375rem" }, doc.title),
        h("div", { class: "row__meta" }, `${doc.blockCount} sections · added ${relativeTime(doc.updatedAt)}`),
      ),
      h("button", {
        class: "btn btn--sm",
        onclick: () => { update({ ai: { ...state.ai, open: true } }); void ask(`Give me the shape of "${doc.title}" — what it covers and what matters most.`); },
      }, "Summarise"),
    ),

    h("article", { class: "doc", id: "reader" },
      blocks.map((block) => {
        const showPage = block.pageNumber !== null && block.pageNumber !== lastPage;
        if (showPage) lastPage = block.pageNumber;
        const depthClass = block.kind === "heading" ? ` block--h${Math.min(block.depth, 2)}` : "";
        return h("div", {
          class: `block block--${block.kind}${depthClass}`,
          "data-block": block.id,
        },
          showPage ? h("span", { class: "block__page" }, `p${block.pageNumber}`) : null,
          displayText(block),
        );
      }),
    ),
  );
}

/**
 * Source text is stored verbatim so citation offsets stay exact. Markers that
 * exist only to encode structure — heading hashes, list bullets — are stripped
 * at render time, since the structure is already carried by the block's kind
 * and drawn by the stylesheet.
 */
function displayText(block) {
  if (block.kind === "heading") return block.text.replace(/^#+\s*/, "");
  if (block.kind === "listItem") return block.text.replace(/^\s*([-*+•]|\d+[.)])\s+/, "");
  if (block.kind === "quote") return block.text.replace(/^\s*>\s?/gm, "");
  return block.text;
}

/** Mastery, reported honestly — unknown is drawn as unknown (§10). */
function learnView() {
  const container = h("div", { class: "pane__inner" },
    h("h1", {}, "Learning"),
    h("p", { class: "muted", style: "margin:8px 0 24px" },
      "Built from questions you have actually answered — nothing is inferred from conversation alone."),
    h("div", { id: "learn-body" }, h("div", { class: "skeleton skeleton--line" })),
  );

  void (async () => {
    const [learning, concepts] = await Promise.all([
      api("/api/learning"), api("/api/concepts"),
    ]);
    const body = $("#learn-body", container);
    if (!body) return;

    if (!learning.ok || !concepts.ok) {
      mount(body, h("div", { class: "state--error" },
        h("div", { class: "state__title" }, "Could not load learning"),
        h("div", {}, (learning.ok ? concepts.failure : learning.failure).message)));
      return;
    }

    const all = concepts.value.concepts;
    if (all.length === 0) {
      mount(body, h("div", { class: "state" },
        h("div", { class: "state__title" }, "Nothing to track yet"),
        h("div", { class: "state__body" },
          "Add a document and the topics it covers appear here. Mastery starts once you answer questions about them."),
        h("button", { class: "btn", onclick: () => update({ view: "home" }) }, "Add something")));
      return;
    }

    mount(body,
      learning.value.nextActions.length > 0 ? h("section", { style: "margin-bottom:32px" },
        h("div", { class: "eyebrow", style: "margin-bottom:8px" }, "Worth doing next"),
        h("div", { class: "rows" },
          learning.value.nextActions.map((action) => h("div", { class: "suggestion" },
            h("div", { class: "suggestion__body" },
              h("div", { style: "font-weight:500" }, action.title),
              h("div", { class: "suggestion__why" }, action.because)),
            h("button", {
              class: "btn btn--sm",
              onclick: () => {
                update({ ai: { ...state.ai, open: true } });
                void ask(`Make me a short practice set on ${action.title.replace(/^(Fix the underlying idea in|Practise|Review)\s*/i, "")}, then mark my answers.`);
              },
            }, "Practise"))))) : null,

      h("div", { class: "eyebrow", style: "margin-bottom:8px" }, "Topics"),
      h("div", { class: "rows" },
        all.map((concept) => h("div", { class: "row", style: "cursor:default" },
          h("div", { class: "row__main" },
            h("div", { class: "row__title" }, concept.name),
            h("div", { style: "margin-top:6px" },
              h("div", { class: `meter${concept.reportable ? "" : " meter--unknown"}` },
                concept.reportable
                  ? h("div", {
                      class: "meter__fill",
                      "data-weak": concept.estimate < 0.6 ? "true" : "false",
                      style: `width:${percent(concept.estimate)}`,
                    })
                  : null)),
            h("div", { class: "row__meta", style: "margin-top:6px" },
              concept.reportable
                ? `${percent(concept.estimate)} across ${concept.attempts} attempts`
                : concept.attempts === 0
                  ? "Not practised yet"
                  : `Only ${concept.attempts} attempt${concept.attempts === 1 ? "" : "s"} — not enough to judge yet`)),
          h("button", {
            class: "btn btn--sm",
            onclick: () => {
              update({ ai: { ...state.ai, open: true } });
              void ask(`Test me on ${concept.name}. Ask one question at a time and tell me if I am right.`);
            },
          }, "Practise")))));
  })();

  return container;
}

/** §8: everything the system believes, inspectable and removable. */
function memoryView() {
  const container = h("div", { class: "pane__inner" },
    h("h1", {}, "What the AI remembers"),
    h("p", { class: "muted", style: "margin:8px 0 24px" },
      "Only things you have said, with the words they came from. Health, beliefs, politics and finances are never kept."),
    h("div", { id: "memory-body" }, h("div", { class: "skeleton skeleton--line" })),
  );

  const load = async () => {
    const result = await api("/api/memories");
    const body = $("#memory-body", container);
    if (!body) return;

    if (!result.ok) {
      mount(body, h("div", { class: "state--error" },
        h("div", { class: "state__title" }, "Could not load memory"),
        h("div", {}, result.failure.message)));
      return;
    }

    const { enabled, memories } = result.value;
    mount(body,
      h("div", { class: "row", style: "cursor:default;margin-bottom:24px" },
        h("div", { class: "row__main" },
          h("div", { class: "row__title" }, enabled ? "Memory is on" : "Memory is off"),
          h("div", { class: "row__meta" },
            enabled
              ? "The AI can carry useful context between conversations."
              : "Nothing is being remembered, and what was stored has been deleted.")),
        h("button", {
          class: "btn btn--sm",
          onclick: async () => {
            if (enabled && !confirm("Turning memory off also deletes everything stored. Continue?")) return;
            const res = await api("/api/memory-settings", {
              method: "POST", body: JSON.stringify({ enabled: !enabled }),
            });
            if (!res.ok) return notice(res.failure.message, "error");
            void load();
          },
        }, enabled ? "Turn off" : "Turn on")),

      memories.length === 0
        ? h("div", { class: "state" },
            h("div", { class: "state__title" }, "Nothing remembered yet"),
            h("div", { class: "state__body" },
              enabled
                ? "As you work, useful context like your goals and where you get stuck will appear here — and you can delete any of it."
                : "Memory is off."))
        : h("div", { class: "rows" },
            memories.map((memory) => h("div", { class: "row", style: "cursor:default;align-items:flex-start" },
              h("div", { class: "row__main" },
                h("div", {
                  class: "row__title", style: "white-space:normal",
                  contenteditable: "true", role: "textbox", "aria-label": "Edit memory",
                  onblur: async (e) => {
                    const text = e.target.textContent.trim();
                    if (!text || text === memory.text) { e.target.textContent = memory.text; return; }
                    const res = await api(`/api/memories/${memory.id}`, {
                      method: "PATCH", body: JSON.stringify({ text }),
                    });
                    if (!res.ok) {
                      notice(res.failure.message, "error");
                      e.target.textContent = memory.text;
                    } else {
                      void load();
                    }
                  },
                }, memory.text),
                h("div", { class: "row__meta", style: "margin-top:4px;white-space:normal" },
                  memory.provenance.quote ? `From: “${memory.provenance.quote}”` : "Added directly",
                  memory.useCount > 0 ? ` · used ${memory.useCount}×` : " · not used yet")),
              h("button", {
                class: "btn btn--sm btn--danger", "aria-label": `Delete memory: ${memory.text}`,
                onclick: async () => {
                  const res = await api(`/api/memories/${memory.id}`, { method: "DELETE" });
                  if (!res.ok) return notice(res.failure.message, "error");
                  void load();
                },
              }, "Delete")))));
  };
  void load();
  return container;
}

/** Artifacts are edited in place, not regenerated (§16). */
function artifactView() {
  if (state.docLoading) {
    return h("div", { class: "pane__inner" },
      ...Array.from({ length: 6 }, () => h("div", { class: "skeleton skeleton--line" })));
  }
  if (state.docFailure || !state.openArtifact) {
    return h("div", { class: "pane__inner" },
      h("div", { class: "state--error" },
        h("div", { class: "state__title" }, "Could not open that"),
        h("div", {}, state.docFailure?.message ?? "It no longer exists."),
        h("button", { class: "btn btn--sm", style: "margin-top:12px", onclick: () => update({ view: "home" }) }, "Back")));
  }

  const artifact = state.openArtifact;

  const patch = async (patches) => {
    const result = await api(`/api/artifacts/${artifact.id}`, {
      method: "PATCH", body: JSON.stringify({ patches }),
    });
    if (!result.ok) {
      notice(result.failure.message, "error");
      return false;
    }
    update({ openArtifact: result.value.artifact });
    void refreshLists();
    return true;
  };

  return h("div", { class: "pane__inner" },
    h("div", { style: "display:flex;align-items:center;gap:8px;margin-bottom:8px" },
      h("button", { class: "btn btn--quiet btn--sm", "aria-label": "Back", onclick: () => update({ view: "home" }) }, icon("back", 16)),
      h("h1", {
        style: "flex:1;font-size:1.375rem", contenteditable: "true",
        role: "textbox", "aria-label": "Artifact title",
        onblur: (e) => {
          const title = e.target.textContent.trim();
          if (title && title !== artifact.title) void patch([{ op: "setTitle", title }]);
        },
      }, artifact.title)),
    h("div", { class: "row__meta", style: "margin-bottom:24px" },
      `${artifact.kind} · version ${artifact.version} · edits save as you go`),

    h("div", {},
      artifact.blocks.map((block, index) => {
        if (block.kind === "quizQuestion") return quizBlock(artifact, block, patch);
        if (block.kind === "flashcard") {
          return h("div", { class: "artifact__block" },
            h("div", { style: "font-weight:500" }, block.text),
            h("div", { class: "artifact__answer" }, block.answer ?? ""));
        }
        return h("div", {
          class: "artifact__block",
          contenteditable: "true", role: "textbox",
          "aria-label": `Section ${index + 1}`,
          style: block.kind === "heading" ? "font-weight:600;font-size:1.125rem;margin-top:16px" : "",
          onblur: (e) => {
            const text = e.target.textContent.trim();
            if (text && text !== block.text) void patch([{ op: "replaceBlock", blockId: block.id, text }]);
          },
        }, block.text);
      })),

    h("div", { style: "margin-top:32px;display:flex;gap:8px" },
      h("button", {
        class: "btn btn--sm",
        onclick: () => {
          update({ ai: { ...state.ai, open: true } });
          void ask(`Improve the artifact "${artifact.title}" — tighten anything vague.`);
        },
      }, "Ask the AI to improve this")),
  );
}

/** A quiz question that actually grades and records the attempt (§10). */
function quizBlock(artifact, block, patch) {
  const options = block.options?.length ? block.options : null;
  const wrap = h("div", { class: "artifact__block" },
    h("div", { style: "font-weight:500" }, block.text));

  if (options) {
    const buttons = options.map((option) => h("button", {
      class: "quiz__option",
      onclick: async () => {
        const correct = block.answer !== undefined &&
          option.trim().toLowerCase() === String(block.answer).trim().toLowerCase();
        for (const b of buttons) b.disabled = true;
        for (const b of buttons) {
          if (b.textContent === String(block.answer)) b.dataset.verdict = "correct";
        }
        if (!correct) {
          const chosen = buttons.find((b) => b.textContent === option);
          if (chosen) chosen.dataset.verdict = "wrong";
        }
        if (block.conceptId) {
          await recordAttempt(block.conceptId, {
            prompt: block.text, response: option, correct, difficulty: 0.5,
          });
        }
      },
    }, option));
    wrap.append(h("div", { class: "quiz__options" }, buttons));
  } else if (block.answer !== undefined) {
    const reveal = h("button", {
      class: "btn btn--sm", style: "margin-top:8px",
      onclick: () => {
        reveal.replaceWith(
          h("div", {},
            h("div", { class: "artifact__answer" }, block.answer),
            block.conceptId ? h("div", { style: "display:flex;gap:8px;margin-top:8px" },
              h("button", {
                class: "btn btn--sm",
                onclick: () => recordAttempt(block.conceptId, {
                  prompt: block.text, response: "self-marked", correct: true, difficulty: 0.5,
                }),
              }, "I got it"),
              h("button", {
                class: "btn btn--sm",
                onclick: () => recordAttempt(block.conceptId, {
                  prompt: block.text, response: "self-marked", correct: false, difficulty: 0.5,
                }),
              }, "I didn't")) : null));
      },
    }, "Show answer");
    wrap.append(reveal);
  }
  return wrap;
}

// ── AI panel ───────────────────────────────────────────────────────────────

function aiPanel() {
  const { ai } = state;

  const body = h("div", { class: "panel__body" },
    ai.messages.length === 0 && !ai.streaming
      ? h("div", { class: "state" },
          h("div", { class: "state__title" }, "Ask about anything here"),
          h("div", { class: "state__body tiny" },
            state.openDocument
              ? `Whatever you ask, ${state.openDocument.document.title} is already in view — select a passage first to ask about just that part.`
              : "Add a document and answers will cite exactly where they came from."))
      : null,

    h("div", { class: "thread" },
      ai.messages.map(messageView),
      ai.streaming || ai.streamText ? streamingView() : null,
      ai.failure ? h("div", { class: "state--error" },
        h("div", { class: "state__title" }, "That did not finish"),
        h("div", {}, ai.failure.message),
        ai.failure.retryable ? h("button", {
          class: "btn btn--sm", style: "margin-top:12px",
          onclick: () => {
            const lastUser = [...ai.messages].reverse().find((m) => m.role === "user");
            update({ ai: { ...state.ai, failure: null } });
            if (lastUser) void ask(lastUser.text);
          },
        }, "Try again") : null) : null),
  );

  requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });

  return h("aside", { class: "panel", "aria-label": "AI" },
    h("div", { class: "panel__head" },
      h("span", { class: "chip chip--ai" }, "AI"),
      h("div", { class: "panel__title" }, ai.title || "New conversation"),
      ai.streaming ? h("button", {
        class: "btn btn--quiet btn--sm",
        onclick: () => { ai.abort?.abort(); update({ ai: { ...state.ai, streaming: false, abort: null } }); },
      }, "Stop") : h("button", {
        class: "btn btn--quiet btn--sm",
        onclick: () => update({ ai: { ...state.ai, conversationId: null, messages: [], title: "", failure: null } }),
      }, "New"),
      h("button", {
        class: "rail__btn", "aria-label": "Close the AI panel",
        onclick: () => update({ ai: { ...state.ai, open: false } }),
      }, icon("close", 18))),
    body,
    h("div", { class: "panel__foot" },
      state.selection ? h("div", { class: "chip", style: "margin-bottom:8px;max-width:100%" },
        `About: “${state.selection.text.slice(0, 60)}${state.selection.text.length > 60 ? "…" : ""}”`,
        h("button", {
          class: "btn btn--quiet btn--sm", "aria-label": "Clear selection",
          onclick: () => update({ selection: null }),
        }, "×")) : null,
      askBox({
        placeholder: state.selection ? "Ask about the selection" : "Ask anything",
        focusKey: "ask-panel",
      })));
}

function messageView(message) {
  if (message.role === "user") {
    return h("div", { class: "turn turn--user" },
      h("div", { class: "turn__body" }, message.text));
  }

  return h("div", { class: "turn turn--ai" },
    h("div", { class: "turn__role" },
      h("span", { class: "turn__dot" }),
      h("span", { class: "tiny muted" }, "AI")),

    message.toolCalls?.map(toolView),

    message.text ? h("div", { class: "turn__body" }, prose(message.text)) : null,

    message.failure ? h("div", { class: "state--error", style: "margin-top:12px" },
      h("div", {}, message.failure.message)) : null,

    message.citations?.length ? h("div", { class: "citations" },
      message.citations.map((citation) => h("button", {
        class: "citation",
        title: citation.text.slice(0, 200),
        onclick: () => openDocument(citation.documentId, { scrollToBlock: citation.blockId }),
      },
        citation.documentTitle,
        citation.pageNumber !== null
          ? h("span", { class: "citation__page" }, `p${citation.pageNumber}`)
          : null))) : null,

    message.contextTrace ? traceView(message.contextTrace) : null);
}

function toolView(record) {
  const failed = Boolean(record.failure);
  const summary = failed
    ? `${record.toolName} failed — ${record.failure.message}`
    : record.toolName === "calculate"
      ? `calculate  ${record.input?.expression} = ${record.output?.value}`
      : record.toolName === "search_knowledge"
        ? `searched your material for “${record.input?.query}” — ${record.output?.results?.length ?? 0} passages`
        : `${record.toolName} · ${record.elapsedMs}ms`;
  return h("div", { class: `toolcall${failed ? " toolcall--failed" : ""}` }, summary);
}

/** §22: proactivity and context use must be explainable, not spooky. */
function traceView(trace) {
  const byKind = new Map();
  for (const item of trace.included) {
    byKind.set(item.kind, (byKind.get(item.kind) ?? 0) + 1);
  }
  const label = {
    selection: "what you selected", openDocument: "the open document",
    retrievedBlock: "passages found", conversationTurn: "earlier in this chat",
    memory: "what I remember", concept: "your learning history",
    artifact: "artifacts", projectIntent: "the project",
  };
  return h("details", { class: "why" },
    h("summary", {}, "Why this answer"),
    h("div", { class: "why__grid" },
      [...byKind].map(([kind, count]) => h("div", { class: "why__row" },
        h("span", {}, label[kind] ?? kind), h("span", {}, String(count)))),
      h("div", { class: "why__row", style: "margin-top:8px;opacity:.75" },
        h("span", {}, "context used"),
        h("span", {}, `${trace.used} of ${trace.budget} tokens`)),
      trace.dropped.length ? h("div", { class: "why__row", style: "opacity:.75" },
        h("span", {}, "left out for space"), h("span", {}, String(trace.dropped.length))) : null));
}

function streamingView() {
  const { ai } = state;
  return h("div", { class: "turn turn--ai" },
    h("div", { class: "turn__role" },
      h("span", { class: "turn__dot" }),
      h("span", { class: "tiny muted" }, ai.streamText ? "AI" : "Reading your material…")),
    ai.streamTools.map(toolView),
    h("div", { class: "turn__body" },
      prose(ai.streamText),
      ai.streaming ? h("span", { class: "cursor" }) : null));
}

// ── search palette (§39) ───────────────────────────────────────────────────

function openSearch() {
  update({ search: { open: true, query: "", results: [], loading: false, active: 0 } });
}

function searchPalette() {
  if (!state.search.open) return null;

  const input = h("input", {
    class: "palette__input", placeholder: "Search everything you have…",
    "aria-label": "Search", value: state.search.query,
    "data-focus-key": "search",
    oninput: (e) => { void runSearch(e.target.value); },
    onkeydown: (e) => {
      const { results, active } = state.search;
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter" && results[active]) { e.preventDefault(); choose(results[active]); }
    },
  });

  const move = (delta) => {
    const { results, active } = state.search;
    if (results.length === 0) return;
    state.search.active = (active + delta + results.length) % results.length;
    render();
  };

  const choose = (result) => {
    update({ search: { ...state.search, open: false } });
    if (result.kind === "block") openDocument(result.documentId, { scrollToBlock: result.blockId });
    else if (result.kind === "conversation") openConversation(result.id);
    else if (result.kind === "artifact") openArtifact(result.id);
  };

  const results = state.search.loading
    ? h("div", { class: "palette__results" },
        ...Array.from({ length: 3 }, () => h("div", { class: "skeleton skeleton--line", style: "margin:8px" })))
    : state.search.query && state.search.results.length === 0
      ? h("div", { class: "palette__results" },
          h("div", { class: "state", style: "padding:32px 16px" },
            h("div", { class: "state__title" }, "Nothing matched"),
            h("div", { class: "tiny" }, "Try a different word, or a phrase from the material.")))
      : h("div", { class: "palette__results" },
          state.search.results.map((result, index) => h("button", {
            class: "palette__item",
            // Written as a string: `h` drops false attributes and renders true
            // as "", neither of which matches the [data-active="true"] rule.
            "data-active": index === state.search.active ? "true" : "false",
            onmouseenter: () => { update({ search: { ...state.search, active: index } }); },
            onclick: () => choose(result),
          },
            h("div", { style: "display:flex;gap:8px;align-items:baseline" },
              h("span", { class: "tiny muted", style: "min-width:5.5rem" },
                result.kind === "block" ? result.documentTitle
                  : result.kind === "conversation" ? "conversation" : result.artifactKind),
              h("span", { class: "palette__snippet", style: "color:var(--text)" },
                result.kind === "block" ? result.text : result.title)),
            result.kind === "block" && result.pageNumber !== null
              ? h("div", { class: "tiny muted" }, `page ${result.pageNumber}`) : null)));

  const scrim = h("div", {
    class: "scrim", role: "dialog", "aria-modal": "true", "aria-label": "Search",
    onclick: (e) => { if (e.target === scrim) update({ search: { ...state.search, open: false } }); },
  }, h("div", { class: "palette" }, input, results));

  // Focus only on the render that opens it; later renders restore focus via
  // preserveFocus, and re-focusing here would reset the caret each keystroke.
  if (document.activeElement?.getAttribute?.("data-focus-key") !== "search") {
    requestAnimationFrame(() => input.focus());
  }
  return scrim;
}

let searchToken = 0;
async function runSearch(query) {
  state.search.query = query;
  const token = ++searchToken;
  if (!query.trim()) {
    update({ search: { ...state.search, results: [], loading: false, active: 0 } });
    return;
  }
  state.search.loading = true;
  render();
  const result = await api(`/api/search?q=${encodeURIComponent(query)}`);
  // Ignore a response that a newer keystroke has already superseded.
  if (token !== searchToken) return;
  update({
    search: {
      ...state.search,
      loading: false,
      results: result.ok ? result.value.results : [],
      active: 0,
    },
  });
}

// ── selection → contextual actions (§13) ───────────────────────────────────

let selectionBar = null;

function clearSelectionBar() {
  selectionBar?.remove();
  selectionBar = null;
}

function handleSelection() {
  clearSelectionBar();
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const text = selection.toString().trim();
  if (text.length < 3) return;

  const anchor = selection.anchorNode;
  const blockEl = (anchor?.nodeType === 1 ? anchor : anchor?.parentElement)?.closest?.("[data-block]");
  if (!blockEl || !state.openDocument) return;

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  const blockId = blockEl.dataset.block;
  const block = state.openDocument.blocks.find((b) => b.id === blockId);
  if (!block) return;

  // Offsets into the document, derived from the block's known range so the
  // selection the AI receives is a real, resolvable span.
  const indexInBlock = block.text.indexOf(text);
  const startOffset = block.startOffset + (indexInBlock >= 0 ? indexInBlock : 0);
  const payload = {
    documentId: state.openDocument.document.id,
    blockId,
    text,
    startOffset,
    endOffset: startOffset + text.length,
  };

  const act = (label, prompt) => h("button", {
    class: "selbar__btn",
    onclick: () => {
      clearSelectionBar();
      window.getSelection()?.removeAllRanges();
      update({ selection: payload, ai: { ...state.ai, open: true } });
      void ask(prompt, { selection: payload });
    },
  }, label);

  selectionBar = h("div", { class: "selbar", role: "toolbar", "aria-label": "Actions for the selection" },
    act("Explain", "Explain this."),
    act("Simplify", "Say this more simply."),
    act("Why?", "Why is this true? Show the reasoning."),
    act("Practise", "Make me two questions on this, then mark my answers."),
    h("button", {
      class: "selbar__btn",
      onclick: () => {
        clearSelectionBar();
        update({ selection: payload, ai: { ...state.ai, open: true } });
      },
    }, "Ask…"));

  document.body.append(selectionBar);
  const barRect = selectionBar.getBoundingClientRect();
  const left = Math.min(
    Math.max(8, rect.left + rect.width / 2 - barRect.width / 2),
    window.innerWidth - barRect.width - 8,
  );
  const top = rect.top - barRect.height - 8;
  selectionBar.style.left = `${left}px`;
  selectionBar.style.top = `${top < 8 ? rect.bottom + 8 : top}px`;
}

// ── theme ──────────────────────────────────────────────────────────────────

function cycleTheme() {
  const current = localStorage.getItem("theme") ?? "system";
  const next = current === "system" ? "light" : current === "light" ? "dark" : "system";
  applyTheme(next);
  notice(`Theme: ${next}`);
}

function applyTheme(theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch { /* private browsing; the choice simply will not persist */ }
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = theme;
}

// ── shell ──────────────────────────────────────────────────────────────────

function paneContent() {
  switch (state.view) {
    case "doc": return documentView();
    case "learn": return learnView();
    case "memory": return memoryView();
    case "artifact": return artifactView();
    default: return homeView();
  }
}

/**
 * Re-rendering replaces the DOM, which throws away focus and caret position.
 * That is not cosmetic: the search palette loses focus after one keystroke,
 * and because each streamed chunk triggers a render, it also makes the input
 * unusable while the AI is answering — exactly when someone wants to type the
 * next question.
 *
 * Elements that must survive a render carry `data-focus-key`; their focus,
 * caret and scroll position are captured before the swap and restored after.
 */
function preserveFocus(swap) {
  const active = document.activeElement;
  const key = active?.getAttribute?.("data-focus-key");
  const start = active?.selectionStart ?? null;
  const end = active?.selectionEnd ?? null;
  const value = typeof active?.value === "string" ? active.value : null;

  swap();

  if (!key) return;
  const next = document.querySelector(`[data-focus-key="${key}"]`);
  if (!next || next === active) return;

  // These inputs are uncontrolled and rebuilt empty, so anything typed between
  // the last render and this one would otherwise be dropped — which is exactly
  // the window after pressing Enter, while the turn is starting.
  if (value && next.value === "") next.value = value;

  next.focus({ preventScroll: true });
  if (start !== null && typeof next.setSelectionRange === "function") {
    try {
      next.setSelectionRange(start, end ?? start);
    } catch { /* not a text input; focus alone is enough */ }
  }
}

function renderApp() {
  const root = $("#root");

  if (!state.ready) {
    return mount(root, h("div", { class: "pane__inner" },
      h("div", { class: "skeleton skeleton--line", style: "width:35%;height:2rem;margin-bottom:24px" }),
      ...Array.from({ length: 5 }, () => h("div", { class: "skeleton skeleton--line" }))));
  }

  if (state.loadFailure) {
    mount(root, h("div", { class: "pane__inner" },
      h("div", { class: "state--error" },
        h("div", { class: "state__title" }, "Could not reach the server"),
        h("div", {}, state.loadFailure.message),
        h("button", {
          class: "btn btn--sm", style: "margin-top:12px",
          onclick: () => { update({ ready: false }); void loadState(); },
        }, "Try again"))));
    return;
  }

  preserveFocus(() => mount(root,
    h("div", { class: "app" },
      railView(),
      h("div", { class: "main", "data-ai": state.ai.open ? "open" : "closed" },
        h("div", { class: "pane" }, paneContent()),
        state.ai.open ? aiPanel() : null)),
    // Outside the panes so a confirmation survives the navigation that follows
    // it — importing jumps straight to the reader — and so its arrival and
    // departure never reflow the content underneath.
    noticeBanner(),
    searchPalette()));
}

// ── boot ───────────────────────────────────────────────────────────────────

applyTheme(localStorage.getItem("theme") ?? "system");
subscribe(renderApp);
renderApp();
void loadState();

document.addEventListener("selectionchange", () => {
  // Debounced to the end of the gesture; firing per-tick fights the selection.
  clearTimeout(handleSelection.timer);
  handleSelection.timer = setTimeout(handleSelection, 180);
});

document.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey;
  if (meta && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openSearch();
  } else if (meta && e.key.toLowerCase() === "j") {
    e.preventDefault();
    update({ ai: { ...state.ai, open: !state.ai.open } });
  } else if (e.key === "Escape") {
    if (state.search.open) update({ search: { ...state.search, open: false } });
    else if (selectionBar) clearSelectionBar();
    else if (state.ai.open) update({ ai: { ...state.ai, open: false } });
  }
});

// Drop a file anywhere in the window, not only on the input.
for (const type of ["dragover", "drop"]) {
  window.addEventListener(type, (e) => {
    if (![...(e.dataTransfer?.types ?? [])].includes("Files")) return;
    e.preventDefault();
    if (type === "drop") void importFiles(e.dataTransfer.files);
  });
}
