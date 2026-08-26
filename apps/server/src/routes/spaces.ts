import type { FastifyInstance } from 'fastify'
import { SpaceResponse, SpaceCreateBody, SpacePatch, DocResponse, DocUploadBody, DeleteResponse } from '@kb/shared'
import {
  listSpaces,
  createSpace,
  patchSpace,
  deleteSpace,
  uploadDoc,
  DEFAULT_SPACE_ID,
  DEFAULT_SPACE_NAME,
} from '../services/spaces.js'
import { parseBody } from '../utils/validate.js'
import { httpError } from '../utils/http-error.js'

export function registerSpaces(app: FastifyInstance) {
  app.get('/spaces', async () => {
    const spaces = listSpaces()
    return { ok: true, data: spaces.map((s) => SpaceResponse.parse(s)) }
  })

  app.post('/spaces', async (req) => {
    const body = parseBody(SpaceCreateBody, req.body)
    const result = createSpace(body)
    if (result.status === 'duplicate') throw httpError(409, '空间名称已存在', 'SPACE_DUPLICATE')
    return { ok: true, data: SpaceResponse.parse(result.space) }
  })

  app.patch('/spaces/:id', async (req) => {
    const { id } = req.params as { id: string }
    const patch = parseBody(SpacePatch, req.body)
    // 默认伞空间不可重命名（其余字段可改）
    if (id === DEFAULT_SPACE_ID && patch.name !== undefined) {
      throw httpError(400, `${DEFAULT_SPACE_NAME}不可重命名`)
    }
    const space = patchSpace(id, patch)
    if (!space) throw httpError(404, '空间不存在')
    return { ok: true, data: SpaceResponse.parse(space) }
  })

  app.delete('/spaces/:id', async (req) => {
    const { id } = req.params as { id: string }
    if (id === DEFAULT_SPACE_ID) throw httpError(400, `${DEFAULT_SPACE_NAME}不可删除`)
    if (!deleteSpace(id)) throw httpError(404, '空间不存在')
    return { ok: true, data: DeleteResponse.parse({ deleted: true }) }
  })

  app.post('/spaces/:id/upload', async (req) => {
    const { id } = req.params as { id: string }
    const body = parseBody(DocUploadBody, req.body)
    const doc = uploadDoc(id, body)
    if (!doc) throw httpError(404, '空间不存在')
    return { ok: true, data: DocResponse.parse(doc) }
  })
}
