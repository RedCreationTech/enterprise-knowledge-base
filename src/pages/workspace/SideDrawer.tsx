/**
 * SideDrawer — 右滑抽屉（x: 100%→0，240ms，遮罩 rgba(16,24,40,.4)，Esc 关闭，design.md §7）。
 */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SideDrawerProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** 宽度 px，默认 480 */
  width?: number
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function SideDrawer({ open, onClose, title, width = 480, children, footer, className }: SideDrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="mask"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 z-[70] bg-[rgba(16,24,40,0.4)]"
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn(
              'fixed inset-y-0 right-0 z-[71] flex w-full flex-col bg-white shadow-float',
              className,
            )}
            style={{ maxWidth: width }}
            role="dialog"
            aria-modal="true"
          >
            <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-5">
              <div className="min-w-0 flex-1 truncate text-h3 text-neutral-950">{title}</div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <footer className="shrink-0 border-t border-neutral-200 px-5 py-3">{footer}</footer>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
