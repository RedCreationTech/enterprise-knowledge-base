/**
 * 全局 AppStore：React Context + useReducer，persist 到 localStorage（key: ekb-store-v1）。
 * 初始状态 = 未提交申请（旅程从第 1 步开始），resetDemo() 可随时还原。
 *
 * 页面代理用法：
 *   const { state, submitApplication, pushMessage, setReplyScript, ... } = useAppStore()
 */
/* eslint-disable react-refresh/only-export-components -- AppStore 模块同时导出 Provider 组件与类型/常量/工具函数，Fast Refresh 仅适用于纯组件文件 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import type { ReactNode } from 'react'
import { apps, daily, invitees, me, TODAY } from './base.mock'
import { KEY_NAMESPACE } from '@/lib/storage'

// ---------- 类型 ----------

export interface JourneyState {
  /** 1–5，对应申请试用/快速配置/邀请同事/安装应用/每日待办 */
  currentStep: number
  applied: boolean
  configProgress: number
  answerAccepted: boolean
  invitesSent: boolean
  appsSkipped: boolean
  /** 已安装应用（单源权威）：安装/卸载都只改这一个字段 + uninstalledApps */
  installedApps: string[]
  /** 显式卸载的应用（集成管理页据此隐藏已卸载项；重新安装时清除） */
  uninstalledApps: string[]
  /**
   * 用户主动安装的应用（新手引导信号，独立于目录默认已安装）：
   * 仅当用户通过应用中心显式安装时追加；卸载不回退（onboarding 完成即持久）。
   */
  userInstalledApps: string[]
  dailyDone: boolean
  activated: boolean
  trialDays: number
  trialDayNow: number
  etaMinutes: number
}

export interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  time: string
  /** 消息产生的页面路径（里程碑摘要等） */
  page?: string
}

export type FeedbackType = 'correct' | 'wrong' | 'expired' | 'no-answer'

export interface FeedbackItem {
  id: string
  type: FeedbackType
  question?: string
  answerExcerpt?: string
  /** 来源页面，如 knowledge-site / ai-assistant */
  source: string
  note?: string
  status: '待处理' | '已处理'
  createdAt: string
}

export type TaskStatus = '待处理' | '进行中' | '已完成' | '已转交' | '已跳过'
export type TaskPriority = '高' | '中' | '低'

export interface TaskItem {
  id: string
  group: string
  title: string
  reason?: string
  priority: TaskPriority
  status: TaskStatus
  due: string
  owner: string
  /** 点击「开始处理」后的跳转路径（新手引导任务使用） */
  route?: string
}

export interface AppState {
  journey: JourneyState
  chatMessages: ChatMessage[]
  feedbacks: FeedbackItem[]
  tasks: TaskItem[]
  /** 演示数据模式：true=成熟运营数据（LOAD_DEMO_DATA）；false=真实空态起点（默认） */
  demoData: boolean
}

// ---------- 旅程步骤（ActivationShell Stepper 与守卫共用） ----------

export interface JourneyStepDef {
  key: string
  title: string
  subtitle: string
  path: string
}

export const JOURNEY_STEPS: JourneyStepDef[] = [
  { key: 'apply', title: '申请试用', subtitle: '填写企业信息', path: '/trial/apply' },
  { key: 'config', title: '快速配置', subtitle: '接入企业资料', path: '/workspace/quick-config?from=trial' },
  { key: 'invite', title: '邀请同事', subtitle: '组建试用团队', path: '/workspace/invite-team?from=trial' },
  { key: 'apps', title: '安装应用', subtitle: '接入工作入口', path: '/trial/apps' },
  { key: 'daily', title: '每日待办', subtitle: '持续运营知识', path: '/trial/daily' },
]

export function isStepDone(journey: JourneyState, index: number): boolean {
  switch (index) {
    case 0:
      return journey.applied
    case 1:
      return journey.configProgress >= 75 && journey.answerAccepted
    case 2:
      return journey.invitesSent
    case 3:
      return (
        journey.userInstalledApps.length > 0 ||
        journey.appsSkipped ||
        journey.dailyDone ||
        journey.activated
      )
    case 4:
      return journey.dailyDone || journey.activated
    default:
      return false
  }
}

export type StepStatus = 'done' | 'current' | 'todo'

export function stepStatusOf(journey: JourneyState, index: number): StepStatus {
  if (isStepDone(journey, index)) return 'done'
  for (let i = 0; i < index; i += 1) {
    if (!isStepDone(journey, i)) return 'todo'
  }
  return 'current'
}

