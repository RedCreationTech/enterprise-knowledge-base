import type { FastifyInstance } from 'fastify'
import {
  InstructionListResponse,
  InstructionResponse,
  InstructionCreateBody,
  InstructionPatch,
  InstructionRollbackBody,
  InstructionVersionListResponse,
  DeleteResponse,
} from '@kb/shared'
import {
  listInstructions,
  createInstruction,
  patchInstruction,
  deleteInstruction,
  publishInstruction,
  rollbackInstruction,
  listInstructionVersions,
  DUP_NAME_MESSAGE,
  READONLY_MESSAGE,
  PUBLISHED_NOT_EDITABLE_MESSAGE,
  NO_CHANGES_MESSAGE,
} from '../services/instructions.js'
import { parseBody } from '../utils/validate.js'
import { httpError } from '../utils/http-error.js'

export function registerInstructions(app: FastifyInstance) {
  // GET /instructions：指令列表（seed 7 条：4 系统预置 readonly + 3 自定义）
  app.get('/instructions', async () => {
    return { ok: true, data: InstructionListResponse.parse(listInstructions()) }
  })

  // POST /instructions：新建自定义草稿（name 必填；重名 409）
  app.post('/instructions', async (req) => {
    const body = parseBody(InstructionCreateBody, req.body)
    const result = createInstruction(body)
    if (result.status === 'name-conflict') throw httpError(409, DUP_NAME_MESSAGE)
    return { ok: true, data: InstructionResponse.parse(result.instruction) }
  })

  // PATCH /instructions/:id：草稿编辑（name/text/scope 白名单）；readonly→400、已发布→409
  app.patch('/instructions/:id', async (req) => {
    const { id } = req.params as { id: string }
    const patch = parseBody(InstructionPatch, req.body)
    const result = patchInstruction(id, patch)
    if (result.status === 'not-found') throw httpError(404, '指令不存在')
    if (result.status === 'readonly') throw httpError(400, READONLY_MESSAGE, 'READONLY')
    if (result.status === 'published') throw httpError(409, PUBLISHED_NOT_EDITABLE_MESSAGE, 'PUBLISHED_NOT_EDITABLE')
    return { ok: true, data: InstructionResponse.parse(result.instruction) }
  })

  // DELETE /instructions/:id：删除自定义指令 + 级联版本行；readonly→400
  app.delete('/instructions/:id', async (req) => {
    const { id } = req.params as { id: string }
    const result = deleteInstruction(id)
    if (result.status === 'not-found') throw httpError(404, '指令不存在')
    if (result.status === 'readonly') throw httpError(400, READONLY_MESSAGE, 'READONLY')
    return { ok: true, data: DeleteResponse.parse({ deleted: true }) }
  })

  // POST /instructions/:id/publish：草稿→已发布，version+1 + 版本行（text+diff）；readonly→400、无变更→409
  app.post('/instructions/:id/publish', async (req) => {
    const { id } = req.params as { id: string }
    const result = publishInstruction(id)
    if (result.status === 'not-found') throw httpError(404, '指令不存在')
    if (result.status === 'readonly') throw httpError(400, READONLY_MESSAGE, 'READONLY')
    if (result.status === 'no-changes') throw httpError(409, NO_CHANGES_MESSAGE, 'NO_CHANGES')
    return { ok: true, data: InstructionResponse.parse(result.instruction) }
  })

  // POST /instructions/:id/rollback：从指定版本生成新草稿（body.version 可选→最新）；readonly→400、版本缺失→404
  app.post('/instructions/:id/rollback', async (req) => {
    const { id } = req.params as { id: string }
    const body = parseBody(InstructionRollbackBody, req.body)
    const result = rollbackInstruction(id, body)
    if (result.status === 'not-found') throw httpError(404, '指令不存在')
    if (result.status === 'readonly') throw httpError(400, READONLY_MESSAGE, 'READONLY')
    if (result.status === 'version-not-found') throw httpError(404, '版本不存在')
    return { ok: true, data: InstructionResponse.parse(result.instruction) }
  })

  // GET /instructions/:id/versions：版本历史（version 倒序）；指令缺失 404
  app.get('/instructions/:id/versions', async (req) => {
    const { id } = req.params as { id: string }
    const versions = listInstructionVersions(id)
    if (!versions) throw httpError(404, '指令不存在')
    return { ok: true, data: InstructionVersionListResponse.parse(versions) }
  })
}
