/**
 * 设置中心页扩展模拟数据（settings.md §4）
 * 跨页一致数字：plan（试用版 / 2025-06-03 / 0.68GB/1GB）直接引用 @/mocks（P1-2 TRIAL 统一）。
 * 成员单一事实源（P1-N5）：members 由 permissionsData 的 coreMembers + foldedMembers 派生，
 * 与 Permissions 页姓名/计数/角色口径一致（12 名成员 / 6 核心角色）。
 */

import { METRICS } from '@/mocks'
import { coreMembers, foldedMembers } from './permissionsData'

export interface MemberItem {
  id: string
  name: string
  avatar: string
  contact: string
  department: string
  role: string
  roleTone: 'admin' | 'normal'
  status: '活跃' | '待激活' | '已邀请'
  joinedAt: string
}

export const roleTemplates = [
  '超级管理员',
  '企业管理员',
  '知识管理员',
  '空间管理员',
  '文档审核员',
  '助手运营员',
  '普通成员',
  '外部访客',
  'API 开发者',
]

/** 成员展示元数据（联系方式/加入时间），键为 permissionsData 的成员 id（身份事实源）。 */
const MEMBER_CONTACT: Record<string, string> = {
  'm-zw': 'zhangwei@example.com',
  'm-ln': 'lina@example.com',
  'm-wq': 'wangqiang@example.com',
  'm-zm': 'zhaomin@example.com',
  'm-cc': 'chenke@example.com',
  'm-ly': 'liuyang@example.com',
  'm-s1': 'sunqian@example.com',
  'm-s2': 'zhoujie@example.com',
  'm-s3': 'wufang@example.com',
  'm-s4': 'zhenghao@example.com',
  'm-s5': 'fengxue@example.com',
  'm-s6': 'hebin@example.com',
}

const MEMBER_JOINED_AT: Record<string, string> = {
  'm-zw': '2025-05-20',
  'm-ln': '2025-05-20',
  'm-wq': '2025-05-21',
  'm-zm': '2025-05-22',
  'm-cc': '2025-05-28',
  'm-ly': '2025-05-29',
  'm-s1': '2025-05-23',
  'm-s2': '2025-05-24',
  'm-s3': '2025-05-25',
  'm-s4': '2025-05-26',
  'm-s5': '2025-05-27',
  'm-s6': '2025-05-30',
}

/** 成员状态（待激活保留自旧 6 人数组：陈可/刘洋），其余默认活跃。 */
const MEMBER_STATUS: Record<string, MemberItem['status']> = {
  'm-cc': '待激活',
  'm-ly': '待激活',
}

/** 单一成员事实源：由 permissionsData（coreMembers + foldedMembers）派生，共 12 名成员。 */
export const members: MemberItem[] = [...coreMembers, ...foldedMembers].map((m) => ({
  id: m.id,
  name: m.name,
  avatar: m.name.charAt(0),
  contact: MEMBER_CONTACT[m.id] ?? '',
  department: m.dept,
  role: m.role,
  roleTone: m.role === '管理员' ? 'admin' : 'normal',
  status: MEMBER_STATUS[m.id] ?? '活跃',
  joinedAt: MEMBER_JOINED_AT[m.id] ?? '—',
}))

export interface UsageItem {
  name: string
  current: string
  limit: string
  pct: number | null
  warning?: string
}

export const usageItems: UsageItem[] = [
  { name: '知识存储', current: '0.68 GB', limit: '1 GB', pct: 68 },
  { name: '成员席位', current: '12', limit: '20 人', pct: 60 },
  { name: 'AI 问答', current: METRICS.totalQuestions.toLocaleString('en-US'), limit: '5,000 次', pct: 25 },
  { name: '文档数', current: String(METRICS.kbDocs), limit: '不限', pct: null },
  { name: '业务助手', current: '2', limit: '5 个', pct: 40 },
  { name: 'API 调用', current: METRICS.apiMonthlyCalls.toLocaleString('en-US'), limit: '5,000 次', pct: 25 },
]

export interface PlanColumn {
  name: string
  price: string
  seats: string
  highlight: string[]
  current?: boolean
}

export const planMatrix: PlanColumn[] = [
  { name: 'Trial', price: '免费 7 天', seats: '20 人', highlight: ['全部核心功能试用', '1 个业务助手', '社区支持'], current: true },
  { name: 'Free', price: '免费', seats: '3–5 人', highlight: ['基础问答', '1 GB 知识容量', '社区支持'] },
  { name: 'Team', price: '¥99/人/月', seats: '20–100 人', highlight: ['5 个业务助手', '200 GB 知识容量', '标准支持'] },
  { name: 'Business', price: '¥199/人/月', seats: '100–500 人', highlight: ['10 万次/月 AI 调用', '1 TB 知识容量', '专属客户成功'] },
  { name: 'Enterprise', price: '定制', seats: '不限', highlight: ['私有化部署', 'SSO / SCIM', 'SLA 保障'] },
]

export interface ApiKeyItem {
  id: string
  name: string
  scope: string
  masked: string
  createdAt: string
  lastCalledAt: string
}

export const apiKeyScopes = ['只读', '读写', '管理']

export const apiKeys: ApiKeyItem[] = [
  { id: 'key-1', name: '默认集成 Key', scope: '只读', masked: 'kb_live_••••3f8a', createdAt: '05-20', lastCalledAt: '今天 09:12' },
]

export const webhookEvents = ['文档解析完成', '同步失败', '知识发布', '无答案高频告警', '治理任务超期', '套餐用量预警']

export interface AuditLogItem {
  time: string
  member: string
  action: string
  target: string
  result: string
}

export const auditLogs: AuditLogItem[] = [
  { time: '今天 10:20', member: '张伟', action: '更新文档版本', target: '《销售管理制度》v2.1', result: '成功' },
  { time: '今天 09:58', member: '李娜', action: '上传文档', target: '客服 FAQ 汇编', result: '成功' },
  { time: '昨天 17:22', member: '张伟', action: '修改成员角色', target: '赵敏 → 空间管理员', result: '成功' },
  { time: '昨天 15:40', member: '系统', action: '权限同步', target: '企业网盘', result: '成功（覆盖 402 人）' },
  { time: '06-01 11:05', member: '王强', action: '导出数据', target: '成员名单.csv', result: '成功' },
]

export const industries = ['软件与信息技术服务', '制造业', '金融服务', '零售与电商', '医疗健康', '教育培训', '其他']

/** 通知偏好：渠道 × 事件 开关矩阵（行=事件，列=渠道） */
export const notifyChannels = ['邮件', '站内消息', 'IM 应用']
export const notifyEvents = ['新反馈', '同步完成', '安全告警', '每周报告']
export const initialNotifyMatrix: Record<string, Record<string, boolean>> = {
  新反馈: { 邮件: true, 站内消息: true, 'IM 应用': false },
  同步完成: { 邮件: false, 站内消息: true, 'IM 应用': false },
  安全告警: { 邮件: true, 站内消息: true, 'IM 应用': true },
  每周报告: { 邮件: true, 站内消息: false, 'IM 应用': false },
}

/** 登录 IP 白名单初始值（CIDR） */
export const initialIpWhitelist = ['10.8.0.0/16']
