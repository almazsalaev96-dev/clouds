import { useCallback, useEffect, useRef, useState } from 'react'
import { get } from '../lib/api'
import type { Health } from '../lib/api'
import { setDensity, setFont, useStore } from '../lib/state'
import type { Density, FontChoice } from '../lib/state'
import './Settings.css'

/* --------------------------------------------------- preferences this screen owns
 * Theme lives in the top bar, font and density live in the store (they are stamped
 * on <html> for tokens.css). Everything else on this screen is kept here.
 */

type Motion = 'system' | 'reduce'

interface LocalPrefs {
  motion: Motion
  technicalFooter: boolean
  quietHoursOn: boolean
  quietStart: string
  quietEnd: string
  notifyDueCards: boolean
  notifyMarkReady: boolean
  memoryPaused: string[]
}

const DEFAULTS: LocalPrefs = {
  motion: 'system',
  technicalFooter: false,
  quietHoursOn: true,
  quietStart: '22:00',
  quietEnd: '07:00',
  notifyDueCards: false,
  notifyMarkReady: false,
  memoryPaused: [],
}

const PREFS_KEY = 'margin.settings'
const NOTES_KEY = 'margin.notes'

function readLocalPrefs(): LocalPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULTS }
    const saved = JSON.parse(raw) as Record<string, unknown>
    return {
      motion: saved.motion === 'reduce' ? 'reduce' : 'system',
      technicalFooter: saved.technicalFooter === true,
      quietHoursOn: saved.quietHoursOn !== false,
      quietStart: typeof saved.quietStart === 'string' ? saved.quietStart : DEFAULTS.quietStart,
      quietEnd: typeof saved.quietEnd === 'string' ? saved.quietEnd : DEFAULTS.quietEnd,
      notifyDueCards: saved.notifyDueCards === true,
      notifyMarkReady: saved.notifyMarkReady === true,
      memoryPaused: Array.isArray(saved.memoryPaused)
        ? saved.memoryPaused.filter((x): x is string => typeof x === 'string')
        : [],
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/** Motion and the technical footer are attributes on <html>, like the other comfort settings. */
export function applyLocalPrefs(prefs: LocalPrefs): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (prefs.motion === 'reduce') root.setAttribute('data-motion', 'reduce')
  else root.removeAttribute('data-motion')
  if (prefs.technicalFooter) root.setAttribute('data-technical', 'on')
  else root.removeAttribute('data-technical')
}

if (typeof document !== 'undefined') applyLocalPrefs(readLocalPrefs())

/* ------------------------------------------------------------------- notes */

interface Note {
  id: string
  text: string
  at: string
  courseId: string | null
}

function readNotes(): Note[] {
  try {
    const raw = window.localStorage.getItem(NOTES_KEY)
    const saved = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(saved)) return []
    return saved
      .map((row): Note | null => {
        if (typeof row !== 'object' || row === null) return null
        const record = row as Record<string, unknown>
        const text = typeof record.text === 'string' ? record.text : null
        if (!text) return null
        return {
          id: typeof record.id === 'string' ? record.id : `n_${Math.random().toString(36).slice(2, 10)}`,
          text,
          at: typeof record.at === 'string' ? record.at : new Date().toISOString(),
          courseId: typeof record.courseId === 'string' ? record.courseId : null,
        }
      })
      .filter((n): n is Note => n !== null)
  } catch {
    return []
  }
}

function writeNotes(notes: Note[]): void {
  try {
    window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  } catch {
    /* No storage: the list holds for this visit only, which the copy says. */
  }
}

/* ---------------------------------------------- what the marking has noticed */

interface CourseView {
  id: string
  title: string
  examDate: string | null
  targetGrade: string | null
  packVersion: string
  syllabus: string
  countdown: string
}

interface PointRow {
  code: string
  title: string
  attempts: number
  misconceptions: unknown[]
}

