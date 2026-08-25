/**
 * 统一 localStorage 读写工具（ekb- 前缀单源）
 * 所有持久化读取带 try/catch + JSON.parse + shape 校验降级；写入失败静默降级（不抛）。
 */

/** 统一 key 前缀 */
export const LS_PREFIX = 'ekb-'

/** 本任务迁移的全部 localStorage key 命名空间（单一来源，避免前缀漂移） */
export const KEY_NAMESPACE = {
  settings: {
    orgProfile: `${LS_PREFIX}org-profile`,
    /** 独立命名空间：ApiDev 页的 ApiKey 结构不同（maskedKey/permissions[]），不得共用同一键（V2 评审 P0 白屏根因） */
    apiKeys: `${LS_PREFIX}settings-api-keys`,
  },
  quickConfig: {
    progress: `${LS_PREFIX}quick-config-progress`,
    collapsed: `${LS_PREFIX}quick-config-collapsed`,
  },
  dashboard: {
    faqCreated: `${LS_PREFIX}faq-created`,
    testsetAdded: `${LS_PREFIX}testset-added`,
  },
  apiDev: {
    keys: `${LS_PREFIX}api-keys`,
  },
  trialApply: {
    draft: `${LS_PREFIX}trial-apply-draft`,
  },
  knowledge: {
    /** 知识空间单一事实源：KnowledgeSpaces 与 KnowledgeBase 共用（刷新/重启不丢） */
    spaces: `${LS_PREFIX}spaces`,
  },
  instructions: {
    /** 指令管理 CRUD/发布/回滚结果（刷新不丢） */
    list: `${LS_PREFIX}instructions`,
  },
  tour: {
    /** 新手导览完成标记（onboarding-tour.md §2.1/§2.3） */
    done: `${LS_PREFIX}tour-done`,
    version: `${LS_PREFIX}tour-version`,
    exit: `${LS_PREFIX}tour-exit`,
  },
  checklist: {
    /** 新手任务清单收起态（onboarding-tour.md §8） */
    collapsed: `${LS_PREFIX}checklist-collapsed`,
  },
  daily: {
    /** AI 摘要条展开态（<1536 折叠形态，localStorage 记忆） */
    summaryExpanded: `${LS_PREFIX}daily-summary-expanded`,
  },
  knowledgeMap: {
    /** 知识地图问题动作（创建 FAQ / 加入测试集）幂等记录 */
    questionActions: `${LS_PREFIX}knowledge-map-question-actions`,
  },
} as const

/** 读取并 JSON.parse；key 不存在或解析失败/损坏时返回 fallback */
export function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

/** 写入（JSON.stringify）；写入失败静默降级（不抛） */
export function saveLS(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 存储不可用时静默降级
  }
}

/**
 * 迁移旧 localStorage key（Phase 3 Task 6：旧 key 前缀收敛为 ekb-）：
 * 新 key 缺失而旧 key 有值时，将旧值原样写入新 key 并删除旧 key。
 * 按原始字符串复制（不做 JSON 处理），适配 '1'/'0' 等非 JSON 值；存储不可用时静默降级。
 */
export function migrateRawKey(oldKey: string, newKey: string): void {
  try {
    if (localStorage.getItem(newKey) === null) {
      const value = localStorage.getItem(oldKey)
      if (value !== null) {
        localStorage.setItem(newKey, value)
        localStorage.removeItem(oldKey)
      }
    }
  } catch {
    // 存储不可用时静默降级
  }
}

/** 读取数组并做元素级过滤（非 T 的元素剔除）；非数组/解析失败返回空数组 */
export function loadLSArray<T>(key: string, isV: (x: unknown) => x is T): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isV) : []
  } catch {
    return []
  }
}
