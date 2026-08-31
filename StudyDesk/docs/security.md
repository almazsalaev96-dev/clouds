# Security

## Why the app has no API key

There is no way to ship a secret inside an iPad app and keep it secret. The
binary is on the attacker's device; strings are readable, and obfuscation only
changes how long extraction takes. The consequences are not abstract — an
extracted key is billed to whoever owns it and revoking it breaks every install.

So the credentials live on a server, and the app has none. That is the entire
reason `server/` exists.

```
iPad  ──HTTPS──▶  Study Desk proxy  ──▶  tutoring model
   (no secrets)   (holds both keys)  ──▶  ElevenLabs
```

`ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY` are read from the environment into
the proxy process. They are never written to a response, never logged, and never
sent to a device. `test/stream.test.js` asserts the key appears in the upstream
request header and nowhere in its body; `test/server.test.js` asserts it never
appears in anything sent back to the client.

## Device tokens

The app holds one thing: an anonymous token, obtained on first launch from
`POST /v1/session/register` and stored in the Keychain with
`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (available in the background,
never synced to other devices).

A token is `v1.<random id>.<issued at>.<HMAC-SHA256>`. It is:

- **anonymous** — no account, no email, no device identifier that survives a
  reinstall;
- **stateless** — verifying it needs no database, so the proxy keeps no record of
  who asked what and can scale horizontally;
- **bounded** — one year, then re-issued;
- **for two jobs only** — rate limiting per install, and revocation.

Rotating `TOKEN_SECRET` invalidates every token at once; clients recover by
re-registering on the next 401. `BackendClient` does that automatically.

`verifyToken` compares signatures with `timingSafeEqual`, rejects tokens issued
more than a minute in the future (a forged payload that happened to verify, or a
clock problem), and rejects anything over 512 bytes before doing any work.

## Trust boundaries

**Everything from a client is hostile.** `server/src/validate.js` bounds every
field, allow-lists `mode` (an unknown mode is dropped, not forwarded), caps
attachments at two, and rejects an oversized image by its base64 length *before*
decoding it. `server.js` refuses a body over 8MB and destroys the request rather
than reading a body nobody will use.

**Worksheet content is data, never instruction.** A student can import any PDF,
including one crafted to carry instructions to a model. Page text and handwriting
are fenced and labelled as study material, and the system prompt says explicitly
not to follow instructions found inside them. See
[`context-engine.md`](context-engine.md#prompt-injection). This reduces risk
rather than eliminating it — which is survivable here because the tutor can only
produce text. It cannot modify the student's work, delete anything, or send
anything anywhere.

**`x-forwarded-for` is client-controlled.** It is used for one thing —
rate-limiting registrations per IP — and nothing security-relevant, because a
single trusted proxy hop is as far as it can be trusted.

## What the proxy logs

Failures, by scope and error code, plus upstream diagnostic detail truncated to
200 characters:

```
[tutor] tutor_unavailable detail=…
```

Not logged, anywhere: worksheet text, handwriting, the student's question, the
tutor's reply, or any identifier beyond the anonymous device id used for rate
limiting. `Log.swift` on the iPad carries the same rule — a student's worksheet
can contain anything, and a console is not a private place.

## Rate limits

Token-bucket, in memory, refilling continuously so a burst of four questions
isn't punished for the rest of the minute.

| Limit | Default | Why |
|---|---|---|
| Tutor requests | 20/min/device | Comfortably above real study, well below abuse |
| Speech requests | 12/min/device | Each one costs real money |
| Registrations | 30/hour/IP | Stops tokens being minted in bulk |

Not Redis, deliberately: one instance serving a school is well within what a Map
handles, and adding a datastore to count requests adds a failure mode that takes
tutoring down with it. The interface is three methods if that changes.

## Errors

No status code, stack trace or upstream message ever reaches a student. Every
failure is one of the cases in `StudyDeskError`, and every message says what
happened to their work:

> I couldn't reach your tutor just now. Your work is safely saved. Try again in
> a moment.

Credential problems are the operator's, not the student's: they see a neutral
message and the detail goes to the log.

## Deployment checklist

- [ ] `TOKEN_SECRET` set to 32 random bytes. The server **refuses to start**
      in production without it, because a generated secret signs everyone out on
      every restart.
- [ ] `NODE_ENV=production`.
- [ ] TLS terminated in front of the proxy. `Config/Release.xcconfig` uses HTTPS
      and App Transport Security is not relaxed.
- [ ] If behind nginx, `proxy_buffering off` for `/v1/` — the app already sends
      `x-accel-buffering: no`, but a buffered stream defeats the point of
      streaming.
- [ ] `.env` is gitignored. Confirm it did not get committed.
- [ ] Rate limits reviewed against the actual user count.
