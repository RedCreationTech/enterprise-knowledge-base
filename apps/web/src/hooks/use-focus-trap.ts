import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * 弹层焦点陷阱（复用 ProductTour 的焦点锁模式，见 src/components/tour/ProductTour.tsx §6）：
 * - 打开瞬间保存 document.activeElement 作为触发源；
 * - 焦点移入弹层容器（容器需 tabIndex=-1），Tab / Shift+Tab 循环被限制在容器内；
 * - 关闭时焦点归还触发元素（元素仍在文档中时）。
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null,
  )
}

export function useFocusTrap<T extends HTMLElement>(open: boolean, containerRef: RefObject<T | null>) {
  const triggerRef = useRef<HTMLElement | null>(null)
  const prevOpenRef = useRef(false)

  // 打开瞬间保存触发元素（false→true 边沿）
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
    prevOpenRef.current = open
  }, [open])

  // 焦点移入：等待进场动画挂载后，若焦点尚在弹层外则聚焦容器
  useEffect(() => {
    if (!open) return
    const container = containerRef.current
    if (!container) return
    const timer = setTimeout(() => {
      if (!container.contains(document.activeElement)) container.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [open, containerRef])

  // Tab 焦点陷阱（capture，镜像 ProductTour 的 first/last + shift 分支）
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const container = containerRef.current
      if (!container) return
      const current = document.activeElement as HTMLElement | null
      const focusables = getFocusables(container)
      if (focusables.length === 0) {
        // 无子可聚焦元素：焦点锁在容器本身
        e.preventDefault()
        if (current !== container) container.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const atBoundary = !current || current === container || !container.contains(current)
      if (e.shiftKey) {
        if (atBoundary || current === first) {
          e.preventDefault()
          last.focus()
        }
      } else if (atBoundary || current === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, containerRef])

  // 关闭时焦点归还触发元素
  useEffect(() => {
    if (open) return
    const trigger = triggerRef.current
    if (!trigger) return
    const timer = setTimeout(() => {
      if (document.contains(trigger)) trigger.focus()
      triggerRef.current = null
    }, 0)
    return () => clearTimeout(timer)
  }, [open])
}
