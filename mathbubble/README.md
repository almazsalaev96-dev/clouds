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

## Run it

```bash
cd mathbubble
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Open <http://localhost:5173>.

The API key is optional. Without it the app still runs, and each student pastes
their own key into Settings (stored in their browser, sent straight to
Anthropic). With it, students need no key at all — which is what you want for a
class.

Useful environment variables:

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Server-side key, so students need none |
| `PORT` | `5173` | Port to listen on |
| `MATHBUBBLE_MODEL` | `claude-sonnet-5` | Default model offered to clients |

## Put it on an iPad

1. Run the server on a machine on the same Wi-Fi (or deploy it anywhere that
   serves `public/` and proxies `/api/chat`).
2. On the iPad, open `http://<that-machine>:5173` in Safari.
3. **Share → Add to Home Screen.** It then launches full-screen with no browser
   chrome, which is the way to use it.

Add-to-Home-Screen also makes the page work offline: the canvas, your pages and
your tools are cached. Only asking the tutor needs a connection.

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