/** 当前应处步骤路径（守卫重定向目标） */
export function getCurrentStepPath(state: AppState): string {
  const { journey } = state
  if (journey.activated) return '/workspace/dashboard'
  for (let i = 0; i < JOURNEY_STEPS.length; i += 1) {
    if (!isStepDone(journey, i)) return JOURNEY_STEPS[i].path
  }
  return '/trial/activated'
}

// ---------- 初始状态 ----------

let uidCounter = 0
function uid(prefix: string): string {
  uidCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}`
}

function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function nowDateTime(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  // 日期取演示基准日 TODAY（单一时间宇宙），时分取当前时钟（仅时刻，无日期语义）
  return `${TODAY} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 默认已安装应用 id（与 base.mock apps[] 的「已安装」状态同源：企业微信 / 自定义 API / SSO） */
const DEFAULT_INSTALLED_APPS: string[] = apps
  .filter((a) => a.status === '已安装')
  .map((a) => a.id)

export const initialJourney: JourneyState = {
  currentStep: 1,
  applied: false,
  configProgress: 0,
  answerAccepted: false,
  invitesSent: false,
  appsSkipped: false,
  installedApps: [...DEFAULT_INSTALLED_APPS],
  uninstalledApps: [],
  userInstalledApps: [],
  dailyDone: false,
  activated: false,
  trialDays: 7,
  trialDayNow: 1,
  etaMinutes: 3,
}

const DEFAULT_GREETING =
  '你好，我是智能助手小知。接下来我会陪你完成企业知识库的试用激活：先提交试用申请，再接入资料、验证答案、邀请同事并安装应用。有任何问题随时问我。'

function initialChatMessages(): ChatMessage[] {
  return [
    { id: uid('msg'), role: 'assistant', content: DEFAULT_GREETING, time: nowTime(), page: '/trial/apply' },
  ]
}

function initialTasks(): TaskItem[] {
  return [
    { id: uid('task'), group: '试用推进', title: '完成知识库快速配置', reason: '配置完成后才能生成可信答案', priority: '高', status: '待处理', due: '今天 18:00', owner: me.name },
    { id: uid('task'), group: '试用推进', title: '确认第一个可信答案', reason: '验证知识是邀请同事的前置条件', priority: '高', status: '待处理', due: '今天 18:00', owner: me.name },
    { id: uid('task'), group: '知识完善', title: '补充客服售后知识空间', reason: '客服类问题命中率低于 60%', priority: '中', status: '待处理', due: '明天 12:00', owner: me.name },
    { id: uid('task'), group: '知识完善', title: '确认《价格管理办法》最新版本', reason: '检测到两份报价政策存在版本冲突', priority: '高', status: '待处理', due: '明天 12:00', owner: me.name },
    { id: uid('task'), group: '邀请与跟进', title: `跟进 ${invitees} 名被邀请同事的激活情况`, reason: '邀请发出后 24h 内跟进效果最佳', priority: '中', status: '待处理', due: '本周五', owner: me.name },
    { id: uid('task'), group: '邀请与跟进', title: '为售前团队指定知识 Owner', reason: '无人负责的空间问题会无人处理', priority: '中', status: '待处理', due: '本周五', owner: me.name },
    { id: uid('task'), group: '应用试用', title: '在飞书完成首次可信回答测试', reason: '安装成功 ≠ 试用成功，需渠道内验证', priority: '高', status: '待处理', due: '明天 18:00', owner: me.name },
    { id: uid('task'), group: '应用试用', title: '评估是否启用官网客服组件', reason: '外部渠道上线前需完成灰度评估', priority: '低', status: '待处理', due: '本周内', owner: me.name },
    { id: uid('task'), group: '数据与反馈', title: `处理 ${daily.pendingFeedback} 条待审核反馈`, reason: '反馈闭环可持续提升答案质量', priority: '中', status: '待处理', due: '今天 20:00', owner: me.name },
    { id: uid('task'), group: '数据与反馈', title: '查看上周知识使用趋势', reason: `近 7 天使用量 ${daily.trend7d[6]} 次，持续上升`, priority: '低', status: '待处理', due: '本周内', owner: me.name },
  ]
}

