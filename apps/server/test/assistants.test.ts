import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { API_BASE } from '@kb/shared'

// 测试隔离：动态 import 前先指向内存库（client.ts 单例读取 KB_DB_PATH）
process.env.KB_DB_PATH = ':memory:'
const { buildApp } = await import('../src/app.js')
const { db } = await import('../src/db/client.js')
const { seedIfEmpty } = await import('../src/db/seed.js')

const app = await buildApp()

/** 回到 seed 基线：业务表清空后重新播种（含 2 个助手）。 */
function resetSeed() {
  db.exec(
    'DELETE FROM org; DELETE FROM plan; DELETE FROM members; DELETE FROM users; DELETE FROM trial_journey; DELETE FROM trial_applications; DELETE FROM spaces; DELETE FROM docs; DELETE FROM connectors; DELETE FROM sync_tasks; DELETE FROM knowledge_map; DELETE FROM knowledge_site; DELETE FROM answer_pool; DELETE FROM assistant_versions; DELETE FROM assistants',
  )
  seedIfEmpty()
}

beforeEach(resetSeed)

interface AssistantJson {
  id: string
  name: string
  icon: string
  desc: string
  scope: string
  enabled: boolean
  draft: string
  version: number
}

const listAssistants = async () =>
  (await app.inject({ method: 'GET', url: `${API_BASE}/assistants` })).json().data as AssistantJson[]

const assistantById = (list: AssistantJson[], id: string) => list.find((a) => a.id === id)

const versionRows = (assistantId: string) =>
  db.prepare('SELECT * FROM assistant_versions WHERE assistantId = ? ORDER BY version ASC').all(assistantId) as Array<{
    id: string
    assistantId: string
    version: number
    config: string
    publishedAt: string
  }>

/** 草稿配置（发布后应用到 live 字段的 JSON）。 */
const draftConfig = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ name: '企业知识助手（新版）', icon: '🤖', desc: '全员 · 全部知识空间', scope: '全部知识空间', enabled: true, ...over })

// ---------- GET /assistants 列表 ----------

test('GET /assistants -> seed 2 个助手（企业知识助手/销售问答助手），字段齐全、口径对齐 aiAssistant.mock', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/assistants` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)

  const list = body.data as AssistantJson[]
  assert.equal(list.length, 2)
  assert.deepEqual(
    list.map((a) => a.id),
    ['asst-kb', 'asst-sales'],
  )

  const kb = assistantById(list, 'asst-kb')!
  assert.equal(kb.name, '企业知识助手')
  assert.equal(kb.icon, '🤖')
  assert.equal(kb.scope, '全部知识空间')
  assert.equal(kb.desc, '全员 · 全部知识空间')

  const sales = assistantById(list, 'asst-sales')!
  assert.equal(sales.name, '销售问答助手')
  assert.equal(sales.icon, '💼')
  assert.equal(sales.scope, '产品与报价知识')
  assert.equal(sales.desc, '销售+售前 · 产品与报价知识')

  // 口径：enabled=true、version=1、draft 为空
  for (const a of list) {
    assert.equal(a.enabled, true)
    assert.equal(a.version, 1)
    assert.equal(a.draft, '')
    // 字段齐全：id/name/icon/desc/scope/enabled/draft/version
    assert.equal(typeof a.id, 'string')
    assert.equal(typeof a.name, 'string')
    assert.equal(typeof a.icon, 'string')
    assert.equal(typeof a.desc, 'string')
    assert.equal(typeof a.scope, 'string')
    assert.equal(typeof a.version, 'number')
  }
})

test('GET /assistants -> 响应通过 @kb/shared schema（envelope ok:true + 助手结构）', async () => {
  const list = await listAssistants()
  assert.equal(list.length, 2)
  assert.ok(assistantById(list, 'asst-sales'))
})

// ---------- POST /assistants 创建草稿 ----------

test('POST /assistants -> 创建草稿（name 必填；默认 icon ✨/desc ""/scope ""/enabled true/draft ""/version 1）', async () => {
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/assistants`, payload: { name: '客服问答助手' } })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const a = body.data as AssistantJson
  assert.equal(a.name, '客服问答助手')
  assert.equal(a.icon, '✨')
  assert.equal(a.desc, '')
  assert.equal(a.scope, '')
  assert.equal(a.enabled, true)
  assert.equal(a.draft, '')
  assert.equal(a.version, 1)
  assert.ok(a.id.startsWith('asst-'))

  // 列表现为 3 个
  const list = await listAssistants()
  assert.equal(list.length, 3)
  assert.ok(assistantById(list, a.id))
})

