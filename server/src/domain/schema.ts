/**
 * A tiny runtime schema system with no dependencies.
 *
 * One declaration produces two things that must never disagree: the JSON Schema handed
 * to the model as its required output shape, and the validator that checks what came
 * back. Keeping them in separate files is how a gateway ends up trusting a field the
 * model was never asked for.
 */

export type Schema =
  | { kind: "string"; enum?: readonly string[]; minLength?: number; maxLength?: number; description?: string }
  | { kind: "number"; min?: number; max?: number; integer?: boolean; description?: string }
  | { kind: "boolean"; description?: string }
  | { kind: "null" }
  | { kind: "array"; items: Schema; minItems?: number; maxItems?: number; description?: string }
  | { kind: "object"; properties: Record<string, Schema>; required: readonly string[]; description?: string }
  | { kind: "optional"; inner: Schema }
  | { kind: "union"; options: readonly Schema[]; description?: string };

export const S = {
  string: (o: Omit<Extract<Schema, { kind: "string" }>, "kind"> = {}): Schema => ({ kind: "string", ...o }),
  enum: <T extends string>(values: readonly T[], description?: string): Schema =>
    ({ kind: "string", enum: values, description }),
  number: (o: Omit<Extract<Schema, { kind: "number" }>, "kind"> = {}): Schema => ({ kind: "number", ...o }),
  int: (o: Omit<Extract<Schema, { kind: "number" }>, "kind" | "integer"> = {}): Schema =>
    ({ kind: "number", integer: true, ...o }),
  bool: (description?: string): Schema => ({ kind: "boolean", description }),
  array: (items: Schema, o: { minItems?: number; maxItems?: number; description?: string } = {}): Schema =>
    ({ kind: "array", items, ...o }),
  object: (properties: Record<string, Schema>, required: readonly string[], description?: string): Schema =>
    ({ kind: "object", properties, required, description }),
  optional: (inner: Schema): Schema => ({ kind: "optional", inner }),
  union: (options: readonly Schema[], description?: string): Schema => ({ kind: "union", options, description }),
};

export interface ValidationIssue { path: string; message: string; }

export type ValidationResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

function check(schema: Schema, value: unknown, path: string, issues: ValidationIssue[]): unknown {
  const fail = (message: string) => { issues.push({ path: path || "$", message }); return undefined; };

  switch (schema.kind) {
    case "optional":
      if (value === undefined || value === null) return undefined;
      return check(schema.inner, value, path, issues);

    case "null":
      return value === null ? null : fail("expected null");

    case "string": {
      if (typeof value !== "string") return fail(`expected a string, got ${typeof value}`);
      if (schema.enum && !schema.enum.includes(value)) {
        return fail(`expected one of ${schema.enum.join(", ")}, got ${JSON.stringify(value)}`);
      }
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return fail(`shorter than ${schema.minLength} characters`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return fail(`longer than ${schema.maxLength} characters`);
      }
      return value;
    }

    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return fail("expected a finite number");
      }
      if (schema.integer && !Number.isInteger(value)) return fail("expected a whole number");
      if (schema.min !== undefined && value < schema.min) return fail(`below the minimum ${schema.min}`);
      if (schema.max !== undefined && value > schema.max) return fail(`above the maximum ${schema.max}`);
      return value;
    }

    case "boolean":
      return typeof value === "boolean" ? value : fail("expected true or false");

    case "array": {
      if (!Array.isArray(value)) return fail("expected an array");
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        return fail(`expected at least ${schema.minItems} items`);
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        return fail(`expected at most ${schema.maxItems} items`);
      }
      return value.map((item, i) => check(schema.items, item, `${path}[${i}]`, issues));
    }

    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return fail("expected an object");
      }
      const src = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of schema.required) {
        if (!(key in src) || src[key] === undefined) {
          issues.push({ path: `${path}.${key}`, message: "is required" });
          continue;
        }
      }
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (!(key in src)) continue;
        const got = check(sub, src[key], `${path}.${key}`, issues);
        if (got !== undefined) out[key] = got;
      }
      // Unknown keys are dropped rather than rejected: a model adding a field is not a
      // reason to fail a whole reply, but it is never a reason to pass it through either.
      return out;
    }

    case "union": {
      for (const option of schema.options) {
        const local: ValidationIssue[] = [];
        const got = check(option, value, path, local);
        if (local.length === 0) return got;
      }
      return fail("did not match any allowed shape");
    }
  }
}

export function validate<T = unknown>(schema: Schema, value: unknown): ValidationResult<T> {
  const issues: ValidationIssue[] = [];
  const out = check(schema, value, "", issues);
  return issues.length ? { ok: false, issues } : { ok: true, value: out as T };
}

/** The same declaration, in the form a model is told to produce. */
export function toJSONSchema(schema: Schema): Record<string, unknown> {
  switch (schema.kind) {
    case "optional": return toJSONSchema(schema.inner);
    case "null": return { type: "null" };
    case "string": {
      const out: Record<string, unknown> = { type: "string" };
      if (schema.enum) out["enum"] = schema.enum;
      if (schema.minLength !== undefined) out["minLength"] = schema.minLength;
      if (schema.maxLength !== undefined) out["maxLength"] = schema.maxLength;
      if (schema.description) out["description"] = schema.description;
      return out;
    }
    case "number": {
      const out: Record<string, unknown> = { type: schema.integer ? "integer" : "number" };
      if (schema.min !== undefined) out["minimum"] = schema.min;
      if (schema.max !== undefined) out["maximum"] = schema.max;
      if (schema.description) out["description"] = schema.description;
      return out;
    }
    case "boolean": {
      const out: Record<string, unknown> = { type: "boolean" };
      if (schema.description) out["description"] = schema.description;
      return out;
    }
    case "array": {
      const out: Record<string, unknown> = { type: "array", items: toJSONSchema(schema.items) };
      if (schema.minItems !== undefined) out["minItems"] = schema.minItems;
      if (schema.maxItems !== undefined) out["maxItems"] = schema.maxItems;
      if (schema.description) out["description"] = schema.description;
      return out;
    }
    case "object": {
      const properties: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(schema.properties)) properties[k] = toJSONSchema(v);
      const out: Record<string, unknown> = {
        type: "object", properties, required: [...schema.required], additionalProperties: false,
      };
      if (schema.description) out["description"] = schema.description;
      return out;
    }
    case "union":
      return { anyOf: schema.options.map(toJSONSchema) };
  }
}

export function describeIssues(issues: readonly ValidationIssue[]): string {
  return issues.map((i) => `${i.path}: ${i.message}`).join("; ");
}
