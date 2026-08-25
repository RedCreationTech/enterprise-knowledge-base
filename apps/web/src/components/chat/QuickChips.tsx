/** QuickChips — 快捷回复：白底蓝框蓝字，高 28–32px，radius 8px；选中浅蓝底 #EAF2FF */
import { cn } from '@/lib/utils'

export interface QuickChipsProps {
  chips: string[]
  selected?: string | null
  onSelect?: (chip: string) => void
  className?: string
}

export function QuickChips({ chips, selected = null, onSelect, className }: QuickChipsProps) {
  if (chips.length === 0) return null
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onSelect?.(chip)}
          className={cn(
            'inline-flex h-8 items-center rounded-md border px-3 text-body-sm transition-colors duration-micro ease-brand',
            selected === chip
              ? 'border-brand-500 bg-brand-100 text-brand-700'
              : 'border-brand-300 bg-white text-brand-600 hover:bg-brand-50',
          )}
        >
          {chip}
        </button>
      ))}
    </div>
  )
}
