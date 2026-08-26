import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { API_BASE } from '@kb/shared'

// 测试隔离：动态 import 前先指向内存库（client.ts 单例读取 KB_DB_PATH）
process.env.KB_DB_PATH = ':memory:'
const { buildApp } = await import('../src/app.js')
const { db } = await import('../src/db/client.js')
const { seedIfEmpty } = await import('../src/db/seed.js')

const app = await buildApp()

/** 回到 seed 基线：业务表清空后重新播种（含 4 系统预置 readonly + 3 自定义指令）。 */
function resetSeed() {
  db.exec(
    'DELETE FROM org; DELETE FROM plan; DELETE FROM members; DELETE FROM users; DELETE FROM trial_journey; DELETE FROM trial_applications; DELETE FROM spaces; DELETE FROM docs; DELETE FROM connectors; DELETE FROM sync_tasks; DELETE FROM knowledge_map; DELETE FROM knowledge_site; DELETE FROM answer_pool; DELETE FROM assistant_versions; DELETE FROM assistants; DELETE FROM chat_messages; DELETE FROM chat_sessions; DELETE FROM instruction_versions; DELETE FROM instructions',
  )
  seedIfEmpty()
}

beforeEach(resetSeed)

interface InstructionJson {
  id: string
  name: string
  text: string
  scope: string[]
  status: '草稿' | '已发布'
  version: number
  readonly: boolean
  createdAt: string
}

interface InstructionVersionJson {
  id: string
  instructionId: string
  version: number
  text: string
  diff: { changed: boolean; added: number; removed: number }
  publishedAt: string
}

const listInstructions = async () =>
  (await app.inject({ method: 'GET', url: `${API_BASE}/instructions` })).json().data as InstructionJson[]

const instructionById = (list: InstructionJson[], id: string) => list.find((i) => i.id === id)

const versionRows = (instructionId: string) =>
  db.prepare('SELECT * FROM instruction_versions WHERE instructionId = ? ORDER BY version ASC').all(instructionId) as Array<{
    id: string
    instructionId: string
    version: number
    text: string
    diff: string
    publishedAt: string
  }>

// ---------- GET /instructions 列表 ----------

test('GET /instructions -> seed 7 条（4 系统预置 readonly + 3 自定义），字段齐全、口径对齐 instructionsData.ts', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/instructions` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)

  const list = body.data as InstructionJson[]
  assert.equal(list.length, 7)

  // 4 条系统预置 readonly（客户报价审批/退货政策/员工手册/信息安全），3 条自定义
  const system = list.filter((i) => i.readonly)
  const custom = list.filter((i) => !i.readonly)
  assert.equal(system.length, 4)
  assert.equal(custom.length, 3)

  const quote = instructionById(list, 'ins-quote')!
  assert.equal(quote.name, '客户报价审批指令')
  assert.equal(quote.readonly, true)
  assert.equal(quote.status, '已发布')
  assert.ok(quote.text.includes('报价与折扣'))

  const staff = instructionById(list, 'ins-staff')!
  assert.equal(staff.name, '员工手册指令')
  assert.equal(staff.readonly, true)

  // 自定义：销售标准回答指令（已发布）/ 客服温和回答指令（已发布）/ 报价严格模式（草稿）
  const sales = instructionById(list, 'ins-sales')!
  assert.equal(sales.name, '销售标准回答指令')
  assert.equal(sales.readonly, false)
  assert.equal(sales.status, '已发布')

  const draft = instructionById(list, 'ins-quote-draft')!
  assert.equal(draft.name, '报价严格模式（草稿）')
  assert.equal(draft.readonly, false)
  assert.equal(draft.status, '草稿')

  // 字段齐全：id/name/text/scope/status/version/readonly/createdAt；scope 为字符串数组
  for (const i of list) {
    assert.equal(typeof i.id, 'string')
    assert.equal(typeof i.name, 'string')
    assert.equal(typeof i.text, 'string')
    assert.ok(Array.isArray(i.scope) && i.scope.every((s) => typeof s === 'string'))
    assert.ok(i.status === '草稿' || i.status === '已发布')
    assert.equal(typeof i.version, 'number')
    assert.equal(typeof i.readonly, 'boolean')
    assert.equal(typeof i.createdAt, 'string')
  }
})

test('GET /instructions -> 响应通过 @kb/shared schema（envelope ok:true + 指令结构）', async () => {
  const list = await listInstructions()
  assert.equal(list.length, 7)
  assert.ok(instructionById(list, 'ins-sales'))
  assert.ok(instructionById(list, 'ins-quote-draft'))
})

// ---------- POST /instructions 新建自定义指令 ----------

test('POST /instructions -> 创建自定义草稿（name 必填；默认 text ""/scope []/status 草稿/version 1/readonly false）', async () => {
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/instructions`, payload: { name: '新客诉指令' } })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const i = body.data as InstructionJson
  assert.equal(i.name, '新客诉指令')
  assert.equal(i.text, '')
  assert.deepEqual(i.scope, [])
  assert.equal(i.status, '草稿')
  assert.equal(i.version, 1)
  assert.equal(i.readonly, false)
  assert.ok(i.id.startsWith('ins-'))
  assert.ok(!Number.isNaN(Date.parse(i.createdAt)), 'createdAt 应为可解析的 ISO 时间')

  // 列表表现为 8 条
  const list = await listInstructions()
  assert.equal(list.length, 8)
  assert.ok(instructionById(list, i.id))
})

