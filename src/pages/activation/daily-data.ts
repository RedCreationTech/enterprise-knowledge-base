/**
 * 每日待办页 mock：10 项任务（图 7 逐字）、趋势数据、推荐条目、跳过原因。
 * 任务标题/分组/优先级/状态/截止/负责人以 daily-todo.md §3.3 为唯一基准。
 */
import { daily, invitees, trend7dLabels } from '@/mocks'
import type { TaskItem } from '@/mocks/store'

export interface DailyTaskDef extends Omit<TaskItem, 'id'> {
  key: string
  /** 「开始处理」跳转路由 */
  route: string
}

export const TASK_GROUPS = ['试用推进', '知识完善', '邀请与跟进', '应用试用', '数据与反馈'] as const

/**
 * 「开始处理」路由映射表：标题与 src/mocks/store.tsx initialTasks 的 10 条任务逐字对齐，
 * DailyTodo 按 title 查表跳转（400ms 延迟，先置「进行中」）。
 */
export const dailyTaskDefs: DailyTaskDef[] = [
  { key: 't1', group: '试用推进', title: '完成知识库快速配置', reason: '配置完成后才能生成可信答案', priority: '高', status: '待处理', due: '今天 18:00', owner: '张伟', route: '/workspace/quick-config' },
  { key: 't2', group: '试用推进', title: '确认第一个可信答案', reason: '验证知识是邀请同事的前置条件', priority: '高', status: '待处理', due: '今天 18:00', owner: '张伟', route: '/workspace/verify-answer' },
  { key: 't3', group: '知识完善', title: '补充客服售后知识空间', reason: '客服类问题命中率低于 60%', priority: '中', status: '待处理', due: '明天 12:00', owner: '张伟', route: '/workspace/knowledge-base' },
  { key: 't4', group: '知识完善', title: '确认《价格管理办法》最新版本', reason: '检测到两份报价政策存在版本冲突', priority: '高', status: '待处理', due: '明天 12:00', owner: '张伟', route: '/workspace/knowledge-base' },
  { key: 't5', group: '邀请与跟进', title: `跟进 ${invitees} 名被邀请同事的激活情况`, reason: '邀请发出后 24h 内跟进效果最佳', priority: '中', status: '待处理', due: '本周五', owner: '张伟', route: '/workspace/invite-team' },
  { key: 't6', group: '邀请与跟进', title: '为售前团队指定知识 Owner', reason: '无人负责的空间问题会无人处理', priority: '中', status: '待处理', due: '本周五', owner: '张伟', route: '/workspace/permissions' },
  { key: 't7', group: '应用试用', title: '在飞书完成首次可信回答测试', reason: '安装成功 ≠ 试用成功，需渠道内验证', priority: '高', status: '待处理', due: '明天 18:00', owner: '张伟', route: '/workspace/apps' },
  { key: 't8', group: '应用试用', title: '评估是否启用官网客服组件', reason: '外部渠道上线前需完成灰度评估', priority: '低', status: '待处理', due: '本周内', owner: '张伟', route: '/workspace/apps' },
  { key: 't9', group: '数据与反馈', title: `处理 ${daily.pendingFeedback} 条待审核反馈`, reason: '反馈闭环可持续提升答案质量', priority: '中', status: '待处理', due: '今天 20:00', owner: '张伟', route: '/workspace/feedback' },
  { key: 't10', group: '数据与反馈', title: '查看上周知识使用趋势', reason: '近 7 天使用量持续上升', priority: '低', status: '待处理', due: '本周内', owner: '张伟', route: '/workspace/analytics' },
]

/** 「跳过」必填原因 */
export const TASK_SKIP_REASONS = ['今天没有时间处理', '任务与当前目标无关', '已由其他人跟进', '其他原因']

/** 转交候选成员 */
export const TRANSFER_MEMBERS = ['李娜', '王强', '赵敏']

export interface TrendPoint {
  date: string
  value: number
}

/** 近 7 天（与 base.mock daily.trend7d 完全一致，日期标签由 TODAY 派生，合计 328） */
export const trend7d: TrendPoint[] = trend7dLabels('M/D').map((date, i) => ({
  date,
  value: [32, 41, 44, 48, 52, 55, 56][i],
}))

