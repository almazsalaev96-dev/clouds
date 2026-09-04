/** Expression trees. Small on purpose: everything downstream pattern-matches on these. */

export type Node =
  | { kind: "num"; value: number }
  | { kind: "var"; name: string }
  | { kind: "neg"; arg: Node }
  | { kind: "bin"; op: "+" | "-" | "*" | "/" | "^" | "%"; left: Node; right: Node }
  | { kind: "call"; name: string; args: Node[] }
  | { kind: "rel"; op: "=" | "<" | ">" | "<=" | ">=" | "!="; left: Node; right: Node }
  | { kind: "list"; items: Node[] };

export const num = (value: number): Node => ({ kind: "num", value });
export const v = (name: string): Node => ({ kind: "var", name });
export const bin = (op: Extract<Node, { kind: "bin" }>["op"], left: Node, right: Node): Node =>
  ({ kind: "bin", op, left, right });

export function variables(n: Node, into = new Set<string>()): Set<string> {
  switch (n.kind) {
    case "num": break;
    case "var": into.add(n.name); break;
    case "neg": variables(n.arg, into); break;
    case "bin": case "rel": variables(n.left, into); variables(n.right, into); break;
    case "call": n.args.forEach((a) => variables(a, into)); break;
    case "list": n.items.forEach((a) => variables(a, into)); break;
  }
  return into;
}

export function isRelation(n: Node): n is Extract<Node, { kind: "rel" }> {
  return n.kind === "rel";
}

/** Readable form, used in explanations and test failures rather than for round-tripping. */
export function toText(n: Node): string {
  switch (n.kind) {
    case "num": return String(n.value);
    case "var": return n.name;
    case "neg": return `-${toText(n.arg)}`;
    case "bin": return `(${toText(n.left)} ${n.op} ${toText(n.right)})`;
    case "call": return `${n.name}(${n.args.map(toText).join(", ")})`;
    case "rel": return `${toText(n.left)} ${n.op} ${toText(n.right)}`;
    case "list": return n.items.map(toText).join(", ");
  }
}
