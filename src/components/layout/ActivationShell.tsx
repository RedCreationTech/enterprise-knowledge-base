/**
 * ActivationShell — 试用页共享壳（design.md §6.1；V1.4 起仅 /trial/apply 与 /trial/activated 使用）
 * 1. 64px Header（Logo +「企业知识库」/ 企业切换器 / 帮助中心 / 保存草稿 / 设置 / 头像「张」）
 * 2. 88px JourneyStepper（5 步；支持 extraStep 属性显式插入高亮子步骤）
 * 3. <Outlet/> 主工作区（外边距 24px，max-w-content 居中）
 * 4. 底部安全声明条插槽（footer 属性，默认 SafetyNote）
 *
 * Stepper 状态由 mockStore 的 journey 推导；已完成步骤可点击跳转，未来步骤 cursor-not-allowed + tooltip。
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { Check, ChevronDown, CircleHelp, FileText, Settings, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JOURNEY_STEPS, stepStatusOf, useAppStore } from '@/mocks/store'
import { me, org } from '@/mocks/base.mock'
import { SafetyNote } from '@/components/common/SafetyNote'

export interface ExtraStep {
  title: string
  subtitle?: string
  /** 插入到第几步之后（1 基） */
  afterStep: number
}

export interface ActivationShellProps {
  /** 显式插入高亮子步骤 */
  extraStep?: ExtraStep
  /** 激活交接页等庆祝变体：隐藏 Stepper */
  hideStepper?: boolean
  /** 底部安全声明条插槽；传 null 隐藏 */
  footer?: ReactNode
  children?: ReactNode
}

function UserAvatar() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-body-sm font-semibold text-brand-600">
      {me.avatar}
    </span>
  )
}

function ActivationHeader() {
  const [saved] = useState(true)
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <div className="flex items-center gap-2.5">
        <img src="/logo.svg" alt="企业知识库" className="h-7 w-7 rounded-md" />
        <span className="text-h3 text-neutral-950">企业知识库</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-9 w-[200px] items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300"
        >
          <span className="truncate">{org.name}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
        </button>
        <button type="button" title="帮助中心" className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700">
          <CircleHelp className="h-5 w-5" />
        </button>
        <button
          type="button"
          title={saved ? '已保存' : '正在保存…'}
          className="group relative flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700"
        >
          <FileText className="h-5 w-5" />
          <span className="pointer-events-none absolute -bottom-7 whitespace-nowrap rounded-sm bg-neutral-950 px-1.5 py-0.5 text-caption text-white opacity-0 transition-opacity duration-micro group-hover:opacity-100">
            {saved ? '已保存' : '正在保存…'}
          </span>
        </button>
        <button type="button" title="设置" className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700">
          <Settings className="h-5 w-5" />
        </button>
        <UserAvatar />
      </div>
    </header>
  )
}

interface StepNode {
  key: string
  title: string
  subtitle?: string
  path?: string
  status: 'done' | 'current' | 'todo' | 'extra'
}

function JourneyStepper({ extraStep }: { extraStep?: ExtraStep }) {
  const { state } = useAppStore()
  const navigate = useNavigate()

  // V1.3/V1.4：安装应用/每日待办 special-case 为工作台新路由并带 ?from=trial；快速配置/邀请同事的 path 已直接指向工作台新路由（含 ?from=trial）
  const nodes: StepNode[] = JOURNEY_STEPS.map((s, i) => ({
    key: s.key,
    title: s.title,
    subtitle: s.subtitle,
    path:
      s.key === 'apps'
        ? '/workspace/apps?from=trial'
        : s.key === 'daily'
          ? '/workspace/daily?from=trial'
          : s.path,
    status: stepStatusOf(state.journey, i),
  }))
  if (extraStep) {
    nodes.splice(extraStep.afterStep, 0, {
      key: 'extra',
      title: extraStep.title,
      subtitle: extraStep.subtitle,
      status: 'extra',
    })
  }

  return (
    <div className="flex h-18 items-center justify-center border-b border-neutral-200 bg-white px-6">
      <ol className="flex items-center">
        {nodes.map((node, i) => {
          const clickable = node.status === 'done' && node.path
          const isExtra = node.status === 'extra'
          return (
            <li key={node.key} className="flex items-center">
              {i > 0 && (
                <span
                  className={cn(
                    'mx-3 h-px w-10 border-t border-dashed md:w-14',
                    nodes[i - 1].status === 'done' || isExtra ? 'border-brand-300' : 'border-neutral-200',
                  )}
                />
              )}
              <button
                type="button"
                disabled={!clickable}
                title={node.status === 'todo' ? '请先完成当前步骤' : undefined}
                onClick={() => clickable && navigate(node.path!)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-1 py-1 text-left',
                  clickable && 'transition-colors duration-micro ease-brand hover:bg-brand-50',
                  node.status === 'todo' && 'cursor-not-allowed',
                  !clickable && node.status !== 'todo' && 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-body-sm font-semibold',
                    node.status === 'done' && 'bg-brand-600 text-white',
                    node.status === 'current' && 'bg-brand-600 text-white',
                    node.status === 'todo' && 'border border-neutral-300 bg-white text-neutral-500',
                    isExtra && 'bg-brand-100 text-brand-600',
                  )}
                >
                  {node.status === 'done' ? (
                    <Check className="h-4 w-4" />
                  ) : isExtra ? (
                    <Star className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span>
                  <span
                    className={cn(
                      'block whitespace-nowrap text-body',
                      (node.status === 'done' || isExtra) && 'text-brand-600',
                      node.status === 'current' && 'font-semibold text-brand-600',
                      node.status === 'todo' && 'text-neutral-500',
                    )}
                  >
                    {node.title}
                  </span>
                  {node.subtitle && (
                    <span className={cn('block whitespace-nowrap text-caption', node.status === 'current' ? 'text-brand-500' : 'text-neutral-500')}>
                      {node.subtitle}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function ActivationShell({ extraStep, hideStepper = false, footer, children }: ActivationShellProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-page">
      <ActivationHeader />
      {!hideStepper && <JourneyStepper extraStep={extraStep} />}
      <main className="mx-auto w-full max-w-content flex-1 px-6 py-6">{children ?? <Outlet />}</main>
      {footer !== null && (
        <footer className="pb-5">{footer ?? <SafetyNote />}</footer>
      )}
    </div>
  )
}
