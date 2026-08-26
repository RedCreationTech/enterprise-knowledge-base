import { db } from './client.js'

/**
 * 成员口径对齐前端 permissionsData.ts 的 CoreRole 分类与部门：
 * 管理员/知识管理员/空间管理员/文档审核员/助手运营员/普通成员。
 * email/status/joinedAt 保留 Phase A 口径（陈可/刘洋 待激活）。
 */
const members = [
  ['m-zw', '张伟', 'zhangwei@example.com', '管理员', '总经办', '活跃', '2024-04-02'],
  ['m-ln', '李娜', 'lina@example.com', '知识管理员', '知识运营', '活跃', '2024-04-02'],
  ['m-wq', '王强', 'wangqiang@example.com', '空间管理员', '产品部', '活跃', '2024-04-05'],
  ['m-zm', '赵敏', 'zhaomin@example.com', '文档审核员', '销售部', '活跃', '2024-04-08'],
  ['m-cc', '陈可', 'chenke@example.com', '助手运营员', 'IT 部', '待激活', '2024-04-10'],
  ['m-ly', '刘洋', 'liuyang@example.com', '普通成员', '售前团队', '待激活', '2024-04-12'],
] as const

/**
 * 知识空间 seed（口径对齐前端 kbData.SPACES：默认空间为伞空间 count=全库 128，
 * 命名空间 34+32+28+12=106，其余 22 份仅属默认空间。health/reviewCycle/archived 同源）。
 * createdAt 沿用 spacesData 页面元数据。
 */
const spaces = [
  { id: 's-all', name: '默认空间（全部知识）', count: 128, health: '健康', reviewCycle: 180, archived: 0, createdAt: '2024-04-02', titlePrefix: '知识文档' },
  { id: 's-policy', name: '制度与流程', count: 34, health: '待复审', reviewCycle: 180, archived: 0, createdAt: '2024-04-05', titlePrefix: '制度文件' },
  { id: 's-product', name: '产品资料', count: 32, health: '健康', reviewCycle: 60, archived: 0, createdAt: '2024-04-08', titlePrefix: '产品手册' },
  { id: 's-sales', name: '销售弹药库', count: 28, health: '健康', reviewCycle: 60, archived: 0, createdAt: '2024-04-10', titlePrefix: '销售资料' },
  { id: 's-it', name: 'IT·SOP', count: 12, health: '健康', reviewCycle: 90, archived: 0, createdAt: '2024-05-20', titlePrefix: 'IT-SOP' },
] as const

/** 文档字段取值池（任务口径）：owner/type/category/status/source 按序号取模，确定性生成。 */
const OWNERS = ['张伟', '王强', '赵敏', '陈可', '刘洋', '李娜'] as const
const TYPES = ['PDF', 'Word', 'PPT', 'Markdown'] as const
const CATEGORIES = ['产品介绍', '使用指南', '常见问题', 'API文档', '售后服务'] as const
const STATUSES = ['已就绪', '待复审', '待确认'] as const
const SOURCES = ['本地上传', '网盘', '飞书'] as const

/** 确定性生成 128 行 docs：命名空间按自身 count 生成（34+32+28+12=106）；
 * 默认伞空间的 count 列 = 全库总数 128（伞口径），但其直属文档仅 128-106=22 份。 */
function seedSpacesAndDocs() {
  const insSpace = db.prepare(`INSERT INTO spaces (id, name, count, health, reviewCycle, archived, createdAt) VALUES (?,?,?,?,?,?,?)`)
  for (const s of spaces) insSpace.run(s.id, s.name, s.count, s.health, s.reviewCycle, s.archived, s.createdAt)

  const namedTotal = spaces.slice(1).reduce((sum, s) => sum + s.count, 0)

  const insDoc = db.prepare(
    `INSERT INTO docs (id, spaceId, title, type, category, status, owner, updatedAt, source) VALUES (?,?,?,?,?,?,?,?,?)`,
  )
  let n = 0
  for (const s of spaces) {
    const docCount = s.id === spaces[0].id ? s.count - namedTotal : s.count
    for (let i = 1; i <= docCount; i += 1) {
      n += 1
      insDoc.run(
        `d-${n}`,
        s.id,
        `《${s.titlePrefix} ${i}》`,
        TYPES[(n * 3) % TYPES.length],
        CATEGORIES[(n * 5) % CATEGORIES.length],
        STATUSES[(n * 7) % STATUSES.length],
        OWNERS[(n * 11) % OWNERS.length],
        `2024-${String(4 + (n % 5)).padStart(2, '0')}-${String((n % 28) + 1).padStart(2, '0')}`,
        SOURCES[(n * 13) % SOURCES.length],
      )
    }
  }
}

