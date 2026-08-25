# 企业知识库：前后端目录重构 + 后端接口设计

- 日期：2026-08-25
- 状态：已确认（决策点 1-3 用户已批准）
- 适用范围：`app/` 仓库（当前为纯前端 React + mock）

## 1. 背景与目标

当前项目是纯前端单页应用（React 19 + Vite + TS + Tailwind），全部数据来自 `src/mocks/`（store.tsx 状态片 + 14 个 workspace 数据模块），无真实后端。目标：

1. 整理代码，维护清晰的前后端目录结构（npm workspaces 单仓，前端迁入 `apps/web`）。
2. 依据前端全部功能，补充完整 REST 接口与后台（Fastify + better-sqlite3）。
3. 前端通过统一 API client 接入，**保留 mock 作为演示/离线回退**，页面接口签名不变。

## 2. 决策记录（已确认）

| 决策点 | 结论 |
|---|---|
| 后端技术栈 | Fastify + better-sqlite3（Node + TS 同构） |
| 数据持久化 | SQLite 单文件 `data/kb.sqlite`（重启不丢） |
| 实施范围 | 分阶段（A 骨架 → B 核心 → C AI → D 应用集成 → E 运营） |
| 前端接入 | 统一 `src/api/` client 层 + `VITE_USE_MOCK` 开关，mock 保留为回退 |
| 目录方案 | npm workspaces monorepo，前端迁入 `apps/web` |
| 鉴权 | 演示级：`POST /auth/demo-login` 返回固定 token（张伟/管理员），`Authorization: Bearer` 中间件；预留真实登录位 |

## 3. 目录结构（目标态）

```
app/                          # 仓库根（现有 git 仓库）
├── package.json              # workspaces 根：scripts = dev / dev:web / dev:server / build / lint / test
├── docs/superpowers/specs/   # 设计文档
├── apps/
│   ├── web/                  # 前端（现有 React+Vite 整体迁入）
│   │   ├── package.json
│   │   ├── index.html
│   │   ├── vite.config.ts    # root=apps/web、@ 别名、proxy /api → :8080
│   │   ├── tsconfig*.json
│   │   ├── tailwind.config.js / postcss.config.js
│   │   ├── public/ src/
│   └── server/               # 后端（Fastify）
│       ├── package.json
│       └── src/
│           ├── index.ts      # 启动装配：CORS / 路由 / 静态托管 web 产物 / 错误处理
│           ├── app.ts        # buildApp()（可测试的装配工厂）
│           ├── routes/       # 按域：auth / org / spaces / docs / connectors / knowledge / ai / chat / instructions / apps / integrations / apiKeys / analytics / feedback / tasks / permissions / settings / search / notifications / exports
│           ├── services/     # 每域 service：CRUD / 状态机 / 派生指标
│           ├── db/
│           │   ├── client.ts # better-sqlite3 单例 + WAL
│           │   ├── schema.ts # 建表 DDL
│           │   └── seed.ts   # 从现有 mock 数据灌初始行（口径一致）
│           ├── middleware/   # auth / request-log / error-handler
│           └── utils/
└── packages/
    └── shared/               # 前后端共享：实体 TS 类型 + zod schema + API 契约（单一事实源）
        ├── src/
        │   ├── types.ts      # 实体类型（Space/Doc/Connector/…）
        │   ├── schemas/      # zod schema（与路由入参/响应共用）
        │   └── api.ts        # 端点契约常量（method/path/query/schema）
        └── package.json
```

前端迁入要点（一次性、低风险）：`@/` 别名与 `vite`/`tsconfig` 路径改为相对 `apps/web`；`public/`、`index.html`、`tailwind` 等随目录移动；vite dev 代理 `/api` → 后端端口；迁移后 `tsc + build + 页面冒烟` 全绿才继续。

## 4. 后端架构

- **Fastify 装配**：`buildApp()` 工厂（便于测试）；插件顺序：cors → auth → 路由 → 错误处理 → 静态托管（生产）。
- **better-sqlite3**：单文件库，`PRAGMA journal_mode=WAL`；`schema.ts` 幂等建表；`seed.ts` 幂等播种（存在数据则跳过）。
- **鉴权（演示级）**：`POST /auth/demo-login` 返回 `{ token }`（固定用户张伟/管理员）；`auth` 中间件校验 Bearer，注入 `request.user`；`/health`、`/auth/*` 公开。真实登录（账号密码/OTP）在 B 阶段预留实现位。
- **API 信封**：统一 `{ ok: true, data }` / `{ ok: false, error: { code, message } }`；HTTP 语义 400/401/403/404/409/500。
- **校验**：请求入参与响应均用 `packages/shared` 的 zod schema（前端 client 与后端 route 共用，响应即校验——延续项目"shape 校验防白屏"纪律）。
- **口径一致性**：种子与派生指标沿用现有 `METRICS` 数值（128/156/12/1,286/328/87.6% 等），数据库是唯一数据源，前端不再硬编码。

