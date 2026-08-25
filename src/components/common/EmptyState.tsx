/** EmptyState — 空状态（插画 + 标题 + 说明 + 可选下一步操作） */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  image?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ image = '/empty-docs.svg', title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <img src={image} alt="" className="h-auto w-56 opacity-90" />
      <h3 className="mt-4 text-h3 text-neutral-800">{title}</h3>
      {description && <p className="mt-1 max-w-md text-body-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
