/**
 * 知识地图页面模拟数据（knowledge-map.md §5）
 * 分类计数复用 base.mock site.categories 口径（32/48/67/25/28）。
 */

export type MapCategory = '产品介绍' | '使用指南' | '常见问题' | 'API文档' | '售后服务'
export type DocValidity = '正常' | '复审将到期' | '可能过期' | '存在冲突'

export interface CategoryNode {
  id: string
  name: MapCategory
  count: number
  questions: number
  health: number
}

/** 5 个分类节点（◆） */
export const MAP_CATEGORIES: CategoryNode[] = [
  { id: 'cat-product', name: '产品介绍', count: 32, questions: 41, health: 88 },
  { id: 'cat-guide', name: '使用指南', count: 48, questions: 52, health: 82 },
  { id: 'cat-faq', name: '常见问题', count: 67, questions: 38, health: 91 },
  { id: 'cat-api', name: 'API文档', count: 25, questions: 17, health: 76 },
  { id: 'cat-after', name: '售后服务', count: 28, questions: 8, health: 64 },
]

export interface DocNode {
  id: string
  name: string
  category: MapCategory
  /** 被问次数（决定节点大小 20–64px） */
  asked: number
  cited: number
  owner: string
  version: string
  validity: DocValidity
  validityNote: string
  hot?: boolean
  topQuestions: string[]
}

/** 12 个图谱内文档节点（●，热点 3 个，异常红边 2 个） */
export const MAP_DOCS: DocNode[] = [
  {
    id: 'd1', name: '产品 X 核心优势白皮书', category: '产品介绍', asked: 46, cited: 18,
    owner: '王强', version: 'v3.2', validity: '正常', validityNote: '复审到期 2024-07-15 · 状态 正常',
    hot: true,
    topQuestions: ['产品 X 核心优势有哪些？', '与竞品相比差异是什么？', '是否支持私有化部署？'],
  },
  {
    id: 'd2', name: '产品功能清单 2024', category: '产品介绍', asked: 18, cited: 6,
    owner: '王强', version: 'v2024.05', validity: '正常', validityNote: '复审到期 2024-08-20 · 状态 正常',
    topQuestions: ['产品支持哪些功能模块？'],
  },
  {
    id: 'd3', name: '客户成功案例集', category: '产品介绍', asked: 14, cited: 5,
    owner: '赵敏', version: 'v1.8', validity: '复审将到期', validityNote: '复审到期 2024-06-10 · 状态 复审将到期',
    topQuestions: ['有没有同行业客户案例？'],
  },
  {
    id: 'd4', name: '差旅报销标准 v3.2', category: '使用指南', asked: 38, cited: 15,
    owner: '李娜', version: 'v3.2', validity: '正常', validityNote: '复审到期 2024-11-30 · 状态 正常',
    hot: true,
    topQuestions: ['差旅报销标准是什么？', '高铁票报销上限是多少？', '住宿标准按城市怎么分？'],
  },
  {
    id: 'd5', name: '请假与考勤制度', category: '使用指南', asked: 22, cited: 9,
    owner: '李娜', version: 'v2.0', validity: '正常', validityNote: '复审到期 2024-12-31 · 状态 正常',
    topQuestions: ['请假审批需要几天？'],
  },
  {
    id: 'd6', name: '销售报价政策 v2024', category: '使用指南', asked: 27, cited: 12,
    owner: '赵敏', version: 'v2024', validity: '存在冲突', validityNote: '与「销售弹药库」v2026 版本冲突 · 近 30 天被引用 12 次',
    topQuestions: ['报价折扣底线是多少？'],
  },
  {
    id: 'd7', name: '报价折扣审批流程', category: '常见问题', asked: 35, cited: 14,
    owner: '张伟', version: 'v2.1', validity: '正常', validityNote: '复审到期 2024-09-30 · 状态 正常',
    hot: true,
    topQuestions: ['报价折扣超过 10% 需要谁审批？', '审批一般要多久？'],
  },
  {
    id: 'd8', name: '入职办理指引', category: '常见问题', asked: 12, cited: 4,
    owner: '李娜', version: 'v1.2', validity: '正常', validityNote: '复审到期 2025-01-15 · 状态 正常',
    topQuestions: ['入职需要准备哪些材料？'],
  },
  {
    id: 'd9', name: 'API 集成指南', category: 'API文档', asked: 29, cited: 11,
    owner: '陈晨', version: 'v1.5', validity: '正常', validityNote: '复审到期 2024-10-01 · 状态 正常',
    topQuestions: ['API 集成需要哪些权限？'],
  },
  {
    id: 'd10', name: 'Webhook 配置手册', category: 'API文档', asked: 15, cited: 5,
    owner: '陈晨', version: 'v1.1', validity: '复审将到期', validityNote: '复审到期 2024-06-08 · 状态 复审将到期',
    topQuestions: ['Webhook 支持哪些事件？'],
  },
  {
    id: 'd11', name: '售后服务承诺 2023 版', category: '售后服务', asked: 16, cited: 7,
    owner: '赵敏', version: 'v2023', validity: '可能过期', validityNote: '2024 版未归档，本版可能过期 · 高风险问题将拒答',
    topQuestions: ['售后服务承诺包含哪些内容？'],
  },
  {
    id: 'd12', name: '退换货处理流程', category: '售后服务', asked: 9, cited: 3,
    owner: '赵敏', version: 'v1.0', validity: '正常', validityNote: '复审到期 2024-12-01 · 状态 正常',
    topQuestions: ['退换货流程要几天？'],
  },
]

