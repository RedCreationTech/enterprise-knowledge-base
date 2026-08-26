import { db } from '../db/client.js'
import type { SearchGroup, SearchItem } from '@kb/shared'

/** 文档行（搜索仅需最小字段：id/title/type/category）。 */
interface DocRow {
  id: string
  title: string
  type: string
  category: string
}

/** 答案池行（问题/可信度）。 */
interface QuestionRow {
  id: string
  question: string
  confidence: number
}

/** 知识网站文章行（标题/分类/更新时间）。 */
interface ArticleRow {
  id: string
  title: string
  category: string
  updatedAt: string
}

/** 空间行（名称/文档计数）。 */
interface SpaceRow {
  id: string
  name: string
  count: number
}

/** 分组路由提示：与前端路由表一致（doc → 知识库、question → AI 助手、article → 知识网站、space → 空间）。 */
const DOC_PATH = '/workspace/knowledge-base'
const QUESTION_PATH = '/workspace/ai-assistant'
const ARTICLE_PATH = '/workspace/knowledge-site'
const SPACE_PATH = '/workspace/spaces'

/**
 * GET /search：跨源分组搜索（q 已由 zod trim+min 校验非空）。
 * - 文档组：docs.title LIKE（按 updatedAt 倒序）。
 * - 问题组：answer_pool.question LIKE（答案池问题，AI 助手路由）。
 * - 文章组：knowledge_site.title/content LIKE（知识网站文章）。
 * - 空间组：spaces.name LIKE。
 * 每组分页上限 limit（默认 5）；空命中组不返回；全部无命中 → groups: []。
 * 分组语义镜像前端 HeaderSearch（文档/问题…分组展示），条目含 path 路由提示供前端跳转。
 */
export function searchAll(q: string, limit: number): SearchGroup[] {
  const like = `%${q}%`
  const groups: SearchGroup[] = []

  const docs = db
    .prepare('SELECT id, title, type, category FROM docs WHERE title LIKE ? ORDER BY updatedAt DESC, id ASC LIMIT ?')
    .all(like, limit) as DocRow[]
  if (docs.length > 0) {
    groups.push({
      key: 'docs',
      label: '文档',
      items: docs.map(
        (d): SearchItem => ({ id: d.id, name: d.title, meta: `${d.type} · ${d.category}`, path: DOC_PATH }),
      ),
    })
  }

  const questions = db
    .prepare('SELECT id, question, confidence FROM answer_pool WHERE question LIKE ? ORDER BY rowid ASC LIMIT ?')
    .all(like, limit) as QuestionRow[]
  if (questions.length > 0) {
    groups.push({
      key: 'questions',
      label: '问题',
      items: questions.map(
        (x): SearchItem => ({ id: x.id, name: x.question, meta: `AI 助手 · 可信度 ${x.confidence}%`, path: QUESTION_PATH }),
      ),
    })
  }

  const articles = db
    .prepare(
      'SELECT id, title, category, updatedAt FROM knowledge_site WHERE title LIKE ? OR content LIKE ? ORDER BY updatedAt DESC, id ASC LIMIT ?',
    )
    .all(like, like, limit) as ArticleRow[]
  if (articles.length > 0) {
    groups.push({
      key: 'articles',
      label: '文章',
      items: articles.map(
        (a): SearchItem => ({
          id: a.id,
          name: a.title,
          meta: `${a.category} · ${a.updatedAt.slice(0, 10)} 更新`,
          path: ARTICLE_PATH,
        }),
      ),
    })
  }

  const spaces = db
    .prepare('SELECT id, name, count FROM spaces WHERE name LIKE ? ORDER BY rowid ASC LIMIT ?')
    .all(like, limit) as SpaceRow[]
  if (spaces.length > 0) {
    groups.push({
      key: 'spaces',
      label: '空间',
      items: spaces.map((s): SearchItem => ({ id: s.id, name: s.name, meta: `${s.count} 篇文档`, path: SPACE_PATH })),
    })
  }

  return groups
}
