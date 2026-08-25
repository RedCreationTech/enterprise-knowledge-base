/**
 * 对话历史页面模拟数据（chat-history.md §5）
 * 渠道枚举沿用 SurfaceType 子集（PORTAL / FEISHU_BOT / WECOM_BOT / SITE），展示文案在本文件内映射。
 */
import { METRICS, TODAY } from '@/mocks'

export type Channel = 'Web 门户' | '飞书' | '企业微信' | '知识网站'
export type FeedbackKind = 'up' | 'down' | 'no-answer' | 'expired' | 'none'

export interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  time: string
  /** 可信答案结构化负载（仅 assistant） */
  answer?: {
    conclusion: string
    explanation: string
    trust: number
    citations: { name: string; version: string; page: string; primary?: boolean; excerpt: string; owner: string; updatedAt: string; validity: '有效' | '即将过期' | '已过期' }[]
  }
  /** 拒答卡负载（无答案会话） */
  refusal?: {
    title: string
    reason: string
    searchedScope: string
    missingType: string
    closestTopic: string
    closestMeta: string
  }
}

export interface Conversation {
  id: string
  user: string
  dept: string
  avatar: string
  channel: Channel
  firstQuestion: string
  msgCount: number
  time: string
  feedback: FeedbackKind
  /** 用户负反馈原因 */
  feedbackReason?: string
  settledFaq: boolean
  governed: boolean
  external?: boolean
  messages: ChatMsg[]
}

const CITATIONS = [
  {
    name: '《销售管理制度》', version: 'v2.1', page: '第 8 页', primary: true,
    excerpt: '……第 4.2 条：单笔订单折扣超过 10% 的，须由销售总监书面审批后方可执行；超过 20% 的，须报总经理审批。',
    owner: '李娜', updatedAt: '2024-03-18', validity: '有效' as const,
  },
  {
    name: '《价格管理办法》', version: 'v1.3', page: '第 5 页',
    excerpt: '……标准报价基础上的折扣权限：销售代表 ≤5%，销售经理 ≤10%，超出部分逐级上报审批。',
    owner: '李娜', updatedAt: '2024-02-02', validity: '有效' as const,
  },
  {
    name: '《审批权限矩阵表》', version: 'v3.0', page: '第 2 页',
    excerpt: '……折扣审批权限矩阵：10% 以内销售经理终审；10%–20% 销售总监终审；20% 以上总经理终审。',
    owner: '张伟', updatedAt: '2024-04-11', validity: '有效' as const,
  },
]

function simpleMessages(q: string, a: string, count: number): ChatMsg[] {
  const msgs: ChatMsg[] = [
    { id: 'm1', role: 'user', content: q, time: '10:02' },
    { id: 'm2', role: 'assistant', content: a, time: '10:02' },
  ]
  for (let i = 3; i <= count; i += 1) {
    const userTurn = i % 2 === 1
    msgs.push({
      id: `m${i}`,
      role: userTurn ? 'user' : 'assistant',
      content: userTurn ? '好的，那相关的流程在哪里可以查到？' : '已为你附上相关文档链接，可在引用来源中查看完整流程。',
      time: `10:${String(i).padStart(2, '0')}`,
    })
  }
  return msgs
}

