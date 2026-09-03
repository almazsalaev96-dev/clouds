/**
 * Client state.
 *
 * One object, one render pass, explicit subscriptions. The views below are
 * pure functions of this state, which keeps "what is on screen" answerable by
 * reading one place.
 */

import { api } from "./lib.js";

export const state = {
  ready: false,
  loadFailure: null,

  user: null,
  workspaceId: null,
  model: { available: false, failure: null },
  storage: { durable: true, note: null },

  documents: [],
  conversations: [],
  artifacts: [],
  nextActions: [],

  /** Which area is showing: home | doc | learn | memory | artifact */
  view: "home",
  openDocument: null,      // { document, text, blocks }
  openArtifact: null,
  docFailure: null,
  docLoading: false,

  /** The AI panel. */
  ai: {
    open: false,
    conversationId: null,
    title: "",
    messages: [],
    streaming: false,
    streamText: "",
    streamCitations: [],
    streamTools: [],
    trace: null,
    failure: null,
    abort: null,
  },

  /** What the user has selected in the reader, if anything (§11). */
  selection: null,

  /** Transient banner, e.g. a rejected file. */
  notice: null,

  search: { open: false, query: "", results: [], loading: false, active: 0 },
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function render() {
  for (const fn of listeners) fn();
}

/** Mutates state then re-renders. Keeps every mutation traceable to one call. */
export function update(patch) {
  Object.assign(state, typeof patch === "function" ? patch(state) : patch);
  render();
}

export function notice(message, tone = "info") {
  state.notice = { message, tone };
  render();
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => {
    state.notice = null;
    render();
  }, 6000);
}

export async function loadState() {
  const result = await api("/api/state");
  if (!result.ok) {
    update({ ready: true, loadFailure: result.failure });
    return;
  }
  const { user, workspaceId, documents, conversations, artifacts, nextActions, model, storage } = result.value;
  update({
    ready: true, loadFailure: null,
    user, workspaceId, documents, conversations, artifacts, nextActions, model,
    storage: storage ?? { durable: true, note: null },
  });
}

export async function refreshLists() {
  const result = await api("/api/state");
  if (!result.ok) return;
  const { documents, conversations, artifacts, nextActions, model, storage } = result.value;
  update({ documents, conversations, artifacts, nextActions, model, storage: storage ?? state.storage });
}
