import type { FastifyInstance } from 'fastify'
import {
  AssistantResponse,
  AssistantListResponse,
  AssistantCreateBody,
  AssistantPatch,
  DeleteResponse,
} from '@kb/shared'
import {
  listAssistants,
  createAssistant,
  patchAssistant,
  deleteAssistant,
  publishAssistant,
  DUP_NAME_MESSAGE,
} from '../services/assistants.js'
import { parseBody } from '../utils/validate.js'
import { httpError } from '../utils/http-error.js'

export function registerAssistants(app: FastifyInstance) {
  app.get('/assistants', async () => {
    return { ok: true, data: AssistantListResponse.parse(listAssistants()) }
  })

  app.post('/assistants', async (req) => {
    const body = parseBody(AssistantCreateBody, req.body)
    const result = createAssistant(body)
    if (result.status === 'name-conflict') throw httpError(409, DUP_NAME_MESSAGE)
    return { ok: true, data: AssistantResponse.parse(result.assistant) }
  })

  app.patch('/assistants/:id', async (req) => {
    const { id } = req.params as { id: string }
    const patch = parseBody(AssistantPatch, req.body)
    const assistant = patchAssistant(id, patch)
    if (!assistant) throw httpError(404, '助手不存在')
    return { ok: true, data: AssistantResponse.parse(assistant) }
  })

  app.delete('/assistants/:id', async (req) => {
    const { id } = req.params as { id: string }
    if (!deleteAssistant(id)) throw httpError(404, '助手不存在')
    return { ok: true, data: DeleteResponse.parse({ deleted: true }) }
  })

  app.post('/assistants/:id/publish', async (req) => {
    const { id } = req.params as { id: string }
    const result = publishAssistant(id)
    if (result.status === 'not-found') throw httpError(404, '助手不存在')
    if (result.status === 'no-draft') throw httpError(409, '没有待发布的草稿', 'NO_DRAFT')
    if (result.status === 'bad-draft') throw httpError(400, '草稿配置非法')
    return { ok: true, data: AssistantResponse.parse(result.assistant) }
  })
}
