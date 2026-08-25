/**
 * NotificationsMenu — Header 通知铃铛（V1.3 修复：真实可用的通知浮层）
 * - 未读红点 = 未读条数 > 0；点开浮层查看列表，未读条目带蓝点。
 * - 顶部「全部已读」一键清除未读；点条目跳「每日待办」并关闭。
 * - Esc / 外部点击关闭；data-tour="notifications" 锚点保留在铃铛按钮上。
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notice {
  id: string
  text: string
  time: string
  unread: boolean
}

const MOCK_NOTICES: Notice[] = [
  { id: 'n1', text: '李娜完成了《价格管理办法》确认', time: '10 分钟前', unread: true },
  { id: 'n2', text: '3 条反馈待审核', time: '1 小时前', unread: true },
  { id: 'n3', text: '知识库每日同步已完成', time: '今天 09:30', unread: true },
  { id: 'n4', text: '「每日待办」新增 2 项数据核对任务', time: '昨天 18:12', unread: false },
  { id: 'n5', text: '王强申请加入「销售部」知识空间', time: '昨天 15:40', unread: false },
  { id: 'n6', text: '企业网盘连接状态恢复正常', time: '周一 11:05', unread: false },
]

export function NotificationsMenu() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notices, setNotices] = useState(MOCK_NOTICES)
  const rootRef = useRef<HTMLDivElement>(null)
  const unreadCount = notices.filter((n) => n.unread).length

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

  const markAllRead = () => setNotices((list) => list.map((n) => ({ ...n, unread: false })))
  const openItem = (id: string) => {
    setNotices((list) => list.map((n) => (n.id === id ? { ...n, unread: false } : n)))
    setOpen(false)
    navigate('/workspace/daily')
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="通知"
        data-tour="notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `通知，${unreadCount} 条未读` : '通知'}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:shadow-focus"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="通知列表"
          className="absolute right-0 top-full z-[50] mt-2 max-h-[380px] w-[340px] overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-float"
        >
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
            <p className="text-body-sm font-semibold text-neutral-950">通知</p>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-caption text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500 disabled:cursor-default disabled:text-neutral-300"
            >
              全部已读
            </button>
          </div>
          <ul>
            {notices.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openItem(n.id)}
                  className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors duration-micro ease-brand hover:bg-brand-50 focus-visible:bg-brand-50 focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      n.unread ? 'bg-brand-600' : 'bg-transparent',
                    )}
                  />
                  <span className="min-w-0">
                    <span className={cn('block truncate text-body-sm', n.unread ? 'font-medium text-neutral-950' : 'text-neutral-700')}>
                      {n.text}
                    </span>
                    <span className="mt-0.5 block text-caption text-neutral-400">{n.time}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
