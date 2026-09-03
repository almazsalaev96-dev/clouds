/**
 * The content the web build ships with.
 *
 * Two deliberate decisions live in this file.
 *
 * First, the help for every question is *written*, not generated. The graduated
 * ladder has to work with no network and no credentials, and a made-up
 * explanation is worse than none, so each rung is authored alongside the answer
 * it explains. When a gateway is configured the tutor speaks for itself; when it
 * is not, the student still gets real help rather than an apology.
 *
 * Second, the expected answers are written for the deterministic grader, which
 * decides equivalence by evaluation rather than by string match. `x = 5`, `5`,
 * `10/2` and `2.5 * 2` are the same answer, so only one of them needs listing.
 */

export const CONCEPTS = [
  { id: "fractions", name: "Fractions", prerequisites: [], priority: 1.0 },
  { id: "linear-equations", name: "Linear equations", prerequisites: ["fractions"], priority: 1.0 },
  { id: "expanding", name: "Expanding and factorising", prerequisites: [], priority: 0.9 },
  {
    id: "quadratics", name: "Quadratic equations",
    prerequisites: ["expanding", "linear-equations"], priority: 1.0,
  },
  { id: "trigonometry", name: "Right-angled trigonometry", prerequisites: ["linear-equations"], priority: 0.9 },
  { id: "units", name: "Units and rates", prerequisites: [], priority: 0.8 },
];

const q = (o) => ({ assistanceUsed: null, ...o });

