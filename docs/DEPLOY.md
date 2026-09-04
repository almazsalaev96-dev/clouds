# Deploying, and where the API key goes

The short version: **the key goes in the deployment's environment variables, and
nowhere else.** There is no field anywhere in the app that accepts one, and if you
paste one into the access-code box the app refuses it and tells you where it
belongs.

That is not caution for its own sake. A key held in a web page is readable in the
page source, in browser storage, and in the network tab of anyone using that
device — putting one there does not risk publishing it, it *is* publishing it, and
the only remedy afterwards is rotation.

---

## What is deployed

One Vercel project serves two things from the same origin:

```
web/dist/index.html   the whole app — marking, memory model, diagnostics, ink
api/gateway.ts        the gateway from server/, as one function
```

Because they share an origin, the page calls `/v1/tutor` directly. Nothing has to
be configured in the app, there is no CORS, and the browser never learns anything
about your credentials.

```
 iPad ──── https ────▶  index.html          (no key, no secret, no account)
   │
   └────── /v1/tutor ─▶  api/gateway.ts ──── https ──▶ Anthropic
                          ▲
                          └── ANTHROPIC_API_KEY, read only here
```

## Environment variables

Vercel → your project → **Settings → Environment Variables**. Add these, then
redeploy.

| Variable | Required | What it is |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Your key from console.anthropic.com. Read only by the function. |
| `SLATE_APP_TOKEN` | yes in production | A long random string **you** invent. Callers must present it. Without it the gateway refuses to start, because a public deployment with your key behind it is a billing hole. |
| `ELEVENLABS_API_KEY` | no | Enables spoken replies. Omit it and voice is simply absent. |
| `SLATE_EFFORT` | no | `low`–`max`, default `high`. Drop to `medium` if answers ever hit the function's time limit. |
| `SLATE_MODEL` | no | Defaults to `claude-opus-5`. `SLATE_MODEL_TUTOR`, `SLATE_MODEL_CHECK` and so on override per task. |
| `SLATE_RPM` | no | Requests per minute per caller, default 60. |
| `SLATE_MAX_OUTPUT_TOKENS` | no | Default 16000. |

Then open the app, go to **Settings → Tutor**, and enter the same
`SLATE_APP_TOKEN` value as the access code. The status line turns to *Tutor
connected*.

### The access code is not your API key

They are different things and the app treats them differently:

|  | API key | Access code |
|---|---|---|
| Where it lives | the server's environment, only | your device, and the server's environment |
| What it can do | spend money on your Anthropic account | ask *your* gateway a question |
| If it leaks | rotate it in the Anthropic Console, immediately | change `SLATE_APP_TOKEN` and redeploy |
| Can the app store it | **no — it is refused** | yes |

## Without a key

Everything except the tutor's own words keeps working, offline and unchanged:
marking and near-miss diagnosis, the mastery and forgetting model, adaptive
diagnostics, mistake analysis, document analysis, and every rung of written help.
The app says which one you are getting rather than blurring the difference.

## Checking it worked

```bash
curl https://<your-deployment>/health
# {"status":"ok","ai":"anthropic","voice":"unavailable",
#  "environment":"production","requiresToken":true}
```

`requiresToken` is deliberately public: it is the one thing a client must know
before it can ask anything, and hiding it turns a solvable setup step into an
unexplained 401.

If it answers `503 notConfigured`, the function is deployed but has no
`ANTHROPIC_API_KEY` yet — the body says so in as many words.

## Cost, plainly

Every tutor reply is a paid API call on your account. The gateway limits requests
per caller per minute (`SLATE_RPM`) and caps output tokens, and `SLATE_APP_TOKEN`
decides who may call at all — but the bill is yours. If you share the link,
share the access code only with people whose questions you are willing to pay for.
