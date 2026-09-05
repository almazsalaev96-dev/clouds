#!/usr/bin/env python3
"""Bundle the site into one self-contained HTML file.

    python3 build-single-file.py [outfile]

The CSS and every script are inlined, so the result runs from a file:// path,
a USB stick, or any static host with nothing else beside it. Only the Google
Fonts stylesheet stays remote; without a connection the fallback stack is used.

Pass --body to emit just the page body (title, font link, style, markup,
script) with no <!doctype>/<html>/<head>/<body> wrapper — the shape a host
that supplies its own document skeleton expects.
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))

SCRIPTS = [
    'assets/data/syllabus.js', 'assets/data/exam.js', 'assets/data/paper2.js',
    'assets/data/ch-s1.js', 'assets/data/ch-s2.js', 'assets/data/ch-s3.js',
    'assets/data/ch-s4.js', 'assets/data/ch-s5.js', 'assets/data/ch-s6.js',
    'assets/js/store.js', 'assets/js/render.js', 'assets/js/tools.js',
    'assets/js/study.js', 'assets/js/ai.js', 'assets/js/app.js',
]


def read(rel):
    with io.open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def build():
    html = read('index.html')
    css = read('assets/css/app.css')
    bundle = '\n;\n'.join(read(f) for f in SCRIPTS)

    html = re.sub(r'<link[^>]*app\.css[^>]*>', lambda m: '<style>\n' + css + '\n</style>', html)

    tags = re.findall(r'<script[^>]*src=[^>]*></script>', html)
    if not tags:
        raise SystemExit('index.html has no script tags to replace')
    html = html.replace(tags[0], '\x00BUNDLE\x00', 1)
    for t in tags[1:]:
        html = html.replace(t, '')
    html = html.replace('\x00BUNDLE\x00', '<script>\n' + bundle + '\n</script>')
    return re.sub(r'\n{3,}', '\n\n', html)


def body_only(doc):
    head = re.search(r'<head>(.*?)</head>', doc, re.S).group(1)
    body = re.search(r'<body>(.*?)</body>', doc, re.S).group(1)
    title = re.search(r'<title>.*?</title>', head, re.S).group(0)
    fonts = re.findall(r'<link[^>]*fonts\.(?:googleapis|gstatic)[^>]*>', head)
    style = re.search(r'<style>.*?</style>', head, re.S).group(0)
    return '\n'.join([title] + fonts + [style, body.strip()]) + '\n'


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--body']
    out = args[0] if args else 'business-studies-0450.html'
    doc = build()
    if '--body' in sys.argv[1:]:
        doc = body_only(doc)
    with io.open(out, 'w', encoding='utf-8') as f:
        f.write(doc)
    print('%s  %.0f KB' % (out, len(doc.encode('utf-8')) / 1024))
