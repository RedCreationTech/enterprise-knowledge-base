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
    'DELETE FROM org; DELETE FROM plan; DELETE FROM members; DELETE FROM users; DELETE FROM trial_journey; DELETE FROM trial_applications; DELETE FROM spaces; DELETE FROM docs; DELETE FROM connectors; DELETE FROM sync_tasks',
  )
  seedIfEmpty()
}

beforeEach(resetSeed)

interface DocJson {
  id: string
  spaceId: string
  title: string
  type: string
  category: string
  status: string
  owner: string
  updatedAt: string
  source: string
}

interface DocListJson {
  items: DocJson[]
  total: number
  page: number
  size: number
}

const getDocs = async (qs = '') =>
  (await app.inject({ method: 'GET', url: `${API_BASE}/docs${qs}` })).json().data as DocListJson

const getSpaces = async () =>
  (
    await app.inject({ method: 'GET', url: `${API_BASE}/spaces` })
  ).json().data as { id: string; name: string; count: number }[]

const countOf = (spaces: { id: string; count: number }[], id: string) => spaces.find((s) => s.id === id)!.count

// ---------- 过滤 + 分页 ----------

test('GET /docs -> 默认分页 size=10/total=128，updatedAt 倒序，字段齐全', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/docs` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)

  const data = body.data as DocListJson
  assert.equal(data.total, 128)
  assert.equal(data.page, 1)
  assert.equal(data.size, 10)
  assert.equal(data.items.length, 10)

  // updatedAt 倒序
  for (let i = 1; i < data.items.length; i += 1) {
    assert.ok(data.items[i - 1].updatedAt >= data.items[i].updatedAt, `items[${i}] 乱序`)
  }

  // 字段齐全：id/spaceId/title/type/category/status/owner/updatedAt/source
  for (const d of data.items) {
    for (const k of ['id', 'spaceId', 'title', 'type', 'category', 'status', 'owner', 'updatedAt', 'source'] as const) {
      assert.equal(typeof d[k], 'string')
    }
  }
})

test('GET /docs 分页 -> page=13 余 8 条、page=14 空、页码间无重叠、size 上限', async () => {
  const p1 = await getDocs('?page=1&size=10')
  const p2 = await getDocs('?page=2&size=10')
  assert.equal(p1.total, 128)
  assert.equal(p2.total, 128)
  const ids1 = new Set(p1.items.map((d) => d.id))
  assert.ok(p2.items.every((d) => !ids1.has(d.id)), 'page1/page2 不应有重叠')

  const p13 = await getDocs('?page=13&size=10')
  assert.equal(p13.items.length, 8) // 128 = 12*10 + 8
  const p14 = await getDocs('?page=14&size=10')
  assert.equal(p14.items.length, 0)

  const big = await getDocs('?page=1&size=100')
  assert.equal(big.items.length, 100)
})

test('GET /docs space 过滤 -> spaceId 直滤；默认空间别名解析为伞空间 id', async () => {
  const policy = await getDocs('?space=s-policy')
  assert.equal(policy.total, 34)
  assert.ok(policy.items.every((d) => d.spaceId === 's-policy'))

  // 别名「默认空间」→ 伞空间 id（s-all）
  const alias = await getDocs(`?space=${encodeURIComponent('默认空间')}`)
  assert.equal(alias.total, 22) // 伞空间直属 22 份
  assert.ok(alias.items.every((d) => d.spaceId === 's-all'))

  const direct = await getDocs('?space=s-all')
  assert.equal(direct.total, 22)

  // 不存在的 spaceId -> 0 条（非 404）
  const none = await getDocs('?space=s-nope')
  assert.equal(none.total, 0)
})

test('GET /docs search -> title LIKE；与 space 组合', async () => {
  const s = await getDocs(`?search=${encodeURIComponent('制度文件')}`)
  assert.equal(s.total, 34)
  assert.ok(s.items.every((d) => d.title.includes('制度文件')))

  const comb = await getDocs(`?space=s-policy&search=${encodeURIComponent('制度文件')}`)
  assert.equal(comb.total, 34)

  const none = await getDocs('?search=zzzz不存在')
  assert.equal(none.total, 0)
})

test('GET /docs type/status/category 精确过滤 + 组合', async () => {
  const pdf = await getDocs('?type=PDF')
  assert.equal(pdf.total, 32) // 128 份 4 种 type 均分
  assert.ok(pdf.items.every((d) => d.type === 'PDF'))

  const ready = await getDocs(`?status=${encodeURIComponent('已就绪')}`)
  assert.equal(ready.total, 42) // STATUSES[(n*7)%3]：n%3==0 → 42 份
  assert.ok(ready.items.every((d) => d.status === '已就绪'))

  const cat = await getDocs(`?category=${encodeURIComponent('产品介绍')}`)
  assert.equal(cat.total, 128) // (n*5)%5 恒为 0 → 全部为产品介绍
  assert.ok(cat.items.every((d) => d.category === '产品介绍'))
  const catNone = await getDocs(`?category=${encodeURIComponent('使用指南')}`)
  assert.equal(catNone.total, 0)

  // 组合：s-policy 内 type=PDF（n≡0 mod 4，n=36..68 共 9 份）
  const comb = await getDocs('?space=s-policy&type=PDF')
  assert.equal(comb.total, 9)
  assert.ok(comb.items.every((d) => d.spaceId === 's-policy' && d.type === 'PDF'))
})

test('GET /docs 非法参数 -> 400 BAD_REQUEST', async () => {
  for (const qs of ['?page=0', '?page=-1', '?size=0', '?size=101', '?page=abc', '?size=abc', '?page=1.5']) {
    const res = await app.inject({ method: 'GET', url: `${API_BASE}/docs${qs}` })
    assert.equal(res.statusCode, 400, qs)
    assert.equal(res.json().error.code, 'BAD_REQUEST', qs)
  }
})

// ---------- POST /docs/upload ----------

test('POST /docs/upload -> 落库 + 列表 +1 + 计数（目标 +1、伞 +1）；缺省 source 本地上传', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/docs/upload`,
    payload: { spaceId: 's-product', title: '《新上传文档》', type: 'Word', category: '使用指南', owner: '王强', source: '网盘' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const doc = body.data as DocJson
  assert.equal(doc.spaceId, 's-product')
  assert.equal(doc.title, '《新上传文档》')
  assert.equal(doc.type, 'Word')
  assert.equal(doc.category, '使用指南')
  assert.equal(doc.owner, '王强')
  assert.equal(doc.source, '网盘')
  assert.equal(doc.status, '已就绪')
  assert.equal(typeof doc.id, 'string')
  assert.equal(typeof doc.updatedAt, 'string')

  // 落库
  const row = db.prepare('SELECT * FROM docs WHERE id = ?').get(doc.id) as { spaceId: string; title: string }
  assert.equal(row.spaceId, 's-product')
  assert.equal(row.title, '《新上传文档》')

  // 列表 +1：128 → 129
  const list = await getDocs()
  assert.equal(list.total, 129)

  // 计数：s-product 32→33、伞 128→129
  let spaces = await getSpaces()
  assert.equal(countOf(spaces, 's-product'), 33)
  assert.equal(countOf(spaces, 's-all'), 129)

  // 缺省 source → 本地上传
  const def = await app.inject({
    method: 'POST',
    url: `${API_BASE}/docs/upload`,
    payload: { spaceId: 's-product', title: '《x》', type: 'PDF', category: '产品介绍' },
  })
  assert.equal(def.json().data.source, '本地上传')
  assert.equal(def.json().data.owner, '')

  // 上传到伞空间：只 +1 一次（129 → 130 → 131，另一次是缺省 source 上传所致）
  const toAll = await app.inject({
    method: 'POST',
    url: `${API_BASE}/docs/upload`,
    payload: { spaceId: 's-all', title: '《y》', type: 'PDF', category: '产品介绍' },
  })
  assert.equal(toAll.json().data.spaceId, 's-all')
  spaces = await getSpaces()
  assert.equal(countOf(spaces, 's-all'), 131)
  assert.equal(countOf(spaces, 's-product'), 34)
})

