"use client";

import * as React from "react";
import { CodeBlock } from "./CodeBlock";

/**
 * A diagram, drawn.
 *
 * Every model in the picker writes fluent Mermaid without being asked for it —
 * it is the one diagram-as-code syntax they all know — and until now this app
 * threw it on the floor. Worse than "no diagram": the fence fell through to a
 * language nothing recognised, so it lost its label too and a reader got a
 * wall of `A[Start] --> B{Check}` in monospace.
 *
 * ## Why the model draws topology and never geometry
 *
 * This is the whole reason the channel is Mermaid rather than SVG. Ask a model
 * for coordinates and it produces overlapping labels, arrows that miss their
 * boxes and text outside its container — spatial arithmetic is measurably the
 * weakest thing these models do. Ask for *relations* — this node, that node,
 * an edge between them — and it is near-perfect, because that is language.
 * So the model says what connects to what and a layout engine owns where
 * everything sits. Neither is asked to do the other's job.
 *
 * ## Three things it refuses to do
 *
 * It will not render mid-stream: half a graph is a syntax error, and a diagram
 * that redraws itself eight times while an answer arrives is worse than one
 * that appears once. It will not show a parse error: a red box in the middle
 * of an answer is the app blaming the model in front of the reader, so a fence
 * that does not parse stays a code block and says nothing about it. And it
 * will not leave a screen reader with nothing — an SVG of boxes is unreadable,
 * so the source sits underneath it in a `<details>`, which is also what a
 * sighted reader wants when the picture is not quite right.
 */

/** Mermaid inlines literal colours into the SVG; it cannot read a `var()`. */
function themeVars(): Record<string, string> {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  const line = v("--border-strong") || v("--border-subtle");
  return {
    background: "transparent",
    primaryColor: v("--bg-subtle"),
    primaryTextColor: v("--text-primary"),
    primaryBorderColor: line,
    secondaryColor: v("--bg-inset"),
    tertiaryColor: v("--bg-surface"),
    lineColor: line,
    textColor: v("--text-secondary"),
    mainBkg: v("--bg-subtle"),
    nodeBorder: line,
    clusterBkg: v("--bg-inset"),
    clusterBorder: v("--border-subtle"),
    titleColor: v("--text-primary"),
    edgeLabelBackground: v("--bg-canvas"),
    fontSize: "14px",
  };
}

/** A title for the picture, from a `%% title: …` line or the first node's label. */
function titleOf(src: string): string {
  const explicit = src.match(/^\s*%%\s*title:\s*(.+)$/im);
  if (explicit) return explicit[1].trim();
  const kind = src.trim().split(/\s+/)[0]?.replace(/[^a-z]/gi, "") || "diagram";
  return `${kind} diagram`;
}

export function Diagram({ src, streaming }: { src: string; streaming?: boolean }) {
  const [svg, setSvg] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const id = React.useId().replace(/:/g, "");
  const [theme, setTheme] = React.useState<string>("");

  /* Redraw when the app's theme changes. `prefers-color-scheme` is the wrong
     signal — this app resolves "system" itself and writes the answer to
     `data-theme`, so that attribute is the one that is always true. */
  React.useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme ?? "");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  React.useEffect(() => {
    if (streaming || failed) return;
    let alive = true;
    /* Let the stream settle first. A fence is a syntax error for most of its
       own arrival, and parsing it on every frame is a parse error per frame. */
    const t = window.setTimeout(async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          // Untrusted input: this is a model's output rendered into the page.
          securityLevel: "strict",
          theme: "base",
          themeVariables: themeVars(),
          fontFamily: "var(--font-sans)",
          flowchart: { curve: "basis", padding: 12 },
        });
        // Parse before render, so a bad fence never becomes a red box on screen.
        await mermaid.parse(src);
        const out = await mermaid.render(`m${id}`, src);
        if (alive) setSvg(out.svg);
      } catch {
        if (alive) setFailed(true);
      }
    }, 80);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [src, streaming, failed, id, theme]);

  // Still arriving, or it never parsed: it is a code block and says so quietly.
  if (streaming || failed || !svg) {
    return <CodeBlock code={src} lang="mermaid" streaming={streaming} />;
  }

  return (
    <figure className="diagram my-4" role="group" aria-label={titleOf(src)}>
      <div
        className="overflow-x-auto rounded-lg border border-line bg-inset px-3 py-4"
        // The SVG is mermaid's own output, parsed by mermaid in strict mode,
        // which strips script and event handlers before it ever reaches here.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {/* A picture of boxes is nothing to a screen reader, and the source is
          also what a sighted reader wants the moment the drawing is not quite
          what they meant. */}
      <details className="mt-1.5">
        <summary className="cursor-pointer text-meta text-tertiary hover:text-secondary">
          Diagram source
        </summary>
        <div className="mt-1.5">
          <CodeBlock code={src} lang="mermaid" />
        </div>
      </details>
    </figure>
  );
}
