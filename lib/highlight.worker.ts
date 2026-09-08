/// <reference lib="webworker" />
import { createHighlighter, type Highlighter } from "shiki";

/**
 * Highlighting runs here so a large file never competes with the frame budget
 * of the stream that produced it. The worker owns one highlighter and loads
 * each grammar the first time it sees it.
 */
let highlighterPromise: Promise<Highlighter> | null = null;
const loaded = new Set<string>();

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({ themes: ["github-light"], langs: [] });
  }
  return highlighterPromise;
}

self.onmessage = async (event: MessageEvent<{ id: number; code: string; lang: string }>) => {
  const { id, code, lang } = event.data;
  try {
    const hl = await getHighlighter();
    if (!loaded.has(lang)) {
      await hl.loadLanguage(lang as never);
      loaded.add(lang);
    }
    const html = hl.codeToHtml(code, { lang, theme: "github-light" });
    (self as unknown as Worker).postMessage({ id, html });
  } catch {
    // A grammar we cannot load is not an error worth surfacing: the block
    // simply stays plain monospace.
    (self as unknown as Worker).postMessage({ id, html: null });
  }
};
