# Phase A：Monorepo 重构 + 后端骨架 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有纯前端仓库重构为 npm workspaces monorepo（前端迁入 `apps/web`），并搭建 Fastify + better-sqlite3 后端骨架（health + demo-login + 核心表 + 最小 seed），前端接入统一 API client 脚手架与 `VITE_USE_MOCK` 开关。

**Architecture:** 根 `package.json` 用 workspaces 编排 `apps/web`（现有 React 前端原样迁入）+ `apps/server`（Fastify，`buildApp()` 装配工厂、路由/service/db 分层）+ `packages/shared`（前后端共享 TS 类型 + zod schema + API 契约）。前端 `VITE_USE_MOCK=1` 时走现有 mock，`=0` 时经 `src/api/` client 请求后端；vite dev 把 `/api` 代理到后端端口。

**Tech Stack:** npm workspaces · Vite 7 · React 19 · Fastify 5 · better-sqlite3 · zod · TypeScript 5 · node:test

## Global Constraints

- 中文 UI 与现有页面行为不改变；前端迁入 `apps/web` 后 `tsc -b`、`npm run build`、`npm run lint` 必须 0 错误，页面冒烟全绿。
- 数字口径沿用现有 mock（128/156/12/1,286/328/87.6% 等），seed 与其一致。
- 复用现有 `@/` 别名（相对 `apps/web/src`）；不改变前端组件代码（仅迁移路径 + 配置）。
- 后端全部 TS；`packages/shared` 的 zod schema 是前后端唯一契约；响应统一 `{ ok, data }` / `{ ok, error }` 信封。
- 每任务结束：相关测试绿 + `tsc` 0 + 提交一次。

---

### Task 1: Workspace 根 + 前端迁入 `apps/web`

**Files:**
- Create: `package.json`（根，workspaces）、`apps/web/package.json`（由根迁移）、`apps/web/.gitignore`
- Move（`git mv`）: `index.html`、`vite.config.ts`、`tsconfig*.json`、`tailwind.config.js`、`postcss.config.js`、`eslint.config.js`、`components.json`、`public/`、`src/` → `apps/web/`
- Modify: `apps/web/vite.config.ts`（root 与 alias）、`apps/web/tsconfig*.json`（paths）、`apps/web/tailwind.config.js`（content 路径）

**Interfaces:**
- Consumes: 现有前端源码（`apps/web/src/**`，内容不变）。
- Produces: `apps/web` 可独立 `npm run build`；根 `npm run dev:web` 可启动前端；`@/` 别名在 `apps/web` 内仍指向 `src`。

- [ ] **Step 1: 建立目录并 git mv 前端文件**

```bash
cd /Users/admin/gt/knowledge_base/app
mkdir -p apps/web apps/server packages/shared
git mv index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json tailwind.config.js postcss.config.js eslint.config.js components.json .gitignore apps/web/ 2>/dev/null || \
  mv index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json tailwind.config.js postcss.config.js eslint.config.js components.json .gitignore apps/web/
git mv public src apps/web/
# 旧的根 package.json 移为 apps/web/package.json（内容先不动，Step 3 再调）
git mv package.json apps/web/package.json
ls apps/web
```

- [ ] **Step 2: 更新 `apps/web/vite.config.ts`（root 与别名不变，proxy 后续 Task 5 加）**

保持文件其余内容，确认 `resolve.alias['@'] = path.resolve(__dirname, './src')` 仍正确（因为 vite.config 现在位于 `apps/web/`，`./src` 相对它即 `apps/web/src`）。若 config 里 `__dirname` 缺失，`import { fileURLToPath } from 'node:url'` 修正。运行 `npx tsc --noEmit`（在 `apps/web` 下）应 0 错误。

- [ ] **Step 3: 新建根 `package.json`（workspaces 编排）**

```json
{
  "name": "knowledge-base",
  "private": true,
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:web": "npm run dev --workspace @kb/web",
    "dev:server": "npm run dev --workspace @kb/server",
    "build": "npm run build --workspace @kb/web && npm run build --workspace @kb/server",
    "lint": "npm run lint --workspace @kb/web && npm run lint --workspace @kb/server",
    "test": "npm run test --workspaces --if-present"
  }
}
```

