/**
 * PageHeader — Workspace 页面标题区：面包屑 + H1 + 副标题 + 右侧操作（≤2 个，design.md §6.2）。
 */
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  /** 面包屑段，最后一段为当前页（加粗高亮） */
  crumbs: string[]
  title: string
  subtitle?: string
  /** 标题右侧徽标（如「已发布」） */
  badge?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ crumbs, title, subtitle, badge, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-4', className)}>
      {crumbs.length > 0 && (
        <nav className="mb-1.5 flex h-8 items-center gap-1 text-body-sm text-neutral-500">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1
            return (
              <span key={`${c}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />}
                <span className={last ? 'font-medium text-neutral-950' : undefined}>{c}</span>
              </span>
            )
          })}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-h1 text-neutral-950">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="mt-1.5 text-body text-neutral-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
