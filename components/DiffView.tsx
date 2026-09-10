"use client";

import * as React from "react";
import { Check, ScanSearch, X } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { collapse, diffStat, lineDiff, type DiffOp } from "@/lib/diff";
import { cn } from "@/lib/utils";

/* Exported: the notebook shows a revision the same way, because it is the
   same promise — nothing a model wrote lands in your file until you have seen
   what it touched. */
export function DiffView({
  before,
  after,
  note,
  wide,
  onAccept,
  onReject,
  onCheck,
  checking,
}: {
  before: string;
  after: string;
  note: string;
  wide?: boolean;
  onAccept: () => void;
  onReject: () => void;
  /** Absent in the notebook, which shows a diff but has nothing to check against. */
  onCheck?: () => void;
  checking?: boolean;
}) {
  const ops = React.useMemo(() => lineDiff(before, after), [before, after]);
  const stat = React.useMemo(() => diffStat(ops), [ops]);
  const rows = React.useMemo(() => collapse(ops), [ops]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="glass sticky top-0 z-10 border-b border-line">
        <div
          className={cn(
            "mx-auto flex w-full flex-wrap items-center gap-3 px-4 py-2.5",
            wide ? "max-w-[var(--measure-wide)]" : "max-w-[var(--measure)]",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-sm text-secondary">{note}</span>
          <span className="tnum shrink-0 text-xs">
            <span className="text-success">+{stat.added}</span>{" "}
            <span className="text-danger">−{stat.removed}</span>
          </span>
          {/* Between reading the diff and keeping it, because that is the
              moment the question arises. Reviewing is a different task from
              writing: the model that produced this will, asked to check it,
              notice the call site it did not update. */}
          {onCheck && (
            <Button size="sm" variant="ghost" onClick={onCheck} disabled={checking}>
              <ScanSearch size={13} />
              {checking ? "Checking…" : "Check it"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onReject}>
            <X size={13} />
            Discard
          </Button>
          <Button size="sm" variant="primary" className="bloom" onClick={onAccept}>
            <Check size={13} />
            Keep
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <div
          className={cn(
            "mx-auto w-full overflow-x-auto rounded-lg border border-line bg-inset",
            wide ? "max-w-[var(--measure-wide)]" : "max-w-[var(--measure)]",
          )}
        >
          <pre className="min-w-max font-mono text-[12.5px] leading-[1.65]">
            {rows.map((row, i) =>
              row.type === "gap" ? (
                <div
                  key={i}
                  className="select-none bg-subtle px-3 py-0.5 text-center text-[11px] text-faint"
                >
                  {row.count} unchanged {row.count === 1 ? "line" : "lines"}
                </div>
              ) : (
                <div
                  key={i}
                  className={cn(
                    "px-3",
                    row.type === "add" && "bg-[color-mix(in_srgb,var(--go)_16%,transparent)] text-primary",
                    row.type === "remove" && "bg-[color-mix(in_srgb,var(--stop)_14%,transparent)] text-secondary",
                    row.type === "same" && "text-tertiary",
                  )}
                >
                  <span className="mr-2 inline-block w-3 select-none text-faint">
                    {row.type === "add" ? "+" : row.type === "remove" ? "−" : " "}
                  </span>
                  {(row as DiffOp).text || " "}
                </div>
              ),
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
