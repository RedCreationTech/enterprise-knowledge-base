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
