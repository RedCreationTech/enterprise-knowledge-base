/** 本地上传增量计数（localStorage 持久，工作台「数据接入状态」同源联动） */
export const LOCAL_UPLOAD_KEY = 'ekb-quick-config-local-uploads'
export const LOCAL_UPLOAD_EVENT = 'ekb-local-uploads-changed'
export const LOCAL_UPLOAD_BASE = 106

export function readLocalUploads(): number {
  try {
    const n = Number(localStorage.getItem(LOCAL_UPLOAD_KEY) ?? '0')
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}
