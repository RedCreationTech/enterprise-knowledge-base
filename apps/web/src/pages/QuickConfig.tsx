/**
 * 快速配置 /workspace/quick-config（V1.4 迁入 WorkspaceShell；原 /trial/config 已 301）
 * 标题区：面包屑「工作台 / 快速配置」+ H1 + 副标题 + ?from=trial 试用提示条（仅试用期显示）
 * 三栏工作页：左 小知对话 ≈400px / 中 4 张编号步骤卡 ≈48% / 右 进度与价值 ≈300px → 底部操作栏。
 * 主 CTA「完成配置并验证答案」：步骤 1（≥1 可用资料）+ 步骤 4（已生成答案）完成后启用，
 * 点击跳 /workspace/verify-answer?q=<选中的问题>（未选问题时不带参数，回退默认问题）并更新 store（configProgress=100）。
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, animate, motion } from 'framer-motion'
import {
  ArrowRight,
  Blocks,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  CloudUpload,
  FileText,
  FolderOpen,
  MessageSquareQuote,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/mocks/store'
import { daily, isStepDone, JOURNEY_STEPS } from '@/mocks'
import { aclSync, assets, connectors as baseConnectors, sources } from '@/mocks/base.mock'
import { ChatPanel } from '@/components/chat'
import { ProgressRing, SectionCard } from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { PrimaryButton, SecondaryButton } from './activation/ui'
import { useAppToast } from '@/lib/toast'
import { KEY_NAMESPACE, loadLS, saveLS } from '@/lib/storage'

const PAGE = '/workspace/quick-config'

// ---------- 小知脚本（quick-config.md §3.1 逐字） ----------

const SCRIPT_AI_1 =
  '你好！我是小知，将引导你完成知识库的快速配置。我们将通过 4 个步骤，帮你尽快得到第一个可信答案：\n1. 上传资料：导入或连接你的企业资料\n2. 连接系统：连接常用的办公与内容系统\n3. 设置权限同步：确保知识安全可控\n4. 生成第一个答案：验证效果与质量\n我们开始吧！你可以按照顺序完成，也可以根据需要跳转到任意步骤。'

const SCRIPT_AI_2 = '你是否已经准备好资料来源？先告诉我你主要使用哪种资料来源吧~'

const SCRIPT_REPLY_RECORDED =
  '太棒了！我们已记录你的选择。请在右侧完成 4 个步骤的配置，我会在旁边随时为你提供帮助。💪'

const CHIPS = ['我已连接网盘', '我使用飞书文档', '暂不启用权限同步'] as const

const CHIP_REPLIES: Record<string, string> = {
  我已连接网盘: SCRIPT_REPLY_RECORDED,
  我使用飞书文档:
    '好的，飞书文档也是常用的资料来源。我已为你在步骤 1 的列表中标出「飞书文档」，你可以查看它的接入与更新情况。',
  暂不启用权限同步:
    '没问题，权限同步可以稍后配置，不影响当前进度。建议正式邀请同事前完成同步，确保知识访问安全可控。',
}

// ---------- 卡 4：场景与示例问题 ----------

const SCENES: { label: string; questions: string[] }[] = [
  {
    label: '销售咨询（产品能力/报价/交付）',
    questions: ['客户报价折扣超过 10% 需要谁审批？', '产品 X 的核心优势是什么？', '标准交付周期是多久？'],
  },
  {
    label: '客服咨询（售后政策/工单）',
    questions: ['退货政策是怎样的？', '工单响应时限是多久？', '质保期如何计算？'],
  },
  {
    label: '员工制度（考勤/报销）',
    questions: ['报销流程是怎样的？', '年假如何申请？', '考勤异常如何处理？'],
  },
]

const GENERATE_PHASES = ['正在理解你的资料…', '正在组织答案…']

// ---------- 「稍后继续」进度持久化 ----------

const PROGRESS_KEY = KEY_NAMESPACE.quickConfig.progress

interface QuickConfigProgress {
  /** 已连接的系统名称 */
  connected: string[]
  /** 场景 / 问题选择 */
  scene: string
  question: string
  /** 保存时的配置进度（%） */
  progress: number
}