test('POST /docs/upload -> 空间缺失 404；非法 body 400', async () => {
  const missing = await app.inject({
    method: 'POST',
    url: `${API_BASE}/docs/upload`,
    payload: { spaceId: 's-nope', title: 'x', type: 'PDF', category: '产品介绍' },
  })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')

  const bad = await app.inject({
    method: 'POST',
    url: `${API_BASE}/docs/upload`,
    payload: { spaceId: 's-product', type: 'PDF' },
  })
  assert.equal(bad.statusCode, 400)
  assert.equal(bad.json().error.code, 'BAD_REQUEST')

  // 总数未变
  const list = await getDocs()
  assert.equal(list.total, 128)
})

// ---------- PATCH /docs/:id ----------

test('PATCH /docs/:id -> 重命名/改状态持久化；404 缺失；400 非法 body', async () => {
  const target = (await getDocs('?space=s-policy&size=1')).items[0]
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/docs/${target.id}`,
    payload: { title: '《制度文件 0（重命名）》', status: '待确认' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const doc = body.data as DocJson
  assert.equal(doc.title, '《制度文件 0（重命名）》')
  assert.equal(doc.status, '待确认')
  assert.equal(doc.spaceId, target.spaceId)

  // 持久化：search 可命中新标题
  const found = await getDocs(`?search=${encodeURIComponent('重命名')}`)
  assert.equal(found.total, 1)
  assert.equal(found.items[0].id, target.id)

  // 404 缺失
  const missing = await app.inject({ method: 'PATCH', url: `${API_BASE}/docs/d-nope`, payload: { title: 'x' } })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')

  // 400 非法 body
  const bad = await app.inject({ method: 'PATCH', url: `${API_BASE}/docs/${target.id}`, payload: { title: 123 } })
  assert.equal(bad.statusCode, 400)
  assert.equal(bad.json().error.code, 'BAD_REQUEST')
})

test('PATCH /docs/:id 移动空间 -> 新旧空间计数同步、伞计数不变（总数不变）；目标缺失 404', async () => {
  const target = (await getDocs('?space=s-policy&size=1')).items[0]
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/docs/${target.id}`,
    payload: { spaceId: 's-product' },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().data.spaceId, 's-product')

  // s-policy 34→33、s-product 32→33、伞 128 不变（移动不改变总数）
  let spaces = await getSpaces()
  assert.equal(countOf(spaces, 's-policy'), 33)
  assert.equal(countOf(spaces, 's-product'), 33)
  assert.equal(countOf(spaces, 's-all'), 128)

  // 移动到伞空间：伞 count 仍不变（总数不变）
  const t2 = (await getDocs('?space=s-policy&size=1')).items[0]
  const toAll = await app.inject({ method: 'PATCH', url: `${API_BASE}/docs/${t2.id}`, payload: { spaceId: 's-all' } })
  assert.equal(toAll.statusCode, 200)
  spaces = await getSpaces()
  assert.equal(countOf(spaces, 's-policy'), 32)
  assert.equal(countOf(spaces, 's-all'), 128)

  // 目标空间缺失 -> 404
  const missing = await app.inject({ method: 'PATCH', url: `${API_BASE}/docs/${target.id}`, payload: { spaceId: 's-nope' } })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')
})

