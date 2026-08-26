import {
  AssistantCreateBody,
  AssistantListResponse,
  AssistantPatch,
  AssistantResponse,
  DeleteResponse,
} from '@kb/shared'
import type { z } from 'zod'
import { apiRequest } from './client'

export type Assistant = z.infer<typeof AssistantResponse>

/** GET /assistants：助手列表（服务端返回裸数组，含 enabled/draft/version）。 */
export async function getAssistants(): Promise<Assistant[]> {
  return apiRequest('/assistants', { schema: AssistantListResponse })
}

/** POST /assistants：新建助手草稿（name 必填；重名 409）。 */
export async function createAssistant(body: z.infer<typeof AssistantCreateBody>): Promise<Assistant> {
  return apiRequest('/assistants', { method: 'POST', body, schema: AssistantResponse })
}

/** PATCH /assistants/:id：编辑草稿（写 draft 不升 version——发布时才生成新版本）。 */
export async function updateAssistant(id: string, body: z.infer<typeof AssistantPatch>): Promise<Assistant> {
  return apiRequest(`/assistants/${id}`, { method: 'PATCH', body, schema: AssistantResponse })
}

/** POST /assistants/:id/publish：草稿发布（draft→生效 + 版本号递增）。 */
export async function publishAssistant(id: string): Promise<Assistant> {
  return apiRequest(`/assistants/${id}/publish`, { method: 'POST', schema: AssistantResponse })
}

/** DELETE /assistants/:id：删除助手。 */
export async function deleteAssistant(id: string): Promise<z.infer<typeof DeleteResponse>> {
  return apiRequest(`/assistants/${id}`, { method: 'DELETE', schema: DeleteResponse })
}
