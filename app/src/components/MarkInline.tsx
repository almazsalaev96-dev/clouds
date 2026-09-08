import { useCallback, useEffect, useState } from 'react'
import { get } from '../lib/api'
import { MarkView } from '../screens/MarkView'
import type { MarkPayload } from '../screens/MarkView'
import type { MarkArtefact } from '../lib/artefacts'
import './MarkInline.css'

export interface MarkInlineProps {
  mark: MarkArtefact
}

/**
 * A Mark, in the conversation that produced it.
 *
 * The turn carries only the Mark's id: the Mark itself is stored whole by the marking
 * route, so this reads it back from there rather than keeping a second copy that
 * could disagree with the first. That is also why a mark opened here and a mark
 * opened on its own page show the same evidence over the same words.
 */
export function MarkInline({ mark }: MarkInlineProps) {
  const [payload, setPayload] = useState<MarkPayload | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    let live = true
    setLoading(true)
    setProblem(null)
    get<MarkPayload>(`/api/marks/${encodeURIComponent(mark.markId)}`)
      .then(data => { if (live) { setPayload(data); setLoading(false) } })
      .catch(failure => {
        if (!live) return
        setProblem(failure instanceof Error ? failure.message : 'That mark could not be read back.')
        setLoading(false)
      })
    return () => { live = false }
  }, [mark.markId])

  useEffect(() => load(), [load])

  // The whole payload, not the Mark inside it: the renderer's runs and cards live at
  // the top level and are what draws the evidence on the answer.
  const answer = typeof payload?.mark?.transcript?.text === 'string' ? payload.mark.transcript.text : ''

  return (
    <div className="mark-inline">
      <MarkView
        mark={loading ? null : payload}
        answer={answer}
        status={problem ? 'error' : loading ? 'loading' : 'ready'}
        error={problem}
        onRetry={() => { load() }}
        compact
      />
    </div>
  )
}
