/**
 * AnswerCard — 可信答案五段结构（design.md §7）：
 * 结论(h2) → 解释/适用条件 → 引用来源(n) → 可信度徽标（数字+文字，浅绿/浅黄/浅红三档）→ 反馈操作（三按钮）
 */
import { Check, Quote, RotateCcw, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AnswerFeedback = 'correct' | 'wrong' | null

export interface AnswerCardProps {
  question?: string
  conclusion: string
  explanation?: string
  /** 引用来源数量 */
  citations: number
  /** 可信度 0–100 */
  trust: number
  trustNote?: string
  feedback?: AnswerFeedback
  onFeedback?: (type: 'correct' | 'wrong' | 'ask') => void
  /** 额外插槽（如引用卡列表） */
  children?: React.ReactNode
  className?: string
}

function trustTier(trust: number) {
  if (trust >= 85) return { label: '高可信', cls: 'bg-success-bg text-success' }
  if (trust >= 60) return { label: '中等可信', cls: 'bg-warning-bg text-warning' }
  return { label: '低可信', cls: 'bg-danger-bg text-danger' }
}

export function AnswerCard({
  question,
  conclusion,
  explanation,
  citations,
  trust,
  trustNote = '综合评估结果',
  feedback = null,
  onFeedback,
  children,
  className,
}: AnswerCardProps) {
  const tier = trustTier(trust)
  const locked = feedback !== null

  return (
    <div className={cn('rounded-xl border border-neutral-200 bg-white p-6 shadow-card', className)}>
      {question && (
        <p className="mb-3 flex items-start gap-2 text-body-sm text-neutral-500">
          <Quote className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
          {question}
        </p>
      )}
      {/* 1. 结论 */}
      <h2 className="text-h2 text-neutral-950">{conclusion}</h2>
      {/* 2. 解释 / 适用条件 */}
      {explanation && <p className="mt-2 text-body text-neutral-700">{explanation}</p>}
      {/* 3. 引用来源 + 4. 可信度 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center gap-1 rounded-pill bg-neutral-100 px-2.5 text-caption text-neutral-700">
          <Quote className="h-3.5 w-3.5 text-brand-500" />
          引用来源 {citations} 处
        </span>
        <span className={cn('inline-flex h-7 items-center gap-1 rounded-pill px-2.5 text-caption font-medium', tier.cls)}>
          <ShieldCheck className="h-3.5 w-3.5" />
          可信度 {trust}% {tier.label} · {trustNote}
        </span>
      </div>
      {/* 5. 反馈操作 */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
        <button
          type="button"
          disabled={locked}
          onClick={() => onFeedback?.('correct')}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-body-sm transition-colors duration-micro ease-brand',
            feedback === 'correct'
              ? 'border-success bg-success-bg text-success'
              : 'border-neutral-200 bg-white text-success hover:bg-success-bg',
            locked && feedback !== 'correct' && 'cursor-not-allowed opacity-40',
          )}
        >
          {feedback === 'correct' ? <Check className="h-4 w-4" /> : <ThumbsUp className="h-4 w-4" />}
          答案正确
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => onFeedback?.('wrong')}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-body-sm transition-colors duration-micro ease-brand',
            feedback === 'wrong'
              ? 'border-danger bg-danger-bg text-danger'
              : 'border-neutral-200 bg-white text-danger hover:bg-danger-bg',
            locked && feedback !== 'wrong' && 'cursor-not-allowed opacity-40',
          )}
        >
          <ThumbsDown className="h-4 w-4" />
          答案有问题
        </button>
        <button
          type="button"
          onClick={() => onFeedback?.('ask')}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
        >
          <RotateCcw className="h-4 w-4" />
          再问一个
        </button>
      </div>
      {children}
    </div>
  )
}
