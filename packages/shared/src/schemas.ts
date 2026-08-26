import { z } from 'zod'
import { CORE_ROLES, MEMBER_STATUSES, SPACE_HEALTHS, CONNECTOR_KINDS, INSTRUCTION_STATUSES } from './types.js'
export const okSchema = z.object({ status: z.string() })
export const errorSchema = z.object({ code: z.string(), message: z.string() })
export const envelopeSchema = z.union([
  z.object({ ok: z.literal(true), data: z.unknown() }),
  z.object({ ok: z.literal(false), error: errorSchema }),
])
export function parseOk<T>(body: unknown, schema: z.ZodType<T>): T {
  const e = envelopeSchema.parse(body)
  if (!e.ok) throw new Error(`${e.error.code}: ${e.error.message}`)
  return schema.parse(e.data)
}
export function parseErr(body: unknown) { return errorSchema.parse((envelopeSchema.parse(body) as { ok: false; error: unknown }).error) }
export const HealthResponse = okSchema
export const DemoLoginResponse = z.object({ token: z.string(), user: z.object({ id: z.string(), name: z.string(), role: z.string() }) })

// ---------- 认证/旅程域 ----------

/** trial_journey 行（布尔/数组字段已从 SQLite 的 INTEGER/TEXT 解析为 JSON 友好形态） */
export const JourneyResponse = z.object({
  activated: z.boolean(),
  step: z.number(),
  installedApps: z.array(z.string()),
  uninstalledApps: z.array(z.string()),
  userInstalledApps: z.array(z.string()),
  invitesSent: z.boolean(),
  configProgress: z.number(),
})

/** PATCH /auth/journey：任意字段可选，数组为 string[]、布尔为 boolean */
export const JourneyPatch = z.object({
  activated: z.boolean().optional(),
  step: z.number().optional(),
  installedApps: z.array(z.string()).optional(),
  uninstalledApps: z.array(z.string()).optional(),
  userInstalledApps: z.array(z.string()).optional(),
  invitesSent: z.boolean().optional(),
  configProgress: z.number().optional(),
})

/** POST /auth/trial/apply 请求体 */
export const TrialApplyBody = z.object({
  companyName: z.string(),
  contact: z.string(),
  agreeToTerms: z.boolean(),
})

/** POST /auth/otp/send 请求体 */
export const OtpSendBody = z.object({ channel: z.string(), target: z.string() })

/** POST /auth/otp/verify 请求体 */
export const OtpVerifyBody = z.object({ channel: z.string(), target: z.string(), code: z.string() })

// ---------- 认证/旅程域响应 ----------

/** POST /auth/trial/apply 响应 */
export const TrialApplyResponse = z.object({ id: z.number() })
/** POST /auth/otp/send 响应 */
export const OtpSendResponse = z.object({ sent: z.boolean() })
/** POST /auth/otp/verify 响应 */
export const OtpVerifyResponse = z.object({ verified: z.boolean() })
/** POST /demo-data 与 /demo-data/reset 响应 */
export const DemoDataResponse = z.object({ demoData: z.boolean() })

export type JourneyPatchInput = z.infer<typeof JourneyPatch>
export type TrialApplyBodyInput = z.infer<typeof TrialApplyBody>

// ---------- 组织/成员/套餐域 ----------

/** 角色/状态枚举：与 types.ts 的 CoreRole/MemberStatus 同源（zod 枚举 + 字面量联合双保险）。 */
export const CoreRoleSchema = z.enum(CORE_ROLES)
export const MemberStatusSchema = z.enum(MEMBER_STATUSES)

/** GET /org 响应（demoData 已从 SQLite INTEGER 映射为布尔） */
export const OrgResponse = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.string(),
  contact: z.string(),
  demoData: z.boolean(),
})

/** PATCH /org 请求体：name/industry/contact 任意可选，非法类型 400 */
export const OrgPatch = z.object({
  name: z.string().optional(),
  industry: z.string().optional(),
  contact: z.string().optional(),
})

/** GET /org/members 响应元素（role 走 CoreRole 口径、status 含待激活） */
export const MemberResponse = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: CoreRoleSchema,
  dept: z.string(),
  status: MemberStatusSchema,
  joinedAt: z.string(),
})

/** GET /org/members 响应：成员数组（服务端返回裸数组，非 {items} 信封）。 */
export const MemberListResponse = z.array(MemberResponse)

/** POST /org/members 请求体：role/dept 可选（默认 普通成员/''），email 需合法格式 */
export const MemberCreateBody = z.object({
  name: z.string().min(1),
  email: z.email(),
  role: CoreRoleSchema.optional(),
  dept: z.string().optional(),
})

