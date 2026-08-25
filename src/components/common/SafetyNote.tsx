/** SafetyNote — 底部安全声明条（design.md §6.1-5 / §7） */
import { Lock, Receipt, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SafetyNoteProps {
  /** verify-answer 页使用「每个答案都有出处」声明 */
  variant?: 'default' | 'verify'
  className?: string
}

export function SafetyNote({ variant = 'default', className }: SafetyNoteProps) {
  if (variant === 'verify') {
    return (
      <p className={cn('flex items-center justify-center gap-1.5 text-caption text-neutral-500', className)}>
        <ShieldCheck className="h-3.5 w-3.5 text-success" />
        每个答案都有出处，未授权的内容不会回答。
      </p>
    )
  }
  return (
    <div className={cn('flex items-center justify-center gap-6 text-caption text-neutral-500', className)}>
      <span className="inline-flex items-center gap-1.5">
        <Receipt className="h-3.5 w-3.5" />
        无需信用卡
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5" />
        安全试用 7 天
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" />
        数据安全有保障
      </span>
    </div>
  )
}
