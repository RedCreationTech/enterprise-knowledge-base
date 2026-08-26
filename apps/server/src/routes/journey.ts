import type { FastifyInstance } from 'fastify'
import {
  JourneyResponse,
  JourneyPatch,
  TrialApplyBody,
  OtpSendBody,
  OtpVerifyBody,
  TrialApplyResponse,
  OtpSendResponse,
  OtpVerifyResponse,
  DemoDataResponse,
} from '@kb/shared'
import { getJourney, patchJourney, applyTrial, sendOtp, verifyOtp, setDemoData, resetDemoData } from '../services/journey.js'
import { parseBody } from '../utils/validate.js'
import { httpError } from '../utils/http-error.js'

export function registerJourney(app: FastifyInstance) {
  app.get('/auth/journey', async () => {
    const journey = getJourney()
    if (!journey) throw httpError(409, '试用旅程不存在')
    return { ok: true, data: JourneyResponse.parse(journey) }
  })

  app.patch('/auth/journey', async (req) => {
    const patch = parseBody(JourneyPatch, req.body)
    const journey = patchJourney(patch)
    if (!journey) throw httpError(409, '试用旅程不存在')
    return { ok: true, data: JourneyResponse.parse(journey) }
  })

  app.post('/auth/trial/apply', async (req) => {
    const body = parseBody(TrialApplyBody, req.body)
    const { id } = applyTrial(body)
    return { ok: true, data: TrialApplyResponse.parse({ id }) }
  })

  app.post('/auth/otp/send', async (req) => {
    const body = parseBody(OtpSendBody, req.body)
    return { ok: true, data: OtpSendResponse.parse(sendOtp(body)) }
  })

  app.post('/auth/otp/verify', async (req) => {
    const body = parseBody(OtpVerifyBody, req.body)
    if (!verifyOtp(body.code)) throw httpError(400, '验证码错误', 'INVALID_CODE')
    return { ok: true, data: OtpVerifyResponse.parse({ verified: true }) }
  })

  app.post('/demo-data', async () => {
    setDemoData()
    return { ok: true, data: DemoDataResponse.parse({ demoData: true }) }
  })

  app.post('/demo-data/reset', async () => {
    resetDemoData()
    return { ok: true, data: DemoDataResponse.parse({ demoData: false }) }
  })
}
