/**
 * 每日待办 /workspace/daily（V1.3 迁入标准 WorkspaceShell；原 /trial/daily 已 301，简洁壳变体废弃）
 * 标题区：面包屑「工作台 / 每日待办」+ H1「每日待办」+ 副标题（含数据更新时间）；长欢迎语保留在 AI 摘要面板首条消息
 * 三栏：左 AI 摘要面板（进度概览 + Top5 + 3 操作）/ 中 5 指标卡 + 5 分组 10 项任务表 / 右 快捷操作 + 趋势折线 + 推荐
 * 栅格：≥1536 3+6+3；1366–1535 中 8 + 右 4 且 AI 面板折叠为可展开摘要条（localStorage 记忆）；1280–1365 推荐卡并入趋势卡 Tab
 * 主 CTA「开始处理今日待办」平滑滚动定位到第一个未完成高优任务。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CalendarCheck,
  ChevronDown,
  CircleHelp,
  FileText,
  Flame,
  Lightbulb,
  MessageSquareText,
  Sparkles,
  Upload,
  UserPlus,
  Blocks,
} from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { daily, useAppStore } from '@/mocks'
import type { TaskItem } from '@/mocks'
import { ChatPanel } from '@/components/chat'
import { EmptyState, MetricCard, SectionCard, TaskRow } from '@/components/common'
import { Modal } from '@/pages/activation/ui'
import { SideDrawer } from '@/pages/workspace/SideDrawer'
import { PageHeader } from '@/pages/workspace/PageHeader'
import { useAppToast } from '@/lib/toast'
import { KEY_NAMESPACE, migrateRawKey } from '@/lib/storage'
import { dailyTaskDefs, GENERATED_TASKS, recommendArticles, recommendGroups, TASK_GROUPS, TASK_SKIP_REASONS, TRANSFER_MEMBERS, trend7d, trend30d } from '@/pages/activation/daily-data'

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1]
const PAGE = '/workspace/daily'

/** AI 摘要条展开状态本地记忆键（1366–1535 / 1280–1365 折叠形态） */
const SUMMARY_KEY = KEY_NAMESPACE.daily.summaryExpanded
/** Phase 3 Task 6 迁移回退旧 key：读取时迁移到新 key 并删除旧 key */
const LEGACY_SUMMARY_KEY = 'kb.daily.summaryExpanded'

/** 视口媒体查询（1280–1365 右栏推荐卡并入趋势卡 Tab 判定） */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    onChange()
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

const AI_GREETING = '欢迎回来，张伟 👋 这是你团队的试用进度概览：'
const AI_TOP5 =
  '我为你推荐今天的 Top 5 任务：\n1. 处理 5 条待处理反馈\n2. 完善 12 个知识问题的答案\n3. 邀请 3 位同事加入团队\n4. 上传产品手册资料\n5. 检查知识命中率并优化\n是否帮你生成今日执行计划？'

