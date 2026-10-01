import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BookOpen, Check, Cpu, FileText, GraduationCap, Languages, LayoutTemplate, Lock,
  Minus, Presentation, Search, ShieldCheck, Sparkles, Table2, Users, Wand2, X,
} from "lucide-react";
import { Mark, Wordmark } from "@/components/brand/Logo";
import { PLUS_NAME, PLUS_PRICE } from "@/lib/plus";

/**
 * Why Armi exists, for somebody who has not opened it yet.
 *
 * The app's own front door is a greeting and a box, as it should be: the
 * person who is there has come to ask something. This page is for the one
 * who has not — who was sent the link, or is deciding whether to pay for
 * one more thing — and answers, in order, the questions they will ask:
 * what is it, why would I need it when I have a chat app, what does it
 * do, how is it different, what does it cost, where does my work go.
 *
 * Every claim on it is a thing the app does today, in the words the app
 * uses for it. Nothing is a number nobody counted. Where it compares, it
 * compares on facts that hold ("their paid plans cost around twenty
 * dollars a month"; "a model from another company checks the answer"),
 * not on taste. It is a static page: no store, no database, no keys, so
 * it opens in a second and can be read before anything is agreed to.
 */

export const metadata: Metadata = {
  title: "Why Armi — several AIs working your question together, in your browser",
  description:
    "Armi is a study-and-build assistant: one model answers, a model from another company checks it, and the result becomes cards, a lesson, a PowerPoint, a PDF, a spreadsheet or a web app — all kept in your browser. Free with your own keys, or Armi Plus for $1 a month.",
  /* No openGraph block of its own: a nested one replaces the root's whole
     openGraph, picture included, and the card drawn in app/opengraph-image
     is the one this link should carry. Title and description carry over. */
};

/* ------------------------------------------------------------- content -- */

const REASONS: { title: string; problem: string; armi: string; icon: React.ReactNode }[] = [
  {
    icon: <ShieldCheck size={20} />,
    title: "One model marking its own homework is not a check",
    problem: "A chat app asks one company's model and shows you what came back. If it is wrong, it is wrong confidently, and nothing in the app would know.",
    armi: "Every Armi model is a team. One model writes; on real work a model from a different company reads the question first and says what a good answer must get right, then another checks the answer against that list. The line under each answer says who did what. A greeting or a small fact goes to one model, so small things stay fast.",
  },
  {
    icon: <GraduationCap size={20} />,
    title: "Answering is not teaching",
    problem: "You can ask a chat app about osmosis forty times and it will explain osmosis forty times. It does not know you asked yesterday, what you got wrong, or when you will forget.",
    armi: "Armi keeps your flashcards on a real spaced-repetition schedule, turns a page of notes into cards and a card you keep failing into a question, works through your own PDF beside you with a pencil, marks your working against the mark scheme, counts down to your exam, and tells you what to revise next.",
  },
  {
    icon: <LayoutTemplate size={20} />,
    title: "You asked for the thing, not a description of it",
    problem: "Ask for a quiz and you get a paragraph about quizzes. Ask for a presentation and you get bullet points to paste somewhere else.",
    armi: "Ask Armi for a quiz and a quiz runs. Ask for a presentation and a designed PowerPoint is made, in a theme you choose. A worksheet, a report, a letter, a CV come out as PDF or Word; a budget comes out as Excel with live formulas; a website or an app is built whole and runs beside the chat.",
  },
  {
    icon: <Lock size={20} />,
    title: "Your work should stay yours",
    problem: "Everything you type into most assistants lives on their servers, under an account, read by their policies. Leave, and it stays there.",
    armi: "Armi keeps conversations, notes, cards, documents and settings in your own browser. There is no account. One file backs it all up. The only thing that leaves is the question itself, sent to the model company whose key you chose — and the privacy page says so in full.",
  },
  {
    icon: <Users size={20} />,
    title: "Twenty dollars a month for one company's model",
    problem: "Each big assistant wants its own subscription, and buys you that one company's models.",
    armi: `Armi runs on whichever companies' keys you add — you pay those companies only for what you use, often cents a month — or on free open models installed on your own computer, or on ${PLUS_NAME} for ${PLUS_PRICE} a month with no keys at all.`,
  },
  {
    icon: <Languages size={20} />,
    title: "It should understand people, not just prompts",
    problem: "Typos, shorthand, two languages in one line, \"same but for chapter 4\": the better the question has to be written, the less help you get when you need it most.",
    armi: "Armi reads past spelling and shorthand to what you meant, in English, Russian and Kazakh. It shapes each answer to its question — steps for a how-to, a verdict and a table for a comparison, the fix first for broken code — and notices when you are stressed, frustrated or new to something, and answers accordingly.",
  },
];

