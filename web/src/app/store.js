/**
 * The log, and everything derived from it.
 *
 * The rule the whole product rests on: conclusions are never stored. Mastery,
 * weaknesses, misconception patterns and recommendations are recomputed from an
 * append-only event log every time they are shown. That is what makes "why am I
 * seeing this?" answerable, and what makes deletion real — remove the events and
 * the beliefs that rested on them are gone at the next projection, because there
 * is nowhere else for them to live.
 */
import * as engine from "../learning/index.js";
import { CONCEPTS, questionById } from "./bank.js";

const EVENTS_KEY = "slate.events.v1";
const INK_KEY = "slate.ink.v1";
const PREFS_KEY = "slate.prefs.v1";
const SCHEMA = 1;

let events = [];
let ink = {};           // documentId -> pageIndex -> stroke[]
let prefs = {};
let listeners = [];
let dirty = false;

const now = () => Date.now();
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    // A full quota must not silently drop a student's work.
    notify({ type: "storageError", message: String(err && err.name || err) });
    return false;
  }
}

export function load() {
  const stored = readJSON(EVENTS_KEY, null);
  events = stored && stored.schema === SCHEMA && Array.isArray(stored.events) ? stored.events : [];
  ink = readJSON(INK_KEY, {}) || {};
  prefs = readJSON(PREFS_KEY, {}) || {};
}

function persist() {
  writeJSON(EVENTS_KEY, { schema: SCHEMA, events });
}

function persistInk() {
  // Coordinates are rounded on the way in; this is the only place size is bounded.
  writeJSON(INK_KEY, ink);
}

