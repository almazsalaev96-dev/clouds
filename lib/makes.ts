/**
 * Things you can make.
 *
 * Creative's answer to "build me a timetable" used to be a description of a
 * timetable. These are the real thing: a folder that runs, with motion,
 * keyboard support, light and dark, and a shape a model can fill in.
 *
 * Every one is built the same way, and the shape is the point. The top of
 * `app.js` is a plain list of data with a rule above it saying so; everything
 * below is machinery nobody has to read. Asking for "cards for Spanish verbs"
 * is then an edit to six lines, not a rewrite — which is the difference
 * between a starting point and a thing you have to argue with.
 *
 * Two constraints they all obey, and both are the sandbox rather than taste:
 *
 *  - No `localStorage`. The preview runs on an opaque origin, so touching
 *    storage throws. The file *is* the storage: change the data, keep the
 *    version, and the state is saved the same way the rest of the app saves.
 *  - No network. A folder that reaches a CDN stops working the moment it is
 *    saved and opened somewhere else, and these are meant to be portable.
 */

import { ENTRY } from "./web";

export interface Make {
  id: string;
  name: string;
  blurb: string;
  /** Named here, resolved to a component where the icons live. */
  icon: string;
  /** What the canvas is called when you make one. */
  title: string;
  /** The half-sentence the composer offers, for filling it with your material. */
  ask: string;
  files: () => { name: string; lang: string; content: string }[];
}

/* The tokens every make starts from. Small deliberately: each of these is a
   folder somebody can save and take away, so it carries its own palette
   rather than importing a runtime that only exists inside this app. */
const TOKENS = `/* Tokens. Every one of these is a knob: change a value here and the whole
   thing follows. Light and dark are both defined, so it matches whatever the
   reader's system is set to without anyone choosing. */
:root {
  color-scheme: light dark;
  --bg: #f7f3ea;
  --card: #fffdf9;
  --ink: #1a2650;
  --muted: #5d6580;
  --faint: #8b93a8;
  --line: #e4ddcd;
  --accent: #3450b5;
  --gold: #a8801f;
  --good: #2f7d55;
  --bad: #b3402f;
  --r: 14px;
  --dur: 0.22s;
  --ease: cubic-bezier(0.2, 0.7, 0.3, 1);
}

/* Dark, twice.

   The media query is the reader's own machine, which is the right answer once
   this folder is saved and opened somewhere else. The attribute is whatever is
   asking to show it — Armi stamps data-theme on the root while it is in the
   preview, so the page matches the app around it instead of sitting in a lit
   window inside a dark room. Guarding the query with :not([data-theme="light"])
   is what lets an explicit light choice win over a dark system. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #1a1917; --card: #232220; --ink: #f2efe9; --muted: #a8a49c; --faint: #7d7973; --line: #35322d; --accent: #aab9ff; --gold: #d9b45a; --good: #6fd1a0; --bad: #ff9d8f; }
}
:root[data-theme="dark"] { --bg: #1a1917; --card: #232220; --ink: #f2efe9; --muted: #a8a49c; --faint: #7d7973; --line: #35322d; --accent: #aab9ff; --gold: #d9b45a; --good: #6fd1a0; --bad: #ff9d8f; }
:root[data-theme="dark"] { color-scheme: dark; }
:root[data-theme="light"] { color-scheme: light; }

/* Motion is decoration. Anyone who has asked their system to stop it gets a
   version that still works and no longer moves. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

* { box-sizing: border-box; }

/* The hidden attribute is a display:none in the browser's own stylesheet, so
   any rule of yours that sets display beats it and the element stays on
   screen — looking empty, still catching every click aimed at what is behind
   it. This one line is what makes hidden mean hidden. */
[hidden] { display: none !important; }

body {
  margin: 0;
  min-height: 100vh;
  padding: max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom));
  background: var(--bg);
  color: var(--ink);
  font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Every control is at least 44px in its smallest dimension: the size of a
   fingertip, which is what most of these will be used with. */
button {
  min-height: 44px;
  font: inherit;
  color: inherit;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--card);
  cursor: pointer;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
button:hover { border-color: color-mix(in srgb, var(--ink) 25%, transparent); }
button:active { transform: scale(0.97); }

/* Centred in whatever height it is given.
   These are made in a panel a few hundred pixels tall and then used on a whole
   screen, and a page that only knows how to start at the top leaves the thing
   you are using stranded in a corner with half a window of nothing under it.
   "safe" is the important half: when the content is taller than the window it
   goes back to starting at the top, rather than centring and cutting the first
   lines off where nothing can scroll to them. */
body { display: grid; align-content: safe center; justify-items: center; }

.wrap { width: 100%; max-width: 720px; margin: 0 auto; }

h1 {
  margin: 0 0 2px;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.sub { margin: 0 0 20px; color: var(--muted); font-size: 0.86rem; }
`;

