/**
 * KnowledgeMapDetailDrawer — 知识地图节点详情抽屉（Task 3：节点详情 + 整体布局优化）
 * 右侧 slide-over overlay（framer-motion 240ms，遮罩 rgba(16,24,40,.4)，Esc / 遮罩 / × 关闭），
 * 宽 380px（移动端 w-full 全屏），z-60/61 —— 位于 SideDrawer 家族（z-70/71）之下，
 * 从抽屉内打开「引用记录 / 问答记录」时不被遮挡。
 * 不挤占图谱：fixed overlay 定位；打开时父级把右侧「热点知识 Top 3」栏让位隐藏，
 * 图谱始终保持在 9 列主区。焦点管理用轻量版（保存触发元素 → 关闭归还），
 * 不用 use-focus-trap，避免与嵌套 SideDrawer 的焦点陷阱互相冲突。
 *
 * 内容按节点类型渲染：
 * - 文档：名称 / 分类 / 状态+validityNote / 作者 / 版本 / 被问·被引 / 所属空间 / 来源
 *   + 关联问题列表（该 docId 的 questions，含 asked / 可信度 / 引用）；
 * - 问题：问题文本 + 引用高亮 + 关联文档 + 可信度 + FAQ / 测试集动作；
 * - 分类：count / questions / health 进度环。
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CircleHelp, FileText, Layers, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProgressRing } from '@/components/common'
import { KEY_NAMESPACE, migrateRawKey } from '@/lib/storage'
import { MAP_CATEGORIES, MAP_DOCS, MAP_QUESTIONS } from '@/pages/workspace/mapData'
import type { DocNode, DocValidity, QuestionNode } from '@/pages/workspace/mapData'

const Q_ACTION_KEY = KEY_NAMESPACE.knowledgeMap.questionActions
/** Phase 3 Task 6 迁移回退旧 key：读取时迁移到新 key 并删除旧 key */
const LEGACY_Q_ACTION_KEY = 'knowledge-map:question-actions'

type QuestionAction = 'faq' | 'testset'

function readQuestionActions(): Record<string, QuestionAction[]> {
  try {
    migrateRawKey(LEGACY_Q_ACTION_KEY, Q_ACTION_KEY)
    const raw = localStorage.getItem(Q_ACTION_KEY)
    return raw ? (JSON.parse(raw) as Record<string, QuestionAction[]>) : {}
  } catch {
    return {}
  }
}

/** 幂等记录问题动作（创建 FAQ / 加入测试集）；返回 false 表示已加入过 */
function recordQuestionAction(qid: string, action: QuestionAction): boolean {
  const all = readQuestionActions()
  const list = all[qid] ?? []
  if (list.includes(action)) return false
  all[qid] = [...list, action]
  try {
    localStorage.setItem(Q_ACTION_KEY, JSON.stringify(all))
  } catch {
    // 隐私模式等写入失败时静默降级为当次有效
  }
  return true
}

export type Selection =
  | { kind: 'doc'; doc: DocNode }
  | { kind: 'category'; name: string }
  | { kind: 'question'; q: QuestionNode }

export interface KnowledgeMapDetailDrawerProps {
  selectedNode: Selection | null
  /** 当前空间视角（顶部选择器值，文档「所属空间」用） */
  space: string
  onClose: () => void
  onOpenDoc: () => void
  onShowCitations: (doc: DocNode) => void
  onShowQuestion: (doc: DocNode, question: string) => void
  onViewCategory: () => void
  onToast: (kind: 'success' | 'info' | 'warning', message: string) => void
}

/** 状态徽标（浅底深字，颜色 + 文字双编码，与列表视图口径一致） */
function ValidityBadge({ validity }: { validity: DocValidity }) {
  const styles: Record<DocValidity, string> = {
    正常: 'bg-success-bg text-success',
    复审将到期: 'bg-warning-bg text-warning',
    可能过期: 'bg-warning-bg text-warning',
    存在冲突: 'bg-danger-bg text-danger',
  }
  return <span className={cn('inline-flex items-center rounded-pill px-2 py-0.5 text-caption font-medium', styles[validity])}>{validity}</span>
}

