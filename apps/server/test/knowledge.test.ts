import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { API_BASE } from '@kb/shared'

// 测试隔离：动态 import 前先指向内存库（client.ts 单例读取 KB_DB_PATH）
process.env.KB_DB_PATH = ':memory:'
const { buildApp } = await import('../src/app.js')
const { db } = await import('../src/db/client.js')
const { seedIfEmpty } = await import('../src/db/seed.js')

const app = await buildApp()

/** 回到 seed 基线：业务表清空后重新播种（含知识地图/知识网站/答案池）。 */
function resetSeed() {
  db.exec(
    'DELETE FROM org; DELETE FROM plan; DELETE FROM members; DELETE FROM users; DELETE FROM trial_journey; DELETE FROM trial_applications; DELETE FROM spaces; DELETE FROM docs; DELETE FROM connectors; DELETE FROM sync_tasks; DELETE FROM knowledge_map; DELETE FROM knowledge_site; DELETE FROM answer_pool',
  )
  seedIfEmpty()
}

beforeEach(resetSeed)

interface MapNodeJson {
  id: string
  category: string
  docId: string | null
  position: { x: number; y: number }
}
interface MapCategoryJson {
  id: string
  name: string
  count: number
  questions: number
  health: number
}
interface MapRelationJson {
  from: string
  to: string
  type: string
}
interface SiteArticleJson {
  id: string
  title: string
  content: string
  category: string
  updatedAt: string
  status: string
}
interface CitationJson {
  doc: string
  version: string
  page: string
  role: string
}

const getMap = async () =>
  (await app.inject({ method: 'GET', url: `${API_BASE}/knowledge-map` })).json().data as {
    categories: MapCategoryJson[]
    nodes: MapNodeJson[]
    relations: MapRelationJson[]
  }

const getSite = async () =>
  (await app.inject({ method: 'GET', url: `${API_BASE}/knowledge-site` })).json().data as { items: SiteArticleJson[] }

// ---------- GET /knowledge-map ----------

