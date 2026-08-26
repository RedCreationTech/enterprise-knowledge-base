import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { API_BASE } from '@kb/shared'

// 测试隔离：动态 import 前先指向内存库（client.ts 单例读取 KB_DB_PATH）
process.env.KB_DB_PATH = ':memory:'
const { buildApp } = await import('../src/app.js')
const { db } = await import('../src/db/client.js')
const { seedIfEmpty } = await import('../src/db/seed.js')

const app = await buildApp()

/** 回到 seed 基线：业务表清空后重新播种（含 10 个会话 + 消息 + 答案池）。 */
function resetSeed() {
  db.exec(
    'DELETE FROM org; DELETE FROM plan; DELETE FROM members; DELETE FROM users; DELETE FROM trial_journey; DELETE FROM trial_applications; DELETE FROM spaces; DELETE FROM docs; DELETE FROM connectors; DELETE FROM sync_tasks; DELETE FROM knowledge_map; DELETE FROM knowledge_site; DELETE FROM answer_pool; DELETE FROM assistant_versions; DELETE FROM assistants; DELETE FROM chat_messages; DELETE FROM chat_sessions',
  )
  seedIfEmpty()
}

beforeEach(resetSeed)

interface SessionJson {
  id: string
  title: string
  source: string
  createdAt: string
  userId: string
  messageCount: number
}

interface MessageJson {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  answerId: string | null
  createdAt: string
}

interface AssistantReplyJson extends MessageJson {
  answered: boolean
  citations?: { doc: string; version: string; page: string; role: string }[]
  confidence?: number
  searchedCount?: number
  missingType?: string
}

const listSessions = async () => (await app.inject({ method: 'GET', url: `${API_BASE}/chat/sessions` })).json().data as SessionJson[]

const sessionById = (list: SessionJson[], id: string) => list.find((s) => s.id === id)

const listMessages = async (sessionId: string) =>
  (await app.inject({ method: 'GET', url: `${API_BASE}/chat/sessions/${sessionId}/messages` })).json().data as MessageJson[]

/** 答案池行（id/question/answer/confidence/citations）。 */
const poolById = (id: string) =>
  db.prepare('SELECT * FROM answer_pool WHERE id = ?').get(id) as { id: string; question: string; answer: string; citations: string; confidence: number }

// ---------- GET /chat/sessions 列表 ----------

test('GET /chat/sessions -> 10 个 seed 会话（id/title/source/createdAt/userId/messageCount），createdAt 倒序', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/chat/sessions` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)

  const list = body.data as SessionJson[]
  assert.equal(list.length, 10)
  // createdAt 倒序（最近在前）
  for (let i = 1; i < list.length; i += 1) {
    assert.ok(list[i - 1].createdAt >= list[i].createdAt, `sessions[${i}] 乱序`)
  }
  // 首条为今天最新会话 chat-1（差旅住宿标准）
  assert.equal(list[0].id, 'chat-1')
  assert.equal(list[0].title, '差旅住宿标准是多少？')
  assert.equal(list[0].source, '工作台')
  assert.equal(list[0].userId, 'u-1')

  // 字段齐全
  for (const s of list) {
    assert.equal(typeof s.id, 'string')
    assert.equal(typeof s.title, 'string')
    assert.equal(typeof s.source, 'string')
    assert.equal(typeof s.createdAt, 'string')
    assert.equal(typeof s.userId, 'string')
    assert.equal(typeof s.messageCount, 'number')
    assert.ok(s.messageCount >= 2, `会话 ${s.id} messageCount 至少 2（一问一答），实际 ${s.messageCount}`)
  }
})

test('GET /chat/sessions -> 来源渠道 4 口径：工作台/飞书/企业微信/Web 门户 均有会话', async () => {
  const list = await listSessions()
  const sources = new Set(list.map((s) => s.source))
  assert.deepEqual(
    [...sources].sort(),
    ['企业微信', '工作台', 'Web 门户', '飞书'].sort(),
  )
})

test('GET /chat/sessions -> messageCount 与消息表聚合一致（chat-2 4 条 / chat-4 6 条 / chat-10 2 条）', async () => {
  const list = await listSessions()
  const count = (sessionId: string) =>
    (db.prepare('SELECT COUNT(*) c FROM chat_messages WHERE sessionId = ?').get(sessionId) as { c: number }).c
  for (const s of list) {
    assert.equal(s.messageCount, count(s.id), `会话 ${s.id} messageCount 应与消息行数一致`)
  }
  assert.equal(sessionById(list, 'chat-2')!.messageCount, 4)
  assert.equal(sessionById(list, 'chat-4')!.messageCount, 6)
  assert.equal(sessionById(list, 'chat-10')!.messageCount, 2)
})

test('GET /chat/sessions -> 响应通过 @kb/shared schema（envelope ok:true + 会话结构）', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/chat/sessions` })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().ok, true)
  assert.ok(Array.isArray(res.json().data))
})

// ---------- POST /chat/sessions 新建会话 ----------

