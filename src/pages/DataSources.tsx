/**
 * 数据来源 DataSources（/workspace/data-sources，data-sources.md）
 * Row1 4 张 MetricCard；左 8 列：连接器卡（2×2）+ 同步任务列表（失败可重试）；
 * 右 4 列：同步健康侧栏（ACL 覆盖 / 增量同步 / 飞书授权到期告警）。
 * 主 CTA「+ 新增数据来源」两步向导 Modal（URL/Sitemap/RSS/数据库同步/第三方知识库/API）。
 */
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookLock,
  ChevronDown,
  FileCode2,
  Globe,
  HardDrive,
  Link2,
  Network,
  Plug,
  RotateCcw,
  Rss,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router'
import { DemoEmptyState, ConfirmationCard, MetricCard, ProgressBar, StatusBadge } from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { Modal } from '@/pages/workspace/Modal'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { useAppToast } from '@/lib/toast'
import { METRICS, useAppStore } from '@/mocks'
import {
  ALL_SYNC_LOGS,
  CONNECTORS,
  CRAWL_DEPTH_OPTIONS,
  SOURCE_TYPES,
  SYNC_HEALTH,
  SYNC_TASKS,
  connectorLogs,
  taskLogsFor,
} from '@/pages/workspace/sourcesData'
import type { ConnectorItem, SourceTypeOption, SyncLogEntry, SyncTask } from '@/pages/workspace/sourcesData'

const BTN_PRIMARY =
  'inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400'
const BTN_SECONDARY =
  'inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600'
const BTN_TERTIARY =
  'inline-flex h-8 items-center gap-1 rounded-md px-2 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50'

const TYPE_ICONS: Record<string, LucideIcon> = {
  url: Globe,
  sitemap: Network,
  rss: Rss,
  'oauth-db': BookLock,
  'oauth-kb': FileCode2,
  api: Link2,
}

function connectorLogo(c: ConnectorItem) {
  if (c.id === 'feishu') return <img src="/logo-feishu.svg" alt="" className="h-10 w-10 rounded-lg" />
  if (c.id === 'dingtalk') return <img src="/logo-dingtalk.svg" alt="" className="h-10 w-10 rounded-lg" />
  if (c.id === 'wecom') return <img src="/logo-wecom.svg" alt="" className="h-10 w-10 rounded-lg" />
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
      <HardDrive className="h-5 w-5" />
    </span>
  )
}

function switchCls(on: boolean) {
  return cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-comp ease-brand', on ? 'bg-brand-600' : 'bg-neutral-300')
}

const LOG_LEVEL_CLS: Record<SyncLogEntry['level'], string> = {
  信息: 'bg-info-bg text-info',
  警告: 'bg-warning-bg text-warning',
  错误: 'bg-danger-bg text-danger',
}

/** 日志列表（连接器日志 / 任务日志 / 全部日志 Drawer 复用） */
function LogList({ logs }: { logs: SyncLogEntry[] }) {
  return (
    <ul className="flex flex-col divide-y divide-neutral-100">
      {logs.map((l, i) => (
        <li key={`${l.time}-${i}`} className="py-3">
          <div className="flex items-center justify-between gap-2">
            <span className={cn('rounded-sm px-1.5 py-0.5 text-caption font-medium', LOG_LEVEL_CLS[l.level])}>{l.level}</span>
            <span className="shrink-0 text-caption text-neutral-400">{l.time}</span>
          </div>
          <p className="mt-1.5 text-body-sm text-neutral-800">{l.message}</p>
        </li>
      ))}
    </ul>
  )
}

const URL_RE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/i

const FULL_CHECK_CYCLES = ['每日 02:00', '每周日 02:00', '每月 1 日 02:00']
const CONCURRENCY_OPTIONS = ['2 个任务', '4 个任务', '8 个任务']
const CONN_FREQUENCY_OPTIONS = ['每 15 分钟', '每小时', '每天 02:00']
const CONN_SCOPE_OPTIONS = ['全部已授权目录', '仅指定目录 / 空间']
const CONN_RETRY_OPTIONS = ['1 次', '3 次', '5 次']

