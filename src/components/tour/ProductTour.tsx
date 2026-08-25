/**
 * ProductTour — V1.3 新手引导导览（design/onboarding-tour.md，替换原 DashboardTour 4 点引导）
 *
 * - 8 步全局浮层：SVG-mask 挖空遮罩 + 聚光环（目标外扩 8px / 1.5px #2F74FF / shadow-focus）+ 380px 提示卡。
 * - 目标通过 data-tour 属性定位（sidebar / global-search / copilot / notifications / user-menu 由壳层挂载）；
 *   目标缺失时 console.warn 并跳过该步，连续 2 步缺失直达完成页（§7 防御）。
 * - 四向自动翻转 + 16px 视口钳制 + 目标自动滚动到位；Framer Motion 240ms 动效，reduced-motion 降级为纯淡入淡出。
 * - 键盘：Esc 跳过 / →·Enter 下一步 / ← 上一步 / Tab 焦点锁在卡内；焦点在开关时保存与归还。
 * - 状态：localStorage kb.tour.done=1 / kb.tour.version=v1.3 / kb.tour.exit（completed|skipped|step-n）。
 * - 全局重开：window 事件 `ekb:start-tour`（或调用 startProductTour()）；状态变化广播 `ekb:tour-state`。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Bell, FolderOpen, Search, Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_FULL } from '@/components/layout/WorkspaceShell'
import {
  TOUR_DONE_KEY,
  TOUR_EXIT_KEY,
  TOUR_START_EVENT,
  TOUR_STATE_EVENT,
  TOUR_VERSION,
  TOUR_VERSION_KEY,
} from './tour'

/** 导航真实功能入口数（从 NAV_FULL 派生，避免文案与实际导航不一致） */
const NAV_ENTRY_COUNT = NAV_FULL.reduce((n, g) => n + g.items.length, 0)

/** 完成与跳过均写 done=1（§2.3） */
function writeTourState(exit: string) {
  try {
    localStorage.setItem(TOUR_DONE_KEY, '1')
    localStorage.setItem(TOUR_VERSION_KEY, TOUR_VERSION)
    localStorage.setItem(TOUR_EXIT_KEY, exit)
  } catch {
    // 存储不可用时仅本次生效
  }
  window.dispatchEvent(new Event(TOUR_STATE_EVENT))
}

// ---------- 配图（§5：360×120 viewBox，白/浅蓝主调 + 紫橙点缀，无文字，透明底） ----------

const svgProps = {
  viewBox: '0 0 360 120',
  className: 'h-full w-full',
  role: 'img',
} as const

