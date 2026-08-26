import { db } from '../db/client.js'
import type { Journey } from '@kb/shared'
import type { JourneyPatchInput, TrialApplyBodyInput } from '@kb/shared'

/** 演示固定验证码（前端倒计时 + 校验用） */
export const DEMO_OTP_CODE = '123456'

/** seed 口径的默认已安装应用（企业微信 / 自定义 API / SSO，与前端 DEFAULT_INSTALLED_APPS 同源） */
const DEFAULT_INSTALLED_APPS = ['wecom-qa', 'custom-api', 'sso']

/** 演示数据（成熟运营态）下已安装 / 用户主动安装的应用 */
const MATURE_INSTALLED_APPS = [...DEFAULT_INSTALLED_APPS, 'feishu-qa', 'dingtalk-bot', 'daily-report']
const MATURE_USER_INSTALLED_APPS = ['daily-report', 'webchat']

interface JourneyRow {
  id: number
  activated: number
  step: number
  installedApps: string | null
  uninstalledApps: string | null
  userInstalledApps: string | null
  invitesSent: number
  configProgress: number
}

function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw) as unknown
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function rowToJourney(row: JourneyRow): Journey {
  return {
    activated: !!row.activated,
    step: row.step,
    installedApps: parseJsonStringArray(row.installedApps),
    uninstalledApps: parseJsonStringArray(row.uninstalledApps),
    userInstalledApps: parseJsonStringArray(row.userInstalledApps),
    invitesSent: !!row.invitesSent,
    configProgress: row.configProgress,
  }
}

const BOOL_COLS = new Set(['activated', 'invitesSent'])
const ARRAY_COLS = new Set(['installedApps', 'uninstalledApps', 'userInstalledApps'])

export function getJourney(): Journey | null {
  const row = db.prepare('SELECT * FROM trial_journey WHERE id = 1').get() as JourneyRow | undefined
  return row ? rowToJourney(row) : null
}

export function patchJourney(patch: JourneyPatchInput): Journey | null {
  const exists = db.prepare('SELECT id FROM trial_journey WHERE id = 1').get()
  if (!exists) return null

  const sets: string[] = []
  const values: unknown[] = []
  for (const [col, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (BOOL_COLS.has(col)) {
      sets.push(`${col} = ?`)
      values.push(value ? 1 : 0)
    } else if (ARRAY_COLS.has(col)) {
      sets.push(`${col} = ?`)
      values.push(JSON.stringify(value))
    } else {
      sets.push(`${col} = ?`)
      values.push(value)
    }
  }
  if (sets.length > 0) {
    db.prepare(`UPDATE trial_journey SET ${sets.join(', ')} WHERE id = 1`).run(...values)
  }
  return getJourney()
}

export function applyTrial(body: TrialApplyBodyInput): { id: number } {
  const info = db
    .prepare('INSERT INTO trial_applications (companyName, contact, agreeToTerms, createdAt) VALUES (?, ?, ?, ?)')
    .run(body.companyName, body.contact, body.agreeToTerms ? 1 : 0, new Date().toISOString())
  return { id: Number(info.lastInsertRowid) }
}

/** 演示态：固定验证码，发信为假动作，仅返回成功供前端启动倒计时。 */
export function sendOtp(_body: { channel: string; target: string }): { sent: true } {
  return { sent: true }
}

export function verifyOtp(code: string): boolean {
  return code === DEMO_OTP_CODE
}

/** 载入演示数据：org.demoData=1 + 旅程置为成熟态。 */
export function setDemoData(): void {
  db.prepare(`UPDATE org SET demoData = 1 WHERE id = 'org-1'`).run()
  db.prepare(
    `UPDATE trial_journey SET activated = 1, step = 5, installedApps = ?, uninstalledApps = '[]', userInstalledApps = ?, invitesSent = 1, configProgress = 100 WHERE id = 1`,
  ).run(JSON.stringify(MATURE_INSTALLED_APPS), JSON.stringify(MATURE_USER_INSTALLED_APPS))
}

/** 回到空态起点：旅程重置为 seed 口径、org.demoData=0；幂等。 */
export function resetDemoData(): void {
  db.prepare(`UPDATE org SET demoData = 0 WHERE id = 'org-1'`).run()
  db.prepare(
    `UPDATE trial_journey SET activated = 0, step = 0, installedApps = ?, uninstalledApps = '[]', userInstalledApps = '[]', invitesSent = 0, configProgress = 0 WHERE id = 1`,
  ).run(JSON.stringify(DEFAULT_INSTALLED_APPS))
}
