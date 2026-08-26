import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { API_BASE } from '@kb/shared'

// 测试隔离：动态 import 前先指向内存库（client.ts 单例读取 KB_DB_PATH）
process.env.KB_DB_PATH = ':memory:'
const { buildApp } = await import('../src/app.js')
const { db } = await import('../src/db/client.js')
const { seedIfEmpty } = await import('../src/db/seed.js')

const app = await buildApp()

/** 回到 seed 基线：org/plan/members/users/旅程/spaces/docs 全表清空后重新播种（6 名成员、seats=20/seatsUsed=12、5 空间+128 文档）。 */
function resetSeed() {
  db.exec('DELETE FROM org; DELETE FROM plan; DELETE FROM members; DELETE FROM users; DELETE FROM trial_journey; DELETE FROM trial_applications; DELETE FROM spaces; DELETE FROM docs; DELETE FROM connectors; DELETE FROM sync_tasks')
  seedIfEmpty()
}

beforeEach(resetSeed)

test('GET /org -> 返回 seed 组织（demoData 映射为布尔）', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/org` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.deepEqual(body.data, {
    id: 'org-1',
    name: '示例科技有限公司',
    industry: '软件与信息技术服务',
    contact: 'zhangwei@example.com',
    demoData: false,
  })
})

test('GET /org -> demoData 跟随演示态开关（true）', async () => {
  await app.inject({ method: 'POST', url: `${API_BASE}/demo-data` })
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/org` })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().data.demoData, true)
})

test('PATCH /org -> 部分更新并持久化（非法类型 400）', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/org`,
    payload: { name: '新示例科技', industry: '制造业' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.name, '新示例科技')
  assert.equal(body.data.industry, '制造业')
  assert.equal(body.data.contact, 'zhangwei@example.com') // 未传字段保持
  assert.equal(body.data.demoData, false)

  const again = await app.inject({ method: 'GET', url: `${API_BASE}/org` })
  assert.deepEqual(again.json().data, body.data)

  // 空 body 为合法 no-op
  const noop = await app.inject({ method: 'PATCH', url: `${API_BASE}/org`, payload: {} })
  assert.equal(noop.statusCode, 200)

  // 非法类型 -> 400
  const bad = await app.inject({ method: 'PATCH', url: `${API_BASE}/org`, payload: { name: 123 } })
  assert.equal(bad.statusCode, 400)
  assert.equal(bad.json().error.code, 'BAD_REQUEST')
})

test('GET /org/members -> 返回 6 名 seed 成员（含待激活、CoreRole 口径）', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/org/members` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const members = body.data
  assert.equal(members.length, 6)

  // 字段齐全：id/name/email/role/dept/status/joinedAt
  for (const m of members) {
    assert.equal(typeof m.id, 'string')
    assert.equal(typeof m.name, 'string')
    assert.equal(typeof m.email, 'string')
    assert.equal(typeof m.role, 'string')
    assert.equal(typeof m.dept, 'string')
    assert.equal(typeof m.joinedAt, 'string')
    assert.ok(['活跃', '待激活'].includes(m.status))
  }

  // CoreRole 口径与待激活成员
  const byId = Object.fromEntries(members.map((m: { id: string }) => [m.id, m]))
  assert.deepEqual(
    ['m-zw', 'm-ln', 'm-wq', 'm-zm', 'm-cc', 'm-ly'].map((id) => byId[id].role),
    ['管理员', '知识管理员', '空间管理员', '文档审核员', '助手运营员', '普通成员'],
  )
  assert.equal(byId['m-cc'].status, '待激活')
  assert.equal(byId['m-ly'].status, '待激活')
  assert.equal(byId['m-zw'].name, '张伟')
})

test('POST /org/members -> 创建成员（默认 待激活/普通成员）并占用席位', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/org/members`,
    payload: { name: '孙倩', email: 'sunqian@example.com', dept: '市场部' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const m = body.data
  assert.equal(m.name, '孙倩')
  assert.equal(m.email, 'sunqian@example.com')
  assert.equal(m.dept, '市场部')
  assert.equal(m.role, '普通成员') // role 缺省默认
  assert.equal(m.status, '待激活')
  assert.equal(typeof m.id, 'string')

  // 落库且席位 +1
  const row = db.prepare('SELECT * FROM members WHERE id = ?').get(m.id) as { name: string }
  assert.equal(row.name, '孙倩')
  const plan = (await app.inject({ method: 'GET', url: `${API_BASE}/plan` })).json().data
  assert.equal(plan.seatsUsed, 13)
  assert.equal(plan.seats, 20)
})

test('POST /org/members 指定 role -> 使用 CoreRole 校验并落库', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/org/members`,
    payload: { name: '周杰', email: 'zhoujie@example.com', role: '知识管理员', dept: '知识运营' },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().data.role, '知识管理员')
})

