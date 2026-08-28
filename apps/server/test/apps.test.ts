import test from 'node:test'
import assert from 'node:assert/strict'
import { API_BASE } from '@kb/shared'

const BASE = API_BASE

process.env.KB_DB_PATH = ':memory:'
const { buildApp } = await import('../src/app.js')
const { db } = await import('../src/db/client.js')
const { seedIfEmpty } = await import('../src/db/seed.js')

const app = await buildApp()

/** 回到 seed 基线：全表清空后重新播种（沿用 org.test.ts resetSeed 规则，追加 apps/app_installs） */
function resetSeed() {
  db.exec('DELETE FROM org; DELETE FROM plan; DELETE FROM members; DELETE FROM users; DELETE FROM trial_journey; DELETE FROM trial_applications; DELETE FROM spaces; DELETE FROM docs; DELETE FROM connectors; DELETE FROM sync_tasks; DELETE FROM knowledge_map; DELETE FROM knowledge_site; DELETE FROM answer_pool; DELETE FROM assistants; DELETE FROM assistant_versions; DELETE FROM chat_sessions; DELETE FROM chat_messages; DELETE FROM instructions; DELETE FROM instruction_versions; DELETE FROM apps; DELETE FROM app_installs')
  seedIfEmpty()
}

test('GET /apps → 8 apps, 3 installed', async () => {
  resetSeed()
  const res = await app.inject({ method: 'GET', url: `${BASE}/apps` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.length, 8)
  const installed = body.data.filter((a: any) => a.installStatus === '已安装')
  assert.equal(installed.length, 3)
})

test('POST /apps/:id/install → install feishu-qa', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${BASE}/apps/feishu-qa/install` })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().ok, true)
  assert.equal(res.json().data.installStatus, '已安装')
})

test('POST /apps/:id/install 409 already installed', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${BASE}/apps/wecom-qa/install` })
  assert.equal(res.statusCode, 409)
  assert.equal(res.json().error.code, 'APP_ALREADY_INSTALLED')
})

test('POST /apps/:id/uninstall → uninstall wecom-qa', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${BASE}/apps/wecom-qa/uninstall` })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().ok, true)
})

test('POST /apps/:id/uninstall 409 not installed', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${BASE}/apps/feishu-qa/uninstall` })
  assert.equal(res.statusCode, 409)
  assert.equal(res.json().error.code, 'APP_NOT_INSTALLED')
})

test('POST /apps/:id/install 404 missing', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${BASE}/apps/nope/install` })
  assert.equal(res.statusCode, 404)
})
