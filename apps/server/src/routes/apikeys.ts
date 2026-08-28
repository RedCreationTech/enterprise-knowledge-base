import type { FastifyInstance } from 'fastify'
import { listApiKeys, createApiKey, revokeApiKey, getApiKeyUsage, listCustomApis, createCustomApi, patchCustomApi, deleteCustomApi, listWebhooks, createWebhook } from '../services/apikeys.js'
import { httpError } from '../utils/http-error.js'

export function registerApiKeys(app: FastifyInstance) {
  // API Keys
  app.get('/api-keys', async () => ({ ok: true, data: listApiKeys() }))

  app.post('/api-keys', async (req) => {
    const { name, permissions } = req.body as { name: string; permissions?: string[] }
    if (!name) throw httpError(400, '名称不能为空', 'BAD_REQUEST')
    const key = createApiKey(name, permissions)
    return { ok: true, data: key }
  })

  app.post('/api-keys/:id/revoke', async (req) => {
    const { id } = req.params as { id: string }
    const result = revokeApiKey(id)
    if (!result) {
      const key = listApiKeys().find((k: any) => k.id === id)
      if (!key) throw httpError(404, 'Key 不存在', 'NOT_FOUND')
      throw httpError(409, '该 Key 已吊销', 'KEY_ALREADY_REVOKED')
    }
    return { ok: true, data: result }
  })

  app.get('/api-keys/:id/usage', async (req) => {
    const { id } = req.params as { id: string }
    const result = getApiKeyUsage(id)
    if (!result) throw httpError(404, 'Key 不存在', 'NOT_FOUND')
    return { ok: true, data: result }
  })

  // Custom APIs
  app.get('/custom-apis', async () => ({ ok: true, data: listCustomApis() }))

  app.post('/custom-apis', async (req) => {
    const body = req.body as { name: string; baseUrl: string; method?: string; headersJson?: string; authType?: string }
    if (!body.name || !body.baseUrl) throw httpError(400, 'name 和 baseUrl 不能为空', 'BAD_REQUEST')
    return { ok: true, data: createCustomApi(body) }
  })

  app.patch('/custom-apis/:id', async (req) => {
    const { id } = req.params as { id: string }
    const result = patchCustomApi(id, req.body as Record<string, unknown>)
    if (!result) throw httpError(404, '自定义 API 不存在', 'NOT_FOUND')
    return { ok: true, data: result }
  })

  app.delete('/custom-apis/:id', async (req) => {
    const { id } = req.params as { id: string }
    const result = deleteCustomApi(id)
    if (!result) throw httpError(404, '自定义 API 不存在', 'NOT_FOUND')
    return { ok: true, data: result }
  })

  // Webhooks
  app.get('/webhooks', async () => ({ ok: true, data: listWebhooks() }))

  app.post('/webhooks', async (req) => {
    const body = req.body as { name: string; url: string; events: string[]; subscribed?: boolean }
    if (!body.name || !body.url || !body.events?.length) throw httpError(400, 'name/url/events 不能为空', 'BAD_REQUEST')
    return { ok: true, data: createWebhook(body) }
  })
}
