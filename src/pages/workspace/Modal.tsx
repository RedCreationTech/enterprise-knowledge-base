/**
 * Modal — 通用弹窗（design.md §7：max-h 88vh / radius 16 / shadow-float / 遮罩 rgba(16,24,40,.4)，scale .96→1 240ms）
 * 全站唯一 Modal 基座：workspace 富模式（title/description/footer + width px）与 activation bare 模式
 * （无 header/footer，children 自带白卡，maxWidth Tailwind class）共用同一焦点陷阱与 Esc 分层。
 */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/hooks/use-focus-trap'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  /** 富模式宽度 px，默认 560 */
  width?: number
  children: ReactNode
  /** 底部操作区（富模式） */
  footer?: ReactNode
  /** bare 模式：无 header/footer/关闭按钮/白底，直接渲染 children（activation 兼容） */
  bare?: boolean
  /** bare 模式宽度（Tailwind class，如 max-w-lg） */
  maxWidth?: string
}

export function Modal({
  open,
  onClose,
  title,
  description,
  width = 560,
  children,
  footer,
  bare = false,
  maxWidth = 'max-w-lg',
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(open, containerRef)

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
        <div className={cn('fixed inset-0 flex items-center justify-center p-6', bare ? 'z-50' : 'z-[80]')}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={bare ? { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] } : { duration: 0.24 }}
            className="absolute inset-0"
            style={{ background: 'rgba(16,24,40,0.4)' }}
            onClick={onClose}
          />
          <motion.div
            ref={containerRef}
            initial={bare ? { opacity: 0, scale: 0.96, y: 8 } : { opacity: 0, scale: 0.96 }}
            animate={bare ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, scale: 1 }}
            exit={bare ? { opacity: 0, scale: 0.96, y: 8 } : { opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            tabIndex={-1}
            role={bare ? undefined : 'dialog'}
            aria-modal={bare ? undefined : 'true'}
            className={cn(
              bare
                ? cn('relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-xl outline-none', maxWidth)
                : 'relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-float outline-none',
            )}
            style={bare ? undefined : { maxWidth: width }}
          >
            {bare ? (
              children
            ) : (
              <>
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
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
