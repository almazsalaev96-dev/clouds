// Pack loading and first-run seeding.
// A Pack is the curriculum dataset for one syllabus version: syllabus points,
// items, mark schemes and misconceptions. seedIfEmpty() puts one in the database
// on first start and leaves it alone on every start after that.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, all, get, run, now, uid, logEvent } from '../db.js'

const here = dirname(fileURLToPath(import.meta.url))

export const PACK_NAME = '9609'
export const DEMO_USER_ID = 'u_demo'
const WEEKS_TO_EXAM = 10
const TARGET_GRADE = 'A'

const cache = new Map()

/**
 * Read a pack from server/packs/<name>.json. Parsed once, then cached.
 * @param {string} name pack file name without the extension
 */
export function loadPack(name = PACK_NAME) {
  if (cache.has(name)) return cache.get(name)
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw Object.assign(new Error(`"${name}" is not a pack name. Use letters, digits, hyphen or underscore.`), { status: 400 })
  }
  let raw
  try {
    raw = readFileSync(join(here, `${name}.json`), 'utf8')
  } catch {
    throw Object.assign(new Error(`No pack named "${name}" in server/packs.`), { status: 404 })
  }
  let pack
  try {
    pack = JSON.parse(raw)
  } catch (err) {
    throw Object.assign(new Error(`Pack "${name}" is not valid JSON: ${err.message}`), { status: 500 })
  }
  cache.set(name, pack)
  return pack
}

/** Leaf syllabus points — the ones the learner graph tracks. */
const leafPoints = pack => pack.syllabus.filter(s => s.parent !== null)

// The demo learner: six points solid, seven partly there, nine weak, the rest
// never attempted. Written out rather than generated so Today, Progress and the
// planner all show a shape a real student would recognise.
// [syllabus point, mastery, attempts, unaided marks, unaided max, days since last seen]
const DEMO_PROGRESS = [
  ['1.1', 0.86, 5, 19, 22, 9],
  ['1.2', 0.81, 4, 16, 20, 12],
  ['2.2', 0.88, 6, 27, 31, 5],
  ['3.1', 0.79, 4, 15, 19, 14],
  ['4.1', 0.83, 3, 12, 15, 11],
  ['5.2', 0.77, 5, 18, 24, 8],

  ['1.4', 0.62, 3, 11, 18, 16],
  ['2.3', 0.57, 3, 13, 23, 19],
  ['3.3', 0.64, 4, 17, 27, 7],
  ['4.4', 0.53, 2, 8, 15, 21],
  ['5.6', 0.59, 4, 10, 17, 6],
  ['7.1', 0.48, 2, 7, 15, 24],
  ['8.2', 0.51, 2, 6, 12, 22],

  ['2.1', 0.31, 3, 9, 30, 13],
  ['3.2', 0.27, 2, 4, 15, 27],
  ['5.3', 0.22, 4, 7, 31, 4],
  ['5.5', 0.18, 3, 5, 28, 10],
  ['6.2', 0.16, 2, 6, 40, 6],
  ['8.1', 0.29, 2, 4, 13, 18],
  ['9.4', 0.24, 2, 5, 20, 15],
  ['10.1', 0.20, 3, 8, 38, 9],
  ['10.2', 0.13, 2, 6, 44, 3]
]

const daysAgo = n => new Date(Date.now() - n * 86_400_000).toISOString()
const daysAhead = n => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

