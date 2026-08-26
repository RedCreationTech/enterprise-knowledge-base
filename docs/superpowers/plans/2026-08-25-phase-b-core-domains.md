# Phase B：核心域后端（认证/组织/空间/文档/连接器/知识/搜索）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 在 Phase A 骨架上实现核心域 REST 后端：启动装配（createSchema+seed 接入）、认证/旅程、组织/成员/套餐、知识空间/文档（含上传）、数据来源/同步、知识地图/网站/问答、搜索；并对齐 seed 口径与前端 mock。

**Architecture:** 每个域 = `routes/<domain>.ts`（Fastify 路由，注册进 `/api/v1`）+ `services/<domain>.ts`（业务逻辑/状态机）+ `schema.ts` 追加该域 `CREATE TABLE IF NOT EXISTS` + `seed.ts` 追加初始行 + `test/<domain>.test.ts`（`app.inject()` + service 单测）。请求/响应经 `packages/shared` zod schema 校验（每域在 shared 补对应 schema）。模式以 Task B1 建立的样板为准。

**Tech Stack:** Fastify 5 · better-sqlite3 · zod · node:test（`app.inject()`）· 既有 `buildApp()`/`db`/`@kb/shared`

## Global Constraints

- 中文文案；响应统一 `{ ok, data }` / `{ ok, error }` 信封；HTTP 语义 400/401/403/404/409/500。
- 请求/响应经 `@kb/shared` zod schema 校验（新增 schema 加在 shared 并导出）。
- 数字口径与前端 mock 一致（128/156/12/1,286/328/87.6% 等）；seed 从既有 mock 数据对齐，不新造口径。
- 每任务：`npm test --workspace @kb/server` 全绿（含新增）+ `npm run build` 0 + `npm run lint` 0 + 提交一次。
- 测试用 `:memory:`/临时库（Phase A 遗留：`db/client.ts` 需支持注入 DB 路径或测试用临时文件，见 B1）。
- 路由路径前缀 `/api/v1` 用 `API_BASE` 常量，不在测试里硬编码（Phase A 遗留）。

---

### Task 1: 启动装配 + 错误语义 + 测试隔离 + seed 口径对齐

**Files:**
- Modify: `apps/server/src/app.ts`（buildApp 内调用 `createSchema()` + `seedIfEmpty()`）、`apps/server/src/middleware/error-handler.ts`（400/401/403/404/409/500 映射）、`apps/server/src/db/client.ts`（支持 `KB_DB_PATH` 环境变量，便于测试隔离）、`apps/server/src/db/seed.ts`（对齐：org.industry='软件与信息技术服务'、org.demoData、users.passwordHash 预留字段、members 角色/部门用全局 CoreRole 口径 管理员/知识管理员/空间管理员/文档审核员/助手运营员/普通成员 + 部门与 permissionsData 一致）、`apps/server/src/db/schema.ts`（org 加 demoData 列、users 加 passwordHash 列）
- Test: `apps/server/test/app.test.ts`（改用 `API_BASE` 常量 + 临时 DB 环境）、`apps/server/test/db.test.ts`（`:memory:`）

**Interfaces:**
- Consumes: Phase A 的 `buildApp`/`db`/`createSchema`/`seedIfEmpty`/`@kb/shared`。
- Produces: `buildApp()` 启动即建表+播种；`error-handler` 正确映射 5 类状态码；测试可在隔离 DB 上跑。

- [ ] **Step 1: 写失败测试（隔离 DB + API_BASE + 状态码）**

```ts
// apps/server/test/app.test.ts（改造）
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/app.js'
import { API_BASE } from '@kb/shared'

test('错误信封状态码映射', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: `${API_BASE}/nope` })
  assert.equal(res.statusCode, 404)
  assert.equal(res.json().error.code, 'NOT_FOUND')
})
```

（B1 还要在 db.test.ts 用 `KB_DB_PATH=:memory:` 或临时文件跑 schema+seed，断言 members 角色为 CoreRole 口径、org.industry 为 '软件与信息技术服务'。）

- [ ] **Step 2: 运行确认失败**（未实现/未对齐断言失败）
- [ ] **Step 3: 实现**（schema 加列、seed 对齐、app.ts 装配、error-handler 映射、client.ts 支持 `KB_DB_PATH`）
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit** `feat(server): 启动装配 + 错误语义 + 测试隔离 + seed 口径对齐`

