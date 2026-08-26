import {
  DeleteResponse,
  InstructionCreateBody,
  InstructionListResponse,
  InstructionPatch,
  InstructionResponse,
  InstructionRollbackBody,
  InstructionVersionListResponse,
} from '@kb/shared'
import type { z } from 'zod'
import { apiRequest } from './client'

export type Instruction = z.infer<typeof InstructionResponse>
export type InstructionVersion = z.infer<typeof InstructionVersionListResponse>[number]

/** GET /instructions：指令列表（seed 7 条：4 系统预置 readonly + 3 自定义）。 */
export async function getInstructions(): Promise<Instruction[]> {
  return apiRequest('/instructions', { schema: InstructionListResponse })
}

/** POST /instructions：新建自定义草稿（name 必填；重名 409）。 */
export async function createInstruction(body: z.infer<typeof InstructionCreateBody>): Promise<Instruction> {
  return apiRequest('/instructions', { method: 'POST', body, schema: InstructionResponse })
}

/** PATCH /instructions/:id：草稿编辑（readonly→400、已发布→409）。 */
export async function updateInstruction(id: string, body: z.infer<typeof InstructionPatch>): Promise<Instruction> {
  return apiRequest(`/instructions/${id}`, { method: 'PATCH', body, schema: InstructionResponse })
}

/** POST /instructions/:id/publish：草稿→已发布（版本 +diff）；readonly→400、无变更→409。 */
export async function publishInstruction(id: string): Promise<Instruction> {
  return apiRequest(`/instructions/${id}/publish`, { method: 'POST', schema: InstructionResponse })
}

/** POST /instructions/:id/rollback：从指定版本生成新草稿（body.version 可选→最新）。 */
export async function rollbackInstruction(id: string, body: z.infer<typeof InstructionRollbackBody> = {}): Promise<Instruction> {
  return apiRequest(`/instructions/${id}/rollback`, { method: 'POST', body, schema: InstructionResponse })
}

/** DELETE /instructions/:id：删除自定义指令（readonly→400）。 */
export async function deleteInstruction(id: string): Promise<z.infer<typeof DeleteResponse>> {
  return apiRequest(`/instructions/${id}`, { method: 'DELETE', schema: DeleteResponse })
}

/** GET /instructions/:id/versions：版本历史（version 倒序）。 */
export async function getInstructionVersions(id: string): Promise<InstructionVersion[]> {
  return apiRequest(`/instructions/${id}/versions`, { schema: InstructionVersionListResponse })
}
