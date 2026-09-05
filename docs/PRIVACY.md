# Privacy

## What is stored, and where

Everything a student generates — attempts, mistakes, memory states, notes,
mocks, settings and the full event log — is stored in **their own browser**, in
IndexedDB, under the origin serving the app.

There is no account, no server-side copy, and no analytics pipeline. The only
network requests the app makes on its own behalf are for the web fonts and, when
explicitly enabled, AI features.

The practical consequences, stated plainly in Settings rather than buried:

- Clearing site data deletes everything. **Export a backup occasionally**,
  especially before an exam.
- Study data does not follow the student to another browser or device.
- Nobody else — including whoever deploys the app — can see their work.

## Export and deletion

Settings offers:

- **Export everything** — one JSON file containing the complete record.
- **Import a backup** — replaces local state with a previous export.
- **Delete all my data** — clears the store irrecoverably.

The export is the whole state object, not a summary, so it is a genuine data
handover rather than a gesture.

## What leaves the device

Only when AI features are explicitly enabled, and only the specific context that
feature needs:

| Feature | What is sent |
|---|---|
| Tutor | Subject, syllabus code, current topic, the pack's command-word definitions, a short mastery summary, up to eight recent mistake labels, target grade, days to exam, and the conversation |
| Marking | The question, its mark scheme, and the answer being marked |
| Explanation | Subject, topic and objectives |

Never sent: the event log, the attempt history, notes, mock records, or any
identifier. There is no identifier to send — the app does not create one.

API keys are read server-side only (`src/ai/index.ts` imports `server-only`)
and cannot reach the browser.

## If this is ever deployed with a server database

The state shape is designed for it (see ARCHITECTURE, "Persistence seam"), and
the same commitments should carry over: row-level access so a student's records
are readable only by them, export and deletion preserved as first-class
operations, and AI context construction unchanged — narrow, per-request, and
never the whole store.
