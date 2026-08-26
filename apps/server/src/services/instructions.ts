import { randomUUID } from 'node:crypto'
import { db } from '../db/client.js'
import type { Instruction, InstructionStatus, InstructionVersion, InstructionVersionDiff } from '@kb/shared'
import type { InstructionCreateBodyInput, InstructionPatchInput, InstructionRollbackBodyInput } from '@kb/shared'

/** 名称重复时的 409 文案（前端提示改用其他名称）。 */
export const DUP_NAME_MESSAGE = '指令名称已存在'
/** 系统预置指令只读（PATCH/DELETE/发布/回滚 → 400 READONLY）。 */
export const READONLY_MESSAGE = '系统预置指令只读，不可修改'
/** 草稿编辑限制（PATCH 已发布指令 → 409 PUBLISHED_NOT_EDITABLE）。 */
export const PUBLISHED_NOT_EDITABLE_MESSAGE = '仅草稿状态可编辑，请先回滚为草稿'
/** 发布无草稿变更（text 与上一已发布相同 → 409 NO_CHANGES）。 */
export const NO_CHANGES_MESSAGE = '没有待发布的草稿变更'

/** instructions 行（SQLite）。scope 为 JSON 文本、readonly 为 INTEGER。 */
interface InstructionRow {
  id: string
  name: string
  text: string
  scope: string
  status: InstructionStatus
  version: number
  readonly: number
  createdAt: string
}

/** instruction_versions 行（SQLite）。diff 为 JSON 文本。 */
interface VersionRow {
  id: string
  instructionId: string
  version: number
  text: string
  diff: string
  publishedAt: string
}

