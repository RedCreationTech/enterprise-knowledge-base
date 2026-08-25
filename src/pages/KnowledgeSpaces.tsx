/**
 * 知识空间 KnowledgeSpaces（/workspace/spaces，spaces.md）
 * Row1 4 张 MetricCard；Row2 左 8 列空间卡片网格（2×3）+ 跨空间冲突提示条；右 4 列空间详情侧栏。
 * 交互：卡片选中联动侧栏；新建空间两步向导 Modal；冲突「对比版本」Drawer /「指定权威版本」L2 确认卡；
 * 空间管理 Drawer（基本信息 / 成员管理 / 空间文档 / 危险区：归档 L3 · 删除 L4）；草稿空间发布 L2；
 * 策略编辑 Modal；空间内问答 Modal；空间分析 Drawer（recharts）；空间健康报告 Drawer + .md 下载。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Archive,
  BarChart3,
  BookOpen,
  Briefcase,
  ClipboardList,
  Download,
  FileWarning,
  FolderKanban,
  Globe,
  Headset,
  MessageSquarePlus,
  Package,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { DemoEmptyState, MetricCard, StatusBadge, ConfirmationCard } from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { Modal } from '@/pages/workspace/Modal'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { useAppToast } from '@/lib/toast'
import { ANSWER_POOL, useAppStore } from '@/mocks'
import {
  EXPIRE_HANDLING_OPTIONS,
  MEMBER_ROLE_OPTIONS,
  OWNER_OPTIONS,
  SPACES,
  SPACE_ANALYTICS,
  SPACE_CONFLICTS,
  SPACE_DOCS,
  SPACE_HEALTH,
  SPACE_ICON_CHOICES,
  VALIDITY_OPTIONS,
  VISIBILITY_OPTIONS,
} from '@/pages/workspace/spacesData'
import type { SpaceAnalytics, SpaceConflict, SpaceDoc, SpaceItem } from '@/pages/workspace/spacesData'

const ICONS: Record<string, LucideIcon> = {
  globe: Globe,
  clipboard: ClipboardList,
  package: Package,
  briefcase: Briefcase,
  wrench: Wrench,
  book: BookOpen,
  headset: Headset,
  shield: ShieldCheck,
}

const BTN_PRIMARY =
  'inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400'
const BTN_SECONDARY =
  'inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600'
const BTN_TERTIARY =
  'inline-flex h-8 items-center gap-1 rounded-md px-2 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50'
const INPUT_CLS =
  'h-11 w-full rounded-md border border-[#DCE4EF] bg-white px-3 text-body text-neutral-800 outline-none transition-shadow duration-micro ease-brand placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input'

type ManageTab = 'info' | 'members' | 'docs' | 'danger'

type ConfirmAction =
  | { kind: 'publish'; space: SpaceItem }
  | { kind: 'removeMember'; space: SpaceItem; member: string }
  | { kind: 'removeDoc'; space: SpaceItem; doc: SpaceDoc }

const MANAGE_TABS: { key: ManageTab; label: string }[] = [
  { key: 'info', label: '基本信息' },
  { key: 'members', label: '成员管理' },
  { key: 'docs', label: '空间文档' },
  { key: 'danger', label: '危险区' },
]

/** 空间内提问演示答案（复用 ANSWER_POOL 折扣审批权威口径） */
const QA_DEMO = ANSWER_POOL['客户报价折扣超过 10% 需要谁审批？']

function SpaceIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? Globe
  return (
    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600', className)}>
      <Icon className="h-5 w-5" />
    </span>
  )
}

function switchCls(on: boolean) {
  return cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-comp ease-brand', on ? 'bg-brand-600' : 'bg-neutral-300')
}