test('POST /chat/sessions -> 默认会话（title 新对话/source 工作台/userId u-1/messageCount 0），列表可见', async () => {
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/chat/sessions`, payload: {} })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const s = body.data as SessionJson
  assert.equal(s.title, '新对话')
  assert.equal(s.source, '工作台')
  assert.equal(s.userId, 'u-1')
  assert.equal(s.messageCount, 0)
  assert.ok(s.id.startsWith('chat-'))
  assert.ok(!Number.isNaN(Date.parse(s.createdAt)), 'createdAt 应为可解析的 ISO 时间')

  const list = await listSessions()
  assert.equal(list.length, 11)
  assert.ok(sessionById(list, s.id))
})

test('POST /chat/sessions -> 可选字段生效（title/source/userId）', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/chat/sessions`,
    payload: { title: '报价审批咨询', source: '飞书', userId: 'u-2' },
  })
  assert.equal(res.statusCode, 200)
  const s = res.json().data as SessionJson
  assert.equal(s.title, '报价审批咨询')
  assert.equal(s.source, '飞书')
  assert.equal(s.userId, 'u-2')
})

// ---------- GET /chat/sessions/:id/messages 消息列表 ----------

test('GET /chat/sessions/:id/messages -> chat-2 消息（一问一答交替，createdAt 升序，命中答案池含 answerId）', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/chat/sessions/chat-2/messages` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)

  const msgs = body.data as MessageJson[]
  assert.equal(msgs.length, 4)
  // createdAt 升序
  for (let i = 1; i < msgs.length; i += 1) {
    assert.ok(msgs[i - 1].createdAt <= msgs[i].createdAt, `messages[${i}] 乱序`)
  }
  // 角色交替：user/assistant/user/assistant
  assert.deepEqual(
    msgs.map((m) => m.role),
    ['user', 'assistant', 'user', 'assistant'],
  )
  // 首问与首答（命中答案池 ap-1，answerId 关联）
  assert.equal(msgs[0].content, '客户报价折扣超过 10% 需要谁审批？')
  assert.equal(msgs[0].answerId, null)
  assert.equal(msgs[1].role, 'assistant')
  assert.equal(msgs[1].answerId, 'ap-1')
  assert.equal(msgs[1].content, poolById('ap-1').answer)
  // 追问与次答（ap-3：审批一般需要多长时间？）
  assert.equal(msgs[2].content, '审批一般需要多长时间？')
  assert.equal(msgs[3].answerId, 'ap-3')

  // 字段齐全：id/sessionId/role/content/answerId/createdAt
  for (const m of msgs) {
    assert.equal(typeof m.id, 'string')
    assert.equal(m.sessionId, 'chat-2')
    assert.ok(['user', 'assistant'].includes(m.role))
    assert.equal(typeof m.content, 'string')
    assert.equal(typeof m.createdAt, 'string')
  }
})

test('GET /chat/sessions/:id/messages -> 未知会话 404 NOT_FOUND', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/chat/sessions/chat-nope/messages` })
  assert.equal(res.statusCode, 404)
  assert.equal(res.json().error.code, 'NOT_FOUND')
})

// ---------- POST /chat/sessions/:id/messages 追加消息（QA 命中/拒答） ----------

