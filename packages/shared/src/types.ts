/** 全局成员角色口径（CoreRole）：与前端 permissionsData 的分类一致，单一事实源。 */
export const CORE_ROLES = ['管理员', '知识管理员', '空间管理员', '文档审核员', '助手运营员', '普通成员'] as const
export type CoreRole = (typeof CORE_ROLES)[number]

/** 成员状态：活跃 / 待激活（设计 §5 口径；「已邀请」为前端派生展示态，不落库）。 */
export const MEMBER_STATUSES = ['活跃', '待激活'] as const
export type MemberStatus = (typeof MEMBER_STATUSES)[number]

export interface Org { id: string; name: string; industry: string; contact: string; demoData: boolean }
export interface Plan { tier: string; storageUsedGB: number; storageTotalGB: number; seats: number; seatsUsed: number; validUntil: string }
export interface Member { id: string; name: string; email: string; role: CoreRole; dept: string; status: MemberStatus; joinedAt: string }
export interface User { id: string; memberId: string; email: string; role: string }
export interface Journey { activated: boolean; step: number; installedApps: string[]; uninstalledApps: string[]; userInstalledApps: string[]; invitesSent: boolean; configProgress: number }

/** 空间健康态：与前端 kbData.SPACES 的 health 口径一致（健康 / 待复审）。 */
export const SPACE_HEALTHS = ['健康', '待复审'] as const
export type SpaceHealth = (typeof SPACE_HEALTHS)[number]

/** 知识空间：count 为展示计数（默认伞空间 = 全库文档总数，命名空间 = 该空间文档数）。 */
export interface Space { id: string; name: string; count: number; health: SpaceHealth; reviewCycle: number; archived: boolean; createdAt: string }

/** 文档（设计 §5 口径：id/spaceId/title/type/category/status/owner/updatedAt/source）。 */
export interface Doc { id: string; spaceId: string; title: string; type: string; category: string; status: string; owner: string; updatedAt: string; source: string }

/**
 * 连接器 kind 口径（与前端 sourcesData.ts 的 SOURCE_TYPES.kind 同源）：
 * crawl（URL/Sitemap/RSS 抓取）、oauth（OAuth 授权同步）、api（开放 API 接入）。
 */
export const CONNECTOR_KINDS = ['crawl', 'oauth', 'api'] as const
export type ConnectorKind = (typeof CONNECTOR_KINDS)[number]

/**
 * 连接器/数据来源（设计 §5 口径：id/name/kind/connected/disabled/docs/lastSyncAt/config）。
 * connected/disabled 从 SQLite INTEGER 映射为布尔；lastSyncAt 未同步过为 null。
 */
export interface Connector {
  id: string
  name: string
  kind: ConnectorKind
  connected: boolean
  disabled: boolean
  docs: number
  lastSyncAt: string | null
}

/** 同步任务（设计 §5 口径：id/connectorId/status/progress/failedCount/at）。 */
export interface SyncTask {
  id: string
  connectorId: string | null
  status: string
  progress: number
  failedCount: number
  at: string
}

// ---------- 知识地图/网站/问答域 ----------

/** 知识地图节点（设计 §5：id/category/docId/position/relations）。docId 为 null 表示分类节点（◆）。 */
export interface KnowledgeMapNode {
  id: string
  category: string
  docId: string | null
  position: { x: number; y: number }
}

/** 知识地图分类（口径对齐前端 mapData.ts MAP_CATEGORIES：count/questions/health）。 */
export interface KnowledgeMapCategory {
  id: string
  name: string
  count: number
  questions: number
  health: number
}

/** 知识地图关系边（doc→category / question→doc）。 */
export interface KnowledgeMapRelation {
  from: string
  to: string
  type: string
}

/** GET /knowledge-map 响应：categories + nodes + relations。 */
export interface KnowledgeMapData {
  categories: KnowledgeMapCategory[]
  nodes: KnowledgeMapNode[]
  relations: KnowledgeMapRelation[]
}

/** 知识网站文章/栏目（设计 §5：id/title/content/category/updatedAt/status）。 */
export interface KnowledgeSiteArticle {
  id: string
  title: string
  content: string
  category: string
  updatedAt: string
  status: string
}

