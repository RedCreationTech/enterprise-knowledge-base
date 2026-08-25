/**
 * 应用中心页 mock 扩展：8 个应用的详情字段（用途/分类/场景/权限/知识范围/安装步骤/预览）。
 * id/name/status/logo 取自 @/mocks base.mock.ts 的 apps[]，本文件仅补充 install-app.md §3 的页面级字段。
 */

export interface AppScene {
  icon: string // lucide 图标 key，由页面映射
  label: string
}

export interface PreviewSource {
  name: string
  meta: string
}

export interface AppExtra {
  id: string
  /** install-app.md §3.2 分类口径 */
  category: string
  usage: string
  scenes: AppScene[]
  permissions: string[]
  scope: string
  steps: string[]
  publisher: string
  version: string
  preview?: {
    title: string
    userMsg: string
    aiMsg: string
    sources: PreviewSource[]
  }
}

export const APP_TABS = ['全部', '沟通协同', '客户服务', '销售', '办公门户', '数据集成'] as const

const DEFAULT_STEPS = ['选择要使用的知识范围与可见权限', '授权应用并确认权限', '安装完成后在对应渠道开始使用']

export const appExtras: AppExtra[] = [
  {
    id: 'feishu-qa',
    category: '沟通协同',
    usage: '在飞书侧边栏提问，获取来自知识库的准确答案与来源',
    scenes: [
      { icon: 'panel', label: '侧边栏问答' },
      { icon: 'users', label: '群聊问答' },
      { icon: 'doc', label: '文档引用' },
      { icon: 'link', label: '一键分享' },
    ],
    permissions: ['读取知识库内容', '获取用户基本信息（姓名、部门）', '在飞书中发送消息'],
    scope: '默认空间（全部知识）',
    steps: [
      '选择要使用的知识范围与可见权限',
      '授权飞书应用并确认权限',
      '安装完成后在飞书侧边栏开始使用',
    ],
    publisher: '企业知识库官方',
    version: 'v1.2.0',
    preview: {
      title: '飞书问答',
      userMsg: '新品发布会的执行 SOP 是什么？',
      aiMsg:
        '根据知识库内容，新品发布会的执行 SOP 如下：\n1. 明确目标与受众\n2. 制定整体流程与分工\n3. 物料准备与场地布置\n4. 彩排与风险预案\n5. 现场执行与复盘',
      sources: [
        { name: '新品发布会执行 SOP', meta: '市场部 / 规范 / 2024-05-10' },
        { name: '发布会筹备清单模板', meta: '市场部 / 模板 / 2024-04-18' },
        { name: '活动执行风险清单', meta: '运营中心 / 风控 / 2024-03-22' },
      ],
    },
  },
  {
    id: 'wecom-qa',
    category: '沟通协同',
    usage: '在企业微信侧边栏与聊天中使用知识库，支持群问答与消息推送',
    scenes: [
      { icon: 'panel', label: '侧边栏问答' },
      { icon: 'users', label: '群问答' },
      { icon: 'bell', label: '消息推送' },
      { icon: 'link', label: '一键分享' },
    ],
    permissions: ['读取知识库内容', '获取成员与部门信息', '在企业微信中发送消息'],
    scope: '默认空间（全部知识）',
    steps: DEFAULT_STEPS,
    publisher: '企业知识库官方',
    version: 'v1.1.3',
  },
  {
    id: 'webchat',
    category: '客户服务',
    usage: '在官网嵌入智能客服，7×24 解答访客问题，曾与工单自动流转',
    scenes: [
      { icon: 'web', label: '官网嵌入' },
      { icon: 'clock', label: '7×24 应答' },
      { icon: 'ticket', label: '工单流转' },
      { icon: 'doc', label: '引用出处' },
    ],
    permissions: ['读取知识库内容', '读取公开知识空间', '创建会话与工单'],
    scope: '公开知识空间',
    steps: DEFAULT_STEPS,
    publisher: '企业知识库官方',
    version: 'v0.9.6',
  },
  {
    id: 'dingtalk-bot',
    category: '沟通协同',
    usage: '在钉钉群聊中 @机器人提问，自动检索并回复知识库内容',
    scenes: [
      { icon: 'users', label: '群聊问答' },
      { icon: 'at', label: '@机器人' },
      { icon: 'doc', label: '引用出处' },
      { icon: 'link', label: '一键分享' },
    ],
    permissions: ['读取知识库内容', '获取群成员基本信息', '在钉钉群中发送消息'],
    scope: '默认空间（全部知识）',
    steps: DEFAULT_STEPS,
    publisher: '企业知识库官方',
    version: 'v1.0.8',
  },
  {
    id: 'custom-api',
    category: '数据集成',
    usage: '通过 OpenAPI 将知识能力接入业务系统与应用',
    scenes: [
      { icon: 'code', label: 'OpenAPI' },
      { icon: 'key', label: '密钥管理' },
      { icon: 'doc', label: '引用出处' },
      { icon: 'chart', label: '调用统计' },
    ],
    permissions: ['读取知识库内容', '生成 API 访问密钥', '读取调用日志'],
    scope: '默认空间（全部知识）',
    steps: DEFAULT_STEPS,
    publisher: '企业知识库官方',
    version: 'v2.0.1',
  },
  {
    id: 'daily-report',
    category: '办公门户',
    usage: '按主题或部门自动生成知识日报，定时推送到指定渠道',
    scenes: [
      { icon: 'report', label: '日报生成' },
      { icon: 'clock', label: '定时推送' },
      { icon: 'users', label: '按部门订阅' },
      { icon: 'chart', label: '使用洞察' },
    ],
    permissions: ['读取知识库内容', '读取使用统计数据', '向指定渠道推送消息'],
    scope: '默认空间（全部知识）',
    steps: DEFAULT_STEPS,
    publisher: '企业知识库官方',
    version: 'v1.0.2',
  },
  {
    id: 'feishu-doc',
    category: '办公门户',
    usage: '在飞书文档中一键引用知识库内容，保持内容同步与溯源',
    scenes: [
      { icon: 'doc', label: '文档引用' },
      { icon: 'sync', label: '内容同步' },
      { icon: 'link', label: '溯源链接' },
      { icon: 'panel', label: '文档侧边栏' },
    ],
    permissions: ['读取知识库内容', '读取飞书文档内容', '在飞书文档中插入内容'],
    scope: '默认空间（全部知识）',
    steps: DEFAULT_STEPS,
    publisher: '企业知识库官方',
    version: 'v1.1.0',
  },
  {
    id: 'sso',
    category: '集成与安全',
    usage: '使用企业 SSO 快速登录知识库与已安装应用',
    scenes: [
      { icon: 'key', label: '统一登录' },
      { icon: 'shield', label: '安全认证' },
      { icon: 'users', label: '成员同步' },
      { icon: 'sync', label: '权限同步' },
    ],
    permissions: ['读取企业组织架构', '读取成员账号信息', '执行单点登录认证'],
    scope: '不涉及知识内容',
    steps: DEFAULT_STEPS,
    publisher: '企业知识库官方',
    version: 'v1.3.5',
  },
]

