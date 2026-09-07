#!/usr/bin/env python3
"""Stitch draft/*.md into final/MASTER-PROMPT.md: sections ordered §00…§15, front matter, integrity checks."""
import os, re, datetime, collections
WS = os.path.dirname(os.path.abspath(__file__))
FILES = ['00-01-02.md','03-08.md','04-07.md','05-06.md','09-10.md','11-12.md','13-14-15.md']

sections = {}
for name in FILES:
    text = open(os.path.join(WS, 'draft', name), encoding='utf-8').read()
    cur, buf = None, []
    for line in text.split('\n'):
        m = re.match(r'^# §(\d\d)\b', line)
        if m:
            if cur: sections[cur] = '\n'.join(buf).strip() + '\n'
            cur, buf = m.group(1), [line]
        elif cur is not None:
            buf.append(line)
    if cur: sections[cur] = '\n'.join(buf).strip() + '\n'

order = sorted(sections)
body = '\n\n'.join(sections[k] for k in order)

words = len(body.split())
id_re = re.compile(r'\b\d\d-[A-Z]{2,5}-\d{3}\b')
ids = id_re.findall(body)
version = os.environ.get('MP_VERSION')

toc = []
for line in body.split('\n'):
    m1 = re.match(r'^# (§\d\d .*)$', line)
    m2 = re.match(r'^## (\d\d\.[0-9A-Z]+ .*)$', line)
    if m1: toc.append('- **%s**' % m1.group(1))
    elif m2: toc.append('  - %s' % m2.group(1))

front = """# MARGIN — Master Build Prompt

*Working name: **Margin** (provisional — see §01.7). Version: %s. Generated %s. Length ≈ %s words; %s numbered requirements.*

## What this document is

This is the complete build specification for an AI learning product whose mission is to be the best AI education company in history: table-stakes parity with ChatGPT, Gemini, Claude and DeepSeek chat products, plus an exam-grounded learning core that none of them has. It is written for the executing AI coding agent (or the engineering team an agent leads). Read §00 first: it fixes the reading order, the non-negotiables, the precedence rules and the definition of done.

**How it was produced.** Eight research briefs (frontier chat baseline, education competitors, learning science, exam systems and marking, UX craft, architecture and model economics, business and moat, student voice) plus two gap briefs (legal/licensing and Cambridge marking) and an analysis of the founder's own material → a decision index → three independent product visions → a judged synthesis (`designs/SYNTHESIS.md`, the source of truth for every decision below) → sixteen sections drafted against that synthesis → adversarial critique and revision. The research and design files ship alongside this document under `research/` and `designs/`; §15.I maps which file answers what.

**Precedence.** `designs/SYNTHESIS.md` > this document > the research appendices. Where this document marks a decision PROVISIONAL or [founder default], the flip condition is stated inline and the founder-owned decisions are listed with their defaults in §15.G.

## Table of contents

%s

---

""" % (version, datetime.date.today().isoformat(), format(words, ','), format(len(set(ids)), ','), '\n'.join(toc))

os.makedirs(os.path.join(WS, 'final'), exist_ok=True)
open(os.path.join(WS, 'final', 'MASTER-PROMPT.md'), 'w', encoding='utf-8').write(front + body)
print('MASTER-PROMPT.md: %s words · sections %s · %d unique IDs (%d mentions)'
      % (format(words, ','), ' '.join(order), len(set(ids)), len(ids)))

# --- integrity checks -------------------------------------------------------
rows = collections.Counter(re.findall(r'^\|\s*\**(\d\d-[A-Z]{2,5}-\d{3})\**\s*\|', body, re.M))
dup = [k for k, v in rows.items() if v > 1]
if dup: print('  ! IDs defined in more than one table row:', ', '.join(sorted(dup)[:20]))

heads2 = set(re.findall(r'^## (\d\d\.[0-9A-Z]+)', body, re.M))
heads1 = set(re.findall(r'^# §(\d\d)', body, re.M))
refs = set(re.findall(r'§(\d\d\.[0-9A-Z]+)', body))
dangling = sorted(r for r in refs if r not in heads2)
if dangling: print('  ! cross-refs to non-existent subsections:', ', '.join(dangling[:30]))

empty = []
lines = body.split('\n')
for i, l in enumerate(lines):
    if l.startswith('## '):
        j = i + 1
        while j < len(lines) and not lines[j].startswith('#'): j += 1
        if not ''.join(lines[i+1:j]).strip(): empty.append(l[3:].split()[0])
if empty: print('  ! %d empty subsections: %s' % (len(empty), ', '.join(empty)))
else: print('  ok: no empty subsections')

# fenced-code balance (an unclosed fence swallows whole sections in every renderer)
fence = [i for i, l in enumerate(body.split('\n'), 1) if re.match(r'^```+\s*[A-Za-z0-9_+-]*\s*$', l)]
if len(fence) % 2:
    print('  ! ODD number of code fences (%d) — a block is unclosed; run fixfences.py' % len(fence))
else:
    print('  ok: %d code fences, balanced' % len(fence))

# thin subsections (a heading with almost nothing under it reads as complete but is not)
thin = []
for i, l in enumerate(lines):
    m = re.match(r'^## (\d\d\.[0-9A-Z]+)\s', l)
    if not m: continue
    j = i + 1
    while j < len(lines) and not re.match(r'^## |^# ', lines[j]): j += 1
    w = len(' '.join(lines[i+1:j]).split())
    if w < 150: thin.append('%s (%d words)' % (m.group(1), w))
if thin: print('  ! thin subsections: ' + ', '.join(thin))
else: print('  ok: every subsection over 150 words')

missing_secs = [s for s in ('%02d' % i for i in range(16)) if s not in heads1]
if missing_secs: print('  ! missing sections:', ', '.join(missing_secs))