test('POST /instructions -> 可选字段生效（text/scope）；缺 name / 空 name -> 400 BAD_REQUEST', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/instructions`,
    payload: { name: 'IT-SOP 指令', text: '故障分步引导', scope: ['企业知识助手', '工作台'] },
  })
  assert.equal(res.statusCode, 200)
  const i = res.json().data as InstructionJson
  assert.equal(i.text, '故障分步引导')
  assert.deepEqual(i.scope, ['企业知识助手', '工作台'])

  for (const payload of [{}, { name: '' }]) {
    const bad = await app.inject({ method: 'POST', url: `${API_BASE}/instructions`, payload })
    assert.equal(bad.statusCode, 400, JSON.stringify(payload))
    assert.equal(bad.json().error.code, 'BAD_REQUEST')
  }
})

test('POST /instructions -> 同名指令 -> 409 CONFLICT（不落库）', async () => {
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/instructions`, payload: { name: '销售标准回答指令' } })
  assert.equal(res.statusCode, 409)
  assert.equal(res.json().error.code, 'CONFLICT')
  assert.equal((await listInstructions()).length, 7)
})

// ---------- PATCH /instructions/:id 草稿编辑 ----------

test('PATCH /instructions/:id -> 草稿编辑（name/text/scope 白名单），status/version/readonly 不变', async () => {
  // 用 seed 草稿 ins-quote-draft
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/instructions/ins-quote-draft`,
    payload: { name: '报价严格模式（v2 草稿）', text: '逐条引用制度原文，不推测底价。', scope: ['销售知识助手', '飞书渠道'] },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const i = body.data as InstructionJson
  assert.equal(i.name, '报价严格模式（v2 草稿）')
  assert.equal(i.text, '逐条引用制度原文，不推测底价。')
  assert.deepEqual(i.scope, ['销售知识助手', '飞书渠道'])
  // 草稿编辑不升版本、不改状态、非只读
  assert.equal(i.version, 1)
  assert.equal(i.status, '草稿')
  assert.equal(i.readonly, false)

  // 落库校验（scope 存 JSON 文本）
  const row = db.prepare('SELECT name, text, scope, status, version FROM instructions WHERE id = ?').get('ins-quote-draft') as {
    name: string
    text: string
    scope: string
    status: string
    version: number
  }
  assert.equal(row.name, '报价严格模式（v2 草稿）')
  assert.equal(row.scope, JSON.stringify(['销售知识助手', '飞书渠道']))
  assert.equal(row.status, '草稿')
  assert.equal(row.version, 1)
})

test('PATCH /instructions/:id -> 已发布指令 -> 409 PUBLISHED_NOT_EDITABLE（只允许草稿编辑）', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/instructions/ins-sales`,
    payload: { text: '修改已发布指令的文本' },
  })
  assert.equal(res.statusCode, 409)
  assert.equal(res.json().error.code, 'PUBLISHED_NOT_EDITABLE')
  // 不落库
  const i = instructionById(await listInstructions(), 'ins-sales')!
  assert.ok(!i.text.includes('修改已发布指令的文本'))
})

