/**
 * 指令管理 Instructions（W08b，design/instructions.md）
 * 4 个系统预置模板 + 指令列表 + 业务语言编辑器（风格/严格程度/拒答/引用 + 变量 Chip）
 * + 版本发布（L2 确认卡）+ 右侧测试预览窗（500ms 防抖 / 拒答演示 / 线上对比）。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bot,
  Check,
  ChevronRight,
  Copy,
  FileText,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { uid } from '@/lib/id'
import { KEY_NAMESPACE, loadLSArray, saveLS } from '@/lib/storage'
import { useAppStore } from '@/mocks'
import { CitationCard, DemoEmptyState, SectionCard, StatusBadge, ConfirmationCard } from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { Modal } from '@/pages/workspace/Modal'
import { useAppToast } from '@/lib/toast'
import {
  DEFAULT_INSTRUCTION_TEXT,
  DEFAULT_PUBLISH_SCOPE,
  INSTRUCTION_VARIABLES,
  SCOPE_ASSISTANTS,
  SCOPE_CHANNELS,
  STRICTNESS_LABELS,
  VARIABLE_VALUES,
  initialInstructions,
  instructionTemplates,
  instructionVersions,
  isInstruction,
  previewAnswer,
  previewRefusal,
  PREVIEW_QUESTIONS,
  strictnessHint,
} from '@/pages/workspace/instructionsData'
import type { Instruction, InstructionTemplate, InstructionVersion } from '@/pages/workspace/instructionsData'

const MAX_TEXT_LEN = 2000

/** 新增指令行 id（避免在渲染/事件路径中调用 Date.now） */
let insUid = 0
function nextInsId(prefix: string) {
  insUid += 1
  return `${prefix}-${insUid}`
}

const STYLE_OPTIONS = ['专业严谨', '简洁直接', '亲切易懂'] as const

/** 生效范围 → 确认卡「影响对象」文案（助手/渠道分列，历史遗留范围项按原文兜底） */
function scopeImpact(scope: string[]): string {
  const assistants = scope.filter((s) => (SCOPE_ASSISTANTS as readonly string[]).includes(s))
  const channels = scope.filter((s) => (SCOPE_CHANNELS as readonly string[]).includes(s))
  const rest = scope.filter(
    (s) => !(SCOPE_ASSISTANTS as readonly string[]).includes(s) && !(SCOPE_CHANNELS as readonly string[]).includes(s),
  )
  const parts: string[] = []
  if (assistants.length > 0) parts.push(`${assistants.length} 个助手（${assistants.join('、')}）`)
  if (channels.length > 0) parts.push(`${channels.length} 个渠道（${channels.join('、')}）`)
  if (rest.length > 0) parts.push(rest.join('、'))
  return parts.length > 0 ? parts.join(' 与 ') : scope.join(' · ')
}

const REJECT_OPTIONS = ['明确告知并给出建议', '转人工', '仅回答公开内容'] as const
const STATUS_FILTERS = ['全部', '生效中', '草稿', '已停用'] as const

/** 列表排序键：'今天 HH:MM' 优先于 'MM-DD'，其余兜底 */
function updatedAtKey(s: string): number {
  const today = /^今天\s*(\d{1,2}):(\d{2})/.exec(s)
  if (today) return 100000 + Number(today[1]) * 60 + Number(today[2])
  const md = /(\d{1,2})-(\d{1,2})/.exec(s)
  if (md) return Number(md[1]) * 100 + Number(md[2])
  return 0
}

interface DraftState {
  name: string
  style: Instruction['style']
  strictness: number
  rejectStrategy: Instruction['rejectStrategy']
  showCitations: boolean
  text: string
}

function draftOf(ins: Instruction): DraftState {
  return {
    name: ins.name,
    style: ins.style,
    strictness: ins.strictness,
    rejectStrategy: ins.rejectStrategy,
    showCitations: ins.showCitations,
    text: ins.text,
  }
}

const INSTRUCTIONS_KEY = KEY_NAMESPACE.instructions.list

/** 读取持久化指令：有历史数据用历史数据（元素级校验剔除损坏项），否则回退演示默认集 */
function loadInstructions(): Instruction[] {
  const loaded = loadLSArray<Instruction>(INSTRUCTIONS_KEY, isInstruction)
  return loaded.length > 0 ? loaded : initialInstructions
}

/** 把指令文本中的 {变量} 渲染为蓝底 Chip（预览区用） */
function renderWithVariables(text: string, resolve: boolean) {
  const parts = text.split(/(\{[^}]+\})/g)
  return parts.map((p, i) => {
    if (/^\{[^}]+\}$/.test(p)) {
      const val = resolve ? (VARIABLE_VALUES[p] ?? p) : p
      return (
        <span key={i} className="mx-0.5 inline-flex items-center rounded-sm bg-brand-100 px-1.5 py-0.5 text-caption font-medium text-brand-700">
          {val}
        </span>
      )
    }
    return <span key={i}>{p}</span>
  })
}

