# Margin — the master build prompt for an AI education product

This folder holds one deliverable and the evidence behind it.

**`MASTER-PROMPT.md`** is the deliverable: a complete, executable build specification for an AI
learning product — working name **Margin** — whose mission is to be the best AI education company
in history. It runs to 225,000 words across sixteen sections and carries 1,554 numbered, testable
requirements. Hand it to an AI coding agent (or to an engineering team an agent leads) and it can
build the product without re-deciding anything. It covers both halves of the brief:

- **Table stakes** — everything ChatGPT, Gemini, Claude and DeepSeek chat products already do,
  specified as a parity checklist with an acceptance test per capability (§03).
- **The reason to switch** — an exam-grounded learning core none of them has: an examiner-calibrated
  marking engine with published accuracy gates, an effort gate and help ladder that refuse to hand
  over answers before an attempt, a learner graph that schedules revision against the real exam date,
  and a design system specified to the pixel (§04–§12).

## How to read it

Start at §00. It fixes the reading order, the non-negotiables, how to resolve ambiguity, and the
definition of done for MVP, v1 and v2. Every requirement carries a stable ID (`05-MARK-014`) and,
where it is not obvious, an acceptance test. Decisions the founder still owns are marked
`[founder default]` inline and collected with their defaults in §15.G.

`margin-reader.html` is the same document as a browsable page: contents sidebar, section filter,
light and dark. Open it in a browser; nothing is fetched at runtime except fonts.

## What is in the other folders

| Folder | What it holds |
|---|---|
| `designs/SYNTHESIS.md` | The adjudicated product decisions. **This is the source of truth** — where the master prompt and the synthesis disagree, the synthesis wins. |
| `designs/vision-*.md` | Three independent product visions (pedagogy-first, craft-first, platform-first), written without sight of each other. |
| `designs/JUDGING.md` | The rubric scoring of those visions and the fifteen rulings that resolved their conflicts. |
| `research/` | Ten research briefs plus an analysis of the founder's own material. `INDEX.md` maps every decision to the evidence for it; §15.I of the master prompt says which file answers what. |
| `critiques/` | What four adversarial expert panels found (162 findings, 39 of them blockers) and, in `RESOLUTION-*.md`, exactly what each one produced — fixed, partially fixed, or declined with a reason. |
| `draft/` | The per-section drafts the final document is stitched from. Edit these, not `MASTER-PROMPT.md`. |
| `build/` | The four scripts that turn the drafts into the deliverable. |

## Regenerating the document

`MASTER-PROMPT.md` and `margin-reader.html` are built from `draft/*.md`, so the section drafts are
the thing to edit. From the directory holding `draft/`:

```
python3 build/stitch.py        # drafts -> MASTER-PROMPT.md, then the integrity checks
python3 build/build_reader.py  # MASTER-PROMPT.md -> margin-reader.html
```

`stitch.py` orders the sections §00 to §15, generates the contents, and fails loudly on the four
defects that actually bit during writing: cross-references to subsections that do not exist, a
requirement ID defined in two places, an empty or thin subsection, and an unclosed code fence — an
odd fence count silently swallows whole sections in every markdown renderer, which is how the metrics
tree and two appendices went missing the first time. `fixfences.py` repairs that class of damage.

## Status

The working name Margin is provisional pending clearance searches (§01.7). Numbers marked
PROVISIONAL depend on founder decisions E1 to E17 (§15.G) — each states what changes in the build if
the founder decides otherwise. Claims the research could not verify against a primary source are
flagged where they appear and listed in §15.H.
