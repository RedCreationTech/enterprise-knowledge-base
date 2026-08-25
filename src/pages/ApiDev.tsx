/**
 * API 与开发 ApiDev（W13，design/api-dev.md）
 * API Key 管理（创建仅展示一次 / 脱敏 / 复制 / 吊销 L4）+ 用量卡（1,240/5,000 + sparkline）
 * + Webhook 订阅与测试回执 + 3 步快速开始代码块 + Widget 嵌入代码生成器（配置实时同步）。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AppWindow,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Eye,
  Gauge,
  KeyRound,
  Plus,
  Rocket,
  Trash2,
  Webhook,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TODAY, useAppStore } from '@/mocks'
import { ConfirmationCard, DemoEmptyState, ProgressBar, SectionCard, StatusBadge } from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { Modal } from '@/pages/workspace/Modal'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { useAppToast } from '@/lib/toast'
import { KEY_NAMESPACE, loadLS, saveLS } from '@/lib/storage'
import {
  API_DOC_SECTIONS,
  API_EXPIRY_OPTIONS,
  API_PERMISSION_OPTIONS,
  apiUsage,
  buildWidgetSnippet,
  CUSTOM_API_AUTH_OPTIONS,
  EMPTY_KEY_USAGE,
  initialApiKeys,
  initialCustomApis,
  initialWebhookEvents,
  initialWidgetConfig,
  keyUsage,
  quickStartCurl,
  quickStartPython,
  quickStartResponse,
  webhookConfig,
  WIDGET_ASSISTANTS,
  WIDGET_SPACES,
} from '@/pages/workspace/apiData'
import type { ApiKey, CustomApiApp, WebhookEvent, WidgetConfig } from '@/pages/workspace/apiData'

/** Key 创建/吊销持久化：刷新不丢 */
const KEYS_KEY = KEY_NAMESPACE.apiDev.keys
/** 元素级 schema 校验：历史污染数据（异构结构）直接丢弃，防止渲染期 TypeError 白屏 */
function isApiKey(v: unknown): v is ApiKey {
  if (typeof v !== 'object' || v === null) return false
  const k = v as Record<string, unknown>
  return typeof k.id === 'string' && typeof k.name === 'string' && typeof k.maskedKey === 'string' && Array.isArray(k.permissions)
}
function readKeys(): ApiKey[] | null {
  const v = loadLS<unknown>(KEYS_KEY, null)
  if (!Array.isArray(v)) return null
  const valid = v.filter(isApiKey)
  // 全部为异构污染数据（非用户清空）→ 视为无效键，回退默认数据
  if (v.length > 0 && valid.length === 0) return null
  if (valid.length !== v.length) {
    // 发现污染条目：回写净化后的数组，避免反复读到坏数据
    saveLS(KEYS_KEY, valid)
  }
  return valid
}

