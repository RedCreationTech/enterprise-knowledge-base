/** Composer — 多行输入 + 左下回形针「上传文件」+ 右侧 36–40px 方形蓝色发送按钮（白飞机图标） */
import { useState } from 'react'
import { Paperclip, SendHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComposerProps {
  placeholder?: string
  onSend: (text: string) => void
  onUpload?: () => void
  className?: string
}

export function Composer({ placeholder = '输入你的问题，或描述当前任务…', onSend, onUpload, className }: ComposerProps) {
  const [text, setText] = useState('')

  const send = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  return (
    <div className={cn('rounded-lg border border-[#DCE4EF] bg-white focus-within:border-brand-500 focus-within:shadow-input', className)}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            send()
          }
        }}
        rows={2}
        placeholder={placeholder}
        className="w-full resize-none rounded-t-lg bg-transparent px-3 pt-2.5 text-body text-neutral-800 outline-none placeholder:text-neutral-400"
      />
      <div className="flex items-center justify-between px-2 pb-2">
        <button
          type="button"
          onClick={onUpload}
          title="上传文件"
          className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-brand-600"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={send}
          disabled={!text.trim()}
          title="发送"
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-micro ease-brand',
            text.trim()
              ? 'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700'
              : 'cursor-not-allowed bg-neutral-100 text-neutral-400',
          )}
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
