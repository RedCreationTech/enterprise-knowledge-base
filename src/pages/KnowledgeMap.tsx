/**
 * 知识地图 KnowledgeMap（/workspace/knowledge-map，knowledge-map.md）
 * 顶部筛选工具条；左 9 列 SVG 图谱画布（中心 Hub + 5 分类放射 + 文档/问题节点 + 8 孤立文档，
 * 节点大小按被问次数，拖拽平移 / 滚轮缩放 / Hover Tooltip / 点击联动详情面板）；
 * 右 3 列节点详情检查器；主 CTA「处理孤立文档（8）」560px Drawer + L2 批量确认。
 */
import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Archive,
  Check,
  Download,
  Flame,
  Maximize,
  Minus,
  Plus,
  Search,
  TriangleAlert,
  UserPlus,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/mocks'
import { ConfirmationCard, DemoEmptyState, ProgressRing } from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { Modal } from '@/pages/workspace/Modal'
import { useAppToast } from '@/lib/toast'
import {
  MAP_CATEGORIES,
  MAP_DOCS,
  MAP_QUESTIONS,
  MAP_SPACE_OPTIONS,
  MAP_TYPE_FILTERS,
  MAP_VALIDITY_FILTERS,
  ORPHAN_DOCS,
  citationRecordsFor,
  docNodeSize,
  questionNodeSize,
  questionRecordsFor,
} from '@/pages/workspace/mapData'
import type { DocNode, OrphanDoc, QuestionNode } from '@/pages/workspace/mapData'

const Q_ACTION_KEY = 'knowledge-map:question-actions'

type QuestionAction = 'faq' | 'testset'

function readQuestionActions(): Record<string, QuestionAction[]> {
  try {
    const raw = localStorage.getItem(Q_ACTION_KEY)
    return raw ? (JSON.parse(raw) as Record<string, QuestionAction[]>) : {}
  } catch {
    return {}
  }
}

/** 幂等记录问题动作（创建 FAQ / 加入测试集）；返回 false 表示已加入过 */
function recordQuestionAction(qid: string, action: QuestionAction): boolean {
  const all = readQuestionActions()
  const list = all[qid] ?? []
  if (list.includes(action)) return false
  all[qid] = [...list, action]
  try {
    localStorage.setItem(Q_ACTION_KEY, JSON.stringify(all))
  } catch {
    // 隐私模式等写入失败时静默降级为当次有效
  }
  return true
}

