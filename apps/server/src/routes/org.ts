import type { FastifyInstance } from 'fastify'
import {
  OrgResponse,
  OrgPatch,
  MemberResponse,
  MemberCreateBody,
  MemberPatch,
  PlanResponse,
  DeleteResponse,
} from '@kb/shared'
import {
  getOrg,
  patchOrg,
  listMembers,
  createMember,
  patchMember,
  deleteMember,
  getPlan,
  SEAT_LIMIT_MESSAGE,
} from '../services/org.js'
import { parseBody } from '../utils/validate.js'
import { httpError } from '../utils/http-error.js'

export function registerOrg(app: FastifyInstance) {
  app.get('/org', async () => {
    const org = getOrg()
    if (!org) throw httpError(409, '组织不存在')
    return { ok: true, data: OrgResponse.parse(org) }
  })

  app.patch('/org', async (req) => {
    const patch = parseBody(OrgPatch, req.body)
    const org = patchOrg(patch)
    if (!org) throw httpError(409, '组织不存在')
    return { ok: true, data: OrgResponse.parse(org) }
  })

  app.get('/org/members', async () => {
    const members = listMembers()
    return { ok: true, data: members.map((m) => MemberResponse.parse(m)) }
  })

  app.post('/org/members', async (req) => {
    const body = parseBody(MemberCreateBody, req.body)
    const result = createMember(body)
    if (result.status === 'seat-limit') throw httpError(409, SEAT_LIMIT_MESSAGE, 'SEAT_LIMIT')
    if (result.status === 'no-plan') throw httpError(409, '套餐不存在')
    return { ok: true, data: MemberResponse.parse(result.member) }
  })

  app.patch('/org/members/:id', async (req) => {
    const { id } = req.params as { id: string }
    const patch = parseBody(MemberPatch, req.body)
    const member = patchMember(id, patch)
    if (!member) throw httpError(404, '成员不存在')
    return { ok: true, data: MemberResponse.parse(member) }
  })

  app.delete('/org/members/:id', async (req) => {
    const { id } = req.params as { id: string }
    if (!deleteMember(id)) throw httpError(404, '成员不存在')
    return { ok: true, data: DeleteResponse.parse({ deleted: true }) }
  })

  app.get('/plan', async () => {
    const plan = getPlan()
    if (!plan) throw httpError(409, '套餐不存在')
    return { ok: true, data: PlanResponse.parse(plan) }
  })
}
