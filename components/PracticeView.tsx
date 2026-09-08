"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, Check, ChevronRight, Eye, Lightbulb, X } from "lucide-react";
import type { Problem, Skill, Trap } from "@/lib/types";
import { createSkill, db, deleteSkill, dueTraps, uid } from "@/lib/db";
import { offerUndo } from "@/lib/undo";
import { cheapestAvailable, generateProblems, sketchSkill, type DraftTrap } from "@/lib/generate";
import { checkAnswer, interleave, recordAttempt, steerBand } from "@/lib/practice";
import { formatDue, newSchedule } from "@/lib/study";
import { cn } from "@/lib/utils";
import { useAutoGrow } from "@/lib/hooks/useAutoGrow";
import { Markdown } from "@/components/chat/Markdown";
import { Button, IconButton } from "@/components/ui/primitives";
import { DetailBar, SectionIndex } from "@/components/SectionIndex";
import { InlineError } from "@/components/chat/Message";

const SESSION_LENGTH = 20;

/**
 * Practice: a problem engine whose scheduled unit is the mistake.
 *
 * The rest of the app handles reading and writing — notes, cards, papers. The
 * thing it could not do was put a question in front of you that you will get
 * wrong for a reason it can name. So a Skill is a folder with a short primer,
 * and the thing that carries a forgetting curve is a Trap: one named wrong
 * move, with its own schedule. Answering produces evidence; the trap comes
 * back on the schedule that evidence earns.
 */
