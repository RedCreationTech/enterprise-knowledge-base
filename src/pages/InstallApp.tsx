/**
 * 应用中心 /workspace/apps（V1.3 迁入 WorkspaceShell；原 /trial/apps 已 301）
 * 标题区：面包屑「应用与集成 / 应用中心」+ H1 + 副标题 + Secondary「提交需求」
 * 三栏：左小知推荐面板 / 中浅蓝 Banner + 搜索 + 分类 Tab + 2 列 AppCard 网格 / 右应用详情栏（主 CTA「安装并开始试用」）
 * 栅格：≥1536 3+6+3；1366–1535 详情栏转 400px Drawer；1280–1365 AI 面板折叠为可展开摘要条
 * 安装走 4 步 Modal（权限→范围→授权→安装测试）；试用期「暂不安装」必须选原因 → SKIPPED_WITH_REASON → /workspace/daily
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { motion } from 'framer-motion'
import {
  AppWindow,
  AtSign,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  Clock,
  Code2,
  Download,
  FileText,
  Globe,
  KeyRound,
  Link2,
  MessageSquare,
  MoreHorizontal,
  PanelRight,
  RefreshCw,
  Search,
  SendHorizontal,
  ShieldCheck,
  Ticket,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { ANSWER_POOL, apps as baseApps, daily, isStepDone, JOURNEY_STEPS, useAppStore } from '@/mocks'
import type { AppStatus } from '@/mocks'
import { ChatPanel } from '@/components/chat'
import { ConfirmationCard, SectionCard, StatusBadge } from '@/components/common'
import { Modal } from '@/pages/activation/ui'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { useAppToast } from '@/lib/toast'
import {
  APP_DOCS,
  APP_TABS,
  appExtras,
  CUSTOM_API_CONFIG,
  DEFAULT_APP_SETTINGS,
  INSTALL_TEST_STEPS,
  NOTIFY_OPTIONS,
  PERMISSION_GROUPS,
  SKIP_REASONS,
  SPACE_OPTIONS,
} from '@/pages/activation/apps-data'
import type { AppExtra, AppSettings } from '@/pages/activation/apps-data'

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1]
const PAGE = '/workspace/apps'

type SettingsTab = 'scope' | 'notify' | 'auth' | 'danger'
const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
  { key: 'scope', label: '知识范围' },
  { key: 'notify', label: '通知与推送' },
  { key: 'auth', label: '授权信息' },
  { key: 'danger', label: '危险区' },
]

/** 视口媒体查询（栅格断点 JS 侧判定：详情栏 Drawer <1536） */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    onChange()
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

const SCENE_ICONS: Record<string, LucideIcon> = {
  panel: PanelRight,
  users: Users,
  doc: FileText,
  link: Link2,
  bell: Bell,
  web: Globe,
  clock: Clock,
  ticket: Ticket,
  at: AtSign,
  code: Code2,
  key: KeyRound,
  chart: BarChart3,
  report: FileText,
  sync: RefreshCw,
  shield: ShieldCheck,
}

const AI_MSG_1 = '基于你的工作流程，我为你推荐：'
const AI_MSG_2 =
  '它将帮助你：\n✓ 在飞书内快速检索内部知识，减少来回切换\n✓ 基于知识库给出准确回答，并附上来源链接\n✓ 可在群聊/文档/IM 中一键分享答案'
const AI_MSG_3 = '是否需要我帮你安装并配置该应用？'

const INSTALL_STEP_TITLES = ['权限确认', '选择范围', '授权', '安装与测试']

interface DisplayApp {
  id: string
  name: string
  logo: string
  status: AppStatus
  extra: AppExtra
}

