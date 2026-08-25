/**
 * 知识库与文档管理 KnowledgeBase（W02/W03 合并视图，design/knowledge-base.md）
 * 左：知识空间树（240px，新建/重命名/成员权限/审核周期/归档均真实生效）；右：工具行（搜索/筛选/视图切换）
 * + 文档表格（每页 10 条真实分页；批量选择 → 批量归档 L2 / 批量移动空间；行 ⋯ 含重命名与移动空间）
 * + UploadDrawer 上传队列状态机（「开始理解」后 READY 文档真实入表）+ DocDetailDrawer 文档详情 + 空状态。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderClosed,
  FolderOpen,
  History,
  Info,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Search,
  Table2,
  Upload,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { assets, METRICS, useAppStore } from '@/mocks'
import { ConfirmationCard, DemoEmptyState, EmptyState, ProgressBar, StatusBadge } from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { Modal } from '@/pages/workspace/Modal'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { useAppToast } from '@/lib/toast'
import { UploadDrawer } from '@/pages/workspace/UploadDrawer'
import { DocDetailDrawer } from '@/pages/workspace/DocDetailDrawer'
import { DOC_CATEGORIES, DOC_STATUSES, DOC_TYPES, SPACES as KB_SPACES, makeFullDocuments } from '@/pages/workspace/kbData'
import type { DocRow, SpaceRow } from '@/pages/workspace/kbData'

const TYPE_ICON_CLS: Record<DocRow['type'], string> = {
  PDF: 'bg-danger-bg text-danger',
  Word: 'bg-info-bg text-info',
  表格: 'bg-success-bg text-success',
  PPT: 'bg-warning-bg text-warning',
  图片: 'bg-violet-bg text-violet',
  网页: 'bg-cyan-bg text-cyan',
}

const IMPORT_HISTORY = [
  { batch: '批次 #20240529-03', detail: '企业网盘增量同步 · 86 份', status: '已完成', time: '05-29 22:00' },
  { batch: '批次 #20240528-01', detail: '本地上传 · 12 份', status: '部分失败', time: '05-28 15:32' },
  { batch: '批次 #20240527-02', detail: '飞书文档全量同步 · 318 份', status: '已完成', time: '05-27 09:45' },
]

const REVIEW_CYCLE_OPTIONS = [30, 60, 90, 180, 365] as const
const PAGE_SIZE = 10

/** 「开始理解」后插入表格的 READY 文档命名池（与上传队列 mock 对齐） */
const INGEST_POOL: { name: string; type: DocRow['type']; size: string }[] = [
  { name: '产品手册 2026', type: 'PDF', size: '8.2 MB' },
  { name: '渠道价格表', type: '表格', size: '1.4 MB' },
  { name: '培训补充讲义', type: 'PPT', size: '2.6 MB' },
  { name: 'FAQ 增补', type: 'Word', size: '0.8 MB' },
]

function nowHM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function bumpVersion(v: string): string {
  const m = v.match(/^v(\d+)\.(\d+)$/)
  return m ? `v${m[1]}.${Number(m[2]) + 1}` : v
}

/** 状态徽标（待复审不在全局映射内，用同色系自定义 pill；其余复用 StatusBadge） */
function DocStatusBadge({ doc, onCancelParse }: { doc: DocRow; onCancelParse: (d: DocRow) => void }) {
  if (doc.status === '待复审') {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-pill bg-warning-bg px-2 text-caption font-medium text-warning">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          待复审
        </span>
        {doc.statusNote && <Info className="h-3.5 w-3.5 text-neutral-300" />}
      </span>
    )
  }
  if (doc.status === '解析中') {
    return (
      <span className="flex min-w-[120px] flex-col gap-1">
        <span className="flex items-center gap-1.5">
          <StatusBadge status="解析中" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCancelParse(doc)
            }}
            className="text-caption text-neutral-400 underline hover:text-danger"
          >
            取消
          </button>
        </span>
        <ProgressBar value={doc.progress ?? 0} barClassName="bg-cyan" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      <StatusBadge status={doc.status} />
      {doc.statusNote && <Info className="h-3.5 w-3.5 text-neutral-300" />}
    </span>
  )
}

