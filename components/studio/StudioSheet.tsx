"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen, Camera, Check, CheckCircle2, ChevronLeft, CircleDashed, ClipboardCheck, FileText, FileUp,
  Layers, ListChecks, Loader2, NotebookPen, Sparkles, X,
} from "lucide-react";
import { db, uid, addCards, createDeck, createNote } from "@/lib/db";
import { cheapestAvailable, complete, extractJson, whyItFailed } from "@/lib/complete";
import { draftCards, makeFromSources } from "@/lib/generate";
import { extractCitations } from "@/lib/cite";
import { extractPdf, isPdf } from "@/lib/pdf";
import { readWhole } from "@/lib/digest";
import { marksOf } from "@/lib/exam";
import { rulesText } from "@/lib/rules";
import { useSettings } from "@/lib/store";
import { useReviseModel } from "@/components/chat/RevisePicker";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import {
  HOUSE_RULES, PAGE_TOOLS, TOOLS, briefLines, checkPrompt, checkedLine, fixPrompt, pagePrompt,
  paperMarkdown, paperPrompt, parseCheck, parsePaper, parseReading, parseScheme, quizPrompt,
  readingPrompt, schemeFromText, schemePrompt, toolById,
  type Brief, type Check as Checked, type Reading, type Tool, type ToolId,
} from "@/lib/studio";
import type { ExamQuestion, Marking, Mock } from "@/lib/course";
import type { StudioRequest } from "@/lib/studioBus";
import { markAnswer, Result } from "@/components/study/Courses";

/**
 * The Studio sheet: one place, opened from anywhere, that turns what a
 * student has into what earns marks.
 *
 * It reads first and asks second, the way a good teacher handed a
 * textbook would: "this is a GCSE Biology chapter on transport, eight
 * topics — what do you want from it?" — with the tools that suit that kind
 * of material already ticked, and the three things that change everything
 * (the level, the board, what it is for) one press away. Then each thing is
 * written to its standard, checked against it by a second model, and
 * rewritten once if it fell short, before the student sees any of it.
 */

type Step = "source" | "reading" | "choose" | "making" | "done" | "checker";

interface Job {
  tool: ToolId;
  state: "waiting" | "writing" | "checking" | "fixing" | "done" | "failed";
  note?: string;
  /** Where the result went. */
  open?: { kind: "page" | "deck" | "paper"; id: string; label: string };
}

const PURPOSES = [
  { id: "exam", label: "Exam revision" },
  { id: "understand", label: "Understand it" },
  { id: "teach", label: "Teach it" },
  { id: "quick", label: "Quick review" },
] as const;
const DIFFICULTY = [
  { id: "easy", label: "Foundation" },
  { id: "standard", label: "Standard" },
  { id: "hard", label: "Hardest" },
] as const;
const LENGTHS = [15, 30, 45, 60, 90];

const ICON: Partial<Record<ToolId, React.ReactNode>> = {
  flashcards: <Layers size={15} />,
  quiz: <ListChecks size={15} />,
  paper: <FileText size={15} />,
  checker: <ClipboardCheck size={15} />,
};

