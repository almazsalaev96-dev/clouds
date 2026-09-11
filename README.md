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

**Your work can leave, and it can come back.** The app's promise is that
nothing leaves this browser. The unspoken half was that nothing *survives* it:
everything lives in one origin's IndexedDB, and clearing site data, changing
machine, or a browser evicting storage under pressure took the lot. The
Settings panel said exactly that and offered no remedy, which is a warning
rather than an answer.

**Save a copy** writes one file with every conversation, page, canvas and its
whole version history, project and style in it — plain JSON, indented, readable
in a text editor, so it outlives this app. **Bring one back** adds what is
missing and never overwrites what is already here, because a restore usually
happens onto a machine that has something on it and the failure everyone fears
is a backup quietly winning an argument with work you did since. Restoring the
same file twice says so instead of doubling anything.

Two deliberate omissions. **API keys are never written**: a backup lands in
Downloads and gets synced, and a key in one is a key on somebody else's machine
— so the file records which providers you had configured and not what the keys
were. And nothing is compressed: a backup you cannot read is a backup you
cannot check.

Writing it turned up something worse than a missing feature. **"Delete all
data" did not delete all data.** It cleared conversations, messages and notes
and left canvases, every file in them, their entire version history, projects,
the knowledge attached to them, and every style you had written — under a
button whose own description read "it genuinely deletes — nothing is kept
anywhere else". Someone wiping this before handing over a laptop was leaving
their work on it. It enumerates the live database now rather than a list kept
by hand, because a hand-kept list is exactly what went wrong.

**Making it, then using it.** A deck of cards is made once and studied twenty
times, and on the twentieth the tab strip, the editor and the box for asking
for changes are all furniture standing between you and the card. **Use it**
hands the whole window to the thing: no sidebar, no title, no console, no
composer. The trick is that none of that is unmounted — it hides in place —
because React reconciles by position, and returning a smaller tree would take
the iframe with it and reload the page inside. A deck that reshuffles itself
every time you go full-screen is worse than no full-screen.

Escape gives the window back, which needed one more piece: a sandboxed frame
keeps its own keyboard, so a key pressed inside a running page never reaches
the app around it. The console bridge forwards exactly Escape and nothing else
— a page in here is not given a way to drive the app, it is given a way to hand
the window back. And while something has the window, Escape means only that:
the app's own Escape used to fire as well, so one press both handed the window
back *and* left the canvas, and the thing you were using vanished behind the
list it came from.

**Anything, not five things.** The five starters are five answers to a question
with no end of them, so there is a sixth that is honest about it: say what you
want. It works because a whole page now lands as a working page. Asked to make
a timer, Creative replies with a complete HTML document; keeping that used to
produce a *code* canvas — the source of a working thing, with a Run button to
find out. It becomes a web app instead: it opens running, it has a console, and
it can take the window like anything else made here. That is the difference
between "Creative can build you anything" being a claim and being true.

**A book becomes lessons.** The notebook takes a source — attach a PDF and its
text is pulled out, or hand it a text file — and what you can do with the page
changes with it. With a book attached the offer is not proofreading: it is
lessons, a summary, the vocabulary, or questions. The instructions behind those
four are the feature. "Summarise this" gets a summary from any model on any
day; what makes a page worth keeping is being asked for the right shape, so
each one says what it must *not* do as well as what it must — work out what has
to be understood before what and order the lessons that way, not the way the
book happens to present things; show the working in the example; give the
answers rather than omitting them; never write a lesson that can be read
without teaching anything. The failure mode of all four is a table of contents
wearing a costume.

The source goes to the model as reference material and is sliced generously
rather than at the 12,000 characters that is right for a sibling file in a
folder — cutting a book to three pages would produce lessons about three pages
while looking like lessons about the book.

**Bring more than one thing, and keep it.** That source used to be exactly one
file, held in memory for as long as you stayed on the page: attach a book, get
lessons, and the book was gone the moment you left. Which made the notebook a
converter rather than a place — everything it produced was cut loose from what
it came from the instant it existed, so the only question worth asking about a
page a model wrote had no answer. A page now holds as many sources as you give
it, they survive a reload, and they are kept in full, because the text is the
thing a claim gets checked against.

**Every claim is checkable, and the app is what checks it.** Asking a model to
cite its sources gets you citations. It does not get you *true* ones: a
plausible page reference is as easy to produce as a plausible sentence and
considerably harder to notice, and a footnote nobody can check is decoration —
decoration that looks like evidence, which is worse than none.

So the model is not asked for a reference. It is asked to **quote the words it
is relying on**, and `lib/cite.ts` goes and finds them. A quote that is in the
source becomes a marker you can press, which opens the passage with the quoted
words highlighted inside it and says roughly which page. A quote that is *not*
there becomes a visible failure: the marker reads `3?` rather than `3`, the
page says so before you open anything — *1 of 3 citations could not be found* —
and pressing it says the words are not in that file and to treat the sentence
as the model's own. Unfound citations are kept rather than quietly deleted:
removing them would make the page look better and be worth less, since the
claim whose evidence turned out not to exist is exactly the one a reader most
needs flagged.

The guarantee therefore does not rest on the model being honest, only on it
being quotable. The matching is forgiving in the ways that do not matter —
line breaks, doubled spaces, curly quotes, `--` for an em dash, a word
hyphenated across a line break — and strict in the one that does: if the words
are not there, nothing pretends they are. A quote under twelve characters is
refused outright rather than matched, because it is not evidence of anything.

