/**
 * 验证答案 /workspace/verify-answer（V1.4 迁入 WorkspaceShell；原 /trial/verify 已 301）
 * 标题区：面包屑「工作台 / 验证答案」+ H1 + 副标题 + ?from=trial 试用提示条（仅试用期显示）
 * Trusted Answer 模板：左 对话与反馈 ≈40%（AnswerCard + 反馈闭环）/ 右 摘要+引用 ≈60%。
 * 「答案正确」点击锁定绿态并写 store answerAccepted；「答案有问题」展开 8 个原因选项；
 * 引用卡 ↔ 原文预览联动（选中句浅黄高亮 #FFF4C2）；主 CTA「创建业务助手」accepted 后启用 → /workspace/invite-team。
 * P0-2：页面问题来自 URL ?q=（快速配置页用户实际选择），答案/引用/可信度全部查 ANSWER_POOL；
 * q 未命中或追问无答案 → 拒答卡（不伪装成答案），严禁对任意问题返回同一结论。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  CircleAlert,
  ExternalLink,
  FileSearch,
  Layers,
  Play,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/mocks/store'
import { daily, isStepDone, JOURNEY_STEPS } from '@/mocks'
import { ANSWER_POOL, answer } from '@/mocks/base.mock'
import type { CannedAnswer } from '@/mocks/base.mock'
import { ChatPanel } from '@/components/chat'
import { AnswerCard, CitationCard, MetricCard, SafetyNote, SectionCard } from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { DemoModal, PrimaryButton, SecondaryButton } from './activation/ui'
import { useAppToast } from '@/lib/toast'

const PAGE = '/workspace/verify-answer'

// ---------- 小知脚本（verify-answer.md §3.1） ----------

const SCRIPT_AI_INTRO =
  '我们已为你准备了一个代表性问题，验证知识库的准确性与可追溯性。你也可以修改或提出其他问题。'

const REPLY_LEAD_IN = '已从知识库检索到答案，结论与引用来源如下：'

const REFUSAL_LEAD_IN = '未检索到足够可靠的企业知识，暂时无法回答这个问题，详情如下：'

const ANSWER_NOTE = '答案由知识库生成，可能包含不完整信息，请结合实际情况判断。'

const DIAGNOSIS =
  '感谢反馈，我已记录这个问题。诊断发现：两份报价政策文档存在版本冲突，建议确认最新生效版本后重新验证。'

// ---------- 反馈原因（8 选项） ----------

const WRONG_REASONS = [
  '结论错误',
  '内容不完整',
  '使用了旧版本',
  '引用不相关',
  '没有引用',
  '回答过度推断',
  '权限或敏感信息问题',
  '其他',
]

// ---------- 拒答卡数据（参考 ai-assistant NoAnswerCard 模式） ----------

interface RefusalInfo {
  title: string
  reason: string
  searchedScope: string
  missingType: string
  closestTopic: string
  closestMeta: string
}

const REFUSAL_BASE = {
  title: '没有找到足够可靠的企业知识，我暂时不回答这个问题。',
  searchedScope: '已检索：默认空间、产品资料、销售弹药库等 5 个空间，共 128 份文档',
  missingType: '缺失类型：与该问题直接相关的制度/方案文档',
}

/** q 参数未命中答案池：通用拒答 */
const REFUSAL_UNKNOWN_QUESTION: RefusalInfo = {
  ...REFUSAL_BASE,
  reason: '相关知识未收录或已有内容可信度不足',
  closestTopic: '《产品 X 白皮书》',
  closestMeta: 'v1.5 · 2025-11 更新',
}

/** 追问无预置答案：以当前问题的首要引用作为最接近主题 */
function buildFollowUpRefusal(entry: CannedAnswer): RefusalInfo {
  const primary = entry.citations[0]
  return {
    ...REFUSAL_BASE,
    reason: '该追问涉及的内容未被制度文档覆盖',
    closestTopic: primary?.doc ?? '《产品 X 白皮书》',
    closestMeta: primary ? `${primary.version} · ${primary.page}` : 'v1.5 · 2025-11 更新',
  }
}

/** 可渲染的答案形态：池条目或其追问答案（无 followUps） */
type ResolvedAnswer = Omit<CannedAnswer, 'followUps'>