export interface QuestionNode {
  id: string
  text: string
  asked: number
  successRate: number
  /** 关联文档 id */
  docId: string
}

/** 6 个问题节点（■，16–28px） */
export const MAP_QUESTIONS: QuestionNode[] = [
  { id: 'q1', text: '报价折扣超过 10% 需要谁审批？', asked: 31, successRate: 95, docId: 'd7' },
  { id: 'q2', text: '差旅报销标准是什么？', asked: 28, successRate: 97, docId: 'd4' },
  { id: 'q3', text: '产品 X 核心优势有哪些？', asked: 24, successRate: 96, docId: 'd1' },
  { id: 'q4', text: 'API 集成需要哪些权限？', asked: 19, successRate: 88, docId: 'd9' },
  { id: 'q5', text: '请假审批需要几天？', asked: 16, successRate: 98, docId: 'd5' },
  { id: 'q6', text: '售后服务承诺包含哪些内容？', asked: 11, successRate: 72, docId: 'd11' },
]

export interface OrphanDoc {
  id: string
  name: string
  category: MapCategory
  uploadedAt: string
  owner: string
  reason: string
}

/** 8 个孤立文档（无引用、无问答，集中于「售后服务」分类外缘） */
export const ORPHAN_DOCS: OrphanDoc[] = [
  { id: 'o1', name: '固定资产采购流程 2022', category: '售后服务', uploadedAt: '2022-11-08', owner: '李娜', reason: '近 90 天无检索命中' },
  { id: 'o2', name: '旧版渠道政策', category: '售后服务', uploadedAt: '2023-02-14', owner: '赵敏', reason: '近 90 天无检索命中' },
  { id: 'o3', name: '内部培训录音整理 2022', category: '使用指南', uploadedAt: '2022-09-21', owner: '王强', reason: '近 90 天无检索命中' },
  { id: 'o4', name: '会议室使用规范 v1', category: '常见问题', uploadedAt: '2023-05-30', owner: '李娜', reason: '近 90 天无检索命中' },
  { id: 'o5', name: '旧版产品报价单 2023', category: '产品介绍', uploadedAt: '2023-01-12', owner: '赵敏', reason: '近 90 天无检索命中' },
  { id: 'o6', name: '行政采购指引 2021', category: '使用指南', uploadedAt: '2021-12-03', owner: '李娜', reason: '近 90 天无检索命中' },
  { id: 'o7', name: '团建活动方案 2023', category: '常见问题', uploadedAt: '2023-06-18', owner: '陈晨', reason: '近 90 天无检索命中' },
  { id: 'o8', name: '旧版考勤制度 v1', category: '使用指南', uploadedAt: '2022-04-25', owner: '李娜', reason: '近 90 天无检索命中' },
]

export interface CitationRecord {
  id: string
  /** 引用场景 */
  scene: string
  /** 命中该文档的问题 */
  question: string
  channel: string
  time: string
}

/** 文档被引用记录（SideDrawer mock，确定性生成） */
export function citationRecordsFor(doc: DocNode): CitationRecord[] {
  const scenes = ['Hero 问答', '在线提问', 'AI 助手']
  const channels = ['知识网站', '知识网站', '工作台']
  const times = ['今天 10:12', '昨天 16:40', '06-01 09:18']
  return doc.topQuestions.map((q, i) => ({
    id: `${doc.id}-c${i}`,
    scene: scenes[i % scenes.length],
    question: q,
    channel: channels[i % channels.length],
    time: times[i % times.length],
  }))
}

export interface QuestionRecord {
  id: string
  asker: string
  time: string
  result: string
}

/** 关联问题的问答记录（SideDrawer mock，确定性生成） */
export function questionRecordsFor(doc: DocNode, question: string): QuestionRecord[] {
  const askers = ['张伟', '李娜', '陈晨']
  const times = ['今天 09:52', '昨天 15:26', '06-01 11:08']
  const results = ['已回答 · 引用本文档', '已回答 · 反馈答案正确', '已回答 · 引用本文档']
  return askers.map((asker, i) => ({
    id: `${doc.id}-qr${i}-${question.length}`,
    asker,
    time: times[i],
    result: results[i],
  }))
}

export const MAP_TYPE_FILTERS = ['全部', '产品介绍', '使用指南', '常见问题', 'API文档', '售后服务'] as const
export const MAP_VALIDITY_FILTERS = ['全部', '正常', '复审将到期', '可能过期', '存在冲突'] as const
export const MAP_SPACE_OPTIONS = ['全部知识（默认）', '制度与流程', '产品资料', '销售弹药库', 'IT·SOP']

/** 被问次数 → 节点直径（20–64px） */
export function docNodeSize(asked: number): number {
  const max = 46
  return Math.round(20 + (Math.min(asked, max) / max) * 44)
}

export function questionNodeSize(asked: number): number {
  const max = 31
  return Math.round(16 + (Math.min(asked, max) / max) * 12)
}