export default function DataSources() {
  const toast = useAppToast()
  const navigate = useNavigate()
  const { state } = useAppStore()
  // 冷启动空态：未载入演示数据时展示引导空态（评审 P1-N1）
  const demoOff = state.demoData === false
  const [connectors, setConnectors] = useState<ConnectorItem[]>(CONNECTORS)
  const [tasks, setTasks] = useState<SyncTask[]>(SYNC_TASKS)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [expandedFail, setExpandedFail] = useState<string | null>(null)
  const [reauthTarget, setReauthTarget] = useState<string | null>(null)
  const [reauthLoading, setReauthLoading] = useState(false)
  const [switchOffTarget, setSwitchOffTarget] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardNotice, setWizardNotice] = useState<string | null>(null)
  const [srcType, setSrcType] = useState<SourceTypeOption | null>(null)
  const [srcUrl, setSrcUrl] = useState('')
  const [srcDepth, setSrcDepth] = useState(CRAWL_DEPTH_OPTIONS[1])
  const [oauthDone, setOauthDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 页级同步设置（全量校验周期 / 并发上限 / 失败通知）
  const [syncSettings, setSyncSettings] = useState({ cycle: FULL_CHECK_CYCLES[1], concurrency: CONCURRENCY_OPTIONS[1], notifyFail: true })
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false)
  const [draftCycle, setDraftCycle] = useState(syncSettings.cycle)
  const [draftConcurrency, setDraftConcurrency] = useState(syncSettings.concurrency)
  const [draftNotify, setDraftNotify] = useState(syncSettings.notifyFail)

  // 连接器级同步设置 / 日志 / 停用 / 删除
  const [connSettingsMap, setConnSettingsMap] = useState<Record<string, { frequency: string; scope: string; retry: string }>>({})
  const [connSettingsId, setConnSettingsId] = useState<string | null>(null)
  const [connDraft, setConnDraft] = useState({ frequency: CONN_FREQUENCY_OPTIONS[0], scope: CONN_SCOPE_OPTIONS[0], retry: CONN_RETRY_OPTIONS[1] })
  const [logsId, setLogsId] = useState<string | null>(null)
  const [disableTarget, setDisableTarget] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // 任务详情 / 全部日志
  const [detailTask, setDetailTask] = useState<SyncTask | null>(null)
  const [allLogsOpen, setAllLogsOpen] = useState(false)

  const failedCount = tasks.filter((t) => t.status === '失败').length
  const [retrySuccesses, setRetrySuccesses] = useState(0)
  const successToday = 3 + retrySuccesses
  const feishu = connectors.find((c) => c.id === 'feishu')
  const feishuExpiring = !!feishu?.authExpireNote
  const connectedCount = connectors.filter((c) => c.connected).length
  const incrementalOn = connectors.filter((c) => c.connected && c.incremental && !c.disabled).length

  const isCrawl = srcType?.kind === 'crawl'
  const urlValid = !isCrawl || URL_RE.test(srcUrl.trim())
  const canSubmit =
    !!srcType &&
    !submitting &&
    (srcType.kind === 'api' ? false : srcType.kind === 'oauth' ? oauthDone : URL_RE.test(srcUrl.trim()))

  const resetWizard = () => {
    setWizardStep(1)
    setSrcType(null)
    setSrcUrl('')
    setSrcDepth(CRAWL_DEPTH_OPTIONS[1])
    setOauthDone(false)
    setSubmitting(false)
    setWizardNotice(null)
  }

  const openWizard = (notice?: string) => {
    resetWizard()
    setWizardNotice(notice ?? null)
    setWizardOpen(true)
  }

  const retryTask = (task: SyncTask) => {
    if (retryingId) return
    setRetryingId(task.id)
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: '进行中' } : t)))
    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: '已完成', docs: '已补传 3 份', duration: '58 秒', failReason: undefined } : t,
        ),
      )
      setRetryingId(null)
      setRetrySuccesses((n) => n + 1)
      toast.success('重试成功：飞书文档全量校验已完成，3 份文档已处理')
    }, 3000)
  }

  const confirmReauth = () => {
    if (!reauthTarget) return
    const name = connectors.find((c) => c.id === reauthTarget)?.name ?? '飞书文档'
    setReauthLoading(true)
    setTimeout(() => {
      setConnectors((prev) =>
        prev.map((c) =>
          c.id === 'feishu' ? { ...c, authValidUntil: '2024-09-13', authExpireNote: undefined } : c,
        ),
      )
      setReauthLoading(false)
      setReauthTarget(null)
      toast.success(reauthTarget === 'feishu' ? '飞书文档已重新授权，有效期顺延至 2024-09-13' : `${name}已重新授权`)
    }, 900)
  }

  const toggleIncremental = (id: string) => {
    const c = connectors.find((x) => x.id === id)
    if (!c) return
    if (c.incremental) {
      setSwitchOffTarget(id)
    } else {
      setConnectors((prev) => prev.map((x) => (x.id === id ? { ...x, incremental: true } : x)))
      toast.success('已开启增量同步')
    }
  }

  const submitWizard = () => {
    if (!srcType || !canSubmit) return
    setSubmitting(true)
    setTimeout(() => {
      const uid = `w-${Date.now()}`
      if (srcType.kind === 'oauth') {
        // OAuth 来源：连接器列表真实新增卡片 + 首次同步任务
        setConnectors((prev) => [
          ...prev,
          {
            id: `custom-${uid}`,
            name: srcType.label,
            connected: true,
            syncStatus: 'idle',
            desc: srcType.desc,
            docs: 0,
            lastSyncAt: '刚刚',
            aclCoverage: 100,
            incremental: true,
          },
        ])
        setTasks((prev) => [
          { id: `t-${uid}`, source: srcType.label, type: '首次同步', status: '进行中', docs: '—', startedAt: '刚刚', duration: '—' },
          ...prev,
        ])
      } else {
        // 抓取来源：任务列表真实新增进行中任务（含提交的配置）
        const host = srcUrl.trim().replace(/^https?:\/\//i, '').split('/')[0]
        setTasks((prev) => [
          {
            id: `t-${uid}`,
            source: host || srcType.label,
            type: `${srcType.label} · ${srcDepth}`,
            status: '进行中',
            docs: '—',
            startedAt: '刚刚',
            duration: '—',
          },
          ...prev,
        ])
      }
      setSubmitting(false)
      setWizardOpen(false)
      toast.success(srcType.kind === 'oauth' ? `${srcType.label} 已连接，首次同步任务已加入队列` : '地址验证通过，抓取任务已开始')
      resetWizard()
    }, 1800)
  }

  const openPageSettings = () => {
    setDraftCycle(syncSettings.cycle)
    setDraftConcurrency(syncSettings.concurrency)
    setDraftNotify(syncSettings.notifyFail)
    setPageSettingsOpen(true)
  }

  const openConnSettings = (id: string) => {
    setConnDraft(connSettingsMap[id] ?? { frequency: CONN_FREQUENCY_OPTIONS[0], scope: CONN_SCOPE_OPTIONS[0], retry: CONN_RETRY_OPTIONS[1] })
    setConnSettingsId(id)
  }

  const confirmDisable = () => {
    const c = connectors.find((x) => x.id === disableTarget)
    if (!c) return
    setConnectors((prev) => prev.map((x) => (x.id === disableTarget ? { ...x, disabled: true, syncStatus: 'idle' } : x)))
    setDisableTarget(null)
    toast.success(`「${c.name}」已停用，同步任务已暂停，授权与配置保留`)
  }

  const enableConnector = (id: string) => {
    const c = connectors.find((x) => x.id === id)
    if (!c) return
    setConnectors((prev) => prev.map((x) => (x.id === id ? { ...x, disabled: false } : x)))
    toast.success(`「${c.name}」已启用，将在下个同步周期恢复`)
  }

  const confirmDelete = () => {
    const c = connectors.find((x) => x.id === deleteTarget)
    if (!c) return
    setConnectors((prev) => prev.filter((x) => x.id !== deleteTarget))
    setDeleteTarget(null)
    toast.success(`「${c.name}」已删除，其文档将在 7 天内从索引中清除`)
  }

  const connectorCards = useMemo(() => connectors, [connectors])

  // 冷启动空态：未载入演示数据时只显示页头 + 引导空态（评审 P1-N1）
  if (demoOff) {
    return (
      <div>
        <PageHeader
          crumbs={['知识', '数据来源']}
          title="数据来源"
          subtitle="完成快速配置或载入演示数据后，这里会展示真实的企业知识数据"
        />
        <DemoEmptyState />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        crumbs={['知识', '数据来源']}
        title="数据来源"
        subtitle={`${connectedCount} 个连接器已接入 · 连接器文档共 ${METRICS.connectedDocs.total.toLocaleString('en-US')} 份 · 本地上传 ${METRICS.connectedDocs.localUpload} 份 · 最近同步 今天 10:20`}
        actions={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={openPageSettings}>
              同步设置
            </button>
            <button type="button" className={BTN_PRIMARY} onClick={() => openWizard()}>
              <Plug className="h-4 w-4" />
              新增数据来源
            </button>
          </>
        }
      />

      {/* Row1 指标 */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard icon={<Plug className="h-4 w-4" />} name="已连接来源" value={`${connectedCount} / 4`} hint="企业网盘 · 飞书文档" />
        <MetricCard icon={<HardDrive className="h-4 w-4" />} name="连接器文档" value={METRICS.connectedDocs.total} suffix="份" hint={`网盘 ${METRICS.connectedDocs.netdisk} + 飞书 ${METRICS.connectedDocs.feishu} + 本地上传 ${METRICS.connectedDocs.localUpload}`} />
        <MetricCard
          icon={<RotateCcw className="h-4 w-4" />}
          name="今日同步"
          value={`${successToday} 次成功`}
          hint={failedCount > 0 ? `${failedCount} 次失败待重试` : '今日同步全部成功'}
        />
        <MetricCard icon={<ShieldCheck className="h-4 w-4" />} name="ACL 同步覆盖率" value={94} suffix="%" hint="企业网盘 94% · 飞书文档 92%" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* 左 8 列 */}
        <div className="col-span-12 space-y-4 xl:col-span-8">
          {/* 连接器卡 2×2 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {connectorCards.map((c) => (
              <section key={c.id} className={cn('rounded-xl border bg-white p-5 shadow-card', c.connected ? 'border-neutral-200' : 'border-dashed border-neutral-300')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {connectorLogo(c)}
                    <div>
                      <h3 className="text-h3 text-neutral-950">{c.name}</h3>
                      <p className="mt-0.5 text-caption text-neutral-500">{c.connected ? `${c.docs} 份资料` : c.desc}</p>
                    </div>
                  </div>
                  {c.disabled ? <StatusBadge status="已停用" /> : c.connected ? <StatusBadge status="已连接" /> : <StatusBadge status="未连接" />}
                </div>

                {c.connected && c.disabled ? (
                  <>
                    <p className="mt-4 rounded-lg bg-surface-soft px-3 py-2 text-body-sm text-neutral-500">
                      已停用：同步任务暂停，{c.docs ?? 0} 份资料仍保留在索引中，授权与配置未删除。
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                      <button type="button" className={BTN_SECONDARY + ' !h-8 px-3'} onClick={() => enableConnector(c.id)}>
                        启用
                      </button>
                      <button type="button" className={BTN_TERTIARY} onClick={() => setLogsId(c.id)}>
                        查看日志
                      </button>
                      <button type="button" className={BTN_TERTIARY + ' !text-danger hover:!bg-danger-bg'} onClick={() => setDeleteTarget(c.id)}>
                        删除
                      </button>
                    </div>
                  </>
                ) : c.connected ? (
                  <>
                    <div className="mt-4 space-y-2.5 text-body-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">上次同步</span>
                        <span className="text-neutral-800">{c.lastSyncAt}</span>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between">
                          <span className="text-neutral-500">ACL 覆盖率</span>
                          <span className={cn('font-medium', (c.aclCoverage ?? 100) < 90 ? 'text-warning' : 'text-neutral-800')}>{c.aclCoverage}%</span>
                        </div>
                        <ProgressBar value={c.aclCoverage ?? 0} barClassName={(c.aclCoverage ?? 100) < 90 ? 'bg-warning' : undefined} />
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-neutral-500">增量同步</span>
                        <button type="button" role="switch" aria-checked={c.incremental} onClick={() => toggleIncremental(c.id)} className={switchCls(c.incremental)}>
                          <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-comp ease-brand', c.incremental ? 'left-[22px]' : 'left-0.5')} />
                        </button>
                      </div>
                    </div>
                    {c.authValidUntil && (
                      <div className={cn('mt-3 rounded-lg px-3 py-2 text-caption', feishuExpiring ? 'bg-warning-bg text-warning' : 'bg-surface-soft text-neutral-500')}>
                        <p className="flex items-center gap-1.5">
                          {feishuExpiring && <TriangleAlert className="h-3.5 w-3.5 shrink-0" />}
                          授权有效期至 {c.authValidUntil}
                          {feishuExpiring && ` · ${c.authExpireNote}`}
                        </p>
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                      <button type="button" className={BTN_SECONDARY + ' !h-8 px-3'} onClick={() => openConnSettings(c.id)}>
                        同步设置
                      </button>
                      <button type="button" className={BTN_TERTIARY} onClick={() => setReauthTarget(c.id)}>
                        重新授权
                      </button>
                      <button type="button" className={BTN_TERTIARY} onClick={() => setLogsId(c.id)}>
                        查看日志
                      </button>
                      <button type="button" className={BTN_TERTIARY} onClick={() => setDisableTarget(c.id)}>
                        停用
                      </button>
                      <button type="button" className={BTN_TERTIARY + ' !text-danger hover:!bg-danger-bg'} onClick={() => setDeleteTarget(c.id)}>
                        删除
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-neutral-100 pt-4">
                    <p className="text-caption text-neutral-400">连接后自动继承组织架构权限</p>
                    <span className="flex items-center gap-1">
                      <button type="button" className={BTN_TERTIARY + ' !text-danger hover:!bg-danger-bg'} onClick={() => setDeleteTarget(c.id)}>
                        删除
                      </button>
                      <button type="button" className={BTN_SECONDARY + ' !h-8 px-3'} onClick={() => openWizard(`正在连接：${c.name}，请选择接入方式（推荐 OAuth 授权）`)}>
                        连接{c.name}
                      </button>
                    </span>
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* 同步任务列表 */}
          <section className="rounded-xl border border-neutral-200 bg-white shadow-card">
            <header className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
              <h3 className="text-h3 text-neutral-950">同步任务</h3>
              <button type="button" className={BTN_TERTIARY} onClick={() => setAllLogsOpen(true)}>
                查看全部同步日志 ›
              </button>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-body-sm">
                <thead>
                  <tr className="h-10 bg-surface-soft text-left text-body-sm text-neutral-500">
                    <th className="px-5 font-medium">任务</th>
                    <th className="px-3 font-medium">状态</th>
                    <th className="px-3 text-right font-medium">文档数</th>
                    <th className="px-3 font-medium">开始时间</th>
                    <th className="px-3 font-medium">耗时</th>
                    <th className="px-5 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => {
                    const failed = t.status === '失败'
                    const running = t.status === '进行中'
                    return (
                      <FragmentRow
                        key={t.id}
                        task={t}
                        failed={failed}
                        running={running}
                        retrying={retryingId === t.id}
                        expanded={expandedFail === t.id}
                        onToggleExpand={() => setExpandedFail(expandedFail === t.id ? null : t.id)}
                        onRetry={() => retryTask(t)}
                        onDetail={() => setDetailTask(t)}
                        onReauth={() => setReauthTarget('feishu')}
                        onSkip={() => {
                          setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: '已完成', docs: '已跳过 3 份', duration: '—', failReason: undefined } : x)))
                          toast.success('已跳过 3 份加密文档，任务标记完成')
                        }}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* 右 4 列：同步健康侧栏 */}
        <div className="col-span-12 space-y-4 xl:col-span-4">
          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card">
            <h3 className="flex items-center gap-1.5 text-h3 text-neutral-950">
              <ShieldCheck className="h-5 w-5 text-brand-600" />
              ACL 权限同步
            </h3>
            <dl className="mt-3 space-y-2.5 text-body-sm">
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">同步策略</dt><dd className="text-neutral-800">{SYNC_HEALTH.aclPolicy}</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">上次同步</dt><dd className="text-neutral-800">{SYNC_HEALTH.aclLastSyncAt}</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">覆盖成员</dt><dd className="text-neutral-800">{SYNC_HEALTH.aclCoveredUsers} 人</dd></div>
            </dl>
            <p className="mt-3 rounded-lg bg-surface-soft px-3 py-2 text-caption text-neutral-500">
              未授权的内容不会进入检索与回答。
            </p>
            <button type="button" className={BTN_TERTIARY + ' mt-1'} onClick={() => navigate('/workspace/permissions')}>
              权限同步详情 ›
            </button>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card">
            <h3 className="text-h3 text-neutral-950">增量同步</h3>
            <p className="mt-2 text-body-sm text-neutral-700">
              已开启 <span className="font-semibold text-brand-600">{incrementalOn} / {connectedCount}</span> 个连接器
            </p>
            <p className="mt-2 text-caption text-neutral-500">开启后仅同步变更文档，全量校验{syncSettings.cycle}自动执行（可在页头「同步设置」调整）</p>
          </section>

          <AnimatePresence>
            {feishuExpiring && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24 }}
                className="rounded-xl border border-warning/30 bg-warning-bg p-5"
              >
                <h3 className="flex items-center gap-1.5 text-h3 text-neutral-950">
                  <TriangleAlert className="h-5 w-5 text-warning" />
                  异常提醒
                </h3>
                <p className="mt-2 text-body-sm text-neutral-700">飞书文档授权 16 天后到期，到期后将暂停增量同步。</p>
                <button type="button" className={BTN_SECONDARY + ' mt-3 !h-9'} onClick={() => setReauthTarget('feishu')}>
                  重新授权
                </button>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 重新授权 L2 */}
      <Modal open={!!reauthTarget} onClose={() => setReauthTarget(null)} width={520}>
        <ConfirmationCard
          title="重新授权"
          description="将重新走 OAuth 授权流程，期间同步任务不中断。"
          fields={[
            { label: '动作', value: `重新发起${connectors.find((c) => c.id === reauthTarget)?.name ?? ''} OAuth 授权` },
            { label: '影响对象', value: `${connectors.find((c) => c.id === reauthTarget)?.name ?? ''}连接器（${connectors.find((c) => c.id === reauthTarget)?.docs ?? 0} 份资料）` },
            { label: '影响范围', value: reauthTarget === 'feishu' ? '授权有效期顺延 90 天（至 2024-09-13）' : '授权令牌刷新，同步任务继续' },
            { label: '可撤销性', value: '可随时在原系统后台撤销授权' },
          ]}
          confirmText="确认重新授权"
          loading={reauthLoading}
          onConfirm={confirmReauth}
          onCancel={() => setReauthTarget(null)}
        />
      </Modal>

      {/* 关闭增量同步提示 */}
      <Modal open={!!switchOffTarget} onClose={() => setSwitchOffTarget(null)} width={480}>
        <ConfirmationCard
          title="关闭增量同步"
          fields={[
            { label: '动作', value: `关闭「${connectors.find((c) => c.id === switchOffTarget)?.name}」的增量同步` },
            { label: '影响范围', value: '关闭后将在每周全量校验（周日 02:00）时更新' },
            { label: '可撤销性', value: '可随时重新开启' },
          ]}
          confirmText="确认关闭"
          onConfirm={() => {
            setConnectors((prev) => prev.map((x) => (x.id === switchOffTarget ? { ...x, incremental: false } : x)))
            setSwitchOffTarget(null)
            toast.success('已关闭增量同步，将在每周全量校验时更新')
          }}
          onCancel={() => setSwitchOffTarget(null)}
        />
      </Modal>

      {/* 页级同步设置 Modal */}
      <Modal
        open={pageSettingsOpen}
        onClose={() => setPageSettingsOpen(false)}
        title="同步设置"
        description="生效于全部已连接来源的全量校验与同步调度"
        width={520}
        footer={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => setPageSettingsOpen(false)}>
              取消
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => {
                setSyncSettings({ cycle: draftCycle, concurrency: draftConcurrency, notifyFail: draftNotify })
                setPageSettingsOpen(false)
                toast.success('同步设置已保存，立即生效')
              }}
            >
              保存设置
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">全量校验周期</label>
            <select
              value={draftCycle}
              onChange={(e) => setDraftCycle(e.target.value)}
              className="h-11 w-full rounded-md border border-[#DCE4EF] bg-white px-3 text-body text-neutral-800 outline-none focus:border-brand-500 focus:shadow-input"
            >
              {FULL_CHECK_CYCLES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <p className="mt-1.5 text-caption text-neutral-400">增量同步仅同步变更文档，全量校验按此周期自动执行。</p>
          </div>
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">并发上限</label>
            <select
              value={draftConcurrency}
              onChange={(e) => setDraftConcurrency(e.target.value)}
              className="h-11 w-full rounded-md border border-[#DCE4EF] bg-white px-3 text-body text-neutral-800 outline-none focus:border-brand-500 focus:shadow-input"
            >
              {CONCURRENCY_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <p className="mt-1.5 text-caption text-neutral-400">同时运行的同步任务数上限，超出进入队列等待。</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2.5">
            <div>
              <p className="text-body-sm font-medium text-neutral-800">失败通知</p>
              <p className="text-caption text-neutral-400">同步失败时向管理员发送通知</p>
            </div>
            <button type="button" role="switch" aria-checked={draftNotify} onClick={() => setDraftNotify((v) => !v)} className={switchCls(draftNotify)}>
              <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-comp ease-brand', draftNotify ? 'left-[22px]' : 'left-0.5')} />
            </button>
          </div>
        </div>
      </Modal>

      {/* 连接器同步设置 Drawer */}
      <SideDrawer
        open={connSettingsId !== null}
        onClose={() => setConnSettingsId(null)}
        title={`${connectors.find((c) => c.id === connSettingsId)?.name ?? ''} · 同步设置`}
        width={440}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN_SECONDARY + ' !h-9'} onClick={() => setConnSettingsId(null)}>
              取消
            </button>
            <button
              type="button"
              className={BTN_PRIMARY + ' !h-9'}
              onClick={() => {
                if (!connSettingsId) return
                setConnSettingsMap((prev) => ({ ...prev, [connSettingsId]: connDraft }))
                setConnSettingsId(null)
                toast.success('同步设置已保存，将于下次同步生效')
              }}
            >
              保存设置
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">同步频率</label>
            <select
              value={connDraft.frequency}
              onChange={(e) => setConnDraft((d) => ({ ...d, frequency: e.target.value }))}
              className="h-11 w-full rounded-md border border-[#DCE4EF] bg-white px-3 text-body text-neutral-800 outline-none focus:border-brand-500 focus:shadow-input"
            >
              {CONN_FREQUENCY_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">同步范围</label>
            <select
              value={connDraft.scope}
              onChange={(e) => setConnDraft((d) => ({ ...d, scope: e.target.value }))}
              className="h-11 w-full rounded-md border border-[#DCE4EF] bg-white px-3 text-body text-neutral-800 outline-none focus:border-brand-500 focus:shadow-input"
            >
              {CONN_SCOPE_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">失败自动重试</label>
            <select
              value={connDraft.retry}
              onChange={(e) => setConnDraft((d) => ({ ...d, retry: e.target.value }))}
              className="h-11 w-full rounded-md border border-[#DCE4EF] bg-white px-3 text-body text-neutral-800 outline-none focus:border-brand-500 focus:shadow-input"
            >
              {CONN_RETRY_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          {connSettingsId && connSettingsMap[connSettingsId] && (
            <p className="rounded-lg bg-surface-soft px-3 py-2 text-caption text-neutral-500">
              当前生效：{connSettingsMap[connSettingsId].frequency} · {connSettingsMap[connSettingsId].scope} · 重试 {connSettingsMap[connSettingsId].retry}
            </p>
          )}
          <p className="rounded-lg bg-warning-bg px-3 py-2 text-body-sm text-warning">
            注意：缩小同步范围后，被排除目录的文档将在下次校验后从索引移除。
          </p>
        </div>
      </SideDrawer>

      {/* 连接器日志 Drawer */}
      <SideDrawer
        open={logsId !== null}
        onClose={() => setLogsId(null)}
        title={`${connectors.find((c) => c.id === logsId)?.name ?? ''} · 同步日志`}
        width={440}
      >
        {logsId && <LogList logs={connectorLogs({ id: logsId, name: connectors.find((c) => c.id === logsId)?.name ?? '' })} />}
      </SideDrawer>

      {/* 任务详情 Drawer */}
      <SideDrawer open={!!detailTask} onClose={() => setDetailTask(null)} title="任务详情" width={440}>
        {detailTask && (
          <div className="flex flex-col gap-5">
            <dl className="space-y-2.5 text-body-sm">
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">任务</dt><dd className="text-neutral-800">{detailTask.source} · {detailTask.type}</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">状态</dt><dd><StatusBadge status={detailTask.status} /></dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">文档数</dt><dd className="text-neutral-800">{detailTask.docs}</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">开始时间</dt><dd className="text-neutral-800">{detailTask.startedAt}</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">耗时</dt><dd className="text-neutral-800">{detailTask.duration}</dd></div>
              {detailTask.failReason && (
                <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">失败原因</dt><dd className="text-danger">{detailTask.failReason}（重试 {detailTask.retryCount ?? 0}/3）</dd></div>
              )}
            </dl>
            <section>
              <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">执行日志</h4>
              <LogList logs={taskLogsFor(detailTask)} />
            </section>
          </div>
        )}
      </SideDrawer>

      {/* 全部同步日志 Drawer */}
      <SideDrawer open={allLogsOpen} onClose={() => setAllLogsOpen(false)} title="全部同步日志（近 30 天）" width={480}>
        <LogList logs={ALL_SYNC_LOGS} />
      </SideDrawer>

      {/* 停用连接器 L2 */}
      <Modal open={!!disableTarget} onClose={() => setDisableTarget(null)} width={520}>
        <ConfirmationCard
          title="停用连接器"
          fields={[
            { label: '动作', value: `停用「${connectors.find((c) => c.id === disableTarget)?.name ?? ''}」` },
            { label: '影响范围', value: '同步任务暂停，已索引文档保留可检索，但不再更新' },
            { label: '可撤销性', value: '可随时在卡片上点击「启用」恢复' },
          ]}
          confirmText="确认停用"
          onConfirm={confirmDisable}
          onCancel={() => setDisableTarget(null)}
        />
      </Modal>

      {/* 删除连接器 L2 */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} width={520}>
        <ConfirmationCard
          title="删除连接器"
          description="删除后将撤销授权并从列表移除该来源。"
          fields={[
            { label: '动作', value: `删除「${connectors.find((c) => c.id === deleteTarget)?.name ?? ''}」连接器` },
            { label: '影响对象', value: `${connectors.find((c) => c.id === deleteTarget)?.docs ?? 0} 份资料将在 7 天内从索引清除` },
            { label: '影响范围', value: '相关引用与问答将失去来源，无法再追溯' },
            { label: '可撤销性', value: '7 天内重新连接可保留索引；逾期需重新全量同步' },
          ]}
          confirmText="确认删除"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </Modal>

      {/* 新增来源向导 */}
      <Modal
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false)
          resetWizard()
        }}
        title="新增数据来源"
        description={wizardStep === 1 ? '第 1 步 / 共 2 步 · 选择来源类型' : `第 2 步 / 共 2 步 · 配置「${srcType?.label}」`}
        width={640}
        footer={
          <>
            {wizardStep === 2 && (
              <button type="button" className={BTN_SECONDARY} onClick={() => setWizardStep(1)}>
                上一步
              </button>
            )}
            {wizardStep === 1 ? (
              <button type="button" className={BTN_PRIMARY} disabled={!srcType} onClick={() => setWizardStep(2)}>
                下一步
              </button>
            ) : srcType?.kind === 'api' ? (
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={() => {
                  setWizardOpen(false)
                  resetWizard()
                  navigate('/workspace/api-dev')
                }}
              >
                前往 API 与开发 ›
              </button>
            ) : (
              <button type="button" className={BTN_PRIMARY} disabled={!canSubmit} onClick={submitWizard}>
                {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {submitting ? '正在验证地址可用性…' : srcType?.kind === 'oauth' ? '连接并同步' : '开始抓取'}
              </button>
            )}
          </>
        }
      >
        {wizardStep === 1 ? (
          <div>
            {wizardNotice && (
              <p className="mb-3 rounded-lg bg-info-bg px-3 py-2 text-body-sm text-info">{wizardNotice}</p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SOURCE_TYPES.map((t) => {
                const Icon = TYPE_ICONS[t.value]
                const on = srcType?.value === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setSrcType(t)}
                    className={cn(
                      'relative rounded-lg border p-3.5 text-left transition-colors duration-micro ease-brand',
                      on ? 'border-[1.5px] border-brand-500 bg-surface-cardSel' : 'border-neutral-200 hover:border-brand-300',
                    )}
                  >
                    {on && (
                      <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
                        <ChevronDown className="h-3 w-3 rotate-180" />
                      </span>
                    )}
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <p className="mt-2 text-body-sm font-medium text-neutral-950">{t.label}</p>
                    <p className="mt-0.5 text-caption text-neutral-500">{t.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
        ) : srcType?.kind === 'api' ? (
          <div className="rounded-lg border border-neutral-200 bg-surface-soft p-4">
            <p className="text-body font-medium text-neutral-950">API 接入在「API 与开发」中配置</p>
            <p className="mt-1 text-body-sm text-neutral-500">
              创建 API Key 后，可通过开放接口将结构化知识推送到知识库，支持用量限额与 Webhook 回调。
            </p>
          </div>
        ) : srcType?.kind === 'oauth' ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-200 p-4">
              <p className="text-body-sm font-medium text-neutral-800">第 1 步：完成 OAuth 授权</p>
              <button
                type="button"
                className={cn(BTN_SECONDARY + ' mt-2', oauthDone && 'border-success bg-success-bg text-success hover:text-success')}
                onClick={() => {
                  setOauthDone(true)
                  toast.success(`${srcType.label} 授权成功`)
                }}
              >
                {oauthDone ? '✓ 已授权' : `授权 ${srcType.label} 账号`}
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">同步范围</label>
              <select className="h-11 w-full rounded-md border border-[#DCE4EF] bg-white px-3 text-body text-neutral-800 outline-none focus:border-brand-500 focus:shadow-input">
                <option>全部可访问空间</option>
                <option>仅指定数据库 / 空间</option>
                <option>仅我创建的页面</option>
              </select>
              <p className="mt-1.5 text-caption text-neutral-400">
                权限映射说明：将按 {srcType.label} 的空间/页面权限同步访问控制，未授权成员不可检索。
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">
                {srcType?.value === 'rss' ? 'RSS 订阅地址' : srcType?.value === 'sitemap' ? 'Sitemap 地址' : '网页地址'} <span className="text-danger">*</span>
              </label>
              <input
                value={srcUrl}
                onChange={(e) => setSrcUrl(e.target.value)}
                placeholder="https://example.com/docs"
                className={cn(
                  'h-11 w-full rounded-md border px-3 text-body text-neutral-800 outline-none placeholder:text-neutral-400 focus:shadow-input',
                  urlValid ? 'border-[#DCE4EF] focus:border-brand-500' : 'border-danger focus:border-danger',
                )}
              />
              {!urlValid && <p className="mt-1 text-caption text-danger">请输入合法的 http(s) 地址</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">抓取深度</label>
              <select
                value={srcDepth}
                onChange={(e) => setSrcDepth(e.target.value)}
                className="h-11 w-full rounded-md border border-[#DCE4EF] bg-white px-3 text-body text-neutral-800 outline-none focus:border-brand-500 focus:shadow-input"
              >
                {CRAWL_DEPTH_OPTIONS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <p className="rounded-lg bg-warning-bg px-3 py-2 text-body-sm text-warning">
              有效期建议：外部网页建议 30 天复审{srcType?.value === 'rss' ? '（RSS 订阅默认 30 天自动重抓比较）' : ''}。
            </p>
          </div>
        )}
      </Modal>

    </div>
  )
}

/* ---------- 同步任务行（含失败展开） ---------- */

function FragmentRow({
  task,
  failed,
  running,
  retrying,
  expanded,
  onToggleExpand,
  onRetry,
  onDetail,
  onReauth,
  onSkip,
}: {
  task: SyncTask
  failed: boolean
  running: boolean
  retrying: boolean
  expanded: boolean
  onToggleExpand: () => void
  onRetry: () => void
  onDetail: () => void
  onReauth: () => void
  onSkip: () => void
}) {
  return (
    <>
      <tr className={cn('h-12 border-t border-neutral-100', failed && 'bg-danger-bg/30')}>
        <td className={cn('px-5 text-neutral-800', failed && 'border-l-2 border-l-danger')}>
          {task.source} · {task.type}
        </td>
        <td className="px-3">
          {running ? (
            <span className="inline-flex items-center gap-1.5 text-cyan">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan/30 border-t-cyan" />
              {retrying ? '正在重试…' : '进行中…'}
            </span>
          ) : (
            <StatusBadge status={task.status} />
          )}
        </td>
        <td className="px-3 text-right text-neutral-800">{task.docs}</td>
        <td className="px-3 text-neutral-500">{task.startedAt}</td>
        <td className="px-3 text-neutral-500">{task.duration}</td>
        <td className="px-5 text-right">
          {failed ? (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                disabled={retrying}
                onClick={onRetry}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-600 px-3 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                {retrying && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {retrying ? '正在重试…' : '重试'}
              </button>
              <button type="button" className={BTN_TERTIARY} onClick={onToggleExpand}>
                {expanded ? '收起' : '查看原因'}
              </button>
            </span>
          ) : (
            <button type="button" className={BTN_TERTIARY} onClick={onDetail}>
              查看详情
            </button>
          )}
        </td>
      </tr>
      {failed && expanded && (
        <tr className="border-t border-neutral-100 bg-danger-bg/20">
          <td colSpan={6} className="px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body-sm text-neutral-700">
                <span className="font-medium text-danger">失败原因：</span>
                {task.failReason}（重试次数 {task.retryCount}/3）
              </p>
              <span className="flex items-center gap-1">
                <button type="button" className={BTN_TERTIARY} onClick={onReauth}>
                  重新授权后重试
                </button>
                <button type="button" className={BTN_TERTIARY} onClick={onSkip}>
                  跳过这些文档
                </button>
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
