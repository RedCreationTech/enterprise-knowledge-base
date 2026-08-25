/**
 * OnlineQAWidget — 知识网站「在线提问」浮动窗（design/knowledge-site.md §3.5，还原 UI 图4 右下浮动窗）。
 * - 可最小化（收起为右下浮动按钮 + 未读红点）/ 关闭（页面底部提示旁可重新打开）
 * - 回答含 ≥1 引用链接（点击开文档 Drawer）；反馈「答案正确 / 答案有问题 / 内容已过期」写入 store.feedbacks（feedback 页可见）
 * - 无法回答时展示 No-answer 卡（原因 / 已检索范围 / 提交反馈）
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ExternalLink, FileQuestion, MessageCircle, Minus, Send, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/mocks'
import { answer as canonicalAnswer } from '@/mocks/base.mock'
import type { FeedbackType } from '@/mocks'
import { useAppToast } from '@/lib/toast'

export interface QALink {
  label: string
}

interface QAMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  time: string
  /** 该 AI 回答对应的用户问题（反馈写回用） */
  question?: string
  links?: QALink[]
  noAnswer?: boolean
  feedback?: FeedbackType | null
  noAnswerSubmitted?: boolean
}

function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const API_ANSWER = `集成我们的 API 主要包括以下步骤：
1. 申请 API Key 并完成鉴权；
2. 根据文档选择对应的 API 接口；
3. 按照请求示例构造并发送请求；
4. 处理返回结果与错误码。
详细流程请参考以下文档：`

/** 折扣审批类问题（含常见变体）命中 base.mock 权威答案，与 /trial/verify、AI 助手口径一致 */
const DISCOUNT_ANSWER = `${canonicalAnswer.conclusion}
根据《销售管理制度》v2.1（第 8 页，主要依据）、《价格管理办法》v1.3（第 5 页）与《审批权限矩阵表》v3.0（第 2 页）：客户报价折扣超过 10% 时，须由销售总监审批后方可对外报价。
可信度 ${canonicalAnswer.trust}% · 引用 ${canonicalAnswer.citations} 处权威文档：`

const DISCOUNT_LINKS: QALink[] = canonicalAnswer.docs.map((d) => ({
  label: `${d.name}${d.version} ${d.page}${d.tag ? `·${d.tag}` : ''}`,
}))

/** 模拟回答脚本：命中关键词给出带引用回答，超出知识范围给出 No-answer 卡 */
function replyFor(q: string): Pick<QAMessage, 'content' | 'links' | 'noAnswer'> {
  if (/折扣|报价/.test(q) && /审批|权限/.test(q)) {
    return {
      content: DISCOUNT_ANSWER,
      links: DISCOUNT_LINKS,
    }
  }
  if (/api|接口|集成|鉴权/i.test(q)) {
    return {
      content: API_ANSWER,
      links: [{ label: 'API 接入指南（v2.0）' }, { label: 'API 鉴权与签名机制' }],
    }
  }
  if (/密码|找回|登录/.test(q)) {
    return {
      content: '找回密码的步骤：1. 在登录页点击「忘记密码」；2. 输入注册邮箱或手机号；3. 查收重置链接并在 30 分钟内完成重置。如未收到邮件请检查垃圾邮件目录。',
      links: [{ label: '账号与登录常见问题' }],
    }
  }
  if (/发票/.test(q)) {
    return {
      content: '申请发票：进入「控制台 - 订单中心」选择对应订单，点击「申请发票」，支持增值税普通发票与专用发票，1–3 个工作日开具并发送至邮箱。',
      links: [{ label: '服务支持流程与 SLA 说明' }],
    }
  }
  if (/支付|付款/.test(q)) {
    return {
      content: '目前支持对公转账、支付宝与微信支付。企业版客户可申请月度账期，具体请联系您的客户成功经理。',
      links: [{ label: '产品定价与版本说明' }],
    }
  }
  if (/股价|食堂|班车|天气/.test(q)) {
    return {
      content: '未找到可靠答案。该问题超出当前知识库覆盖范围（产品与服务相关内容），为避免误导暂不生成回答。',
      noAnswer: true,
    }
  }
  return {
    content: `关于「${q}」：已为你检索知识库相关内容。建议先阅读对应分类下的最新文档，其中包含完整的操作步骤与注意事项；如需人工支持，可在反馈中说明具体场景。`,
    links: [{ label: '如何创建项目与团队' }],
  }
}

