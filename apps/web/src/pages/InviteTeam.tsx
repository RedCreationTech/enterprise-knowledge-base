/**
 * 邀请同事 /workspace/invite-team（V1.4 迁入 WorkspaceShell；原 /trial/invite 已 301）
 * 标题区：面包屑「工作台 / 邀请同事」+ H1 + 副标题 + ?from=trial 试用提示条（仅试用期显示）
 * 三栏：左小知对话（邀请建议 + 快捷操作）/ 中：3 步迷你 Stepper + 团队选择卡 + 邀请成员表格 / 右：上线前确认 + 终端体验预览
 * 底部 sticky 试用设置栏 + 主 CTA「开始 7 天内部试用」→ ConfirmationCard → 发送 → 跳 /workspace/apps?from=trial（V1.3 新路由）
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  Link2,
  MoreHorizontal,
  RefreshCw,
  Settings2,
  Users,
  Volume2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { answer, daily, isStepDone, JOURNEY_STEPS, preflight, teams as baseTeams, useAppStore } from '@/mocks'
import { ChatPanel } from '@/components/chat'
import { ConfirmationCard, EmptyState, SectionCard, StatusBadge } from '@/components/common'
import { Modal, Switch } from '@/pages/activation/ui'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { useAppToast } from '@/lib/toast'
import { FAIL_IDS, INVITE_LINK, initialInvitees, makeInviteLink, TERMINAL_PREVIEW } from '@/pages/activation/invite-data'
import type { Invitee } from '@/pages/activation/invite-data'

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1]
const PAGE = '/workspace/invite-team'

/** 试用席位上限 20、当前已激活成员 12（口径与设置页成员席位 12/20 一致） */
const TRIAL_SEAT_LIMIT = 20
const ACTIVATED_MEMBERS = 12

/** 空名册（演示数据关闭）时手动添加的同事邮箱条目 */
interface ManualInvitee {
  id: string
  email: string
  checked: boolean
  sent: boolean
}

const AI_MSG_1 =
  '根据你当前的组织结构和试用目标，我整理了一份邀请建议：\n● 销售团队 和 售前团队 与知识库的使用场景贴合度高，是优先试用的理想团队。\n● 我发现有 2 名团队成员的账号映射信息不完整，可能影响邀请与登录体验。\n建议现在发送邀请吗？你也可以先补全账号映射，或调整邀请范围与设置。'
const AI_MSG_2 = '我已为你准备好邀请名单，随时可以发送。如需调整团队或成员，告诉我即可。'

const TEAM_ICONS: Record<string, string> = {
  销售团队: 'bg-brand-100 text-brand-600',
  售前团队: 'bg-cyan-bg text-cyan',
  客服团队: 'bg-violet-bg text-violet',
  产品团队: 'bg-warning-bg text-warning',
}

const SUB_STEPS = ['选择团队', '输入邮箱/手机号', '复制试用链接']

/** 子步骤 2 批量添加账号并入名册时使用的虚拟团队名（不参与团队勾选过滤） */
const MANUAL_TEAM = '手动添加'

