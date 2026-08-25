/**
 * AI 助手页扩展模拟数据（ai-assistant.md §4）
 * 跨页共享对象（answer/docs 92% 答案）直接引用 @/mocks/base.mock，数字保持一致。
 */
import { answer as baseAnswer } from '@/mocks'

// ---------- 助手 ----------

export type AssistantStatus = '已发布' | '试用中' | '草稿'

export interface AssistantItem {
  id: string
  icon: string
  name: string
  status: AssistantStatus
  desc: string
  audience: string
  scope: string
  version: string
  welcome: string
  suggested: string[]
  principles: string[]
  /** 配置抽屉持久化的多选原始值（重开抽屉时回读） */
  knowledge?: string[]
  audienceList?: string[]
}

/** 配置抽屉「使用哪些知识」可选项 */
export const KNOWLEDGE_OPTIONS = ['产品资料', '销售政策', '客户案例', '制度流程', 'FAQ']

/** 配置抽屉保存/发布回写的值 */
export interface AssistantConfigValues {
  name: string
  desc: string
  knowledge: string[]
  audience: string[]
  principles: string[]
  welcome: string
  suggested: string[]
}

export const assistants: AssistantItem[] = [
  {
    id: 'asst-kb',
    icon: '🤖',
    name: '企业知识助手',
    status: '已发布',
    desc: '全员 · 全部知识空间 · v1.2',
    audience: '全员',
    scope: '全部知识空间',
    version: 'v1.2',
    welcome: '你好，我是企业知识助手。你可以问我任何关于产品、报价与制度的问题，每个答案都会附来源。',
    suggested: ['差旅报销标准是什么？', '报价折扣超过 10% 需要谁审批？', '产品 X 支持哪些部署方式？'],
    principles: ['只回答有出处的内容', '找不到时明确告知', '不猜测价格与承诺'],
  },
  {
    id: 'asst-sales',
    icon: '💼',
    name: '销售问答助手',
    status: '试用中',
    desc: '销售+售前 · 产品与报价知识 · v0.9',
    audience: '销售+售前',
    scope: '产品与报价知识',
    version: 'v0.9',
    welcome: '你好，我是销售问答助手，专注产品、报价与销售政策问题，答案均附引用来源。',
    suggested: ['报价折扣超过 10% 需要谁审批？', '产品 X 的核心优势是什么？', '如何申请特价审批？'],
    principles: ['只回答有出处的内容', '找不到时明确告知', '不猜测价格与承诺'],
  },
  {
    id: 'asst-it',
    icon: '🛠',
    name: 'IT-SOP 助手（草稿）',
    status: '草稿',
    desc: '未发布，3 天前编辑',
    audience: 'IT 团队',
    scope: 'IT-SOP 空间',
    version: 'v0.1',
    welcome: '你好，我是 IT-SOP 助手。',
    suggested: ['VPN 如何申请？', '邮箱容量上限是多少？'],
    principles: ['只回答有出处的内容', '找不到时明确告知', '不猜测价格与承诺'],
  },
]

export interface AssistantTemplate {
  key: string
  name: string
  audience: string
  scope: string
  desc: string
}

export const assistantTemplates: AssistantTemplate[] = [
  { key: 'sales', name: '销售助手', audience: '销售与售前团队', scope: '产品资料 / 销售政策 / 客户案例', desc: '面向销售场景的产品、报价与政策问答' },
  { key: 'cs', name: '客服助手', audience: '客服团队', scope: 'FAQ / 售后服务 / 制度流程', desc: '面向客服售后的标准话术与流程问答' },
  { key: 'employee', name: '员工助手', audience: '全体员工', scope: '制度流程 / FAQ', desc: '面向全员的人事、行政与 IT 制度问答' },
  { key: 'it-sop', name: 'IT-SOP 助手', audience: 'IT 团队', scope: 'IT-SOP 空间', desc: '面向运维与支持的标准操作流程问答' },
  { key: 'blank', name: '空白助手', audience: '自定义', scope: '自定义', desc: '从零开始配置助手名称、范围与原则' },
]

// ---------- 引用 ----------