## 5. 数据模型（SQLite 表）

| 表 | 说明 | 主要字段 |
|---|---|---|
| org | 组织 | id, name, industry, contact, demoData |
| plan | 套餐 | tier, storageUsedGB, storageTotalGB, seats, seatsUsed, validUntil |
| members | 成员 | id, name, email, role, dept, status(活跃/待激活), joinedAt |
| users | 用户/账号 | id, memberId, email, passwordHash(预留), role |
| trial_journey | 试用旅程 | activated, step, installedApps[], uninstalledApps[], userInstalledApps[], invitesSent, configProgress |
| spaces | 知识空间 | id, name, count, health, reviewCycle, archived, createdAt |
| docs | 文档 | id, spaceId, title, type, category, status, owner, updatedAt, source |
| connectors | 连接器/数据来源 | id, name, kind, connected, disabled, docs, lastSyncAt, config |
| sync_tasks | 同步任务 | id, connectorId, status, progress, failedCount, at |
| assistants | AI 助手 | id, name, icon, desc, scope, enabled, draft?, versions |
| chat_sessions | 会话 | id, title, source(channel), createdAt, userId |
| chat_messages | 消息 | id, sessionId, role, content, answerId?, createdAt |
| answer_pool | 答案池 | id, question, answer, citations[], confidence |
| instructions | 指令 | id, name, text, scope[], status(草稿/已发布), version, readonly, createdAt |
| instruction_versions | 指令版本 | id, instructionId, version, text, diff, publishedAt |
| apps | 应用目录 | id, name, desc, category, status(可试用/已安装), permissions[] |
| app_installs | 安装记录 | id, appId, installedAt, installedBy, uninstalledAt? |
| integrations | 集成配置 | id, appId, channel, connected, config, health(正常/告警), reauthAt |
| api_keys | API Key | id, name, maskedKey, permissions[], status(活跃/已吊销), lastCalledAt, usage |
| custom_apis | 自定义 API | id, name, baseUrl, method, headers, auth |
| webhooks | Webhook | id, name, url, events[], subscribed |
| feedback | 反馈 | id, type, content, rating, status(待处理/已处理), createdAt |
| knowledge_issues | 知识问题 | id, title, priority, status, owner, sourceFeedbackId, closedAt |
| tasks | 待办任务 | id, title, group, priority, status, assignee, dueAt, reason |
| roles | 角色 | id, name, level |
| identity_mapping | 身份映射 | id, memberId, externalAccount, mapped |
| audit_logs | 审计日志 | id, actor, action, target, at |
| knowledge_map | 知识地图 | id, category, docId, position, relations |
| knowledge_site | 知识网站 | id, title, content, category, updatedAt, status |
| notifications | 通知 | id, title, read, at |
| settings | 设置 | id, key, value (orgProfile/notifications/security/…) |
| metrics_daily | 日指标 | date, questions, answered, noAnswer, approval, activeUsers, feedback |

## 6. API 设计（REST，前缀 `/api/v1`）

