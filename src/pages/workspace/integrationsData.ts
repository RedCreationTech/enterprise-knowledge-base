/**
 * 集成管理页数据（design/integrations.md §5 + design.md V1.1-§10）
 * 源自 base.mock apps 已安装/使用中项；身份映射与 permissions 页同源（400/402，陈可/刘洋待映射）。
 */

export type IntegrationTone = 'success' | 'warning'

export interface Integration {
  id: string
  name: string
  vendor: string
  logo: string
  badge: string
  tone: IntegrationTone
  channelStatus: '正常' | '异常'
  meta: { label: string; value: string }[]
  /** 本周/本月使用量（渠道使用分析口径） */
  usage: string
  actions: { label: string; kind: 'config' | 'tertiary'; to?: string }[]
}

export const integrations: Integration[] = [
  {
    id: 'feishu-qa',
    name: '飞书问答插件',
    vendor: '飞书开放平台',
    logo: '/logo-feishu.svg',
    badge: '可试用',
    tone: 'warning',
    channelStatus: '正常',
    meta: [
      { label: '最近同步', value: '—' },
      { label: '可访问人数', value: '96 人' },
      { label: '本周使用', value: '—' },
    ],
    usage: '—',
    actions: [
      { label: '配置', kind: 'config' },
      { label: '重新授权', kind: 'tertiary' },
      { label: '查看日志', kind: 'tertiary' },
    ],
  },
  {
    id: 'wecom-qa',
    name: '企业微信知识助手',
    vendor: '企业微信',
    logo: '/logo-wecom.svg',
    badge: '运行中',
    tone: 'success',
    channelStatus: '正常',
    meta: [
      { label: '最近同步', value: '今天 08:30' },
      { label: '可访问人数', value: '128 人' },
      { label: '本周使用', value: '96 次' },
    ],
    usage: '本周 96 次',
    actions: [
      { label: '配置', kind: 'config' },
      { label: '查看日志', kind: 'tertiary' },
    ],
  },
  {
    id: 'custom-api',
    name: '自定义 API',
    vendor: '自建开放接口',
    logo: '/logo-api.svg',
    badge: '运行中',
    tone: 'success',
    channelStatus: '正常',
    meta: [
      { label: '本月调用', value: '1,240 次' },
      { label: '可访问', value: '不限（按 Key 权限）' },
    ],
    usage: '本月 1,240 次',
    actions: [
      { label: '配置', kind: 'config' },
      { label: 'API 与开发 ›', kind: 'tertiary', to: '/workspace/api-dev' },
    ],
  },
  {
    id: 'sso',
    name: '单点登录 SSO',
    vendor: '企业身份认证',
    logo: '/logo-sso.svg',
    badge: '已启用',
    tone: 'success',
    channelStatus: '正常',
    meta: [
      { label: '最近验证', value: '今天 09:00' },
      { label: '覆盖', value: '62 人' },
    ],
    usage: '覆盖 62 人',
    actions: [
      { label: '配置', kind: 'config' },
      { label: '查看登录日志', kind: 'tertiary' },
    ],
  },
]

/** 飞书问答插件配置面板四 Tab 数据 */
export const integrationConfig = {
  scopeSpaces: [
    { name: '产品资料', docs: 32 },
    { name: '销售弹药库', docs: 28 },
  ],
  targetUsers: { departments: ['销售部', '售前部'], count: 96 },
  mapping: { mapped: 400, total: 402 },
  unmapped: [
    { name: '陈可', reason: '飞书账号未绑定企业邮箱' },
    { name: '刘洋', reason: '企微账号未匹配' },
  ],
  push: [
    { key: 'daily', label: '每日知识日报推送', note: '每天 09:00 推送知识使用摘要', on: false },
    { key: 'noAnswer', label: '无答案高频告警', note: '同一问题 24h 内被问 ≥5 次时通知', on: true },
    { key: 'expire', label: '授权到期提醒', note: '提前 14 天提醒管理员', on: true },
  ],
}

export const channelAlert = {
  title: '飞书问答插件授权将于 2024-06-15 到期（16 天后）',
  desc: '到期后渠道将自动降级为只读，员工仍可查看历史答案但无法发起新问答。',
}

export const channelHealth = [
  { name: '飞书', rate: 99.8 },
  { name: '企微', rate: 100 },
  { name: 'API', rate: 99.9 },
]

export const recommendApps = ['官网客服组件', '钉钉机器人', '知识日报', '飞书文档插件']