export interface CitationData {
  name: string
  version: string
  page: string
  primary?: boolean
  excerpt: string
  owner: string
  updatedAt: string
  validity: '有效' | '即将过期' | '已过期'
}

// ---------- 预置问答脚本 ----------

export interface ScriptedAnswer {
  conclusion: string
  trust: number
  trustNote: string
  points: string[]
  citations: CitationData[]
}

export interface RefusalData {
  title: string
  reason: string
  searchedScope: string
  missingType: string
  closestTopic: string
  closestMeta: string
}

export const ANSWER_DISCOUNT: ScriptedAnswer = {
  conclusion: baseAnswer.conclusion, // 「需要销售总监审批。」92% 绿档
  trust: baseAnswer.trust,
  trustNote: '引用覆盖率 100% · 幻觉风险低',
  points: [
    '报价折扣超过 10%（含）时，须由销售总监书面审批后方可对外承诺。',
    '折扣超过 20% 时，需升级至总经理审批，并抄送财务备案。',
    '所有审批记录需在 CRM 中归档，未归档订单不得开票。',
  ],
  citations: baseAnswer.docs.map((d, i) => ({
    name: d.name,
    version: d.version,
    page: d.page,
    primary: d.tag === '主要依据',
    excerpt:
      i === 0
        ? '第 8.2 条：销售报价折扣超过 10% 的订单，必须由销售总监审批；超过 20% 的，须报总经理审批。'
        : i === 1
          ? '第 5.1 条：特殊价格政策须按审批权限矩阵执行，审批通过后价格方可生效。'
          : '审批权限矩阵：销售总监 — 折扣 10%–20%；总经理 — 折扣 20% 以上。',
    owner: i === 2 ? '李娜' : '张伟',
    updatedAt: i === 0 ? '2025-04-18' : i === 1 ? '2025-03-02' : '2025-01-15',
    validity: '有效',
  })),
}

export const ANSWER_PRIVATE_DEPLOY: ScriptedAnswer = {
  conclusion: '支持，提供两种私有化形态。',
  trust: 78,
  trustNote: '建议与销售核对最新方案',
  points: [
    '专属实例部署：独立云实例，数据与企业内网隔离。',
    '全本地化部署：部署在企业自有机房，需 Enterprise 套餐。',
    '两种形态均保证数据不出企业内网。',
  ],
  citations: [
    {
      name: '《产品 X 白皮书》',
      version: 'v1.5',
      page: '第 12 页',
      primary: true,
      excerpt: '产品 X 支持专属实例与全本地化两种私有化部署形态，全本地化部署需开通 Enterprise 套餐。',
      owner: '张伟',
      updatedAt: '2025-11-08',
      validity: '有效',
    },
    {
      name: '《私有化部署方案》',
      version: 'v1.0',
      page: '第 3 页',
      excerpt: '私有化部署交付周期约 4–6 周，需客户提供符合要求的机房或专有云环境。',
      owner: '李娜',
      updatedAt: '2025-09-21',
      validity: '有效',
    },
  ],
}

export const ANSWER_TRAVEL: ScriptedAnswer = {
  conclusion: '差旅报销按城市等级分档执行。',
  trust: 88,
  trustNote: '引用覆盖率 96% · 幻觉风险低',
  points: [
    '一线城市住宿标准 500 元/晚，二线城市 400 元/晚，其他城市 320 元/晚。',
    '交通实报实销，高铁二等座、飞机经济舱为标准舱位。',
    '出差补贴 100 元/天，随差旅报销单一并提交。',
  ],
  citations: [
    {
      name: '《差旅费用报销管理办法》',
      version: 'v3.2',
      page: '第 4 页',
      primary: true,
      excerpt: '住宿标准：一线城市 500 元/晚，二线城市 400 元/晚，其他城市 320 元/晚；出差补贴 100 元/天。',
      owner: '王强',
      updatedAt: '2025-02-11',
      validity: '有效',
    },
    {
      name: '《财务报销操作指引》',
      version: 'v1.8',
      page: '第 2 页',
      excerpt: '差旅报销需在出差结束后 15 个工作日内提交，附行程单与发票。',
      owner: '王强',
      updatedAt: '2025-05-30',
      validity: '有效',
    },
  ],
}

