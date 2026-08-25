/** SectionCard — 白卡容器（design-system §6.3：白底 / 1px #E4EAF2 / radius 12–16 / padding 20–24 / shadow-card） */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SectionCardProps {
  title?: string
  /** 标题左侧 20px 图标 */
  icon?: ReactNode
  /** 标题右侧操作（≤2 个） */
  actions?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}

export function SectionCard({ title, icon, actions, className, bodyClassName, children }: SectionCardProps) {
  return (
    <section className={cn('rounded-xl border border-neutral-200 bg-white p-5 shadow-card', className)}>
      {(title || actions) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center text-brand-600">{icon}</span>}
            {title && <h3 className="truncate text-h3 text-neutral-950">{title}</h3>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