const DOES: { icon: React.ReactNode; title: string; text: string }[] = [
  { icon: <Sparkles size={18} />, title: "Chat, with a team behind it", text: "Armi models — Nova, Mira, Lumos, Astro and the job tactics — each a writer plus a brief, a check, a duel or a council from other companies. Auto picks the tier the question deserves." },
  { icon: <GraduationCap size={18} />, title: "Study", text: "Flashcards on a spaced-repetition schedule, courses with exam-board syllabuses, typed tests, worked examples, mistakes you keep making, a daily plan, an exam countdown, and three games." },
  { icon: <BookOpen size={18} />, title: "Tutor", text: "Open a PDF or a photo of a page and work through it together: ask about a passage, draw on it with the pencil, have your working marked, get a study guide and questions from the book itself." },
  { icon: <FileText size={18} />, title: "Notebook", text: "Pages that cite their sources, link to each other, and become cards or questions. A notebook of sources answers questions with citations checked against the text." },
  { icon: <Wand2 size={18} />, title: "Studio: 22 tools", text: "Notes, a study guide, a knowledge organiser, Cornell notes, flashcards, a quiz, an exam paper with a mark scheme, a mind map, a glossary, a timeline, a lesson, a plan, an essay, a presentation and more — from a topic or from your own book." },
  { icon: <Presentation size={18} />, title: "Engines for real files", text: "PowerPoint with ten layouts and eight themes. PDF documents in seven kinds and six styles. Excel with live formulas. Word with real tables. Web apps and games that run." },
  { icon: <Search size={18} />, title: "Research and fact-check", text: "Web search on a turn, deep research with sources from several angles, a fact-check that looks each claim up, and a second opinion from another company on demand." },
  { icon: <Cpu size={18} />, title: "Free AI on your computer", text: "Install Ollama or LM Studio, download an open model, and Armi uses it — offline, free, private — with the same rooms around it." },
  { icon: <Table2 size={18} />, title: "Projects, memory, routines", text: "Projects with their own instructions and files. Memories you can see and delete. Routines that quiz or brief you at a set time. Assistants of your own. Rules that hold everywhere." },
];

