import test from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/app.js'

test('GET /api/v1/health -> ok', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { ok: true, data: { status: 'up' } })
})
test('POST /api/v1/auth/demo-login -> token', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/demo-login' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.ok(body.data.token)
  assert.equal(body.data.user.role, '管理员')
})
test('未知路由 -> 404 信封', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/v1/nope' })
  assert.equal(res.statusCode, 404)
  assert.equal(res.json().ok, false)
})
