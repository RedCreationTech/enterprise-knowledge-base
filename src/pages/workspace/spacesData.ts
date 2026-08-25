/**
 * 知识空间页面模拟数据（spaces.md §5 / design.md V1.1-§10）
 * 状态枚举沿用 KnowledgeSpace 生命周期（DRAFT / PUBLISHED），展示文案在本文件内映射。
 * 空间列表以 kbData.SPACES 为单一事实源派生（名称/文档计数唯一来源），此处仅补充页面级展示元数据。
 */
import { SPACES as KB_SPACES } from './kbData'
import type { SpaceRow } from './kbData'

export type SpaceStatus = 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'

export interface SpaceMember {
  name: string
  role: string
  joinedAt: string
  /** 聚合占位行（如「其余 9 人」），不可单独编辑/移除 */
  aggregate?: boolean
}

export interface SpaceItem {
  id: string
  name: string
  /** 图标 key（页面内映射 lucide 图标） */
  icon: string
  status: SpaceStatus
  isDefault?: boolean
  desc: string
  docs: number
  questions: number
  members: number
  owner: string
  ownerAvatar: string
  updatedAt: string
  scope: string
  createdAt: string
  policy: { cycle: string; onExpire: string; notify?: boolean }
  memberRows: SpaceMember[]
  /** 草稿空间提示（不进入 AI 引用范围） */
  draftNote?: string
}

/** 页面级展示元数据（不含 name/docs，二者由 kbData.SPACES 单一事实源派生） */
const SPACE_META: Record<string, Omit<SpaceItem, 'name' | 'docs'>> = {
  '默认空间（全部知识）': {
    id: 'all',
    icon: 'globe',
    status: 'PUBLISHED',
    isDefault: true,
    desc: '全员可见的企业知识总集，新员工默认加入',
    questions: 156,
    members: 12,
    owner: '张伟',
    ownerAvatar: '张',
    updatedAt: '今天 09:40',
    scope: '组织内全员',
    createdAt: '2024-04-02',
    policy: { cycle: '制度类 180 天 · 报价类 60 天 · FAQ 365 天', onExpire: '降权并提醒 Owner', notify: true },
    memberRows: [
      { name: '张伟', role: '管理员', joinedAt: '2024-04-02' },
      { name: '李娜', role: '可编辑', joinedAt: '2024-04-02' },
      { name: '其余 9 人', role: '可问答', joinedAt: '—', aggregate: true },
    ],
  },
  '制度与流程': {
    id: 'policy',
    icon: 'clipboard',
    status: 'PUBLISHED',
    desc: '人事、财务、行政与审批制度',
    questions: 42,
    members: 12,
    owner: '李娜',
    ownerAvatar: '李',
    updatedAt: '昨天 17:22',
    scope: '组织内全员',
    createdAt: '2024-04-05',
    policy: { cycle: '制度类 180 天 · FAQ 365 天', onExpire: '降权并提醒 Owner', notify: true },
    memberRows: [
      { name: '李娜', role: '管理员', joinedAt: '2024-04-05' },
      { name: '张伟', role: '可编辑', joinedAt: '2024-04-06' },
      { name: '其余 10 人', role: '可问答', joinedAt: '—', aggregate: true },
    ],
  },
  '产品资料': {
    id: 'product',
    icon: 'package',
    status: 'PUBLISHED',
    desc: '产品介绍、版本说明、使用指南',
    questions: 38,
    members: 9,
    owner: '王强',
    ownerAvatar: '王',
    updatedAt: '05-28 15:10',
    scope: '指定团队（产品·售前·销售）',
    createdAt: '2024-04-08',
    policy: { cycle: '产品类 90 天 · FAQ 365 天', onExpire: '降权并提醒 Owner', notify: true },
    memberRows: [
      { name: '王强', role: '管理员', joinedAt: '2024-04-08' },
      { name: '赵敏', role: '可编辑', joinedAt: '2024-04-09' },
      { name: '其余 7 人', role: '可问答', joinedAt: '—', aggregate: true },
    ],
  },
  '销售弹药库': {
    id: 'sales',
    icon: 'briefcase',
    status: 'PUBLISHED',
    desc: '报价政策、客户案例、异议应对',
    questions: 31,
    members: 8,
    owner: '赵敏',
    ownerAvatar: '赵',
    updatedAt: '05-27 11:05',
    scope: '指定团队（销售·售前）',
    createdAt: '2024-04-10',
    policy: { cycle: '报价类 60 天 · 案例类 180 天', onExpire: '降权并提醒 Owner', notify: false },
    memberRows: [
      { name: '赵敏', role: '管理员', joinedAt: '2024-04-10' },
      { name: '张伟', role: '可编辑', joinedAt: '2024-04-11' },
      { name: '其余 6 人', role: '可问答', joinedAt: '—', aggregate: true },
    ],
  },
  'IT·SOP': {
    id: 'it-sop',
    icon: 'wrench',
    status: 'DRAFT',
    desc: '系统使用与故障处理手册（建设中）',
    questions: 15,
    members: 5,
    owner: '陈可',
    ownerAvatar: '陈',
    updatedAt: '05-26 09:18',
    scope: '仅成员私有',
    createdAt: '2024-05-20',
    policy: { cycle: 'SOP 类 90 天', onExpire: '降权并提醒 Owner', notify: true },
    memberRows: [
      { name: '陈可', role: '管理员', joinedAt: '2024-05-20' },
      { name: '张伟', role: '可编辑', joinedAt: '2024-05-21' },
      { name: '其余 3 人', role: '可问答', joinedAt: '—', aggregate: true },
    ],
    draftNote: '草稿空间：内容暂不进入 AI 助手引用范围，发布后自动生效。',
  },
}