test('PATCH /instructions/:id -> 系统预置 readonly 指令 -> 400 READONLY', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/instructions/ins-staff`,
    payload: { name: '改名试试' },
  })
  assert.equal(res.statusCode, 400)
  assert.equal(res.json().error.code, 'READONLY')
})

test('PATCH /instructions/:id -> 未知 id 404；非法 body 400', async () => {
  const missing = await app.inject({ method: 'PATCH', url: `${API_BASE}/instructions/ins-nope`, payload: { name: 'x' } })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')

  const bad = await app.inject({ method: 'PATCH', url: `${API_BASE}/instructions/ins-quote-draft`, payload: { scope: 'not-an-array' } })
  assert.equal(bad.statusCode, 400)
  assert.equal(bad.json().error.code, 'BAD_REQUEST')
})

// ---------- DELETE /instructions/:id ----------

test('DELETE /instructions/:id -> 删除自定义指令 + 级联删除其版本行；重复删除 404', async () => {
  // 先发布制造版本行
  await app.inject({ method: 'PATCH', url: `${API_BASE}/instructions/ins-quote-draft`, payload: { text: '逐条引用制度原文' } })
  const pub = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/ins-quote-draft/publish` })
  assert.equal(pub.statusCode, 200)
  assert.equal(versionRows('ins-quote-draft').length, 1)

  const res = await app.inject({ method: 'DELETE', url: `${API_BASE}/instructions/ins-quote-draft` })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().ok, true)
  assert.equal(res.json().data.deleted, true)

  const list = await listInstructions()
  assert.equal(list.length, 6)
  assert.ok(!instructionById(list, 'ins-quote-draft'))
  assert.equal(versionRows('ins-quote-draft').length, 0)

  const again = await app.inject({ method: 'DELETE', url: `${API_BASE}/instructions/ins-quote-draft` })
  assert.equal(again.statusCode, 404)
  assert.equal(again.json().error.code, 'NOT_FOUND')
})

test('DELETE /instructions/:id -> 系统预置 readonly 指令 -> 400 READONLY', async () => {
  const res = await app.inject({ method: 'DELETE', url: `${API_BASE}/instructions/ins-staff` })
  assert.equal(res.statusCode, 400)
  assert.equal(res.json().error.code, 'READONLY')
  assert.equal((await listInstructions()).length, 7)
})

// ---------- POST /instructions/:id/publish ----------