/** PATCH /org/members/:id 请求体：role/status/dept/email 任意可选 */
export const MemberPatch = z.object({
  role: CoreRoleSchema.optional(),
  status: MemberStatusSchema.optional(),
  dept: z.string().optional(),
  email: z.email().optional(),
})

/** GET /plan 响应（口径与前端 mock 一致：试用版 / 0.68/1GB / 20 席 / 2025-06-03） */
export const PlanResponse = z.object({
  tier: z.string(),
  storageUsedGB: z.number(),
  storageTotalGB: z.number(),
  seats: z.number(),
  seatsUsed: z.number(),
  validUntil: z.string(),
})

/** DELETE /org/members/:id 响应 */
export const DeleteResponse = z.object({ deleted: z.boolean() })

export type OrgPatchInput = z.infer<typeof OrgPatch>
export type MemberCreateBodyInput = z.infer<typeof MemberCreateBody>
export type MemberPatchInput = z.infer<typeof MemberPatch>

// ---------- 知识空间域 ----------

/** 空间健康态：与前端 kbData.SPACES 同源（健康 / 待复审）。 */
export const SpaceHealthSchema = z.enum(SPACE_HEALTHS)

/** GET /spaces 响应元素（archived 已从 SQLite INTEGER 映射为布尔） */
export const SpaceResponse = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number(),
  health: SpaceHealthSchema,
  reviewCycle: z.number(),
  archived: z.boolean(),
  createdAt: z.string(),
})

/** GET /spaces 响应：空间数组（服务端返回裸数组，非 {items} 信封）。 */
export const SpaceListResponse = z.array(SpaceResponse)

/** POST /spaces 请求体：name 必填（其余字段走默认：count 0 / 健康 / 180 天 / 未归档） */
export const SpaceCreateBody = z.object({ name: z.string().min(1) })

/** PATCH /spaces/:id 请求体：name/health/reviewCycle/archived 任意可选 */
export const SpacePatch = z.object({
  name: z.string().min(1).optional(),
  health: SpaceHealthSchema.optional(),
  reviewCycle: z.number().optional(),
  archived: z.boolean().optional(),
})

/** 文档响应元素（POST /spaces/:id/upload 与后续 /docs 共用） */
export const DocResponse = z.object({
  id: z.string(),
  spaceId: z.string(),
  title: z.string(),
  type: z.string(),
  category: z.string(),
  status: z.string(),
  owner: z.string(),
  updatedAt: z.string(),
  source: z.string(),
})

/** POST /spaces/:id/upload 请求体：title/type/category 必填，owner/source 可选 */
export const DocUploadBody = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  category: z.string().min(1),
  owner: z.string().optional(),
  source: z.string().optional(),
})

export type SpaceCreateBodyInput = z.infer<typeof SpaceCreateBody>
export type SpacePatchInput = z.infer<typeof SpacePatch>
export type DocUploadBodyInput = z.infer<typeof DocUploadBody>

// ---------- 文档域 ----------

/** GET /docs 查询参数：过滤条件可选；page>=1、size 1..100，默认 1/10（query 字符串经 coerce 转数字） */
export const DocListQuery = z.object({
  space: z.string().optional(),
  search: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(10),
})

/** GET /docs 响应：分页 + 过滤 + 总数 */
export const DocListResponse = z.object({
  items: z.array(DocResponse),
  total: z.number(),
  page: z.number(),
  size: z.number(),
})

/** POST /docs/upload 请求体：spaceId 必填（目标空间），title/type/category 必填，owner/source 可选 */
export const DocsUploadBody = DocUploadBody.extend({ spaceId: z.string().min(1) })

/** PATCH /docs/:id 请求体：title/type/category/status/owner/spaceId 任意可选（显式白名单） */
export const DocPatch = z.object({
  title: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  owner: z.string().optional(),
  spaceId: z.string().min(1).optional(),
})

/** POST /docs/batch-archive 请求体 */
export const BatchArchiveBody = z.object({ ids: z.array(z.string()) })

/** POST /docs/batch-move 请求体 */
export const BatchMoveBody = z.object({ ids: z.array(z.string()), spaceId: z.string().min(1) })

/** 批量操作响应：{ updated } */
export const BatchResponse = z.object({ updated: z.number() })

export type DocListQueryInput = z.infer<typeof DocListQuery>
export type DocsUploadBodyInput = z.infer<typeof DocsUploadBody>
export type DocPatchInput = z.infer<typeof DocPatch>
export type BatchArchiveBodyInput = z.infer<typeof BatchArchiveBody>
export type BatchMoveBodyInput = z.infer<typeof BatchMoveBody>