/** 「暂不安装」可选原因（SKIPPED_WITH_REASON 必填） */
export const SKIP_REASONS = ['当前不使用这些平台', '暂无管理员权限', '只想先用 Web Portal', '稍后评估', '其他']

/** 应用设置 Drawer · 知识范围可选空间（与安装流程第 2 步同口径） */
export const SPACE_OPTIONS = ['默认空间（全部知识）', '销售知识空间', '产品知识空间', '客服知识空间'] as const

/** 应用设置 Drawer · 通知与推送开关组 */
export const NOTIFY_OPTIONS = [
  { key: 'push', label: '消息推送', note: '渠道内收到新回答或更新时推送通知' },
  { key: 'digest', label: '每日摘要', note: '每天 09:00 汇总前一日问答与使用数据' },
  { key: 'alert', label: '异常告警', note: '授权异常、调用失败等事件实时告警' },
] as const

/** 应用设置 Drawer 状态（按 appId 存） */
export interface AppSettings {
  scope: string[]
  notify: Record<string, boolean>
  authExpiry: string
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  scope: ['默认空间（全部知识）'],
  notify: { push: true, digest: false, alert: true },
  authExpiry: '2024-09-15',
}

/** 「了解更多 →」应用文档 Drawer 内容（mock 图文） */
export interface AppDocSection {
  heading: string
  body: string
}

