/**
 * 工作台 Dashboard（W01，design/dashboard.md）
 * 正式工作台首页：欢迎标题 + 核心指标卡（与 daily 口径一致：128 份文档 / 156 问题 / 12 成员 / 1,240 次问答）
 * + 今日行动（与 daily-todo 同数据源 store.tasks）+ 知识健康度 + 高频问题 + 最近使用趋势 + 快速操作。
 * V1.3：8 步 ProductTour 新手导览（design/onboarding-tour.md，替换原 DashboardTour 4 点引导）
 * + 欢迎横幅「新手引导」重开入口 + 可折叠新手任务清单。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Blocks,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Database,
  Download,
  FileSliders,
  FileStack,
  Flame,
  Folders,
  KeyRound,
  MessageSquareQuote,
  MessagesSquare,
  Network,
  Play,
  Plug,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Upload,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { daily, me, METRICS, org, trend7dRangeLabel, useAppStore } from '@/mocks'
import type { TaskItem } from '@/mocks'
import { trend30d, trend7d } from '@/pages/activation/daily-data'
import {
  CitationCard,
  EmptyState,
  MetricCard,
  ProgressBar,
  ProgressRing,
  SectionCard,
  StatusBadge,
  TaskRow,
} from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { TrendChart } from '@/pages/workspace/TrendChart'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { useAppToast } from '@/lib/toast'
import { KEY_NAMESPACE, loadLSArray, saveLS } from '@/lib/storage'
import {
  LOCAL_UPLOAD_BASE,
  LOCAL_UPLOAD_EVENT,
  QuickConfigDrawer,
  readLocalUploads,
} from '@/pages/workspace/QuickConfigDrawer'
import {
  ProductTour,
  TOUR_DONE_KEY,
  TOUR_START_EVENT,
  TOUR_STATE_EVENT,
  shouldAutoStartTour,
  startProductTour,
} from '@/components/tour/ProductTour'

// ---------- 页面扩展 mock（design/dashboard.md §5，页面级数据，不改全局 store） ----------

const HEALTH_DIMS = [
  { name: '新鲜度', score: 18, max: 20 },
  { name: '完整性', score: 17, max: 20 },
  { name: '一致性', score: 16, max: 20 },
  { name: '可检索性', score: 14, max: 15 },
  { name: 'Owner 覆盖', score: 9, max: 10 },
  { name: '审核状态', score: 8, max: 10 },
  { name: '使用反馈', score: 4, max: 5 },
]

const TOP_TASKS_BAR = ['处理 5 条待处理反馈', '完善 12 个知识问题的答案', '检查知识命中率并优化']

interface TopQuestion {
  question: string
  rate: number
  asks: string[]
  sample: string
  citations: { name: string; version: string; page: string }[]
  feedback: string
}

const TOP_QUESTIONS: TopQuestion[] = [
  {
    question: '差旅报销标准是什么？',
    rate: 98,
    asks: ['出差住宿报销上限', '差旅费怎么报销', '报销标准 2024'],
    sample: '根据《差旅费用报销管理办法》v2.0：一线城市住宿上限 500 元/晚，二线 400 元/晚……',
    citations: [{ name: '《差旅费用报销管理办法》', version: 'v2.0', page: '第 4 页' }],
    feedback: '近 30 天 46 次提问 · 45 次标记答案正确',
  },
  {
    question: '报价折扣审批流程',
    rate: 95,
    asks: ['折扣超过 10% 谁审批', '报价审批流程', '特价申请怎么走'],
    sample: '折扣 ≤10% 销售经理审批；超过 10% 需销售总监审批，超过 20% 需总经理审批。',
    citations: [{ name: '《销售管理制度》', version: 'v2.1', page: '第 8 页' }],
    feedback: '近 30 天 38 次提问 · 36 次标记答案正确',
  },
  {
    question: '产品 X 的核心优势',
    rate: 93,
    asks: ['产品 X 卖点', 'X 和竞品比有什么优势', '产品 X 介绍'],
    sample: '产品 X 主打三点：开箱即用的知识接入、带引用的可信答案、完善的权限同步……',
    citations: [{ name: '《产品 X 白皮书》', version: 'v1.5', page: '第 3 页' }],
    feedback: '近 30 天 29 次提问 · 27 次标记答案正确',
  },
  {
    question: '如何集成你们的 API？',
    rate: 91,
    asks: ['API 怎么接入', 'API Key 申请', '接口鉴权方式'],
    sample: '申请 API Key 并完成鉴权 → 选择对应接口 → 按请求示例构造请求 → 处理返回与错误码。',
    citations: [{ name: 'API 接入指南', version: 'v2.0', page: '第 2 页' }],
    feedback: '近 30 天 24 次提问 · 22 次标记答案正确',
  },
  {
    question: '请假审批需要几天？',
    rate: 89,
    asks: ['请假流程多久', '年假审批时间', '请假要谁批'],
    sample: '3 天以内直属主管审批（1 个工作日内）；3 天以上需部门负责人审批（2 个工作日内）。',
    citations: [{ name: '《审批权限矩阵表》', version: 'v3.0', page: '第 2 页' }],
    feedback: '近 30 天 19 次提问 · 17 次标记答案正确',
  },
]

const CHANNEL_USAGE = [
  { name: '企业微信知识助手', logo: '/logo-wecom.svg', count: 212 },
  { name: '自定义 API', logo: '/logo-api.svg', count: 96 },
  { name: '知识网站', logo: '', count: 158 },
]

const RANK_COLORS = ['bg-warning text-white', 'bg-warning text-white', 'bg-brand-500 text-white', 'bg-neutral-200 text-neutral-500', 'bg-neutral-200 text-neutral-500']

/** 高频问题 Drawer「创建 FAQ」「加入测试集」幂等记录（localStorage） */
const FAQ_CREATED_KEY = KEY_NAMESPACE.dashboard.faqCreated
const TESTSET_ADDED_KEY = KEY_NAMESPACE.dashboard.testsetAdded

