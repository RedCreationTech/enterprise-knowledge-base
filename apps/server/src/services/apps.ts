import { randomUUID } from 'node:crypto'
import { db } from '../db/client.js'

const appCols = ['id','name','desc','category','logo','status','permissions','scenes','previewUrl'] as const

export function listApps() {
  const apps = db.prepare(`SELECT * FROM apps ORDER BY rowid`).all()
  const installs = db.prepare(`SELECT appId FROM app_installs WHERE uninstalledAt IS NULL`).all() as { appId: string }[]
  const installedSet = new Set(installs.map(i => i.appId))
  return apps.map((a: any) => ({
    ...a,
    installStatus: installedSet.has(a.id) ? '已安装' : a.status,
  }))
}

export function installApp(appId: string) {
  const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(appId) as any
  if (!app) return null
  const existing = db.prepare('SELECT * FROM app_installs WHERE appId = ? AND uninstalledAt IS NULL').get(appId)
  if (existing) return null // already installed
  const now = new Date().toISOString()
  db.prepare('INSERT INTO app_installs (id, appId, installedAt, installedBy) VALUES (?, ?, ?, ?)').run(randomUUID(), appId, now, 'u-1')
  return { ...app, installStatus: '已安装' }
}

export function uninstallApp(appId: string) {
  const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(appId)
  if (!app) return null
  const install = db.prepare('SELECT * FROM app_installs WHERE appId = ? AND uninstalledAt IS NULL').get(appId) as any
  if (!install) return null // not installed
  const now = new Date().toISOString()
  db.prepare('UPDATE app_installs SET uninstalledAt = ? WHERE id = ?').run(now, install.id)
  return { ok: true }
}