**And a page knows when its sources have moved on.** It records what it was
made from and when. Add or remove a source afterwards and it says so — *1 was
removed since this page was made; what is on it still says what it said then*.
Only for pages that were actually made from something: telling people their own
writing is stale is how a notice gets ignored.

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

**Six one-press edits** — Review, Add comments, Add logs, Fix bugs, Port to…,
Explain. Taken from ChatGPT's canvas, which settled on this set, because they are
the things people ask for over and over and typing "add comments explaining what
each function does" for the hundredth time is the app failing to notice a
pattern. A document gets its own four instead: Tighten, Proofread, Add structure,
Explain — "Add logs" means nothing in prose. Every one of them lands as a diff
you keep or discard, except Explain and Review, which never touch the file: a
shortcut that sometimes edits and sometimes does not is one nobody trusts with
either.

**Review** was the one missing from that set, and it is the one that changes what
the surface is for. The other five all assume you have already decided what is
wrong; a review is what you press when you have not. It reads the file the way a
colleague would and reports what it finds — and it is asked, in as many words, to
be allowed to find nothing, because a reviewer who must produce a finding will
produce one, and an invented objection costs more than silence. On a canvas that
has siblings it gets them as context, so "this duplicates the helper in utils" is
available to it. It is on code and web files only: a prose page does not want a
code review, and the four writing shortcuts already cover what it would say.

**Changing only what you selected.** Select six lines, and the message bar stops
asking about the file and starts asking about the six lines: the chip reads
*Lines 5–11*, the placeholder becomes "Change just these lines", and what goes to
the model is the selection marked as the thing to rewrite with the rest of the
file attached as context it is told not to return. Claude's artifacts added this
in June 2026, and the reason is arithmetic: "make this a loop" against a
four-hundred-line file is four hundred lines regenerated, which is slow, costs
four hundred lines of tokens, and gives the model four hundred chances to change
something you did not ask about. Against eleven lines it is eleven. The context
either side is not optional — six lines rewritten blind invent a signature that
does not match the call two hundred lines up.

The threshold is twelve characters. Below that a "selection" is a double-clicked
variable name or a caret being dragged, and a bar that changes what it is asking
every time you double-click a word is wrong more often than right. Accepting the
change lets the selection go, because the lines you selected are not the lines
you now have.

**One app under two lights.** The two themes had drifted apart, and not in a way
a screenshot of either would show — each looked fine alone. Measured side by
side, every text role in both themes, the answer was unambiguous: typography was
already identical, and **119 colour roles diverged, every single one the same
way** — light weaker than dark by about 2.5 points on body text and up to 6.3
inside a code block.

Underneath it was one structural mistake repeated. An inset panel is darker than
the page in both themes; in dark that moves it *away* from the light text and in
light it moves it *toward* the ink, so the same design decision spends contrast
in one theme and earns it in the other. Light's inset stepped 1.17 from its page
where dark's stepped 1.07, and its subtle fill stepped 1.09 where dark's stepped
1.23 — which is why a user's own message bubble was a clear pill in dark and
very nearly nothing in light. What has to match between two themes is the size
of the step, not the colour.

So the light palette was re-derived rather than nudged: each role solved for the
contrast its dark counterpart already had, moving lightness only, so the navy
stays navy. Body text now lands within a tenth of dark's figures.

**Two roles are deliberately not matched, by name, with the reason.** A near-black
page lets a colour be light *and* saturated at once; cream does not. Chasing
dark's 11.5 for syntax turns seven hues into seven browns — the solver's answers
at that target were `#3b3f49`, `#1e2d67`, `#103045`, `#3c200d`, by which point
nothing is a keyword rather than a number. They sit in one band at about 7.6
instead, and the cost is measured: the two closest of the seven are 42 apart in
RGB against 50 before. The gold nib is the other: matching 8.89 needs `#554010`,
which is not gold, it is brown. It went from 3.29 to 4.52 — over the 4.5 that
small text needs — with hue and saturation untouched at 42° and 69%.

`theme-parity.mjs` is the gate. Typography is held at **zero** difference, since
size and weight are not theme decisions. Contrast is held within 2.6, with the
two exceptions listed by name so "accepted" can never quietly grow to mean
"whatever fails today". It also checks the *shape* of what remains: before, every
gap leaned one way, which is what "the light theme looks washed out" is
numerically. Now 48 lean one way and 26 the other — scatter, which is what two
themes of one app look like.

**⌘K takes a sentence, not just a search.** The palette could *find* things and
could do nothing to them, so a sentence typed into it was a search that failed.
That is backwards: "make this shorter" is the first thing anybody tries in a box
that opens over whatever they are looking at, and it was the one thing it could
not do.

It now knows what is on screen. Type an instruction with a file open and it is
sent as a change to that file, arriving as a diff like any other; with a page
open it rewrites the page; in a conversation it becomes the next message; on a
blank chat it starts one. The placeholder says which — *"Search, or say what to
do with this file"* — because a box that quietly means different things in
different rooms is a box you stop trusting.

Searching still works, which is the half that is easy to break. The instruction
row appears only for something that reads like a sentence — a space and at least
eight characters — and only goes *above* real matches at three words or more. So
`settings` stays a lookup however much is on screen to act on, and two words
that find something are never displaced by an offer to ask a model instead.
Pressing Enter on a search must not turn it into a request.

**A second opinion, from somewhere else.** Any answer can be checked, and the
checker always comes from a **different provider**. This is the one thing an app
holding several providers' keys can do that a single-provider app cannot do
honestly: a model asked to check its own answer reproduces the same reasoning
from the same weights and reports that it holds up, which is not verification —
it is an echo with extra steps, and it is worse than no check because a reader
takes it as evidence.

