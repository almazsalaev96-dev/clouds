import { NextResponse } from "next/server";
import { answerLocally, contextBlock, SYSTEM_PROMPT, type AssistantContext } from "@/lib/marketlab/assistant";

/**
 * The Lab Assistant's server route.
 *
 * THE KEY NEVER LEAVES THIS PROCESS. The browser posts a question here; this
 * route reads `ANTHROPIC_API_KEY` from the environment and calls the provider;
 * only the finished text goes back. There is no code path that sends the key
 * to the client, and none that accepts one from it — a client-supplied key
 * would let any visitor spend somebody else's credit through this origin.
 *
 * With no key configured the route does not fail. It answers from MarketLab's
 * own lesson corpus and the numbers the page sent with the question, labels
 * the reply `offline`, and the panel says so. A tool that disappears when an
 * environment variable is missing is not a tool a student can rely on.
 */

export const runtime = "nodejs";
/* Never cached: the same question with different numbers on screen is a
   different question. */
export const dynamic = "force-dynamic";

const MODEL = process.env.MARKETLAB_MODEL ?? "claude-sonnet-4-5";
const MAX_QUESTION = 4000;
const TIMEOUT_MS = 30_000;

interface Body {
  question?: unknown;
  context?: unknown;
  history?: unknown;
}

interface Turn { role: "user" | "assistant"; content: string }

function sanitiseHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Turn =>
      !!t && typeof t === "object"
      && ((t as Turn).role === "user" || (t as Turn).role === "assistant")
      && typeof (t as Turn).content === "string")
    .slice(-8)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_QUESTION) }));
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length === 0) {
    return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION) {
    return NextResponse.json({ error: `Questions are limited to ${MAX_QUESTION} characters.` }, { status: 413 });
  }

  const context = (body.context ?? null) as AssistantContext | null;
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    const local = answerLocally(question, context);
    return NextResponse.json({
      mode: "offline",
      answer: local.body,
      followUp: local.followUp,
      links: local.links,
      kind: local.kind,
    });
  }

  const base = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const system = context ? `${SYSTEM_PROMPT}\n\n---\n\n${contextBlock(context)}` : SYSTEM_PROMPT;
    const response = await fetch(`${base}/v1/messages`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        system,
        messages: [...sanitiseHistory(body.history), { role: "user", content: question }],
      }),
    });

    if (!response.ok) {
      // Falling back rather than erroring: a rate limit or a bad key should
      // degrade the assistant, not remove it.
      const detail = await response.text().catch(() => "");
      const local = answerLocally(question, context);
      return NextResponse.json({
        mode: "offline",
        answer: local.body,
        followUp: local.followUp,
        links: local.links,
        notice: `The AI provider replied ${response.status}. Answered offline instead.`,
        detail: detail.slice(0, 300),
      });
    }

    const data = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((b) => b?.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n")
      .trim();

    if (!text) {
      const local = answerLocally(question, context);
      return NextResponse.json({ mode: "offline", answer: local.body, followUp: local.followUp, links: local.links });
    }

    return NextResponse.json({ mode: "ai", answer: text });
  } catch (error) {
    const local = answerLocally(question, context);
    return NextResponse.json({
      mode: "offline",
      answer: local.body,
      followUp: local.followUp,
      links: local.links,
      notice: error instanceof Error && error.name === "AbortError"
        ? "The AI provider did not answer in time. Answered offline instead."
        : "Could not reach the AI provider. Answered offline instead.",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Lets the interface say, truthfully, which mode it is in before you ask. */
export async function GET() {
  return NextResponse.json({ mode: process.env.ANTHROPIC_API_KEY ? "ai" : "offline" });
}
