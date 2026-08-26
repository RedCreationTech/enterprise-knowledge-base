# 智能助手区域统一 + 侧边栏整栏折叠 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** ①快速配置/每日待办的【智能助手】区域一致优化（视口高 + 独立滚动）②侧边栏增加整栏折叠（图标窄栏）。

**Tech Stack:** React 19 · TS · Tailwind · framer-motion · localStorage

## Global Constraints
- 中文 UI；视觉 design-system；不改 mock 数据口径与功能行为；每任务 tsc/build/lint 0 + headless 无白屏。
- 折叠状态用 localStorage `ekb.sidebar.collapsed`；手风琴（分组折叠）保留不变。

---

### Task 1: 快速配置【智能助手】区域与每日待办一致优化

**Files:** `apps/web/src/pages/QuickConfig.tsx`
- 左栏 ChatPanel 当前：wrapper `w-[28%] min-w-[340px] max-w-[400px] shrink-0`；ChatPanel `className="sticky top-20 h-[calc(100dvh-320px)] min-h-[520px]"`。
- 优化：ChatPanel 改为 `sticky top-20 h-[calc(100dvh-256px)] overflow-hidden`（去掉会强制超出视口的 `min-h-[520px]`；加 `overflow-hidden` 让内部时间线独立滚动，与 DailyTodo 的 ChatPanel `overflow-hidden` 行为一致）。
- 保留 wrapper 宽度；保证 tsc/build/lint 0 + headless `/workspace/quick-config` 无白屏、ChatPanel 不再外溢撑高文档。

---

### Task 2: 侧边栏整栏折叠（图标窄栏）

**Files:** `apps/web/src/components/layout/WorkspaceShell.tsx`（+ 可能的子组件）
- 加 `sidebarCollapsed: boolean` 状态（localStorage `ekb.sidebar.collapsed`，默认 false）。
- 头部（WorkspaceHeader 左侧 logo 旁）加**切换按钮**（PanelLeftClose/PanelLeftOpen 图标），点击切换。
- aside：`w-[184px]` ↔ 折叠 `w-[64px]`（icon rail），过渡动画。
- NavList：折叠时——分组标题隐藏、导航项只显图标（`h-10 w-10 justify-center`）+ `title` tooltip、隐藏「每日待办」计数 pill、忽略 todoPill；展开时保持现状（含手风琴）。
- 侧边栏顶部企业卡：折叠时只显 logo（隐藏公司名/试用版），底部套餐卡折叠时隐藏或只显升级按钮（建议隐藏）。
- 状态持久化：切换写 localStorage，读时恢复。
- 验证：tsc/build/lint 0；headless 点击切换 → aside 宽度/图标模式切换；刷新后折叠状态保持；展开态手风琴不回归。

---

## Self-Review 记录
- 覆盖：智能助手一致（T1）、侧边栏折叠（T2）。
- 类型一致：`sidebarCollapsed/setSidebarCollapsed` 在 WorkspaceShell 内；`ekb.sidebar.collapsed` 常量。
- 无占位符；验证靠 tsc/build/lint + headless。