The checker is given the question and the answer and is **not told which model
wrote it**; a checker told it is reviewing a famous model's work has a thumb on
the scale, in whichever direction. It is told that flattering the answer and
hunting for fault to justify being asked are both ways of not answering, and
asked to name *which claim* — "the third paragraph says X; that is wrong because
Y" is useful, "some details may be inaccurate" is the failure mode. It comes
back as one of three verdicts, because the useful middle one is "the substance
holds but this bit is wrong", and a system with only pass and fail pushes every
partial disagreement into whichever of the two is less true.

An agreement is drawn quietly and a disagreement in the warning colour — no
green ticks, because that is how a *checked* answer starts reading as a
*correct* one. Two models agreeing is evidence, not proof; they can be wrong
together, and are most likely to be wrong together exactly where the question is
hardest. Where there is no second provider configured, it says so and does
nothing — a check that could only ever say yes is worse than none.

**Auto: one AI that knows how to use every AI.** The app held four providers'
keys and asked you which to use. That is "all the models in one app", and it is
the weak version of the idea — because the person asking the question is the one
least equipped to answer it. Knowing that *this* request wants the long-context
model rather than the fast one means knowing what all of them are, which is the
work the app was supposed to be doing.

Auto sits at the top of the model picker, on its own, above the models, because
it is not one of them: it is the choice not to choose. It reads what you asked
for — is there an image in it, how much has to be read, is this code, is this a
judgement, is this a two-line rewrite — and picks from the models you actually
have keys for. A one-line translation goes somewhere fast and cheap; "why would
you choose an event-sourced architecture here" goes somewhere that thinks; a
refactor goes to something good at code.

Two rules matter more than the routing table:

 - **Requirements are not preferences.** Vision and context window are things a
   model has or does not, and they are settled before anything is weighed
   against cost. An answer from a model that could not read the question is not
   a cheaper answer, it is not an answer. When nothing configured can hold the
   input, that is said rather than quietly truncated.
 - **It says why, and you can overrule it.** Every routed answer carries its
   reason next to the model's name — *this is about code*, *there is an image in
   this*, *it is long, about 300k tokens to read*. A router you cannot see is a
   router you cannot correct, and "it sent my hard question to a cheap model" is
   only a complaint you can make if you were told. Picking a model by hand turns
   all of it off; your choice answers, however the router would have judged it.

**Sometimes the right model is no model.** A question that is only arithmetic is
answered by a calculator, here, exactly, for nothing — `948,392 × 73` comes back
as **69,232,616** with *worked out here, a sum does not need a model*. A language
model does not do long multiplication; it predicts what the answer looks like,
which is usually the answer and is not the same thing, and you cannot tell the
two apart by looking. The parser is a real grammar and not `eval`: numbers, five
operators, parentheses, and a flat refusal of everything else. It declines more
than it accepts — `42` is a number and not a sum, `what is 2+2 and why` is a
question, `1 / 0` has no answer, and `1,5 + 1` is a genuine ambiguity between a
decimal comma and a thousands separator, so it is refused rather than guessed.
The answer is credited to **Calculator**, not to a model that was never called.

It is a small feature standing for a large principle: a system that routes
between models should also know when the right route is no model at all.

**You can watch it work, and stop it.** Every one of these calls was already a
stream. The tokens were arriving a few at a time and being poured into a buffer
nobody could see — so a revision of a four-hundred-line file was forty seconds
of a spinner, with no way to tell thinking from hung, no idea how far along it
was, and nothing to press. Chat had streaming and a stop button from the
beginning; everything else in the app was built on the one-shot path, which is
the right shape for generating a conversation title and the wrong one for
anything a person is sitting in front of.

Now every revision, plan, review, check, element change and notebook page says
what it is doing (*Writing the change*), shows the text arriving, counts the
characters as they land — a moving number answers "is this alive" in a way a
spinner cannot, since a spinner spins just as smoothly when nothing is coming —
and turns the send disc into stop, in place.

**Stopping a file changes nothing; stopping a review keeps what arrived.** Same
abort, opposite handling, and it is the part worth getting right. A file that
stopped arriving is a file with its end missing, and offering that as a diff
would read as *the rest was deleted* — so a stopped revision is thrown away and
says *Stopped. Nothing was changed.* A stopped review is most of a review, so it
is kept and says *Stopped — this is as far as it got.* The difference is whether
the thing is read or run.

**Code that belongs to a project.** A project already held instructions and
material that every chat started inside it could see. The code in that same
project could not — so the conventions you wrote once, for the thing you were
building, were the one context missing from every edit to the thing you were
building. A canvas can now belong to a project, and when it does, the project's
instructions ride along with every revision, selection rewrite, review, plan and
element change made in it.

Two layers, widest first, because the narrower one has to be able to win: the
project says *TypeScript everywhere*, and a file is still allowed to say *except
this one, it is a build script*. They arrive labelled — `From the project
“Counter course”:` and `For this file in particular:` — so it is clear what is
speaking when they disagree.

Deleting a project **releases** its canvases rather than deleting them, exactly
as it already did for its chats. Deleting a project says "I am done with this
grouping", not "burn the work that was in it", and code is the last thing
anyone means to throw away by tidying a folder.

**Ask about this project.** "Where is the subscription system?" is the question
people actually have, and until now this app could only be asked about the file
already open — which means you had to know the answer in order to ask the
question. A project is the only place that knows what all of it is: several
canvases, each possibly a folder, plus whatever material was added to it. One
box on the project page reads across all of it at once and answers by **naming
files** — "the markup is in Counter / index.html, the behaviour is in Counter /
app.js" — because "it is handled in the billing logic" is not an answer.

