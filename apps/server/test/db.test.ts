import test from 'node:test'
import assert from 'node:assert/strict'
import { db } from '../src/db/client.js'
import { createSchema } from '../src/db/schema.js'
import { seedIfEmpty } from '../src/db/seed.js'

test('createSchema 幂等 + seed 一次', () => {
  createSchema(); createSchema()
  seedIfEmpty()
  const org = db.prepare('SELECT * FROM org LIMIT 1').get()
  assert.ok(org)
  assert.equal((db.prepare('SELECT COUNT(*) c FROM members').get() as { c: number }).c, 6)
})
