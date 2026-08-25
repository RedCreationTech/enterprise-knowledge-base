import type { FastifyError, FastifyInstance } from 'fastify'
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError, _req, reply) => {
    app.log.error(err)
    const code = err.statusCode === 404 ? 'NOT_FOUND' : err.statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL'
    reply.status(err.statusCode ?? 500).send({ ok: false, error: { code, message: err.message } })
  })
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: '路由不存在' } }))
}