type Mark3 = "yes" | "some" | "no";
const COMPARE: { row: string; armi: [Mark3, string]; chat: [Mark3, string]; revision: [Mark3, string] }[] = [
  { row: "What it costs", armi: ["yes", `Free with your own keys or a local model; ${PLUS_NAME} ${PLUS_PRICE} a month`], chat: ["some", "Their paid plans cost around $20 a month each"], revision: ["some", "Paid plans"] },
  { row: "Who checks the answer", armi: ["yes", "A model from another company, on real work, by default"], chat: ["no", "The same company's model, or nobody"], revision: ["no", "Not an AI answer"] },
  { row: "Where your work lives", armi: ["yes", "In your browser; one backup file; no account"], chat: ["no", "On their servers, under your account"], revision: ["no", "On their servers"] },
  { row: "Teaches from your own book", armi: ["yes", "Any PDF or photo: guide, questions, cards, marking"], chat: ["some", "Can read a file you attach; no study system"], revision: ["no", "Their notes, for set exams"] },
  { row: "Remembers what you are learning", armi: ["yes", "Spaced repetition, mistakes, a daily plan, an exam countdown"], chat: ["no", "Each chat starts again"], revision: ["some", "Progress on their questions"] },
  { row: "Makes real files", armi: ["yes", "PowerPoint, PDF, Excel, Word, web apps, quizzes, lessons"], chat: ["some", "Some files, some of the time"], revision: ["no", "Downloads of their own material"] },
  { row: "Runs free models on your computer", armi: ["yes", "Ollama or LM Studio, offline"], chat: ["no", ""], revision: ["no", ""] },
  { row: "Shows what it did", armi: ["yes", "Which Armi model, who checked, why, and what it cost — on every answer"], chat: ["no", ""], revision: ["no", ""] },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Do I need an account?", a: "No. Armi has nothing to sign up for. Everything you make is kept in your browser, and a backup is one file you can keep anywhere." },
  { q: "Do I have to pay?", a: `No. Add a key from a model company and you pay that company only for what you use. Or install a free open model on your computer and pay nobody. ${PLUS_NAME} is for people who want neither: ${PLUS_PRICE} a month, no keys, the everyday Armi models.` },
  { q: "Which AI companies does it use?", a: "Whichever you give it keys for — several of the biggest — and any open model you install. Armi never puts a company's name on an answer; it shows the Armi model that answered and what it did. Settings says plainly which companies your keys are for." },
  { q: "What languages?", a: "The interface is in English. Ask in English, Russian or Kazakh and it answers in the language you wrote in; its reading of your question — what shape the answer should take, how you seem — works in all three." },
  { q: "Does it work offline?", a: "The rooms that never needed the network — your notes, your cards, your documents — work offline. With a local model installed, so does the chat." },
  { q: "Is it for students only?", a: "Students first: IGCSE, A-level, IB, university. But a teacher gets worksheets, presentations and quizzes; a builder gets apps and code with a second model checking it; anyone who writes gets a document that is ready to send." },
];

/* --------------------------------------------------------------- page -- */

function Cell({ m, text }: { m: Mark3; text: string }) {
  const Icon = m === "yes" ? Check : m === "some" ? Minus : X;
  const tone = m === "yes" ? "text-[var(--success)]" : m === "some" ? "text-[var(--warning)]" : "text-tertiary";
  return (
    <span className="flex items-start gap-2">
      <Icon size={16} className={`mt-0.5 shrink-0 ${tone}`} aria-label={m === "yes" ? "Yes" : m === "some" ? "Partly" : "No"} />
      <span className="text-sm text-secondary">{text || (m === "no" ? "No" : "")}</span>
    </span>
  );
}