function downloadFile(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const BTN_PRIMARY =
  'inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400'
const BTN_SECONDARY =
  'inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600'
const BTN_TERTIARY =
  'inline-flex h-8 items-center gap-1 rounded-md px-2 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50'

const HUB = { x: 500, y: 320 }
const CAT_RADIUS = 190
const CAT_COLOR = '#7357E8'
const DOC_COLOR = '#2F74FF'
const Q_COLOR = '#159FB7'

interface LayoutNode {
  id: string
  x: number
  y: number
}

function catAngle(index: number): number {
  return -90 + index * 72
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/** 预计算全部节点坐标（确定性布局） */
function computeLayout() {
  const catPos = new Map<string, { x: number; y: number; angle: number }>()
  MAP_CATEGORIES.forEach((c, i) => {
    const a = catAngle(i)
    catPos.set(c.name, { ...polar(HUB.x, HUB.y, CAT_RADIUS, a), angle: a })
  })

  const docPos = new Map<string, LayoutNode & { angle: number }>()
  MAP_CATEGORIES.forEach((c) => {
    const docs = MAP_DOCS.filter((d) => d.category === c.name)
    const cat = catPos.get(c.name)!
    docs.forEach((d, k) => {
      const spread = (k - (docs.length - 1) / 2) * 16
      const r = 300 + (k % 2) * 44
      docPos.set(d.id, { id: d.id, ...polar(HUB.x, HUB.y, r, cat.angle + spread), angle: cat.angle + spread })
    })
  })

  const qPos = new Map<string, LayoutNode>()
  MAP_QUESTIONS.forEach((q) => {
    const d = docPos.get(q.docId)!
    qPos.set(q.id, { id: q.id, ...polar(HUB.x, HUB.y, Math.hypot(d.x - HUB.x, d.y - HUB.y) + 46, d.angle + 9) })
  })

  const afterCat = catPos.get('售后服务')!
  const orphanPos = new Map<string, LayoutNode>()
  ORPHAN_DOCS.forEach((o, k) => {
    const a = afterCat.angle + (k - (ORPHAN_DOCS.length - 1) / 2) * 13
    const r = 425 + (k % 2) * 30
    orphanPos.set(o.id, { id: o.id, ...polar(HUB.x, HUB.y, r, a) })
  })

  return { catPos, docPos, qPos, orphanPos }
}

type Selection =
  | { kind: 'doc'; doc: DocNode }
  | { kind: 'category'; name: string }
  | { kind: 'question'; q: QuestionNode }

interface TooltipState {
  x: number
  y: number
  title: string
  lines: string[]
}

export default function KnowledgeMap() {
  const toast = useAppToast()
  const navigate = useNavigate()
  const { state } = useAppStore()
  // 冷启动空态：未载入演示数据时展示引导空态（评审 P1-N1）
  const demoOff = state.demoData === false
  const layout = useMemo(() => computeLayout(), [])
  const [space, setSpace] = useState(MAP_SPACE_OPTIONS[0])
  const [typeFilter, setTypeFilter] = useState<(typeof MAP_TYPE_FILTERS)[number]>('全部')
  const [validityFilter, setValidityFilter] = useState<(typeof MAP_VALIDITY_FILTERS)[number]>('全部')
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [orphans, setOrphans] = useState<OrphanDoc[]>(ORPHAN_DOCS)
  const [orphanDrawerOpen, setOrphanDrawerOpen] = useState(false)
  const [orphanChecked, setOrphanChecked] = useState<Set<string>>(new Set())
  const [archiveTarget, setArchiveTarget] = useState<OrphanDoc | null>(null)
  const [batchConfirm, setBatchConfirm] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  // 孤立文档单项治理
  const [assignTarget, setAssignTarget] = useState<OrphanDoc | null>(null)
  const [keepTarget, setKeepTarget] = useState<OrphanDoc | null>(null)
  // 引用记录 / 关联问题 Drawer
  const [citeDrawerDoc, setCiteDrawerDoc] = useState<DocNode | null>(null)
  const [qaRecord, setQaRecord] = useState<{ doc: DocNode; question: string } | null>(null)

  // 画布平移缩放
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const visibleDocs = useMemo(
    () =>
      MAP_DOCS.filter((d) => {
        if (typeFilter !== '全部' && d.category !== typeFilter) return false
        if (validityFilter !== '全部' && d.validity !== validityFilter) return false
        if (search.trim() && !d.name.includes(search.trim())) return false
        return true
      }),
    [typeFilter, validityFilter, search],
  )
  const visibleDocIds = useMemo(() => new Set(visibleDocs.map((d) => d.id)), [visibleDocs])
  const visibleQuestions = useMemo(
    () =>
      MAP_QUESTIONS.filter((q) => {
        if (!visibleDocIds.has(q.docId)) return false
        if (search.trim() && !q.text.includes(search.trim()) && !MAP_DOCS.find((d) => d.id === q.docId)?.name.includes(search.trim()))
          return false
        return true
      }),
    [visibleDocIds, search],
  )
  const visibleOrphans = useMemo(
    () =>
      orphans.filter((o) => {
        if (validityFilter !== '全部') return false
        if (typeFilter !== '全部' && o.category !== typeFilter) return false
        if (search.trim() && !o.name.includes(search.trim())) return false
        return true
      }),
    [orphans, validityFilter, typeFilter, search],
  )
  const visibleCategories = useMemo(
    () => MAP_CATEGORIES.filter((c) => typeFilter === '全部' || c.name === typeFilter),
    [typeFilter],
  )

  const shownCount = 1 + visibleCategories.length + visibleDocs.length + visibleQuestions.length
  const isEmpty = visibleDocs.length === 0 && visibleQuestions.length === 0 && visibleOrphans.length === 0

  const onWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setView((v) => ({ ...v, k: Math.min(2, Math.max(0.5, Math.round((v.k + delta) * 10) / 10)) }))
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // 仅在位移超过阈值后才 setPointerCapture，否则 click 会被 retarget 到 svg，节点 onClick 失效
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: view.x, baseY: view.y, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 5) {
      d.moved = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (d.moved) setView((v) => ({ ...v, x: d.baseX + dx, y: d.baseY + dy }))
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  const showTooltip = (e: React.MouseEvent, title: string, lines: string[]) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top + 12, title, lines })
  }

  const docTooltip = (d: DocNode) => [d.name, [`被问 ${d.asked} 次 · Owner ${d.owner}`, d.validityNote]] as const

  const hotDocs = MAP_DOCS.filter((d) => d.hot)

  const handleArchive = () => {
    if (!archiveTarget) return
    setConfirmLoading(true)
    setTimeout(() => {
      setOrphans((prev) => prev.filter((o) => o.id !== archiveTarget.id))
      setOrphanChecked((prev) => {
        const next = new Set(prev)
        next.delete(archiveTarget.id)
        return next
      })
      setConfirmLoading(false)
      setArchiveTarget(null)
      toast.success(`已归档「${archiveTarget.name}」，30 天内可恢复`)
    }, 700)
  }

  const handleBatchAssign = () => {
    setConfirmLoading(true)
    setTimeout(() => {
      const n = orphanChecked.size
      setOrphans((prev) => prev.filter((o) => !orphanChecked.has(o.id)))
      setOrphanChecked(new Set())
      setConfirmLoading(false)
      setBatchConfirm(false)
      setOrphanDrawerOpen(false)
      toast.success(`已批量指派 ${n} 份孤立文档给对应 Owner，画布已更新`)
    }, 800)
  }

  /** 导出图谱 PNG：SVG 序列化 → canvas 栅格化 → PNG 下载；失败降级 SVG 下载 */
  const exportPng = async () => {
    const svg = svgRef.current
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', '1000')
    clone.setAttribute('height', '640')
    const xml = new XMLSerializer().serializeToString(clone)
    const svgUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('svg rasterize failed'))
        img.src = svgUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = 2000
      canvas.height = 1280
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas 2d unsupported')
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      downloadFile(canvas.toDataURL('image/png'), '知识地图.png')
      toast.success('图谱 PNG 已导出（2000×1280）')
    } catch {
      downloadFile(svgUrl, '知识地图.svg')
      toast.warning('PNG 导出失败，已降级为 SVG 下载')
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(svgUrl), 1000)
    }
  }

  const removeOrphan = (id: string) => {
    setOrphans((prev) => prev.filter((o) => o.id !== id))
    setOrphanChecked((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleSingleAssign = () => {
    if (!assignTarget) return
    setConfirmLoading(true)
    setTimeout(() => {
      removeOrphan(assignTarget.id)
      setConfirmLoading(false)
      setAssignTarget(null)
      toast.success(`已将「${assignTarget.name}」指派给 ${assignTarget.owner} 复审，并移出孤立清单`)
    }, 600)
  }

  const handleKeepReview = () => {
    if (!keepTarget) return
    setConfirmLoading(true)
    setTimeout(() => {
      removeOrphan(keepTarget.id)
      setConfirmLoading(false)
      setKeepTarget(null)
      toast.success(`已为「${keepTarget.name}」设置 90 天复审提醒，并移出孤立清单`)
    }, 600)
  }

  const chipCls = (on: boolean) =>
    cn(
      'inline-flex h-8 items-center rounded-md border px-3 text-body-sm transition-colors duration-micro ease-brand',
      on ? 'border-brand-500 bg-brand-50 font-medium text-brand-600' : 'border-neutral-200 bg-white text-neutral-700 hover:border-brand-300',
    )

  // 冷启动空态：未载入演示数据时只显示页头 + 引导空态（评审 P1-N1）
  if (demoOff) {
    return (
      <div>
        <PageHeader
          crumbs={['知识', '知识地图']}
          title="知识地图"
          subtitle="完成快速配置或载入演示数据后，这里会展示真实的企业知识数据"
        />
        <DemoEmptyState />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        crumbs={['知识', '知识地图']}
        title="知识地图"
        subtitle={`以「${space.replace('（默认）', '')}」空间为视角 · 128 份资料 · 5 个分类 · 156 个问题`}
        actions={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => void exportPng()}>
              <Download className="h-4 w-4" />
              导出图谱 PNG
            </button>
            <button type="button" className={BTN_PRIMARY} onClick={() => setOrphanDrawerOpen(true)}>
              处理孤立文档（{orphans.length}）
            </button>
          </>
        }
      />

      {/* 筛选工具条 */}
      <div className="mb-4 flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
        <select
          value={space}
          onChange={(e) => {
            setSpace(e.target.value)
            toast.info(`已切换到「${e.target.value.replace('（默认）', '')}」视角`)
          }}
          className="h-9 rounded-md border border-[#DCE4EF] bg-white px-2.5 text-body-sm text-neutral-800 outline-none focus:border-brand-500"
        >
          {MAP_SPACE_OPTIONS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="mx-1 h-5 w-px bg-neutral-200" />
        {MAP_TYPE_FILTERS.map((t) => (
          <button key={t} type="button" className={chipCls(typeFilter === t)} onClick={() => setTypeFilter(t)}>
            {t}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-neutral-200" />
        {MAP_VALIDITY_FILTERS.map((v) => (
          <button key={v} type="button" className={chipCls(validityFilter === v)} onClick={() => setValidityFilter(v)}>
            {v}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索文档或问题…"
              className="h-9 w-60 rounded-md border border-[#DCE4EF] pl-8 pr-3 text-body-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input"
            />
          </div>
          <span className="hidden items-center gap-2 text-caption text-neutral-400 2xl:flex">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" />文档</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rotate-45 bg-violet" />分类</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 bg-cyan" />问题</span>
            <span>节点越大被问越多 · 红色描边=异常</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* 图谱画布 */}
        <div className="col-span-12 xl:col-span-9">
          <div ref={canvasRef} className="relative min-h-[560px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-card">
            {isEmpty ? (
              <div className="flex h-[560px] flex-col items-center justify-center text-center">
                <img src="/empty-docs.svg" alt="" className="w-52 opacity-90" />
                <h3 className="mt-3 text-h3 text-neutral-800">当前筛选下没有节点</h3>
                <p className="mt-1 text-body-sm text-neutral-500">试试放宽类型或有效期筛选条件</p>
                <button
                  type="button"
                  className={BTN_TERTIARY + ' mt-2'}
                  onClick={() => {
                    setTypeFilter('全部')
                    setValidityFilter('全部')
                    setSearch('')
                  }}
                >
                  清除筛选
                </button>
              </div>
            ) : (
              <svg
                ref={svgRef}
                viewBox="0 0 1000 640"
                className="h-[560px] w-full cursor-grab touch-none select-none active:cursor-grabbing"
                onWheel={onWheel}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={() => {
                  onPointerUp()
                  setTooltip(null)
                }}
              >
                <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
                  {/* 连线：hub → 分类 */}
                  {visibleCategories.map((c) => {
                    const p = layout.catPos.get(c.name)!
                    return <line key={`e-${c.id}`} x1={HUB.x} y1={HUB.y} x2={p.x} y2={p.y} stroke="#E4EAF2" strokeWidth={1.5} />
                  })}
                  {/* 连线：分类 → 文档 → 问题 */}
                  {visibleDocs.map((d) => {
                    const c = layout.catPos.get(d.category)!
                    const p = layout.docPos.get(d.id)!
                    return <line key={`e-${d.id}`} x1={c.x} y1={c.y} x2={p.x} y2={p.y} stroke="#E4EAF2" strokeWidth={1.2} />
                  })}
                  {visibleQuestions.map((q) => {
                    const d = layout.docPos.get(q.docId)!
                    const p = layout.qPos.get(q.id)!
                    return <line key={`e-${q.id}`} x1={d.x} y1={d.y} x2={p.x} y2={p.y} stroke="#E4EAF2" strokeWidth={1} strokeDasharray="3 3" />
                  })}
                  {/* 孤立文档虚线圆环 */}
                  {visibleOrphans.map((o) => {
                    const p = layout.orphanPos.get(o.id)!
                    return (
                      <motion.g key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
                        <circle cx={p.x} cy={p.y} r={13} fill="none" stroke="#98A2B3" strokeWidth={1.2} strokeDasharray="4 3" />
                        <circle cx={p.x} cy={p.y} r={5} fill="#CBD5E1" />
                        <text x={p.x} y={p.y + 28} textAnchor="middle" fontSize={10} fill="#98A2B3">
                          {o.name.length > 9 ? o.name.slice(0, 9) + '…' : o.name}
                        </text>
                      </motion.g>
                    )
                  })}
                  {/* 问题节点（■） */}
                  {visibleQuestions.map((q) => {
                    const p = layout.qPos.get(q.id)!
                    const s = questionNodeSize(q.asked)
                    const on = selection?.kind === 'question' && selection.q.id === q.id
                    return (
                      <motion.g
                        key={q.id}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.18 }}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelection({ kind: 'question', q })}
                        onMouseMove={(e) => showTooltip(e, q.text, [`被问 ${q.asked} 次 · 成功回答率 ${q.successRate}%`])}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <rect x={p.x - s / 2} y={p.y - s / 2} width={s} height={s} rx={3} fill={Q_COLOR} opacity={0.92} />
                        {on && <rect x={p.x - s / 2 - 4} y={p.y - s / 2 - 4} width={s + 8} height={s + 8} rx={5} fill="none" stroke="#2F74FF" strokeWidth={2} />}
                      </motion.g>
                    )
                  })}
                  {/* 文档节点（●） */}
                  {visibleDocs.map((d, i) => {
                    const p = layout.docPos.get(d.id)!
                    const r = docNodeSize(d.asked) / 2
                    const abnormal = d.validity === '存在冲突' || d.validity === '可能过期'
                    const on = selection?.kind === 'doc' && selection.doc.id === d.id
                    return (
                      <motion.g
                        key={d.id}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.18, delay: Math.min(i, 9) * 0.06 }}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelection({ kind: 'doc', doc: d })}
                        onMouseMove={(e) => showTooltip(e, docTooltip(d)[0], [...docTooltip(d)[1]])}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={r}
                          fill={abnormal ? '#FFF0F0' : '#EAF2FF'}
                          stroke={abnormal ? '#E5484D' : DOC_COLOR}
                          strokeWidth={abnormal ? 2 : 1.5}
                        />
                        <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={r > 18 ? 13 : 11} fontWeight={600} fill={abnormal ? '#E5484D' : '#174FCF'}>
                          {d.asked}
                        </text>
                        {d.hot && (
                          <g transform={`translate(${p.x + r * 0.6}, ${p.y - r - 8})`}>
                            <circle r={8} fill="#FFF7E7" stroke="#E99812" strokeWidth={1} />
                            <text y={4} textAnchor="middle" fontSize={9}>🔥</text>
                          </g>
                        )}
                        {on && (
                          <>
                            <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke="#2F74FF" strokeWidth={2} />
                            <g transform={`translate(${p.x + r}, ${p.y - r})`}>
                              <circle r={7} fill="#2F74FF" />
                              <path d="M -2.5 0 L -0.5 2 L 2.5 -2" stroke="#fff" strokeWidth={1.6} fill="none" strokeLinecap="round" />
                            </g>
                          </>
                        )}
                        <text x={p.x} y={p.y + r + 14} textAnchor="middle" fontSize={10.5} fill="#475569">
                          {d.name.length > 10 ? d.name.slice(0, 10) + '…' : d.name}
                        </text>
                      </motion.g>
                    )
                  })}
                  {/* 分类节点（◆） */}
                  {visibleCategories.map((c, i) => {
                    const p = layout.catPos.get(c.name)!
                    const on = selection?.kind === 'category' && selection.name === c.name
                    return (
                      <motion.g
                        key={c.id}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.18, delay: Math.min(i, 9) * 0.06 }}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelection({ kind: 'category', name: c.name })}
                        onMouseMove={(e) => showTooltip(e, c.name, [`${c.count} 份内容 · ${c.questions} 个问题 · 健康度 ${c.health} 分`])}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <rect x={p.x - 24} y={p.y - 24} width={48} height={48} rx={8} transform={`rotate(45 ${p.x} ${p.y})`} fill={CAT_COLOR} />
                        <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">
                          {c.count}
                        </text>
                        {on && <rect x={p.x - 29} y={p.y - 29} width={58} height={58} rx={10} transform={`rotate(45 ${p.x} ${p.y})`} fill="none" stroke="#2F74FF" strokeWidth={2} />}
                        <text x={p.x} y={p.y + 42} textAnchor="middle" fontSize={11} fontWeight={500} fill="#475569">
                          {c.name}
                        </text>
                      </motion.g>
                    )
                  })}
                  {/* 中心 Hub */}
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelection(null)}
                    onMouseMove={(e) => showTooltip(e, 'KnowledgeHub · 全部知识', ['128 份资料 · 156 个问题 · 12 名成员'])}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <circle cx={HUB.x} cy={HUB.y} r={48} fill="#1E63F4" />
                    <text x={HUB.x} y={HUB.y - 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">
                      KnowledgeHub
                    </text>
                    <text x={HUB.x} y={HUB.y + 14} textAnchor="middle" fontSize={11} fill="#EAF2FF">
                      全部知识
                    </text>
                  </g>
                </g>
              </svg>
            )}

            {/* Tooltip */}
            {tooltip && !isEmpty && (
              <div
                className="pointer-events-none absolute z-10 max-w-[280px] rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-float"
                style={{ left: tooltip.x, top: tooltip.y }}
              >
                <p className="text-body-sm font-medium text-neutral-950">{tooltip.title}</p>
                {tooltip.lines.map((l) => (
                  <p key={l} className="mt-0.5 text-caption text-neutral-500">{l}</p>
                ))}
              </div>
            )}

            {/* 缩放控件 + 统计字幕 */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <div className="flex overflow-hidden rounded-md border border-neutral-200 bg-white shadow-card">
                <button type="button" aria-label="放大" className="flex h-8 w-8 items-center justify-center text-neutral-600 hover:bg-neutral-100" onClick={() => setView((v) => ({ ...v, k: Math.min(2, Math.round((v.k + 0.1) * 10) / 10) }))}>
                  <Plus className="h-4 w-4" />
                </button>
                <button type="button" aria-label="缩小" className="flex h-8 w-8 items-center justify-center border-x border-neutral-200 text-neutral-600 hover:bg-neutral-100" onClick={() => setView((v) => ({ ...v, k: Math.max(0.5, Math.round((v.k - 0.1) * 10) / 10) }))}>
                  <Minus className="h-4 w-4" />
                </button>
                <button type="button" aria-label="复位" className="flex h-8 w-8 items-center justify-center text-neutral-600 hover:bg-neutral-100" onClick={() => setView({ x: 0, y: 0, k: 1 })}>
                  <Maximize className="h-4 w-4" />
                </button>
              </div>
              <span className="rounded-md bg-white/90 px-2.5 py-1.5 text-caption text-neutral-500 shadow-card">
                显示 {shownCount} 个节点 · {visibleOrphans.length} 个孤立 · 3 个热点
              </span>
            </div>
          </div>
        </div>

        {/* 详情面板 */}
        <div className="col-span-12 xl:col-span-3">
          <div className="xl:sticky xl:top-4">
            <AnimatePresence mode="wait">
              {!selection ? (
                <motion.section
                  key="hot"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card"
                >
                  <h3 className="flex items-center gap-1.5 text-h3 text-neutral-950">
                    <Flame className="h-5 w-5 text-warning" />
                    热点知识 Top 3
                  </h3>
                  <ul className="mt-3 space-y-3">
                    {hotDocs.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => setSelection({ kind: 'doc', doc: d })}
                        >
                          <p className="truncate text-body-sm font-medium text-neutral-800 hover:text-brand-600">{d.name}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-brand-100">
                              <div className="h-full rounded-pill bg-brand-500" style={{ width: `${(d.asked / 46) * 100}%` }} />
                            </div>
                            <span className="shrink-0 text-caption text-neutral-500">被问 {d.asked} 次</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 border-t border-neutral-100 pt-3 text-caption text-neutral-400">
                    点击画布中的节点查看详情；红色描边表示存在冲突或可能过期。
                  </p>
                </motion.section>
              ) : selection.kind === 'doc' ? (
                <DocPanel
                  key={selection.doc.id}
                  doc={selection.doc}
                  onOpenDoc={() => navigate('/workspace/knowledge-base')}
                  onGoProcess={() => navigate('/workspace/knowledge-base')}
                  onShowCitations={() => setCiteDrawerDoc(selection.doc)}
                  onShowQuestion={(q) => setQaRecord({ doc: selection.doc, question: q })}
                />
              ) : selection.kind === 'category' ? (
                <CategoryPanel key={selection.name} name={selection.name} onViewCategory={() => navigate('/workspace/knowledge-site')} />
              ) : (
                <QuestionPanel key={selection.q.id} q={selection.q} onToast={(kind, msg) => toast[kind](msg)} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 孤立文档 Drawer */}
      <SideDrawer
        open={orphanDrawerOpen}
        onClose={() => setOrphanDrawerOpen(false)}
        title={`孤立文档清单（${orphans.length}）`}
        width={560}
        footer={
          <div className="flex items-center justify-between">
            <span className="text-body-sm text-neutral-500">已选 {orphanChecked.size} 项</span>
            <button type="button" className={BTN_PRIMARY} disabled={orphanChecked.size === 0} onClick={() => setBatchConfirm(true)}>
              批量指派处理
            </button>
          </div>
        }
      >
        <p className="mb-3 rounded-lg bg-surface-soft px-3 py-2 text-caption text-neutral-500">
          孤立文档：近 90 天无检索命中、无引用、无问答。建议指派 Owner 复审或归档。
        </p>
        <ul className="space-y-2">
          {orphans.map((o) => {
            const checked = orphanChecked.has(o.id)
            return (
              <li key={o.id} className={cn('rounded-lg border p-3 transition-colors duration-micro ease-brand', checked ? 'border-brand-500 bg-surface-cardSel' : 'border-neutral-200')}>
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setOrphanChecked((prev) => {
                        const next = new Set(prev)
                        if (next.has(o.id)) next.delete(o.id)
                        else next.add(o.id)
                        return next
                      })
                    }
                    className="mt-1 h-4 w-4 accent-brand-600"
                    aria-label={`选择 ${o.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-medium text-neutral-950">{o.name}</p>
                    <p className="mt-0.5 text-caption text-neutral-500">
                      {o.category} · 上传于 {o.uploadedAt} · Owner {o.owner}
                    </p>
                    <p className="mt-0.5 text-caption text-warning">系统判断：{o.reason}</p>
                    <div className="mt-2 flex gap-1">
                      <button type="button" className={BTN_TERTIARY} onClick={() => setAssignTarget(o)}>
                        <UserPlus className="h-3.5 w-3.5" />
                        指派 Owner
                      </button>
                      <button type="button" className={BTN_TERTIARY + ' !text-danger hover:!bg-danger-bg'} onClick={() => setArchiveTarget(o)}>
                        <Archive className="h-3.5 w-3.5" />
                        归档
                      </button>
                      <button type="button" className={BTN_TERTIARY} onClick={() => setKeepTarget(o)}>
                        保留并设复审
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
          {orphans.length === 0 && (
            <li className="flex flex-col items-center py-10 text-center">
              <Check className="h-8 w-8 text-success" />
              <p className="mt-2 text-body-sm text-neutral-500">孤立文档已全部处理完毕</p>
            </li>
          )}
        </ul>
      </SideDrawer>

      {/* 归档 L2 确认 */}
      <Modal open={!!archiveTarget} onClose={() => setArchiveTarget(null)} width={520}>
        {archiveTarget && (
          <ConfirmationCard
            title="归档孤立文档"
            fields={[
              { label: '动作', value: `归档「${archiveTarget.name}」` },
              { label: '影响', value: '该文档不再参与检索与回答' },
              { label: '可撤销性', value: '30 天内可在知识库恢复' },
            ]}
            confirmText="确认归档"
            loading={confirmLoading}
            onConfirm={handleArchive}
            onCancel={() => setArchiveTarget(null)}
          />
        )}
      </Modal>

      {/* 单项指派 Owner L2 确认 */}
      <Modal open={!!assignTarget} onClose={() => setAssignTarget(null)} width={520}>
        {assignTarget && (
          <ConfirmationCard
            title="指派 Owner 复审"
            fields={[
              { label: '动作', value: `将「${assignTarget.name}」指派给 ${assignTarget.owner}` },
              { label: '影响范围', value: 'Owner 将收到复审待办，文档进入 90 天复审队列' },
              { label: '结果', value: '该文档移出孤立清单，画布节点同步移除' },
            ]}
            confirmText="确认指派"
            loading={confirmLoading}
            onConfirm={handleSingleAssign}
            onCancel={() => setAssignTarget(null)}
          />
        )}
      </Modal>

      {/* 单项保留并设复审 L2 确认 */}
      <Modal open={!!keepTarget} onClose={() => setKeepTarget(null)} width={520}>
        {keepTarget && (
          <ConfirmationCard
            title="保留并设复审"
            fields={[
              { label: '动作', value: `保留「${keepTarget.name}」并设置 90 天复审提醒` },
              { label: '影响范围', value: `到期前 7 天提醒 Owner ${keepTarget.owner} 复审` },
              { label: '结果', value: '该文档移出孤立清单，复审完成前不参与高风险回答' },
            ]}
            confirmText="确认保留"
            loading={confirmLoading}
            onConfirm={handleKeepReview}
            onCancel={() => setKeepTarget(null)}
          />
        )}
      </Modal>

      {/* 文档引用记录 Drawer */}
      <SideDrawer
        open={!!citeDrawerDoc}
        onClose={() => setCiteDrawerDoc(null)}
        title={citeDrawerDoc ? `引用记录 · ${citeDrawerDoc.name}` : ''}
        width={440}
      >
        {citeDrawerDoc && (
          <div>
            <p className="mb-3 rounded-lg bg-surface-soft px-3 py-2 text-caption text-neutral-500">
              近 30 天被引用 {citeDrawerDoc.cited} 次，以下为最近引用场景。
            </p>
            <ul className="flex flex-col divide-y divide-neutral-100">
              {citationRecordsFor(citeDrawerDoc).map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-sm bg-brand-50 px-1.5 py-0.5 text-caption font-medium text-brand-600">{r.scene}</span>
                    <span className="shrink-0 text-caption text-neutral-400">{r.time}</span>
                  </div>
                  <p className="mt-1.5 text-body-sm text-neutral-800">{r.question}</p>
                  <p className="mt-0.5 text-caption text-neutral-400">来源：{r.channel}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SideDrawer>

      {/* 关联问题问答记录 Drawer */}
      <SideDrawer
        open={!!qaRecord}
        onClose={() => setQaRecord(null)}
        title={qaRecord ? `问答记录 · ${qaRecord.question}` : ''}
        width={440}
      >
        {qaRecord && (
          <div>
            <p className="mb-3 rounded-lg bg-surface-soft px-3 py-2 text-caption text-neutral-500">
              关联文档：{qaRecord.doc.name} · 被问 {qaRecord.doc.asked} 次
            </p>
            <ul className="flex flex-col divide-y divide-neutral-100">
              {questionRecordsFor(qaRecord.doc, qaRecord.question).map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-sm font-medium text-neutral-800">{r.asker}</span>
                    <span className="shrink-0 text-caption text-neutral-400">{r.time}</span>
                  </div>
                  <p className="mt-1 text-body-sm text-neutral-700">问：{qaRecord.question}</p>
                  <p className="mt-0.5 text-caption text-success">{r.result}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SideDrawer>

      {/* 批量指派 L2 确认 */}
      <Modal open={batchConfirm} onClose={() => setBatchConfirm(false)} width={520}>
        <ConfirmationCard
          title="批量指派处理"
          fields={[
            { label: '动作', value: `将已选 ${orphanChecked.size} 份孤立文档指派给对应分类 Owner` },
            { label: '影响范围', value: 'Owner 将收到复审待办，文档进入 90 天复审队列' },
            { label: '可撤销性', value: '可在「每日待办」中随时转交或撤销' },
          ]}
          confirmText="确认指派"
          loading={confirmLoading}
          onConfirm={handleBatchAssign}
          onCancel={() => setBatchConfirm(false)}
        />
      </Modal>

    </div>
  )
}

/* ---------- 详情面板子组件 ---------- */

function DocPanel({
  doc,
  onOpenDoc,
  onGoProcess,
  onShowCitations,
  onShowQuestion,
}: {
  doc: DocNode
  onOpenDoc: () => void
  onGoProcess: () => void
  onShowCitations: () => void
  onShowQuestion: (q: string) => void
}) {
  const abnormal = doc.validity === '存在冲突' || doc.validity === '可能过期'
  return (
    <motion.section
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card"
    >
      {abnormal && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-danger-bg px-3 py-2">
          <p className="flex items-center gap-1.5 text-body-sm text-danger">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {doc.validity}
          </p>
          <button type="button" className="text-body-sm font-medium text-danger hover:underline" onClick={onGoProcess}>
            去处理 →
          </button>
        </div>
      )}
      <h3 className="text-h3 text-neutral-950">{doc.name}</h3>
      <dl className="mt-3 space-y-2 text-body-sm">
        <div className="flex gap-3"><dt className="w-16 shrink-0 text-neutral-500">分类</dt><dd className="text-neutral-800">{doc.category} · {doc.version}</dd></div>
        <div className="flex gap-3"><dt className="w-16 shrink-0 text-neutral-500">Owner</dt><dd className="text-neutral-800">{doc.owner}</dd></div>
        <div className="flex gap-3"><dt className="w-16 shrink-0 text-neutral-500">有效期</dt><dd className="text-neutral-800">{doc.validityNote}</dd></div>
        <div className="flex gap-3"><dt className="w-16 shrink-0 text-neutral-500">热度</dt><dd className="text-neutral-800">被问 {doc.asked} 次 · 被引用 {doc.cited} 次</dd></div>
      </dl>
      <p className="mt-4 text-body-sm font-medium text-neutral-800">关联问题 Top 3</p>
      <ul className="mt-1.5 space-y-1">
        {doc.topQuestions.map((q) => (
          <li key={q}>
            <button type="button" className="text-left text-body-sm text-brand-600 hover:underline" onClick={() => onShowQuestion(q)}>
              · {q}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
        <button type="button" className="inline-flex h-9 items-center rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 hover:border-brand-300" onClick={onOpenDoc}>
          打开文档
        </button>
        <button type="button" className="inline-flex h-9 items-center rounded-md px-2 text-body-sm text-brand-600 hover:bg-brand-50" onClick={onShowCitations}>
          查看引用记录
        </button>
      </div>
    </motion.section>
  )
}

function CategoryPanel({ name, onViewCategory }: { name: string; onViewCategory: () => void }) {
  const cat = MAP_CATEGORIES.find((c) => c.name === name)!
  return (
    <motion.section
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card"
    >
      <h3 className="text-h3 text-neutral-950">{cat.name}</h3>
      <div className="mt-4 flex items-center gap-4">
        <ProgressRing value={cat.health} size={84} strokeWidth={7} label="健康度" />
        <dl className="space-y-2 text-body-sm">
          <div className="flex gap-2"><dt className="text-neutral-500">文档数</dt><dd className="font-medium text-neutral-950">{cat.count} 份</dd></div>
          <div className="flex gap-2"><dt className="text-neutral-500">问题数</dt><dd className="font-medium text-neutral-950">{cat.questions} 个</dd></div>
        </dl>
      </div>
      <button type="button" className="mt-4 inline-flex h-9 items-center rounded-md px-2 text-body-sm text-brand-600 hover:bg-brand-50" onClick={onViewCategory}>
        查看该分类 ›
      </button>
    </motion.section>
  )
}

function QuestionPanel({ q, onToast }: { q: QuestionNode; onToast: (k: 'success' | 'info' | 'warning', m: string) => void }) {
  const doc = MAP_DOCS.find((d) => d.id === q.docId)
  const [done, setDone] = useState<QuestionAction[]>(() => readQuestionActions()[q.id] ?? [])

  const handleAction = (action: QuestionAction) => {
    if (recordQuestionAction(q.id, action)) {
      setDone((prev) => (prev.includes(action) ? prev : [...prev, action]))
      onToast('success', action === 'faq' ? '已创建 FAQ 草稿，待李娜审核' : '已加入助手测试集')
    } else {
      onToast('info', action === 'faq' ? '该问题已创建过 FAQ 草稿，请勿重复提交' : '该问题已在助手测试集中，请勿重复加入')
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card"
    >
      <p className="text-caption text-neutral-400">高频问题</p>
      <h3 className="mt-1 text-h3 text-neutral-950">{q.text}</h3>
      <dl className="mt-3 space-y-2 text-body-sm">
        <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">被问次数</dt><dd className="text-neutral-800">{q.asked} 次</dd></div>
        <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">成功回答率</dt><dd className="text-neutral-800">{q.successRate}%</dd></div>
        <div className="flex gap-3"><dt className="w-20 shrink-0 text-neutral-500">关联文档</dt><dd className="text-neutral-800">{doc?.name}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
        <button
          type="button"
          className={cn(
            'inline-flex h-9 items-center gap-1 rounded-md px-3 text-body-sm font-medium',
            done.includes('faq') ? 'border border-success bg-success-bg text-success' : 'bg-brand-600 text-white hover:bg-brand-500',
          )}
          onClick={() => handleAction('faq')}
        >
          {done.includes('faq') && <Check className="h-3.5 w-3.5" />}
          {done.includes('faq') ? '已创建 FAQ 草稿' : '创建 FAQ'}
        </button>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 items-center gap-1 rounded-md border px-3 text-body-sm',
            done.includes('testset')
              ? 'border-success bg-success-bg text-success'
              : 'border-neutral-200 bg-white text-neutral-800 hover:border-brand-300',
          )}
          onClick={() => handleAction('testset')}
        >
          {done.includes('testset') && <Check className="h-3.5 w-3.5" />}
          {done.includes('testset') ? '已加入测试集' : '加入测试集'}
        </button>
      </div>
    </motion.section>
  )
}
