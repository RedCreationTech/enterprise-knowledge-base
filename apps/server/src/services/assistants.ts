import { randomUUID } from 'node:crypto'
import { db } from '../db/client.js'
import type { Assistant } from '@kb/shared'
import type { AssistantCreateBodyInput, AssistantPatchInput } from '@kb/shared'

/** 名称重复时的 409 文案（前端提示改用其他名称）。 */
export const DUP_NAME_MESSAGE = '助手名称已存在'

interface AssistantRow {
  id: string
  name: string
  icon: string
  desc: string
  scope: string
  enabled: number
  draft: string
  version: number
}

/** assistants.enabled 为 SQLite INTEGER，返回 JSON 时映射为布尔。 */
function rowToAssistant(row: AssistantRow): Assistant {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    desc: row.desc,
    scope: row.scope,
    enabled: !!row.enabled,
    draft: row.draft,
    version: row.version,
  }
}

/** 新建草稿默认口径（镜像前端创建助手：icon ✨、空 desc/scope、enabled=true、version=1）。 */
const DEFAULT_ICON = '✨'
const DEFAULT_DESC = ''
const DEFAULT_SCOPE = ''

/**
 * GET /assistants：助手列表（seed 口径 2 个：企业知识助手/销售问答助手，rowid 稳定序）。
 */
export function listAssistants(): Assistant[] {
  const rows = db.prepare('SELECT * FROM assistants ORDER BY rowid').all() as AssistantRow[]
  return rows.map(rowToAssistant)
}

export function getAssistant(id: string): Assistant | null {
  const row = db.prepare('SELECT * FROM assistants WHERE id = ?').get(id) as AssistantRow | undefined
  return row ? rowToAssistant(row) : null
}

/** 重名检查：存在同名助手（排除自身 id）→ true。 */
function hasNameConflict(name: string, excludeId?: string): boolean {
  const row = excludeId
    ? (db.prepare('SELECT id FROM assistants WHERE name = ? AND id != ?').get(name, excludeId) as { id: string } | undefined)
    : (db.prepare('SELECT id FROM assistants WHERE name = ?').get(name) as { id: string } | undefined)
  return !!row
}

export type CreateAssistantResult = { status: 'ok'; assistant: Assistant } | { status: 'name-conflict' }

/**
 * POST /assistants：创建草稿（name 必填；icon/desc/scope 走默认；enabled=true、draft=''、version=1）。
 * 同名助手 → name-conflict（409），不落库。
 */
export function createAssistant(body: AssistantCreateBodyInput): CreateAssistantResult {
  if (hasNameConflict(body.name)) return { status: 'name-conflict' }

  const assistant: Assistant = {
    id: `asst-${randomUUID()}`,
    name: body.name,
    icon: body.icon ?? DEFAULT_ICON,
    desc: body.desc ?? DEFAULT_DESC,
    scope: body.scope ?? DEFAULT_SCOPE,
    enabled: true,
    draft: '',
    version: 1,
  }
  db.prepare(
    'INSERT INTO assistants (id, name, icon, desc, scope, enabled, draft, version) VALUES (?,?,?,?,?,?,?,?)',
  ).run(assistant.id, assistant.name, assistant.icon, assistant.desc, assistant.scope, assistant.enabled ? 1 : 0, assistant.draft, assistant.version)
  return { status: 'ok', assistant }
}

/** AssistantPatch 键 → assistants 列名的显式白名单：只允许 live 字段与草稿，杜绝动态拼接。 */
const ASSISTANT_COLUMNS: Record<keyof AssistantPatchInput, string> = {
  name: 'name',
  icon: 'icon',
  desc: 'desc',
  scope: 'scope',
  enabled: 'enabled',
  draft: 'draft',
}

/**
 * PATCH /assistants/:id：白名单字段更新（name/icon/desc/scope/enabled/draft）；缺失返回 null（404）。
 * 草稿编辑（写 draft 或改 live 字段）都不升 version——发布时才生成新版本（见 publishAssistant）。
 */
