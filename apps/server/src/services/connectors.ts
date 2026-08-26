import { randomUUID } from 'node:crypto'
import { db } from '../db/client.js'
import type { Connector, SyncTask } from '@kb/shared'
import type { ConnectorPatchInput } from '@kb/shared'

/**
 * 本地上传文档数（口径对齐前端 METRICS.connectedDocs.localUpload=106，副标题「本地上传 106 份」）。
 * 本地上传非连接器卡（不入 connectors 表），作为摘要常量参与 totalDocs 派生。
 */
export const LOCAL_UPLOAD_DOCS = 106

interface ConnectorRow {
  id: string
  name: string
  kind: string
  connected: number
  disabled: number
  docs: number
  lastSyncAt: string | null
  config: string
}

interface SyncTaskRow {
  id: string
  connectorId: string | null
  status: string
  progress: number
  failedCount: number
  at: string
}

/** connectors.connected/disabled 为 SQLite INTEGER，返回 JSON 时映射为布尔。 */
function rowToConnector(row: ConnectorRow): Connector {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as Connector['kind'],
    connected: !!row.connected,
    disabled: !!row.disabled,
    docs: row.docs,
    lastSyncAt: row.lastSyncAt,
  }
}

function rowToTask(row: SyncTaskRow): SyncTask {
  return {
    id: row.id,
    connectorId: row.connectorId,
    status: row.status,
    progress: row.progress,
    failedCount: row.failedCount,
    at: row.at,
  }
}

export interface ConnectorSummary {
  connectedCount: number
  totalDocs: number
  localUpload: number
}

/**
 * GET /connectors：连接器列表 + 副标题派生摘要。
 * - connectedCount：已连接连接器数（seed 2/4：网盘+飞书）。
 * - totalDocs：连接器 docs 合计 + 本地上传 106（seed：862+318+106=1,286）。
 * - localUpload：本地上传文档数常量 106（前端 METRICS 口径）。
 */
export function listConnectors(): { items: Connector[]; summary: ConnectorSummary } {
  const rows = db.prepare('SELECT * FROM connectors ORDER BY rowid').all() as ConnectorRow[]
  const items = rows.map(rowToConnector)
  const connectedCount = items.filter((c) => c.connected).length
  const connectorsDocs = items.reduce((sum, c) => sum + c.docs, 0)
  return {
    items,
    summary: { connectedCount, totalDocs: connectorsDocs + LOCAL_UPLOAD_DOCS, localUpload: LOCAL_UPLOAD_DOCS },
  }
}

export function getConnector(id: string): Connector | null {
  const row = db.prepare('SELECT * FROM connectors WHERE id = ?').get(id) as ConnectorRow | undefined
  return row ? rowToConnector(row) : null
}

/**
 * POST /connectors/:id/connect：把该内置连接器卡置 connected=true（P1-N4——只改目标卡，
 * 绝不新增「第三方知识库」等伪卡）。缺失返回 null（404）。
 */
export function connectConnector(id: string): Connector | null {
  const info = db.prepare('UPDATE connectors SET connected = 1 WHERE id = ?').run(id)
  if (info.changes === 0) return null
  return getConnector(id)
}

export type SyncConnectorResult = { status: 'ok'; task: SyncTask } | { status: 'not-found' }

/**
 * POST /connectors/:id/sync：写一条 sync_task（演示态：已完成 / progress 100 / failedCount 0，
 * at=当前时间 ISO），并更新连接器 lastSyncAt。缺失返回 not-found（404）。
 */
export function syncConnector(id: string): SyncConnectorResult {
  const exists = db.prepare('SELECT id FROM connectors WHERE id = ?').get(id)
  if (!exists) return { status: 'not-found' }

  const task: SyncTask = {
    id: `st-${randomUUID()}`,
    connectorId: id,
    status: '已完成',
    progress: 100,
    failedCount: 0,
    at: new Date().toISOString(),
  }
  const insertAndTouch = db.transaction(() => {
    db.prepare('INSERT INTO sync_tasks (id, connectorId, status, progress, failedCount, at) VALUES (?,?,?,?,?,?)').run(
      task.id,
      task.connectorId,
      task.status,
      task.progress,
      task.failedCount,
      task.at,
    )
    db.prepare('UPDATE connectors SET lastSyncAt = ? WHERE id = ?').run(task.at, id)
  })
  insertAndTouch()
  return { status: 'ok', task }
}

/** ConnectorPatch 键 → connectors 列名的显式白名单：只允许启停用/文档数/上次同步时间。 */
const CONNECTOR_COLUMNS: Record<keyof ConnectorPatchInput, string> = {
  disabled: 'disabled',
  docs: 'docs',
  lastSyncAt: 'lastSyncAt',
}

/** PATCH /connectors/:id：白名单字段更新（disabled/docs/lastSyncAt）；缺失返回 null（404）。 */
export function patchConnector(id: string, patch: ConnectorPatchInput): Connector | null {
  const exists = db.prepare('SELECT id FROM connectors WHERE id = ?').get(id)
  if (!exists) return null

  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const column = CONNECTOR_COLUMNS[key as keyof ConnectorPatchInput]
    if (!column) continue // 未知键防御（zod 已剔除未知键，此处双保险）
    sets.push(`${column} = ?`)
    values.push(key === 'disabled' ? (value ? 1 : 0) : value)
  }
  if (sets.length > 0) {
    db.prepare(`UPDATE connectors SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
  }
  return getConnector(id)
}

/**
 * DELETE /connectors/:id：删除连接器 + 级联删除其 sync_tasks（事务）。
 * 缺失返回 false（404）。
 */
export function deleteConnector(id: string): boolean {
  const removeAndCascade = db.transaction(() => {
    const info = db.prepare('DELETE FROM connectors WHERE id = ?').run(id)
    if (info.changes === 0) return false
    db.prepare('DELETE FROM sync_tasks WHERE connectorId = ?').run(id)
    return true
  })
  return removeAndCascade()
}

/** GET /sync-tasks：近期同步任务，at 倒序（最近在前）。 */
export function listSyncTasks(): SyncTask[] {
  const rows = db.prepare('SELECT * FROM sync_tasks ORDER BY at DESC, id DESC').all() as SyncTaskRow[]
  return rows.map(rowToTask)
}
