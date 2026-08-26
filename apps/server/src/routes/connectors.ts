import type { FastifyInstance } from 'fastify'
import {
  ConnectorListResponse,
  ConnectorResponse,
  ConnectorPatch,
  SyncTaskResponse,
  SyncTasksResponse,
  DeleteResponse,
} from '@kb/shared'
import {
  listConnectors,
  connectConnector,
  syncConnector,
  patchConnector,
  deleteConnector,
  listSyncTasks,
} from '../services/connectors.js'
import { parseBody } from '../utils/validate.js'
import { httpError } from '../utils/http-error.js'

export function registerConnectors(app: FastifyInstance) {
  app.get('/connectors', async () => {
    const result = listConnectors()
    return { ok: true, data: ConnectorListResponse.parse(result) }
  })

  app.post('/connectors/:id/connect', async (req) => {
    const { id } = req.params as { id: string }
    const connector = connectConnector(id)
    if (!connector) throw httpError(404, '连接器不存在')
    return { ok: true, data: ConnectorResponse.parse(connector) }
  })

  app.post('/connectors/:id/sync', async (req) => {
    const { id } = req.params as { id: string }
    const result = syncConnector(id)
    if (result.status === 'not-found') throw httpError(404, '连接器不存在')
    return { ok: true, data: SyncTaskResponse.parse(result.task) }
  })

  app.patch('/connectors/:id', async (req) => {
    const { id } = req.params as { id: string }
    const patch = parseBody(ConnectorPatch, req.body)
    const connector = patchConnector(id, patch)
    if (!connector) throw httpError(404, '连接器不存在')
    return { ok: true, data: ConnectorResponse.parse(connector) }
  })

  app.delete('/connectors/:id', async (req) => {
    const { id } = req.params as { id: string }
    if (!deleteConnector(id)) throw httpError(404, '连接器不存在')
    return { ok: true, data: DeleteResponse.parse({ deleted: true }) }
  })

  app.get('/sync-tasks', async () => {
    const tasks = listSyncTasks()
    return { ok: true, data: SyncTasksResponse.parse({ items: tasks }) }
  })
}