/** 键值对行：标签靠左、值靠右（窄抽屉内不换行挤压） */
function KVRow({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 pt-0.5 text-neutral-500">{k}</dt>
      <dd className="min-w-0 flex-1 text-right text-neutral-800">{children}</dd>
    </div>
  )
}

/** 引用高亮：问题文本中命中关联文档名（或其最长前缀，≥3 字）的片段用浅黄 mark 高亮 */
function highlightQuote(text: string, keyword?: string) {
  if (!keyword) return text
  let hit: string | null = null
  for (let len = Math.min(keyword.length, 20); len >= 3; len--) {
    const cand = keyword.slice(0, len)
    if (text.includes(cand)) {
      hit = cand
      break
    }
  }
  if (!hit) return text
  const idx = text.indexOf(hit)
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-surface-highlight px-1">{hit}</mark>
      {text.slice(idx + hit.length)}
    </>
  )
}

function healthNote(h: number): string {
  if (h >= 90) return '内容更新及时、问题覆盖充分，健康状态优秀。'
  if (h >= 80) return '整体健康，少量内容需关注复审节奏。'
  if (h >= 70) return '部分内容临近复审，建议尽快安排更新。'
  return '健康度偏低，存在过期或冲突内容，建议优先治理。'
}

/* ---------- 文档节点内容 ---------- */

