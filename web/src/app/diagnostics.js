/**
 * Adaptive diagnostics.
 *
 * A diagnostic here is not a test with a score. It is a set of competing
 * explanations for what is going wrong, and a set of questions chosen because the
 * answers separate those explanations. The engine picks the next question by
 * expected information gain, measured in bits, and stops as soon as one
 * explanation is likely enough — which is usually after three or four questions,
 * not twenty.
 *
 * The likelihood tables are the substance. Each row says: *if this is what the
 * student misunderstands, how would they answer?* They are written from the
 * standard error patterns for each topic, and every row sums to 1 — a fact the
 * test suite checks, because a row that does not sum to 1 quietly biases every
 * posterior computed from it.
 */

export const DIAGNOSTICS = [
  {
    conceptId: "linear-equations",
    title: "Solving linear equations",
    hypotheses: [
      {
        id: "fluent", prior: 0.28, label: "Nothing specific is going wrong",
        advice: "Your errors look like ordinary slips rather than a pattern. Practice at pace, and check answers by substitution.",
      },
      {
        id: "signs", prior: 0.20, label: "Signs when terms move across the equals sign",
        advice: "Work on one thing: write the operation you are doing to *both* sides on every line, rather than moving terms across and changing their sign in your head.",
      },
      {
        id: "partial-divide", prior: 0.20, label: "Dividing only part of the equation",
        advice: "When you divide, divide every term. Writing the division under the whole line, rather than under one term, makes this hard to get wrong.",
      },
      {
        id: "brackets", prior: 0.17, label: "Not multiplying out brackets fully",
        advice: "The number outside a bracket multiplies everything inside it. Draw the two arrows before you expand.",
      },
      {
        id: "combine-unlike", prior: 0.15, label: "Combining terms that cannot be combined",
        advice: "3x and 2 are different kinds of thing and cannot be added into 5x. Before every line, ask what each term is a number *of*.",
      },
    ],
    questions: [
      {
        id: "lq-a", estimatedMinutes: 1.0, prompt: "Solve 2 − 4x = 14.",
        options: [
          { response: "a", label: "x = −3" }, { response: "b", label: "x = 3" },
          { response: "c", label: "x = 4" }, { response: "d", label: "Something else" },
        ],
        likelihoods: {
          fluent: { a: 0.90, b: 0.04, c: 0.03, d: 0.03 },
          signs: { a: 0.15, b: 0.70, c: 0.05, d: 0.10 },
          "partial-divide": { a: 0.50, b: 0.15, c: 0.20, d: 0.15 },
          brackets: { a: 0.80, b: 0.07, c: 0.05, d: 0.08 },
          "combine-unlike": { a: 0.10, b: 0.10, c: 0.10, d: 0.70 },
        },
      },
      {
        id: "lq-b", estimatedMinutes: 1.0, prompt: "Solve 3(x + 2) = 15.",
        options: [
          { response: "a", label: "x = 3" }, { response: "b", label: "x = 13/3" },
          { response: "c", label: "x = 5" }, { response: "d", label: "Something else" },
        ],
        likelihoods: {
          fluent: { a: 0.90, b: 0.03, c: 0.04, d: 0.03 },
          signs: { a: 0.75, b: 0.05, c: 0.10, d: 0.10 },
          "partial-divide": { a: 0.50, b: 0.15, c: 0.25, d: 0.10 },
          brackets: { a: 0.15, b: 0.65, c: 0.10, d: 0.10 },
          "combine-unlike": { a: 0.20, b: 0.30, c: 0.10, d: 0.40 },
        },
      },
      {
        id: "lq-c", estimatedMinutes: 1.2, prompt: "Solve 4x + 6 = 2x + 18.",
        options: [
          { response: "a", label: "x = 6" }, { response: "b", label: "x = 12" },
          { response: "c", label: "x = 4" }, { response: "d", label: "Something else" },
        ],
        likelihoods: {
          fluent: { a: 0.90, b: 0.03, c: 0.04, d: 0.03 },
          signs: { a: 0.35, b: 0.35, c: 0.15, d: 0.15 },
          "partial-divide": { a: 0.40, b: 0.15, c: 0.30, d: 0.15 },
          brackets: { a: 0.85, b: 0.05, c: 0.05, d: 0.05 },
          "combine-unlike": { a: 0.10, b: 0.10, c: 0.15, d: 0.65 },
        },
      },
      {
        id: "lq-d", estimatedMinutes: 1.2, prompt: "Solve (x + 4)/2 = 7.",
        options: [
          { response: "a", label: "x = 10" }, { response: "b", label: "x = 6" },
          { response: "c", label: "x = 18" }, { response: "d", label: "Something else" },
        ],
        likelihoods: {
          fluent: { a: 0.90, b: 0.04, c: 0.03, d: 0.03 },
          signs: { a: 0.80, b: 0.07, c: 0.05, d: 0.08 },
          "partial-divide": { a: 0.25, b: 0.55, c: 0.10, d: 0.10 },
          brackets: { a: 0.35, b: 0.40, c: 0.15, d: 0.10 },
          "combine-unlike": { a: 0.20, b: 0.15, c: 0.10, d: 0.55 },
        },
      },
      {
        // Deliberately included and deliberately useless: everyone answers it the
        // same way, so it carries almost no information and the engine will not
        // choose it. Keeping it in the pool proves the selection is doing work.
        id: "lq-e", estimatedMinutes: 0.5, prompt: "Solve 2x = 10.",
        options: [
          { response: "a", label: "x = 5" }, { response: "b", label: "x = 20" },
          { response: "d", label: "Something else" },
        ],
        likelihoods: {
          fluent: { a: 0.97, b: 0.02, d: 0.01 },
          signs: { a: 0.94, b: 0.03, d: 0.03 },
          "partial-divide": { a: 0.90, b: 0.06, d: 0.04 },
          brackets: { a: 0.96, b: 0.02, d: 0.02 },
          "combine-unlike": { a: 0.92, b: 0.04, d: 0.04 },
        },
      },
    ],
  },
  {
    conceptId: "fractions",
    title: "Fractions",
    hypotheses: [
      {
        id: "fluent", prior: 0.28, label: "Nothing specific is going wrong",
        advice: "No single pattern stands out. Mixed practice at pace is more use to you than more explanation.",
      },
      {
        id: "add-across", prior: 0.24, label: "Adding numerators and denominators straight across",
        advice: "Addition needs equal-sized parts; multiplication does not. Say which one you are doing out loud before you start.",
      },
      {
        id: "divide-rule", prior: 0.20, label: "The rule for dividing fractions",
        advice: "Dividing by a fraction is multiplying by its reciprocal. Practise just the flip, without any other arithmetic, until it is automatic.",
      },
      {
        id: "no-simplify", prior: 0.14, label: "Not simplifying the result",
        advice: "Your arithmetic is sound. Add one habit: after every answer, look for a common factor.",
      },
      {
        id: "mixed-numbers", prior: 0.14, label: "Converting mixed numbers",
        advice: "Convert to improper fractions before doing anything else, and back again only at the end.",
      },
    ],
    questions: [
      {
        id: "fq-a", estimatedMinutes: 1.0, prompt: "Work out 1/2 + 1/3.",
        options: [
          { response: "a", label: "5/6" }, { response: "b", label: "2/5" },
          { response: "c", label: "1/6" }, { response: "d", label: "Something else" },
        ],
        likelihoods: {
          fluent: { a: 0.93, b: 0.02, c: 0.02, d: 0.03 },
          "add-across": { a: 0.10, b: 0.78, c: 0.04, d: 0.08 },
          "divide-rule": { a: 0.85, b: 0.06, c: 0.03, d: 0.06 },
          "no-simplify": { a: 0.88, b: 0.05, c: 0.02, d: 0.05 },
          "mixed-numbers": { a: 0.82, b: 0.08, c: 0.04, d: 0.06 },
        },
      },
      {
        id: "fq-b", estimatedMinutes: 1.0, prompt: "Work out 3/4 ÷ 1/2.",
        options: [
          { response: "a", label: "3/2" }, { response: "b", label: "3/8" },
          { response: "c", label: "2/3" }, { response: "d", label: "Something else" },
        ],
        likelihoods: {
          fluent: { a: 0.92, b: 0.03, c: 0.02, d: 0.03 },
          "add-across": { a: 0.70, b: 0.15, c: 0.05, d: 0.10 },
          "divide-rule": { a: 0.12, b: 0.60, c: 0.18, d: 0.10 },
          "no-simplify": { a: 0.86, b: 0.05, c: 0.04, d: 0.05 },
          "mixed-numbers": { a: 0.80, b: 0.08, c: 0.05, d: 0.07 },
        },
      },
      {
        id: "fq-c", estimatedMinutes: 1.0, prompt: "Work out 2/6 + 1/6, in simplest form.",
        options: [
          { response: "a", label: "1/2" }, { response: "b", label: "3/6" },
          { response: "c", label: "3/12" }, { response: "d", label: "Something else" },
        ],
        likelihoods: {
          fluent: { a: 0.90, b: 0.06, c: 0.01, d: 0.03 },
          "add-across": { a: 0.20, b: 0.20, c: 0.50, d: 0.10 },
          "divide-rule": { a: 0.85, b: 0.09, c: 0.02, d: 0.04 },
          "no-simplify": { a: 0.12, b: 0.80, c: 0.03, d: 0.05 },
          "mixed-numbers": { a: 0.78, b: 0.14, c: 0.03, d: 0.05 },
        },
      },
      {
        id: "fq-d", estimatedMinutes: 1.3, prompt: "Work out 1 1/2 × 2/3.",
        options: [
          { response: "a", label: "1" }, { response: "b", label: "2/3" },
          { response: "c", label: "1 1/3" }, { response: "d", label: "Something else" },
        ],
        likelihoods: {
          fluent: { a: 0.88, b: 0.04, c: 0.04, d: 0.04 },
          "add-across": { a: 0.60, b: 0.14, c: 0.14, d: 0.12 },
          "divide-rule": { a: 0.75, b: 0.10, c: 0.08, d: 0.07 },
          "no-simplify": { a: 0.70, b: 0.10, c: 0.12, d: 0.08 },
          "mixed-numbers": { a: 0.15, b: 0.50, c: 0.22, d: 0.13 },
        },
      },
    ],
  },
  {
    conceptId: "quadratics",
    title: "Quadratic equations",
    hypotheses: [
      {
        id: "fluent", prior: 0.26, label: "Nothing specific is going wrong",
        advice: "You have the method. Work on speed and on checking both roots by substitution.",
      },
      {
        id: "lost-root", prior: 0.24, label: "Losing a root",
        advice: "A quadratic has two roots until proved otherwise. Never divide both sides by x, and always write ± after a square root.",
      },
      {
        id: "sign-of-roots", prior: 0.22, label: "Getting the sign of the roots backwards",
        advice: "The roots are the values that make each bracket zero, so their signs are the *opposite* of the numbers in the brackets. Substitute to check.",
      },
      {
        id: "factor-pairs", prior: 0.16, label: "Finding the factor pair",
        advice: "Practise just the search: given a product and a sum, find the pair. Twenty of those is worth more than five full questions.",
      },
      {
        id: "not-zero", prior: 0.12, label: "Factorising without setting the equation to zero",
        advice: "Rearrange to = 0 first, every time. Factorising a non-zero equation tells you nothing about the roots.",
      },
    ],
    questions: [
      {
        id: "qq-a", estimatedMinutes: 1.3, prompt: "Solve x² = 6x.",
        options: [
          { response: "a", label: "x = 0 or x = 6" }, { response: "b", label: "x = 6" },
          { response: "c", label: "x = 0 or x = −6" }, { response: "d", label: "Something else" },
        ],
        likelihoods: {
          fluent: { a: 0.88, b: 0.06, c: 0.03, d: 0.03 },
          "lost-root": { a: 0.10, b: 0.75, c: 0.05, d: 0.10 },
          "sign-of-roots": { a: 0.45, b: 0.15, c: 0.30, d: 0.10 },
          "factor-pairs": { a: 0.70, b: 0.15, c: 0.05, d: 0.10 },
          "not-zero": { a: 0.20, b: 0.55, c: 0.10, d: 0.15 },
        },
      },
      {
        id: "qq-b", estimatedMinutes: 1.3, prompt: "Solve x² − 5x + 6 = 0.",
        options: [
          { response: "a", label: "x = 2 or x = 3" }, { response: "b", label: "x = −2 or x = −3" },
          { response: "c", label: "x = 1 or x = 6" }, { response: "d", label: "Something else" },
        ],
        likelihoods: {
          fluent: { a: 0.92, b: 0.03, c: 0.02, d: 0.03 },
          "lost-root": { a: 0.60, b: 0.08, c: 0.07, d: 0.25 },
          "sign-of-roots": { a: 0.18, b: 0.65, c: 0.07, d: 0.10 },
          "factor-pairs": { a: 0.25, b: 0.12, c: 0.48, d: 0.15 },
          "not-zero": { a: 0.75, b: 0.08, c: 0.07, d: 0.10 },
        },
      },
      {
        id: "qq-c", estimatedMinutes: 1.2, prompt: "Solve x² − 9 = 0.",
        options: [
          { response: "a", label: "x = 3 or x = −3" }, { response: "b", label: "x = 3" },
          { response: "c", label: "x = 9 or x = −9" }, { response: "d", label: "Something else" },
        ],
        likelihoods: {
          fluent: { a: 0.92, b: 0.04, c: 0.02, d: 0.02 },
          "lost-root": { a: 0.15, b: 0.70, c: 0.05, d: 0.10 },
          "sign-of-roots": { a: 0.70, b: 0.12, c: 0.08, d: 0.10 },
          "factor-pairs": { a: 0.60, b: 0.15, c: 0.15, d: 0.10 },
          "not-zero": { a: 0.55, b: 0.20, c: 0.10, d: 0.15 },
        },
      },
      {
        id: "qq-d", estimatedMinutes: 1.5, prompt: "Solve x² + 4x = 12.",
        options: [
          { response: "a", label: "x = 2 or x = −6" }, { response: "b", label: "x = −2 or x = 6" },
          { response: "c", label: "x = 0 or x = −4" }, { response: "d", label: "Something else" },
        ],
        likelihoods: {
          fluent: { a: 0.87, b: 0.05, c: 0.03, d: 0.05 },
          "lost-root": { a: 0.62, b: 0.08, c: 0.10, d: 0.20 },
          "sign-of-roots": { a: 0.20, b: 0.62, c: 0.06, d: 0.12 },
          "factor-pairs": { a: 0.35, b: 0.15, c: 0.10, d: 0.40 },
          "not-zero": { a: 0.15, b: 0.10, c: 0.55, d: 0.20 },
        },
      },
    ],
  },
];

export const diagnosticFor = (conceptId) => DIAGNOSTICS.find((d) => d.conceptId === conceptId) || null;
export const hypothesisById = (diagnostic, id) => diagnostic.hypotheses.find((h) => h.id === id) || null;