export const MAKES: Make[] = [
  {
    id: "flashcards",
    name: "Flashcards",
    blurb: "A deck that flips. Space, arrows, again-later.",
    icon: "Sparkles",
    title: "Flashcards",
    ask: "Fill this deck with cards for ",
    files: () => [
      { name: ENTRY, lang: "html", content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Flashcards</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="wrap">
      <h1 id="deck-title">Flashcards</h1>
      <p class="sub">Space flips. Left and right move. Or use the buttons.</p>

      <div class="bar" aria-hidden="true"><span id="bar"></span></div>
      <p class="count"><span id="pos">1</span> of <span id="total">1</span><span id="again-note"></span></p>

      <div class="stage">
        <button class="card" id="card" aria-live="polite">
          <span class="face front"><span id="front"></span></span>
          <span class="face back"><span id="back"></span></span>
        </button>
      </div>

      <div class="row">
        <button id="prev" aria-label="Previous card">&#8592;</button>
        <button id="again" class="wide">Again</button>
        <button id="got" class="wide primary">Got it</button>
        <button id="next" aria-label="Next card">&#8594;</button>
      </div>

      <div class="done" id="done" hidden>
        <p class="big">Deck finished</p>
        <p class="sub" id="done-line"></p>
        <button id="restart" class="wide primary">Go again</button>
      </div>
    </main>
    <script src="app.js"></script>
  </body>
</html>
` },
      { name: "style.css", lang: "css", content: TOKENS + `
/* A card, not a billboard. At the full 720px the 8:5 face was 450px tall with
   one word in the middle of it, which reads as a page that has lost something
   rather than as a card you are about to turn over. */
.wrap { max-width: 520px; }

.bar {
  height: 4px;
  border-radius: 999px;
  background: var(--line);
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  width: 0;
  border-radius: 999px;
  background: var(--accent);
  transition: width 0.4s var(--ease);
}

.count {
  margin: 8px 0 16px;
  color: var(--faint);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}
.count b { color: var(--gold); font-weight: 600; }

/* The stage owns the perspective, so the card turns in depth rather than
   squashing flat the way a plain scaleX would. */
.stage { perspective: 1400px; }

.card {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 8 / 5;
  padding: 0;
  border: 0;
  background: none;
  transform-style: preserve-3d;
  transition: transform 0.55s var(--ease);
}
.card.flipped { transform: rotateY(180deg); }

/* The card enters from the side it came from: forward from the right, back
   from the left. Direction is information — it says which way you moved. */
.card.in-right { animation: inRight 0.32s var(--ease); }
.card.in-left { animation: inLeft 0.32s var(--ease); }
@keyframes inRight { from { opacity: 0; transform: translateX(28px); } }
@keyframes inLeft { from { opacity: 0; transform: translateX(-28px); } }

.face {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 28px;
  text-align: center;
  border: 1px solid var(--line);
  border-radius: var(--r);
  background: var(--card);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px -12px rgba(0, 0, 0, 0.18);
  backface-visibility: hidden;
  font-size: clamp(1.1rem, 4vw, 1.6rem);
  line-height: 1.35;
}
.face.back {
  transform: rotateY(180deg);
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--line));
}

.row {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.row button { flex: 0 0 auto; width: 44px; }
.row .wide { flex: 1 1 0; width: auto; padding: 0 12px; }
.row .primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
  font-weight: 500;
}

.done { text-align: center; padding: 40px 0; animation: rise 0.4s var(--ease); }
@keyframes rise { from { opacity: 0; transform: translateY(10px); } }
.big { margin: 0 0 4px; font-size: 1.5rem; font-weight: 600; }
.done .wide { padding: 0 22px; }

@media (max-width: 420px) {
  .row { flex-wrap: wrap; }
  .row .wide { flex: 1 1 40%; }
}
` },
      { name: "app.js", lang: "js", content: `/* ------------------------------------------------------------------ cards --
   Your deck. Edit this list — everything below it is machinery.
   Ask for more and they land here.                                          */

const TITLE = "Spanish verbs";

const CARDS = [
  { front: "ser", back: "to be (permanent)" },
  { front: "estar", back: "to be (state, place)" },
  { front: "tener", back: "to have" },
  { front: "hacer", back: "to do, to make" },
  { front: "poder", back: "to be able to, can" },
  { front: "querer", back: "to want, to love" },
];

/* -------------------------------------------------------------- machinery -- */

const el = (id) => document.getElementById(id);
const cardEl = el("card");

/* The queue, not the deck. "Again" pushes a card back three places, so it
   returns while it is still fresh but after you have seen something else —
   which is the whole of spaced repetition that fits in a page like this. */
let queue = [];
let at = 0;
let flipped = false;
let repeats = 0;

function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

function start() {
  queue = shuffle(CARDS.map((_, i) => i));
  at = 0;
  repeats = 0;
  flipped = false;
  el("done").hidden = true;
  document.querySelector(".stage").hidden = false;
  document.querySelector(".row").hidden = false;
  render("right");
}

function render(direction) {
  if (at >= queue.length) return finish();

  const card = CARDS[queue[at]];
  flipped = false;
  cardEl.classList.remove("flipped");
  el("front").textContent = card.front;
  el("back").textContent = card.back;
  cardEl.setAttribute("aria-label", "Card " + (at + 1) + " of " + queue.length + ". " + card.front + ". Press space to see the answer.");

  el("pos").textContent = String(at + 1);
  el("total").textContent = String(queue.length);
  el("bar").style.width = ((at / queue.length) * 100) + "%";
  el("again-note").innerHTML = repeats ? " &middot; <b>" + repeats + " to see again</b>" : "";

  if (direction) {
    const cls = direction === "right" ? "in-right" : "in-left";
    cardEl.classList.remove("in-right", "in-left");
    void cardEl.offsetWidth;            // restart the animation, do not queue it
    cardEl.classList.add(cls);
  }
}

function flip() {
  flipped = !flipped;
  cardEl.classList.toggle("flipped", flipped);
}

function move(step) {
  const next = at + step;
  if (next < 0) return;
  at = next;
  render(step > 0 ? "right" : "left");
}

function again() {
  const card = queue[at];
  queue.splice(at, 1);
  queue.splice(Math.min(at + 3, queue.length), 0, card);
  repeats += 1;
  render("right");
}

function finish() {
  document.querySelector(".stage").hidden = true;
  document.querySelector(".row").hidden = true;
  el("bar").style.width = "100%";
  el("done").hidden = false;
  el("done-line").textContent = repeats
    ? queue.length + " cards, " + repeats + " of them more than once."
    : queue.length + " cards, every one first time.";
}

cardEl.addEventListener("click", flip);
el("next").addEventListener("click", () => move(1));
el("prev").addEventListener("click", () => move(-1));
el("got").addEventListener("click", () => move(1));
el("again").addEventListener("click", again);
el("restart").addEventListener("click", start);

/* The keyboard is the point on a laptop: one hand, no aiming. */
document.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
  else if (e.key === "ArrowRight") move(1);
  else if (e.key === "ArrowLeft") move(-1);
});

