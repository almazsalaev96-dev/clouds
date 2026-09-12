/**
 * Reading a finished answer, to see whether it obeyed the rules the app set.
 *
 * This app measures its container exhaustively. Contrast against WCAG for
 * every pair it renders, every control against 44pt in three densities, the
 * type scale read off the live DOM at two root sizes, fourteen widths, the
 * print stylesheet, the keyboard route, every run of text for reachability.
 * And it measured the *content* — the thing the whole app exists to deliver —
 * not at all. `lib/answer.ts` states eight rules and `lib/shape.ts` states five
 * to seven more per kind of work, and nothing had ever read an answer back.
 *
 * ## What this can and cannot do
 *
 * It cannot tell whether an answer is right. It can tell whether it opens with
 * a header, restates the question before answering it, hedges without
 * committing, describes itself, or ends with an offer to help further — each
 * of which is a named rule, each of which leaves a signature in the text, and
 * each of which the model does *more* of when it is less sure. So the honest
 * claim is narrow: these are the failures that are visible from outside, and
 * an answer clean of them is not thereby good.
 *
 * ## Why it is regexes and not a model
 *
 * A judge model costs a call, a key and a wait, disagrees with itself between
 * runs, and cannot be put in a test. These rules are mechanical, deterministic
 * and free, which means they can run on every answer in the suite and fail a
 * build. The cost is that each one is a proxy for its rule rather than the
 * rule itself, and where a proxy would fire on good writing it is left out —
 * a false alarm on an answer that was fine teaches everyone to ignore the
 * whole file.
 */

export interface Finding {
  /** The house rule this stands for. */
  rule: string;
  /** What was found, quoted, so a person can judge the call themselves. */
  found: string;
  /** Why it is a problem, in the terms the rule is stated in. */
  why: string;
}

/* Openers that are not answers. A header first, a pleasantry first, or a
   label announcing that the answer is about to begin — all three spend the
   one line a reader is guaranteed to read. */
