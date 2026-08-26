import Fastify from 'fastify'
import cors from '@fastify/cors'
import { API_BASE } from '@kb/shared'
import { registerErrorHandler } from './middleware/error-handler.js'
import { registerHealth } from './routes/health.js'
import { registerAuth } from './routes/auth.js'
import { registerJourney } from './routes/journey.js'
import { registerOrg } from './routes/org.js'
import { registerSpaces } from './routes/spaces.js'
import { registerDocs } from './routes/docs.js'
import { registerConnectors } from './routes/connectors.js'
import { registerKnowledge } from './routes/knowledge.js'
import { registerSearch } from './routes/search.js'
import { createSchema } from './db/schema.js'
import { seedIfEmpty } from './db/seed.js'

export async function buildApp() {
  createSchema()
  seedIfEmpty()
  const app = Fastify({ logger: false })
  await app.register(cors, { origin: true })
  app.register(async (api) => {
    registerHealth(api)
    registerAuth(api)
    registerJourney(api)
    registerOrg(api)
    registerSpaces(api)
    registerDocs(api)
    registerConnectors(api)
    registerKnowledge(api)
    registerSearch(api)
  }, { prefix: API_BASE })
  registerErrorHandler(app)
  return app
}
