/**
 * Working it out, rather than saying what it would be.
 *
 * A model asked for the average of two hundred numbers will produce a
 * number, and it will be close, and it will be wrong. The same is true of
 * date arithmetic, of a percentage change over a table, of counting
 * anything, of whether a regular expression matches the eleven cases you
 * care about. This is the one class of question where fluency is actively
 * dangerous: the answer looks exactly like a right answer.
 *
 * Every one of the big assistants solved it the same way — ChatGPT's data
 * analysis, Claude's analysis tool, Gemini's code execution — by letting
 * the model write the computation and then actually running it. This is
 * that, in the shape this app already has: the answer carries a
 * ```compute fence, the app runs it in the same kind of sandbox the canvas
 * preview uses, and what appears under the answer is the output of the
 * code rather than a recollection of what it would print.
 *
 * The sandbox is the point. It is an iframe with `allow-scripts` and
 * nothing else, so the page runs on an opaque origin: no storage, no
 * cookies, no reach into the app that opened it. A content policy of
 * `default-src 'none'` on top of that means the code cannot fetch, cannot
 * load an image, cannot phone anywhere. It can compute and it can print.
 */

/** Fenced as its own language, the way `predict` is, so nothing is guessed. */
const FENCE = /```compute[^\n]*\n([\s\S]*?)```/;

/** Longer than this and it is a program, not a calculation. */
const MAX_CODE = 20_000;

export function computeBlock(markdown: string): string | null {
  const m = FENCE.exec(markdown);
  if (!m) return null;
  const code = (m[1] ?? "").trim();
  if (!code || code.length > MAX_CODE) return null;
  return code;
}

/** One line of what the code printed. */
export interface Printed {
  level: "log" | "warn" | "error";
  text: string;
}

export interface Outcome {
  lines: Printed[];
  /** It never said it had finished. A loop, or something that threw the tab. */
  timedOut: boolean;
  ms: number;
}

/** How long a calculation gets before it is assumed not to be one. */
export const COMPUTE_TIMEOUT_MS = 4_000;
/** A console that prints a thousand lines has told you one thing badly. */
export const MAX_LINES = 200;
/** One line of it cannot be the whole page either. */
export const MAX_LINE = 2_000;

/**
 * The document the code runs inside.
 *
 * The bridge goes first so it catches anything thrown while the code is
 * still parsing, and the finish message goes last so the host can tell a
 * calculation that ended from one that is still going. `run` names this
 * run: a message from the previous one arriving late must not be read as
 * output of this one.
 */
export function computeDoc(code: string, run: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
<script>(function(){
  var RUN = ${JSON.stringify(run)};
  var seen = 0;
  function fmt(v){
    if (typeof v === "string") return v;
    if (v instanceof Error) return v.name + ": " + v.message;
    if (typeof v === "bigint") return v.toString() + "n";
    if (typeof v === "function") return "[function " + (v.name || "anonymous") + "]";
    try { return JSON.stringify(v, null, 0) ?? String(v); } catch (e) { return String(v); }
  }
  function post(level, parts){
    if (seen++ > ${MAX_LINES}) return;
    var text = parts.map(fmt).join(" ");
    if (text.length > ${MAX_LINE}) text = text.slice(0, ${MAX_LINE}) + " … (" + text.length + " characters)";
    try { parent.postMessage({ __armiCompute: 1, run: RUN, level: level, text: text }, "*"); } catch (e) {}
  }
  ["log","info","warn","error"].forEach(function(k){
    console[k] = function(){ post(k === "info" ? "log" : k, [].slice.call(arguments)); };
  });
  window.addEventListener("error", function(e){ post("error", [e.message]); });
  window.addEventListener("unhandledrejection", function(e){ post("error", [String(e.reason)]); });
  window.__armiDone = function(){
    try { parent.postMessage({ __armiComputeDone: 1, run: RUN }, "*"); } catch (e) {}
  };
})();<\/script>
</head><body><script>
try {
${code}
} catch (e) {
  console.error(e);
}
window.__armiDone();
<\/script></body></html>`;
}

/**
 * The output, as one short piece of text for the model to read back.
 *
 * This is what closes the loop: the first answer says what it is
 * computing, the app computes it, and the follow-up is written with the
 * real numbers in front of it rather than a memory of them.
 */
export function asNote(out: Outcome): string {
  if (out.timedOut) {
    return (
      `The computation you wrote did not finish within ${COMPUTE_TIMEOUT_MS / 1000} seconds and was stopped. ` +
      `Say so plainly and either write a cheaper computation or answer without one.`
    );
  }
  const printed = out.lines.map((l) => (l.level === "error" ? `ERROR: ${l.text}` : l.text)).join("\n");
  if (!printed.trim()) {
    return "The computation you wrote ran and printed nothing. Either it printed to the wrong place or it computed nothing; say so rather than inventing a result.";
  }
  const failed = out.lines.some((l) => l.level === "error");
  return (
    `This app ran the computation from your last reply. Here is exactly what it printed:\n\n` +
    `${printed}\n\n` +
    (failed
      ? `It errored. Say what went wrong in one line and correct it if you can.`
      : `Now give the answer using these numbers, as they are. Do not recompute them in your head, do not round them silently, and do not repeat the code.`)
  );
}
