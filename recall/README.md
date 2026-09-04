# Recall

Paste your notes. Get questions. Be asked again at the moment you are about to
forget.

One HTML file. No build step at runtime, no dependencies, no framework, no
account, no server, no request of any kind once the page has loaded.

```bash
npm install       # playwright, for the tests only
npm run check     # build, then drive it in a browser
open dist/index.html
```

## Why it is one file

The previous version of this project was 300 kB of bundled machinery across five
languages, and it shipped a regular expression containing a lookbehind assertion.
Lookbehind arrived in Safari 16.4. On any older iPad the browser could not
*parse* the script, so the page was blank — no error, no partial render, nothing.
Fifty tests passed, because all fifty ran in Chromium.

So this is built the other way round:

- **`tools/compat.mjs` runs first and fails the build.** The floor is Safari 15.0
  and anything newer than the floor is rejected, by language: JavaScript rules do
  not fire on CSS, CSS rules do not fire on JavaScript, and comments are exempt so
  an explanation may name what it forbids. It also rejects invisible characters —
  non-breaking spaces, zero-width joiners, full-width digits — because those are
  never typed on purpose and cost an hour each to find. It caught three during
  this build, including one that silently broke the cloze gaps.
- **Every test runs in a real page.** The memory model is pure, so the tests call
  it through the same `window.Recall` the app uses, against the built file, served
  over HTTP. There is no separate Node-side test that could pass while the browser
  refuses to load.

## The three parts

**Schedule.** Each card carries a *stability* — how many days until recall falls
to 90% — and a *difficulty* from 1 to 10. Recall decays as a power function of
time over stability, which fits real forgetting far better than the exponential
everyone reaches for first. Remembering multiplies stability by an amount that
depends on how overdue the card was, how hard it is, and how the recall felt;
forgetting collapses it. The interval is then just "how long until recall reaches
the target".

**Make.** Paste notes, get cards, no AI and no waiting. It reads terms separated
by a dash, colon or equals; headings with lists under them; sentences that define
something; anything you put in **bold**; and figures inside a sentence. Every card
says which rule produced it, and nothing is kept until you tick it — a wrong card
is worse than a missing one, because you would go on being tested on it.

**Show.** One card. Four ratings, each labelled with when that answer would bring
the card back. "Again" returns it inside the same session.

## What is deliberately absent

No streaks, no points, no daily goal, no notifications. The only reason to open
this app is that something is due, and when nothing is due it says so and suggests
you stop — reviewing early does not help you remember, because the gap is the part
that works.
