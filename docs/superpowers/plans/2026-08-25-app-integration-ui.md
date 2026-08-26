# 应用中心/集成管理 UI 优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 优化【应用中心】智能助手列/内容列滚动 + 应用卡片多样展示；优化【集成管理】卡片过大。

**Tech Stack:** React 19 · TS · Tailwind · framer-motion

## Global Constraints
- 中文 UI；视觉 `specs/design-system.md`；不改 mock 数值口径与功能行为。
- 每任务：`cd apps/web && npx tsc --noEmit` + `npm run build --workspace @kb/web` + `npm run lint`（根）全 0。
- 不回归现有功能（搜索/分类 Tab/安装/管理/详情抽屉/Esc/焦点返回；集成管理配置 Tab/断开/卸载/重授权）。

---

### Task 1: 应用中心（滚动 + 卡片多样）

**Files:**
- Modify: `apps/web/src/mocks/base.mock.ts`（AppItem 加 `size?: 'featured'|'standard'|'compact'`，为 8 应用标注：featured=飞书问答插件/企业微信知识助手；compact=自定义API/单点登录SSO；其余 standard）、`apps/web/src/pages/InstallApp.tsx`

**Interfaces:**
- Consumes: `AppItem`（新增可选 `size`）、现有 `filtered`（已含 extra）。
- Produces: 三栏独立滚动；`AppCard` 按 `a.size` 渲染 featured/standard/compact 变体。

- [ ] **Step 1 滚动优化**：左 AI 面板 `h-[640px]` → 视口约束（`min-[1366px]:h-[calc(100dvh-140px)]`，ChatPanel 内部已滚，仅改外层高度并保持 `2xl:sticky`）；中内容列加 `min-[1366px]:h-[calc(100dvh-140px)] min-[1366px]:overflow-y-auto`（App 网格独立滚动）；1280–1365 中列全宽仍走页面滚动；`gridRef.scrollIntoView`/自适应等逻辑保持。
- [ ] **Step 2 卡片多样**：给 apps 加 `size`；`AppCard` 渲染三变体：
  - featured：`sm:col-span-2` 跨列、`bg-gradient-to-r from-brand-50 via-white to-white`、图标 `h-14`（放渐变圆角 tile `bg-brand-100` 内）、标题 `text-h2`、desc 3 行、CTA 突出。
  - standard：现有卡片（图标 h-10、text-[15px] 名称、line-clamp-2）。
  - compact：横排紧凑（logo h-8 + 名称一行 + 分类小字），适合开发/工具类，`p-3`。
- [ ] **Step 3**：featured 卡在 `min-[1366px]` 下跨 2 列；网格 `grid-cols` 自适应（`lg:grid-cols-2 xl:grid-cols-3 min-[1366px]:grid-cols-2`）下 featured 用 `sm:col-span-2`。
- [ ] **Step 4 验证**：`tsc`/`build`/`lint` 0；headless `/workspace/apps` 无白屏；三栏各自滚动类存在；featured 大卡/compact 小卡渲染。
- [ ] **Step 5 Commit** `feat(web): 应用中心滚动优化 + 应用卡片多样展示`

---

### Task 2: 集成管理卡片紧凑化

**Files:**
- Modify: `apps/web/src/pages/Integrations.tsx`

**Interfaces:**
- Consumes: `visibleIntegrations`。
- Produces: 更紧凑的集成卡。

- [ ] **Step 1**：卡 `p-5`→`p-4`；名称 `text-h3`(18px)→`text-body font-semibold`(14px)；vendor 保留 caption；logo `h-10`→`h-9`；状态 pill `mt-3`→`mt-2.5`；`dl` `mt-3`→`mt-2`、行间距 `gap-1.5`→`gap-1`；footer `mt-3.5 pt-3`→`mt-3 pt-2.5`；按钮行紧凑。
- [ ] **Step 2**：`md:grid-cols-2` 保留（2×2 网格本身合理，仅卡片内容变紧凑）；若卡片内容变少导致网格过空，可考虑 `md:grid-cols-2 xl:grid-cols-2` 保持或评估 3 列（谨慎，先紧凑不扩列）。
- [ ] **Step 3 验证**：`tsc`/`build`/`lint` 0；headless `/workspace/integrations` 无白屏；卡片高度明显减小（class 断言 p-4/text-body）。
- [ ] **Step 4 Commit** `feat(web): 集成管理卡片紧凑化`

---

## Self-Review 记录
- 覆盖：应用中心滚动+卡片多样（T1）、集成卡紧凑（T2）。
- 类型一致：AppItem.size 可选；其余沿用现有数据/状态；新变体类名与现有 card 模式复用。
- 无占位符；验证靠 tsc/build/lint + headless。