export const APP_DOCS: Record<string, { title: string; intro: string; sections: AppDocSection[] }> = {
  default: {
    title: '应用接入指南',
    intro: '本文档介绍应用的安装、配置与常见问题，帮助你快速在企业渠道内启用可信回答。',
    sections: [
      { heading: '功能概述', body: '应用将企业知识库的检索与回答能力嵌入对应渠道，员工无需切换系统即可提问，答案自动附引用来源。' },
      { heading: '安装与授权', body: '通过 4 步安装流程完成权限确认、范围选择与平台授权；授权有效期 180 天，到期前 14 天自动提醒管理员。' },
      { heading: '权限与数据安全', body: '应用仅读取你勾选的知识空间，完整继承企业权限体系；所有问答记录写入审计日志，可随时导出。' },
      { heading: '常见问题', body: 'Q：为什么部分问题被拒答？A：命中阈值以下或超出知识范围的问题会按缺失知识拒答，可在反馈中心查看并补充知识。' },
    ],
  },
  'custom-api': {
    title: '自定义 API 接入文档',
    intro: '通过 OpenAPI 将可信回答能力接入你的自有系统，支持密钥鉴权、字段映射与调用统计。',
    sections: [
      { heading: '接入流程', body: '创建 API Key → 配置 OpenAPI Endpoint 与鉴权方式 → 按字段映射对接业务系统 → 通过测试连接验证链路。' },
      { heading: '鉴权方式', body: '支持 API Key（Header 携带）与 OAuth 2.0 两种方式；密钥仅创建时展示一次，请妥善保管，泄露后请立即重新生成。' },
      { heading: '字段映射', body: '将知识库返回的 answer / citations / trustScore 字段映射到业务系统字段，支持自定义字段名与默认值。' },
      { heading: '限流与配额', body: '默认 60 次/分钟，月度配额与套餐 AI 问答额度共享；超限返回 429，建议指数退避重试。' },
    ],
  },
}

/** custom-api 应用专属：OpenAPI 配置 mock */
export const CUSTOM_API_CONFIG = {
  endpoint: 'https://api.example.com/v1/kb/ask',
  version: 'OpenAPI 3.0 · v2.0.1',
  authMethod: 'API Key（Authorization: Bearer）',
  fieldMappings: [
    { from: 'answer', to: 'reply_text', note: '答案正文' },
    { from: 'citations', to: 'sources', note: '引用列表' },
    { from: 'trustScore', to: 'confidence', note: '可信分' },
  ],
  /** 近 14 天调用趋势（与 API 与开发页口径一致） */
  trend14d: [62, 75, 81, 69, 91, 102, 88, 96, 111, 99, 124, 108, 115, 120],
}

/** 安装测试阶段子步骤 */
export const INSTALL_TEST_STEPS = ['安装应用', '绑定渠道', '发送测试问题', '验证答案与引用']

/** 权限确认四组（安装 Modal 第 1 步） */
export const PERMISSION_GROUPS: { title: string; items: string[] }[] = [
  { title: '外部平台权限', items: ['在飞书中发送消息', '读取会话基本信息'] },
  { title: '产品内部权限', items: ['读取知识库内容', '记录使用日志'] },
  { title: '知识范围', items: ['默认空间（全部知识）'] },
  { title: '用户和部门范围', items: ['销售团队、售前团队（默认）'] },
]
