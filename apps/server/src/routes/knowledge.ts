import type { FastifyInstance } from 'fastify'
import {
  KnowledgeMapResponse,
  KnowledgeSiteResponse,
  KnowledgeSiteSearchBody,
  KnowledgeSiteSearchResponse,
  QaBody,
  QaResponse,
} from '@kb/shared'
import { getKnowledgeMap, listSiteArticles, searchSite, answerQuestion } from '../services/knowledge.js'
import { parseBody } from '../utils/validate.js'

export function registerKnowledge(app: FastifyInstance) {
  app.get('/knowledge-map', async () => {
    return { ok: true, data: KnowledgeMapResponse.parse(getKnowledgeMap()) }
  })

  app.get('/knowledge-site', async () => {
    return { ok: true, data: KnowledgeSiteResponse.parse({ items: listSiteArticles() }) }
  })

  app.post('/knowledge-site/search', async (req) => {
    const body = parseBody(KnowledgeSiteSearchBody, req.body)
    return { ok: true, data: KnowledgeSiteSearchResponse.parse({ items: searchSite(body.q) }) }
  })

  app.post('/knowledge-site/qa', async (req) => {
    const body = parseBody(QaBody, req.body)
    return { ok: true, data: QaResponse.parse(answerQuestion(body.question)) }
  })
}
