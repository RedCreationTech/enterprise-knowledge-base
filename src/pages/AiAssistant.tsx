/**
 * AI 助手与对话（/workspace/ai-assistant）— ai-assistant.md
 * 左栏（300px）：助手 / 历史 双 Tab（助手卡 + 创建助手 + 配置 Drawer；历史可搜索、删除可撤销）
 * 右栏：全屏可信问答（多轮对话 + AnswerCard 三档对照 92% 绿 / 78% 黄 + 拒答卡 + CitationDrawer 引用高亮）
 * 问答为模拟脚本：命中预置问题返回对应 AnswerCard，未命中返回拒答卡；「答案有问题」写入 store.feedbacks。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bot,
  CheckCheck,
  ChevronRight,
  Download,
  Eraser,
  History,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  SendHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore, me } from '@/mocks'
import { AnswerCard } from '@/components/common/AnswerCard'
import { CitationCard } from '@/components/common/CitationCard'
import { ConfirmationCard } from '@/components/common/ConfirmationCard'
import { QuickChips } from '@/components/chat/QuickChips'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from './workspace/Modal'
import { SideDrawer } from './workspace/SideDrawer'
import { PageHeader } from './workspace/PageHeader'
import { CitationDrawer } from './workspace/CitationDrawer'
import { NoAnswerCard } from './workspace/NoAnswerCard'
import { AssistantConfigDrawer } from './workspace/AssistantConfigDrawer'
import { useAppToast } from '@/lib/toast'
import type {
  AssistantConfigValues,
  AssistantItem,
  CitationData,
  ConversationItem,
  EvalQuestion,
  RefusalData,
  ScriptedAnswer,
} from './workspace/aiAssistant.mock'
import {
  ANSWER_PRIVATE_DEPLOY,
  EVAL_SET,
  FEEDBACK_REASONS,
  KNOWLEDGE_OPTIONS,
  REFUSAL_PRICING,
  assistantTemplates,
  assistants as initialAssistants,
  conversations as initialConversations,
  matchScript,
} from './workspace/aiAssistant.mock'

// ---------- 消息模型 ----------

type Msg =
  | { id: string; kind: 'user'; text: string; time: string }
  | { id: string; kind: 'ai-text'; text: string; time: string }
  | { id: string; kind: 'answer'; question: string; answer: ScriptedAnswer; time: string; feedback: 'correct' | 'wrong' | null; trimmed: boolean }
  | { id: string; kind: 'refusal'; question: string; refusal: RefusalData; time: string }
  | { id: string; kind: 'generating'; stage: number; time: string }

let msgUid = 0
function nextMsgId() {
  msgUid += 1
  return `amsg-${msgUid}`
}
function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const GENERATE_STAGES = ['正在检索企业知识…', '正在生成结论…', '正在校验引用来源…']

function initialMessages(): Msg[] {
  return [
    { id: nextMsgId(), kind: 'ai-text', text: '你好，我是企业知识助手。你可以问我任何关于产品、报价与制度的问题，每个答案都会附来源。', time: '10:40' },
    { id: nextMsgId(), kind: 'user', text: '我们支持私有化部署吗？', time: '10:41' },
    { id: nextMsgId(), kind: 'answer', question: '我们支持私有化部署吗？', answer: ANSWER_PRIVATE_DEPLOY, time: '10:41', feedback: null, trimmed: false },
    { id: nextMsgId(), kind: 'user', text: '有没有详细报价？', time: '10:43' },
    { id: nextMsgId(), kind: 'refusal', question: '有没有详细报价？', refusal: REFUSAL_PRICING, time: '10:43' },
  ]
}

// ---------- 页面 ----------

export default function AiAssistant() {
  const navigate = useNavigate()
  const { state, addFeedback, addTask } = useAppStore()
  const toast = useAppToast()
  /** 真实空态起点：隐藏运营统计数字与历史会话，问候与输入流程保留 */
  const demoOff = state.demoData === false

  const [assistantList, setAssistantList] = useState<AssistantItem[]>(initialAssistants)
  const [activeAssistantId, setActiveAssistantId] = useState(initialAssistants[0].id)
  const activeAssistant = assistantList.find((a) => a.id === activeAssistantId) ?? assistantList[0]

  const [leftTab, setLeftTab] = useState<'assistants' | 'history'>('assistants')
  const [historyList, setHistoryList] = useState<ConversationItem[]>(initialConversations)
  const [historyQuery, setHistoryQuery] = useState('')
  const [activeConvId, setActiveConvId] = useState<string | null>(null)

  const [messages, setMessages] = useState<Msg[]>(initialMessages)
  const [composerText, setComposerText] = useState('')
  const [previewRole, setPreviewRole] = useState<'企业管理员' | '销售成员'>('企业管理员')
  const [citation, setCitation] = useState<CitationData | null>(null)
  const [configTarget, setConfigTarget] = useState<AssistantItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [reasonOpenFor, setReasonOpenFor] = useState<string | null>(null)
  const [reasonSelected, setReasonSelected] = useState<string[]>([])

  // 头部「更多」菜单 / 清空对话
  const [moreOpen, setMoreOpen] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)

  // 临时文档（仅本次对话）
  const [tempDocs, setTempDocs] = useState<string[]>([])

  // 评测中心
  const [evalOpen, setEvalOpen] = useState(false)
  const [evalRunning, setEvalRunning] = useState(false)
  const [evalResults, setEvalResults] = useState<EvalQuestion[] | null>(null)
  const [improvedIds, setImprovedIds] = useState<string[]>([])

  const citationTriggerRef = useRef<HTMLElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const evalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout)
      if (evalTimerRef.current) clearTimeout(evalTimerRef.current)
    },
    [],
  )

  const filteredHistory = useMemo(
    () => historyList.filter((c) => c.title.includes(historyQuery.trim())),
    [historyList, historyQuery],
  )

  // ---------- 发送与脚本命中 ----------

  const send = (raw?: string) => {
    const text = (raw ?? composerText).trim()
    if (!text || text.length > 2000) return
    if (messages.some((m) => m.kind === 'generating')) return
    const attached = [...tempDocs]
    setComposerText('')
    setReasonOpenFor(null)
    const userMsg: Msg = { id: nextMsgId(), kind: 'user', text, time: nowTime() }
    const genMsg: Msg = { id: nextMsgId(), kind: 'generating', stage: 0, time: nowTime() }
    setMessages((prev) => [...prev, userMsg, genMsg])

    // 流式占位：阶段文案逐段出现，随后替换为 AnswerCard / 拒答卡
    timersRef.current.push(
      setTimeout(() => {
        setMessages((prev) => prev.map((m) => (m.id === genMsg.id && m.kind === 'generating' ? { ...m, stage: 1 } : m)))
      }, 600),
    )
    timersRef.current.push(
      setTimeout(() => {
        setMessages((prev) => prev.map((m) => (m.id === genMsg.id && m.kind === 'generating' ? { ...m, stage: 2 } : m)))
      }, 1200),
    )
    timersRef.current.push(
      setTimeout(() => {
        const script = matchScript(text)
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== genMsg.id) return m
            if (script.answer) {
              return {
                id: genMsg.id,
                kind: 'answer',
                question: text,
                answer: script.answer,
                time: nowTime(),
                feedback: null,
                trimmed: previewRole === '销售成员',
              }
            }
            return { id: genMsg.id, kind: 'refusal', question: text, refusal: script.refusal!, time: nowTime() }
          }),
        )
        if (attached.length > 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: nextMsgId(),
              kind: 'ai-text',
              text: `以上回答已结合你上传的临时文档「${attached.join('」「')}」。临时文档仅用于本次对话，不会写入知识库。`,
              time: nowTime(),
            },
          ])
        }
      }, 1800),
    )
  }

  const cancelGenerate = (id: string) => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id && m.kind === 'generating'
          ? { id, kind: 'ai-text', text: `已取消生成。${GENERATE_STAGES[m.stage]}（本次生成未完成，内容仅保留已生成部分）`, time: nowTime() }
          : m,
      ),
    )
  }

  // ---------- 反馈 ----------

  const handleFeedback = (msg: Extract<Msg, { kind: 'answer' }>, type: 'correct' | 'wrong' | 'ask') => {
    if (type === 'ask') {
      composerRef.current?.focus()
      toast.info('可以继续追问，我会结合上下文给出有出处的回答。')
      return
    }
    if (type === 'correct') {
      setMessages((prev) => prev.map((m) => (m.id === msg.id && m.kind === 'answer' ? { ...m, feedback: 'correct' } : m)))
      addFeedback({ type: 'correct', question: msg.question, answerExcerpt: msg.answer.conclusion, source: 'ai-assistant' })
      toast.success('已确认答案正确，感谢反馈。')
      return
    }
    // wrong：展开 8 原因选项
    setReasonOpenFor(msg.id)
    setReasonSelected([])
  }

  const submitWrongReasons = (msg: Extract<Msg, { kind: 'answer' }>) => {
    if (reasonSelected.length === 0) return
    setMessages((prev) => prev.map((m) => (m.id === msg.id && m.kind === 'answer' ? { ...m, feedback: 'wrong' } : m)))
    addFeedback({
      type: 'wrong',
      question: msg.question,
      answerExcerpt: msg.answer.conclusion,
      source: 'ai-assistant',
      note: reasonSelected.join('、'),
    })
    setReasonOpenFor(null)
    toast.success('已提交反馈，将生成知识问题并进入反馈与洞察队列。')
  }

  // ---------- 拒答卡三动作 ----------

  const refusalActions = (msg: Extract<Msg, { kind: 'refusal' }>) => ({
    onUpload: () => navigate('/workspace/knowledge-base'),
    onAssign: () => {
      addTask({
        group: '知识完善',
        title: `补充「${msg.question}」相关知识`,
        reason: `AI 助手拒答：${msg.refusal.reason}`,
        priority: '高',
        status: '待处理',
        due: '明天 12:00',
        owner: '李娜',
      })
      toast.success('已指派给 Owner 李娜，治理任务已生成（每日待办与反馈页可见）。')
    },
    onRephrase: () => {
      setComposerText('报价折扣超过 10% 需要谁审批？')
      composerRef.current?.focus()
    },
  })

  // ---------- 历史删除/撤销 ----------

  const deleteConversation = (id: string) => {
    const target = historyList.find((c) => c.id === id)
    if (!target) return
    setHistoryList((prev) => prev.filter((c) => c.id !== id))
    toast.info('对话已删除（业务对象不受影响）。', {
      action: { label: '撤销', onClick: () => setHistoryList((prev) => [target, ...prev]) },
    })
  }

  // ---------- 创建助手 ----------

  const createAssistant = (templateKey: string) => {
    const tpl = assistantTemplates.find((t) => t.key === templateKey)!
    const item: AssistantItem = {
      id: `asst-new-${Date.now()}`,
      icon: '✨',
      name: `${tpl.name}（草稿）`,
      status: '草稿',
      desc: `${tpl.audience} · ${tpl.scope} · v0.1`,
      audience: tpl.audience,
      scope: tpl.scope,
      version: 'v0.1',
      welcome: `你好，我是${tpl.name}。`,
      suggested: ['差旅报销标准是什么？', '报价折扣超过 10% 需要谁审批？'],
      principles: ['只回答有出处的内容', '找不到时明确告知', '不猜测价格与承诺'],
    }
    setAssistantList((prev) => [...prev, item])
    setCreateOpen(false)
    setActiveAssistantId(item.id)
    toast.success(`已基于「${tpl.name}」模板创建草稿助手。`)
  }

  const assistantStatusTone: Record<AssistantItem['status'], string> = {
    已发布: 'bg-success-bg text-success',
    试用中: 'bg-info-bg text-info',
    草稿: 'bg-neutral-100 text-neutral-500',
  }

  // ---------- 配置抽屉保存/发布回写 ----------

  const handleConfigSave = (values: AssistantConfigValues, mode: 'draft' | 'publish') => {
    if (!configTarget) return
    const targetId = configTarget.id
    setAssistantList((prev) =>
      prev.map((a) => {
        if (a.id !== targetId) return a
        const scopeStr = values.knowledge.length >= KNOWLEDGE_OPTIONS.length ? '全部知识空间' : values.knowledge.join(' / ') || a.scope
        const audienceStr = values.audience.join('+') || a.audience
        let version = a.version
        let status = a.status
        if (mode === 'publish') {
          const m = /^v(\d+)\.(\d+)$/.exec(a.version)
          version = m ? `v${m[1]}.${Number(m[2]) + 1}` : 'v1.0'
          status = '已发布'
        }
        return {
          ...a,
          name: values.name,
          audience: audienceStr,
          audienceList: values.audience,
          scope: scopeStr,
          knowledge: values.knowledge,
          principles: values.principles,
          welcome: values.welcome,
          suggested: values.suggested,
          version,
          status,
          desc: `${audienceStr} · ${scopeStr} · ${version}`,
        }
      }),
    )
  }

  // ---------- 头部「更多」菜单 ----------

  const exportConversation = () => {
    setMoreOpen(false)
    const lines: string[] = [`# ${activeAssistant.name} 对话导出`, `导出时间：${new Date().toLocaleString()}`, '']
    for (const m of messages) {
      if (m.kind === 'user') lines.push(`[${m.time}] 我：${m.text}`)
      else if (m.kind === 'ai-text') lines.push(`[${m.time}] ${activeAssistant.name}：${m.text}`)
      else if (m.kind === 'answer') {
        lines.push(`[${m.time}] ${activeAssistant.name}：${m.answer.conclusion}（可信度 ${m.answer.trust}%）`)
        m.answer.points.forEach((p) => lines.push(`  - ${p}`))
        lines.push(`  引用：${m.answer.citations.map((c) => `${c.name} ${c.version} ${c.page}`).join('；')}`)
      } else if (m.kind === 'refusal') lines.push(`[${m.time}] ${activeAssistant.name}：${m.refusal.title}（原因：${m.refusal.reason}）`)
      else lines.push(`[${m.time}] （生成中，未完成）`)
      lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeAssistant.name}-对话导出.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('对话已导出为 .txt 文件。')
  }

  const clearConversation = () => {
    setClearConfirm(false)
    setMessages([{ id: nextMsgId(), kind: 'ai-text', text: activeAssistant.welcome, time: nowTime() }])
    toast.info('当前会话已清空，历史对话记录不受影响。')
  }

  // ---------- 临时文档 ----------

  const handleTempFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const names = Array.from(files).map((f) => f.name)
    setTempDocs((prev) => [...prev, ...names.filter((n) => !prev.includes(n))])
    toast.info(`已添加 ${names.length} 个临时文档，仅用于本次对话。`)
  }

  // ---------- 评测中心 ----------

  const runEvaluation = () => {
    if (evalRunning) return
    setEvalRunning(true)
    setEvalResults(null)
    if (evalTimerRef.current) clearTimeout(evalTimerRef.current)
    evalTimerRef.current = setTimeout(() => {
      setEvalResults(EVAL_SET)
      setEvalRunning(false)
    }, 2400)
  }

  const addImprovementTask = (q: EvalQuestion) => {
    addTask({
      group: '知识完善',
      title: `改进评测未通过问题：「${q.question}」`,
      reason: `评测得分 ${q.score}：${q.failNote ?? '回答未达预期'}；期望：${q.expected}`,
      priority: '高',
      status: '待处理',
      due: '本周五 18:00',
      owner: '李娜',
    })
    setImprovedIds((prev) => [...prev, q.id])
    toast.success('已创建改进任务，可在每日待办与反馈页跟进。')
  }

  const evalAvg = evalResults ? Math.round(evalResults.reduce((s, q) => s + q.score, 0) / evalResults.length) : 0

  return (
    <div className="flex h-[calc(100dvh-64px-48px)] min-h-[520px] flex-col">
      {/* 标题区 */}
      <PageHeader
        crumbs={[]}
        title="AI 助手"
        subtitle={
          demoOff ? '2 个业务助手 · 完成配置后开始真实问答' : '2 个业务助手 · 本周 328 次问答 · 认可率 87.6%'
        }
        actions={
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setLeftTab((t) => (t === 'history' ? 'assistants' : 'history'))}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-md border px-4 text-body transition-colors duration-micro ease-brand',
                leftTab === 'history'
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-[#BFD0F2] bg-white text-brand-600 hover:bg-brand-50',
              )}
            >
              <History className="h-4 w-4" />
              对话历史
            </button>
            <button
              type="button"
              onClick={() => setEvalOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#BFD0F2] bg-white px-4 text-body text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
            >
              <Sparkles className="h-4 w-4" />
              评测中心
            </button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 gap-4">
        {/* 左栏：助手 / 历史 */}
        <aside className="flex w-[300px] shrink-0 flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-card">
          <div className="mb-3 flex border-b border-neutral-100">
            {(
              [
                ['assistants', '助手'],
                ['history', '历史'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLeftTab(key)}
                className={cn(
                  'relative flex-1 pb-2.5 text-body-sm font-medium transition-colors duration-comp ease-brand',
                  leftTab === key ? 'text-brand-600' : 'text-neutral-500 hover:text-neutral-700',
                )}
              >
                {label}
                {leftTab === key && <motion.span layoutId="ai-asst-tab" className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-brand-500" />}
              </button>
            ))}
          </div>

          {leftTab === 'assistants' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mb-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-brand-600 px-3 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
              >
                <Plus className="h-4 w-4" />
                创建助手
              </button>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5">
                {assistantList.map((a) => {
                  const selected = a.id === activeAssistantId
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        'cursor-pointer rounded-lg border bg-white p-3 transition-colors duration-micro ease-brand',
                        selected ? 'border-[1.5px] border-brand-500 bg-surface-cardSel' : 'border-neutral-200 hover:border-brand-300',
                      )}
                      onClick={() => setActiveAssistantId(a.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-lg">{a.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-semibold text-neutral-950">{a.name}</p>
                          <span className={cn('mt-0.5 inline-flex h-5 items-center rounded-pill px-1.5 text-caption font-medium', assistantStatusTone[a.status])}>
                            {a.status}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1.5 text-caption text-neutral-500">{a.desc}</p>
                      {selected && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} className="mt-2.5 border-t border-neutral-100 pt-2.5">
                          <dl className="space-y-1 text-caption text-neutral-500">
                            <div className="flex gap-2">
                              <dt className="w-14 shrink-0">目标用户</dt>
                              <dd className="text-neutral-700">{a.audience}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="w-14 shrink-0">知识范围</dt>
                              <dd className="text-neutral-700">{a.scope}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="w-14 shrink-0">回答原则</dt>
                              <dd className="text-neutral-700">{a.principles.join('；')}</dd>
                            </div>
                          </dl>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfigTarget(a)
                            }}
                            className="mt-2 inline-flex items-center gap-0.5 text-body-sm text-brand-600 hover:text-brand-700"
                          >
                            配置
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </motion.div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-3 flex h-9 items-center gap-2 rounded-md border border-neutral-200 bg-surface-page px-2.5 focus-within:border-brand-500 focus-within:bg-white focus-within:shadow-input">
                <Search className="h-4 w-4 shrink-0 text-neutral-400" />
                <input
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder="搜索对话…"
                  className="w-full bg-transparent text-body-sm text-neutral-800 outline-none placeholder:text-neutral-400"
                />
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
                {(demoOff || filteredHistory.length === 0) && (
                  <div className="flex flex-col items-center py-10 text-center">
                    <img src="/empty-docs.svg" alt="" className="w-32 opacity-90" />
                    <p className="mt-3 text-body-sm text-neutral-500">{demoOff ? '还没有对话记录' : '没有匹配的对话记录'}</p>
                  </div>
                )}
                {(demoOff ? [] : filteredHistory).map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveConvId(c.id)}
                    className={cn(
                      'group flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors duration-micro ease-brand',
                      activeConvId === c.id ? 'border-brand-500 bg-surface-cardSel' : 'border-transparent hover:bg-neutral-50',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-medium text-neutral-950">{c.title}</p>
                      <p className="mt-0.5 text-caption text-neutral-500">
                        {c.assistant} · {c.time}
                      </p>
                    </div>
                    <button
                      type="button"
                      title="删除对话"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteConversation(c.id)
                      }}
                      className="mt-0.5 hidden h-6 w-6 shrink-0 items-center justify-center rounded-sm text-neutral-400 hover:bg-danger-bg hover:text-danger group-hover:flex"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* 右栏：对话工作区 */}
        <section className="flex min-w-0 flex-1 flex-col rounded-xl border border-neutral-200 bg-white shadow-card">
          {/* 头部 56px */}
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-lg">{activeAssistant.icon}</span>
              <span className="truncate text-body font-semibold text-neutral-950">{activeAssistant.name}</span>
              <StatusBadge status={activeAssistant.status} />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                value={previewRole}
                onChange={(e) => setPreviewRole(e.target.value as '企业管理员' | '销售成员')}
                className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-body-sm text-neutral-700 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:shadow-input"
                title="身份预览"
              >
                <option value="企业管理员">以企业管理员身份</option>
                <option value="销售成员">以销售成员身份预览</option>
              </select>
              <div className="relative">
                <button
                  type="button"
                  title="更多"
                  onClick={() => setMoreOpen((v) => !v)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
                    <div className="absolute right-0 top-10 z-40 w-44 rounded-lg border border-neutral-200 bg-white py-1 shadow-float">
                      <button
                        type="button"
                        onClick={exportConversation}
                        className="flex w-full items-center gap-2 px-3.5 py-2 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:bg-neutral-50"
                      >
                        <Download className="h-4 w-4 text-neutral-400" />
                        导出对话（.txt）
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMoreOpen(false)
                          setClearConfirm(true)
                        }}
                        className="flex w-full items-center gap-2 px-3.5 py-2 text-body-sm text-danger transition-colors duration-micro ease-brand hover:bg-danger-bg"
                      >
                        <Eraser className="h-4 w-4" />
                        清空对话
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* 身份预览提示条 */}
          <AnimatePresence>
            {previewRole === '销售成员' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24 }}
                className="shrink-0 overflow-hidden bg-violet-bg"
              >
                <p className="px-4 py-2 text-caption text-violet">正在以销售成员身份预览，部分内部内容将被裁剪。</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 消息流 */}
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-soft px-5 py-5">
            {messages.map((m) => {
              if (m.kind === 'user') {
                return (
                  <motion.div key={m.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }} className="flex justify-end">
                    <div className="flex max-w-[75%] flex-col items-end">
                      <div className="flex items-end gap-2">
                        <div className="rounded-lg bg-surface-user px-3.5 py-2.5 text-body text-brand-700">
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        </div>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-body-sm font-semibold text-brand-600">
                          {me.avatar}
                        </span>
                      </div>
                      <span className="mt-1 flex items-center gap-1 text-caption text-neutral-400">
                        {m.time}
                        <CheckCheck className="h-3.5 w-3.5 text-brand-500" />
                      </span>
                    </div>
                  </motion.div>
                )
              }
              if (m.kind === 'ai-text') {
                return (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="flex justify-start">
                    <div className="max-w-[85%]">
                      <div className="rounded-lg bg-surface-assistant px-3.5 py-2.5 text-body text-neutral-800">
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      </div>
                      {m.id === messages[0]?.id && (
                        <QuickChips className="mt-2.5" chips={activeAssistant.suggested.slice(0, 3)} onSelect={(chip) => send(chip)} />
                      )}
                      <span className="mt-1 block text-caption text-neutral-400">{m.time}</span>
                    </div>
                  </motion.div>
                )
              }
              if (m.kind === 'generating') {
                return (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="flex justify-start">
                    <div className="flex items-center gap-2.5 rounded-lg bg-surface-assistant px-3.5 py-2.5">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={m.stage}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.12 }}
                          className="text-body-sm text-neutral-500"
                        >
                          {GENERATE_STAGES[m.stage]}
                        </motion.span>
                      </AnimatePresence>
                      <button
                        type="button"
                        onClick={() => cancelGenerate(m.id)}
                        className="ml-2 rounded-sm border border-neutral-300 bg-white px-2 py-0.5 text-caption text-neutral-500 hover:border-danger-border hover:text-danger"
                      >
                        取消生成
                      </button>
                    </div>
                  </motion.div>
                )
              }
              if (m.kind === 'answer') {
                return (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                    <AnswerCard
                      question={m.question}
                      conclusion={m.answer.conclusion}
                      citations={m.answer.citations.length}
                      trust={m.answer.trust}
                      trustNote={m.answer.trustNote}
                      feedback={m.feedback}
                      onFeedback={(type) => handleFeedback(m, type)}
                      className="max-w-[860px]"
                    >
                      <ul className="mt-4 space-y-1.5">
                        {m.answer.points.map((p, i) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.12, delay: 0.12 * i }}
                            className="flex items-start gap-2 text-body text-neutral-700"
                          >
                            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                            {p}
                          </motion.li>
                        ))}
                      </ul>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {m.answer.citations.map((c) => (
                          <div
                            key={`${c.name}-${c.page}`}
                            onClickCapture={(ev) => {
                              citationTriggerRef.current = (ev.target as HTMLElement).closest('button')
                            }}
                          >
                            <CitationCard
                              name={c.name}
                              version={c.version}
                              page={c.page}
                              primary={c.primary}
                              onClick={() => setCitation(c)}
                            />
                          </div>
                        ))}
                      </div>
                      {m.trimmed && (
                        <p className="mt-3 rounded-md bg-violet-bg px-3 py-2 text-caption text-violet">已按当前身份裁剪 2 个来源</p>
                      )}
                      {/* 👎 反馈原因 8 选项 */}
                      <AnimatePresence>
                        {reasonOpenFor === m.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 rounded-lg border border-neutral-200 bg-surface-soft p-4">
                              <p className="text-body-sm font-medium text-neutral-800">答案哪里有问题？（可多选）</p>
                              <div className="mt-2.5 flex flex-wrap gap-2">
                                {FEEDBACK_REASONS.map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() =>
                                      setReasonSelected((prev) => (prev.includes(r) ? prev.filter((v) => v !== r) : [...prev, r]))
                                    }
                                    className={cn(
                                      'inline-flex h-8 items-center rounded-md border px-3 text-body-sm transition-colors duration-micro ease-brand',
                                      reasonSelected.includes(r)
                                        ? 'border-danger bg-danger-bg text-danger'
                                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-brand-300',
                                    )}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                              <div className="mt-3 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setReasonOpenFor(null)}
                                  className="h-9 rounded-md px-3 text-body-sm text-neutral-500 hover:bg-neutral-100"
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  disabled={reasonSelected.length === 0}
                                  onClick={() => submitWrongReasons(m)}
                                  className={cn(
                                    'h-9 rounded-md px-4 text-body-sm font-medium text-white',
                                    reasonSelected.length === 0
                                      ? 'cursor-not-allowed bg-neutral-100 text-neutral-400'
                                      : 'bg-brand-600 hover:bg-brand-500',
                                  )}
                                >
                                  提交反馈
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </AnswerCard>
                  </motion.div>
                )
              }
              // refusal
              const actions = refusalActions(m)
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="max-w-[860px]">
                  <NoAnswerCard data={m.refusal} {...actions} />
                </motion.div>
              )
            })}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-neutral-200 bg-white px-5 py-3.5">
            {/* 临时文档 Chips（输入区上方，可移除） */}
            {tempDocs.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-caption text-neutral-400">临时文档（仅本次对话）：</span>
                {tempDocs.map((name) => (
                  <span key={name} className="inline-flex h-7 items-center gap-1 rounded-pill bg-brand-50 pl-2.5 pr-1.5 text-caption font-medium text-brand-700">
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[200px] truncate">{name}</span>
                    <button
                      type="button"
                      aria-label={`移除临时文档 ${name}`}
                      onClick={() => setTempDocs((prev) => prev.filter((n) => n !== name))}
                      className="flex h-4 w-4 items-center justify-center rounded-full text-brand-400 hover:bg-brand-100 hover:text-brand-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="rounded-lg border border-[#DCE4EF] bg-white transition-shadow duration-micro ease-brand focus-within:border-brand-500 focus-within:shadow-input">
              <textarea
                ref={composerRef}
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    send()
                  }
                }}
                rows={2}
                maxLength={2000}
                placeholder="输入你的问题（1–2000 字），Enter 发送，Shift+Enter 换行；可 @ 引用上下文…"
                className="w-full resize-none rounded-t-lg bg-transparent px-3 pt-2.5 text-body text-neutral-800 outline-none placeholder:text-neutral-400"
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md,.pptx,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    handleTempFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  title="上传临时文档（仅用于本次对话，不写入知识库）"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-brand-600"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => send()}
                  disabled={!composerText.trim()}
                  title="发送"
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-micro ease-brand',
                    composerText.trim()
                      ? 'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700'
                      : 'cursor-not-allowed bg-neutral-100 text-neutral-400',
                  )}
                >
                  <SendHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 引用抽屉（Esc 关闭，焦点返回引用按钮） */}
      <CitationDrawer citation={citation} onClose={() => setCitation(null)} returnFocusRef={citationTriggerRef} />

      {/* 助手配置 Drawer */}
      <AssistantConfigDrawer
        assistant={configTarget}
        onClose={() => setConfigTarget(null)}
        onToast={(msg, kind = 'success') => toast[kind](msg)}
        onSave={handleConfigSave}
      />

      {/* 清空对话 L2 确认 */}
      <Modal open={clearConfirm} onClose={() => setClearConfirm(false)} width={560}>
        <ConfirmationCard
          title="清空当前对话"
          description="仅清空当前会话窗口，不影响历史对话记录与助手配置"
          fields={[
            { label: '动作', value: `清空「${activeAssistant.name}」当前会话的 ${messages.length} 条消息` },
            { label: '影响对象', value: '当前会话窗口' },
            { label: '影响范围', value: '清空后回到欢迎语，未发送的输入内容保留' },
            { label: '可撤销性', value: '不可恢复；历史 Tab 中的会话记录不受影响' },
          ]}
          confirmText="确认清空"
          onConfirm={clearConversation}
          onCancel={() => setClearConfirm(false)}
        />
      </Modal>

      {/* 评测中心 Drawer */}
      <SideDrawer
        open={evalOpen}
        onClose={() => setEvalOpen(false)}
        title="评测中心"
        width={640}
        footer={
          <>
            <span className="mr-auto text-caption text-neutral-400">
              {evalResults ? `最近运行：通过 ${evalResults.filter((q) => q.passed).length}/${evalResults.length} · 平均分 ${evalAvg}` : `测试集 ${EVAL_SET.length} 题 · 尚未运行`}
            </span>
            <button
              type="button"
              onClick={runEvaluation}
              disabled={evalRunning}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-md px-5 text-body-sm font-medium text-white transition-colors duration-micro ease-brand',
                evalRunning ? 'cursor-not-allowed bg-neutral-100 text-neutral-400' : 'bg-brand-600 hover:bg-brand-500 active:bg-brand-700',
              )}
            >
              {evalRunning && <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500" />}
              {evalRunning ? '正在运行评测…' : evalResults ? '重新运行评测' : '运行评测'}
            </button>
          </>
        }
      >
        <p className="text-body-sm text-neutral-500">
          用预置测试集检验「{activeAssistant.name}」的回答质量：每题核对期望答案与引用来源，未通过项可一键加入改进。
        </p>

        {evalRunning && (
          <div className="mt-4 rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center gap-2.5 text-body-sm text-neutral-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
              正在逐题运行 {EVAL_SET.length} 个测试问题并校验引用…
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-pill bg-neutral-100">
              <motion.div
                initial={{ width: '4%' }}
                animate={{ width: '96%' }}
                transition={{ duration: 2.3, ease: 'easeInOut' }}
                className="h-full rounded-pill bg-brand-500"
              />
            </div>
          </div>
        )}

        {evalResults && !evalRunning && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-success-bg p-3 text-center">
              <p className="text-h3 text-success">{evalResults.filter((q) => q.passed).length}</p>
              <p className="mt-0.5 text-caption text-success">通过</p>
            </div>
            <div className="rounded-lg bg-danger-bg p-3 text-center">
              <p className="text-h3 text-danger">{evalResults.filter((q) => !q.passed).length}</p>
              <p className="mt-0.5 text-caption text-danger">未通过</p>
            </div>
            <div className="rounded-lg bg-brand-50 p-3 text-center">
              <p className="text-h3 text-brand-700">{evalAvg}</p>
              <p className="mt-0.5 text-caption text-brand-600">平均分</p>
            </div>
          </div>
        )}

        <ul className="mt-4 space-y-2">
          {EVAL_SET.map((q) => {
            const result = evalResults?.find((r) => r.id === q.id)
            return (
              <li key={q.id} className="rounded-lg border border-neutral-200 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-body-sm font-medium text-neutral-950">{q.question}</p>
                  {result && (
                    <span
                      className={cn(
                        'shrink-0 rounded-pill px-2 py-0.5 text-caption font-medium',
                        result.passed ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger',
                      )}
                    >
                      {result.passed ? '通过' : '未通过'} · {result.score}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-caption text-neutral-500">期望：{q.expected}</p>
                {result && !result.passed && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-danger-bg px-2.5 py-2">
                    <span className="min-w-0 flex-1 text-caption text-danger">{result.failNote}</span>
                    <button
                      type="button"
                      disabled={improvedIds.includes(q.id)}
                      onClick={() => addImprovementTask(q)}
                      className={cn(
                        'shrink-0 rounded-md px-2.5 py-1 text-caption font-medium transition-colors duration-micro ease-brand',
                        improvedIds.includes(q.id)
                          ? 'cursor-not-allowed bg-neutral-100 text-neutral-400'
                          : 'bg-brand-600 text-white hover:bg-brand-500',
                      )}
                    >
                      {improvedIds.includes(q.id) ? '已加入改进' : '加入改进'}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </SideDrawer>

      {/* 创建助手：模板选择 Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="创建助手" description="选择模板快速创建，创建后为草稿状态" width={720}>
        <div className="grid grid-cols-2 gap-3">
          {assistantTemplates.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => createAssistant(t.key)}
              className="rounded-lg border border-neutral-200 bg-white p-4 text-left transition-colors duration-micro ease-brand hover:border-brand-500 hover:bg-surface-cardSel"
            >
              <p className="flex items-center gap-2 text-body font-semibold text-neutral-950">
                <Bot className="h-4 w-4 text-brand-600" />
                {t.name}
              </p>
              <p className="mt-1.5 text-body-sm text-neutral-500">{t.desc}</p>
              <p className="mt-2 text-caption text-neutral-400">目标用户：{t.audience}</p>
              <p className="text-caption text-neutral-400">知识范围：{t.scope}</p>
            </button>
          ))}
        </div>
      </Modal>

    </div>
  )
}
