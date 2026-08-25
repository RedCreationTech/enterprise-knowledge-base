import test from 'node:test'
import assert from 'node:assert/strict'
import { okSchema, parseOk, parseErr } from '../src/schemas.js'

test('parseOk 解析 { ok:true, data }', () => {
  const parsed = parseOk({ ok: true, data: { status: 'up' } }, okSchema)
  assert.equal(parsed.status, 'up')
})
test('parseOk 对畸形 data 抛错', () => {
  assert.throws(() => parseOk({ ok: true, data: {} }, okSchema))
})
test('parseErr 解析 { ok:false, error }', () => {
  const e = parseErr({ ok: false, error: { code: 'NOT_FOUND', message: 'x' } })
  assert.equal(e.code, 'NOT_FOUND')
})
