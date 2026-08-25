/**
 * 知识网站 KnowledgeSite（KB00，design/knowledge-site.md，还原 ui-mockups 图4）
 * Hero 渐变区（linear-gradient(120deg,#EAF2FF,#F1EEFF)）+ 大搜索框（Enter 触发模拟问答 AnswerCard）
 * + 5 分类 chips + 热门分类 5 卡 + 最近更新 / 热门问题双列 + 右侧网站设置卡 + 在线提问浮动窗。
 */
import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  CircleHelp,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  LayoutGrid,
  MoreHorizontal,
  Package,
  Pencil,
  ReceiptText,
  Search,
  Settings2,
  Share2,
  Sparkles,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { site, useAppStore } from '@/mocks'
import { answer as canonicalAnswer } from '@/mocks/base.mock'
import type { AnswerDoc } from '@/mocks/base.mock'
import { AnswerCard, CitationCard, ConfirmationCard, SectionCard, StatusBadge } from '@/components/common'
import type { AnswerFeedback } from '@/components/common'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { useAppToast } from '@/lib/toast'
import { OnlineQAWidget } from '@/pages/workspace/OnlineQAWidget'

// ---------- 页面扩展 mock（design/knowledge-site.md §5） ----------

interface CategoryMeta {
  icon: LucideIcon
  /** 图标方块 40px 彩底 */
  iconCls: string
  /** 分类彩色 Chip */
  chipCls: string
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  产品介绍: { icon: Package, iconCls: 'bg-violet-bg text-violet', chipCls: 'bg-violet-bg text-violet' },
  使用指南: { icon: BookOpen, iconCls: 'bg-success-bg text-success', chipCls: 'bg-success-bg text-success' },
  常见问题: { icon: CircleHelp, iconCls: 'bg-warning-bg text-warning', chipCls: 'bg-warning-bg text-warning' },
  API文档: { icon: Code2, iconCls: 'bg-info-bg text-info', chipCls: 'bg-info-bg text-info' },
  售后服务: { icon: ReceiptText, iconCls: 'bg-cyan-bg text-cyan', chipCls: 'bg-cyan-bg text-cyan' },
}

const RECENT_UPDATES = [
  { title: '产品定价与版本说明', category: '产品介绍', time: '今天 10:23' },
  { title: '如何创建项目与团队', category: '使用指南', time: '昨天 16:45' },
  { title: 'API 鉴权与签名机制（v2.0）', category: 'API文档', time: '昨天 11:08' },
  { title: '常见故障排查与解决方案', category: '常见问题', time: '06-01 09:30' },
  { title: '服务支持流程与 SLA 说明', category: '售后服务', time: '05-31 18:22' },
]

const HOT_QUESTIONS = [
  { q: '如何快速开始使用我们的产品？', heat: '12.4k' },
  { q: '忘记密码如何找回？', heat: '8.7k' },
  { q: '支持哪些支付方式？', heat: '6.1k' },
  { q: 'API 调用频率限制是多少？', heat: '4.3k' },
  { q: '如何申请发票？', heat: '3.2k' },
]

/** 「查看全部」完整列表（首页仅展示 Top 5） */
const ALL_HOT_QUESTIONS = [
  ...HOT_QUESTIONS,
  { q: '如何配置团队成员权限？', heat: '2.8k' },
  { q: '知识库支持哪些数据来源？', heat: '2.1k' },
  { q: '同步失败如何排查？', heat: '1.6k' },
  { q: '如何导出知识地图？', heat: '1.2k' },
  { q: '离线环境能否私有化部署？', heat: '980' },
]

/** 「查看全部」完整更新列表（首页仅展示最近 5 条） */
const ALL_UPDATES = [
  ...RECENT_UPDATES,
  { title: '账号与登录常见问题', category: '常见问题', time: '05-30 18:44' },
  { title: '核心功能全景介绍', category: '产品介绍', time: '05-28 09:40' },
  { title: '工单提交与处理时效', category: '售后服务', time: '05-28 11:14' },
  { title: '权限与角色配置指南', category: '使用指南', time: '05-27 10:08' },
  { title: 'API 调用频率限制说明', category: 'API文档', time: '05-27 15:48' },
]

const RANK_COLORS = [
  'bg-warning text-white',
  'bg-warning text-white',
  'bg-brand-500 text-white',
  'bg-neutral-200 text-neutral-500',
  'bg-neutral-200 text-neutral-500',
]

