/**
 * TrendChart — 轻量 SVG 单折线图（#2F74FF，节点直接标数值，轴浅灰，design.md §7 LineChart）。
 * 首次进入描边动画 900ms。
 * Hover tooltip：显示日期与数值（白底圆角卡 + #E4EAF2 边，对齐 daily 页 recharts Tooltip 交互）；
 * 数据点 >10 时（近 30 天）隐藏逐点数值、X 轴标签抽稀，避免拥挤。
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export interface TrendChartProps {
  values: number[]
  labels: string[]
  height?: number
  className?: string
}

export function TrendChart({ values, labels, height = 220, className }: TrendChartProps) {
  const width = 560
  const padL = 36
  const padR = 16
  const padT = 24
  const padB = 28
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const max = Math.max(...values) * 1.2
  const [played, setPlayed] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  /** 数据点较多时抽稀：逐点数值与 X 轴标签不全量渲染 */
  const dense = values.length > 10
  const labelEvery = Math.ceil(values.length / 7)

  useEffect(() => {
    const t = setTimeout(() => setPlayed(true), 950)
    return () => clearTimeout(t)
  }, [])

  const points = values.map((v, i) => {
    const x = padL + (innerW * i) / (values.length - 1)
    const y = padT + innerH * (1 - v / max)
    return { x, y, v }
  })
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const ticks = [0, Math.round(max / 2), Math.round(max)]
  const hoverPoint = hover !== null ? points[hover] : null

  return (
    <div className={className}>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="最近使用趋势">
          {/* 横向网格线 */}
          {ticks.map((t) => {
            const y = padT + innerH * (1 - t / max)
            return (
              <g key={t}>
                <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#EEF2F7" strokeWidth={1} />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#98A2B3">
                  {t}
                </text>
              </g>
            )
          })}
          {/* 折线（key=path：切换数据范围时重新播放描边动画） */}
          <motion.path
            key={path}
            d={path}
            fill="none"
            stroke="#2F74FF"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
          {/* 节点 + 数值 + X 轴标签 */}
          {points.map((p, i) => (
            <g key={labels[i]} style={{ opacity: played ? 1 : 0, transition: 'opacity 200ms' }}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hover === i ? 5 : 3.5}
                fill="#fff"
                stroke="#2F74FF"
                strokeWidth={2}
                style={{ transition: 'r 120ms' }}
              />
              {!dense && (
                <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={11} fontWeight={600} fill="#1E63F4">
                  {p.v}
                </text>
              )}
              {(!dense || i % labelEvery === 0 || i === points.length - 1) && (
                <text x={p.x} y={height - 8} textAnchor="middle" fontSize={11} fill="#98A2B3">
                  {labels[i]}
                </text>
              )}
            </g>
          ))}
          {/* hover 热区：每点一条透明竖带，命中最近节点 */}
          {points.map((p, i) => {
            const x0 = i === 0 ? padL : (points[i - 1].x + p.x) / 2
            const x1 = i === points.length - 1 ? width - padR : (p.x + points[i + 1].x) / 2
            return (
              <rect
                key={`hot-${labels[i]}`}
                x={x0}
                y={padT}
                width={x1 - x0}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            )
          })}
        </svg>
        {/* tooltip（对齐 daily 页 recharts：白底 / #E4EAF2 边 / 8px 圆角 / 12px 字） */}
        {hoverPoint && hover !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border bg-white px-2.5 py-1.5 text-caption shadow-float"
            style={{
              left: `${(hoverPoint.x / width) * 100}%`,
              top: `${(hoverPoint.y / height) * 100}%`,
              transform: `translate(-50%, calc(-100% - 10px))`,
              borderColor: '#E4EAF2',
              fontSize: 12,
            }}
          >
            <p className="whitespace-nowrap text-neutral-500">{labels[hover]}</p>
            <p className="flex items-center gap-1.5 whitespace-nowrap text-neutral-800">
              <span className="h-2 w-2 rounded-full bg-brand-500" />
              使用次数：<span className="font-semibold">{hoverPoint.v} 次</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
