/**
 * 反馈与洞察（/workspace/feedback）— feedback.md
 * 左 8 列：Tab（知识问题 23 / 用户反馈 5+store）+ 筛选行 + 审核队列表格 + 批量操作栏
 * 右 4 列：知识健康度 / 问题类型分布 / 本周闭环统计
 * URL 深链：?filter=no-answer（或 ?type=unanswered）→ 自动套用「无答案」筛选。
 * 治理闭环：指派处理 → store.tasks；标记已解决 → 回归验证提示 → 待验证 → 已关闭。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  CheckCircle2,
  CircleCheck,
  ClipboardList,
  Clock,
  FileWarning,
  PieChart,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { me, useAppStore } from '@/mocks'
import type { FeedbackItem } from '@/mocks'
import { SectionCard } from '@/components/common/SectionCard'
import { PriorityBadge } from '@/components/common/PriorityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ProgressRing } from '@/components/common/ProgressRing'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmationCard } from '@/components/common/ConfirmationCard'
import { AnswerCard } from '@/components/common/AnswerCard'
import { Modal } from './workspace/Modal'
import { SideDrawer } from './workspace/SideDrawer'
import { useAppToast } from '@/lib/toast'
import type { IssueType, KnowledgeIssueItem, UserFeedbackItem } from './workspace/feedback.mock'
import {
  ISSUE_TYPE_CLASS,
  OWNERS,
  baseFeedbacks,
  closureStats,
  defaultFeedbackConversation,
  defaultIssueAnswer,
  feedbackConversations,
  healthScore,
  issueAnswers,
  issueTypeDistribution,
  knowledgeIssues,
  pricePolicyDiff,
} from './workspace/feedback.mock'

const TYPE_FILTERS: ('全部' | IssueType)[] = ['全部', '无答案', '低质量', '冲突', '过期', '权限', '引用失败']
const STATUS_FILTERS = ['全部', '待处理', '处理中', '待验证', '已关闭', '已超期']
const OWNER_FILTERS = ['全部', '未指派', ...OWNERS]

/** store 反馈 → 用户反馈卡模型 */
function storeFeedbackToCard(f: FeedbackItem): UserFeedbackItem {
  return {
    id: f.id,
    sentiment: f.type === 'correct' ? 'up' : 'down',
    question: f.question ?? '（未记录原始问题）',
    answerExcerpt: f.answerExcerpt ?? '',
    user: me.name,
    time: f.createdAt,
    reason: f.note ?? (f.type === 'no-answer' ? '没有找到答案' : f.type === 'expired' ? '内容已过期' : undefined),
    converted: f.status === '已处理',
    source: f.source === 'ai-assistant' ? 'AI 助手' : f.source === 'knowledge-site' ? '知识网站' : f.source,
  }
}