/** 池引用 → CitationCard 视图模型 */
interface DocView {
  name: string
  version: string
  page: string
  primary: boolean
}

function toDocViews(entry: ResolvedAnswer): DocView[] {
  return entry.citations.map((c) => ({ name: c.doc, version: c.version, page: c.page, primary: c.role === '主要依据' }))
}

// ---------- 三份文档原文段落 mock（各 3 小节 + 1 句高亮句） ----------

interface DocSection {
  heading: string
  text: string
  highlight?: boolean
}

interface DocContent {
  chapter: string
  sections: DocSection[]
}

const DOC_CONTENTS: Record<string, DocContent> = {
  '《销售管理制度》': {
    chapter: '4. 价格与折扣管理',
    sections: [
      { heading: '4.1 折扣定义', text: '折扣是指在公司规定的价格基础上给予客户的价格优惠。' },
      { heading: '4.2 折扣审批权限', text: '当客户报价折扣超过 10% 时，需由销售总监审批。', highlight: true },
      { heading: '4.3 其他说明', text: '特殊项目或重大客户的折扣审批，可根据实际情况升级至更高权限。' },
    ],
  },
  '《价格管理办法》': {
    chapter: '3. 价格折扣与审批',
    sections: [
      { heading: '3.1 标准折扣范围', text: '销售代表可在标准价格基础上给予客户不超过 5% 的折扣。' },
      { heading: '3.2 超额折扣审批', text: '折扣超过 10% 的报价，须经销售总监审批后方可对外承诺。', highlight: true },
      { heading: '3.3 审批时限', text: '超额折扣的审批应在 2 个工作日内完成并同步至报价系统。' },
    ],
  },
  '《审批权限矩阵表》': {
    chapter: '2. 销售业务审批权限',
    sections: [
      { heading: '2.1 常规订单', text: '合同金额 50 万元以内且折扣不超过 10% 的订单，由销售经理审批。' },
      { heading: '2.2 超额折扣订单', text: '报价折扣超过 10% 的订单，审批权限为销售总监。', highlight: true },
      { heading: '2.3 重大客户', text: '战略客户或特殊条款的折扣，可升级至分管副总裁审批。' },
    ],
  },
}

// ---------- 页面 ----------

