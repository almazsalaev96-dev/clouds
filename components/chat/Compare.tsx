"use client";

import * as React from "react";
import { Check, Columns2, Square } from "lucide-react";
import type { Message } from "@/lib/types";
import { formatTokens } from "@/lib/models";
import { shortName } from "@/lib/presets";
import { useStream } from "@/lib/hooks/useStream";
import { db, filesOf } from "@/lib/db";
import { composeSystemPrompt } from "@/lib/prompt";
import { rulesText } from "@/lib/rules";
import { findStyle } from "@/lib/styles";
import { useSettings } from "@/lib/store";
import { cn, describeTiming, formatDuration, formatElapsed } from "@/lib/utils";
import { Markdown, useThrottled } from "./Markdown";
import { Button, IconButton } from "@/components/ui/primitives";
import { InlineError } from "./Message";
import { cheapestAvailable, complete } from "@/lib/complete";
import { getConfigured } from "@/lib/configured";

/**
 * Two or three models answering the same prompt, side by side, each streaming
 * on its own clock.
 *
 * The tree makes this almost free: every column writes its answer against the
 * same parent, so the three replies are already siblings. "Keep" is not a
 * merge or a discard — it just points the conversation at one of them, and the
 * others stay reachable under `‹ 2/3 ›` forever.
 */
export function CompareGrid({
  conversationId,
  parentId,
  history,
  modelIds,
  /**
   * What to call each column.
   *
   * A duel is one Armi model answering twice, from two companies — so the
   * columns are "the first answer" and "the second", not two vendors. A
   * comparison somebody set up themselves is the opposite: they picked those
   * engines on purpose and the names are the whole point.
   */
  labels,
  turnPrompt,
  onKeep,
  onCancel,
}: {
  conversationId: string;
  parentId: string | null;
  history: Message[];
  modelIds: string[];
  labels?: string[];
  /**
   * One extra instruction, given to every column alike.
   *
   * An Armi model that buys a brief before it answers has to hand that brief
   * to both sides: a comparison where one model was told what the answer has
   * to cover and the other was not is not a comparison, it is a head start.
   */
  turnPrompt?: string;
  onKeep: (messageId: string, modelId: string) => void;
  onCancel: () => void;
}) {
  /* Disagreement as the signal. Two answers that agree are cheap evidence
     that both are right; two that differ name the one place worth looking.
     So when every column has finished, the cheapest model reads them side by
     side and says where they stand — and what they differ on, if they do —
     so the choice is made about that rather than about which reads better. */
  const [done, setDone] = React.useState<Record<string, Message>>({});
  const [stand, setStand] = React.useState<{ agree: "yes" | "partly" | "no"; on: string } | null>(null);
  const judged = React.useRef(false);
  const onFinished = React.useCallback((id: string, m: Message) => setDone((d) => ({ ...d, [id]: m })), []);
  React.useEffect(() => {
    const all = modelIds.map((id) => done[id]).filter(Boolean);
    if (judged.current || all.length < modelIds.length || all.some((m) => m.error)) return;
    judged.current = true;
    const asked = [...history].reverse().find((m) => m.role === "user");
    const q = asked ? asked.content.map((b) => (b.type === "text" ? b.text : "")).join("") : "";
    const answers = all.map((m, i) => `--- Answer ${i + 1} ---\n${m.content.map((b) => (b.type === "text" ? b.text : "")).join("").slice(0, 6_000)}`).join("\n\n");
    void complete(
      `Two answers to the same question, from different models. Do they agree on the substance?\n\nReturn JSON only: {"agree":"yes"|"partly"|"no","on":"one sentence — what they differ on, quoting the point of difference, or what both say if they agree"}\n\n--- The question ---\n${q}\n\n${answers}`,
      { modelId: cheapestAvailable(getConfigured()) ?? undefined, maxTokens: 200, temperature: 0.1 },
    )
      .then((out) => {
        const s = out?.indexOf("{") ?? -1, e = out?.lastIndexOf("}") ?? -1;
        if (!out || s < 0 || e <= s) return;
        const j = JSON.parse(out.slice(s, e + 1)) as { agree?: string; on?: string };
        const agree = j.agree === "yes" || j.agree === "no" ? j.agree : "partly";
        if (j.on) setStand({ agree, on: String(j.on) });
      })
      .catch(() => {});
  }, [done, modelIds, history]);

  return (
    <section className="py-3" aria-label="Model comparison">
      <div className="mb-2 flex items-center gap-2 text-xs text-tertiary">
        <span>Comparing {modelIds.length} models — keep the one you want.</span>
        <button onClick={onCancel} className="ml-auto rounded-sm px-1 hover:bg-subtle hover:text-primary">
          Cancel
        </button>
      </div>
      {stand && (
        <p
          aria-label="Where they stand"
          className={cn("mb-2 rounded-lg border px-3 py-2 text-xs", stand.agree === "no" ? "border-[var(--warning)] text-secondary" : "border-line text-tertiary")}
        >
          <span className="text-secondary">{stand.agree === "yes" ? "They agree on the substance" : stand.agree === "no" ? "They disagree" : "They mostly agree"}</span>
          {" — "}{stand.on}
        </p>
      )}

      <div
        className={cn(
          "grid gap-2",
          modelIds.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3",
        )}
      >
        {modelIds.map((id, i) => (
          <CompareColumn
            key={id}
            label={labels?.[i]}
            conversationId={conversationId}
            parentId={parentId}
            history={history}
            modelId={id}
            turnPrompt={turnPrompt}
            onKeep={onKeep}
            onFinished={onFinished}
          />
        ))}
      </div>
    </section>
  );
}

