import type { ModelSpec } from "../types";
import type { WebTool } from "../types";

/**
 * The web, as a tool the model may reach for.
 *
 * These are server tools: the provider runs the search on its own machines
 * and hands the model the results inside the same response, so nothing here
 * fetches anything. This app's part is to say which tools are on offer, in
 * the shape the model in question takes.
 *
 * Two shapes exist. The 4.6 generation onward takes the 2026 variants, which
 * filter results dynamically before the model reads them; everything older
 * takes the basic ones. The line between them is the same line that decides
 * how a model is asked to think — `thinks: "effort"` — so that is what is
 * read, rather than a second list of model names to keep in step.
 */
export function webTools(model: ModelSpec, wanted: WebTool[], opts: { hasUrl: boolean }): Record<string, unknown>[] {
  if (!canSearch(model) || !wanted.length) return [];
  const modern = model.thinks === "effort";
  const out: Record<string, unknown>[] = [];
  if (wanted.includes("web_search")) {
    out.push({ type: modern ? "web_search_20260209" : "web_search_20250305", name: "web_search", max_uses: 5 });
  }
  /* Fetch only when there is something to fetch: the tool reads URLs already
     in the conversation and nothing else, so offering it to a question with
     no URL in it is a tool that cannot be used, and a model told it may fetch
     will sometimes try. */
  if (wanted.includes("web_fetch") && opts.hasUrl) {
    out.push({ type: modern ? "web_fetch_20260209" : "web_fetch_20250910", name: "web_fetch", max_uses: 3, citations: { enabled: true } });
  }
  return out;
}

/** Only one company here runs a search for the model. */
export function canSearch(model: Pick<ModelSpec, "provider">): boolean {
  return model.provider === "anthropic";
}

export const URL_RE = /https?:\/\/[^\s)>\]]+/i;
