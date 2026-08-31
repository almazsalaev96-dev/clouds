# Roadmap

Ordered by what makes studying easier, not by what is technically interesting.

## Before anything else: compile it

The iPad app has never been through a compiler. Nothing below matters until
`xcodegen generate && xcodebuild` succeeds and the app runs on a device. See
[`status.md`](status.md).

Then, in order: a 500-page PDF, a page of genuinely messy handwriting, and a
real Pencil latency measurement. Those three will change more of the design than
any feature on this list.

## Built

**Documents** — import PDF, scan with the camera, import photos, library, folders
by subject, favourites, soft delete with 30-day recovery, search across
worksheets, handwriting, notes and past tutor answers.

**Pencil** — pen, pencil, marker, highlighter, stroke eraser, lasso, ruler,
per-tool colour and width memory, Apple Pencil double-tap, floating toolbar that
moves to either edge, undo/redo, sub-second autosave.

**Tutor** — twelve modes, subject-aware quick actions, context-aware button
label, region select, hint-first policy, four-way answer checking, streaming
replies, per-request privacy disclosure, on-device handwriting recognition,
question detection.

**Voice** — ElevenLabs behind a `VoiceProvider` protocol, streamed with playback
starting before synthesis finishes, play/pause/resume/replay/speed.

**Finishing** — final review with blank-page detection, vector-preserving PDF
export, optional name header, suggested file name, submission preview, system
share sheet, submission history with the exact file that was sent.

**Platform** — light and dark, Dynamic Type, VoiceOver labels throughout, Reduce
Motion, keyboard shortcuts, Split View and Stage Manager, full offline document
editing.

## Phase 2 — the things students will ask for first

1. **Exam Mode, completed.** The behaviour change is built; the timer, per-question
   marks, confidence tracking and end-of-exam report are not.
2. **AI annotations on the page.** The colour rules and the "never overwrite
   student work" constraint are in place; no UI generates them. An arrow the
   tutor draws must be visually unmistakable and offered as *Add to page* /
   *Dismiss*, never applied.
3. **Study Mode.** Turning a finished worksheet into flashcards, active recall
   and a short quiz — where the revision value actually is.
4. **Assignment calendar and reminders.** Opt-in, one notification, never a
   badge that nags.
5. **Handwriting search across the library.** Ink is already recognised per page
   and cached; it is not yet recognised in the background for pages the student
   hasn't asked about.
6. **Better maths recognition.** Vision reads handwritten prose well and
   handwritten algebra poorly. Superscripts, fractions and roots need either a
   maths-specific recogniser or a structural pass over stroke geometry.

## Phase 3 — worth doing, not worth doing early

- **iCloud sync.** The persistence layer is shaped for it; the entitlements file
  is empty. Ink is the hard part — `PKDrawing` blobs merge badly, so this needs
  per-page last-writer-wins with a visible conflict, not silent resolution.
- **Semantic document search.** Only once a library is big enough that a linear
  scan stops being milliseconds. Building an embedding index costs battery.
- **Voice conversation.** Speaking a question is easy; a tutor that listens while
  the student thinks out loud is a different product and needs care.
- **Teacher mode.** Set work, see submissions. This changes the privacy model
  fundamentally and should not be bolted on.
- **Collaborative study.** Two students on one worksheet. Interesting, and a long
  way from the core promise.

## Explicitly not planned

- **A proprietary submission channel.** Schools use Teams, Classroom, Firefly,
  email and half a dozen others. The share sheet reaches all of them; a custom
  channel would reach none.
- **Streaks, badges, daily goals.** The progress screen is deliberately dull. An
  app that makes a student open it when they don't need to has stopped being a
  study tool.
- **A general chat mode.** The tutor without a worksheet in front of it is a
  chatbot, and there are plenty of those. The worksheet is the product.