const OPENER =
  /^\s*(?:#{1,6}\s|(?:Great|Sure|Certainly|Of course|Absolutely|Happy to|I'd be happy to|Good question)\b|(?:Short answer|Short version|In summary|TL;?DR|The answer)\s*:)/i;

/* Talking about the answer instead of giving it. */
const META =
  /\b(?:here'?s (?:a |the )?(?:quick|brief|short|concise|detailed)|let me (?:explain|walk you|break)|I'?ll (?:explain|walk|cover|start by)|in (?:plain|simple) (?:english|terms)|to (?:keep|make) (?:this|it) (?:short|brief|simple))\b/i;

/* The closing offer. The reader can see the text box. */
const TRAILING_OFFER =
  /\b(?:I hope (?:this|that) helps|let me know if|feel free to|happy to (?:help|dig|go)|if you'?d like,? I can|would you like me to)\b/i;

/* A probability word with no number anywhere near it. "Likely" is read as
   anything from a coin toss to near-certainty depending on the reader, which
   is the whole reason the rule exists. */
const HEDGE = /\b(?:likely|unlikely|probably|possibly|perhaps|may well|might well|arguably|in all likelihood)\b/gi;
/* What counts as the odds. Digits are the easy half; people write frequencies
   in words at least as often — "nine times in ten" is a number, and a rule
   that only reads digits would flag the sentence that got it right. */
const WORD_NUM = "one|two|three|four|five|six|seven|eight|nine|ten|a dozen|half|most|nearly all|almost never";
const NUMBER_NEAR = new RegExp(
  [
    String.raw`\d+(?:\.\d+)?\s*(?:%|percent)`,
    String.raw`\d+\s*(?:times\s+)?(?:in|out of)\s*\d+`,
    String.raw`(?:${WORD_NUM})\s+(?:times\s+)?(?:in|out of)\s+(?:${WORD_NUM})`,
    String.raw`\d+\s*[-–]\s*\d+\s*%`,
    String.raw`\b(?:${WORD_NUM})\s+(?:in|of)\s+(?:${WORD_NUM})\b`,
  ].join("|"),
  "i",
);

/** Sentences, near enough for this — an abbreviation costing a split is fine. */
function sentences(text: string): string[] {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Content words, for comparing a first sentence against the question. */
function contentWords(s: string): Set<string> {
  const STOP = new Set("a an the is are was were be been being of to in on at for with and or but if then than that this these those it its as by from do does did can could should would will i you we they what why how when where which who".split(" "));
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/**
 * Every rule this can see, applied to one answer.
 *
 * `question` is optional and only one rule uses it: an answer cannot be judged
 * for restating a question nobody passed in.
 */
export function lintAnswer(md: string, question?: string): Finding[] {
  const out: Finding[] = [];
  const body = md.trim();
  if (!body) return out;

  const head = body.slice(0, 240);
  const opener = head.match(OPENER);
  if (opener) {
    out.push({
      rule: "open with the answer",
      found: opener[0].trim(),
      why: "people read about a quarter of a page and they read the top of it, so a first line spent on a header or a pleasantry is the only line you were guaranteed",
    });
  }

  const said = sentences(body);
  if (question && said.length) {
    const q = contentWords(question);
    const first = contentWords(said[0]);
    if (q.size >= 3) {
      let shared = 0;
      for (const w of first) if (q.has(w)) shared++;
      const overlap = shared / Math.max(q.size, 1);
      if (overlap > 0.75 && first.size <= q.size + 3) {
        out.push({
          rule: "open with the answer",
          found: said[0].slice(0, 90),
          why: "the first sentence is the question again — they wrote it, they know what it says",
        });
      }
    }
  }

  const meta = body.match(META);
  if (meta) {
    out.push({
      rule: "do not describe your own answer",
      found: meta[0],
      why: "announcing what is coming spends the reader's attention on the answer's packaging",
    });
  }

  const offer = body.match(TRAILING_OFFER);
  if (offer) {
    out.push({
      rule: "do not describe your own answer",
      found: offer[0],
      why: "the closing offer to help further is furniture; the reader can see the text box",
    });
  }

  /* Hedging with no odds attached. Checked per sentence rather than per
     document, because a number three paragraphs away is not the number that
     word needed. */
  for (const s of said) {
    const hedges = s.match(HEDGE);
    if (hedges && !NUMBER_NEAR.test(s)) {
      out.push({
        rule: "a probability word carries a number",
        found: hedges[0],
        why: "the same word is read as anywhere from a coin toss to near-certainty depending on who is reading it",
      });
      break; // One is the finding. Listing every instance is noise.
    }
  }

  /* Structure that outweighs its content. Counted against words rather than
     against a fixed ceiling, because a genuinely multifaceted answer earns
     more of it and a two-paragraph one earns none. */
  const words = body.split(/\s+/).length;
  const bullets = (body.match(/^\s*(?:[-*+]|\d+\.)\s/gm) ?? []).length;
  const headers = (body.match(/^#{1,6}\s/gm) ?? []).length;
  const bolds = (body.match(/\*\*[^*]+\*\*/g) ?? []).length;
  const marks = bullets + headers * 2 + bolds;
  /* Four marks is the floor rather than forty words: an answer that is six
     bullets and twenty-five words is mostly marks, and a rule that waited for
     length would call it prose. Three marks in a short answer is a list said
     as a list, which is what lists are for. */
  if (marks >= 4 && marks / words > 0.09) {
    out.push({
      rule: "write in prose",
      found: `${bullets} bullets, ${headers} headers and ${bolds} bold runs in ${words} words`,
      why: "bullets look thorough and carry less — they delete the because, the therefore and the unless, which are not the packaging around an explanation but the explanation",
    });
  }

  return out;
}

/** True when an answer broke none of the rules this file can see. */
export const clean = (md: string, question?: string) => lintAnswer(md, question).length === 0;
