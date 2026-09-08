/**
 * The schema, in one place.
 *
 * `server/db.js` opens it on node:sqlite; the browser preview opens the same DDL on a
 * SQL engine compiled to JavaScript. One definition, so the two cannot drift.
 */
export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, board TEXT NOT NULL, syllabus TEXT NOT NULL,
  title TEXT NOT NULL, exam_date TEXT, target_grade TEXT, pack_version TEXT NOT NULL,
  created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, pack TEXT NOT NULL, syllabus_point TEXT NOT NULL, paper TEXT NOT NULL,
  command_word TEXT NOT NULL, tariff INTEGER NOT NULL, kind TEXT NOT NULL,
  stem TEXT NOT NULL, stimulus TEXT, scheme_id TEXT, difficulty REAL DEFAULT 0.5);

CREATE TABLE IF NOT EXISTS schemes (id TEXT PRIMARY KEY, pack TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS syllabus (
  id TEXT PRIMARY KEY, pack TEXT NOT NULL, code TEXT NOT NULL, title TEXT NOT NULL,
  paper TEXT NOT NULL, weight REAL DEFAULT 1, parent TEXT);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY, course_id TEXT NOT NULL, item_id TEXT NOT NULL, user_id TEXT NOT NULL,
  body TEXT NOT NULL, mode TEXT NOT NULL, entry_rung INTEGER NOT NULL DEFAULT 0,
  max_rung INTEGER NOT NULL DEFAULT 0, seen_solution INTEGER NOT NULL DEFAULT 0,
  confidence INTEGER, seconds INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS turns (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL, course_id TEXT, item_id TEXT,
  role TEXT NOT NULL, body TEXT NOT NULL, rung INTEGER, intent TEXT, handback TEXT,
  gate TEXT, lint TEXT, model TEXT, cost REAL, ttft_ms INTEGER, created_at TEXT NOT NULL);

-- Titles only. The conversation list is derived from turns, so a thread nobody
-- renamed still appears; this table has nothing to say about whether it exists.
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT, title TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

-- What a turn made. A deck of cards, a question to attempt, the mark on an answer:
-- the chat is where these happen, so the thread has to be able to show them again
-- when it is reopened. The body column holds the artefact as the client reads it.
CREATE TABLE IF NOT EXISTS artefacts (
  id TEXT PRIMARY KEY, turn_id TEXT NOT NULL, session_id TEXT NOT NULL, course_id TEXT,
  kind TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS marks (
  id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL, item_id TEXT NOT NULL, course_id TEXT NOT NULL,
  body TEXT NOT NULL, total INTEGER NOT NULL, max INTEGER NOT NULL,
  calibration TEXT NOT NULL, model TEXT, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS learner_state (
  user_id TEXT NOT NULL, course_id TEXT NOT NULL, syllabus_point TEXT NOT NULL,
  mastery REAL NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
  unaided_marks REAL NOT NULL DEFAULT 0, unaided_max REAL NOT NULL DEFAULT 0,
  last_seen TEXT, misconceptions TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, course_id, syllabus_point));

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT NOT NULL, syllabus_point TEXT NOT NULL,
  front TEXT NOT NULL, back TEXT NOT NULL, source TEXT NOT NULL,
  stability REAL NOT NULL DEFAULT 0, difficulty REAL NOT NULL DEFAULT 5,
  due TEXT NOT NULL, reps INTEGER NOT NULL DEFAULT 0, lapses INTEGER NOT NULL DEFAULT 0,
  last_review TEXT, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, user_id TEXT, course_id TEXT, kind TEXT NOT NULL,
  data TEXT NOT NULL, created_at TEXT NOT NULL);

CREATE INDEX IF NOT EXISTS idx_items_point ON items(pack, syllabus_point);
CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_artefacts_session ON artefacts(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(user_id, course_id, due);
CREATE INDEX IF NOT EXISTS idx_attempts_course ON attempts(course_id, created_at);
`