/** 空间单一事实源：名称与文档计数完全来自 kbData.SPACES，此处仅叠加页面展示元数据 */
export const SPACES: SpaceItem[] = KB_SPACES.map((row) => ({
  ...SPACE_META[row.name],
  name: row.name,
  docs: row.count,
}))

/** localStorage 元素级校验（loadLSArray 用）：剔除损坏/非空间条目 */
export function isSpace(x: unknown): x is SpaceItem {
  if (typeof x !== 'object' || x === null) return false
  const s = x as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.icon === 'string' &&
    (s.status === 'PUBLISHED' || s.status === 'DRAFT' || s.status === 'ARCHIVED') &&
    typeof s.desc === 'string' &&
    typeof s.docs === 'number' &&
    typeof s.questions === 'number' &&
    typeof s.members === 'number' &&
    typeof s.owner === 'string' &&
    typeof s.ownerAvatar === 'string' &&
    typeof s.updatedAt === 'string' &&
    typeof s.scope === 'string' &&
    typeof s.createdAt === 'string' &&
    typeof s.policy === 'object' &&
    s.policy !== null &&
    typeof (s.policy as Record<string, unknown>).cycle === 'string' &&
    Array.isArray(s.memberRows)
  )
}

function parseCycleDays(cycle: string): number {
  const m = typeof cycle === 'string' ? cycle.match(/(\d+)\s*天/) : null
  return m ? Number(m[1]) : 180
}

/** 将 KnowledgeSpaces 的 SpaceItem 映射为 KnowledgeBase 空间树所需 SpaceRow（健康态优先沿用 kbData 权威值） */
export function spaceItemToSpaceRow(s: SpaceItem): SpaceRow {
  const canonical = KB_SPACES.find((c) => c.name === s.name)
  return {
    name: s.name,
    count: s.docs,
    health: canonical?.health ?? '健康',
    reviewCount: canonical?.reviewCount,
    reviewCycle: canonical?.reviewCycle ?? parseCycleDays(s.policy.cycle),
    archived: s.status === 'ARCHIVED',
  }
}

export type ConflictPriority = '高' | '中'
export type ConflictStatus = 'open' | 'resolved'

export interface SpaceConflict {
  id: string
  title: string
  detail: string
  spaces: string[]
  refs?: number
  priority: ConflictPriority
  status: ConflictStatus
}

export const SPACE_CONFLICTS: SpaceConflict[] = [
  {
    id: 'c1',
    title: '《销售报价政策》存在 v2024 与 v2026 两个版本',
    detail: '分别位于「制度与流程」与「销售弹药库」，近 30 天被引用 12 次',
    spaces: ['制度与流程', '销售弹药库'],
    refs: 12,
    priority: '高',
    status: 'open',
  },
  {
    id: 'c2',
    title: '《差旅报销标准》与《费用管理制度》金额不一致',
    detail: '涉及 2 个空间 · 高铁二等座上限 600 元 vs 550 元',
    spaces: ['制度与流程', '默认空间（全部知识）'],
    priority: '中',
    status: 'open',
  },
]

/** 新建空间向导：8 个预设图标 key */
export const SPACE_ICON_CHOICES = [
  'globe',
  'clipboard',
  'package',
  'briefcase',
  'wrench',
  'book',
  'headset',
  'shield',
] as const

