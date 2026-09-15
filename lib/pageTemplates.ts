/**
 * A shape to start a page in.
 *
 * A blank page is the hardest kind, and the three structures students are
 * actually taught to take notes in are each a few headings that nobody
 * remembers to type. Offered only while the page is empty: a template on a
 * page with words on it is an invitation to lose them.
 */
export interface PageTemplate {
  id: string;
  name: string;
  blurb: string;
  body: string;
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "cornell",
    name: "Cornell notes",
    blurb: "Cues down the side, notes in the middle, a summary underneath.",
    body: [
      "# Topic",
      "",
      "## Cues",
      "",
      "Questions and keywords, written after the notes, that the notes answer.",
      "",
      "- ",
      "",
      "## Notes",
      "",
      "What was said, as it was said. Short lines. Leave room.",
      "",
      "- ",
      "",
      "## Summary",
      "",
      "Two or three sentences, in your own words, written last. If you cannot write this, the notes are not finished.",
      "",
    ].join("\n"),
  },
  {
    id: "lecture",
    name: "Lecture",
    blurb: "What it was about, the main points, what to look up.",
    body: [
      "# Lecture — ",
      "",
      "**Date:**  · **Course:**  · **Lecturer:** ",
      "",
      "## In one sentence",
      "",
      "",
      "## Main points",
      "",
      "1. ",
      "",
      "## Worked example",
      "",
      "",
      "## Did not follow",
      "",
      "> [!mistake] The bit to go back over before the next one.",
      "",
      "## To look up",
      "",
      "- [ ] ",
      "",
    ].join("\n"),
  },
  {
    id: "reading",
    name: "Reading",
    blurb: "A book or paper: the claim, the evidence, what you think.",
    body: [
      "# Reading — ",
      "",
      "**Author:**  · **Year:**  · **Pages:** ",
      "",
      "## The claim",
      "",
      "What it argues, in one paragraph, and what it argues against.",
      "",
      "## How it supports that",
      "",
      "- ",
      "",
      "## Key terms",
      "",
      "- **term** — what it means here",
      "",
      "## Quotes worth keeping",
      "",
      "> ",
      "",
      "## What I think",
      "",
      "Where it convinced you, where it did not, and what it leaves open.",
      "",
    ].join("\n"),
  },
];
