import { db } from '../db/client.js'
import type {
  KnowledgeMapCategory,
  KnowledgeMapData,
  KnowledgeMapNode,
  KnowledgeMapRelation,
  KnowledgeSiteArticle,
  QaCitation,
  QaRefusal,
  QaResult,
} from '@kb/shared'

/** 知识地图行（SQLite 行）。分类节点 docId=NULL；position/relations 为 JSON 文本。 */
interface MapRow {
  id: string
  category: string
  docId: string | null
  position: string
  relations: string
}

/** 知识网站文章行。 */
interface SiteRow {
  id: string
  title: string
  content: string
  category: string
  updatedAt: string
  status: string
}

/** 答案池行。citations 为 JSON 文本（doc/version/page/role 数组）。 */
interface PoolRow {
  id: string
  question: string
  answer: string
  citations: string
  confidence: number
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** 知识地图分类汇总元数据（存于分类节点行的 relations 列：{count, questions, health}）。 */
interface CategoryMeta {
  count: number
  questions: number
  health: number
}

/**
 * GET /knowledge-map：分类 + 节点 + 关系。
 * - 分类节点（docId=NULL）：relations 列承载分类汇总 {count, questions, health}（口径对齐
 *   mapData.ts MAP_CATEGORIES：32/48/67/25/28 + 41/52/38/17/8 + 88/82/91/76/64）。
 * - 文档/问题节点（docId 非空）：relations 列为 {to, type} 关系数组，聚合为全局关系列表。
 */
export function getKnowledgeMap(): KnowledgeMapData {
  const rows = db.prepare('SELECT * FROM knowledge_map ORDER BY rowid').all() as MapRow[]

  const categories: KnowledgeMapCategory[] = []
  const nodes: KnowledgeMapNode[] = []
  const relations: KnowledgeMapRelation[] = []

  for (const row of rows) {
    if (row.docId === null) {
      const meta = parseJson<CategoryMeta>(row.relations, { count: 0, questions: 0, health: 0 })
      categories.push({
        id: row.id,
        name: row.category,
        count: meta.count,
        questions: meta.questions,
        health: meta.health,
      })
      continue
    }
    nodes.push({
      id: row.id,
      category: row.category,
      docId: row.docId,
      position: parseJson(row.position, { x: 0, y: 0 }),
    })
    const rels = parseJson<Array<{ to: string; type: string }>>(row.relations, [])
    for (const rel of rels) {
      relations.push({ from: row.id, to: rel.to, type: rel.type })
    }
  }

  return { categories, nodes, relations }
}

function rowToArticle(row: SiteRow): KnowledgeSiteArticle {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    updatedAt: row.updatedAt,
    status: row.status,
  }
}

/** GET /knowledge-site：知识网站文章/栏目列表，updatedAt 倒序（最近在前）。 */
export function listSiteArticles(): KnowledgeSiteArticle[] {
  const rows = db.prepare('SELECT * FROM knowledge_site ORDER BY updatedAt DESC, id ASC').all() as SiteRow[]
  return rows.map(rowToArticle)
}

/** POST /knowledge-site/search：标题/内容 LIKE 命中（q 已由 zod trim+min 校验非空）。 */
export function searchSite(q: string): KnowledgeSiteArticle[] {
  const like = `%${q}%`
  const rows = db
    .prepare('SELECT * FROM knowledge_site WHERE title LIKE ? OR content LIKE ? ORDER BY updatedAt DESC, id ASC')
    .all(like, like) as SiteRow[]
  return rows.map(rowToArticle)
}

/**
 * 答案池命中：精确相等优先；其次包含匹配（问句含池问题全文，或池问题含问句且问句≥4 字）。
 * 返回第一条命中（同义/变体问题可命中权威答案）。
 */
function findPoolEntry(rows: PoolRow[], question: string): PoolRow | null {
  const exact = rows.find((p) => p.question === question)
  if (exact) return exact
  if (question.length >= 4) {
    return (
      rows.find((p) => question.includes(p.question) || (p.question.length >= 4 && p.question.includes(question))) ?? null
    )
  }
  return null
}

/**
 * 未命中时给出「最接近主题」建议（不伪装成答案）：按连续双字子串重合度打分，
 * 取重合比例最高的 ≤3 个池问题；无重合时给通用建议（换个问法/上传资料）。
 */
function closestPoolQuestions(rows: PoolRow[], question: string, max = 3): string[] {
  const scored = rows
    .map((p) => {
      const bigrams = new Set<string>()
      for (let i = 0; i + 1 < question.length; i += 1) bigrams.add(question.slice(i, i + 2))
      let shared = 0
      for (let i = 0; i + 1 < p.question.length; i += 1) {
        if (bigrams.has(p.question.slice(i, i + 2))) shared += 1
      }
      // 重合比例：共享双字数 / 两问句字符总长（区分「报销」这种强特征与「需要」这类弱共性）
      const ratio = shared / (question.length + p.question.length)
      return { question: p.question, ratio }
    })
    .filter((s) => s.ratio > 0)
    .sort((a, b) => b.ratio - a.ratio)

  if (scored.length === 0) return ['换个问法重新提问', '上传相关资料后重试']
  return scored.slice(0, max).map((s) => s.question)
}

/**
 * POST /knowledge-site/qa：命中答案池 → {answered:true, answer, citations, confidence}；
 * 未命中 → 诚实拒答（原因/已检索范围/缺失类型/建议，镜像前端拒答卡语义）。
 */
export function answerQuestion(question: string): QaResult {
  const q = question.trim()
  const rows = db.prepare('SELECT * FROM answer_pool ORDER BY rowid').all() as PoolRow[]

  const hit = findPoolEntry(rows, q)
  if (hit) {
    return {
      answered: true,
      answer: hit.answer,
      citations: parseJson<QaCitation[]>(hit.citations, []),
      confidence: hit.confidence,
    }
  }

  const siteCount = (db.prepare('SELECT COUNT(*) c FROM knowledge_site').get() as { c: number }).c
  const refusal: QaRefusal = {
    answered: false,
    reason: '未找到足够可靠的企业知识来回答该问题，为避免误导暂不生成回答。',
    // 已检索范围：答案池条数 + 知识网站文章数（本次问答实际检索的知识源数量）
    searchedCount: rows.length + siteCount,
    missingType: '缺失类型：与该问题直接相关的制度/方案文档',
    suggestions: closestPoolQuestions(rows, q),
  }
  return refusal
}
