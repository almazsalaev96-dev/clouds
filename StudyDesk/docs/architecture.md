# Architecture

## Shape

```
┌─ iPad ────────────────────────────────────────────────┐
│                                                        │
│  Features/        SwiftUI screens. No screen builds a  │
│                   service or reaches for a singleton.  │
│      ↓                                                 │
│  ReaderModel      One open worksheet: page, ink,       │
│                   selection, tutor, session.           │
│      ↓                                                 │
│  ┌──────────────┬──────────────┬───────────────────┐   │
│  │ PDF + Pencil │ ContextEngine│ TutorEngine       │   │
│  │ PDFStudy-    │ + OCR        │ + VoicePlayer     │   │
│  │ Controller   │              │                   │   │
│  └──────────────┴──────────────┴───────────────────┘   │
│      ↓                ↓                 ↓              │
│  DrawingRepo /   Vision (on-device)   AIProvider /     │
│  DocumentStore                        VoiceProvider    │
│  SwiftData                                 ↓           │
└────────────────────────────────────────────┼───────────┘
                                             │  HTTPS
┌─ Study Desk proxy (server/) ───────────────▼───────────┐
│  auth → rate limit → validate → prompt → upstream      │
│  Holds the model key and the speech key. Logs neither  │
│  worksheet text nor questions.                         │
└────────────┬───────────────────────┬───────────────────┘
             ▼                       ▼
      Tutoring model           ElevenLabs
```

## The rules that shape it

**One place creates things.** `AppEnvironment` builds every service once and
hands them down through the SwiftUI environment. Swapping the AI or voice
provider means writing one conformance and changing one line there.

**Providers are protocols.** `AIProvider` and `VoiceProvider` describe what the
app needs, not what a vendor offers. Nothing above them knows which model
answers, or that a proxy exists.

**The document is never the database.** PDF bytes live on disk in
`DocumentStore`; SwiftData holds metadata and ink. A 500-page textbook does not
make the store slow, and PDFKit memory-maps the file rather than loading it.

**Ink is a layer, not a modification.** The imported PDF is copied into
`Originals/` and never written to again. Ink is `PKDrawing` data per page.
Export is a third file in `Submissions/`. "We never change your worksheet" is
enforced by the file layout, not by discipline.

## Module map

| Module | Job |
|---|---|
| `DesignSystem/` | Colour, spacing, type, motion. Nothing hardcodes a value. |
| `Models/` | SwiftData models. Documents, ink, assignments, submissions, conversations, sessions. |
| `Persistence/` | `PersistenceController` (with quarantine-on-corruption recovery), `DocumentStore`. |
| `PDF/` | `PDFStudyController` (the overlay engine), page rendering, region selection. |
| `Pencil/` | Tool state, toolbar, ink palette. |
| `Annotation/` | `DrawingRepository` — the autosave contract. |
| `OCR/` | `TextRecognizer`, `HandwritingRecognizer`. On-device Vision only. |
| `Context/` | `ContextEngine`, `QuestionDetector`, `StudyMemory`, `StudyAnalytics`. |
| `AI/` | Provider protocol, backend client, SSE parser, `TutorEngine`. |
| `Voice/` | Provider protocol, ElevenLabs implementation, `VoicePlayer`. |
| `Export/` | `PDFExporter` — vector page, rasterised ink. |
| `Features/` | Screens. |

## Why there is a server at all

Because there is no way to put an API key in an iPad app and keep it. An
attacker with the binary has the key, obfuscation only changes how long it takes,
and the bill is the developer's. The proxy also lets the teaching policy
(`server/src/prompt.js`) be audited and improved in one place without shipping an
app update — which matters more than it sounds when the audience is children.

See [`security.md`](security.md).

## Why no third-party dependencies

The iPad app uses only Apple frameworks. The server has zero npm dependencies —
its routing table is four entries and its SSE grammar is three field names.
Both choices are about the same thing: a study app holding schoolwork should
have as small a supply chain as it can get away with.
