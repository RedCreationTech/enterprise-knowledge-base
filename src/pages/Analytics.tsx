/**
 * 使用分析（/workspace/analytics）— analytics.md
 * 指标卡行（5 张，含环比）+ 使用趋势组合图（近 7/30 天切换）+ 场景分布横向条形
 * + 热门问题/热门文档 Top5 双列表 + 试用价值报告摘要卡。
 * 「无答案率」指标卡点击 → /workspace/feedback?filter=no-answer。
 */
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CheckCircle2,
  CircleHelp,
  Download,
  FileText,
  ListChecks,
  MessageSquareText,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/mocks'
import { EmptyState } from '@/components/common/EmptyState'
import { MetricCard } from '@/components/common/MetricCard'
import { SectionCard } from '@/components/common/SectionCard'
import { Modal } from './workspace/Modal'
import { SideDrawer } from './workspace/SideDrawer'
import { PageHeader } from './workspace/PageHeader'
import { useAppToast } from '@/lib/toast'
import {
  activeUserRanking,
  reportChapters,
  sceneDistribution,
  topDocs,
  topQuestions,
  trend30d,
  trend7dDetailed,
  valueSummary,
} from './workspace/analytics.mock'
import { closureStats, issueTypeDistribution } from './workspace/feedback.mock'

type TimeRange = 'today' | '7d' | '30d' | 'custom'

const RANGE_LABEL: Record<TimeRange, string> = {
  today: '今日',
  '7d': '近 7 天',
  '30d': '近 30 天',
  custom: '自定义',
}

/** 三个时间范围的指标 mock（筛选变更全页联动） */
const RANGE_METRICS: Record<Exclude<TimeRange, 'custom'>, { questions: string; answerRate: string; noAnswer: string; noAnswerHint: string; approval: string; approvalHint: string; activeUsers: string }> = {
  today: { questions: '108', answerRate: '88.0%', noAnswer: '6.5%', noAnswerHint: '7 个无答案问题', approval: '83.0%', approvalHint: '来自 14 条反馈', activeUsers: '7 / 12' },
  '7d': { questions: '328', answerRate: '91.2%', noAnswer: '7.0%', noAnswerHint: '23 个无答案问题', approval: '87.6%', approvalHint: '来自 96 条反馈', activeUsers: '9 / 12' },
  '30d': { questions: '1,240', answerRate: '85.9%', noAnswer: '7.8%', noAnswerHint: '97 个无答案问题', approval: '81.2%', approvalHint: '来自 356 条反馈', activeUsers: '11 / 12' },
}

const QUESTION_TYPES = ['全部', '正常', '无答案', '低质量', '冲突']