/**
 * 连接器 seed（口径对齐前端 sourcesData.ts CONNECTORS + METRICS.connectedDocs）：
 * 4 张内置卡（企业网盘/飞书文档/钉钉文档/企业微信）；connected 依 sourcesData：
 * 网盘、飞书已连接，钉钉、企微未连接（副标题「已连接来源 X/4」→ 2/4）。
 * docs：网盘 862、飞书 318（METRICS 口径，合计 1,180，加本地上传 106 = 1,286）。
 * kind：网盘 api、其余 oauth（OAuth 型内置连接器，connect 端点适用）。
 * lastSyncAt 用演示基准日（TODAY=2026-05-29）派生，未连接连接器为 NULL。
 */
const connectors = [
  { id: 'netdisk', name: '企业网盘', kind: 'api', connected: 1, disabled: 0, docs: 862, lastSyncAt: '2026-05-29T10:20:00', config: '{}' },
  { id: 'feishu', name: '飞书文档', kind: 'oauth', connected: 1, disabled: 0, docs: 318, lastSyncAt: '2026-05-29T09:45:00', config: '{}' },
  { id: 'dingtalk', name: '钉钉文档', kind: 'oauth', connected: 0, disabled: 0, docs: 0, lastSyncAt: null, config: '{}' },
  { id: 'wecom', name: '企业微信', kind: 'oauth', connected: 0, disabled: 0, docs: 0, lastSyncAt: null, config: '{}' },
] as const

/**
 * 同步任务 seed（口径对齐前端 sourcesData.ts SYNC_TASKS 5 条，at 用演示基准日派生）：
 * t1 网盘增量/今天10:20、t2 飞书增量/今天09:45、t3 网盘ACL/昨天18:20、
 * t4 飞书全量校验失败/昨天16:30（3 份未能处理 → failedCount 3）、t5 本地上传批次/05-15。
 * connectorId：t5 本地上传非连接器卡 → NULL；status/progress/failedCount 走任务口径。
 */
const syncTasks = [
  { id: 't1', connectorId: 'netdisk', status: '已完成', progress: 100, failedCount: 0, at: '2026-05-29T10:20:00' },
  { id: 't2', connectorId: 'feishu', status: '已完成', progress: 100, failedCount: 0, at: '2026-05-29T09:45:00' },
  { id: 't3', connectorId: 'netdisk', status: '已完成', progress: 100, failedCount: 0, at: '2026-05-28T18:20:00' },
  { id: 't4', connectorId: 'feishu', status: '失败', progress: 0, failedCount: 3, at: '2026-05-28T16:30:00' },
  { id: 't5', connectorId: null, status: '已完成', progress: 100, failedCount: 0, at: '2026-05-15T18:32:00' },
] as const

function seedConnectorsAndTasks() {
  const insConn = db.prepare(
    'INSERT INTO connectors (id, name, kind, connected, disabled, docs, lastSyncAt, config) VALUES (?,?,?,?,?,?,?,?)',
  )
  for (const c of connectors) {
    insConn.run(c.id, c.name, c.kind, c.connected, c.disabled, c.docs, c.lastSyncAt, c.config)
  }

  const insTask = db.prepare(
    'INSERT INTO sync_tasks (id, connectorId, status, progress, failedCount, at) VALUES (?,?,?,?,?,?)',
  )
  for (const t of syncTasks) {
    insTask.run(t.id, t.connectorId, t.status, t.progress, t.failedCount, t.at)
  }
}

// ---------- 知识地图/网站/问答域 seed（口径对齐前端 mapData.ts / KnowledgeSite.tsx / base.mock ANSWER_POOL） ----------

/** 极坐标 → 直角坐标（与 KnowledgeMap.tsx computeLayout 同算法，坐标取整）。 */
function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180
  return { x: Math.round(cx + r * Math.cos(rad)), y: Math.round(cy + r * Math.sin(rad)) }
}