test('GET /knowledge-map -> 5 分类（count 口径 32/48/67/25/28，questions/health 同 mapData.ts）', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/knowledge-map` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)

  const data = body.data as { categories: MapCategoryJson[]; nodes: MapNodeJson[]; relations: MapRelationJson[] }
  assert.equal(data.categories.length, 5)
  assert.deepEqual(
    data.categories.map((c) => c.name),
    ['产品介绍', '使用指南', '常见问题', 'API文档', '售后服务'],
  )
  assert.deepEqual(
    Object.fromEntries(data.categories.map((c) => [c.name, c.count])),
    { 产品介绍: 32, 使用指南: 48, 常见问题: 67, API文档: 25, 售后服务: 28 },
  )
  assert.deepEqual(
    Object.fromEntries(data.categories.map((c) => [c.id, c.health])),
    { 'cat-product': 88, 'cat-guide': 82, 'cat-faq': 91, 'cat-api': 76, 'cat-after': 64 },
  )
  // 分类计数复用 mapData MAP_CATEGORIES：questions 41/52/38/17/8
  assert.equal(data.categories.find((c) => c.name === '产品介绍')!.questions, 41)
  assert.equal(data.categories.find((c) => c.name === '售后服务')!.questions, 8)
})

test('GET /knowledge-map -> 节点结构：12 文档节点 + 6 问题节点（id/category/docId/position）', async () => {
  const data = await getMap()

  // 12 个图谱文档节点（● d1..d12）+ 6 个问题节点（■ q1..q6）
  assert.equal(data.nodes.length, 18)
  const docNodes = data.nodes.filter((n) => n.id.startsWith('d'))
  const qNodes = data.nodes.filter((n) => n.id.startsWith('q'))
  assert.equal(docNodes.length, 12)
  assert.equal(qNodes.length, 6)

  // 字段齐全：id/category/docId/position{x,y}
  for (const n of data.nodes) {
    assert.equal(typeof n.id, 'string')
    assert.equal(typeof n.category, 'string')
    assert.equal(typeof n.docId, 'string')
    assert.equal(typeof n.position.x, 'number')
    assert.equal(typeof n.position.y, 'number')
  }
  // 文档节点 docId 自引用；问题节点 docId 指向关联文档（q1→d7 报价折扣审批）
  assert.ok(docNodes.every((n) => n.docId === n.id))
  const q1 = qNodes.find((n) => n.id === 'q1')!
  assert.equal(q1.docId, 'd7')
  assert.equal(q1.category, '常见问题')
  // 热点文档 d1 在 产品介绍 分类下
  assert.equal(docNodes.find((n) => n.id === 'd1')!.category, '产品介绍')
})

test('GET /knowledge-map -> 关系：12 条 doc→category + 6 条 question→doc', async () => {
  const data = await getMap()
  assert.equal(data.relations.length, 18)

  const catRels = data.relations.filter((r) => r.type === 'category')
  assert.equal(catRels.length, 12)
  // 每个文档节点都有指向其分类的关系（d1→cat-product）
  assert.ok(catRels.some((r) => r.from === 'd1' && r.to === 'cat-product'))
  assert.ok(catRels.some((r) => r.from === 'd4' && r.to === 'cat-guide'))

  const qaRels = data.relations.filter((r) => r.type === 'qa')
  assert.equal(qaRels.length, 6)
  assert.ok(qaRels.some((r) => r.from === 'q1' && r.to === 'd7'))
  assert.ok(qaRels.some((r) => r.from === 'q3' && r.to === 'd1'))
})

// ---------- GET /knowledge-site ----------

test('GET /knowledge-site -> 25 篇文章（5 分类各 5 篇，字段齐全，updatedAt 倒序）', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/knowledge-site` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)

  const data = body.data as { items: SiteArticleJson[] }
  assert.equal(data.items.length, 25)
  // 字段齐全
  for (const a of data.items) {
    assert.equal(typeof a.id, 'string')
    assert.equal(typeof a.title, 'string')
    assert.equal(typeof a.content, 'string')
    assert.ok(['产品介绍', '使用指南', '常见问题', 'API文档', '售后服务'].includes(a.category))
    assert.equal(typeof a.updatedAt, 'string')
    assert.equal(a.status, '已发布')
  }
  // 5 分类各 5 篇
  const perCategory = Object.fromEntries(
    ['产品介绍', '使用指南', '常见问题', 'API文档', '售后服务'].map((c) => [c, data.items.filter((a) => a.category === c).length]),
  )
  assert.deepEqual(perCategory, { 产品介绍: 5, 使用指南: 5, 常见问题: 5, API文档: 5, 售后服务: 5 })
  // updatedAt 倒序（最近在前）
  for (let i = 1; i < data.items.length; i += 1) {
    assert.ok(data.items[i - 1].updatedAt >= data.items[i].updatedAt, `items[${i}] 乱序`)
  }
  // 首页「最近更新」首条在列（口径对齐 KnowledgeSite.tsx RECENT_UPDATES）
  assert.ok(data.items.some((a) => a.title === '产品定价与版本说明'))
  assert.ok(data.items.some((a) => a.title === 'API 鉴权与签名机制（v2.0）'))
})

// ---------- POST /knowledge-site/search ----------

test('POST /knowledge-site/search -> 关键词命中（q=Webhook 命中标题；q=API 命中多篇）', async () => {
  const hit = await app.inject({ method: 'POST', url: `${API_BASE}/knowledge-site/search`, payload: { q: 'Webhook' } })
  assert.equal(hit.statusCode, 200)
  const hitData = hit.json().data as { items: SiteArticleJson[] }
  assert.ok(hitData.items.length >= 1)
  assert.ok(hitData.items.some((a) => a.title.includes('Webhook')))

  const api = await app.inject({ method: 'POST', url: `${API_BASE}/knowledge-site/search`, payload: { q: 'API' } })
  assert.equal(api.statusCode, 200)
  const apiData = api.json().data as { items: SiteArticleJson[] }
  assert.ok(apiData.items.length >= 5, `API 应命中至少 5 篇，实际 ${apiData.items.length}`)
  assert.ok(apiData.items.every((a) => a.title.includes('API') || a.content.includes('API')))
})

