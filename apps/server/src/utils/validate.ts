import { z } from 'zod'
import { httpError } from './http-error.js'

/** 用 @kb/shared 的 zod schema 校验请求体；非法时抛 400（由 error-handler 映射为 BAD_REQUEST）。 */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) throw httpError(400, '请求体校验失败')
  return result.data
}

/**
 * 用 @kb/shared 的 zod schema 校验查询参数；空字符串视为缺省（前端常传空串），
 * 非法值（page=0 / size=101 / 非数字）抛 400。
 */
export function parseQuery<T>(schema: z.ZodType<T>, query: Record<string, unknown>): T {
  const cleaned: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(query)) {
    if (v === '' || v === undefined) continue
    cleaned[k] = v
  }
  const result = schema.safeParse(cleaned)
  if (!result.success) throw httpError(400, '查询参数校验失败')
  return result.data
}