export const QUESTIONS = [
  // ---------------------------------------------------------------- fractions
  q({
    id: "fr-1", conceptId: "fractions", label: "1",
    prompt: "Work out 2/3 + 1/4, giving your answer as a fraction in its simplest form.",
    expected: [{ text: "11/12" }],
    nudge: "The denominators are different. What has to be true before you can add them?",
    hint: "Rewrite both fractions over a common denominator of 12 first.",
    explain: "Adding fractions adds *parts of the same size*. Thirds and quarters are different sizes, so they cannot be added directly. Twelfths are the smallest size both can be cut into: 2/3 = 8/12 and 1/4 = 3/12.",
    steps: ["Find the lowest common denominator of 3 and 4 → 12.", "2/3 = 8/12 and 1/4 = 3/12.", "Add the numerators: 8 + 3 = 11.", "11/12 has no common factor, so it is already simplest."],
    solution: "11/12",
  }),
  q({
    id: "fr-2", conceptId: "fractions", label: "2",
    prompt: "Work out 3/4 × 8/9, giving your answer in its simplest form.",
    expected: [{ text: "2/3" }],
    nudge: "Multiplying is the easy one — but look for cancelling before you multiply.",
    hint: "3 and 9 share a factor; so do 4 and 8. Cancel first and the numbers stay small.",
    explain: "For multiplication you multiply numerators and denominators — no common denominator needed. Cancelling first is the same operation done earlier, and keeps you away from 24/36.",
    steps: ["Cancel 3 with 9 → 1 and 3.", "Cancel 4 with 8 → 1 and 2.", "Left with 1/1 × 2/3.", "= 2/3."],
    solution: "2/3",
  }),
  q({
    id: "fr-3", conceptId: "fractions", label: "3",
    prompt: "Work out 5/6 ÷ 2/3.",
    expected: [{ text: "5/4" }, { text: "1.25" }],
    nudge: "Division by a fraction has a rule you already know. What is it?",
    hint: "Dividing by 2/3 is the same as multiplying by 3/2.",
    explain: "\"How many 2/3s fit into 5/6?\" Multiplying by the reciprocal answers that. The result being bigger than 5/6 is expected: you are dividing by something smaller than 1.",
    steps: ["5/6 ÷ 2/3 = 5/6 × 3/2.", "Cancel 3 with 6 → 1 and 2.", "= 5/(2×2) = 5/4.", "As a mixed number, 1 1/4."],
    solution: "5/4",
  }),
  q({
    id: "fr-4", conceptId: "fractions", label: "4", kind: "transfer",
    prompt: "A recipe uses 3/4 of a cup of flour. You make 2/3 of the recipe. How many cups of flour do you use?",
    expected: [{ text: "1/2" }, { text: "0.5" }],
    nudge: "\"2/3 of\" is an instruction. Which operation is it?",
    hint: "\"Of\" means multiply: 2/3 × 3/4.",
    explain: "The word \"of\" between two fractions is multiplication. This is the same calculation as question 2 in different clothing — which is the point of the question.",
    steps: ["2/3 of 3/4 = 2/3 × 3/4.", "Cancel 3 with 3.", "= 2/4 = 1/2 of a cup."],
    solution: "1/2 cup",
  }),

  // -------------------------------------------------------- linear equations
  q({
    id: "li-1", conceptId: "linear-equations", label: "1",
    prompt: "Solve 3x + 7 = 22.",
    expected: [{ text: "5" }],
    nudge: "Undo the operations in the reverse order they were applied.",
    hint: "Subtract 7 from both sides first, then divide by 3.",
    explain: "x was multiplied by 3, then 7 was added. To get back to x you undo the addition first, then the multiplication — the reverse order.",
    steps: ["3x + 7 = 22", "3x = 15   (subtract 7 from both sides)", "x = 5   (divide both sides by 3)"],
    solution: "x = 5",
  }),
  q({
    id: "li-2", conceptId: "linear-equations", label: "2",
    prompt: "Solve 2 − 4x = 14.",
    expected: [{ text: "-3" }],
    nudge: "Check the sign of the term containing x before you divide.",
    hint: "Subtracting 2 gives −4x = 12. Now divide by −4, not 4.",
    explain: "The coefficient of x is −4, not 4. Dividing 12 by −4 gives −3. A negative answer here is correct, and worth a moment's check: 2 − 4(−3) = 2 + 12 = 14. ✓",
    steps: ["2 − 4x = 14", "−4x = 12   (subtract 2 from both sides)", "x = 12 ÷ (−4) = −3", "Check: 2 − 4(−3) = 14 ✓"],
    solution: "x = −3",
  }),
  q({
    id: "li-3", conceptId: "linear-equations", label: "3",
    prompt: "Solve 5(x − 2) = 3x + 4.",
    expected: [{ text: "7" }],
    nudge: "There is a bracket on one side and an x on both. Deal with the bracket first.",
    hint: "Expand to 5x − 10 = 3x + 4, then collect the x terms on one side.",
    explain: "The 5 multiplies everything inside the bracket, including the −2. Once expanded, gathering x terms on the side with more of them keeps the coefficient positive.",
    steps: ["5(x − 2) = 3x + 4", "5x − 10 = 3x + 4   (expand)", "2x − 10 = 4   (subtract 3x)", "2x = 14", "x = 7"],
    solution: "x = 7",
  }),
  q({
    id: "li-4", conceptId: "linear-equations", label: "4",
    prompt: "Solve x/3 + 4 = 10.",
    expected: [{ text: "18" }],
    nudge: "x is divided by 3. What undoes that?",
    hint: "Subtract 4, then multiply both sides by 3.",
    explain: "Multiplying by 3 undoes dividing by 3 — but only after the +4 has gone. Multiplying too early gives x + 12 = 30, which is still solvable but a longer route.",
    steps: ["x/3 + 4 = 10", "x/3 = 6   (subtract 4)", "x = 18   (multiply by 3)"],
    solution: "x = 18",
  }),

  // ----------------------------------------------------------- expanding etc.
  q({
    id: "ex-1", conceptId: "expanding", label: "1",
    prompt: "Expand and simplify (x + 3)(x − 5).",
    expected: [{ text: "x^2 - 2x - 15" }],
    nudge: "Every term in the first bracket multiplies every term in the second.",
    hint: "x·x, x·(−5), 3·x, 3·(−5) — then collect the x terms.",
    explain: "Four products, then collect. −5x + 3x = −2x. The constant is 3 × (−5) = −15, negative because the signs differ.",
    steps: ["x·x = x²", "x·(−5) = −5x", "3·x = 3x", "3·(−5) = −15", "x² − 5x + 3x − 15 = x² − 2x − 15"],
    solution: "x² − 2x − 15",
  }),
  q({
    id: "ex-2", conceptId: "expanding", label: "2",
    prompt: "Expand (2x − 1)².",
    expected: [{ text: "4x^2 - 4x + 1" }],
    nudge: "Squaring a bracket is not squaring each term.",
    hint: "(2x − 1)² means (2x − 1)(2x − 1). Expand it as a product.",
    explain: "The commonest error here is writing 4x² + 1: it drops the two middle terms. Write the bracket out twice and the −2x − 2x appears where it belongs.",
    steps: ["(2x − 1)(2x − 1)", "2x·2x = 4x²", "2x·(−1) + (−1)·2x = −4x", "(−1)(−1) = +1", "= 4x² − 4x + 1"],
    solution: "4x² − 4x + 1",
  }),
  q({
    id: "ex-3", conceptId: "expanding", label: "3",
    prompt: "Factorise x² + 7x + 12.",
    expected: [{ text: "(x+3)(x+4)" }],
    nudge: "You want two numbers with a fixed sum and a fixed product.",
    hint: "Which two numbers multiply to 12 and add to 7?",
    explain: "For x² + bx + c the two numbers multiply to c and add to b. 3 and 4 do both. You can always check by expanding back.",
    steps: ["Need two numbers: product 12, sum 7.", "Factor pairs of 12: 1·12, 2·6, 3·4.", "3 + 4 = 7 ✓", "x² + 7x + 12 = (x + 3)(x + 4)"],
    solution: "(x + 3)(x + 4)",
  }),
  q({
    id: "ex-4", conceptId: "expanding", label: "4", kind: "transfer",
    prompt: "Factorise x² − 9.",
    expected: [{ text: "(x-3)(x+3)" }],
    nudge: "There is no x term. That is a clue, not a problem.",
    hint: "This is a difference of two squares: a² − b² = (a − b)(a + b).",
    explain: "x² − 9 is x² − 3². The two middle terms cancel when you expand (x − 3)(x + 3), which is exactly why there is no x term to begin with.",
    steps: ["x² − 9 = x² − 3²", "a² − b² = (a − b)(a + b)", "= (x − 3)(x + 3)"],
    solution: "(x − 3)(x + 3)",
  }),

  // ------------------------------------------------------------- quadratics
  q({
    id: "qu-1", conceptId: "quadratics", label: "1",
    prompt: "Solve x² − 5x + 6 = 0.",
    expected: [{ text: "{2,3}", shape: "set" }],
    nudge: "Get it to a product equal to zero.",
    hint: "Factorise the left-hand side, then use: if AB = 0 then A = 0 or B = 0.",
    explain: "Factorising turns one hard equation into two easy ones. The zero on the right is what makes it work — a product is zero only when a factor is zero.",
    steps: ["Two numbers with product 6 and sum −5: −2 and −3.", "(x − 2)(x − 3) = 0", "x − 2 = 0 or x − 3 = 0", "x = 2 or x = 3"],
    solution: "x = 2 or x = 3",
  }),
  q({
    id: "qu-2", conceptId: "quadratics", label: "2",
    prompt: "Solve x² + 2x − 15 = 0.",
    expected: [{ text: "{3,-5}", shape: "set" }],
    nudge: "Product is negative, so the two numbers have different signs.",
    hint: "Which two numbers multiply to −15 and add to +2?",
    explain: "A negative constant term always means one positive and one negative root. +5 and −3 give a sum of +2 — so the factors are (x + 5)(x − 3), and the roots flip sign from the factors.",
    steps: ["Product −15, sum +2 → +5 and −3.", "(x + 5)(x − 3) = 0", "x = −5 or x = 3"],
    solution: "x = 3 or x = −5",
  }),
  q({
    id: "qu-3", conceptId: "quadratics", label: "3",
    prompt: "Solve 2x² − 8 = 0.",
    expected: [{ text: "{2,-2}", shape: "set" }],
    nudge: "There is no x term, so you do not need to factorise a trinomial.",
    hint: "Rearrange to x² = 4, then take the square root of both sides — both roots.",
    explain: "√4 is 2, but the equation x² = 4 has two solutions, because (−2)² is also 4. Writing only x = 2 loses half the answer.",
    steps: ["2x² = 8", "x² = 4", "x = ±2", "x = 2 or x = −2"],
    solution: "x = 2 or x = −2",
  }),
  q({
    id: "qu-4", conceptId: "quadratics", label: "4", kind: "transfer",
    prompt: "Solve x² = 6x.",
    expected: [{ text: "{0,6}", shape: "set" }],
    nudge: "Resist dividing both sides by x.",
    hint: "Bring everything to one side: x² − 6x = 0, then take out the common factor x.",
    explain: "Dividing by x assumes x ≠ 0 — and here x = 0 is a solution, so dividing throws it away. Factorising never loses a root.",
    steps: ["x² − 6x = 0", "x(x − 6) = 0", "x = 0 or x − 6 = 0", "x = 0 or x = 6"],
    solution: "x = 0 or x = 6",
  }),

  // ----------------------------------------------------------- trigonometry
  q({
    id: "tr-1", conceptId: "trigonometry", label: "1",
    prompt: "A right-angled triangle has a hypotenuse of 10 cm and an angle of 30°. Find the length of the side opposite that angle, in cm.",
    expected: [{ text: "5" }],
    nudge: "Which ratio connects the opposite side to the hypotenuse?",
    hint: "sin θ = opposite ÷ hypotenuse, so opposite = 10 sin 30°.",
    explain: "sin 30° is exactly 1/2 — worth memorising. If your calculator gives −0.988, it is in radian mode.",
    steps: ["sin 30° = opp / 10", "opp = 10 × sin 30°", "sin 30° = 0.5", "opp = 5 cm"],
    solution: "5 cm",
  }),
  q({
    id: "tr-2", conceptId: "trigonometry", label: "2",
    prompt: "In a right-angled triangle the side opposite angle θ is 3 and the adjacent side is 4. Find tan θ as a fraction.",
    expected: [{ text: "3/4" }, { text: "0.75" }],
    nudge: "Order matters in the ratio.",
    hint: "tan θ = opposite ÷ adjacent.",
    explain: "tan is opposite over adjacent — the hypotenuse (5, by Pythagoras) is not involved. Writing 4/3 is the reciprocal error, and gives an angle of 53° instead of 37°.",
    steps: ["tan θ = opposite / adjacent", "= 3 / 4"],
    solution: "3/4",
  }),
  q({
    id: "tr-3", conceptId: "trigonometry", label: "3",
    prompt: "Write the exact value of sin 45°.",
    expected: [{ text: "sqrt(2)/2" }, { text: "1/sqrt(2)" }],
    nudge: "Think about a square cut along its diagonal.",
    hint: "In a right-angled isosceles triangle with legs 1, the hypotenuse is √2.",
    explain: "Halving a unit square along the diagonal gives a 45–45–90 triangle with legs 1 and hypotenuse √2, so sin 45° = 1/√2 = √2/2 ≈ 0.7071. \"Exact\" means leave the surd in.",
    steps: ["Legs 1 and 1, hypotenuse √2.", "sin 45° = opposite / hypotenuse = 1/√2", "Rationalise: = √2/2"],
    solution: "√2/2",
  }),
  q({
    id: "tr-4", conceptId: "trigonometry", label: "4", kind: "transfer",
    prompt: "cos θ = 0.5 and θ is between 0° and 90°. Find θ in degrees.",
    expected: [{ text: "60" }],
    nudge: "You need the inverse operation this time.",
    hint: "θ = cos⁻¹(0.5). Make sure the calculator is in degrees.",
    explain: "cos 60° = 1/2 — the same 30–60–90 triangle as question 1, read the other way round. If you got 1.047, that is the answer in radians.",
    steps: ["θ = cos⁻¹(0.5)", "In a 30–60–90 triangle, adjacent/hypotenuse = 1/2 at 60°.", "θ = 60°"],
    solution: "60°",
  }),

  // ----------------------------------------------------------------- units
  q({
    id: "un-1", conceptId: "units", label: "1",
    prompt: "Convert 72 km/h to m/s. Give the number only.",
    expected: [{ text: "20" }],
    nudge: "Two conversions are happening at once — distance and time.",
    hint: "1 km = 1000 m and 1 h = 3600 s, so divide by 3.6.",
    explain: "72 × 1000 ÷ 3600 = 20. The ÷3.6 shortcut is just 3600/1000 done once. Sanity check: m/s numbers are always smaller than the km/h ones.",
    steps: ["72 km = 72 000 m", "1 hour = 3600 s", "72 000 / 3600 = 20", "= 20 m/s"],
    solution: "20 m/s",
  }),
  q({
    id: "un-2", conceptId: "units", label: "2",
    prompt: "Convert 2.5 kg to grams. Give the number only.",
    expected: [{ text: "2500" }],
    nudge: "Are you expecting a bigger number or a smaller one?",
    hint: "1 kg = 1000 g, and grams are smaller, so the number gets bigger.",
    explain: "Going to a smaller unit means more of them. Deciding whether the answer should grow or shrink *before* you calculate catches almost every ×/÷ slip.",
    steps: ["1 kg = 1000 g", "2.5 × 1000 = 2500", "= 2500 g"],
    solution: "2500 g",
  }),
  q({
    id: "un-3", conceptId: "units", label: "3",
    prompt: "A car travels 150 km in 2.5 hours. Find the average speed in km/h.",
    expected: [{ text: "60" }],
    nudge: "The unit km/h tells you the operation.",
    hint: "speed = distance ÷ time.",
    explain: "The unit is the formula: \"km per hour\" is kilometres divided by hours. Reading the unit is often faster than recalling the triangle.",
    steps: ["speed = distance / time", "= 150 / 2.5", "= 60 km/h"],
    solution: "60 km/h",
  }),
  q({
    id: "un-4", conceptId: "units", label: "4", kind: "transfer",
    prompt: "A tap fills a 0.75 m³ tank in 5 minutes. Find the flow rate in litres per second.",
    expected: [{ text: "2.5" }],
    nudge: "Convert the volume and the time before you divide.",
    hint: "1 m³ = 1000 litres and 5 minutes = 300 seconds.",
    explain: "Convert both quantities into the units the answer asks for, then divide once. 750 litres ÷ 300 s = 2.5 L/s.",
    steps: ["0.75 m³ = 750 litres", "5 min = 300 s", "750 / 300 = 2.5", "= 2.5 L/s"],
    solution: "2.5 L/s",
  }),
];