/** 各分类文档列表（点击分类卡 → Drawer） */
const CATEGORY_DOCS: Record<string, { title: string; time: string }[]> = {
  产品介绍: [
    { title: '产品定价与版本说明', time: '今天 10:23' },
    { title: '产品 X 白皮书（v1.5）', time: '05-30 14:12' },
    { title: '核心功能全景介绍', time: '05-28 09:40' },
    { title: '产品与竞品对比手册', time: '05-26 17:05' },
    { title: '版本更新日志（5 月）', time: '05-25 11:32' },
  ],
  使用指南: [
    { title: '如何创建项目与团队', time: '昨天 16:45' },
    { title: '快速上手：10 分钟完成配置', time: '05-29 15:20' },
    { title: '权限与角色配置指南', time: '05-27 10:08' },
    { title: '知识空间管理最佳实践', time: '05-24 14:52' },
    { title: '数据导入与同步操作手册', time: '05-22 09:15' },
  ],
  常见问题: [
    { title: '常见故障排查与解决方案', time: '06-01 09:30' },
    { title: '账号与登录常见问题', time: '05-30 18:44' },
    { title: '搜索无结果排查指引', time: '05-28 13:26' },
    { title: '同步失败常见原因', time: '05-26 08:57' },
    { title: '用量与计费常见问题', time: '05-23 16:39' },
  ],
  API文档: [
    { title: 'API 鉴权与签名机制（v2.0）', time: '昨天 11:08' },
    { title: 'API 接入指南（v2.0）', time: '05-29 10:31' },
    { title: 'API 调用频率限制说明', time: '05-27 15:48' },
    { title: 'Webhook 事件订阅', time: '05-25 09:22' },
    { title: '错误码对照表', time: '05-21 14:06' },
  ],
  售后服务: [
    { title: '服务支持流程与 SLA 说明', time: '05-31 18:22' },
    { title: '工单提交与处理时效', time: '05-28 11:14' },
    { title: '客户成功服务计划', time: '05-26 16:50' },
    { title: '培训与认证服务介绍', time: '05-24 10:27' },
    { title: '服务变更通知渠道', time: '05-22 15:33' },
  ],
}

interface SiteAnswer {
  question: string
  conclusion: string
  explanation: string
  citations: number
  trust: number
  /** 权威答案的引用文档（命中 base.mock answer 时提供，用于渲染引用卡） */
  docs?: AnswerDoc[]
}

/** 折扣审批类问题（含常见变体）命中 base.mock 权威答案，与 /trial/verify、AI 助手口径一致 */
function isDiscountApprovalQuestion(q: string): boolean {
  return /折扣|报价/.test(q) && /审批|权限/.test(q)
}

/** Hero 搜索的模拟回答（问题式输入） */
function answerFor(q: string): SiteAnswer {
  if (isDiscountApprovalQuestion(q)) {
    return {
      question: q,
      conclusion: canonicalAnswer.conclusion,
      explanation: '根据公司制度要求，当客户报价折扣超过 10% 时，需由销售总监审批。',
      citations: canonicalAnswer.citations,
      trust: canonicalAnswer.trust,
      docs: canonicalAnswer.docs,
    }
  }
  if (/api|接口|集成|鉴权/i.test(q)) {
    return {
      question: q,
      conclusion: 'API 集成共 4 步：申请 Key → 选接口 → 发请求 → 处理结果。',
      explanation: '申请 API Key 并完成鉴权后，根据文档选择对应接口，按请求示例构造并发送请求，最后处理返回结果与错误码。',
      citations: 2,
      trust: 92,
    }
  }
  if (/密码|找回/.test(q)) {
    return {
      question: q,
      conclusion: '通过登录页「忘记密码」即可自助找回。',
      explanation: '输入注册邮箱或手机号后查收重置链接，30 分钟内完成重置；未收到邮件请检查垃圾邮件目录。',
      citations: 1,
      trust: 90,
    }
  }
  return {
    question: q,
    conclusion: '已为你找到相关知识，结论与出处如下。',
    explanation: '以下回答基于知识库中最新发布的权威文档生成，引用来源可追溯；如需更详细步骤可打开引用文档查看。',
    citations: 2,
    trust: 86,
  }
}

function isQuestion(text: string): boolean {
  return /[？?]\s*$/.test(text) || /如何|怎么|什么|为什么|哪里|哪些|吗/.test(text)
}

/** execCommand 降级复制（clipboard API 不可用/被拒绝时） */
function legacyCopy(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      if (ok) resolve()
      else reject(new Error('execCommand copy rejected'))
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => legacyCopy(text))
  }
  return legacyCopy(text)
}

/** 文档 Drawer 目录锚点（与正文章节 id 对应，scrollIntoView 定位） */
const DOC_TOC = [
  { id: 'overview', label: '一、概述' },
  { id: 'steps', label: '二、操作步骤' },
  { id: 'notes', label: '三、注意事项' },
  { id: 'changelog', label: '四、更新记录' },
] as const