export default function WhyPage() {
  return (
    <main className="why min-h-dvh bg-canvas text-primary">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" className="focus-inset flex items-center gap-2 rounded-md" aria-label="Open Armi">
            <Wordmark height={26} />
          </Link>
          <nav aria-label="On this page" className="hidden items-center gap-5 text-sm text-secondary md:flex">
            <a href="#why" className="hover:text-primary">Why</a>
            <a href="#does" className="hover:text-primary">What it does</a>
            <a href="#compare" className="hover:text-primary">Compared</a>
            <a href="#price" className="hover:text-primary">Price</a>
            <a href="#privacy" className="hover:text-primary">Privacy</a>
          </nav>
          <Link href="/" className="focus-inset flex h-9 items-center gap-1.5 rounded-full bg-[var(--cta)] px-4 text-sm font-medium text-[var(--cta-fg)] hover:bg-[var(--cta-hover)]">
            Open Armi <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* The one-sentence answer, then the two doors. */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-14 pt-16 sm:pt-24">
        <p className="eyebrow mb-4 text-tertiary">A study-and-build assistant, in your browser</p>
        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Several AIs work your question together. The answer becomes the thing you needed.
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-lg text-secondary">
          One model writes, a model from another company checks, and what comes out is a lesson, a set of cards, a PowerPoint, a PDF, a spreadsheet or a working app — kept in your own browser, with no account. Free with your own keys or a free local model; {PLUS_NAME} for {PLUS_PRICE} a month if you want no keys at all.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/" className="focus-inset flex h-11 items-center gap-2 rounded-full bg-[var(--cta)] px-5 text-[0.9375rem] font-medium text-[var(--cta-fg)] hover:bg-[var(--cta-hover)]">
            Start, free <ArrowRight size={16} />
          </Link>
          <Link href="/#plus" className="focus-inset flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 text-[0.9375rem] font-medium text-primary hover:border-line-strong">
            {PLUS_NAME}, {PLUS_PRICE} a month
          </Link>
          <a href="#does" className="focus-inset rounded-md px-2 py-2 text-sm text-secondary hover:text-primary">See everything it does</a>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-3 text-sm text-secondary sm:grid-cols-4" aria-label="In short">
          <li className="rounded-xl border border-line bg-surface p-3"><span className="block text-2xl font-semibold text-primary tnum">2+</span>models on every real question</li>
          <li className="rounded-xl border border-line bg-surface p-3"><span className="block text-2xl font-semibold text-primary tnum">22</span>Studio tools, from a topic or your own book</li>
          <li className="rounded-xl border border-line bg-surface p-3"><span className="block text-2xl font-semibold text-primary tnum">5</span>file engines: PowerPoint, PDF, Excel, Word, web</li>
          <li className="rounded-xl border border-line bg-surface p-3"><span className="block text-2xl font-semibold text-primary tnum">0</span>accounts, servers holding your work, analytics</li>
        </ul>
      </section>

      {/* Why: the six things a chat app does not do, each with the problem first. */}
      <section id="why" className="border-t border-line bg-section">
        <div className="mx-auto w-full max-w-5xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Why people need it</h2>
          <p className="mt-2 max-w-2xl text-secondary">The chat apps answer. They do not check, teach, build or remember — and they keep what you wrote.</p>
          <ol className="mt-8 grid gap-4 md:grid-cols-2">
            {REASONS.map((r) => (
              <li key={r.title} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-2.5 text-accent">{r.icon}<h3 className="text-base font-semibold text-primary">{r.title}</h3></div>
                <p className="mt-3 text-sm text-tertiary"><span className="font-medium text-secondary">The problem. </span>{r.problem}</p>
                <p className="mt-2 text-sm text-secondary"><span className="font-medium text-primary">Armi. </span>{r.armi}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What it does: every room, one line each. */}
      <section id="does" className="mx-auto w-full max-w-5xl px-4 py-16">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Everything it does</h2>
        <p className="mt-2 max-w-2xl text-secondary">Five rooms on one memory: a sentence in a note becomes a card, a card you keep failing becomes a question, a question becomes a quiz that runs.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DOES.map((d) => (
            <li key={d.title} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center gap-2 text-accent">{d.icon}<h3 className="text-[0.9375rem] font-semibold text-primary">{d.title}</h3></div>
              <p className="mt-2 text-sm text-secondary">{d.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Compared: on facts, with a legend, nothing invented. */}
      <section id="compare" className="border-t border-line bg-section">
        <div className="mx-auto w-full max-w-5xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Compared with what you have</h2>
          <p className="mt-2 max-w-2xl text-secondary">Against a chat app from one AI company, and against a revision website with its own notes and papers.</p>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <caption className="sr-only">How Armi compares with a chat app and a revision site</caption>
              <thead>
                <tr className="border-b border-line text-sm">
                  <th scope="col" className="p-4 font-medium text-tertiary"></th>
                  <th scope="col" className="p-4 font-semibold text-primary">Armi</th>
                  <th scope="col" className="p-4 font-medium text-secondary">A chat app</th>
                  <th scope="col" className="p-4 font-medium text-secondary">A revision site</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((c) => (
                  <tr key={c.row} className="border-b border-line last:border-0 align-top">
                    <th scope="row" className="p-4 text-sm font-medium text-primary">{c.row}</th>
                    <td className="p-4"><Cell m={c.armi[0]} text={c.armi[1]} /></td>
                    <td className="p-4"><Cell m={c.chat[0]} text={c.chat[1]} /></td>
                    <td className="p-4"><Cell m={c.revision[0]} text={c.revision[1]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-tertiary">Prices and features of other products change; "around $20" is what their main paid plans have cost. Armi's column is what the app does today.</p>
        </div>
      </section>

      {/* Price: three doors, said plainly. */}
      <section id="price" className="mx-auto w-full max-w-5xl px-4 py-16">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What it costs</h2>
        <p className="mt-2 max-w-2xl text-secondary">Three ways in. All three get the whole app; they differ only in who the models belong to.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="text-lg font-semibold">Your own keys</h3>
            <p className="mt-1 text-3xl font-semibold tnum">Free</p>
            <p className="mt-2 text-sm text-secondary">Add a key from one or more AI companies. You pay them for what you use — for most students, cents to a few dollars a month — and Armi adds up the cost as it happens. Two companies' keys make the checks possible.</p>
            <Link href="/#keys" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">Add a key <ArrowRight size={14} /></Link>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="text-lg font-semibold">A free model on your computer</h3>
            <p className="mt-1 text-3xl font-semibold tnum">Free</p>
            <p className="mt-2 text-sm text-secondary">Install Ollama or LM Studio, download an open model that fits your machine, and Armi runs on it: offline, private, nothing to pay anyone. Armi suggests which models, by what your computer has.</p>
            <Link href="/#local" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">Set it up <ArrowRight size={14} /></Link>
          </div>
          <div className="rounded-2xl border-2 border-[var(--accent)] bg-surface p-5">
            <h3 className="text-lg font-semibold">{PLUS_NAME}</h3>
            <p className="mt-1 text-3xl font-semibold tnum">{PLUS_PRICE}<span className="text-base font-normal text-secondary"> a month</span></p>
            <p className="mt-2 text-sm text-secondary">No keys, nothing to paste. The everyday Armi models — Nova, Mira, Lumos — on Armi's own keys, with a monthly allowance measured in what the models cost. The top tier still needs your own key.</p>
            <Link href="/#plus" className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--cta)] px-4 text-sm font-medium text-[var(--cta-fg)] hover:bg-[var(--cta-hover)]">Get {PLUS_NAME} <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>

      {/* Privacy: the whole of it, in four lines, the same words as the privacy page. */}
      <section id="privacy" className="border-t border-line bg-section">
        <div className="mx-auto w-full max-w-5xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Where your work goes</h2>
          <dl className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-5"><dt className="font-semibold">Stored in this browser</dt><dd className="mt-1 text-sm text-secondary">Conversations, pages, cards, documents, projects, memories, settings and what answers cost. No account, no server of ours holds a copy. One backup file.</dd></div>
            <div className="rounded-2xl border border-line bg-surface p-5"><dt className="font-semibold">What leaves, and where</dt><dd className="mt-1 text-sm text-secondary">The question, its thread and the material the answer needs go to the model company whose key you chose, through Armi's own forwarding route, which reads nothing and keeps nothing.</dd></div>
            <div className="rounded-2xl border border-line bg-surface p-5"><dt className="font-semibold">Your keys</dt><dd className="mt-1 text-sm text-secondary">Kept in this browser, sent only to the company they belong to, never shown in full again once saved, never logged, never in a link.</dd></div>
            <div className="rounded-2xl border border-line bg-surface p-5"><dt className="font-semibold">What Armi never does</dt><dd className="mt-1 text-sm text-secondary">No analytics, no tracking, no selling anything, no reading your conversations. Delete everything in one press, and it is gone.</dd></div>
          </dl>
        </div>
      </section>

      {/* Questions people ask before they start. */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Questions</h2>
        <dl className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
          {FAQ.map((f) => (
            <div key={f.q} className="p-5"><dt className="font-medium">{f.q}</dt><dd className="mt-1.5 text-sm text-secondary">{f.a}</dd></div>
          ))}
        </dl>
        <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-line bg-section p-8 text-center">
          <Mark size={28} className="text-primary" />
          <p className="max-w-xl text-balance text-lg">Open it, ask the thing you are stuck on, and watch a second model check the answer before you trust it.</p>
          <Link href="/" className="focus-inset mt-2 flex h-11 items-center gap-2 rounded-full bg-[var(--cta)] px-5 text-[0.9375rem] font-medium text-[var(--cta-fg)] hover:bg-[var(--cta-hover)]">
            Open Armi <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-tertiary">
          <span>Armi · made by Almaz</span>
          <span className="flex gap-4"><a href="#privacy" className="hover:text-primary">Privacy</a><Link href="/" className="hover:text-primary">Open the app</Link></span>
        </div>
      </footer>
    </main>
  );
}