const QUICK_ACTIONS = [
  { icon: Upload, name: '上传资料', desc: '文档 / 表格 / 图片', to: '/workspace/knowledge-base' },
  { icon: UserPlus, name: '邀请成员', desc: '邀请加入团队', to: '/workspace/settings' },
  { icon: Bot, name: '创建助手', desc: '配置业务问答助手', to: '/workspace/ai-assistant' },
  { icon: BarChart3, name: '使用分析', desc: '查看趋势与价值', to: '/workspace/analytics' },
]

/** 「查看全部功能」导航卡（dashboard.md V1.1 增补 §C，待办计数与各页 mock 同源；emptyDesc 为空态无数字口径，V1.6 P0-1 补齐） */
const FEATURE_NAV = [
  { icon: Folders, name: '知识空间', desc: '5 个空间 · 2 处冲突待处理', emptyDesc: '按部门与场景组织知识', to: '/workspace/spaces', count: 2 },
  { icon: Network, name: '知识地图', desc: '热点与孤立文档一目了然', emptyDesc: '热点与孤立文档一目了然', to: '/workspace/knowledge-map', count: 0 },
  { icon: Plug, name: '数据来源', desc: '2 个连接器 · 1 次同步失败', emptyDesc: '接入网页与系统数据', to: '/workspace/data-sources', count: 1 },
  { icon: MessagesSquare, name: '对话历史', desc: '156 个问题的完整记录', emptyDesc: '回看团队提问与答案', to: '/workspace/chat-history', count: 0 },
  { icon: FileSliders, name: '指令管理', desc: '回答风格与拒答策略', emptyDesc: '回答风格与拒答策略', to: '/workspace/instructions', count: 0 },
  { icon: Puzzle, name: '集成管理', desc: '4 个集成 · 1 条授权告警', emptyDesc: '连接常用办公平台', to: '/workspace/integrations', count: 1 },
  { icon: KeyRound, name: 'API 与开发', desc: `${METRICS.apiMonthlyCalls.toLocaleString('en-US')} 次调用 · Widget 嵌入`, emptyDesc: '开放 API · Widget 嵌入', to: '/workspace/api-dev', count: 0 },
  { icon: ShieldCheck, name: '权限管理', desc: '五层权限 · 2 人待映射', emptyDesc: '五层权限管控', to: '/workspace/permissions', count: 2 },
]

// ---------- 小组件 ----------

/** 欢迎横幅关闭状态（localStorage；未激活且未关闭时每次进入显示） */
const WELCOME_BANNER_KEY = 'ekb-home-banner-dismissed'

/**
 * 首页优先欢迎横幅（V1.2）：仅未激活时显示在标题区上方。
 * Primary「开始快速配置」打开 QuickConfigDrawer；Secondary「查看完整试用旅程」跳 /trial/apply。
 */