const HUB = { x: 500, y: 320 }
const CAT_RADIUS = 190

/**
 * 知识地图分类（口径对齐前端 mapData.ts MAP_CATEGORIES：id/name/count/questions/health）。
 * 存为 knowledge_map 行：docId=NULL 表示分类节点（◆），relations 列承载分类汇总
 * {count, questions, health}（分类元数据无独立列，按此约定存取，service 解析后返回）。
 */
const mapCategories = [
  { id: 'cat-product', name: '产品介绍', count: 32, questions: 41, health: 88 },
  { id: 'cat-guide', name: '使用指南', count: 48, questions: 52, health: 82 },
  { id: 'cat-faq', name: '常见问题', count: 67, questions: 38, health: 91 },
  { id: 'cat-api', name: 'API文档', count: 25, questions: 17, health: 76 },
  { id: 'cat-after', name: '售后服务', count: 28, questions: 8, health: 64 },
] as const

/** 12 个图谱文档节点（●，口径对齐 mapData.ts MAP_DOCS：id/名称/分类/hot/被问次数）。 */
const mapDocs = [
  { id: 'd1', name: '产品 X 核心优势白皮书', category: '产品介绍' },
  { id: 'd2', name: '产品功能清单 2024', category: '产品介绍' },
  { id: 'd3', name: '客户成功案例集', category: '产品介绍' },
  { id: 'd4', name: '差旅报销标准 v3.2', category: '使用指南' },
  { id: 'd5', name: '请假与考勤制度', category: '使用指南' },
  { id: 'd6', name: '销售报价政策 v2024', category: '使用指南' },
  { id: 'd7', name: '报价折扣审批流程', category: '常见问题' },
  { id: 'd8', name: '入职办理指引', category: '常见问题' },
  { id: 'd9', name: 'API 集成指南', category: 'API文档' },
  { id: 'd10', name: 'Webhook 配置手册', category: 'API文档' },
  { id: 'd11', name: '售后服务承诺 2023 版', category: '售后服务' },
  { id: 'd12', name: '退换货处理流程', category: '售后服务' },
] as const

/** 6 个问题节点（■，口径对齐 mapData.ts MAP_QUESTIONS：text/docId）。 */
const mapQuestions = [
  { id: 'q1', text: '报价折扣超过 10% 需要谁审批？', docId: 'd7' },
  { id: 'q2', text: '差旅报销标准是什么？', docId: 'd4' },
  { id: 'q3', text: '产品 X 核心优势有哪些？', docId: 'd1' },
  { id: 'q4', text: 'API 集成需要哪些权限？', docId: 'd9' },
  { id: 'q5', text: '请假审批需要几天？', docId: 'd5' },
  { id: 'q6', text: '售后服务承诺包含哪些内容？', docId: 'd11' },
] as const

/** 布局：与 KnowledgeMap.tsx computeLayout 一致（分类放射 + 文档环绕 + 问题外圈）。 */
function seedKnowledgeMap() {
  const catAngle = new Map<string, number>()
  mapCategories.forEach((c, i) => {
    catAngle.set(c.name, -90 + i * 72)
  })
  const docAngle = new Map<string, number>()
  const docPos = new Map<string, { x: number; y: number }>()
  for (const c of mapCategories) {
    const docs = mapDocs.filter((d) => d.category === c.name)
    const angle = catAngle.get(c.name)!
    docs.forEach((d, k) => {
      const spread = (k - (docs.length - 1) / 2) * 16
      const r = 300 + (k % 2) * 44
      const pos = polar(HUB.x, HUB.y, r, angle + spread)
      docAngle.set(d.id, angle + spread)
      docPos.set(d.id, pos)
    })
  }

  const ins = db.prepare('INSERT INTO knowledge_map (id, category, docId, position, relations) VALUES (?,?,?,?,?)')

  // 分类节点：docId NULL，relations 存分类汇总元数据
  for (const c of mapCategories) {
    const pos = polar(HUB.x, HUB.y, CAT_RADIUS, catAngle.get(c.name)!)
    ins.run(c.id, c.name, null, JSON.stringify(pos), JSON.stringify({ count: c.count, questions: c.questions, health: c.health }))
  }
  // 文档节点：docId 自引用，relations 存 doc→category 关系
  for (const d of mapDocs) {
    const cat = mapCategories.find((c) => c.name === d.category)!
    ins.run(d.id, d.category, d.id, JSON.stringify(docPos.get(d.id)!), JSON.stringify([{ to: cat.id, type: 'category' }]))
  }
  // 问题节点：docId 指向关联文档，relations 存 question→doc 关系
  for (const q of mapQuestions) {
    const doc = mapDocs.find((d) => d.id === q.docId)!
    const base = docPos.get(q.docId)!
    const r = Math.hypot(base.x - HUB.x, base.y - HUB.y) + 46
    const pos = polar(HUB.x, HUB.y, r, docAngle.get(q.docId)! + 9)
    ins.run(q.id, doc.category, q.docId, JSON.stringify(pos), JSON.stringify([{ to: q.docId, type: 'qa' }]))
  }
}

