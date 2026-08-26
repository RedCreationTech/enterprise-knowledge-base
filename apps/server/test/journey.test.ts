import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { API_BASE } from '@kb/shared'

// 测试隔离：动态 import 前先指向内存库（client.ts 单例读取 KB_DB_PATH）
process.env.KB_DB_PATH = ':memory:'
const { buildApp } = await import('../src/app.js')
const { db } = await import('../src/db/client.js')
const { resetDemoData } = await import('../src/services/journey.js')

const app = await buildApp()

// 每个用例前回到空态起点（demoData=false + seed 口径旅程 + 清空申请记录）
beforeEach(() => {
  db.prepare('DELETE FROM trial_applications').run()
  resetDemoData()
})

test('GET /auth/journey -> 返回旅程行（JSON 数组字段解析为数组）', async () => {
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/auth/journey` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.deepEqual(body.data.installedApps, ['wecom-qa', 'custom-api', 'sso'])
  assert.deepEqual(body.data.uninstalledApps, [])
  assert.deepEqual(body.data.userInstalledApps, [])
  assert.equal(body.data.activated, false)
  assert.equal(body.data.invitesSent, false)
  assert.equal(body.data.step, 0)
  assert.equal(body.data.configProgress, 0)
})

test('PATCH /auth/journey -> 更新字段并持久化', async () => {
  const patch = {
    activated: true,
    step: 3,
    installedApps: ['wecom-qa', 'dingtalk-bot'],
    uninstalledApps: ['feishu-qa'],
    userInstalledApps: ['daily-report'],
    invitesSent: true,
    configProgress: 80,
  }
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/auth/journey`,
    payload: patch,
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.activated, true)
  assert.equal(body.data.step, 3)
  assert.deepEqual(body.data.installedApps, ['wecom-qa', 'dingtalk-bot'])
  assert.deepEqual(body.data.uninstalledApps, ['feishu-qa'])
  assert.deepEqual(body.data.userInstalledApps, ['daily-report'])
  assert.equal(body.data.invitesSent, true)
  assert.equal(body.data.configProgress, 80)

  // 持久化：GET 应返回同一状态
  const again = await app.inject({ method: 'GET', url: `${API_BASE}/auth/journey` })
  assert.deepEqual(again.json().data, body.data)
})

test('PATCH /auth/journey 非法 body -> 400', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `${API_BASE}/auth/journey`,
    payload: { step: 'not-a-number' },
  })
  assert.equal(res.statusCode, 400)
  const body = res.json()
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'BAD_REQUEST')
})

test('GET/PATCH /auth/journey 行缺失 -> 409', async () => {
  db.prepare('DELETE FROM trial_journey').run()
  try {
    const getRes = await app.inject({ method: 'GET', url: `${API_BASE}/auth/journey` })
    assert.equal(getRes.statusCode, 409)
    assert.equal(getRes.json().error.code, 'CONFLICT')

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `${API_BASE}/auth/journey`,
      payload: { step: 2 },
    })
    assert.equal(patchRes.statusCode, 409)
    assert.equal(patchRes.json().error.code, 'CONFLICT')
  } finally {
    // 恢复 seed 行，保持后续用例隔离
    db.prepare(
      `INSERT INTO trial_journey (id, activated, step, installedApps, uninstalledApps, userInstalledApps, invitesSent, configProgress) VALUES (1, 0, 0, '["wecom-qa","custom-api","sso"]', '[]', '[]', 0, 0)`,
    ).run()
  }
})

test('POST /auth/trial/apply -> 落库申请记录', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/auth/trial/apply`,
    payload: { companyName: '示例科技有限公司', contact: '13800138000', agreeToTerms: true },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(typeof body.data.id, 'number')

  const row = db.prepare('SELECT * FROM trial_applications WHERE id = ?').get(body.data.id) as {
    companyName: string
    contact: string
    agreeToTerms: number
  }
  assert.equal(row.companyName, '示例科技有限公司')
  assert.equal(row.contact, '13800138000')
  assert.equal(row.agreeToTerms, 1)
})

test('POST /auth/trial/apply 非法 body -> 400', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/auth/trial/apply`,
    payload: { companyName: '示例科技有限公司' }, // 缺 contact / agreeToTerms
  })
  assert.equal(res.statusCode, 400)
  const body = res.json()
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'BAD_REQUEST')
})