It never edits: a feature that sometimes answers and sometimes rewrites four
files is one nobody asks anything. It is told that a confident guess about
somebody's own code is worse than nothing, because it is checkable and they will
not check it. And what did not fit in the budget is **named** rather than
dropped in silence — an answer that says "not in this project" because the file
was quietly cut is worse than no answer, because you believe it.

**Point at it.** The page is running in a frame beside the editor. Press *Point
at it*, and the next click on that page chooses an element instead of pressing
it: the thing under the cursor lights up as you move, the composer's chip
changes to *the “Start Lesson” button*, and the question becomes "change this"
rather than "change the file".

This is the one thing the app could not do. Everywhere else it lets you
**describe** a change; nothing let you **indicate** one — and "make the blue
button roughly in the middle of the dashboard smaller" is a translation step,
which is exactly where intent goes missing. If you can see it, you should be
able to select it and say what to do with it.

Four things make it worth having rather than a demo:

 - **Choosing is not pressing.** The click is taken in the capture phase and
   stopped, so the page's own handler never fires. A picker that also pressed
   the button would submit the form you were trying to describe — the test
   presses the counter to 1, picks it, and asserts it is still 1.
 - **The model is shown the element, not a description of it.** What goes up is
   the element's own markup and where it sits (`main > div.row > button#up`),
   which is an anchor; "the button in the middle" is a guess.
 - **The change lands in the file it belongs in.** This is the hard part, and it
   is not the file you were looking at. "Make it smaller" is the stylesheet,
   "call it Begin instead" is the markup, "do nothing until the form is valid"
   is the script. The model is asked to *name* the file, the name is checked
   against the folder — anything invented is refused rather than created — and
   the diff is of that file. You can point at markup and accept a change to
   `style.css`.
 - **The mode ends with the pick,** and the element is let go once its change is
   in: what you pointed at may not exist in that shape any more, and a chip
   still claiming to be about it would aim your next sentence at a description
   of something that has been rewritten.

Turning the picker on and off is a `postMessage` into the running page, never a
rebuilt `srcDoc`. That is not a detail: a new `srcDoc` is a fresh load, so a
picker you toggled by re-assembling would reset the counter, reshuffle the deck
and scroll you to the top every time you reached for the thing meant to let you
point at what you were looking at.

**Plan, before it touches anything.** The step everybody skips and then wishes
they had not: *analyse this, do not modify anything, tell me what you would do.*
Both terminal agents treat it as a mode rather than a phrasing, and the reason
is that the expensive mistake is never a bad edit — it is a *plausible* edit to
the wrong thing, which you catch after it has landed on four hundred lines.

The difference between this and Review is that a plan is **executable**. A review
hands you prose and leaves you to translate it back into a request, and the
translation is where the intent leaks: you read "the concat in the loop is
quadratic", type "make it faster", and get something else. Here each step comes
back with its request already written, so approving one is a press. They run one
at a time, in order, each arriving as its own diff, and a step is ticked when its
change was *kept* — a step whose diff you discarded did not happen. There is
deliberately no "do all of it": a plan whose only button applies four changes at
once is a whole-file rewrite wearing a list, which is the thing planning exists
to stop you doing by accident.

**House rules** — `CLAUDE.md` for one canvas. The observation both agents are
built on is that most of what you tell a model is not about the request at all:
it is the language, the framework, the conventions, the one thing nobody is
allowed to touch. Retyped at the top of every message, it ends up half-said and
then not said. Written once here, it rides along with every edit, every selection
rewrite, every review and every plan — marked as *standing* and placed after the
instruction, because when the two disagree the rule has to win, and a rule that
arrives first reads as background to the actual ask.

**Check it, before you keep it.** Reviewing is a different task from writing,
which is why it is worth a second call rather than a longer first one: the same
model that confidently produced a diff will, asked to check one, notice the call
site it did not update. It is asked about the *diff* and not the file — a
reviewer handed the whole result reports on code that was already there and was
not up for discussion, which buries the one sentence that matters. Three
questions: did it do what was asked, what else did it change, what could it
break. "It does what was asked and I cannot see anything it breaks" is a correct
answer and it is told so.

**Fix this** — the loop the terminal agents are built around, as far as a browser
goes. There is no shell here and there are no tests, so most of what makes an
agent an agent is simply not available and pretending otherwise would be theatre.
But a web canvas genuinely *runs*, in a sandboxed frame, and its console
genuinely comes back with the file and line already translated out of the
assembled page. An error there gets a button, and pressing it sends what actually
happened — the error, and where — rather than a reading of the code. It asks for
the cause and says so: not a `try`/`catch` round the line that threw. It arrives
as a diff like everything else, because the one edit made in the most hurried
moment is the last one that should land unseen.

**Find in this file** — `⌘F`, the key everybody presses, intercepted before the
browser gets it. It counts what it found ("3 of 7"), Enter walks forward,
Shift-Enter walks back, Escape closes it, and each match is *selected* in the
textarea rather than merely scrolled to, so the next thing you type replaces it.
Opening it with something already selected seeds the box with that. None of this
is novel; its absence was the problem. A file past about fifty lines without find
is a file you hunt through, and both surfaces this was measured against have had
it for years.

Every accepted change is a version, and so is the state it replaced, so reverting
is always possible even when the first edit came from the model. History is per
file. Reverting writes a *new* version rather than deleting the ones after it,
because an undo that destroys history is how you lose the thing you were trying
to get back to.

