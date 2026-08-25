/**
 * API 与开发页数据（design/api-dev.md §5 + design.md V1.1-§10）
 * 用量口径与 integrations 页「自定义 API · 本月调用」一致（P1-1：统一引用 METRICS.apiMonthlyCalls）。
 */
import { METRICS } from '@/mocks'

export interface ApiKey {
  id: string
  name: string
  maskedKey: string
  fullKey: string
  permissions: string[]
  createdAt: string
  createdBy: string
  lastCallAt: string
  status: '生效中' | '已吊销'
}

export const initialApiKeys: ApiKey[] = [
  {
    id: 'key-live',
    name: '生产环境主 Key',
    maskedKey: 'sk-live-••••••3f9a',
    fullKey: 'sk-live-9f27ab41cd52e6037h18k3f9a',
    permissions: ['检索问答', '文档读取'],
    createdAt: '2024-04-12',
    createdBy: '张伟',
    lastCallAt: '今天 10:26',
    status: '生效中',
  },
  {
    id: 'key-test',
    name: '测试环境 Key',
    maskedKey: 'sk-test-••••••8c2d',
    fullKey: 'sk-test-5b13de77fa90c2214m66p8c2d',
    permissions: ['检索问答'],
    createdAt: '2024-05-20',
    createdBy: '陈晨',
    lastCallAt: '昨天 16:40',
    status: '生效中',
  },
]

export const API_PERMISSION_OPTIONS = ['检索问答', '文档读取', '反馈写入', '分析数据只读'] as const
export const API_EXPIRY_OPTIONS = ['90 天', '180 天', '365 天', '自定义'] as const

/** 调用用量（METRICS.apiMonthlyCalls / 5,000 ≈ 25%，与套餐 AI 问答额度同口径） */
export const apiUsage = {
  month: METRICS.apiMonthlyCalls,
  limit: 5000,
  pct: 25,
  byKey: [
    { name: '生产环境主 Key', count: 1086 },
    { name: '测试环境 Key', count: 154 },
  ],
  /** 近 14 天调用趋势（峰值 124） */
  trend14d: [62, 75, 81, 69, 91, 102, 88, 96, 111, 99, 124, 108, 115, 120],
}

export interface WebhookEvent {
  key: string
  name: string
  desc: string
  subscribed: boolean
  lastTrigger: string
}

export const initialWebhookEvents: WebhookEvent[] = [
  { key: 'feedback', name: '新反馈', desc: '用户提交答案反馈时推送', subscribed: true, lastTrigger: '今天 09:48' },
  { key: 'noAnswer', name: '无答案告警', desc: '出现无法可靠回答的问题时推送', subscribed: true, lastTrigger: '今天 09:20' },
  { key: 'docExpired', name: '文档过期', desc: '知识到达失效日期时推送', subscribed: true, lastTrigger: '05-27 08:00' },
  { key: 'taskOverdue', name: '治理任务超期', desc: '任务超过截止时间未处理时推送', subscribed: false, lastTrigger: '未触发' },
]

export const webhookConfig = {
  url: 'https://api.example.com/webhooks/kb',
  secret: 'whsec_••••••7e21',
}

/** 快速开始代码块 */
export const quickStartCurl = `curl -X POST https://api.example.com/v1/kb/ask \\
  -H "Authorization: Bearer sk-live-••••3f9a" \\
  -d '{"question":"差旅报销标准是什么？","space":"全部知识"}'`

export const quickStartResponse = '{"answer":"…","trustScore":92,"citations":[3]}'

export const quickStartPython = `from openai import OpenAI

client = OpenAI(base_url="https://api.example.com/v1",
                api_key="sk-live-••••3f9a")
# 模型名填助手 ID，答案自动携带企业引用
resp = client.chat.completions.create(
    model="assistant-enterprise-kb",
    messages=[{"role": "user", "content": "差旅报销标准是什么？"}],
)`

/** Widget 嵌入生成器 */
export const WIDGET_SPACES = [
  { label: '全部知识', value: 'all' },
  { label: '制度与流程', value: 'policies' },
  { label: '产品资料', value: 'product' },
  { label: '销售弹药库', value: 'sales' },
] as const

export const WIDGET_ASSISTANTS = ['企业知识助手', '销售知识助手'] as const

export interface WidgetConfig {
  space: string
  assistant: string
  theme: 'light' | 'dark'
  quickQuestions: string[]
  showFullCitations: boolean
}

