/**
 * UserMenu — Header 头像个人菜单（V1.3 修复：<span> 升级为真实可用的菜单按钮）
 * - 按钮 aria-haspopup="menu" + 键盘可达 + focus-visible 焦点环。
 * - 菜单：个人信息区 + 「设置中心」/「重新观看新手引导」（ekb:start-tour 事件）/「退出登录」（mock）。
 * - Esc / 外部点击关闭；data-tour="user-menu" 锚点保留在头像按钮上。
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { LogOut, RotateCcw, Settings } from 'lucide-react'
import { me } from '@/mocks'

// 与 ProductTour.TOUR_START_EVENT 同值；此处写字面量以避免 layout → tour 的循环依赖
const TOUR_START_EVENT = 'ekb:start-tour'

export function UserMenu() {
  const navigate = useNavigate()
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

  const go = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="个人菜单"
        data-tour="user-menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-body-sm font-semibold text-brand-600 transition-shadow duration-micro ease-brand hover:shadow-focus focus-visible:outline-none focus-visible:shadow-focus"
      >
        {me.avatar}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="个人菜单"
          className="absolute right-0 top-full z-[50] mt-2 w-[240px] rounded-lg border border-neutral-200 bg-white py-1 shadow-float"
        >
          {/* 个人信息区 */}
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-body-sm font-semibold text-neutral-950">
              {me.name} · {me.role === 'org_admin' ? '管理员' : '成员'}
            </p>
            <p className="mt-0.5 truncate text-caption text-neutral-500">{me.email}</p>
          </div>
          <ul className="py-1">
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => go('/workspace/settings')}
                className="flex h-9 w-full items-center gap-2.5 px-4 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:bg-brand-50 hover:text-neutral-950 focus-visible:bg-brand-50 focus-visible:outline-none"
              >
                <Settings className="h-4 w-4 shrink-0 text-neutral-400" />
                设置中心
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  window.dispatchEvent(new Event(TOUR_START_EVENT))
                }}
                className="flex h-9 w-full items-center gap-2.5 px-4 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:bg-brand-50 hover:text-neutral-950 focus-visible:bg-brand-50 focus-visible:outline-none"
              >
                <RotateCcw className="h-4 w-4 shrink-0 text-neutral-400" />
                重新观看新手引导
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  // mock：未接真实登出流程，仅关闭菜单并回到工作台
                  go('/workspace/dashboard')
                }}
                className="flex h-9 w-full items-center gap-2.5 px-4 text-body-sm text-danger transition-colors duration-micro ease-brand hover:bg-danger-bg focus-visible:bg-danger-bg focus-visible:outline-none"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                退出登录
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
