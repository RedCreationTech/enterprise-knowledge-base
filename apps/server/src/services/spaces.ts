import { randomUUID } from 'node:crypto'
import { db } from '../db/client.js'
import type { Space, Doc } from '@kb/shared'
import type { SpaceCreateBodyInput, SpacePatchInput, DocUploadBodyInput } from '@kb/shared'

/**
 * 默认伞空间（全部知识）：seed 固定 id，不可删除 / 不可重命名；
 * 其 count 为全库文档总数（含命名空间），upload 到任一空间时同步 +1。
 */
export const DEFAULT_SPACE_ID = 's-all'
export const DEFAULT_SPACE_NAME = '默认空间（全部知识）'

/** 新建空间的默认口径（与前端向导一致）：count 0 / 健康 / 180 天复审 / 未归档。 */
const DEFAULT_HEALTH: Space['health'] = '健康'
const DEFAULT_REVIEW_CYCLE = 180

interface SpaceRow { id: string; name: string; count: number; health: string; reviewCycle: number; archived: number; createdAt: string }
interface DocRow { id: string; spaceId: string; title: string; type: string; category: string; status: string; owner: string; updatedAt: string; source: string }

/** spaces.archived 为 SQLite INTEGER，返回 JSON 时映射为布尔。 */
function rowToSpace(row: SpaceRow): Space {
  return {
    id: row.id,
    name: row.name,
    count: row.count,
    health: row.health as Space['health'],
    reviewCycle: row.reviewCycle,
    archived: !!row.archived,
    createdAt: row.createdAt,
  }
}

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

export function listSpaces(): Space[] {
  const rows = db.prepare('SELECT * FROM spaces ORDER BY rowid').all() as SpaceRow[]
  return rows.map(rowToSpace)
}

export function getSpace(id: string): Space | null {
  const row = db.prepare('SELECT * FROM spaces WHERE id = ?').get(id) as SpaceRow | undefined
  return row ? rowToSpace(row) : null
}

function spaceNameExists(name: string): boolean {
  return !!db.prepare('SELECT id FROM spaces WHERE name = ?').get(name)
}

export type CreateSpaceResult = { status: 'ok'; space: Space } | { status: 'duplicate' } // 重名 409

/** 创建空间：name 必填（zod 已校验），其余走默认口径；重名不落库。 */
export function createSpace(body: SpaceCreateBodyInput): CreateSpaceResult {
  if (spaceNameExists(body.name)) return { status: 'duplicate' }

  const space: Space = {
    id: `s-${randomUUID()}`,
    name: body.name,
    count: 0,
    health: DEFAULT_HEALTH,
    reviewCycle: DEFAULT_REVIEW_CYCLE,
    archived: false,
    createdAt: new Date().toISOString().slice(0, 10),
  }
  db.prepare('INSERT INTO spaces (id, name, count, health, reviewCycle, archived, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    space.id,
    space.name,
    space.count,
    space.health,
    space.reviewCycle,
    space.archived ? 1 : 0,
    space.createdAt,
  )
  return { status: 'ok', space }
}

/** SpacePatch 键 → spaces 列名的显式白名单：SQL 列名只允许来自此固定映射，杜绝动态拼接。 */
const SPACE_COLUMNS: Record<keyof SpacePatchInput, string> = {
  name: 'name',
  health: 'health',
  reviewCycle: 'reviewCycle',
  archived: 'archived',
}

export function patchSpace(id: string, patch: SpacePatchInput): Space | null {
  const exists = db.prepare('SELECT id FROM spaces WHERE id = ?').get(id)
  if (!exists) return null

  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const column = SPACE_COLUMNS[key as keyof SpacePatchInput]
    if (!column) continue // 未知键防御（zod 已剔除未知键，此处双保险）
    sets.push(`${column} = ?`)
    values.push(key === 'archived' ? (value ? 1 : 0) : value)
  }
  if (sets.length > 0) {
    db.prepare(`UPDATE spaces SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
  }
  return getSpace(id)
}

/**
 * 删除空间并把其文档移到默认伞空间（事务，保持 docs.spaceId 不悬空）。
 * 默认空间不可删（路由层 400）；空间不存在返回 false。
 */
export function deleteSpace(id: string): boolean {
  const removeAndMove = db.transaction(() => {
    const info = db.prepare('DELETE FROM spaces WHERE id = ?').run(id)
    if (info.changes === 0) return false
    db.prepare('UPDATE docs SET spaceId = ? WHERE spaceId = ?').run(DEFAULT_SPACE_ID, id)
    return true
  })
  return removeAndMove()
}

/** 上传文档的默认口径（P1-N2「上传落在目标空间」语义）。 */
const DEFAULT_DOC_STATUS = '已就绪'
const DEFAULT_DOC_SOURCE = '本地上传'
const DEFAULT_DOC_OWNER = ''

/**
 * 向目标空间写入一行 docs（spaceId=:id），并同步计数：
 * 目标空间 +1；默认伞空间 count=全库总数，同步 +1（目标即默认时只加一次）。
 * 空间不存在返回 null（404）。
 */
export function uploadDoc(spaceId: string, body: DocUploadBodyInput): Doc | null {
  const exists = db.prepare('SELECT id FROM spaces WHERE id = ?').get(spaceId)
  if (!exists) return null

  const doc: Doc = {
    id: `d-${randomUUID()}`,
    spaceId,
    title: body.title,
    type: body.type,
    category: body.category,
    status: DEFAULT_DOC_STATUS,
    owner: body.owner ?? DEFAULT_DOC_OWNER,
    updatedAt: new Date().toISOString().slice(0, 10),
    source: DEFAULT_DOC_SOURCE,
  }
  const insertAndCount = db.transaction(() => {
    db.prepare(
      'INSERT INTO docs (id, spaceId, title, type, category, status, owner, updatedAt, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      doc.id,
      doc.spaceId,
      doc.title,
      doc.type,
      doc.category,
      doc.status,
      doc.owner,
      doc.updatedAt,
      doc.source,
    )
    db.prepare('UPDATE spaces SET count = count + 1 WHERE id = ?').run(spaceId)
    if (spaceId !== DEFAULT_SPACE_ID) {
      db.prepare('UPDATE spaces SET count = count + 1 WHERE id = ?').run(DEFAULT_SPACE_ID)
    }
  })
  insertAndCount()
  return doc
}