function DocContent({
  doc,
  space,
  onOpenDoc,
  onShowCitations,
  onShowQuestion,
}: {
  doc: DocNode
  space: string
  onOpenDoc: () => void
  onShowCitations: (doc: DocNode) => void
  onShowQuestion: (doc: DocNode, question: string) => void
}) {
  const abnormal = doc.validity === '存在冲突' || doc.validity === '可能过期'
  const questions = MAP_QUESTIONS.filter((q) => q.docId === doc.id)
  return (
    <div>
      {abnormal && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg bg-danger-bg px-3 py-2">
          <p className="flex items-center gap-1.5 text-body-sm text-danger">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {doc.validity}
          </p>
          <button type="button" className="text-body-sm font-medium text-danger hover:underline" onClick={onOpenDoc}>
            去处理 →
          </button>
        </div>
      )}
      <h3 className="text-h3 text-neutral-950">{doc.name}</h3>
      <dl className="mt-4 space-y-3 text-body-sm">
        <KVRow k="分类">{doc.category}</KVRow>
        <KVRow k="状态">
          <ValidityBadge validity={doc.validity} />
          <p className="mt-1 text-caption text-neutral-400">{doc.validityNote}</p>
        </KVRow>
        <KVRow k="作者">{doc.owner}</KVRow>
        <KVRow k="版本">{doc.version}</KVRow>
        <KVRow k="被问 / 被引">
          被问 {doc.asked} 次 · 被引用 {doc.cited} 次
        </KVRow>
        <KVRow k="所属空间">{space.replace('（默认）', '')}</KVRow>
        <KVRow k="来源">知识库 · {doc.category}</KVRow>
      </dl>

      <div className="mt-5 border-t border-neutral-100 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-body-sm font-semibold text-neutral-950">关联问题（{questions.length}）</h4>
          {doc.cited > 0 && <span className="text-caption text-neutral-400">近 30 天引用 {doc.cited} 次</span>}
        </div>
        {questions.length === 0 ? (
          <p className="mt-2.5 rounded-lg bg-surface-soft px-3 py-2.5 text-caption text-neutral-500">暂无直接关联的高频问题</p>
        ) : (
          <ul className="mt-1 divide-y divide-neutral-100">
            {questions.map((q) => (
              <li key={q.id} className="py-2.5">
                <button type="button" onClick={() => onShowQuestion(doc, q.text)} className="text-left text-body-sm text-brand-600 hover:underline">
                  {q.text}
                </button>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-neutral-500">
                  <span>被问 {q.asked} 次</span>
                  <span>可信度 {q.successRate}%</span>
                  {doc.cited > 0 && <span className="rounded-sm bg-brand-50 px-1.5 py-0.5 font-medium text-brand-600">引用 {doc.cited}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300"
          onClick={onOpenDoc}
        >
          打开文档
        </button>
        <button type="button" className="inline-flex h-9 items-center rounded-md px-2 text-body-sm text-brand-600 hover:bg-brand-50" onClick={() => onShowCitations(doc)}>
          查看引用记录
        </button>
      </div>
    </div>
  )
}

/* ---------- 问题节点内容 ---------- */

function QuestionContent({
  q,
  onOpenDoc,
  onToast,
}: {
  q: QuestionNode
  onOpenDoc: () => void
  onToast: (kind: 'success' | 'info' | 'warning', message: string) => void
}) {
  const doc = MAP_DOCS.find((d) => d.id === q.docId)
  const [done, setDone] = useState<QuestionAction[]>(() => readQuestionActions()[q.id] ?? [])

  const handleAction = (action: QuestionAction) => {
    if (recordQuestionAction(q.id, action)) {
      setDone((prev) => (prev.includes(action) ? prev : [...prev, action]))
      onToast('success', action === 'faq' ? '已创建 FAQ 草稿，待李娜审核' : '已加入助手测试集')
    } else {
      onToast('info', action === 'faq' ? '该问题已创建过 FAQ 草稿，请勿重复提交' : '该问题已在助手测试集中，请勿重复加入')
    }
  }

  return (
    <div>
      <p className="text-caption text-neutral-400">高频问题</p>
      <h3 className="mt-1 text-h3 text-neutral-950">{highlightQuote(q.text, doc?.name)}</h3>
      <dl className="mt-4 space-y-3 text-body-sm">
        <KVRow k="被问次数">{q.asked} 次</KVRow>
        <KVRow k="可信度">{q.successRate}%（成功回答率）</KVRow>
        <KVRow k="关联文档">{doc?.name ?? '—'}</KVRow>
      </dl>
      <div className="mt-4 rounded-lg border border-neutral-200 bg-surface-soft p-3">
        <p className="text-caption text-neutral-400">引用来源</p>
        {doc ? (
          <>
            <p className="mt-1 text-body-sm text-neutral-800">
              《<mark className="rounded-sm bg-surface-highlight px-1">{doc.name}</mark>》{doc.version}
            </p>
            <p className="mt-1 text-caption text-neutral-500">答案引用本文档 · 被引用 {doc.cited} 次</p>
          </>
        ) : (
          <p className="mt-1 text-body-sm text-neutral-500">暂无关联文档</p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
        <button
          type="button"
          className={cn(
            'inline-flex h-9 items-center gap-1 rounded-md px-3 text-body-sm font-medium',
            done.includes('faq') ? 'border border-success bg-success-bg text-success' : 'bg-brand-600 text-white hover:bg-brand-500',
          )}
          onClick={() => handleAction('faq')}
        >
          {done.includes('faq') && <Check className="h-3.5 w-3.5" />}
          {done.includes('faq') ? '已创建 FAQ 草稿' : '创建 FAQ'}
        </button>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 items-center gap-1 rounded-md border px-3 text-body-sm',
            done.includes('testset')
              ? 'border-success bg-success-bg text-success'
              : 'border-neutral-200 bg-white text-neutral-800 hover:border-brand-300',
          )}
          onClick={() => handleAction('testset')}
        >
          {done.includes('testset') && <Check className="h-3.5 w-3.5" />}
          {done.includes('testset') ? '已加入测试集' : '加入测试集'}
        </button>
        <button type="button" className="inline-flex h-9 items-center rounded-md px-2 text-body-sm text-brand-600 hover:bg-brand-50" onClick={onOpenDoc}>
          打开文档
        </button>
      </div>
    </div>
  )
}

/* ---------- 分类节点内容 ---------- */

function CategoryContent({ name, onViewCategory }: { name: string; onViewCategory: () => void }) {
  const cat = MAP_CATEGORIES.find((c) => c.name === name)!
  return (
    <div>
      <h3 className="text-h3 text-neutral-950">{cat.name}</h3>
      <div className="mt-4 flex items-center gap-5">
        <ProgressRing value={cat.health} size={88} strokeWidth={7} label="健康度" />
        <dl className="space-y-2 text-body-sm">
          <div className="flex gap-2">
            <dt className="text-neutral-500">文档数</dt>
            <dd className="font-medium text-neutral-950">{cat.count} 份</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-neutral-500">问题数</dt>
            <dd className="font-medium text-neutral-950">{cat.questions} 个</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-neutral-500">健康度</dt>
            <dd className="font-medium text-neutral-950">{cat.health} 分</dd>
          </div>
        </dl>
      </div>
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <h4 className="text-body-sm font-semibold text-neutral-950">健康度评估</h4>
        <p className="mt-1 text-body-sm text-neutral-500">{healthNote(cat.health)}</p>
      </div>
      <button type="button" className="mt-4 inline-flex h-9 items-center rounded-md px-2 text-body-sm text-brand-600 hover:bg-brand-50" onClick={onViewCategory}>
        查看该分类 ›
      </button>
    </div>
  )
}

/* ---------- 抽屉外壳 ---------- */

export function KnowledgeMapDetailDrawer({
  selectedNode,
  space,
  onClose,
  onOpenDoc,
  onShowCitations,
  onShowQuestion,
  onViewCategory,
  onToast,
}: KnowledgeMapDetailDrawerProps) {
  const open = selectedNode !== null
  const containerRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  // 打开瞬间保存触发元素并聚焦面板；关闭时焦点归还触发元素（轻量版焦点管理，避免嵌套抽屉双陷阱）
  useEffect(() => {
    if (open) {
      if (!triggerRef.current) {
        triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      }
      const timer = window.setTimeout(() => containerRef.current?.focus(), 0)
      return () => window.clearTimeout(timer)
    }
    const trigger = triggerRef.current
    if (trigger && document.contains(trigger)) trigger.focus()
    triggerRef.current = null
    return undefined
  }, [open])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const headIcon =
    selectedNode?.kind === 'doc' ? (
      <FileText className="h-4 w-4 shrink-0 text-brand-600" />
    ) : selectedNode?.kind === 'category' ? (
      <Layers className="h-4 w-4 shrink-0 text-brand-600" />
    ) : (
      <CircleHelp className="h-4 w-4 shrink-0 text-brand-600" />
    )
  const title = selectedNode ? (selectedNode.kind === 'doc' ? selectedNode.doc.name : selectedNode.kind === 'category' ? selectedNode.name : selectedNode.q.text) : ''

  return (
    <AnimatePresence>
      {selectedNode && (
        <>
          <motion.div
            key="kmd-mask"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 z-[60] bg-[rgba(16,24,40,0.4)]"
            onClick={onClose}
          />
          <motion.aside
            key="kmd-panel"
            ref={containerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-[380px] flex-col bg-white shadow-float outline-none"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
          >
            <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {headIcon}
                <h2 className="truncate text-h3 text-neutral-950">{title}</h2>
                {selectedNode.kind === 'doc' && (
                  <>
                    <span className="shrink-0 rounded-sm bg-neutral-100 px-1.5 py-0.5 text-caption font-medium text-neutral-500">{selectedNode.doc.version}</span>
                    <ValidityBadge validity={selectedNode.doc.validity} />
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {selectedNode.kind === 'doc' && (
                <DocContent
                  doc={selectedNode.doc}
                  space={space}
                  onOpenDoc={onOpenDoc}
                  onShowCitations={onShowCitations}
                  onShowQuestion={onShowQuestion}
                />
              )}
              {selectedNode.kind === 'question' && <QuestionContent q={selectedNode.q} onOpenDoc={onOpenDoc} onToast={onToast} />}
              {selectedNode.kind === 'category' && <CategoryContent name={selectedNode.name} onViewCategory={onViewCategory} />}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