export default function InstallApp() {
  const toast = useAppToast()
  const { state, installApp, uninstallApp, skipApps, addFeedback, pushAssistantMessage, setReplyScript } = useAppStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  /** V1.3：从 Stepper / 邀请页进入时带 ?from=trial（提示条带返回旅程语义） */
  const fromTrial = searchParams.get('from') === 'trial'
  const trial = !state.journey.activated
  /** <1536 详情栏转 Drawer（1366–1535 与 1280–1365 共用） */
  const below2xl = useMediaQuery('(max-width: 1535px)')

  const [selectedId, setSelectedId] = useState('feishu-qa')
  const [tab, setTab] = useState<string>('全部')
  const [query, setQuery] = useState('')
  const [highlightApi, setHighlightApi] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [aiStripOpen, setAiStripOpen] = useState(false)

  // Modal 状态
  const [installOpen, setInstallOpen] = useState(false)
  const [installStep, setInstallStep] = useState(0)
  const [authorizing, setAuthorizing] = useState(false)
  const [testProgress, setTestProgress] = useState(-1) // -1 未开始 / 0..3 进行中 / 4 完成
  const [scopeSel, setScopeSel] = useState<string[]>(['默认空间（全部知识）'])
  const [deptSel, setDeptSel] = useState<string[]>(['销售团队', '售前团队'])
  const [skipOpen, setSkipOpen] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [uninstallWord, setUninstallWord] = useState('')
  const [needOpen, setNeedOpen] = useState(false)
  const [needText, setNeedText] = useState('')

  // 应用设置 Drawer（知识范围 / 通知与推送 / 授权信息 / 危险区）
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('scope')
  const [settingsMap, setSettingsMap] = useState<Record<string, AppSettings>>({})
  const [scopeDraft, setScopeDraft] = useState<string[]>([])
  const [notifyDraft, setNotifyDraft] = useState<Record<string, boolean>>({})
  const [reauthOpen, setReauthOpen] = useState(false)
  const [reauthLoading, setReauthLoading] = useState(false)
  // 详情栏 Drawer：权限详情 / 应用文档 / OpenAPI 配置 / 调用统计
  const [permDrawerOpen, setPermDrawerOpen] = useState(false)
  const [docDrawerOpen, setDocDrawerOpen] = useState(false)
  const [apiConfigOpen, setApiConfigOpen] = useState(false)
  const [apiStatsOpen, setApiStatsOpen] = useState(false)
  const [apiEndpoint, setApiEndpoint] = useState(CUSTOM_API_CONFIG.endpoint)
  const [apiHeaderKey, setApiHeaderKey] = useState('sk-live-••••••3f9a')
  const [apiTesting, setApiTesting] = useState(false)
  const [apiTestReceipt, setApiTestReceipt] = useState<string | null>(null)
  // 预览区可提问
  const [previewMsgs, setPreviewMsgs] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [previewInput, setPreviewInput] = useState('')

  const gridRef = useRef<HTMLDivElement>(null)
  /** AppCard 引用：Drawer 关闭后焦点返回卡片 */
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // ----- 会话种子 -----
  useEffect(() => {
    if (!state.chatMessages.some((m) => m.page === PAGE && m.content.includes('我为你推荐'))) {
      pushAssistantMessage(AI_MSG_1, PAGE)
      pushAssistantMessage(AI_MSG_2, PAGE)
      pushAssistantMessage(AI_MSG_3, PAGE)
    }
    setReplyScript(() => '你可以直接点击应用卡片查看详情；如果团队不使用这些平台，也可以选择「暂不安装」并告诉我原因。')
    return () => setReplyScript(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ----- Drawer：Esc 关闭（<1536 详情栏 Drawer 模式） -----
  useEffect(() => {
    if (!detailOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailOpen, selectedId])

  // ----- 数据 -----
  const displayApps: DisplayApp[] = useMemo(
    () =>
      baseApps.map((a) => {
        const extra = appExtras.find((e) => e.id === a.id)!
        const status: AppStatus = state.journey.installedApps.includes(a.id)
          ? '已安装'
          : a.status === '需要授权'
            ? '需要授权'
            : '可试用'
        return { id: a.id, name: a.name, logo: a.logo, status, extra }
      }),
    [state.journey.installedApps],
  )

  const filtered = useMemo(
    () =>
      displayApps.filter(
        (a) =>
          (tab === '全部' || a.extra.category === tab) &&
          (query.trim() === '' || a.name.includes(query.trim()) || a.extra.usage.includes(query.trim())),
      ),
    [displayApps, tab, query],
  )

  /** 详情侧栏与过滤结果同步：选中项不在结果中时自动选中第一个；无结果时清空（详情栏转空态） */
  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedId !== '') setSelectedId('')
      return
    }
    if (!filtered.some((a) => a.id === selectedId)) setSelectedId(filtered[0].id)
  }, [filtered, selectedId])

  const selected = displayApps.find((a) => a.id === selectedId) ?? null
  /** Modal 兜底：安装/管理 Modal 仅在选中有效应用时可打开，过滤清空时不致崩溃 */
  const modalApp = selected ?? displayApps[0]

  /** 应用设置（未配置过的应用回落默认值） */
  const getSettings = (appId: string): AppSettings => settingsMap[appId] ?? DEFAULT_APP_SETTINGS
  const selectedScope = selected ? getSettings(selected.id).scope.join('、') : ''
  /** Banner 统计：与 apps mock 同源（已安装 3 · 可试用 5，安装后自动 +1/-1） */
  const installedCount = displayApps.filter((a) => a.status === '已安装').length
  const trialCount = displayApps.filter((a) => a.status === '可试用').length

  /** 选中卡片：<1536 打开详情 Drawer；≥1536 仅高亮（详情栏常驻） */
  const selectApp = (id: string) => {
    setSelectedId(id)
    // 切换应用时清空预览问答记录
    setPreviewMsgs([])
    setPreviewInput('')
    if (below2xl) setDetailOpen(true)
  }

  const closeDetail = () => {
    setDetailOpen(false)
    cardRefs.current[selectedId]?.focus()
  }

  /** 试用提示条「查看试用进度 ›」：回旅程最近未完成步（全完成则去 activated 交接页） */
  const goTrialProgress = () => {
    const idx = JOURNEY_STEPS.findIndex((_, i) => !isStepDone(state.journey, i))
    if (idx === -1) {
      navigate('/trial/activated')
      return
    }
    const path = JOURNEY_STEPS[idx].path
    navigate(path === '/trial/apps' ? '/workspace/apps?from=trial' : path === '/trial/daily' ? '/workspace/daily?from=trial' : path)
  }

  // ----- 交互 -----
  const handleChip = (chip: string) => {
    if (chip === '查看更多应用') {
      setTab('全部')
      setQuery('')
      gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (chip === '如何自定义应用？') {
      selectApp('custom-api')
      setTab('全部')
      setHighlightApi(true)
      setTimeout(() => setHighlightApi(false), 1600)
      pushAssistantMessage('可以通过「自定义 API」应用，使用 OpenAPI 将可信答案接入你的自有系统。已为你定位到该卡片。', PAGE)
    }
  }

  const openInstall = () => {
    setInstallStep(0)
    setTestProgress(-1)
    setAuthorizing(false)
    setInstallOpen(true)
  }

  const closeInstall = () => {
    setInstallOpen(false)
    setInstallStep(0)
    setTestProgress(-1)
    setAuthorizing(false)
  }

  const startAuthorize = () => {
    setAuthorizing(true)
    setTimeout(() => {
      setAuthorizing(false)
      setInstallStep(3)
      // 安装测试子步骤逐步打勾（各 600ms）
      INSTALL_TEST_STEPS.forEach((_, i) => {
        setTimeout(() => setTestProgress(i + 1), 600 * (i + 1))
      })
    }, 2000)
  }

  const finishInstall = () => {
    // 单源：installApp 幂等加入 installedApps，同时从 uninstalledApps 移除（重新安装）
    installApp(modalApp.id)
    toast.success(`${modalApp.name}已安装`)
    closeInstall()
  }

  const confirmSkip = () => {
    if (!skipReason) return
    skipApps()
    toast.info(`已跳过安装应用（原因：${skipReason}）`)
    setSkipOpen(false)
    navigate('/workspace/daily')
  }

  const submitNeed = () => {
    if (!needText.trim()) return
    addFeedback({ type: 'no-answer', question: needText.trim(), source: 'install-app', note: '应用需求' })
    toast.success('需求已提交，我们会尽快评估')
    setNeedText('')
    setNeedOpen(false)
  }

  const doUninstall = () => {
    if (uninstallWord !== '卸载') return
    // 单源：从 store.installedApps 移除并记入 uninstalledApps（persist 到 ekb-store-v1，刷新不丢）
    uninstallApp(modalApp.id)
    toast.success(`${modalApp.name}已卸载，操作已记录审计日志`)
    setUninstallWord('')
    setSettingsOpen(false)
  }

  /** 打开应用设置 Drawer 并同步草稿（知识范围 / 通知开关） */
  const openSettings = (appId: string, tabKey: SettingsTab = 'scope') => {
    setSelectedId(appId)
    const s = getSettings(appId)
    setScopeDraft(s.scope)
    setNotifyDraft(s.notify)
    setSettingsTab(tabKey)
    setUninstallWord('')
    setSettingsOpen(true)
  }

  const patchSettings = (appId: string, patch: Partial<AppSettings>) => {
    setSettingsMap((prev) => ({ ...prev, [appId]: { ...getSettings(appId), ...patch } }))
  }

  const saveScope = () => {
    if (scopeDraft.length === 0) return
    patchSettings(modalApp.id, { scope: scopeDraft })
    toast.success('知识范围已保存，渠道内将按新范围引用知识')
  }

  const saveNotify = () => {
    patchSettings(modalApp.id, { notify: notifyDraft })
    toast.success('通知偏好已保存')
  }

  const handleReauth = () => {
    setReauthLoading(true)
    setTimeout(() => {
      setReauthLoading(false)
      setReauthOpen(false)
      patchSettings(modalApp.id, { authExpiry: '2025-03-15' })
      toast.success('重新授权成功，有效期顺延 180 天至 2025-03-15')
    }, 1200)
  }

  /** 预览区提问：命中折扣/质保类走 ANSWER_POOL 权威答案，否则通用拒答 */
  const sendPreviewQuestion = () => {
    const q = previewInput.trim()
    if (!q) return
    const hitKey = q.includes('折扣')
      ? '客户报价折扣超过 10% 需要谁审批？'
      : q.includes('质保') || q.includes('保修')
        ? '质保期如何计算？'
        : null
    const hit = hitKey ? ANSWER_POOL[hitKey] : null
    const aiText = hit
      ? `${hit.conclusion}\n${hit.explanation}`
      : '抱歉，该问题超出当前知识范围，暂时无法给出可信回答。可前往反馈中心提交该问题，帮助我们补充知识。'
    setPreviewMsgs((prev) => [...prev, { role: 'user', text: q }, { role: 'ai', text: aiText }])
    setPreviewInput('')
  }

  /** custom-api：测试连接（900ms 成功回执） */
  const testApiConnection = () => {
    setApiTesting(true)
    setApiTestReceipt(null)
    setTimeout(() => {
      setApiTesting(false)
      setApiTestReceipt('连接成功 · 响应 200 · 耗时 182ms · 字段映射校验通过')
    }, 900)
  }

  const installingAppName = modalApp.name

  return (
    <div className="flex flex-col gap-5">

      {/* 标题区（Workspace 规范：面包屑 + H1 + 副标题 + 右侧 Secondary「提交需求」） */}
      <PageHeader
        crumbs={['应用与集成', '应用中心']}
        title="应用中心"
        subtitle="安装应用，让知识库进入飞书、钉钉、企业微信、官网与业务系统"
        actions={
          <button
            type="button"
            onClick={() => setNeedOpen(true)}
            className="inline-flex h-10 shrink-0 items-center rounded-md border border-[#BFD0F2] bg-white px-4 text-body text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
          >
            提交需求
          </button>
        }
      />

      {/* 试用提示条（仅试用期；激活后不显示） */}
      {trial && (
        <div className="flex h-8 items-center justify-between gap-3 rounded-lg bg-brand-100 px-3">
          <span className="truncate text-body-sm text-brand-700">
            🧭 试用第 {daily.trialDay} 天 · 安装 1 个应用可推进激活进度
          </span>
          <button
            type="button"
            onClick={goTrialProgress}
            className="shrink-0 text-body-sm font-medium text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500 hover:underline"
          >
            {fromTrial ? '返回试用旅程 ›' : '查看试用进度 ›'}
          </button>
        </div>
      )}

      <div className="grid items-start gap-4 min-[1366px]:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)_360px]">
        {/* 左栏：AI 推荐面板（≥1366 显示；1280–1365 折叠为 Banner 下摘要条） */}
        <ChatPanel
          className="hidden h-[640px] min-[1366px]:block 2xl:sticky 2xl:top-[88px]"
          chips={['查看更多应用', '如何自定义应用？']}
          selectedChip="查看更多应用"
          onChipSelect={handleChip}
          composerPlaceholder="向小知提问，获取应用推荐或集成建议…"
          timelineFooter={
            <>
              <button
                type="button"
                onClick={() => setSelectedId('feishu-qa')}
                className="flex w-full items-start gap-2.5 rounded-lg border border-neutral-200 bg-white p-3 text-left shadow-card transition-colors duration-micro ease-brand hover:border-brand-300"
              >
                <img src="/logo-feishu.svg" alt="" className="h-10 w-10 shrink-0 rounded-md" />
                <span>
                  <span className="block text-body-sm font-semibold text-neutral-950">飞书问答插件</span>
                  <span className="mt-0.5 block text-caption text-neutral-500">
                    在飞书侧边栏直接提问，获取企业知识库的准确信息与 SOP，支持引用出处与一键分享。
                  </span>
                </span>
              </button>
            </>
          }
        />

        {/* 中栏：应用网格 */}
        <div ref={gridRef} className="flex min-w-0 flex-col gap-4">
          {/* Banner（浅蓝横条卡：h3 + caption 统计句，插画 ≤120px；display 级标题已下移至标题区） */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="flex h-[120px] items-center justify-between overflow-hidden rounded-2xl bg-brand-50 px-6"
          >
            <div>
              <h3 className="text-h3 text-neutral-950">扩展你的知识能力</h3>
              <p className="mt-1 text-caption text-neutral-500">
                已安装 {installedCount} 个 · 可试用 {trialCount} 个
              </p>
            </div>
            <img src="/illustration-appcenter.svg" alt="" className="hidden max-h-[120px] w-auto shrink-0 md:block" />
          </motion.div>

          {/* AI 推荐摘要条（1280–1365 Sidebar 图标模式：点击展开为内联面板） */}
          <div className="hidden xl:block min-[1366px]:hidden">
            <button
              type="button"
              onClick={() => setAiStripOpen((v) => !v)}
              className="flex h-12 w-full items-center justify-between rounded-xl bg-brand-50 px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:bg-brand-100"
            >
              <span className="truncate">💡 小知推荐：飞书问答插件 ›</span>
              <ChevronRight className={cn('h-4 w-4 shrink-0 text-brand-600 transition-transform duration-comp ease-brand', aiStripOpen && 'rotate-90')} />
            </button>
            <div className={cn('grid transition-[grid-template-rows] duration-comp ease-brand', aiStripOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
              <div className="overflow-hidden">
                <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-card">
                  <p className="text-body-sm text-neutral-800">{AI_MSG_1}</p>
                  <button
                    type="button"
                    onClick={() => selectApp('feishu-qa')}
                    className="mt-2.5 flex w-full items-start gap-2.5 rounded-lg border border-neutral-200 bg-white p-3 text-left transition-colors duration-micro ease-brand hover:border-brand-300"
                  >
                    <img src="/logo-feishu.svg" alt="" className="h-10 w-10 shrink-0 rounded-md" />
                    <span>
                      <span className="block text-body-sm font-semibold text-neutral-950">飞书问答插件</span>
                      <span className="mt-0.5 block text-caption text-neutral-500">
                        在飞书侧边栏直接提问，获取企业知识库的准确信息与 SOP，支持引用出处与一键分享。
                      </span>
                    </span>
                  </button>
                  <p className="mt-2.5 whitespace-pre-wrap text-body-sm text-neutral-500">{AI_MSG_2}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 搜索 + 分类 */}
          <div className="flex h-10 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 transition-shadow duration-micro ease-brand focus-within:border-brand-500 focus-within:shadow-input">
            <Search className="h-4 w-4 shrink-0 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索应用名称或功能"
              className="w-full bg-transparent text-body-sm text-neutral-800 outline-none placeholder:text-neutral-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {APP_TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'h-8 rounded-pill px-3.5 text-body-sm transition-colors duration-comp ease-brand',
                  tab === t ? 'bg-brand-600 font-medium text-white' : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* AppCard 网格（≥1536 中 6 列内 2 列卡片；1280–1365 全宽 3 列卡片） */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3 min-[1366px]:grid-cols-2">
            {filtered.map((a, idx) => {
              const isSel = a.id === selectedId
              return (
                <motion.div
                  key={a.id}
                  ref={(el) => { cardRefs.current[a.id] = el }}
                  tabIndex={-1}
                  layout="position"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: Math.min(idx, 9) * 0.06, ease: EASE }}
                  onClick={() => selectApp(a.id)}
                  className={cn(
                    'flex cursor-pointer flex-col gap-2.5 rounded-xl border bg-white p-4 transition-all duration-micro ease-brand hover:-translate-y-0.5 hover:shadow-card',
                    isSel ? 'border-[1.5px] border-brand-500 bg-surface-cardSel shadow-card' : 'border-neutral-200',
                    highlightApi && a.id === 'custom-api' && 'animate-pulse border-brand-500',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <img src={a.logo} alt="" className="h-10 w-10 rounded-md" />
                    <StatusBadge status={a.status} className={a.status === '可试用' ? 'bg-cyan-bg text-cyan' : undefined} />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-neutral-950">{a.name}</p>
                    <p className="mt-1 line-clamp-2 text-body-sm text-neutral-500">{a.extra.usage}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-caption text-neutral-400">{a.extra.category}</span>
                    {a.status === '可试用' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedId(a.id)
                          openInstall()
                        }}
                        className="h-8 rounded-md bg-brand-600 px-3 text-body-sm text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
                      >
                        安装
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openSettings(a.id, 'scope')
                        }}
                        className="h-8 rounded-md border border-[#BFD0F2] bg-white px-3 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
                      >
                        管理应用
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
          {filtered.length === 0 && (
            <p className="py-8 text-center text-body-sm text-neutral-400">没有匹配「{query}」的应用</p>
          )}
          {/* 「暂不安装」仅试用期显示（激活后无跳过语义）；「提交需求」已上移至标题区 */}
          {trial && (
            <button type="button" onClick={() => setSkipOpen(true)} className="self-center text-body-sm text-neutral-400 hover:text-neutral-700 hover:underline">
              暂不安装，跳过此步骤 ›
            </button>
          )}
        </div>

        {/* 右栏：应用详情（≥1536 常驻 sticky top 88；1366–1535 / 1280–1365 转 400px Drawer：遮罩 + Esc 关闭 + 焦点返回卡片） */}
        {detailOpen && (
          <div
            className="fixed inset-0 z-[70] bg-[rgba(16,24,40,0.4)] 2xl:hidden"
            onClick={closeDetail}
            aria-hidden
          />
        )}
        <div
          role={below2xl ? 'dialog' : undefined}
          aria-modal={below2xl || undefined}
          className={cn(
            '2xl:contents',
            'max-2xl:fixed max-2xl:inset-y-0 max-2xl:right-0 max-2xl:z-[71] max-2xl:flex max-2xl:w-[400px] max-2xl:max-w-full max-2xl:flex-col max-2xl:bg-white max-2xl:shadow-float',
            'max-2xl:transition-transform max-2xl:duration-modal max-2xl:ease-brand',
            detailOpen ? 'max-2xl:translate-x-0' : 'max-2xl:translate-x-full',
          )}
        >
          {/* Drawer 头部（仅 <1536 显示） */}
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-5 2xl:hidden">
            <span className="truncate text-h3 text-neutral-950">{selected?.name ?? '应用详情'}</span>
            <button
              type="button"
              onClick={closeDetail}
              aria-label="关闭"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {selected === null ? (
            /* 过滤无结果空态（详情栏） */
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-16 text-center max-2xl:min-h-0 max-2xl:flex-1 max-2xl:rounded-none max-2xl:border-0 2xl:sticky 2xl:top-[88px]">
              <AppWindow className="h-8 w-8 text-neutral-300" />
              <p className="text-body-sm text-neutral-500">没有匹配的应用</p>
              <p className="text-caption text-neutral-400">请调整分类或搜索关键词后重新选择</p>
            </div>
          ) : (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="max-2xl:min-h-0 max-2xl:flex-1 max-2xl:overflow-y-auto 2xl:sticky 2xl:top-[88px]"
          >
            <SectionCard bodyClassName="flex flex-col gap-4" className="max-h-[calc(100dvh-120px)] overflow-y-auto max-2xl:max-h-none max-2xl:rounded-none max-2xl:border-0 max-2xl:shadow-none">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <img src={selected.logo} alt="" className="h-10 w-10 rounded-md" />
                <div>
                  <h3 className="text-h3 text-neutral-950">{selected.name}</h3>
                  <p className="text-caption text-neutral-400">{selected.extra.publisher} · {selected.extra.version}</p>
                </div>
              </div>
              <StatusBadge status={selected.status} className={selected.status === '可试用' ? 'bg-cyan-bg text-cyan' : undefined} />
            </div>
            <p className="text-body-sm text-neutral-500">{selected.extra.usage}</p>

            {/* 支持场景 */}
            <div>
              <p className="mb-2 text-body-sm font-semibold text-neutral-950">支持场景</p>
              <div className="grid grid-cols-4 gap-2">
                {selected.extra.scenes.map((s) => {
                  const Icon = SCENE_ICONS[s.icon] ?? AppWindow
                  return (
                    <div key={s.label} className="flex flex-col items-center gap-1 rounded-md bg-surface-soft py-2">
                      <Icon className="h-5 w-5 text-brand-600" />
                      <span className="text-caption text-neutral-500">{s.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 所需权限 */}
            <div>
              <p className="mb-2 text-body-sm font-semibold text-neutral-950">所需权限</p>
              <ul className="space-y-1.5">
                {selected.extra.permissions.map((p) => (
                  <li key={p} className="flex items-center gap-1.5 text-body-sm text-neutral-700">
                    <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                    {p}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setPermDrawerOpen(true)} className="mt-1.5 text-body-sm text-brand-600 hover:underline">
                查看权限详情
              </button>
            </div>

            {/* custom-api 专属：OpenAPI 配置区（Endpoint / 鉴权方式 / 字段映射） */}
            {selected.id === 'custom-api' && (
              <div className="rounded-lg border border-neutral-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="text-body-sm font-semibold text-neutral-950">OpenAPI 配置</p>
                  <span className="text-caption text-neutral-400">{CUSTOM_API_CONFIG.version}</span>
                </div>
                <dl className="mt-2 space-y-1.5 text-body-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-neutral-400">Endpoint</dt>
                    <dd className="truncate font-mono text-caption text-neutral-800">{apiEndpoint}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-neutral-400">鉴权方式</dt>
                    <dd className="text-caption text-neutral-800">{CUSTOM_API_CONFIG.authMethod}</dd>
                  </div>
                </dl>
                <div className="mt-2 rounded-md bg-surface-soft p-2.5">
                  <p className="mb-1 text-caption font-medium text-neutral-500">字段映射</p>
                  <ul className="space-y-1">
                    {CUSTOM_API_CONFIG.fieldMappings.map((m) => (
                      <li key={m.from} className="flex items-center gap-1.5 text-caption text-neutral-700">
                        <code className="font-mono text-brand-600">{m.from}</code>
                        <span className="text-neutral-400">→</span>
                        <code className="font-mono text-neutral-800">{m.to}</code>
                        <span className="text-neutral-400">（{m.note}）</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setApiTestReceipt(null)
                      setApiConfigOpen(true)
                    }}
                    className="h-8 rounded-md bg-brand-600 px-3 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
                  >
                    配置
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/workspace/api-dev')}
                    className="text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500 hover:underline"
                  >
                    密钥管理
                  </button>
                  <button
                    type="button"
                    onClick={() => setApiStatsOpen(true)}
                    className="text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500 hover:underline"
                  >
                    调用统计
                  </button>
                </div>
              </div>
            )}

            {/* 使用的知识范围（设置 Drawer 保存后同步显示） */}
            <div className="flex items-center justify-between rounded-md bg-surface-soft px-3 py-2">
              <span className="text-body-sm text-neutral-700">
                使用的知识范围：<span className="font-medium text-neutral-950">{selectedScope || selected.extra.scope}</span>
              </span>
              <button type="button" onClick={() => openSettings(selected.id, 'scope')} className="shrink-0 text-body-sm text-brand-600 hover:underline">
                修改
              </button>
            </div>

            {/* 安装步骤 */}
            <div>
              <p className="mb-2 text-body-sm font-semibold text-neutral-950">安装步骤</p>
              <ol className="space-y-2">
                {selected.extra.steps.map((s, i) => (
                  <li key={s} className="flex items-start gap-2 text-body-sm text-neutral-700">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-caption font-semibold text-white">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>

            {/* 主 CTA */}
            {selected.status === '可试用' ? (
              <>
                <button
                  type="button"
                  onClick={openInstall}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand-600 text-body font-semibold text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
                >
                  <Download className="h-4 w-4" />
                  安装并开始试用
                </button>
                <button type="button" onClick={() => setDocDrawerOpen(true)} className="self-center text-body-sm text-brand-600 hover:underline">
                  了解更多 →
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => openSettings(selected.id, 'scope')}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#BFD0F2] bg-white text-body font-medium text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
              >
                管理应用
              </button>
            )}

            {/* 安装完成后预览（飞书侧边栏） */}
            {selected.extra.preview && (
              <div className="rounded-lg border border-neutral-200 bg-surface-assistant p-3">
                <div className="rounded-lg border border-neutral-200 bg-white">
                  <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
                    <span className="text-body-sm font-semibold text-neutral-950">{selected.extra.preview.title}</span>
                    <span className="rounded-sm bg-violet-bg px-1.5 py-0.5 text-[10px] font-semibold text-violet">New</span>
                    <MoreHorizontal className="ml-auto h-3.5 w-3.5 text-neutral-400" />
                  </div>
                  <div className="space-y-2.5 p-3">
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-lg bg-surface-user px-2.5 py-1.5 text-body-sm text-brand-700">
                        {selected.extra.preview.userMsg}
                      </div>
                    </div>
                    <div className="rounded-lg bg-surface-assistant px-2.5 py-1.5 text-body-sm text-neutral-800">
                      <p className="whitespace-pre-wrap">{selected.extra.preview.aiMsg}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-caption font-medium text-neutral-500">来源（3）</p>
                      <ol className="space-y-1">
                        {selected.extra.preview.sources.map((s, i) => (
                          <li key={s.name} className="flex items-baseline gap-1.5 text-caption">
                            <span className="shrink-0 text-brand-600">{i + 1}.</span>
                            <span className="font-medium text-neutral-800">{s.name}</span>
                            <span className="truncate text-neutral-400">{s.meta}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    {/* 继续提问：命中折扣/质保走 ANSWER_POOL，否则通用拒答 */}
                    {previewMsgs.map((m, i) =>
                      m.role === 'user' ? (
                        <div key={i} className="flex justify-end">
                          <div className="max-w-[85%] rounded-lg bg-surface-user px-2.5 py-1.5 text-body-sm text-brand-700">{m.text}</div>
                        </div>
                      ) : (
                        <div key={i} className="rounded-lg bg-surface-assistant px-2.5 py-1.5 text-body-sm text-neutral-800">
                          <p className="whitespace-pre-wrap">{m.text}</p>
                        </div>
                      ),
                    )}
                    <div className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1.5">
                      <input
                        value={previewInput}
                        onChange={(e) => setPreviewInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') sendPreviewQuestion()
                        }}
                        placeholder="继续提问…"
                        aria-label="继续提问"
                        className="w-full bg-transparent text-body-sm outline-none placeholder:text-neutral-400"
                      />
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      <button
                        type="button"
                        aria-label="发送"
                        disabled={!previewInput.trim()}
                        onClick={sendPreviewQuestion}
                        className="shrink-0 text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500 disabled:text-neutral-300"
                      >
                        <SendHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </SectionCard>
          </motion.div>
          )}
        </div>
      </div>

      {/* 安装流程 Modal */}
      <Modal open={installOpen} onClose={closeInstall} maxWidth="max-w-xl">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-float">
          <h3 className="text-h3 text-neutral-950">安装{installingAppName}</h3>
          {/* 4 步 Mini Stepper */}
          <div className="mt-4 flex items-center">
            {INSTALL_STEP_TITLES.map((t, i) => {
              const done = installStep > i || (installStep === 3 && testProgress >= 4)
              const current = installStep === i
              return (
                <div key={t} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-caption font-semibold',
                        done ? 'bg-brand-600 text-white' : current ? 'bg-brand-600 text-white' : 'border border-neutral-300 bg-white text-neutral-400',
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className={cn('whitespace-nowrap text-caption', current || done ? 'text-brand-600' : 'text-neutral-400')}>{t}</span>
                  </div>
                  {i < INSTALL_STEP_TITLES.length - 1 && <span className={cn('mx-2 mb-5 h-px flex-1 border-t border-dashed', installStep > i ? 'border-brand-300' : 'border-neutral-200')} />}
                </div>
              )
            })}
          </div>

          <div className="mt-5 min-h-[220px]">
            {/* 1 权限确认 */}
            {installStep === 0 && (
              <div className="space-y-3">
                {PERMISSION_GROUPS.map((g) => (
                  <div key={g.title} className="rounded-md bg-surface-soft p-3">
                    <p className="text-body-sm font-semibold text-neutral-950">{g.title}</p>
                    <ul className="mt-1.5 space-y-1">
                      {g.items.map((item) => (
                        <li key={item} className="flex items-center gap-1.5 text-body-sm text-neutral-700">
                          <Check className="h-3.5 w-3.5 text-success" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="flex justify-end">
                  <button type="button" onClick={() => setInstallStep(1)} className="h-10 rounded-md bg-brand-600 px-5 text-body font-medium text-white hover:bg-brand-500 active:bg-brand-700">
                    下一步
                  </button>
                </div>
              </div>
            )}

            {/* 2 选择范围 */}
            {installStep === 1 && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-body-sm font-semibold text-neutral-950">知识范围（多选）</p>
                  <div className="flex flex-wrap gap-2">
                    {['默认空间（全部知识）', '销售知识空间', '产品知识空间', '客服知识空间'].map((s) => {
                      const on = scopeSel.includes(s)
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setScopeSel((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))}
                          className={cn('h-8 rounded-md border px-3 text-body-sm transition-colors duration-micro', on ? 'border-brand-500 bg-brand-100 text-brand-700' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50')}
                        >
                          {s}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-body-sm font-semibold text-neutral-950">可见部门（默认全选销售/售前）</p>
                  <div className="flex flex-wrap gap-2">
                    {['销售团队', '售前团队', '客服团队', '产品团队'].map((d) => {
                      const on = deptSel.includes(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDeptSel((prev) => (on ? prev.filter((x) => x !== d) : [...prev, d]))}
                          className={cn('h-8 rounded-md border px-3 text-body-sm transition-colors duration-micro', on ? 'border-brand-500 bg-brand-100 text-brand-700' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50')}
                        >
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setInstallStep(0)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">
                    上一步
                  </button>
                  <button
                    type="button"
                    disabled={scopeSel.length === 0 || deptSel.length === 0}
                    onClick={() => setInstallStep(2)}
                    className={cn('h-10 rounded-md bg-brand-600 px-5 text-body font-medium text-white hover:bg-brand-500 active:bg-brand-700', (scopeSel.length === 0 || deptSel.length === 0) && 'cursor-not-allowed bg-neutral-100 text-neutral-400')}
                  >
                    下一步
                  </button>
                </div>
              </div>
            )}

            {/* 3 授权 */}
            {installStep === 2 && (
              <div className="flex flex-col items-center gap-4 py-6">
                <img src={modalApp.logo} alt="" className="h-14 w-14 rounded-lg" />
                <p className="text-center text-body text-neutral-700">
                  即将跳转{modalApp.name.includes('飞书') ? '飞书' : '对应平台'}完成授权（模拟）。授权后应用将获得上一步确认的权限。
                </p>
                <button
                  type="button"
                  disabled={authorizing}
                  onClick={startAuthorize}
                  className={cn('inline-flex h-11 items-center gap-2 rounded-md bg-brand-600 px-6 text-body font-semibold text-white hover:bg-brand-500 active:bg-brand-700', authorizing && 'cursor-wait opacity-80')}
                >
                  {authorizing && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                  {authorizing ? '正在授权…' : '授权并安装'}
                </button>
                <button type="button" onClick={() => setInstallStep(1)} className="text-body-sm text-neutral-500 hover:underline">
                  返回修改范围
                </button>
              </div>
            )}

            {/* 4 安装与测试 */}
            {installStep === 3 && (
              <div className="flex flex-col items-center gap-4 py-4">
                {testProgress < 4 ? (
                  <>
                    <p className="text-body text-neutral-700">正在安装并进行首次可信回答测试…</p>
                    <ul className="w-full max-w-xs space-y-2.5">
                      {INSTALL_TEST_STEPS.map((s, i) => (
                        <li key={s} className="flex items-center gap-2 text-body-sm">
                          {testProgress > i ? (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-white">
                              <Check className="h-3 w-3" />
                            </span>
                          ) : (
                            <span className="flex h-5 w-5 items-center justify-center">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
                            </span>
                          )}
                          <span className={testProgress > i ? 'text-neutral-950' : 'text-neutral-500'}>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success">
                      <Check className="h-6 w-6" />
                    </span>
                    <p className="text-h3 text-neutral-950">安装成功，已完成首次可信回答</p>
                    <p className="text-body-sm text-neutral-500">{installingAppName}已可用，渠道内首次回答验证通过（含引用出处）。</p>
                    <button type="button" onClick={finishInstall} className="h-11 rounded-md bg-brand-600 px-8 text-body font-semibold text-white hover:bg-brand-500 active:bg-brand-700">
                      完成
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* 暂不安装（必须选原因） */}
      <Modal open={skipOpen} onClose={() => setSkipOpen(false)} maxWidth="max-w-md">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-float">
          <h3 className="text-h3 text-neutral-950">暂不安装应用</h3>
          <p className="mt-1 text-body-sm text-neutral-500">请选择一个原因，帮助我们改进推荐（必选）</p>
          <div className="mt-4 space-y-2">
            {SKIP_REASONS.map((r) => (
              <label key={r} className={cn('flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-body-sm transition-colors duration-micro', skipReason === r ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50')}>
                <input type="radio" name="skip-reason" checked={skipReason === r} onChange={() => setSkipReason(r)} className="accent-brand-600" />
                {r}
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setSkipOpen(false)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">
              取消
            </button>
            <button
              type="button"
              disabled={!skipReason}
              onClick={confirmSkip}
              className={cn('h-10 rounded-md bg-brand-600 px-5 text-body font-medium text-white hover:bg-brand-500', !skipReason && 'cursor-not-allowed bg-neutral-100 text-neutral-400')}
            >
              确认跳过
            </button>
          </div>
        </div>
      </Modal>

      {/* 应用设置 Drawer（知识范围 / 通知与推送 / 授权信息 / 危险区） */}
      <SideDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        width={480}
        title={
          <span className="flex items-center gap-2.5">
            <img src={modalApp.logo} alt="" className="h-7 w-7 rounded-md" />
            应用设置 · {modalApp.name}
          </span>
        }
      >
        {/* 分区 Tab */}
        <div className="mb-4 flex gap-1 border-b border-neutral-100">
          {SETTINGS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSettingsTab(t.key)}
              className={cn(
                'relative h-10 px-3 text-body-sm transition-colors duration-micro ease-brand',
                settingsTab === t.key ? 'font-semibold text-brand-600' : 'text-neutral-500 hover:text-neutral-800',
                t.key === 'danger' && settingsTab !== t.key && 'text-danger/70 hover:text-danger',
              )}
            >
              {t.label}
              {settingsTab === t.key && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-600" />}
            </button>
          ))}
        </div>

        {/* 知识范围 */}
        {settingsTab === 'scope' && (
          <div>
            <p className="text-body-sm text-neutral-500">勾选该应用可引用的知识空间，保存后渠道内仅能引用范围内的知识。</p>
            <div className="mt-3 flex flex-col gap-2">
              {SPACE_OPTIONS.map((s) => {
                const on = scopeDraft.includes(s)
                return (
                  <label
                    key={s}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-body-sm transition-colors duration-micro ease-brand',
                      on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setScopeDraft((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))}
                      className="h-4 w-4 accent-brand-600"
                    />
                    {s}
                  </label>
                )
              })}
            </div>
            {scopeDraft.length === 0 && <p className="mt-2 text-caption text-danger">至少保留 1 个知识空间</p>}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-caption text-neutral-400">已选 {scopeDraft.length} 个空间</p>
              <button
                type="button"
                disabled={scopeDraft.length === 0}
                onClick={saveScope}
                className={cn(
                  'h-10 rounded-md bg-brand-600 px-5 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500',
                  scopeDraft.length === 0 && 'cursor-not-allowed bg-neutral-100 text-neutral-400',
                )}
              >
                保存范围
              </button>
            </div>
          </div>
        )}

        {/* 通知与推送 */}
        {settingsTab === 'notify' && (
          <div>
            <p className="text-body-sm text-neutral-500">控制该应用在渠道内的通知行为，保存后立即生效。</p>
            <ul className="mt-3 flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {NOTIFY_OPTIONS.map((n) => (
                <li key={n.key} className="flex items-center justify-between gap-3 px-3.5 py-3">
                  <div>
                    <p className="text-body-sm font-medium text-neutral-950">{n.label}</p>
                    <p className="mt-0.5 text-caption text-neutral-400">{n.note}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!notifyDraft[n.key]}
                    onClick={() => setNotifyDraft((prev) => ({ ...prev, [n.key]: !prev[n.key] }))}
                    className={cn(
                      'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-comp ease-brand',
                      notifyDraft[n.key] ? 'bg-brand-600' : 'bg-neutral-300',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-comp ease-brand',
                        notifyDraft[n.key] ? 'translate-x-[22px]' : 'translate-x-0.5',
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveNotify}
                className="h-10 rounded-md bg-brand-600 px-5 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
              >
                保存偏好
              </button>
            </div>
          </div>
        )}

        {/* 授权信息 */}
        {settingsTab === 'auth' && (
          <div className="flex flex-col gap-3">
            <dl className="space-y-2.5 rounded-lg bg-surface-soft p-4 text-body-sm">
              <div className="flex items-center justify-between">
                <dt className="text-neutral-500">授权状态</dt>
                <dd className="inline-flex items-center gap-1.5 font-medium text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  已授权
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-neutral-500">有效期至</dt>
                <dd className="font-medium text-neutral-950">{getSettings(modalApp.id).authExpiry}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-neutral-500">授权渠道</dt>
                <dd className="text-neutral-800">{modalApp.extra.publisher}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-neutral-500">当前版本</dt>
                <dd className="text-neutral-800">{modalApp.extra.version}</dd>
              </div>
            </dl>
            <p className="text-caption text-neutral-400">授权到期前 14 天将自动提醒管理员；重新授权后有效期顺延 180 天。</p>
            <button
              type="button"
              onClick={() => setReauthOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-600 px-5 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
            >
              <RefreshCw className="h-4 w-4" />
              重新授权
            </button>
          </div>
        )}

        {/* 危险区 */}
        {settingsTab === 'danger' && (
          <div className="rounded-md bg-danger-bg p-3.5">
            <p className="text-body-sm font-semibold text-danger">卸载应用（高危操作）</p>
            <p className="mt-1 text-caption text-neutral-500">
              卸载后渠道内问答入口将不可用，操作将记录审计日志；如需恢复可在应用中心重新安装。请输入「卸载」确认。
            </p>
            <input
              value={uninstallWord}
              onChange={(e) => setUninstallWord(e.target.value)}
              placeholder="输入：卸载"
              className="mt-2.5 h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm outline-none focus:border-danger"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={uninstallWord !== '卸载'}
                onClick={doUninstall}
                className={cn(
                  'h-10 rounded-md bg-danger px-5 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:brightness-105',
                  uninstallWord !== '卸载' && 'cursor-not-allowed bg-neutral-100 text-neutral-400',
                )}
              >
                确认卸载
              </button>
            </div>
          </div>
        )}
      </SideDrawer>

      {/* L2 确认：重新授权 */}
      <Modal open={reauthOpen} onClose={() => !reauthLoading && setReauthOpen(false)} maxWidth="max-w-xl">
        <ConfirmationCard
          title={`重新授权${modalApp.name}`}
          description={`当前授权有效期至 ${getSettings(modalApp.id).authExpiry}`}
          fields={[
            { label: '动作', value: '跳转对应平台重新授权（模拟）' },
            { label: '影响对象', value: `${modalApp.name} · 已授权成员` },
            { label: '影响范围', value: '授权期间渠道问答服务不中断，有效期顺延 180 天' },
            { label: '可撤销性', value: '可随时在对应平台后台撤销授权' },
          ]}
          confirmText={reauthLoading ? '正在授权…' : '确认执行'}
          loading={reauthLoading}
          onConfirm={handleReauth}
          onModify={() => setReauthOpen(false)}
          onCancel={() => setReauthOpen(false)}
        />
      </Modal>

      {/* 权限详情 Drawer（分组展示，不再拼超长 Toast） */}
      <SideDrawer open={permDrawerOpen} onClose={() => setPermDrawerOpen(false)} width={440} title={`权限详情 · ${selected?.name ?? ''}`}>
        <p className="text-body-sm text-neutral-500">应用安装后将获得以下权限，均遵循最小必要原则并写入审计日志。</p>
        <div className="mt-3 flex flex-col gap-3">
          {PERMISSION_GROUPS.map((g) => (
            <div key={g.title} className="rounded-lg border border-neutral-200 p-3.5">
              <p className="text-body-sm font-semibold text-neutral-950">{g.title}</p>
              <ul className="mt-2 space-y-1.5">
                {g.items.map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-body-sm text-neutral-700">
                    <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SideDrawer>

      {/* 应用文档 Drawer（了解更多 →） */}
      <SideDrawer open={docDrawerOpen} onClose={() => setDocDrawerOpen(false)} width={480} title={selected ? (APP_DOCS[selected.id] ?? APP_DOCS.default).title : '应用文档'}>
        {selected && (
          <div>
            <div className="flex items-center gap-2.5 rounded-lg bg-brand-50 p-3">
              <img src={selected.logo} alt="" className="h-10 w-10 rounded-md" />
              <div>
                <p className="text-body-sm font-semibold text-neutral-950">{selected.name}</p>
                <p className="text-caption text-neutral-500">{selected.extra.publisher} · {selected.extra.version}</p>
              </div>
            </div>
            <p className="mt-3 text-body-sm text-neutral-500">{(APP_DOCS[selected.id] ?? APP_DOCS.default).intro}</p>
            <div className="mt-4 flex flex-col gap-4">
              {(APP_DOCS[selected.id] ?? APP_DOCS.default).sections.map((s, i) => (
                <div key={s.heading}>
                  <p className="flex items-center gap-2 text-body font-semibold text-neutral-950">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-caption font-semibold text-brand-700">{i + 1}</span>
                    {s.heading}
                  </p>
                  <p className="mt-1.5 text-body-sm leading-6 text-neutral-700">{s.body}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => toast.success(`${selected.name} ${selected.extra.version} 完整文档已发送至你的邮箱`)}
              className="mt-5 text-body-sm text-brand-600 hover:underline"
            >
              发送完整文档到邮箱 →
            </button>
          </div>
        )}
      </SideDrawer>

      {/* custom-api：OpenAPI 配置 Drawer */}
      <SideDrawer open={apiConfigOpen} onClose={() => setApiConfigOpen(false)} width={480} title="OpenAPI 配置 · 自定义 API">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">OpenAPI Endpoint</p>
            <input
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 px-3 font-mono text-caption text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
            />
          </div>
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">Header 密钥</p>
            <input
              value={apiHeaderKey}
              onChange={(e) => setApiHeaderKey(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 px-3 font-mono text-caption text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
            />
            <p className="mt-1 text-caption text-neutral-400">请求头携带：Authorization: Bearer &lt;密钥&gt;</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={apiTesting || !apiEndpoint.trim()}
              onClick={testApiConnection}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-md border border-[#BFD0F2] bg-white px-4 text-body-sm font-medium text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50',
                apiTesting && 'cursor-wait opacity-80',
              )}
            >
              {apiTesting && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />}
              {apiTesting ? '测试连接中…' : '测试连接'}
            </button>
            <button
              type="button"
              onClick={() => toast.success('OpenAPI 配置已保存并生效')}
              className="h-10 rounded-md bg-brand-600 px-5 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
            >
              保存配置
            </button>
          </div>
          {apiTestReceipt && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2 rounded-lg bg-success-bg px-3.5 py-2.5 text-body-sm text-success"
            >
              <Check className="h-4 w-4 shrink-0" />
              {apiTestReceipt}
            </motion.div>
          )}
          <div className="rounded-lg bg-surface-soft p-3.5">
            <p className="mb-1.5 text-caption font-medium text-neutral-500">字段映射（只读示例）</p>
            <ul className="space-y-1">
              {CUSTOM_API_CONFIG.fieldMappings.map((m) => (
                <li key={m.from} className="flex items-center gap-1.5 text-caption text-neutral-700">
                  <code className="font-mono text-brand-600">{m.from}</code>
                  <span className="text-neutral-400">→</span>
                  <code className="font-mono text-neutral-800">{m.to}</code>
                  <span className="text-neutral-400">（{m.note}）</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SideDrawer>

      {/* custom-api：调用统计 Drawer */}
      <SideDrawer open={apiStatsOpen} onClose={() => setApiStatsOpen(false)} width={480} title="调用统计 · 自定义 API">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-surface-soft p-3.5">
            <p className="text-caption text-neutral-400">本月调用</p>
            <p className="mt-1 text-h3 text-neutral-950">1,240 次</p>
          </div>
          <div className="rounded-lg bg-surface-soft p-3.5">
            <p className="text-caption text-neutral-400">近 14 天峰值</p>
            <p className="mt-1 text-h3 text-neutral-950">{Math.max(...CUSTOM_API_CONFIG.trend14d)} 次/日</p>
          </div>
        </div>
        <p className="mb-2 mt-4 text-body-sm font-semibold text-neutral-950">近 14 天调用趋势</p>
        <div className="h-48 rounded-lg border border-neutral-200 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={CUSTOM_API_CONFIG.trend14d.map((v, i) => ({ day: `D${i + 1}`, calls: v }))} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#98A2B3' }} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={{ fontSize: 11, fill: '#98A2B3' }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => [`${v} 次`, '调用量']} />
              <Area type="monotone" dataKey="calls" stroke="#2F74FF" strokeWidth={2} fill="#2F74FF" fillOpacity={0.12} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-caption text-neutral-400">更完整的 Key 维度用量与端点分布，请前往「API 与开发」页查看。</p>
        <button
          type="button"
          onClick={() => navigate('/workspace/api-dev')}
          className="mt-2 text-body-sm font-medium text-brand-600 hover:text-brand-500 hover:underline"
        >
          前往 API 与开发 →
        </button>
      </SideDrawer>

      {/* 提交需求 */}
      <Modal open={needOpen} onClose={() => setNeedOpen(false)} maxWidth="max-w-md">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-float">
          <h3 className="text-h3 text-neutral-950">提交应用需求</h3>
          <textarea
            value={needText}
            onChange={(e) => setNeedText(e.target.value)}
            rows={4}
            placeholder="描述你需要的应用或集成场景…"
            className="mt-4 w-full resize-none rounded-md border border-[#DCE4EF] px-3 py-2.5 text-body outline-none focus:border-brand-500 focus:shadow-input placeholder:text-neutral-400"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setNeedOpen(false)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">
              取消
            </button>
            <button
              type="button"
              disabled={!needText.trim()}
              onClick={submitNeed}
              className={cn('h-10 rounded-md bg-brand-600 px-5 text-body font-medium text-white hover:bg-brand-500', !needText.trim() && 'cursor-not-allowed bg-neutral-100 text-neutral-400')}
            >
              提交
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
