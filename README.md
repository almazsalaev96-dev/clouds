# Armi

One interface for Claude, GPT, Gemini and DeepSeek — plus the projects, the web
apps and the notebook that come out of talking to them. You bring the API keys.

Built against [`prompts/MASTER_PROMPT.md`](prompts/MASTER_PROMPT.md), which is the
design and engineering brief this repository implements. Where the code departs from
the brief, [Known gaps](#known-gaps) says so.

---

## Running it

```bash
npm install
cp .env.example .env.local     # optional — see "Keys" below
npm run dev                    # http://localhost:3000
```

Nothing is required to start. With no keys configured the app runs, remembers
conversations, and tells you what it needs instead of failing silently.

## Keys

Two paths, and the difference is stated in the UI rather than buried here:

- **`.env.local` on the server** — the browser never sees the key. Preferred.
- **Settings → API keys** — stored in that browser only, sent to *your* server,
  which forwards it to the provider. For deployments where you don't control env.

Server keys always win. Keys are never logged, never put in a URL, and never sent
anywhere except the provider they belong to. Settings has a **Test** button that
makes a real one-token call and reports the round trip, so a green dot means
something.

## What's here

**Conversation** — streaming with stop (which keeps the partial answer), regenerate,
edit-a-message-to-fork, sibling navigation `‹ 2/3 ›`, per-conversation drafts that
survive switching away mid-sentence, pin, rename, delete, full-text search across
message bodies, Markdown export, auto-generated titles.

**Attachments** — images, text files of every stripe, and **PDFs**, read in the
browser and sent as text. A PDF is the most common thing anyone drags at an
assistant — a paper, a spec, a syllabus — and this used to refuse them all with
"isn't a text or image file", which is a true sentence that is no use to the
person reading it. pdf.js does the work behind a dynamic import, so the megabyte
it costs is downloaded only by sessions that attach one; First Load JS is
unchanged. A scan is called a scan: a PDF with no text layer is refused with the
page count and the reason, because an empty attachment is something a model will
confabulate around. Project knowledge takes PDFs too.

**Rendering** — GFM markdown, KaTeX math, tables that scroll inside their own
container, and code blocks with a language label, optional filename, wrap toggle,
download, collapse past 60 lines, line numbers past 12, diff tinting with a gutter
glyph, and a copy button that works mid-stream and never captures a line number.

**Models** — all four providers behind one adapter interface, a `⌘/` picker with
context window, price and capability chips, per-model parameters, mid-conversation
switching, regenerate-with-a-different-model, and models without a key dimmed with a
reason rather than hidden. Each provider carries a small geometric mark, so which
engine answered is legible before you start reading.

**Compare** — send one prompt to up to three models at once. They stream in parallel
columns, each on its own clock, and "Keep this one" points the conversation at the
answer you chose. The other two are not discarded: they stay under `‹ 2/3 ›`.

**Side panel** — any code block over 24 lines can be lifted into its own column. The
copy left in the thread collapses to a one-line reference, so a 900-line answer stops
burying the conversation that produced it.

**Projects** — a place with a memory. Standing instructions that go out with every
chat started inside it, and material those chats can see without being pasted in
again. The knowledge has a meter, and the meter is honest: files are fitted whole,
in the order they were added, and one that does not fit is shown greyed with
"over the limit" rather than quietly truncated — half a document is worse than
none, because the model reads the cut as the end and answers confidently about a
spec that stops mid-sentence. Deleting a project does not delete its chats; they
come out of the folder and stay. Undo puts them back inside it.

**Styles** — Normal, Concise, Explanatory, Formal, Learning, and any you write.
A style changes the *shape* of an answer and nothing about what the model knows,
which is why it is a separate control from the system prompt: "you are a tutor for
my thermodynamics course" and "keep it short" should not be edited, forgotten and
lost together. Normal carries no instructions at all — a style that says "be
balanced and natural" makes the model self-conscious about being balanced and
natural, which reads as neither. Custom styles start from a built-in you can read
rather than from a blank box titled Instructions.

Everything a chat is told before your first word is assembled in one place and in
one order — your instructions, then the project and its material, then the style.
Style last because it is the only layer that governs form, and a "keep it short"
that arrives before three pages of project knowledge is one the model has stopped
thinking about by the time it answers. It also makes the whole block a stable
prefix, which is what the provider's cache is for.

**Canvas** — a document you and the model both write to. It comes in three
shapes, and the shape is the first thing you pick, not a setting you go looking
for: a **document**, a **code file**, or a **web app**.

A web app is a folder — `index.html`, `style.css`, `app.js` — running in a frame
beside the editor. The preview resolves the page's own `<link href>` and
`<script src>` against the other files and inlines them, so what you write is a
real page that would work if you saved the folder, rather than three panes whose
relationship only exists inside this app.

Its console comes back out. An error inside a sandboxed frame is otherwise
invisible — no devtools panel points at it, and "it just doesn't work" with
nothing on screen is where people give up — so logs, warnings, uncaught errors
and unhandled rejections are piped to a drawer under the preview, with the error
count on the button so you do not have to open it to know. And the line numbers
are translated: the browser only ever sees the assembled document, so "line 76"
is mapped back to `app.js:2`. A number that looks like a line number and is not
is worse than no number, because people go to line 76 of the file they are in and
find something innocent there.

**The motion.** Three things in the app changed state by cutting. A segmented
control moved a background colour from one button to another, which is not a
transition — the old pill vanishes, a new one appears elsewhere, and the eye
has to find it again. Now one indicator travels the distance, positioned from
the live geometry of whichever button is on rather than from a fixed 1/n
stride, because these hold labels of different lengths. It does not animate on
first paint: a control that slides into place while the page is still arriving
is a control announcing itself, and the answer to "which one am I on" should be
there before the question.

Sections cut too. Now the browser moves you: `startViewTransition` snapshots
before and after, and the room slides in the direction you travelled — down the
nav list is forward, back up it is back. Direction is not decoration; it is the
only thing separating "I went somewhere" from "the screen changed". And because
an element carrying the same `view-transition-name` on both sides *moves*
rather than cross-fading, naming the message bar is the entire implementation
of the one transition worth most: on the first send it travels from the middle
of a blank page down to the dock, instead of teleporting.

All of it declines to run under `prefers-reduced-motion` — not by animating to
zero but by never starting: nothing is even named, so nothing can be animated
as itself. Firefox, which has no view transitions yet, gets exactly what the
app did before any of this existed.

**One box, in every room.** There used to be two, and they disagreed about
almost everything. Chat had a 28px-radius container with the text on its own
line and the controls beneath it; a canvas had a 44px-tall pill with the send
button floating outside it and no microphone at all; the notebook had nothing —
you could write a page there and send it nowhere, which made it the one room
the model was not in. They were all the same request wearing different faces,
and moving between rooms meant re-learning where send lives.

Now the shell, the typography, the growth, the keyboard, the microphone and the
send button live in one component, and a room supplies only what is genuinely
its own: what the placeholder says, and which controls belong on the row. Three
slots, in the order they are read — a tray above the line for what is *about*
the message (attachments in chat, one-press edits on a canvas), a left group
that wraps, and a right group that never does.

Two things came out of unifying it. The box turned out never to have had a blur
of its own: docked under a transcript the strip behind it was doing that work,
so it looked solid there and translucent-over-nothing on a blank page. And both
the canvas and the notebook were choosing the model that rewrites your file
silently — cheapest-with-a-key, which is a good default and a bad secret, since
"why did it rewrite the whole thing" has a different answer depending on which
model did it. It is on the bar now, and one press to change. A canvas also says
which file it is about to change, which on a folder of three is a live question.

The notebook got the whole loop, not just the box: ask for a change and the
revision arrives as the page, with a diff, kept or discarded — the same promise
a canvas makes, because nothing a model wrote should land in your file before
you have seen what it touched.

**Things you can make.** Asked for a timetable, an AI writes you a description
of a timetable. Creative can hand you the timetable: five starters — flashcards,
a timetable, a quiz, a checklist, a timer — that are not sketches but working
folders. Press one and a second later there is a deck that flips in 3D on the
space bar and pushes "again" cards back three places; a week grid with a line
that says where you are in the day, moving every half minute; a quiz that marks
answers with a tick as well as a colour and draws the score round a ring; a list
whose ticks draw themselves; a ring that sweeps down twenty-five minutes and
keeps its time from the clock rather than from counting frames.

They share a shape, and the shape is the point. The top of each `app.js` is a
plain list of data with a rule above it saying so, and everything below is
machinery nobody has to read — so "cards for Spanish verbs" is an edit to six
lines rather than a rewrite. Pressing a starter also leaves its half of the
sentence in the box underneath ("Fill this deck with cards for …"), because a
blank field under a working demo asks *now what* and a sentence to finish
answers it.

Two rules they all obey, and both are the sandbox rather than taste. No
`localStorage`: the preview runs on an opaque origin, so touching storage
throws — the file *is* the storage, and keeping a version is how state is
saved. And no network: a folder that reaches a CDN stops working the moment
someone saves it and opens it somewhere without internet.

The same instructions went to the model. Ask Creative for a thing rather than
for words and it now builds one — a single self-contained document, in a block
this app runs — under the same constraints, plus motion that honours
`prefers-reduced-motion`, 44px targets, and never colour alone to mean right or
wrong.

Code and web files get a real editor, not a textarea. Syntax colour, a line
gutter, Tab to indent and Shift-Tab to outdent, a band on the line you are on,
and a status line that says where the caret is — the things that make a file
navigable rather than merely typeable. It is a transparent textarea over a
highlighted `<pre>`: you keep the caret, the selection, undo, IME, autoscroll
and every native shortcut, and the colour is painted underneath. The catch is
that the two layers must be typographically identical or the caret drifts, so
they share one style object and a test measures them against each other rather
than trusting the eye. Escape leaves the editor — a box that eats Tab must
give the keyboard back, or it is a trap.

The frame is sandboxed with `allow-scripts` and no `allow-same-origin`, so the
page runs on an opaque origin: it executes its own code and reaches nothing of
this app's — not the conversations, not the keys, not storage. That is tested,
not asserted: `e2e-web.mjs` reads `window.origin` inside the frame and confirms
`localStorage` throws.

**Five one-press edits** — Add comments, Add logs, Fix bugs, Port to…, Explain.
Taken from ChatGPT's canvas, which settled on exactly this set, because they are
the things people ask for over and over and typing "add comments explaining what
each function does" for the hundredth time is the app failing to notice a
pattern. A document gets its own four instead: Tighten, Proofread, Add structure,
Explain — "Add logs" means nothing in prose. Every one of them lands as a diff
you keep or discard, except Explain, which never touches the file: a shortcut
that sometimes edits and sometimes does not is one nobody trusts with either.

Every accepted change is a version, and so is the state it replaced, so reverting
is always possible even when the first edit came from the model. History is per
file. Reverting writes a *new* version rather than deleting the ones after it,
because an undo that destroys history is how you lose the thing you were trying
to get back to.

**Look** — taken from the object the brand is: a fountain pen on cream paper.
Paper (`#f7f3ea`) is the ground — ivory, not white and not yellow. Ink (`#1a2650`)
is the words: a saturated navy, the colour a good blue ink dries to, and the only
colour most of a screen is ever made of. Gold (`#d4af5a`) is the nib — a jewel,
never a surface: the dot on the i, a badge, the tip of the caret, the edge of the
ring while an answer is arriving. Leather (`#8a4b1d`) is the desk: warmth in the
field behind everything, and the colour of *thinking*, a state that is warm and
slow rather than electric.

Two blues for two jobs, and the difference is the grammar of the interface: royal
(`#3450b5`) is *structure* — links, focus, the active row — and the deep ink
(`#1f2d66`) is *action*, the one control on a screen you are meant to press. You
write with the ink. Gold on paper cannot carry text at 4.5:1 at any value that
also holds a 3:1 edge, so gold is never asked to; it is a detail, which is what a
nib is.

Dark is **not** a rotation of that. That was the first answer — ink becomes the
ground, paper becomes the words — and it was a tidy idea that put a navy wash over
every screen in the app. A dark theme is not a colour; it is the absence of one.
Every tool this is measured against reaches the same conclusion, ChatGPT to
near-black and Claude to a warm charcoal, for the same reason: at eleven at night
the ground has one job, which is to get out of the way of the words.

So the ground is a true neutral — `#1a1917`, three points of channel spread,
leaning warm because the brand is warm. The desk, not the ink. The brand is
carried entirely by what sits on top of it: the paper is the text, the gold is
the action and the nib, and the blue stays where it is in the light theme,
structure. `node contrast.mjs` checks 28 text/background pairs in both themes on
every change, and a separate pass measures the channel spread of every surface
the eye lands on — a neutral has almost none, and the teal that had been sitting
under the composer had twenty.

**Type** — four faces, self-hosted from `/fonts`, latin subsets, one file per
weight, 240 KB in all. Inter for the interface and body. Cormorant Garamond for
the greeting and anywhere the words are the subject — a Garamond, because the
register that goes with a pen on deckle paper is a book, not a dashboard, and
Claude's own product makes the same split. Pinyon Script for the name and nothing
else: a copperplate script is a signature, and a signature that appears more than
once a screen is a watermark. JetBrains Mono for code. Inter had been *named* in
the font stack for a year and never served, so every screenshot in this repo, and
the app for anyone without it installed, was actually DejaVu Sans. A font you name
but do not ship is a wish.

**The mark** — the word in a hand, in two tones: *Ar* in the ink, *mi* in the gold
of the nib, and the dot on the i where the pen lifts. It is two spans rather than
one gradient, because a gradient needs `color: transparent` and `background-clip:
text`, and in forced-colors mode that is a wordmark which renders as nothing at
all. Pinyon joins its letters, so the second half is pulled back by the width of
the connector between the r and the m to put that join back.

It sits at 38px in the sidebar corner, not the 30 it started at. A copperplate
script is all hairlines and joins, and at 30 those joins fall below a pixel and
the name reads as a squiggle — the answer was never a different typeface, it was
more room. The app icon is the initial in the same hand on the navy, with the
same gold dot.

**Thinking** — one motif wherever the model is running: a ring of field energy that
turns, and a hairline that travels the width of whatever is live. It says *running*
without claiming to know how much longer, which a progress bar would, and would be
lying about. The streaming caret runs the two purple steps, deep at its base to
light at its tip; the composer border joins the same event, so where you type and
where text appears are visibly one thing. Under `prefers-reduced-motion` the ring stops turning and the line
stops travelling, but both stay visible — reduced motion still needs the state to be
legible.

**Navigation** — chat and code are not two destinations among several; they are
the two things the app *is*. So they sit in the header as a switch, beside the
name, where the one you are in is readable and changeable without travelling down
a list to find out. **Projects** and **Notebook** are rows below it. Each opens as
its own page with its own index in the main column. The rest of the sidebar
belongs to conversations: New chat, search, then the history — taking the chat
list away to show a note list would cost more than it buys.

**Notebook** — markdown pages, edited in place, searched by body as well as by
title. Keep an answer from a chat with one click, or the whole conversation.
Titles derive themselves from the first heading, so nothing is called "Untitled"
that says what it is in its first line.

It replaced four sections. Flashcards, Papers and Practice were three study
features in an app whose centre of gravity turned out to be chat, projects and
code — five destinations for one activity, and more sidebar than the activity was
getting used. They are gone, and so are their tables: the code is in git, the
rows are not.

**The blank page** — the mark and the greeting on one line, the way a letter is
signed at the head of the page rather than announced above it. The greeting knows
what time it is and, once you have said so, what you are called, and it alternates
between the hour and the day — "Good evening" every single evening becomes
wallpaper by the third one. Which of the two you get is taken from the date, not
from a coin toss: it is the same all day and changes when the day does, because
randomness that reshuffles while you read is not warmth, it is a glitch. It asks
your name once, inline, after the keys are in, and never as a modal. A name is the
cheapest thing an interface can know about you and the one that changes the most
about how it reads back; it stays in the browser and is never sent to a model. The
sidebar signs off with it too.

**Chat or Creative** — two ways to ask, side by side in the composer. Chat is the
default and adds nothing at all. Creative changes the two things that actually
change an answer: it asks for range, for the specific over the general, and for
the option that was not obvious — and it widens the sampling, which is the half a
prompt cannot do. Temperature is the width of the distribution the next token is
drawn from, and asking for "creative" writing at 0.7 gets you the most probable
phrasing of an unusual instruction, which is exactly the flat, competent prose
people mean when they say an answer sounds like AI. It keeps accuracy
non-negotiable: invent freely in what you write, never in what you claim is true.

The sampling half does not always land, and that is the provider's rule rather
than a bug — Anthropic rejects `temperature` alongside extended thinking, so on a
reasoning model the instructions do the work alone. Creative does not turn
thinking off to win that argument; trading reasoning for sampling width would be a
silent downgrade nobody asked for. Both paths are asserted at the wire in
`e2e-mode.mjs`.

**The model sits in the composer** — an inch from the box you are typing in, and
changeable there, with the reasoning effort beside it. It used to live in the
header, two feet from the decision it belongs to, which is how a long prompt ends
up going to the wrong one. On a blank page the header is now empty, as it should
be: there is nothing to say about a conversation that does not exist.

**The rest** — command palette (`⌘K`), keyboard operation throughout, light/dark with
no flash, three densities, *Continue* on any answer that ran out of room, and
every empty and error state written rather than defaulted.

## How it's put together

```
app/
  api/chat/        SSE proxy. Keys resolve server-side; abort propagates upstream.
  api/models/      Which providers the server can answer for. Never sends a key.
  api/test-key/    One-token round trip for the Test button.
  globals.css      Every token in the app, plus the print stylesheet.
lib/
  providers/       One adapter per provider, one normalized event stream.
  hooks/useStream  The streaming controller and the reveal buffer.
  db.ts            Dexie. The message tree, notebook, projects, canvases.
  prompt.ts        Where instructions, project, style and mode are assembled.
  web.ts           The web-canvas assembler, console bridge and source map.
  generate.ts      One-shot generation: titles, revisions, explanations.
  store.ts         Settings, section, drafts — persisted.
components/        Sidebar and the three section views.
components/chat/   Composer, message list, code blocks, compare, dialogs.
```

Three decisions carry most of the weight:

**Messages form a tree.** Every message has a `parentId`; the UI renders one path
through it and reaches the rest by sibling navigation. Editing and regenerating add
branches. Nothing is ever destroyed. This is the one thing that cannot be retrofitted
later without a rewrite.

**Tokens are revealed on a rAF buffer.** Providers emit in ragged bursts — forty
characters, 300ms of nothing, then a hundred. Rendered raw, that reads as stuttering,
and stuttering reads as slow. Arriving text goes into a buffer that a rAF loop drains
proportionally to its backlog. Same finish time, considerably faster to watch.

**Errors are classified at the adapter boundary.** Each provider fails in its own
dialect; `classifyError` turns all of them into one sentence plus one action
(`retry`, `add_key`, `switch_model`, `shorten`). No raw provider string reaches the
interface — including Google's habit of reporting a bad key as a 400.

Comparison falls out of the tree almost for free: each column writes against the same
parent, so the three answers are siblings before anyone chooses between them.

**PDF export is the browser's print pipeline, not a library.** It already hyphenates,
breaks pages, embeds fonts and honours the user's paper size, and it hands them a file
they chose the name and location for. `@media print` in `globals.css` is therefore the
actual renderer: it strips the application, forces a light document whatever theme the
user reads in, turns the fixed-height flex shell into one continuous flow, and applies
the conventions that only exist on paper — orphans and widows, no page break after a
heading, and link URLs printed in full.

## Verified

- `npm run build` and `tsc --noEmit` clean; no `any`, TypeScript strict.
- First Load JS **203 kB** for the app route, under the 250 kB budget. The markdown
  pipeline (micromark, GFM, KaTeX) is a separate chunk, and Shiki grammars load per
  language on demand.
- All four adapters exercised against their live APIs with a deliberately invalid
  key: each returns a correctly classified `bad_key` through the SSE stream, and a
  provider with no key returns `no_key` before any request is made.
- Rendered and screenshotted in light and dark at 1440×900 and at 390×844.
- The canvas driven end to end (`e2e-canvas.mjs`): a revision proposed, shown as a
  diff with the right counts, refused entry to the database until accepted, recorded
  as two versions, reverted without losing the newer one, and a preview confirmed to
  run its own scripts on an opaque origin.
- The web canvas driven end to end (`e2e-web.mjs`): the folder runs, the `<link>`
  and `<script>` resolve against the other files, clicking a button in the
  preview counts, a `console.log` and an uncaught `ReferenceError` come back out
  with the error mapped to `app.js:2`, and `window.origin` inside the frame is
  `null` with `localStorage` throwing `SecurityError`.
- The motion asked for rather than admired (`e2e-motion.mjs`). Animation is the
  easiest thing in an interface to believe you have shipped: it looks right in
  the browser you wrote it in and is silently absent in production because a
  class name changed. So the indicator is sampled every 25ms across its travel
  and has to be caught *between* its two ends — a single mid-flight sample only
  proves it had not finished, which a delay would also satisfy. The view
  transition is checked by patching `startViewTransition` and asking whether
  the browser actually began one and in which direction. And the reduced-motion
  path is checked from the other side: no transition started at all, and
  nothing named, so nothing could be.
  Writing it found a bug that had nothing to do with motion and everything to
  do with the previous change: the preview resolved its theme to light and
  corrected to dark one tick later, which is a second `srcDoc`, so **every web
  preview loaded twice** — every script ran twice, every console line arrived
  twice. Nothing about it looked wrong on screen. It showed up as two identical
  error links, and only sometimes. The theme is read from the root the boot
  script already stamped, so there is no second value; the console now stamps
  each message with the run that produced it and drops the rest; and repeated
  lines collapse to one row with a count, the way a real console does.
- The message bar measured in all three rooms (`e2e-bar.mjs`) rather than
  compared by eye — two bars four pixels apart in radius look identical side by
  side and wrong when you move between them. The browser is asked for the
  shell's radius, border, fill, blur and shadow, the typing line's padding,
  size, leading and family, and the send disc's size, radius and inset from the
  corner, in chat, on a canvas and on a notebook page; all three have to match
  exactly, at rest *and* focused. The first version of the test measured a
  focused chat bar against two resting ones and reported a difference that was
  the focus ring — the fix was to read both states, which is what "the same"
  has to mean for something you click into.
- Every starter opened, run, and *used* (`e2e-makes.mjs`) — a card flipped and
  the transform read back, an arrow pressed and the deck checked for having
  moved, a block clicked and its sheet closed with Escape, a quiz answered
  wrongly and checked for a mark rather than only a colour, a list finished, a
  timer started and then paused and checked for staying where it stopped. A
  starter that renders is not a starter that works, and a screenshot cannot tell
  a card that flips instantly from one that does not flip at all. Each one is
  also asked whether it ran clean: the console bridge means an uncaught error
  inside the sandbox shows up as a count on a button, and a starter that throws
  on load is the worst first impression the app can make.
  Two real faults came out of writing it. `hidden` does not hide when your own
  CSS sets `display` — the browser's `display: none` is a UA rule and any author
  rule beats it — so a full-screen dialog marked hidden was invisible and still
  swallowing every click aimed at the week behind it; every starter now carries
  one line that makes hidden mean hidden. And the canvas's "ask for a change"
  box and its send button answered to the same accessible name, which is a
  screen reader reading the same words twice with no way to tell which is which.
- The code editor measured rather than eyeballed (`e2e-editor.mjs`). A highlighted
  textarea is two layers pretending to be one, and the failure is silent — the
  caret drifts a fraction of a pixel per line until it sits between two characters
  twenty lines down. So the test reads both layers' computed font, size, leading,
  tracking, tab size and padding and asserts they are identical, then asks the
  browser for both bounding boxes and asserts the offset is 0.00px in each axis.
  It also drives the whole loop the feature exists for: an uncaught error opens the
  console by itself, its `(app.js:2)` is a link, and clicking it switches file,
  scrolls, and puts the caret on that line with the line selected.
- Stopping mid-answer driven for real (`e2e-stop.mjs`, with `node mock-slow.mjs` so the
  stream lasts long enough to interrupt): mid-flight, the button under the cursor
  is asked of the browser by hit-testing rather than read off a class; the partial
  text is kept, `stopReason` is `aborted`, Send comes back, and the thread still
  works afterwards. It was the one path the suite never took, because the mock
  answered in a third of a second and the button was gone before a click landed.
- The composer's control row measured at seven widths from 1440 down to 390. It
  had been truncating the model name at *every* one of them and overflowing by
  127px on a phone — pushing the send button off the screen — since Creative was
  added beside it. Fixing the overflow with `flex-wrap` then produced a second,
  quieter fault, visible only in a screenshot: at 1440px the send button fell to a
  line of its own, alone under a row of settings. The row is now two groups —
  a left group that wraps and a right group, pinned to the edge, that cannot — so
  the settings stack and send never moves. What made it fit on one line again was
  deleting a word: the style control read "Normal", which is the name for *no
  style*, and it was the last 62px in the way. The name shows once there is one
  worth showing; the accessible label carries it either way.
- Chat and Creative verified **at the wire** (`e2e-mode.mjs`): Chat adds nothing to
  the prompt and nothing to the sampling; Creative's instructions arrive, and on a
  model without a thinking budget so does `temperature: 1, top_p: 0.98`. On a
  reasoning model the temperature is correctly absent, because Anthropic rejects it
  alongside extended thinking.
- Projects and styles verified **at the wire** (`e2e-project.mjs`): the browser is
  driven, then the mock provider is asked what system prompt it actually received —
  the project's instructions, its knowledge wrapped one `<document>` per file, and
  the chosen style last. A test that asks the app what it believes it sent proves
  nothing.
- A shipping bug the production build had been hiding: the CSS minifier replaced
  the standard `backdrop-filter` with the `-webkit-` alias alone, and in a browser
  that has the property but not the alias every frosted surface in the app — the
  sidebar, the top bar, every popover and dialog — rendered as a 74%-transparent
  panel with no blur, which you could read the page straight through. It only
  happened in the built CSS, so nothing in dev would ever have shown it. `audit.mjs`
  now reads the computed value so it cannot come back.
- Every control in every section measured on a phone (`touch.mjs`), not sampled: the
  earlier check only covered the chat composer, which is where the icon buttons
  already met 44pt — while the navigation you go through to reach anything was 32.
- Compare mode driven end to end in a real browser: three columns mount, each opens
  its own request, and each renders its own classified failure independently.
- The side panel opens from a code block, collapses the inline copy to a reference,
  and closes on Escape.
- The notebook seeded and driven in a browser; the print layout was captured
  through Chromium's print media emulation rather than assumed.
- Highlighting confirmed to run in a real Web Worker (counted at construction, not
  assumed), producing 240 themed spans on a 40-line block.
- Three bugs found by measuring rather than by looking, all of them cascade problems:
  unlayered `button`/`input` rules were overriding every Tailwind text-size utility,
  because unlayered CSS beats every `@layer`; the `pop-in` keyframe ended on
  `transform: none`, which would erase the translate that centres a dialog; and the
  field background's `body > * { position: relative }` was overriding `position: fixed`
  on every portalled dialog, leaving each one anchored halfway down the page. The
  first moved into `@layer base`, the second now animates the independent `scale`
  property, and the third became background layers on `body` with no DOM at all.

## Known gaps

Stated plainly, because a checklist you cannot trust is worse than no checklist.

- **No successful call to a real provider has been observed.** No valid key was
  available in this environment. Every *failure* path was exercised against the
  real APIs — Anthropic and Google both answered and were classified correctly.
  The success path is covered by `e2e.mjs`, which runs the whole app against a
  mock speaking Anthropic's documented SSE format: streaming, markdown,
  highlighting, usage, cost, titling, persistence and branching all verified.
  What remains unproven is only that the real API's bytes match its own docs.
- **No true virtualization.** Every turn carries `content-visibility: auto` with an
  intrinsic size, so the browser skips layout and paint for anything off-screen —
  most of the benefit, without breaking find-in-page, text selection across messages,
  or scroll restoration. A conversation in the thousands of messages would still want
  real windowing.
- **Screen-reader testing was not run.** Semantics, live regions, labels and focus
  order are implemented to spec and every control is confirmed to carry an
  accessible name (`node audit.mjs`), but nothing has been driven with VoiceOver.
- **Not an App Store app.** The interface is built to Apple's Human Interface
  Guidelines — 44pt targets on coarse pointers, safe-area insets under
  `viewport-fit=cover`, no zoom-on-focus, reduced-motion and forced-colors
  support, a manifest so it installs to the Home Screen as a standalone app.
  That is design conformance. Shipping to the App Store is a different question:
  it needs a native container, and Apple rejects thin web wrappers under
  guideline 4.2, so it would need to earn its place as an app rather than be one
  by packaging.

## Checks

Four scripts, each measuring rather than asserting — they read the live DOM and
the computed tokens, so they cannot drift from what ships. Run the app first.

```bash
node audit.mjs        # Apple HIG: safe areas, zoom, names, focus, contrast mode
node contrast.mjs     # every text/background pair the app renders, against WCAG
node touch.mjs        # every control in every section on a phone, against 44pt
node shoot-smoke.mjs  # every section loads, undo works, no runtime errors
```

And the end-to-end run, which needs the app pointed at the mock provider:

```bash
node mock-provider.mjs &
ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100 &
node e2e.mjs         # 15 assertions across the whole happy path
node e2e-canvas.mjs  # 25 assertions: edit, revise, diff, keep, revert, sandbox
node e2e-project.mjs # 21 assertions: projects and styles, read at the wire
node e2e-web.mjs     # 26 assertions: a web app runs, and its console comes back
node e2e-mode.mjs    # 14 assertions: Chat and Creative, read at the wire
node e2e-pdf.mjs     #  9 assertions: a PDF read, a scan refused, both at the wire
node e2e-editor.mjs  # 13 assertions: the code editor's two layers, measured
node e2e-makes.mjs   # 33 assertions: every starter opened, run and actually used
node e2e-bar.mjs     # 24 assertions: the message bar, measured in all three rooms
node e2e-motion.mjs  # 17 assertions: the motion, asked for rather than admired
node mock-slow.mjs &   # the mock with the gap between tokens stretched, then:
node e2e-stop.mjs    #  8 assertions: stopping mid-answer (needs the slow mock)
node test-context.mjs  # context fitting and cache breakpoints, read at the wire
node test-fit.mjs      # a 360k-token thread trimmed to fit and answered
MOCK_RATE_LIMIT=1 …    # restart the mock this way, then: node test-retry.mjs
```

## What the app does to make answers better

Three things happen between pressing enter and the provider seeing the request.

**The thread is trimmed to fit.** Past the context window a provider answers
with an error, which is the worst available outcome — the conversation still
exists and the model could still answer. Older turns are dropped from the
front, whole messages only, with room reserved for the reply, and the last
message never dropped. What was left out is stated above the transcript rather
than hidden: an assistant that quietly forgets the first half of a
conversation and carries on is far more disorienting than one that says so.

**Long prefixes are cached.** Every turn re-sends everything before it, so by
the tenth exchange the same opening has been paid for and re-read ten times.
A cache breakpoint on the second-to-last message lets Anthropic keep the
prefix; later turns reuse it at a tenth of the price and skip re-reading it.
It only engages once the prefix is big enough to pay back the 25% a cache
write costs. Cached reads and writes are priced into the running cost, so the
number on screen stays true.

**A rate limit is waited out, once.** The provider usually says exactly how
long. Surfacing that as an error to click through turns a two-second wait into
a manual step at the moment someone is already annoyed. Once — not until it
works, because retrying a hard limit in a loop is how an account gets
throttled harder. Stop cancels the wait.

## Pointing at something other than the real API

Each provider's host is overridable, because plenty of deployments do not talk
to the real one directly — Azure fronts OpenAI, LiteLLM and OpenRouter front
everything, companies put a gateway in the middle for logging and spend
control, and a local model wants an OpenAI-shaped endpoint on its own machine.

```
ANTHROPIC_BASE_URL=https://gateway.internal/anthropic
OPENAI_BASE_URL=https://my-azure.openai.azure.com/openai/deployments/gpt-5
GOOGLE_BASE_URL=...
DEEPSEEK_BASE_URL=...
```

Unset, each falls back to the provider's own API.