export default function InviteTeam() {
  const toast = useAppToast()
  const { state, sendInvites, pushAssistantMessage, setReplyScript } = useAppStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  /** V1.4：从 Stepper / 旅程进入时带 ?from=trial（提示条带返回旅程语义） */
  const fromTrial = searchParams.get('from') === 'trial'
  const trial = !state.journey.activated

  /** 演示数据开关（并行任务注入 store；字段缺失时按 true 处理保持现状，仅显式 false 进入空态） */
  const demoOff = (state as { demoData?: boolean }).demoData === false

  // ----- 页面状态 -----
  /** 默认仅勾选客服团队（8 人）：12 已激活 + 8 = 20 恰好不超席位，主 CTA 默认可用；改选销售/售前即触发超限 */
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(baseTeams.map((t) => [t.name, t.name === '客服团队'])),
  )
  const [invitees, setInvitees] = useState<Invitee[]>(() => (demoOff ? [] : initialInvitees))
  const [manualEmail, setManualEmail] = useState('')
  const [manualInvitees, setManualInvitees] = useState<ManualInvitee[]>([])
  const [subStep, setSubStep] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [pendingOnly, setPendingOnly] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [batchText, setBatchText] = useState('')
  const [batchAdded, setBatchAdded] = useState<string[]>([])
  const [linkCopied, setLinkCopied] = useState(false)
  const [settings, setSettings] = useState({ period: preflight.period, showCitations: true, allowFeedback: true, access: '内部访问（登录验证）' })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [pendingWarnOpen, setPendingWarnOpen] = useState(false)
  const [accessWarnOpen, setAccessWarnOpen] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const [ctaPulse, setCtaPulse] = useState(false)
  /** 当前试用链接（「重新生成」会真实更新） */
  const [inviteLink, setInviteLink] = useState(INVITE_LINK)
  /** 终端预览引用/文档抽屉 */
  const [citeDrawer, setCiteDrawer] = useState<'citations' | 'docs' | null>(null)
  /** 会话内是否已实际执行过发送（不能从 mock 初始数据派生，initialInvitees 自带历史「已发送」行） */
  const [sentThisSession, setSentThisSession] = useState(false)

  const ctaRef = useRef<HTMLButtonElement>(null)
  const settingsBarRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // ----- 会话种子（每会话一次） -----
  useEffect(() => {
    if (!state.chatMessages.some((m) => m.page === PAGE && m.content.includes('邀请建议'))) {
      pushAssistantMessage(AI_MSG_1, PAGE)
      pushAssistantMessage(AI_MSG_2, PAGE)
    }
    setReplyScript(
      () =>
        '收到。团队选择会实时联动邀请名单与试用人数；有 2 名成员账号映射不完整，建议先点「完善信息」补全，再发送邀请。',
    )
    return () => setReplyScript(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ----- 派生数据 -----
  const selectedTeams = baseTeams.filter((t) => selected[t.name])
  const totalPeople = selectedTeams.reduce((sum, t) => sum + t.count, 0)
  const visibleInvitees = useMemo(
    () =>
      invitees
        .filter((i) => i.team === MANUAL_TEAM || selected[i.team])
        .filter((i) => (pendingOnly ? i.status === '待处理' : true)),
    [invitees, selected, pendingOnly],
  )
  const pendingCount = invitees.filter((i) => selected[i.team] && i.status === '待处理').length
  const failedCount = invitees.filter((i) => i.status === '发送失败').length

  // ----- 席位闸门（P1-3）：已选人数 + 已激活成员 > 试用席位上限时预警并禁用发送 -----
  const manualCheckedCount = manualInvitees.filter((m) => m.checked && !m.sent).length
  /** 批量添加并入名册、尚未发送成功的账号同样占用席位 */
  const batchPendingCount = invitees.filter((i) => i.team === MANUAL_TEAM && i.status !== '已发送').length
  /** 已勾选待邀请人数 = 已选团队人数 + 手动添加且勾选的人数 + 批量添加待发送人数 */
  const selectedCount = totalPeople + manualCheckedCount + batchPendingCount
  const overBy = ACTIVATED_MEMBERS + selectedCount - TRIAL_SEAT_LIMIT
  const overLimit = overBy > 0
  const hasTargets = selectedTeams.length > 0 || manualCheckedCount > 0 || batchPendingCount > 0

  // ----- 交互 -----
  const toggleTeam = (name: string) => {
    setSelected((prev) => {
      const next = { ...prev, [name]: !prev[name] }
      if (subStep === 0 && Object.values(next).some(Boolean)) setTimeout(() => setSubStep(1), 400)
      return next
    })
  }

  const exportCsv = () => {
    const rows = [['姓名', '团队', '邮箱/手机号', '状态', '邀请时间'], ...visibleInvitees.map((i) => [i.name, i.team, i.contact, i.status, i.invitedAt ?? '—'])]
    const csv = '﻿' + rows.map((r) => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = '试用邀请名单.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`已导出 ${visibleInvitees.length} 人邀请名单`)
  }

  const handleChip = (chip: string) => {
    if (chip === '发送邀请') {
      ctaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setCtaPulse(true)
      setTimeout(() => setCtaPulse(false), 1200)
    } else if (chip === '导出名单') {
      exportCsv()
    } else if (chip === '补全账号映射') {
      setPendingOnly(true)
      setExpanded(true)
      toast.info(`已筛选出 ${pendingCount} 条待处理成员`)
    } else if (chip === '调整设置') {
      settingsBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }

  const saveEdit = (id: string) => {
    if (!editValue.trim()) {
      toast.warning('请输入邮箱或手机号')
      return
    }
    setInvitees((prev) => prev.map((i) => (i.id === id ? { ...i, contact: editValue.trim(), status: '待发送' } : i)))
    setEditingId(null)
    toast.success('账号信息已补全，状态更新为待发送')
  }

  const resend = (id: string) => {
    setResendingId(id)
    setTimeout(() => {
      setInvitees((prev) => prev.map((i) => (i.id === id ? { ...i, status: '已发送' as const, invitedAt: '刚刚' } : i)))
      setResendingId(null)
      toast.success('已重新发送邀请')
    }, 800)
  }

  const finishIfAllSent = (list: Invitee[]) => {
    if (!list.some((i) => i.status === '发送失败')) {
      sendInvites()
      toast.success('试用邀请已全部发送，7 天内部试用已开始')
      setTimeout(() => navigate('/workspace/apps?from=trial'), 800)
      return true
    }
    return false
  }

  /** 复用的重试逻辑：单条重试与「全部重试」共用 */
  const retryBatch = (ids: string[], successMsg: string) => {
    if (ids.length === 0) return
    setResendingId(ids.length === 1 ? ids[0] : '__all__')
    setTimeout(() => {
      setInvitees((prev) => {
        const next = prev.map((i) => (ids.includes(i.id) ? { ...i, status: '已发送' as const, invitedAt: '刚刚' } : i))
        setResendingId(null)
        toast.success(successMsg)
        finishIfAllSent(next)
        return next
      })
    }, 800)
  }

  const retryFailed = (id: string) => {
    retryBatch([id], '重试成功，邀请已发送')
  }

  const retryAllFailed = () => {
    const ids = invitees.filter((i) => i.status === '发送失败').map((i) => i.id)
    retryBatch(ids, `已批量重试成功，${ids.length} 条失败邀请已重新发送`)
  }

  /** 子步骤 2「添加账号」：批量账号真实并入名册（新行、可筛选/发送/导出，占用席位） */
  const addBatch = () => {
    const parts = batchText
      .split(/[,，;；\s\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const existing = new Set([...batchAdded, ...invitees.map((i) => i.contact)])
    const unique = Array.from(new Set(parts.filter((p) => !existing.has(p))))
    if (unique.length === 0) {
      toast.warning('没有可添加的新账号（重复项已自动去重）')
      return
    }
    const rows: Invitee[] = unique.map((contact, idx) => ({
      id: `batch-${Date.now()}-${idx}`,
      name: contact.includes('@') ? contact.split('@')[0] : contact,
      team: MANUAL_TEAM,
      contact,
      status: '待发送',
      invitedAt: null,
    }))
    setInvitees((prev) => [...prev, ...rows])
    setBatchAdded((prev) => [...prev, ...unique])
    setBatchText('')
    setExpanded(true)
    toast.success(`已添加 ${unique.length} 个账号到邀请名册（自动去重）`)
  }

  /** 空名册（演示数据关闭）时手动添加同事邮箱，进本地 state 可勾选 */
  const addManual = () => {
    const email = manualEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.warning('请输入正确的邮箱地址')
      return
    }
    if (manualInvitees.some((m) => m.email === email)) {
      toast.warning('该邮箱已在名单中')
      return
    }
    setManualInvitees((prev) => [...prev, { id: `manual-${prev.length + 1}-${Date.now()}`, email, checked: true, sent: false }])
    setManualEmail('')
    toast.success(`已添加 ${email} 到邀请名册`)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
    } catch {
      // 剪贴板不可用时静默
    }
    setLinkCopied(true)
    toast.success('试用链接已复制')
    setTimeout(() => setLinkCopied(false), 1500)
  }

  const handleCta = () => {
    if (sentThisSession) {
      // 本会话已发送过：仍有失败则一键全部重试，否则仅查看发送状态，不再重开确认弹窗 / 重复发送
      if (failedCount > 0) {
        retryAllFailed()
        return
      }
      setExpanded(true)
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (!hasTargets) {
      toast.warning(demoOff ? '请先手动添加同事邮箱' : '请至少选择 1 个团队')
      return
    }
    if (overLimit) {
      toast.warning(`已选 ${selectedCount} 人，超出试用席位 ${overBy} 人，请减少邀请人数或升级套餐`)
      return
    }
    if (pendingCount > 0) {
      setPendingWarnOpen(true)
      return
    }
    setConfirmOpen(true)
  }

  const doSend = () => {
    setSentThisSession(true)
    setSending(true)
    setTimeout(() => {
      setSending(false)
      setConfirmOpen(false)
      const next = invitees.map((i) => {
        if ((i.team !== MANUAL_TEAM && !selected[i.team]) || i.status === '待处理') return i
        if (FAIL_IDS.includes(i.id)) return { ...i, status: '发送失败' as const }
        return { ...i, status: '已发送' as const, invitedAt: i.invitedAt ?? '刚刚' }
      })
      setInvitees(next)
      // 空名册手动添加的勾选项一并置为已发送
      if (manualCheckedCount > 0) {
        setManualInvitees((prev) => prev.map((m) => (m.checked ? { ...m, sent: true } : m)))
      }
      setExpanded(true)
      if (!finishIfAllSent(next)) {
        const failedNow = next.filter((i) => i.status === '发送失败').length
        toast.warning(`部分成功：${selectedCount - failedNow} 人已发送，${failedNow} 人失败，请在表格中重试`)
      }
    }, 1400)
  }

  const selectedTeamNames = selectedTeams.map((t) => t.name).join('、')

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
        crumbs={['工作台', '邀请同事']}
        title="邀请同事加入试用，让团队开始真实使用"
        subtitle="选择团队成员，发送试用邀请，他们将获得 7 天内部试用权限"
      />

      {/* 试用提示条（仅试用期；激活后不显示） */}
      {trial && (
        <div className="flex h-8 items-center justify-between gap-3 rounded-lg bg-brand-100 px-3">
          <span className="truncate text-body-sm text-brand-700">
            🧭 试用第 {daily.trialDay} 天 · 邀请同事加入试用可推进激活进度
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

      {/* 三栏 */}
      <div className="grid items-start gap-4 xl:grid-cols-[380px_minmax(0,1fr)_320px]">
        {/* 左栏：AI 对话面板 */}
        <ChatPanel
          className="h-[620px] xl:sticky xl:top-24"
          chips={['发送邀请', '导出名单', '补全账号映射', '调整设置']}
          selectedChip="发送邀请"
          onChipSelect={handleChip}
          composerPlaceholder="告诉小知要调整的团队或成员…"
        />

        {/* 中栏 */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* 迷你 Stepper */}
          <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-3 shadow-card">
            {SUB_STEPS.map((label, i) => {
              const done = i < subStep
              const current = i === subStep
              return (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && <span className={cn('mx-1 h-px w-8 border-t border-dashed', done || current ? 'border-brand-300' : 'border-neutral-200')} />}
                  <button
                    type="button"
                    onClick={() => i <= subStep && setSubStep(i)}
                    className={cn('flex items-center gap-1.5 rounded-sm px-1 py-0.5', i <= subStep ? 'cursor-pointer' : 'cursor-not-allowed')}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-caption font-semibold',
                        done && 'bg-brand-600 text-white',
                        current && 'bg-brand-600 text-white',
                        !done && !current && 'border border-neutral-300 bg-white text-neutral-400',
                      )}
                    >
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className={cn('text-body-sm', current ? 'font-semibold text-brand-600' : done ? 'text-brand-600' : 'text-neutral-400')}>
                      {label}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>

          {/* 子步骤 2：批量输入 */}
          {subStep === 1 && (
          <SectionCard title="输入邮箱/手机号" bodyClassName="space-y-3">
            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              rows={3}
              placeholder="支持批量粘贴，用逗号/分号/空格/换行分隔，自动去重"
              className="w-full resize-none rounded-md border border-[#DCE4EF] px-3 py-2.5 text-body text-neutral-800 outline-none transition-shadow duration-micro focus:border-brand-500 focus:shadow-input placeholder:text-neutral-400"
            />
            <div className="flex items-center justify-between">
              <span className="text-caption text-neutral-500">已添加 {batchAdded.length} 个账号{batchAdded.length > 0 ? `：${batchAdded.slice(0, 3).join('、')}${batchAdded.length > 3 ? ' 等' : ''}` : ''}</span>
              <div className="flex gap-2">
                <button type="button" onClick={addBatch} className="h-9 rounded-md border border-[#BFD0F2] bg-white px-4 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50">
                  添加账号
                </button>
                <button type="button" onClick={() => setSubStep(2)} className="h-9 rounded-md bg-brand-600 px-4 text-body-sm text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700">
                  下一步
                </button>
              </div>
            </div>
          </SectionCard>
          )}

          {/* 子步骤 3：复制链接 */}
          {subStep === 2 && (
            <SectionCard title="复制试用链接" bodyClassName="flex items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0 text-brand-600" />
              <code className="min-w-0 flex-1 truncate rounded-md bg-surface-soft px-3 py-2 text-body-sm text-neutral-800">{inviteLink}</code>
              <button type="button" onClick={copyLink} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-brand-600 px-3 text-body-sm text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700">
                {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {linkCopied ? '已复制' : '复制'}
              </button>
              <button type="button" onClick={() => setRegenOpen(true)} className="h-9 shrink-0 rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-50">
                重新生成
              </button>
            </SectionCard>
          )}

          {/* 选择团队 */}
          <SectionCard title={`选择团队（已选择 ${selectedTeams.length} 个团队，共 ${totalPeople} 人）`}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {baseTeams.map((t, idx) => {
                const on = selected[t.name]
                return (
                  <motion.button
                    key={t.name}
                    type="button"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, delay: idx * 0.07, ease: EASE }}
                    onClick={() => toggleTeam(t.name)}
                    className={cn(
                      'relative flex h-[88px] flex-col items-start justify-center gap-1 rounded-lg border px-4 text-left transition-all duration-micro ease-brand',
                      on ? 'border-[1.5px] border-brand-500 bg-surface-cardSel' : 'border-neutral-200 bg-white hover:border-brand-300',
                    )}
                  >
                    {on && (
                      <motion.span
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.18, ease: EASE }}
                        className="absolute left-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white"
                      >
                        <Check className="h-3 w-3" />
                      </motion.span>
                    )}
                    <span className={cn('flex h-8 w-8 items-center justify-center rounded-md', TEAM_ICONS[t.name])}>
                      <Users className="h-4 w-4" />
                    </span>
                    <span className="text-body font-semibold text-neutral-950">{t.name}</span>
                    <span className="text-body-sm text-neutral-500">{t.count} 人</span>
                  </motion.button>
                )
              })}
            </div>
          </SectionCard>

          {/* 发送失败批量重试提示条（仅本会话实际发送后出现） */}
          {sentThisSession && failedCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-accent/30 bg-warning-bg px-4 py-2.5">
              <p className="flex items-center gap-2 text-body-sm text-neutral-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                {failedCount} 名成员邀请发送失败，可在表格中逐条重试，或一键全部重试。
              </p>
              <button
                type="button"
                onClick={retryAllFailed}
                disabled={resendingId !== null}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-warning-accent px-3 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', resendingId === '__all__' && 'animate-spin')} />
                {resendingId === '__all__' ? '正在全部重试…' : '全部重试'}
              </button>
            </div>
          )}

          {/* 席位超限预警条（P1-3）：名单区顶部 */}
          {overLimit && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-accent/30 bg-warning-bg px-4 py-2.5">
              <p className="flex items-center gap-2 text-body-sm text-neutral-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                已选 {selectedCount} 人，超出试用席位 {overBy} 人（试用席位 {TRIAL_SEAT_LIMIT}，已激活 {ACTIVATED_MEMBERS}）。请减少邀请人数，或升级套餐扩容。
              </p>
              <button
                type="button"
                onClick={() => navigate('/workspace/settings')}
                className="inline-flex h-8 shrink-0 items-center rounded-md border border-warning-accent/60 bg-white px-3 text-body-sm font-medium text-warning transition-colors duration-micro ease-brand hover:bg-warning-bg"
              >
                升级套餐
              </button>
            </div>
          )}

          {/* 邀请成员表格 */}
          <div ref={tableRef} className="scroll-mt-24">
          <SectionCard
            title={
              pendingOnly
                ? `邀请成员（待处理 ${pendingCount} 人）`
                : demoOff
                  ? `邀请成员（手动添加 ${manualInvitees.length} 人）`
                  : `邀请成员（共 ${visibleInvitees.length} 人）`
            }
            actions={
              <div className="flex items-center gap-2">
                {pendingOnly && (
                  <button type="button" onClick={() => setPendingOnly(false)} className="text-body-sm text-brand-600 hover:underline">
                    显示全部
                  </button>
                )}
                <button type="button" onClick={exportCsv} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#BFD0F2] bg-white px-3 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50">
                  <Download className="h-3.5 w-3.5" />
                  导出名单
                </button>
              </div>
            }
            bodyClassName={demoOff ? undefined : '-mx-5 -mb-5'}
          >
            {demoOff ? (
              /* 空名册（演示数据关闭）：EmptyState + 手动添加邮箱 */
              <div>
                <EmptyState
                  image="/empty-docs.svg"
                  title="邀请名册为空"
                  description="载入演示数据后可查看推荐名单，或直接手动添加同事邮箱"
                  action={
                    <div className="flex w-full max-w-md items-center gap-2">
                      <input
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addManual()}
                        placeholder="输入同事邮箱，如 zhangsan@example.com"
                        className="h-10 flex-1 rounded-md border border-[#DCE4EF] px-3 text-body text-neutral-800 outline-none transition-shadow duration-micro ease-brand placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input"
                      />
                      <button
                        type="button"
                        onClick={addManual}
                        className="h-10 shrink-0 rounded-md bg-brand-600 px-4 text-body-sm text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
                      >
                        添加
                      </button>
                    </div>
                  }
                />
                {manualInvitees.length > 0 && (
                  <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
                    {manualInvitees.map((m) => (
                      <li key={m.id} className={cn('flex h-11 items-center gap-3', !m.checked && !m.sent && 'opacity-50')}>
                        <input
                          type="checkbox"
                          checked={m.checked}
                          disabled={m.sent}
                          onChange={(e) =>
                            setManualInvitees((prev) => prev.map((x) => (x.id === m.id ? { ...x, checked: e.target.checked } : x)))
                          }
                          aria-label={`勾选 ${m.email}`}
                          className="h-4 w-4 accent-brand-600"
                        />
                        <span className="flex-1 truncate text-body-sm text-neutral-800">{m.email}</span>
                        <StatusBadge status={m.sent ? '已发送' : '待发送'} />
                        {m.sent && <span className="text-caption text-neutral-400">刚刚</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
            <>
            <div className={cn('overflow-y-auto', expanded && 'max-h-[480px]')}>
              <table className="w-full text-body-sm">
                <thead className="sticky top-0 bg-surface-soft">
                  <tr className="h-10 text-left text-neutral-500">
                    <th className="pl-5 font-medium">姓名</th>
                    <th className="font-medium">团队</th>
                    <th className="font-medium">邮箱/手机号</th>
                    <th className="font-medium">状态</th>
                    <th className="font-medium">邀请时间</th>
                    <th className="pr-5 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(expanded ? visibleInvitees : visibleInvitees.slice(0, 7)).map((i) => (
                    <tr key={i.id} className="h-11 border-t border-neutral-100 text-neutral-800">
                      <td className="pl-5 font-medium text-neutral-950">{i.name}</td>
                      <td className="text-neutral-500">{i.team}</td>
                      <td>
                        {editingId === i.id ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(i.id)}
                            className="h-9 w-44 rounded-md border border-[#DCE4EF] px-2 text-body-sm outline-none focus:border-brand-500 focus:shadow-input"
                          />
                        ) : (
                          i.contact
                        )}
                      </td>
                      <td>
                        <StatusBadge status={i.status} className={i.status === '发送失败' ? 'bg-danger-bg text-danger' : undefined} />
                      </td>
                      <td className="text-neutral-500">{i.invitedAt ?? '—'}</td>
                      <td className="pr-5 text-right">
                        {editingId === i.id ? (
                          <span className="inline-flex gap-2">
                            <button type="button" onClick={() => saveEdit(i.id)} className="text-brand-600 hover:underline">保存</button>
                            <button type="button" onClick={() => setEditingId(null)} className="text-neutral-400 hover:underline">取消</button>
                          </span>
                        ) : i.status === '待处理' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(i.id)
                              setEditValue(i.contact)
                            }}
                            className="text-brand-600 hover:underline"
                          >
                            完善信息
                          </button>
                        ) : i.status === '发送失败' ? (
                          <button type="button" disabled={resendingId !== null} onClick={() => retryFailed(i.id)} className="inline-flex items-center gap-1 text-danger hover:underline disabled:opacity-50">
                            <RefreshCw className={cn('h-3.5 w-3.5', (resendingId === i.id || resendingId === '__all__') && 'animate-spin')} />
                            重试
                          </button>
                        ) : i.status === '已发送' && (i.name === '李娜' || i.name === '赵敏') ? (
                          <button type="button" disabled={resendingId === i.id} onClick={() => resend(i.id)} className="text-brand-600 hover:underline disabled:opacity-50">
                            {resendingId === i.id ? '发送中…' : '重新发送'}
                          </button>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!expanded && visibleInvitees.length > 7 && (
              <button type="button" onClick={() => setExpanded(true)} className="flex w-full items-center justify-center gap-1 border-t border-neutral-100 py-2.5 text-body-sm text-brand-600 hover:bg-brand-50">
                查看全部 {visibleInvitees.length} 人
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
            </>
            )}
          </SectionCard>
          </div>
        </div>

        {/* 右栏 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.12, ease: EASE }}
          className="flex flex-col gap-4 xl:sticky xl:top-24"
        >
          {/* 上线前确认 */}
          <SectionCard title="上线前确认">
            <dl className="space-y-0">
              {[
                ['助手名称', preflight.assistant],
                ['目标用户', preflight.audience],
                ['可用知识范围', preflight.scope],
              ].map(([k, v]) => (
                <div key={k} className="flex h-9 items-center justify-between text-body-sm">
                  <dt className="text-neutral-500">{k}</dt>
                  <dd className="font-medium text-neutral-950">{v}</dd>
                </div>
              ))}
              <div className="flex h-9 items-center justify-between text-body-sm">
                <dt className="text-neutral-500">可信回答评分</dt>
                <dd className="flex items-center gap-1.5 font-medium text-neutral-950">
                  {preflight.score} 分
                  <StatusBadge status="优秀" />
                </dd>
              </div>
              <div className="flex h-9 items-center justify-between text-body-sm">
                <dt className="text-neutral-500">引用覆盖率</dt>
                <dd className="font-medium text-neutral-950">{preflight.citationCoverage}%</dd>
              </div>
              <div className="flex h-9 items-center justify-between text-body-sm">
                <dt className="text-neutral-500">试用周期</dt>
                <dd className="font-medium text-neutral-950">{settings.period} 天</dd>
              </div>
            </dl>
          </SectionCard>

          {/* 终端体验预览 */}
          <SectionCard title="终端体验预览" bodyClassName="rounded-lg bg-surface-assistant p-3">
            <div className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
                <img src="/avatar-xiaozhi.svg" alt="" className="h-6 w-6 rounded-sm" />
                <span className="text-body-sm font-semibold text-neutral-950">{TERMINAL_PREVIEW.title}</span>
                <span className="flex items-center gap-1 text-caption text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  在线
                </span>
                <span className="ml-auto flex gap-1 text-neutral-400">
                  <Volume2 className="h-3.5 w-3.5" />
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="space-y-2.5 p-3">
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg bg-surface-user px-2.5 py-1.5 text-body-sm text-brand-700">
                    {TERMINAL_PREVIEW.userMsg}
                    <span className="mt-0.5 block text-right text-caption text-neutral-400">10:32 ✓✓</span>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg bg-surface-assistant px-2.5 py-1.5 text-body-sm text-neutral-800">
                    <p className="whitespace-pre-wrap">{TERMINAL_PREVIEW.aiMsg}</p>
                    <div className="mt-2 flex gap-1.5">
                      <button type="button" onClick={() => setCiteDrawer('citations')} className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-caption text-brand-600 hover:bg-brand-50">
                        引用来源 (2) ›
                      </button>
                      <button type="button" onClick={() => setCiteDrawer('docs')} className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-caption text-brand-600 hover:bg-brand-50">
                        相关文档 (3) ›
                      </button>
                    </div>
                    <span className="mt-1 block text-caption text-neutral-400">10:32</span>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </motion.div>
      </div>

      {/* 底部固定操作栏 */}
      <div ref={settingsBarRef} className="sticky bottom-0 z-30 -mx-6 mt-2 border-t border-neutral-200 bg-white px-6 shadow-float">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-6">
            <span className="flex shrink-0 items-center gap-1.5 text-body font-semibold text-neutral-950">
              <Settings2 className="h-4 w-4 text-neutral-500" />
              试用设置
            </span>
            <span className="hidden items-center gap-1.5 text-body-sm text-neutral-500 md:flex">
              试用人数
              <motion.span key={totalPeople} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="text-body font-bold text-brand-600">
                {totalPeople}
              </motion.span>
            </span>
            <label className="hidden items-center gap-1.5 text-body-sm text-neutral-500 lg:flex">
              试用周期
              <select
                value={settings.period}
                onChange={(e) => setSettings((s) => ({ ...s, period: Number(e.target.value) }))}
                className="h-8 rounded-md border border-neutral-200 bg-white px-1.5 text-body-sm font-medium text-neutral-950 outline-none focus:border-brand-500"
              >
                {Array.from({ length: 14 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d} 天</option>
                ))}
              </select>
            </label>
            <label className="hidden items-center gap-1.5 text-body-sm text-neutral-500 xl:flex">
              显示引用
              <Switch checked={settings.showCitations} onChange={(v) => setSettings((s) => ({ ...s, showCitations: v }))} label="显示引用" />
            </label>
            <label className="hidden items-center gap-1.5 text-body-sm text-neutral-500 xl:flex">
              允许反馈
              <Switch checked={settings.allowFeedback} onChange={(v) => setSettings((s) => ({ ...s, allowFeedback: v }))} label="允许反馈" />
            </label>
            <label className="hidden items-center gap-1.5 text-body-sm text-neutral-500 2xl:flex">
              访问方式
              <select
                value={settings.access}
                onChange={(e) => {
                  if (e.target.value === '公开访问') setAccessWarnOpen(true)
                  else setSettings((s) => ({ ...s, access: e.target.value }))
                }}
                className="h-8 rounded-md border border-neutral-200 bg-white px-1.5 text-body-sm font-medium text-neutral-950 outline-none focus:border-brand-500"
              >
                <option>内部访问（登录验证）</option>
                <option>公开访问</option>
              </select>
            </label>
          </div>
          <button
            ref={ctaRef}
            type="button"
            disabled={!sentThisSession && (!hasTargets || overLimit)}
            title={
              !sentThisSession && !hasTargets
                ? demoOff
                  ? '请先手动添加同事邮箱'
                  : '请至少选择 1 个团队'
                : !sentThisSession && overLimit
                  ? `已选 ${selectedCount} 人，超出试用席位 ${overBy} 人（试用席位 ${TRIAL_SEAT_LIMIT}，已激活 ${ACTIVATED_MEMBERS}），请减少邀请人数或升级套餐`
                  : undefined
            }
            onClick={handleCta}
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-gradient-to-r from-brand-500 to-brand-600 px-6 text-body font-semibold text-white transition-all duration-micro ease-brand hover:brightness-105 active:brightness-95',
              !sentThisSession && (!hasTargets || overLimit) && 'cursor-not-allowed bg-none bg-neutral-100 text-neutral-400',
              ctaPulse && 'animate-pulse shadow-focus',
            )}
          >
            {sentThisSession ? (failedCount > 0 ? '全部重试' : '查看发送状态') : `开始 ${settings.period} 天内部试用`}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ConfirmationCard */}
      <Modal open={confirmOpen} onClose={() => !sending && setConfirmOpen(false)} maxWidth="max-w-xl">
        <ConfirmationCard
          title="确认开始 7 天内部试用？"
          fields={[
            { label: '动作', value: `向${selectedTeamNames || '手动添加的同事'}共 ${selectedCount} 名成员发送试用邀请` },
            { label: '影响对象', value: `${preflight.assistant} v1.0` },
            { label: '试用时间', value: `${settings.period} 天` },
            { label: '访问入口', value: 'Web Portal' },
            { label: '知识范围', value: preflight.scope },
            { label: '外部影响', value: `将发送 ${selectedCount} 封邮件/短信` },
            { label: '可撤销性', value: '试用可暂停，已发送邀请无法撤回' },
          ]}
          loading={sending}
          confirmText={sending ? '正在发送邀请…' : '确认执行'}
          onConfirm={doSend}
          onModify={() => {
            setConfirmOpen(false)
            settingsBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      </Modal>

      {/* 待处理成员 Warning */}
      <Modal open={pendingWarnOpen} onClose={() => setPendingWarnOpen(false)} maxWidth="max-w-md">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-float">
          <h3 className="text-h3 text-neutral-950">有成员信息不完整</h3>
          <p className="mt-2 text-body text-neutral-700">{pendingCount} 名成员信息不完整，将暂不发送。你可以先返回补全，或确认继续发送。</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setPendingWarnOpen(false)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">返回补全</button>
            <button type="button" onClick={() => { setPendingWarnOpen(false); setConfirmOpen(true) }} className="h-10 rounded-md bg-brand-600 px-5 text-body font-medium text-white hover:bg-brand-500 active:bg-brand-700">
              仍然发送
            </button>
          </div>
        </div>
      </Modal>

      {/* 公开访问 L3 确认 */}
      <Modal open={accessWarnOpen} onClose={() => setAccessWarnOpen(false)} maxWidth="max-w-md">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-float">
          <h3 className="text-h3 text-neutral-950">切换为公开访问？</h3>
          <p className="mt-2 text-body text-neutral-700">公开访问将允许未登录用户查看知识内容。安全预检提示：当前知识范围包含内部资料，建议保持「内部访问（登录验证）」。</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setAccessWarnOpen(false)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">保持内部访问</button>
            <button
              type="button"
              onClick={() => {
                setSettings((s) => ({ ...s, access: '公开访问' }))
                setAccessWarnOpen(false)
                toast.warning('已切换为公开访问，请注意知识范围安全')
              }}
              className="h-10 rounded-md bg-danger px-5 text-body font-medium text-white hover:brightness-105"
            >
              确认切换
            </button>
          </div>
        </div>
      </Modal>

      {/* 重新生成链接确认 */}
      <Modal open={regenOpen} onClose={() => setRegenOpen(false)} maxWidth="max-w-md">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-float">
          <h3 className="text-h3 text-neutral-950">重新生成试用链接？</h3>
          <p className="mt-2 text-body text-neutral-700">重新生成后，旧链接将立即失效，已分享的同事需要使用新链接加入。</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setRegenOpen(false)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">取消</button>
            <button
              type="button"
              onClick={() => {
                setInviteLink(makeInviteLink())
                setLinkCopied(false)
                setRegenOpen(false)
                toast.success('已生成新的试用链接，旧链接已失效')
              }}
              className="h-10 rounded-md bg-brand-600 px-5 text-body font-medium text-white hover:bg-brand-500"
            >
              确认重新生成
            </button>
          </div>
        </div>
      </Modal>

      {/* 终端预览：引用来源 / 相关文档抽屉（引用口径与验证答案页折扣审批答案一致，只读 import base.mock） */}
      <SideDrawer
        open={citeDrawer !== null}
        onClose={() => setCiteDrawer(null)}
        title={citeDrawer === 'citations' ? `引用来源（${answer.docs.length}）` : `相关文档（${answer.docs.length}）`}
        width={440}
      >
        <div className="flex flex-col gap-3 p-5">
          <p className="text-body-sm text-neutral-500">
            {citeDrawer === 'citations' ? '该回答引用了以下文档片段：' : '与该问题相关的文档：'}
          </p>
          {answer.docs.map((d) => (
            <div key={d.name} className="rounded-lg border border-neutral-200 bg-white p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-body-sm font-semibold text-neutral-950">{d.name}</span>
                {d.tag && <StatusBadge status={d.tag} />}
              </div>
              <p className="mt-1 text-caption text-neutral-500">
                {d.version} · {d.page}
              </p>
            </div>
          ))}
        </div>
      </SideDrawer>
    </div>
  )
}
