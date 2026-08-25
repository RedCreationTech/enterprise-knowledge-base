/** CitationCard — 文档名 + 版本 + 页码；「主要依据」绿 Chip；选中 1.5px 蓝边（design.md §7 / design-system §6.8） */
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CitationCardProps {
  name: string
  version: string
  page: string
  /** 「主要依据」标识 */
  primary?: boolean
  selected?: boolean
  onClick?: () => void
  className?: string
}

export function CitationCard({ name, version, page, primary = false, selected = false, onClick, className }: CitationCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border bg-white p-3 text-left transition-colors duration-micro ease-brand',
        selected
          ? 'border-[1.5px] border-brand-500 bg-surface-cardSel'
          : 'border-neutral-200 hover:border-brand-300',
        className,
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
        <FileText className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-body-sm font-medium text-neutral-950">{name}</span>
          {primary && (
            <span className="inline-flex h-5 shrink-0 items-center rounded-sm bg-success-bg px-1.5 text-caption font-medium text-success">
              主要依据
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-caption text-neutral-500">
          {version} · {page}
        </span>
      </span>
    </button>
  )
}
