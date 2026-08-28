import test from 'node:test'
import assert from 'node:assert/strict'
import { API_BASE } from '@kb/shared'

process.env.KB_DB_PATH = ':memory:'
const { buildApp } = await import('../src/app.js')
const { db } = await import('../src/db/client.js')
const { seedIfEmpty } = await import('../src/db/seed.js')

const app = await buildApp()

function resetSeed() {
  db.exec('DELETE FROM org; DELETE FROM plan; DELETE FROM members; DELETE FROM users; DELETE FROM trial_journey; DELETE FROM trial_applications; DELETE FROM spaces; DELETE FROM docs; DELETE FROM connectors; DELETE FROM sync_tasks; DELETE FROM knowledge_map; DELETE FROM knowledge_site; DELETE FROM answer_pool; DELETE FROM assistants; DELETE FROM assistant_versions; DELETE FROM chat_sessions; DELETE FROM chat_messages; DELETE FROM instructions; DELETE FROM instruction_versions; DELETE FROM apps; DELETE FROM app_installs; DELETE FROM integrations; DELETE FROM api_keys; DELETE FROM custom_apis; DELETE FROM webhooks')
  seedIfEmpty()
}

test('GET /integrations → 4 integrations + summary', async () => {
  resetSeed()
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/integrations` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.integrations.length, 4)
  assert.equal(body.data.summary.connected, 2)
  assert.equal(body.data.summary.normal, 2)
  assert.equal(body.data.summary.warning, 0)
  assert.equal(body.data.summary.total, 4)
})

test('PATCH /integrations/:id/config → update config', async () => {
  resetSeed()
  const res = await app.inject({ method: 'PATCH', url: `${API_BASE}/integrations/feishu/config`, payload: { config: '{"scope":"知识库"}' } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().ok, true)
  assert.equal(res.json().data.id, 'feishu')
})

test('PATCH /integrations/:id/config 404 missing', async () => {
  resetSeed()
  const res = await app.inject({ method: 'PATCH', url: `${API_BASE}/integrations/nope/config`, payload: { config: '{}' } })
  assert.equal(res.statusCode, 404)
  assert.equal(res.json().error.code, 'NOT_FOUND')
})

test('POST /integrations/:id/reauth → reauth dingtalk', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/integrations/dingtalk/reauth` })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().ok, true)
  const row = db.prepare('SELECT connected FROM integrations WHERE id = ?').get('dingtalk') as any
  assert.equal(row.connected, 1)
})

test('POST /integrations/:id/reauth 404 missing', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/integrations/nope/reauth` })
  assert.equal(res.statusCode, 404)
})
