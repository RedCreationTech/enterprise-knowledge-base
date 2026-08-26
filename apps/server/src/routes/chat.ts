import type { FastifyInstance } from 'fastify'
import {
  ChatSessionListResponse,
  ChatSessionResponse,
  ChatSessionCreateBody,
  ChatMessageListResponse,
  ChatMessageCreateBody,
  ChatMessageCreateResponse,
} from '@kb/shared'
import {
  listChatSessions,
  createChatSession,
  listChatMessages,
  postChatMessage,
} from '../services/chat.js'
import { parseBody } from '../utils/validate.js'
import { httpError } from '../utils/http-error.js'

export function registerChat(app: FastifyInstance) {
  // GET /chat/sessions：历史会话列表（createdAt 倒序，含 messageCount）
  app.get('/chat/sessions', async () => {
    return { ok: true, data: ChatSessionListResponse.parse(listChatSessions()) }
  })

  // POST /chat/sessions：新建会话（title/source/userId 可选，默认 新对话/工作台/u-1）
  app.post('/chat/sessions', async (req) => {
    const body = parseBody(ChatSessionCreateBody, req.body)
    return { ok: true, data: ChatSessionResponse.parse(createChatSession(body)) }
  })

  // GET /chat/sessions/:id/messages：会话消息（createdAt 升序）；会话缺失 404
  app.get('/chat/sessions/:id/messages', async (req) => {
    const { id } = req.params as { id: string }
    const messages = listChatMessages(id)
    if (!messages) throw httpError(404, '会话不存在')
    return { ok: true, data: ChatMessageListResponse.parse(messages) }
  })

  // POST /chat/sessions/:id/messages：追加 user 消息 + 生成 assistant 回复（查答案池，命中/拒答），一并入库
  app.post('/chat/sessions/:id/messages', async (req) => {
    const { id } = req.params as { id: string }
    const body = parseBody(ChatMessageCreateBody, req.body)
    const result = postChatMessage(id, body)
    if (result.status === 'not-found') throw httpError(404, '会话不存在')
    return {
      ok: true,
      data: ChatMessageCreateResponse.parse({ userMessage: result.userMessage, assistantMessage: result.assistantMessage }),
    }
  })
}
