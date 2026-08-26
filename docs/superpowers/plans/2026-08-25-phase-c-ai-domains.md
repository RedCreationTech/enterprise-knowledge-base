# Phase C：AI 域后端（助手/对话/指令）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 在 Phase A/B 后端上实现 AI 域：助手 CRUD、对话会话/历史（含答案池问答）、指令 CRUD/发布/回滚/版本（系统指令只读）。

**Architecture:** 沿用既有模式：每域 `routes/<domain>.ts` + `services/<domain>.ts` + `schema.ts` 追加表 + `seed.ts` 追加初始行 + `test/<domain>.test.ts`；请求/响应经 `@kb/shared` zod schema；`API_BASE` 前缀；`:memory:` 测试隔离；`{ok,data}`/`{ok,error}` 信封；error-handler 400/404/409/422；TDD。

**Tech Stack:** Fastify 5 · better-sqlite3 · zod · node:test · `@kb/shared`

## Global Constraints

- 中文文案；`{ok,data}`/`{ok,error}` 信封；HTTP 400/404/409（指令发布状态机用 409 CONFLICT）。
- 请求/响应经 `@kb/shared` zod schema（新增 schema 加 shared 并导出 + rebuild）。
- 数字口径/文案与前端 mock 一致（assistants=2、指令 4 系统+3 自定义、答案池引用/可信度）；seed 从 mock 对齐。
- 系统预置指令只读（PATCH/DELETE/发布对 readonly 指令 → 400/409）。
- 每任务：`npm test --workspace @kb/server` 全绿 + `npm run build` 0 + `npm run lint` 0 + 提交一次。
- 测试隔离库 + API_BASE 常量（沿用既有约定，不硬编码 /api/v1）。

---

### Task 1: 助手域（assistants + versions）

**Files:**
- Create: `apps/server/src/services/assistants.ts`、`apps/server/src/routes/assistants.ts`、`apps/server/test/assistants.test.ts`
- Modify: `apps/server/src/db/schema.ts`（assistants: id,name,icon,desc,scope,enabled,draft,version；assistant_versions: id,assistantId,version,config,publishedAt）、`apps/server/src/db/seed.ts`（2 个助手：企业知识助手/销售问答助手，口径 aiAssistant.mock.ts）、`packages/shared/src/schemas.ts` + `types.ts`

**Interfaces:**
- Produces: `GET /assistants`（列表含状态）；`POST /assistants`（新建草稿）；`PATCH /assistants/:id`（改配置→存为新版本？否：编辑走 draft 字段，发布时生成版本——见 C3 语义，本任务先做基础 CRUD + 保存草稿）；`DELETE /assistants/:id`；`POST /assistants/:id/publish`（draft→生效 + 写 assistant_versions 版本号递增）。语义对齐前端 AiAssistant「保存草稿→发布」流程。

- [ ] **Step 1-5（TDD）**：测试列表(2)/新建/PATCH 草稿/DELETE/publish 版本递增 → 实现 → 通过 → commit `feat(server): 助手域`

---

### Task 2: 对话/历史域（chat_sessions + chat_messages + QA）

**Files:**
- Create: `apps/server/src/services/chat.ts`、`apps/server/src/routes/chat.ts`、`apps/server/test/chat.test.ts`
- Modify: `apps/server/src/db/schema.ts`（chat_sessions: id,title,source,createdAt,userId；chat_messages: id,sessionId,role,content,answerId,createdAt）、`apps/server/src/db/seed.ts`（会话 156 问口径：若干会话+消息，来源渠道 4）、`packages/shared/src/schemas.ts`

**Interfaces:**
- Produces: `GET /chat/sessions`（历史会话列表，含计数）；`GET /chat/sessions/:id/messages`；`POST /chat/sessions/:id/messages`（追加消息；若 role=user 则查 answer_pool 生成 assistant 回复（命中答案+引用+可信度/未命中拒答），一并入库返回 `{ userMessage, assistantMessage }`）；`POST /chat/sessions`（新建会话，返回 id）。口径：会话累计 156 问、今日 64、来源 4 渠道。

- [ ] **Step 1-5（TDD）**：测试会话列表/新建/消息追加/QA 命中与拒答入库 → 实现 → 通过 → commit `feat(server): 对话/历史域`

---

### Task 3: 指令域（instructions + 发布/回滚 + 版本，系统只读）

**Files:**
- Create: `apps/server/src/services/instructions.ts`、`apps/server/src/routes/instructions.ts`、`apps/server/test/instructions.test.ts`
- Modify: `apps/server/src/db/schema.ts`（instructions: id,name,text,scope,status(草稿/已发布),version,readonly,createdAt；instruction_versions: id,instructionId,version,text,diff,publishedAt）、`apps/server/src/db/seed.ts`（4 系统预置 readonly + 3 自定义，口径 instructionsData.ts）、`packages/shared/src/schemas.ts`

**Interfaces:**
- Produces: `GET /instructions`；`POST /instructions`（新建自定义草稿）；`PATCH /instructions/:id`（草稿编辑，readonly→400）；`DELETE /instructions/:id`（readonly→400）；`POST /instructions/:id/publish`（草稿→已发布，写版本+diff 高亮）；`POST /instructions/:id/rollback`（回滚到指定版本：生成新草稿；状态机：已发布可回滚）；`GET /instructions/:id/versions`。语义对齐前端 Instructions「草稿→发布→版本 diff→回滚走草稿」。

- [ ] **Step 1-5（TDD）**：测试列表(7)/新建/PATCH 草稿/readonly 400/publish 版本+diff/rollback/versions → 实现 → 通过 → commit `feat(server): 指令域`

---

### Task 4: 端到端验证（AI 域经代理走 API 模式）

**Files:**
- Modify: `apps/web/src/api/`（新增 assistants/chat/instructions client 函数 + shared schema）、`apps/web/src/api/index.ts`
- 验证: `VITE_USE_MOCK=0` + `PORT=18080` 起双端，经 :3000 代理 curl `/assistants`、`/chat/sessions`、`/instructions` 断言形状；mock 回归 200。

**Interfaces:**
- Consumes: Task 1-3 端点 + `apiRequest`。
- Produces: AI 域 client 函数可用（页面组件仍不直连，证明链路）。

- [ ] **Step 1-4**：client 函数 + e2e 断言 + mock 回归 → commit `feat(web): AI 域 API 客户端接入（API 模式验证）`

---

## Self-Review 记录

- Spec 覆盖：设计 §6 AI 域端点全覆盖（C1-C3）；§7 接入以 C4 验证。
- 占位符：无 TBD；每任务含端点规格 + 文件清单 + TDD 要点；完整代码按 B 阶段既有模式书写。
- 类型一致：沿用 buildApp/db/@kb/shared schema 模式；`/api/v1`（API_BASE）注册。
