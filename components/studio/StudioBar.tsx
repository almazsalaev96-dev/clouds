"use client";

import * as React from "react";
import { ChevronDown, Plus } from "lucide-react";
import { TOOLS } from "@/lib/studio";
import { openStudio, routeStudioAsk } from "@/lib/studioBus";
import { MessageBar } from "@/components/chat/MessageBar";
import { RevisePicker } from "@/components/chat/RevisePicker";
import { Ideas } from "@/components/CreativeView";
import { getConfigured } from "@/lib/configured";
import { cn } from "@/lib/utils";
import { ICONS } from "./StudyTools";

/**
 * The Studio's bar: the one place you say what you want, and the tools as
 * a row of presses above it.
 *
 * The room used to open on three grids of squares — the study tools, the
 * ready-made apps, the blank starters — and a box somewhere under them.
 * Squares read as a settings page; nobody types into a settings page. What
 * people type into is a chat: a column of what has been made, and a bar
 * at the bottom that takes a sentence. So the tools became chips above the
 * bar, the way every assistant lays out its suggestions, the starters
 * and the ready-made apps became two lines of pills under the opening
 * turn, and every function the squares had is still one press away.
 *
 * What a sentence does: a topic or an ask for study material opens the
 * Studio sheet on it; an ask for something that runs is built; a long
 * paste is read as the source. The person does not choose a mode.
 */

const LEAD = ["notes", "flashcards", "paper", "quiz", "checker", "mindmap"] as const;

export function StudioBar({ onBuild }: { onBuild: (text: string) => void }) {
  const [text, setText] = React.useState("");
  const [more, setMore] = React.useState(false);
  const lead = LEAD.map((id) => TOOLS.find((t) => t.id === id)!).filter(Boolean);
  const rest = TOOLS.filter((t) => !LEAD.includes(t.id as (typeof LEAD)[number]));

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    const where = routeStudioAsk(t);
    if (where === "build") onBuild(t);
    else if (where === "source") openStudio({ source: { name: t.split("\n")[0].slice(0, 60) || "Pasted", text: t } });
    else openStudio({ topic: t });
    setText("");
  };

  const chip = (t: (typeof TOOLS)[number], i: number) => (
    <li key={t.id} className="shrink-0 anim-fade" style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}>
      <button
        onClick={() => openStudio({ tool: t.id })}
        /* "Make flashcards", not "Flashcards": a study tool is an act. */
        aria-label={t.id === "checker" ? "Check an answer" : `Make ${t.name.charAt(0).toLowerCase()}${t.name.slice(1)}`}
        title={t.blurb}
        className="focus-inset chip-press tap flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-secondary transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-primary"
      >
        <span className="text-accent" aria-hidden>{ICONS[t.id]}</span>
        {t.name}
      </button>
    </li>
  );

  return (
    <div className="relative shrink-0 bg-canvas">
      {/* The column scrolls under the bar. Without an edge the pills above
          looked cut off by the chips; a short fade says "there is more
          behind" the way every chat's dock does. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-b from-transparent to-[var(--bg-canvas)]" />
      <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* The tools. One row that scrolls sideways, and "All" opens the
            rest as a wrapped list under it — so the whole set is one press
            away without being on the page. */}
        <section aria-label="Study tools" className="mb-2">
          <ul className={cn("swipe-row flex gap-1.5 overflow-x-auto pb-1", more && "flex-wrap overflow-visible")} aria-label="Tools">
            {lead.map(chip)}
            {more && rest.map((t, i) => chip(t, i + lead.length))}
            <li className="shrink-0">
              <button
                onClick={() => setMore((v) => !v)}
                aria-expanded={more}
                className="focus-inset chip-press tap flex items-center gap-1 whitespace-nowrap rounded-full border border-transparent px-3 py-1.5 text-sm text-tertiary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
              >
                {more ? "Fewer" : `All ${TOOLS.length} tools`}
                <ChevronDown size={13} className={cn("transition-transform duration-[var(--dur-fast)]", more && "rotate-180")} aria-hidden />
              </button>
            </li>
          </ul>
        </section>

        {/* Things to build, as sentences. The same row scrolls. Not on a
            phone, where three rows over the box left half a screen for the
            column; the ideas are one typed sentence away there. */}
        <Ideas onBuild={onBuild} className="swipe-row mb-2 flex gap-1.5 overflow-x-auto pb-1 max-sm:hidden" />

        <MessageBar
          value={text}
          onChange={setText}
          onSubmit={submit}
          placeholder=""
          ariaLabel="What to make"
          canSend={Boolean(text.trim())}
          className="glass"
          focusOnTouch
          left={
            <button
              onClick={() => openStudio({})}
              aria-label="Make study materials from a book or notes"
              title="A book, your notes, a page or a topic — then notes, cards, a paper, a quiz"
              className="ctl focus-inset btn-press flex [--ctl:2.25rem] shrink-0 items-center justify-center rounded-full text-secondary transition-colors duration-[var(--dur-fast)] hover:bg-subtle hover:text-primary"
            >
              <Plus size={18} />
            </button>
          }
          right={<RevisePicker configured={getConfigured()} />}
        />
      </div>
    </div>
  );
}
