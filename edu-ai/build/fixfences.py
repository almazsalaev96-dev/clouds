#!/usr/bin/env python3
"""Repair unclosed markdown code fences in draft/*.md.
An open fence interrupted by a heading line is an authoring bug: either the block was never
closed (insert the closer) or the opener is stray with no body (drop the opener)."""
import os, re, sys
WS = os.path.dirname(os.path.abspath(__file__))
FILES = ['00-01-02.md','03-08.md','04-07.md','05-06.md','09-10.md','11-12.md','13-14-15.md']
OPEN = re.compile(r'^```+\s*([A-Za-z0-9_+-]*)\s*$')
HEAD = re.compile(r'^#{1,4}\s+\S')
total = 0
for name in FILES:
    p = os.path.join(WS, 'draft', name)
    lines = open(p, encoding='utf-8').read().split('\n')
    out, i, n, fixes = [], 0, len(lines), []
    while i < n:
        line = lines[i]
        if OPEN.match(line):
            body, j = [], i + 1
            while j < n and not OPEN.match(lines[j]) and not HEAD.match(lines[j]):
                body.append(lines[j]); j += 1
            if j < n and OPEN.match(lines[j]) and lines[j].strip() == '```':
                out.extend([line] + body + [lines[j]]); i = j + 1; continue      # well-formed
            # interrupted by a heading or by another opener → repair
            while body and not body[-1].strip(): body.pop()
            if not body:
                fixes.append('line %d: dropped stray empty `%s` opener' % (i + 1, line.strip()))
                out.append('')
            else:
                fixes.append('line %d: closed unterminated `%s` block (%d lines)'
                             % (i + 1, line.strip(), len(body)))
                out.extend([line] + body + ['```', ''])
            i = i + 1 + len(body)
            while i < n and not lines[i].strip(): i += 1
            continue
        out.append(line); i += 1
    if fixes:
        open(p, 'w', encoding='utf-8').write('\n'.join(out))
        print('%s:' % name)
        for f in fixes: print('   ', f)
        total += len(fixes)
print('repairs:', total)