---

### Task 2: 认证/旅程域

**Files:**
- Create: `apps/server/src/services/journey.ts`、`apps/server/src/routes/journey.ts`、`apps/server/test/journey.test.ts`
- Modify: `apps/server/src/db/schema.ts`（trial_journey 已有）、`apps/server/src/db/seed.ts`
- Modify: `packages/shared/src/schemas.ts`（Journey 响应/请求 schema）

**Interfaces:**
- Consumes: `db`、`buildApp` 注册模式。
- Produces: `GET /auth/journey`、`PATCH /auth/journey`（step/activated/installedApps/userInstalledApps/configProgress/invitesSent）、`POST /auth/trial/apply`（写申请记录，演示态返回成功）、`POST /auth/otp/send`、`POST /auth/otp/verify`（演示固定码 123456）、`POST /demo-data`（demoData=true）、`POST /demo-data/reset`（清空业务表回到 seed）。

- [ ] **Step 1-5（TDD）**：测试「PATCH journey 更新持久化」「trial/apply 落库」「otp/verify 固定码 123456 成功、错误码 400」「demo-data/reset 幂等」→ 实现 → 通过 → commit `feat(server): 认证/旅程域`

---

### Task 3: 组织/成员/套餐域

**Files:**
- Create: `apps/server/src/services/org.ts`、`apps/server/src/routes/org.ts`、`apps/server/test/org.test.ts`
- Modify: `packages/shared/src/schemas.ts`（Org/Member/Plan schema）

**Interfaces:**
- Produces: `GET /org`（含 demoData）、`PATCH /org`、`GET /org/members`（含 待激活 状态、角色 CoreRole 口径）、`POST /org/members`（席位闸门：seatsUsed<seats 否则 409）、`PATCH /org/members/:id`（角色/状态变更）、`DELETE /org/members/:id`（L4 校验留前端，后端仅删除）、`GET /plan`。

- [ ] **Step 1-5（TDD）**：测试「GET /org 返回 seed 组织」「POST /org/members 超席 409」「PATCH member 角色」「GET /plan」→ 实现 → 通过 → commit `feat(server): 组织/成员/套餐域`

---

### Task 4: 知识空间域

**Files:**
- Create: `apps/server/src/services/spaces.ts`、`apps/server/src/routes/spaces.ts`、`apps/server/test/spaces.test.ts`
- Modify: `apps/server/src/db/schema.ts`（spaces/docs 表）、`apps/server/src/db/seed.ts`（5 空间 + 128 文档初始行，口径 128/34/32/28/12）、`packages/shared/src/schemas.ts`

**Interfaces:**
- Produces: `GET /spaces`（含 count/health/reviewCycle/archived）、`POST /spaces`（新建，默认 默认空间不可删）、`PATCH /spaces/:id`（重命名/健康/周期）、`DELETE /spaces/:id`（默认空间 400）、`POST /spaces/:id/upload`（写入 docs，spaceId=目标空间）。

- [ ] **Step 1-5（TDD）**：测试「GET /spaces 5 空间计数 128/34/32/28/12」「POST 新建后 GET 可见」「PATCH 重命名」「DELETE 默认空间 400」「upload 落目标空间」→ 实现 → 通过 → commit `feat(server): 知识空间域`

---

### Task 5: 文档域

**Files:**
- Create: `apps/server/src/services/docs.ts`、`apps/server/src/routes/docs.ts`、`apps/server/test/docs.test.ts`
- Modify: `apps/server/src/db/schema.ts`（docs 列：id/spaceId/title/type/category/status/owner/updatedAt/source）、`packages/shared/src/schemas.ts`

**Interfaces:**
- Produces: `GET /docs?space&search&type&status&category&page&size`（分页 + 过滤 + 总数）、`POST /docs/upload`、`PATCH /docs/:id`（重命名/移动空间/状态）、`DELETE /docs/:id`、`POST /docs/batch-archive`、`POST /docs/batch-move`。

- [ ] **Step 1-5（TDD）**：测试「过滤+分页」「upload 后列表 +1」「PATCH 移动空间」「batch-archive」「batch-move」→ 实现 → 通过 → commit `feat(server): 文档域`