export default function KnowledgeSpaces() {
  const toast = useAppToast()
  const navigate = useNavigate()
  const { state } = useAppStore()
  // 冷启动空态：未载入演示数据时展示引导空态（评审 P1-N1）
  const demoOff = state.demoData === false
  const [spaces, setSpaces] = useState<SpaceItem[]>(SPACES)
  const [conflicts, setConflicts] = useState<SpaceConflict[]>(SPACE_CONFLICTS)
  const [selectedId, setSelectedId] = useState(SPACES[0].id)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [compareFor, setCompareFor] = useState<SpaceConflict | null>(null)
  const [confirmConflict, setConfirmConflict] = useState<SpaceConflict | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [guideSpaceId, setGuideSpaceId] = useState<string | null>(null)

  // 空间管理 Drawer
  const [manage, setManage] = useState<{ id: string; tab: ManageTab } | null>(null)
  const [mName, setMName] = useState('')
  const [mDesc, setMDesc] = useState('')
  const [mIcon, setMIcon] = useState<string>(SPACE_ICON_CHOICES[0])
  const [mScope, setMScope] = useState<string>('org')
  const [mValidity, setMValidity] = useState(180)
  const [mOwner, setMOwner] = useState(OWNER_OPTIONS[0])
  const [addName, setAddName] = useState('')
  const [addRole, setAddRole] = useState<string>(MEMBER_ROLE_OPTIONS[2])
  const [spaceDocs, setSpaceDocs] = useState<Record<string, SpaceDoc[]>>(SPACE_DOCS)

  // L2 确认（发布 / 移除成员 / 移出文档）· L3 归档 · L4 删除
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [archiveFor, setArchiveFor] = useState<SpaceItem | null>(null)
  const [archiveAck, setArchiveAck] = useState(false)
  const [deleteFor, setDeleteFor] = useState<SpaceItem | null>(null)
  const [deleteInput, setDeleteInput] = useState('')

  // 策略编辑 / 空间问答 / 空间分析 / 健康报告
  const [policyFor, setPolicyFor] = useState<string | null>(null)
  const [pCycle, setPCycle] = useState(180)
  const [pExpire, setPExpire] = useState<string>(EXPIRE_HANDLING_OPTIONS[0])
  const [pNotify, setPNotify] = useState(true)
  const [qaFor, setQaFor] = useState<string | null>(null)
  const [qaQuestion, setQaQuestion] = useState('')
  const [qaAnswer, setQaAnswer] = useState<(typeof QA_DEMO) | null>(null)
  const [analyticsFor, setAnalyticsFor] = useState<string | null>(null)
  const [healthOpen, setHealthOpen] = useState(false)

  // 向导表单
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formIcon, setFormIcon] = useState<string>(SPACE_ICON_CHOICES[0])
  const [formScope, setFormScope] = useState<string>('org')
  const [formValidity, setFormValidity] = useState(180)
  const [formOwner, setFormOwner] = useState(OWNER_OPTIONS[0])
  const [formAiUse, setFormAiUse] = useState(true)

  const openConflicts = conflicts.filter((c) => c.status === 'open')
  const visibleSpaces = useMemo(() => spaces.filter((s) => s.status !== 'ARCHIVED'), [spaces])
  const selected = useMemo(
    () => visibleSpaces.find((s) => s.id === selectedId) ?? visibleSpaces[0],
    [visibleSpaces, selectedId],
  )
  const manageSpace = useMemo(() => spaces.find((s) => s.id === manage?.id) ?? null, [spaces, manage])
  const publishedCount = visibleSpaces.filter((s) => s.status === 'PUBLISHED').length
  const draftCount = visibleSpaces.filter((s) => s.status === 'DRAFT').length
  const nameValid = formName.trim().length >= 2 && formName.trim().length <= 30

  const patchSpace = (id: string, patch: Partial<SpaceItem>) => {
    setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const healthOf = (s: SpaceItem) =>
    SPACE_HEALTH.find((h) => h.id === s.id) ?? {
      id: s.id,
      score: 90,
      issues: ['新建空间，数据仍在积累'],
      suggestions: ['上传资料并邀请成员共建后即可生成完整评估'],
    }

  const analyticsOf = (s: SpaceItem): SpaceAnalytics =>
    SPACE_ANALYTICS[s.id] ?? {
      trend: ['W16', 'W17', 'W18', 'W19', 'W20', 'W21', 'W22', 'W23'].map((week, i) => ({
        week,
        questions: Math.max(0, Math.round((s.questions / 8) * (i + 1) * 0.6)),
        docs: Math.max(0, Math.round((s.docs / 8) * (i + 1))),
      })),
      contributors: [{ name: s.owner, answers: Math.max(1, Math.round(s.questions / 3)) }],
    }

  const openManage = (id: string, tab: ManageTab = 'info') => {
    const s = spaces.find((x) => x.id === id)
    if (!s) return
    setManage({ id, tab })
    setMName(s.name)
    setMDesc(s.desc)
    setMIcon(s.icon)
    setMScope(s.scope.startsWith('指定团队') ? 'team' : s.scope.startsWith('仅成员') ? 'private' : 'org')
    const m = s.policy.cycle.match(/(\d+)\s*天/)
    setMValidity(m ? Number(m[1]) : 180)
    setMOwner(s.owner)
    setAddName('')
    setAddRole(MEMBER_ROLE_OPTIONS[2])
  }

  const saveSpaceInfo = () => {
    if (!manageSpace || mName.trim().length < 2) return
    const scopeLabel = VISIBILITY_OPTIONS.find((v) => v.value === mScope)?.label ?? manageSpace.scope
    const renamed = mName.trim() !== manageSpace.name
    patchSpace(manageSpace.id, {
      name: mName.trim(),
      desc: mDesc.trim() || manageSpace.desc,
      icon: mIcon,
      scope: scopeLabel,
      owner: mOwner,
      ownerAvatar: mOwner[0],
      policy: { ...manageSpace.policy, cycle: `默认 ${mValidity} 天复审` },
      updatedAt: '刚刚',
    })
    toast.success(renamed ? `空间已重命名为「${mName.trim()}」，基本信息已保存` : '空间基本信息已保存')
  }

  const addMember = () => {
    if (!manageSpace || !addName) return
    patchSpace(manageSpace.id, {
      memberRows: [...manageSpace.memberRows, { name: addName, role: addRole, joinedAt: '今天' }],
      members: manageSpace.members + 1,
      updatedAt: '刚刚',
    })
    toast.success(`已添加成员「${addName}」（${addRole}）`)
    setAddName('')
  }

  const changeMemberRole = (space: SpaceItem, name: string, role: string) => {
    patchSpace(space.id, {
      memberRows: space.memberRows.map((m) => (m.name === name ? { ...m, role } : m)),
      updatedAt: '刚刚',
    })
    toast.success(`已将「${name}」的角色调整为${role}`)
  }

  const openPolicy = (s: SpaceItem) => {
    setPolicyFor(s.id)
    const m = s.policy.cycle.match(/(\d+)\s*天/)
    setPCycle(m ? Number(m[1]) : 180)
    setPExpire(s.policy.onExpire)
    setPNotify(s.policy.notify ?? true)
  }

  const savePolicy = () => {
    if (!policyFor) return
    const s = spaces.find((x) => x.id === policyFor)
    if (!s) return
    patchSpace(policyFor, {
      policy: { cycle: `默认 ${pCycle} 天复审`, onExpire: pExpire, notify: pNotify },
      updatedAt: '刚刚',
    })
    setPolicyFor(null)
    toast.success(`「${s.name}」有效期策略已保存`)
  }

  const goUploadToSpace = (spaceName: string) => {
    navigate('/workspace/knowledge-base')
    toast.info(`已切换到知识库，请在「${spaceName}」空间筛选下点击「上传资料」`)
  }

  const askQuestion = () => {
    if (!qaQuestion.trim() || !qaFor) return
    setQaAnswer(QA_DEMO)
    setSpaces((prev) => prev.map((s) => (s.id === qaFor ? { ...s, questions: s.questions + 1 } : s)))
  }

  const downloadHealthReport = () => {
    const lines: string[] = ['# 空间健康报告', '', `生成时间：${new Date().toLocaleString('zh-CN')}`, '']
    visibleSpaces.forEach((s) => {
      const h = healthOf(s)
      lines.push(
        `## ${s.name}`,
        `- 健康分：${h.score} / 100`,
        `- 状态：${s.status === 'PUBLISHED' ? '已发布' : '草稿'} · Owner：${s.owner}`,
        `- 文档 ${s.docs} 份 · 问题 ${s.questions} 条 · 成员 ${s.members} 人`,
        `- 待处理问题（${h.issues.length}）：`,
      )
      h.issues.forEach((i) => lines.push(`  - ${i}`))
      lines.push('- 治理建议：')
      h.suggestions.forEach((i) => lines.push(`  - ${i}`))
      lines.push('')
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '空间健康报告.md'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('空间健康报告已下载（.md）')
  }

  const resetWizard = () => {
    setWizardStep(1)
    setFormName('')
    setFormDesc('')
    setFormIcon(SPACE_ICON_CHOICES[0])
    setFormScope('org')
    setFormValidity(180)
    setFormOwner(OWNER_OPTIONS[0])
    setFormAiUse(true)
  }

  const createSpace = () => {
    if (!nameValid) return
    const scopeLabel = VISIBILITY_OPTIONS.find((v) => v.value === formScope)?.label ?? '组织内全员'
    const id = `space-${Date.now().toString(36)}`
    const space: SpaceItem = {
      id,
      name: formName.trim(),
      icon: formIcon,
      status: 'DRAFT',
      desc: formDesc.trim() || '新建空间，等待补充资料与成员',
      docs: 0,
      questions: 0,
      members: 1,
      owner: formOwner,
      ownerAvatar: formOwner[0],
      updatedAt: '刚刚',
      scope: scopeLabel,
      createdAt: '2024-05-30',
      policy: { cycle: `默认 ${formValidity} 天复审`, onExpire: '降权并提醒 Owner', notify: true },
      memberRows: [{ name: formOwner, role: '管理员', joinedAt: '今天' }],
      draftNote: '草稿空间：内容暂不进入 AI 助手引用范围，发布后自动生效。',
    }
    setSpaces((prev) => [...prev, space])
    setWizardOpen(false)
    resetWizard()
    setSelectedId(id)
    setGuideSpaceId(id)
    toast.success(`空间「${space.name}」已创建，现在可以上传资料或设置成员`)
  }

  const resolveConflict = () => {
    if (!confirmConflict) return
    setConfirmLoading(true)
    setTimeout(() => {
      setConflicts((prev) => prev.map((c) => (c.id === confirmConflict.id ? { ...c, status: 'resolved' } : c)))
      setConfirmLoading(false)
      setConfirmConflict(null)
      toast.success('冲突已解决，相关答案已更新')
    }, 800)
  }

  /** L2 确认执行：发布空间 / 移除成员 / 移出文档 */
  const runConfirm = () => {
    if (!confirm) return
    setConfirmLoading(true)
    setTimeout(() => {
      if (confirm.kind === 'publish') {
        patchSpace(confirm.space.id, { status: 'PUBLISHED', draftNote: undefined, updatedAt: '刚刚' })
        toast.success(`空间「${confirm.space.name}」已发布，内容已进入 AI 助手引用范围`)
      } else if (confirm.kind === 'removeMember') {
        const s = confirm.space
        patchSpace(s.id, {
          memberRows: s.memberRows.filter((m) => m.name !== confirm.member),
          members: Math.max(0, s.members - 1),
          updatedAt: '刚刚',
        })
        toast.info(`已移除成员「${confirm.member}」`)
      } else {
        setSpaceDocs((prev) => ({
          ...prev,
          [confirm.space.id]: (prev[confirm.space.id] ?? []).filter((d) => d.id !== confirm.doc.id),
        }))
        patchSpace(confirm.space.id, { docs: Math.max(0, confirm.space.docs - 1), updatedAt: '刚刚' })
        toast.info(`已将「${confirm.doc.title}」移出空间`)
      }
      setConfirmLoading(false)
      setConfirm(null)
    }, 600)
  }

  /** L3 归档空间 */
  const archiveSpace = () => {
    if (!archiveFor || !archiveAck) return
    patchSpace(archiveFor.id, { status: 'ARCHIVED', updatedAt: '刚刚' })
    setManage(null)
    if (selectedId === archiveFor.id) {
      setSelectedId(visibleSpaces.find((s) => s.id !== archiveFor.id)?.id ?? 'all')
    }
    toast.success(`空间「${archiveFor.name}」已归档，从列表隐藏，历史文档仍可在知识库查看`)
    setArchiveFor(null)
    setArchiveAck(false)
  }

  /** L4 删除空间（输入名称确认） */
  const deleteSpace = () => {
    if (!deleteFor || deleteInput.trim() !== deleteFor.name) return
    setSpaces((prev) => prev.filter((s) => s.id !== deleteFor.id))
    if (selectedId === deleteFor.id) setSelectedId('all')
    setManage(null)
    toast.success(`空间「${deleteFor.name}」已删除`)
    setDeleteFor(null)
    setDeleteInput('')
  }

  // 冷启动空态：未载入演示数据时只显示页头 + 引导空态（评审 P1-N1）
  if (demoOff) {
    return (
      <div>
        <PageHeader
          crumbs={['知识', '知识空间']}
          title="知识空间"
          subtitle="完成快速配置或载入演示数据后，这里会展示真实的企业知识数据"
        />
        <DemoEmptyState />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        crumbs={['知识', '知识空间']}
        title="知识空间"
        subtitle={`${visibleSpaces.length} 个空间 · 空间内资料 128 份 · 12 名成员 · 数据更新于 今天 10:30`}
        actions={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => setHealthOpen(true)}>
              空间健康报告
            </button>
            <button type="button" className={BTN_PRIMARY} onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" />
              新建知识空间
            </button>
          </>
        }
      />

      {/* Row1 指标 */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          icon={<FolderKanban className="h-4 w-4" />}
          name="知识空间"
          value={visibleSpaces.length}
          suffix="个"
          hint={`${publishedCount} 个已发布 · ${draftCount} 个草稿`}
        />
        <MetricCard icon={<BookOpen className="h-4 w-4" />} name="空间内资料" value={128} suffix="份" delta="+6 份" deltaDirection="up" deltaPositive hint="较上周（连接器文档共 1,286 份另计）" />
        <MetricCard icon={<Users className="h-4 w-4" />} name="空间成员" value={12} suffix="人" hint="覆盖 4 个部门" />
        <MetricCard
          icon={<TriangleAlert className="h-4 w-4" />}
          name="跨空间冲突"
          value={openConflicts.length}
          suffix="处"
          hint={openConflicts.length === 0 ? '均已处理' : openConflicts.some((c) => c.priority === '高') ? '1 处高优先级' : '均为中优先级'}
        />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* 左 8 列：空间卡片 + 冲突条 */}
        <div className="col-span-12 space-y-4 xl:col-span-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visibleSpaces.map((s, i) => {
              const isSel = s.id === selected?.id
              return (
                <motion.div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: Math.min(i, 9) * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
                  onClick={() => {
                    setSelectedId(s.id)
                    setGuideSpaceId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSelectedId(s.id)
                      setGuideSpaceId(null)
                    }
                  }}
                  className={cn(
                    'relative cursor-pointer rounded-xl border bg-white p-5 text-left shadow-card transition-all duration-comp ease-brand hover:border-brand-300 hover:shadow-float',
                    isSel ? 'border-[1.5px] border-brand-500 bg-surface-cardSel' : 'border-neutral-200',
                  )}
                >
                  {s.isDefault && (
                    <span className="absolute left-0 top-0 rounded-br-lg rounded-tl-xl bg-brand-600 px-2 py-0.5 text-caption font-medium text-white">
                      默认
                    </span>
                  )}
                  {openConflicts.length > 0 && (s.id === 'policy' || s.id === 'sales' || s.id === 'all') && (
                    <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-warning" title="存在待处理冲突" />
                  )}
                  <div className="flex items-start gap-3">
                    <SpaceIcon icon={s.icon} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-h3 text-neutral-950">{s.name}</h3>
                        {s.status === 'PUBLISHED' ? (
                          <StatusBadge status="已发布" />
                        ) : (
                          <span className="inline-flex h-6 items-center gap-1 rounded-pill bg-neutral-100 px-2 text-caption font-medium text-neutral-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            草稿
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-body-sm text-neutral-500">{s.desc}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3">
                    {[
                      ['文档', s.docs, '份'],
                      ['问题', s.questions, '条'],
                      ['成员', s.members, '人'],
                    ].map(([label, val, unit]) => (
                      <div key={label as string} className="text-right first:text-left [&:nth-child(2)]:text-center">
                        <p className="text-caption text-neutral-400">{label}</p>
                        <p className="text-body font-semibold text-neutral-950">
                          {val}
                          <span className="ml-0.5 text-caption font-normal text-neutral-400">{unit}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                    <span className="flex items-center gap-1.5 text-caption text-neutral-500">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[11px] font-medium text-brand-600">
                        {s.ownerAvatar}
                      </span>
                      {s.owner} · 更新 {s.updatedAt}
                    </span>
                    <span className="flex items-center gap-2">
                      {s.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirm({ kind: 'publish', space: s })
                          }}
                          className="h-7 rounded-md bg-brand-600 px-2.5 text-caption font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
                        >
                          发布空间
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openManage(s.id, 'info')
                        }}
                        className="text-body-sm font-medium text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
                      >
                        {s.status === 'DRAFT' ? '继续建设 ›' : '管理 ›'}
                      </button>
                    </span>
                  </div>
                  {guideSpaceId === s.id && (
                    <div className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 translate-y-full whitespace-nowrap rounded-md bg-neutral-950 px-3 py-1.5 text-caption text-white shadow-float">
                      现在可以上传资料或设置成员
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* 跨空间冲突提示条 */}
          <AnimatePresence>
            {openConflicts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24 }}
                className="rounded-xl border border-warning/30 bg-warning-bg p-5"
              >
                <div className="flex items-center gap-2">
                  <TriangleAlert className="h-5 w-5 text-warning" />
                  <h3 className="text-h3 text-neutral-950">检测到 {openConflicts.length} 处跨空间知识冲突</h3>
                </div>
                <div className="mt-3 space-y-3">
                  {openConflicts.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/70 p-3.5">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-body font-medium text-neutral-950">
                          {c.title}
                          <span
                            className={cn(
                              'inline-flex h-5 items-center rounded-sm px-1.5 text-caption font-medium',
                              c.priority === '高' ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning',
                            )}
                          >
                            {c.priority}优先级
                          </span>
                        </p>
                        <p className="mt-0.5 text-body-sm text-neutral-500">{c.detail}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {c.id === 'c1' ? (
                          <>
                            <button type="button" className={BTN_SECONDARY + ' !h-8 px-3'} onClick={() => setCompareFor(c)}>
                              对比版本 →
                            </button>
                            <button type="button" className={BTN_PRIMARY + ' !h-8 px-3'} onClick={() => setConfirmConflict(c)}>
                              指定权威版本
                            </button>
                          </>
                        ) : (
                          <button type="button" className={BTN_SECONDARY + ' !h-8 px-3'} onClick={() => setCompareFor(c)}>
                            查看差异 →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 右 4 列：空间详情侧栏 */}
        <div className="col-span-12 xl:col-span-4">
          <AnimatePresence mode="wait">
            {selected && (
              <motion.aside
                key={selected.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-4 xl:sticky xl:top-4"
              >
                <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card">
                  <h3 className="text-h3 text-neutral-950">空间信息</h3>
                  <dl className="mt-3 space-y-2.5 text-body-sm">
                    {[
                      ['名称', selected.name + (selected.isDefault ? '（默认空间）' : '')],
                      ['可见范围', selected.scope],
                      ['创建时间', selected.createdAt],
                      ['状态', selected.status === 'PUBLISHED' ? '已发布' : '草稿'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex gap-3">
                        <dt className="w-16 shrink-0 text-neutral-500">{k}</dt>
                        <dd className="min-w-0 flex-1 text-neutral-800">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {selected.draftNote && (
                    <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning-bg px-3 py-2 text-caption text-warning">
                      <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {selected.draftNote}
                    </p>
                  )}
                  {selected.status === 'DRAFT' && (
                    <button
                      type="button"
                      className={BTN_PRIMARY + ' mt-3 w-full justify-center'}
                      onClick={() => setConfirm({ kind: 'publish', space: selected })}
                    >
                      发布空间
                    </button>
                  )}
                </section>

                <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card">
                  <h3 className="text-h3 text-neutral-950">有效期策略</h3>
                  <p className="mt-2 text-body-sm text-neutral-700">默认复审周期：{selected.policy.cycle}</p>
                  <p className="mt-1.5 text-body-sm text-neutral-700">到期处理：{selected.policy.onExpire}</p>
                  <p className="mt-1.5 text-body-sm text-neutral-700">到期提醒：{(selected.policy.notify ?? true) ? '开启' : '关闭'}</p>
                  <button type="button" className={BTN_TERTIARY + ' mt-2'} onClick={() => openPolicy(selected)}>
                    编辑策略 ›
                  </button>
                </section>

                <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card">
                  <h3 className="text-h3 text-neutral-950">权限成员</h3>
                  <ul className="mt-2 divide-y divide-neutral-100">
                    {selected.memberRows.map((m) => (
                      <li key={m.name} className="flex items-center justify-between py-2.5 text-body-sm">
                        <span className="flex items-center gap-2 text-neutral-800">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-caption font-medium text-brand-600">
                            {m.name[0]}
                          </span>
                          {m.name}
                        </span>
                        <span className="text-neutral-500">{m.role}</span>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={BTN_TERTIARY + ' mt-1'} onClick={() => openManage(selected.id, 'members')}>
                    管理成员 ›
                  </button>
                </section>

                <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card">
                  <h3 className="text-h3 text-neutral-950">快捷操作</h3>
                  <div className="mt-2 flex flex-col items-start gap-1">
                    <button
                      type="button"
                      className={BTN_TERTIARY}
                      onClick={() => {
                        setQaFor(selected.id)
                        setQaQuestion('')
                        setQaAnswer(null)
                      }}
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                      在空间内提问
                    </button>
                    <button type="button" className={BTN_TERTIARY} onClick={() => goUploadToSpace(selected.name)}>
                      <Upload className="h-4 w-4" />
                      上传资料到此空间
                    </button>
                    <button type="button" className={BTN_TERTIARY} onClick={() => setAnalyticsFor(selected.id)}>
                      <BarChart3 className="h-4 w-4" />
                      查看空间分析
                    </button>
                  </div>
                </section>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 新建空间向导 */}
      <Modal
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false)
          resetWizard()
        }}
        title="新建知识空间"
        description={wizardStep === 1 ? '第 1 步 / 共 2 步 · 基本信息' : '第 2 步 / 共 2 步 · 权限与策略'}
        width={560}
        footer={
          <>
            {wizardStep === 2 && (
              <button type="button" className={BTN_SECONDARY} onClick={() => setWizardStep(1)}>
                上一步
              </button>
            )}
            {wizardStep === 1 ? (
              <button type="button" className={BTN_PRIMARY} disabled={!nameValid} onClick={() => setWizardStep(2)}>
                下一步
              </button>
            ) : (
              <button type="button" className={BTN_PRIMARY} disabled={!nameValid} onClick={createSpace}>
                创建空间
              </button>
            )}
          </>
        }
      >
        {wizardStep === 1 ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">
                空间名称 <span className="text-danger">*</span>
              </label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例如：售后服务知识库"
                className={INPUT_CLS}
              />
              <p className={cn('mt-1 text-caption', nameValid || formName.length === 0 ? 'text-neutral-400' : 'text-danger')}>
                必填，2–30 字{formName.length > 0 && `（当前 ${formName.trim().length} 字）`}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">空间说明</label>
              <div className="relative">
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value.slice(0, 100))}
                  placeholder="一句话说明这个空间的用途（选填）"
                  className="min-h-[88px] w-full resize-none rounded-md border border-[#DCE4EF] p-3 text-body text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input"
                />
                <span className="absolute bottom-2 right-3 text-caption text-neutral-400">{formDesc.length}/100</span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">空间图标</label>
              <div className="grid grid-cols-8 gap-2">
                {SPACE_ICON_CHOICES.map((key) => {
                  const Icon = ICONS[key]
                  const on = formIcon === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormIcon(key)}
                      className={cn(
                        'flex h-10 items-center justify-center rounded-md border transition-colors duration-micro ease-brand',
                        on ? 'border-[1.5px] border-brand-500 bg-brand-50 text-brand-600' : 'border-neutral-200 text-neutral-500 hover:border-brand-300',
                      )}
                      aria-pressed={on}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">可见范围</label>
              <div className="grid grid-cols-3 gap-2">
                {VISIBILITY_OPTIONS.map((v) => {
                  const on = formScope === v.value
                  return (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => setFormScope(v.value)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors duration-micro ease-brand',
                        on ? 'border-[1.5px] border-brand-500 bg-surface-cardSel' : 'border-neutral-200 hover:border-brand-300',
                      )}
                    >
                      <p className="flex items-center gap-1 text-body-sm font-medium text-neutral-950">
                        {v.label}
                        {on && <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />}
                      </p>
                      <p className="mt-1 text-caption text-neutral-500">{v.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">默认有效期</label>
                <select value={formValidity} onChange={(e) => setFormValidity(Number(e.target.value))} className={INPUT_CLS}>
                  {VALIDITY_OPTIONS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.value} 天
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-caption text-neutral-400">
                  {VALIDITY_OPTIONS.find((v) => v.value === formValidity)?.hint}
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">空间 Owner</label>
                <select value={formOwner} onChange={(e) => setFormOwner(e.target.value)} className={INPUT_CLS}>
                  {OWNER_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-soft px-4 py-3">
              <div>
                <p className="text-body-sm font-medium text-neutral-800">允许 AI 助手引用此空间</p>
                <p className="mt-0.5 text-caption text-neutral-500">关闭后空间内容不参与问答引用</p>
              </div>
              <button type="button" role="switch" aria-checked={formAiUse} onClick={() => setFormAiUse(!formAiUse)} className={switchCls(formAiUse)}>
                <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-comp ease-brand', formAiUse ? 'left-[22px]' : 'left-0.5')} />
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 空间管理 Drawer */}
      <SideDrawer open={!!manage} onClose={() => setManage(null)} title={manageSpace ? `空间管理 · ${manageSpace.name}` : '空间管理'} width={560}>
        {manageSpace && manage && (
          <div>
            {/* Tab 栏 */}
            <div className="mb-4 flex gap-1 rounded-lg bg-surface-soft p-1">
              {MANAGE_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setManage({ id: manage.id, tab: t.key })}
                  className={cn(
                    'flex h-8 flex-1 items-center justify-center rounded-md text-body-sm transition-colors duration-micro ease-brand',
                    manage.tab === t.key ? 'bg-white font-medium text-brand-600 shadow-card' : 'text-neutral-500 hover:text-neutral-800',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {manage.tab === 'info' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">空间名称</label>
                  <input value={mName} onChange={(e) => setMName(e.target.value)} className={INPUT_CLS} disabled={manageSpace.isDefault} />
                  {manageSpace.isDefault && <p className="mt-1 text-caption text-neutral-400">默认空间不可重命名</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">空间说明</label>
                  <textarea
                    value={mDesc}
                    onChange={(e) => setMDesc(e.target.value.slice(0, 100))}
                    className="min-h-[72px] w-full resize-none rounded-md border border-[#DCE4EF] p-3 text-body text-neutral-800 outline-none focus:border-brand-500 focus:shadow-input"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">空间图标</label>
                  <div className="grid grid-cols-8 gap-2">
                    {SPACE_ICON_CHOICES.map((key) => {
                      const Icon = ICONS[key]
                      const on = mIcon === key
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setMIcon(key)}
                          className={cn(
                            'flex h-10 items-center justify-center rounded-md border transition-colors duration-micro ease-brand',
                            on ? 'border-[1.5px] border-brand-500 bg-brand-50 text-brand-600' : 'border-neutral-200 text-neutral-500 hover:border-brand-300',
                          )}
                          aria-pressed={on}
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">可见范围</label>
                    <select value={mScope} onChange={(e) => setMScope(e.target.value)} className={INPUT_CLS}>
                      {VISIBILITY_OPTIONS.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">默认有效期</label>
                    <select value={mValidity} onChange={(e) => setMValidity(Number(e.target.value))} className={INPUT_CLS}>
                      {VALIDITY_OPTIONS.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.value} 天
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">空间 Owner</label>
                  <select value={mOwner} onChange={(e) => setMOwner(e.target.value)} className={INPUT_CLS}>
                    {OWNER_OPTIONS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end border-t border-neutral-100 pt-4">
                  <button type="button" className={BTN_PRIMARY} disabled={mName.trim().length < 2} onClick={saveSpaceInfo}>
                    保存基本信息
                  </button>
                </div>
              </div>
            )}

            {manage.tab === 'members' && (
              <div>
                {/* 添加成员 */}
                <div className="rounded-lg border border-neutral-200 p-3.5">
                  <p className="flex items-center gap-1.5 text-body-sm font-medium text-neutral-950">
                    <UserPlus className="h-4 w-4 text-brand-600" />
                    添加成员
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <select value={addName} onChange={(e) => setAddName(e.target.value)} className={INPUT_CLS + ' !h-9 flex-1'}>
                      <option value="">选择成员…</option>
                      {OWNER_OPTIONS.filter((o) => !manageSpace.memberRows.some((m) => m.name === o)).map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                    <select value={addRole} onChange={(e) => setAddRole(e.target.value)} className={INPUT_CLS + ' !h-9 w-28'}>
                      {MEMBER_ROLE_OPTIONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <button type="button" className={BTN_PRIMARY + ' !h-9 shrink-0 px-3'} disabled={!addName} onClick={addMember}>
                      添加
                    </button>
                  </div>
                </div>
                {/* 成员列表 */}
                <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                  {manageSpace.memberRows.map((m) => (
                    <li key={m.name} className="flex items-center gap-3 px-3.5 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-body-sm font-medium text-brand-600">
                        {m.name[0]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm font-medium text-neutral-950">{m.name}</span>
                        <span className="text-caption text-neutral-400">加入于 {m.joinedAt}</span>
                      </span>
                      {m.aggregate ? (
                        <span className="shrink-0 text-body-sm text-neutral-500">{m.role}</span>
                      ) : (
                        <>
                          <select
                            value={m.role}
                            onChange={(e) => changeMemberRole(manageSpace, m.name, e.target.value)}
                            className="h-8 shrink-0 rounded-md border border-neutral-200 bg-white px-2 text-body-sm text-neutral-800 outline-none focus:border-brand-500"
                          >
                            {MEMBER_ROLE_OPTIONS.map((r) => (
                              <option key={r}>{r}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setConfirm({ kind: 'removeMember', space: manageSpace, member: m.name })}
                            className="shrink-0 text-body-sm text-neutral-400 transition-colors duration-micro ease-brand hover:text-danger"
                          >
                            移除
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {manage.tab === 'docs' && (
              <div>
                {(spaceDocs[manageSpace.id] ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center">
                    <p className="text-body-sm text-neutral-500">该空间暂无文档</p>
                    <p className="mt-1 text-caption text-neutral-400">上传资料后即可在此管理空间文档</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                    {(spaceDocs[manageSpace.id] ?? []).map((d) => (
                      <li key={d.id} className="flex items-center gap-3 px-3.5 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-sm font-medium text-neutral-950">
                            {d.title}
                            <span className="ml-1.5 rounded-sm bg-neutral-100 px-1 py-0.5 text-caption text-neutral-500">{d.version}</span>
                          </span>
                          <span className="text-caption text-neutral-400">
                            {d.owner} · 更新于 {d.updatedAt}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setConfirm({ kind: 'removeDoc', space: manageSpace, doc: d })}
                          className="shrink-0 text-body-sm text-neutral-400 transition-colors duration-micro ease-brand hover:text-danger"
                        >
                          移出空间
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className={BTN_SECONDARY + ' mt-3 w-full justify-center'} onClick={() => goUploadToSpace(manageSpace.name)}>
                  <Upload className="h-4 w-4" />
                  上传资料到此空间
                </button>
              </div>
            )}

            {manage.tab === 'danger' && (
              <div className="space-y-3">
                {manageSpace.isDefault ? (
                  <p className="rounded-lg bg-surface-soft px-4 py-3 text-body-sm text-neutral-500">
                    默认空间承载全员知识总集，不可归档或删除。
                  </p>
                ) : (
                  <>
                    <div className="rounded-lg border border-warning/40 bg-warning-bg/40 p-4">
                      <p className="flex items-center gap-1.5 text-body-sm font-medium text-neutral-950">
                        <Archive className="h-4 w-4 text-warning" />
                        归档空间
                      </p>
                      <p className="mt-1 text-caption text-neutral-500">归档后空间从列表隐藏，文档保留在知识库中，可随时联系管理员恢复。</p>
                      <button
                        type="button"
                        className="mt-2.5 h-9 rounded-md border border-warning/50 bg-white px-3.5 text-body-sm font-medium text-warning transition-colors duration-micro ease-brand hover:bg-warning-bg"
                        onClick={() => {
                          setArchiveFor(manageSpace)
                          setArchiveAck(false)
                        }}
                      >
                        归档空间
                      </button>
                    </div>
                    <div className="rounded-lg border border-danger-border bg-danger-bg/40 p-4">
                      <p className="flex items-center gap-1.5 text-body-sm font-medium text-neutral-950">
                        <Trash2 className="h-4 w-4 text-danger" />
                        删除空间
                      </p>
                      <p className="mt-1 text-caption text-neutral-500">删除后空间及其成员配置将移除，操作不可撤销（文档仍保留在知识库）。</p>
                      <button
                        type="button"
                        className="mt-2.5 h-9 rounded-md border border-danger-border bg-white px-3.5 text-body-sm font-medium text-danger transition-colors duration-micro ease-brand hover:bg-danger-bg"
                        onClick={() => {
                          setDeleteFor(manageSpace)
                          setDeleteInput('')
                        }}
                      >
                        删除空间
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </SideDrawer>

      {/* 版本/差异对比 Drawer */}
      <SideDrawer open={!!compareFor} onClose={() => setCompareFor(null)} title={compareFor?.id === 'c2' ? '差异对比 · 差旅报销金额' : '版本对比 · 销售报价政策'} width={560}>
        {compareFor?.id === 'c2' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { doc: '《差旅报销标准》', space: '制度与流程', rows: [['高铁二等座上限', '600 元'], ['住宿（一线城市）', '500 元/晚'], ['更新于', '2024-04-18']] },
                { doc: '《费用管理制度》', space: '全部知识', rows: [['高铁二等座上限', '550 元'], ['住宿（一线城市）', '450 元/晚'], ['更新于', '2023-12-05']] },
              ].map((v) => (
                <div key={v.doc} className="rounded-lg border border-neutral-200 p-4">
                  <p className="text-body font-semibold text-neutral-950">{v.doc}</p>
                  <p className="mt-0.5 text-caption text-neutral-400">{v.space}</p>
                  <dl className="mt-3 space-y-2 text-body-sm">
                    {v.rows.map(([k, val]) => (
                      <div key={k}>
                        <dt className="text-caption text-neutral-500">{k}</dt>
                        <dd className={cn('text-neutral-800', k === '高铁二等座上限' && 'font-semibold text-warning')}>{val}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-lg bg-warning-bg px-3 py-2 text-body-sm text-warning">
              两份制度的高铁与住宿报销上限不一致，建议由李娜确认后统一口径。
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={() => {
                  setCompareFor(null)
                  setConflicts((prev) => prev.map((c) => (c.id === 'c2' ? { ...c, status: 'resolved' } : c)))
                  toast.success('已提交口径统一申请，冲突标记已解除')
                }}
              >
                提交口径统一申请
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { ver: 'v2024', space: '制度与流程', updated: '2024-01-15', rows: [['折扣审批线', '10% 需销售总监审批'], ['年度框架折扣', '最低 8 折'], ['引用次数（30 天）', '12 次']] },
                { ver: 'v2026', space: '销售弹药库', updated: '2024-03-02', rows: [['折扣审批线', '15% 需销售总监审批'], ['年度框架折扣', '最低 7.5 折'], ['引用次数（30 天）', '4 次']] },
              ].map((v) => (
                <div key={v.ver} className={cn('rounded-lg border p-4', v.ver === 'v2024' ? 'border-danger-border bg-danger-bg/40' : 'border-neutral-200')}>
                  <p className="flex items-center gap-2 text-body font-semibold text-neutral-950">
                    {v.ver}
                    <span className="rounded-sm bg-neutral-100 px-1.5 text-caption text-neutral-500">{v.space}</span>
                  </p>
                  <p className="mt-0.5 text-caption text-neutral-400">更新于 {v.updated}</p>
                  <dl className="mt-3 space-y-2 text-body-sm">
                    {v.rows.map(([k, val]) => (
                      <div key={k}>
                        <dt className="text-caption text-neutral-500">{k}</dt>
                        <dd className="text-neutral-800">{val}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-lg bg-warning-bg px-3 py-2 text-body-sm text-warning">
              两个版本的折扣审批线不一致，建议指定权威版本以避免答案冲突。
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={() => {
                  setCompareFor(null)
                  setConfirmConflict(conflicts.find((c) => c.id === 'c1') ?? null)
                }}
              >
                指定权威版本
              </button>
            </div>
          </>
        )}
      </SideDrawer>

      {/* 指定权威版本 L2 确认卡 */}
      <Modal open={!!confirmConflict} onClose={() => setConfirmConflict(null)} width={520}>
        {confirmConflict && (
          <ConfirmationCard
            title="指定权威版本"
            description="指定后，AI 助手将优先引用权威版本回答，冲突标记解除。"
            fields={[
              { label: '动作', value: '将《销售报价政策 v2026》（销售弹药库）指定为权威版本' },
              { label: '影响对象', value: '制度与流程 · 销售弹药库 2 个空间' },
              { label: '影响范围', value: '近 30 天被引用 12 次的答案将按权威版本更新' },
              { label: '可撤销性', value: '可随时更换权威版本，操作记录保留' },
            ]}
            confirmText="确认指定"
            loading={confirmLoading}
            onConfirm={resolveConflict}
            onCancel={() => setConfirmConflict(null)}
          />
        )}
      </Modal>

      {/* L2 确认：发布空间 / 移除成员 / 移出文档 */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} width={520}>
        {confirm?.kind === 'publish' && (
          <ConfirmationCard
            title="发布空间"
            description="发布后，空间内容将进入 AI 助手引用范围，对可见成员生效。"
            fields={[
              { label: '动作', value: `发布空间「${confirm.space.name}」` },
              { label: '影响对象', value: `${confirm.space.members} 名空间成员 · ${confirm.space.docs} 份文档` },
              { label: '影响范围', value: '空间问答与引用立即可用，草稿标记移除' },
              { label: '可撤销性', value: '可通过归档空间随时下线' },
            ]}
            confirmText="确认发布"
            loading={confirmLoading}
            onConfirm={runConfirm}
            onCancel={() => setConfirm(null)}
          />
        )}
        {confirm?.kind === 'removeMember' && (
          <ConfirmationCard
            title="移除成员"
            description="移除后该成员将失去此空间的访问与问答权限。"
            fields={[
              { label: '动作', value: `将「${confirm.member}」移出空间「${confirm.space.name}」` },
              { label: '影响对象', value: `成员 ${confirm.member}` },
              { label: '影响范围', value: '立即失去空间访问权限，历史贡献内容保留' },
              { label: '可撤销性', value: '可重新添加该成员' },
            ]}
            confirmText="确认移除"
            loading={confirmLoading}
            onConfirm={runConfirm}
            onCancel={() => setConfirm(null)}
          />
        )}
        {confirm?.kind === 'removeDoc' && (
          <ConfirmationCard
            title="移出空间"
            description="文档仅从当前空间移除，仍保留在知识库与其他空间中。"
            fields={[
              { label: '动作', value: `将「${confirm.doc.title}」移出空间「${confirm.space.name}」` },
              { label: '影响对象', value: `${confirm.doc.title} ${confirm.doc.version}` },
              { label: '影响范围', value: '该空间问答不再引用此文档' },
              { label: '可撤销性', value: '可在知识库中重新加入空间' },
            ]}
            confirmText="确认移出"
            loading={confirmLoading}
            onConfirm={runConfirm}
            onCancel={() => setConfirm(null)}
          />
        )}
      </Modal>

      {/* L3 归档空间确认（需勾选知悉） */}
      <Modal open={!!archiveFor} onClose={() => setArchiveFor(null)} title="归档空间" width={520}>
        {archiveFor && (
          <div>
            <p className="rounded-lg bg-warning-bg px-4 py-3 text-body-sm text-warning">
              归档后，空间「{archiveFor.name}」将从列表隐藏，空间问答停止服务，文档保留在知识库中。
            </p>
            <dl className="mt-4 space-y-2 rounded-lg bg-surface-soft p-4 text-body-sm">
              {[
                ['动作', `归档空间「${archiveFor.name}」`],
                ['影响对象', `${archiveFor.members} 名成员 · ${archiveFor.docs} 份文档`],
                ['影响范围', '空间不再参与 AI 引用与问答'],
                ['可撤销性', '可联系管理员恢复'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start gap-4">
                  <dt className="w-20 shrink-0 text-neutral-500">{k}</dt>
                  <dd className="min-w-0 flex-1 text-neutral-800">{v}</dd>
                </div>
              ))}
            </dl>
            <label className="mt-4 flex items-center gap-2 text-body-sm text-neutral-700">
              <input type="checkbox" checked={archiveAck} onChange={(e) => setArchiveAck(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              我已了解归档影响，确认归档该空间
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={() => setArchiveFor(null)}>
                取消
              </button>
              <button type="button" className={BTN_PRIMARY} disabled={!archiveAck} onClick={archiveSpace}>
                确认归档
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* L4 删除空间确认（输入空间名称） */}
      <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title="删除空间" width={520}>
        {deleteFor && (
          <div>
            <p className="rounded-lg bg-danger-bg px-4 py-3 text-body-sm text-danger">
              删除空间「{deleteFor.name}」后不可恢复，空间成员配置与统计将一并移除（文档仍保留在知识库）。
            </p>
            <label className="mb-1.5 mt-4 block text-body-sm font-medium text-neutral-800">
              请输入空间名称「{deleteFor.name}」以确认删除
            </label>
            <input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={deleteFor.name}
              className={INPUT_CLS}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={() => setDeleteFor(null)}>
                取消
              </button>
              <button
                type="button"
                disabled={deleteInput.trim() !== deleteFor.name}
                onClick={deleteSpace}
                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-danger px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:opacity-90 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                永久删除
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 有效期策略编辑 Modal */}
      <Modal
        open={!!policyFor}
        onClose={() => setPolicyFor(null)}
        title="编辑有效期策略"
        description="保存后对该空间内全部文档生效"
        width={480}
        footer={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => setPolicyFor(null)}>
              取消
            </button>
            <button type="button" className={BTN_PRIMARY} onClick={savePolicy}>
              保存策略
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">默认审核周期</label>
            <select value={pCycle} onChange={(e) => setPCycle(Number(e.target.value))} className={INPUT_CLS}>
              {VALIDITY_OPTIONS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.value} 天
                </option>
              ))}
            </select>
            <p className="mt-1 text-caption text-neutral-400">{VALIDITY_OPTIONS.find((v) => v.value === pCycle)?.hint}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">默认有效期（到期处理）</label>
            <select value={pExpire} onChange={(e) => setPExpire(e.target.value)} className={INPUT_CLS}>
              {EXPIRE_HANDLING_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-surface-soft px-4 py-3">
            <div>
              <p className="text-body-sm font-medium text-neutral-800">到期前通知 Owner</p>
              <p className="mt-0.5 text-caption text-neutral-500">复审到期前 7 天通过工作台提醒</p>
            </div>
            <button type="button" role="switch" aria-checked={pNotify} onClick={() => setPNotify(!pNotify)} className={switchCls(pNotify)}>
              <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-comp ease-brand', pNotify ? 'left-[22px]' : 'left-0.5')} />
            </button>
          </div>
        </div>
      </Modal>

      {/* 空间内提问 Modal */}
      <Modal
        open={!!qaFor}
        onClose={() => setQaFor(null)}
        title={`在「${spaces.find((s) => s.id === qaFor)?.name ?? ''}」内提问`}
        description="演示模式：回答仅引用该空间内文档"
        width={560}
      >
        <div className="flex items-center gap-2">
          <input
            value={qaQuestion}
            onChange={(e) => setQaQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') askQuestion()
            }}
            placeholder="例如：客户报价折扣超过 10% 需要谁审批？"
            className={INPUT_CLS}
          />
          <button type="button" className={BTN_PRIMARY + ' shrink-0'} disabled={!qaQuestion.trim()} onClick={askQuestion}>
            <Send className="h-4 w-4" />
            提问
          </button>
        </div>
        {qaAnswer && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="mt-4 rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-body font-semibold text-neutral-950">{qaAnswer.conclusion}</p>
              <StatusBadge status={`可信度 ${qaAnswer.trustScore}%`} />
            </div>
            <p className="mt-2 text-body-sm text-neutral-700">{qaAnswer.explanation}</p>
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <p className="text-caption font-medium text-neutral-500">引用来源（{qaAnswer.citations.length}）</p>
              <ul className="mt-1.5 space-y-1">
                {qaAnswer.citations.map((c) => (
                  <li key={c.doc + c.page} className="flex items-center gap-2 text-body-sm text-neutral-700">
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                    {c.doc} {c.version} · {c.page}
                    <span className="rounded-sm bg-neutral-100 px-1 text-caption text-neutral-500">{c.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </Modal>

      {/* 空间分析 Drawer */}
      <SideDrawer open={!!analyticsFor} onClose={() => setAnalyticsFor(null)} title={`空间分析 · ${spaces.find((s) => s.id === analyticsFor)?.name ?? ''}`} width={560}>
        {analyticsFor &&
          (() => {
            const s = spaces.find((x) => x.id === analyticsFor)
            if (!s) return null
            const data = analyticsOf(s)
            return (
              <div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ['累计问答', s.questions, '条'],
                    ['空间文档', s.docs, '份'],
                    ['贡献成员', data.contributors.length, '人'],
                  ].map(([label, val, unit]) => (
                    <div key={label as string} className="rounded-lg border border-neutral-200 p-3.5 text-center">
                      <p className="text-caption text-neutral-400">{label}</p>
                      <p className="mt-1 text-h2 text-neutral-950">
                        {val}
                        <span className="ml-0.5 text-caption font-normal text-neutral-400">{unit}</span>
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-neutral-200 p-4">
                  <p className="text-body-sm font-medium text-neutral-950">近 8 周问答 / 文档趋势</p>
                  <div className="mt-2 h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.trend} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                        <CartesianGrid stroke="#EEF2F7" vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#98A2B3' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#98A2B3' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="questions" name="问答量" stroke="#2F74FF" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="docs" name="文档数" stroke="#12B76A" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-neutral-200 p-4">
                  <p className="text-body-sm font-medium text-neutral-950">贡献成员 Top</p>
                  <ul className="mt-2 divide-y divide-neutral-100">
                    {data.contributors.map((c, i) => (
                      <li key={c.name} className="flex items-center gap-3 py-2.5 text-body-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-caption font-medium text-brand-600">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 text-neutral-800">{c.name}</span>
                        <span className="text-neutral-500">{c.answers} 次贡献</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })()}
      </SideDrawer>

      {/* 空间健康报告 Drawer */}
      <SideDrawer
        open={healthOpen}
        onClose={() => setHealthOpen(false)}
        title="空间健康报告"
        width={560}
        footer={
          <button type="button" className={BTN_PRIMARY + ' w-full justify-center'} onClick={downloadHealthReport}>
            <Download className="h-4 w-4" />
            下载报告（.md）
          </button>
        }
      >
        <p className="mb-3 text-caption text-neutral-400">按健康分从低到高排序 · 生成于 今天 10:30</p>
        <div className="space-y-3">
          {[...visibleSpaces]
            .sort((a, b) => healthOf(a).score - healthOf(b).score)
            .map((s) => {
              const h = healthOf(s)
              const tone = h.score >= 85 ? 'text-success' : h.score >= 70 ? 'text-warning' : 'text-danger'
              return (
                <section key={s.id} className="rounded-lg border border-neutral-200 p-4">
                  <div className="flex items-center gap-3">
                    <SpaceIcon icon={s.icon} className="!h-9 !w-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-semibold text-neutral-950">{s.name}</p>
                      <p className="text-caption text-neutral-400">
                        {h.issues.length} 个待处理问题 · {s.status === 'PUBLISHED' ? '已发布' : '草稿'}
                      </p>
                    </div>
                    <span className={cn('text-h2 font-semibold', tone)}>{h.score}</span>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={cn('h-full rounded-full', h.score >= 85 ? 'bg-success' : h.score >= 70 ? 'bg-warning' : 'bg-danger')}
                      style={{ width: `${h.score}%` }}
                    />
                  </div>
                  <ul className="mt-2.5 space-y-1">
                    {h.issues.map((i) => (
                      <li key={i} className="flex items-start gap-1.5 text-body-sm text-neutral-700">
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                        {i}
                      </li>
                    ))}
                    {h.suggestions.map((i) => (
                      <li key={i} className="flex items-start gap-1.5 text-body-sm text-neutral-500">
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                        {i}
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
        </div>
      </SideDrawer>
    </div>
  )
}