el("deck-title").textContent = TITLE;
document.title = TITLE;
start();
` },
    ],
  },
  {
    id: "timetable",
    name: "Timetable",
    blurb: "A week grid with a line that says where you are.",
    icon: "CalendarRange",
    title: "Week",
    ask: "Fill this timetable in with ",
    files: () => [
      { name: ENTRY, lang: "html", content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Week</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="wrap wide">
      <header class="head">
        <div>
          <h1 id="tt-title">Week</h1>
          <p class="sub" id="tt-sub">Your week at a glance. The line is now.</p>
        </div>
        <button id="today" class="ghost">Jump to today</button>
      </header>

      <div class="grid-scroll">
        <div class="grid" id="grid">
          <div class="corner"></div>
          <div class="days" id="days"></div>
          <div class="hours" id="hours"></div>
          <div class="lanes" id="lanes">
            <div class="now" id="now" hidden><span class="dot"></span><span class="rule"></span></div>
          </div>
        </div>
      </div>

      <p class="legend" id="legend"></p>
    </main>

    <div class="sheet" id="sheet" hidden>
      <div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <p class="tag" id="sheet-tag"></p>
        <h2 id="sheet-title"></h2>
        <p class="when" id="sheet-when"></p>
        <button id="sheet-close" class="ghost">Close</button>
      </div>
    </div>
    <script src="app.js"></script>
  </body>
</html>
` },
      { name: "style.css", lang: "css", content: TOKENS + `
.wrap.wide { max-width: 940px; }

.head { display: flex; align-items: flex-start; gap: 12px; }
.head .sub { margin-bottom: 16px; }
.ghost {
  margin-left: auto;
  padding: 0 14px;
  font-size: 0.82rem;
  color: var(--muted);
  background: none;
}
.ghost:hover { color: var(--ink); background: var(--card); }

/* A week does not fit on a phone, so it scrolls sideways rather than being
   squeezed until nothing is readable. The hour column stays put. */
.grid-scroll { overflow-x: auto; padding-bottom: 4px; }

.grid {
  display: grid;
  grid-template-columns: 52px 1fr;
  grid-template-rows: auto 1fr;
  min-width: 640px;
  border: 1px solid var(--line);
  border-radius: var(--r);
  background: var(--card);
  overflow: hidden;
}
.corner { border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }

.days { display: grid; border-bottom: 1px solid var(--line); }
.days span {
  padding: 9px 8px;
  font-size: 0.76rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--faint);
  text-align: center;
}
.days span.is-today { color: var(--accent); }

/* The labels are placed the same way the hour lines are — by percentage of
   the day — so a label and its line cannot drift apart. */
.hours { position: relative; border-right: 1px solid var(--line); }
.hours span {
  position: absolute;
  right: 8px;
  transform: translateY(-50%);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
  color: var(--faint);
}

.lanes { position: relative; display: grid; }
.lane { position: relative; border-right: 1px solid color-mix(in srgb, var(--line) 60%, transparent); }
.lane:last-child { border-right: 0; }
.lane.is-today { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.hourline { position: absolute; left: 0; right: 0; border-top: 1px solid color-mix(in srgb, var(--line) 60%, transparent); }

/* Each block rises into place, one after another. The stagger is what makes a
   grid of boxes read as a week rather than appear as a wall. */
.block {
  position: absolute;
  left: 3px;
  right: 3px;
  padding: 5px 7px;
  border-radius: 8px;
  border: 1px solid transparent;
  overflow: hidden;
  text-align: left;
  font-size: 0.74rem;
  line-height: 1.25;
  min-height: 0;
  animation: blockIn 0.4s var(--ease) backwards;
  transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
@keyframes blockIn { from { opacity: 0; transform: translateY(6px); } }
.block:hover { transform: translateY(-1px); box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.35); }
.block b { display: block; font-weight: 600; }
.block i { font-style: normal; opacity: 0.75; font-variant-numeric: tabular-nums; }

.now { position: absolute; left: 0; right: 0; z-index: 3; pointer-events: none; }
.now .rule { display: block; height: 2px; background: var(--gold); }
.now .dot {
  position: absolute;
  left: -4px;
  top: -3px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--gold);
}
.now .dot::after {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: 999px;
  border: 1px solid var(--gold);
  animation: ping 2.4s var(--ease) infinite;
}
@keyframes ping { 0% { opacity: 0.7; transform: scale(0.6); } 70%, 100% { opacity: 0; transform: scale(1.8); } }

.legend { margin: 14px 0 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 0.76rem; color: var(--muted); }
.legend b { display: inline-flex; align-items: center; gap: 6px; font-weight: 400; }
.legend i { width: 9px; height: 9px; border-radius: 3px; }

.sheet {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: color-mix(in srgb, var(--ink) 32%, transparent);
  animation: fade 0.18s var(--ease);
}
@keyframes fade { from { opacity: 0; } }
.sheet-card {
  width: min(340px, 100%);
  padding: 20px;
  border-radius: var(--r);
  background: var(--card);
  border: 1px solid var(--line);
  animation: pop 0.22s var(--ease);
}
@keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } }
.sheet-card h2 { margin: 2px 0 4px; font-size: 1.1rem; }
.sheet-card .tag { margin: 0; font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; }
.sheet-card .when { margin: 0 0 16px; color: var(--muted); font-size: 0.86rem; font-variant-numeric: tabular-nums; }
.sheet-card button { width: 100%; }
` },
      { name: "app.js", lang: "js", content: `/* ------------------------------------------------------------------ week --
   Your week. Edit this list — everything below it is machinery.

   day: 0 is Monday. Times are 24-hour "HH:MM".
   tag: anything you like; each one gets its own colour, in order.            */

const TITLE = "Week";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const START_HOUR = 8;
const END_HOUR = 20;
const HEIGHT = 460;   // how tall the day is, in pixels

const EVENTS = [
  { day: 0, start: "09:00", end: "10:30", title: "Linear algebra", tag: "Lecture" },
  { day: 0, start: "13:00", end: "15:00", title: "Lab", tag: "Practical" },
  { day: 1, start: "10:00", end: "11:00", title: "Stand-up", tag: "Work" },
  { day: 1, start: "16:00", end: "18:00", title: "Gym", tag: "Life" },
  { day: 2, start: "09:00", end: "10:30", title: "Linear algebra", tag: "Lecture" },
  { day: 2, start: "14:00", end: "16:30", title: "Project time", tag: "Work" },
  { day: 3, start: "11:00", end: "12:30", title: "Statistics", tag: "Lecture" },
  { day: 4, start: "09:30", end: "11:00", title: "Review", tag: "Work" },
  { day: 4, start: "18:00", end: "20:00", title: "Dinner with M", tag: "Life" },
];

const COLOURS = ["#3450b5", "#a8801f", "#2f7d55", "#7a4bbd", "#b3402f", "#1f7a86"];

/* -------------------------------------------------------------- machinery -- */

const el = (id) => document.getElementById(id);
const mins = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const span = END_HOUR * 60 - START_HOUR * 60;
const pct = (m) => ((m - START_HOUR * 60) / span) * 100;

const tags = [];
EVENTS.forEach((e) => { if (tags.indexOf(e.tag) === -1) tags.push(e.tag); });
const colourOf = (tag) => COLOURS[tags.indexOf(tag) % COLOURS.length];

/* Monday is column 0, so Sunday (getDay() === 0) is column 6. */
const todayCol = (new Date().getDay() + 6) % 7;

function build() {
  el("tt-title").textContent = TITLE;
  document.title = TITLE;

  const cols = "repeat(" + DAYS.length + ", minmax(80px, 1fr))";
  el("days").style.gridTemplateColumns = cols;
  el("lanes").style.gridTemplateColumns = cols;

  el("days").innerHTML = DAYS.map((d, i) =>
    '<span class="' + (i === todayCol ? "is-today" : "") + '">' + d + "</span>"
  ).join("");

  let hours = "";
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    hours += '<span style="top:' + pct(h * 60) + '%">' + String(h).padStart(2, "0") + ":00</span>";
  }
  el("hours").innerHTML = hours;
  el("hours").style.height = HEIGHT + "px";

  const lanes = el("lanes");
  lanes.style.height = HEIGHT + "px";
  DAYS.forEach((_, i) => {
    const lane = document.createElement("div");
    lane.className = "lane" + (i === todayCol ? " is-today" : "");
    for (let h = START_HOUR + 1; h < END_HOUR; h++) {
      const rule = document.createElement("div");
      rule.className = "hourline";
      rule.style.top = pct(h * 60) + "%";
      lane.appendChild(rule);
    }
    lanes.appendChild(lane);
  });

  const laneEls = lanes.querySelectorAll(".lane");
  EVENTS.slice()
    .sort((a, b) => mins(a.start) - mins(b.start))
    .forEach((e, i) => {
      const b = document.createElement("button");
      const colour = colourOf(e.tag);
      b.className = "block";
      b.style.top = pct(mins(e.start)) + "%";
      b.style.height = ((mins(e.end) - mins(e.start)) / span) * 100 + "%";
      b.style.background = "color-mix(in srgb, " + colour + " 16%, transparent)";
      b.style.borderColor = "color-mix(in srgb, " + colour + " 40%, transparent)";
      b.style.color = colour;
      b.style.animationDelay = i * 26 + "ms";
      b.innerHTML = "<b>" + e.title + "</b><i>" + e.start + "&ndash;" + e.end + "</i>";
      b.addEventListener("click", () => open(e));
      if (laneEls[e.day]) laneEls[e.day].appendChild(b);
    });

  el("legend").innerHTML = tags.map((t) =>
    '<b><i style="background:' + colourOf(t) + '"></i>' + t + "</b>"
  ).join("");
}

/* The line is the reason to look at this at all: it says where you are in the
   day without you having to work it out. It moves every half minute. */
function markNow() {
  const d = new Date();
  const m = d.getHours() * 60 + d.getMinutes();
  const now = el("now");
  const inside = m >= START_HOUR * 60 && m <= END_HOUR * 60;
  now.hidden = !inside;
  if (!inside) return;
  now.style.top = pct(m) + "%";
  const lane = el("lanes").children[todayCol + 1];
  if (lane) {
    now.style.left = lane.offsetLeft + "px";
    now.style.width = lane.offsetWidth + "px";
  }
}

function open(e) {
  el("sheet-tag").textContent = e.tag;
  el("sheet-tag").style.color = colourOf(e.tag);
  el("sheet-title").textContent = e.title;
  el("sheet-when").textContent = DAYS[e.day] + ", " + e.start + " to " + e.end;
  el("sheet").hidden = false;
  el("sheet-close").focus();
}
function close() { el("sheet").hidden = true; }

el("sheet-close").addEventListener("click", close);
el("sheet").addEventListener("click", (ev) => { if (ev.target === el("sheet")) close(); });
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") close(); });

el("today").addEventListener("click", () => {
  const lane = el("lanes").children[todayCol + 1];
  if (lane) lane.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
});

build();
markNow();
setInterval(markNow, 30000);
window.addEventListener("resize", markNow);
` },
    ],
  },
  {
    id: "quiz",
    name: "Quiz",
    blurb: "One question at a time, scored, with the why.",
    icon: "ListChecks",
    title: "Quiz",
    ask: "Write the questions for a quiz on ",
    files: () => [
      { name: ENTRY, lang: "html", content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Quiz</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="wrap narrow">
      <h1 id="quiz-title">Quiz</h1>
      <p class="sub">Pick one. You are told why, either way.</p>

      <div class="dots" id="dots" role="progressbar" aria-label="Progress"></div>

      <section class="q" id="q-panel">
        <p class="stem" id="stem"></p>
        <div class="options" id="options"></div>
        <p class="why" id="why" hidden></p>
        <button class="next" id="next" hidden>Next</button>
      </section>

      <section class="score" id="score" hidden>
        <svg viewBox="0 0 120 120" class="ring" aria-hidden="true">
          <circle cx="60" cy="60" r="52" class="ring-track" />
          <circle cx="60" cy="60" r="52" class="ring-fill" id="ring" />
        </svg>
        <p class="big" id="score-line"></p>
        <p class="sub" id="score-note"></p>
        <button id="again" class="next">Try again</button>
      </section>
    </main>
    <script src="app.js"></script>
  </body>
</html>
` },
      { name: "style.css", lang: "css", content: TOKENS + `
.wrap.narrow { max-width: 560px; }

.dots { display: flex; gap: 5px; margin-bottom: 22px; }
.dots i {
  flex: 1 1 0;
  height: 3px;
  border-radius: 999px;
  background: var(--line);
  transition: background 0.3s var(--ease);
}
.dots i.right { background: var(--good); }
.dots i.wrong { background: var(--bad); }
.dots i.at { background: var(--accent); }

.q { animation: qIn 0.3s var(--ease); }
@keyframes qIn { from { opacity: 0; transform: translateY(8px); } }

.stem { margin: 0 0 18px; font-size: 1.2rem; line-height: 1.4; font-weight: 500; }

.options { display: grid; gap: 8px; }
.options button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-radius: 12px;
  text-align: left;
  line-height: 1.4;
}
.options button .key {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: var(--bg);
  border: 1px solid var(--line);
  font-size: 0.72rem;
  color: var(--faint);
}
.options button:disabled { cursor: default; }

/* Never colour alone: right gets a tick, wrong gets a cross, and the wrong one
   shakes. Someone who cannot tell the two greens apart still knows. */
.options button.right {
  border-color: var(--good);
  background: color-mix(in srgb, var(--good) 12%, transparent);
  color: var(--good);
}
.options button.wrong {
  border-color: var(--bad);
  background: color-mix(in srgb, var(--bad) 12%, transparent);
  color: var(--bad);
  animation: shake 0.34s var(--ease);
}
.options button.right .key, .options button.wrong .key { border-color: currentColor; color: inherit; }
@keyframes shake {
  10%, 90% { transform: translateX(-2px); }
  30%, 70% { transform: translateX(4px); }
  50% { transform: translateX(-4px); }
}

.why {
  margin: 16px 0 0;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--card);
  color: var(--muted);
  font-size: 0.9rem;
  animation: qIn 0.3s var(--ease);
}

.next {
  width: 100%;
  margin-top: 16px;
  padding: 0 18px;
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
  font-weight: 500;
  animation: qIn 0.3s var(--ease);
}

.score { text-align: center; animation: qIn 0.35s var(--ease); }
.ring { width: 128px; height: 128px; transform: rotate(-90deg); }
.ring circle { fill: none; stroke-width: 8; stroke-linecap: round; }
.ring-track { stroke: var(--line); }
/* 2 * pi * 52, rounded — the whole circumference, drawn back as the score. */
.ring-fill {
  stroke: var(--accent);
  stroke-dasharray: 327;
  stroke-dashoffset: 327;
  transition: stroke-dashoffset 0.9s var(--ease);
}
.score .big { margin: 6px 0 2px; font-size: 1.6rem; font-weight: 600; font-variant-numeric: tabular-nums; }
` },
      { name: "app.js", lang: "js", content: `/* --------------------------------------------------------------- questions --
   Your questions. Edit this list — everything below it is machinery.
   "answer" is the index of the right option, counting from 0.               */

const TITLE = "General knowledge";

const QUESTIONS = [
  {
    q: "Which of these runs on the main thread by default?",
    options: ["A Web Worker", "A service worker", "requestAnimationFrame", "A worklet"],
    answer: 2,
    why: "rAF callbacks run on the main thread, right before the browser paints — which is exactly why long work inside one drops frames.",
  },
  {
    q: "What does CSS 'contain: layout' promise the browser?",
    options: [
      "Nothing inside affects the layout outside",
      "The element never repaints",
      "Children cannot overflow",
      "The element gets its own scrollbar",
    ],
    answer: 0,
    why: "It is a promise about scope. The browser can then lay the subtree out without reconsidering the rest of the page.",
  },
  {
    q: "In a sandboxed iframe without allow-same-origin, what happens to localStorage?",
    options: ["It works normally", "It is empty", "Reading it throws", "It falls back to memory"],
    answer: 2,
    why: "The frame is on an opaque origin, so touching storage throws a SecurityError. It is also why this page keeps its data in the file rather than in storage.",
  },
];

/* -------------------------------------------------------------- machinery -- */

const el = (id) => document.getElementById(id);
const LETTERS = ["A", "B", "C", "D", "E", "F"];

let at = 0;
let marks = [];
let locked = false;

function dots() {
  el("dots").innerHTML = QUESTIONS.map((_, i) => {
    const state = marks[i] === true ? "right" : marks[i] === false ? "wrong" : i === at ? "at" : "";
    return '<i class="' + state + '"></i>';
  }).join("");
  el("dots").setAttribute("aria-valuenow", String(at + 1));
  el("dots").setAttribute("aria-valuemax", String(QUESTIONS.length));
}

function render() {
  locked = false;
  const item = QUESTIONS[at];
  el("stem").textContent = item.q;
  el("why").hidden = true;
  el("next").hidden = true;

  el("options").innerHTML = "";
  item.options.forEach((text, i) => {
    const b = document.createElement("button");
    b.innerHTML = '<span class="key">' + LETTERS[i] + "</span><span></span>";
    b.lastChild.textContent = text;
    b.addEventListener("click", () => answer(i));
    el("options").appendChild(b);
  });

  el("q-panel").classList.remove("q");
  void el("q-panel").offsetWidth;
  el("q-panel").classList.add("q");
  dots();
}

function answer(pick) {
  if (locked) return;
  locked = true;

  const item = QUESTIONS[at];
  const buttons = el("options").querySelectorAll("button");
  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === item.answer) { b.classList.add("right"); b.querySelector(".key").textContent = "✓"; }
    else if (i === pick) { b.classList.add("wrong"); b.querySelector(".key").textContent = "×"; }
  });

  marks[at] = pick === item.answer;
  dots();

  if (item.why) { el("why").textContent = item.why; el("why").hidden = false; }
  el("next").textContent = at === QUESTIONS.length - 1 ? "See the score" : "Next";
  el("next").hidden = false;
  el("next").focus();
}