test('POST /assistants -> 可选字段生效（icon/desc/scope）；缺 name / 空 name -> 400 BAD_REQUEST', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/assistants`,
    payload: { name: 'IT-SOP 助手', icon: '🛠', desc: 'IT 团队 · IT-SOP 空间', scope: 'IT-SOP 空间' },
  })
  assert.equal(res.statusCode, 200)
  const a = res.json().data as AssistantJson
  assert.equal(a.icon, '🛠')
  assert.equal(a.desc, 'IT 团队 · IT-SOP 空间')
  assert.equal(a.scope, 'IT-SOP 空间')

  for (const payload of [{}, { name: '' }]) {
    const bad = await app.inject({ method: 'POST', url: `${API_BASE}/assistants`, payload })
    assert.equal(bad.statusCode, 400, JSON.stringify(payload))
    assert.equal(bad.json().error.code, 'BAD_REQUEST')
  }
})

test('POST /assistants -> 同名助手 -> 409 CONFLICT', async () => {
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/assistants`, payload: { name: '企业知识助手' } })
  assert.equal(res.statusCode, 409)
  assert.equal(res.json().error.code, 'CONFLICT')
  // 不落库：列表仍 2 个
  assert.equal((await listAssistants()).length, 2)
})

// ---------- PATCH /assistants/:id 草稿编辑 ----------

test('PATCH /assistants/:id -> 白名单字段更新（name/icon/desc/scope/enabled/draft），version 不变', async () => {
  const draft = draftConfig({ name: '企业知识助手（草稿）' })
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/assistants/asst-kb`,
    payload: { name: '企业知识助手（草稿）', desc: '全员 · 全部知识空间（草稿）', enabled: false, draft },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const a = body.data as AssistantJson
  assert.equal(a.name, '企业知识助手（草稿）')
  assert.equal(a.desc, '全员 · 全部知识空间（草稿）')
  assert.equal(a.enabled, false)
  assert.equal(a.draft, draft)
  // 草稿编辑不升版本
  assert.equal(a.version, 1)

  // 落库
  const row = db.prepare('SELECT name, enabled, draft, version FROM assistants WHERE id = ?').get('asst-kb') as {
    name: string
    enabled: number
    draft: string
    version: number
  }
  assert.equal(row.name, '企业知识助手（草稿）')
  assert.equal(row.enabled, 0)
  assert.equal(row.draft, draft)
  assert.equal(row.version, 1)
})

test('PATCH /assistants/:id -> 白名单外键被剔除（version 不可改）；enabled 布尔映射落库', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/assistants/asst-sales`,
    payload: { enabled: true, version: 99, scope: '产品与报价知识（扩展）' },
  })
  assert.equal(res.statusCode, 200)
  const a = res.json().data as AssistantJson
  assert.equal(a.enabled, true)
  assert.equal(a.scope, '产品与报价知识（扩展）')
  // version 不在白名单：保持 1
  assert.equal(a.version, 1)
})

test('PATCH /assistants/:id -> 未知 id 404；非法 body 400', async () => {
  const missing = await app.inject({ method: 'PATCH', url: `${API_BASE}/assistants/asst-nope`, payload: { name: 'x' } })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')

  const bad = await app.inject({ method: 'PATCH', url: `${API_BASE}/assistants/asst-kb`, payload: { enabled: 'abc' } })
  assert.equal(bad.statusCode, 400)
  assert.equal(bad.json().error.code, 'BAD_REQUEST')
})

// ---------- DELETE /assistants/:id ----------