**Look** — taken from the object the brand is: a fountain pen on cream paper.
Paper (`#f7f3ea`) is the ground — ivory, not white and not yellow. Ink (`#1a2650`)
is the words: a saturated navy, the colour a good blue ink dries to, and the only
colour most of a screen is ever made of. Gold (`#d4af5a`) is the nib — a jewel,
never a surface: the last letters of the signature, a badge, the tip of the caret,
the edge of the ring while an answer is arriving. Leather (`#8a4b1d`) is the desk: warmth in the
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

**The mark** — the word in a hand, in two tones: *Ar* in the ink, *mı* in the gold
of the nib. It is two spans rather than one gradient, because a gradient needs
`color: transparent` and `background-clip: text`, and in forced-colors mode that
is a wordmark which renders as nothing at all. Pinyon joins its letters, so the
second half is pulled back by the width of the connector between the r and the m
to put that join back.

There is no dot. The i is set as a dotless *ı* — the letter as a pen leaves it
when it does not come back up — so the word ends on the stroke rather than on a
piece of punctuation. It used to be a gold circle drawn over the type, which
also meant one thing on the screen that was not the typeface and could sit in
the wrong place if the script failed to load. Nothing is drawn over the word now.

It sits at 38px in the sidebar corner, not the 30 it started at. A copperplate
script is all hairlines and joins, and at 30 those joins fall below a pixel and
the name reads as a squiggle — the answer was never a different typeface, it was
more room. The app icon is the initial in the same hand on the navy, and nothing
beside it.

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
- First Load JS **245 kB** for the app route, under the 250 kB budget, and 179 kB
  actually across the wire. It went *over* at one point and nothing noticed: the
  catalogue of starters is forty-eight kilobytes of markup, styling and behaviour,
  it was imported where the row that lists them is rendered, and so everybody paid
  for five folders most people never press. The list and the folders are separate
  modules now; the folders arrive when one is chosen, which is a round trip nobody
  notices against a database write and a page load. `e2e-scale.mjs` weighs the
  first load on every run, because that is the only way this stays true.
  The markdown pipeline (micromark, GFM, KaTeX) is a separate chunk, Shiki grammars
  load per language on demand, and Settings is dynamic.
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
- **The round trip, driven for real** (`e2e-backup.mjs`): a canvas with three
  files and a history, a page and a conversation are made, saved to a file, and
  the file is read back off disk — checked for containing the work rather than
  a summary of it, for being readable (the sentence typed into the page is
  right there in the JSON), and for *not* containing the API key that was in
  settings the whole time. Then everything is deleted, the file is restored,
  and the page is opened to confirm it is the same work and not a shell of it.
  Then restored a second time, to confirm nothing doubles.
  Both halves were checked by putting the bug back. With the old delete, seven
  rows survived "delete everything" and the gate went red.
- **The app under weight** (`e2e-scale.mjs`), which is where two things had
  silently gone wrong. Everything else here is tested at three messages, where
  nothing is slow and nothing is heavy.
  Typing in the composer took **217ms a character** in a four-hundred-turn
  conversation. The page writes a draft in exactly one place and never reads
  one, and it had subscribed itself to the store it wrote to — so every
  keystroke re-rendered the page, which rebuilt the transcript: four hundred
  elements mapped and reconciled between one letter and the next. Reading the
  store imperatively writes without listening, and the transcript is memoised
  so an unrelated render cannot rebuild it either. 2386ms → 246ms for eleven
  characters. The gate asserts both a wall-clock budget and that no keystroke
  blocks the main thread for more than a tenth of a second — a stopwatch alone
  is a flake waiting for a slow machine, and "did anything block" is the
  question a person actually feels. It was checked by putting the bug back:
  2558ms, worst task 252ms, two assertions red.
- Using a made thing, driven as someone would use it (`e2e-use.mjs`): a deck is
  taken two cards in, handed the window, and asked whether it is still on card
  two — the one thing that would silently break, because it is what a reload
  looks like. Then that everything else has stood down, asked by *visibility*
  rather than presence, since hiding in place is the whole point. Then Escape,
  from inside the frame. Then a request to make something, checked for coming
  back as a page rather than a description of one, for landing as a web app
  rather than a file, for being named from its own `<title>`, and for already
  running. Then a book: attached, and the prompt read back off the mock to
  confirm the book itself went — 200 passages of it, not three pages — under an
  instruction that asks for a course rather than a summary.
- A sweep for what was never checked rather than what was: every starter in
  both themes at 1440 and 390, a real PDF and a real scan into the notebook,
  keyboard-only operation reaching *into* a sandboxed frame, 200% text zoom, and
  the app with no key at all. Four faults came out of it. The sliding indicator
  was pinned to the middle of its container, which is right on one line and 22px
  wrong the moment the row wraps — as the composer's does at 390px, so on a
  phone it marked the wrong option. The week grid dragged the whole page wide on
  a phone, because a grid item's automatic minimum size is its content and a
  640px child ignores however narrow you say the column may be. `cheapestAvailable`
  ended `?? settings.modelId` — a sensible-looking default that is a lie when no
  provider has a key, so it returned a model that could not be called and every
  caller's "tell them there is no key" branch was unreachable: asking a canvas
  for a change with no key did *nothing at all*. And a view transition's
  direction was cleared only if the attribute still held the value it had set,
  which two overlapping moves in the same direction would get wrong.
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
- **Both themes measured against each other** (`theme-parity.mjs`). Two findings
  came out of getting the *measuring* right rather than the app. It read
  `oklab(0.944416 0.00167131 0.0171635 / 0.4)` by pulling the first three numbers
  out and calling them red, green and blue — so it reported a 3.24 contrast
  failure on a surface that is almost white. And it treated every 0.74-alpha
  glass panel as opaque, which is most of the app's chrome. A tool that invents
  defects is worse than none, because somebody goes and changes a colour that
  was right.
