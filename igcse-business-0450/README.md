# IGCSE Business Studies — Revision Engine

A complete, self-contained revision site for **Cambridge IGCSE & O Level Business Studies
(0450 / 0986 / 7115)**, built from the full syllabus and aimed squarely at the top grades.

## What's in it

| | |
|---|---|
| **29 chapters** | Every chapter of the course, rewritten as condensed exam-focused notes with tables, worked examples, exam tips and "common mistake" warnings |
| **309 definitions** | Every "definition to learn", available as a glossary and as a spaced-repetition flashcard deck |
| **239 quiz questions** | Multiple choice with a written explanation for every option — including the ones you get right |
| **116 exam questions** | Real command words, real mark tariffs, with a **plan**, a **full model answer** and a **mark-scheme note** telling you where each mark sits |
| **6 calculators** | Break-even (with a chart), ratio analysis, cash flow forecast, costs/added value, productivity, exchange rates — each with the *interpretation* an examiner wants, not just a number |
| **Exam technique** | All eight command words, what each demands, what full marks looks like, timing for both papers, and the phrase banks for analysis and evaluation |
| **AI examiner** | Paste an answer, get a mark out of the tariff, what earned credit, what was missing, and one paragraph rewritten to full-mark standard |

## Running it

It is plain HTML, CSS and JavaScript — no build step, no dependencies.

```bash
cd igcse-business-0450
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly from disk also works for everything except the AI examiner
(browsers block API calls from `file://` pages). Use the local server for that.

To publish it, upload the folder to any static host — GitHub Pages, Netlify, Vercel, Cloudflare Pages.

## Setting up the AI examiner

1. Click **⚙ Settings** in the sidebar.
2. Choose a provider:
   - **Anthropic (Claude)** — get a key at <https://console.anthropic.com/settings/keys>
   - **OpenAI-compatible** — any endpoint that speaks the OpenAI chat-completions API
3. Paste the key, pick a model, save.

**Where the key goes.** It is stored in your browser's `localStorage` and sent only to the
provider you selected, directly from your browser. It is not sent to any other server, and
there is no backend in this project that could receive it. Anyone using the same browser
profile can read it, so don't add a key on a shared computer.

The examiner knows which chapter you're reading and marks against the real assessment
objectives (AO1 knowledge, AO2 application, AO3 analysis, AO4 evaluation). From any exam
question, **"✦ Mark my answer"** sends the question and your written answer straight to it.

## How it's organised

```
index.html                 page shell — loads everything, no build step
assets/css/app.css         design system; light + dark; print stylesheet
assets/data/
  syllabus.js              sections, papers, assessment objectives
  exam.js                  command words, timing, technique rules
  ch-s1.js … ch-s6.js      all 29 chapters: notes, definitions, MCQs, exam questions
assets/js/
  store.js                 localStorage: progress, Leitner boxes, saved answers
  render.js                content-block renderer (escapes all content)
  tools.js                 the six calculators
  study.js                 flashcard scheduler + quiz engine
  ai.js                    AI examiner (Anthropic + OpenAI-compatible, streaming)
  app.js                   hash router, all views, search, settings
```

Chapter content is data, not markup — each chapter is an object with `blocks` of typed
content (`p`, `table`, `pc`, `tip`, `trap`, `formula`, `worked`, …). To add or edit
material, edit the data file; the renderer handles the rest.

## Your progress

Chapter ticks, flashcard boxes, quiz scores, streak and written answers are all stored in
your browser. **Settings → Export progress** writes a JSON file you can import on another
device. Clearing site data wipes it, so export before you do.

## Keyboard shortcuts

| Key | Does |
|---|---|
| `/` | Jump to search |
| `Space` | Flip the current flashcard |
| `1` / `2` | Grade a flashcard wrong / right |
| `A` `B` `C` `D` | Answer a quiz question |
| `Enter` | Next question |

## A note on the content

The notes, questions and model answers here were written for this project against the
published syllabus. They follow the same topic sequence as the standard course textbook —
which is how the syllabus itself is ordered — but the wording, the practice questions and
every model answer are original. Use them alongside your textbook and past papers, not
instead of them.
