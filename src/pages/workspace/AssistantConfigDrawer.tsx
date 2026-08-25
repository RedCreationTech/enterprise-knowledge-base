/**
 * AssistantConfigDrawer — 助手配置抽屉（ai-assistant.md §2.3，宽 560）：
 * 名称/描述/知识范围多选/受众多选/回答原则/欢迎语/推荐问题 → 保存草稿 / 发布新版本（就绪检查 6 项，BLOCK 阻断）。
 */
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssistantConfigValues, AssistantItem } from './aiAssistant.mock'
import { KNOWLEDGE_OPTIONS, readinessChecks } from './aiAssistant.mock'

const AUDIENCE_OPTIONS = ['全员', '销售团队', '售前团队', '客服团队']
const DEFAULT_PRINCIPLES = ['只回答有出处的内容', '找不到时明确告知', '不猜测价格与承诺']

export interface AssistantConfigDrawerProps {
  assistant: AssistantItem | null
  onClose: () => void
  onToast: (text: string, kind?: 'success' | 'info' | 'warning' | 'error') => void
  /** 保存草稿 / 发布新版本时把表单值回写到页面 state */
  onSave: (values: AssistantConfigValues, mode: 'draft' | 'publish') => void
}

const RESULT_STYLE = {
  PASS: { icon: CheckCircle2, cls: 'text-success', label: 'PASS' },
  WARN: { icon: AlertTriangle, cls: 'text-warning', label: 'WARN' },
  BLOCK: { icon: XCircle, cls: 'text-danger', label: 'BLOCK' },
} as const

