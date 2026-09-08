"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ExternalLink } from "lucide-react";
import { CodeBlock } from "./CodeBlock";

/**
 * Model output is untrusted input. react-markdown does not evaluate raw HTML
 * unless rehype-raw is added, and it is deliberately absent: there is no path
 * in this app from a model's tokens to executed markup.
 */
const REMARK = [remarkGfm, remarkMath];
const REHYPE = [[rehypeKatex, { throwOnError: false, strict: false }]] as never;

function makeComponents(streaming: boolean): Components {
  return {
    code({ className, children, ...props }) {
      const text = String(children ?? "");
      const match = /language-([\w+-]+)/.exec(className ?? "");
      // Inline code arrives without a language class and without newlines.
      const isBlock = Boolean(match) || text.includes("\n");
      if (!isBlock) {
        return <code {...props}>{text}</code>;
      }
      const meta = (props as { node?: { data?: { meta?: string } } }).node?.data?.meta ?? "";
      const filename = meta.match(/(?:title|file)="([^"]+)"/)?.[1];
      return (
        <CodeBlock
          code={text.replace(/\n$/, "")}
          lang={match?.[1]}
          filename={filename}
          streaming={streaming}
        />
      );
    },
    // CodeBlock brings its own <figure>, so the default <pre> wrapper is dropped.
    pre: ({ children }) => <>{children}</>,
    table: ({ children }) => (
      <div className="table-scroll">
        <table>{children}</table>
      </div>
    ),
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <ExternalLink size={11} className="ml-0.5 inline-block align-baseline opacity-50" />
      </a>
    ),
    li: ({ children, className, ...props }) => {
      const isTask = className?.includes("task-list-item");
      return (
        <li className={isTask ? "task-item" : undefined} {...props}>
          {children}
        </li>
      );
    },
    input: ({ type, checked }) =>
      type === "checkbox" ? <input type="checkbox" checked={checked} readOnly /> : null,
  };
}

const STATIC_COMPONENTS = makeComponents(false);
const STREAMING_COMPONENTS = makeComponents(true);

export default function MarkdownRenderer({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={REMARK}
        rehypePlugins={REHYPE}
        components={streaming ? STREAMING_COMPONENTS : STATIC_COMPONENTS}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
