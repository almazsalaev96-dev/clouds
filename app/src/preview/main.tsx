/**
 * The preview entry.
 *
 * The database is opened and the API is mounted inside the page before the interface
 * asks it anything; then the same `App` renders, unaware that its `fetch` is being
 * answered a few frames away instead of over a network.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/base.css'
import { openDatabase } from './sqlite'


const root = createRoot(document.getElementById('root')!)

function fail(message: string) {
  root.render(
    <div style={{ padding: '2rem', font: '15px/1.5 system-ui', maxWidth: '46rem' }}>
      <h1 style={{ font: '600 22px/1.2 Georgia, serif' }}>The preview did not start</h1>
      <p>{message}</p>
      <p style={{ opacity: 0.7 }}>
        Running it locally does not depend on any of this: <code>npm install &amp;&amp; npm run serve</code>.
      </p>
    </div>,
  )
}

async function start() {
  await openDatabase()
  const { serveApiFromThisPage } = await import('./bridge')
  await serveApiFromThisPage()
  const { App } = await import('../App')
  root.render(<StrictMode><App /></StrictMode>)
}

start().catch((err: Error) => {
  console.error('[preview]', err)
  fail(err.message || 'Something failed while starting the in-page API.')
})
