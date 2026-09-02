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
docs/                 architecture, the learning model, privacy, honest status
tools/learning-sim/   the learning engine reference implementation, in Python
fixtures/             the cross-language oracle both implementations are held to
server/               the gateway: the only network peer the app talks to
ios/                  the iPad app — nine SPM modules plus the app target
```

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

**2. The learning engine exists twice and cannot drift.** Once in Python
(`tools/learning-sim`, where it was tuned) and once in Swift (`SlateLearning`, which
ships). The Python side emits `fixtures/learning-golden.json`; the Swift test suite loads
that exact file and asserts parity to nine decimal places at every step of every
scenario. CI fails if the committed fixture is stale.

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
