/**
 * 对话历史 ChatHistory（/workspace/chat-history，chat-history.md）
 * Row1 4 张 MetricCard；Row2 筛选工具条（搜索防抖 500ms + 渠道/反馈/时间）；
 * Row3 会话宽表（行点击打开 720px 详情 Drawer：消息时间线 + 引用卡二级抽屉 +
 * 底部「沉淀为 FAQ」/「转治理任务」（写入 store.tasks）/「复制会话链接」）。
 * 主 CTA「导出会话记录」（范围 Modal → Loading → Toast 含文件名与条数）。
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CircleHelp,
  Download,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Search,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/mocks'
import { AnswerCard, CitationCard, ConfirmationCard, EmptyState, MetricCard } from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { Modal } from '@/pages/workspace/Modal'
import { NoAnswerCard } from '@/pages/workspace/NoAnswerCard'
import { CitationDrawer } from '@/pages/workspace/CitationDrawer'
import type { CitationData } from '@/pages/workspace/aiAssistant.mock'
import { useAppToast } from '@/lib/toast'
import {
  CHANNEL_FILTERS,
  CONVERSATIONS,
  DEMO_TODAY,
  FEEDBACK_LABEL,
  TIME_FILTERS,
  conversationDate,
} from '@/pages/workspace/historyData'
import type { Conversation, FeedbackKind } from '@/pages/workspace/historyData'

const BTN_PRIMARY =
  'inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400'
const BTN_SECONDARY =
  'inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600'
const BTN_TERTIARY =
  'inline-flex h-8 items-center gap-1 rounded-md px-2 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50'

type FeedbackFilter = '全部' | '有负反馈' | '无答案' | '已沉淀 FAQ'

const FEEDBACK_FILTER_VALUES: FeedbackFilter[] = ['全部', '有负反馈', '无答案', '已沉淀 FAQ']

const PAGE_SIZE = 20

/** 导出可选字段（自定义范围时可勾选） */
const EXPORT_FIELDS = [
  { key: 'time', label: '时间' },
  { key: 'user', label: '用户' },
  { key: 'channel', label: '渠道' },
  { key: 'question', label: '问题' },
  { key: 'answer', label: '答案摘要' },
  { key: 'feedback', label: '反馈' },
] as const
type ExportFieldKey = (typeof EXPORT_FIELDS)[number]['key']

/** 演示基准日起算，判断 ISO 日期是否在近 N 天内 */
function withinDays(iso: string, days: number) {
  const end = new Date(`${DEMO_TODAY}T00:00:00`).getTime()
  const start = end - (days - 1) * 86400000
  const t = new Date(`${iso}T00:00:00`).getTime()
  return t >= start && t <= end
}

/** 会话 → 答案摘要（导出用） */
function answerSummary(c: Conversation): string {
  const m = c.messages.find((msg) => msg.role === 'assistant')
  if (!m) return ''
  if (m.answer) return m.answer.conclusion
  if (m.refusal) return `未找到可靠答案（${m.refusal.reason}）`
  return m.content
}

function FeedbackBadge({ kind }: { kind: FeedbackKind }) {
  if (kind === 'up')
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-pill bg-success-bg px-2 text-caption font-medium text-success">
        <ThumbsUp className="h-3 w-3" />
        认可
      </span>
    )
  if (kind === 'down')
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-pill bg-danger-bg px-2 text-caption font-medium text-danger">
        <ThumbsDown className="h-3 w-3" />
        有问题
      </span>
    )
  if (kind === 'no-answer')
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-pill bg-info-bg px-2 text-caption font-medium text-info">
        <CircleHelp className="h-3 w-3" />
        无答案
      </span>
    )
  if (kind === 'expired')
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-pill bg-warning-bg px-2 text-caption font-medium text-warning">
        <TriangleAlert className="h-3 w-3" />
        可能过期
      </span>
    )
  return <span className="text-caption text-neutral-400">—</span>
}

