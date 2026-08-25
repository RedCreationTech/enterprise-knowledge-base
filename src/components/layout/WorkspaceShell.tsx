/**
 * WorkspaceShell — 正式页共享壳（design.md §6.2 + V1.1-§6.2 完整版导航 + V1.3 v13-unify §5）
 * 1. 64px Header（Logo / 企业切换器 / 全局搜索 420–520px / 通知铃铛 / ✨ Copilot 入口 / 头像，均挂 data-tour 锚点）
 * 2. 184px Sidebar（企业卡 / 五组导航（工作台[含快速配置/每日待办] + 知识/智能助手/应用与集成/运营与分析，共 18 项）/ 底部套餐卡含容量进度条）
 * 3. <Outlet/> 主内容区（外边距 24px，max-w-content 居中）
 *
 * V1.3：「工作台」升级为分组（工作台 + 每日待办，待办带蓝 pill 计数，与 store 任务联动）；
 * 应用中心路由迁入 /workspace/apps；试用期简洁变体（NAV_SIMPLE）已废弃移除。
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import {
  Bot,
  Blocks,
  Building2,
  ChevronDown,
  BarChart3,
  CodeXml,
  Database,
  FolderOpen,
  Globe,
  Inbox,
  Layers,
  LayoutDashboard,
  ListTodo,
  MessagesSquare,
  Network,
  Plug,
  Rocket,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { org, plan, useAppStore } from '@/mocks'
import { ProgressBar } from '@/components/common/ProgressBar'
import { CopilotDrawer } from '@/components/CopilotDrawer'
import { HeaderSearch } from '@/components/layout/HeaderSearch'
import { NotificationsMenu } from '@/components/layout/NotificationsMenu'
import { UserMenu } from '@/components/layout/UserMenu'

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  /** 蓝色计数 pill（每日待办，与 store 任务联动） */
  todoPill?: boolean
}

interface NavGroup {
  section?: string
  items: NavItem[]
}

/** 正式版全量导航（5 组 18 项）；export 供 ProductTour 等派生真实入口数 */
export const NAV_FULL: NavGroup[] = [
  {
    section: '工作台',
    items: [
      { label: '工作台', path: '/workspace/dashboard', icon: LayoutDashboard },
      { label: '快速配置', path: '/workspace/quick-config', icon: Rocket },
      { label: '每日待办', path: '/workspace/daily', icon: ListTodo, todoPill: true },
    ],
  },
  {
    section: '知识',
    items: [
      { label: '知识网站', path: '/workspace/knowledge-site', icon: Globe },
      { label: '知识库与文档', path: '/workspace/knowledge-base', icon: FolderOpen },
      { label: '知识空间', path: '/workspace/spaces', icon: Layers },
      { label: '知识地图', path: '/workspace/knowledge-map', icon: Network },
      { label: '数据来源', path: '/workspace/data-sources', icon: Database },
    ],
  },
  {
    section: '智能助手',
    items: [
      { label: 'AI 助手', path: '/workspace/ai-assistant', icon: Bot },
      { label: '对话历史', path: '/workspace/chat-history', icon: MessagesSquare },
      { label: '指令管理', path: '/workspace/instructions', icon: ScrollText },
    ],
  },
  {
    section: '应用与集成',
    items: [
      { label: '应用中心', path: '/workspace/apps', icon: Blocks },
      { label: '集成管理', path: '/workspace/integrations', icon: Plug },
      { label: 'API 与开发', path: '/workspace/api-dev', icon: CodeXml },
    ],
  },
  {
    section: '运营与分析',
    items: [
      { label: '使用分析', path: '/workspace/analytics', icon: BarChart3 },
      { label: '反馈与洞察', path: '/workspace/feedback', icon: Inbox },
      { label: '权限管理', path: '/workspace/permissions', icon: ShieldCheck },
      { label: '设置中心', path: '/workspace/settings', icon: Settings },
    ],
  },
]

export interface WorkspaceShellProps {
  children?: ReactNode
}