// ---------- DELETE /docs/:id ----------

test('DELETE /docs/:id -> 删除 + 计数（命名空间 -1、伞 -1）；伞直属只 -1；重复删除 404', async () => {
  const target = (await getDocs('?space=s-policy&size=1')).items[0]
  const res = await app.inject({ method: 'DELETE', url: `${API_BASE}/docs/${target.id}` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.deleted, true)

  // s-policy 34→33、伞 128→127（总数 -1）
  let spaces = await getSpaces()
  assert.equal(countOf(spaces, 's-policy'), 33)
  assert.equal(countOf(spaces, 's-all'), 127)
  assert.equal((db.prepare('SELECT COUNT(*) c FROM docs').get() as { c: number }).c, 127)

  // 伞直属文档删除：伞只 -1（127→126）
  const umbrellaDoc = (await getDocs('?space=s-all&size=1')).items[0]
  const res2 = await app.inject({ method: 'DELETE', url: `${API_BASE}/docs/${umbrellaDoc.id}` })
  assert.equal(res2.statusCode, 200)
  spaces = await getSpaces()
  assert.equal(countOf(spaces, 's-all'), 126)
  assert.equal(countOf(spaces, 's-policy'), 33)

  // 重复删除 404
  const again = await app.inject({ method: 'DELETE', url: `${API_BASE}/docs/${target.id}` })
  assert.equal(again.statusCode, 404)
  assert.equal(again.json().error.code, 'NOT_FOUND')
})

// ---------- POST /docs/batch-archive ----------

test('POST /docs/batch-archive -> 归档命中、跳过缺失、计数不变', async () => {
  const docs = (await getDocs('?space=s-policy&size=3')).items
  const ids = docs.map((d) => d.id)
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/docs/batch-archive`,
    payload: { ids: [...ids, 'd-nope'] },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.updated, 3)

  for (const id of ids) {
    const row = db.prepare('SELECT status FROM docs WHERE id = ?').get(id) as { status: string }
    assert.equal(row.status, '已归档')
  }

  // 计数不变
  const spaces = await getSpaces()
  assert.equal(countOf(spaces, 's-policy'), 34)
  assert.equal(countOf(spaces, 's-all'), 128)

  // 空 ids -> updated 0
  const empty = await app.inject({ method: 'POST', url: `${API_BASE}/docs/batch-archive`, payload: { ids: [] } })
  assert.equal(empty.json().data.updated, 0)
})

// ---------- POST /docs/batch-move ----------

test('POST /docs/batch-move -> 计数同步、伞不变；目标缺失 404', async () => {
  const docs = (await getDocs('?space=s-policy&size=3')).items
  const ids = docs.map((d) => d.id)
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/docs/batch-move`,
    payload: { ids, spaceId: 's-product' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.updated, 3)

  // s-policy 34→31、s-product 32→35、伞 128 不变
  let spaces = await getSpaces()
  assert.equal(countOf(spaces, 's-policy'), 31)
  assert.equal(countOf(spaces, 's-product'), 35)
  assert.equal(countOf(spaces, 's-all'), 128)
  for (const id of ids) {
    const row = db.prepare('SELECT spaceId FROM docs WHERE id = ?').get(id) as { spaceId: string }
    assert.equal(row.spaceId, 's-product')
  }

  // 移动到伞空间：伞 count 不变（总数不变）
  const docs2 = (await getDocs('?space=s-policy&size=2')).items
  const res2 = await app.inject({
    method: 'POST',
    url: `${API_BASE}/docs/batch-move`,
    payload: { ids: docs2.map((d) => d.id), spaceId: 's-all' },
  })
  assert.equal(res2.json().data.updated, 2)
  spaces = await getSpaces()
  assert.equal(countOf(spaces, 's-policy'), 29)
  assert.equal(countOf(spaces, 's-all'), 128)

  // 目标空间缺失 404
  const missing = await app.inject({
    method: 'POST',
    url: `${API_BASE}/docs/batch-move`,
    payload: { ids, spaceId: 's-nope' },
  })
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.json().error.code, 'NOT_FOUND')
})
