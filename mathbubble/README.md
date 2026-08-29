# MathBubble

A floating circle that sits on top of your maths.

You write on the page with your Apple Pencil (or a finger, or a mouse). When you
get stuck you **tap the bubble, shade over the question**, and the app sends a
clean crop of exactly that part of your work to a tutor powered by Claude. The
tutor reads your handwriting, finds the first line that goes wrong, and nudges
you forward instead of just handing over the answer.

Built for iPad first: full-screen, pencil pressure, palm rejection, pinch to
zoom, works offline apart from the asking.

---

## It runs in the browser

There is nothing to install on the iPad. MathBubble is a web page — you open a
URL in Safari and use it. Pick one of two ways to put it at a URL.

### A. No server: static hosting

The app can talk to Anthropic straight from the browser, so it works as plain
static files. The included workflow publishes `mathbubble/public` to GitHub
Pages and turns Pages on by itself, giving you an HTTPS URL like
`https://<you>.github.io/clouds/`.

It only runs on the repository's **default branch** — GitHub accepts Pages
deployments from nowhere else — so this branch has to be merged there first.
Note that this repository currently has no `main`: its default branch is
`claude/business-a-level-prep-bsbmuu`. Either merge into that, or create `main`
from this branch and set it as the default under **Settings → Branches**.

Any static host works the same way — Netlify, Cloudflare Pages, or a folder on
a web server. Paths are relative, so it can live at a sub-path.

The trade-off: with no server there is nowhere to keep a secret, so **each
person pastes their own Anthropic API key into Settings** (it stays in their
browser and goes straight to Anthropic). Fine for you or a few people; awkward
for thirty students.

It cannot be opened as a `file://` page — browsers block ES modules there. It
needs to be served from a URL, which is what the above does.

### B. With the server: one shared key

```bash
cd mathbubble
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Open <http://localhost:5173>, or the machine's LAN address from the iPad. Now
**students need no key of their own** — the server holds it and proxies for
them, so usage lands on one bill you can see.

Deploy the same thing to any host that runs a Node process (Render, Railway,
Fly.io, a small VPS): no build step, no dependencies, no database — just
`node server/server.js`.

One caution for a class: a public URL backed by your key means anyone who finds
it can spend your credits. Keep it on the school network, or put a passcode in
front of it.

Over plain HTTP on a LAN address, offline caching is off — browsers only allow
service workers on HTTPS or localhost. Everything else still works.

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Server-side key, so students need none |
| `PORT` | `5173` | Port to listen on |
| `MATHBUBBLE_MODEL` | `claude-sonnet-5` | Default model offered to clients |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Point at a gateway instead |

## Put it on the home screen

On the iPad, open the URL in Safari and choose **Share → Add to Home Screen**.
It then launches full-screen with no browser chrome, which is the way to use
it. Over HTTPS that also caches the app, so the canvas, your pages and your
tools keep working with no connection — only asking the tutor needs one.

## How students use it

| Gesture | What happens |
| --- | --- |
| Write anywhere | Draws. Apple Pencil pressure changes the line weight |
| **Tap the bubble** | Shade mode — drag over the question you're stuck on, then **Ask** |
| **Hold the bubble** | Menu: whole page, add a photo, or just chat |
| **Drag the bubble** | Moves it; it snaps to the nearest side and stays there |
| Two fingers | Pan and pinch-zoom, even mid-sentence |
| Tap pen/highlighter twice | Colour and thickness |
| Camera button | Photograph a worksheet, then write straight on top of it |

The chat has one-tap follow-ups — *Hint*, *Next step*, *Check my working*,
*Why?*, *Full solution*, *Similar question* — so a stuck student never has to
type a good question to get one answered.

## Settings that matter for a class

- **Level** — primary through university. It changes the vocabulary and the
  methods the tutor is allowed to reach for.
- **Teaching style** — *Guided* holds the answer back and asks questions,
  *Balanced* explains one step at a time, *Direct* works the whole thing.
  Guided is the default; it is the one that makes students better.
- **Pencil only** — ignores fingers while drawing, so a resting palm leaves no
  marks. Turns on automatically once a real Pencil is detected.
- **Dark paper** — for evenings. Crops sent to the tutor are always rendered
  dark-on-white, so legibility never depends on the theme.

## What is sent where

Everything you write stays on the device, in IndexedDB. Only the crop you shade
plus that conversation's messages go to Anthropic, and only when you ask. There
are no accounts, no analytics, and no third-party requests — KaTeX and the fonts
are served from this app, not a CDN.

## Layout

```
server/server.js       static host + streaming /api/chat proxy (no dependencies)
.github/workflows/     publishes public/ to GitHub Pages on push to main
public/index.html      the whole UI
public/js/board.js     canvas: strokes, pressure, pan/zoom, undo, PNG capture
public/js/bubble.js    the floating circle: tap / hold / drag
public/js/shade.js     shade-to-select, and the crop it produces
public/js/chat.js      tutor prompt, streaming, message list
public/js/render.js    Markdown subset + KaTeX
public/js/api.js       server proxy, with a bring-your-own-key fallback
public/js/store.js     IndexedDB pages, localStorage preferences
tools/make-icons.mjs   generates the PNG app icons
```

## Honest limits

- A web app cannot float over *other* iPad apps or read another app's screen —
  iOS has no API for that at any price. The bubble floats over **your work in
  this app**, which is why the app includes its own writing canvas and a
  "photograph the worksheet" route for printed questions.
- Handwriting recognition is the model's, not a separate OCR pass. Messy digits
  can be misread; the tutor is told to say what it read when a symbol is
  ambiguous.
- The tutor can be wrong. It is a study partner, not a marker.