- **An audit of what a six-route sweep cannot reach** — hover and focus states,
  status colours, surface steps, hard-coded literals, the syntax palette —
  fanned out and then adversarially verified, each finding handed to an agent
  asked to *refute* it. Most were refuted, several because they quoted values
  that the runtime fix had already changed. Three survived and all three were
  real: the subtle-fill step above; a Settings toggle whose knob was pinned to
  `bg-white` while its track was tokenised, so in dark a white dot sat on pale
  periwinkle at **1.89:1** and the switch's ON state all but vanished, under the
  3:1 floor a control state has to clear; and dark's syntax comment at 5.64, the
  only token under 7 in either theme and the one place the two disagreed about
  whether a comment recedes at all.
- **One command in three rooms** (`e2e-command.mjs`, 14 assertions): the same
  sentence typed into ⌘K over a file reaches the model *with that file* and comes
  back as a diff; typed in a conversation it arrives as a message; and a one-word
  query stays a search. Two of the assertions exist because the first versions
  were wrong about the app rather than the other way round — "Chat" is the
  composer's mode toggle and not the section, and `dark mode` matches nothing in
  the palette, so offering it as an instruction is correct behaviour and not the
  bug the test was written to catch.
- **The second opinion, driven across two providers** (`e2e-verify.mjs`, 16
  assertions). This required teaching the mock **OpenAI's wire format** as well
  as Anthropic's: until it spoke both, nothing this app does across two
  providers was testable at all, because a request correctly routed elsewhere
  left the harness and died against a real endpoint — which looks exactly like
  the feature being broken. The mock now disagrees on purpose, since a mock that
  always agrees leaves the only interesting half untested. The refusal path is
  asserted against the database rather than the screen: "how many verdicts were
  written" is exact, where "is the phrase on the page" is a question about
  everything ever rendered.
- **The router and the calculator, tested on their own** (`test-route.ts`, 65
  assertions, `npx jiti test-route.ts`). No browser, no model, no network — the
  interesting cases are the ones where a plausible-looking answer is the wrong
  one: `2 ^ 3 ^ 2` is 512 and not 64, `0.1 + 0.2` must not print
  `0.30000000000000004`, an image must not be routed to a model without eyes,
  and the same question must route the same way twice or nobody can reason about
  it. Run with `jiti` rather than Node's `--experimental-strip-types`, which
  cannot resolve extensionless TypeScript imports — and adding `.ts` extensions
  across `lib/` to suit one test file would be the test changing the app to fit
  itself.
- **Auto driven end to end and read at the wire** (`e2e-auto.mjs`, 16
  assertions): which model each request was *addressed to*, not which one the
  app believes it chose. Including the one where the wire stays empty, which is
  checked against a reset endpoint so "no model was called" is a fact about that
  question rather than a coincidence about the previous one.
- Two things the suite caught rather than confirmed. `/__last` in the mock meant
  "the last request", which on every new thread is the call that writes the
  conversation's *title* — so the assertions about which model answered were
  reading the titler. And a sum was being credited to Claude Sonnet 4.5, because
  `getModel` falls back to the default for an id it does not know: a small lie
  told by the one feature whose entire point is that it called nothing.
- **Watching and stopping, measured during the stream** (`e2e-watch.mjs`, 12
  assertions, needs the slow mock). The count is read twice a second apart and
  asserted to have *moved*, because "there is a number on screen" is not the
  claim — a frozen number is exactly the failure a spinner hides. Then the file
  is stopped mid-write and read back byte for byte, and a review is stopped and
  found still on screen. The first version of this test used a seven-line file
  and finished before the first assertion could look at it, which is also the
  honest reason the feature exists: nobody minds a spinner for a second.
- **Generated cases, against the invariants rather than the examples**
  (`test-fuzz.ts`, `npx jiti test-fuzz.ts`). The three files above check the
  cases somebody thought of; this one checks the ones nobody did. Four thousand
  generated expressions against a trusted evaluator and another two thousand
  integer ones against BigInt, because a 1e-12 tolerance is the right comparison
  for a quotient and exactly the wrong one for the product bug that started the
  rewrite — `123456789 * 987654321` came back nine short and every example test
  passed. Two thousand date- and phone-shaped inputs, none of which may be
  answered as arithmetic. Three thousand folded strings, checked for idempotence
  and for every offset landing inside the string it came from — the case that
  broke on `İ`, whose lowercase is two characters. Fifteen hundred quotes lifted
  verbatim out of generated text, which must always be found, and fifteen
  hundred invented ones, which must never be. And twelve hundred JSON replies
  wrapped four different ways with fenced code inside their fields. The
  generator is seeded, so a failure is reproducible rather than a story about
  something that happened once.
- **The preview assembler and its source map** (`test-web.ts`, 19 assertions,
  `npx jiti test-web.ts`). The claim worth testing is not "the CSS got inlined",
  it is that a runtime error at line 214 of a document nobody wrote comes back as
  a file and a line you can go to — so the test round-trips *every line of every
  file* through the assembler and asserts each one reports itself. That is the
  assertion that catches a map built by searching the finished string for each
  file's text, which finds `index.html` never, because by the time the search
  runs the string has been rewritten by every replacement it is searching for.