function next() {
  if (at === QUESTIONS.length - 1) return finish();
  at += 1;
  render();
}

function finish() {
  const right = marks.filter(Boolean).length;
  el("q-panel").hidden = true;
  el("score").hidden = false;
  el("score-line").textContent = right + " of " + QUESTIONS.length;
  el("score-note").textContent =
    right === QUESTIONS.length ? "Every one." : right === 0 ? "A clean sweep, the other way." : "Worth another run.";

  /* One frame's delay, or the browser applies the final offset with the
     initial one and there is nothing left to animate. */
  requestAnimationFrame(() => {
    el("ring").style.strokeDashoffset = String(327 - (right / QUESTIONS.length) * 327);
  });
}

function start() {
  at = 0;
  marks = [];
  el("score").hidden = true;
  el("q-panel").hidden = false;
  el("ring").style.strokeDashoffset = "327";
  render();
}

el("next").addEventListener("click", next);
el("again").addEventListener("click", start);

/* A, B, C… answer. Enter moves on. Nobody should have to aim to take a quiz. */
document.addEventListener("keydown", (e) => {
  if (!el("score").hidden) return;
  const i = LETTERS.indexOf(e.key.toUpperCase());
  if (i >= 0 && i < QUESTIONS[at].options.length) answer(i);
  else if (e.key === "Enter" && !el("next").hidden) next();
});