test('POST /instructions/:id/publish -> 草稿→已发布：version+1、写版本行（text+diff+publishedAt）', async () => {
  // 新建草稿 version=1 → 发布 → version=2 + 首个版本行
  const created = (
    await app.inject({ method: 'POST', url: `${API_BASE}/instructions`, payload: { name: '发布测试指令', text: '第一行\n第二行' } })
  ).json().data as InstructionJson
  assert.equal(created.version, 1)
  assert.equal(created.status, '草稿')

  const res = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/publish` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const i = body.data as InstructionJson
  assert.equal(i.status, '已发布')
  assert.equal(i.version, 2)
  assert.equal(i.text, '第一行\n第二行')

  // 版本行落库：version=2、text=发布文本、diff=首版标记（vs 空）、publishedAt ISO
  const rows = versionRows(created.id)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].version, 2)
  assert.equal(rows[0].instructionId, created.id)
  assert.equal(rows[0].text, '第一行\n第二行')
  const diff = JSON.parse(rows[0].diff) as { changed: boolean; added: number; removed: number }
  assert.equal(diff.changed, true)
  assert.equal(diff.added, 2)
  assert.equal(diff.removed, 0)
  assert.ok(!Number.isNaN(Date.parse(rows[0].publishedAt)), 'publishedAt 应为可解析的 ISO 时间')
})

test('POST /instructions/:id/publish -> 再次发布：版本 2→3，diff 高亮（vs 上一已发布文本的行级差异）', async () => {
  const created = (
    await app.inject({ method: 'POST', url: `${API_BASE}/instructions`, payload: { name: '二次发布指令', text: '第一行' } })
  ).json().data as InstructionJson
  await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/publish` }) // v2

  // 已发布指令需先回滚为草稿（回滚走草稿）再编辑：默认回滚到最新版本 → 草稿 → PATCH
  await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/rollback`, payload: {} })
  await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/instructions/${created.id}`,
    payload: { text: '第一行\n第二行' },
  })
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/publish` })
  assert.equal(res.statusCode, 200)
  const i = res.json().data as InstructionJson
  assert.equal(i.version, 3)
  assert.equal(i.text, '第一行\n第二行')

  const rows = versionRows(created.id)
  assert.equal(rows.length, 2)
  assert.deepEqual(
    rows.map((r) => r.version),
    [2, 3],
  )
  const diff = JSON.parse(rows[1].diff) as { changed: boolean; added: number; removed: number }
  assert.equal(diff.changed, true)
  assert.equal(diff.added, 1) // 新增「第二行」
  assert.equal(diff.removed, 0)
})

test('POST /instructions/:id/publish -> 无草稿变更（text 与上一已发布相同）-> 409 NO_CHANGES', async () => {
  const created = (
    await app.inject({ method: 'POST', url: `${API_BASE}/instructions`, payload: { name: '无变更指令', text: '原文' } })
  ).json().data as InstructionJson
  await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/publish` }) // v2

  // 已发布后再次发布：无草稿变更 → 409 NO_CHANGES
  const again = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/publish` })
  assert.equal(again.statusCode, 409)
  assert.equal(again.json().error.code, 'NO_CHANGES')
  assert.equal(versionRows(created.id).length, 1)

  // 回滚到最新版本（text 仍等于上一已发布）后直接发布 → 同样 409 NO_CHANGES
  const rollback = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/rollback`, payload: {} })
  assert.equal(rollback.statusCode, 200)
  const noChange = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/publish` })
  assert.equal(noChange.statusCode, 409)
  assert.equal(noChange.json().error.code, 'NO_CHANGES')
})

test('POST /instructions/:id/publish -> 系统预置 readonly 指令 -> 400 READONLY；未知 id -> 404', async () => {
  const readonly = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/ins-staff/publish` })
  assert.equal(readonly.statusCode, 400)
  assert.equal(readonly.json().error.code, 'READONLY')

  const missing = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/ins-nope/publish` })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')
})

// ---------- POST /instructions/:id/rollback ----------

test('POST /instructions/:id/rollback -> 回滚到指定版本：生成新草稿（status 草稿、text=该版本文本、version 不变）', async () => {
  // 发布两次：v2（原文）→ 回滚草稿改文本 → v3（新文本）
  const created = (
    await app.inject({ method: 'POST', url: `${API_BASE}/instructions`, payload: { name: '回滚测试指令', text: '旧版文本' } })
  ).json().data as InstructionJson
  await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/publish` }) // v2
  await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/rollback`, payload: {} })
  await app.inject({ method: 'PATCH', url: `${API_BASE}/instructions/${created.id}`, payload: { text: '新版文本' } })
  await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/publish` }) // v3
  assert.equal(versionRows(created.id).length, 2)

  // 回滚到 v2
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/rollback`, payload: { version: 2 } })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const i = body.data as InstructionJson
  assert.equal(i.status, '草稿')
  assert.equal(i.text, '旧版文本')
  // version 不变（新版本号只在下一次发布时产生）
  assert.equal(i.version, 3)

  // 再发布 → version 4，文本回到旧版文本，版本行保留历史
  const repub = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/publish` })
  assert.equal(repub.statusCode, 200)
  const republished = repub.json().data as InstructionJson
  assert.equal(republished.version, 4)
  assert.equal(republished.text, '旧版文本')
  const rows = versionRows(created.id)
  assert.deepEqual(
    rows.map((r) => r.version),
    [2, 3, 4],
  )
  assert.equal(rows[2].text, '旧版文本')
})