/** 空态起点的 3 条新手引导任务（demoData === false 时的任务列表） */
export function starterTasks(): TaskItem[] {
  return [
    { id: uid('task'), group: '新手引导', title: '完成企业信息申请', reason: '提交试用申请后即可开始配置企业知识库', priority: '高', status: '待处理', due: '今天 18:00', owner: me.name, route: '/trial/apply' },
    { id: uid('task'), group: '新手引导', title: '接入首批企业资料', reason: '接入资料后才能生成有出处的可信答案', priority: '高', status: '待处理', due: '今天 18:00', owner: me.name, route: '/workspace/quick-config' },
    { id: uid('task'), group: '新手引导', title: '生成并验证第一个可信答案', reason: '验证答案是邀请同事与安装应用的前置条件', priority: '中', status: '待处理', due: '明天 12:00', owner: me.name, route: '/workspace/quick-config' },
  ]
}

export function createInitialState(): AppState {
  return {
    journey: { ...initialJourney, installedApps: [...DEFAULT_INSTALLED_APPS], uninstalledApps: [], userInstalledApps: [] },
    chatMessages: initialChatMessages(),
    feedbacks: [],
    // 冷启动真实空态：不预置成熟运营任务，仅保留新手引导
    tasks: starterTasks(),
    demoData: false,
  }
}

// ---------- Reducer ----------

type Action =
  | { type: 'JOURNEY_PATCH'; patch: Partial<JourneyState> }
  | { type: 'PUSH_MESSAGE'; message: ChatMessage }
  | { type: 'CLEAR_PAGE_MESSAGES'; page?: string }
  | { type: 'ADD_FEEDBACK'; feedback: FeedbackItem }
  | { type: 'UPDATE_FEEDBACK'; id: string; patch: Partial<FeedbackItem> }
  | { type: 'ADD_TASK'; task: TaskItem }
  | { type: 'UPDATE_TASK'; id: string; patch: Partial<TaskItem> }
  | { type: 'LOAD_DEMO_DATA' }
  | { type: 'RESET_DEMO_DATA' }
  | { type: 'RESET' }

function deriveCurrentStep(journey: JourneyState): number {
  for (let i = 0; i < JOURNEY_STEPS.length; i += 1) {
    if (!isStepDone(journey, i)) return i + 1
  }
  return JOURNEY_STEPS.length
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'JOURNEY_PATCH': {
      const merged = { ...state.journey, ...action.patch }
      return { ...state, journey: { ...merged, currentStep: deriveCurrentStep(merged) } }
    }
    case 'PUSH_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.message] }
    case 'CLEAR_PAGE_MESSAGES':
      // 清空某个页面产生的消息（page 为 undefined 时清无页面标记的消息）
      return { ...state, chatMessages: state.chatMessages.filter((m) => m.page !== action.page) }
    case 'ADD_FEEDBACK':
      return { ...state, feedbacks: [action.feedback, ...state.feedbacks] }
    case 'UPDATE_FEEDBACK':
      return {
        ...state,
        feedbacks: state.feedbacks.map((f) => (f.id === action.id ? { ...f, ...action.patch } : f)),
      }
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] }
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      }
    case 'LOAD_DEMO_DATA':
      // 显式进入演示数据模式：载入成熟运营任务组，各页运营数据随之展示
      return { ...state, demoData: true, tasks: initialTasks() }
    case 'RESET_DEMO_DATA':
      // 回到空态起点：demoData=false + 新手引导任务
      return createInitialState()
    case 'RESET':
      return createInitialState()
    default:
      return state
  }
}

// ---------- 持久化 ----------

const STORAGE_KEY = 'ekb-store-v1'

/** Task 6 前的旧双源卸载键（单源化后仅用于一次性迁移，迁移后清除） */
const LEGACY_UNINSTALLED_KEYS = ['ekb-uninstalled-apps', 'ekb-uninstalled-integrations']

function readLegacyUninstalled(): Set<string> {
  const ids = new Set<string>()
  for (const key of LEGACY_UNINSTALLED_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) continue
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (typeof id === 'string') ids.add(id)
        }
      }
    } catch {
      // 损坏数据跳过
    }
  }
  return ids
}

