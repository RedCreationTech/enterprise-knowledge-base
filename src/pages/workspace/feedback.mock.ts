/**
 * 反馈与洞察页扩展模拟数据（feedback.md §4）
 */

export type IssueType = '无答案' | '低质量' | '冲突' | '过期' | '权限' | '引用失败'
export type IssueStatus = '待处理' | '处理中' | '待验证' | '已关闭' | '已忽略'

export interface KnowledgeIssueItem {
  id: string
  type: IssueType
  question: string
  askCount: number
  affectedUsers: number
  priority: '高' | '中' | '低'
  owner: string | null
  recommendedOwner?: string
  lastAskedAt: string
  status: IssueStatus
  action: string
  /** 忽略时间（已忽略 Tab 展示 30 天观察期） */
  ignoredAt?: string
}

export const knowledgeIssues: KnowledgeIssueItem[] = [
  { id: 'ki-1', type: '无答案', question: '私有化部署的详细报价是多少？', askCount: 7, affectedUsers: 5, priority: '高', owner: null, recommendedOwner: '李娜', lastAskedAt: '今天 09:12', status: '待处理', action: '补充答案' },
  { id: 'ki-2', type: '无答案', question: '是否支持国产数据库？', askCount: 7, affectedUsers: 4, priority: '高', owner: '李娜', lastAskedAt: '今天 08:40', status: '待处理', action: '上传资料' },
  { id: 'ki-3', type: '冲突', question: '2024 与 2026 报价政策折扣不一致', askCount: 5, affectedUsers: 6, priority: '高', owner: '张伟', lastAskedAt: '昨天 16:40', status: '待处理', action: '对比版本' },
  { id: 'ki-4', type: '过期', question: '差旅住宿标准（旧版被引用）', askCount: 4, affectedUsers: 8, priority: '中', owner: '王磊', lastAskedAt: '昨天 15:02', status: '待处理', action: '更新版本' },
  { id: 'ki-5', type: '无答案', question: '发票申请需要哪些材料？', askCount: 3, affectedUsers: 3, priority: '中', owner: null, recommendedOwner: '李娜', lastAskedAt: '06-01 10:18', status: '待处理', action: '指派处理' },
  { id: 'ki-6', type: '低质量', question: '年假计算规则答案不完整', askCount: 2, affectedUsers: 2, priority: '低', owner: '李娜', lastAskedAt: '05-31 14:55', status: '待处理', action: '查看答案' },
  { id: 'ki-7', type: '引用失败', question: 'API 调用频率限制（文档缺章节）', askCount: 2, affectedUsers: 3, priority: '中', owner: '张伟', lastAskedAt: '05-30 11:08', status: '待处理', action: '修复引用' },
  { id: 'ki-8', type: '无答案', question: '试用期结束后数据会保留吗？', askCount: 6, affectedUsers: 5, priority: '高', owner: null, recommendedOwner: '李娜', lastAskedAt: '今天 08:15', status: '待处理', action: '补充答案' },
  { id: 'ki-9', type: '无答案', question: '支持与企业微信通讯录双向同步吗？', askCount: 5, affectedUsers: 4, priority: '中', owner: '王磊', lastAskedAt: '昨天 17:26', status: '待处理', action: '上传资料' },
  { id: 'ki-10', type: '无答案', question: '知识库可以按项目隔离吗？', askCount: 4, affectedUsers: 3, priority: '中', owner: null, recommendedOwner: '赵敏', lastAskedAt: '昨天 14:48', status: '待处理', action: '补充答案' },
  { id: 'ki-11', type: '无答案', question: '海外分支访问速度慢怎么办？', askCount: 3, affectedUsers: 2, priority: '低', owner: null, recommendedOwner: '王磊', lastAskedAt: '06-01 09:37', status: '待处理', action: '指派处理' },
  { id: 'ki-12', type: '无答案', question: 'SSO 登录支持钉钉扫码吗？', askCount: 3, affectedUsers: 3, priority: '中', owner: '张伟', lastAskedAt: '05-31 16:20', status: '待处理', action: '补充答案' },
  { id: 'ki-13', type: '无答案', question: '历史版本答案可以回溯吗？', askCount: 2, affectedUsers: 2, priority: '低', owner: '李娜', lastAskedAt: '05-30 15:44', status: '待处理', action: '补充答案' },
  { id: 'ki-14', type: '低质量', question: '报销发票要求回答过于笼统', askCount: 5, affectedUsers: 6, priority: '中', owner: '李娜', lastAskedAt: '今天 07:58', status: '待处理', action: '查看答案' },
  { id: 'ki-15', type: '低质量', question: '请假审批流程缺少特殊情形说明', askCount: 3, affectedUsers: 4, priority: '中', owner: null, recommendedOwner: '赵敏', lastAskedAt: '昨天 13:32', status: '待处理', action: '查看答案' },
  { id: 'ki-16', type: '低质量', question: '产品 X 部署方式回答未区分 SaaS 与本地化', askCount: 3, affectedUsers: 3, priority: '中', owner: '王磊', lastAskedAt: '06-01 11:05', status: '待处理', action: '查看答案' },
  { id: 'ki-17', type: '低质量', question: '售后质保范围回答引用了过期条款', askCount: 2, affectedUsers: 2, priority: '低', owner: '李娜', lastAskedAt: '05-29 10:42', status: '待处理', action: '查看答案' },
  { id: 'ki-18', type: '冲突', question: '年假顺延规则与考勤制度 v2.3 不一致', askCount: 4, affectedUsers: 5, priority: '高', owner: '赵敏', lastAskedAt: '昨天 10:14', status: '待处理', action: '对比版本' },
  { id: 'ki-19', type: '冲突', question: '售前授权折扣口径两个空间不一致', askCount: 3, affectedUsers: 4, priority: '中', owner: '张伟', lastAskedAt: '05-31 09:26', status: '待处理', action: '对比版本' },
  { id: 'ki-20', type: '过期', question: '2023 团建方案仍被检索命中', askCount: 2, affectedUsers: 3, priority: '低', owner: '王磊', lastAskedAt: '05-30 18:09', status: '待处理', action: '更新版本' },
  { id: 'ki-21', type: '过期', question: '旧版差旅城市分级表被引用', askCount: 2, affectedUsers: 4, priority: '中', owner: null, recommendedOwner: '李娜', lastAskedAt: '05-29 14:51', status: '待处理', action: '更新版本' },
  { id: 'ki-22', type: '权限', question: '渠道底价表被无权限成员问到（已拒答）', askCount: 4, affectedUsers: 2, priority: '高', owner: '张伟', lastAskedAt: '昨天 09:48', status: '待处理', action: '核查权限' },
  { id: 'ki-23', type: '权限', question: '新入职成员反馈看不到售前空间内容', askCount: 3, affectedUsers: 3, priority: '中', owner: '赵敏', lastAskedAt: '05-31 17:33', status: '待处理', action: '核查权限' },
]

