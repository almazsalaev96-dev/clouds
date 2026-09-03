# Slate

An AI-native study workspace for iPad. The PDF is the canvas, Apple Pencil is the input,
the tutor is contextual, and every piece of work the student does becomes evidence that
decides what happens next.

It is not a PDF reader with a chatbot beside it, and it is not a homework solver.

---

## The idea in one line

> **Work produces evidence. Evidence derives understanding. Understanding decides what happens next.**

Nothing stores a conclusion. There is one append-only event log; mastery, weaknesses,
recommendations and study plans are all recomputed from it. That is what makes "why am I
being shown this?" answerable, and what makes deleting a document actually delete the
beliefs built on it.

---

## What is in here

```
docs/                 architecture, the learning model, the interface, privacy, honest status
tools/learning-sim/   the learning engine reference implementation, in Python
fixtures/             the cross-language oracle both implementations are held to
server/               the gateway: the only network peer the app talks to
ios/                  the iPad app — nine SPM modules plus the app target
web/                  the same product in a browser, built into one HTML file
```

---

## Run it right now, in a browser

```bash
cd web && npm install && npm run build
open dist/slate.html          # or serve the file; it needs nothing else
```

One self-contained HTML file, no server, no build step at runtime, no credentials. It
works offline on an iPad in Safari, with Apple Pencil as a first-class input: pressure
varies the stroke, coalesced samples keep fast writing smooth, and a resting palm is
rejected while the finger keeps working the interface.

It is an AI-native workspace rather than a viewer with a chatbot beside it: the
interface knows which question, which piece of your handwriting or which page you
are looking at, so "explain this" works with nothing typed. The tutor's accent
colour appears only where there is intelligence, an answer arrives as short titled
sections rather than a chat bubble, and a wrong answer produces *your answer → what
went wrong → the concept → try again* instead of a cross. `docs/DESIGN.md` sets out
the system.

What is real in it, rather than mocked:

- **the marker** — `server/src/grading/*.ts` itself, type-stripped and bundled, so the
  browser marks answers with exactly the code the gateway runs. `npm run smoke` proves
  it by running the same battery through both and comparing;
- **the learning model** — the same engine held to the golden fixtures above;
- **the adaptive diagnostic** — questions chosen by expected information gain in bits,
  which typically names the misconception in three questions;
- **the graduated help** — written by hand, five rungs, the answer always available.

What is *not* real without a server: the tutor's own words. A model that answers a
student's own questions needs credentials, and credentials do not belong in a web page.
Point the app at a gateway in Settings and the tutor appears; leave it blank and the
written help is what you get, labelled as written help.

---

## Three things worth reading first

**1. The grader decides before the model does.** The single worst failure mode of "AI
marks my homework" is confident wrong marking. So `server/src/grading` parses both
answers into expression trees and decides equivalence by evaluating them at dozens of
seeded sample points. It marks `(x+1)(x+2)` against `x^2+3x+2` as correct, gives the same
verdict every run, and when it disagrees with the model, **the arithmetic wins**. The
model is asked why the answer went wrong, never whether it did.

It also works out *how* an answer missed — flipped sign, factor of ten, inverted
fraction, degrees for radians, right number wrong unit — by arithmetic rather than by
asking a model to speculate. That one field turns a generic "incorrect" into a specific
piece of teaching.

**2. The learning engine exists three times and cannot drift.** In Python
(`tools/learning-sim`, where it was tuned), in Swift (`SlateLearning`, which ships on
iPad), and in JavaScript (`web/src/learning`, which runs in the browser). The Python side
emits `fixtures/learning-golden.json`; the Swift and JavaScript suites load that exact
file and assert parity to nine decimal places at every step of every scenario. CI fails
if the committed fixture is stale. The web build is therefore not a simplified demo of
the model — it is the model.

**3. Losing a stroke is unforgivable, so saving is journalled.** Every committed change
is a framed, checksummed record in a write-ahead log before it is anything else.
Snapshots are written atomically and the log is truncated only afterwards. A crash
mid-write leaves a torn record, which replay detects and stops at — so a half-written
stroke can never corrupt the strokes before it.

---

## Running what runs

The learning engine and its 45 behavioural tests:

```bash
cd tools/learning-sim
python3 -m unittest discover -s tests -v
python3 -m slatelearn.golden          # regenerate the golden fixture
```

The gateway and its 100 tests:

```bash
cd server
npm install
npm run check                          # typecheck + tests
cp .env.example .env                   # then add your keys
npm start
```

The iPad app (needs macOS and Xcode 15+):

```bash
brew install xcodegen
cd ios && xcodegen generate
open Slate.xcodeproj
swift test --package-path Packages/SlateKit    # golden parity suite
```

Point the app at the gateway by editing `SlateGatewayURL` in `ios/Slate/Info.plist`.

---

## Credentials

The app holds none, and cannot, because it never talks to a provider. The gateway holds
them in environment variables and is the only peer the app knows about.

```
iPad ──TLS──▶ Slate Gateway ──▶ Anthropic API
                    └─────────▶ ElevenLabs API
```

In production the gateway refuses to start without a shared app token. An open gateway
holding a paid key is a billing hole.

---

## Status

**`docs/STATUS.md` is the honest ledger.** In short: the Python engine and the Node
gateway are tested and passing here. The Swift has been written and statically audited
but **never compiled**, because this was built in an environment with no Swift toolchain.
Assume there are build errors, and start by running the golden parity suite on a Mac.

---

## Documents

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the decisions, and where each deviates from the original brief
- [`docs/LEARNING-MODEL.md`](docs/LEARNING-MODEL.md) — the normative specification both implementations follow
- [`docs/PRIVACY.md`](docs/PRIVACY.md) — what leaves the device, and what never does
- [`docs/STATUS.md`](docs/STATUS.md) — what is verified, what is not, and what was deliberately left out