export const CONVERSATIONS: Conversation[] = [
  {
    id: 'c1', user: '刘洋', dept: '售前团队', avatar: '刘', channel: '飞书',
    firstQuestion: '差旅报销标准是什么？', msgCount: 6, time: '今天 10:12', feedback: 'up',
    settledFaq: false, governed: false,
    messages: simpleMessages('差旅报销标准是什么？', '根据《差旅报销标准 v3.2》：高铁二等座上限 600 元，住宿按城市分级 300–500 元/晚。', 6),
  },
  {
    id: 'c2', user: '赵敏', dept: '销售部', avatar: '赵', channel: 'Web 门户',
    firstQuestion: '报价折扣超过 10% 需要谁审批？', msgCount: 4, time: '今天 09:48', feedback: 'up',
    settledFaq: false, governed: false,
    messages: [
      { id: 'm1', role: 'user', content: '报价折扣超过 10% 需要谁审批？', time: '09:46' },
      {
        id: 'm2', role: 'assistant', time: '09:46',
        content: '需要销售总监审批。',
        answer: {
          conclusion: '需要销售总监审批。',
          explanation: '根据《销售管理制度》第 4.2 条与《审批权限矩阵表》：单笔订单折扣 10% 以内由销售经理终审；超过 10% 须由销售总监书面审批；超过 20% 须报总经理审批。',
          trust: 92,
          citations: CITATIONS,
        },
      },
      { id: 'm3', role: 'user', content: '那审批一般需要多久？', time: '09:47' },
      { id: 'm4', role: 'assistant', content: '按现行流程，销售总监审批平均 1 个工作日内完成；加急单可走线上审批，最快 2 小时。', time: '09:48' },
    ],
  },
  {
    id: 'c3', user: '王强', dept: '产品部', avatar: '王', channel: '企业微信',
    firstQuestion: '是否支持国产数据库？', msgCount: 3, time: '今天 09:20', feedback: 'no-answer',
    settledFaq: false, governed: false,
    messages: [
      { id: 'm1', role: 'user', content: '我们的产品是否支持国产数据库？', time: '09:18' },
      {
        id: 'm2', role: 'assistant', time: '09:19',
        content: '未找到可靠答案。',
        refusal: {
          title: '未找到可靠答案',
          reason: '已接入资料中没有关于国产数据库适配的说明。',
          searchedScope: `已检索：全部知识空间 · ${METRICS.connectedDocs.total.toLocaleString('en-US')} 份文档`,
          missingType: '缺失类型：产品兼容性 / 部署适配文档',
          closestTopic: '《产品 X 部署环境要求》',
          closestMeta: '仅覆盖操作系统与中间件',
        },
      },
      { id: 'm3', role: 'user', content: '好的，我找产品经理确认一下。', time: '09:20' },
    ],
  },
  {
    id: 'c4', user: '陈晨', dept: 'IT 部', avatar: '陈', channel: '知识网站',
    firstQuestion: 'API 集成需要哪些权限？', msgCount: 8, time: '昨天 17:36', feedback: 'down',
    feedbackReason: '使用了旧版本',
    settledFaq: false, governed: false,
    messages: simpleMessages('API 集成需要哪些权限？', '根据《API 集成指南 v1.2》：需要「读取知识」与「调用问答」两项权限。', 8),
  },
  {
    id: 'c5', user: '李娜', dept: '人事部', avatar: '李', channel: 'Web 门户',
    firstQuestion: '请假审批需要几天？', msgCount: 2, time: '昨天 16:02', feedback: 'up',
    settledFaq: true, governed: false,
    messages: simpleMessages('请假审批需要几天？', '按《请假与考勤制度》：3 天以内直属主管审批当天完成；3 天以上需部门负责人审批，1–2 个工作日。', 2),
  },
  {
    id: 'c6', user: '外部访客', dept: '—', avatar: '访', channel: '知识网站',
    firstQuestion: '售后服务承诺包含哪些内容？', msgCount: 5, time: '昨天 14:25', feedback: 'expired',
    settledFaq: false, governed: false, external: true,
    messages: simpleMessages('售后服务承诺包含哪些内容？', '根据《售后服务承诺 2023 版》：整机质保 12 个月，7 天无理由退换。', 5),
  },
]

/** 追加 14 条生成会话，保证列表 20 条 */
const EXTRA: [string, string, string, Channel, string, number, string, FeedbackKind][] = [
  ['周凯', '售前部', '周', '飞书', '产品 X 支持私有化部署吗？', 4, '今天 08:52', 'up'],
  ['吴倩', '客服部', '吴', '企业微信', '客户要求开发票怎么操作？', 5, '今天 08:31', 'up'],
  ['郑浩', '销售部', '郑', 'Web 门户', '年度合同续费折扣怎么算？', 3, '今天 08:05', 'none'],
  ['孙婷', '市场部', '孙', '知识网站', '品牌 VI 规范文件在哪里？', 4, '今天 07:48', 'up'],
  ['钱进', '财务部', '钱', '飞书', '费用报销的发票要求有哪些？', 6, '昨天 18:47', 'up'],
  ['冯雪', '产品部', '冯', 'Web 门户', '移动端适配支持到哪个版本？', 3, '昨天 15:31', 'no-answer'],
  ['何军', 'IT 部', '何', '企业微信', 'VPN 连不上怎么处理？', 7, '昨天 14:12', 'up'],
  ['高磊', '销售部', '高', '飞书', '竞品 A 的价格对比有吗？', 4, '昨天 11:26', 'down'],
  ['罗燕', '人事部', '罗', 'Web 门户', '新员工入职材料清单', 2, '05-28 17:54', 'up'],
  ['梁冰', '客服部', '梁', '知识网站', '退换货流程要几天？', 5, '05-28 16:33', 'up'],
  ['宋杰', '售前部', '宋', '飞书', 'API 调用量限额是多少？', 3, '05-28 15:09', 'up'],
  ['唐悦', '市场部', '唐', '企业微信', '官网活动的报名数据在哪看？', 4, '05-28 13:48', 'none'],
  ['韩雪', '财务部', '韩', 'Web 门户', '差旅住宿标准按城市怎么分？', 3, '05-28 11:15', 'up'],
  ['曹阳', 'IT 部', '曹', '飞书', '单点登录支持哪些 IdP？', 5, '05-28 09:36', 'up'],
]