export function AssistantConfigDrawer({ assistant, onClose, onToast, onSave }: AssistantConfigDrawerProps) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [knowledge, setKnowledge] = useState<string[]>([])
  const [audience, setAudience] = useState<string[]>([])
  const [principles, setPrinciples] = useState<string[]>(DEFAULT_PRINCIPLES)
  const [welcome, setWelcome] = useState('')
  const [suggested, setSuggested] = useState<string[]>([])
  const [showChecks, setShowChecks] = useState(false)

  // 打开抽屉时用 assistant 数据回填表单（渲染期比对 assistant 引用，替代 effect 内同步 setState）
  const [prevAssistant, setPrevAssistant] = useState<AssistantItem | null>(null)
  if (assistant !== prevAssistant) {
    setPrevAssistant(assistant)
    if (assistant) {
      setName(assistant.name.replace('（草稿）', ''))
      setDesc(assistant.desc)
      setKnowledge(
        assistant.knowledge
          ? [...assistant.knowledge]
          : assistant.scope === '全部知识空间'
            ? [...KNOWLEDGE_OPTIONS]
            : ['产品资料', '销售政策'],
      )
      setAudience(
        assistant.audienceList ? [...assistant.audienceList] : assistant.audience === '全员' ? ['全员'] : assistant.audience.split('+').concat([]),
      )
      setPrinciples([...assistant.principles])
      setWelcome(assistant.welcome)
      setSuggested([...assistant.suggested])
      setShowChecks(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (assistant) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [assistant, onClose])

  const checks = useMemo(() => {
    if (knowledge.length === 0) {
      return readinessChecks.map((c) =>
        c.item === '知识范围' ? { ...c, result: 'BLOCK' as const, detail: '未选择知识范围，禁止发布' } : c,
      )
    }
    return readinessChecks
  }, [knowledge])

  const blocked = checks.some((c) => c.result === 'BLOCK')

  const toggle = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item])
  }

  const buildValues = (): AssistantConfigValues => ({
    name: name.trim(),
    desc: desc.trim(),
    knowledge: [...knowledge],
    audience: [...audience],
    principles: principles.map((p) => p.trim()).filter(Boolean),
    welcome: welcome.trim(),
    suggested: suggested.map((s) => s.trim()).filter(Boolean),
  })

  const handleSaveDraft = () => {
    if (name.trim().length < 2) return
    onSave(buildValues(), 'draft')
    onToast('草稿已保存，配置已写回助手卡片')
    onClose()
  }

  const handlePublish = () => {
    if (!showChecks) {
      setShowChecks(true)
      return
    }
    if (blocked || name.trim().length < 2) return
    onSave(buildValues(), 'publish')
    onToast(`已发布新版本（就绪检查 ${checks.filter((c) => c.result === 'PASS').length} PASS · ${checks.filter((c) => c.result === 'WARN').length} WARN）`)
    onClose()
  }

  const chipCls = (active: boolean) =>
    cn(
      'inline-flex h-8 items-center rounded-md border px-3 text-body-sm transition-colors duration-micro ease-brand',
      active ? 'border-brand-500 bg-brand-100 text-brand-700' : 'border-neutral-200 bg-white text-neutral-700 hover:border-brand-300',
    )

  return (
    <AnimatePresence>
      {assistant && (
        <div className="fixed inset-0 z-[55]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="absolute inset-0"
            style={{ background: 'rgba(16,24,40,0.4)' }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute right-0 top-0 flex h-full w-[560px] max-w-[94vw] flex-col bg-white shadow-float"
            role="dialog"
            aria-label="助手配置"
          >
            <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <div>
                <h3 className="text-h3 text-neutral-950">配置助手</h3>
                <p className="mt-0.5 text-caption text-neutral-500">{assistant.name} · 当前版本 {assistant.version}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">助手名称（必填，2–30 字）</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={30}
                  className="h-10 w-full rounded-md border border-[#DCE4EF] px-3 text-body text-neutral-800 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:shadow-input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">描述</label>
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="h-10 w-full rounded-md border border-[#DCE4EF] px-3 text-body text-neutral-800 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:shadow-input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">使用哪些知识（≥1 必填）</label>
                <div className="flex flex-wrap gap-2">
                  {KNOWLEDGE_OPTIONS.map((k) => (
                    <button key={k} type="button" onClick={() => toggle(knowledge, setKnowledge, k)} className={chipCls(knowledge.includes(k))}>
                      {k}
                    </button>
                  ))}
                </div>
                {knowledge.length === 0 && <p className="mt-1.5 text-caption text-danger">未选择知识范围，发布将被阻断。</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">给谁使用</label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCE_OPTIONS.map((a) => (
                    <button key={a} type="button" onClick={() => toggle(audience, setAudience, a)} className={chipCls(audience.includes(a))}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-body-sm font-medium text-neutral-800">回答原则</label>
                  <button
                    type="button"
                    onClick={() => setPrinciples([...DEFAULT_PRINCIPLES])}
                    className="text-caption text-brand-600 hover:text-brand-700"
                  >
                    恢复默认
                  </button>
                </div>
                <div className="space-y-2">
                  {principles.map((p, i) => (
                    <input
                      key={i}
                      value={p}
                      onChange={(e) => setPrinciples(principles.map((v, j) => (j === i ? e.target.value : v)))}
                      className="h-10 w-full rounded-md border border-[#DCE4EF] bg-surface-soft px-3 text-body text-neutral-800 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:bg-white focus:shadow-input"
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">欢迎语</label>
                <textarea
                  value={welcome}
                  onChange={(e) => setWelcome(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-md border border-[#DCE4EF] px-3 py-2 text-body text-neutral-800 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:shadow-input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-neutral-800">推荐问题（3–6 个）</label>
                <div className="space-y-2">
                  {suggested.map((s, i) => (
                    <input
                      key={i}
                      value={s}
                      onChange={(e) => setSuggested(suggested.map((v, j) => (j === i ? e.target.value : v)))}
                      className="h-10 w-full rounded-md border border-[#DCE4EF] px-3 text-body text-neutral-800 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:shadow-input"
                    />
                  ))}
                </div>
              </div>

              {showChecks && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="rounded-lg border border-neutral-200 p-4">
                  <p className="mb-3 text-body-sm font-semibold text-neutral-950">发布前就绪检查</p>
                  <ul className="space-y-2">
                    {checks.map((c) => {
                      const style = RESULT_STYLE[c.result]
                      return (
                        <li key={c.item} className="flex items-center gap-2.5 text-body-sm">
                          <style.icon className={cn('h-4 w-4 shrink-0', style.cls)} />
                          <span className="w-20 shrink-0 font-medium text-neutral-800">{c.item}</span>
                          <span className="min-w-0 flex-1 truncate text-neutral-500">{c.detail}</span>
                          <span className={cn('shrink-0 text-caption font-semibold', style.cls)}>{style.label}</span>
                        </li>
                      )
                    })}
                  </ul>
                  {blocked && <p className="mt-3 text-caption text-danger">存在 BLOCK 项，请先修复后再发布。</p>}
                </motion.div>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 px-6 py-4">
              <button
                type="button"
                disabled={name.trim().length < 2}
                onClick={handleSaveDraft}
                className="h-10 rounded-md border border-[#BFD0F2] bg-white px-4 text-body text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                保存草稿
              </button>
              <button
                type="button"
                disabled={name.trim().length < 2 || blocked}
                onClick={handlePublish}
                className={cn(
                  'h-10 rounded-md px-5 text-body font-medium text-white transition-colors duration-micro ease-brand',
                  name.trim().length < 2 || blocked
                    ? 'cursor-not-allowed bg-neutral-100 text-neutral-400'
                    : 'bg-brand-600 hover:bg-brand-500 active:bg-brand-700',
                )}
              >
                {showChecks ? '确认发布新版本' : '发布新版本'}
              </button>
            </footer>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
