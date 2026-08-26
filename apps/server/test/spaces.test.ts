import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { API_BASE } from '@kb/shared'

// 测试隔离：动态 import 前先指向内存库（client.ts 单例读取 KB_DB_PATH）
process.env.KB_DB_PATH = ':memory:'
const { buildApp } = await import('../src/app.js')
const { db } = await import('../src/db/client.js')
const { seedIfEmpty } = await import('../src/db/seed.js')

const app = await buildApp()

/** 回到 seed 基线：业务表清空后重新播种（5 空间 + 128 文档）。 */
function resetSeed() {
  db.exec(
    'DELETE FROM org; DELETE FROM plan; DELETE FROM members; DELETE FROM users; DELETE FROM trial_journey; DELETE FROM trial_applications; DELETE FROM spaces; DELETE FROM docs',
  )
  seedIfEmpty()
}

beforeEach(resetSeed)

const getSpaces = async () => (await app.inject({ method: 'GET', url: `${API_BASE}/spaces` })).json().data as {
  id: string
  name: string
  count: number
  health: string
  reviewCycle: number
  archived: boolean
  createdAt: string
}[]

test('GET /spaces -> 5 空间计数 128/34/32/28/12，默认空间居首', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/spaces` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)

  const spaces = body.data
  assert.equal(spaces.length, 5)
  assert.deepEqual(
    spaces.map((s: { count: number }) => s.count),
    [128, 34, 32, 28, 12],
  )
  assert.equal(spaces[0].name, '默认空间（全部知识）')

  // 字段齐全：id/name/count/health/reviewCycle/archived/createdAt
  for (const s of spaces) {
    assert.equal(typeof s.id, 'string')
    assert.equal(typeof s.name, 'string')
    assert.equal(typeof s.count, 'number')
    assert.ok(['健康', '待复审'].includes(s.health))
    assert.equal(typeof s.reviewCycle, 'number')
    assert.equal(typeof s.archived, 'boolean')
    assert.equal(typeof s.createdAt, 'string')
  }

  // 健康/周期口径与前端 mock 一致
  assert.deepEqual(
    spaces.map((s: { health: string }) => s.health),
    ['健康', '待复审', '健康', '健康', '健康'],
  )
  assert.deepEqual(
    spaces.map((s: { reviewCycle: number }) => s.reviewCycle),
    [180, 180, 60, 60, 90],
  )
  assert.ok(spaces.every((s: { archived: boolean }) => s.archived === false))
})

test('POST /spaces -> 新建空间（默认 count 0/健康/180/未归档），GET 可见', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/spaces`,
    payload: { name: '研发中心' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const space = body.data
  assert.equal(space.name, '研发中心')
  assert.equal(space.count, 0)
  assert.equal(space.health, '健康')
  assert.equal(space.reviewCycle, 180)
  assert.equal(space.archived, false)
  assert.equal(typeof space.id, 'string')
  assert.equal(typeof space.createdAt, 'string')

  // 落库 + GET 列表可见（6 个空间）
  const row = db.prepare('SELECT * FROM spaces WHERE id = ?').get(space.id) as { name: string }
  assert.equal(row.name, '研发中心')
  const spaces = await getSpaces()
  assert.equal(spaces.length, 6)
  assert.ok(spaces.some((s) => s.id === space.id && s.name === '研发中心'))
})

test('POST /spaces 重名 -> 409（不落库）；缺 name -> 400', async () => {
  const dup = await app.inject({
    method: 'POST',
    url: `${API_BASE}/spaces`,
    payload: { name: '制度与流程' },
  })
  assert.equal(dup.statusCode, 409)
  const dupBody = dup.json()
  assert.equal(dupBody.ok, false)
  assert.equal(dupBody.error.code, 'SPACE_DUPLICATE')
  assert.match(dupBody.error.message, /已存在/)
  assert.equal((db.prepare('SELECT COUNT(*) c FROM spaces').get() as { c: number }).c, 5)

  const bad = await app.inject({ method: 'POST', url: `${API_BASE}/spaces`, payload: {} })
  assert.equal(bad.statusCode, 400)
  assert.equal(bad.json().error.code, 'BAD_REQUEST')
})

test('PATCH /spaces/:id -> 重命名/健康/周期/归档并持久化；404 缺失；400 非法 body', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/spaces/s-product`,
    payload: { name: '产品资料中心', health: '待复审', reviewCycle: 90, archived: true },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.name, '产品资料中心')
  assert.equal(body.data.health, '待复审')
  assert.equal(body.data.reviewCycle, 90)
  assert.equal(body.data.archived, true)

  // 持久化：GET 列表可见
  const spaces = await getSpaces()
  const prod = spaces.find((s) => s.id === 's-product')
  assert.equal(prod?.name, '产品资料中心')
  assert.equal(prod?.archived, true)

  // 局部更新：只改 health，其余不变
  const partial = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/spaces/s-product`,
    payload: { health: '健康' },
  })
  assert.equal(partial.json().data.health, '健康')
  assert.equal(partial.json().data.name, '产品资料中心')
  assert.equal(partial.json().data.reviewCycle, 90)

  // 404 缺失
  const missing = await app.inject({ method: 'PATCH', url: `${API_BASE}/spaces/s-nope`, payload: { name: 'x' } })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')

  // 400 非法 body（健康越界）
  const bad = await app.inject({ method: 'PATCH', url: `${API_BASE}/spaces/s-product`, payload: { health: '已废弃' } })
  assert.equal(bad.statusCode, 400)
  assert.equal(bad.json().error.code, 'BAD_REQUEST')
})