export default function VerifyAnswer() {
  const navigate = useNavigate()
  const { state, pushMessage, pushAssistantMessage, setReplyScript, acceptAnswer, addFeedback } = useAppStore()
  const toast = useAppToast()
  const [searchParams] = useSearchParams()
  /** V1.4：从 Stepper / 旅程进入时带 ?from=trial（提示条带返回旅程语义） */
  const fromTrial = searchParams.get('from') === 'trial'
  const trial = !state.journey.activated

  /** P0-2：用户实际提问来自 URL ?q=；无 q 回退默认折扣审批问题（与 pool 口径一致） */
  const qParam = searchParams.get('q')
  const mainEntry: CannedAnswer | null = qParam ? (ANSWER_POOL[qParam] ?? null) : ANSWER_POOL[answer.question]

  /** 问题 → 答案：先查答案池，再查当前条目追问；未命中（含无 answer 的追问）→ null → 拒答卡 */
  const resolveAnswer = (text: string): ResolvedAnswer | null => {
    const direct = ANSWER_POOL[text]
    if (direct) return direct
    const fu = mainEntry?.followUps.find((f) => f.question === text)
    return fu?.answer ?? null
  }

  const [selectedDoc, setSelectedDoc] = useState(0)
  const [wrongOpenFor, setWrongOpenFor] = useState<string | null>(null)
  const [wrongReasons, setWrongReasons] = useState<string[]>([])
  const [diagnosisOn, setDiagnosisOn] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const accepted = state.journey.answerAccepted

  // 小知脚本：命中 → 答案引导语；未命中 → 拒答引导语（不再对任意追问承诺同一结论）
  useEffect(() => {
    setReplyScript((text) => (resolveAnswer(text) ? REPLY_LEAD_IN : REFUSAL_LEAD_IN))
    return () => setReplyScript(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam])

  // 补齐初始会话：小知介绍 + 用户在快速配置页实际选择的问题（重复进入不重复注入）
  useEffect(() => {
    if (!state.chatMessages.some((m) => m.page === PAGE && m.content.includes('代表性问题'))) {
      pushAssistantMessage(SCRIPT_AI_INTRO, PAGE)
    }
    const asked = qParam ?? answer.question
    if (!state.chatMessages.some((m) => m.role === 'user' && m.page === PAGE && m.content === asked)) {
      pushMessage('user', asked, PAGE)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam])

  // 对话中本页的用户问题 → 按各自命中情况渲染 AnswerCard 或拒答卡
  const askedMessages = useMemo(
    () => state.chatMessages.filter((m) => m.role === 'user' && m.page === PAGE),
    [state.chatMessages],
  )

  /** 右栏摘要/引用跟随「最近一条命中的问题」，无命中时回退主问题条目 */
  const activeEntry: ResolvedAnswer | null = useMemo(() => {
    for (let i = askedMessages.length - 1; i >= 0; i -= 1) {
      const hit = resolveAnswer(askedMessages[i].content)
      if (hit) return hit
    }
    return mainEntry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askedMessages, mainEntry])

  const activeDocs = useMemo(() => (activeEntry ? toDocViews(activeEntry) : []), [activeEntry])

  // 切换活动答案时引用选中归位，避免越界
  useEffect(() => setSelectedDoc(0), [activeEntry])

  const selectDoc = (idx: number, scroll = false) => {
    setSelectedDoc(idx)
    if (scroll) previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const handleCorrect = () => {
    if (accepted) return
    acceptAnswer()
    toast.success('已确认答案正确')
  }

  const toggleReason = (r: string) =>
    setWrongReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))

  const submitWrong = (question: string, excerpt: string) => {
    addFeedback({
      type: 'wrong',
      question,
      answerExcerpt: excerpt,
      source: 'verify-answer',
      note: wrongReasons.length > 0 ? wrongReasons.join('、') : undefined,
    })
    setWrongOpenFor(null)
    setWrongReasons([])
    setDiagnosisOn(true)
    pushAssistantMessage(DIAGNOSIS, PAGE)
  }

  const handleCreate = () => {
    if (!accepted || creating) return
    setCreating(true)
    window.setTimeout(() => navigate('/workspace/invite-team'), 1200)
  }

  const doc: DocView | undefined = activeDocs[Math.min(selectedDoc, Math.max(activeDocs.length - 1, 0))]
  // 折扣审批三文档有逐段原文 mock；其余文档回退为「相关内容摘录」（高亮当前答案解释段，保持引用联动语义）
  const docContent: DocContent | null = doc
    ? (DOC_CONTENTS[doc.name] ?? {
        chapter: '相关内容摘录',
        sections: [{ heading: `${doc.version} ${doc.page}`, text: activeEntry?.explanation ?? '', highlight: true }],
      })
    : null

  /** 试用提示条「查看试用进度 ›」：回旅程最近未完成步（全完成则去 activated 交接页） */
  const goTrialProgress = () => {
    const idx = JOURNEY_STEPS.findIndex((_, i) => !isStepDone(state.journey, i))
    if (idx === -1) {
      navigate('/trial/activated')
      return
    }
    const path = JOURNEY_STEPS[idx].path
    navigate(path === '/trial/apps' ? '/workspace/apps?from=trial' : path === '/trial/daily' ? '/workspace/daily?from=trial' : path)
  }

  /** 「换个问题试试」：聚焦左栏输入框，引导用户重新提问 */
  const focusComposer = () => {
    document.querySelector<HTMLTextAreaElement>('textarea')?.focus()
  }

  /** 原文预览「在新窗口打开」：新窗口写入当前文档原文 HTML（高亮句保留） */
  const openDocInNewWindow = () => {
    if (!doc || !docContent) return
    const win = window.open('', '_blank')
    if (!win) {
      toast.warning('浏览器拦截了新窗口，请允许弹出后重试')
      return
    }
    const sections = docContent.sections
      .map(
        (s) => `        <p style="margin:0 0 14px;font-size:14px;line-height:1.9;color:#3A465C">
          <strong style="color:#1B2333">${s.heading}</strong>&#12288;${
            s.highlight
              ? `<span style="background:#FFF4C2;padding:1px 4px;border-radius:3px;font-weight:600;color:#1B2333">${s.text}</span>`
              : s.text
          }
        </p>`,
      )
      .join('\n')
    win.document.write(`<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${doc.name} ${doc.version} · 原文预览</title>
  </head>
  <body style="margin:0;background:#F5F7FB;font-family:-apple-system,'PingFang SC','Microsoft YaHei',system-ui,sans-serif">
    <main style="max-width:720px;margin:40px auto;background:#FFFFFF;border:1px solid #E4EAF2;border-radius:12px;padding:32px 36px">
      <h1 style="margin:0;font-size:20px;color:#101828">${doc.name}</h1>
      <p style="margin:6px 0 20px;font-size:13px;color:#98A2B3">${doc.version} · ${doc.page}</p>
      <h2 style="margin:0 0 16px;padding-bottom:10px;font-size:16px;color:#1B2333;border-bottom:1px solid #EEF2F7">${docContent.chapter}</h2>
${sections}
    </main>
  </body>
</html>`)
    win.document.close()
  }

  // 拒答卡（红左条 + 原因/检索范围/缺失类型/最接近主题 + 操作按钮；不伪装成答案）
  const renderRefusalCard = (info: RefusalInfo) => (
    <div className="flex overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="w-[3px] shrink-0 bg-danger" />
      <div className="min-w-0 flex-1 p-5">
        <div className="flex items-start gap-2.5">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <p className="text-body font-semibold text-neutral-950">{info.title}</p>
        </div>
        <div className="mt-3 space-y-1.5 pl-[30px] text-body-sm text-neutral-700">
          <p>原因：{info.reason}</p>
          <p className="text-neutral-500">{info.searchedScope}</p>
          <p className="text-neutral-500">{info.missingType}</p>
        </div>
        <div className="ml-[30px] mt-3 flex items-center gap-2 rounded-lg bg-surface-soft px-3 py-2.5">
          <FileSearch className="h-4 w-4 shrink-0 text-neutral-400" />
          <p className="text-body-sm text-neutral-700">
            最接近主题（不伪装成答案）：<span className="font-medium text-neutral-950">{info.closestTopic}</span>
            <span className="ml-1.5 text-caption text-neutral-500">{info.closestMeta}</span>
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 pl-[30px]">
          <button
            type="button"
            onClick={() => navigate('/workspace/quick-config')}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
          >
            返回快速配置
          </button>
          <button
            type="button"
            onClick={focusComposer}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
          >
            <RotateCcw className="h-4 w-4" />
            换个问题试试
          </button>
        </div>
      </div>
    </div>
  )

  // 每条用户问题独立查池：命中 → 对应 AnswerCard；未命中 → 拒答卡
  const renderAnswerCard = (m: (typeof askedMessages)[number]) => {
    const entry = resolveAnswer(m.content)
    if (!entry) {
      return (
        <motion.div
          key={m.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {renderRefusalCard(mainEntry ? buildFollowUpRefusal(mainEntry) : REFUSAL_UNKNOWN_QUESTION)}
        </motion.div>
      )
    }
    const docs = toDocViews(entry)
    const isActive = activeEntry === entry
    return (
      <motion.div
        key={m.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        className="rounded-lg bg-surface-assistant p-2"
      >
        <AnswerCard
          conclusion={entry.conclusion}
          explanation={entry.explanation}
          citations={entry.citations.length}
          trust={entry.trustScore}
          trustNote={entry.trustScore >= 90 ? '综合评估结果' : '建议人工复核'}
          feedback={accepted ? 'correct' : null}
          onFeedback={(type) => {
            if (type === 'correct') handleCorrect()
            else if (type === 'wrong') setWrongOpenFor(wrongOpenFor === m.id ? null : m.id)
            else if (mainEntry?.followUps[0]) pushMessage('user', mainEntry.followUps[0].question, PAGE)
          }}
          className="p-5 shadow-none"
        >
          {/* 引用来源 */}
          <p className="mt-5 text-body-sm font-semibold text-neutral-800">引用来源（{entry.citations.length}）</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {docs.map((d, i) => (
              <CitationCard
                key={d.name}
                name={d.name}
                version={d.version}
                page={d.page}
                primary={d.primary}
                selected={isActive && selectedDoc === i}
                onClick={isActive ? () => selectDoc(i, true) : undefined}
                className="items-start"
              />
            ))}
          </div>
          <p className="mt-3 text-caption text-neutral-500">{ANSWER_NOTE}</p>

          {/* 「答案有问题」原因面板 */}
          <AnimatePresence initial={false}>
            {wrongOpenFor === m.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-3 rounded-lg border border-danger-border bg-danger-bg/40 p-4">
                  <p className="text-body-sm font-medium text-neutral-800">答案哪里有问题？（可多选，也可跳过）</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {WRONG_REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleReason(r)}
                        className={cn(
                          'inline-flex h-7 items-center rounded-md border px-2.5 text-caption transition-colors duration-micro ease-brand',
                          wrongReasons.includes(r)
                            ? 'border-danger bg-danger-bg text-danger'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-danger-border',
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => submitWrong(m.content, entry.conclusion)}
                      className="inline-flex h-8 items-center rounded-md bg-danger px-3 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:brightness-110"
                    >
                      提交反馈
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWrongOpenFor(null)
                        setWrongReasons([])
                      }}
                      className="inline-flex h-8 items-center rounded-md px-3 text-body-sm text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100"
                    >
                      跳过
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

  return (
    <div className="flex flex-col gap-5">
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />

      {/* 标题区（Workspace 规范：面包屑 + H1 + 副标题） */}
      <PageHeader
        crumbs={['工作台', '验证答案']}
        title="验证知识：第一个可信答案"
        subtitle="让我们验证知识库能否给出准确、可追溯的答案"
      />

      {/* 试用提示条（仅试用期；激活后不显示） */}
      {trial && (
        <div className="flex h-8 items-center justify-between gap-3 rounded-lg bg-brand-100 px-3">
          <span className="truncate text-body-sm text-brand-700">
            🧭 试用第 {daily.trialDay} 天 · 验证第一个可信答案可推进激活进度
          </span>
          <button
            type="button"
            onClick={goTrialProgress}
            className="shrink-0 text-body-sm font-medium text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500 hover:underline"
          >
            {fromTrial ? '返回试用旅程 ›' : '查看试用进度 ›'}
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* 左栏：对话与反馈面板 40% */}
        <div className="w-[40%] min-w-[440px] max-w-[560px] shrink-0">
          <ChatPanel
            page={PAGE}
            composerPlaceholder="你还可以继续提问…"
            className="sticky top-20 h-[calc(100dvh-300px)] min-h-[560px]"
            timelineFooter={
              <div className="flex flex-col gap-3">
                {askedMessages.map((m) => renderAnswerCard(m))}
                {/* 诊断摘要卡（DiagnosisDiffCard 占位） */}
                {diagnosisOn && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                    className="rounded-lg border border-warning/40 bg-warning-bg p-4"
                  >
                    <p className="text-body-sm font-medium text-neutral-800">诊断摘要</p>
                    <p className="mt-1 text-body-sm text-neutral-700">
                      我发现两份报价政策存在版本冲突，建议确认最新生效版本后重新验证。
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setDiagnosisOn(false)
                        pushAssistantMessage('已按最新生效版本重新验证，结论不变：需要销售总监审批。', PAGE)
                      }}
                      className="mt-3 inline-flex h-8 items-center rounded-md border border-brand-300 bg-white px-3 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
                    >
                      重新验证
                    </button>
                  </motion.div>
                )}
              </div>
            }
          />
        </div>

        {/* 右栏：摘要 + 引用 60% */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* q 未命中答案池：整页拒答（不渲染任何伪造答案数据） */}
          {!activeEntry && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
              {renderRefusalCard(REFUSAL_UNKNOWN_QUESTION)}
            </motion.div>
          )}
          {activeEntry && (
            <>
          {/* 卡 1：为什么系统这样回答 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <SectionCard title="为什么系统这样回答">
              <div className="grid grid-cols-4 gap-3">
                <MetricCard
                  name="可信度"
                  value={activeEntry.trustScore}
                  suffix="%"
                  hint={activeEntry.trustScore >= 90 ? '综合评估结果' : '建议人工复核'}
                  icon={<ShieldCheck className="h-4 w-4" />}
                  className="p-4 shadow-none"
                />
                <MetricCard
                  name="引用来源"
                  value={activeEntry.citations.length}
                  hint="匹配的权威文档"
                  icon={<BookOpen className="h-4 w-4" />}
                  className="p-4 shadow-none"
                />
                <MetricCard
                  name="知识覆盖"
                  value={activeEntry.trustScore >= 90 ? 100 : 85}
                  suffix="%"
                  hint={activeEntry.trustScore >= 90 ? '问题已完全覆盖' : '部分细节未完全覆盖'}
                  icon={<Layers className="h-4 w-4" />}
                  className="p-4 shadow-none"
                />
                <MetricCard
                  name="幻觉风险"
                  value={activeEntry.trustScore >= 90 ? '低' : '中'}
                  hint={activeEntry.trustScore >= 90 ? '未检测到冲突信息' : '存在条款版本差异'}
                  icon={<TriangleAlert className="h-4 w-4 text-warning" />}
                  className="p-4 shadow-none"
                />
              </div>
            </SectionCard>
          </motion.div>

          {/* 卡 2：原文与引用 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
            ref={previewRef}
            className="scroll-mt-24"
          >
            <SectionCard title="原文与引用">
              <div className="flex gap-4">
                {/* 左：引用文档列表 */}
                <div className="flex w-[220px] shrink-0 flex-col gap-2">
                  {activeDocs.map((d, i) => (
                    <CitationCard
                      key={d.name}
                      name={d.name}
                      version={d.version}
                      page={d.page}
                      primary={d.primary}
                      selected={selectedDoc === i}
                      onClick={() => selectDoc(i)}
                      className="min-h-[64px] items-start"
                    />
                  ))}
                </div>
                {/* 右：原文预览 */}
                <div className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white">
                  <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                    <p className="text-body-sm font-medium text-neutral-950">
                      {doc?.name} {doc?.version} {doc?.page}
                    </p>
                    <button
                      type="button"
                      onClick={openDocInNewWindow}
                      className="inline-flex items-center gap-1 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500"
                    >
                      在新窗口打开
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={doc?.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                      className="px-4 py-4"
                    >
                      <h3 className="text-h3 text-neutral-950">{docContent?.chapter}</h3>
                      <div className="mt-3 space-y-3">
                        {(docContent?.sections ?? []).map((s) => (
                          <p key={s.heading} className="text-body leading-6 text-neutral-700">
                            <span className="font-medium text-neutral-800">{s.heading} </span>
                            {s.highlight ? (
                              <motion.span
                                initial={{ backgroundColor: 'rgba(255,244,194,0)' }}
                                animate={{ backgroundColor: 'rgba(255,244,194,1)' }}
                                transition={{ duration: 0.24 }}
                                className="rounded-sm px-1 py-0.5 font-medium text-neutral-900"
                              >
                                {s.text}
                              </motion.span>
                            ) : (
                              s.text
                            )}
                          </p>
                        ))}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </SectionCard>
          </motion.div>
            </>
          )}

          {/* 卡 3：推荐继续提问（来自当前答案条目的 followUps；有 answer → 对应答案，无 answer → 拒答卡） */}
          {mainEntry && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <SectionCard title="推荐继续提问">
              <div className="flex flex-wrap gap-2">
                {mainEntry.followUps.map((f) => (
                  <button
                    key={f.question}
                    type="button"
                    onClick={() => pushMessage('user', f.question, PAGE)}
                    className="inline-flex h-8 items-center rounded-md border border-neutral-200 bg-white px-3 text-body-sm text-neutral-700 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
                  >
                    {f.question}
                  </button>
                ))}
              </div>
            </SectionCard>
          </motion.div>
          )}

          {/* 底部 CTA 行 */}
          <div className="mt-1 flex items-center justify-end gap-3">
            <SecondaryButton onClick={() => setDemoOpen(true)}>
              <Play className="h-4 w-4" />
              查看 10 分钟演示
            </SecondaryButton>
            <PrimaryButton
              disabled={!accepted}
              loading={creating}
              loadingText="正在创建业务助手…"
              title={!accepted ? '请先点击「答案正确」确认答案' : undefined}
              onClick={handleCreate}
            >
              创建业务助手
              <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
          </div>

          {/* 本页安全声明 */}
          <SafetyNote variant="verify" className="mt-2" />
        </div>
      </div>
    </div>
  )
}