let qaUid = 0
function nextId() {
  qaUid += 1
  return qaUid
}

const FEEDBACK_BTNS: { type: FeedbackType; label: string; icon: typeof ThumbsUp; activeCls: string }[] = [
  { type: 'correct', label: '答案正确', icon: ThumbsUp, activeCls: 'border-success bg-success-bg text-success' },
  { type: 'wrong', label: '答案有问题', icon: ThumbsDown, activeCls: 'border-danger bg-danger-bg text-danger' },
  { type: 'expired', label: '内容已过期', icon: FileQuestion, activeCls: 'border-warning-accent bg-warning-bg text-warning' },
]

export interface OnlineQAWidgetProps {
  state: 'open' | 'min' | 'closed'
  onMinimize: () => void
  onClose: () => void
  onReopen: () => void
  /** 外部触发的问题（如点击热门问题），设置后自动发送 */
  externalQuestion: string | null
  onConsumeExternal: () => void
  onOpenDoc: (title: string) => void
}

export function OnlineQAWidget({ state, onMinimize, onClose, onReopen, externalQuestion, onConsumeExternal, onOpenDoc }: OnlineQAWidgetProps) {
  const { addFeedback } = useAppStore()
  const toast = useAppToast()
  const [messages, setMessages] = useState<QAMessage[]>(() => [
    { id: nextId(), role: 'user', content: '如何集成你们的 API？', time: '10:28' },
    {
      id: nextId(),
      role: 'assistant',
      content: API_ANSWER,
      time: '10:28',
      question: '如何集成你们的 API？',
      links: [{ label: 'API 接入指南（v2.0）' }, { label: 'API 鉴权与签名机制' }],
      feedback: null,
    },
  ])
  const [input, setInput] = useState('')
  const [unread, setUnread] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const send = (text: string) => {
    const q = text.trim()
    if (!q) return
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: q, time: nowTime() }])
    setInput('')
    timerRef.current = setTimeout(() => {
      const reply = replyFor(q)
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', time: nowTime(), question: q, feedback: null, ...reply },
      ])
      if (stateRef.current === 'min') setUnread((n) => n + 1)
    }, 700)
  }

  // 点击热门问题 → 打开窗口并自动发送
  useEffect(() => {
    if (externalQuestion) {
      send(externalQuestion)
      onConsumeExternal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuestion])

  useEffect(() => {
    if (state === 'open') setUnread(0)
  }, [state])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, state])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleFeedback = (msg: QAMessage, type: FeedbackType) => {
    if (msg.feedback) return
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, feedback: type } : m)))
    addFeedback({
      type,
      question: msg.question,
      answerExcerpt: msg.content.slice(0, 60),
      source: 'knowledge-site',
    })
    toast.success('感谢反馈，已记录到反馈队列')
  }

  const handleNoAnswerSubmit = (msg: QAMessage) => {
    if (msg.noAnswerSubmitted) return
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, noAnswerSubmitted: true } : m)))
    addFeedback({
      type: 'no-answer',
      question: msg.question,
      answerExcerpt: msg.content.slice(0, 60),
      source: 'knowledge-site',
      note: '在线提问未命中知识库',
    })
    toast.success('已提交反馈，我们会补充该主题资料')
  }

  return (
    <>
      {/* 最小化态：右下浮动按钮 */}
      <AnimatePresence>
        {state === 'min' && (
          <motion.button
            key="fab"
            type="button"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={onReopen}
            className="fixed bottom-6 right-6 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-float transition-colors duration-micro ease-brand hover:bg-brand-500"
            aria-label="打开在线提问"
          >
            <MessageCircle className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-danger" />}
          </motion.button>
        )}
      </AnimatePresence>

      {/* 展开态：浮动聊天面板 */}
      <AnimatePresence>
        {state === 'open' && (
          <motion.section
            key="panel"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed bottom-6 right-6 z-[60] flex h-[480px] w-[360px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-float"
            aria-label="在线提问"
          >
            {/* 标题栏 */}
            <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 px-4">
              <div className="flex items-center gap-2">
                <span className="text-body font-semibold text-neutral-950">在线提问</span>
                <span className="flex items-center gap-1 text-caption text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  在线
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onMinimize}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label="最小化"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {/* 消息区 */}
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="flex flex-col gap-3">
                {messages.map((m) =>
                  m.role === 'user' ? (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-col items-end"
                    >
                      <p className="max-w-[75%] whitespace-pre-line rounded-xl bg-surface-user px-3 py-2 text-body-sm text-brand-700">
                        {m.content}
                      </p>
                      <span className="mt-1 text-caption text-neutral-400">{m.time}</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-col items-start"
                    >
                      <div className={cn('max-w-[90%] rounded-xl px-3 py-2', m.noAnswer ? 'border border-warning-accent/30 bg-warning-bg' : 'bg-surface-assistant')}>
                        <p className="whitespace-pre-line text-body-sm text-neutral-800">{m.content}</p>
                        {m.noAnswer && (
                          <div className="mt-2 rounded-md bg-white/70 p-2 text-caption text-neutral-500">
                            <p>已检索范围：全部 5 个分类 · 128 篇文档</p>
                            <p className="mt-0.5">缺失类型：该主题资料</p>
                            <button
                              type="button"
                              disabled={m.noAnswerSubmitted}
                              onClick={() => handleNoAnswerSubmit(m)}
                              className={cn(
                                'mt-1.5 inline-flex h-7 items-center gap-1 rounded-md border px-2 text-caption transition-colors duration-micro ease-brand',
                                m.noAnswerSubmitted
                                  ? 'border-success bg-success-bg text-success'
                                  : 'border-neutral-200 bg-white text-brand-600 hover:bg-brand-50',
                              )}
                            >
                              {m.noAnswerSubmitted ? <Check className="h-3.5 w-3.5" /> : null}
                              {m.noAnswerSubmitted ? '已提交反馈' : '提交反馈'}
                            </button>
                          </div>
                        )}
                        {m.links && m.links.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1">
                            {m.links.map((l) => (
                              <button
                                key={l.label}
                                type="button"
                                onClick={() => onOpenDoc(l.label)}
                                className="inline-flex items-center gap-1 text-left text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500 hover:underline"
                              >
                                {l.label}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* 反馈行 */}
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {FEEDBACK_BTNS.map((b) => {
                          const Icon = b.icon
                          const active = m.feedback === b.type
                          return (
                            <button
                              key={b.type}
                              type="button"
                              disabled={Boolean(m.feedback) && !active}
                              onClick={() => handleFeedback(m, b.type)}
                              className={cn(
                                'inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-caption transition-colors duration-micro ease-brand',
                                active ? b.activeCls : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50',
                                Boolean(m.feedback) && !active && 'cursor-not-allowed opacity-40',
                              )}
                            >
                              <Icon className="h-3 w-3" />
                              {b.label}
                            </button>
                          )
                        })}
                      </div>
                      <span className="mt-1 text-caption text-neutral-400">{m.time}</span>
                    </motion.div>
                  ),
                )}
              </div>
            </div>

            {/* Composer */}
            <footer className="shrink-0 border-t border-neutral-200 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send(input)
                    }
                  }}
                  rows={1}
                  placeholder="请输入你的问题…"
                  className="max-h-24 min-h-[40px] flex-1 resize-none rounded-md border border-neutral-200 px-3 py-2 text-body-sm text-neutral-800 outline-none transition-shadow duration-micro ease-brand placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-input"
                />
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={!input.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white transition-colors duration-micro ease-brand hover:bg-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
                  aria-label="发送"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-caption text-neutral-400">Enter 发送，Shift + Enter 换行</p>
            </footer>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}