export default function Analytics() {
  const navigate = useNavigate()
  const { state, loadDemoData } = useAppStore()
  const toast = useAppToast()
  /** 真实空态起点：整页数据区替换为空态卡 */
  const demoOff = state.demoData === false

  const handleLoadDemo = () => {
    loadDemoData()
    toast.success('已载入演示数据')
  }

  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [pendingRange, setPendingRange] = useState<TimeRange>('7d')
  const [assistant, setAssistant] = useState('全部助手')
  const [userGroup, setUserGroup] = useState('全部')
  const [questionType, setQuestionType] = useState('全部')
  const [sceneFilter, setSceneFilter] = useState<string | null>(null)
  const [chartDays, setChartDays] = useState<7 | 30>(7)
  const [faqJoined, setFaqJoined] = useState<Set<number>>(new Set())
  const [testJoined, setTestJoined] = useState<Set<number>>(new Set())
  const [reportOpen, setReportOpen] = useState(false)
  const [reportProgress, setReportProgress] = useState(-1) // -1 未开始
  const [reportChecked, setReportChecked] = useState<Set<string>>(new Set(reportChapters))
  const [usersOpen, setUsersOpen] = useState(false)
  const reportTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const metrics = RANGE_METRICS[timeRange === 'custom' ? '7d' : timeRange]
  const chartData = useMemo(() => (chartDays === 7 ? trend7dDetailed : trend30d), [chartDays])
  const sceneTotal = useMemo(() => sceneDistribution.reduce((s, i) => s + i.count, 0), [])

  const applyRange = (r: TimeRange) => {
    setPendingRange(r)
    if (r === 'custom') return // 自定义需点「应用」
    setTimeRange(r)
    if (r === '7d') setChartDays(7)
    if (r === '30d') setChartDays(30)
  }

  const markJoined = (kind: 'faq' | 'test', rank: number, question: string) => {
    const [set, joined] = kind === 'faq' ? [setFaqJoined, faqJoined] : [setTestJoined, testJoined]
    if (joined.has(rank)) {
      toast.info(kind === 'faq' ? '该问题已创建过 FAQ，无需重复操作。' : '该问题已在测试集中。')
      return
    }
    set(new Set(joined).add(rank))
    toast.success(kind === 'faq' ? `已将「${question}」创建为 FAQ。` : `已将「${question}」加入测试集。`)
  }

  /** 按选中章节生成 Markdown 报告正文（数字取当前时间范围真实口径） */
  const buildReportMd = (chapters: string[]) => {
    const lines: string[] = [
      '# 企业知识库试用价值报告',
      '',
      `- 报告范围：${RANGE_LABEL[timeRange]} · ${assistant} · ${userGroup === '全部' ? '全部用户组' : userGroup}`,
      '- 生成时间：2026-05-29 10:30',
      '- 数据口径：排除测试会话与系统消息',
      '',
    ]
    chapters.forEach((c) => {
      lines.push(`## ${c}`, '')
      switch (c) {
        case '知识覆盖':
          lines.push(
            `- 问题数量：${metrics.questions} 个`,
            `- 成功回答率：${metrics.answerRate}`,
            `- 无答案率：${metrics.noAnswer}（${metrics.noAnswerHint}）`,
          )
          break
        case '可信答案':
          lines.push(
            `- 答案认可率：${metrics.approval}（${metrics.approvalHint}）`,
            '- 可信答案五段结构：结论 / 解释 / 引用来源 / 可信度 / 反馈操作',
            '- 低可信答案一律拒答，不伪装成答案',
          )
          break
        case '使用人数':
          lines.push(
            `- 活跃用户：${metrics.activeUsers}（席位渗透 75%）`,
            '',
            '| 排名 | 姓名 | 部门 | 提问数 | 认可率 | 最近活跃 |',
            '| --- | --- | --- | ---: | ---: | --- |',
            ...activeUserRanking.map(
              (u) => `| ${u.rank} | ${u.name} | ${u.dept} | ${u.questions} | ${u.approvalRate}% | ${u.lastActive} |`,
            ),
          )
          break
        case '高频问题':
          lines.push(
            '',
            '| # | 标准化问题 | 次数 | 成功率 | 最近时间 |',
            '| --- | --- | ---: | ---: | --- |',
            ...topQuestions.map((q) => `| ${q.rank} | ${q.question} | ${q.count} | ${q.successRate}% | ${q.lastAsked} |`),
          )
          break
        case '知识问题闭环':
          lines.push(
            `- 本周已闭环：${closureStats.closed} 项（平均闭环时长 ${closureStats.avgDays} 天）`,
            `- 处理中：${closureStats.inProgress} 项 · 待验证：${closureStats.verifying} 项 · 已超期：${closureStats.overdue} 项`,
            `- 问题类型分布：${issueTypeDistribution.map((t) => `${t.type} ${t.count}`).join(' / ')}（合计 23）`,
          )
          break
        case '应用使用':
          lines.push(
            `- 场景使用分布（合计 ${sceneTotal} 次）：`,
            ...sceneDistribution.map((s) => `  - ${s.name}：${s.count} 次（占比 ${Math.round((s.count / sceneTotal) * 100)}%）`),
            `- 热门文档 Top1：《差旅费用报销管理办法》（引用 ${topDocs[0].citations} 次 / 查看 ${topDocs[0].views} 次）`,
          )
          break
        case '预估节省':
          lines.push(...valueSummary.map((v) => `- ${v.label}：${v.value}（${v.note}）`))
          break
        case '风险项':
          lines.push(
            `- 无答案问题 ${metrics.noAnswerHint}，其中 3 个高优先级待补充`,
            `- ${closureStats.overdue} 项治理任务已超期，需跟进 Owner`,
            '- 1 个引用失败问题（API 调用频率限制文档缺章节）待修复',
          )
          break
        default:
          break
      }
      lines.push('')
    })
    return lines.join('\n')
  }

  const generateReport = () => {
    if (reportProgress >= 0 && reportProgress < selectedChapters.length) return
    if (selectedChapters.length === 0) {
      toast.warning('请至少勾选一个报告章节。')
      return
    }
    reportTimers.current.forEach(clearTimeout)
    reportTimers.current = []
    setReportProgress(0)
    selectedChapters.forEach((_, i) => {
      reportTimers.current.push(
        setTimeout(() => {
          setReportProgress(i + 1)
          if (i === selectedChapters.length - 1) {
            const blob = new Blob([buildReportMd(selectedChapters)], { type: 'text/markdown;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = '价值报告_2026-05-29.md'
            a.click()
            URL.revokeObjectURL(url)
            toast.success(`价值报告_2026-05-29.md 已生成并开始下载（${selectedChapters.length} 个章节）。`)
          }
        }, 500 * (i + 1)),
      )
    })
  }

  const selectedChapters = reportChapters.filter((c) => reportChecked.has(c))
  const generating = reportProgress >= 0 && reportProgress < selectedChapters.length

  const closeReport = () => {
    reportTimers.current.forEach(clearTimeout)
    reportTimers.current = []
    setReportOpen(false)
    setReportProgress(-1)
  }

  const selectCls =
    'h-10 rounded-md border border-neutral-200 bg-white px-2.5 text-body-sm text-neutral-700 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:shadow-input'

  return (
    <div className="space-y-4">
      {/* 标题区 */}
      <PageHeader
        crumbs={[]}
        title="使用分析"
        subtitle="数据口径：排除测试会话与系统消息 · 更新于 今天 10:30"
        actions={
          !demoOff ? (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-[#BFD0F2] bg-white px-4 text-body text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
            >
              <Download className="h-4 w-4" />
              导出价值报告
            </button>
          ) : undefined
        }
      />

      {/* 空态起点：筛选行与全部数据区替换为空态卡 */}
      {demoOff ? (
        <div className="rounded-xl border border-neutral-200 bg-white shadow-card">
          <EmptyState
            title="还没有运营数据"
            description="完成快速配置或载入演示数据后，这里会展示真实的运营数据。"
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
                >
                  载入演示数据
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/workspace/quick-config')}
                  className="inline-flex h-10 items-center rounded-md border border-[#BFD0F2] bg-white px-4 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
                >
                  开始快速配置
                </button>
              </div>
            }
          />
        </div>
      ) : (
        <>
      {/* 筛选行（sticky） */}
      <div className="sticky top-16 z-30 -mx-1 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 shadow-card">
        <select value={pendingRange} onChange={(e) => applyRange(e.target.value as TimeRange)} className={selectCls} title="时间范围">
          <option value="today">今日</option>
          <option value="7d">近 7 天</option>
          <option value="30d">近 30 天</option>
          <option value="custom">自定义</option>
        </select>
        {pendingRange === 'custom' && (
          <>
            <input type="date" defaultValue="2026-05-01" className={selectCls} aria-label="开始日期" />
            <span className="text-caption text-neutral-400">至</span>
            <input type="date" defaultValue="2026-05-29" className={selectCls} aria-label="结束日期" />
            <button
              type="button"
              onClick={() => {
                setTimeRange('custom')
                toast.success('已应用自定义时间范围。')
              }}
              className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white hover:bg-brand-500"
            >
              应用
            </button>
          </>
        )}
        <select value={assistant} onChange={(e) => setAssistant(e.target.value)} className={selectCls} title="助手">
          <option>全部助手</option>
          <option>企业知识助手</option>
          <option>销售问答助手</option>
        </select>
        <select value={userGroup} onChange={(e) => setUserGroup(e.target.value)} className={selectCls} title="用户组">
          <option>全部</option>
          <option>销售团队</option>
          <option>售前团队</option>
          <option>客服团队</option>
        </select>
        <div className="flex items-center gap-1.5">
          {QUESTION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setQuestionType(t)}
              className={cn(
                'inline-flex h-8 items-center rounded-md border px-3 text-body-sm transition-colors duration-micro ease-brand',
                questionType === t ? 'border-brand-500 bg-brand-100 text-brand-700' : 'border-neutral-200 bg-white text-neutral-700 hover:border-brand-300',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {sceneFilter && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-50 px-2.5 text-body-sm text-brand-700">
            场景：{sceneFilter}
            <button type="button" onClick={() => setSceneFilter(null)} className="text-brand-500 hover:text-brand-700">
              重置
            </button>
          </span>
        )}
      </div>

      {/* Row 1：指标卡 ×5 */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
          <MetricCard icon={<MessageSquareText className="h-4 w-4" />} name="问题数量" value={timeRange === '7d' ? 328 : metrics.questions} delta="较上周 +18%" deltaPositive hint={RANGE_LABEL[timeRange]} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.06 }}>
          <MetricCard icon={<CheckCircle2 className="h-4 w-4" />} name="成功回答率" value={metrics.answerRate} delta="+2.1%" deltaPositive />
        </motion.div>
        {/* 无答案率：可点击 → feedback?filter=no-answer（warning 橙字） */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.12 }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate('/workspace/feedback?filter=no-answer')}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/workspace/feedback?filter=no-answer')}
            className="cursor-pointer rounded-xl border border-neutral-200 bg-white p-5 shadow-card transition-shadow duration-comp ease-brand hover:shadow-float"
            title="点击查看无答案问题列表"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-body-sm text-neutral-500">无答案率</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-warning-bg text-warning">
                <CircleHelp className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-metric-lg text-warning">{metrics.noAnswer}</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-caption">
              <span className="inline-flex items-center gap-0.5 font-medium text-warning">
                <TrendingDown className="h-3.5 w-3.5" />
                {metrics.noAnswerHint}
              </span>
              <span className="text-neutral-400">点击下钻 ›</span>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.18 }}>
          <MetricCard icon={<ThumbsUp className="h-4 w-4" />} name="答案认可率" value={metrics.approval} hint={metrics.approvalHint} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.24 }}>
          <MetricCard
            icon={<Users className="h-4 w-4" />}
            name="活跃用户"
            value={metrics.activeUsers}
            hint="席位渗透 75% · 点击查看排行"
            onClick={() => setUsersOpen(true)}
          />
        </motion.div>
      </div>

      {/* Row 2：趋势图 + 场景分布 */}
      <div className="grid grid-cols-12 gap-4">
        <SectionCard
          className="col-span-12 xl:col-span-8"
          title="问答趋势"
          actions={
            <div className="flex rounded-md border border-neutral-200 p-0.5">
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setChartDays(d)}
                  className={cn(
                    'h-7 rounded-sm px-3 text-caption font-medium transition-colors duration-micro ease-brand',
                    chartDays === d ? 'bg-brand-600 text-white' : 'text-neutral-500 hover:text-neutral-700',
                  )}
                >
                  近 {d} 天
                </button>
              ))}
            </div>
          }
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#EEF2F7" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#98A2B3' }} axisLine={{ stroke: '#E4EAF2' }} tickLine={false} interval={chartDays === 30 ? 4 : 0} />
                <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#98A2B3' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12, fill: '#98A2B3' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13 }}
                  formatter={(value: number, name: string) => (name === '认可率' ? [`${value}%`, name] : [value, name])}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
                <Bar yAxisId="left" dataKey="questions" name="问题数" fill="#8DB2FF" radius={[3, 3, 0, 0]} barSize={chartDays === 30 ? 8 : 20} />
                <Bar yAxisId="left" dataKey="answered" name="成功回答数" fill="#2F74FF" radius={[3, 3, 0, 0]} barSize={chartDays === 30 ? 8 : 20} />
                <Line yAxisId="right" type="monotone" dataKey="rate" name="认可率" stroke="#22B573" strokeWidth={2} dot={{ r: 2.5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard className="col-span-12 xl:col-span-4" title="场景使用分布">
          <ul className="space-y-4 pt-1">
            {sceneDistribution.map((s, i) => (
              <motion.li
                key={s.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18, delay: i * 0.06 }}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    setSceneFilter(s.name)
                    toast.success(`已按场景「${s.name}」筛选。`)
                  }}
                >
                  <span className="mb-1.5 flex items-center justify-between text-body-sm">
                    <span className={cn('font-medium', sceneFilter === s.name ? 'text-brand-600' : 'text-neutral-800')}>{s.name}</span>
                    <span className="text-neutral-950">{s.count}</span>
                  </span>
                  <span className="block h-2.5 overflow-hidden rounded-pill bg-neutral-100">
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.count / sceneDistribution[0].count) * 100}%` }}
                      transition={{ duration: 0.5, delay: i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
                      className="block h-full rounded-pill"
                      style={{ background: s.color }}
                    />
                  </span>
                  <span className="mt-1 block text-caption text-neutral-400">占比 {Math.round((s.count / sceneTotal) * 100)}%</span>
                </button>
              </motion.li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Row 3：热门问题 + 热门文档 */}
      <div className="grid grid-cols-12 gap-4">
        <SectionCard className="col-span-12 xl:col-span-6" title="热门问题 Top 5" icon={<ListChecks className="h-5 w-5" />}>
          <table className="w-full text-left">
            <thead>
              <tr className="h-10 bg-surface-soft text-body-sm text-neutral-500">
                <th className="w-8 rounded-l-md pl-2 font-medium">#</th>
                <th className="font-medium">标准化问题</th>
                <th className="w-16 text-right font-medium">次数</th>
                <th className="w-16 text-right font-medium">成功率</th>
                <th className="w-24 text-right font-medium">最近时间</th>
                <th className="w-40 rounded-r-md pr-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {topQuestions.map((q) => (
                <tr key={q.rank} className="h-12 border-b border-neutral-100 text-body-sm last:border-b-0 hover:bg-neutral-50">
                  <td className="pl-2 text-neutral-400">{q.rank}</td>
                  <td className="max-w-0 truncate pr-2 text-neutral-800" title={q.question}>{q.question}</td>
                  <td className="text-right text-neutral-800">{q.count}</td>
                  <td className="text-right text-success">{q.successRate}%</td>
                  <td className="text-right text-caption text-neutral-500">{q.lastAsked}</td>
                  <td className="pr-2 text-right">
                    <button
                      type="button"
                      onClick={() => markJoined('faq', q.rank, q.question)}
                      className={cn('text-caption font-medium', faqJoined.has(q.rank) ? 'text-neutral-400' : 'text-brand-600 hover:text-brand-700')}
                    >
                      {faqJoined.has(q.rank) ? '已创建 FAQ' : '创建 FAQ'}
                    </button>
                    <span className="mx-1.5 text-neutral-200">|</span>
                    <button
                      type="button"
                      onClick={() => markJoined('test', q.rank, q.question)}
                      className={cn('text-caption font-medium', testJoined.has(q.rank) ? 'text-neutral-400' : 'text-brand-600 hover:text-brand-700')}
                    >
                      {testJoined.has(q.rank) ? '已加入测试集' : '加入测试集'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard className="col-span-12 xl:col-span-6" title="热门文档 Top 5" icon={<FileText className="h-5 w-5" />}>
          <ul>
            {topDocs.map((d, i) => (
              <li key={d.name}>
                <button
                  type="button"
                  onClick={() => navigate('/workspace/knowledge-base')}
                  className="flex h-12 w-full items-center gap-3 border-b border-neutral-100 text-left last:border-b-0 hover:bg-neutral-50"
                >
                  <span className="w-5 shrink-0 text-center text-body-sm text-neutral-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-neutral-900">{d.name}</span>
                  <span className="shrink-0 text-caption text-neutral-500">引用 {d.citations}</span>
                  <span className="shrink-0 text-caption text-neutral-500">查看 {d.views}</span>
                  <span className="w-10 shrink-0 text-right text-caption text-neutral-500">{d.owner}</span>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Row 4：业务价值摘要（通栏 Insight 卡） */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.1 }}
        className="flex overflow-hidden rounded-xl border border-neutral-200 bg-surface-selected shadow-card"
      >
        <div className="w-0.5 shrink-0 bg-brand-500" />
        <div className="min-w-0 flex-1 p-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="flex items-center gap-1.5 text-h3 text-neutral-950">
              <TrendingUp className="h-5 w-5 text-brand-600" />
              本周业务价值
            </h3>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[#BFD0F2] bg-white px-3.5 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
            >
              生成完整价值报告
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {valueSummary.map((v) => (
              <div key={v.label} className="rounded-lg bg-white p-4">
                <p className="text-xl">{v.icon}</p>
                <p className="mt-1.5 text-metric text-neutral-950">{v.value}</p>
                <p className="mt-0.5 text-body-sm font-medium text-neutral-800">{v.label}</p>
                <p className="mt-0.5 text-caption text-neutral-400">{v.note}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>
        </>
      )}

      {/* 价值报告 Modal */}
      <Modal
        open={reportOpen}
        onClose={closeReport}
        title="生成价值报告"
        description={`报告范围：${RANGE_LABEL[timeRange]} · ${assistant} · ${userGroup === '全部' ? '全部用户组' : userGroup}`}
        width={560}
        footer={
          <>
            <button type="button" onClick={closeReport} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">
              关闭
            </button>
            <button
              type="button"
              disabled={generating || selectedChapters.length === 0}
              onClick={generateReport}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-md px-5 text-body font-medium text-white',
                generating || selectedChapters.length === 0
                  ? 'cursor-not-allowed bg-neutral-100 text-neutral-400'
                  : 'bg-brand-600 hover:bg-brand-500 active:bg-brand-700',
              )}
            >
              {reportProgress >= selectedChapters.length && reportProgress > 0 ? '重新生成报告' : generating ? '正在生成…' : '生成报告'}
            </button>
          </>
        }
      >
        <p className="mb-2.5 text-caption text-neutral-500">勾选需要导出的章节（已选 {selectedChapters.length} / {reportChapters.length}），仅选中章节会写入报告文件。</p>
        <ul className="space-y-2.5">
          {reportChapters.map((c) => {
            const idx = selectedChapters.indexOf(c)
            const done = idx >= 0 && reportProgress > idx
            const running = idx >= 0 && reportProgress === idx && generating
            const checked = reportChecked.has(c)
            return (
              <li key={c}>
                <label className={cn('flex items-center gap-2.5 text-body', generating ? 'cursor-not-allowed' : 'cursor-pointer')}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={generating}
                    onChange={() =>
                      setReportChecked((prev) => {
                        const next = new Set(prev)
                        if (next.has(c)) next.delete(c)
                        else next.add(c)
                        return next
                      })
                    }
                    className="h-4 w-4 shrink-0 accent-brand-600"
                  />
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : running ? (
                    <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                  ) : (
                    <span className={cn('h-4 w-4 shrink-0 rounded-full border', checked ? 'border-brand-300' : 'border-neutral-300')} />
                  )}
                  <span className={checked ? 'text-neutral-900' : 'text-neutral-400'}>{c}</span>
                  {done && <span className="text-caption text-success">已完成</span>}
                </label>
              </li>
            )
          })}
        </ul>
        {reportProgress >= selectedChapters.length && reportProgress > 0 && (
          <p className="mt-4 rounded-lg bg-success-bg px-3 py-2 text-body-sm text-success">报告已生成：价值报告_2026-05-29.md（{selectedChapters.length} 个章节）</p>
        )}
      </Modal>

      {/* 活跃用户排行 Drawer */}
      <SideDrawer open={usersOpen} onClose={() => setUsersOpen(false)} title={`活跃用户排行（${RANGE_LABEL[timeRange]}）`} width={560}>
        <p className="mb-3 text-body-sm text-neutral-500">
          活跃用户 {metrics.activeUsers} · 席位渗透 75% · 数据口径：排除测试会话
        </p>
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="h-10 bg-surface-soft text-neutral-500">
              <th className="w-10 rounded-l-md pl-2 font-medium">#</th>
              <th className="font-medium">姓名</th>
              <th className="font-medium">部门</th>
              <th className="w-16 text-right font-medium">提问数</th>
              <th className="w-16 text-right font-medium">认可率</th>
              <th className="w-24 rounded-r-md pr-2 text-right font-medium">最近活跃</th>
            </tr>
          </thead>
          <tbody>
            {activeUserRanking.map((u) => (
              <tr key={u.rank} className="h-11 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                <td className="pl-2 text-neutral-400">{u.rank}</td>
                <td>
                  <span className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-caption font-medium text-brand-600">
                      {u.name[0]}
                    </span>
                    <span className="text-neutral-900">{u.name}</span>
                  </span>
                </td>
                <td className="text-neutral-500">{u.dept}</td>
                <td className="text-right text-neutral-900">{u.questions}</td>
                <td className="text-right text-success">{u.approvalRate}%</td>
                <td className="pr-2 text-right text-caption text-neutral-500">{u.lastActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-caption text-neutral-400">未活跃席位（3）：钱进、冯雪、何军 — 近 7 天无提问记录。</p>
      </SideDrawer>

    </div>
  )
}
