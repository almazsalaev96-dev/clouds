/**
 * What must not leave the device — enforced again here, because the client is not
 * trusted to have been careful.
 *
 * School material contains real people. A worksheet header carries a student's name
 * and class, a scanned letter carries an address, a screenshot carries an email
 * signature. None of that is needed to explain a quadratic.
 */

export interface RedactionReport {
  text: string;
  removed: Record<string, number>;
}

const RULES: Array<{
  name: string;
  pattern: RegExp;
  replacement: string;
  guard?: (match: string) => boolean;
}> = [
  { name: "email", pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g, replacement: "[email]" },
  // Phone numbers vary too much between countries for one shape to catch them, and a
  // loose shape eats real numbers out of the mathematics. So: match a plausible
  // grouping, then keep it only if the digit count is one a telephone number has.
  {
    name: "phone",
    pattern: /(?<![\w.])\+?\d[\d\s().-]{7,18}\d(?![\w.])/g,
    replacement: "[phone]",
    guard: (match: string) => {
      const digits = match.replace(/\D/g, "").length;
      return digits >= 9 && digits <= 15;
    },
  },
  { name: "postcode", pattern: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g, replacement: "[postcode]" },
  { name: "url", pattern: /\bhttps?:\/\/\S+/g, replacement: "[link]" },
  // Long unbroken digit runs are candidate identifiers: student numbers, card numbers,
  // NHS or national insurance numbers. Real mathematics rarely needs a bare 12-digit
  // integer, and when it does, losing it is cheaper than leaking an ID.
  { name: "longNumber", pattern: /(?<![\d.])\d{9,}(?![\d.])/g, replacement: "[number]" },
];

export function redact(text: string, extraTerms: readonly string[] = []): RedactionReport {
  const removed: Record<string, number> = {};
  let out = text;

  for (const rule of RULES) {
    let count = 0;
    out = out.replace(rule.pattern, (match) => {
      if (rule.guard && !rule.guard(match)) return match;
      count++;
      return rule.replacement;
    });
    if (count) removed[rule.name] = count;
  }

  // Caller-supplied terms: the student's own name, their school, a teacher's name.
  for (const term of extraTerms) {
    const clean = term.trim();
    if (clean.length < 3) continue;
    const pattern = new RegExp(escapeRegExp(clean), "gi");
    let count = 0;
    out = out.replace(pattern, () => { count++; return "[name]"; });
    if (count) removed["name"] = (removed["name"] ?? 0) + count;
  }

  return { text: out, removed };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
