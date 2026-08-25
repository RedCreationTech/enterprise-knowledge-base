/**
 * Modal — 通用弹窗（design.md §7：max-h 88vh / radius 16 / shadow-float / 遮罩 rgba(16,24,40,.4)，scale .96→1 240ms）
 */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  width?: number
  children: ReactNode
  /** 底部操作区 */
  footer?: ReactNode
}

export function Modal({ open, onClose, title, description, width = 560, children, footer }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="absolute inset-0"
            style={{ background: 'rgba(16,24,40,0.4)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn('relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-float')}
            style={{ maxWidth: width }}
            role="dialog"
            aria-modal="true"
          >
            {(title || description) && (
              <header className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-4">
                <div className="min-w-0">
                  {title && <h3 className="text-h3 text-neutral-950">{title}</h3>}
                  {description && <p className="mt-0.5 text-body-sm text-neutral-500">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-600"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <footer className="flex items-center justify-end gap-2 border-t border-neutral-100 px-6 py-4">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
