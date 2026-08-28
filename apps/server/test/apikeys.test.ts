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

test('GET /api-keys → 2 keys (1 active + 1 revoked)', async () => {
  resetSeed()
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/api-keys` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.length, 2)
})

test('POST /api-keys → create new key', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/api-keys`, payload: { name: '新 Key', permissions: ['read', 'write'] } })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.name, '新 Key')
  assert.equal(body.data.status, '生效中')
  assert.ok(body.data.maskedKey.startsWith('mk-'))
})

test('POST /api-keys/:id/revoke → revoke active key', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/api-keys/key-prod/revoke` })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().data.status, '已吊销')
})

test('POST /api-keys/:id/revoke 409 already revoked', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/api-keys/key-test/revoke` })
  assert.equal(res.statusCode, 409)
  assert.equal(res.json().error.code, 'KEY_ALREADY_REVOKED')
})

test('GET /api-keys/:id/usage → usage stats', async () => {
  resetSeed()
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/api-keys/key-prod/usage` })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().data.usage, 0)
  assert.equal(res.json().data.calledThisMonth, 0)
})

test('GET /api-keys/:id/usage 404 missing', async () => {
  resetSeed()
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/api-keys/nope/usage` })
  assert.equal(res.statusCode, 404)
})

test('POST /api-keys 400 empty name', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/api-keys`, payload: {} })
  assert.equal(res.statusCode, 400)
})

// Custom APIs
test('GET /custom-apis → list', async () => {
  resetSeed()
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/custom-apis` })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().ok, true)
})

test('POST /custom-apis → create', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/custom-apis`, payload: { name: '测试 API', baseUrl: 'https://example.com/api' } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().data.name, '测试 API')
  assert.equal(res.json().data.status, '启用')
})

test('POST /custom-apis 400 missing fields', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/custom-apis`, payload: { name: 'No URL' } })
  assert.equal(res.statusCode, 400)
})

// Webhooks
test('GET /webhooks → list', async () => {
  resetSeed()
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/webhooks` })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().data.length, 1)
})

test('POST /webhooks → subscribe', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/webhooks`, payload: { name: '新 Webhook', url: 'https://example.com/hook', events: ['test.event'] } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().data.name, '新 Webhook')
  assert.equal(res.json().data.subscribed, 1)
})

test('POST /webhooks 400 missing fields', async () => {
  resetSeed()
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/webhooks`, payload: { name: 'No URL' } })
  assert.equal(res.statusCode, 400)
})
