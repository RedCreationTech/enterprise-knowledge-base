/**
 * 全局模拟数据基准（design.md §10 逐字落地）
 * 数字一致性唯一来源：各页面只允许引用本文件 + 本页扩展 mock。
 */

export interface Org {
  name: string
  industry: string
  plan: 'TRIAL' | 'PRO'
}

export const org: Org = {
  name: '示例科技有限公司',
  industry: '软件与信息技术服务',
  plan: 'TRIAL',
}

/**
 * 演示基准日「今天」：全站时间唯一来源（P1-3）。
 * 近 7 天趋势标签、{当前日期} 变量、新建实体的 createdAt/updatedAt 一律由它派生，
 * 消灭「2024/2025/真实 Date()」多时间宇宙。
 */
export const TODAY = '2026-05-29'

/** 由 TODAY 回溯生成近 7 天日期标签（含今日）；fmt 控制 '5/23'（M/D）或 '05-23'（MM-DD） */
export function trend7dLabels(fmt: 'M/D' | 'MM-DD' = 'MM-DD'): string[] {
  const base = new Date(`${TODAY}T00:00:00`)
  const pad = (n: number) => String(n).padStart(2, '0')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() - (6 - i))
    return fmt === 'MM-DD' ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : `${d.getMonth() + 1}/${d.getDate()}`
  })
}

/** 「近 7 天」区间文案（如 5/23–5/29） */
export function trend7dRangeLabel(): string {
  const labels = trend7dLabels('M/D')
  return `${labels[0]}–${labels[labels.length - 1]}`
}

/** TODAY 所在月份（演示基准日 2026-05-29 → 5），近 30 天趋势标签的月份由它派生 */
export function trendMonth(): number {
  return Number(TODAY.slice(5, 7))
}

/**
 * 全站口径字典（P1-1：数字一致性唯一事实来源）。
 * 各页面展示数字必须引用本常量，或引用由它派生的既有常量（assets/sources/daily/plan/site 等）。
 */
export const METRICS = {
  /** 已接入资料（接入/连接器口径）：1,286 = 企业网盘 862 + 飞书文档 318 + 本地上传 106 */
  connectedDocs: { total: 1286, netdisk: 862, feishu: 318, localUpload: 106 },
  /** 知识库收录文档 */
  kbDocs: 128,
  /** 已识别章节 */
  chapters: 4352,
  /** 可问答知识 */
  qaItems: 12648,
  /** 累计问答（近 30 天口径） */
  totalQuestions: 1240,
  /** 自定义 API 本月调用（与「累计问答」totalQuestions 分属不同口径，勿共用同一数字） */
  apiMonthlyCalls: 1240,
  /** 近 7 天问答 */
  questions7d: 328,
  /** 近 7 天逐日问答（5/23–5/29，合计恰好 328） */
  questions7dDaily: [32, 41, 44, 48, 52, 55, 56],
  /** 近 7 天逐日成功回答（合计 299 ≈ 成功回答率 91.2%） */
  answered7dDaily: [29, 37, 40, 44, 47, 51, 51],
  /** 答案认可率 %（全站统一） */
  approvalRate: 87.6,
  /** 成功回答率 %（近 7 天，非拒答比例，≥ 认可率） */
  answerRate7d: 91.2,
  /** 近 7 天无答案率 %（= pendingIssues 23 / questions7d 328 ≈ 7.0%） */
  noAnswerRate7d: 7.0,
  /** 待处理知识问题 */
  pendingIssues: 23,
  /** 近 7 天认可反馈条数（答案认可率卡「来自 N 条反馈」） */
  feedback7d: 96,
  /** 近 7 天活跃用户 / 席位（9 / 12） */
  activeUsers7d: 9,
  /** 今日问答 */
  questionsToday: 108,
  /** 今日成功回答率 % */
  answerRateToday: 88.0,
  /** 今日无答案率 % */
  noAnswerRateToday: 6.5,
  /** 今日无答案问题数 */
  pendingIssuesToday: 7,
  /** 今日答案认可率 % */
  approvalRateToday: 83.0,
  /** 今日认可反馈条数 */
  feedbackToday: 14,
  /** 今日活跃用户 / 席位 */
  activeUsersToday: 7,
  /** 近 30 天成功回答率 % */
  answerRate30d: 85.9,
  /** 近 30 天无答案率 % */
  noAnswerRate30d: 7.8,
  /** 近 30 天无答案问题数 */
  pendingIssues30d: 97,
  /** 近 30 天答案认可率 % */
  approvalRate30d: 81.2,
  /** 近 30 天认可反馈条数 */
  feedback30d: 356,
  /** 近 30 天活跃用户 / 席位 */
  activeUsers30d: 11,
  /** 已安装应用（企业微信 / SSO 单点登录 / 自定义 API） */
  installedApps: 3,
  /** 可试用应用（含飞书问答插件） */
  trialApps: 5,
  /** 组织总人数（ACL 同步基数） */
  orgSize: 428,
  /** ACL 覆盖人数（402/428 ≈ 94%） */
  aclCovered: 402,
  /** 身份映射：400/402，待映射 2 人 */
  identityMapped: 400,
  identityTotal: 402,
  /** 已激活试用成员 / 试用席位上限 */
  activatedMembers: 12,
  seatLimit: 20,
  /** 邀请名册候选人数（默认勾选 25 人） */
  inviteRoster: 39,
  /** 知识空间数 */
  spaces: 5,
  /** 试用时长（天） */
  trialDays: 7,
} as const

