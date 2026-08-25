/**
 * Activation 前三个页面共享的页面级小组件：
 * - PrimaryButton / SecondaryButton（design.md §7 Button 规格，Loading 保宽 + Spinner）
 * - DemoModal（「查看 10 分钟演示」占位 Modal）
 * - PageTitle（H1 28px + 副标题 14px）
 * （P1-9：页面级 Toast 实现已删除，全局统一为 sonner —— 见 src/lib/toast.ts 与 App.tsx 的 <Toaster/>）
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CalendarCheck, CloudUpload, FileText, ShieldCheck, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------- Buttons ----------

export interface PrimaryButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  /** 禁用/说明 tooltip */
  title?: string
  /** 大 CTA 渐变 linear-gradient(90deg,#2F74FF,#1E63F4) */
  gradient?: boolean
  className?: string
}

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  loadingText,
  title,
  gradient = false,
  className,
}: PrimaryButtonProps) {
  const blocked = disabled || loading
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={blocked}
      title={title}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-md px-6 text-body font-medium text-white transition-all duration-micro ease-brand',
        gradient
          ? 'bg-[linear-gradient(90deg,#2F74FF,#1E63F4)] hover:brightness-110 active:brightness-95'
          : 'bg-brand-600 hover:bg-brand-500 active:bg-brand-700',
        'focus-visible:shadow-focus focus-visible:outline-none',
        blocked && 'cursor-not-allowed bg-neutral-100 bg-none text-neutral-400 hover:brightness-100',
        className,
      )}
    >
      {loading ? (
        <span className="grid">
          {/* 保宽：以原内容为尺寸基准，Loading 文案叠在同一网格格子上 */}
          <span className="invisible col-start-1 row-start-1 inline-flex items-center gap-2 whitespace-nowrap">
            {children}
          </span>
          <span className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2 whitespace-nowrap">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500" />
            {loadingText ?? children}
          </span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}

export interface SecondaryButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  title?: string
  className?: string
}

export function SecondaryButton({ children, onClick, disabled = false, title, className }: SecondaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-brand-300 bg-white px-4 text-body text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50',
        'focus-visible:shadow-focus focus-visible:outline-none',
        disabled && 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ---------- Demo Modal ----------

/** 分步演示：覆盖 申请 → 配置 → 验证 → 邀请 → 激活 试用旅程 */
const DEMO_STEPS = [
  {
    icon: FileText,
    tone: 'from-brand-500 to-brand-600',
    title: '第 1 步 · 申请试用',
    desc: ['填写企业信息与试用目标，完成手机/邮箱验证后提交申请。', '提交即自动创建你的专属 KnowledgeHub 工作区，全程约 1 分钟。'],
  },
  {
    icon: CloudUpload,
    tone: 'from-cyan to-info',
    title: '第 2 步 · 快速配置',
    desc: ['按场景导入文档、表格与链接等已有资料，系统自动解析并切分知识。', '同时完成知识空间划分与权限继承配置，确保数据安全。'],
  },
  {
    icon: ShieldCheck,
    tone: 'from-success to-cyan',
    title: '第 3 步 · 验证答案',
    desc: ['用真实业务问题向知识助手提问，检查回答是否准确可信。', '每个答案都附带引用来源与信任评分，可一键核对原文。'],
  },
  {
    icon: Users,
    tone: 'from-violet to-brand-500',
    title: '第 4 步 · 邀请同事',
    desc: ['选择团队批量发送试用邀请，支持邮箱/手机号与试用链接两种方式。', '同事加入后即可在各自岗位场景中真实使用知识库。'],
  },
  {
    icon: CalendarCheck,
    tone: 'from-warning to-danger',
    title: '第 5 步 · 激活上线',
    desc: ['7 天试用目标达成后一键激活，资料、知识与助手原地升级为正式对象。', '升级后数据与配置全部保留，团队无缝继续使用。'],
  },
] as const

export function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0)

  // 每次打开回到第 1 步
  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  const current = DEMO_STEPS[step]
  const isFirst = step === 0
  const isLast = step === DEMO_STEPS.length - 1
  const Icon = current.icon

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,24,40,0.4)] p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-h3 text-neutral-950">10 分钟产品演示</h3>
              <button
                type="button"
                onClick={onClose}
                title="关闭"
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 插画区（色块 + 图标） */}
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className={cn('flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br', current.tone)}>
                <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 text-white shadow-float backdrop-blur-sm">
                  <Icon className="h-10 w-10" />
                </span>
              </div>
              <h4 className="mt-4 text-h3 text-neutral-950">{current.title}</h4>
              <div className="mt-2 space-y-1.5">
                {current.desc.map((line) => (
                  <p key={line} className="text-body leading-6 text-neutral-700">
                    {line}
                  </p>
                ))}
              </div>
            </motion.div>

            {/* 进度点 + 上一步/下一步/完成 */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-1.5" role="tablist" aria-label="演示步骤">
                {DEMO_STEPS.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    role="tab"
                    aria-selected={i === step}
                    aria-label={`跳到${s.title}`}
                    onClick={() => setStep(i)}
                    className={cn(
                      'h-2 rounded-pill transition-all duration-micro ease-brand',
                      i === step ? 'w-6 bg-brand-600' : 'w-2 bg-neutral-200 hover:bg-brand-300',
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={isFirst}
                  className={cn(
                    'inline-flex h-10 items-center gap-1 rounded-md border border-neutral-200 bg-white px-4 text-body text-neutral-700 transition-colors duration-micro ease-brand hover:bg-neutral-50',
                    isFirst && 'cursor-not-allowed text-neutral-300 hover:bg-white',
                  )}
                >
                  <ArrowLeft className="h-4 w-4" />
                  上一步
                </button>
                {isLast ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-10 items-center gap-1 rounded-md bg-brand-600 px-5 text-body font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
                  >
                    完成
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.min(DEMO_STEPS.length - 1, s + 1))}
                    className="inline-flex h-10 items-center gap-1 rounded-md bg-brand-600 px-5 text-body font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
                  >
                    下一步
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------- Page Title ----------

export function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-h1 text-neutral-950">{title}</h1>
      <p className="mt-2 text-body text-neutral-500">{subtitle}</p>
    </div>
  )
}

// ================= activation-b 合并部分 =================

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1]

/** Modal — 遮罩 rgba(16,24,40,.4) + 卡片 scale .96→1 + y 8→0（240ms） */
export function Modal({
  open,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="absolute inset-0 bg-[rgba(16,24,40,0.4)]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.24, ease: EASE }}
            className={cn('relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-xl', maxWidth)}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/** Switch — 即时生效二元设置（蓝 = 开启） */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-pill transition-colors duration-micro ease-brand',
        checked ? 'bg-brand-600' : 'bg-neutral-300',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-micro ease-brand',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

/** AssistantBubble — 静态 AI 气泡（用于 timelineFooter 中的结构化内容，样式与 ChatMessage 一致） */
export function AssistantBubble({ children, time }: { children: ReactNode; time?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE }}
      className="flex w-full justify-start"
    >
      <div className="flex max-w-full flex-col items-start">
        <div className="rounded-lg bg-surface-assistant px-3 py-2 text-body text-neutral-800">{children}</div>
        {time && <span className="mt-1 text-caption text-neutral-400">{time}</span>}
      </div>
    </motion.div>
  )
}