test('POST /instructions/:id/rollback -> 缺省 version 回滚到最新版本；目标版本缺失 -> 404', async () => {
  const created = (
    await app.inject({ method: 'POST', url: `${API_BASE}/instructions`, payload: { name: '回滚缺省指令', text: 'v2 文本' } })
  ).json().data as InstructionJson
  await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/publish` }) // v2
  await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/rollback`, payload: {} })
  await app.inject({ method: 'PATCH', url: `${API_BASE}/instructions/${created.id}`, payload: { text: 'v3 文本' } })
  await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/publish` }) // v3

  // 缺省 version → 最新版本（v3）
  const latest = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/rollback`, payload: {} })
  assert.equal(latest.statusCode, 200)
  assert.equal((latest.json().data as InstructionJson).text, 'v3 文本')
  assert.equal((latest.json().data as InstructionJson).status, '草稿')

  // 指定不存在的版本 → 404
  const missing = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/rollback`, payload: { version: 99 } })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')
})

test('POST /instructions/:id/rollback -> 系统预置 readonly 指令 -> 400 READONLY；未知指令 -> 404', async () => {
  const readonly = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/ins-staff/rollback`, payload: {} })
  assert.equal(readonly.statusCode, 400)
  assert.equal(readonly.json().error.code, 'READONLY')

  const missing = await app.inject({ method: 'POST', url: `${API_BASE}/instructions/ins-nope/rollback`, payload: {} })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')
})

// ---------- GET /instructions/:id/versions ----------

test('GET /instructions/:id/versions -> 版本历史列表（version 倒序，含 text/diff/publishedAt）', async () => {
  const created = (
    await app.inject({ method: 'POST', url: `${API_BASE}/instructions`, payload: { name: '版本历史指令', text: '第一行' } })
  ).json().data as InstructionJson
  await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/publish` }) // v2
  await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/rollback`, payload: {} })
  await app.inject({ method: 'PATCH', url: `${API_BASE}/instructions/${created.id}`, payload: { text: '第一行\n第二行' } })
  await app.inject({ method: 'POST', url: `${API_BASE}/instructions/${created.id}/publish` }) // v3

  const res = await app.inject({ method: 'GET', url: `${API_BASE}/instructions/${created.id}/versions` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const versions = body.data as InstructionVersionJson[]
  assert.equal(versions.length, 2)
  // version 倒序：最新在前
  assert.deepEqual(
    versions.map((v) => v.version),
    [3, 2],
  )
  const v3 = versions[0]
  assert.equal(v3.text, '第一行\n第二行')
  assert.equal(v3.instructionId, created.id)
  assert.ok(typeof v3.id === 'string')
  assert.equal(v3.diff.changed, true)
  assert.ok(!Number.isNaN(Date.parse(v3.publishedAt)))
})

test('GET /instructions/:id/versions -> seed 已发布指令有版本行；未知指令 -> 404', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/instructions/ins-sales/versions` })
  assert.equal(res.statusCode, 200)
  const versions = res.json().data as InstructionVersionJson[]
  assert.equal(versions.length, 1)
  assert.equal(versions[0].version, 2)
  assert.equal(versions[0].text, instructionById(await listInstructions(), 'ins-sales')!.text)

  const missing = await app.inject({ method: 'GET', url: `${API_BASE}/instructions/ins-nope/versions` })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')
})