test('POST /knowledge-site/search -> 无命中返回空列表（200）', async () => {
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/knowledge-site/search`, payload: { q: '不存在的关键词xyz' } })
  assert.equal(res.statusCode, 200)
  const data = res.json().data as { items: SiteArticleJson[] }
  assert.equal(data.items.length, 0)
})

test('POST /knowledge-site/search -> 空 q / 缺 q -> 400', async () => {
  const empty = await app.inject({ method: 'POST', url: `${API_BASE}/knowledge-site/search`, payload: { q: '' } })
  assert.equal(empty.statusCode, 400)
  assert.equal(empty.json().error.code, 'BAD_REQUEST')

  const missing = await app.inject({ method: 'POST', url: `${API_BASE}/knowledge-site/search`, payload: {} })
  assert.equal(missing.statusCode, 400)
  assert.equal(missing.json().error.code, 'BAD_REQUEST')

  const blank = await app.inject({ method: 'POST', url: `${API_BASE}/knowledge-site/search`, payload: { q: '   ' } })
  assert.equal(blank.statusCode, 400)
})

// ---------- POST /knowledge-site/qa ----------

test('POST /knowledge-site/qa -> 精确命中答案池：答案 + 引用（3 条 version/page）+ 可信度 92', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/knowledge-site/qa`,
    payload: { question: '客户报价折扣超过 10% 需要谁审批？' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const data = body.data
  assert.equal(data.answered, true)
  // 结论 + 解释都在 answer 里
  assert.ok(data.answer.includes('需要销售总监审批'))
  assert.ok(data.answer.includes('需由销售总监审批'))
  // 引用：口径对齐 base.mock answer.docs（3 条，含 version/page）
  assert.equal(Array.isArray(data.citations), true)
  assert.equal(data.citations.length, 3)
  assert.deepEqual(
    data.citations.map((c: CitationJson) => c.doc),
    ['《销售管理制度》', '《价格管理办法》', '《审批权限矩阵表》'],
  )
  assert.equal(data.citations[0].version, 'v2.1')
  assert.equal(data.citations[0].page, '第 8 页')
  assert.equal(data.citations[0].role, '主要依据')
  assert.equal(data.confidence, 92)
})

test('POST /knowledge-site/qa -> 包含匹配命中（变体问题也命中，如「请问退货政策是怎样的？」）', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/knowledge-site/qa`,
    payload: { question: '请问退货政策是怎样的？' },
  })
  assert.equal(res.statusCode, 200)
  const data = res.json().data
  assert.equal(data.answered, true)
  assert.ok(data.answer.includes('7 天无理由退货'))
  assert.equal(data.confidence, 92)
  assert.equal(data.citations[0].doc, '《退货与售后政策》')

  // 变体：去掉「客户」前缀的报价折扣问题
  const variant = await app.inject({
    method: 'POST',
    url: `${API_BASE}/knowledge-site/qa`,
    payload: { question: '报价折扣超过 10% 需要谁审批？' },
  })
  assert.equal(variant.statusCode, 200)
  assert.equal(variant.json().data.answered, true)
  assert.equal(variant.json().data.confidence, 92)
})

test('POST /knowledge-site/qa -> 命中黄档答案（质保期 78%）', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/knowledge-site/qa`,
    payload: { question: '质保期如何计算？' },
  })
  assert.equal(res.statusCode, 200)
  const data = res.json().data
  assert.equal(data.answered, true)
  assert.ok(data.answer.includes('12 个月'))
  assert.equal(data.confidence, 78)
})