/** Step 1：品牌蓝圆角方块（白色立方体线框）+ 漂浮文档/气泡/齿轮/四角星 */
function TourWelcomeArt() {
  return (
    <svg {...svgProps} aria-label="品牌标识与漂浮元素插画">
      <ellipse cx="105" cy="62" rx="11" ry="3" fill="#EAF2FF" />
      <ellipse cx="255" cy="58" rx="11" ry="3" fill="#EAF2FF" />
      <ellipse cx="108" cy="102" rx="11" ry="3" fill="#EAF2FF" />
      <ellipse cx="252" cy="102" rx="11" ry="3" fill="#EAF2FF" />
      {/* 左上浅蓝文档 */}
      <rect x="92" y="24" width="26" height="32" rx="4" fill="#EAF2FF" />
      <rect x="98" y="34" width="14" height="3" rx="1.5" fill="#FFFFFF" />
      <rect x="98" y="41" width="10" height="3" rx="1.5" fill="#FFFFFF" />
      {/* 右上白色对话气泡（蓝描边） */}
      <path d="M240 46 L248 54 L252 46 Z" fill="#FFFFFF" stroke="#2F74FF" strokeWidth="2" strokeLinejoin="round" />
      <rect x="238" y="24" width="32" height="22" rx="8" fill="#FFFFFF" stroke="#2F74FF" strokeWidth="2" />
      {/* 左下橙色小齿轮 */}
      <circle cx="108" cy="84" r="11" fill="none" stroke="#F3A53A" strokeWidth="4" strokeDasharray="4 5.6" />
      <circle cx="108" cy="84" r="4.5" fill="#F3A53A" />
      {/* 右下紫色四角星 */}
      <path d="M0 -11 L2.6 -2.6 L11 0 L2.6 2.6 L0 11 L-2.6 2.6 L-11 0 L-2.6 -2.6 Z" transform="translate(252 84)" fill="#7357E8" />
      {/* 居中品牌蓝方块 + 白色立方体线框 */}
      <rect x="156" y="36" width="48" height="48" rx="12" fill="#2F74FF" />
      <polygon points="180,47 191,53 191,65 180,71 169,65 169,53" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
      <path d="M169 53 L180 59 L191 53 M180 59 L180 71" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

/** Step 2：橙色闪电 + 4 个进度格（前 3 蓝实心、第 4 半填充）+ 浅蓝虚线 */
function TourQuickConfigArt() {
  return (
    <svg {...svgProps} aria-label="闪电与进度格插画">
      <line x1="100" y1="36" x2="300" y2="36" stroke="#8DB2FF" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" />
      <rect x="96" y="51" width="34" height="18" rx="6" fill="#2F74FF" />
      <rect x="136" y="51" width="34" height="18" rx="6" fill="#2F74FF" />
      <rect x="220" y="51" width="34" height="18" rx="6" fill="#2F74FF" />
      <rect x="262" y="53" width="15" height="14" rx="5" fill="#8DB2FF" />
      <rect x="260" y="51" width="34" height="18" rx="6" fill="none" stroke="#2F74FF" strokeWidth="2" />
      <polygon
        points="184,26 162,62 176,62 169,94 197,54 182,54 198,26"
        fill="#F3A53A"
        stroke="#F3A53A"
        strokeWidth="5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Step 3：白色竖向导航条（选中态）+ 浮出小卡片（橙色待办点） */
function TourSidebarArt() {
  return (
    <svg {...svgProps} aria-label="侧边导航与小卡片插画">
      <rect x="118" y="14" width="56" height="92" rx="12" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
      <rect x="126" y="24" width="40" height="10" rx="5" fill="#EAF2FF" />
      <rect x="126" y="40" width="40" height="10" rx="5" fill="#2F74FF" />
      <rect x="126" y="56" width="40" height="10" rx="5" fill="#EAF2FF" />
      <rect x="126" y="72" width="40" height="10" rx="5" fill="#EAF2FF" />
      <rect x="126" y="88" width="40" height="10" rx="5" fill="#EAF2FF" />
      <rect x="184" y="58" width="64" height="44" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
      <rect x="194" y="70" width="36" height="6" rx="3" fill="#EAF2FF" />
      <rect x="194" y="84" width="26" height="6" rx="3" fill="#EAF2FF" />
      <circle cx="248" cy="58" r="3" fill="#F3A53A" />
    </svg>
  )
}

/** Step 4：放大镜 + 三条分组搜索结果条（蓝/紫/橙小圆点） */
function TourSearchArt() {
  return (
    <svg {...svgProps} aria-label="放大镜与搜索结果插画">
      <circle cx="180" cy="38" r="18" fill="#FFFFFF" />
      <circle cx="180" cy="38" r="18" fill="#EAF2FF" fillOpacity="0.35" />
      <circle cx="180" cy="38" r="18" fill="none" stroke="#2F74FF" strokeWidth="2.5" />
      <line x1="193" y1="51" x2="204" y2="62" stroke="#2F74FF" strokeWidth="5" strokeLinecap="round" />
      <g stroke="#CBD5E1" strokeWidth="1.5" fill="#FFFFFF">
        <rect x="120" y="74" width="120" height="9" rx="4.5" />
        <rect x="132" y="89" width="96" height="9" rx="4.5" />
        <rect x="144" y="104" width="72" height="9" rx="4.5" />
      </g>
      <circle cx="132" cy="78.5" r="3" fill="#2F74FF" />
      <circle cx="144" cy="93.5" r="3" fill="#7357E8" />
      <circle cx="156" cy="108.5" r="3" fill="#F3A53A" />
    </svg>
  )
}

/** Step 5：紫色大 sparkle + 白色对话气泡 + 小蓝星呼应 */
function TourCopilotArt() {
  return (
    <svg {...svgProps} aria-label="紫色星形与对话气泡插画">
      <path d="M208 60 L194 44 L222 54 Z" fill="#FFFFFF" stroke="#2F74FF" strokeWidth="2" strokeLinejoin="round" />
      <path d="M0 -22 L5 -5 L22 0 L5 5 L0 22 L-5 5 L-22 0 L-5 -5 Z" transform="translate(168 50)" fill="#7357E8" />
      <path d="M0 -10 L2.3 -2.3 L10 0 L2.3 2.3 L0 10 L-2.3 2.3 L-10 0 L-2.3 -2.3 Z" transform="translate(118 32)" fill="#2F74FF" />
      <path d="M0 -7 L1.6 -1.6 L7 0 L1.6 1.6 L0 7 L-1.6 1.6 L-7 0 L-1.6 -1.6 Z" transform="translate(138 66)" fill="#2F74FF" />
      <rect x="196" y="56" width="64" height="40" rx="10" fill="#FFFFFF" stroke="#2F74FF" strokeWidth="2" />
      <rect x="206" y="68" width="40" height="6" rx="3" fill="#EAF2FF" />
      <rect x="206" y="80" width="28" height="6" rx="3" fill="#EAF2FF" />
    </svg>
  )
}

/** Step 6：铃铛（橙色未读点）+ 两侧浅蓝声波弧线 */
function TourNotificationsArt() {
  return (
    <svg {...svgProps} aria-label="铃铛与未读提醒插画">
      <path d="M148 52 C144 58 144 64 148 70" fill="none" stroke="#8DB2FF" strokeWidth="2" strokeLinecap="round" />
      <path d="M140 46 C133 56 133 66 140 76" fill="none" stroke="#8DB2FF" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      <path d="M212 52 C216 58 216 64 212 70" fill="none" stroke="#8DB2FF" strokeWidth="2" strokeLinecap="round" />
      <path d="M220 46 C227 56 227 66 220 76" fill="none" stroke="#8DB2FF" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      <circle cx="180" cy="31" r="3.5" fill="#FFFFFF" stroke="#2F74FF" strokeWidth="2.5" />
      <path
        d="M180 36 C168 36 161 46 161 59 L161 68 L153 77 L207 77 L199 68 L199 59 C199 46 192 36 180 36 Z"
        fill="#FFFFFF"
        stroke="#2F74FF"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="180" cy="83" r="4" fill="#FFFFFF" stroke="#2F74FF" strokeWidth="2.5" />
      <circle cx="203" cy="35" r="5" fill="#F3A53A" stroke="#FFFFFF" strokeWidth="1.5" />
    </svg>
  )
}

/** Step 7：浅蓝头像（白色人形剪影）+ 展开的白色小菜单卡 */
function TourUserArt() {
  return (
    <svg {...svgProps} aria-label="头像与个人菜单插画">
      <defs>
        <clipPath id="tour-user-avatar">
          <circle cx="180" cy="36" r="22" />
        </clipPath>
      </defs>
      <circle cx="180" cy="36" r="22" fill="#EAF2FF" />
      <g clipPath="url(#tour-user-avatar)">
        <circle cx="180" cy="31" r="7.5" fill="#FFFFFF" />
        <path d="M166 58 A14 14 0 0 1 194 58 Z" fill="#FFFFFF" />
      </g>
      <rect x="148" y="64" width="64" height="46" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
      <rect x="156" y="72" width="8" height="8" rx="2" fill="#2F74FF" />
      <rect x="170" y="74" width="26" height="5" rx="2.5" fill="#EAF2FF" />
      <rect x="156" y="87" width="40" height="5" rx="2.5" fill="#EAF2FF" />
      <rect x="156" y="99" width="32" height="5" rx="2.5" fill="#EAF2FF" />
    </svg>
  )
}

/** Step 8：圆环白勾 + 向上抛洒的庆祝纸屑 */
function TourFinishArt() {
  return (
    <svg {...svgProps} aria-label="完成打勾与庆祝纸屑插画">
      <circle cx="140" cy="28" r="2.5" fill="#2F74FF" />
      <circle cx="222" cy="24" r="2.5" fill="#2F74FF" />
      <circle cx="126" cy="54" r="2.5" fill="#2F74FF" />
      <polygon points="0,-4.5 4,3.5 -4,3.5" transform="translate(154 18) rotate(-12)" fill="#7357E8" />
      <polygon points="0,-4.5 4,3.5 -4,3.5" transform="translate(232 62) rotate(18)" fill="#7357E8" />
      <rect x="-3.5" y="-3.5" width="7" height="7" rx="1.5" transform="translate(132 78) rotate(15)" fill="#F3A53A" />
      <rect x="-3.5" y="-3.5" width="7" height="7" rx="1.5" transform="translate(230 42) rotate(-20)" fill="#F3A53A" />
      <circle cx="180" cy="52" r="26" fill="#EAF2FF" stroke="#2F74FF" strokeWidth="2" />
      {/* 白勾（§5 规格）+ 品牌蓝衬底保证浅蓝底上可读 */}
      <path d="M170 52 L177 60 L191 45" fill="none" stroke="#2F74FF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
      <path d="M170 52 L177 60 L191 45" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ---------- 步骤定义（§4，文案逐字） ----------

type Placement = 'bottom' | 'top' | 'right' | 'left'
type Align = 'center' | 'start' | 'end'

interface TourStep {
  key: string
  /** data-tour 锚点；无锚点 = 居中 Modal 形态（首步/末步） */
  target?: string
  placement: Placement
  align: Align
  tag?: string
  title: string
  body: string
  hint?: string
  art: ComponentType
  /** 末步完成页 */
  finish?: boolean
}

const STEPS: TourStep[] = [
  {
    key: 'welcome',
    placement: 'bottom',
    align: 'center',
    title: '欢迎使用企业知识库',
    body: '你的知识工作台已经就绪：资料已接入，答案都能追溯来源，团队可以一起使用。接下来用 1 分钟认识 6 个最常用入口，随时可以跳过。',
    art: TourWelcomeArt,
  },
  {
    key: 'quick-config',
    target: 'quick-config',
    placement: 'bottom',
    align: 'end',
    title: '一键补齐知识配置',
    body: '点这里打开「快速配置」抽屉，上传、连接、权限、答案四步进度一目了然。哪一步没做完，点进去就能直接继续，不需要重新走一遍流程。',
    hint: '配置完成度会实时同步到工作台看板。',
    art: TourQuickConfigArt,
  },
  {
    key: 'sidebar',
    target: 'sidebar',
    placement: 'right',
    align: 'center',
    title: '五组导航，全部工作入口',
    body: `左侧导航按「工作台、知识、智能助手、应用与集成、运营与分析」分成五组，共 ${NAV_ENTRY_COUNT} 个功能入口，一次点击直达。「每日待办」旁的蓝色数字是未处理任务数，会随处理进度实时变化。`,
    hint: '当前所在页面会在导航中高亮显示。',
    art: TourSidebarArt,
  },
  {
    key: 'global-search',
    target: 'global-search',
    placement: 'bottom',
    align: 'center',
    title: '全局搜索，直达任何内容',
    body: '在这里输入关键字，结果按文档、问题、应用分组展示，点一条就直接跳到对应模块，不用逐级翻目录。',
    hint: '试试搜『制度』或『折扣』，看看分组结果。',
    art: TourSearchArt,
  },
  {
    key: 'copilot',
    target: 'copilot',
    placement: 'bottom',
    align: 'end',
    title: 'AI Copilot 随时待命',
    body: '点这个 ✨ 图标，AI Copilot 从右侧滑出。它知道你正在哪个页面，可以边工作边提问，也可以让它总结当前页面数据、生成今天的待办建议。',
    hint: 'Copilot 引用的上下文会列在抽屉里，可以随时移除。',
    art: TourCopilotArt,
  },
  {
    key: 'notifications',
    target: 'notifications',
    placement: 'bottom',
    align: 'end',
    title: '重要动态不漏接',
    body: '铃铛汇集待处理反馈、任务截止和系统通知，红点表示有未读。点开浮层查看未读通知，点一条直达「每日待办」处理，顶部「全部已读」可一键清除未读。',
    art: TourNotificationsArt,
  },
  {
    key: 'user-menu',
    target: 'user-menu',
    placement: 'bottom',
    align: 'end',
    title: '个人与系统设置',
    body: '点头像打开个人菜单：账号信息、设置中心、重新观看本引导、退出登录都在这里。想再看一遍本导览，随时从菜单里点「重新观看新手引导」。',
    art: TourUserArt,
  },
  {
    key: 'finish',
    placement: 'bottom',
    align: 'center',
    tag: '导览完成',
    title: '认识完毕，开始上手吧',
    body: '6 个核心入口都认识了。建议第一步先完成快速配置——资料越完整、权限越准确，AI 给出的答案就越可靠。',
    art: TourFinishArt,
    finish: true,
  },
]

const FINISH_SUMMARY = [
  { icon: Zap, text: '快速配置：补齐知识与权限' },
  { icon: FolderOpen, text: `五组导航：${NAV_ENTRY_COUNT} 个功能入口` },
  { icon: Search, text: '全局搜索 + Copilot：找内容、问 AI' },
  { icon: Bell, text: '通知 + 头像：动态与设置' },
]

// ---------- 定位（§3.3：首选 → 镜像翻转 → 最大空间侧；16px 视口钳制） ----------

const PAD = 8 // 聚光外扩
const GAP = 12 // 卡片与目标间距
const CLAMP = 16 // 视口安全距
const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1]

interface Spot {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

function computeCardPos(
  spot: Spot | null,
  placement: Placement,
  align: Align,
  cardW: number,
  cardH: number,
  vw: number,
  vh: number,
): { x: number; y: number } {
  if (!spot) {
    return { x: Math.max(CLAMP, (vw - cardW) / 2), y: Math.max(CLAMP, (vh - cardH) / 2) }
  }
  const clampX = (x: number) => Math.min(Math.max(x, CLAMP), Math.max(CLAMP, vw - cardW - CLAMP))
  const clampY = (y: number) => Math.min(Math.max(y, CLAMP), Math.max(CLAMP, vh - cardH - CLAMP))
  const spaces: Record<Placement, number> = {
    bottom: vh - (spot.y + spot.height) - GAP - CLAMP,
    top: spot.y - GAP - CLAMP,
    right: vw - (spot.x + spot.width) - GAP - CLAMP,
    left: spot.x - GAP - CLAMP,
  }
  const fits = (p: Placement) => (p === 'bottom' || p === 'top' ? spaces[p] >= cardH : spaces[p] >= cardW)
  const mirror: Record<Placement, Placement> = { bottom: 'top', top: 'bottom', right: 'left', left: 'right' }
  let side = placement
  if (!fits(side)) {
    if (fits(mirror[side])) side = mirror[side]
    else side = (Object.keys(spaces) as Placement[]).reduce((a, b) => (spaces[a] >= spaces[b] ? a : b))
  }
  let x = 0
  let y = 0
  if (side === 'bottom' || side === 'top') {
    y = side === 'bottom' ? spot.y + spot.height + GAP : spot.y - GAP - cardH
    x =
      align === 'end'
        ? spot.x + spot.width - cardW
        : align === 'start'
          ? spot.x
          : spot.x + spot.width / 2 - cardW / 2
  } else {
    x = side === 'right' ? spot.x + spot.width + GAP : spot.x - GAP - cardW
    y = spot.y + spot.height / 2 - cardH / 2
  }
  return { x: clampX(x), y: clampY(y) }
}

/** 读取目标元素聚光 rect：外扩 8px；圆角 = 目标圆角 + 8（无圆角取 12） */
function measureSpot(el: Element): Spot {
  const r = el.getBoundingClientRect()
  const rawRadius = parseFloat(getComputedStyle(el).borderTopLeftRadius)
  return {
    x: r.left - PAD,
    y: r.top - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
    radius: Number.isFinite(rawRadius) && rawRadius > 0 ? rawRadius + PAD : 12,
  }
}

function findTarget(step: TourStep): Element | null {
  if (!step.target) return null
  return document.querySelector(`[data-tour="${step.target}"]`)
}

// ---------- 主组件 ----------

export interface ProductTourProps {
  /** Step 8「开始快速配置」：关闭导览后打开快速配置 Drawer（焦点进入抽屉由 Drawer 负责） */
  onOpenQuickConfig?: () => void
}

export function ProductTour({ onOpenQuickConfig }: ProductTourProps) {
  const reduced = useReducedMotion() ?? false
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [spot, setSpot] = useState<Spot | null>(null)
  const [cardSize, setCardSize] = useState({ w: 380, h: 340 })
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })

  const cardRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const onOpenQuickConfigRef = useRef(onOpenQuickConfig)
  const liveRef = useRef({ active: false, stepIndex: 0 })

  // 最新回调/导览状态写入 ref（供卸载清理与防抖回调读取），放在 effect 中避免渲染期写 ref
  useEffect(() => {
    onOpenQuickConfigRef.current = onOpenQuickConfig
  }, [onOpenQuickConfig])

  useEffect(() => {
    liveRef.current = { active, stepIndex }
  }, [active, stepIndex])

  const step = STEPS[stepIndex]
  const centered = !step.target

  // 启动（手动重开入口统一走 ekb:start-tour 事件）
  const start = useCallback(() => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSpot(null)
    setStepIndex(0)
    setActive(true)
  }, [])

  useEffect(() => {
    window.addEventListener(TOUR_START_EVENT, start)
    return () => window.removeEventListener(TOUR_START_EVENT, start)
  }, [start])

  // 退出：完成 / 跳过均写 done=1（§2.3）
  const exit = useCallback((kind: 'completed' | 'skipped', openQuickConfig = false) => {
    writeTourState(kind)
    setActive(false)
    setSpot(null)
    setTimeout(() => {
      if (openQuickConfig) {
        onOpenQuickConfigRef.current?.()
        return
      }
      // 焦点归还触发源；自动启动（触发源为 body）时回到欢迎横幅「新手引导」按钮（§6）
      const trigger = triggerRef.current
      if (trigger && trigger !== document.body && document.contains(trigger)) trigger.focus()
      else document.querySelector<HTMLElement>('[data-tour-restart]')?.focus()
    }, 60)
  }, [])

  const next = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }, [])
  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0))
  }, [])

  // 步骤推进：目标缺失时跳过（连续 2 步缺失直达完成页，§7）；目标在视口外先滚动到位再聚光
  useEffect(() => {
    if (!active) return
    // 解析有效步骤（防御：目标元素不存在）
    let idx = stepIndex
    let misses = 0
    while (idx < STEPS.length - 1) {
      const s = STEPS[idx]
      if (!s.target || findTarget(s)) break
      misses += 1
      console.warn(`[ProductTour] 未找到 data-tour="${s.target}"，跳过第 ${idx + 1} 步`)
      if (misses >= 2) {
        idx = STEPS.length - 1
        break
      }
      idx += 1
    }
    if (idx !== stepIndex) {
      // 目标缺失需跳步：setState 移出同步 effect 体（微任务中应用，避免级联渲染）
      queueMicrotask(() => setStepIndex(idx))
      return
    }
    const s = STEPS[idx]
    if (!s.target) {
      const t = setTimeout(() => titleRef.current?.focus(), reduced ? 30 : 160)
      return () => clearTimeout(t)
    }
    const el = findTarget(s)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    const t = setTimeout(
      () => {
        setSpot(measureSpot(el))
        titleRef.current?.focus()
      },
      reduced ? 40 : 420,
    )
    return () => clearTimeout(t)
  }, [active, stepIndex, reduced])

  // resize / Sidebar 折叠：120ms 防抖后重算当前步位置（§3.3）
  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const onResize = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setViewport({ w: window.innerWidth, h: window.innerHeight })
        const s = STEPS[liveRef.current.stepIndex]
        const el = s?.target ? findTarget(s) : null
        setSpot(el ? measureSpot(el) : null)
      }, 120)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (timer) clearTimeout(timer)
    }
  }, [active])

  // 导览进行中遮罩下页面 inert（§6）
  useEffect(() => {
    if (!active) return
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    return () => root?.removeAttribute('inert')
  }, [active])

  // 路由变化导致组件卸载：终止导览并记录中断步号（§7 防御）
  useEffect(
    () => () => {
      if (liveRef.current.active) writeTourState(`step-${liveRef.current.stepIndex + 1}`)
    },
    [],
  )

  // 实测卡片尺寸（用于翻转空间判断）
  useLayoutEffect(() => {
    if (!active || !cardRef.current) return
    const r = cardRef.current.getBoundingClientRect()
    setCardSize({ w: r.width, h: r.height })
  }, [active, stepIndex])

  // 键盘：Esc 跳过 / →·Enter 下一步 / ← 上一步 / Tab 焦点锁在卡内（§6）
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        exit('skipped')
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
        return
      }
      if (e.key === 'Enter') {
        const t = e.target as HTMLElement | null
        // 焦点在按钮/链接上时 Enter 触发控件本身（§6）
        if (t && !t.closest('button, a, [role="button"]')) {
          e.preventDefault()
          next()
        }
        return
      }
      if (e.key === 'Tab') {
        const card = cardRef.current
        if (!card) return
        const focusables = Array.from(
          card.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'),
        ).filter((el) => el.offsetParent !== null)
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const current = document.activeElement as HTMLElement | null
        if (e.shiftKey && (!current || current === first || !card.contains(current))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (!current || current === last || !card.contains(current))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, exit, next, prev])

  // ---------- 渲染 ----------

  // 聚光位置：居中步（无 target）恒为 null，目标步使用实测 spot（渲染期派生，替代 effect 内 setSpot(null)）
  const effectiveSpot = step.target ? spot : null
  // 屏幕阅读播报文案（渲染期派生，替代 effect 内 setAnnouncement）
  const announcement = `第 ${stepIndex + 1} 步，共 ${STEPS.length} 步：${step.title}`

  const cardW = centered ? 400 : 380
  const pos = computeCardPos(effectiveSpot, step.placement, step.align, cardW, cardSize.h, viewport.w, viewport.h)
  const titleId = `ekb-tour-title-${stepIndex}`
  const narrow = viewport.w < 1280
  const Art = step.art
  const spotTransition = reduced
    ? { duration: 0 }
    : { duration: 0.24, ease: EASE }
  const cardTransition = reduced
    ? { duration: 0.18 }
    : { duration: 0.24, ease: EASE, delay: 0.06 }

  return createPortal(
    <>
      {/* 屏幕阅读播报（§6） */}
      <div aria-live="polite" className="sr-only">
        {active ? announcement : ''}
      </div>
      <AnimatePresence>
        {active && (
          <>
            {/* 遮罩层（§3.1，z-1000）：SVG mask 挖空目标区域，点击不推进不跳过 */}
            <motion.svg
              key="tour-overlay"
              aria-hidden="true"
              className="fixed inset-0 z-[1000] h-full w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: reduced ? 0.18 : 0.24 } }}
              transition={{ duration: 0.18 }}
            >
              <defs>
                <mask id="ekb-tour-hole">
                  <rect width="100%" height="100%" fill="white" />
                  {effectiveSpot && (
                    <motion.rect
                      fill="black"
                      initial={{ x: effectiveSpot.x, y: effectiveSpot.y, width: effectiveSpot.width, height: effectiveSpot.height, rx: effectiveSpot.radius }}
                      animate={{ x: effectiveSpot.x, y: effectiveSpot.y, width: effectiveSpot.width, height: effectiveSpot.height, rx: effectiveSpot.radius }}
                      transition={spotTransition}
                    />
                  )}
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(16,24,40,0.45)" mask="url(#ekb-tour-hole)" />
            </motion.svg>

            {/* 聚光高亮环（§3.1，z-1001）：1.5px #2F74FF + shadow-focus */}
            {effectiveSpot && (
              <motion.div
                key="tour-spotlight"
                aria-hidden="true"
                className="pointer-events-none fixed left-0 top-0 z-[1001] border-[1.5px] border-brand-500 shadow-focus"
                initial={{
                  opacity: 0,
                  x: effectiveSpot.x,
                  y: effectiveSpot.y,
                  width: effectiveSpot.width,
                  height: effectiveSpot.height,
                  borderRadius: effectiveSpot.radius,
                }}
                animate={{
                  opacity: 1,
                  x: effectiveSpot.x,
                  y: effectiveSpot.y,
                  width: effectiveSpot.width,
                  height: effectiveSpot.height,
                  borderRadius: effectiveSpot.radius,
                }}
                exit={{ opacity: 0, transition: { duration: 0.18 } }}
                transition={spotTransition}
              />
            )}

            {/* 提示卡 TourCard（§3.2，z-1002） */}
            <motion.div
              key={`tour-card-${stepIndex}`}
              ref={cardRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="fixed z-[1002] overflow-hidden rounded-xl bg-white shadow-float"
              style={{ left: pos.x, top: pos.y, width: cardW, maxWidth: 'calc(100vw - 32px)' }}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={cardTransition}
            >
              {/* 配图区（h120，底 #F5F8FF，无文字） */}
              <div className="flex h-[120px] items-center justify-center bg-brand-50">
                <Art />
              </div>

              {/* 内容区 */}
              <div className="p-5">
                <p className="text-caption font-medium text-brand-600">
                  {step.tag ?? `第 ${stepIndex + 1} 步 / 共 ${STEPS.length} 步`}
                </p>
                <h3 id={titleId} ref={titleRef} tabIndex={-1} className="mt-1 text-h3 text-neutral-950 outline-none">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-body text-neutral-700">{step.body}</p>
                {narrow && stepIndex === 0 && (
                  <p className="mt-2 text-caption text-neutral-400">建议使用桌面端体验完整导览。</p>
                )}
                {step.hint && <p className="mt-2 text-caption text-neutral-400">{step.hint}</p>}
                {step.finish && (
                  <ul className="mt-3 flex flex-col gap-1">
                    {FINISH_SUMMARY.map((row) => (
                      <li key={row.text} className="flex h-6 items-center gap-2 text-body-sm text-neutral-700">
                        <row.icon className="h-4 w-4 shrink-0 text-brand-600" />
                        {row.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 底部操作条（§3.2） */}
              <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4">
                {step.finish ? (
                  <button
                    type="button"
                    onClick={() => exit('completed')}
                    className="text-body-sm text-neutral-500 transition-colors duration-micro ease-brand hover:text-neutral-700"
                  >
                    先随便看看
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => exit('skipped')}
                    className="shrink-0 text-body-sm text-neutral-500 transition-colors duration-micro ease-brand hover:text-neutral-700"
                  >
                    跳过
                  </button>
                )}

                {/* 胶囊进度点 */}
                <ul role="list" aria-label="导览进度" className="flex items-center gap-1.5">
                  {STEPS.map((s, i) => (
                    <li key={s.key} aria-current={i === stepIndex ? 'step' : undefined}>
                      <span
                        className={cn(
                          'block h-1.5 rounded-pill transition-all duration-comp ease-brand',
                          i === stepIndex ? 'w-5 bg-brand-600' : i < stepIndex ? 'w-1.5 bg-brand-300' : 'w-1.5 bg-neutral-200',
                        )}
                      />
                      {i === stepIndex && <span className="sr-only">{`第 ${i + 1} 步，共 ${STEPS.length} 步`}</span>}
                    </li>
                  ))}
                </ul>

                <div className="flex shrink-0 items-center gap-2">
                  {stepIndex > 0 && !step.finish && (
                    <button
                      type="button"
                      onClick={prev}
                      className="inline-flex h-8 items-center rounded-md border border-neutral-200 bg-white px-3.5 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
                    >
                      上一步
                    </button>
                  )}
                  {step.finish ? (
                    <button
                      type="button"
                      onClick={() => exit('completed', true)}
                      className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
                    >
                      <Sparkles className="h-4 w-4" />
                      开始快速配置
                    </button>
                  ) : stepIndex === 0 ? (
                    <button
                      type="button"
                      onClick={next}
                      className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
                    >
                      开始导览
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={next}
                      className="inline-flex h-8 items-center rounded-md bg-brand-600 px-3.5 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
                    >
                      下一步
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>,
    document.body,
  )
}
