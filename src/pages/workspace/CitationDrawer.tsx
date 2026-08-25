/**
 * CitationDrawer — 引用抽屉（480px 右滑入 240ms）：文档名/版本/页码 + 引用片段上下文（原文高亮 #FFF4C2）
 * + Owner/更新时间/有效状态；Esc 关闭且焦点返回原引用按钮。
 */
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, FileText, ShieldCheck, User, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CitationData } from './aiAssistant.mock'

export interface CitationDrawerProps {
  citation: CitationData | null
  onClose: () => void
  /** 打开时的触发元素，关闭后焦点返回 */
  returnFocusRef?: React.MutableRefObject<HTMLElement | null>
}

const VALIDITY_CLASS: Record<CitationData['validity'], string> = {
  有效: 'bg-success-bg text-success',
  即将过期: 'bg-warning-bg text-warning',
  已过期: 'bg-danger-bg text-danger',
}

export function CitationDrawer({ citation, onClose, returnFocusRef }: CitationDrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (citation) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [citation, onClose])

  // 关闭后焦点返回原引用按钮
  useEffect(() => {
    if (!citation && returnFocusRef?.current) {
      returnFocusRef.current.focus()
      returnFocusRef.current = null
    }
  }, [citation, returnFocusRef])

  return (
    <AnimatePresence>
      {citation && (
        <div className="fixed inset-0 z-[55]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="absolute inset-0"
            style={{ background: 'rgba(16,24,40,0.4)' }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute right-0 top-0 flex h-full w-[480px] max-w-[92vw] flex-col bg-white shadow-float"
            role="dialog"
            aria-label="引用原文"
          >
            <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <FileText className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-body font-semibold text-neutral-950">{citation.name}</h3>
                  <p className="text-caption text-neutral-500">
                    {citation.version} · {citation.page}
                    {citation.primary ? ' · 主要依据' : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-600"
                aria-label="关闭引用抽屉"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <p className="text-caption font-medium text-neutral-400">引用片段上下文</p>
              <motion.div
                initial={{ backgroundColor: 'rgba(255,244,194,0)' }}
                animate={{ backgroundColor: 'rgba(255,244,194,1)' }}
                transition={{ duration: 0.24 }}
                className="mt-2 rounded-lg p-4"
              >
                <p className="text-body leading-6 text-neutral-800">
                  ……此处为文档原文节选，
                  <mark className="rounded-sm bg-surface-highlight px-0.5 text-neutral-900">{citation.excerpt}</mark>
                  其余内容与当前问题相关性较低，已省略。
                </p>
              </motion.div>
              <dl className="mt-5 space-y-3 rounded-lg bg-surface-soft p-4">
                <div className="flex items-center gap-2 text-body-sm">
                  <User className="h-4 w-4 text-neutral-400" />
                  <dt className="w-20 shrink-0 text-neutral-500">Owner</dt>
                  <dd className="text-neutral-800">{citation.owner}</dd>
                </div>
                <div className="flex items-center gap-2 text-body-sm">
                  <CalendarDays className="h-4 w-4 text-neutral-400" />
                  <dt className="w-20 shrink-0 text-neutral-500">更新时间</dt>
                  <dd className="text-neutral-800">{citation.updatedAt}</dd>
                </div>
                <div className="flex items-center gap-2 text-body-sm">
                  <ShieldCheck className="h-4 w-4 text-neutral-400" />
                  <dt className="w-20 shrink-0 text-neutral-500">有效状态</dt>
                  <dd>
                    <span
                      className={cn(
                        'inline-flex h-6 items-center rounded-pill px-2 text-caption font-medium',
                        VALIDITY_CLASS[citation.validity],
                      )}
                    >
                      {citation.validity}
                    </span>
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-caption text-neutral-400">
                每个答案都有出处；若你的权限发生变化，将无法查看该来源。
              </p>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
