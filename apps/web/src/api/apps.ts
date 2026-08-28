import { apiRequest } from './client.js'

/** 获取应用列表（含安装状态派生） */
export async function getApps(): Promise<any[]> {
  return apiRequest<any[]>('/apps')
}

/** 安装应用 */
export async function installApp(appId: string): Promise<any> {
  return apiRequest<any>(`/apps/${encodeURIComponent(appId)}/install`, {
    method: 'POST',
  })
}

/** 卸载应用 */
export async function uninstallApp(appId: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/apps/${encodeURIComponent(appId)}/uninstall`, {
    method: 'POST',
  })
}
