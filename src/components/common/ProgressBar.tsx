/** ProgressBar — 条形：#2F74FF 底 #EAF2FF（design.md §7） */
import { cn } from '@/lib/utils'

export interface ProgressBarProps {
  /** 0–100 */
  value: number
  showLabel?: boolean
  className?: string
  barClassName?: string
}

export function ProgressBar({ value, showLabel = false, className, barClassName }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-pill bg-brand-100">
        <div
          className={cn('h-full rounded-pill bg-brand-500 transition-[width] duration-modal ease-brand', barClassName)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && <span className="shrink-0 text-caption text-neutral-500">{clamped}%</span>}
    </div>
  )
}
