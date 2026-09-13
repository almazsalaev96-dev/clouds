/**
 * An answer that is a thing rather than an answer about one.
 *
 * Asked for a timer, the model is told to reply with one complete HTML
 * document in a fence, because this app can run it — an answer that *is* the
 * thing beats an answer describing it, and the reader can tell within a
 * second which one they got. Then the document arrived as a nine-hundred-line
 * code block in the transcript, and the person who asked for a timer got a
 * wall of markup and a conversation they could no longer scroll.
 *
 * So: recognise a built thing, lift it out, and run it. Three shapes count,
 * because models do not all follow the one instruction the same way:
 *
 *  1. A complete document in one html fence — the shape they are asked for.
 *  2. An html fence that is a page in all but its wrapper: a fragment with
 *     its own <style> or <script>, long enough to be a thing rather than an
 *     example. It is wrapped into a document.
 *  3. A document split across fences — html, then css, then js — the way a
 *     model that has read a thousand tutorials likes to answer. They are
 *     folded into one.
 *
 * ## What stays in the transcript
 *
 * Someone asking "what does a meta tag look like" gets a fence with markup in
 * it and wants to read it, where they can point at a line and ask about it.
 * A short fragment with no style and no script is that, and is left alone.
 */
const FENCE = /```(?:html|HTML)[^\n]*\n([\s\S]*?)```/g;
const CSS = /```(?:css|CSS)[^\n]*\n([\s\S]*?)```/g;
const JS = /```(?:js|javascript|JS|JavaScript)[^\n]*\n([\s\S]*?)```/g;

/** A whole page, not a piece of one. */
const WHOLE = /^\s*(<!doctype\s+html|<html[\s>])/i;

/** A fragment that carries its own behaviour or look is a thing, not an example. */
const SELF_STYLED = /<style[\s>]|<script[\s>]/i;
const MIN_FRAGMENT_LINES = 12;

/* A global regex carries its own cursor, and `matchAll` copies it: one
   `exec` left unfinished and the next scan starts mid-string and finds
   nothing. So every use here starts at zero and leaves it there. */
const first = (re: RegExp, text: string): string | null => {
  re.lastIndex = 0;
  const m = re.exec(text);
  re.lastIndex = 0;
  return m ? m[1] : null;
};

export function builtDocument(markdown: string): string | null {
  let html: string | null = null;
  FENCE.lastIndex = 0;
  for (const m of markdown.matchAll(FENCE)) {
    const body = m[1] ?? "";
    if (WHOLE.test(body) && /<\/html\s*>/i.test(body)) {
      html = body.trim();
      break;
    }
    if (!html && SELF_STYLED.test(body) && body.split("\n").length >= MIN_FRAGMENT_LINES && /<\w+[\s>]/.test(body)) {
      html = wrap(body.trim());
    }
  }
  if (!html) {
    /* Markup with no style and no script, but a stylesheet and a script in
       fences of their own beside it: the tutorial shape. */
    const markup = first(FENCE, markdown);
    const css = first(CSS, markdown);
    const js = first(JS, markdown);
    if (markup && (css || js) && /<\w+[\s>]/.test(markup) && markup.split("\n").length >= 4) {
      html = wrap(markup.trim());
    }
  }
  if (!html) return null;
  return fold(html, markdown);
}

/** A fragment, made a document. */
function wrap(fragment: string): string {
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n${fragment}\n</body>\n</html>`;
}

/**
 * A stylesheet and a script in their own fences belong inside the document
 * — but only when the document has not already got them inline, and only
 * when it links to a file it does not have. A page that says
 * `<link rel="stylesheet" href="style.css">` and a css fence beside it is
 * one page; a page with its own <style> and a css fence of something else
 * is a page and an aside.
 */
function fold(html: string, markdown: string): string {
  const css = first(CSS, markdown);
  const js = first(JS, markdown);
  let out = html;
  if (css && (!/<style[\s>]/i.test(out) || /<link[^>]+rel=["']?stylesheet/i.test(out))) {
    out = out.replace(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi, "");
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `<style>\n${css.trim()}\n</style>\n</head>`) : out.replace(/<body[^>]*>/i, (t) => `${t}\n<style>\n${css.trim()}\n</style>`);
  }
  if (js && (!/<script[\s>][^>]*>[^<]*\S[^<]*<\/script>/i.test(out) || /<script[^>]+src=/i.test(out))) {
    out = out.replace(/<script[^>]+src=[^>]*>\s*<\/script>/gi, "");
    out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `<script>\n${js.trim()}\n</script>\n</body>`) : `${out}\n<script>\n${js.trim()}\n</script>`;
  }
  return out;
}

/**
 * The answer with the built thing taken out of it: what is left is the
 * sentence around the fence, which is what the transcript should show
 * beside a card for the thing itself.
 */
export function withoutBuild(markdown: string): string {
  if (!builtDocument(markdown)) return markdown;
  return markdown
    .replace(FENCE, "")
    .replace(CSS, "")
    .replace(JS, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * While an answer is still arriving: is it building something? True once an
 * html fence has opened and what is inside it so far reads as a page — a
 * doctype, a root element, or nothing yet to say otherwise. A fence that has
 * opened on a `<meta>` is an example and streams as code.
 */
export function building(partial: string): { title: string; lines: number; before: string } | null {
  const open = /```(?:html|HTML)[^\n]*\n/g;
  let m: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((m = open.exec(partial))) last = m;
  if (!last) return null;
  const after = partial.slice(last.index + last[0].length);
  if (/```/.test(after)) {
    // The fence has closed: whoever asked can decide with the whole answer.
    return builtDocument(partial) ? { title: titleOf(builtDocument(partial) ?? ""), lines: after.split("\n").length, before: partial.slice(0, last.index) } : null;
  }
  const head = after.trimStart();
  if (head && !WHOLE.test(head) && !/^<(style|script|main|div|section|header|body)[\s>]/i.test(head)) return null;
  return { title: titleOf(after, "Something"), lines: after.split("\n").length, before: partial.slice(0, last.index) };
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
