# Privacy

School documents contain real things about real children. This is the whole list,
and the app shows it to the student at the moment they ask a question — the eye
button in the tutor panel header.

## Stays on the iPad, always

- Every PDF, in full
- Every stroke of handwriting
- **Handwriting recognition itself** — Vision runs on the device; ink is never
  uploaded as an image for recognition
- Notes, study history, weak-topic memory
- Every page the student did not ask about

## Sent, and only when the student asks a question

- The printed text of that one page (trimmed to the active question if long)
- A short **text** reading of their handwriting on that page
- One image — that page, or the region they selected — **switchable off**
- The last few messages in that conversation
- The subject name, and up to three remembered topic labels if memory is on

That is all. Not the document. Not the library. Not the other pages.

## What is not collected at all

No account. No email. No name (unless the student types one for the header on
their own exported PDF, which is stored only on the device). No advertising
identifier. No analytics service. No crash reporter. No device identifier that
survives a reinstall.

The single identifier that exists is an anonymous device token used for rate
limiting — see [`security.md`](security.md#device-tokens).

## Controls, and where they are

| Setting | Default | Effect |
|---|---|---|
| Send a picture of the page | On | Off means text only. Diagrams and graphs stop working; everything else still does. |
| Remember topics I find hard | **Off** | Opt-in. Stores topic labels and counts, on-device. |
| Forget everything remembered | — | Immediate, no soft delete. |
| Erase study history | — | Removes recorded study time. Does not touch work. |
| Speak answers out loud | On | Off means no text is sent for speech. |

Two of these deserve comment.

**Memory is off by default.** It is opt-in rather than opt-out because the
subject is a child's difficulties, and the honest default for that is "don't".
What it stores is a topic label and a count per subject — nothing the student
wrote, because their own words could contain anything. `StudyMemory` enforces
this: the label comes from the server alongside a reply, never from student text.

**Nothing is silently retained on the server.** The proxy is a pipe. It logs
failure codes, not content — not worksheet text, not questions, not replies.

## Deletion

- Deleting a document is a **soft delete**. It stays recoverable in Recently
  Deleted for 30 days, then the record and the PDF file are both removed. "I
  deleted the wrong worksheet the night before it was due" is a real event.
- Deleting a document cascades to its ink, its conversations and its tutor
  messages.
- Deleting the app removes everything, including the Keychain token.

## Age and context

The intended user is a school student, often a minor. Two consequences are built
in rather than promised:

1. The teaching policy lives in one auditable file
   (`server/src/prompt.js`) that a parent, teacher or school can read in full.
   It can be changed without an app release.
2. The tutor can only produce text. It cannot modify the student's work, delete
   anything, submit anything, or send anything anywhere. Submission always
   requires the student to complete the system share sheet themselves.

## For schools

Anyone deploying this for a class should read
[`security.md`](security.md#deployment-checklist) and note that the upstream
model provider's own data-handling terms apply to what is sent — one page of
text and at most one page image per question. Nothing in this app changes those
terms, and this document does not attempt to summarise them.