function WelcomeBanner({ onStartConfig, onStartTour }: { onStartConfig: () => void; onStartTour: () => void }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_BANNER_KEY) === '1'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  const close = () => {
    try {
      localStorage.setItem(WELCOME_BANNER_KEY, '1')
    } catch {
      // 存储不可用时仅本次隐藏
    }
    setDismissed(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative w-full flex-1 overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 via-white to-white p-5 shadow-card"
    >
      <button
        type="button"
        onClick={close}
        aria-label="关闭欢迎横幅"
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors duration-micro ease-brand hover:bg-white hover:text-neutral-600"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-5">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-caption font-medium text-brand-600">
            <Sparkles className="h-3.5 w-3.5" />
            欢迎使用
          </p>
          <h2 className="mt-1 text-h2 text-neutral-950">企业知识库</h2>
          <p className="mt-1.5 text-body-sm text-neutral-500">
            上传公司资料，几分钟得到有出处、可验证的 AI 知识助手
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onStartConfig}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
            >
              <Zap className="h-4 w-4" />
              开始快速配置
            </button>
            {/* V1.3 导览手动重开入口（onboarding-tour.md §2.2）；同时作为导览关闭后的焦点归还目标 */}
            <button
              type="button"
              data-tour-restart
              onClick={onStartTour}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
            >
              <Compass className="h-4 w-4" />
              新手引导
            </button>
            <Link
              to="/trial/apply"
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
            >
              查看完整试用旅程
            </Link>
          </div>
        </div>
        <img
          src="/illustration-appcenter.svg"
          alt=""
          className="hidden h-24 w-auto shrink-0 md:block"
        />
      </div>
    </motion.div>
  )
}


/** 新手任务清单收起状态（onboarding-tour.md §8：刷新保持收起态） */
const CHECKLIST_COLLAPSED_KEY = 'kb.checklist.collapsed'

interface StarterItem {
  key: string
  name: string
  done: boolean
  /** 未完成时点击的跳转链接 */
  to?: string
  action?: 'tour' | 'quick-config'
}

/**
 * 新手任务清单（V1.3，onboarding-tour.md §8 建议采纳）：
 * 5 项轻量清单，完成态从 store / localStorage 推导；可收起并记忆；全部完成后变成功态单行。
 * 职责切分：导览讲"在哪"（一次性），清单管"做没做"（持续数日）。
 */
