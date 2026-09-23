"use client";

import { readWhole } from "@/lib/digest";
import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Eraser, Highlighter, Loader2, MousePointer2, PenLine, Trash2, Undo2, X } from "lucide-react";
import type { ContentBlock, Lesson, LessonTurn } from "@/lib/types";
import { addLessonTurn, addCards, createDeck, createNote, db, deckForSource, inkFor, saveInk } from "@/lib/db";
import { renderPage, pageText, pageLayout, findQuote, type TextRun } from "@/lib/pdf";
import { boundsOf, composite, marksMarkdown, parseMarks, quotesIn, type Stroke, type Tool } from "@/lib/ink";
import { complete, whyItFailed } from "@/lib/complete";
import { draftCards } from "@/lib/generate";
import { resolveCast, shortName } from "@/lib/presets";
import { useSettings } from "@/lib/store";
import { rulesText } from "@/lib/rules";
import { cn } from "@/lib/utils";
import { Button, Tooltip } from "@/components/ui/primitives";
import { MessageBar } from "@/components/chat/MessageBar";
import { Markdown } from "@/components/chat/Markdown";
import { Ink, type Box } from "@/components/study/Ink";

/**
 * Working through a document with the app, rather than asking it about one.
 *
 * The difference is on screen. A file you attach to a question disappears
 * into the question; here the page stays where you can see it, the
 * conversation sits beside it, and both know which page you are on. That is
 * what a person sitting next to you with the book open can do and a chat
 * window cannot.
 *
 * ## The page is a page
 *
 * You can write on it. A pencil draws, a marker highlights, a rubber takes
 * it back, and what you drew is still there tomorrow (`lib/ink.ts`). When
 * you ask something, the page goes with the question *with your ink on it*
 * — so "is this right?" written beside a line of working is a question the
 * model can see, not one you have to type out. Drag a box around anything
 * and only that part goes; the box is cut from the inked page too.
 *
 * ## It can point back
 *
 * When the model refers to a line, it quotes it; press the quote and the
 * words light up on the page, found by where pdf.js says they are. And when
 * it marks your working, a tick or a cross lands beside each step, down
 * the side of the region you drew — so the answer is on the page, where a
 * teacher's would be, not only in the chat.
 *
 * ## It teaches rather than tells
 *
 * The first thing offered about a region is a hint, not an explanation.
 * Heavier assistant use tracks *lower* critical-thinking scores through
 * cognitive offloading (Gerlich 2025), and the 2026 study modes all
 * converged on the same defence: hints before answers, a check after every
 * explanation, and not handing over the last step while the person is
 * clearly trying it. The stance says so; the chips are ordered so.
 */
