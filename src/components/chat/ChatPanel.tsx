/**
 * ChatPanel — 小知对话面板（design.md §6.1 共享规格）：
 * 身份栏（头像 + 智能助手小知 + AI pill + 在线）→ 消息时间线（独立滚动）→ QuickChips → Composer。
 * 消息来自全局共享会话（useAppStore），跨页持久；发送后自动触发模拟 AI 回复。
 * 身份栏操作：语音播报（speechSynthesis 朗读最近一条 AI 消息，再点停止）/
 * 更多菜单（清空本页对话、导出对话记录 .txt 下载）。
 * Composer 回形针：真实文件选择，选中后插入用户附件消息 + AI 确认回复（带 page）。
 */
import { useEffect, useRef, useState } from 'react'
import { Download, Eraser, MoreHorizontal, Square, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/mocks/store'
import { useAppToast } from '@/lib/toast'
import { ChatMessage } from './ChatMessage'
import { Composer } from './Composer'
import { QuickChips } from './QuickChips'

export interface ChatPanelProps {
  /** 快捷回复 chips；点击即以用户消息发送 */
  chips?: string[]
  selectedChip?: string | null
  onChipSelect?: (chip: string) => void
  composerPlaceholder?: string
  /** 额外插入消息时间线尾部（如里程碑摘要卡） */
  timelineFooter?: React.ReactNode
  /** 面板归属页面路径：composer / 附件消息写入该 page；清空与导出按该 page 过滤 */
  page?: string
  className?: string
}

export function ChatPanel({ chips = [], selectedChip = null, onChipSelect, composerPlaceholder, timelineFooter, page, className }: ChatPanelProps) {
  const { state, pushMessage, clearPageMessages } = useAppStore()
  const toast = useAppToast()
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [state.chatMessages.length])

  // 卸载时停止播报，避免页面切换后仍出声
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  // 更多菜单：点击外部关闭
  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  const handleChip = (chip: string) => {
    if (onChipSelect) onChipSelect(chip)
    else pushMessage('user', chip, page)
  }

  /** 语音播报：朗读最近一条 AI 消息；朗读中再点停止 */
  const toggleSpeak = () => {
    if (!('speechSynthesis' in window)) {
      toast.warning('当前浏览器不支持语音播报')
      return
    }
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const lastAi = [...state.chatMessages].reverse().find((m) => m.role === 'assistant')
    if (!lastAi) {
      toast.info('暂无可播报的 AI 消息')
      return
    }
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(lastAi.content)
    utter.lang = 'zh-CN'
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utter)
  }

  /** 清空本页对话（按 page 过滤；无 page 时清无页面标记的消息） */
  const handleClear = () => {
    setMenuOpen(false)
    const count = state.chatMessages.filter((m) => m.page === page).length
    if (count === 0) {
      toast.info('本页暂无可清空的对话')
      return
    }
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
    }
    clearPageMessages(page)
    toast.success('已清空本页对话')
  }

  /** 导出对话记录：生成 .txt Blob 真实下载 */
  const handleExport = () => {
    setMenuOpen(false)
    const list = page ? state.chatMessages.filter((m) => m.page === page) : state.chatMessages
    if (list.length === 0) {
      toast.info('当前没有可导出的对话')
      return
    }
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const body = list
      .map((m) => `[${m.time}] ${m.role === 'assistant' ? '小知' : '我'}：${m.content}`)
      .join('\n\n')
    const content = `企业知识库 · 对话记录\n导出时间：${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}\n共 ${list.length} 条消息\n${'='.repeat(32)}\n\n${body}\n`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `对话记录-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success('对话记录已导出')
  }

  /** 回形针上传：选中文件后插入用户附件消息（store 自动补 AI 确认回复，带 page） */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    pushMessage('user', `📎 已上传附件：${file.name}`, page)
  }

  return (
    <div
      className={cn(
        'flex w-full flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-card',
        className,
      )}
    >
      {/* 身份栏 */}
      <div className="flex items-center gap-2.5 border-b border-neutral-100 pb-3">
        <img src="/avatar-xiaozhi.svg" alt="小知" className="h-8 w-8 rounded-md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-body font-semibold text-neutral-950">智能助手小知</span>
            <span className="inline-flex h-4 items-center rounded-sm bg-brand-100 px-1 text-[10px] font-semibold leading-none text-brand-600">
              AI
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-caption text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            在线
          </div>
        </div>
        <button
          type="button"
          onClick={toggleSpeak}
          title={speaking ? '停止播报' : '语音播报'}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-micro ease-brand hover:bg-neutral-100',
            speaking ? 'text-brand-600' : 'text-neutral-400 hover:text-neutral-700',
          )}
        >
          {speaking ? <Square className="h-3.5 w-3.5 fill-current" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="更多"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700',
              menuOpen ? 'bg-neutral-100 text-neutral-700' : 'text-neutral-400',
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-40 rounded-md border border-neutral-200 bg-white py-1 shadow-float">
              <button
                type="button"
                onClick={handleClear}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:bg-neutral-50"
              >
                <Eraser className="h-3.5 w-3.5 text-neutral-400" />
                清空本页对话
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:bg-neutral-50"
              >
                <Download className="h-3.5 w-3.5 text-neutral-400" />
                导出对话记录
              </button>
            </div>
          )}
        </div>
      </div>
      {/* 消息时间线（面板内唯一滚动容器） */}
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-4 pr-1">
        {state.chatMessages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {timelineFooter}
      </div>
      {/* 快捷回复 */}
      {chips.length > 0 && <QuickChips chips={chips} selected={selectedChip} onSelect={handleChip} className="pb-3" />}
      {/* Composer */}
      <Composer
        placeholder={composerPlaceholder}
        onSend={(text) => pushMessage('user', text, page)}
        onUpload={() => fileInputRef.current?.click()}
      />
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} aria-hidden="true" />
    </div>
  )
}
