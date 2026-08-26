import {
  ChatMessageCreateBody,
  ChatMessageCreateResponse,
  ChatMessageListResponse,
  ChatMessageResponse,
  ChatSessionCreateBody,
  ChatSessionListResponse,
  ChatSessionResponse,
} from '@kb/shared'
import type { z } from 'zod'
import { apiRequest } from './client'

export type ChatSession = z.infer<typeof ChatSessionResponse>
export type ChatMessage = z.infer<typeof ChatMessageResponse>
export type ChatMessageCreateResult = z.infer<typeof ChatMessageCreateResponse>

/** GET /chat/sessions：历史会话列表（createdAt 倒序，含 messageCount）。 */
export async function getChatSessions(): Promise<ChatSession[]> {
  return apiRequest('/chat/sessions', { schema: ChatSessionListResponse })
}

/** POST /chat/sessions：新建会话（title/source/userId 可选，默认 新对话/工作台/u-1）。 */
export async function createChatSession(body: z.infer<typeof ChatSessionCreateBody> = {}): Promise<ChatSession> {
  return apiRequest('/chat/sessions', { method: 'POST', body, schema: ChatSessionResponse })
}

/** GET /chat/sessions/:id/messages：会话消息（createdAt 升序）。 */
export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  return apiRequest(`/chat/sessions/${sessionId}/messages`, { schema: ChatMessageListResponse })
}

/**
 * POST /chat/sessions/:id/messages：追加 user 消息 + 服务端生成 assistant 回复
 * （查答案池，命中带 citations/confidence，未命中拒答），一并入库返回 { userMessage, assistantMessage }。
 */
export async function postChatMessage(
  sessionId: string,
  body: z.infer<typeof ChatMessageCreateBody>,
): Promise<ChatMessageCreateResult> {
  return apiRequest(`/chat/sessions/${sessionId}/messages`, { method: 'POST', body, schema: ChatMessageCreateResponse })
}
