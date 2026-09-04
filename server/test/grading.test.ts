import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { grade, type ExpectedAnswer } from "../src/grading/grade.ts";
import { parse, tryParse } from "../src/grading/parse.ts";
import { toText } from "../src/grading/ast.ts";
import { parseUnit, sameDimension, splitQuantity } from "../src/grading/units.ts";
import { normalise } from "../src/grading/tokenize.ts";

const exp = (text: string, extra: Partial<ExpectedAnswer> = {}): ExpectedAnswer[] =>
  [{ text, ...extra }];

const verdict = (submitted: string, expected: string, extra: Partial<ExpectedAnswer> = {}) =>
  grade(submitted, exp(expected, extra)).verdict;

describe("tokenizer normalisation", () => {
  it("folds the characters students actually type", () => {
    assert.equal(normalise("2 × 3 − 1"), "2 * 3 - 1");
    assert.equal(normalise("x² + 1"), "x^2 + 1");
    // The space is load-bearing: without it the lexer reads one identifier "sqrt2".
    assert.equal(normalise("√2"), "sqrt 2");
    assert.equal(normalise("2π"), "2pi");
    assert.equal(normalise("a ≤ b"), "a <= b");
    assert.equal(normalise("x¹²"), "x^12");
  });
});

describe("parser", () => {
  it("reads implicit multiplication the way it is written", () => {
    assert.equal(toText(parse("2x")), "(2 * x)");
    assert.equal(toText(parse("3(x+1)")), "(3 * (x + 1))");
    assert.equal(toText(parse("(x+1)(x+2)")), "((x + 1) * (x + 2))");
    assert.equal(toText(parse("xy")), "(x * y)");
  });

  it("keeps exponentiation right-associative", () => {
    assert.equal(toText(parse("2^3^2")), "(2 ^ (3 ^ 2))");
  });

  it("binds unary minus below powers", () => {
    assert.equal(toText(parse("-x^2")), "-(x ^ 2)");
  });

  it("treats word variables as one symbol but letters as a product", () => {
    assert.equal(toText(parse("theta")), "theta");
    assert.equal(toText(parse("abc")), "((a * b) * c)");
  });

  it("accepts functions with and without brackets", () => {
    assert.equal(toText(parse("sin x")), "sin(x)");
    assert.equal(toText(parse("sqrt(9)")), "sqrt(9)");
  });

  it("reads postfix percent and factorial", () => {
    assert.equal(toText(parse("50%")), "(50 * 0.01)");
    assert.equal(toText(parse("5!")), "fact(5)");
  });

  it("refuses to guess at nonsense", () => {
    assert.equal(tryParse("2 +").ok, false);
    assert.equal(tryParse("((x)").ok, false);
  });
});

describe("numeric answers", () => {
  it("accepts equal values written differently", () => {
    assert.equal(verdict("1.5", "3/2"), "correct");
    assert.equal(verdict("0.5", "1/2"), "correct");
    assert.equal(verdict("-1.5", "-3/2"), "correct");
    assert.equal(verdict("2.0", "2"), "correct");
    assert.equal(verdict("1/4 + 1/4", "0.5"), "correct");
  });

  it("rejects different values", () => {
    assert.equal(verdict("1.4", "3/2"), "incorrect");
    assert.equal(verdict("17.4", "17.5"), "incorrect");
  });

  it("honours a stated tolerance", () => {
    assert.equal(verdict("3.14", "pi"), "incorrect");
    assert.equal(verdict("3.14", "pi", { tolerance: { relative: 1e-3 } }), "correct");
  });

  it("evaluates arithmetic the student left unsimplified", () => {
    assert.equal(verdict("(2+3)*4", "20"), "correct");
    assert.equal(verdict("2^10", "1024"), "correct");
    assert.equal(verdict("sqrt(16)", "4"), "correct");
  });
});

describe("algebraic expressions", () => {
  it("accepts any equivalent rearrangement", () => {
    assert.equal(verdict("(x+1)(x+2)", "x^2+3x+2"), "correct");
    assert.equal(verdict("x^2+3x+2", "(x+2)(x+1)"), "correct");
    assert.equal(verdict("2(x+3)", "2x+6"), "correct");
    assert.equal(verdict("(x-3)^2 - 4", "x^2 - 6x + 5"), "correct");
  });

  it("catches the classic sign slip", () => {
    assert.equal(verdict("x^2-3x+2", "x^2+3x+2"), "incorrect");
  });

  it("handles trigonometric identities", () => {
    assert.equal(verdict("sin(x)^2 + cos(x)^2", "1"), "correct");
    assert.equal(verdict("2 sin(x) cos(x)", "sin(2x)"), "correct");
  });

  it("handles logarithm and exponential identities", () => {
    assert.equal(verdict("ln(x) + ln(y)", "ln(x*y)"), "correct");
    assert.equal(verdict("exp(ln(x))", "x"), "correct");
  });

  it("does not confuse different variables", () => {
    assert.equal(verdict("2y", "2x"), "incorrect");
  });

  it("abstains rather than marking symbols wrong against a numeric answer", () => {
    // Sampling `y` at random points and calling it "not 5" would report a
    // knowledge failure that the evidence does not support.
    assert.equal(verdict("y", "5"), "abstain");
    assert.equal(verdict("banana", "5"), "abstain");
    assert.equal(verdict("x + 1", "5"), "abstain");
    // Still decidable, and still right, when the answer is a number.
    assert.equal(verdict("x = 5", "5"), "correct");
    assert.equal(verdict("6", "5"), "incorrect");
  });
});

