import { NextResponse } from "next/server";
import { z } from "zod";
import { getProvider, AIUnavailableError, markingSystemPrompt, MARKING_SCHEMA } from "@/ai";

/**
 * AI marking.
 *
 * The highest-stakes AI feature, so the most constrained: the model resolves
 * each *supplied* mark-scheme point and may not invent one. The result is
 * returned as a ledger proposal the student can see, argue with and override —
 * marking is a suggestion here, not a verdict, and the UI presents it that way.
 *
 * When the model flags its own uncertainty, that flag is passed through rather
 * than swallowed.
 */

const bodySchema = z.object({
  questionPrompt: z.string().max(8000),
  stimulus: z.string().max(20_000).optional(),
  commandWord: z.string().optional(),
  commandWordDefinition: z.string().optional(),
  marks: z.number().positive(),
  markSchemePoints: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        marks: z.number(),
        aoCode: z.string().optional(),
        alternatives: z.array(z.string()).optional(),
        rejects: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  markSchemeLevels: z
    .array(z.object({ level: z.number(), name: z.string(), marksFrom: z.number(), marksTo: z.number(), descriptor: z.string() }))
    .optional(),
  studentAnswer: z.string().max(20_000),
});

const resultSchema = z.object({
  ledger: z.array(
    z.object({
      pointId: z.string(),
      outcome: z.enum(["hit", "partial", "missed"]),
      lossReason: z.string().optional(),
      evidence: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  totalAwarded: z.number(),
  whatYouDidWell: z.string().optional(),
  theDecisiveGap: z.string(),
  improvedAnswer: z.string(),
  skillToPractise: z.string(),
  uncertain: z.boolean(),
  uncertaintyReason: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Malformed request." }, { status: 400 });

  const ctx = parsed.data;
  const provider = getProvider();

  try {
    const { value } = await provider.generateStructured({
      system: markingSystemPrompt(ctx),
      messages: [{ role: "user", content: `The student's answer:\n"""\n${ctx.studentAnswer}\n"""` }],
      schema: MARKING_SCHEMA as unknown as Record<string, unknown>,
      schemaName: "mark_answer",
      // Marking is where being wrong costs the student marks, so it always
      // routes to the stronger model regardless of question size.
      tier: "reasoning",
      feature: "mark",
      temperature: 0.1,
      maxTokens: 2500,
      validate: (raw) => resultSchema.parse(raw),
    });

    // A model that resolves points it was not given has hallucinated a scheme.
    // Drop those silently-wrong entries rather than showing them as marks.
    const known = new Set((ctx.markSchemePoints ?? []).map((p) => p.id));
    const ledger = known.size ? value.ledger.filter((e) => known.has(e.pointId)) : value.ledger;
    const dropped = value.ledger.length - ledger.length;

    return NextResponse.json({
      ...value,
      ledger,
      warnings: dropped > 0 ? [`${dropped} proposed mark point${dropped === 1 ? "" : "s"} did not exist in the mark scheme and ${dropped === 1 ? "was" : "were"} discarded.`] : [],
    });
  } catch (err) {
    if (err instanceof AIUnavailableError) {
      return NextResponse.json({ error: err.message, fallback: err.fallback }, { status: 503 });
    }
    return NextResponse.json(
      {
        error: "The AI could not safely mark this answer.",
        fallback:
          "Your attempt has been saved. Mark it yourself against the scheme — working through it point by point is the higher-value option anyway.",
      },
      { status: 500 },
    );
  }
}