export const WORKSHEETS = [
  { id: "ws-fractions", title: "Fractions", conceptIds: ["fractions"], questionIds: ["fr-1", "fr-2", "fr-3", "fr-4"] },
  { id: "ws-linear", title: "Linear equations", conceptIds: ["linear-equations"], questionIds: ["li-1", "li-2", "li-3", "li-4"] },
  { id: "ws-expanding", title: "Expanding and factorising", conceptIds: ["expanding"], questionIds: ["ex-1", "ex-2", "ex-3", "ex-4"] },
  { id: "ws-quadratics", title: "Quadratic equations", conceptIds: ["quadratics"], questionIds: ["qu-1", "qu-2", "qu-3", "qu-4"] },
  { id: "ws-trig", title: "Right-angled trigonometry", conceptIds: ["trigonometry"], questionIds: ["tr-1", "tr-2", "tr-3", "tr-4"] },
  { id: "ws-units", title: "Units and rates", conceptIds: ["units"], questionIds: ["un-1", "un-2", "un-3", "un-4"] },
];

export const questionById = Object.fromEntries(QUESTIONS.map((x) => [x.id, x]));
export const conceptById = Object.fromEntries(CONCEPTS.map((c) => [c.id, c]));
export const worksheetById = Object.fromEntries(WORKSHEETS.map((w) => [w.id, w]));
