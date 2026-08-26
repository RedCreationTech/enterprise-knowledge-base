import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { API_BASE } from '@kb/shared'

// 测试隔离：动态 import 前先指向内存库（client.ts 单例读取 KB_DB_PATH）
process.env.KB_DB_PATH = ':memory:'
const { buildApp } = await import('../src/app.js')
const { db } = await import('../src/db/client.js')
const { seedIfEmpty } = await import('../src/db/seed.js')

const app = await buildApp()

/** 回到 seed 基线：业务表清空后重新播种（含 4 内置连接器 + 5 条同步任务）。 */
function resetSeed() {
  db.exec(
    'DELETE FROM org; DELETE FROM plan; DELETE FROM members; DELETE FROM users; DELETE FROM trial_journey; DELETE FROM trial_applications; DELETE FROM spaces; DELETE FROM docs; DELETE FROM connectors; DELETE FROM sync_tasks',
  )
  seedIfEmpty()
}

beforeEach(resetSeed)

interface ConnectorJson {
  id: string
  name: string
  kind: string
  connected: boolean
  disabled: boolean
  docs: number
  lastSyncAt: string | null
}

interface ConnectorListJson {
  items: ConnectorJson[]
  summary: { connectedCount: number; totalDocs: number; localUpload: number }
}

interface SyncTaskJson {
  id: string
  connectorId: string | null
  status: string
  progress: number
  failedCount: number
  at: string
}

const getConnectors = async () =>
  (await app.inject({ method: 'GET', url: `${API_BASE}/connectors` })).json().data as ConnectorListJson

const getSyncTasks = async () =>
  (await app.inject({ method: 'GET', url: `${API_BASE}/sync-tasks` })).json().data as { items: SyncTaskJson[] }

const connectorById = (list: ConnectorListJson, id: string) => list.items.find((c) => c.id === id)

// ---------- GET /connectors 列表 + 摘要 ----------

test('GET /connectors -> seed 4 内置连接器，字段齐全，connected 口径与 sourcesData.ts 一致', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/connectors` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)

  const data = body.data as ConnectorListJson
  assert.equal(data.items.length, 4)
  assert.deepEqual(
    data.items.map((c) => c.id),
    ['netdisk', 'feishu', 'dingtalk', 'wecom'],
  )

  // connected 口径：企业网盘/飞书文档 已连接；钉钉/企微 未连接
  assert.equal(connectorById(data, 'netdisk')!.connected, true)
  assert.equal(connectorById(data, 'feishu')!.connected, true)
  assert.equal(connectorById(data, 'dingtalk')!.connected, false)
  assert.equal(connectorById(data, 'wecom')!.connected, false)

  // 字段齐全：id/name/kind/connected/disabled/docs/lastSyncAt
  for (const c of data.items) {
    assert.equal(typeof c.id, 'string')
    assert.equal(typeof c.name, 'string')
    assert.equal(typeof c.kind, 'string')
    assert.equal(typeof c.connected, 'boolean')
    assert.equal(typeof c.disabled, 'boolean')
    assert.equal(typeof c.docs, 'number')
    assert.ok(c.lastSyncAt === null || typeof c.lastSyncAt === 'string')
  }
})

test('GET /connectors -> docs 口径：网盘 862 + 飞书 318；kind oauth/api', async () => {
  const data = await getConnectors()
  assert.equal(connectorById(data, 'netdisk')!.docs, 862)
  assert.equal(connectorById(data, 'feishu')!.docs, 318)
  assert.equal(connectorById(data, 'dingtalk')!.docs, 0)
  assert.equal(connectorById(data, 'wecom')!.docs, 0)

  // kind：网盘 api、飞书/钉钉/企微 oauth（OAuth 型内置连接器）
  assert.equal(connectorById(data, 'netdisk')!.kind, 'api')
  assert.equal(connectorById(data, 'feishu')!.kind, 'oauth')
  assert.equal(connectorById(data, 'dingtalk')!.kind, 'oauth')
  assert.equal(connectorById(data, 'wecom')!.kind, 'oauth')
})

test('GET /connectors -> 摘要副标题口径：connectedCount=2、totalDocs=1286、localUpload=106', async () => {
  const data = await getConnectors()
  assert.deepEqual(data.summary, { connectedCount: 2, totalDocs: 1286, localUpload: 106 })
})

// ---------- POST /connectors/:id/connect ----------

test('POST /connectors/dingtalk/connect -> 钉钉置 connected=true，列表不新增「第三方知识库」伪卡', async () => {
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/connectors/dingtalk/connect` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.id, 'dingtalk')
  assert.equal(body.data.connected, true)

  const data = await getConnectors()
  // P1-N4：不建伪卡——仍只有 4 张内置卡
  assert.equal(data.items.length, 4)
  assert.ok(!data.items.some((c) => c.name.includes('第三方知识库')))
  assert.equal(connectorById(data, 'dingtalk')!.connected, true)
  // 摘要 connectedCount 2→3，文档数不变
  assert.equal(data.summary.connectedCount, 3)
  assert.equal(data.summary.totalDocs, 1286)
})