function loadProgress(): QuickConfigProgress | null {
  const parsed = loadLS<Partial<QuickConfigProgress> | null>(PROGRESS_KEY, null)
  if (!parsed) return null
  return {
    connected: Array.isArray(parsed.connected) ? parsed.connected.filter((x): x is string => typeof x === 'string') : [],
    scene: typeof parsed.scene === 'string' ? parsed.scene : '',
    question: typeof parsed.question === 'string' ? parsed.question : '',
    progress: typeof parsed.progress === 'number' ? parsed.progress : 0,
  }
}

// ---------- 步骤卡 ----------

const COLLAPSE_KEY = KEY_NAMESPACE.quickConfig.collapsed

function loadCollapsed(): Record<number, boolean> {
  return loadLS<Record<number, boolean>>(COLLAPSE_KEY, {})
}

interface StepCardProps {
  index: number
  title: string
  subtitle: string
  headerRight?: React.ReactNode
  collapsed: boolean
  onToggle: () => void
  delay: number
  children: React.ReactNode
}

function StepCard({ index, title, subtitle, headerRight, collapsed, onToggle, delay, children }: StepCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className="rounded-xl border border-neutral-200 bg-white shadow-card"
    >
      <div className="flex items-center gap-3 p-5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-body-sm font-semibold text-white">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-h3 text-neutral-950">{title}</h3>
          <p className="mt-0.5 text-body-sm text-neutral-500">{subtitle}</p>
        </div>
        {headerRight}
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? '展开' : '收起'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-comp ease-brand', collapsed && '-rotate-90')} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-neutral-100 p-5 pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

// ---------- 页面 ----------

type SyncState = 'idle' | 'syncing' | 'done'

export default function QuickConfig() {
  const navigate = useNavigate()
  const { state, setConfigProgress, pushMessage, pushAssistantMessage, setReplyScript } = useAppStore()
  const toast = useAppToast()
  const [searchParams] = useSearchParams()
  /** V1.4：从 Stepper / 旅程进入时带 ?from=trial（提示条带返回旅程语义） */
  const fromTrial = searchParams.get('from') === 'trial'
  const trial = !state.journey.activated

  const [collapsed, setCollapsed] = useState<Record<number, boolean>>(loadCollapsed)
  const [selectedChip, setSelectedChip] = useState<string>('我已连接网盘')
  const [highlightFeishu, setHighlightFeishu] = useState(false)
  const [skipAcl, setSkipAcl] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [localConnectors, setLocalConnectors] = useState(baseConnectors)
  const [oauthTarget, setOauthTarget] = useState<string | null>(null)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [lastSyncAt, setLastSyncAt] = useState(aclSync.lastSyncAt)
  const [scene, setScene] = useState('')
  const [question, setQuestion] = useState('')
  const [generating, setGenerating] = useState(false)
  const [phase, setPhase] = useState(0)
  const [ringValue, setRingValue] = useState(0)
  const playedRef = useRef(false)
  /** 本地真实选择的待上传文件（文件名展示在上传列表） */
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)

  const progress = state.journey.configProgress
  const generated = progress >= 100

  // 挂载：资料已就绪 → 配置进度基线 75%（design.md §10）；注入小知脚本与初始会话
  useEffect(() => {
    if (state.journey.configProgress < 75) setConfigProgress(75)
    // 「稍后继续」恢复：连接的系统、场景/问题选择、进度（localStorage 持久化）
    const saved = loadProgress()
    if (saved) {
      if (saved.connected.length > 0) {
        setLocalConnectors((prev) => prev.map((c) => (saved.connected.includes(c.name) ? { ...c, connected: true } : c)))
      }
      if (SCENES.some((s) => s.label === saved.scene)) {
        setScene(saved.scene)
        if (saved.question) setQuestion(saved.question)
      }
      if (saved.progress > state.journey.configProgress) setConfigProgress(Math.min(100, saved.progress))
    }
    setReplyScript((text) => CHIP_REPLIES[text] ?? `收到。你可以先完成右侧 4 个步骤的配置；关于「${text.slice(0, 24)}」，我会在配置完成后结合你的知识库继续解答。`)
    if (!state.chatMessages.some((m) => m.page === PAGE && m.content.includes('快速配置'))) {
      pushAssistantMessage(SCRIPT_AI_1, PAGE)
      pushAssistantMessage(SCRIPT_AI_2, PAGE)
      pushMessage('user', '我已连接网盘', PAGE)
    }
    return () => setReplyScript(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 进度环补间（首次 0→75% 800ms；生成答案后 75%→100% 600ms），数字同步滚动
  useEffect(() => {
    const controls = animate(ringValue, progress, {
      duration: playedRef.current ? 0.6 : 0.8,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setRingValue(Math.round(v)),
    })
    playedRef.current = true
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  const toggleCollapsed = (i: number) => {
    setCollapsed((prev) => {
      const next = { ...prev, [i]: !prev[i] }
      saveLS(COLLAPSE_KEY, next)
      return next
    })
  }

  const handleChip = (chip: string) => {
    setSelectedChip(chip)
    pushMessage('user', chip, PAGE)
    if (chip === '我使用飞书文档') {
      setHighlightFeishu(true)
      setCollapsed((prev) => ({ ...prev, 1: false }))
      window.setTimeout(() => setHighlightFeishu(false), 1500)
    }
    if (chip === '暂不启用权限同步') {
      setSkipAcl(true)
      setCollapsed((prev) => ({ ...prev, 3: false }))
    }
  }

  // 卡 2：连接未连接系统（OAuth 模拟）
  const handleConnect = (name: string) => setOauthTarget(name)
  const confirmConnect = () => {
    if (!oauthTarget) return
    setOauthLoading(true)
    window.setTimeout(() => {
      setLocalConnectors((prev) => prev.map((c) => (c.name === oauthTarget ? { ...c, connected: true } : c)))
      setOauthLoading(false)
      setOauthTarget(null)
      toast.success(`${oauthTarget}已连接`)
    }, 1000)
  }

  // 卡 3：立即同步（防抖）
  const handleSync = () => {
    if (syncState === 'syncing') return
    setSyncState('syncing')
    window.setTimeout(() => {
      const d = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      setLastSyncAt(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`)
      setSyncState('done')
      toast.success(`权限已同步，覆盖 ${assets.coveredUsers} 人`)
    }, 2000)
  }

  // 卡 1：真实文件/文件夹选择，选中文件名进入上传列表
  const addPickedFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const names = [...files].map((f) => f.name)
    setUploadedFiles((prev) => [...prev, ...names])
    toast.success(`已选择 ${names.length} 个文件，已加入上传队列`)
  }

  // 底部「稍后继续」：持久化连接的系统、场景/问题选择与进度，重新进入自动恢复
  const handleSaveLater = () => {
    const payload: QuickConfigProgress = {
      connected: localConnectors.filter((c) => c.connected).map((c) => c.name),
      scene,
      question,
      progress: state.journey.configProgress,
    }
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(payload))
      toast.success('进度已保存，重新进入将自动恢复')
    } catch {
      toast.warning('浏览器存储不可用，本次进度无法保存')
    }
  }

  // 卡 4：生成答案（阶段文案轮换 900ms × 2，1.8s）
  const handleGenerate = () => {
    if (!scene || !question || generating || generated) return
    setGenerating(true)
    setPhase(0)
    const phaseTimer = window.setTimeout(() => setPhase(1), 900)
    window.setTimeout(() => {
      window.clearTimeout(phaseTimer)
      setGenerating(false)
      setConfigProgress(100)
      pushAssistantMessage(
        `第一个答案已生成！问题是「${question}」。配置进度已完成，点击「已生成，去验证」查看答案的准确性与出处。`,
        PAGE,
      )
      toast.success('第一个答案已生成')
    }, 1800)
  }

  const currentScene = SCENES.find((s) => s.label === scene)
  const mainCtaEnabled = sources.length > 0 && generated
  /** P0-2：把用户实际选中的问题带到验证页；未选问题（如历史进度直接进入）回退为默认折扣审批问题 */
  const verifyPath = question ? `/workspace/verify-answer?q=${encodeURIComponent(question)}` : '/workspace/verify-answer'

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

  return (
    <div className="flex flex-col gap-5">

      {/* 标题区（Workspace 规范：面包屑 + H1 + 副标题） */}
      <PageHeader
        crumbs={['工作台', '快速配置']}
        title="快速配置"
        subtitle="按照引导完成 4 个关键步骤，10 分钟内即可验证答案质量"
      />

      {/* 试用提示条（仅试用期；激活后不显示） */}
      {trial && (
        <div className="flex h-8 items-center justify-between gap-3 rounded-lg bg-brand-100 px-3">
          <span className="truncate text-body-sm text-brand-700">
            🧭 试用第 {daily.trialDay} 天 · 完成 4 步快速配置可推进激活进度
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

      <div className="flex gap-4">
        {/* 左栏：AI 对话面板 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-[28%] min-w-[340px] max-w-[400px] shrink-0"
        >
          <ChatPanel
            page={PAGE}
            chips={CHIPS as unknown as string[]}
            selectedChip={selectedChip}
            onChipSelect={handleChip}
            composerPlaceholder="请输入你的问题或描述你的需求…"
            className="sticky top-20 h-[calc(100dvh-256px)] overflow-hidden"
          />
        </motion.div>

        {/* 中栏：4 张编号步骤卡 */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* 卡 1：上传资料 */}
          <StepCard
            index={1}
            title="上传资料"
            subtitle="导入或连接你的企业资料，让 AI 更懂你的业务知识"
            collapsed={!!collapsed[1]}
            onToggle={() => toggleCollapsed(1)}
            delay={0}
            headerRight={
              <span className="flex shrink-0 items-center gap-1 text-body-sm font-medium text-success">
                已导入 {assets.docs.toLocaleString('en-US')} 份资料
                <Check className="h-4 w-4" />
              </span>
            }
          >
            <table className="w-full text-body-sm">
              <thead>
                <tr className="bg-surface-soft text-left text-neutral-500">
                  <th className="rounded-l-md px-3 py-2.5 font-medium">来源</th>
                  <th className="px-3 py-2.5 font-medium">连接状态</th>
                  <th className="px-3 py-2.5 font-medium">资料数量</th>
                  <th className="rounded-r-md px-3 py-2.5 font-medium">最近更新</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => {
                  const expanded = expandedRow === s.name
                  return [
                    <motion.tr
                      key={s.name}
                      onClick={() => setExpandedRow(expanded ? null : s.name)}
                      animate={highlightFeishu && s.name === '飞书文档' ? { backgroundColor: ['#EAF2FF', '#F5F8FF', '#EAF2FF'] } : {}}
                      transition={{ duration: 1.5, ease: 'easeInOut' }}
                      className={cn('cursor-pointer border-t border-neutral-100 text-neutral-800 transition-colors duration-micro ease-brand hover:bg-neutral-50')}
                    >
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-2">
                          <Cloud className="h-4 w-4 text-brand-500" />
                          {s.name}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1.5 text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          {s.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">{s.count} 份</td>
                      <td className="px-3 py-3">
                        <span className="flex items-center justify-between gap-2 text-neutral-500">
                          {s.updatedAt}
                          <ChevronRight className={cn('h-4 w-4 transition-transform duration-comp ease-brand', expanded && 'rotate-90')} />
                        </span>
                      </td>
                    </motion.tr>,
                    expanded && (
                      <tr key={`${s.name}-detail`} className="border-t border-neutral-100 bg-surface-soft">
                        <td colSpan={4} className="px-3 py-2.5 text-caption text-neutral-500">
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                          >
                            导入摘要：<span className="text-success">已就绪 {s.count - 14} 份</span> ·{' '}
                            <span className="text-cyan">处理中 10 份</span> · <span className="text-warning">需确认 4 份</span>
                          </motion.div>
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>

            {/* 折叠的 UploadZone */}
            <button
              type="button"
              onClick={() => setUploadOpen((v) => !v)}
              className="mt-3 inline-flex items-center gap-1 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
            >
              上传更多资料
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-comp ease-brand', uploadOpen && 'rotate-180')} />
            </button>
            <AnimatePresence initial={false}>
              {uploadOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-brand-300 bg-surface-upload p-6 text-center">
                    <CloudUpload className="h-8 w-8 text-brand-500" />
                    <p className="mt-3 text-body text-neutral-700">拖拽文件到此处，或选择本地文件上传</p>
                    <p className="mt-1 text-caption text-neutral-500">
                      支持 PDF / DOCX / XLSX / PPTX / TXT / MD / JPG / PNG，单文件 ≤100MB
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <SecondaryButton onClick={() => fileInputRef.current?.click()}>
                        <FileText className="h-4 w-4" />
                        选择文件
                      </SecondaryButton>
                      <SecondaryButton onClick={() => dirInputRef.current?.click()}>
                        <FolderOpen className="h-4 w-4" />
                        选择文件夹
                      </SecondaryButton>
                    </div>
                    {/* 隐藏的真实选择器：文件多选 / 文件夹（webkitdirectory） */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      aria-hidden="true"
                      onChange={(e) => {
                        addPickedFiles(e.target.files)
                        e.target.value = ''
                      }}
                    />
                    <input
                      ref={dirInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      aria-hidden="true"
                      {...({ webkitdirectory: 'true' } as Record<string, string>)}
                      onChange={(e) => {
                        addPickedFiles(e.target.files)
                        e.target.value = ''
                      }}
                    />
                    {/* 上传列表：真实展示选中的文件名 */}
                    {uploadedFiles.length > 0 && (
                      <ul className="mt-4 max-h-36 w-full overflow-y-auto rounded-md border border-neutral-200 bg-white p-2 text-left">
                        {uploadedFiles.map((name, i) => (
                          <li key={`${name}-${i}`} className="flex items-center gap-2 px-2 py-1 text-body-sm text-neutral-700">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                            <span className="min-w-0 flex-1 truncate">{name}</span>
                            <span className="shrink-0 text-caption text-success">已加入上传队列</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </StepCard>

          {/* 卡 2：连接系统 */}
          <StepCard
            index={2}
            title="连接系统"
            subtitle="连接常用系统，打通内容来源与协作场景"
            collapsed={!!collapsed[2]}
            onToggle={() => toggleCollapsed(2)}
            delay={0.07}
            headerRight={
              <button
                type="button"
                onClick={() => toggleCollapsed(2)}
                className="shrink-0 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
              >
                查看全部
              </button>
            }
          >
            <div className="grid grid-cols-4 gap-3">
              {localConnectors.map((c) => (
                <div
                  key={c.name}
                  className={cn(
                    'group rounded-lg border p-3 transition-colors duration-micro ease-brand',
                    c.connected ? 'border-neutral-200 bg-white' : 'cursor-pointer border-neutral-200 bg-white hover:border-brand-300',
                  )}
                  onClick={() => !c.connected && handleConnect(c.name)}
                  role={c.connected ? undefined : 'button'}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                    <Cloud className="h-[18px] w-[18px]" />
                  </span>
                  <p className="mt-2 text-body-sm font-medium text-neutral-950">{c.name}</p>
                  {c.connected ? (
                    <p className="mt-0.5 flex items-center gap-1 text-caption text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      已连接
                    </p>
                  ) : (
                    <p className="mt-0.5 text-caption text-neutral-400">
                      未连接
                      <span className="ml-2 hidden text-brand-600 group-hover:inline">连接</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </StepCard>

          {/* 卡 3：设置权限同步 */}
          <StepCard
            index={3}
            title="设置权限同步"
            subtitle="同步组织与权限，确保知识访问安全合规"
            collapsed={!!collapsed[3]}
            onToggle={() => toggleCollapsed(3)}
            delay={0.14}
          >
            {skipAcl && syncState === 'idle' && (
              <div className="mb-3 rounded-md bg-warning-bg px-3 py-2 text-body-sm text-warning">
                权限同步可稍后配置，不影响当前进度；建议邀请同事前完成同步。
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="grid flex-1 grid-cols-3 gap-4">
                <div>
                  <p className="text-caption text-neutral-500">ACL 同步策略</p>
                  <p className="mt-1 text-body-sm text-neutral-800">{aclSync.policy}</p>
                </div>
                <div>
                  <p className="text-caption text-neutral-500">内部访问策略</p>
                  <p className="mt-1 text-body-sm text-neutral-800">{aclSync.access}</p>
                </div>
                <div>
                  <p className="text-caption text-neutral-500">上次同步时间</p>
                  <p className="mt-1 text-body-sm text-neutral-800">{lastSyncAt}</p>
                </div>
              </div>
              <SecondaryButton onClick={handleSync} disabled={syncState === 'syncing'} className="shrink-0">
                {syncState === 'syncing' ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
                    同步中…
                  </>
                ) : (
                  '立即同步'
                )}
              </SecondaryButton>
            </div>
            {syncState === 'syncing' && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-cyan-bg px-2 py-0.5 text-caption font-medium text-cyan">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
                同步中
              </p>
            )}
            {syncState === 'done' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18 }}
                className="mt-3 flex items-center gap-1 text-body-sm text-success"
              >
                <Check className="h-4 w-4" />
                权限已同步，覆盖 {assets.coveredUsers} 人
              </motion.p>
            )}
          </StepCard>

          {/* 卡 4：生成第一个答案（验证效果） */}
          <StepCard
            index={4}
            title="生成第一个答案（验证效果）"
            subtitle="选择业务场景并提出一个问题，验证知识库效果"
            collapsed={!!collapsed[4]}
            onToggle={() => toggleCollapsed(4)}
            delay={0.21}
          >
            <div className="flex items-center gap-3">
              <select
                value={scene}
                onChange={(e) => {
                  setScene(e.target.value)
                  setQuestion('')
                }}
                className="h-10 flex-1 appearance-none rounded-md border border-[#DCE4EF] bg-white px-3 text-body text-neutral-800 outline-none transition-all duration-micro ease-brand focus-visible:border-brand-500 focus-visible:shadow-input"
              >
                <option value="" disabled>
                  选择场景
                </option>
                {SCENES.map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={!scene}
                className={cn(
                  'h-10 flex-1 appearance-none rounded-md border border-[#DCE4EF] bg-white px-3 text-body text-neutral-800 outline-none transition-all duration-micro ease-brand focus-visible:border-brand-500 focus-visible:shadow-input',
                  !scene && 'cursor-not-allowed bg-neutral-100 text-neutral-400',
                )}
              >
                <option value="" disabled>
                  如：产品 X 的核心优势是什么？
                </option>
                {(currentScene?.questions ?? []).map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
              {generated ? (
                <PrimaryButton onClick={() => navigate(verifyPath)} className="h-10 shrink-0 bg-success px-4 hover:bg-success/90">
                  已生成，去验证
                  <Check className="h-4 w-4" />
                </PrimaryButton>
              ) : (
                <PrimaryButton
                  onClick={handleGenerate}
                  disabled={!scene || !question}
                  loading={generating}
                  loadingText={GENERATE_PHASES[phase]}
                  title={!scene || !question ? '请先选择场景与问题' : undefined}
                  className="h-10 shrink-0 px-4"
                >
                  生成答案
                </PrimaryButton>
              )}
            </div>
            {generating && (
              <p className="mt-3 flex items-center gap-2 text-body-sm text-neutral-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={phase}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    {GENERATE_PHASES[phase]}
                  </motion.span>
                </AnimatePresence>
              </p>
            )}
          </StepCard>
        </div>

        {/* 右栏：配置进度与价值 */}
        <div className="flex w-[24%] min-w-[280px] max-w-[320px] shrink-0 flex-col gap-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <SectionCard title="配置进度与价值">
              <div className="flex items-center gap-4">
                <ProgressRing value={ringValue} size={104} strokeWidth={9} label="已完成" />
                <div>
                  {generated ? (
                    <>
                      <p className="text-body text-neutral-800">
                        配置<span className="font-semibold text-success"> 已完成</span>
                      </p>
                      <p className="mt-1 text-caption text-neutral-500">可以前往验证第一个可信答案了</p>
                    </>
                  ) : (
                    <>
                      <p className="text-body text-neutral-800">
                        预计还需 <span className="font-semibold">≈ {state.journey.etaMinutes} 分钟</span>
                      </p>
                      <p className="mt-1 text-caption text-neutral-500">完成剩余步骤即可验证答案效果</p>
                    </>
                  )}
                </div>
              </div>
            </SectionCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <SectionCard title="知识资产概览">
              <ul className="space-y-3">
                {[
                  { icon: FileText, name: '已接入资料', value: assets.docs, unit: '份' },
                  { icon: BookOpen, name: '已识别章节', value: assets.chapters, unit: '章' },
                  { icon: MessageSquareQuote, name: '可问答知识', value: assets.qaItems, unit: '条' },
                  { icon: Users, name: '覆盖人数', value: assets.coveredUsers, unit: '人' },
                ].map((row) => (
                  <li key={row.name} className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                      <row.icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-body-sm text-neutral-700">{row.name}</span>
                    <span className="text-metric text-neutral-950">{row.value.toLocaleString('en-US')}</span>
                    <span className="w-5 text-caption text-neutral-500">{row.unit}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <SectionCard title="接下来你可以">
              <ol className="space-y-3">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-body-sm text-brand-600">生成并验证第一个业务问题的答案</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-caption text-neutral-500">2</span>
                  <span className="text-body-sm text-neutral-700">邀请 1–3 位同事一起试用</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-caption text-neutral-500">3</span>
                  <span className="text-body-sm text-neutral-700">将应用安装到常用工作平台</span>
                </li>
              </ol>
            </SectionCard>
          </motion.div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="mt-5 flex h-16 items-center justify-between rounded-xl border border-neutral-200 bg-white px-6 shadow-card">
        <div className="flex items-center gap-8">
          {[
            { icon: ShieldCheck, title: '数据安全保障', desc: '多重加密存储，访问可控可追溯' },
            { icon: RefreshCw, title: '知识持续更新', desc: '自动同步最新资料，保持知识新鲜' },
            { icon: Blocks, title: '多平台集成', desc: '与主流办公平台无缝连接' },
          ].map((v) => (
            <div key={v.title} className="flex items-center gap-2.5">
              <v.icon className="h-5 w-5 text-brand-600" />
              <div>
                <p className="text-body-sm font-semibold text-neutral-950">{v.title}</p>
                <p className="text-caption text-neutral-500">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <SecondaryButton onClick={handleSaveLater}>稍后继续</SecondaryButton>
          <PrimaryButton
            disabled={!mainCtaEnabled}
            title={!mainCtaEnabled ? '请先完成上传资料与生成第一个答案' : undefined}
            onClick={() => navigate(verifyPath)}
          >
            完成配置并验证答案
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </div>
      </div>

      {/* OAuth 模拟 Modal */}
      <AnimatePresence>
        {oauthTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,24,40,0.4)] p-6"
            onClick={() => !oauthLoading && setOauthTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-float"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-h3 text-neutral-950">连接{oauthTarget}</h3>
              <p className="mt-1 text-body-sm text-neutral-500">授权后，知识库将按以下权限范围同步内容：</p>
              <ul className="mt-4 space-y-2 rounded-lg bg-surface-soft p-4">
                {['读取文档内容与目录结构', '获取组织与成员基础信息', '同步空间访问权限'].map((p) => (
                  <li key={p} className="flex items-center gap-2 text-body-sm text-neutral-800">
                    <Check className="h-4 w-4 text-success" />
                    {p}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-center justify-end gap-2">
                <SecondaryButton onClick={() => setOauthTarget(null)} disabled={oauthLoading}>
                  取消
                </SecondaryButton>
                <PrimaryButton onClick={confirmConnect} loading={oauthLoading} loadingText="正在授权…" className="h-10">
                  授权并连接
                </PrimaryButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