test('DELETE /assistants/:id -> 删除助手 + 级联删除其 assistant_versions；重复删除 404', async () => {
  // 先发布一次制造版本行
  await app.inject({ method: 'PATCH', url: `${API_BASE}/assistants/asst-kb`, payload: { draft: draftConfig() } })
  const pub = await app.inject({ method: 'POST', url: `${API_BASE}/assistants/asst-kb/publish` })
  assert.equal(pub.statusCode, 200)
  assert.equal(versionRows('asst-kb').length, 1)

  const res = await app.inject({ method: 'DELETE', url: `${API_BASE}/assistants/asst-kb` })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().ok, true)
  assert.equal(res.json().data.deleted, true)

  // 助手与版本行均删除
  const list = await listAssistants()
  assert.equal(list.length, 1)
  assert.ok(!assistantById(list, 'asst-kb'))
  assert.equal(versionRows('asst-kb').length, 0)

  // 重复删除 404
  const again = await app.inject({ method: 'DELETE', url: `${API_BASE}/assistants/asst-kb` })
  assert.equal(again.statusCode, 404)
  assert.equal(again.json().error.code, 'NOT_FOUND')
})

// ---------- POST /assistants/:id/publish ----------

test('POST /assistants/:id/publish -> 草稿生效：version+1、写 assistant_versions（config/publishedAt）、draft 清空', async () => {
  const draft = draftConfig()
  await app.inject({ method: 'PATCH', url: `${API_BASE}/assistants/asst-kb`, payload: { draft } })
  assert.equal((await listAssistants()).find((a) => a.id === 'asst-kb')!.version, 1)

  const res = await app.inject({ method: 'POST', url: `${API_BASE}/assistants/asst-kb/publish` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const a = body.data as AssistantJson
  // live 字段应用草稿配置
  assert.equal(a.name, '企业知识助手（新版）')
  assert.equal(a.icon, '🤖')
  assert.equal(a.scope, '全部知识空间')
  assert.equal(a.desc, '全员 · 全部知识空间')
  // 版本递增 + 草稿清空
  assert.equal(a.version, 2)
  assert.equal(a.draft, '')

  // 版本行落库：version=2、config=发布的完整配置、publishedAt ISO
  const rows = versionRows('asst-kb')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].version, 2)
  assert.equal(rows[0].assistantId, 'asst-kb')
  const config = JSON.parse(rows[0].config) as { name: string; icon: string; desc: string; scope: string; enabled: boolean }
  assert.equal(config.name, '企业知识助手（新版）')
  assert.equal(config.icon, '🤖')
  assert.equal(config.scope, '全部知识空间')
  assert.equal(config.enabled, true)
  assert.ok(!Number.isNaN(Date.parse(rows[0].publishedAt)), 'publishedAt 应为可解析的 ISO 时间')
})

test('POST /assistants/:id/publish -> 再次发布：版本 2→3，保留历史版本行', async () => {
  await app.inject({ method: 'PATCH', url: `${API_BASE}/assistants/asst-sales`, payload: { draft: draftConfig({ name: '销售问答助手（v2）' }) } })
  await app.inject({ method: 'POST', url: `${API_BASE}/assistants/asst-sales/publish` })
  await app.inject({ method: 'PATCH', url: `${API_BASE}/assistants/asst-sales`, payload: { draft: draftConfig({ name: '销售问答助手（v3）' }) } })
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/assistants/asst-sales/publish` })
  assert.equal(res.statusCode, 200)
  const a = res.json().data as AssistantJson
  assert.equal(a.version, 3)
  assert.equal(a.name, '销售问答助手（v3）')

  const rows = versionRows('asst-sales')
  assert.equal(rows.length, 2)
  assert.deepEqual(
    rows.map((r) => r.version),
    [2, 3],
  )
  assert.equal(JSON.parse(rows[1].config).name, '销售问答助手（v3）')
})

test('POST /assistants/:id/publish -> 无草稿 -> 409 NO_DRAFT；未知 id -> 404', async () => {
  const noDraft = await app.inject({ method: 'POST', url: `${API_BASE}/assistants/asst-kb/publish` })
  assert.equal(noDraft.statusCode, 409)
  assert.equal(noDraft.json().error.code, 'NO_DRAFT')

  const missing = await app.inject({ method: 'POST', url: `${API_BASE}/assistants/asst-nope/publish` })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')
})