test('POST /connectors/wecom/connect -> 企微置 connected=true（OAuth 型内置同样适用）', async () => {
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/connectors/wecom/connect` })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().data.connected, true)
  const data = await getConnectors()
  assert.equal(data.summary.connectedCount, 3)
})

test('POST /connectors/:id/connect -> 未知 id 404；重复 connect 幂等', async () => {
  const missing = await app.inject({ method: 'POST', url: `${API_BASE}/connectors/c-nope/connect` })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')

  // 幂等：已连接的网盘再 connect 仍 200、connected 不变
  const again = await app.inject({ method: 'POST', url: `${API_BASE}/connectors/netdisk/connect` })
  assert.equal(again.statusCode, 200)
  assert.equal(again.json().data.connected, true)
})

// ---------- POST /connectors/:id/sync ----------

test('POST /connectors/dingtalk/sync -> 生成 sync_task（已完成/100/0）+ lastSyncAt 更新', async () => {
  const before = (await app.inject({ method: 'GET', url: `${API_BASE}/connectors` })).json().data
  const beforeLastSync = connectorById(before, 'dingtalk')!.lastSyncAt

  const res = await app.inject({ method: 'POST', url: `${API_BASE}/connectors/dingtalk/sync` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const task = body.data as SyncTaskJson
  assert.equal(task.connectorId, 'dingtalk')
  assert.equal(task.status, '已完成')
  assert.equal(task.progress, 100)
  assert.equal(task.failedCount, 0)
  assert.equal(typeof task.at, 'string')

  // 落库
  const row = db.prepare('SELECT * FROM sync_tasks WHERE id = ?').get(task.id) as { connectorId: string; status: string }
  assert.equal(row.connectorId, 'dingtalk')
  assert.equal(row.status, '已完成')

  // lastSyncAt 已更新（非 null 且晚于/等于 seed 值）
  const after = await getConnectors()
  const afterLastSync = connectorById(after, 'dingtalk')!.lastSyncAt
  assert.ok(afterLastSync !== null, 'lastSyncAt 应被更新')
  assert.notEqual(afterLastSync, beforeLastSync)
})

test('POST /connectors/:id/sync -> 未知 id 404', async () => {
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/connectors/c-nope/sync` })
  assert.equal(res.statusCode, 404)
  assert.equal(res.json().error.code, 'NOT_FOUND')
})

// ---------- PATCH /connectors/:id ----------

test('PATCH /connectors/:id -> 停用（disabled=true）持久化；再启用', async () => {
  const off = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/connectors/feishu`,
    payload: { disabled: true },
  })
  assert.equal(off.statusCode, 200)
  assert.equal(off.json().data.disabled, true)

  const data = await getConnectors()
  assert.equal(connectorById(data, 'feishu')!.disabled, true)

  const on = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/connectors/feishu`,
    payload: { disabled: false },
  })
  assert.equal(on.statusCode, 200)
  assert.equal(on.json().data.disabled, false)
})

