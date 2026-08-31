# Study Desk

An AI study workspace for iPad. A student opens a worksheet, writes on it with
Apple Pencil, asks a tutor that already understands the page, finishes the
assignment, and sends a clean PDF to their teacher — without leaving the app.

```
worksheet → handwriting → AI help → learning → finished work → PDF → teacher
```

## Repository layout

| Path | What it is | Status |
|---|---|---|
| `ios/` | The iPadOS app (SwiftUI, PencilKit, PDFKit, Vision, SwiftData) | Source complete; **needs Xcode to build** |
| `server/` | Secure backend proxy for the AI model and ElevenLabs | Runs and tested here (`npm test`) |
| `web/` | Marketing website (static, zero dependencies) | Runs and tested here |
| `docs/` | Architecture, context engine, privacy, roadmap | — |

## The two ideas the whole product rests on

**1. The Context Engine.** The tutor is never handed "a screenshot and a
question". Every request is a structured `StudyContext`: the printed question
(from the PDF text layer), the student's own work (from the Pencil drawing
layer, OCR'd separately), the region they selected, the page image, and the
recent conversation. Because printed content and handwriting live in *different
layers*, the app can tell the tutor "the question is `2x + 5 = 15`, the student
answered `x = 4`" instead of "here is a picture, good luck". That distinction is
what makes answer-checking and mistake-finding actually work.

**2. The Pencil/PDF Engine.** Ink is not drawn on top of a rendered image. Each
PDF page gets a real `PKCanvasView` through PDFKit's
`PDFPageOverlayViewProvider`, so PDFKit owns zoom, scroll and page geometry, and
PencilKit owns the stroke pipeline. Ink stays vector, stays crisp at any zoom,
and finger touches still pan the document while the Pencil writes.

If a feature ever conflicts with Pencil latency, Pencil wins.

## Getting started

### Backend (works today)

```bash
cd server
cp .env.example .env      # add ANTHROPIC_API_KEY and ELEVENLABS_API_KEY
npm install
npm test
npm run dev               # http://localhost:8787
```

### Website (works today)

```bash
cd web
python3 -m http.server 8080
```

### iPad app (needs a Mac)

```bash
cd ios
brew install xcodegen
xcodegen generate
open StudyDesk.xcodeproj
```

Set `BACKEND_BASE_URL` in `ios/Config/Debug.xcconfig` to your machine's LAN
address so the iPad can reach the dev server. No API key ever goes in the app —
see [`docs/security.md`](docs/security.md).

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — modules and how they fit
- [`docs/context-engine.md`](docs/context-engine.md) — what the tutor is told, and why
- [`docs/pencil-and-pdf.md`](docs/pencil-and-pdf.md) — the ink pipeline and export
- [`docs/security.md`](docs/security.md) — secrets, device tokens, what leaves the iPad
- [`docs/privacy.md`](docs/privacy.md) — what is processed on-device
- [`docs/roadmap.md`](docs/roadmap.md) — MVP, phase 2, phase 3
- [`docs/status.md`](docs/status.md) — **what is built, what is verified, what is not**