/** 近 30 天 mock（整体上行趋势，末端与 7 天数据衔接） */
export const trend30d: TrendPoint[] = (() => {
  const seeds = [12, 15, 14, 18, 22, 20, 25, 24, 28, 31, 30, 35, 33, 38, 42, 40, 45, 47, 44, 52, 55, 53, 58]
  const points: TrendPoint[] = seeds.map((v, i) => ({ date: `5/${i + 1}`, value: v }))
  return points.concat(trend7d.map((p) => ({ ...p })))
})()

export interface RecommendItem {
  iconBg: string
  iconColor: string
  title: string
  desc: string
}

/** 知识助手推荐（2 组 × 3 条，「换一换」轮换） */
export const recommendGroups: RecommendItem[][] = [
  [
    { iconBg: 'bg-brand-100', iconColor: 'text-brand-600', title: '建立高质量知识的 3 个要点', desc: '结构化、场景化、持续迭代，提升命中率' },
    { iconBg: 'bg-success-bg', iconColor: 'text-success', title: '如何提升知识库使用率', desc: '从入口曝光、精准推荐到效果反馈闭环' },
    { iconBg: 'bg-violet-bg', iconColor: 'text-violet', title: '飞书集成最佳实践', desc: '单点登录、消息推送、知识卡片配置建议' },
  ],
  [
    { iconBg: 'bg-warning-bg', iconColor: 'text-warning', title: '试用期第 2 周该做什么', desc: '把高频问题打磨到 90% 以上认可率' },
    { iconBg: 'bg-cyan-bg', iconColor: 'text-cyan', title: '无答案问题治理指南', desc: '识别知识缺口，指定 Owner 闭环处理' },
    { iconBg: 'bg-danger-bg', iconColor: 'text-danger', title: '如何让答案更可信', desc: '引用覆盖率、版本管理与有效期设置' },
  ],
]

/** 一键生成任务 → 真实插入 3 条不同任务（走 store addTask，Toast 数字与实际一致） */
export const GENERATED_TASKS: Omit<TaskItem, 'id'>[] = [
  {
    group: '试用推进',
    title: '检查知识命中率并优化 Top 问题',
    reason: '小知根据试用进度智能生成',
    priority: '中',
    status: '待处理',
    due: '今天 21:00',
    owner: '张伟',
    route: '/workspace/analytics',
  },
  {
    group: '邀请与跟进',
    title: '提醒 2 位未激活同事完成首次登录',
    reason: '小知根据邀请转化数据智能生成',
    priority: '中',
    status: '待处理',
    due: '明天 12:00',
    owner: '张伟',
    route: '/workspace/invite-team',
  },
  {
    group: '数据与反馈',
    title: '整理本周高频无答案问题清单',
    reason: '小知根据问答日志智能生成',
    priority: '低',
    status: '待处理',
    due: '本周五',
    owner: '张伟',
    route: '/workspace/feedback',
  },
]

