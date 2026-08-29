/**
 * Turns a tutor reply into HTML: a small, deliberate subset of Markdown plus
 * KaTeX for the maths, and inline SVG for the occasional diagram. Math and
 * fenced blocks are pulled out before any escaping happens so that things
 * like \frac{a}{b}, x < y, and raw diagram JSON all survive intact.
 */

import { diagramSvg } from './diagram.js';

// A character that never appears in a reply, so placeholders can't collide.
const SENTINEL = '\u0000';

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function extractFences(src) {
  const found = [];
  const text = src.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, body) => {
    found.push({ lang: lang.trim().toLowerCase(), body: body.replace(/\n$/, '') });
    return `${SENTINEL}F${found.length - 1}${SENTINEL}`;
  });
  return { text, found };
}

function extractMath(src) {
  const found = [];
  const stash = (tex, display) => {
    found.push({ tex, display });
    return `${SENTINEL}M${found.length - 1}${SENTINEL}`;
  };

  let out = src
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => stash(tex, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => stash(tex, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => stash(tex, false));

  // Inline $…$: needs a non-space just inside each delimiter, which keeps
  // "costs $5 and $6" from being mistaken for maths.
  out = out.replace(/\$(?!\s)((?:[^$\n\\]|\\.)+?)(?<!\s)\$/g, (_, tex) => stash(tex, false));
  return { text: out, found };
}

function inline(md) {
  return md
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)!?]|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function markdown(src) {
  const lines = src.split('\n');
  const html = [];
  let list = null; // 'ul' | 'ol'
  let para = [];

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flushPara();
      flushList();
      html.push('<hr>');
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      html.push(`<h3>${inline(heading[2])}</h3>`);
      continue;
    }

    const ordered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (ordered || bullet) {
      flushPara();
      const want = ordered ? 'ol' : 'ul';
      if (list !== want) {
        flushList();
        html.push(`<${want}>`);
        list = want;
      }
      html.push(`<li>${inline(ordered ? ordered[2] : bullet[1])}</li>`);
      continue;
    }

    flushList();
    para.push(line.trim());
  }

  flushPara();
  flushList();
  return html.join('');
}

export function renderMarkdown(src) {
  const { text: withoutFences, found: fences } = extractFences(String(src || ''));
  const { text, found: mathItems } = extractMath(withoutFences);
  let html = markdown(escapeHtml(text));

  html = html.replace(new RegExp(`${SENTINEL}M(\\d+)${SENTINEL}`, 'g'), (_, i) => {
    const item = mathItems[Number(i)];
    if (!item) return '';
    if (window.katex) {
      try {
        return window.katex.renderToString(item.tex, {
          displayMode: item.display,
          throwOnError: false,
          strict: 'ignore',
          trust: false,
        });
      } catch {
        /* fall through to plain text */
      }
    }
    const tex = escapeHtml(item.tex);
    return item.display ? `<div class="katex-display"><code>${tex}</code></div>` : `<code>${tex}</code>`;
  });

  html = html.replace(new RegExp(`${SENTINEL}F(\\d+)${SENTINEL}`, 'g'), (_, i) => {
    const fence = fences[Number(i)];
    if (!fence) return '';
    if (fence.lang === 'diagram') {
      const svg = diagramSvg(fence.body);
      if (svg) return svg;
      // Malformed diagram JSON — show it as a code block rather than drop it silently.
    }
    return `<pre><code>${escapeHtml(fence.body)}</code></pre>`;
  });

  return html;
}