export const ANSWER_DEPLOY_MODES: ScriptedAnswer = {
  conclusion: '产品 X 支持 SaaS 云、专属实例与全本地化三种部署方式。',
  trust: 91,
  trustNote: '引用覆盖率 100% · 幻觉风险低',
  points: [
    'SaaS 云：默认形态，开箱即用，按席位订阅。',
    '专属实例：独立资源隔离，适合中大型企业。',
    '全本地化：部署在客户机房，需 Enterprise 套餐。',
  ],
  citations: [
    {
      name: '《产品 X 白皮书》',
      version: 'v1.5',
      page: '第 12 页',
      primary: true,
      excerpt: '产品 X 提供 SaaS 云、专属实例与全本地化三种部署形态，满足不同规模企业的合规要求。',
      owner: '张伟',
      updatedAt: '2025-11-08',
      validity: '有效',
    },
    {
      name: '《私有化部署方案》',
      version: 'v1.0',
      page: '第 3 页',
      excerpt: '专属实例与全本地化部署均支持离线 license 与内网升级通道。',
      owner: '李娜',
      updatedAt: '2025-09-21',
      validity: '有效',
    },
  ],
}

export const ANSWER_API: ScriptedAnswer = {
  conclusion: '通过 OpenAPI 与 Webhook 两种方式集成。',
  trust: 90,
  trustNote: '引用覆盖率 98% · 幻觉风险低',
  points: [
    'OpenAPI：REST 风格，支持问答、文档检索与反馈回写。',
    'Webhook：支持文档解析完成、知识发布等 6 类事件推送。',
    'API 调用需在设置中心创建 API Key，默认 5,000 次/月。',
  ],
  citations: [
    {
      name: '《API 接入指南》',
      version: 'v2.0',
      page: '第 6 页',
      primary: true,
      excerpt: '开放平台提供 OpenAPI 与 Webhook 两种集成方式，API Key 在设置中心申请，默认额度 5,000 次/月。',
      owner: '王强',
      updatedAt: '2025-04-25',
      validity: '有效',
    },
  ],
}

export const REFUSAL_PRICING: RefusalData = {
  title: '没有找到足够可靠的企业知识，我暂时不回答这个问题。',
  reason: '私有化报价文档未收录或已过期',
  searchedScope: '已检索：默认空间、产品资料、销售弹药库等 5 个空间，共 128 份文档',
  missingType: '缺失类型：报价/商务政策类文档',
  closestTopic: '《产品 X 白皮书》价格章节',
  closestMeta: 'v1.5 · 2025-11 更新',
}

export const REFUSAL_GENERIC: RefusalData = {
  title: '没有找到足够可靠的企业知识，我暂时不回答这个问题。',
  reason: '相关知识未收录或已有内容可信度不足',
  searchedScope: '已检索：默认空间、产品资料、销售弹药库等 5 个空间，共 128 份文档',
  missingType: '缺失类型：与该问题直接相关的制度/方案文档',
  closestTopic: '《产品 X 白皮书》',
  closestMeta: 'v1.5 · 2025-11 更新',
}

/** 预置问题命中脚本：返回答案（92% 绿档 / 78% 黄档）或拒答卡 */
export function matchScript(text: string): { answer?: ScriptedAnswer; refusal?: RefusalData } {
  const t = text.trim()
  if (t.includes('折扣') || (t.includes('审批') && t.includes('报价'))) return { answer: ANSWER_DISCOUNT }
  if (t.includes('私有化') && (t.includes('报价') || t.includes('价格') || t.includes('多少钱') || t.includes('费用')))
    return { refusal: REFUSAL_PRICING }
  if (t.includes('私有化')) return { answer: ANSWER_PRIVATE_DEPLOY }
  if (t.includes('部署')) return { answer: ANSWER_DEPLOY_MODES }
  if (t.includes('差旅') || t.includes('报销')) return { answer: ANSWER_TRAVEL }
  if (t.toLowerCase().includes('api') || t.includes('集成')) return { answer: ANSWER_API }
  return { refusal: REFUSAL_GENERIC }
}