EXTRA.forEach(([user, dept, avatar, channel, q, count, time, fb], i) => {
  CONVERSATIONS.push({
    id: `c${i + 7}`,
    user, dept, avatar, channel,
    firstQuestion: q,
    msgCount: count,
    time,
    feedback: fb,
    feedbackReason: fb === 'down' ? '信息不完整' : undefined,
    settledFaq: false,
    governed: false,
    messages: simpleMessages(q, '已根据知识库内容为你生成答案，详情见引用来源。', count),
  })
})

/** 第 2 页会话（12 条，时间更早，含 30 天以前的数据以验证时间筛选） */
const EXTRA_PAGE2: [string, string, string, Channel, string, number, string, FeedbackKind][] = [
  ['吕刚', '销售部', '吕', 'Web 门户', '大客户年度框架协议怎么签？', 6, '05-27 16:42', 'up'],
  ['任霞', '客服部', '任', '企业微信', '客户投诉升级流程是什么？', 4, '05-27 14:18', 'up'],
  ['袁博', 'IT 部', '袁', '飞书', '测试环境申请在哪里提交？', 3, '05-26 11:37', 'none'],
  ['邓琳', '市场部', '邓', '知识网站', '线下展会物料申请流程', 5, '05-26 09:55', 'up'],
  ['许峰', '财务部', '许', 'Web 门户', '供应商付款周期是多久？', 4, '05-25 17:21', 'down'],
  ['沈静', '人事部', '沈', '飞书', '期权激励计划什么时候公布？', 2, '05-25 15:03', 'no-answer'],
  ['曾强', '售前部', '曾', '企业微信', '等保三级认证有哪些要求？', 7, '05-24 13:46', 'up'],
  ['彭丽', '产品部', '彭', 'Web 门户', '历史数据迁移方案有模板吗？', 3, '05-23 10:29', 'up'],
  ['董军', '销售部', '董', '知识网站', '渠道返点政策最新版在哪？', 4, '05-22 16:14', 'expired'],
  ['蒋燕', '客服部', '蒋', '飞书', '上门服务的 SLA 是多久？', 5, '05-21 09:47', 'up'],
  ['魏然', 'IT 部', '魏', '企业微信', '邮件系统归档策略是什么？', 3, '04-28 15:33', 'none'],
  ['薛梅', '市场部', '薛', 'Web 门户', '官网改版排期在哪里看？', 4, '04-25 11:08', 'up'],
]

EXTRA_PAGE2.forEach(([user, dept, avatar, channel, q, count, time, fb], i) => {
  CONVERSATIONS.push({
    id: `c${i + 21}`,
    user, dept, avatar, channel,
    firstQuestion: q,
    msgCount: count,
    time,
    feedback: fb,
    feedbackReason: fb === 'down' ? '答案与最新政策不符' : undefined,
    settledFaq: false,
    governed: false,
    messages: simpleMessages(q, '已根据知识库内容为你生成答案，详情见引用来源。', count),
  })
})

/** 演示基准日「今天」（与 base.mock TODAY 同源） */
export const DEMO_TODAY = TODAY

/** 会话时间文案 → ISO 日期（今天/昨天/MM-DD 三类，用于时间筛选与导出范围） */
export function conversationDate(c: Conversation): string {
  const t = c.time
  if (t.startsWith('今天')) return DEMO_TODAY
  if (t.startsWith('昨天')) {
    const d = new Date(`${DEMO_TODAY}T00:00:00`)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }
  const m = t.match(/^(\d{2})-(\d{2})/)
  if (m) return `${TODAY.slice(0, 4)}-${m[1]}-${m[2]}`
  return DEMO_TODAY
}

/** 反馈枚举 → 导出/展示文案 */
export const FEEDBACK_LABEL: Record<FeedbackKind, string> = {
  up: '认可',
  down: '有问题',
  'no-answer': '无答案',
  expired: '可能过期',
  none: '无反馈',
}

export const CONVERSATION_STATS = {
  today: 64,
  todayDelta: '+12%',
  approvalRate: `${METRICS.approvalRate}%`,
  approvalDelta: '+2.1%',
  negative: 5,
  noAnswer: 23,
  total: 156,
}

export const CHANNEL_FILTERS = ['全部渠道', 'Web 门户', '飞书', '企业微信', '知识网站'] as const
export const TIME_FILTERS = ['今天', '近 7 天', '近 30 天', '自定义'] as const