- [ ] **Step 4: 迁移 `apps/web/package.json` 的 name 并确认脚本**

把 `apps/web/package.json` 的 `"name"` 改为 `"@kb/web"`；确认 `scripts` 含 `dev/build/lint`（沿用原值）。然后在仓库根：

```bash
npm install
npm run build --workspace @kb/web
```

Expected: workspaces 装包成功；`@kb/web` build 0 错误。

- [ ] **Step 5: 迁移后冒烟**

```bash
npm run dev:web &   # 起 apps/web dev
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

Expected: `200`。杀后台进程。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(workspace): 前端迁入 apps/web，建立 npm workspaces 根"
```

---

### Task 2: `packages/shared` — 类型 + zod schema + API 契约

**Files:**
- Create: `packages/shared/package.json`、`packages/shared/tsconfig.json`、`packages/shared/src/index.ts`、`packages/shared/src/schemas.ts`、`packages/shared/src/types.ts`、`packages/shared/test/schemas.test.ts`

**Interfaces:**
- Consumes: 无（独立包）。
- Produces: `parseOk(data, schema)`、`parseErr(payload)`；`HealthResponse`、`DemoLoginResponse` zod schema；`API_BASE` 常量；`types.ts` 导出核心实体类型 `Org/Plan/Member/User/Journey`。

- [ ] **Step 1: 写失败测试（信封解析）**

```ts
// packages/shared/test/schemas.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { okSchema, parseOk, parseErr } from '../src/schemas.js'

test('parseOk 解析 { ok:true, data }', () => {
  const parsed = parseOk({ ok: true, data: { status: 'up' } }, okSchema)
  assert.equal(parsed.status, 'up')
})
test('parseOk 对畸形 data 抛错', () => {
  assert.throws(() => parseOk({ ok: true, data: {} }, okSchema))
})
test('parseErr 解析 { ok:false, error }', () => {
  const e = parseErr({ ok: false, error: { code: 'NOT_FOUND', message: 'x' } })
  assert.equal(e.code, 'NOT_FOUND')
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test --workspace @kb/shared`（先 `cd packages/shared && npm init -y` 调整 name 为 `@kb/shared`，scripts.test = `node --test test/`，编译用 `tsc`）。
Expected: FAIL（`src/schemas.js` 不存在）。

- [ ] **Step 3: 实现 `packages/shared`**

```ts
// packages/shared/src/types.ts
export interface Org { id: string; name: string; industry: string; contact: string }
export interface Plan { tier: string; storageUsedGB: number; storageTotalGB: number; seats: number; seatsUsed: number; validUntil: string }
export interface Member { id: string; name: string; email: string; role: string; dept: string; status: '活跃' | '待激活'; joinedAt: string }
export interface User { id: string; memberId: string; email: string; role: string }
export interface Journey { activated: boolean; step: number; installedApps: string[]; uninstalledApps: string[]; userInstalledApps: string[]; invitesSent: boolean; configProgress: number }

// packages/shared/src/schemas.ts
import { z } from 'zod'
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

// packages/shared/src/index.ts
export * from './types.js'
export * from './schemas.js'
export const API_BASE = '/api/v1'
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test --workspace @kb/shared`
Expected: 2 pass（parseOk 两用例 + parseErr 一用例）。

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): 类型 + zod 信封契约 + API_BASE"
```

---

### Task 3: 后端骨架 `apps/server` — buildApp + health + demo-login

**Files:**
- Create: `apps/server/package.json`、`apps/server/tsconfig.json`、`apps/server/src/index.ts`、`apps/server/src/app.ts`、`apps/server/src/db/client.ts`、`apps/server/src/routes/health.ts`、`apps/server/src/routes/auth.ts`、`apps/server/src/middleware/error-handler.ts`、`apps/server/test/app.test.ts`

**Interfaces:**
- Consumes: `@kb/shared` 的 `API_BASE`/schema（Task 2）。
- Produces: `buildApp(): Promise<FastifyInstance>`（可注入测试）；`GET /api/v1/health → { ok:true, data:{ status:'up' } }`；`POST /api/v1/auth/demo-login → { ok:true, data:{ token, user } }`；未捕获异常走统一错误信封。

- [ ] **Step 1: 写失败测试（inject）**

```ts
// apps/server/test/app.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/app.js'