/** 渠道运行概览 MetricCard 口径（328 = 212 + 96 + 20；「已安装集成」计数由 store.installedApps 派生） */
export const integrationMetrics = {
  normal: 3,
  warning: 1,
  weeklyUsage: 328,
  usageSplit: '企业微信 212 · 知识网站 96 · 其他 20',
  reachable: 286,
  alerts: 1,
}

/** 「修改范围 ›」空间勾选 Modal 可选项（默认勾选与 scopeSpaces 一致） */
export const SCOPE_SPACE_OPTIONS = [
  { name: '产品资料', docs: 32 },
  { name: '销售弹药库', docs: 28 },
  { name: '制度与流程', docs: 45 },
  { name: '客服知识库', docs: 21 },
  { name: '市场活动素材', docs: 18 },
]

/** 「调整 ›」部门选择器（按一级部门分组） */
export const DEPT_OPTIONS = [
  { group: '销售中心', depts: ['销售部', '售前部', '渠道部'] },
  { group: '客户成功', depts: ['客服部', '交付部'] },
  { group: '产品与研发', depts: ['产品部', '研发部'] },
  { group: '职能部门', depts: ['市场部', '人力资源部'] },
]

/** 部门人数 mock（调整目标用户后同步计数） */
export const DEPT_MEMBER_COUNT: Record<string, number> = {
  销售部: 46,
  售前部: 50,
  渠道部: 32,
  客服部: 38,
  交付部: 24,
  产品部: 21,
  研发部: 56,
  市场部: 18,
  人力资源部: 12,
}

/** 日志 Drawer 级别 */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

export interface IntegrationLog {
  time: string
  level: LogLevel
  content: string
}

/** 通用渠道运行日志（查看日志 / 查看完整日志 ›） */
export const integrationLogs: IntegrationLog[] = [
  { time: '今天 10:42', level: 'INFO', content: '渠道问答请求完成 · 响应 200 · 耗时 486ms' },
  { time: '今天 10:26', level: 'INFO', content: '成员「王芳」在飞书侧边栏发起问答，命中 3 条引用' },
  { time: '今天 09:58', level: 'WARN', content: '知识引用率低于阈值（68% < 75%），建议检查知识范围配置' },
  { time: '今天 09:30', level: 'INFO', content: '每日知识摘要推送成功 · 送达 96 人' },
  { time: '昨天 18:12', level: 'INFO', content: '身份映射自动同步完成 · 新增 2 人 · 覆盖 400/402' },
  { time: '昨天 16:47', level: 'ERROR', content: '消息推送失败 · 飞书接口限流（429），已进入自动重试队列' },
  { time: '昨天 16:52', level: 'INFO', content: '限流恢复，重试推送成功' },
  { time: '昨天 11:05', level: 'WARN', content: '授权有效期不足 30 天，已通知管理员' },
  { time: '05-27 09:00', level: 'INFO', content: '每日知识摘要推送成功 · 送达 94 人' },
  { time: '05-26 15:31', level: 'INFO', content: '知识范围变更生效 · 产品资料（32 份）· 销售弹药库（28 份）' },
]

/** SSO 登录日志（查看登录日志） */
export const ssoLoginLogs: IntegrationLog[] = [
  { time: '今天 10:15', level: 'INFO', content: '张伟 通过 SSO 登录成功 · IP 10.12.3.41' },
  { time: '今天 09:58', level: 'INFO', content: '陈晨 通过 SSO 登录成功 · IP 10.12.3.87' },
  { time: '今天 09:31', level: 'WARN', content: '刘洋 连续 2 次密码错误，已触发二次验证' },
  { time: '今天 09:00', level: 'INFO', content: 'SSO 每日验证通过 · 覆盖 62 人' },
  { time: '昨天 19:22', level: 'INFO', content: '王芳 通过 SSO 登录成功 · IP 10.12.5.19' },
  { time: '昨天 14:03', level: 'ERROR', content: '李雷 登录失败 · 账号未在组织架构中，已拒绝并记录' },
  { time: '昨天 08:45', level: 'INFO', content: 'SSO 每日验证通过 · 覆盖 62 人' },
]

/** 降级策略默认值（设置降级策略 Modal） */
export const defaultFallbackPolicy = {
  /** 异常阈值：连续失败次数触发降级 */
  threshold: '3 次',
  /** 通知人 */
  notifyUsers: ['张伟（系统管理员）'],
  /** 恢复后自动回切 */
  autoRecover: true,
}

export const FALLBACK_THRESHOLD_OPTIONS = ['3 次', '5 次', '10 次'] as const
export const FALLBACK_NOTIFY_OPTIONS = ['张伟（系统管理员）', '陈晨（渠道负责人）', '王芳（运维值班）'] as const
