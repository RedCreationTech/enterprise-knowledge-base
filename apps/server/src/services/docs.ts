import { db } from '../db/client.js'
import type { Doc } from '@kb/shared'
import type { DocListQueryInput, DocPatchInput } from '@kb/shared'
import { DEFAULT_SPACE_ID } from './spaces.js'

interface DocRow { id: string; spaceId: string; title: string; type: string; category: string; status: string; owner: string; updatedAt: string; source: string }

function rowToDoc(row: DocRow): Doc {
  return {
    id: row.id,
    spaceId: row.spaceId,
    title: row.title,
    type: row.type,
    category: row.category,
    status: row.status,
    owner: row.owner,
    updatedAt: row.updatedAt,
    source: row.source,
  }
}

/** GET /docs 查询参数中伞空间的别名：'默认空间' → 伞空间 id（s-all）。 */
const UMBRELLA_QUERY_ALIAS = '默认空间'

export interface DocListResult { items: Doc[]; total: number; page: number; size: number }

/**
 * 分页 + 过滤列表：space（别名「默认空间」→ 伞 id）/search（title LIKE）/
 * type/status/category（精确）；按 updatedAt 倒序；page>=1、size 1..100（zod 已校验）。
 */
export function listDocs(query: DocListQueryInput): DocListResult {
  const where: string[] = []
  const values: unknown[] = []

  if (query.space !== undefined && query.space !== '') {
    where.push('spaceId = ?')
    values.push(query.space === UMBRELLA_QUERY_ALIAS ? DEFAULT_SPACE_ID : query.space)
  }
  if (query.search !== undefined && query.search !== '') {
    where.push('title LIKE ?')
    values.push(`%${query.search}%`)
  }
  for (const key of ['type', 'status', 'category'] as const) {
    const v = query[key]
    if (v !== undefined && v !== '') {
      where.push(`${key} = ?`)
      values.push(v)
    }
  }
  const whereSql = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : ''

  const total = (db.prepare(`SELECT COUNT(*) c FROM docs${whereSql}`).get(...values) as { c: number }).c
  const offset = (query.page - 1) * query.size
  const rows = db.prepare(
    `SELECT * FROM docs${whereSql} ORDER BY updatedAt DESC, id DESC LIMIT ? OFFSET ?`,
  ).all(...values, query.size, offset) as DocRow[]

  return { items: rows.map(rowToDoc), total, page: query.page, size: query.size }
}

export function getDoc(id: string): Doc | null {
  const row = db.prepare('SELECT * FROM docs WHERE id = ?').get(id) as DocRow | undefined
  return row ? rowToDoc(row) : null
}

/** DocPatch 键 → docs 列名的显式白名单：SQL 列名只允许来自此固定映射。 */
const DOC_COLUMNS: Record<keyof DocPatchInput, string> = {
  title: 'title',
  type: 'type',
  category: 'category',
  status: 'status',
  owner: 'owner',
  spaceId: 'spaceId',
}

export type PatchDocResult =
  | { status: 'ok'; doc: Doc }
  | { status: 'not-found' }
  | { status: 'space-not-found' }

/**
 * 部分更新文档：白名单列；spaceId 变更时同步旧/新空间计数
 * （伞空间 count=全库总数，迁移不改变总数故不动；旧/新为伞时跳过对应增减）。
 * 文档缺失 → not-found；目标空间缺失 → space-not-found。
 */
