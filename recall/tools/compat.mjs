/**
 * The browser gate.
 *
 * This exists because the previous build shipped a regular expression containing a
 * lookbehind assertion. Lookbehind arrived in Safari 16.4; on any older iPad the
 * browser could not *parse* the script, so the page was blank with no error and no
 * partial recovery. Every test passed, because every test ran in Chromium.
 *
 * The floor is now Safari 15.0 — iPadOS 15, September 2021 — and anything newer
 * than the floor fails the build instead of the student's device.
 *
 * Rules are scoped to the language they belong to, because this app is one file
 * with CSS and JavaScript in it and `#f7f5ef` is a colour, not a private field.
 */

const RULES = [
  // ---- JavaScript syntax: does not parse, so it takes the whole file down ----
  ["js", /\(\?<[=!]/, "regular expression lookbehind", "Safari 16.4", "rewrite without it"],
  ["js", /(^|[^\w$])static\s*\{/, "class static initialisation block", "Safari 16.4", "assign after the class body"],
  ["js", /(^|[\s;{(])#[A-Za-z_]\w*\s*[=(]/, "private class field or method", "Safari 14.1", "use a normal property"],
  ["js", /\?\?=|\|\|=|&&=/, "logical assignment", "Safari 14", "write the long form"],

  // ---- JavaScript runtime: throws when reached ------------------------------
  ["js", /[\w$)\]]\.at\s*\(/, ".at()", "Safari 15.4", "index directly, or length - 1"],
  ["js", /\bstructuredClone\s*\(/, "structuredClone", "Safari 15.4", "JSON round-trip"],
  ["js", /\bObject\.hasOwn\b/, "Object.hasOwn", "Safari 15.4", "hasOwnProperty.call"],
  ["js", /\.toSorted\s*\(|\.toReversed\s*\(|\.toSpliced\s*\(/, "array copy method", "Safari 16", "slice() first"],
  ["js", /\.findLast\w*\s*\(/, "findLast", "Safari 15.4", "loop backwards"],
  ["js", /\bObject\.groupBy\b|\.groupBy\s*\(/, "groupBy", "Safari 17.4", "build the map by hand"],
  ["js", /\bArray\.fromAsync\b/, "Array.fromAsync", "Safari 16.4", "collect in a loop"],
  ["js", /\bRegExp\.escape\b/, "RegExp.escape", "Safari 26", "escape by replace"],
  ["js", /\bnavigator\.clipboard\.read\b/, "clipboard read", "gated on iPadOS", "use a paste event"],
  ["js", /\bshowOpenFilePicker\b|\bshowSaveFilePicker\b/, "File System Access", "not in Safari", "use an <input type=file>"],

  // ---- CSS: dropped silently, which is worse than an error ------------------
  ["css", /color-mix\s*\(/, "color-mix()", "Safari 16.2", "declare the blended colour as a token"],
  ["css", /:has\s*\(/, ":has()", "Safari 15.4", "set a class on the parent from script"],
  ["css", /@container\b/, "container queries", "Safari 16", "use a media query"],
  ["css", /text-wrap\s*:/, "text-wrap", "Safari 17.5", "leave the default"],
  ["css", /@property\b/, "@property", "Safari 16.4", "plain custom property"],
  ["css", /\baccent-color\s*:/, "accent-color", "Safari 15.4", "style the control yourself"],
  ["css", /\bbackdrop-filter\s*:(?![^;]*-webkit)/, "unprefixed backdrop-filter", "Safari needs -webkit-", "add -webkit-backdrop-filter first"],

  // ---- both: a stray non-ASCII character in code is always a typo -----------
  ["any", /[^\x00-\x7F]/, "non-ASCII character in code", "always a typo here", "retype the line"],
];

/**
 * Characters that are never typed on purpose and cannot be seen once they land.
 * These are checked on the raw line, strings included: a non-breaking space in a
 * string is not typography, it is a bug you will spend an hour finding. One of
 * these silently broke this app's cloze gaps, which is why the rule exists.
 */
const INVISIBLE = [
  [/\u00a0/, "non-breaking space", "U+00A0"],
  [/[\u200b-\u200d\ufeff]/, "zero-width character", "U+200B-200D or U+FEFF"],
  [/\u00ad/, "soft hyphen", "U+00AD"],
  [/[\uff01-\uff5e]/, "full-width character", "U+FF01-FF5E"],
];

/* Curly quotes and dashes are deliberately absent from that list: they are
 * visible, they are correct English typography, and banning them would push the
 * copy towards typewriter punctuation for no benefit. */

/** A dvh/svh/lvh unit is allowed only where an older unit is declared alongside it. */
const VIEWPORT_UNIT = /\d(dvh|svh|lvh|dvw)\b/;
const OLD_UNIT = /\d(vh|vw)\b/;

const stripStrings = (line) =>
  line.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, "``");

/**
 * Which language each line is in. Comments and prose are exempt from everything
 * except the non-ASCII rule, so an explanation may name what it forbids.
 */
function regions(source) {
  const lines = source.split("\n");
  const kinds = new Array(lines.length).fill("html");
  let mode = "html";
  let comment = false;
  lines.forEach((line, i) => {
    if (/<style[\s>]/i.test(line)) mode = "css";
    else if (/<script[\s>]/i.test(line)) mode = "js";
    kinds[i] = mode;
    if (/<\/style>/i.test(line)) mode = "html";
    if (/<\/script>/i.test(line)) mode = "html";

    const trimmed = line.trim();
    const opens = trimmed.indexOf("/*") !== -1;
    const closes = trimmed.indexOf("*/") !== -1;
    if (comment || (opens && !closes) || trimmed.indexOf("//") === 0 || trimmed.indexOf("*") === 0) {
      if (kinds[i] !== "html") kinds[i] = "comment";
    }
    if (opens && !closes) comment = true;
    if (closes) comment = false;
  });
  return { lines, kinds };
}

export function audit(source, name = "input") {
  const { lines, kinds } = regions(source);
  const problems = [];

  lines.forEach((line, i) => {
    const kind = kinds[i];
    const code = stripStrings(line);
    for (const [scope, pattern, what, since, fix] of RULES) {
      // Prose and comments are exempt from everything: an em dash in an
      // explanation is writing, and a comment cannot break a parser.
      if (kind === "html" || kind === "comment") continue;
      if (scope !== "any" && scope !== kind) continue;
      if (pattern.test(code)) {
        problems.push({ line: i + 1, what, since, fix, text: line.trim().slice(0, 100) });
      }
    }
    if (kind !== "html") {
      for (const [pattern, what, code_point] of INVISIBLE) {
        if (pattern.test(line)) {
          problems.push({
            line: i + 1, what: what + " (" + code_point + ")", since: "invisible",
            fix: "retype it as an ordinary character, or use a \\u escape if you meant it",
            text: line.trim().slice(0, 100),
          });
        }
      }
    }

    if (kind === "css" && VIEWPORT_UNIT.test(code)) {
      const nearby = lines.slice(Math.max(0, i - 2), i + 1).join("\n");
      if (!OLD_UNIT.test(nearby)) {
        problems.push({
          line: i + 1, what: "dynamic viewport unit", since: "Safari 15.4",
          fix: "declare the vh/vw value first, on the same line or just above",
          text: line.trim().slice(0, 100),
        });
      }
    }
  });

  return { name, problems, ok: problems.length === 0 };
}

export function report(result) {
  if (result.ok) {
    console.log(`  ok    ${result.name} — nothing newer than Safari 15`);
    return true;
  }
  console.log(`  FAIL  ${result.name} — ${result.problems.length} problem(s)`);
  for (const p of result.problems) {
    console.log(`        line ${p.line}: ${p.what} (${p.since}) — ${p.fix}`);
    console.log(`          ${p.text}`);
  }
  return false;
}