/** 类型徽标配色（feedback.md §2.2：无答案蓝浅底 / 冲突紫 / 过期橙 / 低质量灰 / 引用失败红 / 权限青） */
export const ISSUE_TYPE_CLASS: Record<IssueType, string> = {
  无答案: 'bg-info-bg text-info',
  低质量: 'bg-neutral-100 text-neutral-500',
  冲突: 'bg-violet-bg text-violet',
  过期: 'bg-warning-bg text-warning',
  权限: 'bg-cyan-bg text-cyan',
  引用失败: 'bg-danger-bg text-danger',
}

/** 问题类型分布（右栏卡 2，固定色序，合计 23） */
export const issueTypeDistribution: { type: IssueType; count: number; color: string }[] = [
  { type: '无答案', count: 9, color: '#2F74FF' },
  { type: '低质量', count: 5, color: '#22B573' },
  { type: '冲突', count: 3, color: '#7357E8' },
  { type: '过期', count: 3, color: '#F3A53A' },
  { type: '权限', count: 2, color: '#26A9C4' },
  { type: '引用失败', count: 1, color: '#E5484D' },
]

export interface UserFeedbackItem {
  id: string
  sentiment: 'up' | 'down'
  question: string
  answerExcerpt: string
  user: string
  time: string
  reason?: string
  converted: boolean
  /** 来源（store 写入的反馈显示来源页面） */
  source?: string
}