interface CourseResponse {
  course: CourseView
  points: PointRow[]
}

interface Noticed {
  key: string
  text: string
  where: string
}

/** A misconception row can be a sentence, or the pack's {wrong, right} pair. */
function misconceptionText(raw: unknown): string | null {
  if (typeof raw === 'string') return raw.trim() || null
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  for (const key of ['right', 'text', 'wrong', 'title']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function noticedFrom(payload: CourseResponse | null): Noticed[] {
  if (!payload) return []
  const rows: Noticed[] = []
  if (payload.course.targetGrade) {
    rows.push({ key: 'target', text: `Target grade ${payload.course.targetGrade}`, where: 'set when the course was made' })
  }
  if (payload.course.examDate) {
    rows.push({ key: 'exam', text: `Exam on ${payload.course.examDate}`, where: payload.course.countdown })
  }
  for (const point of payload.points) {
    for (const [index, raw] of point.misconceptions.entries()) {
      const text = misconceptionText(raw)
      if (!text) continue
      rows.push({ key: `${point.code}-${index}`, text, where: `noticed while marking ${point.code} ${point.title}` })
    }
  }
  return rows
}

/* -------------------------------------------------------------------- view */

export interface SettingsProps {
  /** Overrides the course the shell has selected. The shell passes none. */
  courseId?: string
}

export function Settings({ courseId }: SettingsProps) {
  const store = useStore()
  const course = courseId ?? store.courseId
  const [prefs, setPrefs] = useState<LocalPrefs>(() => readLocalPrefs())
  const [notes, setNotes] = useState<Note[]>(() => readNotes())
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [undone, setUndone] = useState<Note | null>(null)
  const [record, setRecord] = useState<CourseResponse | null>(null)
  const [recordProblem, setRecordProblem] = useState('')
  const [health, setHealth] = useState<Health | null>(null)
  const [deleteWord, setDeleteWord] = useState('')
  const [deleteReport, setDeleteReport] = useState('')
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const objectUrl = useRef<string | null>(null)

  useEffect(() => {
    let live = true
    if (course) {
      get<CourseResponse>(`/api/courses/${encodeURIComponent(course)}`)
        .then((payload) => {
          if (live) setRecord(payload)
        })
        .catch((error: unknown) => {
          if (live) setRecordProblem(error instanceof Error ? error.message : 'The course record did not load.')
        })
    }
    get<Health>('/api/health')
      .then((payload) => {
        if (live) setHealth(payload)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [course])

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    },
    [],
  )

  const update = useCallback((patch: Partial<LocalPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch }
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      } catch {
        /* The change still applies to this page. */
      }
      applyLocalPrefs(next)
      return next
    })
  }, [])

  const saveNotes = useCallback((rows: Note[]) => {
    setNotes(rows)
    writeNotes(rows)
  }, [])

  const addNote = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    saveNotes([
      ...notes,
      { id: `n_${Date.now().toString(36)}`, text, at: new Date().toISOString(), courseId: course },
    ])
    setDraft('')
  }, [draft, notes, course, saveNotes])

  const buildExport = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      reading: { font: store.font, density: store.density, theme: store.theme },
      settings: prefs,
      notes,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    const url = URL.createObjectURL(blob)
    objectUrl.current = url
    setExportUrl(url)
  }, [prefs, notes, store.font, store.density, store.theme])

  const eraseLocal = useCallback(() => {
    if (deleteWord.trim().toLowerCase() !== 'delete') {
      setDeleteReport('Type the word delete to confirm. Nothing has been removed.')
      return
    }
    for (const key of [PREFS_KEY, NOTES_KEY, 'margin.today.done']) {
      try {
        window.localStorage.removeItem(key)
      } catch {
        /* Keep going: the rest still clears. */
      }
    }
    setPrefs({ ...DEFAULTS })
    applyLocalPrefs(DEFAULTS)
    setNotes([])
    setDeleteWord('')
    setDeleteReport(
      'Erased from this browser: your notes, quiet hours, notification choices and the log of blocks you ticked off. Your attempts, marks and cards are on the server and are untouched.',
    )
  }, [deleteWord])

  const noticed = noticedFrom(record)
  const paused = course != null && prefs.memoryPaused.includes(course)
  const noKey = health != null && !health.providers.some((provider) => provider.configured)

  return (
    <main className="settings" aria-labelledby="settings-heading">
      <header className="settings__head">
        <h1 id="settings-heading" className="settings__heading">
          Settings
        </h1>
        <p className="settings__sub">
          Every control takes effect the moment you change it. There is no save button, and each control says what it
          does.
        </p>
      </header>

      <section className="settings__section" aria-labelledby="settings-reading">
        <h2 id="settings-reading" className="settings__section-heading">
          Reading comfort
        </h2>

        <fieldset className="settings__field">
          <legend className="settings__legend">Typeface</legend>
          {(
            [
              ['default', 'Default', 'IBM Plex Sans for the interface and a serif for long reading.'],
              [
                'dyslexic',
                'Dyslexia-friendly',
                'OpenDyslexic where it is installed, Atkinson Hyperlegible otherwise. Applies to every screen at once.',
              ],
            ] as [FontChoice, string, string][]
          ).map(([value, label, note]) => (
            <label key={value} className="settings__radio">
              <input
                type="radio"
                name="settings-font"
                value={value}
                checked={store.font === value}
                onChange={() => setFont(value)}
              />
              <span className="settings__radio-label">{label}</span>
              <span className="settings__consequence">{note}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="settings__field">
          <legend className="settings__legend">Density</legend>
          {(
            [
              ['default', 'Standard', 'Standard line height. More on the screen at once.'],
              ['roomy', 'Roomy', 'Looser lines in chat, marking and the reader. Nothing shifts outside the text.'],
            ] as [Density, string, string][]
          ).map(([value, label, note]) => (
            <label key={value} className="settings__radio">
              <input
                type="radio"
                name="settings-density"
                value={value}
                checked={store.density === value}
                onChange={() => setDensity(value)}
              />
              <span className="settings__radio-label">{label}</span>
              <span className="settings__consequence">{note}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="settings__field">
          <legend className="settings__legend">Motion</legend>
          {(
            [
              ['system', 'Follow the system', 'Uses your operating system setting for reduced motion.'],
              ['reduce', 'Reduce motion', 'Turns transitions and fades off here, whatever the system says.'],
            ] as [Motion, string, string][]
          ).map(([value, label, note]) => (
            <label key={value} className="settings__radio">
              <input
                type="radio"
                name="settings-motion"
                value={value}
                checked={prefs.motion === value}
                onChange={() => update({ motion: value })}
              />
              <span className="settings__radio-label">{label}</span>
              <span className="settings__consequence">{note}</span>
            </label>
          ))}
        </fieldset>

        <label className="settings__check">
          <input
            type="checkbox"
            checked={prefs.technicalFooter}
            onChange={(event) => update({ technicalFooter: event.target.checked })}
          />
          <span className="settings__radio-label">Show the technical footer</span>
          <span className="settings__consequence">
            Prints the model, the time to first token and the cost under answers that carry them. It changes nothing
            about the answer itself.
          </span>
        </label>
      </section>

      <section className="settings__section" aria-labelledby="settings-memory">
        <h2 id="settings-memory" className="settings__section-heading">
          Memory
        </h2>

        <h3 className="settings__sub-heading">What the marking has noticed</h3>
        {recordProblem ? <p className="settings__note">{recordProblem}</p> : null}
        {noticed.length === 0 ? (
          <p className="settings__note">
            Nothing yet. What appears here comes out of marked work: the misconceptions the marker recorded and the
            facts the course was set up with.
          </p>
        ) : (
          <ul className="settings__memory">
            {noticed.map((row) => (
              <li key={row.key} className="settings__memory-row">
                <p className="settings__memory-text">{row.text}</p>
                <p className="settings__memory-meta mono">{row.where}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="settings__consequence">
          These are read from your record, not stored separately. They change when the marking changes, so there is
          nothing to edit here — correct the work, and this follows.
        </p>

        <h3 className="settings__sub-heading">What you have told Margin</h3>
        {notes.length === 0 ? (
          <p className="settings__note">
            You have not written anything down for Margin yet. Notes you add here stay in this browser.
          </p>
        ) : (
          <ul className="settings__memory">
            {notes.map((note) => (
              <li key={note.id} className="settings__memory-row">
                {editing === note.id ? (
                  <>
                    <label className="sr" htmlFor={`note-${note.id}`}>
                      Correct this note
                    </label>
                    <input
                      id={`note-${note.id}`}
                      className="settings__input"
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                    />
                    <div className="settings__memory-actions">
                      <button
                        type="button"
                        className="settings__button"
                        onClick={() => {
                          const text = editText.trim()
                          if (text) saveNotes(notes.map((n) => (n.id === note.id ? { ...n, text } : n)))
                          setEditing(null)
                        }}
                      >
                        Save the correction
                      </button>
                      <button type="button" className="settings__button" onClick={() => setEditing(null)}>
                        Leave it as it was
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="settings__memory-text">{note.text}</p>
                    <p className="settings__memory-meta mono">written {note.at.slice(0, 10)}</p>
                    <div className="settings__memory-actions">
                      <button
                        type="button"
                        className="settings__button"
                        onClick={() => {
                          setEditing(note.id)
                          setEditText(note.text)
                        }}
                      >
                        Correct it
                      </button>
                      <button
                        type="button"
                        className="settings__button"
                        onClick={() => {
                          saveNotes(notes.filter((n) => n.id !== note.id))
                          setUndone(note)
                        }}
                      >
                        Forget this
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {undone ? (
          <p className="settings__undo" role="status">
            Forgotten: &ldquo;{undone.text}&rdquo;.
            <button
              type="button"
              className="settings__button"
              onClick={() => {
                saveNotes([...notes, undone])
                setUndone(null)
              }}
            >
              Put it back
            </button>
          </p>
        ) : null}

        <div className="settings__row">
          <label className="settings__time" htmlFor="settings-new-note">
            <span className="sr">Add a note for Margin</span>
            <input
              id="settings-new-note"
              className="settings__input"
              value={draft}
              placeholder="Something Margin should keep in mind"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addNote()
                }
              }}
            />
          </label>
          <button type="button" className="settings__button" onClick={addNote}>
            Add the note
          </button>
        </div>

        <label className="settings__check">
          <input
            type="checkbox"
            checked={paused}
            disabled={course == null}
            onChange={(event) =>
              course == null
                ? undefined
                : update({
                    memoryPaused: event.target.checked
                      ? [...prefs.memoryPaused, course]
                      : prefs.memoryPaused.filter((id) => id !== course),
                  })
            }
          />
          <span className="settings__radio-label">Pause memory for this course</span>
          <span className="settings__consequence">
            {course == null
              ? 'Open a course first: this pauses one course at a time, not all of them.'
              : 'Your notes stop being used for this course. Attempts, marks and cards are the record, not memory, and carry on unchanged.'}
          </span>
        </label>

        <div className="settings__row">
          <button type="button" className="settings__button" onClick={buildExport}>
            Prepare a JSON export
          </button>
          {exportUrl ? (
            <a className="settings__link" href={exportUrl} download="margin-settings.json">
              Download margin-settings.json
            </a>
          ) : null}
        </div>
        <p className="settings__consequence">
          The file holds your reading settings, your quiet hours and every note above. It does not hold your attempts
          or marks, which are on the server.
        </p>
      </section>

      <section className="settings__section" aria-labelledby="settings-notifications">
        <h2 id="settings-notifications" className="settings__section-heading">
          Notifications and quiet hours
        </h2>

        <label className="settings__check">
          <input
            type="checkbox"
            checked={prefs.notifyDueCards}
            onChange={(event) => update({ notifyDueCards: event.target.checked })}
          />
          <span className="settings__radio-label">Tell me when cards are due</span>
          <span className="settings__consequence">
            One factual line a day at most, shown when you open Margin: the due count and the days to your next paper.
          </span>
        </label>

        <label className="settings__check">
          <input
            type="checkbox"
            checked={prefs.notifyMarkReady}
            onChange={(event) => update({ notifyMarkReady: event.target.checked })}
          />
          <span className="settings__radio-label">Tell me when a mark is ready</span>
          <span className="settings__consequence">Once per mark. No predicted grade is ever sent.</span>
        </label>

        <label className="settings__check">
          <input
            type="checkbox"
            checked={prefs.quietHoursOn}
            onChange={(event) => update({ quietHoursOn: event.target.checked })}
          />
          <span className="settings__radio-label">Keep quiet hours</span>
          <span className="settings__consequence">
            Inside the window, Today leads with a line about stopping instead of a list of work, and nothing is sent.
          </span>
        </label>

        <div className="settings__row">
          <label className="settings__time">
            <span>Quiet from</span>
            <input
              type="time"
              className="settings__input settings__input--time"
              value={prefs.quietStart}
              onChange={(event) => update({ quietStart: event.target.value })}
            />
          </label>
          <label className="settings__time">
            <span>until</span>
            <input
              type="time"
              className="settings__input settings__input--time"
              value={prefs.quietEnd}
              onChange={(event) => update({ quietEnd: event.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="settings__section" aria-labelledby="settings-usage">
        <h2 id="settings-usage" className="settings__section-heading">
          Usage
        </h2>
        <ul className="settings__usage">
          <li className="settings__usage-row">
            <span className="settings__usage-label">Turns since this page loaded</span>
            <span className="settings__usage-value mono">{store.usage.turns}</span>
          </li>
          <li className="settings__usage-row">
            <span className="settings__usage-label">Answers marked</span>
            <span className="settings__usage-value mono">{store.usage.marks}</span>
          </li>
          <li className="settings__usage-row">
            <span className="settings__usage-label">Model spend</span>
            <span className="settings__usage-value mono">
              {store.usage.costUsd > 0 ? `$${store.usage.costUsd.toFixed(4)}` : '$0.0000'}
            </span>
          </li>
        </ul>
        <p className="settings__consequence">
          {noKey
            ? 'No model key is configured, so answers come from the built-in mock provider and cost nothing. The counters still show what was asked.'
            : 'Counted in this browser since the page loaded. Reloading starts the count again; it is not a bill.'}
        </p>
      </section>

      <section className="settings__section" aria-labelledby="settings-data">
        <h2 id="settings-data" className="settings__section-heading">
          Your data
        </h2>
        <p className="settings__consequence">
          Export first if you want a copy. Erasing cannot be undone, and Margin keeps no backup of your browser.
        </p>
        <label className="settings__time" htmlFor="settings-delete-word">
          <span>Type delete to confirm</span>
          <input
            id="settings-delete-word"
            className="settings__input settings__input--word"
            value={deleteWord}
            autoComplete="off"
            onChange={(event) => setDeleteWord(event.target.value)}
          />
        </label>
        <button type="button" className="settings__button settings__button--danger" onClick={eraseLocal}>
          Erase everything stored in this browser
        </button>
        <p className="settings__consequence">
          This removes your notes, quiet hours, notification choices and the log of blocks you ticked off. Attempts,
          marks and cards live on the server and are not touched by this button.
        </p>
        {deleteReport ? (
          <p className="settings__undo" role="status">
            {deleteReport}
          </p>
        ) : null}
      </section>
    </main>
  )
}

export default Settings