// ---------- 数据来源/连接器域 ----------

/** kind 枚举：与 types.ts 的 ConnectorKind 同源（crawl/oauth/api）。 */
export const ConnectorKindSchema = z.enum(CONNECTOR_KINDS)

/** 连接器响应元素（GET /connectors 列表项 / connect / sync / patch 返回值）。 */
export const ConnectorResponse = z.object({
  id: z.string(),
  name: z.string(),
  kind: ConnectorKindSchema,
  connected: z.boolean(),
  disabled: z.boolean(),
  docs: z.number().int().min(0),
  lastSyncAt: z.string().nullable(),
})

/** 数据来源页副标题口径摘要（已连接来源 X/4、连接器文档 1,286 份、本地上传 106 份）。 */
export const ConnectorSummary = z.object({
  connectedCount: z.number().int().min(0),
  totalDocs: z.number().int().min(0),
  localUpload: z.number().int().min(0),
})

/** GET /connectors 响应：连接器列表 + 副标题派生摘要（嵌入同一响应，前端一次请求即得）。 */
export const ConnectorListResponse = z.object({
  items: z.array(ConnectorResponse),
  summary: ConnectorSummary,
})

/** PATCH /connectors/:id 请求体：仅 disabled/docs/lastSyncAt 白名单（启停用/文档数/上次同步时间）。 */
export const ConnectorPatch = z.object({
  disabled: z.boolean().optional(),
  docs: z.number().int().min(0).optional(),
  lastSyncAt: z.string().optional(),
})

/** 同步任务响应元素（POST /connectors/:id/sync 返回值 / GET /sync-tasks 列表项）。 */
export const SyncTaskResponse = z.object({
  id: z.string(),
  connectorId: z.string().nullable(),
  status: z.string(),
  progress: z.number().int().min(0).max(100),
  failedCount: z.number().int().min(0),
  at: z.string(),
})

/** GET /sync-tasks 响应：近期同步任务（at 倒序）。 */
export const SyncTasksResponse = z.object({
  items: z.array(SyncTaskResponse),
})

export type ConnectorPatchInput = z.infer<typeof ConnectorPatch>

// ---------- 知识地图/网站/问答域 ----------

/** 知识地图节点（id/category/docId/position；docId 为 null 表示分类节点）。 */
export const KnowledgeMapNodeSchema = z.object({
  id: z.string(),
  category: z.string(),
  docId: z.string().nullable(),
  position: z.object({ x: z.number(), y: z.number() }),
})

/** 知识地图分类（口径对齐前端 mapData.ts MAP_CATEGORIES：count/questions/health）。 */
export const KnowledgeMapCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().int().min(0),
  questions: z.number().int().min(0),
  health: z.number().int().min(0).max(100),
})

/** 知识地图关系边（doc→category / question→doc）。 */
export const KnowledgeMapRelationSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.string(),
})

/** GET /knowledge-map 响应：categories + nodes + relations。 */
export const KnowledgeMapResponse = z.object({
  categories: z.array(KnowledgeMapCategorySchema),
  nodes: z.array(KnowledgeMapNodeSchema),
  relations: z.array(KnowledgeMapRelationSchema),
})

/** 知识网站文章（id/title/content/category/updatedAt/status）。 */
export const KnowledgeSiteArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  category: z.string(),
  updatedAt: z.string(),
  status: z.string(),
})

/** GET /knowledge-site 响应：知识网站文章/栏目列表。 */
export const KnowledgeSiteResponse = z.object({
  items: z.array(KnowledgeSiteArticleSchema),
})

/** POST /knowledge-site/search 请求体：q 必填（trim 后空串 400）。 */
export const KnowledgeSiteSearchBody = z.object({
  q: z.string().trim().min(1),
})

/** POST /knowledge-site/search 响应：标题/内容 LIKE 命中的文章。 */
export const KnowledgeSiteSearchResponse = z.object({
  items: z.array(KnowledgeSiteArticleSchema),
})

/** POST /knowledge-site/qa 请求体：question 必填（trim 后空串 400）。 */
export const QaBody = z.object({
  question: z.string().trim().min(1),
})

/** 答案池引用（doc/version/page/role，口径对齐 base.mock ANSWER_POOL citations）。 */
export const QaCitationSchema = z.object({
  doc: z.string(),
  version: z.string(),
  page: z.string(),
  role: z.string(),
})

