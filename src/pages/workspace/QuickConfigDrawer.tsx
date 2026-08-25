/**
 * QuickConfigDrawer — 工作台「快速配置」560px Drawer（design/dashboard.md V1.1 增补 §B）
 * 与 /workspace/quick-config 同源派生（quickConfigSummary：本地上传 106 份✓ / 连接 2/4 / 权限 402 人·94%✓ / 3 个答案待验证 / 完成度 75%）。
 * 步内操作：上传（抽屉内迷你上传，106→107）/ 连接（跳 data-sources）/ 权限详情（跳 permissions）/ 去验证（跳 ai-assistant）。
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { AlertTriangle, Check, ChevronRight, RefreshCw, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProgressRing } from '@/components/common'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import type { AppToastKind } from '@/lib/toast'
import { LOCAL_UPLOAD_BASE, LOCAL_UPLOAD_EVENT, LOCAL_UPLOAD_KEY, readLocalUploads } from './quickConfigUploads'

export interface QuickConfigDrawerProps {
  open: boolean
  onClose: () => void
  push: (kind: AppToastKind, message: string) => void
}

type StepState = 'COMPLETE' | 'IN_PROGRESS' | 'BLOCKED' | 'NOT_STARTED'

function StepDot({ state, index }: { state: StepState; index: number }) {
  if (state === 'COMPLETE') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
        <Check className="h-4 w-4" />
      </span>
    )
  }
  if (state === 'BLOCKED') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning text-white">
        <AlertTriangle className="h-4 w-4" />
      </span>
    )
  }
  return (
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-body-sm font-semibold',
        state === 'IN_PROGRESS' ? 'bg-brand-600 text-white' : 'border border-neutral-300 bg-white text-neutral-500',
      )}
    >
      {index}
    </span>
  )
}

export function QuickConfigDrawer({ open, onClose, push }: QuickConfigDrawerProps) {
  const navigate = useNavigate()
  /** 本地上传增量（localStorage 持久，跨刷新保留） */
  const [extra, setExtra] = useState(readLocalUploads)
  const [miniUploadOpen, setMiniUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const uploadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const uploaded = LOCAL_UPLOAD_BASE + extra

  useEffect(() => {
    return () => {
      if (uploadTimer.current) clearTimeout(uploadTimer.current)
    }
  }, [])

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  const simulateUpload = () => {
    if (uploading) return
    setUploading(true)
    uploadTimer.current = setTimeout(() => {
      setUploading(false)
      const next = readLocalUploads() + 1
      try {
        localStorage.setItem(LOCAL_UPLOAD_KEY, String(next))
      } catch {
        // 存储不可用时仅本次会话生效
      }
      setExtra(next)
      // 通知工作台「数据接入状态」等同源摘要实时 +1
      window.dispatchEvent(new Event(LOCAL_UPLOAD_EVENT))
      push('success', '已上传 1 份资料，解析完成后自动进入知识库')
    }, 1200)
  }

  const stepBadge = (text: string, tone: 'success' | 'info' | 'warning') => (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-pill px-2 text-caption font-medium',
        tone === 'success' && 'bg-success-bg text-success',
        tone === 'info' && 'bg-info-bg text-info',
        tone === 'warning' && 'bg-warning-bg text-warning',
      )}
    >
      {text}
    </span>
  )

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      width={560}
      title={
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-h3 text-neutral-950">快速配置</p>
            <p className="text-caption font-normal text-neutral-400">与试用配置流程同步，随时补齐企业知识</p>
          </div>
          <Link
            to="/workspace/quick-config"
            onClick={onClose}
            className="shrink-0 text-body-sm font-normal text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
          >
            打开完整配置页 ›
          </Link>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ProgressRing value={75} size={56} strokeWidth={6} />
            <div>
              <p className="text-body-sm font-semibold text-neutral-950">配置完成度 75%</p>
              <p className="text-caption text-neutral-400">还差连接系统与答案验证</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => go('/workspace/quick-config')}
            className="h-10 shrink-0 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
          >
            完成剩余配置
          </button>
        </div>
      }
    >
      <div className="flex flex-col divide-y divide-neutral-100">
        {/* 步骤 1：上传资料 */}
        <section className="py-4 first:pt-1">
          <div className="flex items-start gap-3">
            <StepDot state="COMPLETE" index={1} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-body font-semibold text-neutral-950">上传资料</h4>
                {stepBadge('已完成', 'success')}
              </div>
              <p className="mt-1 text-body-sm text-neutral-500">
                本地上传 {uploaded} 份资料，最近 {uploaded > 106 ? '刚刚' : '05-15 18:32'}
              </p>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setMiniUploadOpen((v) => !v)}
                  className="text-body-sm font-medium text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
                >
                  {miniUploadOpen ? '收起上传区 ↑' : '继续上传'}
                </button>
              </div>
              {miniUploadOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300 bg-surface-upload p-4">
                    <Upload className="h-6 w-6 text-brand-500" />
                    <p className="text-body-sm text-neutral-700">拖拽文件到此处，或</p>
                    <button
                      type="button"
                      onClick={simulateUpload}
                      disabled={uploading}
                      className="h-9 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
                    >
                      {uploading ? '正在上传…' : '选择文件'}
                    </button>
                    <p className="text-caption text-neutral-400">支持 PDF / Word / Excel / Markdown，单个 ≤50MB</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </section>

        {/* 步骤 2：连接系统 */}
        <section className="py-4">
          <div className="flex items-start gap-3">
            <StepDot state="IN_PROGRESS" index={2} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-body font-semibold text-neutral-950">连接系统</h4>
                {stepBadge('进行中 · 2/4', 'info')}
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {[
                  { name: '企业网盘', connected: true },
                  { name: '飞书文档', connected: true },
                  { name: '钉钉文档', connected: false },
                  { name: '企业微信', connected: false },
                ].map((c) => (
                  <li key={c.name} className="flex items-center gap-2 text-body-sm">
                    <span className={cn('h-1.5 w-1.5 rounded-full', c.connected ? 'bg-success' : 'bg-neutral-300')} />
                    <span className="text-neutral-800">{c.name}</span>
                    <span className={cn('text-caption', c.connected ? 'text-success' : 'text-neutral-400')}>
                      {c.connected ? '已连接' : '未连接'}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => go('/workspace/data-sources')}
                  className="h-9 rounded-md border border-neutral-200 bg-white px-3.5 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
                >
                  连接钉钉文档
                </button>
                <button
                  type="button"
                  onClick={() => go('/workspace/data-sources')}
                  className="h-9 rounded-md border border-neutral-200 bg-white px-3.5 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
                >
                  连接企业微信
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 步骤 3：权限同步 */}
        <section className="py-4">
          <div className="flex items-start gap-3">
            <StepDot state="COMPLETE" index={3} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-body font-semibold text-neutral-950">权限同步</h4>
                {stepBadge('已完成', 'success')}
              </div>
              <p className="mt-1 text-body-sm text-neutral-500">按组织架构 + 空间权限同步 · 上次同步 昨天 18:20</p>
              <div className="mt-2 flex items-center gap-2.5">
                <div className="h-2 flex-1 overflow-hidden rounded-pill bg-brand-100">
                  <div className="h-full rounded-pill bg-brand-500" style={{ width: '94%' }} />
                </div>
                <span className="shrink-0 text-caption text-neutral-500">ACL 覆盖 402 人 · 94%</span>
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => go('/workspace/permissions')}
                  className="text-body-sm font-medium text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
                >
                  权限同步详情 ›
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 步骤 4：生成答案 */}
        <section className="py-4 last:pb-1">
          <div className="flex items-start gap-3">
            <StepDot state="BLOCKED" index={4} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-body font-semibold text-neutral-950">生成答案</h4>
                {stepBadge('待验证 · 3 个问题未确认', 'warning')}
              </div>
              <p className="mt-1 text-body-sm text-neutral-500">3 个新答案等待确认正确，确认后即可向团队开放</p>
              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={() => go('/workspace/ai-assistant')}
                  className="inline-flex h-9 items-center gap-1 rounded-md bg-brand-600 px-3.5 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
                >
                  去验证答案
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface-soft p-3">
        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
        <p className="text-caption leading-5 text-neutral-500">
          本面板与工作台「数据接入状态」同源；在此处完成的上传与连接会实时同步到看板数字。
        </p>
      </div>
    </SideDrawer>
  )
}
