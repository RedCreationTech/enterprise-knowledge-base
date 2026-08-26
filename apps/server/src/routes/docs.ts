import type { FastifyInstance } from 'fastify'
import {
  DocListQuery,
  DocListResponse,
  DocsUploadBody,
  DocResponse,
  DocPatch,
  BatchArchiveBody,
  BatchMoveBody,
  BatchResponse,
  DeleteResponse,
} from '@kb/shared'
import { listDocs, patchDoc, deleteDoc, batchArchive, batchMove } from '../services/docs.js'
import { uploadDoc } from '../services/spaces.js'
import { parseBody, parseQuery } from '../utils/validate.js'
import { httpError } from '../utils/http-error.js'

export function registerDocs(app: FastifyInstance) {
  app.get('/docs', async (req) => {
    const query = parseQuery(DocListQuery, req.query as Record<string, unknown>)
    const result = listDocs(query)
    return { ok: true, data: DocListResponse.parse(result) }
  })

  app.post('/docs/upload', async (req) => {
    const body = parseBody(DocsUploadBody, req.body)
    const doc = uploadDoc(body.spaceId, body)
    if (!doc) throw httpError(404, '空间不存在')
    return { ok: true, data: DocResponse.parse(doc) }
  })

  app.patch('/docs/:id', async (req) => {
    const { id } = req.params as { id: string }
    const patch = parseBody(DocPatch, req.body)
    const result = patchDoc(id, patch)
    if (result.status === 'not-found') throw httpError(404, '文档不存在')
    if (result.status === 'space-not-found') throw httpError(404, '空间不存在')
    return { ok: true, data: DocResponse.parse(result.doc) }
  })

  app.delete('/docs/:id', async (req) => {
    const { id } = req.params as { id: string }
    if (!deleteDoc(id)) throw httpError(404, '文档不存在')
    return { ok: true, data: DeleteResponse.parse({ deleted: true }) }
  })

  app.post('/docs/batch-archive', async (req) => {
    const body = parseBody(BatchArchiveBody, req.body)
    const result = batchArchive(body.ids)
    return { ok: true, data: BatchResponse.parse(result) }
  })

  app.post('/docs/batch-move', async (req) => {
    const body = parseBody(BatchMoveBody, req.body)
    const result = batchMove(body.ids, body.spaceId)
    if (result.status === 'space-not-found') throw httpError(404, '空间不存在')
    return { ok: true, data: BatchResponse.parse({ updated: result.updated }) }
  })
}
