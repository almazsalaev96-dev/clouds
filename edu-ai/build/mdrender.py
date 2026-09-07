#!/usr/bin/env python3
"""Minimal, deterministic Markdown -> HTML renderer for the Margin master prompt.
Supports: ATX headings, paragraphs, GFM tables, fenced code, bullet/numbered lists
(2 levels), blockquotes, hr, and inline code/bold/italic/links. Everything is escaped."""
import re, html

RID = re.compile(r'(?<![\w-])(\d\d-[A-Z]{2,5}-\d{3})(?![\w-])')

def esc(s):
    return html.escape(s, quote=False)

def inline(text, rid=True):
    # extract code spans first so their contents are never re-processed
    spans = []
    def stash(m):
        spans.append(m.group(1))
        return '\x00%d\x00' % (len(spans) - 1)
    text = re.sub(r'`([^`]+)`', stash, text)
    text = esc(text)
    text = re.sub(r'\[([^\]\n]+)\]\((https?://[^\s)]+)\)',
                  lambda m: '<a href="%s" rel="noopener noreferrer" target="_blank">%s</a>' % (html.escape(m.group(2)), m.group(1)), text)
    text = re.sub(r'\*\*([^*\n]+)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'(?<![\w*])\*([^*\n]+)\*(?![\w*])', r'<em>\1</em>', text)
    text = re.sub(r'(?<![\w_])_([^_\n]+)_(?![\w_])', r'<em>\1</em>', text)
    if rid:
        text = RID.sub(r'<span class="rid">\1</span>', text)
    for i, code in enumerate(spans):
        text = text.replace('\x00%d\x00' % i, '<code>%s</code>' % esc(code))
    return text

def split_row(line):
    line = line.strip()
    if line.startswith('|'): line = line[1:]
    if line.endswith('|'): line = line[:-1]
    out, cur, esc_next = [], '', False
    for ch in line:
        if esc_next:
            cur += ch; esc_next = False; continue
        if ch == '\\': esc_next = True; cur += ch; continue
        if ch == '|': out.append(cur); cur = ''
        else: cur += ch
    out.append(cur)
    return [c.strip() for c in out]

SEP = re.compile(r'^\s*\|?[\s:-]*-[\s|:-]*\|?\s*$')

def render(md, heading_hook=None):
    """heading_hook(level, text) -> (html_open_tag, close_tag) or None for default."""
    lines = md.split('\n')
    out, i, n = [], 0, len(lines)
    while i < n:
        line = lines[i]
        # fenced code
        m = re.match(r'^```+\s*([A-Za-z0-9_+-]*)\s*$', line)
        if m:
            lang = m.group(1); body = []; i += 1
            while i < n and not re.match(r'^```+\s*$', lines[i]):
                body.append(lines[i]); i += 1
            i += 1
            cls = ' class="lang-%s"' % lang if lang else ''
            out.append('<pre%s><code>%s</code></pre>' % (cls, esc('\n'.join(body))))
            continue
        # heading
        m = re.match(r'^(#{1,6})\s+(.*)$', line)
        if m:
            lvl, txt = len(m.group(1)), m.group(2).strip()
            hooked = heading_hook(lvl, txt) if heading_hook else None
            out.append(hooked if hooked is not None else '<h%d>%s</h%d>' % (lvl, inline(txt), lvl))
            i += 1
            continue
        # hr
        if re.match(r'^\s*(-{3,}|\*{3,}|_{3,})\s*$', line):
            out.append('<hr>'); i += 1; continue
        # table: a row followed by a separator row
        if line.lstrip().startswith('|') and i + 1 < n and SEP.match(lines[i+1]) and '|' in lines[i+1]:
            head = split_row(line); i += 2
            body = []
            while i < n and lines[i].lstrip().startswith('|'):
                body.append(split_row(lines[i])); i += 1
            cols = len(head)
            th = ''.join('<th>%s</th>' % inline(c) for c in head)
            rows = []
            for r in body:
                r = (r + [''] * cols)[:cols]
                rows.append('<tr>' + ''.join('<td>%s</td>' % inline(c) for c in r) + '</tr>')
            out.append('<div class="tbl"><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>'
                       % (th, ''.join(rows)))
            continue
        # blockquote
        if line.startswith('>'):
            body = []
            while i < n and lines[i].startswith('>'):
                body.append(lines[i][1:].lstrip()); i += 1
            out.append('<blockquote>%s</blockquote>' % render('\n'.join(body), heading_hook))
            continue
        # lists
        m = re.match(r'^(\s*)([-*+]|\d+\.)\s+(.*)$', line)
        if m:
            block = []
            while i < n:
                mm = re.match(r'^(\s*)([-*+]|\d+\.)\s+(.*)$', lines[i])
                if mm:
                    block.append((len(mm.group(1)), mm.group(2), mm.group(3))); i += 1
                elif lines[i].strip() and lines[i].startswith(('  ', '\t')) and block:
                    # continuation line of the previous item
                    d, mk, t = block[-1]; block[-1] = (d, mk, t + ' ' + lines[i].strip()); i += 1
                else:
                    break
            out.append(render_list(block))
            continue
        # blank
        if not line.strip():
            i += 1; continue
        # paragraph
        para = []
        while i < n and lines[i].strip() and not re.match(r'^(#{1,6}\s|```|>|\s*[-*+]\s|\s*\d+\.\s)', lines[i]) \
              and not (lines[i].lstrip().startswith('|') and i + 1 < n and SEP.match(lines[i+1])) \
              and not re.match(r'^\s*(-{3,}|\*{3,}|_{3,})\s*$', lines[i]):
            para.append(lines[i]); i += 1
        if para:
            txt = ' '.join(p.strip() for p in para)
            cls = ''
            if txt.startswith('*') and txt.endswith('*') and txt.count('*') == 2:
                cls = ' class="note"'
            out.append('<p%s>%s</p>' % (cls, inline(txt)))
        else:
            i += 1
    return '\n'.join(out)

def render_list(items):
    """items: list of (indent, marker, text). Two levels supported."""
    def kind(mk): return 'ol' if mk[0].isdigit() else 'ul'
    html_out, stack = [], []
    for indent, mk, text in items:
        lvl = 1 if indent >= 2 else 0
        while len(stack) > lvl + 1:
            html_out.append('</li></%s>' % stack.pop())
        if len(stack) == lvl + 1 and stack[lvl] != kind(mk):
            html_out.append('</li></%s>' % stack.pop())
        if len(stack) < lvl + 1:
            if html_out and html_out[-1].startswith('<li>'):
                pass
            k = kind(mk); stack.append(k); html_out.append('<%s>' % k)
        else:
            html_out.append('</li>')
        html_out.append('<li>%s' % inline(text))
    while stack:
        html_out.append('</li></%s>' % stack.pop())
    return ''.join(html_out)