test('PATCH /connectors/:id -> 更新 docs/lastSyncAt（白名单）；未知键被剔除', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/connectors/dingtalk`,
    payload: { docs: 42, lastSyncAt: '2026-05-30T09:00:00', connected: false, name: 'hack' },
  })
  assert.equal(res.statusCode, 200)
  const c = res.json().data as ConnectorJson
  assert.equal(c.docs, 42)
  assert.equal(c.lastSyncAt, '2026-05-30T09:00:00')
  // 白名单外键不影响（connected 保持 seed false，name 不变）
  assert.equal(c.connected, false)
  assert.equal(c.name, '钉钉文档')

  const row = db.prepare('SELECT docs, lastSyncAt FROM connectors WHERE id = ?').get('dingtalk') as {
    docs: number
    lastSyncAt: string
  }
  assert.equal(row.docs, 42)
  assert.equal(row.lastSyncAt, '2026-05-30T09:00:00')
})

test('PATCH /connectors/:id -> 未知 id 404；非法 body 400', async () => {
  const missing = await app.inject({ method: 'PATCH', url: `${API_BASE}/connectors/c-nope`, payload: { disabled: true } })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')

  const bad = await app.inject({ method: 'PATCH', url: `${API_BASE}/connectors/feishu`, payload: { docs: 'abc' } })
  assert.equal(bad.statusCode, 400)
  assert.equal(bad.json().error.code, 'BAD_REQUEST')
})

// ---------- DELETE /connectors/:id ----------

test('DELETE /connectors/:id -> 删除连接器 + 级联删除其 sync_tasks；重复删除 404', async () => {
  // 先给 feishu 造一条任务
  await app.inject({ method: 'POST', url: `${API_BASE}/connectors/feishu/sync` })
  const beforeTasks = await getSyncTasks()
  assert.ok(beforeTasks.items.some((t) => t.connectorId === 'feishu'))

  const res = await app.inject({ method: 'DELETE', url: `${API_BASE}/connectors/feishu` })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().ok, true)
  assert.equal(res.json().data.deleted, true)

  const data = await getConnectors()
  assert.equal(data.items.length, 3)
  assert.ok(!connectorById(data, 'feishu'))

  // 级联：feishu 的任务全删
  const afterTasks = await getSyncTasks()
  assert.ok(!afterTasks.items.some((t) => t.connectorId === 'feishu'))
  // seed 里 feishu 的任务也级联删（seed t2/t4 属于 feishu）
  assert.equal(
    (db.prepare("SELECT COUNT(*) c FROM sync_tasks WHERE connectorId = 'feishu'").get() as { c: number }).c,
    0,
  )

  const again = await app.inject({ method: 'DELETE', url: `${API_BASE}/connectors/feishu` })
  assert.equal(again.statusCode, 404)
  assert.equal(again.json().error.code, 'NOT_FOUND')
})

// ---------- GET /sync-tasks ----------

test('GET /sync-tasks -> seed 5 条任务，at 倒序（最近在前）', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/sync-tasks` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const data = body.data as { items: SyncTaskJson[] }

  assert.equal(data.items.length, 5)
  // at 倒序
  for (let i = 1; i < data.items.length; i += 1) {
    assert.ok(data.items[i - 1].at >= data.items[i].at, `items[${i}] 乱序`)
  }
  // 字段齐全
  for (const t of data.items) {
    assert.equal(typeof t.id, 'string')
    assert.ok(t.connectorId === null || typeof t.connectorId === 'string')
    assert.equal(typeof t.status, 'string')
    assert.equal(typeof t.progress, 'number')
    assert.equal(typeof t.failedCount, 'number')
    assert.equal(typeof t.at, 'string')
  }
})

test('GET /sync-tasks -> sync 后新任务排在最前（at 倒序）', async () => {
  await app.inject({ method: 'POST', url: `${API_BASE}/connectors/dingtalk/sync` })
  const data = await getSyncTasks()
  assert.equal(data.items[0].connectorId, 'dingtalk')
  assert.equal(data.items[0].status, '已完成')
})