export function patchAssistant(id: string, patch: AssistantPatchInput): Assistant | null {
  const exists = db.prepare('SELECT id FROM assistants WHERE id = ?').get(id)
  if (!exists) return null

  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const column = ASSISTANT_COLUMNS[key as keyof AssistantPatchInput]
    if (!column) continue // 未知键防御（zod 已剔除未知键，此处双保险）
    sets.push(`${column} = ?`)
    values.push(key === 'enabled' ? (value ? 1 : 0) : value)
  }
  if (sets.length > 0) {
    db.prepare(`UPDATE assistants SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
  }
  return getAssistant(id)
}

/**
 * DELETE /assistants/:id：删除助手 + 级联删除其 assistant_versions（事务）。
 * 缺失返回 false（404）。
 */
export function deleteAssistant(id: string): boolean {
  const removeAndCascade = db.transaction(() => {
    const info = db.prepare('DELETE FROM assistants WHERE id = ?').run(id)
    if (info.changes === 0) return false
    db.prepare('DELETE FROM assistant_versions WHERE assistantId = ?').run(id)
    return true
  })
  return removeAndCascade()
}

/**
 * 发布配置（draft 的 JSON 形态，与版本行 config 同构）：
 * 字段缺省时回落到当前 live 值（draft 允许部分配置）。
 */
interface DraftConfig {
  name?: string
  icon?: string
  desc?: string
  scope?: string
  enabled?: boolean
}

export type PublishAssistantResult =
  | { status: 'ok'; assistant: Assistant }
  | { status: 'not-found' } // 助手缺失（404）
  | { status: 'no-draft' } // draft 为空：无可发布草稿（409 NO_DRAFT）
  | { status: 'bad-draft' } // draft 非空但非法 JSON（400）

/**
 * POST /assistants/:id/publish：draft 非空 → 将草稿配置应用到 live 字段、version+1、
 * 写入 assistant_versions（version/config/publishedAt）、清空 draft；返回更新后的助手。
 * 语义对齐前端 AiAssistant「保存草稿→发布」：草稿期任意编辑不产生版本，发布时才生成新版本。
 */
export function publishAssistant(id: string): PublishAssistantResult {
  const row = db.prepare('SELECT * FROM assistants WHERE id = ?').get(id) as AssistantRow | undefined
  if (!row) return { status: 'not-found' }
  if (!row.draft || row.draft.trim() === '') return { status: 'no-draft' }

  let config: DraftConfig
  try {
    config = JSON.parse(row.draft) as DraftConfig
  } catch {
    return { status: 'bad-draft' }
  }

  // 草稿配置 → live 字段（缺省回落当前值），并保存完整发布配置快照
  const live: DraftConfig = {
    name: config.name ?? row.name,
    icon: config.icon ?? row.icon,
    desc: config.desc ?? row.desc,
    scope: config.scope ?? row.scope,
    enabled: config.enabled ?? !!row.enabled,
  }
  const nextVersion = row.version + 1
  const publishedAt = new Date().toISOString()

  const publishAndSnapshot = db.transaction(() => {
    db.prepare('UPDATE assistants SET name = ?, icon = ?, desc = ?, scope = ?, enabled = ?, draft = ?, version = ? WHERE id = ?').run(
      live.name,
      live.icon,
      live.desc,
      live.scope,
      live.enabled ? 1 : 0,
      '',
      nextVersion,
      id,
    )
    db.prepare('INSERT INTO assistant_versions (id, assistantId, version, config, publishedAt) VALUES (?,?,?,?,?)').run(
      `av-${randomUUID()}`,
      id,
      nextVersion,
      JSON.stringify(live),
      publishedAt,
    )
  })
  publishAndSnapshot()

  return { status: 'ok', assistant: getAssistant(id)! }
}
