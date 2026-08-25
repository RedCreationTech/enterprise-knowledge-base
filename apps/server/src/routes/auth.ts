import type { FastifyInstance } from 'fastify'
export function registerAuth(app: FastifyInstance) {
  app.post('/auth/demo-login', async () => ({
    ok: true,
    data: { token: 'demo-token-zhangwei', user: { id: 'u-1', name: '张伟', role: '管理员' } },
  }))
}
