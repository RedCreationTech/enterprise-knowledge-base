/**
 * NoAnswerCard — 拒答卡（ai-assistant.md §2.2-5 / design.md §7 Empty/NoAnswer）：
 * 白卡 + 红左条（2px danger）：未找到可靠答案 + 已检索范围 + 缺失类型 + 最接近主题 + 下一步 3 动作。
 */
import { motion } from 'framer-motion'
import { CircleAlert, FileSearch, RotateCcw, Upload, UserPlus } from 'lucide-react'
import type { RefusalData } from './aiAssistant.mock'

export interface NoAnswerCardProps {
  data: RefusalData
  onUpload?: () => void
  onAssign?: () => void
  onRephrase?: () => void
}

export function NoAnswerCard({ data, onUpload, onAssign, onRephrase }: NoAnswerCardProps) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-card">
      {/* 红左条先绘（width 0→2px 180ms） */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 3 }}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        className="shrink-0 bg-danger"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, delay: 0.12 }}
        className="min-w-0 flex-1 p-5"
      >
        <div className="flex items-start gap-2.5">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <p className="text-body font-semibold text-neutral-950">{data.title}</p>
        </div>
        <div className="mt-3 space-y-1.5 pl-[30px] text-body-sm text-neutral-700">
          <p>原因：{data.reason}</p>
          <p className="text-neutral-500">{data.searchedScope}</p>
          <p className="text-neutral-500">{data.missingType}</p>
        </div>
        <div className="ml-[30px] mt-3 flex items-center gap-2 rounded-lg bg-surface-soft px-3 py-2.5">
          <FileSearch className="h-4 w-4 shrink-0 text-neutral-400" />
          <p className="text-body-sm text-neutral-700">
            最接近主题（不伪装成答案）：<span className="font-medium text-neutral-950">{data.closestTopic}</span>
            <span className="ml-1.5 text-caption text-neutral-500">{data.closestMeta}</span>
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 pl-[30px]">
          <button
            type="button"
            onClick={onUpload}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
          >
            <Upload className="h-4 w-4" />
            上传相关资料
          </button>
          <button
            type="button"
            onClick={onAssign}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
          >
            <UserPlus className="h-4 w-4" />
            指派给 Owner（李娜）
          </button>
          <button
            type="button"
            onClick={onRephrase}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
          >
            <RotateCcw className="h-4 w-4" />
            换个问法
          </button>
        </div>
      </motion.div>
    </div>
  )
}
