/**
 * The API on a serverless runtime.
 *
 * Two things differ from running it on your own machine, and both are stated where
 * they bite: the working directory is read-only, so the database lives in the
 * instance's own /tmp; and an instance is recycled when it goes idle, so a demo's
 * work lasts as long as the instance does. The pack re-seeds itself on a cold start.
 */
process.env.MARGIN_DB = process.env.MARGIN_DB || '/tmp/margin.db'

const { createApp, dispatch, json } = await import('../server/app.js')

const router = createApp()

export default function handler(req, res) {
  return dispatch(router, req, res, (_req, response) =>
    json(response, { error: 'No such endpoint' }, 404))
}
