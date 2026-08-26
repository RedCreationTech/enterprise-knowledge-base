import test from 'node:test'
import assert from 'node:assert/strict'
import { API_BASE } from '@kb/shared'
import { statusCodeToErrorCode } from '../src/middleware/error-handler.js'

// 测试隔离：动态 import 前先指向内存库（client.ts 单例读取 KB_DB_PATH）
process.env.KB_DB_PATH = ':memory:'
const { buildApp } = await import('../src/app.js')

test('GET /api/v1/health -> ok', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/health` })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { ok: true, data: { status: 'up' } })
})

test('POST /api/v1/auth/demo-login -> token', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/auth/demo-login` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.ok(body.data.token)
  assert.equal(body.data.user.role, '管理员')
})

test('未知路由 -> 404 信封', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/nope` })
  assert.equal(res.statusCode, 404)
  assert.equal(res.json().ok, false)
})

test('错误信封状态码映射', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/nope` })
  assert.equal(res.statusCode, 404)
  assert.equal(res.json().error.code, 'NOT_FOUND')
})

test('状态码→错误码映射', () => {
  assert.equal(statusCodeToErrorCode(400), 'BAD_REQUEST')
  assert.equal(statusCodeToErrorCode(401), 'UNAUTHORIZED')
  assert.equal(statusCodeToErrorCode(403), 'FORBIDDEN')
  assert.equal(statusCodeToErrorCode(404), 'NOT_FOUND')
  assert.equal(statusCodeToErrorCode(409), 'CONFLICT')
  assert.equal(statusCodeToErrorCode(500), 'INTERNAL')
  assert.equal(statusCodeToErrorCode(undefined), 'INTERNAL')
})
