# StudyBubble

A floating circle that sits on top of your work.

You write on the page with your Apple Pencil (or a finger, or a mouse), on
whatever subject you're studying. When you get stuck you **tap the bubble,
shade over the question**, and the app sends a clean crop of exactly that part
of your work to a tutor powered by Claude. The tutor reads your handwriting,
finds the first point that needs fixing, and nudges you forward instead of
just handing over the answer.

Not just maths: set the subject in Settings, or leave it on **Auto** and the
tutor works out from the page whether it's maths, physics, an essay, a
language exercise, or anything else — and adapts its formatting, vocabulary
and marking eye to match.

Built for iPad first: full-screen, pencil pressure and hover, palm rejection,
pinch to zoom, works offline apart from the asking. (The code still lives in
a folder named `mathbubble/` — that's a historical, internal detail; nothing
user-facing says "math" anymore.)

---

## It runs in the browser

There is nothing to install on the iPad. StudyBubble is a web page — you open
a URL in Safari and use it. Pick one of two ways to put it at a URL.

### A. No server: static hosting

The app can talk to Anthropic straight from the browser, so it works as plain
static files. The included workflow publishes `mathbubble/public` to GitHub
Pages and turns Pages on for the run itself — the one thing it can't do by
itself is the very first time Pages is switched on for a repository, which
needs a human with repo access, once: **Settings → Pages → Source: GitHub
Actions**. After that, every push updates the same URL automatically.

It runs from this branch directly — Actions-based Pages deployment has no
default-branch requirement, so nothing needs merging anywhere first.

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
| `ANTHROPIC_WORKSPACE_ID` | — | Only for keys tied to more than one workspace (Settings has the same field for a personal key) |

## Put it on the home screen

On the iPad, open the URL in Safari and choose **Share → Add to Home Screen**.
It then launches full-screen with no browser chrome, which is the way to use
it. Over HTTPS that also caches the app, so the canvas, your pages and your
tools keep working with no connection — only asking the tutor needs one.

## How students use it

| Gesture | What happens |
| --- | --- |
| Write anywhere | Draws. Apple Pencil pressure changes the line weight, and a hover ring previews size/colour before the tip touches down |
| **Tap the bubble** | Shade mode — drag over the question you're stuck on, then **Ask** |
| **Hold the bubble** | Menu: whole page, add material, or just chat |
| **Drag the bubble** | Moves it; it snaps to the nearest side and stays there |
| Two fingers | Pan and pinch-zoom, even mid-sentence |
| Tap pen/highlighter twice | Colour and thickness |
| **Attach icon** (toolbar) | Photo, PDF, or Paste — see below |

The chat has one-tap follow-ups — *Hint*, *Next step*, *Check my working*,
*Why?*, *Full solution*, *Similar question* — so a stuck student never has to
type a good question to get one answered.

## Getting material onto the page

The attach icon in the toolbar (and the bubble's hold menu) offer three ways
in, besides just writing:

- **Photo** — camera or photo library. One image, fitted to the page.
- **PDF** — a past paper, a worksheet, a textbook chapter. Every page of the
  PDF is rendered client-side (via a vendored copy of pdf.js — nothing is
  uploaded anywhere just to open it) into its own page in the app, at a
  resolution that keeps small print legible. Write directly on the real
  document instead of a single flattened screenshot of it; flip between pages
  with the arrows at the top. A blank current page is replaced by the import;
  a page you've already written on is kept, and the PDF's pages land after it.
- **Paste** — pulls an image straight off the system clipboard. This is the
  route for a question that's already open in another app: Teams, a PDF
  viewer, anywhere. Screenshot it there (or use that app's own Copy), switch
  to StudyBubble, tap Paste. See **Honest limits** below for why this exists
  instead of the bubble simply appearing inside that other app.

## Settings that matter for a class

- **Subject** — Auto by default (the tutor reads it off the page); set one
  explicitly if you'd rather be specific than let it infer.
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

Everything you write stays on the device, in IndexedDB — PDF pages included,
rendered locally and never uploaded. Only the crop you shade plus that
conversation's messages go to Anthropic, and only when you ask. There are no
accounts, no analytics, and no third-party requests — KaTeX, pdf.js and their
fonts/workers are all served from this app, not a CDN.

## Layout

```
server/server.js       static host + streaming /api/chat proxy (no dependencies)
.github/workflows/     publishes public/ to GitHub Pages on every push
public/index.html      the whole UI
public/js/board.js     canvas: strokes, pressure, pan/zoom, undo, PNG capture
public/js/bubble.js    the floating circle: tap / hold / drag
public/js/shade.js     shade-to-select, and the crop it produces
public/js/chat.js      tutor prompt (subject/level/style-aware), streaming, message list
public/js/render.js    Markdown subset + KaTeX
public/js/api.js       server proxy, with a bring-your-own-key fallback
public/js/pdfimport.js PDF → one page image per PDF page, via pdf.js
public/js/store.js     IndexedDB pages, localStorage preferences
tools/make-icons.mjs   generates the PNG app icons
```

## Honest limits

- No app on iPad — a web app, or any native app, this one included — can draw
  on top of *another* app's screen or read what's inside it. iOS has no API
  for that at any price, for anyone. So the bubble can't "sit on" an
  assignment that's open in Teams, a PDF viewer, or anywhere else; **Paste**
  and **PDF import** (above) are the bridge — get the material into this app,
  properly, once, and write on it directly from then on.
- Handwriting recognition is the model's, not a separate OCR pass. Messy
  writing can be misread; the tutor is told to say what it read when
  something is ambiguous.
- Turning GitHub Pages on for a repository the very first time needs a human
  in the Settings UI — no amount of automation can do that one step (see
  above). Everything after that is automatic.
- The tutor can be wrong. It is a study partner, not a marker.
