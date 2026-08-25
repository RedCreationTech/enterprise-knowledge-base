import Fastify from 'fastify'
import cors from '@fastify/cors'
import { API_BASE } from '@kb/shared'
import { registerErrorHandler } from './middleware/error-handler.js'
import { registerHealth } from './routes/health.js'
import { registerAuth } from './routes/auth.js'

export async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(cors, { origin: true })
  app.register(async (api) => {
    registerHealth(api)
    registerAuth(api)
  }, { prefix: API_BASE })
  registerErrorHandler(app)
  return app
}
