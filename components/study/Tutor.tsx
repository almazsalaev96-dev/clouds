"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Loader2, Square, Trash2, X } from "lucide-react";
import type { ContentBlock, Lesson, LessonTurn } from "@/lib/types";
import { addLessonTurn, addCards, createDeck, db } from "@/lib/db";
import { renderPage, pageText } from "@/lib/pdf";
import { complete } from "@/lib/complete";
import { resolveCast, shortName } from "@/lib/presets";
import { useSettings } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";
import { MessageBar } from "@/components/chat/MessageBar";
import { Markdown } from "@/components/chat/Markdown";

/**
 * Working through a document with the app, rather than asking it about one.
 *
 * The difference is on screen. A file you attach to a question disappears
 * into the question; here the page stays where you can see it, the
 * conversation sits beside it, and both know which page you are on. That is
 * what a person sitting next to you with the book open can do and a chat
 * window cannot.
 *
 * ## Pointing is the input
 *
 * Every other way of asking about part of a page is a description of it:
 * "the second equation in the middle box". So you drag a box around the
 * thing instead — with a pencil, a finger or a mouse, they are the same
 * gesture — and that region is cut out of the page and sent with the
 * question. It costs the model nothing to look at and it costs you nothing
 * to say. It also means a diagram, a scanned page and your own handwriting
 * all work the same way: they are pictures either way, and nothing about
 * this path assumes the page had text in it.
 *
 * The page's *words* go too, when it has them. Both together is what makes
 * an answer able to say "the step on the third line" rather than "in your
 * image".
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
  const [drawing, setDrawing] = React.useState<Box | null>(null);
  const [crop, setCrop] = React.useState<{ url: string; box: Box } | null>(null);
  const [asking, setAsking] = React.useState(false);
  const [live, setLive] = React.useState("");
  const [question, setQuestion] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const pageRef = React.useRef<HTMLDivElement>(null);
  const bytes = React.useRef<ArrayBuffer | null>(null);

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

  /* Drawn on arrival and on every page change. The bytes are read once. */
  React.useEffect(() => {
    let live = true;
    void (async () => {
      try {
        if (!bytes.current) bytes.current = await lesson.bytes.arrayBuffer();
        if (lesson.mimeType.startsWith("image/")) {
          const url = URL.createObjectURL(lesson.bytes);
          const img = new Image();
          await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
          if (live) setShot({ url, width: img.naturalWidth, height: img.naturalHeight });
          return;
        }
        const out = await renderPage(bytes.current, page, { width: 1400 });
        if (live) setShot({ url: out.url, width: out.width, height: out.height });
      } catch {
        if (live) setNotice("That page would not draw. The file may be damaged.");
      }
    })();
    return () => { live = false; };
  }, [lesson.bytes, lesson.mimeType, page]);

  // Where you were, kept, so closing and coming back opens the same page.
  React.useEffect(() => {
    void db.lessons.update(lesson.id, { atPage: page });
  }, [lesson.id, page]);

  const words = React.useMemo(
    () => (lesson.text ? pageText(lesson.text, page) : ""),
    [lesson.text, page],
  );

  /* ------------------------------------------------------------ pointing -- */

  const start = (e: React.PointerEvent) => {
    if (asking) return;
    const box = pageRef.current?.getBoundingClientRect();
    if (!box) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const at = { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
    setCrop(null);
    setDrawing({ x1: at.x, y1: at.y, x2: at.x, y2: at.y, pen: e.pointerType === "pen" });
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing) return;
    const box = pageRef.current?.getBoundingClientRect();
    if (!box) return;
    setDrawing((d) => d && { ...d, x2: (e.clientX - box.left) / box.width, y2: (e.clientY - box.top) / box.height });
  };

  const end = async () => {
    const d = drawing;
    setDrawing(null);
    if (!d || !shot) return;
    const box = normalise(d);
    // A tap is not a selection. Below this it is somebody scrolling.
    if (box.w < 0.03 || box.h < 0.02) return;
    setCrop({ url: await cut(shot.url, box), box: d });
  };

  /* -------------------------------------------------------------- asking -- */

  const ask = async (text: string) => {
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
    const shownCrop = crop?.url;
    await addLessonTurn({ lessonId: lesson.id, role: "user", text: q, page, crop: shownCrop });

    /* Every turn so far as the exchange, then this one with its picture. A
       tutor that forgot the last thing it explained would be a search box. */
    const history: { role: "user" | "assistant"; content: ContentBlock[] }[] = (turns ?? [])
      .slice(-12)
      .map((t) => ({ role: t.role, content: [{ type: "text", text: t.text } as ContentBlock] }));

    const now: ContentBlock[] = [];
    if (shownCrop) {
      now.push({ type: "image", mimeType: "image/jpeg", data: shownCrop.split(",")[1] ?? "", name: `page-${page}-region.jpg` });
    }
    now.push({
      type: "text",
      text: [
        `We are working through “${lesson.name}”, page ${page}${lesson.pages > 1 ? ` of ${lesson.pages}` : ""}.`,
        shownCrop ? "The picture is the part of the page I have pointed at. Answer about that part." : "",
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
        system: TUTOR_STANCE,
        onText: setLive,
      });
      if (out) {
        await addLessonTurn({
          lessonId: lesson.id,
          role: "assistant",
          text: out,
          page,
          presetId: "tutor",
          why: cast.answer.why || undefined,
        });
      } else {
        setNotice("Nothing usable came back. Try asking it differently.");
      }
    } catch {
      setNotice("That request failed. Check the key and the connection.");
    } finally {
      setAsking(false);
      setLive("");
      setCrop(null);
    }
  };

  const makeCards = async () => {
    if (!cast) {
      setNotice("No key configured yet — add one in Settings.");
      return;
    }
    if (!words && !crop) {
      setNotice("There is nothing to make cards from on this page yet — point at something first.");
      return;
    }
    setAsking(true);
    setNotice(null);
    try {
      const out = await complete(
        `From this page of “${lesson.name}”, write between four and eight question-and-answer cards for someone learning it.\n\nOne per line, as "Question :: Answer". No numbering, no preamble.\n\n${words.slice(0, 12_000)}`,
        { modelId: cast.answer.modelId, maxTokens: 900, temperature: 0.3 },
      );
      const rows = (out ?? "")
        .split("\n")
        .map((l) => l.split("::"))
        .filter((bits) => bits.length >= 2 && bits[0].trim() && bits[1].trim())
        .map((bits) => ({ front: bits[0].replace(/^[-*\d.\s]+/, "").trim(), back: bits.slice(1).join("::").trim() }));
      if (!rows.length) {
        setNotice("No cards came back in a shape that could be used.");
        return;
      }
      const deck = await createDeck(lesson.name, `lesson:${lesson.id}`);
      await addCards(deck.id, rows);
      setNotice(`${rows.length} cards made — they are in Study.`);
    } catch {
      setNotice("That request failed.");
    } finally {
      setAsking(false);
    }
  };

  const last = turns.length ? turns[turns.length - 1] : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* ------------------------------------------------------- the page -- */}
      <div className="flex min-h-0 flex-1 flex-col border-line lg:border-r">
        <header className="glass safe-top sticky top-0 z-10 flex h-[var(--topbar-h)] shrink-0 items-center gap-2 border-b border-line px-2">
          <button
            onClick={onLeave}
            aria-label="Back to Study"
            className="ctl focus-inset flex [--ctl:2rem] items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{lesson.name}</span>
          {lesson.pages > 1 && (
            <span className="flex shrink-0 items-center gap-0.5">
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
          <div
            ref={pageRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={() => void end()}
            onPointerCancel={() => setDrawing(null)}
            /* `none` so a pencil or a finger drawing a box does not scroll the
               page out from under the box it is drawing. */
            style={{ touchAction: "none" }}
            className="relative mx-auto w-full max-w-[52rem] select-none"
          >
            {shot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shot.url}
                alt={`Page ${page} of ${lesson.name}`}
                draggable={false}
                className="w-full rounded-lg border border-line bg-surface shadow-[var(--shadow-sm)]"
              />
            ) : (
              <div className="skeleton aspect-[1/1.414] w-full rounded-lg border border-line" aria-label="Drawing the page" />
            )}

            {/* What you are dragging, and what you dragged. */}
            {(drawing || crop) && (
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute rounded-sm border-2",
                  drawing ? "border-[var(--accent-2)] bg-[rgb(var(--accent-2-rgb)/0.12)]" : "border-accent bg-[rgb(var(--accent-rgb)/0.10)]",
                )}
                style={rect(normalise(drawing ?? crop!.box))}
              />
            )}
          </div>

          <p className="mx-auto mt-2 max-w-[52rem] text-center text-xs text-tertiary">
            {crop
              ? "That region goes with your next question."
              : "Drag a box around anything — a diagram, a step, your own working — and ask about it."}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------- the chat -- */}
      <div className="flex min-h-0 shrink-0 flex-col border-t border-line lg:w-[26rem] lg:border-t-0 xl:w-[30rem]">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Working through it">
          {turns.length === 0 && !asking && (
            <div className="rounded-lg border border-dashed border-line px-3 py-6 text-center">
              <p className="text-sm text-primary">Read it with me.</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-secondary">
                Point at anything on the page and ask. I can see the page you are on.
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

        {notice && <p className="px-3 pb-1 text-xs text-warning">{notice}</p>}

        {/* What a tutor is asked, as presses. Each one sends the page, and the
            region when there is one. */}
        <div className="flex flex-wrap gap-1 px-3 pb-1.5" role="group" aria-label="Ask about this">
          {(crop ? CROP_ASKS : PAGE_ASKS).map((a) => (
            <button
              key={a.label}
              disabled={asking}
              onClick={() => void ask(a.text)}
              className="btn-touch press focus-inset rounded-full border border-line bg-surface px-2.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
          <button
            disabled={asking}
            onClick={() => void makeCards()}
            className="btn-touch press focus-inset rounded-full border border-line bg-surface px-2.5 text-xs text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary disabled:opacity-50"
          >
            Make cards
          </button>
          {crop && (
            <button
              onClick={() => setCrop(null)}
              aria-label="Forget the region"
              className="btn-touch press focus-inset flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-xs text-tertiary hover:text-primary"
            >
              <X size={11} />
              Region
            </button>
          )}
        </div>

        <div className="px-3 pb-3">
          <MessageBar
            value={question}
            onChange={setQuestion}
            onSubmit={() => void ask(question)}
            placeholder={crop ? "Ask about what you pointed at…" : `Ask about page ${page}…`}
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

interface Box { x1: number; y1: number; x2: number; y2: number; pen?: boolean }

const normalise = (b: Box) => ({
  x: Math.min(b.x1, b.x2),
  y: Math.min(b.y1, b.y2),
  w: Math.abs(b.x2 - b.x1),
  h: Math.abs(b.y2 - b.y1),
});

const rect = (n: { x: number; y: number; w: number; h: number }) => ({
  left: `${n.x * 100}%`,
  top: `${n.y * 100}%`,
  width: `${n.w * 100}%`,
  height: `${n.h * 100}%`,
});

/** The region, cut out of the drawn page at the page's own resolution. */
async function cut(url: string, n: { x: number; y: number; w: number; h: number }): Promise<string> {
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

const PAGE_ASKS = [
  { label: "Explain this page", text: "Explain what this page is saying, in plain language." },
  { label: "What matters here", text: "What are the two or three things on this page that are actually worth remembering, and why those?" },
  { label: "Test me", text: "Ask me one question about this page. Do not answer it — wait for me." },
];

const CROP_ASKS = [
  { label: "Explain this", text: "Explain the part I have pointed at." },
  { label: "Why is it wrong?", text: "This is my own working. Find the first thing that is wrong with it, say why it is wrong, and stop there — do not finish it for me." },
  { label: "Work it through", text: "Work this through with me one step at a time. Give me the first step only, then wait." },
  { label: "Test me", text: "Ask me one question about the part I pointed at. Do not answer it — wait for me." },
];

const TUTOR_STANCE = [
  "You are reading a document with someone, page by page. They can see the page; so can you.",
  "Answer about what is in front of them. Where the page's words are given to you, quote the line you mean rather than describing where it is.",
  "Where a picture of a region is given, that is what they pointed at — answer about that, not the rest of the page.",
  "Teach rather than tell: work an example, name the thing people get wrong, stop short of the last step when they are clearly trying it themselves.",
  "If the page does not answer what they asked, say so in one line rather than filling the gap from memory.",
  "Short paragraphs. No preamble, no summary of the question back at them.",
].join("\n");