export default function ChatHistory() {
  const toast = useAppToast()
  const navigate = useNavigate()
  const { state, addTask, loadDemoData } = useAppStore()
  /** 真实空态起点：指标/筛选/会话列表替换为空态卡 */
  const demoOff = state.demoData === false

  const handleLoadDemo = () => {
    loadDemoData()
    toast.success('已载入演示数据')
  }

  const [conversations, setConversations] = useState<Conversation[]>(CONVERSATIONS)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [channel, setChannel] = useState<(typeof CHANNEL_FILTERS)[number]>('全部渠道')
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackFilter>('全部')
  const [timeFilter, setTimeFilter] = useState<(typeof TIME_FILTERS)[number]>('今天')
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [citation, setCitation] = useState<CitationData | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [faqOpen, setFaqOpen] = useState(false)
  const [govOpen, setGovOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState('当前筛选')
  const [exporting, setExporting] = useState(false)
  const [exportStart, setExportStart] = useState('2026-05-01')
  const [exportEnd, setExportEnd] = useState(DEMO_TODAY)
  const [exportFields, setExportFields] = useState<Set<ExportFieldKey>>(new Set(EXPORT_FIELDS.map((f) => f.key)))
  const [customStart, setCustomStart] = useState('2026-05-23')
  const [customEnd, setCustomEnd] = useState(DEMO_TODAY)
  const [appliedCustom, setAppliedCustom] = useState<{ start: string; end: string } | null>(null)
  const [page, setPage] = useState(1)

  // 搜索防抖 500ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 500)
    return () => clearTimeout(t)
  }, [search])

  /** chip 计数从会话数据派生（与列表筛选口径一致） */
  const feedbackCounts = useMemo(
    () => ({
      有负反馈: conversations.filter((c) => c.feedback === 'down').length,
      无答案: conversations.filter((c) => c.feedback === 'no-answer').length,
    }),
    [conversations],
  )

  const filtered = useMemo(
    () =>
      conversations.filter((c) => {
        if (channel !== '全部渠道' && c.channel !== channel) return false
        if (feedbackFilter === '有负反馈' && c.feedback !== 'down') return false
        if (feedbackFilter === '无答案' && c.feedback !== 'no-answer') return false
        if (feedbackFilter === '已沉淀 FAQ' && !c.settledFaq) return false
        const iso = conversationDate(c)
        if (timeFilter === '今天' && iso !== DEMO_TODAY) return false
        if (timeFilter === '近 7 天' && !withinDays(iso, 7)) return false
        if (timeFilter === '近 30 天' && !withinDays(iso, 30)) return false
        if (timeFilter === '自定义' && appliedCustom && (iso < appliedCustom.start || iso > appliedCustom.end)) return false
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase()
          const hit =
            c.firstQuestion.toLowerCase().includes(q) ||
            c.user.toLowerCase().includes(q) ||
            c.messages.some((m) => m.content.toLowerCase().includes(q))
          if (!hit) return false
        }
        return true
      }),
    [conversations, channel, feedbackFilter, timeFilter, appliedCustom, debouncedSearch],
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const paged = useMemo(() => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filtered, safePage])

  const resetFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setChannel('全部渠道')
    setFeedbackFilter('全部')
    setTimeFilter('今天')
    setAppliedCustom(null)
    setPage(1)
  }

  const patchConversation = (id: string, patch: Partial<Conversation>) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev))
  }

  const handleSettleFaq = () => {
    if (!selected || selected.settledFaq) return
    setActionLoading(true)
    setTimeout(() => {
      patchConversation(selected.id, { settledFaq: true })
      setActionLoading(false)
      setFaqOpen(false)
      toast.success('已创建 FAQ 草稿，待李娜审核')
    }, 800)
  }

  const handleGovern = () => {
    if (!selected || selected.governed) return
    setActionLoading(true)
    setTimeout(() => {
      addTask({
        group: '数据与反馈',
        title: `治理：${selected.firstQuestion}`,
        reason: selected.feedback === 'no-answer' ? '会话无答案，需补充知识' : `用户负反馈：${selected.feedbackReason ?? '答案有问题'}`,
        priority: selected.feedback === 'no-answer' ? '高' : '中',
        status: '待处理',
        due: '本周五',
        owner: '李娜',
      })
      patchConversation(selected.id, { governed: true })
      setActionLoading(false)
      setGovOpen(false)
      toast.success('已转为治理任务，反馈与洞察页同步可见')
    }, 800)
  }

  const handleExport = () => {
    if (exportScope === '自定义' && exportFields.size === 0) {
      toast.warning('请至少勾选一个导出字段。')
      return
    }
    if (exportScope === '自定义' && exportStart > exportEnd) {
      toast.warning('自定义范围的开始日期不能晚于结束日期。')
      return
    }
    setExporting(true)
    setTimeout(() => {
      const list =
        exportScope === '当前筛选'
          ? filtered
          : exportScope === '近 30 天'
            ? conversations.filter((c) => withinDays(conversationDate(c), 30))
            : conversations.filter((c) => {
                const iso = conversationDate(c)
                return iso >= exportStart && iso <= exportEnd
              })
      const fields = exportScope === '自定义' ? exportFields : new Set<ExportFieldKey>(EXPORT_FIELDS.map((f) => f.key))
      const cols = EXPORT_FIELDS.filter((f) => fields.has(f.key))
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
      const lines = [cols.map((f) => esc(f.label)).join(',')]
      list.forEach((c) => {
        const vals: Record<ExportFieldKey, string> = {
          time: c.time,
          user: `${c.user}（${c.dept}）`,
          channel: c.channel,
          question: c.firstQuestion,
          answer: answerSummary(c),
          feedback: FEEDBACK_LABEL[c.feedback],
        }
        lines.push(cols.map((f) => esc(vals[f.key])).join(','))
      })
      const stamp = DEMO_TODAY.replace(/-/g, '')
      const scopeTag = exportScope === '当前筛选' ? 'filtered' : exportScope === '近 30 天' ? '30d' : 'custom'
      const filename = `chat-history-${scopeTag}-${stamp}.csv`
      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setExporting(false)
      setExportOpen(false)
      toast.success(`导出完成：${filename}（${list.length} 条会话）`)
    }, 1600)
  }

  /** 复制会话链接：真实写剪贴板，失败回退 Toast 提示手动复制 */
  const handleCopyLink = () => {
    if (!selected) return
    const url = `${window.location.origin}/workspace/chat-history?c=${selected.id}`
    const fallback = () => toast.warning(`当前浏览器不支持自动复制，请手动复制：${url}`)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => toast.success('会话链接已复制到剪贴板'),
        fallback,
      )
    } else {
      fallback()
    }
  }

  const handleDelete = () => {
    if (!selected) return
    setDeleteLoading(true)
    setTimeout(() => {
      setConversations((prev) => prev.filter((c) => c.id !== selected.id))
      setDeleteLoading(false)
      setDeleteConfirm(false)
      setSelected(null)
      toast.success('会话已删除（仅删除对话记录，不影响业务对象）')
    }, 700)
  }

  const chipCls = (on: boolean) =>
    cn(
      'inline-flex h-8 items-center gap-1 rounded-md border px-3 text-body-sm transition-colors duration-micro ease-brand',
      on ? 'border-brand-500 bg-brand-50 font-medium text-brand-600' : 'border-neutral-200 bg-white text-neutral-700 hover:border-brand-300',
    )

  return (
    <div>
      <PageHeader
        crumbs={['智能助手', '对话历史']}
        title="对话历史"
        subtitle={demoOff ? '完成快速配置或载入演示数据后，这里会展示真实的问答记录' : '累计 156 个问题 · 今日 64 次问答 · 来自 4 个渠道 · 数据更新于 今天 10:30'}
        actions={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => navigate('/workspace/feedback')}>
              {demoOff ? '反馈队列' : '反馈队列（5）'}
            </button>
            {!demoOff && (
              <button type="button" className={BTN_PRIMARY} onClick={() => setExportOpen(true)}>
                <Download className="h-4 w-4" />
                导出会话记录
              </button>
            )}
          </>
        }
      />

      {/* 空态起点：还没有对话记录 */}
      {demoOff ? (
        <div className="rounded-xl border border-neutral-200 bg-white shadow-card">
          <EmptyState
            title="还没有对话记录"
            description="完成快速配置或载入演示数据后，这里会展示真实的对话记录。"
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button type="button" className={BTN_PRIMARY} onClick={handleLoadDemo}>
                  载入演示数据
                </button>
                <button type="button" className={BTN_SECONDARY} onClick={() => navigate('/workspace/quick-config')}>
                  开始快速配置
                </button>
              </div>
            }
          />
        </div>
      ) : (
        <>
      {/* Row1 指标 */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard icon={<MessageSquare className="h-4 w-4" />} name="今日会话" value={64} suffix="次" delta="+12%" deltaDirection="up" deltaPositive hint="较昨日" />
        <MetricCard icon={<ThumbsUp className="h-4 w-4" />} name="答案认可率" value="87.6%" delta="+2.1%" deltaDirection="up" deltaPositive hint="较上周" />
        <MetricCard icon={<ThumbsDown className="h-4 w-4" />} name="负反馈会话" value={5} suffix="条" hint="待处理" />
        <MetricCard icon={<CircleHelp className="h-4 w-4" />} name="无答案问题" value={23} suffix="个" hint="含 3 个高优先级" />
      </div>

      {/* 筛选工具条 */}
      <div className="mb-4 flex min-h-16 flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-card">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="搜索问题、用户或答案内容…"
            className="h-9 w-80 rounded-md border border-[#DCE4EF] pl-8 pr-3 text-body-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input"
          />
        </div>
        <select
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as (typeof CHANNEL_FILTERS)[number])
            setPage(1)
          }}
          className="h-9 rounded-md border border-[#DCE4EF] bg-white px-2.5 text-body-sm text-neutral-800 outline-none focus:border-brand-500"
        >
          {CHANNEL_FILTERS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {FEEDBACK_FILTER_VALUES.map((v) => {
          const count = v === '有负反馈' ? feedbackCounts.有负反馈 : v === '无答案' ? feedbackCounts.无答案 : undefined
          return (
            <button key={v} type="button" className={chipCls(feedbackFilter === v)} onClick={() => { setFeedbackFilter(v); setPage(1) }}>
              {v}
              {count !== undefined && (
                <span className={cn('inline-flex h-4 min-w-4 items-center justify-center rounded-pill px-1 text-[11px]', feedbackFilter === v ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-500')}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
        <select
          value={timeFilter}
          onChange={(e) => {
            setTimeFilter(e.target.value as (typeof TIME_FILTERS)[number])
            setPage(1)
          }}
          className="h-9 rounded-md border border-[#DCE4EF] bg-white px-2.5 text-body-sm text-neutral-800 outline-none focus:border-brand-500"
        >
          {TIME_FILTERS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {timeFilter === '自定义' && (
          <>
            <input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={(e) => setCustomStart(e.target.value)}
              aria-label="开始日期"
              className="h-9 rounded-md border border-[#DCE4EF] bg-white px-2.5 text-body-sm text-neutral-800 outline-none focus:border-brand-500"
            />
            <span className="text-caption text-neutral-400">至</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={DEMO_TODAY}
              onChange={(e) => setCustomEnd(e.target.value)}
              aria-label="结束日期"
              className="h-9 rounded-md border border-[#DCE4EF] bg-white px-2.5 text-body-sm text-neutral-800 outline-none focus:border-brand-500"
            />
            <button
              type="button"
              onClick={() => {
                setAppliedCustom({ start: customStart, end: customEnd })
                setPage(1)
                toast.success(`已应用自定义时间范围：${customStart} ~ ${customEnd}`)
              }}
              className="h-9 rounded-md bg-brand-600 px-3.5 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
            >
              应用
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          <button type="button" className={BTN_TERTIARY} onClick={resetFilters}>
            重置筛选
          </button>
          <span className="text-body-sm text-neutral-500">共 {filtered.length} 条会话</span>
        </div>
      </div>

      {/* 会话表格 */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-body-sm">
            <thead>
              <tr className="h-10 bg-surface-soft text-left text-neutral-500">
                <th className="px-5 font-medium">用户</th>
                <th className="px-3 font-medium">渠道</th>
                <th className="px-3 font-medium">首条问题</th>
                <th className="px-3 text-right font-medium">消息数</th>
                <th className="px-3 font-medium">时间</th>
                <th className="px-3 font-medium">反馈</th>
                <th className="px-5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {paged.map((c) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => setSelected(c)}
                    className={cn(
                      'h-12 cursor-pointer border-t border-neutral-100 transition-colors duration-micro ease-brand hover:bg-neutral-50',
                      selected?.id === c.id && 'bg-surface-selected outline outline-1 outline-brand-300',
                    )}
                  >
                    <td className="px-5">
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-caption font-medium text-brand-600">
                          {c.avatar}
                        </span>
                        <span className="text-neutral-800">{c.user}</span>
                      </span>
                    </td>
                    <td className="px-3 text-neutral-500">{c.channel}</td>
                    <td className="max-w-[320px] truncate px-3 text-neutral-800">{c.firstQuestion}</td>
                    <td className="px-3 text-right text-neutral-800">{c.msgCount}</td>
                    <td className="px-3 text-neutral-500">{c.time}</td>
                    <td className="px-3">
                      <span className="flex items-center gap-1.5">
                        <FeedbackBadge kind={c.feedback} />
                        {c.settledFaq && (
                          <span className="inline-flex h-6 items-center rounded-pill bg-violet-bg px-2 text-caption font-medium text-violet">已沉淀 FAQ</span>
                        )}
                        {c.governed && (
                          <span className="inline-flex h-6 items-center rounded-pill bg-neutral-100 px-2 text-caption font-medium text-neutral-500">已转治理</span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 text-right">
                      <button
                        type="button"
                        className={BTN_TERTIARY}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelected(c)
                        }}
                      >
                        查看详情
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <img src="/empty-docs.svg" alt="" className="w-48 opacity-90" />
            <h3 className="mt-3 text-h3 text-neutral-800">没有找到符合条件的会话</h3>
            <button type="button" className={BTN_TERTIARY + ' mt-2'} onClick={resetFilters}>
              清除筛选
            </button>
          </div>
        )}
        <footer className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-caption text-neutral-500">
          <span>
            {filtered.length === 0 ? '0–0' : `${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + paged.length}`} / 共 {filtered.length} 条
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage(safePage - 1)}
              className="h-7 rounded-md border border-neutral-200 px-2 text-neutral-600 transition-colors duration-micro ease-brand hover:border-brand-300 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:border-neutral-200"
            >
              上一页
            </button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={cn(
                  'h-7 rounded-md px-2.5 transition-colors duration-micro ease-brand',
                  p === safePage ? 'bg-brand-600 text-white' : 'border border-neutral-200 text-neutral-600 hover:border-brand-300',
                )}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              disabled={safePage === pageCount}
              onClick={() => setPage(safePage + 1)}
              className="h-7 rounded-md border border-neutral-200 px-2 text-neutral-600 transition-colors duration-micro ease-brand hover:border-brand-300 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:border-neutral-200"
            >
              下一页
            </button>
          </span>
        </footer>
      </section>
        </>
      )}

      {/* 会话详情 Drawer 720px */}
      <SideDrawer
        open={!!selected}
        onClose={() => {
          setSelected(null)
          setMenuOpen(false)
        }}
        title={selected ? `${selected.user} 的会话` : ''}
        width={720}
        footer={
          selected && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className={BTN_TERTIARY}
                onClick={handleCopyLink}
              >
                <Link2 className="h-4 w-4" />
                复制会话链接
              </button>
              <div className="flex items-center gap-2">
                {(selected.feedback === 'no-answer' || selected.feedback === 'down') &&
                  (selected.governed ? (
                    <span className="inline-flex h-10 items-center rounded-md bg-neutral-100 px-4 text-body-sm text-neutral-400">已转治理 ✓</span>
                  ) : (
                    <button type="button" className={BTN_SECONDARY} onClick={() => setGovOpen(true)}>
                      转为治理任务
                    </button>
                  ))}
                {selected.feedback === 'up' &&
                  (selected.settledFaq ? (
                    <span className="inline-flex h-10 items-center rounded-md bg-neutral-100 px-4 text-body-sm text-neutral-400">已沉淀 ✓</span>
                  ) : (
                    <button type="button" className={BTN_PRIMARY} onClick={() => setFaqOpen(true)}>
                      沉淀为 FAQ
                    </button>
                  ))}
              </div>
            </div>
          )
        }
      >
        {selected && (
          <div>
            {/* 头部元信息 */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-body font-medium text-brand-600">
                  {selected.avatar}
                </span>
                <div>
                  <p className="text-body font-medium text-neutral-950">
                    {selected.user}
                    <span className="ml-2 text-caption text-neutral-400">{selected.dept}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-caption text-neutral-500">
                    <span className="inline-flex h-5 items-center rounded-sm bg-neutral-100 px-1.5">{selected.channel}</span>
                    {selected.time} · {selected.msgCount} 条消息
                  </p>
                </div>
              </div>
              <div className="relative">
                <button
                  type="button"
                  aria-label="更多操作"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-9 z-10 w-36 rounded-lg border border-neutral-200 bg-white py-1 shadow-float">
                    <button
                      type="button"
                      className="flex w-full items-center px-3 py-2 text-left text-body-sm text-danger hover:bg-danger-bg"
                      onClick={() => {
                        setMenuOpen(false)
                        setDeleteConfirm(true)
                      }}
                    >
                      删除会话
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 外部访客权限提示 */}
            {selected.external && (
              <p className="mb-3 rounded-lg bg-neutral-100 px-3 py-2 text-caption text-neutral-500">
                按当前权限仅显示摘要：外部访客会话的完整内容仅管理员可见。
              </p>
            )}

            {/* 负反馈条 */}
            {selected.feedback === 'down' && (
              <p className="mb-3 rounded-lg bg-danger-bg px-3 py-2 text-body-sm text-danger">
                用户反馈：答案有问题 — 原因：{selected.feedbackReason ?? '未填写'}
              </p>
            )}

            {/* 消息时间线 */}
            <div className="space-y-3">
              {selected.messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[75%]">
                      <div className="rounded-xl bg-surface-user px-4 py-2.5 text-body text-brand-700">{m.content}</div>
                      <p className="mt-1 text-right text-caption text-neutral-400">{m.time}</p>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-start">
                    <div className="max-w-[88%]">
                      {m.answer ? (
                        <AnswerCard
                          question={selected.firstQuestion}
                          conclusion={m.answer.conclusion}
                          explanation={m.answer.explanation}
                          citations={m.answer.citations.length}
                          trust={m.answer.trust}
                          feedback={selected.feedback === 'down' ? 'wrong' : 'correct'}
                          className="shadow-none"
                        >
                          <div className="mt-3 space-y-2">
                            {m.answer.citations.map((ct) => (
                              <CitationCard
                                key={ct.name}
                                name={ct.name}
                                version={ct.version}
                                page={ct.page}
                                primary={ct.primary}
                                onClick={() => setCitation(ct)}
                              />
                            ))}
                          </div>
                        </AnswerCard>
                      ) : m.refusal ? (
                        <NoAnswerCard
                          data={m.refusal}
                          onUpload={() => navigate('/workspace/knowledge-base')}
                          onAssign={() => setGovOpen(true)}
                          onRephrase={() => navigate('/workspace/ai-assistant')}
                        />
                      ) : (
                        <div className="rounded-xl bg-surface-assistant px-4 py-2.5 text-body text-neutral-800">{m.content}</div>
                      )}
                      <p className="mt-1 text-caption text-neutral-400">{m.time} · AI 助手</p>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </SideDrawer>

      {/* 引用二级抽屉 */}
      <CitationDrawer citation={citation} onClose={() => setCitation(null)} />

      {/* 沉淀为 FAQ 草稿卡 */}
      <Modal open={faqOpen} onClose={() => setFaqOpen(false)} width={560}>
        {selected && (
          <div className="rounded-xl">
            <h3 className="text-h3 text-neutral-950">沉淀为 FAQ</h3>
            <p className="mt-1 text-body-sm text-neutral-500">将本次问答沉淀为标准化 FAQ，审核通过后进入知识库。</p>
            <dl className="mt-4 space-y-3 rounded-lg bg-surface-soft p-4 text-body-sm">
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">FAQ 标题</dt><dd className="text-neutral-800">{selected.firstQuestion}</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">适用范围</dt><dd className="text-neutral-800">全部知识（默认空间）</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">Owner</dt><dd className="text-neutral-800">张伟</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">有效期</dt><dd className="text-neutral-800">建议 365 天复审</dd></div>
            </dl>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={() => setFaqOpen(false)}>
                取消
              </button>
              <button type="button" className={BTN_PRIMARY} disabled={actionLoading} onClick={handleSettleFaq}>
                {actionLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                确认创建 FAQ 草稿
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 转治理任务卡 */}
      <Modal open={govOpen} onClose={() => setGovOpen(false)} width={560}>
        {selected && (
          <div>
            <h3 className="text-h3 text-neutral-950">转为治理任务</h3>
            <p className="mt-1 text-body-sm text-neutral-500">创建后将在「反馈与洞察」与「每日待办」中同步出现。</p>
            <dl className="mt-4 space-y-3 rounded-lg bg-surface-soft p-4 text-body-sm">
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">问题类型</dt><dd className="text-neutral-800">{selected.feedback === 'no-answer' ? '无答案问题' : '低质量答案（用户负反馈）'}</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">问题</dt><dd className="text-neutral-800">{selected.firstQuestion}</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">推荐 Owner</dt><dd className="text-neutral-800">李娜（知识管理员）</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">优先级</dt><dd className="text-neutral-800">{selected.feedback === 'no-answer' ? '高' : '中'}</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">截止时间</dt><dd className="text-neutral-800">本周五</dd></div>
            </dl>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={() => setGovOpen(false)}>
                取消
              </button>
              <button type="button" className={BTN_PRIMARY} disabled={actionLoading} onClick={handleGovern}>
                {actionLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                确认创建治理任务
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 删除会话 L2 */}
      <Modal open={deleteConfirm} onClose={() => setDeleteConfirm(false)} width={480}>
        <ConfirmationCard
          title="删除会话"
          fields={[
            { label: '动作', value: `删除「${selected?.user}」的这条会话记录` },
            { label: '影响范围', value: '仅删除对话记录，不删除任何业务对象（FAQ / 治理任务保留）' },
            { label: '可撤销性', value: '删除后不可恢复' },
          ]}
          confirmText="确认删除"
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(false)}
        />
      </Modal>

      {/* 导出范围 Modal */}
      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="导出会话记录"
        description="选择导出范围，生成 CSV 文件"
        width={480}
        footer={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => setExportOpen(false)}>
              取消
            </button>
            <button type="button" className={BTN_PRIMARY} disabled={exporting} onClick={handleExport}>
              {exporting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {exporting ? '正在生成导出文件…' : '开始导出'}
            </button>
          </>
        }
      >
        <div className="space-y-2">
          {['当前筛选', '近 30 天', '自定义'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setExportScope(s)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg border p-3.5 text-left transition-colors duration-micro ease-brand',
                exportScope === s ? 'border-[1.5px] border-brand-500 bg-surface-cardSel' : 'border-neutral-200 hover:border-brand-300',
              )}
            >
              <span>
                <span className="block text-body-sm font-medium text-neutral-950">{s}</span>
                <span className="mt-0.5 block text-caption text-neutral-500">
                  {s === '当前筛选'
                    ? `按当前筛选条件导出（约 ${filtered.length} 条）`
                    : s === '近 30 天'
                      ? `导出近 30 天全部 ${conversations.filter((c) => withinDays(conversationDate(c), 30)).length} 条会话`
                      : '自定义时间范围与字段'}
                </span>
              </span>
              <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border', exportScope === s ? 'border-brand-600 bg-brand-600' : 'border-neutral-300')}>
                {exportScope === s && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
            </button>
          ))}
        </div>
        {exportScope === '自定义' && (
          <div className="mt-3 space-y-3 rounded-lg border border-neutral-200 bg-surface-soft p-3.5">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={exportStart}
                max={exportEnd}
                onChange={(e) => setExportStart(e.target.value)}
                aria-label="导出开始日期"
                className="h-9 rounded-md border border-[#DCE4EF] bg-white px-2.5 text-body-sm text-neutral-800 outline-none focus:border-brand-500"
              />
              <span className="text-caption text-neutral-400">至</span>
              <input
                type="date"
                value={exportEnd}
                min={exportStart}
                max={DEMO_TODAY}
                onChange={(e) => setExportEnd(e.target.value)}
                aria-label="导出结束日期"
                className="h-9 rounded-md border border-[#DCE4EF] bg-white px-2.5 text-body-sm text-neutral-800 outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-caption text-neutral-500">导出字段</span>
              {EXPORT_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-1.5 text-body-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={exportFields.has(f.key)}
                    onChange={() =>
                      setExportFields((prev) => {
                        const next = new Set(prev)
                        if (next.has(f.key)) next.delete(f.key)
                        else next.add(f.key)
                        return next
                      })
                    }
                    className="h-4 w-4 accent-brand-600"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        )}
        {exporting && (
          <p className="mt-3 rounded-lg bg-surface-soft px-3 py-2 text-caption text-neutral-500">
            正在汇总会话与引用数据，数据量较大时可能需要几秒钟…
          </p>
        )}
      </Modal>

    </div>
  )
}