test('GET /api/v1/health -> ok', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { ok: true, data: { status: 'up' } })
})
test('POST /api/v1/auth/demo-login -> token', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/demo-login' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.ok(body.data.token)
  assert.equal(body.data.user.role, '管理员')
})
test('未知路由 -> 404 信封', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/v1/nope' })
  assert.equal(res.statusCode, 404)
  assert.equal(res.json().ok, false)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test --workspace @kb/server`（`apps/server/package.json`：name `@kb/server`，type module，scripts.test = `node --test test/`；deps：fastify、@fastify/cors、better-sqlite3、zod、@kb/shared `workspace:*`）。
Expected: FAIL（app.js 不存在）。

- [ ] **Step 3: 实现骨架**

```ts
// apps/server/src/db/client.ts
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data')
mkdirSync(DATA_DIR, { recursive: true })
export const db = new Database(path.join(DATA_DIR, 'kb.sqlite'))
db.pragma('journal_mode = WAL')

// apps/server/src/middleware/error-handler.ts
import type { FastifyInstance } from 'fastify'
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err)
    const code = err.statusCode === 404 ? 'NOT_FOUND' : err.statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL'
    reply.status(err.statusCode ?? 500).send({ ok: false, error: { code, message: err.message } })
  })
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: '路由不存在' } }))
}

// apps/server/src/routes/health.ts
import type { FastifyInstance } from 'fastify'
export function registerHealth(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true, data: { status: 'up' } }))
}

// apps/server/src/routes/auth.ts
import type { FastifyInstance } from 'fastify'
export function registerAuth(app: FastifyInstance) {
  app.post('/auth/demo-login', async () => ({
    ok: true,
    data: { token: 'demo-token-zhangwei', user: { id: 'u-1', name: '张伟', role: '管理员' } },
  }))
}

// apps/server/src/app.ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { registerErrorHandler } from './middleware/error-handler.js'
import { registerHealth } from './routes/health.js'
import { registerAuth } from './routes/auth.js'

export async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(cors, { origin: true })
  app.register(async (api) => {
    registerHealth(api)
    registerAuth(api)
  }, { prefix: '/api/v1' })
  registerErrorHandler(app)
  return app
}

// apps/server/src/index.ts
import { buildApp } from './app.js'
const app = await buildApp()
const port = Number(process.env.PORT ?? 8080)
await app.listen({ port, host: '0.0.0.0' })
console.log(`server on :${port}`)
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test --workspace @kb/server`
Expected: 3 pass；`npm run dev:server` 后 `curl http://localhost:8080/api/v1/health` 返回 `{"ok":true,"data":{"status":"up"}}`。

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): Fastify 骨架 buildApp + health + demo-login"
```

---

### Task 4: 核心表 schema + 最小 seed

**Files:**
- Create: `apps/server/src/db/schema.ts`、`apps/server/src/db/seed.ts`、`apps/server/test/db.test.ts`

**Interfaces:**
- Consumes: `db` 单例（Task 3）、`@kb/shared` 类型。
- Produces: `createSchema()`（幂等建核心表）、`seedIfEmpty()`（org/plan/members/users/trial_journey 初始行，口径与 mock 一致）；后续 B–E 向 `createSchema()` 追加各自的 `CREATE TABLE IF NOT EXISTS`。

- [ ] **Step 1: 写失败测试**

```ts
// apps/server/test/db.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { db } from '../src/db/client.js'
import { createSchema } from '../src/db/schema.js'
import { seedIfEmpty } from '../src/db/seed.js'

