/** ProgressRing — 圆环：蓝描边 + 中心 metric-lg 百分比（design.md §7） */
import { cn } from '@/lib/utils'

export interface ProgressRingProps {
  /** 0–100 */
  value: number
  size?: number
  strokeWidth?: number
  label?: string
  className?: string
}

export function ProgressRing({ value, size = 96, strokeWidth = 8, label, className }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-brand-100)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 240ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-metric-lg text-neutral-950">{clamped}%</span>
        {label && <span className="text-caption text-neutral-500">{label}</span>}
      </div>
    </div>
  )
}
