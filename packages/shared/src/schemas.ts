import { z } from 'zod'
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
