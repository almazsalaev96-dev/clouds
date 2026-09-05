# Content rights

Exam material is copyrighted. Past papers, mark schemes and examiner reports
belong to the awarding bodies that produced them, and the fact that a PDF can be
found on the open web does not make it redistributable.

Lodestar is built so that doing the right thing is the path of least resistance.

## The licence field

Every question declares `source.kind` and `source.licence`:

| Licence | Meaning | Rendered as content? |
|---|---|---|
| `owned` | You hold the rights | Yes |
| `licensed` | Licensed for display | Yes |
| `public-domain` | Out of copyright, or released | Yes |
| `link-only` | Rights not held — must not be reproduced | **No.** Linked to the official source |
| `user-owned` | The student's own upload | Yes, privately to them |

`link-only` material is never rendered. It is surfaced as a reference to the
awarding body's own page, and the loader **errors** if such an item has no
source URL — so it is not possible to accidentally ship a reference nobody can
follow.

## What the loader enforces

- `link-only` without a URL is an error, not a warning.
- `source.kind: past-paper` combined with `licence: owned` produces a warning,
  because that combination is usually a mistake. Confirm you hold the rights, or
  use `licensed` / `link-only`.
- Every pack declares a `rights.summary`, shown on the Library page.

## What is safe to author

- **Original questions in the style of a qualification.** This is what the
  shipped 9609 pack contains. Writing an original question that assesses the
  same objective at the same difficulty is normal practice and is not
  reproduction.
- **Syllabus structure.** Topic lists, paper structures, durations, mark totals
  and assessment-objective weightings are factual descriptions of a
  qualification. Cite the published syllabus, as `officialResources` does.
- **Command words.** Note that the shipped pack puts Lodestar's own working
  descriptions in `definition` and leaves `officialDefinition` empty. Fill the
  latter only where you are entitled to quote the board's exact wording.
- **Links to official past papers and mark schemes.** Boards publish selected
  materials themselves; link to those pages rather than mirroring the files.

## What is not

- Copying past-paper questions, mark schemes or examiner reports into a pack
  under `owned`.
- Scraping third-party aggregator sites and republishing what is found there.
- Presenting AI-generated content as official. Generated questions carry
  `kind: ai-generated` and are labelled in the interface wherever they appear.

## Student uploads

Material a student adds themselves is `user-owned`: private to them, never
shared, and included in their export. It is their material, not the platform's.
