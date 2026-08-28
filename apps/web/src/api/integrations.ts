import { apiRequest } from './client.js'

interface IntegrationItem { id: string; name: string; kind: string; connected: boolean; health: string }
interface IntegrationSummary { connected: number; normal: number; warning: number; total: number }
interface IntegrationsResponse { integrations: IntegrationItem[]; summary: IntegrationSummary }

/** 获取集成列表 + summary（connectedCount / normal / warning / weeklyUsage） */
export async function getIntegrations(): Promise<IntegrationsResponse> {
  return apiRequest<IntegrationsResponse>('/integrations')
}

/** 更新集成配置 */
export async function patchIntegrationConfig(id: string, config: string): Promise<IntegrationItem> {
  return apiRequest<IntegrationItem>(`/integrations/${encodeURIComponent(id)}/config`, {
    method: 'PATCH',
    body: { config },
  })
}

/** 重新授权集成 */
export async function reauthIntegration(id: string): Promise<IntegrationItem> {
  return apiRequest<IntegrationItem>(`/integrations/${encodeURIComponent(id)}/reauth`, {
    method: 'POST',
  })
}
