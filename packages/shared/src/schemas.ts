import { z } from 'zod'
import { CORE_ROLES, MEMBER_STATUSES } from './types.js'
export const okSchema = z.object({ status: z.string() })
export const errorSchema = z.object({ code: z.string(), message: z.string() })
export const envelopeSchema = z.union([
  z.object({ ok: z.literal(true), data: z.unknown() }),
  z.object({ ok: z.literal(false), error: errorSchema }),
])
export function parseOk<T>(body: unknown, schema: z.ZodType<T>): T {
  const e = envelopeSchema.parse(body)
  if (!e.ok) throw new Error(`${e.error.code}: ${e.error.message}`)
  return schema.parse(e.data)
}
export function parseErr(body: unknown) { return errorSchema.parse((envelopeSchema.parse(body) as { ok: false; error: unknown }).error) }
export const HealthResponse = okSchema
export const DemoLoginResponse = z.object({ token: z.string(), user: z.object({ id: z.string(), name: z.string(), role: z.string() }) })

// ---------- 认证/旅程域 ----------

/** trial_journey 行（布尔/数组字段已从 SQLite 的 INTEGER/TEXT 解析为 JSON 友好形态） */
export const JourneyResponse = z.object({
  activated: z.boolean(),
  step: z.number(),
  installedApps: z.array(z.string()),
  uninstalledApps: z.array(z.string()),
  userInstalledApps: z.array(z.string()),
  invitesSent: z.boolean(),
  configProgress: z.number(),
})

/** PATCH /auth/journey：任意字段可选，数组为 string[]、布尔为 boolean */
export const JourneyPatch = z.object({
  activated: z.boolean().optional(),
  step: z.number().optional(),
  installedApps: z.array(z.string()).optional(),
  uninstalledApps: z.array(z.string()).optional(),
  userInstalledApps: z.array(z.string()).optional(),
  invitesSent: z.boolean().optional(),
  configProgress: z.number().optional(),
})

/** POST /auth/trial/apply 请求体 */
export const TrialApplyBody = z.object({
  companyName: z.string(),
  contact: z.string(),
  agreeToTerms: z.boolean(),
})

/** POST /auth/otp/send 请求体 */
export const OtpSendBody = z.object({ channel: z.string(), target: z.string() })

/** POST /auth/otp/verify 请求体 */
export const OtpVerifyBody = z.object({ channel: z.string(), target: z.string(), code: z.string() })

// ---------- 认证/旅程域响应 ----------

/** POST /auth/trial/apply 响应 */
export const TrialApplyResponse = z.object({ id: z.number() })
/** POST /auth/otp/send 响应 */
export const OtpSendResponse = z.object({ sent: z.boolean() })
/** POST /auth/otp/verify 响应 */
export const OtpVerifyResponse = z.object({ verified: z.boolean() })
/** POST /demo-data 与 /demo-data/reset 响应 */
export const DemoDataResponse = z.object({ demoData: z.boolean() })

export type JourneyPatchInput = z.infer<typeof JourneyPatch>
export type TrialApplyBodyInput = z.infer<typeof TrialApplyBody>

// ---------- 组织/成员/套餐域 ----------

/** 角色/状态枚举：与 types.ts 的 CoreRole/MemberStatus 同源（zod 枚举 + 字面量联合双保险）。 */
export const CoreRoleSchema = z.enum(CORE_ROLES)
export const MemberStatusSchema = z.enum(MEMBER_STATUSES)

/** GET /org 响应（demoData 已从 SQLite INTEGER 映射为布尔） */
export const OrgResponse = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.string(),
  contact: z.string(),
  demoData: z.boolean(),
})

/** PATCH /org 请求体：name/industry/contact 任意可选，非法类型 400 */
export const OrgPatch = z.object({
  name: z.string().optional(),
  industry: z.string().optional(),
  contact: z.string().optional(),
})

/** GET /org/members 响应元素（role 走 CoreRole 口径、status 含待激活） */
export const MemberResponse = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: CoreRoleSchema,
  dept: z.string(),
  status: MemberStatusSchema,
  joinedAt: z.string(),
})

/** POST /org/members 请求体：role/dept 可选（默认 普通成员/''），email 需合法格式 */
export const MemberCreateBody = z.object({
  name: z.string().min(1),
  email: z.email(),
  role: CoreRoleSchema.optional(),
  dept: z.string().optional(),
})

/** PATCH /org/members/:id 请求体：role/status/dept/email 任意可选 */
export const MemberPatch = z.object({
  role: CoreRoleSchema.optional(),
  status: MemberStatusSchema.optional(),
  dept: z.string().optional(),
  email: z.email().optional(),
})

/** GET /plan 响应（口径与前端 mock 一致：试用版 / 0.68/1GB / 20 席 / 2025-06-03） */
export const PlanResponse = z.object({
  tier: z.string(),
  storageUsedGB: z.number(),
  storageTotalGB: z.number(),
  seats: z.number(),
  seatsUsed: z.number(),
  validUntil: z.string(),
})

/** DELETE /org/members/:id 响应 */
export const DeleteResponse = z.object({ deleted: z.boolean() })

export type OrgPatchInput = z.infer<typeof OrgPatch>
export type MemberCreateBodyInput = z.infer<typeof MemberCreateBody>
export type MemberPatchInput = z.infer<typeof MemberPatch>
