"use client";

import * as React from "react";
import { Check, Square } from "lucide-react";
import type { Message } from "@/lib/types";
import { getModel, formatTokens } from "@/lib/models";
import { useStream } from "@/lib/hooks/useStream";
import { useSettings } from "@/lib/store";
import { cn, formatDuration, formatElapsed } from "@/lib/utils";
import { Markdown, useThrottled } from "./Markdown";
import { ProviderMark } from "@/components/ui/ProviderMark";
import { Button, IconButton } from "@/components/ui/primitives";
import { InlineError } from "./Message";

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
  onKeep,
  onCancel,
}: {
  conversationId: string;
  parentId: string | null;
  history: Message[];
  modelIds: string[];
  onKeep: (messageId: string, modelId: string) => void;
  onCancel: () => void;
}) {
  return (
    <section className="py-3" aria-label="Model comparison">
      <div className="mb-2 flex items-center gap-2 text-xs text-tertiary">
        <span>Comparing {modelIds.length} models — keep the one you want.</span>
        <button onClick={onCancel} className="ml-auto rounded-sm px-1 hover:bg-subtle hover:text-primary">
          Cancel
        </button>
      </div>

      <div
        className={cn(
          "grid gap-2",
          modelIds.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3",
        )}
      >
        {modelIds.map((id) => (
          <CompareColumn
            key={id}
            conversationId={conversationId}
            parentId={parentId}
            history={history}
            modelId={id}
            onKeep={onKeep}
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
  onKeep,
}: {
  conversationId: string;
  parentId: string | null;
  history: Message[];
  modelId: string;
  onKeep: (messageId: string, modelId: string) => void;
}) {
  const model = getModel(modelId);
  const settings = useSettings();
  const [finished, setFinished] = React.useState<Message | null>(null);
  const stream = useStream(setFinished);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    void stream.send({
      conversationId,
      parentId,
      modelId,
      history,
      systemPrompt: settings.systemPrompt || undefined,
    });
    // Fired once, deliberately: a column is a single request, not a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = useThrottled(stream.text, 33);
  const text = finished
    ? finished.content.map((b) => (b.type === "text" ? b.text : "")).join("")
    : live;
  const busy = stream.phase !== "idle";

  return (
    <article className="flex min-h-[12rem] flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <header className="flex h-9 shrink-0 items-center gap-1.5 border-b border-line px-2.5 text-xs">
        <span className="text-tertiary">
          <ProviderMark provider={model.provider} size={12} />
        </span>
        <span className="truncate font-medium text-secondary">{model.name}</span>
        <span className="ml-auto flex items-center gap-1.5 text-tertiary tnum">
          {busy && stream.elapsed > 1000 && <span>{formatElapsed(stream.elapsed)}</span>}
          {finished?.latencyMs != null && <span>{formatDuration(finished.latencyMs)}</span>}
          {finished?.usage && <span>{formatTokens(finished.usage.outputTokens)} tok</span>}
          {busy && (
            <IconButton label="Stop" size={22} onClick={stream.stop}>
              <Square size={9} fill="currentColor" />
            </IconButton>
          )}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
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
          >
            <Check size={13} />
            Keep this one
          </Button>
        </footer>
      )}
    </article>
  );
}