function scrollToDocSection(id: string) {
  document.getElementById(`doc-sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ---------- 页面 ----------

interface DocTarget {
  title: string
  category?: string
  time?: string
}

export default function KnowledgeSite() {
  const { addFeedback } = useAppStore()
  const toast = useAppToast()

  // Hero / 搜索
  const [siteName, setSiteName] = useState(site.name)
  const [slogan, setSlogan] = useState('智能搜索，一问即答，让知识触手可及')
  const [published, setPublished] = useState(site.status === '已发布')
  const [query, setQuery] = useState('')
  const [keywordResults, setKeywordResults] = useState<string[] | null>(null)
  const [siteAnswer, setSiteAnswer] = useState<SiteAnswer | null>(null)
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback>(null)
  const [highlightCategory, setHighlightCategory] = useState<string | null>(null)
  const categoryRef = useRef<HTMLDivElement>(null)

  // 网站设置
  const [access, setAccess] = useState(site.access)
  const [qaEnabled, setQaEnabled] = useState(site.onlineQA)
  const [confirmPublic, setConfirmPublic] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftName, setDraftName] = useState(site.name)
  const [draftSlogan, setDraftSlogan] = useState('智能搜索，一问即答，让知识触手可及')

  // Drawers / 浮动窗
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const [doc, setDoc] = useState<DocTarget | null>(null)
  const [qaState, setQaState] = useState<'open' | 'min' | 'closed'>('open')
  const [qaQuestion, setQaQuestion] = useState<string | null>(null)
  // 「查看全部」列表 Drawer
  const [allList, setAllList] = useState<'categories' | 'updates' | 'questions' | null>(null)
  // 归档 / 前台预览
  const [archived, setArchived] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const allDocs = useMemo(
    () => [...RECENT_UPDATES.map((r) => r.title), ...Object.values(CATEGORY_DOCS).flat().map((d) => d.title)],
    [],
  )

  const runSearch = () => {
    const text = query.trim()
    if (!text) return
    if (isQuestion(text)) {
      setKeywordResults(null)
      setSiteAnswer(answerFor(text))
      setAnswerFeedback(null)
    } else {
      setSiteAnswer(null)
      const hits = allDocs.filter((t) => t.toLowerCase().includes(text.toLowerCase()))
      setKeywordResults(hits.length > 0 ? hits.slice(0, 6) : allDocs.slice(0, 3))
    }
  }

  const scrollToCategory = (name: string) => {
    categoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setHighlightCategory(name)
    window.setTimeout(() => setHighlightCategory(null), 1600)
  }

  const askInWidget = (q: string) => {
    if (!qaEnabled) setQaEnabled(true)
    setQaState('open')
    setQaQuestion(q)
  }

  const openDoc = (title: string) => {
    const found = RECENT_UPDATES.find((r) => title.includes(r.title) || r.title.includes(title.replace(/（v2\.0）/, '')))
    setDoc({ title, category: found?.category, time: found?.time })
  }

  return (
    <div>
      <PageHeader
        crumbs={['知识网站', siteName]}
        title={siteName}
        badge={archived ? <StatusBadge status="已归档" /> : published ? <StatusBadge status="已发布" /> : <StatusBadge status="未发布" />}
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setDraftName(siteName)
                setDraftSlogan(slogan)
                setSettingsOpen(true)
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
            >
              <Pencil className="h-4 w-4" />
              编辑网站
            </button>
            <details className="group relative">
              <summary className="flex h-10 w-10 list-none items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600 [&::-webkit-details-marker]:hidden">
                <MoreHorizontal className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 top-11 z-30 w-36 rounded-md border border-neutral-200 bg-white py-1 shadow-float">
                {!archived && (
                  <button
                    type="button"
                    onClick={() => {
                      setPublished((p) => !p)
                      toast.info(published ? '网站已暂停发布' : '网站已重新发布')
                    }}
                    className="block w-full px-3 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    {published ? '暂停发布' : '恢复发布'}
                  </button>
                )}
                {archived ? (
                  <button
                    type="button"
                    onClick={() => {
                      setArchived(false)
                      toast.info('已取消归档，网站处于未发布状态，可重新发布')
                    }}
                    className="block w-full px-3 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    取消归档
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmArchive(true)}
                    className="block w-full px-3 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    归档
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void copyText(site.url)
                      .then(() => toast.success('链接已复制'))
                      .catch(() => toast.warning(`自动复制失败，请手动复制：${site.url}`))
                  }}
                  className="block w-full px-3 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
                >
                  复制链接
                </button>
              </div>
            </details>
          </>
        }
      />

      {/* Hero 渐变区 */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-xl px-6 py-10"
        style={{ background: 'linear-gradient(120deg, #EAF2FF 0%, #F1EEFF 100%)' }}
      >
        <span
          className={cn(
            'absolute left-5 top-5 inline-flex h-6 items-center gap-1 rounded-pill px-2 text-caption font-medium',
            archived ? 'bg-neutral-100 text-neutral-500' : published ? 'bg-success-bg text-success' : 'bg-neutral-100 text-neutral-500',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', archived || !published ? 'bg-neutral-400' : 'bg-success')} />
          {archived ? '已归档' : published ? '已发布' : '未发布'}
        </span>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          className="text-center text-display text-neutral-950"
        >
          {siteName}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-2 text-center text-body-lg text-neutral-700"
        >
          {slogan}
        </motion.p>

        {/* 大搜索框 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative mx-auto mt-6 w-[55%] min-w-[320px]"
        >
          <div className="flex h-12 items-center gap-2 rounded-md bg-white pl-4 pr-1.5 shadow-card">
            <Search className="h-4 w-4 shrink-0 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch()
              }}
              placeholder="智索知识内容或直接提问…"
              className="h-full w-full bg-transparent text-body text-neutral-800 outline-none placeholder:text-neutral-400"
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={!query.trim()}
              className="h-10 shrink-0 rounded-md bg-brand-600 px-5 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700 disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              搜索
            </button>
          </div>
          {/* 关键词结果下拉 */}
          <AnimatePresence>
            {keywordResults && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-x-0 top-14 z-20 rounded-lg border border-neutral-200 bg-white p-2 shadow-float"
              >
                <p className="px-2 py-1 text-caption text-neutral-400">文档结果（{keywordResults.length}）</p>
                {keywordResults.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setKeywordResults(null)
                      openDoc(t)
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:bg-surface-page"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-brand-500" />
                    <span className="truncate">{t}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setKeywordResults(null)}
                  className="mt-1 w-full rounded-md px-2 py-1.5 text-center text-caption text-neutral-400 hover:bg-neutral-50"
                >
                  收起
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 5 个分类入口 chips */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {site.categories.map((c) => {
            const meta = CATEGORY_META[c.name]
            const Icon = meta.icon
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => scrollToCategory(c.name)}
                className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-white px-4 text-body-sm text-neutral-800 shadow-card transition-all duration-micro ease-brand hover:-translate-y-0.5 hover:shadow-float"
              >
                <Icon className="h-4 w-4 text-brand-600" />
                {c.name === 'API文档' ? 'API 文档' : c.name}
              </button>
            )
          })}
        </div>
      </motion.section>

      {/* Hero 搜索结果：AnswerCard */}
      <AnimatePresence>
        {siteAnswer && (
          <motion.div
            key={siteAnswer.question}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="mt-4"
          >
            <AnswerCard
              question={siteAnswer.question}
              conclusion={siteAnswer.conclusion}
              explanation={siteAnswer.explanation}
              citations={siteAnswer.citations}
              trust={siteAnswer.trust}
              feedback={answerFeedback}
              onFeedback={(type) => {
                if (type === 'ask') {
                  setSiteAnswer(null)
                  setQuery('')
                  return
                }
                setAnswerFeedback(type)
                addFeedback({
                  type,
                  question: siteAnswer.question,
                  answerExcerpt: siteAnswer.conclusion,
                  source: 'knowledge-site',
                })
                toast.success('感谢反馈，已记录到反馈队列')
              }}
            >
              {siteAnswer.docs && (
                <>
                  <p className="mt-5 text-body-sm font-semibold text-neutral-800">引用来源（{siteAnswer.citations}）</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                    {siteAnswer.docs.map((d) => (
                      <CitationCard
                        key={d.name}
                        name={d.name}
                        version={d.version}
                        page={d.page}
                        primary={d.tag === '主要依据'}
                        onClick={() => openDoc(d.name)}
                      />
                    ))}
                  </div>
                </>
              )}
            </AnswerCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 内容双区 */}
      <div className="mt-4 grid grid-cols-12 gap-4">
        {/* 左：主内容 */}
        <div className="col-span-12 flex flex-col gap-4 xl:col-span-8">
          <div ref={categoryRef} className="scroll-mt-24">
            <SectionCard
              title="热门分类"
              icon={<LayoutGrid className="h-5 w-5" />}
              actions={
                <button type="button" onClick={() => setAllList('categories')} className="text-body-sm text-brand-600 hover:text-brand-500">
                  查看全部 ›
                </button>
              }
            >
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
                {site.categories.map((c, i) => {
                  const meta = CATEGORY_META[c.name]
                  const Icon = meta.icon
                  return (
                    <motion.button
                      key={c.name}
                      type="button"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.24, delay: i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
                      onClick={() => setOpenCategory(c.name)}
                      className={cn(
                        'rounded-lg border p-4 text-left transition-all duration-micro ease-brand hover:border-brand-300',
                        highlightCategory === c.name ? 'border-brand-500 shadow-focus' : 'border-neutral-200',
                      )}
                    >
                      <span className={cn('flex h-10 w-10 items-center justify-center rounded-md', meta.iconCls)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <p className="mt-2.5 text-body font-semibold text-neutral-950">{c.name === 'API文档' ? 'API 文档' : c.name}</p>
                      <p className="mt-0.5 text-caption text-neutral-400">{c.count} 篇</p>
                    </motion.button>
                  )
                })}
              </div>
            </SectionCard>
          </div>

          {/* 双列：最近更新 / 热门问题 */}
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <SectionCard
              title="最近更新"
              icon={<FileText className="h-5 w-5" />}
              actions={
                <button type="button" onClick={() => setAllList('updates')} className="text-body-sm text-brand-600 hover:text-brand-500">
                  查看全部 ›
                </button>
              }
              bodyClassName="flex h-full flex-col"
            >
              <ul className="flex-1">
                {RECENT_UPDATES.map((r, i) => (
                  <motion.li
                    key={r.title}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18, delay: i * 0.03 }}
                  >
                    <button
                      type="button"
                      onClick={() => setDoc({ title: r.title, category: r.category, time: r.time })}
                      className="flex w-full items-center gap-2 rounded-md px-1 py-2.5 text-left transition-colors duration-micro ease-brand hover:bg-surface-page"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
                      <span className="min-w-0 flex-1 truncate text-body text-neutral-800">{r.title}</span>
                      <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-caption font-medium', CATEGORY_META[r.category].chipCls)}>
                        {r.category === 'API文档' ? 'API 文档' : r.category}
                      </span>
                      <span className="w-20 shrink-0 text-right text-caption text-neutral-400">{r.time}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
              <p className="mt-2 border-t border-neutral-100 pt-2 text-center text-caption text-neutral-400">共 {ALL_UPDATES.length} 条更新</p>
            </SectionCard>

            <SectionCard
              title="热门问题"
              icon={<CircleHelp className="h-5 w-5" />}
              actions={
                <button type="button" onClick={() => setAllList('questions')} className="text-body-sm text-brand-600 hover:text-brand-500">
                  查看全部 ›
                </button>
              }
              bodyClassName="flex h-full flex-col"
            >
              <ul className="flex-1">
                {HOT_QUESTIONS.map((h, i) => (
                  <motion.li
                    key={h.q}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18, delay: i * 0.03 }}
                  >
                    <button
                      type="button"
                      onClick={() => askInWidget(h.q)}
                      className="flex w-full items-center gap-3 rounded-md px-1 py-2.5 text-left transition-colors duration-micro ease-brand hover:bg-surface-page"
                    >
                      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-caption font-semibold', RANK_COLORS[i])}>
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-body text-neutral-800">{h.q}</span>
                      <span className="shrink-0 text-caption text-neutral-400">{h.heat}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
              <p className="mt-2 border-t border-neutral-100 pt-2 text-center text-caption text-neutral-400">共 {ALL_HOT_QUESTIONS.length} 条问题</p>
            </SectionCard>
          </div>
        </div>

        {/* 右：网站设置 */}
        <div className="col-span-12 xl:col-span-4">
          <SectionCard title="网站设置" icon={<Globe className="h-5 w-5" />}>
            <dl className="flex flex-col gap-3.5">
              <div>
                <dt className="text-caption text-neutral-400">访问方式</dt>
                <dd className="mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (access.startsWith('私有')) setConfirmPublic(true)
                      else {
                        setAccess(site.access)
                        toast.info('已切回私有预览（仅内部可访问）')
                      }
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300"
                  >
                    {access}
                    <Pencil className="h-3.5 w-3.5 text-neutral-400" />
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-caption text-neutral-400">网站地址</dt>
                <dd className="mt-1 flex h-9 items-center justify-between gap-2 rounded-md bg-surface-page px-2.5">
                  <span className="truncate text-body-sm text-neutral-700">{site.url}</span>
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(site.url)
                        .then(() => toast.success('链接已复制'))
                        .catch(() => toast.warning(`自动复制失败，请手动复制：${site.url}`))
                    }
                    className="shrink-0 text-neutral-400 transition-colors duration-micro ease-brand hover:text-brand-600"
                    aria-label="复制链接"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-caption text-neutral-400">访问权限</dt>
                <dd className="text-body-sm text-neutral-800">内部可见</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-caption text-neutral-400">启用在线提问</dt>
                <dd>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={qaEnabled}
                    onClick={() => {
                      setQaEnabled((v) => {
                        if (v) setQaState('closed')
                        else setQaState('open')
                        return !v
                      })
                    }}
                    className={cn(
                      'relative h-6 w-11 rounded-pill transition-colors duration-comp ease-brand',
                      qaEnabled ? 'bg-brand-500' : 'bg-neutral-200',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-comp ease-brand',
                        qaEnabled ? 'left-[22px]' : 'left-0.5',
                      )}
                    />
                  </button>
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
              >
                <Globe className="h-4 w-4" />
                访问网站
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  void copyText(site.url)
                    .then(() => toast.success('链接已复制，可分享给团队成员'))
                    .catch(() => toast.warning(`自动复制失败，请手动复制：${site.url}`))
                }
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
              >
                <Share2 className="h-4 w-4" />
                分享链接
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraftName(siteName)
                setDraftSlogan(slogan)
                setSettingsOpen(true)
              }}
              className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
            >
              <Settings2 className="h-4 w-4" />
              自定义
            </button>
          </SectionCard>
        </div>
      </div>

      {/* 底部通栏提示 */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 rounded-lg py-3 text-center">
        <p className="flex items-center gap-1.5 text-body-sm text-brand-600">
          <Sparkles className="h-4 w-4" />
          已为你自动生成知识库网站，支持搜索与在线提问，立即访问或分享给团队成员使用吧！
        </p>
        {qaState === 'closed' && (
          <button
            type="button"
            onClick={() => setQaState('open')}
            className="text-body-sm text-neutral-500 underline transition-colors duration-micro ease-brand hover:text-brand-600"
          >
            重新打开在线提问
          </button>
        )}
      </div>

      {/* 分类文档列表 Drawer */}
      <SideDrawer open={openCategory !== null} onClose={() => setOpenCategory(null)} title={openCategory ? `${openCategory === 'API文档' ? 'API 文档' : openCategory}（${site.categories.find((c) => c.name === openCategory)?.count ?? 0} 篇）` : ''} width={440}>
        <ul className="flex flex-col divide-y divide-neutral-100">
          {(openCategory ? CATEGORY_DOCS[openCategory] : []).map((d) => (
            <li key={d.title}>
              <button
                type="button"
                onClick={() => setDoc({ title: d.title, category: openCategory ?? undefined, time: d.time })}
                className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors duration-micro ease-brand hover:bg-surface-page"
              >
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', openCategory ? CATEGORY_META[openCategory].iconCls : '')}>
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-body-sm text-neutral-800">{d.title}</span>
                <span className="shrink-0 text-caption text-neutral-400">发布于 {d.time}</span>
              </button>
            </li>
          ))}
        </ul>
      </SideDrawer>

      {/* 「查看全部」列表 Drawer（热门分类全部文档 / 全部更新 / 全部问题） */}
      <SideDrawer
        open={allList !== null}
        onClose={() => setAllList(null)}
        title={
          allList === 'categories'
            ? '全部分类文档'
            : allList === 'updates'
              ? `全部更新（${ALL_UPDATES.length}）`
              : `全部热门问题（${ALL_HOT_QUESTIONS.length}）`
        }
        width={440}
      >
        {allList === 'categories' && (
          <div className="flex flex-col gap-5">
            {site.categories.map((c) => {
              const meta = CATEGORY_META[c.name]
              const Icon = meta.icon
              return (
                <section key={c.name}>
                  <h4 className="mb-2 flex items-center gap-2 text-body-sm font-semibold text-neutral-950">
                    <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', meta.iconCls)}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {c.name === 'API文档' ? 'API 文档' : c.name}
                    <span className="text-caption font-normal text-neutral-400">{c.count} 篇</span>
                  </h4>
                  <ul className="flex flex-col divide-y divide-neutral-100">
                    {CATEGORY_DOCS[c.name].map((d) => (
                      <li key={d.title}>
                        <button
                          type="button"
                          onClick={() => setDoc({ title: d.title, category: c.name, time: d.time })}
                          className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors duration-micro ease-brand hover:bg-surface-page"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
                          <span className="min-w-0 flex-1 truncate text-body-sm text-neutral-800">{d.title}</span>
                          <span className="shrink-0 text-caption text-neutral-400">{d.time}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
        {allList === 'updates' && (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {ALL_UPDATES.map((r) => (
              <li key={r.title}>
                <button
                  type="button"
                  onClick={() => setDoc({ title: r.title, category: r.category, time: r.time })}
                  className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors duration-micro ease-brand hover:bg-surface-page"
                >
                  <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
                  <span className="min-w-0 flex-1 truncate text-body-sm text-neutral-800">{r.title}</span>
                  <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-caption font-medium', CATEGORY_META[r.category].chipCls)}>
                    {r.category === 'API文档' ? 'API 文档' : r.category}
                  </span>
                  <span className="w-20 shrink-0 text-right text-caption text-neutral-400">{r.time}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {allList === 'questions' && (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {ALL_HOT_QUESTIONS.map((h, i) => (
              <li key={h.q}>
                <button
                  type="button"
                  onClick={() => askInWidget(h.q)}
                  className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors duration-micro ease-brand hover:bg-surface-page"
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-caption font-semibold',
                      RANK_COLORS[Math.min(i, RANK_COLORS.length - 1)],
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body-sm text-neutral-800">{h.q}</span>
                  <span className="shrink-0 text-caption text-neutral-400">{h.heat}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SideDrawer>

      {/* 文档阅读 Drawer（目录树 + 正文 + 引用关系） */}
      <SideDrawer open={doc !== null} onClose={() => setDoc(null)} title={doc?.title} width={560}>
        {doc && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
              {doc.category && (
                <span className={cn('rounded-sm px-1.5 py-0.5 text-caption font-medium', CATEGORY_META[doc.category].chipCls)}>
                  {doc.category === 'API文档' ? 'API 文档' : doc.category}
                </span>
              )}
              {doc.time && <span className="text-caption text-neutral-400">更新于 {doc.time}</span>}
            </div>
            <section>
              <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">目录</h4>
              <ul className="flex flex-col gap-1 text-body-sm text-brand-600">
                {DOC_TOC.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => scrollToDocSection(a.id)}
                      className="text-left transition-colors duration-micro ease-brand hover:text-brand-500 hover:underline"
                    >
                      {a.label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">正文</h4>
              <div className="flex flex-col gap-4 rounded-lg border border-neutral-100 bg-surface-soft p-4 text-body text-neutral-700">
                <div id="doc-sec-overview" className="scroll-mt-4">
                  <h5 className="mb-1 text-body-sm font-semibold text-neutral-950">一、概述</h5>
                  <p>本文档由知识库自动同步生成，面向内部成员提供最新的操作指引与说明。</p>
                </div>
                <div id="doc-sec-steps" className="scroll-mt-4">
                  <h5 className="mb-1 text-body-sm font-semibold text-neutral-950">二、操作步骤</h5>
                  <p>按照目录顺序逐步执行：先完成前置配置，再按界面提示提交，最后在列表中确认结果状态。</p>
                </div>
                <div id="doc-sec-notes" className="scroll-mt-4">
                  <h5 className="mb-1 text-body-sm font-semibold text-neutral-950">三、注意事项</h5>
                  <p>
                    关键结论：
                    <mark className="rounded-sm bg-surface-highlight px-1">所有面向客户的口径均以本文档最新版本为准，引用旧版本内容前请先确认版本有效性。</mark>
                  </p>
                </div>
                <div id="doc-sec-changelog" className="scroll-mt-4">
                  <h5 className="mb-1 text-body-sm font-semibold text-neutral-950">四、更新记录</h5>
                  <p>如需修改，请联系文档 Owner 或在反馈与洞察中提交修订建议，审核通过后发布新版本。</p>
                </div>
              </div>
            </section>
            <section>
              <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">引用关系</h4>
              <p className="text-body-sm text-neutral-500">被 3 个答案引用 · 被 2 个助手使用 · 近 30 天被查看 45 次</p>
            </section>
          </div>
        )}
      </SideDrawer>

      {/* 站点设置 Drawer（自定义 / 编辑网站）：草稿态 → 确认发布 */}
      <SideDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="自定义网站"
        width={480}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.info('草稿已保存，确认发布后生效')}
              className="h-9 rounded-md border border-neutral-200 bg-white px-4 text-body-sm text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
            >
              保存草稿
            </button>
            <button
              type="button"
              onClick={() => {
                setSiteName(draftName.trim() || siteName)
                setSlogan(draftSlogan.trim() || slogan)
                setSettingsOpen(false)
                setPublished(true)
                toast.success('已发布新版本')
              }}
              className="h-9 rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
            >
              确认发布
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <section>
            <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">首页与导航</h4>
            <label className="block text-caption text-neutral-400">站点名称</label>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-body-sm text-neutral-800 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:shadow-input"
            />
            <label className="mt-3 block text-caption text-neutral-400">首页标语（Slogan）</label>
            <input
              value={draftSlogan}
              onChange={(e) => setDraftSlogan(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-body-sm text-neutral-800 outline-none transition-shadow duration-micro ease-brand focus:border-brand-500 focus:shadow-input"
            />
          </section>
          <section>
            <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">搜索推荐</h4>
            <p className="text-body-sm text-neutral-500">已开启热门问题推荐（5 条），搜索框默认展示分类入口。</p>
          </section>
          <section>
            <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">访问认证</h4>
            <p className="text-body-sm text-neutral-500">当前：内部可见（企业成员登录后访问）。切换公开需在网站设置中确认敏感扫描结果。</p>
          </section>
          <section>
            <h4 className="mb-2 text-body-sm font-semibold text-neutral-950">品牌域名与主题</h4>
            <p className="text-body-sm text-neutral-500">默认域名 {site.url}；自定义域名与主题色为专业版能力，当前已应用品牌蓝主题。</p>
          </section>
        </div>
      </SideDrawer>

      {/* 访问方式切「公开」→ L3 确认卡 */}
      <AnimatePresence>
        {confirmPublic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(16,24,40,0.4)] p-6"
            onClick={() => setConfirmPublic(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-[520px] max-w-full"
            >
              <ConfirmationCard
                title="将网站访问方式切换为「公开」？"
                description="公开后任何人无需登录即可访问网站内容，请确认敏感扫描结果。"
                fields={[
                  { label: '动作', value: '访问方式：私有预览 → 公开' },
                  { label: '影响对象', value: `${siteName}（5 个分类 · 128 篇文档）` },
                  { label: '敏感扫描', value: '已扫描 128 份资料，发现 2 份含内部价格信息，将从公开范围排除' },
                  { label: '可撤销性', value: '可随时切回私有预览' },
                ]}
                confirmText="确认公开"
                onConfirm={() => {
                  setAccess('公开（任何人可访问）')
                  setConfirmPublic(false)
                  toast.success('网站已切换为公开访问，2 份敏感资料已排除')
                }}
                onModify={() => setConfirmPublic(false)}
                onCancel={() => setConfirmPublic(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 归档 L2 确认 */}
      <AnimatePresence>
        {confirmArchive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(16,24,40,0.4)] p-6"
            onClick={() => setConfirmArchive(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-[520px] max-w-full"
            >
              <ConfirmationCard
                title="归档知识网站？"
                description="归档后前台立即不可访问，文档仍保留在知识库中。"
                fields={[
                  { label: '动作', value: `归档「${siteName}」` },
                  { label: '影响对象', value: `${siteName}（5 个分类 · 128 篇文档），前台访问与在线提问即刻关闭` },
                  { label: '影响范围', value: '网站状态置为「已归档」，不再对外提供搜索与问答' },
                  { label: '可撤销性', value: '可通过 ⋯ 菜单「取消归档」恢复为未发布状态' },
                ]}
                confirmText="确认归档"
                onConfirm={() => {
                  setArchived(true)
                  setPublished(false)
                  setQaState('closed')
                  setConfirmArchive(false)
                  toast.success('网站已归档，前台已不可访问')
                }}
                onCancel={() => setConfirmArchive(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 前台预览（全屏只读） */}
      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 z-[80] flex flex-col bg-surface-page"
            role="dialog"
            aria-modal="true"
            aria-label="前台预览"
          >
            <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4">
              <div className="flex min-w-0 items-center gap-2 text-body-sm text-neutral-500">
                <Globe className="h-4 w-4 shrink-0" />
                <span className="truncate">{site.url}</span>
                <span className="shrink-0 rounded-pill bg-info-bg px-2 py-0.5 text-caption text-info">前台预览 · 只读</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="关闭预览"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <section className="px-6 py-14" style={{ background: 'linear-gradient(120deg, #EAF2FF 0%, #F1EEFF 100%)' }}>
                <h1 className="text-center text-display text-neutral-950">{siteName}</h1>
                <p className="mt-2 text-center text-body-lg text-neutral-700">{slogan}</p>
                <div className="mx-auto mt-6 flex h-12 w-[55%] min-w-[320px] items-center gap-2 rounded-md bg-white pl-4 pr-1.5 shadow-card">
                  <Search className="h-4 w-4 shrink-0 text-neutral-400" />
                  <input
                    readOnly
                    placeholder="搜索知识内容或直接提问…"
                    className="h-full w-full cursor-default bg-transparent text-body text-neutral-800 outline-none placeholder:text-neutral-400"
                    aria-label="前台搜索框（预览只读）"
                  />
                  <span className="flex h-10 shrink-0 items-center rounded-md bg-brand-600 px-5 text-body-sm font-medium text-white">搜索</span>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                  {site.categories.map((c) => {
                    const meta = CATEGORY_META[c.name]
                    const Icon = meta.icon
                    return (
                      <span key={c.name} className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-white px-4 text-body-sm text-neutral-800 shadow-card">
                        <Icon className="h-4 w-4 text-brand-600" />
                        {c.name === 'API文档' ? 'API 文档' : c.name}
                      </span>
                    )
                  })}
                </div>
              </section>
              <section className="mx-auto max-w-5xl px-6 py-8">
                <h2 className="text-h3 text-neutral-950">热门分类</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
                  {site.categories.map((c) => {
                    const meta = CATEGORY_META[c.name]
                    const Icon = meta.icon
                    return (
                      <div key={c.name} className="rounded-lg border border-neutral-200 bg-white p-4">
                        <span className={cn('flex h-10 w-10 items-center justify-center rounded-md', meta.iconCls)}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <p className="mt-2.5 text-body font-semibold text-neutral-950">{c.name === 'API文档' ? 'API 文档' : c.name}</p>
                        <p className="mt-0.5 text-caption text-neutral-400">{c.count} 篇</p>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-8 text-center text-caption text-neutral-400">
                  {siteName} · 由 KnowledgeHub 自动生成 · 预览为只读，交互请以前台实际页面为准
                </p>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 在线提问浮动窗 */}
      {qaEnabled && (
        <OnlineQAWidget
          state={qaState}
          onMinimize={() => setQaState('min')}
          onClose={() => setQaState('closed')}
          onReopen={() => setQaState('open')}
          externalQuestion={qaQuestion}
          onConsumeExternal={() => setQaQuestion(null)}
          onOpenDoc={openDoc}
        />
      )}

    </div>
  )
}