export interface Me {
  name: string
  avatar: string
  role: 'org_admin' | 'member'
  phone: string
  email: string
}

export const me: Me = {
  name: '张伟',
  avatar: '张',
  role: 'org_admin',
  phone: '138 0000 0000',
  email: 'zhangwei@example.com',
}

/** 试用旅程状态基准（Stepper / 守卫驱动，动态部分见 store.tsx 的 journey） */
export interface JourneyBase {
  currentStep: number
  trialDays: number
  trialDayNow: number
  configProgress: number
  etaMinutes: number
}

export const journeyBase: JourneyBase = {
  currentStep: 3, // 邀请同事
  trialDays: 7,
  trialDayNow: 5,
  configProgress: 75,
  etaMinutes: 3,
}

export type SourceStatus = '已连接' | '未连接' | '同步中' | '已导入'

export interface KnowledgeSource {
  name: string
  status: SourceStatus
  count: number
  updatedAt: string
}

export const sources: KnowledgeSource[] = [
  { name: '企业网盘', status: '已连接', count: METRICS.connectedDocs.netdisk, updatedAt: '2024-05-16 10:20' },
  { name: '飞书文档', status: '已连接', count: METRICS.connectedDocs.feishu, updatedAt: '2024-05-16 09:45' },
  { name: '本地上传', status: '已导入', count: METRICS.connectedDocs.localUpload, updatedAt: '2024-05-15 18:32' },
]

export interface KnowledgeAssets {
  docs: number
  chapters: number
  qaItems: number
  coveredUsers: number
}

export const assets: KnowledgeAssets = {
  docs: METRICS.connectedDocs.total,
  chapters: METRICS.chapters,
  qaItems: METRICS.qaItems,
  coveredUsers: METRICS.orgSize,
}

export interface Connector {
  name: string
  connected: boolean
}

export const connectors: Connector[] = [
  { name: '企业网盘', connected: true },
  { name: '飞书文档', connected: true },
  { name: '钉钉文档', connected: false },
  { name: '企业微信', connected: false },
]

export interface AclSync {
  policy: string
  access: string
  lastSyncAt: string
}

export const aclSync: AclSync = {
  policy: '按组织架构 + 空间权限同步',
  access: '仅成员可见（默认）',
  lastSyncAt: '2024-05-15 18:20',
}

export interface AnswerDoc {
  name: string
  version: string
  page: string
  tag: '' | '主要依据'
}

export interface TrustedAnswer {
  question: string
  conclusion: string
  trust: number
  coverage: number
  hallucinationRisk: '低' | '中' | '高'
  citations: number
  docs: AnswerDoc[]
}