function insertPack(pack) {
  const already = get('SELECT COUNT(*) AS n FROM items WHERE pack = ?', pack.pack)
  if (already && already.n > 0) return false

  db.exec('BEGIN')
  try {
    for (const s of pack.syllabus) {
      run('INSERT OR REPLACE INTO syllabus (id,pack,code,title,paper,weight,parent) VALUES (?,?,?,?,?,?,?)',
        `syl_${pack.pack}_${s.code}`, pack.pack, s.code, s.title, String(s.paper), s.weight, s.parent)
    }
    for (const sc of pack.schemes) {
      run('INSERT OR REPLACE INTO schemes (id,pack,kind,body) VALUES (?,?,?,?)',
        sc.id, pack.pack, sc.scheme_type, JSON.stringify(sc))
    }
    for (const it of pack.items) {
      run(`INSERT OR REPLACE INTO items
             (id,pack,syllabus_point,paper,command_word,tariff,kind,stem,stimulus,scheme_id,difficulty)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        it.id, pack.pack, it.syllabus_point, String(it.paper), it.command_word, it.tariff,
        it.kind, it.stem, it.stimulus ?? null, it.scheme_id, it.difficulty)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return true
}

function ensureCourse(pack) {
  const existing = get('SELECT * FROM courses WHERE user_id = ? ORDER BY created_at LIMIT 1', DEMO_USER_ID)
  if (existing) return { course: existing, created: false }

  const course = {
    id: uid('crs'),
    user_id: DEMO_USER_ID,
    board: pack.board.name,
    syllabus: pack.subject.code,
    title: `${pack.board.name} AS & A Level ${pack.subject.name} (${pack.subject.code})`,
    exam_date: daysAhead(WEEKS_TO_EXAM * 7),
    target_grade: TARGET_GRADE,
    pack_version: pack.pack_version,
    created_at: now()
  }
  run(`INSERT INTO courses (id,user_id,board,syllabus,title,exam_date,target_grade,pack_version,created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    course.id, course.user_id, course.board, course.syllabus, course.title,
    course.exam_date, course.target_grade, course.pack_version, course.created_at)
  return { course, created: true }
}

function ensureLearnerState(pack, course) {
  const already = get('SELECT COUNT(*) AS n FROM learner_state WHERE user_id = ? AND course_id = ?',
    DEMO_USER_ID, course.id)
  if (already && already.n > 0) return 0

  const progress = new Map(DEMO_PROGRESS.map(row => [row[0], row]))
  // A point a student is weak on is a point where the pack's known misconceptions
  // are still live, so attach them below a mastery of 0.5.
  const byPoint = new Map()
  for (const m of pack.misconceptions) {
    if (!byPoint.has(m.syllabus_point)) byPoint.set(m.syllabus_point, [])
    byPoint.get(m.syllabus_point).push(m.id)
  }

  let written = 0
  db.exec('BEGIN')
  try {
    for (const point of leafPoints(pack)) {
      const row = progress.get(point.code)
      const mastery = row ? row[1] : 0
      const held = mastery > 0 && mastery < 0.5 ? (byPoint.get(point.code) || []) : []
      run(`INSERT OR REPLACE INTO learner_state
             (user_id,course_id,syllabus_point,mastery,attempts,unaided_marks,unaided_max,last_seen,misconceptions)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        DEMO_USER_ID, course.id, point.code, mastery,
        row ? row[2] : 0, row ? row[3] : 0, row ? row[4] : 0,
        row ? daysAgo(row[5]) : null, JSON.stringify(held))
      written++
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return written
}

/**
 * Load the seed pack into an empty database and give the demo user a course to
 * work in. Safe to call on every start: each step checks whether it has already
 * run, and a failure is reported rather than thrown so the server still boots.
 */
export function seedIfEmpty() {
  try {
    const pack = loadPack(PACK_NAME)
    const packInserted = insertPack(pack)
    const { course, created } = ensureCourse(pack)
    const statesWritten = ensureLearnerState(pack, course)

    if (packInserted || created || statesWritten) {
      logEvent('pack_seeded', {
        pack: pack.pack,
        pack_version: pack.pack_version,
        syllabus_points: packInserted ? pack.syllabus.length : 0,
        items: packInserted ? pack.items.length : 0,
        schemes: packInserted ? pack.schemes.length : 0,
        course_created: created,
        learner_state_rows: statesWritten
      }, DEMO_USER_ID, course.id)
      const done = []
      if (packInserted) done.push(`${pack.syllabus.length} syllabus points, ${pack.items.length} items, ${pack.schemes.length} schemes`)
      if (created) done.push(`a course for ${DEMO_USER_ID} sitting ${course.exam_date} at target ${course.target_grade}`)
      if (statesWritten) done.push(`${statesWritten} learner-state rows`)
      console.log(`Seeded ${pack.pack} ${pack.pack_version_display}: ${done.join('; ')}`)
    }
    return { pack: pack.pack, course_id: course.id, seeded: packInserted }
  } catch (err) {
    console.error(`Seeding did not run: ${err.message.replace(/\.$/, '')}. The database keeps whatever it already held.`)
    return null
  }
}

/** Every item in a pack, straight from the database, newest schema first. */
export function packItems(pack = PACK_NAME) {
  return all('SELECT * FROM items WHERE pack = ? ORDER BY paper, syllabus_point', pack)
}
