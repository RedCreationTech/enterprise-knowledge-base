/** MetricCard — 图标 + 指标名称 + 核心数字 + 环比/状态；一卡一数字；数字滚动 600ms（design.md §5/§7） */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { animate } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface MetricCardProps {
  icon?: ReactNode
  name: string
  value: number | string
  suffix?: string
  /** 环比文案，如 "+12%" */
  delta?: string
  deltaDirection?: 'up' | 'down'
  /** delta 是否代表好事（决定颜色） */
  deltaPositive?: boolean
  hint?: string
  className?: string
  onClick?: () => void
}

export function MetricCard({
  icon,
  name,
  value,
  suffix,
  delta,
  deltaDirection = 'up',
  deltaPositive = true,
  hint,
  className,
  onClick,
}: MetricCardProps) {
  const numeric = typeof value === 'number'
  const [display, setDisplay] = useState(0)
  const playedRef = useRef(false)

  useEffect(() => {
    if (!numeric) return
    if (playedRef.current) {
      setDisplay(value as number)
      return
    }
    playedRef.current = true
    const controls = animate(0, value as number, {
      duration: 0.6,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return () => controls.stop()
  }, [numeric, value])

  const DeltaIcon = deltaDirection === 'up' ? TrendingUp : TrendingDown

  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200 bg-white p-5 shadow-card',
        onClick && 'cursor-pointer transition-shadow duration-comp ease-brand hover:shadow-float',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-body-sm text-neutral-500">{name}</span>
        {icon && <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-600">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-metric-lg text-neutral-950">
          {numeric ? display.toLocaleString('en-US') : value}
        </span>
        {suffix && <span className="text-body-sm text-neutral-500">{suffix}</span>}
      </div>
      <div className="mt-1 flex items-center gap-1 text-caption">
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              deltaPositive ? 'text-success' : 'text-danger',
            )}
          >
            <DeltaIcon className="h-3.5 w-3.5" />
            {delta}
          </span>
        )}
        {hint && <span className="text-neutral-400">{hint}</span>}
      </div>
    </div>
  )
}
