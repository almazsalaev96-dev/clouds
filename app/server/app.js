/**
 * The API, assembled once.
 *
 * `server/index.js` puts it behind a local HTTP server; `api/index.js` hands it to a
 * serverless runtime. Neither owns the routes, so what runs on the deployed site is
 * the same code as what runs on your machine.
 */
import { createRouter, dispatch, json } from './http.js'
import { seedIfEmpty } from './packs/seed.js'
import registerCourses from './routes/courses.js'
import registerSession from './routes/session.js'
import registerConversations from './routes/conversations.js'
import registerPractise from './routes/practise.js'
import registerMark from './routes/mark.js'
import registerCards from './routes/cards.js'
import registerPlan from './routes/plan.js'
import { providerStatus } from './providers/router.js'

export function createApp() {
  seedIfEmpty()
  const router = createRouter()
  router.get('/api/health', ({ res }) => json(res, { ok: true, providers: providerStatus() }))
  registerCourses(router)
  registerSession(router)
  registerConversations(router)
  registerPractise(router)
  registerMark(router)
  registerCards(router)
  registerPlan(router)
  return router
}

export { dispatch, json, providerStatus }