el("quiz-title").textContent = TITLE;
document.title = TITLE;
start();
` },
    ],
  },
  {
    id: "checklist",
    name: "Checklist",
    blurb: "A list that ticks, sweeps and keeps count.",
    icon: "CheckCheck",
    title: "Checklist",
    ask: "Fill this checklist in for ",
    files: () => [
      { name: ENTRY, lang: "html", content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Checklist</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="wrap narrow">
      <header class="head">
        <div>
          <h1 id="list-title">Checklist</h1>
          <p class="sub" id="list-sub">Tap a line. Or use Tab and Space.</p>
        </div>
        <svg viewBox="0 0 44 44" class="ring" aria-hidden="true">
          <circle cx="22" cy="22" r="18" class="ring-track" />
          <circle cx="22" cy="22" r="18" class="ring-fill" id="ring" />
        </svg>
      </header>

      <div id="groups"></div>

      <p class="tail"><span id="tail-count"></span><button id="reset" class="link">Clear all</button></p>

      <div class="cheer" id="cheer" hidden aria-live="polite">All done</div>
    </main>
    <script src="app.js"></script>
  </body>
</html>
` },
      { name: "style.css", lang: "css", content: TOKENS + `
.wrap.narrow { max-width: 560px; }

.head { display: flex; align-items: center; gap: 14px; }
.head .sub { margin-bottom: 0; }
.head .ring { flex: 0 0 auto; margin-left: auto; width: 44px; height: 44px; transform: rotate(-90deg); }
.ring circle { fill: none; stroke-width: 4; stroke-linecap: round; }
.ring-track { stroke: var(--line); }
/* 2 * pi * 18, rounded. */
.ring-fill {
  stroke: var(--accent);
  stroke-dasharray: 113;
  stroke-dashoffset: 113;
  transition: stroke-dashoffset 0.5s var(--ease);
}

h2.group {
  margin: 22px 0 6px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--faint);
}

.item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  margin-bottom: 4px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--card);
  text-align: left;
  line-height: 1.4;
}

.box {
  flex: 0 0 auto;
  width: 21px;
  height: 21px;
  border-radius: 7px;
  border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
  display: grid;
  place-items: center;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.box svg { width: 13px; height: 13px; }
/* The tick is a path that draws itself rather than a glyph that appears. It is
   the difference between a state changing and an action being acknowledged. */
.box path {
  fill: none;
  stroke: var(--bg);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 22;
  stroke-dashoffset: 22;
  transition: stroke-dashoffset 0.28s var(--ease) 0.05s;
}

.item .label { position: relative; transition: color var(--dur) var(--ease); }
/* The strike sweeps across rather than switching on. */
.item .label::after {
  content: "";
  position: absolute;
  left: 0;
  top: 52%;
  width: 100%;
  height: 1.5px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s var(--ease);
}

.item.on { border-color: color-mix(in srgb, var(--accent) 30%, var(--line)); }
.item.on .box { background: var(--accent); border-color: var(--accent); }
.item.on .box path { stroke-dashoffset: 0; }
.item.on .label { color: var(--faint); }
.item.on .label::after { transform: scaleX(1); }

.tail {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
  color: var(--faint);
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}
.link {
  margin-left: auto;
  min-height: 0;
  padding: 6px 10px;
  border: 0;
  background: none;
  color: var(--muted);
  font-size: 0.82rem;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.link:hover { color: var(--ink); }

.cheer {
  margin-top: 18px;
  padding: 14px;
  border-radius: var(--r);
  text-align: center;
  font-weight: 600;
  color: var(--good);
  background: color-mix(in srgb, var(--good) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--good) 30%, transparent);
  animation: cheerIn 0.42s var(--ease);
}
@keyframes cheerIn {
  0% { opacity: 0; transform: scale(0.94); }
  60% { transform: scale(1.02); }
  100% { opacity: 1; transform: scale(1); }
}
` },
      { name: "app.js", lang: "js", content: `/* ------------------------------------------------------------------ list --
   Your list. Edit it — everything below is machinery.
   Items with the same "group" are shown together, in the order first seen.  */

const TITLE = "Before the trip";
const SUB = "Tap a line. Or use Tab and Space.";

const ITEMS = [
  { group: "Documents", text: "Passport — check the expiry date" },
  { group: "Documents", text: "Print the boarding pass" },
  { group: "Documents", text: "Travel insurance in the phone" },
  { group: "Bag", text: "Chargers and the adapter" },
  { group: "Bag", text: "Refillable bottle, empty" },
  { group: "Bag", text: "One book, one spare shirt" },
  { group: "House", text: "Bins out" },
  { group: "House", text: "Heating down" },
];

const TICK = "M4 11 l4.5 4.5 L17 6";

/* -------------------------------------------------------------- machinery -- */

const el = (id) => document.getElementById(id);
const done = ITEMS.map(() => false);

function build() {
  el("list-title").textContent = TITLE;
  el("list-sub").textContent = SUB;
  document.title = TITLE;

  const groups = [];
  ITEMS.forEach((it) => { if (groups.indexOf(it.group) === -1) groups.push(it.group); });

  const host = el("groups");
  host.innerHTML = "";
  groups.forEach((g) => {
    if (g) {
      const h = document.createElement("h2");
      h.className = "group";
      h.textContent = g;
      host.appendChild(h);
    }
    ITEMS.forEach((it, i) => {
      if (it.group !== g) return;
      const b = document.createElement("button");
      b.className = "item";
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.innerHTML =
        '<span class="box"><svg viewBox="0 0 21 21"><path d="' + TICK + '"/></svg></span>' +
        '<span class="label"></span>';
      b.querySelector(".label").textContent = it.text;
      b.addEventListener("click", () => toggle(i, b));
      host.appendChild(b);
    });
  });
}

function toggle(i, node) {
  done[i] = !done[i];
  node.classList.toggle("on", done[i]);
  node.setAttribute("aria-pressed", done[i] ? "true" : "false");
  tally();
}

function tally() {
  const n = done.filter(Boolean).length;
  el("ring").style.strokeDashoffset = String(113 - (n / ITEMS.length) * 113);
  el("tail-count").textContent = n + " of " + ITEMS.length + " done";
  el("cheer").hidden = n !== ITEMS.length;
}

el("reset").addEventListener("click", () => {
  done.fill(false);
  document.querySelectorAll(".item").forEach((n) => {
    n.classList.remove("on");
    n.setAttribute("aria-pressed", "false");
  });
  tally();
});

build();
tally();
` },
    ],
  },
  {
    id: "timer",
    name: "Timer",
    blurb: "A ring that sweeps. Focus, break, repeat.",
    icon: "Timer",
    title: "Focus timer",
    ask: "Set this timer up for ",
    files: () => [
      { name: ENTRY, lang: "html", content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Focus timer</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="wrap narrow center">
      <h1 id="timer-title">Focus timer</h1>
      <p class="sub" id="phase-name">Focus</p>

      <div class="dial">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="88" class="ring-track" />
          <circle cx="100" cy="100" r="88" class="ring-fill" id="ring" />
        </svg>
        <div class="read">
          <output id="clock" aria-live="off">25:00</output>
          <p class="cycle" id="cycle"></p>
        </div>
      </div>

      <div class="row">
        <button id="reset" aria-label="Reset">&#8635;</button>
        <button id="toggle" class="wide primary">Start</button>
        <button id="skip" aria-label="Skip to the next phase">&#8677;</button>
      </div>

      <p class="hint">Space starts and pauses.</p>
      <p class="sr" id="say" aria-live="polite"></p>
    </main>
    <script src="app.js"></script>
  </body>
</html>
` },
      { name: "style.css", lang: "css", content: TOKENS + `
.wrap.narrow { max-width: 420px; }
.center { text-align: center; }
.center h1 { font-size: 1rem; }
.center .sub {
  margin-bottom: 22px;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--accent);
  transition: color 0.4s var(--ease);
}
body.break .center .sub { color: var(--gold); }

.dial { position: relative; display: grid; place-items: center; }
.dial svg { width: min(280px, 72vw); height: auto; transform: rotate(-90deg); }
.dial circle { fill: none; stroke-width: 6; stroke-linecap: round; }
.ring-track { stroke: var(--line); }
/* 2 * pi * 88, rounded. The sweep is driven a frame at a time rather than by a
   CSS transition, so pausing leaves it exactly where it stopped. */
.ring-fill {
  stroke: var(--accent);
  stroke-dasharray: 553;
  stroke-dashoffset: 0;
  transition: stroke 0.4s var(--ease);
}
body.break .ring-fill { stroke: var(--gold); }

.read { position: absolute; }
output {
  display: block;
  font-size: clamp(2.6rem, 12vw, 3.6rem);
  font-weight: 300;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.cycle { margin: 2px 0 0; font-size: 0.76rem; color: var(--faint); }

/* A soft pulse at the moment a phase ends. Nothing beeps: a page that makes a
   noise in a library is a page nobody opens twice. */
.dial.ding { animation: ding 0.7s var(--ease); }
@keyframes ding {
  0% { transform: scale(1); }
  30% { transform: scale(1.035); }
  100% { transform: scale(1); }
}

.row { display: flex; gap: 8px; justify-content: center; margin-top: 24px; }
.row button { width: 44px; font-size: 1.1rem; }
.row .wide { width: auto; flex: 1 1 0; max-width: 180px; }
.row .primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
  font-weight: 500;
}
body.break .row .primary { background: var(--gold); border-color: var(--gold); }

.hint { margin-top: 16px; font-size: 0.78rem; color: var(--faint); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
` },
      { name: "app.js", lang: "js", content: `/* ---------------------------------------------------------------- phases --
   Your rhythm. Edit this list — everything below it is machinery.
   It loops forever, in order.                                              */

const TITLE = "Focus timer";

const PHASES = [
  { name: "Focus", minutes: 25, kind: "work" },
  { name: "Break", minutes: 5, kind: "break" },
  { name: "Focus", minutes: 25, kind: "work" },
  { name: "Break", minutes: 5, kind: "break" },
  { name: "Focus", minutes: 25, kind: "work" },
  { name: "Long break", minutes: 15, kind: "break" },
];

/* -------------------------------------------------------------- machinery -- */

const el = (id) => document.getElementById(id);
const CIRC = 553;

let phase = 0;
let left = PHASES[0].minutes * 60000;
let running = false;
let endsAt = 0;
let frame = 0;
let finished = 0;

const two = (n) => String(n).padStart(2, "0");

/* Time comes from the clock, never from counting frames. A tab in the
   background is throttled to roughly one frame a second, and a timer that
   counts frames quietly loses minutes while you are not looking. */
function tick() {
  if (running) left = Math.max(0, endsAt - Date.now());
  draw();
  /* Not a return: advancing must not end the loop, or the clock freezes the
     moment the first phase runs out. setPhase has already refilled the time. */
  if (running && left === 0) advance(true);
  frame = requestAnimationFrame(tick);
}

function draw() {
  const total = PHASES[phase].minutes * 60000;
  const secs = Math.ceil(left / 1000);
  el("clock").textContent = two(Math.floor(secs / 60)) + ":" + two(secs % 60);
  el("ring").style.strokeDashoffset = String(CIRC * (1 - left / total));
  el("phase-name").textContent = PHASES[phase].name;
  el("cycle").textContent = finished
    ? finished + (finished === 1 ? " phase done" : " phases done")
    : "Phase " + (phase + 1) + " of " + PHASES.length;
  document.body.classList.toggle("break", PHASES[phase].kind === "break");
}

function setPhase(i) {
  phase = ((i % PHASES.length) + PHASES.length) % PHASES.length;
  left = PHASES[phase].minutes * 60000;
  endsAt = Date.now() + left;
  draw();
}

function advance(natural) {
  if (natural) {
    finished += 1;
    const dial = document.querySelector(".dial");
    dial.classList.remove("ding");
    void dial.offsetWidth;
    dial.classList.add("ding");
    el("say").textContent = PHASES[phase].name + " finished. " + PHASES[(phase + 1) % PHASES.length].name + " next.";
  }
  setPhase(phase + 1);
  if (!natural && !running) { running = false; el("toggle").textContent = "Start"; }
}

function toggle() {
  running = !running;
  if (running) endsAt = Date.now() + left;
  el("toggle").textContent = running ? "Pause" : left < PHASES[phase].minutes * 60000 ? "Resume" : "Start";
  el("clock").setAttribute("aria-live", running ? "off" : "polite");
}

function reset() {
  running = false;
  el("toggle").textContent = "Start";
  finished = 0;
  setPhase(0);
}

el("toggle").addEventListener("click", toggle);
el("reset").addEventListener("click", reset);
el("skip").addEventListener("click", () => advance(false));

document.addEventListener("keydown", (e) => {
  if (e.key === " ") { e.preventDefault(); toggle(); }
});

el("timer-title").textContent = TITLE;
document.title = TITLE;
setPhase(0);
tick();
` },
    ],
  },
];

export function findMake(id: string | undefined): Make | undefined {
  return MAKES.find((m) => m.id === id);
}