/**
 * 知识网站文章 seed（口径对齐前端 KnowledgeSite.tsx CATEGORY_DOCS：5 分类 × 5 篇 = 25 篇，
 * 含首页「最近更新」5 条；updatedAt 由 mock 相对时间（今天/昨天/MM-DD）转为绝对时间，
 * 演示基准日 TODAY=2026-05-29）。
 */
const siteArticles = [
  { id: 'art-1', title: '产品定价与版本说明', category: '产品介绍', updatedAt: '2026-05-29T10:23:00' },
  { id: 'art-2', title: '产品 X 白皮书（v1.5）', category: '产品介绍', updatedAt: '2026-05-30T14:12:00' },
  { id: 'art-3', title: '核心功能全景介绍', category: '产品介绍', updatedAt: '2026-05-28T09:40:00' },
  { id: 'art-4', title: '产品与竞品对比手册', category: '产品介绍', updatedAt: '2026-05-26T17:05:00' },
  { id: 'art-5', title: '版本更新日志（5 月）', category: '产品介绍', updatedAt: '2026-05-25T11:32:00' },
  { id: 'art-6', title: '如何创建项目与团队', category: '使用指南', updatedAt: '2026-05-28T16:45:00' },
  { id: 'art-7', title: '快速上手：10 分钟完成配置', category: '使用指南', updatedAt: '2026-05-29T15:20:00' },
  { id: 'art-8', title: '权限与角色配置指南', category: '使用指南', updatedAt: '2026-05-27T10:08:00' },
  { id: 'art-9', title: '知识空间管理最佳实践', category: '使用指南', updatedAt: '2026-05-24T14:52:00' },
  { id: 'art-10', title: '数据导入与同步操作手册', category: '使用指南', updatedAt: '2026-05-22T09:15:00' },
  { id: 'art-11', title: '常见故障排查与解决方案', category: '常见问题', updatedAt: '2026-06-01T09:30:00' },
  { id: 'art-12', title: '账号与登录常见问题', category: '常见问题', updatedAt: '2026-05-30T18:44:00' },
  { id: 'art-13', title: '搜索无结果排查指引', category: '常见问题', updatedAt: '2026-05-28T13:26:00' },
  { id: 'art-14', title: '同步失败常见原因', category: '常见问题', updatedAt: '2026-05-26T08:57:00' },
  { id: 'art-15', title: '用量与计费常见问题', category: '常见问题', updatedAt: '2026-05-23T16:39:00' },
  { id: 'art-16', title: 'API 鉴权与签名机制（v2.0）', category: 'API文档', updatedAt: '2026-05-28T11:08:00' },
  { id: 'art-17', title: 'API 接入指南（v2.0）', category: 'API文档', updatedAt: '2026-05-29T10:31:00' },
  { id: 'art-18', title: 'API 调用频率限制说明', category: 'API文档', updatedAt: '2026-05-27T15:48:00' },
  { id: 'art-19', title: 'Webhook 事件订阅', category: 'API文档', updatedAt: '2026-05-25T09:22:00' },
  { id: 'art-20', title: '错误码对照表', category: 'API文档', updatedAt: '2026-05-21T14:06:00' },
  { id: 'art-21', title: '服务支持流程与 SLA 说明', category: '售后服务', updatedAt: '2026-05-31T18:22:00' },
  { id: 'art-22', title: '工单提交与处理时效', category: '售后服务', updatedAt: '2026-05-28T11:14:00' },
  { id: 'art-23', title: '客户成功服务计划', category: '售后服务', updatedAt: '2026-05-26T16:50:00' },
  { id: 'art-24', title: '培训与认证服务介绍', category: '售后服务', updatedAt: '2026-05-24T10:27:00' },
  { id: 'art-25', title: '服务变更通知渠道', category: '售后服务', updatedAt: '2026-05-22T15:33:00' },
] as const