/** Webhook 订阅端点（支持多端点） */
interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** 深色代码块：Hover 显示复制按钮（120ms 淡入），复制成功变 ✓ 1.5s */
function CodeBlock({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className={cn('group relative rounded-lg bg-neutral-950 p-3.5', className)}>
      <pre className="overflow-x-auto whitespace-pre text-caption leading-5 text-neutral-200">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={async () => {
          if (await copyText(code)) {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }
        }}
        className={cn(
          'absolute right-2 top-2 flex h-7 items-center gap-1 rounded-md bg-white/10 px-2 text-caption text-white transition-opacity duration-micro ease-brand',
          copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  )
}

/** 近 14 天调用 sparkline（#2F74FF 单线，标注峰值 124） */
function Sparkline({ values }: { values: number[] }) {
  const width = 280
  const height = 72
  const pad = 6
  const max = Math.max(...values)
  const min = Math.min(...values)
  const pts = values.map((v, i) => {
    const x = pad + ((width - pad * 2) * i) / (values.length - 1)
    const y = pad + (height - pad * 2) * (1 - (v - min) / (max - min || 1))
    return { x, y, v }
  })
  const peak = pts.reduce((a, b) => (b.v > a.v ? b : a))
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="近 14 天调用趋势">
      <path d={path} fill="none" stroke="#2F74FF" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={peak.x} cy={peak.y} r={3.5} fill="#fff" stroke="#2F74FF" strokeWidth={2} />
      <text x={Math.min(peak.x, width - 34)} y={Math.max(peak.y - 8, 10)} textAnchor="middle" fontSize={11} fontWeight={600} fill="#1E63F4">
        {peak.v.toLocaleString()}
      </text>
    </svg>
  )
}

export default function ApiDev() {
  const toast = useAppToast()
  const { state } = useAppStore()
  // 冷启动空态：未载入演示数据时展示引导空态（评审 P1-N1）
  const demoOff = state.demoData === false
  const [keys, setKeys] = useState<ApiKey[]>(() => readKeys() ?? initialApiKeys)
  const [showKeyTarget, setShowKeyTarget] = useState<ApiKey | null>(null) // L2 显示完整 Key
  const [revealedKeyId, setRevealedKeyId] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [revokeWord, setRevokeWord] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPerms, setNewPerms] = useState<string[]>(['检索问答'])
  const [newExpiry, setNewExpiry] = useState<(typeof API_EXPIRY_OPTIONS)[number]>('90 天')
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null)
  const [savedConfirmed, setSavedConfirmed] = useState(false)
  const [closeWarn, setCloseWarn] = useState(false)
  // Key 行：编辑权限 / 查看用量
  const [editPermsTarget, setEditPermsTarget] = useState<ApiKey | null>(null)
  const [editPermsDraft, setEditPermsDraft] = useState<string[]>([])
  const [usageTarget, setUsageTarget] = useState<ApiKey | null>(null)
  // 开发文档 Drawer
  const [docOpen, setDocOpen] = useState(false)
  const [docSection, setDocSection] = useState(API_DOC_SECTIONS[0].id)
  const keyTableRef = useRef<HTMLDivElement>(null)

  // Key 创建/吊销持久化（与既有逻辑整合，刷新不丢）
  useEffect(() => {
    saveLS(KEYS_KEY, keys)
  }, [keys])

  // Webhook 多端点
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([
    { id: 'ep-1', url: webhookConfig.url, events: ['新反馈', '无答案告警'] },
  ])
  const [editingEpId, setEditingEpId] = useState<string | null>(null)
  const [editingEpUrl, setEditingEpUrl] = useState('')
  const [addEpOpen, setAddEpOpen] = useState(false)
  const [newEpUrl, setNewEpUrl] = useState('')
  const [newEpEvents, setNewEpEvents] = useState<string[]>(['新反馈'])
  const [deleteEpTarget, setDeleteEpTarget] = useState<WebhookEndpoint | null>(null)
  const [events, setEvents] = useState<WebhookEvent[]>(initialWebhookEvents)
  const [testingEpId, setTestingEpId] = useState<string | null>(null)
  const [testReceipt, setTestReceipt] = useState<{ ok: boolean; text: string } | null>(null)
  const [secret, setSecret] = useState(webhookConfig.secret)
  const [confirmSecret, setConfirmSecret] = useState(false)

  // 自定义 API 应用（与应用中心 custom-api 双向打通）
  const [customApis, setCustomApis] = useState<CustomApiApp[]>(initialCustomApis)
  const [capiCreateOpen, setCapiCreateOpen] = useState(false)
  const [capiName, setCapiName] = useState('')
  const [capiUrl, setCapiUrl] = useState('')
  const [capiAuth, setCapiAuth] = useState<(typeof CUSTOM_API_AUTH_OPTIONS)[number]>('API Key（Header）')
  const [capiDesc, setCapiDesc] = useState('')
  const [capiTarget, setCapiTarget] = useState<CustomApiApp | null>(null)
  const [capiEditUrl, setCapiEditUrl] = useState('')
  const [capiEditAuth, setCapiEditAuth] = useState<string>('')
  const [capiRegenOpen, setCapiRegenOpen] = useState(false)

  const [widget, setWidget] = useState<WidgetConfig>(initialWidgetConfig)
  const [newTag, setNewTag] = useState('')
  const widgetSnippet = useMemo(() => buildWidgetSnippet(widget), [widget])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [widgetSynced, setWidgetSynced] = useState(true)

  const updateWidget = (patch: Partial<WidgetConfig>) => {
    setWidget((w) => ({ ...w, ...patch }))
    setWidgetSynced(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setWidgetSynced(true), 500)
  }

  const activeKeys = keys.filter((k) => k.status === '生效中')
  const subscribedCount = events.filter((e) => e.subscribed).length

  const handleCreate = () => {
    const id = `key-${Date.now()}`
    const rand = Math.random().toString(36).slice(2, 8)
    const k: ApiKey = {
      id,
      name: newName.trim(),
      maskedKey: `sk-live-••••••${rand.slice(0, 4)}`,
      fullKey: `sk-live-${rand}${Date.now().toString(36)}9x2w7q`,
      permissions: newPerms,
      createdAt: TODAY,
      createdBy: '张伟',
      lastCallAt: '尚未调用',
      status: '生效中',
    }
    setKeys((prev) => [...prev, k])
    setCreatedKey(k)
    setSavedConfirmed(false)
    setCloseWarn(false)
    setShowCreate(false)
    setNewName('')
    setNewPerms(['检索问答'])
  }

  const tryCloseCreated = () => {
    if (!savedConfirmed) {
      setCloseWarn(true)
      return
    }
    setCreatedKey(null)
  }

  const sendTestEvent = (ep: WebhookEndpoint) => {
    setTestingEpId(ep.id)
    setTestReceipt(null)
    setTimeout(() => {
      setTestingEpId(null)
      setTestReceipt({ ok: true, text: `测试事件已送达 ${ep.url} · 响应 200 · 耗时 182ms` })
    }, 900)
  }

  /** 新增 Webhook 端点（URL + 事件校验入列） */
  const addEndpoint = () => {
    const url = newEpUrl.trim()
    if (!/^https?:\/\/.+/.test(url) || newEpEvents.length === 0) return
    setEndpoints((prev) => [...prev, { id: `ep-${Date.now()}`, url, events: newEpEvents }])
    toast.success('订阅端点已新增')
    setAddEpOpen(false)
    setNewEpUrl('')
    setNewEpEvents(['新反馈'])
  }

  /** 保存编辑权限（行权限列同步更新） */
  const saveEditPerms = () => {
    if (!editPermsTarget || editPermsDraft.length === 0) return
    setKeys((prev) => prev.map((k) => (k.id === editPermsTarget.id ? { ...k, permissions: editPermsDraft } : k)))
    toast.success(`「${editPermsTarget.name}」权限已更新`)
    setEditPermsTarget(null)
  }

  /** 创建自定义 API 应用（校验后入列） */
  const createCustomApi = () => {
    const name = capiName.trim()
    const url = capiUrl.trim()
    if (!name || !/^https?:\/\/.+/.test(url)) return
    const rand = Math.random().toString(36).slice(2, 6)
    const app: CustomApiApp = {
      id: `capi-${Date.now()}`,
      name,
      openApiUrl: url,
      authMethod: capiAuth,
      description: capiDesc.trim() || '暂无描述',
      maskedSecret: `sk-capi-••••••${rand}`,
      status: '启用',
      createdAt: TODAY,
      trend14d: [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8],
    }
    setCustomApis((prev) => [...prev, app])
    toast.success(`自定义 API 应用「${name}」已创建`)
    setCapiCreateOpen(false)
    setCapiName('')
    setCapiUrl('')
    setCapiDesc('')
  }

  /** 打开应用设置 Drawer 并同步编辑草稿 */
  const openCapiSettings = (app: CustomApiApp) => {
    setCapiTarget(app)
    setCapiEditUrl(app.openApiUrl)
    setCapiEditAuth(app.authMethod)
  }

  const saveCapiConfig = () => {
    if (!capiTarget || !/^https?:\/\/.+/.test(capiEditUrl.trim())) return
    setCustomApis((prev) => prev.map((a) => (a.id === capiTarget.id ? { ...a, openApiUrl: capiEditUrl.trim(), authMethod: capiEditAuth } : a)))
    setCapiTarget((t) => (t ? { ...t, openApiUrl: capiEditUrl.trim(), authMethod: capiEditAuth } : t))
    toast.success('OpenAPI 配置已保存并生效')
  }

  const regenCapiSecret = () => {
    if (!capiTarget) return
    const rand = Math.random().toString(36).slice(2, 6)
    const next = `sk-capi-••••••${rand}`
    setCustomApis((prev) => prev.map((a) => (a.id === capiTarget.id ? { ...a, maskedSecret: next } : a)))
    setCapiTarget((t) => (t ? { ...t, maskedSecret: next } : t))
    setCapiRegenOpen(false)
    toast.success('应用密钥已重新生成，旧密钥已失效')
  }

  const toggleCapiStatus = () => {
    if (!capiTarget) return
    const next = capiTarget.status === '启用' ? ('停用' as const) : ('启用' as const)
    setCustomApis((prev) => prev.map((a) => (a.id === capiTarget.id ? { ...a, status: next } : a)))
    setCapiTarget((t) => (t ? { ...t, status: next } : t))
    toast.success(`「${capiTarget.name}」已${next}${next === '停用' ? '，调用将被拒绝（401）' : ''}`)
  }

  const usageData = usageTarget ? (keyUsage[usageTarget.id] ?? EMPTY_KEY_USAGE) : EMPTY_KEY_USAGE

  // 冷启动空态：未载入演示数据时只显示页头 + 引导空态（评审 P1-N1）
  if (demoOff) {
    return (
      <div>
        <PageHeader
          crumbs={['应用与集成', 'API 与开发']}
          title="API 与开发"
          subtitle="完成快速配置或载入演示数据后，这里会展示真实的企业知识数据"
        />
        <DemoEmptyState />
      </div>
    )
  }

  return (
    <div>
      {/* 顶部单行横幅：标题(左) + 紧凑统计 & 操作(右) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <nav className="mb-1 flex h-8 items-center gap-1 text-body-sm text-neutral-500">
            应用与集成
            <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
            <span className="font-medium text-neutral-950">API 与开发</span>
          </nav>
          <h1 className="text-h1 text-neutral-950">API 与开发</h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {[
            { icon: <KeyRound className="h-4 w-4" />, name: 'API Key', value: activeKeys.length, suffix: '个' },
            { icon: <Gauge className="h-4 w-4" />, name: '本月调用', value: apiUsage.month.toLocaleString(), suffix: '次' },
            { icon: <Webhook className="h-4 w-4" />, name: 'Webhook', value: subscribedCount, suffix: '个' },
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDocOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
            >
              <BookOpen className="h-4 w-4" />
              查看开发文档
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              创建 API Key
            </button>
          </div>
        </div>
      </div>

      {/* Row 1：左 8（Key 表 + Webhook）｜ 右 4（用量 + 快速开始） */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 flex flex-col gap-4 xl:col-span-8">
          {/* API Key 管理（快速开始「管理 Key」滚动锚点） */}
          <div id="api-keys" ref={keyTableRef} className="scroll-mt-24">
          <SectionCard title="API Key 管理" icon={<KeyRound className="h-5 w-5" />}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="h-10 bg-surface-soft text-body-sm text-neutral-500">
                    <th className="rounded-l-md px-3 font-normal">名称</th>
                    <th className="px-3 font-normal">Key</th>
                    <th className="px-3 font-normal">权限范围</th>
                    <th className="px-3 font-normal">创建时间</th>
                    <th className="px-3 font-normal">最近调用</th>
                    <th className="px-3 font-normal">状态</th>
                    <th className="rounded-r-md px-3 text-right font-normal">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => {
                    const revoked = k.status === '已吊销'
                    return (
                      <tr
                        key={k.id}
                        className={cn(
                          'h-12 border-b border-neutral-100 text-body-sm transition-colors duration-micro ease-brand',
                          revoked ? 'opacity-50' : 'hover:bg-surface-page',
                        )}
                      >
                        <td className="rounded-l-md px-3 font-medium text-neutral-950">{k.name}</td>
                        <td className="px-3">
                          <span className="inline-flex items-center gap-1.5 font-mono text-caption text-neutral-700">
                            {revealedKeyId === k.id ? k.fullKey : k.maskedKey}
                            {!revoked && (
                              <button
                                type="button"
                                aria-label="显示完整 Key"
                                onClick={() => setShowKeyTarget(k)}
                                className="text-neutral-400 hover:text-brand-600"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </span>
                        </td>
                        <td className="px-3 text-neutral-500">{k.permissions.join(' · ')}</td>
                        <td className="px-3 text-neutral-500">
                          {k.createdAt} {k.createdBy}
                        </td>
                        <td className="px-3 text-neutral-500">{k.lastCallAt}</td>
                        <td className="px-3">
                          {revoked ? (
                            <span className="inline-flex h-6 items-center rounded-pill bg-neutral-100 px-2 text-caption font-medium text-neutral-500">
                              已吊销
                            </span>
                          ) : (
                            <StatusBadge status="生效中" />
                          )}
                        </td>
                        <td className="rounded-r-md px-3 text-right">
                          <button
                            type="button"
                            disabled={revoked}
                            onClick={() => {
                              setEditPermsTarget(k)
                              setEditPermsDraft(k.permissions)
                            }}
                            className="mr-3 text-body-sm text-brand-600 hover:text-brand-500 disabled:text-neutral-300"
                          >
                            编辑权限
                          </button>
                          <button
                            type="button"
                            onClick={() => setUsageTarget(k)}
                            className="mr-3 text-body-sm text-brand-600 hover:text-brand-500"
                          >
                            查看用量
                          </button>
                          <button
                            type="button"
                            disabled={revoked}
                            onClick={async () => {
                              if (await copyText(k.fullKey)) toast.success('Key 已复制，请妥善保管')
                            }}
                            className="mr-3 text-body-sm text-brand-600 hover:text-brand-500 disabled:text-neutral-300"
                          >
                            复制
                          </button>
                          <button
                            type="button"
                            disabled={revoked}
                            onClick={() => {
                              setRevokeTarget(k)
                              setRevokeWord('')
                            }}
                            className="text-body-sm text-danger hover:opacity-80 disabled:text-neutral-300"
                          >
                            吊销
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-caption text-neutral-400">Key 默认脱敏显示；「显示完整 Key」需 L2 确认并记入审计日志。</p>
          </SectionCard>
          </div>

          {/* Webhook 配置（支持多端点） */}
          <SectionCard title="Webhook 配置" icon={<Webhook className="h-5 w-5" />}>
            <div className="flex items-center justify-between">
              <p className="text-body-sm text-neutral-500">订阅端点（{endpoints.length} 个）</p>
              <button
                type="button"
                onClick={() => setAddEpOpen(true)}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-[#BFD0F2] bg-white px-3 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
              >
                <Plus className="h-3.5 w-3.5" />
                新增端点
              </button>
            </div>

            <ul className="mt-2.5 flex flex-col gap-2">
              {endpoints.map((ep) => (
                <li key={ep.id} className="rounded-lg border border-neutral-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {editingEpId === ep.id ? (
                      <input
                        value={editingEpUrl}
                        onChange={(e) => setEditingEpUrl(e.target.value)}
                        className="h-9 min-w-[240px] flex-1 rounded-md border border-brand-500 px-3 font-mono text-caption text-neutral-800 shadow-input focus:outline-none"
                      />
                    ) : (
                      <code className="min-w-0 flex-1 truncate rounded-md bg-surface-soft px-2.5 py-1.5 font-mono text-caption text-neutral-800">{ep.url}</code>
                    )}
                    {editingEpId === ep.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          const url = editingEpUrl.trim()
                          if (!/^https?:\/\/.+/.test(url)) {
                            toast.warning('请输入合法的 http(s) 地址')
                            return
                          }
                          setEndpoints((prev) => prev.map((x) => (x.id === ep.id ? { ...x, url } : x)))
                          setEditingEpId(null)
                          toast.success('订阅地址已保存')
                        }}
                        className="h-8 shrink-0 rounded-md bg-brand-600 px-3 text-body-sm font-medium text-white hover:bg-brand-500"
                      >
                        保存
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEpId(ep.id)
                          setEditingEpUrl(ep.url)
                        }}
                        className="h-8 shrink-0 rounded-md border border-neutral-200 px-3 text-body-sm text-neutral-800 hover:border-brand-300 hover:text-brand-600"
                      >
                        修改
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => sendTestEvent(ep)}
                      disabled={testingEpId !== null}
                      className="shrink-0 text-body-sm font-medium text-brand-600 hover:text-brand-500 disabled:text-neutral-400"
                    >
                      {testingEpId === ep.id ? '发送中…' : '发送测试事件'}
                    </button>
                    <button
                      type="button"
                      aria-label={`删除端点 ${ep.url}`}
                      disabled={endpoints.length <= 1}
                      title={endpoints.length <= 1 ? '至少保留 1 个端点' : '删除端点'}
                      onClick={() => setDeleteEpTarget(ep)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors duration-micro ease-brand hover:bg-danger-bg hover:text-danger disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ep.events.map((ev) => (
                      <span key={ev} className="rounded-pill bg-brand-50 px-2 py-0.5 text-caption font-medium text-brand-700">
                        {ev}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            {testReceipt && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  'mt-3 flex items-center justify-between rounded-lg px-3.5 py-2.5 text-body-sm',
                  testReceipt.ok ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger',
                )}
              >
                <span>{testReceipt.text}</span>
                {!testReceipt.ok && endpoints[0] && (
                  <button type="button" onClick={() => sendTestEvent(endpoints[0])} className="font-medium underline">
                    重试
                  </button>
                )}
              </motion.div>
            )}

            <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
              {events.map((ev) => (
                <li key={ev.key} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={ev.subscribed}
                    onClick={() => {
                      setEvents((prev) => prev.map((e) => (e.key === ev.key ? { ...e, subscribed: !e.subscribed } : e)))
                      toast.success(`已${ev.subscribed ? '取消订阅' : '订阅'}「${ev.name}」`)
                    }}
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border transition-colors duration-micro ease-brand',
                      ev.subscribed ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300 bg-white hover:border-brand-300',
                    )}
                  >
                    {ev.subscribed && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-medium text-neutral-950">{ev.name}</p>
                    <p className="mt-0.5 text-caption text-neutral-400">{ev.desc}</p>
                  </div>
                  <span className="shrink-0 text-caption text-neutral-400">
                    {ev.lastTrigger === '未触发' ? '未触发' : `最近触发 ${ev.lastTrigger}`}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-soft px-3.5 py-2.5">
              <span className="text-body-sm text-neutral-700">
                签名密钥 <code className="ml-1 font-mono text-caption">{secret}</code>
              </span>
              <button
                type="button"
                onClick={() => setConfirmSecret(true)}
                className="text-body-sm font-medium text-brand-600 hover:text-brand-500"
              >
                重新生成
              </button>
            </div>
          </SectionCard>

          {/* 自定义 API 应用（与应用中心 custom-api 双向打通） */}
          <SectionCard
            title="自定义 API 应用"
            icon={<AppWindow className="h-5 w-5" />}
            actions={
              <button
                type="button"
                onClick={() => setCapiCreateOpen(true)}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-600 px-3 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
              >
                <Plus className="h-3.5 w-3.5" />
                创建应用
              </button>
            }
          >
            {customApis.length === 0 ? (
              <p className="py-6 text-center text-body-sm text-neutral-400">暂无自定义 API 应用，点击「创建应用」将知识能力接入自有系统</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {customApis.map((app) => (
                  <div key={app.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 transition-colors duration-micro ease-brand hover:border-brand-300">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-body-sm font-semibold text-neutral-950">{app.name}</p>
                      <span
                        className={cn(
                          'inline-flex h-6 items-center rounded-pill px-2 text-caption font-medium',
                          app.status === '启用' ? 'bg-success-bg text-success' : 'bg-neutral-100 text-neutral-500',
                        )}
                      >
                        {app.status}
                      </span>
                    </div>
                    <code className="truncate rounded-md bg-surface-soft px-2 py-1 font-mono text-caption text-neutral-700">{app.openApiUrl}</code>
                    <p className="line-clamp-2 text-caption text-neutral-500">{app.description}</p>
                    <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-2.5">
                      <span className="text-caption text-neutral-400">{app.authMethod} · 创建于 {app.createdAt}</span>
                      <button
                        type="button"
                        onClick={() => openCapiSettings(app)}
                        className="h-8 rounded-md border border-[#BFD0F2] bg-white px-3 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
                      >
                        设置
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-caption text-neutral-400">创建的应用会同步出现在应用中心「自定义 API」中，可在应用中心查看 OpenAPI 配置与调用统计。</p>
          </SectionCard>
        </div>

        {/* 右 4：用量卡 + 快速开始 */}
        <div className="col-span-12 flex flex-col gap-4 xl:col-span-4">
          <SectionCard title="本月调用用量" icon={<Gauge className="h-5 w-5" />}>
            <div className="flex items-baseline gap-1.5">
              <span className="text-metric-lg text-neutral-950">{apiUsage.month.toLocaleString()}</span>
              <span className="text-body-sm text-neutral-500">次 / 限额 {apiUsage.limit.toLocaleString()}</span>
            </div>
            <ProgressBar value={apiUsage.pct} className="mt-2.5" />
            <p className="mt-1.5 text-caption text-neutral-400">已用 {apiUsage.pct}% · 额度每月 1 日重置</p>
            <div className="mt-3">
              <Sparkline values={apiUsage.trend14d} />
              <p className="text-caption text-neutral-400">近 14 天调用趋势</p>
            </div>
            <div className="mt-3 flex flex-col gap-1.5 border-t border-neutral-100 pt-3">
              {apiUsage.byKey.map((b) => (
                <div key={b.name} className="flex items-center justify-between text-body-sm">
                  <span className="text-neutral-500">{b.name}</span>
                  <span className="font-medium text-neutral-950">{b.count.toLocaleString()} 次</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="快速开始" icon={<Rocket className="h-5 w-5" />}>
            <ol className="flex flex-col gap-4">
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-caption font-semibold text-white">
                  <Check className="h-3 w-3" />
                </span>
                <div className="text-body-sm">
                  <span className="font-medium text-neutral-950">创建 API Key</span>
                  <span className="ml-2 text-caption text-success">已完成</span>
                  <button
                    type="button"
                    onClick={() => keyTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="ml-2 text-caption text-brand-600 hover:text-brand-500 hover:underline"
                  >
                    管理 Key
                  </button>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-caption font-semibold text-white">2</span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-neutral-950">调用检索问答 API</p>
                  <CodeBlock code={quickStartCurl} className="mt-2" />
                  <p className="mt-1.5 text-caption text-neutral-400">
                    响应示例：<code className="font-mono">{quickStartResponse}</code>
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-caption font-semibold text-white">3</span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-neutral-950">或用 OpenAI 兼容端点</p>
                  <CodeBlock code={quickStartPython} className="mt-2" />
                </div>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setDocOpen(true)}
              className="mt-4 text-body-sm font-medium text-brand-600 hover:text-brand-500"
            >
              查看完整 API 参考 →
            </button>
          </SectionCard>
        </div>
      </div>

      {/* Row 2：Widget 嵌入代码生成器（5+7） */}
      <div className="mt-4">
        <SectionCard title="Widget 嵌入代码生成器" icon={<Code2 className="h-5 w-5" />}>
          <div className="grid grid-cols-12 gap-6">
            {/* 左 5：配置 */}
            <div className="col-span-12 flex flex-col gap-4 lg:col-span-5">
              <div>
                <p className="text-body-sm font-semibold text-neutral-950">知识范围</p>
                <select
                  value={widget.space}
                  onChange={(e) => updateWidget({ space: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
                >
                  {WIDGET_SPACES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-body-sm font-semibold text-neutral-950">助手</p>
                <select
                  value={widget.assistant}
                  onChange={(e) => updateWidget({ assistant: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
                >
                  {WIDGET_ASSISTANTS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-body-sm font-semibold text-neutral-950">主题</p>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(
                    [
                      { v: 'light', label: '浅色' },
                      { v: 'dark', label: '深色' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.v}
                      type="button"
                      onClick={() => updateWidget({ theme: t.v })}
                      className={cn(
                        'flex h-10 items-center justify-center gap-1.5 rounded-md border text-body-sm transition-colors duration-micro ease-brand',
                        widget.theme === t.v
                          ? 'border-[1.5px] border-brand-500 bg-surface-cardSel font-medium text-brand-700'
                          : 'border-neutral-200 text-neutral-700 hover:border-brand-300',
                      )}
                    >
                      {widget.theme === t.v && <Check className="h-3.5 w-3.5 text-brand-600" />}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-body-sm font-semibold text-neutral-950">快捷问题</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-md border border-neutral-200 p-2">
                  {widget.quickQuestions.map((q) => (
                    <span key={q} className="inline-flex items-center gap-1 rounded-pill bg-brand-50 px-2.5 py-1 text-caption font-medium text-brand-700">
                      {q}
                      <button
                        type="button"
                        aria-label={`移除 ${q}`}
                        onClick={() => updateWidget({ quickQuestions: widget.quickQuestions.filter((x) => x !== q) })}
                        className="text-brand-300 hover:text-brand-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTag.trim()) {
                        updateWidget({ quickQuestions: [...widget.quickQuestions, newTag.trim()] })
                        setNewTag('')
                      }
                    }}
                    placeholder="回车添加"
                    className="h-7 min-w-[72px] flex-1 bg-transparent px-1 text-body-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2.5">
                <span className="text-body-sm text-neutral-800">显示完整引用</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={widget.showFullCitations}
                  onClick={() => updateWidget({ showFullCitations: !widget.showFullCitations })}
                  className={cn(
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-comp ease-brand',
                    widget.showFullCitations ? 'bg-brand-600' : 'bg-neutral-300',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-comp ease-brand',
                      widget.showFullCitations ? 'translate-x-[22px]' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </div>
            </div>

            {/* 右 7：预览 + 代码 */}
            <div className="col-span-12 lg:col-span-7">
              {/* Web Widget 预览缩略卡 */}
              <div className={cn('rounded-xl border p-4', widget.theme === 'dark' ? 'border-neutral-800 bg-neutral-950' : 'border-neutral-200 bg-surface-soft')}>
                <div className="flex justify-end">
                  <div className={cn('w-[260px] rounded-xl p-3 shadow-card', widget.theme === 'dark' ? 'bg-neutral-800' : 'bg-white')}>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-caption font-semibold text-white">知</span>
                      <span className={cn('text-body-sm font-semibold', widget.theme === 'dark' ? 'text-white' : 'text-neutral-950')}>
                        {widget.assistant}
                      </span>
                    </div>
                    <p className={cn('mt-2 rounded-lg p-2 text-caption', widget.theme === 'dark' ? 'bg-neutral-700 text-neutral-200' : 'bg-surface-assistant text-neutral-800')}>
                      您好，我是{widget.assistant}，可以回答「{WIDGET_SPACES.find((s) => s.value === widget.space)?.label}」范围内的问题。
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {widget.quickQuestions.map((q) => (
                        <span
                          key={q}
                          className={cn(
                            'rounded-pill border px-2 py-0.5 text-caption',
                            widget.theme === 'dark' ? 'border-brand-300/40 text-brand-300' : 'border-brand-300 text-brand-600',
                          )}
                        >
                          {q}
                        </span>
                      ))}
                    </div>
                    {widget.showFullCitations && (
                      <p className={cn('mt-2 text-caption', widget.theme === 'dark' ? 'text-neutral-400' : 'text-neutral-400')}>
                        答案将附完整引用来源
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-body-sm font-semibold text-neutral-950">嵌入代码</p>
                <span className={cn('text-caption', widgetSynced ? 'text-success' : 'text-neutral-400')}>
                  {widgetSynced ? '✓ 已与配置同步' : '同步中…'}
                </span>
              </div>
              <CodeBlock code={widgetSnippet} className="mt-2" />
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (await copyText(widgetSnippet)) toast.success('嵌入代码已复制，粘贴到网站 </body> 前即可')
                  }}
                  className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
                >
                  复制嵌入代码
                </button>
                <p className="text-caption text-neutral-400">Widget 与知识网站共享同一权限策略与引用标准</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* 创建 Key Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="创建 API Key" description="创建成功后完整 Key 仅展示一次" width={520}>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">名称（必填）</p>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如：CRM 系统对接 Key"
              className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 px-3 text-body-sm text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
            />
          </div>
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">权限范围</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {API_PERMISSION_OPTIONS.map((p) => {
                const on = newPerms.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewPerms((prev) => (on ? prev.filter((x) => x !== p) : [...prev, p]))}
                    className={cn(
                      'flex h-10 items-center gap-2 rounded-md border px-3 text-body-sm transition-colors duration-micro ease-brand',
                      on ? 'border-[1.5px] border-brand-500 bg-surface-cardSel text-brand-700' : 'border-neutral-200 text-neutral-700 hover:border-brand-300',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-sm border',
                        on ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300',
                      )}
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    {p}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">有效期</p>
            <select
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value as typeof newExpiry)}
              className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
            >
              {API_EXPIRY_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowCreate(false)}
            className="h-10 rounded-md px-4 text-body-sm text-neutral-500 hover:bg-neutral-100"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!newName.trim() || newPerms.length === 0}
            onClick={handleCreate}
            className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            创建 Key
          </button>
        </div>
      </Modal>

      {/* 创建成功：完整 Key 仅展示一次 */}
      <Modal open={createdKey !== null} onClose={tryCloseCreated} title="Key 创建成功" description="请立即复制保存，关闭后将无法再次查看完整 Key" width={520}>
        {createdKey && (
          <div>
            <div className="rounded-lg bg-neutral-950 p-3.5">
              <code className="break-all font-mono text-body-sm text-neutral-200">{createdKey.fullKey}</code>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={async () => {
                  if (await copyText(createdKey.fullKey)) toast.success('Key 已复制，请妥善保管')
                }}
                className="inline-flex items-center gap-1.5 text-body-sm font-medium text-brand-600 hover:text-brand-500"
              >
                <Copy className="h-4 w-4" />
                复制完整 Key
              </button>
              <label className="flex cursor-pointer items-center gap-2 text-body-sm text-neutral-700">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={savedConfirmed}
                  onClick={() => {
                    setSavedConfirmed((v) => !v)
                    setCloseWarn(false)
                  }}
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-sm border transition-colors duration-micro ease-brand',
                    savedConfirmed ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300 bg-white',
                  )}
                >
                  {savedConfirmed && <Check className="h-3.5 w-3.5" />}
                </button>
                我已保存此 Key
              </label>
            </div>
            {closeWarn && (
              <p className="mt-3 rounded-lg bg-warning-bg px-3 py-2 text-body-sm text-warning">
                关闭后将无法再次查看完整 Key，请确认已保存。
              </p>
            )}
            <div className="mt-5 flex items-center justify-end">
              <button
                type="button"
                onClick={tryCloseCreated}
                className={cn(
                  'h-10 rounded-md px-4 text-body-sm font-medium transition-colors duration-micro ease-brand',
                  savedConfirmed ? 'bg-brand-600 text-white hover:bg-brand-500' : 'bg-neutral-100 text-neutral-400',
                )}
              >
                完成
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* L2：显示完整 Key（审计） */}
      <Modal open={showKeyTarget !== null} onClose={() => setShowKeyTarget(null)} width={560}>
        {showKeyTarget && (
          <ConfirmationCard
            title="显示完整 Key"
            description="该操作将记入审计日志"
            fields={[
              { label: '动作', value: `查看「${showKeyTarget.name}」的完整 Key` },
              { label: '影响对象', value: `${showKeyTarget.name}（${showKeyTarget.permissions.join(' · ')}）` },
              { label: '外部影响', value: '完整 Key 泄露可导致接口被冒用，请在安全环境查看' },
              { label: '可撤销性', value: '如怀疑泄露可立即吊销并新建 Key' },
            ]}
            confirmText="确认查看"
            onConfirm={() => {
              setRevealedKeyId(showKeyTarget.id)
              setShowKeyTarget(null)
              toast.warning('已显示完整 Key，本次查看已记入审计日志')
            }}
            onModify={() => setShowKeyTarget(null)}
            onCancel={() => setShowKeyTarget(null)}
          />
        )}
      </Modal>

      {/* L4：吊销 Key（输入名称确认） */}
      <Modal open={revokeTarget !== null} onClose={() => setRevokeTarget(null)} title={`吊销「${revokeTarget?.name}」`} width={480}>
        {revokeTarget && (
          <div>
            <p className="text-body text-neutral-700">
              吊销后 <span className="font-medium text-danger">立即失效</span>
              ，使用该 Key 的应用将无法调用，<span className="font-medium text-danger">不可恢复</span>。
            </p>
            <p className="mt-3 text-body-sm text-neutral-500">
              请输入 Key 名称「<span className="font-semibold text-neutral-950">{revokeTarget.name}</span>」以确认：
            </p>
            <input
              value={revokeWord}
              onChange={(e) => setRevokeWord(e.target.value)}
              placeholder={revokeTarget.name}
              className="mt-2 h-10 w-full rounded-md border border-neutral-200 px-3 text-body text-neutral-800 focus:border-danger focus:outline-none"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                className="h-10 rounded-md px-4 text-body-sm text-neutral-500 hover:bg-neutral-100"
              >
                取消
              </button>
              <button
                type="button"
                disabled={revokeWord !== revokeTarget.name}
                onClick={() => {
                  setKeys((prev) => prev.map((k) => (k.id === revokeTarget.id ? { ...k, status: '已吊销' } : k)))
                  setRevokeTarget(null)
                  toast.warning(`「${revokeTarget.name}」已吊销并立即失效`)
                }}
                className="h-10 rounded-md bg-danger px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:opacity-90 disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                确认吊销
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* L2：重新生成签名密钥 */}
      <Modal open={confirmSecret} onClose={() => setConfirmSecret(false)} width={560}>
        <ConfirmationCard
          title="重新生成签名密钥"
          description="用于校验 Webhook 推送来源"
          fields={[
            { label: '动作', value: '重新生成 Webhook 签名密钥' },
            { label: '影响对象', value: endpoints.map((e) => e.url).join('、') || '全部订阅端点' },
            { label: '外部影响', value: '旧密钥立即失效，需在接收端同步更新后再验证' },
            { label: '可撤销性', value: '不可撤销，但可再次重新生成' },
          ]}
          confirmText="确认执行"
          onConfirm={() => {
            const rand = Math.random().toString(36).slice(2, 6)
            setSecret(`whsec_••••••${rand}`)
            setConfirmSecret(false)
            toast.success('签名密钥已重新生成，旧密钥已失效')
          }}
          onModify={() => setConfirmSecret(false)}
          onCancel={() => setConfirmSecret(false)}
        />
      </Modal>

      {/* 编辑权限 Modal（保存更新行权限列） */}
      <Modal open={editPermsTarget !== null} onClose={() => setEditPermsTarget(null)} title={`编辑权限 · ${editPermsTarget?.name ?? ''}`} description="调整该 Key 可调用的接口范围，保存后立即生效" width={520}>
        <div className="grid grid-cols-2 gap-2">
          {API_PERMISSION_OPTIONS.map((p) => {
            const on = editPermsDraft.includes(p)
            return (
              <button
                key={p}
                type="button"
                onClick={() => setEditPermsDraft((prev) => (on ? prev.filter((x) => x !== p) : [...prev, p]))}
                className={cn(
                  'flex h-10 items-center gap-2 rounded-md border px-3 text-body-sm transition-colors duration-micro ease-brand',
                  on ? 'border-[1.5px] border-brand-500 bg-surface-cardSel text-brand-700' : 'border-neutral-200 text-neutral-700 hover:border-brand-300',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-sm border',
                    on ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300',
                  )}
                >
                  {on && <Check className="h-3 w-3" />}
                </span>
                {p}
              </button>
            )
          })}
        </div>
        {editPermsDraft.length === 0 && <p className="mt-2 text-caption text-danger">至少保留 1 项权限</p>}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={() => setEditPermsTarget(null)} className="h-10 rounded-md px-4 text-body-sm text-neutral-500 hover:bg-neutral-100">
            取消
          </button>
          <button
            type="button"
            disabled={editPermsDraft.length === 0}
            onClick={saveEditPerms}
            className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            保存权限
          </button>
        </div>
      </Modal>

      {/* 查看用量 Drawer（该 Key 近 14 天趋势 + 端点分布） */}
      <SideDrawer open={usageTarget !== null} onClose={() => setUsageTarget(null)} width={480} title={`调用用量 · ${usageTarget?.name ?? ''}`}>
        {usageTarget && (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface-soft p-3.5">
                <p className="text-caption text-neutral-400">近 14 天总调用</p>
                <p className="mt-1 text-h3 text-neutral-950">{usageData.trend14d.reduce((a, b) => a + b, 0).toLocaleString()} 次</p>
              </div>
              <div className="rounded-lg bg-surface-soft p-3.5">
                <p className="text-caption text-neutral-400">单日峰值</p>
                <p className="mt-1 text-h3 text-neutral-950">{Math.max(...usageData.trend14d)} 次</p>
              </div>
            </div>
            <p className="mb-2 mt-4 text-body-sm font-semibold text-neutral-950">近 14 天调用趋势</p>
            <div className="h-44 rounded-lg border border-neutral-200 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usageData.trend14d.map((v, i) => ({ day: `D${i + 1}`, calls: v }))} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#98A2B3' }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: '#98A2B3' }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => [`${v} 次`, '调用量']} />
                  <Area type="monotone" dataKey="calls" stroke="#2F74FF" strokeWidth={2} fill="#2F74FF" fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mb-2 mt-4 text-body-sm font-semibold text-neutral-950">端点分布（本月）</p>
            {usageData.endpoints.length === 0 ? (
              <p className="rounded-lg bg-surface-soft px-3.5 py-3 text-body-sm text-neutral-400">该 Key 本月暂无调用记录</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {usageData.endpoints.map((e) => {
                  const total = usageData.endpoints.reduce((a, x) => a + x.count, 0)
                  const pct = Math.round((e.count / total) * 100)
                  return (
                    <li key={e.path} className="rounded-lg border border-neutral-200 px-3.5 py-2.5">
                      <div className="flex items-center justify-between text-body-sm">
                        <code className="font-mono text-caption text-neutral-800">{e.path}</code>
                        <span className="font-medium text-neutral-950">{e.count.toLocaleString()} 次 · {pct}%</span>
                      </div>
                      <ProgressBar value={pct} className="mt-2" />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </SideDrawer>

      {/* 开发文档 Drawer（目录 + 章节锚点切换） */}
      <SideDrawer open={docOpen} onClose={() => setDocOpen(false)} width={520} title="开发文档 · OpenAPI 参考">
        <nav className="mb-4 flex flex-wrap gap-2">
          {API_DOC_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setDocSection(s.id)
                document.getElementById(`api-doc-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={cn(
                'h-8 rounded-pill px-3.5 text-body-sm transition-colors duration-comp ease-brand',
                docSection === s.id ? 'bg-brand-600 font-medium text-white' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100',
              )}
            >
              {s.title}
            </button>
          ))}
        </nav>
        <div className="flex flex-col gap-5">
          {API_DOC_SECTIONS.map((s) => (
            <section key={s.id} id={`api-doc-${s.id}`} className="scroll-mt-4">
              <h4 className="text-body font-semibold text-neutral-950">{s.title}</h4>
              {s.body.map((p, i) => (
                <p key={i} className="mt-1.5 text-body-sm leading-6 text-neutral-700">{p}</p>
              ))}
            </section>
          ))}
        </div>
      </SideDrawer>

      {/* 新增 Webhook 端点 Modal */}
      <Modal open={addEpOpen} onClose={() => setAddEpOpen(false)} title="新增订阅端点" description="事件推送将同时发送到所有订阅端点" width={520}>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">端点 URL（必填）</p>
            <input
              value={newEpUrl}
              onChange={(e) => setNewEpUrl(e.target.value)}
              placeholder="https://your-system.com/webhooks/kb"
              className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 px-3 font-mono text-caption text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
            />
          </div>
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">订阅事件（至少 1 个）</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {events.map((ev) => {
                const on = newEpEvents.includes(ev.name)
                return (
                  <label
                    key={ev.key}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-body-sm transition-colors duration-micro ease-brand',
                      on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setNewEpEvents((prev) => (on ? prev.filter((x) => x !== ev.name) : [...prev, ev.name]))}
                      className="h-4 w-4 accent-brand-600"
                    />
                    {ev.name}
                  </label>
                )
              })}
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={() => setAddEpOpen(false)} className="h-10 rounded-md px-4 text-body-sm text-neutral-500 hover:bg-neutral-100">
            取消
          </button>
          <button
            type="button"
            disabled={!/^https?:\/\/.+/.test(newEpUrl.trim()) || newEpEvents.length === 0}
            onClick={addEndpoint}
            className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            新增端点
          </button>
        </div>
      </Modal>

      {/* L2 确认：删除 Webhook 端点 */}
      <Modal open={deleteEpTarget !== null} onClose={() => setDeleteEpTarget(null)} width={560}>
        {deleteEpTarget && (
          <ConfirmationCard
            title="删除订阅端点"
            description="删除后事件推送将不再发送到该地址"
            fields={[
              { label: '动作', value: '删除 Webhook 订阅端点' },
              { label: '影响对象', value: deleteEpTarget.url },
              { label: '影响范围', value: `订阅事件：${deleteEpTarget.events.join('、')}` },
              { label: '可撤销性', value: '可通过「新增端点」重新添加' },
            ]}
            confirmText="确认删除"
            onConfirm={() => {
              setEndpoints((prev) => prev.filter((e) => e.id !== deleteEpTarget.id))
              setDeleteEpTarget(null)
              toast.warning('订阅端点已删除')
            }}
            onModify={() => setDeleteEpTarget(null)}
            onCancel={() => setDeleteEpTarget(null)}
          />
        )}
      </Modal>

      {/* 创建自定义 API 应用 Modal */}
      <Modal open={capiCreateOpen} onClose={() => setCapiCreateOpen(false)} title="创建自定义 API 应用" description="创建后可在应用中心「自定义 API」中查看与管理" width={520}>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">应用名称（必填）</p>
            <input
              value={capiName}
              onChange={(e) => setCapiName(e.target.value)}
              placeholder="例如：CRM 客户助手"
              className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 px-3 text-body-sm text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
            />
          </div>
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">OpenAPI URL（必填）</p>
            <input
              value={capiUrl}
              onChange={(e) => setCapiUrl(e.target.value)}
              placeholder="https://api.example.com/v1/kb/ask"
              className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 px-3 font-mono text-caption text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
            />
            {capiUrl.trim() !== '' && !/^https?:\/\/.+/.test(capiUrl.trim()) && (
              <p className="mt-1 text-caption text-danger">请输入合法的 http(s) 地址</p>
            )}
          </div>
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">鉴权方式</p>
            <select
              value={capiAuth}
              onChange={(e) => setCapiAuth(e.target.value as typeof capiAuth)}
              className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
            >
              {CUSTOM_API_AUTH_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">描述（选填）</p>
            <textarea
              value={capiDesc}
              onChange={(e) => setCapiDesc(e.target.value)}
              rows={2}
              placeholder="该应用的接入场景与用途…"
              className="mt-1.5 w-full resize-none rounded-md border border-neutral-200 px-3 py-2.5 text-body-sm text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={() => setCapiCreateOpen(false)} className="h-10 rounded-md px-4 text-body-sm text-neutral-500 hover:bg-neutral-100">
            取消
          </button>
          <button
            type="button"
            disabled={!capiName.trim() || !/^https?:\/\/.+/.test(capiUrl.trim())}
            onClick={createCustomApi}
            className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            创建应用
          </button>
        </div>
      </Modal>

      {/* 自定义 API 应用设置 Drawer */}
      <SideDrawer open={capiTarget !== null} onClose={() => setCapiTarget(null)} width={480} title={`应用设置 · ${capiTarget?.name ?? ''}`}>
        {capiTarget && (
          <div className="flex flex-col gap-5">
            {/* OpenAPI 配置编辑 */}
            <div>
              <p className="text-body-sm font-semibold text-neutral-950">OpenAPI 配置</p>
              <input
                value={capiEditUrl}
                onChange={(e) => setCapiEditUrl(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 px-3 font-mono text-caption text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
              />
              <select
                value={capiEditAuth}
                onChange={(e) => setCapiEditAuth(e.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
              >
                {CUSTOM_API_AUTH_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!/^https?:\/\/.+/.test(capiEditUrl.trim())}
                onClick={saveCapiConfig}
                className="mt-2 h-9 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                保存配置
              </button>
            </div>

            {/* 密钥查看与重新生成 */}
            <div className="rounded-lg bg-surface-soft p-3.5">
              <p className="text-body-sm font-semibold text-neutral-950">应用密钥</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <code className="font-mono text-caption text-neutral-800">{capiTarget.maskedSecret}</code>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (await copyText(capiTarget.maskedSecret)) toast.success('密钥已复制（脱敏形式）')
                    }}
                    className="text-body-sm text-brand-600 hover:text-brand-500"
                  >
                    复制
                  </button>
                  <button
                    type="button"
                    onClick={() => setCapiRegenOpen(true)}
                    className="text-body-sm font-medium text-brand-600 hover:text-brand-500"
                  >
                    重新生成
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-caption text-neutral-400">完整密钥仅创建时展示一次；重新生成后旧密钥立即失效。</p>
            </div>

            {/* 调用统计 mock */}
            <div>
              <p className="mb-2 text-body-sm font-semibold text-neutral-950">调用统计（近 14 天）</p>
              <div className="h-40 rounded-lg border border-neutral-200 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={capiTarget.trend14d.map((v, i) => ({ day: `D${i + 1}`, calls: v }))} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#98A2B3' }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 11, fill: '#98A2B3' }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => [`${v} 次`, '调用量']} />
                    <Area type="monotone" dataKey="calls" stroke="#2F74FF" strokeWidth={2} fill="#2F74FF" fillOpacity={0.12} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1.5 text-caption text-neutral-400">
                累计 {capiTarget.trend14d.reduce((a, b) => a + b, 0).toLocaleString()} 次 · 峰值 {Math.max(...capiTarget.trend14d)} 次/日
              </p>
            </div>

            {/* 停用开关 */}
            <div className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2.5">
              <div>
                <p className="text-body-sm font-medium text-neutral-950">启用状态</p>
                <p className="mt-0.5 text-caption text-neutral-400">停用后该应用的调用将被拒绝（401）</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={capiTarget.status === '启用'}
                onClick={toggleCapiStatus}
                className={cn(
                  'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-comp ease-brand',
                  capiTarget.status === '启用' ? 'bg-brand-600' : 'bg-neutral-300',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-comp ease-brand',
                    capiTarget.status === '启用' ? 'translate-x-[22px]' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>
          </div>
        )}
      </SideDrawer>

      {/* L2 确认：重新生成应用密钥 */}
      <Modal open={capiRegenOpen} onClose={() => setCapiRegenOpen(false)} width={560}>
        {capiTarget && (
          <ConfirmationCard
            title="重新生成应用密钥"
            description={`「${capiTarget.name}」的旧密钥将立即失效`}
            fields={[
              { label: '动作', value: '重新生成自定义 API 应用密钥' },
              { label: '影响对象', value: `${capiTarget.name}（${capiTarget.openApiUrl}）` },
              { label: '外部影响', value: '使用旧密钥的业务系统调用将被拒绝，需同步更新后再验证' },
              { label: '可撤销性', value: '不可撤销，但可再次重新生成' },
            ]}
            confirmText="确认执行"
            onConfirm={regenCapiSecret}
            onModify={() => setCapiRegenOpen(false)}
            onCancel={() => setCapiRegenOpen(false)}
          />
        )}
      </Modal>

    </div>
  )
}
