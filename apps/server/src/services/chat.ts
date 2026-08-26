import { randomUUID } from 'node:crypto'
import { db } from '../db/client.js'
import type { ChatMessage, ChatSession, QaCitation } from '@kb/shared'
import type { ChatMessageCreateBodyInput, ChatSessionCreateBodyInput } from '@kb/shared'

/** chat_sessions 行（SQLite）。 */
interface SessionRow {
  id: string
  title: string
  source: string
  createdAt: string
  userId: string
}

/** chat_messages 行（SQLite）。answerId 命中答案池时非空。 */
interface MessageRow {
  id: string
  sessionId: string
  role: string
  content: string
  answerId: string | null
  createdAt: string
}

/** answer_pool 行（citations 为 JSON 文本：doc/version/page/role 数组）。 */
interface PoolRow {
  id: string
  question: string
  answer: string
  citations: string
  confidence: number
}

/** 新建会话默认口径（镜像前端「新对话」：标题 新对话、来源 工作台、用户 u-1）。 */
export const DEFAULT_TITLE = '新对话'
export const DEFAULT_SOURCE = '工作台'
export const DEFAULT_USER_ID = 'u-1'

/** 拒答文案：镜像 B7 /knowledge-site/qa 的拒答 reason（作为 assistant 消息内容持久化）。 */
export const REFUSAL_CONTENT = '未找到足够可靠的企业知识来回答该问题，为避免误导暂不生成回答。'
export const REFUSAL_MISSING_TYPE = '缺失类型：与该问题直接相关的制度/方案文档'

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * GET /chat/sessions：历史会话列表（createdAt 倒序）。
 * messageCount 由 chat_messages 聚合（LEFT JOIN + GROUP BY，含 user + assistant 全部消息）。
 */
export function listChatSessions(): ChatSession[] {
  const rows = db
    .prepare(
      `SELECT s.id, s.title, s.source, s.createdAt, s.userId, COUNT(m.id) AS messageCount
       FROM chat_sessions s LEFT JOIN chat_messages m ON m.sessionId = s.id
       GROUP BY s.id
       ORDER BY s.createdAt DESC, s.rowid DESC`,
    )
    .all() as (SessionRow & { messageCount: number })[]
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    source: r.source,
    createdAt: r.createdAt,
    userId: r.userId,
    messageCount: r.messageCount,
  }))
}

/** POST /chat/sessions：新建会话（title/source/userId 缺省走默认口径）。 */
export function createChatSession(body: ChatSessionCreateBodyInput): ChatSession {
  const session: ChatSession = {
    id: `chat-${randomUUID()}`,
    title: body.title ?? DEFAULT_TITLE,
    source: body.source ?? DEFAULT_SOURCE,
    createdAt: new Date().toISOString(),
    userId: body.userId ?? DEFAULT_USER_ID,
    messageCount: 0,
  }
  db.prepare('INSERT INTO chat_sessions (id, title, source, createdAt, userId) VALUES (?,?,?,?,?)').run(
    session.id,
    session.title,
    session.source,
    session.createdAt,
    session.userId,
  )
  return session
}

function sessionExists(id: string): boolean {
  return !!db.prepare('SELECT id FROM chat_sessions WHERE id = ?').get(id)
}

/**
 * GET /chat/sessions/:id/messages：会话消息（createdAt 升序）。
 * 会话缺失返回 null（404）。
 */
export function listChatMessages(sessionId: string): ChatMessage[] | null {
  if (!sessionExists(sessionId)) return null
  const rows = db
    .prepare('SELECT * FROM chat_messages WHERE sessionId = ? ORDER BY createdAt ASC, rowid ASC')
    .all(sessionId) as MessageRow[]
  return rows.map(rowToMessage)
}

function rowToMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    answerId: row.answerId,
    createdAt: row.createdAt,
  }
}

/**
 * 答案池命中：精确相等优先；其次包含匹配（问句含池问题全文，或池问题含问句且问句≥4 字）。
 * 语义镜像 B7 knowledge.ts findPoolEntry，但返回完整池行（含 id，供 assistant 消息 answerId 关联）。
 */
