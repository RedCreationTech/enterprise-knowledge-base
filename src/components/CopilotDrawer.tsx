/**
 * CopilotDrawer — Workspace 全局 AI Copilot：400px 右滑 Drawer（240ms），复用 Chat 组件族。
 * 顶部展示「AI 正在使用的上下文」（可移除）。会话独立于试用旅程共享会话。
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { Composer } from '@/components/chat/Composer'
import { QuickChips } from '@/components/chat/QuickChips'
import type { ChatMessage as ChatMessageModel } from '@/mocks/store'

export interface CopilotDrawerProps {
  open: boolean
  onClose: () => void
  /** 初始上下文标签，如当前页面/知识空间 */
  defaultContexts?: string[]
}

let copilotUid = 0
function nextId() {
  copilotUid += 1
  return `copilot-${copilotUid}`
}

function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const GREETING = '我是全局 AI Copilot，可以基于当前页面与企业知识帮你查询、总结与起草。'

export function CopilotDrawer({ open, onClose, defaultContexts = ['当前页面', '全部知识空间'] }: CopilotDrawerProps) {
  const [contexts, setContexts] = useState<string[]>(defaultContexts)
  const [messages, setMessages] = useState<ChatMessageModel[]>([
    { id: nextId(), role: 'assistant', content: GREETING, time: nowTime() },
  ])
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, open])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const send = (text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text, time: nowTime() }])
    timerRef.current = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          content: contexts.length > 0
            ? `已基于「${contexts.join('、')}」为你检索。这是一个模拟回复：正式回答会附引用来源与可信度，你可以继续追问。`
            : '请先保留至少一个上下文，我才能给出有出处的回答。',
          time: nowTime(),
        },
      ])
    }, 700)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="copilot-mask"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-0 z-40 bg-[rgba(16,24,40,0.4)]"
            onClick={onClose}
          />
          <motion.aside
            key="copilot-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col border-l border-neutral-200 bg-white shadow-float"
            role="dialog"
            aria-label="AI Copilot"
          >
            {/* 头部 */}
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-bg text-violet">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-neutral-950">AI Copilot</p>
                <p className="text-caption text-neutral-500">全局可信问答与起草</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                title="关闭"
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* AI 正在使用的上下文（可移除） */}
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="mb-2 text-caption text-neutral-500">AI 正在使用的上下文</p>
              <div className="flex flex-wrap gap-1.5">
                {contexts.map((c) => (
                  <span
                    key={c}
                    className="inline-flex h-7 items-center gap-1 rounded-pill bg-brand-50 pl-2.5 pr-1 text-caption text-brand-700"
                  >
                    {c}
                    <button
                      type="button"
                      title={`移除上下文 ${c}`}
                      onClick={() => setContexts((prev) => prev.filter((x) => x !== c))}
                      className={cn(
                        'flex h-[18px] w-[18px] items-center justify-center rounded-full text-brand-300 hover:bg-brand-100 hover:text-brand-600',
                      )}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {contexts.length === 0 && (
                  <span className="text-caption text-neutral-400">暂无上下文，回答将不带引用</span>
                )}
              </div>
            </div>
            {/* 消息 */}
            <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}
            </div>
            <div className="border-t border-neutral-100 p-3">
              <QuickChips
                chips={['总结本页要点', '查询使用数据', '起草一条公告']}
                onSelect={send}
                className="pb-2"
              />
              <Composer placeholder="向 Copilot 提问…" onSend={send} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
