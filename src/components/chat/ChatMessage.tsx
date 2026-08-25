/** ChatMessage — AI 气泡（#F3F6FA / #25324A / 左对齐）与用户气泡（#EAF2FF / #174FCF / 右对齐 ≤75% + 「张」头像 + 蓝色双勾） */
import { CheckCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { me } from '@/mocks/base.mock'
import type { ChatMessage as ChatMessageModel } from '@/mocks/store'

export function ChatMessage({ message }: { message: ChatMessageModel }) {
  const isUser = message.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn('flex w-full gap-2', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={cn('flex max-w-full flex-col', isUser ? 'items-end' : 'items-start')}>
        <div className={cn('flex items-end gap-2', isUser && 'flex-row-reverse')}>
          <div
            className={cn(
              'rounded-lg px-3 py-2 text-body',
              isUser
                ? 'max-w-[75%] bg-surface-user text-brand-700'
                : 'bg-surface-assistant text-neutral-800',
            )}
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          {isUser && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-body-sm font-semibold text-brand-600">
              {me.avatar}
            </span>
          )}
        </div>
        <span className={cn('mt-1 flex items-center gap-1 text-caption text-neutral-400', isUser && 'flex-row-reverse')}>
          {message.time}
          {isUser && <CheckCheck className="h-3.5 w-3.5 text-brand-500" />}
        </span>
      </div>
    </motion.div>
  )
}
