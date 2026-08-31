# Status — what is built, what is verified, what is not

This document exists because the rest of the repository reads like a finished
product, and only part of it has been run.

## Summary

| Component | State | How it was verified |
|---|---|---|
| `server/` | **Runs** | 80 automated tests (`npm test`), plus a manual smoke test of every endpoint |
| `web/` | **Runs** | Served, rendered in Chromium (light, dark, mobile), layout checked at 10 widths |
| `ios/` | **Source complete, never compiled** | Nothing. There is no Swift toolchain or Xcode in the environment this was written in |

## What that means concretely

### The backend is real

`cd server && npm test` runs 80 tests covering token signing and forgery,
rate-limit refill behaviour, request validation (oversized fields, bad base64,
attachment caps, mode allow-listing), speech text preparation, and a full
streaming path driven end to end against a stubbed model API — including the
case where the `VERDICT:` marker arrives split across several tokens.

The server also starts and answers for real:

```
$ curl localhost:8787/healthz
{"status":"ok","tutor":"unconfigured","voice":"unconfigured"}
```

Two bugs were found by these tests and fixed:

- `voiceSettingsFor(0)` returned speed `1` instead of clamping to `0.7`, because
  `Number(speed) || 1` treats `0` as falsy.
- A token test was passing for the wrong reason — it re-signed with the same
  millisecond timestamp, so it would not have caught a real backdating attack.

### The website is real

Rendered and inspected, not just written. `node web/check.mjs` drives Chromium
over the DevTools Protocol and asserts there is no horizontal overflow at 320,
375, 390, 430, 600, 768, 900, 1024, 1280 and 1440px. It found and led to a fix
for a ragged mobile header.

### The iPad app has not been compiled

This is the important one.

The Swift is written against real APIs — `PDFPageOverlayViewProvider`,
`PKCanvasView`, `PKDrawing`, `VNRecognizeTextRequest`, SwiftData, `CGContext`
PDF generation — and is structured to build with XcodeGen. It has been reviewed
by hand for API correctness. **It has not been through a compiler.** Expect to
fix build errors on first `xcodegen generate && open StudyDesk.xcodeproj`.

Things that are design intent rather than measurement:

- **Pencil latency.** The architecture is the one that gives the best latency
  available on iPadOS (PencilKit owning the stroke pipeline, no per-gesture
  coordinate maths). Nobody has measured it on a device.
- **Large-document performance.** The drawing cache holds a window of pages and
  thumbnails render lazily, but "500 pages stays smooth" has not been tested
  against an actual 500-page PDF.
- **Ink sharpness under zoom.** `PDFStudyController.scaleChanged()` raises each
  canvas's `contentScaleFactor` on zoom. This is the standard mitigation for
  PencilKit rasterising finished strokes inside a PDF overlay; whether it is
  sufficient at 6× zoom is unverified.
- **Handwriting recognition accuracy.** Rendering the ink layer alone before
  running Vision is the right approach and is what makes the printed/handwritten
  split reliable. Actual accuracy on real teenage handwriting is unknown.

### Deliberately not built

Where a capability could not be delivered honestly, there is no UI for it:

- **Shape straightening.** PencilKit exposes no public API for it — it lives
  inside the system `PKToolPicker`, which this app replaces. Rather than ship a
  switch that does nothing, there isn't one.
- **AI-generated annotations on the page.** The data model and colour rules are
  in place (`InkPalette.tutorInk`, always visually distinct from student ink),
  but no UI generates them. Phase 2.
- **Exam Mode timer and report.** Exam Mode currently changes the tutor's
  behaviour, which is the substantive part. The timer, marks tracking and end-of-
  exam report are not built.
- **iCloud sync.** The persistence layer is shaped for it. It is not implemented,
  and the entitlements file is empty.

## What to do next

1. On a Mac: `cd ios && xcodegen generate && open StudyDesk.xcodeproj`, then fix
   compile errors. Budget real time for this.
2. Run the server locally, set `BACKEND_HOST` in `Config/Debug.xcconfig` to your
   Mac's LAN address, and confirm the tutor round trip on a device.
3. Test with a genuinely large PDF and a genuinely messy page of handwriting.
   Those two are where the design is most likely to need changing.
