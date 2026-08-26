/**
 * 知识地图 KnowledgeMap（/workspace/knowledge-map，knowledge-map.md）
 * 顶部筛选工具条（含视图模式切换：图谱/列表/分类树 + 动态图例）；
 * 左 9 列 SVG 图谱画布（中心 Hub + 5 分类放射 + 文档/问题节点 + 8 孤立文档，
 * 节点大小按被问次数，拖拽平移（带边界钳制）/ 滚轮与双击缩放（以光标为中心）/
 * 缩放工具栏（+ − 适配视口 重置 1:1 + 缩放百分比）/ 小地图 / Hover Tooltip /
 * 点击节点打开右侧详情抽屉（overlay 不挤占图谱，空白/Esc/遮罩关闭）；
 * 图谱内维度重组：分类/类型/状态/作者 切换节点着色与图例，异常红边保留）；
 * 列表视图（文档表格）/ 分类树视图（分类→文档层级缩进）共用同一份 filteredDocs，
 * 行点击同样打开详情抽屉；
 * 右 3 列「热点知识 Top 3」栏在详情抽屉打开时让位隐藏，图谱始终保持在 9 列主区；
 * 主 CTA「处理孤立文档（8）」560px Drawer + L2 批量确认。
 */
import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Archive,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  FileText,
  Flame,
  Layers,
  Maximize,
  Minus,
  Plus,
  RotateCcw,
  Search,
  UserPlus,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/mocks'
import { ConfirmationCard, DemoEmptyState } from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { Modal } from '@/pages/workspace/Modal'
import { useAppToast } from '@/lib/toast'
import { KnowledgeMapDetailDrawer } from '@/pages/workspace/KnowledgeMapDetailDrawer'
import type { Selection } from '@/pages/workspace/KnowledgeMapDetailDrawer'
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
import type { CategoryNode, DocNode, DocValidity, MapCategory, OrphanDoc } from '@/pages/workspace/mapData'

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

/* ---------- 缩放/平移参数 ---------- */
const MIN_K = 0.2
const MAX_K = 3
const WORLD_W = 1000
const WORLD_H = 640
/** 平移边界：保证世界坐标至少留出该宽度与视口相交，图不会完全丢失 */
const PAN_MARGIN = 40
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/* ---------- 多维度视图：视图模式 + 图谱维度重组 ---------- */

type ViewMode = 'graph' | 'list' | 'tree'
type Dim = 'category' | 'type' | 'validity' | 'owner'

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: 'graph', label: '图谱' },
  { value: 'list', label: '列表' },
  { value: 'tree', label: '分类树' },
]
const DIM_OPTIONS: { value: Dim; label: string }[] = [
  { value: 'category', label: '分类' },
  { value: 'type', label: '类型' },
  { value: 'validity', label: '状态' },
  { value: 'owner', label: '作者' },
]

