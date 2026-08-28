import { randomUUID } from 'node:crypto'
import { db } from '../db/client.js'

export function listIntegrations() {
  return db.prepare('SELECT * FROM integrations ORDER BY rowid').all()
}

export function getIntegrationSummary() {
  const rows = db.prepare('SELECT connected, health FROM integrations').all() as { connected: number; health: string }[]
  const connected = rows.filter(r => r.connected).length
  const normal = rows.filter(r => r.connected && r.health === '健康').length
  const warning = rows.filter(r => r.connected && r.health !== '健康' && r.health !== '未连接').length
  return { connected, normal, warning, total: rows.length }
}

export function patchIntegrationConfig(id: string, body: Record<string, unknown>) {
  const row = db.prepare('SELECT * FROM integrations WHERE id = ?').get(id) as any
  if (!row) return null
  const COLUMNS: Record<string, string> = { config: 'config', health: 'health', healthNote: 'healthNote' }
  const sets: string[] = []
  const vals: any[] = []
  for (const [k, v] of Object.entries(body)) {
    const col = COLUMNS[k]
    if (col) { sets.push(`${col} = ?`); vals.push(typeof v === 'object' ? JSON.stringify(v) : v) }
  }
  if (sets.length === 0) return row
  vals.push(id)
  db.prepare(`UPDATE integrations SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return db.prepare('SELECT * FROM integrations WHERE id = ?').get(id)
}

export function reauthIntegration(id: string) {
  const row = db.prepare('SELECT * FROM integrations WHERE id = ?').get(id)
  if (!row) return null
  const now = new Date().toISOString()
  db.prepare('UPDATE integrations SET lastSyncAt = ?, disabled = 0, connected = 1 WHERE id = ?').run(now, id)
  return db.prepare('SELECT * FROM integrations WHERE id = ?').get(id)
}