/** 推荐条目全文（点击「知识助手推荐」条目在 SideDrawer 展示，mock 长文 3-5 段） */
export const recommendArticles: Record<string, string[]> = {
  '建立高质量知识的 3 个要点': [
    '高质量知识的第一要义是结构化。把散落在聊天记录、邮件与个人笔记中的经验，整理为「问题—结论—依据」三段式条目：先给出用户真实会问的问题，再给出一句话结论，最后附上制度原文或数据出处。结构化的知识不仅检索命中率更高，也更容易在答案中生成可点击的引用来源。',
    '第二要义是场景化。同一份《价格管理办法》，销售关心「折扣超过多少需要审批」，客服关心「已成交订单能否补差价」。建议按角色与场景拆分知识空间，并在每个空间内维护该场景的高频问题清单，让答案贴近真实提问方式，而不是简单堆砌制度原文。',
    '第三要义是持续迭代。知识不是一次导入就结束的资产：每周复盘无答案问题与低认可答案，指定 Owner 在治理队列中闭环处理；对有时效性的制度类文档设置有效期与负责人，到期自动提醒更新，避免过期答案损害团队对知识库的信任。',
    '落地建议：本周先选 1 个高频场景（如销售报价），按三段式补齐 Top 20 问题，观察命中率与认可率变化，再推广到其他团队。',
  ],
  '如何提升知识库使用率': [
    '使用率的第一杠杆是入口曝光。员工不会为了找一个答案主动打开新系统——把问答入口装进他们每天所在的飞书、钉钉、企业微信会话与群聊，让「先问知识库」成为零成本的默认动作。数据显示，接入 IM 渠道的团队周活跃度平均提升 3 倍。',
    '第二杠杆是精准推荐。利用每日待办与知识日报，把「你可能关心的问题」主动推送给对应角色：新入职销售收到报价 FAQ，客服收到售后政策更新。被动等待提问的系统，使用率永远上不去。',
    '第三杠杆是效果反馈闭环。让每个答案都可点赞/点踩，低认可答案自动进入治理队列并通知 Owner；每月向全员公示「知识库帮你节省了多少时间」，用真实价值驱动持续使用。',
    '衡量标准：关注周活跃提问人数、人均提问次数与答案认可率三个指标，连续 4 周上升即说明使用习惯正在形成。',
  ],
  '飞书集成最佳实践': [
    '第一步完成单点登录（SSO）配置，确保员工用飞书账号一键进入知识库，无需记忆额外密码。建议同时在管理后台开启组织架构同步，让权限随部门与岗位自动继承，避免手工维护成员名单。',
    '第二步配置消息推送：将「知识更新」「待办提醒」「无答案告警」三类通知推送到指定飞书群或机器人会话，注意控制推送频率——每日聚合一次摘要的体验远好于逐条轰炸。',
    '第三步善用知识卡片。在飞书会话中提问时，让回答以卡片形式呈现：结论置顶、引用来源可展开、底部带「有用/无用」反馈按钮。卡片化答案的点击率与反馈率显著高于纯文本。',
    '常见坑：权限同步后务必抽查 3-5 名不同角色的成员，确认其可见知识范围正确；外部群聊中默认关闭问答能力，防止内部知识外泄。',
  ],
  '试用期第 2 周该做什么': [
    '第 1 周你完成了接入、验证与邀请，第 2 周的主题是「打磨质量」。打开使用分析页，按提问量排序找到 Top 20 高频问题，逐一检查答案的认可率——把其中低于 90% 的全部标记出来，这是本周的治理清单。',
    '对低认可答案按三类归因处理：知识缺失（补充资料或指定 Owner 撰写）、知识过期（更新到最新版本并设置有效期）、命中错误（调整空间归属或补充同义词）。每处理完一条，重新提问验证效果。',
    '同步推进使用广度：跟进尚未活跃的被邀请同事，让每位成员至少完成 3 次真实提问；收集他们的「没找到答案」截图，这些是最宝贵的知识缺口信号。',
    '周末复盘时，目标是把高频问题的认可率打磨到 90% 以上、无答案率降到 10% 以下——这也是激活评估中「答案质量」维度的核心口径。',
  ],
  '无答案问题治理指南': [
    '无答案问题不是失败，而是知识库最诚实的「需求清单」。治理的第一步是识别缺口：在反馈与分析页筛出近 7 天所有未命中问题，按提问次数聚类排序，优先处理被反复问到的问题——Top 10 缺口往往贡献了 60% 的挫败体验。',
    '第二步是指定 Owner 闭环。每个缺口指派给最懂该领域的人（而不是知识管理员），写明期望的产出形式：是上传一份文档，还是补充一条结构化问答。治理队列中的每条缺口都应有负责人与截止日期。',
    '第三步是验证与回访。Owner 补充知识后，用原问题重新提问验证能否命中并给出可信答案；同时向提问者推送「你之前问的问题现在有答案了」，把一次挫败转化为一次信任建设。',
    '机制建议：把「无答案率」纳入每周运营例会的固定议题，并开启无答案高频告警（同一问题 24h 内被问 3 次以上自动提醒），让缺口治理从运动式变为常态化。',
  ],
  '如何让答案更可信': [
    '可信答案的基石是引用覆盖率。要求每个答案都附带可点击的引用来源（文档名 + 版本 + 页码），用户一键即可核对原文。经验值：引用覆盖率稳定在 80% 以上时，答案的认可率会出现阶跃式提升。',
    '其次是版本管理。制度、报价、流程类文档必须启用版本控制，知识库始终引用最新生效版本；旧版本保留可追溯但不再参与回答。当检测到两份文档内容冲突时，及时在每日待办中处理版本确认任务。',
    '第三是有效期设置。为时效性内容（促销政策、临时流程、项目纪要）设置有效期与复审负责人，到期自动降权或提醒更新，避免「去年正确的答案今年误导用户」。',
    '最后是可信评分运营：定期抽查信任评分低于 90 分的答案，分析是知识不足还是检索偏差，并针对性补强。可信不是一次性配置，而是持续的运营动作。',
  ],
}
