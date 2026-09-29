"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDownToLine, Heart, Timer, Trophy, Zap } from "lucide-react";
import type { Deck } from "@/lib/types";
import { noteGame, studyDays } from "@/lib/db";
import { mark } from "@/lib/grade";
import type { Card, StudyDay } from "@/lib/study";
import {
  BLITZ_MS, GAMES, GRAVITY_LIVES, MATCH_PENALTY_MS,
  blitzPoints, choicesFor, clock, comboOf, fallMs, gameXp, gravityPoints, isMatch, levelOf, matchRound, pairsOf, shuffle, totalXp,
  type GameId, type Pair, type Tile,
} from "@/lib/games";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Games from a deck: Match, Quick-fire and Gravity.
 *
 * The rules and the points are in `lib/games.ts`; this is the table they
 * are played on. A game ends on a result — the score, the best kept for
 * the deck, the points earned and the level they lead to — and the cards
 * it missed, offered as a study session of exactly those.
 */

interface Outcome {
  game: GameId;
  /** Match: milliseconds, lower is better. The rest: points. */
  score: number;
  answered: number;
  right: number;
  missed: string[];
  pairs?: number;
  headline: string;
  detail: string;
}

const NEEDS: Record<GameId, number> = { match: 2, blitz: 2, gravity: 1 };

