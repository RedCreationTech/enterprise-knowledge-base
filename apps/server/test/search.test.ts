import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { API_BASE } from '@kb/shared'

// 测试隔离：动态 import 前先指向内存库（client.ts 单例读取 KB_DB_PATH）
process.env.KB_DB_PATH = ':memory:'
const { buildApp } = await import('../src/app.js')
const { db } = await import('../src/db/client.js')
const { seedIfEmpty } = await import('../src/db/seed.js')

const app = await buildApp()

/** 回到 seed 基线：业务表清空后重新播种（含文档/空间/答案池/知识网站）。 */
function resetSeed() {
  db.exec(
    'DELETE FROM org; DELETE FROM plan; DELETE FROM members; DELETE FROM users; DELETE FROM trial_journey; DELETE FROM trial_applications; DELETE FROM spaces; DELETE FROM docs; DELETE FROM connectors; DELETE FROM sync_tasks; DELETE FROM knowledge_map; DELETE FROM knowledge_site; DELETE FROM answer_pool',
  )
  seedIfEmpty()
}

beforeEach(resetSeed)

interface SearchItemJson {
  id: string
  name: string
  meta: string
  path: string
}
interface SearchGroupJson {
  key: string
  label: string
  items: SearchItemJson[]
}

/** 发起 /search 请求并返回 groups。 */
const search = async (qs: string) => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/search${qs}` })
  assert.equal(res.statusCode, 200, qs)
  const body = res.json()
  assert.equal(body.ok, true, qs)
  return body.data as { groups: SearchGroupJson[] }
}

const groupByKey = (groups: SearchGroupJson[]) => Object.fromEntries(groups.map((g) => [g.key, g]))

// ---------- 分组命中 ----------

test('GET /search -> q=知识文档 命中文档分组（label 文档，默认 limit=5，path=/workspace/knowledge-base）', async () => {
  const { groups } = await search(`?q=${encodeURIComponent('知识文档')}`)
  const byKey = groupByKey(groups)
  assert.ok(byKey['docs'], '应包含 docs 分组')
  assert.equal(byKey['docs'].label, '文档')
  // seed 中 22 份《知识文档 N》，默认每组分页上限 5
  assert.equal(byKey['docs'].items.length, 5)
  for (const it of byKey['docs'].items) {
    assert.ok(it.name.includes('知识文档'), it.name)
    assert.equal(it.path, '/workspace/knowledge-base')
    // 字段齐全：id/name/meta/path
    assert.equal(typeof it.id, 'string')
    assert.equal(typeof it.meta, 'string')
  }
})

test('GET /search -> q=报销 命中问题分组（label 问题，path=/workspace/ai-assistant，meta 含 AI 助手）', async () => {
  const { groups } = await search(`?q=${encodeURIComponent('报销')}`)
  const byKey = groupByKey(groups)
  assert.ok(byKey['questions'], '应包含 questions 分组')
  assert.equal(byKey['questions'].label, '问题')
  assert.ok(byKey['questions'].items.some((it) => it.name === '报销流程是怎样的？'))
  assert.ok(byKey['questions'].items.every((it) => it.path === '/workspace/ai-assistant'))
  assert.ok(byKey['questions'].items.every((it) => it.meta.includes('AI 助手')))
})

test('GET /search -> q=API 命中文章分组（knowledge_site 标题命中，path=/workspace/knowledge-site）', async () => {
  const { groups } = await search('?q=API')
  const byKey = groupByKey(groups)
  assert.ok(byKey['articles'], '应包含 articles 分组（知识网站文章）')
  assert.equal(byKey['articles'].label, '文章')
  // 3 篇 API 标题文章必在列（内容模板含「API文档」分类，同分类文章可能一并命中）
  assert.ok(byKey['articles'].items.length >= 3)
  for (const t of ['API 鉴权与签名机制（v2.0）', 'API 接入指南（v2.0）', 'API 调用频率限制说明']) {
    assert.ok(byKey['articles'].items.some((it) => it.name === t), `缺文章：${t}`)
  }
  assert.ok(byKey['articles'].items.every((it) => it.path === '/workspace/knowledge-site'))
})

test('GET /search -> q=销售弹药库 命中空间分组（path=/workspace/spaces）', async () => {
  const { groups } = await search(`?q=${encodeURIComponent('销售弹药库')}`)
  const byKey = groupByKey(groups)
  assert.ok(byKey['spaces'], '应包含 spaces 分组')
  assert.equal(byKey['spaces'].label, '空间')
  assert.deepEqual(
    byKey['spaces'].items.map((it) => it.name),
    ['销售弹药库'],
  )
  assert.equal(byKey['spaces'].items[0].path, '/workspace/spaces')
})

// ---------- 多分组 ----------

test('GET /search -> q=制度 同时命中文档+空间两组（顺序 docs→questions→articles→spaces）', async () => {
  const { groups } = await search(`?q=${encodeURIComponent('制度')}`)
  // 《制度文件 N》34 份 + 空间「制度与流程」
  assert.deepEqual(
    groups.map((g) => g.key),
    ['docs', 'spaces'],
  )
  const byKey = groupByKey(groups)
  assert.equal(byKey['docs'].items.length, 5)
  assert.ok(byKey['docs'].items.every((it) => it.name.includes('制度文件')))
  assert.deepEqual(
    byKey['spaces'].items.map((it) => it.name),
    ['制度与流程'],
  )
})

test('GET /search -> 上传含关键词文档后 q=报销 同时命中文档+问题两组', async () => {
  const up = await app.inject({
    method: 'POST',
    url: `${API_BASE}/docs/upload`,
    payload: { spaceId: 's-product', title: '《报销补充说明》', type: 'PDF', category: '使用指南' },
  })
  assert.equal(up.statusCode, 200)

  const { groups } = await search(`?q=${encodeURIComponent('报销')}`)
  assert.deepEqual(
    groups.map((g) => g.key),
    ['docs', 'questions'],
  )
  const byKey = groupByKey(groups)
  assert.ok(byKey['docs'].items.some((it) => it.name === '《报销补充说明》'))
  assert.ok(byKey['questions'].items.some((it) => it.name === '报销流程是怎样的？'))
})

// ---------- 无结果 / 参数校验 ----------

test('GET /search -> 无结果返回 groups: []（200 ok:true）', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/search?q=不存在的关键词xyz` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.deepEqual(body.data.groups, [])
})