export const baseFeedbacks: UserFeedbackItem[] = [
  { id: 'uf-1', sentiment: 'down', question: '私有化部署报价', answerExcerpt: '没有找到足够可靠的企业知识…', user: '李娜', time: '今天 09:12', reason: '没有引用', converted: false, source: 'AI 助手' },
  { id: 'uf-2', sentiment: 'down', question: '差旅住宿标准', answerExcerpt: '一线城市住宿标准 450 元/晚…', user: '王磊', time: '昨天 16:40', reason: '使用了旧版本', converted: false, source: '知识网站' },
  { id: 'uf-3', sentiment: 'up', question: '报价折扣审批流程', answerExcerpt: '需要销售总监审批。…', user: '赵敏', time: '昨天 15:02', converted: false, source: 'AI 助手' },
  { id: 'uf-4', sentiment: 'down', question: 'API 频率限制', answerExcerpt: '默认 5,000 次/月…', user: '刘洋', time: '06-01 10:18', reason: '内容不完整', converted: false, source: '知识网站' },
  { id: 'uf-5', sentiment: 'up', question: '请假审批天数', answerExcerpt: '3 天以内由直属主管审批…', user: '周杰', time: '05-31 14:55', converted: false, source: 'AI 助手' },
]

/** 版本对比 diff mock（2024 v1.0 vs 2026 v2.0 报价政策） */
export interface DiffBlock {
  oldText: string
  newText: string
}

export const pricePolicyDiff: DiffBlock[] = [
  {
    oldText: '第 8.2 条（2024 v1.0）：报价折扣超过 15% 的订单，须由销售总监审批。',
    newText: '第 8.2 条（2026 v2.0）：报价折扣超过 10% 的订单，须由销售总监审批。',
  },
  {
    oldText: '第 8.4 条（2024 v1.0）：折扣超过 25% 须报总经理审批。',
    newText: '第 8.4 条（2026 v2.0）：折扣超过 20% 须报总经理审批，并抄送财务备案。',
  },
]

/** 「查看答案」抽屉：问题 → 当前答案卡 mock（结论 / 引用 / 信任度） */
export interface IssueAnswer {
  conclusion: string
  explanation: string
  trust: number
  citations: { name: string; version: string }[]
}

export const issueAnswers: Record<string, IssueAnswer> = {
  'ki-6': {
    conclusion: '年假按自然年计算，入职当年按在职月份折算。',
    explanation: '根据《考勤与假期制度 v2.3》第 3.1 条：满 1 年可享 5 天年假；但答案未覆盖「入职不满 1 年折算」「离职未休折算」两种情形，被 2 名用户反馈不完整。',
    trust: 58,
    citations: [
      { name: '《考勤与假期制度》', version: 'v2.3' },
      { name: '《员工手册》', version: '2026 版' },
    ],
  },
  'ki-14': {
    conclusion: '报销需提供合规增值税发票，抬头为公司全称。',
    explanation: '当前答案仅说明了发票抬头要求，未区分专票/普票、电子发票查验与连号发票限制，5 次提问中 6 名用户表示过于笼统。',
    trust: 61,
    citations: [{ name: '《费用报销管理办法》', version: 'v1.8' }],
  },
  'ki-15': {
    conclusion: '3 天以内直属主管审批，3 天以上部门负责人审批。',
    explanation: '答案缺少婚假/丧假/病假等特殊情形的审批链与证明材料要求，导致请假场景覆盖不全。',
    trust: 64,
    citations: [{ name: '《请假与考勤制度》', version: 'v2.0' }],
  },
  'ki-16': {
    conclusion: '产品 X 支持 SaaS 云服务与本地化部署两种方式。',
    explanation: '当前回答未区分两种部署方式的硬件要求与 License 差异，售前场景易误导客户。',
    trust: 55,
    citations: [{ name: '《产品 X 部署环境要求》', version: 'v1.1' }],
  },
  'ki-17': {
    conclusion: '整机质保 12 个月，7 天无理由退换。',
    explanation: '答案引用的是《售后服务承诺 2023 版》旧条款，2026 版已将核心部件质保延长至 24 个月。',
    trust: 47,
    citations: [{ name: '《售后服务承诺》', version: '2023 版（已过期）' }],
  },
}

