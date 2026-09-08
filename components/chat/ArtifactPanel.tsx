"use client";

import * as React from "react";
import { Check, Copy, Download, WrapText, X } from "lucide-react";
import { CodeBlock } from "./CodeBlock";
import { Markdown } from "./Markdown";
import { IconButton } from "@/components/ui/primitives";

export interface Artifact {
  kind: "code" | "document";
  title: string;
  lang?: string;
  content: string;
}

interface ArtifactContextValue {
  open: (artifact: Artifact) => void;
  current: Artifact | null;
}

const ArtifactContext = React.createContext<ArtifactContextValue | null>(null);

export function useArtifact() {
  return React.useContext(ArtifactContext);
}

export function ArtifactProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ArtifactContextValue;
}) {
  return <ArtifactContext.Provider value={value}>{children}</ArtifactContext.Provider>;
}

/**
 * The worst part of every chat interface is a nine-hundred-line answer burying
 * the conversation that produced it. This lifts one out into its own column:
 * the thread keeps its shape and stays scrollable, and the thing you actually
 * came for gets the room it needs.
 *
 * Above `lg` the panel is a sibling column and the message column narrows to
 * make space; below it, there is no space to make, so it covers instead.
 */
export function ArtifactPanel({
  artifact,
  onClose,
}: {
  artifact: Artifact;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [wrap, setWrap] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const blob = new Blob([artifact.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.title.replace(/[^\w.-]+/g, "-").toLowerCase() || "artifact.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-30 bg-[var(--bg-overlay)] anim-fade lg:hidden"
      />
      <aside
        aria-label={artifact.title}
        className="fixed inset-y-0 right-0 z-40 flex w-[min(38rem,100vw)] flex-col border-l border-line bg-surface anim-fade lg:relative lg:z-auto lg:w-[var(--panel-w)] lg:shrink-0"
        style={{ animationDuration: "var(--dur-layout)" }}
      >
        <header className="flex h-[var(--topbar-h)] shrink-0 items-center gap-1 border-b border-line px-3">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
            {artifact.title}
          </span>
          {artifact.lang && <span className="shrink-0 text-xs text-tertiary">{artifact.lang}</span>}
          {artifact.kind === "code" && (
            <IconButton
              label={wrap ? "No wrap" : "Wrap lines"}
              size={28}
              active={wrap}
              onClick={() => setWrap((w) => !w)}
            >
              <WrapText size={14} />
            </IconButton>
          )}
          <IconButton label={copied ? "Copied" : "Copy"} size={28} onClick={copy}>
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </IconButton>
          <IconButton label="Download" size={28} onClick={download}>
            <Download size={14} />
          </IconButton>
          <IconButton label="Close" keys={["Esc"]} size={28} onClick={onClose}>
            <X size={15} />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {artifact.kind === "code" ? (
            <CodeBlock code={artifact.content} lang={artifact.lang} filename={artifact.title} bare wrap={wrap} />
          ) : (
            <Markdown content={artifact.content} />
          )}
        </div>
      </aside>
    </>
  );
}
