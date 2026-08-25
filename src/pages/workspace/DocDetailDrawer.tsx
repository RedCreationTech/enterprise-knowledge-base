/**
 * DocDetailDrawer — 文档详情抽屉（design/knowledge-base.md §2.5，宽 640）。
 * 四个 Tab：内容（原文预览 + 浅黄高亮 + 目录锚点）/ 版本（设为权威 L2 确认 + 版本对比 diff）
 * / 元数据（Owner、有效期 valid_from / review_due_at / expires_at、source_of_truth、权限范围，可编辑）
 * / 引用关系（被答案引用 / 被助手使用 / 近 30 天查看）。
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, FileText, GitCompareArrows } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmationCard, StatusBadge } from '@/components/common'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import type { DocRow } from './kbData'

const TABS = ['内容', '版本', '元数据', '引用关系'] as const
type TabKey = (typeof TABS)[number]

export interface DocDetailDrawerProps {
  doc: DocRow | null
  onClose: () => void
  onSetAuthoritative: (docId: string, versionLabel: string) => void
  onUpdateValidity: (docId: string, patch: { validFrom: string; reviewDueAt: string; expiresAt: string }) => void
  onToast: (kind: 'success' | 'info' | 'warning', message: string) => void
}

export function DocDetailDrawer({ doc, onClose, onSetAuthoritative, onUpdateValidity, onToast }: DocDetailDrawerProps) {
  const [tab, setTab] = useState<TabKey>('内容')
  const [confirmVersion, setConfirmVersion] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [editingValidity, setEditingValidity] = useState(false)
  const [validFrom, setValidFrom] = useState('')
  const [reviewDueAt, setReviewDueAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const startEditValidity = (d: DocRow) => {
    setValidFrom(d.validFrom)
    setReviewDueAt(d.reviewDueAt)
    setExpiresAt(d.expiresAt)
    setEditingValidity(true)
  }

  return (
    <SideDrawer
      open={doc !== null}
      onClose={onClose}
      width={640}
      title={
        doc ? (
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-brand-600" />
            <span className="truncate">{doc.title}</span>
            <span className="shrink-0 rounded-sm bg-neutral-100 px-1.5 py-0.5 text-caption font-medium text-neutral-500">{doc.version}</span>
            <StatusBadge status={doc.status} />
          </span>
        ) : (
          ''
        )
      }
    >
      {doc && (
        <div>
          {/* Tab 栏 */}
          <div className="mb-4 flex gap-1 border-b border-neutral-200">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'relative h-9 px-3 text-body-sm transition-colors duration-micro ease-brand',
                  tab === t ? 'font-semibold text-brand-600' : 'text-neutral-500 hover:text-neutral-800',
                )}
              >
                {t}
                {tab === t && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-500" />}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {tab === '内容' && (
                <div className="flex flex-col gap-4">
                  <section>
                    <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">目录</h4>
                    <div className="flex flex-wrap gap-2">
                      {['第一章 总则', '第二章 适用范围', '第三章 具体规定', '第四章 附则'].map((a) => (
                        <span key={a} className="cursor-pointer rounded-md bg-neutral-50 px-2.5 py-1 text-caption text-brand-600 hover:bg-brand-50">
                          {a}
                        </span>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">原文预览</h4>
                    <div className="flex flex-col gap-3 rounded-lg border border-neutral-100 bg-surface-soft p-4 text-body text-neutral-700">
                      <p>{doc.title} {doc.version}，由 {doc.owner} 维护，来源于{doc.source}，当前状态：{doc.status}。</p>
                      <p>
                        <mark className="rounded-sm bg-surface-highlight px-1">
                          当客户报价折扣超过 10% 时，需由销售总监审批；超过 20% 时，需总经理审批并抄送财务。
                        </mark>
                        （此句为「客户报价折扣超过 10% 需要谁审批？」的主要依据）
                      </p>
                      <p>本文件生效日期 {doc.validFrom}，复审到期 {doc.reviewDueAt}，强制失效 {doc.expiresAt}。过期后默认不参与回答。</p>
                    </div>
                  </section>
                </div>
              )}

              {tab === '版本' && (
                <div className="flex flex-col gap-3">
                  <ul className="flex flex-col gap-2">
                    {doc.versions.map((v) => (
                      <li
                        key={v.label}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border p-3',
                          v.authoritative ? 'border-[1.5px] border-brand-500 bg-surface-cardSel' : 'border-neutral-200',
                        )}
                      >
                        <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-caption font-semibold text-neutral-700">{v.label}</span>
                        <span className="min-w-0 flex-1 text-body-sm text-neutral-500">{v.note}</span>
                        {v.authoritative ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-caption font-medium text-success">
                            <Check className="h-3.5 w-3.5" />
                            当前权威
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmVersion(v.label)}
                            className="shrink-0 text-caption font-medium text-brand-600 hover:text-brand-500"
                          >
                            设为权威版本
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setShowDiff((s) => !s)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
                  >
                    <GitCompareArrows className="h-4 w-4" />
                    {showDiff ? '收起版本对比' : '版本对比'}
                  </button>
                  <AnimatePresence>
                    {showDiff && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.24 }}
                        className="grid grid-cols-2 gap-2"
                      >
                        <div className="rounded-lg border border-neutral-200 p-3">
                          <p className="text-caption font-semibold text-neutral-500">{doc.versions[doc.versions.length - 1]?.label}（旧）</p>
                          <p className="mt-2 text-body-sm text-neutral-600">
                            折扣超过 <span className="rounded-sm bg-danger-bg px-1 text-danger line-through">8%</span> 需销售总监审批。
                          </p>
                        </div>
                        <div className="rounded-lg border border-neutral-200 p-3">
                          <p className="text-caption font-semibold text-neutral-500">{doc.versions[0]?.label}（新）</p>
                          <p className="mt-2 text-body-sm text-neutral-600">
                            折扣超过 <span className="rounded-sm bg-success-bg px-1 text-success">10%</span> 需销售总监审批；新增超过 20% 需总经理审批。
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {tab === '元数据' && (
                <div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {[
                      ['Owner', doc.owner],
                      ['分类', doc.category],
                      ['来源', doc.source],
                      ['风险等级', doc.riskLevel],
                      ['权威来源（source_of_truth）', doc.sourceOfTruth],
                      ['权限范围', doc.permScope],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-caption text-neutral-400">{k}</dt>
                        <dd className="mt-0.5 text-body-sm text-neutral-800">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 rounded-lg border border-neutral-200 p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-body-sm font-semibold text-neutral-950">有效期</h4>
                      {!editingValidity && (
                        <button
                          type="button"
                          onClick={() => startEditValidity(doc)}
                          className="text-caption font-medium text-brand-600 hover:text-brand-500"
                        >
                          编辑
                        </button>
                      )}
                    </div>
                    {editingValidity ? (
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        {[
                          ['生效日期', validFrom, setValidFrom],
                          ['复审到期', reviewDueAt, setReviewDueAt],
                          ['强制失效', expiresAt, setExpiresAt],
                        ].map(([label, value, setter]) => (
                          <label key={label as string} className="block">
                            <span className="text-caption text-neutral-400">{label as string}</span>
                            <input
                              value={value as string}
                              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                              className="mt-1 h-9 w-full rounded-md border border-neutral-200 px-2.5 text-body-sm outline-none focus:border-brand-500 focus:shadow-input"
                            />
                          </label>
                        ))}
                        <div className="col-span-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingValidity(false)}
                            className="h-8 rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-700 hover:border-brand-300"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateValidity(doc.id, { validFrom, reviewDueAt, expiresAt })
                              setEditingValidity(false)
                              onToast('success', '有效期已更新，已记录审计日志')
                            }}
                            className="h-8 rounded-md bg-brand-600 px-3 text-body-sm font-medium text-white hover:bg-brand-500"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <dl className="mt-3 grid grid-cols-3 gap-3">
                        {[
                          ['生效日期 valid_from', doc.validFrom],
                          ['复审到期 review_due_at', doc.reviewDueAt],
                          ['强制失效 expires_at', doc.expiresAt],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-caption text-neutral-400">{k}</dt>
                            <dd className="mt-0.5 text-body-sm font-medium text-neutral-800">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                  {doc.confirmedNote && (
                    <p className="mt-3 rounded-md bg-success-bg px-3 py-2 text-caption text-success">{doc.confirmedNote}</p>
                  )}
                </div>
              )}

              {tab === '引用关系' && (
                <div className="flex flex-col gap-3">
                  {[
                    ['被答案引用', '3 个可信答案将本文档作为引用来源'],
                    ['被助手使用', '2 个业务助手（企业知识助手、销售助手）'],
                    ['近 30 天查看', '45 次，环比 +18%'],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-neutral-200 p-4">
                      <p className="text-body-sm font-semibold text-neutral-950">{k}</p>
                      <p className="mt-1 text-body-sm text-neutral-500">{v}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* 设为权威版本 L2 确认 */}
      <AnimatePresence>
        {confirmVersion && doc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(16,24,40,0.4)] p-6"
            onClick={() => setConfirmVersion(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[480px] max-w-full"
            >
              <ConfirmationCard
                title={`将 ${confirmVersion} 设为权威版本？`}
                fields={[
                  { label: '动作', value: `权威版本：${doc.versions.find((v) => v.authoritative)?.label ?? '-'} → ${confirmVersion}` },
                  { label: '影响对象', value: doc.title },
                  { label: '影响范围', value: '引用本文档的答案与助手将改用新版本' },
                  { label: '可撤销性', value: '可随时再次切换权威版本' },
                ]}
                confirmText="确认执行"
                onConfirm={() => {
                  onSetAuthoritative(doc.id, confirmVersion)
                  setConfirmVersion(null)
                  onToast('success', `${confirmVersion} 已设为权威版本`)
                }}
                onModify={() => setConfirmVersion(null)}
                onCancel={() => setConfirmVersion(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SideDrawer>
  )
}