function WorkspaceHeader({ onOpenCopilot }: { onOpenCopilot: () => void }) {
  const { state } = useAppStore()
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-neutral-200 bg-white px-6">
      <div className="flex shrink-0 items-center gap-2.5">
        <img src="/logo.svg" alt="企业知识库" className="h-7 w-7 rounded-md" />
        <span className="text-h3 text-neutral-950">企业知识库</span>
      </div>
      <div className="hidden min-w-0 flex-1 justify-center lg:flex">
        <HeaderSearch />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          title="切换企业"
          className="hidden h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 text-neutral-600 transition-colors duration-micro ease-brand hover:border-brand-300 xl:flex"
        >
          <Building2 className="h-4 w-4" />
          <ChevronDown className="h-4 w-4 text-neutral-400" />
        </button>
        {state.demoData && (
          <span
            title="当前展示为演示数据，可在 设置中心 → 演示数据 重置为空态"
            className="hidden h-6 items-center rounded-pill bg-warning-bg px-2 text-[12px] font-medium text-warning xl:inline-flex"
          >
            演示数据
          </span>
        )}
        <NotificationsMenu />
        <button
          type="button"
          title="AI Copilot"
          data-tour="copilot"
          onClick={onOpenCopilot}
          className="flex h-9 items-center gap-1.5 rounded-md bg-violet-bg px-3 text-body-sm font-medium text-violet transition-colors duration-micro ease-brand hover:brightness-95"
        >
          <Sparkles className="h-4 w-4" />
          Copilot
        </button>
        <UserMenu />
      </div>
    </header>
  )
}

function NavList({ groups }: { groups: NavGroup[] }) {
  const { state } = useAppStore()
  // 每日待办计数：与 store 任务同源（待处理 + 进行中），完成自动 -1
  const todoOpen = state.tasks.filter((t) => t.status === '待处理' || t.status === '进行中').length
  return (
    <nav className="flex flex-col gap-4 px-3">
      {groups.map((group, gi) => (
        <div key={group.section ?? `g-${gi}`}>
          {group.section && (
            <p className="mb-1 px-3 text-caption font-medium text-neutral-500">{group.section}</p>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.label}>
                <NavLink
                  to={item.path}
                  end={item.path === '/workspace/dashboard'}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 items-center gap-2 rounded-md px-3 text-body transition-colors duration-micro ease-brand',
                      isActive
                        ? 'bg-brand-100 font-medium text-brand-600'
                        : 'text-neutral-700 hover:bg-neutral-100',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.todoPill && todoOpen > 0 && (
                    <span className="ml-auto shrink-0 rounded-pill bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                      {todoOpen}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** 套餐卡：design.md §6.2 标准结构；试用期「试用版 · 有效期至 2025-06-03 · 升级套餐」，激活后专业版卡 */
function PlanCard() {
  const { state } = useAppStore()
  const trial = !state.journey.activated
  return (
    <div className="mx-3 mb-4 rounded-lg bg-brand-50 p-3">
      <p className="text-body-sm font-semibold text-neutral-950">{trial ? '试用版' : plan.name}</p>
      <p className="mt-0.5 text-caption text-neutral-500">有效期至 {trial ? '2025-06-03' : plan.validUntil}</p>
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-caption text-neutral-500">
          <span>知识容量</span>
          <span>
            {plan.storageUsedGB}/{plan.storageTotalGB}GB
          </span>
        </div>
        <ProgressBar value={plan.pct} />
      </div>
      <button
        type="button"
        className="mt-3 h-8 w-full rounded-md border border-[#BFD0F2] bg-white text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-100"
      >
        升级套餐
      </button>
    </div>
  )
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const [copilotOpen, setCopilotOpen] = useState(false)

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-page">
      <WorkspaceHeader onOpenCopilot={() => setCopilotOpen(true)} />
      <div className="mx-auto flex w-full max-w-[1920px] flex-1 items-stretch">
        <aside
          data-tour="sidebar"
          className="sticky top-16 flex h-[calc(100dvh-64px)] w-[184px] shrink-0 flex-col border-r border-neutral-200 bg-white"
        >
          <div className="flex items-center gap-2 px-4 py-3">
            <img src="/logo.svg" alt="" className="h-7 w-7 shrink-0 rounded-md" />
            <p className="min-w-0 truncate text-body-sm font-semibold text-neutral-950">{org.name}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-3">
            <NavList groups={NAV_FULL} />
          </div>
          <PlanCard />
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-content px-6 pt-4 pb-6">{children ?? <Outlet />}</div>
        </main>
      </div>
      <CopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  )
}
