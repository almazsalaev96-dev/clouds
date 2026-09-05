import { NextResponse } from "next/server";
import { z } from "zod";
import { getProvider, AIUnavailableError, tutorSystemPrompt, type TutorMode } from "@/ai";

/**
 * The tutor.
 *
 * The route builds the system prompt from *supplied* authoritative context —
 * command-word definitions from the pack, the student's mastery summary, their
 * recorded mistakes — rather than letting the model work from memory. A model
 * asked what a board means by "evaluate" will produce something confident and
 * possibly wrong; the same model given the official definition applies it.
 *
 * Nothing about the student is stored server-side. The client sends only the
 * context this turn needs.
 */

const bodySchema = z.object({
  mode: z.string(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) })).min(1).max(40),
  context: z.object({
    subject: z.string(),
    syllabusCode: z.string(),
    syllabusTitle: z.string(),
    topicTitle: z.string().optional(),
    objectives: z.array(z.string()).max(40).optional(),
    commandWords: z.array(z.object({ word: z.string(), definition: z.string(), aoCeiling: z.array(z.string()) })).max(30).optional(),
    masterySummary: z.string().max(2000).optional(),
    recentMistakes: z.array(z.string().max(400)).max(12).optional(),
    targetGrade: z.string().optional(),
    daysToExam: z.number().optional(),
    selection: z.string().max(4000).optional(),
  }),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const { mode, messages, context } = parsed.data;
  const provider = getProvider();

  try {
    const result = await provider.generate({
      system: tutorSystemPrompt(mode as TutorMode, context),
      messages,
      feature: mode === "socratic" ? "socratic" : "tutor",
      // Socratic questioning and examining are reasoning-heavy; quick recall
      // and revision partnering are not. Routing by task is the biggest lever
      // on cost, and it does not cost quality where it matters.
      tier: ["socratic", "examiner", "essay-reviewer", "coach"].includes(mode) ? "reasoning" : "fast",
      maxTokens: 1400,
      temperature: mode === "socratic" ? 0.5 : 0.4,
    });

    return NextResponse.json({
      text: result.text,
      model: result.model,
      usage: { input: result.inputTokens, output: result.outputTokens, ms: result.ms, cached: result.cached },
    });
  } catch (err) {
    if (err instanceof AIUnavailableError) {
      // Never "something went wrong". Say what failed and what still works.
      return NextResponse.json({ error: err.message, fallback: err.fallback }, { status: 503 });
    }
    return NextResponse.json(
      { error: "The tutor could not respond.", fallback: "Your work is unaffected — every other part of Lodestar runs without AI." },
      { status: 500 },
    );
  }
}
