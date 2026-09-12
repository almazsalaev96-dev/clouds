/**
 * An answer that is a thing rather than an answer about one.
 *
 * Asked for a timer, the model is told to reply with one complete HTML
 * document in a single fence, because this app can run it — an answer that
 * *is* the thing beats an answer describing it, and the reader can tell within
 * a second which one they got. Then the document arrived as a nine-hundred-line
 * code block in the transcript with a button on it, and the person who asked
 * for a timer got a wall of markup and a conversation they could no longer
 * scroll. `toCanvas` was written for exactly this and nothing ever called it.
 *
 * So: recognise the case, and only that case. A complete document is
 * unambiguous — `<!doctype html>` or a root `<html>` element, inside a fence
 * the model was explicitly asked to use. A snippet is not, an example inside
 * an explanation is not, and neither is an answer that mentions HTML.
 *
 * ## Why the whole document and not any html fence
 *
 * Someone asking "what does a meta tag look like" gets a fence with html in it
 * and wants to read it, in the transcript, where they can point at a line and
 * ask about it. Lifting that into a canvas would be the app deciding it knows
 * better. The line is the one the instructions already draw: a *document* is
 * something built to run, a fragment is something written to be read.
 */
const FENCE = /```(?:html|HTML)\s*\n([\s\S]*?)```/g;

/** A whole page, not a piece of one. */
const WHOLE = /^\s*(<!doctype\s+html|<html[\s>])/i;

export function builtDocument(markdown: string): string | null {
  for (const m of markdown.matchAll(FENCE)) {
    const body = m[1] ?? "";
    if (WHOLE.test(body) && /<\/html\s*>/i.test(body)) return body.trim();
  }
  return null;
}

/**
 * What to call it in the sidebar.
 *
 * The document's own <title> if it has one, because that is the name its
 * author gave it, and the first heading if not. Never the first line of
 * markup, which is a doctype.
 */
export function titleOf(doc: string, fallback = "Untitled"): string {
  const t = doc.match(/<title[^>]*>([^<]{1,80})<\/title>/i)?.[1]?.trim();
  if (t) return t;
  const h = doc.match(/<h1[^>]*>([^<]{1,80})<\/h1>/i)?.[1]?.trim();
  return h || fallback;
}
