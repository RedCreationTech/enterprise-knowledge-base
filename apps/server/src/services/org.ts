import { randomUUID } from 'node:crypto'
import { db } from '../db/client.js'
import type { Org, Member, Plan } from '@kb/shared'
import type { OrgPatchInput, MemberCreateBodyInput, MemberPatchInput } from '@kb/shared'

/** 席位闸门满员时的 409 文案（前端提示升级套餐或减少成员）。 */
export const SEAT_LIMIT_MESSAGE = '试用席位已满，请升级套餐或减少成员'

interface OrgRow { id: string; name: string; industry: string; contact: string; demoData: number }
interface MemberRow { id: string; name: string; email: string; role: string; dept: string; status: string; joinedAt: string }
interface PlanRow { id: string; tier: string; storageUsedGB: number; storageTotalGB: number; seats: number; seatsUsed: number; validUntil: string }

/** org.demoData 为 SQLite INTEGER，返回 JSON 时映射为布尔。 */
function rowToOrg(row: OrgRow): Org {
  return { id: row.id, name: row.name, industry: row.industry, contact: row.contact, demoData: !!row.demoData }
}

function rowToMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Member['role'],
    dept: row.dept,
    status: row.status as Member['status'],
    joinedAt: row.joinedAt,
  }
}

function rowToPlan(row: PlanRow): Plan {
  return {
    tier: row.tier,
    storageUsedGB: row.storageUsedGB,
    storageTotalGB: row.storageTotalGB,
    seats: row.seats,
    seatsUsed: row.seatsUsed,
    validUntil: row.validUntil,
  }
}

export function getOrg(): Org | null {
  const row = db.prepare('SELECT * FROM org WHERE id = ?').get('org-1') as OrgRow | undefined
  return row ? rowToOrg(row) : null
}

/** OrgPatch 键 → org 列名的显式白名单：SQL 列名只允许来自此固定映射，杜绝动态拼接。 */
const ORG_COLUMNS: Record<keyof OrgPatchInput, string> = {
  name: 'name',
  industry: 'industry',
  contact: 'contact',
}

export function patchOrg(patch: OrgPatchInput): Org | null {
  const exists = db.prepare('SELECT id FROM org WHERE id = ?').get('org-1')
  if (!exists) return null

  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const column = ORG_COLUMNS[key as keyof OrgPatchInput]
    if (!column) continue // 未知键防御（zod 已剔除未知键，此处双保险）
    sets.push(`${column} = ?`)
    values.push(value)
  }
  if (sets.length > 0) {
    db.prepare(`UPDATE org SET ${sets.join(', ')} WHERE id = 'org-1'`).run(...values)
  }
  return getOrg()
}

export function listMembers(): Member[] {
  const rows = db.prepare('SELECT * FROM members ORDER BY joinedAt, id').all() as MemberRow[]
  return rows.map(rowToMember)
}

export function getMember(id: string): Member | null {
  const row = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as MemberRow | undefined
  return row ? rowToMember(row) : null
}

export type CreateMemberResult =
  | { status: 'ok'; member: Member }
  | { status: 'seat-limit' } // seatsUsed >= seats
  | { status: 'no-plan' } // plan 行缺失（不应发生）

const DEFAULT_MEMBER_ROLE: Member['role'] = '普通成员'
const DEFAULT_MEMBER_DEPT = ''

/**
 * 创建成员（默认状态 待激活）并占用一个席位。
 * 席位闸门：seatsUsed >= seats 时拒绝，不落库、不加席位。
 * 插入 + 席位 +1 包在事务内，保证一致性。
 */
export function createMember(body: MemberCreateBodyInput): CreateMemberResult {
  const plan = db.prepare('SELECT seats, seatsUsed FROM plan WHERE id = ?').get('plan-1') as
    | { seats: number; seatsUsed: number }
    | undefined
  if (!plan) return { status: 'no-plan' }
  if (plan.seatsUsed >= plan.seats) return { status: 'seat-limit' }

  const id = `m-${randomUUID()}`
  const member: Member = {
    id,
    name: body.name,
    email: body.email,
    role: body.role ?? DEFAULT_MEMBER_ROLE,
    dept: body.dept ?? DEFAULT_MEMBER_DEPT,
    status: '待激活',
    joinedAt: new Date().toISOString().slice(0, 10),
  }
  const insertAndIncrement = db.transaction(() => {
    db.prepare('INSERT INTO members (id, name, email, role, dept, status, joinedAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      member.id,
      member.name,
      member.email,
      member.role,
      member.dept,
      member.status,
      member.joinedAt,
    )
    db.prepare('UPDATE plan SET seatsUsed = seatsUsed + 1 WHERE id = ?').run('plan-1')
  })
  insertAndIncrement()
  return { status: 'ok', member }
}

/** MemberPatch 键 → members 列名的显式白名单（同上，杜绝动态拼接）。 */
const MEMBER_COLUMNS: Record<keyof MemberPatchInput, string> = {
  role: 'role',
  status: 'status',
  dept: 'dept',
  email: 'email',
}

export function patchMember(id: string, patch: MemberPatchInput): Member | null {
  const exists = db.prepare('SELECT id FROM members WHERE id = ?').get(id)
  if (!exists) return null

  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const column = MEMBER_COLUMNS[key as keyof MemberPatchInput]
    if (!column) continue
    sets.push(`${column} = ?`)
    values.push(value)
  }
  if (sets.length > 0) {
    db.prepare(`UPDATE members SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
  }
  return getMember(id)
}

/** 删除成员并释放一个席位（事务）；成员不存在返回 false。 */
export function deleteMember(id: string): boolean {
  const removeAndDecrement = db.transaction(() => {
    const info = db.prepare('DELETE FROM members WHERE id = ?').run(id)
    if (info.changes === 0) return false
    db.prepare('UPDATE plan SET seatsUsed = MAX(0, seatsUsed - 1) WHERE id = ?').run('plan-1')
    return true
  })
  return removeAndDecrement()
}

export function getPlan(): Plan | null {
  const row = db.prepare('SELECT * FROM plan WHERE id = ?').get('plan-1') as PlanRow | undefined
  return row ? rowToPlan(row) : null
}