/** 答案池引用（doc/version/page/role，口径对齐 base.mock ANSWER_POOL citations）。 */
export interface QaCitation {
  doc: string
  version: string
  page: string
  role: string
}

/** QA 命中：答案 + 引用 + 可信度。 */
export interface QaHit {
  answered: true
  answer: string
  citations: QaCitation[]
  confidence: number
}

/**
 * QA 未命中：诚实拒答（镜像前端 NoAnswerCard/REFUSAL_GENERIC 语义）——
 * 原因/已检索范围（searchedCount）/缺失知识类型/最接近主题建议（不伪装成答案）。
 */
export interface QaRefusal {
  answered: false
  reason: string
  searchedCount: number
  missingType: string
  suggestions: string[]
}

export type QaResult = QaHit | QaRefusal

// ---------- 助手域 ----------

/**
 * AI 助手（设计 §6 口径：id/name/icon/desc/scope/enabled/draft/version）。
 * - enabled 从 SQLite INTEGER 映射为布尔（是否启用）。
 * - draft 为未发布草稿的 JSON 配置文本（'' 表示无草稿）；发布时应用到 live 字段并生成版本。
 * - version 为已发布版本号（数字，seed 从 1 起；发布成功 version+1）。
 */
export interface Assistant {
  id: string
  name: string
  icon: string
  desc: string
  scope: string
  enabled: boolean
  draft: string
  version: number
}

// ---------- 对话/历史域 ----------

/**
 * 聊天会话（设计 §6 口径：id/title/source/createdAt/userId）。
 * - source 为来源渠道（seed 4 渠道：工作台/飞书/企业微信/Web 门户，对齐 chat-history 页）。
 * - messageCount 由 chat_messages 聚合（含 user + assistant 全部消息）。
 */
export interface ChatSession {
  id: string
  title: string
  source: string
  createdAt: string
  userId: string
  messageCount: number
}

/** 聊天消息（id/sessionId/role/content/answerId/createdAt；answerId 命中答案池时非空）。 */
export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  answerId: string | null
  createdAt: string
}

// ---------- 指令域 ----------

/**
 * 指令状态（设计 §6 口径）：草稿 / 已发布。
 * 语义对齐前端 Instructions「草稿→发布→版本 diff→回滚走草稿」：发布使草稿转已发布并写版本行，
 * 回滚从历史版本生成新草稿（version 不变，下次发布才递增）。
 */
export const INSTRUCTION_STATUSES = ['草稿', '已发布'] as const
export type InstructionStatus = (typeof INSTRUCTION_STATUSES)[number]

/**
 * 指令（设计 §6 口径：id/name/text/scope/status/version/readonly/createdAt）。
 * - scope 为生效范围字符串数组（DB 存 JSON 文本，API 解析为数组）。
 * - readonly 从 SQLite INTEGER 映射为布尔（系统预置指令只读：PATCH/DELETE/发布/回滚 → 400）。
 * - version 为当前版本号（新建草稿=1，发布时 +1；回滚不改变）。
 */
export interface Instruction {
  id: string
  name: string
  text: string
  scope: string[]
  status: InstructionStatus
  version: number
  readonly: boolean
  createdAt: string
}

/**
 * 版本差异摘要（instruction_versions.diff 的 JSON 形态，发布时与上一已发布文本做行级 diff）：
 * changed 是否有变化、added 新增行数、removed 删除行数（前端「版本 diff 高亮」口径）。
 */
export interface InstructionVersionDiff {
  changed: boolean
  added: number
  removed: number
}

/** 指令版本行（id/instructionId/version/text/diff/publishedAt，在用版本冻结可追溯）。 */
export interface InstructionVersion {
  id: string
  instructionId: string
  version: number
  text: string
  diff: InstructionVersionDiff
  publishedAt: string
}

// ---------- 搜索域 ----------

/** 搜索命中条目：id/name/meta/path（path 为前端路由提示，用于跳转）。 */
export interface SearchItem {
  id: string
  name: string
  meta: string
  path: string
}

/**
 * 搜索分组：key（docs/questions/articles/spaces）+ label（中文标题）+ items。
 * 分组语义镜像前端 HeaderSearch（文档/问题…分组展示），items 已按每组分页上限截断。
 */
export interface SearchGroup {
  key: string
  label: string
  items: SearchItem[]
}
