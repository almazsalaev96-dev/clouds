# Study Desk proxy

The server exists so the iPad app never holds an API key. It also holds the
teaching policy, in one auditable file.

Zero npm dependencies. Node 20+.

```bash
cp .env.example .env      # add ANTHROPIC_API_KEY and ELEVENLABS_API_KEY
npm test                  # 80 tests, no network needed
npm run dev               # http://localhost:8787
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/healthz` | Liveness, and which upstreams are configured |
| `POST` | `/v1/session/register` | Issue an anonymous device token |
| `POST` | `/v1/tutor/message` | Stream a tutor reply as SSE |
| `POST` | `/v1/voice/speak` | Stream MP3 speech |

Both streaming endpoints need `Authorization: Bearer <token>`.

### `POST /v1/tutor/message`

```json
{
  "context": {
    "document": { "title": "Quadratics", "subject": "Mathematics",
                  "pageNumber": 7, "pageCount": 18 },
    "printedText": "Question 4\nSolve 2x + 5 = 15",
    "studentWork": "x = 4",
    "detectedQuestion": "Question 4",
    "mode": "check",
    "examMode": false,
    "allowFullSolutions": true,
    "recentTurns": [{ "role": "student", "text": "I don't get this." }],
    "strugglingWith": ["completing the square"]
  },
  "attachments": [
    { "kind": "page", "mediaType": "image/jpeg", "data": "<base64>" }
  ]
}
```

Responds `text/event-stream`:

```
event: verdict
data: {"verdict":"mostlyCorrect"}

event: delta
data: {"text":"You've got the right value, but check "}

event: done
data: {}
```

Once the stream is open the status code is already sent, so a later failure
arrives as `event: error` with a message written for a student — never a status
code or an upstream error.

### `POST /v1/voice/speak`

```json
{ "text": "Substitute x = 4 back into the equation.", "speed": 1.0 }
```

Responds `audio/mpeg`, streamed. The voice id and model are server-side, so the
tutor's voice can change without an app release.

## Files

| File | Job |
|---|---|
| `config.js` | Environment, with a validator that refuses to start on a real misconfiguration |
| `tokens.js` | Stateless HMAC device tokens |
| `rateLimit.js` | Token bucket, continuous refill |
| `validate.js` | Treats every request as hostile |
| **`prompt.js`** | **The teaching policy.** Worth reading in full |
| `anthropic.js` | Upstream streaming, verdict extraction |
| `elevenlabs.js` | Speech, text preparation, voice settings |
| `router.js` | Four routes |
| `server.js` | `node:http`, body limits, shutdown |

## Tests

```
npm test        # 80 tests
```

`test/stream.test.js` is the one that matters: it stands up a fake upstream
speaking the Messages API's SSE dialect and drives a real request through auth,
validation, prompt building, streaming and verdict extraction — including a
`VERDICT:` marker arriving split across several tokens, which is the failure most
likely to reach a student as a reply beginning "VERDICT: correct".

## Deployment

See [`../docs/security.md`](../docs/security.md#deployment-checklist). The short
version: set `TOKEN_SECRET`, set `NODE_ENV=production`, terminate TLS in front,
and turn off proxy buffering for `/v1/`.