---

### Task 6: 数据来源/连接器域

**Files:**
- Create: `apps/server/src/services/connectors.ts`、`apps/server/src/routes/connectors.ts`、`apps/server/test/connectors.test.ts`
- Modify: `apps/server/src/db/schema.ts`（connectors/sync_tasks）、`packages/shared/src/schemas.ts`

**Interfaces:**
- Produces: `GET /connectors`（含 connected/disabled/docs/lastSyncAt）、`POST /connectors/:id/connect`（内置钉钉/企微 → connected=true，不建「第三方知识库」伪卡）、`POST /connectors/:id/sync`（写 sync_task，演示态置已完成）、`PATCH /connectors/:id`（启停用）、`DELETE /connectors/:id`、`GET /sync-tasks`。

- [ ] **Step 1-5（TDD）**：测试「connect 钉钉置 connected」「sync 生成任务」「PATCH 停用」「DELETE」→ 实现 → 通过 → commit `feat(server): 数据来源域`

---

### Task 7: 知识地图/网站/问答域

**Files:**
- Create: `apps/server/src/services/knowledge.ts`、`apps/server/src/routes/knowledge.ts`、`apps/server/test/knowledge.test.ts`
- Modify: `apps/server/src/db/schema.ts`（knowledge_map/knowledge_site/answer_pool）、`apps/server/src/db/seed.ts`（答案池：报销/报价/退货等 10+ 题含引用与可信度）、`packages/shared/src/schemas.ts`

**Interfaces:**
- Produces: `GET /knowledge-map`（分类/节点/关系）、`GET /knowledge-site`、`POST /knowledge-site/search`、`POST /knowledge-site/qa`（命中答案池返回答案+引用+可信度；未命中走诚实拒答：原因/已检索范围/缺失类型/双动作）。

- [ ] **Step 1-5（TDD）**：测试「qa 命中答案池返回引用」「qa 未命中走拒答」「knowledge-map 结构」→ 实现 → 通过 → commit `feat(server): 知识地图/网站/问答域`

---

### Task 8: 搜索域

**Files:**
- Create: `apps/server/src/services/search.ts`、`apps/server/src/routes/search.ts`、`apps/server/test/search.test.ts`

**Interfaces:**
- Produces: `GET /search?q=`（分组结果：文档/问题/空间，按标题/内容 LIKE 匹配，返回分组结构）。

- [ ] **Step 1-5（TDD）**：测试「按关键词返回分组结果」「无结果空分组」→ 实现 → 通过 → commit `feat(server): 搜索域`

---

### Task 9: 前端接入验证（代表性域走 API 模式）

**Files:**
- Modify: `apps/web/src/api/index.ts`（导出 org/spaces/journey endpoint 函数，调用 `apiRequest`）、`apps/web/vite.config.ts`（确认代理目标可经 `VITE_PROXY_TARGET` 覆盖）
- Test/验证: `VITE_USE_MOCK=0` + `PORT=18080` 起前后端，浏览器/curl 走代理调用 `GET /org`、`GET /spaces`、`GET /auth/journey` 返回真实数据；mock 模式回归不变。

**Interfaces:**
- Consumes: B1–B8 的端点、`apiRequest`/`getEnvMode`。
- Produces: 代表性域在 API 模式可端到端跑通（页面组件仍不直连，验证 client 层 + 代理 + 后端链路）。

- [ ] **Step 1-4**：实现 org/spaces/journey 的 client 函数 → 起双端 → curl 经代理断言 `{ok:true,data}` → mock 回归 → commit `feat(web): 代表性域 API 客户端接入（API 模式验证）`

---

## Self-Review 记录

- Spec 覆盖：设计 §6 核心域端点全覆盖（B2–B8）；§7 前端接入以 B9 验证链路；Phase A 遗留（启动装配/错误语义/测试隔离/seed 对齐）收进 B1。
- 占位符：无 TBD；每任务含端点规格、文件清单、TDD 测试要点；完整代码以 B1 样板为准（领域任务代码量大，实现者按 B1 模式 + 端点规格书写）。
- 类型一致：统一 `buildApp`/`db`/`@kb/shared` schema 模式；路由一律注册进 `/api/v1`（`API_BASE`）。
