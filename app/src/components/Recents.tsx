import { useCallback, useEffect, useRef, useState } from 'react'
import { del, get, patch } from '../lib/api'
import './Recents.css'

export interface Conversation {
  id: string
  title: string
  courseId?: string | null
  turns?: number
  lastAt?: string | null
  preview?: string | null
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null

function readConversations(value: unknown): Conversation[] {
  const rows = Array.isArray(value) ? value : asRecord(value)?.conversations
  if (!Array.isArray(rows)) return []
  const out: Conversation[] = []
  for (const row of rows) {
    const source = asRecord(row)
    const id = source && typeof source.id === 'string' ? source.id : null
    if (!id) continue
    out.push({
      id,
      title: typeof source?.title === 'string' && source.title.trim() ? source.title.trim() : 'New chat',
      courseId: typeof source?.courseId === 'string' ? source.courseId : null,
      turns: typeof source?.turns === 'number' ? source.turns : undefined,
      lastAt: typeof source?.lastAt === 'string' ? source.lastAt : null,
      preview: typeof source?.preview === 'string' ? source.preview : null,
    })
  }
  return out
}

export interface RecentsProps {
  /** The conversation currently open, so it can be marked in the list. */
  currentId: string | null
  /** Bumped by the caller when a turn lands, so the list picks up a new thread. */
  revision?: number
  /** Told when the open conversation is deleted, so the screen can leave it. */
  onDeleted?(id: string): void
}

type Busy = { id: string; act: 'rename' | 'delete' } | null

/**
 * Past conversations, most recent first.
 *
 * The thread is the unit of work in this product, so the list of threads is the
 * navigation. It stays quiet when there is nothing in it rather than explaining
 * itself: a first-time student has not lost anything.
 *
 * A thread can be renamed and deleted from here. Deleting is confirmed in place and
 * says how much writing goes with it, because it takes the student's own words away
 * and cannot be undone.
 */
export function Recents({ currentId, revision = 0, onDeleted }: RecentsProps) {
  const [rows, setRows] = useState<Conversation[]>([])
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const input = useRef<HTMLInputElement | null>(null)

  const load = useCallback(() => {
    let live = true
    get<unknown>('/api/conversations?limit=25')
      .then(data => { if (live) { setRows(readConversations(data)); setFailed(false) } })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])

  useEffect(() => load(), [load, revision])
  useEffect(() => { if (renaming) input.current?.focus() }, [renaming])

  const rename = useCallback(async (row: Conversation) => {
    const title = draft.trim()
    if (!title || title === row.title) { setRenaming(null); return }
    setBusy({ id: row.id, act: 'rename' })
    setProblem(null)
    try {
      await patch(`/api/conversations/${encodeURIComponent(row.id)}`, { title })
      setRows(list => list.map(r => (r.id === row.id ? { ...r, title } : r)))
      setRenaming(null)
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : 'That name did not save.')
    } finally {
      setBusy(null)
    }
  }, [draft])

  const remove = useCallback(async (row: Conversation) => {
    setBusy({ id: row.id, act: 'delete' })
    setProblem(null)
    try {
      await del(`/api/conversations/${encodeURIComponent(row.id)}`)
      setRows(list => list.filter(r => r.id !== row.id))
      setConfirming(null)
      if (row.id === currentId) onDeleted?.(row.id)
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : 'That conversation did not delete.')
    } finally {
      setBusy(null)
    }
  }, [currentId, onDeleted])

  if (failed || rows.length === 0) return null

  return (
    <div className="recents" onMouseLeave={() => setOpen(null)}>
      <h2 className="recents__title mono">Recent</h2>
      <ul className="recents__list">
        {rows.map(row => {
          const current = row.id === currentId
          if (renaming === row.id) {
            return (
              <li key={row.id} className="recents__row">
                <input
                  ref={input}
                  className="recents__rename"
                  value={draft}
                  maxLength={120}
                  aria-label={`Rename ${row.title}`}
                  disabled={busy?.id === row.id}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={() => void rename(row)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); void rename(row) }
                    if (e.key === 'Escape') { e.preventDefault(); setRenaming(null) }
                  }}
                />
              </li>
            )
          }

          if (confirming === row.id) {
            return (
              <li key={row.id} className="recents__row recents__row--confirm">
                <span className="recents__confirm-text">
                  Delete this and the {row.turns ?? 0} turn{row.turns === 1 ? '' : 's'} in it?
                </span>
                <span className="recents__confirm-acts">
                  <button
                    type="button"
                    className="recents__confirm-yes"
                    disabled={busy?.id === row.id}
                    onClick={() => void remove(row)}
                  >
                    {busy?.id === row.id ? 'Deleting…' : 'Delete'}
                  </button>
                  <button type="button" className="recents__confirm-no" onClick={() => setConfirming(null)}>
                    Keep
                  </button>
                </span>
              </li>
            )
          }

          return (
            <li key={row.id} className="recents__row" onMouseEnter={() => setOpen(row.id)}>
              <a
                className="recents__link"
                href={`#/c/${encodeURIComponent(row.id)}`}
                data-current={current ? 'yes' : 'no'}
                aria-current={current ? 'page' : undefined}
                title={row.preview || row.title}
              >
                {row.title}
              </a>
              <span className="recents__acts" data-open={open === row.id ? 'yes' : 'no'}>
                <button
                  type="button"
                  className="recents__act"
                  aria-label={`Rename ${row.title}`}
                  onClick={() => { setDraft(row.title); setRenaming(row.id); setConfirming(null) }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="recents__act recents__act--danger"
                  aria-label={`Delete ${row.title}`}
                  onClick={() => { setConfirming(row.id); setRenaming(null) }}
                >
                  Delete
                </button>
              </span>
            </li>
          )
        })}
      </ul>
      {problem && <p className="recents__problem" role="alert">{problem}</p>}
    </div>
  )
}
