/**
 * 设置中心（/workspace/settings）— settings.md（按任务要求 5 分组）
 * 企业信息 / 成员与权限 / 套餐与用量 / 集成与安全 / 演示数据。
 * 高风险操作（重置演示数据 / 角色降级 / MFA 开启 / 吊销 API Key）一律弹 ConfirmationCard。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  Building2,
  Compass,
  Copy,
  Download,
  KeyRound,
  Plug,
  RefreshCcw,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { connectors, org, plan, useAppStore } from '@/mocks'
import { SectionCard } from '@/components/common/SectionCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ProgressBar } from '@/components/common/ProgressBar'
import { ConfirmationCard } from '@/components/common/ConfirmationCard'
import { Modal } from './workspace/Modal'
import { SideDrawer } from './workspace/SideDrawer'
import { PageHeader } from './workspace/PageHeader'
import { useAppToast } from '@/lib/toast'
import { KEY_NAMESPACE, loadLS, saveLS } from '@/lib/storage'
import type { ApiKeyItem, MemberItem } from './workspace/settings.mock'
import {
  apiKeys as initialApiKeys,
  apiKeyScopes,
  auditLogs,
  industries,
  initialIpWhitelist,
  initialNotifyMatrix,
  members as initialMembers,
  notifyChannels,
  notifyEvents,
  planMatrix,
  roleTemplates,
  usageItems,
  webhookEvents,
} from './workspace/settings.mock'
import { ALL_ROLES, type CoreRole } from './workspace/permissionsData'

type GroupKey = 'org' | 'members' | 'plan' | 'security' | 'notifications' | 'demo'

const GROUPS: { key: GroupKey; label: string; icon: typeof Building2 }[] = [
  { key: 'org', label: '企业信息', icon: Building2 },
  { key: 'members', label: '成员与权限', icon: Users },
  { key: 'plan', label: '套餐与用量', icon: Wallet },
  { key: 'security', label: '集成与安全', icon: ShieldCheck },
  { key: 'notifications', label: '通知偏好', icon: Bell },
  { key: 'demo', label: '演示数据', icon: RefreshCcw },
]

const ORG_LS_KEY = KEY_NAMESPACE.settings.orgProfile
// 独立命名空间：ApiDev 页的 ApiKey 结构不同（maskedKey/permissions[]），不得共用同一键（V2 评审 P0 白屏根因）
const APIKEYS_LS_KEY = KEY_NAMESPACE.settings.apiKeys

/** 触发浏览器真实下载（CSV） */
function downloadCsv(filename: string, header: string, rows: string[][]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const csv = [header, ...rows.map((r) => r.map(esc).join(','))].join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const inputCls =
  'h-10 w-full rounded-md border border-[#DCE4EF] bg-white px-3 text-body text-neutral-800 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:shadow-input'
const selectCls =
  'h-10 rounded-md border border-[#DCE4EF] bg-white px-2.5 text-body-sm text-neutral-700 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:shadow-input'
const secondaryBtn =
  'inline-flex h-10 items-center gap-1.5 rounded-md border border-[#BFD0F2] bg-white px-4 text-body text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50'
const primaryBtn =
  'inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-5 text-body font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700'

/** 角色权限等级：ALL_ROLES（6 核心角色）下标越大权限越低，管理员=0 权限最高 */
function roleRank(role: string) {
  const idx = ALL_ROLES.indexOf(role as CoreRole)
  return idx === -1 ? ALL_ROLES.length : idx
}

export default function Settings() {
  const navigate = useNavigate()
  const { state, loadDemoData, resetDemoData } = useAppStore()
  const toast = useAppToast()
  /** 演示数据模式：false=空态起点 */
  const demoOff = state.demoData === false

  const [group, setGroup] = useState<GroupKey>('org')

  // 企业信息（localStorage 持久：ekb-org-profile，重新进入恢复）
  const defaultOrgForm = {
    name: org.name,
    industry: org.industry,
    contact: 'zhangsan@example.com',
    intro: '专注企业级软件与信息技术服务的示例公司。',
    logo: '',
  }
  const [orgSaved, setOrgSaved] = useState(() => ({ ...defaultOrgForm, ...loadLS<Partial<typeof defaultOrgForm>>(ORG_LS_KEY, {}) }))
  const [orgForm, setOrgForm] = useState(orgSaved)
  const orgDirty = JSON.stringify(orgForm) !== JSON.stringify(orgSaved)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  // 成员与权限
  const [memberList, setMemberList] = useState<MemberItem[]>(initialMembers)
  const [memberQuery, setMemberQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('全部角色')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteText, setInviteText] = useState('')
  const [inviteRole, setInviteRole] = useState('普通成员')
  const [inviteDept, setInviteDept] = useState('销售团队')
  const [editTarget, setEditTarget] = useState<MemberItem | null>(null)
  const [editRole, setEditRole] = useState('')
  const [downgradeConfirm, setDowngradeConfirm] = useState<{ member: MemberItem; role: string } | null>(null)
  const [downgradeInput, setDowngradeInput] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [permAuditOpen, setPermAuditOpen] = useState(false)

  // 套餐
  const [planOpen, setPlanOpen] = useState(false)
  const [freeDowngradeConfirm, setFreeDowngradeConfirm] = useState(false)

  // 集成与安全
  const [mfaOn, setMfaOn] = useState(false)
  const [mfaConfirm, setMfaConfirm] = useState(false)
  const [externalOn, setExternalOn] = useState(false)
  const [externalConfirm, setExternalConfirm] = useState(false)
  const [sessionDays, setSessionDays] = useState('30 天')
  const [ssoOpen, setSsoOpen] = useState(false)
  const [ssoProtocol, setSsoProtocol] = useState<'SAML 2.0' | 'OIDC'>('SAML 2.0')
  const [ssoMetadata, setSsoMetadata] = useState('')
  const [ssoSaved, setSsoSaved] = useState<{ protocol: string; metadata: string } | null>(null)
  const [ipOpen, setIpOpen] = useState(false)
  const [ipList, setIpList] = useState<string[]>(initialIpWhitelist)
  const [ipInput, setIpInput] = useState('')
  const [connectorList, setConnectorList] = useState(() => [
    ...connectors,
    { name: '语雀知识库', connected: false },
    { name: 'Notion', connected: false },
  ])
  const [disconnectTarget, setDisconnectTarget] = useState<string | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>(() => loadLS(APIKEYS_LS_KEY, initialApiKeys))
  const [newKey, setNewKey] = useState<string | null>(null)
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [keyScope, setKeyScope] = useState(apiKeyScopes[0])
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)
  const [revokeInput, setRevokeInput] = useState('')
  const [webhookOpen, setWebhookOpen] = useState(false)
  const [webhookSelected, setWebhookSelected] = useState<string[]>([])
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSaved, setWebhookSaved] = useState<string[]>([])
  const [webhookSavedUrl, setWebhookSavedUrl] = useState('')

  // 通知偏好
  const [notifyMatrix, setNotifyMatrix] = useState<Record<string, Record<string, boolean>>>(initialNotifyMatrix)

  useEffect(() => {
    saveLS(APIKEYS_LS_KEY, apiKeys)
  }, [apiKeys])

  // 演示数据
  const [resetConfirm, setResetConfirm] = useState(false)

  const filteredMembers = useMemo(
    () =>
      memberList.filter((m) => {
        if (memberQuery.trim() && !`${m.name}${m.contact}`.includes(memberQuery.trim())) return false
        if (roleFilter !== '全部角色' && m.role !== roleFilter) return false
        return true
      }),
    [memberList, memberQuery, roleFilter],
  )

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label}已复制到剪贴板。`)
    } catch {
      toast.warning('复制失败，请手动选择复制。')
    }
  }

  const saveOrg = () => {
    setOrgSaved(orgForm)
    saveLS(ORG_LS_KEY, orgForm)
    toast.success('已保存，企业信息已更新（本地持久化）。')
  }

  const pickLogo = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.warning('请选择图片文件作为企业 Logo。')
      return
    }
    if (file.size > 500 * 1024) {
      toast.warning('Logo 图片不能超过 500KB。')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setOrgForm((f) => ({ ...f, logo: String(reader.result) }))
    reader.readAsDataURL(file)
  }

  /** 批量导入：解析粘贴的邮箱列表并校验 */
  const importRows = useMemo(() => {
    const tokens = importText
      .split(/[\n,;，；\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const existing = new Set(memberList.map((m) => m.contact))
    const seen = new Set<string>()
    return tokens.map((contact) => {
      let reason = ''
      if (!EMAIL_RE.test(contact)) reason = '邮箱格式无效'
      else if (existing.has(contact)) reason = '已存在成员'
      else if (seen.has(contact)) reason = '列表内重复'
      seen.add(contact)
      return { contact, valid: reason === '', reason }
    })
  }, [importText, memberList])

  const confirmImport = () => {
    const valid = importRows.filter((r) => r.valid)
    if (valid.length === 0) {
      toast.warning('没有可导入的有效邮箱。')
      return
    }
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const added: MemberItem[] = valid.map((r, i) => ({
      id: `m-import-${Date.now()}-${i}`,
      name: r.contact.split('@')[0],
      avatar: (r.contact[0] ?? '员').toUpperCase(),
      contact: r.contact,
      department: '销售团队',
      role: '普通成员',
      roleTone: 'normal',
      status: '待激活',
      joinedAt: date,
    }))
    setMemberList((prev) => [...prev, ...added])
    setImportOpen(false)
    setImportText('')
    toast.success(`已导入 ${added.length} 名成员（待激活），邀请邮件已发送。`)
  }

  const reinvite = (m: MemberItem) => {
    setMemberList((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: '已邀请' } : x)))
    toast.success(`已向 ${m.name} 重新发送邀请，状态更新为「已邀请」。`)
  }

  const exportFullAuditCsv = () => {
    downloadCsv(
      '设置中心审计日志.csv',
      '时间,成员,动作,对象,结果',
      auditLogs.map((l) => [l.time, l.member, l.action, l.target, l.result]),
    )
    toast.success(`已导出 ${auditLogs.length} 条审计日志（CSV）。`)
  }

  const sendInvites = () => {
    const contacts = inviteText
      .split(/[\n,;，；\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const existing = new Set(memberList.map((m) => m.contact))
    const fresh = [...new Set(contacts)].filter((c) => !existing.has(c))
    if (fresh.length === 0) {
      toast.warning('没有可邀请的新成员（已去重）。')
      return
    }
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const added: MemberItem[] = fresh.map((c, i) => ({
      id: `m-new-${Date.now()}-${i}`,
      name: c.split('@')[0] || c,
      avatar: (c[0] ?? '员').toUpperCase(),
      contact: c,
      department: inviteDept,
      role: inviteRole,
      roleTone: 'normal',
      status: '待激活',
      joinedAt: date,
    }))
    setMemberList((prev) => [...prev, ...added])
    setInviteOpen(false)
    setInviteText('')
    toast.success(`已发送 ${added.length} 份邀请，成员状态为待激活。`)
  }

  const submitRoleChange = () => {
    if (!editTarget) return
    if (roleRank(editRole) > roleRank(editTarget.role)) {
      // 角色降级 = L4：输入成员姓名确认
      setDowngradeConfirm({ member: editTarget, role: editRole })
      setDowngradeInput('')
      return
    }
    applyRoleChange(editTarget, editRole)
  }

  const applyRoleChange = (member: MemberItem, role: string) => {
    setMemberList((prev) => prev.map((m) => (m.id === member.id ? { ...m, role, roleTone: role === '管理员' ? 'admin' : 'normal' } : m)))
    setEditTarget(null)
    setDowngradeConfirm(null)
    toast.success(`已将 ${member.name} 的角色调整为「${role}」。`)
  }

  const createApiKey = () => {
    const key = `sk-live-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`
    setNewKey(key)
    setApiKeys((prev) => [
      ...prev,
      {
        id: `key-${Date.now()}`,
        name: keyName.trim(),
        scope: keyScope,
        masked: `sk-live-••••${key.slice(-4)}`,
        createdAt: '今天',
        lastCalledAt: '—',
      },
    ])
    setCreateKeyOpen(false)
    setKeyName('')
    setKeyScope(apiKeyScopes[0])
    toast.success('API Key 已创建，明文仅展示一次，请立即保存。')
  }

  const saveSso = () => {
    setSsoSaved({ protocol: ssoProtocol, metadata: ssoMetadata.trim() })
    setSsoOpen(false)
    toast.success(`SSO 已保存（${ssoProtocol}），元数据将在后台完成校验。`)
  }

  const addIp = () => {
    const v = ipInput.trim()
    if (!CIDR_RE.test(v)) {
      toast.warning('请输入合法的 IP 或 CIDR（如 203.0.113.10 或 203.0.113.0/24）。')
      return
    }
    if (ipList.includes(v)) {
      toast.warning('该 IP 段已在白名单中。')
      return
    }
    setIpList((prev) => [...prev, v])
    setIpInput('')
    toast.success(`已将 ${v} 加入 IP 白名单。`)
  }

  const removeIp = (ip: string) => {
    setIpList((prev) => prev.filter((x) => x !== ip))
    toast.info(`已将 ${ip} 从白名单移除。`)
  }

  const toggleConnector = (name: string, connected: boolean) => {
    setConnectorList((prev) => prev.map((c) => (c.name === name ? { ...c, connected } : c)))
  }

  const saveWebhook = () => {
    setWebhookSaved(webhookSelected)
    setWebhookSavedUrl(webhookUrl.trim())
    setWebhookOpen(false)
    toast.success(`Webhook 已保存：${webhookUrl.trim()}，订阅 ${webhookSelected.length} 类事件。`)
  }

  const switchCls = (on: boolean) =>
    cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-comp ease-brand', on ? 'bg-brand-600' : 'bg-neutral-300')

  return (
    <div className="space-y-4">
      {/* 标题区 */}
      <PageHeader crumbs={['运营与分析', '设置中心']} title="设置中心" subtitle="管理企业信息、成员权限、套餐用量与安全策略" />

      <div className="flex items-start gap-6">
        {/* 左分组导航 */}
        <nav className="sticky top-24 w-[220px] shrink-0 rounded-xl border border-neutral-200 bg-white p-2.5 shadow-card">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGroup(g.key)}
              className={cn(
                'flex h-10 w-full items-center gap-2 rounded-md px-3 text-body transition-colors duration-micro ease-brand',
                group === g.key ? 'bg-brand-100 font-medium text-brand-600' : 'text-neutral-700 hover:bg-neutral-100',
              )}
            >
              <g.icon className="h-4 w-4 shrink-0" />
              {g.label}
            </button>
          ))}
        </nav>

        {/* 右内容 */}
        <div className="min-w-0 max-w-[860px] flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={group}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {/* ============ 企业信息 ============ */}
              {group === 'org' && (
                <>
                  <SectionCard title="基本信息" icon={<Building2 className="h-5 w-5" />}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">企业名称</label>
                        <input value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} className={inputCls} maxLength={100} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">行业</label>
                        <select value={orgForm.industry} onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })} className={cn(selectCls, 'w-full')}>
                          {industries.map((i) => (
                            <option key={i}>{i}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">联系方式</label>
                        <input value={orgForm.contact} onChange={(e) => setOrgForm({ ...orgForm, contact: e.target.value })} className={inputCls} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">企业 Logo</label>
                        <div className="flex h-10 items-center gap-2.5">
                          <img src={orgForm.logo || '/logo.svg'} alt="企业 Logo" className="h-9 w-9 rounded-md object-cover" />
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              pickLogo(e.target.files?.[0])
                              e.target.value = ''
                            }}
                          />
                          <button type="button" onClick={() => logoInputRef.current?.click()} className={cn(secondaryBtn, 'h-9 px-3 text-body-sm')}>
                            <Upload className="h-4 w-4" />
                            更换
                          </button>
                          {orgForm.logo && (
                            <button
                              type="button"
                              onClick={() => setOrgForm({ ...orgForm, logo: '' })}
                              className="text-body-sm text-neutral-400 hover:text-neutral-600"
                            >
                              恢复默认
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">企业简介（≤200 字）</label>
                        <textarea
                          value={orgForm.intro}
                          onChange={(e) => setOrgForm({ ...orgForm, intro: e.target.value.slice(0, 200) })}
                          rows={3}
                          className="w-full resize-none rounded-md border border-[#DCE4EF] bg-white px-3 py-2 text-body text-neutral-800 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:shadow-input"
                        />
                        <p className="mt-1 text-right text-caption text-neutral-400">{orgForm.intro.length}/200</p>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end border-t border-neutral-100 pt-4">
                      <button
                        type="button"
                        disabled={!orgDirty}
                        onClick={saveOrg}
                        className={cn(primaryBtn, !orgDirty && 'cursor-not-allowed bg-neutral-100 text-neutral-400 hover:bg-neutral-100')}
                      >
                        保存修改
                      </button>
                    </div>
                  </SectionCard>

                  <SectionCard title="试用与升级">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex h-7 items-center rounded-pill bg-warning-bg px-2.5 text-caption font-medium text-warning">试用版 · 有效期至 2025-06-03</span>
                      <div className="min-w-[220px] flex-1">
                        <div className="mb-1 flex justify-between text-caption text-neutral-500">
                          <span>试用进度</span>
                          <span className="text-warning">剩余 2 天</span>
                        </div>
                        <ProgressBar value={86} barClassName="bg-warning-accent" />
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={() => setPlanOpen(true)} className={secondaryBtn}>
                        查看套餐对比
                      </button>
                      <button type="button" onClick={() => setPlanOpen(true)} className={primaryBtn}>
                        升级专业版
                      </button>
                    </div>
                  </SectionCard>
                </>
              )}

              {/* ============ 成员与权限 ============ */}
              {group === 'members' && (
                <>
                  <SectionCard title={`成员（${memberList.length}）`} icon={<Users className="h-5 w-5" />}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <input
                        value={memberQuery}
                        onChange={(e) => setMemberQuery(e.target.value)}
                        placeholder="搜索成员姓名或联系方式…"
                        className={cn(inputCls, 'w-56')}
                      />
                      <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectCls} title="角色筛选">
                        <option>全部角色</option>
                        {ALL_ROLES.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setImportOpen(true)} className={secondaryBtn}>
                        批量导入
                      </button>
                      <button type="button" onClick={() => setInviteOpen(true)} className={cn(primaryBtn, 'ml-auto')}>
                        <UserPlus className="h-4 w-4" />
                        邀请成员
                      </button>
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="h-10 bg-surface-soft text-body-sm text-neutral-500">
                          <th className="rounded-l-md pl-2 font-medium">成员</th>
                          <th className="font-medium">部门</th>
                          <th className="font-medium">角色</th>
                          <th className="font-medium">状态</th>
                          <th className="font-medium">加入时间</th>
                          <th className="rounded-r-md pr-2 text-right font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMembers.map((m) => (
                          <tr key={m.id} className="h-11 border-b border-neutral-100 text-body-sm last:border-b-0 hover:bg-neutral-50">
                            <td className="pl-2">
                              <span className="flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-caption font-semibold text-brand-600">{m.avatar}</span>
                                <span>
                                  <span className="block font-medium text-neutral-950">{m.name}</span>
                                  <span className="block text-caption text-neutral-400">{m.contact}</span>
                                </span>
                              </span>
                            </td>
                            <td className="text-neutral-700">{m.department}</td>
                            <td>
                              <span className={cn('inline-flex h-6 items-center rounded-pill px-2 text-caption font-medium', m.roleTone === 'admin' ? 'bg-info-bg text-info' : 'bg-neutral-100 text-neutral-600')}>
                                {m.role}
                              </span>
                            </td>
                            <td>
                              {m.status === '活跃' ? (
                                <span className="inline-flex items-center gap-1.5 text-body-sm text-success">
                                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                  活跃
                                </span>
                              ) : m.status === '已邀请' ? (
                                <span className="inline-flex items-center gap-1.5 text-body-sm text-info">
                                  <span className="h-1.5 w-1.5 rounded-full bg-info" />
                                  已邀请
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-body-sm text-warning">
                                  <span className="h-1.5 w-1.5 rounded-full bg-warning-accent" />
                                  待激活
                                </span>
                              )}
                            </td>
                            <td className="text-caption text-neutral-500">{m.joinedAt}</td>
                            <td className="pr-2 text-right">
                              {m.status !== '活跃' ? (
                                <button type="button" onClick={() => reinvite(m)} className="text-body-sm font-medium text-brand-600 hover:text-brand-700">
                                  重新邀请
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditTarget(m)
                                    setEditRole(m.role)
                                  }}
                                  className="text-body-sm font-medium text-brand-600 hover:text-brand-700"
                                >
                                  编辑
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </SectionCard>

                  <SectionCard title="权限摘要">
                    <p className="text-body text-neutral-700">空间权限 3 个空间已配置 · 助手权限 2 个助手 · 外部访客 0 人</p>
                    <button type="button" onClick={() => setPermAuditOpen(true)} className="mt-2 text-body-sm text-brand-600 hover:text-brand-700">
                      权限审计 ›
                    </button>
                  </SectionCard>
                </>
              )}

              {/* ============ 套餐与用量 ============ */}
              {group === 'plan' && (
                <>
                  <SectionCard title="当前套餐" icon={<Wallet className="h-5 w-5" />} actions={<button type="button" onClick={() => setPlanOpen(true)} className={secondaryBtn}>续费/升级</button>}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-h3 text-neutral-950">{plan.name}</span>
                      <StatusBadge status="已发布" className="bg-success-bg text-success" />
                      <span className="text-body-sm text-neutral-500">有效期至 {plan.validUntil}</span>
                      <span className="text-caption text-neutral-400">当前为试用升级路径，升级后数据与配置全部保留。</span>
                    </div>
                  </SectionCard>

                  <div className="grid grid-cols-2 gap-4">
                    {usageItems.map((u, i) => {
                      const warn = u.pct !== null && u.pct >= 80
                      return (
                        <motion.div
                          key={u.name}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.24, delay: i * 0.06 }}
                          className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-body-sm text-neutral-500">{u.name}</span>
                            {u.pct !== null && <span className={cn('text-caption font-medium', warn ? 'text-warning' : 'text-neutral-400')}>{u.pct}%</span>}
                          </div>
                          <p className="mt-1.5 text-body-lg font-semibold text-neutral-950">
                            {u.current} <span className="text-body-sm font-normal text-neutral-400">/ {u.limit}</span>
                          </p>
                          {u.pct !== null && (
                            <div className="mt-2.5">
                              <ProgressBar value={u.pct} barClassName={warn ? 'bg-warning-accent' : undefined} />
                            </div>
                          )}
                          {u.warning && (
                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2.5 rounded-md bg-warning-bg px-2.5 py-1.5 text-caption text-warning">
                              {u.warning}
                            </motion.p>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* ============ 集成与安全 ============ */}
              {group === 'security' && (
                <>
                  <SectionCard title="安全设置" icon={<ShieldCheck className="h-5 w-5" />}>
                    <ul>
                      <li className="flex h-14 items-center gap-3 border-b border-neutral-100">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-success-bg text-success">
                          <KeyRound className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-body font-medium text-neutral-950">单点登录（SSO）</p>
                          <p className="text-caption text-neutral-500">企业统一身份认证与权限同步</p>
                        </div>
                        <span className="inline-flex h-6 items-center rounded-pill bg-success-bg px-2 text-caption font-medium text-success">
                          已启用{ssoSaved ? ` · ${ssoSaved.protocol}` : ''}
                        </span>
                        <button type="button" onClick={() => setSsoOpen(true)} className="text-body-sm text-brand-600 hover:text-brand-700">
                          管理
                        </button>
                      </li>
                      <li className="flex h-14 items-center gap-3 border-b border-neutral-100">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                          <ShieldCheck className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-body font-medium text-neutral-950">双因素认证（MFA）</p>
                          <p className="text-caption text-neutral-500">开启后全部 12 名成员登录需二次验证</p>
                        </div>
                        <button type="button" role="switch" aria-checked={mfaOn} onClick={() => (mfaOn ? setMfaOn(false) : setMfaConfirm(true))} className={switchCls(mfaOn)}>
                          <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-comp ease-brand', mfaOn ? 'translate-x-[22px]' : 'translate-x-0.5')} />
                        </button>
                      </li>
                      <li className="flex h-14 items-center gap-3 border-b border-neutral-100">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 text-neutral-500">
                          <Plug className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-body font-medium text-neutral-950">登录 IP 限制</p>
                          <p className="text-caption text-neutral-500">仅允许白名单 IP 段访问工作台</p>
                        </div>
                        <span className="text-caption text-neutral-400">{ipList.length > 0 ? `已配置 ${ipList.length} 条` : '未配置'}</span>
                        <button type="button" onClick={() => setIpOpen(true)} className="text-body-sm text-brand-600 hover:text-brand-700">
                          配置
                        </button>
                      </li>
                      <li className="flex h-14 items-center gap-3 border-b border-neutral-100">
                        <div className="min-w-0 flex-1 pl-12">
                          <p className="text-body font-medium text-neutral-950">会话保留时长</p>
                          <p className="text-caption text-neutral-500">超过时长未活动需重新登录</p>
                        </div>
                        <select
                          value={sessionDays}
                          onChange={(e) => {
                            setSessionDays(e.target.value)
                            toast.success(`会话保留时长已更新为 ${e.target.value}，对全部成员生效。`)
                          }}
                          className={selectCls}
                          title="会话保留时长"
                        >
                          <option>7 天</option>
                          <option>30 天</option>
                          <option>90 天</option>
                        </select>
                      </li>
                      <li className="flex h-14 items-center gap-3">
                        <div className="min-w-0 flex-1 pl-12">
                          <p className="text-body font-medium text-neutral-950">外部访问</p>
                          <p className="text-caption text-neutral-500">开启需通过安全预检（L3 确认）</p>
                        </div>
                        <button type="button" role="switch" aria-checked={externalOn} onClick={() => (externalOn ? setExternalOn(false) : setExternalConfirm(true))} className={switchCls(externalOn)}>
                          <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-comp ease-brand', externalOn ? 'translate-x-[22px]' : 'translate-x-0.5')} />
                        </button>
                      </li>
                    </ul>
                  </SectionCard>

                  <SectionCard
                    title="集成连接"
                    icon={<Plug className="h-5 w-5" />}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      {connectorList.map((c) => (
                        <div key={c.name} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3.5">
                          <span className={cn('flex h-9 w-9 items-center justify-center rounded-md', c.connected ? 'bg-success-bg text-success' : 'bg-neutral-100 text-neutral-400')}>
                            <Plug className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-body-sm font-medium text-neutral-950">{c.name}</p>
                            <StatusBadge status={c.connected ? '已连接' : '未连接'} className="mt-0.5" />
                          </div>
                          {c.connected ? (
                            <button type="button" onClick={() => setDisconnectTarget(c.name)} className="text-body-sm text-danger hover:brightness-110">
                              断开
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                toggleConnector(c.name, true)
                                toast.success(`「${c.name}」连接成功，已开启同步。`)
                              }}
                              className="text-body-sm text-brand-600 hover:text-brand-700"
                            >
                              连接
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="API Key"
                    icon={<KeyRound className="h-5 w-5" />}
                    actions={
                      <>
                        <button type="button" onClick={() => navigate('/workspace/api-dev')} className={secondaryBtn}>
                          查看文档
                        </button>
                        <button type="button" onClick={() => setCreateKeyOpen(true)} className={primaryBtn}>
                          + 创建 API Key
                        </button>
                      </>
                    }
                  >
                    {newKey && (
                      <div className="mb-3 rounded-lg border border-warning-accent bg-warning-bg p-3.5">
                        <p className="text-body-sm font-medium text-neutral-900">新 Key 仅展示一次，请立即保存：</p>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 truncate rounded-md bg-white px-3 py-2 text-body-sm text-neutral-800">{newKey}</code>
                          <button type="button" onClick={() => copy(newKey, 'API Key ')} className={cn(secondaryBtn, 'h-9 px-3 text-body-sm')}>
                            <Copy className="h-4 w-4" />
                            复制
                          </button>
                          <button type="button" onClick={() => setNewKey(null)} className="h-9 rounded-md px-3 text-body-sm text-neutral-500 hover:bg-white">
                            我已保存
                          </button>
                        </div>
                      </div>
                    )}
                    <table className="w-full text-left">
                      <thead>
                        <tr className="h-10 bg-surface-soft text-body-sm text-neutral-500">
                          <th className="rounded-l-md pl-2 font-medium">名称</th>
                          <th className="font-medium">Key</th>
                          <th className="font-medium">权限</th>
                          <th className="font-medium">创建时间</th>
                          <th className="font-medium">最近调用</th>
                          <th className="rounded-r-md pr-2 text-right font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiKeys.map((k) => (
                          <tr key={k.id} className="h-11 border-b border-neutral-100 text-body-sm last:border-b-0">
                            <td className="pl-2 font-medium text-neutral-950">{k.name}</td>
                            <td className="font-mono text-neutral-800">{k.masked}</td>
                            <td className="text-neutral-500">{k.scope}</td>
                            <td className="text-neutral-500">{k.createdAt}</td>
                            <td className="text-neutral-500">{k.lastCalledAt}</td>
                            <td className="pr-2 text-right">
                              <button type="button" onClick={() => copy(k.masked, 'API Key（脱敏）')} className="mr-3 text-body-sm text-brand-600 hover:text-brand-700">
                                复制
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRevokeTarget(k.id)
                                  setRevokeInput('')
                                }}
                                className="text-body-sm text-danger hover:brightness-110"
                              >
                                吊销
                              </button>
                            </td>
                          </tr>
                        ))}
                        {apiKeys.length === 0 && (
                          <tr>
                            <td colSpan={6} className="h-16 text-center text-body-sm text-neutral-400">
                              暂无 API Key，点击右上角创建。
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </SectionCard>

                  <SectionCard title="Webhook">
                    {webhookSaved.length === 0 ? (
                      <p className="text-body-sm text-neutral-500">未配置 Webhook。</p>
                    ) : (
                      <div className="text-body-sm text-neutral-700">
                        <p>
                          回调地址：<code className="rounded bg-surface-soft px-1.5 py-0.5 font-mono text-neutral-800">{webhookSavedUrl}</code>
                        </p>
                        <p className="mt-1">已订阅事件：{webhookSaved.join('、')}</p>
                      </div>
                    )}
                    <button type="button" onClick={() => setWebhookOpen(true)} className={cn(secondaryBtn, 'mt-3')}>
                      {webhookSaved.length === 0 ? '添加 Webhook' : '编辑 Webhook'}
                    </button>
                  </SectionCard>

                  <SectionCard title="审计日志" actions={<button type="button" onClick={exportFullAuditCsv} className={secondaryBtn}><Download className="h-4 w-4" />导出完整日志</button>}>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="h-10 bg-surface-soft text-body-sm text-neutral-500">
                          <th className="rounded-l-md pl-2 font-medium">时间</th>
                          <th className="font-medium">成员</th>
                          <th className="font-medium">动作</th>
                          <th className="font-medium">对象</th>
                          <th className="rounded-r-md pr-2 font-medium">结果</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((l, i) => (
                          <tr key={i} className="h-10 border-b border-neutral-100 text-body-sm last:border-b-0 hover:bg-neutral-50">
                            <td className="pl-2 text-neutral-500">{l.time}</td>
                            <td className="text-neutral-800">{l.member}</td>
                            <td className="text-neutral-800">{l.action}</td>
                            <td className="text-neutral-500">{l.target}</td>
                            <td className="pr-2 text-success">{l.result}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </SectionCard>

                  <div className="rounded-xl border border-neutral-200 bg-surface-soft p-4 text-body-sm text-neutral-500">
                    数据安全说明：企业数据仅用于本企业的知识问答，不用于模型训练；传输与存储全程加密；权限按组织架构与空间实时同步，未授权内容不会出现在任何答案中。
                  </div>
                </>
              )}

              {/* ============ 通知偏好 ============ */}
              {group === 'notifications' && (
                <SectionCard title="通知偏好" icon={<Bell className="h-5 w-5" />}>
                  <p className="mb-3 text-body-sm text-neutral-500">按事件选择接收通知的渠道，保存后立即生效。</p>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-10 bg-surface-soft text-body-sm text-neutral-500">
                        <th className="rounded-l-md pl-3 font-medium">事件</th>
                        {notifyChannels.map((c) => (
                          <th key={c} className="px-3 text-center font-medium last:rounded-r-md">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {notifyEvents.map((ev) => (
                        <tr key={ev} className="h-12 border-b border-neutral-100 last:border-b-0">
                          <td className="pl-3 text-body-sm font-medium text-neutral-950">{ev}</td>
                          {notifyChannels.map((ch) => {
                            const on = notifyMatrix[ev]?.[ch] ?? false
                            return (
                              <td key={ch} className="px-3 text-center">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={on}
                                  aria-label={`${ev} · ${ch}`}
                                  onClick={() =>
                                    setNotifyMatrix((prev) => ({
                                      ...prev,
                                      [ev]: { ...prev[ev], [ch]: !on },
                                    }))
                                  }
                                  className={cn(
                                    'relative inline-flex h-6 w-11 rounded-full align-middle transition-colors duration-comp ease-brand',
                                    on ? 'bg-brand-600' : 'bg-neutral-300',
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-comp ease-brand',
                                      on ? 'translate-x-[22px]' : 'translate-x-0.5',
                                    )}
                                  />
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 flex justify-end border-t border-neutral-100 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        const enabled = notifyEvents.reduce(
                          (n, ev) => n + notifyChannels.filter((ch) => notifyMatrix[ev]?.[ch]).length,
                          0,
                        )
                        toast.success(`通知偏好已保存（共启用 ${enabled} 项渠道订阅）。`)
                      }}
                      className={primaryBtn}
                    >
                      保存通知偏好
                    </button>
                  </div>
                </SectionCard>
              )}

              {/* ============ 演示数据 ============ */}
              {group === 'demo' && (
                <SectionCard title="演示数据" icon={<RefreshCcw className="h-5 w-5" />}>
                  {/* 当前状态 + 载入入口（空态时显示） */}
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="flex items-center gap-2.5">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', demoOff ? 'bg-neutral-100 text-neutral-500' : 'bg-warning-bg text-warning')}>
                        <RefreshCcw className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-body font-medium text-neutral-950">演示数据状态</p>
                        <p className="mt-0.5 text-body-sm text-neutral-500">
                          {demoOff
                            ? '当前为空态起点：未载入演示数据，各页面展示真实的空状态'
                            : '当前已载入演示数据：各页面展示成熟运营数据，可随时重置为空态'}
                        </p>
                      </div>
                    </div>
                    {demoOff ? (
                      <button
                        type="button"
                        onClick={() => {
                          loadDemoData()
                          toast.success('已载入演示数据。')
                        }}
                        className={cn(primaryBtn, 'shrink-0')}
                      >
                        载入演示数据
                      </button>
                    ) : (
                      <span className="inline-flex h-6 shrink-0 items-center rounded-pill bg-warning-bg px-2 text-caption font-medium text-warning">
                        演示数据
                      </span>
                    )}
                  </div>
                  {/* V1.3 新手引导重看入口（onboarding-tour.md §2.2）：重置 done 标记并跳回工作台自动重播 */}
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                        <Compass className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-body font-medium text-neutral-950">新手引导</p>
                        <p className="mt-0.5 text-body-sm text-neutral-500">重新观看工作台 8 步导览，介绍 6 个最常用入口，随时可以跳过</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.removeItem('kb.tour.done')
                          localStorage.removeItem('kb.tour.version')
                        } catch {
                          // 存储不可用时直接进入工作台，导览仍按未记忆处理
                        }
                        navigate('/workspace/dashboard')
                      }}
                      className="shrink-0 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
                    >
                      重新观看 ›
                    </button>
                  </div>
                  <div className="rounded-lg border border-danger-border bg-danger-bg p-4">
                    <p className="text-body font-medium text-neutral-950">重置为空态起点</p>
                    <p className="mt-1 text-body-sm text-neutral-600">
                      将清空所有试用进度、对话记录、反馈与任务，回到未载入演示数据的空态起点（仅保留新手引导）。此操作立即生效，不可撤销。
                    </p>
                    <button
                      type="button"
                      onClick={() => setResetConfirm(true)}
                      className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-md bg-danger px-5 text-body font-medium text-white transition-colors duration-micro ease-brand hover:brightness-110"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      重置为空态
                    </button>
                  </div>
                </SectionCard>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* 套餐对比 Modal（5 列功能矩阵，当前列高亮） */}
      <Modal open={planOpen} onClose={() => setPlanOpen(false)} title="套餐对比" description="当前套餐列已高亮；升级后数据与配置全部保留" width={960}>
        <div className="grid grid-cols-5 gap-3">
          {planMatrix.map((p) => (
            <div
              key={p.name}
              className={cn(
                'rounded-lg border p-3.5',
                p.current ? 'border-[1.5px] border-brand-500 bg-surface-cardSel' : 'border-neutral-200 bg-white',
              )}
            >
              <p className="flex items-center gap-1.5 text-body font-semibold text-neutral-950">
                {p.name}
                {p.current && <span className="rounded-sm bg-brand-600 px-1 py-0.5 text-[10px] font-medium text-white">当前</span>}
              </p>
              <p className="mt-1 text-body-sm text-brand-600">{p.price}</p>
              <p className="text-caption text-neutral-500">{p.seats}</p>
              <ul className="mt-2.5 space-y-1.5">
                {p.highlight.map((h) => (
                  <li key={h} className="text-caption text-neutral-600">· {h}</li>
                ))}
              </ul>
              {!p.current &&
                (p.name === 'Free' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPlanOpen(false)
                      setFreeDowngradeConfirm(true)
                    }}
                    className="mt-3 h-8 w-full rounded-md border border-neutral-200 bg-white text-body-sm text-neutral-600 hover:bg-neutral-50"
                  >
                    降级为免费版
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPlanOpen(false)
                      toast.success(`已提交升级到 ${p.name} 的申请，客户成功将在 1 个工作日内联系你。`)
                    }}
                    className="mt-3 h-8 w-full rounded-md border border-[#BFD0F2] bg-white text-body-sm text-brand-600 hover:bg-brand-50"
                  >
                    提交升级申请
                  </button>
                ))}
            </div>
          ))}
        </div>
      </Modal>

      {/* 邀请成员 Modal */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="邀请成员"
        description="支持批量粘贴邮箱或手机号（自动去重）"
        width={520}
        footer={
          <>
            <button type="button" onClick={() => setInviteOpen(false)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">
              取消
            </button>
            <button
              type="button"
              disabled={!inviteText.trim()}
              onClick={sendInvites}
              className={cn(primaryBtn, !inviteText.trim() && 'cursor-not-allowed bg-neutral-100 text-neutral-400 hover:bg-neutral-100')}
            >
              发送邀请
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">邮箱 / 手机号（每行一个）</label>
            <textarea
              value={inviteText}
              onChange={(e) => setInviteText(e.target.value)}
              rows={4}
              placeholder={'zhangsan@example.com\n138 0000 0002'}
              className="w-full resize-none rounded-md border border-[#DCE4EF] px-3 py-2 text-body text-neutral-800 outline-none focus:border-brand-500 focus:shadow-input"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">角色</label>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={cn(selectCls, 'w-full')}>
                {roleTemplates.slice(1).map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">部门</label>
              <select value={inviteDept} onChange={(e) => setInviteDept(e.target.value)} className={cn(selectCls, 'w-full')}>
                <option>销售团队</option>
                <option>售前团队</option>
                <option>客服团队</option>
                <option>产品团队</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* 角色编辑 Modal（9 种角色模板） */}
      <Modal
        open={editTarget !== null && downgradeConfirm === null}
        onClose={() => setEditTarget(null)}
        title={`编辑角色：${editTarget?.name ?? ''}`}
        description="角色降级需要输入成员姓名确认（L4 高风险操作）"
        width={480}
        footer={
          <>
            <button type="button" onClick={() => setEditTarget(null)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">
              取消
            </button>
            <button
              type="button"
              disabled={!editTarget || editRole === editTarget.role}
              onClick={submitRoleChange}
              className={cn(primaryBtn, editTarget && editRole === editTarget.role && 'cursor-not-allowed bg-neutral-100 text-neutral-400 hover:bg-neutral-100')}
            >
              保存角色
            </button>
          </>
        }
      >
        <ul className="space-y-1.5">
          {ALL_ROLES.map((r) => (
            <li key={r}>
              <button
                type="button"
                onClick={() => setEditRole(r)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-body transition-colors duration-micro ease-brand',
                  editRole === r ? 'border-brand-500 bg-surface-cardSel text-brand-700' : 'border-neutral-200 text-neutral-800 hover:border-brand-300',
                )}
              >
                {r}
                {editRole === r && <span className="text-caption text-brand-600">已选择</span>}
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      {/* 角色降级 L4 确认（输入姓名） */}
      <Modal open={downgradeConfirm !== null} onClose={() => setDowngradeConfirm(null)} width={520}>
        {downgradeConfirm && (
          <div>
            <ConfirmationCard
              title="确认降低成员权限（L4 高风险）"
              description={`该操作会立即收窄 ${downgradeConfirm.member.name} 的权限范围。`}
              fields={[
                { label: '动作', value: `角色降级：${downgradeConfirm.member.role} → ${downgradeConfirm.role}` },
                { label: '影响对象', value: `${downgradeConfirm.member.name}（${downgradeConfirm.member.contact}）` },
                { label: '影响范围', value: '该成员对空间、文档与助手的管理权限' },
                { label: '外部影响', value: '无' },
                { label: '可撤销性', value: '可随时重新提升角色，操作记录审计日志' },
              ]}
              confirmText="确认降级"
              onConfirm={() => {
                if (downgradeInput === downgradeConfirm.member.name) applyRoleChange(downgradeConfirm.member, downgradeConfirm.role)
              }}
              onCancel={() => setDowngradeConfirm(null)}
              className="border-0 p-0 shadow-none"
            />
            <div className="mt-4">
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">
                请输入成员姓名「{downgradeConfirm.member.name}」以确认
              </label>
              <input
                value={downgradeInput}
                onChange={(e) => setDowngradeInput(e.target.value)}
                className={inputCls}
                placeholder={downgradeConfirm.member.name}
              />
              {downgradeInput && downgradeInput !== downgradeConfirm.member.name && (
                <p className="mt-1 text-caption text-danger">姓名不匹配，无法确认。</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* MFA 开启 L2 确认 */}
      <Modal open={mfaConfirm} onClose={() => setMfaConfirm(false)} width={560}>
        <ConfirmationCard
          title="开启双因素认证（MFA）"
          description="开启后立即对全部成员生效。"
          fields={[
            { label: '动作', value: '开启双因素认证' },
            { label: '影响对象', value: '全部 12 名成员' },
            { label: '影响范围', value: '下次登录需绑定二次验证方式' },
            { label: '外部影响', value: 'SSO 用户不受影响' },
            { label: '可撤销性', value: '可随时关闭，操作记录审计日志' },
          ]}
          confirmText="确认开启"
          onConfirm={() => {
            setMfaOn(true)
            setMfaConfirm(false)
            toast.success('MFA 已开启，全部成员下次登录需完成二次验证。')
          }}
          onModify={() => setMfaConfirm(false)}
          onCancel={() => setMfaConfirm(false)}
          className="border-0 p-0 shadow-none"
        />
      </Modal>

      {/* 外部访问 L3 预检确认 */}
      <Modal open={externalConfirm} onClose={() => setExternalConfirm(false)} width={560}>
        <ConfirmationCard
          title="开启外部访问（L3 安全预检）"
          description="预检已通过：SSO 已启用 · 权限同步正常 · 无敏感空间暴露。"
          fields={[
            { label: '动作', value: '允许外部访客访问指定空间' },
            { label: '影响对象', value: '外部访客（当前 0 人）' },
            { label: '影响范围', value: '仅显式授权的空间，默认全部关闭' },
            { label: '外部影响', value: '外部用户可通过邀请链接访问' },
            { label: '可撤销性', value: '可随时关闭并吊销全部外部会话' },
          ]}
          confirmText="确认开启"
          onConfirm={() => {
            setExternalOn(true)
            setExternalConfirm(false)
            toast.success('外部访问已开启（默认不含任何空间，需逐个授权）。')
          }}
          onCancel={() => setExternalConfirm(false)}
          className="border-0 p-0 shadow-none"
        />
      </Modal>

      {/* 吊销 API Key 确认（L4：输入 Key 名称确认） */}
      <Modal open={revokeTarget !== null} onClose={() => setRevokeTarget(null)} width={520}>
        {(() => {
          const target = apiKeys.find((k) => k.id === revokeTarget)
          if (!target) return null
          return (
            <div>
              <ConfirmationCard
                title="吊销 API Key（L4 高风险）"
                description="吊销后使用该 Key 的调用将立即失败。"
                fields={[
                  { label: '动作', value: '吊销 API Key' },
                  { label: '影响对象', value: `${target.name}（${target.masked}）` },
                  { label: '影响范围', value: `所有使用该 Key 的集成与脚本（权限：${target.scope}）` },
                  { label: '外部影响', value: '自有系统 API 调用将返回 401' },
                  { label: '可撤销性', value: '不可恢复，需重新创建 Key' },
                ]}
                confirmText="确认吊销"
                onConfirm={() => {
                  if (revokeInput !== target.name) return
                  setApiKeys((prev) => prev.filter((k) => k.id !== revokeTarget))
                  setRevokeTarget(null)
                  toast.warning(`API Key「${target.name}」已吊销。`)
                }}
                onCancel={() => setRevokeTarget(null)}
                className="border-0 p-0 shadow-none"
              />
              <div className="mt-4">
                <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">
                  请输入 Key 名称「{target.name}」以确认
                </label>
                <input
                  value={revokeInput}
                  onChange={(e) => setRevokeInput(e.target.value)}
                  className={inputCls}
                  placeholder={target.name}
                />
                {revokeInput && revokeInput !== target.name && (
                  <p className="mt-1 text-caption text-danger">名称不匹配，无法确认。</p>
                )}
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Webhook 配置 Modal */}
      <Modal
        open={webhookOpen}
        onClose={() => setWebhookOpen(false)}
        title="添加 Webhook"
        description="选择需要推送的事件类型"
        width={480}
        footer={
          <>
            <button type="button" onClick={() => setWebhookOpen(false)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">
              取消
            </button>
            <button
              type="button"
              disabled={webhookSelected.length === 0 || !/^https?:\/\/.+/.test(webhookUrl.trim())}
              onClick={saveWebhook}
              className={cn(
                primaryBtn,
                (webhookSelected.length === 0 || !/^https?:\/\/.+/.test(webhookUrl.trim())) &&
                  'cursor-not-allowed bg-neutral-100 text-neutral-400 hover:bg-neutral-100',
              )}
            >
              保存 Webhook
            </button>
          </>
        }
      >
        <div className="mb-4">
          <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">回调地址</label>
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            className={inputCls}
          />
          {webhookUrl.trim() && !/^https?:\/\/.+/.test(webhookUrl.trim()) && (
            <p className="mt-1 text-caption text-danger">请输入以 http(s):// 开头的合法地址。</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {webhookEvents.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setWebhookSelected((prev) => (prev.includes(e) ? prev.filter((v) => v !== e) : [...prev, e]))}
              className={cn(
                'rounded-md border px-3 py-2.5 text-left text-body-sm transition-colors duration-micro ease-brand',
                webhookSelected.includes(e) ? 'border-brand-500 bg-brand-100 text-brand-700' : 'border-neutral-200 text-neutral-700 hover:border-brand-300',
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </Modal>

      {/* 重置为空态确认（高风险） */}
      <Modal open={resetConfirm} onClose={() => setResetConfirm(false)} width={560}>
        <ConfirmationCard
          title="重置为空态起点（高风险）"
          description="此操作立即生效，不可撤销。"
          fields={[
            { label: '动作', value: '清空演示数据，回到空态起点并返回申请试用页' },
            { label: '影响对象', value: '试用进度、对话记录、反馈队列、每日待办' },
            { label: '影响范围', value: '当前浏览器中的全部本地演示状态（重置后仅保留新手引导任务）' },
            { label: '外部影响', value: '无（仅演示数据）' },
            { label: '可撤销性', value: '不可撤销（之后可随时重新载入演示数据）' },
          ]}
          confirmText="确认重置"
          onConfirm={() => {
            resetDemoData()
            setResetConfirm(false)
            navigate('/trial/apply')
          }}
          onCancel={() => setResetConfirm(false)}
          className="border-0 p-0 shadow-none"
        />
      </Modal>

      {/* 降级为免费版 L2 确认 */}
      <Modal open={freeDowngradeConfirm} onClose={() => setFreeDowngradeConfirm(false)} width={560}>
        <ConfirmationCard
          title="降级为免费版"
          description="降级后超出免费版配额的功能将停用，数据保留 30 天。"
          fields={[
            { label: '动作', value: '当前 Trial 到期后降级为 Free 套餐' },
            { label: '影响对象', value: '全部 12 名成员（Free 限 3–5 人）' },
            { label: '影响范围', value: '业务助手限 1 个，知识容量限 1 GB' },
            { label: '外部影响', value: '无' },
            { label: '可撤销性', value: '可在到期前随时取消降级' },
          ]}
          confirmText="确认降级"
          onConfirm={() => {
            setFreeDowngradeConfirm(false)
            toast.success('已提交降级申请，Trial 到期（2025-06-03）后自动切换为免费版。')
          }}
          onModify={() => setFreeDowngradeConfirm(false)}
          onCancel={() => setFreeDowngradeConfirm(false)}
          className="border-0 p-0 shadow-none"
        />
      </Modal>

      {/* SSO 配置 Modal */}
      <Modal
        open={ssoOpen}
        onClose={() => setSsoOpen(false)}
        title="单点登录（SSO）配置"
        description="配置企业统一身份认证，保存后后台校验元数据"
        width={520}
        footer={
          <>
            <button type="button" onClick={() => setSsoOpen(false)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">
              取消
            </button>
            <button
              type="button"
              disabled={!/^https?:\/\/.+/.test(ssoMetadata.trim())}
              onClick={saveSso}
              className={cn(primaryBtn, !/^https?:\/\/.+/.test(ssoMetadata.trim()) && 'cursor-not-allowed bg-neutral-100 text-neutral-400 hover:bg-neutral-100')}
            >
              保存配置
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">协议</label>
            <div className="flex gap-2">
              {(['SAML 2.0', 'OIDC'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSsoProtocol(p)}
                  className={cn(
                    'h-10 flex-1 rounded-md border text-body-sm transition-colors duration-micro ease-brand',
                    ssoProtocol === p ? 'border-brand-500 bg-brand-100 font-medium text-brand-700' : 'border-neutral-200 text-neutral-700 hover:border-brand-300',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">元数据 URL</label>
            <input
              value={ssoMetadata}
              onChange={(e) => setSsoMetadata(e.target.value)}
              placeholder={ssoProtocol === 'SAML 2.0' ? 'https://idp.example.com/metadata.xml' : 'https://idp.example.com/.well-known/openid-configuration'}
              className={inputCls}
            />
            {ssoMetadata.trim() && !/^https?:\/\/.+/.test(ssoMetadata.trim()) && (
              <p className="mt-1 text-caption text-danger">请输入以 http(s):// 开头的合法地址。</p>
            )}
          </div>
          {ssoSaved && (
            <p className="rounded-lg bg-surface-soft px-3.5 py-2.5 text-caption text-neutral-500">
              当前生效配置：{ssoSaved.protocol} · {ssoSaved.metadata}
            </p>
          )}
        </div>
      </Modal>

      {/* IP 白名单 Modal */}
      <Modal
        open={ipOpen}
        onClose={() => setIpOpen(false)}
        title="登录 IP 白名单"
        description="仅允许白名单 IP 段访问工作台，支持 CIDR"
        width={520}
        footer={
          <button type="button" onClick={() => setIpOpen(false)} className={cn(primaryBtn, 'h-10')}>
            完成
          </button>
        }
      >
        <div className="space-y-3">
          {ipList.length === 0 && (
            <p className="rounded-lg bg-surface-soft px-3.5 py-2.5 text-body-sm text-neutral-500">白名单为空，当前不限制登录 IP。</p>
          )}
          {ipList.map((ip) => (
            <div key={ip} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3.5 py-2.5">
              <code className="font-mono text-body-sm text-neutral-800">{ip}</code>
              <button type="button" onClick={() => removeIp(ip)} className="text-body-sm text-danger hover:brightness-110">
                删除
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addIp()
              }}
              placeholder="如 203.0.113.10 或 203.0.113.0/24"
              className={inputCls}
            />
            <button
              type="button"
              disabled={!ipInput.trim()}
              onClick={addIp}
              className={cn(primaryBtn, 'shrink-0', !ipInput.trim() && 'cursor-not-allowed bg-neutral-100 text-neutral-400 hover:bg-neutral-100')}
            >
              添加
            </button>
          </div>
          <p className="text-caption text-neutral-400">支持单个 IP 或 CIDR 网段；保存后即时生效。</p>
        </div>
      </Modal>

      {/* 创建 API Key Modal */}
      <Modal
        open={createKeyOpen}
        onClose={() => setCreateKeyOpen(false)}
        title="创建 API Key"
        description="明文仅创建后展示一次，请妥善保存"
        width={480}
        footer={
          <>
            <button type="button" onClick={() => setCreateKeyOpen(false)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">
              取消
            </button>
            <button
              type="button"
              disabled={!keyName.trim()}
              onClick={createApiKey}
              className={cn(primaryBtn, !keyName.trim() && 'cursor-not-allowed bg-neutral-100 text-neutral-400 hover:bg-neutral-100')}
            >
              创建
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">Key 名称</label>
            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="如：CRM 系统集成"
              className={inputCls}
              maxLength={50}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">权限范围</label>
            <select value={keyScope} onChange={(e) => setKeyScope(e.target.value)} className={cn(selectCls, 'w-full')}>
              {apiKeyScopes.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <p className="mt-1.5 text-caption text-neutral-400">只读：仅检索与问答；读写：可上传文档；管理：可管理空间与成员。</p>
          </div>
        </div>
      </Modal>

      {/* 批量导入成员 Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="批量导入成员"
        description="粘贴邮箱列表（每行一个），解析校验后入队导入"
        width={560}
        footer={
          <>
            <button type="button" onClick={() => setImportOpen(false)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">
              取消
            </button>
            <button
              type="button"
              disabled={importRows.filter((r) => r.valid).length === 0}
              onClick={confirmImport}
              className={cn(primaryBtn, importRows.filter((r) => r.valid).length === 0 && 'cursor-not-allowed bg-neutral-100 text-neutral-400 hover:bg-neutral-100')}
            >
              确认导入（{importRows.filter((r) => r.valid).length}）
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">邮箱列表</label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={5}
              placeholder={'zhangsan@example.com\nlisi@example.com'}
              className="w-full resize-none rounded-md border border-[#DCE4EF] px-3 py-2 text-body text-neutral-800 outline-none focus:border-brand-500 focus:shadow-input"
            />
          </div>
          {importRows.length > 0 && (
            <div>
              <p className="mb-1.5 text-body-sm font-medium text-neutral-800">
                解析结果：{importRows.filter((r) => r.valid).length} 条有效 / {importRows.length} 条
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 p-2">
                {importRows.map((r, i) => (
                  <li key={`${r.contact}-${i}`} className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-body-sm hover:bg-neutral-50">
                    <span className="text-neutral-800">{r.contact}</span>
                    {r.valid ? (
                      <span className="text-caption font-medium text-success">✅ 待导入</span>
                    ) : (
                      <span className="text-caption text-danger">⚠ {r.reason}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>

      {/* 断开集成连接 L2 确认 */}
      <Modal open={disconnectTarget !== null} onClose={() => setDisconnectTarget(null)} width={560}>
        <ConfirmationCard
          title={`断开「${disconnectTarget ?? ''}」连接`}
          description="断开后该渠道的同步与权限映射将暂停。"
          fields={[
            { label: '动作', value: `断开与「${disconnectTarget ?? ''}」的集成连接` },
            { label: '影响对象', value: '该渠道同步的文档与成员映射' },
            { label: '影响范围', value: '增量同步停止，已同步内容保留' },
            { label: '外部影响', value: '无' },
            { label: '可撤销性', value: '可随时重新连接并恢复同步' },
          ]}
          confirmText="确认断开"
          onConfirm={() => {
            if (disconnectTarget) {
              toggleConnector(disconnectTarget, false)
              toast.warning(`「${disconnectTarget}」已断开连接。`)
            }
            setDisconnectTarget(null)
          }}
          onCancel={() => setDisconnectTarget(null)}
          className="border-0 p-0 shadow-none"
        />
      </Modal>

      {/* 权限审计 Drawer */}
      <SideDrawer open={permAuditOpen} onClose={() => setPermAuditOpen(false)} title="权限审计记录" width={480}>
        <p className="mb-3 text-body-sm text-neutral-500">近期权限相关操作记录（完整记录见「集成与安全 · 审计日志」）。</p>
        <ul className="space-y-2">
          {auditLogs.map((l, i) => (
            <li key={i} className="rounded-lg border border-neutral-200 px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-body-sm font-medium text-neutral-950">{l.action}</span>
                <span className="shrink-0 text-caption text-success">{l.result}</span>
              </div>
              <p className="mt-0.5 text-body-sm text-neutral-600">{l.target}</p>
              <p className="mt-0.5 text-caption text-neutral-400">
                {l.time} · {l.member}
              </p>
            </li>
          ))}
        </ul>
      </SideDrawer>

    </div>
  )
}
