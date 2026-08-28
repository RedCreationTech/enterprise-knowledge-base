import type { FastifyInstance } from 'fastify'
import { API_BASE } from '@kb/shared'
import { listApps, installApp, uninstallApp } from '../services/apps.js'
import { httpError } from '../utils/http-error.js'

export function registerApps(app: FastifyInstance) {
  app.get('/apps', async () => ({ ok: true, data: listApps() }))

  app.post('/apps/:id/install', async (req) => {
    const { id } = req.params as { id: string }
    const result = installApp(id)
    if (!result) {
      const app = listApps().find((a: any) => a.id === id)
      if (!app) throw httpError(404, '应用不存在', 'NOT_FOUND')
      throw httpError(409, '该应用已安装', 'APP_ALREADY_INSTALLED')
    }
    return { ok: true, data: result }
  })

  app.post('/apps/:id/uninstall', async (req) => {
    const { id } = req.params as { id: string }
    const result = uninstallApp(id)
    if (!result) {
      const app = listApps().find((a: any) => a.id === id)
      if (!app) throw httpError(404, '应用不存在', 'NOT_FOUND')
      throw httpError(409, '该应用未安装，无法卸载', 'APP_NOT_INSTALLED')
    }
    return { ok: true, data: result }
  })
}