export function Games({ deck, cards, onDone, onReview }: {
  deck: Deck;
  cards: Card[];
  onDone: () => void;
  /** Study exactly these, in this order — the ones a game missed. */
  onReview?: (cardIds: string[]) => void;
}) {
  const [game, setGame] = React.useState<GameId | null>(null);
  const [round, setRound] = React.useState(0);
  const [result, setResult] = React.useState<(Outcome & { xp: number; before: number; best: boolean }) | null>(null);
  const days = useLiveQuery(() => studyDays(), [], [] as StudyDay[]);
  const pairs = React.useMemo(() => pairsOf(cards), [cards]);

  const end = async (o: Outcome) => {
    /* Ended before a single answer: nothing to score, nothing to keep. */
    if (o.answered === 0) return setGame(null);
    const xp = gameXp(o.game, { score: o.score, pairs: o.pairs, ms: o.score });
    const before = totalXp(days);
    const { best } = await noteGame(deck.id, o.game, { answered: o.answered, right: o.right, xp, best: o.score });
    setResult({ ...o, xp, before, best });
  };
  const again = () => { setResult(null); setRound((n) => n + 1); };

  if (result) {
    return <Result r={result} onAgain={again} onOther={() => { setResult(null); setGame(null); }} onDone={onDone} onReview={onReview} />;
  }
  if (!game) {
    return (
      <section aria-label="Games" className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-4">
        <Level xp={totalXp(days)} />
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {GAMES.map((g) => {
            const kept = deck.best?.[g.id];
            const short = pairs.length < NEEDS[g.id];
            return (
              <li key={g.id}>
                <button
                  onClick={() => { setRound((n) => n + 1); setGame(g.id); }}
                  disabled={short}
                  aria-label={`Play ${g.name}`}
                  className="lift focus-ring flex h-full w-full flex-col items-start rounded-2xl border border-line bg-surface px-4 py-3.5 text-left transition-colors hover:bg-subtle disabled:opacity-50"
                >
                  <span className="flex items-center gap-2 text-base font-semibold text-primary">
                    {g.id === "match" ? <Timer size={16} aria-hidden /> : g.id === "blitz" ? <Zap size={16} aria-hidden /> : <ArrowDownToLine size={16} aria-hidden />}
                    {g.name}
                  </span>
                  <span className="mt-1 text-sm text-secondary">{g.line}</span>
                  <span className="mt-2 text-xs text-tertiary tnum">
                    {short ? `Needs ${NEEDS[g.id]} cards with different answers` : kept === undefined ? "Not played yet" : `Best ${g.id === "match" ? clock(kept) : `${kept} points`}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4">
          <Button size="sm" variant="ghost" onClick={onDone}>Back to the cards</Button>
        </div>
      </section>
    );
  }
  const quit = () => setGame(null);
  return (
    <section aria-label={GAMES.find((g) => g.id === game)!.name} className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-4">
      {game === "match" && <Match key={round} cards={cards} onEnd={(o) => void end(o)} onQuit={quit} />}
      {game === "blitz" && <Blitz key={round} pool={pairs} onEnd={(o) => void end(o)} onQuit={quit} />}
      {game === "gravity" && <Gravity key={round} pool={pairs} onEnd={(o) => void end(o)} onQuit={quit} />}
    </section>
  );
}

/** Level, points, and how far to the next. Used here and on the Study page. */
export function Level({ xp, className }: { xp: number; className?: string }) {
  const l = levelOf(xp);
  return (
    <div className={cn("flex items-center gap-3", className)} aria-label={`Level ${l.level}, ${xp} points`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-sm font-semibold text-white tnum" aria-hidden>{l.level}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-primary tnum">
          Level {l.level} <span className="text-tertiary">· {xp} XP · {l.need - l.into} to level {l.level + 1}</span>
        </p>
        <div role="progressbar" aria-label="Progress to the next level" aria-valuemin={0} aria-valuemax={l.need} aria-valuenow={l.into} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle">
          <div className="h-full rounded-full bg-[var(--blue)] transition-[width] duration-500" style={{ width: `${Math.round((l.into / l.need) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

function Result({ r, onAgain, onOther, onDone, onReview }: {
  r: Outcome & { xp: number; before: number; best: boolean };
  onAgain: () => void;
  onOther: () => void;
  onDone: () => void;
  onReview?: (ids: string[]) => void;
}) {
  const up = levelOf(r.before + r.xp).level > levelOf(r.before).level;
  return (
    <section aria-label="Game result" className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-6">
      <p className="text-3xl font-semibold tracking-[-0.02em] text-primary tnum">{r.headline}</p>
      <p className="mt-1 text-sm text-secondary tnum">{r.detail}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {r.best && r.answered > 0 && (
          <span className="anim-pop inline-flex items-center gap-1.5 rounded-full bg-[var(--blue)] px-3 py-1 font-medium text-white"><Trophy size={14} aria-hidden />New best</span>
        )}
        <span className="inline-flex items-center rounded-full bg-subtle px-3 py-1 text-primary tnum">+{r.xp} XP</span>
        {up && <span className="anim-pop inline-flex items-center rounded-full bg-subtle px-3 py-1 font-medium text-primary tnum">Level {levelOf(r.before + r.xp).level}!</span>}
      </div>
      <Level xp={r.before + r.xp} className="mt-5" />
      {r.missed.length > 0 && (
        <p className="mt-5 text-sm text-secondary">
          {r.missed.length === 1 ? "One card went wrong." : `${r.missed.length} cards went wrong.`} Studying them now fixes them while they are fresh.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={onAgain}>Play again</Button>
        {r.missed.length > 0 && onReview && (
          <Button size="sm" variant="secondary" onClick={() => onReview(r.missed)}>
            Study the {r.missed.length === 1 ? "one" : r.missed.length} I missed
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onOther}>Other games</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Back to the cards</Button>
      </div>
    </section>
  );
}

function Bar({ children, onQuit }: { children: React.ReactNode; onQuit: () => void }) {
  return (
    <div className="mb-3 flex items-center gap-3 text-sm text-secondary tnum">
      {children}
      <span className="flex-1" />
      <Button size="sm" variant="ghost" onClick={onQuit}>Quit</Button>
    </div>
  );
}

/* ----------------------------------------------------------------- match -- */

function Match({ cards, onEnd, onQuit }: { cards: Card[]; onEnd: (o: Outcome) => void; onQuit: () => void }) {
  const [{ pairs, tiles }] = React.useState(() => matchRound(cards));
  const [picked, setPicked] = React.useState<string | null>(null);
  const [gone, setGone] = React.useState<Set<string>>(() => new Set());
  const [wrong, setWrong] = React.useState<string[]>([]);
  const [penalty, setPenalty] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const start = React.useRef<number | null>(null);
  const confused = React.useRef(new Set<string>());
  const over = React.useRef(false);

  React.useEffect(() => {
    const t = window.setInterval(() => { if (start.current !== null && !over.current) setElapsed(performance.now() - start.current); }, 100);
    return () => window.clearInterval(t);
  }, []);

  const tap = (tile: Tile) => {
    if (gone.has(tile.key) || wrong.length || over.current) return;
    if (start.current === null) start.current = performance.now();
    if (!picked) return setPicked(tile.key);
    if (picked === tile.key) return setPicked(null);
    const first = tiles.find((t) => t.key === picked)!;
    if (isMatch(first, tile)) {
      const next = new Set(gone).add(first.key).add(tile.key);
      setGone(next);
      setPicked(null);
      if (next.size === tiles.length) {
        over.current = true;
        const ms = Math.round(performance.now() - start.current + penalty);
        const missed = [...confused.current];
        onEnd({
          game: "match", score: ms, pairs: pairs.length, answered: pairs.length, right: pairs.length - missed.length, missed,
          headline: clock(ms),
          detail: `${pairs.length} pairs${penalty ? ` · ${penalty / 1000} s added for wrong pairs` : " · no wrong pairs"}`,
        });
      }
      return;
    }
    confused.current.add(first.pairId).add(tile.pairId);
    setPenalty((p) => p + MATCH_PENALTY_MS);
    setWrong([first.key, tile.key]);
    window.setTimeout(() => { setWrong([]); setPicked(null); }, 450);
  };

  return (
    <>
      <Bar onQuit={onQuit}>
        <span aria-label="Time" className="text-lg font-semibold text-primary">{clock(elapsed + penalty)}</span>
        {penalty > 0 && <span className="text-[var(--danger)]">+{penalty / 1000}s</span>}
        <span>{(tiles.length - gone.size) / 2} pairs left</span>
      </Bar>
      {start.current === null && <p className="mb-3 text-sm text-tertiary">Tap a term, then its answer. The clock starts on your first tap.</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="group" aria-label="Tiles">
        {tiles.map((t) => {
          const out = gone.has(t.key);
          return (
            <button
              key={t.key}
              onClick={() => tap(t)}
              disabled={out}
              aria-hidden={out || undefined}
              aria-pressed={picked === t.key}
              className={cn(
                "focus-ring flex min-h-[5.5rem] items-center justify-center rounded-xl border px-3 py-2 text-center text-sm leading-snug text-primary",
                "transition-[opacity,transform,background-color,border-color] duration-200",
                out ? "pointer-events-none scale-90 opacity-0" : "bg-surface hover:bg-subtle",
                picked === t.key ? "border-[var(--blue)] bg-subtle ring-2 ring-[var(--blue)]" : "border-line",
                wrong.includes(t.key) && "game-shake border-[var(--danger)] ring-2 ring-[var(--danger)]",
              )}
            >
              {t.text}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* --------------------------------------------------------------- shared -- */

/** The newest value of a prop, for a timer that should not restart each time the parent renders. */
function useLatest<T>(v: T) {
  const r = React.useRef(v);
  React.useEffect(() => { r.current = v; });
  return r;
}

/** The deck in a shuffled line, dealt round again when it runs out, never the same card twice in a row. */
function useDealer(pool: Pair[]) {
  const queue = React.useRef<Pair[]>([]);
  const last = React.useRef<string | null>(null);
  return React.useCallback(() => {
    if (!queue.current.length) {
      queue.current = shuffle(pool);
      if (queue.current.length > 1 && queue.current[0].id === last.current) queue.current.push(queue.current.shift()!);
    }
    const p = queue.current.shift()!;
    last.current = p.id;
    return p;
  }, [pool]);
}

/* ---------------------------------------------------------------- blitz -- */

function Blitz({ pool, onEnd: ended, onQuit }: { pool: Pair[]; onEnd: (o: Outcome) => void; onQuit: () => void }) {
  const onEnd = useLatest(ended);
  const deal = useDealer(pool);
  const [cur, setCur] = React.useState(() => { const p = deal(); return { pair: p, choices: choicesFor(p, pool) }; });
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [left, setLeft] = React.useState(BLITZ_MS);
  const s = React.useRef({ score: 0, run: 0, bestRun: 0, answered: 0, right: 0, missed: new Set<string>(), over: false, start: performance.now() });
  const [, bump] = React.useReducer((n: number) => n + 1, 0);

  const finish = React.useCallback(() => {
    const x = s.current;
    if (x.over) return;
    x.over = true;
    onEnd.current({
      game: "blitz", score: x.score, answered: x.answered, right: x.right, missed: [...x.missed],
      headline: `${x.score} points`,
      detail: `${x.right} of ${x.answered} right · longest run ${x.bestRun}`,
    });
  }, [onEnd]);

  React.useEffect(() => {
    const t = window.setInterval(() => {
      const l = BLITZ_MS - (performance.now() - s.current.start);
      setLeft(Math.max(0, l));
      if (l <= 0) finish();
    }, 200);
    return () => window.clearInterval(t);
  }, [finish]);

  const choose = React.useCallback((c: string) => {
    const x = s.current;
    if (chosen !== null || x.over) return;
    const right = c === cur.pair.a;
    x.answered++;
    if (right) {
      x.score += blitzPoints(x.run);
      x.run++;
      x.right++;
      x.bestRun = Math.max(x.bestRun, x.run);
    } else {
      x.run = 0;
      x.missed.add(cur.pair.id);
    }
    setChosen(c);
    bump();
    window.setTimeout(() => {
      if (s.current.over) return;
      const p = deal();
      setCur({ pair: p, choices: choicesFor(p, pool) });
      setChosen(null);
    }, right ? 280 : 1_000);
  }, [chosen, cur, deal, pool]);

  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= cur.choices.length) choose(cur.choices[n - 1]);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [choose, cur]);

  const x = s.current;
  return (
    <>
      <Bar onQuit={onQuit}>
        <span aria-label="Time left" className={cn("text-lg font-semibold", left < 10_000 ? "text-[var(--danger)]" : "text-primary")}>{Math.ceil(left / 1000)}s</span>
        <span aria-label="Score">{x.score} points</span>
        {x.run >= 3 && <span className="anim-pop rounded-full bg-[var(--blue)] px-2 py-0.5 text-xs font-semibold text-white">×{comboOf(x.run)}</span>}
      </Bar>
      <div className="h-1 overflow-hidden rounded-full bg-subtle" aria-hidden>
        <div className="h-full bg-[var(--blue)] transition-[width] duration-200 ease-linear" style={{ width: `${(left / BLITZ_MS) * 100}%` }} />
      </div>
      <p className="mt-5 min-h-[3.5rem] text-xl leading-snug text-primary" aria-live="polite">{cur.pair.q}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label="Answers">
        {cur.choices.map((c, i) => {
          const isRight = c === cur.pair.a;
          return (
            <button
              key={c}
              onClick={() => choose(c)}
              className={cn(
                "focus-ring flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm text-primary transition-colors",
                chosen === null && "border-line bg-surface hover:bg-subtle",
                chosen !== null && isRight && "border-[var(--success)] bg-[color-mix(in_oklab,var(--success)_14%,transparent)]",
                chosen !== null && !isRight && chosen === c && "game-shake border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]",
                chosen !== null && !isRight && chosen !== c && "border-line opacity-50",
              )}
            >
              <span className="hidden size-6 shrink-0 items-center justify-center rounded-md bg-subtle text-xs text-tertiary sm:flex" aria-hidden>{i + 1}</span>
              {c}
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <Button size="sm" variant="ghost" onClick={finish}>End the round</Button>
      </div>
    </>
  );
}

/* -------------------------------------------------------------- gravity -- */

function Gravity({ pool, onEnd: ended, onQuit }: { pool: Pair[]; onEnd: (o: Outcome) => void; onQuit: () => void }) {
  const onEnd = useLatest(ended);
  const deal = useDealer(pool);
  const [cur, setCur] = React.useState<Pair>(() => deal());
  const [phase, setPhase] = React.useState<"falling" | "missed">("falling");
  const [drop, setDrop] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const [shake, setShake] = React.useState(0);
  const [left, setLeft] = React.useState(0);
  const s = React.useRef({ lives: GRAVITY_LIVES, cleared: 0, score: 0, answered: 0, right: 0, missed: new Set<string>(), over: false });
  const input = React.useRef<HTMLInputElement>(null);
  const x = s.current;
  const ms = fallMs(x.cleared);

  const finish = React.useCallback(() => {
    const g = s.current;
    if (g.over) return;
    g.over = true;
    onEnd.current({
      game: "gravity", score: g.score, answered: g.answered, right: g.right, missed: [...g.missed],
      headline: `${g.score} points`,
      detail: `${g.cleared} cleared · ${g.missed.size} missed`,
    });
  }, [onEnd]);

  const next = () => {
    setCur(deal());
    setTyped("");
    setPhase("falling");
    setDrop((n) => n + 1);
    input.current?.focus();
  };

  React.useEffect(() => {
    if (phase !== "falling") return;
    const began = performance.now();
    const fall = fallMs(s.current.cleared);
    setLeft(fall);
    const tick = window.setInterval(() => setLeft(Math.max(0, fall - (performance.now() - began))), 250);
    const land = window.setTimeout(() => {
      const g = s.current;
      if (g.over) return;
      g.lives--;
      g.answered++;
      g.missed.add(cur.id);
      setTyped("");
      setPhase("missed");
    }, fall);
    return () => { window.clearInterval(tick); window.clearTimeout(land); };
  }, [drop, phase, cur]);

  const submit = () => {
    if (x.over) return;
    const ok = mark(typed, cur.a).mark !== "wrong";
    if (!ok) { setShake((n) => n + 1); setTyped(""); return; }
    if (phase === "falling") {
      x.score += gravityPoints(x.cleared);
      x.cleared++;
      x.answered++;
      x.right++;
      return next();
    }
    if (x.lives <= 0) return finish();
    next();
  };

  return (
    <>
      <Bar onQuit={onQuit}>
        <span aria-label={`${x.lives} lives left`} className="flex items-center gap-1">
          {Array.from({ length: GRAVITY_LIVES }, (_, i) => (
            <Heart key={i} size={16} aria-hidden className={i < x.lives ? "fill-[var(--danger)] text-[var(--danger)]" : "text-faint"} />
          ))}
        </span>
        <span aria-label="Score">{x.score} points</span>
        {phase === "falling" && <span aria-label="Seconds before it lands">{Math.ceil(left / 1000)}s</span>}
      </Bar>
      <div className="relative h-[42vh] min-h-64 overflow-hidden rounded-2xl border border-line bg-subtle">
        <div
          key={drop}
          className={cn(
            "absolute inset-x-4 mx-auto w-fit max-w-[88%] rounded-xl border bg-surface px-4 py-3 text-center text-base leading-snug text-primary shadow-sm",
            phase === "falling" ? "gravity-fall border-line" : "bottom-3 border-[var(--danger)]",
          )}
          style={phase === "falling" ? { animationDuration: `${ms}ms` } : undefined}
          aria-live="polite"
        >
          {cur.q}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--danger)] opacity-40" aria-hidden />
      </div>
      {phase === "missed" && (
        <p className="mt-3 text-sm text-secondary" role="status">
          It landed. The answer is <span className="font-semibold text-primary">{cur.a}</span> — type it to go on.
        </p>
      )}
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input
          ref={input}
          key={shake}
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          aria-label="Your answer"
          placeholder=""
          autoComplete="off"
          className={cn("field min-w-0 flex-1 rounded-xl border border-line bg-field px-3.5 py-2.5 text-base text-primary outline-none focus:border-[var(--accent)]", shake > 0 && "game-shake")}
        />
        <Button type="submit" variant="primary">Enter</Button>
      </form>
      <div className="mt-3 flex gap-2">
        {phase === "missed" && <Button size="sm" variant="ghost" onClick={() => (x.lives <= 0 ? finish() : next())}>Skip</Button>}
        <Button size="sm" variant="ghost" onClick={finish}>End the game</Button>
      </div>
    </>
  );
}
