/**
 * 权限管理 Permissions（W11，design/permissions.md）
 * 五层权限总览 + 成员角色表（编辑 Drawer / 角色变更 L3）+ 9×6 权限矩阵（L3 浮动确认）
 * + 身份映射（400/402，陈可/刘洋待映射）+ 权限预览工具 + 审计日志。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  ChevronRight,
  Download,
  Eye,
  Grid3X3,
  History,
  Lock,
  Plus,
  Search,
  UserPlus,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/mocks'
import { ConfirmationCard, DemoEmptyState, ProgressBar, SectionCard } from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { Modal } from '@/pages/workspace/Modal'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { useAppToast } from '@/lib/toast'
import {
  ALL_ROLES,
  ALL_SPACES,
  coreMembers,
  defaultPreview,
  enterpriseAccounts,
  foldedMembers,
  identityMapping,
  initialAuditLogs,
  initialLayerConfig,
  initialMatrix,
  LAYER_DRAWER_META,
  memberPreviews,
  PERMISSION_ITEMS,
  permissionLayers,
  ROLE_COLUMNS,
} from '@/pages/workspace/permissionsData'
import type { AuditLog, CoreRole, LayerConfig, Member } from '@/pages/workspace/permissionsData'

const allMembers = [...coreMembers, ...foldedMembers]

/** 触发浏览器真实下载（CSV / Markdown） */
function downloadFile(filename: string, content: string, mime: string, bom = false) {
  const blob = new Blob([bom ? `\ufeff${content}` : content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

interface MatrixChange {
  item: string
  role: CoreRole
  value: boolean
}

/** 开关行（五层配置 Drawer 复用） */
function ToggleRow({ label, desc, on, onToggle }: { label: string; desc?: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-body-sm font-medium text-neutral-950">{label}</p>
        {desc && <p className="text-caption text-neutral-400">{desc}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-comp ease-brand', on ? 'bg-brand-600' : 'bg-neutral-300')}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-comp ease-brand',
            on ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

export default function Permissions() {
  const toast = useAppToast()
  const { state } = useAppStore()
  // 冷启动空态：未载入演示数据时展示引导空态（评审 P1-N1）
  const demoOff = state.demoData === false
  const [members, setMembers] = useState<Member[]>(allMembers)
  const [showAllMembers, setShowAllMembers] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<CoreRole>('普通成员')
  const [inviteGroup, setInviteGroup] = useState('销售部')

  // 五层权限配置 Drawer（draft 编辑，保存时提交到 layerConfig）
  const [layerConfig, setLayerConfig] = useState<LayerConfig>(initialLayerConfig)
  const [layerDrawer, setLayerDrawer] = useState<number | null>(null)
  const [layerDraft, setLayerDraft] = useState<LayerConfig | null>(null)
  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleCond, setNewRuleCond] = useState('')

  // 成员编辑 Drawer
  const [editTarget, setEditTarget] = useState<Member | null>(null)
  const [editRole, setEditRole] = useState<CoreRole>('普通成员')
  const [editSpaces, setEditSpaces] = useState<string[]>([])
  const [roleConfirm, setRoleConfirm] = useState<{ member: Member; from: CoreRole; to: CoreRole } | null>(null)

  // 身份映射
  const [unmapped, setUnmapped] = useState(identityMapping.unmapped)
  const [inviting, setInviting] = useState<string[]>([])
  const [mappedCount, setMappedCount] = useState(400)
  const [selectedUnmapped, setSelectedUnmapped] = useState<string[]>([])
  const [manualMap, setManualMap] = useState<{ memberId: string; name: string; detail: string } | null>(null)
  const [manualAccount, setManualAccount] = useState('')
  const [accountPool, setAccountPool] = useState<string[]>(enterpriseAccounts)

  // 成员对比 Modal
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareId, setCompareId] = useState('')

  // 权限预览
  const [previewId, setPreviewId] = useState('m-ly')
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 权限矩阵
  const [matrix, setMatrix] = useState(initialMatrix)
  const [pendingChanges, setPendingChanges] = useState<MatrixChange[]>([])
  const [showMatrixConfirm, setShowMatrixConfirm] = useState(false)

  // 审计日志
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs)
  const [auditType, setAuditType] = useState('全部')
  const [auditQuery, setAuditQuery] = useState('')
  const [auditRange, setAuditRange] = useState<'7' | '30'>('7')

  useEffect(() => () => {
    if (previewTimer.current) clearTimeout(previewTimer.current)
  }, [])

  const visibleMembers = showAllMembers ? members : members.filter((m) => m.core)
  const preview = memberPreviews[previewId] ?? defaultPreview
  const mappingPct = Math.floor((mappedCount / 402) * 100)

  const filteredLogs = auditLogs.filter(
    (l) =>
      l.daysAgo < Number(auditRange) &&
      (auditType === '全部' || l.type === auditType) &&
      (!auditQuery.trim() || `${l.action}${l.target}${l.operator}`.includes(auditQuery.trim())),
  )

  const pushAudit = (action: string, target: string, type: AuditLog['type'] = '系统') => {
    const log: AuditLog = {
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: '刚刚',
      daysAgo: 0,
      operator: '张伟',
      action,
      target,
      result: '已生效',
      resultTone: 'success',
      type,
    }
    setAuditLogs((prev) => [log, ...prev])
  }

  // ---- 五层权限配置 Drawer ----
  const openLayerDrawer = (i: number) => {
    setLayerDraft(JSON.parse(JSON.stringify(layerConfig)) as LayerConfig)
    setNewRuleName('')
    setNewRuleCond('')
    setLayerDrawer(i)
  }

  const saveLayerDrawer = () => {
    if (layerDrawer === null || !layerDraft) return
    setLayerConfig(layerDraft)
    pushAudit('更新权限层配置', LAYER_DRAWER_META[layerDrawer].title, '系统')
    toast.success(`「${LAYER_DRAWER_META[layerDrawer].title}」已保存并生效`)
    setLayerDrawer(null)
  }

  // ---- 手动映射 ----
  const openManualMap = (u: { memberId: string; name: string; detail: string }) => {
    setManualMap(u)
    setManualAccount(accountPool[0] ?? '')
  }

  const confirmManualMap = () => {
    if (!manualMap || !manualAccount) return
    setUnmapped((prev) => prev.filter((u) => u.memberId !== manualMap.memberId))
    setSelectedUnmapped((prev) => prev.filter((id) => id !== manualMap.memberId))
    setAccountPool((prev) => prev.filter((a) => a !== manualAccount))
    setMappedCount((c) => Math.min(402, c + 1))
    setMembers((prev) =>
      prev.map((m) =>
        m.id === manualMap.memberId ? { ...m, mapping: 'ok', mappingLabel: m.mappingLabel.replace(/⚠.*$/, '✅ 已映射') } : m,
      ),
    )
    pushAudit('手动身份映射', `${manualMap.name} → ${manualAccount}`, '成员')
    toast.success(`已将 ${manualMap.name} 手动绑定到 ${manualAccount}，映射完成`)
    setManualMap(null)
  }

  // ---- 批量操作 ----
  const toggleSelectUnmapped = (id: string) =>
    setSelectedUnmapped((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const batchInvite = () => {
    const targets = unmapped.filter((u) => selectedUnmapped.includes(u.memberId))
    if (targets.length === 0) return
    targets.forEach((u) => sendBindInvite(u.name, u.memberId))
    setSelectedUnmapped([])
  }

  const batchIgnore = () => {
    const n = selectedUnmapped.length
    if (n === 0) return
    setUnmapped((prev) => prev.filter((u) => !selectedUnmapped.includes(u.memberId)))
    pushAudit('批量忽略待映射记录', `${n} 条记录`, '成员')
    toast.info(`已忽略 ${n} 条待映射记录（不计入覆盖率）`)
    setSelectedUnmapped([])
  }

  // ---- 导出 ----
  const exportAuditCsv = () => {
    const header = '时间,操作人,动作,对象,结果,类型'
    const rows = filteredLogs.map((l) => [l.time, l.operator, l.action, l.target, l.result, l.type].map(csvEscape).join(','))
    downloadFile(`权限审计日志_近${auditRange}天.csv`, [header, ...rows].join('\n'), 'text/csv;charset=utf-8', true)
    toast.success(`已导出 ${filteredLogs.length} 条审计日志（CSV）`)
  }

  const exportPermissionReport = () => {
    const lines: string[] = [
      '# 权限报告',
      '',
      `导出时间：${new Date().toLocaleString('zh-CN')} ｜ 成员 12 名 ｜ 身份映射 ${mappedCount}/402（${mappingPct}%）`,
      '',
      '## 五层权限配置摘要',
      '',
      `- L1 空间层（空间可见性）：${Object.entries(layerConfig.spaceVisibility).map(([k, v]) => `${k}${v ? '可见' : '隐藏'}`).join('、')}`,
      `- L2 成员层：新成员默认角色「${layerConfig.defaultRole}」`,
      `- L3 文档层（密级标签）：${Object.entries(layerConfig.docSecLabels).map(([k, v]) => `${k}${v ? '启用' : '停用'}`).join('、')}`,
      `- L4 字段层（脱敏）：${Object.entries(layerConfig.fieldMasking).map(([k, v]) => `${k}${v ? '脱敏' : '明文'}`).join('、')}`,
      `- L5 行级层（${layerConfig.rowRules.length} 条规则）：${layerConfig.rowRules.map((r) => `${r.name}（${r.condition}）`).join('；') || '无'}`,
      '',
      '## 角色权限矩阵',
      '',
      `| 权限项 | ${ROLE_COLUMNS.map((c) => c.role).join(' | ')} |`,
      `| --- | ${ROLE_COLUMNS.map(() => '---').join(' | ')} |`,
      ...PERMISSION_ITEMS.map(
        (p) => `| ${p.name} | ${ROLE_COLUMNS.map((c) => (matrix[p.key][c.role] ? '✅' : '—')).join(' | ')} |`,
      ),
      '',
      '## 待映射清单',
      '',
      ...(unmapped.length > 0
        ? unmapped.map((u) => `- ${u.name}：${u.detail}`)
        : ['- 全部成员均已完成身份映射']),
      '',
    ]
    downloadFile('权限报告.md', lines.join('\n'), 'text/markdown;charset=utf-8')
    toast.success('权限报告已导出（.md）')
  }

  const openEdit = (m: Member) => {
    setEditTarget(m)
    setEditRole(m.role)
    setEditSpaces(m.spaceList)
  }

  const saveMemberEdit = () => {
    if (!editTarget) return
    if (editRole !== editTarget.role) {
      setRoleConfirm({ member: editTarget, from: editTarget.role, to: editRole })
      return
    }
    applyMemberEdit(editTarget, editRole, editSpaces)
  }

  const applyMemberEdit = (m: Member, role: CoreRole, spaces: string[]) => {
    setMembers((prev) =>
      prev.map((x) =>
        x.id === m.id
          ? { ...x, role, spaceList: spaces, spaces: spaces.length >= 5 ? '全部 5 个空间' : spaces.join(' · ') }
          : x,
      ),
    )
    setEditTarget(null)
    setRoleConfirm(null)
    const log: AuditLog = {
      id: `a-${Date.now()}`,
      time: '刚刚',
      daysAgo: 0,
      operator: '张伟',
      action: role !== m.role ? '角色变更' : '修改空间权限',
      target: role !== m.role ? `${m.name}：${m.role} → ${role}` : `${m.name} → ${spaces.join('、')}`,
      result: '已生效',
      resultTone: 'success',
      type: '成员',
    }
    setAuditLogs((prev) => [log, ...prev])
    toast.success(role !== m.role ? `已将 ${m.name} 的角色调整为「${role}」` : '成员权限已更新')
  }

  const sendBindInvite = (name: string, memberId: string) => {
    setInviting((prev) => [...prev, memberId])
    setTimeout(() => {
      setUnmapped((prev) => prev.filter((u) => u.memberId !== memberId))
      setInviting((prev) => prev.filter((id) => id !== memberId))
      setMappedCount((c) => Math.min(402, c + 1))
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, mapping: 'ok', mappingLabel: m.mappingLabel.replace(/⚠.*$/, '✅ 已映射') } : m)),
      )
      toast.success(`${name} 已确认绑定，身份映射完成`)
    }, 3000)
    toast.info(`已向 ${name} 发送绑定邀请，待对方确认`)
  }

  const toggleMatrixCell = (item: string, role: CoreRole, locked?: boolean) => {
    if (locked) return
    const current = matrix[item][role]
    const pending = pendingChanges.find((c) => c.item === item && c.role === role)
    const nextValue = pending ? !pending.value : !current
    setPendingChanges((prev) => {
      const rest = prev.filter((c) => !(c.item === item && c.role === role))
      return nextValue === current ? rest : [...rest, { item, role, value: nextValue }]
    })
  }

  const cellValue = (item: string, role: CoreRole) => {
    const pending = pendingChanges.find((c) => c.item === item && c.role === role)
    return pending ? pending.value : matrix[item][role]
  }

  const affectedMembers = useMemo(() => {
    const roles = new Set(pendingChanges.map((c) => c.role))
    return members.filter((m) => roles.has(m.role)).length
  }, [pendingChanges, members])

  const confirmMatrix = () => {
    setMatrix((prev) => {
      const next = { ...prev }
      for (const c of pendingChanges) {
        next[c.item] = { ...next[c.item], [c.role]: c.value }
      }
      return next
    })
    const log: AuditLog = {
      id: `a-${Date.now()}`,
      time: '刚刚',
      daysAgo: 0,
      operator: '张伟',
      action: '批量调整角色权限',
      target: pendingChanges
        .map((c) => `${PERMISSION_ITEMS.find((p) => p.key === c.item)?.name}·${c.role}${c.value ? '→允许' : '→禁止'}`)
        .join('；'),
      result: '已生效',
      resultTone: 'success',
      type: '成员',
    }
    setAuditLogs((prev) => [log, ...prev])
    setPendingChanges([])
    setShowMatrixConfirm(false)
    toast.success(`${pendingChanges.length} 项权限变更已生效`)
  }

  const changePreviewMember = (id: string) => {
    setPreviewId(id)
    setPreviewLoading(true)
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => setPreviewLoading(false), 500)
  }

  // 冷启动空态：未载入演示数据时只显示页头 + 引导空态（评审 P1-N1）
  if (demoOff) {
    return (
      <div>
        <PageHeader
          crumbs={['运营与分析', '权限管理']}
          title="权限管理"
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
            运营与分析
            <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
            <span className="font-medium text-neutral-950">权限管理</span>
          </nav>
          <h1 className="text-h1 text-neutral-950">权限管理</h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {[
            { icon: <Users className="h-4 w-4" />, name: '成员', value: 12, suffix: '人' },
            { icon: <Grid3X3 className="h-4 w-4" />, name: '核心角色', value: 6, suffix: '个' },
            { icon: <UserPlus className="h-4 w-4" />, name: '身份映射', value: mappedCount, suffix: '/402' },
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
              onClick={exportPermissionReport}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
            >
              <Download className="h-4 w-4" />
              导出权限报告
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              邀请成员
            </button>
          </div>
        </div>
      </div>

      {/* Row 1：五层权限总览 */}
      <SectionCard title="五层权限模型" icon={<Lock className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {permissionLayers.map((l, i) => (
            <div key={l.name} className="relative rounded-lg border border-neutral-200 bg-surface-soft p-4">
              <div className="flex items-center gap-2">
                <span className="text-[18px] leading-none">{l.icon}</span>
                <span className="text-body font-semibold text-neutral-950">{l.name}</span>
              </div>
              <p className="mt-2 text-caption leading-5 text-neutral-500">{l.strategy}</p>
              <p className="mt-1.5 text-caption font-medium text-neutral-700">{l.stat}</p>
              <button
                type="button"
                onClick={() => openLayerDrawer(i)}
                className="mt-2 text-body-sm font-medium text-brand-600 hover:text-brand-500"
              >
                配置 ›
              </button>
              {i < permissionLayers.length - 1 && (
                <span className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-neutral-300 xl:block">→</span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-brand-50 px-3.5 py-2.5 text-body-sm text-brand-700">
          回答按 用户 × 空间 × 文档 权限交集裁剪，未授权内容不会进入检索与回答。
        </p>
      </SectionCard>

      {/* Row 2：左 8（成员表 + 身份映射）｜ 右 4（权限预览 sticky） */}
      <div className="mt-4 grid grid-cols-12 gap-4">
        <div className="col-span-12 flex flex-col gap-4 xl:col-span-8">
          {/* 成员与角色表 */}
          <SectionCard title="成员与角色" icon={<Users className="h-5 w-5" />}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="h-10 bg-surface-soft text-body-sm text-neutral-500">
                    <th className="rounded-l-md px-3 font-normal">成员</th>
                    <th className="px-3 font-normal">部门</th>
                    <th className="px-3 font-normal">角色</th>
                    <th className="px-3 font-normal">空间权限</th>
                    <th className="px-3 font-normal">身份映射</th>
                    <th className="px-3 font-normal">最近活跃</th>
                    <th className="rounded-r-md px-3 text-right font-normal">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.map((m) => (
                    <tr key={m.id} className="h-12 border-b border-neutral-100 text-body-sm transition-colors duration-micro ease-brand hover:bg-surface-page">
                      <td className="rounded-l-md px-3">
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-caption font-semibold text-brand-700">
                            {m.name[0]}
                          </span>
                          <span className="font-medium text-neutral-950">{m.name}</span>
                        </span>
                      </td>
                      <td className="px-3 text-neutral-500">{m.dept}</td>
                      <td className={cn('px-3', m.role === '管理员' ? 'font-semibold text-neutral-950' : 'text-neutral-700')}>{m.role}</td>
                      <td className="px-3 text-neutral-500">{m.spaces}</td>
                      <td className={cn('px-3', m.mapping === 'warning' ? 'text-warning' : 'text-neutral-500')}>{m.mappingLabel}</td>
                      <td className="px-3 text-neutral-500">{m.lastActive}</td>
                      <td className="rounded-r-md px-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="text-body-sm font-medium text-brand-600 hover:text-brand-500"
                        >
                          编辑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setShowAllMembers((v) => !v)}
              className="mt-3 text-body-sm font-medium text-brand-600 hover:text-brand-500"
            >
              {showAllMembers ? '收起普通成员 ↑' : '查看全部 12 名成员 ›'}
            </button>
          </SectionCard>

          {/* 身份映射卡 */}
          <SectionCard title="身份映射" icon={<UserPlus className="h-5 w-5" />}>
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-body-sm text-neutral-700">
                飞书映射 <span className="font-semibold text-neutral-950">{mappedCount >= 401 ? '201/201' : identityMapping.feishu}</span>
                <span className="mx-2 text-neutral-300">·</span>
                企微映射 <span className="font-semibold text-neutral-950">{mappedCount >= 402 ? '201/201' : identityMapping.wecom}</span>
                <span className="mx-2 text-neutral-300">·</span>共 {unmapped.length} 人待映射
              </span>
              <ProgressBar value={mappingPct} className="flex-1" barClassName={mappingPct < 100 ? 'bg-warning-accent' : undefined} />
              <span className="shrink-0 text-caption text-neutral-400">{mappingPct}%</span>
            </div>
            {unmapped.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {unmapped.map((u) => {
                  const checked = selectedUnmapped.includes(u.memberId)
                  return (
                    <div key={u.memberId} className="flex items-center justify-between gap-3 rounded-lg bg-warning-bg px-3.5 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          aria-label={`选择 ${u.name}`}
                          onClick={() => toggleSelectUnmapped(u.memberId)}
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border transition-colors duration-micro ease-brand',
                            checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300 bg-white hover:border-brand-300',
                          )}
                        >
                          {checked && <Check className="h-3.5 w-3.5" />}
                        </button>
                        <p className="min-w-0 text-body-sm text-neutral-800">
                          <span className="font-medium">{u.name}</span>
                          <span className="text-neutral-500"> — {u.detail}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          disabled={inviting.includes(u.memberId)}
                          onClick={() => sendBindInvite(u.name, u.memberId)}
                          className="text-body-sm font-medium text-brand-600 hover:text-brand-500 disabled:text-neutral-400"
                        >
                          {inviting.includes(u.memberId) ? '待对方确认…' : '发送绑定邀请'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openManualMap(u)}
                          className="text-body-sm text-neutral-500 hover:text-neutral-700"
                        >
                          手动映射
                        </button>
                      </div>
                    </div>
                  )
                })}
                {selectedUnmapped.length > 0 && (
                  <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2.5">
                    <span className="text-body-sm font-medium text-neutral-950">已选 {selectedUnmapped.length} 人</span>
                    <button
                      type="button"
                      onClick={batchInvite}
                      className="text-body-sm font-medium text-brand-600 hover:text-brand-500"
                    >
                      批量绑定邀请
                    </button>
                    <button
                      type="button"
                      onClick={batchIgnore}
                      className="text-body-sm text-neutral-500 hover:text-neutral-700"
                    >
                      批量忽略
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedUnmapped([])}
                      className="ml-auto text-caption text-neutral-400 hover:text-neutral-600"
                    >
                      清除选择
                    </button>
                  </div>
                )}
                <p className="text-caption text-neutral-400">未映射成员在对应渠道内将以访客身份获得裁剪后的答案。</p>
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-success-bg px-3.5 py-2.5 text-body-sm text-success">
                全部成员均已完成身份映射（{mappedCount}/402）。
              </p>
            )}
          </SectionCard>
        </div>

        {/* 右 4：权限预览工具（sticky） */}
        <div className="col-span-12 xl:col-span-4">
          <div className="xl:sticky xl:top-4">
            <SectionCard title="以 TA 的视角预览" icon={<Eye className="h-5 w-5" />}>
              <select
                value={previewId}
                onChange={(e) => changePreviewMember(e.target.value)}
                className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
              >
                {members.filter((m) => m.core).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.role}
                  </option>
                ))}
              </select>

              <div className={cn('mt-3 transition-opacity duration-comp', previewLoading && 'opacity-40')}>
                <p className="text-body-sm font-semibold text-neutral-950">可见空间</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {preview.visibleSpaces.map((s) => (
                    <span key={s} className="rounded-pill bg-brand-50 px-2.5 py-1 text-caption font-medium text-brand-700">
                      {s}
                    </span>
                  ))}
                  {preview.trimmedSpaces.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-pill bg-neutral-100 px-2.5 py-1 text-caption text-neutral-400 line-through">
                      <Lock className="h-3 w-3" />
                      {s}
                    </span>
                  ))}
                </div>

                <p className="mt-4 text-body-sm font-semibold text-neutral-950">答案裁剪演示</p>
                <div className="mt-1.5 rounded-lg border border-neutral-200 bg-surface-soft p-3">
                  <p className="text-caption text-neutral-400">示例问题：{preview.demoQuestion}</p>
                  {preview.trimmedItems.length > 0 ? (
                    <>
                      <p className="mt-2 rounded-md bg-warning-bg px-3 py-2 text-body-sm text-neutral-800">{preview.refusal}</p>
                      <p className="mt-2 text-caption font-medium text-neutral-500">被裁剪内容：</p>
                      <ul className="mt-1 flex flex-col gap-1">
                        {preview.trimmedItems.map((t) => (
                          <li key={t.name} className="flex items-center gap-1.5 text-caption text-neutral-500">
                            <Lock className="h-3 w-3 text-neutral-400" />
                            {t.name} · {t.scope}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="mt-2 rounded-md bg-success-bg px-3 py-2 text-body-sm text-success">{preview.refusal}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const other = members.find((m) => m.core && m.id !== previewId)
                    setCompareId(other?.id ?? '')
                    setCompareOpen(true)
                  }}
                  className="mt-3 text-body-sm font-medium text-brand-600 hover:text-brand-500"
                >
                  对比另一位成员 ›
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      {/* Row 3：角色权限矩阵 */}
      <div className="mt-4">
        <SectionCard title="角色权限矩阵" icon={<Grid3X3 className="h-5 w-3.5" />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="h-10 bg-surface-soft text-body-sm text-neutral-500">
                  <th className="rounded-l-md px-3 font-normal">权限项</th>
                  {ROLE_COLUMNS.map((c) => (
                    <th key={c.role} className={cn('px-3 text-center font-normal', c.locked && 'bg-neutral-100/60')}>
                      <span className="inline-flex items-center gap-1">
                        {c.role}
                        {c.locked && <Lock className="h-3 w-3 text-neutral-400" />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_ITEMS.map((p) => (
                  <tr key={p.key} className="h-12 border-b border-neutral-100">
                    <td className="rounded-l-md px-3">
                      <span className="text-body-sm font-medium text-neutral-950" title={p.tip}>
                        {p.name}
                      </span>
                      <span className="block text-caption text-neutral-400">{p.tip}</span>
                    </td>
                    {ROLE_COLUMNS.map((c) => {
                      const on = cellValue(p.key, c.role)
                      const changed = pendingChanges.some((x) => x.item === p.key && x.role === c.role)
                      return (
                        <td key={c.role} className={cn('px-3 text-center', c.locked && 'bg-neutral-100/60')}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            disabled={c.locked}
                            title={c.locked ? '管理员默认拥有全部权限' : p.tip}
                            onClick={() => toggleMatrixCell(p.key, c.role, c.locked)}
                            className={cn(
                              'inline-flex h-5 w-5 items-center justify-center rounded-sm border transition-all duration-micro ease-brand',
                              c.locked
                                ? 'cursor-not-allowed border-neutral-300 bg-neutral-200 text-neutral-400'
                                : on
                                  ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-500'
                                  : 'border-neutral-300 bg-white hover:border-brand-300',
                              changed && 'ring-2 ring-warning-accent/50',
                            )}
                          >
                            {on && <Check className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-caption text-neutral-400">管理员列默认全选并锁定；勾选变更需确认后生效（L3）。</p>
        </SectionCard>
      </div>

      {/* Row 3 下：权限审计日志 */}
      <div className="mt-4">
        <SectionCard
          title="权限审计日志"
          icon={<History className="h-5 w-5" />}
          actions={
            <button
              type="button"
              onClick={exportAuditCsv}
              className="text-body-sm font-medium text-brand-600 hover:text-brand-500"
            >
              导出审计日志 ›
            </button>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              value={auditType}
              onChange={(e) => setAuditType(e.target.value)}
              className="h-9 rounded-md border border-neutral-200 bg-white px-2.5 text-body-sm text-neutral-700 focus:border-brand-500 focus:outline-none"
            >
              {['全部', '成员', '空间', '文档', '系统'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              value={auditRange}
              onChange={(e) => setAuditRange(e.target.value as '7' | '30')}
              className="h-9 rounded-md border border-neutral-200 bg-white px-2.5 text-body-sm text-neutral-700 focus:border-brand-500 focus:outline-none"
            >
              <option value="7">近 7 天</option>
              <option value="30">近 30 天</option>
            </select>
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="搜索操作 / 对象 / 操作人"
                className="h-9 w-full rounded-md border border-neutral-200 pl-8 pr-3 text-body-sm text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="h-10 bg-surface-soft text-body-sm text-neutral-500">
                  <th className="rounded-l-md px-3 font-normal">时间</th>
                  <th className="px-3 font-normal">操作人</th>
                  <th className="px-3 font-normal">动作</th>
                  <th className="px-3 font-normal">对象</th>
                  <th className="rounded-r-md px-3 text-right font-normal">结果</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="h-11 border-b border-neutral-100 text-body-sm transition-colors duration-micro ease-brand hover:bg-surface-page">
                    <td className="rounded-l-md px-3 text-neutral-500">{l.time}</td>
                    <td className="px-3 text-neutral-700">{l.operator}</td>
                    <td className="px-3 text-neutral-700">{l.action}</td>
                    <td className="px-3 text-neutral-500">{l.target}</td>
                    <td className="rounded-r-md px-3 text-right">
                      <span
                        className={cn(
                          'rounded-pill px-2 py-0.5 text-caption font-medium',
                          l.resultTone === 'success' ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning',
                        )}
                      >
                        {l.resultTone === 'success' ? '✅' : '⚠'} {l.result}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="h-20 text-center text-body-sm text-neutral-400">
                      没有符合条件的审计记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {/* 矩阵浮动确认条 */}
      {pendingChanges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          className="fixed bottom-6 left-1/2 z-[65] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-3 shadow-float"
        >
          <span className="text-body-sm font-medium text-neutral-950">{pendingChanges.length} 项权限变更待确认</span>
          <button
            type="button"
            onClick={() => setPendingChanges([])}
            className="h-9 rounded-md border border-neutral-200 px-4 text-body-sm text-neutral-700 hover:border-brand-300 hover:text-brand-600"
          >
            放弃
          </button>
          <button
            type="button"
            onClick={() => setShowMatrixConfirm(true)}
            className="h-9 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white hover:bg-brand-500"
          >
            确认变更
          </button>
        </motion.div>
      )}

      {/* 邀请成员 Modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="邀请成员" description="支持批量粘贴邮箱（每行一个）" width={520}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-body-sm font-semibold text-neutral-950">姓名</p>
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="成员姓名"
                className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 px-3 text-body-sm text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
              />
            </div>
            <div>
              <p className="text-body-sm font-semibold text-neutral-950">邮箱</p>
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@example.com"
                className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 px-3 text-body-sm text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-body-sm font-semibold text-neutral-950">角色</p>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as CoreRole)}
                className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-body-sm font-semibold text-neutral-950">用户组</p>
              <select
                value={inviteGroup}
                onChange={(e) => setInviteGroup(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
              >
                {['销售部', '售前部', '客服部', '产品部', 'IT 部', '总经办'].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowInvite(false)}
            className="h-10 rounded-md px-4 text-body-sm text-neutral-500 hover:bg-neutral-100"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!inviteName.trim() || !/.+@.+\..+/.test(inviteEmail)}
            onClick={() => {
              setShowInvite(false)
              toast.success(`已向 ${inviteEmail} 发送邀请（角色：${inviteRole} · 用户组：${inviteGroup}）`)
              setInviteName('')
              setInviteEmail('')
            }}
            className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            发送邀请
          </button>
        </div>
      </Modal>

      {/* 成员权限编辑 Drawer */}
      <SideDrawer
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `编辑成员权限 · ${editTarget.name}` : ''}
        width={480}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditTarget(null)}
              className="h-9 rounded-md px-4 text-body-sm text-neutral-500 hover:bg-neutral-100"
            >
              取消
            </button>
            <button
              type="button"
              onClick={saveMemberEdit}
              className="h-9 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white hover:bg-brand-500"
            >
              保存修改
            </button>
          </div>
        }
      >
        {editTarget && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 rounded-lg bg-surface-soft p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-body font-semibold text-brand-700">
                {editTarget.name[0]}
              </span>
              <div>
                <p className="text-body-sm font-semibold text-neutral-950">{editTarget.name}</p>
                <p className="text-caption text-neutral-500">
                  {editTarget.dept} · 当前角色 {editTarget.role}
                </p>
              </div>
            </div>
            <div>
              <p className="text-body-sm font-semibold text-neutral-950">角色</p>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as CoreRole)}
                className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              {editRole !== editTarget.role && (
                <p className="mt-1.5 text-caption text-warning">角色变更属于 L3 操作，保存时将弹出确认卡。</p>
              )}
            </div>
            <div>
              <p className="text-body-sm font-semibold text-neutral-950">空间权限</p>
              <div className="mt-1.5 flex flex-col gap-1 rounded-lg border border-neutral-200 p-2">
                {ALL_SPACES.map((s) => {
                  const on = editSpaces.includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditSpaces((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))}
                      className="flex h-10 items-center gap-2.5 rounded-md px-2.5 text-left transition-colors duration-micro ease-brand hover:bg-surface-page"
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-sm border transition-colors duration-micro ease-brand',
                          on ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300 bg-white',
                        )}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="text-body-sm text-neutral-800">{s}</span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-caption text-neutral-400">保存后立即生效；未授权空间的内容不会进入该成员的检索与回答。</p>
            </div>
          </div>
        )}
      </SideDrawer>

      {/* L3 确认卡：角色变更 */}
      <Modal open={roleConfirm !== null} onClose={() => setRoleConfirm(null)} width={560}>
        {roleConfirm && (
          <ConfirmationCard
            title="确认角色变更"
            description="角色变更将立即影响该成员的可见范围"
            fields={[
              { label: '动作', value: `将${roleConfirm.member.name}的角色从「${roleConfirm.from}」调整为「${roleConfirm.to}」` },
              { label: '影响对象', value: `${roleConfirm.member.name}（${roleConfirm.member.dept}）` },
              { label: '影响范围', value: `空间权限：${editSpaces.join('、') || '无'}；影响 ${editSpaces.length > 0 ? editSpaces.length * 24 : 0} 份文档的可见性` },
              { label: '可撤销性', value: '可再次编辑恢复为原角色' },
            ]}
            confirmText="确认变更"
            onConfirm={() => applyMemberEdit(roleConfirm.member, roleConfirm.to, editSpaces)}
            onModify={() => setRoleConfirm(null)}
            onCancel={() => setRoleConfirm(null)}
          />
        )}
      </Modal>

      {/* L3 确认卡：矩阵批量变更 */}
      <Modal open={showMatrixConfirm} onClose={() => setShowMatrixConfirm(false)} width={560}>
        <ConfirmationCard
          title="确认权限矩阵变更"
          description="变更后立即对对应角色的所有成员生效"
          fields={[
            { label: '动作', value: `调整 ${pendingChanges.length} 项角色权限` },
            { label: '影响角色', value: [...new Set(pendingChanges.map((c) => c.role))].join('、') },
            { label: '影响成员', value: `约 ${affectedMembers} 名成员的权限范围将变化` },
            { label: '可撤销性', value: '可在矩阵中再次勾选恢复，全程记入审计日志' },
          ]}
          confirmText="确认变更"
          onConfirm={confirmMatrix}
          onModify={() => setShowMatrixConfirm(false)}
          onCancel={() => setShowMatrixConfirm(false)}
        />
      </Modal>

      {/* 五层权限配置 Drawer（L1..L5 按卡片下标） */}
      <SideDrawer
        open={layerDrawer !== null}
        onClose={() => setLayerDrawer(null)}
        title={layerDrawer !== null ? LAYER_DRAWER_META[layerDrawer].title : ''}
        width={480}
        footer={
          <div className="flex items-center justify-between gap-2">
            <p className="text-caption text-neutral-400">{layerDrawer !== null ? LAYER_DRAWER_META[layerDrawer].desc : ''}</p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setLayerDrawer(null)}
                className="h-9 rounded-md px-4 text-body-sm text-neutral-500 hover:bg-neutral-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveLayerDrawer}
                className="h-9 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white hover:bg-brand-500"
              >
                保存配置
              </button>
            </div>
          </div>
        }
      >
        {layerDraft && layerDrawer === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-body-sm text-neutral-500">关闭后该空间对未授权成员不可见，内容不进入检索与回答。</p>
            {Object.entries(layerDraft.spaceVisibility).map(([space, on]) => (
              <ToggleRow
                key={space}
                label={space}
                desc={on ? '对授权成员可见' : '已隐藏'}
                on={on}
                onToggle={() =>
                  setLayerDraft((d) => d && { ...d, spaceVisibility: { ...d.spaceVisibility, [space]: !on } })
                }
              />
            ))}
          </div>
        )}
        {layerDraft && layerDrawer === 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-neutral-500">新成员加入企业时自动授予的默认角色，可随后在成员表中单独调整。</p>
            <select
              value={layerDraft.defaultRole}
              onChange={(e) => setLayerDraft((d) => d && { ...d, defaultRole: e.target.value as CoreRole })}
              className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
            >
              {ALL_ROLES.filter((r) => r !== '管理员').map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <p className="rounded-lg bg-brand-50 px-3.5 py-2.5 text-body-sm text-brand-700">
              当前默认角色：{layerDraft.defaultRole}（不可设为管理员，管理员需手动授予）。
            </p>
          </div>
        )}
        {layerDraft && layerDrawer === 2 && (
          <div className="flex flex-col gap-2">
            <p className="text-body-sm text-neutral-500">启用的密级标签可用于文档打标；停用后新文档不可再使用该密级。</p>
            {Object.entries(layerDraft.docSecLabels).map(([label, on]) => (
              <ToggleRow
                key={label}
                label={`${label}文档`}
                desc={on ? '可打标并按密级裁剪' : '已停用'}
                on={on}
                onToggle={() => setLayerDraft((d) => d && { ...d, docSecLabels: { ...d.docSecLabels, [label]: !on } })}
              />
            ))}
          </div>
        )}
        {layerDraft && layerDrawer === 3 && (
          <div className="flex flex-col gap-2">
            <p className="text-body-sm text-neutral-500">开启后对应字段在检索结果与答案中自动脱敏展示。</p>
            {Object.entries(layerDraft.fieldMasking).map(([field, on]) => (
              <ToggleRow
                key={field}
                label={field}
                desc={on ? '答案中脱敏展示（如 138****0001）' : '按原文展示'}
                on={on}
                onToggle={() => setLayerDraft((d) => d && { ...d, fieldMasking: { ...d.fieldMasking, [field]: !on } })}
              />
            ))}
          </div>
        )}
        {layerDraft && layerDrawer === 4 && (
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-neutral-500">行级规则按条件裁剪结构化数据记录，对问答与表格检索同时生效。</p>
            {layerDraft.rowRules.length === 0 && (
              <p className="rounded-lg bg-surface-soft px-3.5 py-2.5 text-body-sm text-neutral-500">暂无行级规则。</p>
            )}
            {layerDraft.rowRules.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-body-sm font-medium text-neutral-950">{r.name}</p>
                  <p className="truncate text-caption text-neutral-400">{r.condition}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLayerDraft((d) => d && { ...d, rowRules: d.rowRules.filter((x) => x.id !== r.id) })}
                  className="shrink-0 text-body-sm text-danger hover:brightness-110"
                >
                  删除
                </button>
              </div>
            ))}
            <div className="rounded-lg border border-dashed border-neutral-300 p-3">
              <p className="text-body-sm font-semibold text-neutral-950">添加规则</p>
              <input
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                placeholder="规则名称，如：销售仅见本部线索"
                className="mt-2 h-10 w-full rounded-md border border-neutral-200 px-3 text-body-sm text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
              />
              <input
                value={newRuleCond}
                onChange={(e) => setNewRuleCond(e.target.value)}
                placeholder="条件表达式，如：dept = 当前用户部门"
                className="mt-2 h-10 w-full rounded-md border border-neutral-200 px-3 text-body-sm text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
              />
              <button
                type="button"
                disabled={!newRuleName.trim() || !newRuleCond.trim()}
                onClick={() => {
                  setLayerDraft(
                    (d) =>
                      d && {
                        ...d,
                        rowRules: [...d.rowRules, { id: `r-${Date.now()}`, name: newRuleName.trim(), condition: newRuleCond.trim() }],
                      },
                  )
                  setNewRuleName('')
                  setNewRuleCond('')
                }}
                className="mt-2 h-9 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                添加规则
              </button>
            </div>
          </div>
        )}
      </SideDrawer>

      {/* 手动映射 Modal */}
      <Modal
        open={manualMap !== null}
        onClose={() => setManualMap(null)}
        title="手动身份映射"
        description="将未映射账号绑定到企业账号，立即计入覆盖率"
        width={520}
        footer={
          <>
            <button
              type="button"
              onClick={() => setManualMap(null)}
              className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!manualAccount}
              onClick={confirmManualMap}
              className={cn(
                'h-10 rounded-md bg-brand-600 px-5 text-body font-medium text-white hover:bg-brand-500',
                !manualAccount && 'cursor-not-allowed bg-neutral-100 text-neutral-400 hover:bg-neutral-100',
              )}
            >
              绑定
            </button>
          </>
        }
      >
        {manualMap && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-body-sm font-semibold text-neutral-950">未映射账号</p>
              <select
                value={manualMap.memberId}
                onChange={(e) => {
                  const next = unmapped.find((u) => u.memberId === e.target.value)
                  if (next) setManualMap(next)
                }}
                className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
              >
                {unmapped.map((u) => (
                  <option key={u.memberId} value={u.memberId}>
                    {u.name} — {u.detail}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-body-sm font-semibold text-neutral-950">企业账号</p>
              <select
                value={manualAccount}
                onChange={(e) => setManualAccount(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
              >
                {accountPool.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              {accountPool.length === 0 && (
                <p className="mt-1.5 text-caption text-warning">企业账号池已用完，请先同步组织架构。</p>
              )}
            </div>
            <p className="rounded-lg bg-surface-soft px-3.5 py-2.5 text-caption text-neutral-500">
              绑定后该成员立即完成身份映射并计入覆盖率，操作记入审计日志。
            </p>
          </div>
        )}
      </Modal>

      {/* 成员对比 Modal */}
      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="成员权限对比"
        description="双列对照两名成员的角色、空间与权限差异"
        width={720}
      >
        {(() => {
          const base = members.find((m) => m.id === previewId)
          const other = members.find((m) => m.id === compareId)
          if (!base) return null
          return (
            <div>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-surface-soft px-3.5 py-2.5">
                  <p className="text-caption text-neutral-400">成员 A（预览中）</p>
                  <p className="text-body font-semibold text-neutral-950">
                    {base.name} · {base.role}
                  </p>
                </div>
                <div>
                  <p className="text-caption text-neutral-400">成员 B</p>
                  <select
                    value={compareId}
                    onChange={(e) => setCompareId(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
                  >
                    {members
                      .filter((m) => m.core && m.id !== previewId)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {m.role}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              {other && (
                <table className="w-full text-left">
                  <thead>
                    <tr className="h-10 bg-surface-soft text-body-sm text-neutral-500">
                      <th className="rounded-l-md px-3 font-normal">对比项</th>
                      <th className="px-3 font-normal">{base.name}</th>
                      <th className="rounded-r-md px-3 font-normal">{other.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ['部门', base.dept, other.dept],
                        ['角色', base.role, other.role],
                        ['空间权限', base.spaces, other.spaces],
                        ['身份映射', base.mappingLabel, other.mappingLabel],
                        ['最近活跃', base.lastActive, other.lastActive],
                      ] as const
                    ).map(([label, a, b]) => (
                      <tr key={label} className="h-11 border-b border-neutral-100 text-body-sm">
                        <td className="px-3 font-medium text-neutral-950">{label}</td>
                        <td className={cn('px-3', a !== b ? 'font-medium text-brand-700' : 'text-neutral-700')}>{a}</td>
                        <td className={cn('px-3', a !== b ? 'font-medium text-brand-700' : 'text-neutral-700')}>{b}</td>
                      </tr>
                    ))}
                    {PERMISSION_ITEMS.map((p) => {
                      const a = matrix[p.key][base.role]
                      const b = matrix[p.key][other.role]
                      return (
                        <tr key={p.key} className="h-10 border-b border-neutral-100 text-body-sm">
                          <td className="px-3 font-medium text-neutral-950">权限 · {p.name}</td>
                          <td className={cn('px-3', a ? 'text-success' : 'text-neutral-400')}>{a ? '✅ 允许' : '— 禁止'}</td>
                          <td className={cn('px-3', b ? 'text-success' : 'text-neutral-400')}>{b ? '✅ 允许' : '— 禁止'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )
        })()}
      </Modal>

    </div>
  )
}
