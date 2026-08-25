/**
 * UploadDrawer — 知识库上传抽屉（design/knowledge-base.md §2.4，480px）。
 * UploadZone（dashed #8DB2FF / min-h 160 / 支持拖拽与选择文件）+ 上传队列状态机模拟：
 * QUEUED → UPLOADING（进度推进）→ SCANNING（解析中）→ READY（已就绪），计时器驱动。
 * 含 DUPLICATE（解决重复对比卡）与 LOCKED（行内密码输入）分支；单文件失败不阻塞主 CTA。
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FileUp, FolderUp, Lock, Trash2, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmationCard, ProgressBar, StatusBadge } from '@/components/common'
import { SideDrawer } from '@/pages/workspace/SideDrawer'

export type QueueStatus = 'QUEUED' | 'UPLOADING' | 'SCANNING' | 'READY' | 'DUPLICATE' | 'LOCKED' | 'FAILED'

export interface QueueItem {
  id: number
  name: string
  size: string
  status: QueueStatus
  /** 上传进度 0–100 */
  progress: number
  /** 解析进度 0–100 */
  scan: number
  note?: string
}

const STATUS_LABEL: Record<QueueStatus, string> = {
  QUEUED: '待处理',
  UPLOADING: '上传中',
  SCANNING: '解析中',
  READY: '已就绪',
  DUPLICATE: '待确认重复',
  LOCKED: '需要授权',
  FAILED: '失败',
}

const INITIAL_QUEUE: QueueItem[] = [
  { id: 1, name: '产品手册 2026.pdf', size: '8.2 MB', status: 'READY', progress: 100, scan: 100 },
  { id: 2, name: '渠道价格表.xlsx', size: '1.4 MB', status: 'UPLOADING', progress: 64, scan: 0 },
  { id: 3, name: '旧版报价政策 v1.pdf', size: '2.1 MB', status: 'DUPLICATE', progress: 100, scan: 0, note: '与现有《2024 报价政策》v1.0（2024-03 上传）疑似重复' },
  { id: 4, name: '合同模板（加密）.docx', size: '0.4 MB', status: 'LOCKED', progress: 0, scan: 0, note: '文件已加密，需要密码才能解析' },
]

let queueUid = 100

/** 状态机推进一步（350ms/tick） */
function advance(it: QueueItem): QueueItem {
  switch (it.status) {
    case 'QUEUED':
      return { ...it, status: 'UPLOADING', progress: 0 }
    case 'UPLOADING': {
      const progress = Math.min(100, it.progress + 12)
      return progress >= 100 ? { ...it, progress: 100, status: 'SCANNING', scan: 0 } : { ...it, progress }
    }
    case 'SCANNING': {
      const scan = Math.min(100, it.scan + 25)
      return scan >= 100 ? { ...it, scan: 100, status: 'READY', note: undefined } : { ...it, scan }
    }
    default:
      return it
  }
}

export interface UploadDrawerProps {
  open: boolean
  onClose: () => void
  /** 预填关联文档（上传新版本场景） */
  linkedDoc?: string | null
  onToast: (kind: 'success' | 'info' | 'warning', message: string) => void
}