describe("equations", () => {
  it("treats a scaled equation as the same equation", () => {
    assert.equal(verdict("2x + 4 = 0", "x + 2 = 0"), "correct");
    assert.equal(verdict("y = 2x + 1", "2x - y + 1 = 0"), "correct");
  });

  it("rejects a genuinely different equation", () => {
    assert.equal(verdict("x = 3", "x = 2"), "incorrect");
    assert.equal(verdict("y = 2x + 2", "y = 2x + 1"), "incorrect");
  });

  it("accepts a bare value where an equation was expected", () => {
    assert.equal(verdict("5", "x = 5"), "correct");
    assert.equal(verdict("x = 5", "5"), "correct");
  });
});

describe("solution sets", () => {
  it("ignores the order and the notation", () => {
    assert.equal(verdict("-3, 2", "2, -3"), "correct");
    assert.equal(verdict("{2, -3}", "2, -3"), "correct");
    assert.equal(verdict("x = 2, x = -3", "2, -3"), "correct");
  });

  it("notices a missing root", () => {
    assert.equal(verdict("2", "2, -3"), "incorrect");
  });

  it("notices a wrong root", () => {
    assert.equal(verdict("2, 3", "2, -3"), "incorrect");
  });
});

describe("units", () => {
  it("parses compound units", () => {
    assert.ok(parseUnit("m/s^2"));
    assert.ok(parseUnit("kg m s^-2"));
    assert.ok(sameDimension(parseUnit("N")!.dim, parseUnit("kg m/s^2")!.dim));
    assert.ok(sameDimension(parseUnit("J")!.dim, parseUnit("N m")!.dim));
    assert.equal(parseUnit("bananas"), null);
  });

  it("splits a magnitude from its unit", () => {
    assert.deepEqual(splitQuantity("9.81 m/s^2"), { magnitudeText: "9.81", unitText: "m/s^2" });
    assert.deepEqual(splitQuantity("2x"), { magnitudeText: "2x", unitText: null });
  });

  it("converts before comparing", () => {
    assert.equal(verdict("1500 m", "1.5 km", { unit: "km" }), "correct");
    assert.equal(verdict("0.5 kg", "500 g", { unit: "g" }), "correct");
  });

  it("marks the right number in the wrong unit as wrong, and says so", () => {
    const r = grade("9.81 m/s", exp("9.81 m/s^2", { unit: "m/s^2" }));
    assert.equal(r.verdict, "incorrect");
    assert.equal(r.nearMiss?.kind, "unitMismatch");
  });

  it("flags a missing unit without calling the work wrong", () => {
    const r = grade("9.81", exp("9.81 m/s^2", { unit: "m/s^2" }));
    assert.equal(r.verdict, "partiallyCorrect");
    assert.equal(r.nearMiss?.kind, "missingUnit");
  });
});

describe("near-miss diagnosis", () => {
  const near = (submitted: string, expected: string) =>
    grade(submitted, exp(expected)).nearMiss?.kind;

  it("names a sign flip", () => {
    assert.equal(near("-4", "4"), "signFlipped");
    assert.equal(near("-(x+1)", "x+1"), "signFlipped");
  });

  it("names a factor of ten", () => {
    assert.equal(near("48", "4.8"), "offByFactor");
    assert.equal(near("0.48", "4.8"), "offByFactor");
  });

  it("names an inverted fraction", () => {
    assert.equal(near("4/3", "3/4"), "reciprocal");
  });

  it("names a value that was squared when it should not have been", () => {
    assert.equal(near("16", "4"), "squared");
  });

  it("names a value that needed squaring", () => {
    assert.equal(near("4", "16"), "squareRooted");
  });

  it("names degree/radian confusion", () => {
    assert.equal(near("57.29577951308232", "1"), "degreesForRadians");
  });

  it("returns nothing when the answer is simply wrong", () => {
    assert.equal(near("7", "4"), undefined);
  });
});

