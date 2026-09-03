# What is verified, and what is not

This is the honest ledger. Everything in `docs/` describes what the code does; this
file describes how much of that has actually been *run*.

The build environment for this work had Python 3 and Node 22 but **no Swift toolchain
and no macOS**. That divides the repository cleanly.

---

## Executed and passing

| Component | Evidence |
|---|---|
| Learning engine (Python reference) | 57 tests, `python3 -m unittest discover -s tests` |
| Golden fixture | regenerated and byte-compared against the committed file in CI |
| Gateway (Node/TypeScript) | 132 tests, `npm test`; `tsc --noEmit` clean |
| Deterministic grader | 54 of those 132, covering parsing, equivalence, units, sets, near misses, and the notation students actually type |
| Learning engine (JavaScript) | 16 parity tests against `fixtures/learning-golden.json`, to 9 decimal places |
| Web content and diagnostics | 8 tests: every worked answer is accepted by the real marker, every likelihood row sums to 1, every seeded misconception is identified within four questions |
| Web app, in a real browser | 50 checks driven through headless Chromium: every screen, pen input and lasso selection, marking and mistake analysis, the contextual tutor, an adaptive diagnostic to a conclusion, a timed test to a diagnosis, persistence across reload, dark mode, 44px targets, iPad-portrait layout, and grader parity between the bundled page and the TypeScript source |

Run them yourself:

```bash
cd tools/learning-sim && python3 -m unittest discover -s tests -v
cd server && npm install && npm run check
cd web    && npm install && npx playwright install chromium && npm run check
```

---

## Written, reviewed, **not compiled**

The entire `ios/` tree — and *only* that tree. The web build under `web/` covers the
same product and has been executed end to end in a browser, so the untested surface is
now the iPad-specific layer (PencilKit, PDFKit, the journalled document store and the
SwiftUI screens) rather than the product's reasoning.

Roughly 13,000 lines of Swift across 72 files. It has been
read back and statically audited — conditional-compilation balance, brace balance,
access levels on cross-module initialisers, `switch` expressions whose branches have
different concrete types, and Swift-version-gated syntax such as `@retroactive`. Four
real defects were found and fixed that way, including `Slate.Type` colliding with
Swift's metatype syntax in 49 places.

That is not the same as compiling. **Assume there are build errors.** The first thing
to do on a Mac is:

```bash
brew install xcodegen
cd ios && xcodegen generate
xcodebuild -scheme Slate -destination 'platform=iOS Simulator,name=iPad Pro (11-inch)' build
swift test --package-path ios/Packages/SlateKit    # golden parity suite
```

The golden parity suite is the one that matters most. If `GoldenParityTests` passes,
the Swift learning engine reproduces the Python reference exactly, and the intellectual
core of the product is correct on device.

---

## Deliberately not built

Not oversights. Each was considered and left out, with the reason.

| Not built | Why |
|---|---|
| Accounts, sign-in, sync | Nothing in the first slice needs an identity. Adding one costs a signup screen, a password reset flow, and a database of children's names, in exchange for nothing a student can feel. |
| iCloud sync | The architecture is local-first and the file layout is sync-shaped, but shipping sync before the single-device experience is excellent means debugging conflict resolution instead of the product. |
| Teacher mode | Architected for (`AssignmentID` and submission history exist) and correctly out of a first release. A teacher dashboard changes who the product is for. |
| Curriculum and mark-scheme data | The metadata fields exist and are unpopulated. Inventing an exam board's mark scheme would be worse than having none: a student would trust it. |
| Voice input | The tutor can be listened to; it cannot yet be talked to. Speech recognition is a separate permission, a separate failure surface, and worth doing properly rather than early. |
| On-device OCR pass | `HandwritingReading` is the seam. A Vision-framework implementation slots in behind it and would cut both cost and latency; it needs a device to tune against. |
| Live "AI watches you write" | The hook exists (`onSettled` fires when the pencil stops) and is deliberately wired to nothing. It is the single easiest feature in this product to make unbearable. |

---

## Known weaknesses in what *is* built

Stated because finding them in six months is worse.

1. **The grader decides equivalence by sampling, not by symbolic algebra.** Two
   genuinely different expressions agreeing at 24 independently chosen points is
   vanishingly unlikely, but it is not a proof. It abstains rather than guessing when
   too few points are defined for both sides.
2. **Near-miss detection tries a fixed list of transformations.** It catches flipped
   signs, factors of ten, reciprocals, squares and degree/radian confusion. A student
   who missed in some other systematic way gets a plain "incorrect".
3. **The rate limiter is in-process.** Correct for a single instance, wrong behind a
   load balancer. Two instances means two limits, and the fix is Redis, bought when it
   is needed.
4. **The mastery constants are tuned against simulated students, not real ones.** The
   *shape* is defensible and every threshold is documented and testable; the exact
   numbers should move once there is real evidence. That is why the engine is a pure
   function over an append-only log: retuning re-scores history rather than migrating
   opinions.
5. **`FinalReview.local` is the cheap half.** It finds blank answers and stray marks
   from the question map. Page-order and missing-page detection need the model pass.
6. **Concept identifiers are strings with no shipped graph.** `Concept.prerequisites`
   is honoured by the recommender wherever a graph is supplied; none is supplied. The
   concepts a document analysis returns are the only source, so the graph is flat until
   a curriculum is loaded.
7. **Document analysis reads the first six pages only.** Enough to identify the document
   and map the questions a student starts on. The rest is provisional until they reach
   it, and `DocumentAnalyser.Result.isPartial` says so.
8. **Answer regions are inferred from question order when the layout gives no clue.**
   A reasonable guess on a worksheet, and the student's own strokes override it the
   moment they write — but on an unusual layout the first "check this" may resolve to
   the wrong question until then.

9. **Notes are typed only.** A note can hold handwriting — `Note.inkPages` exists and
   round-trips — but there is no ink surface in the note editor. Handwriting belongs on
   the page it was written on, and a second, worse canvas here would be a trap.
10. **Search is substring matching over notes only.** It does what a student expects of
   a search box on one screen. The natural-language search across documents, mistakes
   and past tests that the brief describes needs an index, and an index needs a reason.

---

## The order to build in next

0. There is exactly one `try!` left in the tree, and it is gone — a device with no
   space left now gets a sentence explaining itself rather than a launch loop.
1. Get it compiling and run `GoldenParityTests` on a Mac.
2. Import a real 20-page worksheet, write on it, force-quit the app mid-stroke, and
   confirm the recovery notice appears and the strokes are there.
3. Check an exported PDF opens correctly in Preview, Mail and Google Classroom.
   Handwriting, highlights, shapes and typed answers are all composited; what needs a
   real device is whether they land where the student put them.
4. Point `SlateGatewayURL` at a local gateway and walk one question end to end:
   write, check, wrong, hint, fix, correct.
5. Then, and only then, the study loop.