export function patchDoc(id: string, patch: DocPatchInput): PatchDocResult {
  const current = db.prepare('SELECT * FROM docs WHERE id = ?').get(id) as DocRow | undefined
  if (!current) return { status: 'not-found' }

  const newSpaceId = patch.spaceId ?? current.spaceId
  if (newSpaceId !== current.spaceId) {
    const target = db.prepare('SELECT id FROM spaces WHERE id = ?').get(newSpaceId)
    if (!target) return { status: 'space-not-found' }
  }

  const doUpdate = db.transaction(() => {
    const sets: string[] = []
    const values: unknown[] = []
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue
      const column = DOC_COLUMNS[key as keyof DocPatchInput]
      if (!column) continue // 未知键防御（zod 已剔除未知键，此处双保险）
      sets.push(`${column} = ?`)
      values.push(value)
    }
    if (sets.length > 0) {
      db.prepare(`UPDATE docs SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
    }
    // 空间迁移计数：旧空间 -1、新空间 +1（伞空间跳过）
    if (newSpaceId !== current.spaceId) {
      if (current.spaceId !== DEFAULT_SPACE_ID) {
        db.prepare('UPDATE spaces SET count = count - 1 WHERE id = ?').run(current.spaceId)
      }
      if (newSpaceId !== DEFAULT_SPACE_ID) {
        db.prepare('UPDATE spaces SET count = count + 1 WHERE id = ?').run(newSpaceId)
      }
    }
  })
  doUpdate()
  return { status: 'ok', doc: getDoc(id)! }
}

/**
 * 删除文档（事务）：docs 行删除 + 其空间 count -1；
 * 非伞空间文档另使伞空间（count=全库总数）-1。缺失返回 false。
 */
export function deleteDoc(id: string): boolean {
  const removeAndCount = db.transaction(() => {
    const row = db.prepare('SELECT spaceId FROM docs WHERE id = ?').get(id) as { spaceId: string } | undefined
    if (!row) return false
    db.prepare('DELETE FROM docs WHERE id = ?').run(id)
    db.prepare('UPDATE spaces SET count = count - 1 WHERE id = ?').run(row.spaceId)
    if (row.spaceId !== DEFAULT_SPACE_ID) {
      db.prepare('UPDATE spaces SET count = count - 1 WHERE id = ?').run(DEFAULT_SPACE_ID)
    }
    return true
  })
  return removeAndCount()
}

/** 批量归档：命中文档置 status=已归档，缺失 id 跳过；返回实际命中数。 */
export function batchArchive(ids: string[]): { updated: number } {
  if (ids.length === 0) return { updated: 0 }
  const archive = db.transaction(() => {
    const placeholders = ids.map(() => '?').join(', ')
    const info = db.prepare(`UPDATE docs SET status = '已归档' WHERE id IN (${placeholders})`).run(...ids)
    return { updated: info.changes }
  })
  return archive()
}

export type BatchMoveResult = { status: 'ok'; updated: number } | { status: 'space-not-found' }

/**
 * 批量移动：ids 文档 spaceId 改为目标空间，逐个同步旧/新空间计数
 * （已在目标空间者跳过；伞空间 count=全库总数，迁移不改变总数故不动）。
 * 目标空间缺失 → space-not-found。返回实际移动数。
 */
export function batchMove(ids: string[], spaceId: string): BatchMoveResult {
  const target = db.prepare('SELECT id FROM spaces WHERE id = ?').get(spaceId)
  if (!target) return { status: 'space-not-found' }
  if (ids.length === 0) return { status: 'ok', updated: 0 }

  const move = db.transaction(() => {
    const placeholders = ids.map(() => '?').join(', ')
    const rows = db.prepare(`SELECT id, spaceId FROM docs WHERE id IN (${placeholders})`).all(...ids) as {
      id: string
      spaceId: string
    }[]
    const updDoc = db.prepare('UPDATE docs SET spaceId = ? WHERE id = ?')
    const dec = db.prepare('UPDATE spaces SET count = count - 1 WHERE id = ?')
    const inc = db.prepare('UPDATE spaces SET count = count + 1 WHERE id = ?')
    let updated = 0
    for (const row of rows) {
      if (row.spaceId === spaceId) continue // 已在目标空间
      updDoc.run(spaceId, row.id)
      if (row.spaceId !== DEFAULT_SPACE_ID) dec.run(row.spaceId)
      if (spaceId !== DEFAULT_SPACE_ID) inc.run(spaceId)
      updated += 1
    }
    return { updated }
  })
  return { status: 'ok', ...move() }
}
