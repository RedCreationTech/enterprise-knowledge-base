import type { FastifyInstance } from 'fastify'
import { SearchQuery, SearchResponse } from '@kb/shared'
import { searchAll } from '../services/search.js'
import { parseQuery } from '../utils/validate.js'

export function registerSearch(app: FastifyInstance) {
  app.get('/search', async (req) => {
    const query = parseQuery(SearchQuery, req.query as Record<string, unknown>)
    return { ok: true, data: SearchResponse.parse({ groups: searchAll(query.q, query.limit) }) }
  })
}