/** QA 命中：答案 + 引用 + 可信度（0–100 整数）。 */
export const QaHitResponse = z.object({
  answered: z.literal(true),
  answer: z.string(),
  citations: z.array(QaCitationSchema),
  confidence: z.number().int().min(0).max(100),
})

/** QA 未命中：诚实拒答（原因/已检索范围/缺失知识类型/建议——不伪装成答案）。 */
export const QaRefusalResponse = z.object({
  answered: z.literal(false),
  reason: z.string(),
  searchedCount: z.number().int().min(0),
  missingType: z.string(),
  suggestions: z.array(z.string()),
})

/** POST /knowledge-site/qa 响应：命中/拒答按 answered 判别。 */
export const QaResponse = z.discriminatedUnion('answered', [QaHitResponse, QaRefusalResponse])

export type KnowledgeSiteSearchBodyInput = z.infer<typeof KnowledgeSiteSearchBody>
export type QaBodyInput = z.infer<typeof QaBody>

// ---------- 助手域 ----------

/** 助手响应（GET /assistants 列表项 / POST / PATCH / publish 返回值）。 */
export const AssistantResponse = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  desc: z.string(),
  scope: z.string(),
  enabled: z.boolean(),
  draft: z.string(),
  version: z.number().int().min(1),
})

/** GET /assistants 响应：助手数组（服务端返回裸数组，非 {items} 信封）。 */
export const AssistantListResponse = z.array(AssistantResponse)

/** POST /assistants 请求体：name 必填；icon/desc/scope 可选（默认 ✨/''/''；enabled=true、draft=''、version=1）。 */
export const AssistantCreateBody = z.object({
  name: z.string().min(1),
  icon: z.string().optional(),
  desc: z.string().optional(),
  scope: z.string().optional(),
})

/**
 * PATCH /assistants/:id 请求体：name/icon/desc/scope/enabled/draft 显式白名单。
 * 草稿编辑（写 draft）不升 version——发布时才生成新版本（见 publish 语义）。
 */
export const AssistantPatch = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional(),
  desc: z.string().optional(),
  scope: z.string().optional(),
  enabled: z.boolean().optional(),
  draft: z.string().optional(),
})

/**
 * 发布草稿（draft 字段的 JSON 形态）：name/icon/desc/scope/enabled 全部可选（允许部分配置，缺省回落 live 值）。
 * POST /assistants/:id/publish 时对解析后的 JSON 做类型校验——非对象（null/数组/原始值）
 * 或字段类型不符（如 enabled:"false"）→ 400 BAD_DRAFT，防止污染 live 字段或 500。
 * 注意：不包含前端 mock 的 knowledge/audience/principles/welcome/suggested——契约在 Web 接入阶段再固定。
 */
export const AssistantDraftSchema = z.object({
  name: z.string().optional(),
  icon: z.string().optional(),
  desc: z.string().optional(),
  scope: z.string().optional(),
  enabled: z.boolean().optional(),
})

export type AssistantCreateBodyInput = z.infer<typeof AssistantCreateBody>
export type AssistantPatchInput = z.infer<typeof AssistantPatch>
export type AssistantDraftInput = z.infer<typeof AssistantDraftSchema>

// ---------- 对话/历史域 ----------

/** 聊天会话响应（GET /chat/sessions 列表项 / POST /chat/sessions 返回值；messageCount 聚合自消息表）。 */
export const ChatSessionResponse = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  createdAt: z.string(),
  userId: z.string(),
  messageCount: z.number().int().min(0),
})

/** GET /chat/sessions 响应：会话数组（createdAt 倒序，非 {items} 信封）。 */
export const ChatSessionListResponse = z.array(ChatSessionResponse)

/** POST /chat/sessions 请求体：title/source/userId 均可选（默认 新对话/工作台/u-1）。 */
export const ChatSessionCreateBody = z.object({
  title: z.string().optional(),
  source: z.string().optional(),
  userId: z.string().optional(),
})

/** 聊天消息响应（GET /chat/sessions/:id/messages 列表项；answerId 命中答案池时非空）。 */
export const ChatMessageResponse = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  answerId: z.string().nullable(),
  createdAt: z.string(),
})

/** GET /chat/sessions/:id/messages 响应：消息数组（createdAt 升序）。 */
export const ChatMessageListResponse = z.array(ChatMessageResponse)

/** POST /chat/sessions/:id/messages 请求体：仅接受 role=user（assistant 回复由服务端生成）；content 空串 400。 */
export const ChatMessageCreateBody = z.object({
  role: z.literal('user'),
  content: z.string().trim().min(1),
})