export const answer: TrustedAnswer = {
  question: '客户报价折扣超过 10% 需要谁审批？',
  conclusion: '需要销售总监审批。',
  trust: 92,
  coverage: 100,
  hallucinationRisk: '低',
  citations: 3,
  docs: [
    { name: '《销售管理制度》', version: 'v2.1', page: '第 8 页', tag: '主要依据' },
    { name: '《价格管理办法》', version: 'v1.3', page: '第 5 页', tag: '' },
    { name: '《审批权限矩阵表》', version: 'v3.0', page: '第 2 页', tag: '' },
  ],
}

export interface Team {
  name: string
  count: number
  selected: boolean
}

export const teams: Team[] = [
  { name: '销售团队', count: 14, selected: true },
  { name: '售前团队', count: 11, selected: true },
  { name: '客服团队', count: 8, selected: false },
  { name: '产品团队', count: 6, selected: false },
]

/** 已选团队人数 = 14 + 11 */
export const invitees = 25

export interface Preflight {
  assistant: string
  audience: string
  scope: string
  score: number
  citationCoverage: number
  period: number
}

export const preflight: Preflight = {
  assistant: '企业知识助手',
  audience: '内部员工',
  scope: '全部知识空间',
  score: 92, // 优秀
  citationCoverage: 78,
  period: 7,
}

export type AppStatus = '可试用' | '已安装' | '需要授权'

export interface AppItem {
  id: string
  name: string
  status: AppStatus
  logo: string
  category: string
  desc: string
}

export const apps: AppItem[] = [
  { id: 'feishu-qa', name: '飞书问答插件', status: '可试用', logo: '/logo-feishu.svg', category: '问答助手', desc: '在飞书对话中直接提问企业知识' },
  { id: 'wecom-qa', name: '企业微信知识助手', status: '已安装', logo: '/logo-wecom.svg', category: '问答助手', desc: '企业微信会话内的可信问答入口' },
  { id: 'webchat', name: '官网客服组件', status: '可试用', logo: '/logo-webchat.svg', category: '客户服务', desc: '嵌入官网的在线客服问答组件' },
  { id: 'dingtalk-bot', name: '钉钉机器人', status: '可试用', logo: '/logo-dingtalk.svg', category: '问答助手', desc: '钉钉群聊中的知识问答机器人' },
  { id: 'custom-api', name: '自定义API', status: '已安装', logo: '/logo-api.svg', category: '开发集成', desc: '通过 API 将可信答案接入自有系统' },
  { id: 'daily-report', name: '知识日报', status: '可试用', logo: '/logo-report.svg', category: '运营分析', desc: '每日推送知识使用与待办摘要' },
  { id: 'feishu-doc', name: '飞书文档插件', status: '可试用', logo: '/logo-doc-plugin.svg', category: '文档协同', desc: '在飞书文档内引用与校验知识' },
  { id: 'sso', name: '单点登录SSO', status: '已安装', logo: '/logo-sso.svg', category: '安全集成', desc: '企业统一身份认证与权限同步' },
]

export interface DailyBase {
  todos: number
  highPriority: number
  pendingFeedback: number
  newQuestions: number
  trialDay: number
  uploaded: number
  questionTotal: number
  members: number
  appsInstalled: string
  usageTotal: number
  trend7d: number[]
}

export const daily: DailyBase = {
  todos: 10,
  highPriority: 4,
  pendingFeedback: 5,
  newQuestions: 12,
  trialDay: 5,
  uploaded: METRICS.kbDocs,
  questionTotal: 156, // 待处理 23
  members: METRICS.activatedMembers,
  appsInstalled: '3', // 企业微信 / SSO / 自定义 API
  usageTotal: METRICS.totalQuestions,
  trend7d: [...METRICS.questions7dDaily], // 5/23–5/29，合计 328
}

export interface KnowledgeSite {
  name: string
  status: '已发布' | '未发布'
  url: string
  access: string
  onlineQA: boolean
  categories: { name: string; count: number }[]
}

export const site: KnowledgeSite = {
  name: '产品与服务知识库',
  status: '已发布',
  url: 'https://kb-abc123.example.com',
  access: '私有预览（仅内部可访问）',
  onlineQA: true,
  // 5 分类合计 = 知识库收录文档 128 篇
  categories: [
    { name: '产品介绍', count: 32 },
    { name: '使用指南', count: 28 },
    { name: '常见问题', count: 40 },
    { name: 'API文档', count: 12 },
    { name: '售后服务', count: 16 },
  ],
}