export const VISIBILITY_OPTIONS = [
  { value: 'org', label: '组织内全员', desc: '所有成员可见并提问' },
  { value: 'team', label: '指定团队', desc: '仅选中团队可见' },
  { value: 'private', label: '仅成员私有', desc: '仅空间成员可见' },
] as const

export const VALIDITY_OPTIONS = [
  { value: 30, hint: '适合外部网页、活动类内容' },
  { value: 60, hint: '适合报价、政策类内容' },
  { value: 90, hint: '适合产品资料、SOP' },
  { value: 180, hint: '适合制度与流程文档' },
  { value: 365, hint: '适合 FAQ 与长期有效知识' },
] as const

export const OWNER_OPTIONS = ['张伟', '李娜', '王强', '赵敏', '陈可']

/** 成员角色选项 */
export const MEMBER_ROLE_OPTIONS = ['管理员', '可编辑', '可问答'] as const

/** 策略编辑：到期处理方式 */
export const EXPIRE_HANDLING_OPTIONS = ['降权并提醒 Owner', '自动归档', '仅提醒不处理'] as const

/** 空间内文档（管理 Drawer「空间文档」分区 mock，与知识库文档口径一致） */
export interface SpaceDoc {
  id: string
  title: string
  version: string
  owner: string
  updatedAt: string
}

export const SPACE_DOCS: Record<string, SpaceDoc[]> = {
  all: [
    { id: 'sd-all-1', title: '《销售管理制度》', version: 'v2.1', owner: '张伟', updatedAt: '今天 10:20' },
    { id: 'sd-all-2', title: '《产品 X 白皮书》', version: 'v1.5', owner: '张伟', updatedAt: '05-30 14:12' },
    { id: 'sd-all-3', title: '《客服 FAQ 汇编》', version: 'v3.2', owner: '李娜', updatedAt: '今天 09:58' },
    { id: 'sd-all-4', title: '《重点客户案例集（2024）》', version: 'v1.2', owner: '王强', updatedAt: '05-27 15:44' },
  ],
  policy: [
    { id: 'sd-p1', title: '《销售管理制度》', version: 'v2.1', owner: '张伟', updatedAt: '今天 10:20' },
    { id: 'sd-p2', title: '《审批权限矩阵表》', version: 'v3.0', owner: '张伟', updatedAt: '昨天 11:08' },
    { id: 'sd-p3', title: '《差旅费用报销管理办法》', version: 'v2.0', owner: '王强', updatedAt: '06-01 09:30' },
    { id: 'sd-p4', title: '《新品发布会执行 SOP》', version: 'v1.0', owner: '王强', updatedAt: '05-29 10:05' },
  ],
  product: [
    { id: 'sd-pr1', title: '《产品 X 白皮书》', version: 'v1.5', owner: '张伟', updatedAt: '05-30 14:12' },
    { id: 'sd-pr2', title: '《产品 X 快速上手指南》', version: 'v1.1', owner: '王强', updatedAt: '05-24 16:40' },
    { id: 'sd-pr3', title: '《版本发布说明（2024.05）》', version: 'v1.0', owner: '王强', updatedAt: '05-22 11:15' },
  ],
  sales: [
    { id: 'sd-s1', title: '《价格管理办法》', version: 'v1.3', owner: '李娜', updatedAt: '昨天 16:45' },
    { id: 'sd-s2', title: '《2024 报价政策》', version: 'v1.0', owner: '李娜', updatedAt: '05-31 18:22' },
    { id: 'sd-s3', title: '《渠道价格政策（外部版）》', version: 'v1.1', owner: '李娜', updatedAt: '05-28 10:11' },
    { id: 'sd-s4', title: '《重点客户案例集（2024）》', version: 'v1.2', owner: '王强', updatedAt: '05-27 15:44' },
  ],
  'it-sop': [
    { id: 'sd-i1', title: '《VPN 接入与故障排查 SOP》', version: 'v0.9', owner: '陈可', updatedAt: '05-26 09:18' },
    { id: 'sd-i2', title: '《新员工账号开通指引》', version: 'v1.0', owner: '陈可', updatedAt: '05-23 14:02' },
  ],
}

/** 空间分析 Drawer mock：近 8 周问答/文档趋势 + 贡献成员 */
export interface SpaceAnalytics {
  trend: { week: string; questions: number; docs: number }[]
  contributors: { name: string; answers: number }[]
}

