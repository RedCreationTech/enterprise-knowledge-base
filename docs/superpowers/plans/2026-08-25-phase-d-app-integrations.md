# Phase D：应用与集成域后端 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 实现应用域（安装/卸载）、集成域（配置/重授权）、API 与开发域（Key/自定义API/Webhook）REST 后端。

**Architecture:** 沿用 B/C 模式：每域 `routes/<d>.ts` + `services/<d>.ts` + `schema.ts` 追加表 + `seed.ts` 追加初始行 + `test/<d>.test.ts`；`@kb/shared` zod schema；`:memory:` 测试；`{ok,data}`/`{ok,error}` 信封；TDD。

## Global Constraints
- 中文文案；{ok,data}/{ok,error} 信封；HTTP 400/404/409；@kb/shared zod schema；测试隔离库；API_BASE。
- 数字口径与前端 mock 一致（8 应用清单、3 已安装、4 集成、2 API Key）。
- 每任务 tsc/build/lint 0 + 提交。

---

### Task 1: 应用域（apps + 安装/卸载）

**Files:** routes/apps.ts, services/apps.ts, test/apps.test.ts, db/schema.ts, db/seed.ts, shared/schemas.ts+types.ts
**Schema:** `apps` (id,name,desc,category,logo,status,permissions[],scenes[],previewUrl)，`app_installs` (id,appId,installedAt,installedBy,uninstalledAt)。
**Seed:** 8 应用（飞书问答插件/企业微信/官网客服/钉钉机器人/自定义API/知识日报/飞书文档插件/单点登录SSO，按 `apps-data.ts` 或 `base.mock.ts` `apps` 数组口径）；已安装 3 个（wecom-qa/custom-api/sso）。
**Endpoints:**
- `GET /apps` → 列表（含 installStatus 派生：可试用/已安装）。
- `POST /apps/:id/install` → 标记安装（写 app_installs），404 缺失，409 已安装。
- `POST /apps/:id/uninstall` → 标记卸载（uninstalledAt），404 缺失，409 未安装。
- Keep status=可试用 for trialable apps, 已安装 for installed.

- [ ] **Step 1-5 (TDD)**：测试列表(8)/install(+409 已安装)/uninstall(+409 未安装)/404 → 实现 → 通过 → commit `feat(server): 应用域`

---

### Task 2: 集成域（integrations + 配置/重授权）

**Files:** routes/integrations.ts, services/integrations.ts, test/integrations.test.ts, db/schema.ts, db/seed.ts, shared/schemas.ts
**Schema:** `integrations` (id,name,kind,connected,disabled,config,health,metricValue,metricLabel,reauthAt).
**Seed:** 4 集成（飞书文档/企业微信/钉钉/SSO，按 `integrationsData.ts` 口径：飞书 connected/企微 connected/钉钉 not connected/SSO disabled）。
**Endpoints:**
- `GET /integrations` → 列表 + summary（connectedCount / normal / warning / weeklyUsage）。
- `PATCH /integrations/:id/config` → 更新 config JSON（whitelist keys），404。
- `POST /integrations/:id/reauth` → 设 reauthAt=now，return ok（演示态），404。
- Keep connected/disabled semantics.

- [ ] **Step 1-5 (TDD)**：测试列表(4)/summary/config patch/reauth/404 → 实现 → 通过 → commit `feat(server): 集成域`

---

### Task 3: API 与开发域（api-keys + custom-apis + webhooks）

**Files:** routes/apikeys.ts, services/apikeys.ts, test/apikeys.test.ts, db/schema.ts, db/seed.ts, shared/schemas.ts
**Schema:** `api_keys` (id,name,maskedKey,permissions[],status,lastCalledAt,usage,calledThisMonth)，`custom_apis` (id,name,baseUrl,method,headersJson,authType), `webhooks` (id,name,url,events[],subscribed).
**Seed:** 2 API Keys（按 `apiData.ts`：production key + test key，一活一吊销），若干 custom_apis/webhooks（如果 mock 有）。
**Endpoints:**
- `GET /api-keys` → 列表。
- `POST /api-keys` → 创建（name/permissions/schema），return maskedKey。
- `POST /api-keys/:id/revoke` → 设 status=已吊销，404，409 已吊销。
- `GET /api-keys/:id/usage` → usage（monthly/calledThisMonth/pct），404。
- `GET/POST/PATCH/DELETE /custom-apis` → CRUD。
- `GET/POST /webhooks` → 列表/订阅。

- [ ] **Step 1-5 (TDD)**：测试 keys 列表/create/revoke(409)/usage/custom-apis CRUD/webhooks → 实现 → 通过 → commit `feat(server): API 与开发域`

---

### Task 4: 前端接入验证（应用/集成域）

**Files:** apps/web/src/api/apps.ts, apps/web/src/api/integrations.ts, index.ts
**Endpoints to wire:** getApps, getAppInstallStatus, getIntegrations, getIntegrationConfig.
**Verify:** VITE_USE_MOCK=0 + :18080 起前后端，经 :3000 代理 curl /apps, /integrations 断言形状；mock 回归 200.

- [ ] **Step 1-4**：client 函数 + e2e 断言 + mock 回归 → commit `feat(web): 应用/集成域 API 客户端接入（API 模式验证）`

---

## Self-Review 记录
- 覆盖：设计 §6 应用/集成/API 与开发端点全覆盖（D1-D3）；§7 接入以 D4 验证。
- 类型一致：沿用 buildApp/db/@kb/shared 模式；API_BASE 注册。