function lookupPoolRow(question: string): PoolRow | null {
  const q = question.trim()
  const rows = db.prepare('SELECT * FROM answer_pool ORDER BY rowid').all() as PoolRow[]
  const exact = rows.find((p) => p.question === q)
  if (exact) return exact
  if (q.length >= 4) {
    return rows.find((p) => q.includes(p.question) || (p.question.length >= 4 && p.question.includes(q))) ?? null
  }
  return null
}

/** QA 命中回复负载（镜像 B7 QaHitResponse 的 answered/content/citations/confidence + answerId）。 */
export interface ChatHitReply {
  answered: true
  content: string
  answerId: string
  citations: QaCitation[]
  confidence: number
}

/** QA 拒答回复负载（镜像 B7 QaRefusalResponse 的 answered/searchedCount/missingType，content 为拒答文案）。 */
export interface ChatRefusalReply {
  answered: false
  content: string
  searchedCount: number
  missingType: string
}

export type ChatReply = ChatHitReply | ChatRefusalReply

/**
 * 生成 assistant 回复（镜像 B7 /knowledge-site/qa 语义，但作为聊天消息）：
 * 命中答案池 → 答案内容 + answerId + 引用 + 可信度；未命中 → 诚实拒答
 * （已检索范围 = 答案池条数 + 知识网站文章数，与 B7 searchedCount 口径一致）。
 */
export function generateAssistantReply(content: string): ChatReply {
  const hit = lookupPoolRow(content)
  if (hit) {
    return {
      answered: true,
      content: hit.answer,
      answerId: hit.id,
      citations: parseJson<QaCitation[]>(hit.citations, []),
      confidence: hit.confidence,
    }
  }
  const poolCount = (db.prepare('SELECT COUNT(*) c FROM answer_pool').get() as { c: number }).c
  const siteCount = (db.prepare('SELECT COUNT(*) c FROM knowledge_site').get() as { c: number }).c
  return {
    answered: false,
    content: REFUSAL_CONTENT,
    searchedCount: poolCount + siteCount,
    missingType: REFUSAL_MISSING_TYPE,
  }
}

export type PostChatMessageResult =
  | { status: 'not-found' } // 会话缺失（404）
  | { status: 'ok'; userMessage: ChatMessage; assistantMessage: ChatMessage & ChatReply }

/**
 * POST /chat/sessions/:id/messages：插入 user 消息 → 查答案池生成 assistant 回复
 * → 同一事务写入两条消息，返回 { userMessage, assistantMessage }。
 */
export function postChatMessage(sessionId: string, body: ChatMessageCreateBodyInput): PostChatMessageResult {
  if (!sessionExists(sessionId)) return { status: 'not-found' }

  const reply = generateAssistantReply(body.content)
  const createdAt = new Date().toISOString()
  const userMessage: ChatMessage = {
    id: `msg-${randomUUID()}`,
    sessionId,
    role: 'user',
    content: body.content,
    answerId: null,
    createdAt,
  }
  // 命中/拒答两条分支显式构造，避免 spread 覆盖重复键（content/answerId）
  const assistantMessage: ChatMessage & ChatReply = reply.answered
    ? {
        id: `msg-${randomUUID()}`,
        sessionId,
        role: 'assistant',
        content: reply.content,
        answerId: reply.answerId,
        createdAt,
        answered: true,
        citations: reply.citations,
        confidence: reply.confidence,
      }
    : {
        id: `msg-${randomUUID()}`,
        sessionId,
        role: 'assistant',
        content: reply.content,
        answerId: null,
        createdAt,
        answered: false,
        searchedCount: reply.searchedCount,
        missingType: reply.missingType,
      }

  const insertBoth = db.transaction(() => {
    db.prepare('INSERT INTO chat_messages (id, sessionId, role, content, answerId, createdAt) VALUES (?,?,?,?,?,?)').run(
      userMessage.id,
      userMessage.sessionId,
      userMessage.role,
      userMessage.content,
      userMessage.answerId,
      userMessage.createdAt,
    )
    db.prepare('INSERT INTO chat_messages (id, sessionId, role, content, answerId, createdAt) VALUES (?,?,?,?,?,?)').run(
      assistantMessage.id,
      assistantMessage.sessionId,
      assistantMessage.role,
      assistantMessage.content,
      assistantMessage.answerId,
      assistantMessage.createdAt,
    )
  })
  insertBoth()

  return { status: 'ok', userMessage, assistantMessage }
}
