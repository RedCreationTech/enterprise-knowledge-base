/** PriorityBadge — 高=红浅底 / 中=橙浅底 / 低=蓝或灰浅底（design-system §6.4） */
import { cn } from '@/lib/utils'
import type { TaskPriority } from '@/mocks/store'

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  高: 'bg-danger-bg text-danger',
  中: 'bg-warning-bg text-warning',
  低: 'bg-info-bg text-info',
}

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center whitespace-nowrap rounded-pill px-2 text-caption font-medium',
        PRIORITY_CLASS[priority],
        className,
      )}
    >
      {priority}优先级
    </span>
  )
}
