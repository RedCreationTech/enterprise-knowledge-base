import { SpaceListResponse, SpaceResponse } from '@kb/shared'
import type { z } from 'zod'
import { apiRequest } from './client'

export type Space = z.infer<typeof SpaceResponse>

/** GET /spaces：知识空间列表（服务端返回裸数组，含 count/health/reviewCycle/archived）。 */
export async function getSpaces(): Promise<Space[]> {
  return apiRequest('/spaces', { schema: SpaceListResponse })
}