/** scope JSON 文本 → 字符串数组（坏数据兜底空数组）。 */
function parseScope(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

/** diff JSON 文本 → 摘要对象（坏数据兜底全 0）。 */
function parseDiff(raw: string): InstructionVersionDiff {
  try {
    const v = JSON.parse(raw) as Partial<InstructionVersionDiff>
    return { changed: !!v.changed, added: v.added ?? 0, removed: v.removed ?? 0 }
  } catch {
    return { changed: false, added: 0, removed: 0 }
  }
}

function rowToInstruction(row: InstructionRow): Instruction {
  return {
    id: row.id,
    name: row.name,
    text: row.text,
    scope: parseScope(row.scope),
    status: row.status,
    version: row.version,
    readonly: !!row.readonly,
    createdAt: row.createdAt,
  }
}

function rowToVersion(row: VersionRow): InstructionVersion {
  return {
    id: row.id,
    instructionId: row.instructionId,
    version: row.version,
    text: row.text,
    diff: parseDiff(row.diff),
    publishedAt: row.publishedAt,
  }
}

export function getInstruction(id: string): Instruction | null {
  const row = db.prepare('SELECT * FROM instructions WHERE id = ?').get(id) as InstructionRow | undefined
  return row ? rowToInstruction(row) : null
}

/**
 * GET /instructions：指令列表（seed 口径 7 条：4 系统预置 readonly + 3 自定义，rowid 稳定序）。
 */
export function listInstructions(): Instruction[] {
  const rows = db.prepare('SELECT * FROM instructions ORDER BY rowid').all() as InstructionRow[]
  return rows.map(rowToInstruction)
}

/** 重名检查：存在同名指令 → true。 */
function hasNameConflict(name: string): boolean {
  return !!db.prepare('SELECT id FROM instructions WHERE name = ?').get(name)
}

export type CreateInstructionResult = { status: 'ok'; instruction: Instruction } | { status: 'name-conflict' }

/**
 * POST /instructions：创建自定义草稿（name 必填；默认 text=''、scope=[]、status=草稿、
 * version=1、readonly=false）。同名指令 → name-conflict（409），不落库。
 */
export function createInstruction(body: InstructionCreateBodyInput): CreateInstructionResult {
  if (hasNameConflict(body.name)) return { status: 'name-conflict' }

  const instruction: Instruction = {
    id: `ins-${randomUUID()}`,
    name: body.name,
    text: body.text ?? '',
    scope: body.scope ?? [],
    status: '草稿',
    version: 1,
    readonly: false,
    createdAt: new Date().toISOString(),
  }
  db.prepare(
    'INSERT INTO instructions (id, name, text, scope, status, version, readonly, createdAt) VALUES (?,?,?,?,?,?,?,?)',
  ).run(
    instruction.id,
    instruction.name,
    instruction.text,
    JSON.stringify(instruction.scope),
    instruction.status,
    instruction.version,
    instruction.readonly ? 1 : 0,
    instruction.createdAt,
  )
  return { status: 'ok', instruction }
}

/** InstructionPatch 键 → instructions 列名的显式白名单：只允许 name/text/scope，杜绝动态拼接。 */
const PATCH_COLUMNS: Record<keyof InstructionPatchInput, string> = {
  name: 'name',
  text: 'text',
  scope: 'scope',
}

export type PatchInstructionResult =
  | { status: 'ok'; instruction: Instruction }
  | { status: 'not-found' } // 指令缺失（404）
  | { status: 'readonly' } // 系统预置只读（400 READONLY）
  | { status: 'published' } // 非草稿不可编辑（409 PUBLISHED_NOT_EDITABLE）

/**
 * PATCH /instructions/:id：白名单字段更新（name/text/scope）。
 * 仅草稿可编辑：readonly → readonly、status≠草稿 → published、缺失 → not-found。
 * 草稿编辑不升 version——发布时才生成新版本（见 publishInstruction）。
 */
export function patchInstruction(id: string, patch: InstructionPatchInput): PatchInstructionResult {
  const row = db.prepare('SELECT * FROM instructions WHERE id = ?').get(id) as InstructionRow | undefined
  if (!row) return { status: 'not-found' }
  if (row.readonly) return { status: 'readonly' }
  if (row.status !== '草稿') return { status: 'published' }

  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const column = PATCH_COLUMNS[key as keyof InstructionPatchInput]
    if (!column) continue // 未知键防御（zod 已剔除未知键，此处双保险）
    sets.push(`${column} = ?`)
    values.push(key === 'scope' ? JSON.stringify(value) : value)
  }
  if (sets.length > 0) {
    db.prepare(`UPDATE instructions SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
  }
  return { status: 'ok', instruction: getInstruction(id)! }
}

export type DeleteInstructionResult = { status: 'ok' } | { status: 'not-found' } | { status: 'readonly' }

/**
 * DELETE /instructions/:id：删除自定义指令 + 级联删除其 instruction_versions（事务）。
 * readonly → readonly（400）；缺失 → not-found（404）。
 */
export function deleteInstruction(id: string): DeleteInstructionResult {
  const row = db.prepare('SELECT readonly FROM instructions WHERE id = ?').get(id) as { readonly: number } | undefined
  if (!row) return { status: 'not-found' }
  if (row.readonly) return { status: 'readonly' }

  const removeAndCascade = db.transaction(() => {
    db.prepare('DELETE FROM instructions WHERE id = ?').run(id)
    db.prepare('DELETE FROM instruction_versions WHERE instructionId = ?').run(id)
  })
  removeAndCascade()
  return { status: 'ok' }
}

/**
 * 行级 diff：对上一已发布文本与当前文本做最小行 diff（LCS DP），
 * 统计新增行（added）与删除行（removed）；changed = 有无差异。
 * 首版发布（无上一已发布文本）按空文本计（added = 行数、removed = 0）。
 */
export function diffStats(prevText: string, nextText: string): InstructionVersionDiff {
  const a = prevText ? prevText.split('\n') : []
  const b = nextText ? nextText.split('\n') : []
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  let i = 0
  let j = 0
  let added = 0
  let removed = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1
      removed += 1
    } else {
      j += 1
      added += 1
    }
  }
  removed += n - i
  added += m - j
  return { changed: added > 0 || removed > 0, added, removed }
}

export type PublishInstructionResult =
  | { status: 'ok'; instruction: Instruction }
  | { status: 'not-found' } // 指令缺失（404）
  | { status: 'readonly' } // 系统预置只读（400 READONLY）
  | { status: 'no-changes' } // 无草稿变更（409 NO_CHANGES）

/**
 * POST /instructions/:id/publish：草稿 → 已发布，version+1，写 instruction_versions
 * （text + 与上一已发布文本的行级 diff + publishedAt）。
 * 无草稿变更（status≠草稿 或 text 与上一已发布相同）→ no-changes（409）。
 * 语义对齐前端 Instructions「草稿→发布→版本 diff 高亮」。
 */
export function publishInstruction(id: string): PublishInstructionResult {
  const row = db.prepare('SELECT * FROM instructions WHERE id = ?').get(id) as InstructionRow | undefined
  if (!row) return { status: 'not-found' }
  if (row.readonly) return { status: 'readonly' }

  const lastPublished = db
    .prepare('SELECT text FROM instruction_versions WHERE instructionId = ? ORDER BY version DESC LIMIT 1')
    .get(id) as { text: string } | undefined
  // 非草稿（已发布状态无待发布草稿）或文本与上一已发布相同 → 无变更
  if (row.status !== '草稿' || (lastPublished !== undefined && lastPublished.text === row.text)) {
    return { status: 'no-changes' }
  }

  const nextVersion = row.version + 1
  const publishedAt = new Date().toISOString()
  const diff = diffStats(lastPublished?.text ?? '', row.text)

  const publishAndSnapshot = db.transaction(() => {
    db.prepare('UPDATE instructions SET status = ?, version = ? WHERE id = ?').run('已发布', nextVersion, id)
    db.prepare('INSERT INTO instruction_versions (id, instructionId, version, text, diff, publishedAt) VALUES (?,?,?,?,?,?)').run(
      `iv-${randomUUID()}`,
      id,
      nextVersion,
      row.text,
      JSON.stringify(diff),
      publishedAt,
    )
  })
  publishAndSnapshot()

  return { status: 'ok', instruction: getInstruction(id)! }
}

export type RollbackInstructionResult =
  | { status: 'ok'; instruction: Instruction }
  | { status: 'not-found' } // 指令缺失（404）
  | { status: 'readonly' } // 系统预置只读（400 READONLY）
  | { status: 'version-not-found' } // 目标版本缺失（404）

/**
 * POST /instructions/:id/rollback：从指定版本生成新草稿（body.version 可选 → 最新版本）：
 * status→草稿、text=该版本文本、version 不变（新版本只在下一次发布时产生）。
 * 语义对齐前端「回滚走草稿」：回滚后可在草稿上编辑，再发布才生成新版本。
 */
export function rollbackInstruction(id: string, body: InstructionRollbackBodyInput): RollbackInstructionResult {
  const row = db.prepare('SELECT * FROM instructions WHERE id = ?').get(id) as InstructionRow | undefined
  if (!row) return { status: 'not-found' }
  if (row.readonly) return { status: 'readonly' }

  const targetVersion =
    body.version ??
    ((db.prepare('SELECT MAX(version) v FROM instruction_versions WHERE instructionId = ?').get(id) as { v: number | null }).v ?? undefined)
  if (targetVersion === undefined) return { status: 'version-not-found' }

  const target = db
    .prepare('SELECT * FROM instruction_versions WHERE instructionId = ? AND version = ?')
    .get(id, targetVersion) as VersionRow | undefined
  if (!target) return { status: 'version-not-found' }

  db.prepare('UPDATE instructions SET status = ?, text = ? WHERE id = ?').run('草稿', target.text, id)
  return { status: 'ok', instruction: getInstruction(id)! }
}

/**
 * GET /instructions/:id/versions：版本历史列表（version 倒序，最新在前）。
 * 指令缺失返回 null（404）。
 */
export function listInstructionVersions(id: string): InstructionVersion[] | null {
  const exists = db.prepare('SELECT id FROM instructions WHERE id = ?').get(id)
  if (!exists) return null
  const rows = db
    .prepare('SELECT * FROM instruction_versions WHERE instructionId = ? ORDER BY version DESC')
    .all(id) as VersionRow[]
  return rows.map(rowToVersion)
}
