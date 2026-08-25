/**
 * 申请试用 trial-apply（还原 ui-mockups 图 1 / design/trial-apply.md）
 * 对话引导页模板：左 小知对话面板 38% / 右 表单与价值区 62%（三卡纵向）→ 底部 CTA 行。
 * 主 CTA「提交试用申请」：4 个必填字段全部通过校验才启用；Loading（保宽+Spinner「正在提交申请…」）
 * → 页面内成功回执（Toast + 卡片顶绿色成功条）→ store 标记 applied 推进 journey → 跳 /workspace/quick-config。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarCheck,
  CloudUpload,
  FileText,
  Flag,
  LayoutGrid,
  Lock,
  Megaphone,
  Play,
  Puzzle,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/mocks/store'
import { me, org } from '@/mocks/base.mock'
import { ChatPanel } from '@/components/chat'
import { SectionCard } from '@/components/common'
import { DemoModal, Modal, PrimaryButton, SecondaryButton } from './activation/ui'
import { useAppToast } from '@/lib/toast'
import { KEY_NAMESPACE, loadLS, saveLS } from '@/lib/storage'

// ---------- 小知脚本（trial-apply.md §4.1 逐字） ----------

const SCRIPT_AI_1 =
  '你好！我是小知，欢迎开启 企业知识库 的试用之旅 🎉\n我会引导你快速创建 KnowledgeHub。\n先告诉我，你希望用企业知识库解决什么问题呢？'

const SCRIPT_USER =
  '我们希望使用公司产品与报价相关的知识，帮助销售更快、准确地回答客户问题，提高成单效率。'

const SCRIPT_AI_2 =
  '明白了！你希望通过沉淀「产品与报价知识」，让销售在面对客户问题时，快速找到可靠答案，提升转化率。\n接下来我会帮你完成以下几步：\n1. 填写试用信息，创建你的 KnowledgeHub\n2. 引导你导入现有资料（文档 / 表格 / 链接等）\n3. 邀请同事加入，一起完善知识\n4. 安装到你的工作入口，即可开始使用\n整个过程大约 10 分钟，你也可以随时保存草稿。'

const CHIPS = ['销售与售前', '客服与售后', '员工制度', 'IT / SOP'] as const

/** Chip → AI 预写回复 */
const CHIP_REPLIES: Record<string, string> = {
  销售与售前: SCRIPT_AI_2,
  客服与售后:
    '明白了！你希望沉淀「产品与售后政策知识」，让客服在面对客户咨询时快速找到可靠答案，提升客户满意度。\n接下来请先在右侧填写试用信息，我会一步步帮你完成配置，整个过程大约 10 分钟。',
  员工制度:
    '明白了！你希望沉淀「公司制度与流程知识」，让员工自助查询考勤、报销与审批规则，减少重复咨询。\n接下来请先在右侧填写试用信息，我会一步步帮你完成配置，整个过程大约 10 分钟。',
  'IT / SOP':
    '明白了！你希望沉淀「IT 操作与 SOP 知识」，让员工快速找到标准操作流程，降低支持成本。\n接下来请先在右侧填写试用信息，我会一步步帮你完成配置，整个过程大约 10 分钟。',
}

/** Chip → 表单「试用目标」推断值 */
const CHIP_GOALS: Record<string, string> = {
  销售与售前: '使用公司产品与报价相关知识，帮助销售快速、准确地回答客户问题，提高成单率。',
  客服与售后: '沉淀产品与售后政策知识，帮助客服快速、准确地回答客户问题，提升客户满意度。',
  员工制度: '沉淀公司制度与流程知识，帮助员工自助查询考勤、报销与审批规则。',
  'IT / SOP': '沉淀 IT 操作与 SOP 知识，帮助员工快速找到标准操作流程，减少重复咨询。',
}

// ---------- 表单 ----------

const DRAFT_KEY = KEY_NAMESPACE.trialApply.draft

/** 条款版本（提交成功时随草稿落盘 agreedVersion / agreedAt） */
const TERMS_VERSION = 'v1.2'
/** 条款生效日期（与 v1.2 一同在条款 Modal 头部展示） */
const TERMS_EFFECTIVE_DATE = '2025 年 3 月 1 日'