export interface Plan {
  name: string
  validUntil: string
  storageUsedGB: number
  storageTotalGB: number
  pct: number
}

/** 当前套餐（P1-2：全站统一 TRIAL 口径，与 org.plan 一致） */
export const plan: Plan = {
  name: '试用版',
  validUntil: '2025-06-03',
  storageUsedGB: 0.68,
  storageTotalGB: 1,
  pct: 68,
}

// ---------- P0-2：快速配置场景问题答案池（验证答案页按用户实际选择的问题渲染） ----------

export interface CannedAnswer {
  question: string
  conclusion: string // 一句话结论
  explanation: string // 解释段
  trustScore: number // ≥90 绿 / 70-89 黄 / <70 拒答
  citations: { doc: string; version: string; page: string; role: string }[]
  followUps: { question: string; answer?: Omit<CannedAnswer, 'followUps'> }[] // 无 answer = 未命中 → 拒答
}

/**
 * 覆盖 QuickConfig SCENES 全部 3 场景 × 3 问题。
 * 折扣审批问题保持既有权威口径（92% / 3 条引用 / 结论「需要销售总监审批。」），
 * 直接引用上方 answer 对象，保证跨页数字一致。
 */
export const ANSWER_POOL: Record<string, CannedAnswer> = {
  // ── 场景 1：销售咨询（产品能力/报价/交付） ──
  '客户报价折扣超过 10% 需要谁审批？': {
    question: answer.question,
    conclusion: answer.conclusion,
    explanation: '根据公司制度要求，当客户报价折扣超过 10% 时，需由销售总监审批。',
    trustScore: answer.trust, // 92 绿档
    citations: answer.docs.map((d) => ({ doc: d.name, version: d.version, page: d.page, role: d.tag || '参考依据' })),
    followUps: [
      {
        question: '折扣超过 20% 需要谁审批？',
        answer: {
          question: '折扣超过 20% 需要谁审批？',
          conclusion: '需升级至总经理审批。',
          explanation: '制度规定折扣超过 20% 的报价须报总经理审批，并抄送财务备案后方可对外承诺。',
          trustScore: 91,
          citations: [
            { doc: '《销售管理制度》', version: 'v2.1', page: '第 8 页', role: '主要依据' },
            { doc: '《审批权限矩阵表》', version: 'v3.0', page: '第 2 页', role: '参考依据' },
          ],
        },
      },
      {
        question: '审批一般需要多长时间？',
        answer: {
          question: '审批一般需要多长时间？',
          conclusion: '超额折扣审批应在 2 个工作日内完成。',
          explanation: '《价格管理办法》要求超额折扣的审批在 2 个工作日内完成，并同步至报价系统后价格方可生效。',
          trustScore: 90,
          citations: [{ doc: '《价格管理办法》', version: 'v1.3', page: '第 5 页', role: '主要依据' }],
        },
      },
      { question: '折扣审批有哪些例外情况？' }, // 未命中 → 拒答
    ],
  },
  '产品 X 的核心优势是什么？': {
    question: '产品 X 的核心优势是什么？',
    conclusion: '核心优势是可信回答、权限继承与多平台集成。',
    explanation: '产品 X 以可信检索增强为核心，每个答案均附引用来源；完整继承企业权限体系，并支持与主流办公平台无缝集成。',
    trustScore: 91,
    citations: [
      { doc: '《产品 X 白皮书》', version: 'v1.5', page: '第 3 页', role: '主要依据' },
      { doc: '《客户案例集》', version: 'v2.0', page: '第 6 页', role: '参考依据' },
    ],
    followUps: [
      {
        question: '产品 X 支持哪些部署方式？',
        answer: {
          question: '产品 X 支持哪些部署方式？',
          conclusion: '支持 SaaS 云、专属实例与全本地化三种部署方式。',
          explanation: 'SaaS 云开箱即用；专属实例提供独立资源隔离；全本地化部署在客户机房，需 Enterprise 套餐。',
          trustScore: 91,
          citations: [{ doc: '《产品 X 白皮书》', version: 'v1.5', page: '第 12 页', role: '主要依据' }],
        },
      },
      { question: '产品 X 的私有化报价是多少？' }, // 未命中 → 拒答
    ],
  },
  '标准交付周期是多久？': {
    question: '标准交付周期是多久？',
    conclusion: '标准交付周期为 4–6 周。',
    explanation: '依据《交付服务协议》，标准部署项目自合同生效起 4–6 周完成交付；定制化需求需另行评估并排期确认。',
    trustScore: 90,
    citations: [
      { doc: '《交付服务协议》', version: 'v2.3', page: '第 4 页', role: '主要依据' },
      { doc: '《产品 X 白皮书》', version: 'v1.5', page: '第 15 页', role: '参考依据' },
    ],
    followUps: [
      {
        question: '交付包含哪些服务内容？',
        answer: {
          question: '交付包含哪些服务内容？',
          conclusion: '包含部署实施、管理员培训与上线护航三部分。',
          explanation: '标准交付含环境部署与初始化配置、1 场管理员培训，以及上线后 2 周的护航支持。',
          trustScore: 90,
          citations: [{ doc: '《交付服务协议》', version: 'v2.3', page: '第 6 页', role: '主要依据' }],
        },
      },
      { question: '能否加急交付？' }, // 未命中 → 拒答
    ],
  },
  // ── 场景 2：客服咨询（售后政策/工单） ──
  '退货政策是怎样的？': {
    question: '退货政策是怎样的？',
    conclusion: '支持 7 天无理由退货。',
    explanation: '自签收之日起 7 日内可申请无理由退货，定制类产品除外；退货需保持商品、包装与附件完整。',
    trustScore: 92,
    citations: [
      { doc: '《退货与售后政策》', version: 'v1.6', page: '第 2 页', role: '主要依据' },
      { doc: '《交付服务协议》', version: 'v2.3', page: '第 9 页', role: '参考依据' },
    ],
    followUps: [
      {
        question: '退货运费由谁承担？',
        answer: {
          question: '退货运费由谁承担？',
          conclusion: '质量问题由公司承担，无理由退货由客户承担。',
          explanation: '因产品质量问题产生的退货运费由公司承担；7 天无理由退货的往返运费由客户自行承担。',
          trustScore: 90,
          citations: [{ doc: '《退货与售后政策》', version: 'v1.6', page: '第 3 页', role: '主要依据' }],
        },
      },
      {
        question: '定制产品可以退货吗？',
        answer: {
          question: '定制产品可以退货吗？',
          conclusion: '定制类产品不支持无理由退货。',
          explanation: '按客户指定规格定制的产品不适用 7 天无理由退货；如存在质量问题，仍可按质保条款退换。',
          trustScore: 91,
          citations: [{ doc: '《退货与售后政策》', version: 'v1.6', page: '第 2 页', role: '主要依据' }],
        },
      },
      { question: '退款多久到账？' }, // 未命中 → 拒答
    ],
  },
  '工单响应时限是多久？': {
    question: '工单响应时限是多久？',
    conclusion: '标准工单 4 个工作小时内响应。',
    explanation: '普通工单 4 个工作小时内首次响应，紧急工单 30 分钟内响应；处理进度可在服务门户实时查询。',
    trustScore: 91,
    citations: [
      { doc: '《交付服务协议》', version: 'v2.3', page: '第 7 页', role: '主要依据' },
      { doc: '《退货与售后政策》', version: 'v1.6', page: '第 5 页', role: '参考依据' },
    ],
    followUps: [
      {
        question: '紧急工单如何升级？',
        answer: {
          question: '紧急工单如何升级？',
          conclusion: '紧急工单可直接升级至值班经理处理。',
          explanation: '标注为紧急的工单自动通知值班经理介入，30 分钟内响应并每 2 小时同步一次处理进展。',
          trustScore: 90,
          citations: [{ doc: '《交付服务协议》', version: 'v2.3', page: '第 8 页', role: '主要依据' }],
        },
      },
      { question: '工单超时未响应怎么办？' }, // 未命中 → 拒答
    ],
  },
  '质保期如何计算？': {
    question: '质保期如何计算？',
    conclusion: '质保期一般为验收通过后 12 个月。',
    explanation: '多数产品自验收通过之日起提供 12 个月质保；部分早期合同条款存在差异，建议以具体合同约定为准。',
    trustScore: 78, // 黄档：存在条款版本差异，建议人工复核
    citations: [
      { doc: '《退货与售后政策》', version: 'v1.6', page: '第 6 页', role: '主要依据' },
      { doc: '《交付服务协议》', version: 'v2.3', page: '第 10 页', role: '参考依据' },
    ],
    followUps: [
      {
        question: '质保期内维修收费吗？',
        answer: {
          question: '质保期内维修收费吗？',
          conclusion: '非人为损坏的维修免费。',
          explanation: '质保期内非人为损坏的维修与配件更换免费；人为损坏或超出质保范围的维修按标准工时与配件价收费。',
          trustScore: 88,
          citations: [{ doc: '《退货与售后政策》', version: 'v1.6', page: '第 7 页', role: '主要依据' }],
        },
      },
      { question: '质保期可以付费延长吗？' }, // 未命中 → 拒答
    ],
  },
  // ── 场景 3：员工制度（考勤/报销） ──
  '报销流程是怎样的？': {
    question: '报销流程是怎样的？',
    conclusion: '报销需在线提交申请并经两级审批。',
    explanation: '员工在报销系统提交单据与发票，经部门负责人与财务两级审批通过后，3 个工作日内打款至工资卡。',
    trustScore: 90,
    citations: [
      { doc: '《财务报销操作指引》', version: 'v1.8', page: '第 2 页', role: '主要依据' },
      { doc: '《差旅费用报销管理办法》', version: 'v3.2', page: '第 4 页', role: '参考依据' },
    ],
    followUps: [
      {
        question: '差旅住宿标准是多少？',
        answer: {
          question: '差旅住宿标准是多少？',
          conclusion: '一线城市 500 元/晚，二线城市 400 元/晚，其他城市 320 元/晚。',
          explanation: '住宿标准按城市等级分档执行，超出标准部分需事前申请特批，否则由个人承担。',
          trustScore: 88,
          citations: [{ doc: '《差旅费用报销管理办法》', version: 'v3.2', page: '第 4 页', role: '主要依据' }],
        },
      },
      { question: '报销发票丢失了怎么办？' }, // 未命中 → 拒答
    ],
  },
  '年假如何申请？': {
    question: '年假如何申请？',
    conclusion: '年假通过考勤系统在线申请。',
    explanation: '员工在考勤系统提交年假申请，由直属上级审批；入职满一年可享 5 天带薪年假，此后每满一年增加 1 天，上限 15 天。',
    trustScore: 92,
    citations: [{ doc: '《考勤管理制度》', version: 'v2.4', page: '第 6 页', role: '主要依据' }],
    followUps: [
      {
        question: '年假可以跨年休吗？',
        answer: {
          question: '年假可以跨年休吗？',
          conclusion: '未休年假可顺延至次年 3 月底。',
          explanation: '当年度未休完的年假可顺延至次年 3 月 31 日前休完，逾期自动作废且不予折现。',
          trustScore: 90,
          citations: [{ doc: '《考勤管理制度》', version: 'v2.4', page: '第 7 页', role: '主要依据' }],
        },
      },
      { question: '离职时未休年假如何折算？' }, // 未命中 → 拒答
    ],
  },
  '考勤异常如何处理？': {
    question: '考勤异常如何处理？',
    conclusion: '考勤异常需在 3 个工作日内提交补签申请。',
    explanation: '忘打卡等异常可在考勤系统发起补签，每月补签不超过 3 次，由直属上级审批后生效。',
    trustScore: 91,
    citations: [{ doc: '《考勤管理制度》', version: 'v2.4', page: '第 3 页', role: '主要依据' }],
    followUps: [
      {
        question: '补签超过次数怎么办？',
        answer: {
          question: '补签超过次数怎么办？',
          conclusion: '超出次数的异常按事假处理。',
          explanation: '每月补签超过 3 次后，后续异常按事假处理；确有特殊情况的，可向 HR 提交申诉材料。',
          trustScore: 90,
          citations: [{ doc: '《考勤管理制度》', version: 'v2.4', page: '第 4 页', role: '主要依据' }],
        },
      },
      { question: '外勤打卡支持吗？' }, // 未命中 → 拒答
    ],
  },
}
