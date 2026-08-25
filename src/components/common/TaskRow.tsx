/** TaskRow — 待办行：任务 / 优先级 / 状态 / 截止 / 负责人 / 主操作 + 更多（design-system §6.9） */
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskItem, TaskStatus } from '@/mocks/store'
import { PriorityBadge } from './PriorityBadge'
import { StatusBadge } from './StatusBadge'

export interface TaskRowProps {
  task: TaskItem
  primaryLabel?: string
  onPrimary?: (task: TaskItem) => void
  /** 更多操作：稍后 / 转交 / 跳过 */
  onLater?: (task: TaskItem) => void
  onTransfer?: (task: TaskItem) => void
  onSkip?: (task: TaskItem) => void
  className?: string
}

export function TaskRow({ task, primaryLabel = '开始处理', onPrimary, onLater, onTransfer, onSkip, className }: TaskRowProps) {
  const done = task.status === '已完成'
  return (
    <div
      className={cn(
        'group flex items-center gap-3 border-b border-neutral-100 px-1 py-3 last:border-b-0',
        done && 'opacity-60',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-body text-neutral-950', done && 'line-through')}>{task.title}</p>
        {task.reason && <p className="mt-0.5 truncate text-caption text-neutral-500">{task.reason}</p>}
      </div>
      <PriorityBadge priority={task.priority} className="shrink-0" />
      <StatusBadge status={task.status} className="shrink-0" />
      <span className="hidden w-20 shrink-0 text-right text-caption text-neutral-500 md:block">{task.due}</span>
      <span className="hidden w-14 shrink-0 text-right text-caption text-neutral-500 lg:block">{task.owner}</span>
      {!done && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onPrimary?.(task)}
            className="h-8 rounded-md bg-brand-600 px-3 text-body-sm text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
          >
            {primaryLabel}
          </button>
          <div className="relative">
            <details className="group/menu">
              <summary className="flex h-8 w-8 list-none items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100 [&::-webkit-details-marker]:hidden">
                <MoreHorizontal className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 top-9 z-20 w-28 rounded-md border border-neutral-200 bg-white py-1 shadow-float">
                {(
                  [
                    ['稍后', onLater, '已跳过'],
                    ['转交', onTransfer, '已转交'],
                    ['跳过', onSkip, '已跳过'],
                  ] as const
                ).map(([label, handler]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handler?.(task)}
                    className="block w-full px-3 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  )
}

export type { TaskStatus }