test('PATCH /spaces/:id 重命名 -> 与既有空间重名 409（不落库）', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/spaces/s-product`,
    payload: { name: '制度与流程' },
  })
  assert.equal(res.statusCode, 409)
  const body = res.json()
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'SPACE_DUPLICATE')
  assert.match(body.error.message, /已存在/)

  // 名称未变、总数未变
  const spaces = await getSpaces()
  assert.equal(spaces.length, 5)
  assert.equal(spaces.find((s) => s.id === 's-product')?.name, '产品资料')

  // 改回自身同名（无变化）应放行
  const same = await app.inject({ method: 'PATCH', url: `${API_BASE}/spaces/s-product`, payload: { name: '产品资料' } })
  assert.equal(same.statusCode, 200)
  assert.equal(same.json().data.name, '产品资料')
})

test('PATCH /spaces/:id 默认空间 -> 重命名 400，改健康/周期允许', async () => {
  const rename = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/spaces/s-all`,
    payload: { name: '全部知识' },
  })
  assert.equal(rename.statusCode, 400)
  assert.equal(rename.json().error.code, 'BAD_REQUEST')

  // 非 name 字段仍可更新
  const ok = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/spaces/s-all`,
    payload: { health: '待复审', reviewCycle: 90 },
  })
  assert.equal(ok.statusCode, 200)
  assert.equal(ok.json().data.name, '默认空间（全部知识）')
  assert.equal(ok.json().data.health, '待复审')
})

test('DELETE /spaces/:id 默认空间 -> 400', async () => {
  const res = await app.inject({ method: 'DELETE', url: `${API_BASE}/spaces/s-all` })
  assert.equal(res.statusCode, 400)
  assert.equal(res.json().error.code, 'BAD_REQUEST')
  assert.equal((db.prepare('SELECT COUNT(*) c FROM spaces').get() as { c: number }).c, 5)
})

test('DELETE /spaces/:id -> 删除并把文档移到默认空间；重复删除 404', async () => {
  const res = await app.inject({ method: 'DELETE', url: `${API_BASE}/spaces/s-policy` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.deleted, true)

  // 空间行删除、GET 列表剩 4 个
  assert.equal((db.prepare('SELECT COUNT(*) c FROM spaces').get() as { c: number }).c, 4)
  const spaces = await getSpaces()
  assert.equal(spaces.length, 4)
  assert.ok(!spaces.some((s) => s.id === 's-policy'))

  // 原 34 份文档移到默认空间（docs.spaceId 改写），总数不变
  assert.equal((db.prepare('SELECT COUNT(*) c FROM docs').get() as { c: number }).c, 128)
  assert.equal((db.prepare('SELECT COUNT(*) c FROM docs WHERE spaceId = ?').get('s-policy') as { c: number }).c, 0)
  assert.equal(
    (db.prepare('SELECT COUNT(*) c FROM docs WHERE spaceId = ?').get('s-all') as { c: number }).c,
    22 + 34,
  )

  // 重复删除 404
  const again = await app.inject({ method: 'DELETE', url: `${API_BASE}/spaces/s-policy` })
  assert.equal(again.statusCode, 404)
  assert.equal(again.json().error.code, 'NOT_FOUND')
})

test('POST /spaces/:id/upload -> 写入 docs（spaceId=目标空间）并更新计数', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/spaces/s-product/upload`,
    payload: { title: '《产品 X 售前指南》', type: 'PDF', category: '产品介绍', owner: '王强' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const doc = body.data
  assert.equal(doc.title, '《产品 X 售前指南》')
  assert.equal(doc.spaceId, 's-product')
  assert.equal(doc.type, 'PDF')
  assert.equal(doc.category, '产品介绍')
  assert.equal(doc.owner, '王强')
  assert.equal(doc.status, '已就绪')
  assert.equal(doc.source, '本地上传')
  assert.equal(typeof doc.id, 'string')

  // 落库：docs 行 spaceId 指向目标空间
  const row = db.prepare('SELECT * FROM docs WHERE id = ?').get(doc.id) as { spaceId: string; title: string }
  assert.equal(row.spaceId, 's-product')
  assert.equal(row.title, '《产品 X 售前指南》')

  // 计数：目标空间 +1（32→33），默认伞空间同步 +1（128→129）
  const spaces = await getSpaces()
  const prod = spaces.find((s) => s.id === 's-product')
  const all = spaces.find((s) => s.id === 's-all')
  assert.equal(prod?.count, 33)
  assert.equal(all?.count, 129)
})

test('POST /spaces/:id/upload -> 空间缺失 404；非法 body 400', async () => {
  const missing = await app.inject({
    method: 'POST',
    url: `${API_BASE}/spaces/s-nope/upload`,
    payload: { title: 'x', type: 'PDF', category: '产品介绍' },
  })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')

  const bad = await app.inject({
    method: 'POST',
    url: `${API_BASE}/spaces/s-product/upload`,
    payload: { title: '', type: 'PDF', category: '产品介绍' },
  })
  assert.equal(bad.statusCode, 400)
  assert.equal(bad.json().error.code, 'BAD_REQUEST')
})