// ---------- 对话历史 ----------

export interface ConversationItem {
  id: string
  title: string
  assistant: string
  time: string
}

export const conversations: ConversationItem[] = [
  { id: 'cv-1', title: '报价折扣超过 10% 需要谁审批？', assistant: '企业知识助手', time: '今天 10:41' },
  { id: 'cv-2', title: '我们支持私有化部署吗？', assistant: '企业知识助手', time: '今天 09:58' },
  { id: 'cv-3', title: '差旅报销标准是什么？', assistant: '企业知识助手', time: '昨天 17:22' },
  { id: 'cv-4', title: '产品 X 的核心优势有哪些？', assistant: '销售问答助手', time: '昨天 15:40' },
  { id: 'cv-5', title: '请假审批需要几天？', assistant: '企业知识助手', time: '06-01 11:20' },
  { id: 'cv-6', title: '如何集成你们的 API？', assistant: '企业知识助手', time: '05-31 16:05' },
]

// ---------- 反馈原因 8 项 ----------

export const FEEDBACK_REASONS = [
  '没有引用来源',
  '引用来源错误',
  '使用了旧版本',
  '内容不完整',
  '答非所问',
  '与制度冲突',
  '表述不清晰',
  '其他',
]

// ---------- 就绪检查 6 项 ----------

export interface ReadinessItem {
  item: string
  result: 'PASS' | 'WARN' | 'BLOCK'
  detail: string
}

// ---------- 评测中心 ----------

export interface EvalQuestion {
  id: string
  question: string
  expected: string
  /** 本次运行是否通过（mock 确定性结果） */
  passed: boolean
  /** 单题得分 0–100 */
  score: number
  /** 未通过原因（仅 failed 展示） */
  failNote?: string
}

export const EVAL_SET: EvalQuestion[] = [
  { id: 'ev-1', question: '差旅报销标准是什么？', expected: '按城市等级分档：一线 500/二线 400/其他 320 元/晚', passed: true, score: 95 },
  { id: 'ev-2', question: '报价折扣超过 10% 需要谁审批？', expected: '销售总监审批，超 20% 升级总经理', passed: true, score: 92 },
  { id: 'ev-3', question: '我们支持私有化部署吗？', expected: '支持专属实例与全本地化两种形态', passed: true, score: 88 },
  { id: 'ev-4', question: '请假审批需要几天？', expected: '3 天以内直属上级审批，3 天以上需部门负责人审批', passed: true, score: 90 },
  { id: 'ev-5', question: '私有化部署的报价是多少？', expected: '引用最新报价文档给出区间，不确定时拒答', passed: false, score: 42, failNote: '报价文档未收录，模型推测了数字' },
  { id: 'ev-6', question: '如何集成你们的 API？', expected: 'OpenAPI + Webhook 两种方式，附接入指南引用', passed: true, score: 91 },
  { id: 'ev-7', question: '产品 X 支持哪些部署方式？', expected: 'SaaS 云 / 专属实例 / 全本地化三种', passed: true, score: 93 },
  { id: 'ev-8', question: '出差补贴是多少？', expected: '100 元/天，随差旅报销单提交', passed: true, score: 89 },
  { id: 'ev-9', question: '去年的差旅标准还能用吗？', expected: '应引用 v3.2 最新版本并说明旧版已废止', passed: false, score: 55, failNote: '引用了已废止的 v2.0 旧版本' },
]

export const readinessChecks: ReadinessItem[] = [
  { item: '知识范围', result: 'PASS', detail: '已选择 5 个知识空间' },
  { item: '回答测试', result: 'PASS', detail: '20/20 测试问题通过' },
  { item: '引用来源', result: 'WARN', detail: '引用覆盖率 86%，建议 ≥90%' },
  { item: '冲突检测', result: 'PASS', detail: '未发现知识冲突' },
  { item: '权限范围', result: 'PASS', detail: '受众与空间权限一致' },
  { item: '安全策略', result: 'PASS', detail: '敏感词与拒答策略已启用' },
]