export const initialWidgetConfig: WidgetConfig = {
  space: 'all',
  assistant: '企业知识助手',
  theme: 'light',
  quickQuestions: ['报销标准', '请假流程', '产品介绍'],
  showFullCitations: true,
}

export function buildWidgetSnippet(cfg: WidgetConfig): string {
  return `<script src="https://cdn.example.com/widget.js"
  data-kb="kb-abc123" data-space="${cfg.space}" data-theme="${cfg.theme}"
  data-citations="${cfg.showFullCitations ? 'full' : 'none'}" async></script>`
}

/** Key 维度用量（查看用量 Drawer：近 14 天趋势 + 端点分布） */
export const keyUsage: Record<string, { trend14d: number[]; endpoints: { path: string; count: number }[] }> = {
  'key-live': {
    trend14d: [52, 63, 70, 58, 78, 88, 74, 81, 95, 84, 106, 92, 98, 102],
    endpoints: [
      { path: 'POST /v1/kb/ask', count: 812 },
      { path: 'GET /v1/docs/:id', count: 196 },
      { path: 'POST /v1/feedback', count: 78 },
    ],
  },
  'key-test': {
    trend14d: [10, 12, 11, 11, 13, 14, 14, 15, 16, 15, 18, 16, 17, 18],
    endpoints: [
      { path: 'POST /v1/kb/ask', count: 121 },
      { path: 'GET /v1/docs/:id', count: 33 },
    ],
  },
}

/** 端点分布兜底（新建 Key 尚无调用） */
export const EMPTY_KEY_USAGE = {
  trend14d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  endpoints: [] as { path: string; count: number }[],
}

/** 开发文档 Drawer（目录 + 章节 mock，锚点切换） */
export interface ApiDocSection {
  id: string
  title: string
  body: string[]
}

export const API_DOC_SECTIONS: ApiDocSection[] = [
  {
    id: 'intro',
    title: '1. 接入概述',
    body: [
      '企业知识库 OpenAPI 提供检索问答、文档读取、反馈写入与分析数据四类能力，所有答案自动携带引用来源与可信分。',
      'Base URL：https://api.example.com/v1，所有请求需携带 Authorization: Bearer <API Key>。',
    ],
  },
  {
    id: 'auth',
    title: '2. 鉴权与密钥',
    body: [
      '每个 API Key 独立权限范围与配额，完整 Key 仅创建时展示一次，请妥善保管。',
      '密钥泄露时请立即在控制台吊销并新建；「显示完整 Key」操作会记入审计日志。',
    ],
  },
  {
    id: 'ask',
    title: '3. 检索问答 API',
    body: [
      'POST /v1/kb/ask，请求体：{"question": string, "space"?: string}。',
      '响应：{"answer": string, "trustScore": number, "citations": Array}；trustScore ≥ 90 为绿档可信，低于阈值按缺失知识拒答。',
    ],
  },
  {
    id: 'rate',
    title: '4. 限流与错误码',
    body: [
      '默认限流 60 次/分钟，月度配额与套餐 AI 问答额度共享（当前 5,000 次/月）。',
      '401 密钥无效或已吊销；429 触发限流，建议指数退避重试；503 渠道降级中，请稍后重试。',
    ],
  },
]

/** 自定义 API 应用（与应用中心 custom-api 双向打通） */
export interface CustomApiApp {
  id: string
  name: string
  openApiUrl: string
  authMethod: string
  description: string
  maskedSecret: string
  status: '启用' | '停用'
  createdAt: string
  trend14d: number[]
}

export const CUSTOM_API_AUTH_OPTIONS = ['API Key（Header）', 'OAuth 2.0', 'Basic Auth'] as const

export const initialCustomApis: CustomApiApp[] = [
  {
    id: 'capi-crm',
    name: 'CRM 客户助手',
    openApiUrl: 'https://api.example.com/v1/kb/ask',
    authMethod: 'API Key（Header）',
    description: '在 CRM 客户详情页内嵌知识问答，销售可直接查询报价与交付政策。',
    maskedSecret: 'sk-capi-••••••2b7f',
    status: '启用',
    createdAt: '2024-04-28',
    trend14d: [32, 41, 38, 45, 52, 48, 55, 61, 58, 66, 72, 69, 75, 78],
  },
]