export const SPACE_ANALYTICS: Record<string, SpaceAnalytics> = {
  all: {
    trend: [
      { week: 'W16', questions: 98, docs: 112 },
      { week: 'W17', questions: 110, docs: 115 },
      { week: 'W18', questions: 105, docs: 118 },
      { week: 'W19', questions: 124, docs: 120 },
      { week: 'W20', questions: 131, docs: 122 },
      { week: 'W21', questions: 128, docs: 124 },
      { week: 'W22', questions: 142, docs: 126 },
      { week: 'W23', questions: 156, docs: 128 },
    ],
    contributors: [
      { name: '张伟', answers: 46 },
      { name: '李娜', answers: 38 },
      { name: '王强', answers: 24 },
    ],
  },
  policy: {
    trend: [
      { week: 'W16', questions: 22, docs: 30 },
      { week: 'W17', questions: 26, docs: 31 },
      { week: 'W18', questions: 24, docs: 31 },
      { week: 'W19', questions: 30, docs: 32 },
      { week: 'W20', questions: 33, docs: 32 },
      { week: 'W21', questions: 31, docs: 33 },
      { week: 'W22', questions: 38, docs: 33 },
      { week: 'W23', questions: 42, docs: 34 },
    ],
    contributors: [
      { name: '李娜', answers: 18 },
      { name: '张伟', answers: 12 },
      { name: '王强', answers: 6 },
    ],
  },
  product: {
    trend: [
      { week: 'W16', questions: 20, docs: 27 },
      { week: 'W17', questions: 24, docs: 28 },
      { week: 'W18', questions: 22, docs: 29 },
      { week: 'W19', questions: 27, docs: 30 },
      { week: 'W20', questions: 29, docs: 30 },
      { week: 'W21', questions: 26, docs: 31 },
      { week: 'W22', questions: 33, docs: 31 },
      { week: 'W23', questions: 38, docs: 32 },
    ],
    contributors: [
      { name: '王强', answers: 15 },
      { name: '赵敏', answers: 11 },
      { name: '张伟', answers: 7 },
    ],
  },
  sales: {
    trend: [
      { week: 'W16', questions: 16, docs: 24 },
      { week: 'W17', questions: 19, docs: 25 },
      { week: 'W18', questions: 18, docs: 25 },
      { week: 'W19', questions: 21, docs: 26 },
      { week: 'W20', questions: 24, docs: 26 },
      { week: 'W21', questions: 22, docs: 27 },
      { week: 'W22', questions: 27, docs: 27 },
      { week: 'W23', questions: 31, docs: 28 },
    ],
    contributors: [
      { name: '赵敏', answers: 13 },
      { name: '张伟', answers: 9 },
      { name: '李娜', answers: 5 },
    ],
  },
  'it-sop': {
    trend: [
      { week: 'W16', questions: 4, docs: 8 },
      { week: 'W17', questions: 6, docs: 9 },
      { week: 'W18', questions: 5, docs: 9 },
      { week: 'W19', questions: 8, docs: 10 },
      { week: 'W20', questions: 9, docs: 10 },
      { week: 'W21', questions: 8, docs: 11 },
      { week: 'W22', questions: 12, docs: 11 },
      { week: 'W23', questions: 15, docs: 12 },
    ],
    contributors: [
      { name: '陈可', answers: 8 },
      { name: '张伟', answers: 4 },
    ],
  },
}

/** 空间健康报告 mock（健康分 / 问题 / 建议） */
export interface SpaceHealth {
  id: string
  score: number
  issues: string[]
  suggestions: string[]
}

export const SPACE_HEALTH: SpaceHealth[] = [
  {
    id: 'all',
    score: 92,
    issues: ['2 份文档 30 天内到期需复审'],
    suggestions: ['为到期文档指定复审人', '保持每周增量同步节奏'],
  },
  {
    id: 'policy',
    score: 74,
    issues: ['《差旅费用报销管理办法》已过复审期', '与「默认空间（全部知识）」存在 1 处金额口径冲突'],
    suggestions: ['尽快完成差旅制度复审', '确认报销金额权威口径后同步两个空间'],
  },
  {
    id: 'product',
    score: 88,
    issues: ['版本发布说明更新滞后一个迭代'],
    suggestions: ['将发布说明纳入发版 checklist'],
  },
  {
    id: 'sales',
    score: 68,
    issues: ['《2024 报价政策》已过期仍被检索命中', '渠道价格政策与价格管理办法存在冲突'],
    suggestions: ['指定报价政策权威版本', '过期文档降权或归档'],
  },
  {
    id: 'it-sop',
    score: 55,
    issues: ['空间仍为草稿，内容未进入 AI 引用范围', '文档覆盖率不足（仅 12 份）'],
    suggestions: ['补充高频故障 SOP 后发布空间', '邀请 IT 同事加入共建'],
  },
]