| 域 | 端点 |
|---|---|
| 健康/演示 | `GET /health`、`POST /auth/demo-login`、`POST /demo-data`、`POST /demo-data/reset` |
| 认证/旅程 | `POST /auth/otp/send`、`POST /auth/otp/verify`、`POST /trial/apply`、`GET /journey`、`PATCH /journey` |
| 组织 | `GET /org`、`PATCH /org`、`GET /org/members`、`POST /org/members`、`PATCH /org/members/:id`、`DELETE /org/members/:id`、`GET /plan` |
| 知识空间 | `GET /spaces`、`POST /spaces`、`PATCH /spaces/:id`、`DELETE /spaces/:id`、`POST /spaces/:id/upload` |
| 文档 | `GET /docs?space&search&type&status&category&page&size`、`POST /docs/upload`、`PATCH /docs/:id`、`DELETE /docs/:id`、`POST /docs/batch-archive`、`POST /docs/batch-move` |
| 数据来源 | `GET /connectors`、`POST /connectors/:id/connect`、`POST /connectors/:id/sync`、`PATCH /connectors/:id`、`DELETE /connectors/:id`、`GET /sync-tasks` |
| 知识地图/网站 | `GET /knowledge-map`、`GET /knowledge-site`、`POST /knowledge-site/search`、`POST /knowledge-site/qa` |
| AI 助手 | `GET /assistants`、`POST /assistants`、`PATCH /assistants/:id`、`DELETE /assistants/:id` |
| 对话 | `GET /chat/sessions`、`GET /chat/sessions/:id/messages`、`POST /chat/sessions/:id/messages`（含答案池问答） |
| 指令 | `GET /instructions`、`POST /instructions`、`PATCH /instructions/:id`、`DELETE /instructions/:id`、`POST /instructions/:id/publish`、`POST /instructions/:id/rollback`、`GET /instructions/:id/versions` |
| 应用 | `GET /apps`、`POST /apps/:id/install`、`POST /apps/:id/uninstall` |
| 集成 | `GET /integrations`、`PATCH /integrations/:id/config`、`POST /integrations/:id/reauth` |
| API 与开发 | `GET /api-keys`、`POST /api-keys`、`POST /api-keys/:id/revoke`、`GET /api-keys/:id/usage`、`GET/POST/PATCH/DELETE /custom-apis`、`GET/POST /webhooks` |
| 运营分析 | `GET /analytics/metrics?range=today\|7d\|30d`、`GET /analytics/trend?days=7\|30`、`GET /analytics/distributions` |
| 反馈 | `GET /feedback`、`POST /feedback`、`PATCH /feedback/:id`（转问题/关闭）、`GET /feedback/issues`、`PATCH /feedback/issues/:id` |
| 任务 | `GET /tasks`、`POST /tasks/generate`、`PATCH /tasks/:id`（状态/转交/跳过/原因） |
| 权限 | `GET /permissions/roles`、`PATCH /permissions/roles`、`GET /permissions/members`、`POST /permissions/members`、`GET /permissions/identity-mapping`、`PATCH /permissions/identity-mapping`、`GET /permissions/audit` |
| 设置 | `GET/PATCH /settings/org`、`GET/PATCH /settings/notifications`、`GET /settings/plan`、`GET /settings/security` |
| 全局 | `GET /search?q=`、`GET /notifications`、`POST /notifications/read-all`、`POST /exports/weekly-report`、`POST /exports/conversations`、`POST /exports/knowledge-map` |

## 7. 前端接入

- 新增 `apps/web/src/api/`：`client.ts`（fetch + token + 信封解包 + zod 校验）、每域 endpoint 模块（`auth.ts / org.ts / spaces.ts / docs.ts / …`）。
- **运行开关**：`VITE_USE_MOCK=1|0`（默认 1 保持现状；置 0 走 API）。`demoData` 演示态/离线 → 现有 mock；真实态 → API。
- **接入方式（低风险）**：页面组件不直接改；先让 `store` 的 action 与数据模块在 API 模式下改为调用 client（同一接口签名），mock 保留为回退。逐域切换、逐域验证，可随时切回。
- store 持久化：API 模式下不再写 localStorage（数据由服务端持有），mock 模式维持现状。

## 8. 分阶段实施

| 阶段 | 内容 | 验收 |
|---|---|---|
| A 骨架 | 目录重构（前端→apps/web）+ 后端骨架（Fastify+SQLite+schema+seed+health+demo-login）+ shared 契约 + api client 脚手架 + mock/API 开关 + vite 代理 | 前端迁移后 `tsc/build/页面冒烟` 全绿；`GET /api/v1/health` 200；`/api/v1/demo-login` 返回 token |
| B 核心域 | 认证/旅程、组织/成员/套餐、空间/文档/上传、连接器/同步、知识地图/网站、搜索/问答 | seed 数据与 mock 口径一致；CRUD 落库、刷新不丢；QA 走答案池 |
| C AI 域 | 助手 CRUD、对话会话/历史、指令 CRUD/发布/回滚/版本 | 状态机在服务端成立；前端 AI 页走 API |
| D 应用集成 | 应用安装/卸载、集成配置/重授权、API Key/自定义 API/Webhook | 安装状态单源在服务端；吊销/用量落库 |
| E 运营 | 分析指标/趋势、反馈闭环、任务/待办、权限/身份映射/审计、设置、通知、导出 | 计数即时、口径一致；导出文件名正确 |

每阶段独立可验收、可回退；mock 始终可用作对照；每阶段结束 `tsc/build/lint` 0 + 目标页面冒烟。

## 9. 测试与验证

- 后端：`node:test`（或 vitest）覆盖 `buildApp` 装配 + 每域 service 的 CRUD/状态机 + 路由契约（用 `app.inject()`，无需起端口）；DB 用内存/临时文件。
- 共享契约：zod schema 前后端共用，`packages/shared` 单测确保契约不漂移。
- 端到端：`VITE_USE_MOCK=0` 起前后端，headless 浏览器走核心页面（空间/文档/AI/反馈）断言数据来自 API。
- 回归：每阶段对比 mock 与 API 模式页面数据一致。

## 10. 非目标（Non-goals）

- 不做真实多用户认证/权限体系（演示级 token；真实登录仅留位）。
- 不做文件物理上传存储（演示期文档元数据入库；真实文件存储留待后续）。
- 不做水平扩展/部署编排（单进程 + SQLite；预留环境变量）。
- 不迁移历史 localStorage 数据到服务端（从 seed 重新开始，口径一致）。