- **The citation matcher, tested on its own** (`test-cite.mts`, 44 assertions,
  run with `node --experimental-strip-types`). Not through the UI, because the
  interesting cases are the ones a PDF actually produces and they are cheaper to
  state directly: a quote broken across a line break, a word hyphenated across
  one, curly quotes against straight, `--` against an em dash, offsets that must
  index the real text rather than the normalised copy, a number that was never
  there, a source name that does not exist, and a quote too short to be evidence.
- **Sources and citations driven end to end** (`e2e-sources.mjs`, 19 assertions).
  The mock **deliberately invents one of its three citations**, which is the
  assertion this suite exists for: if the app were trusting the model, the false
  one would look exactly like the two true ones. It does not — it is marked
  before it is opened, counted out loud on the diff, and explained when pressed.
- A real defect the suite caught rather than confirmed: the "1 of 3 could not be
  found" notice lived only in the composer, which is hidden while a diff is up —
  so it appeared at the exact moment it could not be read, and vanished on
  accept. The one fact you need before deciding now sits where the deciding
  happens.
- **A project reaching its own code, read at the wire** (`e2e-whole.mjs`, 19
  assertions): a canvas made inside a project belongs to it and says so; the
  project's instructions arrive with an edit to its code, labelled and marked
  standing; a file's own rules arrive *after* them so the narrower layer wins;
  a question is answered across every file without the file ever being opened;
  and deleting the project leaves the canvas alive with its `projectId` gone —
  which is also what proves the delete actually ran rather than the assertion
  passing on a button that was never found.
- **Pointing at a running page, driven for real** (`e2e-point.mjs`, 18
  assertions). The browser clicks a button inside the sandboxed frame, and the
  suite asserts what a screenshot never could: with the picker off the counter
  goes to 1; with it on, the same click leaves it at 1 and produces a pick. Then
  the prompt is read at the wire for the element's markup and its path, and the
  database is read afterwards to confirm `style.css` changed and `index.html` —
  the file that was on screen — did not.
- The four agent-workflow additions driven end to end and read at the wire
  (`e2e-agent.mjs`, 26 assertions): a plan comes back as pressable steps with the
  file untouched, and pressing one sends the step's own instruction verbatim;
  house rules survive a reload and arrive marked as standing, *after* the
  instruction; a check is given both sides of the diff and no licence to edit;
  and a real error from a real run reaches the request with "not the symptom" in
  it. The last section breaks the page on purpose, so it raises a flag rather
  than filtering errors by message — a suite that ignores errors matching a
  pattern ignores the regression that happens to match it.
- **A bundle trade measured rather than assumed.** Three features had pushed the
  first load to 249 kB against its own 250 kB budget, which is not a margin, it
  is a coincidence. The obvious fix — load the Code section on demand — saved
  eleven kilobytes and put **half a second onto pressing the tab** (430ms → 965ms,
  measured both ways), and an idle prefetch did not recover it. That is the wrong
  trade in both directions: nobody ever noticed the kilobytes and everybody
  notices a tab that hangs, so it was reverted. What worked instead was fixing
  why the modules were stuck together at all: the blank chat page borrowed one
  row of buttons from the canvas, and chat imported `saveToNote` from the whole
  notebook. Both moved to modules of their own, and the Notebook and Projects —
  138ms and 185ms to open, measured — became genuinely free to defer. 244 kB,
  which is *lower* than before the three features were added.
- The three coding additions driven in a browser and read at the wire
  (`e2e-code.mjs`, 20 assertions): the find bar counts and walks matches and lands
  the caret *on* them; Review is asked for a review twice over and leaves the file
  byte-identical; and a selection sends the selection — the prompt is checked for
  the marked selection, for the surrounding file labelled as context, and for the
  instruction not to return it.
- A test of mine that was wrong rather than an app that was: the selection suite
  failed five assertions because it set `selectionStart` by hand and dispatched a
  `select` event, and React emulates `onSelect` from `selectionchange` and the
  pointer and key events around it — so the hand-made event arrived at nobody, and
  the app was never told about the selection the test was asserting against.
  Driven with real keystrokes it passes untouched. Worth writing down: a synthetic
  event that looks equivalent to a real one is the fastest way to test nothing.
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
- **Most of an agent workflow is not possible here, and is not pretended at.**
  Measured against what Codex and Claude Code actually do, the list of what a
  browser tab cannot have is longer than the list of what it can: there is no
  shell, so no running the test suite and fixing what fails; no filesystem, so no
  repository to search or refactor across; no Git, so no branches, worktrees,
  commits, or "find the commit that introduced this bug"; no background or
  scheduled work; no parallel agents on isolated copies of the same project; no
  MCP, because MCP servers are processes and this has nowhere to run one. Four
  things from that list *did* translate — plan-before-edit, standing rules, check
  your own change, and fix from a failure that really happened — and they are
  here. The rest would need a server, and a server is the one thing this app
  promises not to have. Said plainly because the alternative is a feature list
  that sounds like a coding agent and behaves like a text box.
- **⌘K acts on the room, not on the selection.** It knows which file is open, not
  which lines you highlighted, which element you pointed at, or which paragraph
  the caret is in — those exist in the canvas and do not reach the palette. And
  it does one thing per room: there is no routing of "explain this" to an
  explanation and "make it faster" to a revision, only "ask for this change".