/** 条款/隐私政策全文（演示环境 mock，各 12 条） */
const TERMS_ARTICLES: string[] = [
  '本条款适用于你（下称"企业"）申请并使用企业知识库试用服务（下称"本服务"）的全过程。提交试用申请即表示你已阅读、理解并同意接受本条款的全部内容。',
  '本服务试用期为 7 天，自工作区创建成功之日起计算。试用期内企业可使用全部核心功能，包括知识接入、可信问答、应用集成与使用分析。',
  '企业应保证提交的申请信息（企业名称、行业、联系方式等）真实、准确、完整。因信息不实导致无法开通或联系失败的，由企业自行承担后果。',
  '试用期内企业上传的全部资料与数据归企业所有。我们仅在提供本服务所必需的范围内处理该等数据，不会将其用于训练对外提供的通用模型。',
  '企业应确保上传的资料不侵犯任何第三方的知识产权、商业秘密或其他合法权益，不包含违法违规内容。因企业资料引发的争议由企业负责解决。',
  '本服务基于人工智能技术生成回答，回答内容附带引用来源供核对。企业应将回答作为参考，对关键业务决策进行人工复核。',
  '试用席位上限为 20 人。超出席位的邀请将被限制，企业可选择减少邀请人数或升级至付费套餐扩容。',
  '我们可能对服务进行维护、升级或调整，并尽可能提前通知。因不可抗力或第三方原因导致的服务中断，我们不承担赔偿责任。',
  '企业不得利用本服务从事任何违法违规活动，不得对服务进行反向工程、恶意扫描或超出正常试用目的的批量调用。',
  '试用期届满后，如企业未升级为付费套餐，工作区将转为只读保留 30 天，期满未续期的数据将被安全删除。',
  '我们保留在合理范围内修改本条款的权利，修改后的条款将在产品内公示并注明生效日期。继续使用本服务视为接受修改后的条款。',
  '本条款的解释与争议解决适用中华人民共和国法律。如双方发生争议，应友好协商解决；协商不成的，提交服务提供方所在地有管辖权的人民法院处理。',
]

const PRIVACY_ARTICLES: string[] = [
  '本隐私政策说明我们在你申请与使用企业知识库试用服务过程中如何收集、使用、存储与保护你的信息。',
  '我们收集的信息包括：你在申请表单中填写的企业名称、行业、试用目标，以及你选择的联系方式（手机号或邮箱）。',
  '为完成账号验证，我们会向你提供的手机号或邮箱发送一次性验证码，验证码仅用于身份核验，不作其他用途。',
  '你在试用过程中上传的文档、表格等资料，仅存储于你的工作区，用于生成知识问答与引用来源，不会向其他企业用户展示。',
  '我们会记录服务使用日志（如登录时间、功能点击、问答次数），用于改进产品体验与保障服务安全，日志保留期限不超过 12 个月。',
  '我们采用传输加密（TLS）与存储加密保护你的数据，并通过访问控制与审计机制限制内部人员接触企业数据。',
  '未经你的明确授权，我们不会向任何第三方出售、出租或共享你的个人信息与企业数据，法律法规另有规定的除外。',
  '为实现短信/邮件验证等基础能力，我们会与经过安全评估的服务供应商共享最小必要信息，并要求其履行同等保护义务。',
  '你可以随时在设置中心导出你的知识数据，或在试用期结束后申请删除工作区全部数据，我们将在 15 个工作日内完成处理。',
  '我们使用 Cookie 与本地存储保存你的登录状态与草稿进度，你可以通过浏览器设置清除，但可能影响部分功能使用。',
  '如你对个人信息处理有任何疑问、投诉或行权请求（查询、更正、删除），可通过产品内反馈渠道或客服邮箱联系我们。',
  '本政策更新时，我们将在产品内显著位置提示并注明生效日期。重大变更将通过你预留的联系方式另行通知。',
]

