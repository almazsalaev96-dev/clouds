import { useCallback, useEffect, useState } from 'react'
import { get } from '../lib/api'
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
}

/**
 * Past conversations, most recent first.
 *
 * The thread is the unit of work in this product, so the list of threads is the
 * navigation. It stays quiet when there is nothing in it rather than explaining
 * itself: a first-time student has not lost anything.
 */
export function Recents({ currentId, revision = 0 }: RecentsProps) {
  const [rows, setRows] = useState<Conversation[]>([])
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    let live = true
    get<unknown>('/api/conversations?limit=25')
      .then(data => { if (live) { setRows(readConversations(data)); setFailed(false) } })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])

  useEffect(() => load(), [load, revision])

  if (failed || rows.length === 0) return null

  return (
    <div className="recents">
      <h2 className="recents__title mono">Recent</h2>
      <ul className="recents__list">
        {rows.map(row => {
          const current = row.id === currentId
          return (
            <li key={row.id}>
              <a
                className="recents__link"
                href={`#/c/${encodeURIComponent(row.id)}`}
                data-current={current ? 'yes' : 'no'}
                aria-current={current ? 'page' : undefined}
                title={row.preview || row.title}
              >
                {row.title}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