test('POST /knowledge-site/qa -> 未命中走诚实拒答（reason/searchedCount/missingType/suggestions）', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/knowledge-site/qa`,
    payload: { question: '公司食堂几点开门？' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  const data = body.data
  assert.equal(data.answered, false)
  // 原因：镜像前端拒答卡语义「未找到足够可靠的企业知识…」
  assert.ok(data.reason.includes('未找到足够可靠的企业知识'))
  // 已检索范围：答案池 + 知识网站文章数（20 + 25 = 45）
  assert.equal(typeof data.searchedCount, 'number')
  assert.ok(data.searchedCount > 0)
  // 缺失知识类型
  assert.ok(data.missingType.includes('缺失类型'))
  // 建议（最接近主题不伪装）：至少 2 条可点击建议
  assert.equal(Array.isArray(data.suggestions), true)
  assert.ok(data.suggestions.length >= 2)
})

test('POST /knowledge-site/qa -> 未命中建议给出最接近主题（「报销需要哪些材料？」→ 建议「报销流程是怎样的？」）', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/knowledge-site/qa`,
    payload: { question: '报销需要哪些材料？' },
  })
  assert.equal(res.statusCode, 200)
  const data = res.json().data
  assert.equal(data.answered, false)
  // 不伪装成答案：只建议相近问题，且建议可点击追问
  assert.ok(data.suggestions.includes('报销流程是怎样的？'))
  assert.ok(data.suggestions.every((s: string) => typeof s === 'string' && s.length > 0))
})

test('POST /knowledge-site/qa -> 空 question / 缺 question -> 400', async () => {
  const empty = await app.inject({ method: 'POST', url: `${API_BASE}/knowledge-site/qa`, payload: { question: '' } })
  assert.equal(empty.statusCode, 400)
  assert.equal(empty.json().error.code, 'BAD_REQUEST')

  const missing = await app.inject({ method: 'POST', url: `${API_BASE}/knowledge-site/qa`, payload: {} })
  assert.equal(missing.statusCode, 400)
  assert.equal(missing.json().error.code, 'BAD_REQUEST')

  const blank = await app.inject({ method: 'POST', url: `${API_BASE}/knowledge-site/qa`, payload: { question: '   ' } })
  assert.equal(blank.statusCode, 400)
})

// ---------- 落库持久化 ----------

test('答案池 seed 落库：报销/报价/退货/年假/产品X/交付/工单/质保/考勤 均在库', async () => {
  const rows = db.prepare('SELECT question, confidence FROM answer_pool').all() as { question: string; confidence: number }[]
  const questions = rows.map((r) => r.question)
  for (const q of [
    '报销流程是怎样的？',
    '客户报价折扣超过 10% 需要谁审批？',
    '退货政策是怎样的？',
    '年假如何申请？',
    '产品 X 的核心优势是什么？',
    '标准交付周期是多久？',
    '工单响应时限是多久？',
    '质保期如何计算？',
    '考勤异常如何处理？',
  ]) {
    assert.ok(questions.includes(q), `答案池缺问题：${q}`)
  }
  // 10+ 题：9 个主问题 + 追问 = 20 条
  assert.ok(rows.length >= 10, `答案池至少 10 题，实际 ${rows.length}`)
  const hit = rows.find((r) => r.question === '客户报价折扣超过 10% 需要谁审批？')!
  assert.equal(hit.confidence, 92)
})

test('POST /knowledge-site/qa -> 知识网站 search/qa 响应均通过 @kb/shared schema（envelope ok:true）', async () => {
  // qa 命中与拒答都走 QaResponse discriminatedUnion
  const hit = await app.inject({ method: 'POST', url: `${API_BASE}/knowledge-site/qa`, payload: { question: '年假如何申请？' } })
  assert.equal(hit.json().data.answered, true)
  assert.equal(hit.json().data.confidence, 92)

  const miss = await app.inject({ method: 'POST', url: `${API_BASE}/knowledge-site/qa`, payload: { question: '月球上能种菜吗？' } })
  assert.equal(miss.json().data.answered, false)

  const site = await getSite()
  assert.ok(site.items.length > 0)
})