const TERMS_DOCS = {
  terms: { title: '试用服务条款', articles: TERMS_ARTICLES },
  privacy: { title: '隐私政策', articles: PRIVACY_ARTICLES },
} as const
/** 验证码重发倒计时秒数 */
const OTP_COUNTDOWN_SECONDS = 60

/** 联系方式二选一：手机验证 / 邮箱验证 */
type ContactMode = 'phone' | 'email'

const INDUSTRY_OPTIONS = ['软件与信息技术服务', '互联网/软件', '制造', '零售', '金融', '教育', '医疗', '其他']

interface ApplyForm {
  company: string
  industry: string
  goal: string
  phone: string
  email: string
}

const DEFAULT_FORM: ApplyForm = {
  company: org.name,
  industry: org.industry,
  goal: CHIP_GOALS['销售与售前'],
  phone: me.phone,
  email: me.email,
}

function validate(form: ApplyForm, mode: ContactMode): Partial<Record<keyof ApplyForm, string>> {
  const errors: Partial<Record<keyof ApplyForm, string>> = {}
  const company = form.company.trim()
  if (company.length === 0) errors.company = '请输入企业名称'
  else if (company.length < 2) errors.company = '企业名称至少 2 个字符'
  else if (company.length > 100) errors.company = '企业名称不能超过 100 个字符'
  if (!form.industry) errors.industry = '请选择行业'
  if (form.goal.trim().length === 0) errors.goal = '请填写试用目标'
  else if (form.goal.length > 200) errors.goal = '试用目标不能超过 200 字'
  // 联系方式二选一：仅校验当前选中的验证方式
  if (mode === 'phone') {
    const digits = form.phone.replace(/\s/g, '')
    if (!/^\d{11}$/.test(digits)) errors.phone = '请输入 11 位手机号'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = '请输入正确的邮箱地址'
  }
  return errors
}

function FieldError({ text }: { text?: string }) {
  if (!text) return null
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      className="mt-1 text-caption text-danger"
    >
      {text}
    </motion.p>
  )
}

const inputCls = (invalid: boolean) =>
  cn(
    'h-10 w-full rounded-md border bg-white px-3 text-body text-neutral-800 outline-none transition-all duration-micro ease-brand placeholder:text-neutral-400',
    invalid
      ? 'border-danger focus-visible:border-danger focus-visible:shadow-[0_0_0_3px_rgba(229,72,77,0.12)]'
      : 'border-[#DCE4EF] focus-visible:border-brand-500 focus-visible:shadow-input',
  )

// ---------- 你的试用之旅 ----------

const JOURNEY_PREVIEW = [
  { icon: FileText, title: '申请试用', desc: ['填写信息与目标', '创建 KnowledgeHub'] },
  { icon: CloudUpload, title: '快速配置', desc: ['导入资料并配置', '知识空间与权限'] },
  { icon: Users, title: '邀请同事', desc: ['邀请团队成员加入', '共同完善知识'] },
  { icon: Puzzle, title: '安装应用', desc: ['接入飞书/钉钉/企微等', '工作入口'] },
  { icon: CalendarCheck, title: '每日待办', desc: ['完成推荐任务', '让知识持续变好'] },
]

// ---------- 5 大价值 ----------

const VALUES = [
  { icon: Zap, title: '15 分钟接入已有资料', desc: '支持多种格式，快速构建知识库' },
  { icon: ShieldCheck, title: '答案有出处', desc: '引用原文定位来源，可信可追溯' },
  { icon: Lock, title: '权限正确', desc: '精细化权限控制，数据安全不泄露' },
  { icon: TrendingUp, title: '知识持续变好', desc: '使用与反馈驱动知识不断优化' },
  { icon: LayoutGrid, title: '可进入飞书 / 钉钉 / 企微等工作入口', desc: '无缝融入日常工作流' },
]

// ---------- 页面 ----------

type SubmitState = 'idle' | 'submitting' | 'success'

