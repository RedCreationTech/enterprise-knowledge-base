/**
 * 新手引导对外常量与工具（与 ProductTour 组件解耦，避免同一文件混出常量/函数破坏 Fast Refresh）。
 * V1.3 8 步导览（design/onboarding-tour.md §2.1 / §2.3 / F14-5）。
 */
import { KEY_NAMESPACE, migrateRawKey } from '@/lib/storage'

export const TOUR_DONE_KEY = KEY_NAMESPACE.tour.done
export const TOUR_VERSION_KEY = KEY_NAMESPACE.tour.version
export const TOUR_EXIT_KEY = KEY_NAMESPACE.tour.exit
/** Phase 3 Task 6 迁移回退旧 key：读取时迁移（新 key 缺失则读旧值并写入新 key、删除旧 key） */
export const LEGACY_TOUR_DONE_KEY = 'kb.tour.done'
export const LEGACY_TOUR_VERSION_KEY = 'kb.tour.version'
export const TOUR_VERSION = 'v1.3'
/** 手动重开导览（忽略 done 标记）广播事件 */
export const TOUR_START_EVENT = 'ekb:start-tour'
/** 导览状态写入后广播（供新手任务清单等联动刷新） */
export const TOUR_STATE_EVENT = 'ekb:tour-state'

/** 全局重开导览（忽略 done 标记） */
export function startProductTour() {
  window.dispatchEvent(new Event(TOUR_START_EVENT))
}

/** 是否满足自动启动条件（§2.1 / F14-5：未完成或版本落后均重播一次） */
export function shouldAutoStartTour() {
  try {
    migrateRawKey(LEGACY_TOUR_DONE_KEY, TOUR_DONE_KEY)
    migrateRawKey(LEGACY_TOUR_VERSION_KEY, TOUR_VERSION_KEY)
    return (
      localStorage.getItem(TOUR_DONE_KEY) !== '1' ||
      localStorage.getItem(TOUR_VERSION_KEY) !== TOUR_VERSION
    )
  } catch {
    return false
  }
}