test('POST /auth/otp/send -> 演示态返回成功', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/auth/otp/send`,
    payload: { channel: 'phone', target: '13800138000' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.sent, true)
})

test('POST /auth/otp/send 非法 body -> 400', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/auth/otp/send`,
    payload: { channel: 'phone' }, // 缺 target
  })
  assert.equal(res.statusCode, 400)
  const body = res.json()
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'BAD_REQUEST')
})

test('POST /auth/otp/verify 固定码 123456 -> ok', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/auth/otp/verify`,
    payload: { channel: 'phone', target: '13800138000', code: '123456' },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.verified, true)
})

test('POST /auth/otp/verify 错误码 -> 400 INVALID_CODE', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `${API_BASE}/auth/otp/verify`,
    payload: { channel: 'phone', target: '13800138000', code: '000000' },
  })
  assert.equal(res.statusCode, 400)
  const body = res.json()
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'INVALID_CODE')
})

test('POST /demo-data -> demoData=true 且旅程置为成熟态', async () => {
  const res = await app.inject({ method: 'POST', url: `${API_BASE}/demo-data` })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { ok: true, data: { demoData: true } })

  const org = db.prepare('SELECT demoData FROM org WHERE id = ?').get('org-1') as { demoData: number }
  assert.equal(org.demoData, 1)

  const journey = (await app.inject({ method: 'GET', url: `${API_BASE}/auth/journey` })).json().data
  assert.equal(journey.activated, true)
  assert.equal(journey.step, 5)
  assert.equal(journey.configProgress, 100)
  assert.equal(journey.invitesSent, true)
})

test('POST /demo-data/reset -> 幂等（两次均 ok 且状态一致）', async () => {
  const first = await app.inject({ method: 'POST', url: `${API_BASE}/demo-data/reset` })
  assert.equal(first.statusCode, 200)
  assert.deepEqual(first.json(), { ok: true, data: { demoData: false } })

  const journey1 = (await app.inject({ method: 'GET', url: `${API_BASE}/auth/journey` })).json().data
  const org1 = db.prepare('SELECT demoData FROM org WHERE id = ?').get('org-1') as { demoData: number }

  const second = await app.inject({ method: 'POST', url: `${API_BASE}/demo-data/reset` })
  assert.equal(second.statusCode, 200)
  assert.deepEqual(second.json(), { ok: true, data: { demoData: false } })

  const journey2 = (await app.inject({ method: 'GET', url: `${API_BASE}/auth/journey` })).json().data
  const org2 = db.prepare('SELECT demoData FROM org WHERE id = ?').get('org-1') as { demoData: number }

  assert.equal(org1.demoData, 0)
  assert.deepEqual(journey2, journey1)
  assert.equal(org2.demoData, 0)
  assert.equal(journey2.activated, false)
  assert.equal(journey2.step, 0)
  assert.deepEqual(journey2.installedApps, ['wecom-qa', 'custom-api', 'sso'])
})

test('POST /demo-data/reset -> 清空 trial_applications（seed 为空表）', async () => {
  // 先写入一条申请记录
  await app.inject({
    method: 'POST',
    url: `${API_BASE}/auth/trial/apply`,
    payload: { companyName: '示例科技有限公司', contact: '13800138000', agreeToTerms: true },
  })
  const before = (db.prepare('SELECT COUNT(*) c FROM trial_applications').get() as { c: number }).c
  assert.equal(before, 1)

  const res = await app.inject({ method: 'POST', url: `${API_BASE}/demo-data/reset` })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { ok: true, data: { demoData: false } })

  const after = (db.prepare('SELECT COUNT(*) c FROM trial_applications').get() as { c: number }).c
  assert.equal(after, 0)
})
