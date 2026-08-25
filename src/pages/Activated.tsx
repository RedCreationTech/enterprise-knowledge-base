/**
 * 激活交接页 activated（P07，activated.md，ActivationShell 无 Stepper 庆祝变体）
 * 完成态进度带 → 成功摘要 → 7 项激活条件清单 → 里程碑时间线 → 下一步入口 → 套餐触点 → 状态提升说明
 * 主 CTA「进入企业知识工作台」→ 初始化进度逐步打勾 → store.activated=true → 自动跳 /workspace/dashboard
 */
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { JOURNEY_STEPS, useAppStore } from '@/mocks'
import { MetricCard, SectionCard } from '@/components/common'
import { Modal } from '@/pages/activation/ui'
import { planMatrix } from '@/pages/workspace/settings.mock'
import { useAppToast } from '@/lib/toast'
import {
  activationChecklist,
  AI_SUMMARY,
  INIT_STEPS,
  milestones,
  nextEntries,
  PLAN_NOTE,
  upliftRows,
  valueMetrics,
} from '@/pages/activation/activated-data'

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1]

const ENTRY_ICONS = {
  book: BookOpen,
  bot: Bot,
  chart: BarChart3,
} as const

/** 「接下来你可以」3 张入口卡的目标路由（与卡片顺序一致） */
const ENTRY_ROUTES = ['/workspace/apps', '/workspace/invite-team', '/workspace/analytics'] as const

/** 套餐对比 Modal 展示的三列（数据只读 import settings.mock planMatrix；Business = 专业版） */
const PLAN_COMPARE_NAMES = ['Trial', 'Team', 'Business'] as const
const PRO_PLAN_NAME = 'Business'
const PLAN_LABELS: Record<string, string> = { Trial: '试用版', Team: '团队版', Business: '专业版' }

