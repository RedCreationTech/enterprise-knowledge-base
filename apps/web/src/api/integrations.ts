import { apiRequest } from './client.js'

/** 获取集成列表 + summary（connectedCount / normal / warning / weeklyUsage） */
export async function getIntegrations(): Promise<{ integrations: any[]; summary: { connected: number; normal: number; warning: number; total: number } }> {
  return apiRequest<any>('/integrations')
}

/** 更新集成配置 */
export async function patchIntegrationConfig(id: string, config: string): Promise<any> {
  return apiRequest<any>(`/integrations/${encodeURIComponent(id)}/config`, {
    method: 'PATCH',
    body: { config },
  })
}

/** 重新授权集成 */
export async function reauthIntegration(id: string): Promise<any> {
  return apiRequest<any>(`/integrations/${encodeURIComponent(id)}/reauth`, {
    method: 'POST',
  })
}