test('POST /chat/sessions/:id/messages -> QA 命中：assistant 回复 = 答案池答案 + answerId + 引用 + 可信度，两条消息均落库', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/chat/sessions/chat-2/messages`,
    payload: { role: 'user', content: '产品 X 的核心优势是什么？' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)

  const { userMessage, assistantMessage } = body.data as { userMessage: MessageJson; assistantMessage: AssistantReplyJson }

  // userMessage：role=user、content 原样、answerId null
  assert.equal(userMessage.role, 'user')
  assert.equal(userMessage.content, '产品 X 的核心优势是什么？')
  assert.equal(userMessage.answerId, null)
  assert.equal(userMessage.sessionId, 'chat-2')

  // assistantMessage：命中（answered true + 答案内容 + answerId + 引用 + 可信度）
  assert.equal(assistantMessage.role, 'assistant')
  assert.equal(assistantMessage.answered, true)
  const ap4 = poolById('ap-4')
  assert.equal(assistantMessage.content, ap4.answer)
  assert.equal(assistantMessage.answerId, 'ap-4')
  assert.equal(assistantMessage.confidence, ap4.confidence)
  assert.equal(Array.isArray(assistantMessage.citations), true)
  assert.equal(assistantMessage.citations!.length, JSON.parse(ap4.citations).length)
  assert.equal(assistantMessage.citations![0].doc, '《产品 X 白皮书》')

  // 两条消息均落库（chat-2 原 4 条 → 6 条；user 消息与 assistant 消息各 1 条新行）
  const rows = db
    .prepare("SELECT role, content, answerId FROM chat_messages WHERE sessionId = 'chat-2' ORDER BY createdAt ASC, rowid ASC")
    .all() as { role: string; content: string; answerId: string | null }[]
  assert.equal(rows.length, 6)
  assert.deepEqual(
    rows.slice(-2).map((r) => r.role),
    ['user', 'assistant'],
  )
  assert.equal(rows[4].content, '产品 X 的核心优势是什么？')
  assert.equal(rows[5].answerId, 'ap-4')

  // 会话 messageCount 同步为 6
  assert.equal((await listSessions()).find((s) => s.id === 'chat-2')!.messageCount, 6)
})

test('POST /chat/sessions/:id/messages -> QA 未命中：诚实拒答（拒答文案/searchedCount/missingType）作为 assistant 消息持久化', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/chat/sessions/chat-5/messages`,
    payload: { role: 'user', content: '公司食堂几点开门？' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)

  const { userMessage, assistantMessage } = body.data as { userMessage: MessageJson; assistantMessage: AssistantReplyJson }

  assert.equal(userMessage.role, 'user')
  assert.equal(userMessage.content, '公司食堂几点开门？')

  // 拒答：answered false、拒答文案、已检索范围（答案池 20 + 知识网站 25）、缺失类型；answerId null
  assert.equal(assistantMessage.answered, false)
  assert.equal(assistantMessage.answerId, null)
  assert.ok(assistantMessage.content.includes('未找到足够可靠的企业知识'), `拒答文案异常：${assistantMessage.content}`)
  assert.equal(typeof assistantMessage.searchedCount, 'number')
  assert.ok(assistantMessage.searchedCount! > 0)
  assert.ok(assistantMessage.missingType!.includes('缺失类型'))

  // 拒答文案已持久化（chat-5 原 2 条 → 4 条，末条为拒答）
  const rows = db
    .prepare("SELECT role, content, answerId FROM chat_messages WHERE sessionId = 'chat-5' ORDER BY createdAt ASC, rowid ASC")
    .all() as { role: string; content: string; answerId: string | null }[]
  assert.equal(rows.length, 4)
  assert.equal(rows[2].role, 'user')
  assert.equal(rows[3].role, 'assistant')
  assert.equal(rows[3].content, assistantMessage.content)
  assert.equal(rows[3].answerId, null)
})

test('POST /chat/sessions/:id/messages -> 新会话首问：两条消息落库、sessionId 一致、messageCount 2', async () => {
  const created = (
    await app.inject({ method: 'POST', url: `${API_BASE}/chat/sessions`, payload: { title: '质保咨询' } })
  ).json().data as SessionJson

  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/chat/sessions/${created.id}/messages`,
    payload: { role: 'user', content: '质保期内维修收费吗？' },
  })
  assert.equal(res.statusCode, 200)
  const { userMessage, assistantMessage } = res.json().data as { userMessage: MessageJson; assistantMessage: AssistantReplyJson }
  assert.equal(userMessage.sessionId, created.id)
  assert.equal(assistantMessage.sessionId, created.id)
  assert.equal(assistantMessage.answered, true)
  assert.equal(assistantMessage.answerId, 'ap-14')
  assert.ok(assistantMessage.content.includes('免费'))

  // 列表 messageCount 变为 2
  assert.equal((await listSessions()).find((s) => s.id === created.id)!.messageCount, 2)
})

test('POST /chat/sessions/:id/messages -> 未知会话 404；空 content / 缺 content / role 非 user -> 400', async () => {
  const missing = await app.inject({
    method: 'POST',
    url: `${API_BASE}/chat/sessions/chat-nope/messages`,
    payload: { role: 'user', content: '质保期如何计算？' },
  })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')

  for (const payload of [
    { role: 'user', content: '' },
    { role: 'user', content: '   ' },
    { role: 'user' },
    {},
    { role: 'assistant', content: '你好' },
  ]) {
    const bad = await app.inject({ method: 'POST', url: `${API_BASE}/chat/sessions/chat-1/messages`, payload })
    assert.equal(bad.statusCode, 400, JSON.stringify(payload))
    assert.equal(bad.json().error.code, 'BAD_REQUEST')
  }
})

// ---------- 落库持久化 ----------

test('对话 seed 落库：10 会话 + 42 消息（4 渠道均有），答案池问题作为首问命中 answerId', async () => {
  assert.equal((db.prepare('SELECT COUNT(*) c FROM chat_sessions').get() as { c: number }).c, 10)
  assert.equal((db.prepare('SELECT COUNT(*) c FROM chat_messages').get() as { c: number }).c, 42)

  // 首问命中答案池的会话：assistant 消息 answerId 指向池条目，且 content 与池答案一致
  const rows = db
    .prepare("SELECT sessionId, content, answerId FROM chat_messages WHERE answerId IS NOT NULL ORDER BY sessionId, rowid")
    .all() as { sessionId: string; content: string; answerId: string }[]
  assert.ok(rows.length >= 10, `命中答案池的 seed 消息至少 10 条，实际 ${rows.length}`)
  for (const r of rows) {
    assert.equal(r.content, poolById(r.answerId).answer, `${r.sessionId} 消息内容应与答案池 ${r.answerId} 一致`)
  }
})