export default function Instructions() {
  const toast = useAppToast()
  const { state } = useAppStore()
  // 冷启动空态：未载入演示数据时展示引导空态（评审 P1-N1）
  const demoOff = state.demoData === false
  const [instructions, setInstructions] = useState<Instruction[]>(loadInstructions)
  const [selectedId, setSelectedId] = useState('ins-sales')
  const selected = instructions.find((i) => i.id === selectedId) ?? instructions[0]

  const [draft, setDraft] = useState<DraftState>(() => draftOf(instructions[0]))
  const [dirty, setDirty] = useState(false)
  const [pendingSelect, setPendingSelect] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [confirmKind, setConfirmKind] = useState<'publish' | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ---------- 列表工具：搜索 / 状态筛选 / 排序 ----------
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('全部')
  const [sortBy, setSortBy] = useState<'updatedAt' | 'name'>('updatedAt')

  // ---------- 行操作 ----------
  const [menuFor, setMenuFor] = useState<{ id: string; top: number; left: number } | null>(null)
  const [renameFor, setRenameFor] = useState<Instruction | null>(null)
  const [renameText, setRenameText] = useState('')
  const [actionConfirm, setActionConfirm] = useState<{ kind: 'disable' | 'delete'; ins: Instruction } | null>(null)

  // ---------- 生效范围选择器 ----------
  const [scopeOpen, setScopeOpen] = useState(false)
  const [scopeAssistants, setScopeAssistants] = useState<string[]>([])
  const [scopeChannels, setScopeChannels] = useState<string[]>([])
  /** 最近一次确认的范围（草稿首次发布时沿用） */
  const [lastScope, setLastScope] = useState<string[]>(DEFAULT_PUBLISH_SCOPE)

  /** 本次发布将实际生效的范围（草稿首发作 lastScope，否则沿用现有范围），供确认卡「影响对象」展示 */
  const publishScope =
    selected.scope.length === 0 || (selected.scope.length === 1 && selected.scope[0] === '未发布')
      ? lastScope
      : selected.scope

  // 指令 CRUD/发布/回滚持久化：任一变更回写 localStorage（刷新不丢）；冷启动空态不写入
  useEffect(() => {
    if (demoOff) return
    saveLS(INSTRUCTIONS_KEY, instructions)
  }, [instructions, demoOff])

  // ---------- 测试预览 ----------
  const [question, setQuestion] = useState(PREVIEW_QUESTIONS[0])
  const [customQ, setCustomQ] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewKey, setPreviewKey] = useState(0) // 触发答案重渲染
  const [compareMode, setCompareMode] = useState(false)
  const [showRefusalDemo, setShowRefusalDemo] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const readonly = Boolean(selected.readonly)
  const isRefusal = draft.strictness >= 5

  const regenerate = (delay = 500) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setPreviewLoading(true)
    debounceRef.current = setTimeout(() => {
      setPreviewLoading(false)
      setPreviewKey((k) => k + 1)
    }, delay)
  }

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  // 严格程度变化 → 500ms 防抖重新生成
  const setStrictness = (v: number) => {
    if (readonly) return
    setDraft((d) => ({ ...d, strictness: v }))
    setDirty(true)
    regenerate()
  }

  const updateDraft = (patch: Partial<DraftState>) => {
    if (readonly) return
    setDraft((d) => ({ ...d, ...patch }))
    setDirty(true)
  }

  const selectInstruction = (id: string) => {
    if (id === selectedId) return
    if (dirty) {
      setPendingSelect(id)
      return
    }
    doSelect(id)
  }

  const doSelect = (id: string) => {
    const target = instructions.find((i) => i.id === id)
    if (!target) return
    setSelectedId(id)
    setDraft(draftOf(target))
    setDirty(false)
    setPendingSelect(null)
  }

  const insertVariable = (v: string) => {
    if (readonly) return
    const ta = textareaRef.current
    const pos = ta ? ta.selectionStart : draft.text.length
    const next = draft.text.slice(0, pos) + v + draft.text.slice(pos)
    updateDraft({ text: next.slice(0, MAX_TEXT_LEN) })
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus()
        const p = pos + v.length
        ta.setSelectionRange(p, p)
      }
    })
  }

  const handleSaveDraft = () => {
    if (draft.name.trim().length < 2) {
      toast.warning('指令名称至少 2 个字，请完善后再保存')
      return
    }
    setInstructions((prev) =>
      prev.map((i) => (i.id === selectedId ? { ...i, ...draft, name: draft.name.trim(), updatedAt: '今天 10:30', updatedBy: '张伟' } : i)),
    )
    setDirty(false)
    toast.success('草稿已保存')
  }

  const handlePublish = () => {
    if (draft.name.trim().length < 2) {
      setConfirmKind(null)
      toast.warning('指令名称至少 2 个字，请完善后再发布')
      return
    }
    setInstructions((prev) =>
      prev.map((i) => {
        if (i.id !== selectedId) return i
        const m = /^v(\d+)\.(\d+)/.exec(i.version)
        const next = m ? `v${m[1]}.${Number(m[2]) + 1}` : 'v1.0'
        // 草稿首次发布：范围不再停留「未发布」，沿用最近确认的范围
        const unpublished = i.scope.length === 0 || (i.scope.length === 1 && i.scope[0] === '未发布')
        const scope = unpublished ? [...lastScope] : i.scope
        return {
          ...i,
          ...draft,
          name: draft.name.trim(),
          version: next,
          status: '生效中',
          scope,
          scopeLabel: scope.join(' · '),
          updatedAt: '今天 10:30',
          updatedBy: '张伟',
        }
      }),
    )
    setDirty(false)
    setConfirmKind(null)
    toast.success(`已发布新版本，在用版本冻结可追溯`)
  }

  const handleUseTemplate = (tpl: InstructionTemplate) => {
    const copy: Instruction = {
      id: uid(),
      name: `${tpl.name}副本`,
      type: '自定义',
      typeNote: `源自${tpl.name}模板`,
      version: 'v0.1-draft',
      scope: ['未发布'],
      scopeLabel: '未发布',
      updatedAt: '今天 10:30',
      updatedBy: '张伟',
      status: '草稿',
      style: '专业严谨',
      strictness: 4,
      rejectStrategy: '明确告知并给出建议',
      showCitations: true,
      text: DEFAULT_INSTRUCTION_TEXT,
    }
    setInstructions((prev) => [...prev, copy])
    toast.success(`已基于「${tpl.name}」创建副本`)
  }

  const handleNewInstruction = () => {
    const blank: Instruction = {
      id: uid(),
      name: '未命名自定义指令',
      type: '自定义',
      version: 'v0.1-draft',
      scope: ['未发布'],
      scopeLabel: '未发布',
      updatedAt: '今天 10:30',
      updatedBy: '张伟',
      status: '草稿',
      style: '专业严谨',
      strictness: 3,
      rejectStrategy: '明确告知并给出建议',
      showCitations: true,
      text: '',
    }
    setInstructions((prev) => [...prev, blank])
    setSelectedId(blank.id)
    setDraft(draftOf(blank))
    setDirty(true)
    toast.info('已创建空白草稿（v0.1-draft），请在下方编辑器完善')
  }

  // ---------- 列表行操作 ----------

  const openRename = (ins: Instruction) => {
    setMenuFor(null)
    setRenameFor(ins)
    setRenameText(ins.name)
  }

  const handleRename = () => {
    if (!renameFor) return
    const next = renameText.trim()
    if (next.length < 2) return
    setInstructions((prev) => prev.map((i) => (i.id === renameFor.id ? { ...i, name: next } : i)))
    if (renameFor.id === selectedId) setDraft((d) => ({ ...d, name: next }))
    toast.success(`已重命名为「${next}」`)
    setRenameFor(null)
  }

  const handleDuplicate = (ins: Instruction) => {
    setMenuFor(null)
    const copy: Instruction = {
      ...ins,
      id: nextInsId('ins-copy'),
      name: `${ins.name} 副本`,
      type: '自定义',
      typeNote: ins.type === '系统' ? `复制自系统指令「${ins.name}」` : ins.typeNote,
      version: 'v0.1-draft',
      scope: ['未发布'],
      scopeLabel: '未发布',
      updatedAt: '今天 10:30',
      updatedBy: '张伟',
      status: '草稿',
      readonly: false,
    }
    setInstructions((prev) => [...prev, copy])
    toast.success(`已复制为「${copy.name}」（草稿），可在列表中继续编辑`)
  }

  const requestToggleStatus = (ins: Instruction) => {
    setMenuFor(null)
    if (ins.status === '生效中') {
      setActionConfirm({ kind: 'disable', ins })
      return
    }
    // 已停用 → 重新启用（无风险，直接生效）
    setInstructions((prev) => prev.map((i) => (i.id === ins.id ? { ...i, status: '生效中', updatedAt: '今天 10:30', updatedBy: '张伟' } : i)))
    toast.success(`「${ins.name}」已重新启用`)
  }

  const handleDisable = () => {
    if (!actionConfirm) return
    const { ins } = actionConfirm
    setInstructions((prev) => prev.map((i) => (i.id === ins.id ? { ...i, status: '已停用', updatedAt: '今天 10:30', updatedBy: '张伟' } : i)))
    setActionConfirm(null)
    toast.success(`「${ins.name}」已停用，其生效范围将回退到全局默认指令`)
  }

  const handleDelete = () => {
    if (!actionConfirm) return
    const { ins } = actionConfirm
    const next = instructions.filter((i) => i.id !== ins.id)
    setInstructions(next)
    if (ins.id === selectedId && next.length > 0) {
      setSelectedId(next[0].id)
      setDraft(draftOf(next[0]))
      setDirty(false)
    }
    setActionConfirm(null)
    toast.success(`「${ins.name}」已删除`)
  }

  // ---------- 生效范围选择器 ----------

  const openScopeModal = () => {
    setScopeAssistants(selected.scope.filter((s) => (SCOPE_ASSISTANTS as readonly string[]).includes(s)))
    setScopeChannels(selected.scope.filter((s) => (SCOPE_CHANNELS as readonly string[]).includes(s)))
    setScopeOpen(true)
  }

  const toggleScopeItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item])
  }

  const confirmScope = () => {
    const scope = [...scopeAssistants, ...scopeChannels]
    const finalScope = scope.length > 0 ? scope : ['未发布']
    setLastScope(scope.length > 0 ? scope : DEFAULT_PUBLISH_SCOPE)
    setInstructions((prev) =>
      prev.map((i) => (i.id === selectedId ? { ...i, scope: finalScope, scopeLabel: finalScope.join(' · ') } : i)),
    )
    setScopeOpen(false)
    toast.success(scope.length > 0 ? '生效范围已更新' : '未选择任何范围，已标记为「未发布」')
  }

  // ---------- 版本回滚 ----------

  const handleRollback = (v: InstructionVersion) => {
    const draftIns: Instruction = {
      id: nextInsId('ins-rollback'),
      name: `基于 ${v.version} 的回滚草稿`,
      type: '自定义',
      typeNote: `回滚自「${selected.name}」${v.version}`,
      version: 'v0.1-draft',
      scope: ['未发布'],
      scopeLabel: '未发布',
      updatedAt: '今天 10:30',
      updatedBy: '张伟',
      status: '草稿',
      style: selected.readonly ? '专业严谨' : draft.style,
      strictness: selected.readonly ? 3 : draft.strictness,
      rejectStrategy: selected.readonly ? '明确告知并给出建议' : draft.rejectStrategy,
      showCitations: selected.readonly ? true : draft.showCitations,
      text: v.text,
    }
    setInstructions((prev) => [...prev, draftIns])
    setShowVersions(false)
    if (dirty) {
      // 走既有未保存拦截：保存或放弃后自动选中新草稿
      setPendingSelect(draftIns.id)
    } else {
      setSelectedId(draftIns.id)
      setDraft(draftOf(draftIns))
    }
    toast.success(`已生成「基于 ${v.version} 的回滚草稿」并载入编辑器，确认后发布生效`)
  }

  // ---------- 列表过滤 / 排序 ----------

  const visibleInstructions = useMemo(() => {
    const q = query.trim()
    const list = instructions.filter(
      (i) => (statusFilter === '全部' || i.status === statusFilter) && (!q || i.name.includes(q)),
    )
    return [...list].sort((a, b) =>
      sortBy === 'name' ? a.name.localeCompare(b.name, 'zh') : updatedAtKey(b.updatedAt) - updatedAtKey(a.updatedAt),
    )
  }, [instructions, query, statusFilter, sortBy])

  const activeQuestion = customQ.trim() || question
  const variablesMissing = useMemo(
    () => INSTRUCTION_VARIABLES.filter((v) => draft.text.includes(v) && !VARIABLE_VALUES[v]),
    [draft.text],
  )

  // 冷启动空态：未载入演示数据时只显示页头 + 引导空态（评审 P1-N1）
  if (demoOff) {
    return (
      <div>
        <PageHeader
          crumbs={['智能助手', '指令管理']}
          title="指令管理"
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
            智能助手
            <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
            <span className="font-medium text-neutral-950">指令管理</span>
          </nav>
          <h1 className="text-h1 text-neutral-950">指令管理</h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {[
            { icon: <FileText className="h-4 w-4" />, name: '系统预置模板', value: 4, suffix: '个' },
            { icon: <Pencil className="h-4 w-4" />, name: '自定义指令', value: 3, suffix: '个' },
            { icon: <Bot className="h-4 w-4" />, name: '使用中助手', value: 2, suffix: '个' },
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
              onClick={() => setShowVersions(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
            >
              <History className="h-4 w-4" />
              版本记录
            </button>
            <button
              type="button"
              onClick={handleNewInstruction}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              新建自定义指令
            </button>
          </div>
        </div>
      </div>

      {/* Row 1：系统预置模板（4 张横向卡） */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {instructionTemplates.map((tpl, i) => (
          <motion.div
            key={tpl.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[20px] leading-none">{tpl.icon}</span>
              {tpl.inUse ? (
                <span className="rounded-pill bg-success-bg px-2 py-0.5 text-caption font-medium text-success">使用中</span>
              ) : (
                <span className="rounded-pill bg-neutral-100 px-2 py-0.5 text-caption font-medium text-neutral-500">未使用</span>
              )}
            </div>
            <h3 className="mt-2.5 text-h3 text-neutral-950">{tpl.name}</h3>
            <p className="mt-1 text-caption text-neutral-500">{tpl.positioning}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="truncate text-caption text-neutral-400">{tpl.inUse ? tpl.usedBy : '系统预置 · 只读'}</span>
              <button
                type="button"
                onClick={() => handleUseTemplate(tpl)}
                className="shrink-0 text-body-sm font-medium text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
              >
                使用模板
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Row 2：左 8（列表+编辑器）｜ 右 4（测试预览 sticky） */}
      <div className="mt-4 grid grid-cols-12 gap-4">
        <div className="col-span-12 flex flex-col gap-4 xl:col-span-8">
          {/* 指令列表 */}
          <SectionCard title="指令列表" icon={<FileText className="h-5 w-5" />}>
            {/* 列表工具：搜索 / 状态筛选 / 排序 */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-md border border-neutral-200 bg-surface-page px-2.5 focus-within:border-brand-500 focus-within:bg-white focus-within:shadow-input">
                <Search className="h-4 w-4 shrink-0 text-neutral-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="按指令名称搜索…"
                  className="w-full bg-transparent text-body-sm text-neutral-800 outline-none placeholder:text-neutral-400"
                />
              </div>
              <div className="flex items-center gap-1 rounded-md bg-neutral-100 p-1">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'h-7 rounded-sm px-2.5 text-caption font-medium transition-colors duration-micro ease-brand',
                      statusFilter === s ? 'bg-white text-brand-700 shadow-card' : 'text-neutral-500 hover:text-neutral-700',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'updatedAt' | 'name')}
                className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-body-sm text-neutral-700 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:shadow-input"
                title="排序方式"
              >
                <option value="updatedAt">按更新时间</option>
                <option value="name">按名称</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="h-10 bg-surface-soft text-body-sm text-neutral-500">
                    <th className="rounded-l-md px-3 font-normal">指令名称</th>
                    <th className="px-3 font-normal">类型</th>
                    <th className="px-3 font-normal">版本</th>
                    <th className="px-3 font-normal">生效范围</th>
                    <th className="px-3 font-normal">更新时间</th>
                    <th className="px-3 font-normal">状态</th>
                    <th className="rounded-r-md px-3 text-right font-normal">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInstructions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="h-24 text-center text-body-sm text-neutral-400">
                        没有匹配的指令，调整搜索或筛选条件试试
                      </td>
                    </tr>
                  )}
                  {visibleInstructions.map((ins) => {
                    const active = ins.id === selectedId
                    return (
                      <tr
                        key={ins.id}
                        onClick={() => selectInstruction(ins.id)}
                        className={cn(
                          'h-12 cursor-pointer border-b border-neutral-100 text-body-sm transition-colors duration-micro ease-brand',
                          active ? 'bg-surface-cardSel shadow-[inset_0_0_0_1.5px_#2F74FF]' : 'hover:bg-surface-page',
                        )}
                      >
                        <td className="rounded-l-md px-3 font-medium text-neutral-950">{ins.name}</td>
                        <td className="px-3 text-neutral-500">
                          {ins.type}
                          {ins.typeNote && <span className="block text-caption text-neutral-400">{ins.typeNote}</span>}
                        </td>
                        <td className="px-3 text-neutral-700">{ins.version}</td>
                        <td className="px-3 text-neutral-500">{ins.scopeLabel}</td>
                        <td className="px-3 text-neutral-500">
                          {ins.updatedAt} {ins.updatedBy}
                        </td>
                        <td className="px-3">
                          <StatusBadge status={ins.status} />
                        </td>
                        <td className="rounded-r-md px-3 text-right">
                          <div className="inline-block">
                            <button
                              type="button"
                              aria-label={`${ins.name} 更多操作`}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (menuFor?.id === ins.id) {
                                  setMenuFor(null)
                                  return
                                }
                                const r = e.currentTarget.getBoundingClientRect()
                                setMenuFor({ id: ins.id, top: r.bottom + 4, left: r.right - 144 })
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-brand-600"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {menuFor?.id === ins.id && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setMenuFor(null) }} />
                                <div
                                  className="fixed z-40 w-36 rounded-lg border border-neutral-200 bg-white py-1 text-left shadow-float"
                                  style={{ top: menuFor.top, left: menuFor.left }}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openRename(ins) }}
                                    className="flex w-full items-center gap-2 px-3.5 py-2 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:bg-neutral-50"
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-neutral-400" />
                                    重命名
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDuplicate(ins) }}
                                    className="flex w-full items-center gap-2 px-3.5 py-2 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:bg-neutral-50"
                                  >
                                    <Copy className="h-3.5 w-3.5 text-neutral-400" />
                                    复制
                                  </button>
                                  {!ins.readonly && ins.status !== '草稿' && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); requestToggleStatus(ins) }}
                                      className="flex w-full items-center gap-2 px-3.5 py-2 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:bg-neutral-50"
                                    >
                                      <Power className="h-3.5 w-3.5 text-neutral-400" />
                                      {ins.status === '生效中' ? '停用' : '启用'}
                                    </button>
                                  )}
                                  {!ins.readonly && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setMenuFor(null); setActionConfirm({ kind: 'delete', ins }) }}
                                      className="flex w-full items-center gap-2 px-3.5 py-2 text-body-sm text-danger transition-colors duration-micro ease-brand hover:bg-danger-bg"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      删除
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* 指令编辑器 */}
          <SectionCard
            title={`指令编辑器 · ${selected.name}`}
            icon={<SlidersHorizontal className="h-5 w-5" />}
            actions={
              dirty ? (
                <span className="inline-flex items-center gap-1.5 text-caption font-medium text-warning">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                  有未保存修改
                </span>
              ) : undefined
            }
          >
            {readonly && (
              <div className="mb-4 rounded-lg bg-neutral-100 px-3.5 py-2.5 text-body-sm text-neutral-500">
                系统预置指令不可修改，可通过上方「使用模板」创建副本。
              </div>
            )}
            <fieldset disabled={readonly} className={cn(readonly && 'opacity-70')}>
              {/* 0. 指令名称（与列表行双向同步） */}
              <div>
                <p className="text-body-sm font-semibold text-neutral-950">指令名称</p>
                <input
                  value={draft.name}
                  onChange={(e) => updateDraft({ name: e.target.value.slice(0, 30) })}
                  maxLength={30}
                  placeholder="2–30 字，保存后同步到列表"
                  className="mt-2 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
                />
              </div>

              {/* 1. 回答风格 */}
              <div>
                <p className="text-body-sm font-semibold text-neutral-950">回答风格</p>
                <p className="mt-0.5 text-caption text-neutral-400">影响答案的措辞，不影响事实依据</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {STYLE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateDraft({ style: s })}
                      className={cn(
                        'flex h-10 items-center justify-center gap-1.5 rounded-md border text-body-sm transition-colors duration-micro ease-brand',
                        draft.style === s
                          ? 'border-[1.5px] border-brand-500 bg-surface-cardSel font-medium text-brand-700'
                          : 'border-neutral-200 text-neutral-700 hover:border-brand-300',
                      )}
                    >
                      {draft.style === s && <Check className="h-3.5 w-3.5 text-brand-600" />}
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. 严格程度 */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <p className="text-body-sm font-semibold text-neutral-950">严格程度</p>
                  <span className="rounded-pill bg-brand-50 px-2 py-0.5 text-caption font-medium text-brand-700">
                    {draft.strictness} 档 · {STRICTNESS_LABELS[draft.strictness - 1]}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="shrink-0 text-caption text-neutral-400">尽量回答</span>
                  <div className="grid flex-1 grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setStrictness(v)}
                        aria-label={`严格程度 ${v} 档`}
                        className={cn(
                          'h-2.5 rounded-pill transition-colors duration-micro ease-brand',
                          v <= draft.strictness ? 'bg-brand-500' : 'bg-brand-100 hover:bg-brand-300',
                        )}
                      />
                    ))}
                  </div>
                  <span className="shrink-0 text-caption text-neutral-400">没有依据就不回答</span>
                </div>
                <p className="mt-1.5 text-caption text-neutral-500">{strictnessHint(draft.strictness)}</p>
              </div>

              {/* 3+4. 拒答策略 / 引用显示 */}
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-body-sm font-semibold text-neutral-950">拒答策略</p>
                  <select
                    value={draft.rejectStrategy}
                    onChange={(e) => updateDraft({ rejectStrategy: e.target.value as Instruction['rejectStrategy'] })}
                    className="mt-2 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
                  >
                    {REJECT_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-body-sm font-semibold text-neutral-950">引用显示</p>
                  <div className="mt-2 flex h-10 items-center justify-between gap-2 rounded-md border border-neutral-200 px-3">
                    <span className="text-body-sm text-neutral-700">每个结论都标明来源文档与页码</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.showCitations}
                      onClick={() => updateDraft({ showCitations: !draft.showCitations })}
                      className={cn(
                        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-comp ease-brand',
                        draft.showCitations ? 'bg-brand-600' : 'bg-neutral-300',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-comp ease-brand',
                          draft.showCitations ? 'translate-x-[22px]' : 'translate-x-0.5',
                        )}
                      />
                    </button>
                  </div>
                  <p className="mt-1 text-caption text-neutral-400">首次可信答案场景不可关闭</p>
                </div>
              </div>

              {/* 指令文本 */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <p className="text-body-sm font-semibold text-neutral-950">指令文本（业务语言）</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-caption text-neutral-400">插入变量：</span>
                    {INSTRUCTION_VARIABLES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVariable(v)}
                        className="rounded-pill bg-brand-50 px-2 py-0.5 text-caption font-medium text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-100"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative mt-2">
                  <textarea
                    ref={textareaRef}
                    value={draft.text}
                    onChange={(e) => updateDraft({ text: e.target.value.slice(0, MAX_TEXT_LEN) })}
                    placeholder="用业务语言描述回答要求，例如：你是{企业名称}的销售知识助手……"
                    className="min-h-[120px] w-full resize-y rounded-md border border-neutral-200 bg-white p-3 pb-7 text-body text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
                  />
                  <span className="pointer-events-none absolute bottom-2.5 right-3 text-caption text-neutral-400">
                    {draft.text.length}/{MAX_TEXT_LEN}
                  </span>
                </div>
                {draft.text && (
                  <div className="mt-2 rounded-lg bg-surface-soft p-3 text-body-sm leading-6 text-neutral-700">
                    <span className="mr-2 text-caption text-neutral-400">变量渲染：</span>
                    {renderWithVariables(draft.text, true)}
                  </div>
                )}
              </div>
            </fieldset>

            {/* 版本与生效范围行 */}
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
              <span className="rounded-pill bg-neutral-100 px-2.5 py-1 text-caption font-medium text-neutral-700">
                版本 {selected.version}
              </span>
              <button
                type="button"
                onClick={() => setShowVersions(true)}
                className="text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
              >
                查看历史
              </button>
              <span className="text-neutral-200">|</span>
              <span className="text-caption text-neutral-400">生效范围：</span>
              {selected.scope.map((s) => (
                <span key={s} className="rounded-pill bg-brand-50 px-2.5 py-1 text-caption font-medium text-brand-700">
                  {s}
                </span>
              ))}
              <button
                type="button"
                onClick={openScopeModal}
                className="text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
              >
                修改范围 ›
              </button>
            </div>

            {/* 底部操作 */}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={readonly || !dirty}
                className="h-10 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600 disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                保存草稿
              </button>
              <button
                type="button"
                onClick={() => setConfirmKind('publish')}
                disabled={readonly}
                className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700 disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                发布新版本
              </button>
            </div>
          </SectionCard>
        </div>

        {/* 右 4：测试预览面板（sticky） */}
        <div className="col-span-12 xl:col-span-4">
          <div className="xl:sticky xl:top-4">
            <SectionCard title="试一下效果" icon={<Sparkles className="h-5 w-5" />}>
              <p className="-mt-2 mb-3 text-caption text-neutral-400">预览不计入真实指标</p>
              <select
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value)
                  setCustomQ('')
                  regenerate()
                }}
                className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 focus:border-brand-500 focus:shadow-input focus:outline-none"
              >
                {PREVIEW_QUESTIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex gap-2">
                <input
                  value={customQ}
                  onChange={(e) => setCustomQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customQ.trim()) regenerate()
                  }}
                  placeholder="或输入自定义问题…"
                  className="h-10 min-w-0 flex-1 rounded-md border border-neutral-200 px-3 text-body-sm text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => customQ.trim() && regenerate()}
                  aria-label="发送预览问题"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              {variablesMissing.length > 0 && (
                <div className="mt-3 rounded-lg bg-warning-bg px-3 py-2 text-caption text-warning">
                  变量 {variablesMissing.join('、')} 未配置，将显示原文
                </div>
              )}

              {/* 预览结果区 */}
              <div className="mt-3 min-h-[180px] rounded-lg border border-neutral-100 bg-surface-soft p-3">
                {previewLoading ? (
                  <div className="flex h-[180px] flex-col items-center justify-center gap-2 text-neutral-400">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
                    <span className="text-caption">正在按当前指令试答…</span>
                  </div>
                ) : isRefusal || showRefusalDemo ? (
                  <motion.div
                    key={`refusal-${previewKey}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-lg border border-warning/30 bg-warning-bg p-3.5"
                  >
                    <p className="text-body-sm font-semibold text-neutral-950">{previewRefusal.reason}</p>
                    <p className="mt-2 text-body-sm text-neutral-700">
                      <span className="font-medium">下一步：</span>
                      {previewRefusal.next}
                    </p>
                    <p className="mt-1.5 text-body-sm text-neutral-700">
                      <span className="font-medium">最接近的主题：</span>
                      {previewRefusal.closest}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`ans-${previewKey}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div className="flex items-center gap-2 text-caption text-neutral-400">
                      <Bot className="h-3.5 w-3.5" />
                      问题：{activeQuestion}
                    </div>
                    <p className="mt-2 text-body font-semibold text-neutral-950">{previewAnswer.conclusion}</p>
                    <p className="mt-1.5 text-body-sm leading-6 text-neutral-700">{previewAnswer.explanation}</p>
                    <div className="mt-2.5 flex flex-col gap-2">
                      {previewAnswer.citations.map((c, i) => (
                        <CitationCard key={c.name} name={c.name} version={c.version} page={c.page} primary={i === 0} />
                      ))}
                    </div>
                    <div className="mt-2.5">
                      <span className="rounded-pill bg-success-bg px-2.5 py-1 text-caption font-medium text-success">
                        可信度 {previewAnswer.trust}% · 可信
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* 对比模式 */}
              <div className="mt-3 flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2.5">
                <span className="text-body-sm text-neutral-700">与当前线上版本对比</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={compareMode}
                  onClick={() => setCompareMode((v) => !v)}
                  className={cn(
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-comp ease-brand',
                    compareMode ? 'bg-brand-600' : 'bg-neutral-300',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-comp ease-brand',
                      compareMode ? 'translate-x-[22px]' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </div>
              <AnimatePresence>
                {compareMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-neutral-200 p-3">
                        <p className="text-caption font-medium text-neutral-500">{selected.version} 线上</p>
                        <p className="mt-1.5 text-body-sm leading-6 text-neutral-700">{previewAnswer.explanation}</p>
                      </div>
                      <div className="rounded-lg border border-brand-300 bg-surface-cardSel p-3">
                        <p className="text-caption font-medium text-brand-600">草稿（{draft.style} · {draft.strictness} 档）</p>
                        <p className="mt-1.5 text-body-sm leading-6 text-neutral-700">
                          需要销售总监审批。
                          <span className="bg-surface-highlight">（按当前{draft.style}风格与 {draft.strictness} 档严格程度重新组织措辞）</span>
                          {previewAnswer.explanation}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={() => setShowRefusalDemo((v) => !v)}
                className="mt-3 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
              >
                {showRefusalDemo ? '收起拒答演示 ›' : '看看拒答时长什么样 ›'}
              </button>
            </SectionCard>
          </div>
        </div>
      </div>

      {/* 版本对比 Modal */}
      <Modal open={showVersions} onClose={() => setShowVersions(false)} title="版本记录与对比" description="v2.2 vs v2.3 差异高亮" width={720}>
        <div className="flex flex-col gap-4">
          {instructionVersions.map((v) => (
            <div key={v.version} className={cn('rounded-lg border p-4', v.version === 'v2.3' ? 'border-brand-300 bg-surface-cardSel' : 'border-neutral-200')}>
              <div className="flex items-center justify-between">
                <span className="text-body-sm font-semibold text-neutral-950">{v.version}</span>
                <span className="text-caption text-neutral-400">
                  {v.updatedAt} · {v.updatedBy}
                </span>
              </div>
              <p className="mt-1 text-caption text-neutral-500">{v.note}</p>
              <p className={cn('mt-2 rounded-md p-3 text-body-sm leading-6', v.version === 'v2.3' ? 'bg-white' : 'bg-surface-soft')}>
                {v.version === 'v2.2' ? (
                  <>
                    你是{'{企业名称}'}的销售知识助手。回答报价与折扣问题时，
                    <span className="bg-surface-highlight">应引用{'{知识范围}'}内的制度文件</span>。
                  </>
                ) : (
                  <>
                    你是{'{企业名称}'}的销售知识助手。回答报价与折扣问题时，
                    <span className="bg-surface-highlight">必须引用{'{知识范围}'}内的最新制度版本；不确定时直接说明，不要推测具体数字</span>。
                  </>
                )}
              </p>
              {v.version !== instructionVersions[0].version && (
                <button
                  type="button"
                  onClick={() => handleRollback(v)}
                  className="mt-2 text-body-sm font-medium text-brand-600 hover:text-brand-500"
                >
                  回滚到此版本
                </button>
              )}
            </div>
          ))}
        </div>
      </Modal>

      {/* L2 确认卡：发布新版本 */}
      <Modal open={confirmKind !== null} onClose={() => setConfirmKind(null)} width={560}>
        {confirmKind === 'publish' && (
          <ConfirmationCard
            title="发布新版本"
            description="发布后在用版本冻结可追溯"
            fields={[
              { label: '动作', value: `将「${selected.name}」发布为新版本（当前 ${selected.version}）` },
              { label: '影响对象', value: scopeImpact(publishScope) },
              { label: '影响范围', value: '该渠道 156 个历史问题的回答口径' },
              { label: '可撤销性', value: `可一键回滚到 ${selected.version}` },
            ]}
            confirmText="确认发布"
            onConfirm={handlePublish}
            onModify={() => setConfirmKind(null)}
            onCancel={() => setConfirmKind(null)}
          />
        )}
      </Modal>

      {/* 修改生效范围：真实选择器（助手 × 渠道） */}
      <Modal
        open={scopeOpen}
        onClose={() => setScopeOpen(false)}
        title="修改生效范围"
        description={`调整「${selected.name}」作用的助手与渠道，确认后范围 Chip 即时更新`}
        width={560}
        footer={
          <>
            <button
              type="button"
              onClick={() => setScopeOpen(false)}
              className="h-10 rounded-md px-4 text-body-sm text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100"
            >
              取消
            </button>
            <button
              type="button"
              onClick={confirmScope}
              className="h-10 rounded-md bg-brand-600 px-5 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
            >
              确认范围
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">生效助手</p>
            <p className="mt-0.5 text-caption text-neutral-400">勾选后该指令将作用于对应助手的回答</p>
            <div className="mt-2 space-y-2">
              {SCOPE_ASSISTANTS.map((a) => (
                <label key={a} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-neutral-200 px-3 py-2.5 transition-colors duration-micro ease-brand hover:border-brand-300">
                  <input
                    type="checkbox"
                    checked={scopeAssistants.includes(a)}
                    onChange={() => toggleScopeItem(scopeAssistants, setScopeAssistants, a)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span className="text-body-sm text-neutral-800">{a}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-body-sm font-semibold text-neutral-950">生效渠道</p>
            <p className="mt-0.5 text-caption text-neutral-400">多渠道同时生效时，回答口径保持一致</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {SCOPE_CHANNELS.map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-neutral-200 px-3 py-2.5 transition-colors duration-micro ease-brand hover:border-brand-300">
                  <input
                    type="checkbox"
                    checked={scopeChannels.includes(c)}
                    onChange={() => toggleScopeItem(scopeChannels, setScopeChannels, c)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span className="text-body-sm text-neutral-800">{c}</span>
                </label>
              ))}
            </div>
          </div>
          {scopeAssistants.length === 0 && scopeChannels.length === 0 && (
            <p className="rounded-md bg-warning-bg px-3 py-2 text-caption text-warning">未选择任何助手或渠道，确认后将标记为「未发布」。</p>
          )}
        </div>
      </Modal>

      {/* 重命名 */}
      <Modal
        open={renameFor !== null}
        onClose={() => setRenameFor(null)}
        title="重命名指令"
        description="保存后列表行与编辑器标题同步更新"
        width={440}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRenameFor(null)}
              className="h-10 rounded-md px-4 text-body-sm text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100"
            >
              取消
            </button>
            <button
              type="button"
              disabled={renameText.trim().length < 2}
              onClick={handleRename}
              className="h-10 rounded-md bg-brand-600 px-5 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              保存
            </button>
          </>
        }
      >
        <input
          autoFocus
          value={renameText}
          onChange={(e) => setRenameText(e.target.value.slice(0, 30))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename()
          }}
          maxLength={30}
          placeholder="2–30 字"
          className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input focus:outline-none"
        />
        {renameText.trim().length < 2 && <p className="mt-1.5 text-caption text-danger">名称至少 2 个字。</p>}
      </Modal>

      {/* L2 确认卡：停用 / 删除 */}
      <Modal open={actionConfirm !== null} onClose={() => setActionConfirm(null)} width={560}>
        {actionConfirm?.kind === 'disable' && (
          <ConfirmationCard
            title="停用指令"
            description="停用后该指令立即不再参与回答生成"
            fields={[
              { label: '动作', value: `停用「${actionConfirm.ins.name}」（当前 ${actionConfirm.ins.version}）` },
              { label: '影响对象', value: actionConfirm.ins.scopeLabel },
              { label: '影响范围', value: '上述助手与渠道将回退到「全局默认指令」的回答口径' },
              { label: '可撤销性', value: '可随时通过行操作「启用」恢复' },
            ]}
            confirmText="确认停用"
            onConfirm={handleDisable}
            onCancel={() => setActionConfirm(null)}
          />
        )}
        {actionConfirm?.kind === 'delete' && (
          <ConfirmationCard
            title="删除指令"
            description="删除后不可恢复，请确认该指令不再被使用"
            fields={[
              { label: '动作', value: `删除「${actionConfirm.ins.name}」（${actionConfirm.ins.version} · ${actionConfirm.ins.status}）` },
              { label: '影响对象', value: actionConfirm.ins.scopeLabel },
              { label: '影响范围', value: '该指令的草稿与版本记录一并移除' },
              { label: '可撤销性', value: '不可恢复；如需保留可先「复制」生成副本' },
            ]}
            confirmText="确认删除"
            onConfirm={handleDelete}
            onCancel={() => setActionConfirm(null)}
          />
        )}
      </Modal>

      {/* 草稿未保存拦截 */}
      <Modal open={pendingSelect !== null} onClose={() => setPendingSelect(null)} title="草稿未保存" width={440}>
        <p className="text-body text-neutral-700">当前指令有未保存修改，切换后将丢失。是否先保存草稿？</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => pendingSelect && doSelect(pendingSelect)}
            className="h-10 rounded-md px-4 text-body-sm text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100"
          >
            放弃修改
          </button>
          <button
            type="button"
            onClick={() => {
              handleSaveDraft()
              if (pendingSelect) doSelect(pendingSelect)
            }}
            className="h-10 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
          >
            保存并切换
          </button>
        </div>
      </Modal>

    </div>
  )
}