function clearLegacyUninstalledKeys(): void {
  for (const key of LEGACY_UNINSTALLED_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      // 存储不可用时静默降级
    }
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const base = createInitialState()
    const parsed = raw ? (JSON.parse(raw) as Partial<AppState>) : null
    // 迁移：老用户的已存状态缺少 demoData 字段 → 视为已载入演示数据（true），保持数据连续；新访客默认 false
    const demoData = parsed ? (typeof parsed.demoData === 'boolean' ? parsed.demoData : true) : base.demoData
    const persistedJourney: Partial<JourneyState> = parsed?.journey ?? {}
    const legacyUninstalled = readLegacyUninstalled()
    let installedApps: string[]
    let uninstalledApps: string[]
    // 新手引导信号：老持久化缺少该字段 → 回退为空（新用户不自动完成「安装 1 个应用」）
    const userInstalledApps: string[] = Array.isArray(persistedJourney.userInstalledApps)
      ? persistedJourney.userInstalledApps.filter((id) => typeof id === 'string')
      : []
    if (Array.isArray(persistedJourney.uninstalledApps)) {
      // 新 schema：installedApps/uninstalledApps 均已在 ekb-store-v1 内，直接采用
      installedApps = Array.isArray(persistedJourney.installedApps)
        ? persistedJourney.installedApps.filter((id) => typeof id === 'string')
        : [...DEFAULT_INSTALLED_APPS]
      uninstalledApps = persistedJourney.uninstalledApps.filter((id) => typeof id === 'string')
    } else {
      // 旧 schema 一次性迁移：默认已安装 ∪ 旧 installedApps − 旧卸载键
      const installed = new Set<string>(DEFAULT_INSTALLED_APPS)
      if (Array.isArray(persistedJourney.installedApps)) {
        for (const id of persistedJourney.installedApps) {
          if (typeof id === 'string') installed.add(id)
        }
      }
      for (const id of legacyUninstalled) installed.delete(id)
      installedApps = [...installed]
      uninstalledApps = [...legacyUninstalled]
    }
    clearLegacyUninstalledKeys()
    return {
      journey: { ...base.journey, ...persistedJourney, installedApps, uninstalledApps, userInstalledApps },
      chatMessages: parsed && Array.isArray(parsed.chatMessages) && parsed.chatMessages.length > 0
        ? parsed.chatMessages
        : base.chatMessages,
      feedbacks: parsed && Array.isArray(parsed.feedbacks) ? parsed.feedbacks : [],
      tasks:
        parsed && Array.isArray(parsed.tasks) && parsed.tasks.length > 0
          ? parsed.tasks
          : demoData
            ? initialTasks()
            : base.tasks,
      demoData,
    }
  } catch {
    return createInitialState()
  }
}

// ---------- Context ----------

export type ReplyScript = (userText: string) => string

const DEFAULT_REPLY: ReplyScript = () =>
  '收到。我会结合你当前的操作继续引导：如果这一步遇到疑问，可以告诉我具体卡在什么地方，我会给出下一步建议。'

export interface AppStore {
  state: AppState
  /** 旅程动作 */
  setJourney: (patch: Partial<JourneyState>) => void
  submitApplication: () => void
  setConfigProgress: (progress: number) => void
  acceptAnswer: () => void
  sendInvites: () => void
  installApp: (appId: string) => void
  uninstallApp: (appId: string) => void
  skipApps: () => void
  completeDaily: () => void
  activate: () => void
  /** 对话（跨页共享会话） */
  pushMessage: (role: 'assistant' | 'user', content: string, page?: string) => void
  /** 清空某个页面产生的消息（不传 page 清无页面标记的消息） */
  clearPageMessages: (page?: string) => void
  /** 追加一条 AI 消息（不触发自动回复） */
  pushAssistantMessage: (content: string, page?: string) => void
  /** 页面自定义模拟 AI 回复脚本；传 null 恢复默认 */
  setReplyScript: (fn: ReplyScript | null) => void
  /** 反馈队列（feedback 页与知识网站问答联动） */
  addFeedback: (f: Omit<FeedbackItem, 'id' | 'createdAt' | 'status'> & { status?: FeedbackItem['status'] }) => void
  updateFeedback: (id: string, patch: Partial<FeedbackItem>) => void
  /** 每日待办 */
  addTask: (t: Omit<TaskItem, 'id'>) => void
  updateTask: (id: string, patch: Partial<TaskItem>) => void
  /** 载入演示数据（demoData=true + 成熟运营任务组） */
  loadDemoData: () => void
  /** 回到空态起点（demoData=false + 新手引导任务；清空全部本地演示状态） */
  resetDemoData: () => void
  resetDemo: () => void
}