export default function TrialApply() {
  const navigate = useNavigate()
  const { state, pushMessage, pushAssistantMessage, setReplyScript, submitApplication } = useAppStore()
  const toast = useAppToast()

  const [form, setForm] = useState<ApplyForm>(DEFAULT_FORM)
  const [touched, setTouched] = useState<Partial<Record<keyof ApplyForm, boolean>>>({})
  const [selectedChip, setSelectedChip] = useState<string>('销售与售前')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [demoOpen, setDemoOpen] = useState(false)
  const [saveState, setSaveState] = useState<'已保存' | '正在保存…'>('已保存')
  const dirtyRef = useRef(false)
  const restoredRef = useRef(false)

  // 联系方式二选一 + OTP 校验 + 条款同意
  const [contactMode, setContactMode] = useState<ContactMode>('phone')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCountdown, setOtpCountdown] = useState(0)
  const [otp, setOtp] = useState('')
  const [otpStatus, setOtpStatus] = useState<'idle' | 'verified' | 'error'>('idle')
  const [agreed, setAgreed] = useState(false)
  /** 条款/隐私政策全文 Modal（null = 关闭） */
  const [termsDoc, setTermsDoc] = useState<keyof typeof TERMS_DOCS | null>(null)
  /** 发送验证码时的联系方式快照：联系方式被修改后需重新验证 */
  const otpTargetRef = useRef('')

  // 小知脚本：挂载时注入本页预写回复 + 补齐初始会话（共享会话跨页持久，已存在则不重复）
  useEffect(() => {
    setReplyScript((text) => CHIP_REPLIES[text] ?? (text === SCRIPT_USER ? SCRIPT_AI_2 : `收到。关于「${text.slice(0, 24)}」，你可以先在右侧完善试用申请信息，提交后我会继续引导你导入资料并验证答案。`))
    if (!state.chatMessages.some((m) => m.page === '/trial/apply' && m.content.includes('KnowledgeHub'))) {
      pushAssistantMessage(SCRIPT_AI_1, '/trial/apply')
      pushMessage('user', SCRIPT_USER, '/trial/apply')
    }
    return () => setReplyScript(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 草稿恢复（resumed 态）
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const draft = loadLS<Partial<ApplyForm> & { contactMode?: ContactMode } | null>(DRAFT_KEY, null)
    if (draft) {
      const { contactMode: savedMode, ...formDraft } = draft
      setForm((prev) => ({ ...prev, ...formDraft }))
      if (savedMode === 'phone' || savedMode === 'email') setContactMode(savedMode)
      toast.info('已恢复上次进度')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 停止输入 800ms 自动保存草稿
  useEffect(() => {
    if (!dirtyRef.current) return
    setSaveState('正在保存…')
    const timer = window.setTimeout(() => {
      saveLS(DRAFT_KEY, { ...form, contactMode })
      setSaveState('已保存')
    }, 800)
    return () => window.clearTimeout(timer)
  }, [form, contactMode])

  const errors = useMemo(() => validate(form, contactMode), [form, contactMode])
  const valid = Object.keys(errors).length === 0

  // ----- 联系方式二选一 + OTP -----
  const contactKey = contactMode === 'phone' ? 'phone' : 'email'
  const contactValue = form[contactKey]
  const contactError = errors[contactKey]
  const contactValid = !contactError
  const otpVerified = otpStatus === 'verified'

  const resetOtp = () => {
    setOtpSent(false)
    setOtp('')
    setOtpStatus('idle')
    setOtpCountdown(0)
  }

  // 发送后联系方式被修改 → 需要重新获取并校验验证码
  useEffect(() => {
    if (otpSent && contactValue !== otpTargetRef.current) resetOtp()
  }, [contactValue, otpSent])

  // 重发倒计时
  useEffect(() => {
    if (otpCountdown <= 0) return
    const timer = window.setTimeout(() => setOtpCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [otpCountdown])

  const switchMode = (mode: ContactMode) => {
    if (mode === contactMode) return
    setContactMode(mode)
    resetOtp()
  }

  const sendOtp = () => {
    if (!contactValid || otpCountdown > 0) return
    otpTargetRef.current = contactValue
    setOtpSent(true)
    setOtp('')
    setOtpStatus('idle')
    setOtpCountdown(OTP_COUNTDOWN_SECONDS)
    toast.info(`验证码已发送至你的${contactMode === 'phone' ? '手机' : '邮箱'}`)
  }

  /** mock 校验：任意 6 位数字即通过 */
  const handleOtpChange = (value: string) => {
    const next = value.slice(0, 6)
    setOtp(next)
    if (otpStatus !== 'idle') setOtpStatus('idle')
    if (next.length === 6) {
      if (/^\d{6}$/.test(next)) {
        setOtpStatus('verified')
        toast.success('验证成功')
      } else {
        setOtpStatus('error')
      }
    }
  }

  const setField = (key: keyof ApplyForm, value: string) => {
    dirtyRef.current = true
    setForm((prev) => ({ ...prev, [key]: value }))
  }
  const blurField = (key: keyof ApplyForm) => setTouched((prev) => ({ ...prev, [key]: true }))

  const handleChip = (chip: string) => {
    setSelectedChip(chip)
    pushMessage('user', chip, '/trial/apply')
    const goal = CHIP_GOALS[chip]
    if (goal) setField('goal', goal)
  }

  const handleSubmit = () => {
    if (!valid || !otpVerified || !agreed || submitState !== 'idle') return
    setSubmitState('submitting')
    window.setTimeout(() => {
      setSubmitState('success')
      submitApplication()
      // 提交成功：条款同意记录随草稿落盘（向后兼容旧草稿结构）
      saveLS(DRAFT_KEY, { ...form, contactMode, agreedVersion: TERMS_VERSION, agreedAt: new Date().toISOString() })
      toast.success('申请已提交成功')
      window.setTimeout(() => navigate('/workspace/quick-config'), 800)
    }, 1500)
  }

  const submitting = submitState === 'submitting'
  const succeeded = submitState === 'success'

  return (
    <div className="flex gap-6">
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />

      {/* 左栏：AI 对话面板 38% */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-[38%] min-w-[340px] max-w-[580px] shrink-0"
      >
        <ChatPanel
          chips={CHIPS as unknown as string[]}
          selectedChip={selectedChip}
          onChipSelect={handleChip}
          composerPlaceholder="输入你的问题或描述你的需求…"
          className="sticky top-20 h-[calc(100dvh-220px)] min-h-[560px]"
        />
      </motion.div>

      {/* 右栏：表单与价值区 62% */}
      <div className="min-w-0 flex-1">
        {/* 成功回执：卡片顶绿色成功条 */}
        {succeeded && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="mb-4 flex items-center gap-2 rounded-md border border-success/30 bg-success-bg px-4 py-3 text-body font-medium text-success"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            申请已通过，工作区已准备好
          </motion.div>
        )}

        {/* 卡 1：申请试用信息 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <SectionCard
            title="申请试用信息"
            icon={<FileText className="h-5 w-5" />}
            actions={<span className="text-caption text-neutral-400">{saveState}</span>}
          >
            <fieldset disabled={succeeded} className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <label className="mb-1.5 block text-body-sm text-neutral-700">
                  企业名称 <span className="text-danger">*</span>
                </label>
                <input
                  value={form.company}
                  onChange={(e) => setField('company', e.target.value)}
                  onBlur={() => blurField('company')}
                  placeholder="请输入企业名称"
                  className={inputCls(!!touched.company && !!errors.company)}
                />
                <FieldError text={touched.company ? errors.company : undefined} />
              </div>
              <div>
                <label className="mb-1.5 block text-body-sm text-neutral-700">
                  行业 <span className="text-danger">*</span>
                </label>
                <select
                  value={form.industry}
                  onChange={(e) => setField('industry', e.target.value)}
                  onBlur={() => blurField('industry')}
                  className={cn(inputCls(!!touched.industry && !!errors.industry), 'appearance-none bg-[right_12px_center] bg-no-repeat pr-8')}
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2398A2B3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                  }}
                >
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <FieldError text={touched.industry ? errors.industry : undefined} />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-body-sm text-neutral-700">
                  试用目标 <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <textarea
                    value={form.goal}
                    onChange={(e) => setField('goal', e.target.value.slice(0, 200))}
                    onBlur={() => blurField('goal')}
                    placeholder="描述你希望用企业知识库解决的问题…"
                    className={cn(inputCls(!!touched.goal && !!errors.goal), 'h-auto min-h-[88px] resize-none pb-6 pt-2.5')}
                  />
                  <span
                    className={cn(
                      'absolute bottom-2 right-3 text-caption',
                      form.goal.length >= 200 ? 'font-medium text-danger' : 'text-neutral-400',
                    )}
                  >
                    {form.goal.length}/200
                  </span>
                </div>
                <FieldError text={touched.goal ? errors.goal : undefined} />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-body-sm text-neutral-700">
                  联系方式 <span className="text-danger">*</span>
                </label>
                {/* 手机验证 / 邮箱验证 二选一切换 */}
                <div className="mb-3 inline-flex rounded-md bg-neutral-100 p-0.5" role="tablist" aria-label="联系方式验证方式">
                  {(['phone', 'email'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={contactMode === m}
                      onClick={() => switchMode(m)}
                      className={cn(
                        'h-8 rounded px-4 text-body-sm transition-colors duration-micro ease-brand',
                        contactMode === m ? 'bg-white font-medium text-brand-600 shadow-card' : 'text-neutral-500 hover:text-neutral-700',
                      )}
                    >
                      {m === 'phone' ? '手机验证' : '邮箱验证'}
                    </button>
                  ))}
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <input
                      value={contactValue}
                      onChange={(e) => setField(contactKey, e.target.value)}
                      onBlur={() => blurField(contactKey)}
                      placeholder={contactMode === 'phone' ? '请输入手机号' : '请输入邮箱'}
                      className={inputCls(!!touched[contactKey] && !!contactError)}
                    />
                    <FieldError text={touched[contactKey] ? contactError : undefined} />
                  </div>
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={!contactValid || otpCountdown > 0}
                    title={!contactValid ? `请先填写正确的${contactMode === 'phone' ? '手机号' : '邮箱'}` : undefined}
                    className={cn(
                      'h-10 shrink-0 rounded-md border border-[#BFD0F2] bg-white px-4 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50',
                      (!contactValid || otpCountdown > 0) && 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400 hover:bg-neutral-100',
                    )}
                  >
                    {otpCountdown > 0 ? `${otpCountdown}s 后重发` : otpSent ? '重新发送' : '发送验证码'}
                  </button>
                </div>
                {otpSent && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                    className="mt-3"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={otp}
                        onChange={(e) => handleOtpChange(e.target.value)}
                        placeholder="请输入 6 位验证码"
                        maxLength={6}
                        inputMode="numeric"
                        aria-label="验证码"
                        className={cn(inputCls(otpStatus === 'error'), 'w-44 tracking-[0.3em]')}
                      />
                      {otpVerified && (
                        <span className="flex items-center gap-1 text-body-sm text-success">
                          <ShieldCheck className="h-4 w-4" />
                          验证成功
                        </span>
                      )}
                    </div>
                    {otpStatus === 'error' ? (
                      <FieldError text="验证码错误，请重新输入" />
                    ) : !otpVerified ? (
                      <p className="mt-1 text-caption text-neutral-400">演示环境：任意 6 位数字即可</p>
                    ) : null}
                  </motion.div>
                )}
              </div>
            </fieldset>
          </SectionCard>
        </motion.div>

        {/* 卡 2：你的试用之旅 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-4"
        >
          <SectionCard title="你的试用之旅" icon={<Flag className="h-5 w-5" />}>
            <ol className="flex items-start">
              {JOURNEY_PREVIEW.map((step, i) => (
                <li key={step.title} className="flex min-w-0 flex-1 items-start">
                  {i > 0 && <span className="mx-2 mt-5 h-px flex-1 border-t border-dashed border-neutral-200" />}
                  <div className="group flex min-w-0 flex-1 flex-col items-center text-center transition-transform duration-micro ease-brand hover:-translate-y-0.5">
                    <span
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-micro ease-brand',
                        i === 0 ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-500 group-hover:bg-brand-50 group-hover:text-brand-600',
                      )}
                    >
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span className={cn('mt-2 text-body font-semibold', i === 0 ? 'text-brand-600' : 'text-neutral-950')}>
                      {step.title}
                    </span>
                    <span className="mt-0.5 text-caption leading-4 text-neutral-500">
                      {step.desc[0]}
                      <br />
                      {step.desc[1]}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>
        </motion.div>

        {/* 卡 3：你将获得的 5 大价值 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-4"
        >
          <SectionCard title="你将获得的 5 大价值" icon={<Megaphone className="h-5 w-5 text-violet" />}>
            <div className="grid grid-cols-5 gap-3">
              {VALUES.map((v) => (
                <div
                  key={v.title}
                  className="rounded-lg border border-neutral-200 bg-white p-3 transition-all duration-micro ease-brand hover:-translate-y-0.5 hover:border-brand-300"
                >
                  <v.icon className="h-6 w-6 text-brand-600" />
                  <p className="mt-2 text-body font-semibold leading-5 text-neutral-950">{v.title}</p>
                  <p className="mt-1 text-caption text-neutral-500">{v.desc}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </motion.div>

        {/* 条款同意（未勾选则主 CTA 禁用） */}
        <div className="mt-5 flex justify-end">
          <label className="flex cursor-pointer items-start gap-2 text-body-sm text-neutral-700">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-600"
            />
            <span>
              我已阅读并同意
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault()
                  setTermsDoc('terms')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setTermsDoc('terms')
                }}
                className="cursor-pointer text-brand-600 hover:underline"
              >
                《试用服务条款》
              </span>
              与
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault()
                  setTermsDoc('privacy')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setTermsDoc('privacy')
                }}
                className="cursor-pointer text-brand-600 hover:underline"
              >
                《隐私政策》
              </span>
              （{TERMS_VERSION}）
            </span>
          </label>
        </div>

        {/* 底部 CTA 行 */}
        <div className="mt-3 flex items-center justify-end gap-3">
          <SecondaryButton onClick={() => setDemoOpen(true)}>
            <Play className="h-4 w-4" />
            查看 10 分钟演示
          </SecondaryButton>
          <PrimaryButton
            gradient
            disabled={!valid || !otpVerified || !agreed || succeeded}
            loading={submitting}
            loadingText="正在提交申请…"
            title={
              !valid
                ? '请先完整填写必填信息'
                : !otpVerified
                  ? '请先获取并完成验证码校验'
                  : !agreed
                    ? '请先阅读并同意服务条款与隐私政策'
                    : undefined
            }
            onClick={handleSubmit}
          >
            提交试用申请
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </div>
      </div>

      {/* 条款/隐私政策全文 Modal：可滚动全文 + 「已阅读并同意」自动勾选外层 checkbox */}
      <Modal open={termsDoc !== null} onClose={() => setTermsDoc(null)} maxWidth="max-w-2xl">
        {termsDoc && (
          <div className="flex max-h-[84vh] flex-col rounded-xl border border-neutral-200 bg-white shadow-float">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-4">
              <div>
                <h3 className="text-h3 text-neutral-950">《{TERMS_DOCS[termsDoc].title}》</h3>
                <p className="mt-1 text-caption text-neutral-500">
                  版本 {TERMS_VERSION} · 生效日期：{TERMS_EFFECTIVE_DATE}
                </p>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <ol className="space-y-3">
                {TERMS_DOCS[termsDoc].articles.map((article, i) => (
                  <li key={i} className="text-body-sm leading-6 text-neutral-700">
                    <span className="font-semibold text-neutral-950">第 {i + 1} 条 </span>
                    {article}
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setTermsDoc(null)}
                className="h-10 rounded-md px-4 text-body text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgreed(true)
                  setTermsDoc(null)
                  toast.success('已阅读并同意服务条款与隐私政策')
                }}
                className="h-10 rounded-md bg-brand-600 px-5 text-body font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
              >
                已阅读并同意
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