test('GET /search -> 空 q / 缺 q / 全空白 -> 400 BAD_REQUEST', async () => {
  for (const qs of ['', '?q=', '?q=%20%20%20', '?q=&limit=5']) {
    const res = await app.inject({ method: 'GET', url: `${API_BASE}/search${qs}` })
    assert.equal(res.statusCode, 400, qs)
    assert.equal(res.json().error.code, 'BAD_REQUEST', qs)
  }
})

// ---------- limit 每组分页上限 ----------

test('GET /search -> limit 生效（q=知识文档 22 份：limit=3 -> 3 条、limit=2 -> 2 条）', async () => {
  const three = await search(`?q=${encodeURIComponent('知识文档')}&limit=3`)
  assert.equal(groupByKey(three.groups)['docs'].items.length, 3)

  const two = await search(`?q=${encodeURIComponent('知识文档')}&limit=2`)
  assert.equal(groupByKey(two.groups)['docs'].items.length, 2)
})

test('GET /search -> 非法 limit（0 / 21 / abc）-> 400 BAD_REQUEST', async () => {
  for (const qs of ['?q=文档&limit=0', '?q=文档&limit=21', '?q=文档&limit=abc', '?q=文档&limit=-1']) {
    const res = await app.inject({ method: 'GET', url: `${API_BASE}/search${qs}` })
    assert.equal(res.statusCode, 400, qs)
    assert.equal(res.json().error.code, 'BAD_REQUEST', qs)
  }
})

test('GET /search -> 响应通过 @kb/shared schema（envelope ok:true + groups 结构）', async () => {
  const { groups } = await search(`?q=${encodeURIComponent('退货')}`)
  // 退货：问题分组（退货政策/退货运费/定制产品）+ 文章分组（退换货处理流程不在 knowledge_site，仅问题）
  const byKey = groupByKey(groups)
  assert.ok(byKey['questions'])
  assert.ok(byKey['questions'].items.some((it) => it.name === '退货政策是怎样的？'))
})