describe("significant figures", () => {
  it("accepts an exact answer", () => {
    assert.equal(verdict("0.333333333", "1/3", {
      tolerance: { relative: 1e-6 }, significantFigures: 3 }), "correct");
  });

  it("flags under-rounding as partial, not wrong", () => {
    const r = grade("0.3", exp("1/3", {
      tolerance: { relative: 0.2 }, significantFigures: 3 }));
    assert.equal(r.verdict, "partiallyCorrect");
    assert.equal(r.nearMiss?.kind, "roundingOnly");
  });
});

describe("abstaining", () => {
  it("says nothing about prose", () => {
    const r = grade("Because the forces balance", exp("The forces are balanced", { shape: "text" }));
    assert.equal(r.verdict, "abstain");
  });

  it("declines rather than guessing at unreadable input", () => {
    assert.equal(grade("2 +++", exp("4")).verdict, "abstain");
  });

  it("treats an empty answer as nothing to mark", () => {
    assert.equal(grade("   ", exp("4")).verdict, "abstain");
  });
});

describe("any-of acceptable answers", () => {
  it("accepts a match against any listed form", () => {
    const r = grade("0.5", [{ text: "1/2" }, { text: "0.5" }]);
    assert.equal(r.verdict, "correct");
  });

  it("reports which form matched", () => {
    const r = grade("2, -3", [{ text: "x = 1" }, { text: "-3, 2" }]);
    assert.equal(r.verdict, "correct");
    assert.equal(r.matchedIndex, 1);
  });
});

describe("how students actually write answers", () => {
  // Every case here was a wrong verdict before it was a test. They are all the same
  // failure: a correct answer marked incorrect because of notation.
  it("accepts 'or' and 'and' between values", () => {
    assert.equal(verdict("3 or -2", "3, -2"), "correct");
    assert.equal(verdict("x = 3 or x = -2", "3, -2"), "correct");
    assert.equal(verdict("x = 3 and y = 4", "x = 3, y = 4"), "correct");
  });

  it("reads a unicode root applied straight to a number", () => {
    assert.equal(verdict("√9", "3"), "correct");
    assert.equal(verdict("√(x+1)", "sqrt(x+1)"), "correct");
    assert.equal(verdict("2√3", "2*sqrt(3)"), "correct");
  });

  it("reads a thousands separator when the answer is one number", () => {
    assert.equal(verdict("1,000", "1000"), "correct");
    assert.equal(verdict("1,234,567", "1234567"), "correct");
  });

  it("does not mistake a solution set for a thousands separator", () => {
    // The dangerous direction: merging the roots 2 and 300 into 2300.
    assert.equal(verdict("2, 300", "2, 300"), "correct");
    assert.equal(verdict("2,300", "2, 300"), "incorrect");
  });

  it("reads a mixed number as a mixed number", () => {
    // Reading "2 1/2" as 2 x 1/2 = 1 would silently mark a correct answer wrong.
    assert.equal(verdict("2 1/2", "2.5"), "correct");
    assert.equal(verdict("-3 3/4", "-3.75"), "correct");
  });

  it("still reads juxtaposition as multiplication where that is what it is", () => {
    assert.equal(verdict("2 x", "2*x"), "correct");
    assert.equal(verdict("2(1/2)", "1"), "correct");
  });

  it("recognises an angle answered in degrees", () => {
    const r = grade("sin(30)", exp("0.5"));
    assert.equal(r.verdict, "incorrect", "it is genuinely wrong in radians");
    assert.equal(r.nearMiss?.kind, "degreesForRadians");
    assert.ok(r.nearMiss!.detail.includes("degrees"));
  });

  it("does not cry degrees over an ordinary wrong answer", () => {
    assert.equal(grade("sin(1.2)", exp("0.5")).nearMiss?.kind, undefined);
  });

  it("handles the notation a calculator produces", () => {
    assert.equal(verdict("3.0e2", "300"), "correct");
    assert.equal(verdict("1e-3", "0.001"), "correct");
    assert.equal(verdict("2^-1", "0.5"), "correct");
  });

  it("is unbothered by spacing and redundant signs", () => {
    assert.equal(verdict("- 4", "-4"), "correct");
    assert.equal(verdict("+5", "5"), "correct");
    assert.equal(verdict("-(-5)", "5"), "correct");
  });
});

describe("determinism", () => {
  it("gives the same verdict every time", () => {
    for (let i = 0; i < 25; i++) {
      assert.equal(verdict("(x+1)(x+2)", "x^2+3x+2"), "correct");
      assert.equal(verdict("x^2+3x+3", "x^2+3x+2"), "incorrect");
    }
  });
});
