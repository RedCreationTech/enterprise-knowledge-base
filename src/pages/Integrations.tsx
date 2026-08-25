/**
 * 集成管理 Integrations（W16，design/integrations.md）
 * 4 张 MetricCard + 已安装集成卡（2×2，选中联动配置面板）+ 四 Tab 配置
 * + 授权到期告警（重新授权 L2）+ 自动降级入口 + 渠道健康 + 跳应用中心；卸载 L4 确认。
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Bell,
  Blocks,
  ChevronRight,
  HeartPulse,
  MoreHorizontal,
  Puzzle,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/mocks'
import { ConfirmationCard, DemoEmptyState, MetricCard, ProgressBar, SectionCard } from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { Modal } from '@/pages/workspace/Modal'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { useAppToast } from '@/lib/toast'
import {
  channelAlert,
  channelHealth,
  DEPT_MEMBER_COUNT,
  DEPT_OPTIONS,
  defaultFallbackPolicy,
  FALLBACK_NOTIFY_OPTIONS,
  FALLBACK_THRESHOLD_OPTIONS,
  integrationConfig,
  integrationLogs,
  integrationMetrics,
  integrations,
  recommendApps,
  SCOPE_SPACE_OPTIONS,
  ssoLoginLogs,
} from '@/pages/workspace/integrationsData'
import type { Integration, LogLevel } from '@/pages/workspace/integrationsData'

const CONFIG_TABS = ['知识范围', '目标用户', '身份映射', '消息推送'] as const

const LOG_LEVELS: ('全部' | LogLevel)[] = ['全部', 'INFO', 'WARN', 'ERROR']

function Switch({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-comp ease-brand',
        on ? 'bg-brand-600' : 'bg-neutral-300',
        disabled && 'opacity-50',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-comp ease-brand',
          on ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

export default function Integrations() {
  const navigate = useNavigate()
  const toast = useAppToast()
  const { state, uninstallApp } = useAppStore()
  // 冷启动空态：未载入演示数据时展示引导空态（评审 P1-N1）
  const demoOff = state.demoData === false
  const [selectedId, setSelectedId] = useState('feishu-qa')
  const [activeTab, setActiveTab] = useState<(typeof CONFIG_TABS)[number]>('知识范围')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [confirmKind, setConfirmKind] = useState<'reauth' | null>(null)
  const [reauthLoading, setReauthLoading] = useState(false)
  const [authExpiry, setAuthExpiry] = useState('2024-06-15')
  const [authWarning, setAuthWarning] = useState(true)
  const [uninstallTarget, setUninstallTarget] = useState<Integration | null>(null)
  const [uninstallWord, setUninstallWord] = useState('')
  const [autoFallback, setAutoFallback] = useState(true)
  // 知识范围「修改范围 ›」真实勾选 Modal
  const [scopeSpaces, setScopeSpaces] = useState(integrationConfig.scopeSpaces)
  const [scopeModalOpen, setScopeModalOpen] = useState(false)
  const [scopeDraft, setScopeDraft] = useState<string[]>([])
  // 目标用户「调整 ›」部门选择器 Modal
  const [departments, setDepartments] = useState(integrationConfig.targetUsers.departments)
  const [deptModalOpen, setDeptModalOpen] = useState(false)
  const [deptDraft, setDeptDraft] = useState<string[]>([])
  // 日志 Drawer（channel=渠道运行日志 / sso=登录日志）
  const [logDrawer, setLogDrawer] = useState<'channel' | 'sso' | null>(null)
  const [logLevel, setLogLevel] = useState<'全部' | LogLevel>('全部')
  // 断开连接 / 重新连接
  const [disconnected, setDisconnected] = useState<string[]>([])
  const [disconnectTarget, setDisconnectTarget] = useState<Integration | null>(null)
  // 设置降级策略 Modal
  const [fallbackOpen, setFallbackOpen] = useState(false)
  const [fbThreshold, setFbThreshold] = useState<string>(defaultFallbackPolicy.threshold)
  const [fbNotify, setFbNotify] = useState<string[]>(defaultFallbackPolicy.notifyUsers)
  const [fbAutoRecover, setFbAutoRecover] = useState(defaultFallbackPolicy.autoRecover)
  const [pushSwitches, setPushSwitches] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(integrationConfig.push.map((p) => [p.key, p.on])),
  )
  const [mapped, setMapped] = useState(integrationConfig.mapping.mapped)
  const [unmapped, setUnmapped] = useState(integrationConfig.unmapped)
  const [channelDown, setChannelDown] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = integrations.find((i) => i.id === selectedId) ?? integrations[0]
  const visibleIntegrations = integrations.filter((i) => !state.journey.uninstalledApps.includes(i.id))
  /** 已安装集成计数：与 store.installedApps 同源（应用中心「已安装」口径一致） */
  const installedCount = integrations.filter((i) => state.journey.installedApps.includes(i.id)).length

  // 点击外部关闭 ⋯ 菜单
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const handleReauth = () => {
    setReauthLoading(true)
    setTimeout(() => {
      setReauthLoading(false)
      setConfirmKind(null)
      setAuthExpiry('2024-09-15')
      setAuthWarning(false)
      toast.success('授权已更新至 2024-09-15')
    }, 1200)
  }

  const handleResolveMapping = (name: string) => {
    setUnmapped((prev) => prev.filter((u) => u.name !== name))
    setMapped((m) => Math.min(integrationConfig.mapping.total, m + 1))
    toast.success(`已向 ${name} 发送绑定邀请，对方确认后自动完成映射`)
  }

  const mappedPct = Math.round((mapped / integrationConfig.mapping.total) * 100)

  /** 保存知识范围勾选（配置面板胶囊同步更新） */
  const saveScope = () => {
    if (scopeDraft.length === 0) return
    setScopeSpaces(SCOPE_SPACE_OPTIONS.filter((s) => scopeDraft.includes(s.name)))
    setScopeModalOpen(false)
    toast.success('知识范围已更新并保存')
  }

  /** 保存目标用户部门（人数按 DEPT_MEMBER_COUNT 汇总） */
  const saveDepartments = () => {
    if (deptDraft.length === 0) return
    setDepartments(deptDraft)
    setDeptModalOpen(false)
    toast.success('目标用户已更新并保存')
  }

  const deptCount = departments.reduce((a, d) => a + (DEPT_MEMBER_COUNT[d] ?? 0), 0)

  const openLogs = (kind: 'channel' | 'sso') => {
    setLogLevel('全部')
    setLogDrawer(kind)
  }

  const handleDisconnect = () => {
    if (!disconnectTarget) return
    setDisconnected((prev) => [...prev, disconnectTarget.id])
    toast.warning(`「${disconnectTarget.name}」已断开连接，渠道内问答入口暂停服务`)
    setDisconnectTarget(null)
  }

  const handleReconnect = (app: Integration) => {
    setDisconnected((prev) => prev.filter((id) => id !== app.id))
    toast.success(`「${app.name}」已重新连接，渠道恢复正常`)
  }

  const saveFallback = () => {
    setFallbackOpen(false)
    toast.success(`降级策略已保存：连续失败 ${fbThreshold} 触发降级，通知 ${fbNotify.length} 人${fbAutoRecover ? '，恢复后自动回切' : ''}`)
  }

  const drawerLogs = logDrawer === 'sso' ? ssoLoginLogs : integrationLogs
  const filteredLogs = logLevel === '全部' ? drawerLogs : drawerLogs.filter((l) => l.level === logLevel)

  // 冷启动空态：未载入演示数据时只显示页头 + 引导空态（评审 P1-N1）
  if (demoOff) {
    return (
      <div>
        <PageHeader
          crumbs={['应用与集成', '集成管理']}
          title="集成管理"
          subtitle="完成快速配置或载入演示数据后，这里会展示真实的企业知识数据"
        />
        <DemoEmptyState />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        crumbs={['应用与集成', '集成管理']}
        title="集成管理"
        subtitle={`${installedCount} 个集成 · ${integrationMetrics.normal} 个运行正常 · ${integrationMetrics.warning} 个需要关注 · 本周渠道使用 ${integrationMetrics.weeklyUsage} 次`}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/workspace/analytics')}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
            >
              渠道使用分析
            </button>
            <Link
              to="/workspace/apps"
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
            >
              安装新应用
              <ChevronRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      {/* 渠道异常通栏（mock 演示：降级恢复） */}
      {channelDown && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-bg px-4 py-3">
          <p className="flex items-center gap-2 text-body-sm text-neutral-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            企业微信消息推送失败 3 次，已进入自动降级
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => toast.info('失败原因：企微会话消息接口限流，已切换 Web 门户入口')}
              className="text-body-sm text-brand-600 hover:text-brand-500"
            >
              查看原因
            </button>
            <button
              type="button"
              onClick={() => {
                setChannelDown(false)
                toast.success('企业微信渠道已手动恢复，状态回绿')
              }}
              className="h-8 rounded-md bg-brand-600 px-3 text-body-sm font-medium text-white hover:bg-brand-500"
            >
              手动恢复
            </button>
          </div>
        </div>
      )}

      {/* Row 1：渠道运行概览 */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { icon: <Puzzle className="h-4 w-4" />, name: '已安装集成', value: installedCount, suffix: '个', hint: `${integrationMetrics.normal} 正常 · ${integrationMetrics.warning} 告警` },
          { icon: <Send className="h-4 w-4" />, name: '本周渠道使用', value: integrationMetrics.weeklyUsage, suffix: '次', hint: integrationMetrics.usageSplit },
          { icon: <Users className="h-4 w-4" />, name: '渠道可访问人数', value: integrationMetrics.reachable, suffix: '人', hint: '覆盖 12 名成员的 3 个渠道' },
          { icon: <AlertTriangle className="h-4 w-4" />, name: '渠道告警', value: authWarning ? integrationMetrics.alerts : 0, suffix: '条', hint: authWarning ? '飞书授权 16 天后到期' : '暂无待处理告警' },
        ].map((m, i) => (
          <motion.div
            key={m.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: i * 0.07, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <MetricCard icon={m.icon} name={m.name} value={m.value} suffix={m.suffix} hint={m.hint} />
          </motion.div>
        ))}
      </div>

      {/* Row 2：左 8（集成卡 + 配置面板）｜ 右 4（运行状态侧栏） */}
      <div className="mt-4 grid grid-cols-12 gap-4">
        <div className="col-span-12 flex flex-col gap-4 xl:col-span-8">
          {/* 已安装集成卡片 2×2 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visibleIntegrations.map((app, i) => {
              const active = app.id === selectedId
              const isWarningCard = app.id === 'feishu-qa' && authWarning
              const isDisconnected = disconnected.includes(app.id)
              return (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: 0.12 + i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
                  onClick={() => setSelectedId(app.id)}
                  className={cn(
                    'relative cursor-pointer rounded-xl border bg-white p-5 shadow-card transition-all duration-comp ease-brand hover:shadow-float',
                    active ? 'border-[1.5px] border-brand-500 bg-surface-cardSel' : 'border-neutral-200',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <img src={app.logo} alt="" className="h-10 w-10 rounded-md" />
                      <div>
                        <h3 className="text-h3 text-neutral-950">{app.name}</h3>
                        <p className="mt-0.5 text-caption text-neutral-400">{app.vendor}</p>
                      </div>
                    </div>
                    <div className="relative" ref={menuOpenId === app.id ? menuRef : undefined}>
                      <button
                        type="button"
                        aria-label="更多操作"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenId(menuOpenId === app.id ? null : app.id)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuOpenId === app.id && (
                        <div className="absolute right-0 top-8 z-20 w-32 rounded-lg border border-neutral-200 bg-white py-1 shadow-float">
                          {disconnected.includes(app.id) ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setMenuOpenId(null)
                                handleReconnect(app)
                              }}
                              className="w-full px-3 py-2 text-left text-body-sm text-brand-600 hover:bg-brand-50"
                            >
                              重新连接
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setMenuOpenId(null)
                                setDisconnectTarget(app)
                              }}
                              className="w-full px-3 py-2 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
                            >
                              断开连接
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setMenuOpenId(null)
                              setUninstallTarget(app)
                              setUninstallWord('')
                            }}
                            className="w-full px-3 py-2 text-left text-body-sm text-danger hover:bg-danger-bg"
                          >
                            卸载集成
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <span
                      className={cn(
                        'inline-flex h-6 items-center gap-1 rounded-pill px-2 text-caption font-medium',
                        isDisconnected ? 'bg-neutral-100 text-neutral-500' : isWarningCard ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success',
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {isDisconnected ? '已断开' : app.id === 'feishu-qa' ? (authWarning ? app.badge : '运行中') : app.badge}
                    </span>
                  </div>
                  <dl className="mt-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-body-sm">
                      <dt className="text-neutral-400">渠道状态</dt>
                      <dd className="flex items-center gap-1.5 text-neutral-800">
                        <span className={cn('h-1.5 w-1.5 rounded-full', isDisconnected ? 'bg-neutral-300' : channelDown && app.id === 'wecom-qa' ? 'bg-warning' : 'bg-success')} />
                        {isDisconnected ? '已断开' : channelDown && app.id === 'wecom-qa' ? '异常（已降级）' : app.channelStatus}
                      </dd>
                    </div>
                    {app.meta.map((m) => (
                      <div key={m.label} className="flex items-center justify-between text-body-sm">
                        <dt className="text-neutral-400">{m.label}</dt>
                        <dd className="text-neutral-800">{m.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-3.5 flex items-center gap-3 border-t border-neutral-100 pt-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedId(app.id)
                      }}
                      className={cn(
                        'h-8 rounded-md border px-3 text-body-sm transition-colors duration-micro ease-brand',
                        active
                          ? 'border-brand-500 text-brand-600'
                          : 'border-neutral-200 text-neutral-800 hover:border-brand-300 hover:text-brand-600',
                      )}
                    >
                      配置
                    </button>
                    {isDisconnected ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReconnect(app)
                        }}
                        className="text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
                      >
                        重新连接
                      </button>
                    ) : (
                      app.actions
                        .filter((a) => a.kind === 'tertiary')
                        .map((a) => (
                          <button
                            key={a.label}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (a.to) navigate(a.to)
                              else if (a.label === '重新授权') setConfirmKind('reauth')
                              else if (a.label === '查看登录日志') openLogs('sso')
                              else openLogs('channel')
                            }}
                            className="text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
                          >
                            {a.label}
                          </button>
                        ))
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* 配置面板（选中联动，以飞书问答插件为例） */}
          <SectionCard title={`集成配置 · ${selected.name}`} icon={<Blocks className="h-5 w-5" />}>
            <div className="mb-4 flex gap-1 border-b border-neutral-100">
              {CONFIG_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTab(t)}
                  className={cn(
                    'relative h-10 px-4 text-body-sm transition-colors duration-micro ease-brand',
                    activeTab === t ? 'font-semibold text-brand-600' : 'text-neutral-500 hover:text-neutral-800',
                  )}
                >
                  {t}
                  {t === '身份映射' && unmapped.length > 0 && (
                    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-warning px-1 text-[10px] font-semibold text-white">
                      {unmapped.length}
                    </span>
                  )}
                  {activeTab === t && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-600" />}
                </button>
              ))}
            </div>

            {activeTab === '知识范围' && (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {scopeSpaces.map((s) => (
                    <span key={s.name} className="rounded-pill bg-brand-50 px-3 py-1.5 text-body-sm font-medium text-brand-700">
                      {s.name} · {s.docs} 份
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setScopeDraft(scopeSpaces.map((s) => s.name))
                      setScopeModalOpen(true)
                    }}
                    className="text-body-sm font-medium text-brand-600 hover:text-brand-500"
                  >
                    修改范围 ›
                  </button>
                </div>
                <p className="mt-3 text-caption text-neutral-400">
                  已选 {scopeSpaces.length} 个空间，共 {scopeSpaces.reduce((a, s) => a + s.docs, 0)} 份文档；渠道内仅能引用范围内的知识。
                </p>
              </div>
            )}

            {activeTab === '目标用户' && (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body-sm text-neutral-500">可见部门：</span>
                  {departments.map((d) => (
                    <span key={d} className="rounded-pill bg-neutral-100 px-3 py-1.5 text-body-sm text-neutral-700">
                      {d}
                    </span>
                  ))}
                  <span className="text-body-sm text-neutral-500">（{deptCount} 人）</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDeptDraft(departments)
                      setDeptModalOpen(true)
                    }}
                    className="text-body-sm font-medium text-brand-600 hover:text-brand-500"
                  >
                    调整 ›
                  </button>
                </div>
                <p className="mt-3 text-caption text-neutral-400">无权限成员不会收到受限内容。</p>
              </div>
            )}

            {activeTab === '身份映射' && (
              <div>
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-body-sm text-neutral-700">
                    映射覆盖率 <span className="font-semibold text-neutral-950">{mapped}/{integrationConfig.mapping.total}</span>
                  </span>
                  <ProgressBar value={mappedPct} className="flex-1" barClassName={mappedPct < 100 ? 'bg-warning' : undefined} />
                  <span className="shrink-0 text-caption text-neutral-400">{mappedPct}%</span>
                </div>
                {unmapped.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {unmapped.map((u) => (
                      <div key={u.name} className="flex items-center justify-between gap-3 rounded-lg bg-warning-bg px-3.5 py-2.5">
                        <p className="text-body-sm text-neutral-800">
                          <span className="font-medium">{u.name}</span>
                          <span className="text-neutral-500"> · {u.reason}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => handleResolveMapping(u.name)}
                          className="shrink-0 text-body-sm font-medium text-brand-600 hover:text-brand-500"
                        >
                          去处理
                        </button>
                      </div>
                    ))}
                    <p className="text-caption text-neutral-400">
                      未映射成员在对应渠道内将以访客身份获得裁剪后的答案；也可到
                      <Link to="/workspace/permissions" className="mx-1 text-brand-600 hover:text-brand-500">权限管理 · 身份映射</Link>
                      统一处理。
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg bg-success-bg px-3.5 py-2.5 text-body-sm text-success">全部成员均已完成身份映射（{mapped}/{integrationConfig.mapping.total}）。</p>
                )}
              </div>
            )}

            {activeTab === '消息推送' && (
              <ul className="flex flex-col divide-y divide-neutral-100">
                {integrationConfig.push.map((p) => (
                  <li key={p.key} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-body-sm font-medium text-neutral-950">{p.label}</p>
                      <p className="mt-0.5 text-caption text-neutral-400">{p.note}</p>
                    </div>
                    <Switch
                      on={pushSwitches[p.key]}
                      onChange={() => {
                        const next = !pushSwitches[p.key]
                        setPushSwitches((prev) => ({ ...prev, [p.key]: next }))
                        toast.success(`「${p.label}」已${next ? '开启' : '关闭'}`)
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* 右 4：运行状态与告警侧栏 */}
        <div className="col-span-12 flex flex-col gap-4 xl:col-span-4">
          {/* 告警卡 */}
          {authWarning && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
              className="rounded-xl border border-warning/40 bg-warning-bg p-5 shadow-card"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <h3 className="text-body font-semibold text-neutral-950">{channelAlert.title}</h3>
                  <p className="mt-1 text-body-sm text-neutral-700">{channelAlert.desc}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmKind('reauth')}
                  className="h-9 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
                >
                  立即重新授权
                </button>
                <button
                  type="button"
                  onClick={() => setFallbackOpen(true)}
                  className="text-body-sm text-brand-600 hover:text-brand-500"
                >
                  设置降级策略
                </button>
              </div>
            </motion.div>
          )}

          {/* 降级入口卡 */}
          <SectionCard title="渠道异常自动降级" icon={<ShieldCheck className="h-5 w-5" />}>
            <ol className="flex flex-col gap-1.5 text-body-sm text-neutral-700">
              <li>① 优先切换 Web 门户入口</li>
              <li>② 推送降级通知给管理员</li>
              <li>③ 恢复后自动回切</li>
            </ol>
            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
              <span className="text-body-sm text-neutral-800">启用自动降级</span>
              <Switch on={autoFallback} onChange={() => setAutoFallback((v) => !v)} />
            </div>
            <button
              type="button"
              onClick={() => setChannelDown(true)}
              className="mt-2 text-caption text-neutral-400 underline decoration-dotted hover:text-neutral-600"
            >
              模拟一次渠道异常（演示）
            </button>
          </SectionCard>

          {/* 渠道健康卡 */}
          <SectionCard
            title="渠道健康"
            icon={<HeartPulse className="h-5 w-5" />}
            actions={
              <button type="button" onClick={() => openLogs('channel')} className="text-body-sm text-brand-600 hover:text-brand-500">
                查看完整日志 ›
              </button>
            }
          >
            <p className="-mt-1 mb-3 text-caption text-neutral-400">近 7 天各渠道可用率</p>
            <ul className="flex flex-col gap-3">
              {channelHealth.map((c) => (
                <li key={c.name} className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-body-sm text-neutral-700">{c.name}</span>
                  <ProgressBar value={c.rate} className="flex-1" />
                  <span className="w-12 shrink-0 text-right text-body-sm font-medium text-neutral-950">{c.rate}%</span>
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* 应用中心推荐卡 */}
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand-600" />
              <h3 className="text-body font-semibold text-neutral-950">还有 {recommendApps.length} 个应用可试用</h3>
            </div>
            <p className="mt-2 text-body-sm text-neutral-700">{recommendApps.join('、')}</p>
            <Link to="/workspace/apps" className="mt-3 inline-block text-body-sm font-medium text-brand-600 hover:text-brand-500">
              去应用中心看看 →
            </Link>
          </div>
        </div>
      </div>

      {/* L2 确认卡：重新授权 / 修改知识范围 */}
      <Modal open={confirmKind !== null} onClose={() => !reauthLoading && setConfirmKind(null)} width={560}>
        {confirmKind === 'reauth' && (
          <ConfirmationCard
            title="重新授权飞书问答插件"
            description={`当前授权有效期至 ${authExpiry}`}
            fields={[
              { label: '动作', value: '跳转飞书开放平台重新授权' },
              { label: '影响对象', value: '飞书问答插件 · 96 名可访问成员' },
              { label: '影响范围', value: '授权期间渠道问答服务不中断' },
              { label: '可撤销性', value: '可随时在飞书后台撤销授权' },
            ]}
            confirmText={reauthLoading ? '正在跳转飞书授权…' : '确认执行'}
            loading={reauthLoading}
            onConfirm={handleReauth}
            onModify={() => setConfirmKind(null)}
            onCancel={() => setConfirmKind(null)}
          />
        )}
      </Modal>

      {/* 修改知识范围：真实空间勾选 Modal */}
      <Modal open={scopeModalOpen} onClose={() => setScopeModalOpen(false)} title={`修改知识范围 · ${selected.name}`} description="勾选渠道内可引用的知识空间，保存后立即生效" width={520}>
        <div className="flex flex-col gap-2">
          {SCOPE_SPACE_OPTIONS.map((s) => {
            const on = scopeDraft.includes(s.name)
            return (
              <label
                key={s.name}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-body-sm transition-colors duration-micro ease-brand',
                  on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setScopeDraft((prev) => (on ? prev.filter((x) => x !== s.name) : [...prev, s.name]))}
                  className="h-4 w-4 accent-brand-600"
                />
                <span className="flex-1">{s.name}</span>
                <span className="text-caption text-neutral-400">{s.docs} 份文档</span>
              </label>
            )
          })}
        </div>
        {scopeDraft.length === 0 && <p className="mt-2 text-caption text-danger">至少保留 1 个知识空间</p>}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-caption text-neutral-400">
            已选 {scopeDraft.length} 个空间 · 共 {SCOPE_SPACE_OPTIONS.filter((s) => scopeDraft.includes(s.name)).reduce((a, s) => a + s.docs, 0)} 份文档
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setScopeModalOpen(false)} className="h-10 rounded-md px-4 text-body-sm text-neutral-500 hover:bg-neutral-100">
              取消
            </button>
            <button
              type="button"
              disabled={scopeDraft.length === 0}
              onClick={saveScope}
              className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              保存范围
            </button>
          </div>
        </div>
      </Modal>

      {/* 调整目标用户：部门选择器 Modal */}
      <Modal open={deptModalOpen} onClose={() => setDeptModalOpen(false)} title={`调整目标用户 · ${selected.name}`} description="勾选可使用该渠道的部门，无权限成员不会收到受限内容" width={520}>
        <div className="flex flex-col gap-3">
          {DEPT_OPTIONS.map((g) => (
            <div key={g.group}>
              <p className="mb-1.5 text-caption font-medium text-neutral-400">{g.group}</p>
              <div className="grid grid-cols-2 gap-2">
                {g.depts.map((d) => {
                  const on = deptDraft.includes(d)
                  return (
                    <label
                      key={d}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-body-sm transition-colors duration-micro ease-brand',
                        on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setDeptDraft((prev) => (on ? prev.filter((x) => x !== d) : [...prev, d]))}
                        className="h-4 w-4 accent-brand-600"
                      />
                      <span className="flex-1">{d}</span>
                      <span className="text-caption text-neutral-400">{DEPT_MEMBER_COUNT[d]} 人</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {deptDraft.length === 0 && <p className="mt-2 text-caption text-danger">至少保留 1 个部门</p>}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-caption text-neutral-400">
            已选 {deptDraft.length} 个部门 · 共 {deptDraft.reduce((a, d) => a + (DEPT_MEMBER_COUNT[d] ?? 0), 0)} 人
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDeptModalOpen(false)} className="h-10 rounded-md px-4 text-body-sm text-neutral-500 hover:bg-neutral-100">
              取消
            </button>
            <button
              type="button"
              disabled={deptDraft.length === 0}
              onClick={saveDepartments}
              className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              保存
            </button>
          </div>
        </div>
      </Modal>

      {/* L2 确认：断开连接 */}
      <Modal open={disconnectTarget !== null} onClose={() => setDisconnectTarget(null)} width={560}>
        {disconnectTarget && (
          <ConfirmationCard
            title={`断开「${disconnectTarget.name}」连接`}
            description="断开后渠道内问答入口将暂停服务，配置与审计记录保留"
            fields={[
              { label: '动作', value: `断开与 ${disconnectTarget.vendor} 的渠道连接` },
              { label: '影响对象', value: `${disconnectTarget.name} · ${disconnectTarget.usage}` },
              { label: '影响范围', value: '渠道内成员暂时无法发起新问答，历史记录仍可查看' },
              { label: '可撤销性', value: '可随时通过「重新连接」恢复，无需重新授权' },
            ]}
            confirmText="确认断开"
            onConfirm={handleDisconnect}
            onModify={() => setDisconnectTarget(null)}
            onCancel={() => setDisconnectTarget(null)}
          />
        )}
      </Modal>

      {/* 设置降级策略 Modal */}
      <Modal open={fallbackOpen} onClose={() => setFallbackOpen(false)} title="设置降级策略" description="渠道异常时自动切换 Web 门户入口并通知管理员" width={520}>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">异常阈值</p>
            <p className="mt-0.5 text-caption text-neutral-400">连续推送失败达到阈值后自动进入降级</p>
            <div className="mt-2 flex gap-2">
              {FALLBACK_THRESHOLD_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFbThreshold(t)}
                  className={cn(
                    'h-9 rounded-md border px-4 text-body-sm transition-colors duration-micro ease-brand',
                    fbThreshold === t ? 'border-[1.5px] border-brand-500 bg-surface-cardSel font-medium text-brand-700' : 'border-neutral-200 text-neutral-700 hover:border-brand-300',
                  )}
                >
                  连续失败 {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">通知人</p>
            <div className="mt-2 flex flex-col gap-2">
              {FALLBACK_NOTIFY_OPTIONS.map((n) => {
                const on = fbNotify.includes(n)
                return (
                  <label
                    key={n}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-body-sm transition-colors duration-micro ease-brand',
                      on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setFbNotify((prev) => (on ? prev.filter((x) => x !== n) : [...prev, n]))}
                      className="h-4 w-4 accent-brand-600"
                    />
                    {n}
                  </label>
                )
              })}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2.5">
            <div>
              <p className="text-body-sm font-medium text-neutral-950">恢复后自动回切</p>
              <p className="mt-0.5 text-caption text-neutral-400">渠道恢复正常后自动切回原渠道</p>
            </div>
            <Switch on={fbAutoRecover} onChange={() => setFbAutoRecover((v) => !v)} />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={() => setFallbackOpen(false)} className="h-10 rounded-md px-4 text-body-sm text-neutral-500 hover:bg-neutral-100">
            取消
          </button>
          <button
            type="button"
            disabled={fbNotify.length === 0}
            onClick={saveFallback}
            className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            保存策略
          </button>
        </div>
      </Modal>

      {/* 日志 Drawer：时间 / 级别 / 内容 + 级别筛选 */}
      <SideDrawer
        open={logDrawer !== null}
        onClose={() => setLogDrawer(null)}
        width={520}
        title={logDrawer === 'sso' ? '登录日志 · 单点登录 SSO' : '渠道运行日志'}
      >
        <div className="mb-3 flex gap-2">
          {LOG_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLogLevel(l)}
              className={cn(
                'h-8 rounded-pill px-3.5 text-body-sm transition-colors duration-comp ease-brand',
                logLevel === l ? 'bg-brand-600 font-medium text-white' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100',
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {filteredLogs.map((l, i) => (
            <li key={i} className="flex items-start gap-3 px-3.5 py-2.5">
              <span className="w-[86px] shrink-0 pt-0.5 text-caption text-neutral-400">{l.time}</span>
              <span
                className={cn(
                  'mt-0.5 inline-flex h-5 w-12 shrink-0 items-center justify-center rounded-sm text-[10px] font-semibold',
                  l.level === 'ERROR' ? 'bg-danger-bg text-danger' : l.level === 'WARN' ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success',
                )}
              >
                {l.level}
              </span>
              <span className="min-w-0 flex-1 text-body-sm text-neutral-800">{l.content}</span>
            </li>
          ))}
          {filteredLogs.length === 0 && <li className="px-3.5 py-6 text-center text-body-sm text-neutral-400">当前级别暂无日志</li>}
        </ul>
        <p className="mt-3 text-caption text-neutral-400">日志保留 30 天，支持导出审计记录。</p>
      </SideDrawer>

      {/* L4 卸载确认：输入确认词「卸载」 */}
      <Modal open={uninstallTarget !== null} onClose={() => setUninstallTarget(null)} title={`卸载「${uninstallTarget?.name}」`} width={480}>
        {uninstallTarget && (
          <div>
            <p className="text-body text-neutral-700">
              卸载后将<span className="font-medium text-danger">停止渠道访问</span>、保留审计记录、清理缓存与令牌。此操作不可撤销。
            </p>
            <p className="mt-3 text-body-sm text-neutral-500">
              请输入「<span className="font-semibold text-neutral-950">卸载</span>」以确认：
            </p>
            <input
              value={uninstallWord}
              onChange={(e) => setUninstallWord(e.target.value)}
              placeholder="卸载"
              className="mt-2 h-10 w-full rounded-md border border-neutral-200 px-3 text-body text-neutral-800 focus:border-danger focus:outline-none"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUninstallTarget(null)}
                className="h-10 rounded-md px-4 text-body-sm text-neutral-500 hover:bg-neutral-100"
              >
                取消
              </button>
              <button
                type="button"
                disabled={uninstallWord !== '卸载'}
                onClick={() => {
                  // 单源：从 store.installedApps 移除并记入 uninstalledApps（persist 到 ekb-store-v1，刷新不丢）
                  uninstallApp(uninstallTarget.id)
                  setUninstallTarget(null)
                  toast.warning(`「${uninstallTarget.name}」已卸载，审计记录已保留`)
                }}
                className="h-10 rounded-md bg-danger px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:opacity-90 disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                确认卸载
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  )
}
