import { apiRequest } from './client.js'

interface AppItem { id: string; name: string; desc: string; category: string; logo: string; status: string; installStatus: string }
interface InstallResult extends AppItem { installStatus: '已安装' }

/** 获取应用列表（含安装状态派生） */
export async function getApps(): Promise<AppItem[]> {
  return apiRequest<AppItem[]>('/apps')
}

/** 安装应用 */
export async function installApp(appId: string): Promise<InstallResult> {
  return apiRequest<InstallResult>(`/apps/${encodeURIComponent(appId)}/install`, {
    method: 'POST',
  })
}

/** 卸载应用 */
export async function uninstallApp(appId: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/apps/${encodeURIComponent(appId)}/uninstall`, {
    method: 'POST',
  })
}