function CompareColumn({
  conversationId,
  parentId,
  history,
  modelId,
  label,
  turnPrompt,
  onKeep,
  onFinished,
}: {
  conversationId: string;
  parentId: string | null;
  history: Message[];
  modelId: string;
  label?: string;
  turnPrompt?: string;
  onKeep: (messageId: string, modelId: string) => void;
  onFinished?: (modelId: string, m: Message) => void;
}) {
  /* Named for what the person picked, not for the engine the column runs on.
     `getModel` answers with the app default for an id it does not know, so
     reading the name off the engine put one company's model over every
     column — including the one that never came from it. */
  const name = label ?? shortName(modelId);
  const settings = useSettings();
  const [finished, setFinished] = React.useState<Message | null>(null);
  const stream = useStream(setFinished);
  React.useEffect(() => { if (finished) onFinished?.(modelId, finished); }, [finished, modelId, onFinished]);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    // The same layers a single-model turn gets. A comparison where one column
    // was told about the project and the others were not is not a comparison.
    void (async () => {
      const conv = await db.conversations.get(conversationId);
      const project = conv?.projectId ? await db.projects.get(conv.projectId) : undefined;
      const files = project ? await filesOf(project.id) : [];
      const custom = await db.styles.toArray();
      const composed = composeSystemPrompt({
        base: [rulesText(settings.rules ?? [], settings.systemPrompt), conv?.systemPrompt ?? ""].filter(Boolean).join("\n\n"),
        project,
        files,
        style: findStyle(conv?.styleId ?? settings.styleId, custom),
      });
      await stream.send({
        conversationId,
        parentId,
        modelId,
        history,
        systemPrompt: composed.text || undefined,
        turnPrompt,
        advanceLeaf: false,
      });
    })();
    // Fired once, deliberately: a column is a single request, not a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = useThrottled(stream.text, 33);
  const text = finished
    ? finished.content.map((b) => (b.type === "text" ? b.text : "")).join("")
    : live;
  const busy = stream.phase !== "idle";

  return (
    /* Named, because there are three of these side by side and every control
       in them used to be called the same thing. "Stop, button. Stop, button.
       Stop, button." is a comparison nobody can operate without looking at it,
       which is the one thing a comparison is for. */
    <article
      aria-label={`${name}, ${label ? "one of two answers" : "answer"}`}
      className="flex min-h-[12rem] flex-col overflow-hidden rounded-lg border border-line bg-surface"
    >
      <header className="relative flex h-9 shrink-0 items-center gap-1.5 border-b border-line px-2.5 text-xs">
        {busy && <span className="field-line absolute inset-x-0 bottom-0" aria-hidden />}
        <span className="text-tertiary">
          {busy ? <span className="think-orb" aria-hidden /> : <Columns2 size={12} aria-hidden />}
        </span>
        <span className="truncate font-medium text-secondary">{name}</span>
        <span className="ml-auto flex items-center gap-1.5 text-tertiary tnum">
          {busy && stream.elapsed > 1000 && <span>{formatElapsed(stream.elapsed)}</span>}
          {finished?.latencyMs != null && (
            <span title={describeTiming(finished.latencyMs, finished.ttftMs)}>{formatDuration(finished.latencyMs)}</span>
          )}
          {finished?.usage && <span>{formatTokens(finished.usage.outputTokens)} tok</span>}
          {busy && (
            <IconButton label={`Stop ${name}`} size={22} onClick={stream.stop}>
              <Square size={9} fill="currentColor" />
            </IconButton>
          )}
        </span>
      </header>

      {/* Three answers side by side leave about 370px each, which at body size
          is 41 characters to a line — well under the sixty that makes prose
          readable, and the column cannot get wider because there are two more
          beside it. So the text gets smaller instead: 14px brings it to 47,
          with tighter leading, which is the right setting for something you are
          scanning across rather than reading down. */}
      <div data-read="dense" className="min-h-0 flex-1 overflow-y-auto p-3">
        {text ? (
          <>
            <Markdown content={text} streaming={busy} />
            {busy && <span className="caret" aria-hidden />}
          </>
        ) : stream.error ? (
          <InlineError error={stream.error} />
        ) : (
          <div className="flex h-5 items-center">
            <span className="caret" aria-hidden />
          </div>
        )}
      </div>

      {finished && !finished.error && (
        <footer className="shrink-0 border-t border-line p-2">
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={() => onKeep(finished.id, modelId)}
            aria-label={`Keep ${name}'s answer`}
          >
            <Check size={13} />
            Keep this one
          </Button>
        </footer>
      )}
    </article>
  );
}