export default function Feedback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { state, addTask, updateFeedback, loadDemoData } = useAppStore()
  const toast = useAppToast()
  /** 真实空态起点：队列与分布区替换为空态卡 */
  const demoOff = state.demoData === false

  const handleLoadDemo = () => {
    loadDemoData()
    toast.success('已载入演示数据')
  }

  const [tab, setTab] = useState<'issues' | 'feedbacks' | 'ignored'>('issues')
  const [issues, setIssues] = useState<KnowledgeIssueItem[]>(knowledgeIssues)
  const [convertedIds, setConvertedIds] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<'全部' | IssueType>('全部')
  const [ownerFilter, setOwnerFilter] = useState('全部')
  const [statusFilter, setStatusFilter] = useState('全部')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editorFor, setEditorFor] = useState<string | null>(null)
  const [editorAnswer, setEditorAnswer] = useState('')
  const [assignTarget, setAssignTarget] = useState<KnowledgeIssueItem[] | null>(null)
  const [resolveTarget, setResolveTarget] = useState<KnowledgeIssueItem | null>(null)
  const [compareTarget, setCompareTarget] = useState<KnowledgeIssueItem | null>(null)
  const [compareConfirm, setCompareConfirm] = useState(false)
  const [compareScope, setCompareScope] = useState('当前问题')
  const [answerFor, setAnswerFor] = useState<KnowledgeIssueItem | null>(null)
  const [chatFor, setChatFor] = useState<UserFeedbackItem | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<KnowledgeIssueItem | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  // URL 深链：?filter=no-answer / ?type=unanswered → 知识问题 Tab + 无答案筛选
  // 渲染期比对 searchParams（useSearchParams 按 location.search 记忆化），替代 effect 内同步 setState
  const [prevSearchParams, setPrevSearchParams] = useState<URLSearchParams | null>(null)
  if (prevSearchParams !== searchParams) {
    setPrevSearchParams(searchParams)
    const filter = searchParams.get('filter')
    const type = searchParams.get('type')
    if (filter === 'no-answer' || type === 'unanswered') {
      setTab('issues')
      setTypeFilter('无答案')
    }
  }

  const feedbackCards: UserFeedbackItem[] = useMemo(
    () => [
      ...state.feedbacks.map(storeFeedbackToCard),
      ...baseFeedbacks.map((b) => (convertedIds.has(b.id) ? { ...b, converted: true } : b)),
    ],
    [state.feedbacks, convertedIds],
  )

  const filteredIssues = useMemo(
    () =>
      issues.filter((i) => {
        if (i.status === '已忽略') return false // 已忽略项移入「已忽略」Tab 管理
        if (typeFilter !== '全部' && i.type !== typeFilter) return false
        if (statusFilter === '已超期') return false // 当前 mock 无超期项 → 展示空态
        if (statusFilter !== '全部' && statusFilter !== '已超期' && i.status !== statusFilter) return false
        if (ownerFilter === '未指派' && i.owner !== null) return false
        if (ownerFilter !== '全部' && ownerFilter !== '未指派' && i.owner !== ownerFilter) return false
        return true
      }),
    [issues, typeFilter, statusFilter, ownerFilter],
  )

  const ignoredIssues = useMemo(() => issues.filter((i) => i.status === '已忽略'), [issues])

  const issueTotal = issues.length + (feedbackCards.filter((f) => f.converted).length)
  const feedbackTotal = feedbackCards.filter((f) => !f.converted).length

  const patchIssue = (id: string, patch: Partial<KnowledgeIssueItem>) =>
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  /** 待验证 → 自动回归 3s → 已关闭 */
  const startRegression = (id: string) => {
    patchIssue(id, { status: '待验证' })
    timersRef.current.push(
      setTimeout(() => {
        patchIssue(id, { status: '已关闭' })
        toast.success('答案已重新验证通过，问题已关闭。')
      }, 3000),
    )
  }

  // ---------- 行操作 ----------

  const runAction = (issue: KnowledgeIssueItem) => {
    switch (issue.action) {
      case '补充答案':
        setEditorFor(editorFor === issue.id ? null : issue.id)
        setEditorAnswer('')
        break
      case '对比版本':
        setCompareTarget(issue)
        setCompareConfirm(false)
        setCompareScope('当前问题')
        break
      case '指派处理':
        setAssignTarget([issue])
        break
      case '查看答案':
        setAnswerFor(issue)
        break
      case '上传资料':
      case '更新版本':
      case '修复引用': {
        patchIssue(issue.id, { status: '处理中' })
        addTask({
          group: '知识完善',
          title: `${issue.action}：${issue.question}`,
          reason: `${issue.type} · 被问 ${issue.askCount} 次 · 影响 ${issue.affectedUsers} 名用户`,
          priority: issue.priority,
          status: '进行中',
          due: '本周五',
          owner: issue.owner ?? me.name,
        })
        toast.success(`已创建关联治理任务（每日待办可见），问题状态变更为处理中，正在跳转知识库。`)
        navigate('/workspace/knowledge-base')
        break
      }
      default:
        toast.info('已打开对应答案详情（模拟）。')
    }
  }

  const confirmAssign = (owner: string) => {
    if (!assignTarget) return
    assignTarget.forEach((issue) => patchIssue(issue.id, { owner, status: '处理中' }))
    assignTarget.forEach((issue) =>
      addTask({
        group: '知识完善',
        title: `处理知识问题：${issue.question}`,
        reason: `${issue.type} · 被问 ${issue.askCount} 次 · 影响 ${issue.affectedUsers} 名用户`,
        priority: issue.priority,
        status: '进行中',
        due: '本周五',
        owner,
      }),
    )
    toast.success(`已指派给 ${owner}，治理任务已生成（每日待办可见），状态变更为处理中。`)
    setAssignTarget(null)
    setSelected(new Set())
  }

  const saveFaq = (issue: KnowledgeIssueItem) => {
    if (!editorAnswer.trim()) return
    setEditorFor(null)
    toast.info('补充答案已保存，进入自动回归验证…')
    startRegression(issue.id)
  }

  const confirmResolve = () => {
    if (!resolveTarget) return
    const id = resolveTarget.id
    setResolveTarget(null)
    toast.info('已提交回归验证，验证通过后问题才会关闭。')
    startRegression(id)
  }

  const confirmAuthority = () => {
    if (!compareTarget) return
    patchIssue(compareTarget.id, { status: '已关闭' })
    setCompareTarget(null)
    toast.success(`已指定 2026 v2.0 为权威来源（范围：${compareScope}），冲突已关闭并记录审计日志。`)
  }

  // ---------- 批量操作 ----------

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const batchImprove = () => {
    const targets = issues.filter((i) => selected.has(i.id))
    targets.forEach((i) => patchIssue(i.id, { status: '处理中' }))
    addTask({
      group: '知识完善',
      title: `批量改进 ${targets.length} 个知识问题`,
      reason: targets.map((t) => t.question).slice(0, 2).join('；') + (targets.length > 2 ? ' 等' : ''),
      priority: '高',
      status: '进行中',
      due: '本周五',
      owner: me.name,
    })
    toast.success(`已生成批量治理任务，${targets.length} 个问题状态变更为处理中。`)
    setSelected(new Set())
  }

  const batchIgnore = () => {
    issues.filter((i) => selected.has(i.id)).forEach((i) => patchIssue(i.id, { status: '已忽略', ignoredAt: '今天' }))
    toast.info(`已忽略 ${selected.size} 项并设置 30 天观察期限，可在「已忽略」Tab 恢复。`)
    setSelected(new Set())
  }

  /** 已忽略 → 恢复待处理（L2 确认后） */
  const confirmRestore = () => {
    if (!restoreTarget) return
    patchIssue(restoreTarget.id, { status: '待处理', ignoredAt: undefined })
    toast.success(`已恢复「${restoreTarget.question}」至待处理队列。`)
    setRestoreTarget(null)
  }

  // ---------- 用户反馈转化 ----------

  const convertFeedback = (card: UserFeedbackItem) => {
    if (card.converted) {
      toast.info('该反馈已转化为知识问题，无需重复操作。')
      return
    }
    const newIssue: KnowledgeIssueItem = {
      id: `ki-conv-${card.id}`,
      type: card.reason?.includes('旧版本') || card.reason?.includes('过期') ? '过期' : card.sentiment === 'down' ? '无答案' : '低质量',
      question: card.question,
      askCount: 1,
      affectedUsers: 1,
      priority: '中',
      owner: null,
      recommendedOwner: '李娜',
      lastAskedAt: card.time,
      status: '待处理',
      action: '指派处理',
    }
    setIssues((prev) => [newIssue, ...prev])
    setConvertedIds((prev) => new Set(prev).add(card.id))
    if (state.feedbacks.some((f) => f.id === card.id)) updateFeedback(card.id, { status: '已处理' })
    toast.success('已转为知识问题，进入治理队列。')
  }

  const selectCls =
    'h-9 rounded-md border border-neutral-200 bg-white px-2 text-body-sm text-neutral-700 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:shadow-input'

  return (
    <div className="space-y-4">
      {/* 顶部单行横幅：标题(左) + 紧凑统计(右) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-neutral-950">反馈与洞察</h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {!demoOff &&
            [
              { icon: <FileWarning className="h-4 w-4" />, name: '知识问题', value: issueTotal, suffix: '个' },
              { icon: <ThumbsUp className="h-4 w-4" />, name: '用户反馈', value: feedbackTotal, suffix: '条' },
              { icon: <CheckCircle2 className="h-4 w-4" />, name: '本周闭环', value: closureStats.closed, suffix: '项' },
            ].map((m) => (
              <div key={m.name} className="flex items-center gap-2">
                {m.icon}
                <div className="leading-tight">
                  <p className="text-metric text-neutral-950">
                    {m.value}
                    <span className="text-body-sm text-neutral-500">{m.suffix}</span>
                  </p>
                  <p className="text-caption text-neutral-500">{m.name}</p>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* 空态起点：队列与分布区替换为空态卡 */}
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
      <div className="grid grid-cols-12 items-start gap-4">
        {/* 左栏 8 列 */}
        <div className="col-span-12 xl:col-span-8">
          <SectionCard bodyClassName="relative">
            {/* Tab */}
            <div className="mb-4 flex border-b border-neutral-100">
              {(
                [
                  ['issues', `知识问题 ${issueTotal}`],
                  ['feedbacks', `用户反馈 ${feedbackTotal}`],
                  ['ignored', `已忽略 ${ignoredIssues.length}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    'relative mr-6 pb-2.5 text-body font-medium transition-colors duration-comp ease-brand',
                    tab === key ? 'text-brand-600' : 'text-neutral-500 hover:text-neutral-700',
                  )}
                >
                  {label}
                  {tab === key && <motion.span layoutId="fb-tab" className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-500" />}
                </button>
              ))}
            </div>

            {tab === 'issues' ? (
              <>
                {/* 筛选行 */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {TYPE_FILTERS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={cn(
                        'inline-flex h-8 items-center rounded-md border px-3 text-body-sm transition-colors duration-micro ease-brand',
                        typeFilter === t ? 'border-brand-500 bg-brand-100 text-brand-700' : 'border-neutral-200 bg-white text-neutral-700 hover:border-brand-300',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                  <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className={selectCls} title="Owner">
                    {OWNER_FILTERS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls} title="状态">
                    {STATUS_FILTERS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* 队列表格 */}
                {filteredIssues.length === 0 ? (
                  <EmptyState title="当前没有待处理的知识问题" description="调整筛选条件，或等待新的问题聚类出现。" />
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-10 bg-surface-soft text-body-sm text-neutral-500">
                        <th className="w-9 rounded-l-md pl-2">
                          <input
                            type="checkbox"
                            aria-label="全选"
                            checked={filteredIssues.length > 0 && filteredIssues.every((i) => selected.has(i.id))}
                            onChange={(e) =>
                              setSelected(e.target.checked ? new Set(filteredIssues.map((i) => i.id)) : new Set())
                            }
                            className="h-4 w-4 accent-brand-600"
                          />
                        </th>
                        <th className="font-medium">问题</th>
                        <th className="w-16 text-right font-medium">被问</th>
                        <th className="w-16 text-right font-medium">影响用户</th>
                        <th className="w-20 font-medium">优先级</th>
                        <th className="w-20 font-medium">Owner</th>
                        <th className="w-24 font-medium">最近发生</th>
                        <th className="w-44 rounded-r-md pr-2 text-right font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIssues.map((issue, idx) => (
                        <motion.tr
                          key={issue.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.18, delay: idx * 0.03 }}
                          className={cn(
                            'border-b border-neutral-100 text-body-sm transition-colors duration-micro ease-brand last:border-b-0',
                            selected.has(issue.id) ? 'bg-surface-cardSel' : 'hover:bg-neutral-50',
                            issue.status === '已关闭' && 'opacity-60',
                          )}
                        >
                          <td className="pl-2">
                            <input
                              type="checkbox"
                              aria-label={`选择 ${issue.question}`}
                              checked={selected.has(issue.id)}
                              onChange={() => toggleSelect(issue.id)}
                              className="h-4 w-4 accent-brand-600"
                            />
                          </td>
                          <td className="max-w-0 py-3 pr-2">
                            <p className="truncate text-neutral-900" title={issue.question}>{issue.question}</p>
                            <span className={cn('mt-1 inline-flex h-5 items-center rounded-sm px-1.5 text-caption font-medium', ISSUE_TYPE_CLASS[issue.type])}>
                              {issue.type}
                            </span>
                          </td>
                          <td className="text-right text-neutral-800">{issue.askCount}</td>
                          <td className="text-right text-neutral-800">{issue.affectedUsers}</td>
                          <td><PriorityBadge priority={issue.priority} /></td>
                          <td className="text-neutral-700">{issue.owner ?? <span className="text-neutral-400">未指派</span>}</td>
                          <td className="text-caption text-neutral-500">{issue.lastAskedAt}</td>
                          <td className="pr-2 text-right">
                            <StatusBadge status={issue.status} className="mr-2" />
                            {issue.status !== '已关闭' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => runAction(issue)}
                                  className="text-body-sm font-medium text-brand-600 hover:text-brand-700"
                                >
                                  {issue.action}
                                </button>
                                <span className="mx-1 text-neutral-200">|</span>
                                <button
                                  type="button"
                                  onClick={() => setResolveTarget(issue)}
                                  className="text-body-sm text-neutral-500 hover:text-success"
                                >
                                  标记已解决
                                </button>
                              </>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 行内 FAQ 编辑器（补充答案） */}
                <AnimatePresence>
                  {editorFor && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      {(() => {
                        const issue = issues.find((i) => i.id === editorFor)
                        if (!issue) return null
                        return (
                          <div className="mt-3 rounded-lg border border-brand-200 bg-surface-cardSel p-4">
                            <p className="text-body-sm font-semibold text-neutral-950">补充答案：{issue.question}</p>
                            <textarea
                              value={editorAnswer}
                              onChange={(e) => setEditorAnswer(e.target.value)}
                              rows={3}
                              placeholder="输入标准答案（保存后进入自动回归验证）…"
                              className="mt-2.5 w-full resize-none rounded-md border border-[#DCE4EF] bg-white px-3 py-2 text-body text-neutral-800 outline-none focus:border-brand-500 focus:shadow-input"
                            />
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <select className={selectCls} defaultValue={issue.recommendedOwner ?? OWNERS[0]} title="Owner">
                                {OWNERS.map((o) => (
                                  <option key={o}>{o}</option>
                                ))}
                              </select>
                              <label className="flex items-center gap-1.5 text-body-sm text-neutral-500">
                                有效期至
                                <input type="date" defaultValue="2026-12-31" className={selectCls} />
                              </label>
                              <span className="text-caption text-neutral-400">适用范围：全部知识空间</span>
                              <div className="ml-auto flex gap-2">
                                <button type="button" onClick={() => setEditorFor(null)} className="h-9 rounded-md px-3 text-body-sm text-neutral-500 hover:bg-neutral-100">
                                  取消
                                </button>
                                <button
                                  type="button"
                                  disabled={!editorAnswer.trim()}
                                  onClick={() => saveFaq(issue)}
                                  className={cn(
                                    'h-9 rounded-md px-4 text-body-sm font-medium text-white',
                                    editorAnswer.trim() ? 'bg-brand-600 hover:bg-brand-500' : 'cursor-not-allowed bg-neutral-100 text-neutral-400',
                                  )}
                                >
                                  保存并回归验证
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : tab === 'ignored' ? (
              /* Tab 3：已忽略项管理（30 天观察期，可恢复） */
              ignoredIssues.length === 0 ? (
                <EmptyState title="没有已忽略的知识问题" description="批量操作栏的「忽略并设期限」会将问题移到这里，观察期内可随时恢复。" />
              ) : (
                <ul className="space-y-2.5">
                  {ignoredIssues.map((issue) => (
                    <li key={issue.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-neutral-950" title={issue.question}>{issue.question}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-neutral-400">
                          <span className={cn('inline-flex h-5 items-center rounded-sm px-1.5 font-medium', ISSUE_TYPE_CLASS[issue.type])}>
                            {issue.type}
                          </span>
                          <span>{issue.ignoredAt ?? '最近'} 忽略 · 30 天观察期</span>
                          <span>被问 {issue.askCount} 次 · 影响 {issue.affectedUsers} 名用户</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRestoreTarget(issue)}
                        className="h-8 shrink-0 rounded-md border border-[#BFD0F2] bg-white px-3 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
                      >
                        恢复
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              /* Tab 2：用户反馈队列 */
              <ul className="space-y-2.5">
                {feedbackCards.length === 0 && <EmptyState title="暂无用户反馈" description="知识网站与 AI 助手页的反馈会实时出现在这里。" />}
                {feedbackCards.map((f) => (
                  <li key={f.id} className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3.5 transition-colors duration-micro ease-brand hover:border-brand-300">
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', f.sentiment === 'up' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger')}>
                      {f.sentiment === 'up' ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-medium text-neutral-950">{f.question}</p>
                      <p className="mt-0.5 truncate text-caption text-neutral-500">{f.answerExcerpt}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-neutral-400">
                        <span>{f.user} · {f.time}</span>
                        {f.source && <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5">来源：{f.source}</span>}
                        {f.reason && <span className="rounded-sm bg-danger-bg px-1.5 py-0.5 text-danger">{f.reason}</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" onClick={() => setChatFor(f)} className="text-body-sm text-neutral-500 hover:text-brand-600">
                        查看对话
                      </button>
                      {f.converted ? (
                        <span className="inline-flex h-8 items-center rounded-md bg-neutral-100 px-3 text-body-sm text-neutral-400">已转化</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => convertFeedback(f)}
                          className="h-8 rounded-md border border-[#BFD0F2] bg-white px-3 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
                        >
                          转为知识问题
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* 右栏 4 列 */}
        <div className="col-span-12 space-y-4 xl:col-span-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.12 }}>
            <SectionCard title="知识健康度" icon={<Activity className="h-5 w-5" />}>
              <div className="flex items-center gap-4">
                <ProgressRing value={healthScore.score} size={92} label="健康度" />
                <div>
                  <p className="text-metric text-neutral-950">{healthScore.score} 分</p>
                  <p className="mt-0.5 text-body-sm text-success">较上周 {healthScore.delta}</p>
                  <button type="button" onClick={() => navigate('/workspace/analytics')} className="mt-1.5 text-body-sm text-brand-600 hover:text-brand-700">
                    查看完整报告 ›
                  </button>
                </div>
              </div>
            </SectionCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.18 }}>
            <SectionCard title="问题类型分布" icon={<PieChart className="h-5 w-5" />}>
              <ul className="space-y-3">
                {issueTypeDistribution.map((t) => (
                  <li key={t.type}>
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => {
                        setTab('issues')
                        setTypeFilter(t.type)
                      }}
                    >
                      <span className="mb-1 flex items-center justify-between text-body-sm">
                        <span className={cn(typeFilter === t.type ? 'font-medium text-brand-600' : 'text-neutral-800')}>{t.type}</span>
                        <span className="text-neutral-950">{t.count}</span>
                      </span>
                      <span className="block h-2 overflow-hidden rounded-pill bg-neutral-100">
                        <motion.span
                          initial={{ width: 0 }}
                          animate={{ width: `${(t.count / 9) * 100}%` }}
                          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                          className="block h-full rounded-pill"
                          style={{ background: t.color }}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.24 }}>
            <SectionCard title="本周闭环统计" icon={<ClipboardList className="h-5 w-5" />}>
              <ul className="space-y-2.5 text-body-sm">
                <li className="flex items-center gap-2 text-neutral-800">
                  <CircleCheck className="h-4 w-4 text-success" />
                  已关闭 <span className="ml-auto font-semibold text-neutral-950">{closureStats.closed}</span>
                </li>
                <li className="flex items-center gap-2 text-neutral-800">
                  <Clock className="h-4 w-4 text-info" />
                  处理中 <span className="ml-auto font-semibold text-neutral-950">{closureStats.inProgress}</span>
                </li>
                <li className="flex items-center gap-2 text-neutral-800">
                  <CheckCircle2 className="h-4 w-4 text-cyan" />
                  待验证 <span className="ml-auto font-semibold text-neutral-950">{closureStats.verifying}</span>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('issues')
                      setStatusFilter('已超期')
                    }}
                    className="flex w-full items-center gap-2 text-warning"
                  >
                    <FileWarning className="h-4 w-4" />
                    已超期 <span className="ml-auto font-semibold">{closureStats.overdue}</span>
                  </button>
                </li>
              </ul>
              <p className="mt-3 border-t border-neutral-100 pt-3 text-caption text-neutral-500">平均闭环时长 {closureStats.avgDays} 天</p>
            </SectionCard>
          </motion.div>
        </div>
      </div>
      )}

      {/* 批量操作栏（勾选 ≥1 时滑入） */}
      <AnimatePresence>
        {selected.size > 0 && tab === 'issues' && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="sticky bottom-4 z-30 flex h-14 items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 shadow-float"
          >
            <span className="text-body-sm text-neutral-700">已选 {selected.size} 项</span>
            <button
              type="button"
              onClick={() => setAssignTarget(issues.filter((i) => selected.has(i.id)))}
              className="h-9 rounded-md border border-[#BFD0F2] bg-white px-3.5 text-body-sm text-brand-600 hover:bg-brand-50"
            >
              批量指派
            </button>
            <button
              type="button"
              onClick={batchIgnore}
              className="h-9 rounded-md border border-[#BFD0F2] bg-white px-3.5 text-body-sm text-brand-600 hover:bg-brand-50"
            >
              忽略并设期限
            </button>
            <button
              type="button"
              onClick={batchImprove}
              className="ml-auto h-9 rounded-md bg-brand-600 px-5 text-body-sm font-medium text-white hover:bg-brand-500 active:bg-brand-700"
            >
              开始改进
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="h-9 rounded-md px-3 text-body-sm text-neutral-500 hover:bg-neutral-100">
              取消选择
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Owner 选择 Modal（含推荐标记） */}
      <Modal open={assignTarget !== null} onClose={() => setAssignTarget(null)} title="指派处理" description="选择 Owner，将生成治理任务并同步到每日待办" width={440}>
        <ul className="space-y-2">
          {OWNERS.map((o) => {
            const recommended = assignTarget?.some((i) => i.recommendedOwner === o)
            return (
              <li key={o}>
                <button
                  type="button"
                  onClick={() => confirmAssign(o)}
                  className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 p-3 text-left transition-colors duration-micro ease-brand hover:border-brand-500 hover:bg-surface-cardSel"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-body-sm font-semibold text-brand-600">{o[0]}</span>
                  <span className="text-body font-medium text-neutral-900">{o}</span>
                  {recommended && <span className="ml-auto rounded-sm bg-success-bg px-1.5 py-0.5 text-caption font-medium text-success">推荐：该文档负责人</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </Modal>

      {/* 标记已解决：回归验证提示（L2 确认卡） */}
      <Modal open={resolveTarget !== null} onClose={() => setResolveTarget(null)} width={560}>
        {resolveTarget && (
          <ConfirmationCard
            title="标记已解决前需完成回归验证"
            description="未经过回归验证的问题不会被关闭，确保改进真实生效。"
            fields={[
              { label: '动作', value: '标记知识问题为已解决' },
              { label: '影响对象', value: resolveTarget.question },
              { label: '影响范围', value: `被问 ${resolveTarget.askCount} 次 · 影响 ${resolveTarget.affectedUsers} 名用户` },
              { label: '回归验证', value: '提交后自动执行回归评测（约 3 秒），通过后状态变为已关闭' },
              { label: '可撤销性', value: '验证未通过将自动回到处理中，可重新处理' },
            ]}
            confirmText="提交回归验证"
            onConfirm={confirmResolve}
            onCancel={() => setResolveTarget(null)}
            className="border-0 p-0 shadow-none"
          />
        )}
      </Modal>

      {/* 版本对比 Drawer（Modal 宽版） */}
      <Modal
        open={compareTarget !== null}
        onClose={() => setCompareTarget(null)}
        title="对比版本：报价政策"
        description="2024 v1.0 vs 2026 v2.0 · 差异已浅黄高亮，旧条款红色删除线"
        width={880}
        footer={
          compareConfirm ? undefined : (
            <>
              <label className="mr-auto flex items-center gap-2 text-body-sm text-neutral-500">
                生效范围
                <select value={compareScope} onChange={(e) => setCompareScope(e.target.value)} className={selectCls}>
                  <option>当前问题</option>
                  <option>当前空间</option>
                  <option>全组织</option>
                </select>
              </label>
              <button type="button" onClick={() => setCompareTarget(null)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">
                取消
              </button>
              <button
                type="button"
                onClick={() => setCompareConfirm(true)}
                className="h-10 rounded-md bg-brand-600 px-5 text-body font-medium text-white hover:bg-brand-500 active:bg-brand-700"
              >
                指定 2026 版为权威来源
              </button>
            </>
          )
        }
      >
        {compareConfirm ? (
          <ConfirmationCard
            title="确认指定权威来源（L2 操作）"
            description="指定后，AI 回答将仅以 2026 v2.0 为准，旧版本不再参与合成。"
            fields={[
              { label: '动作', value: '指定 2026 v2.0 为报价政策权威来源' },
              { label: '影响对象', value: compareTarget?.question ?? '' },
              { label: '影响范围', value: compareScope },
              { label: '外部影响', value: '引用旧版本的答案将标记为过期并重新生成' },
              { label: '可撤销性', value: '可在文档版本中随时切换权威来源，操作记录审计日志' },
            ]}
            confirmText="确认执行"
            onConfirm={confirmAuthority}
            onModify={() => setCompareConfirm(false)}
            onCancel={() => setCompareTarget(null)}
            className="border-0 p-0 shadow-none"
          />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {(['old', 'new'] as const).map((side) => (
              <div key={side} className="rounded-lg border border-neutral-200">
                <p className={cn('border-b border-neutral-100 px-3.5 py-2.5 text-body-sm font-semibold', side === 'old' ? 'text-neutral-500' : 'text-brand-600')}>
                  {side === 'old' ? '《报价政策》2024 v1.0（旧）' : '《报价政策》2026 v2.0（新）'}
                </p>
                <div className="space-y-2.5 p-3.5">
                  {pricePolicyDiff.map((d, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.18, delay: i * 0.1 }}
                      className="rounded-md bg-surface-highlight px-2.5 py-2 text-body-sm leading-6 text-neutral-800"
                    >
                      {side === 'old' ? <span className="text-danger line-through">{d.oldText}</span> : d.newText}
                    </motion.p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 查看答案 Drawer：该问题当前答案卡（结论 / 引用 / 信任度） */}
      <SideDrawer open={answerFor !== null} onClose={() => setAnswerFor(null)} title="查看答案" width={560}>
        {answerFor &&
          (() => {
            const a = issueAnswers[answerFor.id] ?? defaultIssueAnswer(answerFor.question)
            return (
              <div>
                <AnswerCard
                  question={answerFor.question}
                  conclusion={a.conclusion}
                  explanation={a.explanation}
                  citations={a.citations.length}
                  trust={a.trust}
                  className="shadow-none"
                />
                <h4 className="mt-4 text-body-sm font-semibold text-neutral-950">引用来源</h4>
                <ul className="mt-2 space-y-2">
                  {a.citations.map((c) => (
                    <li key={c.name} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2.5 text-body-sm">
                      <span className="text-neutral-800">{c.name}</span>
                      <span className="text-caption text-neutral-500">{c.version}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTab('issues')
                      setEditorFor(answerFor.id)
                      setEditorAnswer('')
                      setAnswerFor(null)
                    }}
                    className="h-9 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
                  >
                    补充答案并回归验证
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignTarget([answerFor])
                      setAnswerFor(null)
                    }}
                    className="h-9 rounded-md border border-[#BFD0F2] bg-white px-4 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
                  >
                    指派处理
                  </button>
                </div>
              </div>
            )
          })()}
      </SideDrawer>

      {/* 查看对话 Drawer：该反馈对应的原始对话（2–4 轮） */}
      <SideDrawer open={chatFor !== null} onClose={() => setChatFor(null)} title="原始对话" width={560}>
        {chatFor && (
          <div>
            <p className="mb-3 flex flex-wrap items-center gap-2 text-caption text-neutral-500">
              <span>{chatFor.user} · {chatFor.time}</span>
              {chatFor.source && <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5">来源：{chatFor.source}</span>}
              {chatFor.reason && <span className="rounded-sm bg-danger-bg px-1.5 py-0.5 text-danger">{chatFor.reason}</span>}
            </p>
            <div className="space-y-3">
              {(feedbackConversations[chatFor.id] ?? defaultFeedbackConversation(chatFor.question, chatFor.answerExcerpt)).map((t, i) =>
                t.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%]">
                      <div className="rounded-xl bg-surface-user px-4 py-2.5 text-body text-brand-700">{t.content}</div>
                      <p className="mt-1 text-right text-caption text-neutral-400">{t.time}</p>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[88%]">
                      <div className="rounded-xl bg-surface-assistant px-4 py-2.5 text-body text-neutral-800">{t.content}</div>
                      <p className="mt-1 text-caption text-neutral-400">{t.time} · AI 助手</p>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </SideDrawer>

      {/* 已忽略恢复 L2 确认 */}
      <Modal open={restoreTarget !== null} onClose={() => setRestoreTarget(null)} width={520}>
        {restoreTarget && (
          <ConfirmationCard
            title="恢复为待处理"
            description="恢复后问题重新进入治理队列，30 天观察期终止。"
            fields={[
              { label: '动作', value: '将已忽略问题恢复至待处理队列' },
              { label: '影响对象', value: restoreTarget.question },
              { label: '影响范围', value: `被问 ${restoreTarget.askCount} 次 · 影响 ${restoreTarget.affectedUsers} 名用户` },
              { label: '可撤销性', value: '恢复后可再次忽略并重新设置观察期' },
            ]}
            confirmText="确认恢复"
            onConfirm={confirmRestore}
            onCancel={() => setRestoreTarget(null)}
            className="border-0 p-0 shadow-none"
          />
        )}
      </Modal>

    </div>
  )
}
