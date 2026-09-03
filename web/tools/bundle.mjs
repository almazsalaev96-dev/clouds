/**
 * A very small ES-module bundler.
 *
 * The point of this file is that the browser build runs the *same* code as the
 * gateway and the reference engine — the grader is `server/src/grading/*.ts`
 * itself, type-stripped, not a second implementation that drifts.  So the
 * bundler has to be trustworthy rather than clever: it understands exactly the
 * handful of import/export forms this repository uses and throws on anything
 * else, so an unsupported form fails the build instead of silently producing a
 * module with missing exports.
 */
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, resolve } from "node:path";

const IMPORT_NS = /^import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+"([^"]+)";?\s*$/;
const IMPORT_NAMED = /^import\s*\{([^}]*)\}\s*from\s+"([^"]+)";?\s*$/;
const IMPORT_BARE = /^import\s+"([^"]+)";?\s*$/;
const EXPORT_NS = /^export\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+"([^"]+)";?\s*$/;
const EXPORT_DECL = /^export\s+(?:(?:async\s+)?function\s*\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/;

/** Collapse a statement that may be spread over several lines onto one line. */
function joinStatements(source) {
  const lines = source.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i];
    if (/^(import|export)\b/.test(line.trim()) && !/;\s*$/.test(line) && !/^export\s+(?:(?:async\s+)?function|class|const|let|var|default)\b/.test(line.trim())) {
      const start = i;
      while (i + 1 < lines.length && !/;\s*$/.test(lines[i])) {
        i += 1;
        line += " " + lines[i].trim();
      }
      if (i === start) { /* single line without a semicolon */ }
      out.push(line.replace(/\s+/g, " "));
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

function moduleId(path) {
  return path.replace(/\\/g, "/").replace(/^.*\/(web|server)\/src\//, "").replace(/\.(ts|js)$/, "");
}

function loadModule(path, seen, order, modules) {
  const id = moduleId(path);
  if (seen.has(id)) return id;
  seen.add(id);

  let source = readFileSync(path, "utf8");
  if (path.endsWith(".ts")) {
    source = stripTypeScriptTypes(source, { mode: "strip", sourceMap: false });
  }
  source = joinStatements(source);

  const deps = [];
  const exports = new Set();
  const body = [];

  for (const raw of source.split("\n")) {
    const line = raw.trim();

    if (line === "" || !/^(import|export)\b/.test(line)) {
      body.push(raw);
      continue;
    }

    let m;
    if ((m = IMPORT_NS.exec(line))) {
      const dep = resolveDep(path, m[2], seen, order, modules);
      deps.push(dep);
      body.push(`const ${m[1]} = __req(${JSON.stringify(dep)});`);
      continue;
    }
    if ((m = IMPORT_NAMED.exec(line))) {
      const names = m[1].split(",").map((s) => s.trim()).filter(Boolean);
      if (names.length === 0) { body.push(""); continue; } // type-only import, erased
      const dep = resolveDep(path, m[2], seen, order, modules);
      deps.push(dep);
      const binding = names.map((n) => n.replace(/^(\S+)\s+as\s+(\S+)$/, "$1: $2")).join(", ");
      body.push(`const { ${binding} } = __req(${JSON.stringify(dep)});`);
      continue;
    }
    if ((m = IMPORT_BARE.exec(line))) {
      deps.push(resolveDep(path, m[1], seen, order, modules));
      body.push("");
      continue;
    }
    if ((m = EXPORT_NS.exec(line))) {
      const dep = resolveDep(path, m[2], seen, order, modules);
      deps.push(dep);
      body.push(`const ${m[1]} = __req(${JSON.stringify(dep)});`);
      exports.add(m[1]);
      continue;
    }
    if ((m = EXPORT_DECL.exec(line))) {
      exports.add(m[1]);
      body.push(raw.replace(/^(\s*)export\s+/, "$1"));
      continue;
    }
    throw new Error(`${path}: unsupported module syntax:\n  ${line}`);
  }

  const names = [...exports];
  body.push(`Object.assign(__x, { ${names.join(", ")} });`);
  modules.set(id, { id, deps, code: body.join("\n") });
  order.push(id);
  return id;
}

function resolveDep(fromPath, spec, seen, order, modules) {
  if (!spec.startsWith(".")) throw new Error(`${fromPath}: bare specifier "${spec}" is not bundled`);
  const base = resolve(dirname(fromPath), spec);
  const candidates = [base, base.replace(/\.ts$/, ".js"), base.replace(/\.js$/, ".ts")];
  for (const candidate of candidates) {
    try {
      readFileSync(candidate);
      return loadModule(candidate, seen, order, modules);
    } catch (err) {
      if (err.code !== "ENOENT" && err.code !== "EISDIR") throw err;
    }
  }
  throw new Error(`${fromPath}: cannot resolve "${spec}"`);
}

export function bundle(entries) {
  const seen = new Set();
  const order = [];
  const modules = new Map();
  const roots = entries.map((e) => loadModule(resolve(e), seen, order, modules));

  const parts = [
    "(function () {",
    '"use strict";',
    "const __registry = Object.create(null);",
    "const __cache = Object.create(null);",
    "function __def(id, fn) { __registry[id] = fn; }",
    "function __req(id) {",
    "  if (id in __cache) return __cache[id];",
    "  const fn = __registry[id];",
    "  if (!fn) throw new Error('module not bundled: ' + id);",
    "  const x = (__cache[id] = {});",
    "  fn(x, __req);",
    "  return x;",
    "}",
  ];
  for (const id of order) {
    const mod = modules.get(id);
    parts.push(`__def(${JSON.stringify(id)}, function (__x, __req) {`, mod.code, "});");
  }
  parts.push(`__req(${JSON.stringify(roots[roots.length - 1])});`);
  parts.push("})();");
  return parts.join("\n");
}