export default function Activated() {
  const toast = useAppToast()
  const { activate } = useAppStore()
  const navigate = useNavigate()
  const [techOpen, setTechOpen] = useState(false)
  const [initStep, setInitStep] = useState(-1) // -1 未开始 / 0..2 进行中 / 3 完成
  /** 套餐对比 Modal：compare = 查看对比；upgrade = 升级专业版（专业版列高亮） */
  const [planOpen, setPlanOpen] = useState<'compare' | 'upgrade' | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const allPassed = activationChecklist.every((c) => c.passed)

  const startEnter = () => {
    if (initStep >= 0) return
    setInitStep(0)
    INIT_STEPS.forEach((_, i) => {
      timersRef.current.push(setTimeout(() => setInitStep(i + 1), 700 * (i + 1)))
    })
    timersRef.current.push(
      setTimeout(() => {
        activate()
        toast.success('工作台已就绪，欢迎回来')
        navigate('/workspace/dashboard')
      }, 700 * INIT_STEPS.length + 300),
    )
  }

  const busy = initStep >= 0

  return (
    <div className="flex flex-col gap-5">

      {/* 完成态进度带 */}
      <div className="flex h-14 items-center justify-center gap-0 rounded-xl border border-neutral-200 bg-white px-6 shadow-card">
        {JOURNEY_STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center">
            {i > 0 && <span className="mx-3 h-px w-10 border-t border-dashed border-brand-300 md:w-14" />}
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white">
                <Check className="h-4 w-4" />
              </span>
              <span className="whitespace-nowrap text-body text-brand-600">{s.title}</span>
              {s.key === 'daily' && (
                <span className="rounded-pill bg-info-bg px-2 py-0.5 text-caption font-medium text-info">持续进行</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5">
        {/* 成功摘要标题（居中） */}
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success"
          >
            <Check className="h-6 w-6" />
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: 0.1, ease: EASE }}
            className="max-w-[760px] text-display text-neutral-950"
          >
            你的企业知识服务已经开始运行
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: 0.16, ease: EASE }}
            className="max-w-[760px] text-body text-neutral-500"
          >
            7 天试用目标全部达成，所有资料、知识与助手已原地升级为正式对象，无需重新导入
          </motion.p>
        </div>

        {/* 卡 1：试用价值摘要 */}
        <SectionCard title="试用价值摘要">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {valueMetrics.map((m, idx) => (
              <motion.div key={m.name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: idx * 0.06, ease: EASE }}>
                <MetricCard name={m.name} value={m.value} suffix={m.suffix} hint={m.hint} />
              </motion.div>
            ))}
          </div>
          <p className="mt-4 flex items-start gap-2 rounded-md bg-violet-bg px-3 py-2.5 text-body text-neutral-800">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
            {AI_SUMMARY}
          </p>
        </SectionCard>

        {/* 卡 2：激活条件确认 */}
        <SectionCard title="激活条件确认">
          <ul className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
            {activationChecklist.map((c, idx) => (
              <motion.li
                key={c.condition}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.24, delay: idx * 0.08, ease: EASE }}
                className="flex h-11 items-center gap-2.5 border-b border-neutral-100 last:border-b-0"
              >
                <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', c.passed ? 'bg-success text-white' : 'border border-neutral-300 bg-white text-neutral-400')}>
                  <Check className="h-3 w-3" />
                </span>
                <span className={cn('min-w-0 flex-1 truncate text-body', c.passed ? 'text-neutral-700' : 'text-neutral-400')}>{c.condition}</span>
                <span className="shrink-0 text-caption text-neutral-500">{c.evidence}</span>
              </motion.li>
            ))}
          </ul>
        </SectionCard>

        {/* 卡 3：首次里程碑 */}
        <SectionCard title="首次里程碑">
          <div className="flex items-start justify-between">
            {milestones.map((m, i) => (
              <div key={m.name} className="flex flex-1 items-start last:flex-none">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: 0.1 + i * 0.08, ease: EASE }}
                  className="flex w-28 flex-col items-center gap-1.5 text-center"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="text-body-sm font-medium text-neutral-950">{m.name}</span>
                  <span className="text-caption text-neutral-400">{m.doneAt}</span>
                </motion.div>
                {i < milestones.length - 1 && (
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 + i * 0.1, ease: EASE }}
                    className="mt-4 h-0.5 min-w-4 flex-1 origin-left rounded bg-brand-300"
                  />
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 卡 4：接下来你可以 */}
        <SectionCard title="接下来你可以">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {nextEntries.map((e, i) => {
              const Icon = ENTRY_ICONS[e.icon]
              return (
                <button
                  key={e.title}
                  type="button"
                  onClick={() => navigate(ENTRY_ROUTES[i] ?? e.path)}
                  className="group flex items-start gap-3 rounded-lg border border-neutral-200 p-4 text-left transition-all duration-micro ease-brand hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-neutral-950">{e.title}</span>
                    <span className="mt-0.5 block text-body-sm text-neutral-500">{e.desc}</span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-neutral-300 transition-transform duration-micro ease-brand group-hover:translate-x-1 group-hover:text-brand-600" />
                </button>
              )
            })}
          </div>
        </SectionCard>

        {/* 卡 5：套餐触点 */}
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl bg-brand-50 p-5 md:flex-row md:items-center">
          <p className="text-body text-neutral-800">
            当前为<span className="font-semibold">{PLAN_NOTE.plan}</span>（有效期至 {PLAN_NOTE.validUntil}）。{PLAN_NOTE.text}
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setPlanOpen('compare')} className="h-10 rounded-md border border-[#BFD0F2] bg-white px-4 text-body text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-100">
              查看套餐对比
            </button>
            <button type="button" onClick={() => setPlanOpen('upgrade')} className="h-10 rounded-md border border-[#BFD0F2] bg-white px-4 text-body text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-100">
              升级专业版
            </button>
          </div>
        </div>

        {/* 对象状态提升说明（折叠） */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-card">
          <button type="button" onClick={() => setTechOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-3.5 text-body-sm font-medium text-neutral-700">
            <span>对象状态提升说明（原地升级，不复制数据）</span>
            <span className="flex items-center gap-1 text-brand-600">
              查看技术细节
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-comp ease-brand', techOpen && 'rotate-180')} />
            </span>
          </button>
          <div className={cn('grid transition-[grid-template-rows] duration-comp ease-brand', techOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
            <div className="overflow-hidden">
              <table className="w-full border-t border-neutral-100 text-body-sm">
                <thead>
                  <tr className="h-10 bg-surface-soft text-left text-neutral-500">
                    <th className="pl-5 font-medium">对象</th>
                    <th className="font-medium">升级前</th>
                    <th className="pr-5 font-medium">升级后</th>
                  </tr>
                </thead>
                <tbody>
                  {upliftRows.map((r) => (
                    <tr key={r.object} className="h-11 border-t border-neutral-100">
                      <td className="pl-5 text-neutral-800">{r.object}</td>
                      <td className="text-neutral-500">{r.from}</td>
                      <td className="pr-5 font-medium text-success">{r.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 底部 CTA 行 */}
        <div className="flex flex-col items-center gap-3 pb-4 pt-2">
          <button
            type="button"
            disabled={!allPassed || busy}
            onClick={startEnter}
            className={cn(
              'inline-flex h-12 items-center gap-2 rounded-md bg-gradient-to-r from-brand-500 to-brand-600 px-8 text-body-lg font-semibold text-white transition-all duration-micro ease-brand hover:brightness-105 active:brightness-95',
              (!allPassed || busy) && !busy && 'cursor-not-allowed bg-none bg-neutral-100 text-neutral-400',
              busy && 'cursor-wait',
            )}
          >
            {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {busy ? '正在为你准备工作台…' : '进入企业知识工作台'}
            {!busy && <ArrowRight className="h-5 w-5" />}
          </button>
          {busy && (
            <ul className="flex items-center gap-5">
              {INIT_STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-1.5 text-body-sm">
                  {initStep > i ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-white">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  ) : (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
                  )}
                  <span className={initStep > i ? 'text-neutral-950' : 'text-neutral-500'}>{s}</span>
                </li>
              ))}
            </ul>
          )}
          {!busy && (
            <button type="button" onClick={() => navigate('/workspace/daily')} className="text-body text-neutral-500 hover:text-neutral-700 hover:underline">
              稍后进入
            </button>
          )}
        </div>
      </div>

      {/* 套餐对比 Modal（数据只读 import settings.mock planMatrix；upgrade 态专业版列高亮） */}
      <Modal open={planOpen !== null} onClose={() => setPlanOpen(null)} maxWidth="max-w-3xl">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-float">
          <h3 className="text-h3 text-neutral-950">套餐对比</h3>
          <p className="mt-1 text-body-sm text-neutral-500">升级后数据与配置全部保留，差价按剩余天数折算</p>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {PLAN_COMPARE_NAMES.map((name) => {
              const p = planMatrix.find((x) => x.name === name)
              if (!p) return null
              const isPro = name === PRO_PLAN_NAME
              const highlight = planOpen === 'upgrade' && isPro
              return (
                <div
                  key={name}
                  className={cn(
                    'flex flex-col rounded-lg border p-4 transition-all duration-micro ease-brand',
                    highlight ? 'border-[1.5px] border-brand-500 bg-surface-cardSel shadow-card' : 'border-neutral-200 bg-white',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body font-semibold text-neutral-950">{PLAN_LABELS[name] ?? p.name}</span>
                    {p.current && <span className="rounded-pill bg-neutral-100 px-2 py-0.5 text-caption text-neutral-500">当前套餐</span>}
                    {highlight && <span className="rounded-pill bg-brand-600 px-2 py-0.5 text-caption font-medium text-white">推荐升级</span>}
                  </div>
                  <p className="mt-1 text-body-sm text-brand-600">{p.price}</p>
                  <p className="mt-0.5 text-caption text-neutral-500">{p.seats}</p>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {p.highlight.map((h) => (
                      <li key={h} className="flex items-start gap-1.5 text-body-sm text-neutral-700">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setPlanOpen(null)} className="h-10 rounded-md px-4 text-body text-neutral-500 transition-colors duration-micro ease-brand hover:bg-neutral-100">
              关闭
            </button>
            <button
              type="button"
              onClick={() => {
                setPlanOpen(null)
                toast.success('已提交升级意向，客户成功顾问将在 1 个工作日内联系你')
              }}
              className="h-10 rounded-md bg-brand-600 px-5 text-body font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500 active:bg-brand-700"
            >
              联系顾问升级
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
