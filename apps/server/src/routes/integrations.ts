import type { FastifyInstance } from 'fastify'
import { listIntegrations, getIntegrationSummary, patchIntegrationConfig, reauthIntegration } from '../services/integrations.js'
import { httpError } from '../utils/http-error.js'

export function registerIntegrations(app: FastifyInstance) {
  app.get('/integrations', async () => {
    const integrations = listIntegrations()
    const summary = getIntegrationSummary()
    return { ok: true, data: { integrations, summary } }
  })

  app.patch('/integrations/:id/config', async (req) => {
    const { id } = req.params as { id: string }
    const result = patchIntegrationConfig(id, req.body as Record<string, unknown>)
    if (!result) throw httpError(404, '集成不存在', 'NOT_FOUND')
    return { ok: true, data: result }
  })

  app.post('/integrations/:id/reauth', async (req) => {
    const { id } = req.params as { id: string }
    const result = reauthIntegration(id)
    if (!result) throw httpError(404, '集成不存在', 'NOT_FOUND')
    return { ok: true, data: result }
  })
}
