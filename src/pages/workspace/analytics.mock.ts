/**
 * 使用分析页扩展模拟数据（analytics.md §4）
 * 与 base.mock METRICS 跨页一致：近 7 天问答 328（逐日 [32,41,44,48,52,55,56]，与 daily.trend7d 一致）、
 * 成功回答 299 ≈ 91.2%、认可率 87.6%。
 */
import { trend7dLabels } from '@/mocks'

export interface TrendPoint {
  day: string
  questions: number
  answered: number
  rate: number
}

/** 近 7 天：问题/成功/认可率（analytics.md §2.2；问题合计恰好 328，与 base.mock daily.trend7d 一致；日期标签由 TODAY 派生） */
export const trend7dDetailed: TrendPoint[] = (() => {
  const days = trend7dLabels('MM-DD')
  const questions = [32, 41, 44, 48, 52, 55, 56]
  const answered = [29, 37, 40, 44, 47, 51, 51]
  const rates = [78, 79, 81, 83, 84, 86, 88]
  return days.map((day, i) => ({ day, questions: questions[i], answered: answered[i], rate: rates[i] }))
})()

/** 近 30 天扩展 mock（确定性与 7 天口径一致：末 7 天 = trend7dDetailed） */
export const trend30d: TrendPoint[] = (() => {
  const seed = [18, 22, 25, 21, 28, 24, 30, 33, 27, 35, 31, 38, 29, 40, 36, 44, 39, 47, 42, 50, 46, 52, 45]
  const first = seed.map((q, i) => {
    const answered = Math.round(q * (0.82 + (i % 5) * 0.02))
    return {
      day: `05-${String(i + 1).padStart(2, '0')}`,
      questions: q,
      answered,
      rate: 70 + Math.round((answered / q) * 12),
    }
  })
  return [...first, ...trend7dDetailed]
})()

export interface SceneItem {
  name: string
  count: number
  color: string
}

/** 场景使用分布（analytics.md §2.3，固定图表色序） */
export const sceneDistribution: SceneItem[] = [
  { name: '销售咨询', count: 142, color: '#2F74FF' },
  { name: '客服售后', count: 76, color: '#22B573' },
  { name: '员工制度', count: 58, color: '#7357E8' },
  { name: 'IT-SOP', count: 34, color: '#F3A53A' },
  { name: '其他', count: 18, color: '#26A9C4' },
]

export interface TopQuestion {
  rank: number
  question: string
  count: number
  successRate: number
  lastAsked: string
}

export const topQuestions: TopQuestion[] = [
  { rank: 1, question: '差旅报销标准是什么？', count: 34, successRate: 98, lastAsked: '今天 09:42' },
  { rank: 2, question: '报价折扣审批流程', count: 28, successRate: 95, lastAsked: '今天 08:15' },
  { rank: 3, question: '产品 X 的核心优势', count: 22, successRate: 93, lastAsked: '昨天 17:30' },
  { rank: 4, question: '如何集成你们的 API？', count: 18, successRate: 91, lastAsked: '昨天 14:02' },
  { rank: 5, question: '请假审批需要几天？', count: 15, successRate: 89, lastAsked: '06-01 11:20' },
]

export interface TopDoc {
  name: string
  citations: number
  views: number
  owner: string
}

export const topDocs: TopDoc[] = [
  { name: '《差旅费用报销管理办法》', citations: 41, views: 96, owner: '王磊' },
  { name: '《销售管理制度》', citations: 38, views: 88, owner: '张伟' },
  { name: '《产品 X 白皮书》', citations: 31, views: 102, owner: '张伟' },
  { name: '《价格管理办法》', citations: 24, views: 55, owner: '李娜' },
  { name: '《API 接入指南》', citations: 19, views: 73, owner: '王磊' },
]

export interface ValueMetric {
  icon: string
  value: string
  label: string
  note: string
}

export const valueSummary: ValueMetric[] = [
  { icon: '⏱', value: '≈ 41 小时', label: '预估节省查找时间', note: '按每次自助回答节省 7.5 分钟估算' },
  { icon: '🔁', value: '≈ 132 次', label: '减少重复咨询', note: '重复问题由 AI 直接解答' },
  { icon: '🆕', value: '63%', label: '新员工自助解决率', note: '入职 30 天内员工' },
  { icon: '📞', value: '71%', label: '客服一次解决率', note: '较上周 +4%' },
]

export interface ActiveUser {
  rank: number
  name: string
  dept: string
  questions: number
  approvalRate: number
  lastActive: string
}

/** 活跃用户排行（活跃用户卡下钻 Drawer，近 7 天口径，9 名活跃 / 12 席位） */
export const activeUserRanking: ActiveUser[] = [
  { rank: 1, name: '张伟', dept: '销售部', questions: 46, approvalRate: 92, lastActive: '今天 10:12' },
  { rank: 2, name: '李娜', dept: '人事部', questions: 38, approvalRate: 90, lastActive: '今天 09:48' },
  { rank: 3, name: '王磊', dept: 'IT 部', questions: 33, approvalRate: 88, lastActive: '今天 09:20' },
  { rank: 4, name: '赵敏', dept: '销售部', questions: 29, approvalRate: 91, lastActive: '今天 08:55' },
  { rank: 5, name: '刘洋', dept: '售前团队', questions: 24, approvalRate: 86, lastActive: '昨天 17:36' },
  { rank: 6, name: '周杰', dept: '客服部', questions: 21, approvalRate: 85, lastActive: '昨天 16:02' },
  { rank: 7, name: '陈晨', dept: 'IT 部', questions: 17, approvalRate: 82, lastActive: '昨天 14:25' },
  { rank: 8, name: '吴倩', dept: '客服部', questions: 12, approvalRate: 84, lastActive: '05-28 15:31' },
  { rank: 9, name: '郑凯', dept: '市场部', questions: 8, approvalRate: 80, lastActive: '05-28 11:15' },
]

export const reportChapters = [
  '知识覆盖',
  '可信答案',
  '使用人数',
  '高频问题',
  '知识问题闭环',
  '应用使用',
  '预估节省',
  '风险项',
]
