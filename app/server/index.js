import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { createRouter, dispatch, json, serveStatic } from './http.js'
import { seedIfEmpty } from './packs/seed.js'
import registerCourses from './routes/courses.js'
import registerSession from './routes/session.js'
import registerPractise from './routes/practise.js'
import registerMark from './routes/mark.js'
import registerCards from './routes/cards.js'
import registerPlan from './routes/plan.js'
import { providerStatus } from './providers/router.js'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, '..', 'dist')
const PORT = Number(process.env.PORT || 8787)

seedIfEmpty()

const router = createRouter()
router.get('/api/health', ({ res }) => json(res, { ok: true, providers: providerStatus() }))
registerCourses(router)
registerSession(router)
registerPractise(router)
registerMark(router)
registerCards(router)
registerPlan(router)

const static_ = existsSync(dist) ? serveStatic(dist) : null
const fallback = (req, res) => {
  if (req.url.startsWith('/api/')) return json(res, { error: 'No such endpoint' }, 404)
  if (static_) return static_(req, res)
  res.writeHead(404, { 'content-type': 'text/plain' })
  res.end('Run `npm run build` to produce dist/, or use `npm run dev` for the Vite dev server.')
}

createServer((req, res) => dispatch(router, req, res, fallback))
  .listen(PORT, () => {
    const live = providerStatus().filter(p => p.configured).map(p => p.name)
    console.log(`Margin API on http://localhost:${PORT}`)
    console.log(live.length ? `  providers: ${live.join(', ')}` : '  providers: none configured — serving the deterministic mock')
  })