/**
 * POST /chat/sessions/:id/messages 响应：{ userMessage, assistantMessage }。
 * assistantMessage 在基础消息结构上携带 QA 负载（镜像 B7 语义）：
 * 命中 → answered:true + citations/confidence；未命中 → answered:false + searchedCount/missingType。
 */
export const ChatMessageCreateResponse = z.object({
  userMessage: ChatMessageResponse,
  assistantMessage: ChatMessageResponse.extend({
    answered: z.boolean(),
    citations: z.array(QaCitationSchema).optional(),
    confidence: z.number().int().min(0).max(100).optional(),
    searchedCount: z.number().int().min(0).optional(),
    missingType: z.string().optional(),
  }),
})

export type ChatSessionCreateBodyInput = z.infer<typeof ChatSessionCreateBody>
export type ChatMessageCreateBodyInput = z.infer<typeof ChatMessageCreateBody>

// ---------- 搜索域 ----------

/** 搜索命中条目（id/name/meta/path：path 为前端路由提示，用于跳转）。 */
export const SearchItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  meta: z.string(),
  path: z.string(),
})

/** 搜索分组：key（docs/questions/articles/spaces）+ label（中文标题）+ items。 */
export const SearchGroupSchema = z.object({
  key: z.string(),
  label: z.string(),
  items: z.array(SearchItemSchema),
})

/** GET /search 查询参数：q 必填（trim 后空串 400）；limit 每组分页上限（默认 5，1..20）。 */
export const SearchQuery = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

/** GET /search 响应：分组结果（无命中时 groups 为空数组，200）。 */
export const SearchResponse = z.object({
  groups: z.array(SearchGroupSchema),
})

export type SearchQueryInput = z.infer<typeof SearchQuery>

// ---------- 指令域 ----------

/** 指令状态枚举（草稿/已发布，与 types.ts 的 InstructionStatus 同源）。 */
export const InstructionStatusSchema = z.enum(INSTRUCTION_STATUSES)

/**
 * 版本差异摘要（发布时与上一已发布文本的行级 diff）：
 * changed 是否有变化、added 新增行数、removed 删除行数（前端「版本 diff 高亮」口径）。
 */
export const InstructionDiffSchema = z.object({
  changed: z.boolean(),
  added: z.number().int().min(0),
  removed: z.number().int().min(0),
})

/** 指令响应（GET /instructions 列表项 / POST / PATCH / publish / rollback 返回值）。 */
export const InstructionResponse = z.object({
  id: z.string(),
  name: z.string(),
  text: z.string(),
  scope: z.array(z.string()),
  status: InstructionStatusSchema,
  version: z.number().int().min(1),
  readonly: z.boolean(),
  createdAt: z.string(),
})

/** GET /instructions 响应：指令数组（服务端返回裸数组，非 {items} 信封）。 */
export const InstructionListResponse = z.array(InstructionResponse)

/**
 * POST /instructions 请求体：name 必填；text/scope 可选
 * （默认 text=''、scope=[]、status=草稿、version=1、readonly=false）。
 */
export const InstructionCreateBody = z.object({
  name: z.string().min(1),
  text: z.string().optional(),
  scope: z.array(z.string()).optional(),
})

/**
 * PATCH /instructions/:id 请求体：name/text/scope 显式白名单。
 * 仅草稿可编辑（已发布 → 409 PUBLISHED_NOT_EDITABLE；readonly → 400 READONLY）。
 */
export const InstructionPatch = z.object({
  name: z.string().min(1).optional(),
  text: z.string().optional(),
  scope: z.array(z.string()).optional(),
})

/** POST /instructions/:id/rollback 请求体：version 可选（缺省回滚到最新版本）。 */
export const InstructionRollbackBody = z.object({
  version: z.number().int().min(1).optional(),
})

/** 指令版本行（GET /instructions/:id/versions 列表项；diff 已从 JSON 文本解析为对象）。 */
export const InstructionVersionResponse = z.object({
  id: z.string(),
  instructionId: z.string(),
  version: z.number().int().min(1),
  text: z.string(),
  diff: InstructionDiffSchema,
  publishedAt: z.string(),
})

/** GET /instructions/:id/versions 响应：版本历史数组（version 倒序）。 */
export const InstructionVersionListResponse = z.array(InstructionVersionResponse)

export type InstructionCreateBodyInput = z.infer<typeof InstructionCreateBody>
export type InstructionPatchInput = z.infer<typeof InstructionPatch>
export type InstructionRollbackBodyInput = z.infer<typeof InstructionRollbackBody>