export function UploadDrawer({ open, onClose, linkedDoc, onToast }: UploadDrawerProps) {
  const [items, setItems] = useState<QueueItem[]>(INITIAL_QUEUE)
  const [dragging, setDragging] = useState(false)
  const [dupResolveFor, setDupResolveFor] = useState<number | null>(null)
  const [passwordFor, setPasswordFor] = useState<number | null>(null)
  const [password, setPassword] = useState('')
  const [applyToBatch, setApplyToBatch] = useState(false)
  const [removed, setRemoved] = useState<QueueItem | null>(null)
  const [confirmPartial, setConfirmPartial] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 队列状态机推进（计时器模拟）
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => {
      setItems((prev) => prev.map(advance))
    }, 350)
    return () => clearInterval(timer)
  }, [open])

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const added: QueueItem[] = [...files].slice(0, 50).map((f) => ({
      id: (queueUid += 1),
      name: f.name,
      size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
      status: 'QUEUED' as const,
      progress: 0,
      scan: 0,
    }))
    setItems((prev) => [...added, ...prev])
    onToast('info', `已加入 ${added.length} 个文件，开始上传`)
  }

  const removeItem = (it: QueueItem) => {
    setItems((prev) => prev.filter((x) => x.id !== it.id))
    setRemoved(it)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setRemoved(null), 2500)
  }

  const undoRemove = () => {
    if (!removed) return
    setItems((prev) => [removed, ...prev])
    setRemoved(null)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
  }

  const resolveDuplicate = (it: QueueItem, choice: 'new-version' | 'keep-both' | 'skip') => {
    setDupResolveFor(null)
    if (choice === 'skip') {
      removeItem(it)
      onToast('info', `已跳过「${it.name}」`)
      return
    }
    setItems((prev) =>
      prev.map((x) =>
        x.id === it.id
          ? { ...x, status: 'SCANNING', scan: 0, note: choice === 'new-version' ? '将替换旧版本并标记为权威版本' : '两个版本均保留' }
          : x,
      ),
    )
    onToast('success', choice === 'new-version' ? '已作为新版本上传，将替换并标记权威' : '已保留两个版本')
  }

  const submitPassword = (it: QueueItem) => {
    if (!password.trim()) return
    setItems((prev) =>
      prev.map((x) =>
        x.id === it.id || (applyToBatch && x.status === 'LOCKED')
          ? { ...x, status: 'QUEUED', note: undefined }
          : x,
      ),
    )
    setPasswordFor(null)
    setPassword('')
    onToast('success', applyToBatch ? '密码已应用到本批加密文件' : '密码验证通过，继续上传')
  }

  const readyCount = items.filter((i) => i.status === 'READY').length
  const processingCount = items.filter((i) => i.status === 'QUEUED' || i.status === 'UPLOADING' || i.status === 'SCANNING').length
  const confirmCount = items.filter((i) => i.status === 'DUPLICATE' || i.status === 'LOCKED' || i.status === 'FAILED').length

  const startUnderstand = () => {
    if (confirmCount > 0) {
      setConfirmPartial(true)
      return
    }
    onToast('success', `已开始理解 ${readyCount} 份资料（模拟）`)
    onClose()
  }

  return (
    <SideDrawer open={open} onClose={onClose} title={linkedDoc ? `上传资料（新版本：${linkedDoc}）` : '上传资料'} width={480}>
      {linkedDoc && (
        <p className="mb-3 rounded-md bg-brand-50 px-3 py-2 text-body-sm text-brand-700">
          新文件将作为「{linkedDoc}」的新版本，上传完成后自动标记为权威版本。
        </p>
      )}

      {/* UploadZone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed px-6 py-6 text-center transition-colors duration-comp ease-brand',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-brand-300 bg-surface-upload',
        )}
      >
        <UploadCloud className="h-8 w-8 text-brand-500" />
        <p className="mt-2 text-body-sm text-neutral-700">拖拽文件到此处，或</p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-3.5 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
          >
            <FileUp className="h-4 w-4" />
            选择文件
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3.5 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
          >
            <FolderUp className="h-4 w-4" />
            选择文件夹
          </button>
        </div>
        <p className="mt-3 text-caption text-neutral-400">
          支持 PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX/TXT/MD/JPG/PNG/HTML，单文件 ≤100MB，单批 ≤50 个
        </p>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        <input
          ref={(el) => {
            folderInputRef.current = el
            if (el) el.setAttribute('webkitdirectory', '')
          }}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {/* 撤销删除条 */}
      <AnimatePresence>
        {removed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-center justify-between rounded-md bg-neutral-800 px-3 py-2 text-body-sm text-white"
          >
            <span className="truncate">已删除「{removed.name}」</span>
            <button type="button" onClick={undoRemove} className="shrink-0 font-medium text-brand-300 hover:text-brand-100">
              撤销
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 文件队列 */}
      <div className="mt-4">
        <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">文件队列（{items.length}）</h4>
        <ul className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.li
                key={it.id}
                layout="position"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  'rounded-lg border p-3',
                  it.status === 'DUPLICATE' ? 'border-warning/50 bg-warning-bg/40' : it.status === 'LOCKED' || it.status === 'FAILED' ? 'border-danger-border bg-danger-bg/40' : 'border-neutral-200 bg-white',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-body-sm text-neutral-900">{it.name}</span>
                  <span className="shrink-0 text-caption text-neutral-400">{it.size}</span>
                  <StatusBadge status={it.status === 'UPLOADING' ? `上传中` : STATUS_LABEL[it.status]} />
                  <button
                    type="button"
                    onClick={() => removeItem(it)}
                    className="shrink-0 text-neutral-400 transition-colors duration-micro ease-brand hover:text-danger"
                    aria-label="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {(it.status === 'UPLOADING' || it.status === 'SCANNING') && (
                  <div className="mt-2 flex items-center gap-2">
                    <ProgressBar
                      value={it.status === 'UPLOADING' ? it.progress : it.scan}
                      className="flex-1"
                      barClassName={it.status === 'SCANNING' ? 'bg-cyan' : undefined}
                    />
                    <span className="w-10 shrink-0 text-right text-caption text-neutral-500">
                      {it.status === 'UPLOADING' ? `${it.progress}%` : `${it.scan}%`}
                    </span>
                  </div>
                )}

                {it.note && it.status !== 'DUPLICATE' && it.status !== 'LOCKED' && (
                  <p className="mt-1.5 text-caption text-neutral-500">{it.note}</p>
                )}

                {/* 重复文件：解决重复对比卡 */}
                {it.status === 'DUPLICATE' && (
                  <div className="mt-2">
                    <p className="text-caption text-warning">{it.note}</p>
                    {dupResolveFor === it.id ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 rounded-md border border-warning/40 bg-white p-3">
                        <div className="grid grid-cols-2 gap-2 text-caption">
                          <div className="rounded-md bg-neutral-50 p-2">
                            <p className="font-semibold text-neutral-800">现有版本</p>
                            <p className="mt-1 text-neutral-500">《2024 报价政策》v1.0</p>
                            <p className="text-neutral-400">2024-03 上传 · 1.2 MB</p>
                          </div>
                          <div className="rounded-md bg-brand-50 p-2">
                            <p className="font-semibold text-neutral-800">新文件</p>
                            <p className="mt-1 text-neutral-500">{it.name}</p>
                            <p className="text-neutral-400">刚刚上传 · {it.size}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => resolveDuplicate(it, 'new-version')} className="h-7 rounded-md bg-brand-600 px-2.5 text-caption font-medium text-white hover:bg-brand-500">
                            作为新版本
                          </button>
                          <button type="button" onClick={() => resolveDuplicate(it, 'keep-both')} className="h-7 rounded-md border border-neutral-200 bg-white px-2.5 text-caption text-neutral-700 hover:border-brand-300">
                            两者保留
                          </button>
                          <button type="button" onClick={() => resolveDuplicate(it, 'skip')} className="h-7 rounded-md border border-neutral-200 bg-white px-2.5 text-caption text-neutral-700 hover:border-brand-300">
                            跳过
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDupResolveFor(it.id)}
                        className="mt-1.5 h-7 rounded-md border border-warning/50 bg-white px-2.5 text-caption font-medium text-warning transition-colors duration-micro ease-brand hover:bg-warning-bg"
                      >
                        解决重复
                      </button>
                    )}
                  </div>
                )}

                {/* 加密文件：行内密码输入 */}
                {it.status === 'LOCKED' && (
                  <div className="mt-2">
                    <p className="flex items-center gap-1 text-caption text-danger">
                      <Lock className="h-3.5 w-3.5" />
                      {it.note}
                    </p>
                    {passwordFor === it.id ? (
                      <div className="mt-2">
                        <div className="flex gap-1.5">
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitPassword(it)
                            }}
                            placeholder="输入文件密码（不回显原文）"
                            className="h-8 flex-1 rounded-md border border-neutral-200 px-2.5 text-body-sm outline-none focus:border-brand-500 focus:shadow-input"
                          />
                          <button
                            type="button"
                            onClick={() => submitPassword(it)}
                            disabled={!password.trim()}
                            className="h-8 rounded-md bg-brand-600 px-3 text-caption font-medium text-white hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
                          >
                            验证并继续
                          </button>
                        </div>
                        <label className="mt-1.5 flex items-center gap-1.5 text-caption text-neutral-500">
                          <input type="checkbox" checked={applyToBatch} onChange={(e) => setApplyToBatch(e.target.checked)} className="h-3.5 w-3.5 accent-brand-600" />
                          应用到本批所有加密文件
                        </label>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPasswordFor(it.id)}
                        className="mt-1.5 h-7 rounded-md border border-danger-border bg-white px-2.5 text-caption font-medium text-danger transition-colors duration-micro ease-brand hover:bg-danger-bg"
                      >
                        输入密码
                      </button>
                    )}
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      {/* 底部摘要条 + 主 CTA */}
      <div className="sticky bottom-0 -mx-5 mt-5 border-t border-neutral-200 bg-white px-5 py-3">
        <p className="text-caption text-neutral-500">
          {`${readyCount} 份资料已就绪 / ${processingCount} 份正在处理 / ${confirmCount} 份需要确认`}
        </p>
        <button
          type="button"
          disabled={readyCount === 0}
          onClick={startUnderstand}
          className="mt-2 h-10 w-full rounded-md bg-brand-600 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700 disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          开始理解这些资料
        </button>
      </div>

      {/* 部分失败确认（不阻塞） */}
      <AnimatePresence>
        {confirmPartial && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(16,24,40,0.4)] p-6"
            onClick={() => setConfirmPartial(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[480px] max-w-full"
            >
              <ConfirmationCard
                title="部分文件未能处理"
                description="部分文件未能处理，可先用已就绪资料建立知识。"
                fields={[
                  { label: '可处理', value: `${readyCount} 份已就绪资料` },
                  { label: '待确认', value: `${confirmCount} 份需要确认（重复 / 加密 / 失败）` },
                  { label: '可撤销性', value: '稍后可在上传队列中继续处理' },
                ]}
                confirmText="先用已就绪资料"
                onConfirm={() => {
                  setConfirmPartial(false)
                  onToast('success', `已开始理解 ${readyCount} 份资料（模拟）`)
                  onClose()
                }}
                onCancel={() => setConfirmPartial(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SideDrawer>
  )
}