export function Tutor({ lesson, configured, onLeave, onAsk }: {
  lesson: Lesson;
  /** Which providers the host has a key for; a cast asked without this
      reports "no key configured yet" beside an answer it just gave. */
  configured: Record<string, boolean>;
  onLeave: () => void;
  /** Take something into the main chat, where the whole cast is available. */
  onAsk?: (text: string) => void;
}) {
  const settings = useSettings();
  const [page, setPage] = React.useState(lesson.atPage || 1);
  const [shot, setShot] = React.useState<{ url: string; width: number; height: number } | null>(null);
  const [box, setBox] = React.useState<Box | null>(null);
  const [asking, setAsking] = React.useState(false);
  const [live, setLive] = React.useState("");
  const [question, setQuestion] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [tool, setTool] = React.useState<Tool>("point");
  const [strokes, setStrokes] = React.useState<Stroke[]>([]);
  const [penSeen, setPenSeen] = React.useState(false);
  const [highlights, setHighlights] = React.useState<Box[]>([]);
  const [marks, setMarks] = React.useState<{ x: number; y: number; ok: boolean; n: number }[]>([]);
  const bytes = React.useRef<ArrayBuffer | null>(null);
  const layouts = React.useRef(new Map<number, TextRun[]>());
  const chatRef = React.useRef<HTMLDivElement>(null);
  const pageRef = React.useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = React.useState(true);
  const inkLoadedFor = React.useRef<string>("");

  const turns = useLiveQuery(
    () => db.lessonTurns.where("lessonId").equals(lesson.id).sortBy("at"),
    [lesson.id],
    [] as LessonTurn[],
  );

  /* The engine, chosen the way every other room chooses one: the Tutor cast,
     told there is a picture in this, so it lands on something that can see.
     Where the browser holds one company's key that is the model it picks;
     where it holds none it says so rather than failing at the send. */
  const cast = React.useMemo(
    () => resolveCast("tutor", { configured, keys: settings.keys, hasImage: true }),
    [configured, settings.keys],
  );

  /* Drawn on arrival and on every page change — and only then. Keyed on the
     lesson's id rather than its bytes: every turn saved bumps the lesson's
     row, the live query hands back a fresh Blob for the same file, and an
     effect keyed on the Blob redrew the page and wiped the marks the answer
     had just put on it. The bytes are read once. */
  React.useEffect(() => {
    let alive = true;
    setHighlights([]);
    setMarks([]);
    setBox(null);
    void (async () => {
      try {
        if (!bytes.current) bytes.current = await lesson.bytes.arrayBuffer();
        if (lesson.mimeType.startsWith("image/")) {
          const url = URL.createObjectURL(lesson.bytes);
          const img = new Image();
          await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
          if (alive) setShot({ url, width: img.naturalWidth, height: img.naturalHeight });
          return;
        }
        const out = await renderPage(bytes.current, page, { width: 1400 });
        if (alive) setShot({ url: out.url, width: out.width, height: out.height });
      } catch {
        if (alive) setNotice("That page would not draw. The file may be damaged.");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, lesson.mimeType, page]);

  /* The ink on this page, loaded when the page changes and kept on every
     stroke. Keyed so a save from the page just left cannot land on the new
     one. */
  React.useEffect(() => {
    const key = `${lesson.id}:${page}`;
    inkLoadedFor.current = "";
    void inkFor(lesson.id, page).then((row) => {
      setStrokes(row?.strokes ?? []);
      inkLoadedFor.current = key;
    });
  }, [lesson.id, page]);

  const changeStrokes = (next: Stroke[]) => {
    setStrokes(next);
    if (inkLoadedFor.current === `${lesson.id}:${page}`) void saveInk(lesson.id, page, next);
  };

  // Where you were, kept, so closing and coming back opens the same page.
  React.useEffect(() => {
    void db.lessons.update(lesson.id, { atPage: page });
  }, [lesson.id, page]);

  /* Arrow keys turn the page; Escape drops a region or puts the pencil down;
     Z with the modifier takes the last stroke back. None of it fires while a
     question is being typed — those keys belong to the caret then. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey && strokes.length) {
        e.preventDefault();
        changeStrokes(strokes.slice(0, -1));
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (box) { e.preventDefault(); setBox(null); return; }
        if (tool !== "point") { e.preventDefault(); setTool("point"); return; }
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (lesson.pages <= 1) return;
      e.preventDefault();
      setPage((n) => (e.key === "ArrowLeft" ? Math.max(1, n - 1) : Math.min(lesson.pages, n + 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.pages, box, tool, strokes]);

  /* The chat beside the page follows the answer while you are at the bottom of
     it, and lets go the moment you scroll up to re-read something. */
  const onChatScroll = React.useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }, []);

  React.useLayoutEffect(() => {
    const el = chatRef.current;
    if (el && pinned) el.scrollTop = el.scrollHeight;
  }, [turns.length, live, asking, pinned]);

  const words = React.useMemo(
    () => (lesson.text ? pageText(lesson.text, page) : ""),
    [lesson.text, page],
  );

  /* ------------------------------------------------------------ pointing -- */

  /** The page as the model should see it: with the ink, and cut to the box. */
  const picture = async (): Promise<{ url: string; what: "region" | "inked" } | null> => {
    if (!shot) return null;
    const inked = await composite(shot.url, strokes);
    if (box) return { url: await cut(inked, box), what: "region" };
    if (strokes.length) return { url: inked, what: "inked" };
    return null;
  };

  /** Light the words a quote covers, for a moment, or say the page lacks them. */
  const showQuote = async (quote: string) => {
    if (!bytes.current || lesson.mimeType.startsWith("image/")) {
      setNotice("This is a picture, so its words have no positions to point at.");
      return;
    }
    let runs = layouts.current.get(page);
    if (!runs) {
      try { runs = await pageLayout(bytes.current, page); } catch { runs = []; }
      layouts.current.set(page, runs);
    }
    const boxes = findQuote(runs, quote);
    if (!boxes.length) {
      setNotice("The page does not say that in those words.");
      return;
    }
    setNotice(null);
    setHighlights(boxes);
    pageRef.current?.scrollIntoView({ block: "nearest" });
    window.setTimeout(() => setHighlights((h) => (h === boxes ? [] : h)), 9000);
  };

  /* -------------------------------------------------------------- asking -- */

  const ask = async (text: string, opts: { marking?: boolean } = {}) => {
    const q = text.trim();
    if (!q || asking) return;
    if (!cast) {
      setNotice("No key configured yet — add one in Settings and this can start reading with you.");
      return;
    }
    setNotice(null);
    setQuestion("");
    setAsking(true);
    setLive("");
    const pic = await picture();
    const markedBox = box;
    await addLessonTurn({ lessonId: lesson.id, role: "user", text: q, page, crop: pic?.what === "region" ? pic.url : undefined });

    /* Every turn so far as the exchange, then this one with its picture. A
       tutor that forgot the last thing it explained would be a search box. */
    const history: { role: "user" | "assistant"; content: ContentBlock[] }[] = (turns ?? [])
      .slice(-12)
      .map((t) => ({ role: t.role, content: [{ type: "text", text: t.text } as ContentBlock] }));

    const now: ContentBlock[] = [];
    if (pic) {
      now.push({ type: "image", mimeType: "image/jpeg", data: pic.url.split(",")[1] ?? "", name: `page-${page}-${pic.what}.jpg` });
    }
    now.push({
      type: "text",
      text: [
        `We are working through “${lesson.name}”, page ${page}${lesson.pages > 1 ? ` of ${lesson.pages}` : ""}.`,
        pic?.what === "region"
          ? strokes.length
            ? "The picture is the part of the page I have pointed at, with what I have written on it in ink. Answer about that part; treat the ink as mine."
            : "The picture is the part of the page I have pointed at. Answer about that part."
          : pic?.what === "inked"
            ? "The picture is the page with what I have written on it in ink. The ink is mine — my working, my marks, my notes. Read it as part of the question."
            : "",
        words ? `The page says:\n\n${words.slice(0, 12_000)}` : "This page has no text layer — what you can see is all there is.",
        "",
        q,
      ].filter(Boolean).join("\n\n"),
    });

    try {
      const out = await complete("", {
        modelId: cast.answer.modelId,
        maxTokens: 1400,
        temperature: 0.3,
        turns: [...history, { role: "user", content: now }],
        system: [rulesText(settings.rules ?? [], settings.systemPrompt), TUTOR_STANCE, opts.marking ? MARKING_STANCE : ""].filter(Boolean).join("\n\n"),
        onText: opts.marking ? undefined : setLive,
      });
      if (out) {
        let text = out;
        if (opts.marking) {
          const m = parseMarks(out);
          if (m) {
            text = marksMarkdown(m);
            /* Down the side of the region, one per step, in order. The
               right edge unless the region already reaches it. */
            if (markedBox) {
              const x = markedBox.x + markedBox.w > 0.94 ? Math.max(0, markedBox.x - 0.04) : markedBox.x + markedBox.w + 0.012;
              setMarks(m.steps.map((s, i) => ({ x, y: markedBox.y + (markedBox.h * (i + 0.5)) / m.steps.length, ok: s.ok, n: i + 1 })));
            }
          }
        }
        await addLessonTurn({
          lessonId: lesson.id,
          role: "assistant",
          text,
          page,
          presetId: "tutor",
          why: cast.answer.why || undefined,
        });
      } else {
        setNotice("Nothing usable came back. Try asking it differently.");
      }
    } catch (err) {
      setNotice(whyItFailed(err, "That request failed. Check the key and the connection."));
    } finally {
      setAsking(false);
      setLive("");
      setBox(null);
    }
  };

  /* ---------------------------------------------------------- the studio -- */

  /** A page in the Notebook made from this document: a guide, questions, a summary. */
  const makePage = async (kind: "guide" | "questions" | "summary") => {
    if (!cast) { setNotice("No key configured yet — add one in Settings."); return; }
    if (!lesson.text && !words) { setNotice("There are no words in this document to make that from."); return; }
    setAsking(true);
    setNotice(null);
    try {
      /* The whole document, not its first forty thousand characters. A long
         one is read in parts into notes first (lib/digest.ts); a summary of
         the page on screen stays a summary of that page. */
      let whole = lesson.text;
      if (whole.length > 40_000) {
        const read = await readWhole([{ name: lesson.name, text: whole }], {
          onPart: (done, total) => setNotice(done < total ? `Reading the whole document — part ${done + 1} of ${total}…` : "Read it all. Writing…"),
        });
        whole = read.parts ? read.material[0].text : whole.slice(0, 40_000);
      }
      const source = kind === "summary" ? words || whole : whole || words;
      const spec = STUDIO[kind];
      const out = await complete(`${spec.prompt}\n\n${source}`, {
        modelId: cast.answer.modelId,
        maxTokens: 1800,
        temperature: 0.3,
        system: "You write revision material for a student from the document given. Use only what the document says. Markdown, headings, no preamble.",
      });
      if (!out) { setNotice("Nothing usable came back."); return; }
      const title = `${lesson.name.replace(/\.[^.]+$/, "")} — ${spec.label}`;
      await createNote({ title, content: `# ${title}\n\n${out.trim()}` });
      setNotice(`“${title}” is in the Notebook.`);
    } catch (err) {
      setNotice(whyItFailed(err, "That request failed."));
    } finally {
      setAsking(false);
    }
  };

  const makeCards = async () => {
    if (!cast) {
      setNotice("No key configured yet — add one in Settings.");
      return;
    }
    if (!words && !box) {
      setNotice("There is nothing to make cards from on this page yet — point at something first.");
      return;
    }
    setAsking(true);
    setNotice(null);
    try {
      const rows = await draftCards(words.slice(0, 12_000), {
        count: 6,
        modelId: cast.answer.modelId,
        about: `page ${page} of “${lesson.name}”`,
      });
      if (!rows?.length) {
        setNotice("No cards came back in a shape that could be used.");
        return;
      }
      /* One deck per document, not one per press. */
      const key = `lesson:${lesson.id}`;
      const deck = (await deckForSource(key)) ?? (await createDeck(lesson.name, key));
      const made = await addCards(deck.id, rows);
      setNotice(
        made
          ? `${made} ${made === 1 ? "card" : "cards"} added to “${deck.name}” in Study.`
          : "Those are already in the deck for this document.",
      );
    } catch (err) {
      setNotice(whyItFailed(err, "That request failed."));
    } finally {
      setAsking(false);
    }
  };

  const last = turns.length ? turns[turns.length - 1] : null;
  const inkBounds = boundsOf(strokes);

  const tools: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: "point", label: "Point at a region", icon: <MousePointer2 size={15} /> },
    { id: "pen", label: "Pen", icon: <PenLine size={15} /> },
    { id: "hi", label: "Highlighter", icon: <Highlighter size={15} /> },
    { id: "erase", label: "Rubber", icon: <Eraser size={15} /> },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* ------------------------------------------------------- the page -- */}
      {/* Stacked under lg the page keeps a fixed share of the screen and the
          chat scrolls in the rest; left to flex, a chat with three answers in
          it pushed the page down to a sliver on a phone. */}
      <div className="flex min-h-0 flex-1 flex-col border-line max-lg:h-[46dvh] max-lg:flex-none lg:border-r">
        <header className="glass safe-top sticky top-0 z-10 flex h-[var(--topbar-h)] shrink-0 items-center gap-1.5 border-b border-line px-2">
          <button
            onClick={onLeave}
            aria-label="Back to Study"
            className="ctl focus-inset flex [--ctl:2rem] items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{lesson.name}</span>

          {/* The pencil case. Four tools and two undoings, in a pill so the
              set reads as one thing; the chosen tool is filled. */}
          <div role="radiogroup" aria-label="Tool" className="flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-inset p-0.5">
            {tools.map((t) => (
              <Tooltip key={t.id} label={t.label}>
                <button
                  role="radio"
                  aria-checked={tool === t.id}
                  aria-label={t.label}
                  onClick={() => setTool(t.id)}
                  className={cn(
                    "ctl focus-inset flex [--ctl:1.75rem] items-center justify-center rounded-md transition-colors duration-[var(--dur-fast)]",
                    tool === t.id ? "bg-surface text-primary shadow-[var(--shadow-sm)]" : "text-tertiary hover:text-primary",
                  )}
                >
                  {t.icon}
                </button>
              </Tooltip>
            ))}
          </div>
          <Tooltip label="Take back the last stroke" keys={["mod", "Z"]}>
            <button
              onClick={() => changeStrokes(strokes.slice(0, -1))}
              disabled={!strokes.length}
              aria-label="Take back the last stroke"
              className="ctl focus-inset flex [--ctl:1.75rem] items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary disabled:opacity-30"
            >
              <Undo2 size={15} />
            </button>
          </Tooltip>
          <Tooltip label="Clear the ink on this page">
            <button
              onClick={() => changeStrokes([])}
              disabled={!strokes.length}
              aria-label="Clear the ink on this page"
              className="ctl focus-inset flex [--ctl:1.75rem] items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-danger disabled:opacity-30"
            >
              <Trash2 size={15} />
            </button>
          </Tooltip>

          {lesson.pages > 1 && (
            <span className="ms-1 flex shrink-0 items-center gap-0.5">
              <button
                onClick={() => setPage((n) => Math.max(1, n - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="ctl focus-inset flex [--ctl:2rem] items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary disabled:opacity-30"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="tnum min-w-14 text-center text-xs text-tertiary">
                {page} / {lesson.pages}
              </span>
              <button
                onClick={() => setPage((n) => Math.min(lesson.pages, n + 1))}
                disabled={page >= lesson.pages}
                aria-label="Next page"
                className="ctl focus-inset flex [--ctl:2rem] items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary disabled:opacity-30"
              >
                <ChevronRight size={15} />
              </button>
            </span>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-inset p-3">
          <div ref={pageRef} className="mx-auto w-full max-w-[52rem]">
            <Ink
              src={shot?.url ?? null}
              alt={`Page ${page} of ${lesson.name}`}
              tool={tool}
              strokes={strokes}
              onStrokes={changeStrokes}
              box={box}
              onBox={setBox}
              onPen={() => setPenSeen(true)}
              highlights={highlights}
              marks={marks}
              disabled={asking}
            />
          </div>

          <p className="mx-auto mt-2 max-w-[52rem] text-center text-xs text-tertiary" aria-live="polite">
            {box
              ? "That region goes with your next question."
              : tool === "pen"
                ? "Write on the page. What you write goes with your next question."
                : tool === "hi"
                  ? "Mark what matters. Highlighting alone does little — ask about what you marked, or make cards from it."
                  : tool === "erase"
                    ? "Touch a stroke to take it away."
                    : strokes.length
                      ? "Your ink goes with the next question. Drag a box to ask about one part."
                      : "Drag a box around anything — a diagram, a step, your own working — and ask about it. Or pick up the pen."}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------- the chat -- */}
      <div
        className={cn(
          "flex min-h-0 flex-col border-t border-line max-lg:flex-1 lg:shrink-0 lg:border-t-0",
          /* With a pencil down the page is the thing; the chat gives it room. */
          penSeen ? "lg:w-[22rem] xl:w-[26rem]" : "lg:w-[26rem] xl:w-[30rem]",
        )}
      >
        <div ref={chatRef} onScroll={onChatScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Working through it">
          {turns.length === 0 && !asking && (
            <div className="px-3 py-6 text-center">
              <p className="display-italic text-[1.25rem] text-secondary">Read it with me.</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-secondary">
                Point at anything on the page and ask. Write on it with a pencil and I can read that too.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {turns.map((t) => (
              <div key={t.id} className={cn("text-sm", t.role === "user" ? "text-right" : "")}>
                {t.crop && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.crop}
                    alt={`The region of page ${t.page} this was about`}
                    className="mb-1 ml-auto max-h-24 w-auto max-w-[80%] rounded-md border border-line object-contain"
                  />
                )}
                {t.role === "user" ? (
                  <p className="inline-block max-w-[85%] rounded-lg bg-subtle px-2.5 py-1.5 text-left text-primary">{t.text}</p>
                ) : (
                  <div>
                    <p className="mb-0.5 text-tiny text-tertiary">
                      {shortName(t.presetId ?? "tutor")}
                      {t.page ? ` · page ${t.page}` : ""}
                      {t.why ? ` · ${t.why}` : ""}
                    </p>
                    <div className="prose-armi text-secondary">
                      <Markdown content={t.text} />
                    </div>
                    {/* What it quoted from the page, as presses that find the
                        words on the page. Only for the page it was about. */}
                    {t.page === page && quotesIn(t.text).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Show on the page">
                        {quotesIn(t.text).map((q) => (
                          <button
                            key={q}
                            onClick={() => void showQuote(q)}
                            className="btn-touch focus-inset max-w-full truncate rounded-full border border-line bg-surface px-2 text-xs text-tertiary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary"
                            title="Show these words on the page"
                          >
                            ↗ “{q.length > 48 ? `${q.slice(0, 46)}…` : q}”
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {asking && (
              <div className="text-sm" aria-live="polite">
                <p className="mb-0.5 flex items-center gap-1.5 text-tiny text-tertiary">
                  <Loader2 size={11} className="animate-spin" />
                  Reading the page…
                </p>
                {live && (
                  <div className="prose-armi text-secondary">
                    <Markdown content={live} streaming />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {notice && <p className="px-3 pb-1 text-xs text-warning" role="status">{notice}</p>}

        {/* What a tutor is asked, as presses. Each one sends the page, the ink
            on it, and the region when there is one. A hint comes first. */}
        <div className="flex flex-wrap gap-1 px-3 pb-1.5" role="group" aria-label="Ask about this">
          {(box ? CROP_ASKS : inkBounds ? INK_ASKS : PAGE_ASKS).map((a) => (
            <button
              key={a.label}
              disabled={asking}
              onClick={() => void ask(a.text, { marking: a.marking })}
              className="btn-touch press focus-inset rounded-full border border-line bg-surface px-2.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
          {box && (
            <button
              onClick={() => setBox(null)}
              aria-label="Forget the region"
              className="btn-touch press focus-inset flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-xs text-tertiary hover:text-primary"
            >
              <X size={11} />
              Region
            </button>
          )}
        </div>

        {/* What comes of it: pages in the Notebook and cards in Study, from
            the same words — NotebookLM's studio, without leaving the page. */}
        <div className="flex flex-wrap gap-1 px-3 pb-1.5" role="group" aria-label="Make from this">
          <span className="self-center pe-0.5 text-tiny uppercase tracking-wide text-faint">Make</span>
          {(Object.keys(STUDIO) as (keyof typeof STUDIO)[]).map((k) => (
            <button
              key={k}
              disabled={asking}
              onClick={() => void makePage(k)}
              className="btn-touch press focus-inset rounded-full px-2 text-xs text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary disabled:opacity-50"
            >
              {STUDIO[k].label}
            </button>
          ))}
          <button
            disabled={asking}
            onClick={() => void makeCards()}
            aria-label="Make cards"
            className="btn-touch press focus-inset rounded-full px-2 text-xs text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary disabled:opacity-50"
          >
            Cards
          </button>
        </div>

        <div className="px-3 pb-3">
          <MessageBar
            value={question}
            onChange={setQuestion}
            onSubmit={() => void ask(question)}
            placeholder={box ? "Ask about what you pointed at…" : strokes.length ? "Ask about the page and what you wrote…" : `Ask about page ${page}…`}
            ariaLabel="Ask about this page"
            canSend={Boolean(question.trim()) && !asking}
          />
        </div>

        {onAsk && last?.role === "assistant" && (
          <div className="px-3 pb-3">
            <Button size="sm" variant="ghost" onClick={() => onAsk(`About “${lesson.name}”, page ${last.page}:\n\n${last.text.slice(0, 1200)}`)}>
              Take this to a full conversation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- bits -- */

/** The region, cut out of the drawn page at the page's own resolution. */
async function cut(url: string, n: Box): Promise<string> {
  const img = new Image();
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(16, Math.round(img.naturalWidth * n.w));
  canvas.height = Math.max(16, Math.round(img.naturalHeight * n.h));
  const ctx = canvas.getContext("2d");
  if (!ctx) return url;
  ctx.drawImage(
    img,
    img.naturalWidth * n.x, img.naturalHeight * n.y,
    img.naturalWidth * n.w, img.naturalHeight * n.h,
    0, 0, canvas.width, canvas.height,
  );
  return canvas.toDataURL("image/jpeg", 0.85);
}

interface Ask { label: string; text: string; marking?: boolean }

const PAGE_ASKS: Ask[] = [
  { label: "Explain this page", text: "Explain what this page is saying, in plain language." },
  { label: "What matters here", text: "What are the two or three things on this page that are actually worth remembering, and why those?" },
  { label: "Test me", text: "Ask me one question about this page. Do not answer it — wait for me." },
];

/* With ink on the page and no region: the ink is the question. */
const INK_ASKS: Ask[] = [
  { label: "Give me a hint", text: "Look at what I have written on the page. If I am stuck, give me one hint — the smallest thing that would get me moving — and nothing more." },
  { label: "Why is it wrong?", text: "Mark my working — what I have written on the page in ink — step by step.", marking: true },
  { label: "Read my notes back", text: "Read what I have written on the page back to me as text, exactly, then say in one line whether it matches what the page says." },
  { label: "Explain this page", text: "Explain what this page is saying, in plain language." },
  { label: "Test me", text: "Ask me one question about what I have marked on this page. Do not answer it — wait for me." },
];

const CROP_ASKS: Ask[] = [
  { label: "Give me a hint", text: "I am working on the part I have pointed at. Do not explain it. Give me one hint — the smallest thing that would get me moving — and stop." },
  { label: "Why is it wrong?", text: "Mark my working in the part I have pointed at, step by step.", marking: true },
  { label: "Explain this", text: "Explain the part I have pointed at." },
  { label: "Work it through", text: "Work this through with me one step at a time. Give me the first step only, then wait." },
  { label: "Test me", text: "Ask me one question about the part I pointed at. Do not answer it — wait for me." },
];

const STUDIO = {
  guide: {
    label: "Study guide",
    prompt: "Write a study guide for this document: the ten things to know, each in one or two lines, ranked by how likely they are to be examined; the key terms as a table of term and meaning; and the three mistakes people make with this material.",
  },
  questions: {
    label: "Questions",
    prompt: "Write eight exam-style questions on this document, from recall to evaluation, each with the marks it is worth and a mark scheme saying what a full-mark answer must contain. Questions first, then all the mark schemes under a heading of their own.",
  },
  summary: {
    label: "Summary",
    prompt: "Summarise this in five lines a student could revise from. Then one line saying what it does not cover.",
  },
} as const;

const TUTOR_STANCE = [
  "You are reading a document with someone, page by page. They can see the page; so can you.",
  "Answer about what is in front of them. Where the page's words are given to you, quote the line you mean, on its own line beginning with '> ' and in the page's exact words, so it can be lit up on the page.",
  "Where a picture is given, it is the page or the part of it they pointed at, and any ink on it is theirs — their working, their marks, their notes. Read the ink as part of what they are asking.",
  "Teach rather than tell: a hint before an explanation, work an example, name the thing people get wrong, and stop short of the last step when they are clearly trying it themselves. After an explanation, ask one short question that checks they followed.",
  "If the page does not answer what they asked, say so in one line rather than filling the gap from memory.",
  "Short paragraphs. No preamble, no summary of the question back at them.",
].join("\n");

const MARKING_STANCE = [
  "You are marking their working. Reply with JSON only, of this shape:",
  '{"steps":[{"text":"the step, in their words or a short paraphrase","ok":true,"note":"one line, only when a step does not hold — what is wrong and why"}],"summary":"one line for the whole piece of working"}',
  "One entry per step of their working, in the order written. Do not finish the working for them, and do not give the corrected step — say what is wrong with it.",
].join("\n");
