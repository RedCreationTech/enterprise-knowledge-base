/** 全局成员角色口径（CoreRole）：与前端 permissionsData 的分类一致，单一事实源。 */
export const CORE_ROLES = ['管理员', '知识管理员', '空间管理员', '文档审核员', '助手运营员', '普通成员'] as const
export type CoreRole = (typeof CORE_ROLES)[number]

/** 成员状态：活跃 / 待激活（设计 §5 口径；「已邀请」为前端派生展示态，不落库）。 */
export const MEMBER_STATUSES = ['活跃', '待激活'] as const
export type MemberStatus = (typeof MEMBER_STATUSES)[number]

export interface Org { id: string; name: string; industry: string; contact: string; demoData: boolean }
export interface Plan { tier: string; storageUsedGB: number; storageTotalGB: number; seats: number; seatsUsed: number; validUntil: string }
export interface Member { id: string; name: string; email: string; role: CoreRole; dept: string; status: MemberStatus; joinedAt: string }
export interface User { id: string; memberId: string; email: string; role: string }
export interface Journey { activated: boolean; step: number; installedApps: string[]; uninstalledApps: string[]; userInstalledApps: string[]; invitesSent: boolean; configProgress: number }