const StoreContext = createContext<AppStore | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const replyScriptRef = useRef<ReplyScript>(DEFAULT_REPLY)
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // 存储不可用时静默降级（内存态仍可用）
    }
  }, [state])

  useEffect(() => {
    return () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current)
    }
  }, [])

  const setJourney = useCallback((patch: Partial<JourneyState>) => {
    dispatch({ type: 'JOURNEY_PATCH', patch })
  }, [])

  const pushMessage = useCallback((role: 'assistant' | 'user', content: string, page?: string) => {
    dispatch({ type: 'PUSH_MESSAGE', message: { id: uid('msg'), role, content, time: nowTime(), page } })
    if (role === 'user') {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current)
      replyTimerRef.current = setTimeout(() => {
        const reply = replyScriptRef.current(content)
        dispatch({
          type: 'PUSH_MESSAGE',
          message: { id: uid('msg'), role: 'assistant', content: reply, time: nowTime(), page },
        })
      }, 700)
    }
  }, [])

  const pushAssistantMessage = useCallback((content: string, page?: string) => {
    dispatch({ type: 'PUSH_MESSAGE', message: { id: uid('msg'), role: 'assistant', content, time: nowTime(), page } })
  }, [])

  const setReplyScript = useCallback((fn: ReplyScript | null) => {
    replyScriptRef.current = fn ?? DEFAULT_REPLY
  }, [])

  const store: AppStore = useMemo(
    () => ({
      state,
      setJourney,
      submitApplication: () =>
        setJourney({ applied: true, trialDayNow: 1 }),
      setConfigProgress: (progress: number) =>
        setJourney({ configProgress: Math.max(0, Math.min(100, progress)) }),
      acceptAnswer: () => setJourney({ answerAccepted: true }),
      sendInvites: () => setJourney({ invitesSent: true }),
      installApp: (appId: string) =>
        setJourney({
          installedApps: state.journey.installedApps.includes(appId)
            ? state.journey.installedApps
            : [...state.journey.installedApps, appId],
          uninstalledApps: state.journey.uninstalledApps.filter((id) => id !== appId),
          // 新手引导信号：仅当用户显式安装时追加（幂等，卸载不回退）
          userInstalledApps: state.journey.userInstalledApps.includes(appId)
            ? state.journey.userInstalledApps
            : [...state.journey.userInstalledApps, appId],
        }),
      uninstallApp: (appId: string) =>
        setJourney({
          installedApps: state.journey.installedApps.filter((id) => id !== appId),
          uninstalledApps: state.journey.uninstalledApps.includes(appId)
            ? state.journey.uninstalledApps
            : [...state.journey.uninstalledApps, appId],
          // userInstalledApps 不回退：卸载是安装完成后的管理动作，不重置「安装 1 个应用」完成态
        }),
      skipApps: () => setJourney({ appsSkipped: true }),
      completeDaily: () => setJourney({ dailyDone: true }),
      activate: () => setJourney({ activated: true, dailyDone: true }),
      pushMessage,
      clearPageMessages: (page?: string) => dispatch({ type: 'CLEAR_PAGE_MESSAGES', page }),
      pushAssistantMessage,
      setReplyScript,
      addFeedback: (f) =>
        dispatch({
          type: 'ADD_FEEDBACK',
          feedback: { ...f, id: uid('fb'), createdAt: nowDateTime(), status: f.status ?? '待处理' },
        }),
      updateFeedback: (id, patch) => dispatch({ type: 'UPDATE_FEEDBACK', id, patch }),
      addTask: (t) => dispatch({ type: 'ADD_TASK', task: { ...t, id: uid('task') } }),
      updateTask: (id, patch) => dispatch({ type: 'UPDATE_TASK', id, patch }),
      loadDemoData: () => dispatch({ type: 'LOAD_DEMO_DATA' }),
      resetDemoData: () => {
        try {
          localStorage.removeItem(STORAGE_KEY)
          localStorage.removeItem(KEY_NAMESPACE.knowledge.spaces)
          localStorage.removeItem(KEY_NAMESPACE.instructions.list)
        } catch {
          // ignore
        }
        clearLegacyUninstalledKeys()
        if (replyTimerRef.current) clearTimeout(replyTimerRef.current)
        replyScriptRef.current = DEFAULT_REPLY
        dispatch({ type: 'RESET_DEMO_DATA' })
      },
      resetDemo: () => {
        try {
          localStorage.removeItem(STORAGE_KEY)
          localStorage.removeItem(KEY_NAMESPACE.knowledge.spaces)
          localStorage.removeItem(KEY_NAMESPACE.instructions.list)
        } catch {
          // ignore
        }
        clearLegacyUninstalledKeys()
        if (replyTimerRef.current) clearTimeout(replyTimerRef.current)
        replyScriptRef.current = DEFAULT_REPLY
        dispatch({ type: 'RESET' })
      },
    }),
    [state, setJourney, pushMessage, pushAssistantMessage, setReplyScript],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useAppStore(): AppStore {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useAppStore 必须在 <AppStoreProvider> 内使用')
  return ctx
}
