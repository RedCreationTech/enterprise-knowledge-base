import { z } from 'zod'
import { httpError } from './http-error.js'

/** 用 @kb/shared 的 zod schema 校验请求体；非法时抛 400（由 error-handler 映射为 BAD_REQUEST）。 */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) throw httpError(400, '请求体校验失败')
  return result.data
}