export function StudioSheet({ request, configured, onClose, onOpenPage, onOpenDeck, onOpenPaper }: {
  request: StudioRequest;
  configured: Record<string, boolean>;
  onClose: () => void;
  onOpenPage: (id: string) => void;
  onOpenDeck: (id: string) => void;
  onOpenPaper: (id: string) => void;
}) {
  const settings = useSettings();
  const room = useReviseModel(configured);
  const modelId = room ?? cheapestAvailable(configured);
  const [step, setStep] = React.useState<Step>(request.tool === "checker" ? "checker" : request.source || request.topic ? "reading" : "source");
  const [source, setSource] = React.useState<{ name: string; text: string } | null>(request.source ?? null);
  const [topic, setTopic] = React.useState(request.topic ?? "");
  const [reading, setReading] = React.useState<Reading | null>(null);
  const [picked, setPicked] = React.useState<Set<ToolId>>(new Set(request.tool && request.tool !== "checker" ? [request.tool] : []));
  const [brief, setBrief] = React.useState<Brief>({ title: "", purpose: "exam", difficulty: "standard" });
  const [minutes, setMinutes] = React.useState(45);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pasting, setPasting] = React.useState(false);
  const [pasted, setPasted] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const abort = React.useRef<AbortController | null>(null);
  const pages = useLiveQuery(() => db.notes.orderBy("updatedAt").reverse().limit(30).toArray(), [], []);

  React.useEffect(() => {
    if (request.pick) window.setTimeout(() => fileRef.current?.click(), 50);
  }, [request.pick]);
  React.useEffect(() => () => abort.current?.abort(), []);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && step !== "making") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  /* ------------------------------------------------------- reading -- */

  const read = React.useCallback(async (src: { name: string; text: string } | null, about: string) => {
    setStep("reading");
    setNotice(null);
    if (!src) {
      /* A topic, not a book: nothing to read, so the choice is offered at
         once with what suits a topic. */
      setReading({ title: about, subject: "", level: "", kind: "other", topics: [], recommend: ["notes", "flashcards", "paper", "mindmap"], about: "" });
      setBrief((b) => ({ ...b, title: about }));
      setPicked((p) => (p.size ? p : new Set<ToolId>(["notes", "flashcards", "paper"])));
      setStep("choose");
      return;
    }
    if (!modelId) { setNotice("No key configured yet — add one in Settings."); setStep("source"); return; }
    const text = src.text;
    /* The start of it, and a look at the end: enough to say what it is,
       without paying to read a whole book before the student has chosen. */
    const excerpt = text.length > 26_000 ? `${text.slice(0, 22_000)}\n\n[…]\n\n${text.slice(-4_000)}` : text;
    let r: Reading;
    try {
      const raw = await complete(readingPrompt(excerpt, src.name), { modelId, maxTokens: 900, temperature: 0.2 });
      r = parseReading(extractJson(raw ?? ""), src.name);
    } catch {
      r = parseReading(null, src.name);
    }
    setReading(r);
    setBrief((b) => ({ ...b, title: r.title, subject: b.subject || r.subject, level: b.level || r.level }));
    setPicked((p) => (p.size ? p : new Set(r.recommend.slice(0, 3))));
    setStep("choose");
  }, [modelId]);

  React.useEffect(() => {
    if (step === "reading" && (request.source || request.topic) && !reading) void read(request.source ?? null, request.topic ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const takeFile = async (file: File | undefined) => {
    if (!file) return;
    setNotice(null);
    try {
      if (file.size > 40_000_000) { setNotice("That file is over 40MB."); return; }
      let text = "";
      if (isPdf(file)) {
        const out = await extractPdf(file);
        if (out.imageOnly || !out.text.trim()) { setNotice("That PDF is a scan with no text in it. Open it in Study → Work through a document, where pages are read as pictures."); return; }
        text = out.text;
      } else text = await file.text();
      if (!text.trim()) { setNotice("Nothing could be read from that file."); return; }
      const src = { name: file.name, text };
      setSource(src);
      void read(src, "");
    } catch {
      setNotice("That file could not be opened. It may be encrypted or damaged.");
    }
  };

  /* -------------------------------------------------------- making -- */

  const rules = rulesText(settings.rules ?? [], settings.systemPrompt ?? "");
  const checkWith = async (writer: string) => {
    try {
      const where = { configured, keys: settings.keys };
      const [{ checker }, { engineOf }] = await Promise.all([import("@/lib/route"), import("@/lib/presets")]);
      return checker(engineOf(writer, where), where) ?? writer;
    } catch {
      return writer;
    }
  };

  const make = async () => {
    if (!modelId || !reading || !picked.size) return;
    const list: Job[] = [...picked].map((t) => ({ tool: t, state: "waiting" }));
    setJobs(list);
    setStep("making");
    const ctl = new AbortController();
    abort.current = ctl;
    const b: Brief = { ...brief, title: reading.title };
    const title = reading.title || source?.name || topic || "Study";
    const set = (tool: ToolId, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.tool === tool ? { ...j, ...patch } : j)));
    const judge = await checkWith(modelId);
    const noSource = !source;
    const src = source ?? { name: title, text: `(No source was given. Write from your knowledge of this topic, at the level given: ${title}.)` };

    /* A long book is read once, in parts, and every tool that cannot read
       it whole works from that reading. */
    let material: string | null = null;
    const whole = async () => {
      if (material !== null) return material;
      if (src.text.length <= 100_000) return (material = src.text);
      set(list[0].tool, { note: "Reading the whole of it first…" });
      const r = await readWhole([src], { signal: ctl.signal, onPart: (d, t) => setNotice(`Reading the whole of it — part ${Math.min(d + 1, t)} of ${t}…`) });
      setNotice(null);
      return (material = r.material.map((m) => m.text).join("\n\n"));
    };

    const extra = [rules, ""].filter(Boolean).join("\n");
    let firstPage: string | null = null;
    for (const job of list) {
      if (ctl.signal.aborted) break;
      const tool = toolById(job.tool);
      try {
        if (tool.kind === "page") {
          set(tool.id, { state: "writing" });
          const instruction = pagePrompt(tool, b, "", "").replace(/\nTHE SOURCE: [\s\S]*$/, "");
          const wanted = extra ? `${instruction}\n\n${extra}` : instruction;
          let raw: string | null;
          if (noSource) raw = await complete(`${wanted}\n\nTHE TOPIC: ${title}\n(No source was given: write from your knowledge of it, at the level given, and say so in one line at the top.)`, { modelId, maxTokens: 9_000, temperature: 0.35, signal: ctl.signal });
          else raw = await makeFromSources(wanted, [src], modelId, undefined, { signal: ctl.signal, onPart: (d, t) => set(tool.id, { note: `Reading part ${Math.min(d + 1, t)} of ${t}…` }) });
          if (!raw?.trim()) throw new Error("Nothing came back.");
          let text = raw.trim();
          set(tool.id, { state: "checking", note: "A second model is checking it against the standard…" });
          const excerpt = noSource ? title : (await whole()).slice(0, 12_000);
          const verdict: Checked | null = parseCheck(extractJson((await complete(checkPrompt(tool, b, text, excerpt), { modelId: judge, maxTokens: 900, temperature: 0.1, signal: ctl.signal }).catch(() => null)) ?? ""));
          let fixed = false;
          if (verdict?.verdict === "short") {
            set(tool.id, { state: "fixing", note: `Rewriting: ${verdict.missing.slice(0, 2).join("; ")}` });
            const again = await complete(fixPrompt(tool, b, text, verdict, noSource ? title : (await whole()).slice(0, 60_000), src.name), { modelId, maxTokens: 9_000, temperature: 0.3, signal: ctl.signal }).catch(() => null);
            if (again?.trim()) { text = again.trim(); fixed = true; }
          }
          const { text: body, citations } = noSource ? { text, citations: [] } : extractCitations(text, [{ id: "studio", noteId: "", name: src.name, text: src.text, size: src.text.length, addedAt: Date.now() }]);
          const note = await createNote({ title: `${title} — ${tool.name}`, content: body + checkedLine(tool, verdict, fixed), citations, madeAt: Date.now() });
          if (!firstPage) firstPage = body;
          set(tool.id, { state: "done", note: verdict ? (fixed ? "checked, and rewritten where it fell short" : verdict.verdict === "meets" ? "checked: meets the standard" : "checked") : "made", open: { kind: "page", id: note.id, label: "Open" } });
        } else if (tool.id === "flashcards") {
          set(tool.id, { state: "writing" });
          const from = firstPage ?? (await whole());
          const drafts = await draftCards(`${from.slice(0, 40_000)}`, { about: title, modelId, signal: ctl.signal, count: 16 });
          if (!drafts?.length) throw new Error("No cards came back.");
          const deck = await createDeck(title, "studio");
          const n = await addCards(deck.id, drafts, "studio");
          set(tool.id, { state: "done", note: `${n} cards, asked again on a schedule`, open: { kind: "deck", id: deck.id, label: "Study them" } });
        } else if (tool.id === "paper" || tool.id === "quiz") {
          set(tool.id, { state: "writing" });
          const body = noSource ? src.text : await whole();
          const prompt = tool.id === "paper" ? paperPrompt(b, `${body}${extra ? `\n\n${extra}` : ""}`, src.name, minutes) : quizPrompt(b, `${body}${extra ? `\n\n${extra}` : ""}`, src.name, 12);
          const raw = await complete(prompt, { modelId, maxTokens: 12_000, temperature: 0.4, signal: ctl.signal });
          const qs = parsePaper(extractJson(raw ?? ""));
          if (!qs) throw new Error("The paper did not come back in a shape that could be read.");
          const questions: ExamQuestion[] = qs.map((q) => ({ topicId: "", topic: q.topic, question: q.question, marks: q.marks, scheme: q.scheme, model: q.model, tip: q.tip, difficulty: "exam", ...(q.options ? { options: q.options, answer: q.answer, why: q.why } : {}) }));
          const name = `${title} — ${tool.id === "paper" ? "Exam paper" : "Quiz"}`;
          const mock: Mock = {
            id: uid(), courseId: "", title: name, about: { subject: b.subject, level: b.level, board: b.board }, kind: tool.id === "quiz" ? "quiz" : "paper",
            createdAt: Date.now(), minutes: tool.id === "quiz" ? 0 : minutes, questions, answers: questions.map(() => ""),
          };
          await db.mocks.add(mock);
          /* And the same paper as a page, to print or save as a PDF, with
             the mark scheme after the questions. */
          if (tool.id === "paper") await createNote({ title: name, content: paperMarkdown(name, qs, minutes).replace(/^# .*\n\n/, ""), madeAt: Date.now() });
          const total = questions.reduce((s, q) => s + q.marks, 0);
          set(tool.id, { state: "done", note: `${questions.length} questions · ${total} marks${tool.id === "paper" ? " · also a page to print, with the mark scheme" : ""}`, open: { kind: "paper", id: mock.id, label: tool.id === "paper" ? "Sit it" : "Take it" } });
        }
      } catch (err) {
        if (ctl.signal.aborted) break;
        set(tool.id, { state: "failed", note: whyItFailed(err, "It could not be made.") });
      }
    }
    setStep("done");
  };

  /* ------------------------------------------------------------ view -- */

  const toggle = (id: ToolId) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const open = (j: Job) => {
    if (!j.open) return;
    if (j.open.kind === "page") onOpenPage(j.open.id);
    else if (j.open.kind === "deck") onOpenDeck(j.open.id);
    else onOpenPaper(j.open.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--bg-overlay)] sm:items-center sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && step !== "making") onClose(); }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Studio"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-line bg-canvas shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          {(step === "choose" || step === "checker") && !request.source && !request.topic && request.tool !== "checker" && (
            <button onClick={() => { setStep("source"); setReading(null); }} aria-label="Back" className="ctl focus-inset flex [--ctl:1.75rem] items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary">
              <ChevronLeft size={15} />
            </button>
          )}
          <Sparkles size={16} className="text-accent" aria-hidden />
          <h2 className="text-sm font-medium text-primary">{step === "checker" ? "Answer checker" : "Studio"}</h2>
          <span className="min-w-0 flex-1 truncate text-xs text-tertiary">
            {step === "checker" ? "marked point by point, the way an examiner would" : "study material written to a standard, and checked"}
          </span>
          <button onClick={() => { abort.current?.abort(); onClose(); }} aria-label="Close" className="ctl focus-inset flex [--ctl:1.75rem] items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary">
            <X size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {notice && <p role="status" className="mb-3 rounded-lg bg-subtle px-3 py-2 text-xs text-secondary">{notice}</p>}

          {step === "source" && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-primary">What should it be made from?</p>
                <p className="mt-0.5 text-xs text-tertiary">A textbook chapter, your notes, a novel, lecture slides, a past paper — or just a topic.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button onClick={() => fileRef.current?.click()} className="focus-ring flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left hover:border-[var(--border-strong)]">
                  <FileUp size={18} className="text-accent" aria-hidden />
                  <span><span className="block text-sm text-primary">A file</span><span className="block text-xs text-tertiary">PDF, text or Markdown, a whole book is fine</span></span>
                </button>
                <button onClick={() => setPasting((v) => !v)} className="focus-ring flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left hover:border-[var(--border-strong)]">
                  <NotebookPen size={18} className="text-accent" aria-hidden />
                  <span><span className="block text-sm text-primary">Paste it</span><span className="block text-xs text-tertiary">notes, an article, a chapter</span></span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.markdown,.rtf,.csv,.html,text/*,application/pdf" className="hidden" aria-label="Choose a file to make study material from" onChange={(e) => { void takeFile(e.target.files?.[0]); e.target.value = ""; }} />
              {pasting && (
                <div>
                  <textarea autoFocus value={pasted} onChange={(e) => setPasted(e.target.value)} rows={6} aria-label="Material to make study material from" placeholder="Paste the material here…" className="field w-full rounded-lg border border-line bg-field px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]" />
                  <Button className="mt-2" variant="primary" size="sm" disabled={!pasted.trim()} onClick={() => { const src = { name: pasted.trim().split("\n")[0].slice(0, 60) || "Pasted", text: pasted.trim() }; setSource(src); void read(src, ""); }}>Read it</Button>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-secondary" htmlFor="studio-topic">Or a topic</label>
                <div className="mt-1 flex gap-2">
                  <input id="studio-topic" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && topic.trim()) void read(null, topic.trim()); }} placeholder="Photosynthesis, the causes of WW1, integration by parts…" aria-label="Topic" className="field min-w-0 flex-1 rounded-lg border border-line bg-field px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]" />
                  <Button variant="secondary" disabled={!topic.trim()} onClick={() => void read(null, topic.trim())}>Next</Button>
                </div>
              </div>
              {(pages ?? []).filter((n) => n.content.trim().length > 200).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-secondary">Or one of your pages</p>
                  <ul className="mt-1 max-h-40 divide-y divide-line overflow-y-auto rounded-lg border border-line" aria-label="Your pages">
                    {(pages ?? []).filter((n) => n.content.trim().length > 200).slice(0, 12).map((n) => (
                      <li key={n.id}>
                        <button onClick={() => { const src = { name: n.title || "Untitled", text: n.content }; setSource(src); void read(src, ""); }} className="focus-inset flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-secondary hover:bg-subtle hover:text-primary">
                          <BookOpen size={13} className="shrink-0 text-tertiary" aria-hidden /> <span className="truncate">{n.title || "Untitled"}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button onClick={() => setStep("checker")} className="focus-ring flex w-full items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-left hover:bg-subtle">
                <ClipboardCheck size={18} className="text-accent" aria-hidden />
                <span><span className="block text-sm text-primary">Check an answer instead</span><span className="block text-xs text-tertiary">a question and what you wrote, marked against the scheme</span></span>
              </button>
            </div>
          )}

          {step === "reading" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center" role="status">
              <Loader2 size={22} className="animate-spin text-accent" aria-hidden />
              <p className="text-sm text-primary">Reading {source?.name ?? "it"}…</p>
              <p className="text-xs text-tertiary">Working out what it is and what it covers, so you can choose what to make.</p>
            </div>
          )}

          {step === "choose" && reading && (
            <div className="space-y-5">
              <section aria-label="What it is" className="rounded-xl border border-line bg-surface px-4 py-3">
                <p className="text-sm font-medium text-primary">{reading.title}</p>
                <p className="mt-0.5 text-xs text-tertiary">{[reading.subject, reading.level, reading.kind !== "other" ? reading.kind : ""].filter(Boolean).join(" · ") || (source ? source.name : "A topic")}</p>
                {reading.about && <p className="mt-1.5 text-sm text-secondary">{reading.about}</p>}
                {reading.topics.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-tertiary">Focus on (optional)</p>
                    <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Focus on">
                      {reading.topics.map((t) => {
                        const on = brief.focus?.includes(t) ?? false;
                        return (
                          <button key={t} aria-pressed={on} onClick={() => setBrief((b) => ({ ...b, focus: on ? (b.focus ?? []).filter((x) => x !== t) : [...(b.focus ?? []), t] }))} className={cn("focus-ring rounded-full border px-2.5 py-0.5 text-xs", on ? "border-transparent bg-cta text-cta-fg" : "border-line text-secondary hover:bg-subtle")}>
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              <div>
                <p className="text-sm font-medium text-primary">What would you like from it?</p>
                <p className="mt-0.5 text-xs text-tertiary">The ones that suit it are ticked. Each is written to a standard and checked by a second model before you see it.</p>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2" aria-label="What to make">
                  {TOOLS.filter((t) => t.id !== "checker").map((t) => {
                    const on = picked.has(t.id);
                    const suggested = reading.recommend.includes(t.id);
                    return (
                      <li key={t.id}>
                        <button
                          role="checkbox"
                          aria-checked={on}
                          aria-label={t.name}
                          onClick={() => toggle(t.id)}
                          className={cn("focus-ring flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors", on ? "border-[var(--accent)] bg-accent-subtle" : "border-line hover:bg-subtle")}
                        >
                          <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border", on ? "border-transparent bg-accent text-accent-fg" : "border-[var(--border-strong)]")}>{on && <Check size={11} strokeWidth={3} />}</span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-sm text-primary">{ICON[t.id]}{t.name}{suggested && <span className="rounded-full bg-subtle px-1.5 text-[0.65rem] text-tertiary">suits it</span>}</span>
                            <span className="block text-xs leading-snug text-tertiary">{t.blurb}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-secondary">Level</span>
                  <input value={brief.level ?? ""} onChange={(e) => setBrief((b) => ({ ...b, level: e.target.value }))} placeholder="GCSE, A level, IB, university…" aria-label="Level" className="field mt-1 w-full rounded-lg border border-line bg-field px-3 py-1.5 text-sm text-primary outline-none focus:border-[var(--accent)]" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-secondary">Exam board (optional)</span>
                  <input value={brief.board ?? ""} onChange={(e) => setBrief((b) => ({ ...b, board: e.target.value }))} placeholder="AQA, Edexcel, OCR, Cambridge…" aria-label="Exam board" className="field mt-1 w-full rounded-lg border border-line bg-field px-3 py-1.5 text-sm text-primary outline-none focus:border-[var(--accent)]" />
                </label>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <div>
                  <p className="text-xs font-medium text-secondary">For</p>
                  <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label="What it is for">
                    {PURPOSES.map((p) => (
                      <button key={p.id} role="radio" aria-checked={brief.purpose === p.id} onClick={() => setBrief((b) => ({ ...b, purpose: p.id }))} className={cn("focus-ring rounded-full border px-2.5 py-1 text-xs", brief.purpose === p.id ? "border-transparent bg-cta text-cta-fg" : "border-line text-secondary hover:bg-subtle")}>{p.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary">Difficulty</p>
                  <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Difficulty">
                    {DIFFICULTY.map((d) => (
                      <button key={d.id} role="radio" aria-checked={brief.difficulty === d.id} onClick={() => setBrief((b) => ({ ...b, difficulty: d.id }))} className={cn("focus-ring rounded-full border px-2.5 py-1 text-xs", brief.difficulty === d.id ? "border-transparent bg-cta text-cta-fg" : "border-line text-secondary hover:bg-subtle")}>{d.label}</button>
                    ))}
                  </div>
                </div>
                {picked.has("paper") && (
                  <div>
                    <p className="text-xs font-medium text-secondary">Paper length</p>
                    <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Paper length">
                      {LENGTHS.map((m) => (
                        <button key={m} role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)} className={cn("focus-ring tnum rounded-full border px-2.5 py-1 text-xs", minutes === m ? "border-transparent bg-cta text-cta-fg" : "border-line text-secondary hover:bg-subtle")}>{m} min</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {picked.has("plan") && (
                <label className="block">
                  <span className="text-xs font-medium text-secondary">Exam date, for the plan</span>
                  <input type="date" aria-label="Exam date" onChange={(e) => setBrief((b) => ({ ...b, examAt: e.target.value ? new Date(e.target.value + "T09:00").getTime() : undefined }))} className="mt-1 block rounded-lg border border-line bg-field px-3 py-1.5 text-sm text-primary" />
                </label>
              )}
              <label className="block">
                <span className="text-xs font-medium text-secondary">Anything else? (optional)</span>
                <input value={brief.extra ?? ""} onChange={(e) => setBrief((b) => ({ ...b, extra: e.target.value }))} placeholder="“I keep mixing up osmosis and diffusion”, “in Russian”, “for a 6-mark question”…" aria-label="Anything else" className="field mt-1 w-full rounded-lg border border-line bg-field px-3 py-1.5 text-sm text-primary outline-none focus:border-[var(--accent)]" />
              </label>
            </div>
          )}

          {(step === "making" || step === "done") && (
            <div>
              <p className="text-sm font-medium text-primary">{step === "making" ? "Making it…" : "Ready"}</p>
              <p className="mt-0.5 text-xs text-tertiary">{step === "making" ? "Each one is written to its standard, then a second model checks it before it is kept." : "Pages are in the Notebook, cards in Study, papers in Study under Your papers."}</p>
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface" aria-label="What is being made">
                {jobs.map((j) => {
                  const t = toolById(j.tool);
                  return (
                    <li key={j.tool} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="shrink-0" aria-hidden>
                        {j.state === "done" ? <CheckCircle2 size={16} className="text-[var(--success)]" /> : j.state === "failed" ? <X size={16} className="text-danger" /> : j.state === "waiting" ? <CircleDashed size={16} className="text-tertiary" /> : <Loader2 size={16} className="animate-spin text-accent" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-primary">{t.name}</span>
                        <span className="block truncate text-xs text-tertiary" aria-label={`${t.name}: ${j.state}`}>
                          {j.note ?? (j.state === "waiting" ? "waiting" : j.state === "writing" ? "writing to the standard…" : j.state === "checking" ? "checking…" : j.state === "fixing" ? "rewriting…" : "")}
                        </span>
                      </span>
                      {j.open && <Button size="sm" variant="secondary" onClick={() => open(j)} aria-label={`${j.open.label}: ${t.name}`}>{j.open.label}</Button>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {step === "checker" && <Checker configured={configured} modelId={modelId} rules={rules} />}
        </div>

        {step === "choose" && (
          <footer className="flex items-center gap-2 border-t border-line px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-xs text-tertiary">{picked.size ? `${picked.size} to make` : "Tick at least one"}</span>
            <Button variant="primary" disabled={!picked.size || !modelId} onClick={() => void make()}>
              <Sparkles size={14} /> Make {picked.size || ""}
            </Button>
          </footer>
        )}
        {step === "done" && (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
            <Button variant="secondary" onClick={() => { setStep("choose"); setJobs([]); }}>Make more</Button>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </footer>
        )}
      </section>
    </div>
  );
}

/* ----------------------------------------------------------- checker -- */

/**
 * The answer checker: any question, any answer, marked the way the board
 * would. With a mark scheme pasted, against that; without one, against a
 * scheme written first in the board's style, which the student can see.
 */
function Checker({ configured, modelId, rules }: { configured: Record<string, boolean>; modelId: string | null; rules: string }) {
  const [subject, setSubject] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [board, setBoard] = React.useState("");
  const [question, setQuestion] = React.useState("");
  const [marks, setMarks] = React.useState<number | "">("");
  const [scheme, setScheme] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [photo, setPhoto] = React.useState<{ mimeType: string; data: string; url: string } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ q: ExamQuestion; m: Marking; written: boolean } | null>(null);
  const photoRef = React.useRef<HTMLInputElement>(null);
  void configured;

  React.useEffect(() => {
    if (marks === "") { const n = marksOf(question); if (n) setMarks(n); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  const takePhoto = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8_000_000) { setNotice("That photo is over 8MB."); return; }
    const url = await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(r.error); r.readAsDataURL(file); });
    setPhoto({ mimeType: file.type || "image/jpeg", data: url.split(",")[1] ?? "", url });
  };

  const check = async () => {
    if (!modelId) { setNotice("No key configured yet — add one in Settings."); return; }
    if (!question.trim()) { setNotice("Paste the question first."); return; }
    if (!answer.trim() && !photo) { setNotice("Write your answer, or add a photo of it."); return; }
    const n = typeof marks === "number" && marks > 0 ? marks : marksOf(question) ?? 4;
    const about = { subject: subject || "the subject of the question", level: level || "", board: board || "" };
    setNotice(null);
    try {
      let points = schemeFromText(scheme);
      let model = "";
      let tip = "";
      const written = !points.length;
      if (written) {
        setBusy("Writing the mark scheme in the board's style…");
        const s = parseScheme(extractJson((await complete(`${schemePrompt({ title: "", subject, level, board }, question, n)}${rules ? `\n\n${rules}` : ""}`, { modelId, maxTokens: 1_500, temperature: 0.2 })) ?? ""));
        if (!s) { setNotice("The mark scheme did not come back in a shape that could be read. Try again, or paste the real one."); return; }
        points = s.scheme; model = s.model; tip = s.tip;
      }
      setBusy("Marking against the scheme…");
      const q: ExamQuestion = { topicId: "", topic: subject, question, marks: n, scheme: points, model, tip, difficulty: "exam" };
      const m = await markAnswer(about, q, answer, modelId, photo);
      if (!m) { setNotice("The marking did not come back in a shape that could be read. Press Mark again."); return; }
      setResult({ q, m, written });
      await db.marks.add({
        id: uid(), at: Date.now(), courseId: "checker", topicId: "checker", topic: subject || "Answer checker",
        question, marks: n, got: m.got, difficulty: "exam", answer: answer.trim() || "(photo)", points: m.points,
        feedback: m.feedback, better: m.better, model, tip,
      });
    } catch (err) {
      setNotice(whyItFailed(err, "It could not be marked."));
    } finally {
      setBusy(null);
    }
  };

  const field = "field mt-1 w-full rounded-lg border border-line bg-field px-3 py-1.5 text-sm text-primary outline-none focus:border-[var(--accent)]";
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block"><span className="text-xs font-medium text-secondary">Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" placeholder="Biology" className={field} /></label>
        <label className="block"><span className="text-xs font-medium text-secondary">Level</span><input value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level" placeholder="GCSE" className={field} /></label>
        <label className="block"><span className="text-xs font-medium text-secondary">Board</span><input value={board} onChange={(e) => setBoard(e.target.value)} aria-label="Board" placeholder="AQA" className={field} /></label>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-secondary">The question</span>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} aria-label="The question" placeholder="Explain why… [4]" className={field} />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-24"><span className="text-xs font-medium text-secondary">Marks</span><input type="number" min={1} max={40} value={marks} onChange={(e) => setMarks(e.target.value ? Number(e.target.value) : "")} aria-label="Marks" className={field} /></label>
        <p className="min-w-0 flex-1 pb-2 text-xs text-tertiary">Read from “[4]” in the question where it is there.</p>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-secondary">Mark scheme (optional)</span>
        <textarea value={scheme} onChange={(e) => setScheme(e.target.value)} rows={3} aria-label="Mark scheme" placeholder="One point a line. Leave empty and one is written in the board's style first." className={field} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-secondary">Your answer</span>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={6} aria-label="Your answer" placeholder="Write it as you would in the exam…" className={field} />
      </label>
      {photo && (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="Your working" className="h-16 w-auto rounded-md border border-line object-cover" />
          <Button size="sm" variant="ghost" onClick={() => setPhoto(null)} aria-label="Remove the photo"><X size={13} /></Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={Boolean(busy)} onClick={() => void check()}><ClipboardCheck size={14} /> {busy ?? "Mark my answer"}</Button>
        <Button variant="ghost" size="sm" onClick={() => photoRef.current?.click()} aria-label="Add a photo of your answer"><Camera size={13} /> Photo of it</Button>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Photo of your answer" onChange={(e) => { void takePhoto(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {notice && <p role="status" className="text-xs text-warning">{notice}</p>}
      {result && (
        <section aria-label="Checked answer" className="rounded-xl border border-line bg-surface px-4 py-3">
          {result.written && <p className="text-xs text-tertiary">No mark scheme was given, so one was written in the board's style first. It is under “Mark scheme and model answer”.</p>}
          <Result q={result.q} result={result.m} answer={answer} busy={null} />
        </section>
      )}
    </div>
  );
}

export default StudioSheet;
export { PAGE_TOOLS, HOUSE_RULES, briefLines };
