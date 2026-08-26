import { API_BASE, DemoLoginResponse as DemoLoginResponseSchema, envelopeSchema } from '@kb/shared'
import { z } from 'zod'
import type { ZodType } from 'zod'

/** 后端登录响应类型（由 @kb/shared 的 DemoLoginResponse schema 推导，单一数据源）。 */
export type DemoLoginResponse = z.infer<typeof DemoLoginResponseSchema>

/**
 * 读取运行模式开关。
 * - VITE_USE_MOCK 未设置 / 为 '1' → 'mock'（默认，走前端 mock 数据）
 * - VITE_USE_MOCK === '0' → 'api'（走真实后端，经 vite /api 代理）
 */
export function getEnvMode(): 'mock' | 'api' {
  return import.meta.env.VITE_USE_MOCK === '0' ? 'api' : 'mock'
}

/**
 * 通用 API 请求：拼装 @kb/shared 的 API_BASE，按信封契约解析，
 * 失败抛出 Error(`${code}: ${message}`)，成功时可选按 Zod schema 校验。
 */
export async function apiRequest<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string; schema?: ZodType<T> } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const raw: unknown = await res.json()
  const env = envelopeSchema.parse(raw)
  if (!env.ok) throw new Error(`${env.error.code}: ${env.error.message}`)
  return opts.schema ? opts.schema.parse(env.data) : (env.data as T)
}

/** 演示登录：POST /auth/demo-login，返回 { token, user }。 */
export async function demoLogin(): Promise<DemoLoginResponse> {
  return apiRequest('/auth/demo-login', { method: 'POST', schema: DemoLoginResponseSchema })
}