export function subscribe(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

function notify(detail) {
  for (const fn of listeners) fn(detail);
}

// ------------------------------------------------------------------ the log

export function append(event) {
  const full = { id: uid(), at: event.at ?? now(), ...event };
  events.push(full);
  persist();
  notify({ type: "append", event: full });
  return full;
}

export const allEvents = () => events.slice();

/**
 * Deletion is an event, not a hole. Redacting emits a record naming what was
 * removed, and the projection below refuses to read the redacted events — so the
 * evidence disappears from every conclusion at the next recompute.
 */
export function redact(predicate, reason) {
  const doomed = events.filter((e) => e.type !== "redaction" && predicate(e));
  if (!doomed.length) return 0;
  const ids = new Set(doomed.map((e) => e.id));
  events = events.filter((e) => !ids.has(e.id));
  events.push({ id: uid(), at: now(), type: "redaction", count: doomed.length, reason });
  persist();
  notify({ type: "redact", count: doomed.length });
  return doomed.length;
}

export function eraseEverything() {
  events = [];
  ink = {};
  try {
    localStorage.removeItem(EVENTS_KEY);
    localStorage.removeItem(INK_KEY);
  } catch { /* nothing recoverable to do */ }
  notify({ type: "erase" });
}

// ------------------------------------------------------------- the projection

/** Attempts, in the shape the learning engine expects. Derived, never stored. */
export function attempts() {
  return events
    .filter((e) => e.type === "attempt")
    .map((e) => ({
      at: e.at,
      conceptId: e.conceptId,
      questionId: e.questionId,
      outcome: e.outcome,
      errorType: e.errorType ?? null,
      assistance: e.assistance ?? "none",
      kind: e.kind ?? "practice",
      sessionId: e.sessionId,
    }));
}

export function assignments() {
  const started = new Map();
  for (const e of events) {
    if (e.type === "worksheetOpened") {
      started.set(e.assignmentId, {
        id: e.assignmentId, title: e.title, conceptIds: e.conceptIds,
        questionsTotal: e.questionsTotal, questionsDone: 0, dueAt: e.dueAt ?? null,
      });
    }
  }
  const answered = new Map();
  for (const a of attempts()) {
    const q = questionById[a.questionId];
    if (!q) continue;
    for (const [id, ws] of started) {
      if (ws.conceptIds.includes(q.conceptId)) {
        if (!answered.has(id)) answered.set(id, new Set());
        answered.get(id).add(a.questionId);
      }
    }
  }
  for (const [id, set] of answered) started.get(id).questionsDone = set.size;
  return [...started.values()];
}

let cache = null;

export function project(ctx = {}) {
  const key = `${events.length}:${Math.floor((ctx.now ?? now()) / 60_000)}:${ctx.availableMinutes ?? 30}`;
  if (cache && cache.key === key) return cache.value;
  const value = engine.project(attempts(), CONCEPTS, assignments(), {
    now: ctx.now ?? now(),
    availableMinutes: ctx.availableMinutes ?? 30,
    minutesWorked: minutesWorkedToday(ctx.now ?? now()),
    daysUntilExam: prefs.daysUntilExam ?? null,
    ...ctx,
  });
  cache = { key, value };
  return value;
}

export function invalidate() { cache = null; }

/** Minutes of actual work today, used only to notice fatigue and suggest a stop. */
export function minutesWorkedToday(at = now()) {
  const startOfDay = new Date(at); startOfDay.setHours(0, 0, 0, 0);
  const todays = events.filter((e) => e.at >= startOfDay.getTime() && e.type === "attempt");
  if (!todays.length) return 0;
  // Sum the gaps between consecutive attempts, capping any single gap: a five-hour
  // pause is not five hours of study, and counting it would fake fatigue.
  let total = 0;
  for (let i = 1; i < todays.length; i += 1) {
    total += Math.min(todays[i].at - todays[i - 1].at, 5 * 60_000);
  }
  return total / 60_000 + 1;
}

export const sessionId = uid();

// -------------------------------------------------------------------- ink

export function strokesFor(documentId, pageIndex) {
  return (ink[documentId] && ink[documentId][pageIndex]) || [];
}

export function addStroke(documentId, pageIndex, stroke) {
  if (!ink[documentId]) ink[documentId] = {};
  if (!ink[documentId][pageIndex]) ink[documentId][pageIndex] = [];
  ink[documentId][pageIndex].push(stroke);
  dirty = true;
  scheduleInkPersist();
}

export function undoStroke(documentId, pageIndex) {
  const list = ink[documentId] && ink[documentId][pageIndex];
  if (!list || !list.length) return false;
  list.pop();
  dirty = true;
  scheduleInkPersist();
  return true;
}

export function clearInk(documentId, pageIndex) {
  if (ink[documentId]) delete ink[documentId][pageIndex];
  dirty = true;
  scheduleInkPersist();
}

let inkTimer = null;
function scheduleInkPersist() {
  if (inkTimer) return;
  inkTimer = setTimeout(() => { inkTimer = null; if (dirty) { dirty = false; persistInk(); } }, 400);
}

export function flush() {
  if (inkTimer) { clearTimeout(inkTimer); inkTimer = null; }
  if (dirty) { dirty = false; persistInk(); }
}

// ------------------------------------------------------------------ prefs

export const getPref = (key, fallback = null) => (key in prefs ? prefs[key] : fallback);

export function setPref(key, value) {
  prefs[key] = value;
  writeJSON(PREFS_KEY, prefs);
  notify({ type: "pref", key, value });
}

// ----------------------------------------------------------------- export

export function exportAll() {
  return JSON.stringify({
    schema: SCHEMA,
    exportedAt: new Date().toISOString(),
    note: "Your study record. Every conclusion Slate draws is recomputed from these events.",
    events, ink, prefs,
  }, null, 2);
}

export function importAll(json) {
  const parsed = JSON.parse(json);
  if (parsed.schema !== SCHEMA || !Array.isArray(parsed.events)) throw new Error("unrecognised file");
  events = parsed.events;
  ink = parsed.ink || {};
  prefs = parsed.prefs || {};
  persist(); persistInk(); writeJSON(PREFS_KEY, prefs);
  cache = null;
  notify({ type: "import" });
}