test('createSchema 幂等 + seed 一次', () => {
  createSchema(); createSchema()
  seedIfEmpty()
  const org = db.prepare('SELECT * FROM org LIMIT 1').get()
  assert.ok(org)
  assert.equal(db.prepare('SELECT COUNT(*) c FROM members').get().c, 6)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test --workspace @kb/server`
Expected: FAIL（schema.js 不存在）。

- [ ] **Step 3: 实现核心表与 seed**

```ts
// apps/server/src/db/schema.ts
import { db } from './client.js'
const T = (sql: string) => db.exec(sql)
export function createSchema() {
  T(`CREATE TABLE IF NOT EXISTS org (id TEXT PRIMARY KEY, name TEXT, industry TEXT, contact TEXT)`)
  T(`CREATE TABLE IF NOT EXISTS plan (id TEXT PRIMARY KEY, tier TEXT, storageUsedGB REAL, storageTotalGB REAL, seats INTEGER, seatsUsed INTEGER, validUntil TEXT)`)
  T(`CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT, dept TEXT, status TEXT, joinedAt TEXT)`)
  T(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, memberId TEXT, email TEXT, role TEXT)`)
  T(`CREATE TABLE IF NOT EXISTS trial_journey (id INTEGER PRIMARY KEY CHECK (id = 1), activated INTEGER, step INTEGER, installedApps TEXT, uninstalledApps TEXT, userInstalledApps TEXT, invitesSent INTEGER, configProgress INTEGER)`)
}

// apps/server/src/db/seed.ts
import { db } from './client.js'
const members = [
  ['m-zw','张伟','zhangwei@example.com','管理员','总经办','活跃','2024-04-02'],
  ['m-ln','李娜','lina@example.com','可编辑','人力资源','活跃','2024-04-02'],
  ['m-wq','王强','wangqiang@example.com','可问答','产品部','活跃','2024-04-05'],
  ['m-zm','赵敏','zhaomin@example.com','可问答','销售部','活跃','2024-04-08'],
  ['m-cc','陈可','chenke@example.com','可问答','IT 部','待激活','2024-04-10'],
  ['m-ly','刘洋','liuyang@example.com','可问答','客服部','待激活','2024-04-12'],
] as const
export function seedIfEmpty() {
  const n = (db.prepare('SELECT COUNT(*) c FROM org').get() as { c: number }).c
  if (n > 0) return
  db.prepare(`INSERT INTO org VALUES ('org-1','示例科技有限公司','软件服务','zhangwei@example.com')`).run()
  db.prepare(`INSERT INTO plan VALUES ('plan-1','试用版',0.68,1,20,12,'2025-06-03')`).run()
  const ins = db.prepare(`INSERT INTO members VALUES (?,?,?,?,?,?,?)`)
  for (const m of members) ins.run(...m)
  db.prepare(`INSERT INTO users VALUES ('u-1','m-zw','zhangwei@example.com','管理员')`).run()
  db.prepare(`INSERT INTO trial_journey (id,activated,step,installedApps,uninstalledApps,userInstalledApps,invitesSent,configProgress) VALUES (1,0,0,'["wecom-qa","custom-api","sso"]','[]','[]',0,0)`).run()
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test --workspace @kb/server`
Expected: 新增 1 pass；seed 幂等（二次调用计数仍 6）。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db
git commit -m "feat(server): 核心表 schema + 最小 seed（组织/套餐/成员/旅程）"
```

---

### Task 5: 前端 API client 脚手架 + `VITE_USE_MOCK` 开关 + vite 代理

**Files:**
- Create: `apps/web/src/api/client.ts`、`apps/web/src/api/index.ts`、`apps/web/.env.example`
- Modify: `apps/web/vite.config.ts`（proxy `/api` → `http://localhost:8080`）

**Interfaces:**
- Consumes: `@kb/shared` 的 `API_BASE`/`envelopeSchema`/`DemoLoginResponse`。
- Produces: `apiRequest<T>(path, { method, body, token, schema }): Promise<T>`；`demoLogin(): Promise<{ token, user }>`；`getEnvMode(): 'mock' | 'api'`（读 `import.meta.env.VITE_USE_MOCK`）。

- [ ] **Step 1: 实现 client（tsc 门禁 + 冒烟）**

```ts
// apps/web/src/api/client.ts
import { API_BASE, envelopeSchema, type DemoLoginResponse, DemoLoginResponse as DL } from '@kb/shared'
import type { ZodType } from 'zod'

export function getEnvMode(): 'mock' | 'api' {
  return import.meta.env.VITE_USE_MOCK === '0' ? 'api' : 'mock'
}
export async function apiRequest<T>(path: string, opts: { method?: string; body?: unknown; token?: string; schema?: ZodType<T> } = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const raw: unknown = await res.json()
  const env = envelopeSchema.parse(raw)
  if (!env.ok) throw new Error(`${env.error.code}: ${env.error.message}`)
  return opts.schema ? opts.schema.parse(env.data) : (env.data as T)
}
export async function demoLogin(): Promise<DemoLoginResponse> {
  return apiRequest('/auth/demo-login', { method: 'POST', schema: DL })
}

// apps/web/src/api/index.ts
export * from './client.js'
```

- [ ] **Step 2: 配置 vite 代理 + env 示例**

`apps/web/vite.config.ts` 的 `server` 增加：

```ts
server: {
  port: 3000,
  proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } },
},
```

`apps/web/.env.example`：

```text
VITE_USE_MOCK=1
```

- [ ] **Step 3: 类型与构建门禁**

Run（`apps/web` 下）: `npx tsc --noEmit` 与 `npm run build`。
Expected: 0 错误（`@kb/shared` 经 workspaces 解析）。

- [ ] **Step 4: 冒烟（mock 模式回归）**

Run: `npm run dev:web`，`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/`
Expected: `200`；页面行为不变（VITE_USE_MOCK 默认 1）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/api apps/web/.env.example apps/web/vite.config.ts
git commit -m "feat(web): API client 脚手架 + VITE_USE_MOCK 开关 + vite /api 代理"
```

---

### Task 6: 端到端冒烟 + 收尾

**Files:**
- Modify: 根 `package.json`（补 `"dev"` 一键并行脚本）、`apps/web/.gitignore`

**Interfaces:**
- Consumes: Task 1–5 全部产物。

- [ ] **Step 1: 根一键脚本 + gitignore**

根 `package.json` scripts 增加 `"dev": "npm run dev:web & npm run dev:server"`。`apps/web/.gitignore` 保留 `node_modules`、`dist`、`.env`（追加 `.env`，防 token 泄露）。

- [ ] **Step 2: 全量门禁**

Run（仓库根）: `npm run lint`、`npm run build`、`npm test`
Expected: lint 0；build 0（web + server）；server 测试 4 pass（Task 3 三例 + Task 4 一例）。

- [ ] **Step 3: 端到端冒烟**

```bash
npm run dev:server &   # :8080
npm run dev:web &      # :3000，/api 代理到 :8080
curl -s http://localhost:8080/api/v1/health
curl -s -X POST http://localhost:3000/api/v1/auth/demo-login   # 经代理
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

Expected: health 与 demo-login 返回 ok 信封；前端 200。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: Phase A 收尾 — 一键脚本与端到端冒烟"
```

---

## Self-Review 记录

- **Spec 覆盖**：目录重构（Task 1）、后端骨架 health/demo-login（Task 3）、核心表+seed（Task 4）、api client + 开关 + 代理（Task 5）、根编排与端到端（Task 1/6）——设计文档 Phase A 全部要点均有任务。
- **占位符**：无 TBD；每个代码步骤含完整代码。
- **类型一致**：`apiRequest`/`demoLogin`/`getEnvMode`、`buildApp`、`createSchema`/`seedIfEmpty`、`parseOk`/`parseErr` 在 Task 间签名一致。
- **范围细化**：`schema.ts` 由「一次全表」调整为「Phase A 核心表 + B–E 追加」（幂等 DDL），已在计划开头说明。
