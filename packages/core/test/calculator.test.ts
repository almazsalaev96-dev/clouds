import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateExpression } from "../src/tools/calculator.ts";

const value = (expr: string): number => {
  const r = evaluateExpression(expr);
  assert.ok(r.ok, `expected ${expr} to evaluate, got ${r.ok ? "" : r.failure.message}`);
  return r.value;
};

test("arithmetic, precedence and associativity", () => {
  assert.equal(value("2 + 3 * 4"), 14);
  assert.equal(value("(2 + 3) * 4"), 20);
  assert.equal(value("10 - 2 - 3"), 5);          // left-associative
  assert.equal(value("2 ^ 3 ^ 2"), 512);          // right-associative
  assert.equal(value("2 ** 10"), 1024);
  assert.equal(value("-3 + 5"), 2);
  assert.equal(value("10 % 3"), 1);
  assert.equal(value("1.5e2"), 150);
});

test("the arithmetic this product actually needs", () => {
  // Price elasticity of demand: %ΔQ / %ΔP
  assert.equal(value("(-20 / 100) / (10 / 100)"), -2);
  // Gearing: non-current liabilities / capital employed
  assert.equal(round(value("340000 / 500000 * 100"), 2), 68);
  // Thousands separators in pasted figures
  assert.equal(value("1,250,000 / 1000"), 1250);
});

const round = (n: number, d: number) => Number(n.toFixed(d));

test("functions and constants", () => {
  assert.equal(value("sqrt(144)"), 12);
  assert.equal(value("max(3, 9, 2)"), 9);
  assert.equal(value("round(2.34567, 2)"), 2.35);
  assert.equal(round(value("ln(e)"), 10), 1);
  assert.equal(value("log(1000)"), 3);
  assert.equal(round(value("pi"), 5), 3.14159);
});

test("a comma is a thousands separator outside calls, a separator inside", () => {
  assert.equal(value("1,250,000 / 1000"), 1250);
  assert.equal(value("12,500 + 1,500"), 14000);
  assert.equal(value("max(1, 250)"), 250);      // two arguments, not 1250
  assert.equal(value("max(1,250)"), 250);       // still two arguments
  // Two arguments: "round 1 to 250.5 places" = 1. Read as a thousands
  // separator it would have been round(1250.5) = 1251, so 1 is the proof.
  assert.equal(value("round(1,250.5)"), 1);
});

test("float representation noise never reaches the user", () => {
  assert.equal(value("log(1000)"), 3);
  assert.equal(value("0.1 + 0.2"), 0.3);
  assert.equal(value("1.1 * 3"), 3.3);
  // ...without destroying precision the product actually needs.
  assert.equal(value("1 / 3"), 0.333333333333);
  assert.equal(value("123456789 * 2"), 246913578);
});

test("division by zero is refused rather than returning Infinity", () => {
  const r = evaluateExpression("5 / 0");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.failure.message, /divides by zero/);
});

test("code injection cannot execute — only numbers can come out", () => {
  for (const attack of [
    "process.exit(1)",
    "require('fs')",
    "globalThis",
    "constructor.constructor('return 1')()",
    "1; console.log('x')",
    "__proto__",
    "eval('2+2')",
  ]) {
    const r = evaluateExpression(attack);
    assert.equal(r.ok, false, `"${attack}" must not evaluate`);
  }
});

test("malformed input fails with a readable explanation", () => {
  for (const [expr, pattern] of [
    ["2 +", /ends unexpectedly/],
    ["(2 + 3", /closing bracket/],
    ["2 3", /unexpected content/],
    ["", /no expression/],
    ["nonesuch(2)", /not a function/],
  ] as const) {
    const r = evaluateExpression(expr);
    assert.equal(r.ok, false, `"${expr}" should fail`);
    if (!r.ok) assert.match(r.failure.message, pattern);
  }
});

test("results that are not finite numbers are refused", () => {
  assert.equal(evaluateExpression("sqrt(-1)").ok, false);
  assert.equal(evaluateExpression("ln(0)").ok, false);
});