export function PracticeView({
  skillId,
  configured,
  onSelect,
  onBack,
}: {
  skillId: string | null;
  configured: Record<string, boolean>;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const [seeding, setSeeding] = React.useState(false);
  const [drillingAll, setDrillingAll] = React.useState(false);

  const skills = useLiveQuery(() => db.skills.orderBy("updatedAt").reverse().toArray(), []);
  const traps = useLiveQuery(() => db.traps.toArray(), [], [] as Trap[]);
  const skill = useLiveQuery(() => (skillId ? db.skills.get(skillId) : undefined), [skillId]);

  React.useEffect(() => {
    if (skillId) {
      setSeeding(false);
      setDrillingAll(false);
    }
  }, [skillId]);

  if (seeding) {
    return (
      <SeedSheet
        configured={configured}
        onCancel={() => setSeeding(false)}
        onCreated={(id) => {
          setSeeding(false);
          onSelect(id);
        }}
      />
    );
  }

  if (drillingAll) {
    return (
      <Drill
        title="Everything due"
        traps={dueTraps(traps ?? [])}
        skills={skills ?? []}
        configured={configured}
        onBack={() => setDrillingAll(false)}
      />
    );
  }

  if (skill) {
    const own = (traps ?? []).filter((t) => t.skillId === skill.id);
    const due = dueTraps(own);
    return (
      <Drill
        title={skill.name || "Untitled skill"}
        // Nothing due in this skill still means practice, just unscheduled:
        // opening a skill on purpose is itself a request to work on it.
        traps={due.length ? due : own}
        skills={[skill]}
        configured={configured}
        onBack={onBack}
      />
    );
  }

  const due = dueTraps(traps ?? []);

  return (
    <SectionIndex
      title="Practice"
      newLabel="New skill"
      emptyTitle="Nothing to practise yet."
      emptyHint="Paste a topic, a lecture note, or a worked example you can follow but can't reproduce. Practice won't solve your problem set — it makes more like it, and names the mistake you keep making."
      loading={skills === undefined}
      items={(skills ?? []).map((s) => {
        const own = (traps ?? []).filter((t) => t.skillId === s.id);
        const owed = dueTraps(own).length;
        return {
          id: s.id,
          title: s.name || "Untitled skill",
          meta: `${own.length} trap${own.length === 1 ? "" : "s"}`,
          preview: s.state === "failed" ? s.generationError : own[0]?.label,
          badge: owed > 0 ? String(owed) : undefined,
          searchText: own.map((t) => t.label).join(" "),
        };
      })}
      onOpen={onSelect}
      onNew={() => setSeeding(true)}
      onDelete={async (id) => {
        const name = skills?.find((k) => k.id === id)?.name || "skill";
        offerUndo(name, await deleteSkill(id));
      }}
      lead={
        due.length > 0 ? (
          <button
            onClick={() => setDrillingAll(true)}
            className="group mb-3 flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-3 text-left transition-colors duration-[var(--dur-fast)] hover:border-accent"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent">
              <ArrowRight size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-primary">
                {due.length} trap{due.length === 1 ? "" : "s"} due
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-tertiary transition-transform duration-[var(--dur-fast)] group-hover:translate-x-0.5" />
          </button>
        ) : null
      }
    />
  );
}

/* ------------------------------------------------------------------ seed -- */

function SeedSheet({
  configured,
  onCancel,
  onCreated,
}: {
  configured: Record<string, boolean>;
  onCancel: () => void;
  onCreated: (skillId: string) => void;
}) {
  const [seed, setSeed] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [needs, setNeeds] = React.useState<string | null>(null);
  const [sketch, setSketch] = React.useState<{ name: string; goal: string; primer: string; traps: DraftTrap[] } | null>(null);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, seed);

  const find = async () => {
    if (!seed.trim()) return;
    setBusy(true);
    setError(null);
    setNeeds(null);
    const result = await sketchSkill(seed, cheapestAvailable(configured));
    setBusy(false);
    if ("error" in result) return setError(result.error);
    if (result.needs) return setNeeds(result.needs);
    setSketch(result);
  };

  /** Nothing is written until the learner has seen the traps and kept them. */
  const commit = async () => {
    if (!sketch) return;
    const now = Date.now();
    const skill = await createSkill({
      name: sketch.name,
      goal: sketch.goal,
      primer: sketch.primer,
      state: "ready",
      sourceText: seed,
      trapCount: sketch.traps.length,
    });
    await db.traps.bulkAdd(
      sketch.traps.map((t) => ({
        ...newSchedule(now),
        id: uid(),
        skillId: skill.id,
        slug: t.slug,
        label: t.label,
        diagnosis: t.diagnosis,
        quote: t.quote,
        state: "unseen" as const,
        seen: 0,
        firstTry: 0,
        window: "",
        createdAt: now,
        updatedAt: now,
      })),
    );
    onCreated(skill.id);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailBar onBack={onCancel} backLabel="All skills" />
      <div className="mx-auto w-full max-w-[var(--measure)] overflow-y-auto px-4 pb-[18vh] pt-4">

        {!sketch ? (
          <>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-primary">New skill</h1>
            <p className="mt-1.5 text-sm text-secondary">
              What do you keep getting wrong? A topic, a note, or a worked example you can follow
              but can&apos;t reproduce.
            </p>

            <textarea
              ref={ref}
              autoFocus
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder={"Integration by substitution\n\nor paste the worked example you got stuck on."}
              className="mt-4 min-h-[9rem] w-full resize-none overflow-hidden rounded-lg border border-line-strong bg-surface p-3 text-base text-primary outline-none transition-colors duration-[var(--dur-fast)] placeholder:text-tertiary focus:border-accent"
            />

            <div className="mt-3 flex items-center gap-2">
              <Button variant="primary" onClick={find} disabled={busy || !seed.trim()}>
                {busy && <span className="think-orb" aria-hidden />}
                {busy ? "Finding the traps…" : "Find the traps"}
              </Button>
              {busy && (
                <span className="text-xs text-tertiary">
                  writing the mistakes you&apos;re likely to make — about fifteen seconds
                </span>
              )}
            </div>

            {needs && (
              <p className="mt-3 border-l-2 border-[var(--live)] py-1 pl-3 text-sm text-primary anim-fade">
                {needs}
              </p>
            )}
            {error && <InlineError message={error} onRetry={find} onDismiss={() => setError(null)} />}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-primary">{sketch.name}</h1>
            <p className="mt-1.5 text-sm text-secondary">{sketch.goal}</p>

            {sketch.primer && (
              <div className="mt-4 rounded-lg border border-line bg-surface p-4">
                <Markdown content={sketch.primer} />
              </div>
            )}

            <h2 className="mb-2 mt-6 text-sm font-medium text-primary">
              The mistakes it will test you on
            </h2>
            <p className="mb-3 text-xs text-tertiary">
              Throw away any that aren&apos;t yours. Nothing is saved until you start.
            </p>

            <ul className="space-y-1.5">
              {sketch.traps.map((t) => (
                <li
                  key={t.slug}
                  className="group flex items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-primary">{t.label}</span>
                    <span className="mt-0.5 block text-xs text-secondary">{t.diagnosis}</span>
                    {t.quote && (
                      <span className="mt-1 block border-l-2 border-line pl-2 text-xs text-tertiary">
                        {t.quote}
                      </span>
                    )}
                  </span>
                  <IconButton
                    label="Discard this trap"
                    size={26}
                    onClick={() =>
                      setSketch({ ...sketch, traps: sketch.traps.filter((x) => x.slug !== t.slug) })
                    }
                  >
                    <X size={13} />
                  </IconButton>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={commit} disabled={!sketch.traps.length}>
                Start practising
              </Button>
              <Button variant="ghost" onClick={() => setSketch(null)}>
                Back
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- drill -- */

function Drill({
  title,
  traps,
  skills,
  configured,
  onBack,
}: {
  title: string;
  traps: Trap[];
  skills: Skill[];
  configured: Record<string, boolean>;
  onBack: () => void;
}) {
  const [queue, setQueue] = React.useState<Problem[]>([]);
  const [index, setIndex] = React.useState(0);
  const [response, setResponse] = React.useState("");
  const [verdict, setVerdict] = React.useState<null | "right" | "wrong">(null);
  const [hinted, setHinted] = React.useState(false);
  const [shown, setShown] = React.useState(false);
  const [missedFirst, setMissedFirst] = React.useState(false);
  const [done, setDone] = React.useState(0);
  const [moved, setMoved] = React.useState<{ label: string; due: number }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const trapById = React.useMemo(() => new Map(traps.map((t) => [t.id, t])), [traps]);
  const problem = queue[index];
  const trap = problem ? trapById.get(problem.trapId) : undefined;

  /**
   * Serve from the bank first, and only generate what is missing. The bank is
   * a first-class fallback rather than a cache: an unreachable model should
   * cost you the next batch, not the session you are in.
   */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!traps.length) {
        setLoading(false);
        return;
      }
      const trapIds = traps.map((t) => t.id);
      const banked = (await db.problems.where("trapId").anyOf(trapIds).toArray()).filter(
        (p) => !p.retired,
      );
      if (cancelled) return;

      if (banked.length >= traps.length) {
        setQueue(interleave(banked).slice(0, SESSION_LENGTH));
        setLoading(false);
        return;
      }

      const skill = skills[0];
      const drafts = skill
        ? await generateProblems(
            { name: skill.name, primer: skill.primer },
            traps.map((t) => ({ slug: t.slug, label: t.label })),
            skill.band,
            cheapestAvailable(configured),
          )
        : null;
      if (cancelled) return;

      if (!drafts?.length) {
        if (banked.length) {
          setQueue(interleave(banked).slice(0, SESSION_LENGTH));
        } else {
          setError(
            "Couldn't write problems for this yet. Check the API key for the model, or try again.",
          );
        }
        setLoading(false);
        return;
      }

      const now = Date.now();
      const bySlug = new Map(traps.map((t) => [t.slug, t]));
      const fresh: Problem[] = [];
      for (const d of drafts) {
        const t = bySlug.get(d.trapSlug);
        if (!t) continue;
        fresh.push({
          id: uid(),
          skillId: t.skillId,
          trapId: t.id,
          band: skill?.band ?? 1,
          kind: d.kind,
          prompt: d.prompt,
          answer: d.kind === "numeric" ? { value: d.value, tolerance: d.tolerance } : { accept: d.accept },
          explanation: d.explanation,
          hint: d.hint,
          stepOne: d.stepOne,
          createdAt: now,
        });
      }
      await db.problems.bulkAdd(fresh);
      if (cancelled) return;
      setQueue(interleave([...banked, ...fresh]).slice(0, SESSION_LENGTH));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // Built once per drill: regenerating mid-session would reshuffle the queue
    // under the learner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setResponse("");
    setVerdict(null);
    setHinted(false);
    setShown(false);
    setMissedFirst(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const check = async () => {
    if (!problem || !trap) return;
    const right = checkAnswer(problem, response);

    if (!right && !missedFirst) {
      // A miss opens the retry rather than ending the question: the correction
      // is the point, and it is worth more while the attempt is still warm.
      setMissedFirst(true);
      setVerdict("wrong");
      return;
    }

    const { trap: next } = await recordAttempt({
      trap,
      problem,
      response,
      correctFirstTry: right && !missedFirst,
      retriedOk: right && missedFirst,
      hinted,
      shown,
    });
    setMoved((m) => [...m, { label: trap.label, due: next.due }]);
    setVerdict("right");
    setDone((d) => d + 1);
  };

  const advance = () => {
    setIndex((i) => i + 1);
    reset();
  };

  const giveUp = async () => {
    if (!problem || !trap) return;
    setShown(true);
    const { trap: next } = await recordAttempt({
      trap,
      problem,
      response,
      correctFirstTry: false,
      retriedOk: false,
      hinted,
      shown: true,
    });
    setMoved((m) => [...m, { label: trap.label, due: next.due }]);
    setVerdict("right");
    setDone((d) => d + 1);
  };

  // Band steering happens between sessions, on evidence, not mid-drill.
  React.useEffect(() => {
    if (!queue.length || index < queue.length) return;
    const skill = skills[0];
    if (!skill) return;
    const window = traps.map((t) => t.window.slice(-2)).join("").slice(-6);
    const band = steerBand(skill.band, window);
    if (band !== skill.band) void db.skills.update(skill.id, { band, updatedAt: Date.now() });
  }, [index, queue.length, skills, traps]);

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DetailBar onBack={onBack} backLabel="All skills">
          <h1 className="mr-auto truncate text-sm font-medium text-primary">{title}</h1>
        </DetailBar>
        <div className="mx-auto w-full max-w-[var(--measure)] px-4 pt-10">
          <div className="flex items-center gap-2 text-sm text-tertiary">
            <span className="think-orb" aria-hidden />
            writing problems for these traps
          </div>
          <div className="mt-4 space-y-2">
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-4 w-3/5" />
            <div className="skeleton h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DetailBar onBack={onBack} backLabel="All skills">
          <h1 className="mr-auto truncate text-sm font-medium text-primary">{title}</h1>
        </DetailBar>
        <div className="mx-auto w-full max-w-[var(--measure)] px-4 pt-6">
          <InlineError message={error} />
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DetailBar onBack={onBack} backLabel="All skills">
          <h1 className="mr-auto truncate text-sm font-medium text-primary">{title}</h1>
        </DetailBar>
        <div className="mx-auto w-full max-w-[var(--measure)] px-4 pt-8 anim-fade">
          <h2 className="text-lg font-semibold text-primary">
            {done > 0 ? `${done} answered.` : "Nothing to practise here."}
          </h2>
          {moved.length > 0 && (
            <>
              <p className="mt-1 text-sm text-secondary">What moved, and when it comes back:</p>
              <ul className="mt-3 space-y-1.5">
                {[...new Map(moved.map((m) => [m.label, m])).values()].map((m) => (
                  <li
                    key={m.label}
                    className="flex items-baseline gap-3 rounded-lg border border-line bg-surface px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 text-sm text-primary">{m.label}</span>
                    <span className="shrink-0 text-xs text-tertiary tnum">{formatDue(m.due)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Button className="mt-5" onClick={onBack}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  const remaining = queue.length - index;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailBar onBack={onBack} backLabel="All skills">
        <h1 className="mr-auto truncate text-sm font-medium text-primary">{title}</h1>
        <span className="text-xs text-tertiary tnum">
          {remaining} left{done > 0 && ` · ${done} done`}
        </span>
      </DetailBar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-6">
          {trap && trap.seen > 0 && (
            <p className="mb-3 text-xs text-tertiary tnum">
              seen {trap.seen} · first try {trap.firstTry}
              {trap.lastMissAt && ` · last miss ${new Date(trap.lastMissAt).toLocaleDateString()}`}
            </p>
          )}

          <div className="text-base text-primary">
            <Markdown content={problem.prompt} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              autoFocus
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (verdict === "right") advance();
                  else void check();
                }
              }}
              placeholder={problem.kind === "numeric" ? "your answer, as a number" : "fill the blank"}
              aria-label="Your answer"
              disabled={verdict === "right"}
              className="h-10 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 text-base text-primary outline-none transition-colors duration-[var(--dur-fast)] placeholder:text-tertiary focus:border-accent disabled:opacity-60"
            />
            {verdict === "right" ? (
              <Button variant="primary" onClick={advance}>
                Next
              </Button>
            ) : (
              <Button variant="primary" onClick={check} disabled={!response.trim()}>
                Check
              </Button>
            )}
          </div>

          {verdict !== "right" && (
            <div className="mt-2 flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setHinted(true)} disabled={hinted}>
                <Lightbulb size={13} />
                Hint
              </Button>
              <Button size="sm" variant="ghost" onClick={giveUp}>
                <Eye size={13} />
                Show me
              </Button>
              <span className="text-xs text-tertiary">
                Show me gives the answer and records this as a miss.
              </span>
            </div>
          )}

          {hinted && verdict !== "right" && problem.hint && (
            <p className="mt-3 border-l-2 border-[var(--live)] py-1 pl-3 text-sm text-secondary anim-fade">
              {problem.hint}
            </p>
          )}

          {verdict === "wrong" && trap && (
            <div className="mt-4 anim-rise">
              {/* The diagnosis is the trap's own sentence: no model call, no
                  latency, and it says the same thing every time you make the
                  same mistake — which is how you start to recognise it. */}
              <p className="border-l-2 border-[var(--stop)] py-1 pl-3 text-sm text-primary">
                {trap.diagnosis}
              </p>
              {problem.stepOne && (
                <p className="mt-3 text-sm text-secondary">
                  <span className="text-tertiary">Start from here: </span>
                  {problem.stepOne}
                </p>
              )}
              <p className="mt-2 text-xs text-tertiary">Try it again — this one still counts as a miss.</p>
            </div>
          )}

          {verdict === "right" && (
            <div className="mt-4 anim-rise">
              <p
                className={cn(
                  "border-l-2 py-1 pl-3 text-sm text-primary",
                  shown ? "border-[var(--stop)]" : missedFirst ? "border-[var(--live)]" : "border-[var(--go)]",
                )}
              >
                {problem.explanation || (shown ? "Answer shown." : "Correct.")}
              </p>
              {shown && problem.answer.accept?.[0] && (
                <p className="mt-2 text-sm text-secondary">
                  <span className="text-tertiary">Answer: </span>
                  {problem.answer.accept[0]}
                </p>
              )}
              {shown && problem.answer.value !== undefined && (
                <p className="mt-2 text-sm text-secondary">
                  <span className="text-tertiary">Answer: </span>
                  {problem.answer.value}
                </p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-tertiary">
                <Check size={12} />
                Enter for the next one
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
