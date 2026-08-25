/**
 * 激活交接页 mock（activated.md §3/§5 逐字基准）
 */
import { METRICS } from '@/mocks'

export interface ValueMetric {
  name: string
  value: number | string
  suffix?: string
  hint: string
}

/** 试用价值摘要 6 指标（128/12/1,240 与 base.mock METRICS 一致） */
export const valueMetrics: ValueMetric[] = [
  { name: '已上传资料', value: METRICS.kbDocs, suffix: '份', hint: `已识别 ${METRICS.chapters.toLocaleString('en-US')} 个章节` },
  { name: '可信答案', value: 86, suffix: '个', hint: '引用覆盖率 78%' },
  { name: '答案认可率', value: String(METRICS.approvalRate), suffix: '%', hint: '来自 12 名成员反馈' },
  { name: '试用成员', value: 12, suffix: '人', hint: '覆盖 2 个团队' },
  { name: '累计提问', value: METRICS.totalQuestions, suffix: '次', hint: '近 30 天累计' },
  { name: '已安装应用', value: 3, suffix: '个', hint: '企业微信/SSO/自定义 API' },
]

export const AI_SUMMARY =
  '小知：第二位用户李娜已在飞书获得第一个可信答案（5 月 27 日 15:42），预估每周可为团队减少约 40 次重复咨询。'

export interface ChecklistItem {
  condition: string
  evidence: string
  passed: boolean
}

/** 7 项激活条件（全部满足） */
export const activationChecklist: ChecklistItem[] = [
  { condition: '上传 ≥5 份真实企业资料', evidence: '128 份', passed: true },
  { condition: '完成 ≥3 个真实问题', evidence: '86 个', passed: true },
  { condition: '查看过引用来源', evidence: '首次 5 月 24 日', passed: true },
  { condition: '确认过答案正确', evidence: '首次 5 月 24 日', passed: true },
  { condition: '创建 1 个业务助手', evidence: '企业知识助手 v1.0', passed: true },
  { condition: '邀请 ≥1 名企业用户', evidence: '12 人', passed: true },
  { condition: '第二位用户获得有效答案', evidence: '李娜，5 月 27 日', passed: true },
]

export interface Milestone {
  name: string
  doneAt: string
}

/** 首次里程碑 5 节点 */
export const milestones: Milestone[] = [
  { name: '上传真实资料', doneAt: '05-22' },
  { name: '获得第一个可信答案', doneAt: '05-24' },
  { name: '创建业务助手', doneAt: '05-24' },
  { name: '邀请团队试用', doneAt: '05-25' },
  { name: '第二位用户获得有效答案', doneAt: '05-27' },
]

export interface NextEntry {
  icon: 'book' | 'bot' | 'chart'
  title: string
  desc: string
  path: string
}

export const nextEntries: NextEntry[] = [
  { icon: 'book', title: '继续补充知识', desc: '接入更多资料来源，扩大知识覆盖', path: '/workspace/knowledge-base' },
  { icon: 'bot', title: '管理你的业务助手', desc: '调整回答规则，创建更多场景助手', path: '/workspace/ai-assistant' },
  { icon: 'chart', title: '查看使用分析', desc: '跟踪提问量、认可率与知识缺口', path: '/workspace/analytics' },
]

/** 对象状态提升映射（「原地升级，不复制数据」） */
export const upliftRows: { object: string; from: string; to: string }[] = [
  { object: 'KnowledgeSpace（知识空间）', from: 'trial_default', to: 'active' },
  { object: 'Document（128 份文档）', from: 'trial', to: 'active' },
  { object: 'Assistant（企业知识助手 v1.0）', from: 'trial', to: 'production_candidate' },
  { object: 'TrialCampaign（试用活动）', from: 'active', to: 'completed' },
  { object: '23 个知识问题', from: '待处理', to: '进入治理队列' },
  { object: '使用数据', from: '试用统计', to: '开放正式分析' },
]

/** 主 CTA 初始化进度步骤 */
export const INIT_STEPS = ['应用试用配置', '同步团队成员', '生成分析看板']

export const PLAN_NOTE = {
  plan: '试用版',
  validUntil: '2025-06-03',
  text: '升级专业版可解锁 SSO、审计日志、高级治理与 1 TB 知识容量。',
}
