# Slate, in a browser

One HTML file. No server, no build step at runtime, no credentials, no network calls
unless you import a PDF or configure a tutor.

```bash
npm install
npm run build          # → dist/slate.html and dist/artifact.html
npm run check          # build, content tests, parity tests, then drive it in Chromium
```

## Why this is not a demo

The two things a study app can most easily fake are marking and understanding. Neither
is faked here.

**The marker is the gateway's own.** `tools/bundle.mjs` reads `server/src/grading/*.ts`,
strips the types with Node's own type stripper, and inlines the result. The browser runs
the same parser, the same equivalence check by evaluation at seeded sample points, and
the same near-miss diagnosis — flipped sign, inverted fraction, factor of ten, degrees
for radians, right number wrong unit — as the server does. `tools/smoke.mjs` runs a
battery through both and fails the build on any disagreement, so the two cannot drift.

**The learning model is the same one, for the third time.** `src/learning/*.js` is held
to `fixtures/learning-golden.json` — the file the Python reference emits and the Swift
port is tested against — to nine decimal places, at every step of every scenario.

**The diagnostic really is adaptive.** Questions are ranked by expected information gain
in bits per minute; one that every hypothesis answers the same way scores near zero and
is not asked. `src/app/diagnostics.js` deliberately contains such a question so the test
suite can prove the selection is doing work.

## What needs a server, and why

The tutor's words. A model that answers a student's own questions in their own context
needs provider credentials, and a credential in a web page is a credential published.
So the app ships written help instead — five rungs, authored per question, available
offline — and says so in plain words rather than pretending. Point Settings at a gateway
and `/v1/tutor` is called for real.

## Layout

```
src/learning/    the learning engine (mastery, scheduling, misconceptions, EIG, planning)
src/app/         the product: store, help ladder, ink, worksheets, screens
tools/bundle.mjs a small ES-module bundler that throws on syntax it does not understand
tools/build.mjs  produces dist/slate.html and dist/artifact.html
tools/smoke.mjs  drives the built page in headless Chromium
test/            golden parity, and the content checked mechanically
```

## Apple Pencil

Pointer events, not touch events. A `pen` pointer always draws; a finger draws only when
asked to, so a resting palm is rejected and the hand keeps working the interface while
the Pencil writes. `getCoalescedEvents()` recovers every digitiser sample between frames,
pressure varies the stroke width along its length, and strokes are stored in page
coordinates rather than pixels so they stay sharp at any zoom and survive a rotation.