/** 维度配色：分类（5 分类色）/ 作者（5 人）/ 状态（4 态，异常红沿用） */
const CATEGORY_COLORS: Record<MapCategory, string> = {
  产品介绍: '#2F74FF',
  使用指南: '#22B573',
  常见问题: '#7357E8',
  API文档: '#F3A53A',
  售后服务: '#26A9C4',
}
const CATEGORY_FILLS: Record<MapCategory, string> = {
  产品介绍: '#EAF2FF',
  使用指南: '#EAF9F1',
  常见问题: '#F1EEFF',
  API文档: '#FFF7E7',
  售后服务: '#E8FAFC',
}
const OWNER_COLORS: Record<string, string> = {
  张伟: '#2F74FF',
  李娜: '#22B573',
  王强: '#7357E8',
  赵敏: '#F3A53A',
  陈可: '#26A9C4',
}
const OWNER_FILLS: Record<string, string> = {
  张伟: '#EAF2FF',
  李娜: '#EAF9F1',
  王强: '#F1EEFF',
  赵敏: '#FFF7E7',
  陈可: '#E8FAFC',
}
const VALIDITY_COLORS: Record<DocValidity, string> = {
  正常: '#16A563',
  复审将到期: '#F3A53A',
  可能过期: '#E5484D',
  存在冲突: '#E5484D',
}
const VALIDITY_FILLS: Record<DocValidity, string> = {
  正常: '#EAF9F1',
  复审将到期: '#FFF7E7',
  可能过期: '#FFF0F0',
  存在冲突: '#FFF0F0',
}

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
  // 多维度视图：图谱 / 列表 / 分类树 切换 + 图谱内维度重组（默认「类型」保持原配色）
  const [viewMode, setViewMode] = useState<ViewMode>('graph')
  const [dim, setDim] = useState<Dim>('type')
  /** 当前选中节点（驱动图谱高亮 + 右侧详情抽屉）；点击空白/Esc/遮罩关闭 */
  const [selectedNode, setSelectedNode] = useState<Selection | null>(null)
  const openDetail = (node: Selection) => setSelectedNode(node)
  const closeDetail = () => setSelectedNode(null)
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
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean; scale: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  /** 三个视图（图谱/列表/分类树）共用同一份过滤后的文档（沿用类型/状态/搜索筛选） */
  const filteredDocs = useMemo(
    () =>
      MAP_DOCS.filter((d) => {
        if (typeFilter !== '全部' && d.category !== typeFilter) return false
        if (validityFilter !== '全部' && d.validity !== validityFilter) return false
        if (search.trim() && !d.name.includes(search.trim())) return false
        return true
      }),
    [typeFilter, validityFilter, search],
  )
  const visibleDocIds = useMemo(() => new Set(filteredDocs.map((d) => d.id)), [filteredDocs])
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

  const shownCount = 1 + visibleCategories.length + filteredDocs.length + visibleQuestions.length
  const isEmpty = filteredDocs.length === 0 && visibleQuestions.length === 0 && visibleOrphans.length === 0
  /** 列表/分类树视图的空态只看文档；图谱沿用 isEmpty（含问题/孤立） */
  const viewEmpty = viewMode === 'graph' ? isEmpty : filteredDocs.length === 0

  /** 当前维度下对文档分组（dimGroups 供图例计数 / 维度重组复用） */
  const dimGroups = useMemo(() => {
    const groups = new Map<string, DocNode[]>()
    for (const d of filteredDocs) {
      const key = dim === 'category' ? d.category : dim === 'validity' ? d.validity : dim === 'owner' ? d.owner : '文档'
      const list = groups.get(key) ?? []
      list.push(d)
      groups.set(key, list)
    }
    return groups
  }, [dim, filteredDocs])

  /** 图例按当前维度动态展示（含分组计数） */
  const dimLegend = useMemo(() => {
    const countFor = (k: string) => dimGroups.get(k)?.length ?? 0
    if (dim === 'type') {
      return [
        { label: '文档', color: DOC_COLOR, shape: 'dot' as const, count: filteredDocs.length },
        { label: '问题', color: Q_COLOR, shape: 'dot' as const, count: visibleQuestions.length },
        { label: '分类', color: CAT_COLOR, shape: 'diamond' as const, count: visibleCategories.length },
      ]
    }
    if (dim === 'category') {
      return MAP_CATEGORIES.map((c) => ({ label: c.name, color: CATEGORY_COLORS[c.name], shape: 'dot' as const, count: countFor(c.name) }))
    }
    if (dim === 'validity') {
      return (['正常', '复审将到期', '可能过期', '存在冲突'] as const).map((v) => ({ label: v, color: VALIDITY_COLORS[v], shape: 'dot' as const, count: countFor(v) }))
    }
    return (['张伟', '李娜', '王强', '赵敏', '陈可'] as const).map((o) => ({ label: o, color: OWNER_COLORS[o], shape: 'dot' as const, count: countFor(o) }))
  }, [dim, dimGroups, filteredDocs.length, visibleQuestions.length, visibleCategories.length])

  /** 按当前维度返回文档节点配色（fill 浅底 + stroke 主色；异常红边在渲染处覆盖） */
  const docDimColors = (d: DocNode): { fill: string; stroke: string } => {
    switch (dim) {
      case 'category':
        return { fill: CATEGORY_FILLS[d.category], stroke: CATEGORY_COLORS[d.category] }
      case 'type':
        return { fill: '#EAF2FF', stroke: DOC_COLOR }
      case 'validity':
        return { fill: VALIDITY_FILLS[d.validity], stroke: VALIDITY_COLORS[d.validity] }
      case 'owner':
        return { fill: OWNER_FILLS[d.owner] ?? '#EEF2F7', stroke: OWNER_COLORS[d.owner] ?? '#64748B' }
      default:
        return { fill: '#EAF2FF', stroke: DOC_COLOR }
    }
  }

  /** 屏幕坐标 → viewBox 坐标（用 getScreenCTM 精确换算，含 letterbox）；失败时退回矩形近似 */
  const clientToViewBox = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (svg && ctm) {
      const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
      return { x: pt.x, y: pt.y }
    }
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: ((clientX - rect.left) * WORLD_W) / rect.width,
      y: ((clientY - rect.top) * WORLD_H) / rect.height,
    }
  }

  /** 平移/缩放边界钳制：视口（viewBox 单位）与世界坐标保持至少 PAN_MARGIN 相交 */
  const clampPan = (v: { x: number; y: number; k: number }) => {
    const wv = WORLD_W / v.k
    const hv = WORLD_H / v.k
    let left = -v.x / v.k
    let top = -v.y / v.k
    left = wv >= WORLD_W ? (WORLD_W - wv) / 2 : clamp(left, PAN_MARGIN - wv, WORLD_W - PAN_MARGIN)
    top = hv >= WORLD_H ? (WORLD_H - hv) / 2 : clamp(top, PAN_MARGIN - hv, WORLD_H - PAN_MARGIN)
    return { x: -left * v.k, y: -top * v.k, k: v.k }
  }

  /** 以锚点（viewBox 坐标）为中心缩放，锚点下内容保持不动；无锚点默认画布中心 */
  const zoomTo = (nextK: number, anchor?: { x: number; y: number }) => {
    const k = clamp(nextK, MIN_K, MAX_K)
    setView((v) => {
      const ax = anchor?.x ?? WORLD_W / 2
      const ay = anchor?.y ?? WORLD_H / 2
      const wx = (ax - v.x) / v.k
      const wy = (ay - v.y) / v.k
      return clampPan({ x: ax - wx * k, y: ay - wy * k, k })
    })
  }

  /** 重置 1:1：回 {x:0, y:0, k:1} */
  const resetView = () => setView({ x: 0, y: 0, k: 1 })

  /** 适配视口：按当前可见节点包围盒缩放并居中到画布 */
  const fitView = () => {
    const pts: { x: number; y: number }[] = [{ x: HUB.x, y: HUB.y }]
    visibleCategories.forEach((c) => {
      const p = layout.catPos.get(c.name)
      if (p) pts.push(p)
    })
    filteredDocs.forEach((d) => {
      const p = layout.docPos.get(d.id)
      if (p) pts.push(p)
    })
    visibleQuestions.forEach((q) => {
      const p = layout.qPos.get(q.id)
      if (p) pts.push(p)
    })
    visibleOrphans.forEach((o) => {
      const p = layout.orphanPos.get(o.id)
      if (p) pts.push(p)
    })
    if (pts.length === 0) return
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const pad = 70
    const bw = Math.max(maxX - minX, 1)
    const bh = Math.max(maxY - minY, 1)
    const k = clamp(Math.min((WORLD_W - pad * 2) / bw, (WORLD_H - pad * 2) / bh), MIN_K, MAX_K)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    setView(clampPan({ x: WORLD_W / 2 - cx * k, y: WORLD_H / 2 - cy * k, k }))
  }

  /** 滚轮缩放（以光标为中心，仅图谱视图）：k' = clamp(k * (deltaY<0 ? 1.1 : 0.9), 0.2, 3) */
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    zoomTo(view.k * (e.deltaY < 0 ? 1.1 : 0.9), clientToViewBox(e.clientX, e.clientY) ?? undefined)
  }

  /** 双击缩放：k*1.6（clamp 到 [0.2, 3]） */
  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    zoomTo(view.k * 1.6, clientToViewBox(e.clientX, e.clientY) ?? undefined)
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // 仅在位移超过阈值后才 setPointerCapture，否则 click 会被 retarget 到 svg，节点 onClick 失效
    const scale = svgRef.current?.getScreenCTM()?.a ?? 1
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: view.x, baseY: view.y, moved: false, scale }
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
    if (d.moved) setView((v) => clampPan({ x: d.baseX + dx / d.scale, y: d.baseY + dy / d.scale, k: v.k }))
  }
  /** 拖拽结束后紧跟的 click 会被 pointer capture retarget 到 svg，用它吞掉一次，避免误关抽屉 */
  const dragEndedRef = useRef(false)
  const onPointerUp = () => {
    if (dragRef.current?.moved) dragEndedRef.current = true
    dragRef.current = null
  }
  /** 点击画布空白关闭详情抽屉（节点 onClick 已自行 stopPropagation 语义：target 不等于 svg） */
  const onCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragEndedRef.current) {
      dragEndedRef.current = false
      return
    }
    if (e.target === e.currentTarget) closeDetail()
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
      {/* 顶部单行横幅：标题(左) + 紧凑统计 & 操作(右) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <nav className="mb-1 flex h-8 items-center gap-1 text-body-sm text-neutral-500">
            知识
            <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
            <span className="font-medium text-neutral-950">知识地图</span>
          </nav>
          <h1 className="text-h1 text-neutral-950">知识地图</h1>
          <p className="mt-1 text-body-sm text-neutral-500">以「{space.replace('（默认）', '')}」空间为视角</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {[
            { icon: <FileText className="h-4 w-4" />, name: '资料', value: 128, suffix: '份' },
            { icon: <Layers className="h-4 w-4" />, name: '分类', value: 5, suffix: '个' },
            { icon: <CircleHelp className="h-4 w-4" />, name: '问题', value: 156, suffix: '个' },
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
            <button type="button" className={BTN_SECONDARY} onClick={() => void exportPng()}>
              <Download className="h-4 w-4" />
              导出图谱 PNG
            </button>
            <button type="button" className={BTN_PRIMARY} onClick={() => setOrphanDrawerOpen(true)}>
              处理孤立文档（{orphans.length}）
            </button>
          </div>
        </div>
      </div>

      {/* 筛选工具条 */}
      <div className="mb-4 flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
        {/* 视图模式切换：图谱 / 列表 / 分类树 */}
        <div role="tablist" aria-label="视图模式" className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          {VIEW_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={viewMode === m.value}
              className={cn(
                'h-8 rounded-md px-3 text-body-sm font-medium transition-colors duration-micro ease-brand',
                viewMode === m.value ? 'bg-brand-600 text-white shadow-card' : 'text-neutral-600 hover:bg-white/70 hover:text-neutral-800',
              )}
              onClick={() => setViewMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="mx-1 h-5 w-px bg-neutral-200" />
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
          <div className="flex max-w-full flex-wrap items-center justify-end gap-x-3 gap-y-1 text-caption text-neutral-400">
            {dimLegend.map((item) => (
              <span key={item.label} className="flex items-center gap-1 whitespace-nowrap">
                <span className={cn('h-2.5 w-2.5', item.shape === 'diamond' ? 'rotate-45 rounded-[2px]' : 'rounded-full')} style={{ backgroundColor: item.color }} />
                {item.label}
                <span className="text-neutral-300">{item.count}</span>
              </span>
            ))}
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="h-2.5 w-2.5 rounded-full bg-danger" />
              红边=异常 · 节点越大被问越多
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* 图谱画布 / 文档列表 / 分类树 */}
        <div className="col-span-12 xl:col-span-9">
          {viewEmpty ? (
            <div className="flex h-[560px] flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white text-center shadow-card">
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
          ) : viewMode === 'graph' ? (
            <div ref={canvasRef} className="relative min-h-[560px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-card">
              {/* 图谱内维度选择器：分类 / 类型 / 状态 / 作者 */}
              <div className="absolute left-4 top-4 z-10 flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 shadow-card">
                {DIM_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={dim === o.value}
                    className={cn(
                      'h-7 rounded-md px-2.5 text-body-sm font-medium transition-colors duration-micro ease-brand',
                      dim === o.value ? 'bg-brand-600 text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800',
                    )}
                    onClick={() => setDim(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {/* 缩放工具栏：+ / − / 适配视口 / 重置 1:1 + 当前缩放百分比（浮动右上角，仅图谱视图） */}
              <div
                role="group"
                aria-label="缩放控制"
                className="absolute right-4 top-4 z-20 flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-card"
              >
                <button
                  type="button"
                  aria-label="放大"
                  title="放大"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-800"
                  onClick={() => zoomTo(view.k * 1.1)}
                >
                  <Plus className="h-4 w-4" />
                </button>
                <span className="w-11 text-center text-caption tabular-nums text-neutral-600" aria-live="polite">
                  {Math.round(view.k * 100)}%
                </span>
                <button
                  type="button"
                  aria-label="缩小"
                  title="缩小"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-800"
                  onClick={() => zoomTo(view.k * 0.9)}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="mx-1 h-4 w-px bg-neutral-200" />
                <button
                  type="button"
                  className="flex h-7 items-center gap-1 rounded-md px-2 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-800"
                  onClick={fitView}
                >
                  <Maximize className="h-3.5 w-3.5" />
                  适配视口
                </button>
                <button
                  type="button"
                  className="flex h-7 items-center gap-1 rounded-md px-2 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-800"
                  onClick={resetView}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  重置 1:1
                </button>
              </div>
              <svg
                ref={svgRef}
                viewBox="0 0 1000 640"
                className="h-[560px] w-full cursor-grab touch-none select-none active:cursor-grabbing"
                onWheel={onWheel}
                onDoubleClick={onDoubleClick}
                onClick={onCanvasClick}
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
                  {filteredDocs.map((d) => {
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
                  {/* 问题节点（■，非「类型」维度时跟随关联文档的维度色） */}
                  {visibleQuestions.map((q) => {
                    const p = layout.qPos.get(q.id)!
                    const s = questionNodeSize(q.asked)
                    const on = selectedNode?.kind === 'question' && selectedNode.q.id === q.id
                    const qDoc = MAP_DOCS.find((dd) => dd.id === q.docId)
                    const typeDim = dim === 'type'
                    const qFill = typeDim ? Q_COLOR : qDoc ? docDimColors(qDoc).fill : Q_COLOR
                    const qStroke = typeDim ? 'none' : qDoc ? docDimColors(qDoc).stroke : 'none'
                    return (
                      <motion.g
                        key={q.id}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.18 }}
                        style={{ cursor: 'pointer' }}
                        onClick={() => openDetail({ kind: 'question', q })}
                        onMouseMove={(e) => showTooltip(e, q.text, [`被问 ${q.asked} 次 · 成功回答率 ${q.successRate}%`])}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <rect x={p.x - s / 2} y={p.y - s / 2} width={s} height={s} rx={3} fill={qFill} opacity={typeDim ? 0.92 : 1} stroke={qStroke} strokeWidth={typeDim ? 0 : 1.5} />
                        {on && <rect x={p.x - s / 2 - 4} y={p.y - s / 2 - 4} width={s + 8} height={s + 8} rx={5} fill="none" stroke="#2F74FF" strokeWidth={2} />}
                      </motion.g>
                    )
                  })}
                  {/* 文档节点（●，按维度着色；异常红边保留） */}
                  {filteredDocs.map((d, i) => {
                    const p = layout.docPos.get(d.id)!
                    const r = docNodeSize(d.asked) / 2
                    const abnormal = d.validity === '存在冲突' || d.validity === '可能过期'
                    const { fill: dimFill, stroke: dimStroke } = docDimColors(d)
                    const fill = abnormal ? '#FFF0F0' : dimFill
                    const stroke = abnormal ? '#E5484D' : dimStroke
                    const on = selectedNode?.kind === 'doc' && selectedNode.doc.id === d.id
                    return (
                      <motion.g
                        key={d.id}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.18, delay: Math.min(i, 9) * 0.06 }}
                        style={{ cursor: 'pointer' }}
                        onClick={() => openDetail({ kind: 'doc', doc: d })}
                        onMouseMove={(e) => showTooltip(e, docTooltip(d)[0], [...docTooltip(d)[1]])}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={r}
                          fill={fill}
                          stroke={stroke}
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
                    const on = selectedNode?.kind === 'category' && selectedNode.name === c.name
                    return (
                      <motion.g
                        key={c.id}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.18, delay: Math.min(i, 9) * 0.06 }}
                        style={{ cursor: 'pointer' }}
                        onClick={() => openDetail({ kind: 'category', name: c.name })}
                        onMouseMove={(e) => showTooltip(e, c.name, [`${c.count} 份内容 · ${c.questions} 个问题 · 健康度 ${c.health} 分`])}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <rect x={p.x - 24} y={p.y - 24} width={48} height={48} rx={8} transform={`rotate(45 ${p.x} ${p.y})`} fill={dim === 'category' ? CATEGORY_COLORS[c.name] : CAT_COLOR} />
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
                    onClick={closeDetail}
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

              {/* Tooltip */}
              {tooltip && (
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

              {/* 统计字幕（左下角） */}
              <div className="absolute bottom-4 left-4">
                <span className="rounded-md bg-white/90 px-2.5 py-1.5 text-caption text-neutral-500 shadow-card">
                  显示 {shownCount} 个节点 · {visibleOrphans.length} 个孤立 · 3 个热点
                </span>
              </div>

              {/* 小地图（右下角）：节点分布 + 视口矩形，随平移/缩放实时更新；pointer-events-none 避免抢交互 */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-4 right-4 z-10 hidden w-[176px] overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-card lg:block"
              >
                <svg viewBox="0 0 1000 640" className="block h-auto w-full">
                  <rect width={WORLD_W} height={WORLD_H} fill="#F8FAFC" />
                  <circle cx={HUB.x} cy={HUB.y} r={22} fill="#1E63F4" />
                  {visibleCategories.map((c) => {
                    const p = layout.catPos.get(c.name)!
                    return (
                      <rect
                        key={`mm-c-${c.id}`}
                        x={p.x - 10}
                        y={p.y - 10}
                        width={20}
                        height={20}
                        rx={3}
                        transform={`rotate(45 ${p.x} ${p.y})`}
                        fill={CATEGORY_COLORS[c.name]}
                      />
                    )
                  })}
                  {filteredDocs.map((d) => {
                    const p = layout.docPos.get(d.id)!
                    const abnormal = d.validity === '存在冲突' || d.validity === '可能过期'
                    return <circle key={`mm-d-${d.id}`} cx={p.x} cy={p.y} r={11} fill={abnormal ? '#E5484D' : docDimColors(d).stroke} />
                  })}
                  {visibleQuestions.map((q) => {
                    const p = layout.qPos.get(q.id)!
                    return <rect key={`mm-q-${q.id}`} x={p.x - 7} y={p.y - 7} width={14} height={14} rx={2} fill={Q_COLOR} />
                  })}
                  {visibleOrphans.map((o) => {
                    const p = layout.orphanPos.get(o.id)!
                    return <circle key={`mm-o-${o.id}`} cx={p.x} cy={p.y} r={9} fill="none" stroke="#94A3B8" strokeWidth={3} />
                  })}
                  <rect
                    x={-view.x / view.k}
                    y={-view.y / view.k}
                    width={WORLD_W / view.k}
                    height={WORLD_H / view.k}
                    fill="rgba(47,116,255,0.07)"
                    stroke="#2F74FF"
                    strokeWidth={3}
                  />
                </svg>
              </div>
            </div>
          ) : viewMode === 'list' ? (
            <DocListView
              docs={filteredDocs}
              selectedId={selectedNode?.kind === 'doc' ? selectedNode.doc.id : undefined}
              onSelect={(d) => openDetail({ kind: 'doc', doc: d })}
            />
          ) : (
            <CategoryTreeView
              categories={visibleCategories}
              docs={filteredDocs}
              selectedId={selectedNode?.kind === 'doc' ? selectedNode.doc.id : undefined}
              onSelect={(d) => openDetail({ kind: 'doc', doc: d })}
            />
          )}
        </div>

        {/* 右侧栏：详情抽屉打开时让位隐藏，保证图谱在 9 列主区不被动 */}
        <AnimatePresence>
          {!selectedNode && (
            <motion.div
              key="hot-sidebar"
              className="col-span-12 xl:col-span-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="xl:sticky xl:top-4">
                <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card">
                  <h3 className="flex items-center gap-1.5 text-h3 text-neutral-950">
                    <Flame className="h-5 w-5 text-warning" />
                    热点知识 Top 3
                  </h3>
                  <ul className="mt-3 space-y-3">
                    {hotDocs.map((d) => (
                      <li key={d.id}>
                        <button type="button" className="w-full text-left" onClick={() => openDetail({ kind: 'doc', doc: d })}>
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
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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

      {/* 节点详情抽屉（右侧 overlay，打开时热点 Top3 栏让位） */}
      <KnowledgeMapDetailDrawer
        selectedNode={selectedNode}
        space={space}
        onClose={closeDetail}
        onOpenDoc={() => navigate('/workspace/knowledge-base')}
        onShowCitations={(doc) => setCiteDrawerDoc(doc)}
        onShowQuestion={(doc, question) => setQaRecord({ doc, question })}
        onViewCategory={() => navigate('/workspace/knowledge-site')}
        onToast={(kind, msg) => toast[kind](msg)}
      />

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

/* ---------- 多维度视图子组件（列表 / 分类树） ---------- */

/** 状态徽标（浅底深字，颜色 + 文字双编码） */
function ValidityBadge({ validity }: { validity: DocValidity }) {
  const styles: Record<DocValidity, string> = {
    正常: 'bg-success-bg text-success',
    复审将到期: 'bg-warning-bg text-warning',
    可能过期: 'bg-warning-bg text-warning',
    存在冲突: 'bg-danger-bg text-danger',
  }
  return <span className={cn('inline-flex items-center rounded-pill px-2 py-0.5 text-caption font-medium', styles[validity])}>{validity}</span>
}

/** 文档列表视图：名称/分类/状态/作者/被问/被引/版本（复用维度色与状态色） */
function DocListView({
  docs,
  selectedId,
  onSelect,
}: {
  docs: DocNode[]
  selectedId?: string
  onSelect: (d: DocNode) => void
}) {
  if (docs.length === 0) return null
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-body-sm">
          <thead>
            <tr className="h-10 bg-surface-soft text-caption text-neutral-500">
              <th className="w-auto px-4 font-medium">名称</th>
              <th className="w-32 px-3 font-medium">分类</th>
              <th className="w-28 px-3 font-medium">状态</th>
              <th className="w-20 px-3 font-medium">作者</th>
              <th className="w-16 px-3 text-right font-medium">被问</th>
              <th className="w-16 px-3 text-right font-medium">被引</th>
              <th className="w-20 px-4 text-right font-medium">版本</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {docs.map((d) => {
              const selected = selectedId === d.id
              return (
                <tr
                  key={d.id}
                  onClick={() => onSelect(d)}
                  className={cn(
                    'h-12 cursor-pointer transition-colors duration-micro ease-brand hover:bg-brand-50',
                    selected && 'bg-surface-cardSel',
                  )}
                >
                  <td className="px-4">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-neutral-950">{d.name}</span>
                      {d.hot && <span className="shrink-0 text-caption" title="热点文档">🔥</span>}
                    </span>
                  </td>
                  <td className="px-3">
                    <span className="flex items-center gap-1.5 whitespace-nowrap text-neutral-700">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[d.category] }} />
                      {d.category}
                    </span>
                  </td>
                  <td className="px-3"><ValidityBadge validity={d.validity} /></td>
                  <td className="px-3 whitespace-nowrap text-neutral-700">{d.owner}</td>
                  <td className="px-3 text-right tabular-nums text-neutral-800">{d.asked}</td>
                  <td className="px-3 text-right tabular-nums text-neutral-800">{d.cited}</td>
                  <td className="px-4 text-right whitespace-nowrap text-neutral-500">{d.version}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 分类树视图：分类（一级）→ 其文档（二级，层级缩进），点击文档联动右侧详情 */
function CategoryTreeView({
  categories,
  docs,
  selectedId,
  onSelect,
}: {
  categories: CategoryNode[]
  docs: DocNode[]
  selectedId?: string
  onSelect: (d: DocNode) => void
}) {
  const groups = categories
    .map((c) => ({ cat: c, catDocs: docs.filter((d) => d.category === c.name) }))
    .filter((g) => g.catDocs.length > 0)
  if (groups.length === 0) return null
  return (
    <div className="max-h-[560px] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-card">
      {groups.map((g) => (
        <div key={g.cat.id} className="mb-4 last:mb-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rotate-45 rounded-[2px]" style={{ backgroundColor: CATEGORY_COLORS[g.cat.name] }} />
            <h4 className="text-body-sm font-semibold text-neutral-950">{g.cat.name}</h4>
            <span className="rounded-pill bg-neutral-100 px-2 py-0.5 text-caption text-neutral-500">{g.catDocs.length} 份</span>
          </div>
          <ul className="mt-2 ml-1.5 space-y-1 border-l border-neutral-200 pl-4">
            {g.catDocs.map((d) => {
              const abnormal = d.validity === '存在冲突' || d.validity === '可能过期'
              const selected = selectedId === d.id
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(d)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-micro ease-brand hover:bg-brand-50',
                      selected && 'bg-surface-cardSel',
                    )}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: abnormal ? '#E5484D' : CATEGORY_COLORS[d.category] }}
                      title={abnormal ? d.validity : d.category}
                    />
                    <span className="truncate text-body-sm text-neutral-800">{d.name}</span>
                    {d.hot && <span className="shrink-0 text-caption" title="热点文档">🔥</span>}
                    <span className="ml-auto shrink-0 text-caption text-neutral-400">被问 {d.asked} · {d.validity}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