export default function KnowledgeBase() {
  const toast = useAppToast()
  const navigate = useNavigate()
  const { state } = useAppStore()
  // 冷启动空态：未载入演示数据时展示引导空态（评审 P1-N1）
  const demoOff = state.demoData === false
  const [docs, setDocs] = useState<DocRow[]>(makeFullDocuments)
  const [spaces, setSpaces] = useState<SpaceRow[]>(KB_SPACES)
  const [activeSpace, setActiveSpace] = useState(KB_SPACES[0].name)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<(typeof DOC_TYPES)[number]>('全部')
  const [statusFilter, setStatusFilter] = useState<(typeof DOC_STATUSES)[number]>('全部')
  const [categoryFilter, setCategoryFilter] = useState<(typeof DOC_CATEGORIES)[number]>('全部')
  const [view, setView] = useState<'table' | 'card'>('table')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [linkedDoc, setLinkedDoc] = useState<string | null>(null)
  const [detail, setDetail] = useState<DocRow | null>(null)
  const [newSpaceOpen, setNewSpaceOpen] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)

  // 分页 + 批量选择
  const [pageNum, setPageNum] = useState(1)
  const [checked, setChecked] = useState<string[]>([])

  // 空间树 ⋯ 菜单
  const [renameSpaceFor, setRenameSpaceFor] = useState<SpaceRow | null>(null)
  const [renameSpaceName, setRenameSpaceName] = useState('')
  const [cycleFor, setCycleFor] = useState<SpaceRow | null>(null)
  const [cycleValue, setCycleValue] = useState<number>(180)
  const [archiveSpaceFor, setArchiveSpaceFor] = useState<SpaceRow | null>(null)

  // 行级：重命名 / 移动空间；批量：移动 / 归档
  const [renameDocFor, setRenameDocFor] = useState<DocRow | null>(null)
  const [renameDocTitle, setRenameDocTitle] = useState('')
  const [moveDocFor, setMoveDocFor] = useState<DocRow | null>(null)
  const [moveTarget, setMoveTarget] = useState('')
  const [batchMoveOpen, setBatchMoveOpen] = useState(false)
  const [batchMoveTarget, setBatchMoveTarget] = useState('')
  const [batchArchiveOpen, setBatchArchiveOpen] = useState(false)

  /** 默认空间（全部知识）恒为树中第一个，且不可重命名/归档 */
  const umbrella = spaces[0]?.name ?? KB_SPACES[0].name
  const visibleSpaces = useMemo(() => spaces.filter((s) => !s.archived), [spaces])
  /** 移动空间可选目标（排除默认空间与已归档） */
  const moveTargets = useMemo(() => visibleSpaces.filter((s) => s.name !== umbrella).map((s) => s.name), [visibleSpaces, umbrella])

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (activeSpace !== umbrella && d.space !== activeSpace) return false
      if (search.trim() && !d.title.toLowerCase().includes(search.trim().toLowerCase())) return false
      if (typeFilter !== '全部' && d.type !== typeFilter) return false
      if (statusFilter !== '全部' && d.status !== statusFilter) return false
      if (categoryFilter !== '全部' && d.category !== categoryFilter) return false
      return true
    })
  }, [docs, activeSpace, umbrella, search, typeFilter, statusFilter, categoryFilter])

  /** 筛选 / 切换空间时回到第一页并清空选择（在各 onChange 处调用） */
  const resetPaging = () => {
    setPageNum(1)
    setChecked([])
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(pageNum, pageCount)
  const pageRows = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  /** 空间文档计数与文档列表实时联动 */
  const countOf = (name: string) => (name === umbrella ? docs.length : docs.filter((d) => d.space === name).length)

  const resetFilters = () => {
    setSearch('')
    setTypeFilter('全部')
    setStatusFilter('全部')
    setCategoryFilter('全部')
    resetPaging()
  }

  const patchDoc = (id: string, patch: Partial<DocRow>) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
    setDetail((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev))
  }

  const confirmStillValid = (d: DocRow) => {
    patchDoc(d.id, {
      status: '已发布',
      statusNote: undefined,
      confirmedNote: `已由 张伟 于 今天 ${nowHM()} 确认仍有效，复审周期重新计算。`,
    })
    toast.success(`已确认「${d.title}」仍有效，状态已恢复为已发布`)
  }

  const archiveDoc = (d: DocRow) => {
    patchDoc(d.id, { status: '已归档', statusNote: undefined })
    toast.info(`已归档「${d.title}」`)
  }

  const uploadNewVersion = (d: DocRow) => {
    setLinkedDoc(d.title)
    setUploadOpen(true)
  }

  /* ── 批量选择 ── */
  const pageAllChecked = pageRows.length > 0 && pageRows.every((d) => checked.includes(d.id))
  const toggleAll = () => {
    const ids = pageRows.map((d) => d.id)
    setChecked((prev) => (pageAllChecked ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]))
  }
  const toggleOne = (id: string) => {
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const batchArchive = () => {
    const n = checked.length
    setDocs((prev) => prev.map((d) => (checked.includes(d.id) ? { ...d, status: '已归档', statusNote: undefined } : d)))
    setChecked([])
    setBatchArchiveOpen(false)
    toast.success(`已批量归档 ${n} 份文档`)
  }

  const batchMove = () => {
    if (!batchMoveTarget) return
    const n = checked.length
    setDocs((prev) => prev.map((d) => (checked.includes(d.id) ? { ...d, space: batchMoveTarget } : d)))
    setChecked([])
    setBatchMoveOpen(false)
    toast.success(`已将 ${n} 份文档移动到「${batchMoveTarget}」`)
  }

  /* ── 行级：重命名 / 移动空间 ── */
  const openRenameDoc = (d: DocRow) => {
    setRenameDocFor(d)
    setRenameDocTitle(d.title)
  }
  const saveRenameDoc = () => {
    if (!renameDocFor || !renameDocTitle.trim()) return
    patchDoc(renameDocFor.id, { title: renameDocTitle.trim() })
    setRenameDocFor(null)
    toast.success('文档已重命名')
  }
  const openMoveDoc = (d: DocRow) => {
    setMoveDocFor(d)
    setMoveTarget(moveTargets.find((t) => t !== d.space) ?? '')
  }
  const saveMoveDoc = () => {
    if (!moveDocFor || !moveTarget || moveTarget === moveDocFor.space) return
    patchDoc(moveDocFor.id, { space: moveTarget })
    setMoveDocFor(null)
    toast.success(`已将「${moveDocFor.title}」移动到「${moveTarget}」`)
  }

  /* ── 空间树操作 ── */
  const createSpace = () => {
    const name = newSpaceName.trim()
    if (!name) return
    if (spaces.some((s) => s.name === name)) {
      toast.warning('已存在同名空间，请更换名称')
      return
    }
    setSpaces((prev) => [...prev, { name, count: 0, health: '健康', reviewCycle: 180 }])
    setActiveSpace(name)
    resetPaging()
    setNewSpaceOpen(false)
    setNewSpaceName('')
    toast.success(`空间「${name}」已创建，可开始上传资料`)
  }

  const handleSpaceOp = (s: SpaceRow, op: string) => {
    if (op === '重命名') {
      setRenameSpaceFor(s)
      setRenameSpaceName(s.name)
    } else if (op === '成员权限') {
      navigate('/workspace/permissions')
      toast.info(`已切换到权限管理，可调整「${s.name}」成员权限`)
    } else if (op.startsWith('审核周期')) {
      setCycleFor(s)
      setCycleValue(s.reviewCycle ?? 180)
    } else {
      setArchiveSpaceFor(s)
    }
  }

  const saveRenameSpace = () => {
    if (!renameSpaceFor) return
    const next = renameSpaceName.trim()
    const old = renameSpaceFor.name
    setRenameSpaceFor(null)
    if (!next || next === old) return
    if (spaces.some((s) => s.name === next)) {
      toast.warning('已存在同名空间，请更换名称')
      return
    }
    setSpaces((prev) => prev.map((s) => (s.name === old ? { ...s, name: next } : s)))
    setDocs((prev) => prev.map((d) => (d.space === old ? { ...d, space: next } : d)))
    if (activeSpace === old) {
      setActiveSpace(next)
      resetPaging()
    }
    toast.success(`空间已重命名为「${next}」，空间内文档同步更新`)
  }

  const saveCycle = () => {
    if (!cycleFor) return
    setSpaces((prev) => prev.map((s) => (s.name === cycleFor.name ? { ...s, reviewCycle: cycleValue } : s)))
    toast.success(`「${cycleFor.name}」审核周期已设为 ${cycleValue} 天`)
    setCycleFor(null)
  }

  const archiveSpace = () => {
    if (!archiveSpaceFor) return
    const name = archiveSpaceFor.name
    setSpaces((prev) => prev.map((s) => (s.name === name ? { ...s, archived: true } : s)))
    if (activeSpace === name) {
      setActiveSpace(umbrella)
      resetPaging()
    }
    setArchiveSpaceFor(null)
    toast.success(`空间「${name}」已归档，从空间树隐藏，文档仍保留在知识库`)
  }

  /* ── 上传闭环：「开始理解这些资料」→ READY 文档真实插入表格 ── */
  const ingestDocs = (n: number) => {
    if (linkedDoc) {
      setDocs((prev) =>
        prev.map((d) =>
          d.title === linkedDoc
            ? { ...d, version: bumpVersion(d.version), status: '已发布', statusNote: undefined, progress: undefined, updatedAt: '刚刚' }
            : d,
        ),
      )
      return
    }
    const target = activeSpace
    setDocs((prev) => {
      const added: DocRow[] = []
      for (let i = 0; i < n; i += 1) {
        const p = INGEST_POOL[(prev.length + i) % INGEST_POOL.length]
        // 同名计数派生序号：跨批次也不重复、不把计数数字混入书名号
        const prior = prev.concat(added).filter((d) => d.title === `《${p.name}》` || d.title.startsWith(`《${p.name} `)).length
        const title = prior > 0 ? `《${p.name}（${prior + 1}）》` : `《${p.name}》`
        added.push({
          id: `up-${Date.now()}-${i}`,
          title,
          version: 'v1.0',
          category: 'FAQ',
          type: p.type,
          status: '已发布',
          size: p.size,
          owner: '张伟',
          updatedAt: '刚刚',
          space: target,
          source: '本地上传',
          validFrom: '2026-06-01',
          reviewDueAt: '2026-12-01',
          expiresAt: '2027-06-01',
          riskLevel: '低',
          sourceOfTruth: `本地上传 / ${p.name}`,
          permScope: '全体成员可见',
          versions: [{ label: 'v1.0', authoritative: true, note: '当前版本' }],
        })
      }
      return [...added, ...prev]
    })
    setPageNum(1)
  }

  const handleUploadToast = (kind: 'success' | 'info' | 'warning', msg: string) => {
    const m = msg.match(/^已开始理解\s*(\d+)\s*份资料/)
    if (m) {
      ingestDocs(Number(m[1]))
      toast[kind](msg.replace('（模拟）', '，已加入文档列表'))
      return
    }
    toast[kind](msg)
  }

  // 冷启动空态：未载入演示数据时只显示页头 + 引导空态（评审 P1-N1）
  if (demoOff) {
    return (
      <div>
        <PageHeader
          crumbs={['知识', '知识库与文档']}
          title="知识库与文档"
          subtitle="完成快速配置或载入演示数据后，这里会展示真实的企业知识数据"
        />
        <DemoEmptyState />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        crumbs={['知识', '知识库与文档']}
        title="知识库与文档"
        subtitle={`${METRICS.spaces} 个知识空间 · ${METRICS.kbDocs} 份文档 · ${assets.qaItems.toLocaleString('en-US')} 条可问答知识`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
            >
              <History className="h-4 w-4" />
              导入历史
            </button>
            <button
              type="button"
              onClick={() => {
                setLinkedDoc(null)
                setUploadOpen(true)
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
            >
              <Upload className="h-4 w-4" />
              上传资料
            </button>
          </>
        }
      />

      <div className="flex items-start gap-4">
        {/* 左：知识空间树 */}
        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.24 }}
          className="w-[240px] shrink-0 rounded-xl border border-neutral-200 bg-white p-4 shadow-card"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-h3 text-neutral-950">知识空间</h3>
            <button
              type="button"
              onClick={() => setNewSpaceOpen(true)}
              className="inline-flex items-center gap-0.5 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
            >
              <Plus className="h-4 w-4" />
              新建
            </button>
          </div>
          <ul className="flex flex-col gap-0.5">
            {visibleSpaces.map((s, idx) => {
              const active = activeSpace === s.name
              const healthy = s.health === '健康'
              const ops = idx === 0 ? ['成员权限', `审核周期 · ${s.reviewCycle ?? 180}天`] : ['重命名', '成员权限', `审核周期 · ${s.reviewCycle ?? 180}天`, '归档']
              return (
                <li key={s.name} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSpace(s.name)
                      resetPaging()
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors duration-micro ease-brand',
                      active ? 'bg-brand-100 text-brand-600' : 'text-neutral-700 hover:bg-neutral-100',
                    )}
                  >
                    {active ? <FolderOpen className="h-4 w-4 shrink-0" /> : <FolderClosed className="h-4 w-4 shrink-0" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body">{s.name}</span>
                      <span className={cn('text-caption', active ? 'text-brand-500' : 'text-neutral-400')}>{countOf(s.name)} 份文档</span>
                    </span>
                    <span
                      className={cn('h-2 w-2 shrink-0 rounded-full', healthy ? 'bg-success' : 'bg-warning')}
                      title={healthy ? '健康' : `待复审 ${s.reviewCount} 份`}
                    />
                  </button>
                  <details className="absolute right-1 top-1.5 hidden group-hover:block">
                    <summary className="flex h-6 w-6 list-none items-center justify-center rounded-md text-neutral-400 hover:bg-white hover:text-neutral-700 [&::-webkit-details-marker]:hidden">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </summary>
                    <div className="absolute right-0 top-7 z-20 w-44 rounded-md border border-neutral-200 bg-white py-1 shadow-float">
                      {ops.map((op) => (
                        <button
                          key={op}
                          type="button"
                          onClick={() => handleSpaceOp(s, op)}
                          className={cn(
                            'block w-full px-3 py-1.5 text-left text-body-sm hover:bg-neutral-50',
                            op === '归档' ? 'text-danger' : 'text-neutral-700',
                          )}
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        </motion.aside>

        {/* 右：文档区 */}
        <div className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white shadow-card">
          {/* 工具行 */}
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-4">
            <div className="flex h-9 w-[320px] max-w-full items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 transition-shadow duration-micro ease-brand focus-within:border-brand-500 focus-within:shadow-input">
              <Search className="h-4 w-4 shrink-0 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  resetPaging()
                }}
                placeholder="搜索文档标题…"
                className="w-full bg-transparent text-body-sm text-neutral-800 outline-none placeholder:text-neutral-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    resetPaging()
                  }}
                  className="text-neutral-400 hover:text-neutral-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {(
              [
                ['类型', DOC_TYPES, typeFilter, setTypeFilter],
                ['状态', DOC_STATUSES, statusFilter, setStatusFilter],
                ['分类', DOC_CATEGORIES, categoryFilter, setCategoryFilter],
              ] as const
            ).map(([label, options, value, setter]) => (
              <label key={label} className="relative inline-flex h-9 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 text-body-sm text-neutral-700">
                <span className="text-neutral-400">{label}</span>
                <select
                  value={value}
                  onChange={(e) => {
                    setter(e.target.value as never)
                    resetPaging()
                  }}
                  className="appearance-none bg-transparent pr-4 outline-none"
                >
                  {options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-neutral-400" />
              </label>
            ))}
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 rounded-md px-2.5 text-body-sm text-neutral-500 transition-colors duration-micro ease-brand hover:text-brand-600"
            >
              重置
            </button>
            <div className="ml-auto flex rounded-md border border-neutral-200 p-0.5">
              {(
                [
                  ['table', Table2, '表格'],
                  ['card', LayoutGrid, '卡片'],
                ] as const
              ).map(([v, Icon, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    'flex h-8 items-center gap-1 rounded px-2.5 text-body-sm transition-colors duration-micro ease-brand',
                    view === v ? 'bg-brand-100 font-medium text-brand-600' : 'text-neutral-500 hover:text-neutral-800',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 批量操作条 */}
          {checked.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 bg-brand-50/60 px-4 py-2.5">
              <span className="text-body-sm font-medium text-neutral-950">已选 {checked.length} 份文档</span>
              <button
                type="button"
                onClick={() => {
                  setBatchMoveTarget(moveTargets[0] ?? '')
                  setBatchMoveOpen(true)
                }}
                className="h-8 rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
              >
                批量移动空间
              </button>
              <button
                type="button"
                onClick={() => setBatchArchiveOpen(true)}
                className="h-8 rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
              >
                批量归档
              </button>
              <button
                type="button"
                onClick={() => setChecked([])}
                className="h-8 rounded-md px-2 text-body-sm text-neutral-500 transition-colors duration-micro ease-brand hover:text-brand-600"
              >
                清空选择
              </button>
            </div>
          )}

          {/* 文档表格 / 卡片 */}
          {filtered.length === 0 ? (
            <EmptyState
              title="没有找到匹配的文档"
              description="当前空间或筛选条件下暂无文档，上传第一份资料即可开始构建知识。"
              action={
                <button
                  type="button"
                  onClick={() => {
                    setLinkedDoc(null)
                    setUploadOpen(true)
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
                >
                  <Upload className="h-4 w-4" />
                  上传第一份资料
                </button>
              }
            />
          ) : view === 'table' ? (
            <table className="w-full">
              <thead>
                <tr className="h-10 bg-surface-soft text-left text-body-sm text-neutral-500">
                  <th className="w-10 pl-4 pr-2 font-medium">
                    <input
                      type="checkbox"
                      aria-label="全选本页"
                      checked={pageAllChecked}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 align-middle accent-brand-600"
                    />
                  </th>
                  <th className="px-2 font-medium">文档名称</th>
                  <th className="px-2 font-medium">分类</th>
                  <th className="px-2 font-medium">状态</th>
                  <th className="px-2 font-medium">大小 · 页数</th>
                  <th className="px-2 font-medium">Owner</th>
                  <th className="px-2 font-medium">更新于</th>
                  <th className="px-2 pr-4 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((d, i) => (
                  <motion.tr
                    key={d.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18, delay: Math.min(i, 8) * 0.03 }}
                    className={cn(
                      'h-12 border-t border-neutral-100 text-body-sm transition-colors duration-micro ease-brand hover:bg-surface-page',
                      checked.includes(d.id) && 'bg-brand-50/50',
                    )}
                  >
                    <td className="pl-4 pr-2">
                      <input
                        type="checkbox"
                        aria-label={`选择 ${d.title}`}
                        checked={checked.includes(d.id)}
                        onChange={() => toggleOne(d.id)}
                        className="h-3.5 w-3.5 align-middle accent-brand-600"
                      />
                    </td>
                    <td className="px-2">
                      <div className="flex items-center gap-2.5">
                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', TYPE_ICON_CLS[d.type])}>
                          <FileText className="h-4 w-4" />
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-medium text-neutral-950">{d.title}</span>
                          <span className="shrink-0 rounded-sm bg-neutral-100 px-1 py-0.5 text-caption text-neutral-500">{d.version}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-2 text-neutral-700">{d.category}</td>
                    <td className="px-2" title={d.statusNote}>
                      <DocStatusBadge
                        doc={d}
                        onCancelParse={(doc) => {
                          patchDoc(doc.id, { status: '已归档', progress: undefined, statusNote: undefined })
                          toast.info(`已取消「${doc.title}」的解析`)
                        }}
                      />
                    </td>
                    <td className="px-2 text-neutral-500">
                      {d.size}
                      {d.pages ? ` · ${d.pages} 页` : ''}
                    </td>
                    <td className="px-2 text-neutral-700">{d.owner}</td>
                    <td className="px-2 text-neutral-500">{d.updatedAt}</td>
                    <td className="px-2 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setDetail(d)}
                          className="h-8 rounded-md bg-brand-600 px-3 text-body-sm text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
                        >
                          查看
                        </button>
                        <details className="group relative">
                          <summary className="flex h-8 w-8 list-none items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100 [&::-webkit-details-marker]:hidden">
                            <MoreHorizontal className="h-4 w-4" />
                          </summary>
                          <div className="absolute right-0 top-9 z-20 w-36 rounded-md border border-neutral-200 bg-white py-1 shadow-float">
                            {(d.status === '待复审' || d.status === '已过期') && (
                              <button
                                type="button"
                                onClick={() => confirmStillValid(d)}
                                className="block w-full px-3 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
                              >
                                确认仍有效
                              </button>
                            )}
                            {d.status === '存在冲突' && (
                              <button
                                type="button"
                                onClick={() => {
                                  patchDoc(d.id, { status: '已发布', statusNote: undefined })
                                  toast.success('已确认以《价格管理办法》v1.3 为权威来源，冲突解除')
                                }}
                                className="block w-full px-3 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
                              >
                                解决冲突
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openRenameDoc(d)}
                              className="block w-full px-3 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
                            >
                              重命名
                            </button>
                            <button
                              type="button"
                              onClick={() => openMoveDoc(d)}
                              className="block w-full px-3 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
                            >
                              移动空间
                            </button>
                            <button
                              type="button"
                              onClick={() => uploadNewVersion(d)}
                              className="block w-full px-3 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
                            >
                              上传新版本
                            </button>
                            <button
                              type="button"
                              onClick={() => archiveDoc(d)}
                              className="block w-full px-3 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
                            >
                              归档
                            </button>
                          </div>
                        </details>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
              {pageRows.map((d, i) => (
                <motion.button
                  key={d.id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(i, 8) * 0.03 }}
                  onClick={() => setDetail(d)}
                  className="rounded-lg border border-neutral-200 p-4 text-left transition-all duration-micro ease-brand hover:border-brand-300 hover:shadow-card"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', TYPE_ICON_CLS[d.type])}>
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-neutral-950">{d.title}</span>
                    <StatusBadge status={d.status === '待复审' ? '即将过期' : d.status} />
                  </div>
                  <p className="mt-2 text-caption text-neutral-400">
                    {d.version} · {d.category} · {d.size}
                    {d.pages ? ` · ${d.pages} 页` : ''}
                  </p>
                  <p className="mt-1 text-caption text-neutral-400">
                    {d.owner} · 更新于 {d.updatedAt}
                  </p>
                </motion.button>
              ))}
            </div>
          )}

          {/* 分页页脚 */}
          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-4 py-2.5">
              <p className="text-caption text-neutral-400">
                {activeSpace} · 共 {filtered.length} 份文档
                {filtered.length !== countOf(activeSpace) && `（全空间 ${countOf(activeSpace)} 份，已按条件筛选）`}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-caption text-neutral-400">
                  第 {page} / {pageCount} 页（每页 {PAGE_SIZE} 条）
                </span>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPageNum(page - 1)}
                  className="inline-flex h-8 items-center gap-0.5 rounded-md border border-neutral-200 bg-white px-2.5 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  上一页
                </button>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPageNum(page + 1)}
                  className="inline-flex h-8 items-center gap-0.5 rounded-md border border-neutral-200 bg-white px-2.5 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一页
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 上传抽屉 */}
      <UploadDrawer open={uploadOpen} onClose={() => setUploadOpen(false)} linkedDoc={linkedDoc} onToast={handleUploadToast} />

      {/* 文档详情抽屉 */}
      <DocDetailDrawer
        doc={detail}
        onClose={() => setDetail(null)}
        onSetAuthoritative={(docId, versionLabel) => {
          setDocs((prev) =>
            prev.map((d) =>
              d.id === docId
                ? {
                    ...d,
                    version: versionLabel,
                    versions: d.versions.map((v) => ({ ...v, authoritative: v.label === versionLabel, note: v.label === versionLabel ? '当前权威版本' : v.note })),
                  }
                : d,
            ),
          )
          setDetail((prev) =>
            prev && prev.id === docId
              ? { ...prev, version: versionLabel, versions: prev.versions.map((v) => ({ ...v, authoritative: v.label === versionLabel })) }
              : prev,
          )
        }}
        onUpdateValidity={(docId, patch) => patchDoc(docId, patch)}
        onToast={(kind, msg) => toast[kind](msg)}
      />

      {/* 导入历史 */}
      <SideDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} title="导入历史" width={440}>
        <ul className="flex flex-col divide-y divide-neutral-100">
          {IMPORT_HISTORY.map((h) => (
            <li key={h.batch} className="flex items-center gap-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                <History className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body-sm font-medium text-neutral-950">{h.batch}</span>
                <span className="text-caption text-neutral-500">{h.detail}</span>
              </span>
              <span className="shrink-0 text-right">
                <StatusBadge status={h.status} />
                <span className="mt-1 block text-caption text-neutral-400">{h.time}</span>
              </span>
            </li>
          ))}
        </ul>
      </SideDrawer>

      {/* 新建空间 Modal */}
      <Modal
        open={newSpaceOpen}
        onClose={() => setNewSpaceOpen(false)}
        title="新建知识空间"
        width={440}
        footer={
          <>
            <button
              type="button"
              onClick={() => setNewSpaceOpen(false)}
              className="h-10 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 hover:border-brand-300"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!newSpaceName.trim()}
              onClick={createSpace}
              className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              创建空间
            </button>
          </>
        }
      >
        <label className="block text-caption text-neutral-400">空间名称</label>
        <input
          value={newSpaceName}
          onChange={(e) => setNewSpaceName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') createSpace()
          }}
          placeholder="例如：研发知识库"
          className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-body-sm outline-none focus:border-brand-500 focus:shadow-input"
        />
        <label className="mt-3 block text-caption text-neutral-400">类型</label>
        <select className="mt-1 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm outline-none focus:border-brand-500">
          <option>团队空间</option>
          <option>对外空间</option>
          <option>草稿空间</option>
        </select>
        <label className="mt-3 block text-caption text-neutral-400">可见范围</label>
        <select className="mt-1 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm outline-none focus:border-brand-500">
          <option>仅成员可见（默认）</option>
          <option>指定团队可见</option>
        </select>
        <label className="mt-3 block text-caption text-neutral-400">Owner</label>
        <input
          defaultValue="张伟"
          className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-body-sm outline-none focus:border-brand-500 focus:shadow-input"
        />
      </Modal>

      {/* 空间重命名 Modal */}
      <Modal
        open={!!renameSpaceFor}
        onClose={() => setRenameSpaceFor(null)}
        title="重命名空间"
        width={440}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRenameSpaceFor(null)}
              className="h-10 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 hover:border-brand-300"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!renameSpaceName.trim() || renameSpaceName.trim() === renameSpaceFor?.name}
              onClick={saveRenameSpace}
              className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              保存
            </button>
          </>
        }
      >
        <label className="block text-caption text-neutral-400">空间名称</label>
        <input
          value={renameSpaceName}
          onChange={(e) => setRenameSpaceName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveRenameSpace()
          }}
          className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-body-sm outline-none focus:border-brand-500 focus:shadow-input"
        />
        <p className="mt-2 text-caption text-neutral-400">重命名后，空间内 {renameSpaceFor ? countOf(renameSpaceFor.name) : 0} 份文档的归属同步更新。</p>
      </Modal>

      {/* 审核周期 Modal */}
      <Modal
        open={!!cycleFor}
        onClose={() => setCycleFor(null)}
        title={`审核周期 · ${cycleFor?.name ?? ''}`}
        width={440}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCycleFor(null)}
              className="h-10 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 hover:border-brand-300"
            >
              取消
            </button>
            <button
              type="button"
              onClick={saveCycle}
              className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
            >
              保存
            </button>
          </>
        }
      >
        <label className="block text-caption text-neutral-400">默认审核周期</label>
        <select
          value={cycleValue}
          onChange={(e) => setCycleValue(Number(e.target.value))}
          className="mt-1 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm outline-none focus:border-brand-500"
        >
          {REVIEW_CYCLE_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v} 天
            </option>
          ))}
        </select>
        <p className="mt-2 text-caption text-neutral-400">保存后对该空间内全部文档生效，到期前 7 天提醒 Owner 复审。</p>
      </Modal>

      {/* 归档空间 L2 确认 */}
      <Modal open={!!archiveSpaceFor} onClose={() => setArchiveSpaceFor(null)} width={520}>
        {archiveSpaceFor && (
          <ConfirmationCard
            title="归档空间"
            description="归档后空间从空间树隐藏，文档仍保留在知识库中。"
            fields={[
              { label: '动作', value: `归档空间「${archiveSpaceFor.name}」` },
              { label: '影响对象', value: `空间内 ${countOf(archiveSpaceFor.name)} 份文档` },
              { label: '影响范围', value: '空间不再出现在筛选与问答范围内' },
              { label: '可撤销性', value: '可联系管理员恢复' },
            ]}
            confirmText="确认归档"
            onConfirm={archiveSpace}
            onCancel={() => setArchiveSpaceFor(null)}
          />
        )}
      </Modal>

      {/* 文档重命名 Modal */}
      <Modal
        open={!!renameDocFor}
        onClose={() => setRenameDocFor(null)}
        title="重命名文档"
        width={440}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRenameDocFor(null)}
              className="h-10 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 hover:border-brand-300"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!renameDocTitle.trim()}
              onClick={saveRenameDoc}
              className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              保存
            </button>
          </>
        }
      >
        <label className="block text-caption text-neutral-400">文档名称</label>
        <input
          value={renameDocTitle}
          onChange={(e) => setRenameDocTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveRenameDoc()
          }}
          className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-body-sm outline-none focus:border-brand-500 focus:shadow-input"
        />
      </Modal>

      {/* 文档移动空间 Modal */}
      <Modal
        open={!!moveDocFor}
        onClose={() => setMoveDocFor(null)}
        title="移动空间"
        width={440}
        footer={
          <>
            <button
              type="button"
              onClick={() => setMoveDocFor(null)}
              className="h-10 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 hover:border-brand-300"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!moveTarget || moveTarget === moveDocFor?.space}
              onClick={saveMoveDoc}
              className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              确认移动
            </button>
          </>
        }
      >
        <p className="text-body-sm text-neutral-700">
          将「{moveDocFor?.title}」从 <span className="font-medium">{moveDocFor?.space}</span> 移动到：
        </p>
        <select
          value={moveTarget}
          onChange={(e) => setMoveTarget(e.target.value)}
          className="mt-2 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm outline-none focus:border-brand-500"
        >
          {moveTargets.map((t) => (
            <option key={t} value={t}>
              {t}
              {t === moveDocFor?.space ? '（当前空间）' : ''}
            </option>
          ))}
        </select>
      </Modal>

      {/* 批量移动空间 Modal */}
      <Modal
        open={batchMoveOpen}
        onClose={() => setBatchMoveOpen(false)}
        title="批量移动空间"
        width={440}
        footer={
          <>
            <button
              type="button"
              onClick={() => setBatchMoveOpen(false)}
              className="h-10 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 hover:border-brand-300"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!batchMoveTarget}
              onClick={batchMove}
              className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              确认移动
            </button>
          </>
        }
      >
        <p className="text-body-sm text-neutral-700">将已选的 {checked.length} 份文档移动到：</p>
        <select
          value={batchMoveTarget}
          onChange={(e) => setBatchMoveTarget(e.target.value)}
          className="mt-2 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm outline-none focus:border-brand-500"
        >
          {moveTargets.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Modal>

      {/* 批量归档 L2 确认 */}
      <Modal open={batchArchiveOpen} onClose={() => setBatchArchiveOpen(false)} width={520}>
        <ConfirmationCard
          title="批量归档"
          description="归档后文档默认不参与问答，仅用于历史查询。"
          fields={[
            { label: '动作', value: `归档已选的 ${checked.length} 份文档` },
            { label: '影响对象', value: `当前空间「${activeSpace}」内选中文档` },
            { label: '影响范围', value: 'AI 助手不再引用这些文档回答' },
            { label: '可撤销性', value: '可在状态筛选「已归档」中逐份恢复' },
          ]}
          confirmText="确认归档"
          onConfirm={batchArchive}
          onCancel={() => setBatchArchiveOpen(false)}
        />
      </Modal>
    </div>
  )
}
