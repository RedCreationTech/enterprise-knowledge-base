import test from 'node:test'
import assert from 'node:assert/strict'

// 测试隔离：动态 import 前先指向内存库（每进程独立、无残留文件）
process.env.KB_DB_PATH = ':memory:'
const { db } = await import('../src/db/client.js')
const { createSchema } = await import('../src/db/schema.js')
const { seedIfEmpty } = await import('../src/db/seed.js')

test('createSchema 幂等 + seed 一次', () => {
  createSchema(); createSchema()
  seedIfEmpty()
  const org = db.prepare('SELECT * FROM org LIMIT 1').get()
  assert.ok(org)
  assert.equal((db.prepare('SELECT COUNT(*) c FROM members').get() as { c: number }).c, 6)
})

test('seed 口径对齐前端 mock（org.industry / demoData / 成员角色部门）', () => {
  createSchema()
  seedIfEmpty()
  const org = db.prepare('SELECT * FROM org WHERE id = ?').get('org-1') as {
    industry: string
    demoData: number
  }
  assert.equal(org.industry, '软件与信息技术服务')
  assert.equal(org.demoData, 0)

  const byId = (id: string) =>
    db.prepare('SELECT * FROM members WHERE id = ?').get(id) as {
      role: string
      dept: string
      status: string
      email: string
    }
  assert.deepEqual(
    ['m-zw', 'm-ln', 'm-wq', 'm-zm', 'm-cc', 'm-ly'].map((id) => byId(id).role),
    ['管理员', '知识管理员', '空间管理员', '文档审核员', '助手运营员', '普通成员'],
  )
  assert.equal(byId('m-ln').dept, '知识运营')
  assert.equal(byId('m-ly').dept, '售前团队')
  assert.equal(byId('m-cc').status, '待激活')
  assert.equal(byId('m-ly').status, '待激活')
  assert.equal(byId('m-ly').email, 'liuyang@example.com')

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get('u-1') as {
    email: string
    passwordHash: string | null
  }
  assert.equal(user.email, 'zhangwei@example.com')
  assert.equal(user.passwordHash, null)
})