function articleContent(title: string, category: string): string {
  return `《${title}》是「${category}」分类下的知识网站栏目，由知识库自动整理发布。本文档面向内部成员提供该主题的最新说明、操作步骤与注意事项，所有对外口径以本文档最新版本为准，引用前请先确认版本有效性。`
}

function seedKnowledgeSite() {
  const ins = db.prepare('INSERT INTO knowledge_site (id, title, content, category, updatedAt, status) VALUES (?,?,?,?,?,?)')
  for (const a of siteArticles) {
    ins.run(a.id, a.title, articleContent(a.title, a.category), a.category, a.updatedAt, '已发布')
  }
}

/**
 * 答案池 seed（口径对齐前端 base.mock.ts ANSWER_POOL：9 个主问题 + 11 个追问 = 20 条，
 * 含引用 doc/version/page/role 与可信度 trustScore；answer = conclusion + explanation 合并）。
 */
const answerPool = [
  {
    id: 'ap-1',
    question: '客户报价折扣超过 10% 需要谁审批？',
    answer: '需要销售总监审批。根据公司制度要求，当客户报价折扣超过 10% 时，需由销售总监审批。',
    confidence: 92,
    citations: [
      { doc: '《销售管理制度》', version: 'v2.1', page: '第 8 页', role: '主要依据' },
      { doc: '《价格管理办法》', version: 'v1.3', page: '第 5 页', role: '参考依据' },
      { doc: '《审批权限矩阵表》', version: 'v3.0', page: '第 2 页', role: '参考依据' },
    ],
  },
  {
    id: 'ap-2',
    question: '折扣超过 20% 需要谁审批？',
    answer: '需升级至总经理审批。制度规定折扣超过 20% 的报价须报总经理审批，并抄送财务备案后方可对外承诺。',
    confidence: 91,
    citations: [
      { doc: '《销售管理制度》', version: 'v2.1', page: '第 8 页', role: '主要依据' },
      { doc: '《审批权限矩阵表》', version: 'v3.0', page: '第 2 页', role: '参考依据' },
    ],
  },
  {
    id: 'ap-3',
    question: '审批一般需要多长时间？',
    answer: '超额折扣审批应在 2 个工作日内完成。《价格管理办法》要求超额折扣的审批在 2 个工作日内完成，并同步至报价系统后价格方可生效。',
    confidence: 90,
    citations: [{ doc: '《价格管理办法》', version: 'v1.3', page: '第 5 页', role: '主要依据' }],
  },
  {
    id: 'ap-4',
    question: '产品 X 的核心优势是什么？',
    answer: '核心优势是可信回答、权限继承与多平台集成。产品 X 以可信检索增强为核心，每个答案均附引用来源；完整继承企业权限体系，并支持与主流办公平台无缝集成。',
    confidence: 91,
    citations: [
      { doc: '《产品 X 白皮书》', version: 'v1.5', page: '第 3 页', role: '主要依据' },
      { doc: '《客户案例集》', version: 'v2.0', page: '第 6 页', role: '参考依据' },
    ],
  },
  {
    id: 'ap-5',
    question: '产品 X 支持哪些部署方式？',
    answer: '支持 SaaS 云、专属实例与全本地化三种部署方式。SaaS 云开箱即用；专属实例提供独立资源隔离；全本地化部署在客户机房，需 Enterprise 套餐。',
    confidence: 91,
    citations: [{ doc: '《产品 X 白皮书》', version: 'v1.5', page: '第 12 页', role: '主要依据' }],
  },
  {
    id: 'ap-6',
    question: '标准交付周期是多久？',
    answer: '标准交付周期为 4–6 周。依据《交付服务协议》，标准部署项目自合同生效起 4–6 周完成交付；定制化需求需另行评估并排期确认。',
    confidence: 90,
    citations: [
      { doc: '《交付服务协议》', version: 'v2.3', page: '第 4 页', role: '主要依据' },
      { doc: '《产品 X 白皮书》', version: 'v1.5', page: '第 15 页', role: '参考依据' },
    ],
  },
  {
    id: 'ap-7',
    question: '交付包含哪些服务内容？',
    answer: '包含部署实施、管理员培训与上线护航三部分。标准交付含环境部署与初始化配置、1 场管理员培训，以及上线后 2 周的护航支持。',
    confidence: 90,
    citations: [{ doc: '《交付服务协议》', version: 'v2.3', page: '第 6 页', role: '主要依据' }],
  },
  {
    id: 'ap-8',
    question: '退货政策是怎样的？',
    answer: '支持 7 天无理由退货。自签收之日起 7 日内可申请无理由退货，定制类产品除外；退货需保持商品、包装与附件完整。',
    confidence: 92,
    citations: [
      { doc: '《退货与售后政策》', version: 'v1.6', page: '第 2 页', role: '主要依据' },
      { doc: '《交付服务协议》', version: 'v2.3', page: '第 9 页', role: '参考依据' },
    ],
  },
  {
    id: 'ap-9',
    question: '退货运费由谁承担？',
    answer: '质量问题由公司承担，无理由退货由客户承担。因产品质量问题产生的退货运费由公司承担；7 天无理由退货的往返运费由客户自行承担。',
    confidence: 90,
    citations: [{ doc: '《退货与售后政策》', version: 'v1.6', page: '第 3 页', role: '主要依据' }],
  },
  {
    id: 'ap-10',
    question: '定制产品可以退货吗？',
    answer: '定制类产品不支持无理由退货。按客户指定规格定制的产品不适用 7 天无理由退货；如存在质量问题，仍可按质保条款退换。',
    confidence: 91,
    citations: [{ doc: '《退货与售后政策》', version: 'v1.6', page: '第 2 页', role: '主要依据' }],
  },
  {
    id: 'ap-11',
    question: '工单响应时限是多久？',
    answer: '标准工单 4 个工作小时内响应。普通工单 4 个工作小时内首次响应，紧急工单 30 分钟内响应；处理进度可在服务门户实时查询。',
    confidence: 91,
    citations: [
      { doc: '《交付服务协议》', version: 'v2.3', page: '第 7 页', role: '主要依据' },
      { doc: '《退货与售后政策》', version: 'v1.6', page: '第 5 页', role: '参考依据' },
    ],
  },
  {
    id: 'ap-12',
    question: '紧急工单如何升级？',
    answer: '紧急工单可直接升级至值班经理处理。标注为紧急的工单自动通知值班经理介入，30 分钟内响应并每 2 小时同步一次处理进展。',
    confidence: 90,
    citations: [{ doc: '《交付服务协议》', version: 'v2.3', page: '第 8 页', role: '主要依据' }],
  },
  {
    id: 'ap-13',
    question: '质保期如何计算？',
    answer: '质保期一般为验收通过后 12 个月。多数产品自验收通过之日起提供 12 个月质保；部分早期合同条款存在差异，建议以具体合同约定为准。',
    confidence: 78,
    citations: [
      { doc: '《退货与售后政策》', version: 'v1.6', page: '第 6 页', role: '主要依据' },
      { doc: '《交付服务协议》', version: 'v2.3', page: '第 10 页', role: '参考依据' },
    ],
  },
  {
    id: 'ap-14',
    question: '质保期内维修收费吗？',
    answer: '非人为损坏的维修免费。质保期内非人为损坏的维修与配件更换免费；人为损坏或超出质保范围的维修按标准工时与配件价收费。',
    confidence: 88,
    citations: [{ doc: '《退货与售后政策》', version: 'v1.6', page: '第 7 页', role: '主要依据' }],
  },
  {
    id: 'ap-15',
    question: '报销流程是怎样的？',
    answer: '报销需在线提交申请并经两级审批。员工在报销系统提交单据与发票，经部门负责人与财务两级审批通过后，3 个工作日内打款至工资卡。',
    confidence: 90,
    citations: [
      { doc: '《财务报销操作指引》', version: 'v1.8', page: '第 2 页', role: '主要依据' },
      { doc: '《差旅费用报销管理办法》', version: 'v3.2', page: '第 4 页', role: '参考依据' },
    ],
  },
  {
    id: 'ap-16',
    question: '差旅住宿标准是多少？',
    answer: '一线城市 500 元/晚，二线城市 400 元/晚，其他城市 320 元/晚。住宿标准按城市等级分档执行，超出标准部分需事前申请特批，否则由个人承担。',
    confidence: 88,
    citations: [{ doc: '《差旅费用报销管理办法》', version: 'v3.2', page: '第 4 页', role: '主要依据' }],
  },
  {
    id: 'ap-17',
    question: '年假如何申请？',
    answer: '年假通过考勤系统在线申请。员工在考勤系统提交年假申请，由直属上级审批；入职满一年可享 5 天带薪年假，此后每满一年增加 1 天，上限 15 天。',
    confidence: 92,
    citations: [{ doc: '《考勤管理制度》', version: 'v2.4', page: '第 6 页', role: '主要依据' }],
  },
  {
    id: 'ap-18',
    question: '年假可以跨年休吗？',
    answer: '未休年假可顺延至次年 3 月底。当年度未休完的年假可顺延至次年 3 月 31 日前休完，逾期自动作废且不予折现。',
    confidence: 90,
    citations: [{ doc: '《考勤管理制度》', version: 'v2.4', page: '第 7 页', role: '主要依据' }],
  },
  {
    id: 'ap-19',
    question: '考勤异常如何处理？',
    answer: '考勤异常需在 3 个工作日内提交补签申请。忘打卡等异常可在考勤系统发起补签，每月补签不超过 3 次，由直属上级审批后生效。',
    confidence: 91,
    citations: [{ doc: '《考勤管理制度》', version: 'v2.4', page: '第 3 页', role: '主要依据' }],
  },
  {
    id: 'ap-20',
    question: '补签超过次数怎么办？',
    answer: '超出次数的异常按事假处理。每月补签超过 3 次后，后续异常按事假处理；确有特殊情况的，可向 HR 提交申诉材料。',
    confidence: 90,
    citations: [{ doc: '《考勤管理制度》', version: 'v2.4', page: '第 4 页', role: '主要依据' }],
  },
] as const

