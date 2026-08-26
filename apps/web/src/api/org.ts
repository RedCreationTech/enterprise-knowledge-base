import { MemberListResponse, MemberResponse, OrgResponse, PlanResponse } from '@kb/shared'
import type { z } from 'zod'
import { apiRequest } from './client'

export type Org = z.infer<typeof OrgResponse>
export type Plan = z.infer<typeof PlanResponse>
export type Member = z.infer<typeof MemberResponse>

/** GET /org：组织信息（demoData 已由服务端映射为布尔）。 */
export async function getOrg(): Promise<Org> {
  return apiRequest('/org', { schema: OrgResponse })
}

/** GET /org/members：成员列表（服务端返回裸数组）。 */
export async function getMembers(): Promise<Member[]> {
  return apiRequest('/org/members', { schema: MemberListResponse })
}

/** GET /plan：套餐信息（试用版 / 用量 / 席位）。 */
export async function getPlan(): Promise<Plan> {
  return apiRequest('/plan', { schema: PlanResponse })
}
