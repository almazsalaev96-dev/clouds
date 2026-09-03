/**
 * The graduated help ladder.
 *
 * Two rules the rest of the app must not be able to break.
 *
 * 1. Nothing is withheld. Every rung, including the full solution, is reachable
 *    at any time. Asking for the answer costs credit towards mastery, never
 *    access — a student stuck at 11pm gets the answer, and the log records that
 *    they had it, which is the honest trade.
 * 2. The first thing said is the most specific true thing available. If the
 *    deterministic grader diagnosed the error, the ladder opens on *that*, not on
 *    a generic prompt. A near-miss is a real finding about this answer, so using
 *    it is not guesswork.
 */

export const RUNGS = ["nudge", "hint", "explain", "steps", "solve"];
export const RUNG_LABEL = {
  nudge: "Nudge", hint: "Hint", explain: "Explain", steps: "Show the steps", solve: "Show the answer",
};
export const RUNG_COST = {
  nudge: "Counts almost fully towards mastery.",
  hint: "Counts partly towards mastery.",
  explain: "Counts partly towards mastery.",
  steps: "Counts a little towards mastery.",
  solve: "Does not count towards unaided mastery — but you still get the answer.",
};

/** The grader's near-miss, said to a student rather than to a log. */
const NEAR_MISS_COACHING = {
  signFlipped: {
    right: "Your magnitude is right — the size of the number is correct.",
    fix: "The sign is the other way round. Track the minus signs through each line.",
    errorType: "careless",
  },
  reciprocal: {
    right: "You used the right two numbers.",
    fix: "They are the wrong way up. Check which quantity goes on top.",
    errorType: "procedural",
  },
  offByFactor: {
    right: "Your method has produced the right shape of answer.",
    fix: "It is out by a constant factor — usually a doubled, halved or dropped multiplier.",
    errorType: "calculation",
  },
  squared: {
    right: "You are working with the right quantity.",
    fix: "It has been squared somewhere it should not have been.",
    errorType: "procedural",
  },
  squareRooted: {
    right: "You are working with the right quantity.",
    fix: "A square root has been taken that the question did not ask for.",
    errorType: "procedural",
  },
  degreesForRadians: {
    right: "The trigonometry is set up correctly.",
    fix: "The angle was treated as radians. Your calculator is in the wrong mode.",
    errorType: "procedural",
  },
  radiansForDegrees: {
    right: "The trigonometry is set up correctly.",
    fix: "The angle was treated as degrees where radians were meant.",
    errorType: "procedural",
  },
  roundingOnly: {
    right: "The value is right.",
    fix: "It is not written to the accuracy the question asked for.",
    errorType: "examTechnique",
  },
  rightNumberWrongUnit: {
    right: "The number is right.",
    fix: "The unit is not. The conversion is the only thing left to do.",
    errorType: "interpretation",
  },
  missingUnit: {
    right: "The number is right.",
    fix: "The question asks for a unit, and an answer without one is incomplete.",
    errorType: "examTechnique",
  },
  unitMismatch: {
    right: "You have produced a quantity.",
    fix: "It is not the same kind of quantity the question asked for — check what you divided by what.",
    errorType: "interpretation",
  },
};

/**
 * What the app says immediately after a check. Derived from the grader, so it is
 * as specific as the grader's certainty allows and no more.
 */
const capitalise = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function diagnose(result, question) {
  if (result.verdict === "abstain") {
    // An abstention is a statement about the marker, not about the student, and it
    // is logged as unreadable so it never counts against their ability.
    return {
      tone: "unsure",
      title: result.parsed ? "I cannot mark that against this question" : "I could not read that as an answer",
      right: "",
      fix: result.parsed
        ? `${capitalise(result.reason)}. This question has a definite value, so nothing can be concluded from an answer in terms of something else. Nothing has been counted against you.`
        : `Answers are parsed as expressions rather than matched as text, and this one did not parse: ${result.reason}. Something in the shape of ${question.expected[0].text} will read correctly.`,
      errorType: "unreadable",
      openAt: "nudge",
    };
  }
  if (result.verdict === "correct") {
    return {
      tone: "correct", title: "Correct", right: result.reason, fix: "",
      errorType: null, openAt: null,
    };
  }
  const nm = result.nearMiss ? NEAR_MISS_COACHING[result.nearMiss.kind] : null;
  if (nm) {
    return {
      tone: result.verdict === "partiallyCorrect" ? "nearly" : "specific",
      title: result.verdict === "partiallyCorrect" ? "Nearly" : "Not right, but close",
      right: nm.right,
      fix: `${nm.fix} ${result.nearMiss.detail}`.trim(),
      errorType: nm.errorType,
      nearMissKind: result.nearMiss.kind,
      openAt: "nudge",
    };
  }
  return {
    tone: "wrong",
    title: result.verdict === "partiallyCorrect" ? "Partly right" : "Not right",
    right: "",
    fix: "The value does not match. The nudge below points at the step where this usually goes wrong.",
    errorType: "unknown",
    openAt: "nudge",
  };
}

/** The authored rung. Available with no network, no account and no credentials. */
export function localRung(question, rung) {
  switch (rung) {
    case "nudge": return { kind: "text", text: question.nudge };
    case "hint": return { kind: "text", text: question.hint };
    case "explain": return { kind: "text", text: question.explain };
    case "steps": return { kind: "steps", steps: question.steps };
    case "solve": return { kind: "answer", text: question.solution, steps: question.steps };
    default: return { kind: "text", text: "" };
  }
}

export const nextRung = (current) =>
  current === null ? "nudge" : RUNGS[Math.min(RUNGS.indexOf(current) + 1, RUNGS.length - 1)];

/**
 * The tutor, when one is configured.
 *
 * There is no fallback that invents a reply: without a gateway the ladder above is
 * what you get, and it is honest about being written rather than generated. No
 * credential ever reaches this file — the gateway holds them, which is the whole
 * reason it exists.
 */
export async function askGateway(baseUrl, payload, signal) {
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/tutor`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`gateway returned ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  const data = await response.json();
  if (!data || !data.reply || typeof data.reply.message !== "string") {
    throw new Error("gateway reply did not match the expected shape");
  }
  return data.reply;
}