export default function DailyTodo() {
  const toast = useAppToast()
  const { state, updateTask, addTask, pushAssistantMessage, setReplyScript, loadDemoData } = useAppStore()
  const navigate = useNavigate()
  /** 真实空态起点：任务列表展示 3 条新手引导任务，统计图表区展示空态 */
  const demoOff = state.demoData === false

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [highOnly, setHighOnly] = useState(false)
  const [trendRange, setTrendRange] = useState<'7' | '30'>('7')
  const [recGroup, setRecGroup] = useState(0)
  const [skipTask, setSkipTask] = useState<TaskItem | null>(null)
  const [skipReason, setSkipReason] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  /** AI 摘要条展开态（<1536 折叠形态，localStorage 记忆） */
  const [summaryExpanded, setSummaryExpanded] = useState(() => {
    try {
      migrateRawKey(LEGACY_SUMMARY_KEY, SUMMARY_KEY)
      return localStorage.getItem(SUMMARY_KEY) === '1'
    } catch {
      return false
    }
  })
  /** 1280–1365：右栏「推荐」卡折叠进「趋势」卡 Tab */
  const compactRight = useMediaQuery('(max-width: 1365px)')
  const [rightTab, setRightTab] = useState<'trend' | 'rec'>('trend')
  /** 推荐条目全文抽屉（展示 recommendArticles 长文） */
  const [recArticle, setRecArticle] = useState<string | null>(null)

  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const initialDoneIds = useRef<Set<string> | null>(null)

  // ----- 会话种子 + 回复脚本 -----
  useEffect(() => {
    if (!state.chatMessages.some((m) => m.page === PAGE && m.content.includes('试用进度概览'))) {
      pushAssistantMessage(AI_GREETING, PAGE)
      pushAssistantMessage(AI_TOP5, PAGE)
    }
    setReplyScript(() => '今天的关键是先处理高优先级任务：反馈处理与知识完善会直接影响答案质量。点击「开始处理今日待办」我会带你定位到第一个高优任务。')
    return () => setReplyScript(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ----- 记录进入页面时的已完成任务（用于统计本次会话新增完成数） -----
  useEffect(() => {
    if (initialDoneIds.current || state.tasks.length === 0) return
    initialDoneIds.current = new Set(state.tasks.filter((t) => t.status === '已完成').map((t) => t.id))
  }, [state.tasks])

  // ----- 派生数据 -----
  const tasks = state.tasks
  const routeByTitle = useMemo(() => new Map(dailyTaskDefs.map((d) => [d.title, d.route])), [])
  const visibleTasks = highOnly ? tasks.filter((t) => t.priority === '高') : tasks
  const newlyDone = tasks.filter((t) => t.status === '已完成' && initialDoneIds.current && !initialDoneIds.current.has(t.id)).length
  // 空态时待办数直接取 store 真实任务（3 条新手引导），不套用 mock 口径
  const todoCount = demoOff
    ? tasks.filter((t) => t.status === '待处理' || t.status === '进行中').length
    : Math.max(0, daily.todos - newlyDone)
  // 空态时按 store 任务实际分组渲染（新手引导），演示模式保持设计口径 5 分组
  const groupNames: string[] = demoOff
    ? [...new Set(visibleTasks.map((t) => t.group))]
    : [...TASK_GROUPS]

  const firstHighOpen = tasks.find((t) => t.priority === '高' && t.status !== '已完成' && t.status !== '已跳过')
  /** 任意优先级的第一个未完成任务（高优全部完成时回退定位） */
  const firstOpen = tasks.find((t) => t.status !== '已完成' && t.status !== '已跳过')

  // ----- 交互 -----
  const scrollToTask = (id: string) => {
    rowRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(id)
    setTimeout(() => setHighlightId(null), 1600)
  }

  const handlePrimary = (task: TaskItem) => {
    if (task.status === '进行中') {
      updateTask(task.id, { status: '已完成' })
      toast.success(`「${task.title}」已完成`)
      return
    }
    updateTask(task.id, { status: '进行中' })
    toast.info(`已开始处理「${task.title}」`)
    const route = routeByTitle.get(task.title) ?? task.route
    if (route) setTimeout(() => navigate(route), 400)
  }

  const handleLoadDemo = () => {
    loadDemoData()
    toast.success('已载入演示数据')
  }

  /** 空态卡统一操作区：主按钮载入演示数据 + 快速配置入口 */
  const demoEmptyAction = (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={handleLoadDemo}
        className="inline-flex h-10 items-center justify-center rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
      >
        载入演示数据
      </button>
      <button
        type="button"
        onClick={() => navigate('/workspace/quick-config')}
        className="inline-flex h-10 items-center justify-center rounded-md border border-[#BFD0F2] bg-white px-4 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
      >
        开始快速配置
      </button>
    </div>
  )

  const handleLater = (task: TaskItem) => {
    toast.info(`已设置稍后提醒：「${task.title}」将于明天上午再次提醒（24h 内不再重复提醒）`)
  }

  const handleTransfer = (task: TaskItem) => {
    const next = TRANSFER_MEMBERS.find((m) => m !== task.owner) ?? TRANSFER_MEMBERS[0]
    updateTask(task.id, { owner: next, status: '已转交' })
    toast.success(`已转交给 ${next}`)
  }

  const confirmSkip = () => {
    if (!skipTask || !skipReason) return
    updateTask(skipTask.id, { status: '已跳过', reason: `${skipTask.reason ?? ''}（跳过原因：${skipReason}）` })
    toast.info(`已跳过「${skipTask.title}」（原因：${skipReason}）`)
    setSkipTask(null)
    setSkipReason('')
  }

  /** 一键生成任务：真实插入 GENERATED_TASKS（按标题去重），Toast 数字与实际新增一致 */
  const generateTasks = () => {
    const fresh = GENERATED_TASKS.filter((t) => !tasks.some((x) => x.title === t.title))
    fresh.forEach((t) => addTask(t))
    if (fresh.length > 0) {
      pushAssistantMessage(
        '已为你生成今日执行计划：\n1. 上午：处理待反馈与高优知识问题\n2. 下午：跟进未激活同事并检查应用使用\n3. 收尾：查看命中率趋势并记录优化点',
        PAGE,
      )
      toast.success(`已生成 ${fresh.length} 条新任务`)
    } else {
      toast.info('今日任务已是最新，没有需要新生成的任务')
    }
  }

  const tellBestPractice = () => {
    const first = recommendGroups[recGroup][0]
    pushAssistantMessage(`最佳实践推荐：「${first.title}」——${first.desc}。详见右侧「知识助手推荐」。`, PAGE)
  }

  const scrollToGroup = (g: string) => {
    setCollapsed((prev) => ({ ...prev, [g]: false }))
    groupRefs.current[g]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /** AI 摘要条展开/收起（状态写入 localStorage，刷新后保持） */
  const toggleSummary = () => {
    setSummaryExpanded((v) => {
      localStorage.setItem(SUMMARY_KEY, v ? '0' : '1')
      return !v
    })
  }

  const appsInstalledText = `${daily.appsInstalled} 个`

  const trendData = trendRange === '7' ? trend7d : trend30d

  /** 知识助手推荐列表：右栏独立卡（≥1366）与趋势卡「推荐」Tab（1280–1365）共用 */
  const recommendList = (
    <ul className="space-y-3">
      {recommendGroups[recGroup].map((r) => (
        <li key={r.title}>
          <button type="button" onClick={() => setRecArticle(r.title)} className="flex w-full items-start gap-2.5 rounded-md p-1 text-left transition-colors duration-micro ease-brand hover:bg-neutral-50">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', r.iconBg)}>
              <Lightbulb className={cn('h-4 w-4', r.iconColor)} />
            </span>
            <span>
              <span className="block text-body-sm font-semibold text-neutral-950">{r.title}</span>
              <span className="mt-0.5 block text-caption text-neutral-500">{r.desc}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )

  const rangeSelect = (
    <select
      value={trendRange}
      onChange={(e) => setTrendRange(e.target.value as '7' | '30')}
      className="h-7 rounded-md border border-neutral-200 bg-white px-1.5 text-caption text-neutral-700 outline-none focus:border-brand-500"
    >
      <option value="7">近 7 天</option>
      <option value="30">近 30 天</option>
    </select>
  )

  return (
    <div className="flex flex-col gap-5 xl:h-[calc(100dvh-104px)] xl:gap-4">

      {/* 标题区（Workspace 规范：面包屑 + H1 + 副标题含更新时间；长欢迎语保留在 AI 摘要面板首条消息） */}
      <PageHeader
        crumbs={['工作台', '每日待办']}
        title="每日待办"
        subtitle="坚持每天完成关键动作，几分钟内就能看到知识被正确使用 · 数据更新于 今天 10:30"
      />

      {/* AI 摘要条（<1536：左栏 AI 摘要面板折叠形态；展开/收起状态 localStorage 记忆） */}
      <div className="2xl:hidden">
        <div className="flex h-10 items-center justify-between gap-3 rounded-xl bg-brand-50 px-4">
          <span className="truncate text-body-sm text-neutral-800">💡 小知：今日 Top 5 任务已就绪，需要执行计划吗？</span>
          <button
            type="button"
            onClick={toggleSummary}
            className="shrink-0 text-body-sm font-medium text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500 hover:underline"
          >
            {summaryExpanded ? '收起' : '展开 ›'}
          </button>
        </div>
        <div className={cn('grid transition-[grid-template-rows] duration-modal ease-brand', summaryExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
          <div className="overflow-hidden">
            <div className="mt-2 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-card">
              <p className="text-body-sm text-neutral-800">{AI_GREETING}</p>
              <p className="whitespace-pre-wrap text-body-sm text-neutral-500">{AI_TOP5}</p>
              <button
                type="button"
                onClick={generateTasks}
                className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-md border border-[#BFD0F2] bg-white px-4 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
              >
                <FileText className="h-4 w-4" />
                帮我生成执行计划
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:min-h-0 xl:flex-1 xl:items-stretch xl:grid-cols-12">
        {/* 左栏：AI 摘要面板（≥1536 常驻 3 列，≈380px sticky） */}
        <ChatPanel
          className="hidden 2xl:block 2xl:col-span-3 2xl:min-h-0 2xl:overflow-hidden"
          composerPlaceholder="问我任何关于知识库的问题…"
          timelineFooter={
            <>
              {/* 进度概览键值列表（空态时无运营数据，展示引导提示） */}
              {demoOff ? (
                <div className="w-full rounded-lg border border-neutral-200 bg-white p-3 shadow-card">
                  <p className="text-body-sm font-semibold text-neutral-950">还没有运营数据</p>
                  <p className="mt-1 text-caption text-neutral-500">完成快速配置或载入演示数据后，这里会展示真实的进度概览。</p>
                  <button
                    type="button"
                    onClick={handleLoadDemo}
                    className="mt-2 text-body-sm font-medium text-brand-600 transition-colors duration-micro ease-brand hover:text-brand-500 hover:underline"
                  >
                    载入演示数据 ›
                  </button>
                </div>
              ) : (
              <div className="w-full rounded-lg border border-neutral-200 bg-white p-3 shadow-card">
                {[
                  ['已上传资料', `${daily.uploaded} 份`, ''],
                  ['知识问题总数', `${daily.questionTotal} 个`, '待处理 23 个'],
                  ['团队成员', `${daily.members} 人`, '已邀请'],
                  ['已安装应用', appsInstalledText, '企业微信 · SSO · 自定义 API'],
                  ['累计问答', `${daily.usageTotal.toLocaleString('en-US')} 次`, ''],
                ].map(([k, v, hint]) => (
                  <div key={k} className="flex h-8 items-center justify-between text-body-sm">
                    <span className="text-neutral-700">{k}</span>
                    <span className="font-semibold text-brand-600">
                      {v}
                      {hint && <span className="ml-1 text-caption font-normal text-neutral-400">（{hint}）</span>}
                    </span>
                  </div>
                ))}
              </div>
              )}
              {/* 3 个 Secondary 操作 */}
              <div className="flex w-full flex-col gap-2">
                <button type="button" onClick={generateTasks} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#BFD0F2] bg-white text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50">
                  <FileText className="h-4 w-4" />
                  帮我生成任务
                </button>
                <button type="button" onClick={() => navigate('/workspace/analytics')} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#BFD0F2] bg-white text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50">
                  <BarChart3 className="h-4 w-4" />
                  查看使用分析
                </button>
                <button type="button" onClick={tellBestPractice} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#BFD0F2] bg-white text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50">
                  <Lightbulb className="h-4 w-4" />
                  告诉我最佳实践
                </button>
              </div>
            </>
          }
        />

        {/* 中栏（1366–1535 占 8 列；≥1536 占 6 列） */}
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-8 xl:min-h-0 xl:overflow-y-auto xl:pr-1 2xl:col-span-6">
          {/* 待办提醒概览 5 卡（空态：统计区替换为空态卡，任务列表仍展示新手引导任务） */}
          {demoOff ? (
            <div className="rounded-xl border border-neutral-200 bg-white shadow-card">
              <EmptyState
                title="还没有运营数据"
                description="完成快速配置或载入演示数据后，这里会展示真实的运营数据。"
                action={demoEmptyAction}
              />
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
            {[
              { name: '今日待办', value: todoCount, suffix: '项', icon: <CalendarCheck className="h-4 w-4" />, onClick: () => scrollToGroup('试用推进') },
              { name: '高优先级', value: daily.highPriority, suffix: '项', icon: <Flame className="h-4 w-4 text-danger" />, onClick: () => setHighOnly((v) => !v) },
              { name: '待处理反馈', value: daily.pendingFeedback, suffix: '条', icon: <MessageSquareText className="h-4 w-4" />, onClick: () => scrollToGroup('数据与反馈') },
              { name: '新增问题', value: daily.newQuestions, suffix: '个', icon: <CircleHelp className="h-4 w-4" />, onClick: () => scrollToGroup('知识完善') },
              { name: '试用天数', value: daily.trialDay, suffix: '天', icon: <CalendarDays className="h-4 w-4" />, onClick: undefined },
            ].map((m, idx) => (
              <motion.div key={m.name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: idx * 0.06, ease: EASE }}>
                <MetricCard name={m.name} value={m.value} suffix={m.suffix} icon={m.icon} onClick={m.onClick} className={cn('p-4', m.name === '高优先级' && highOnly && 'border-[1.5px] border-brand-500 bg-surface-cardSel')} />
              </motion.div>
            ))}
          </div>
          )}
          {highOnly && (
            <div className="flex items-center justify-between rounded-md bg-brand-50 px-3 py-2 text-body-sm text-brand-700">
              已过滤：仅显示高优先级任务（{visibleTasks.length} 项）
              <button type="button" onClick={() => setHighOnly(false)} className="font-medium hover:underline">
                显示全部
              </button>
            </div>
          )}

          {/* 今日待办分组表格（空态：按 store 实际分组展示新手引导任务） */}
          <SectionCard title={`今日待办（${todoCount} 项）`} bodyClassName="flex flex-col gap-3">
            {groupNames.map((g) => {
              const groupTasks = visibleTasks.filter((t) => t.group === g)
              if (highOnly && groupTasks.length === 0) return null
              const isCollapsed = collapsed[g]
              return (
                <div key={g} ref={(el) => { groupRefs.current[g] = el }}>
                  <button
                    type="button"
                    onClick={() => setCollapsed((prev) => ({ ...prev, [g]: !prev[g] }))}
                    className="flex items-center gap-1.5 text-body-sm font-semibold text-brand-600"
                  >
                    <ChevronDown className={cn('h-4 w-4 transition-transform duration-comp ease-brand', isCollapsed && '-rotate-90')} />
                    {g}（{groupTasks.length} 项）
                  </button>
                  <div className={cn('grid transition-[grid-template-rows] duration-comp ease-brand', isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}>
                    <div className="overflow-hidden">
                      <div className="pt-1">
                        {groupTasks.map((t) => (
                          <div
                            key={t.id}
                            ref={(el) => { rowRefs.current[t.id] = el }}
                            className={cn('rounded-md transition-shadow duration-comp', highlightId === t.id && 'shadow-focus')}
                          >
                            <TaskRow
                              task={t}
                              primaryLabel={t.status === '进行中' ? '标记完成' : '开始处理'}
                              onPrimary={handlePrimary}
                              onLater={handleLater}
                              onTransfer={handleTransfer}
                              onSkip={(task) => {
                                setSkipTask(task)
                                setSkipReason('')
                              }}
                            />
                          </div>
                        ))}
                        {groupTasks.length === 0 && <p className="py-2 text-caption text-neutral-400">该分组暂无任务</p>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </SectionCard>
        </div>

        {/* 右栏（1366–1535 占 4 列；≥1536 占 3 列）：独立滚动容器，与左侧「智能助手」栏、页面主滚动各自分离（§5.6 滚动分区） */}
        <div className="flex flex-col gap-4 xl:col-span-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1 2xl:col-span-3">
          {/* 快捷操作 */}
          <SectionCard title="快捷操作">
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: <Sparkles className="h-5 w-5" />, name: '一键生成任务', desc: '根据进度智能生成', onClick: generateTasks },
                { icon: <UserPlus className="h-5 w-5" />, name: '邀请同事', desc: '邀请加入团队', onClick: () => navigate('/workspace/invite-team') },
                { icon: <Upload className="h-5 w-5" />, name: '上传资料', desc: '文档/表格/图片', onClick: () => navigate('/workspace/knowledge-base') },
                { icon: <Blocks className="h-5 w-5" />, name: '应用管理', desc: '查看与配置应用', onClick: () => navigate('/workspace/apps') },
              ].map((a) => (
                <button key={a.name} type="button" onClick={a.onClick} className="flex flex-col items-start gap-1.5 rounded-lg border border-neutral-200 p-3 text-left transition-colors duration-micro ease-brand hover:border-brand-300 hover:bg-brand-50">
                  <span className="text-brand-600">{a.icon}</span>
                  <span className="text-body-sm font-semibold text-neutral-950">{a.name}</span>
                  <span className="text-caption text-neutral-500">{a.desc}</span>
                </button>
              ))}
            </div>
          </SectionCard>

          {/* 登录提醒 + 趋势（1280–1365：推荐卡并入本卡 Tab；空态：图表区替换为空态） */}
          <SectionCard
            title="最近使用趋势"
            actions={
              demoOff ? undefined :
              compactRight ? (
                <div className="flex gap-1">
                  {([
                    ['trend', '趋势'],
                    ['rec', '推荐'],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRightTab(key)}
                      className={cn(
                        'h-7 rounded-pill px-2.5 text-caption transition-colors duration-micro ease-brand',
                        rightTab === key ? 'bg-brand-600 font-medium text-white' : 'text-neutral-500 hover:bg-neutral-100',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                rangeSelect
              )
            }
          >
            {demoOff ? (
              <EmptyState
                title="还没有运营数据"
                description="完成快速配置或载入演示数据后，这里会展示真实的使用趋势。"
                action={demoEmptyAction}
                className="py-8"
              />
            ) : compactRight && rightTab === 'rec' ? (
              recommendList
            ) : (
              <>
                {compactRight && <div className="mb-2 flex justify-end">{rangeSelect}</div>}
                <div className="mb-3 space-y-1 text-body-sm text-neutral-700">
              <p className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-neutral-400" />
                上次登录{'　'}2025-05-29 09:12
              </p>
              <p className="flex items-center gap-1.5">
                <CalendarCheck className="h-3.5 w-3.5 text-success" />
                连续登录{'　'}<span className="font-bold text-success">5 天</span>
              </p>
            </div>
            <p className="mb-1 text-caption text-neutral-400">使用次数（次）</p>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 14, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#E4EAF2" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#7B879A' }} axisLine={{ stroke: '#E4EAF2' }} tickLine={false} interval={trendRange === '30' ? 4 : 0} />
                  <YAxis domain={[0, 120]} ticks={[0, 30, 60, 90, 120]} tick={{ fontSize: 10, fill: '#7B879A' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4EAF2', boxShadow: '0 8px 24px rgba(31,55,90,0.06)' }}
                    formatter={(v) => [`${v} 次`, '使用次数']}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#2F74FF"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#2F74FF', strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                    label={trendRange === '7' ? { position: 'top', fontSize: 10, fill: '#475569' } : false}
                    isAnimationActive
                    animationDuration={0.9}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
              </>
            )}
          </SectionCard>

          {/* 知识助手推荐（≥1366 独立卡；1280–1365 已并入上方趋势卡 Tab） */}
          {!compactRight && (
            <SectionCard
              title="知识助手推荐"
              actions={
                <button type="button" onClick={() => setRecGroup((v) => (v + 1) % recommendGroups.length)} className="text-body-sm text-brand-600 hover:underline">
                  换一换
                </button>
              }
            >
              {recommendList}
            </SectionCard>
          )}
        </div>
      </div>

      {/* 底部 CTA 行 */}
      <div className="flex items-center justify-center gap-4 pb-2 pt-1 xl:shrink-0">
        <button
          type="button"
          onClick={() => {
            const target = firstHighOpen ?? firstOpen
            if (target) scrollToTask(target.id)
            else toast.success('今日任务已全部完成 🎉')
          }}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-gradient-to-r from-brand-500 to-brand-600 px-7 text-body font-semibold text-white transition-all duration-micro ease-brand hover:brightness-105 active:brightness-95"
        >
          开始处理今日待办
          <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={generateTasks} className="inline-flex h-11 items-center gap-2 rounded-md border border-[#BFD0F2] bg-white px-5 text-body font-medium text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50">
          一键生成任务
          <Sparkles className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => navigate('/workspace/analytics')} className="inline-flex h-11 items-center gap-2 rounded-md border border-[#BFD0F2] bg-white px-5 text-body font-medium text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50">
          查看使用分析
          <BarChart3 className="h-4 w-4" />
        </button>
      </div>

      {/* 推荐条目全文抽屉（mock 长文 3-5 段） */}
      <SideDrawer open={recArticle !== null} onClose={() => setRecArticle(null)} title={recArticle ?? ''} width={520}>
        {recArticle && (
          <div className="flex flex-col gap-4 p-5">
            <p className="flex items-center gap-2 rounded-md bg-brand-50 px-3 py-2 text-body-sm text-brand-700">
              <Lightbulb className="h-4 w-4 shrink-0" />
              小知精选 · 知识运营最佳实践
            </p>
            {(recommendArticles[recArticle] ?? []).map((para, i) => (
              <p key={i} className="text-body leading-7 text-neutral-800">
                {para}
              </p>
            ))}
          </div>
        )}
      </SideDrawer>

      {/* 跳过原因 Modal */}
      <Modal open={skipTask !== null} onClose={() => setSkipTask(null)} maxWidth="max-w-md">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-float">
          <h3 className="text-h3 text-neutral-950">跳过任务</h3>
          <p className="mt-1 text-body-sm text-neutral-500">「{skipTask?.title}」请选择跳过原因（必选）</p>
          <div className="mt-4 space-y-2">
            {TASK_SKIP_REASONS.map((r) => (
              <label key={r} className={cn('flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-body-sm transition-colors duration-micro', skipReason === r ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50')}>
                <input type="radio" name="task-skip" checked={skipReason === r} onChange={() => setSkipReason(r)} className="accent-brand-600" />
                {r}
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setSkipTask(null)} className="h-10 rounded-md px-4 text-body text-neutral-500 hover:bg-neutral-100">
              取消
            </button>
            <button
              type="button"
              disabled={!skipReason}
              onClick={confirmSkip}
              className={cn('h-10 rounded-md bg-brand-600 px-5 text-body font-medium text-white hover:bg-brand-500', !skipReason && 'cursor-not-allowed bg-neutral-100 text-neutral-400')}
            >
              确认跳过
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
