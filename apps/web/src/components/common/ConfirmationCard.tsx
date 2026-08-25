/**
 * ConfirmationCard — 高风险操作确认卡（design.md §7）：
 * 动作 / 影响对象 / 影响范围 / 外部影响 / 可撤销性 + 确认执行 / 修改设置 / 取消
 */
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConfirmationField {
  label: string
  value: string
}

export interface ConfirmationCardProps {
  title: string
  description?: string
  fields: ConfirmationField[]
  confirmText?: string
  loading?: boolean
  onConfirm: () => void
  onModify?: () => void
  onCancel: () => void
  className?: string
}

export function ConfirmationCard({
  title,
  description,
  fields,
  confirmText = '确认执行',
  loading = false,
  onConfirm,
  onModify,
  onCancel,
  className,
}: ConfirmationCardProps) {
  return (
    <div className={cn('rounded-xl border border-neutral-200 bg-white p-6 shadow-float', className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-warning-bg text-warning">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-h3 text-neutral-950">{title}</h3>
          {description && <p className="mt-1 text-body-sm text-neutral-500">{description}</p>}
        </div>
      </div>
      <dl className="mt-4 space-y-2 rounded-lg bg-surface-soft p-4">
        {fields.map((f) => (
          <div key={f.label} className="flex items-start gap-4 text-body-sm">
            <dt className="w-20 shrink-0 text-neutral-500">{f.label}</dt>
            <dd className="min-w-0 flex-1 text-neutral-800">{f.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-md px-4 text-body text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100"
        >
          取消
        </button>
        {onModify && (
          <button
            type="button"
            onClick={onModify}
            className="h-10 rounded-md border border-[#BFD0F2] bg-white px-4 text-body text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
          >
            修改设置
          </button>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={onConfirm}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-5 text-body font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700',
            loading && 'cursor-not-allowed bg-neutral-100 text-neutral-400',
          )}
        >
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500" />
          )}
          {loading ? '正在执行…' : confirmText}
        </button>
      </div>
    </div>
  )
}