test('POST /org/members 超席 -> 409 SEAT_LIMIT（不落库）', async () => {
  db.prepare(`UPDATE plan SET seatsUsed = seats WHERE id = 'plan-1'`).run() // seatsUsed=seats=20
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/org/members`,
    payload: { name: '挤不下', email: 'overflow@example.com' },
  })
  assert.equal(res.statusCode, 409)
  const body = res.json()
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'SEAT_LIMIT')
  assert.match(body.error.message, /试用席位已满/)

  // 未插入成员、席位未变
  assert.equal((db.prepare('SELECT COUNT(*) c FROM members').get() as { c: number }).c, 6)
  const plan = db.prepare(`SELECT seatsUsed FROM plan WHERE id = 'plan-1'`).get() as { seatsUsed: number }
  assert.equal(plan.seatsUsed, 20)
})

test('POST /org/members 非法 body -> 400（缺 name / 邮箱格式 / 角色越界）', async () => {
  const cases = [
    { email: 'a@b.com' }, // 缺 name
    { name: '王五', email: 'not-an-email' }, // 邮箱非法
    { name: '王五', email: 'w@b.com', role: '不存在的角色' }, // 角色越界
  ]
  for (const payload of cases) {
    const res = await app.inject({ method: 'POST', url: `${API_BASE}/org/members`, payload })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().error.code, 'BAD_REQUEST')
  }
})

test('PATCH /org/members/:id -> 更新角色/状态/部门/邮箱并持久化', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/org/members/m-zm`,
    payload: { role: '空间管理员', status: '待激活', dept: '产品部', email: 'zhaomin-new@example.com' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.role, '空间管理员')
  assert.equal(body.data.status, '待激活')
  assert.equal(body.data.dept, '产品部')
  assert.equal(body.data.email, 'zhaomin-new@example.com')

  // 持久化：GET 列表可见
  const list = (await app.inject({ method: 'GET', url: `${API_BASE}/org/members` })).json().data
  const zm = list.find((m: { id: string }) => m.id === 'm-zm')
  assert.equal(zm.role, '空间管理员')
  assert.equal(zm.status, '待激活')

  // 局部更新：只改 dept，其余不变
  const partial = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/org/members/m-zm`,
    payload: { dept: '销售部' },
  })
  assert.equal(partial.json().data.dept, '销售部')
  assert.equal(partial.json().data.email, 'zhaomin-new@example.com')
})

test('PATCH /org/members/:id 不存在 -> 404；非法 body -> 400', async () => {
  const missing = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/org/members/m-nope`,
    payload: { dept: '产品部' },
  })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')

  const bad = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/org/members/m-zw`,
    payload: { role: '超级管理员' }, // 越界角色
  })
  assert.equal(bad.statusCode, 400)
  assert.equal(bad.json().error.code, 'BAD_REQUEST')
})

test('DELETE /org/members/:id -> 删除并释放席位；重复删除 404', async () => {
  const res = await app.inject({ method: 'DELETE', url: `${API_BASE}/org/members/m-cc` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.deleted, true)

  assert.equal((db.prepare('SELECT COUNT(*) c FROM members').get() as { c: number }).c, 5)
  const plan = (await app.inject({ method: 'GET', url: `${API_BASE}/plan` })).json().data
  assert.equal(plan.seatsUsed, 11)

  const again = await app.inject({ method: 'DELETE', url: `${API_BASE}/org/members/m-cc` })
  assert.equal(again.statusCode, 404)
  assert.equal(again.json().error.code, 'NOT_FOUND')
})

test('GET /plan -> 返回套餐（口径与 mock 一致：试用版 / 0.68/1GB / 20 席）', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/plan` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.deepEqual(body.data, {
    tier: '试用版',
    storageUsedGB: 0.68,
    storageTotalGB: 1,
    seats: 20,
    seatsUsed: 12,
    validUntil: '2025-06-03',
  })
})
