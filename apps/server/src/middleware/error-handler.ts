import type { FastifyError, FastifyInstance } from 'fastify'

const STATUS_CODE_MAP: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
}

export function statusCodeToErrorCode(statusCode?: number): string {
  if (statusCode === undefined) return 'INTERNAL'
  return STATUS_CODE_MAP[statusCode] ?? 'INTERNAL'
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError, _req, reply) => {
    app.log.error(err)
    const statusCode = err.statusCode ?? 500
    // 领域错误码（如 INVALID_CODE）优先于状态码映射；否则按 HTTP 语义映射
    const domainCode = (err as FastifyError & { domainCode?: string }).domainCode
    const code = domainCode ?? statusCodeToErrorCode(statusCode)
    // 5xx 不泄露内部错误信息（细节保留在服务端日志），4xx 可返回 err.message
    const message = statusCode >= 500 ? '服务器内部错误' : err.message
    reply.status(statusCode).send({ ok: false, error: { code, message } })
  })
  app.setNotFoundHandler((_req, reply) =>
    reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: '路由不存在' } }),
  )
}