function StarterChecklist({ onOpenQuickConfig }: { onOpenQuickConfig: () => void }) {
  const navigate = useNavigate()
  const { state } = useAppStore()
  // localStorage 中的导览完成态不自触发渲染：监听导览状态广播 + 跨标签 storage 事件
  const [, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    window.addEventListener(TOUR_STATE_EVENT, bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener(TOUR_STATE_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  const tourDone = (() => {
    try {
      return localStorage.getItem(TOUR_DONE_KEY) === '1'
    } catch {
      return false
    }
  })()

  const items: StarterItem[] = [
    { key: 'tour', name: '完成新手导览', done: tourDone, action: 'tour' },
    { key: 'config', name: '完成快速配置', done: state.journey.configProgress >= 100, action: 'quick-config' },
    { key: 'invite', name: '邀请 1 位同事', done: state.journey.invitesSent, to: '/workspace/invite-team' },
    { key: 'app', name: '安装 1 个应用', done: state.journey.userInstalledApps.length > 0, to: '/workspace/apps' },
    { key: 'ask', name: '提出第一个问题', done: state.chatMessages.some((m) => m.role === 'user'), to: '/workspace/ai-assistant' },
  ]
  const doneCount = items.filter((i) => i.done).length
  const allDone = doneCount === items.length

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(CHECKLIST_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const setCollapsedMem = (value: boolean) => {
    try {
      localStorage.setItem(CHECKLIST_COLLAPSED_KEY, value ? '1' : '0')
    } catch {
      // 存储不可用时仅本次生效
    }
    setCollapsed(value)
  }

  const runItem = (item: StarterItem) => {
    if (item.done) return
    if (item.action === 'tour') startProductTour()
    else if (item.action === 'quick-config') onOpenQuickConfig()
    else if (item.to) navigate(item.to)
  }

  // 收起态：32px 圆形进度环按钮，点击重新展开（§8）
  if (collapsed) {
    const radius = 13
    const circumference = 2 * Math.PI * radius
    return (
      <button
        type="button"
        onClick={() => setCollapsedMem(false)}
        aria-label={`展开新手任务清单，已完成 ${doneCount}/${items.length}`}
        title={`新手任务 ${doneCount}/${items.length}`}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full border border-neutral-200 bg-white shadow-card transition-colors duration-micro ease-brand hover:border-brand-300"
      >
        <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="16" cy="16" r={radius} fill="none" stroke="#EAF2FF" strokeWidth="3" />
          <circle
            cx="16"
            cy="16"
            r={radius}
            fill="none"
            stroke={allDone ? '#16A563' : '#2F74FF'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - doneCount / items.length)}
          />
        </svg>
        <span className="text-[10px] font-semibold text-neutral-700">{doneCount}</span>
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
      className="w-full shrink-0 self-start rounded-lg border border-neutral-200 bg-white p-4 shadow-card xl:w-[280px]"
    >
      {allDone ? (
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-body-sm font-medium text-success">
            <span aria-hidden="true">🎉</span>
            新手任务全部完成
          </p>
          <button
            type="button"
            onClick={() => setCollapsedMem(true)}
            className="text-caption text-neutral-400 transition-colors duration-micro ease-brand hover:text-neutral-700"
          >
            收起
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-body font-semibold text-neutral-950">
              <Compass className="h-4 w-4 text-brand-600" />
              新手任务 {doneCount}/{items.length}
            </h3>
            <button
              type="button"
              onClick={() => setCollapsedMem(true)}
              className="text-caption text-neutral-400 transition-colors duration-micro ease-brand hover:text-neutral-700"
            >
              收起
            </button>
          </div>
          <ul className="mt-3 flex flex-col gap-0.5">
            {items.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => runItem(item)}
                  disabled={item.done}
                  className="group flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors duration-micro ease-brand enabled:hover:bg-neutral-50"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-comp ease-brand',
                      item.done ? 'border-success bg-success text-white' : 'border-neutral-300 bg-white',
                    )}
                  >
                    {item.done && <Check className="h-3 w-3" />}
                  </span>
                  <span className={cn('flex-1 text-body-sm', item.done ? 'text-neutral-400 line-through' : 'text-neutral-700')}>
                    {item.name}
                  </span>
                  {!item.done && (
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-300 transition-colors duration-micro ease-brand group-hover:text-brand-500" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </motion.div>
  )
}

/** 数据接入状态（含 1 个「同步中 62%」，10s 后 mock 完成 → 徽标翻「已连接」+ Toast） */
function DataSourceCard({ onSynced }: { onSynced: () => void }) {
  const [syncing, setSyncing] = useState(true)
  const [progress, setProgress] = useState(62)
  /** 本地上传份数与 QuickConfigDrawer 同源（localStorage 计数 + 事件联动） */
  const [localUploads, setLocalUploads] = useState(readLocalUploads)
  const onSyncedRef = useRef(onSynced)
  onSyncedRef.current = onSynced

  useEffect(() => {
    if (!syncing) return
    const timer = setTimeout(() => {
      setProgress(100)
      setSyncing(false)
      onSyncedRef.current()
    }, 10000)
    return () => clearTimeout(timer)
  }, [syncing])

  useEffect(() => {
    const bump = () => setLocalUploads(readLocalUploads())
    window.addEventListener(LOCAL_UPLOAD_EVENT, bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener(LOCAL_UPLOAD_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  const rows = [
    { name: '企业网盘', status: '已连接', meta: '上次同步 10:20' },
    { name: '飞书文档', status: syncing ? '同步中' : '已连接', meta: syncing ? `正在同步 ${progress}%` : '上次同步 刚刚' },
    { name: '本地上传', status: '已导入', meta: `${LOCAL_UPLOAD_BASE + localUploads} 份资料` },
  ]

  return (
    <SectionCard title="数据接入状态" icon={<Database className="h-5 w-5" />}>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-body-sm text-neutral-800">{r.name}</span>
              <StatusBadge status={r.status} />
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-caption text-neutral-400">{r.meta}</span>
              {r.status === '同步中' && <ProgressBar value={progress} className="w-24" barClassName="bg-cyan" />}
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

/** 任务分组（与 daily-todo 同数据源 store.tasks，可折叠） */
function TaskGroup({
  group,
  tasks,
  collapsed,
  onToggle,
  onPrimary,
  onLater,
  onTransfer,
  onSkip,
}: {
  group: string
  tasks: TaskItem[]
  collapsed: boolean
  onToggle: () => void
  onPrimary: (t: TaskItem) => void
  onLater: (t: TaskItem) => void
  onTransfer: (t: TaskItem) => void
  onSkip: (t: TaskItem) => void
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 py-2 text-body-sm font-semibold text-brand-600"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {group}
        <span className="font-normal text-neutral-400">（{tasks.length} 项）</span>
      </button>
      {!collapsed && (
        <div>
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              primaryLabel={t.status === '进行中' ? '完成' : '开始处理'}
              onPrimary={onPrimary}
              onLater={onLater}
              onTransfer={onTransfer}
              onSkip={onSkip}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- 页面 ----------

export default function Dashboard() {
  const navigate = useNavigate()
  const { state, updateTask, addTask, loadDemoData } = useAppStore()
  const toast = useAppToast()
  /** 真实空态起点：未载入演示数据时，运营数据区展示空态卡 */
  const demoOff = state.demoData === false
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([])
  const [activeQuestion, setActiveQuestion] = useState<TopQuestion | null>(null)
  const [quickConfigOpen, setQuickConfigOpen] = useState(false)
  /** 使用趋势范围：近 7 天 / 近 30 天（与 daily 页同数据源） */
  const [trendRange, setTrendRange] = useState<'7' | '30'>('7')

  // V1.3 导览自动触发（onboarding-tour.md §2.1）：未完成 / 版本落后时，指标卡入场后 600ms 启动；仅工作台首页自动启动
  useEffect(() => {
    if (!shouldAutoStartTour()) return
    if (window.innerWidth < 1280) return // 窄屏不自动启动（§7）
    const timer = setTimeout(() => startProductTour(), 600)
    return () => clearTimeout(timer)
  }, [])

  // 导览启动前关闭已打开的 Drawer（§7：先关 Drawer 再启动）
  useEffect(() => {
    const closeDrawers = () => {
      setQuickConfigOpen(false)
      setActiveQuestion(null)
    }
    window.addEventListener(TOUR_START_EVENT, closeDrawers)
    return () => window.removeEventListener(TOUR_START_EVENT, closeDrawers)
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, TaskItem[]>()
    for (const t of state.tasks) {
      const list = map.get(t.group) ?? []
      list.push(t)
      map.set(t.group, list)
    }
    return [...map.entries()]
  }, [state.tasks])

  const handleTaskPrimary = (t: TaskItem) => {
    if (t.status === '进行中') {
      updateTask(t.id, { status: '已完成' })
      toast.success(`已完成「${t.title}」`)
    } else {
      updateTask(t.id, { status: '进行中' })
      toast.info(`已开始处理「${t.title}」`)
    }
  }

  const metrics = [
    { icon: <FileStack className="h-4 w-4" />, name: '知识库文档', value: daily.uploaded, suffix: '份', hint: '较昨日 +6 份', to: '/workspace/knowledge-base' },
    { icon: <MessageSquareQuote className="h-4 w-4" />, name: '累计知识问题', value: daily.questionTotal, suffix: '个', hint: '待处理 23 个', to: '/workspace/feedback' },
    { icon: <Users className="h-4 w-4" />, name: '团队成员', value: daily.members, suffix: '人', hint: '已邀请 · 活跃 9 人', to: '/workspace/settings' },
    { icon: <Zap className="h-4 w-4" />, name: '累计问答', value: daily.usageTotal, suffix: '次', delta: '+12%', deltaDirection: 'up' as const, deltaPositive: true, hint: '较昨日', to: '/workspace/analytics' },
    { icon: <Blocks className="h-4 w-4" />, name: '已安装应用', value: daily.appsInstalled, suffix: '个', hint: '企业微信 · SSO · 自定义 API', to: '/workspace/apps' },
  ]

  const maxChannel = Math.max(...CHANNEL_USAGE.map((c) => c.count))

  const handleLoadDemo = () => {
    loadDemoData()
    toast.success('已载入演示数据')
  }

  /** 导出周报：生成真实 .md 文件并触发下载（口径与各页 mock 一致） */
  const exportWeeklyReport = () => {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    const trendRows = trend7d.map((t) => `| ${t.date} | ${t.value} |`).join('\n')
    const topRows = TOP_QUESTIONS.map(
      (q, i) => `${i + 1}. ${q.question}（成功回答率 ${q.rate}%，${q.feedback}）`,
    ).join('\n')
    const channelRows = CHANNEL_USAGE.map((c) => `- ${c.name}：${c.count} 次`).join('\n')
    const md = `# 企业知识库周报（${org.name}）

> 导出时间：${stamp} · 统计口径：近 7 天（${trend7dRangeLabel()}）

## 核心指标

| 指标 | 数值 |
| --- | --- |
| 本周问答 | ${METRICS.questions7d} 次 |
| 答案认可率 | ${METRICS.approvalRate}% |
| 成功回答率 | ${METRICS.answerRate7d}% |
| 知识库文档 | ${daily.uploaded} 份 |
| 累计知识问题 | ${daily.questionTotal} 个 |
| 累计问答 | ${daily.usageTotal.toLocaleString('en-US')} 次 |
| 团队成员 | ${daily.members} 人 |
| 已安装应用 | ${daily.appsInstalled} 个 |

## 近 7 天使用趋势

| 日期 | 使用次数（次） |
| --- | --- |
${trendRows}

## 高频问题 Top 5

${topRows}

## 应用与渠道使用

${channelRows}

## 知识健康度

综合健康分 86/100。「审核状态」与「使用反馈」维度偏低，建议优先治理：处理 ${daily.pendingFeedback} 条待审核反馈、完善待处理知识问题。
`
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `知识库周报-${stamp}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success('周报已导出，开始下载')
  }

  // ----- 高频问题 Drawer：创建 FAQ / 加入测试集（写入 store.tasks，localStorage 幂等） -----

  const readDoneList = (key: string): string[] => loadLSArray(key, (x): x is string => typeof x === 'string')
  const appendDoneList = (key: string, value: string) => {
    saveLS(key, [...readDoneList(key), value])
  }

  const handleCreateFaq = (q: TopQuestion) => {
    if (readDoneList(FAQ_CREATED_KEY).includes(q.question)) {
      toast.info('该问题已创建过 FAQ 草稿，无需重复创建')
    } else {
      appendDoneList(FAQ_CREATED_KEY, q.question)
      addTask({
        group: '知识完善',
        title: `完善 FAQ 草稿：${q.question}`,
        reason: '由高频问题创建的 FAQ 草稿，待补充标准答案与引用',
        priority: '中',
        status: '待处理',
        due: '本周内',
        owner: me.name,
        route: '/workspace/knowledge-base',
      })
      toast.success('已创建 FAQ 草稿，并加入每日待办（知识完善）')
    }
    setActiveQuestion(null)
  }

  const handleAddTestSet = (q: TopQuestion) => {
    if (readDoneList(TESTSET_ADDED_KEY).includes(q.question)) {
      toast.info('该问题已加入过测试集，无需重复加入')
    } else {
      appendDoneList(TESTSET_ADDED_KEY, q.question)
      addTask({
        group: '知识完善',
        title: `扩充测试集：${q.question}`,
        reason: '高频问题已加入回归测试集，待补充期望答案样本',
        priority: '中',
        status: '待处理',
        due: '本周内',
        owner: me.name,
        route: '/workspace/analytics',
      })
      toast.success('已加入测试集，并生成治理任务（知识完善）')
    }
    setActiveQuestion(null)
  }

  /** 空态卡统一操作区：主按钮载入演示数据 + 快速配置入口 */
  const demoEmptyAction = (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={handleLoadDemo}
        className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
      >
        载入演示数据
      </button>
      <button
        type="button"
        onClick={() => setQuickConfigOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
      >
        开始快速配置
      </button>
    </div>
  )

  /** 快速操作卡（空态/演示两种模式共用） */
  const quickActionsCard = (
    <SectionCard title="快速操作" icon={<Zap className="h-5 w-5" />}>
      <div className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.name}
            to={a.to}
            className="group rounded-lg border border-neutral-200 p-3 transition-all duration-micro ease-brand hover:border-brand-300 hover:shadow-card"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-600 transition-colors duration-micro ease-brand group-hover:bg-brand-100">
              <a.icon className="h-4 w-4" />
            </span>
            <p className="mt-2 text-body-sm font-semibold text-neutral-950">{a.name}</p>
            <p className="mt-0.5 text-caption text-neutral-400">{a.desc}</p>
          </Link>
        ))}
      </div>
    </SectionCard>
  )

  return (
    <div>
      {/* 首页优先欢迎横幅（V1.2，可关闭）+ 新手任务清单（V1.3 §8，与横幅并排/等高） */}
      <div className="mb-4 flex flex-col gap-4 xl:flex-row">
        {!state.journey.activated && (
          <WelcomeBanner onStartConfig={() => setQuickConfigOpen(true)} onStartTour={startProductTour} />
        )}
        <StarterChecklist onOpenQuickConfig={() => setQuickConfigOpen(true)} />
      </div>

      <PageHeader
        crumbs={[]}
        title="工作台"
        subtitle="企业知识库运行概览 · 数据更新于 今天 10:30"
        actions={
          <>
            <Link
              to="/workspace/daily"
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
            >
              <Play className="h-4 w-4" />
              开始处理今日待办
            </Link>
            <button
              type="button"
              data-tour="quick-config"
              onClick={() => setQuickConfigOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
            >
              <Zap className="h-4 w-4" />
              快速配置
            </button>
            <button
              type="button"
              onClick={exportWeeklyReport}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
            >
              <Download className="h-4 w-4" />
              导出周报
            </button>
          </>
        }
      />

      {/* 空态起点（demoData=false）：指标卡组 / 今日行动 / 趋势图表区统一替换为空态卡，快速操作保留 */}
      {demoOff && (
        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="rounded-xl border border-neutral-200 bg-white shadow-card">
            <EmptyState
              title="还没有运营数据"
              description="完成快速配置或载入演示数据后，这里会展示真实的运营数据。"
              action={demoEmptyAction}
            />
          </div>
          {quickActionsCard}
        </motion.div>
      )}

      {!demoOff && (
        <>
      {/* Row 1：核心指标（5 张，与 daily 口径一致） */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {metrics.map((m, i) => (
          <motion.div
            key={m.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: i * 0.07, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <MetricCard
              icon={m.icon}
              name={m.name}
              value={m.value}
              suffix={m.suffix}
              delta={m.delta}
              deltaDirection={m.deltaDirection}
              deltaPositive={m.deltaPositive}
              hint={m.hint}
              onClick={() => navigate(m.to)}
            />
          </motion.div>
        ))}
      </div>

      {/* Row 2：今日行动（8）+ 知识健康度 / 快速操作（4） */}
      <div className="mt-4 grid grid-cols-12 gap-4">
        <motion.div
          className="col-span-12 xl:col-span-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <SectionCard
            title="今日行动"
            icon={<Flame className="h-5 w-5" />}
            actions={
              <Link to="/workspace/daily" className="text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500">
                查看全部 {daily.todos} 项 ›
              </Link>
            }
          >
            {/* 今日 Top 3 高亮条 */}
            <div className="mb-3 rounded-lg bg-brand-50 p-3">
              <p className="text-body-sm font-semibold text-brand-700">今日 Top 3</p>
              <ol className="mt-1.5 flex flex-col gap-1">
                {TOP_TASKS_BAR.map((t, i) => (
                  <li key={t} className="flex items-center gap-2 text-body-sm text-neutral-700">
                    <span className="flex shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white" style={{ width: 18, height: 18 }}>
                      {i + 1}
                    </span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col divide-y divide-neutral-100">
              {groups.map(([group, tasks]) => (
                <TaskGroup
                  key={group}
                  group={group}
                  tasks={tasks}
                  collapsed={collapsedGroups.includes(group)}
                  onToggle={() =>
                    setCollapsedGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]))
                  }
                  onPrimary={handleTaskPrimary}
                  onLater={(t) => {
                    // 与 daily 页统一：仅设置「稍后提醒」，不改变任务状态（不置已跳过）
                    toast.info(`已设置稍后提醒：「${t.title}」将于明天上午再次提醒（24h 内不再重复提醒）`)
                  }}
                  onTransfer={(t) => {
                    updateTask(t.id, { status: '已转交' })
                    toast.info(`已转交「${t.title}」`)
                  }}
                  onSkip={(t) => {
                    updateTask(t.id, { status: '已跳过' })
                    toast.info(`已跳过「${t.title}」`)
                  }}
                />
              ))}
            </div>
          </SectionCard>
        </motion.div>

        <motion.div
          className="col-span-12 flex flex-col gap-4 xl:col-span-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {/* 知识健康度 */}
          <SectionCard
            title="知识健康度"
            icon={<Zap className="h-5 w-5" />}
            actions={
              <Link to="/workspace/feedback" className="text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500">
                查看治理建议 ›
              </Link>
            }
          >
            <div className="flex items-center gap-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
                <ProgressRing value={86} size={96} label="健康分" />
              </motion.div>
              <p className="text-body-sm text-neutral-500">
                7 个维度综合评估，「审核状态」与「使用反馈」偏低，建议优先治理。
              </p>
            </div>
            <ul className="mt-4 flex flex-col gap-2.5">
              {HEALTH_DIMS.map((d) => {
                const pct = Math.round((d.score / d.max) * 100)
                const low = pct < 85
                return (
                  <li key={d.name} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-caption text-neutral-500">{d.name}</span>
                    <ProgressBar value={pct} className="flex-1" barClassName={low ? 'bg-warning' : undefined} />
                    <span className={cn('w-12 shrink-0 text-right text-caption', low ? 'font-medium text-warning' : 'text-neutral-500')}>
                      {d.score}/{d.max}
                    </span>
                  </li>
                )
              })}
            </ul>
          </SectionCard>

          {/* 快速操作 */}
          {quickActionsCard}
        </motion.div>
      </div>

      {/* Row 3：使用趋势 + 高频问题（8）｜ 应用渠道 + 数据接入（4） */}
      <div className="mt-4 grid grid-cols-12 gap-4">
        <motion.div
          className="col-span-12 grid grid-cols-1 gap-4 xl:col-span-8 2xl:grid-cols-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <SectionCard
            title="使用趋势"
            icon={<BarChart3 className="h-5 w-5" />}
            actions={
              <span className="relative inline-flex items-center">
                <select
                  value={trendRange}
                  onChange={(e) => setTrendRange(e.target.value as '7' | '30')}
                  aria-label="趋势时间范围"
                  className="h-8 appearance-none rounded-md border border-neutral-200 bg-white pl-2.5 pr-7 text-body-sm text-neutral-700 outline-none transition-colors duration-micro ease-brand focus:border-brand-500"
                >
                  <option value="7">近 7 天</option>
                  <option value="30">近 30 天</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-neutral-400" />
              </span>
            }
          >
            <p className="mb-1 flex items-center gap-1.5 text-caption text-neutral-400">
              <span className="h-2 w-2 rounded-full bg-brand-500" />
              使用次数（次）
            </p>
            <TrendChart
              values={(trendRange === '7' ? trend7d : trend30d).map((t) => t.value)}
              labels={(trendRange === '7' ? trend7d : trend30d).map((t) => t.date)}
            />
          </SectionCard>

          <SectionCard title="高频问题 Top 5" icon={<MessageSquareQuote className="h-5 w-5" />}>
            <ul className="flex flex-col">
              {TOP_QUESTIONS.map((q, i) => (
                <li key={q.question}>
                  <button
                    type="button"
                    onClick={() => setActiveQuestion(q)}
                    className="flex w-full items-center gap-3 rounded-md px-1 py-2.5 text-left transition-colors duration-micro ease-brand hover:bg-surface-page"
                  >
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-caption font-semibold', RANK_COLORS[i])}>
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body-sm text-neutral-800">{q.question}</span>
                    <span className="shrink-0 rounded-pill bg-success-bg px-2 py-0.5 text-caption font-medium text-success">{q.rate}%</span>
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>
        </motion.div>

        <motion.div
          className="col-span-12 flex flex-col gap-4 xl:col-span-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <SectionCard
            title="应用与渠道使用"
            icon={<Blocks className="h-5 w-5" />}
            actions={
              <Link to="/workspace/apps" className="text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500">
                管理应用 ›
              </Link>
            }
          >
            <ul className="flex flex-col gap-3.5">
              {CHANNEL_USAGE.map((c) => (
                <li key={c.name} className="flex items-center gap-3">
                  {c.logo ? (
                    <img src={c.logo} alt="" className="h-8 w-8 shrink-0 rounded-md" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-600">
                      <BarChart3 className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-body-sm text-neutral-800">{c.name}</span>
                      <span className="shrink-0 text-body-sm font-semibold text-neutral-950">{c.count} 次</span>
                    </div>
                    <ProgressBar value={Math.round((c.count / maxChannel) * 100)} className="mt-1.5" />
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          <DataSourceCard onSynced={() => toast.success('飞书文档同步完成，已接入最新资料')} />
        </motion.div>
      </div>
        </>
      )}

      {/* Row 4：查看全部功能（V1.1 增补 §C，4×2 宫格导航卡） */}
      <motion.div
        className="mt-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.36, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <SectionCard title="查看全部功能" icon={<Blocks className="h-5 w-5" />}>
          <p className="-mt-2 mb-4 text-caption text-neutral-400">8 个专业功能页，覆盖知识运营全链路</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {FEATURE_NAV.map((f, i) => (
              <motion.div
                key={f.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.36 + i * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <Link
                  to={f.to}
                  className="group relative flex h-full items-start gap-3 rounded-lg border border-neutral-200 p-3.5 transition-colors duration-micro ease-brand hover:border-brand-300 hover:bg-surface-selected"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 transition-colors duration-micro ease-brand group-hover:bg-brand-100">
                    <f.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-body font-medium text-neutral-950">{f.name}</span>
                    <span className="mt-0.5 block text-caption text-neutral-500">{demoOff ? f.emptyDesc : f.desc}</span>
                  </span>
                  {!demoOff && f.count > 0 && (
                    <span className="absolute right-2.5 top-2.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-warning px-1 text-[10px] font-semibold text-white">
                      {f.count}
                    </span>
                  )}
                </Link>
              </motion.div>
            ))}
          </div>
        </SectionCard>
      </motion.div>

      {/* 快速配置 Drawer（V1.1 增补 §A/§B） */}
      <QuickConfigDrawer open={quickConfigOpen} onClose={() => setQuickConfigOpen(false)} push={(kind, msg) => toast[kind](msg)} />

      {/* 高频问题详情 Drawer */}
      <SideDrawer
        open={activeQuestion !== null}
        onClose={() => setActiveQuestion(null)}
        title={activeQuestion?.question}
        width={520}
        footer={
          activeQuestion ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleCreateFaq(activeQuestion)}
                className="h-9 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
              >
                创建 FAQ
              </button>
              <button
                type="button"
                onClick={() => handleAddTestSet(activeQuestion)}
                className="h-9 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
              >
                加入测试集
              </button>
            </div>
          ) : undefined
        }
      >
        {activeQuestion && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <span className="rounded-pill bg-success-bg px-2.5 py-1 text-caption font-medium text-success">
                成功回答率 {activeQuestion.rate}%
              </span>
              <span className="text-caption text-neutral-400">{activeQuestion.feedback}</span>
            </div>
            <section>
              <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">原始问法聚类</h4>
              <div className="flex flex-wrap gap-2">
                {activeQuestion.asks.map((a) => (
                  <span key={a} className="rounded-pill bg-neutral-100 px-2.5 py-1 text-caption text-neutral-700">
                    {a}
                  </span>
                ))}
              </div>
            </section>
            <section>
              <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">答案样本</h4>
              <p className="rounded-lg bg-surface-assistant p-3 text-body-sm text-neutral-800">{activeQuestion.sample}</p>
            </section>
            <section>
              <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">引用来源</h4>
              <div className="flex flex-col gap-2">
                {activeQuestion.citations.map((c) => (
                  <CitationCard key={c.name} name={c.name} version={c.version} page={c.page} primary />
                ))}
              </div>
            </section>
          </div>
        )}
      </SideDrawer>

      {/* V1.3 新手导览（替换原 DashboardTour 4 点引导）；Step 8 CTA 打开快速配置 Drawer */}
      <ProductTour onOpenQuickConfig={() => setQuickConfigOpen(true)} />
    </div>
  )
}
