/**
 * HeaderSearch — Header 全局搜索（V1.3 修复：真实可用的分组搜索浮层）
 * - onFocus / onChange 打开浮层：结果按 文档 / 问题 / 应用 三组展示，includes 关键字过滤，无结果给空态。
 * - 点条目跳转对应模块并关闭清空；Esc / 外部点击关闭。
 * - data-tour="global-search" 锚点保留在输入框容器上（ProductTour 聚光定位用）。
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Blocks, FolderOpen, MessagesSquare, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface SearchResult {
  id: string
  title: string
  meta: string
  path: string
}

interface SearchGroup {
  key: string
  label: string
  icon: LucideIcon
  items: SearchResult[]
}

const MOCK_GROUPS: SearchGroup[] = [
  {
    key: 'docs',
    label: '文档',
    icon: FolderOpen,
    items: [
      { id: 'd1', title: '销售管理制度', meta: 'v2.1 · 2024-05-10 更新', path: '/workspace/knowledge-base' },
      { id: 'd2', title: '价格管理办法', meta: 'v1.4 · 2024-04-28 更新', path: '/workspace/knowledge-base' },
      { id: 'd3', title: '差旅报销流程', meta: 'v3.0 · 2024-03-15 更新', path: '/workspace/knowledge-base' },
    ],
  },
  {
    key: 'questions',
    label: '问题',
    icon: MessagesSquare,
    items: [
      { id: 'q1', title: '折扣超过 10% 需要谁审批？', meta: 'AI 助手 · 含 2 条引用', path: '/workspace/ai-assistant' },
      { id: 'q2', title: '新客户首单可以赊销吗？', meta: 'AI 助手 · 含 1 条引用', path: '/workspace/ai-assistant' },
    ],
  },
  {
    key: 'apps',
    label: '应用',
    icon: Blocks,
    items: [
      { id: 'a1', title: '企业微信问答插件', meta: '应用中心 · 已安装', path: '/workspace/apps' },
    ],
  },
]

export function HeaderSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Esc / 外部点击关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const kw = query.trim()
  const groups = MOCK_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => !kw || it.title.includes(kw) || it.meta.includes(kw)),
  })).filter((g) => g.items.length > 0)

  const go = (path: string) => {
    setOpen(false)
    setQuery('')
    navigate(path)
  }

  return (
    <div ref={rootRef} className="relative w-[460px] max-w-full">
      <div
        data-tour="global-search"
        className="flex h-9 w-full items-center gap-2 rounded-md border border-neutral-200 bg-surface-page px-3 transition-shadow duration-micro ease-brand focus-within:border-brand-500 focus-within:bg-white focus-within:shadow-input"
      >
        <Search className="h-4 w-4 shrink-0 text-neutral-400" />
        <input
          type="text"
          value={query}
          placeholder="搜索文档、问题、成员…"
          aria-label="全局搜索"
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          className="w-full bg-transparent text-body-sm text-neutral-800 outline-none placeholder:text-neutral-400"
        />
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="搜索结果"
          className="absolute left-1/2 top-full z-[50] mt-2 max-h-[360px] w-[520px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-2 shadow-float"
        >
          {groups.length === 0 ? (
            <p className="px-4 py-6 text-center text-body-sm text-neutral-400">未找到相关内容</p>
          ) : (
            groups.map((g) => (
              <div key={g.key} className="px-2 py-1">
                <p className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-caption font-medium text-neutral-500">
                  <g.icon className="h-3.5 w-3.5" />
                  {g.label}
                </p>
                <ul>
                  {g.items.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => go(it.path)}
                        className="flex w-full flex-col rounded-md px-2 py-1.5 text-left transition-colors duration-micro ease-brand hover:bg-brand-50 focus-visible:bg-brand-50 focus-visible:outline-none"
                      >
                        <span className="text-body-sm text-neutral-800">{it.title}</span>
                        <span className="text-caption text-neutral-400">{it.meta}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
