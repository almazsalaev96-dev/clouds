# Privacy

A student's schoolwork is a record of what they find hard, written in their own hand,
often with their name at the top. This document is what the code actually does with it.

---

## Where things live

| Data | Location | Leaves the device? |
|---|---|---|
| Documents, ink, annotations, versions | Device | Only when the student exports or shares |
| The learning event log and everything derived from it | Device | **Never** |
| Mastery, weaknesses, mistakes, study plans | Device, recomputed from the log | **Never** |
| The specific question and working being asked about | Device → gateway → model | Yes, when the student asks |
| Speech | Device → gateway → voice provider | Yes, when the student asks it to speak |

The learning model — the most sensitive thing here, because it is a record of a child's
difficulties over time — never leaves the device. There is no server-side profile,
because there is no server-side account.

---

## What goes to the model, and what does not

The Context Engine assembles the smallest set of facts that makes a question answerable
(`docs/ARCHITECTURE.md` §5), then **redacts** it. The gateway applies the same redaction
again, because the client is not trusted to have been careful:

- email addresses, telephone numbers, postcodes, URLs
- runs of nine or more digits, which is the shape of a student number, a card number or
  a national identifier
- any name the app was told to strip: the student's, their teacher's, their school's

What is *not* sent: the event log, mastery history, previous test results, other
documents, or anything from another subject. The only profile information that crosses
the boundary is a line like `Completing the square: getting there` for the concepts the
current question is tagged with — no dates, no scores, no history, nothing that could be
reassembled into a record of a child.

The gateway logs request timings, status codes and byte counts. It does **not** log
prompts, answers, page content, or credentials; the scrubber in `server/src/util/log.ts`
enforces that by name rather than by convention.

---

## Credentials

The iPad holds no provider credentials and cannot, because it never talks to a provider.
It talks to the gateway; the gateway holds the keys in environment variables.

```
iPad ──TLS──▶ Slate Gateway ──▶ model provider
                    └─────────▶ voice provider
```

In production the gateway requires a shared token from the app and refuses to start
without one. A device identifier exists so that one iPad's rate limit does not affect
another's; it is a random UUID generated on first launch, stored locally, never synced,
and attached to no name.

---

## Control

- **Deleting works.** The event log is append-only, but redaction is itself an event.
  Deleting a document, a session or a subject records a tombstone, and every projection
  is *recomputed* from what remains. The mastery scores built on deleted evidence do not
  linger, because they were never stored in the first place.
- **Exporting works.** Documents are standard PDFs, notes are JSON, the log is
  newline-delimited JSON. Nothing is in a proprietary format and nothing is held hostage.
- **The original is never modified.** Not on import, not on export, not on submission.

---

## What is deliberately absent

- No analytics SDK, no crash reporter that uploads page content, no advertising
  identifier, no third-party network calls beyond the gateway.
- No background modes, no location, no push, no iCloud entitlement. The entitlements
  file is empty, which is the honest version of a privacy policy.
- No streaks, no notifications engineered around loss aversion, no leaderboard. These
  are privacy questions as much as design ones: each one is a reason to collect
  something.
