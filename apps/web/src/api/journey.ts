import { JourneyResponse } from '@kb/shared'
import type { z } from 'zod'
import { apiRequest } from './client'

export type Journey = z.infer<typeof JourneyResponse>

/** GET /auth/journey：试用旅程状态（激活/步骤/已安装应用/配置进度）。 */
export async function getJourney(): Promise<Journey> {
  return apiRequest('/auth/journey', { schema: JourneyResponse })
}