/** 无专属 mock 时的兜底答案卡 */
export const defaultIssueAnswer = (question: string): IssueAnswer => ({
  conclusion: '已根据知识库现有资料生成答案，但覆盖度不足。',
  explanation: `「${question}」当前答案可信度偏低，建议 Owner 补充权威来源后重新回归验证。`,
  trust: 52,
  citations: [{ name: '（暂无权威引用）', version: '—' }],
})

/** 用户反馈「查看对话」抽屉：2–4 轮对话 mock */
export interface FeedbackChatTurn {
  role: 'user' | 'assistant'
  content: string
  time: string
}

export const feedbackConversations: Record<string, FeedbackChatTurn[]> = {
  'uf-1': [
    { role: 'user', content: '私有化部署报价是多少？', time: '今天 09:10' },
    { role: 'assistant', content: '没有找到足够可靠的企业知识来回答这个问题。已检索全部知识空间 1,286 份文档，未命中私有化部署报价相关条款。', time: '今天 09:10' },
    { role: 'user', content: '那大概的价格区间呢？', time: '今天 09:11' },
    { role: 'assistant', content: '抱歉，价格区间属于需要权威来源的内容，我不能凭空生成。建议联系售前或上传《私有化部署报价单》。', time: '今天 09:12' },
  ],
  'uf-2': [
    { role: 'user', content: '差旅住宿标准是多少？', time: '昨天 16:38' },
    { role: 'assistant', content: '一线城市住宿标准 450 元/晚，二线城市 350 元/晚。（引用《差旅住宿标准》2023 版）', time: '昨天 16:39' },
    { role: 'user', content: '这个是最新版吗？我记得今年调整过。', time: '昨天 16:40' },
  ],
  'uf-3': [
    { role: 'user', content: '报价折扣审批流程是怎样的？', time: '昨天 15:00' },
    { role: 'assistant', content: '需要销售总监审批。折扣 10% 以内销售经理终审；10%–20% 销售总监终审；20% 以上总经理终审。', time: '昨天 15:01' },
    { role: 'user', content: '好的，很清楚了，谢谢！', time: '昨天 15:02' },
  ],
  'uf-4': [
    { role: 'user', content: 'API 调用频率限制是多少？', time: '06-01 10:15' },
    { role: 'assistant', content: '默认 5,000 次/月。超出后按量计费或联系管理员升配。', time: '06-01 10:16' },
    { role: 'user', content: '突发流量怎么处理？有缓冲机制吗？', time: '06-01 10:17' },
    { role: 'assistant', content: '已接入资料中没有关于突发流量缓冲的说明，建议参考《API 接入指南》或联系 IT 支持。', time: '06-01 10:18' },
  ],
  'uf-5': [
    { role: 'user', content: '请假审批需要几天？', time: '05-31 14:53' },
    { role: 'assistant', content: '3 天以内由直属主管审批当天完成；3 天以上需部门负责人审批，1–2 个工作日。', time: '05-31 14:54' },
  ],
}

/** store 写入的反馈无专属 mock 时，按问题生成 2 轮兜底对话 */
export const defaultFeedbackConversation = (question: string, answerExcerpt: string): FeedbackChatTurn[] => [
  { role: 'user', content: question, time: '最近' },
  { role: 'assistant', content: answerExcerpt || '已根据知识库内容生成答案，详情见引用来源。', time: '最近' },
]

export const closureStats = { closed: 14, inProgress: 6, verifying: 3, overdue: 2, avgDays: 1.8 }

export const healthScore = { score: 86, delta: '+3' }

export const OWNERS = ['张伟', '李娜', '王磊', '赵敏']