function seedKnowledgeDomain() {
  // 幂等：知识域表已有数据则跳过（设计 §4「存在数据则跳过」；其他域测试 resetSeed
  // 只清自己的表，knowledge_map 可能残留旧 seed 行，若再插会 UNIQUE 冲突）
  const hasMap = (db.prepare('SELECT COUNT(*) c FROM knowledge_map').get() as { c: number }).c
  if (hasMap > 0) return
  seedKnowledgeMap()
  seedKnowledgeSite()

  const ins = db.prepare('INSERT INTO answer_pool (id, question, answer, citations, confidence) VALUES (?,?,?,?,?)')
  for (const a of answerPool) {
    ins.run(a.id, a.question, a.answer, JSON.stringify(a.citations), a.confidence)
  }
}

export function seedIfEmpty() {
  const n = (db.prepare('SELECT COUNT(*) c FROM org').get() as { c: number }).c
  if (n > 0) return
  db.prepare(`INSERT INTO org (id, name, industry, contact, demoData) VALUES ('org-1', '示例科技有限公司', '软件与信息技术服务', 'zhangwei@example.com', 0)`).run()
  db.prepare(`INSERT INTO plan VALUES ('plan-1', '试用版', 0.68, 1, 20, 12, '2025-06-03')`).run()
  const ins = db.prepare(`INSERT INTO members VALUES (?,?,?,?,?,?,?)`)
  for (const m of members) ins.run(...m)
  db.prepare(`INSERT INTO users (id, memberId, email, passwordHash, role) VALUES ('u-1', 'm-zw', 'zhangwei@example.com', NULL, '管理员')`).run()
  db.prepare(`INSERT INTO trial_journey (id,activated,step,installedApps,uninstalledApps,userInstalledApps,invitesSent,configProgress) VALUES (1,0,0,'["wecom-qa","custom-api","sso"]','[]','[]',0,0)`).run()
  seedSpacesAndDocs()
  seedConnectorsAndTasks()
  seedKnowledgeDomain()
}
