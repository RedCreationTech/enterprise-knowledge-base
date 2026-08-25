/**
 * useAppToast — 全局唯一 Toast 入口（P1-9 收敛：sonner 单实现）。
 * - 全局 <Toaster/> 挂载于 src/App.tsx（AppStoreProvider 内层，top-center，中性样式无 richColors）
 * - 时长沿用 design.md §7：success 3s / info 5s / warning 8s / error 常驻
 * - 带动作（如「撤销」）用 opts.action，内部映射 sonner 的 action 选项
 */
import { toast } from 'sonner'

export type AppToastKind = 'success' | 'info' | 'warning' | 'error'

export interface AppToastOptions {
  /** 可选动作按钮（如「撤销」） */
  action?: { label: string; onClick: () => void }
  /** 覆盖默认时长（ms） */
  duration?: number
}

const DEFAULT_DURATION: Record<AppToastKind, number> = {
  success: 3000,
  info: 5000,
  warning: 8000,
  error: Infinity, // 常驻，需手动关闭
}

function toSonnerOpts(kind: AppToastKind, opts?: AppToastOptions) {
  return {
    duration: opts?.duration ?? DEFAULT_DURATION[kind],
    ...(opts?.action ? { action: { label: opts.action.label, onClick: opts.action.onClick } } : {}),
  }
}

export function useAppToast() {
  return {
    success: (msg: string, opts?: AppToastOptions) => toast.success(msg, toSonnerOpts('success', opts)),
    info: (msg: string, opts?: AppToastOptions) => toast.info(msg, toSonnerOpts('info', opts)),
    warning: (msg: string, opts?: AppToastOptions) => toast.warning(msg, toSonnerOpts('warning', opts)),
    error: (msg: string, opts?: AppToastOptions) => toast.error(msg, toSonnerOpts('error', opts)),
  }
}