- **A second opinion is one opinion.** It is one model, asked once, and two
  models agreeing can be wrong together — most likely exactly where the question
  is hardest, since that is where their training overlaps most. There is no
  third checker, no tie-break, and nothing that notices a checker with a habit
  of agreeing. And it is chat only: the canvas has its own *Check it*, which
  compares a change against what was asked rather than asking anybody else.
- **The router routes; it does not benchmark.** Which model is fast, which is
  careful and which is good at code is a small hand-kept table, informed by what
  the makers publish and by using them — not by measured win rates on this app's
  own traffic. It has no memory of how a model did on your last request, no
  per-task scoring, and no way to learn that it was wrong. An unlisted model
  gets the middling row, so adding one to the registry and forgetting the table
  produces a usable default rather than a model that is never chosen.
- **Auto is chat only.** The canvas and the notebook still use the model their
  own picker names. Their work is longer and more expensive per call, which is
  an argument for routing it, not against — it is simply not done yet.
- **The calculator is arithmetic and nothing else.** Not unit conversion, not
  dates, not percentages of things, not "sort these 100,000 rows" — which is the
  other half of the same principle and needs somewhere to put the rows.
- **A citation proves a quote exists, not that it supports the claim.** The check
  is that the words are in the file. Whether the sentence they are attached to is
  a fair reading of them is a judgement no string match makes, and a green marker
  should be read as "this is really in there, go and look" rather than as "this
  is true". Nor is there any check on what was *left out*.
- **Page numbers are estimates.** A PDF's text has no page boundaries left in it
  by the time it is one string, so "around page 212" is an even division, not a
  lookup. It is the difference between "somewhere in a 400-page book" and a place
  to start, which is the difference between a citation you check and one you do
  not — but it is not a reference.
- **Sources are text only.** PDFs are read for their text and a scan is refused
  with a reason rather than accepted as an empty book. Images, audio and video —
  the photographs, recordings and meetings that a notebook meant as "bring your
  world" would have to take — need transcription this app has nowhere to run.
- **A project is not a repository.** It groups canvases, knowledge and chats, and
  a question can be asked across all of it — but there is no dependency graph, no
  "this change affects 17 components", no project map, and no rename that follows
  a symbol across files. The question box reads the files; it does not understand
  the edges between them.
- **Pointing is one element and one file at a time.** You cannot rubber-band an
  area, multi-select six cards and say "make these the same height", or annotate
  with a pen — all of which are the obvious next moves and none of which are
  built. Nor does a pick survive a reload: it is gated on the run token, so an
  element chosen in a version of the page you have already replaced is dropped
  rather than acted on, which is right but means the crosshair is a per-edit
  gesture and not a persistent selection.
- **The one real loop is one file deep.** "Fix this" sends the error and the file
  it names. It does not re-run the page and check the error is gone, and it does
  not chase a cause into a sibling file — it is told to leave the file unchanged
  and say so rather than invent a local change that hides the real problem. A
  genuine run → fix → re-run cycle is buildable on top of the sandbox and is not
  built.
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
node theme-parity.mjs # the two themes measured against each other, role by role
node shoot-smoke.mjs  # every section loads, undo works, no runtime errors

# and four that need no browser at all:
node --experimental-strip-types test-cite.mts   # the citation matcher, on its own
npx jiti test-route.ts                          # the model router and the calculator
npx jiti test-web.ts                            # the preview assembler and its source map
npx jiti test-fuzz.ts                           # generated cases against the invariants
```

And the end-to-end run, which needs the app pointed at the mock provider:

```bash
node mock-provider.mjs &
ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100 &
node e2e.mjs         # 16 assertions across the whole happy path
node e2e-canvas.mjs  # 26 assertions: edit, revise, diff, keep, revert, sandbox
node e2e-project.mjs # 22 assertions: projects and styles, read at the wire
node e2e-web.mjs     # 28 assertions: a web app runs, and its console comes back
node e2e-mode.mjs    # 14 assertions: Chat and Creative, read at the wire
node e2e-pdf.mjs     # 10 assertions: a PDF read, a scan refused, both at the wire
node e2e-editor.mjs  # 15 assertions: the code editor's two layers, measured
node e2e-makes.mjs   # 30 assertions: every starter opened, run and actually used
node e2e-bar.mjs     # 25 assertions: the message bar, measured in all three rooms
node e2e-motion.mjs  # 17 assertions: the motion, asked for rather than admired
node e2e-use.mjs     # 18 assertions: using a made thing, and making one from a book
node e2e-scale.mjs   #  7 assertions: what it costs to open, and 400 turns deep
node e2e-backup.mjs  # 18 assertions: a copy of everything, and everything back
node e2e-code.mjs    # 21 assertions: find, review, and changing only a selection
node e2e-agent.mjs   # 30 assertions: plan, house rules, check, and fix-from-error
node e2e-point.mjs   # 19 assertions: pointing at a running page and changing it
node e2e-whole.mjs   # 19 assertions: code inside a project, and asking across it
node e2e-sources.mjs # 19 assertions: many sources, and citations that are checked
node e2e-auto.mjs    # 16 assertions: which model answered, read at the wire
node e2e-command.mjs # 15 assertions: ⌘K acting on whatever is on screen
# and one that needs a second provider, so the mock serves both wire formats:
OPENAI_BASE_URL=http://127.0.0.1:8787 OPENAI_API_KEY=sk-mock …
node e2e-verify.mjs  # 16 assertions: a check that comes from another provider
node mock-slow.mjs &   # the mock with the gap between tokens stretched, then:
node e2e-stop.mjs    #  9 assertions: stopping mid-answer (needs the slow mock)
node e2e-watch.mjs   # 12 assertions: seeing it work, and what stop means
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
