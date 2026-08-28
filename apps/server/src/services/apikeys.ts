import { randomUUID } from 'node:crypto'
import { db } from '../db/client.js'

export function listApiKeys() {
  return db.prepare('SELECT * FROM api_keys ORDER BY rowid').all()
}

export function createApiKey(name: string, permissions: string[] = ['read']) {
  const id = randomUUID()
  const maskedKey = 'mk-' + randomUUID().slice(0, 8) + '-' + randomUUID().slice(0, 4)
  db.prepare('INSERT INTO api_keys (id, name, maskedKey, permissions, status, usage, calledThisMonth) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, maskedKey, JSON.stringify(permissions), '生效中', 0, 0)
  return db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id)
}

export function revokeApiKey(id: string) {
  const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as any
  if (!row) return null
  if (row.status === '已吊销') return null // already revoked
  db.prepare('UPDATE api_keys SET status = ? WHERE id = ?').run('已吊销', id)
  return db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id)
}

export function getApiKeyUsage(id: string) {
  const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as any
  if (!row) return null
  return { usage: row.usage, calledThisMonth: row.calledThisMonth }
}

export function listCustomApis() {
  return db.prepare('SELECT * FROM custom_apis ORDER BY rowid').all()
}

export function createCustomApi(body: { name: string; baseUrl: string; method?: string; headersJson?: string; authType?: string }) {
  const id = randomUUID()
  db.prepare('INSERT INTO custom_apis (id, name, baseUrl, method, headersJson, authType, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, body.name, body.baseUrl, body.method || 'GET', body.headersJson || '{}', body.authType || 'bearer', '启用')
  return db.prepare('SELECT * FROM custom_apis WHERE id = ?').get(id)
}

export function patchCustomApi(id: string, body: Record<string, unknown>) {
  const row = db.prepare('SELECT * FROM custom_apis WHERE id = ?').get(id) as any
  if (!row) return null
  const COLUMNS: Record<string, string> = { name: 'name', baseUrl: 'baseUrl', method: 'method', headersJson: 'headersJson', authType: 'authType', status: 'status' }
  const sets: string[] = []
  const vals: any[] = []
  for (const [k, v] of Object.entries(body)) {
    const col = COLUMNS[k]
    if (col) { sets.push(`${col} = ?`); vals.push(typeof v === 'object' ? JSON.stringify(v) : v) }
  }
  if (sets.length === 0) return row
  vals.push(id)
  db.prepare(`UPDATE custom_apis SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return db.prepare('SELECT * FROM custom_apis WHERE id = ?').get(id)
}

export function deleteCustomApi(id: string) {
  const row = db.prepare('SELECT * FROM custom_apis WHERE id = ?').get(id)
  if (!row) return null
  db.prepare('DELETE FROM custom_apis WHERE id = ?').run(id)
  return { ok: true }
}

export function listWebhooks() {
  return db.prepare('SELECT * FROM webhooks ORDER BY rowid').all()
}

export function createWebhook(body: { name: string; url: string; events: string[]; subscribed?: boolean }) {
  const id = randomUUID()
  db.prepare('INSERT INTO webhooks (id, name, url, events, subscribed) VALUES (?, ?, ?, ?, ?)')
    .run(id, body.name, body.url, JSON.stringify(body.events), body.subscribed !== false ? 1 : 0)
  return db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id)
}
